import Anthropic from '@anthropic-ai/sdk'
import { defineSecret } from 'firebase-functions/params'
import { User, EmailName, Locale, Need, Role } from '../types'
import { isTemplateSegment, renderEmailTemplate } from '../templates/emailTemplates'
import { resolveSegment } from '../utils/segmentResolver'

export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

let anthropicClient: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })
  }
  return anthropicClient
}

// Contexte et objectif par type d'email (uniquement pour emails générés par IA)
type AIEmailName = 'WhatsMissing' | 'QuickStart'

const EMAIL_CONFIG: Record<AIEmailName, { context: string; goal: string }> = {
  WhatsMissing: {
    context: "L'utilisateur a commencé l'onboarding mais l'a abandonné sans finir.",
    goal: "Comprendre ce qui lui a manqué ou bloqué. Proposer de l'aide."
  },
  QuickStart: {
    context: "L'utilisateur vient de commencer son essai gratuit.",
    goal: "L'aider à démarrer rapidement. Donner 1-2 conseils pratiques selon son métier."
  }
}

// Emails qui utilisent l'IA
const AI_EMAILS: EmailName[] = ['WhatsMissing', 'QuickStart']

function isAIEmail(emailName: EmailName): emailName is AIEmailName {
  return AI_EMAILS.includes(emailName)
}

// Labels traduits par langue
const ROLE_LABELS: Record<Locale, Record<Role, string>> = {
  fr: {
    delivery: 'livreur',
    field_sales: 'commercial terrain',
    technician: 'technicien',
    sales_director: 'directeur commercial',
    other: 'professionnel'
  },
  en: {
    delivery: 'delivery driver',
    field_sales: 'field sales rep',
    technician: 'technician',
    sales_director: 'sales director',
    other: 'professional'
  },
  es: {
    delivery: 'repartidor',
    field_sales: 'comercial',
    technician: 'técnico',
    sales_director: 'director comercial',
    other: 'profesional'
  },
  de: {
    delivery: 'Lieferfahrer',
    field_sales: 'Außendienstmitarbeiter',
    technician: 'Techniker',
    sales_director: 'Vertriebsleiter',
    other: 'Fachmann'
  },
  it: {
    delivery: 'corriere',
    field_sales: 'commerciale',
    technician: 'tecnico',
    sales_director: 'direttore commerciale',
    other: 'professionista'
  },
  pt: {
    delivery: 'entregador',
    field_sales: 'vendedor externo',
    technician: 'técnico',
    sales_director: 'diretor comercial',
    other: 'profissional'
  },
  nl: {
    delivery: 'bezorger',
    field_sales: 'buitendienstmedewerker',
    technician: 'technicus',
    sales_director: 'salesmanager',
    other: 'professional'
  }
}

const NEED_LABELS: Record<Locale, Record<Need, string>> = {
  fr: {
    hotel_search: 'trouver des hôtels sur la route',
    new_clients: 'trouver de nouveaux clients',
    complex_routes: 'créer des tournées complexes',
    max_visits: 'maximiser les visites',
    multi_day: 'planifier sur plusieurs jours',
    client_tracking: 'suivre les clients'
  },
  en: {
    hotel_search: 'find hotels along the route',
    new_clients: 'find new customers',
    complex_routes: 'create complex routes',
    max_visits: 'maximize visits',
    multi_day: 'plan multi-day trips',
    client_tracking: 'track clients'
  },
  es: {
    hotel_search: 'encontrar hoteles en la ruta',
    new_clients: 'encontrar nuevos clientes',
    complex_routes: 'crear rutas complejas',
    max_visits: 'maximizar visitas',
    multi_day: 'planificar varios días',
    client_tracking: 'seguir clientes'
  },
  de: {
    hotel_search: 'Hotels entlang der Route finden',
    new_clients: 'neue Kunden finden',
    complex_routes: 'komplexe Routen erstellen',
    max_visits: 'Besuche maximieren',
    multi_day: 'mehrtägige Planung',
    client_tracking: 'Kunden verfolgen'
  },
  it: {
    hotel_search: 'trovare hotel lungo il percorso',
    new_clients: 'trovare nuovi clienti',
    complex_routes: 'creare percorsi complessi',
    max_visits: 'massimizzare le visite',
    multi_day: 'pianificare più giorni',
    client_tracking: 'seguire i clienti'
  },
  pt: {
    hotel_search: 'encontrar hotéis na rota',
    new_clients: 'encontrar novos clientes',
    complex_routes: 'criar rotas complexas',
    max_visits: 'maximizar visitas',
    multi_day: 'planejar vários dias',
    client_tracking: 'acompanhar clientes'
  },
  nl: {
    hotel_search: 'hotels langs de route vinden',
    new_clients: 'nieuwe klanten vinden',
    complex_routes: 'complexe routes maken',
    max_visits: 'bezoeken maximaliseren',
    multi_day: 'meerdaagse planning',
    client_tracking: 'klanten volgen'
  }
}

const LANGUAGE_NAMES: Record<Locale, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  pt: 'portugais',
  nl: 'néerlandais'
}

/**
 * Try to extract first name from email address
 * Examples:
 * - jean.dupont@gmail.com → Jean
 * - marie_martin@yahoo.fr → Marie
 * - pdupont@company.com → null (can't guess)
 */
function extractFirstName(email: string): string | null {
  const localPart = email.split('@')[0]

  // Try common patterns: firstname.lastname, firstname_lastname, firstname-lastname
  const separators = ['.', '_', '-']
  for (const sep of separators) {
    if (localPart.includes(sep)) {
      const firstName = localPart.split(sep)[0]
      // Only use if it looks like a name (3+ chars, letters only)
      if (firstName.length >= 3 && /^[a-zA-Z]+$/.test(firstName)) {
        return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
      }
    }
  }

  return null
}

export interface GeneratedEmail {
  subject: string
  body: string
}

/**
 * Generate a simple test email without calling Anthropic
 */
export function generateTestEmail(
  user: User,
  emailName: EmailName
): GeneratedEmail {
  const locale = user.locale || 'fr'
  const firstName = user.prenom || extractFirstName(user.email) || 'there'

  return {
    subject: `[TEST] ${emailName} - ${locale}`,
    body: `Hey ${firstName},

Ceci est un email de test pour: ${emailName}

Infos user:
- Role: ${user.role || 'non défini'}
- Needs: ${user.needs?.join(', ') || 'aucun'}
- Locale: ${locale}

— Harold, créateur de Easy Way`
  }
}

/**
 * Extract first name from user or email
 */
export function getFirstName(user: User): string | null {
  return user.prenom || extractFirstName(user.email)
}

/**
 * Generate email - uses template or AI depending on email type
 */
export async function generateEmail(
  user: User,
  emailName: EmailName,
  extraVariables?: Record<string, string | number>
): Promise<GeneratedEmail> {
  const locale = user.locale || 'fr'
  const segment = resolveSegment(emailName, user)

  // Use template for simple emails
  if (isTemplateSegment(segment)) {
    const firstName = getFirstName(user)
    return renderEmailTemplate(segment, locale, {
      prenom: firstName || undefined
    })
  }

  // Use AI for WhatsMissing and QuickStart
  if (!isAIEmail(emailName)) {
    throw new Error(`No template or AI config for email: ${emailName}`)
  }

  return generateAIEmail(user, emailName, extraVariables)
}

/**
 * Generate email using Anthropic AI
 */
async function generateAIEmail(
  user: User,
  emailName: AIEmailName,
  extraVariables?: Record<string, string | number>
): Promise<GeneratedEmail> {
  const locale = user.locale || 'fr'
  const config = EMAIL_CONFIG[emailName]

  // Try to get first name: from user data or extract from email
  const firstName = getFirstName(user)
  const firstNameDisplay = firstName || 'inconnu'

  const roleLabel = ROLE_LABELS[locale]?.[user.role] || ROLE_LABELS['en'][user.role]
  const needsLabels = user.needs
    ?.map(need => NEED_LABELS[locale]?.[need] || NEED_LABELS['en'][need])
    .join(', ') || 'non spécifié'

  const extraContext = extraVariables
    ? Object.entries(extraVariables)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : ''

  const prompt = `Tu es Harold, créateur de Easy Way, une app mobile d'optimisation de tournées.

CONTEXTE UTILISATEUR:
- Prénom: ${firstNameDisplay}${!firstName ? ' (pas de prénom connu, ne commence pas par "Salut" ou similaire)' : ''}
- Métier: ${roleLabel}
- Besoins exprimés: ${needsLabels}
- Langue: ${LANGUAGE_NAMES[locale]}
${user.churn_reason ? `- Raison de départ: ${user.churn_reason}` : ''}
${extraContext}

SITUATION:
${config.context}

OBJECTIF DE L'EMAIL:
${config.goal}

CONSIGNES:
1. Écris en ${LANGUAGE_NAMES[locale]}
2. Sois direct, amical, PAS corporate
3. Tutoie l'utilisateur
4. Email court (3-5 phrases max)
5. Termine par UNE question ouverte simple
6. Pas de formule de politesse excessive
7. Signe simplement: Harold

FORMAT DE RÉPONSE (respecte exactement ce format):
SUBJECT: [sujet de l'email, court et accrocheur]
BODY:
[corps de l'email]`

  const response = await getAnthropic().messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic')
  }

  return parseEmailResponse(content.text)
}

function parseEmailResponse(text: string): GeneratedEmail {
  const subjectMatch = text.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/)
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)$/)

  if (!subjectMatch || !bodyMatch) {
    console.error('Failed to parse AI response:', text)
    throw new Error('Failed to parse email from AI response')
  }

  return {
    subject: subjectMatch[1].trim(),
    body: bodyMatch[1].trim()
  }
}
