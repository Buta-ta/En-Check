// ═══════════════════════════════════════════════════════════
// 🧭 NAVIGATION — RACCOURCIS DE PAGES ET CHOIX DE LA DATE
//
// D'un côté, sauter sur Pointages / Planning / Fiches de paie…
// de l'autre, cliquer sur « Semaine du 19 au 25 oct. 2026 » pour
// viser une date, un mois ou une année.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import RaccourcisPages from '../../components/RaccourcisPages'
import AbsencesCalendrier from '../../components/AbsencesCalendrier'
import { ecartEnMois, memeJourAutreAnnee } from '../absencesCalendrier'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const rendre = (page) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[page]}>
    <RaccourcisPages />
  </MemoryRouter>
)

it('1. six raccourcis, dont ceux demandés : Pointages, Planning, Absences, Fiches de paie', () => {
  const html = rendre('/absences')
  expect(html).toContain('data-testid="raccourcis-pages"')
  for (const page of ['/pointages', '/planning', '/absences', '/employes', '/rapports']) {
    expect(html).toContain(`data-page="${page}"`)
    expect(html).toContain(`href="${page}"`)
  }
  // les fiches de paie vivent désormais dans la coque : le raccourci
  // ouvre directement le bon onglet
  expect(html).toContain('data-page="/paie?onglet=fiches"')
  expect(html).toContain('href="/paie?onglet=fiches"')
  expect(html).not.toContain('href="/fiches-paie"')
})

it('2. la page affichée est marquée, les autres restent des liens', () => {
  const surAbsences = rendre('/absences')
  const raccourciAbsences = surAbsences.slice(surAbsences.indexOf('data-page="/absences"') - 300)
  expect(surAbsences).toContain('aria-current="page"')
  // un seul raccourci est actif à la fois
  expect((surAbsences.match(/aria-current="page"/g) || [])).toHaveLength(1)
  expect((surAbsences.match(/data-actif="oui"/g) || [])).toHaveLength(1)
  expect(raccourciAbsences).toContain('Absences')

  // depuis Pointages, c'est Pointages qui devient le raccourci courant
  const surPointages = rendre('/pointages')
  const i = surPointages.indexOf('data-page="/pointages"')
  const bloc = surPointages.slice(i, surPointages.indexOf('data-page="/planning"'))
  expect(bloc).toContain('aria-current="page"')
})

it('3. la bande est installée sur la page Absences', () => {
  expect(lire('src/pages/Absences.jsx')).toContain('<RaccourcisPages />')
})

// ═══════════════════════════════════════════════════════════
// 📅 « Semaine du … » : aller à une date, un mois, une année
// ═══════════════════════════════════════════════════════════

const CALENDRIER = renderToStaticMarkup(
  <AbsencesCalendrier
    absences={[]}
    employes={[]}
    annee={2026}
    mois={9}
    jourInitial="2026-10-22"
    mode="semaine"
    darkMode
  />
)

it('4. le titre de la période est un bouton, fermé par défaut', () => {
  expect(CALENDRIER).toContain('data-testid="abs-cal-titre"')
  expect(CALENDRIER).toContain('aria-expanded="false"')
  // le panneau de date n'existe que lorsqu'on l'ouvre
  expect(CALENDRIER).not.toContain('data-testid="choix-periode"')
  // et il annonce la semaine comme la page Planning
  expect(CALENDRIER).toContain('Lun 19 – Dim 25 Oct. 2026')
  // avec un raccourci « Aujourd'hui » toujours visible
  expect(CALENDRIER).toContain('data-testid="abs-cal-aujourdhui"')
})

it('5. viser une date se traduit en écart de mois (le calendrier avance par crans)', () => {
  // octobre 2026 = mois 9
  expect(ecartEnMois(2026, 9, '2026-12-25')).toBe(2)
  expect(ecartEnMois(2026, 9, '2026-10-01')).toBe(0)
  expect(ecartEnMois(2026, 9, '2024-03-01')).toBe(-31)
  // une date invalide ne déplace rien
  expect(ecartEnMois(2026, 9, 'pas-une-date')).toBe(0)
  expect(ecartEnMois(2026, 9, null)).toBe(0)
})

it('6. changer d’année garde le même jour (et gère le 29 février)', () => {
  expect(memeJourAutreAnnee('2026-10-22', -1)).toBe('2025-10-22')
  expect(memeJourAutreAnnee('2026-10-22', 1)).toBe('2027-10-22')
  // 2024 était bissextile, 2025 ne l'est pas : on retombe au 1er mars
  expect(memeJourAutreAnnee('2024-02-29', 1)).toBe('2025-03-01')
  expect(memeJourAutreAnnee('bof', 1)).toBe(null)
})
