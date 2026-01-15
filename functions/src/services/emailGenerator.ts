import { User, EmailName } from '../types'
import { renderEmailTemplate } from '../templates/emailTemplates'
import { resolveSegment } from '../utils/segmentResolver'

export interface GeneratedEmail {
  subject: string
  body: string
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

/**
 * Extract first name from user or email
 */
export function getFirstName(user: User): string | null {
  return user.first_name || extractFirstName(user.email)
}

/**
 * Generate email using template
 */
export function generateEmail(
  user: User,
  emailName: EmailName
): GeneratedEmail {
  const locale = user.locale || 'fr'
  const segment = resolveSegment(emailName, user)
  const firstName = getFirstName(user)
  const primaryNeed = user.needs?.[0] || null

  return renderEmailTemplate(segment, locale, {
    first_name: firstName || undefined,
    primaryNeed
  })
}
