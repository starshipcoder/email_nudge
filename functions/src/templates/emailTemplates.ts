import * as fs from 'fs'
import * as path from 'path'
import { Locale, Segment, Need } from '../types'

interface EmailTemplate {
  subject: string
  body: string
}

// Simple templates (no dynamic need_closing)
type SimpleTemplateKey = 'FreeOptions' | 'NoVisits' | 'NoOptimization' | 'WhyLeaving__unsubscribe' | 'WhyLeaving__billing_error'

// QuickStart templates (with dynamic need_closing)
type QuickStartTemplateKey = 'QuickStart__delivery' | 'QuickStart__field_sales' | 'QuickStart__technician' | 'QuickStart__sales_director' | 'QuickStart__default'

type TemplateKey = SimpleTemplateKey | QuickStartTemplateKey

// Segments that use templates (not AI)
export const TEMPLATE_SEGMENTS: Segment[] = [
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

export function isTemplateSegment(segment: Segment): boolean {
  return TEMPLATE_SEGMENTS.includes(segment)
}

// Cache for loaded templates and closings
const templateCache: Map<string, EmailTemplate> = new Map()
const closingsCache: Map<string, Record<string, string>> = new Map()

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
 * Load need closings for a locale
 */
function loadNeedClosings(locale: Locale): Record<string, string> {
  if (closingsCache.has(locale)) {
    return closingsCache.get(locale)!
  }

  const locales = [locale, 'en']

  for (const loc of locales) {
    const filePath = path.join(__dirname, 'emails', loc, 'need_closings.txt')

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const closings = parseClosings(content)
      closingsCache.set(locale, closings)
      return closings
    }
  }

  return { default: 'If you have any trouble, contact me.' }
}

/**
 * Parse closings file
 * Format: key: value (one per line)
 */
function parseClosings(content: string): Record<string, string> {
  const closings: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      closings[match[1]] = match[2].trim()
    }
  }

  return closings
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
  primaryNeed?: Need | null
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

  // Replace {{prenom}} - "Bonjour Jean," or "Bonjour," if no name
  if (variables.prenom) {
    const prenomDisplay = ` ${variables.prenom}`
    subject = subject.replace('{{prenom}}', prenomDisplay)
    body = body.replace(/\{\{prenom\}\}/g, prenomDisplay)
  } else {
    // No prenom: "Bonjour{{prenom}}," becomes "Bonjour,"
    subject = subject.replace('{{prenom}}', '')
    body = body.replace(/\{\{prenom\}\}/g, '')
  }

  // Replace {{need_closing}} for QuickStart templates
  if (body.includes('{{need_closing}}')) {
    const closings = loadNeedClosings(locale)
    const needKey = variables.primaryNeed || 'default'
    const closing = closings[needKey] || closings['default'] || ''
    body = body.replace(/\{\{need_closing\}\}/g, closing)
  }

  return { subject, body }
}
