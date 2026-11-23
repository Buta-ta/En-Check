// src/services/__tests__/gardeNuitAttribution.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🌙 LA GARDE DE NUIT — à quelle journée appartient-elle, et combien coûte-t-elle
//
// CE QUE DIT LA RÈGLE (arbitrage n°2, `encheck_reglages_pointage.garde_max_heures`)
//   Une garde ouverte la veille et refermée au matin appartient à la journée où
//   elle a COMMENCÉ, dans la limite de 22 h. Une seule journée la porte : elle
//   n'est jamais coupée en deux à minuit, jamais comptée deux fois.
//
// CE QUE CES TESTS VERROUILLENT
//   1. la garde est attribuée à sa journée d'ouverture, et à elle seule ;
//   2. elle n'est jamais dupliquée entre deux mois ni entre deux années ;
//   3. le taux appliqué est celui de la journée d'ouverture — y compris quand
//      la nuit se termine un dimanche ou un lundi ;
//   4. la semaine qui la compte est celle de la journée d'ouverture ;
//   5. une garde ouverte le 31/12 est vue UNE fois, côté décembre, et la semaine
//      à cheval la compte enfin (constat P1).
//
// ⚠️ POINT DE VIGILANCE, CHIFFRÉ MAIS NON TRANCHÉ
//   Cette convention a un coût, et il dépend du jour d'ouverture. À 1 000 FCFA/h,
//   avec une majoration de 25 % le samedi et de 100 % le dimanche :
//     · garde samedi 22 h → dimanche 6 h : 8 h au samedi = 10 000 FCFA ;
//       la même nuit découpée au calendrier (2 h samedi + 6 h dimanche) = 14 500.
//       Écart : 4 500 FCFA en moins pour l'employé.
//     · garde dimanche 22 h → lundi 6 h : 8 h au dimanche = 16 000 FCFA ;
//       découpée au calendrier (2 h dimanche + 6 h lundi) = 10 000.
//       Écart : 6 000 FCFA en plus.
//   Autrement dit : une même nuit de 8 h vaut 10 000 ou 16 000 selon le jour où
//   elle commence. Ce n'est pas une erreur de calcul, c'est une CONVENTION.
//   La changer change la paie : cela se décide, cela ne se corrige pas en
//   passant. Les tests ci-dessous figent donc les heures et les taux appliqués,
//   pas les montants — pour qu'un changement futur soit un choix, pas un effet.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import FeatureService from '../featureService'
import { tranchesDuJour, __internal } from '../hoursCalculator'
import { agregerParSemaine } from '../plafondHebdomadaire'

const { buildDaySummariesStrict } = __internal

const pointage = (iso, type) => ({
  id: `${iso}-${type}`,
  check_time: iso,
  check_type: type,
  is_auto_closed: false,
  method: 'badge',
})

/** Grille fictive : lundi → vendredi, 8 h par jour (pause d'une heure). */
const GRILLE = {
  use_custom_hours: true,
  custom_start_time: '08:00:00',
  custom_end_time: '17:00:00',
  custom_has_break: true,
  custom_break_start: '12:00:00',
  custom_break_end: '13:00:00',
  custom_work_days: [1, 2, 3, 4, 5],
}

/** Réglages fictifs d'entreprise — aucun n'est une règle légale. */
const SETTINGS = {
  calculation_mode: 'daily',
  daily_threshold: 8,
  daily_threshold_major: 10,
  overtime_major_after_hours: 2,
  weekly_threshold: 40,
  weekly_threshold_major: 48,
  rate_normal: 25,
  rate_major: 50,
  rate_sunday: 100,
  rate_holiday: 100,
  include_weekends: true,
}

const BASCULE = 360 // 06:00 — la journée de travail commence à 06:00

const resumer = (attendances, debutAnnee, finAnnee, debutMois, finMois) =>
  buildDaySummariesStrict({
    attendances,
    enterpriseCfg: {},
    plan: GRILLE,
    plansParJour: null,
    debutAnnee,
    finAnnee,
    debutMois,
    finMois,
    basculeMinutes: BASCULE,
  })

/** Le taux que le moteur applique à cette journée, via le vrai service. */
const tauxDuJour = (secondes, dateStr) => {
  const ot = FeatureService.calculateOvertimeForEmployeeDay({
    totalWorkedSeconds: secondes,
    employeeSchedule: GRILLE,
    enterpriseId: 'ent-fictive',
    dateStr,
    allSchedules: [],
    overtimeSettings: SETTINGS,
    holiday: null,
  })
  const tranches = tranchesDuJour(ot)
  return {
    seuilSource: ot.thresholdSource,
    taux: tranches.map(t => t.taux),
    heures: tranches.map(t => Math.round((t.secondes / 3600) * 100) / 100),
  }
}

describe('Une garde appartient à la journée où elle commence', () => {
  it('samedi 22 h → dimanche 6 h : 8 h le samedi, rien le dimanche', () => {
    const s = resumer(
      [pointage('2026-10-10T22:00:00.000Z', 'in'), pointage('2026-10-11T06:00:00.000Z', 'out')],
      '2026-01-01', '2026-12-31', '2026-10-01', '2026-10-31',
    )

    expect(s['2026-10-10'].totalSeconds).toBe(8 * 3600)
    //  Pas de journée « dimanche » créée pour la queue de la garde : elle ne
    //  doit pas exister, sinon elle serait comptée deux fois.
    expect(s['2026-10-11']).toBeUndefined()

    //  Le taux est celui du samedi (jour non ouvré, weekend inclus).
    const taux = tauxDuJour(s['2026-10-10'].totalSeconds, '2026-10-10')
    expect(taux.seuilSource).toBe('employee_non_work_day')
    expect(taux.taux).toEqual([25])
  })

  it('dimanche 22 h → lundi 6 h : 8 h le dimanche, rien le lundi', () => {
    const s = resumer(
      [pointage('2026-10-11T22:00:00.000Z', 'in'), pointage('2026-10-12T06:00:00.000Z', 'out')],
      '2026-01-01', '2026-12-31', '2026-10-01', '2026-10-31',
    )

    expect(s['2026-10-11'].totalSeconds).toBe(8 * 3600)
    expect(s['2026-10-12']).toBeUndefined()

    //  Le taux est celui du dimanche — la nuit entière, y compris les 6 h qui
    //  sont réellement travaillées le lundi.
    const taux = tauxDuJour(s['2026-10-11'].totalSeconds, '2026-10-11')
    expect(taux.seuilSource).toBe('employee_non_work_day')
    expect(taux.taux).toEqual([100])
  })

  it('la semaine qui la compte est celle du jour d’ouverture', () => {
    const s = resumer(
      [pointage('2026-10-11T22:00:00.000Z', 'in'), pointage('2026-10-12T06:00:00.000Z', 'out')],
      '2026-01-01', '2026-12-31', '2026-10-01', '2026-10-31',
    )
    const secondesParJour = {}
    for (const [k, v] of Object.entries(s)) secondesParJour[k] = v.totalSeconds || 0

    const semaines = agregerParSemaine({
      secondesParJour,
      debut: '2026-10-05',
      fin: '2026-10-18',
    })

    //  La garde du dimanche 11 appartient à la semaine du 05 au 11, pas à celle
    //  qui commence le 12 — même si six de ses heures sont travaillées le 12.
    expect(semaines.find(x => x.debut === '2026-10-05').secondes).toBe(8 * 3600)
    expect(semaines.find(x => x.debut === '2026-10-12').secondes).toBe(0)
  })
})

describe('Une garde qui traverse le 31 décembre n’est comptée qu’une fois', () => {
  const garde = [
    pointage('2025-12-31T22:00:00.000Z', 'in'),
    pointage('2026-01-01T06:00:00.000Z', 'out'),
  ]

  it('côté décembre : 8 h, et la journée d’ouverture est la seule', () => {
    const s = resumer(garde, '2025-01-01', '2025-12-31', '2025-12-01', '2025-12-31')

    expect(s['2025-12-31'].totalSeconds).toBe(8 * 3600)
    expect(s['2026-01-01']).toBeUndefined()
  })

  it('côté janvier : la garde existe (lecture élargie) mais n’entre dans aucun total', () => {
    const s = resumer(garde, '2026-01-01', '2026-12-31', '2026-01-01', '2026-01-31')

    //  La journée du 31/12 est bien résumée — c'est ce qui permet à la semaine
    //  et au contrôle de repos de la voir (P1)…
    expect(s['2025-12-31'].totalSeconds).toBe(8 * 3600)

    //  …mais aucun jour de janvier ne la contient : pas de double comptage.
    const totalJanvier = Object.entries(s)
      .filter(([cle]) => cle >= '2026-01-01')
      .reduce((somme, [, jour]) => somme + (jour.totalSeconds || 0), 0)
    expect(totalJanvier).toBe(0)
  })

  it('la semaine à cheval la compte enfin, une seule fois', () => {
    const s = resumer(garde, '2026-01-01', '2026-12-31', '2026-01-01', '2026-01-31')
    const secondesParJour = {}
    for (const [k, v] of Object.entries(s)) secondesParJour[k] = v.totalSeconds || 0

    const semaines = agregerParSemaine({
      secondesParJour,
      debut: '2025-12-29',
      fin: '2026-01-04',
    })

    expect(semaines).toHaveLength(1)
    expect(semaines[0].secondes).toBe(8 * 3600)
    expect(semaines[0].joursDansLaPeriode).toBe(7)
  })
})
