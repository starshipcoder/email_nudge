// Les métiers et besoins que l'app envoie (contactonmap_pro-flutter/app_easyway/lib/services/email_nudge/email_nudge_user.dart).
// BUG-EW-6 (22/11) : syncUser n'en acceptait que 5 et 6, et une seule valeur refusée faisait rejeter tout l'envoi.
import { Locale, Need, Role } from '../types'

export const VALID_ROLES: Role[] = ['delivery', 'field_sales', 'technician', 'sales_director', 'real_estate', 'healthcare', 'personal', 'other']
export const VALID_NEEDS: Need[] = ['hotel_search', 'new_clients', 'complex_routes', 'max_visits', 'multi_day', 'client_tracking',
  'adapt_route', 'visualize_on_map', 'organize_groups', 'navigate_to_contact', 'share_export']

// syncUser ne refuse plus un envoi pour une valeur qu'il ne connaît pas (fondateur, 22/11 : « que ça ne crache pas
// quand il ne connaît pas le truc ») : une valeur bien formée est gardée et signalée dans le journal, une valeur
// malformée est écartée, et le reste de l'envoi passe.
const FORME = /^[a-z][a-z0-9_]{0,39}$/

export function garderMetier(valeur: unknown): { valeur: string | null, inconnue: boolean } {
  if (typeof valeur !== 'string' || !FORME.test(valeur)) return { valeur: null, inconnue: false }
  return { valeur, inconnue: !VALID_ROLES.includes(valeur as Role) }
}

export function garderBesoins(valeurs: unknown): { valeurs: string[] | null, inconnues: string[] } {
  if (!Array.isArray(valeurs)) return { valeurs: null, inconnues: [] }
  const gardees = [...new Set(valeurs.filter((v): v is string => typeof v === 'string' && FORME.test(v)))]
  return { valeurs: gardees, inconnues: gardees.filter((v) => !VALID_NEEDS.includes(v as Need)) }
}

export const VALID_LOCALES: Locale[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl']
export function garderLangue(valeur: unknown): { valeur: string | null, inconnue: boolean } {
  if (typeof valeur !== 'string') return { valeur: null, inconnue: false }
  const v = valeur.trim().toLowerCase()
  if (!/^[a-z]{2,3}$/.test(v)) return { valeur: null, inconnue: false }
  return { valeur: v, inconnue: !VALID_LOCALES.includes(v as Locale) }
}

// La réponse au questionnaire de départ que l'app envoie (INT-EW-79 ; contactonmap_pro-flutter,
// email_nudge_repository.dart, churnSurveyFields). Préfixe churn_survey_ exprès : churn_reason et churned_at
// viennent du seul webhook RevenueCat et décident de WhyLeaving ; cette fonction ne les renvoie jamais.
// Comme pour les métiers : une valeur inattendue est écartée et signalée, le reste de l'envoi passe.
// La raison est la chaîne de l'événement Mixpanel Action-churn (« _MainChurnReason.tooExpensive »).
const FORME_RAISON = /^[A-Za-z_][A-Za-z0-9_.]{0,79}$/
const TEXTE_MAX = 2000
const COMPTE_MAX = 1000000

export function garderReponseDepart(data: Record<string, unknown>): { champs: Record<string, unknown>, ecartes: string[] } {
  const champs: Record<string, unknown> = {}
  const ecartes: string[] = []
  const r = data.churn_survey_reason
  if (r !== undefined) {
    if (typeof r === 'string' && FORME_RAISON.test(r.trim())) champs.churn_survey_reason = r.trim()
    else ecartes.push('churn_survey_reason')
  }
  const t = data.churn_survey_text
  if (t !== undefined) {
    if (typeof t === 'string' && t.trim()) champs.churn_survey_text = t.trim().slice(0, TEXTE_MAX)
    else ecartes.push('churn_survey_text')
  }
  const le = data.churn_survey_answered_at
  if (le !== undefined) {
    const d = typeof le === 'string' ? new Date(le) : null
    if (d && !isNaN(d.getTime())) champs.churn_survey_answered_at = d
    else ecartes.push('churn_survey_answered_at')
  }
  for (const champ of ['app_sessions_total', 'seniority_days']) {
    const n = data[champ]
    if (n === undefined) continue
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= COMPTE_MAX) champs[champ] = n
    else ecartes.push(champ)
  }
  return { champs, ecartes }
}
