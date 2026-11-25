# La carte des e-mails d’Iris

Simulation : rien ne part d’ici. Fichier produit par `node mac/carte.mjs` ; ne pas l’écrire à la main.

## Limites

- Les scénarios partent de faits déjà mâchés (la forme que lit `candidats`), pas du SQL de la base Mixpanel : `lireFaits` est hors champ.
- Le moment d’envoi est simulé : le fondateur envoie chaque action dès qu’elle est prête, à la passe qui la prépare ; une action retenue est réessayée à chaque passe suivante. Il ne lève jamais un point « à vérifier ».
- Une passe par jour à 9 h (heure de Paris), plus une passe une heure après chaque fait du scénario. Avant J-3, l’histoire est posée sans passe.
- Le faux RevenueCat rend l’abonnement tiré des mêmes faits ; ce que le vrai RevenueCat répond dans les cas rares (période de grâce, remboursement) n’est pas vérifié.
- Pour « rien de préparé », la raison est celle de l’étiquette du scénario : le code n’en garde pas de trace.

## Hors carte

- Les campagnes du fondateur (cas 37) : hors champ, leur texte est écrit à la main.
- Le gratuit au plafond de 16 arrêts (cas 31) : aucun e-mail n’est construit.
- Le changement d’offre pendant un essai (cas 10) : `rc_product_change_event` est ignoré par Iris, rien à simuler sans inventer la réponse de RevenueCat.
- L’abonnement échu sans arrêt connu (cas 30) : rien n’est préparé, rien à montrer.
- Les rebonds sont posés sur la fiche par le scénario : la lecture des retours de Resend (`livraison.mjs`) n’est pas simulée.
- La ligne WhatsApp ajoutée à l’envoi n’est pas réglée ici.

36 scénarios. Cas du bilan du 25/11 couverts : 44 sur 48 (1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48). Non couverts : 10, 30, 31, 37.

## Le tableau

| Situation | Condition | E-mail ou aucun | Pourquoi |
|---|---|---|---|
| Essai iOS utilisé, puis payé | S’inscrit et démarre un essai App Store de 7 jours le même matin ; 6 tournées ; l’essai se convertit. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Essai iOS utilisé, puis payé | S’inscrit et démarre un essai App Store de 7 jours le même matin ; 6 tournées ; l’essai se convertit. | Rappel de fin d’essai (fr) | préparé J5, envoyé J5 |
| Essai Android non utilisé | Inscrit depuis 20 jours, essai Google Play de 14 jours, aucune tournée ; l’essai se convertit. | Rappel de fin d’essai (fr) | préparé J12, envoyé J12 |
| Essai Android non utilisé | Inscrit depuis 20 jours, essai Google Play de 14 jours, aucune tournée ; l’essai se convertit. | aucun | Bienvenue : rien de préparé (inscrit depuis plus de 72 h : pas de bienvenue rattrapée) |
| Essai annulé dans l’heure | S’inscrit, démarre un essai et l’annule 30 minutes après. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Essai annulé dans l’heure | S’inscrit, démarre un essai et l’annule 30 minutes après. | Essai annulé, court (fr) | préparé J0, retenu J0 (trop tôt), envoyé J3 |
| Essai annulé dans l’heure, puis repris | Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Essai annulé dans l’heure, puis repris | Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. | aucun | Essai annulé, court : préparé J0, retenu J0 (trop tôt), bloqué J0 : a repris son essai ou payé |
| Essai annulé dans l’heure, puis repris | Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. | aucun | Rappel de fin d’essai : rien de préparé (la passe voit une annulation après le début de l’essai et ne lit pas la reprise) |
| Essai fini par une carte refusée | Essai App Store, la carte est refusée à la fin de l’essai (raison BILLING_ERROR). | Rappel de fin d’essai (fr) | préparé J5, envoyé J5 |
| Essai fini par une carte refusée | Essai App Store, la carte est refusée à la fin de l’essai (raison BILLING_ERROR). | aucun | Essai annulé : rien de préparé (carte refusée : « vous avez annulé » serait faux) |
| Essai remboursé par le support | Essai App Store remboursé par le support le 2e jour (raison CUSTOMER_SUPPORT). | aucun | Essai annulé : rien de préparé (remboursement : pas un choix de la personne) |
| Essai remboursé par le support | Essai App Store remboursé par le support le 2e jour (raison CUSTOMER_SUPPORT). | aucun | Rappel de fin d’essai : rien de préparé (l’essai est arrêté) |
| Essai arrêté par le développeur | Essai arrêté le 2e jour par une décision du développeur (raison DEVELOPER_INITIATED). | Essai annulé, court (fr) | préparé J2, envoyé J2 |
| Essai annulé le 3e jour, sans réponse au questionnaire | Essai App Store annulé le 3e jour ; pas de réponse au questionnaire de l’app. | Essai annulé, court (fr) | préparé J3, envoyé J3 |
| Essai annulé avec une réponse au questionnaire | Répond « trop cher » dans l’app puis annule son essai le 3e jour ; 6 tournées, beaucoup d’adresses non trouvées. | Essai annulé, avec sa réponse (fr) | préparé J3, envoyé J3 |
| Essai annulé le matin du rappel | Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain. | aucun | Rappel de fin d’essai : préparé J5, bloqué J5 : déjà payé ou annulé |
| Essai annulé le matin du rappel | Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain. | Essai annulé, court (fr) | préparé J5, envoyé J5 |
| Essai annulé, puis payé deux jours après | Annule son essai le 2e jour, puis achète l’abonnement mensuel le 4e jour. | Essai annulé, court (fr) | préparé J2, envoyé J2 |
| Résiliation, sans dossier lisible | Payant mensuel qui arrête son abonnement ; personne introuvable dans la base Mixpanel. | Résiliation, modèle (fr) | préparé J2, envoyé J2 |
| Résiliation, avec une réponse au questionnaire | Payant qui répond « il manque des fonctions » dans l’app et arrête son abonnement ; 9 tournées. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résiliation, un problème vu, sans réponse | Payant qui arrête sans répondre ; ses imports de fichier ont échoué 3 fois, aucune tournée. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résiliation, jamais parti en tournée | Payant qui arrête sans répondre ; il a regardé la carte mais n’a jamais démarré de tournée. | Résiliation, depuis le dossier (fr) | préparé J2, envoyé J2 |
| Résiliation, base Mixpanel en retard | Payant qui arrête ; la base Mixpanel du Mac a plus d’un jour et demi de retard. | aucun | Résiliation, depuis le dossier : préparé J2, retenu J2 (à vérifier : on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte), expiré J8 |
| Résilié qui revient, puis repart | Arrête puis reprend le même soir ; arrête de nouveau 15 jours plus tard ; revient au 45e jour et repart au 60e. | Résiliation, depuis le dossier (fr) | préparé J17, envoyé J17 |
| Arrête le mensuel, prend l’annuel | Arrête son abonnement mensuel, puis prend l’offre annuelle deux heures après. | aucun | Résiliation, depuis le dossier : préparé J2, bloqué J2 : plus résilié |
| Payant remboursé | Payant mensuel remboursé par le support (raison CUSTOMER_SUPPORT). | aucun | Résiliation : rien de préparé (remboursement : seul un arrêt par la personne compte) |
| Payant, carte refusée au renouvellement | Payant mensuel dont la carte est refusée au renouvellement (raison BILLING_ERROR). | aucun | Résiliation : rien de préparé (carte refusée : pas un arrêt par la personne (aucun e-mail prévu, trou R2)) |
| Désinscrit pendant son essai | S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. | Bienvenue (fr) | préparé J0, envoyé J0 |
| Désinscrit pendant son essai | S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. | aucun | Rappel de fin d’essai : préparé J5, bloqué J5 : désinscrit |
| Désinscrit pendant son essai | S’inscrit et démarre un essai, se désinscrit le lendemain, annule son essai le 6e jour. | aucun | Essai annulé, court : préparé J6, bloqué J6 : désinscrit |
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
| Bienvenue, rappel, puis annulation | S’inscrit et démarre un essai ; reçoit la bienvenue puis le rappel ; annule le lendemain du rappel. | Essai annulé, court (fr) | préparé J6, retenu J6 (trop tôt), envoyé J8 |
| Personne au Mexique, fin d’essai un vendredi soir | App en espagnol, au Mexique ; l’essai finit vendredi à 23 h 30 UTC, déjà samedi 0 h 30 à Paris, encore vendredi au Mexique. | Rappel de fin d’essai (es) | préparé J6, envoyé J6 |
| Bug corrigé pour une personne en allemand | App en allemand ; signale un bug, le fondateur le note corrigé en 7.6.9, la version sort sur l’App Store. | aucun | Bug corrigé : préparé J2, retenu J2 (à vérifier : le titre public est en français : le traduire dans le texte), expiré J33 |
| Résiliation en italien | App en italien ; payant qui arrête ; pas de dossier lisible. | Résiliation, modèle (it) | préparé J2, envoyé J2 |
| Langue inconnue, pays Brésil | L’app n’a pas envoyé de langue ; la base Mixpanel le voit au Brésil ; annule son essai le 3e jour. | Essai annulé, court (pt) | préparé J3, envoyé J3 |
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

## Les scénarios

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

Langue : français, d'après l'app.

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

Langue : français, d'après l'app.

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

Langue : français, d'après l'app.

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
- J0 10 h : Essai annulé, court préparé
- J0 10 h : Essai annulé, court retenu : trop tôt
- J3 9 h : Essai annulé, court envoyé

#### Bienvenue : envoyé

Langue : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Essai annulé, court : envoyé (retenu avant : trop tôt)

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
>
> Harold

### Essai annulé dans l’heure, puis repris

Cas du bilan : 11, 14. Annule son essai 30 minutes après l’avoir démarré, le reprend le soir, puis paie à la fin de l’essai. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

**À relire :** Pas dans le bilan (cas 14) : après une reprise, le rappel de fin d’essai n’est jamais préparé. `candidats` écarte un essai dès qu’une annulation le suit, sans lire la reprise (`rc_uncancellation_event`) : la personne est prélevée sans rappel.

Résultat : Bienvenue, envoyé ; Essai annulé, bloqué : a repris son essai ou payé ; Rappel de fin d’essai, rien de préparé.

- J0 9 h : inscription avec une adresse (langue de l’app : fr)
- J0 9 h : Bienvenue préparé
- J0 9 h : Bienvenue envoyé
- J0 9 h 10 : essai démarré (App Store, 7 jours)
- J0 9 h 40 : annule son essai
- J0 10 h : Essai annulé, court préparé
- J0 10 h : Essai annulé, court retenu : trop tôt
- J0 21 h : reprend (annulation retirée)
- J0 22 h : Essai annulé, court bloqué à l’envoi : a repris son essai ou payé
- J7 9 h 10 : fin de l’essai : premier paiement

#### Bienvenue : envoyé

Langue : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

#### Essai annulé, court : bloqué : a repris son essai ou payé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
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

Langue : français, d'après l'app.

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
- J2 11 h : Essai annulé, court préparé
- J2 11 h : Essai annulé, court envoyé

#### Essai annulé, court : envoyé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
>
> Harold

### Essai annulé le 3e jour, sans réponse au questionnaire

Cas du bilan : 12. Essai App Store annulé le 3e jour ; pas de réponse au questionnaire de l’app. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : annule son essai
- J3 16 h : Essai annulé, court préparé
- J3 16 h : Essai annulé, court envoyé

#### Essai annulé, court : envoyé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
>
> Harold

### Essai annulé avec une réponse au questionnaire

Cas du bilan : 13. Répond « trop cher » dans l’app puis annule son essai le 3e jour ; 6 tournées, beaucoup d’adresses non trouvées. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : répond au questionnaire de l’app : trop cher, « Je fais peu de tournées »
- J3 15 h 05 : annule son essai
- J3 16 h : Essai annulé, avec sa réponse préparé
- J3 16 h : Essai annulé, avec sa réponse envoyé

#### Essai annulé, avec sa réponse : envoyé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. C'est pris en compte : rien ne vous sera facturé.
>
> Vous avez lancé 6 tournées avec l'app en 5 semaines. En regardant de mon côté, je vois que beaucoup d'adresses n'ont pas été trouvées sur la carte. Dans l'app, vous avez indiqué que c'était trop cher. Vous avez écrit : « Je fais peu de tournées ».
>
> Pour quel prix, ou avec quoi de plus, l'app vous aurait-elle paru valoir le coup ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
>
> Harold

### Essai annulé le matin du rappel

Cas du bilan : 48. Annule son essai le 5e jour à 8 h, une heure avant la passe qui prépare le rappel ; la base Mixpanel ne le sait que le lendemain. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Rappel de fin d’essai, bloqué : déjà payé ou annulé ; Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J5 8 h : annule son essai
- J5 9 h : Rappel de fin d’essai préparé
- J5 9 h : Essai annulé, court préparé
- J5 9 h : Rappel de fin d’essai bloqué à l’envoi : déjà payé ou annulé
- J5 9 h : Essai annulé, court envoyé

#### Rappel de fin d’essai : bloqué : déjà payé ou annulé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

#### Essai annulé, court : envoyé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
>
> Harold

### Essai annulé, puis payé deux jours après

Cas du bilan : 15. Annule son essai le 2e jour, puis achète l’abonnement mensuel le 4e jour. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : fr)
- J0 10 h : essai démarré (App Store, 7 jours)
- J2 10 h : annule son essai
- J2 11 h : Essai annulé, court préparé
- J2 11 h : Essai annulé, court envoyé
- J4 10 h : achète l’offre mensuelle

#### Essai annulé, court : envoyé

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
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

Langue : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way est arrêté
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Une seule question, si vous avez une minute : qu'est-ce qui vous a fait partir ? Une ligne en réponse suffit. C'est ce qui décide de ce que je corrige ensuite.
>
> Je ne vous écrirai pas d'autre e-mail à ce sujet.
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

Langue : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Vous avez lancé 9 tournées avec l'app en 4 semaines. Dans l'app, vous avez indiqué qu'il vous manquait des fonctions. Vous avez écrit : « Pas de tournée sur plusieurs jours ».
>
> Quelle fonction vous a le plus manqué ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
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

Langue : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Vous avez surtout utilisé l'import de contacts, sans avoir encore lancé de tournée. En regardant de mon côté, je vois que l'import de votre fichier n'a pas marché.
>
> Est-ce ce problème qui vous a arrêté, ou autre chose ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
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

Langue : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Vous avez surtout utilisé la carte, sans avoir encore lancé de tournée.
>
> Qu'est-ce qui vous a manqué pour partir en tournée avec l'app ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
>
> Harold

### Résiliation, base Mixpanel en retard

Cas du bilan : 9, 46. Payant qui arrête ; la base Mixpanel du Mac a plus d’un jour et demi de retard. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Résiliation, expiré (retenu avant : à vérifier : on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte).

- J-60 11 h : inscription avec une adresse (langue de l’app : fr)
- J-20 10 h : achète l’offre mensuelle
- J0 11 h : arrête son abonnement
- J2 9 h : Résiliation, depuis le dossier préparé ; à vérifier : on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte
- J2 9 h : Résiliation, depuis le dossier retenu : à vérifier : on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte
- J8 9 h : Résiliation, depuis le dossier expiré

#### Résiliation, depuis le dossier : expiré (retenu avant : à vérifier : on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte)

Langue : français, d'après l'app. À vérifier : on ne sait pas comment elle a utilisé l'app (données Mixpanel absentes ou en retard) : relire le texte.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Si vous avez une minute : qu'est-ce qui vous a fait partir ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
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

Langue : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Vous avez lancé 3 tournées avec l'app en 7 semaines.
>
> Si vous avez une minute : qu'est-ce qui vous a fait partir ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
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

Langue : français, d'après l'app.

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Vous avez lancé 3 tournées avec l'app en 4 semaines.
>
> Si vous avez une minute : qu'est-ce qui vous a fait partir ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
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
- J6 12 h : Essai annulé, court préparé
- J6 12 h : Essai annulé, court bloqué à l’envoi : désinscrit

#### Bienvenue : envoyé

Langue : français, d'après l'app.

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

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

#### Essai annulé, court : bloqué : désinscrit

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
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

Langue : français, d'après l'app.

> **Objet :** Easy Way : quelque chose vous a bloqué ?
>
> Bonjour,
>
> Vous avez commencé à configurer Easy Way il y a quelques jours, sans aller jusqu'au bout. C'est souvent le moment où quelque chose bloque.
>
> Qu'est-ce qui vous a arrêté ? Une ligne en réponse suffit, et je vous aide à finir.
>
> Je ne vous relancerai pas à ce sujet.
>
> Harold

#### Bug corrigé : envoyé à l’adresse de test

Langue : français, d'après l'app.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous nous avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> Il est corrigé dans la version 7.6.9, disponible sur l’App Store. Il suffit de mettre l'app à jour.
>
> Si vous le voyez encore, répondez à cet e-mail : je regarde moi-même.
>
> Merci de l'avoir signalé.
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

Langue : français, d'après l'app.

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

Langue : français, d'après l'app.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous nous avez signalé un problème dans Easy Way : l’import d’un fichier Excel échouait.
>
> Il est corrigé dans la version 7.6.9, disponible sur l’App Store. Il suffit de mettre l'app à jour.
>
> Si vous le voyez encore, répondez à cet e-mail : je regarde moi-même.
>
> Merci de l'avoir signalé.
>
> Harold

#### Rappel de fin d’essai : bloqué : adresse en rebond

Langue : français, d'après l'app.

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
- J6 12 h : Essai annulé, court préparé
- J6 12 h : Essai annulé, court retenu : trop tôt
- J8 9 h : Essai annulé, court envoyé

#### Bienvenue : envoyé

Langue : français, d'après l'app.

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

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

#### Essai annulé, court : envoyé (retenu avant : trop tôt)

Langue : français, d'après l'app.

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
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

Langue : espagnol, d'après l'app.

En espagnol :

> **Objet :** Su prueba de Easy Way termina el viernes
>
> Hola:
>
> Espero que Easy Way le esté gustando. Su prueba termina el viernes y ese día empieza la suscripción.
>
> Si algo no va bien, basta con un mensaje corto.
>
> Harold

En français :

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

Langue : allemand, d'après l'app. À vérifier : le titre public est en français : le traduire dans le texte.

En allemand :

> **Objet :** Das gemeldete Problem ist behoben
>
> Hallo,
>
> Sie haben uns ein Problem in Easy Way gemeldet: la carte restait vide après un import.
>
> Es ist in Version 7.6.9 behoben, ab sofort im App Store verfügbar. Aktualisieren Sie einfach die App.
>
> Wenn Sie es noch sehen, antworten Sie auf diese E-Mail: Ich sehe es mir selbst an.
>
> Danke für Ihre Meldung.
>
> Harold

En français :

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous nous avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> Il est corrigé dans la version 7.6.9, disponible sur l’App Store. Il suffit de mettre l'app à jour.
>
> Si vous le voyez encore, répondez à cet e-mail : je regarde moi-même.
>
> Merci de l'avoir signalé.
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

Langue : italien, d'après l'app.

En italien :

> **Objet :** Il suo abbonamento a Easy Way è disdetto
>
> Buongiorno,
>
> Ha disdetto il suo abbonamento a Easy Way. È fatto, non deve fare altro.
>
> Una sola domanda, se ha un minuto: che cosa l'ha fatta andare via? Basta una riga in risposta. È ciò che decide cosa correggo dopo.
>
> Non le scriverò altre e-mail su questo.
>
> Harold

En français :

> **Objet :** Votre abonnement Easy Way est arrêté
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Une seule question, si vous avez une minute : qu'est-ce qui vous a fait partir ? Une ligne en réponse suffit. C'est ce qui décide de ce que je corrige ensuite.
>
> Je ne vous écrirai pas d'autre e-mail à ce sujet.
>
> Harold

### Langue inconnue, pays Brésil

Cas du bilan : 12, 42. L’app n’a pas envoyé de langue ; la base Mixpanel le voit au Brésil ; annule son essai le 3e jour. J0 : mardi 1 décembre 2026. Envoi simulé : chaque action part dès qu’elle est prête, à la passe qui la prépare.

Résultat : Essai annulé, envoyé.

- J-20 10 h : inscription avec une adresse (langue de l’app : aucune)
- J0 10 h : essai démarré (App Store, 7 jours)
- J3 15 h : annule son essai
- J3 16 h : Essai annulé, court préparé
- J3 16 h : Essai annulé, court envoyé

#### Essai annulé, court : envoyé

Langue : portugais, d'après le pays (BR).

En portugais :

> **Objet :** O seu teste do Easy Way
>
> Olá,
>
> Cancelou o seu teste do Easy Way, não lhe será cobrado nada.
>
> O que não o convenceu? Uma linha em resposta ajuda-me muito, leio tudo eu próprio.
>
> Harold

En français :

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
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

Langue : anglais en attendant : pays à plusieurs langues (BE), à choisir.

En anglais :

> **Objet :** Your Easy Way trial ends on Tuesday
>
> Hello,
>
> I hope you are enjoying Easy Way. Your trial ends on Tuesday, and the subscription starts that day.
>
> If anything is not right, a short message is enough.
>
> Harold

En français :

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

Langue : anglais, par défaut (ni langue ni pays connus).

En anglais :

> **Objet :** Your Easy Way trial ends on Tuesday
>
> Hello,
>
> I hope you are enjoying Easy Way. Your trial ends on Tuesday, and the subscription starts that day.
>
> If anything is not right, a short message is enough.
>
> Harold

En français :

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

Langue : français, d'après l'app.

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

Langue : français, d'après l'app.

> **Objet :** Easy Way : quelque chose vous a bloqué ?
>
> Bonjour,
>
> Vous avez commencé à configurer Easy Way il y a quelques jours, sans aller jusqu'au bout. C'est souvent le moment où quelque chose bloque.
>
> Qu'est-ce qui vous a arrêté ? Une ligne en réponse suffit, et je vous aide à finir.
>
> Je ne vous relancerai pas à ce sujet.
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

Langue : français, d'après l'app.

> **Objet :** Quelques questions sur votre usage d'Easy Way
>
> Bonjour,
>
> Vous faites partie des personnes qui utilisent le plus Easy Way : merci. Je cherche à comprendre ce qui marche pour vous et ce qui manque, et j'aurais quelques questions :
>
> - Vous avez démarré 34 tournées, jusqu'à 22 arrêts : qu'est-ce que vous changez le plus souvent une fois en route ?
> - L'import depuis un fichier Excel a échoué 1 fois : qu'est-ce que vous essayiez d'importer ?
> - 2 optimisations de tournée n'ont pas abouti : vous souvenez-vous de ce qui coinçait ?
>
> Répondez seulement à celle qui vous parle, une ligne suffit.
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

Langue : français, d'après l'app.

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous nous avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> Il est corrigé dans la version 7.6.9, disponible sur l’App Store. Il suffit de mettre l'app à jour.
>
> Si vous le voyez encore, répondez à cet e-mail : je regarde moi-même.
>
> Merci de l'avoir signalé.
>
> Harold

#### Demande d’avis : envoyé

Langue : français, par défaut (ni langue ni pays connus).

> **Objet :** Votre avis sur Easy Way
>
> Bonjour,
>
> Votre problème est réglé depuis la version 7.6.9. Si Easy Way vous aide au quotidien, un avis sur l’App Store m'aiderait beaucoup :
> https://apps.apple.com/app/id6443783383?action=write-review
>
> Et s'il reste quelque chose qui vous gêne, répondez-moi.
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

Langue : français, d'après l'app.

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

## Chaque e-mail dans les six langues

### Bienvenue (scénario « Essai iOS utilisé, puis payé »)

En français :

> **Objet :** Bienvenue sur Easy Way
>
> Bonjour,
>
> Merci d'avoir installé Easy Way. J'ai créé l'app et je lis moi-même chaque réponse.
>
> Une seule question : qu'est-ce qui vous a fait installer Easy Way ? Une ligne en réponse à cet e-mail suffit.
>
> Harold

En anglais :

> **Objet :** Welcome to Easy Way
>
> Hello,
>
> Thank you for installing Easy Way. I built the app and I read every reply myself.
>
> One question: what made you install Easy Way? One line in reply to this email is enough.
>
> Harold

En allemand :

> **Objet :** Willkommen bei Easy Way
>
> Hallo,
>
> vielen Dank, dass Sie Easy Way installiert haben. Ich habe die App entwickelt und lese jede Antwort selbst.
>
> Nur eine Frage: Was hat Sie dazu gebracht, Easy Way zu installieren? Eine Zeile als Antwort auf diese E-Mail genügt.
>
> Harold

En espagnol :

> **Objet :** Le doy la bienvenida a Easy Way
>
> Hola:
>
> Gracias por instalar Easy Way. Yo he creado la app y leo personalmente cada respuesta.
>
> Una sola pregunta: ¿qué le llevó a instalar Easy Way? Basta con una línea en respuesta a este correo.
>
> Harold

En italien :

> **Objet :** Le do il benvenuto su Easy Way
>
> Buongiorno,
>
> Grazie per aver installato Easy Way. Ho creato io l'app e leggo di persona ogni risposta.
>
> Una sola domanda: cosa l'ha spinta a installare Easy Way? Basta una riga in risposta a questa e-mail.
>
> Harold

En portugais :

> **Objet :** Boas-vindas ao Easy Way
>
> Olá,
>
> Obrigado por instalar o Easy Way. Fui eu que criei a app e leio pessoalmente cada resposta.
>
> Uma só pergunta: o que o levou a instalar o Easy Way? Basta uma linha em resposta a este e-mail.
>
> Harold

### Rappel de fin d’essai (scénario « Essai iOS utilisé, puis payé »)

En français :

> **Objet :** Votre essai Easy Way se termine mardi
>
> Bonjour,
>
> J'espère qu'Easy Way vous plaît. Votre essai se termine mardi, et l'abonnement démarre ce jour-là.
>
> Si quelque chose ne va pas, un court message suffit.
>
> Harold

En anglais :

> **Objet :** Your Easy Way trial ends on Tuesday
>
> Hello,
>
> I hope you are enjoying Easy Way. Your trial ends on Tuesday, and the subscription starts that day.
>
> If anything is not right, a short message is enough.
>
> Harold

En allemand :

> **Objet :** Ihre Easy Way Testphase endet am Dienstag
>
> Hallo,
>
> ich hoffe, Easy Way gefällt Ihnen. Ihre Testphase endet am Dienstag, und an diesem Tag beginnt das Abo.
>
> Wenn etwas nicht passt, genügt eine kurze Nachricht.
>
> Harold

En espagnol :

> **Objet :** Su prueba de Easy Way termina el martes
>
> Hola:
>
> Espero que Easy Way le esté gustando. Su prueba termina el martes y ese día empieza la suscripción.
>
> Si algo no va bien, basta con un mensaje corto.
>
> Harold

En italien :

> **Objet :** La sua prova di Easy Way termina martedì
>
> Buongiorno,
>
> spero che Easy Way le piaccia. La sua prova termina martedì e quel giorno inizia l'abbonamento.
>
> Se qualcosa non va, basta un breve messaggio.
>
> Harold

En portugais :

> **Objet :** O seu teste do Easy Way termina na terça-feira
>
> Olá,
>
> Espero que esteja a gostar do Easy Way. O seu teste termina na terça-feira e nesse dia começa a assinatura.
>
> Se algo não estiver bem, basta uma mensagem curta.
>
> Harold

### Essai annulé, court (scénario « Essai annulé dans l’heure »)

En français :

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way, rien ne vous sera facturé.
>
> Qu'est-ce qui ne vous a pas convenu ? Une ligne en réponse m'aide beaucoup, je lis tout moi-même.
>
> Harold

En anglais :

> **Objet :** Your Easy Way trial
>
> Hello,
>
> You cancelled your Easy Way trial, you will not be charged.
>
> What didn't work for you? One line in reply helps me a lot, I read everything myself.
>
> Harold

En allemand :

> **Objet :** Ihr Easy Way Test
>
> Hallo,
>
> Sie haben Ihren Easy Way Test gekündigt, Ihnen wird nichts berechnet.
>
> Was hat für Sie nicht gepasst? Eine Zeile als Antwort hilft mir sehr, ich lese alles selbst.
>
> Harold

En espagnol :

> **Objet :** Su prueba de Easy Way
>
> Hola:
>
> Ha cancelado su prueba de Easy Way, no se le cobrará nada.
>
> ¿Qué no le convenció? Una línea en respuesta me ayuda mucho, leo todo yo mismo.
>
> Harold

En italien :

> **Objet :** La sua prova di Easy Way
>
> Buongiorno,
>
> Ha annullato la sua prova di Easy Way, non le verrà addebitato nulla.
>
> Che cosa non l'ha convinta? Una riga in risposta mi aiuta molto, leggo tutto io stesso.
>
> Harold

En portugais :

> **Objet :** O seu teste do Easy Way
>
> Olá,
>
> Cancelou o seu teste do Easy Way, não lhe será cobrado nada.
>
> O que não o convenceu? Uma linha em resposta ajuda-me muito, leio tudo eu próprio.
>
> Harold

### Essai annulé, avec sa réponse (scénario « Essai annulé avec une réponse au questionnaire »)

En français :

> **Objet :** Votre essai Easy Way
>
> Bonjour,
>
> Vous avez annulé votre essai d'Easy Way. C'est pris en compte : rien ne vous sera facturé.
>
> Vous avez lancé 6 tournées avec l'app en 5 semaines. En regardant de mon côté, je vois que beaucoup d'adresses n'ont pas été trouvées sur la carte. Dans l'app, vous avez indiqué que c'était trop cher. Vous avez écrit : « Je fais peu de tournées ».
>
> Pour quel prix, ou avec quoi de plus, l'app vous aurait-elle paru valoir le coup ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
>
> Harold

En anglais :

> **Objet :** Your Easy Way trial
>
> Hello,
>
> You cancelled your Easy Way trial. It is done: you will not be charged.
>
> You started 6 routes with the app over 5 weeks. Looking on my side, I can see that many addresses could not be found on the map. In the app, you said that it was too expensive. You wrote: "Je fais peu de tournées".
>
> At what price, or with what more, would the app have felt worth it?
>
> One line in reply is enough: it decides what I fix next. I will not write to you again about this.
>
> Harold

En allemand :

> **Objet :** Ihr Easy Way Test
>
> Hallo,
>
> Sie haben Ihren Easy Way Test gekündigt. Das ist erledigt: Ihnen wird nichts berechnet.
>
> Sie haben mit der App 6 Routen gestartet, in 5 Wochen. Auf meiner Seite sehe ich, dass viele Adressen auf der Karte nicht gefunden wurden. In der App haben Sie angegeben, dass es zu teuer war. Sie haben geschrieben: „Je fais peu de tournées“.
>
> Zu welchem Preis, oder mit was zusätzlich, wäre die App es Ihnen wert gewesen?
>
> Eine Zeile als Antwort genügt: Sie entscheidet, was ich als Nächstes verbessere. Ich schreibe Ihnen dazu keine weitere E-Mail.
>
> Harold

En espagnol :

> **Objet :** Su prueba de Easy Way
>
> Hola:
>
> Ha cancelado su prueba de Easy Way. Ya está hecho: no se le cobrará nada.
>
> Ha iniciado 6 rutas con la app en 5 semanas. Mirando por mi parte, veo que muchas direcciones no se encontraron en el mapa. En la app, indicó que era demasiado caro. Escribió: «Je fais peu de tournées».
>
> ¿A qué precio, o con qué más, le habría parecido que la app merecía la pena?
>
> Basta una línea como respuesta: es lo que decide lo que corrijo después. No le escribiré ningún otro correo sobre esto.
>
> Harold

En italien :

> **Objet :** La sua prova di Easy Way
>
> Buongiorno,
>
> Ha annullato la sua prova di Easy Way. È fatto: non le verrà addebitato nulla.
>
> Ha avviato 6 percorsi con l'app in 5 settimane. Guardando dalla mia parte, vedo che molti indirizzi non sono stati trovati sulla mappa. Nell'app ha indicato che era troppo caro. Ha scritto: «Je fais peu de tournées».
>
> A quale prezzo, o con che cosa in più, l'app le sarebbe sembrata valerne la pena?
>
> Basta una riga in risposta: è ciò che decide cosa correggo dopo. Non le scriverò altre e-mail su questo.
>
> Harold

En portugais :

> **Objet :** O seu teste do Easy Way
>
> Olá,
>
> Cancelou o seu teste do Easy Way. Está feito: não lhe será cobrado nada.
>
> Iniciou 6 rotas com a app em 5 semanas. Vendo do meu lado, percebo que muitas moradas não foram encontradas no mapa. Na app, indicou que era demasiado caro. Escreveu: «Je fais peu de tournées».
>
> A que preço, ou com o que mais, a app lhe teria parecido valer a pena?
>
> Basta uma linha como resposta: é isso que decide o que corrijo a seguir. Não lhe voltarei a escrever sobre isto.
>
> Harold

### Résiliation, modèle (scénario « Résiliation, sans dossier lisible »)

En français :

> **Objet :** Votre abonnement Easy Way est arrêté
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Une seule question, si vous avez une minute : qu'est-ce qui vous a fait partir ? Une ligne en réponse suffit. C'est ce qui décide de ce que je corrige ensuite.
>
> Je ne vous écrirai pas d'autre e-mail à ce sujet.
>
> Harold

En anglais :

> **Objet :** Your Easy Way subscription is cancelled
>
> Hello,
>
> You cancelled your Easy Way subscription. It is done, there is nothing else to do.
>
> One question, if you have a minute: what made you leave? One line in reply is enough. It decides what I fix next.
>
> I will not write to you again about this.
>
> Harold

En allemand :

> **Objet :** Ihr Easy Way Abo ist gekündigt
>
> Hallo,
>
> Sie haben Ihr Abo von Easy Way gekündigt. Das ist erledigt, Sie müssen nichts weiter tun.
>
> Nur eine Frage, wenn Sie eine Minute haben: Warum haben Sie gekündigt? Eine Zeile als Antwort genügt. Sie entscheidet, was ich als Nächstes verbessere.
>
> Ich schreibe Ihnen dazu keine weitere E-Mail.
>
> Harold

En espagnol :

> **Objet :** Su suscripción a Easy Way está cancelada
>
> Hola:
>
> Ha cancelado su suscripción a Easy Way. Ya está hecho, no tiene que hacer nada más.
>
> Solo una pregunta, si tiene un minuto: ¿qué le hizo irse? Basta una línea como respuesta. Es lo que decide lo que corrijo después.
>
> No le escribiré ningún otro correo sobre esto.
>
> Harold

En italien :

> **Objet :** Il suo abbonamento a Easy Way è disdetto
>
> Buongiorno,
>
> Ha disdetto il suo abbonamento a Easy Way. È fatto, non deve fare altro.
>
> Una sola domanda, se ha un minuto: che cosa l'ha fatta andare via? Basta una riga in risposta. È ciò che decide cosa correggo dopo.
>
> Non le scriverò altre e-mail su questo.
>
> Harold

En portugais :

> **Objet :** A sua assinatura do Easy Way foi cancelada
>
> Olá,
>
> Cancelou a sua assinatura do Easy Way. Está feito, não precisa de fazer mais nada.
>
> Só uma pergunta, se tiver um minuto: o que o fez sair? Basta uma linha como resposta. É isso que decide o que corrijo a seguir.
>
> Não lhe voltarei a escrever sobre isto.
>
> Harold

### Résiliation, depuis le dossier (scénario « Résiliation, avec une réponse au questionnaire »)

En français :

> **Objet :** Votre abonnement Easy Way
>
> Bonjour,
>
> Vous avez arrêté votre abonnement à Easy Way. C'est pris en compte, vous n'avez rien d'autre à faire.
>
> Vous avez lancé 9 tournées avec l'app en 4 semaines. Dans l'app, vous avez indiqué qu'il vous manquait des fonctions. Vous avez écrit : « Pas de tournée sur plusieurs jours ».
>
> Quelle fonction vous a le plus manqué ?
>
> Une ligne en réponse suffit : c'est ce qui décide de ce que je corrige ensuite. Je ne vous écrirai pas d'autre e-mail à ce sujet.
>
> Harold

En anglais :

> **Objet :** Your Easy Way subscription
>
> Hello,
>
> You cancelled your Easy Way subscription. It is done, there is nothing else to do.
>
> You started 9 routes with the app over 4 weeks. In the app, you said that some features were missing. You wrote: "Pas de tournée sur plusieurs jours".
>
> Which feature did you miss the most?
>
> One line in reply is enough: it decides what I fix next. I will not write to you again about this.
>
> Harold

En allemand :

> **Objet :** Ihr Easy Way Abo
>
> Hallo,
>
> Sie haben Ihr Abo von Easy Way gekündigt. Das ist erledigt, Sie müssen nichts weiter tun.
>
> Sie haben mit der App 9 Routen gestartet, in 4 Wochen. In der App haben Sie angegeben, dass Ihnen Funktionen gefehlt haben. Sie haben geschrieben: „Pas de tournée sur plusieurs jours“.
>
> Welche Funktion hat Ihnen am meisten gefehlt?
>
> Eine Zeile als Antwort genügt: Sie entscheidet, was ich als Nächstes verbessere. Ich schreibe Ihnen dazu keine weitere E-Mail.
>
> Harold

En espagnol :

> **Objet :** Su suscripción a Easy Way
>
> Hola:
>
> Ha cancelado su suscripción a Easy Way. Ya está hecho, no tiene que hacer nada más.
>
> Ha iniciado 9 rutas con la app en 4 semanas. En la app, indicó que le faltaban funciones. Escribió: «Pas de tournée sur plusieurs jours».
>
> ¿Qué función echó más de menos?
>
> Basta una línea como respuesta: es lo que decide lo que corrijo después. No le escribiré ningún otro correo sobre esto.
>
> Harold

En italien :

> **Objet :** Il suo abbonamento a Easy Way
>
> Buongiorno,
>
> Ha disdetto il suo abbonamento a Easy Way. È fatto, non deve fare altro.
>
> Ha avviato 9 percorsi con l'app in 4 settimane. Nell'app ha indicato che mancavano delle funzioni. Ha scritto: «Pas de tournée sur plusieurs jours».
>
> Quale funzione le è mancata di più?
>
> Basta una riga in risposta: è ciò che decide cosa correggo dopo. Non le scriverò altre e-mail su questo.
>
> Harold

En portugais :

> **Objet :** A sua assinatura do Easy Way
>
> Olá,
>
> Cancelou a sua assinatura do Easy Way. Está feito, não precisa de fazer mais nada.
>
> Iniciou 9 rotas com a app em 4 semanas. Na app, indicou que faltavam funções. Escreveu: «Pas de tournée sur plusieurs jours».
>
> Que função lhe fez mais falta?
>
> Basta uma linha como resposta: é isso que decide o que corrijo a seguir. Não lhe voltarei a escrever sobre isto.
>
> Harold

### Onboarding abandonné (scénario « Compte de test du fondateur »)

En français :

> **Objet :** Easy Way : quelque chose vous a bloqué ?
>
> Bonjour,
>
> Vous avez commencé à configurer Easy Way il y a quelques jours, sans aller jusqu'au bout. C'est souvent le moment où quelque chose bloque.
>
> Qu'est-ce qui vous a arrêté ? Une ligne en réponse suffit, et je vous aide à finir.
>
> Je ne vous relancerai pas à ce sujet.
>
> Harold

En anglais :

> **Objet :** Easy Way: did something get in the way?
>
> Hello,
>
> You started setting up Easy Way a few days ago, without getting to the end. That is often where something gets in the way.
>
> What stopped you? One line in reply is enough, and I will help you finish.
>
> I will not follow up on this again.
>
> Harold

En allemand :

> **Objet :** Easy Way: Hat Sie etwas aufgehalten?
>
> Hallo,
>
> Sie haben vor ein paar Tagen begonnen, Easy Way einzurichten, aber nicht bis zum Ende. Oft hakt es genau an dieser Stelle.
>
> Was hat Sie aufgehalten? Eine Zeile als Antwort genügt, und ich helfe Ihnen, es abzuschließen.
>
> Ich schreibe Ihnen dazu kein weiteres Mal.
>
> Harold

En espagnol :

> **Objet :** Easy Way: ¿algo le ha frenado?
>
> Hola:
>
> Empezó a configurar Easy Way hace unos días, sin llegar hasta el final. Suele ser el momento en que algo se atasca.
>
> ¿Qué le ha frenado? Basta con una línea de respuesta, y le ayudo a terminar.
>
> No volveré a escribirle sobre esto.
>
> Harold

En italien :

> **Objet :** Easy Way: qualcosa l’ha bloccata?
>
> Buongiorno,
>
> Ha iniziato a configurare Easy Way qualche giorno fa, senza arrivare alla fine. Spesso è il momento in cui qualcosa si blocca.
>
> Cosa l’ha fermata? Basta una riga di risposta, e la aiuto a finire.
>
> Non le scriverò di nuovo su questo.
>
> Harold

En portugais :

> **Objet :** Easy Way: alguma coisa o travou?
>
> Olá,
>
> Começou a configurar o Easy Way há alguns dias, sem chegar ao fim. É muitas vezes o momento em que alguma coisa encrava.
>
> O que o fez parar? Basta uma linha em resposta, e eu ajudo-o a terminar.
>
> Não voltarei a escrever-lhe sobre isto.
>
> Harold

### Bug corrigé (scénario « Compte de test du fondateur »)

En français :

> **Objet :** Le problème que vous avez signalé est corrigé
>
> Bonjour,
>
> Vous nous avez signalé un problème dans Easy Way : la carte restait vide après un import.
>
> Il est corrigé dans la version 7.6.9, disponible sur l’App Store. Il suffit de mettre l'app à jour.
>
> Si vous le voyez encore, répondez à cet e-mail : je regarde moi-même.
>
> Merci de l'avoir signalé.
>
> Harold

En anglais :

> **Objet :** The problem you reported is fixed
>
> Hello,
>
> You reported a problem in Easy Way: la carte restait vide après un import.
>
> It is fixed in version 7.6.9, available on the App Store. Just update the app.
>
> If you still see it, reply to this email: I will look into it myself.
>
> Thank you for reporting it.
>
> Harold

En allemand :

> **Objet :** Das gemeldete Problem ist behoben
>
> Hallo,
>
> Sie haben uns ein Problem in Easy Way gemeldet: la carte restait vide après un import.
>
> Es ist in Version 7.6.9 behoben, ab sofort im App Store verfügbar. Aktualisieren Sie einfach die App.
>
> Wenn Sie es noch sehen, antworten Sie auf diese E-Mail: Ich sehe es mir selbst an.
>
> Danke für Ihre Meldung.
>
> Harold

En espagnol :

> **Objet :** El problema que nos indicó está corregido
>
> Hola:
>
> Nos indicó un problema en Easy Way: la carte restait vide après un import.
>
> Está corregido en la versión 7.6.9, ya disponible en el App Store. Solo tiene que actualizar la app.
>
> Si todavía lo ve, responda a este correo: lo reviso yo mismo.
>
> Gracias por avisarnos.
>
> Harold

En italien :

> **Objet :** Il problema che ci ha segnalato è risolto
>
> Buongiorno,
>
> Ci ha segnalato un problema in Easy Way: la carte restait vide après un import.
>
> È risolto nella versione 7.6.9, disponibile nell’App Store. Basta aggiornare l'app.
>
> Se lo vede ancora, risponda a questa e-mail: controllo di persona.
>
> Grazie per la segnalazione.
>
> Harold

En portugais :

> **Objet :** O problema que nos indicou está corrigido
>
> Olá,
>
> Indicou-nos um problema no Easy Way: la carte restait vide après un import.
>
> Está corrigido na versão 7.6.9, já disponível na App Store. Basta atualizar a app.
>
> Se ainda o vir, responda a este e-mail: eu próprio vou ver.
>
> Obrigado por nos avisar.
>
> Harold

### Gros utilisateur (scénario « Gros utilisateur »)

En français :

> **Objet :** Quelques questions sur votre usage d'Easy Way
>
> Bonjour,
>
> Vous faites partie des personnes qui utilisent le plus Easy Way : merci. Je cherche à comprendre ce qui marche pour vous et ce qui manque, et j'aurais quelques questions :
>
> - Vous avez démarré 34 tournées, jusqu'à 22 arrêts : qu'est-ce que vous changez le plus souvent une fois en route ?
> - L'import depuis un fichier Excel a échoué 1 fois : qu'est-ce que vous essayiez d'importer ?
> - 2 optimisations de tournée n'ont pas abouti : vous souvenez-vous de ce qui coinçait ?
>
> Répondez seulement à celle qui vous parle, une ligne suffit.
>
> Harold

En anglais :

> **Objet :** A few questions about how you use Easy Way
>
> Hello,
>
> You are one of the people who use Easy Way the most: thank you. I want to understand what works for you and what is missing, and I have a few questions:
>
> - You have started 34 routes, with up to 22 stops: what do you change most often once on the road?
> - Importing from an Excel file failed 1 time: what were you trying to import?
> - 2 route optimisations did not go through: do you remember what went wrong?
>
> Just answer the one that speaks to you, one line is enough.
>
> Harold

En allemand :

> **Objet :** Ein paar Fragen dazu, wie Sie Easy Way nutzen
>
> Hallo,
>
> Sie gehören zu den Menschen, die Easy Way am meisten nutzen: danke. Ich möchte verstehen, was für Sie funktioniert und was fehlt, und hätte ein paar Fragen:
>
> - Sie haben 34 Routen gestartet, mit bis zu 22 Stopps: Was ändern Sie unterwegs am häufigsten?
> - Der Import aus einer Excel-Datei ist 1-mal fehlgeschlagen: Was wollten Sie importieren?
> - 2 Routenoptimierungen sind nicht durchgelaufen: Erinnern Sie sich, woran es hakte?
>
> Beantworten Sie nur die Frage, die Sie anspricht, eine Zeile genügt.
>
> Harold

En espagnol :

> **Objet :** Algunas preguntas sobre cómo usa Easy Way
>
> Hola:
>
> Usted es una de las personas que más usan Easy Way: gracias. Quiero entender qué le funciona y qué le falta, y tengo algunas preguntas:
>
> - Ha iniciado 34 rutas, con hasta 22 paradas: ¿qué es lo que más cambia una vez en camino?
> - La importación desde un archivo Excel ha fallado 1 vez: ¿qué intentaba importar?
> - 2 optimizaciones de ruta no han funcionado: ¿recuerda qué fallaba?
>
> Responda solo a la que le interese, basta con una línea.
>
> Harold

En italien :

> **Objet :** Qualche domanda su come usa Easy Way
>
> Buongiorno,
>
> Lei è tra le persone che usano di più Easy Way: grazie. Vorrei capire cosa funziona per lei e cosa manca, e avrei qualche domanda:
>
> - Ha avviato 34 percorsi, fino a 22 tappe: cosa cambia più spesso una volta in strada?
> - L'importazione da un file Excel non è riuscita 1 volta: cosa stava cercando di importare?
> - 2 ottimizzazioni del percorso non sono andate a buon fine: ricorda cosa non funzionava?
>
> Risponda solo a quella che le interessa, basta una riga.
>
> Harold

En portugais :

> **Objet :** Algumas perguntas sobre como usa o Easy Way
>
> Olá,
>
> É uma das pessoas que mais usam o Easy Way: obrigado. Quero perceber o que funciona para si e o que falta, e tenho algumas perguntas:
>
> - Iniciou 34 rotas, com até 22 paragens: o que muda mais vezes quando já está a caminho?
> - A importação a partir de um ficheiro Excel falhou 1 vez: o que estava a tentar importar?
> - 2 otimizações de rota não funcionaram: lembra-se do que correu mal?
>
> Responda só à que lhe diz alguma coisa, basta uma linha.
>
> Harold

### Demande d’avis (scénario « Bug corrigé, puis demande d’avis »)

En français :

> **Objet :** Votre avis sur Easy Way
>
> Bonjour,
>
> Votre problème est réglé depuis la version 7.6.9. Si Easy Way vous aide au quotidien, un avis sur l’App Store m'aiderait beaucoup :
> https://apps.apple.com/app/id6443783383?action=write-review
>
> Et s'il reste quelque chose qui vous gêne, répondez-moi.
>
> Harold

En anglais :

> **Objet :** Your review of Easy Way
>
> Hello,
>
> Your issue has been fixed since version 7.6.9. If Easy Way helps you day to day, a review on the App Store would help me a lot:
> https://apps.apple.com/app/id6443783383?action=write-review
>
> And if anything still bothers you, just reply.
>
> Harold

En allemand :

> **Objet :** Ihre Bewertung von Easy Way
>
> Hallo,
>
> Ihr Problem ist seit Version 7.6.9 behoben. Wenn Easy Way Ihnen im Alltag hilft, würde mir eine Bewertung im App Store sehr helfen:
> https://apps.apple.com/app/id6443783383?action=write-review
>
> Und wenn Sie noch etwas stört, antworten Sie mir einfach.
>
> Harold

En espagnol :

> **Objet :** Su opinión sobre Easy Way
>
> Hola:
>
> Su problema está resuelto desde la versión 7.6.9. Si Easy Way le ayuda en su día a día, una reseña en el App Store me ayudaría mucho:
> https://apps.apple.com/app/id6443783383?action=write-review
>
> Y si algo todavía le molesta, respóndame.
>
> Harold

En italien :

> **Objet :** La sua opinione su Easy Way
>
> Buongiorno,
>
> Il suo problema è risolto dalla versione 7.6.9. Se Easy Way la aiuta ogni giorno, una recensione nell’App Store mi aiuterebbe molto:
> https://apps.apple.com/app/id6443783383?action=write-review
>
> E se qualcosa le dà ancora fastidio, mi risponda.
>
> Harold

En portugais :

> **Objet :** A sua opinião sobre o Easy Way
>
> Olá,
>
> O seu problema está resolvido desde a versão 7.6.9. Se o Easy Way o ajuda no dia a dia, uma avaliação na App Store ajudar-me-ia muito:
> https://apps.apple.com/app/id6443783383?action=write-review
>
> E se ainda houver algo que o incomode, responda-me.
>
> Harold
