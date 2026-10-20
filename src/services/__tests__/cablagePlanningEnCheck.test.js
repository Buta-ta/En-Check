import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const planningSrc = lire('src/pages/Planning.jsx')
const planningCss = lire('src/pages/PlanningAfroTech.css')
const pointagesSections = lire('src/components/PointagesAfroTechSections.jsx')
const pausesSections = lire('src/components/PausesAfroTechSections.jsx')

describe('Câblage Planning v2 — Système Drag & Drop × Identité Afro-Tech En-Check', () => {
  it('1. ne fait plus aucune référence à un produit tiers dans l’interface Planning', () => {
    expect(planningSrc).not.toMatch(/Skello|SKELLO|skello/i)
    expect(planningSrc).toContain('En-Check · Planning')
  })

  it('2. rend TOUTES les équipes pliables, y compris GARDE & LOGISTIQUE, et permet de les créer / nommer', () => {
    // Une seule boucle de rendu des groupes : chaque groupe possède sa barre pliable
    expect(planningSrc).toContain('className="sk-group-row"')
    expect(planningSrc).not.toContain('groupIdx > 0')
    expect(planningSrc).toContain('Collaborateurs &amp; Équipes')
    // Création / renommage / suppression d'équipes + affectation des membres
    expect(planningSrc).toContain('Gérer les équipes')
    expect(planningSrc).toContain('openNewTeamModal')
    expect(planningSrc).toContain('openEditTeamModal')
    expect(planningSrc).toContain('handleDeleteTeam')
    expect(planningSrc).toContain('sk-team-member-row')
    expect(planningCss).toContain('.sk-group-row-btn')
  })

  it('3. permet de créer ses propres modèles (horaire, pause, congé, repos) et de les déposer dans le calendrier', () => {
    expect(planningSrc).toContain('MODEL_KINDS')
    expect(planningSrc).toMatch(/id:\s*["']shift["']/)
    expect(planningSrc).toMatch(/id:\s*["']break_only["']/)
    expect(planningSrc).toMatch(/id:\s*["']rest["']/)
    expect(planningSrc).toMatch(/id:\s*["']leave["']/)
    expect(planningSrc).toContain('openNewModelModal')
    expect(planningSrc).toContain('handleSaveCustomModel')
    expect(planningSrc).toContain('handleDeleteCustomModel')
    // Dépôt puis affichage du modèle dans la case du calendrier mensuel
    expect(planningSrc).toContain('handleDropOnCalendarDay')
    expect(planningSrc).toContain('removeMonthModel')
    expect(planningSrc).toContain('sk-cal-pill')
    expect(planningSrc).toContain('monthModels[cell.date]')
  })

  it('4. respecte l’option payante Planning : aucun horaire 08:00-17:00 inventé par défaut', () => {
    expect(planningSrc).toContain('module_planning')
    expect(planningSrc).toContain('isPlanningModuleEnabled')
    expect(planningSrc).toContain('employeesWithoutPlanningOption')
    expect(planningSrc).toContain('sk-no-option-banner')
    // Le fallback "Lun-Ven 08:00-17:00" a été supprimé
    expect(planningSrc).not.toContain('source: "fallback"')
  })

  it('5. permet de marquer la disponibilité d’un employé (aujourd’hui / cette semaine)', () => {
    expect(planningSrc).toContain('setEmployeeAvailability')
    expect(planningSrc).toContain('sk-avail-pill')
    expect(planningSrc).toMatch(/["']today["']/)
    expect(planningSrc).toMatch(/["']week["']/)
    expect(planningCss).toContain('.sk-avail-pill.is-on')
    expect(planningCss).toContain('.sk-avail-pill.is-off')
  })

  it('6. permet de personnaliser la couleur des modèles et des cases', () => {
    expect(planningSrc).toContain('ENCHECK_COLOR_PALETTE')
    expect(planningSrc).toContain('buildShiftGradient')
    expect(planningSrc).toContain('--shift-custom-bg')
    expect(planningSrc).toContain('--brick-color')
    expect(planningSrc).toContain('sk-color-swatch')
    expect(planningSrc).toContain('Couleur de la case')
    expect(planningCss).toContain('.sk-color-input')
  })

  it('7. expose un bouton Mode clair / Mode sombre dans la page Planning', () => {
    expect(planningSrc).toContain('toggleTheme')
    expect(planningSrc).toContain('sk-theme-btn')
    expect(planningSrc).toContain('Passer en mode clair')
    expect(planningSrc).toContain('Passer en mode sombre')
  })

  it('8. affiche les 7 jours complets (Lun -> Dim) dans la barre récapitulative du bas', () => {
    expect(planningSrc).not.toContain('dailyTotals.slice(0, 4)')
    expect(planningSrc).toContain('{dailyTotals.map((dt) => (')
  })

  it('9. aligne la barre d’alerte Pause de Pointages sur celle de la page Pauses', () => {
    expect(pointagesSections).toContain('pauses-v2-live-banner-left')
    expect(pointagesSections).toContain('pauses-v2-live-pulse-dot')
    expect(pointagesSections).toContain('pauses-v2-live-chip')
    expect(pointagesSections).toContain('pauses-v2-live-timer-mono')
    expect(pointagesSections).toContain('pauses-v2-Ghost-btn')
    // Structure identique à la bannière de référence de la page Pauses
    expect(pausesSections).toContain('pauses-v2-live-banner-left')
    expect(pausesSections).toContain('pauses-v2-live-chip')
    expect(pointagesSections).not.toContain('pauses-v2-live-banner-header')
    expect(pointagesSections).not.toContain('pauses-v2-live-cards')
  })

  it('conserve l’identité Afro-Tech et le thème actif (useTheme + motifs culturels)', () => {
    expect(planningSrc).toContain('useTheme')
    expect(planningSrc).toContain('data-theme={darkMode ? "dark" : "light"}')
    expect(planningSrc).toContain('KenteWovenTapestrySvg')
    expect(planningSrc).toContain('AdinkraWatermarkSvg')
    expect(planningCss).toContain('.sk-plan-page[data-theme="light"]')
  })

  it('conserve le Dock de modèles glissables et le Drag & Drop (Alt pour dupliquer)', () => {
    expect(planningSrc).toContain('Modèles à glisser-déposer')
    expect(planningSrc).toContain('handleDragStartTemplate')
    expect(planningSrc).toContain('handleDragStartCellShift')
    expect(planningSrc).toContain('handleDropOnCell')
    expect(planningSrc).toContain('Glisser pour déplacer ou')
    expect(planningSrc).toContain('Maintenir Alt pour dupliquer')
    expect(planningSrc).toContain('Dupliquer la semaine')
    expect(planningSrc).toContain('Publier le planning')
  })
})
