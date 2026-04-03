import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'

// Secret stocké dans Firebase Secret Manager
// À créer : firebase functions:secrets:set NUDGE_WEBHOOK_SECRET
export const NUDGE_WEBHOOK_SECRET = defineSecret('NUDGE_WEBHOOK_SECRET')

// URL du webhook VPS (à configurer selon l'environnement)
const VPS_NUDGE_URL = process.env.VPS_NUDGE_URL || 'https://api.easyway-planner.com/nudge/nudge-event'

/**
 * Déclenché à la création d'un nouveau user dans Firestore.
 * Envoie un event au VPS pour déclencher un WhatsApp personnalisé.
 *
 * Firestore path: users/{userId} dans la base 'email-nudge'
 */
export const onNewUserWhatsapp = onDocumentCreated(
  {
    document: 'users/{userId}',
    database: 'email-nudge',
    secrets: [NUDGE_WEBHOOK_SECRET],
  },
  async (event) => {
    const user = event.data?.data()
    if (!user) return

    const phone = user.phone_number
    if (!phone) {
      console.log(`[WhatsApp] User ${event.params.userId} sans numéro de téléphone, ignoré.`)
      return
    }

    // Déterminer la plateforme depuis le locale ou laisser vide
    const platform = user.platform || 'ios' // À affiner si EasyWay envoie la plateforme

    // Déterminer le pays depuis le locale (fr → FR, en → US, etc.)
    const localeToCountry: Record<string, string> = {
      fr: 'FR', en: 'US', es: 'ES', de: 'DE', it: 'IT', pt: 'PT', nl: 'NL'
    }
    const country = user.country || localeToCountry[user.locale] || 'FR'

    const payload = {
      phone,
      email: user.email,
      first_name: user.first_name,
      event_type: 'new_signup',
      platform,
      country,
      locale: user.locale || 'fr',
      trial: user.trial_active === true,
      days_since_signup: 0,
      // Contexte onboarding
      role: user.role,
      needs: user.needs || [],
      user_step: user.user_step,
      // Métriques app
      contacts_total: user.contacts_total ?? 0,
      contacts_located: user.contacts_located ?? 0,
      routes_created: user.routes_created ?? 0,
      visits_logged: user.visits_logged ?? 0,
    }

    console.log(`[WhatsApp] Nouveau user — envoi event nudge: ${JSON.stringify({ ...payload, phone: phone.slice(0, 6) + '***' })}`)

    try {
      const response = await fetch(VPS_NUDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nudge-Secret': NUDGE_WEBHOOK_SECRET.value(),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      if (!response.ok) {
        console.error(`[WhatsApp] Webhook VPS erreur ${response.status}: ${await response.text()}`)
      } else {
        console.log(`[WhatsApp] Event envoyé au VPS ✅`)
      }
    } catch (err) {
      console.error(`[WhatsApp] Erreur appel VPS:`, err)
    }
  }
)
