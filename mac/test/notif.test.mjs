import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { creerSujet, envoyerNtfy, lireSujet, texteActions, veilleur } from '../notif.mjs';

test('le sujet se tire une fois, au hasard, dans un fichier lisible par le seul fondateur', () => {
  const f = path.join(mkdtempSync(path.join(os.tmpdir(), 'iris-')), 'sous', 'ntfy-sujet');
  assert.equal(lireSujet(f), null);
  const s = creerSujet(f);
  assert.match(s, /^iris-[\w-]{27}$/);
  assert.equal(creerSujet(f), s, 'pas de nouveau sujet si le fichier existe');
  assert.equal(statSync(f).mode & 0o777, 0o600);
});

test('la notification ne porte ni adresse ni nom : le type, la langue, le nombre', () => {
  const t = texteActions([{ id: 'a', type: 'essai_annule', langue: 'it', user_id: 'x@exemple.fr', corps: 'Bonjour Ana' },
    { id: 'b', type: 'resiliation', langue: 'de' }]);
  assert.equal(t, '2 actions à relire : essai annulé (it), résiliation (de)');
  assert.doesNotMatch(t, /@|Ana/);
});

test('envoi vers ntfy.sh, titre accentué encodé ; sans sujet, rien ne part', async () => {
  const appels = [];
  const fetcher = async (url, o) => { appels.push({ url, o }); return { ok: true }; };
  assert.deepEqual(await envoyerNtfy({ titre: 'Iris CRM : réponse', texte: '1 réponse', sujet: 'iris-abcdefghijklmnopqrstuvwxyz', fetcher }), { envoye: true });
  assert.equal(appels[0].url, 'https://ntfy.sh/iris-abcdefghijklmnopqrstuvwxyz');
  assert.match(appels[0].o.headers.Title, /^=\?UTF-8\?B\?/);
  assert.deepEqual(await envoyerNtfy({ titre: 't', texte: 'x', sujet: null, fetcher }), { envoye: false, raison: 'pas de sujet ntfy' });
});

test('le veilleur : rien au démarrage, puis seulement le nouveau ; une suite d’échecs ne sonne qu’une fois ; coupé, il se tait', async () => {
  const envois = [];
  const v = veilleur({ envoyer: async (m) => { envois.push(m); return { envoye: true }; } });
  await v({ actions: [{ id: 'a', type: 'essai_j2', langue: 'fr' }], reponses: [{ id: 'm1' }] });
  assert.equal(envois.length, 0);
  await v({ actions: [{ id: 'a' }, { id: 'b', type: 'essai_annule', langue: 'en' }], reponses: [{ id: 'm1' }, { id: 'm2' }] });
  assert.deepEqual(envois.map((m) => m.texte), ['1 action à relire : essai annulé (en)', '1 réponse reçue, à lire dans Iris CRM']);
  await v({ actions: [], reponses: [], echec: 'la passe a échoué' });
  await v({ actions: [], reponses: [], echec: 'la passe a échoué' });
  assert.equal(envois.filter((m) => m.priorite === 'high' && /échoué/.test(m.texte)).length, 1);
  await v({ actions: [{ id: 'c', type: 'essai_annule' }], reponses: [], actif: false });
  assert.equal(envois.length, 3);
});
