import { onSchedule } from 'firebase-functions/v2/scheduler'
import { scheduleEmail, RESEND_API_KEY } from '../services/emailService'
import { db } from '../index'

/**
 * Scheduled: Check for abandoned onboarding every hour
 * Users who started onboarding > 1h ago and haven't completed → send WhatsMissing
 */
export const checkOnboardingDropped = onSchedule(
  {
    schedule: 'every 1 hours',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Find users who:
    // - Started onboarding > 1h ago
    // - Haven't completed onboarding
    // - Haven't been marked as dropped yet
    const snapshot = await db
      .collection('users')
      .where('onboarding_started_at', '<=', oneHourAgo)
      .where('onboarding_complete', '==', false)
      .where('onboarding_dropped', '==', false)
      .get()

    console.log(`Found ${snapshot.docs.length} users with abandoned onboarding`)

    for (const doc of snapshot.docs) {
      const userId = doc.id

      // Mark as dropped
      await db.collection('users').doc(userId).update({
        onboarding_dropped: true
      })

      console.log(`User ${userId} dropped onboarding - scheduling WhatsMissing`)
      await scheduleEmail(userId, 'WhatsMissing')
    }
  }
)
