# Email Nudge - Spécification Technique

## Vue d'ensemble

Système d'emails automatisés pour Easy Way, basé sur le comportement utilisateur. Les emails sont générés par IA (Claude Haiku) et personnalisés selon le profil utilisateur.

**Objectifs :**
- Collecter du feedback (pas juste relancer)
- Accompagner le parcours utilisateur
- Réduire le churn
- Approche personnelle (reply simple, signé Harold)

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   App iOS   │────▶│  Firestore       │────▶│  Cloud      │
│   /Android  │     │  (email-nudge)   │     │  Functions  │
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                     │
┌─────────────┐                                      │
│  RevenueCat │──────────────────────────────────────┤
│  Webhooks   │                                      │
└─────────────┘                                      ▼
                                              ┌──────────────┐
                                              │   Anthropic  │
                                              │   (Haiku)    │
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │    Resend    │
                                              └──────────────┘
```

**Base Firestore** : `email-nudge` (base nommée, pas default)

---

## Events attendus de l'app

| Champ | Type | Quand |
|-------|------|-------|
| `email` | string | Premier écran onboarding |
| `locale` | string | Premier écran (device locale : fr, en, es, de, it, pt, nl) |
| `onboarding_started_at` | Timestamp | Premier écran onboarding |
| `role` | string | Pendant onboarding |
| `needs` | string[] | Pendant onboarding |
| `onboarding_complete` | boolean | Fin onboarding (true) |
| `paywall_seen` | boolean | Paywall affiché (true) |
| `paywall_abandoned` | boolean | User ferme paywall sans action (true) |
| `has_added_visits` | boolean | User a ajouté au moins une visite (true) |
| `routes_optimized` | number | +1 à chaque optimisation |

### Valeurs possibles

**role** :
- `delivery`
- `field_sales`
- `technician`
- `sales_director`
- `other`

**needs** :
- `max_visits`
- `client_tracking`
- `complex_routes`
- `multi_day`
- `hotel_search`
- `new_clients`

**locale** :
- `fr` (français - défaut)
- `en` (anglais)
- `es` (espagnol)
- `de` (allemand)
- `it` (italien)
- `pt` (portugais)
- `nl` (néerlandais)

---

## Géré automatiquement (backend)

| Champ | Source |
|-------|--------|
| `onboarding_dropped` | Cron (1h après start sans complete) |
| `trial_active` | RevenueCat webhook |
| `trial_start_date` | RevenueCat webhook |
| `trial_end_date` | RevenueCat webhook |
| `subscription_active` | RevenueCat webhook |
| `plan` | RevenueCat webhook |
| `churned_at` | RevenueCat webhook |

---

## Emails et déclencheurs

| Email | Déclencheur | Délai | Segments |
|-------|-------------|-------|----------|
| **WhatsMissing** | `onboarding_dropped: true` (calculé) | 1h | hotel, prospection, complex, delivery, technician, default |
| **FreeOptions** | `paywall_abandoned: true` | 10min | unique |
| **QuickStart** | `trial_active: true` | immédiat | delivery, prospection, tracking, technician, default |
| **NeedHelp** | `trial_active: true` | 24h | no_visits, no_optimization |
| **NeedHelpWith** | `trial_active: true` | 48h | unique |
| **TrialEndsSoon** | Cron quotidien 9h | J-2 | unique |
| **WhyLeaving** | `churned_at` défini | 30min | silent, with_feedback |

---

## Logique de segmentation

### WhatsMissing (priorité : need > role)

```
hotel_search      → WhatsMissing__hotel
new_clients       → WhatsMissing__prospection
complex_routes    → WhatsMissing__complex
role=delivery     → WhatsMissing__delivery
role=technician   → WhatsMissing__technician
default           → WhatsMissing__default
```

### QuickStart (priorité : delivery > need > role)

```
role=delivery     → QuickStart__delivery
new_clients       → QuickStart__prospection
client_tracking   → QuickStart__tracking
role=technician   → QuickStart__technician
default           → QuickStart__default
```

### NeedHelp

```
has_added_visits=false    → NeedHelp__no_visits
routes_optimized=0        → NeedHelp__no_optimization
```

### WhyLeaving

```
churn_reason exists   → WhyLeaving__with_feedback
no churn_reason       → WhyLeaving__silent
```

---

## Kill switches

| Condition | Action |
|-----------|--------|
| `has_replied: true` | Annule tous les emails (sauf TrialEndsSoon) |
| `has_added_visits: true` OU `routes_optimized > 0` | Annule NeedHelp, NeedHelpWith |
| `email_whyleaving_sent: true` | Bloque doublon WhyLeaving |
| `email` manquant | Bloque tous les emails |

---

## Génération IA

Chaque email est généré par Claude Haiku avec :
- Langue selon `locale`
- Contexte métier selon `role`
- Besoins selon `needs`
- Prénom extrait de l'email si non fourni (`jean.dupont@gmail.com` → Jean)

**Coût estimé** : ~0.04 centimes/email

---

## Cloud Functions

| Fonction | Type | Description |
|----------|------|-------------|
| `checkOnboardingDropped` | Scheduled (1h) | Détecte abandons onboarding |
| `onPaywallStateChanged` | Firestore trigger | Paywall abandonné, trial démarré |
| `onUserEngagementChanged` | Firestore trigger | Annule emails si user actif |
| `onUserChurned` | Firestore trigger | Planifie WhyLeaving |
| `onRevenueCatWebhook` | HTTPS | Reçoit events RevenueCat |
| `processQueue` | Scheduled (1min) | Envoie emails de la queue |
| `checkTrialEnding` | Scheduled (9h daily) | Envoie TrialEndsSoon |

---

## Collections Firestore

### `users/{userId}`

```typescript
{
  // Identité
  email: string
  locale?: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl'

  // Profil
  role: 'delivery' | 'field_sales' | 'technician' | 'sales_director' | 'other'
  needs: string[]

  // Onboarding
  onboarding_started_at: Timestamp
  onboarding_complete: boolean
  onboarding_dropped: boolean  // calculé par backend

  // Paywall
  paywall_seen: boolean
  paywall_abandoned: boolean

  // Engagement
  has_added_visits: boolean
  routes_optimized: number

  // Abonnement (via RevenueCat)
  trial_active: boolean
  trial_start_date?: Timestamp
  trial_end_date?: Timestamp
  subscription_active: boolean
  plan?: 'trial' | 'monthly' | 'yearly'

  // Churn (via RevenueCat)
  churned_at?: Timestamp
  churn_reason?: string

  // Flags emails
  has_replied: boolean
  email_whyleaving_sent: boolean

  // Test
  is_test_user?: boolean
}
```

### `email_queue/{id}`

```typescript
{
  user_id: string
  email_name: EmailName
  segment: Segment
  send_at: Timestamp
  created_at: Timestamp
  variables: Record<string, any>
}
```

### `email_logs/{id}`

```typescript
{
  user_id: string
  email_name: EmailName
  segment: Segment
  scheduled_at: Timestamp
  sent_at?: Timestamp
  status: 'scheduled' | 'sent' | 'blocked' | 'error'
  blocked_reason?: string
}
```

---

## Configuration

### Secrets Firebase

```bash
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
```

### Environnement (dev/prod)

```bash
# Dev - tous les emails vont à harold+test@easyway-planner.com
cp functions/.env.dev functions/.env
firebase deploy --only functions

# Prod - emails aux vrais users
cp functions/.env.prod functions/.env
firebase deploy --only functions
```

### Webhook RevenueCat

```
URL: https://us-central1-contact-on-map-flutter.cloudfunctions.net/onRevenueCatWebhook
Events: TRIAL_STARTED, INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
```

---

## Intégration App (Dart/Flutter)

```dart
// Instance Firestore pour email-nudge
final emailNudgeDb = FirebaseFirestore.instanceFor(
  app: Firebase.app(),
  databaseId: 'email-nudge',
);

// Premier écran onboarding
await emailNudgeDb.collection('users').doc(userId).set({
  'email': userEmail,
  'locale': Platform.localeName.split('_')[0],  // 'fr', 'en', etc.
  'onboarding_started_at': FieldValue.serverTimestamp(),
  'onboarding_complete': false,
  'onboarding_dropped': false,
  'paywall_seen': false,
  'paywall_abandoned': false,
  'has_added_visits': false,
  'routes_optimized': 0,
  'has_replied': false,
  'email_whyleaving_sent': false,
});

// Pendant onboarding
await emailNudgeDb.collection('users').doc(userId).update({
  'role': selectedRole,
  'needs': selectedNeeds,
});

// Fin onboarding
await emailNudgeDb.collection('users').doc(userId).update({
  'onboarding_complete': true,
});

// Paywall affiché
await emailNudgeDb.collection('users').doc(userId).update({
  'paywall_seen': true,
});

// Paywall fermé sans action
await emailNudgeDb.collection('users').doc(userId).update({
  'paywall_abandoned': true,
});

// Visite ajoutée
await emailNudgeDb.collection('users').doc(userId).update({
  'has_added_visits': true,
});

// Route optimisée
await emailNudgeDb.collection('users').doc(userId).update({
  'routes_optimized': FieldValue.increment(1),
});
```

---

## Délais (mode test)

En mode test (`is_test_user: true`), les délais sont réduits ×0.01 :

| Email | Délai normal | Délai test |
|-------|--------------|------------|
| WhatsMissing | 1h | 36s |
| FreeOptions | 10min | 6s |
| NeedHelp | 24h | ~14min |
| NeedHelpWith | 48h | ~29min |
| WhyLeaving | 30min | 18s |

---

## Monitoring

- **Logs** : https://console.firebase.google.com/project/contact-on-map-flutter/functions/logs
- **Firestore** : https://console.firebase.google.com/project/contact-on-map-flutter/firestore/databases/email-nudge
- **Resend** : https://resend.com/emails
- **BCC** : Tous les emails sont copiés à harold@easyway-planner.com
