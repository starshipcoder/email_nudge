// Ce que la page de suivi sait faire, au-dessus d'un client Firestore (vrai ou en mémoire pour les tests).
export const CHAMPS_USERS = ['first_name', 'phone_number', 'locale', 'role', 'needs', 'revenuecat_id', 'created_at',
  'onboarding_complete', 'paywall_passed', 'trial_active', 'trial_start_date', 'trial_end_date', 'subscription_active',
  'plan', 'churned_at', 'routes_created', 'contacts_total', 'visits_logged', 'is_test_user', 'last_action_at'];

export const REGLAGES_PAR_DEFAUT = { envois_coupes: true, a_blanc: true };

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
  let cache = null;
  let cacheLe = 0;
  async function utilisateurs({ frais = false } = {}) {
    if (frais || !cache || maintenant().getTime() - cacheLe > dureeCache) {
      cache = (await db.lister('users', CHAMPS_USERS)).map(ligneUtilisateur);
      cacheLe = maintenant().getTime();
    }
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
      if (cle === 'plafond_jour') {
        if (!Number.isInteger(valeur) || valeur < 1 || valeur > 90) throw new Error('Le plafond va de 1 à 90 par jour (Resend gratuit : 100).');
        await db.ecrire('crm_reglages', 'general', { plafond_jour: valeur, maj_le: maintenant() });
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
    async aujourdhui() {
      const actions = await db.lister('crm_actions');
      return actions.filter((a) => ['prete', 'reportee'].includes(a.statut));
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
