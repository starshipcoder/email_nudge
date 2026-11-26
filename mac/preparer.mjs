// Prépare les actions du jour à partir de la base Mixpanel du Mac (événements que RevenueCat y envoie)
// et des inscrits d'email_nudge. Rien ne part d'ici : la porte d'envoi relit RevenueCat avant chaque e-mail.
import { cleUtilisateur } from './envoi.mjs';
import { jourFin, rendre, rendreAvecTraduction } from './modeles.mjs';
import { resumer } from './dossier.mjs';
import { brouillonDepart, brouillonEssaiAnnule } from './brouillons.mjs';
import { langueDePersonne } from './langues.mjs';

const H = 3600 * 1000;
// Fin d'essai entre 26 h et 60 h d'ici : Apple peut prélever dans les 24 h avant la fin (bilan du 25/11), le rappel doit
// donc partir avant ; 34 h de fenêtre couvrent une passe par jour.
const FENETRE_J2 = [26 * H, 60 * H];
export const AVANT_PRELEVEMENT = 24 * H;
const FENETRE_RESILIATION = 7 * 24 * H;
// L'e-mail aux abonnés payés qui résilient se prépare 24 h après l'arrêt, pas avant (choix du fondateur, 23/11, Q-EW-63).
export const DELAI_RESILIATION = 24 * H;

// Les faits utiles, lus dans la base Mixpanel (lecture seule). `base` répond à all(sql, ...params).
export function lireFaits(base, depuisMs) {
  const evts = base.all(
    `SELECT p.nom, p.temps, e.proprietes FROM propres p JOIN evenements e ON e.id = p.id
     WHERE p.nom IN ('rc_trial_started_event','rc_trial_cancelled_event','rc_trial_converted_event','rc_expiration_event',
                     'rc_cancellation_event','rc_uncancellation_event','rc_renewal_event','rc_initial_purchase_event')
       AND p.a_exclure = '' AND p.temps >= ? ORDER BY p.temps`, Math.floor(depuisMs / 1000));
  return evts.map((e) => {
    const p = JSON.parse(e.proprietes);
    return { nom: e.nom, temps: e.temps * 1000, ids: [p.original_app_user_id, p.app_user_id, ...(p.aliases ?? [])].filter(Boolean).map(String),
      transaction: String(p.original_transaction_id ?? ''), fin: p.expiration_at ?? null, type: p.period_type ?? null,
      raison: p.cancel_reason ?? null, store: p.store ?? null };
  });
}

// Nombre de tournées démarrées par identifiant RevenueCat, par la table de liens du Mac.
export function tourneesPar(base, liens) {
  const parPersonne = new Map(base.all(`SELECT utilisateur, count(*) n FROM propres WHERE nom = 'Action-startRoute' AND a_exclure = '' AND utilisateur IS NOT NULL GROUP BY utilisateur`)
    .map((r) => [r.utilisateur, r.n]));
  // null : la personne n'est pas reliée à Mixpanel, on ne sait pas si elle a lancé des tournées.
  const connues = new Set(base.all(`SELECT DISTINCT utilisateur FROM propres WHERE utilisateur IS NOT NULL`).map((r) => r.utilisateur));
  return (rc) => {
    const p = liens.get(rc) ?? rc;
    if (!connues.has(p)) return null;
    return parPersonne.get(p) ?? 0;
  };
}

// EW-55 : les annulations vues dans l'heure. Le webhook RevenueCat de Firebase pose `churned_at` sur la fiche en temps
// réel ; la fiche ne dit pas sûrement si c'était un essai ou un abonnement (`plan` est souvent faux), donc RevenueCat est
// relu pour chaque fiche annulée depuis moins de 7 jours. Une carte refusée (billing issue) n'est pas un départ.
export async function faitsDesFiches(users, lireRevenueCat, maintenant) {
  const t = maintenant.getTime();
  const recents = users.filter((u) => u.revenuecat_id && u.churned_at && t - new Date(u.churned_at).getTime() <= FENETRE_RESILIATION);
  const faits = [];
  for (const u of recents) {
    let abonne;
    try { abonne = await lireRevenueCat(u.revenuecat_id); } catch { continue; }
    const subs = Object.values(abonne?.subscriber?.subscriptions ?? {})
      .filter((s) => s.unsubscribe_detected_at && !s.billing_issues_detected_at && !s.refunded_at && t - new Date(s.unsubscribe_detected_at).getTime() <= FENETRE_RESILIATION);
    for (const s of subs) {
      const essai = s.period_type === 'trial';
      const temps = new Date(s.unsubscribe_detected_at).getTime();
      faits.push({ nom: essai ? 'rc_trial_cancelled_event' : 'rc_cancellation_event', temps, ids: [String(u.revenuecat_id)],
        transaction: `fiche-${u.revenuecat_id}-${temps}`, fin: s.expires_date ?? null, type: essai ? 'TRIAL' : 'NORMAL', raison: 'UNSUBSCRIBE',
        store: s.store ? String(s.store).toUpperCase() : null, source: 'fiche' });
    }
  }
  return faits;
}

// Les annulations des 7 derniers jours d'une personne inconnue d'email_nudge : le fondateur en est prévenu par ntfy
// (BUG-EW-6, à la place de l'alerte du webhook), sans adresse ni nom.
export function annulationsSansInscrit(faits, inscrits, maintenant) {
  const connus = new Set(inscrits.map((u) => u.revenuecat_id).filter(Boolean));
  return faits.filter((f) => ['rc_cancellation_event', 'rc_trial_cancelled_event'].includes(f.nom) && maintenant.getTime() - f.temps <= FENETRE_RESILIATION)
    .filter((f) => !f.ids.some((i) => connus.has(i)))
    .map((f) => ({ id: `${f.nom}:${f.transaction || f.temps}`, essai: f.nom === 'rc_trial_cancelled_event' }));
}

export function candidats(faits, inscrits, maintenant) {
  const parRc = new Map();
  // Un compte de test (celui du fondateur, 24/11 : « c'est moi ») ne donne aucune action.
  for (const u of inscrits) if (u.revenuecat_id && !u.is_test_user) parRc.set(u.revenuecat_id, u);
  const inscritDe = (f) => f.ids.map((i) => parRc.get(i)).find(Boolean);
  const apres = (f, noms) => faits.some((g) => g.transaction === f.transaction && g.temps > f.temps && noms.includes(g.nom));
  const t = maintenant.getTime();
  // Un essai annulé puis repris sera prélevé : il garde son rappel (carte des e-mails, 25/11). Seule compte la dernière annulation.
  const annuleSansReprise = (f) => {
    const annulations = faits.filter((g) => g.transaction === f.transaction && g.temps > f.temps && g.nom === 'rc_trial_cancelled_event');
    if (!annulations.length) return false;
    const derniere = Math.max(...annulations.map((g) => g.temps));
    return !faits.some((g) => g.transaction === f.transaction && g.temps > derniere && g.nom === 'rc_uncancellation_event');
  };
  const essais = faits.filter((f) => f.nom === 'rc_trial_started_event' && f.fin)
    .filter((f) => { const reste = new Date(f.fin).getTime() - t; return reste >= FENETRE_J2[0] && reste <= FENETRE_J2[1]; })
    .filter((f) => !apres(f, ['rc_trial_converted_event', 'rc_expiration_event']) && !annuleSansReprise(f))
    .map((f) => ({ type: 'essai_j2', fait: f, user: inscritDe(f) })).filter((c) => c.user);
  // Seul un arrêt par la personne : pas un remboursement (CUSTOMER_SUPPORT), une décision du développeur ou un défaut de carte.
  // Il se prépare 24 h après l'arrêt, et jusqu'à 7 jours.
  const resiliations = faits.filter((f) => f.nom === 'rc_cancellation_event' && f.type === 'NORMAL' && f.raison === 'UNSUBSCRIBE')
    .filter((f) => t - f.temps >= DELAI_RESILIATION && t - f.temps <= FENETRE_RESILIATION)
    .filter((f) => !apres(f, ['rc_uncancellation_event', 'rc_renewal_event']))
    .map((f) => ({ type: 'resiliation', fait: f, user: inscritDe(f) })).filter((c) => c.user);
  // L'annulation d'un essai (EW-52) : sauf si la personne a payé ou repris ensuite, quel que soit l'abonnement.
  const paieEnsuite = (f) => faits.some((g) => g.temps > f.temps && g.ids.some((i) => f.ids.includes(i))
    && ['rc_initial_purchase_event', 'rc_trial_converted_event', 'rc_uncancellation_event', 'rc_renewal_event'].includes(g.nom));
  // Pas une carte refusée, un remboursement ou une décision du développeur : « vous avez annulé » y serait faux (bilan du 25/11).
  const subi = (f) => ['BILLING_ERROR', 'CUSTOMER_SUPPORT', 'DEVELOPER_INITIATED'].includes(f.raison);
  const essaisAnnules = faits.filter((f) => f.nom === 'rc_trial_cancelled_event' && !subi(f) && t - f.temps <= FENETRE_RESILIATION && !paieEnsuite(f))
    .map((f) => ({ type: 'essai_annule', fait: f, user: inscritDe(f) })).filter((c) => c.user);
  return [...essais, ...resiliations, ...essaisAnnules];
}

// L'e-mail de bienvenue (INT-EW-9) : chaque inscrit qui a donné une adresse, dans les 72 h après son inscription. La
// fenêtre courte évite qu'ouvrir le réglage prépare un e-mail pour tous les anciens inscrits.
export const FENETRE_BIENVENUE = 72 * H;
const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function bienvenues(inscrits, maintenant) {
  const t = maintenant.getTime();
  // Un compte de test (le fondateur) ne donne aucune action, comme dans `candidats`.
  return inscrits.filter((u) => ADRESSE.test(String(u.id)) && u.created_at && !u.is_test_user)
    .filter((u) => { const age = t - new Date(u.created_at).getTime(); return age >= 0 && age <= FENETRE_BIENVENUE; });
}

export function actionBienvenue(u, { signature, maintenant, pays = null, choix = null }) {
  const l = langueDePersonne({ locale: u.locale, pays, choix });
  const { sujet, corps, traduction_fr } = rendreAvecTraduction('bienvenue', l.langue, () => ({ signature }));
  return { id: `bienvenue__${cleUtilisateur(u.id)}`, type: 'bienvenue', user_id: u.id, statut: 'prete', sujet, corps, langue: l.langue,
    langue_source: l.source, ...(l.pays ? { pays: l.pays } : {}), ...(traduction_fr ? { traduction_fr } : {}),
    echeance: new Date(new Date(u.created_at).getTime() + FENETRE_BIENVENUE), cree_le: maintenant };
}

// Sans données sûres (personne non reliée à Mixpanel, ou base de plus d'un jour et demi), le brouillon n'affirme rien
// sur l'usage, et l'action porte un point à vérifier.

export function actionDe(c, { tournees, signature, maintenant, dossierPour = null, choixLangue = () => null }) {
  const cle = cleUtilisateur(c.user.id);
  // Le dossier de la personne, s'il se lit : son pays (pour la langue), son usage et sa réponse au questionnaire.
  const dossier = dossierPour?.(c.user.revenuecat_id, c.user) ?? null;
  const l = langueDePersonne({ locale: c.user.locale, pays: dossier?.pays, choix: choixLangue(cle) });
  const langue = l.langue;
  const source = { langue_source: l.source, ...(l.pays ? { pays: l.pays } : {}) };
  if (c.type === 'essai_j2') {
    // Le texte est le même pour tous ; la variante garde seulement l'usage, pour lire la mesure (§ 5 de la spec).
    const n = tournees(c.user.revenuecat_id) ?? 0;
    const { sujet, corps, traduction_fr } = rendreAvecTraduction('essai_j2', langue, (lg) => ({ jour_fin: jourFin(c.fait.fin, lg, dossier?.pays), signature }));
    return { id: `essai_j2__${cle}__${c.fait.transaction}`, type: 'essai_j2', variante: n > 0 ? 'usage' : 'peu_usage', user_id: c.user.id,
      statut: 'prete', sujet, corps, langue, ...source, ...(traduction_fr ? { traduction_fr } : {}),
      echeance: new Date(new Date(c.fait.fin).getTime() - AVANT_PRELEVEMENT), cree_le: maintenant };
  }
  if (c.type === 'essai_annule') {
    // Une suite par réponse au questionnaire, sinon une ligne pour tous (fondateur, 26/11). Le texte ne cite que sa
    // raison, jamais son usage : rien à vérifier. Le résumé de son dossier reste joint, pour le fondateur.
    const { sujet, corps, traduction_fr } = brouillonEssaiAnnule(dossier, langue, signature, { store: c.fait.store });
    return { id: `essai_annule__${cle}__${c.fait.transaction}`, type: 'essai_annule', user_id: c.user.id, statut: 'prete', sujet, corps, langue, ...source, store: c.fait.store ?? null,
      ...(traduction_fr ? { traduction_fr } : {}),
      ...(dossier ? { variante: 'dossier', resume: resumer(dossier, maintenant) } : {}),
      echeance: new Date(c.fait.temps + FENETRE_RESILIATION), cree_le: maintenant };
  }
  // La suite de sa réponse au questionnaire, sinon une ligne (fondateur, 26/11) : le texte ne cite ni son usage ni ce
  // qu'on voit de notre côté, rien à vérifier. Le résumé de son dossier reste joint, pour le fondateur.
  const { sujet, corps, traduction_fr } = brouillonDepart(dossier, langue, signature, { store: c.fait.store });
  // Une seule résiliation par personne (Q-EW-63) : preparer ne la crée pas si la personne en a déjà une.
  return { id: `resiliation__${cle}__${c.fait.transaction}`, type: 'resiliation', user_id: c.user.id, statut: 'prete', sujet, corps, langue, ...source, store: c.fait.store ?? null,
    ...(traduction_fr ? { traduction_fr } : {}),
    ...(dossier ? { variante: 'dossier', resume: resumer(dossier, maintenant) } : {}),
    echeance: new Date(c.fait.temps + FENETRE_RESILIATION), cree_le: maintenant };
}

// Une passe : crée les actions qui n'existent pas encore (le même identifiant ne se crée jamais deux fois),
// et passe en « expirée » celles dont l'échéance est passée.
export async function preparer({ db, faits, tournees, maintenant = new Date(), dossierPour = null }) {
  const reglages = (await db.lire('crm_reglages', 'general')) ?? {};
  if (!reglages.signature) return { creees: 0, expirees: 0, raison: 'signature à régler' };
  // Les champs du questionnaire : la réponse envoyée par l'app passe avant Mixpanel dans le dossier (INT-EW-79).
  const inscrits = await db.lister('users', ['revenuecat_id', 'locale', 'is_test_user', 'created_at', 'churn_survey_reason', 'churn_survey_text', 'churn_survey_answered_at']);
  const fiches = new Map((await db.lister('crm_fiches')).map((f) => [f.id, f]));
  const choixLangue = (cle) => fiches.get(cle)?.langue ?? null;
  let creees = 0; let erreurs = 0;
  const existantes = new Map((await db.lister('crm_actions')).map((a) => [a.id, a]));
  for (const c of candidats(faits, inscrits, maintenant)) {
    // Une seule résiliation par personne, quel que soit le départ (Q-EW-63, 23/11) : une personne qui revient puis
    // repart n'a pas de second e-mail. L'ancien nom (avant le 22/11, sans user_id) compte aussi.
    if (c.type === 'resiliation' && (existantes.has(`resiliation__${cleUtilisateur(c.user.id)}`)
      || [...existantes.values()].some((a) => a.type === 'resiliation' && a.user_id === c.user.id))) continue;
    // Un même départ vu par la fiche Firebase puis par la base Mixpanel (EW-55) : une action de ce type pour cette
    // personne dans les 7 jours suffit.
    if (['resiliation', 'essai_annule'].includes(c.type) && [...existantes.values()].some((a) => a.type === c.type && a.user_id === c.user.id
      && Math.abs(new Date(a.cree_le).getTime() - c.fait.temps) <= FENETRE_RESILIATION)) continue;
    const { id, ...champs } = actionDe(c, { tournees, signature: reglages.signature, maintenant, dossierPour, choixLangue });
    try { await db.creer('crm_actions', id, champs); existantes.set(id, { id, ...champs }); creees += 1; } catch (erreur) {
      if (!/existe déjà/.test(String(erreur?.message))) erreurs += 1;
    }
  }
  // La bienvenue se prépare toujours, une par personne ; tant qu'elle est en essai (INT-EW-94, par défaut), elle ne part
  // qu'à l'adresse de test du fondateur.
  {
    for (const u of bienvenues(inscrits, maintenant)) {
      const fiche = fiches.get(cleUtilisateur(u.id)) ?? {};
      // Un désinscrit ou une adresse en rebond : pas d'action (la porte l'aurait bloquée, mais elle s'affichait et sonnait).
      if (existantes.has(`bienvenue__${cleUtilisateur(u.id)}`) || fiche.desinscrit || fiche.adresse_invalide) continue;
      // Un dossier illisible ne casse pas la passe (expiration comprise), comme `dossierSur` dans contacter.mjs.
      let pays = null;
      if (u.revenuecat_id) { try { pays = dossierPour?.(u.revenuecat_id, u)?.pays ?? null; } catch { pays = null; } }
      const { id, ...champs } = actionBienvenue(u, { signature: reglages.signature, maintenant, pays, choix: choixLangue(cleUtilisateur(u.id)) });
      try { await db.creer('crm_actions', id, champs); existantes.set(id, { id, ...champs }); creees += 1; } catch (erreur) {
        if (!/existe déjà/.test(String(erreur?.message))) erreurs += 1;
      }
    }
  }
  let expirees = 0;
  for (const a of await db.lister('crm_actions')) {
    if (['prete', 'reportee'].includes(a.statut) && a.echeance && new Date(a.echeance) < maintenant) {
      await db.ecrire('crm_actions', a.id, { statut: 'expiree', maj_le: maintenant });
      expirees += 1;
    }
  }
  return { creees, expirees, ...(erreurs ? { erreurs } : {}), sans_inscrit: annulationsSansInscrit(faits, inscrits, maintenant) };
}
