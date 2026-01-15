import { resolveSegment, shouldSendEmail, getPrimaryNeed } from '../utils/segmentResolver'
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

  it('returns field_sales segment for field_sales role', () => {
    const user = createUser({ role: 'field_sales' })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__field_sales')
  })

  it('returns technician segment for technician role', () => {
    const user = createUser({ role: 'technician' })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__technician')
  })

  it('returns sales_director segment for sales_director role', () => {
    const user = createUser({ role: 'sales_director' })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__sales_director')
  })

  it('returns default segment for other role', () => {
    const user = createUser({ role: 'other' })
    expect(resolveSegment('QuickStart', user)).toBe('QuickStart__default')
  })
})

describe('resolveSegment - NoVisits & NoOptimization', () => {
  it('returns NoVisits for NoVisits email', () => {
    const user = createUser()
    expect(resolveSegment('NoVisits', user)).toBe('NoVisits')
  })

  it('returns NoOptimization for NoOptimization email', () => {
    const user = createUser()
    expect(resolveSegment('NoOptimization', user)).toBe('NoOptimization')
  })
})

describe('resolveSegment - WhyLeaving', () => {
  it('returns unsubscribe when churn_reason is unsubscribe', () => {
    const user = createUser({ churned_at: new Date(), churn_reason: 'unsubscribe' })
    expect(resolveSegment('WhyLeaving', user)).toBe('WhyLeaving__unsubscribe')
  })

  it('returns billing_error when churn_reason is billing_error', () => {
    const user = createUser({ churned_at: new Date(), churn_reason: 'billing_error' })
    expect(resolveSegment('WhyLeaving', user)).toBe('WhyLeaving__billing_error')
  })

  it('defaults to unsubscribe when no churn_reason', () => {
    const user = createUser({ churned_at: new Date() })
    expect(resolveSegment('WhyLeaving', user)).toBe('WhyLeaving__unsubscribe')
  })
})

describe('resolveSegment - Simple segments', () => {
  it('returns FreeOptions for FreeOptions email', () => {
    const user = createUser()
    expect(resolveSegment('FreeOptions', user)).toBe('FreeOptions')
  })
})

describe('shouldSendEmail - Kill Switch', () => {
  it('blocks emails when has_replied is true', () => {
    const user = createUser({ has_replied: true })
    expect(shouldSendEmail('NoVisits', user)).toEqual({
      send: false,
      reason: 'User has replied - kill switch active'
    })
  })

  it('allows emails when has_replied is false', () => {
    const user = createUser({ has_replied: false })
    expect(shouldSendEmail('NoVisits', user)).toEqual({ send: true })
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
