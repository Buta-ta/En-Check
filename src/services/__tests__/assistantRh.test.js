import { describe, expect, it, vi } from 'vitest'
import { answerRhQuestion, parseRhQuestion, rhPeriod } from '../assistantRh'
const admin = { enterprise_id: 'company' }
const now = new Date('2026-10-19T23:30:00Z')
function setup(overrides = {}) {
  const calls = []
  const query = {
    select: (...a) => { calls.push(['select', ...a]); return query },
    eq: (...a) => { calls.push(['eq', ...a]); return query },
    is: (...a) => { calls.push(['is', ...a]); return query },
    gte: (...a) => { calls.push(['gte', ...a]); return query },
    lt: (...a) => { calls.push(['lt', ...a]); return query },
    order: () => query,
    limit: async () => ({ data: [], count: 0, ...overrides.attendance }),
    maybeSingle: async () => ({ data: { id: 'company', name: 'Démo', timezone: 'Africa/Porto-Novo' }, ...overrides.company }),
  }
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user' } }, ...overrides.auth })) },
    from: vi.fn(() => query),
    rpc: vi.fn((name, args) => {
      calls.push(['rpc', name, args])
      if (name === 'encheck_est_admin_de') return Promise.resolve({ data: true, ...overrides.access })
      return { range: async () => ({ data: [], ...overrides.retards }) }
    }),
  }
  const loadHolidays = overrides.loadHolidays || vi.fn(async () => [])
  return { client, calls, loadHolidays, run: (query, extra = {}) => answerRhQuestion({ query, admin, now, client, loadHolidays, ...extra }) }
}
describe('Assistant RH — compréhension prudente', () => {
  it('demande la période sans appeler la base', async () => {
    const s = setup(); const r = await s.run('Qui est en retard ?')
    expect(r.title).toBe('Pour quelle période ?'); expect(r.choices).toHaveLength(3)
    expect(s.client.auth.getUser).not.toHaveBeenCalled()
  })
  it('ne supprime jamais silencieusement un nom ou une période inconnue', () => {
    expect(parseRhQuestion('retards Amadou hier')).toEqual({ unsupported: true })
    expect(parseRhQuestion('pointages la semaine dernière')).toEqual({ unsupported: true })
    expect(parseRhQuestion('hier')).toEqual({ unsupported: true })
    expect(parseRhQuestion('matricule ABC-123')).toBeNull()
  })
  it('conserve seulement l’intention précédente dans la même entreprise', async () => {
    const s = setup()
    const response = await s.run('hier', { previous: { enterprise: 'company', intent: 'pointages' } })
    expect(response.title).toBe('Pointages enregistrés')
    expect(response.period).toBe('2026-10-19 → 2026-10-19')
    const other = setup()
    expect((await other.run('hier', { previous: { enterprise: 'other', intent: 'pointages' } })).title).toBe('Précisons votre question')
    expect(other.client.from).not.toHaveBeenCalled()
  })
  it('respecte date locale, lundi et jours invalides/futurs', () => {
    expect(rhPeriod("aujourd'hui", 'Africa/Porto-Novo', now)).toEqual({ from: '2026-10-20', to: '2026-10-20' })
    expect(rhPeriod('cette semaine', 'Africa/Porto-Novo', now)).toEqual({ from: '2026-10-19', to: '2026-10-20' })
    expect(rhPeriod('2026-02-30', 'Africa/Porto-Novo', now)).toBeNull()
    expect(rhPeriod('2027-01-01', 'Africa/Porto-Novo', now)).toBeNull()
  })
})
describe('Assistant RH — autorisation et résultats', () => {
  it('ne lit rien sans entreprise', async () => {
    const s = setup(); expect((await s.run('Pointages hier', { admin: {} })).title).toBe('Quelle entreprise ?')
    expect(s.client.auth.getUser).not.toHaveBeenCalled()
  })
  it('exige session et autorisation serveur avant lecture', async () => {
    for (const override of [{ auth: { data: { user: null } } }, { access: { data: false } }, { access: { error: {} } }]) {
      const s = setup(override); const r = await s.run('Pointages hier')
      expect(r.rows).toBeUndefined(); expect(s.client.from).not.toHaveBeenCalled()
    }
  })
  it('utilise le fuseau serveur, une borne haute exclusive et le total exact', async () => {
    const s = setup({ attendance: { count: 45 } }); const r = await s.run("Pointages aujourd'hui")
    expect(s.calls).toContainEqual(['gte', 'check_time', '2026-10-19T23:00:00.000Z'])
    expect(s.calls).toContainEqual(['lt', 'check_time', '2026-10-20T23:00:00.000Z'])
    expect(s.calls).toContainEqual(['eq', 'enterprise_id', 'company'])
    expect(r.text).toContain('45 enregistrements'); expect(r.notes[0]).toContain('ni un nombre d’employés')
  })
  it('ne considère pas une panne ou un fuseau absent comme zéro', async () => {
    for (const override of [{ attendance: { error: { message: 'private' } } }, { attendance: { count: null } }, { company: { data: { timezone: 'invalid' } } }]) {
      const s = setup(override); const r = await s.run('Pointages hier')
      expect(r.title).toBe('Réponse RH indisponible'); expect(JSON.stringify(r)).not.toContain('private')
    }
  })
  it('filtre les estimations non validées/non écartées et signale les virtuelles absentes', async () => {
    const s = setup(); const r = await s.run('Sorties présumées à confirmer hier')
    expect(s.calls).toContainEqual(['is', 'estimation_validee_le', null])
    expect(s.calls).toContainEqual(['is', 'estimation_remplacee_le', null])
    expect(s.calls).toContainEqual(['eq', 'is_auto_closed', true])
    expect(r.notes[0]).toContain('propositions virtuelles')
  })
  it('réutilise les retards SQL et les filtres jours fériés/exclusions', async () => {
    const base = { enterprise_id: 'company', employe_id: 'e', prenom: 'Test', nom: 'Fictif', jour: '2026-10-19', est_retard: true, retard_minutes: 12 }
    const s = setup({ retards: { data: [base, { ...base, jour: '2026-10-20' }, { ...base, motif_exclusion: 'sans_grille' }] }, loadHolidays: async () => [{ date: '2026-10-20', is_worked: false }] })
    const r = await s.run('Qui est en retard cette semaine')
    expect(r.rows).toHaveLength(1); expect(r.rows[0].detail).toContain('12 min')
    expect(r.notes[1]).toContain('1 personne(s) sans grille')
  })
  it('échoue fermé si jours fériés indisponibles ou mauvaise entreprise retournée', async () => {
    const failed = setup({ loadHolidays: async () => { throw Error('private') } })
    expect((await failed.run('Retards hier')).title).toBe('Réponse RH indisponible')
    const cross = setup({ retards: { data: [{ enterprise_id: 'other' }] } })
    expect((await cross.run('Retards hier')).rows).toBeUndefined()
  })
  it('signale les retards tronqués plutôt que garantir un total global', async () => {
    const s = setup({ retards: { data: Array.from({ length: 501 }, (_, i) => ({ enterprise_id: 'company', employe_id: String(i), jour: '2026-10-19', motif_exclusion: 'sans_grille' })) } })
    const r = await s.run('Retards hier'); expect(r.text).toContain('échantillon'); expect(r.notes[0]).toContain('aucun total global garanti')
  })
})
