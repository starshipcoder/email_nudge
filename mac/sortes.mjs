// INT-EW-94 : chaque sorte d'e-mail automatique se met « en essai » tant que le fondateur n'est pas satisfait du texte.
// En essai, elle se prépare dans Aujourd'hui sur de vraies personnes et « M'envoyer un essai » marche, mais la porte
// d'envoi refuse de l'envoyer à la personne, et elle ne fait pas sonner l'alerte du téléphone.
export const SORTES_AUTO = ['essai_j2', 'resiliation', 'essai_annule', 'bienvenue', 'onboarding', 'gros'];
export const EN_ESSAI_PAR_DEFAUT = ['bienvenue'];
export const enEssai = (reglages, type) => (Array.isArray(reglages?.en_essai) ? reglages.en_essai : EN_ESSAI_PAR_DEFAUT).includes(type);

// Ce qui peut sonner sur le téléphone : une sorte en essai ne part pas, elle ne sonne donc pas.
export const actionsQuiSonnent = (actions, reglages) => actions.filter((a) => !enEssai(reglages, a.type));
