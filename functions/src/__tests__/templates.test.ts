import { renderEmailTemplate, isTemplateSegment } from '../templates/emailTemplates'
import { Segment } from '../types'

describe('renderEmailTemplate - Variable Replacement', () => {
  it('replaces first_name in greeting', () => {
    const { body } = renderEmailTemplate('WhatsMissing', 'fr', { first_name: 'Marie' })
    expect(body).toContain('Bonjour Marie,')
  })

  it('handles missing first_name gracefully', () => {
    const { body } = renderEmailTemplate('WhatsMissing', 'fr', {})
    expect(body).toContain('Bonjour,')
    expect(body).not.toContain('Bonjour ,')
  })
})

describe('renderEmailTemplate - Signature', () => {
  it('includes Harold signature in all FR templates', () => {
    const segments: Segment[] = [
      'WhatsMissing',
      'FreeOptions',
      'NoVisits',
      'NoOptimization',
      'WhyLeaving__unsubscribe',
      'WhyLeaving__billing_error'
    ]

    segments.forEach(segment => {
      const { body } = renderEmailTemplate(segment, 'fr', {})
      expect(body).toContain('Harold, créateur de Easy Way')
    })
  })
})

describe('renderEmailTemplate - All Segments Exist', () => {
  const allSegments: Segment[] = [
    'WhatsMissing',
    'FreeOptions',
    'NoVisits',
    'NoOptimization',
    'WhyLeaving__unsubscribe',
    'WhyLeaving__billing_error',
    'QuickStart__delivery',
    'QuickStart__field_sales',
    'QuickStart__technician',
    'QuickStart__sales_director',
    'QuickStart__default'
  ]

  allSegments.forEach(segment => {
    it(`renders ${segment} without error`, () => {
      expect(() => renderEmailTemplate(segment, 'fr', {})).not.toThrow()
    })
  })
})

describe('isTemplateSegment', () => {
  it('returns true for template segments', () => {
    expect(isTemplateSegment('WhatsMissing')).toBe(true)
    expect(isTemplateSegment('FreeOptions')).toBe(true)
    expect(isTemplateSegment('QuickStart__delivery')).toBe(true)
  })
})
