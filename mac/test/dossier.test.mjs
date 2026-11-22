import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { brouillonResiliation, dossierDe, resumer } from '../dossier.mjs';

const JOUR = 86400000;
const T = new Date('2026-11-22T10:00:00Z');
const jour = (n) => new Date(T.getTime() + n * JOUR).toISOString().slice(0, 10);
const sec = (n) => Math.floor((T.getTime() + n * JOUR) / 1000);

function sources() {
  const mp = new DatabaseSync(':memory:');
  mp.exec(`CREATE TABLE evenements (id TEXT, proprietes TEXT);
    CREATE TABLE propres (id TEXT, nom TEXT, temps INT, jour TEXT, utilisateur TEXT, a_exclure TEXT, formule TEXT);`);
  let n = 0;
  const ev = (nom, j, props = {}, utilisateur = 'p1', formule = null) => {
    n += 1;
    mp.prepare('INSERT INTO evenements VALUES (?, ?)').run(`e${n}`, JSON.stringify(props));
    mp.prepare('INSERT INTO propres VALUES (?, ?, ?, ?, ?, ?, ?)').run(`e${n}`, nom, sec(j), jour(j), utilisateur, '', formule);
  };
  // Usage : actif chaque semaine jusqu'à il y a 3 semaines, puis plus rien.
  for (const j of [-60, -59, -52, -45, -44, -38, -31, -30, -24]) ev('Action-startRoute', j);
  for (let k = 0; k < 12; k += 1) ev('Screen-ContactMap', -60 + k);
  for (let k = 0; k < 3; k += 1) ev('Screen-Contacts', -23);
  ev('Screen-ContactMap', -40, {}, 'quelqu_un_d_autre');
  // Abonnement.
  const rc = { original_app_user_id: 'rcA', original_transaction_id: 'T1', product_id: 'ew_monthly' };
  ev('rc_trial_started_event', -70, { ...rc, period_type: 'TRIAL' }, 'rcA', 'mensuel');
  ev('rc_trial_converted_event', -63, rc, 'rcA', 'mensuel');
  ev('rc_renewal_event', -33, rc, 'rcA', 'mensuel');
  ev('rc_cancellation_event', -2, { ...rc, cancel_reason: 'UNSUBSCRIBE', period_type: 'NORMAL' }, 'rcA', 'mensuel');
  // Le questionnaire de départ.
  ev('Action-churn', -2, { reason: 'ChurnReason.tooExpensive', text: 'trop cher pour moi seul' });

  const u = new DatabaseSync(':memory:');
  u.exec(`CREATE TABLE utilisateurs (utilisateur TEXT, premier_jour TEXT, metier TEXT, jours_actifs INT, dernier_jour TEXT,
    "Carte" INT, "Contacts" INT, "Import de contacts" INT, "Tournée : optimiser" INT, "Tournée : sur la route" INT, "Prospection" INT)`);
  u.prepare('INSERT INTO utilisateurs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('p1', jour(-71), 'commercial', 9, jour(-23), 40, 12, 3, 9, 25, 0);
  const zones = new Map([['Action-startRoute', 'Tournée : sur la route'], ['Screen-ContactMap', 'Carte'], ['Screen-Contacts', 'Contacts'],
    ['Event-ImportExcelError', 'Import de contacts'], ['Event-geocoderError', 'Import de contacts'], ['Event-emptyMapState', 'Carte']]);
  return { mixpanel: mp, utilisateurs: u, liens: new Map([['rcA', 'p1'], ['rcB', 'p2']]), zones, ev };
}

test('le dossier réunit le questionnaire, l’usage semaine par semaine, l’abonnement et le métier', () => {
  const d = dossierDe({ rc: 'rcA', sources: sources(), maintenant: T });
  assert.equal(d.personne, 'p1');
  assert.deepEqual(d.questionnaire, { raison: 'tooExpensive', texte: 'trop cher pour moi seul', le: jour(-2) });
  assert.equal(d.usage.tournees, 9);
  assert.equal(d.usage.jours_actifs, 19);
  assert.equal(d.usage.dernier_jour, jour(-23));
  assert.equal(d.usage.metier, 'commercial');
  assert.deepEqual(d.usage.zones.slice(0, 3).map((z) => z.zone), ['Carte', 'Tournée : sur la route', 'Contacts']);
  assert.ok(d.usage.zones_jamais.includes('Prospection') && !d.usage.zones_jamais.includes('Carte'));
  assert.equal(d.usage.semaines.length, 12);
  assert.equal(d.usage.semaines.slice(-3).reduce((a, b) => a + b, 0), 0);
  assert.equal(d.abonnement.formule, 'mensuel');
  assert.equal(d.abonnement.premier_paiement, jour(-63));
  assert.equal(d.abonnement.paiements, 2);
  assert.equal(d.abonnement.resilie_le, jour(-2));
});

test('le résumé dit ce qui ressort, sans adresse, et propose une question', () => {
  const r = resumer(dossierDe({ rc: 'rcA', sources: sources(), maintenant: T }));
  assert.ok(r.faits.some((f) => /9 tournées/.test(f)));
  assert.ok(r.faits.some((f) => /plus rien depuis 23 jours/.test(f)));
  assert.ok(r.faits.some((f) => /trop cher/.test(f)));
  assert.match(r.question, /prix/);
  assert.ok(!JSON.stringify(r).includes('@'));
});

test('le brouillon cite des faits de son usage, part de sa réponse et pose une seule question', () => {
  const d = dossierDe({ rc: 'rcA', sources: sources(), maintenant: T });
  const fr = brouillonResiliation(d, 'fr', 'Prénom');
  assert.match(fr.corps, /9 tournées/);
  assert.match(fr.corps, /trop cher/);
  assert.equal((fr.corps.match(/\?/g) ?? []).length, 1);
  assert.doesNotMatch(fr.corps, /offre|réduction|promo/i);
  assert.match(fr.corps, /Prénom$/);
  const en = brouillonResiliation(d, 'en', 'Name');
  assert.match(en.corps, /9 routes/);
  assert.match(en.sujet, /Easy Way/);
});

test('sans questionnaire ni usage connu, le brouillon pose la question ouverte', () => {
  const s = sources();
  const d = dossierDe({ rc: 'inconnu', sources: s, maintenant: T });
  assert.equal(d.questionnaire, null);
  const b = brouillonResiliation(d, 'fr', 'Prénom');
  assert.match(b.corps, /qu'est-ce qui vous a fait partir/i);
  assert.equal((b.corps.match(/\?/g) ?? []).length, 1);
});

test('sans réponse au questionnaire, un import raté donne le fait et la question', () => {
  const s = sources();
  for (let k = 0; k < 3; k += 1) s.ev('Event-ImportExcelError', -200, {}, 'p2');
  for (let k = 0; k < 40; k += 1) s.ev('Event-geocoderError', -200, {}, 'p2');
  s.ev('rc_trial_converted_event', -190, { original_app_user_id: 'rcB' }, 'rcB', 'mensuel');
  for (const j of [-160, -130, -100, -70, -40, -10]) s.ev('rc_renewal_event', j, { original_app_user_id: 'rcB' }, 'rcB', 'mensuel');
  s.ev('rc_cancellation_event', -3, { original_app_user_id: 'rcB' }, 'rcB', 'mensuel');
  const d = dossierDe({ rc: 'rcB', sources: s, maintenant: T });
  assert.deepEqual(d.usage.signaux.map((x) => x.nom), ['Event-ImportExcelError', 'Event-geocoderError']);
  const r = resumer(d, T);
  assert.ok(r.faits.some((f) => /import d’un fichier en échec \(3 fois\)/.test(f)));
  assert.ok(r.faits.some((f) => /A continué de payer sans ouvrir l'app/.test(f)));
  const b = brouillonResiliation(d, 'fr', 'Prénom');
  assert.match(b.corps, /l'import de votre fichier n'a pas marché/);
  assert.match(b.corps, /Est-ce ce problème qui vous a arrêté/);
  assert.equal((b.corps.match(/\?/g) ?? []).length, 1);
});

test('un inscrit non abonné se relie à sa personne par l’id RevenueCat que l’app a vu, et l’index se garde', async () => {
  const { indexIds, personneDe } = await import('../dossier.mjs');
  const { mkdtempSync, writeFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const mp = new DatabaseSync(':memory:');
  mp.exec(`CREATE TABLE evenements (id TEXT, distinct_id TEXT, proprietes TEXT);
    CREATE TABLE propres (id TEXT, nom TEXT, utilisateur TEXT, a_exclure TEXT);
    INSERT INTO evenements VALUES ('1', 'dev1', '{"rc.user_id":"rcX"}'), ('2', 'rcY', '{}'), ('3', 'dev3', '{"$user_id":"rcZ"}');
    INSERT INTO propres VALUES ('1', 'Event-RevenueCat-CustomerInfo', 'pX', ''), ('2', 'Screen-ContactMap', 'pY', ''), ('3', 'Screen-ContactMap', 'pZ', '');`);
  const dossier = mkdtempSync(join(tmpdir(), 'iris-'));
  const base = join(dossier, 'easyway.sqlite');
  writeFileSync(base, 'x');
  const ids = indexIds(mp, base);
  assert.deepEqual(['rcX', 'rcY', 'rcZ'].map((r) => personneDe({ liens: new Map(), ids }, r)), ['pX', 'pY', 'pZ']);
  assert.ok(existsSync(join(dossier, 'iris-index-ids.json')));
  mp.exec("DELETE FROM propres");
  assert.equal(indexIds(mp, base).get('rcX'), 'pX');
  assert.equal(personneDe({ liens: new Map([['rcX', 'lien']]), ids }, 'rcX'), 'lien');
});
