// Le brouillon de l'e-mail aux résiliés, écrit depuis le dossier (EW-50), dans les six langues de l'app (EW-51).
// Un ou deux faits de son usage, sa réponse au questionnaire ou le problème vu, une seule question. Vouvoiement.

import { ecartsDe } from './reperes.mjs';

const JOUR = 86400000;

// Les erreurs qui disent quelque chose de son expérience, et à partir de combien de fois.
export const SIGNAUX = {
  'Event-ImportExcelError': { min: 1, resume: 'import d’un fichier en échec' },
  'Event-ImportCsvError': { min: 1, resume: 'import d’un fichier en échec' },
  'Event-ImportGsheetError': { min: 1, resume: 'import de Google Sheets en échec' },
  'Event-geocoderError': { min: 5, resume: 'adresses non trouvées' },
  'contacts.contactbookIssue': { min: 3, resume: 'contacts du téléphone illisibles' },
  'Event-emptyMapState': { min: 3, resume: 'carte restée vide' },
};

export const T = {
  fr: {
    sujet: 'Votre abonnement Easy Way', bonjour: 'Bonjour,',
    pris: "Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.",
    tournees: (n, s) => `Vous avez lancé ${n} tournée${n > 1 ? 's' : ''} avec l'app${s ? ` en ${s} semaine${s > 1 ? 's' : ''}` : ''}.`,
    zone: (z) => `Vous avez surtout utilisé ${z}, sans avoir encore lancé de tournée.`,
    vu: (q) => `En regardant de mon côté, je vois que ${q}.`, et: ', et ',
    indique: (r) => `Dans l'app, vous avez indiqué ${r}.`, ecrit: (t) => ` Vous avez écrit : « ${t} ».`,
    fin: "Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.",
    zones: { Carte: 'la carte', 'Compte et synchronisation': 'la synchronisation', Contacts: 'les contacts', 'Import de contacts': "l'import de contacts",
      Prospection: 'la prospection', "Recherche d'adresse": "la recherche d'adresse", Scanner: 'le scanner' },
    signaux: { 'Event-ImportExcelError': "l'import de votre fichier n'a pas marché", 'Event-geocoderError': "beaucoup d'adresses n'ont pas été trouvées sur la carte",
      'contacts.contactbookIssue': "l'app n'a pas réussi à lire les contacts de votre téléphone", 'Event-emptyMapState': 'votre carte est restée vide' },
    raisons: { tooExpensive: "que c'était trop cher", dontNeedAnymore: "que vous n'en aviez plus besoin", noNeedOfPremiumFeature: 'que les fonctions payantes ne vous servaient pas',
      missingFeatures: "qu'il vous manquait des fonctions", tooBuggy: "qu'il y avait trop de bugs", tooSlow: "que l'app était trop lente", difficultToUse: "que l'app était difficile à utiliser" },
    questions: { tooExpensive: "Pour quel prix, ou avec quoi de plus, l'app vous aurait-elle paru valoir le coup ?",
      dontNeedAnymore: "Est-ce votre façon de travailler qui a changé, ou l'app qui ne collait plus à vos tournées ?",
      noNeedOfPremiumFeature: "Qu'est-ce qui vous aurait fait garder l'abonnement ?", missingFeatures: 'Quelle fonction vous a le plus manqué ?',
      tooBuggy: 'Quel problème vous a le plus gêné ? Je veux le corriger.', tooSlow: "À quel moment l'app était-elle trop lente ?",
      difficultToUse: "À quel moment l'app vous a-t-elle paru compliquée ?", other: "Si vous avez une minute : qu'est-ce qui vous a fait partir ?",
      probleme: 'Est-ce ce problème qui vous a arrêté, ou autre chose ?',
      jamais_demarre: "Qu'est-ce qui vous a manqué pour partir en tournée avec l'app ?" },
  },
  en: {
    sujet: 'Your Easy Way subscription', bonjour: 'Hello,',
    pris: 'You cancelled your Easy Way subscription. It is done, there is nothing else to do.',
    tournees: (n, s) => `You started ${n} route${n > 1 ? 's' : ''} with the app${s ? ` over ${s} week${s > 1 ? 's' : ''}` : ''}.`,
    zone: (z) => `You mostly used ${z}, without starting a route yet.`,
    vu: (q) => `Looking on my side, I can see that ${q}.`, et: ', and ',
    indique: (r) => `In the app, you said ${r}.`, ecrit: (t) => ` You wrote: "${t}".`,
    fin: 'One line in reply is enough: it decides what I fix next. I will not write to you again about this.',
    zones: { Carte: 'the map', 'Compte et synchronisation': 'account sync', Contacts: 'contacts', 'Import de contacts': 'contact import',
      Prospection: 'prospecting', "Recherche d'adresse": 'address search', Scanner: 'the scanner' },
    signaux: { 'Event-ImportExcelError': 'importing your file did not work', 'Event-geocoderError': 'many addresses could not be found on the map',
      'contacts.contactbookIssue': 'the app could not read the contacts on your phone', 'Event-emptyMapState': 'your map stayed empty' },
    raisons: { tooExpensive: 'that it was too expensive', dontNeedAnymore: 'that you no longer needed it', noNeedOfPremiumFeature: 'that you did not need the paid features',
      missingFeatures: 'that some features were missing', tooBuggy: 'that there were too many bugs', tooSlow: 'that the app was too slow', difficultToUse: 'that the app was hard to use' },
    questions: { tooExpensive: 'At what price, or with what more, would the app have felt worth it?',
      dontNeedAnymore: 'Did the way you work change, or did the app stop fitting your routes?',
      noNeedOfPremiumFeature: 'What would have made you keep the subscription?', missingFeatures: 'Which feature did you miss the most?',
      tooBuggy: 'Which problem bothered you the most? I want to fix it.', tooSlow: 'When was the app too slow?',
      difficultToUse: 'At what point did the app feel complicated?', other: 'If you have a minute: what made you leave?',
      probleme: 'Was it this problem that stopped you, or something else?',
      jamais_demarre: 'What was missing for you to go out on a route with the app?' },
  },
  de: {
    sujet: 'Ihr Easy Way Abo', bonjour: 'Hallo,',
    pris: 'Sie haben Ihr Abo von Easy Way gekündigt. Das ist erledigt, Sie müssen nichts weiter tun.',
    tournees: (n, s) => `Sie haben mit der App ${n} Route${n > 1 ? 'n' : ''} gestartet${s ? `, in ${s} Woche${s > 1 ? 'n' : ''}` : ''}.`,
    zone: (z) => `Sie haben vor allem ${z} genutzt, ohne schon eine Route zu starten.`,
    vu: (q) => `Auf meiner Seite sehe ich, dass ${q}.`, et: ', und dass ',
    indique: (r) => `In der App haben Sie angegeben, ${r}.`, ecrit: (t) => ` Sie haben geschrieben: „${t}“.`,
    fin: 'Eine Zeile als Antwort genügt: Sie entscheidet, was ich als Nächstes verbessere. Ich schreibe Ihnen dazu keine weitere E-Mail.',
    zones: { Carte: 'die Karte', 'Compte et synchronisation': 'die Synchronisierung', Contacts: 'die Kontakte', 'Import de contacts': 'den Kontaktimport',
      Prospection: 'die Akquise', "Recherche d'adresse": 'die Adresssuche', Scanner: 'den Scanner' },
    signaux: { 'Event-ImportExcelError': 'der Import Ihrer Datei nicht funktioniert hat', 'Event-geocoderError': 'viele Adressen auf der Karte nicht gefunden wurden',
      'contacts.contactbookIssue': 'die App die Kontakte Ihres Telefons nicht lesen konnte', 'Event-emptyMapState': 'Ihre Karte leer geblieben ist' },
    raisons: { tooExpensive: 'dass es zu teuer war', dontNeedAnymore: 'dass Sie die App nicht mehr brauchen', noNeedOfPremiumFeature: 'dass Sie die kostenpflichtigen Funktionen nicht brauchten',
      missingFeatures: 'dass Ihnen Funktionen gefehlt haben', tooBuggy: 'dass es zu viele Fehler gab', tooSlow: 'dass die App zu langsam war', difficultToUse: 'dass die App schwer zu bedienen war' },
    questions: { tooExpensive: 'Zu welchem Preis, oder mit was zusätzlich, wäre die App es Ihnen wert gewesen?',
      dontNeedAnymore: 'Hat sich Ihre Arbeitsweise geändert, oder passte die App nicht mehr zu Ihren Touren?',
      noNeedOfPremiumFeature: 'Was hätte Sie dazu gebracht, das Abo zu behalten?', missingFeatures: 'Welche Funktion hat Ihnen am meisten gefehlt?',
      tooBuggy: 'Welcher Fehler hat Sie am meisten gestört? Ich möchte ihn beheben.', tooSlow: 'Wann war die App zu langsam?',
      difficultToUse: 'An welcher Stelle kam Ihnen die App kompliziert vor?', other: 'Wenn Sie eine Minute haben: Warum haben Sie gekündigt?',
      probleme: 'War es dieses Problem, das Sie aufgehalten hat, oder etwas anderes?',
      jamais_demarre: 'Was hat Ihnen gefehlt, um mit der App auf Tour zu gehen?' },
  },
  es: {
    sujet: 'Su suscripción a Easy Way', bonjour: 'Hola:',
    pris: 'Ha cancelado su suscripción a Easy Way. Ya está hecho, no tiene que hacer nada más.',
    tournees: (n, s) => `Ha iniciado ${n} ruta${n > 1 ? 's' : ''} con la app${s ? ` en ${s} semana${s > 1 ? 's' : ''}` : ''}.`,
    zone: (z) => `Usaba sobre todo ${z}, sin haber iniciado todavía una ruta.`,
    vu: (q) => `Mirando por mi parte, veo que ${q}.`, et: ', y que ',
    indique: (r) => `En la app, indicó ${r}.`, ecrit: (t) => ` Escribió: «${t}».`,
    fin: 'Basta una línea como respuesta: es lo que decide lo que corrijo después. No le escribiré ningún otro correo sobre esto.',
    zones: { Carte: 'el mapa', 'Compte et synchronisation': 'la sincronización', Contacts: 'los contactos', 'Import de contacts': 'la importación de contactos',
      Prospection: 'la prospección', "Recherche d'adresse": 'la búsqueda de direcciones', Scanner: 'el escáner' },
    signaux: { 'Event-ImportExcelError': 'la importación de su archivo no funcionó', 'Event-geocoderError': 'muchas direcciones no se encontraron en el mapa',
      'contacts.contactbookIssue': 'la app no pudo leer los contactos de su teléfono', 'Event-emptyMapState': 'su mapa se quedó vacío' },
    raisons: { tooExpensive: 'que era demasiado caro', dontNeedAnymore: 'que ya no la necesitaba', noNeedOfPremiumFeature: 'que no le servían las funciones de pago',
      missingFeatures: 'que le faltaban funciones', tooBuggy: 'que había demasiados errores', tooSlow: 'que la app era demasiado lenta', difficultToUse: 'que la app era difícil de usar' },
    questions: { tooExpensive: '¿A qué precio, o con qué más, le habría parecido que la app merecía la pena?',
      dontNeedAnymore: '¿Cambió su forma de trabajar, o la app dejó de encajar con sus rutas?',
      noNeedOfPremiumFeature: '¿Qué le habría hecho mantener la suscripción?', missingFeatures: '¿Qué función echó más de menos?',
      tooBuggy: '¿Qué problema le molestó más? Quiero corregirlo.', tooSlow: '¿En qué momento la app fue demasiado lenta?',
      difficultToUse: '¿En qué momento le pareció complicada la app?', other: 'Si tiene un minuto: ¿qué le hizo irse?',
      probleme: '¿Fue este problema lo que le frenó, u otra cosa?',
      jamais_demarre: '¿Qué le faltó para salir de ruta con la app?' },
  },
  it: {
    sujet: 'Il suo abbonamento a Easy Way', bonjour: 'Buongiorno,',
    pris: 'Ha disdetto il suo abbonamento a Easy Way. È fatto, non deve fare altro.',
    tournees: (n, s) => `Ha avviato ${n} percors${n > 1 ? 'i' : 'o'} con l'app${s ? ` in ${s} settiman${s > 1 ? 'e' : 'a'}` : ''}.`,
    zone: (z) => `Usava soprattutto ${z}, senza aver ancora avviato un percorso.`,
    vu: (q) => `Guardando dalla mia parte, vedo che ${q}.`, et: ', e che ',
    indique: (r) => `Nell'app ha indicato ${r}.`, ecrit: (t) => ` Ha scritto: «${t}».`,
    fin: 'Basta una riga in risposta: è ciò che decide cosa correggo dopo. Non le scriverò altre e-mail su questo.',
    zones: { Carte: 'la mappa', 'Compte et synchronisation': 'la sincronizzazione', Contacts: 'i contatti', 'Import de contacts': "l'importazione dei contatti",
      Prospection: 'la prospezione', "Recherche d'adresse": 'la ricerca di indirizzi', Scanner: 'lo scanner' },
    signaux: { 'Event-ImportExcelError': "l'importazione del suo file non ha funzionato", 'Event-geocoderError': 'molti indirizzi non sono stati trovati sulla mappa',
      'contacts.contactbookIssue': "l'app non è riuscita a leggere i contatti del suo telefono", 'Event-emptyMapState': 'la sua mappa è rimasta vuota' },
    raisons: { tooExpensive: 'che era troppo caro', dontNeedAnymore: 'che non le serviva più', noNeedOfPremiumFeature: 'che le funzioni a pagamento non le servivano',
      missingFeatures: 'che mancavano delle funzioni', tooBuggy: "che c'erano troppi errori", tooSlow: "che l'app era troppo lenta", difficultToUse: "che l'app era difficile da usare" },
    questions: { tooExpensive: "A quale prezzo, o con che cosa in più, l'app le sarebbe sembrata valerne la pena?",
      dontNeedAnymore: "È cambiato il suo modo di lavorare, o l'app non si adattava più ai suoi giri?",
      noNeedOfPremiumFeature: "Che cosa le avrebbe fatto tenere l'abbonamento?", missingFeatures: 'Quale funzione le è mancata di più?',
      tooBuggy: 'Quale problema le ha dato più fastidio? Voglio correggerlo.', tooSlow: "In quale momento l'app era troppo lenta?",
      difficultToUse: "In quale momento l'app le è sembrata complicata?", other: "Se ha un minuto: che cosa l'ha fatta andare via?",
      probleme: "È stato questo problema a fermarla, o qualcos'altro?",
      jamais_demarre: "Che cosa le è mancato per partire in giro con l'app?" },
  },
  pt: {
    sujet: 'A sua assinatura do Easy Way', bonjour: 'Olá,',
    pris: 'Cancelou a sua assinatura do Easy Way. Está feito, não precisa de fazer mais nada.',
    tournees: (n, s) => `Iniciou ${n} rota${n > 1 ? 's' : ''} com a app${s ? ` em ${s} semana${s > 1 ? 's' : ''}` : ''}.`,
    zone: (z) => `Usava sobretudo ${z}, sem ter ainda iniciado uma rota.`,
    vu: (q) => `Vendo do meu lado, percebo que ${q}.`, et: ', e que ',
    indique: (r) => `Na app, indicou ${r}.`, ecrit: (t) => ` Escreveu: «${t}».`,
    fin: 'Basta uma linha como resposta: é isso que decide o que corrijo a seguir. Não lhe voltarei a escrever sobre isto.',
    zones: { Carte: 'o mapa', 'Compte et synchronisation': 'a sincronização', Contacts: 'os contactos', 'Import de contacts': 'a importação de contactos',
      Prospection: 'a prospeção', "Recherche d'adresse": 'a pesquisa de moradas', Scanner: 'o scanner' },
    signaux: { 'Event-ImportExcelError': 'a importação do seu ficheiro não funcionou', 'Event-geocoderError': 'muitas moradas não foram encontradas no mapa',
      'contacts.contactbookIssue': 'a app não conseguiu ler os contactos do seu telefone', 'Event-emptyMapState': 'o seu mapa ficou vazio' },
    raisons: { tooExpensive: 'que era demasiado caro', dontNeedAnymore: 'que já não precisava dela', noNeedOfPremiumFeature: 'que as funções pagas não lhe serviam',
      missingFeatures: 'que faltavam funções', tooBuggy: 'que havia demasiados erros', tooSlow: 'que a app era demasiado lenta', difficultToUse: 'que a app era difícil de usar' },
    questions: { tooExpensive: 'A que preço, ou com o que mais, a app lhe teria parecido valer a pena?',
      dontNeedAnymore: 'Mudou a sua forma de trabalhar, ou a app deixou de se adaptar às suas rotas?',
      noNeedOfPremiumFeature: 'O que o teria feito manter a assinatura?', missingFeatures: 'Que função lhe fez mais falta?',
      tooBuggy: 'Que problema o incomodou mais? Quero corrigi-lo.', tooSlow: 'Em que momento a app foi demasiado lenta?',
      difficultToUse: 'Em que momento a app lhe pareceu complicada?', other: 'Se tiver um minuto: o que o fez sair?',
      probleme: 'Foi este problema que o travou, ou outra coisa?',
      jamais_demarre: 'O que lhe faltou para sair em rota com a app?' },
  },
};

// Les échecs d'import CSV et Google Sheets se disent comme celui d'Excel (INT-EW-69).
for (const L of Object.values(T)) {
  L.signaux['Event-ImportCsvError'] ??= L.signaux['Event-ImportExcelError'];
  L.signaux['Event-ImportGsheetError'] ??= L.signaux['Event-ImportExcelError'];
}

// L'essai annulé (fondateur, 26/11, version D) : une seule ligne, la même pour tous, avec ou sans réponse au questionnaire.
// Transposée de « what were you hoping it would do? » (environ 20 % de réponses sur une centaine d'envois,
// hephaistos research/donnees/citations-voix.csv, resil-3, « fort »). Brique emails-utilisateurs.
export const ESSAI_COURT = {
  fr: { sujet: 'Votre essai Easy Way', corps: "Bonjour,\n\nVous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?" },
  en: { sujet: 'Your Easy Way trial', corps: 'Hello,\n\nYou cancelled your Easy Way trial. What were you hoping the app would do for you?' },
  de: { sujet: 'Ihre Easy Way Testphase', corps: 'Hallo,\n\nSie haben Ihre Easy Way Testphase beendet. Was hatten Sie sich von der App erhofft?' },
  es: { sujet: 'Su prueba de Easy Way', corps: 'Hola:\n\nHa cancelado su prueba de Easy Way. ¿Qué esperaba que la app hiciera por usted?' },
  it: { sujet: 'La sua prova di Easy Way', corps: "Buongiorno,\n\nha annullato la sua prova di Easy Way. Che cosa sperava che l'app facesse per lei?" },
  pt: { sujet: 'O seu teste do Easy Way', corps: 'Olá,\n\nCancelou o seu teste do Easy Way. O que esperava que a app fizesse por si?' },
};

// Une réponse par objection du questionnaire (fondateur, 26/11). « merci » ouvre ; puis la suite de sa raison.
// Boxy (iOS seulement, absent de Google Play au 26/11) n'est proposé qu'à un livreur sur l'App Store ; 16 arrêts :
// le plafond gratuit (hephaistos, brique prix-offres, C1) ; « je vous préviens » : l'e-mail « bug corrigé ».
const LIEN_BOXY = 'https://apps.apple.com/app/id6756269385';
export const ESSAI_REPONSE = {
  fr: { merci: "Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.",
    boxy: `Notre app Boxy, faite pour les livreurs, fait les mêmes tournées pour 7,99 € par mois :\n${LIEN_BOXY}`,
    gratuit: "La version gratuite reste à vous, jusqu'à 16 arrêts par tournée.",
    dontNeedAnymore: "C'est votre activité qui a changé, ou l'app qui ne collait pas à vos tournées ?",
    missingFeatures: 'Quelle fonction vous a le plus manqué ?',
    tooBuggy: "Quel problème avez-vous rencontré ? Je le corrige et je vous préviens quand c'est fait.",
    tooSlow: "À quel moment l'app était-elle lente ? Je regarde moi-même.",
    difficultToUse: "À quel moment l'app vous a-t-elle paru compliquée ?" },
  en: { merci: 'You cancelled your Easy Way trial and told me why in the app, thank you.',
    boxy: `Our app Boxy, made for delivery drivers, plans the same routes for less:\n${LIEN_BOXY}`,
    gratuit: 'The free version is still yours, up to 16 stops per route.',
    dontNeedAnymore: 'Did your work change, or did the app not fit your routes?',
    missingFeatures: 'Which feature did you miss the most?',
    tooBuggy: 'What problem did you run into? I will fix it and let you know when it is done.',
    tooSlow: 'When was the app slow? I will look into it myself.',
    difficultToUse: 'At what point did the app feel complicated?' },
  de: { merci: 'Sie haben Ihre Easy Way Testphase beendet und mir in der App gesagt, warum. Danke.',
    boxy: `Unsere App Boxy, gemacht für Zusteller, plant dieselben Touren günstiger:\n${LIEN_BOXY}`,
    gratuit: 'Die kostenlose Version bleibt Ihnen, mit bis zu 16 Stopps pro Route.',
    dontNeedAnymore: 'Hat sich Ihre Arbeit geändert, oder passte die App nicht zu Ihren Touren?',
    missingFeatures: 'Welche Funktion hat Ihnen am meisten gefehlt?',
    tooBuggy: 'Auf welches Problem sind Sie gestoßen? Ich behebe es und sage Ihnen Bescheid, wenn es erledigt ist.',
    tooSlow: 'Wann war die App langsam? Ich sehe es mir selbst an.',
    difficultToUse: 'An welcher Stelle kam Ihnen die App kompliziert vor?' },
  es: { merci: 'Ha cancelado su prueba de Easy Way y me dijo por qué en la app, gracias.',
    boxy: `Nuestra app Boxy, hecha para repartidores, planifica las mismas rutas por menos:\n${LIEN_BOXY}`,
    gratuit: 'La versión gratuita sigue siendo suya, con hasta 16 paradas por ruta.',
    dontNeedAnymore: '¿Cambió su actividad, o la app no encajaba con sus rutas?',
    missingFeatures: '¿Qué función echó más en falta?',
    tooBuggy: '¿Qué problema encontró? Lo corrijo y le aviso cuando esté hecho.',
    tooSlow: '¿En qué momento fue lenta la app? Lo reviso yo mismo.',
    difficultToUse: '¿En qué momento le pareció complicada la app?' },
  it: { merci: "Ha annullato la sua prova di Easy Way e mi ha detto perché nell'app, grazie.",
    boxy: `La nostra app Boxy, fatta per i corrieri, pianifica gli stessi percorsi spendendo meno:\n${LIEN_BOXY}`,
    gratuit: 'La versione gratuita resta sua, fino a 16 fermate per percorso.',
    dontNeedAnymore: "È cambiata la sua attività, o l'app non si adattava ai suoi percorsi?",
    missingFeatures: 'Quale funzione le è mancata di più?',
    tooBuggy: 'Che problema ha incontrato? Lo correggo e la avviso quando è fatto.',
    tooSlow: "In quale momento l'app era lenta? Controllo di persona.",
    difficultToUse: "In quale momento l'app le è sembrata complicata?" },
  pt: { merci: 'Cancelou o seu teste do Easy Way e disse-me porquê na app, obrigado.',
    boxy: `A nossa app Boxy, feita para estafetas, planeia as mesmas rotas por menos:\n${LIEN_BOXY}`,
    gratuit: 'A versão gratuita continua a ser sua, até 16 paragens por rota.',
    dontNeedAnymore: 'Mudou a sua atividade, ou a app não se adaptava às suas rotas?',
    missingFeatures: 'Que função lhe fez mais falta?',
    tooBuggy: 'Que problema encontrou? Eu corrijo-o e aviso-o quando estiver feito.',
    tooSlow: 'Em que momento a app estava lenta? Vou ver eu próprio.',
    difficultToUse: 'Em que momento a app lhe pareceu complicada?' },
};
const estLivreur = (d) => [d?.parcours?.onboarding?.metier, d?.usage?.metier].some((m) => /livreur|delivery/i.test(String(m ?? '')));

// La suite de l'e-mail selon sa réponse récente au questionnaire, ou null (la ligne pour tous).
function suiteEssai(d, store) {
  const r = d && reponseRecente(d) ? d.questionnaire.raison : null;
  if (r === 'tooExpensive') return estLivreur(d) && store === 'APP_STORE' ? 'boxy' : 'gratuit';
  if (r === 'noNeedOfPremiumFeature') return 'gratuit';
  return ['dontNeedAnymore', 'missingFeatures', 'tooBuggy', 'tooSlow', 'difficultToUse'].includes(r) ? r : null;
}

// La résiliation d'un abonné (fondateur, 26/11, version A) : comme l'essai annulé, la suite de sa réponse au
// questionnaire, sinon une ligne. « Qu'est-ce qui vous a fait arrêter » : Groove, environ 19 % de réponses de plus que
// « pourquoi » (brique interroger-un-utilisateur). Ni son usage, ni ce qu'on voit de notre côté.
export const DEPART = {
  fr: { sujet: 'Votre abonnement Easy Way', ligne: "Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?",
    merci: "Vous avez arrêté votre abonnement à Easy Way, et vous avez dit pourquoi dans l'app, merci." },
  en: { sujet: 'Your Easy Way subscription', ligne: 'You cancelled your Easy Way subscription. What made you stop?',
    merci: 'You cancelled your Easy Way subscription and told me why in the app, thank you.' },
  de: { sujet: 'Ihr Easy Way Abo', ligne: 'Sie haben Ihr Easy Way Abo gekündigt. Was hat Sie dazu gebracht aufzuhören?',
    merci: 'Sie haben Ihr Easy Way Abo gekündigt und mir in der App gesagt, warum. Danke.' },
  es: { sujet: 'Su suscripción a Easy Way', ligne: 'Ha cancelado su suscripción a Easy Way. ¿Qué le hizo dejarla?',
    merci: 'Ha cancelado su suscripción a Easy Way y me dijo por qué en la app, gracias.' },
  it: { sujet: 'Il suo abbonamento a Easy Way', ligne: "Ha disdetto il suo abbonamento a Easy Way. Che cosa l'ha fatta smettere?",
    merci: "Ha disdetto il suo abbonamento a Easy Way e mi ha detto perché nell'app, grazie." },
  pt: { sujet: 'A sua assinatura do Easy Way', ligne: 'Cancelou a sua assinatura do Easy Way. O que o fez parar?',
    merci: 'Cancelou a sua assinatura do Easy Way e disse-me porquê na app, obrigado.' },
};
export function brouillonDepart(d, langue, signature, { store = null } = {}) {
  const suite = suiteEssai(d, store);
  const rendre = (lg) => {
    const D = DEPART[lg] ?? DEPART.en; const bonjour = (T[lg] ?? T.en).bonjour;
    const milieu = suite ? [D.merci, (ESSAI_REPONSE[lg] ?? ESSAI_REPONSE.en)[suite]] : [D.ligne];
    return { sujet: D.sujet, corps: [bonjour, ...milieu, signature].join('\n\n') };
  };
  const b = rendre(langue);
  return langue === 'fr' ? b : { ...b, traduction_fr: rendre('fr') };
}

// L'e-mail d'essai annulé et sa traduction française : la suite de sa réponse, sinon la ligne pour tous.
export function brouillonEssaiAnnule(d, langue, signature, { store = null } = {}) {
  const suite = suiteEssai(d, store);
  const rendre = (lg) => {
    if (!suite) { const t = ESSAI_COURT[lg] ?? ESSAI_COURT.en; return { sujet: t.sujet, corps: `${t.corps}\n\n${signature}` }; }
    const R = ESSAI_REPONSE[lg] ?? ESSAI_REPONSE.en; const bonjour = (T[lg] ?? T.en).bonjour;
    return { sujet: (ESSAI_COURT[lg] ?? ESSAI_COURT.en).sujet, corps: [bonjour, R.merci, R[suite], signature].join('\n\n') };
  };
  const b = rendre(langue);
  return langue === 'fr' ? b : { ...b, traduction_fr: rendre('fr') };
}

// La question : celle de sa réponse au questionnaire, sinon celle du problème vu, sinon la question ouverte.
// Une réponse au questionnaire de plus de 60 jours ne parle plus de ce départ : elle n'est pas citée.
export const QUESTIONNAIRE_JOURS = 60;
export const reponseRecente = (d) => Boolean(d.questionnaire) && (!d.questionnaire.le || !d.calcule_le
  || (new Date(d.calcule_le) - new Date(d.questionnaire.le)) <= QUESTIONNAIRE_JOURS * JOUR);

// Sans réponse, la question part du plus grand écart aux gens du même métier (INT-EW-71) : un import raté, le problème ;
// une tournée jamais démarrée, ce qui a manqué pour partir.
const QUESTION_ECART = { import: 'probleme', demarrage_payant: 'jamais_demarre', demarrage_essai: 'jamais_demarre' };
export function cleQuestion(d) {
  if (d.questionnaire && reponseRecente(d)) return T.fr.questions[d.questionnaire.raison] ? d.questionnaire.raison : 'other';
  const ecart = ecartsDe(d).find((e) => QUESTION_ECART[e.id] && (e.id !== 'import' || d.usage.signaux.length));
  if (ecart) return QUESTION_ECART[ecart.id];
  return d.usage.signaux.length ? 'probleme' : 'other';
}

export function brouillonResiliation(d, langue, signature) {
  const L = T[langue] ?? T.en;
  const u = d.usage; const r = reponseRecente(d) ? d.questionnaire?.raison : null;
  const semaines = u.premier_jour && u.dernier_jour ? Math.max(1, Math.round((new Date(u.dernier_jour) - new Date(u.premier_jour)) / (7 * JOUR))) : null;
  const zone = u.zones.find((z) => L.zones[z.zone])?.zone;
  const phrases = [];
  if (u.tournees > 0) phrases.push(L.tournees(u.tournees, semaines));
  else if (zone) phrases.push(L.zone(L.zones[zone]));
  const vus = u.signaux.slice(0, 2).map((x) => L.signaux[x.nom]).filter(Boolean);
  if (vus.length) phrases.push(L.vu(vus.join(L.et)));
  if (L.raisons[r]) {
    const texte = d.questionnaire.texte;
    phrases.push(L.indique(L.raisons[r]) + (texte && texte.length <= 200 && !/[?¿]/.test(texte) ? L.ecrit(texte) : ''));
  }
  const corps = [L.bonjour, L.pris, phrases.join(' '), L.questions[cleQuestion(d)], L.fin, signature].filter(Boolean).join('\n\n');
  return { sujet: L.sujet, corps };
}

// Le brouillon et, s'il n'est pas en français, le même rendu en français pour la relecture du fondateur.
export function brouillonAvecTraduction(d, langue, signature) {
  const b = brouillonResiliation(d, langue, signature);
  return langue === 'fr' ? b : { ...b, traduction_fr: brouillonResiliation(d, 'fr', signature) };
}
