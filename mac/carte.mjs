// La carte des e-mails d'Iris : quelle situation mène à quel e-mail, ou à aucun, et ce que reçoit une même personne au
// fil des jours. Chaque scénario est une suite datée, décrite une seule fois ; un petit constructeur en tire à la fois les
// faits que lit `candidats` et l'état RevenueCat de chaque instant. Le scénario passe par le vrai code : `preparer`,
// `preparerContacts`, `preparerAvis`, `bugs().preparer`, puis `porteEnvoi().envoyerAction`, sur une base en mémoire, avec
// un faux RevenueCat et un faux Resend. Aucune donnée réelle : adresses @exemple.fr, dossiers fictifs, signature « Harold ».
// Usage : node mac/carte.mjs (Markdown) ou node mac/carte.mjs --json (pour la page).
import { fileURLToPath } from 'node:url';
import { baseEnMemoire } from './suivi.mjs';
import { cleUtilisateur, lireAbonne, porteEnvoi } from './envoi.mjs';
import { faitsDesFiches, preparer } from './preparer.mjs';
import { preparerContacts } from './contacter.mjs';
import { preparerAvis, texteAvis } from './avis.mjs';
import { bugs } from './bugs.mjs';
import { ZONES, RAISONS, questionnaireDeFiche } from './dossier.mjs';
import { LANGUES, NOMS_LANGUES, direSource } from './langues.mjs';

const H = 3600000;
const JOUR = 24 * H;
const HEURE_PASSE = 8; // la passe du jour, à 8 h UTC (9 h à Paris en hiver)
const PREMIER_JOUR = -3; // avant J-3, l'histoire de la personne est posée, sans passe simulée
const SIGNATURE = 'Harold';
export const REGLAGES = { signature: SIGNATURE, envois_coupes: false, a_blanc: false, en_essai: [],
  expediteur: 'Harold d’Easy Way <bonjour@exemple.fr>', repondre_a: 'harold@exemple.fr', adresse_test: 'test@exemple.fr' };

export const LIMITES = [
  'Les scénarios partent de faits déjà mâchés (la forme que lit `candidats`), pas du SQL de la base Mixpanel : `lireFaits` est hors champ.',
  'Le moment d’envoi est simulé : le fondateur envoie chaque action dès qu’elle est prête, à la passe qui la prépare ; une action retenue est réessayée à chaque passe suivante. Il ne lève jamais un point « à vérifier ».',
  'Une passe par jour à 9 h (heure de Paris), plus une passe une heure après chaque fait du scénario. Avant J-3, l’histoire est posée sans passe.',
  'Le faux RevenueCat rend l’abonnement tiré des mêmes faits ; ce que le vrai RevenueCat répond dans les cas rares (période de grâce, remboursement) n’est pas vérifié.',
  'Pour « rien de préparé », la raison est celle de l’étiquette du scénario : le code n’en garde pas de trace.',
];
export const HORS_CARTE = [
  'Les campagnes du fondateur (cas 37) : hors champ, leur texte est écrit à la main.',
  'Le gratuit au plafond de 16 arrêts (cas 31) : aucun e-mail n’est construit.',
  'Le changement d’offre pendant un essai (cas 10) : `rc_product_change_event` est ignoré par Iris, rien à simuler sans inventer la réponse de RevenueCat.',
  'L’abonnement échu sans arrêt connu (cas 30) : rien n’est préparé, rien à montrer.',
  'Les rebonds sont posés sur la fiche par le scénario : la lecture des retours de Resend (`livraison.mjs`) n’est pas simulée.',
  'La ligne WhatsApp ajoutée à l’envoi n’est pas réglée ici.',
];

export const NOMS = { essai_j2: 'Rappel de fin d’essai', resiliation: 'Résiliation', essai_annule: 'Essai annulé', bienvenue: 'Bienvenue',
  onboarding: 'Onboarding abandonné', gros: 'Gros utilisateur', bug_corrige: 'Bug corrigé', demande_avis: 'Demande d’avis' };
const STORES_RC = { ios: 'APP_STORE', android: 'PLAY_STORE' };
const NOMS_STORES = { ios: 'App Store', android: 'Google Play' };
const PERIODES = { mensuel: 30 * JOUR, annuel: 365 * JOUR };

// Les scénarios. Chaque étape : j (jour), h (heure UTC, 09:00 par défaut), fait, et ses détails. `cas` : les numéros du
// bilan du 25/11 (hephaistos, notes/bilan-cas-emails-iris-2026-11-25.md). `attendu` : le résultat de chaque sorte d'e-mail,
// tel que la carte l'écrit ; `rien` : pourquoi rien n'est préparé, quand c'est attendu.
export const SCENARIOS = [
  { id: 'essai-ios-utilise', titre: 'Essai iOS utilisé, puis payé', cas: [2, 5, 8, 17],
    condition: 'S’inscrit et démarre un essai App Store de 7 jours le même matin ; 6 tournées ; l’essai se convertit.',
    dossier: { tournees: 6 },
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }, { j: 0, fait: 'essai', store: 'ios', jours: 7 }, { j: 7, fait: 'converti' }],
    attendu: { bienvenue: 'envoyé', essai_j2: 'envoyé' } },
  { id: 'essai-android-non-utilise', titre: 'Essai Android non utilisé', cas: [3, 6, 8],
    condition: 'Inscrit depuis 20 jours, essai Google Play de 14 jours, aucune tournée ; l’essai se convertit.',
    dossier: { tournees: 0 },
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai', store: 'android', jours: 14 }, { j: 14, fait: 'converti' }],
    attendu: { bienvenue: 'rien de préparé', essai_j2: 'envoyé' },
    rien: { bienvenue: 'inscrit depuis plus de 72 h : pas de bienvenue rattrapée' } },
  { id: 'annule-dans-l-heure', titre: 'Essai annulé dans l’heure', cas: [11, 45],
    condition: 'S’inscrit, démarre un essai et l’annule 30 minutes après.',
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }, { j: 0, h: '08:10', fait: 'essai' }, { j: 0, h: '08:40', fait: 'annule' }],
    attendu: { bienvenue: 'envoyé', essai_annule: 'envoyé (retenu avant : trop tôt)' },
    remarque: 'Le défaut F5 reste pour l’essai annulé (seul le rappel échappe aux 72 h) : la bienvenue partie le matin le retient trois jours.' },
  { id: 'annule-dans-l-heure-puis-repris', titre: 'Essai annulé dans l’heure, puis repris', cas: [11, 14],
    condition: 'Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai.',
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }, { j: 0, h: '08:10', fait: 'essai' }, { j: 0, h: '08:40', fait: 'annule' },
      { j: 0, h: '20:00', fait: 'reprend' }, { j: 7, h: '08:10', fait: 'converti' }],
    attendu: { bienvenue: 'envoyé', essai_annule: 'bloqué : a repris son essai ou payé', essai_j2: 'envoyé' },
    remarque: 'Corrigé le 25/11 : la carte avait montré qu’après une reprise le rappel n’était jamais préparé (la personne était prélevée sans rappel). Seule compte maintenant la dernière annulation, si aucune reprise ne la suit.' },
  { id: 'carte-refusee', titre: 'Essai fini par une carte refusée', cas: [18, 19],
    condition: 'Essai App Store, la carte est refusée à la fin de l’essai (raison BILLING_ERROR).',
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 7, fait: 'annule', raison: 'BILLING_ERROR' }],
    attendu: { essai_j2: 'envoyé', essai_annule: 'rien de préparé' },
    rien: { essai_annule: 'carte refusée : « vous avez annulé » serait faux' } },
  { id: 'essai-rembourse', titre: 'Essai remboursé par le support', cas: [16],
    condition: 'Essai App Store remboursé par le support le 2e jour (raison CUSTOMER_SUPPORT).',
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 2, fait: 'annule', raison: 'CUSTOMER_SUPPORT' }],
    attendu: { essai_annule: 'rien de préparé', essai_j2: 'rien de préparé' },
    rien: { essai_annule: 'remboursement : pas un choix de la personne', essai_j2: 'l’essai est arrêté' } },
  { id: 'essai-arrete-par-le-developpeur', titre: 'Essai arrêté par le développeur', cas: [22],
    condition: 'Essai arrêté le 2e jour par une décision du développeur (raison DEVELOPER_INITIATED).',
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 2, fait: 'annule', raison: 'DEVELOPER_INITIATED' }],
    attendu: { essai_annule: 'envoyé' },
    remarque: 'Écart avec le bilan (cas 22 : rien). La base Mixpanel écarte bien la raison DEVELOPER_INITIATED, mais la fiche Firebase passe par `faitsDesFiches`, qui n’écarte que la carte refusée et le remboursement : l’annulation y devient UNSUBSCRIBE et « Vous avez annulé votre essai » part. Suppose que RevenueCat pose `unsubscribe_detected_at` pour une décision du développeur, à vérifier.' },
  { id: 'essai-annule-sans-reponse', titre: 'Essai annulé le 3e jour, sans réponse au questionnaire', cas: [12],
    condition: 'Essai App Store annulé le 3e jour ; pas de réponse au questionnaire de l’app.',
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 3, h: '14:00', fait: 'annule' }],
    attendu: { essai_annule: 'envoyé' } },
  { id: 'essai-annule-avec-reponse', titre: 'Essai annulé avec une réponse au questionnaire', cas: [13],
    condition: 'Répond « trop cher » dans l’app puis annule son essai le 3e jour ; 6 tournées, beaucoup d’adresses non trouvées.',
    dossier: { tournees: 6, signaux: [{ nom: 'Event-geocoderError', n: 12, resume: 'adresses non trouvées' }] },
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' },
      { j: 3, h: '14:00', fait: 'questionnaire', raison: 'tooExpensive', texte: 'Je fais peu de tournées' }, { j: 3, h: '14:05', fait: 'annule' }],
    attendu: { essai_annule: 'envoyé' } },
  { id: 'annule-avant-la-passe', titre: 'Essai annulé le matin du rappel', cas: [48],
    condition: 'Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain.',
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 5, h: '07:00', fait: 'annule' }],
    attendu: { essai_j2: 'bloqué : déjà payé ou annulé', essai_annule: 'envoyé' } },
  { id: 'annule-puis-paie', titre: 'Essai annulé, puis payé deux jours après', cas: [15],
    condition: 'Annule son essai le 2e jour, puis achète l’abonnement mensuel le 4e jour.',
    etapes: [{ j: -20, fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 2, fait: 'annule' }, { j: 4, fait: 'achat' }],
    attendu: { essai_annule: 'envoyé' } },
  { id: 'resiliation-sans-dossier', titre: 'Résiliation, sans dossier lisible', cas: [23],
    condition: 'Payant mensuel qui arrête son abonnement ; personne introuvable dans la base Mixpanel.',
    dossier: null,
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }],
    attendu: { resiliation: 'envoyé' } },
  { id: 'resiliation-avec-reponse', titre: 'Résiliation, avec une réponse au questionnaire', cas: [24],
    condition: 'Payant qui répond « il manque des fonctions » dans l’app et arrête son abonnement ; 9 tournées.',
    dossier: { tournees: 9 },
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' },
      { j: 0, h: '10:00', fait: 'questionnaire', raison: 'missingFeatures', texte: 'Pas de tournée sur plusieurs jours' }, { j: 0, h: '10:05', fait: 'resilie' }],
    attendu: { resiliation: 'envoyé' } },
  { id: 'resiliation-probleme-vu', titre: 'Résiliation, un problème vu, sans réponse', cas: [25],
    condition: 'Payant qui arrête sans répondre ; ses imports de fichier ont échoué 3 fois, aucune tournée.',
    dossier: { tournees: 0, signaux: [{ nom: 'Event-ImportExcelError', n: 3, resume: 'import d’un fichier en échec' }],
      zones: [{ zone: 'Import de contacts', n: 30 }, { zone: 'Carte', n: 12 }],
      imports: [{ source: 'Excel', reussis: 0, contacts: 0, localises: 0, echecs: 3, annules: 0 }] },
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }],
    attendu: { resiliation: 'envoyé' } },
  { id: 'resiliation-jamais-en-tournee', titre: 'Résiliation, jamais parti en tournée', cas: [26],
    condition: 'Payant qui arrête sans répondre ; il a regardé la carte mais n’a jamais démarré de tournée.',
    dossier: { tournees: 0 },
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }],
    attendu: { resiliation: 'envoyé' } },
  { id: 'resiliation-donnees-en-retard', titre: 'Résiliation, base Mixpanel en retard', cas: [9, 46],
    condition: 'Payant qui arrête ; la base Mixpanel du Mac a plus d’un jour et demi de retard.',
    dossier: { tournees: 4, en_retard: true },
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }],
    attendu: { resiliation: 'expiré (retenu avant : à vérifier : on ne sait pas comment elle a utilisé l\'app (données Mixpanel absentes ou en retard) : relire le texte)' } },
  { id: 'revient-puis-repart', titre: 'Résilié qui revient, puis repart', cas: [27, 29],
    condition: 'Arrête puis reprend le même soir ; arrête de nouveau 15 jours plus tard ; revient au 45e jour et repart au 60e.',
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }, { j: 0, h: '18:00', fait: 'reprend' },
      { j: 10, fait: 'renouvelle' }, { j: 15, h: '10:00', fait: 'resilie' }, { j: 45, fait: 'achat' }, { j: 60, h: '10:00', fait: 'resilie' }],
    attendu: { resiliation: 'envoyé' } },
  { id: 'changement-offre', titre: 'Arrête le mensuel, prend l’annuel', cas: [28],
    condition: 'Arrête son abonnement mensuel, puis prend l’offre annuelle deux heures après.',
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }, { j: 0, h: '12:00', fait: 'achat', offre: 'annuel' }],
    attendu: { resiliation: 'bloqué : plus résilié' } },
  { id: 'payant-rembourse', titre: 'Payant remboursé', cas: [21],
    condition: 'Payant mensuel remboursé par le support (raison CUSTOMER_SUPPORT).',
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie', raison: 'CUSTOMER_SUPPORT' }],
    attendu: { resiliation: 'rien de préparé' }, rien: { resiliation: 'remboursement : seul un arrêt par la personne compte' } },
  { id: 'carte-refusee-renouvellement', titre: 'Payant, carte refusée au renouvellement', cas: [20],
    condition: 'Payant mensuel dont la carte est refusée au renouvellement (raison BILLING_ERROR).',
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 10, fait: 'resilie', raison: 'BILLING_ERROR' }],
    attendu: { resiliation: 'rien de préparé' }, rien: { resiliation: 'carte refusée : pas un arrêt par la personne (aucun e-mail prévu, trou R2)' } },
  { id: 'payant-arrete-par-le-developpeur', titre: 'Payant arrêté par le développeur', cas: [22],
    condition: 'Payant mensuel dont l’abonnement est arrêté par une décision du développeur (raison DEVELOPER_INITIATED).',
    etapes: [{ j: -60, fait: 'inscription' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie', raison: 'DEVELOPER_INITIATED' }],
    attendu: { resiliation: 'envoyé' },
    remarque: 'Écart avec l’arbre validé (arrêté par nous : aucun), comme pour l’essai arrêté par le développeur : la fiche Firebase ne dit pas qui a arrêté, `faitsDesFiches` en fait un arrêt par la personne. Suppose que RevenueCat pose `unsubscribe_detected_at` pour une décision du développeur, à vérifier.' },
  { id: 'desinscrit', titre: 'Désinscrit pendant son essai', cas: [39],
    condition: 'S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour.',
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 1, h: '10:00', fait: 'desinscrit' }, { j: 6, h: '10:00', fait: 'annule' }],
    attendu: { bienvenue: 'envoyé', essai_j2: 'bloqué : désinscrit', essai_annule: 'bloqué : désinscrit' } },
  { id: 'compte-de-test', titre: 'Compte de test du fondateur', cas: [36, 38],
    condition: 'Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app.',
    dossier: { tournees: 0, onboarding: { fini: false, abandonne: true } },
    etapes: [{ j: 0, h: '08:00', fait: 'inscription', test: true, onboarding_fini: false },
      { j: 1, h: '10:00', fait: 'bug_signale', texte: 'La carte reste vide après un import' },
      { j: 2, h: '10:00', fait: 'bug_note', titre: 'la carte restait vide après un import', version: '7.6.9' },
      { j: 3, h: '07:00', fait: 'en_vente', plateforme: 'ios', version: '7.6.9' },
      { j: 4, fait: 'essai' }, { j: 5, fait: 'annule' }, { j: 12, fait: 'ouvre_app' }],
    attendu: { bienvenue: 'rien de préparé', onboarding: 'envoyé à l’adresse de test', bug_corrige: 'envoyé à l’adresse de test',
      demande_avis: 'rien de préparé', essai_annule: 'rien de préparé' },
    rien: { bienvenue: 'compte de test', demande_avis: 'le bug corrigé n’est parti qu’à l’adresse de test', essai_annule: 'compte de test' } },
  { id: 'rebond', titre: 'Adresse en rebond', cas: [40],
    condition: 'S’inscrit, démarre un essai ; Resend signale un rebond le jour même ; un bug qu’il a signalé est corrigé.',
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 0, h: '12:00', fait: 'rebond' },
      { j: 1, h: '10:00', fait: 'bug_signale', texte: 'Impossible d’importer mon fichier' },
      { j: 2, h: '10:00', fait: 'bug_note', titre: 'l’import d’un fichier Excel échouait', version: '7.6.9' },
      { j: 3, h: '07:00', fait: 'en_vente', plateforme: 'ios', version: '7.6.9' }, { j: 7, fait: 'converti' }],
    attendu: { bienvenue: 'envoyé', essai_j2: 'bloqué : adresse en rebond', bug_corrige: 'bloqué : adresse en rebond' } },
  { id: 'bienvenue-rappel-annulation', titre: 'Bienvenue, rappel, puis annulation', cas: [2, 5, 45],
    condition: 'S’inscrit et démarre un essai ; reçoit la bienvenue puis le rappel ; annule le lendemain du rappel.',
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }, { j: 0, fait: 'essai' }, { j: 6, h: '10:00', fait: 'annule' }],
    attendu: { bienvenue: 'envoyé', essai_j2: 'envoyé', essai_annule: 'envoyé (retenu avant : trop tôt)' } },
  { id: 'mexique', titre: 'Personne au Mexique, fin d’essai un vendredi soir', cas: [5, 41],
    condition: 'App en espagnol, au Mexique ; l’essai finit vendredi à 23 h 30 UTC, déjà samedi 0 h 30 à Paris, encore vendredi au Mexique.',
    debut: '2026-12-04', dossier: { pays: 'MX' },
    etapes: [{ j: -20, fait: 'inscription', locale: 'es' }, { j: 0, h: '23:30', fait: 'essai' }, { j: 7, h: '23:30', fait: 'converti' }],
    attendu: { essai_j2: 'envoyé' } },
  { id: 'allemagne-bug-corrige', titre: 'Bug corrigé pour une personne en allemand', cas: [33, 41, 46],
    condition: 'App en allemand ; signale un bug, le fondateur le note corrigé en 7.6.9, la version sort sur l’App Store.',
    etapes: [{ j: -20, fait: 'inscription', locale: 'de' }, { j: 0, h: '10:00', fait: 'bug_signale', texte: 'Die Karte bleibt leer' },
      { j: 1, h: '10:00', fait: 'bug_note', titre: 'la carte restait vide après un import', version: '7.6.9' },
      { j: 2, h: '07:00', fait: 'en_vente', plateforme: 'ios', version: '7.6.9' }],
    jusqu_a: 34,
    attendu: { bug_corrige: 'expiré (retenu avant : à vérifier : le titre public est en français : le traduire dans le texte)' } },
  { id: 'italie-resiliation', titre: 'Résiliation en italien', cas: [23, 41],
    condition: 'App en italien ; payant qui arrête ; pas de dossier lisible.',
    dossier: null,
    etapes: [{ j: -60, fait: 'inscription', locale: 'it' }, { j: -20, fait: 'achat' }, { j: 0, h: '10:00', fait: 'resilie' }],
    attendu: { resiliation: 'envoyé' } },
  { id: 'bresil-pays', titre: 'Langue inconnue, pays Brésil', cas: [12, 42],
    condition: 'L’app n’a pas envoyé de langue ; la base Mixpanel le voit au Brésil ; annule son essai le 3e jour.',
    dossier: { pays: 'BR' },
    etapes: [{ j: -20, fait: 'inscription', locale: null }, { j: 0, fait: 'essai' }, { j: 3, h: '14:00', fait: 'annule' }],
    attendu: { essai_annule: 'envoyé' } },
  { id: 'belgique', titre: 'Langue inconnue, pays Belgique', cas: [43],
    condition: 'L’app n’a pas envoyé de langue ; la base Mixpanel le voit en Belgique ; essai App Store.',
    dossier: { pays: 'BE' },
    etapes: [{ j: -20, fait: 'inscription', locale: null }, { j: 0, fait: 'essai' }, { j: 7, fait: 'converti' }],
    attendu: { essai_j2: 'envoyé' } },
  { id: 'ni-langue-ni-pays', titre: 'Ni langue ni pays, store inconnu', cas: [7, 44],
    condition: 'Ni langue de l’app ni pays connus ; le store de l’essai n’est pas donné.',
    dossier: null,
    etapes: [{ j: -20, fait: 'inscription', locale: null }, { j: 0, fait: 'essai', store: null }, { j: 7, fait: 'converti' }],
    attendu: { essai_j2: 'envoyé' } },
  { id: 'onboarding-abandonne', titre: 'Onboarding abandonné', cas: [2, 4],
    condition: 'S’inscrit et laisse l’onboarding en plan ; ni essai ni abonnement.',
    dossier: { tournees: 0, onboarding: { fini: false, abandonne: true } },
    etapes: [{ j: 0, h: '08:00', fait: 'inscription', onboarding_fini: false }],
    attendu: { bienvenue: 'envoyé', onboarding: 'envoyé (retenu avant : trop tôt)' } },
  { id: 'gros-utilisateur', titre: 'Gros utilisateur', cas: [32],
    condition: '34 tournées, 13 jours actifs sur les 4 dernières semaines, un import Excel raté, deux optimisations ratées.',
    dossier: { tournees: 34, semaines: [2, 3, 3, 4, 3, 2, 4, 3, 3, 4, 3, 3], jours_actifs: 37, arrets_max: 22, optimisations_ratees: 2,
      imports: [{ source: 'Excel', reussis: 0, contacts: 0, localises: 0, echecs: 1, annules: 0 }] },
    etapes: [{ j: -90, fait: 'inscription', tournees: 34 }, { j: -100, fait: 'achat', offre: 'annuel' }, { j: 0, fait: 'ouvre_app' }],
    attendu: { gros: 'envoyé' } },
  { id: 'bug-corrige-puis-avis', titre: 'Bug corrigé, puis demande d’avis', cas: [33, 35],
    condition: 'Signale un bug ; le fondateur le note corrigé en 7.6.9 ; la version sort ; rouvre l’app 9 jours après l’e-mail.',
    etapes: [{ j: -30, fait: 'inscription' }, { j: 0, h: '10:00', fait: 'bug_signale', texte: 'La carte reste vide après un import' },
      { j: 1, h: '10:00', fait: 'bug_note', titre: 'la carte restait vide après un import', version: '7.6.9' },
      { j: 3, h: '07:00', fait: 'en_vente', plateforme: 'ios', version: '7.6.9' }, { j: 12, fait: 'ouvre_app' }],
    attendu: { bug_corrige: 'envoyé', demande_avis: 'envoyé' } },
  { id: 'bug-sans-inscrit', titre: 'Bug signalé sans être inscrit', cas: [34],
    condition: 'Signale un bug avec une adresse de contact, sans être inscrit ; le bug est corrigé.',
    etapes: [{ j: 0, h: '10:00', fait: 'bug_signale', texte: 'Les adresses ne se placent pas' },
      { j: 1, h: '10:00', fait: 'bug_note', titre: 'certaines adresses ne se plaçaient pas', version: '7.6.9' },
      { j: 3, h: '07:00', fait: 'en_vente', plateforme: 'ios', version: '7.6.9' }],
    attendu: { bug_corrige: 'rien de préparé' }, rien: { bug_corrige: 'personne inscrite à relier au retour' } },
  { id: 'sans-adresse', titre: 'Essai annulé sans adresse donnée', cas: [1],
    condition: 'N’a jamais donné d’adresse ; démarre un essai et l’annule le lendemain.',
    etapes: [{ j: 0, fait: 'essai' }, { j: 1, fait: 'annule' }],
    attendu: { essai_annule: 'rien de préparé' }, rien: { essai_annule: 'aucune adresse : le fondateur est seulement prévenu' } },
  { id: 'bienvenue-en-essai', titre: 'Bienvenue « en essai » (le réglage par défaut)', cas: [47],
    condition: 'S’inscrit ; la bienvenue est en essai, comme le veut le réglage par défaut.',
    reglages: { en_essai: ['bienvenue'] },
    etapes: [{ j: 0, h: '08:00', fait: 'inscription' }],
    attendu: { bienvenue: 'expiré (retenu avant : en essai : ne part pas aux utilisateurs)' } },
];

// ---------- L'arbre de décision : ce que lit le fondateur ----------

// Chaque branche a son libellé (`si`) ; chaque feuille, son résultat (`donne` : le nom de l'e-mail, ou null pour
// « aucun »), la sorte d'e-mail en jeu, le modèle ou brouillon au bout (`modele`) et les scénarios qui l'illustrent.
// Le test (test/carte.test.mjs) passe chaque scénario relié par le vrai code et vérifie le résultat de la feuille.
// `ecart` : la feuille dit ce que fait le code, différent de l'arbre validé par le fondateur le 25/11.
// Un scénario `{ id, un_seul: true }` : un seul e-mail de cette sorte part, malgré plusieurs départs.
export const ARBRE = [
  { si: 'Inscription avec une adresse', enfants: [
    { si: 'dans les 72 h', donne: 'Bienvenue', sorte: 'bienvenue', modele: 'bienvenue', scenarios: ['essai-ios-utilise'] }] },
  { si: 'Essai qui finit dans 2 jours', enfants: [
    { si: 'a déjà payé ou annulé', donne: null, sorte: 'essai_j2', scenarios: ['annule-avant-la-passe'] },
    { si: 'sinon', donne: 'Rappel de fin d’essai', sorte: 'essai_j2', modele: 'essai_j2', scenarios: ['essai-ios-utilise'] }] },
  { si: 'Essai arrêté', enfants: [
    { si: 'carte refusée ou remboursé', donne: null, sorte: 'essai_annule', scenarios: ['carte-refusee', 'essai-rembourse'] },
    { si: 'arrêté par nous', donne: 'Essai annulé', sorte: 'essai_annule', modele: 'ESSAI_COURT',
      scenarios: ['essai-arrete-par-le-developpeur'], ecart: 'voulu : aucun. La fiche Firebase ne dit pas qui a arrêté : le code y voit un arrêt par la personne.' },
    { si: 'a repris ou payé avant l’envoi', donne: null, sorte: 'essai_annule', scenarios: ['annule-dans-l-heure-puis-repris'] },
    { si: 'sinon (avec ou sans réponse au questionnaire)', donne: 'Essai annulé', sorte: 'essai_annule', modele: 'ESSAI_COURT',
      scenarios: ['essai-annule-sans-reponse', 'essai-annule-avec-reponse'] }] },
  { si: 'Abonnement payant arrêté', enfants: [
    { si: 'remboursé ou carte refusée', donne: null, sorte: 'resiliation', scenarios: ['payant-rembourse', 'carte-refusee-renouvellement'] },
    { si: 'arrêté par nous', donne: 'Résiliation (part de son dossier)', sorte: 'resiliation', variante: 'depuis le dossier', modele: 'T',
      scenarios: ['payant-arrete-par-le-developpeur'], ecart: 'voulu : aucun. La fiche Firebase ne dit pas qui a arrêté : le code y voit un arrêt par la personne.' },
    { si: 'a repris, ou a déjà reçu un e-mail de départ', donne: null, sorte: 'resiliation', scenarios: ['changement-offre', { id: 'revient-puis-repart', un_seul: true }] },
    { si: 'on lit son dossier (réponse, problème ou usage)', donne: 'Résiliation (part de son dossier)', sorte: 'resiliation', variante: 'depuis le dossier', modele: 'T',
      scenarios: ['resiliation-avec-reponse', 'resiliation-probleme-vu'] },
    { si: 'sinon', donne: 'Résiliation (simple)', sorte: 'resiliation', variante: 'modèle', modele: 'resiliation', scenarios: ['resiliation-sans-dossier'] }] },
  { si: 'Bug signalé, puis corrigé dans une version', donne: 'Bug corrigé', sorte: 'bug_corrige', modele: 'bug_corrige', scenarios: ['bug-corrige-puis-avis'], enfants: [
    { si: 'revenu dans l’app ensuite', donne: 'Demande d’avis', sorte: 'demande_avis', modele: 'demande_avis', scenarios: ['bug-corrige-puis-avis'] }] },
  { si: 'Contacts (onboarding, gros utilisateurs)', enfants: [
    { si: 'onboarding pas fini, ni essai ni abonnement', donne: 'Onboarding abandonné', sorte: 'onboarding', modele: 'onboarding', scenarios: ['onboarding-abandonne'] },
    { si: '12 jours actifs en 4 semaines, 10 tournées', donne: 'Gros utilisateur', sorte: 'gros', modele: 'gros', scenarios: ['gros-utilisateur'] }] },
];
// La ligne « Pour tous » : ce qui ne donne aucun e-mail, quelle que soit la branche, puis l'écart de 72 h.
export const POUR_TOUS = {
  aucun: [
    { si: 'désinscrit', donne: null, sorte: 'essai_annule', scenarios: ['desinscrit'] },
    { si: 'adresse en erreur', donne: null, sorte: 'essai_j2', scenarios: ['rebond'] },
    { si: 'sans adresse', donne: null, sorte: 'essai_annule', scenarios: ['sans-adresse'] },
    { si: 'compte de test', donne: null, sorte: 'essai_annule', scenarios: ['compte-de-test'] },
  ],
  ecart_72h: { texte: '72 h entre deux e-mails (sauf le rappel et le bug corrigé)', sorte: 'essai_annule', scenarios: ['annule-dans-l-heure'] },
};
export const NOTE_TEST = 'Un compte de test ne reçoit rien ; l’onboarding et le bug corrigé partent alors à l’adresse de test du fondateur.';

// Toutes les feuilles, la ligne « Pour tous » comprise.
export function feuilles(arbre = ARBRE, pourTous = POUR_TOUS) {
  const l = [];
  const voir = (n) => { if ('donne' in n) l.push(n); for (const e of n.enfants ?? []) voir(e); };
  arbre.forEach(voir);
  return [...l, ...pourTous.aucun];
}
const idDe = (x) => (typeof x === 'string' ? x : x.id);

// L'arbre en texte, les résultats alignés sur une colonne.
export function arbreTexte(arbre = ARBRE, pourTous = POUR_TOUS) {
  const lignes = [];
  const resultat = (n) => (n.donne ?? 'aucun') + (n.ecart ? ', écart : voulu aucun' : '');
  const poser = (n, avant, signe) => {
    lignes.push({ gauche: `${avant}${signe}${n.si}`, droite: 'donne' in n ? resultat(n) : null });
    const suite = avant + (signe === '├─ ' ? '│  ' : signe === '└─ ' ? '   ' : '');
    (n.enfants ?? []).forEach((e, i, t) => poser(e, suite, i === t.length - 1 ? '└─ ' : '├─ '));
  };
  arbre.forEach((n) => poser(n, '', ''));
  const largeur = Math.max(...lignes.filter((x) => x.droite).map((x) => x.gauche.length)) + 4;
  const sortie = lignes.map((x) => (x.droite ? `${x.gauche} ${'.'.repeat(largeur - x.gauche.length - 1)} ${x.droite}` : x.gauche));
  sortie.push(`Pour tous : ${pourTous.aucun.map((x) => x.si).join(', ')} → aucun`, `            ${pourTous.ecart_72h.texte}`);
  return sortie.join('\n');
}

// ---------- Le constructeur : un état cohérent à chaque instant, tiré des étapes ----------

const iso = (ms) => new Date(ms).toISOString();
const jourIso = (ms) => iso(ms).slice(0, 10);
const debutDuJour = (ms) => Math.floor(ms / JOUR) * JOUR;
const hm = (h) => { const [a, b] = String(h ?? '09:00').split(':').map(Number); return a * H + b * 60000; };
const debutDe = (sc) => new Date(`${sc.debut ?? '2026-12-01'}T00:00:00Z`).getTime();
export const adresseDe = (sc) => `${sc.id}@exemple.fr`;
const rcDe = (sc) => `rc_${sc.id}`;

export function etapesDatees(sc) {
  const debut = debutDe(sc);
  return sc.etapes.map((e, i) => ({ ...e, t: debut + e.j * JOUR + hm(e.h), i })).sort((a, b) => a.t - b.t || a.i - b.i);
}

// L'état à l'instant t : les événements RevenueCat (tels que la base Mixpanel les recevrait), les abonnements (tels que
// RevenueCat les rendrait), la fiche users, la fiche du CRM, les retours Sentry, les versions en vente, les ouvertures.
export function etatA(sc, t) {
  const rc = rcDe(sc);
  const e = { faits: [], subs: {}, user: null, fiche: {}, retours: [], versions: {}, ouvertures: [], produit: null, tx: null, n: 0 };
  const sub = () => e.subs[e.produit];
  const fait = (nom, x, plus = {}) => e.faits.push({ nom, temps: x.t, ids: [rc], transaction: e.tx, fin: sub()?.expires_date ?? null,
    type: sub()?.period_type === 'trial' ? 'TRIAL' : 'NORMAL', raison: null, store: sub()?.store ?? null, ...plus });
  const arret = (x, nom) => {
    const s = sub(); const raison = x.raison ?? 'UNSUBSCRIBE';
    fait(nom, x, { raison });
    s.unsubscribe_detected_at = iso(x.t);
    if (raison === 'BILLING_ERROR') s.billing_issues_detected_at = iso(x.t);
    if (raison === 'CUSTOMER_SUPPORT') { s.refunded_at = iso(x.t); s.expires_date = iso(x.t); }
    if (raison === 'DEVELOPER_INITIATED') s.expires_date = iso(x.t);
    if (e.user) e.user.churned_at = iso(x.t);
  };
  for (const x of etapesDatees(sc).filter((s) => s.t <= t)) {
    if (x.fait === 'inscription') {
      e.user = { id: adresseDe(sc), revenuecat_id: rc, locale: 'locale' in x ? x.locale : 'fr', created_at: iso(x.t), is_test_user: Boolean(x.test),
        onboarding_complete: x.onboarding_fini ?? true, routes_created: x.tournees ?? 0, last_action_at: null };
    } else if (x.fait === 'essai') {
      e.n += 1; e.tx = `${rc}-${e.n}`; e.produit = 'ew_mensuel';
      const store = 'store' in x ? x.store : 'ios';
      e.subs[e.produit] = { period_type: 'trial', purchase_date: iso(x.t), expires_date: iso(x.t + (x.jours ?? 7) * JOUR), store: STORES_RC[store] ?? null,
        unsubscribe_detected_at: null, billing_issues_detected_at: null, refunded_at: null };
      fait('rc_trial_started_event', x);
    } else if (x.fait === 'annule') arret(x, 'rc_trial_cancelled_event');
    else if (x.fait === 'resilie') arret(x, 'rc_cancellation_event');
    else if (x.fait === 'reprend') { sub().unsubscribe_detected_at = null; fait('rc_uncancellation_event', x); }
    else if (x.fait === 'converti') {
      const s = sub(); s.period_type = 'normal'; s.expires_date = iso(new Date(s.expires_date).getTime() + PERIODES.mensuel);
      fait('rc_trial_converted_event', x);
    } else if (x.fait === 'achat') {
      e.n += 1; e.tx = `${rc}-${e.n}`; const offre = x.offre ?? 'mensuel'; e.produit = `ew_${offre}`;
      e.subs[e.produit] = { period_type: 'normal', purchase_date: iso(x.t), expires_date: iso(x.t + PERIODES[offre]), store: 'APP_STORE',
        unsubscribe_detected_at: null, billing_issues_detected_at: null, refunded_at: null };
      fait('rc_initial_purchase_event', x);
    } else if (x.fait === 'renouvelle') {
      const s = sub(); s.expires_date = iso(new Date(s.expires_date).getTime() + PERIODES.mensuel); fait('rc_renewal_event', x);
    } else if (x.fait === 'questionnaire') {
      Object.assign(e.user, { churn_survey_reason: `_MainChurnReason.${x.raison}`, churn_survey_text: x.texte ?? '', churn_survey_answered_at: iso(x.t) });
    } else if (x.fait === 'desinscrit') e.fiche.desinscrit = true;
    else if (x.fait === 'rebond') e.fiche.adresse_invalide = true;
    else if (x.fait === 'bug_signale') {
      e.retours.push({ issue: { id: `9${String(e.retours.length + 1).padStart(3, '0')}`, firstSeen: iso(x.t), metadata: { message: x.texte } },
        event: { contexts: { feedback: { name: e.user ? rc : null, contact_email: adresseDe(sc), message: x.texte }, os: { name: 'iOS' } }, release: 'com.starshipcoder.contactonmap@7.6.8' } });
    } else if (x.fait === 'en_vente') e.versions[x.plateforme] = { version: x.version, mise_en_vente_le: iso(x.t) };
    else if (x.fait === 'ouvre_app') { e.ouvertures.push(x.t); if (e.user) e.user.last_action_at = iso(x.t); }
  }
  return e;
}

// Le dossier fictif de la personne, de la forme que rend `dossierDe` (dossier.mjs) ; null pour « sans dossier ».
export function dossierFictif(sc, e, t) {
  if (sc.dossier === null) return null;
  const o = sc.dossier ?? {};
  const n = o.tournees ?? 3;
  const zones = o.zones ?? [{ zone: 'Carte', n: 40 }, ...(n ? [{ zone: 'Tournée : sur la route', n: n * 3 }] : [])];
  const paiements = e.faits.filter((f) => ['rc_trial_converted_event', 'rc_initial_purchase_event', 'rc_renewal_event'].includes(f.nom));
  const essai = e.faits.find((f) => f.nom === 'rc_trial_started_event');
  const resilie = e.faits.filter((f) => f.nom === 'rc_cancellation_event').at(-1);
  return {
    rc: rcDe(sc), personne: `p_${sc.id}`, lie: true, pays: o.pays ?? null, questionnaire: questionnaireDeFiche(e.user),
    usage: { metier: 'commercial', premier_jour: jourIso(debutDe(sc) - 30 * JOUR), jours_actifs: o.jours_actifs ?? 8, dernier_jour: jourIso(t - JOUR),
      tournees: n, semaines: o.semaines ?? [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 2], signaux: o.signaux ?? [], zones,
      zones_jamais: ZONES.filter((z) => !zones.some((x) => x.zone === z)) },
    abonnement: { formule: paiements.length ? 'mensuel' : null, essai_le: essai ? jourIso(essai.temps) : null,
      premier_paiement: paiements[0] ? jourIso(paiements[0].temps) : null, paiements: paiements.length, resilie_le: resilie ? jourIso(resilie.temps) : null },
    parcours: { onboarding: { metier: 'commercial', besoins: [], source: null, fini: true, abandonne: false, ...(o.onboarding ?? {}) },
      imports: o.imports ?? [], tournees: { creees: n, optimisees: n, optimisations_ratees: o.optimisations_ratees ?? 0, demarrees: n, arrets_max: n ? (o.arrets_max ?? 12) : null } },
    a_jour: { base_jusqu_a: iso(debutDuJour(t)), en_retard: Boolean(o.en_retard) },
    calcule_le: jourIso(t),
  };
}

// Le faux Resend : il note ce qui lui est confié, et lève une erreur s'il est appelé hors d'un scénario en cours.
export function fauxResend() {
  let ouvert = false;
  const envois = [];
  return {
    envois,
    ouvrir() { ouvert = true; },
    fermer() { ouvert = false; },
    async envoyer(message, cle) {
      if (!ouvert) throw new Error('Faux Resend de la carte appelé hors d’un scénario : rien ne part.');
      if (!/@exemple\.fr>?$/.test(String(message?.to ?? ''))) throw new Error('Faux Resend de la carte : adresse hors @exemple.fr refusée.');
      envois.push({ message, cle });
      return { id: `faux-${envois.length}` };
    },
  };
}

// ---------- Le déroulé d'un scénario, par le vrai code ----------

// Le jour J et l'heure se lisent à l'heure de Paris, celle du fondateur.
const dateParis = (ms) => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(ms))}T00:00:00Z`).getTime();
const jourDe = (sc, t) => Math.round((dateParis(t) - debutDe(sc)) / JOUR);
const heureParis = (t) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit' }).format(new Date(t)).replace(':', ' h ').replace(' h 00', ' h');
export const quand = (sc, t) => `J${jourDe(sc, t)} ${heureParis(t)}`;
const courtQuand = (sc, t) => `J${jourDe(sc, t)}`;

const RAISONS_ARRET = { UNSUBSCRIBE: 'par la personne', BILLING_ERROR: 'carte refusée', CUSTOMER_SUPPORT: 'remboursé par le support', DEVELOPER_INITIATED: 'par le développeur' };
function direEtape(x) {
  const r = x.raison ?? 'UNSUBSCRIBE';
  switch (x.fait) {
    case 'inscription': return `${x.test ? 'compte de test, ' : ''}inscription avec une adresse (langue de l’app : ${'locale' in x ? (x.locale ?? 'aucune') : 'fr'}${x.onboarding_fini === false ? ', onboarding pas fini' : ''})`;
    case 'essai': return `essai démarré (${NOMS_STORES['store' in x ? x.store : 'ios'] ?? 'store inconnu'}, ${x.jours ?? 7} jours)`;
    case 'annule': return r === 'UNSUBSCRIBE' ? 'annule son essai' : `essai arrêté : ${RAISONS_ARRET[r]} (${r})`;
    case 'resilie': return r === 'UNSUBSCRIBE' ? 'arrête son abonnement' : `abonnement arrêté : ${RAISONS_ARRET[r]} (${r})`;
    case 'reprend': return 'reprend (annulation retirée)';
    case 'converti': return 'fin de l’essai : premier paiement';
    case 'achat': return `achète l’offre ${x.offre ?? 'mensuel'}le`;
    case 'renouvelle': return 'renouvellement payé';
    case 'questionnaire': return `répond au questionnaire de l’app : ${RAISONS[x.raison] ?? x.raison}${x.texte ? `, « ${x.texte} »` : ''}`;
    case 'desinscrit': return 'se désinscrit';
    case 'rebond': return 'Resend signale un rebond sur son adresse';
    case 'bug_signale': return `signale un bug (« ${x.texte} »)`;
    case 'bug_note': return `le fondateur note le bug corrigé en ${x.version} (« ${x.titre} »)`;
    case 'en_vente': return `la version ${x.version} est en vente sur ${NOMS_STORES[x.plateforme]}`;
    case 'ouvre_app': return 'rouvre l’app';
    default: return x.fait;
  }
}

const variante = (a) => {
  if (a.type === 'resiliation') return a.variante === 'dossier' ? 'depuis le dossier' : 'modèle';
  return null;
};
const nomAction = (a) => `${NOMS[a.type] ?? a.type}${variante(a) ? `, ${variante(a)}` : ''}`;

// Un déroulé complet ; langue : le choix de langue posé sur la fiche (null : la langue que le code choisit).
export async function derouler(sc, { langue = null } = {}) {
  const rc = rcDe(sc);
  const cle = cleUtilisateur(adresseDe(sc));
  const db = baseEnMemoire({ crm_reglages: [{ id: 'general', ...REGLAGES, ...(sc.reglages ?? {}) }] });
  const resend = fauxResend();
  let t = 0;
  const etape = () => etatA(sc, t);
  const dossierPour = (r) => (r === rc ? dossierFictif(sc, etape(), t) : null);
  const tournees = (r) => (r === rc && sc.dossier !== null ? (sc.dossier?.tournees ?? 3) : null);
  const lireRevenueCat = async (r) => ({ subscriber: { subscriptions: r === rc ? structuredClone(etape().subs) : {} } });
  const porte = porteEnvoi({ db, envoyerResend: resend.envoyer, lireRevenueCat, maintenant: () => new Date(t) });
  const bg = bugs(db, { maintenant: () => new Date(t), lireRetours: async () => etape().retours, lireVersions: async () => etape().versions,
    paysPour: async () => dossierPour(rc)?.pays ?? null });
  const revenuDepuis = async (r, ms) => (r === rc ? etape().ouvertures.some((o) => o > ms && o <= t) : null);

  const chronologie = [];
  const suivi = new Map(); // action → { prepare, evenements: [], retenus: [] }
  const note = (texte, id = null) => chronologie.push({ quand: quand(sc, t), texte, ...(id ? { action_id: id } : {}) });
  const prevenus = new Set();

  const etapes = etapesDatees(sc);
  const fin = debutDe(sc) + (sc.jusqu_a ?? Math.max(...sc.etapes.map((e) => e.j)) + 10) * JOUR + 23 * H;
  const premier = debutDe(sc) + Math.max(PREMIER_JOUR, Math.min(...sc.etapes.map((e) => e.j))) * JOUR;
  const instants = [];
  for (let d = premier + HEURE_PASSE * H; d <= fin; d += JOUR) instants.push({ t: d, passe: true });
  for (const x of etapes) {
    instants.push({ t: x.t, etape: x });
    if (x.t >= premier) instants.push({ t: x.t + H, passe: true });
  }
  instants.sort((a, b) => a.t - b.t || (a.etape ? 0 : 1) - (b.etape ? 0 : 1));
  const vus = new Set();

  resend.ouvrir();
  try {
    if (langue) await db.ecrire('crm_fiches', cle, { user_id: adresseDe(sc), langue });
    for (const i of instants) {
      t = i.t;
      if (i.etape) {
        note(direEtape(i.etape));
        if (i.etape.fait === 'bug_note') {
          const id = etape().retours.at(-1)?.issue.id;
          await syncBase(db, sc, etape(), t, cle);
          await bg.noter(id, { titre: i.etape.titre, version_corrigee: i.etape.version });
        }
        continue;
      }
      if (t < premier || vus.has(t)) continue;
      vus.add(t);
      await passe();
    }
  } finally { resend.fermer(); }

  async function passe() {
    const e = etape();
    await syncBase(db, sc, e, t, cle);
    const avant = new Map((await db.lister('crm_actions')).map((a) => [a.id, a.statut]));
    // La base Mixpanel du Mac reçoit chaque nuit la veille ; la fiche Firebase dit une annulation en temps réel (EW-55).
    const visibles = e.faits.filter((f) => debutDuJour(f.temps) < debutDuJour(t) && f.temps >= t - 30 * JOUR);
    const parFiche = await faitsDesFiches(await db.lister('users'), lireRevenueCat, new Date(t));
    const r = await preparer({ db, faits: [...visibles, ...parFiche], tournees, maintenant: new Date(t), dossierPour });
    await preparerContacts({ db, dossierPour, maintenant: new Date(t) });
    await preparerAvis({ db, revenuDepuis, maintenant: new Date(t) });
    await bg.preparer();
    for (const s of r.sans_inscrit ?? []) {
      if (prevenus.has(s.id)) continue;
      prevenus.add(s.id);
      note(`annulation ${s.essai ? 'd’un essai ' : ''}d’une personne sans adresse : le fondateur est prévenu sur son téléphone, sans nom ni adresse`);
    }
    for (const a of await db.lister('crm_actions')) {
      if (!avant.has(a.id)) {
        suivi.set(a.id, { evenements: [`préparé ${courtQuand(sc, t)}`], retenus: [] });
        note(`${nomAction(a)} préparé${a.a_verifier ? ` ; à vérifier : ${a.a_verifier}` : ''}`, a.id);
      } else if (avant.get(a.id) !== 'expiree' && a.statut === 'expiree') {
        suivi.get(a.id).evenements.push(`expiré ${courtQuand(sc, t)}`);
        note(`${nomAction(a)} expiré`, a.id);
      }
    }
    // Le fondateur envoie chaque action prête, dans l'ordre où elles ont été préparées.
    for (const a of await db.lister('crm_actions')) {
      if (a.statut !== 'prete') continue;
      const res = await porte.envoyerAction(a.id);
      const apres = await db.lire('crm_actions', a.id);
      const s = suivi.get(a.id);
      if (res.statut === 'envoye') {
        const test = (await db.lire('crm_envois', a.id))?.destinataire_reel === 'adresse_test';
        s.envoye = true; s.test = test;
        s.evenements.push(`envoyé ${courtQuand(sc, t)}${test ? ' à l’adresse de test' : ''}`);
        note(`${nomAction(a)} envoyé${test ? ' à l’adresse de test' : ''}`, a.id);
      } else if (apres.statut === 'bloquee') {
        s.evenements.push(`bloqué ${courtQuand(sc, t)} : ${res.raison}`);
        note(`${nomAction(a)} bloqué à l’envoi : ${res.raison}`, a.id);
      } else if (apres.statut === 'expiree') {
        s.evenements.push(`expiré ${courtQuand(sc, t)} (${res.raison})`);
        note(`${nomAction(a)} expiré à l’envoi (${res.raison})`, a.id);
      } else if (s.retenus.at(-1) !== res.raison) {
        s.retenus.push(res.raison);
        s.evenements.push(`retenu ${courtQuand(sc, t)} (${res.raison})`);
        note(`${nomAction(a)} retenu : ${res.raison}`, a.id);
      }
    }
  }

  const actions = await db.lister('crm_actions');
  return { chronologie, actions, suivi, envois: resend.envois, bugs: await db.lister('crm_bugs') };
}

// La fiche users et la fiche du CRM, telles qu'elles sont à l'instant t (l'abonnement de la fiche suit RevenueCat).
async function syncBase(db, sc, e, t, cle) {
  if (e.user) {
    const ab = lireAbonne({ subscriber: { subscriptions: e.subs } }, new Date(t));
    await db.ecrire('users', e.user.id, { ...e.user, trial_active: ab.essai_en_cours, subscription_active: ab.payant_actif });
  }
  if (Object.keys(e.fiche).length) await db.ecrire('crm_fiches', cle, { user_id: adresseDe(sc), ...e.fiche });
}

// Le même e-mail dans une autre langue : celui du déroulé dans cette langue. Une demande d'avis n'y existe que si le bug
// corrigé est parti, ce qu'un point à vérifier empêche hors du français : elle est alors rendue par `texteAvis` seul.
function dansLaLangue(a, lg, actions, bugsVus) {
  const x = actions.get(a.id);
  if (x) return { sujet: x.sujet, corps: x.corps };
  if (a.type !== 'demande_avis') return null;
  const b = bugsVus.find((y) => y.id === a.bug) ?? {};
  return texteAvis({ langue: lg, version: b.version_corrigee, plateforme: b.plateforme ?? null, signature: SIGNATURE });
}

const resultatDe = (a, s) => {
  const avant = s?.retenus?.length ? ` (retenu avant : ${s.retenus.join(', ')})` : '';
  if (a.statut === 'envoyee') return `envoyé${s?.test ? ' à l’adresse de test' : ''}${avant}`;
  if (a.statut === 'bloquee') return `bloqué : ${a.raison}`;
  if (a.statut === 'expiree') return `expiré${avant}`;
  return `prêt, ${s?.retenus?.length ? `retenu : ${s.retenus.at(-1)}` : 'pas envoyé'}`;
};

// La carte entière : chaque scénario déroulé, puis rendu dans les six langues pour la page.
export async function carte() {
  const scenarios = [];
  for (const sc of SCENARIOS) {
    const base = await derouler(sc);
    const parLangue = {};
    for (const lg of LANGUES) parLangue[lg] = new Map((await derouler(sc, { langue: lg })).actions.map((a) => [a.id, a]));
    const emails = base.actions.map((a) => ({
      id: a.id, type: a.type, nom: nomAction(a), variante: variante(a), resultat: resultatDe(a, base.suivi.get(a.id)), deroule: base.suivi.get(a.id)?.evenements ?? [],
      langue: a.langue, langue_source: direSource({ langue: a.langue, source: a.langue_source, pays: a.pays }),
      ...(a.a_verifier ? { a_verifier: a.a_verifier } : {}),
      texte: { sujet: a.sujet, corps: a.corps }, texte_fr: a.traduction_fr ? { sujet: a.traduction_fr.sujet, corps: a.traduction_fr.corps } : { sujet: a.sujet, corps: a.corps },
      langues: Object.fromEntries(LANGUES.map((lg) => [lg, dansLaLangue(a, lg, parLangue[lg], base.bugs)])),
    }));
    const resultats = {};
    for (const m of emails) resultats[m.type] = resultats[m.type] ? `${resultats[m.type]} ; ${m.resultat}` : m.resultat;
    for (const [type, v] of Object.entries(sc.attendu)) if (v === 'rien de préparé' && !resultats[type]) resultats[type] = 'rien de préparé';
    scenarios.push({ id: sc.id, titre: sc.titre, cas: sc.cas, condition: sc.condition, attendu: sc.attendu, rien: sc.rien ?? {}, ...(sc.remarque ? { remarque: sc.remarque } : {}),
      debut: debutDe(sc), resultats, chronologie: base.chronologie, emails });
  }
  const tableau = [];
  for (const s of scenarios) {
    // Les e-mails dans l'ordre où ils ont été préparés, puis ce qui n'a rien donné.
    const types = [...new Set([...s.emails.map((m) => m.type), ...Object.keys(s.resultats)])];
    for (const type of types) {
      const liste = s.emails.filter((m) => m.type === type);
      if (!liste.length) {
        tableau.push({ scenario: s.id, situation: s.titre, condition: s.condition, type, email: 'aucun', pourquoi: `${NOMS[type]} : rien de préparé (${s.rien[type] ?? 'raison non dite'})` });
        continue;
      }
      for (const m of liste) {
        const parti = m.resultat.startsWith('envoyé');
        tableau.push({ scenario: s.id, situation: s.titre, condition: s.condition, type, action_id: m.id,
          email: parti ? `${m.nom} (${m.langue})` : 'aucun', pourquoi: `${parti ? '' : `${m.nom} : `}${m.deroule.join(', ')}` });
      }
    }
  }
  const cas = [...new Set(SCENARIOS.flatMap((s) => s.cas))].sort((a, b) => a - b);
  // L'arbre pour la page : chaque feuille e-mail porte le texte en français du premier scénario qui l'illustre.
  const emailDe = (f) => {
    for (const x of f.scenarios) {
      const m = scenarios.find((s) => s.id === idDe(x))?.emails.find((e) => e.type === f.sorte && e.resultat.startsWith('envoyé')
        && (!f.variante || e.variante === f.variante));
      if (m) return { scenario: idDe(x), sujet: m.texte_fr.sujet, corps: m.texte_fr.corps };
    }
    return null;
  };
  const habiller = (n) => ({ si: n.si, ...('donne' in n ? { donne: n.donne, scenarios: n.scenarios.map(idDe), ...(n.ecart ? { ecart: n.ecart } : {}),
    ...(n.donne ? { email: emailDe(n) } : {}) } : {}), ...(n.enfants ? { enfants: n.enfants.map(habiller) } : {}) });
  return { arbre: ARBRE.map(habiller), pour_tous: { aucun: POUR_TOUS.aucun.map(habiller), ecart_72h: POUR_TOUS.ecart_72h.texte, note_test: NOTE_TEST },
    arbre_texte: arbreTexte(), limites: LIMITES, hors_carte: HORS_CARTE, langues: LANGUES, noms_langues: NOMS_LANGUES, cas_couverts: cas,
    cas_non_couverts: Array.from({ length: 48 }, (_, k) => k + 1).filter((k) => !cas.includes(k)), tableau, scenarios };
}

// ---------- Le Markdown ----------

const cellule = (t) => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const cite = (texte) => texte.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
const dateLongue = (ms) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));

export function markdown(c) {
  const l = [];
  l.push('# La carte des e-mails d’Iris', '');
  l.push('Simulation : rien ne part d’ici. Fichier produit par `node mac/carte.mjs` ; ne pas l’écrire à la main.', '');
  l.push('## L’arbre', '', '```', c.arbre_texte, '```', '');
  const ecarts = c.arbre.flatMap((n) => (n.enfants ?? []).filter((f) => f.ecart).map((f) => `« ${n.si} », « ${f.si} » : ${f.ecart}`));
  l.push(...ecarts.map((x) => `- Écart avec l’arbre validé, ${x}`), `- ${c.pour_tous.note_test}`, '');
  l.push('## Les e-mails, en français', '');
  const vus = new Set();
  for (const f of feuilles(c.arbre, c.pour_tous)) {
    if (!f.email || f.ecart || vus.has(f.donne)) continue;
    vus.add(f.donne);
    l.push(`### ${f.donne}`, '', `Exemple : scénario « ${c.scenarios.find((s) => s.id === f.email.scenario).titre} ».`, '');
    l.push(cite(`**Objet :** ${f.email.sujet}\n\n${f.email.corps}`), '');
  }
  l.push('## Les scénarios (vérification)', '');
  l.push('### Limites', '', ...c.limites.map((x) => `- ${x}`), '');
  l.push('### Hors carte', '', ...c.hors_carte.map((x) => `- ${x}`), '');
  l.push(`${c.scenarios.length} scénarios. Cas du bilan du 25/11 couverts : ${c.cas_couverts.length} sur 48 (${c.cas_couverts.join(', ')}). Non couverts : ${c.cas_non_couverts.join(', ')}.`, '');
  l.push('### Le tableau', '', '| Situation | Condition | E-mail ou aucun | Pourquoi |', '|---|---|---|---|');
  for (const r of c.tableau) l.push(`| ${cellule(r.situation)} | ${cellule(r.condition)} | ${cellule(r.email)} | ${cellule(r.pourquoi)} |`);
  l.push('');
  for (const s of c.scenarios) {
    l.push(`### ${s.titre}`, '');
    l.push(`Cas du bilan : ${s.cas.join(', ')}. ${s.condition} J0 : ${dateLongue(s.debut)}. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.`, '');
    if (s.remarque) l.push(`**À relire :** ${s.remarque}`, '');
    l.push(`Résultat : ${Object.entries(s.resultats).map(([type, v]) => `${NOMS[type]}, ${v}`).join(' ; ')}.`, '');
    l.push(...s.chronologie.map((x) => `- ${x.quand} : ${x.texte}`), '');
    for (const m of s.emails) {
      l.push(`#### ${m.nom} : ${m.resultat}`, '');
      l.push(`Langue de la personne : ${m.langue_source}.${m.a_verifier ? ` À vérifier : ${m.a_verifier}.` : ''}`, '');
      l.push(cite(`**Objet :** ${m.texte_fr.sujet}\n\n${m.texte_fr.corps}`), '');
    }
  }
  return `${l.join('\n').replace(/\n+$/, '')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const c = await carte();
  process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify(c)}\n` : markdown(c));
}
