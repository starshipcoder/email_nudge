// Les modèles d'e-mail (spec : hephaistos, notes/spec-crm-2026-11-21.md, § 3.7). Texte brut, vouvoiement, sans prénom.
const ARRETER = {
  APP_STORE: { fr: 'Réglages de l’iPhone > votre nom > Abonnements > Easy Way', en: 'iPhone Settings > your name > Subscriptions > Easy Way' },
  PLAY_STORE: { fr: 'Google Play > Paiements et abonnements > Abonnements > Easy Way', en: 'Google Play > Payments & subscriptions > Subscriptions > Easy Way' },
};

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
  },
  essai_j2_peu_usage: {
    fr: ['Votre essai Easy Way se termine le {{date_fin}}', `Bonjour,

Votre essai gratuit d'Easy Way se termine le {{date_fin}}. Ce jour-là, l'abonnement démarre et le premier paiement est prélevé par votre store.

Vous n'avez pas encore lancé de tournée. Si vous voulez essayer avant la fin : ajoutez les clients du jour, appuyez sur « Optimiser », puis « Démarrer ». Cela prend deux minutes.

Si l'app ne vous convient pas, vous pouvez arrêter avant le paiement : {{arreter}}.

Si quelque chose vous a bloqué, répondez à cet e-mail, un mot suffit.

{{signature}}`],
    en: ['Your Easy Way trial ends on {{date_fin}}', `Hello,

Your free Easy Way trial ends on {{date_fin}}. On that day the subscription starts and your store takes the first payment.

You have not started a route yet. To try before the end: add today's customers, tap "Optimize", then "Start". It takes two minutes.

If the app is not for you, you can stop before the payment: {{arreter}}.

If something got in your way, reply to this email. One word is enough.

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
  },
};

export const langueDe = (locale) => (String(locale ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');

export function arreter(store, langue) {
  const m = ARRETER[store];
  return m ? m[langue] : `${ARRETER.APP_STORE[langue]} ; ${ARRETER.PLAY_STORE[langue]}`;
}

export function dateFin(iso, langue) {
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' }).format(new Date(iso));
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
