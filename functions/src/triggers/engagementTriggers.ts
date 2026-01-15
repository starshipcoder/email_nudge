import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { cancelPendingEmails } from '../services/emailService'

/**
 * Trigger: User state changes that affect email sequence
 */
export const onUserEngagementChanged = onDocumentUpdated('users/{userId}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  const userId = event.params.userId

  if (!before || !after) return

  // User optimized first route or added visits - cancel pending NeedHelp emails
  const wasInactive = !before.has_added_visits && (before.routes_optimized || 0) === 0
  const isNowActive = after.has_added_visits || (after.routes_optimized || 0) > 0

  if (wasInactive && isNowActive) {
    console.log(`User ${userId} is now active (routes_optimized: ${after.routes_optimized}, has_added_visits: ${after.has_added_visits}) - cancelling pending emails`)
    await cancelPendingEmails(userId, ['NeedHelp', 'NeedHelpWith'])
  }

  // User replied - kill switch
  if (!before.has_replied && after.has_replied) {
    console.log(`User ${userId} replied - kill switch activated`)
    await cancelPendingEmails(userId, [
      'WhatsMissing',
      'FreeOptions',
      'NeedHelp',
      'NeedHelpWith',
      'WhyLeaving'
    ])
  }
})
