// La seule porte d'envoi d'e-mails aux utilisateurs (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.0 et § 4).
// Tout envoi passe par envoyerAction : coupe-circuit, mode à blanc, anti-doublon, désinscription,
// abonnement relu chez RevenueCat, écart de 72 h, plafond du jour, adresse de test.
import { createHash } from 'node:crypto';
import { WHATSAPP, langueDe } from './langues.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const PLAFOND_JOUR = 90; // Resend gratuit : 100 par jour
export const ECART_HEURES = 72;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const cleUtilisateur = (userId) => createHash('sha256').update(String(userId)).digest('hex').slice(0, 24);

// Plus de pied « répondez STOP » (fondateur, 22/11 : « on ne met pas le STOP dans les mails »). La désinscription
// reste possible depuis la fiche. À la place, s'il est réglé, le lien WhatsApp du fondateur (EW-53).
export const lienWhatsapp = (numero) => (/^\d{8,15}$/.test(String(numero ?? '')) ? `https://wa.me/${numero}` : null);
export function piedDePage(langue, whatsapp) {
  const lien = lienWhatsapp(whatsapp);
  return lien ? `\n\n${WHATSAPP[langueDe(langue)](lien)}` : '';
}

// Ce que RevenueCat dit de l'abonnement, réduit à ce qui décide un envoi.
export function lireAbonne(abonne, maintenant) {
  const subs = Object.values(abonne?.subscriber?.subscriptions ?? {});
  const actifs = subs.filter((s) => s.expires_date && new Date(s.expires_date) > maintenant && !s.refunded_at);
  const essai = actifs.find((s) => s.period_type === 'trial');
  const payant = actifs.find((s) => s.period_type !== 'trial');
  return {
    aucun: subs.length === 0,
    // Un abonnement payé arrêté par la personne et déjà échu : toujours un résilié (l'e-mail garde ses 7 jours).
    payant_parti: !payant && subs.some((s) => s.period_type !== 'trial' && s.unsubscribe_detected_at && !s.refunded_at),
    essai_en_cours: Boolean(essai && !essai.unsubscribe_detected_at),
    essai_fin: essai?.expires_date ?? null,
    payant_annule: Boolean(payant && payant.unsubscribe_detected_at),
    payant_actif: Boolean(payant && !payant.unsubscribe_detected_at),
  };
}

// Le garde-fou propre à chaque type d'envoi, d'après l'abonnement relu juste avant.
export function gardeFouType(type, ab, maintenant, filtre = null) {
  if (type === 'essai_j2') {
    if (!ab.essai_en_cours || ab.payant_actif) return 'déjà payé ou annulé';
    if (new Date(ab.essai_fin).getTime() - maintenant.getTime() < 12 * 3600 * 1000) return 'trop tard';
  }
  if (type === 'resiliation' && !ab.payant_annule && !ab.payant_parti) return 'plus résilié';
  if (type === 'essai_annule' && (ab.essai_en_cours || ab.payant_actif)) return 'a repris son essai ou payé';
  if (type === 'onboarding' && !ab.aucun) return 'déjà abonné';
  // Une campagne visait un public à sa préparation : il est relu avant chaque envoi (audit du 22/11).
  if (['campagne', 'campagne_relance'].includes(type) && filtre === 'payants' && !ab.payant_actif) return 'plus payant';
  if (['campagne', 'campagne_relance'].includes(type) && filtre === 'essais' && !ab.essai_en_cours) return 'plus en essai';
  return null;
}

const debutJourParis = (d) => {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  const decalage = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getTime() - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(new Date(`${jour}T00:00:00Z`).getTime() - decalage);
};

export function porteEnvoi({ db, envoyerResend, lireRevenueCat, maintenant = () => new Date() }) {
  async function bloquer(action, raison, definitif) {
    if (definitif) await db.ecrire('crm_actions', action.id, { statut: 'bloquee', raison, maj_le: maintenant() });
    return { statut: 'bloquee', raison };
  }

  return {
    // canal : 'email' (au destinataire) ou 'test_moi' (le texte part à l'adresse de test, l'action ne bouge pas).
    async envoyerAction(actionId, { canal = 'email' } = {}) {
      const t = maintenant();
      const reglages = (await db.lire('crm_reglages', 'general')) ?? { envois_coupes: true, a_blanc: true };
      if (reglages.envois_coupes !== false) return { statut: 'bloquee', raison: 'envois coupés' };
      for (const champ of ['expediteur', 'repondre_a', 'adresse_test']) {
        if (!EMAIL.test(String(reglages[champ] ?? '').replace(/^.*<|>$/g, ''))) return { statut: 'bloquee', raison: `réglage manquant : ${champ}` };
      }
      const action = await db.lire('crm_actions', actionId);
      if (!action) return { statut: 'bloquee', raison: 'action introuvable' };
      const user = await db.lire('users', action.user_id);
      const fiche = (await db.lire('crm_fiches', cleUtilisateur(action.user_id))) ?? {};
      const texte = `${action.corps}${piedDePage(action.langue ?? user?.locale, reglages.whatsapp)}`;

      if (canal === 'test_moi') {
        if (reglages.a_blanc !== false) return { statut: 'a_blanc', raison: 'essai à blanc' };
        await envoyerResend({ from: reglages.expediteur, to: reglages.adresse_test, reply_to: reglages.repondre_a,
          subject: `[ESSAI] ${action.sujet}`, text: texte }, `${actionId}__essai__${t.getTime()}`);
        await db.ajouter('crm_journal', { le: t, quoi: `essai envoyé à l'adresse de test (${action.type})`, rc: user?.revenuecat_id ?? null });
        return { statut: 'envoye', raison: 'adresse de test' };
      }

      if (action.statut !== 'prete') return bloquer(action, 'déjà traitée', false);
      // La traduction française a été corrigée : le texte dans la langue de la personne doit être refait d'abord.
      if (action.a_retraduire) return { statut: 'bloquee', raison: 'traduction à refaire' };
      // Un point à vérifier (titre à traduire, usage inconnu) : le fondateur le lève en corrigeant le texte ou par « C'est vérifié ».
      if (action.a_verifier) return { statut: 'bloquee', raison: `à vérifier : ${action.a_verifier}` };
      // Le verrou d'envoi. Après une erreur de Resend, ou un envoi coupé en route depuis plus de 10 minutes (moins de
      // 23 h : la clé d'idempotence de Resend dure 24 h, un second essai ne fait pas de double), on peut réessayer.
      const verrou = await db.lire('crm_envois', actionId);
      const age = verrou?.le ? t.getTime() - new Date(verrou.le).getTime() : 0;
      const reprise = Boolean(verrou) && (verrou.statut === 'erreur' || verrou.statut === 'a_blanc'
        || (verrou.statut === 'en_cours' && age > 10 * 60000 && age < 23 * 3600000));
      if (verrou && !reprise) return bloquer(action, verrou.statut === 'en_cours' && age >= 23 * 3600000 ? 'envoi coupé il y a plus de 23 h : vérifier dans Resend' : 'déjà envoyé', false);
      if (fiche.desinscrit) return bloquer(action, 'désinscrit', true);
      if (!user || !EMAIL.test(user.id)) return bloquer(action, "pas d'adresse", true);
      if (action.type === 'campagne_relance') {
        const membre = await db.lire('crm_membres', `${action.campagne_id}__${cleUtilisateur(action.user_id)}`);
        if (!membre || ['repondu', 'exclu'].includes(membre.statut)) return bloquer(action, 'a répondu', true);
        // Une réponse arrivée par Gmail ou notée à la main après l'envoi de la campagne vaut réponse.
        if (fiche.a_repondu_le && membre.envoye_le && new Date(fiche.a_repondu_le) > new Date(membre.envoye_le)) return bloquer(action, 'a répondu', true);
      }
      if (action.echeance && t > new Date(action.echeance)) {
        await db.ecrire('crm_actions', action.id, { statut: 'expiree', maj_le: t });
        return { statut: 'bloquee', raison: 'trop tard' };
      }
      const campagneCiblee = ['campagne', 'campagne_relance'].includes(action.type) && ['payants', 'essais'].includes(action.filtre);
      if (['essai_j2', 'resiliation', 'essai_annule', 'onboarding'].includes(action.type) || campagneCiblee) {
        if (!user.revenuecat_id) return bloquer(action, "pas d'identifiant RevenueCat", true);
        const raison = gardeFouType(action.type, lireAbonne(await lireRevenueCat(user.revenuecat_id), t), t, action.filtre ?? null);
        if (raison) return bloquer(action, raison, true);
      }
      // « Ton bug est corrigé » répond à sa demande : l'écart de 72 h ne le retient pas.
      if (action.type !== 'bug_corrige' && fiche.dernier_envoi_le && t.getTime() - new Date(fiche.dernier_envoi_le).getTime() < ECART_HEURES * 3600 * 1000) {
        return { statut: 'bloquee', raison: 'trop tôt' };
      }
      const depuis = debutJourParis(t);
      // Le plafond compte les vrais envois et ceux en route, pas les essais à blanc.
      const duJour = (await db.lister('crm_envois')).filter((e) => ['envoye', 'en_cours'].includes(e.statut) && new Date(e.le) >= depuis);
      if (duJour.length >= (reglages.plafond_jour ?? PLAFOND_JOUR)) return { statut: 'bloquee', raison: 'plafond du jour' };

      const test = Boolean(user.is_test_user || fiche.test);
      const destinataire = test ? reglages.adresse_test : user.id;
      const champsVerrou = { le: t, statut: 'en_cours', type: action.type, rc: user.revenuecat_id ?? null,
        destinataire_reel: test ? 'adresse_test' : 'utilisateur', sujet: action.sujet, texte };
      if (reglages.a_blanc !== false) {
        // À blanc : noté, mais l'action reste prête et rien ne compte comme envoyé (ni l'écart de 72 h, ni une relance).
        await db.ecrire('crm_envois', actionId, { ...champsVerrou, statut: 'a_blanc' });
        await db.ecrire('crm_actions', actionId, { a_blanc_le: t, maj_le: t });
        return { statut: 'a_blanc' };
      }
      if (reprise) await db.ecrire('crm_envois', actionId, { ...champsVerrou, reprise_de: verrou.statut });
      else {
        try { await db.creer('crm_envois', actionId, champsVerrou); } catch (erreur) {
          if (/existe déjà/.test(String(erreur?.message))) return { statut: 'bloquee', raison: 'déjà envoyé' };
          return { statut: 'erreur', raison: `verrou impossible : ${erreur?.message}` };
        }
      }
      const envoiAvant = fiche.dernier_envoi_le ?? null;
      await db.ecrire('crm_fiches', cleUtilisateur(action.user_id), { user_id: action.user_id, dernier_envoi_le: t, maj_le: t });
      try {
        const { id } = await envoyerResend({ from: reglages.expediteur, to: destinataire, reply_to: reglages.repondre_a, subject: action.sujet, text: texte }, actionId);
        await db.ecrire('crm_envois', actionId, { statut: 'envoye', resend_id: id ?? null });
        await db.ecrire('crm_actions', actionId, { statut: 'envoyee', maj_le: t });
        return { statut: 'envoye' };
      } catch (erreur) {
        // Rien n'est parti : l'action reste prête pour un nouvel essai, et la personne n'est pas retenue 72 h.
        await db.ecrire('crm_envois', actionId, { statut: 'erreur', erreur: String(erreur.message).slice(0, 300) });
        await db.ecrire('crm_actions', actionId, { derniere_erreur: String(erreur.message).slice(0, 300), maj_le: t });
        await db.ecrire('crm_fiches', cleUtilisateur(action.user_id), { dernier_envoi_le: envoiAvant, maj_le: t });
        return { statut: 'erreur', raison: erreur.message };
      }
    },
  };
}

// Les vrais services, avec les clés du trousseau (TODO-EW-9). Rien n'est affiché.
async function cleTrousseau(service) {
  const { stdout } = await run('security', ['find-generic-password', '-s', service, '-w']);
  return stdout.trim();
}

export function resendReel({ fetcher = fetch } = {}) {
  return async (message, idempotence) => {
    const reponse = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await cleTrousseau('easyway-crm-resend')}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotence },
      body: JSON.stringify(message),
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok) throw new Error(`Resend ${reponse.status} : ${corps.message ?? ''}`);
    return corps;
  };
}

export function revenueCatReel({ fetcher = fetch } = {}) {
  return async (rc) => {
    const reponse = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rc)}`, {
      headers: { Authorization: `Bearer ${await cleTrousseau('easyway-crm-revenuecat')}` },
    });
    if (!reponse.ok) throw new Error(`RevenueCat ${reponse.status}`);
    return reponse.json();
  };
}
