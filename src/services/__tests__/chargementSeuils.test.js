import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
import { supabase } from '../../lib/supabase'
import { chargerSeuilsPointage, invaliderCacheSeuils } from '../seuilsPointage'

const enterprise = '586d6be9-2ed9-4a4e-a9e3-d7e465a1a5df'
function mockQuery(response) {
  const query = { or: vi.fn().mockResolvedValue(response), is: vi.fn().mockResolvedValue(response) }
  supabase.from.mockReturnValue({ select: vi.fn().mockReturnValue(query) })
  return query
}

describe('Chargement explicite des réglages', () => {
  beforeEach(() => { invaliderCacheSeuils(); vi.clearAllMocks() })
  it('sépare entreprise et IS NULL au lieu de IN(uuid,null)', async () => {
    const q = mockQuery({ data: [], error: null })
    const result = await chargerSeuilsPointage(enterprise)
    expect(q.or).toHaveBeenCalledWith(`enterprise_id.eq.${enterprise},enterprise_id.is.null`)
    expect(q.is).not.toHaveBeenCalled()
    expect(result.chargement).toBe('base')
  })
  it('sélectionne uniquement IS NULL sans entreprise', async () => {
    const q = mockQuery({ data: [], error: null })
    await chargerSeuilsPointage(null)
    expect(q.is).toHaveBeenCalledWith('enterprise_id', null)
    expect(q.or).not.toHaveBeenCalled()
  })
  it('expose une erreur PostgREST et ne met pas son secours en cache', async () => {
    mockQuery({ data: null, error: { message: '400' } })
    expect((await chargerSeuilsPointage(enterprise)).chargement).toBe('secours')
    mockQuery({ data: [{ cle: 'oubli_sortie_heures', valeur: 9, enterprise_id: enterprise }], error: null })
    const result = await chargerSeuilsPointage(enterprise)
    expect(result.chargement).toBe('base')
    expect(result.oubliSortieHeures).toBe(9)
    expect(supabase.from).toHaveBeenCalledTimes(2)
  })
  it('conserve la priorité entreprise indépendamment de l’ordre des lignes', async () => {
    mockQuery({ data: [
      { cle: 'oubli_sortie_heures', valeur: 9, enterprise_id: enterprise },
      { cle: 'oubli_sortie_heures', valeur: 10, enterprise_id: null },
    ], error: null })
    expect((await chargerSeuilsPointage(enterprise)).oubliSortieHeures).toBe(9)
  })
})
