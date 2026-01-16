import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { cancelPendingEmails } from '../services/emailService'

/**
 * Trigger: User state changes that affect email sequence
 */
export const onUserEngagementChanged = onDocumentUpdated(
  {
    document: 'users/{userId}',
    database: 'email-nudge'
  },
  async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  const userId = event.params.userId

  if (!before || !after) return

  // User optimized first route or added visits - cancel pending NeedHelp emails
  const wasInactive = !before.has_added_visits && !before.has_optimized_route
  const isNowActive = after.has_added_visits || after.has_optimized_route

  if (wasInactive && isNowActive) {
    console.log(`User ${userId} is now active (has_optimized_route: ${after.has_optimized_route}, has_added_visits: ${after.has_added_visits}) - cancelling pending emails`)
    await cancelPendingEmails(userId, ['NoVisits', 'NoOptimization'])
  }

  // User replied - kill switch
  if (!before.has_replied && after.has_replied) {
    console.log(`User ${userId} replied - kill switch activated`)
    await cancelPendingEmails(userId, [
      'WhatsMissing',
      'FreeOptions',
      'NoVisits',
      'NoOptimization',
      'WhyLeaving'
    ])
  }
})
