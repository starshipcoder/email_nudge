import { onRequest } from 'firebase-functions/v2/https'
import { RESEND_API_KEY, sendEmailNow } from '../services/emailService'
import { generateEmail } from '../services/emailGenerator'
import { sendDailyRecap } from '../services/dailyRecapService'
import { sendWeeklyRecap } from '../services/weeklyRecapService'
import { sendChurnAlert } from '../services/churnAlertService'
import { Resend } from 'resend'
import { db } from '../index'
import { EmailName, User } from '../types'

const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
const TEST_RECIPIENT = 'harold+test@easyway-planner.com'

// Timeouts for production (in milliseconds)
const TIMEOUTS = {
  onboarding: 60 * 60 * 1000,         // 1 hour
  paywall: 10 * 60 * 1000,            // 10 minutes
  noVisits: 24 * 60 * 60 * 1000,      // 24 hours
  noOptimization: 48 * 60 * 60 * 1000 // 48 hours
}

// Timeouts for test users (in milliseconds)
const TEST_TIMEOUTS = {
  onboarding: 30 * 1000,      // 30 seconds
  paywall: 30 * 1000,         // 30 seconds
  noVisits: 30 * 1000,        // 30 seconds
  noOptimization: 30 * 1000   // 30 seconds
}

/**
 * Test endpoint to manually trigger an email
 * Usage: GET /testSendEmail?userId=xxx&emailName=WhatsMissing
 */
export const testSendEmail = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    const userId = req.query.userId as string
    const emailName = req.query.emailName as EmailName

    if (!userId || !emailName) {
      res.status(400).json({
        error: 'Missing parameters',
        usage: '/testSendEmail?userId=xxx&emailName=WhatsMissing',
        availableEmails: ['WhatsMissing', 'QuickStart', 'NoVisits', 'NoOptimization', 'WhyLeaving'] // FreeOptions désactivé
      })
      return
    }

    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      res.status(404).json({ error: `User ${userId} not found` })
      return
    }

    const user = { id: userId, ...userDoc.data() } as User

    try {
      const { subject, body } = generateEmail(user, emailName)
      const resend = new Resend(RESEND_API_KEY.value())
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject,
        text: body
      })

      res.json({
        success: true,
        message: `Test email ${emailName} sent`,
        to: TEST_RECIPIENT,
        subject,
        resendId: result.data?.id
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to send email',
        details: String(error)
      })
    }
  }
)

/**
 * Test endpoint to reset a user
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
      paywall_blocked: false,
      paywall_passed: false,
      paywall_passed_at: null,
      has_added_visits: false,
      visit_added_at: null,
      has_optimized_route: false,
      has_replied: false,
      email_whatsmissing_sent: false,
      email_freeoptions_sent: false,
      email_novisits_sent: false,
      email_nooptimization_sent: false,
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
      deletedLogItems: logsSnapshot.docs.length
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
      paywall_blocked: false,
      paywall_passed: false,
      has_added_visits: false,
      has_optimized_route: false,
      has_replied: false,
      email_whatsmissing_sent: false,
      email_freeoptions_sent: false,
      email_novisits_sent: false,
      email_nooptimization_sent: false,
      email_whyleaving_sent: false,
      trial_active: false,
      subscription_active: false,
      plan: 'free',
      is_test_user: true
    }

    await db.collection('users').doc(userId).set(testUser)

    res.json({
      success: true,
      userId,
      user: testUser
    })
  }
)

/**
 * Test endpoint to manually trigger the cron logic
 * This runs the same logic as checkAndSendEmails but returns results
 * Usage: GET /testTriggerCron
 */
export const testTriggerCron = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    const now = Date.now()
    const results: { userId: string; email: string; status: string }[] = []
    const debug: { userId: string; reason: string; details?: Record<string, unknown> }[] = []

    const snapshot = await db.collection('users').get()

    for (const doc of snapshot.docs) {
      const userId = doc.id
      const user = doc.data()

      // Skip if kill switch active
      if (user.has_replied || !user.email) {
        debug.push({ userId, reason: 'skipped: has_replied or no email' })
        continue
      }

      const isTestUser = user.is_test_user === true
      const timeouts = isTestUser ? TEST_TIMEOUTS : TIMEOUTS

      // 1. Check WhatsMissing (onboarding abandoned)
      if (!user.onboarding_complete && !user.email_whatsmissing_sent) {
        const rawStartedAt = user.onboarding_started_at
        const startedAt = rawStartedAt?.toDate?.()?.getTime() ||
                          rawStartedAt?.getTime?.() ||
                          (rawStartedAt ? new Date(rawStartedAt).getTime() : null)

        const elapsed = startedAt ? now - startedAt : null
        const timeout = timeouts.onboarding

        if (startedAt && elapsed! > timeout) {
          console.log(`[TestCron] User ${userId}: sending WhatsMissing`)
          await sendEmailNow(userId, 'WhatsMissing')
          await db.collection('users').doc(userId).update({
            onboarding_dropped: true,
            email_whatsmissing_sent: true
          })
          results.push({ userId, email: 'WhatsMissing', status: 'sent' })
          continue
        } else {
          debug.push({
            userId,
            reason: 'WhatsMissing: timeout not reached',
            details: {
              rawType: typeof rawStartedAt,
              hasToDate: typeof rawStartedAt?.toDate === 'function',
              hasGetTime: typeof rawStartedAt?.getTime === 'function',
              startedAt,
              elapsed,
              timeout,
              now
            }
          })
        }
      }

      // 2. FreeOptions DÉSACTIVÉ - On ne donne plus d'outils gratuits
      // if (user.onboarding_complete && !user.paywall_passed && !user.email_freeoptions_sent) {
      //   const completedAt = user.onboarding_completed_at?.toDate?.()?.getTime() ||
      //                       user.onboarding_completed_at?.getTime?.() ||
      //                       (user.onboarding_completed_at ? new Date(user.onboarding_completed_at).getTime() : null)
      //
      //   if (completedAt && (now - completedAt) > timeouts.paywall) {
      //     console.log(`[TestCron] User ${userId}: sending FreeOptions`)
      //     await sendEmailNow(userId, 'FreeOptions')
      //     await db.collection('users').doc(userId).update({
      //       paywall_blocked: true,
      //       email_freeoptions_sent: true
      //     })
      //     results.push({ userId, email: 'FreeOptions', status: 'sent' })
      //     continue
      //   }
      // }

      // 3. Check NoVisits (trial but no visits)
      if (user.paywall_passed && !user.has_added_visits && !user.email_novisits_sent) {
        const passedAt = user.paywall_passed_at?.toDate?.()?.getTime() ||
                         user.paywall_passed_at?.getTime?.() ||
                         (user.paywall_passed_at ? new Date(user.paywall_passed_at).getTime() : null)

        if (passedAt && (now - passedAt) > timeouts.noVisits) {
          console.log(`[TestCron] User ${userId}: sending NoVisits`)
          await sendEmailNow(userId, 'NoVisits')
          await db.collection('users').doc(userId).update({
            email_novisits_sent: true
          })
          results.push({ userId, email: 'NoVisits', status: 'sent' })
          continue
        }
      }

      // 4. Check NoOptimization (has visits but no optimization)
      if (user.has_added_visits && !user.has_optimized_route && !user.email_nooptimization_sent) {
        const visitAddedAt = user.visit_added_at?.toDate?.()?.getTime() ||
                             user.visit_added_at?.getTime?.() ||
                             (user.visit_added_at ? new Date(user.visit_added_at).getTime() : null)

        if (visitAddedAt && (now - visitAddedAt) > timeouts.noOptimization) {
          console.log(`[TestCron] User ${userId}: sending NoOptimization`)
          await sendEmailNow(userId, 'NoOptimization')
          await db.collection('users').doc(userId).update({
            email_nooptimization_sent: true
          })
          results.push({ userId, email: 'NoOptimization', status: 'sent' })
        }
      }
    }

    res.json({
      success: true,
      message: `Cron executed, ${results.length} emails sent`,
      results,
      debug
    })
  }
)

/**
 * Get current environment info (for debugging)
 * Usage: GET /getEnvInfo
 */
export const getEnvInfo = onRequest(
  async (req, res) => {
    res.json({
      env: process.env.ENV || 'not set (default: prod)',
      timestamp: new Date().toISOString()
    })
  }
)

/**
 * Get email logs for a user
 * Usage: GET /getEmailLogs?userId=xxx
 */
export const getEmailLogs = onRequest(
  async (req, res) => {
    const userId = req.query.userId as string

    if (!userId) {
      // Return all recent logs
      const logsSnapshot = await db.collection('email_logs')
        .orderBy('scheduled_at', 'desc')
        .limit(50)
        .get()

      const logs = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      res.json({ success: true, count: logs.length, logs })
      return
    }

    // Return logs for specific user
    const logsSnapshot = await db.collection('email_logs')
      .where('user_id', '==', userId)
      .orderBy('scheduled_at', 'desc')
      .get()

    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    res.json({ success: true, userId, count: logs.length, logs })
  }
)

/**
 * Test endpoint to manually trigger daily recap
 * Usage: GET /testDailyRecap
 */
export const testDailyRecap = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    try {
      const result = await sendDailyRecap()
      res.json(result)
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Exception: ${String(error)}`,
        total_emails_yesterday: 0,
        sales_emails: 0,
        email_sent: false
      })
    }
  }
)

/**
 * Test endpoint to manually trigger weekly recap
 * Usage: GET /testWeeklyRecap
 */
export const testWeeklyRecap = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    try {
      const result = await sendWeeklyRecap()
      res.json(result)
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Exception: ${String(error)}`,
        total_emails_week: 0,
        total_users: 0,
        email_sent: false
      })
    }
  }
)

/**
 * Test endpoint to manually trigger churn alert
 * Usage: GET /testChurnAlert?userId=xxx
 */
export const testChurnAlert = onRequest(
  { secrets: [RESEND_API_KEY] },
  async (req, res) => {
    const userId = req.query.userId as string

    if (!userId) {
      res.status(400).json({
        error: 'Missing userId parameter',
        usage: '/testChurnAlert?userId=xxx'
      })
      return
    }

    try {
      await sendChurnAlert(userId)
      res.json({
        success: true,
        message: `Churn alert sent for user ${userId}`
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: String(error)
      })
    }
  }
)
