import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseEnMemoire } from '../suivi.mjs';
import { cleUtilisateur, porteEnvoi } from '../envoi.mjs';
import { estGros, onboardingsAbandonnes, preparerContacts, questionsDe, texteGros, texteOnboarding } from '../contacter.mjs';
import { LANGUES } from '../langues.mjs';

const T = new Date('2026-12-02T10:00:00Z');
const H = 3600000;
const avant = (heures) => new Date(T.getTime() - heures * H).toISOString();
const SIGNATURE = 'Prénom, créateur d’Easy Way';
const REGLAGES = { id: 'general', signature: SIGNATURE, envois_coupes: false, a_blanc: false, expediteur: 'Easy Way <bonjour@exemple.fr>', repondre_a: 'moi@exemple.fr', adresse_test: 'test@exemple.fr' };

// Un dossier inventé, comme dossierDe le rend : tout ce qui compte pour les questions.
function dossier(plus = {}) {
  const { usage = {}, parcours = {}, ...reste } = plus;
  return {
    rc: 'rcG', personne: 'pG', lie: true, pays: 'FR', questionnaire: null, calcule_le: '2026-12-02',
    abonnement: { formule: 'annuel', essai_le: '2026-09-01', premier_paiement: '2026-09-08', paiements: 1, resilie_le: null },
    a_jour: { base_jusqu_a: avant(10), en_retard: false },
    usage: { metier: 'commercial', premier_jour: '2026-09-01', dernier_jour: '2026-12-01', jours_actifs: 60, tournees: 25,
      semaines: [3, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5], signaux: [{ nom: 'Event-geocoderError', n: 7, resume: 'adresses non trouvées' }],
      zones: [{ zone: 'Tournée : sur la route', n: 300 }, { zone: 'Prospection', n: 40 }], zones_jamais: ['Scanner'], ...usage },
    parcours: { onboarding: { metier: 'commercial', besoins: [], source: 'un fichier Excel', fini: true, abandonne: false },
      imports: [{ source: 'Excel', reussis: 2, contacts: 180, localises: 170, echecs: 1, annules: 0 }],
      tournees: { creees: 26, optimisees: 24, optimisations_ratees: 2, demarrees: 25, arrets_max: 38 }, ...parcours },
    ...reste,
  };
}

test('une personne qui utilise beaucoup l’app est un gros utilisateur ; pas sans données sûres', () => {
  assert.equal(estGros(dossier()), true);
  assert.equal(estGros(dossier({ usage: { semaines: [5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1] } })), false, 'moins de 12 jours actifs sur 4 semaines');
  assert.equal(estGros(dossier({ parcours: { tournees: { creees: 3, optimisees: 3, optimisations_ratees: 0, demarrees: 3, arrets_max: 5 } } })), false, 'moins de 10 tournées');
  assert.equal(estGros(dossier({ lie: false })), false);
  assert.equal(estGros(dossier({ a_jour: { en_retard: true } })), false);
  assert.equal(estGros(null), false);
});

test('3 à 5 questions, chacune appuyée sur un événement de son usage, dans sa langue et en français', () => {
  const q = questionsDe(dossier(), 'en');
  assert.ok(q.length >= 3 && q.length <= 5, `${q.length} questions`);
  for (const x of q) {
    assert.ok(x.appui?.evenement && Number.isInteger(x.appui.n) && x.appui.n > 0, `appui de ${x.id}`);
    assert.ok(x.texte && x.texte_fr && x.texte !== x.texte_fr, `deux langues pour ${x.id}`);
  }
  const ids = q.map((x) => x.id);
  assert.deepEqual(ids.slice(0, 3), ['tournees', 'import_rate', 'optimisation_ratee']);
  assert.match(q[0].texte_fr, /25 tournées, jusqu'à 38 arrêts/);
  assert.equal(q[0].appui.evenement, 'Action-startRoute');
  assert.equal(q.find((x) => x.id === 'import_rate').appui.evenement, 'Event-ImportExcelError');
  // Toutes les langues de l'app ont leurs questions.
  for (const lg of LANGUES) assert.ok(questionsDe(dossier(), lg).every((x) => x.texte && !/undefined|NaN/.test(x.texte)), lg);
});

test('une question ne s’invente pas : sans prospection, sans import, sans erreur, elle n’apparaît pas', () => {
  const calme = dossier({ usage: { signaux: [], zones: [{ zone: 'Tournée : sur la route', n: 300 }], zones_jamais: ['Prospection'] },
    parcours: { imports: [], tournees: { creees: 12, optimisees: 12, optimisations_ratees: 0, demarrees: 12, arrets_max: null } } });
  const q = questionsDe(calme, 'fr');
  assert.deepEqual(q.map((x) => x.id), ['tournees', 'prospection_jamais', 'regulier']);
  assert.doesNotMatch(q[0].texte, /arrêts/);
  assert.equal(q[1].appui.evenement, 'aucun événement de la zone Prospection');
  assert.equal(questionsDe(dossier({ lie: false }), 'fr').length, 0);
});

// Fondateur, 26/11 : une seule question ouverte, la même pour tous ; les questions tirées de l'usage restent sur l'action,
// pour la relance du fondateur, et ne sont plus dans l'e-mail (brique interroger-un-utilisateur).
test('l’e-mail au gros utilisateur : une seule question ouverte, dans sa langue', () => {
  const t = texteGros(questionsDe(dossier(), 'fr'), 'fr', SIGNATURE);
  assert.equal(t.sujet, 'Comment ça se passe avec Easy Way ?');
  assert.equal(t.corps, `Bonjour,\n\nVous faites beaucoup de tournées avec Easy Way. Comment ça se passe, de votre côté ?\n\n${SIGNATURE}`);
  assert.equal(t.traduction_fr, undefined);
  const de = texteGros(questionsDe(dossier(), 'de'), 'de', SIGNATURE);
  assert.match(de.corps, /^Hallo,/);
  assert.equal(de.traduction_fr.corps, t.corps);
  for (const lg of LANGUES) {
    const x = texteGros([], lg, SIGNATURE);
    assert.equal((x.corps.match(/[?？]/g) ?? []).length, 1, lg);
    assert.ok(x.corps.endsWith(SIGNATURE), lg);
    assert.ok(texteOnboarding(lg, SIGNATURE).corps.endsWith(SIGNATURE), lg);
  }
});

const inscrit = (id, plus = {}) => ({ id, revenuecat_id: `rc-${id}`, locale: 'fr', created_at: avant(48), onboarding_complete: false, ...plus });

test('un onboarding commencé et non fini depuis plus d’un jour (et moins de 14) donne une relance ; pas les autres', () => {
  const users = [
    inscrit('a@exemple.fr'),
    inscrit('b@exemple.fr', { created_at: avant(10) }),
    inscrit('c@exemple.fr', { onboarding_complete: true }),
    inscrit('d@exemple.fr', { created_at: avant(24 * 20) }),
    inscrit('e@exemple.fr', { trial_active: true }),
    inscrit('f@exemple.fr', { subscription_active: true }),
    inscrit('g@exemple.fr', { created_at: null }),
  ];
  assert.deepEqual(onboardingsAbandonnes(users, T).map((u) => u.id), ['a@exemple.fr']);
});

test('la passe crée la relance d’onboarding une seule fois, et rien pour qui l’a fini d’après Mixpanel ou s’est désinscrit', async () => {
  const db = baseEnMemoire({
    crm_reglages: [REGLAGES],
    users: [inscrit('a@exemple.fr', { locale: 'es' }), inscrit('b@exemple.fr'), inscrit('c@exemple.fr')],
    crm_fiches: [{ id: cleUtilisateur('c@exemple.fr'), desinscrit: true }],
  });
  const dossierPour = (rc) => (rc === 'rc-b@exemple.fr' ? dossier({ rc }) : null);
  const r = await preparerContacts({ db, dossierPour, maintenant: T });
  assert.equal(r.onboarding, 1);
  const a = db.donnees.crm_actions.get(`onboarding__${cleUtilisateur('a@exemple.fr')}`);
  assert.equal(a.type, 'onboarding');
  assert.equal(a.statut, 'prete');
  assert.equal(a.langue, 'es');
  assert.match(a.corps, /^Hola/);
  assert.match(a.traduction_fr.corps, /sans aller jusqu'au bout/);
  assert.equal(new Date(a.echeance).getTime(), T.getTime() + 7 * 24 * H);
  // Une seule fois, même si l'action a été envoyée, ignorée ou a expiré.
  await db.ecrire('crm_actions', a.id, { statut: 'ignoree' });
  assert.equal((await preparerContacts({ db, dossierPour, maintenant: new Date(T.getTime() + 48 * H) })).onboarding, 0);
});

test('un gros utilisateur reçoit une action « contacter » avec son résumé et ses questions, une seule fois', async () => {
  const db = baseEnMemoire({
    crm_reglages: [REGLAGES],
    users: [
      { id: 'gros@exemple.fr', revenuecat_id: 'rcG', locale: 'fr', onboarding_complete: true, routes_created: 25, last_action_at: avant(20), is_test_user: true },
      { id: 'petit@exemple.fr', revenuecat_id: 'rcP', locale: 'fr', onboarding_complete: true, routes_created: 2, last_action_at: avant(20) },
      { id: 'ancien@exemple.fr', revenuecat_id: 'rcV', locale: 'fr', onboarding_complete: true, routes_created: 40, last_action_at: avant(24 * 40) },
    ],
  });
  const lus = [];
  const dossierPour = (rc) => { lus.push(rc); return dossier({ rc }); };
  const r = await preparerContacts({ db, dossierPour, maintenant: T });
  assert.equal(r.gros, 1);
  // Le dossier, coûteux, ne se lit que pour qui passe le premier tri.
  assert.deepEqual(lus, ['rcG']);
  const a = db.donnees.crm_actions.get(`gros__${cleUtilisateur('gros@exemple.fr')}`);
  assert.equal(a.type, 'gros');
  assert.equal(a.statut, 'prete');
  assert.ok(a.questions.length >= 3);
  assert.ok(a.resume.faits.length > 0);
  // Les questions de l'usage restent sur l'action pour la relance, hors de l'e-mail (fondateur, 26/11).
  assert.ok(a.questions.every((q) => !a.corps.includes(q.texte)));
  assert.equal((await preparerContacts({ db, dossierPour, maintenant: T })).gros, 0);
  assert.deepEqual(lus, ['rcG'], 'déjà contacté : le dossier n’est pas relu');
});

test('sans signature, rien n’est préparé', async () => {
  const db = baseEnMemoire({ crm_reglages: [{ id: 'general' }], users: [inscrit('a@exemple.fr')] });
  assert.deepEqual(await preparerContacts({ db, dossierPour: () => null, maintenant: T }), { onboarding: 0, gros: 0, raison: 'signature à régler' });
});

test('la relance d’onboarding part au clic par la porte, et pas à qui s’est abonné entre-temps', async () => {
  const db = baseEnMemoire({ crm_reglages: [REGLAGES], users: [inscrit('a@exemple.fr'), inscrit('b@exemple.fr')] });
  await preparerContacts({ db, dossierPour: () => null, maintenant: T });
  const envoyes = [];
  const abonnes = { 'rc-a@exemple.fr': { subscriber: { subscriptions: {} } },
    'rc-b@exemple.fr': { subscriber: { subscriptions: { p: { period_type: 'trial', expires_date: new Date(T.getTime() + 72 * H).toISOString() } } } } };
  const porte = porteEnvoi({ db, maintenant: () => T, lireRevenueCat: async (rc) => abonnes[rc],
    envoyerResend: async (message, cle) => { envoyes.push({ message, cle }); return { id: 'r1' }; } });
  const ida = `onboarding__${cleUtilisateur('a@exemple.fr')}`;
  assert.deepEqual(await porte.envoyerAction(ida), { statut: 'envoye' });
  assert.equal(envoyes[0].message.to, 'a@exemple.fr');
  assert.equal(envoyes[0].cle, ida);
  assert.equal((await porte.envoyerAction(ida)).statut, 'bloquee', 'pas deux fois');
  const b = await porte.envoyerAction(`onboarding__${cleUtilisateur('b@exemple.fr')}`);
  assert.deepEqual(b, { statut: 'bloquee', raison: 'déjà abonné' });
  assert.equal(envoyes.length, 1);
});

test('envois coupés ou à blanc : la relance ne part pas', async () => {
  for (const [reglages, statut] of [[{ envois_coupes: true }, 'bloquee'], [{ a_blanc: true }, 'a_blanc']]) {
    const db = baseEnMemoire({ crm_reglages: [{ ...REGLAGES, ...reglages }], users: [inscrit('a@exemple.fr')] });
    await preparerContacts({ db, dossierPour: () => null, maintenant: T });
    const envoyes = [];
    const porte = porteEnvoi({ db, maintenant: () => T, lireRevenueCat: async () => ({ subscriber: { subscriptions: {} } }),
      envoyerResend: async (m) => { envoyes.push(m); return { id: 'r' }; } });
    assert.equal((await porte.envoyerAction(`onboarding__${cleUtilisateur('a@exemple.fr')}`)).statut, statut);
    assert.equal(envoyes.length, 0);
  }
});
