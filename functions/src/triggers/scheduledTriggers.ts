import { onSchedule } from 'firebase-functions/v2/scheduler'
import { processEmailQueue, RESEND_API_KEY } from '../services/emailService'

/**
 * Scheduled: Process email queue every 5 minutes
 */
export const processQueue = onSchedule(
  {
    schedule: 'every 5 minutes',
    secrets: [RESEND_API_KEY]
  },
  async () => {
    await processEmailQueue()
  }
)

