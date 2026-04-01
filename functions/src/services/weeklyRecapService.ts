import { Resend } from 'resend'
import { RESEND_API_KEY } from './emailService'
import { db } from '../index'
import { EmailLog, Role } from '../types'

const FROM_EMAIL = 'Harold <harold@easyway-planner.com>'
const RECAP_RECIPIENT = 'harold@easyway-planner.com'

export interface WeeklyRecapResult {
  success: boolean
  message: string
  total_emails_week: number
  total_users: number
  email_sent: boolean
}

/**
 * Send weekly recap (Monday morning)
 */
export async function sendWeeklyRecap(): Promise<WeeklyRecapResult> {
  const today = new Date()
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  lastWeek.setHours(0, 0, 0, 0)

  console.log(`[Weekly Recap] Fetching emails from last 7 days (since ${lastWeek})`)

  // Fetch all email logs from last 7 days
  const logsSnapshot = await db
    .collection('email_logs')
    .where('status', '==', 'sent')
    .where('sent_at', '>=', lastWeek)
    .get()

  const totalEmailsWeek = logsSnapshot.docs.length

  // Fetch user stats
  const usersSnapshot = await db.collection('users').get()
  const totalUsers = usersSnapshot.docs.length

  // Stats
  const stats = {
    byRole: {} as Record<string, number>,
    byEmailType: {} as Record<string, number>,
    byLocale: {} as Record<string, number>,
    churns: 0,
    activeTrials: 0,
    activeSubscriptions: 0
  }

  // Collect stats from users
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data()

    // By role
    const role = (user.role as Role) || 'other'
    if (role && typeof role === 'string') {
      stats.byRole[role] = (stats.byRole[role] || 0) + 1
    }

    // By locale
    const locale = (user.locale || 'fr').toUpperCase()
    stats.byLocale[locale] = (stats.byLocale[locale] || 0) + 1

    // Churns in last 7 days
    if (user.churned_at) {
      const churnedAt = user.churned_at.toDate?.() || user.churned_at
      if (churnedAt >= lastWeek) {
        stats.churns++
      }
    }

    // Active trials/subscriptions
    if (user.trial_active) stats.activeTrials++
    if (user.subscription_active) stats.activeSubscriptions++
  }

  // Count by email type
  for (const logDoc of logsSnapshot.docs) {
    const log = logDoc.data() as EmailLog
    stats.byEmailType[log.email_name] = (stats.byEmailType[log.email_name] || 0) + 1
  }

  // Generate email
  const subject = `📊 Récap hebdomadaire Easy Way - ${formatDate(lastWeek)} au ${formatDate(today)}`
  const body = generateWeeklyBody(stats, totalEmailsWeek, totalUsers, lastWeek, today)

  const resend = new Resend(RESEND_API_KEY.value())

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: RECAP_RECIPIENT,
      subject,
      text: body
    })

    console.log(`[Weekly Recap] Sent weekly recap`)

    return {
      success: true,
      message: `Récap hebdomadaire envoyé à ${RECAP_RECIPIENT}`,
      total_emails_week: totalEmailsWeek,
      total_users: totalUsers,
      email_sent: true
    }
  } catch (error) {
    console.error('[Weekly Recap] Failed to send:', error)
    return {
      success: false,
      message: `Erreur: ${String(error)}`,
      total_emails_week: totalEmailsWeek,
      total_users: totalUsers,
      email_sent: false
    }
  }
}

function generateWeeklyBody(
  stats: any,
  totalEmails: number,
  totalUsers: number,
  startDate: Date,
  endDate: Date
): string {
  const roleLabels: Record<Role, string> = {
    field_sales: 'Commercial terrain',
    sales_director: 'Directeur commercial',
    delivery: 'Livreur',
    technician: 'Technicien',
    other: 'Autre'
  }

  const emailLabels: Record<string, string> = {
    WhatsMissing: 'Onboarding abandonné',
    QuickStart: 'Bienvenue',
    NoVisits: 'Aucune visite',
    NoOptimization: 'Pas optimisé',
    WhyLeaving: 'Churn'
  }

  let body = `Récapitulatif hebdomadaire Easy Way\n`
  body += `Période: ${formatDate(startDate)} au ${formatDate(endDate)}\n\n`
  body += `${'='.repeat(80)}\n\n`

  // Section 1: Vue d'ensemble
  body += `📊 VUE D'ENSEMBLE\n`
  body += `${'-'.repeat(80)}\n`
  body += `Utilisateurs totaux: ${totalUsers}\n`
  body += `Emails envoyés (7 jours): ${totalEmails}\n`
  body += `Churns cette semaine: ${stats.churns}\n`
  body += `Essais actifs: ${stats.activeTrials}\n`
  body += `Abonnements actifs: ${stats.activeSubscriptions}\n\n`

  // Section 2: Par rôle
  body += `${'='.repeat(80)}\n\n`
  body += `👥 RÉPARTITION PAR RÔLE\n`
  body += `${'-'.repeat(80)}\n`

  const sortedRoles = Object.entries(stats.byRole).sort((a, b) => (b[1] as number) - (a[1] as number))
  for (const [role, count] of sortedRoles) {
    const label = roleLabels[role as Role] || role
    const percentage = Math.round((count as number / totalUsers) * 100)
    body += `${label}: ${count} (${percentage}%)\n`
  }

  // Section 3: Par pays
  body += `\n${'='.repeat(80)}\n\n`
  body += `🌍 RÉPARTITION PAR PAYS\n`
  body += `${'-'.repeat(80)}\n`

  const sortedLocales = Object.entries(stats.byLocale).sort((a, b) => (b[1] as number) - (a[1] as number))
  for (const [locale, count] of sortedLocales) {
    const percentage = Math.round((count as number / totalUsers) * 100)
    body += `${locale}: ${count} (${percentage}%)\n`
  }

  // Section 4: Emails envoyés (si > 0)
  if (totalEmails > 0) {
    body += `\n${'='.repeat(80)}\n\n`
    body += `📧 EMAILS ENVOYÉS CETTE SEMAINE\n`
    body += `${'-'.repeat(80)}\n`

    for (const [emailType, count] of Object.entries(stats.byEmailType)) {
      const label = emailLabels[emailType] || emailType
      body += `${label}: ${count}\n`
    }
  }

  // Section 5: Churns
  if (stats.churns > 0) {
    body += `\n${'='.repeat(80)}\n\n`
    body += `⚠️ ATTENTION: ${stats.churns} churn(s) cette semaine\n`
    body += `${'-'.repeat(80)}\n`
    body += `Vérifier les alertes churn individuelles envoyées cette semaine.\n`
  }

  return body
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}
