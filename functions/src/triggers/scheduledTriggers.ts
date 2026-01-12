import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { processEmailQueue, sendEmailNow } from '../services/emailService'

const db = admin.firestore()

/**
 * Scheduled: Process email queue every minute
 */
export const processQueue = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    await processEmailQueue()
    return null
  })

/**
 * Scheduled: Check for trials ending in 2 days and send TrialEndsSoon
 * Runs daily at 9:00 AM
 */
export const checkTrialEnding = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const now = new Date()
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // Find users with trial ending in 2-3 days
    const snapshot = await db
      .collection('users')
      .where('trial_active', '==', true)
      .where('trial_end_date', '>=', twoDaysFromNow)
      .where('trial_end_date', '<', threeDaysFromNow)
      .get()

    console.log(`Found ${snapshot.docs.length} users with trial ending soon`)

    for (const doc of snapshot.docs) {
      const user = doc.data()
      const userId = doc.id

      // Calculate days remaining
      const trialEndDate = user.trial_end_date.toDate()
      const daysRemaining = Math.ceil(
        (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )

      console.log(`Sending TrialEndsSoon to ${userId} (${daysRemaining} days remaining)`)

      await sendEmailNow(userId, 'TrialEndsSoon', { days_remaining: daysRemaining })
    }

    return null
  })
