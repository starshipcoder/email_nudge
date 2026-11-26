import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { cleUtilisateur } from '../envoi.mjs';
import { LIENS_AVIS, TEXTES_AVIS, preparerAvis, texteAvis } from '../avis.mjs';
import { LANGUES } from '../langues.mjs';

const T = new Date('2026-12-20T10:00:00Z');
const j = (n) => new Date(T.getTime() + n * 86400000).toISOString();

function base({ envoyeIlYa = 8, fiche = {}, plateforme = 'ios', langue = 'fr' } = {}) {
  return baseEnMemoire({
    users: [{ id: 'a@exemple.fr', revenuecat_id: 'rcA' }],
    crm_reglages: [{ id: 'general', signature: 'Prénom' }],
    crm_actions: [{ id: 'bug_corrige__x__7.6.9', type: 'bug_corrige', user_id: 'a@exemple.fr', statut: 'envoyee', langue, bug: 'B1' }],
    crm_envois: [{ id: 'bug_corrige__x__7.6.9', statut: 'envoye', le: j(-envoyeIlYa) }],
    crm_bugs: [{ id: 'B1', version_corrigee: '7.6.9', plateforme }],
    crm_fiches: [{ id: cleUtilisateur('a@exemple.fr'), ...fiche }],
  });
}

test('une semaine après un bug corrigé, à qui est revenu dans l’app : une demande d’avis, une seule', async () => {
  const db = base();
  const revenu = async () => true;
  assert.deepEqual(await preparerAvis({ db, revenuDepuis: revenu, maintenant: T }), { creees: 1 });
  assert.deepEqual(await preparerAvis({ db, revenuDepuis: revenu, maintenant: T }), { creees: 0 });
  const [a] = (await db.lister('crm_actions')).filter((x) => x.type === 'demande_avis');
  assert.equal(a.sujet, 'Votre avis sur Easy Way');
  assert.match(a.corps, /Content que la version 7\.6\.9 ait réglé votre problème/);
  assert.ok(a.corps.includes(LIENS_AVIS.ios));
  assert.doesNotMatch(a.corps, /étoile/);
  assert.match(a.corps, /répondez-moi/);
});

test('pas de demande d’avis : trop tôt, trop tard, pas revenu, inconnu, a répondu, désinscrit', async () => {
  const cas = [
    [base({ envoyeIlYa: 3 }), async () => true],
    [base({ envoyeIlYa: 25 }), async () => true],
    [base(), async () => false],
    [base(), async () => null],
    [base({ fiche: { a_repondu_le: j(-2) } }), async () => true],
    [base({ fiche: { desinscrit: true } }), async () => true],
  ];
  for (const [db, revenu] of cas) assert.equal((await preparerAvis({ db, revenuDepuis: revenu, maintenant: T })).creees, 0);
});

test('six langues, jamais « 5 étoiles », le bon store ; plateforme inconnue : les deux liens', () => {
  for (const l of LANGUES) {
    const t = texteAvis({ langue: l, version: '7.6.9', plateforme: 'android', signature: 'S' });
    assert.ok(TEXTES_AVIS[l], l);
    assert.ok(t.corps.includes(LIENS_AVIS.android), l);
    const sansLien = t.corps.replace(/https:\/\/\S+/g, '').replace('7.6.9', '');
    assert.doesNotMatch(sansLien, /\b5\b|★|étoile|\bstars?\b|Stern|estrella|stell|estrela/i, l);
  }
  const deux = texteAvis({ langue: 'fr', version: '7.6.9', plateforme: null, signature: 'S' });
  assert.ok(deux.corps.includes(LIENS_AVIS.ios) && deux.corps.includes(LIENS_AVIS.android));
  assert.match(deux.corps, /sur l’App Store et Google Play/);
});
