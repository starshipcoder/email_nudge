import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { baseEnMemoire, filtrer, ligneUtilisateur, nettoyerPrenom, suivi } from '../suivi.mjs';
import { application, ecritureAutorisee, hoteAutorise } from '../serveur.mjs';
import { decoderChamps, encoderChamps, idDe, jetonGcloud } from '../firestore.mjs';

const inscrits = () => [
  { id: 'a@exemple.fr', first_name: 'Ana', revenuecat_id: '$RCAnonymousID:a', created_at: '2026-10-01T10:00:00Z', trial_active: true, plan: 'trial' },
  { id: 'b@exemple.fr', revenuecat_id: '$RCAnonymousID:b', created_at: '2026-11-01T10:00:00Z', subscription_active: true, plan: 'monthly', onboarding_complete: true },
  { id: 'c@exemple.fr', revenuecat_id: '$RCAnonymousID:c', created_at: '2026-09-01T10:00:00Z', churned_at: '2026-10-01T00:00:00Z', is_test_user: true },
];

test('l’état d’un inscrit se lit en mots', () => {
  assert.deepEqual(inscrits().map((u) => ligneUtilisateur(u).etat), ['essai', 'payant', 'parti']);
});

test('recherche par e-mail, identifiant RevenueCat exact ou prénom, et filtres', () => {
  const lignes = inscrits().map(ligneUtilisateur);
  assert.deepEqual(filtrer(lignes, { q: 'b@' }).map((l) => l.id), ['b@exemple.fr']);
  assert.deepEqual(filtrer(lignes, { q: '$RCAnonymousID:a' }).map((l) => l.id), ['a@exemple.fr']);
  assert.deepEqual(filtrer(lignes, { q: 'ana' }).map((l) => l.id), ['a@exemple.fr']);
  assert.deepEqual(filtrer(lignes, { filtre: 'onboarding' }).map((l) => l.id), ['a@exemple.fr', 'c@exemple.fr']);
  assert.deepEqual(filtrer(lignes, { filtre: 'tests' }).map((l) => l.id), ['c@exemple.fr']);
  assert.deepEqual(filtrer(lignes).map((l) => l.id), ['b@exemple.fr', 'a@exemple.fr', 'c@exemple.fr']);
});

test('corriger un prénom écrit le seul champ first_name et le journal, sans e-mail', async () => {
  const db = baseEnMemoire({ users: inscrits() });
  const s = suivi(db);
  assert.equal(await s.changerPrenom('b@exemple.fr', '  Bruno  '), 'Bruno');
  assert.equal(db.donnees.users.get('b@exemple.fr').first_name, 'Bruno');
  assert.equal(db.donnees.users.get('b@exemple.fr').plan, 'monthly');
  const [ligne] = await db.lister('crm_journal');
  assert.equal(ligne.quoi, 'prénom corrigé');
  assert.ok(!JSON.stringify(ligne).includes('@'));
  await assert.rejects(() => s.changerPrenom('inconnu@exemple.fr', 'X'), /introuvable/);
  assert.throws(() => nettoyerPrenom('a@b'), /interdit/);
  assert.throws(() => nettoyerPrenom('x'.repeat(61)), /60/);
});

test('au premier lancement, les envois sont coupés et à blanc', async () => {
  const db = baseEnMemoire();
  const s = suivi(db);
  assert.deepEqual(await s.reglages(), { envois_coupes: true, a_blanc: true, notif_telephone: true });
  assert.equal(db.donnees.crm_reglages.get('general').envois_coupes, true);
  assert.equal((await s.changerReglage('a_blanc', false)).a_blanc, false);
  await assert.rejects(() => s.changerReglage('autre', true), /inconnu/);
  await assert.rejects(() => s.changerReglage('a_blanc', 'non'), /inconnu/);
});

test('le cache des inscrits se recharge à la demande', async () => {
  const db = baseEnMemoire({ users: inscrits() });
  const s = suivi(db);
  assert.equal((await s.utilisateurs()).length, 3);
  await db.ecrire('users', 'd@exemple.fr', { created_at: '2026-11-20T00:00:00Z' });
  assert.equal((await s.utilisateurs()).length, 3);
  assert.equal((await s.utilisateurs({ frais: true })).length, 4);
});

test('Firestore : valeurs encodées et relues, identifiant tiré du nom', () => {
  const objet = { a: 'x', b: true, c: 3, d: 1.5, e: null, f: ['y'], g: { h: 'z' } };
  assert.deepEqual(decoderChamps(encoderChamps(objet)), objet);
  assert.equal(idDe('projects/p/databases/d/documents/users/a%40exemple.fr'), 'a@exemple.fr');
});

test('le jeton gcloud est gardé 45 minutes', async () => {
  let appels = 0;
  let t = 0;
  const jeton = jetonGcloud({ executer: async () => { appels += 1; return { stdout: `j${appels}\n` }; }, maintenant: () => t });
  assert.equal(await jeton(), 'j1');
  t = 44 * 60 * 1000;
  assert.equal(await jeton(), 'j1');
  t = 46 * 60 * 1000;
  assert.equal(await jeton(), 'j2');
});

test('seul localhost passe, et une écriture doit venir de la page', () => {
  assert.ok(hoteAutorise('localhost:4810', 4810));
  assert.ok(!hoteAutorise('exemple.fr:4810', 4810));
  assert.ok(ecritureAutorisee({ headers: { 'x-crm': '1', origin: 'http://localhost:4810' } }, 4810));
  assert.ok(!ecritureAutorisee({ headers: { origin: 'http://localhost:4810' } }, 4810));
  assert.ok(!ecritureAutorisee({ headers: { 'x-crm': '1', origin: 'https://exemple.fr' } }, 4810));
});

test('le serveur : liste, fiche, prénom, refus d’un autre hôte', async () => {
  const db = baseEnMemoire({ users: inscrits() });
  const serveur = http.createServer(application(suivi(db), { port: 0 }));
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const { port } = serveur.address();
  const app = application(suivi(db), { port });
  serveur.removeAllListeners('request');
  serveur.on('request', app);
  const base = `http://127.0.0.1:${port}`;
  try {
    const liste = await (await fetch(`${base}/api/utilisateurs?q=a@`)).json();
    assert.equal(liste.trouves, 1);
    assert.equal((await fetch(`${base}/api/fiche?id=a%40exemple.fr`)).status, 200);
    const refus = await fetch(`${base}/api/prenom`, { method: 'POST', body: JSON.stringify({ id: 'a@exemple.fr', prenom: 'Z' }) });
    assert.equal(refus.status, 403);
    const ok = await fetch(`${base}/api/prenom`, { method: 'POST', headers: { 'x-crm': '1' }, body: JSON.stringify({ id: 'a@exemple.fr', prenom: 'Anna' }) });
    assert.equal((await ok.json()).prenom, 'Anna');
    const autre = await new Promise((ok2) => http.get({ host: '127.0.0.1', port, path: '/api/reglages', headers: { Host: 'exemple.fr' } }, ok2));
    assert.equal(autre.statusCode, 403);
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/../suivi.mjs`)).status, 404);
  } finally {
    serveur.close();
  }
});

test('désinscrire à la main pose desinscrit sur la fiche, et la porte refuse ensuite', async () => {
  const { porteEnvoi } = await import('../envoi.mjs');
  const db = baseEnMemoire({ users: inscrits(), crm_reglages: [{ id: 'general', envois_coupes: false, a_blanc: true, expediteur: 'x@exemple.fr', repondre_a: 'y@exemple.fr', adresse_test: 'z@exemple.fr' }],
    crm_actions: [{ id: 'libre__a', type: 'libre', user_id: 'a@exemple.fr', statut: 'prete', sujet: 's', corps: 'c' }] });
  const s = suivi(db);
  assert.equal(await s.desinscrit('a@exemple.fr'), false);
  await s.desinscrire('a@exemple.fr');
  assert.equal(await s.desinscrit('a@exemple.fr'), true);
  const porte = porteEnvoi({ db, envoyerResend: async () => ({}), lireRevenueCat: async () => ({}) });
  assert.equal((await porte.envoyerAction('libre__a')).raison, 'désinscrit');
});

test('réglages d’adresses et plafond vérifiés', async () => {
  const s = suivi(baseEnMemoire());
  assert.equal((await s.changerReglage('expediteur', 'Prénom d’Easy Way <bonjour@exemple.fr>')).expediteur, 'Prénom d’Easy Way <bonjour@exemple.fr>');
  await assert.rejects(() => s.changerReglage('repondre_a', 'pas une adresse'), /invalide/);
  await assert.rejects(() => s.changerReglage('plafond_jour', 150), /90/);
  assert.equal((await s.changerReglage('plafond_jour', 50)).plafond_jour, 50);
});

test('les actions du jour : prêtes et reportées échues, Plus tard, Ignorer, texte modifié', async () => {
  const T = new Date('2026-12-02T10:00:00Z');
  const db = baseEnMemoire({ crm_actions: [
    { id: 'a', statut: 'prete', echeance: '2026-12-03T00:00:00Z', sujet: 's', corps: 'c' },
    { id: 'b', statut: 'reportee', reporter_au: '2026-12-01T08:00:00Z' },
    { id: 'c', statut: 'reportee', reporter_au: '2026-12-05T08:00:00Z' },
    { id: 'd', statut: 'envoyee' },
  ] });
  const s = suivi(db, { maintenant: () => T });
  assert.deepEqual((await s.aujourdhui()).map((a) => a.id).sort(), ['a', 'b']);
  await s.traiterAction('a', 'reporter');
  assert.equal(db.donnees.crm_actions.get('a').statut, 'reportee');
  assert.equal(new Date(db.donnees.crm_actions.get('a').reporter_au).toISOString(), '2026-12-03T08:00:00.000Z');
  await s.traiterAction('b', 'ignorer');
  assert.deepEqual((await s.aujourdhui()).map((a) => a.id), []);
  await assert.rejects(() => s.traiterAction('d', 'ignorer'), /déjà traitée/);
  await db.ecrire('crm_actions', 'a', { statut: 'prete' });
  assert.equal((await s.modifierTexte('a', 'Nouveau', 'Texte')).modifie_a_la_main, true);
  await assert.rejects(() => s.modifierTexte('a', '', 'x'), /requis/);
});

test('le fil réunit la page, Gmail et WhatsApp ; « A répondu » arrête les relances de campagne', async () => {
  const { cleUtilisateur } = await import('../envoi.mjs');
  const db = baseEnMemoire({
    users: [{ id: 'ana@exemple.fr', revenuecat_id: 'rcA' }],
    crm_actions: [
      { id: 'essai_j2__x', type: 'essai_j2', user_id: 'ana@exemple.fr', statut: 'a_blanc', sujet: 'Votre essai', corps: 'Bonjour', maj_le: '2026-12-01T10:00:00Z' },
      { id: 'campagne_relance__x', type: 'campagne_relance', user_id: 'ana@exemple.fr', statut: 'prete', campagne_id: 'c1' },
    ],
    crm_messages: [{ id: 'g1', user_id: 'ana@exemple.fr', sens: 'recu', source: 'gmail', le: '2026-12-02T09:00:00Z', sujet: 'Re', extrait: 'Merci' },
      { id: 'g2', user_id: 'autre@exemple.fr', sens: 'recu', source: 'gmail', le: '2026-12-02T09:00:00Z' }],
    crm_membres: [{ id: 'c1__k', campagne_id: 'c1', user_id: 'ana@exemple.fr', statut: 'envoye' }],
  });
  const s = suivi(db, { maintenant: () => new Date('2026-12-03T10:00:00Z') });
  assert.deepEqual((await s.fil('ana@exemple.fr')).map((l) => l.source), ['gmail', 'page, à blanc']);
  await assert.rejects(s.noterMessage('ana@exemple.fr', { sens: 'recu', source: 'whatsapp', extrait: '  ' }), /Coller/);
  await s.noterMessage('ana@exemple.fr', { sens: 'recu', source: 'whatsapp', extrait: 'Oui ça marche' });
  assert.equal((await s.fil('ana@exemple.fr'))[0].source, 'whatsapp');
  assert.ok(db.donnees.crm_fiches.get(cleUtilisateur('ana@exemple.fr')).a_repondu_le);
  assert.equal(db.donnees.crm_membres.get('c1__k').statut, 'repondu');
  assert.equal(db.donnees.crm_actions.get('campagne_relance__x').statut, 'ignoree');
});

test('les réponses reçues non lues remontent ; « Lu » les retire ; une réponse WhatsApp notée est déjà lue (audit du 22/11)', async () => {
  const db = baseEnMemoire({ users: [{ id: 'a@exemple.fr' }], crm_messages: [
    { id: 'g1', user_id: 'a@exemple.fr', sens: 'recu', source: 'gmail', le: '2026-11-22T09:00:00Z', extrait: 'Merci' },
    { id: 'g2', user_id: 'a@exemple.fr', sens: 'envoye', source: 'gmail', le: '2026-11-21T09:00:00Z' }] });
  const s = suivi(db);
  assert.deepEqual((await s.reponses()).map((m) => m.id), ['g1']);
  await s.reponseLue('g1');
  assert.equal((await s.reponses()).length, 0);
  await s.noterMessage('a@exemple.fr', { sens: 'recu', source: 'whatsapp', extrait: 'ok' });
  assert.equal((await s.reponses()).length, 0);
});

test('la notification de 9 h dit les réponses et ce qui ne va pas, sans guillemet', async () => {
  const { texteNotification } = await import('../serveur.mjs');
  assert.equal(texteNotification(0), 'Aucune action ce matin.');
  assert.equal(texteNotification(2, 1, 'la passe a échoué : "x"'), '2 actions restent à faire. 1 réponse à lire. Attention : la passe a échoué : x.');
});

test('le numéro WhatsApp se règle au format international, et se retire', async () => {
  const s = suivi(baseEnMemoire());
  assert.equal((await s.changerReglage('whatsapp', '+33 6 00 00 00 00')).whatsapp, '33600000000');
  assert.equal((await s.changerReglage('whatsapp', '0033 600000000')).whatsapp, '33600000000');
  await assert.rejects(() => s.changerReglage('whatsapp', '06 00'), /format international/);
  assert.equal((await s.changerReglage('whatsapp', '')).whatsapp, null);
});
