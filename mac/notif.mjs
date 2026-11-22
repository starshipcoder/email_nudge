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

const TYPES = { essai_j2: 'fin d’essai', resiliation: 'résiliation', essai_annule: 'essai annulé', bug_corrige: 'bug corrigé',
  campagne_relance: 'relance de campagne', onboarding: 'onboarding', libre: 'e-mail' };

// Le texte, sans adresse ni nom : « 2 actions à relire : essai annulé (it), résiliation (de) ».
export function texteActions(actions) {
  const n = actions.length;
  const detail = actions.slice(0, 5).map((a) => `${TYPES[a.type] ?? 'action'}${a.langue ? ` (${a.langue})` : ''}`).join(', ');
  return `${n} action${n > 1 ? 's' : ''} à relire : ${detail}${n > 5 ? '…' : ''}`;
}
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
  let vuesActions = null; let vuesReponses = null; let enEchec = false;
  return async ({ actions = [], reponses = [], echec = null, actif = true }) => {
    const nouvelles = vuesActions ? actions.filter((a) => !vuesActions.has(a.id)) : [];
    const nouvellesRep = vuesReponses ? reponses.filter((m) => !vuesReponses.has(m.id)) : [];
    vuesActions = new Set(actions.map((a) => a.id));
    vuesReponses = new Set(reponses.map((m) => m.id));
    const envoyes = [];
    if (!actif) { enEchec = Boolean(echec); return envoyes; }
    if (echec && !enEchec) envoyes.push(await envoyer({ titre: 'Iris CRM : problème', texte: echec, priorite: 'high', tags: 'warning' }));
    enEchec = Boolean(echec);
    if (nouvelles.length) envoyes.push(await envoyer({ titre: 'Iris CRM', texte: texteActions(nouvelles) }));
    if (nouvellesRep.length) envoyes.push(await envoyer({ titre: 'Iris CRM : réponse', texte: texteReponses(nouvellesRep.length), priorite: 'high', tags: 'speech_balloon' }));
    return envoyes;
  };
}
