// Ce que la page de suivi sait faire, au-dessus d'un client Firestore (vrai ou en mémoire pour les tests).
import { EN_ESSAI_PAR_DEFAUT, SORTES_AUTO } from './sortes.mjs';
export const CHAMPS_USERS = ['first_name', 'phone_number', 'locale', 'role', 'needs', 'revenuecat_id', 'created_at',
  'onboarding_complete', 'paywall_passed', 'trial_active', 'trial_start_date', 'trial_end_date', 'subscription_active',
  'plan', 'churned_at', 'routes_created', 'contacts_total', 'visits_logged', 'is_test_user', 'last_action_at'];

// notif_telephone : les notifications ntfy (INT-EW-72), ouvertes par défaut.
// en_essai : les sortes d'e-mail automatiques qui ne partent pas aux utilisateurs (INT-EW-94, sortes.mjs) ; la
// bienvenue l'est par défaut, tant que le fondateur n'a pas dit oui à son texte.
export const REGLAGES_PAR_DEFAUT = { envois_coupes: true, a_blanc: true, notif_telephone: true, en_essai: EN_ESSAI_PAR_DEFAUT };

export function etat(u) {
  if (u.subscription_active && u.plan && u.plan !== 'trial') return 'payant';
  if (u.trial_active) return 'essai';
  if (u.churned_at) return 'parti';
  return 'gratuit';
}

export function ligneUtilisateur(u) {
  return {
    id: u.id, email: u.id, prenom: u.first_name ?? '', telephone: u.phone_number ?? '', rc: u.revenuecat_id ?? '',
    langue: u.locale ?? '', role: u.role ?? '', besoins: u.needs ?? [], inscrit_le: u.created_at ?? null,
    etat: etat(u), onboarding_fini: Boolean(u.onboarding_complete), paywall_passe: Boolean(u.paywall_passed),
    essai_debut: u.trial_start_date ?? null, essai_fin: u.trial_end_date ?? null, formule: u.plan ?? '',
    parti_le: u.churned_at ?? null, tournees: u.routes_created ?? 0, contacts: u.contacts_total ?? 0,
    visites: u.visits_logged ?? 0, test: Boolean(u.is_test_user), dernier_signe: u.last_action_at ?? null,
  };
}

const FILTRES = {
  essai: (l) => l.etat === 'essai',
  payants: (l) => l.etat === 'payant',
  partis: (l) => l.etat === 'parti',
  tests: (l) => l.test,
  onboarding: (l) => !l.onboarding_fini,
};

export function filtrer(lignes, { q = '', filtre = '' } = {}) {
  const texte = q.trim().toLowerCase();
  return lignes
    .filter((l) => !filtre || (FILTRES[filtre] ?? (() => true))(l))
    .filter((l) => !texte || l.email.toLowerCase().includes(texte) || l.rc === q.trim() || l.prenom.toLowerCase().includes(texte))
    .sort((a, b) => String(b.inscrit_le ?? '').localeCompare(String(a.inscrit_le ?? '')));
}

export function nettoyerPrenom(prenom) {
  const p = String(prenom ?? '').replace(/\s+/g, ' ').trim();
  if (p.length > 60) throw new Error('Le prénom fait plus de 60 caractères.');
  if (/[<>@\n]/.test(p)) throw new Error('Le prénom contient un caractère interdit.');
  return p;
}

export function suivi(db, { maintenant = () => new Date(), dureeCache = 5 * 60 * 1000 } = {}) {
  // La liste des inscrits (1 232 au 22/11, 2 s à relire dans Firestore) : la page ne l'attend jamais. Un cache vieilli
  // est rendu tel quel et relu en arrière-plan ; seul « frais » (le bouton Rafraîchir) ou le premier appel attendent.
  let cache = null;
  let cacheLe = 0;
  let relecture = null;
  const relire = () => {
    relecture ??= db.lister('users', CHAMPS_USERS).then((docs) => {
      cache = docs.map(ligneUtilisateur);
      cacheLe = maintenant().getTime();
      return cache;
    }).finally(() => { relecture = null; });
    return relecture;
  };
  async function utilisateurs({ frais = false } = {}) {
    if (frais || !cache) return relire();
    if (maintenant().getTime() - cacheLe > dureeCache) relire().catch(() => {});
    return cache;
  }
  async function journaliser(quoi, rc) {
    await db.ajouter('crm_journal', { le: maintenant(), quoi, rc: rc || null });
  }
  return {
    utilisateurs,
    async fiche(id) {
      const u = await db.lire('users', id);
      return u ? ligneUtilisateur(u) : null;
    },
    async changerPrenom(id, prenom) {
      const propre = nettoyerPrenom(prenom);
      const u = await db.lire('users', id);
      if (!u) throw new Error('Inscrit introuvable.');
      await db.modifierExistant('users', id, { first_name: propre });
      await journaliser('prénom corrigé', u.revenuecat_id);
      if (cache) cache = cache.map((l) => (l.id === id ? { ...l, prenom: propre } : l));
      return propre;
    },
    // Au premier lancement, les envois sont coupés et le mode à blanc est mis.
    async reglages() {
      const r = await db.lire('crm_reglages', 'general');
      if (r) return { ...REGLAGES_PAR_DEFAUT, ...r };
      await db.ecrire('crm_reglages', 'general', { ...REGLAGES_PAR_DEFAUT, maj_le: maintenant() });
      return { ...REGLAGES_PAR_DEFAUT };
    },
    async changerReglage(cle, valeur) {
      if (['expediteur', 'repondre_a', 'adresse_test'].includes(cle)) {
        const adresse = String(valeur ?? '').trim();
        if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(adresse.replace(/^[^<]*<|>$/g, ''))) throw new Error('Adresse e-mail invalide.');
        await db.ecrire('crm_reglages', 'general', { [cle]: adresse, maj_le: maintenant() });
        await journaliser(`réglage ${cle} changé`, null);
        return this.reglages();
      }
      if (cle === 'signature') {
        const signature = String(valeur ?? '').trim();
        if (!signature || signature.length > 200 || /[<>]/.test(signature)) throw new Error('La signature fait de 1 à 200 caractères, sans < ni >.');
        await db.ecrire('crm_reglages', 'general', { signature, maj_le: maintenant() });
        return this.reglages();
      }
      // Le numéro WhatsApp du fondateur, au format international, chiffres seuls (33612345678) ; vide pour retirer la ligne.
      if (cle === 'whatsapp') {
        const numero = String(valeur ?? '').replace(/[\s.()-]/g, '').replace(/^\+/, '').replace(/^00/, '');
        if (numero && !/^[1-9]\d{7,14}$/.test(numero)) throw new Error('Le numéro s’écrit au format international, par exemple +33 6 12 34 56 78.');
        await db.ecrire('crm_reglages', 'general', { whatsapp: numero || null, maj_le: maintenant() });
        await journaliser(numero ? 'numéro WhatsApp réglé' : 'numéro WhatsApp retiré', null);
        return this.reglages();
      }
      if (cle === 'plafond_jour') {
        if (!Number.isInteger(valeur) || valeur < 1 || valeur > 90) throw new Error('Le plafond va de 1 à 90 par jour (Resend gratuit : 100).');
        await db.ecrire('crm_reglages', 'general', { plafond_jour: valeur, maj_le: maintenant() });
        return this.reglages();
      }
      // Une sorte d'e-mail mise en essai ou rendue aux utilisateurs (INT-EW-94).
      if (cle === 'en_essai') {
        const type = String(valeur?.type ?? '');
        if (!SORTES_AUTO.includes(type) || typeof valeur?.essai !== 'boolean') throw new Error('Sorte d’e-mail inconnue.');
        const avant = (await this.reglages()).en_essai;
        const en_essai = valeur.essai ? [...new Set([...avant, type])] : avant.filter((t) => t !== type);
        await db.ecrire('crm_reglages', 'general', { en_essai, maj_le: maintenant() });
        await journaliser(`${type} : ${valeur.essai ? 'en essai' : 'part aux utilisateurs'}`, null);
        return this.reglages();
      }
      if (!(cle in REGLAGES_PAR_DEFAUT) || typeof valeur !== 'boolean') throw new Error('Réglage inconnu.');
      await db.ecrire('crm_reglages', 'general', { [cle]: valeur, maj_le: maintenant() });
      await journaliser(`${cle} : ${valeur ? 'oui' : 'non'}`, null);
      return this.reglages();
    },
    // Irréversible depuis la page : seul le fondateur, dans la base, pourrait l'enlever.
    async desinscrire(id) {
      const u = await db.lire('users', id);
      if (!u) throw new Error('Inscrit introuvable.');
      const { cleUtilisateur } = await import('./envoi.mjs');
      await db.ecrire('crm_fiches', cleUtilisateur(id), { user_id: id, desinscrit: true, desinscrit_le: maintenant(), maj_le: maintenant() });
      await journaliser('désinscrit à la main', u.revenuecat_id);
      return true;
    },
    async desinscrit(id) {
      const { cleUtilisateur } = await import('./envoi.mjs');
      return Boolean((await db.lire('crm_fiches', cleUtilisateur(id)))?.desinscrit);
    },
    async journal() {
      const lignes = [...await db.lister('crm_journal'), ...(await db.lister('crm_envois')).map((e) => ({ ...e, quoi: e.quoi ?? `envoi ${e.statut ?? ''}`.trim() }))];
      return lignes.sort((a, b) => String(b.le ?? '').localeCompare(String(a.le ?? ''))).slice(0, 200);
    },
    // Le fil d'une personne : e-mails de la page (envoyés ou à blanc), e-mails Gmail, WhatsApp notés.
    async fil(id) {
      const actions = (await db.lister('crm_actions')).filter((a) => a.user_id === id && ['envoyee', 'a_blanc', 'erreur'].includes(a.statut))
        .map((a) => ({ le: a.maj_le ?? a.cree_le, sens: 'envoye', source: a.statut === 'a_blanc' ? 'page, à blanc' : a.statut === 'erreur' ? 'page, en erreur' : 'page', sujet: a.sujet, extrait: String(a.corps ?? '').slice(0, 500) }));
      const messages = (await db.lister('crm_messages')).filter((m) => m.user_id === id)
        .map((m) => ({ le: m.le, sens: m.sens, source: m.source, sujet: m.sujet ?? '', extrait: m.extrait ?? '' }));
      return [...actions, ...messages].sort((a, b) => String(b.le ?? '').localeCompare(String(a.le ?? '')));
    },
    async noterMessage(id, { sens, source, extrait = '' }) {
      if (!['envoye', 'recu'].includes(sens) || source !== 'whatsapp') throw new Error('Message inconnu.');
      const u = await db.lire('users', id);
      if (!u) throw new Error('Inscrit introuvable.');
      const texte = String(extrait).replace(/\s+/g, ' ').trim().slice(0, 500);
      if (sens === 'recu' && !texte) throw new Error('Coller la réponse reçue.');
      const { cleUtilisateur } = await import('./envoi.mjs');
      const t = maintenant();
      // Une réponse WhatsApp notée par le fondateur est déjà lue.
      await db.ajouter('crm_messages', { user_id: id, cle: cleUtilisateur(id), sens, source, le: t, extrait: texte || 'lien WhatsApp ouvert', ...(sens === 'recu' ? { lu: true } : {}) });
      if (sens === 'recu') await this.aRepondu(id);
      return true;
    },
    // A répondu : la fiche, et ses campagnes en cours (ses relances en attente sont retirées).
    async aRepondu(id) {
      const u = await db.lire('users', id);
      if (!u) throw new Error('Inscrit introuvable.');
      const { cleUtilisateur } = await import('./envoi.mjs');
      const t = maintenant();
      await db.ecrire('crm_fiches', cleUtilisateur(id), { user_id: id, a_repondu_le: t, maj_le: t });
      for (const m of (await db.lister('crm_membres')).filter((x) => x.user_id === id && ['envoye', 'relance', 'a_envoyer'].includes(x.statut))) {
        await db.ecrire('crm_membres', m.id, { statut: 'repondu', repondu_le: t });
      }
      for (const a of (await db.lister('crm_actions')).filter((x) => x.user_id === id && x.type === 'campagne_relance' && ['prete', 'reportee'].includes(x.statut))) {
        await db.ecrire('crm_actions', a.id, { statut: 'ignoree', raison: 'a répondu', maj_le: t });
      }
      await journaliser('a répondu', u.revenuecat_id);
      return true;
    },
    async aujourdhui() {
      const t = maintenant();
      const actions = await db.lister('crm_actions');
      // Les envois de campagne partent depuis leur campagne ; seules leurs relances viennent ici.
      return actions.filter((a) => a.type !== 'campagne').filter((a) => a.statut === 'prete' || (a.statut === 'reportee' && (!a.reporter_au || new Date(a.reporter_au) <= t)))
        .sort((a, b) => String(a.echeance ?? '').localeCompare(String(b.echeance ?? '')));
    },
    async action(id) {
      return db.lire('crm_actions', id);
    },
    // Plus tard : demain 9 h (Paris, à l'heure près) ; Ignorer : l'action sort de la liste.
    async traiterAction(id, op) {
      const a = await db.lire('crm_actions', id);
      if (!a || !['prete', 'reportee'].includes(a.statut)) throw new Error('Action introuvable ou déjà traitée.');
      const t = maintenant();
      if (op === 'reporter') {
        const demain = new Date(t.getTime() + 86400000);
        demain.setUTCHours(8, 0, 0, 0);
        await db.ecrire('crm_actions', id, { statut: 'reportee', reporter_au: demain, maj_le: t });
      } else if (op === 'ignorer') {
        await db.ecrire('crm_actions', id, { statut: 'ignoree', maj_le: t });
      } else if (op === 'texte') {
        throw new Error('Utiliser modifierTexte.');
      } else throw new Error('Geste inconnu.');
      return db.lire('crm_actions', id);
    },
    async modifierTexte(id, sujet, corps) {
      const a = await db.lire('crm_actions', id);
      if (!a || !['prete', 'reportee'].includes(a.statut)) throw new Error('Action introuvable ou déjà traitée.');
      if (!String(sujet ?? '').trim() || !String(corps ?? '').trim() || String(corps).length > 5000) throw new Error('Sujet et texte requis (5 000 caractères au plus).');
      // Corriger le texte lève aussi le point à vérifier (titre traduit, usage relu).
      await db.ecrire('crm_actions', id, { sujet: String(sujet).trim(), corps: String(corps), modifie_a_la_main: true, a_retraduire: false, a_verifier: null, maj_le: maintenant() });
      return db.lire('crm_actions', id);
    },
    // « C'est vérifié » : le fondateur a relu le point signalé et garde le texte tel quel.
    async verifier(id) {
      const a = await db.lire('crm_actions', id);
      if (!a || !['prete', 'reportee'].includes(a.statut)) throw new Error('Action introuvable ou déjà traitée.');
      await db.ecrire('crm_actions', id, { a_verifier: null, verifie: a.a_verifier ?? null, verifie_le: maintenant(), maj_le: maintenant() });
      return db.lire('crm_actions', id);
    },
    // Les réponses reçues qu'il n'a pas encore lues (Gmail, ou notées à la main), la plus récente d'abord.
    async reponses() {
      return (await db.lister('crm_messages')).filter((m) => m.sens === 'recu' && !m.lu)
        .map((m) => ({ id: m.id, user_id: m.user_id, source: m.source, le: m.le, sujet: m.sujet ?? '', extrait: m.extrait ?? '' }))
        .sort((a, b) => String(b.le ?? '').localeCompare(String(a.le ?? '')));
    },
    async reponseLue(id) {
      const m = await db.lire('crm_messages', String(id ?? ''));
      if (!m || m.sens !== 'recu') throw new Error('Réponse introuvable.');
      await db.ecrire('crm_messages', m.id, { lu: true, lu_le: maintenant() });
      return true;
    },
    // La traduction française corrigée par le fondateur : le texte dans la langue de la personne est à refaire avant l'envoi.
    async modifierTraduction(id, sujet, corps) {
      const a = await db.lire('crm_actions', id);
      if (!a || !['prete', 'reportee'].includes(a.statut)) throw new Error('Action introuvable ou déjà traitée.');
      if (!a.langue || a.langue === 'fr') throw new Error('Cet e-mail est déjà en français.');
      if (!String(sujet ?? '').trim() || !String(corps ?? '').trim() || String(corps).length > 5000) throw new Error('Sujet et texte requis (5 000 caractères au plus).');
      await db.ecrire('crm_actions', id, { traduction_fr: { sujet: String(sujet).trim(), corps: String(corps) }, a_retraduire: true, maj_le: maintenant() });
      return db.lire('crm_actions', id);
    },
    async choisirLangue(id, langue) {
      const { LANGUES } = await import('./langues.mjs');
      if (langue && !LANGUES.includes(langue)) throw new Error('Langue inconnue.');
      const u = await db.lire('users', id);
      if (!u) throw new Error('Inscrit introuvable.');
      const { cleUtilisateur } = await import('./envoi.mjs');
      await db.ecrire('crm_fiches', cleUtilisateur(id), { user_id: id, langue: langue || null, maj_le: maintenant() });
      await journaliser(`langue choisie : ${langue || 'automatique'}`, u.revenuecat_id);
      return true;
    },
  };
}

// Une base en mémoire, mêmes appels que le client Firestore, pour les tests.
export function baseEnMemoire(collections = {}) {
  const donnees = Object.fromEntries(Object.entries(collections).map(([c, docs]) => [c, new Map(docs.map((d) => [d.id, { ...d }]))]));
  const col = (c) => (donnees[c] ??= new Map());
  let n = 0;
  return {
    donnees,
    async lister(c) { return [...col(c).values()].map((d) => ({ ...d })); },
    async lire(c, id) { const d = col(c).get(id); return d ? { ...d } : null; },
    async ecrire(c, id, champs) { col(c).set(id, { ...(col(c).get(id) ?? { id }), ...champs }); },
    async ajouter(c, champs) { n += 1; col(c).set(`auto${n}`, { id: `auto${n}`, ...champs }); },
    async creer(c, id, champs) {
      if (col(c).has(id)) throw new Error('existe déjà');
      col(c).set(id, { id, ...champs });
    },
    async modifierExistant(c, id, champs) {
      if (!col(c).has(id)) throw new Error('document absent');
      col(c).set(id, { ...col(c).get(id), ...champs });
    },
  };
}
