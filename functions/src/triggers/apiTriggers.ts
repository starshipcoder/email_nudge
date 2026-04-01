import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { db } from '../index'
import { Role, Need, Locale } from '../types'
import { FieldValue } from 'firebase-admin/firestore'

// API Key for mobile app authentication
export const EMAIL_NUDGE_API_KEY = defineSecret('EMAIL_NUDGE_API_KEY')

/**
 * Verify API key from request header
 */
function verifyApiKey(req: any, res: any): boolean {
  const apiKey = req.headers['x-api-key']

  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' })
    return false
  }

  if (apiKey !== EMAIL_NUDGE_API_KEY.value()) {
    res.status(403).json({ error: 'Invalid API key' })
    return false
  }

  return true
}

// Valid values for validation
const VALID_ROLES: Role[] = ['delivery', 'field_sales', 'technician', 'sales_director', 'other']

// Timeouts for production (in milliseconds)
const TIMEOUTS: Record<string, number> = {
  WhatsMissing: 60 * 60 * 1000,        // 1 hour after onboarding_started_at
  FreeOptions: 10 * 60 * 1000,          // 10 minutes after onboarding_completed_at
  QuickStart: 0,                         // Immediate after paywall_passed
  NoVisits: 24 * 60 * 60 * 1000,        // 24 hours after paywall_passed_at
  NoOptimization: 48 * 60 * 60 * 1000,  // 48 hours after visit_added_at
  WhyLeaving: 30 * 60 * 1000            // 30 minutes after churn
}

// Timeouts for test users (30 seconds each)
const TEST_TIMEOUTS: Record<string, number> = {
  WhatsMissing: 30 * 1000,
  FreeOptions: 30 * 1000,
  QuickStart: 0,
  NoVisits: 30 * 1000,
  NoOptimization: 30 * 1000,
  WhyLeaving: 30 * 1000
}

function getTimeout(emailName: string, isTestUser: boolean): number {
  if (isTestUser) {
    return TEST_TIMEOUTS[emailName] || 0
  }
  return TIMEOUTS[emailName] || 0
}

interface UserStatus {
  current_stage: string
  next_email: string | null
  next_email_reason: string | null
  next_email_at: string | null
  blockers: string[]
  is_test_user: boolean
}

/**
 * Compute user status and next expected email
 */
function computeUserStatus(userData: Record<string, any>): UserStatus {
  const isTestUser = userData.is_test_user === true
  const blockers: string[] = []

  // Check kill switches
  if (userData.has_replied) {
    blockers.push('has_replied: true (kill switch active)')
  }
  if (!userData.email) {
    blockers.push('email: missing')
  }

  // If blocked, no emails will be sent
  if (blockers.length > 0) {
    return {
      current_stage: 'blocked',
      next_email: null,
      next_email_reason: null,
      next_email_at: null,
      blockers,
      is_test_user: isTestUser
    }
  }

  // Determine current stage and next email

  // Stage 1: Onboarding not complete
  if (!userData.onboarding_complete) {
    const startedAt = userData.onboarding_started_at?.toDate?.()?.getTime() ||
                      userData.onboarding_started_at?.getTime?.() ||
                      (userData.onboarding_started_at ? new Date(userData.onboarding_started_at).getTime() : null)

    if (!startedAt) {
      return {
        current_stage: 'waiting_onboarding_start',
        next_email: 'WhatsMissing',
        next_email_reason: 'Waiting for onboarding_started_at to be set',
        next_email_at: null,
        blockers: [],
        is_test_user: isTestUser
      }
    }

    if (!userData.onboarding_dropped) {
      const delay = getTimeout('WhatsMissing', isTestUser)
      const sendAt = new Date(startedAt + delay)
      return {
        current_stage: 'onboarding_in_progress',
        next_email: 'WhatsMissing',
        next_email_reason: `onboarding_started_at: ${new Date(startedAt).toISOString()}, onboarding_complete: false`,
        next_email_at: sendAt.toISOString(),
        blockers: [],
        is_test_user: isTestUser
      }
    }

    // Already dropped, WhatsMissing should be queued/sent
    return {
      current_stage: 'onboarding_dropped',
      next_email: null,
      next_email_reason: 'WhatsMissing already scheduled/sent',
      next_email_at: null,
      blockers: [],
      is_test_user: isTestUser
    }
  }

  // Stage 2: Onboarding complete, paywall decision pending
  if (!userData.paywall_passed && !userData.paywall_blocked) {
    return {
      current_stage: 'paywall_pending',
      next_email: null,
      next_email_reason: 'Waiting for paywall_passed or paywall_blocked',
      next_email_at: null,
      blockers: [],
      is_test_user: isTestUser
    }
  }

  // Stage 2a: Paywall blocked (didn't start trial) - FreeOptions désactivé
  if (userData.paywall_blocked && !userData.paywall_passed) {
    return {
      current_stage: 'paywall_blocked',
      next_email: 'none',
      next_email_reason: 'paywall_blocked: true, paywall_passed: false (FreeOptions désactivé)',
      next_email_at: 'N/A',
      blockers: [],
      is_test_user: isTestUser
    }
  }

  // Stage 3: Paywall passed (trial/subscription started)
  if (userData.paywall_passed) {
    // QuickStart sent immediately

    // Check engagement
    if (!userData.has_added_visits) {
      const delayMs = getTimeout('NoVisits', isTestUser)
      const delayStr = isTestUser ? `~${Math.round(delayMs / 60000)}min` : '24h'
      return {
        current_stage: 'trial_no_visits',
        next_email: 'NoVisits',
        next_email_reason: 'paywall_passed: true, has_added_visits: false',
        next_email_at: `${delayStr} after paywall_passed`,
        blockers: [],
        is_test_user: isTestUser
      }
    }

    if (!userData.has_optimized_route) {
      const delayMs = getTimeout('NoOptimization', isTestUser)
      const delayStr = isTestUser ? `~${Math.round(delayMs / 60000)}min` : '48h'
      return {
        current_stage: 'trial_no_optimization',
        next_email: 'NoOptimization',
        next_email_reason: 'has_added_visits: true, has_optimized_route: false',
        next_email_at: `${delayStr} after first visit`,
        blockers: [],
        is_test_user: isTestUser
      }
    }

    // Engaged user
    return {
      current_stage: 'engaged',
      next_email: null,
      next_email_reason: 'User is engaged (has visits + optimized route)',
      next_email_at: null,
      blockers: [],
      is_test_user: isTestUser
    }
  }

  // Churned user
  if (userData.churned_at) {
    if (userData.email_whyleaving_sent) {
      return {
        current_stage: 'churned',
        next_email: null,
        next_email_reason: 'WhyLeaving already sent',
        next_email_at: null,
        blockers: [],
        is_test_user: isTestUser
      }
    }
    const delayMs = getTimeout('WhyLeaving', isTestUser)
    const delayStr = isTestUser ? `${Math.round(delayMs / 1000)}s` : '30min'
    return {
      current_stage: 'churned',
      next_email: 'WhyLeaving',
      next_email_reason: 'churned_at is set, email_whyleaving_sent: false',
      next_email_at: `${delayStr} after churn`,
      blockers: [],
      is_test_user: isTestUser
    }
  }

  return {
    current_stage: 'unknown',
    next_email: null,
    next_email_reason: null,
    next_email_at: null,
    blockers: [],
    is_test_user: isTestUser
  }
}
const VALID_NEEDS: Need[] = ['hotel_search', 'new_clients', 'complex_routes', 'max_visits', 'multi_day', 'client_tracking']
const VALID_LOCALES: Locale[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl']
const VALID_PLANS = ['free', 'trial', 'monthly', 'yearly']

interface SyncUserRequest {
  email: string  // Required: used as document ID
  revenuecat_id?: string  // Optional: stored as field for RevenueCat webhook lookups
  first_name?: string
  phone_number?: string  // Optional: any format
  locale?: string
  role?: string
  needs?: string[]
  onboarding_started_at?: string
  onboarding_complete?: boolean
  onboarding_completed_at?: string
  paywall_passed?: boolean
  visit_added?: boolean
  has_optimized_route?: boolean
  subscription_active?: boolean
  trial_active?: boolean
  trial_start_date?: string
  trial_end_date?: string
  plan?: string
  is_test_user?: boolean
  dry_run?: boolean
  has_replied?: boolean
  // Test-only: offset in seconds from server time for date fields
  // e.g., -120 means "2 minutes ago" relative to server time
  _test_time_offset_seconds?: number
}

/**
 * Sync user data from the mobile app
 * POST /syncUser
 * Body: { email: "...", ... }
 * Document ID is the email (lowercase, trimmed)
 */
export const syncUser = onRequest(
  { cors: true, secrets: [EMAIL_NUDGE_API_KEY] },
  async (req, res) => {
    // Verify API key
    if (!verifyApiKey(req, res)) return

    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed', allowedMethods: ['POST'] })
      return
    }

    const data = req.body as SyncUserRequest

    // LOG: Print full request body to debug
    console.log('[syncUser] Received request body:', JSON.stringify(data, null, 2))
    console.log('[syncUser] phone_number field:', data.phone_number)

    // Validate email (required, used as document ID)
    if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
      res.status(400).json({ error: 'email is required and must be a non-empty string' })
      return
    }

    // Use lowercase email as document ID
    const userId = data.email.trim().toLowerCase()

    try {
      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {
        email: userId  // Store the normalized email
      }

      // Store revenuecat_id if provided (for RevenueCat webhook lookups)
      if (data.revenuecat_id !== undefined) {
        if (typeof data.revenuecat_id !== 'string') {
          res.status(400).json({ error: 'revenuecat_id must be a string' })
          return
        }
        updateData.revenuecat_id = data.revenuecat_id
      }

      if (data.first_name !== undefined) {
        if (typeof data.first_name !== 'string') {
          res.status(400).json({ error: 'first_name must be a string' })
          return
        }
        updateData.first_name = data.first_name
      }

      if (data.phone_number !== undefined) {
        if (typeof data.phone_number !== 'string') {
          res.status(400).json({ error: 'phone_number must be a string' })
          return
        }
        updateData.phone_number = data.phone_number
      }

      if (data.locale !== undefined) {
        if (!VALID_LOCALES.includes(data.locale as Locale)) {
          res.status(400).json({ error: `locale must be one of: ${VALID_LOCALES.join(', ')}` })
          return
        }
        updateData.locale = data.locale
      }

      if (data.role !== undefined) {
        if (!VALID_ROLES.includes(data.role as Role)) {
          res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` })
          return
        }
        updateData.role = data.role
      }

      if (data.needs !== undefined) {
        if (!Array.isArray(data.needs)) {
          res.status(400).json({ error: 'needs must be an array' })
          return
        }
        for (const need of data.needs) {
          if (!VALID_NEEDS.includes(need as Need)) {
            res.status(400).json({ error: `Invalid need: ${need}. Must be one of: ${VALID_NEEDS.join(', ')}` })
            return
          }
        }
        updateData.needs = data.needs
      }

      if (data.plan !== undefined) {
        if (!VALID_PLANS.includes(data.plan)) {
          res.status(400).json({ error: `plan must be one of: ${VALID_PLANS.join(', ')}` })
          return
        }
        updateData.plan = data.plan
      }

      // Boolean fields
      // Note: paywall_blocked is calculated by backend (cron), not sent by app
      const booleanFields = [
        'onboarding_complete', 'paywall_passed',
        'has_optimized_route', 'subscription_active', 'trial_active', 'is_test_user', 'dry_run', 'has_replied'
      ] as const

      for (const field of booleanFields) {
        if (data[field] !== undefined) {
          if (typeof data[field] !== 'boolean') {
            res.status(400).json({ error: `${field} must be a boolean` })
            return
          }
          updateData[field] = data[field]
        }
      }

      // Handle visit_added -> has_added_visits mapping
      if (data.visit_added !== undefined) {
        if (typeof data.visit_added !== 'boolean') {
          res.status(400).json({ error: 'visit_added must be a boolean' })
          return
        }
        updateData.has_added_visits = data.visit_added
      }

      // Date fields (convert ISO string to Firestore Timestamp)
      // If _test_time_offset_seconds is provided, use server time + offset instead of the provided date
      const testOffset = data._test_time_offset_seconds
      const useServerTimeOffset = typeof testOffset === 'number'

      const dateFields = {
        onboarding_started_at: 'onboarding_started_at',
        onboarding_completed_at: 'onboarding_completed_at',
        trial_start_date: 'trial_start_date',
        trial_end_date: 'trial_end_date'
      } as const

      for (const [inputField, dbField] of Object.entries(dateFields)) {
        const value = data[inputField as keyof SyncUserRequest]
        if (value !== undefined) {
          if (typeof value !== 'string') {
            res.status(400).json({ error: `${inputField} must be an ISO date string` })
            return
          }

          let date: Date
          if (useServerTimeOffset) {
            // For tests: use server time + offset (ignoring the provided date value)
            // This ensures timestamps are relative to server time, not client time
            date = new Date(Date.now() + testOffset * 1000)
          } else {
            date = new Date(value)
            if (isNaN(date.getTime())) {
              res.status(400).json({ error: `${inputField} is not a valid date` })
              return
            }
          }
          updateData[dbField] = date
        }
      }

      // Always update last_action_at
      updateData.last_action_at = FieldValue.serverTimestamp()

      // Check if user exists
      const userRef = db.collection('users').doc(userId)
      const userDoc = await userRef.get()

      if (!userDoc.exists) {
        // Create new user with defaults
        const newUser = {
          email: userId,  // email is the document ID
          created_at: FieldValue.serverTimestamp(),
          onboarding_complete: false,
          onboarding_dropped: false,
          paywall_blocked: false,
          paywall_passed: false,
          has_optimized_route: false,
          has_added_visits: false,
          trial_active: false,
          subscription_active: false,
          plan: 'free',
          email_whyleaving_sent: false,
          email_whatsmissing_sent: false,
          email_freeoptions_sent: false,
          email_novisits_sent: false,
          email_nooptimization_sent: false,
          has_replied: false,
          is_test_user: false,
          ...updateData
        }
        await userRef.set(newUser)
        console.log(`[syncUser] Created new user: ${userId}`)
        console.log(`[syncUser] Created with updateData:`, JSON.stringify(updateData, null, 2))
      } else {
        // Merge with existing user
        await userRef.update(updateData)
        console.log(`[syncUser] Updated user: ${userId}`)
        console.log(`[syncUser] Updated with data:`, JSON.stringify(updateData, null, 2))
      }

      res.json({
        success: true,
        userId,
        created: !userDoc.exists
      })
    } catch (error) {
      console.error(`[syncUser] Error:`, error)
      res.status(500).json({
        error: 'Failed to sync user',
        details: String(error)
      })
    }
  }
)

/**
 * Get user data (for testing)
 * GET /getUser?userId=xxx
 */
export const getUser = onRequest(
  { cors: true, secrets: [EMAIL_NUDGE_API_KEY] },
  async (req, res) => {
    // Verify API key
    if (!verifyApiKey(req, res)) return

    const userId = req.query.userId as string

    if (!userId) {
      res.status(400).json({
        error: 'Missing userId parameter',
        usage: '/getUser?userId=xxx'
      })
      return
    }

    try {
      const userDoc = await db.collection('users').doc(userId).get()

      if (!userDoc.exists) {
        res.status(404).json({ error: `User ${userId} not found` })
        return
      }

      const userData = userDoc.data()!

      // Convert Firestore Timestamps to ISO strings for JSON response
      const user = {
        ...userData,
        id: userId,
        created_at: userData.created_at?.toDate?.() ? userData.created_at.toDate().toISOString() : userData.created_at,
        last_action_at: userData.last_action_at?.toDate?.() ? userData.last_action_at.toDate().toISOString() : userData.last_action_at,
        trial_start_date: userData.trial_start_date?.toDate?.() ? userData.trial_start_date.toDate().toISOString() : userData.trial_start_date,
        trial_end_date: userData.trial_end_date?.toDate?.() ? userData.trial_end_date.toDate().toISOString() : userData.trial_end_date,
        churned_at: userData.churned_at?.toDate?.() ? userData.churned_at.toDate().toISOString() : userData.churned_at
      }

      res.json({
        success: true,
        user
      })
    } catch (error) {
      console.error(`[getUser] Error:`, error)
      res.status(500).json({
        error: 'Failed to get user',
        details: String(error)
      })
    }
  }
)

/**
 * Get user status (for debugging/monitoring)
 * GET /getStatus?userId=xxx
 */
export const getStatus = onRequest(
  { cors: true, secrets: [EMAIL_NUDGE_API_KEY] },
  async (req, res) => {
    // Verify API key
    if (!verifyApiKey(req, res)) return

    const userId = req.query.userId as string

    if (!userId) {
      res.status(400).json({
        error: 'Missing userId parameter',
        usage: '/getStatus?userId=xxx'
      })
      return
    }

    try {
      const userDoc = await db.collection('users').doc(userId).get()

      if (!userDoc.exists) {
        res.status(404).json({ error: `User ${userId} not found` })
        return
      }

      const userData = userDoc.data()!

      // Compute status
      const status = computeUserStatus(userData)

      // Get pending emails from queue
      const queueSnapshot = await db
        .collection('email_queue')
        .where('user_id', '==', userId)
        .get()

      const pendingEmails = queueSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          email_name: data.email_name,
          segment: data.segment,
          send_at: data.send_at?.toDate?.() ? data.send_at.toDate().toISOString() : data.send_at
        }
      })

      // Get recent email logs
      const logsSnapshot = await db
        .collection('email_logs')
        .where('user_id', '==', userId)
        .orderBy('scheduled_at', 'desc')
        .limit(10)
        .get()

      const recentEmails = logsSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          email_name: data.email_name,
          segment: data.segment,
          status: data.status,
          scheduled_at: data.scheduled_at?.toDate?.() ? data.scheduled_at.toDate().toISOString() : data.scheduled_at,
          sent_at: data.sent_at?.toDate?.() ? data.sent_at.toDate().toISOString() : data.sent_at,
          blocked_reason: data.blocked_reason
        }
      })

      res.json({
        success: true,
        userId,
        status,
        pending_emails: pendingEmails,
        recent_emails: recentEmails,
        user_data: {
          email: userData.email,
          first_name: userData.first_name,
          role: userData.role,
          locale: userData.locale,
          onboarding_complete: userData.onboarding_complete,
          onboarding_dropped: userData.onboarding_dropped,
          paywall_blocked: userData.paywall_blocked,
          paywall_passed: userData.paywall_passed,
          has_added_visits: userData.has_added_visits,
          has_optimized_route: userData.has_optimized_route,
          has_replied: userData.has_replied,
          is_test_user: userData.is_test_user
        }
      })
    } catch (error) {
      console.error(`[getStatus] Error:`, error)
      res.status(500).json({
        error: 'Failed to get status',
        details: String(error)
      })
    }
  }
)

