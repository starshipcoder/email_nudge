// Les campagnes : écrire à un groupe d'utilisateurs de l'app, noter qui a répondu, relancer les autres
// (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.2 et § 3.6, E6 et E7). Tout envoi passe par la porte d'envoi.
// Une campagne ne vise que des inscrits de l'app (essais, payants, actifs), jamais une liste venue d'ailleurs.
import { randomBytes } from 'node:crypto';
import { cleUtilisateur } from './envoi.mjs';
import { CHAMPS_USERS, ligneUtilisateur } from './suivi.mjs';
import { langueCampagne } from './langues.mjs';

const JOUR = 86400000;
export const MAX_MEMBRES = 300;
const ARRETS = new Set(['envois coupés', 'plafond du jour', 'trop tôt']);

export const FILTRES_CAMPAGNE = {
  payants: (l) => l.etat === 'payant',
  essais: (l) => l.etat === 'essai',
  actifs_30j: (l, t) => ['payant', 'essai'].includes(l.etat) || Boolean(l.dernier_signe && t - new Date(l.dernier_signe).getTime() <= 30 * JOUR),
};

const estTest = (nom) => /^TEST\b/.test(nom);
const membreId = (campagneId, userId) => `${campagneId}__${cleUtilisateur(userId)}`;

// Seule {{signature}} se remplace : un texte qui en attend une autre ne passe pas.
function rendreTexte(texte, signature) {
  const reste = String(texte).match(/\{\{(?!signature\}\})(\w*)\}\}/);
  if (reste) throw new Error(`Variable inconnue dans le texte : ${reste[1]} (seule {{signature}} existe).`);
  return String(texte).replaceAll('{{signature}}', signature);
}

export function verifierCampagne(brut) {
  const nom = String(brut.nom ?? '').trim();
  if (!nom || nom.length > 80) throw new Error('Le nom fait de 1 à 80 caractères.');
  if (!(brut.filtre in FILTRES_CAMPAGNE)) throw new Error('Choisir un filtre : payants, essais ou actifs sur 30 jours.');
  if (!['fr', 'en'].includes(brut.langue)) throw new Error('Choisir la langue du texte : fr ou en.');
  const sujet = String(brut.sujet ?? '').trim();
  const corps = String(brut.corps ?? '');
  if (!sujet || sujet.length > 150 || !corps.trim() || corps.length > 5000) throw new Error('Sujet (150 caractères) et texte (5 000) requis.');
  const avecRelance = brut.relance_apres_jours !== null && brut.relance_apres_jours !== undefined && brut.relance_apres_jours !== '';
  const relance = avecRelance ? Number(brut.relance_apres_jours) : null;
  // 3 jours au moins : la porte refuse deux e-mails à la même personne en moins de 72 h.
  if (avecRelance && (!Number.isInteger(relance) || relance < 3 || relance > 30)) throw new Error('La relance part de 3 à 30 jours après l’envoi.');
  const relanceSujet = String(brut.relance_sujet ?? '').trim();
  const relanceCorps = String(brut.relance_corps ?? '');
  if (avecRelance && (!relanceSujet || !relanceCorps.trim())) throw new Error('Une relance prévue demande son sujet et son texte.');
  for (const t of [corps, relanceCorps, sujet, relanceSujet]) rendreTexte(t, 'x');
  // L'hypothèse de la campagne (INT-EW-75) : libre au brouillon, obligatoire pour préparer et envoyer (manqueHypothese).
  const hypo = Object.fromEntries(CHAMPS_HYPOTHESE.map(([k]) => [k, String(brut[k] ?? '').trim().slice(0, 500)]));
  if (hypo.lecture && !/^\d{4}-\d{2}-\d{2}$/.test(hypo.lecture)) throw new Error('La date de lecture s’écrit 2027-01-31.');
  return { nom, filtre: brut.filtre, langue: brut.langue, sujet, corps, relance_apres_jours: relance, relance_sujet: relanceSujet, relance_corps: relanceCorps, ...hypo };
}

// Fondateur, 22/11 : chaque campagne écrit son hypothèse, sa mesure, son seuil et sa date de lecture avant de partir.
// Une campagne TEST en est dispensée.
export const CHAMPS_HYPOTHESE = [['hypothese', 'l’hypothèse'], ['mesure', 'la mesure'], ['seuil', 'le seuil'], ['lecture', 'la date de lecture']];
export function manqueHypothese(c) {
  if (estTest(c.nom ?? '')) return [];
  return CHAMPS_HYPOTHESE.filter(([k]) => !String(c[k] ?? '').trim()).map(([, nom]) => nom);
}
const exigerHypothese = (c) => {
  const manque = manqueHypothese(c);
  if (manque.length) throw new Error(`Avant de partir, la campagne doit écrire ${manque.join(', ')}.`);
};

export function campagnes(db, { porte, maintenant = () => new Date() }) {
  async function lireCampagne(id) {
    const c = await db.lire('crm_campagnes', id);
    if (!c) throw new Error('Campagne introuvable.');
    return c;
  }
  async function membresDe(id) {
    return (await db.lister('crm_membres')).filter((m) => m.campagne_id === id);
  }
  async function concernes(c) {
    const t = maintenant().getTime();
    const fiches = new Map((await db.lister('crm_fiches')).map((f) => [f.id, f]));
    return (await db.lister('users', CHAMPS_USERS)).map(ligneUtilisateur)
      .filter((l) => (estTest(c.nom) ? l.test : !l.test))
      .filter((l) => FILTRES_CAMPAGNE[c.filtre](l, t) && langueCampagne(l.langue) === c.langue)
      .filter((l) => !fiches.get(cleUtilisateur(l.id))?.desinscrit)
      .map((l) => l.id).sort();
  }
  // Après un envoi : le membre suit l'action.
  async function suivreMembre(action, r) {
    const id = membreId(action.campagne_id, action.user_id);
    const t = maintenant();
    // Seul un vrai envoi compte : un envoi à blanc ne fait pas un membre « envoyé », donc pas de relance (audit du 22/11).
    if (r.statut === 'envoye') {
      await db.ecrire('crm_membres', id, action.type === 'campagne' ? { statut: 'envoye', envoye_le: t } : { statut: 'relance', relance_le: t });
    } else if (r.statut === 'bloquee' && !ARRETS.has(r.raison) && !/^réglage manquant/.test(r.raison) && action.type === 'campagne') {
      await db.ecrire('crm_membres', id, { statut: 'exclu', raison_exclusion: r.raison });
    }
  }

  return {
    async liste() {
      const membres = await db.lister('crm_membres');
      return (await db.lister('crm_campagnes')).map((c) => {
        const ms = membres.filter((m) => m.campagne_id === c.id);
        const n = (s) => ms.filter((m) => s.includes(m.statut)).length;
        return { ...c, nb_membres: ms.length, nb_envoyes: n(['envoye', 'repondu', 'relance']), nb_repondus: n(['repondu']), nb_relances: n(['relance']) };
      }).sort((a, b) => String(b.cree_le ?? '').localeCompare(String(a.cree_le ?? '')));
    },
    async une(id) {
      const membres = (await membresDe(id)).sort((a, b) => a.user_id.localeCompare(b.user_id));
      const n = (st) => membres.filter((m) => st.includes(m.statut)).length;
      return { ...(await lireCampagne(id)), membres, nb_envoyes: n(['envoye', 'repondu', 'relance']), nb_repondus: n(['repondu']) };
    },
    async creer(brut) {
      const champs = verifierCampagne(brut);
      const t = maintenant();
      const id = `c${t.getTime().toString(36)}${randomBytes(3).toString('hex')}`;
      await db.creer('crm_campagnes', id, { ...champs, statut: 'brouillon', cree_le: t, maj_le: t });
      return id;
    },
    async modifier(id, brut) {
      const c = await lireCampagne(id);
      if (c.statut !== 'brouillon') throw new Error('Seul un brouillon se modifie.');
      await db.ecrire('crm_campagnes', id, { ...verifierCampagne(brut), maj_le: maintenant() });
      return this.une(id);
    },
    async apercu(id) {
      const ids = await concernes(await lireCampagne(id));
      return { membres: ids.length, ids };
    },
    // Fige les membres et crée une action par membre, avec la signature des réglages.
    async preparer(id) {
      const c = await lireCampagne(id);
      if (!['brouillon', 'en_preparation'].includes(c.statut)) throw new Error('Seul un brouillon se prépare.');
      exigerHypothese(c);
      await db.ecrire('crm_campagnes', id, { statut: 'en_preparation', maj_le: maintenant() });
      const { signature } = (await db.lire('crm_reglages', 'general')) ?? {};
      if (!signature) throw new Error('Régler la signature d’abord.');
      const ids = await concernes(c);
      if (!ids.length) throw new Error('Personne n’est concerné.');
      if (ids.length > MAX_MEMBRES) throw new Error(`Plus de ${MAX_MEMBRES} personnes : trop pour l’offre gratuite de Resend.`);
      const t = maintenant();
      const rendu = { sujet: rendreTexte(c.sujet, signature), corps: rendreTexte(c.corps, signature),
        relance_sujet: c.relance_apres_jours ? rendreTexte(c.relance_sujet, signature) : null, relance_corps: c.relance_apres_jours ? rendreTexte(c.relance_corps, signature) : null };
      // Reprenable : une préparation coupée en route se relance, ce qui existe déjà est gardé tel quel.
      const deja = (erreur) => { if (!/existe déjà/.test(String(erreur?.message))) throw erreur; };
      for (const userId of ids) {
        const cle = cleUtilisateur(userId);
        await db.creer('crm_membres', membreId(id, userId), { campagne_id: id, user_id: userId, statut: 'a_envoyer' }).catch(deja);
        await db.creer('crm_actions', `campagne__${cle}__${id}`, { type: 'campagne', campagne_id: id, user_id: userId, statut: 'prete', filtre: c.filtre,
          sujet: rendu.sujet, corps: rendu.corps, langue: c.langue, echeance: new Date(t.getTime() + 30 * JOUR), cree_le: t }).catch(deja);
      }
      await db.ecrire('crm_campagnes', id, { statut: 'preparee', rendu, prepare_le: t, maj_le: t });
      return { membres: ids.length };
    },
    // Envoie les prêtes jusqu'au plafond ; le reste partira au prochain clic.
    async envoyer(id) {
      const c = await lireCampagne(id);
      if (!['preparee', 'en_cours'].includes(c.statut)) throw new Error('Campagne ni préparée ni en cours.');
      exigerHypothese(c);
      const pretes = (await db.lister('crm_actions')).filter((a) => a.campagne_id === id && a.type === 'campagne' && a.statut === 'prete')
        .sort((a, b) => a.id.localeCompare(b.id));
      let envoyes = 0; let bloques = 0; let restants = 0;
      for (const [i, a] of pretes.entries()) {
        const r = await porte.envoyerAction(a.id);
        await suivreMembre(a, r);
        if (r.statut === 'envoye') envoyes += 1;
        else if (r.statut === 'a_blanc') { envoyes += 1; continue; }
        else if (r.statut === 'bloquee' && (ARRETS.has(r.raison) || /^réglage manquant/.test(r.raison))) {
          if (r.raison === 'trop tôt') { restants += 1; continue; }
          restants += pretes.length - i;
          break;
        } else bloques += 1;
      }
      await db.ecrire('crm_campagnes', id, { statut: 'en_cours', maj_le: maintenant() });
      return { envoyes, bloques, restants };
    },
    // Envoi d'une relance (depuis Aujourd'hui) : par la porte, puis le membre suit.
    async envoyerUne(actionId, options) {
      const a = await db.lire('crm_actions', actionId);
      const r = await porte.envoyerAction(actionId, options);
      if (a?.campagne_id && options?.canal !== 'test_moi') await suivreMembre(a, r);
      return r;
    },
    async repondu(id, userId) {
      const m = await db.lire('crm_membres', membreId(id, userId));
      if (!m) throw new Error('Pas membre de cette campagne.');
      const t = maintenant();
      await db.ecrire('crm_membres', membreId(id, userId), { statut: 'repondu', repondu_le: t });
      await db.ecrire('crm_fiches', cleUtilisateur(userId), { user_id: userId, a_repondu_le: t, maj_le: t });
      const relance = await db.lire('crm_actions', `campagne_relance__${cleUtilisateur(userId)}__${id}`);
      if (relance && ['prete', 'reportee'].includes(relance.statut)) await db.ecrire('crm_actions', relance.id, { statut: 'ignoree', raison: 'a répondu', maj_le: t });
      return true;
    },
    async clore(id) {
      await lireCampagne(id);
      await db.ecrire('crm_campagnes', id, { statut: 'close', maj_le: maintenant() });
      return true;
    },
    // À chaque passe : une relance par membre envoyé depuis le délai, sans réponse. Rend le nombre créé.
    async relances() {
      const t = maintenant();
      const ouvertes = (await db.lister('crm_campagnes')).filter((c) => c.statut === 'en_cours' && c.relance_apres_jours && c.rendu?.relance_corps);
      if (!ouvertes.length) return 0;
      const membres = await db.lister('crm_membres');
      let n = 0;
      for (const c of ouvertes) {
        for (const m of membres.filter((x) => x.campagne_id === c.id && x.statut === 'envoye' && x.envoye_le)) {
          if (t.getTime() - new Date(m.envoye_le).getTime() < c.relance_apres_jours * JOUR) continue;
          try {
            await db.creer('crm_actions', `campagne_relance__${cleUtilisateur(m.user_id)}__${c.id}`, { type: 'campagne_relance', campagne_id: c.id,
              user_id: m.user_id, statut: 'prete', filtre: c.filtre, sujet: c.rendu.relance_sujet, corps: c.rendu.relance_corps, langue: c.langue,
              echeance: new Date(t.getTime() + 7 * JOUR), cree_le: t });
            n += 1;
          } catch { /* déjà là */ }
        }
      }
      return n;
    },
  };
}
