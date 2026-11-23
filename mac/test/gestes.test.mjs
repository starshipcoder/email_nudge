import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FICHIER_ALERTE_GESTES, ligneGestesDHier, lireAlerteGestes, veilleurGestes } from '../notif.mjs';

// Un faux relevé, au format d'hephaistos (alertes_gestes.py, ecrire) : la ligne, les alertes (clé, titre), le détail.
const dossier = mkdtempSync(path.join(os.tmpdir(), 'iris-gestes-'));
function fauxReleve(nom, cles, au = '2026-11-22') {
  const f = path.join(dossier, nom);
  writeFileSync(f, JSON.stringify({ au, ligne: 'Easy Way : Créer une tournée en baisse depuis la 9.9.9 (6 bloqués sur 10)',
    alertes: cles.map((cle) => ({ cle, titre: `${cle} : 4 sur 10 réussissent` })),
    detail: { baisses: cles.map((cle) => ({ cle, rangs: [4242, 4343], replays: [['replay-zz-777', 65, 'raté']] })), erreurs: [] } }));
  return f;
}
const faux = () => { const envois = []; return { envois, envoyer: async (m) => { envois.push(m); return { envoye: true }; } }; };

test('le chemin par défaut est le relevé de la nuit, dans _workshop/alertes', () => {
  assert.equal(FICHIER_ALERTE_GESTES, path.join(os.homedir(), 'workspace/starshipcoder/_workshop/alertes/easyway-gestes.json'));
});

test('une nouvelle clé envoie une fois ; la même clé ne renvoie pas ; une autre clé renvoie', async () => {
  const f = fauxReleve('a.json', ['baisse:Créer une tournée:9.9.9']);
  const { envois, envoyer } = faux();
  const v = veilleurGestes({ envoyer, fichier: f, maintenant: () => new Date('2026-11-23T08:00:00Z') });
  await v();
  assert.equal(envois.length, 1);
  assert.equal(envois[0].titre, 'Easy Way : un geste baisse');
  assert.equal(envois[0].texte, 'Easy Way : Créer une tournée en baisse depuis la 9.9.9 (6 bloqués sur 10)');
  await v();
  await v();
  assert.equal(envois.length, 1, 'la même clé ne sonne plus');
  fauxReleve('a.json', ['baisse:Créer une tournée:9.9.9', 'erreur:Importer des contacts:import raté']);
  await v();
  assert.equal(envois.length, 2);
});

test('la notification ne porte ni rang ni replay', async () => {
  const f = fauxReleve('b.json', ['baisse:Créer une tournée:9.9.9']);
  const { envois, envoyer } = faux();
  await veilleurGestes({ envoyer, fichier: f, maintenant: () => new Date('2026-11-23T08:00:00Z') })();
  const tout = JSON.stringify(envois);
  assert.doesNotMatch(tout, /4242|4343|replay-zz-777|rang|replay/i);
  assert.ok(!('rangs' in (lireAlerteGestes(f) ?? {})) && !('detail' in (lireAlerteGestes(f) ?? {})));
});

test('un fichier absent ou illisible ne fait rien, sans planter', async () => {
  const { envois, envoyer } = faux();
  const absent = path.join(dossier, 'absent.json');
  assert.equal(lireAlerteGestes(absent), null);
  await veilleurGestes({ envoyer, fichier: absent })();
  const casse = path.join(dossier, 'casse.json');
  writeFileSync(casse, '{ pas du json');
  assert.equal(lireAlerteGestes(casse), null);
  await veilleurGestes({ envoyer, fichier: casse })();
  writeFileSync(casse, JSON.stringify({ au: '2026-11-22', ligne: 'x', alertes: 'pas une liste' }));
  await veilleurGestes({ envoyer, fichier: casse })();
  assert.equal(envois.length, 0);
});

test('aucune alerte : rien ne sonne ; un relevé ancien au démarrage ne sonne pas ; notifications coupées : rien', async () => {
  const { envois, envoyer } = faux();
  await veilleurGestes({ envoyer, fichier: fauxReleve('c.json', []) })();
  const vieux = fauxReleve('d.json', ['baisse:Valider un arrêt:toutes'], '2026-11-10');
  await veilleurGestes({ envoyer, fichier: vieux, maintenant: () => new Date('2026-11-23T08:00:00Z') })();
  const coupe = veilleurGestes({ envoyer, fichier: fauxReleve('e.json', ['baisse:Valider un arrêt:toutes']), maintenant: () => new Date('2026-11-23T08:00:00Z') });
  await coupe({ actif: false });
  await coupe();
  assert.equal(envois.length, 0, 'une clé vue pendant la coupure ne sonne pas après');
});

test('9 h : la ligne va aux « Attention » si l’alerte date d’hier, pas sinon', () => {
  const f = fauxReleve('f.json', ['baisse:Créer une tournée:9.9.9'], '2026-11-22');
  const neuf = new Date('2026-11-23T08:00:00Z');
  assert.equal(ligneGestesDHier(f, neuf), 'Easy Way : Créer une tournée en baisse depuis la 9.9.9 (6 bloqués sur 10)');
  assert.equal(ligneGestesDHier(f, new Date('2026-11-24T08:00:00Z')), '');
  assert.equal(ligneGestesDHier(fauxReleve('g.json', [], '2026-11-22'), neuf), '');
  assert.equal(ligneGestesDHier(path.join(dossier, 'absent.json'), neuf), '');
});
