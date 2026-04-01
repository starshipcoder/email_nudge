import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { RESEND_API_KEY } from '../services/emailService'
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
 * Map country code to locale for email generation
 */
function countryCodeToLocale(countryCode?: string): string {
  if (!countryCode) return 'en'

  const countryToLocale: Record<string, string> = {
    // French
    'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'MC': 'fr', 'CH': 'fr',
    'CA': 'fr', // Canada - could be fr or en, defaulting to fr
    // Spanish
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es',
    'PE': 'es', 'VE': 'es', 'EC': 'es', 'GT': 'es', 'CU': 'es',
    // German
    'DE': 'de', 'AT': 'de',
    // Italian
    'IT': 'it',
    // Portuguese
    'PT': 'pt', 'BR': 'pt',
    // Dutch
    'NL': 'nl',
  }

  return countryToLocale[countryCode.toUpperCase()] || 'en'
}

/**
 * Trigger: RevenueCat webhook for subscription events
 * Handles: CANCELLATION, EXPIRATION, INITIAL_PURCHASE, RENEWAL, TRIAL_STARTED
 */
export const onRevenueCatWebhook = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
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
    const locale = countryCodeToLocale(countryCode)

    console.log(`RevenueCat ${eventType}: app_user_id=${appUserId}, aliases=${aliases.length}, email=${emailFromAttributes || 'none'}, country=${countryCode || 'none'}, locale=${locale}`)

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
        } else if (emailFromAttributes) {
          // User not in DB but we have email - send WhyLeaving directly
          console.log(`RevenueCat: User not found, sending WhyLeaving to ${emailFromAttributes}`)
          await sendWhyLeavingToEmail(emailFromAttributes, churnReason, isTestEvent, locale)
        } else {
          // No user, no email - notify Harold
          console.log(`RevenueCat: CANCELLATION - no user and no email, notifying Harold`)
          await notifyMissingUser(appUserId, churnReason, isTestEvent)
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

/**
 * Send WhyLeaving email directly to an email address (user not in DB)
 */
async function sendWhyLeavingToEmail(email: string, churnReason: string | null, isTestEvent: boolean, locale: string = 'en'): Promise<void> {
  // Import Resend here to avoid circular dependency
  const { Resend } = await import('resend')
  const resend = new Resend(RESEND_API_KEY.value())

  // Create a minimal user object for email generation
  const fakeUser = {
    id: 'unknown',
    email,
    locale, // Use locale derived from country_code
    role: 'delivery' as const,
    churn_reason: churnReason,
    dry_run: isTestEvent
  }

  // Generate email content
  const { generateEmail } = await import('../services/emailGenerator')
  const { subject, body } = generateEmail(fakeUser as any, 'WhyLeaving')

  const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'

  if (isTestEvent) {
    console.log(`[DRY RUN] Would send WhyLeaving to ${email}`)
    // Log but don't send
    await db.collection('email_logs').add({
      user_id: 'unknown_revenuecat',
      email_name: 'WhyLeaving',
      segment: 'churn',
      status: 'dry_run',
      scheduled_at: new Date(),
      to_email: email,
      churn_reason: churnReason
    })
  } else {
    // Actually send
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      text: body
    })

    await db.collection('email_logs').add({
      user_id: 'unknown_revenuecat',
      email_name: 'WhyLeaving',
      segment: 'churn',
      status: 'sent',
      scheduled_at: new Date(),
      sent_at: new Date(),
      to_email: email,
      churn_reason: churnReason,
      resend_id: result.data?.id
    })

    console.log(`WhyLeaving sent to ${email} (user not in DB)`)
  }
}

/**
 * Notify Harold when a user cancels but we can't find them or their email
 */
async function notifyMissingUser(appUserId: string, churnReason: string | null, isTestEvent: boolean): Promise<void> {
  const { Resend } = await import('resend')
  const resend = new Resend(RESEND_API_KEY.value())

  const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
  const TO_EMAIL = 'harold@easyway-planner.com'

  const subject = `[Email Nudge] User cancelled but not found`
  const body = `A user cancelled their subscription but we couldn't find them in the database or get their email.

RevenueCat ID: ${appUserId}
Cancel reason: ${churnReason || 'unknown'}
Environment: ${isTestEvent ? 'SANDBOX' : 'PRODUCTION'}

You may want to check RevenueCat for more details.`

  if (isTestEvent) {
    console.log(`[DRY RUN] Would notify Harold about missing user ${appUserId}`)
    await db.collection('email_logs').add({
      user_id: appUserId,
      email_name: 'MissingUserNotification',
      segment: 'internal',
      status: 'dry_run',
      scheduled_at: new Date(),
      to_email: TO_EMAIL,
      churn_reason: churnReason
    })
  } else {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject,
      text: body
    })

    await db.collection('email_logs').add({
      user_id: appUserId,
      email_name: 'MissingUserNotification',
      segment: 'internal',
      status: 'sent',
      scheduled_at: new Date(),
      sent_at: new Date(),
      to_email: TO_EMAIL,
      churn_reason: churnReason
    })

    console.log(`Notified Harold about missing user ${appUserId}`)
  }
}
