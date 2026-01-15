import { onRequest } from 'firebase-functions/v2/https'
import { db } from '../index'
import { Role, Need, Locale } from '../types'
import { FieldValue } from 'firebase-admin/firestore'

// Valid values for validation
const VALID_ROLES: Role[] = ['delivery', 'field_sales', 'technician', 'sales_director', 'other']
const VALID_NEEDS: Need[] = ['hotel_search', 'new_clients', 'complex_routes', 'max_visits', 'multi_day', 'client_tracking']
const VALID_LOCALES: Locale[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl']
const VALID_PLANS = ['free', 'trial', 'monthly', 'yearly']

interface SyncUserRequest {
  revenuecat_id: string
  email?: string
  first_name?: string
  locale?: string
  role?: string
  needs?: string[]
  onboarding_started_at?: string
  onboarding_complete?: boolean
  onboarding_completed_at?: string
  paywall_blocked?: boolean
  paywall_passed?: boolean
  visit_added?: boolean
  has_optimized_route?: boolean
  subscription_active?: boolean
  trial_active?: boolean
  trial_start_date?: string
  trial_end_date?: string
  plan?: string
  is_test_user?: boolean
}

/**
 * Sync user data from the mobile app
 * POST /syncUser
 * Body: { revenuecat_id: "...", ... }
 */
export const syncUser = onRequest(
  { cors: true },
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed', allowedMethods: ['POST'] })
      return
    }

    const data = req.body as SyncUserRequest

    // Validate revenuecat_id
    if (!data.revenuecat_id || typeof data.revenuecat_id !== 'string' || data.revenuecat_id.trim() === '') {
      res.status(400).json({ error: 'revenuecat_id is required and must be a non-empty string' })
      return
    }

    const userId = data.revenuecat_id.trim()

    try {
      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {}

      // String fields
      if (data.email !== undefined) {
        if (typeof data.email !== 'string') {
          res.status(400).json({ error: 'email must be a string' })
          return
        }
        updateData.email = data.email
      }

      if (data.first_name !== undefined) {
        if (typeof data.first_name !== 'string') {
          res.status(400).json({ error: 'first_name must be a string' })
          return
        }
        updateData.first_name = data.first_name
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
      const booleanFields = [
        'onboarding_complete', 'paywall_blocked', 'paywall_passed',
        'has_optimized_route', 'subscription_active', 'trial_active', 'is_test_user'
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
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            res.status(400).json({ error: `${inputField} is not a valid date` })
            return
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
          revenuecat_id: userId,
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
          has_replied: false,
          is_test_user: false,
          ...updateData
        }
        await userRef.set(newUser)
        console.log(`[syncUser] Created new user: ${userId}`)
      } else {
        // Merge with existing user
        await userRef.update(updateData)
        console.log(`[syncUser] Updated user: ${userId}`)
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
  { cors: true },
  async (req, res) => {
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
