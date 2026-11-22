import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { cleUtilisateur, porteEnvoi } from '../envoi.mjs';
import { bugs, personneDuRetour } from '../bugs.mjs';
import { compareVersions, texteDuTrousseau, versionDePiste } from '../versions.mjs';

const T = new Date('2026-12-02T10:00:00Z');
const evenement = ({ rc = 'rcA', contact = null, os = 'iOS', version = '7.6.8+812' } = {}) => ({
  release: { version: `com.starshipcoder.contactonmap@${version}` },
  contexts: { feedback: { name: rc, contact_email: contact, message: 'La carte reste blanche' }, os: { name: os } },
});
const RETOURS = [
  { issue: { id: '111', firstSeen: '2026-11-20T08:00:00Z', metadata: { message: 'La carte reste blanche' } }, event: evenement() },
  { issue: { id: '222', firstSeen: '2026-11-21T08:00:00Z', metadata: { message: 'Crash à l’export' } }, event: evenement({ rc: '$RCAnonymousID:x', contact: 'bob@exemple.com', os: 'Android', version: '7.6.7+800' }) },
  { issue: { id: '333', firstSeen: '2026-11-21T09:00:00Z', metadata: { message: 'Bug' } }, event: evenement({ rc: 'inconnu', os: 'iOS' }) },
];
const USERS = [
  { id: 'ana@exemple.fr', revenuecat_id: 'rcA', locale: 'fr' },
  { id: 'bob@exemple.com', revenuecat_id: 'rcB', locale: 'en' },
];

function monter({ versions = { ios: { version: '7.6.8' }, android: { version: '7.6.8' } }, fiches = [] } = {}) {
  const db = baseEnMemoire({ users: USERS, crm_fiches: fiches,
    crm_reglages: [{ id: 'general', signature: 'Prénom', envois_coupes: false, a_blanc: true, expediteur: 'P <p@exemple.fr>', repondre_a: 'moi@exemple.fr', adresse_test: 't@exemple.fr' }] });
  let lues = versions;
  const b = bugs(db, { maintenant: () => T, lireRetours: async () => RETOURS, lireVersions: async () => lues });
  return { db, b, changer: (v) => { lues = v; } };
}

test('un retour Sentry donne la personne (identifiant RevenueCat, sinon l’e-mail donné), la plateforme et la version vue', () => {
  assert.deepEqual(personneDuRetour(RETOURS[0].event), { rc: 'rcA', contact: null, plateforme: 'ios', version_vue: '7.6.8+812' });
  assert.equal(personneDuRetour(RETOURS[1].event).plateforme, 'android');
});

test('les retours se relient aux inscrits ; un inconnu reste sans fiche', async () => {
  const { b } = monter();
  const lignes = await b.retours();
  assert.deepEqual(lignes.map((l) => [l.id, l.user_id]), [['333', null], ['222', 'bob@exemple.com'], ['111', 'ana@exemple.fr']]);
});

test('corrigé dans une version pas encore en vente : rien ; en vente : une action pour la bonne personne, une seule fois', async () => {
  const { db, b, changer } = monter({ versions: { ios: { version: '7.6.8' }, android: { version: '7.6.8' } } });
  await b.noter('111', { titre: 'la carte qui restait blanche', version_corrigee: '7.6.9' });
  assert.equal((await b.preparer()).creees, 0);
  changer({ ios: { version: '7.6.9', mise_en_vente_le: '2026-12-01T00:00:00Z' }, android: { version: '7.6.8' } });
  assert.equal((await b.preparer()).creees, 1);
  assert.equal((await b.preparer()).creees, 0);
  const actions = await db.lister('crm_actions');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].id, `bug_corrige__${cleUtilisateur('ana@exemple.fr')}__7.6.9`);
  assert.equal(actions[0].user_id, 'ana@exemple.fr');
  assert.match(actions[0].corps, /la carte qui restait blanche/);
  assert.match(actions[0].corps, /version 7\.6\.9/);
  assert.match(actions[0].corps, /App Store/);
  assert.equal((await db.lire('crm_bugs', '111')).action_id, actions[0].id);
});

test('la plateforme de la personne compte : un bug Android attend la version sur Play', async () => {
  const { db, b, changer } = monter({ versions: { ios: { version: '7.7.0' }, android: { version: '7.6.8' } } });
  await b.noter('222', { titre: 'le crash à l’export', version_corrigee: '7.7.0' });
  assert.equal((await b.preparer()).creees, 0);
  changer({ ios: { version: '7.7.0' }, android: { version: '7.7.1' } });
  assert.equal((await b.preparer()).creees, 1);
  const [a] = await db.lister('crm_actions');
  assert.equal(a.langue, 'en');
  assert.match(a.corps, /Google Play/);
});

test('un store qui ne répond pas ne prépare rien pour lui, et ne casse rien', async () => {
  const { b } = monter({ versions: { ios: { erreur: 'App Store 503' }, android: { version: '9.9.9' } } });
  await b.noter('111', { titre: 'la carte', version_corrigee: '7.6.9' });
  assert.equal((await b.preparer()).creees, 0);
});

test('désinscrit, inconnu ou mal noté : pas d’action', async () => {
  const { b } = monter({ versions: { ios: { version: '8.0.0' }, android: { version: '8.0.0' } }, fiches: [{ id: cleUtilisateur('ana@exemple.fr'), desinscrit: true }] });
  await b.noter('111', { titre: 'la carte', version_corrigee: '7.6.9' });
  await b.noter('333', { titre: 'le bug', version_corrigee: '7.6.9' });
  assert.equal((await b.preparer()).creees, 0);
  await assert.rejects(b.noter('111', { titre: '', version_corrigee: '7.6.9' }), /titre/);
  await assert.rejects(b.noter('111', { titre: 'x', version_corrigee: 'bientôt' }), /version/);
  await assert.rejects(b.noter('999', { titre: 'x', version_corrigee: '7.6.9' }), /introuvable/);
});

test('l’écart de 72 h ne bloque pas « ton bug est corrigé » : c’est une réponse à sa demande', async () => {
  const { db, b } = monter({ versions: { ios: { version: '7.6.9' }, android: { version: '7.6.9' } } });
  await db.ecrire('crm_fiches', cleUtilisateur('ana@exemple.fr'), { dernier_envoi_le: new Date(T.getTime() - 3600000) });
  await b.noter('111', { titre: 'la carte', version_corrigee: '7.6.9' });
  await b.preparer();
  const [a] = await db.lister('crm_actions');
  const porte = porteEnvoi({ db, maintenant: () => T, lireRevenueCat: async () => ({}), envoyerResend: async () => ({ id: 'r' }) });
  assert.equal((await porte.envoyerAction(a.id)).statut, 'a_blanc');
});

test('versions : ordre, et version de la piste de production', () => {
  assert.equal(compareVersions('7.6.10', '7.6.9'), 1);
  assert.equal(compareVersions('7.6.9+812', '7.6.9'), 0);
  assert.equal(versionDePiste({ releases: [{ name: '7.6.7 (800)', status: 'completed' }, { name: '7.6.8 (812)', status: 'inProgress' }, { name: '7.7.0', status: 'draft' }] }), '7.6.8');
});

test('le trousseau rend une clé JSON en hexadécimal : elle se décode', () => {
  const json = '{\n  "a": 1\n}';
  assert.equal(texteDuTrousseau(Buffer.from(json).toString('hex') + '\n'), json);
  assert.equal(texteDuTrousseau('{"a":1}'), '{"a":1}');
});
