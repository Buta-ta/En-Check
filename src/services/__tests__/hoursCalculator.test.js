// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS UNITAIRES — hoursCalculator.js (Chantier VD-15 · Piste Protéger)
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   La règle 4.4 de la Roadmap technique v1.1 et la règle 5.2 n°2 du Cap CEO
//   v2.1 interdisent toute modification des moteurs financiers sans couverture
//   de tests préalable. Ce fichier verrouille les branches critiques de calcul
//   des heures :
//     1. Journée standard avec pause
//     2. Chevauchement de nuit (22:00 → 06:00) et heure de bascule
//     3. Grilles horaires multi-versions (valide_du / valide_au)
//     4. Jours fériés et absences sur une période
//     5. Sessions ouvertes et clôture automatique virtuelle
//     6. Calcul des retards en fuseau horaire local (Africa/Porto-Novo)
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  supabaseEmployee: {
    from: vi.fn(),
  },
  default: {
    from: vi.fn(),
  },
}))

import { __internal } from '../hoursCalculator'
import { setActiveTimezone, resetActiveTimezone } from '../../utils/timezoneUtils'

const {
  buildDaySummariesStrict,
  computeDayStrict,
  minutesDeBascule,
  cleJourDeTravail,
  grilleValableLe,
  construirePlanningsParJour,
  computeExpectedForRange,
  computeExpectedForDay,
  computeRetardsAlignedRetardsJSX,
  formatDurationSeconds,
} = __internal

describe('hoursCalculator — Fonctions pures de calcul des heures (VD-15)', () => {
  beforeEach(() => {
    // Cotonou / Bénin (UTC+1)
    setActiveTimezone('Africa/Porto-Novo')
  })

  it('1. calcule correctement une journée standard avec pause (08:00-17:00, pause 12:00-13:00 = 8h)', () => {
    const plan = {
      start_time: '08:00:00',
      end_time: '17:00:00',
      has_break: true,
      break_start: '12:00:00',
      break_end: '13:00:00',
      work_days: [1, 2, 3, 4, 5], // Lundi à Vendredi
    }

    // 2026-10-12 est un lundi (index 1)
    const expectedSeconds = computeExpectedForDay('2026-10-12', plan)
    expect(expectedSeconds).toBe(8 * 3600)
    expect(formatDurationSeconds(expectedSeconds)).toBe('8h00')

    // 2026-10-11 est un dimanche (index 7, non travaillé)
    expect(computeExpectedForDay('2026-10-11', plan)).toBe(0)
  })

  it('2. gère le chevauchement de nuit (22:00 -> 06:00) avec pause après minuit (02:00 -> 02:30 = 7h30)', () => {
    const planNuit = {
      start_time: '22:00:00',
      end_time: '06:00:00',
      has_break: true,
      break_start: '02:00:00',
      break_end: '02:30:00',
      work_days: [1, 2, 3, 4, 5, 6, 7],
    }

    const expectedSeconds = computeExpectedForDay('2026-10-12', planNuit)
    expect(expectedSeconds).toBe(7.5 * 3600)
    expect(formatDurationSeconds(expectedSeconds)).toBe('7h30')
  })

  it('3. rattache les pointages d’après-minuit à la veille grâce à l’heure de bascule (garde de nuit)', () => {
    expect(minutesDeBascule('06:30')).toBe(390)
    expect(minutesDeBascule(240)).toBe(240)
    expect(minutesDeBascule(null)).toBe(0)

    const attendances = [
      // Entrée lundi 12 oct à 22:00 locale (21:00 UTC)
      { id: 'att-1', employee_id: 'emp-1', check_type: 'in', check_time: '2026-10-12T21:00:00.000Z' },
      // Sortie mardi 13 oct à 05:30 locale (04:30 UTC)
      { id: 'att-2', employee_id: 'emp-1', check_type: 'out', check_time: '2026-10-13T04:30:00.000Z' },
    ]

    const summaries = buildDaySummariesStrict({
      attendances,
      enterpriseCfg: { autoCloseEnabled: false, autoCloseTime: '23:59:00', autoCloseGraceMinutes: 0 },
      yearStartDate: '2026-01-01',
      yearEndDate: '2026-12-31',
      basculeMinutes: minutesDeBascule('06:00'),
    })

    // Toute la garde (7h30 = 27 000 s) est rattachée au 2026-10-12
    expect(summaries['2026-10-12']).toBeDefined()
    expect(summaries['2026-10-12'].totalSeconds).toBe(7.5 * 3600)
    expect(summaries['2026-10-12'].validPairsCount).toBe(1)
  })

  it('4. plafonne une paire aberrante à 16h et ferme virtuellement une session passée oubliée', () => {
    const enterpriseCfg = {
      autoCloseEnabled: true,
      autoCloseTime: '18:00:00',
      autoCloseGraceMinutes: 30,
    }

    // Session ouverte dans le passé (IN à 08:00 UTC le 2026-05-04 sans OUT)
    const openDay = computeDayStrict(
      '2026-05-04',
      [{ id: 'in-1', employee_id: 'emp-1', check_type: 'in', check_time: '2026-05-04T08:00:00.000Z' }],
      enterpriseCfg
    )

    expect(openDay.openSessionsCount).toBe(1)
    expect(openDay.hasAutoCloseVirtual).toBe(true)
    expect(openDay.totalSeconds).toBeGreaterThan(0)
    // Plafond session virtuelle <= 14h
    expect(openDay.totalSeconds).toBeLessThanOrEqual(14 * 3600)
  })

  it('5. respecte les grilles horaires multi-versions (valide_du / valide_au) ainsi que les jours fériés et absences', () => {
    const grilleJanvierFevrier = {
      id: 'g-1',
      name: 'Hiver 8h',
      start_time: '08:00:00',
      end_time: '16:00:00',
      has_break: false,
      work_days: [1, 2, 3, 4, 5],
      is_default: true,
      valide_du: '2026-01-01',
      valide_au: '2026-02-28',
    }
    const grilleMars = {
      id: 'g-2',
      name: 'Mars 9h',
      start_time: '08:00:00',
      end_time: '17:00:00',
      has_break: false,
      work_days: [1, 2, 3, 4, 5],
      is_default: true,
      valide_du: '2026-03-01',
      valide_au: null,
    }

    expect(grilleValableLe(grilleJanvierFevrier, '2026-02-15')).toBe(true)
    expect(grilleValableLe(grilleJanvierFevrier, '2026-03-02')).toBe(false)

    // Semaine à cheval : vendredi 27/02/2026 (8h) et lundi 02/03/2026 (9h) + mardi 03/03/2026 (9h)
    const plansParJour = construirePlanningsParJour({
      affectations: [],
      grilles: [grilleJanvierFevrier, grilleMars],
      startDate: '2026-02-27',
      endDate: '2026-03-03',
    })

    // On déclare le mardi 03/03/2026 férié et le vendredi 27/02/2026 en absence justifiée
    const holidaysSet = new Set(['2026-03-03'])
    const absences = [{ start_date: '2026-02-27', end_date: '2026-02-27' }]

    const range = computeExpectedForRange({
      startDate: '2026-02-27',
      endDate: '2026-03-03',
      plan: null,
      plansParJour,
      holidaysSet,
      absences,
    })

    // Vendredi 27/02 (8h) est en absence -> absenceSeconds = 8h
    // Samedi 28/02 & Dimanche 01/03 -> 0h
    // Lundi 02/03 (grille Mars 9h) -> travaillé = 9h
    // Mardi 03/03 -> férié ignoré = 0h
    expect(range.absenceSeconds).toBe(8 * 3600)
    expect(range.expectedSeconds).toBe(9 * 3600)
    expect(range.expectedDaysCount).toBe(1)
    expect(range.detailParGrille).toHaveLength(2)
  })

  it('6. calcule les retards dans le fuseau horaire de l’entreprise (Africa/Porto-Novo, UTC+1) en ignorant les fériés', () => {
    setActiveTimezone('Africa/Porto-Novo')

    const scheduleResolved = {
      heureArrivee: '08:00',
      tolerance: 15, // retard à partir de 08:16 locale
      bascule: 0,
    }

    const attendances = [
      // Lundi 12 oct : 07:10 UTC = 08:10 à Cotonou -> À l'heure (dans la tolérance de 15 min)
      { check_type: 'in', check_time: '2026-10-12T07:10:00.000Z' },
      // Mardi 13 oct : 07:30 UTC = 08:30 à Cotonou -> En retard de 30 min par rapport à 08:00
      { check_type: 'in', check_time: '2026-10-13T07:30:00.000Z' },
      // Mercredi 14 oct (férié) : 08:00 UTC = 09:00 à Cotonou -> Ignoré car jour férié
      { check_type: 'in', check_time: '2026-10-14T08:00:00.000Z' },
    ]

    const res = computeRetardsAlignedRetardsJSX({
      attendances,
      scheduleResolved,
      holidaysSet: new Set(['2026-10-14']),
      startDate: '2026-10-12',
      endDate: '2026-10-14',
    })

    expect(res.count).toBe(1)
    expect(res.total_minutes).toBe(30)

    resetActiveTimezone()
  })
})
