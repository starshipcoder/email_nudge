# La carte des e-mails d’Iris

Simulation : rien ne part d’ici. Fichier produit par `node mac/carte.mjs` ; ne pas l’écrire à la main.

## L’arbre

```
Inscription avec une adresse
└─ dans les 72 h .................................. Bienvenue
Essai qui finit dans 2 jours
├─ a déjà payé ou annulé .......................... aucun
└─ sinon .......................................... Rappel de fin d’essai
Essai arrêté
├─ carte refusée ou remboursé ..................... aucun
├─ arrêté par nous ................................ Essai annulé (une ligne), écart : voulu aucun
├─ a repris ou payé avant l’envoi ................. aucun
├─ a répondu au questionnaire de l’app
│  ├─ trop cher, livreur sur iPhone ............... Essai annulé : Boxy
│  ├─ trop cher, sinon ............................ Essai annulé : la version gratuite
│  ├─ les fonctions payantes ne lui servent pas ... Essai annulé : la version gratuite
│  ├─ plus besoin de l’app ........................ Essai annulé : son activité a changé ?
│  ├─ il manque des fonctions ..................... Essai annulé : laquelle ?
│  ├─ trop de bugs ................................ Essai annulé : quel problème ?
│  ├─ trop lente .................................. Essai annulé : à quel moment ?
│  ├─ difficile à utiliser ........................ Essai annulé : où était-ce compliqué ?
│  └─ autre raison ................................ Essai annulé (une ligne)
└─ sinon .......................................... Essai annulé (une ligne)
Abonnement payant arrêté
├─ remboursé ou carte refusée ..................... aucun
├─ arrêté par nous ................................ Résiliation (une ligne), écart : voulu aucun
├─ a repris, ou a déjà reçu un e-mail de départ ... aucun
├─ a répondu au questionnaire de l’app ............ Résiliation (mêmes réponses que l’essai annulé)
└─ sinon .......................................... Résiliation (une ligne)
Bug signalé, puis corrigé dans une version ........ Bug corrigé
└─ revenu dans l’app ensuite ...................... Demande d’avis
Contacts (onboarding, gros utilisateurs)
├─ onboarding pas fini, ni essai ni abonnement .... Onboarding abandonné
└─ 12 jours actifs en 4 semaines, 10 tournées ..... Gros utilisateur
Pour tous : désinscrit, adresse en erreur, sans adresse, compte de test → aucun
            72 h entre deux e-mails (sauf le rappel et le bug corrigé)
```

- Écart avec l’arbre validé, « Essai arrêté », « arrêté par nous » : voulu : aucun. La fiche Firebase ne dit pas qui a arrêté : le code y voit un arrêt par la personne.
- Écart avec l’arbre validé, « Abonnement payant arrêté », « arrêté par nous » : voulu : aucun. La fiche Firebase ne dit pas qui a arrêté : le code y voit un arrêt par la personne.
- Un compte de test ne reçoit rien ; l’onboarding et le bug corrigé partent alors à l’adresse de test du fondateur.

## Les e-mails, en français

### Bienvenue

Exemple : scénario « Essai iOS utilisé, puis payé ».

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

### Rappel de fin d’essai

Exemple : scénario « Essai iOS utilisé, puis payé ».

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Essai annulé : Boxy

Exemple : scénario « Essai annulé : trop cher, livreur sur iPhone ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Notre app Boxy, faite pour les livreurs, fait les mêmes tournées pour 7,99 € par mois :
> https://apps.apple.com/app/id6756269385
>
> Harold

### Essai annulé : la version gratuite

Exemple : scénario « Essai annulé : trop cher, pas livreur ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> La version gratuite reste à vous, jusqu'à 16 arrêts par tournée.
>
> Harold

### Essai annulé : son activité a changé ?

Exemple : scénario « Essai annulé : plus besoin ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> C'est votre activité qui a changé, ou l'app qui ne collait pas à vos tournées ?
>
> Harold

### Essai annulé : laquelle ?

Exemple : scénario « Essai annulé : il manque des fonctions ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Quelle fonction vous a le plus manqué ?
>
> Harold

### Essai annulé : quel problème ?

Exemple : scénario « Essai annulé : trop de bugs ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Quel problème avez-vous rencontré ? Je le corrige et je vous préviens quand c'est fait.
>
> Harold

### Essai annulé : à quel moment ?

Exemple : scénario « Essai annulé : trop lente ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> À quel moment l'app était-elle lente ? Je regarde moi-même.
>
> Harold

### Essai annulé : où était-ce compliqué ?

Exemple : scénario « Essai annulé : difficile à utiliser ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> À quel moment l'app vous a-t-elle paru compliquée ?
>
> Harold

### Essai annulé (une ligne)

Exemple : scénario « Essai annulé : autre raison ».

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Résiliation (mêmes réponses que l’essai annulé)

Exemple : scénario « Résiliation, avec une réponse au questionnaire ».

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Quelle fonction vous a le plus manqué ?
>
> Harold

### Résiliation (une ligne)

Exemple : scénario « Résiliation, sans dossier lisible ».

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Bug corrigé

Exemple : scénario « Bug corrigé, puis demande d’avis ».

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous m'avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> C'est corrigé dans la version 7.6.9, disponible sur l’App Store : il suffit de mettre l'app à jour. Merci de me l'avoir signalé. S'il revient, répondez-moi.
>
> Harold

### Demande d’avis

Exemple : scénario « Bug corrigé, puis demande d’avis ».

> **Objet :** Votre avis sur Easy Way
>
> Bonjour,
>
> Content que la version 7.6.9 ait réglé votre problème. Si Easy Way vous aide au quotidien, un avis sur l’App Store m'aiderait beaucoup :
> https://apps.apple.com/app/id6443783383?action=write-review
>
> Et si quelque chose vous gêne encore, répondez-moi.
>
> Harold

### Onboarding abandonné

Exemple : scénario « Onboarding abandonné ».

> **Objet :** Easy Way : quelque chose vous a bloqué ?
>
> Bonjour,
>
> Vous avez commencé à configurer Easy Way sans aller jusqu'au bout. Qu'est-ce qui vous a arrêté ? Je vous aide à finir.
>
> Harold

### Gros utilisateur

Exemple : scénario « Gros utilisateur ».

> **Objet :** Comment ça se passe avec Easy Way ?
>
> Bonjour,
>
> Vous faites beaucoup de tournées avec Easy Way. Comment ça se passe, de votre côté ?
>
> Harold

## Les scénarios (vérification)

### Limites

- Les scénarios partent de faits déjà mâchés (la forme que lit `candidats`), pas du SQL de la base Mixpanel : `lireFaits` est hors champ.
- Le moment d’envoi est simulé : le fondateur envoie chaque action dès qu’elle est prête, à la passe qui la prépare ; une action retenue est réessayée à chaque passe suivante. Il ne lève jamais un point « à vérifier ».
- Une passe par jour à 9 h (heure de Paris), plus une passe une heure après chaque fait du scénario. Avant J-3, l’histoire est posée sans passe.
- Le faux RevenueCat rend l’abonnement tiré des mêmes faits ; ce que le vrai RevenueCat répond dans les cas rares (période de grâce, remboursement) n’est pas vérifié.
- Pour « rien de préparé », la raison est celle de l’étiquette du scénario : le code n’en garde pas de trace.

### Hors carte

- Les campagnes du fondateur (cas 37) : hors champ, leur texte est écrit à la main.
- Le gratuit au plafond de 16 arrêts (cas 31) : aucun e-mail n’est construit.
- Le changement d’offre pendant un essai (cas 10) : `rc_product_change_event` est ignoré par Iris, rien à simuler sans inventer la réponse de RevenueCat.
- L’abonnement échu sans arrêt connu (cas 30) : rien n’est préparé, rien à montrer.
- Les rebonds sont posés sur la fiche par le scénario : la lecture des retours de Resend (`livraison.mjs`) n’est pas simulée.
- La ligne WhatsApp ajoutée à l’envoi n’est pas réglée ici.

47 scénarios. Cas du bilan du 25/11 couverts : 44 sur 48 (1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48). Non couverts : 10, 30, 31, 37.

### Le tableau

| Situation | Condition | E-mail ou aucun | Pourquoi |
|---|---|---|---|
| Essai iOS utilisé, puis payé | S’inscrit et démarre un essai App Store de 7 jours le même matin ; 6 tournées ; l’essai se convertit. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Essai iOS utilisé, puis payé | S’inscrit et démarre un essai App Store de 7 jours le même matin ; 6 tournées ; l’essai se convertit. | Rappel de fin d’essai (fr) | préparé J5, envoyé J5 |
| Essai Android non utilisé | Inscrit depuis 20 jours, essai Google Play de 14 jours, aucune tournée ; l’essai se convertit. | Rappel de fin d’essai (fr) | préparé J12, envoyé J12 |
| Essai Android non utilisé | Inscrit depuis 20 jours, essai Google Play de 14 jours, aucune tournée ; l’essai se convertit. | aucun | Bienvenue : rien de préparé (inscrit depuis plus de 72 h : pas de bienvenue rattrapée) |
| Essai annulé dans l’heure | S’inscrit, démarre un essai et l’annule 30 minutes après. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Essai annulé dans l’heure | S’inscrit, démarre un essai et l’annule 30 minutes après. | Essai annulé (fr) | préparé J0, retenu J0 (trop tôt), envoyé J3 |
| Essai annulé dans l’heure, puis repris | Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Essai annulé dans l’heure, puis repris | Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. | aucun | Essai annulé : préparé J0, retenu J0 (trop tôt), bloqué J0 : a repris son essai ou payé |
| Essai annulé dans l’heure, puis repris | Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. | Rappel de fin d’essai (fr) | préparé J5, envoyé J5 |
| Essai fini par une carte refusée | Essai App Store, la carte est refusée à la fin de l’essai (raison BILLING_ERROR). | Rappel de fin d’essai (fr) | préparé J5, envoyé J5 |
| Essai fini par une carte refusée | Essai App Store, la carte est refusée à la fin de l’essai (raison BILLING_ERROR). | aucun | Essai annulé : rien de préparé (carte refusée : « vous avez annulé » serait faux) |
| Essai remboursé par le support | Essai App Store remboursé par le support le 2e jour (raison CUSTOMER_SUPPORT). | aucun | Essai annulé : rien de préparé (remboursement : pas un choix de la personne) |
| Essai remboursé par le support | Essai App Store remboursé par le support le 2e jour (raison CUSTOMER_SUPPORT). | aucun | Rappel de fin d’essai : rien de préparé (l’essai est arrêté) |
| Essai arrêté par le développeur | Essai arrêté le 2e jour par une décision du développeur (raison DEVELOPER_INITIATED). | Essai annulé (fr) | préparé J2, envoyé J2 |
| Essai annulé le 3e jour, sans réponse au questionnaire | Essai App Store annulé le 3e jour ; pas de réponse au questionnaire de l’app. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé avec une réponse au questionnaire | Répond « trop cher » dans l’app puis annule son essai le 3e jour ; 6 tournées, beaucoup d’adresses non trouvées. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé le matin du rappel | Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain. | aucun | Rappel de fin d’essai : préparé J5, bloqué J5 : déjà payé ou annulé |
| Essai annulé le matin du rappel | Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain. | Essai annulé (fr) | préparé J5, envoyé J5 |
| Essai annulé, puis payé deux jours après | Annule son essai le 2e jour, puis achète l’abonnement mensuel le 4e jour. | Essai annulé (fr) | préparé J2, envoyé J2 |
| Résiliation, sans dossier lisible | Payant mensuel qui arrête son abonnement ; personne introuvable dans la base Mixpanel. | Résiliation, modèle (fr) | préparé J2, envoyé J2 |
| Résiliation, avec une réponse au questionnaire | Payant qui répond « il manque des fonctions » dans l’app et arrête son abonnement ; 9 tournées. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résiliation, un problème vu, sans réponse | Payant qui arrête sans répondre ; ses imports de fichier ont échoué 3 fois, aucune tournée. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résiliation, jamais parti en tournée | Payant qui arrête sans répondre ; il a regardé la carte mais n’a jamais démarré de tournée. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résiliation, base Mixpanel en retard | Payant qui arrête ; la base Mixpanel du Mac a plus d’un jour et demi de retard. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résilié qui revient, puis repart | Arrête puis reprend le même soir ; arrête de nouveau 15 jours plus tard ; revient au 45e jour et repart au 60e. | Résiliation, depuis le dossier (fr) | préparé J17, envoyé J17 |
| Arrête le mensuel, prend l’annuel | Arrête son abonnement mensuel, puis prend l’offre annuelle deux heures après. | aucun | Résiliation, depuis le dossier : préparé J2, bloqué J2 : plus résilié |
| Payant remboursé | Payant mensuel remboursé par le support (raison CUSTOMER_SUPPORT). | aucun | Résiliation : rien de préparé (remboursement : seul un arrêt par la personne compte) |
| Payant, carte refusée au renouvellement | Payant mensuel dont la carte est refusée au renouvellement (raison BILLING_ERROR). | aucun | Résiliation : rien de préparé (carte refusée : pas un arrêt par la personne (aucun e-mail prévu, trou R2)) |
| Payant arrêté par le développeur | Payant mensuel dont l’abonnement est arrêté par une décision du développeur (raison DEVELOPER_INITIATED). | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Désinscrit pendant son essai | S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Désinscrit pendant son essai | S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. | aucun | Rappel de fin d’essai : préparé J5, bloqué J5 : désinscrit |
| Désinscrit pendant son essai | S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. | aucun | Essai annulé : préparé J6, bloqué J6 : désinscrit |
| Compte de test du fondateur | Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app. | Onboarding abandonné (fr) | préparé J1, envoyé J1 à l’adresse de test |
| Compte de test du fondateur | Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app. | Bug corrigé (fr) | préparé J3, envoyé J3 à l’adresse de test |
| Compte de test du fondateur | Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app. | aucun | Bienvenue : rien de préparé (compte de test) |
| Compte de test du fondateur | Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app. | aucun | Demande d’avis : rien de préparé (le bug corrigé n’est parti qu’à l’adresse de test) |
| Compte de test du fondateur | Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app. | aucun | Essai annulé : rien de préparé (compte de test) |
| Adresse en rebond | S’inscrit, démarre un essai ; Resend signale un rebond le jour même ; un bug qu’il a signalé est corrigé. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Adresse en rebond | S’inscrit, démarre un essai ; Resend signale un rebond le jour même ; un bug qu’il a signalé est corrigé. | aucun | Bug corrigé : préparé J3, bloqué J3 : adresse en rebond |
| Adresse en rebond | S’inscrit, démarre un essai ; Resend signale un rebond le jour même ; un bug qu’il a signalé est corrigé. | aucun | Rappel de fin d’essai : préparé J5, bloqué J5 : adresse en rebond |
| Bienvenue, rappel, puis annulation | S’inscrit et démarre un essai ; reçoit la bienvenue puis le rappel ; annule le lendemain du rappel. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Bienvenue, rappel, puis annulation | S’inscrit et démarre un essai ; reçoit la bienvenue puis le rappel ; annule le lendemain du rappel. | Rappel de fin d’essai (fr) | préparé J5, envoyé J5 |
| Bienvenue, rappel, puis annulation | S’inscrit et démarre un essai ; reçoit la bienvenue puis le rappel ; annule le lendemain du rappel. | Essai annulé (fr) | préparé J6, retenu J6 (trop tôt), envoyé J8 |
| Personne au Mexique, fin d’essai un vendredi soir | App en espagnol, au Mexique ; l’essai finit vendredi à 23 h 30 UTC, déjà samedi 0 h 30 à Paris, encore vendredi au Mexique. | Rappel de fin d’essai (es) | préparé J6, envoyé J6 |
| Bug corrigé pour une personne en allemand | App en allemand ; signale un bug, le fondateur le note corrigé en 7.6.9, la version sort sur l’App Store. | aucun | Bug corrigé : préparé J2, retenu J2 (à vérifier : le titre public est en français : le traduire dans le texte), expiré J33 |
| Résiliation en italien | App en italien ; payant qui arrête ; pas de dossier lisible. | Résiliation, modèle (it) | préparé J2, envoyé J2 |
| Langue inconnue, pays Brésil | L’app n’a pas envoyé de langue ; la base Mixpanel le voit au Brésil ; annule son essai le 3e jour. | Essai annulé (pt) | préparé J3, envoyé J3 |
| Langue inconnue, pays Belgique | L’app n’a pas envoyé de langue ; la base Mixpanel le voit en Belgique ; essai App Store. | Rappel de fin d’essai (en) | préparé J5, envoyé J5 |
| Ni langue ni pays, store inconnu | Ni langue de l’app ni pays connus ; le store de l’essai n’est pas donné. | Rappel de fin d’essai (en) | préparé J5, envoyé J5 |
| Onboarding abandonné | S’inscrit et laisse l’onboarding en plan ; ni essai ni abonnement. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Onboarding abandonné | S’inscrit et laisse l’onboarding en plan ; ni essai ni abonnement. | Onboarding abandonné (fr) | préparé J1, retenu J1 (trop tôt), envoyé J3 |
| Gros utilisateur | 34 tournées, 13 jours actifs sur les 4 dernières semaines, un import Excel raté, deux optimisations ratées. | Gros utilisateur (fr) | préparé J0, envoyé J0 |
| Bug corrigé, puis demande d’avis | Signale un bug ; le fondateur le note corrigé en 7.6.9 ; la version sort ; rouvre l’app 9 jours après l’e-mail. | Bug corrigé (fr) | préparé J3, envoyé J3 |
| Bug corrigé, puis demande d’avis | Signale un bug ; le fondateur le note corrigé en 7.6.9 ; la version sort ; rouvre l’app 9 jours après l’e-mail. | Demande d’avis (fr) | préparé J12, envoyé J12 |
| Bug signalé sans être inscrit | Signale un bug avec une adresse de contact, sans être inscrit ; le bug est corrigé. | aucun | Bug corrigé : rien de préparé (personne inscrite à relier au retour) |
| Essai annulé sans adresse donnée | N’a jamais donné d’adresse ; démarre un essai et l’annule le lendemain. | aucun | Essai annulé : rien de préparé (aucune adresse : le fondateur est seulement prévenu) |
| Bienvenue « en essai » (le réglage par défaut) | S’inscrit ; la bienvenue est en essai, comme le veut le réglage par défaut. | aucun | Bienvenue : préparé J0, retenu J0 (en essai : ne part pas aux utilisateurs), expiré J4 |
| Essai annulé : trop cher, livreur sur iPhone | Répond « trop cher » au questionnaire puis annule son essai le 3e jour ; livreur, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : trop cher, pas livreur | Répond « trop cher » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : trop cher, livreur sur Android | Répond « trop cher » au questionnaire puis annule son essai le 3e jour ; livreur, Google Play. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : fonctions payantes inutiles | Répond « les fonctions payantes ne lui servent pas » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : plus besoin | Répond « plus besoin de l'app » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : il manque des fonctions | Répond « il manque des fonctions » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : trop de bugs | Répond « trop de bugs » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : trop lente | Répond « trop lente » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : difficile à utiliser | Répond « difficile à utiliser » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |
| Essai annulé : autre raison | Répond « autre raison » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. | Essai annulé (fr) | préparé J3, envoyé J3 |

### Essai iOS utilisé, puis payé

Cas du bilan : 2, 5, 8, 17. S’inscrit et démarre un essai App Store de 7 jours le même matin ; 6 tournées ; l’essai se convertit. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bienvenue, envoyé ; Rappel de fin d’essai, envoyé.

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 10 h : essai démarré (App Store, 7 jours)
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai envoyé
- J7 10 h : fin de l’essai : premier paiement

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Rappel de fin d’essai : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Essai Android non utilisé

Cas du bilan : 3, 6, 8. Inscrit depuis 20 jours, essai Google Play de 14 jours, aucune tournée ; l’essai se convertit. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, envoyé ; Bienvenue, rien de préparé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (Google Play, 14 jours)
- J12 9 h : Rappel de fin d’essai préparé
- J12 9 h : Rappel de fin d’essai envoyé
- J14 10 h : fin de l’essai : premier paiement

#### Rappel de fin d’essai : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Essai annulé dans l’heure

Cas du bilan : 11, 45. S’inscrit, démarre un essai et l’annule 30 minutes après. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

**À relire :** Le défaut F5 reste pour l’essai annulé (seul le rappel échappe aux 72 h) : la bienvenue partie le matin le retient trois jours.

Résultat : Bienvenue, envoyé ; Essai annulé, envoyé (retenu avant : trop tôt).

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 9 h 10 : essai démarré (App Store, 7 jours)
- J0 9 h 40 : annule son essai
- J0 10 h : Essai annulé préparé
- J0 10 h : Essai annulé retenu : trop tôt
- J3 9 h : Essai annulé envoyé

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Essai annulé : envoyé (retenu avant : trop tôt)

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Essai annulé dans l’heure, puis repris

Cas du bilan : 11, 14. Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

**À relire :** Corrigé le 25/11 : la carte avait montré qu’après une reprise le rappel n’était jamais préparé (la personne était prélevée sans rappel). Seule compte maintenant la dernière annulation, si aucune reprise ne la suit.

Résultat : Bienvenue, envoyé ; Essai annulé, bloqué : a repris son essai ou payé ; Rappel de fin d’essai, envoyé.

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 9 h 10 : essai démarré (App Store, 7 jours)
- J0 9 h 40 : annule son essai
- J0 10 h : Essai annulé préparé
- J0 10 h : Essai annulé retenu : trop tôt
- J0 21 h : reprend (annulation retirée)
- J0 22 h : Essai annulé bloqué à l’envoi : a repris son essai ou payé
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai envoyé
- J7 9 h 10 : fin de l’essai : premier paiement

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Essai annulé : bloqué : a repris son essai ou payé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

#### Rappel de fin d’essai : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Essai fini par une carte refusée

Cas du bilan : 18, 19. Essai App Store, la carte est refusée à la fin de l’essai (raison BILLING_ERROR). J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, envoyé ; Essai annulé, rien de préparé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai envoyé
- J7 10 h : essai arrêté : carte refusée (BILLING_ERROR)

#### Rappel de fin d’essai : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Essai remboursé par le support

Cas du bilan : 16. Essai App Store remboursé par le support le 2e jour (raison CUSTOMER_SUPPORT). J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, rien de préparé ; Rappel de fin d’essai, rien de préparé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J2 10 h : essai arrêté : remboursé par le support (CUSTOMER_SUPPORT)

### Essai arrêté par le développeur

Cas du bilan : 22. Essai arrêté le 2e jour par une décision du développeur (raison DEVELOPER_INITIATED). J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

**À relire :** Écart avec le bilan (cas 22 : rien). La base Mixpanel écarte bien la raison DEVELOPER_INITIATED, mais la fiche Firebase passe par `faitsDesFiches`, qui n’écarte que la carte refusée et le remboursement : l’annulation y devient UNSUBSCRIBE et « Vous avez annulé votre essai » part. Suppose que RevenueCat pose `unsubscribe_detected_at` pour une décision du développeur, à vérifier.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J2 10 h : essai arrêté : par le développeur (DEVELOPER_INITIATED)
- J2 11 h : Essai annulé préparé
- J2 11 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Essai annulé le 3e jour, sans réponse au questionnaire

Cas du bilan : 12. Essai App Store annulé le 3e jour ; pas de réponse au questionnaire de l’app. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Essai annulé avec une réponse au questionnaire

Cas du bilan : 13. Répond « trop cher » dans l’app puis annule son essai le 3e jour ; 6 tournées, beaucoup d’adresses non trouvées. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop cher, « Je fais peu de tournées »
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> La version gratuite reste à vous, jusqu'à 16 arrêts par tournée.
>
> Harold

### Essai annulé le matin du rappel

Cas du bilan : 48. Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, bloqué : déjà payé ou annulé ; Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J5 8 h : annule son essai
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Essai annulé préparé
- J5 9 h : Rappel de fin d’essai bloqué à l’envoi : déjà payé ou annulé
- J5 9 h : Essai annulé envoyé

#### Rappel de fin d’essai : bloqué : déjà payé ou annulé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Essai annulé, puis payé deux jours après

Cas du bilan : 15. Annule son essai le 2e jour, puis achète l’abonnement mensuel le 4e jour. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J2 10 h : annule son essai
- J2 11 h : Essai annulé préparé
- J2 11 h : Essai annulé envoyé
- J4 10 h : achète l’offre mensuelle

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Résiliation, sans dossier lisible

Cas du bilan : 23. Payant mensuel qui arrête son abonnement ; personne introuvable dans la base Mixpanel. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J2 9 h : Résiliation, modèle préparé
- J2 9 h : Résiliation, modèle envoyé

#### Résiliation, modèle : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Résiliation, avec une réponse au questionnaire

Cas du bilan : 24. Payant qui répond « il manque des fonctions » dans l’app et arrête son abonnement ; 9 tournées. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : répond au questionnaire de l’app : il manque des fonctions, « Pas de tournée sur plusieurs jours »
- J0 11 h 05 : arrête son abonnement
- J2 9 h : Résiliation, depuis le dossier préparé
- J2 9 h : Résiliation, depuis le dossier envoyé

#### Résiliation, depuis le dossier : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Quelle fonction vous a le plus manqué ?
>
> Harold

### Résiliation, un problème vu, sans réponse

Cas du bilan : 25. Payant qui arrête sans répondre ; ses imports de fichier ont échoué 3 fois, aucune tournée. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J2 9 h : Résiliation, depuis le dossier préparé
- J2 9 h : Résiliation, depuis le dossier envoyé

#### Résiliation, depuis le dossier : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Résiliation, jamais parti en tournée

Cas du bilan : 26. Payant qui arrête sans répondre ; il a regardé la carte mais n’a jamais démarré de tournée. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J2 9 h : Résiliation, depuis le dossier préparé
- J2 9 h : Résiliation, depuis le dossier envoyé

#### Résiliation, depuis le dossier : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Résiliation, base Mixpanel en retard

Cas du bilan : 9, 46. Payant qui arrête ; la base Mixpanel du Mac a plus d’un jour et demi de retard. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

**À relire :** Depuis le 26/11, le texte ne cite plus son usage : un retard de la base Mixpanel ne bloque plus l’e-mail.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J2 9 h : Résiliation, depuis le dossier préparé
- J2 9 h : Résiliation, depuis le dossier envoyé

#### Résiliation, depuis le dossier : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Résilié qui revient, puis repart

Cas du bilan : 27, 29. Arrête puis reprend le même soir ; arrête de nouveau 15 jours plus tard ; revient au 45e jour et repart au 60e. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J0 19 h : reprend (annulation retirée)
- J10 10 h : renouvellement payé
- J15 11 h : arrête son abonnement
- J17 9 h : Résiliation, depuis le dossier préparé
- J17 9 h : Résiliation, depuis le dossier envoyé
- J45 10 h : achète l’offre mensuelle
- J60 11 h : arrête son abonnement

#### Résiliation, depuis le dossier : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Arrête le mensuel, prend l’annuel

Cas du bilan : 28. Arrête son abonnement mensuel, puis prend l’offre annuelle deux heures après. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, bloqué : plus résilié.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J0 13 h : achète l’offre annuelle
- J2 9 h : Résiliation, depuis le dossier préparé
- J2 9 h : Résiliation, depuis le dossier bloqué à l’envoi : plus résilié

#### Résiliation, depuis le dossier : bloqué : plus résilié

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Payant remboursé

Cas du bilan : 21. Payant mensuel remboursé par le support (raison CUSTOMER_SUPPORT). J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, rien de préparé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : abonnement arrêté : remboursé par le support (CUSTOMER_SUPPORT)

### Payant, carte refusée au renouvellement

Cas du bilan : 20. Payant mensuel dont la carte est refusée au renouvellement (raison BILLING_ERROR). J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, rien de préparé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J10 10 h : abonnement arrêté : carte refusée (BILLING_ERROR)

### Payant arrêté par le développeur

Cas du bilan : 22. Payant mensuel dont l’abonnement est arrêté par une décision du développeur (raison DEVELOPER_INITIATED). J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

**À relire :** Écart avec l’arbre validé (arrêté par nous : aucun), comme pour l’essai arrêté par le développeur : la fiche Firebase ne dit pas qui a arrêté, `faitsDesFiches` en fait un arrêt par la personne. Suppose que RevenueCat pose `unsubscribe_detected_at` pour une décision du développeur, à vérifier.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : abonnement arrêté : par le développeur (DEVELOPER_INITIATED)
- J2 9 h : Résiliation, depuis le dossier préparé
- J2 9 h : Résiliation, depuis le dossier envoyé

#### Résiliation, depuis le dossier : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Désinscrit pendant son essai

Cas du bilan : 39. S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bienvenue, envoyé ; Rappel de fin d’essai, bloqué : désinscrit ; Essai annulé, bloqué : désinscrit.

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 10 h : essai démarré (App Store, 7 jours)
- J1 11 h : se désinscrit
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai bloqué à l’envoi : désinscrit
- J6 11 h : annule son essai
- J6 12 h : Essai annulé préparé
- J6 12 h : Essai annulé bloqué à l’envoi : désinscrit

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Rappel de fin d’essai : bloqué : désinscrit

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

#### Essai annulé : bloqué : désinscrit

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Compte de test du fondateur

Cas du bilan : 36, 38. Compte de test, onboarding pas fini ; signale un bug, corrigé en 7.6.9 ; essai démarré puis annulé ; rouvre l’app. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Onboarding abandonné, envoyé à l’adresse de test ; Bug corrigé, envoyé à l’adresse de test ; Bienvenue, rien de préparé ; Demande d’avis, rien de préparé ; Essai annulé, rien de préparé.

- J0 9 h : compte de test, inscription avec une adresse (langue de l’app : fr, onboarding pas fini)
- J1 9 h : Onboarding abandonné préparé
- J1 9 h : Onboarding abandonné envoyé à l’adresse de test
- J1 11 h : signale un bug (« La carte reste vide après un import »)
- J2 11 h : le fondateur note le bug corrigé en 7.6.9 (« la carte restait vide après un import »)
- J3 8 h : la version 7.6.9 est en vente sur App Store
- J3 9 h : Bug corrigé préparé
- J3 9 h : Bug corrigé envoyé à l’adresse de test
- J4 10 h : essai démarré (App Store, 7 jours)
- J5 10 h : annule son essai
- J12 10 h : rouvre l’app

#### Onboarding abandonné : envoyé à l’adresse de test

Langue de la personne : français, d'après l'app.

> **Objet :** Easy Way : quelque chose vous a bloqué ?
>
> Bonjour,
>
> Vous avez commencé à configurer Easy Way sans aller jusqu'au bout. Qu'est-ce qui vous a arrêté ? Je vous aide à finir.
>
> Harold

#### Bug corrigé : envoyé à l’adresse de test

Langue de la personne : français, d'après l'app.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous m'avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> C'est corrigé dans la version 7.6.9, disponible sur l’App Store : il suffit de mettre l'app à jour. Merci de me l'avoir signalé. S'il revient, répondez-moi.
>
> Harold

### Adresse en rebond

Cas du bilan : 40. S’inscrit, démarre un essai ; Resend signale un rebond le jour même ; un bug qu’il a signalé est corrigé. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bienvenue, envoyé ; Bug corrigé, bloqué : adresse en rebond ; Rappel de fin d’essai, bloqué : adresse en rebond.

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 10 h : essai démarré (App Store, 7 jours)
- J0 13 h : Resend signale un rebond sur son adresse
- J1 11 h : signale un bug (« Impossible d’importer mon fichier »)
- J2 11 h : le fondateur note le bug corrigé en 7.6.9 (« l’import d’un fichier Excel échouait »)
- J3 8 h : la version 7.6.9 est en vente sur App Store
- J3 9 h : Bug corrigé préparé
- J3 9 h : Bug corrigé bloqué à l’envoi : adresse en rebond
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai bloqué à l’envoi : adresse en rebond
- J7 10 h : fin de l’essai : premier paiement

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Bug corrigé : bloqué : adresse en rebond

Langue de la personne : français, d'après l'app.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous m'avez signalé un problème dans Easy Way : l’import d’un fichier Excel échouait.
>
> C'est corrigé dans la version 7.6.9, disponible sur l’App Store : il suffit de mettre l'app à jour. Merci de me l'avoir signalé. S'il revient, répondez-moi.
>
> Harold

#### Rappel de fin d’essai : bloqué : adresse en rebond

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Bienvenue, rappel, puis annulation

Cas du bilan : 2, 5, 45. S’inscrit et démarre un essai ; reçoit la bienvenue puis le rappel ; annule le lendemain du rappel. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bienvenue, envoyé ; Rappel de fin d’essai, envoyé ; Essai annulé, envoyé (retenu avant : trop tôt).

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 10 h : essai démarré (App Store, 7 jours)
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai envoyé
- J6 11 h : annule son essai
- J6 12 h : Essai annulé préparé
- J6 12 h : Essai annulé retenu : trop tôt
- J8 9 h : Essai annulé envoyé

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Rappel de fin d’essai : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

#### Essai annulé : envoyé (retenu avant : trop tôt)

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Personne au Mexique, fin d’essai un vendredi soir

Cas du bilan : 5, 41. App en espagnol, au Mexique ; l’essai finit vendredi à 23 h 30 UTC, déjà samedi 0 h 30 à Paris, encore vendredi au Mexique. J0 : vendredi 4 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : es)
- J1 0 h 30 : essai démarré (App Store, 7 jours)
- J6 9 h : Rappel de fin d’essai préparé
- J6 9 h : Rappel de fin d’essai envoyé
- J8 0 h 30 : fin de l’essai : premier paiement

#### Rappel de fin d’essai : envoyé

Langue de la personne : espagnol, d'après l'app.

> **Objet :** Votre essai Easy Way se termine vendredi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine vendredi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Bug corrigé pour une personne en allemand

Cas du bilan : 33, 41, 46. App en allemand ; signale un bug, le fondateur le note corrigé en 7.6.9, la version sort sur l’App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bug corrigé, expiré (retenu avant : à vérifier : le titre public est en français : le traduire dans le texte).

- J-20 10 h : inscription avec une adresse (langue de l’app : de)
- J0 11 h : signale un bug (« Die Karte bleibt leer »)
- J1 11 h : le fondateur note le bug corrigé en 7.6.9 (« la carte restait vide après un import »)
- J2 8 h : la version 7.6.9 est en vente sur App Store
- J2 9 h : Bug corrigé préparé ; à vérifier : le titre public est en français : le traduire dans le texte
- J2 9 h : Bug corrigé retenu : à vérifier : le titre public est en français : le traduire dans le texte
- J33 9 h : Bug corrigé expiré

#### Bug corrigé : expiré (retenu avant : à vérifier : le titre public est en français : le traduire dans le texte)

Langue de la personne : allemand, d'après l'app. À vérifier : le titre public est en français : le traduire dans le texte.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous m'avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> C'est corrigé dans la version 7.6.9, disponible sur l’App Store : il suffit de mettre l'app à jour. Merci de me l'avoir signalé. S'il revient, répondez-moi.
>
> Harold

### Résiliation en italien

Cas du bilan : 23, 41. App en italien ; payant qui arrête ; pas de dossier lisible. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, envoyé.

- J-60 11 h : inscription avec une adresse (langue de l’app : it)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J2 9 h : Résiliation, modèle préparé
- J2 9 h : Résiliation, modèle envoyé

#### Résiliation, modèle : envoyé

Langue de la personne : italien, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. Qu'est-ce qui vous a fait arrêter ?
>
> Harold

### Langue inconnue, pays Brésil

Cas du bilan : 12, 42. L’app n’a pas envoyé de langue ; la base Mixpanel le voit au Brésil ; annule son essai le 3e jour. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : aucune)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : portugais, d'après le pays (BR).

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold

### Langue inconnue, pays Belgique

Cas du bilan : 43. L’app n’a pas envoyé de langue ; la base Mixpanel le voit en Belgique ; essai App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : aucune)
- J0 10 h : essai démarré (App Store, 7 jours)
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai envoyé
- J7 10 h : fin de l’essai : premier paiement

#### Rappel de fin d’essai : envoyé

Langue de la personne : anglais en attendant : pays à plusieurs langues (BE), à choisir.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Ni langue ni pays, store inconnu

Cas du bilan : 7, 44. Ni langue de l’app ni pays connus ; le store de l’essai n’est pas donné. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : aucune)
- J0 10 h : essai démarré (store inconnu, 7 jours)
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Rappel de fin d’essai envoyé
- J7 10 h : fin de l’essai : premier paiement

#### Rappel de fin d’essai : envoyé

Langue de la personne : anglais, par défaut (ni langue ni pays connus).

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

### Onboarding abandonné

Cas du bilan : 2, 4. S’inscrit et laisse l’onboarding en plan ; ni essai ni abonnement. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bienvenue, envoyé ; Onboarding abandonné, envoyé (retenu avant : trop tôt).

- J0 9 h : inscription avec une adresse (langue de l’app : fr, onboarding pas fini)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J1 9 h : Onboarding abandonné préparé
- J1 9 h : Onboarding abandonné retenu : trop tôt
- J3 9 h : Onboarding abandonné envoyé

#### Bienvenue : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Onboarding abandonné : envoyé (retenu avant : trop tôt)

Langue de la personne : français, d'après l'app.

> **Objet :** Easy Way : quelque chose vous a bloqué ?
>
> Bonjour,
>
> Vous avez commencé à configurer Easy Way sans aller jusqu'au bout. Qu'est-ce qui vous a arrêté ? Je vous aide à finir.
>
> Harold

### Gros utilisateur

Cas du bilan : 32. 34 tournées, 13 jours actifs sur les 4 dernières semaines, un import Excel raté, deux optimisations ratées. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Gros utilisateur, envoyé.

- J-100 11 h : achète l’offre annuelle
- J-90 11 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : rouvre l’app
- J0 11 h : Gros utilisateur préparé
- J0 11 h : Gros utilisateur envoyé

#### Gros utilisateur : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Comment ça se passe avec Easy Way ?
>
> Bonjour,
>
> Vous faites beaucoup de tournées avec Easy Way. Comment ça se passe, de votre côté ?
>
> Harold

### Bug corrigé, puis demande d’avis

Cas du bilan : 33, 35. Signale un bug ; le fondateur le note corrigé en 7.6.9 ; la version sort ; rouvre l’app 9 jours après l’e-mail. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bug corrigé, envoyé ; Demande d’avis, envoyé.

- J-30 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 11 h : signale un bug (« La carte reste vide après un import »)
- J1 11 h : le fondateur note le bug corrigé en 7.6.9 (« la carte restait vide après un import »)
- J3 8 h : la version 7.6.9 est en vente sur App Store
- J3 9 h : Bug corrigé préparé
- J3 9 h : Bug corrigé envoyé
- J12 10 h : rouvre l’app
- J12 11 h : Demande d’avis préparé
- J12 11 h : Demande d’avis envoyé

#### Bug corrigé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous m'avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> C'est corrigé dans la version 7.6.9, disponible sur l’App Store : il suffit de mettre l'app à jour. Merci de me l'avoir signalé. S'il revient, répondez-moi.
>
> Harold

#### Demande d’avis : envoyé

Langue de la personne : français, par défaut (ni langue ni pays connus).

> **Objet :** Votre avis sur Easy Way
>
> Bonjour,
>
> Content que la version 7.6.9 ait réglé votre problème. Si Easy Way vous aide au quotidien, un avis sur l’App Store m'aiderait beaucoup :
> https://apps.apple.com/app/id6443783383?action=write-review
>
> Et si quelque chose vous gêne encore, répondez-moi.
>
> Harold

### Bug signalé sans être inscrit

Cas du bilan : 34. Signale un bug avec une adresse de contact, sans être inscrit ; le bug est corrigé. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bug corrigé, rien de préparé.

- J0 11 h : signale un bug (« Les adresses ne se placent pas »)
- J1 11 h : le fondateur note le bug corrigé en 7.6.9 (« certaines adresses ne se plaçaient pas »)
- J3 8 h : la version 7.6.9 est en vente sur App Store

### Essai annulé sans adresse donnée

Cas du bilan : 1. N’a jamais donné d’adresse ; démarre un essai et l’annule le lendemain. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, rien de préparé.

- J0 10 h : essai démarré (App Store, 7 jours)
- J1 10 h : annule son essai
- J2 9 h : annulation d’un essai d’une personne sans adresse : le fondateur est prévenu sur son téléphone, sans nom ni adresse

### Bienvenue « en essai » (le réglage par défaut)

Cas du bilan : 47. S’inscrit ; la bienvenue est en essai, comme le veut le réglage par défaut. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Bienvenue, expiré (retenu avant : en essai : ne part pas aux utilisateurs).

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue retenu : en essai : ne part pas aux utilisateurs
- J4 9 h : Bienvenue expiré

#### Bienvenue : expiré (retenu avant : en essai : ne part pas aux utilisateurs)

Langue de la personne : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

### Essai annulé : trop cher, livreur sur iPhone

Cas du bilan : 13. Répond « trop cher » au questionnaire puis annule son essai le 3e jour ; livreur, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop cher
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Notre app Boxy, faite pour les livreurs, fait les mêmes tournées pour 7,99 € par mois :
> https://apps.apple.com/app/id6756269385
>
> Harold

### Essai annulé : trop cher, pas livreur

Cas du bilan : 13. Répond « trop cher » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop cher
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> La version gratuite reste à vous, jusqu'à 16 arrêts par tournée.
>
> Harold

### Essai annulé : trop cher, livreur sur Android

Cas du bilan : 13. Répond « trop cher » au questionnaire puis annule son essai le 3e jour ; livreur, Google Play. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (Google Play, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop cher
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> La version gratuite reste à vous, jusqu'à 16 arrêts par tournée.
>
> Harold

### Essai annulé : fonctions payantes inutiles

Cas du bilan : 13. Répond « les fonctions payantes ne lui servent pas » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : les fonctions payantes ne lui servent pas
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> La version gratuite reste à vous, jusqu'à 16 arrêts par tournée.
>
> Harold

### Essai annulé : plus besoin

Cas du bilan : 13. Répond « plus besoin de l'app » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : plus besoin de l'app
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> C'est votre activité qui a changé, ou l'app qui ne collait pas à vos tournées ?
>
> Harold

### Essai annulé : il manque des fonctions

Cas du bilan : 13. Répond « il manque des fonctions » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : il manque des fonctions
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Quelle fonction vous a le plus manqué ?
>
> Harold

### Essai annulé : trop de bugs

Cas du bilan : 13. Répond « trop de bugs » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop de bugs
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> Quel problème avez-vous rencontré ? Je le corrige et je vous préviens quand c'est fait.
>
> Harold

### Essai annulé : trop lente

Cas du bilan : 13. Répond « trop lente » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop lente
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> À quel moment l'app était-elle lente ? Je regarde moi-même.
>
> Harold

### Essai annulé : difficile à utiliser

Cas du bilan : 13. Répond « difficile à utiliser » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : difficile à utiliser
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, et vous avez dit pourquoi dans l'app, merci.
>
> À quel moment l'app vous a-t-elle paru compliquée ?
>
> Harold

### Essai annulé : autre raison

Cas du bilan : 13. Répond « autre raison » au questionnaire puis annule son essai le 3e jour ; commercial, App Store. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : autre raison
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé préparé
- J3 16 h : Essai annulé envoyé

#### Essai annulé : envoyé

Langue de la personne : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. Qu'est-ce que vous espériez que l'app fasse pour vous ?
>
> Harold
