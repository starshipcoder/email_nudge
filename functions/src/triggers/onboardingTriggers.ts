import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { scheduleEmail } from '../services/emailService'

const db = admin.firestore()

/**
 * Trigger: User drops out of onboarding
 * Action: Schedule WhatsMissing email (1h)
 */
export const onOnboardingDropped = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    const userId = context.params.userId

    // Check if user just dropped onboarding
    // Condition: was in onboarding (not complete) and now inactive
    if (
      !before.onboarding_dropped &&
      after.onboarding_dropped &&
      !after.onboarding_complete
    ) {
      console.log(`User ${userId} dropped onboarding at step ${after.onboarding_step_reached}`)
      await scheduleEmail(userId, 'WhatsMissing')
    }

    return null
  })

/**
 * Alternative: Triggered by Analytics event
 */
export const onOnboardingDroppedEvent = functions.analytics
  .event('onboarding_dropped')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in onboarding_dropped event')
      return
    }

    console.log(`Analytics: User ${userId} dropped onboarding`)
    await scheduleEmail(userId, 'WhatsMissing')
  })
