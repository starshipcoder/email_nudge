import * as admin from 'firebase-admin'

// Initialize Firebase Admin
admin.initializeApp()

// Onboarding triggers
export { onOnboardingDropped, onOnboardingDroppedEvent } from './triggers/onboardingTriggers'

// Paywall triggers
export { onPaywallBlocked, onPaywallPassed } from './triggers/paywallTriggers'

// Engagement triggers
export {
  onRouteCreated,
  onRouteOptimized,
  onProspectAdded,
  onUserReplied
} from './triggers/engagementTriggers'

// Churn triggers
export { onUserCancelled, onRevenueCatWebhook } from './triggers/churnTriggers'

// Scheduled triggers
export { processQueue, checkTrialEnding } from './triggers/scheduledTriggers'
