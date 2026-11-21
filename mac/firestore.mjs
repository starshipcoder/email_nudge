// Client Firestore REST pour la base `email-nudge`, par la connexion Google du Mac
// (`gcloud auth application-default login`). Le jeton est demandé à gcloud et ne s'affiche jamais.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const PROJET = 'contact-on-map-flutter';
export const BASE = 'email-nudge';
const RACINE = `https://firestore.googleapis.com/v1/projects/${PROJET}/databases/${BASE}/documents`;

export function decoder(champ) {
  if (!champ || typeof champ !== 'object') return null;
  if ('stringValue' in champ) return champ.stringValue;
  if ('booleanValue' in champ) return champ.booleanValue;
  if ('integerValue' in champ) return Number(champ.integerValue);
  if ('doubleValue' in champ) return champ.doubleValue;
  if ('timestampValue' in champ) return champ.timestampValue;
  if ('nullValue' in champ) return null;
  if ('arrayValue' in champ) return (champ.arrayValue.values ?? []).map(decoder);
  if ('mapValue' in champ) return decoderChamps(champ.mapValue.fields ?? {});
  return null;
}

export function decoderChamps(champs) {
  return Object.fromEntries(Object.entries(champs ?? {}).map(([cle, valeur]) => [cle, decoder(valeur)]));
}

export function encoder(valeur) {
  if (valeur === null || valeur === undefined) return { nullValue: null };
  if (typeof valeur === 'boolean') return { booleanValue: valeur };
  if (typeof valeur === 'number') return Number.isInteger(valeur) ? { integerValue: String(valeur) } : { doubleValue: valeur };
  if (valeur instanceof Date) return { timestampValue: valeur.toISOString() };
  if (Array.isArray(valeur)) return { arrayValue: { values: valeur.map(encoder) } };
  if (typeof valeur === 'object') return { mapValue: { fields: encoderChamps(valeur) } };
  return { stringValue: String(valeur) };
}

export function encoderChamps(objet) {
  return Object.fromEntries(Object.entries(objet).map(([cle, valeur]) => [cle, encoder(valeur)]));
}

// Le dernier segment du nom d'un document : son identifiant (pour `users`, c'est l'e-mail).
export const idDe = (nom) => decodeURIComponent(String(nom).split('/').pop());

export function clientFirestore({ fetcher = fetch, jeton = jetonGcloud() } = {}) {
  async function appel(chemin, options = {}) {
    const reponse = await fetcher(`${RACINE}/${chemin}`, {
      ...options,
      headers: { Authorization: `Bearer ${await jeton()}`, 'x-goog-user-project': PROJET, 'Content-Type': 'application/json' },
    });
    if (reponse.status === 404) return null;
    if (!reponse.ok) throw new Error(`Firestore ${reponse.status} sur ${chemin.split('?')[0]}`);
    return reponse.json();
  }
  return {
    async lister(collection, champs) {
      const masque = (champs ?? []).map((c) => `mask.fieldPaths=${encodeURIComponent(c)}`).join('&');
      const docs = [];
      let suite = '';
      do {
        const page = await appel(`${collection}?pageSize=300${masque ? `&${masque}` : ''}${suite ? `&pageToken=${suite}` : ''}`);
        docs.push(...(page?.documents ?? []).map((d) => ({ id: idDe(d.name), ...decoderChamps(d.fields) })));
        suite = page?.nextPageToken ?? '';
      } while (suite);
      return docs;
    },
    async lire(collection, id) {
      const doc = await appel(`${collection}/${encodeURIComponent(id)}`);
      return doc ? { id, ...decoderChamps(doc.fields) } : null;
    },
    // Écrit seulement les champs donnés ; le document est créé s'il n'existe pas.
    async ecrire(collection, id, champs) {
      const masque = Object.keys(champs).map((c) => `updateMask.fieldPaths=${encodeURIComponent(c)}`).join('&');
      await appel(`${collection}/${encodeURIComponent(id)}?${masque}`, { method: 'PATCH', body: JSON.stringify({ fields: encoderChamps(champs) }) });
    },
    // Ajoute un document à identifiant automatique.
    async ajouter(collection, champs) {
      await appel(collection, { method: 'POST', body: JSON.stringify({ fields: encoderChamps(champs) }) });
    },
    // Modifie un document qui doit déjà exister (jamais de création).
    async modifierExistant(collection, id, champs) {
      const masque = Object.keys(champs).map((c) => `updateMask.fieldPaths=${encodeURIComponent(c)}`).join('&');
      await appel(`${collection}/${encodeURIComponent(id)}?${masque}&currentDocument.exists=true`, { method: 'PATCH', body: JSON.stringify({ fields: encoderChamps(champs) }) });
    },
  };
}

export function jetonGcloud({ executer = run, maintenant = () => Date.now() } = {}) {
  let valeur = null;
  let jusqua = 0;
  return async () => {
    if (!valeur || maintenant() > jusqua) {
      const { stdout } = await executer('gcloud', ['auth', 'application-default', 'print-access-token']);
      valeur = stdout.trim();
      jusqua = maintenant() + 45 * 60 * 1000;
    }
    return valeur;
  };
}
