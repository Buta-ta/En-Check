import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const absencesSrc = lire('src/pages/Absences.jsx')
const charteCss = lire('src/pages/AbsencesAfroTech.css')
const dockSrc = lire('src/components/AbsencesDock.jsx')
const calendrierSrc = lire('src/components/AbsencesCalendrier.jsx')

describe('Charte En-Check de la page Absences', () => {
  it('1. plus aucune couleur de l’ancienne charte bleu-gris', () => {
    expect(absencesSrc).not.toContain('#0A0A0F') // fond bleu-nuit
    expect(absencesSrc).not.toContain('#141423') // panneaux bleutés
    expect(absencesSrc).not.toContain('#E5E5E5') // texte gris
    expect(absencesSrc).not.toMatch(/rgba\(20,20,35/) // panneaux translucides
    expect(absencesSrc).not.toContain("'#888'") // texte secondaire gris
    expect(absencesSrc).not.toContain('rgba(15,15,25') // en-tête bleuté
  })

  it('2. la feuille de charte définit les teintes En-Check', () => {
    expect(charteCss).toContain('--abs-bg: #15110E') // obsidienne
    expect(charteCss).toContain('--abs-bg-elevated: #1D1713') // espresso
    expect(charteCss).toContain('--abs-text: #F5F2EB') // ivoire
    expect(charteCss).toContain('--abs-copper: #C25E28')
    expect(charteCss).toContain('--abs-amber: #F59E0B')
    expect(charteCss).toContain('--abs-emerald: #10B981')
    expect(charteCss).toContain('--abs-coral: #EF4444')
    // et aucune de ces teintes n'est bleue ou violette
    expect(charteCss).not.toMatch(/--abs-[a-z-]+:\s*#[0-9A-Fa-f]*(3B82F6|8B5CF6)/i)
  })

  it('3. la page applique la charte et porte sa propre barre supérieure', () => {
    expect(absencesSrc).toContain("className=\"abs-page\"")
    expect(absencesSrc).toContain("import './AbsencesAfroTech.css'")
    // l'ancien en-tête générique (partagé par 12 pages) n'est plus utilisé ici
    expect(absencesSrc).not.toContain('PageHeader')
    expect(absencesSrc).toContain('className="abs-topbar"')
    expect(absencesSrc).toContain('className="abs-back-btn"')
    expect(absencesSrc).toContain('En-Check · ABSENCES &amp; CONGÉS')
  })

  it('4. une variante claire existe, même charpente — et reste lisible', () => {
    expect(charteCss).toContain('.abs-page[data-theme=\'light\']')
    expect(charteCss).toContain('--abs-bg: #FAF6F0') // pt-canvas
    const clair = charteCss.slice(charteCss.indexOf(".abs-page[data-theme='light']"))
    // les accents foncent : un ambre clair devient illisible sur ivoire (1,9:1)
    expect(clair).toContain('--abs-amber: #9C5321') // pt-copper-strong
    expect(clair).toContain('--abs-text: #231911') // pt-ink
    expect(clair).toContain('--abs-text-soft: #4E3D2E') // pt-ink-soft
    // les aplats deviennent solides : un rgba à 3 % ne se voit pas sur crème
    expect(clair).toContain('--abs-bg-soft: #F4EDE2')
    expect(clair).not.toMatch(/--abs-bg-soft:\s*rgba/)
  })
})

describe('Dock de motifs — glisser-déposer', () => {
  it('5. chaque motif du dock est saisissable à la souris', () => {
    expect(dockSrc).toContain('draggable')
    expect(dockSrc).toContain('data-motif={m.id}')
    expect(dockSrc).toContain('DATA_TRANSFER_MOTIF')
    expect(dockSrc).toContain('onDragStart')
    expect(dockSrc).toContain('onDragEnd')
    // le motif transite aussi en text/plain : repli pour tous les navigateurs
    expect(dockSrc).toContain("setData('text/plain', m.id)")
  })

  it('6. le dock reste utilisable au clavier et ne touche pas à la base', () => {
    expect(dockSrc).toContain('tabIndex={0}')
    expect(dockSrc).toContain("e.key === 'Enter'")
    expect(dockSrc).not.toMatch(/supabase/)
    expect(dockSrc).not.toMatch(/\.insert\s*\(/)
  })

  it('7. la grille accepte le dépôt et calcule le jour sous le pointeur', () => {
    expect(calendrierSrc).toContain('onDragOver')
    expect(calendrierSrc).toContain('onDrop')
    expect(calendrierSrc).toContain('jourDepuisX(e.clientX, rect, nbJours)')
    expect(calendrierSrc).toContain('data-drop-lane={ligne.employe.id}')
    // la cellule visée est matérialisée
    expect(calendrierSrc).toContain('className="abs-drop-cell"')
    expect(charteCss).toContain('.abs-drop-cell')
  })

  it('8. le dépôt ne crée jamais l’absence en douce : il ouvre le formulaire', () => {
    expect(calendrierSrc).toContain('onDeposerMotif({ employeeId: ligne.employe.id, dateIso: jours[index].iso, motifId })')
    expect(calendrierSrc).not.toMatch(/supabase/)
    expect(absencesSrc).toContain('onDeposerMotif={')
    expect(absencesSrc).toContain('const handleAdd = (prefill = null) => {')
    expect(absencesSrc).toContain('prefill?.employee_id')
    expect(absencesSrc).toContain('prefill?.reason')
  })
})
