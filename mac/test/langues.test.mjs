import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire, suivi } from '../suivi.mjs';
import { cleUtilisateur, porteEnvoi } from '../envoi.mjs';
import { preparer } from '../preparer.mjs';
import { LANGUES, direSource, langueDePersonne } from '../langues.mjs';
import { MODELES, rendre } from '../modeles.mjs';
import { T, brouillonAvecTraduction } from '../brouillons.mjs';

const T0 = new Date('2026-12-02T10:00:00Z');
const h = (n) => T0.getTime() + n * 3600000;
const essai = (rc, tx) => ({ nom: 'rc_trial_started_event', temps: h(-120), ids: [rc], transaction: tx, fin: new Date(h(40)).toISOString(), type: 'TRIAL', store: 'APP_STORE' });

test('la langue : le choix, puis l’app, puis le pays ; un pays à plusieurs langues est signalé', () => {
  assert.deepEqual(langueDePersonne({ locale: 'de_DE' }), { langue: 'de', source: 'app' });
  assert.deepEqual(langueDePersonne({ locale: '', pays: 'FR' }), { langue: 'fr', source: 'pays', pays: 'FR' });
  assert.deepEqual(langueDePersonne({ pays: 'BE' }), { langue: 'en', source: 'pays ambigu', pays: 'BE' });
  assert.deepEqual(langueDePersonne({ locale: 'nl', pays: 'NL' }), { langue: 'en', source: 'défaut' });
  assert.equal(langueDePersonne({ locale: 'en', pays: 'FR', choix: 'fr' }).langue, 'fr');
  assert.equal(direSource({ langue: 'fr', source: 'pays', pays: 'FR' }), "français, d'après le pays (FR)");
});

test('un inscrit sans langue vu en France reçoit son rappel en français ; vu en Allemagne, en allemand avec la traduction', async () => {
  const db = baseEnMemoire({ users: [{ id: 'a@exemple.fr', revenuecat_id: 'rcA' }, { id: 'b@exemple.de', revenuecat_id: 'rcB' }],
    crm_reglages: [{ id: 'general', signature: 'Prénom' }] });
  const pays = { rcA: 'FR', rcB: 'DE' };
  const dossierPour = (rc) => ({ pays: pays[rc] });
  await preparer({ db, faits: [essai('rcA', 'T1'), essai('rcB', 'T2')], tournees: () => 0, maintenant: T0, dossierPour });
  const actions = await db.lister('crm_actions');
  const a = actions.find((x) => x.user_id === 'a@exemple.fr');
  const b = actions.find((x) => x.user_id === 'b@exemple.de');
  assert.equal(a.langue, 'fr');
  assert.equal(a.langue_source, 'pays');
  assert.equal(a.traduction_fr, undefined);
  assert.equal(b.langue, 'de');
  assert.match(b.corps, /^Hallo,\n\nich hoffe, Easy Way gefällt Ihnen\./);
  assert.match(b.traduction_fr.corps, /^Bonjour,\n\nJ'espère qu'Easy Way vous plaît\./);
});

test('le choix sur la fiche passe avant le pays', async () => {
  const db = baseEnMemoire({ users: [{ id: 'a@exemple.fr', revenuecat_id: 'rcA' }], crm_reglages: [{ id: 'general', signature: 'S' }] });
  await suivi(db).choisirLangue('a@exemple.fr', 'it');
  await preparer({ db, faits: [essai('rcA', 'T1')], tournees: () => 0, maintenant: T0, dossierPour: () => ({ pays: 'FR' }) });
  const [a] = await db.lister('crm_actions');
  assert.equal(a.langue, 'it');
  assert.equal(a.langue_source, 'choix');
  await assert.rejects(suivi(db).choisirLangue('a@exemple.fr', 'nl'), /Langue inconnue/);
});

test('une traduction corrigée bloque l’envoi jusqu’à ce que le texte soit refait ; seul le texte étranger part', async () => {
  const db = baseEnMemoire({
    users: [{ id: 'b@exemple.de', revenuecat_id: 'rcB' }],
    crm_reglages: [{ id: 'general', envois_coupes: false, a_blanc: false, expediteur: 'P <p@exemple.fr>', repondre_a: 'moi@exemple.fr', adresse_test: 't@exemple.fr' }],
    crm_actions: [{ id: 'x', type: 'libre', user_id: 'b@exemple.de', statut: 'prete', langue: 'de', sujet: 'Hallo', corps: 'Guten Tag', traduction_fr: { sujet: 'Bonjour', corps: 'Bonjour' } }],
  });
  const s = suivi(db);
  const envoyes = [];
  const porte = porteEnvoi({ db, maintenant: () => T0, lireRevenueCat: async () => ({}), envoyerResend: async (m) => { envoyes.push(m); return { id: 'r' }; } });
  await s.modifierTraduction('x', 'Bonjour', 'Bonjour, autre texte');
  assert.deepEqual(await porte.envoyerAction('x'), { statut: 'bloquee', raison: 'traduction à refaire' });
  await s.modifierTexte('x', 'Hallo', 'Guten Tag, anderer Text');
  assert.equal((await porte.envoyerAction('x')).statut, 'envoye');
  assert.match(envoyes[0].text, /^Guten Tag, anderer Text/);
  assert.equal(envoyes[0].text, 'Guten Tag, anderer Text', 'tel quel, sans pied STOP');
  assert.doesNotMatch(envoyes[0].text, /Bonjour/);
  assert.equal(db.donnees.crm_fiches.get(cleUtilisateur('b@exemple.de')).user_id, 'b@exemple.de');
});

test('chaque modèle et chaque brouillon existe dans les six langues, sans trou', () => {
  const vars = { jour_fin: 'vendredi', signature: 'S', titre: 't', version: '7.6.9', store: 'y' };
  for (const nom of Object.keys(MODELES)) {
    for (const l of LANGUES) {
      const r = rendre(nom, l, vars);
      assert.ok(r.sujet && !/\{\{/.test(r.corps), `${nom} ${l}`);
    }
  }
  const d = { questionnaire: { raison: 'tooExpensive', texte: '' }, usage: { tournees: 4, premier_jour: '2026-10-01', dernier_jour: '2026-10-20', zones: [], signaux: [{ nom: 'Event-geocoderError' }] } };
  for (const l of LANGUES) {
    assert.ok(T[l], l);
    const b = brouillonAvecTraduction(d, l, 'S');
    assert.equal((b.corps.match(/\?/g) ?? []).length, 1, l);
    if (l !== 'fr') assert.match(b.traduction_fr.corps, /trop cher/);
  }
});

test('le texte court de l’essai annulé existe dans les six langues, une seule question, signé', async () => {
  const { ESSAI_COURT, brouillonEssaiAnnule } = await import('../brouillons.mjs');
  for (const l of LANGUES) {
    const b = brouillonEssaiAnnule({ questionnaire: null }, l, 'Prénom');
    assert.ok(ESSAI_COURT[l], l);
    assert.equal((b.corps.match(/[?]/g) ?? []).length, 1, l);
    assert.match(b.corps, /Prénom$/, l);
    if (l !== 'fr') assert.match(b.traduction_fr.corps, /Qu'est-ce qui ne vous a pas convenu \?/);
  }
});

// Fondateur, 23/11 (Q-EW-68) : le rappel de fin d'essai ne porte pas de lien de désinscription. C'est un e-mail sur le
// paiement ; on se désinscrit depuis la fiche dans Iris (décidé le 22/11). Depuis le 25/11, il ne donne plus non plus le
// chemin du store pour arrêter, ni le mode d'emploi de l'app (fondateur : « on sait pas s'il va vraiment se désabonner »).
test('le rappel de fin d’essai n’a ni lien, ni désinscription, ni STOP, dans les six langues', () => {
  for (const nom of ['essai_j2']) {
    for (const l of LANGUES) {
      const vars = { jour_fin: 'vendredi', signature: 'Signature inventée' };
      const { sujet, corps } = rendre(nom, l, vars);
      const texte = `${sujet}\n${corps}`;
      assert.doesNotMatch(texte, /https?:\/\/|www\./, `${nom} ${l} : un lien`);
      assert.doesNotMatch(texte, /\bSTOP\b/, `${nom} ${l} : un STOP`);
      assert.doesNotMatch(texte, /d[ée]sinscri|unsubscri|abmeld|darse de baja|disiscri|descadastr/i, `${nom} ${l} : une désinscription`);
      assert.doesNotMatch(texte, / > |Google Play|iPhone/, `${nom} ${l} : le chemin pour arrêter`);
    }
  }
});

test('le jour de fin se dit en toutes lettres, avec la préposition de chaque langue, à l’heure de Paris', async () => {
  const { jourFin } = await import('../modeles.mjs');
  const vendredi = '2026-12-04T02:00:00Z'; // 3 h à Paris
  assert.deepEqual(Object.fromEntries(LANGUES.map((l) => [l, jourFin(vendredi, l)])),
    { fr: 'vendredi', en: 'on Friday', de: 'am Freitag', es: 'el viernes', it: 'venerdì', pt: 'na sexta-feira' });
  assert.equal(jourFin('2026-12-05T10:00:00Z', 'pt'), 'no sábado');
  assert.equal(jourFin('2026-12-04T23:30:00Z', 'fr'), 'samedi', 'minuit passé à Paris');
});
