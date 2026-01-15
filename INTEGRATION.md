# Intégration Email Nudge dans Easy Way

## Vue d'ensemble

Le système Email Nudge envoie des emails personnalisés basés sur le comportement utilisateur. Les Cloud Functions écoutent les changements Firestore et envoient les emails via Resend.

**Base Firestore** : `email-nudge` (base nommée, pas la default)

---

## 1. Connexion à la base Firestore

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

// Créer une instance pour la base email-nudge
final emailNudgeDb = FirebaseFirestore.instanceFor(
  app: Firebase.app(),
  databaseId: 'email-nudge',
);

// Utiliser cette instance pour toutes les opérations email-nudge
await emailNudgeDb.collection('users').doc(userId).set({...});
```

**Important** : Ne pas utiliser `FirebaseFirestore.instance` qui pointe vers la base default.

---

## 2. Structure du document User

Collection : `users/{userId}`

```dart
class EmailNudgeUser {
  // Identité (requis pour envoyer des emails)
  final String email;
  final String firstName;

  // Rôle (choisi à l'onboarding)
  final String role; // 'delivery' | 'field_sales' | 'technician' | 'sales_director' | 'other'

  // Besoins (sélectionnés à l'onboarding)
  final List<String> needs; // ['max_visits', 'client_tracking', 'complex_routes', 'multi_day', 'hotel_search', 'new_clients']

  // État onboarding
  final bool onboardingComplete;
  final bool onboardingDropped;

  // État paywall
  final bool paywallSeen;
  final bool paywallAbandoned;

  // Engagement
  final int routesCreated;
  final bool hasReplied; // Kill switch

  // Abonnement
  final bool subscriptionActive;
  final bool trialActive;
  final DateTime? trialStartDate;
  final DateTime? trialEndDate;
  final String? plan; // 'trial' | 'monthly' | 'yearly'

  // Churn
  final DateTime? churnedAt;
  final String? churnReason;

  // Flags internes
  final bool? emailWhyleavingSent;

  // Test mode
  final bool? isTestUser; // Si true, emails envoyés à harold+test@easyway.app
}
```

---

## 3. Events à tracker

### 3.1 Création/Mise à jour initiale du user

Au premier écran de l'onboarding (quand on a l'email) :

```dart
Future<void> createEmailNudgeUser(String userId, String email, String firstName) async {
  await emailNudgeDb.collection('users').doc(userId).set({
    'email': email,
    'first_name': firstName,
    'onboarding_complete': false,
    'onboarding_dropped': false,
    'paywall_seen': false,
    'paywall_abandoned': false,
    'routes_created': 0,
    'has_replied': false,
    'subscription_active': false,
    'trial_active': false,
  }, SetOptions(merge: true));
}
```

### 3.2 Rôle et besoins (pendant l'onboarding)

```dart
Future<void> updateUserProfile(String userId, String role, List<String> needs) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'role': role,
    'needs': needs,
  });
}
```

### 3.3 Onboarding terminé

```dart
Future<void> onOnboardingComplete(String userId) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'onboarding_complete': true,
    'onboarding_dropped': false,
  });
}
```

### 3.4 Onboarding abandonné

Détecter quand le user quitte l'onboarding sans finir (ex: ferme l'app, navigue ailleurs) :

```dart
Future<void> onOnboardingDropped(String userId) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'onboarding_dropped': true,
  });
}
```

**Trigger** : `onboarding_dropped` passe à `true` → Email **WhatsMissing** planifié (1h)

### 3.5 Paywall vu

```dart
Future<void> onPaywallSeen(String userId) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'paywall_seen': true,
  });
}
```

### 3.6 Paywall abandonné

Quand le user ferme le paywall sans souscrire :

```dart
Future<void> onPaywallAbandoned(String userId) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'paywall_abandoned': true,
  });
}
```

**Trigger** : `paywall_abandoned` passe à `true` → Email **FreeOptions** planifié (10min)

### 3.7 Trial démarré

Géré automatiquement par le webhook RevenueCat. Mais si tu veux le faire manuellement :

```dart
Future<void> onTrialStarted(String userId, DateTime trialEndDate) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'trial_active': true,
    'trial_start_date': Timestamp.fromDate(DateTime.now()),
    'trial_end_date': Timestamp.fromDate(trialEndDate),
    'plan': 'trial',
  });
}
```

**Trigger** : `trial_active` passe à `true` → Emails **QuickStart** (immédiat), **NeedHelp** (24h), **NeedHelpWith** (48h) planifiés

### 3.8 Tournée créée

```dart
Future<void> onRouteCreated(String userId) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'routes_created': FieldValue.increment(1),
  });
}
```

**Effet** : Si `routes_created` passe de 0 à 1 → Annule les emails **NeedHelp** et **NeedHelpWith** en attente

### 3.9 User a répondu à un email (Kill Switch)

Si tu détectes qu'un user a répondu (via webhook Resend ou manuellement) :

```dart
Future<void> onUserReplied(String userId) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'has_replied': true,
  });
}
```

**Effet** : Annule TOUS les emails en attente (sauf TrialEndsSoon)

### 3.10 Churn

Quand le user annule son abonnement :

```dart
Future<void> onUserChurned(String userId, String? reason) async {
  await emailNudgeDb.collection('users').doc(userId).update({
    'churned_at': Timestamp.now(),
    'subscription_active': false,
    'trial_active': false,
    if (reason != null) 'churn_reason': reason,
  });
}
```

**Trigger** : `churned_at` défini → Email **WhyLeaving** planifié (30min)

---

## 4. Dialog de Churn Reason

Afficher cette dialog quand le user annule son abonnement dans l'app :

```dart
Future<String?> showChurnReasonDialog(BuildContext context) async {
  String? selectedReason;
  String? customReason;

  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Avant de partir...'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text("On aimerait comprendre ce qui n'a pas fonctionné. Qu'est-ce qui t'a manqué ?"),
          SizedBox(height: 16),

          RadioListTile<String>(
            title: Text('Trop cher'),
            value: 'too_expensive',
            groupValue: selectedReason,
            onChanged: (v) => setState(() => selectedReason = v),
          ),
          RadioListTile<String>(
            title: Text('Pas assez de fonctionnalités'),
            value: 'missing_features',
            groupValue: selectedReason,
            onChanged: (v) => setState(() => selectedReason = v),
          ),
          RadioListTile<String>(
            title: Text("Je n'en ai plus besoin"),
            value: 'no_longer_needed',
            groupValue: selectedReason,
            onChanged: (v) => setState(() => selectedReason = v),
          ),
          RadioListTile<String>(
            title: Text("J'ai trouvé une alternative"),
            value: 'found_alternative',
            groupValue: selectedReason,
            onChanged: (v) => setState(() => selectedReason = v),
          ),
          RadioListTile<String>(
            title: Text('Autre'),
            value: 'other',
            groupValue: selectedReason,
            onChanged: (v) => setState(() => selectedReason = v),
          ),

          if (selectedReason == 'other')
            TextField(
              decoration: InputDecoration(hintText: 'Dis-nous en plus...'),
              onChanged: (v) => customReason = v,
            ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, null),
          child: Text('Passer'),
        ),
        ElevatedButton(
          onPressed: () {
            final reason = selectedReason == 'other' ? customReason : selectedReason;
            Navigator.pop(context, reason);
          },
          child: Text('Envoyer'),
        ),
      ],
    ),
  );
}

// Utilisation
void handleCancelSubscription() async {
  final reason = await showChurnReasonDialog(context);
  await onUserChurned(userId, reason);
}
```

---

## 5. Webhook RevenueCat

Le webhook est déjà configuré pour gérer automatiquement :
- `TRIAL_STARTED` → Met à jour trial_active, trial_end_date
- `INITIAL_PURCHASE` / `RENEWAL` → Met à jour subscription_active, plan
- `CANCELLATION` / `EXPIRATION` → Met à jour churned_at

**URL du webhook** :
```
https://us-central1-contact-on-map-flutter.cloudfunctions.net/onRevenueCatWebhook
```

À configurer dans RevenueCat Dashboard → Integrations → Webhooks

---

## 6. Récapitulatif des emails

| Email | Déclencheur | Délai | Segment |
|-------|-------------|-------|---------|
| **WhatsMissing** | `onboarding_dropped: true` | 1h | Par rôle/besoin |
| **FreeOptions** | `paywall_abandoned: true` | 10min | Unique |
| **QuickStart** | `trial_active: true` | Immédiat | Par rôle/besoin |
| **NeedHelp** | `trial_active: true` | 24h | Selon routes créées |
| **NeedHelpWith** | `trial_active: true` | 48h | Unique |
| **TrialEndsSoon** | Cron quotidien 9h | J-2 | Unique |
| **WhyLeaving** | `churned_at` défini | 30min | Avec/sans feedback |

---

## 7. Kill Switches

Les emails sont automatiquement annulés si :

1. **User répond** (`has_replied: true`) → Annule tous les emails (sauf TrialEndsSoon)
2. **User crée une tournée** (`routes_created > 0`) → Annule NeedHelp, NeedHelpWith
3. **Pas d'email** (users legacy) → Bloque tous les emails
4. **WhyLeaving déjà envoyé** → Pas de doublon

---

## 8. Mode Test

Pour tester sans spammer les vrais users :

```dart
await emailNudgeDb.collection('users').doc(userId).update({
  'is_test_user': true,
});
```

**Effets** :
- Tous les emails sont envoyés à `harold+test@easyway.app`
- Les délais sont réduits (×0.01) : 1h → 36s, 24h → ~14min

---

## 9. Vérification / Debug

### Console Firebase
- Base de données : https://console.firebase.google.com/project/contact-on-map-flutter/firestore/databases/email-nudge
- Logs des fonctions : https://console.firebase.google.com/project/contact-on-map-flutter/functions/logs

### Collections Firestore

| Collection | Description |
|------------|-------------|
| `users` | Données utilisateurs |
| `email_queue` | Emails en attente d'envoi |
| `email_logs` | Historique des emails (sent, blocked, error) |

---

## 10. Checklist d'intégration

- [ ] Ajouter la dépendance Firebase Firestore (si pas déjà fait)
- [ ] Créer l'instance `emailNudgeDb` avec `databaseId: 'email-nudge'`
- [ ] Implémenter `createEmailNudgeUser()` au premier écran onboarding
- [ ] Implémenter `updateUserProfile()` quand rôle/besoins choisis
- [ ] Implémenter `onOnboardingComplete()` à la fin de l'onboarding
- [ ] Implémenter `onOnboardingDropped()` si user quitte l'onboarding
- [ ] Implémenter `onPaywallSeen()` quand paywall affiché
- [ ] Implémenter `onPaywallAbandoned()` quand paywall fermé sans action
- [ ] Implémenter `onRouteCreated()` quand tournée créée
- [ ] Implémenter la dialog de churn reason
- [ ] Configurer le webhook RevenueCat
- [ ] Tester avec un user `is_test_user: true`
