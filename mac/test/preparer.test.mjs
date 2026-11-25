import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { bienvenues, candidats, preparer } from '../preparer.mjs';
import { apercuBienvenue, rendre } from '../modeles.mjs';
import { cleUtilisateur } from '../envoi.mjs';

const T = new Date('2026-12-02T10:00:00Z');
const h = (n) => T.getTime() + n * 3600000;
const iso = (n) => new Date(h(n)).toISOString();
const inscrits = [
  { id: 'ana@exemple.fr', revenuecat_id: 'rcA', locale: 'fr' },
  { id: 'bob@exemple.com', revenuecat_id: 'rcB', locale: 'en' },
  { id: 'cla@exemple.fr', revenuecat_id: 'rcC', locale: 'fr' },
];
const essai = (rc, finH, tx, plus = {}) => ({ nom: 'rc_trial_started_event', temps: h(-120), ids: [rc], transaction: tx, fin: iso(finH), type: 'TRIAL', store: 'APP_STORE', ...plus });

test('un essai qui finit dans 24 à 60 h et non annulé donne un rappel ; les autres non', () => {
  const faits = [
    essai('rcA', 40, 'T1'),
    essai('rcB', 80, 'T2'),
    essai('rcC', 30, 'T3'), { nom: 'rc_trial_cancelled_event', temps: h(-5), ids: ['rcC'], transaction: 'T3' },
    essai('inconnu', 40, 'T4'),
  ];
  assert.deepEqual(candidats(faits, inscrits, T).filter((c) => c.type === 'essai_j2').map((c) => c.user.id), ['ana@exemple.fr']);
});

test('une résiliation de payant donne un e-mail 24 h après, jusqu’à 7 jours, pas un défaut de carte ni une reprise', () => {
  const faits = [
    { nom: 'rc_cancellation_event', temps: h(-23), ids: ['rcB'], transaction: 'P0', type: 'NORMAL', raison: 'UNSUBSCRIBE' },
    { nom: 'rc_cancellation_event', temps: h(-24), ids: ['rcA'], transaction: 'P1', type: 'NORMAL', raison: 'UNSUBSCRIBE' },
    { nom: 'rc_cancellation_event', temps: h(-24), ids: ['rcB'], transaction: 'P2', type: 'NORMAL', raison: 'BILLING_ERROR' },
    { nom: 'rc_cancellation_event', temps: h(-48), ids: ['rcC'], transaction: 'P3', type: 'NORMAL', raison: 'UNSUBSCRIBE' },
    { nom: 'rc_uncancellation_event', temps: h(-10), ids: ['rcC'], transaction: 'P3' },
    { nom: 'rc_cancellation_event', temps: h(-24 * 9), ids: ['rcA'], transaction: 'P9', type: 'NORMAL', raison: 'UNSUBSCRIBE' },
  ];
  assert.deepEqual(candidats(faits, inscrits, T).map((c) => [c.type, c.user.id]), [['resiliation', 'ana@exemple.fr']]);
});

test('la préparation crée chaque action une seule fois, dans la langue et la variante d’usage', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'Prénom, créateur d’Easy Way' }] });
  const faits = [essai('rcA', 40, 'T1'), essai('rcB', 50, 'T2', { store: 'PLAY_STORE' })];
  const tournees = (rc) => (rc === 'rcA' ? 3 : 0);
  assert.deepEqual(await preparer({ db, faits, tournees, maintenant: T }), { creees: 2, expirees: 0, sans_inscrit: [] });
  assert.deepEqual(await preparer({ db, faits, tournees, maintenant: T }), { creees: 0, expirees: 0, sans_inscrit: [] });
  const actions = await db.lister('crm_actions');
  const ana = actions.find((a) => a.user_id === 'ana@exemple.fr');
  const bob = actions.find((a) => a.user_id === 'bob@exemple.com');
  assert.equal(ana.variante, 'usage');
  assert.equal(ana.sujet, 'Votre essai Easy Way se termine vendredi');
  assert.match(ana.corps, /^Bonjour,\n\nJ'espère qu'Easy Way vous plaît\. Votre essai se termine vendredi, et l'abonnement démarre ce jour-là\./);
  assert.match(ana.corps, /un court message suffit\.\n\nPrénom, créateur d’Easy Way$/);
  assert.equal(bob.variante, 'peu_usage');
  assert.equal(bob.sujet, 'Your Easy Way trial ends on Friday');
  // Le rappel ne dit rien de l'usage ni du chemin pour arrêter (fondateur, 25/11) : rien à vérifier sur ses tournées.
  for (const a of [ana, bob]) {
    assert.doesNotMatch(a.corps, /tournée|route|Réglages|Settings|Google Play/);
    assert.equal(a.a_verifier, undefined);
  }
  assert.ok(!actions.some((a) => /\{\{/.test(a.corps)));
});

test('sans signature réglée, rien n’est préparé ; une action dont l’échéance passe expire', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general' }], crm_actions: [{ id: 'x', statut: 'prete', echeance: iso(-1) }] });
  assert.equal((await preparer({ db, faits: [essai('rcA', 40, 'T1')], tournees: () => 0, maintenant: T })).raison, 'signature à régler');
  await db.ecrire('crm_reglages', 'general', { signature: 'S' });
  assert.deepEqual(await preparer({ db, faits: [], tournees: () => 0, maintenant: T }), { creees: 0, expirees: 1, sans_inscrit: [] });
  assert.equal(db.donnees.crm_actions.get('x').statut, 'expiree');
});

test('un modèle à trou ne se rend pas', () => {
  assert.throws(() => rendre('resiliation', 'fr', {}), /signature/);
  assert.throws(() => rendre('inconnu', 'fr', {}), /inconnu/);
});

test('une annulation d’essai des 7 derniers jours donne un e-mail, sauf si la personne a payé ensuite', () => {
  const faits = [
    { nom: 'rc_trial_cancelled_event', temps: h(-24), ids: ['rcA'], transaction: 'E1', type: 'TRIAL' },
    { nom: 'rc_trial_cancelled_event', temps: h(-30), ids: ['rcB'], transaction: 'E2', type: 'TRIAL' },
    { nom: 'rc_initial_purchase_event', temps: h(-5), ids: ['rcB'], transaction: 'E9', type: 'NORMAL' },
    { nom: 'rc_trial_cancelled_event', temps: h(-24 * 9), ids: ['rcC'], transaction: 'E3', type: 'TRIAL' },
  ];
  assert.deepEqual(candidats(faits, inscrits, T).map((c) => [c.type, c.user.id]), [['essai_annule', 'ana@exemple.fr']]);
});

test('l’annulation d’essai s’écrit depuis le dossier, une seule fois, et sans dossier reste un e-mail court', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'Prénom' }] });
  const faits = [{ nom: 'rc_trial_cancelled_event', temps: h(-24), ids: ['rcA'], transaction: 'E1', type: 'TRIAL' },
    { nom: 'rc_trial_cancelled_event', temps: h(-20), ids: ['rcB'], transaction: 'E2', type: 'TRIAL' }];
  const dossiers = { rcA: { pays: 'FR', questionnaire: { raison: 'missingFeatures', texte: '', le: '2026-12-01' },
    usage: { tournees: 0, zones: [{ zone: 'Carte', n: 4 }], zones_jamais: [], signaux: [], jours_actifs: 3, semaines: Array(12).fill(0),
      premier_jour: '2026-11-28', dernier_jour: '2026-12-01' }, abonnement: { paiements: 0 }, calcule_le: '2026-12-02' } };
  await preparer({ db, faits, tournees: () => 0, maintenant: T, dossierPour: (rc) => dossiers[rc] ?? null });
  await preparer({ db, faits, tournees: () => 0, maintenant: T, dossierPour: (rc) => dossiers[rc] ?? null });
  const actions = (await db.lister('crm_actions')).filter((a) => a.type === 'essai_annule');
  assert.equal(actions.length, 2);
  const a = actions.find((x) => x.user_id === 'ana@exemple.fr');
  assert.match(a.sujet, /essai/);
  assert.match(a.corps, /annulé votre essai/);
  assert.match(a.corps, /rien ne vous sera facturé/);
  assert.match(a.corps, /Quelle fonction vous a le plus manqué \?/);
  assert.doesNotMatch(a.corps, /abonnement/);
  assert.equal(new Date(a.echeance).getTime(), h(-24) + 7 * 24 * 3600000);
  const b = actions.find((x) => x.user_id === 'bob@exemple.com');
  assert.match(b.corps, /^Hello,/);
  // Sans réponse au questionnaire : le texte court validé le 22/11 (EW-54).
  assert.equal(b.sujet, 'Your Easy Way trial');
  assert.match(b.corps, /What didn't work for you\?/);
  assert.equal(b.traduction_fr.sujet, 'Votre essai Easy Way');
  assert.ok(b.corps.split(/\s+/).length <= 40);
  assert.equal((b.corps.match(/\?/g) ?? []).length, 1);
});

test('audit du 22/11 : pas de résiliation pour un remboursement ; une personne qui revient puis repart n’a pas de second e-mail ; un usage inconnu ne bloque plus le rappel', async () => {
  const faits = [
    { nom: 'rc_cancellation_event', temps: h(-24), ids: ['rcA'], transaction: 'P1', type: 'NORMAL', raison: 'CUSTOMER_SUPPORT' },
    { nom: 'rc_cancellation_event', temps: h(-24), ids: ['rcB'], transaction: 'P2', type: 'NORMAL', raison: 'DEVELOPER_INITIATED' },
    { nom: 'rc_cancellation_event', temps: h(-24), ids: ['rcC'], transaction: 'P3', type: 'NORMAL', raison: 'UNSUBSCRIBE' },
  ];
  assert.deepEqual(candidats(faits, inscrits, T).map((c) => c.user.id), ['cla@exemple.fr']);

  // Une seule résiliation par personne (Q-EW-63) : l'ancienne (avant le 22/11) compte, et un départ plus récent n'en refait pas.
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'S' }],
    crm_actions: [{ id: `resiliation__${(await import('../envoi.mjs')).cleUtilisateur('cla@exemple.fr')}`, type: 'resiliation', statut: 'envoyee', cree_le: new Date(h(-20)) }] });
  await preparer({ db, faits, tournees: () => 0, maintenant: T });
  assert.equal((await db.lister('crm_actions')).length, 1);
  const retour = [{ ...faits[2], temps: h(-30), transaction: 'P4' }];
  await preparer({ db, faits: retour, tournees: () => 0, maintenant: T });
  assert.equal((await db.lister('crm_actions')).length, 1);

  // Rappel de fin d'essai sans données Mixpanel : depuis le 25/11 le texte ne dit rien de l'usage, il part sans vérification.
  const db2 = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'S' }] });
  await preparer({ db: db2, faits: [essai('rcA', 40, 'T1')], tournees: () => null, maintenant: T });
  const [a] = await db2.lister('crm_actions');
  assert.equal(a.a_verifier, undefined);
  assert.equal(a.variante, 'peu_usage');
});

test('une création ratée pour une autre raison qu’un doublon est comptée, pas tue', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'S' }] });
  db.creer = async () => { throw new Error('Firestore 503'); };
  const r = await preparer({ db, faits: [essai('rcA', 40, 'T1')], tournees: () => 1, maintenant: T });
  assert.equal(r.erreurs, 1);
});

test('une annulation sur la fiche Firebase devient un fait, d’après RevenueCat : essai, abonnement, carte refusée (EW-55)', async () => {
  const { faitsDesFiches } = await import('../preparer.mjs');
  const iso2 = (n) => new Date(h(n)).toISOString();
  const users = [
    { id: 'ana@exemple.fr', revenuecat_id: 'rcA', churned_at: iso2(-2) },
    { id: 'bob@exemple.com', revenuecat_id: 'rcB', churned_at: iso2(-3) },
    { id: 'cla@exemple.fr', revenuecat_id: 'rcC', churned_at: iso2(-1) },
    { id: 'vieux@exemple.fr', revenuecat_id: 'rcV', churned_at: iso2(-24 * 9) },
    { id: 'sans@exemple.fr', churned_at: iso2(-1) },
  ];
  const abonnes = {
    rcA: { subscriber: { subscriptions: { p: { period_type: 'trial', unsubscribe_detected_at: iso2(-2), expires_date: iso2(100), store: 'app_store' } } } },
    rcB: { subscriber: { subscriptions: { p: { period_type: 'normal', unsubscribe_detected_at: iso2(-3), expires_date: iso2(200), store: 'play_store' } } } },
    rcC: { subscriber: { subscriptions: { p: { period_type: 'normal', unsubscribe_detected_at: iso2(-1), billing_issues_detected_at: iso2(-1), expires_date: iso2(5) } } } },
  };
  const lus = [];
  const faits = await faitsDesFiches(users, async (rc) => { lus.push(rc); return abonnes[rc]; }, T);
  assert.deepEqual(lus.sort(), ['rcA', 'rcB', 'rcC'], 'RevenueCat relu seulement pour les annulations récentes');
  assert.deepEqual(faits.map((f) => [f.nom, f.ids[0], f.type, f.raison]), [
    ['rc_trial_cancelled_event', 'rcA', 'TRIAL', 'UNSUBSCRIBE'],
    ['rc_cancellation_event', 'rcB', 'NORMAL', 'UNSUBSCRIBE'],
  ]);
  // La résiliation attend 24 h ; l'essai annulé, non.
  assert.deepEqual(candidats(faits, inscrits, T).map((x) => [x.type, x.user.id]), [['essai_annule', 'ana@exemple.fr']]);
  const c = candidats(faits, inscrits, new Date(h(22)));
  assert.deepEqual(c.map((x) => [x.type, x.user.id]).sort(), [['essai_annule', 'ana@exemple.fr'], ['resiliation', 'bob@exemple.com']]);
  // RevenueCat qui ne répond pas : rien, sans casser.
  assert.deepEqual(await faitsDesFiches(users.slice(0, 1), async () => { throw new Error('RevenueCat 500'); }, T), []);
});

test('le même départ vu par la fiche puis par Mixpanel le lendemain ne fait qu’une action (EW-55)', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'S' }] });
  const parFiche = [{ nom: 'rc_trial_cancelled_event', temps: h(-2), ids: ['rcA'], transaction: 'fiche-rcA', type: 'TRIAL', raison: 'UNSUBSCRIBE' }];
  await preparer({ db, faits: parFiche, tournees: () => 0, maintenant: T });
  const parMixpanel = [{ nom: 'rc_trial_cancelled_event', temps: h(-2.2), ids: ['rcA'], transaction: 'T-vrai', type: 'TRIAL' }];
  await preparer({ db, faits: parMixpanel, tournees: () => 0, maintenant: new Date(h(20)) });
  assert.equal((await db.lister('crm_actions')).filter((a) => a.type === 'essai_annule').length, 1);
});

test('Q-EW-63 : l’e-mail de départ, 24 h après, une fois par personne, seulement un arrêt volontaire', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'S' }] });
  const arret = { nom: 'rc_cancellation_event', temps: h(-2), ids: ['rcA'], transaction: 'P1', type: 'NORMAL', raison: 'UNSUBSCRIBE' };
  const carte = { nom: 'rc_cancellation_event', temps: h(-30), ids: ['rcB'], transaction: 'P2', type: 'NORMAL', raison: 'BILLING_ERROR' };
  // 2 h après l'arrêt : rien encore ; la carte refusée, jamais.
  await preparer({ db, faits: [arret, carte], tournees: () => 0, maintenant: T });
  assert.equal((await db.lister('crm_actions')).length, 0);
  // 24 h après : l'action est prête, son échéance reste à 7 jours de l'arrêt.
  await preparer({ db, faits: [arret, carte], tournees: () => 0, maintenant: new Date(h(22)) });
  const [a] = await db.lister('crm_actions');
  assert.equal(a.type, 'resiliation');
  assert.equal(a.user_id, 'ana@exemple.fr');
  assert.equal(new Date(a.echeance).getTime(), h(-2) + 7 * 24 * 3600000);
  // Elle revient, repart un mois plus tard : pas de second e-mail, même si le premier a expiré.
  await db.ecrire('crm_actions', a.id, { statut: 'expiree' });
  const second = { ...arret, temps: h(24 * 30), transaction: 'P3' };
  await preparer({ db, faits: [second], tournees: () => 0, maintenant: new Date(h(24 * 31)) });
  assert.equal((await db.lister('crm_actions')).filter((x) => x.type === 'resiliation').length, 1);
});

test('un compte de test (le fondateur) ne donne aucune action', () => {
  const avecTest = [...inscrits, { id: 'moi@exemple.fr', revenuecat_id: 'rcM', locale: 'fr', is_test_user: true }];
  const faits = [
    essai('rcM', 40, 'M1'),
    { nom: 'rc_cancellation_event', temps: h(-24), ids: ['rcM'], transaction: 'M2', type: 'NORMAL', raison: 'UNSUBSCRIBE' },
    { nom: 'rc_trial_cancelled_event', temps: h(-5), ids: ['rcM'], transaction: 'M3' },
  ];
  assert.deepEqual(candidats(faits, avecTest, T), []);
});

test('la bienvenue : ni compte de test, ni désinscrit, ni adresse en rebond ; un dossier illisible ne casse pas la passe (INT-EW-9)', async () => {
  const nouveaux = [
    { id: 'ana@exemple.fr', locale: 'fr', created_at: iso(-2), revenuecat_id: 'rcA' },
    { id: 'moi@exemple.fr', locale: 'fr', created_at: iso(-2), is_test_user: true },
    { id: 'parti@exemple.fr', locale: 'fr', created_at: iso(-2) },
    { id: 'rebond@exemple.fr', locale: 'fr', created_at: iso(-2) },
  ];
  assert.deepEqual(bienvenues(nouveaux, T).map((u) => u.id), ['ana@exemple.fr', 'parti@exemple.fr', 'rebond@exemple.fr']);
  const db = baseEnMemoire({ users: nouveaux, crm_reglages: [{ id: 'general', signature: 'Prénom', bienvenue: true }],
    crm_fiches: [{ id: cleUtilisateur('parti@exemple.fr'), desinscrit: true }, { id: cleUtilisateur('rebond@exemple.fr'), adresse_invalide: true }] });
  const r = await preparer({ db, faits: [], tournees: () => 0, maintenant: T, dossierPour: () => { throw new Error('dossier illisible'); } });
  assert.equal(r.creees, 1);
  assert.deepEqual((await db.lister('crm_actions')).map((a) => a.user_id), ['ana@exemple.fr']);
});

test('la bienvenue : une par adresse donnée dans les 72 h, préparée même en essai (INT-EW-9, INT-EW-94)', async () => {
  const nouveaux = [
    { id: 'ana@exemple.fr', locale: 'fr', created_at: iso(-2) },
    { id: 'bob@exemple.com', locale: 'de', created_at: iso(-71) },
    { id: 'cla@exemple.fr', locale: 'fr', created_at: iso(-73) },
    { id: '$RCAnonymousID:sansadresse', locale: 'fr', created_at: iso(-2) },
  ];
  assert.deepEqual(bienvenues(nouveaux, T).map((u) => u.id), ['ana@exemple.fr', 'bob@exemple.com']);
  const signature = 'Prénom, créateur d’Easy Way';
  const enEssai = baseEnMemoire({ users: nouveaux, crm_reglages: [{ id: 'general', signature, en_essai: ['bienvenue'] }] });
  assert.equal((await preparer({ db: enEssai, faits: [], tournees: () => 0, maintenant: T })).creees, 2);
  const db = baseEnMemoire({ users: nouveaux, crm_reglages: [{ id: 'general', signature, bienvenue: true }] });
  assert.equal((await preparer({ db, faits: [], tournees: () => 0, maintenant: T })).creees, 2);
  assert.equal((await preparer({ db, faits: [], tournees: () => 0, maintenant: T })).creees, 0);
  const actions = await db.lister('crm_actions');
  const fr = actions.find((a) => a.user_id === 'ana@exemple.fr');
  assert.equal(fr.type, 'bienvenue');
  assert.equal(fr.statut, 'prete');
  assert.equal(fr.sujet, 'Bienvenue sur Easy Way');
  assert.match(fr.corps, /Une seule question/);
  assert.match(fr.corps, /Prénom, créateur/);
  assert.doesNotMatch(fr.corps, /STOP/);
  const de = actions.find((a) => a.user_id === 'bob@exemple.com');
  assert.equal(de.langue, 'de');
  assert.equal(de.traduction_fr.sujet, 'Bienvenue sur Easy Way');
  assert.equal(new Date(de.echeance).getTime(), h(1));
});

test('la carte des Réglages montre le texte français de la bienvenue, avec la signature ou sa place', () => {
  const avec = apercuBienvenue('Prénom, créateur d’Easy Way');
  assert.equal(avec.sujet, 'Bienvenue sur Easy Way');
  assert.match(avec.corps, /Une seule question/);
  assert.match(avec.corps, /Prénom, créateur/);
  assert.match(apercuBienvenue('').corps, /ta signature/);
});

test('bilan du 25/11 : un essai arrêté par une carte refusée, un remboursement ou le développeur ne reçoit pas « vous avez annulé »', () => {
  const faits = ['BILLING_ERROR', 'CUSTOMER_SUPPORT', 'DEVELOPER_INITIATED', 'UNSUBSCRIBE'].map((raison, i) =>
    ({ nom: 'rc_trial_cancelled_event', temps: h(-24), ids: [['rcA', 'rcB', 'rcA', 'rcC'][i]], transaction: `E${i}`, type: 'TRIAL', raison }));
  assert.deepEqual(candidats(faits, inscrits, T).map((c) => [c.type, c.user.id]), [['essai_annule', 'cla@exemple.fr']]);
});

test('bilan du 25/11 : le rappel se prépare au moins 26 h avant la fin et expire 24 h avant', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general', signature: 'S' }] });
  assert.equal((await preparer({ db, faits: [essai('rcA', 25, 'T1')], tournees: () => 0, maintenant: T })).creees, 0);
  await preparer({ db, faits: [essai('rcA', 40, 'T2')], tournees: () => 0, maintenant: T });
  const [a] = await db.lister('crm_actions');
  assert.equal(new Date(a.echeance).getTime(), h(40) - 24 * 3600000);
});

test('carte du 25/11 : un essai annulé puis repris garde son rappel de fin d’essai ; annulé sans reprise, non', () => {
  const faits = [
    essai('rcA', 40, 'T1'), { nom: 'rc_trial_cancelled_event', temps: h(-90), ids: ['rcA'], transaction: 'T1', raison: 'UNSUBSCRIBE' },
    { nom: 'rc_uncancellation_event', temps: h(-80), ids: ['rcA'], transaction: 'T1' },
    essai('rcB', 40, 'T2'), { nom: 'rc_trial_cancelled_event', temps: h(-90), ids: ['rcB'], transaction: 'T2', raison: 'UNSUBSCRIBE' },
    { nom: 'rc_uncancellation_event', temps: h(-80), ids: ['rcB'], transaction: 'T2' },
    { nom: 'rc_trial_cancelled_event', temps: h(-70), ids: ['rcB'], transaction: 'T2', raison: 'UNSUBSCRIBE' },
  ];
  assert.deepEqual(candidats(faits, inscrits, T).filter((c) => c.type === 'essai_j2').map((c) => c.user.id), ['ana@exemple.fr']);
});
