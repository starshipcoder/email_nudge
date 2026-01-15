import * as fs from 'fs'
import * as path from 'path'
import { Locale, Segment } from '../types'

interface EmailTemplate {
  subject: string
  body: string
}

type TemplateKey = 'FreeOptions' | 'NoVisits' | 'NoOptimization' | 'WhyLeaving__unsubscribe' | 'WhyLeaving__billing_error'

// Segments that use templates (not AI)
export const TEMPLATE_SEGMENTS: Segment[] = [
  'FreeOptions',
  'NoVisits',
  'NoOptimization',
  'WhyLeaving__unsubscribe',
  'WhyLeaving__billing_error'
]

export function isTemplateSegment(segment: Segment): boolean {
  return TEMPLATE_SEGMENTS.includes(segment)
}

// Cache for loaded templates
const templateCache: Map<string, EmailTemplate> = new Map()

/**
 * Load a template from file
 */
function loadTemplate(locale: Locale, templateName: TemplateKey): EmailTemplate {
  const cacheKey = `${locale}/${templateName}`

  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!
  }

  // Try requested locale, fallback to 'en'
  const locales = [locale, 'en']

  for (const loc of locales) {
    const filePath = path.join(__dirname, 'emails', loc, `${templateName}.txt`)

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const template = parseTemplate(content)
      templateCache.set(cacheKey, template)
      return template
    }
  }

  throw new Error(`Template not found: ${templateName} for locale ${locale}`)
}

/**
 * Parse template file content
 * Format:
 * SUBJECT: ...
 *
 * body...
 */
function parseTemplate(content: string): EmailTemplate {
  const subjectMatch = content.match(/^SUBJECT:\s*(.+)$/m)
  if (!subjectMatch) {
    throw new Error('Template missing SUBJECT line')
  }

  const subject = subjectMatch[1].trim()
  const body = content.replace(/^SUBJECT:\s*.+\n+/m, '').trim()

  return { subject, body }
}

interface TemplateVariables {
  prenom?: string
}

/**
 * Get and render a template for the given segment and locale
 */
export function renderEmailTemplate(
  segment: Segment,
  locale: Locale,
  variables: TemplateVariables
): EmailTemplate {
  const template = loadTemplate(locale, segment as TemplateKey)

  let subject = template.subject
  let body = template.body

  // Replace {{prenom}} - with space if exists, empty if not
  const prenomDisplay = variables.prenom ? ` ${variables.prenom}` : ''
  subject = subject.replace('{{prenom}}', prenomDisplay)
  body = body.replace(/\{\{prenom\}\}/g, prenomDisplay)

  return { subject, body }
}
