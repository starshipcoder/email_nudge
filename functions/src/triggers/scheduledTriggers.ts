import { onSchedule } from 'firebase-functions/v2/scheduler'
import { sendEmailNow, RESEND_API_KEY } from '../services/emailService'
import { db } from '../index'

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

function getTimeout(key: keyof typeof TIMEOUTS, isTestUser: boolean): number {
  return isTestUser ? TEST_TIMEOUTS[key] : TIMEOUTS[key]
}

/**
 * Scheduled: Check and send all emails every 30 minutes
 * - WhatsMissing: onboarding abandoned > 1h
 * - FreeOptions: paywall abandoned > 10min
 * - NoVisits: paywall_passed but no visits > 24h
 * - NoOptimization: has_added_visits but no optimization > 48h
 */
export const checkAndSendEmails = onSchedule(
  {
    schedule: 'every 30 minutes',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    const now = Date.now()
    const results = {
      whatsMissing: 0,
      freeOptions: 0,
      noVisits: 0,
      noOptimization: 0,
      skipped: 0
    }

    // Get all users
    const snapshot = await db.collection('users').get()

    for (const doc of snapshot.docs) {
      const userId = doc.id
      const user = doc.data()

      // Skip if kill switch active
      if (user.has_replied || !user.email) {
        continue
      }

      const isTestUser = user.is_test_user === true

      // 1. Check WhatsMissing (onboarding abandoned)
      if (!user.onboarding_complete && !user.email_whatsmissing_sent) {
        const startedAt = user.onboarding_started_at?.toDate?.()?.getTime() ||
                          user.onboarding_started_at?.getTime?.() ||
                          (user.onboarding_started_at ? new Date(user.onboarding_started_at).getTime() : null)

        if (startedAt && (now - startedAt) > getTimeout('onboarding', isTestUser)) {
          console.log(`[Cron] User ${userId}: sending WhatsMissing`)
          await sendEmailNow(userId, 'WhatsMissing')
          await db.collection('users').doc(userId).update({
            onboarding_dropped: true,
            email_whatsmissing_sent: true
          })
          results.whatsMissing++
          continue // Don't send other emails to this user
        }
      }

      // 2. Check FreeOptions (paywall abandoned)
      if (user.onboarding_complete && !user.paywall_passed && !user.email_freeoptions_sent) {
        const completedAt = user.onboarding_completed_at?.toDate?.()?.getTime() ||
                            user.onboarding_completed_at?.getTime?.() ||
                            user.last_action_at?.toDate?.()?.getTime() ||
                            (user.onboarding_completed_at ? new Date(user.onboarding_completed_at).getTime() : null)

        if (completedAt && (now - completedAt) > getTimeout('paywall', isTestUser)) {
          console.log(`[Cron] User ${userId}: sending FreeOptions`)
          await sendEmailNow(userId, 'FreeOptions')
          await db.collection('users').doc(userId).update({
            paywall_blocked: true,
            email_freeoptions_sent: true
          })
          results.freeOptions++
          continue
        }
      }

      // 3. Check NoVisits (trial but no visits)
      if (user.paywall_passed && !user.has_added_visits && !user.email_novisits_sent) {
        const passedAt = user.paywall_passed_at?.toDate?.()?.getTime() ||
                         user.paywall_passed_at?.getTime?.() ||
                         user.last_action_at?.toDate?.()?.getTime() ||
                         null

        if (passedAt && (now - passedAt) > getTimeout('noVisits', isTestUser)) {
          console.log(`[Cron] User ${userId}: sending NoVisits`)
          await sendEmailNow(userId, 'NoVisits')
          await db.collection('users').doc(userId).update({
            email_novisits_sent: true
          })
          results.noVisits++
          continue
        }
      }

      // 4. Check NoOptimization (has visits but no optimization)
      if (user.has_added_visits && !user.has_optimized_route && !user.email_nooptimization_sent) {
        const visitAddedAt = user.visit_added_at?.toDate?.()?.getTime() ||
                             user.visit_added_at?.getTime?.() ||
                             user.last_action_at?.toDate?.()?.getTime() ||
                             null

        if (visitAddedAt && (now - visitAddedAt) > getTimeout('noOptimization', isTestUser)) {
          console.log(`[Cron] User ${userId}: sending NoOptimization`)
          await sendEmailNow(userId, 'NoOptimization')
          await db.collection('users').doc(userId).update({
            email_nooptimization_sent: true
          })
          results.noOptimization++
        }
      }
    }

    console.log(`[Cron] Results: WhatsMissing=${results.whatsMissing}, FreeOptions=${results.freeOptions}, NoVisits=${results.noVisits}, NoOptimization=${results.noOptimization}`)
  }
)
