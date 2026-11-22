// Les retours de livraison (INT-EW-76) : « envoyé » veut seulement dire « accepté par Resend ». À chaque passe, Iris relit
// chez Resend l'état des e-mails envoyés depuis 14 jours (une plainte peut venir après la remise). Un rebond marque
// l'adresse comme mauvaise (la porte ne lui écrit plus) ; une plainte désinscrit la personne. Aucune adresse n'en sort.
import { cleUtilisateur } from './envoi.mjs';

const JOUR = 86400000;
export const FENETRE_LIVRAISON = 14 * JOUR;
const DEFINITIFS = new Set(['bounced', 'complained']);
export const NOMS_LIVRAISON = { delivered: 'remis', bounced: 'rebond', complained: 'plainte', delivery_delayed: 'retardé', sent: 'en route', opened: 'remis', clicked: 'remis' };

export function resendLecture({ fetcher = fetch, cle }) {
  return async (id) => {
    const r = await fetcher(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${await cle()}` } });
    if (!r.ok) throw new Error(`Resend ${r.status}`);
    return r.json();
  };
}

// lireEmail(resendId) rend l'e-mail de Resend ({ last_event }). attente : entre deux lectures (Resend : 2 par seconde).
export async function relireLivraisons({ db, lireEmail, maintenant = new Date(), attente = () => new Promise((r) => setTimeout(r, 600)) }) {
  const t = maintenant.getTime();
  const envois = (await db.lister('crm_envois')).filter((e) => e.statut === 'envoye' && e.resend_id && !DEFINITIFS.has(e.livraison)
    && t - new Date(e.le).getTime() <= FENETRE_LIVRAISON);
  const actions = new Map((await db.lister('crm_actions')).map((a) => [a.id, a]));
  const bilan = { lus: 0, rebonds: [], plaintes: [], erreur: null };
  for (const [i, e] of envois.entries()) {
    if (i) await attente();
    let etat;
    try { etat = (await lireEmail(e.resend_id))?.last_event ?? null; } catch (erreur) { bilan.erreur = String(erreur?.message ?? erreur).slice(0, 80); break; }
    bilan.lus += 1;
    if (!etat || etat === e.livraison) continue;
    await db.ecrire('crm_envois', e.id, { livraison: etat, livraison_le: maintenant });
    const a = actions.get(e.id);
    if (!a || !DEFINITIFS.has(etat)) continue;
    const cle = cleUtilisateur(a.user_id);
    if (etat === 'bounced') {
      await db.ecrire('crm_fiches', cle, { user_id: a.user_id, adresse_invalide: true, adresse_invalide_le: maintenant, maj_le: maintenant });
      await db.ajouter('crm_journal', { le: maintenant, quoi: `rebond : l'adresse ne reçoit pas (${a.type}), plus d'envoi`, rc: e.rc ?? null });
      bilan.rebonds.push({ id: e.id, type: a.type });
    } else {
      await db.ecrire('crm_fiches', cle, { user_id: a.user_id, desinscrit: true, desinscrit_le: maintenant, raison_desinscription: 'plainte', maj_le: maintenant });
      await db.ajouter('crm_journal', { le: maintenant, quoi: `plainte pour courrier indésirable (${a.type}) : désinscrit`, rc: e.rc ?? null });
      bilan.plaintes.push({ id: e.id, type: a.type });
    }
  }
  return bilan;
}
