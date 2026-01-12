import * as functions from 'firebase-functions'
import { scheduleEmail, sendEmailNow } from '../services/emailService'

/**
 * Trigger: User blocked at paywall (leaves without passing)
 * Action: Schedule FreeOptions email (10min)
 */
export const onPaywallBlocked = functions.analytics
  .event('paywall_blocked')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in paywall_blocked event')
      return
    }

    console.log(`User ${userId} blocked at paywall`)
    await scheduleEmail(userId, 'FreeOptions')
  })

/**
 * Trigger: User passes paywall (trial or payment)
 * Action: Send QuickStart immediately, schedule NeedHelp (24h) and NeedHelpWith (48h)
 */
export const onPaywallPassed = functions.analytics
  .event('paywall_passed')
  .onLog(async (event) => {
    const userId = event.user?.userId
    if (!userId) {
      console.error('No userId in paywall_passed event')
      return
    }

    console.log(`User ${userId} passed paywall`)

    // Send QuickStart immediately
    await sendEmailNow(userId, 'QuickStart')

    // Schedule follow-up emails
    await scheduleEmail(userId, 'NeedHelp')
    await scheduleEmail(userId, 'NeedHelpWith')
  })
