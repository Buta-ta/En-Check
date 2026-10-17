import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
import { supabase } from '../../lib/supabase'
import { appliquerProposition, enrichirPropositions, sourceProposition } from '../propositionsPointage'

const entry = { id: 'source', employee_id: 'sara', enterprise_id: 'entreprise', check_type: 'in', check_time: '2026-05-05T08:47:42+01:00' }
const old = { id: 'virtual-out-source', __virtual: true, is_auto_closed: true, check_type: 'out', check_time: '2026-05-05T16:47:42+01:00' }
const card = () => ({ firstIn: entry, lastOut: old, validPairs: [{ in: entry, out: old }], attendances: [entry], totalSecondes: 0, totalSecondesPresumes: 28800 })
const proposal = { source_id: 'source', eligible: true, kind: 'sortie_cohorte', proposed_out: '2026-05-05T15:32:06+01:00' }

describe('Proposition contextuelle reliée à la carte', () => {
  beforeEach(() => vi.clearAllMocks())
  it('remplace +8 h par la proposition Sara sans payer de secondes', () => {
    const original = card()
    const next = appliquerProposition(original, proposal)
    expect(next.lastOut.check_time).toBe(proposal.proposed_out)
    expect(next.lastOut.__contextuelle).toBe(true)
    expect(next.lastOut.estimation_source_id).toBe('source')
    expect(next.totalSecondesPresumes).toBe(24264)
    expect(next.totalSecondes).toBe(0)
    expect(next.validPairs).toHaveLength(1)
    expect(original.lastOut).toBe(old)
  })
  it.each(['depart_probable', 'conflit_planning', 'conflit_historique', 'perimetre_incompatible', 'indisponible'])(
    'supprime le forfait en cas de %s, ne remplace pas par une autre invention', kind => {
      const next = appliquerProposition(card(), { kind, eligible: false })
      expect(next.lastOut).toBeNull()
      expect(next.totalSecondesPresumes).toBe(0)
      expect(next.firstIn).toEqual(entry)
      expect(next.attendances).toEqual([entry])
    })
  it('ne réécrit jamais une estimation consignée ou une décision écartée', () => {
    const persisted = { ...card(), lastOut: { ...old, __virtual: false } }
    expect(appliquerProposition(persisted, proposal)).toBe(persisted)
    const rejected = { ...card(), estimationEcartee: { heure: old.check_time } }
    expect(appliquerProposition(rejected, proposal)).toBe(rejected)
  })
  it('refuse une réponse associée à une autre entrée', () => {
    expect(appliquerProposition(card(), { ...proposal, source_id: 'autre' }).lastOut).toBeNull()
  })
  it('sélectionne la session ouverte plutôt que la première entrée de la journée', () => {
    const later = { ...entry, id: 'later', check_time: '2026-05-05T14:00:00+01:00' }
    const p = { ...card(), lastOut: null, attendances: [entry, later], validPairs: [{ in: entry, out: { ...old, __virtual: false } }] }
    expect(sourceProposition(p)).toBe('later')
  })
  it('conserve les secondes déjà travaillées dans une session antérieure', () => {
    const p = { ...card(), totalSecondes: 3600, validPairs: [{ in: { ...entry, id: 'other' }, out: { ...old, __virtual: false } }, ...card().validPairs] }
    const next = appliquerProposition(p, proposal)
    expect(next.totalSecondes).toBe(3600)
    expect(next.validPairs).toHaveLength(2)
  })
  it('erreur PostgREST : abstention explicite, pas de repli silencieux', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC absente' } })
    const [next] = await enrichirPropositions([card()])
    expect(next.lastOut).toBeNull()
    expect(next.contexteProposition.kind).toBe('indisponible')
    expect(supabase.rpc).toHaveBeenCalledWith('encheck_proposer_pointage', { p_source: 'source' })
  })
  it('applique le résultat serveur sans appeler la RPC de décision', async () => {
    supabase.rpc.mockResolvedValue({ data: proposal, error: null })
    const [next] = await enrichirPropositions([card()])
    expect(next.lastOut.check_time).toBe(proposal.proposed_out)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })
})
