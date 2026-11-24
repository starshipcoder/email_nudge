# Module Onboarding (côté Iris CRM)

## Ce que fait le module

Les premiers jours d'un nouvel utilisateur d'Easy Way, vus depuis Iris CRM, la page du Mac : ce qu'il a dit à l'onboarding de l'app (métier, besoins, source des contacts) et le premier e-mail qu'il peut recevoir, l'e-mail de bienvenue.

## Ses règles

- Rien ne part sans le clic du fondateur : la passe de chaque heure prépare l'e-mail de bienvenue dans « Aujourd'hui », la porte d'envoi (`mac/envoi.mjs`) applique ensuite tous les garde-fous d'Iris (coupe-circuit, mode à blanc, désinscrit, rebond, 72 h entre deux e-mails, plafond du jour).
- L'e-mail de bienvenue n'est préparé que si le réglage « E-mail de bienvenue » est ouvert. Il est fermé au premier lancement : l'ouvrir vaut oui du fondateur sur le texte.
- Une seule bienvenue par personne, seulement pour une adresse donnée dans les 72 h après l'inscription (ouvrir le réglage ne vise pas les anciens inscrits). Passé ces 72 h, l'action expire.
- Le texte : court, vouvoiement, signé du fondateur, une question à laquelle on répond en une ligne, dans la langue de la personne parmi fr, en, de, es, it, pt (traduction française pour relire).
- Aucun pied « répondez STOP » ni en-tête « Se désabonner » dans les e-mails (fondateur, 22/11). La désinscription passe par la fiche, ou par une réponse « STOP » que le relais Gmail lit.

## Ses décisions

- 22/11 : pas de STOP dans les e-mails ; l'en-tête List-Unsubscribe a été retiré (commit 2b88463).
- 24/11 (INT-EW-9) : le système d'e-mails automatiques de Firebase n'écrit plus aux utilisateurs. L'e-mail « démarrage rapide » (QuickStart) est coupé dans `functions/src/triggers/paywallTriggers.ts`, et la passe programmée `checkAndSendEmails` n'est plus exportée (retirée de Firebase le 21/11). Seuls les récapitulatifs au fondateur partent encore. L'e-mail de bienvenue d'Iris le remplace.
- En attente (question au fondateur) : remettre ou non le bouton « Se désabonner » des messageries, invisible dans le texte.

## La phrase de la politique de confidentialité

À coller dans la politique d'Easy Way, partie sur les données utilisées :

> **E-mails d'accompagnement.** Si vous donnez votre adresse e-mail dans l'app, nous pouvons vous écrire pour vous aider à utiliser Easy Way : un message de bienvenue, un rappel avant la fin de votre essai gratuit, ou une question si vous arrêtez votre abonnement. Ces e-mails sont envoyés un par un par le créateur de l'app, jamais plus d'un tous les trois jours, et nous ne les utilisons pas pour vous vendre d'autres produits. Pour ne plus en recevoir, répondez « STOP » à l'un d'eux ou écrivez-nous : nous arrêtons tout de suite.

> **Support emails.** If you give us your email address in the app, we may write to you to help you use Easy Way: a welcome message, a reminder before your free trial ends, or a question if you cancel your subscription. These emails are sent one by one by the app's creator, never more than one every three days, and we do not use them to sell you other products. To stop receiving them, reply "STOP" to any of them or write to us: we stop right away.

## Où est son code

- `mac/preparer.mjs` : `bienvenues` (qui la reçoit), `actionBienvenue` (l'action), et sa place dans `preparer`.
- `mac/modeles.mjs` : le modèle `bienvenue`, dans les six langues.
- `mac/suivi.mjs` : le réglage `bienvenue` dans `REGLAGES_PAR_DEFAUT`.
- `mac/web/app.js` : la carte « E-mail de bienvenue » des Réglages.
- `mac/parcours.mjs` : ce que la personne a dit à l'onboarding, montré dans son dossier.
- Tests : `mac/test/preparer.test.mjs`, `mac/test/envoi.test.mjs`, `mac/test/suivi.test.mjs`.
