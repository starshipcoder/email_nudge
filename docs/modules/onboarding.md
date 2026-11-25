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
- 24/11 (Q-EW-70, réponse du fondateur : non) : pas de bouton « Se désabonner » des messageries. La décision du 22/11 tient : la désinscription passe par la fiche, ou par une réponse « STOP » que le relais Gmail lit.
- 24/11 : la carte « E-mail de bienvenue » des Réglages montre le texte français et dit qu'il n'a pas de lien de désinscription ; l'ouvrir vaut oui sur ce texte.
- 25/11 : l'arrêt du système de Firebase est vérifié aussi en production. Les fonctions déployées (`firebase functions:list`) sont `getStatus`, `getUser`, `onPaywallStateChanged`, `onRevenueCatWebhook`, `syncUser` et les deux récapitulatifs du fondateur : aucune passe qui écrit aux utilisateurs. Les journaux d'`onPaywallStateChanged` du 17 au 25/11 disent 12 fois « passed paywall - NO EMAIL (désactivé) » et ne montrent aucun envoi. Les journaux de Resend n'ont pas été lus (la clé reste au service d'Iris).

## La phrase de la politique de confidentialité

À coller dans la politique d'Easy Way, partie sur les données utilisées :

> **E-mails d'Easy Way.** Si vous donnez votre adresse e-mail dans l'app, nous pouvons vous écrire au sujet d'Easy Way, par exemple : un message de bienvenue, un rappel avant la fin de votre essai gratuit, une question si vous arrêtez votre abonnement, ou la nouvelle qu'un problème que vous avez signalé est corrigé. Chaque e-mail est relu et envoyé par le créateur de l'app ; nous ne vous écrivons pas plus d'une fois tous les trois jours, sauf pour vous dire qu'un problème signalé est corrigé, et nous ne parlons d'aucun autre produit que d'Easy Way. Pour ne plus en recevoir, répondez « STOP » à l'un d'eux : vous ne recevrez plus d'e-mail de notre part.

> **Emails from Easy Way.** If you give us your email address in the app, we may write to you about Easy Way, for example: a welcome message, a reminder before your free trial ends, a question if you cancel your subscription, or news that a problem you reported has been fixed. Each email is reviewed and sent by the app's creator; we write no more than once every three days, except to tell you that a problem you reported is fixed, and we never promote any product other than Easy Way. To stop receiving them, reply "STOP" to any of them: you will not receive any more emails from us.

Ce que la phrase promet et ce qui le tient : un e-mail relu et envoyé par le créateur (aucun envoi sans le clic, `mac/envoi.mjs`) ; trois jours entre deux e-mails sauf « Bug corrigé » (`ECART_HEURES`) ; un STOP désinscrit au passage suivant du relais Gmail (toutes les 15 minutes, `apps-script/Code.gs`), et un désinscrit ne reçoit plus rien (`envoyerAction`). Elle ne promet plus « tout de suite » ni « écrivez-nous », que rien dans le code ne tient. Si le fondateur dit oui au bouton « Se désabonner », la phrase s'enrichit de « ou cliquez sur Se désabonner dans votre messagerie ».

## Où est son code

- `mac/preparer.mjs` : `bienvenues` (qui la reçoit), `actionBienvenue` (l'action), et sa place dans `preparer`.
- `mac/modeles.mjs` : le modèle `bienvenue`, dans les six langues.
- `mac/suivi.mjs` : le réglage `bienvenue` dans `REGLAGES_PAR_DEFAUT`.
- `mac/web/app.js` : la carte « E-mail de bienvenue » des Réglages.
- `mac/parcours.mjs` : ce que la personne a dit à l'onboarding, montré dans son dossier.
- Tests : `mac/test/preparer.test.mjs`, `mac/test/envoi.test.mjs`, `mac/test/suivi.test.mjs`.
