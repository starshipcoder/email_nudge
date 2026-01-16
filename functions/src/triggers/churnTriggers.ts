import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { scheduleEmail, RESEND_API_KEY } from '../services/emailService'
import { db } from '../index'

/**
 * Trigger: User churns (detected via Firestore update)
 * Action: Schedule WhyLeaving email (30min)
 */
export const onUserChurned = onDocumentUpdated(
  {
    document: 'users/{userId}',
    database: 'email-nudge'
  },
  async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  const userId = event.params.userId

  if (!before || !after) return

  // Check if user just churned
  if (!before.churned_at && after.churned_at) {
    console.log(`User ${userId} churned${after.churn_reason ? `: ${after.churn_reason}` : ''}`)
    await scheduleEmail(userId, 'WhyLeaving')
  }
})

/**
 * Trigger: RevenueCat webhook for subscription cancellation
 * Action: Schedule WhyLeaving email (30min) if not already sent
 */
export const onRevenueCatWebhook = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    const event = req.body
    const revenuecatId = event.app_user_id

    if (!revenuecatId) {
      console.error('No app_user_id in RevenueCat event')
      res.status(400).send('Missing app_user_id')
      return
    }

    // Find user by revenuecat_id
    const userSnapshot = await db
      .collection('users')
      .where('revenuecat_id', '==', revenuecatId)
      .limit(1)
      .get()

    if (userSnapshot.empty) {
      console.error(`No user found with revenuecat_id: ${revenuecatId}`)
      res.status(404).send('User not found')
      return
    }

    const userId = userSnapshot.docs[0].id
    const isTestEvent = event.environment === 'SANDBOX' || event.is_sandbox === true

    // Map RevenueCat cancellation reason
    const cancellationReason = event.cancellation_reason
    const churnReason = cancellationReason === 'UNSUBSCRIBE' ? 'unsubscribe'
      : cancellationReason === 'BILLING_ERROR' ? 'billing_error'
      : null

    switch (event.event) {
      case 'CANCELLATION':
        // Only send WhyLeaving for UNSUBSCRIBE or BILLING_ERROR
        if (churnReason) {
          await handleChurn(userId, isTestEvent, churnReason)
        } else {
          console.log(`RevenueCat: Ignoring CANCELLATION with reason ${cancellationReason}`)
        }
        break

      case 'EXPIRATION':
        await handleExpiration(userId)
        break

      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        await handleSubscriptionActive(userId, event.product_id, isTestEvent)
        break

      case 'TRIAL_STARTED':
        await handleTrialStarted(userId, event.expiration_at, isTestEvent)
        break

      default:
        console.log(`Unhandled RevenueCat event: ${event.event}`)
    }

    res.status(200).send('OK')
  }
)

async function handleChurn(userId: string, isTestEvent: boolean, churnReason: string): Promise<void> {
  console.log(`RevenueCat: User ${userId} churned (${churnReason})${isTestEvent ? ' [TEST]' : ''}`)

  await db.collection('users').doc(userId).update({
    churned_at: new Date(),
    churn_reason: churnReason,
    subscription_active: false,
    trial_active: false,
    is_test_user: isTestEvent
  })

  // WhyLeaving will be triggered by Firestore onUpdate
}

async function handleSubscriptionActive(userId: string, productId: string, isTestEvent: boolean): Promise<void> {
  console.log(`RevenueCat: User ${userId} subscription active${isTestEvent ? ' [TEST]' : ''}`)

  await db.collection('users').doc(userId).update({
    subscription_active: true,
    plan: productId?.includes('yearly') ? 'yearly' : 'monthly',
    is_test_user: isTestEvent
  })
}

async function handleExpiration(userId: string): Promise<void> {
  console.log(`RevenueCat: User ${userId} expired`)

  // Just update status, WhyLeaving already sent on CANCELLATION
  await db.collection('users').doc(userId).update({
    subscription_active: false,
    trial_active: false
  })
}

async function handleTrialStarted(userId: string, expirationAt: string | undefined, isTestEvent: boolean): Promise<void> {
  console.log(`RevenueCat: User ${userId} started trial${isTestEvent ? ' [TEST]' : ''}`)

  const trialEndDate = expirationAt
    ? new Date(expirationAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await db.collection('users').doc(userId).update({
    trial_active: true,
    trial_start_date: new Date(),
    trial_end_date: trialEndDate,
    plan: 'trial',
    is_test_user: isTestEvent
  })
}
