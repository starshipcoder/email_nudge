import { Resend } from 'resend'
import { defineSecret, defineString } from 'firebase-functions/params'
import { User, EmailName, Segment, EmailQueueItem, EmailLog } from '../types'
import { resolveSegment, shouldSendEmail } from '../utils/segmentResolver'
import { generateEmail } from './emailGenerator'
import { db } from '../index'

// Define secrets for Cloud Functions
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

// Resend client (initialized lazily)
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY.value())
  }
  return resendClient
}

const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
const BCC_EMAIL = 'harold@easyway-planner.com'
const TEST_RECIPIENT = 'harold+test@easyway-planner.com'

// Test emails that always go to TEST_RECIPIENT (even in prod)
const TEST_EMAILS = [
  'toto@toto.com',
  'test@test.com',
  'harold+test@easyway-planner.com'
]

// Environment: 'dev' = all emails go to TEST_RECIPIENT, 'prod' = normal behavior
// Set in Google Cloud Console or via firebase functions:params:set ENV=prod
const ENV_PARAM = defineString('ENV', { default: 'dev' })

function getEnv(): string {
  return ENV_PARAM.value()
}

function isTestEmail(email: string): boolean {
  return TEST_EMAILS.includes(email.toLowerCase())
}

function getRecipient(user: { email: string; is_test_user?: boolean }): string {
  if (getEnv() === 'dev') return TEST_RECIPIENT
  if (user.is_test_user) return TEST_RECIPIENT
  if (isTestEmail(user.email)) return TEST_RECIPIENT
  return user.email
}

function getDebugFooter(user: User): string {
  if (getEnv() !== 'dev') return ''

  return `

---
[DEBUG - DEV MODE]
User ID: ${user.id}
Email: ${user.email}
Role: ${user.role || 'non défini'}
Needs: ${user.needs?.join(', ') || 'aucun'}
Locale: ${user.locale || 'fr'}
Trial active: ${user.trial_active}
Subscription active: ${user.subscription_active}
Has added visits: ${user.has_added_visits}
Has optimized route: ${user.has_optimized_route}
`
}

// Delays in milliseconds
const DELAYS: Record<EmailName, number> = {
  WhatsMissing: 60 * 60 * 1000,        // 1 hour
  FreeOptions: 10 * 60 * 1000,          // 10 minutes
  QuickStart: 0,                         // Immediate
  NoVisits: 24 * 60 * 60 * 1000,        // 24 hours
  NoOptimization: 48 * 60 * 60 * 1000,  // 48 hours
  WhyLeaving: 30 * 60 * 1000            // 30 minutes
}

// Test user time multiplier (1 hour -> 36 seconds)
const TEST_TIME_MULTIPLIER = 0.01

/**
 * Schedule an email to be sent later
 */
export async function scheduleEmail(
  userId: string,
  emailName: EmailName,
  extraVariables?: Record<string, string | number>
): Promise<void> {
  const userDoc = await db.collection('users').doc(userId).get()
  const user = { id: userId, ...userDoc.data() } as User

  if (!user) {
    console.error(`User not found: ${userId}`)
    return
  }

  // Check if should send
  const { send, reason } = shouldSendEmail(emailName, user)
  if (!send) {
    console.log(`Email ${emailName} blocked for user ${userId}: ${reason}`)
    await logEmail(userId, emailName, 'blocked', reason)
    return
  }

  // Resolve segment
  const segment = resolveSegment(emailName, user)

  // Calculate send time
  let delay = DELAYS[emailName]
  if (user.is_test_user) {
    delay = delay * TEST_TIME_MULTIPLIER
  }
  const sendAt = new Date(Date.now() + delay)

  // Add to queue
  const queueItem: EmailQueueItem = {
    user_id: userId,
    email_name: emailName,
    segment,
    send_at: sendAt,
    created_at: new Date(),
    variables: (extraVariables || {}) as Record<string, string | string[]>
  }

  await db.collection('email_queue').add(queueItem)
  await logEmail(userId, emailName, 'scheduled', undefined, segment)

  console.log(`Scheduled ${emailName} (${segment}) for user ${userId} at ${sendAt}`)
}

/**
 * Send an email immediately
 */
export async function sendEmailNow(
  userId: string,
  emailName: EmailName,
  extraVariables?: Record<string, string | number>
): Promise<void> {
  const userDoc = await db.collection('users').doc(userId).get()
  const user = { id: userId, ...userDoc.data() } as User

  if (!user) {
    console.error(`User not found: ${userId}`)
    return
  }

  // Check if should send
  const { send, reason } = shouldSendEmail(emailName, user)
  if (!send) {
    console.log(`Email ${emailName} blocked for user ${userId}: ${reason}`)
    await logEmail(userId, emailName, 'blocked', reason)
    return
  }

  // Resolve segment and generate email
  const segment = resolveSegment(emailName, user)
  const { subject, body } = generateEmail(user, emailName)
  const fullBody = body + getDebugFooter(user)

  // Send via Resend
  try {
    const toEmail = getRecipient(user)

    await getResend().emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      bcc: BCC_EMAIL,
      subject: getEnv() === 'dev' ? `[DEV] ${subject}` : subject,
      text: fullBody
    })

    await logEmail(userId, emailName, 'sent', undefined, segment)
    console.log(`[${getEnv()}] Sent ${emailName} (${segment}) to ${toEmail}`)

    // Set WhyLeaving flag
    if (emailName === 'WhyLeaving') {
      await db.collection('users').doc(userId).update({
        email_whyleaving_sent: true
      })
    }
  } catch (error) {
    console.error(`Failed to send ${emailName} to ${userId}:`, error)
    await logEmail(userId, emailName, 'error', String(error), segment)
  }
}

/**
 * Process the email queue - called by scheduled function
 */
export async function processEmailQueue(): Promise<void> {
  const now = new Date()

  const snapshot = await db
    .collection('email_queue')
    .where('send_at', '<=', now)
    .get()

  if (snapshot.docs.length === 0) return
  console.log(`Processing ${snapshot.docs.length} emails from queue`)

  for (const doc of snapshot.docs) {
    const item = doc.data() as EmailQueueItem

    try {
      // Re-check user and send
      const userDoc = await db.collection('users').doc(item.user_id).get()
      const user = { id: item.user_id, ...userDoc.data() } as User

      const { send, reason } = shouldSendEmail(item.email_name, user)
      if (!send) {
        console.log(`Email ${item.email_name} blocked at send time: ${reason}`)
        await logEmail(item.user_id, item.email_name, 'blocked', reason, item.segment)
        await doc.ref.delete()
        continue
      }

      // Generate email and send
      const { subject, body } = generateEmail(user, item.email_name)
      const fullBody = body + getDebugFooter(user)
      const toEmail = getRecipient(user)

      await getResend().emails.send({
        from: FROM_EMAIL,
        to: toEmail,
        bcc: BCC_EMAIL,
        subject: getEnv() === 'dev' ? `[DEV] ${subject}` : subject,
        text: fullBody
      })

      await logEmail(item.user_id, item.email_name, 'sent', undefined, item.segment)
      console.log(`[${getEnv()}] Sent queued ${item.email_name} (${item.segment}) to ${toEmail}`)

      // Set WhyLeaving flag
      if (item.email_name === 'WhyLeaving') {
        await db.collection('users').doc(item.user_id).update({
          email_whyleaving_sent: true
        })
      }

      // Remove from queue
      await doc.ref.delete()
    } catch (error) {
      console.error(`Failed to process queue item ${doc.id}:`, error)
      await logEmail(item.user_id, item.email_name, 'error', String(error), item.segment)
      await doc.ref.delete()
    }
  }
}

/**
 * Cancel pending emails for a user (e.g., when they create a route)
 */
export async function cancelPendingEmails(
  userId: string,
  emailNames: EmailName[]
): Promise<void> {
  const snapshot = await db
    .collection('email_queue')
    .where('user_id', '==', userId)
    .where('email_name', 'in', emailNames)
    .get()

  for (const doc of snapshot.docs) {
    await doc.ref.delete()
    console.log(`Cancelled pending ${doc.data().email_name} for user ${userId}`)
  }
}

/**
 * Log email activity
 */
async function logEmail(
  userId: string,
  emailName: EmailName,
  status: EmailLog['status'],
  reason?: string,
  segment?: Segment
): Promise<void> {
  const log: Record<string, any> = {
    user_id: userId,
    email_name: emailName,
    segment: segment || emailName,
    scheduled_at: new Date(),
    status,
    variables: {}
  }

  if (reason) {
    log.blocked_reason = reason
  }

  if (status === 'sent') {
    log.sent_at = new Date()
  }

  await db.collection('email_logs').add(log)
}
