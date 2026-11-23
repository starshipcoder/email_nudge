// Prévenir le fondateur sur son téléphone, par ntfy (INT-EW-72) : une action à relire, une réponse reçue, une passe en échec.
// Le sujet ntfy.sh est public pour qui devine son nom : il est tiré au hasard, gardé dans un fichier du Mac (lisible par le
// seul fondateur, hors git, jamais affiché), et la notification ne porte aucune donnée d'utilisateur : le type, la langue,
// le nombre. Le détail se lit dans Iris CRM.
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FICHIER_SUJET = path.join(os.homedir(), '.config/iris/ntfy-sujet');
export const SERVEUR = 'https://ntfy.sh';

export function lireSujet(fichier = FICHIER_SUJET) {
  if (!existsSync(fichier)) return null;
  const s = readFileSync(fichier, 'utf8').trim();
  return /^[\w-]{20,64}$/.test(s) ? s : null;
}

// Une fois : tire un sujet de 32 caractères au hasard. Rend le sujet, sans jamais l'écrire ailleurs que dans le fichier.
export function creerSujet(fichier = FICHIER_SUJET) {
  const deja = lireSujet(fichier);
  if (deja) return deja;
  mkdirSync(path.dirname(fichier), { recursive: true, mode: 0o700 });
  const sujet = `iris-${randomBytes(20).toString('base64url')}`;
  writeFileSync(fichier, `${sujet}\n`, { mode: 0o600 });
  chmodSync(fichier, 0o600);
  return sujet;
}

const TYPES = { essai_j2: 'fin d’essai', resiliation: 'résiliation', essai_annule: 'essai annulé', bug_corrige: 'bug corrigé', demande_avis: 'demande d’avis',
  campagne_relance: 'relance de campagne', onboarding: 'onboarding', libre: 'e-mail' };

// Le texte, sans adresse ni nom : « 2 actions à relire : essai annulé (it), résiliation (de) ».
export function texteActions(actions) {
  const n = actions.length;
  const detail = actions.slice(0, 5).map((a) => `${TYPES[a.type] ?? 'action'}${a.langue ? ` (${a.langue})` : ''}`).join(', ');
  return `${n} action${n > 1 ? 's' : ''} à relire : ${detail}${n > 5 ? '…' : ''}`;
}
export const texteOrphelines = (liste) => {
  const n = liste.length; const essais = liste.filter((o) => o.essai).length;
  return `${n} annulation${n > 1 ? 's' : ''} d'une personne absente d'email_nudge (${essais} essai${essais > 1 ? 's' : ''}, ${n - essais} abonnement${n - essais > 1 ? 's' : ''}) : pas d'adresse, rien à envoyer`;
};
export const texteReponses = (n) => `${n} réponse${n > 1 ? 's' : ''} reçue${n > 1 ? 's' : ''}, à lire dans Iris CRM`;

export async function envoyerNtfy({ titre, texte, priorite = 'default', tags = 'envelope', sujet = lireSujet(), fetcher = fetch }) {
  if (!sujet) return { envoye: false, raison: 'pas de sujet ntfy' };
  const r = await fetcher(`${SERVEUR}/${sujet}`, { method: 'POST', body: texte, signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: `=?UTF-8?B?${Buffer.from(titre).toString('base64')}?=`, Priority: priorite, Tags: tags } });
  return r.ok ? { envoye: true } : { envoye: false, raison: `ntfy ${r.status}` };
}

// Ce qui est nouveau depuis la passe d'avant : les actions à relire et les réponses non lues jamais vues, et une passe
// qui échoue (une seule notification par suite d'échecs). Au démarrage, ce qui est déjà là ne sonne pas.
export function veilleur({ envoyer = envoyerNtfy } = {}) {
  let vuesActions = null; let vuesReponses = null; let vuesOrphelines = null; let enEchec = false;
  return async ({ actions = [], reponses = [], orphelines = null, echec = null, actif = true }) => {
    const nouvelles = vuesActions ? actions.filter((a) => !vuesActions.has(a.id)) : [];
    const nouvellesRep = vuesReponses ? reponses.filter((m) => !vuesReponses.has(m.id)) : [];
    // Une passe en échec ne dit rien des annulations : la liste d'avant est gardée.
    const nouvellesOrph = orphelines && vuesOrphelines ? orphelines.filter((o) => !vuesOrphelines.has(o.id)) : [];
    vuesActions = new Set(actions.map((a) => a.id));
    vuesReponses = new Set(reponses.map((m) => m.id));
    if (orphelines) vuesOrphelines = new Set(orphelines.map((o) => o.id));
    const envoyes = [];
    if (!actif) { enEchec = Boolean(echec); return envoyes; }
    if (echec && !enEchec) envoyes.push(await envoyer({ titre: 'Iris CRM : problème', texte: echec, priorite: 'high', tags: 'warning' }));
    enEchec = Boolean(echec);
    if (nouvelles.length) envoyes.push(await envoyer({ titre: 'Iris CRM', texte: texteActions(nouvelles) }));
    if (nouvellesOrph.length) envoyes.push(await envoyer({ titre: 'Iris CRM : annulation sans inscrit', texte: texteOrphelines(nouvellesOrph), tags: 'ghost' }));
    if (nouvellesRep.length) envoyes.push(await envoyer({ titre: 'Iris CRM : réponse', texte: texteReponses(nouvellesRep.length), priorite: 'high', tags: 'speech_balloon' }));
    return envoyes;
  };
}

// L'alerte des gestes d'Easy Way (EW-36) : hephaistos l'écrit chaque nuit (research/scripts/alertes_gestes.py, lancé par
// outils/nuit.mjs), hors git. Iris n'en lit que la ligne courte (des gestes et des nombres) et les clés : jamais le détail,
// où sont les rangs des personnes et les replays.
export const FICHIER_ALERTE_GESTES = path.join(os.homedir(), 'workspace/starshipcoder/_workshop/alertes/easyway-gestes.json');
export const TITRE_GESTES = 'Easy Way : un geste baisse';

// { au, ligne, cles } ; null si le fichier manque ou se lit mal.
export function lireAlerteGestes(fichier = FICHIER_ALERTE_GESTES) {
  try {
    if (!existsSync(fichier)) return null;
    const j = JSON.parse(readFileSync(fichier, 'utf8'));
    if (!j || typeof j.au !== 'string' || typeof j.ligne !== 'string' || !Array.isArray(j.alertes)) return null;
    const cles = j.alertes.map((a) => a?.cle).filter((c) => typeof c === 'string' && c);
    return { au: j.au.slice(0, 10), ligne: j.ligne.replace(/\s+/g, ' ').trim().slice(0, 240), cles };
  } catch { return null; }
}

// Le jour d'avant, à Paris, au format du relevé (2026-11-22).
const veilleParis = (maintenant) => new Date(maintenant.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

// À chaque passe : une clé jamais vue sonne une fois. Un relevé plus vieux que la veille ne sonne pas (une nuit en panne,
// ou Iris qui redémarre sur un ancien fichier) ; ses clés sont gardées comme vues. Coupé, il se tait et garde les clés.
export function veilleurGestes({ envoyer = envoyerNtfy, fichier = FICHIER_ALERTE_GESTES, maintenant = () => new Date() } = {}) {
  const vues = new Set();
  return async ({ actif = true } = {}) => {
    const a = lireAlerteGestes(fichier);
    if (!a) return [];
    const nouvelles = a.cles.filter((c) => !vues.has(c));
    for (const c of a.cles) vues.add(c);
    if (!actif || !nouvelles.length || a.au < veilleParis(maintenant())) return [];
    return [await envoyer({ titre: TITRE_GESTES, texte: a.ligne || 'Easy Way : un geste clé baisse, le détail est sur le Mac.', priorite: 'high', tags: 'chart_with_downwards_trend' })];
  };
}

// Pour la notification de 9 h : la ligne si le relevé date d'hier et porte une alerte, sinon rien.
export function ligneGestesDHier(fichier = FICHIER_ALERTE_GESTES, maintenant = new Date()) {
  const a = lireAlerteGestes(fichier);
  return a && a.cles.length && a.au === veilleParis(maintenant) ? a.ligne : '';
}
