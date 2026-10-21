import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const svgSrc = lire('src/components/AfroCulturalSvg.jsx')
const absencesSrc = lire('src/pages/Absences.jsx')
const planningSrc = lire('src/pages/Planning.jsx')
const planningCss = lire('src/pages/PlanningAfroTech.css')

// Bloc source du seul composant concerné, pour ne pas tester les autres frises
const debut = svgSrc.indexOf('export function KenteAmberWeaveSvg')
const fin = svgSrc.indexOf('export function WovenKenteBadgeSvg')
const bandeAmbre = svgSrc.slice(debut, fin)

const blocCss = absencesSrc.slice(
  absencesSrc.indexOf('.abs-kente-top-strip {'),
  absencesSrc.indexOf('.abs-kente-top-strip {') + 320
)

describe('Bandeau haut de la page Absences — frise Kente ambre (orange · jaune · noir)', () => {
  it('1. la frise ambre existe et est exportée', () => {
    expect(debut).toBeGreaterThan(-1)
    expect(svgSrc).toContain('export function KenteAmberWeaveSvg')
    expect(bandeAmbre).toContain('id="encheck-kente-amber"')
  })

  it('2. la page Absences porte la frise ambre, tout en haut, juste avant l’en-tête', () => {
    expect(absencesSrc).toContain("from '../components/AfroCulturalSvg'")
    expect(absencesSrc).toContain('KenteAmberWeaveSvg')

    const entete = absencesSrc.slice(
      absencesSrc.indexOf('<div style={S.container}>'),
      absencesSrc.indexOf('<PageHeader title="ABSENCES & CONGÉS" />')
    )
    expect(entete).toContain('abs-kente-top-strip')
    expect(entete).toContain('KenteAmberWeaveSvg')
    expect(entete).toContain('aria-hidden="true"')
  })

  it('3. la frise est strictement orange · jaune · noir : ni émeraude, ni indigo, ni bleu', () => {
    expect(bandeAmbre).not.toMatch(/#1E5E3E|#1F6A45|#288256|#10B981|#26734D|#24384A/i)
  })

  it('4. elle couvre toute la largeur de la page et reste lisible (14 px)', () => {
    expect(blocCss).toMatch(/width:\s*100%/)

    const hauteurs = [...blocCss.matchAll(/height:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(hauteurs.length).toBeGreaterThan(0)
    hauteurs.forEach((h) => expect(h).toBeGreaterThanOrEqual(12))
  })

  it('5. elle conserve la trame Kente à 6 blocs : rayures, damier, losange, chevrons, tissage, sabliers', () => {
    // Rayures horizontales or sur cuivre
    expect(bandeAmbre).toContain('width="38" height="28"')
    // Damier : une grille de petits carrés
    expect(bandeAmbre).toContain('width="9" height="7"')
    // Losange royal
    expect(bandeAmbre).toMatch(/polygon points="94,2 112,14 94,26 76,14"/)
    // Chevrons tissés
    expect(bandeAmbre).toMatch(/M120 3 L130 14 L120 25/)
    // Sabliers Adinkra
    expect(bandeAmbre).toMatch(/polygon\s+points="206,3 234,3 220,14 234,25 206,25 220,14"/)
  })

  it('6. la page Planning n’est pas modifiée : elle garde sa frise d’origine à 10 px', () => {
    expect(planningSrc).toContain('KenteWovenTapestrySvg')
    expect(planningSrc).not.toContain('KenteAmberWeaveSvg')

    const strip = planningCss.slice(
      planningCss.indexOf('.sk-kente-top-strip {'),
      planningCss.indexOf('.sk-kente-top-strip {') + 200
    )
    expect(strip).toContain('height: 10px')
  })
})
