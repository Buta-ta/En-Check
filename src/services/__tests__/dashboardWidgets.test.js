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
