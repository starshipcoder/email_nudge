import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { candidats, preparer } from '../preparer.mjs';
import { rendre } from '../modeles.mjs';

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
  assert.deepEqual(candidats(faits, inscrits, T).map((c) => c.user.id), ['ana@exemple.fr']);
});

test('une résiliation de payant des 7 derniers jours donne un e-mail, pas un défaut de carte ni une reprise', () => {
  const faits = [
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
  assert.deepEqual(await preparer({ db, faits, tournees, maintenant: T }), { creees: 2, expirees: 0 });
  assert.deepEqual(await preparer({ db, faits, tournees, maintenant: T }), { creees: 0, expirees: 0 });
  const actions = await db.lister('crm_actions');
  const ana = actions.find((a) => a.user_id === 'ana@exemple.fr');
  const bob = actions.find((a) => a.user_id === 'bob@exemple.com');
  assert.equal(ana.variante, 'usage');
  assert.match(ana.corps, /déjà lancé 3 tournée/);
  assert.match(ana.corps, /Réglages de l’iPhone/);
  assert.equal(bob.variante, 'peu_usage');
  assert.match(bob.sujet, /^Your Easy Way trial ends on/);
  assert.match(bob.corps, /Google Play/);
  assert.ok(!actions.some((a) => /\{\{/.test(a.corps)));
});

test('sans signature réglée, rien n’est préparé ; une action dont l’échéance passe expire', async () => {
  const db = baseEnMemoire({ users: inscrits, crm_reglages: [{ id: 'general' }], crm_actions: [{ id: 'x', statut: 'prete', echeance: iso(-1) }] });
  assert.equal((await preparer({ db, faits: [essai('rcA', 40, 'T1')], tournees: () => 0, maintenant: T })).raison, 'signature à régler');
  await db.ecrire('crm_reglages', 'general', { signature: 'S' });
  assert.deepEqual(await preparer({ db, faits: [], tournees: () => 0, maintenant: T }), { creees: 0, expirees: 1 });
  assert.equal(db.donnees.crm_actions.get('x').statut, 'expiree');
});

test('un modèle à trou ne se rend pas', () => {
  assert.throws(() => rendre('resiliation', 'fr', {}), /signature/);
  assert.throws(() => rendre('inconnu', 'fr', {}), /inconnu/);
});
