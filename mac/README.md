# Iris CRM, la page du Mac pour suivre les utilisateurs d'Easy Way

La page de suivi des utilisateurs d'Easy Way, servie sur le Mac seulement (`http://localhost:4810`). Elle lit et écrit la base Firestore `email-nudge` par la connexion Google du Mac (`gcloud auth application-default login`) ; aucune clé dans ce dossier.

- `serveur.mjs` : le serveur local (127.0.0.1 seulement, hôte vérifié, écritures acceptées de la page seule).
- `suivi.mjs` : ce que la page sait faire (inscrits, fiche, prénom, réglages, journal).
- `firestore.mjs` : le client Firestore REST.
- `web/` : la page.
- `installer.sh` : la lance au démarrage du Mac (launchd).
- Tests : `node --test mac/test/suivi.test.mjs` (base en mémoire, sans réseau).

Spec : hephaistos, `notes/spec-crm-2026-11-21.md`. Au premier lancement, les envois sont coupés et le mode à blanc est mis.

## Campagnes

Onglet Campagnes : « Nouvelle campagne » propose le texte bêta de la spec, à modifier. Qui : essais, payants, ou payants, essais et actifs sur 30 jours ; une langue par campagne. Un nom qui commence par TEST ne vise que les utilisateurs de test ; sinon, jamais les tests ni les désinscrits. « Préparer » fige les membres (300 au plus), « Envoyer les prêtes » envoie par la porte jusqu'au plafond du jour, le reste au clic suivant. « A répondu » sur un membre ; les relances, 3 à 30 jours après l'envoi, arrivent dans Aujourd'hui et ne partent jamais à qui a répondu. Collections : `crm_campagnes`, `crm_membres` (`{campagne}__{cleUtilisateur}`), actions `campagne` et `campagne_relance`.

## Bugs corrigés

Onglet Bugs : les « Signaler un bug » des 90 derniers jours, lus dans Sentry (trousseau, compte athena, service sentry-readwrite ; lecture seule). Chaque retour est relié à son inscrit par l'identifiant RevenueCat, sinon par l'e-mail donné. Le fondateur note le titre public, la version qui corrige et la tâche BUG-EW. La passe lit les versions en vente au plus toutes les 6 h (App Store : API publique ; Play : trousseau, service play-compte-service, une modification ouverte puis supprimée, jamais validée) ; dès que la version est en vente sur le store de la personne, une action « Bug corrigé » arrive dans Aujourd'hui, une par personne et par version. L'écart de 72 h ne la retient pas. Collections : `crm_bugs/{numéro Sentry}`, `crm_versions/{ios|android}`.

## Langues et dossier

Les e-mails partent dans la langue de la personne, parmi celles de l'app (fr, en, de, es, it, pt), anglais sinon : son choix sur la fiche, sinon la langue de l'app, sinon le pays que Mixpanel connaît (Belgique, Suisse, Canada, Luxembourg : à choisir). Un e-mail qui n'est pas en français s'affiche avec sa traduction française ; corriger la traduction bloque l'envoi jusqu'à ce que le texte soit refait. Le dossier d'une personne (fiche et action) réunit son questionnaire de départ, son usage sur tout l'historique, les problèmes vus et son abonnement ; l'e-mail aux résiliés s'écrit depuis lui. L'index des identifiants (RevenueCat vers Mixpanel) est gardé dans `iris-index-ids.json` à côté de la base Mixpanel, refait quand la base change. `node mac/compter-langues.mjs` : les langues des inscrits, en comptes.
