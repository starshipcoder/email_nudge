# Email Nudge - Plan de Test Mobile

## Configuration

### Base URL
```
https://us-central1-contact-on-map-flutter.cloudfunctions.net
```

### Headers
```
X-API-Key: <EMAIL_NUDGE_API_KEY>
Content-Type: application/json
```

---

## Endpoints disponibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/syncUser` | POST | Créer/modifier un user |
| `/getStatus` | GET | Voir le status d'un user |
| `/getQueue` | GET | Voir les emails en attente |
| `/testTriggerOnboardingCron` | GET | Trigger cron abandon onboarding |
| `/testTriggerPaywallCron` | GET | Trigger cron abandon paywall |
| `/testTriggerQueueProcessor` | GET | Traiter la queue immédiatement |
| `/testResetUser` | GET | Reset un user pour recommencer |
| `/testDeleteUser` | GET | Supprimer un user |

---

## Scénarios de test

### Scénario 1: Abandon Onboarding → WhatsMissing

**Objectif:** Vérifier qu'un user qui abandonne l'onboarding reçoit l'email WhatsMissing

**Setup:**
```dart
// Créer un user qui a commencé l'onboarding il y a 2h (simule le timeout)
await syncUser({
  'revenuecat_id': 'test-scenario-1',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'delivery',
  'onboarding_started_at': DateTime.now().subtract(Duration(hours: 2)).toIso8601String(),
  'dry_run': true,  // Pas d'envoi réel
});
```

**Test:**
```dart
// 1. Vérifier status initial
final status1 = await getStatus('test-scenario-1');
assert(status1['status']['current_stage'] == 'onboarding_in_progress');

// 2. Trigger le cron onboarding
await http.get('$baseUrl/testTriggerOnboardingCron');

// 3. Vérifier que le user est marqué dropped
final status2 = await getStatus('test-scenario-1');
assert(status2['status']['current_stage'] == 'onboarding_dropped');

// 4. Vérifier qu'un email est dans la queue
final queue = await getQueue();
final userEmails = queue['queue'].where((e) => e['user_id'] == 'test-scenario-1');
assert(userEmails.any((e) => e['email_name'] == 'WhatsMissing'));

// 5. Traiter la queue
await http.get('$baseUrl/testTriggerQueueProcessor');

// 6. Vérifier que l'email est passé (queue vide, log créé)
final queue2 = await getQueue();
assert(!queue2['queue'].any((e) => e['user_id'] == 'test-scenario-1'));
```

**Résultat attendu:**
- Status passe de `onboarding_in_progress` → `onboarding_dropped`
- Email `WhatsMissing` dans la queue puis traité
- Email log avec status `dry_run`

**Cleanup:**
```dart
await http.get('$baseUrl/testDeleteUser?userId=test-scenario-1');
```

---

### Scénario 2: Abandon Paywall → FreeOptions

**Objectif:** Vérifier qu'un user qui abandonne au paywall reçoit l'email FreeOptions

**Setup:**
```dart
// Créer un user qui a terminé l'onboarding il y a 25h (simule le timeout 24h)
await syncUser({
  'revenuecat_id': 'test-scenario-2',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'field_sales',
  'onboarding_started_at': DateTime.now().subtract(Duration(hours: 26)).toIso8601String(),
  'onboarding_complete': true,
  'onboarding_completed_at': DateTime.now().subtract(Duration(hours: 25)).toIso8601String(),
  'dry_run': true,
});
```

**Test:**
```dart
// 1. Vérifier status initial
final status1 = await getStatus('test-scenario-2');
assert(status1['status']['current_stage'] == 'paywall_pending');

// 2. Trigger le cron paywall
await http.get('$baseUrl/testTriggerPaywallCron');

// 3. Vérifier que le user est marqué blocked
final status2 = await getStatus('test-scenario-2');
assert(status2['status']['current_stage'] == 'paywall_blocked');

// 4. Vérifier la queue
final queue = await getQueue();
assert(queue['queue'].any((e) =>
  e['user_id'] == 'test-scenario-2' && e['email_name'] == 'FreeOptions'
));

// 5. Traiter la queue
await http.get('$baseUrl/testTriggerQueueProcessor');
```

**Résultat attendu:**
- Status passe de `paywall_pending` → `paywall_blocked`
- Email `FreeOptions` planifié et traité

**Cleanup:**
```dart
await http.get('$baseUrl/testDeleteUser?userId=test-scenario-2');
```

---

### Scénario 3: Happy Path → QuickStart

**Objectif:** Vérifier qu'un user qui passe le paywall reçoit QuickStart immédiatement

**IMPORTANT:** Pour que le Firestore trigger se déclenche, il faut d'abord créer le user SANS `paywall_passed`, puis faire un UPDATE avec `paywall_passed: true`.

**Setup:**
```dart
// Étape 1: Créer le user SANS paywall_passed
await syncUser({
  'revenuecat_id': 'test-scenario-3',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'technician',
  'onboarding_complete': true,
  'dry_run': true,
});
```

**Test:**
```dart
// 1. Vérifier status initial
final status1 = await getStatus('test-scenario-3');
assert(status1['status']['current_stage'] == 'paywall_pending');

// 2. Étape 2: UPDATE avec paywall_passed (déclenche le Firestore trigger)
await syncUser({
  'revenuecat_id': 'test-scenario-3',
  'paywall_passed': true,
});

// 3. Attendre que le trigger s'exécute
await Future.delayed(Duration(seconds: 2));

// 4. Vérifier status
final status2 = await getStatus('test-scenario-3');
assert(status2['status']['current_stage'] == 'trial_no_visits');

// 5. Vérifier la queue (NoVisits et NoOptimization planifiés par le trigger)
final queue = await getQueue();
final userEmails = queue['queue'].where((e) => e['user_id'] == 'test-scenario-3').toList();
assert(userEmails.any((e) => e['email_name'] == 'NoVisits'));
assert(userEmails.any((e) => e['email_name'] == 'NoOptimization'));
```

**Résultat attendu:**
- QuickStart envoyé immédiatement (via Firestore trigger `onPaywallStateChanged`)
- NoVisits planifié (24h / ~14min en test)
- NoOptimization planifié (48h / ~29min en test)

**Cleanup:**
```dart
await http.get('$baseUrl/testDeleteUser?userId=test-scenario-3');
```

---

### Scénario 4: Trial sans visite → NoVisits

**Objectif:** Vérifier qu'un user en trial qui n'ajoute pas de visite reçoit NoVisits

**IMPORTANT:** Créer d'abord SANS paywall_passed, puis UPDATE pour trigger.

**Setup:**
```dart
// Étape 1: Créer le user SANS paywall_passed
await syncUser({
  'revenuecat_id': 'test-scenario-4',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'delivery',
  'onboarding_complete': true,
  'is_test_user': true,  // Délais réduits (24h → ~14min)
  'dry_run': true,
});

// Étape 2: UPDATE avec paywall_passed
await syncUser({
  'revenuecat_id': 'test-scenario-4',
  'paywall_passed': true,
});

// Attendre le trigger
await Future.delayed(Duration(seconds: 2));
```

**Test:**
```dart
// 1. Vérifier status
final status = await getStatus('test-scenario-4');
assert(status['status']['current_stage'] == 'trial_no_visits');
assert(status['status']['next_email'] == 'NoVisits');

// 2. Vérifier la queue
final queue = await getQueue();
final hasNoVisits = queue['queue'].any(
  (e) => e['user_id'] == 'test-scenario-4' && e['email_name'] == 'NoVisits'
);
assert(hasNoVisits);
```

**Résultat attendu:**
- NoVisits dans la queue avec send_at dans ~14min

---

### Scénario 5: Visite ajoutée → Annule NoVisits

**Objectif:** Vérifier que NoVisits est annulé quand le user ajoute une visite

**IMPORTANT:** Créer d'abord SANS paywall_passed, puis UPDATE pour trigger.

**Setup:**
```dart
// Étape 1: Créer le user SANS paywall_passed
await syncUser({
  'revenuecat_id': 'test-scenario-5',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'delivery',
  'onboarding_complete': true,
  'dry_run': true,
});

// Étape 2: UPDATE avec paywall_passed (trigger planifie NoVisits)
await syncUser({
  'revenuecat_id': 'test-scenario-5',
  'paywall_passed': true,
});

// Attendre le trigger
await Future.delayed(Duration(seconds: 2));
```

**Test:**
```dart
// 1. Vérifier que NoVisits est planifié
final queue1 = await getQueue();
assert(queue1['queue'].any((e) =>
  e['user_id'] == 'test-scenario-5' && e['email_name'] == 'NoVisits'
));

// 2. Simuler ajout de visite (trigger annule NoVisits)
await syncUser({
  'revenuecat_id': 'test-scenario-5',
  'visit_added': true,
});

// 3. Attendre le trigger d'engagement
await Future.delayed(Duration(seconds: 2));

// 4. Vérifier status
final status = await getStatus('test-scenario-5');
assert(status['status']['current_stage'] == 'trial_no_optimization');

// 5. Vérifier que NoVisits est annulé
final queue2 = await getQueue();
assert(!queue2['queue'].any((e) =>
  e['user_id'] == 'test-scenario-5' && e['email_name'] == 'NoVisits'
));
```

**Résultat attendu:**
- NoVisits supprimé de la queue
- Status passe à `trial_no_optimization`

---

### Scénario 6: Route optimisée → Engaged

**Objectif:** Vérifier qu'un user engagé n'a plus d'emails planifiés

**IMPORTANT:** Créer d'abord SANS paywall_passed, puis UPDATE pour trigger.

**Setup:**
```dart
// Étape 1: Créer le user SANS paywall_passed
await syncUser({
  'revenuecat_id': 'test-scenario-6',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'delivery',
  'onboarding_complete': true,
  'dry_run': true,
});

// Étape 2: UPDATE avec paywall_passed
await syncUser({
  'revenuecat_id': 'test-scenario-6',
  'paywall_passed': true,
});

// Étape 3: UPDATE avec visit_added
await syncUser({
  'revenuecat_id': 'test-scenario-6',
  'visit_added': true,
});

// Attendre les triggers
await Future.delayed(Duration(seconds: 2));
```

**Test:**
```dart
// 1. Vérifier status (devrait être trial_no_optimization)
final status1 = await getStatus('test-scenario-6');
assert(status1['status']['current_stage'] == 'trial_no_optimization');

// 2. Simuler optimisation
await syncUser({
  'revenuecat_id': 'test-scenario-6',
  'has_optimized_route': true,
});

// 3. Attendre le trigger
await Future.delayed(Duration(seconds: 2));

// 4. Vérifier status
final status2 = await getStatus('test-scenario-6');
assert(status2['status']['current_stage'] == 'engaged');
assert(status2['status']['next_email'] == null);

// 5. Vérifier que tous les emails sont annulés
final queue = await getQueue();
assert(!queue['queue'].any((e) => e['user_id'] == 'test-scenario-6'));
```

**Résultat attendu:**
- Status = `engaged`
- Aucun email en attente

---

### Scénario 7: Kill switch has_replied

**Objectif:** Vérifier que has_replied bloque tous les emails

**Setup:**
```dart
// Créer le user avec has_replied: true dès le départ
await syncUser({
  'revenuecat_id': 'test-scenario-7',
  'email': 'test@test.com',
  'locale': 'fr',
  'role': 'delivery',
  'onboarding_started_at': DateTime.now().subtract(Duration(hours: 2)).toIso8601String(),
  'has_replied': true,  // Kill switch actif
  'dry_run': true,
});
```

**Test:**
```dart
// 1. Vérifier status est bloqué
final status = await getStatus('test-scenario-7');
assert(status['status']['current_stage'] == 'blocked');
assert((status['status']['blockers'] as List).any((b) => b.toString().contains('has_replied')));

// 2. Trigger le cron (ne devrait pas traiter ce user)
await http.get('$baseUrl/testTriggerOnboardingCron');

// 3. Vérifier que rien n'est dans la queue
final queue = await getQueue();
assert(!queue['queue'].any((e) => e['user_id'] == 'test-scenario-7'));

// 4. Vérifier que le user n'est PAS marqué dropped (skip par le cron)
final status2 = await getStatus('test-scenario-7');
assert(status2['status']['current_stage'] == 'blocked');
// Le user reste bloqué, pas dropped
```

**Résultat attendu:**
- Status = `blocked`
- User ignoré par le cron (pas marqué `onboarding_dropped`)
- Aucun email planifié

---

## Résumé des assertions

| Scénario | Stage attendu | Email attendu |
|----------|---------------|---------------|
| 1. Abandon onboarding | `onboarding_dropped` | WhatsMissing |
| 2. Abandon paywall | `paywall_blocked` | FreeOptions |
| 3. Happy path | `trial_no_visits` | QuickStart (immédiat) + NoVisits + NoOptimization |
| 4. Trial sans visite | `trial_no_visits` | NoVisits |
| 5. Visite ajoutée | `trial_no_optimization` | NoVisits annulé |
| 6. Route optimisée | `engaged` | Aucun |
| 7. Kill switch | `blocked` | Aucun |

---

## Notes

### Mode dry_run
- Ajouter `'dry_run': true` au syncUser pour éviter l'envoi réel des emails
- Les emails sont loggés avec status `dry_run` dans `email_logs`

### Mode is_test_user
- Ajouter `'is_test_user': true` pour réduire les délais (×0.01)
- 1h → 36s, 24h → ~14min, 48h → ~29min

### Cleanup entre tests
```dart
await http.get('$baseUrl/testDeleteUser?userId=<userId>');
```

### Voir les logs
Les emails en mode dry_run apparaissent dans la collection `email_logs` avec:
- `status: 'dry_run'`
- `blocked_reason: 'dry_run mode enabled'`
