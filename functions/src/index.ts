import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
admin.initializeApp()

// Use named database
export const db = getFirestore('email-nudge')

// Scheduled triggers (main cron for all emails)
export { checkAndSendEmails } from './triggers/scheduledTriggers'

// Paywall triggers (only QuickStart on paywall_passed)
export { onPaywallStateChanged } from './triggers/paywallTriggers'

// Churn triggers (WhyLeaving via RevenueCat)
export { onUserChurned, onRevenueCatWebhook } from './triggers/churnTriggers'

// Test triggers (remove in production)
export {
  testSendEmail,
  testCreateUser,
  testResetUser,
  testDeleteUser,
  testTriggerCron,
  getEmailLogs
} from './triggers/testTriggers'

// API triggers (for mobile app)
export { syncUser, getUser, getStatus } from './triggers/apiTriggers'
