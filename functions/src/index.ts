import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
admin.initializeApp()

// Use named database
export const db = getFirestore('email-nudge')

// Scheduled triggers (emails désactivés, WhatsApp lifecycle actif)
export { checkAndSendEmails, checkAndSendWhatsApp } from './triggers/scheduledTriggers'

// Daily recap trigger (send recap to Harold every morning)
export { sendDailyEmailRecap } from './triggers/dailyRecapTrigger'

// Weekly recap trigger (send recap every Monday morning)
export { sendWeeklyEmailRecap } from './triggers/weeklyRecapTrigger'

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
  getEmailLogs,
  getEnvInfo,
  testDailyRecap,
  testWeeklyRecap,
  testChurnAlert
} from './triggers/testTriggers'

// API triggers (for mobile app)
export { syncUser, getUser, getStatus } from './triggers/apiTriggers'

// WhatsApp triggers (nudge automatique nouveaux users)
export { onNewUserWhatsapp } from './triggers/whatsappTriggers'
