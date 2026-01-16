# Email Nudge - Spécification Technique

## Vue d'ensemble

Système d'emails automatisés pour Easy Way, basé sur le comportement utilisateur. Les emails utilisent des templates personnalisés selon le profil utilisateur.

**Objectifs :**
- Collecter du feedback (pas juste relancer)
- Accompagner le parcours utilisateur
- Réduire le churn
- Approche personnelle (reply simple, signé Harold)

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   App iOS   │────▶│  Cloud Functions │────▶│  Firestore  │
│   /Android  │     │  (API HTTP)      │     │ (email-nudge)│
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                    │
┌─────────────┐                                     │
│  RevenueCat │─────────────────────────────────────┤
│  Webhooks   │                                     │
└─────────────┘                                     ▼
                                             ┌──────────────┐
                                             │    Resend    │
                                             └──────────────┘
```

**Base Firestore** : `email-nudge` (base nommée, pas default)

---

## API Endpoints

### Base URL
```
https://us-central1-contact-on-map-flutter.cloudfunctions.net
```

### Authentification
Toutes les requêtes doivent inclure le header :
```
X-API-Key: <EMAIL_NUDGE_API_KEY>
```

### 1. `POST /syncUser`
Synchronise les données utilisateur depuis l'app.

**Body (JSON) :**
```json
{
  "revenuecat_id": "$RCAnonymousID:xxx",
  "email": "user@example.com",
  "first_name": "Jean",
  "locale": "fr",
  "role": "field_sales",
  "needs": ["max_visits", "complex_routes"],
  "onboarding_started_at": "2025-01-15T10:30:00Z",
  "onboarding_complete": true,
  "paywall_passed": true,
  "visit_added": true,
  "has_optimized_route": true,
  "trial_active": true,
  "trial_start_date": "2025-01-15T10:35:00Z",
  "trial_end_date": "2025-01-22T10:35:00Z",
  "subscription_active": false,
  "plan": "monthly",
  "is_test_user": false
}
```

Seul `revenuecat_id` est obligatoire. Les autres champs sont optionnels (merge).

**Réponse :**
```json
{
  "success": true,
  "userId": "$RCAnonymousID:xxx",
  "created": false
}
```

### 2. `GET /getUser?userId=xxx`
Récupère les données brutes d'un utilisateur.

**Réponse :**
```json
{
  "success": true,
  "user": { ... }
}
```

### 3. `GET /getStatus?userId=xxx`
Récupère le status complet d'un utilisateur (debug/monitoring).

**Réponse :**
```json
{
  "success": true,
  "userId": "$RCAnonymousID:xxx",
  "status": {
    "current_stage": "onboarding_in_progress",
    "next_email": "WhatsMissing",
    "next_email_reason": "onboarding_started_at: 2025-01-15T10:30:00Z, onboarding_complete: false",
    "next_email_at": "2025-01-15T11:30:00Z",
    "blockers": [],
    "is_test_user": false
  },
  "pending_emails": [],
  "recent_emails": [],
  "user_data": { ... }
}
```

**Stages possibles :**
- `waiting_onboarding_start` - Pas encore commencé
- `onboarding_in_progress` - En cours, WhatsMissing prévu
- `onboarding_dropped` - Abandonné, WhatsMissing envoyé
- `paywall_pending` - Onboarding OK, attente décision paywall
- `paywall_blocked` - N'a pas pris le trial, FreeOptions prévu
- `trial_no_visits` - Trial mais pas de visites, NoVisits prévu
- `trial_no_optimization` - Visites mais pas optimisé, NoOptimization prévu
- `engaged` - Utilisateur actif, pas d'email
- `churned` - Churné, WhyLeaving prévu/envoyé
- `blocked` - Kill switch actif (has_replied ou pas d'email)

### 4. `GET /getQueue`
Liste tous les emails en attente d'envoi.

**Réponse :**
```json
{
  "success": true,
  "count": 2,
  "queue": [
    {
      "id": "abc123",
      "user_id": "$RCAnonymousID:xxx",
      "email_name": "WhatsMissing",
      "segment": "WhatsMissing",
      "send_at": "2025-01-15T11:30:00Z",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Codes d'erreur
- `401` - Missing X-API-Key header
- `403` - Invalid API key
- `400` - Paramètres invalides
- `404` - User not found
- `500` - Erreur serveur

---

## Valeurs valides

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

**plan** :
- `free`
- `trial`
- `monthly`
- `yearly`

---

## Emails et déclencheurs

| Email | Déclencheur | Délai |
|-------|-------------|-------|
| **WhatsMissing** | `onboarding_dropped: true` (calculé par backend après 1h sans `onboarding_complete`) | 1h |
| **FreeOptions** | `paywall_blocked: true` (calculé par backend après 24h sans `paywall_passed`) | 10min |
| **QuickStart** | `paywall_passed: true` (user continue après le paywall) | immédiat |
| **NoVisits** | `paywall_passed: true` sans visite | 24h |
| **NoOptimization** | `has_added_visits: true` sans optimisation | 48h |
| **WhyLeaving** | `churned_at` défini | 30min |

### Logique Paywall

```
┌─────────────────┐
│  Onboarding     │
│  complete       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Paywall      │
│    affiché      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌──────────────────┐
│ User  │  │ User continue    │
│ quitte│  │ (trial ou abo)   │
│       │  └────────┬─────────┘
└───┬───┘           │
    │               ▼
    │          paywall_passed: true
    │          → QuickStart immédiat
    │          → NoVisits après 24h
    │          → NoOptimization après 48h
    │
    ▼
 Timeout backend (24h)
 → paywall_blocked: true (auto)
 → FreeOptions après 10min
```

**Important** : L'app envoie `paywall_passed: true` quand le user continue après le paywall (trial ou achat). Le backend détecte automatiquement les abandons via timeout.

---

## Logique de segmentation

### QuickStart (par role)

```
role=delivery        → QuickStart__delivery
role=field_sales     → QuickStart__field_sales
role=technician      → QuickStart__technician
role=sales_director  → QuickStart__sales_director
default              → QuickStart__default
```

Le template QuickStart inclut un `{{need_closing}}` dynamique basé sur le premier need de l'utilisateur.

### WhyLeaving

```
churn_reason=billing_error   → WhyLeaving__billing_error
default                      → WhyLeaving__unsubscribe
```

---

## Kill switches

| Condition | Action |
|-----------|--------|
| `has_replied: true` | Annule tous les emails |
| `has_added_visits: true` | Annule NoVisits |
| `has_optimized_route: true` | Annule NoOptimization |
| `email_whyleaving_sent: true` | Bloque doublon WhyLeaving |
| `email` manquant | Bloque tous les emails |

---

## Cloud Functions

| Fonction | Type | Description |
|----------|------|-------------|
| `syncUser` | HTTPS POST | Sync données user depuis l'app |
| `getUser` | HTTPS GET | Récupère données user |
| `getStatus` | HTTPS GET | Status détaillé user |
| `getQueue` | HTTPS GET | Liste emails en attente |
| `checkOnboardingDropped` | Scheduled (1h) | Détecte abandons onboarding |
| `checkPaywallBlocked` | Scheduled (1h) | Détecte abandons au paywall (après 24h) |
| `onPaywallStateChanged` | Firestore trigger | Paywall blocked/passed |
| `onUserEngagementChanged` | Firestore trigger | Annule emails si user actif |
| `onUserChurned` | Firestore trigger | Planifie WhyLeaving |
| `onRevenueCatWebhook` | HTTPS | Reçoit events RevenueCat |
| `processQueue` | Scheduled (5min) | Envoie emails de la queue |

---

## Collections Firestore

### `users/{userId}`

```typescript
{
  // Identité
  revenuecat_id: string
  email: string
  first_name?: string
  locale?: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl'

  // Profil
  role: 'delivery' | 'field_sales' | 'technician' | 'sales_director' | 'other'
  needs: string[]

  // Onboarding
  onboarding_started_at?: Timestamp
  onboarding_complete: boolean
  onboarding_dropped: boolean  // calculé par backend

  // Paywall
  paywall_blocked: boolean
  paywall_passed: boolean

  // Engagement
  has_added_visits: boolean
  has_optimized_route: boolean

  // Abonnement (via RevenueCat)
  trial_active: boolean
  trial_start_date?: Timestamp
  trial_end_date?: Timestamp
  subscription_active: boolean
  plan?: 'free' | 'trial' | 'monthly' | 'yearly'

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
firebase functions:secrets:set EMAIL_NUDGE_API_KEY
```

### Environnement (dev/prod)

Variable `ENV` dans Firebase :
- `dev` - tous les emails vont à harold+test@easyway-planner.com
- `prod` - emails aux vrais users

### Webhook RevenueCat

```
URL: https://us-central1-contact-on-map-flutter.cloudfunctions.net/onRevenueCatWebhook
Events: TRIAL_STARTED, INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
```

---

## Intégration App (Dart/Flutter)

```dart
class EmailNudgeRepository {
  final String baseUrl = 'https://us-central1-contact-on-map-flutter.cloudfunctions.net';
  final String apiKey = 'YOUR_API_KEY';

  Future<void> syncUser(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/syncUser'),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: jsonEncode(data),
    );
    // Handle response
  }

  Future<Map<String, dynamic>> getStatus(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/getStatus?userId=$userId'),
      headers: {'X-API-Key': apiKey},
    );
    return jsonDecode(response.body);
  }
}

// Usage
final emailNudge = EmailNudgeRepository();

// Premier écran onboarding
await emailNudge.syncUser({
  'revenuecat_id': revenueCatId,
  'email': userEmail,
  'locale': Platform.localeName.split('_')[0],
  'onboarding_started_at': DateTime.now().toIso8601String(),
});

// Pendant onboarding
await emailNudge.syncUser({
  'revenuecat_id': revenueCatId,
  'role': selectedRole,
  'needs': selectedNeeds,
});

// Fin onboarding
await emailNudge.syncUser({
  'revenuecat_id': revenueCatId,
  'onboarding_complete': true,
});

// User continue après le paywall (trial démarré ou achat)
await emailNudge.syncUser({
  'revenuecat_id': revenueCatId,
  'paywall_passed': true,
});

// NOTE: Ne pas envoyer paywall_blocked depuis l'app
// Le backend détecte automatiquement les abandons via timeout
// (onboarding_complete: true sans paywall_passed après X heures)

// Visite ajoutée
await emailNudge.syncUser({
  'revenuecat_id': revenueCatId,
  'visit_added': true,
});

// Route optimisée
await emailNudge.syncUser({
  'revenuecat_id': revenueCatId,
  'has_optimized_route': true,
});
```

---

## Délais (mode test)

En mode test (`is_test_user: true`), les délais sont réduits ×0.01 :

| Email | Délai normal | Délai test |
|-------|--------------|------------|
| WhatsMissing | 1h | 36s |
| FreeOptions | 10min | 6s |
| NoVisits | 24h | ~14min |
| NoOptimization | 48h | ~29min |
| WhyLeaving | 30min | 18s |

---

## Monitoring

- **Logs** : https://console.firebase.google.com/project/contact-on-map-flutter/functions/logs
- **Firestore** : https://console.firebase.google.com/project/contact-on-map-flutter/firestore/databases/email-nudge
- **Resend** : https://resend.com/emails
- **BCC** : Tous les emails sont copiés à harold@easyway-planner.com
