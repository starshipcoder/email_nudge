import { onRequest } from 'firebase-functions/v2/https'
import { RESEND_API_KEY, ANTHROPIC_API_KEY } from '../services/emailService'
import { generateEmail } from '../services/aiEmailGenerator'
import { Resend } from 'resend'
import { db } from '../index'
import { EmailName, User } from '../types'

const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
const TEST_RECIPIENT = 'harold+test@easyway-planner.com'

/**
 * Test endpoint to manually trigger an email (with Anthropic AI)
 * Usage: GET /testSendEmail?userId=xxx&emailName=WhatsMissing
 */
export const testSendEmail = onRequest(
  { secrets: [RESEND_API_KEY, ANTHROPIC_API_KEY] },
  async (req, res) => {
    const userId = req.query.userId as string
    const emailName = req.query.emailName as EmailName

    if (!userId || !emailName) {
      res.status(400).json({
        error: 'Missing parameters',
        usage: '/testSendEmail?userId=xxx&emailName=WhatsMissing',
        availableEmails: ['WhatsMissing', 'FreeOptions', 'QuickStart', 'NoVisits', 'NoOptimization', 'WhyLeaving']
      })
      return
    }

    // Check user exists
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      res.status(404).json({ error: `User ${userId} not found` })
      return
    }

    const user = { id: userId, ...userDoc.data() } as User
    console.log(`[TEST] Sending ${emailName} to user ${userId}`)

    try {
      // Generate email with AI
      const { subject, body } = await generateEmail(user, emailName)

      // Send via Resend
      const resend = new Resend(RESEND_API_KEY.value())
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject,
        text: body
      })

      console.log(`[TEST] Resend result:`, JSON.stringify(result))

      res.json({
        success: true,
        message: `Test email ${emailName} sent`,
        to: TEST_RECIPIENT,
        subject,
        resendId: result.data?.id
      })
    } catch (error) {
      console.error(`[TEST] Error:`, error)
      res.status(500).json({
        error: 'Failed to send email',
        details: String(error)
      })
    }
  }
)

/**
 * Test endpoint to reset a user (delete and recreate, or just reset fields)
 * Usage: GET /testResetUser?userId=xxx
 */
export const testResetUser = onRequest(
  async (req, res) => {
    const userId = req.query.userId as string

    if (!userId) {
      res.status(400).json({
        error: 'Missing userId parameter',
        usage: '/testResetUser?userId=xxx'
      })
      return
    }

    // Delete email_queue entries for this user
    const queueSnapshot = await db.collection('email_queue').where('user_id', '==', userId).get()
    for (const doc of queueSnapshot.docs) {
      await doc.ref.delete()
    }

    // Delete email_logs entries for this user
    const logsSnapshot = await db.collection('email_logs').where('user_id', '==', userId).get()
    for (const doc of logsSnapshot.docs) {
      await doc.ref.delete()
    }

    // Reset user fields
    const resetData = {
      onboarding_started_at: new Date(),
      onboarding_complete: false,
      onboarding_dropped: false,
      paywall_seen: false,
      paywall_abandoned: false,
      has_added_visits: false,
      has_optimized_route: false,
      has_replied: false,
      email_whyleaving_sent: false,
      trial_active: false,
      subscription_active: false,
      churned_at: null,
      trial_start_date: null,
      trial_end_date: null
    }

    await db.collection('users').doc(userId).update(resetData)

    res.json({
      success: true,
      message: `User ${userId} reset`,
      deletedQueueItems: queueSnapshot.docs.length,
      deletedLogItems: logsSnapshot.docs.length,
      testUrls: {
        sendWhatsMissing: `https://us-central1-contact-on-map-flutter.cloudfunctions.net/testSendEmail?userId=${userId}&emailName=WhatsMissing`,
        sendFreeOptions: `https://us-central1-contact-on-map-flutter.cloudfunctions.net/testSendEmail?userId=${userId}&emailName=FreeOptions`,
        sendQuickStart: `https://us-central1-contact-on-map-flutter.cloudfunctions.net/testSendEmail?userId=${userId}&emailName=QuickStart`
      }
    })
  }
)

/**
 * Test endpoint to delete a user completely
 * Usage: GET /testDeleteUser?userId=xxx
 */
export const testDeleteUser = onRequest(
  async (req, res) => {
    const userId = req.query.userId as string

    if (!userId) {
      res.status(400).json({
        error: 'Missing userId parameter',
        usage: '/testDeleteUser?userId=xxx'
      })
      return
    }

    // Delete email_queue entries for this user
    const queueSnapshot = await db.collection('email_queue').where('user_id', '==', userId).get()
    for (const doc of queueSnapshot.docs) {
      await doc.ref.delete()
    }

    // Delete email_logs entries for this user
    const logsSnapshot = await db.collection('email_logs').where('user_id', '==', userId).get()
    for (const doc of logsSnapshot.docs) {
      await doc.ref.delete()
    }

    // Delete user
    await db.collection('users').doc(userId).delete()

    res.json({
      success: true,
      message: `User ${userId} deleted`,
      deletedQueueItems: queueSnapshot.docs.length,
      deletedLogItems: logsSnapshot.docs.length
    })
  }
)

/**
 * Test endpoint to create a test user
 * Usage: GET /testCreateUser
 */
export const testCreateUser = onRequest(
  async (req, res) => {
    const userId = 'test-user-' + Date.now()

    const testUser = {
      email: 'toto@toto.com',
      locale: 'fr',
      role: 'delivery',
      needs: ['max_visits'],
      onboarding_started_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      onboarding_complete: false,
      onboarding_dropped: false,
      paywall_seen: false,
      paywall_abandoned: false,
      has_added_visits: false,
      has_optimized_route: false,
      has_replied: false,
      email_whyleaving_sent: false,
      trial_active: false,
      subscription_active: false
    }

    await db.collection('users').doc(userId).set(testUser)

    res.json({
      success: true,
      userId,
      user: testUser,
      testUrls: {
        sendWhatsMissing: `https://us-central1-contact-on-map-flutter.cloudfunctions.net/testSendEmail?userId=${userId}&emailName=WhatsMissing`,
        sendFreeOptions: `https://us-central1-contact-on-map-flutter.cloudfunctions.net/testSendEmail?userId=${userId}&emailName=FreeOptions`,
        sendQuickStart: `https://us-central1-contact-on-map-flutter.cloudfunctions.net/testSendEmail?userId=${userId}&emailName=QuickStart`
      }
    })
  }
)
