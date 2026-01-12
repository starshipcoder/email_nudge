import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { cancelPendingEmails } from '../services/emailService'

const db = admin.firestore()

/**
 * Trigger: User creates a route
 * Action: Cancel pending NeedHelp and NeedHelpWith emails
 */
export const onRouteCreated = functions.analytics
  .event('route_created')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in route_created event')
      return
    }

    console.log(`User ${userId} created a route`)

    // Update user stats
    await db.collection('users').doc(userId).update({
      routes_created: admin.firestore.FieldValue.increment(1),
      last_action_at: new Date()
    })

    // Cancel pending "no route" emails
    await cancelPendingEmails(userId, ['NeedHelp', 'NeedHelpWith'])
  })

/**
 * Trigger: User optimizes a route
 * Action: Update stats
 */
export const onRouteOptimized = functions.analytics
  .event('route_optimized')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in route_optimized event')
      return
    }

    console.log(`User ${userId} optimized a route`)

    await db.collection('users').doc(userId).update({
      routes_optimized: admin.firestore.FieldValue.increment(1),
      last_action_at: new Date()
    })
  })

/**
 * Trigger: User adds a prospect
 * Action: Update stats
 */
export const onProspectAdded = functions.analytics
  .event('prospect_added')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in prospect_added event')
      return
    }

    await db.collection('users').doc(userId).update({
      prospects_added: admin.firestore.FieldValue.increment(1),
      last_action_at: new Date()
    })
  })

/**
 * Trigger: User replies to an email (webhook from email service or manual flag)
 * Action: Set has_replied to stop sequence
 */
export const onUserReplied = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    const userId = context.params.userId

    if (!before.has_replied && after.has_replied) {
      console.log(`User ${userId} replied - kill switch activated`)
      // Cancel all pending emails except TrialEndsSoon
      await cancelPendingEmails(userId, [
        'WhatsMissing',
        'FreeOptions',
        'NeedHelp',
        'NeedHelpWith',
        'WhyLeaving'
      ])
    }

    return null
  })
