// Les modèles d'e-mail (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.7), dans les six langues de l'app (EW-51).
// Texte brut, vouvoiement, sans prénom. Les noms de boutons sont ceux de l'app (module_core/lib/l10n, button_OptimizeRoute
// et button_StartRoute).
import { LOCALE_DATE } from './langues.mjs';

export { langueDe } from './langues.mjs';

export const MODELES = {
  // Le rappel de fin d'essai (fondateur, 25/11, sa version mot pour mot) : le même pour tous, sans l'usage, sans mode
  // d'emploi ni chemin pour arrêter. La brique « emails-utilisateurs » (hephaistos) en garde les règles.
  essai_j2: {
    fr: ['Votre essai Easy Way se termine {{jour_fin}}', `Bonjour,

J'espère qu'Easy Way vous plaît. Votre essai se termine {{jour_fin}}, et l'abonnement démarre ce jour-là.

Si quelque chose ne va pas, un court message suffit.

{{signature}}`],
    en: ['Your Easy Way trial ends {{jour_fin}}', `Hello,

I hope you are enjoying Easy Way. Your trial ends {{jour_fin}}, and the subscription starts that day.

If anything is not right, a short message is enough.

{{signature}}`],
    de: ['Ihre Easy Way Testphase endet {{jour_fin}}', `Hallo,

ich hoffe, Easy Way gefällt Ihnen. Ihre Testphase endet {{jour_fin}}, und an diesem Tag beginnt das Abo.

Wenn etwas nicht passt, genügt eine kurze Nachricht.

{{signature}}`],
    es: ['Su prueba de Easy Way termina {{jour_fin}}', `Hola:

Espero que Easy Way le esté gustando. Su prueba termina {{jour_fin}} y ese día empieza la suscripción.

Si algo no va bien, basta con un mensaje corto.

{{signature}}`],
    it: ['La sua prova di Easy Way termina {{jour_fin}}', `Buongiorno,

spero che Easy Way le piaccia. La sua prova termina {{jour_fin}} e quel giorno inizia l'abbonamento.

Se qualcosa non va, basta un breve messaggio.

{{signature}}`],
    pt: ['O seu teste do Easy Way termina {{jour_fin}}', `Olá,

Espero que esteja a gostar do Easy Way. O seu teste termina {{jour_fin}} e nesse dia começa a assinatura.

Se algo não estiver bem, basta uma mensagem curta.

{{signature}}`],
  },
  resiliation: {
    fr: ['Votre abonnement Easy Way est arrêté', `Bonjour,

Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.

Une seule question, si vous avez une minute : qu'est-ce qui vous a fait partir ? Une ligne en réponse suffit. C'est ce qui décide de ce que je corrige ensuite.

Je ne vous écrirai pas d'autre e-mail à ce sujet.

{{signature}}`],
    en: ['Your Easy Way subscription is cancelled', `Hello,

You cancelled your Easy Way subscription. It is done, there is nothing else to do.

One question, if you have a minute: what made you leave? One line in reply is enough. It decides what I fix next.

I will not write to you again about this.

{{signature}}`],
    de: ['Ihr Easy Way Abo ist gekündigt', `Hallo,

Sie haben Ihr Abo von Easy Way gekündigt. Das ist erledigt, Sie müssen nichts weiter tun.

Nur eine Frage, wenn Sie eine Minute haben: Warum haben Sie gekündigt? Eine Zeile als Antwort genügt. Sie entscheidet, was ich als Nächstes verbessere.

Ich schreibe Ihnen dazu keine weitere E-Mail.

{{signature}}`],
    es: ['Su suscripción a Easy Way está cancelada', `Hola:

Ha cancelado su suscripción a Easy Way. Ya está hecho, no tiene que hacer nada más.

Solo una pregunta, si tiene un minuto: ¿qué le hizo irse? Basta una línea como respuesta. Es lo que decide lo que corrijo después.

No le escribiré ningún otro correo sobre esto.

{{signature}}`],
    it: ['Il suo abbonamento a Easy Way è disdetto', `Buongiorno,

Ha disdetto il suo abbonamento a Easy Way. È fatto, non deve fare altro.

Una sola domanda, se ha un minuto: che cosa l'ha fatta andare via? Basta una riga in risposta. È ciò che decide cosa correggo dopo.

Non le scriverò altre e-mail su questo.

{{signature}}`],
    pt: ['A sua assinatura do Easy Way foi cancelada', `Olá,

Cancelou a sua assinatura do Easy Way. Está feito, não precisa de fazer mais nada.

Só uma pergunta, se tiver um minuto: o que o fez sair? Basta uma linha como resposta. É isso que decide o que corrijo a seguir.

Não lhe voltarei a escrever sobre isto.

{{signature}}`],
  },
  // L'e-mail de bienvenue (INT-EW-9) : court, signé, une question à laquelle on répond en une ligne. Il se prépare
  // toujours, mais ne part qu'une fois la bienvenue sortie de l'essai par le fondateur (INT-EW-94), après son oui sur ce texte.
  bienvenue: {
    fr: ['Bienvenue sur Easy Way', `Bonjour,

Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.

Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.

{{signature}}`],
    en: ['Welcome to Easy Way', `Hello,

Thank you for installing Easy Way. I built the app and I read every reply myself.

One question: what made you install Easy Way? One line in reply to this email is enough.

{{signature}}`],
    de: ['Willkommen bei Easy Way', `Hallo,

vielen Dank, dass Sie Easy Way installiert haben. Ich habe die App entwickelt und lese jede Antwort selbst.

Nur eine Frage: Was hat Sie dazu gebracht, Easy Way zu installieren? Eine Zeile als Antwort auf diese E-Mail genügt.

{{signature}}`],
    es: ['Le doy la bienvenida a Easy Way', `Hola:

Gracias por instalar Easy Way. Yo he creado la app y leo personalmente cada respuesta.

Una sola pregunta: ¿qué le llevó a instalar Easy Way? Basta con una línea en respuesta a este correo.

{{signature}}`],
    it: ['Le do il benvenuto su Easy Way', `Buongiorno,

Grazie per aver installato Easy Way. Ho creato io l'app e leggo di persona ogni risposta.

Una sola domanda: cosa l'ha spinta a installare Easy Way? Basta una riga in risposta a questa e-mail.

{{signature}}`],
    pt: ['Boas-vindas ao Easy Way', `Olá,

Obrigado por instalar o Easy Way. Fui eu que criei a app e leio pessoalmente cada resposta.

Uma só pergunta: o que o levou a instalar o Easy Way? Basta uma linha em resposta a este e-mail.

{{signature}}`],
  },
  bug_corrige: {
    fr: ['Le problème que vous avez signalé est corrigé', `Bonjour,

Vous nous avez signalé un problème dans Easy Way : {{titre}}.

Il est corrigé dans la version {{version}}, disponible sur {{store}}. Il suffit de mettre l'app à jour.

Si vous le voyez encore, répondez à cet e-mail : je regarde moi-même.

Merci de l'avoir signalé.

{{signature}}`],
    en: ['The problem you reported is fixed', `Hello,

You reported a problem in Easy Way: {{titre}}.

It is fixed in version {{version}}, available on {{store}}. Just update the app.

If you still see it, reply to this email: I will look into it myself.

Thank you for reporting it.

{{signature}}`],
    de: ['Das gemeldete Problem ist behoben', `Hallo,

Sie haben uns ein Problem in Easy Way gemeldet: {{titre}}.

Es ist in Version {{version}} behoben, ab sofort {{store}} verfügbar. Aktualisieren Sie einfach die App.

Wenn Sie es noch sehen, antworten Sie auf diese E-Mail: Ich sehe es mir selbst an.

Danke für Ihre Meldung.

{{signature}}`],
    es: ['El problema que nos indicó está corregido', `Hola:

Nos indicó un problema en Easy Way: {{titre}}.

Está corregido en la versión {{version}}, ya disponible {{store}}. Solo tiene que actualizar la app.

Si todavía lo ve, responda a este correo: lo reviso yo mismo.

Gracias por avisarnos.

{{signature}}`],
    it: ['Il problema che ci ha segnalato è risolto', `Buongiorno,

Ci ha segnalato un problema in Easy Way: {{titre}}.

È risolto nella versione {{version}}, disponibile {{store}}. Basta aggiornare l'app.

Se lo vede ancora, risponda a questa e-mail: controllo di persona.

Grazie per la segnalazione.

{{signature}}`],
    pt: ['O problema que nos indicou está corrigido', `Olá,

Indicou-nos um problema no Easy Way: {{titre}}.

Está corrigido na versão {{version}}, já disponível {{store}}. Basta atualizar a app.

Se ainda o vir, responda a este e-mail: eu próprio vou ver.

Obrigado por nos avisar.

{{signature}}`],
  },
};

// Le jour de fin en toutes lettres, à l'heure de Paris, avec la préposition de la langue (« vendredi », « on Friday »…).
// Le rappel part deux jours avant : le jour de la semaine suffit et reste vrai si l'envoi glisse d'un jour.
const DEVANT_LE_JOUR = { fr: '', en: 'on ', de: 'am ', es: 'el ', it: '' };
export function jourFin(iso, langue) {
  const jour = new Intl.DateTimeFormat(LOCALE_DATE[langue] ?? 'en-GB', { timeZone: 'Europe/Paris', weekday: 'long' }).format(new Date(iso));
  if (langue === 'pt') return `${/^(sábado|domingo)/.test(jour) ? 'no' : 'na'} ${jour}`;
  return `${DEVANT_LE_JOUR[langue] ?? 'on '}${jour}`;
}

// Échoue si une variable reste vide ou non remplacée : un e-mail à trous ne part jamais.
export function rendre(nom, langue, variables) {
  const modele = MODELES[nom]?.[langue];
  if (!modele) throw new Error(`Modèle inconnu : ${nom}`);
  const remplir = (texte) => texte.replace(/\{\{(\w+)\}\}/g, (_, cle) => {
    const v = variables[cle];
    if (v === undefined || v === null || v === '') throw new Error(`Variable manquante : ${cle}`);
    return String(v);
  });
  return { sujet: remplir(modele[0]), corps: remplir(modele[1]) };
}

// Le texte français de la bienvenue, montré sur la carte des Réglages : ouvrir le réglage vaut oui sur ce texte.
export function apercuBienvenue(signature) {
  return rendre('bienvenue', 'fr', { signature: signature || '(ta signature, à régler plus bas)' });
}

// Le même e-mail rendu en français, pour la relecture du fondateur (rien si l'e-mail est déjà en français).
export function rendreAvecTraduction(nom, langue, variablesDe) {
  const texte = rendre(nom, langue, variablesDe(langue));
  return langue === 'fr' ? texte : { ...texte, traduction_fr: rendre(nom, 'fr', variablesDe('fr')) };
}
