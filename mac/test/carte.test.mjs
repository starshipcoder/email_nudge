import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, carte, dossierFictif, etatA, etapesDatees, fauxResend, markdown } from '../carte.mjs';
import { MODELES, rendre } from '../modeles.mjs';
import { ESSAI, ESSAI_COURT, T, brouillonAvecTraduction, brouillonEssaiAnnule } from '../brouillons.mjs';
import { dossierDe, resumer } from '../dossier.mjs';

const ATTENDUE = fileURLToPath(new URL('../carte-attendue.md', import.meta.url));
const c = await carte();

test('la carte du jour est celle qui est enregistrée', () => {
  assert.equal(markdown(c), readFileSync(ATTENDUE, 'utf8'),
    'La carte a changé : régénérer avec `node mac/carte.mjs > mac/carte-attendue.md` et relire le changement.');
});

test('chaque modèle et chaque brouillon apparaît dans au moins un scénario', () => {
  const emails = c.scenarios.flatMap((s) => s.emails);
  const fr = (m) => m.texte_fr.corps;
  const vu = {
    essai_j2: emails.some((m) => m.type === 'essai_j2'),
    resiliation: emails.some((m) => m.type === 'resiliation' && fr(m) === rendre('resiliation', 'fr', { signature: 'Harold' }).corps),
    bienvenue: emails.some((m) => m.type === 'bienvenue' && fr(m) === rendre('bienvenue', 'fr', { signature: 'Harold' }).corps),
    bug_corrige: emails.some((m) => m.type === 'bug_corrige' && fr(m).startsWith(MODELES.bug_corrige.fr[1].split('{{')[0])),
    T: emails.some((m) => m.type === 'resiliation' && fr(m).includes(T.fr.pris) && fr(m) !== rendre('resiliation', 'fr', { signature: 'Harold' }).corps),
    ESSAI: emails.some((m) => m.type === 'essai_annule' && fr(m).includes(ESSAI.fr.pris)),
    ESSAI_COURT: emails.some((m) => m.type === 'essai_annule' && fr(m).includes(ESSAI_COURT.fr.corps)),
  };
  for (const nom of Object.keys(MODELES)) assert.ok(vu[nom], `le modèle ${nom} n'apparaît dans aucun scénario`);
  for (const nom of ['T', 'ESSAI', 'ESSAI_COURT']) assert.ok(vu[nom], `le brouillon ${nom} n'apparaît dans aucun scénario`);
  // Les six langues sont rendues pour chaque e-mail, sans variable restée vide.
  for (const m of emails) for (const [lg, x] of Object.entries(m.langues)) assert.ok(x && !/\{\{/.test(x.corps), `${m.id} en ${lg}`);
});

test('chaque scénario donne le résultat annoncé par son étiquette', () => {
  for (const s of c.scenarios) {
    assert.deepEqual(s.resultats, s.attendu, `scénario ${s.id}`);
    assert.ok(s.cas.length && s.cas.every((n) => n >= 1 && n <= 48), `${s.id} : étiquette de cas`);
    for (const [type, v] of Object.entries(s.attendu)) if (v === 'rien de préparé') assert.ok(s.rien[type], `${s.id} : dire pourquoi rien pour ${type}`);
  }
});

test('le dossier fictif a les clés du vrai dossier, et les brouillons le lisent', () => {
  // Le vrai dossier, sur une base Mixpanel en mémoire et vide de toute donnée réelle (comme test/dossier.test.mjs).
  const mp = new DatabaseSync(':memory:');
  mp.exec(`CREATE TABLE evenements (id TEXT, proprietes TEXT);
    CREATE TABLE propres (id TEXT, nom TEXT, temps INT, jour TEXT, utilisateur TEXT, a_exclure TEXT, formule TEXT);`);
  const vrai = dossierDe({ rc: 'rcX', sources: { mixpanel: mp, utilisateurs: null, liens: new Map([['rcX', 'pX']]), zones: new Map(), fin: 1 }, maintenant: new Date('2026-12-02T10:00:00Z') });
  const sc = SCENARIOS.find((s) => s.id === 'essai-annule-avec-reponse');
  const t = etapesDatees(sc).at(-1).t + 3600000;
  const fictif = dossierFictif(sc, etatA(sc, t), t);
  const cles = (o) => Object.keys(o).sort();
  assert.deepEqual(cles(fictif), cles(vrai));
  for (const k of ['usage', 'abonnement', 'parcours', 'a_jour']) assert.deepEqual(cles(fictif[k]), cles(vrai[k]), k);
  for (const k of ['onboarding', 'tournees']) assert.deepEqual(cles(fictif.parcours[k]), cles(vrai.parcours[k]), `parcours.${k}`);
  assert.deepEqual(cles(fictif.questionnaire), ['le', 'raison', 'source', 'texte']);
  assert.match(brouillonEssaiAnnule(fictif, 'fr', 'Harold').corps, /trop cher/);
  assert.match(brouillonAvecTraduction(fictif, 'de', 'Harold').traduction_fr.corps, /6 tournées/);
  assert.ok(resumer(fictif, new Date(t)).faits.length);
});

test('le faux Resend refuse tout appel hors d’un scénario, et toute adresse réelle', async () => {
  const r = fauxResend();
  await assert.rejects(r.envoyer({ to: 'x@exemple.fr', subject: 's', text: 't' }, 'k'), /hors d’un scénario/);
  r.ouvrir();
  await assert.rejects(r.envoyer({ to: 'quelqu.un@gmail.com', subject: 's', text: 't' }, 'k'), /hors @exemple\.fr/);
  assert.deepEqual(await r.envoyer({ to: 'x@exemple.fr', subject: 's', text: 't' }, 'k'), { id: 'faux-1' });
  r.fermer();
  await assert.rejects(r.envoyer({ to: 'x@exemple.fr', subject: 's', text: 't' }, 'k'), /hors d’un scénario/);
  assert.equal(r.envois.length, 1);
});

test('la carte ne porte que des adresses @exemple.fr et la signature fictive', () => {
  const texte = JSON.stringify(c);
  for (const adresse of texte.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []) assert.match(adresse, /@exemple\.fr$/);
  for (const m of c.scenarios.flatMap((s) => s.emails)) assert.match(m.texte.corps, /Harold$/);
});

test('la page lit la carte en lecture seule, sans base ni porte d’envoi', async () => {
  const http = await import('node:http');
  const { application } = await import('../serveur.mjs');
  const serveur = http.createServer();
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const { port } = serveur.address();
  serveur.on('request', application({}, { port }));
  const base = `http://127.0.0.1:${port}`;
  try {
    const r = await (await fetch(`${base}/api/carte`)).json();
    assert.equal(r.scenarios.length, c.scenarios.length);
    assert.deepEqual(r.tableau, c.tableau);
    assert.equal((await fetch(`${base}/api/carte`, { method: 'POST', headers: { 'x-crm': '1' } })).status, 404);
    assert.equal((await fetch(`${base}/api/envoyer`, { method: 'POST', headers: { 'x-crm': '1' }, body: '{}' })).status, 503);
  } finally { serveur.close(); }
});
