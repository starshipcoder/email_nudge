import { Resend } from 'resend'
import * as admin from 'firebase-admin'
import { User, EmailName, Segment, EmailQueueItem, EmailLog } from '../types'
import { resolveSegment, shouldSendEmail } from '../utils/segmentResolver'
import { renderTemplate, getTemplateVariables } from '../templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const db = admin.firestore()

const FROM_EMAIL = 'Harold <harold@easyway.app>'

// Delays in milliseconds
const DELAYS: Record<EmailName, number> = {
  WhatsMissing: 60 * 60 * 1000,        // 1 hour
  FreeOptions: 10 * 60 * 1000,          // 10 minutes
  QuickStart: 0,                         // Immediate
  NeedHelp: 24 * 60 * 60 * 1000,        // 24 hours
  NeedHelpWith: 48 * 60 * 60 * 1000,    // 48 hours
  TrialEndsSoon: 0,                      // Scheduled separately
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

  // Get variables
  const variables = {
    ...getTemplateVariables(user),
    ...extraVariables
  }

  // Add to queue
  const queueItem: EmailQueueItem = {
    user_id: userId,
    email_name: emailName,
    segment,
    send_at: sendAt,
    created_at: new Date(),
    variables: variables as Record<string, string | string[]>
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

  // Resolve segment and render
  const segment = resolveSegment(emailName, user)
  const variables = {
    ...getTemplateVariables(user),
    ...extraVariables
  }
  const { subject, body } = renderTemplate(segment, variables)

  // Send via Resend
  try {
    const toEmail = user.is_test_user ? 'harold+test@easyway.app' : user.email

    await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      text: body
    })

    await logEmail(userId, emailName, 'sent', undefined, segment)
    console.log(`Sent ${emailName} (${segment}) to ${toEmail}`)

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

      // Render and send
      const { subject, body } = renderTemplate(item.segment, item.variables)
      const toEmail = user.is_test_user ? 'harold+test@easyway.app' : user.email

      await resend.emails.send({
        from: FROM_EMAIL,
        to: toEmail,
        subject,
        text: body
      })

      await logEmail(item.user_id, item.email_name, 'sent', undefined, item.segment)
      console.log(`Sent queued ${item.email_name} (${item.segment}) to ${toEmail}`)

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
  const log: EmailLog = {
    user_id: userId,
    email_name: emailName,
    segment: segment || (emailName as unknown as Segment),
    scheduled_at: new Date(),
    status,
    blocked_reason: reason,
    variables: {}
  }

  if (status === 'sent') {
    log.sent_at = new Date()
  }

  await db.collection('email_logs').add(log)
}
