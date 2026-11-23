import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleQuestion } from '../brouillons.mjs';
import { direEcart, ecartsDe } from '../reperes.mjs';

const dossier = ({ metier = 'commercial', imports = [], demarrees = 0, abandonne = false, paiements = 3, essai_le = '2026-01-01', signaux = [] } = {}) => ({
  lie: true, questionnaire: null, abonnement: { paiements, essai_le }, usage: { metier: null, signaux },
  parcours: { onboarding: { metier, besoins: [], source: null, fini: !abandonne, abandonne }, imports, tournees: { creees: 1, optimisees: 0, demarrees } },
});

test('un abonné qui rate ses imports et ne démarre jamais : deux écarts, le plus grand d’abord, chacun avec sa brique', () => {
  const d = dossier({ imports: [{ source: 'Excel', reussis: 3, echecs: 5 }], signaux: [{ nom: 'Event-ImportExcelError', n: 5 }] });
  const e = ecartsDe(d);
  assert.deepEqual(e.map((x) => [x.id, x.ecart]), [['import', 45], ['demarrage_payant', 36]]);
  assert.match(direEcart(e[0]), /76 sur 93 .*import-fichier C5, au 19\/11\/2026/);
  assert.equal(cleQuestion(d), 'probleme', 'le plus grand écart est l’import raté');
});

test('un essai annulé sans tournée démarrée : la question demande ce qui a manqué pour partir', () => {
  const d = dossier({ paiements: 0 });
  assert.deepEqual(ecartsDe(d).map((x) => x.id), ['demarrage_essai']);
  assert.equal(cleQuestion(d), 'jamais_demarre');
});

test('le métier choisit son repère, sinon tous métiers ; une personne inconnue de Mixpanel n’a pas d’écart', () => {
  assert.equal(ecartsDe(dossier({ abandonne: true, demarrees: 2 }))[0].repere.compte, '89 sur 112');
  assert.equal(ecartsDe(dossier({ metier: 'livreur', abandonne: true, demarrees: 2 }))[0].repere.qui, 'nouveaux, tous métiers');
  assert.deepEqual(ecartsDe({ ...dossier(), lie: false }), []);
  assert.deepEqual(ecartsDe(dossier({ demarrees: 4, imports: [{ source: 'Excel', reussis: 4, echecs: 1 }] })), [], 'un seul échec ne fait pas un écart');
});

test('une réponse récente au questionnaire passe avant les écarts', () => {
  const d = { ...dossier({ paiements: 0 }), questionnaire: { raison: 'tooExpensive', le: '2026-11-20' }, calcule_le: '2026-11-22' };
  assert.equal(cleQuestion(d), 'tooExpensive');
});
