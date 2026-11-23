# Iris CRM, la page du Mac pour suivre les utilisateurs d'Easy Way

La page de suivi des utilisateurs d'Easy Way, servie sur le Mac seulement (`http://localhost:4810`). Elle lit et écrit la base Firestore `email-nudge` par la connexion Google du Mac (`gcloud auth application-default login`) ; aucune clé dans ce dossier.

- `serveur.mjs` : le serveur local (127.0.0.1 seulement, hôte vérifié, écritures acceptées de la page seule).
- `suivi.mjs` : ce que la page sait faire (inscrits, fiche, prénom, réglages, journal).
- `firestore.mjs` : le client Firestore REST.
- `web/` : la page.
- `installer.sh` : la lance au démarrage du Mac (launchd).
- Tests : `node --test mac/test/suivi.test.mjs` (base en mémoire, sans réseau).

Spec : hephaistos, `notes/spec-crm-2026-11-21.md`. Au premier lancement, les envois sont coupés et le mode à blanc est mis.

## Garde-fous

Ce que le code tient aujourd'hui. Un agent qui code ici ne voit pas le cadrage d'Iris : il ne retire ni n'assouplit aucune de ces lignes sans l'accord du fondateur. Tout envoi à un utilisateur passe par une seule porte, `envoi.mjs`, `porteEnvoi().envoyerAction` ; rien d'autre n'appelle Resend pour écrire à quelqu'un.

**Rien ne part sans le clic du fondateur**
- Aucun envoi automatique : la passe de chaque heure crée des actions « prêtes » et n'envoie rien (`preparer.mjs`, `preparer`) ; seule la route `POST /api/envoyer` (`serveur.mjs`, `application`) ou « Envoyer les prêtes » d'une campagne (`campagnes.mjs`, `campagnes().envoyer`) appelle la porte.
- Un seul clic sur « Envoyer à la personne », puis 5 secondes pour annuler ; le texte affiché est enregistré avant s'il a changé (`web/app.js`, `uneAction`).
- Les écritures ne viennent que de la page : serveur sur 127.0.0.1, hôte vérifié, en-tête `x-crm` exigé (`serveur.mjs`, `hoteAutorise` et `ecritureAutorisee`).

**Coupe-circuit et mode à blanc**
- Au premier lancement, envois coupés et mode à blanc (`suivi.mjs`, `REGLAGES_PAR_DEFAUT` et `suivi().reglages`) ; sans réglages lus, la porte se comporte de même (`envoi.mjs`, `envoyerAction`).
- Envois coupés : la porte refuse tout, adresse de test comprise (`envoi.mjs`, `envoyerAction`, « envois coupés »).
- À blanc : l'envoi est noté dans `crm_envois` mais rien ne part, l'action reste prête et ne compte ni pour l'écart de 72 h ni pour une relance (`envoi.mjs`, `envoyerAction` ; `campagnes.mjs`, `suivreMembre`).

**L'adresse de test**
- Sans expéditeur, adresse de réponse et adresse de test valides, rien ne part (`envoi.mjs`, `envoyerAction`, « réglage manquant ») ; ces adresses sont vérifiées à l'enregistrement (`suivi.mjs`, `suivi().changerReglage`).
- « M'envoyer un essai » part à l'adresse de test seulement, sujet préfixé `[ESSAI]`, sans toucher l'action (`envoi.mjs`, `envoyerAction`, canal `test_moi`).
- Un utilisateur de test (`is_test_user` ou fiche `test`) reçoit à l'adresse de test, jamais à la sienne (`envoi.mjs`, `envoyerAction`).
- Une campagne dont le nom commence par TEST ne vise que les utilisateurs de test ; les autres ne les visent jamais (`campagnes.mjs`, `concernes`).

**Une fois par personne, et pas trop souvent**
- L'e-mail aux abonnés payés qui résilient : seulement un arrêt par la personne (pas une carte refusée ni un remboursement), préparé 24 h après l'arrêt, une seule fois par personne, même si elle revient puis repart (`preparer.mjs`, `candidats` et `preparer`) ; la porte refuse une seconde résiliation à qui en a déjà reçu une (`envoi.mjs`, `envoyerAction`, « déjà écrit à son départ »).
- Le même identifiant d'action ne se crée jamais deux fois, et un même départ vu deux fois (fiche Firebase et base Mixpanel) ne fait qu'une action en 7 jours (`preparer.mjs`, `preparer`).
- Le verrou `crm_envois/{action}` est créé avant l'appel à Resend : un second clic répond « déjà envoyé » ; Resend reçoit une clé d'idempotence (`envoi.mjs`, `envoyerAction` et `resendReel`).
- 72 h au moins entre deux e-mails à la même personne, sauf « Ton bug est corrigé » (`envoi.mjs`, `envoyerAction`, `ECART_HEURES`).
- 90 envois par jour au plus, heure de Paris, réglable de 1 à 90 (`envoi.mjs`, `PLAFOND_JOUR` ; `suivi.mjs`, `suivi().changerReglage`) ; 300 membres au plus par campagne (`campagnes.mjs`, `MAX_MEMBRES`).
- Une relance ne part jamais à qui a répondu, ni à qui a répondu par Gmail après l'envoi (`envoi.mjs`, `envoyerAction` ; `campagnes.mjs`, `campagnes().repondu`) ; elle part 3 jours au moins après l'envoi (`campagnes.mjs`, `verifierCampagne`).

**À qui on n'écrit plus**
- Désinscrit : jamais d'envoi, et on ne se réinscrit pas depuis la page (`envoi.mjs`, `envoyerAction` ; `suivi.mjs`, `suivi().desinscrire` ; `campagnes.mjs`, `concernes`).
- Adresse en rebond chez Resend : plus d'envoi (`envoi.mjs`, `envoyerAction` ; `livraison.mjs`, `relireLivraisons`).
- L'abonnement est relu chez RevenueCat juste avant l'envoi : une fin d'essai ne part pas à qui a payé ou annulé, ni moins de 12 h avant la fin ; une résiliation ne part pas à qui s'est réabonné ; une campagne aux payants ou aux essais ne part qu'à qui l'est encore (`envoi.mjs`, `lireAbonne` et `gardeFouType`).
- Une action passée son échéance expire au lieu de partir (`envoi.mjs`, `envoyerAction` ; `preparer.mjs`, `preparer`).

**Ce que dit le texte**
- Un point à vérifier (usage inconnu, base Mixpanel de plus de 36 h) bloque l'envoi jusqu'à « C'est vérifié » ou une correction du texte (`preparer.mjs`, `actionDe` ; `envoi.mjs`, `envoyerAction` ; `suivi.mjs`, `suivi().verifier`).
- Une campagne ne part pas sans son hypothèse, sa mesure, son seuil et sa date de lecture, sauf TEST (`campagnes.mjs`, `manqueHypothese`) ; seule la variable `{{signature}}` est acceptée (`campagnes.mjs`, `rendreTexte`).

**La langue**
- L'e-mail part dans la langue de la personne parmi fr, en, de, es, it, pt, anglais sinon : son choix sur la fiche, sinon la langue de l'app, sinon son pays (`langues.mjs`, `langueDePersonne`).
- Un e-mail qui n'est pas en français porte sa traduction française pour la relecture (`modeles.mjs`, `rendreAvecTraduction`) ; une traduction corrigée par la route serveur bloque l'envoi jusqu'à ce que le texte soit refait (`suivi.mjs`, `suivi().modifierTraduction` ; `envoi.mjs`, `envoyerAction`).
- Une campagne s'écrit en une langue, fr ou en, et ne vise que les personnes de cette langue (`campagnes.mjs`, `verifierCampagne` et `concernes`).

**Ce qui n'est jamais écrit dans un fichier ni affiché**
- Aucune clé dans le dépôt : Resend et RevenueCat se lisent dans le trousseau du Mac au moment de l'appel, jamais affichées (`envoi.mjs`, `cleTrousseau`) ; Firestore passe par la connexion Google du Mac (`firestore.mjs`).
- Les bases Mixpanel du Mac s'ouvrent en lecture seule (`serveur.mjs`, `passeDuMac`) ; seul l'index des identifiants, sans e-mail, est écrit à côté d'elles, hors git, lisible du seul compte (`dossier.mjs`, `indexIds`).
- Les notifications du téléphone et du Mac ne portent ni adresse ni nom : des nombres et des types d'action (`notif.mjs`, `texteActions` et `texteOrphelines` ; `serveur.mjs`, `texteNotification`).
- L'alerte des gestes d'Easy Way (EW-36), écrite chaque nuit par hephaistos dans `_workshop/alertes/easyway-gestes.json`, ne sonne que par sa ligne courte : des gestes et des nombres, jamais les rangs des personnes ni les replays, qu'Iris ne lit pas ; une clé sonne une fois, un fichier absent ou illisible ne fait rien (`notif.mjs`, `lireAlerteGestes`, `veilleurGestes` et `ligneGestesDHier`).
- Le journal note l'identifiant RevenueCat, pas l'adresse (`suivi.mjs`, `journaliser` ; `envoi.mjs`, `envoyerAction`).
- Les tests tournent sur une base en mémoire et des données inventées, sans réseau (`suivi.mjs`, `baseEnMemoire`).

## Campagnes

Onglet Campagnes : « Nouvelle campagne » propose le texte bêta de la spec, à modifier. Qui : essais, payants, ou payants, essais et actifs sur 30 jours ; une langue par campagne. Un nom qui commence par TEST ne vise que les utilisateurs de test ; sinon, jamais les tests ni les désinscrits. « Préparer » fige les membres (300 au plus), « Envoyer les prêtes » envoie par la porte jusqu'au plafond du jour, le reste au clic suivant. « A répondu » sur un membre ; les relances, 3 à 30 jours après l'envoi, arrivent dans Aujourd'hui et ne partent jamais à qui a répondu. Collections : `crm_campagnes`, `crm_membres` (`{campagne}__{cleUtilisateur}`), actions `campagne` et `campagne_relance`.

## Bugs corrigés

Onglet Bugs : les « Signaler un bug » des 90 derniers jours, lus dans Sentry (trousseau, compte athena, service sentry-readwrite ; lecture seule). Chaque retour est relié à son inscrit par l'identifiant RevenueCat, sinon par l'e-mail donné. Le fondateur note le titre public, la version qui corrige et la tâche BUG-EW. La passe lit les versions en vente au plus toutes les 6 h (App Store : API publique ; Play : trousseau, service play-compte-service, une modification ouverte puis supprimée, jamais validée) ; dès que la version est en vente sur le store de la personne, une action « Bug corrigé » arrive dans Aujourd'hui, une par personne et par version. L'écart de 72 h ne la retient pas. Collections : `crm_bugs/{numéro Sentry}`, `crm_versions/{ios|android}`.

## Langues et dossier

Les e-mails partent dans la langue de la personne, parmi celles de l'app (fr, en, de, es, it, pt), anglais sinon : son choix sur la fiche, sinon la langue de l'app, sinon le pays que Mixpanel connaît (Belgique, Suisse, Canada, Luxembourg : à choisir). Un e-mail qui n'est pas en français s'affiche avec sa traduction française, à relire sans la modifier (fondateur, 23/11) ; la route `op: 'traduction'` existe encore côté serveur et bloque alors l'envoi jusqu'à ce que le texte soit refait. Le dossier d'une personne (fiche et action) réunit son questionnaire de départ (la réponse que l'app envoie à `syncUser`, rangée dans `users` ; Mixpanel en secours ; la source est dite), son usage sur tout l'historique, les problèmes vus et son abonnement ; l'e-mail aux résiliés s'écrit depuis lui. L'index des identifiants (RevenueCat vers Mixpanel) est gardé dans `iris-index-ids.json` à côté de la base Mixpanel, refait quand la base change. `node mac/compter-langues.mjs` : les langues des inscrits, en comptes.
