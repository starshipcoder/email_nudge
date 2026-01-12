# Easy Way - Email Nudge System

## Overview

Système d'emails automatisés pour engager les utilisateurs Easy Way à chaque étape de leur parcours.

**Objectifs :**
- Collecter du feedback (pas juste relancer)
- Accompagner le parcours utilisateur
- Réduire le churn
- Approche personnelle (reply simple, signé Harold)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     FIREBASE                        │
│  - Firestore (users, email_queue, email_logs)      │
│  - Analytics (events)                               │
│  - Cloud Functions (triggers & scheduling)          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   REVENUECAT                        │
│  - Webhooks (subscription_cancel, trial_started)   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                     RESEND                          │
│  - Envoi emails                                     │
│  - From: harold@easyway.app                        │
└─────────────────────────────────────────────────────┘
```

---

## Sub-Segments

### Roles

| Sub-segment | Condition |
|-------------|-----------|
| `delivery` | role = livreur |
| `field_sales` | role = commercial_terrain |
| `technician` | role = technicien |
| `sales_director` | role = directeur_commercial (traité comme field_sales + mention partage) |
| `role_other` | role = autre |

### Needs (Priority Order)

| Priority | Sub-segment | Condition | Label FR |
|----------|-------------|-----------|----------|
| 1 | `hotel` | besoins contains "hotel_search" | "les hôtels" |
| 2 | `prospection` | besoins contains "new_clients" | "la prospection" |
| 3 | `complex` | besoins contains "complex_routes" | "les tournées complexes" |
| 4 | `max_visits` | besoins contains "max_visits" | "tes visites" |
| 5 | `multi_day` | besoins contains "multi_day" | "la planification" |
| 6 | `tracking` | besoins contains "client_tracking" | "le suivi clients" |

### Engagement

| Sub-segment | Condition |
|-------------|-----------|
| `no_route` | routes_created = 0 |
| `has_route` | routes_created >= 1 |
| `no_optimization` | routes_optimized = 0 |

### Churn

| Sub-segment | Condition |
|-------------|-----------|
| `churned_silent` | churned + churn_reason = null |
| `churned_with_feedback` | churned + churn_reason exists |

---

## Emails

### 1. WhatsMissing

**Trigger :** Abandon onboarding
**Timing :** 1h après
**Objectif :** Comprendre ce qui a manqué

| Segment | Condition | Objet |
|---------|-----------|-------|
| `WhatsMissing__hotel` | need=hotel | "Une question sur les hôtels" |
| `WhatsMissing__prospection` | need=prospection | "Une question sur la prospection" |
| `WhatsMissing__complex` | need=complex | "Une question sur tes tournées" |
| `WhatsMissing__delivery` | role=delivery | "Une question sur tes livraisons" |
| `WhatsMissing__technician` | role=technician | "Une question sur tes interventions" |
| `WhatsMissing__default` | fallback | "Une question rapide" |

**Template WhatsMissing__hotel :**
```
Objet : Une question sur les hôtels

Hey{{prenom| }},

Tu cherchais un truc pour trouver des hôtels sur tes trajets ?

Dis-moi ce qui t'a manqué — je lis tout.

— Harold, créateur de Easy Way
```

**Template WhatsMissing__prospection :**
```
Objet : Une question sur la prospection

Hey{{prenom| }},

Tu cherchais à trouver de nouveaux clients plus facilement ?

Qu'est-ce qui t'a manqué ? Réponds-moi en 2 mots.

— Harold, créateur de Easy Way
```

**Template WhatsMissing__complex :**
```
Objet : Une question sur tes tournées

Hey{{prenom| }},

Tu voulais créer des tournées multi-stops ?

Dis-moi ce qui a coincé.

— Harold, créateur de Easy Way
```

**Template WhatsMissing__delivery :**
```
Objet : Une question sur tes livraisons

Hey{{prenom| }},

Tu cherchais à optimiser tes tournées de livraison ?

Qu'est-ce qui t'a bloqué ?

— Harold, créateur de Easy Way
```

**Template WhatsMissing__technician :**
```
Objet : Une question sur tes interventions

Hey{{prenom| }},

Tu cherchais à mieux organiser tes interventions terrain ?

Dis-moi ce qui a manqué.

— Harold, créateur de Easy Way
```

**Template WhatsMissing__default :**
```
Objet : Une question rapide

Hey{{prenom| }},

T'as commencé à configurer Easy Way mais t'es pas allé au bout.

Qu'est-ce qui t'a manqué ?

— Harold, créateur de Easy Way
```

---

### 2. FreeOptions

**Trigger :** Paywall bloqué (quitte sans passer)
**Timing :** 10 min après
**Objectif :** Transparence + collecter feedback

| Segment | Condition | Objet |
|---------|-----------|-------|
| `FreeOptions` | paywall_blocked | "3 façons gratuites de créer tes tournées" |

**Template FreeOptions :**
```
Objet : 3 façons gratuites de créer tes tournées

Hey{{prenom| }},

Pas de souci si t'as pas pris l'essai.

Tu peux créer tes tournées sans nous :
• Google Maps → limité à 10 stops
• Excel + copier-coller → ça marche, mais long
• Autres apps → souvent payantes aussi

Si c'est autre chose qui t'a bloqué, dis-moi.

— Harold, créateur de Easy Way
```

---

### 3. QuickStart

**Trigger :** Paywall passé (trial ou paiement)
**Timing :** Immédiat
**Objectif :** Guider le premier pas

| Segment | Condition | Objet |
|---------|-----------|-------|
| `QuickStart__delivery` | role=delivery | "Prêt à optimiser tes livraisons" |
| `QuickStart__prospection` | need=prospection | "Trouve tes prochains clients" |
| `QuickStart__tracking` | need=tracking | "Tes clients, mieux organisés" |
| `QuickStart__technician` | role=technician | "Tes interventions, optimisées" |
| `QuickStart__default` | fallback | "Bienvenue sur Easy Way" |

**Template QuickStart__delivery :**
```
Objet : Prêt à optimiser tes livraisons

Hey{{prenom| }},

Bienvenue sur Easy Way !

Pour démarrer en 2 min :
1. Ajoute tes adresses de livraison
2. Clique sur "Optimiser"
3. C'est parti

{{#if role == sales_director}}
💡 Tu peux aussi partager tes tournées avec ton équipe.
{{/if}}

Un souci ? Réponds-moi.

— Harold, créateur de Easy Way
```

**Template QuickStart__prospection :**
```
Objet : Trouve tes prochains clients

Hey{{prenom| }},

Bienvenue sur Easy Way !

Pour démarrer :
1. Importe tes prospects (CSV ou manuel)
2. Crée une tournée de prospection
3. Optimise ton trajet

{{#if role == sales_director}}
💡 Tu peux partager les tournées avec ton équipe.
{{/if}}

Besoin d'aide ? Réponds-moi.

— Harold, créateur de Easy Way
```

**Template QuickStart__tracking :**
```
Objet : Tes clients, mieux organisés

Hey{{prenom| }},

Bienvenue sur Easy Way !

Pour démarrer :
1. Importe tes clients existants
2. Planifie tes visites
3. Suis ton historique

{{#if role == sales_director}}
💡 Tu peux partager les tournées avec ton équipe.
{{/if}}

Un souci ? Réponds-moi.

— Harold, créateur de Easy Way
```

**Template QuickStart__technician :**
```
Objet : Tes interventions, optimisées

Hey{{prenom| }},

Bienvenue sur Easy Way !

Pour démarrer :
1. Ajoute tes interventions du jour
2. Optimise ton trajet
3. Gagne du temps sur la route

Un problème ? Réponds-moi.

— Harold, créateur de Easy Way
```

**Template QuickStart__default :**
```
Objet : Bienvenue sur Easy Way

Hey{{prenom| }},

Content de t'avoir !

Pour créer ta première tournée :
1. Ajoute tes adresses
2. Clique sur "Optimiser"
3. C'est parti

Besoin d'aide ? Réponds-moi.

— Harold, créateur de Easy Way
```

---

### 4. NeedHelp

**Trigger :** 24h après paywall passé, aucune action significative
**Timing :** 24h
**Objectif :** Débloquer si stuck

| Segment | Condition | Objet |
|---------|-----------|-------|
| `NeedHelp__no_route` | routes_created = 0 | "Besoin d'un coup de main ?" |
| `NeedHelp__no_optimization` | has_route + routes_optimized = 0 | "T'as créé une tournée !" |

**Template NeedHelp__no_route :**
```
Objet : Besoin d'un coup de main ?

Hey{{prenom| }},

J'ai vu que t'as pas encore créé de tournée.

Bloqué quelque part ? Dis-moi.

— Harold, créateur de Easy Way
```

**Template NeedHelp__no_optimization :**
```
Objet : T'as créé une tournée !

Hey{{prenom| }},

Nice, t'as créé ta première tournée !

T'as pensé à l'optimiser ? Un clic et on te fait gagner du temps.

Besoin d'aide ? Réponds-moi.

— Harold, créateur de Easy Way
```

---

### 5. NeedHelpWith

**Trigger :** 48h après paywall passé, toujours pas de tournée
**Timing :** 48h
**Objectif :** Rappeler ses besoins, offrir aide

| Segment | Condition | Objet |
|---------|-----------|-------|
| `NeedHelpWith` | no_route + 48h | "Un coup de main sur {{primary_need_label}} ?" |

**Template NeedHelpWith :**
```
Objet : Un coup de main sur {{primary_need_label}} ?

Hey{{prenom| }},

T'as pas encore créé de tournée.

Tu voulais :
{{#each needs}}
• {{need_label}}
{{/each}}

Besoin d'aide sur un de ces sujets ? Réponds-moi, je te guide.

— Harold, créateur de Easy Way
```

---

### 6. TrialEndsSoon

**Trigger :** J-2 avant fin de trial
**Timing :** 2 jours avant fin
**Objectif :** Rappel friendly + feedback
**Note :** TOUJOURS envoyé (même si has_replied)

| Segment | Condition | Objet |
|---------|-----------|-------|
| `TrialEndsSoon` | trial_ending | "Ton essai se termine dans {{days_remaining}} jours" |

**Template TrialEndsSoon :**
```
Objet : Ton essai se termine dans {{days_remaining}} jours

Hey{{prenom| }},

Rappel friendly : ton essai Easy Way se termine dans {{days_remaining}} jours.

Tu penses quoi de l'app ? Dis-moi en 2 mots.

— Harold, créateur de Easy Way
```

---

### 7. WhyLeaving

**Trigger :** Churn (cancel in-app ou RevenueCat webhook)
**Timing :** 30 min après
**Objectif :** Comprendre pourquoi
**Note :** Déduplication via `email_whyleaving_sent` flag

| Segment | Condition | Objet |
|---------|-----------|-------|
| `WhyLeaving__silent` | churned + no churn_reason | "Une question avant de partir" |
| `WhyLeaving__with_feedback` | churned + churn_reason exists | "Merci pour ton retour" |

**Template WhyLeaving__silent :**
```
Objet : Une question avant de partir

Hey{{prenom| }},

J'ai vu que t'as arrêté ton abonnement.

Pas de souci — mais ça m'aiderait de comprendre pourquoi.

Réponds-moi en 2 mots, je lis tout.

— Harold, créateur de Easy Way
```

**Template WhyLeaving__with_feedback :**
```
Objet : Merci pour ton retour

Hey{{prenom| }},

Merci d'avoir pris le temps de donner ton avis.

Tu as mentionné : "{{churn_reason}}"

Si tu veux développer, je suis là.

Bonne continuation !

— Harold, créateur de Easy Way
```

---

## Récap Emails

| # | Email | Trigger | Timing | Segments |
|---|-------|---------|--------|----------|
| 1 | WhatsMissing | Abandon onboarding | 1h | 6 |
| 2 | FreeOptions | Paywall bloqué | 10min | 1 |
| 3 | QuickStart | Paywall passé | Immédiat | 5 |
| 4 | NeedHelp | Pas d'action | 24h | 2 |
| 5 | NeedHelpWith | Toujours pas de route | 48h | 1 |
| 6 | TrialEndsSoon | Fin trial proche | J-2 | 1 |
| 7 | WhyLeaving | Churn | 30min | 2 |
| **Total** | | | | **18** |

---

## Timings Récap

| Email | Timing |
|-------|--------|
| WhatsMissing | 1h |
| FreeOptions | 10min |
| QuickStart | Immédiat |
| NeedHelp | 24h |
| NeedHelpWith | 48h |
| TrialEndsSoon | J-2 (TOUJOURS) |
| WhyLeaving | 30min |

---

## Règles Système

### Kill Switch
- Si `has_replied = true` → STOP séquence (sauf TrialEndsSoon)

### Déduplication WhyLeaving
- Deux sources possibles : Firebase event `user_cancelled` OU RevenueCat webhook
- Flag `email_whyleaving_sent` pour éviter doublon
- Premier event = email envoyé, deuxième = ignoré

### Segment Priority
- Need > Role pour les emails basés sur le contenu
- Si plusieurs needs → prendre le plus prioritaire (hotel > prospection > complex > ...)

### sales_director
- Traité comme `field_sales`
- Ajouter mention "partage de tournée" dans QuickStart

---

## Firebase Events

| Event | Quand | Déclenche |
|-------|-------|-----------|
| `onboarding_dropped` | Quitte avant fin onboarding | WhatsMissing (1h) |
| `paywall_blocked` | Quitte au paywall | FreeOptions (10min) |
| `paywall_passed` | Passe le paywall | QuickStart (immédiat) |
| `trial_started` | Début trial | Schedule NeedHelp (24h), NeedHelpWith (48h) |
| `route_created` | Crée une tournée | Cancel NeedHelp/NeedHelpWith si pending |
| `route_optimized` | Optimise une tournée | - |
| `user_cancelled` | Cancel in-app | WhyLeaving (30min) |

---

## Firestore Collections

```
users/{user_id}
  - email, prenom, role, needs[]
  - onboarding_complete, paywall_seen, paywall_passed
  - routes_created, routes_optimized, prospects_added
  - trial_active, trial_start_date, trial_end_date
  - churned_at, churn_reason
  - email_whyleaving_sent, has_replied, is_test_user

email_queue/{queue_id}
  - user_id, email_name, segment, send_at, variables

email_logs/{log_id}
  - user_id, email_name, segment
  - scheduled_at, sent_at, status, blocked_reason
  - variables
```

---

## Tests

### Unit Tests
- Segment resolution (priority, conditions)
- Kill switch logic
- Deduplication logic
- Template variable rendering

### Instrumented Tests
- Full flow: event → Cloud Function → email sent
- Timing delays (with test user time multiplier)
- RevenueCat webhook handling

---

## Service Email

**Resend**
- 3000 emails/mois gratuits
- From: `harold@easyway.app`
- Simple API, TypeScript SDK

---

## Next Steps

1. [ ] Setup Firebase Cloud Functions
2. [ ] Setup Resend account + domain verification
3. [ ] Implement segment resolver
4. [ ] Implement email templates
5. [ ] Implement Cloud Functions triggers
6. [ ] Write unit tests
7. [ ] Write instrumented tests
8. [ ] Test with test users
9. [ ] Deploy
