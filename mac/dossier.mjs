// Le dossier d'une personne : tout ce que le Mac sait d'elle, pour écrire un vrai e-mail (tâche EW-50).
// Sources, toutes en lecture seule : la base Mixpanel (questionnaire de départ, usage jour par jour, événements
// RevenueCat), la table par utilisateur d'utilisateurs.py (hephaistos), la table des liens RevenueCat.
// Le dossier ne contient ni e-mail, ni nom, ni téléphone : la personne y est son identifiant RevenueCat.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SIGNAUX, T, cleQuestion } from './brouillons.mjs';

const JOUR = 86400000;
const DOSSIER_MIXPANEL = path.join(os.homedir(), '.local/share/starshipcoder/mixpanel');
// Ce qui n'est pas de l'usage : l'abonnement et le questionnaire lui-même.
const PAS_USAGE = `nom NOT LIKE 'rc\\_%' ESCAPE '\\' AND nom <> 'Action-churn'`;
export const ZONES = ['Carte', 'Compte et synchronisation', 'Contacts', 'Import de contacts', 'Prospection', "Recherche d'adresse",
  'Scanner', 'Tournée : optimiser', 'Tournée : préparer', 'Tournée : sur la route'];
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
  const mixpanel = ouvrir('easyway.sqlite');
  return { mixpanel, utilisateurs: ouvrir('easyway-utilisateurs.sqlite'), liens, zones: lireZones(),
    ids: mixpanel ? indexIds(mixpanel, path.join(dossier, 'easyway.sqlite')) : new Map(),
    // La fin de la base, en secondes : le dossier dit jusqu'à quand vont ses données (INT-EW-68).
    fin: mixpanel?.prepare('SELECT max(temps) t FROM evenements').get()?.t ?? null };
}

// L'identifiant RevenueCat d'un inscrit vers sa personne dans Mixpanel, comme liens_revenuecat.py et absents_mixpanel.py :
// l'id RevenueCat vu par l'app (rc.user_id), l'id RevenueCat qui servait d'identifiant Mixpanel (avant la 7.3.8), ou
// l'id envoyé par l'app ($user_id). La table de liens, elle, ne relie que les abonnés. ~40 s à construire : gardé dans
// un fichier à côté de la base (hors git), refait seulement quand la base change.
export function indexIds(mixpanel, fichierBase) {
  const cache = path.join(path.dirname(fichierBase), 'iris-index-ids.json');
  const version = existsSync(fichierBase) ? String(statSync(fichierBase).mtimeMs) : '';
  if (existsSync(cache)) {
    try { const c = JSON.parse(readFileSync(cache, 'utf8')); if (c.version === version) return new Map(c.ids); } catch { /* refait */ }
  }
  const ids = new Map();
  const ajouter = (rows) => { for (const r of rows) if (r.x && r.x !== 'unknown' && !ids.has(String(r.x))) ids.set(String(r.x), r.u); };
  ajouter(mixpanel.prepare(`SELECT DISTINCT json_extract(e.proprietes, '$."rc.user_id"') x, p.utilisateur u FROM propres p JOIN evenements e ON e.id = p.id
    WHERE p.nom = 'Event-RevenueCat-CustomerInfo' AND p.utilisateur IS NOT NULL AND p.a_exclure = ''`).all());
  ajouter(mixpanel.prepare(`SELECT DISTINCT e.distinct_id x, p.utilisateur u FROM evenements e JOIN propres p ON p.id = e.id
    WHERE p.utilisateur IS NOT NULL AND e.distinct_id IS NOT NULL AND p.nom NOT LIKE 'rc\\_%' ESCAPE '\\'`).all());
  ajouter(mixpanel.prepare(`SELECT DISTINCT json_extract(e.proprietes, '$."$user_id"') x, p.utilisateur u FROM evenements e JOIN propres p ON p.id = e.id
    WHERE p.utilisateur IS NOT NULL AND p.a_exclure = '' AND p.nom NOT LIKE 'rc\\_%' ESCAPE '\\'`).all());
  try { writeFileSync(cache, JSON.stringify({ version, ids: [...ids] }), { mode: 0o600 }); } catch { /* sans cache, on refera */ }
  return ids;
}
export const personneDe = (sources, rc) => sources.liens.get(rc) ?? sources.ids?.get(rc) ?? rc;

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
  const personne = personneDe(sources, rc);
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
  const pays = mp?.prepare(`SELECT json_extract(e.proprietes, '$.mp_country_code') c, count(*) n FROM propres p JOIN evenements e ON e.id = p.id
    WHERE p.utilisateur = ? AND c IS NOT NULL GROUP BY c ORDER BY n DESC LIMIT 1`).get(personne)?.c ?? null;
  // Jusqu'où vont les données : la passe de nuit ajoute la veille ; plus d'un jour et demi de retard, elle a cassé.
  const a_jour = { base_jusqu_a: sources.fin ? new Date(sources.fin * 1000).toISOString() : null,
    en_retard: !sources.fin || t - sources.fin * 1000 > 36 * 3600000 };
  return { rc, personne, pays, questionnaire, usage, abonnement, a_jour, calcule_le: date(t) };
}

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
  return { faits, question: T.fr.questions[cleQuestion(d)], semaines: u.semaines, pays: d.pays, a_jour: direAJour(d.a_jour) };
}

const heureParis = (iso) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  .format(new Date(iso)).replace(' ', ' à ').replace(':', ' h ');
// Ce que le fondateur lit en tête du dossier.
export function direAJour(a) {
  if (!a?.base_jusqu_a) return { texte: 'Base Mixpanel absente : dossier vide.', en_retard: true };
  return { texte: `Données jusqu'au ${heureParis(a.base_jusqu_a)}${a.en_retard ? ' : la mise à jour de nuit est en retard.' : '.'}`, en_retard: Boolean(a.en_retard) };
}

export { brouillonResiliation, brouillonAvecTraduction } from './brouillons.mjs';
