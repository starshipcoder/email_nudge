// Piste 4 du chantier « Communication avec les utilisateurs » (EW-46) : la relance d'un onboarding abandonné, et les gros
// utilisateurs à contacter avec des questions tirées de leur usage. Rien ne part d'ici : la passe crée des actions
// « prêtes », que le fondateur relit et envoie d'un clic par la porte d'envoi (envoi.mjs), avec tous ses garde-fous.
// Aucune coordonnée dans les textes ni dans les questions : des comptes d'événements, sans contact ni texte tapé.
import { cleUtilisateur } from './envoi.mjs';
import { langueDePersonne } from './langues.mjs';
import { resumer } from './dossier.mjs';

const H = 3600000;
const JOUR = 24 * H;

// L'onboarding : inscrit depuis plus d'un jour sans l'avoir fini. Au-delà de 14 jours, la relance arrive trop tard
// (et la première passe ne réveille pas tout l'historique des inscrits).
export const ONBOARDING_FENETRE = [1 * JOUR, 14 * JOUR];
export const ECHEANCE_ONBOARDING = 7 * JOUR;
// Un gros utilisateur : au moins 12 jours actifs sur les 4 dernières semaines et au moins 10 tournées démarrées.
// Le premier tri, sur la fiche Firebase (sans lire la base Mixpanel), garde qui a créé 10 tournées et agi depuis 14 jours.
export const GROS = { jours_4_semaines: 12, tournees: 10, actif_depuis: 14 * JOUR };
export const ECHEANCE_GROS = 14 * JOUR;
export const MAX_QUESTIONS = 5;

const ts = (v) => (v ? new Date(v).getTime() : NaN);

export function onboardingsAbandonnes(users, maintenant) {
  const t = maintenant.getTime();
  return users.filter((u) => u.onboarding_complete !== true && !u.trial_active && !u.subscription_active)
    .filter((u) => { const age = t - ts(u.created_at); return age >= ONBOARDING_FENETRE[0] && age <= ONBOARDING_FENETRE[1]; });
}

const sur = (d) => Boolean(d && d.lie !== false && !d.a_jour?.en_retard && d.parcours);
const demarrees = (d) => d.parcours?.tournees?.demarrees ?? d.usage?.tournees ?? 0;
const jours4 = (d) => (d.usage?.semaines ?? []).slice(-4).reduce((a, b) => a + b, 0);

// Sans données sûres (personne non reliée à Mixpanel, base en retard), on ne dit pas qu'elle utilise beaucoup l'app.
export function estGros(d) {
  return sur(d) && jours4(d) >= GROS.jours_4_semaines && demarrees(d) >= GROS.tournees;
}

// Les noms des sources d'import (parcours.mjs, IMPORTS) vers leur événement et leur nom dans chaque langue.
const IMPORTS = {
  CSV: { cle: 'Csv', noms: { fr: 'un fichier CSV', en: 'a CSV file', de: 'einer CSV-Datei', es: 'un archivo CSV', it: 'un file CSV', pt: 'um ficheiro CSV' } },
  Excel: { cle: 'Excel', noms: { fr: 'un fichier Excel', en: 'an Excel file', de: 'einer Excel-Datei', es: 'un archivo Excel', it: 'un file Excel', pt: 'um ficheiro Excel' } },
  'Google Sheets': { cle: 'Gsheet', noms: { fr: 'Google Sheets', en: 'Google Sheets', de: 'Google Sheets', es: 'Google Sheets', it: 'Google Sheets', pt: 'Google Sheets' } },
  'contacts du téléphone': { cle: 'Native', noms: { fr: 'les contacts du téléphone', en: 'your phone contacts', de: 'den Telefonkontakten', es: 'los contactos del teléfono', it: 'i contatti del telefono', pt: 'os contactos do telefone' } },
};

// Les questions, dans les six langues de l'app. Vouvoiement, une question par ligne.
const Q = {
  fr: {
    tournees: (n, a) => `Vous avez démarré ${n} tournées${a ? `, jusqu'à ${a} arrêts` : ''} : qu'est-ce que vous changez le plus souvent une fois en route ?`,
    import_rate: (n, s) => `L'import depuis ${s} a échoué ${n} fois : qu'est-ce que vous essayiez d'importer ?`,
    optimisation_ratee: (n) => `${n} optimisation${n > 1 ? 's' : ''} de tournée n'${n > 1 ? 'ont' : 'a'} pas abouti : vous souvenez-vous de ce qui coinçait ?`,
    adresses: (n) => `${n} adresses n'ont pas été trouvées sur la carte : de quel genre d'adresses s'agissait-il ?`,
    prospection: () => "Vous utilisez la prospection : qu'est-ce qui vous aide à trouver de nouveaux clients, et qu'est-ce qui vous manque ?",
    prospection_jamais: () => "Vous n'avez pas encore essayé la prospection : comment trouvez-vous vos nouveaux clients aujourd'hui ?",
    import_reussi: (n) => `Vous avez importé ${n} contacts : d'où vient cette liste, et à quelle fréquence la mettez-vous à jour ?`,
    regulier: (n) => `Vous avez ouvert l'app ${n} jours sur les 4 dernières semaines : si vous pouviez changer une seule chose, laquelle ?`,
  },
  en: {
    tournees: (n, a) => `You have started ${n} routes${a ? `, with up to ${a} stops` : ''}: what do you change most often once on the road?`,
    import_rate: (n, s) => `Importing from ${s} failed ${n} time${n > 1 ? 's' : ''}: what were you trying to import?`,
    optimisation_ratee: (n) => `${n} route optimisation${n > 1 ? 's' : ''} did not go through: do you remember what went wrong?`,
    adresses: (n) => `${n} addresses could not be found on the map: what kind of addresses were they?`,
    prospection: () => 'You use prospecting: what helps you find new customers, and what is missing?',
    prospection_jamais: () => 'You have not tried prospecting yet: how do you find new customers today?',
    import_reussi: (n) => `You imported ${n} contacts: where does this list come from, and how often do you update it?`,
    regulier: (n) => `You opened the app ${n} days over the last 4 weeks: if you could change just one thing, what would it be?`,
  },
  de: {
    tournees: (n, a) => `Sie haben ${n} Routen gestartet${a ? `, mit bis zu ${a} Stopps` : ''}: Was ändern Sie unterwegs am häufigsten?`,
    import_rate: (n, s) => `Der Import aus ${s} ist ${n}-mal fehlgeschlagen: Was wollten Sie importieren?`,
    optimisation_ratee: (n) => `${n} Routenoptimierung${n > 1 ? 'en sind' : ' ist'} nicht durchgelaufen: Erinnern Sie sich, woran es hakte?`,
    adresses: (n) => `${n} Adressen wurden auf der Karte nicht gefunden: Um welche Art von Adressen ging es?`,
    prospection: () => 'Sie nutzen die Akquise: Was hilft Ihnen, neue Kunden zu finden, und was fehlt Ihnen?',
    prospection_jamais: () => 'Sie haben die Akquise noch nicht ausprobiert: Wie finden Sie heute neue Kunden?',
    import_reussi: (n) => `Sie haben ${n} Kontakte importiert: Woher kommt diese Liste, und wie oft aktualisieren Sie sie?`,
    regulier: (n) => `Sie haben die App an ${n} Tagen in den letzten 4 Wochen geöffnet: Wenn Sie nur eine Sache ändern könnten, welche wäre es?`,
  },
  es: {
    tournees: (n, a) => `Ha iniciado ${n} rutas${a ? `, con hasta ${a} paradas` : ''}: ¿qué es lo que más cambia una vez en camino?`,
    import_rate: (n, s) => `La importación desde ${s} ha fallado ${n} ${n > 1 ? 'veces' : 'vez'}: ¿qué intentaba importar?`,
    optimisation_ratee: (n) => `${n} ${n > 1 ? 'optimizaciones de ruta no han' : 'optimización de ruta no ha'} funcionado: ¿recuerda qué fallaba?`,
    adresses: (n) => `${n} direcciones no se han encontrado en el mapa: ¿qué tipo de direcciones eran?`,
    prospection: () => 'Usa la prospección: ¿qué le ayuda a encontrar nuevos clientes y qué le falta?',
    prospection_jamais: () => 'Todavía no ha probado la prospección: ¿cómo encuentra hoy a sus nuevos clientes?',
    import_reussi: (n) => `Ha importado ${n} contactos: ¿de dónde viene esta lista y cada cuánto la actualiza?`,
    regulier: (n) => `Ha abierto la app ${n} días en las últimas 4 semanas: si pudiera cambiar una sola cosa, ¿cuál sería?`,
  },
  it: {
    tournees: (n, a) => `Ha avviato ${n} percorsi${a ? `, fino a ${a} tappe` : ''}: cosa cambia più spesso una volta in strada?`,
    import_rate: (n, s) => `L'importazione da ${s} non è riuscita ${n} ${n > 1 ? 'volte' : 'volta'}: cosa stava cercando di importare?`,
    optimisation_ratee: (n) => `${n} ${n > 1 ? 'ottimizzazioni del percorso non sono andate' : 'ottimizzazione del percorso non è andata'} a buon fine: ricorda cosa non funzionava?`,
    adresses: (n) => `${n} indirizzi non sono stati trovati sulla mappa: che tipo di indirizzi erano?`,
    prospection: () => 'Usa la prospezione: cosa la aiuta a trovare nuovi clienti, e cosa le manca?',
    prospection_jamais: () => 'Non ha ancora provato la prospezione: come trova oggi i nuovi clienti?',
    import_reussi: (n) => `Ha importato ${n} contatti: da dove viene questa lista, e ogni quanto la aggiorna?`,
    regulier: (n) => `Ha aperto l'app ${n} giorni nelle ultime 4 settimane: se potesse cambiare una sola cosa, quale sarebbe?`,
  },
  pt: {
    tournees: (n, a) => `Iniciou ${n} rotas${a ? `, com até ${a} paragens` : ''}: o que muda mais vezes quando já está a caminho?`,
    import_rate: (n, s) => `A importação a partir de ${s} falhou ${n} ${n > 1 ? 'vezes' : 'vez'}: o que estava a tentar importar?`,
    optimisation_ratee: (n) => `${n} ${n > 1 ? 'otimizações de rota não funcionaram' : 'otimização de rota não funcionou'}: lembra-se do que correu mal?`,
    adresses: (n) => `${n} moradas não foram encontradas no mapa: que tipo de moradas eram?`,
    prospection: () => 'Usa a prospeção: o que o ajuda a encontrar novos clientes, e o que lhe falta?',
    prospection_jamais: () => 'Ainda não experimentou a prospeção: como encontra hoje os seus novos clientes?',
    import_reussi: (n) => `Importou ${n} contactos: de onde vem esta lista, e com que frequência a atualiza?`,
    regulier: (n) => `Abriu a app ${n} dias nas últimas 4 semanas: se pudesse mudar uma só coisa, qual seria?`,
  },
};
const lg = (langue) => (Q[langue] ? langue : 'en');

// Les questions tirées de l'usage, la plus parlante d'abord. Chacune dit sur quel événement elle s'appuie (appui), pour
// que le fondateur sache d'où elle vient. Rien sans données sûres : on ne pose pas de question sur ce qu'on ne sait pas.
export function questionsDe(d, langue = 'fr') {
  if (!sur(d)) return [];
  const l = lg(langue);
  const sortie = [];
  const ajoute = (id, appui, args) => { if (appui.n > 0) sortie.push({ id, appui, texte: Q[l][id](...args(l)), texte_fr: Q.fr[id](...args('fr')) }); };
  const t = d.parcours.tournees ?? {};
  const n = demarrees(d);
  ajoute('tournees', { evenement: 'Action-startRoute', n }, () => [n, t.arrets_max > 1 ? t.arrets_max : null]);
  const rate = [...(d.parcours.imports ?? [])].filter((i) => i.echecs > 0 && IMPORTS[i.source]).sort((a, b) => b.echecs - a.echecs)[0];
  if (rate) ajoute('import_rate', { evenement: `Event-Import${IMPORTS[rate.source].cle}Error`, n: rate.echecs }, (x) => [rate.echecs, IMPORTS[rate.source].noms[x]]);
  if (t.optimisations_ratees) ajoute('optimisation_ratee', { evenement: 'Action-optimizeRoute (échec)', n: t.optimisations_ratees }, () => [t.optimisations_ratees]);
  const geo = (d.usage?.signaux ?? []).find((s) => s.nom === 'Event-geocoderError');
  if (geo) ajoute('adresses', { evenement: 'Event-geocoderError', n: geo.n }, () => [geo.n]);
  const prospection = (d.usage?.zones ?? []).find((z) => z.zone === 'Prospection');
  if (prospection) ajoute('prospection', { evenement: 'événements de la zone Prospection', n: prospection.n }, () => []);
  else if ((d.usage?.zones_jamais ?? []).includes('Prospection')) ajoute('prospection_jamais', { evenement: 'aucun événement de la zone Prospection', n: d.usage?.jours_actifs || 1 }, () => []);
  const importes = [...(d.parcours.imports ?? [])].filter((i) => i.contacts > 0 && IMPORTS[i.source]).sort((a, b) => b.contacts - a.contacts)[0];
  if (importes && importes.contacts >= 20) ajoute('import_reussi', { evenement: `Event-Import${IMPORTS[importes.source].cle}Success`, n: importes.reussis }, () => [importes.contacts]);
  const j = jours4(d);
  ajoute('regulier', { evenement: 'jours actifs sur 4 semaines', n: j }, () => [j]);
  return sortie.slice(0, MAX_QUESTIONS);
}

// L'e-mail au gros utilisateur (fondateur, 26/11) : une seule question ouverte, la même pour tous (brique
// interroger-un-utilisateur : une question ouverte fait répondre bien plus qu'une liste, Groove 10,2 % contre 1,3 %).
// Les questions tirées de l'usage (questionsDe) restent sur l'action, pour la relance du fondateur.
const GROS_TEXTE = {
  fr: ['Comment ça se passe avec Easy Way ?', 'Bonjour,\n\nVous faites beaucoup de tournées avec Easy Way. Comment ça se passe, de votre côté ?'],
  en: ['How is it going with Easy Way?', 'Hello,\n\nYou do a lot of routes with Easy Way. How is it going on your side?'],
  de: ['Wie läuft es mit Easy Way?', 'Hallo,\n\nSie fahren viele Touren mit Easy Way. Wie läuft es bei Ihnen?'],
  es: ['¿Qué tal con Easy Way?', 'Hola:\n\nHace muchas rutas con Easy Way. ¿Qué tal le va?'],
  it: ['Come va con Easy Way?', 'Buongiorno,\n\nfa molti percorsi con Easy Way. Come va, dal suo punto di vista?'],
  pt: ['Como está a correr com o Easy Way?', 'Olá,\n\nFaz muitas rotas com o Easy Way. Como está a correr do seu lado?'],
};
const rendreGros = (l, signature) => ({ sujet: GROS_TEXTE[l][0], corps: `${GROS_TEXTE[l][1]}\n\n${signature}` });
export function texteGros(_questions, langue, signature) {
  const l = lg(langue);
  const texte = rendreGros(l, signature);
  return l === 'fr' ? texte : { ...texte, traduction_fr: rendreGros('fr', signature) };
}

// La relance d'onboarding : elle n'affirme que ce que dit la fiche Firebase (l'onboarding n'est pas fini).
const ONBOARDING_TEXTE = {
  fr: ['Easy Way : quelque chose vous a bloqué ?', "Bonjour,\n\nVous avez commencé à configurer Easy Way il y a quelques jours, sans aller jusqu'au bout. C'est souvent le moment où quelque chose bloque.\n\nQu'est-ce qui vous a arrêté ? Une ligne en réponse suffit, et je vous aide à finir.\n\nJe ne vous relancerai pas à ce sujet."],
  en: ['Easy Way: did something get in the way?', 'Hello,\n\nYou started setting up Easy Way a few days ago, without getting to the end. That is often where something gets in the way.\n\nWhat stopped you? One line in reply is enough, and I will help you finish.\n\nI will not follow up on this again.'],
  de: ['Easy Way: Hat Sie etwas aufgehalten?', 'Hallo,\n\nSie haben vor ein paar Tagen begonnen, Easy Way einzurichten, aber nicht bis zum Ende. Oft hakt es genau an dieser Stelle.\n\nWas hat Sie aufgehalten? Eine Zeile als Antwort genügt, und ich helfe Ihnen, es abzuschließen.\n\nIch schreibe Ihnen dazu kein weiteres Mal.'],
  es: ['Easy Way: ¿algo le ha frenado?', 'Hola:\n\nEmpezó a configurar Easy Way hace unos días, sin llegar hasta el final. Suele ser el momento en que algo se atasca.\n\n¿Qué le ha frenado? Basta con una línea de respuesta, y le ayudo a terminar.\n\nNo volveré a escribirle sobre esto.'],
  it: ['Easy Way: qualcosa l’ha bloccata?', 'Buongiorno,\n\nHa iniziato a configurare Easy Way qualche giorno fa, senza arrivare alla fine. Spesso è il momento in cui qualcosa si blocca.\n\nCosa l’ha fermata? Basta una riga di risposta, e la aiuto a finire.\n\nNon le scriverò di nuovo su questo.'],
  pt: ['Easy Way: alguma coisa o travou?', 'Olá,\n\nComeçou a configurar o Easy Way há alguns dias, sem chegar ao fim. É muitas vezes o momento em que alguma coisa encrava.\n\nO que o fez parar? Basta uma linha em resposta, e eu ajudo-o a terminar.\n\nNão voltarei a escrever-lhe sobre isto.'],
};
const rendreOnboarding = (l, signature) => ({ sujet: ONBOARDING_TEXTE[l][0], corps: `${ONBOARDING_TEXTE[l][1]}\n\n${signature}` });
export function texteOnboarding(langue, signature) {
  const l = lg(langue);
  const texte = rendreOnboarding(l, signature);
  return l === 'fr' ? texte : { ...texte, traduction_fr: rendreOnboarding('fr', signature) };
}

// Une passe : la relance d'onboarding (une fois par personne, pour toujours) et l'action « contacter » des gros
// utilisateurs (une fois par personne). Le même identifiant ne se crée jamais deux fois. dossierPour(rc, fiche) : dossierDe.
export async function preparerContacts({ db, dossierPour, maintenant = new Date() }) {
  const { signature } = (await db.lire('crm_reglages', 'general')) ?? {};
  if (!signature) return { onboarding: 0, gros: 0, raison: 'signature à régler' };
  const t = maintenant.getTime();
  const users = await db.lister('users', ['revenuecat_id', 'locale', 'created_at', 'onboarding_complete', 'trial_active', 'subscription_active',
    'routes_created', 'last_action_at', 'is_test_user', 'churn_survey_reason', 'churn_survey_text', 'churn_survey_answered_at']);
  const fiches = new Map((await db.lister('crm_fiches')).map((f) => [f.id, f]));
  const existantes = new Set((await db.lister('crm_actions')).map((a) => a.id));
  const sortie = { onboarding: 0, gros: 0 };
  let erreurs = 0;
  const creer = async (id, champs, sorte) => {
    try { await db.creer('crm_actions', id, champs); existantes.add(id); sortie[sorte] += 1; } catch (e) { if (!/existe déjà/.test(String(e?.message))) erreurs += 1; }
  };
  // La fiche passe au dossier : sa réponse au questionnaire, envoyée par l'app, y passe avant Mixpanel (INT-EW-79).
  const dossierSur = (u) => { if (!u.revenuecat_id) return null; try { return dossierPour?.(u.revenuecat_id, u) ?? null; } catch { return null; } };

  for (const u of onboardingsAbandonnes(users, maintenant)) {
    const cle = cleUtilisateur(u.id);
    const id = `onboarding__${cle}`;
    const fiche = fiches.get(cle) ?? {};
    if (existantes.has(id) || fiche.desinscrit || fiche.adresse_invalide) continue;
    const d = dossierSur(u);
    // La fiche Firebase dit « pas fini », mais Mixpanel l'a vu finir : pas de relance.
    if (d?.parcours?.onboarding?.fini) continue;
    const l = langueDePersonne({ locale: u.locale, pays: d?.pays, choix: fiche.langue ?? null });
    await creer(id, { type: 'onboarding', user_id: u.id, statut: 'prete', ...texteOnboarding(l.langue, signature), langue: l.langue, langue_source: l.source,
      ...(l.pays ? { pays: l.pays } : {}), ...(d ? { resume: resumer(d, maintenant) } : {}),
      echeance: new Date(t + ECHEANCE_ONBOARDING), cree_le: maintenant }, 'onboarding');
  }

  for (const u of users) {
    if (!u.revenuecat_id || (u.routes_created ?? 0) < GROS.tournees || !(t - ts(u.last_action_at) <= GROS.actif_depuis)) continue;
    const cle = cleUtilisateur(u.id);
    const id = `gros__${cle}`;
    const fiche = fiches.get(cle) ?? {};
    if (existantes.has(id) || fiche.desinscrit || fiche.adresse_invalide) continue;
    const d = dossierSur(u);
    if (!estGros(d)) continue;
    const l = langueDePersonne({ locale: u.locale, pays: d.pays, choix: fiche.langue ?? null });
    const questions = questionsDe(d, l.langue);
    if (questions.length < 3) continue;
    await creer(id, { type: 'gros', variante: 'contacter', user_id: u.id, statut: 'prete', ...texteGros(questions, l.langue, signature), questions,
      langue: l.langue, langue_source: l.source, ...(l.pays ? { pays: l.pays } : {}), resume: resumer(d, maintenant),
      echeance: new Date(t + ECHEANCE_GROS), cree_le: maintenant }, 'gros');
  }
  return { ...sortie, ...(erreurs ? { erreurs } : {}) };
}
