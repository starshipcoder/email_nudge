// La demande d'avis (EW-56, fondateur, 22/11) : une semaine après un « bug corrigé » envoyé, si la personne a rouvert
// l'app depuis (le « moment heureux » que recommande Apple), n'a pas répondu et n'est pas désinscrite. Le texte demande
// « un avis », jamais « 5 étoiles » (Apple 5.6.3 et Google Play interdisent d'orienter la note), et laisse la porte
// ouverte à une question.
import { cleUtilisateur } from './envoi.mjs';
import { ET, STORES } from './langues.mjs';

const JOUR = 86400000;
export const FENETRE_AVIS = [7 * JOUR, 21 * JOUR];
export const LIENS_AVIS = {
  ios: 'https://apps.apple.com/app/id6443783383?action=write-review',
  android: 'https://play.google.com/store/apps/details?id=com.starshipcoder.contactonmap',
};

// {store} porte la préposition des langues qui en ont besoin (langues.mjs, STORES).
export const TEXTES_AVIS = {
  fr: { sujet: 'Votre avis sur Easy Way', corps: (v, store, lien) => `Bonjour,\n\nVotre problème est réglé depuis la version ${v}. Si Easy Way vous aide au quotidien, un avis sur ${store} m'aiderait beaucoup :\n${lien}\n\nEt s'il reste quelque chose qui vous gêne, répondez-moi.` },
  en: { sujet: 'Your review of Easy Way', corps: (v, store, lien) => `Hello,\n\nYour issue has been fixed since version ${v}. If Easy Way helps you day to day, a review on ${store} would help me a lot:\n${lien}\n\nAnd if anything still bothers you, just reply.` },
  de: { sujet: 'Ihre Bewertung von Easy Way', corps: (v, store, lien) => `Hallo,\n\nIhr Problem ist seit Version ${v} behoben. Wenn Easy Way Ihnen im Alltag hilft, würde mir eine Bewertung ${store} sehr helfen:\n${lien}\n\nUnd wenn Sie noch etwas stört, antworten Sie mir einfach.` },
  es: { sujet: 'Su opinión sobre Easy Way', corps: (v, store, lien) => `Hola:\n\nSu problema está resuelto desde la versión ${v}. Si Easy Way le ayuda en su día a día, una reseña ${store} me ayudaría mucho:\n${lien}\n\nY si algo todavía le molesta, respóndame.` },
  it: { sujet: 'La sua opinione su Easy Way', corps: (v, store, lien) => `Buongiorno,\n\nIl suo problema è risolto dalla versione ${v}. Se Easy Way la aiuta ogni giorno, una recensione ${store} mi aiuterebbe molto:\n${lien}\n\nE se qualcosa le dà ancora fastidio, mi risponda.` },
  pt: { sujet: 'A sua opinião sobre o Easy Way', corps: (v, store, lien) => `Olá,\n\nO seu problema está resolvido desde a versão ${v}. Se o Easy Way o ajuda no dia a dia, uma avaliação ${store} ajudar-me-ia muito:\n${lien}\n\nE se ainda houver algo que o incomode, responda-me.` },
};

export function texteAvis({ langue, version, plateforme, signature }) {
  const lg = TEXTES_AVIS[langue] ? langue : 'en';
  const t = TEXTES_AVIS[lg];
  const plateformes = plateforme ? [plateforme] : ['ios', 'android'];
  const store = plateformes.map((p) => STORES[p][lg]).join(ET[lg]);
  const lien = plateformes.map((p) => (plateformes.length > 1 ? `${p === 'ios' ? 'App Store' : 'Google Play'} : ${LIENS_AVIS[p]}` : LIENS_AVIS[p])).join('\n');
  return { sujet: t.sujet, corps: `${t.corps(version, store, lien)}\n\n${signature}` };
}

// revenuDepuis(rc, ms) : true si la personne a utilisé l'app après ms, false sinon, null si on ne sait pas (pas reliée).
export async function preparerAvis({ db, revenuDepuis, maintenant = new Date() }) {
  const { signature } = (await db.lire('crm_reglages', 'general')) ?? {};
  if (!signature) return { creees: 0 };
  const t = maintenant.getTime();
  const envois = new Map((await db.lister('crm_envois')).map((e) => [e.id, e]));
  const actions = await db.lister('crm_actions');
  const deja = new Set(actions.filter((a) => a.type === 'demande_avis').map((a) => a.id));
  const users = new Map((await db.lister('users', ['revenuecat_id'])).map((u) => [u.id, u]));
  let creees = 0;
  for (const a of actions.filter((x) => x.type === 'bug_corrige' && x.statut === 'envoyee')) {
    const e = envois.get(a.id);
    if (!e || e.statut !== 'envoye' || e.destinataire_reel === 'adresse_test') continue;
    const le = new Date(e.le).getTime();
    if (t - le < FENETRE_AVIS[0] || t - le > FENETRE_AVIS[1]) continue;
    const cle = cleUtilisateur(a.user_id);
    const id = `avis__${cle}__${a.bug}`;
    if (deja.has(id)) continue;
    const fiche = (await db.lire('crm_fiches', cle)) ?? {};
    if (fiche.desinscrit) continue;
    // Une réponse depuis le « bug corrigé » : le fondateur la lit lui-même, pas de demande d'avis automatique.
    if (fiche.a_repondu_le && new Date(fiche.a_repondu_le).getTime() > le) continue;
    const rc = users.get(a.user_id)?.revenuecat_id;
    if (!rc || (await revenuDepuis(rc, le)) !== true) continue;
    const bug = (await db.lire('crm_bugs', a.bug)) ?? {};
    const version = bug.version_corrigee ?? a.version ?? '';
    const { sujet, corps } = texteAvis({ langue: a.langue, version, plateforme: bug.plateforme ?? null, signature });
    const traduction_fr = a.langue && a.langue !== 'fr' ? texteAvis({ langue: 'fr', version, plateforme: bug.plateforme ?? null, signature }) : null;
    try {
      await db.creer('crm_actions', id, { type: 'demande_avis', user_id: a.user_id, statut: 'prete', sujet, corps, langue: a.langue ?? 'en',
        ...(traduction_fr ? { traduction_fr } : {}), bug: a.bug, echeance: new Date(t + 14 * JOUR), cree_le: maintenant });
      creees += 1;
    } catch (erreur) { if (!/existe déjà/.test(String(erreur?.message))) throw erreur; }
  }
  return { creees };
}
