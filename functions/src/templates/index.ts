import { Segment, User, NEED_LABELS } from '../types'

interface EmailTemplate {
  subject: string
  body: string
}

interface TemplateVariables {
  prenom?: string
  primary_need_label?: string
  needs_labels?: string[]
  days_remaining?: number
  churn_reason?: string
  is_sales_director?: boolean
}

/**
 * Get template variables from user data
 */
export function getTemplateVariables(user: User, extra?: Partial<TemplateVariables>): TemplateVariables {
  const primaryNeed = user.needs?.[0]

  return {
    prenom: user.prenom,
    primary_need_label: primaryNeed ? NEED_LABELS[primaryNeed] : undefined,
    needs_labels: user.needs?.map(n => NEED_LABELS[n]),
    churn_reason: user.churn_reason,
    is_sales_director: user.role === 'sales_director',
    ...extra
  }
}

/**
 * Render a template with variables
 */
export function renderTemplate(segment: Segment, variables: TemplateVariables): EmailTemplate {
  const template = TEMPLATES[segment]
  if (!template) {
    throw new Error(`Template not found for segment: ${segment}`)
  }

  let subject = template.subject
  let body = template.body

  // Replace variables
  const prenomDisplay = variables.prenom ? ` ${variables.prenom}` : ''
  subject = subject.replace('{{prenom| }}', prenomDisplay)
  body = body.replace(/\{\{prenom\| \}\}/g, prenomDisplay)

  if (variables.primary_need_label) {
    subject = subject.replace('{{primary_need_label}}', variables.primary_need_label)
    body = body.replace(/\{\{primary_need_label\}\}/g, variables.primary_need_label)
  }

  if (variables.days_remaining !== undefined) {
    subject = subject.replace('{{days_remaining}}', String(variables.days_remaining))
    body = body.replace(/\{\{days_remaining\}\}/g, String(variables.days_remaining))
  }

  if (variables.churn_reason) {
    body = body.replace(/\{\{churn_reason\}\}/g, variables.churn_reason)
  }

  // Handle needs list
  if (variables.needs_labels && variables.needs_labels.length > 0) {
    const needsList = variables.needs_labels.map(n => `• ${n}`).join('\n')
    body = body.replace(/\{\{#each needs\}\}[\s\S]*?\{\{\/each\}\}/g, needsList)
  }

  // Handle sales_director condition
  if (variables.is_sales_director) {
    body = body.replace(
      /\{\{#if role == sales_director\}\}([\s\S]*?)\{\{\/if\}\}/g,
      '$1'
    )
  } else {
    body = body.replace(/\{\{#if role == sales_director\}\}[\s\S]*?\{\{\/if\}\}/g, '')
  }

  return { subject, body }
}

const SIGNATURE = '\n\n— Harold, créateur de Easy Way'

const TEMPLATES: Record<Segment, EmailTemplate> = {
  // WhatsMissing
  'WhatsMissing__hotel': {
    subject: 'Une question sur les hôtels',
    body: `Hey{{prenom| }},

Tu cherchais un truc pour trouver des hôtels sur tes trajets ?

Dis-moi ce qui t'a manqué — je lis tout.${SIGNATURE}`
  },

  'WhatsMissing__prospection': {
    subject: 'Une question sur la prospection',
    body: `Hey{{prenom| }},

Tu cherchais à trouver de nouveaux clients plus facilement ?

Qu'est-ce qui t'a manqué ? Réponds-moi en 2 mots.${SIGNATURE}`
  },

  'WhatsMissing__complex': {
    subject: 'Une question sur tes tournées',
    body: `Hey{{prenom| }},

Tu voulais créer des tournées multi-stops ?

Dis-moi ce qui a coincé.${SIGNATURE}`
  },

  'WhatsMissing__delivery': {
    subject: 'Une question sur tes livraisons',
    body: `Hey{{prenom| }},

Tu cherchais à optimiser tes tournées de livraison ?

Qu'est-ce qui t'a bloqué ?${SIGNATURE}`
  },

  'WhatsMissing__technician': {
    subject: 'Une question sur tes interventions',
    body: `Hey{{prenom| }},

Tu cherchais à mieux organiser tes interventions terrain ?

Dis-moi ce qui a manqué.${SIGNATURE}`
  },

  'WhatsMissing__default': {
    subject: 'Une question rapide',
    body: `Hey{{prenom| }},

T'as commencé à configurer Easy Way mais t'es pas allé au bout.

Qu'est-ce qui t'a manqué ?${SIGNATURE}`
  },

  // FreeOptions
  'FreeOptions': {
    subject: '3 façons gratuites de créer tes tournées',
    body: `Hey{{prenom| }},

Pas de souci si t'as pas pris l'essai.

Tu peux créer tes tournées sans nous :
• Google Maps → limité à 10 stops
• Excel + copier-coller → ça marche, mais long
• Autres apps → souvent payantes aussi

Si c'est autre chose qui t'a bloqué, dis-moi.${SIGNATURE}`
  },

  // QuickStart (by role) - now loaded from separate files
  'QuickStart__delivery': {
    subject: 'Bienvenue sur Easy Way !',
    body: `Bonjour{{prenom| }},

Content de vous avoir parmi nous !

Vous êtes livreur, vous savez ce que c'est de jongler entre les adresses et le temps qui file.

Si vous avez le moindre problème, contactez-moi.

Harold`
  },

  'QuickStart__field_sales': {
    subject: 'Bienvenue sur Easy Way !',
    body: `Bonjour{{prenom| }},

Content de vous avoir parmi nous !

Vous êtes sur le terrain, vous savez ce que c'est de courir entre les rendez-vous.

Si vous avez le moindre problème, contactez-moi.

Harold`
  },

  'QuickStart__technician': {
    subject: 'Bienvenue sur Easy Way !',
    body: `Bonjour{{prenom| }},

Content de vous avoir parmi nous !

Vous êtes technicien, vous savez ce que c'est d'enchaîner les interventions aux quatre coins de la ville.

Si vous avez le moindre problème, contactez-moi.

Harold`
  },

  'QuickStart__sales_director': {
    subject: 'Bienvenue sur Easy Way !',
    body: `Bonjour{{prenom| }},

Content de vous avoir parmi nous !

Vous êtes directeur commercial, vous savez ce que c'est d'avoir un agenda bien rempli.

Si vous avez le moindre problème, contactez-moi.

Harold`
  },

  'QuickStart__default': {
    subject: 'Bienvenue sur Easy Way !',
    body: `Bonjour{{prenom| }},

Content de vous avoir parmi nous !

Vous êtes souvent sur la route, vous savez ce que c'est d'optimiser ses déplacements.

Si vous avez le moindre problème, contactez-moi.

Harold`
  },

  // NoVisits
  'NoVisits': {
    subject: "Besoin d'un coup de main ?",
    body: `Hey{{prenom| }},

J'ai vu que t'as pas encore ajouté de visites.

Bloqué quelque part ? Dis-moi.${SIGNATURE}`
  },

  // NoOptimization
  'NoOptimization': {
    subject: 'T\'as créé une tournée !',
    body: `Hey{{prenom| }},

Nice, t'as ajouté des visites !

T'as pensé à optimiser ta tournée ? Un clic et on te fait gagner du temps.

Besoin d'aide ? Réponds-moi.${SIGNATURE}`
  },

  // WhyLeaving
  'WhyLeaving__unsubscribe': {
    subject: 'Une question avant de partir',
    body: `Bonjour{{prenom| }},

J'ai vu que vous avez arrêté votre abonnement.

Pas de souci — mais ça m'aiderait de comprendre pourquoi.

Répondez-moi en 2 mots, je lis tout.${SIGNATURE}`
  },

  'WhyLeaving__billing_error': {
    subject: 'Un problème avec votre paiement',
    body: `Bonjour{{prenom| }},

J'ai vu qu'il y a eu un souci avec votre paiement.

Si c'est une erreur de carte ou un problème technique, n'hésitez pas à me répondre — je peux vous aider à débloquer la situation.${SIGNATURE}`
  }
}
