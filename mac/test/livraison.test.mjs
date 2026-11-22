import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { cleUtilisateur, porteEnvoi } from '../envoi.mjs';
import { relireLivraisons } from '../livraison.mjs';
import { mesurer, parSorte } from '../mesures.mjs';

const T = new Date('2026-12-20T10:00:00Z');
const j = (n) => new Date(T.getTime() + n * 86400000).toISOString();

function base() {
  return baseEnMemoire({
    users: [{ id: 'a@exemple.fr' }, { id: 'b@exemple.fr' }, { id: 'c@exemple.fr' }],
    crm_actions: [{ id: 'x1', type: 'essai_annule', user_id: 'a@exemple.fr', langue: 'fr' }, { id: 'x2', type: 'essai_annule', user_id: 'b@exemple.fr', langue: 'fr' },
      { id: 'x3', type: 'resiliation', user_id: 'c@exemple.fr', langue: 'fr' }, { id: 'x4', type: 'resiliation', user_id: 'c@exemple.fr', langue: 'fr' }],
    crm_envois: [{ id: 'x1', statut: 'envoye', resend_id: 'r1', le: j(-2) }, { id: 'x2', statut: 'envoye', resend_id: 'r2', le: j(-3) },
      { id: 'x3', statut: 'envoye', resend_id: 'r3', le: j(-1) }, { id: 'x4', statut: 'envoye', resend_id: 'r4', le: j(-20) }],
  });
}

test('un rebond marque l’adresse, une plainte désinscrit ; un e-mail de plus de 14 jours n’est plus relu (INT-EW-76)', async () => {
  const db = base();
  const etats = { r1: 'bounced', r2: 'complained', r3: 'delivered' };
  const lus = [];
  const b = await relireLivraisons({ db, lireEmail: async (id) => { lus.push(id); return { last_event: etats[id] }; }, maintenant: T, attente: async () => {} });
  assert.deepEqual(lus.sort(), ['r1', 'r2', 'r3']);
  assert.deepEqual([b.lus, b.rebonds.length, b.plaintes.length], [3, 1, 1]);
  assert.equal(db.donnees.crm_fiches.get(cleUtilisateur('a@exemple.fr')).adresse_invalide, true);
  assert.equal(db.donnees.crm_fiches.get(cleUtilisateur('b@exemple.fr')).desinscrit, true);
  assert.equal(db.donnees.crm_envois.get('x3').livraison, 'delivered');
  // Relu à la passe suivante : le rebond et la plainte ne sont plus relus, ni recomptés.
  const lus2 = [];
  const b2 = await relireLivraisons({ db, lireEmail: async (id) => { lus2.push(id); return { last_event: etats[id] }; }, maintenant: T, attente: async () => {} });
  assert.deepEqual(lus2, ['r3']);
  assert.deepEqual([b2.rebonds.length, b2.plaintes.length], [0, 0]);
  assert.ok(!JSON.stringify(b).includes('@'));
});

test('Resend qui refuse la lecture : on s’arrête et on dit pourquoi, sans rien marquer', async () => {
  const db = base();
  const b = await relireLivraisons({ db, lireEmail: async () => { throw new Error('Resend 401'); }, maintenant: T, attente: async () => {} });
  assert.equal(b.erreur, 'Resend 401');
  assert.equal(b.lus, 0);
  assert.equal(db.donnees.crm_fiches?.size ?? 0, 0);
});

test('la porte n’écrit plus à une adresse en rebond ; les mesures comptent rebonds et plaintes', async () => {
  const db = baseEnMemoire({
    crm_reglages: [{ id: 'general', envois_coupes: false, a_blanc: false, expediteur: 'P <p@exemple.fr>', repondre_a: 'moi@exemple.fr', adresse_test: 't@exemple.fr' }],
    users: [{ id: 'a@exemple.fr' }],
    crm_actions: [{ id: 'y', type: 'libre', user_id: 'a@exemple.fr', statut: 'prete', sujet: 's', corps: 'c' }],
    crm_fiches: [{ id: cleUtilisateur('a@exemple.fr'), adresse_invalide: true }],
  });
  const porte = porteEnvoi({ db, maintenant: () => T, lireRevenueCat: async () => ({}), envoyerResend: async () => ({ id: 'r' }) });
  assert.equal((await porte.envoyerAction('y')).raison, 'adresse en rebond');
  const lignes = mesurer({ actions: [{ id: 'x1', type: 'essai_annule', langue: 'fr', user_id: 'a@exemple.fr' }, { id: 'x2', type: 'essai_annule', langue: 'fr', user_id: 'b@exemple.fr' }],
    envois: [{ id: 'x1', statut: 'envoye', le: j(-10), livraison: 'bounced' }, { id: 'x2', statut: 'envoye', le: j(-10), livraison: 'complained' }], maintenant: T });
  assert.deepEqual([lignes[0].rebonds, lignes[0].plaintes], [1, 1]);
  assert.equal(parSorte(lignes)[0].plaintes, 1);
});
