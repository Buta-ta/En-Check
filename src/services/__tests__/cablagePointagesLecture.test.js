// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DE LECTURE DE LA PAGE POINTAGES
//   · les heures supplémentaires sont lisibles dans TOUTES les vues
//     (Passeports, Groupée, Liste) et plus seulement en vue groupée dépliée ;
//   · le flux 24h est parcourable (chaque heure est cliquable, les données
//     sont relues dynamiquement et pas recopiées en dur) ;
//   · les pauses présumées validées par un humain restent visibles.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const pointagesSrc = lire('src/pages/Pointages.jsx')
const sectionsSrc = lire('src/components/PointagesAfroTechSections.jsx')
const cssSrc = lire('src/pages/PointagesAfroTech.css')
const planningSrc = lire('src/pages/Planning.jsx')
const pausesSrc = lire('src/pages/Pauses.jsx')
const pausesSectionsSrc = lire('src/components/PausesAfroTechSections.jsx')
const hookSrc = lire('src/hooks/useLoadingMinimum.js')

describe('Lecture de la page Pointages — heures sup, flux 24h, pauses', () => {
  it('1. les heures supplémentaires sont affichées en mode Passeport', () => {
    // La grille Passeport reçoit l'option et l'affiche
    expect(sectionsSrc).toMatch(/export function PointagesPassportGrid\(\{[\s\S]*?hasOvertimeFeature = false/)
    expect(sectionsSrc).toContain('hasOvertimeFeature && p.overtimeData?.hasOvertime')
    expect(sectionsSrc).toContain('pointages-passport-overtime')
    // … et la page la lui passe vraiment (prop déclarée ≠ prop reçue)
    expect(pointagesSrc).toContain('hasOvertimeFeature={hasOvertimeFeature}')
    // Détail lisible : total + taux, et majoré quand il existe
    expect(sectionsSrc).toContain('p.overtimeData.rateApplied')
    expect(sectionsSrc).toContain('p.overtimeData.overtimeMajorSeconds')
    expect(cssSrc).toContain('.pointages-passport-overtime')
  })

  it('2. le flux 24h est parcourable : chaque heure est un creneau cliquable', () => {
    // Données relues dynamiquement, avec le détail de chaque badge
    expect(sectionsSrc).toContain('entrees: []')
    expect(sectionsSrc).toContain('sorties: []')
    expect(sectionsSrc).toContain('bucket.entrees.push(ligne)')
    expect(sectionsSrc).toContain('bucket.sorties.push(ligne)')
    // État de l'heure parcourue + créneau interactif
    expect(sectionsSrc).toContain('const [activeHour, setActiveHour] = useState(null)')
    expect(sectionsSrc).toContain('pointages-hourly-slot')
    expect(sectionsSrc).toContain('pointages-hourly-hit')
    expect(sectionsSrc).toContain('const activeBucket = useMemo(')
    // Navigation clavier : flèches + Échap
    expect(sectionsSrc).toContain("event.key === 'ArrowRight'")
    expect(sectionsSrc).toContain("event.key === 'ArrowLeft'")
    expect(sectionsSrc).toContain("event.key === 'Escape'")
    // Panneau de lecture : qui, à quelle heure, par quel canal
    expect(sectionsSrc).toContain('pointages-hourly-detail')
    expect(sectionsSrc).toContain('ligne.methode')
    expect(cssSrc).toContain('.pointages-hourly-detail-head')
  })

  it('3. une pause présumée validée reste visible dans Pointages (jamais comptée comme réelle)', () => {
    expect(pointagesSrc).toContain('pausesVisiblesDansPointages(p.pauses)')
    expect(sectionsSrc).toContain('pausesVisiblesDansPointages(p.pauses)')
    expect(pointagesSrc).toContain('estPresumeeValidee')
    expect(sectionsSrc).toContain('estPresumeeValidee')
    // Le libellé le dit : « dont N présumée(s) validée(s) »
    expect(pointagesSrc).toMatch(/dont \$\{presumedValidees\} présumée/)
    expect(sectionsSrc).toMatch(/dont \{presumedValidees\} présumée/)
    // La pause en direct, elle, ne peut venir que d'une pause réelle
    expect(pointagesSrc).toContain('const activePause = realPauses.find(pa => pa.ouverte)')
  })

  it('4. les heures sup du passeport sont lisibles et jamais imbriquées', () => {
    // Trois niveaux distincts : total, part normale, part majorée
    expect(sectionsSrc).toContain('pointages-passport-overtime-total')
    expect(sectionsSrc).toContain('pointages-passport-overtime-parts')
    expect(sectionsSrc).toContain('pointages-passport-overtime-rate')
    expect(sectionsSrc).toContain('is-major')
    // La ligne du bas sait se réorganiser
    expect(cssSrc).toMatch(/\.pointages-passport-timeline-bottom\s*\{[\s\S]*?flex-wrap:\s*wrap;/)
    // Et sur mobile le bloc HS prend sa propre ligne
    expect(cssSrc).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.pointages-passport-overtime\s*\{[\s\S]*?flex: 1 0 100%;/)
  })

  it("5. les écrans de chargement Planning et Pauses durent comme celui de Pointages", () => {
    // Un crochet partagé impose un plancher
    expect(hookSrc).toContain('export const DUREE_MIN_CHARGEMENT_MS = 4500')
    expect(hookSrc).toContain('setMinLoadingDone(true)')
    expect(hookSrc).toContain('skipLoading')
    // Les deux pages l'utilisent : l'écran reste tant que les données OU le délai ne sont pas prêts
    expect(planningSrc).toContain('useLoadingMinimum')
    expect(planningSrc).toContain('if (loading || !minLoadingDone)')
    expect(pausesSrc).toContain('useLoadingMinimum')
    expect(pausesSrc).toContain('|| !minLoadingDone')
    // « Passer l'animation » lève le plancher sans afficher une page vide
    expect(planningSrc).toMatch(/onSkip=\{\(\) => \{[\s\S]*?skipLoading\(\);[\s\S]*?\}/)
    expect(pausesSrc).toMatch(/onSkip=\{\(\) => \{[\s\S]*?skipLoading\(\)[\s\S]*?\}/)
  })

  it("6. l'activité des pauses est parcourable tranche par tranche", () => {
    expect(pausesSectionsSrc).toContain('const [activeHour, setActiveHour] = useState(null)')
    expect(pausesSectionsSrc).toContain('pausesByHour[hour].push(p)')
    expect(pausesSectionsSrc).toContain('pauses: pausesByHour[h] || []')
    expect(pausesSectionsSrc).toContain('pauses-v2-hour-slot')
    expect(pausesSectionsSrc).toContain('pauses-v2-hour-hit')
    expect(pausesSectionsSrc).toContain('pauses-v2-hour-detail')
    // Navigation clavier + lecture de la nature de chaque pause
    expect(pausesSectionsSrc).toContain("event.key === 'ArrowRight'")
    expect(pausesSectionsSrc).toContain("event.key === 'Escape'")
    expect(pausesSectionsSrc).toContain('p.natureLabel')
    expect(cssSrc).toContain('.pauses-v2-hour-detail-head')
  })

})
