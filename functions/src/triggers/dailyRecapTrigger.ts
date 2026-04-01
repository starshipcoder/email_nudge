import { onSchedule } from 'firebase-functions/v2/scheduler'
import { sendDailyRecap } from '../services/dailyRecapService'
import { RESEND_API_KEY } from '../services/emailService'

/**
 * Scheduled: Send daily recap every day at 9:00 AM Paris time
 * Recap includes all emails sent to sales people (field_sales, sales_director) in the last 24h
 */
export const sendDailyEmailRecap = onSchedule(
  {
    schedule: '0 9 * * *', // Every day at 9:00 AM
    timeZone: 'Europe/Paris',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    console.log('[Daily Recap Trigger] Starting daily recap at', new Date())
    await sendDailyRecap()
    console.log('[Daily Recap Trigger] Completed')
  }
)
