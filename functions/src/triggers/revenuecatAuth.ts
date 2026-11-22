// BUG-EW-6 (22/11) : le webhook RevenueCat n'accepte que les appels qui portent le mot de passe réglé dans le tableau de
// bord de RevenueCat (en-tête Authorization). Le même mot de passe est le secret Firebase REVENUECAT_WEBHOOK_AUTH.
import { timingSafeEqual } from 'crypto'

export function appelRevenueCatAutorise(enTete: string | undefined, secret: string): boolean {
  if (!secret || !enTete) return false
  const recu = enTete.replace(/^Bearer\s+/i, '').trim()
  const a = Buffer.from(recu)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
