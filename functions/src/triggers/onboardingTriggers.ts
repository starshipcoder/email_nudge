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

    // Find users who haven't completed onboarding and aren't dropped yet
    // Filter by time in memory to avoid composite index requirement
    const snapshot = await db
      .collection('users')
      .where('onboarding_complete', '==', false)
      .where('onboarding_dropped', '==', false)
      .get()

    // Filter by onboarding_started_at in memory
    const usersToProcess = snapshot.docs.filter(doc => {
      const data = doc.data()
      const startedAt = data.onboarding_started_at?.toDate?.()?.getTime() ||
                        data.onboarding_started_at?.getTime?.() ||
                        (data.onboarding_started_at ? new Date(data.onboarding_started_at).getTime() : null)
      return startedAt && startedAt <= oneHourAgo.getTime()
    })

    console.log(`Found ${usersToProcess.length} users with abandoned onboarding`)

    for (const doc of usersToProcess) {
      const userId = doc.id
      const userData = doc.data()

      // Skip if user has kill switch active
      if (userData.has_replied) {
        console.log(`User ${userId} skipped (has_replied)`)
        continue
      }

      // Mark as dropped
      await db.collection('users').doc(userId).update({
        onboarding_dropped: true
      })

      console.log(`User ${userId} dropped onboarding - scheduling WhatsMissing`)
      await scheduleEmail(userId, 'WhatsMissing')
    }
  }
)
