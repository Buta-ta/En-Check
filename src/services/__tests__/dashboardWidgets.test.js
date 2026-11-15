import { describe, expect, it } from 'vitest'
import {
  addDashboardWidget,
  moveDashboardWidget,
  moveDashboardWidgetByOffset,
  normalizeDashboardWidgetIds,
  removeDashboardWidget,
} from '../../utils/dashboardWidgets'

describe('dashboard widgets layout helpers', () => {
  it('restaure seulement les widgets disponibles et supprime les doublons', () => {
    expect(normalizeDashboardWidgetIds(
      ['present', 'late', 'disabled', 'late'],
      ['present', 'late'],
    )).toEqual(['present', 'late'])
  })

  it('revient aux widgets par défaut si la disposition est vide', () => {
    expect(normalizeDashboardWidgetIds([], ['present', 'review', 'late', 'absence']))
      .toEqual(['present', 'review', 'late'])
  })

  it('ajoute un widget une fois et permet de le retirer', () => {
    const withAbsence = addDashboardWidget(['present', 'late'], 'absence')
    expect(withAbsence).toEqual(['present', 'late', 'absence'])
    expect(addDashboardWidget(withAbsence, 'absence')).toBe(withAbsence)
    expect(removeDashboardWidget(withAbsence, 'absence')).toEqual(['present', 'late'])
  })

  it('réordonne par glisser-déposer en gardant les autres cartes', () => {
    expect(moveDashboardWidget(['present', 'review', 'late'], 'late', 'present'))
      .toEqual(['late', 'present', 'review'])
  })

  it('réordonne au clavier ou au toucher avec les contrôles haut/bas', () => {
    expect(moveDashboardWidgetByOffset(['present', 'review', 'late'], 'late', -1))
      .toEqual(['present', 'late', 'review'])
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DU TABLEAU DE BORD
//   · retirer un widget doit rester retiré (aucun rechargement distant ne
//     doit réappliquer l'ancienne liste) ;
//   · l'option payante « Retards » est respectée entreprise par entreprise.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const dashboardSrc = lire('src/components/DashboardExperience.jsx')
const pageSrc = lire('src/pages/Dashboard.jsx')

describe('câblage du tableau de bord', () => {
  it('retirer un widget ne peut pas être annulé par un rechargement distant', () => {
    // Les tableaux du catalogue sont reconstruits à chaque rendu : l'effet qui
    // recharge les préférences distantes doit donc dépendre de SIGNATURES et
    // ne s'exécuter QU'UNE FOIS par périmètre.
    expect(dashboardSrc).toContain('const widgetCatalogSignature = availableWidgetIds.join(')
    expect(dashboardSrc).toContain('const quickActionSignature = availableQuickActionIds.join(')
    expect(dashboardSrc).toContain("const remotePrefsLoadedRef = useRef('')")
    expect(dashboardSrc).toContain('if (remotePrefsLoadedRef.current === clePerimetre) return undefined')
    // Dépendances : plus aucun tableau reconstruit à chaque rendu
    expect(dashboardSrc).toMatch(/\}, \[\s*admin\?\.id,\s*enterpriseScopeKey,\s*widgetCatalogSignature,\s*quickActionSignature,/s)
  })

  it('les retards ne sont jamais affichés sans l’option payante', () => {
    // Page : lecture de l'option, entreprise par entreprise
    expect(pageSrc).toContain('const retardsOptionActive = Boolean(entrepriseData?.module_retards)')
    expect(pageSrc).toContain('ent.module_retards).map((ent) => ent.id)')
    expect(pageSrc).toContain('setRetardsOptionActive(')
    // Compteur global et badge du flux, tous deux conditionnés
    expect(pageSrc).toContain('retardEntries.filter((a) => retardsAutorises(a.enterprise_id))')
    expect(pageSrc).toContain('retardsAutorises(item.enterprise_id)')
    expect(pageSrc).toContain('retardsOptionActive={retardsOptionActive}')
    // Écran : widget et onglet « Retards » retirés sans l'option
    expect(dashboardSrc).toContain('retardsOptionActive = false,')
    expect(dashboardSrc).toContain("available: retardsOptionActive")
    expect(dashboardSrc).toContain("...(retardsOptionActive ? [{ id: 'late', label: 'Retards' }] : []),")
    // Et l'onglet actif revient sur « Tous » s'il disparaît : le filtre
    // retenu est calculé, jamais un état intermédiaire affiché une frame.
    expect(dashboardSrc).toContain("const filtreActivite = !retardsOptionActive && activityFilter === 'late' ? 'all' : activityFilter")
    expect(dashboardSrc).toContain('filtreActivite === filter.id')
    expect(dashboardSrc).toContain('filtreActivite === \'late\'')
  })
})
