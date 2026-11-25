import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { ARBRE, POUR_TOUS, SCENARIOS, arbreTexte, carte, dossierFictif, etatA, etapesDatees, fauxResend, feuilles, markdown } from '../carte.mjs';
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

// Le modèle ou brouillon au bout d'un e-mail, lu dans son texte français.
const MODELE_FR = (nom) => rendre(nom, 'fr', { signature: 'Harold' }).corps;
const utilise = {
  bienvenue: (m) => m.type === 'bienvenue' && m.texte_fr.corps === MODELE_FR('bienvenue'),
  essai_j2: (m) => m.type === 'essai_j2' && m.texte_fr.corps.startsWith(MODELES.essai_j2.fr[1].split('{{')[0]),
  resiliation: (m) => m.type === 'resiliation' && m.texte_fr.corps === MODELE_FR('resiliation'),
  bug_corrige: (m) => m.type === 'bug_corrige' && m.texte_fr.corps.startsWith(MODELES.bug_corrige.fr[1].split('{{')[0]),
  T: (m) => m.type === 'resiliation' && m.texte_fr.corps.includes(T.fr.pris) && m.texte_fr.corps !== MODELE_FR('resiliation'),
  ESSAI: (m) => m.type === 'essai_annule' && m.texte_fr.corps.includes(ESSAI.fr.pris),
  ESSAI_COURT: (m) => m.type === 'essai_annule' && m.texte_fr.corps.includes(ESSAI_COURT.fr.corps),
  demande_avis: (m) => m.type === 'demande_avis',
  onboarding: (m) => m.type === 'onboarding',
  gros: (m) => m.type === 'gros',
};

test('chaque feuille de l’arbre : le scénario relié donne ce résultat par le vrai code', () => {
  const toutes = feuilles();
  assert.ok(toutes.length >= 20);
  for (const f of toutes) {
    assert.ok(f.scenarios?.length, `« ${f.si} » : au moins un scénario`);
    for (const x of f.scenarios) {
      const id = typeof x === 'string' ? x : x.id;
      const s = c.scenarios.find((y) => y.id === id);
      assert.ok(s, `« ${f.si} » : le scénario ${id} existe`);
      const partis = s.emails.filter((m) => m.type === f.sorte && m.resultat.startsWith('envoyé') && !m.resultat.includes('adresse de test'));
      if (x.un_seul) { assert.equal(partis.length, 1, `« ${f.si} » (${id}) : un seul e-mail de départ`); continue; }
      if (f.donne === null) {
        // Aucun : rien n'est préparé, ou c'est bloqué, expiré ou retenu ; rien ne part à la personne.
        assert.equal(partis.length, 0, `« ${f.si} » (${id}) : aucun e-mail ${f.sorte} ne doit partir`);
        continue;
      }
      const bon = partis.filter((m) => (!f.variante || m.variante === f.variante) && utilise[f.modele](m));
      assert.ok(bon.length, `« ${f.si} » (${id}) : ${f.donne} doit partir (vu : ${s.emails.map((m) => `${m.nom} ${m.resultat}`).join(' ; ') || 'rien'})`);
    }
  }
  // L'écart de 72 h retient bien un e-mail dans le scénario relié.
  const r = POUR_TOUS.ecart_72h;
  const s = c.scenarios.find((y) => y.id === r.scenarios[0]);
  assert.ok(s.emails.some((m) => m.type === r.sorte && m.deroule.some((d) => d.includes('trop tôt'))), '72 h : un e-mail retenu « trop tôt »');
});

test('chaque modèle et chaque brouillon est au bout d’au moins une feuille', () => {
  const aubout = new Set(feuilles().filter((f) => f.donne && !f.ecart).map((f) => f.modele));
  for (const nom of [...Object.keys(MODELES), 'T', 'ESSAI', 'ESSAI_COURT']) assert.ok(aubout.has(nom), `${nom} n’est au bout d’aucune feuille`);
  for (const f of feuilles()) if (f.donne) assert.ok(utilise[f.modele], `« ${f.si} » : modèle ${f.modele} inconnu`);
});

test('la sortie commence par l’arbre, puis les e-mails en français, puis les scénarios', () => {
  const md = markdown(c);
  const a = md.indexOf(arbreTexte(ARBRE, POUR_TOUS));
  const e = md.indexOf('## Les e-mails, en français');
  const s = md.indexOf('## Les scénarios');
  assert.ok(a > 0 && a < e && e < s, 'ordre : arbre, e-mails, scénarios');
  assert.doesNotMatch(md, /six langues|^En (anglais|allemand|espagnol|italien|portugais) :/m);
  // La page reçoit l'arbre avec, pour chaque feuille e-mail, son texte en français.
  const vides = feuilles(c.arbre, c.pour_tous).filter((f) => f.donne && !f.email?.corps);
  assert.deepEqual(vides.map((f) => f.si), []);
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
