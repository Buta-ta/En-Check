import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('Câblage Planning v2 — Système Skello Drag & Drop × Identité Afro-Tech', () => {
  const planningSrc = lire('src/pages/Planning.jsx')
  const planningCss = lire('src/pages/PlanningAfroTech.css')

  it('respecte le thème actif via useTheme() et intègre les motifs culturels africains (Kente, Adinkra)', () => {
    expect(planningSrc).toContain('useTheme')
    expect(planningSrc).toContain('data-theme={darkMode ? "dark" : "light"}')
    expect(planningSrc).toContain('KenteWovenTapestrySvg')
    expect(planningSrc).toContain('AdinkraWatermarkSvg')
    expect(planningSrc).toContain('WovenKenteBadgeSvg')
    expect(planningCss).toContain('.sk-plan-page[data-theme="light"]')
  })

  it('expose la barre supérieure Skello avec flèche retour, navigation Semaine/Mois/Jour, Dupliquer la semaine et Publier le planning', () => {
    expect(planningSrc).toContain('En-Check · Planning')
    expect(planningSrc).toContain('sk-back-btn')
    expect(planningSrc).toContain('Dupliquer la semaine')
    expect(planningSrc).toContain('Publier le planning')
    expect(planningSrc).toContain('Semaine')
    expect(planningSrc).toContain('Mois')
    expect(planningSrc).toContain('Jour')
  })

  it('expose le Dock de modèles à glisser-déposer (Drag & Drop) et la matrice interactive avec infobulle Alt', () => {
    expect(planningSrc).toContain('Modèles à glisser-déposer (Drag & Drop)')
    expect(planningSrc).toContain('Matin 08:00-17:00')
    expect(planningSrc).toContain('Garde 14:00-22:00')
    expect(planningSrc).toContain('Nuit 20:00-06:00')
    expect(planningSrc).toContain('Pause 12:00-13:00')
    expect(planningSrc).toContain('Congé / Repos')
    expect(planningSrc).toContain('handleDragStartTemplate')
    expect(planningSrc).toContain('handleDragStartCellShift')
    expect(planningSrc).toContain('handleDropOnCell')
    expect(planningSrc).toContain('Glisser pour déplacer ou')
    expect(planningSrc).toContain('Maintenir Alt pour dupliquer')
  })
})
