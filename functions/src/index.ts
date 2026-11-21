import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
admin.initializeApp()

// Use named database
export const db = getFirestore('email-nudge')

// Retirées de Firebase le 21/11/2026 (fondateur) : les dix fonctions de test publiques,
// checkAndSendEmails, checkAndSendWhatsApp, onUserChurned, onNewUserWhatsapp.
// Ne pas les réexporter : un déploiement les remettrait en ligne.

// Daily recap trigger (send recap to Harold every morning)
export { sendDailyEmailRecap } from './triggers/dailyRecapTrigger'

// Weekly recap trigger (send recap every Monday morning)
export { sendWeeklyEmailRecap } from './triggers/weeklyRecapTrigger'

// Paywall triggers (only QuickStart on paywall_passed)
export { onPaywallStateChanged } from './triggers/paywallTriggers'

// Churn triggers (WhyLeaving via RevenueCat)
export { onRevenueCatWebhook } from './triggers/churnTriggers'

// API triggers (for mobile app)
export { syncUser, getUser, getStatus } from './triggers/apiTriggers'
