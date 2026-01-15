// User types
export type Role = 'delivery' | 'field_sales' | 'technician' | 'sales_director' | 'other'

export type Need =
  | 'hotel_search'
  | 'new_clients'
  | 'complex_routes'
  | 'max_visits'
  | 'multi_day'
  | 'client_tracking'

export type Locale = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl'

export interface User {
  id: string
  email: string
  prenom?: string
  role: Role
  needs: Need[]
  locale?: Locale
  revenuecat_id?: string
  created_at: Date

  // Funnel
  onboarding_started_at?: Date
  onboarding_complete: boolean
  onboarding_completed_at?: Date
  onboarding_dropped?: boolean // internal marker
  paywall_blocked: boolean
  paywall_passed: boolean

  // Engagement
  has_optimized_route: boolean
  has_added_visits: boolean
  last_action_at?: Date

  // Subscription
  trial_active: boolean
  trial_start_date?: Date
  trial_end_date?: Date
  subscription_active: boolean
  plan: 'free' | 'trial' | 'monthly' | 'yearly'

  // Churn
  churned_at?: Date
  churn_reason?: string

  // Email system
  email_whyleaving_sent: boolean
  has_replied: boolean
  is_test_user: boolean
}

// Email types
export type EmailName =
  | 'WhatsMissing'
  | 'FreeOptions'
  | 'QuickStart'
  | 'NoVisits'
  | 'NoOptimization'
  | 'WhyLeaving'

export type Segment =
  // WhatsMissing
  | 'WhatsMissing__hotel'
  | 'WhatsMissing__prospection'
  | 'WhatsMissing__complex'
  | 'WhatsMissing__delivery'
  | 'WhatsMissing__technician'
  | 'WhatsMissing__default'
  // FreeOptions
  | 'FreeOptions'
  // QuickStart (by role)
  | 'QuickStart__delivery'
  | 'QuickStart__field_sales'
  | 'QuickStart__technician'
  | 'QuickStart__sales_director'
  | 'QuickStart__default'
  // NoVisits
  | 'NoVisits'
  // NoOptimization
  | 'NoOptimization'
  // WhyLeaving
  | 'WhyLeaving__unsubscribe'
  | 'WhyLeaving__billing_error'

export interface EmailQueueItem {
  id?: string
  user_id: string
  email_name: EmailName
  segment: Segment
  send_at: Date
  created_at: Date
  variables: Record<string, string | string[]>
}

export interface EmailLog {
  id?: string
  user_id: string
  email_name: EmailName
  segment: Segment
  scheduled_at: Date
  sent_at?: Date
  status: 'scheduled' | 'sent' | 'blocked' | 'error'
  blocked_reason?: string
  variables: Record<string, string | string[]>
}

// Need labels for templates
export const NEED_LABELS: Record<Need, string> = {
  hotel_search: 'trouver des hôtels',
  new_clients: 'trouver de nouveaux clients',
  complex_routes: 'créer des tournées complexes',
  max_visits: 'optimiser tes visites',
  multi_day: 'planifier plusieurs jours',
  client_tracking: 'suivre tes clients'
}

// Need priority (lower = higher priority)
export const NEED_PRIORITY: Record<Need, number> = {
  hotel_search: 1,
  new_clients: 2,
  complex_routes: 3,
  max_visits: 4,
  multi_day: 5,
  client_tracking: 6
}
