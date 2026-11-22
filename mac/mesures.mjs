// Les chiffres des e-mails d'Iris CRM (INT-EW-67), par sorte et par langue : envoyés, réponses dans les 7 jours,
// désinscriptions dans les 7 jours. Des comptes seulement, aucune adresse. Les envois à l'adresse de test ne comptent pas.
// Usage : node mac/mesures.mjs [--json]
import { cleUtilisateur } from './envoi.mjs';

const JOUR = 86400000;
export const DELAI_REPONSE = 7 * JOUR;

export function mesurer({ envois = [], actions = [], fiches = [], messages = [], maintenant = new Date() }) {
  const parAction = new Map(actions.map((a) => [a.id, a]));
  const parFiche = new Map(fiches.map((f) => [f.id, f]));
  const recus = new Map();
  for (const m of messages) if (m.sens === 'recu' && m.cle) (recus.get(m.cle) ?? recus.set(m.cle, []).get(m.cle)).push(new Date(m.le).getTime());
  const t = maintenant.getTime();
  const lignes = new Map();
  for (const e of envois) {
    if (e.statut !== 'envoye' || e.destinataire_reel === 'adresse_test') continue;
    const a = parAction.get(e.id);
    if (!a) continue;
    const cle = cleUtilisateur(a.user_id);
    const fiche = parFiche.get(cle) ?? {};
    const le = new Date(e.le).getTime();
    const dans7j = (d) => d && new Date(d).getTime() > le && new Date(d).getTime() - le <= DELAI_REPONSE;
    const repondu = dans7j(fiche.a_repondu_le) || (recus.get(cle) ?? []).some((r) => r > le && r - le <= DELAI_REPONSE);
    const k = `${a.type}|${a.langue ?? '?'}`;
    const l = lignes.get(k) ?? { type: a.type, langue: a.langue ?? '?', envoyes: 0, reponses_7j: 0, desinscrits_7j: 0, en_attente: 0 };
    l.envoyes += 1;
    if (repondu) l.reponses_7j += 1;
    if (dans7j(fiche.desinscrit_le)) l.desinscrits_7j += 1;
    if (t - le < DELAI_REPONSE && !repondu) l.en_attente += 1;
    lignes.set(k, l);
  }
  return [...lignes.values()].sort((a, b) => a.type.localeCompare(b.type) || a.langue.localeCompare(b.langue));
}

// Le total par sorte, et le taux de réponse sur les envois dont les 7 jours sont passés.
export function parSorte(lignes) {
  const m = new Map();
  for (const l of lignes) {
    const s = m.get(l.type) ?? { type: l.type, envoyes: 0, reponses_7j: 0, desinscrits_7j: 0, en_attente: 0 };
    for (const k of ['envoyes', 'reponses_7j', 'desinscrits_7j', 'en_attente']) s[k] += l[k];
    m.set(l.type, s);
  }
  return [...m.values()].map((s) => {
    const lus = s.envoyes - s.en_attente;
    return { ...s, taux_reponse: lus ? Math.round((s.reponses_7j / lus) * 1000) / 10 : null };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { clientFirestore } = await import('./firestore.mjs');
  const db = clientFirestore();
  const [envois, actions, fiches, messages] = await Promise.all(['crm_envois', 'crm_actions', 'crm_fiches', 'crm_messages'].map((c) => db.lister(c)));
  const lignes = mesurer({ envois, actions, fiches, messages });
  const sortes = parSorte(lignes);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ le: new Date().toISOString(), sortes, lignes }, null, 2));
  else {
    console.log(`Mesures d'Iris CRM au ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    if (!sortes.length) console.log('Aucun e-mail réel envoyé.');
    for (const s of sortes) console.log(`${s.type} : ${s.envoyes} envoyés, ${s.reponses_7j} réponses en 7 jours (${s.taux_reponse ?? '—'} %), ${s.desinscrits_7j} désinscriptions, ${s.en_attente} encore dans leurs 7 jours`);
  }
}
