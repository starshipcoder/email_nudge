import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { scheduleEmail } from '../services/emailService'

const db = admin.firestore()

/**
 * Trigger: User cancels in-app
 * Action: Schedule WhyLeaving email (30min)
 */
export const onUserCancelled = functions.analytics
  .event('user_cancelled')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in user_cancelled event')
      return
    }

    const reason = event.params?.reason as string | undefined

    console.log(`User ${userId} cancelled in-app${reason ? `: ${reason}` : ''}`)

    // Update user
    await db.collection('users').doc(userId).update({
      churned_at: new Date(),
      churn_reason: reason || null,
      subscription_active: false,
      trial_active: false
    })

    // Schedule WhyLeaving (dedup handled in emailService)
    await scheduleEmail(userId, 'WhyLeaving')
  })

/**
 * Trigger: RevenueCat webhook for subscription cancellation
 * Action: Schedule WhyLeaving email (30min) if not already sent
 */
export const onRevenueCatWebhook = functions.https.onRequest(async (req, res) => {
  // Verify webhook (in production, add signature verification)
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const event = req.body

  // Handle different RevenueCat events
  switch (event.event) {
    case 'CANCELLATION':
    case 'EXPIRATION':
      await handleChurn(event)
      break

    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
      await handleSubscriptionActive(event)
      break

    case 'TRIAL_STARTED':
      await handleTrialStarted(event)
      break

    default:
      console.log(`Unhandled RevenueCat event: ${event.event}`)
  }

  res.status(200).send('OK')
})

async function handleChurn(event: any): Promise<void> {
  const userId = event.app_user_id
  if (!userId) {
    console.error('No app_user_id in RevenueCat event')
    return
  }

  console.log(`RevenueCat: User ${userId} churned (${event.event})`)

  // Update user
  await db.collection('users').doc(userId).update({
    churned_at: new Date(),
    subscription_active: false,
    trial_active: false
  })

  // Schedule WhyLeaving (dedup handled in emailService)
  await scheduleEmail(userId, 'WhyLeaving')
}

async function handleSubscriptionActive(event: any): Promise<void> {
  const userId = event.app_user_id
  if (!userId) return

  console.log(`RevenueCat: User ${userId} subscription active`)

  await db.collection('users').doc(userId).update({
    subscription_active: true,
    plan: event.product_id?.includes('yearly') ? 'yearly' : 'monthly'
  })
}

async function handleTrialStarted(event: any): Promise<void> {
  const userId = event.app_user_id
  if (!userId) return

  console.log(`RevenueCat: User ${userId} started trial`)

  const trialEndDate = event.expiration_at
    ? new Date(event.expiration_at)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days

  await db.collection('users').doc(userId).update({
    trial_active: true,
    trial_start_date: new Date(),
    trial_end_date: trialEndDate,
    plan: 'trial'
  })
}
