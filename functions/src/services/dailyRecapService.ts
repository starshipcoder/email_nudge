import { Resend } from 'resend'
import { RESEND_API_KEY } from './emailService'
import { db } from '../index'
import { User, Role, Need, NEED_LABELS } from '../types'

const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
const RECAP_RECIPIENT = 'harold@easyway-planner.com'

// Roles considérés comme "commerciaux" (prioritaires dans le récap)
const SALES_ROLES: Role[] = ['field_sales', 'sales_director']

const roleLabels: Record<Role, string> = {
  field_sales: 'Commercial terrain',
  sales_director: 'Directeur commercial',
  delivery: 'Livreur',
  technician: 'Technicien',
  other: 'Autre'
}

export interface DailyRecapResult {
  success: boolean
  message: string
  stats: {
    new_users: number
    paywall_blocked: number
    no_optimization: number
    churned: number
  }
  email_sent: boolean
}

/**
 * Send daily recap of user activity (not based on emails sent)
 */
export async function sendDailyRecap(): Promise<DailyRecapResult> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  console.log(`[Daily Recap] Analyzing users for ${formatDate(yesterday)}`)

  // Fetch all users (we'll filter in memory for flexibility)
  const usersSnapshot = await db.collection('users').get()
  const allUsers: User[] = usersSnapshot.docs.map(doc => {
    const data = doc.data()
    return {
      ...data,
      id: doc.id,
      created_at: toDate(data.created_at),
      churned_at: toDate(data.churned_at),
      onboarding_completed_at: toDate(data.onboarding_completed_at),
      last_action_at: toDate(data.last_action_at)
    } as User
  }).filter(u => !u.is_test_user)

  // 1. New users yesterday
  const newUsers = allUsers.filter(u => {
    const createdAt = u.created_at
    return createdAt && createdAt >= yesterday && createdAt < today
  })

  // 2. Paywall blocked (not passed, currently blocked)
  const paywallBlocked = allUsers.filter(u =>
    u.paywall_blocked === true && u.paywall_passed !== true
  )

  // 3. No optimization (has visits but never optimized)
  const noOptimization = allUsers.filter(u =>
    u.has_added_visits === true &&
    u.has_optimized_route !== true &&
    u.churned_at === undefined
  )

  // 5. Churned yesterday
  const churnedYesterday = allUsers.filter(u => {
    const churnedAt = u.churned_at
    return churnedAt && churnedAt >= yesterday && churnedAt < today
  })

  // Generate email body
  const subject = `Récap Easy Way - ${formatDate(yesterday)}`
  const body = generateRecapBody({
    date: yesterday,
    newUsers,
    paywallBlocked,
    noOptimization,
    churnedYesterday
  })

  // Send via Resend
  const resend = new Resend(RESEND_API_KEY.value())

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: RECAP_RECIPIENT,
      subject,
      text: body
    })

    const stats = {
      new_users: newUsers.length,
      paywall_blocked: paywallBlocked.length,
      no_optimization: noOptimization.length,
      churned: churnedYesterday.length
    }

    console.log(`[Daily Recap] Sent:`, stats)

    return {
      success: true,
      message: `Récap envoyé à ${RECAP_RECIPIENT}`,
      stats,
      email_sent: true
    }
  } catch (error) {
    console.error('[Daily Recap] Failed to send:', error)
    return {
      success: false,
      message: `Erreur: ${String(error)}`,
      stats: {
        new_users: newUsers.length,
        paywall_blocked: paywallBlocked.length,
        no_optimization: noOptimization.length,
        churned: churnedYesterday.length
      },
      email_sent: false
    }
  }
}

interface RecapData {
  date: Date
  newUsers: User[]
  paywallBlocked: User[]
  noOptimization: User[]
  churnedYesterday: User[]
}

function generateRecapBody(data: RecapData): string {
  const { date, newUsers, paywallBlocked, noOptimization, churnedYesterday } = data

  let body = `📊 RÉCAP EASY WAY - ${formatDate(date)}\n`
  body += `${'='.repeat(60)}\n\n`

  // Stats summary
  body += `📈 RÉSUMÉ\n`
  body += `${'-'.repeat(60)}\n`
  body += `• Nouveaux inscrits hier: ${newUsers.length}\n`
  body += `• Bloqués au paywall: ${paywallBlocked.length}\n`
  body += `• Sans optimisation: ${noOptimization.length}\n`
  body += `• Churns hier: ${churnedYesterday.length}\n`
  body += `\n${'='.repeat(60)}\n\n`

  // Section 1: Churns (PRIORITY)
  if (churnedYesterday.length > 0) {
    body += `🚨 CHURNS HIER (${churnedYesterday.length})\n`
    body += `${'-'.repeat(60)}\n`
    body += formatUserList(churnedYesterday, true)
    body += `\n${'='.repeat(60)}\n\n`
  }

  // Section 2: New users
  if (newUsers.length > 0) {
    body += `🆕 NOUVEAUX INSCRITS HIER (${newUsers.length})\n`
    body += `${'-'.repeat(60)}\n`
    body += formatUserList(newUsers)
    body += `\n${'='.repeat(60)}\n\n`
  }

  // Section 3: Paywall blocked (only sales roles for detail)
  const salesPaywallBlocked = paywallBlocked.filter(u => SALES_ROLES.includes(u.role))
  if (salesPaywallBlocked.length > 0) {
    body += `🚧 COMMERCIAUX BLOQUÉS AU PAYWALL (${salesPaywallBlocked.length}/${paywallBlocked.length} total)\n`
    body += `${'-'.repeat(60)}\n`
    body += formatUserList(salesPaywallBlocked)
    body += `\n${'='.repeat(60)}\n\n`
  } else if (paywallBlocked.length > 0) {
    body += `🚧 BLOQUÉS AU PAYWALL: ${paywallBlocked.length} utilisateurs (aucun commercial)\n\n`
  }

  // Section 4: No optimization (only sales roles for detail)
  const salesNoOptimization = noOptimization.filter(u => SALES_ROLES.includes(u.role))
  if (salesNoOptimization.length > 0) {
    body += `🔄 COMMERCIAUX SANS OPTIMISATION (${salesNoOptimization.length}/${noOptimization.length} total)\n`
    body += `${'-'.repeat(60)}\n`
    body += formatUserList(salesNoOptimization)
    body += `\n`
  } else if (noOptimization.length > 0) {
    body += `🔄 SANS OPTIMISATION: ${noOptimization.length} utilisateurs (aucun commercial)\n\n`
  }

  return body
}

function formatUserList(users: User[], showChurnReason = false): string {
  let result = ''

  // Sort: French first, then by role (sales first)
  const sorted = [...users].sort((a, b) => {
    // French first
    if (a.locale === 'fr' && b.locale !== 'fr') return -1
    if (a.locale !== 'fr' && b.locale === 'fr') return 1
    // Sales first
    const aIsSales = SALES_ROLES.includes(a.role)
    const bIsSales = SALES_ROLES.includes(b.role)
    if (aIsSales && !bIsSales) return -1
    if (!aIsSales && bIsSales) return 1
    return 0
  })

  for (const user of sorted) {
    const name = user.first_name || 'Prénom inconnu'
    const role = roleLabels[user.role] || user.role
    const locale = (user.locale || 'fr').toUpperCase()
    const phone = user.phone_number || ''
    const isSales = SALES_ROLES.includes(user.role)

    result += `• ${name} (${role}) [${locale}]${isSales ? ' ⭐' : ''}\n`
    result += `  Email: ${user.email}\n`

    if (phone) {
      result += `  Tél: ${phone}\n`
    }

    if (showChurnReason && user.churn_reason) {
      result += `  Raison: ${user.churn_reason}\n`
    }

    // Needs for context
    if (user.needs && user.needs.length > 0) {
      const needsLabels = user.needs
        .map(need => NEED_LABELS[need as Need] || need)
        .join(', ')
      result += `  Besoins: ${needsLabels}\n`
    }

    // WhatsApp suggestion for French sales with phone
    if (locale === 'FR' && isSales && phone) {
      result += `  💬 WhatsApp dispo\n`
    }

    result += `\n`
  }

  return result
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}
