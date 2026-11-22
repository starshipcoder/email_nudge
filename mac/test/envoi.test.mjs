import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { cleUtilisateur, gardeFouType, lireAbonne, piedDePage, porteEnvoi } from '../envoi.mjs';

const MAINTENANT = new Date('2026-12-02T10:00:00Z');
const jours = (n) => new Date(MAINTENANT.getTime() + n * 86400000).toISOString();
const REGLAGES = { envois_coupes: false, a_blanc: false, expediteur: 'Prénom d’Easy Way <bonjour@exemple.fr>', repondre_a: 'moi@exemple.fr', adresse_test: 'test@exemple.fr' };
const ESSAI = { subscriber: { subscriptions: { p: { period_type: 'trial', expires_date: jours(2), unsubscribe_detected_at: null } } } };
const PAYANT_ANNULE = { subscriber: { subscriptions: { p: { period_type: 'normal', expires_date: jours(10), unsubscribe_detected_at: jours(-1) } } } };

function monter({ reglages = REGLAGES, user = {}, action = {}, fiche = null, abonne = ESSAI, resend } = {}) {
  const u = { id: 'ana@exemple.fr', revenuecat_id: '$RCAnonymousID:a', locale: 'fr', ...user };
  const db = baseEnMemoire({
    crm_reglages: [{ id: 'general', ...reglages }],
    users: [u],
    crm_actions: [{ id: 'essai_j2__a', type: 'essai_j2', user_id: u.id, statut: 'prete', sujet: 'Ton essai', corps: 'Bonjour', echeance: jours(1), ...action }],
    crm_fiches: fiche ? [{ id: cleUtilisateur(u.id), ...fiche }] : [],
  });
  const envoyes = [];
  const porte = porteEnvoi({
    db, maintenant: () => MAINTENANT, lireRevenueCat: async () => abonne,
    envoyerResend: resend ?? (async (message, cle) => { envoyes.push({ message, cle }); return { id: 'r1' }; }),
  });
  return { db, porte, envoyes };
}

test('un envoi réel part une fois, tel quel, sans pied STOP, avec la clé d’idempotence', async () => {
  const { db, porte, envoyes } = monter();
  assert.deepEqual(await porte.envoyerAction('essai_j2__a'), { statut: 'envoye' });
  assert.equal(envoyes.length, 1);
  assert.equal(envoyes[0].cle, 'essai_j2__a');
  assert.equal(envoyes[0].message.to, 'ana@exemple.fr');
  // Fondateur, 22/11 : « on ne met pas le STOP dans les mails ».
  assert.equal(envoyes[0].message.text, 'Bonjour');
  assert.equal(envoyes[0].message.headers, undefined);
  assert.equal(db.donnees.crm_envois.get('essai_j2__a').statut, 'envoye');
  assert.equal(db.donnees.crm_actions.get('essai_j2__a').statut, 'envoyee');
  // Deuxième fois : refusé.
  const encore = await porte.envoyerAction('essai_j2__a');
  assert.equal(encore.statut, 'bloquee');
  assert.equal(envoyes.length, 1);
});

test('le verrou tient même si l’action est remise à prête', async () => {
  const { db, porte, envoyes } = monter();
  await porte.envoyerAction('essai_j2__a');
  await db.ecrire('crm_actions', 'essai_j2__a', { statut: 'prete' });
  assert.deepEqual(await porte.envoyerAction('essai_j2__a'), { statut: 'bloquee', raison: 'déjà envoyé' });
  assert.equal(envoyes.length, 1);
});

test('coupe-circuit : rien ne part, pas même un essai', async () => {
  const { porte, envoyes } = monter({ reglages: { ...REGLAGES, envois_coupes: true } });
  assert.deepEqual(await porte.envoyerAction('essai_j2__a'), { statut: 'bloquee', raison: 'envois coupés' });
  assert.deepEqual(await porte.envoyerAction('essai_j2__a', { canal: 'test_moi' }), { statut: 'bloquee', raison: 'envois coupés' });
  assert.equal(envoyes.length, 0);
});

test('à blanc : le journal est écrit, rien ne part', async () => {
  const { db, porte, envoyes } = monter({ reglages: { ...REGLAGES, a_blanc: true } });
  assert.deepEqual(await porte.envoyerAction('essai_j2__a'), { statut: 'a_blanc' });
  assert.equal(envoyes.length, 0);
  assert.equal(db.donnees.crm_envois.get('essai_j2__a').statut, 'a_blanc');
  assert.match(db.donnees.crm_envois.get('essai_j2__a').texte, /^Bonjour/);
});

test('un réglage d’expéditeur manquant bloque tout', async () => {
  const { porte } = monter({ reglages: { envois_coupes: false, a_blanc: false } });
  assert.match((await porte.envoyerAction('essai_j2__a')).raison, /réglage manquant/);
});

test('désinscrit, sans adresse, échéance passée : bloqué', async () => {
  assert.equal((await monter({ fiche: { desinscrit: true } }).porte.envoyerAction('essai_j2__a')).raison, 'désinscrit');
  assert.equal((await monter({ action: { echeance: jours(-1) } }).porte.envoyerAction('essai_j2__a')).raison, 'trop tard');
});

test('jamais de rappel d’essai à qui a payé ou annulé, relu chez RevenueCat', async () => {
  const annule = { subscriber: { subscriptions: { p: { period_type: 'trial', expires_date: jours(2), unsubscribe_detected_at: jours(-1) } } } };
  assert.equal((await monter({ abonne: annule }).porte.envoyerAction('essai_j2__a')).raison, 'déjà payé ou annulé');
  assert.equal((await monter({ abonne: PAYANT_ANNULE }).porte.envoyerAction('essai_j2__a')).raison, 'déjà payé ou annulé');
  const fini = { subscriber: { subscriptions: { p: { period_type: 'trial', expires_date: new Date(MAINTENANT.getTime() + 6 * 3600000).toISOString() } } } };
  assert.equal((await monter({ abonne: fini }).porte.envoyerAction('essai_j2__a')).raison, 'trop tard');
});

test('e-mail de résiliation : seulement si l’abonné est toujours résilié', async () => {
  const action = { id: 'resiliation__a', type: 'resiliation' };
  const ok = monter({ action, abonne: PAYANT_ANNULE });
  await ok.db.ecrire('crm_actions', 'resiliation__a', { type: 'resiliation', user_id: 'ana@exemple.fr', statut: 'prete', sujet: 's', corps: 'c' });
  assert.equal((await ok.porte.envoyerAction('resiliation__a')).statut, 'envoye');
  assert.equal(gardeFouType('resiliation', lireAbonne(ESSAI, MAINTENANT), MAINTENANT), 'plus résilié');
});

test('pas plus d’un e-mail en 72 h à la même personne', async () => {
  const { porte, envoyes } = monter({ fiche: { dernier_envoi_le: jours(-1) } });
  assert.deepEqual(await porte.envoyerAction('essai_j2__a'), { statut: 'bloquee', raison: 'trop tôt' });
  assert.equal(envoyes.length, 0);
});

test('plafond du jour', async () => {
  const { db, porte } = monter({ reglages: { ...REGLAGES, plafond_jour: 1 } });
  await db.creer('crm_envois', 'autre', { statut: 'envoye', le: MAINTENANT });
  assert.equal((await porte.envoyerAction('essai_j2__a')).raison, 'plafond du jour');
});

test('un utilisateur de test reçoit à l’adresse de test', async () => {
  const { db, porte, envoyes } = monter({ user: { is_test_user: true } });
  await porte.envoyerAction('essai_j2__a');
  assert.equal(envoyes[0].message.to, 'test@exemple.fr');
  assert.equal(db.donnees.crm_envois.get('essai_j2__a').destinataire_reel, 'adresse_test');
});

test('m’envoyer un essai : le texte part à l’adresse de test, l’action ne bouge pas', async () => {
  const { db, porte, envoyes } = monter();
  assert.equal((await porte.envoyerAction('essai_j2__a', { canal: 'test_moi' })).statut, 'envoye');
  assert.equal(envoyes[0].message.to, 'test@exemple.fr');
  assert.match(envoyes[0].message.subject, /^\[ESSAI\]/);
  assert.equal(db.donnees.crm_actions.get('essai_j2__a').statut, 'prete');
  assert.equal(db.donnees.crm_envois?.size ?? 0, 0);
});

test('une erreur de Resend est notée, l’action reste prête, la personne n’est pas retenue 72 h, et un nouvel essai part', async () => {
  let echoue = true;
  const envoyes = [];
  const { db, porte } = monter({ resend: async (m, cle) => { if (echoue) throw new Error('Resend 429 : trop vite'); envoyes.push({ m, cle }); return { id: 'r2' }; } });
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'erreur');
  assert.equal(db.donnees.crm_envois.get('essai_j2__a').statut, 'erreur');
  assert.equal(db.donnees.crm_actions.get('essai_j2__a').statut, 'prete');
  assert.match(db.donnees.crm_actions.get('essai_j2__a').derniere_erreur, /429/);
  assert.equal(db.donnees.crm_fiches.get(cleUtilisateur('ana@exemple.fr')).dernier_envoi_le, null);
  echoue = false;
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'envoye');
  assert.equal(envoyes[0].cle, 'essai_j2__a', 'la même clé d’idempotence');
});

test('un envoi coupé en route se reprend après 10 minutes, pas avant, et pas après 23 h', async () => {
  const { db, porte, envoyes } = monter();
  await db.creer('crm_envois', 'essai_j2__a', { statut: 'en_cours', le: new Date(MAINTENANT.getTime() - 5 * 60000) });
  assert.equal((await porte.envoyerAction('essai_j2__a')).raison, 'déjà envoyé');
  await db.ecrire('crm_envois', 'essai_j2__a', { le: new Date(MAINTENANT.getTime() - 24 * 3600000) });
  assert.match((await porte.envoyerAction('essai_j2__a')).raison, /plus de 23 h/);
  await db.ecrire('crm_envois', 'essai_j2__a', { le: new Date(MAINTENANT.getTime() - 30 * 60000) });
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'envoye');
  assert.equal(envoyes.length, 1);
});

test('à blanc : l’action reste prête, sans écart de 72 h, et part pour de vrai ensuite', async () => {
  const { db, porte, envoyes } = monter({ reglages: { ...REGLAGES, a_blanc: true } });
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'a_blanc');
  assert.equal(db.donnees.crm_actions.get('essai_j2__a').statut, 'prete');
  assert.equal(db.donnees.crm_fiches.get(cleUtilisateur('ana@exemple.fr'))?.dernier_envoi_le, undefined);
  await db.ecrire('crm_reglages', 'general', { a_blanc: false });
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'envoye');
  assert.equal(envoyes.length, 1);
});

test('un point à vérifier bloque l’envoi jusqu’à « C’est vérifié »', async () => {
  const { db, porte, envoyes } = monter({ action: { a_verifier: 'le titre public est en français' } });
  assert.match((await porte.envoyerAction('essai_j2__a')).raison, /^à vérifier/);
  const { suivi } = await import('../suivi.mjs');
  await suivi(db, { maintenant: () => MAINTENANT }).verifier('essai_j2__a');
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'envoye');
  assert.equal(envoyes.length, 1);
});

test('une résiliation déjà échue reste une résiliation ; le plafond compte les envois en route, pas ceux à blanc', async () => {
  const echu = { subscriber: { subscriptions: { p: { period_type: 'normal', expires_date: jours(-1), unsubscribe_detected_at: jours(-5) } } } };
  assert.equal(gardeFouType('resiliation', lireAbonne(echu, MAINTENANT), MAINTENANT), null);
  const rembourse = { subscriber: { subscriptions: { p: { period_type: 'normal', expires_date: jours(-1), unsubscribe_detected_at: jours(-5), refunded_at: jours(-4) } } } };
  assert.equal(gardeFouType('resiliation', lireAbonne(rembourse, MAINTENANT), MAINTENANT), 'plus résilié');
  const { db, porte } = monter({ reglages: { ...REGLAGES, plafond_jour: 1 } });
  await db.creer('crm_envois', 'blanc', { statut: 'a_blanc', le: MAINTENANT });
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'envoye');
  const deux = monter({ reglages: { ...REGLAGES, plafond_jour: 1 } });
  await deux.db.creer('crm_envois', 'route', { statut: 'en_cours', le: MAINTENANT });
  assert.equal((await deux.porte.envoyerAction('essai_j2__a')).raison, 'plafond du jour');
});

test('plus de pied STOP ; la ligne WhatsApp du fondateur dans la langue de la personne, s’il a réglé son numéro', async () => {
  assert.equal(piedDePage('fr', null), '');
  assert.equal(piedDePage('fr', '33600000000'), '\n\nWhatsApp : 06 00 00 00 00');
  assert.equal(piedDePage('en', '33600000000'), '\n\nWhatsApp: +33 6 00 00 00 00 (I am French)');
  assert.equal(piedDePage('de', '33600000000'), '\n\nWhatsApp: +33 6 00 00 00 00 (ich bin Franzose)');
  assert.match(piedDePage('nl', '33600000000'), /\(I am French\)$/);
  assert.equal(piedDePage('fr', 'pas un numéro'), '');
  const { porte, envoyes } = monter({ reglages: { ...REGLAGES, whatsapp: '33600000000' } });
  await porte.envoyerAction('essai_j2__a');
  assert.equal(envoyes[0].message.text, 'Bonjour\n\nWhatsApp : 06 00 00 00 00');
});

test('e-mail d’essai annulé : pas à qui a repris son essai ou payé, relu chez RevenueCat', () => {
  assert.equal(gardeFouType('essai_annule', lireAbonne(ESSAI, MAINTENANT), MAINTENANT), 'a repris son essai ou payé');
  assert.equal(gardeFouType('essai_annule', lireAbonne(PAYANT_ANNULE, MAINTENANT), MAINTENANT), null);
  assert.equal(gardeFouType('essai_annule', lireAbonne({ subscriber: { subscriptions: {} } }, MAINTENANT), MAINTENANT), null);
});
