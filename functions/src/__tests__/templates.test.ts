import { renderTemplate, getTemplateVariables } from '../templates'
import { User } from '../types'

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

describe('getTemplateVariables', () => {
  it('extracts prenom from user', () => {
    const user = createUser({ prenom: 'Jean' })
    const vars = getTemplateVariables(user)
    expect(vars.prenom).toBe('Jean')
  })

  it('handles missing prenom', () => {
    const user = createUser({ prenom: undefined })
    const vars = getTemplateVariables(user)
    expect(vars.prenom).toBeUndefined()
  })

  it('gets primary need label', () => {
    const user = createUser({ needs: ['hotel_search', 'max_visits'] })
    const vars = getTemplateVariables(user)
    expect(vars.primary_need_label).toBe('trouver des hôtels')
  })

  it('gets all needs labels', () => {
    const user = createUser({ needs: ['hotel_search', 'new_clients'] })
    const vars = getTemplateVariables(user)
    expect(vars.needs_labels).toEqual([
      'trouver des hôtels',
      'trouver de nouveaux clients'
    ])
  })

  it('detects sales_director role', () => {
    const user = createUser({ role: 'sales_director' })
    const vars = getTemplateVariables(user)
    expect(vars.is_sales_director).toBe(true)
  })

  it('merges extra variables', () => {
    const user = createUser()
    const vars = getTemplateVariables(user, { days_remaining: 2 })
    expect(vars.days_remaining).toBe(2)
  })
})

describe('renderTemplate - Variable Replacement', () => {
  it('replaces prenom in greeting', () => {
    const { body } = renderTemplate('WhatsMissing__default', { prenom: 'Marie' })
    expect(body).toContain('Hey Marie,')
  })

  it('handles missing prenom gracefully', () => {
    const { body } = renderTemplate('WhatsMissing__default', {})
    expect(body).toContain('Hey,')
    expect(body).not.toContain('Hey ,')
  })


})

describe('renderTemplate - Conditional Blocks', () => {
  it('includes sales_director tip when is_sales_director is true', () => {
    const { body } = renderTemplate('QuickStart__delivery', { is_sales_director: true })
    expect(body).toContain('partager tes tournées')
  })

  it('excludes sales_director tip when is_sales_director is false', () => {
    const { body } = renderTemplate('QuickStart__delivery', { is_sales_director: false })
    expect(body).not.toContain('partager tes tournées')
  })
})


describe('renderTemplate - Signature', () => {
  it('includes Harold signature in all templates', () => {
    const segments = [
      'WhatsMissing__default',
      'FreeOptions',
      'QuickStart__default',
      'NoVisits',
      'NoOptimization',
      'WhyLeaving__unsubscribe',
      'WhyLeaving__billing_error'
    ] as const

    segments.forEach(segment => {
      const { body } = renderTemplate(segment, {})
      expect(body).toContain('Harold, créateur de Easy Way')
    })
  })
})

describe('renderTemplate - All Segments Exist', () => {
  const allSegments = [
    'WhatsMissing__hotel',
    'WhatsMissing__prospection',
    'WhatsMissing__complex',
    'WhatsMissing__delivery',
    'WhatsMissing__technician',
    'WhatsMissing__default',
    'FreeOptions',
    'QuickStart__delivery',
    'QuickStart__prospection',
    'QuickStart__tracking',
    'QuickStart__technician',
    'QuickStart__default',
    'NoVisits',
    'NoOptimization',
    'WhyLeaving__unsubscribe',
    'WhyLeaving__billing_error'
  ] as const

  allSegments.forEach(segment => {
    it(`renders ${segment} without error`, () => {
      expect(() => renderTemplate(segment, {})).not.toThrow()
    })
  })
})
