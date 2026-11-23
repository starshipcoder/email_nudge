// INT-EW-79 : syncUser range la réponse au questionnaire de départ que l'app envoie (contactonmap_pro-flutter,
// email_nudge_repository.dart, churnSurveyFields), sans rien déclencher de WhyLeaving.
// Une base en mémoire à la place de Firestore, une clé inventée : aucun service réel.

const docs = new Map<string, Record<string, unknown>>()
const fausseBase = {
  collection: (nom: string) => ({
    doc: (id: string) => {
      const cle = `${nom}/${id}`
      return {
        get: async () => ({ exists: docs.has(cle), data: () => docs.get(cle) }),
        set: async (v: Record<string, unknown>) => { docs.set(cle, { ...v }) },
        update: async (v: Record<string, unknown>) => { docs.set(cle, { ...(docs.get(cle) ?? {}), ...v }) }
      }
    }
  })
}
jest.mock('../index', () => ({ db: fausseBase }))
jest.mock('firebase-functions/params', () => ({ defineSecret: () => ({ value: () => 'cle-de-test' }) }))

import { syncUser, computeUserStatus } from '../triggers/apiTriggers'
import { garderReponseDepart } from '../triggers/valeurs'
import { resolveSegment } from '../utils/segmentResolver'

function appeler(body: Record<string, unknown>): Promise<{ status: number, body: any }> {
  return new Promise((resolve) => {
    let status = 200
    const res: any = {
      status(s: number) { status = s; return res },
      json(b: unknown) { resolve({ status, body: b }); return res },
      send(b: unknown) { resolve({ status, body: b }); return res },
      setHeader() { return res }, getHeader() { return undefined }, set() { return res }, on() { return res },
      end() { resolve({ status, body: null }) }
    }
    const req: any = { method: 'POST', headers: { 'x-api-key': 'cle-de-test' }, body, query: {}, get: () => undefined }
    ;(syncUser as any)(req, res)
  })
}

// Ce que l'app envoie (test de l'app, email_nudge_service_test.dart), avec une adresse inventée.
const envoiApp = {
  email: 'personne.inventee@example.test',
  revenuecat_id: 'rc_invente_1',
  churn_survey_reason: '_MainChurnReason.tooExpensive',
  churn_survey_text: 'il manque la synchro agenda',
  churn_survey_answered_at: '2026-11-23T09:30:00.000Z',
  app_sessions_total: 3,
  seniority_days: 1,
  onboarding_complete: true
}

beforeEach(() => docs.clear())

describe('syncUser : la réponse au questionnaire de départ', () => {
  it('répond 200 et range les cinq champs dans users', async () => {
    const r = await appeler(envoiApp)
    expect(r.status).toBe(200)
    const u = docs.get('users/personne.inventee@example.test')!
    expect(u.churn_survey_reason).toBe('_MainChurnReason.tooExpensive')
    expect(u.churn_survey_text).toBe('il manque la synchro agenda')
    expect(u.churn_survey_answered_at).toEqual(new Date('2026-11-23T09:30:00.000Z'))
    expect(u.app_sessions_total).toBe(3)
    expect(u.seniority_days).toBe(1)
  })

  it('range aussi la réponse sur une fiche qui existe déjà, sans le texte quand rien n’a été tapé', async () => {
    docs.set('users/personne.inventee@example.test', { email: 'personne.inventee@example.test', onboarding_complete: true })
    const { churn_survey_text, ...sansTexte } = envoiApp
    const r = await appeler(sansTexte)
    expect(r.status).toBe(200)
    const u = docs.get('users/personne.inventee@example.test')!
    expect(u.churn_survey_reason).toBe('_MainChurnReason.tooExpensive')
    expect(u).not.toHaveProperty('churn_survey_text')
  })

  it('le journal ne garde ni l’e-mail, ni le téléphone, ni le texte libre', async () => {
    const espion = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await appeler({ ...envoiApp, phone_number: '+33600000000' })
      const ecrit = espion.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
      expect(ecrit).toContain('[syncUser]')
      for (const secret of ['personne.inventee@example.test', '+33600000000', 'il manque la synchro agenda']) {
        expect(ecrit).not.toContain(secret)
      }
    } finally {
      espion.mockRestore()
    }
  })

  it('ne plante pas sur une valeur inattendue : elle est écartée, le reste passe', async () => {
    const r = await appeler({ ...envoiApp, churn_survey_reason: 42, app_sessions_total: 'trois', seniority_days: -1,
      churn_survey_answered_at: 'pas une date', churn_survey_text: '   ' })
    expect(r.status).toBe(200)
    const u = docs.get('users/personne.inventee@example.test')!
    for (const champ of ['churn_survey_reason', 'churn_survey_text', 'churn_survey_answered_at', 'app_sessions_total', 'seniority_days']) {
      expect(u).not.toHaveProperty(champ)
    }
    expect(u.revenuecat_id).toBe('rc_invente_1')
  })
})

describe('syncUser : la réponse de l’app ne déclenche pas WhyLeaving', () => {
  it('n’écrit ni churned_at ni churn_reason, même si l’app les envoyait', async () => {
    await appeler({ ...envoiApp, churn_reason: 'unsubscribe', churned_at: '2026-11-23T09:30:00.000Z' })
    const u = docs.get('users/personne.inventee@example.test')!
    expect(u).not.toHaveProperty('churned_at')
    expect(u).not.toHaveProperty('churn_reason')
  })

  it('la fiche avec la réponse n’est pas « churned » et n’attend pas WhyLeaving', async () => {
    await appeler(envoiApp)
    const statut = computeUserStatus(docs.get('users/personne.inventee@example.test')!)
    expect(statut.current_stage).not.toBe('churned')
    expect(statut.next_email).not.toBe('WhyLeaving')
  })

  it('le segment de WhyLeaving ne lit que churn_reason de RevenueCat, pas la réponse de l’app', () => {
    const fiche: any = { email: 'x@example.test', churn_survey_reason: 'billing_error' }
    expect(resolveSegment('WhyLeaving', fiche)).toBe('WhyLeaving__unsubscribe')
    expect(resolveSegment('WhyLeaving', { ...fiche, churn_reason: 'billing_error' })).toBe('WhyLeaving__billing_error')
  })
})

describe('garderReponseDepart', () => {
  it('garde une raison inconnue bien formée et coupe un texte trop long', () => {
    const r = garderReponseDepart({ churn_survey_reason: 'NouvelleRaison.autreChose', churn_survey_text: 'a'.repeat(5000) })
    expect(r.champs.churn_survey_reason).toBe('NouvelleRaison.autreChose')
    expect((r.champs.churn_survey_text as string).length).toBe(2000)
  })
  it('écarte une raison malformée et un nombre non entier', () => {
    const r = garderReponseDepart({ churn_survey_reason: '<script>', app_sessions_total: 2.5, seniority_days: 7 })
    expect(r.champs).toEqual({ seniority_days: 7 })
    expect(r.ecartes.sort()).toEqual(['app_sessions_total', 'churn_survey_reason'])
  })
  it('ne renvoie jamais churn_reason ni churned_at', () => {
    const r = garderReponseDepart({ churn_reason: 'x', churned_at: '2026-11-23T09:30:00.000Z' })
    expect(r.champs).toEqual({})
  })
})
