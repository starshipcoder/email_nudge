import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { cleUtilisateur, porteEnvoi } from '../envoi.mjs';
import { campagnes } from '../campagnes.mjs';

const T0 = new Date('2026-12-02T10:00:00Z');
const jours = (n) => new Date(T0.getTime() + n * 86400000);
const REGLAGES = { id: 'general', envois_coupes: false, a_blanc: false, expediteur: 'P <p@exemple.fr>', repondre_a: 'moi@exemple.fr', adresse_test: 'test@exemple.fr', signature: 'Prénom' };
const recent = jours(-2).toISOString();
const USERS = [
  { id: 'a@exemple.fr', is_test_user: true, locale: 'fr', trial_active: true, last_action_at: recent },
  { id: 'b@exemple.fr', is_test_user: true, locale: 'fr', trial_active: true, last_action_at: recent },
  { id: 'c@exemple.fr', is_test_user: true, locale: 'fr-FR', subscription_active: true, plan: 'annual', last_action_at: recent },
  { id: 'd@exemple.fr', locale: 'fr', subscription_active: true, plan: 'annual' },
  { id: 'e@exemple.com', locale: 'en', trial_active: true },
  { id: 'f@exemple.fr', locale: 'fr', trial_active: true },
];
const BRUT = { nom: 'TEST bêta', filtre: 'actifs_30j', langue: 'fr', sujet: 'Tester ?', corps: 'Bonjour,\n\nRépondez oui.\n\n{{signature}}',
  relance_apres_jours: 3, relance_sujet: 'Re : Tester ?', relance_corps: 'Une seule relance.\n\n{{signature}}' };

function monter({ reglages = REGLAGES, fiches = [] } = {}) {
  let t = T0;
  const db = baseEnMemoire({ users: USERS, crm_reglages: [reglages], crm_fiches: fiches });
  const envoyes = [];
  const maintenant = () => t;
  const porte = porteEnvoi({ db, maintenant, lireRevenueCat: async () => ({}), envoyerResend: async (m) => { envoyes.push(m); return { id: 'r' }; } });
  const c = campagnes(db, { porte, maintenant });
  return { db, c, envoyes, avancer: (n) => { t = new Date(t.getTime() + n * 86400000); } };
}

test('une campagne de test de 3 personnes : envoyée, une répond, seules les deux autres ont la relance au jour prévu', async () => {
  const { db, c, avancer } = monter();
  const id = await c.creer(BRUT);
  assert.equal((await c.apercu(id)).membres, 3);
  assert.deepEqual(await c.preparer(id), { membres: 3 });
  const envoi = await c.envoyer(id);
  assert.deepEqual(envoi, { envoyes: 3, bloques: 0, restants: 0 });
  assert.equal((await db.lister('crm_envois')).filter((e) => e.statut === 'envoye').length, 3);
  await c.repondu(id, 'b@exemple.fr');

  avancer(2);
  assert.equal(await c.relances(), 0);
  avancer(1);
  assert.equal(await c.relances(), 2);
  assert.equal(await c.relances(), 0);
  const relances = (await db.lister('crm_actions')).filter((a) => a.type === 'campagne_relance');
  assert.deepEqual(relances.map((a) => a.user_id).sort(), ['a@exemple.fr', 'c@exemple.fr']);
  assert.match(relances[0].corps, /Une seule relance\.\n\nPrénom$/);
  const vue = await c.une(id);
  assert.deepEqual(Object.fromEntries(['envoye', 'repondu'].map((s) => [s, vue.membres.filter((m) => m.statut === s).length])), { envoye: 2, repondu: 1 });
});

test('les relances arrivent dans Aujourd’hui et partent par la porte ; le membre passe en relancé', async () => {
  const { db, c, avancer } = monter();
  const id = await c.creer(BRUT);
  await c.preparer(id);
  await c.envoyer(id);
  avancer(3);
  await c.relances();
  const r = (await db.lister('crm_actions')).find((a) => a.type === 'campagne_relance' && a.user_id === 'a@exemple.fr');
  assert.equal((await c.envoyerUne(r.id)).statut, 'envoye');
  assert.equal((await c.une(id)).membres.find((m) => m.user_id === 'a@exemple.fr').statut, 'relance');
});

test('une relance ne part pas à qui a répondu entre-temps', async () => {
  const { db, c, avancer } = monter();
  const id = await c.creer(BRUT);
  await c.preparer(id);
  await c.envoyer(id);
  avancer(3);
  await c.relances();
  await c.repondu(id, 'a@exemple.fr');
  const r = (await db.lister('crm_actions')).find((a) => a.type === 'campagne_relance' && a.user_id === 'a@exemple.fr');
  assert.equal(r.statut, 'ignoree');
  await db.ecrire('crm_actions', r.id, { statut: 'prete' });
  assert.equal((await c.envoyerUne(r.id)).raison, 'a répondu');
});

test('hors TEST : jamais les tests ni les désinscrits, la langue choisie, le filtre', async () => {
  const { c } = monter({ fiches: [{ id: cleUtilisateur('f@exemple.fr'), desinscrit: true }] });
  const essais = await c.creer({ ...BRUT, nom: 'Bêta', filtre: 'essais' });
  assert.deepEqual((await c.apercu(essais)).ids, []);
  const en = await c.creer({ ...BRUT, nom: 'Beta', filtre: 'essais', langue: 'en' });
  assert.deepEqual((await c.apercu(en)).ids, ['e@exemple.com']);
  const payants = await c.creer({ ...BRUT, nom: 'Payants', filtre: 'payants' });
  assert.deepEqual((await c.apercu(payants)).ids, ['d@exemple.fr']);
});

test('le plafond du jour laisse des restantes, qui partent au prochain envoi', async () => {
  const { c, avancer } = monter({ reglages: { ...REGLAGES, plafond_jour: 2 } });
  const id = await c.creer(BRUT);
  await c.preparer(id);
  assert.deepEqual(await c.envoyer(id), { envoyes: 2, bloques: 0, restants: 1 });
  avancer(1);
  assert.deepEqual(await c.envoyer(id), { envoyes: 1, bloques: 0, restants: 0 });
});

test('coupe-circuit : rien ne part, tout reste à envoyer', async () => {
  const { c, envoyes } = monter({ reglages: { ...REGLAGES, envois_coupes: true } });
  const id = await c.creer(BRUT);
  await c.preparer(id);
  assert.deepEqual(await c.envoyer(id), { envoyes: 0, bloques: 0, restants: 3 });
  assert.equal(envoyes.length, 0);
});

test('une campagne mal remplie est refusée ; préparée deux fois, rien ne double', async () => {
  const { c, db } = monter();
  await assert.rejects(c.creer({ ...BRUT, filtre: 'liste_achetee' }), /filtre/);
  await assert.rejects(c.creer({ ...BRUT, relance_apres_jours: 2 }), /relance/);
  await assert.rejects(c.creer({ ...BRUT, corps: 'Bonjour {{prenom}}' }), /prenom/);
  const id = await c.creer(BRUT);
  await c.preparer(id);
  await assert.rejects(c.preparer(id), /brouillon/);
  assert.equal((await db.lister('crm_actions')).length, 3);
});

test('sans relance prévue, aucune relance', async () => {
  const { c, avancer } = monter();
  const id = await c.creer({ ...BRUT, relance_apres_jours: null, relance_sujet: '', relance_corps: '' });
  await c.preparer(id);
  await c.envoyer(id);
  avancer(10);
  assert.equal(await c.relances(), 0);
});

test('une réponse arrivée par Gmail après l’envoi arrête la relance', async () => {
  const { db, c, avancer } = monter();
  const id = await c.creer(BRUT);
  await c.preparer(id);
  await c.envoyer(id);
  avancer(1);
  await db.ecrire('crm_fiches', cleUtilisateur('a@exemple.fr'), { a_repondu_le: jours(1) });
  avancer(2);
  await c.relances();
  const r = (await db.lister('crm_actions')).find((a) => a.type === 'campagne_relance' && a.user_id === 'a@exemple.fr');
  assert.equal((await c.envoyerUne(r.id)).raison, 'a répondu');
});

test('une campagne envoyée à blanc ne fait aucune relance, et repart pour de vrai ensuite (audit du 22/11)', async () => {
  const { db, c, envoyes, avancer } = monter({ reglages: { ...REGLAGES, a_blanc: true } });
  const id = await c.creer(BRUT);
  await c.preparer(id);
  await c.envoyer(id);
  assert.equal(envoyes.length, 0);
  assert.ok((await c.une(id)).membres.every((m) => m.statut === 'a_envoyer'));
  avancer(5);
  assert.equal(await c.relances(), 0, 'pas de relance après un envoi à blanc');
  await db.ecrire('crm_reglages', 'general', { a_blanc: false });
  assert.equal((await c.envoyer(id)).envoyes, 3);
  assert.equal(envoyes.length, 3);
});

test('une campagne aux essais n’atteint pas qui a payé depuis la préparation', async () => {
  let t = T0;
  const db = baseEnMemoire({ users: USERS.map((u) => ({ ...u, revenuecat_id: `rc_${u.id}` })), crm_reglages: [REGLAGES] });
  const envoyes = [];
  const paye = { subscriber: { subscriptions: { p: { period_type: 'normal', expires_date: jours(20).toISOString() } } } };
  const essai = { subscriber: { subscriptions: { p: { period_type: 'trial', expires_date: jours(2).toISOString() } } } };
  const porte = porteEnvoi({ db, maintenant: () => t, lireRevenueCat: async (rc) => (rc === 'rc_a@exemple.fr' ? paye : essai),
    envoyerResend: async (m) => { envoyes.push(m); return { id: 'r' }; } });
  const c = campagnes(db, { porte, maintenant: () => t });
  const id = await c.creer({ ...BRUT, filtre: 'essais' });
  await c.preparer(id);
  const r = await c.envoyer(id);
  assert.equal(r.envoyes, 1);
  const a = (await db.lister('crm_actions')).find((x) => x.user_id === 'a@exemple.fr');
  assert.equal(a.raison, 'plus en essai');
});

test('une préparation coupée en route se reprend sans doubler', async () => {
  const { db, c } = monter();
  const id = await c.creer(BRUT);
  await db.creer('crm_membres', `${id}__${cleUtilisateur('a@exemple.fr')}`, { campagne_id: id, user_id: 'a@exemple.fr', statut: 'a_envoyer' });
  await db.ecrire('crm_campagnes', id, { statut: 'en_preparation' });
  assert.deepEqual(await c.preparer(id), { membres: 3 });
  assert.equal((await db.lister('crm_membres')).length, 3);
});
