import { onSchedule } from 'firebase-functions/v2/scheduler'
import { RESEND_API_KEY } from '../services/emailService'

// CODE DÉSACTIVÉ - Plus d'emails aux users
// import { sendEmailNow } from '../services/emailService'
// import { db } from '../index'

/**
 * TOUS LES EMAILS AUX USERS SONT DÉSACTIVÉS
 * On passe à WhatsApp pour les commerciaux français
 *
 * Seuls les emails à Harold sont actifs :
 * - Récap quotidien (9h)
 * - Alerte churn immédiate
 * - Récap hebdomadaire (lundi 9h)
 */
export const checkAndSendEmails = onSchedule(
  {
    schedule: 'every 30 minutes',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    console.log('[Cron] EMAILS AUX USERS DÉSACTIVÉS - Passage à WhatsApp')
    return // Désactivé temporairement

    /* CODE DÉSACTIVÉ - Ne plus envoyer d'emails aux users
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

      // 2. FreeOptions DÉSACTIVÉ - On ne donne plus d'outils gratuits à ceux qui ne veulent pas payer
      // if (user.onboarding_complete && !user.paywall_passed && !user.email_freeoptions_sent) {
      //   const completedAt = user.onboarding_completed_at?.toDate?.()?.getTime() ||
      //                       user.onboarding_completed_at?.getTime?.() ||
      //                       user.last_action_at?.toDate?.()?.getTime() ||
      //                       (user.onboarding_completed_at ? new Date(user.onboarding_completed_at).getTime() : null)
      //
      //   if (completedAt && (now - completedAt) > getTimeout('paywall', isTestUser)) {
      //     console.log(`[Cron] User ${userId}: sending FreeOptions`)
      //     await sendEmailNow(userId, 'FreeOptions')
      //     await db.collection('users').doc(userId).update({
      //       paywall_blocked: true,
      //       email_freeoptions_sent: true
      //     })
      //     results.freeOptions++
      //     continue
      //   }
      // }

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
    */ // FIN CODE DÉSACTIVÉ
  }
)
