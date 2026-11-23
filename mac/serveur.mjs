// La page de suivi des utilisateurs, servie sur le Mac seulement (127.0.0.1).
// Usage : node mac/serveur.mjs [--port 4810]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFirestore } from './firestore.mjs';
import { filtrer, suivi } from './suivi.mjs';
import { cleTrousseau, porteEnvoi, resendReel, revenueCatReel } from './envoi.mjs';
import { faitsDesFiches, lireFaits, preparer, tourneesPar } from './preparer.mjs';
import { campagnes } from './campagnes.mjs';
import { bugs, retoursSentry } from './bugs.mjs';
import { versionsEnVente } from './versions.mjs';
import { brouillonAvecTraduction, dossierDe, fermerSources, ouvrirSources, resumer } from './dossier.mjs';
import { brouillonEssaiAnnule } from './brouillons.mjs';
import { direSource, langueDePersonne } from './langues.mjs';
import { veilleur } from './notif.mjs';
import { preparerAvis } from './avis.mjs';
import { relireLivraisons, resendLecture } from './livraison.mjs';
import { envoyerNtfy } from './notif.mjs';
import { personneDe } from './dossier.mjs';
import { cleUtilisateur } from './envoi.mjs';
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
    // Les événements RevenueCat de la base Mixpanel (jusqu'à la veille), plus les annulations des fiches Firebase, posées en
    // temps réel par le webhook et confirmées chez RevenueCat (EW-55) : un départ se voit à la passe qui suit.
    let parFiche = [];
    let lectures = 0; let echecs = 0; let raison = null;
    const lire = revenueCatReel();
    const lireCompte = async (rc) => { lectures += 1; try { return await lire(rc); } catch (e) { echecs += 1; raison ??= String(e?.message ?? e).slice(0, 80); throw e; } };
    try {
      parFiche = await faitsDesFiches(await db.lister('users', ['revenuecat_id', 'churned_at']), lireCompte, new Date());
      if (lectures) console.log('fiches', JSON.stringify({ annulees_7j: lectures, revenuecat_en_echec: echecs, raison, departs: parFiche.length }));
    }
    catch (e) { console.error('fiches', e.message); }
    const faits = [...lireFaits(lecteur, Date.now() - 30 * 86400000), ...parFiche];
    const sources = await ouvrirSources();
    try {
      const dossierPour = (rc, user = null) => (rc ? dossierDe({ rc, sources, maintenant: new Date(), user }) : null);
      // Une base de plus d'un jour et demi : les textes n'affirment rien sur l'usage sans relecture (audit du 22/11).
      const enRetard = !sources.fin || Date.now() - sources.fin * 1000 > 36 * 3600000;
      const r = await preparer({ db, faits, tournees: tourneesPar(lecteur, carte), maintenant: new Date(), dossierPour, enRetard });
      return { ...r, par_fiche: parFiche.length, base_jusqu_a: sources.fin ? new Date(sources.fin * 1000).toISOString() : null, base_en_retard: enRetard };
    } finally { fermerSources(sources); }
  } finally {
    base.close();
    liens?.close();
  }
}

// Le texte de 9 h : les actions, les réponses à lire, et ce qui ne va pas (une passe en échec ne se tait plus).
export function texteNotification(n, reponses = 0, alerte = '') {
  const parts = [n === 0 ? 'Aucune action ce matin.' : `${n} action${n > 1 ? 's' : ''} ${n > 1 ? 'restent' : 'reste'} à faire.`];
  if (reponses) parts.push(`${reponses} réponse${reponses > 1 ? 's' : ''} à lire.`);
  if (alerte) parts.push(`Attention : ${alerte}.`);
  // Ni guillemet ni barre oblique inverse : le texte passe dans une chaîne AppleScript.
  return parts.join(' ').replace(/["\\]/g, '').slice(0, 240);
}

export function notifier(n, reponses = 0, alerte = '') {
  execFile('osascript', ['-e', `display notification "${texteNotification(n, reponses, alerte)}" with title "Iris CRM" sound name "default"`]);
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

// Le dossier d'un inscrit, lu sur les sources du Mac ; null sans identifiant RevenueCat ou sans base.
export async function lireDossier(user) {
  if (!user?.revenuecat_id) return null;
  const sources = await ouvrirSources();
  try { return sources.mixpanel ? dossierDe({ rc: user.revenuecat_id, sources, maintenant: new Date(), user }) : null; } finally { fermerSources(sources); }
}

export function application(s, { port, porte = null, preparerMaintenant = null, camp = null, bg = null, db = null, dossierDe: lire = lireDossier }) {
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
        // Les 50 plus récents par défaut (fondateur, 22/11) ; « tout » les affiche tous. La recherche porte toujours sur tous.
        const limite = url.searchParams.get('tout') === '1' ? 5000 : 50;
        return json(res, 200, { total: tous.length, lignes: lignes.slice(0, limite), trouves: lignes.length });
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
      if (route === 'GET /api/dossier') {
        if (!db) return json(res, 503, { erreur: 'Base absente.' });
        const u = await db.lire('users', url.searchParams.get('id') ?? '');
        const d = await lire(u);
        const choix = u ? (await db.lire('crm_fiches', cleUtilisateur(u.id)))?.langue ?? null : null;
        const l = langueDePersonne({ locale: u?.locale, pays: d?.pays, choix });
        return json(res, 200, { resume: d ? resumer(d) : null, rc: d?.rc ?? null, langue: { ...l, texte: direSource(l), choix } });
      }
      if (route === 'POST /api/rebrouillon') {
        if (!db) return json(res, 503, { erreur: 'Base absente.' });
        const { id } = await lireCorps(req);
        const a = await db.lire('crm_actions', String(id ?? ''));
        if (!a || !['resiliation', 'essai_annule'].includes(a.type) || !['prete', 'reportee'].includes(a.statut)) throw new Error('Seule une résiliation ou un essai annulé encore ouvert se refait.');
        const d = await lire(await db.lire('users', a.user_id));
        if (!d) throw new Error('Pas de dossier : identifiant RevenueCat ou base Mixpanel absents.');
        const { signature } = (await db.lire('crm_reglages', 'general')) ?? {};
        if (!signature) throw new Error('Régler la signature d’abord.');
        const u = await db.lire('users', a.user_id);
        const l = langueDePersonne({ locale: u?.locale, pays: d.pays, choix: (await db.lire('crm_fiches', cleUtilisateur(a.user_id)))?.langue });
        const { sujet, corps, traduction_fr } = a.type === 'essai_annule' ? brouillonEssaiAnnule(d, l.langue, signature) : brouillonAvecTraduction(d, l.langue, signature);
        await db.ecrire('crm_actions', a.id, { sujet, corps, traduction_fr: traduction_fr ?? null, langue: l.langue, langue_source: l.source,
          a_retraduire: false, variante: 'dossier', resume: resumer(d), maj_le: new Date() });
        return json(res, 200, await db.lire('crm_actions', a.id));
      }
      if (route === 'POST /api/langue') {
        const { id, langue } = await lireCorps(req);
        return json(res, 200, { ok: await s.choisirLangue(String(id ?? ''), langue ? String(langue) : null) });
      }
      if (route === 'GET /api/desinscrit') {
        const id = url.searchParams.get('id') ?? '';
        const f = db ? (await db.lire('crm_fiches', cleUtilisateur(id))) ?? {} : {};
        return json(res, 200, { desinscrit: await s.desinscrit(id), plainte: f.raison_desinscription === 'plainte', rebond: Boolean(f.adresse_invalide) });
      }
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
      if (route === 'GET /api/aujourdhui') return json(res, 200, { actions: await s.aujourdhui(), reponses: await s.reponses() });
      if (route === 'POST /api/reponse-lue') return json(res, 200, { ok: await s.reponseLue((await lireCorps(req)).id) });
      if (route === 'GET /api/sante') return json(res, 200, db ? (await db.lire('crm_sante', 'passe')) ?? {} : {});
      if (route === 'GET /api/action') {
        const a = await s.action(url.searchParams.get('id') ?? '');
        return a ? json(res, 200, a) : json(res, 404, { erreur: 'Action introuvable.' });
      }
      if (route === 'POST /api/action') {
        const { id, op, sujet, corps } = await lireCorps(req);
        if (op === 'texte') return json(res, 200, await s.modifierTexte(id, sujet, corps));
        if (op === 'traduction') return json(res, 200, await s.modifierTraduction(id, sujet, corps));
        if (op === 'verifie') return json(res, 200, await s.verifier(id));
        return json(res, 200, await s.traiterAction(id, op));
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
  const paysPour = async (rc) => (await lireDossier({ revenuecat_id: rc }))?.pays ?? null;
  const bg = bugs(db, { lireRetours: retoursSentry(), lireVersions, paysPour });
  // Après chaque passe, ce qui est nouveau sonne sur le téléphone par ntfy (INT-EW-72), sans donnée d'utilisateur.
  const veille = veilleur();
  const prevenir = async (echec = null, orphelines = null) => {
    try {
      const { notif_telephone: actif = true } = (await db.lire('crm_reglages', 'general')) ?? {};
      await veille({ actions: await s.aujourdhui(), reponses: await s.reponses(), orphelines, echec, actif: actif !== false });
    } catch (e) { console.error('ntfy', e.message); }
  };
  // Chaque passe laisse son état dans crm_sante/passe : la page l'affiche en haut, la notification de 9 h le dit.
  const preparerMaintenant = async () => {
    const le = new Date();
    try {
      const r = { ...(await passeDuMac(db)), relances: await camp.relances() };
      const problemes = [];
      if (r.erreurs) problemes.push(`${r.erreurs} action(s) non créée(s)`);
      if (r.raison) problemes.push(r.raison);
      if (r.base_en_retard) problemes.push('base Mixpanel en retard');
      // Les retours de livraison (INT-EW-76) : rebonds et plaintes, relus chez Resend ; une plainte sonne tout de suite.
      try {
        const l = await relireLivraisons({ db, lireEmail: resendLecture({ cle: () => cleTrousseau('easyway-crm-resend') }) });
        r.livraison = { lus: l.lus, rebonds: l.rebonds.length, plaintes: l.plaintes.length };
        if (l.erreur) problemes.push(`retours de Resend illisibles (${l.erreur})`);
        const { notif_telephone: actif = true } = (await db.lire('crm_reglages', 'general')) ?? {};
        if (actif !== false && l.plaintes.length) await envoyerNtfy({ titre: 'Iris CRM : plainte', texte: `${l.plaintes.length} plainte(s) pour courrier indésirable : la personne est désinscrite. À lire dans le journal.`, priorite: 'high', tags: 'rotating_light' }).catch(() => {});
        if (actif !== false && l.rebonds.length) await envoyerNtfy({ titre: 'Iris CRM : rebond', texte: `${l.rebonds.length} e-mail(s) rebondi(s) : l'adresse ne reçoit pas, plus d'envoi.`, tags: 'leftwards_arrow_with_hook' }).catch(() => {});
      } catch (e) { problemes.push(`retours de Resend : ${e.message}`); }
      // La demande d'avis (EW-56) : revenue dans l'app depuis le « bug corrigé », d'après la base Mixpanel du Mac.
      try {
        const sources = await ouvrirSources();
        try {
          const revenuDepuis = async (rc, ms) => {
            if (!sources.mixpanel) return null;
            const p = personneDe(sources, rc);
            if (p === rc && !sources.ids?.has(rc)) return null;
            return Boolean(sources.mixpanel.prepare(`SELECT 1 FROM propres WHERE utilisateur = ? AND a_exclure = '' AND temps > ? AND nom NOT LIKE 'rc\\_%' ESCAPE '\\' LIMIT 1`).get(p, Math.floor(ms / 1000)));
          };
          r.avis = (await preparerAvis({ db, revenuDepuis })).creees;
        } finally { fermerSources(sources); }
      } catch (e) { r.avis = `erreur : ${e.message}`; problemes.push(`demande d'avis : ${e.message}`); }
      try {
        const b = await bg.preparer(); r.bugs = b.creees;
        if (b.erreurs) problemes.push(`${b.erreurs} bug(s) corrigé(s) non créé(s)`);
        r.versions = Object.fromEntries(Object.entries(b.versions).map(([k, v]) => [k, v.version ?? v.erreur]));
      } catch (e) { r.bugs = `erreur : ${e.message}`; problemes.push(`bugs : ${e.message}`); }
      await db.ecrire('crm_sante', 'passe', { le, ok: !problemes.length, problemes, base_jusqu_a: r.base_jusqu_a ?? null }).catch(() => {});
      // Une base en retard se voit sur la page ; seul ce qui empêche le travail sonne.
      await prevenir(problemes.filter((p) => p !== 'base Mixpanel en retard').join(', ') || null, r.sans_inscrit ?? null);
      return r;
    } catch (erreur) {
      await db.ecrire('crm_sante', 'passe', { le, ok: false, problemes: [`la passe a échoué : ${String(erreur?.message ?? erreur).slice(0, 200)}`] }).catch(() => {});
      await prevenir('la passe a échoué');
      throw erreur;
    }
  };
  http.createServer(application(s, { port, porte, preparerMaintenant, camp, bg, db })).listen(port, '127.0.0.1', () => {
    console.log(`Iris CRM : http://localhost:${port}`);
  });
  // La clé Resend sait-elle lire l'état des e-mails (INT-EW-76) ? Une lecture de la liste, qui ne crée rien ; le code seul au journal.
  cleTrousseau('easyway-crm-resend').then((cle) => fetch('https://api.resend.com/emails?limit=1', { headers: { Authorization: `Bearer ${cle}` } }))
    .then(async (r) => console.log('resend lecture', r.status, r.ok ? '' : (await r.text()).slice(0, 120))).catch((e) => console.error('resend lecture', e.message));
  // La liste des inscrits se charge d'avance : le premier clic sur Utilisateurs n'attend pas.
  s.utilisateurs().catch((e) => console.error('inscrits', e.message));
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
    try {
      const sante = (await db.lire('crm_sante', 'passe')) ?? {};
      const vieille = !sante.le || Date.now() - new Date(sante.le).getTime() > 2 * 3600000;
      const alerte = vieille ? 'pas de passe depuis plus de 2 h' : sante.ok === false ? (sante.problemes ?? []).join(', ') : '';
      notifier((await s.aujourdhui()).length, (await s.reponses()).length, alerte);
    } catch (e) { notifier(0, 0, `Iris CRM ne lit plus sa base : ${e.message}`); }
  }, 60 * 1000);
}
