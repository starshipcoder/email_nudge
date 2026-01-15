import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
admin.initializeApp()

// Use named database
export const db = getFirestore('email-nudge')

// Onboarding triggers
export { checkOnboardingDropped } from './triggers/onboardingTriggers'

// Paywall triggers
export { onPaywallStateChanged } from './triggers/paywallTriggers'

// Engagement triggers
export { onUserEngagementChanged } from './triggers/engagementTriggers'

// Churn triggers
export { onUserChurned, onRevenueCatWebhook } from './triggers/churnTriggers'

// Scheduled triggers
export { processQueue } from './triggers/scheduledTriggers'
// export { checkTrialEnding } from './triggers/scheduledTriggers' // Désactivé pour l'instant

// Test triggers (remove in production)
export { testSendEmail, testCreateUser, testResetUser, testDeleteUser } from './triggers/testTriggers'
