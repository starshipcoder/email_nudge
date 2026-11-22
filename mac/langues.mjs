// Les langues des e-mails d'Iris CRM (tâche EW-51) : celles de l'app Easy Way (module_core/lib/l10n), anglais sinon.
export const LANGUES = ['fr', 'en', 'de', 'es', 'it', 'pt'];
export const NOMS_LANGUES = { fr: 'français', en: 'anglais', de: 'allemand', es: 'espagnol', it: 'italien', pt: 'portugais' };

// Le pays vu par Mixpanel (mp_country_code) donne la langue quand l'app ne l'a pas envoyée.
// Belgique, Suisse, Canada et Luxembourg parlent plusieurs langues : on les montre au fondateur, anglais en attendant.
export const LANGUE_DU_PAYS = {
  FR: 'fr', MC: 'fr', RE: 'fr', GP: 'fr', MQ: 'fr', GF: 'fr', YT: 'fr', NC: 'fr', PF: 'fr', MA: 'fr', TN: 'fr', DZ: 'fr', SN: 'fr', CI: 'fr',
  DE: 'de', AT: 'de', LI: 'de',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', UY: 'es', PY: 'es', BO: 'es', CR: 'es', DO: 'es', GT: 'es', PA: 'es',
  IT: 'it', SM: 'it',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
  GB: 'en', US: 'en', IE: 'en', AU: 'en', NZ: 'en', ZA: 'en',
};
export const PAYS_AMBIGUS = new Set(['BE', 'CH', 'CA', 'LU']);

const deLocale = (locale) => { const l = String(locale ?? '').toLowerCase().slice(0, 2); return LANGUES.includes(l) ? l : null; };
export const langueDe = (locale) => deLocale(locale) ?? 'en';
// Une campagne s'écrit en français ou en anglais : les autres langues lisent la version anglaise.
export const langueCampagne = (locale) => (langueDe(locale) === 'fr' ? 'fr' : 'en');

// La langue d'une personne et d'où elle vient : son choix sur la fiche, la langue de l'app, le pays, ou l'anglais.
export function langueDePersonne({ locale, pays, choix } = {}) {
  if (LANGUES.includes(choix)) return { langue: choix, source: 'choix' };
  const app = deLocale(locale);
  if (app) return { langue: app, source: 'app' };
  const p = String(pays ?? '').toUpperCase();
  if (LANGUE_DU_PAYS[p]) return { langue: LANGUE_DU_PAYS[p], source: 'pays', pays: p };
  if (PAYS_AMBIGUS.has(p)) return { langue: 'en', source: 'pays ambigu', pays: p };
  return { langue: 'en', source: 'défaut' };
}
export function direSource(l) {
  const nom = NOMS_LANGUES[l.langue];
  if (l.source === 'choix') return `${nom}, choisi à la main`;
  if (l.source === 'app') return `${nom}, d'après l'app`;
  if (l.source === 'pays') return `${nom}, d'après le pays (${l.pays})`;
  if (l.source === 'pays ambigu') return `${nom} en attendant : pays à plusieurs langues (${l.pays}), à choisir`;
  return `${nom}, par défaut (ni langue ni pays connus)`;
}

// La ligne WhatsApp à la fin de chaque e-mail (EW-53, fondateur, 22/11 : « pour que les gens puissent me contacter, et ça
// fait plus humain »). Plus de pied « répondez STOP » depuis le 22/11.
// Le fondateur, 22/11 : « WhatsApp : 06 52 50 55 00 » pour les Français, « WhatsApp: +33 6 52 50 55 00 (I am French) »
// pour les autres, la parenthèse dans leur langue (elle explique l'indicatif). Pas de lien.
export const WHATSAPP = {
  fr: (national) => `WhatsApp : ${national}`,
  en: (_, international) => `WhatsApp: ${international} (I am French)`,
  de: (_, international) => `WhatsApp: ${international} (ich bin Franzose)`,
  es: (_, international) => `WhatsApp: ${international} (soy francés)`,
  it: (_, international) => `WhatsApp: ${international} (sono francese)`,
  pt: (_, international) => `WhatsApp: ${international} (sou francês)`,
};

export const ARRETER = {
  APP_STORE: {
    fr: 'Réglages de l’iPhone > votre nom > Abonnements > Easy Way', en: 'iPhone Settings > your name > Subscriptions > Easy Way',
    de: 'iPhone-Einstellungen > Ihr Name > Abonnements > Easy Way', es: 'Ajustes del iPhone > su nombre > Suscripciones > Easy Way',
    it: 'Impostazioni dell’iPhone > il suo nome > Abbonamenti > Easy Way', pt: 'Ajustes do iPhone > seu nome > Assinaturas > Easy Way',
  },
  PLAY_STORE: {
    fr: 'Google Play > Paiements et abonnements > Abonnements > Easy Way', en: 'Google Play > Payments & subscriptions > Subscriptions > Easy Way',
    de: 'Google Play > Zahlungen und Abos > Abos > Easy Way', es: 'Google Play > Pagos y suscripciones > Suscripciones > Easy Way',
    it: 'Google Play > Pagamenti e abbonamenti > Abbonamenti > Easy Way', pt: 'Google Play > Pagamentos e assinaturas > Assinaturas > Easy Way',
  },
};
export const STORES = {
  // Avec la préposition de chaque langue, sauf en français et en anglais (« sur », « on » sont dans le modèle).
  ios: { fr: 'l’App Store', en: 'the App Store', de: 'im App Store', es: 'en el App Store', it: 'nell’App Store', pt: 'na App Store' },
  android: { fr: 'Google Play', en: 'Google Play', de: 'bei Google Play', es: 'en Google Play', it: 'su Google Play', pt: 'no Google Play' },
};
export const ET = { fr: ' et ', en: ' and ', de: ' und ', es: ' y ', it: ' e ', pt: ' e ' };
export const LOCALE_DATE = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };
