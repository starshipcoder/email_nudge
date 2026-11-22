// Prépare les actions du jour à partir de la base Mixpanel du Mac (événements que RevenueCat y envoie)
// et des inscrits d'email_nudge. Rien ne part d'ici : la porte d'envoi relit RevenueCat avant chaque e-mail.
import { cleUtilisateur } from './envoi.mjs';
import { arreter, dateFin, rendre, rendreAvecTraduction } from './modeles.mjs';
import { brouillonAvecTraduction, resumer } from './dossier.mjs';
import { langueDePersonne } from './langues.mjs';

const H = 3600 * 1000;
const FENETRE_J2 = [24 * H, 60 * H]; // fin d'essai entre 24 h et 60 h d'ici
const FENETRE_RESILIATION = 7 * 24 * H;

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

export function candidats(faits, inscrits, maintenant) {
  const parRc = new Map();
  for (const u of inscrits) if (u.revenuecat_id) parRc.set(u.revenuecat_id, u);
  const inscritDe = (f) => f.ids.map((i) => parRc.get(i)).find(Boolean);
  const apres = (f, noms) => faits.some((g) => g.transaction === f.transaction && g.temps > f.temps && noms.includes(g.nom));
  const t = maintenant.getTime();
  const essais = faits.filter((f) => f.nom === 'rc_trial_started_event' && f.fin)
    .filter((f) => { const reste = new Date(f.fin).getTime() - t; return reste >= FENETRE_J2[0] && reste <= FENETRE_J2[1]; })
    .filter((f) => !apres(f, ['rc_trial_cancelled_event', 'rc_trial_converted_event', 'rc_expiration_event']))
    .map((f) => ({ type: 'essai_j2', fait: f, user: inscritDe(f) })).filter((c) => c.user);
  // Seul un arrêt par la personne : pas un remboursement (CUSTOMER_SUPPORT), une décision du développeur ou un défaut de carte.
  const resiliations = faits.filter((f) => f.nom === 'rc_cancellation_event' && f.type === 'NORMAL' && f.raison === 'UNSUBSCRIBE')
    .filter((f) => t - f.temps <= FENETRE_RESILIATION)
    .filter((f) => !apres(f, ['rc_uncancellation_event', 'rc_renewal_event']))
    .map((f) => ({ type: 'resiliation', fait: f, user: inscritDe(f) })).filter((c) => c.user);
  // L'annulation d'un essai (EW-52) : sauf si la personne a payé ou repris ensuite, quel que soit l'abonnement.
  const paieEnsuite = (f) => faits.some((g) => g.temps > f.temps && g.ids.some((i) => f.ids.includes(i))
    && ['rc_initial_purchase_event', 'rc_trial_converted_event', 'rc_uncancellation_event', 'rc_renewal_event'].includes(g.nom));
  const essaisAnnules = faits.filter((f) => f.nom === 'rc_trial_cancelled_event' && t - f.temps <= FENETRE_RESILIATION && !paieEnsuite(f))
    .map((f) => ({ type: 'essai_annule', fait: f, user: inscritDe(f) })).filter((c) => c.user);
  return [...essais, ...resiliations, ...essaisAnnules];
}

// Sans données sûres (personne non reliée à Mixpanel, ou base de plus d'un jour et demi), le brouillon n'affirme rien
// sur l'usage, et l'action porte un point à vérifier.
const USAGE_VIDE = { tournees: 0, zones: [], signaux: [], premier_jour: null, dernier_jour: null };
const INCONNU = "on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte";
function dossierSur(dossier) {
  if (!dossier) return { d: null, doute: true };
  if (dossier.lie === false || dossier.a_jour?.en_retard) return { d: { ...dossier, usage: { ...dossier.usage, ...USAGE_VIDE } }, doute: true };
  return { d: dossier, doute: false };
}

export function actionDe(c, { tournees, signature, maintenant, dossierPour = null, choixLangue = () => null, enRetard = false }) {
  const cle = cleUtilisateur(c.user.id);
  // Le dossier de la personne, s'il se lit : son pays (pour la langue), son usage et sa réponse au questionnaire.
  const dossier = dossierPour?.(c.user.revenuecat_id) ?? null;
  const l = langueDePersonne({ locale: c.user.locale, pays: dossier?.pays, choix: choixLangue(cle) });
  const langue = l.langue;
  const source = { langue_source: l.source, ...(l.pays ? { pays: l.pays } : {}) };
  if (c.type === 'essai_j2') {
    const lu = tournees(c.user.revenuecat_id);
    const n = lu ?? 0;
    const doute = lu === null || enRetard;
    const { sujet, corps, traduction_fr } = rendreAvecTraduction(n > 0 ? 'essai_j2_usage' : 'essai_j2_peu_usage', langue,
      (lg) => ({ date_fin: dateFin(c.fait.fin, lg), n_tournees: n, arreter: arreter(c.fait.store, lg), signature }));
    return { id: `essai_j2__${cle}__${c.fait.transaction}`, type: 'essai_j2', variante: n > 0 ? 'usage' : 'peu_usage', user_id: c.user.id,
      statut: 'prete', sujet, corps, langue, ...source, ...(traduction_fr ? { traduction_fr } : {}),
      ...(doute && n === 0 ? { a_verifier: "le texte dit qu'elle n'a pas lancé de tournée, mais ses données Mixpanel manquent ou sont en retard" } : {}),
      echeance: new Date(new Date(c.fait.fin).getTime() - 12 * H), cree_le: maintenant };
  }
  if (c.type === 'essai_annule') {
    // Sans dossier, un dossier vide : l'ouverture, la question ouverte et la fin, sans fait inventé.
    const { d: sur, doute } = dossierSur(dossier);
    const d = sur ?? { questionnaire: null, usage: USAGE_VIDE };
    const { sujet, corps, traduction_fr } = brouillonAvecTraduction(d, langue, signature, 'essai');
    return { id: `essai_annule__${cle}__${c.fait.transaction}`, type: 'essai_annule', user_id: c.user.id, statut: 'prete', sujet, corps, langue, ...source,
      ...(traduction_fr ? { traduction_fr } : {}), ...(doute ? { a_verifier: INCONNU } : {}),
      ...(dossier ? { variante: 'dossier', resume: resumer(dossier, maintenant) } : {}),
      echeance: new Date(c.fait.temps + FENETRE_RESILIATION), cree_le: maintenant };
  }
  const { d: sur, doute } = dossierSur(dossier);
  const { sujet, corps, traduction_fr } = sur ? brouillonAvecTraduction(sur, langue, signature) : rendreAvecTraduction('resiliation', langue, () => ({ signature }));
  // Une résiliation par abonnement : une personne qui revient puis repart a de nouveau son e-mail.
  return { id: `resiliation__${cle}__${c.fait.transaction}`, type: 'resiliation', user_id: c.user.id, statut: 'prete', sujet, corps, langue, ...source,
    ...(traduction_fr ? { traduction_fr } : {}), ...(doute && dossier ? { a_verifier: INCONNU } : {}),
    ...(dossier ? { variante: 'dossier', resume: resumer(dossier, maintenant) } : {}),
    echeance: new Date(c.fait.temps + FENETRE_RESILIATION), cree_le: maintenant };
}

// Une passe : crée les actions qui n'existent pas encore (le même identifiant ne se crée jamais deux fois),
// et passe en « expirée » celles dont l'échéance est passée.
export async function preparer({ db, faits, tournees, maintenant = new Date(), dossierPour = null, enRetard = false }) {
  const reglages = (await db.lire('crm_reglages', 'general')) ?? {};
  if (!reglages.signature) return { creees: 0, expirees: 0, raison: 'signature à régler' };
  const inscrits = await db.lister('users', ['revenuecat_id', 'locale', 'is_test_user']);
  const fiches = new Map((await db.lister('crm_fiches')).map((f) => [f.id, f]));
  const choixLangue = (cle) => fiches.get(cle)?.langue ?? null;
  let creees = 0; let erreurs = 0;
  const existantes = new Map((await db.lister('crm_actions')).map((a) => [a.id, a]));
  for (const c of candidats(faits, inscrits, maintenant)) {
    // L'ancien nom d'une résiliation (avant le 22/11, une par personne) : celle déjà écrite pour ce départ ne se double pas.
    const ancienne = c.type === 'resiliation' ? existantes.get(`resiliation__${cleUtilisateur(c.user.id)}`) : null;
    if (ancienne && new Date(ancienne.cree_le).getTime() >= c.fait.temps) continue;
    const { id, ...champs } = actionDe(c, { tournees, signature: reglages.signature, maintenant, dossierPour, choixLangue, enRetard });
    try { await db.creer('crm_actions', id, champs); creees += 1; } catch (erreur) {
      if (!/existe déjà/.test(String(erreur?.message))) erreurs += 1;
    }
  }
  let expirees = 0;
  for (const a of await db.lister('crm_actions')) {
    if (['prete', 'reportee'].includes(a.statut) && a.echeance && new Date(a.echeance) < maintenant) {
      await db.ecrire('crm_actions', a.id, { statut: 'expiree', maj_le: maintenant });
      expirees += 1;
    }
  }
  return { creees, expirees, ...(erreurs ? { erreurs } : {}) };
}
