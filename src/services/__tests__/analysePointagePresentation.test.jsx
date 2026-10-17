import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
import AnalysePointage, { ResultatAnalysePointage } from '../../components/AnalysePointage'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'

const result = {
  kind: 'sortie_cohorte', proposed_out: '2026-05-05T15:32:06+01:00', colleagues: 2,
  reason: 'Sorties concordantes de collègues arrivés au même créneau.',
  evidence: [
    { entree_id: '1', sortie_id: '2', entree: '2026-05-05T08:47:25+01:00', sortie: '2026-05-05T15:31:45+01:00' },
    { entree_id: '3', sortie_id: '4', entree: '2026-05-05T08:47:54+01:00', sortie: '2026-05-05T15:32:27+01:00' },
  ],
}
describe('Présentation lisible des indices (sans décision financière)', () => {
  beforeEach(() => setActiveTimezone('Africa/Porto-Novo'))
  afterEach(() => resetActiveTimezone())
  it('distingue 16:47:42 de la proposition 15:32 et précise la cible des boutons', () => {
    const html = renderToStaticMarkup(<ResultatAnalysePointage result={result} currentOut="2026-05-05T16:47:42+01:00" />)
    expect(html).toContain('16:47:42')
    expect(html).toContain('15:32')
    expect(html).toContain('Sortie affichée sur la carte')
    expect(html).toContain('Proposition du groupe')
    expect(html).toContain('pas cette proposition')
    expect(html).not.toContain('<button')
  })
  it('affiche les quatre heures justificatives, sans puces vides', () => {
    const html = renderToStaticMarkup(<ResultatAnalysePointage result={result} />)
    for (const hour of ['08:47:25', '15:31:45', '08:47:54', '15:32:27']) expect(html).toContain(hour)
    expect(html).toContain('<details class="analyse-pointage__evidence" open="">')
    expect(html).not.toContain('<li')
  })
  it('garde la seconde du badge de Reine et son entrée inconnue', () => {
    const html = renderToStaticMarkup(<ResultatAnalysePointage result={{ kind: 'depart_probable', proposed_out: '2026-05-06T20:03:08+01:00' }} />)
    expect(html).toContain('20:03:08')
    expect(html).toContain('Entrée inconnue')
    expect(html).toContain('ne peut pas encore être validée')
    expect(html).not.toContain('environ')
  })
  it('explique une abstention sans fabriquer de proposition', () => {
    const html = renderToStaticMarkup(<ResultatAnalysePointage result={{ kind: 'divergence', reason: 'Sorties divergentes.', evidence: null }} />)
    expect(html).toContain('Pas de proposition fiable')
    expect(html).toContain('Sorties divergentes.')
    expect(html).not.toContain('Proposition du groupe')
  })
  it('ne laisse pas une preuve sans heure apparaître comme une puce vide', () => {
    const html = renderToStaticMarkup(<ResultatAnalysePointage result={{ ...result, evidence: [null, { id: 'absente' }] }} />)
    expect(html).toContain('--:--:--')
    expect(html).toContain('Repère 1')
  })
  it('rend le panneau initial explicitement en observation', () => {
    const html = renderToStaticMarkup(<AnalysePointage sourceId="source" />)
    expect(html).toContain('Observation')
    expect(html).toContain('Aucun horaire ni montant')
    expect(html).toContain('Analyser les indices du groupe')
  })
})
