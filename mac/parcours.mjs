// Le parcours d'une personne dans l'app (INT-EW-69) : ce qu'elle a dit à l'onboarding, ses imports de contacts, ses
// tournées. Tiré de la base Mixpanel du Mac (couche propre), pour écrire un e-mail qui part de ce qu'elle a vraiment fait.
// Rien que des comptes et des choix d'écran : aucun texte tapé, aucun contact.

export const METIERS = { DeliveryDriver: 'livreur', SalesRep: 'commercial', SalesManager: 'directeur commercial', FieldTechnician: 'technicien',
  RealEstate: 'immobilier', Healthcare: 'santé', Personal: 'usage personnel', Other: 'autre' };
export const BESOINS = { MaxVisits: 'beaucoup de visites', AdvancedRouting: 'des tournées complexes', MultiDayPlanning: 'plusieurs jours',
  AdaptRoute: 'adapter la tournée en route', TrackClients: 'suivre ses clients', FindProspects: 'trouver des prospects', FindHotel: 'trouver un hôtel' };
export const SOURCES = { excel: 'un fichier Excel', csv: 'un fichier CSV', gsheet: 'Google Sheets', googlesheets: 'Google Sheets', native: 'les contacts du téléphone',
  phone: 'les contacts du téléphone', contacts: 'les contacts du téléphone', crm: 'un CRM', paste: 'une liste collée', map: 'la carte' };
const IMPORTS = { Csv: 'CSV', Excel: 'Excel', Gsheet: 'Google Sheets', Native: 'contacts du téléphone' };

export function parcoursDe(mp, personne) {
  if (!mp || !personne) return null;
  const evts = mp.prepare(`SELECT p.nom, p.temps, e.proprietes FROM propres p JOIN evenements e ON e.id = p.id
    WHERE p.utilisateur = ? AND p.a_exclure = '' AND (p.nom LIKE 'Event-onboarding%' OR p.nom LIKE 'Action-onboarding%' OR p.nom LIKE 'Event-Import%'
      OR p.nom IN ('Action-optimizeRoute', 'Action-startRoute', 'Action-confirmCreateRouteName', 'Event-ahaFirstRouteCreated'))
    ORDER BY p.temps`).all(personne);
  const props = (e) => { try { return JSON.parse(e.proprietes); } catch { return {}; } };
  const n = (nom) => evts.filter((e) => e.nom === nom).length;
  // L'onboarding : le dernier métier choisi, les besoins cochés moins ceux décochés ensuite, la source choisie.
  let metier = null; const besoins = new Set(); let source = null;
  for (const e of evts) {
    let m = e.nom.match(/^Event-onboardingRoleSet(\w+)$/); if (m) metier = METIERS[m[1]] ?? m[1];
    m = e.nom.match(/^Event-onboardingNeedSet(\w+)$/); if (m) besoins.add(m[1]);
    m = e.nom.match(/^Event-onboardingNeedUnset(\w+)$/); if (m) besoins.delete(m[1]);
    m = e.nom.match(/^Action-onboardingSourceTapFile(\w+)$/); if (m) source = SOURCES[m[1].toLowerCase()] ?? m[1];
    if (e.nom === 'Event-onboardingSourceTapCrm') source = SOURCES.crm;
    if (e.nom === 'Event-onboardingSourceImportSuccess') { const s = String(props(e).source ?? '').toLowerCase(); if (SOURCES[s]) source = SOURCES[s]; }
    if (e.nom === 'Event-onboardingSourceContinueEmpty' && !source) source = 'aucune';
  }
  const onboarding = { metier, besoins: [...besoins].map((b) => BESOINS[b] ?? b), source,
    fini: n('Event-onboardingCompleted') > 0, abandonne: n('Event-onboardingAbandoned') > 0 && n('Event-onboardingCompleted') === 0 };
  // Les imports, par source : réussis (et combien de contacts), en échec, annulés.
  const imports = Object.entries(IMPORTS).map(([cle, nom]) => {
    const succes = evts.filter((e) => e.nom === `Event-Import${cle}Success`);
    const contacts = succes.reduce((s, e) => { const p = props(e); return s + (Number(p.imported_count ?? p.totalContacts ?? 0) || 0); }, 0);
    const localises = succes.reduce((s, e) => s + (Number(props(e).locatedContacts ?? 0) || 0), 0);
    return { source: nom, reussis: succes.length, contacts, localises, echecs: n(`Event-Import${cle}Error`), annules: n(`Event-Import${cle}Canceled`) };
  }).filter((i) => i.reussis || i.echecs || i.annules);
  // Les tournées : créées, optimisées (réussies), démarrées, et la taille des tournées démarrées.
  const demarrees = evts.filter((e) => e.nom === 'Action-startRoute');
  const arrets = demarrees.map((e) => Number(props(e).stop_count ?? props(e).visitCount ?? 0)).filter((x) => x > 0);
  const tournees = {
    creees: n('Action-confirmCreateRouteName') || n('Event-ahaFirstRouteCreated'),
    optimisees: evts.filter((e) => e.nom === 'Action-optimizeRoute' && props(e).success !== false).length,
    optimisations_ratees: evts.filter((e) => e.nom === 'Action-optimizeRoute' && props(e).success === false).length,
    demarrees: demarrees.length, arrets_max: arrets.length ? Math.max(...arrets) : null,
  };
  return { onboarding, imports, tournees };
}

// Le parcours en phrases françaises, pour le fondateur.
export function direParcours(p) {
  if (!p) return [];
  const faits = [];
  const o = p.onboarding;
  const bouts = [o.metier && `métier ${o.metier}`, o.besoins.length && `besoins : ${o.besoins.join(', ')}`, o.source && `contacts : ${o.source}`].filter(Boolean);
  if (bouts.length || o.abandonne) faits.push(`Onboarding${o.abandonne ? ' abandonné' : o.fini ? ' fini' : ''}${bouts.length ? ` : ${bouts.join(' ; ')}` : ''}.`);
  if (p.imports.length) {
    faits.push(`Imports : ${p.imports.map((i) => [i.reussis && `${i.source} réussi${i.reussis > 1 ? ` ${i.reussis} fois` : ''}${i.contacts ? ` (${i.contacts} contacts${i.localises ? `, ${i.localises} sur la carte` : ''})` : ''}`,
      i.echecs && `${i.source} en échec ${i.echecs} fois`, i.annules && `${i.source} annulé ${i.annules} fois`].filter(Boolean).join(', ')).join(' ; ')}.`);
  }
  const t = p.tournees;
  if (t.creees || t.optimisees || t.demarrees) {
    faits.push(`Tournées : ${t.creees} créée${t.creees > 1 ? 's' : ''}, ${t.optimisees} optimisée${t.optimisees > 1 ? 's' : ''}${t.optimisations_ratees ? ` (${t.optimisations_ratees} optimisation${t.optimisations_ratees > 1 ? 's' : ''} ratée${t.optimisations_ratees > 1 ? 's' : ''})` : ''}, ${t.demarrees} démarrée${t.demarrees > 1 ? 's' : ''}${t.arrets_max ? (t.arrets_max > 1 ? ` (jusqu'à ${t.arrets_max} arrêts)` : ' (1 arrêt)') : ''}.`);
  }
  return faits;
}
