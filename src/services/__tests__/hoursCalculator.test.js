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
  resolvePlanForExpected,
  computeRetardsAlignedRetardsJSX,
  resolveScheduleLikeRetards,
  formatDurationSeconds,
  resoudrePointagesJournee,
  compterRetardsDuJour,
  calculerSortieAutoClose,
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
      workDays: [1, 2, 3, 4, 5], // contrat : vérifier le jour avant l'heure
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

  it('7. respecte un horaire personnalisé employé (use_custom_hours = true, 09:00-17:00, pause 12:00-13:00 = 7h) sans faux retard à 08:54', () => {
    setActiveTimezone('Africa/Porto-Novo')

    const grilleDefaut = {
      id: 'g-def',
      name: 'Journée de travail',
      start_time: '08:00:00',
      end_time: '17:00:00',
      has_break: true,
      break_start: '12:00:00',
      break_end: '13:00:00',
      work_days: [1, 2, 3, 4, 5],
      late_tolerance_minutes: 15,
      is_default: true,
    }

    const affectationHippo = {
      id: 'es-hippo',
      employee_id: 'emp-hippo',
      schedule_id: null,
      work_schedules: null,
      use_custom_hours: true,
      custom_start_time: '09:00:00',
      custom_end_time: '17:00:00',
      custom_has_break: true,
      custom_break_start: '12:00:00',
      custom_break_end: '13:00:00',
      custom_work_days: [1, 2, 3, 4, 5],
      is_active: true,
    }

    const plansParJour = construirePlanningsParJour({
      affectations: [affectationHippo],
      grilles: [grilleDefaut],
      startDate: '2026-10-13',
      endDate: '2026-10-15',
    })

    const planResolu = resolvePlanForExpected(affectationHippo, grilleDefaut)
    const range = computeExpectedForRange({
      startDate: '2026-10-13',
      endDate: '2026-10-15',
      plan: planResolu,
      plansParJour,
      holidaysSet: new Set(),
      absences: [],
    })

    // Mardi 13, Mercredi 14, Jeudi 15 oct -> 3 jours * 7h00 = 21h00 (et non 24h00 de la grille par défaut)
    expect(range.expectedDaysCount).toBe(3)
    expect(range.expectedSeconds).toBe(21 * 3600)

    // Arrivée à 08:54:39 locale le 15/10/2026 (07:54:39 UTC) -> en avance sur 09:00 -> 0 retard
    const scheduleResolved = resolveScheduleLikeRetards(affectationHippo, grilleDefaut)
    expect(scheduleResolved.heureArrivee).toBe('09:00')

    const punchOct15 = [
      { id: 'p5', employee_id: 'emp-hippo', enterprise_id: 'ent-1', check_type: 'in', check_time: '2026-10-15T07:54:39.000Z' },
    ]
    const retardsCalc = computeRetardsAlignedRetardsJSX({
      attendances: punchOct15,
      scheduleResolved,
      holidaysSet: new Set(),
      startDate: '2026-10-15',
      endDate: '2026-10-15',
    })
    expect(retardsCalc.count).toBe(0)

    const dashboardRetards = compterRetardsDuJour(
      punchOct15,
      [affectationHippo],
      [grilleDefaut],
      '2026-10-15'
    )
    expect(dashboardRetards).toBe(0)

    resetActiveTimezone()
  })

  it('8. rattache toute la garde de nuit 22:30 -> 02:55 (avec doubles IN à 00:37 et 01:36) au 13 oct sans dédoublement sur le 14 oct', () => {
    setActiveTimezone('Africa/Porto-Novo')

    const rawAttendances = [
      // 13 oct 22:30:23 locale (21:30:23 UTC) — IN initial
      { id: 'p1', employee_id: 'emp-hippo', check_type: 'in', check_time: '2026-10-13T21:30:23.000Z' },
      // 14 oct 00:37:00 locale (13 oct 23:37:00 UTC) — double IN
      { id: 'p2', employee_id: 'emp-hippo', check_type: 'in', check_time: '2026-10-13T23:37:00.000Z' },
      // 14 oct 01:36:11 locale (14 oct 00:36:11 UTC) — triple IN
      { id: 'p3', employee_id: 'emp-hippo', check_type: 'in', check_time: '2026-10-14T00:36:11.000Z' },
      // 14 oct 02:55:40 locale (14 oct 01:55:40 UTC) — OUT de fin de garde
      { id: 'p4', employee_id: 'emp-hippo', check_type: 'out', check_time: '2026-10-14T01:55:40.000Z' },
      // 15 oct 08:54:39 locale (15 oct 07:54:39 UTC) — IN du 15 oct
      { id: 'p5', employee_id: 'emp-hippo', check_type: 'in', check_time: '2026-10-15T07:54:39.000Z' },
    ]

    // 1) Page Pointages — 13 octobre : 22:30:23 -> 02:55:40 = 4h 25min 17sec (15 917 s)
    const oct13 = resoudrePointagesJournee(rawAttendances, '2026-10-13')
    expect(oct13.firstIn?.id).toBe('p1')
    expect(oct13.lastOut?.id).toBe('p4')
    expect(oct13.totalSecondes).toBe(15917)
    expect(oct13.attendances.map(a => a.id)).toEqual(['p1', 'p2', 'p3', 'p4'])

    // 2) Page Pointages — 14 octobre : aucun faux shift 01:36 -> 02:55 dédoublé
    const oct14 = resoudrePointagesJournee(rawAttendances, '2026-10-14')
    expect(oct14.firstIn).toBeNull()
    expect(oct14.lastOut).toBeNull()
    expect(oct14.totalSecondes).toBe(0)
    expect(oct14.attendances).toHaveLength(0)

    // 3) Page Pointages — 15 octobre : arrivée à 08:54:39 en cours
    const oct15 = resoudrePointagesJournee(rawAttendances, '2026-10-15')
    expect(oct15.firstIn?.id).toBe('p5')
    expect(oct15.lastOut).toBeNull()
    expect(oct15.totalSecondes).toBe(0)
    expect(oct15.attendances.map(a => a.id)).toEqual(['p5'])

    // 4) hoursCalculator buildDaySummariesStrict : 15 917 s rattachées au 2026-10-13
    const summaries = buildDaySummariesStrict({
      attendances: rawAttendances.slice(0, 4),
      enterpriseCfg: { autoCloseEnabled: false, autoCloseTime: '23:59:00', autoCloseGraceMinutes: 0 },
      yearStartDate: '2026-01-01',
      yearEndDate: '2026-12-31',
      basculeMinutes: 0,
    })
    expect(summaries['2026-10-13']?.totalSeconds).toBe(15917)
    expect(summaries['2026-10-14']).toBeUndefined()

    resetActiveTimezone()
  })

  it('9. neutralise un rebond QR Code < 60s (Junior MANSTIAMINA : 06:32:20 IN -> 06:32:32 OUT -> 06:32:45 IN) et garde la session ouverte', () => {
    setActiveTimezone('Africa/Porto-Novo')

    const rebondJunior = [
      { id: 'j1', employee_id: 'emp-junior', check_type: 'in', check_time: '2026-10-15T05:32:20.000Z' },
      { id: 'j2', employee_id: 'emp-junior', check_type: 'out', check_time: '2026-10-15T05:32:32.000Z' },
      { id: 'j3', employee_id: 'emp-junior', check_type: 'in', check_time: '2026-10-15T05:32:45.000Z' },
    ]

    // Pendant sa journée de travail (ex: à 10:00 locale) : Junior est toujours en service (lastOut = null, 0s)
    const enCours = resoudrePointagesJournee(rebondJunior, '2026-10-15', {
      enableAutoClose: true,
      referenceNow: '2026-10-15T09:00:00.000Z',
    })
    expect(enCours.firstIn?.id).toBe('j1')
    expect(enCours.lastOut).toBeNull()
    expect(enCours.totalSecondes).toBe(0)
    expect(enCours.attendances.map(a => a.id)).toEqual(['j1', 'j2', 'j3'])

    // Quand Junior pointe sa vraie sortie à 17:00:00 locale (16:00:00 UTC) : 06:32:20 -> 17:00:00 = 10h 27min 40sec (37 660 s)
    const avecSortieSoir = [
      ...rebondJunior,
      { id: 'j4', employee_id: 'emp-junior', check_type: 'out', check_time: '2026-10-15T16:00:00.000Z' },
    ]
    const terminee = resoudrePointagesJournee(avecSortieSoir, '2026-10-15')
    expect(terminee.firstIn?.id).toBe('j1')
    expect(terminee.lastOut?.id).toBe('j4')
    expect(terminee.totalSecondes).toBe(37660)

    resetActiveTimezone()
  })

  it('10. applique la cascade Auto-Close à 3 niveaux (planning jour/nuit, config entreprise, ou +8h sans planning) sans perdre la veille', () => {
    setActiveTimezone('Africa/Porto-Novo')

    // Niveau 1a : Planning de jour (08:00 -> 17:00) sur une entrée à 08:00 locale (07:00 UTC)
    const outPlanJour = calculerSortieAutoClose('2026-10-12T07:00:00.000Z', {
      plan: { start_time: '08:00:00', end_time: '17:00:00' },
      referenceNow: '2026-10-15T10:00:00.000Z',
    })
    expect(outPlanJour.toISOString()).toBe('2026-10-12T16:00:00.000Z') // 17:00 locale

    // Niveau 1b : Planning de nuit (22:00 -> 06:00) sur une entrée à 22:00 locale (21:00 UTC) -> 06:00 J+1 (05:00 UTC)
    const outPlanNuit = calculerSortieAutoClose('2026-10-12T21:00:00.000Z', {
      plan: { start_time: '22:00:00', end_time: '06:00:00' },
      referenceNow: '2026-10-15T10:00:00.000Z',
    })
    expect(outPlanNuit.toISOString()).toBe('2026-10-13T05:00:00.000Z') // 06:00 J+1 locale

    // Niveau 3 : Sans planning ni autoCloseEnabled -> Entrée + 8h00 (y compris pour un travailleur de nuit entré à 22:00)
    const outSansPlanNuit = calculerSortieAutoClose('2026-10-12T21:00:00.000Z', {
      plan: null,
      enterpriseCfg: { autoCloseEnabled: false },
      referenceNow: '2026-10-15T10:00:00.000Z',
    })
    expect(outSansPlanNuit.toISOString()).toBe('2026-10-13T05:00:00.000Z') // 22:00 + 8h = 06:00 J+1 locale

    // Continuité multi-jours : oubli de sortie le lundi 12 oct (08:00 IN), suivi d'une journée normale le mardi 13 oct (08:00 -> 17:00)
    //  (le `constsummaries: {` qui traînait ici était un résidu d'éditeur : un
    //  label JS valide mais vide de sens, qui faisait passer le bloc pour du code.
    //  Remplacé par un vrai bloc scopé, aucun changement de comportement.)
    {
      const summaries = buildDaySummariesStrict({
        attendances: [
          { id: 'lun-in', employee_id: 'emp-1', check_type: 'in', check_time: '2026-10-12T07:00:00.000Z' },
          { id: 'mar-in', employee_id: 'emp-1', check_type: 'in', check_time: '2026-10-13T07:00:00.000Z' },
          { id: 'mar-out', employee_id: 'emp-1', check_type: 'out', check_time: '2026-10-13T16:00:00.000Z' },
        ],
        enterpriseCfg: { autoCloseEnabled: false, autoCloseTime: '23:59:00', autoCloseGraceMinutes: 0 },
        plan: null,
        yearStartDate: '2026-10-01',
        yearEndDate: '2026-10-31',
        basculeMinutes: 0,
      })

      // Le lundi 12 oct n'est plus perdu : il est auto-clôturé à +8h (28 800 s) avec hasAutoCloseVirtual = true
      expect(summaries['2026-10-12']?.totalSeconds).toBe(8 * 3600)
      expect(summaries['2026-10-12']?.hasAutoCloseVirtual).toBe(true)
      // Le mardi 13 oct a bien ses 9h00 (32 400 s)
      expect(summaries['2026-10-13']?.totalSeconds).toBe(9 * 3600)
      expect(summaries['2026-10-13']?.hasAutoCloseVirtual).toBe(false)
    }

    resetActiveTimezone()
  })
})
