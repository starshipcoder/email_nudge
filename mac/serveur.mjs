// La page de suivi des utilisateurs, servie sur le Mac seulement (127.0.0.1).
// Usage : node mac/serveur.mjs [--port 4810]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFirestore } from './firestore.mjs';
import { filtrer, suivi } from './suivi.mjs';
import { porteEnvoi, resendReel, revenueCatReel } from './envoi.mjs';
import { lireFaits, preparer, tourneesPar } from './preparer.mjs';
import { campagnes } from './campagnes.mjs';
import { bugs, retoursSentry } from './bugs.mjs';
import { versionsEnVente } from './versions.mjs';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';

const BASE_MIXPANEL = path.join(os.homedir(), '.local/share/starshipcoder/mixpanel/easyway.sqlite');
const LIENS_RC = path.join(os.homedir(), '.local/share/starshipcoder/mixpanel/easyway-liens-revenuecat.sqlite');

// Une passe de préparation : la base Mixpanel du Mac en lecture seule, puis les actions dans Firestore.
export async function passeDuMac(db) {
  if (!existsSync(BASE_MIXPANEL)) return { creees: 0, expirees: 0, raison: 'base Mixpanel absente' };
  const { DatabaseSync } = await import('node:sqlite');
  const base = new DatabaseSync(BASE_MIXPANEL, { readOnly: true });
  const liens = existsSync(LIENS_RC) ? new DatabaseSync(LIENS_RC, { readOnly: true }) : null;
  try {
    const lecteur = { all: (sql, ...p) => base.prepare(sql).all(...p) };
    const carte = new Map(liens ? liens.prepare('SELECT abonne, personne FROM liens').all().map((r) => [r.abonne, r.personne]) : []);
    const faits = lireFaits(lecteur, Date.now() - 30 * 86400000);
    return await preparer({ db, faits, tournees: tourneesPar(lecteur, carte), maintenant: new Date() });
  } finally {
    base.close();
    liens?.close();
  }
}

export function notifier(n) {
  const texte = n === 0 ? 'Aucune action ce matin.' : `${n} action${n > 1 ? 's' : ''} ${n > 1 ? 'restent' : 'reste'} à faire.`;
  execFile('osascript', ['-e', `display notification "${texte}" with title "Suivi Easy Way" sound name "default"`]);
}

const ICI = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const FICHIERS = new Set(['/index.html', '/app.js', '/style.css']);

// Seules les requêtes adressées à localhost passent (contre une page web qui viserait le Mac par un autre nom).
export function hoteAutorise(hote, port) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(String(hote ?? ''));
}

// Une écriture doit venir de la page elle-même.
export function ecritureAutorisee(req, port) {
  const origine = req.headers.origin;
  return req.headers['x-crm'] === '1' && (!origine || hoteAutorise(origine.replace(/^http:\/\//, ''), port));
}

function json(res, code, corps) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corps));
}

async function lireCorps(req) {
  let texte = '';
  for await (const morceau of req) {
    texte += morceau;
    if (texte.length > 20000) throw new Error('Requête trop longue.');
  }
  return texte ? JSON.parse(texte) : {};
}

export function application(s, { port, porte = null, preparerMaintenant = null, camp = null, bg = null, db = null }) {
  return async (req, res) => {
    try {
      if (!hoteAutorise(req.headers.host, port)) return json(res, 403, { erreur: 'Hôte refusé.' });
      const url = new URL(req.url, `http://localhost:${port}`);
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const nom = url.pathname === '/' ? '/index.html' : url.pathname;
        if (!FICHIERS.has(nom)) return json(res, 404, { erreur: 'Introuvable.' });
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(nom)], 'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
        return res.end(await readFile(path.join(ICI, 'web', nom.slice(1))));
      }
      if (req.method === 'POST' && !ecritureAutorisee(req, port)) return json(res, 403, { erreur: 'Écriture refusée.' });
      const route = `${req.method} ${url.pathname}`;
      if (route === 'GET /api/utilisateurs') {
        const tous = await s.utilisateurs({ frais: url.searchParams.get('frais') === '1' });
        const lignes = filtrer(tous, { q: url.searchParams.get('q') ?? '', filtre: url.searchParams.get('filtre') ?? '' });
        return json(res, 200, { total: tous.length, lignes: lignes.slice(0, 300), trouves: lignes.length });
      }
      if (route === 'GET /api/fiche') {
        const f = await s.fiche(url.searchParams.get('id') ?? '');
        return f ? json(res, 200, f) : json(res, 404, { erreur: 'Inscrit introuvable.' });
      }
      if (route === 'GET /api/fil') return json(res, 200, { lignes: await s.fil(url.searchParams.get('id') ?? '') });
      if (route === 'POST /api/message') {
        const { id, sens, source, extrait } = await lireCorps(req);
        return json(res, 200, { ok: await s.noterMessage(String(id ?? ''), { sens, source, extrait }) });
      }
      if (route === 'POST /api/repondu') {
        const { id } = await lireCorps(req);
        return json(res, 200, { ok: await s.aRepondu(String(id ?? '')) });
      }
      if (route === 'GET /api/desinscrit') return json(res, 200, { desinscrit: await s.desinscrit(url.searchParams.get('id') ?? '') });
      if (route === 'POST /api/desinscrire') {
        const { id } = await lireCorps(req);
        return json(res, 200, { desinscrit: await s.desinscrire(id) });
      }
      if (route === 'POST /api/envoyer') {
        if (!porte) return json(res, 503, { erreur: 'Porte d’envoi absente.' });
        const { actionId, canal } = await lireCorps(req);
        const options = { canal: canal === 'test_moi' ? 'test_moi' : 'email' };
        return json(res, 200, camp ? await camp.envoyerUne(String(actionId ?? ''), options) : await porte.envoyerAction(String(actionId ?? ''), options));
      }
      if (route === 'POST /api/prenom') {
        const { id, prenom } = await lireCorps(req);
        return json(res, 200, { prenom: await s.changerPrenom(id, prenom) });
      }
      if (route === 'GET /api/reglages') return json(res, 200, await s.reglages());
      if (route === 'POST /api/reglages') {
        const { cle, valeur } = await lireCorps(req);
        return json(res, 200, await s.changerReglage(cle, valeur));
      }
      if (route === 'GET /api/journal') return json(res, 200, { lignes: await s.journal() });
      if (route === 'GET /api/aujourdhui') return json(res, 200, { actions: await s.aujourdhui() });
      if (route === 'GET /api/action') {
        const a = await s.action(url.searchParams.get('id') ?? '');
        return a ? json(res, 200, a) : json(res, 404, { erreur: 'Action introuvable.' });
      }
      if (route === 'POST /api/action') {
        const { id, op, sujet, corps } = await lireCorps(req);
        return json(res, 200, op === 'texte' ? await s.modifierTexte(id, sujet, corps) : await s.traiterAction(id, op));
      }
      if (route.endsWith('/api/campagnes') || route.includes('/api/campagne')) {
        if (!camp) return json(res, 503, { erreur: 'Campagnes absentes.' });
        const id = url.searchParams.get('id') ?? '';
        if (route === 'GET /api/campagnes') return json(res, 200, { campagnes: await camp.liste() });
        if (route === 'GET /api/campagne') return json(res, 200, await camp.une(id));
        if (route === 'GET /api/campagne/apercu') return json(res, 200, { membres: (await camp.apercu(id)).membres });
        if (route === 'POST /api/campagne') {
          const { op, id: cid, champs, userId } = await lireCorps(req);
          const gestes = {
            creer: () => camp.creer(champs ?? {}).then((nouvel) => ({ id: nouvel })),
            modifier: () => camp.modifier(cid, champs ?? {}),
            preparer: () => camp.preparer(cid),
            envoyer: () => camp.envoyer(cid),
            repondu: () => camp.repondu(cid, String(userId ?? '')).then(() => ({ ok: true })),
            clore: () => camp.clore(cid).then(() => ({ ok: true })),
          };
          if (!gestes[op]) return json(res, 400, { erreur: 'Geste inconnu.' });
          return json(res, 200, await gestes[op]());
        }
      }
      if (route === 'GET /api/bugs' || route === 'POST /api/bug') {
        if (!bg) return json(res, 503, { erreur: 'Bugs absents.' });
        if (route === 'POST /api/bug') {
          const { id, titre, version_corrigee, bug_ew } = await lireCorps(req);
          return json(res, 200, await bg.noter(String(id ?? ''), { titre, version_corrigee, bug_ew }));
        }
        const versions = db ? Object.fromEntries((await db.lister('crm_versions')).map((v) => [v.id, v])) : {};
        try { return json(res, 200, { retours: await bg.retours(), versions }); }
        catch (e) { return json(res, 200, { retours: [], versions, erreur: `Sentry ne répond pas : ${e.message}` }); }
      }
      if (route === 'POST /api/preparer') {
        if (!preparerMaintenant) return json(res, 503, { erreur: 'Préparation absente.' });
        return json(res, 200, await preparerMaintenant());
      }
      return json(res, 404, { erreur: 'Introuvable.' });
    } catch (erreur) {
      return json(res, 400, { erreur: erreur.message });
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 4810;
  const db = clientFirestore();
  const porte = porteEnvoi({ db, envoyerResend: resendReel(), lireRevenueCat: revenueCatReel() });
  const s = suivi(db);
  const camp = campagnes(db, { porte });
  // Les versions en vente, lues au plus toutes les 6 h.
  let versionsLues = null; let versionsLe = 0;
  const lireVersions = async () => {
    if (!versionsLues || Date.now() - versionsLe > 6 * 3600 * 1000) { versionsLues = await versionsEnVente(); versionsLe = Date.now(); }
    return versionsLues;
  };
  const bg = bugs(db, { lireRetours: retoursSentry(), lireVersions });
  const preparerMaintenant = async () => {
    const r = { ...(await passeDuMac(db)), relances: await camp.relances() };
    try { const b = await bg.preparer(); r.bugs = b.creees; r.versions = Object.fromEntries(Object.entries(b.versions).map(([k, v]) => [k, v.version ?? v.erreur])); }
    catch (e) { r.bugs = `erreur : ${e.message}`; }
    return r;
  };
  http.createServer(application(s, { port, porte, preparerMaintenant, camp, bg, db })).listen(port, '127.0.0.1', () => {
    console.log(`Suivi Easy Way : http://localhost:${port}`);
  });
  // Une passe au démarrage puis toutes les heures ; à 9 h, une notification du Mac avec le nombre d'actions.
  const passe = () => preparerMaintenant().then((r) => console.log('passe', new Date().toISOString(), JSON.stringify(r))).catch((e) => console.error('passe', e.message));
  passe();
  setInterval(passe, 3600 * 1000);
  let dernierJour = '';
  setInterval(async () => {
    const maintenant = new Date();
    const jour = maintenant.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
    const heure = Number(maintenant.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }));
    if (heure !== 9 || jour === dernierJour) return;
    dernierJour = jour;
    try { notifier((await s.aujourdhui()).length); } catch (e) { console.error('notification', e.message); }
  }, 60 * 1000);
}
