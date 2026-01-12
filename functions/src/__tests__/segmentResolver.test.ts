import { resolveSegment, shouldSendEmail, getPrimaryNeed, hasNeed } from '../utils/segmentResolver'
import { User, Need } from '../types'

// Helper to create a test user
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'field_sales',
    needs: [],
    created_at: new Date(),
    onboarding_complete: false,
    onboarding_step_reached: 1,
    paywall_seen: false,
    paywall_passed: false,
    routes_created: 0,
    routes_optimized: 0,
    prospects_added: 0,
    trial_active: false,
    subscription_active: false,
    plan: 'free',
    email_whyleaving_sent: false,
    has_replied: false,
    is_test_user: false,
    ...overrides
  }
}

describe('getPrimaryNeed', () => {
  it('returns null for empty needs', () => {
    expect(getPrimaryNeed([])).toBeNull()
  })

  it('returns the only need when single', () => {
    expect(getPrimaryNeed(['max_visits'])).toBe('max_visits')
  })

  it('returns highest priority need (hotel > prospection)', () => {
    const needs: Need[] = ['new_clients', 'hotel_search', 'max_visits']
    expect(getPrimaryNeed(needs)).toBe('hotel_search')
  })

  it('returns prospection over complex', () => {
    const needs: Need[] = ['complex_routes', 'new_clients']
    expect(getPrimaryNeed(needs)).toBe('new_clients')
  })
})

describe('resolveSegment - WhatsMissing', () => {
  it('returns hotel segment when user has hotel need', () => {
    const user = createUser({ needs: ['hotel_search', 'max_visits'] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__hotel')
  })

  it('returns prospection segment when user has new_clients need', () => {
    const user = createUser({ needs: ['new_clients'] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__prospection')
  })

  it('returns complex segment when user has complex_routes need', () => {
    const user = createUser({ needs: ['complex_routes'] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__complex')
  })

  it('returns delivery segment for delivery role without priority needs', () => {
    const user = createUser({ role: 'delivery', needs: ['max_visits'] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__delivery')
  })

  it('returns technician segment for technician role', () => {
    const user = createUser({ role: 'technician', needs: [] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__technician')
  })

  it('returns default segment for field_sales without priority needs', () => {
    const user = createUser({ role: 'field_sales', needs: ['max_visits'] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__default')
  })

  it('prioritizes need over role', () => {
    const user = createUser({ role: 'delivery', needs: ['hotel_search'] })
    expect(resolveSegment('WhatsMissing', user)).toBe('WhatsMissing__hotel')
  })
})

describe('resolveSegment - QuickStart', () => {
  it('returns delivery segment for delivery role', () => {
    const user = createUser({ role: 'delivery' })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__delivery')
  })

  it('returns prospection segment for new_clients need', () => {
    const user = createUser({ needs: ['new_clients'] })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__prospection')
  })

  it('returns tracking segment for client_tracking need', () => {
    const user = createUser({ needs: ['client_tracking'] })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__tracking')
  })

  it('returns technician segment for technician role', () => {
    const user = createUser({ role: 'technician' })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__technician')
  })

  it('prioritizes delivery role over need', () => {
    const user = createUser({ role: 'delivery', needs: ['new_clients'] })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__delivery')
  })
})

describe('resolveSegment - NeedHelp', () => {
  it('returns no_route when routes_created is 0', () => {
    const user = createUser({ routes_created: 0 })
    expect(resolveSegment('NeedHelp', user)).toBe('NeedHelp__no_route')
  })

  it('returns no_optimization when has route but no optimization', () => {
    const user = createUser({ routes_created: 1, routes_optimized: 0 })
    expect(resolveSegment('NeedHelp', user)).toBe('NeedHelp__no_optimization')
  })
})

describe('resolveSegment - WhyLeaving', () => {
  it('returns silent when no churn_reason', () => {
    const user = createUser({ churned_at: new Date() })
    expect(resolveSegment('WhyLeaving', user)).toBe('WhyLeaving__silent')
  })

  it('returns with_feedback when churn_reason exists', () => {
    const user = createUser({ churned_at: new Date(), churn_reason: 'Too expensive' })
    expect(resolveSegment('WhyLeaving', user)).toBe('WhyLeaving__with_feedback')
  })
})

describe('resolveSegment - Simple segments', () => {
  it('returns FreeOptions for FreeOptions email', () => {
    const user = createUser()
    expect(resolveSegment('FreeOptions', user)).toBe('FreeOptions')
  })

  it('returns NeedHelpWith for NeedHelpWith email', () => {
    const user = createUser()
    expect(resolveSegment('NeedHelpWith', user)).toBe('NeedHelpWith')
  })

  it('returns TrialEndsSoon for TrialEndsSoon email', () => {
    const user = createUser()
    expect(resolveSegment('TrialEndsSoon', user)).toBe('TrialEndsSoon')
  })
})

describe('shouldSendEmail - Kill Switch', () => {
  it('blocks emails when has_replied is true', () => {
    const user = createUser({ has_replied: true })
    expect(shouldSendEmail('NeedHelp', user)).toEqual({
      send: false,
      reason: 'User has replied - kill switch active'
    })
  })

  it('allows emails when has_replied is false', () => {
    const user = createUser({ has_replied: false })
    expect(shouldSendEmail('NeedHelp', user)).toEqual({ send: true })
  })

  it('allows TrialEndsSoon even when has_replied is true', () => {
    const user = createUser({ has_replied: true })
    expect(shouldSendEmail('TrialEndsSoon', user)).toEqual({ send: true })
  })
})

describe('shouldSendEmail - WhyLeaving Dedup', () => {
  it('blocks WhyLeaving when already sent', () => {
    const user = createUser({ email_whyleaving_sent: true })
    expect(shouldSendEmail('WhyLeaving', user)).toEqual({
      send: false,
      reason: 'WhyLeaving already sent - dedup'
    })
  })

  it('allows WhyLeaving when not sent', () => {
    const user = createUser({ email_whyleaving_sent: false })
    expect(shouldSendEmail('WhyLeaving', user)).toEqual({ send: true })
  })
})
