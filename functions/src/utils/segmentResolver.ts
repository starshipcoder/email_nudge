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
    case 'NeedHelp':
      return resolveNeedHelp(user)
    case 'NeedHelpWith':
      return 'NeedHelpWith'
    case 'TrialEndsSoon':
      return 'TrialEndsSoon'
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
  // Priority: role=delivery > need > role > default
  if (user.role === 'delivery') return 'QuickStart__delivery'
  if (hasNeed(user, 'new_clients')) return 'QuickStart__prospection'
  if (hasNeed(user, 'client_tracking')) return 'QuickStart__tracking'
  if (user.role === 'technician') return 'QuickStart__technician'
  return 'QuickStart__default'
}

function resolveNeedHelp(user: User): Segment {
  if (user.routes_created === 0) return 'NeedHelp__no_route'
  if (user.routes_optimized === 0) return 'NeedHelp__no_optimization'
  return 'NeedHelp__no_route' // fallback
}

function resolveWhyLeaving(user: User): Segment {
  if (user.churn_reason) return 'WhyLeaving__with_feedback'
  return 'WhyLeaving__silent'
}

/**
 * Check if an email should be sent based on kill switch and dedup rules
 */
export function shouldSendEmail(emailName: EmailName, user: User): { send: boolean; reason?: string } {
  // Kill switch: has_replied stops all emails except TrialEndsSoon
  if (emailName !== 'TrialEndsSoon' && user.has_replied) {
    return { send: false, reason: 'User has replied - kill switch active' }
  }

  // Deduplication for WhyLeaving
  if (emailName === 'WhyLeaving' && user.email_whyleaving_sent) {
    return { send: false, reason: 'WhyLeaving already sent - dedup' }
  }

  return { send: true }
}
