// Les repères du dossier (INT-EW-71) : ce que font d'habitude les gens du même métier, ou tous métiers quand les briques
// ne coupent pas par métier, pour voir où la personne s'écarte. Chaque repère cite sa brique, sa conclusion et sa date ;
// les chiffres sont recopiés des briques d'hephaistos (research/briques), à relire quand elles sont rafraîchies.
// Seuls les commerciaux ont des chiffres à eux dans les briques au 2026-11-19 : les autres métiers prennent « tous métiers ».

export const REPERES = [
  { id: 'onboarding', metier: 'commercial', part: 79, compte: '89 sur 112', fait: 'finissent l’onboarding en 7 jours',
    qui: 'nouveaux commerciaux', brique: 'chemin-premiere-tournee', conclusion: 'C1', a_jour: '2026-11-19' },
  { id: 'onboarding', metier: null, part: 69, compte: '223 sur 324', fait: 'finissent l’onboarding en 7 jours',
    qui: 'nouveaux, tous métiers', brique: 'chemin-premiere-tournee', conclusion: 'C2', a_jour: '2026-11-19' },
  { id: 'import', metier: null, part: 82, compte: '76 sur 93', fait: 'réussissent',
    qui: 'imports de fichier validés par « Parcourir »', brique: 'import-fichier', conclusion: 'C5', a_jour: '2026-11-19' },
  { id: 'demarrage_essai', metier: null, part: 56, compte: '53 sur 94', fait: 'avaient démarré une tournée pendant l’essai',
    qui: 'payants venus d’un essai et restés', brique: 'usage-nouveaux-payants', conclusion: 'C4', a_jour: '2026-11-19' },
  { id: 'demarrage_payant', metier: null, part: 36, compte: '47 sur 132', fait: 'démarrent une tournée dans leur premier mois payé',
    qui: 'nouveaux payants', brique: 'usage-nouveaux-payants', conclusion: 'C1', a_jour: '2026-11-19' },
];

// Le repère du métier s'il existe, sinon celui de tous métiers.
const repere = (id, metier) => REPERES.find((r) => r.id === id && r.metier === metier) ?? REPERES.find((r) => r.id === id && !r.metier);

// Les écarts marqués, le plus grand d'abord. ecart : en points, entre la part du repère et ce que la personne a fait.
// Rien sans parcours connu : une personne absente de Mixpanel n'a pas « rien fait ».
export function ecartsDe(d) {
  const p = d?.parcours;
  if (!p || d.lie === false) return [];
  const metier = p.onboarding?.metier ?? d.usage?.metier ?? null;
  const sortie = [];
  const ajoute = (id, ecart, constat) => { const r = repere(id, metier); if (r && ecart >= 30) sortie.push({ id, ecart: Math.round(ecart), constat, repere: r }); };
  if (p.onboarding?.abandonne) ajoute('onboarding', repere('onboarding', metier).part, 'a abandonné l’onboarding');
  const reussis = p.imports.reduce((s, i) => s + i.reussis, 0); const echecs = p.imports.reduce((s, i) => s + i.echecs, 0);
  if (echecs >= 2) { const taux = (100 * reussis) / (reussis + echecs); ajoute('import', repere('import').part - taux, `${echecs} imports en échec sur ${reussis + echecs}`); }
  if (!p.tournees.demarrees) {
    const a = d.abonnement ?? {};
    if (a.paiements > 0) ajoute('demarrage_payant', repere('demarrage_payant').part, 'n’a jamais démarré de tournée en payant');
    else if (a.essai_le) ajoute('demarrage_essai', repere('demarrage_essai').part, 'n’a pas démarré de tournée pendant l’essai');
  }
  return sortie.sort((x, y) => y.ecart - x.ecart);
}

// Une ligne par écart, pour le fondateur : le constat, le repère et sa source.
export const direEcart = (e) => `Écart : ${e.constat} ; ${e.repere.compte} ${e.repere.qui} ${e.repere.fait} (${e.repere.brique} ${e.repere.conclusion}, au ${e.repere.a_jour.split('-').reverse().join('/')}).`;
