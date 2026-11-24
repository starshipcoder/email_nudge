// Les modèles d'e-mail (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.7), dans les six langues de l'app (EW-51).
// Texte brut, vouvoiement, sans prénom. Les noms de boutons sont ceux de l'app (module_core/lib/l10n, button_OptimizeRoute
// et button_StartRoute).
import { ARRETER, LOCALE_DATE } from './langues.mjs';

export { langueDe } from './langues.mjs';

export const MODELES = {
  essai_j2_usage: {
    fr: ['Votre essai Easy Way se termine le {{date_fin}}', `Bonjour,

Votre essai gratuit d'Easy Way se termine le {{date_fin}}. Ce jour-là, l'abonnement démarre et le premier paiement est prélevé par votre store.

Vous avez déjà lancé {{n_tournees}} tournée(s) avec l'app. Si elle vous fait gagner du temps, vous n'avez rien à faire.

Si vous préférez arrêter avant le paiement : {{arreter}}.

Et si quelque chose vous gêne, répondez à cet e-mail. Je lis chaque réponse et je réponds moi-même.

{{signature}}`],
    en: ['Your Easy Way trial ends on {{date_fin}}', `Hello,

Your free Easy Way trial ends on {{date_fin}}. On that day the subscription starts and your store takes the first payment.

You have already started {{n_tournees}} route(s) with the app. If it saves you time, there is nothing to do.

If you would rather stop before the payment: {{arreter}}.

If something bothers you, just reply to this email. I read every reply and answer myself.

{{signature}}`],
    de: ['Ihre Easy Way Testphase endet am {{date_fin}}', `Hallo,

Ihre kostenlose Testphase von Easy Way endet am {{date_fin}}. An diesem Tag beginnt das Abo, und Ihr Store bucht die erste Zahlung ab.

Sie haben mit der App bereits {{n_tournees}} Route(n) gestartet. Wenn sie Ihnen Zeit spart, müssen Sie nichts tun.

Wenn Sie lieber vor der Zahlung kündigen möchten: {{arreter}}.

Und wenn Sie etwas stört, antworten Sie einfach auf diese E-Mail. Ich lese jede Antwort und antworte selbst.

{{signature}}`],
    es: ['Su prueba de Easy Way termina el {{date_fin}}', `Hola:

Su prueba gratuita de Easy Way termina el {{date_fin}}. Ese día empieza la suscripción y su tienda cobra el primer pago.

Ya ha iniciado {{n_tournees}} ruta(s) con la app. Si le ahorra tiempo, no tiene que hacer nada.

Si prefiere cancelar antes del pago: {{arreter}}.

Y si algo le molesta, responda a este correo. Leo cada respuesta y contesto yo mismo.

{{signature}}`],
    it: ['La sua prova di Easy Way termina il {{date_fin}}', `Buongiorno,

La sua prova gratuita di Easy Way termina il {{date_fin}}. Quel giorno inizia l'abbonamento e il suo store addebita il primo pagamento.

Ha già avviato {{n_tournees}} percorso/i con l'app. Se le fa risparmiare tempo, non deve fare nulla.

Se preferisce disdire prima del pagamento: {{arreter}}.

E se qualcosa non la convince, risponda a questa e-mail. Leggo ogni risposta e rispondo di persona.

{{signature}}`],
    pt: ['O seu teste do Easy Way termina a {{date_fin}}', `Olá,

O seu teste gratuito do Easy Way termina a {{date_fin}}. Nesse dia começa a assinatura e a sua loja cobra o primeiro pagamento.

Já iniciou {{n_tournees}} rota(s) com a app. Se ela lhe poupa tempo, não precisa de fazer nada.

Se preferir cancelar antes do pagamento: {{arreter}}.

E se algo o incomodar, responda a este e-mail. Leio cada resposta e respondo pessoalmente.

{{signature}}`],
  },
  essai_j2_peu_usage: {
    fr: ['Votre essai Easy Way se termine le {{date_fin}}', `Bonjour,

Votre essai gratuit d'Easy Way se termine le {{date_fin}}. Ce jour-là, l'abonnement démarre et le premier paiement est prélevé par votre store.

Vous n'avez pas encore lancé de tournée. Si vous voulez essayer avant la fin : ajoutez les clients du jour, appuyez sur « Optimiser la tournée », puis « Démarrer la tournée ». Cela prend deux minutes.

Si l'app ne vous convient pas, vous pouvez arrêter avant le paiement : {{arreter}}.

Si quelque chose vous a bloqué, répondez à cet e-mail, un mot suffit.

{{signature}}`],
    en: ['Your Easy Way trial ends on {{date_fin}}', `Hello,

Your free Easy Way trial ends on {{date_fin}}. On that day the subscription starts and your store takes the first payment.

You have not started a route yet. To try before the end: add today's customers, tap "Optimize route", then "Start the route". It takes two minutes.

If the app is not for you, you can stop before the payment: {{arreter}}.

If something got in your way, reply to this email. One word is enough.

{{signature}}`],
    de: ['Ihre Easy Way Testphase endet am {{date_fin}}', `Hallo,

Ihre kostenlose Testphase von Easy Way endet am {{date_fin}}. An diesem Tag beginnt das Abo, und Ihr Store bucht die erste Zahlung ab.

Sie haben noch keine Route gestartet. Wenn Sie es vor dem Ende ausprobieren möchten: Fügen Sie die Kunden des Tages hinzu, tippen Sie auf „Route optimieren“ und dann auf „Route starten“. Das dauert zwei Minuten.

Wenn die App nicht zu Ihnen passt, können Sie vor der Zahlung kündigen: {{arreter}}.

Wenn Sie etwas aufgehalten hat, antworten Sie auf diese E-Mail. Ein Wort genügt.

{{signature}}`],
    es: ['Su prueba de Easy Way termina el {{date_fin}}', `Hola:

Su prueba gratuita de Easy Way termina el {{date_fin}}. Ese día empieza la suscripción y su tienda cobra el primer pago.

Todavía no ha iniciado ninguna ruta. Si quiere probarla antes del final: añada los clientes del día, pulse «Optimizar ruta» y luego «Iniciar la ruta». Son dos minutos.

Si la app no le convence, puede cancelar antes del pago: {{arreter}}.

Si algo le ha frenado, responda a este correo. Basta una palabra.

{{signature}}`],
    it: ['La sua prova di Easy Way termina il {{date_fin}}', `Buongiorno,

La sua prova gratuita di Easy Way termina il {{date_fin}}. Quel giorno inizia l'abbonamento e il suo store addebita il primo pagamento.

Non ha ancora avviato un percorso. Se vuole provare prima della fine: aggiunga i clienti del giorno, tocchi «Ottimizza percorso» e poi «Avvia il percorso». Ci vogliono due minuti.

Se l'app non fa per lei, può disdire prima del pagamento: {{arreter}}.

Se qualcosa l'ha bloccata, risponda a questa e-mail. Basta una parola.

{{signature}}`],
    pt: ['O seu teste do Easy Way termina a {{date_fin}}', `Olá,

O seu teste gratuito do Easy Way termina a {{date_fin}}. Nesse dia começa a assinatura e a sua loja cobra o primeiro pagamento.

Ainda não iniciou nenhuma rota. Se quiser experimentar antes do fim: adicione os clientes do dia, toque em «Otimizar rota» e depois em «Iniciar a rota». Leva dois minutos.

Se a app não for para si, pode cancelar antes do pagamento: {{arreter}}.

Se alguma coisa o travou, responda a este e-mail. Basta uma palavra.

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
  // L'e-mail de bienvenue (INT-EW-9) : court, signé, une question à laquelle on répond en une ligne. Il n'est préparé
  // qu'une fois le réglage « E-mail de bienvenue » ouvert par le fondateur, après son oui sur ce texte.
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

export function arreter(store, langue) {
  const m = ARRETER[store];
  return m ? m[langue] : `${ARRETER.APP_STORE[langue]} ; ${ARRETER.PLAY_STORE[langue]}`;
}

export function dateFin(iso, langue) {
  return new Intl.DateTimeFormat(LOCALE_DATE[langue] ?? 'en-GB', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' }).format(new Date(iso));
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

// Le même e-mail rendu en français, pour la relecture du fondateur (rien si l'e-mail est déjà en français).
export function rendreAvecTraduction(nom, langue, variablesDe) {
  const texte = rendre(nom, langue, variablesDe(langue));
  return langue === 'fr' ? texte : { ...texte, traduction_fr: rendre(nom, 'fr', variablesDe('fr')) };
}
