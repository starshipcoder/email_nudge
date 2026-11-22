// « Votre problème est corrigé dans la version X » (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.11 C).
// Les retours « Signaler un bug » sont lus dans Sentry : la personne y est nommée par son identifiant RevenueCat, avec
// l'e-mail qu'elle a donné. Le fondateur note, sur la page, le titre public et la version qui corrige ; dès que cette
// version est en vente sur le store de la personne, une action est préparée, une seule par personne et par version.
// Le lien avec Athena : le numéro du retour Sentry (« Retour Sentry n° … » dans l'Inbox), et le nom de la tâche BUG-EW.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cleUtilisateur } from './envoi.mjs';
import { rendreAvecTraduction } from './modeles.mjs';
import { ET, STORES, langueDePersonne } from './langues.mjs';
import { compareVersions, versionValide } from './versions.mjs';

const run = promisify(execFile);
const JOUR = 86400000;

export function personneDuRetour(event) {
  const fb = event?.contexts?.feedback ?? {};
  const rc = String(fb.name ?? event?.user?.username ?? event?.user?.id ?? '').trim() || null;
  const contact = String(fb.contact_email ?? event?.user?.email ?? '').trim() || null;
  const os = String(event?.contexts?.os?.name ?? (event?.tags ?? []).find((t) => t?.key === 'os.name')?.value ?? '').toLowerCase();
  const plateforme = /ios|iphone|ipad/.test(os) ? 'ios' : /android/.test(os) ? 'android' : null;
  const release = event?.release?.version ?? event?.release ?? null;
  const version_vue = typeof release === 'string' ? release.split('@').at(-1) || null : null;
  return { rc, contact, plateforme, version_vue };
}

// Sentry, en lecture seule, avec la clé du trousseau (compte athena, service sentry-readwrite), jamais affichée.
export function retoursSentry({ fetcher = fetch, jours = 90 } = {}) {
  return async () => {
    const { stdout } = await run('security', ['find-generic-password', '-a', 'athena', '-s', 'sentry-readwrite', '-w']);
    const h = { Authorization: `Bearer ${stdout.trim()}` };
    const lire = async (chemin) => {
      const r = await fetcher(`https://sentry.io/api/0${chemin}`, { headers: h });
      if (!r.ok) throw new Error(`Sentry ${r.status}`);
      return r.json();
    };
    const q = new URLSearchParams({ query: `issue.category:feedback firstSeen:-${jours}d`, statsPeriod: '', sort: 'new', limit: '100' });
    const issues = await lire(`/projects/starship-coder/easyway/issues/?${q}`);
    const sortie = [];
    for (const issue of Array.isArray(issues) ? issues : []) {
      if (!/^\d{1,20}$/.test(String(issue?.id ?? ''))) continue;
      sortie.push({ issue, event: await lire(`/organizations/starship-coder/issues/${issue.id}/events/latest/`).catch(() => null) });
    }
    return sortie;
  };
}

function verifierNote({ titre, version_corrigee, bug_ew }) {
  const t = String(titre ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 120 || /[<>{}]/.test(t)) throw new Error('Le titre public fait de 1 à 120 caractères, sans < > { }.');
  const v = String(version_corrigee ?? '').trim();
  if (!versionValide(v)) throw new Error('La version qui corrige s’écrit comme 7.6.9.');
  const nom = String(bug_ew ?? '').trim();
  if (nom && !/^BUG-EW-\d{1,5}$/.test(nom)) throw new Error('La tâche s’écrit BUG-EW-12, ou rien.');
  return { titre: t, version_corrigee: v, bug_ew: nom || null };
}

export function bugs(db, { maintenant = () => new Date(), lireRetours, lireVersions, paysPour = () => null }) {
  async function inscrits() {
    const users = await db.lister('users', ['revenuecat_id', 'locale']);
    return { parRc: new Map(users.filter((u) => u.revenuecat_id).map((u) => [u.revenuecat_id, u])), parId: new Map(users.map((u) => [u.id.toLowerCase(), u])) };
  }
  const relier = ({ parRc, parId }, p) => (p.rc && parRc.get(p.rc)) || (p.contact && parId.get(p.contact.toLowerCase())) || null;

  return {
    // Les retours récents, chacun relié à son inscrit s'il est connu, avec ce que le fondateur en a noté.
    async retours() {
      const [brut, index, notes] = [await lireRetours(), await inscrits(), new Map((await db.lister('crm_bugs')).map((b) => [b.id, b]))];
      return brut.map(({ issue, event }) => {
        const p = personneDuRetour(event);
        const u = relier(index, p);
        return { id: String(issue.id), le: issue.firstSeen ?? null, texte: String(issue.metadata?.message ?? event?.contexts?.feedback?.message ?? '').split(/\s*\beventId:/)[0],
          ...p, user_id: u?.id ?? null, note: notes.get(String(issue.id)) ?? null };
      }).sort((a, b) => String(b.le ?? '').localeCompare(String(a.le ?? '')));
    },
    async noter(id, champs) {
      const note = verifierNote(champs);
      const retour = (await this.retours()).find((r) => r.id === String(id));
      if (!retour) throw new Error('Retour introuvable dans Sentry (90 derniers jours).');
      const t = maintenant();
      await db.ecrire('crm_bugs', retour.id, { ...note, rc: retour.rc, user_id: retour.user_id, plateforme: retour.plateforme, version_vue: retour.version_vue, note_le: t, maj_le: t });
      return db.lire('crm_bugs', retour.id);
    },
    // À chaque passe : les versions en vente, puis une action par bug noté dont la version est en vente chez la personne.
    async preparer() {
      const versions = await lireVersions();
      const t = maintenant();
      for (const [plateforme, v] of Object.entries(versions)) {
        if (!v?.version) continue;
        const avant = await db.lire('crm_versions', plateforme);
        await db.ecrire('crm_versions', plateforme, { version: v.version, mise_en_vente_le: v.mise_en_vente_le ?? null,
          vue_le: avant?.version === v.version ? avant.vue_le : t, lue_le: t });
      }
      const { signature } = (await db.lire('crm_reglages', 'general')) ?? {};
      if (!signature) return { creees: 0, raison: 'signature à régler', versions };
      const fiches = new Map((await db.lister('crm_fiches')).map((f) => [f.id, f]));
      const users = new Map((await db.lister('users', ['revenuecat_id', 'locale'])).map((u) => [u.id, u]));
      let creees = 0; let erreurs = 0;
      for (const b of await db.lister('crm_bugs')) {
        if (b.action_id || !b.user_id || !users.has(b.user_id) || fiches.get(cleUtilisateur(b.user_id))?.desinscrit) continue;
        const enVente = (b.plateforme ? [b.plateforme] : ['ios', 'android']).filter((p) => versions[p]?.version && compareVersions(versions[p].version, b.version_corrigee) >= 0);
        if (!enVente.length) continue;
        const fiche = fiches.get(cleUtilisateur(b.user_id));
        const l = langueDePersonne({ locale: users.get(b.user_id).locale, pays: await paysPour(b.rc), choix: fiche?.langue });
        const langue = l.langue;
        const store = (lg) => enVente.map((p) => STORES[p][lg]).join(ET[lg]);
        // Le titre public est écrit en français par le fondateur : il reste tel quel, à traduire à la relecture.
        const { sujet, corps, traduction_fr } = rendreAvecTraduction('bug_corrige', langue, (lg) => ({ titre: b.titre, version: b.version_corrigee, store: store(lg), signature }));
        const id = `bug_corrige__${cleUtilisateur(b.user_id)}__${b.version_corrigee}`;
        try {
          await db.creer('crm_actions', id, { type: 'bug_corrige', user_id: b.user_id, statut: 'prete', sujet, corps, langue, langue_source: l.source,
            ...(traduction_fr ? { traduction_fr, a_verifier: 'le titre public est en français : le traduire dans le texte' } : {}),
            bug: b.id, bug_ew: b.bug_ew, echeance: new Date(t.getTime() + 30 * JOUR), cree_le: t });
          creees += 1;
        } catch (erreur) {
          // Même personne, même version : une seule action. Toute autre erreur laisse le bug à refaire à la passe suivante.
          if (!/existe déjà/.test(String(erreur?.message))) { erreurs += 1; continue; }
        }
        await db.ecrire('crm_bugs', b.id, { action_id: id, maj_le: t });
      }
      return { creees, erreurs, versions };
    },
  };
}
