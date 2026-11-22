import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { RESEND_API_KEY } from '../services/emailService'
import { appelRevenueCatAutorise } from './revenuecatAuth'

// Le mot de passe que RevenueCat envoie dans l'en-tête Authorization (BUG-EW-6).
export const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH')
import { db } from '../index'

// sendChurnAlert not used anymore - churns are in daily recap only

/**
 * Trigger: User churns (detected via Firestore update)
 * Action: NO email - churns are reported in daily recap only
 */
export const onUserChurned = onDocumentUpdated(
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

    // Check if user just churned
    if (!before.churned_at && after.churned_at) {
      console.log(`User ${userId} churned${after.churn_reason ? `: ${after.churn_reason}` : ''} - will be in daily recap`)

      // NO immediate alert - churns will be reported in daily recap
    }
  }
)

/**
 * RevenueCat webhook payload structure
 */
interface RevenueCatWebhook {
  api_version: string
  event: {
    type: string
    app_user_id: string
    aliases?: string[]
    original_app_user_id?: string
    cancel_reason?: string
    environment: string
    product_id?: string
    expiration_at_ms?: number
    country_code?: string
    subscriber_attributes?: {
      $email?: { value: string }
      [key: string]: { value: string; updated_at_ms?: number } | undefined
    }
  }
}


/**
 * Trigger: RevenueCat webhook for subscription events
 * Handles: CANCELLATION, EXPIRATION, INITIAL_PURCHASE, RENEWAL, TRIAL_STARTED
 */
export const onRevenueCatWebhook = onRequest(
  { secrets: [REVENUECAT_WEBHOOK_AUTH] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }
    // Seul RevenueCat, avec le mot de passe réglé dans son tableau de bord, peut écrire sur les fiches (BUG-EW-6).
    if (!appelRevenueCatAutorise(req.headers.authorization, REVENUECAT_WEBHOOK_AUTH.value())) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const payload = req.body as RevenueCatWebhook
    const eventData = payload.event

    if (!eventData || !eventData.type) {
      console.error('Invalid RevenueCat payload: missing event or event.type')
      res.status(400).json({ error: 'Invalid payload structure' })
      return
    }

    const eventType = eventData.type
    const appUserId = eventData.app_user_id
    const aliases = eventData.aliases || []
    const isTestEvent = eventData.environment === 'SANDBOX'

    // Extract email and country from event data
    const emailFromAttributes = eventData.subscriber_attributes?.$email?.value
    const countryCode = eventData.country_code

    // Pas d'adresse dans les journaux (BUG-EW-6).
    console.log(`RevenueCat ${eventType}: aliases=${aliases.length}, adresse=${emailFromAttributes ? 'oui' : 'non'}, country=${countryCode || 'none'}`)

    // Try to find user by app_user_id or any alias
    const idsToSearch = [appUserId, ...aliases].filter(Boolean)
    let userId: string | null = null

    for (const id of idsToSearch) {
      // First try direct document lookup (most common case)
      const directDoc = await db.collection('users').doc(id).get()
      if (directDoc.exists) {
        userId = id
        break
      }

      // Then try searching by revenuecat_id field
      const snapshot = await db
        .collection('users')
        .where('revenuecat_id', '==', id)
        .limit(1)
        .get()

      if (!snapshot.empty) {
        userId = snapshot.docs[0].id
        break
      }
    }

    // Map RevenueCat cancel_reason
    const cancelReason = eventData.cancel_reason
    const churnReason = cancelReason === 'UNSUBSCRIBE' ? 'unsubscribe'
      : cancelReason === 'BILLING_ERROR' ? 'billing_error'
      : cancelReason || null

    switch (eventType) {
      case 'CANCELLATION':
        if (userId) {
          await handleChurn(userId, isTestEvent, churnReason)
        } else {
          // BUG-EW-6 (22/11) : plus aucun e-mail d'ici. L'e-mail de départ passe par Iris CRM, relu par le fondateur ;
          // Iris prévient par ntfy d'une annulation sans inscrit.
          console.log(`RevenueCat: CANCELLATION sans inscrit (${churnReason})${isTestEvent ? ' [TEST]' : ''}`)
        }
        break

      case 'EXPIRATION':
        if (userId) {
          await handleExpiration(userId)
        }
        break

      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        if (userId) {
          await handleSubscriptionActive(userId, eventData.product_id, isTestEvent)
        }
        break

      case 'TRIAL_STARTED':
        if (userId) {
          const expirationAt = eventData.expiration_at_ms
            ? new Date(eventData.expiration_at_ms).toISOString()
            : undefined
          await handleTrialStarted(userId, expirationAt, isTestEvent)
        }
        break

      default:
        console.log(`RevenueCat: Unhandled event type: ${eventType}`)
    }

    res.status(200).send('OK')
  }
)

async function handleChurn(userId: string, isTestEvent: boolean, churnReason: string | null): Promise<void> {
  console.log(`RevenueCat: User ${userId} churned (${churnReason})${isTestEvent ? ' [TEST]' : ''}`)

  await db.collection('users').doc(userId).update({
    churned_at: new Date(),
    churn_reason: churnReason,
    subscription_active: false,
    trial_active: false,
    is_test_user: isTestEvent
  })

  // Churn alert will be triggered by Firestore onUpdate (onUserChurned)
}

async function handleSubscriptionActive(userId: string, productId: string | undefined, isTestEvent: boolean): Promise<void> {
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
