# Suivi Easy Way, la page du Mac

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
