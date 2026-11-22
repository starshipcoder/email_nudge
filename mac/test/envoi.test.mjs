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

test('un envoi réel part une fois, avec le pied, la désinscription et la clé d’idempotence', async () => {
  const { db, porte, envoyes } = monter();
  assert.deepEqual(await porte.envoyerAction('essai_j2__a'), { statut: 'envoye' });
  assert.equal(envoyes.length, 1);
  assert.equal(envoyes[0].cle, 'essai_j2__a');
  assert.equal(envoyes[0].message.to, 'ana@exemple.fr');
  assert.match(envoyes[0].message.text, /répondez simplement STOP/);
  assert.equal(envoyes[0].message.headers['List-Unsubscribe'], '<mailto:moi@exemple.fr?subject=STOP>');
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

test('une erreur de Resend est notée, l’action passe en erreur', async () => {
  const { db, porte } = monter({ resend: async () => { throw new Error('Resend 422 : domaine'); } });
  assert.equal((await porte.envoyerAction('essai_j2__a')).statut, 'erreur');
  assert.equal(db.donnees.crm_envois.get('essai_j2__a').statut, 'erreur');
  assert.equal(db.donnees.crm_actions.get('essai_j2__a').statut, 'erreur');
});

test('pied de page dans la langue de la personne', () => {
  assert.match(piedDePage('fr', 'moi@exemple.fr'), /répondez simplement STOP/);
  assert.match(piedDePage('de', 'moi@exemple.fr'), /antworten Sie einfach STOP/);
  assert.match(piedDePage('nl', 'moi@exemple.fr'), /just reply STOP/);
});

test('e-mail d’essai annulé : pas à qui a repris son essai ou payé, relu chez RevenueCat', () => {
  assert.equal(gardeFouType('essai_annule', lireAbonne(ESSAI, MAINTENANT), MAINTENANT), 'a repris son essai ou payé');
  assert.equal(gardeFouType('essai_annule', lireAbonne(PAYANT_ANNULE, MAINTENANT), MAINTENANT), null);
  assert.equal(gardeFouType('essai_annule', lireAbonne({ subscriber: { subscriptions: {} } }, MAINTENANT), MAINTENANT), null);
});
