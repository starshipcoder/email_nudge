import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { direParcours, parcoursDe } from '../parcours.mjs';

function base(evts) {
  const mp = new DatabaseSync(':memory:');
  mp.exec(`CREATE TABLE evenements (id TEXT, proprietes TEXT); CREATE TABLE propres (id TEXT, nom TEXT, temps INT, jour TEXT, utilisateur TEXT, a_exclure TEXT, formule TEXT);`);
  evts.forEach(([nom, props = {}, qui = 'p1'], i) => {
    mp.prepare('INSERT INTO evenements VALUES (?, ?)').run(`e${i}`, JSON.stringify(props));
    mp.prepare('INSERT INTO propres VALUES (?, ?, ?, ?, ?, ?, ?)').run(`e${i}`, nom, 1000 + i, '2026-11-20', qui, '', null);
  });
  return mp;
}

test('le parcours : métier, besoins cochés puis décochés, source, imports, tournées (INT-EW-69)', () => {
  const mp = base([
    ['Event-onboardingRoleSetSalesRep'], ['Event-onboardingRoleSetDeliveryDriver'],
    ['Event-onboardingNeedSetMaxVisits'], ['Event-onboardingNeedSetMultiDayPlanning'], ['Event-onboardingNeedUnsetMultiDayPlanning'],
    ['Action-onboardingSourceTapFileExcel'], ['Event-onboardingCompleted'],
    ['Event-ImportExcelError'], ['Event-ImportExcelError'], ['Event-ImportExcelSuccess', { imported_count: 120 }],
    ['Event-ImportNativeSuccess', { totalContacts: 40, locatedContacts: 31 }],
    ['Action-confirmCreateRouteName'], ['Action-confirmCreateRouteName'],
    ['Action-optimizeRoute', { success: true }], ['Action-optimizeRoute', { success: false }],
    ['Action-startRoute', { stop_count: 18 }],
    ['Event-onboardingRoleSetOther', {}, 'quelqu_un_d_autre'],
  ]);
  const p = parcoursDe(mp, 'p1');
  assert.deepEqual(p.onboarding, { metier: 'livreur', besoins: ['beaucoup de visites'], source: 'un fichier Excel', fini: true, abandonne: false });
  assert.deepEqual(p.imports, [
    { source: 'Excel', reussis: 1, contacts: 120, localises: 0, echecs: 2, annules: 0 },
    { source: 'contacts du téléphone', reussis: 1, contacts: 40, localises: 31, echecs: 0, annules: 0 },
  ]);
  assert.deepEqual(p.tournees, { creees: 2, optimisees: 1, optimisations_ratees: 1, demarrees: 1, arrets_max: 18 });
  assert.deepEqual(direParcours(p), [
    'Onboarding fini : métier livreur ; besoins : beaucoup de visites ; contacts : un fichier Excel.',
    'Imports : Excel réussi (120 contacts), Excel en échec 2 fois ; contacts du téléphone réussi (40 contacts, 31 sur la carte).',
    'Tournées : 2 créées, 1 optimisée (1 optimisation ratée), 1 démarrée (jusqu\'à 18 arrêts).',
  ]);
});

test('un onboarding abandonné sans rien d’autre ; une personne inconnue n’a pas de parcours', () => {
  const mp = base([['Event-onboardingAbandoned'], ['Event-onboardingSourceContinueEmpty']]);
  const p = parcoursDe(mp, 'p1');
  assert.equal(p.onboarding.abandonne, true);
  assert.equal(p.onboarding.source, 'aucune');
  assert.deepEqual(direParcours(p), ['Onboarding abandonné : contacts : aucune.']);
  assert.deepEqual(direParcours(parcoursDe(mp, 'personne')), []);
  assert.equal(parcoursDe(null, 'p1'), null);
});

test('« 1 arrêt » au singulier', () => {
  const p = { onboarding: { metier: null, besoins: [], source: null, fini: false, abandonne: false }, imports: [], tournees: { creees: 1, optimisees: 1, optimisations_ratees: 0, demarrees: 1, arrets_max: 1 } };
  assert.deepEqual(direParcours(p), ['Tournées : 1 créée, 1 optimisée, 1 démarrée (1 arrêt).']);
});
