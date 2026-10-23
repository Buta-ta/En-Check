import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  RetardsContent,
  RetardsHelp,
} from '../../components/RetardsPresentation'
import { construireRetards } from '../retardsService'
import { retardDates } from '../../utils/retardsPresentation'

const input = {
  pointage_id: 'fixture',
  employe_id: 'fixture',
  enterprise_id: 'ent',
  entreprise_nom: 'Entreprise de test',
  prenom: 'Hippo',
  nom: 'BIYOKILA',
  jour: '2026-10-23',
  heure_prevue: '09:00',
  heure_arrivee: '11:03',
  est_retard: true,
  retard_minutes: 123,
  tolerance_minutes: 0,
  grille_source: 'custom',
}
function render(rows = [input], mode = 'jour') {
  const { retards, stats } = construireRetards(rows)
  return renderToStaticMarkup(
    <RetardsContent
      retards={retards}
      stats={stats}
      dates={retardDates('2026-10-23', mode)}
      mode={mode}
      search=""
    />,
  )
}
it('presents the reported single-arrival scenario as an exact time ticket', () => {
  const html = render()
  for (const text of [
    'Hippo',
    'BIYOKILA',
    '09:00',
    '11:03',
    '+2 h 03',
    'Heure prévue',
    'Arrivée réelle',
    'Horaire personnalisé',
    '1 fiche horaire',
  ])
    expect(html).toContain(text)
  expect(html).toContain('Retard constaté')
  expect(html).toContain('Employé concerné')
  expect(html).toContain('rt-time-ticket')
  expect(html).not.toContain('rt-track')
  expect(html).not.toContain('Lignes indicatives')
  expect(html).not.toContain('Page suivante')
})
it('uses a day summary instead of a meaningless single full-height bar', () => {
  const html = render()
  expect(html).toContain('rt-day-seal')
  expect(html).toContain('L’empreinte du jour')
  expect(html).not.toContain('rt-bars')
  expect(html).not.toContain('progressbar')
  expect(html).not.toContain('%')
})
it('does not invent data for an empty day and uses plural counts', () => {
  const html = render([])
  expect(html).toContain('0 min')
  expect(html).toContain('Retards constatés')
  expect(html).toContain('Aucun retard constaté')
  expect(html).not.toContain('Hippo')
})
it('keeps the real weekly distribution and all zero days', () => {
  const html = render([input], 'semaine')
  expect((html.match(/class="rt-bar-column"/g) || []).length).toBe(7)
  expect(html).not.toContain('rt-day-seal')
})
it('keeps explanations closed and the engraving purely decorative', () => {
  const html = renderToStaticMarkup(<RetardsHelp />)
  expect((html.match(/<details>/g) || []).length).toBe(2)
  expect(html).not.toContain('open=""')
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('Le temps, expliqué.')
})
