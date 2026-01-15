import { Locale, Segment } from '../types'
import * as fr from './emails/fr.json'
import * as en from './emails/en.json'
import * as es from './emails/es.json'
import * as de from './emails/de.json'
import * as it from './emails/it.json'

interface EmailTemplate {
  subject: string
  body: string
}

type TemplateKey = 'FreeOptions' | 'NoVisits' | 'NoOptimization' | 'WhyLeaving__unsubscribe' | 'WhyLeaving__billing_error'

const TEMPLATES: Record<Locale, Record<TemplateKey, EmailTemplate>> = {
  fr: fr as Record<TemplateKey, EmailTemplate>,
  en: en as Record<TemplateKey, EmailTemplate>,
  es: es as Record<TemplateKey, EmailTemplate>,
  de: de as Record<TemplateKey, EmailTemplate>,
  it: it as Record<TemplateKey, EmailTemplate>,
  // Fallback to English for unsupported languages
  pt: en as Record<TemplateKey, EmailTemplate>,
  nl: en as Record<TemplateKey, EmailTemplate>
}

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
  const templates = TEMPLATES[locale] || TEMPLATES['en']
  const template = templates[segment as TemplateKey]

  if (!template) {
    throw new Error(`Template not found for segment: ${segment}`)
  }

  let subject = template.subject
  let body = template.body

  // Replace {{prenom}} - with space if exists, empty if not
  const prenomDisplay = variables.prenom ? ` ${variables.prenom}` : ''
  subject = subject.replace('{{prenom}}', prenomDisplay)
  body = body.replace(/\{\{prenom\}\}/g, prenomDisplay)

  return { subject, body }
}
