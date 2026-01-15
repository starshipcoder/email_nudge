import { User, EmailName, Segment, Need, NEED_PRIORITY } from '../types'

/**
 * Get the highest priority need from a user's needs list
 */
export function getPrimaryNeed(needs: Need[]): Need | null {
  if (!needs || needs.length === 0) return null

  return needs.reduce((highest, current) => {
    if (NEED_PRIORITY[current] < NEED_PRIORITY[highest]) {
      return current
    }
    return highest
  })
}

/**
 * Check if user has a specific need
 */
export function hasNeed(user: User, need: Need): boolean {
  return user.needs?.includes(need) ?? false
}

/**
 * Resolve the segment for a given email based on user data
 */
export function resolveSegment(emailName: EmailName, user: User): Segment {
  switch (emailName) {
    case 'WhatsMissing':
      return resolveWhatsMissing(user)
    case 'FreeOptions':
      return 'FreeOptions'
    case 'QuickStart':
      return resolveQuickStart(user)
    case 'NoVisits':
      return 'NoVisits'
    case 'NoOptimization':
      return 'NoOptimization'
    case 'WhyLeaving':
      return resolveWhyLeaving(user)
    default:
      throw new Error(`Unknown email name: ${emailName}`)
  }
}

function resolveWhatsMissing(user: User): Segment {
  // Priority: need > role > default
  if (hasNeed(user, 'hotel_search')) return 'WhatsMissing__hotel'
  if (hasNeed(user, 'new_clients')) return 'WhatsMissing__prospection'
  if (hasNeed(user, 'complex_routes')) return 'WhatsMissing__complex'
  if (user.role === 'delivery') return 'WhatsMissing__delivery'
  if (user.role === 'technician') return 'WhatsMissing__technician'
  return 'WhatsMissing__default'
}

function resolveQuickStart(user: User): Segment {
  // Based on role
  if (user.role === 'delivery') return 'QuickStart__delivery'
  if (user.role === 'field_sales') return 'QuickStart__field_sales'
  if (user.role === 'technician') return 'QuickStart__technician'
  if (user.role === 'sales_director') return 'QuickStart__sales_director'
  return 'QuickStart__default'
}

function resolveWhyLeaving(user: User): Segment {
  if (user.churn_reason === 'billing_error') return 'WhyLeaving__billing_error'
  return 'WhyLeaving__unsubscribe'
}

/**
 * Check if an email should be sent based on kill switch and dedup rules
 */
export function shouldSendEmail(emailName: EmailName, user: User): { send: boolean; reason?: string } {
  // No email address - can't send
  if (!user.email) {
    return { send: false, reason: 'No email address (legacy user)' }
  }

  // Kill switch: has_replied stops all emails
  if (user.has_replied) {
    return { send: false, reason: 'User has replied - kill switch active' }
  }

  // Deduplication for WhyLeaving
  if (emailName === 'WhyLeaving' && user.email_whyleaving_sent) {
    return { send: false, reason: 'WhyLeaving already sent - dedup' }
  }

  return { send: true }
}
