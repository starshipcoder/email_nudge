// Le dossier d'une personne : tout ce que le Mac sait d'elle, pour écrire un vrai e-mail (tâche EW-50).
// Sources, toutes en lecture seule : la base Mixpanel (questionnaire de départ, usage jour par jour, événements
// RevenueCat), la table par utilisateur d'utilisateurs.py (hephaistos), la table des liens RevenueCat.
// Le dossier ne contient ni e-mail, ni nom, ni téléphone : la personne y est son identifiant RevenueCat.
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const JOUR = 86400000;
const DOSSIER_MIXPANEL = path.join(os.homedir(), '.local/share/starshipcoder/mixpanel');
// Ce qui n'est pas de l'usage : l'abonnement et le questionnaire lui-même.
const PAS_USAGE = `nom NOT LIKE 'rc\\_%' ESCAPE '\\' AND nom <> 'Action-churn'`;
export const ZONES = ['Carte', 'Compte et synchronisation', 'Contacts', 'Import de contacts', 'Prospection', "Recherche d'adresse",
  'Scanner', 'Tournée : optimiser', 'Tournée : préparer', 'Tournée : sur la route'];
const ZONES_EN = { Carte: 'the map', 'Compte et synchronisation': 'account sync', Contacts: 'contacts', 'Import de contacts': 'contact import',
  Prospection: 'prospecting', "Recherche d'adresse": 'address search', Scanner: 'the scanner', 'Tournée : optimiser': 'route optimization',
  'Tournée : préparer': 'route planning', 'Tournée : sur la route': 'navigation on the road' };
const ZONES_FR = { Carte: 'la carte', 'Compte et synchronisation': 'la synchronisation', Contacts: 'les contacts', 'Import de contacts': "l'import de contacts",
  Prospection: 'la prospection', "Recherche d'adresse": "la recherche d'adresse", Scanner: 'le scanner', 'Tournée : optimiser': "l'optimisation des tournées",
  'Tournée : préparer': 'la préparation des tournées', 'Tournée : sur la route': 'le guidage sur la route' };
export const RAISONS = { tooExpensive: 'trop cher', dontNeedAnymore: "plus besoin de l'app", noNeedOfPremiumFeature: 'les fonctions payantes ne lui servent pas',
  missingFeatures: 'il manque des fonctions', tooBuggy: 'trop de bugs', tooSlow: 'trop lente', difficultToUse: 'difficile à utiliser', other: 'autre raison' };

const date = (ms) => new Date(ms).toISOString().slice(0, 10);
const jj = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

// Les sources du Mac, ouvertes en lecture seule ; null pour celle qui manque.
export async function ouvrirSources(dossier = DOSSIER_MIXPANEL) {
  const { DatabaseSync } = await import('node:sqlite');
  const ouvrir = (nom) => { const f = path.join(dossier, nom); return existsSync(f) ? new DatabaseSync(f, { readOnly: true }) : null; };
  const liensBase = ouvrir('easyway-liens-revenuecat.sqlite');
  const liens = new Map(liensBase ? liensBase.prepare('SELECT abonne, personne FROM liens').all().map((r) => [r.abonne, r.personne]) : []);
  liensBase?.close();
  return { mixpanel: ouvrir('easyway.sqlite'), utilisateurs: ouvrir('easyway-utilisateurs.sqlite'), liens, zones: lireZones() };
}

// Le dictionnaire des événements d'hephaistos : la zone de l'app de chaque événement.
export const DICTIONNAIRE = path.join(os.homedir(), 'workspace/starshipcoder/hephaistos/research/donnees/dictionnaire-evenements.csv');
export function lireZones(fichier = DICTIONNAIRE) {
  if (!existsSync(fichier)) return new Map();
  const lignes = readFileSync(fichier, 'utf8').split('\n').filter(Boolean);
  const champs = (l) => { const sortie = []; let cur = ''; let q = false;
    for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { sortie.push(cur); cur = ''; } else cur += c; }
    sortie.push(cur); return sortie; };
  const tete = champs(lignes[0]); const iNom = tete.indexOf('nom'); const iZone = tete.indexOf('zone');
  return new Map(lignes.slice(1).map(champs).map((c) => [c[iNom], c[iZone]]));
}
export function fermerSources(s) { s?.mixpanel?.close(); s?.utilisateurs?.close(); }

export function dossierDe({ rc, sources, maintenant = new Date() }) {
  const personne = sources.liens.get(rc) ?? rc;
  const mp = sources.mixpanel;
  const t = maintenant.getTime();

  const churn = mp?.prepare(`SELECT e.proprietes, p.jour FROM propres p JOIN evenements e ON e.id = p.id
    WHERE p.nom = 'Action-churn' AND p.a_exclure = '' AND p.utilisateur = ? ORDER BY p.temps DESC LIMIT 1`).get(personne);
  let questionnaire = null;
  if (churn) {
    const p = JSON.parse(churn.proprietes);
    questionnaire = { raison: String(p.reason ?? '').split('.').pop() || 'other', texte: String(p.text ?? '').trim(), le: churn.jour };
  }

  const ligne = sources.utilisateurs?.prepare('SELECT * FROM utilisateurs WHERE utilisateur = ?').get(personne) ?? null;
  const jours = (mp?.prepare(`SELECT DISTINCT jour FROM propres WHERE utilisateur = ? AND a_exclure = '' AND ${PAS_USAGE} ORDER BY jour`).all(personne) ?? []).map((r) => r.jour);
  const tournees = mp?.prepare(`SELECT count(*) n FROM propres WHERE utilisateur = ? AND a_exclure = '' AND nom = 'Action-startRoute'`).get(personne)?.n ?? 0;
  // Jours actifs par semaine, sur les 12 dernières semaines, la plus ancienne d'abord.
  const semaines = Array.from({ length: 12 }, (_, k) => {
    const debut = t - (12 - k) * 7 * JOUR; const fin = debut + 7 * JOUR;
    return jours.filter((j) => { const x = new Date(`${j}T12:00:00Z`).getTime(); return x >= debut && x < fin; }).length;
  });
  // Tout l'historique de la personne, rangé par zone de l'app (la table d'utilisateurs.py ne lit que six mois).
  const parNom = mp?.prepare(`SELECT nom, count(*) n FROM propres WHERE utilisateur = ? AND a_exclure = '' AND ${PAS_USAGE} GROUP BY nom`).all(personne) ?? [];
  const parZone = new Map();
  for (const { nom, n } of parNom) { const z = sources.zones?.get(nom); if (z) parZone.set(z, (parZone.get(z) ?? 0) + n); }
  const zones = ZONES.map((z) => ({ zone: z, n: parZone.get(z) ?? 0 }));
  const signaux = Object.entries(SIGNAUX).map(([nom, s]) => ({ nom, n: parNom.find((x) => x.nom === nom)?.n ?? 0, ...s }))
    .filter((x) => x.n >= x.min).map(({ nom, n, resume }) => ({ nom, n, resume }));
  const usage = {
    metier: ligne?.metier ?? null, premier_jour: jours[0] ?? ligne?.premier_jour ?? null,
    jours_actifs: jours.length, dernier_jour: jours.at(-1) ?? null, tournees, semaines, signaux,
    zones: zones.filter((z) => z.n > 0).sort((a, b) => b.n - a.n), zones_jamais: zones.filter((z) => z.n === 0).map((z) => z.zone),
  };

  const rcEvts = mp?.prepare(`SELECT p.nom, p.jour, p.formule FROM propres p JOIN evenements e ON e.id = p.id
    WHERE p.nom LIKE 'rc\\_%' ESCAPE '\\' AND instr(e.proprietes, ?) > 0 ORDER BY p.temps`).all(JSON.stringify(String(rc))) ?? [];
  const paiements = rcEvts.filter((e) => ['rc_trial_converted_event', 'rc_initial_purchase_event', 'rc_renewal_event'].includes(e.nom));
  const abonnement = {
    formule: rcEvts.map((e) => e.formule).filter(Boolean).at(-1) ?? null,
    essai_le: rcEvts.find((e) => e.nom === 'rc_trial_started_event')?.jour ?? null,
    premier_paiement: paiements[0]?.jour ?? null, paiements: paiements.length,
    resilie_le: rcEvts.filter((e) => e.nom === 'rc_cancellation_event').at(-1)?.jour ?? null,
  };
  return { rc, personne, questionnaire, usage, abonnement, calcule_le: date(t) };
}

// Les erreurs qui disent quelque chose de son expérience, à partir de combien de fois, et ce qu'en dit l'e-mail.
export const SIGNAUX = {
  'Event-ImportExcelError': { min: 1, resume: 'import d’un fichier en échec', fr: "l'import de votre fichier n'a pas marché", en: 'importing your file did not work' },
  'Event-geocoderError': { min: 5, resume: 'adresses non trouvées', fr: "beaucoup d'adresses n'ont pas été trouvées sur la carte", en: 'many addresses could not be found on the map' },
  'contacts.contactbookIssue': { min: 3, resume: 'contacts du téléphone illisibles', fr: "l'app n'a pas réussi à lire les contacts de votre téléphone", en: 'the app could not read the contacts on your phone' },
  'Event-emptyMapState': { min: 3, resume: 'carte restée vide', fr: 'votre carte est restée vide', en: 'your map stayed empty' },
};

const QUESTIONS = {
  tooExpensive: ['Pour quel prix, ou avec quoi de plus, l\'app vous aurait-elle paru valoir le coup ?', 'At what price, or with what more, would the app have felt worth it?'],
  dontNeedAnymore: ['Est-ce votre façon de travailler qui a changé, ou l\'app qui ne collait plus à vos tournées ?', 'Did the way you work change, or did the app stop fitting your routes?'],
  noNeedOfPremiumFeature: ['Qu\'est-ce qui vous aurait fait garder l\'abonnement ?', 'What would have made you keep the subscription?'],
  missingFeatures: ['Quelle fonction vous a le plus manqué ?', 'Which feature did you miss the most?'],
  tooBuggy: ['Quel problème vous a le plus gêné ? Je veux le corriger.', 'Which problem bothered you the most? I want to fix it.'],
  tooSlow: ['À quel moment l\'app était-elle trop lente ?', 'When was the app too slow?'],
  difficultToUse: ['À quel moment l\'app vous a-t-elle paru compliquée ?', 'At what point did the app feel complicated?'],
  other: ['Si vous avez une minute : qu\'est-ce qui vous a fait partir ?', 'If you have a minute: what made you leave?'],
};
const INDIQUE = {
  tooExpensive: ['que c\'était trop cher', 'that it was too expensive'], dontNeedAnymore: ['que vous n\'en aviez plus besoin', 'that you no longer needed it'],
  noNeedOfPremiumFeature: ['que les fonctions payantes ne vous servaient pas', 'that you did not need the paid features'],
  missingFeatures: ['qu\'il vous manquait des fonctions', 'that some features were missing'], tooBuggy: ['qu\'il y avait trop de bugs', 'that there were too many bugs'],
  tooSlow: ['que l\'app était trop lente', 'that the app was too slow'], difficultToUse: ['que l\'app était difficile à utiliser', 'that the app was hard to use'],
};
const PROBLEME = ['Est-ce ce problème qui vous a arrêté, ou autre chose ?', 'Was it this problem that stopped you, or something else?'];
const question = (d, i) => (d.questionnaire ? (QUESTIONS[d.questionnaire.raison] ?? QUESTIONS.other) : d.usage.signaux.length ? PROBLEME : QUESTIONS.other)[i];
const depuis = (d, maintenant) => (d.usage.dernier_jour ? Math.round((maintenant - new Date(`${d.usage.dernier_jour}T12:00:00Z`).getTime()) / JOUR) : null);

function tendance(s) {
  const actives = s.filter((n) => n > 0).length;
  const fin = s.slice(-3).reduce((a, b) => a + b, 0);
  if (!actives) return 'aucune activité sur 12 semaines';
  if (!fin) return `actif ${actives} semaine${actives > 1 ? 's' : ''} sur 12, puis plus rien`;
  return `actif ${actives} semaine${actives > 1 ? 's' : ''} sur 12, encore actif ces 3 dernières semaines`;
}

// Le résumé pour écrire, en français pour le fondateur, sans aucune coordonnée.
export function resumer(d, maintenant = new Date(`${d.calcule_le}T12:00:00Z`)) {
  const faits = [];
  const u = d.usage; const a = d.abonnement;
  if (u.metier) faits.push(`Métier déclaré : ${u.metier}.`);
  if (a.premier_paiement) faits.push(`Abonné ${a.formule ?? ''} depuis le ${jj(a.premier_paiement)} : ${a.paiements} paiement${a.paiements > 1 ? 's' : ''}${a.resilie_le ? `, résilié le ${jj(a.resilie_le)}` : ''}.`.replace('  ', ' '));
  if (u.jours_actifs || u.tournees) faits.push(`${u.tournees} tournées lancées, ${u.jours_actifs} jours actifs depuis le ${jj(u.premier_jour)}${u.zones.length ? ` ; surtout ${u.zones.slice(0, 3).map((z) => z.zone).join(', ')}` : ''}.`);
  if (u.zones_jamais.length) faits.push(`Jamais utilisé : ${u.zones_jamais.join(', ')}.`);
  if (u.signaux.length) faits.push(`Problèmes vus : ${u.signaux.map((x) => `${x.resume} (${x.n} fois)`).join(', ')}.`);
  if (a.paiements >= 2 && u.dernier_jour && a.resilie_le && (new Date(a.resilie_le) - new Date(u.dernier_jour)) > 45 * JOUR) {
    faits.push(`A continué de payer sans ouvrir l'app : dernier jour actif le ${jj(u.dernier_jour)}, résilié le ${jj(a.resilie_le)}.`);
  }
  const j = depuis(d, maintenant.getTime());
  faits.push(`Activité : ${tendance(u.semaines)}${j !== null ? ` (plus rien depuis ${j} jours)` : ''}.`.replace(' (plus rien depuis 0 jours)', ''));
  if (d.questionnaire) faits.push(`Questionnaire de départ (${jj(d.questionnaire.le)}) : ${RAISONS[d.questionnaire.raison] ?? d.questionnaire.raison}${d.questionnaire.texte ? ` ; il a écrit « ${d.questionnaire.texte} »` : ''}.`);
  else faits.push('Pas de réponse au questionnaire de départ.');
  return { faits, question: question(d, 0), semaines: u.semaines };
}

// Le brouillon de l'e-mail aux résiliés : un ou deux faits de son usage, sa réponse, une seule question.
export function brouillonResiliation(d, langue, signature) {
  const fr = langue === 'fr';
  const u = d.usage; const r = d.questionnaire?.raison;
  const semainesUsage = u.premier_jour && u.dernier_jour ? Math.max(1, Math.round((new Date(u.dernier_jour) - new Date(u.premier_jour)) / (7 * JOUR))) : null;
  const zone = u.zones.find((z) => !z.zone.startsWith('Tournée'))?.zone;
  let usage = '';
  if (u.tournees > 0) {
    usage = fr ? `Vous avez lancé ${u.tournees} tournées avec l'app${semainesUsage ? ` en ${semainesUsage} semaine${semainesUsage > 1 ? 's' : ''}` : ''}.`
      : `You started ${u.tournees} routes with the app${semainesUsage ? ` over ${semainesUsage} week${semainesUsage > 1 ? 's' : ''}` : ''}.`;
  } else if (zone) {
    usage = fr ? `Vous vous serviez surtout de ${ZONES_FR[zone] ?? zone}, sans avoir encore lancé de tournée.` : `You mostly used ${ZONES_EN[zone] ?? zone}, without starting a route yet.`;
  }
  const signal = u.signaux[0];
  if (signal) {
    const deux = u.signaux[1];
    const quoi = fr ? `${signal.nom in SIGNAUX ? SIGNAUX[signal.nom].fr : ''}${deux ? `, et ${SIGNAUX[deux.nom].fr}` : ''}` : `${SIGNAUX[signal.nom].en}${deux ? `, and ${SIGNAUX[deux.nom].en}` : ''}`;
    usage += (usage ? ' ' : '') + (fr ? `En regardant de mon côté, je vois que ${quoi}.` : `Looking on my side, I can see that ${quoi}.`);
  }
  let reponse = '';
  if (INDIQUE[r]) {
    reponse = fr ? `Dans l'app, vous avez indiqué ${INDIQUE[r][0]}.` : `In the app, you said ${INDIQUE[r][1]}.`;
    const texte = d.questionnaire.texte;
    if (texte && texte.length <= 200 && !texte.includes('?')) reponse += fr ? ` Vous avez écrit : « ${texte} ».` : ` You wrote: "${texte}".`;
  }
  const corps = fr
    ? ['Bonjour,', "Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.",
      [usage, reponse].filter(Boolean).join(' '), question(d, 0),
      "Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.", signature]
    : ['Hello,', 'You cancelled your Easy Way subscription. It is done, there is nothing else to do.',
      [usage, reponse].filter(Boolean).join(' '), question(d, 1),
      'One line in reply is enough: it decides what I fix next. I will not write to you again about this.', signature];
  return { sujet: fr ? 'Votre abonnement Easy Way' : 'Your Easy Way subscription', corps: corps.filter(Boolean).join('\n\n') };
}
