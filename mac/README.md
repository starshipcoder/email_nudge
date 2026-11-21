# Suivi Easy Way, la page du Mac

La page de suivi des utilisateurs d'Easy Way, servie sur le Mac seulement (`http://localhost:4810`). Elle lit et écrit la base Firestore `email-nudge` par la connexion Google du Mac (`gcloud auth application-default login`) ; aucune clé dans ce dossier.

- `serveur.mjs` : le serveur local (127.0.0.1 seulement, hôte vérifié, écritures acceptées de la page seule).
- `suivi.mjs` : ce que la page sait faire (inscrits, fiche, prénom, réglages, journal).
- `firestore.mjs` : le client Firestore REST.
- `web/` : la page.
- `installer.sh` : la lance au démarrage du Mac (launchd).
- Tests : `node --test mac/test/suivi.test.mjs` (base en mémoire, sans réseau).

Spec : hephaistos, `notes/spec-crm-2026-11-21.md`. Au premier lancement, les envois sont coupés et le mode à blanc est mis.
