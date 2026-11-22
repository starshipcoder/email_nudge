// La version d'Easy Way en vente sur chaque store, en lecture seule.
// App Store : l'API publique de recherche d'Apple, sans clé. Google Play : l'API Android Publisher avec le compte de service
// en lecture du trousseau (service play-compte-service) ; elle demande d'ouvrir une modification, jamais validée, supprimée aussitôt.
import { createSign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const BUNDLE = 'com.starshipcoder.contactonmap';
export const PAQUET = 'com.starshipcoder.contactonmap';

// « 7.6.8+812 » ou « 7.6.8 (812) » → [7, 6, 8].
export const partiesVersion = (v) => String(v ?? '').trim().split(/[+\s(]/)[0].split('.').map((x) => Number.parseInt(x, 10)).filter((n) => Number.isFinite(n));
export function compareVersions(a, b) {
  const [x, y] = [partiesVersion(a), partiesVersion(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
export const versionValide = (v) => /^\d+(\.\d+){1,3}$/.test(String(v ?? '').trim());

export async function versionAppStore({ fetcher = fetch } = {}) {
  const r = await fetcher(`https://itunes.apple.com/lookup?bundleId=${BUNDLE}&country=fr`);
  if (!r.ok) throw new Error(`App Store ${r.status}`);
  const app = (await r.json()).results?.[0];
  if (!app?.version) throw new Error('App Store : app introuvable');
  return { version: app.version, mise_en_vente_le: app.currentVersionReleaseDate ?? null };
}

// `security -w` rend en hexadécimal une valeur qui contient des retours à la ligne (une clé JSON en a).
export function texteDuTrousseau(sortie) {
  const brut = String(sortie).trim();
  return /^[0-9a-f]+$/i.test(brut) && brut.length % 2 === 0 ? Buffer.from(brut, 'hex').toString('utf8') : brut;
}
const b64 = (x) => Buffer.from(x).toString('base64url');
async function jetonGoogle(fetcher) {
  const { stdout } = await run('security', ['find-generic-password', '-s', 'play-compte-service', '-w']);
  const cle = JSON.parse(texteDuTrousseau(stdout));
  const t = Math.floor(Date.now() / 1000);
  const entete = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: cle.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 600 }))}`;
  const signature = createSign('RSA-SHA256').update(entete).sign(cle.private_key, 'base64url');
  const r = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${entete}.${signature}` }) });
  if (!r.ok) throw new Error(`Google refuse le jeton (${r.status})`);
  return (await r.json()).access_token;
}

// La version de la sortie en production terminée (status completed). Un déploiement progressif (inProgress) n'est
// pas « en vente » : presque personne ne peut encore la recevoir (audit du 22/11).
export function versionDePiste(piste) {
  const sorties = (piste?.releases ?? []).filter((s) => s.status === 'completed');
  const noms = sorties.map((s) => String(s.name ?? '').trim()).filter((n) => /^\d/.test(n));
  if (!noms.length) return null;
  return noms.sort((a, b) => compareVersions(b, a))[0].split(/[\s(]/)[0];
}

export async function versionPlay({ fetcher = fetch, jeton = null } = {}) {
  const acces = jeton ?? await jetonGoogle(fetcher);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUET}/edits`;
  const h = { Authorization: `Bearer ${acces}` };
  const edit = await fetcher(base, { method: 'POST', headers: h });
  if (!edit.ok) throw new Error(`Play ${edit.status}`);
  const { id } = await edit.json();
  try {
    const r = await fetcher(`${base}/${id}/tracks/production`, { headers: h });
    if (!r.ok) throw new Error(`Play ${r.status}`);
    const version = versionDePiste(await r.json());
    if (!version) throw new Error('Play : aucune version en production');
    return { version, mise_en_vente_le: null };
  } finally {
    await fetcher(`${base}/${id}`, { method: 'DELETE', headers: h }).catch(() => {});
  }
}

// Les deux, chacun à part : un store qui ne répond pas n'empêche pas l'autre.
export async function versionsEnVente(lecteurs = { ios: versionAppStore, android: versionPlay }) {
  const sortie = {};
  for (const [plateforme, lire] of Object.entries(lecteurs)) {
    try { sortie[plateforme] = await lire(); } catch (e) { sortie[plateforme] = { erreur: String(e.message).slice(0, 200) }; }
  }
  return sortie;
}
