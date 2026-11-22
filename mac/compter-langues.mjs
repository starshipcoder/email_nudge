// Combien d'inscrits d'email_nudge passent de « sans langue » à une langue, par pays et par langue (EW-51).
// Des comptes seulement, aucune adresse. Usage : node mac/compter-langues.mjs
import { clientFirestore } from './firestore.mjs';
import { fermerSources, ouvrirSources, personneDe } from './dossier.mjs';
import { langueDePersonne } from './langues.mjs';

const db = clientFirestore();
const users = await db.lister('users', ['revenuecat_id', 'locale']);
const sources = await ouvrirSources();
try {
  // Le pays le plus fréquent de chaque personne de Mixpanel, en une requête.
  const pays = new Map();
  for (const r of sources.mixpanel.prepare(`SELECT p.utilisateur u, json_extract(e.proprietes, '$.mp_country_code') c, count(*) n
      FROM propres p JOIN evenements e ON e.id = p.id WHERE p.utilisateur IS NOT NULL AND c IS NOT NULL GROUP BY u, c`).all()) {
    if (!pays.has(r.u) || pays.get(r.u).n < r.n) pays.set(r.u, { c: r.c, n: r.n });
  }
  const compte = (cles) => { const m = new Map(); for (const k of cles) m.set(k, (m.get(k) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
  const sansLangue = users.filter((u) => !String(u.locale ?? '').trim());
  const resolus = sansLangue.map((u) => langueDePersonne({ pays: pays.get(personneDe(sources, u.revenuecat_id))?.c }));
  console.log(`Inscrits : ${users.length} ; sans langue dans l'app : ${sansLangue.length}`);
  console.log('Sans langue, par source :', JSON.stringify(compte(resolus.map((l) => l.source))));
  console.log('Sans langue, langue trouvée :', JSON.stringify(compte(resolus.filter((l) => l.source === 'pays').map((l) => l.langue))));
  console.log('Sans langue, pays à plusieurs langues :', JSON.stringify(compte(resolus.filter((l) => l.source === 'pays ambigu').map((l) => l.pays))));
  console.log('Tous, langue des e-mails :', JSON.stringify(compte(users.map((u) => langueDePersonne({ locale: u.locale, pays: pays.get(personneDe(sources, u.revenuecat_id))?.c }).langue))));
} finally { fermerSources(sources); }
