import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { RESEND_API_KEY } from '../services/emailService'
import { db } from '../index'

/**
 * DÉSACTIVÉ - Plus d'emails aux users
 * Trigger: User passes paywall → send QuickStart immediately
 */
export const onPaywallStateChanged = onDocumentUpdated(
  {
    document: 'users/{userId}',
    database: 'email-nudge',
    secrets: [RESEND_API_KEY]
  },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const userId = event.params.userId

    if (!before || !after) return

    // User passed paywall → just record timestamp (no email)
    if (!before.paywall_passed && after.paywall_passed) {
      console.log(`User ${userId} passed paywall - NO EMAIL (désactivé)`)

      await db.collection('users').doc(userId).update({
        paywall_passed_at: new Date()
      })

      // QuickStart email DÉSACTIVÉ
      // await sendEmailNow(userId, 'QuickStart')
    }
  }
)
