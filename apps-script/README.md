# Gmail vers Iris CRM

Un script Google Apps Script, dans le compte Google du fondateur. Toutes les 15 minutes, il écrit dans la base `email-nudge` les e-mails échangés avec une adresse déjà inscrite (lecture seule de Gmail ; une adresse inconnue n'est jamais écrite). Un e-mail reçu marque « a répondu » sur la fiche (ce qui arrête les relances de campagne) ; une réponse « STOP » désinscrit.

## Installer (le fondateur, une fois)

1. script.google.com, « Nouveau projet », nom : Gmail vers Iris CRM.
2. Paramètres du projet : cocher « Afficher le fichier manifeste appsscript.json ».
3. Coller `appsscript.json` et `Code.gs` de ce dossier à la place des fichiers du projet.
4. Choisir la fonction `installer`, Exécuter, accepter les droits (Gmail en lecture, Firestore, déclencheurs). Google affiche « application non validée » : c'est ton propre script, « Paramètres avancés », « Accéder à ».
5. Journal d'exécution : « passe : N fil(s) lus, M message(s) écrits ».

La première passe remonte 90 jours ; ces réponses arrivent déjà lues (pas de « Réponses à lire » ni de notification pour l'historique). Si elle dépasse 4 minutes, elle reprend au passage suivant, à la même page. Ensuite, chaque passe lit depuis la précédente, avec une heure de recouvrement. « A répondu le » ne recule jamais. Les appels à Firestore sont comptés sur le projet Firebase (en-tête `x-goog-user-project`) : le compte Google doit avoir accès au projet contact-on-map-flutter.

## Arrêter

Déclencheurs (l'horloge à gauche), supprimer celui de `passe`. Rien n'est jamais envoyé ni supprimé dans Gmail.
