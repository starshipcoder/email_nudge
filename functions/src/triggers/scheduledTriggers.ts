import { onSchedule } from 'firebase-functions/v2/scheduler'
import { RESEND_API_KEY } from '../services/emailService'
import { db } from '../index'
import { NUDGE_WEBHOOK_SECRET } from './whatsappTriggers'

// CODE DÉSACTIVÉ - Plus d'emails aux users
// import { sendEmailNow } from '../services/emailService'

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

// URL du VPS nudge server (HTTPS via nginx proxy)
const VPS_NUDGE_URL = process.env.VPS_NUDGE_URL || 'https://api.easyway-planner.com/nudge/nudge-event'

/**
 * Helper: POST an event to the VPS nudge server
 */
async function postNudgeEvent(payload: {
  phone: string
  event_type: string
  platform?: string
  country?: string
  trial?: boolean
  days_since_signup?: number
  urgent?: boolean
}): Promise<void> {
  const response = await fetch(VPS_NUDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Nudge-Secret': NUDGE_WEBHOOK_SECRET.value(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`VPS nudge server returned ${response.status}: ${await response.text()}`)
  }
}

/**
 * WhatsApp lifecycle cron — toutes les 30 minutes
 *
 * Deux scénarios :
 * 1. trial_expiring  — trial se termine dans <= 48h et user n'a pas encore été notifié
 * 2. onboarding_abandoned — a démarré l'onboarding il y a > 24h sans le terminer
 *
 * Ne fait RIEN si le user n'a pas de numéro de téléphone.
 */
export const checkAndSendWhatsApp = onSchedule(
  {
    schedule: 'every 30 minutes',
    secrets: [NUDGE_WEBHOOK_SECRET],
  },
  async () => {
    const now = Date.now()
    const results = { trialExpiring: 0, onboardingAbandoned: 0, skipped: 0 }

    // ── 1. Trial expiring dans <= 48h ──────────────────────────────────────────
    const in48h = new Date(now + 48 * 60 * 60 * 1000)
    const trialSnapshot = await db
      .collection('users')
      .where('trial_active', '==', true)
      .where('trial_end_date', '<=', in48h)
      .where('whatsapp_trial_expiring_sent', '==', false)
      .get()

    for (const doc of trialSnapshot.docs) {
      const user = doc.data()
      const userId = doc.id

      if (!user.phone_number || user.is_test_user) {
        results.skipped++
        continue
      }

      const trialEndDate: Date = user.trial_end_date?.toDate?.() ?? new Date(user.trial_end_date)
      // Ne notifier que si le trial se termine vraiment dans les prochaines 48h (pas déjà expiré)
      if (trialEndDate.getTime() < now) {
        results.skipped++
        continue
      }

      const daysSinceSignup = user.created_at
        ? Math.floor((now - (user.created_at?.toDate?.()?.getTime() ?? new Date(user.created_at).getTime())) / 86400000)
        : 7

      try {
        await postNudgeEvent({
          phone: user.phone_number,
          event_type: 'trial_expiring',
          platform: user.platform || 'ios',
          country: user.country || user.locale?.toUpperCase() || 'FR',
          trial: true,
          days_since_signup: daysSinceSignup,
        })

        await db.collection('users').doc(userId).update({
          whatsapp_trial_expiring_sent: true,
          whatsapp_trial_expiring_sent_at: new Date(),
        })

        console.log(`[WhatsApp Cron] trial_expiring envoyé → ${userId} (trial ends ${trialEndDate.toISOString()})`)
        results.trialExpiring++
      } catch (err) {
        console.error(`[WhatsApp Cron] Erreur trial_expiring pour ${userId}:`, err)
      }
    }

    // ── 2. Onboarding abandonné depuis > 24h ───────────────────────────────────
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const abandonedSnapshot = await db
      .collection('users')
      .where('onboarding_complete', '==', false)
      .where('onboarding_started_at', '<=', oneDayAgo)
      .where('whatsapp_onboarding_abandoned_sent', '==', false)
      .get()

    for (const doc of abandonedSnapshot.docs) {
      const user = doc.data()
      const userId = doc.id

      if (!user.phone_number || user.is_test_user) {
        results.skipped++
        continue
      }

      // Ne pas recontacter si le user a déjà fini l'onboarding entre temps
      // (la query filtre sur onboarding_complete == false mais double-check ici)
      if (user.onboarding_complete) {
        results.skipped++
        continue
      }

      const daysSinceSignup = user.onboarding_started_at
        ? Math.floor((now - (user.onboarding_started_at?.toDate?.()?.getTime() ?? new Date(user.onboarding_started_at).getTime())) / 86400000)
        : 1

      // Ne pas contacter des users trop vieux (> 7 jours = froid, inutile)
      if (daysSinceSignup > 7) {
        results.skipped++
        continue
      }

      try {
        await postNudgeEvent({
          phone: user.phone_number,
          event_type: 'onboarding_abandoned',
          platform: user.platform || 'ios',
          country: user.country || user.locale?.toUpperCase() || 'FR',
          trial: user.trial_active === true,
          days_since_signup: daysSinceSignup,
        })

        await db.collection('users').doc(userId).update({
          whatsapp_onboarding_abandoned_sent: true,
          whatsapp_onboarding_abandoned_sent_at: new Date(),
        })

        console.log(`[WhatsApp Cron] onboarding_abandoned envoyé → ${userId} (J+${daysSinceSignup})`)
        results.onboardingAbandoned++
      } catch (err) {
        console.error(`[WhatsApp Cron] Erreur onboarding_abandoned pour ${userId}:`, err)
      }
    }

    console.log(`[WhatsApp Cron] Results: trialExpiring=${results.trialExpiring}, onboardingAbandoned=${results.onboardingAbandoned}, skipped=${results.skipped}`)
  }
)
