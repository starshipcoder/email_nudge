// BUG-EW-6 (22/11) : le webhook RevenueCat n'accepte que RevenueCat, et syncUser accepte ce que l'app envoie.
import { appelRevenueCatAutorise } from '../triggers/revenuecatAuth'
import { VALID_NEEDS, VALID_ROLES } from '../triggers/valeurs'

describe('webhook RevenueCat : le mot de passe secret', () => {
  const secret = 'un-secret-de-test-assez-long-0123456789'
  it('accepte le bon en-tête, avec ou sans « Bearer »', () => {
    expect(appelRevenueCatAutorise(secret, secret)).toBe(true)
    expect(appelRevenueCatAutorise(`Bearer ${secret}`, secret)).toBe(true)
  })
  it('refuse sans en-tête, avec un mauvais, ou si le secret n’est pas réglé', () => {
    expect(appelRevenueCatAutorise(undefined, secret)).toBe(false)
    expect(appelRevenueCatAutorise('', secret)).toBe(false)
    expect(appelRevenueCatAutorise('autre-chose', secret)).toBe(false)
    expect(appelRevenueCatAutorise(`${secret}x`, secret)).toBe(false)
    expect(appelRevenueCatAutorise(secret, '')).toBe(false)
  })
})

describe('syncUser : les métiers et besoins de l’app', () => {
  // La liste de l'app : contactonmap_pro-flutter/app_easyway/lib/services/email_nudge/email_nudge_user.dart
  const metiersApp = ['field_sales', 'delivery', 'technician', 'sales_director', 'real_estate', 'healthcare', 'personal', 'other']
  const besoinsApp = ['max_visits', 'client_tracking', 'complex_routes', 'adapt_route', 'multi_day', 'hotel_search', 'new_clients',
    'visualize_on_map', 'organize_groups', 'navigate_to_contact', 'share_export']
  it('accepte chaque métier envoyé par l’app', () => {
    for (const m of metiersApp) expect(VALID_ROLES).toContain(m)
  })
  it('accepte chaque besoin envoyé par l’app', () => {
    for (const b of besoinsApp) expect(VALID_NEEDS).toContain(b)
  })
})

describe('syncUser : une valeur inconnue ne fait plus rejeter l’envoi', () => {
  const { garderMetier, garderBesoins } = require('../triggers/valeurs')
  it('garde un métier inconnu bien formé, et le signale', () => {
    expect(garderMetier('farmer')).toEqual({ valeur: 'farmer', inconnue: true })
    expect(garderMetier('delivery')).toEqual({ valeur: 'delivery', inconnue: false })
  })
  it('écarte une valeur malformée sans rien casser', () => {
    expect(garderMetier('<script>')).toEqual({ valeur: null, inconnue: false })
    expect(garderMetier(42)).toEqual({ valeur: null, inconnue: false })
  })
  it('garde les besoins bien formés, connus ou non, sans doublon', () => {
    expect(garderBesoins(['max_visits', 'nouveau_besoin', 'max_visits', 'Mal Formé', 3])).toEqual({ valeurs: ['max_visits', 'nouveau_besoin'], inconnues: ['nouveau_besoin'] })
    expect(garderBesoins('pas une liste')).toEqual({ valeurs: null, inconnues: [] })
  })
})

describe('syncUser : la langue du téléphone', () => {
  const { garderLangue } = require('../triggers/valeurs')
  it('garde une langue hors liste au lieu de rejeter l’envoi', () => {
    expect(garderLangue('pl')).toEqual({ valeur: 'pl', inconnue: true })
    expect(garderLangue('FR')).toEqual({ valeur: 'fr', inconnue: false })
    expect(garderLangue('fr_FR')).toEqual({ valeur: null, inconnue: false })
  })
})
