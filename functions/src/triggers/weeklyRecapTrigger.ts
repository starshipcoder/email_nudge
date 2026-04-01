import { onSchedule } from 'firebase-functions/v2/scheduler'
import { sendWeeklyRecap } from '../services/weeklyRecapService'
import { RESEND_API_KEY } from '../services/emailService'

/**
 * Scheduled: Send weekly recap every Monday at 9:00 AM Paris time
 */
export const sendWeeklyEmailRecap = onSchedule(
  {
    schedule: '0 9 * * 1', // Every Monday at 9:00 AM
    timeZone: 'Europe/Paris',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    console.log('[Weekly Recap Trigger] Starting weekly recap at', new Date())
    await sendWeeklyRecap()
    console.log('[Weekly Recap Trigger] Completed')
  }
)
