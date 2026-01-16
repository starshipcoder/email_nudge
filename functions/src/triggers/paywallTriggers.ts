import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { sendEmailNow } from '../services/emailService'
import { db } from '../index'

/**
 * Trigger: User passes paywall → send QuickStart immediately
 * Other emails (FreeOptions, NoVisits, NoOptimization) are handled by the cron
 */
export const onPaywallStateChanged = onDocumentUpdated(
  {
    document: 'users/{userId}',
    database: 'email-nudge'
  },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const userId = event.params.userId

    if (!before || !after) return

    // User passed paywall → send QuickStart immediately
    if (!before.paywall_passed && after.paywall_passed) {
      console.log(`User ${userId} passed paywall - sending QuickStart`)

      // Record timestamp for NoVisits calculation
      await db.collection('users').doc(userId).update({
        paywall_passed_at: new Date()
      })

      // Send QuickStart immediately
      await sendEmailNow(userId, 'QuickStart')
    }
  }
)
