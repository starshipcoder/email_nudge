import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { scheduleEmail, sendEmailNow } from '../services/emailService'

/**
 * Trigger: User blocked at paywall or passes it (detected via Firestore update)
 */
export const onPaywallStateChanged = onDocumentUpdated('users/{userId}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  const userId = event.params.userId

  if (!before || !after) return

  // User blocked at paywall
  if (!before.paywall_blocked && after.paywall_blocked) {
    console.log(`User ${userId} blocked at paywall`)
    await scheduleEmail(userId, 'FreeOptions')
    return
  }

  // User passed paywall
  if (!before.paywall_passed && after.paywall_passed) {
    console.log(`User ${userId} passed paywall`)

    // Send QuickStart immediately
    await sendEmailNow(userId, 'QuickStart')

    // Schedule follow-up emails
    await scheduleEmail(userId, 'NeedHelp')
    await scheduleEmail(userId, 'NeedHelpWith')
  }
})
