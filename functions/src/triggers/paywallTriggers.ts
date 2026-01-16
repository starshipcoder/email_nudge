import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { scheduleEmail, sendEmailNow, RESEND_API_KEY } from '../services/emailService'
import { db } from '../index'

// Timeout before considering user blocked at paywall (24 hours)
const PAYWALL_TIMEOUT_MS = 24 * 60 * 60 * 1000

/**
 * Trigger: User blocked at paywall or passes it (detected via Firestore update)
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
    await scheduleEmail(userId, 'NoVisits')
    await scheduleEmail(userId, 'NoOptimization')
  }
})

/**
 * Scheduled: Check for users blocked at paywall every hour
 * Users who completed onboarding > 24h ago without passing paywall → mark as blocked
 */
export const checkPaywallBlocked = onSchedule(
  {
    schedule: 'every 1 hours',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    const timeoutAgo = new Date(Date.now() - PAYWALL_TIMEOUT_MS)

    // Find users who:
    // - Completed onboarding > 24h ago
    // - Haven't passed paywall
    // - Haven't been marked as blocked yet
    const snapshot = await db
      .collection('users')
      .where('onboarding_complete', '==', true)
      .where('paywall_passed', '==', false)
      .where('paywall_blocked', '==', false)
      .get()

    // Filter by onboarding_completed_at (can't do inequality on two fields in Firestore)
    const usersToProcess = snapshot.docs.filter(doc => {
      const data = doc.data()
      const completedAt = data.onboarding_completed_at?.toDate?.()?.getTime() ||
                          data.onboarding_completed_at?.getTime?.() ||
                          (data.onboarding_completed_at ? new Date(data.onboarding_completed_at).getTime() : null)

      // If no onboarding_completed_at, use last_action_at as fallback
      const fallbackAt = data.last_action_at?.toDate?.()?.getTime() ||
                         data.last_action_at?.getTime?.() ||
                         (data.last_action_at ? new Date(data.last_action_at).getTime() : null)

      const checkTime = completedAt || fallbackAt
      return checkTime && checkTime <= timeoutAgo.getTime()
    })

    console.log(`Found ${usersToProcess.length} users blocked at paywall`)

    for (const doc of usersToProcess) {
      const userId = doc.id
      const userData = doc.data()

      // Skip if user has kill switch active
      if (userData.has_replied) {
        console.log(`User ${userId} skipped (has_replied)`)
        continue
      }

      // Mark as blocked
      await db.collection('users').doc(userId).update({
        paywall_blocked: true
      })

      console.log(`User ${userId} blocked at paywall - scheduling FreeOptions`)
      await scheduleEmail(userId, 'FreeOptions')
    }
  }
)
