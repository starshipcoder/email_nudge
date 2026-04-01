import { Resend } from 'resend'
import { RESEND_API_KEY } from './emailService'
import { db } from '../index'
import { User, Role } from '../types'

const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
const ALERT_RECIPIENT = 'harold@easyway-planner.com'

// Roles prioritaires pour les alertes
const PRIORITY_ROLES: Role[] = ['field_sales', 'sales_director']

/**
 * Send immediate churn alert to Harold
 */
export async function sendChurnAlert(userId: string): Promise<void> {
  const userDoc = await db.collection('users').doc(userId).get()
  if (!userDoc.exists) {
    console.error(`[Churn Alert] User ${userId} not found`)
    return
  }

  const user = { id: userId, ...userDoc.data() } as User

  const role = user.role || 'other'
  const isPriority = PRIORITY_ROLES.includes(role)
  const locale = (user.locale || 'fr').toUpperCase()
  const phone = user.phone_number || 'Pas de téléphone'
  const name = user.first_name || 'Prénom inconnu'
  const churnReason = user.churn_reason || 'Raison inconnue'

  // Emoji selon priorité
  const priorityEmoji = isPriority ? '🚨' : 'ℹ️'
  const roleLabel = getRoleLabel(role)

  const subject = `${priorityEmoji} CHURN : ${name} (${roleLabel}) [${locale}]`

  const body = `Un utilisateur vient de churner.\n\n` +
    `${'-'.repeat(80)}\n\n` +
    `Priorité: ${isPriority ? '🔴 HAUTE (commercial)' : '🟢 Normale'}\n` +
    `Nom: ${name}\n` +
    `Rôle: ${roleLabel}\n` +
    `Email: ${user.email}\n` +
    `Téléphone: ${phone}\n` +
    `Langue: ${locale}\n` +
    `Raison: ${churnReason}\n\n` +
    `${'-'.repeat(80)}\n\n` +
    (isPriority && locale === 'FR' && phone !== 'Pas de téléphone'
      ? `💬 WHATSAPP POSSIBLE\n` +
        `Numéro: ${phone}\n` +
        `Message suggéré: "Bonjour ${name}, c'est Harold d'Easy Way. J'ai vu que vous avez arrêté l'abonnement. Qu'est-ce qui n'allait pas ?"\n\n`
      : '') +
    `Firestore: https://console.firebase.google.com/project/contact-on-map-flutter/firestore/data/~2Fusers~2F${userId}`

  const resend = new Resend(RESEND_API_KEY.value())

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ALERT_RECIPIENT,
      subject,
      text: body
    })

    console.log(`[Churn Alert] Sent alert for ${userId} (${roleLabel})`)
  } catch (error) {
    console.error(`[Churn Alert] Failed to send alert for ${userId}:`, error)
  }
}

function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    field_sales: 'Commercial terrain',
    sales_director: 'Directeur commercial',
    delivery: 'Livreur',
    technician: 'Technicien',
    other: 'Autre'
  }
  return labels[role] || role
}
