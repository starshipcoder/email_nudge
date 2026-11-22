import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleUtilisateur } from '../envoi.mjs';
import { mesurer, parSorte } from '../mesures.mjs';

const T = new Date('2026-12-20T10:00:00Z');
const j = (n) => new Date(T.getTime() + n * 86400000).toISOString();

test('par sorte et par langue : envoyés, réponses et désinscriptions dans les 7 jours, sans les essais à l’adresse de test', () => {
  const actions = [
    { id: 'a1', type: 'essai_annule', langue: 'fr', user_id: 'a@exemple.fr' },
    { id: 'a2', type: 'essai_annule', langue: 'fr', user_id: 'b@exemple.fr' },
    { id: 'a3', type: 'essai_annule', langue: 'en', user_id: 'c@exemple.fr' },
    { id: 'a4', type: 'resiliation', langue: 'de', user_id: 'd@exemple.fr' },
    { id: 'a5', type: 'essai_annule', langue: 'fr', user_id: 'e@exemple.fr' },
    { id: 'a6', type: 'essai_annule', langue: 'fr', user_id: 'f@exemple.fr' },
  ];
  const envois = [
    { id: 'a1', statut: 'envoye', le: j(-20) }, { id: 'a2', statut: 'envoye', le: j(-20) }, { id: 'a3', statut: 'envoye', le: j(-2) },
    { id: 'a4', statut: 'envoye', le: j(-10) }, { id: 'a5', statut: 'envoye', le: j(-10), destinataire_reel: 'adresse_test' },
    { id: 'a6', statut: 'erreur', le: j(-10) },
  ];
  const fiches = [
    { id: cleUtilisateur('a@exemple.fr'), a_repondu_le: j(-19) },
    { id: cleUtilisateur('b@exemple.fr'), a_repondu_le: j(-5), desinscrit_le: j(-18) }, // réponse après 15 jours : ne compte pas
    { id: cleUtilisateur('d@exemple.fr') },
  ];
  const messages = [{ sens: 'recu', cle: cleUtilisateur('d@exemple.fr'), le: j(-9) }];
  const lignes = mesurer({ envois, actions, fiches, messages, maintenant: T });
  assert.deepEqual(lignes, [
    { type: 'essai_annule', langue: 'en', envoyes: 1, reponses_7j: 0, desinscrits_7j: 0, en_attente: 1 },
    { type: 'essai_annule', langue: 'fr', envoyes: 2, reponses_7j: 1, desinscrits_7j: 1, en_attente: 0 },
    { type: 'resiliation', langue: 'de', envoyes: 1, reponses_7j: 1, desinscrits_7j: 0, en_attente: 0 },
  ]);
  const s = parSorte(lignes);
  assert.equal(s.find((x) => x.type === 'essai_annule').taux_reponse, 50, 'sur les 2 envois dont les 7 jours sont passés');
  assert.ok(!JSON.stringify(s).includes('@'));
});
