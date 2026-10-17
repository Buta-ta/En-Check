// src/services/hoursCalculator.js
// ═══════════════════════════════════════════════════════════
// 🧮 HOURS CALCULATOR (CORRIGÉ v3.0 - Taux dynamiques)
// ✅ Fix : Taux heures sup dynamiques depuis settings entreprise
// ✅ Fix : Session ouverte plafonnée intelligemment
// ✅ Fix : Fenêtre de pointage stricte
// ✅ Fix : Attendu calculé correctement depuis planning
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'
import FeatureService, { FEATURES } from './featureService'
import HolidayService from './holidayService'
import {
  calculerDureeSecondes,
  formaterHeureLocale,
  minutesDepuisMinuit,
  jourLocal,
  heureLocaleVersUTC,
} from '../utils/timezoneUtils'
import {
  SEUILS_PAR_DEFAUT,
  chargerSeuilsPointage,
  validerCibleEstimation,
  estEstimationNonValidee,
  estEstimationEcartee,
  estLigneHorsCalcul,
  estRebondNeutralise,
} from './seuilsPointage'

//  Aucun seuil de pointage n'est plus écrit en dur dans ce moteur : ils viennent
//  de `encheck_reglages_pointage` (voir src/services/seuilsPointage.js). Les
//  constantes ci-dessous ne sont que le repli contractuel, jamais un réglage.
const H = (seuils, cle) => {
  const n = Number(seuils?.[cle])
  return Number.isFinite(n) && n > 0 ? n : SEUILS_PAR_DEFAUT[cle]
}

export async function calculateEmployeeHours(employeeId, enterpriseId, referenceDate = new Date()) {
  const ref = new Date(referenceDate)

  // ── 1) Charger employé + entreprise ───────────────────────
  const [{ data: employee, error: empErr }, { data: enterprise, error: entErr }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, enterprise_id, matricule, first_name, last_name, photo_url')
      .eq('id', employeeId)
      .single(),
    supabase
      .from('enterprises')
      .select('id, currency, timezone, auto_close_enabled, auto_close_time, auto_close_grace_minutes')
      .eq('id', enterpriseId)
      .single(),
  ])

  if (empErr || !employee) throw new Error('Employé introuvable')
  if (entErr || !enterprise) throw new Error('Entreprise introuvable')

  //  ⚙️ Les seuils viennent de la base (une seule source, décision §4.4).
  //  `chargerSeuilsPointage` ne rejette jamais : hors-ligne / base non migrée,
  //  il rend le contrat implicite, donc les chiffres affichés restent les mêmes
  //  que ceux du moteur SQL.
  const seuils = await chargerSeuilsPointage(enterprise.id)

  const enterpriseCfg = {
    id: enterprise.id,
    currency: enterprise.currency || 'XAF',
    autoCloseEnabled: enterprise.auto_close_enabled === true,
    autoCloseTime: (enterprise.auto_close_time || '23:59:00').slice(0, 8),
    autoCloseGraceMinutes: Number.isFinite(enterprise.auto_close_grace_minutes)
      ? Number(enterprise.auto_close_grace_minutes)
      : 0,
    timezone: enterprise.timezone || 'Africa/Porto-Novo',
    seuils,
  }

  // ── 2) Périodes ──────────────────────────────────────────
  const yearPeriod = getYearPeriod(ref)
  const monthPeriod = getMonthPeriod(ref)
  const weekPeriod = getWeekPeriod(ref)
  let todayKey = toDateKeyLocal(ref)

  const yearStartISO = new Date(`${yearPeriod.startDate}T00:00:00`).toISOString()
  const yearEndISO = new Date(`${yearPeriod.endDate}T23:59:59.999`).toISOString()

  // ── 3) Charger attendances ──────────────────────────────────
  //  Les colonnes `estimation_*` arrivent avec la migration des fondations :
  //  elles servent à distinguer une sortie RÉELLE d'une sortie PRÉSUMÉE, et à
  //  exclure les présomptions non validées de tout ce qui touche l'argent.
  const { data: attendancesRaw, error: attErr } = await supabase
    .from('attendances')
    .select(
      'id, employee_id, enterprise_id, check_time, check_type, is_auto_closed, method, ' +
        'anomalie, estimation_validee_le, estimation_remplacee_le, estimation_niveau, estimation_confiance',
    )
    .eq('employee_id', employeeId)
    .gte('check_time', yearStartISO)
    .lte('check_time', yearEndISO)
    .order('check_time', { ascending: true })

  if (attErr) throw attErr
  const attendances = attendancesRaw || []

  // ── 4) Charger absences ─────────────────────────────────────
  const { data: absencesRaw } = await supabase
    .from('absences')
    .select('id, employee_id, start_date, end_date, reason')
    .eq('employee_id', employeeId)
    .or(`start_date.lte.${yearPeriod.endDate},end_date.gte.${yearPeriod.startDate}`)

  const absences = absencesRaw || []

  // ── 5) Planning ──────────────────────────────────────────────
  //  Les grilles horaires portent des dates d'effet : on ne charge plus « la »
  //  grille de l'employé, mais celles qui peuvent s'appliquer sur la période,
  //  puis on retient pour chaque journée celle qui était en vigueur ce jour-là.
  //  Une grille changée en mars ne retouche donc jamais janvier.
  const { plansParJour, employeeScheduleRow, defaultScheduleRow } = await loadPlanningsDeLaPeriode({
    supabase,
    employeeId,
    enterpriseId: employee.enterprise_id,
    startDate: yearPeriod.startDate,
    endDate: yearPeriod.endDate,
  })

  const plan = resolvePlanForExpected(employeeScheduleRow, defaultScheduleRow)

  //  À 01:00 du matin, la journée de travail en cours est encore celle d'hier
  //  quand la bascule est à 04:00 : le tableau de bord doit montrer la garde en
  //  cours, pas une journée vide.
  if (plan) todayKey = cleJourDeTravail(ref, plan.bascule)
  const scheduleResolved = resolveScheduleLikeRetards(employeeScheduleRow, defaultScheduleRow)

  // ── 6) Jours fériés ──────────────────────────────────────────
  const holidaysSet = await loadHolidaySet(employee.enterprise_id, yearPeriod.startDate, yearPeriod.endDate)

  // ── 7) Contexte heures sup ───────────────────────────────────
  const { hasOvertimeFeature, overtimeSettings, allSchedules } = await loadOvertimeContext(employee.enterprise_id)

  // ── 8) Calcul jour par jour ──────────────────────────────────
  const daySummaries = buildDaySummariesStrict({
    basculeMinutes: plan ? minutesDeBascule(plan.bascule) : 0,
    attendances,
    enterpriseCfg,
    plan,
    plansParJour,
    //  Niveau 1 = ce qui est ÉCRIT pour cet employé ; Niveau 3 = le réglage
    //  général de l'entreprise. Les séparer est ce qui permet de dire « cette
    //  clôture vient d'une décision, celle-là d'un défaut » (§5).
    planPerso: resolvePlanForExpected(employeeScheduleRow, null),
    planDefaut: resolvePlanForExpected(null, defaultScheduleRow),
    seuils: enterpriseCfg.seuils,
    yearStartDate: yearPeriod.startDate,
    yearEndDate: yearPeriod.endDate,
  })

  // ── 9) Aujourd'hui ────────────────────────────────────────────
  const todaySummary = daySummaries[todayKey] || makeEmptyDaySummary(todayKey)

  const todayData = {
    date: todayKey,
    worked: formatDurationSeconds(todaySummary.totalSeconds),
    entries: todaySummary.entries,
    break: null,
    openSessionsCount: todaySummary.openSessionsCount,
    hasAutoCloseVirtual: todaySummary.hasAutoCloseVirtual,
  }

  // ── 10) Semaine ───────────────────────────────────────────────
  const weekDays = listDaysInclusive(weekPeriod.startDate, weekPeriod.endDate)

  let weekWorkedSeconds = 0
  let weekExpectedSeconds = null
  let weekExpectedDaysCount = null

  const weekRows = weekDays.map(d => {
    const s = daySummaries[d] || makeEmptyDaySummary(d)
    weekWorkedSeconds += s.totalSeconds
    return {
      day: new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' }),
      hours: formatDurationSeconds(s.totalSeconds),
      overtime: null,
    }
  })

  if (plan) {
    const exp = computeExpectedForRange({
      startDate: weekPeriod.startDate,
      endDate: weekPeriod.endDate,
      plan,
      plansParJour,
      holidaysSet,
      absences,
    })
    weekExpectedSeconds = exp.expectedSeconds
    weekExpectedDaysCount = exp.expectedDaysCount
  }

  const weekCompletion = (weekExpectedSeconds && weekExpectedSeconds > 0)
    ? (weekWorkedSeconds / weekExpectedSeconds) * 100
    : null

  const weekData = {
    period: `${formatDateShortFR(weekPeriod.startDate)} - ${formatDateShortFR(weekPeriod.endDate)}`,
    total: formatDurationSeconds(weekWorkedSeconds),
    expected: (weekExpectedSeconds && weekExpectedSeconds > 0) ? formatDurationSeconds(weekExpectedSeconds) : null,
    completion: (weekCompletion !== null) ? Math.round(weekCompletion * 10) / 10 : null,
    days: weekRows,
  }

  // ── 11) Mois (avec taux dynamiques) ───────────────────────────
  const monthDays = listDaysInclusive(monthPeriod.startDate, monthPeriod.endDate)

  let monthWorkedSeconds = 0
  let monthNormalSeconds = 0
  let otNormalSeconds = 0
  let otMajor50Seconds = 0
  let otMajor100Seconds = 0

  // ✅ NOUVEAU : Tracker les taux réellement appliqués
  let appliedRateNormal = null
  let appliedRateMajor = null

  let monthOpenSessionsCount = 0
  let monthVirtualAutoCloseDays = 0

  for (const d of monthDays) {
    const s = daySummaries[d] || makeEmptyDaySummary(d)
    monthWorkedSeconds += s.totalSeconds
    monthOpenSessionsCount += s.openSessionsCount
    if (s.hasAutoCloseVirtual) monthVirtualAutoCloseDays += 1

    if (
      hasOvertimeFeature &&
      overtimeSettings &&
      s.totalSeconds > 0 &&
      !s.hasAutoCloseVirtual &&
      !s.hasAutoClosedOut
    ) {
      const overtimeData = FeatureService.calculateOvertimeForEmployeeDay({
        totalWorkedSeconds: s.totalSeconds,
        employeeSchedule: employeeScheduleRow,
        enterpriseId: employee.enterprise_id,
        dateStr: d,
        allSchedules,
        overtimeSettings,
      })

      const totalOt = overtimeData?.totalOvertimeSeconds || 0
      const majorOt = overtimeData?.overtimeMajorSeconds || 0
      const normalOt = overtimeData?.overtimeSeconds || Math.max(0, totalOt - majorOt)

      otNormalSeconds += normalOt

      const majorRate = overtimeData?.rateMajorApplied
      if (majorRate === 100) otMajor100Seconds += majorOt
      else if (majorRate === 50) otMajor50Seconds += majorOt
      else otMajor50Seconds += majorOt

      monthNormalSeconds += Math.max(0, s.totalSeconds - totalOt)

      // ✅ Capturer les taux réels
      if (overtimeData?.rateApplied && appliedRateNormal === null) {
        appliedRateNormal = overtimeData.rateApplied
      }
      if (overtimeData?.rateMajorApplied && appliedRateMajor === null) {
        appliedRateMajor = overtimeData.rateMajorApplied
      }
    } else {
      monthNormalSeconds += s.totalSeconds
    }
  }

  let monthExpectedSeconds = null
  let monthExpectedDaysCount = null
  let monthAbsenceSeconds = 0

  if (plan) {
    const exp = computeExpectedForRange({
      startDate: monthPeriod.startDate,
      endDate: monthPeriod.endDate,
      plan,
      plansParJour,
      holidaysSet,
      absences,
    })
    monthExpectedSeconds = exp.expectedSeconds
    monthExpectedDaysCount = exp.expectedDaysCount
    monthAbsenceSeconds = exp.absenceSeconds
  }

  const monthRate = (monthExpectedSeconds && monthExpectedSeconds > 0)
    ? Math.round((monthWorkedSeconds / monthExpectedSeconds) * 100)
    : null

  // ✅ NOUVEAU : Structure avec taux dynamiques
  const monthData = {
    period: formatMonthYearFR(monthPeriod.startDate),

    normal: formatDurationSeconds(monthNormalSeconds),
    
    // ✅ Heures sup avec taux réels
    overtime_normal: {
      hours: formatDurationSeconds(otNormalSeconds),
      rate: appliedRateNormal !== null ? appliedRateNormal : (overtimeSettings?.rate_normal || 25),
    },
    
    overtime_major: {
      hours: formatDurationSeconds(otMajor50Seconds + otMajor100Seconds),
      rate: appliedRateMajor !== null ? appliedRateMajor : (overtimeSettings?.rate_major || 50),
    },

    // ✅ Ancien format (rétrocompatibilité)
    overtime_25: formatDurationSeconds(otNormalSeconds),
    overtime_50: formatDurationSeconds(otMajor50Seconds),
    overtime_100: formatDurationSeconds(otMajor100Seconds),

    absences: plan ? formatDurationSeconds(monthAbsenceSeconds) : '0h00',
    total_worked: formatDurationSeconds(monthWorkedSeconds),

    total_expected: (monthExpectedSeconds && monthExpectedSeconds > 0)
      ? formatDurationSeconds(monthExpectedSeconds)
      : null,

    rate: monthRate,

    openSessionsCount: monthOpenSessionsCount,
    virtualAutoCloseDays: monthVirtualAutoCloseDays,
  }

  // ── 12) Année ─────────────────────────────────────────────────
  const yearDays = listDaysInclusive(yearPeriod.startDate, yearPeriod.endDate)

  let yearWorkedSeconds = 0
  let yearOtSeconds = 0
  let yearPresenceDays = 0

  for (const d of yearDays) {
    const s = daySummaries[d] || makeEmptyDaySummary(d)
    yearWorkedSeconds += s.totalSeconds
    if (s.firstInISO) yearPresenceDays += 1

    if (
      hasOvertimeFeature &&
      overtimeSettings &&
      s.totalSeconds > 0 &&
      !s.hasAutoCloseVirtual &&
      !s.hasAutoClosedOut
    ) {
      const overtimeData = FeatureService.calculateOvertimeForEmployeeDay({
        totalWorkedSeconds: s.totalSeconds,
        employeeSchedule: employeeScheduleRow,
        enterpriseId: employee.enterprise_id,
        dateStr: d,
        allSchedules,
        overtimeSettings,
      })
      yearOtSeconds += overtimeData?.totalOvertimeSeconds || 0
    }
  }

  const avgPerDaySeconds = yearPresenceDays > 0 ? Math.round(yearWorkedSeconds / yearPresenceDays) : 0

  let yearExpectedSeconds = null
  let yearExpectedDaysCount = null

  if (plan) {
    const exp = computeExpectedForRange({
      startDate: yearPeriod.startDate,
      endDate: yearPeriod.endDate,
      plan,
      plansParJour,
      holidaysSet,
      absences,
    })
    yearExpectedSeconds = exp.expectedSeconds
    yearExpectedDaysCount = exp.expectedDaysCount
  }

  const attendanceRate = (yearExpectedDaysCount && yearExpectedDaysCount > 0)
    ? Math.round((yearPresenceDays / yearExpectedDaysCount) * 100)
    : null

  const delays = computeRetardsAlignedRetardsJSX({
    attendances,
    scheduleResolved,
    holidaysSet,
    startDate: yearPeriod.startDate,
    endDate: yearPeriod.endDate,
  })

  const yearData = {
    period: new Date(`${yearPeriod.startDate}T00:00:00`).getFullYear().toString(),
    total: formatDurationSeconds(yearWorkedSeconds),
    overtime: formatDurationSeconds(yearOtSeconds),
    avg_per_day: formatDurationSeconds(avgPerDaySeconds),
    attendance_rate: attendanceRate,
    delays,
  }

  // ── 13) Valorisation (avec taux dynamiques) ───────────────────
  const valorization = await calculateValorization(employeeId, employee.enterprise_id, monthData, enterpriseCfg.currency)

  // ── 14) Alertes ───────────────────────────────────────────────
  const alerts = generateAlerts({
    today: todayData,
    month: monthData,
    year: yearData,
    hasPlan: !!plan,
  })

  return {
    employee: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      matricule: employee.matricule,
      photo_url: employee.photo_url,
    },
    today: todayData,
    thisWeek: weekData,
    thisMonth: monthData,
    thisYear: yearData,
    valorization,
    alerts,
  }
}

// ═══════════════════════════════════════════════════════════
// ✅ CALCUL STRICT JOUR PAR JOUR
// ═══════════════════════════════════════════════════════════

function buildDaySummariesStrict({
  attendances,
  enterpriseCfg,
  plan = null,
  plansParJour = null,
  yearStartDate,
  yearEndDate,
  basculeMinutes = 0,
  seuils = null,
  planPerso = null,
  planDefaut = null,
}) {
  //  ⚙️ Une seule source de seuils pour la journée : `encheck_reglages_pointage`.
  //  Avant, ce fichier écrivait un 16 (appariement), un 60 (anti-rebond) et un 14
  //  (plafond d'invention) en dur à quatre endroits — et le plafond de 14 h
  //  n'était même pas le même que celui du SQL.
  const s = seuils || enterpriseCfg?.seuils || SEUILS_PAR_DEFAUT
  const APPARIEMENT_H = H(s, 'appariementHeures')
  const REBOND_S = H(s, 'seuilRebondSecondes')
  const summaries = {}
  const atts = [...(attendances || [])].sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

  const ensure = (dateKey) => {
    if (!summaries[dateKey]) summaries[dateKey] = makeEmptyDaySummary(dateKey)
    return summaries[dateKey]
  }

  const pushPairToDay = (inAtt, outAtt) => {
    const inDate = new Date(inAtt.check_time)
    //  Journée de travail : la bascule de la grille décide où commence la
    //  journée, donc à quelle journée appartient un pointage d'après minuit.
    const dayKey = cleJourDeTravail(inDate, basculeMinutes)

    if (dayKey < yearStartDate || dayKey > yearEndDate) return

    const s = ensure(dayKey)

    const duration = calculerDureeSecondes(inAtt.check_time, outAtt.check_time)
    const cappedDuration = Math.min(duration, APPARIEMENT_H * 3600)
    s.totalSeconds += cappedDuration

    s.validPairsCount += 1
    if (!s.firstInISO) s.firstInISO = inAtt.check_time
    s.lastOutISO = outAtt.check_time

    if (outAtt?.__virtual) {
      s.openSessionsCount += 1
      s.hasAutoCloseVirtual = true
    }
    if (outAtt?.is_auto_closed) {
      s.hasAutoClosedOut = true
    }

    // entries (limitées)
    if (s.entries.length < 4) {
      s.entries.push({
        in: formaterHeureLocale(inAtt.check_time),
        out: outAtt ? formaterHeureLocale(outAtt.check_time) : null,
        is_auto_closed: !!outAtt?.is_auto_closed,
        is_virtual: !!outAtt?.__virtual,
      })
    }
  }

  const closeOpenSessionVirtually = (openInAtt) => {
    if (!openInAtt) return
    const inDate = new Date(openInAtt.check_time)
    const dayKey = cleJourDeTravail(inDate, basculeMinutes)
    //  Cascade §5 : la grille EN VIGUEUR CE JOUR-LÀ (dates d'effet) vaut Niveau 1
    //  si elle est personnelle/liée, sinon on redescend au Niveau 3 (grille par
    //  défaut). Le JS reste un moteur D'AFFICHAGE : c'est `encheck_cloturer_pivotable`
    //  qui décide de ce qui est consigné et de ce qui est payable.
    const grilleDuJour = (plansParJour && plansParJour[dayKey]) || null
    const finalOut = calculerSortieAutoClose(openInAtt, {
      plan: grilleDuJour || planPerso || plan,
      planDefaut: grilleDuJour ? null : planDefaut,
      estimation: openInAtt.estimation_ombre || null,
      enterpriseCfg,
      seuils: s,
    })

    pushPairToDay(openInAtt, {
      id: `virtual-out-${openInAtt.id}`,
      check_time: finalOut.toISOString(),
      check_type: 'out',
      //  Marque de la sortie estimée : payée seulement après validation humaine.
      is_auto_closed: true,
      //  La méthode reste 'auto_close' en DUR, jamais celle du badge d'entrée :
      //  recopier `method` ferait passer une invention pour un QR (trou n°2).
      method: 'auto_close',
      estimation_niveau: finalOut.autoCloseNiveau ?? null,
      __virtual: true,
    })
  }

  let currentIn = null

  for (const att of atts) {
    //  Estimations écartées/remplacées : audit seulement, jamais appariées.
    if (estLigneHorsCalcul(att)) continue
    // ✅ on ne filtre pas sur la "date du OUT", on paire globalement
    if (att.check_type === 'in') {
      if (!currentIn) {
        currentIn = att
      } else {
        const diffHours = (new Date(att.check_time) - new Date(currentIn.check_time)) / (1000 * 60 * 60)
        const inDay = cleJourDeTravail(new Date(currentIn.check_time), basculeMinutes)
        const attDay = cleJourDeTravail(new Date(att.check_time), basculeMinutes)
        const isConsecutiveInSameShift =
          diffHours >= 0 &&
          diffHours <= APPARIEMENT_H &&
          (attDay === inDay || minutesDepuisMinuit(att.check_time) < 360)

        // Si ce n'est pas un double IN dans la même garde (ex: session oubliée la veille),
        // on clôture virtuellement la session oubliée de la veille avant d'ouvrir la nouvelle !
        if (!isConsecutiveInSameShift) {
          closeOpenSessionVirtually(currentIn)
          currentIn = att
        }
      }
      continue
    }

    if (att.check_type === 'out' && currentIn) {
      const diffSeconds = (new Date(att.check_time) - new Date(currentIn.check_time)) / 1000
      const diffHours = diffSeconds / 3600

      // Anti-rebond QR Code : un OUT à moins de `seuilRebondSecondes` de l'IN est un
      // double scan accidentel. ⚠️ On l'IGNORE ici, on ne le SUPPRIME nulle part :
      // `encheck_nettoyer_rebonds_qr` effaçait aussi les vraies paires courtes, la
      // fonction est donc neutralisée côté base (elle marque, elle ne détruit plus).
      if (diffSeconds >= 0 && diffSeconds < REBOND_S) {
        continue
      }

      if (diffHours > 0 && diffHours <= APPARIEMENT_H) {
        pushPairToDay(currentIn, att)
        currentIn = null
      } else {
        // OUT trop loin (> appariement_heures) => l'ancien IN était un oubli de
        // dépointage : on le clôture virtuellement (on marque, on n'efface pas).
        closeOpenSessionVirtually(currentIn)
        currentIn = null
      }
    }
  }

  // ✅ Session ouverte restante en fin de période (IN sans OUT)
  if (currentIn) {
    closeOpenSessionVirtually(currentIn)
  }

  return summaries
}

function computeDayStrict(selectedDate, empAttendances, enterpriseCfg, plan = null, seuils = null) {
  const s = seuils || enterpriseCfg?.seuils || SEUILS_PAR_DEFAUT
  const APPARIEMENT_H = H(s, 'appariementHeures')
  const REBOND_S = H(s, 'seuilRebondSecondes')
  let totalSeconds = 0
  let validPairs = []
  let openSessionsCount = 0
  let hasAutoCloseVirtual = false

  const atts = [...empAttendances].sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

  let currentIn = null

  for (const att of atts) {
    //  Estimations écartées/remplacées : audit seulement, jamais appariées.
    if (estLigneHorsCalcul(att)) continue
    if (att.check_type === 'in') {
      if (!currentIn) {
        currentIn = att
      } else {
        const diffHours = (new Date(att.check_time) - new Date(currentIn.check_time)) / (1000 * 60 * 60)
        if (diffHours > APPARIEMENT_H) {
          currentIn = att
        }
      }
    } else if (att.check_type === 'out' && currentIn) {
      const diffSeconds = (new Date(att.check_time) - new Date(currentIn.check_time)) / 1000
      if (diffSeconds >= 0 && diffSeconds < REBOND_S) {
        continue
      }
      const duration = calculerDureeSecondes(currentIn.check_time, att.check_time)
      const cappedDuration = Math.min(duration, APPARIEMENT_H * 3600)
      
      totalSeconds += cappedDuration
      validPairs.push({ in: currentIn, out: att })
      currentIn = null
    }
  }

  // ✅ Session ouverte (IN sans OUT)
  if (currentIn) {
    openSessionsCount = 1
    hasAutoCloseVirtual = true

    const finalOut = calculerSortieAutoClose(currentIn, {
      plan,
      enterpriseCfg,
      seuils: s,
    })

    const duration = calculerDureeSecondes(currentIn.check_time, finalOut.toISOString())
    totalSeconds += duration

    validPairs.push({
      in: currentIn,
      out: {
        id: `virtual-out-${currentIn.id}`,
        check_time: finalOut.toISOString(),
        check_type: 'out',
        is_auto_closed: true,
        __virtual: true,
      },
    })
  }

  const firstIn = validPairs.length > 0 ? validPairs[0].in : null
  const lastOut = validPairs.length > 0 ? validPairs[validPairs.length - 1].out : null

  const entries = validPairs.slice(0, 4).map(pair => ({
    in: formaterHeureLocale(pair.in.check_time),
    out: pair.out ? formaterHeureLocale(pair.out.check_time) : null,
    is_auto_closed: !!pair.out?.is_auto_closed,
    is_virtual: !!pair.out?.__virtual,
  }))

  return {
    date: selectedDate,
    totalSeconds,
    firstInISO: firstIn?.check_time || null,
    lastOutISO: lastOut?.check_time || null,
    validPairsCount: validPairs.length,
    openSessionsCount,
    hasAutoCloseVirtual,
    entries,
  }
}

/**
 * Cascade à 5 niveaux pour clôturer une entrée sans sortie — alignée sur
 * l'arbitrage n°1 (§5) et sur le moteur SQL `encheck_cloturer_pivotable`, pour
 * que l'écran admin et la base rendent EXACTEMENT la même heure.
 *
 *   Niveau 1  Horaire PERSONNEL explicite (custom_*) ou grille explicitement
 *             LIÉE à l'employé : c'est une décision écrite pour CET employé.
 *   Niveau 2  Apprentissage comportemental, via `estimation` consignés par le
 *             moteur SQL ({ heure_sortie, estimation_niveau, ... }). Le JS ne
 *             recalcule PAS le cluster : une seule source de vérité.
 *   Niveau 3  Grille PAR DÉFAUT de l'entreprise — et jamais une grille devinée
 *             « fantôme » : sans grille résolue, on descend d'un étage.
 *   Niveau 4  `auto_close_time` + `auto_close_grace_minutes` de l'entreprise.
 *   Niveau 5  Entrée + 8h00 (secours universel ; traverse minuit sans couper à
 *             23:59, donc valable aussi pour les travailleurs de nuit).
 *
 * Garde-fous, dans cet ordre, identiques côté SQL :
 *   · jamais moins de `dureeMinimaleSessionMinutes` après l'entrée (un pointage
 *     à une minute est un doublon, pas une journée de travail) ;
 *   · jamais plus de `plafondInventionHeures` (12 h — c'était 14 h avant
 *     l'arbitrage, et le dépôt pointage, lui, disait 12 h : ils sont enfin
 *     d'accord) ;
 *   · jamais dans le futur par rapport à `referenceNow` : on ne facture pas une
 *     heure qui n'a pas encore sonné.
 *
 * ⚠️ Ce que rend cette fonction sert à AFFICHER une journée en cours ou
 *    oubliée. Ce qui est PAYÉ se décide ailleurs : une sortie estimée reste
 *    `is_auto_closed = true` et ne rentre dans la paie que validée par un
 *    humain (`estimation_validee_le`) — doctrine « on invente, on marque, on
 *    n'encaisse pas » (§4.1).
 *
 * @param {Date|string|{check_time:string}} inDateOrAtt entrée à clôturer
 * @param {object} options
 * @param {object|null} options.plan          grille liée/personnelle (Niveau 1)
 * @param {object|null} options.planDefaut    grille par défaut (Niveau 3)
 * @param {object|null} options.estimation    estimation SQL (Niveau 2)
 * @param {object|null} options.enterpriseCfg cfg entreprise (+ `seuils`, `timezone`)
 * @param {object|null} options.seuils        seuils explicites (sinon ceux de la cfg)
 * @param {Date|string} options.referenceNow  « maintenant » (testable)
 * @param {string} options.fuseau             fuseau IANA (sinon celui de l'entreprise)
 * @returns {Date} instant de sortie retenu (jamais inventé au-delà des garde-fous)
 */
export function calculerSortieAutoClose(inDateOrAtt, options = {}) {
  const {
    plan = null,
    planDefaut = null,
    estimation = null,
    enterpriseCfg = null,
    seuils = null,
    referenceNow = null,
    fuseau = null,
  } = options

  const inDate = inDateOrAtt instanceof Date
    ? inDateOrAtt
    : new Date(inDateOrAtt?.check_time || inDateOrAtt)
  const now = referenceNow ? new Date(referenceNow) : new Date()
  const s = seuils || enterpriseCfg?.seuils || SEUILS_PAR_DEFAUT
  const tz = fuseau || enterpriseCfg?.timezone || null

  if (!Number.isFinite(inDate.getTime())) return new Date(now.getTime())

  const inDayStr = jourLocal(inDate) || toDateKeyLocal(inDate)
  const nextDateObj = new Date(`${inDayStr}T00:00:00Z`)
  nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1)
  const nextDayStr = nextDateObj.toISOString().split('T')[0]

  // Heure de fin d'une grille, en gérant la nuit (end < start ⇒ fin à J+1) et
  // les gardes du soir (entrée APRÈS l'heure de fin d'une grille de jour ⇒ la
  // grille ne parle pas de cette journée : on descend d'un étage au lieu de
  // clôturer à une heure déjà passée).
  const finDePlanning = (pln) => {
    if (!pln || !pln.start_time || !pln.end_time) return null
    const [sH, sM] = String(pln.start_time).split(':').map(Number)
    const [eH, eM] = String(pln.end_time).split(':').map(Number)
    const startMin = (sH || 0) * 60 + (sM || 0)
    const endMin = (eH || 0) * 60 + (eM || 0)
    if (endMin === startMin) return null

    const estNuit = endMin < startMin
    const jourCible = estNuit ? nextDayStr : inDayStr
    const iso = heureLocaleVersUTC(jourCible, eH || 0, eM || 0, 0, tz)
    if (!iso) return null
    const d = new Date(iso)
    if (estNuit) return d > inDate ? d : null
    // Grille de jour : si l'entrée est déjà après la fin prévue, cette grille
    // ne décrit pas cette journée (astreinte, garde de nuit non planifiée).
    return d > inDate ? d : null
  }

  let candidateOut = null
  let niveauUtilise = null

  // ── Niveau 1 : horaire personnel / grille liée ─────────────────────────
  candidateOut = finDePlanning(plan)
  if (candidateOut) niveauUtilise = 1

  // ── Niveau 2 : apprentissage comportemental (consigné par le SQL) ──────
  if (!candidateOut && estimation?.heure_sortie) {
    const [eH, eM] = String(estimation.heure_sortie).split(':').map(Number)
    for (const jour of [inDayStr, nextDayStr]) {
      const iso = heureLocaleVersUTC(jour, eH || 0, eM || 0, 0, tz)
      const d = iso ? new Date(iso) : null
      if (d && d > inDate) {
        candidateOut = d
        niveauUtilise = 2
        break
      }
    }
  }

  // ── Niveau 3 : grille par défaut de l'entreprise ────────────────────────
  if (!candidateOut) {
    candidateOut = finDePlanning(planDefaut)
    if (candidateOut) niveauUtilise = 3
  }

  // ── Niveau 4 : auto_close de l'entreprise ───────────────────────────────
  if (!candidateOut && enterpriseCfg?.autoCloseEnabled && enterpriseCfg?.autoCloseTime) {
    const [acH, acM] = String(enterpriseCfg.autoCloseTime).split(':').map(Number)
    const graceMs = (Number(enterpriseCfg.autoCloseGraceMinutes) || 0) * 60000
    for (const jour of [inDayStr, nextDayStr]) {
      const iso = heureLocaleVersUTC(jour, acH || 0, acM || 0, 0, tz)
      const d = iso ? new Date(new Date(iso).getTime() + graceMs) : null
      if (d && d > inDate) {
        candidateOut = d
        niveauUtilise = 4
        break
      }
    }
  }

  // ── Niveau 5 : secours universel, entrée + 8h00 ────────────────────────
  if (!candidateOut) {
    candidateOut = new Date(inDate.getTime() + 8 * 3600 * 1000)
    niveauUtilise = 5
  }

  // ── Garde-fous ──────────────────────────────────────────────────────────
  const plancher = new Date(inDate.getTime() + Math.max(0, H(s, 'dureeMinimaleSessionMinutes')) * 60000)
  const plafond = new Date(inDate.getTime() + H(s, 'plafondInventionHeures') * 3600000)

  let finalOut = candidateOut
  if (finalOut > plafond) finalOut = plafond
  if (finalOut < plancher) finalOut = plancher
  // Jamais dans le futur : tant que la journée est en cours, on s'arrête à
  // « maintenant » (avant, une entrée récente pouvait déjà afficher 8 h de
  // travail fictif sur le dashboard du jour).
  if (finalOut > now && now > inDate) finalOut = now
  if (finalOut <= inDate) finalOut = inDate

  const sortie = new Date(finalOut.getTime())
  // Trace de l'étage utilisé : affichée dans les badges, et surtout dans le
  // journal SQL. Une estimation sans provenance est invérifiable.
  sortie.autoCloseNiveau = niveauUtilise
  return sortie
}

function computeVirtualAutoCloseOut(inDate, enterpriseCfg, plan = null) {
  return calculerSortieAutoClose(inDate, { plan, enterpriseCfg })
}

// ═══════════════════════════════════════════════════════════
// EXPECTED (planning)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// DATES D'EFFET DES GRILLES HORAIRES
// ═══════════════════════════════════════════════════════════
//  Une grille sans date de début vaut depuis toujours ; sans date de fin, elle
//  vaut sans fin ; et lorsque plusieurs versions couvrent une même journée,
//  c'est la plus récemment déclarée qui l'emporte.

const DATE_SANS_DEBUT = '1900-01-01'

// ═══════════════════════════════════════════════════════════
// LA JOURNÉE DE TRAVAIL ET L'HEURE DE BASCULE
// ═══════════════════════════════════════════════════════════
//  Un service qui commence à 22:00 et finit à 06:00 appartient à la journée où
//  il a COMMENCÉ : la partie qui se déroule après minuit doit donc être comptée
//  la veille. Chaque grille peut déclarer une heure de bascule — avant cette
//  heure-là, on est encore la journée précédente. Sans déclaration, la bascule
//  est à minuit et rien ne change.

function minutesDeBascule(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return 0
  if (typeof valeur === 'number') {
    return Number.isFinite(valeur) ? Math.max(0, Math.min(1439, Math.round(valeur))) : 0
  }
  const m = String(valeur).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return 0
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return Number.isFinite(minutes) ? Math.max(0, Math.min(1439, minutes)) : 0
}

//  Le nom de la journée de travail d'un instant : on recule de la bascule, puis
//  on prend le jour local (dans le fuseau de l'entreprise). Avec une bascule à minuit, c'est le jour local.
function cleJourDeTravail(date, basculeMinutes = 0) {
  const bascule = minutesDeBascule(basculeMinutes)
  const d = date instanceof Date ? date : new Date(date)
  if (!bascule) return jourLocal(d) || toDateKeyLocal(d)
  const decale = new Date(d.getTime() - bascule * 60000)
  return jourLocal(decale) || toDateKeyLocal(decale)
}

function grilleValableLe(grille, jour) {
  if (!grille || !jour) return true
  const debut = grille.valide_du ? String(grille.valide_du).slice(0, 10) : DATE_SANS_DEBUT
  const fin = grille.valide_au ? String(grille.valide_au).slice(0, 10) : null
  if (jour < debut) return false
  if (fin && jour > fin) return false
  return true
}

function dateEffet(grille) {
  return grille && grille.valide_du ? String(grille.valide_du).slice(0, 10) : DATE_SANS_DEBUT
}

//  La plus récente d'abord ; à date d'effet égale, la dernière créée — c'est
//  celle que quelqu'un vient de déclarer, donc celle qu'il faut lire.
function parDateEffetDecroissante(a, b) {
  const da = dateEffet(a)
  const db = dateEffet(b)
  if (da !== db) return db.localeCompare(da)

  const ca = String(a?.created_at || '')
  const cb = String(b?.created_at || '')
  if (ca !== cb) return cb.localeCompare(ca)

  return String(b?.id || '').localeCompare(String(a?.id || ''))
}

function choisirGrilleParDefaut(grilles, jour) {
  const valables = (grilles || []).filter((g) => grilleValableLe(g, jour))
  if (valables.length === 0) return null
  const parDefaut = valables.filter((g) => g.is_default === true)
  return [...(parDefaut.length ? parDefaut : valables)].sort(parDateEffetDecroissante)[0] || null
}

/**
 * Charge les grilles applicables sur la période et construit, pour chaque
 * journée, l'horaire attendu de ce jour précis.
 *
 * Si la base ne connaît pas encore les dates d'effet, on reprend exactement
 * les deux requêtes d'origine : rien ne change à l'écran.
 */
async function loadPlanningsDeLaPeriode({ supabase, employeeId, enterpriseId, startDate, endDate }) {
  const [{ data: affectations, error: errAffectations }, { data: grilles, error: errGrilles }] =
    await Promise.all([
      supabase.from('employee_schedules').select('*, work_schedules(*)').eq('employee_id', employeeId),
      supabase
        .from('work_schedules')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .or(`valide_du.is.null,valide_du.lte.${endDate}`),
    ])

  if (errGrilles || errAffectations) {
    const [{ data: employeeScheduleRow }, { data: defaultScheduleRow }] = await Promise.all([
      supabase
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .eq('employee_id', employeeId)
        .maybeSingle(),
      supabase
        .from('work_schedules')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    return {
      plansParJour: null,
      employeeScheduleRow: employeeScheduleRow || null,
      defaultScheduleRow: defaultScheduleRow || null,
    }
  }

  const affectationsUtiles = (affectations || []).filter(
    (r) =>
      r &&
      r.is_active !== false &&
      ((r.use_custom_hours && r.custom_start_time && r.custom_end_time) ||
        (r.work_schedules && grilleValableLe(r.work_schedules, startDate)))
  )
  const grillesUtiles = (grilles || []).filter((g) => grilleValableLe(g, startDate))

  const employeeScheduleRow = affectationsUtiles[0] || null
  const defaultScheduleRow =
    choisirGrilleParDefaut(grillesUtiles, startDate) ||
    (employeeScheduleRow ? employeeScheduleRow.work_schedules : null) ||
    null

  return {
    plansParJour: construirePlanningsParJour({ affectations: affectationsUtiles, grilles: grillesUtiles, startDate, endDate }),
    employeeScheduleRow,
    defaultScheduleRow,
  }
}

function construirePlanningsParJour({ affectations, grilles, startDate, endDate }) {
  const parJour = {}
  if (!startDate || !endDate) return parJour

  for (const jour of listDaysInclusive(startDate, endDate)) {
    const affectationCustom =
      (affectations || []).find(
        (r) => r && r.is_active !== false && r.use_custom_hours && r.custom_start_time && r.custom_end_time
      ) || null

    const affectationGrille =
      (affectations || [])
        .filter((r) => r && r.work_schedules && grilleValableLe(r.work_schedules, jour))
        .sort((a, b) => parDateEffetDecroissante(a.work_schedules, b.work_schedules))[0] || null

    const affectation = affectationCustom || affectationGrille
    const grilleDuJour = affectation?.work_schedules || choisirGrilleParDefaut(grilles, jour)

    if (!affectation && !grilleDuJour) continue

    const plan = resolvePlanForExpected(affectation, grilleDuJour)
    if (!plan) continue

    parJour[jour] = {
      ...plan,
      grilleId: affectation?.use_custom_hours
        ? `custom-${affectation.id || affectation.employee_id || 'emp'}`
        : (grilleDuJour?.id || null),
      grilleNom: affectation?.use_custom_hours
        ? 'Horaire personnalisé'
        : (grilleDuJour?.name || null),
      valide_du: grilleDuJour?.valide_du || null,
    }
  }

  return parJour
}

function computeExpectedForRange({ startDate, endDate, plan, plansParJour, holidaysSet, absences }) {
  const days = listDaysInclusive(startDate, endDate)
  const absenceDaySet = buildAbsenceDaySet(absences, startDate, endDate)

  let expectedSeconds = 0
  let expectedDaysCount = 0
  let absenceSeconds = 0
  let joursSansGrille = 0

  //  Quel horaire a produit le total : c'est ce qui permet d'expliquer un
  //  résultat à un employé (« en mars, ta grille est passée de 8 h à 8 h 30 »).
  const heuresParGrille = new Map()

  for (const d of days) {
    if (holidaysSet && holidaysSet.has(d)) continue

    //  En mode daté, une journée sans grille en vigueur n'attend rien : on ne
    //  ressert pas l'horaire d'avant, sinon une grille terminée continuerait de
    //  compter ses heures pour toujours.
    const grilleDuJour = plansParJour ? plansParJour[d] || null : null
    if (plansParJour && !grilleDuJour) joursSansGrille += 1
    const planDuJour = plansParJour ? grilleDuJour : plan

    const dayExpected = computeExpectedForDay(d, planDuJour)
    if (!dayExpected || dayExpected <= 0) continue

    if (grilleDuJour && grilleDuJour.grilleId) {
      const cle = grilleDuJour.grilleId
      const vu = heuresParGrille.get(cle) || {
        grilleId: grilleDuJour.grilleId,
        grilleNom: grilleDuJour.grilleNom || null,
        jours: [],
        secondes: 0,
      }
      vu.jours.push(d)
      vu.secondes += dayExpected
      heuresParGrille.set(cle, vu)
    }

    if (absenceDaySet.has(d)) {
      absenceSeconds += dayExpected
      continue
    }

    expectedSeconds += dayExpected
    expectedDaysCount += 1
  }

  return {
    expectedSeconds,
    expectedDaysCount,
    absenceSeconds,
    joursSansGrille,
    //  Détail par grille, du plus ancien au plus récent : sert à afficher
    //  « du 01/01 au 28/02 : 08:00-17:00 · à partir du 01/03 : 07:00-16:00 ».
    detailParGrille: Array.from(heuresParGrille.values())
      .map((v) => ({ ...v, debut: v.jours[0], fin: v.jours[v.jours.length - 1] }))
      .sort((a, b) => String(a.debut).localeCompare(String(b.debut))),
  }
}

function computeExpectedForDay(dateKey, plan) {
  if (!plan) return 0

  const dayIndex = getPlanDayIndex(dateKey)
  const workDays = Array.isArray(plan.work_days) ? plan.work_days : null
  if (!workDays || workDays.length === 0) return 0
  if (!workDays.includes(dayIndex)) return 0

  if (!plan.start_time || !plan.end_time) return 0

  const startMin = timeToMinutes(plan.start_time)
  const endMin = timeToMinutes(plan.end_time)
  //  Départ identique à l'arrivée : rien de déclaré, on ne compte rien.
  if (endMin === startMin) return 0

  //  Un service qui traverse minuit — 22:00 → 06:00 — vaut 8 h, comptées sur la
  //  journée où il a COMMENCÉ. Avant, la base répondait 0 heure : ni retard, ni
  //  absence, ni heure supplémentaire ne pouvaient exister pour une garde de nuit.
  const minutes = endMin > startMin ? endMin - startMin : (1440 - startMin) + endMin

  let pauseMinutes = 0
  if (plan.has_break && plan.break_start && plan.break_end) {
    let bStart = timeToMinutes(plan.break_start)
    let bEnd = timeToMinutes(plan.break_end)
    if (endMin < startMin) {
      //  Service de nuit : la pause est écrite elle aussi après minuit.
      if (bStart < startMin) bStart += 1440
      if (bEnd < startMin) bEnd += 1440
    }
    if (bEnd > bStart && bStart >= startMin && bEnd <= startMin + minutes) {
      pauseMinutes = bEnd - bStart
    }
  }

  return Math.max(0, minutes - pauseMinutes) * 60
}

function resolvePlanForExpected(employeeScheduleRow, defaultScheduleRow) {
  if (employeeScheduleRow?.use_custom_hours) {
    const start = employeeScheduleRow.custom_start_time?.slice(0, 8) || null
    const end = employeeScheduleRow.custom_end_time?.slice(0, 8) || null
    const hasBreak = employeeScheduleRow.custom_has_break !== false
    const breakStart = employeeScheduleRow.custom_break_start?.slice(0, 8) || null
    const breakEnd = employeeScheduleRow.custom_break_end?.slice(0, 8) || null
    const workDays = employeeScheduleRow.custom_work_days || null

    if (!start || !end || !Array.isArray(workDays) || workDays.length === 0) return null

    return {
      start_time: start,
      end_time: end,
      has_break: hasBreak,
      break_start: breakStart,
      break_end: breakEnd,
      work_days: workDays,
      bascule: minutesDeBascule(employeeScheduleRow.custom_bascule),
    }
  }

  if (employeeScheduleRow?.work_schedules) {
    const ws = employeeScheduleRow.work_schedules
    if (!ws.start_time || !ws.end_time) return null

    return {
      start_time: ws.start_time?.slice(0, 8),
      end_time: ws.end_time?.slice(0, 8),
      has_break: ws.has_break !== false,
      break_start: ws.break_start?.slice(0, 8) || null,
      break_end: ws.break_end?.slice(0, 8) || null,
      work_days: Array.isArray(ws.work_days) ? ws.work_days : [1, 2, 3, 4, 5],
      bascule: minutesDeBascule(ws.bascule),
    }
  }

  if (defaultScheduleRow?.start_time && defaultScheduleRow?.end_time) {
    return {
      start_time: defaultScheduleRow.start_time?.slice(0, 8),
      end_time: defaultScheduleRow.end_time?.slice(0, 8),
      has_break: defaultScheduleRow.has_break !== false,
      break_start: defaultScheduleRow.break_start?.slice(0, 8) || null,
      break_end: defaultScheduleRow.break_end?.slice(0, 8) || null,
      work_days: Array.isArray(defaultScheduleRow.work_days) ? defaultScheduleRow.work_days : [1, 2, 3, 4, 5],
      bascule: minutesDeBascule(defaultScheduleRow.bascule),
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════
// OVERTIME CONTEXT
// ═══════════════════════════════════════════════════════════

async function loadOvertimeContext(enterpriseId) {
  let hasOvertimeFeature = false
  let overtimeSettings = null

  try {
    hasOvertimeFeature = await FeatureService.hasFeature(enterpriseId, FEATURES.HEURES_SUPPLEMENTAIRES)
    if (hasOvertimeFeature) {
      overtimeSettings = await FeatureService.getOvertimeSettings(enterpriseId)
    }
  } catch {
    hasOvertimeFeature = false
    overtimeSettings = null
  }

  const allSchedules = await FeatureService.loadSchedules([enterpriseId])
  return { hasOvertimeFeature, overtimeSettings, allSchedules }
}

// ═══════════════════════════════════════════════════════════
// HOLIDAYS
// ═══════════════════════════════════════════════════════════

async function loadHolidaySet(enterpriseId, startDate, endDate) {
  try {
    const holidays = await HolidayService.getHolidaysForRange(enterpriseId, startDate, endDate)
    const nonWorked = (holidays || []).filter(h => !h.is_worked)
    return HolidayService.buildHolidaySet(nonWorked)
  } catch {
    return new Set()
  }
}

// ═══════════════════════════════════════════════════════════
// RETARDS
// ═══════════════════════════════════════════════════════════

function computeRetardsAlignedRetardsJSX({ attendances, scheduleResolved, holidaysSet, startDate, endDate }) {
  const { heureArrivee, tolerance, bascule } = scheduleResolved || {}
  if (!heureArrivee) {
    return { count: 0, total_minutes: 0, ignored_no_schedule: true }
  }

  const inAtts = attendances
    .filter(a => a.check_type === 'in')
    .filter(a => {
      const d = jourLocal(a.check_time) || a.check_time.split('T')[0]
      return d >= startDate && d <= endDate
    })
    .sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

  //  La journée de travail, et non la date UTC : un pointage de 00h30 avec une
  //  bascule à 04:00 appartient à la veille, pas au lendemain.
  const firstInByDay = {}
  for (const a of inAtts) {
    const jour = cleJourDeTravail(new Date(a.check_time), bascule)
    if (!firstInByDay[jour]) firstInByDay[jour] = a
  }

  const [hA, mA] = heureArrivee.split(':').map(Number)
  const minutesArriveeBase = hA * 60 + mA
  const minutesArriveeMax = minutesArriveeBase + (tolerance || 15)

  let count = 0
  let totalMinutes = 0

  for (const [jour, premierPointage] of Object.entries(firstInByDay)) {
    if (holidaysSet && holidaysSet.has(jour)) continue

    // Le retard se calcule sur l'heure LOCALE de l'entreprise.
    // Avant, on comparait l'heure UTC à un horaire configuré en heure locale :
    // pour un client au Cameroun, tout le monde arrivait « à l'heure » une
    // heure trop tard, et pour un client au Canada, tout le monde était
    // compté 4 heures en retard.
    const minutesPointage = minutesDepuisMinuit(premierPointage.check_time)

    const retardMinutes = minutesPointage - minutesArriveeBase
    const estEnRetard = minutesPointage > minutesArriveeMax

    if (estEnRetard && retardMinutes > 0) {
      count++
      totalMinutes += retardMinutes
    }
  }

  return { count, total_minutes: totalMinutes, ignored_no_schedule: false }
}

function resolveScheduleLikeRetards(employeeScheduleRow, defaultScheduleRow) {
  let heureArrivee = null
  let tolerance = 15
  let bascule = 0

  if (employeeScheduleRow) {
    if (employeeScheduleRow.use_custom_hours && employeeScheduleRow.custom_start_time) {
      heureArrivee = employeeScheduleRow.custom_start_time.slice(0, 5)
      tolerance = employeeScheduleRow.custom_late_tolerance_minutes || 15
      bascule = minutesDeBascule(employeeScheduleRow.custom_bascule)
    } else if (employeeScheduleRow.schedule_id && employeeScheduleRow.work_schedules) {
      heureArrivee = employeeScheduleRow.work_schedules.start_time?.slice(0, 5) || null
      tolerance = employeeScheduleRow.work_schedules.late_tolerance_minutes || 15
      bascule = minutesDeBascule(employeeScheduleRow.work_schedules.bascule)
    }
  }

  if (!heureArrivee && defaultScheduleRow) {
    heureArrivee = defaultScheduleRow.start_time?.slice(0, 5) || null
    tolerance = defaultScheduleRow.late_tolerance_minutes || 15
    bascule = minutesDeBascule(defaultScheduleRow.bascule)
  }

  return { heureArrivee, tolerance, bascule }
}

// ═══════════════════════════════════════════════════════════
// VALORISATION (avec taux dynamiques)
// ═══════════════════════════════════════════════════════════

async function calculateValorization(employeeId, enterpriseId, monthData, currency) {
  try {
    const { data: profile } = await supabase
      .from('employee_payroll_profiles')
      .select('hourly_rate')
      .eq('employee_id', employeeId)
      .eq('enterprise_id', enterpriseId)
      .maybeSingle()

    const hourlyRate = profile?.hourly_rate ? Number(profile.hourly_rate) : null
    if (!hourlyRate || !Number.isFinite(hourlyRate) || hourlyRate <= 0) return null

    const normalHours = parseDurationToHours(monthData.normal)
    
    // ✅ Utiliser les taux réels
    const otNormalHours = monthData.overtime_normal 
      ? parseDurationToHours(monthData.overtime_normal.hours)
      : parseDurationToHours(monthData.overtime_25)
    
    const otMajorHours = monthData.overtime_major
      ? parseDurationToHours(monthData.overtime_major.hours)
      : parseDurationToHours(monthData.overtime_50)

    const rateNormal = monthData.overtime_normal?.rate || 25
    const rateMajor = monthData.overtime_major?.rate || 50

    const normalAmount = normalHours * hourlyRate
    const otNormalAmount = otNormalHours * hourlyRate * (1 + rateNormal / 100)
    const otMajorAmount = otMajorHours * hourlyRate * (1 + rateMajor / 100)

    return {
      normal: { 
        hours: monthData.normal, 
        rate: hourlyRate, 
        amount: Math.round(normalAmount) 
      },
      overtime_normal: { 
        hours: monthData.overtime_normal?.hours || monthData.overtime_25,
        rate: hourlyRate * (1 + rateNormal / 100), 
        ratePercent: rateNormal,
        amount: Math.round(otNormalAmount) 
      },
      overtime_major: { 
        hours: monthData.overtime_major?.hours || monthData.overtime_50,
        rate: hourlyRate * (1 + rateMajor / 100),
        ratePercent: rateMajor, 
        amount: Math.round(otMajorAmount) 
      },
      total_gross: Math.round(normalAmount + otNormalAmount + otMajorAmount),
      currency: currency || 'XAF',
    }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════
// ALERTES
// ═══════════════════════════════════════════════════════════

function generateAlerts({ today, month, year, hasPlan }) {
  const alerts = []

  if (today?.openSessionsCount > 0) {
    alerts.push({ type: 'warning', message: '⚠ 1 session ouverte (auto-close plafonné à 14h max)' })
  }

  if (month?.openSessionsCount > 0) {
    alerts.push({ type: 'warning', message: `${month.openSessionsCount} session(s) ouverte(s) sur la période (auto-close plafonné)` })
  }

  if (!hasPlan) {
    alerts.push({ type: 'info', message: 'Aucun planning configuré — attendu non calculé' })
  } else if (year?.delays?.count > 0) {
    alerts.push({ type: 'warning', message: `${year.delays.count} retard(s) cette année` })
  }

  if (month?.rate !== null && month?.rate !== undefined) {
    if (month.rate > 110) alerts.push({ type: 'warning', message: `Surcharge détectée : ${month.rate}% de la capacité` })
    if (month.rate < 70 && month.rate > 0) alerts.push({ type: 'warning', message: `Sous-utilisation : seulement ${month.rate}% de la capacité` })
    if (alerts.length === 0 && month.rate >= 90 && month.rate <= 105) alerts.push({ type: 'success', message: 'Performance optimale ce mois' })
  }

  return alerts
}

// ═══════════════════════════════════════════════════════════
// ABSENCES
// ═══════════════════════════════════════════════════════════

function buildAbsenceDaySet(absences, startDateStr, endDateStr) {
  const set = new Set()
  if (!absences?.length) return set

  const startBound = new Date(`${startDateStr}T00:00:00`)
  const endBound = new Date(`${endDateStr}T00:00:00`)

  for (const abs of absences) {
    const absStart = new Date(`${abs.start_date}T00:00:00`)
    const absEnd = new Date(`${abs.end_date}T00:00:00`)

    const start = absStart > startBound ? absStart : startBound
    const end = absEnd < endBound ? absEnd : endBound
    if (end < start) continue

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set.add(toDateKeyLocal(d))
    }
  }

  return set
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function getWeekPeriod(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    startDate: toDateKeyLocal(monday),
    endDate: toDateKeyLocal(sunday),
  }
}

function getMonthPeriod(date) {
  const d = new Date(date)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    startDate: toDateKeyLocal(start),
    endDate: toDateKeyLocal(end),
  }
}

function getYearPeriod(date) {
  const d = new Date(date)
  const start = new Date(d.getFullYear(), 0, 1)
  const end = new Date(d.getFullYear(), 11, 31)
  return {
    startDate: toDateKeyLocal(start),
    endDate: toDateKeyLocal(end),
  }
}

function toDateKeyLocal(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function listDaysInclusive(startDateStr, endDateStr) {
  const days = []
  const start = new Date(`${startDateStr}T00:00:00`)
  const end = new Date(`${endDateStr}T00:00:00`)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(toDateKeyLocal(d))
  }
  return days
}

function makeEmptyDaySummary(dateStr) {
  return {
    date: dateStr,
    totalSeconds: 0,
    firstInISO: null,
    lastOutISO: null,
    validPairsCount: 0,
    openSessionsCount: 0,
    hasAutoCloseVirtual: false,
    entries: [],
  }
}

function formatDurationSeconds(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  const hours = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  return `${hours}h${String(mins).padStart(2, '0')}`
}

function parseDurationToHours(durationStr) {
  if (!durationStr) return 0
  const match = String(durationStr).match(/(\d+)h(\d+)/)
  if (!match) return 0
  return (parseInt(match[1], 10) || 0) + (parseInt(match[2], 10) || 0) / 60
}

function formatDateShortFR(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function formatMonthYearFR(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function getPlanDayIndex(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`)
  const js = d.getDay()
  return js === 0 ? 7 : js
}

function timeToMinutes(t) {
  const s = String(t).slice(0, 5)
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌙 RÉSOLUTION D'UNE JOURNÉE DE POINTAGE (JOUR LOCAL + GARDE DE NUIT + ANTI-REBOND QR + AUTO-CLOSE)
// ═══════════════════════════════════════════════════════════════════════════
export function resoudrePointagesJournee(rawAttendances, selectedDate, options = {}) {
  const sorted = [...(rawAttendances || [])].sort(
    (a, b) => new Date(a.check_time) - new Date(b.check_time)
  )
  //  ⚙️ Même contrat que le moteur SQL : les seuils viennent de la base.
  //  (Arbitrage n°2, faille 1 : la page Pointages ne passait AUCUN seuil ici —
  //  le réglage `appariement_heures = 20` écrit en base n'était jamais lu, et
  //  `resoudrePointagesJournee` ne consultait même pas `enterpriseCfg.seuils`.)
  const s = options.seuils || options.enterpriseCfg?.seuils || SEUILS_PAR_DEFAUT
  const APPARIEMENT_H = H(s, 'appariementHeures')
  const REBOND_S = H(s, 'seuilRebondSecondes')
  //  R2 — règle « garde de nuit » (arbitrage n°2) : sortie avant 06:00 le
  //  lendemain → fin de la garde ouverte la veille, dans la limite GARDE_MAX_H.
  const GARDE_MAX_H = H(s, 'gardeMaxHeures')
  const OUBLI_H = H(s, 'oubliSortieHeures')
  //  Garde-fou « date future » : un badge ne peut pas se trouver dans le futur
  //  (marge de 10 min pour la dérive des horloges de boîtier). Le bouton « J+1 »
  //  de ModifierPointage a déjà envoyé une sortie au lendemain par erreur :
  //  la journée s'était nouée sur un instant qui n'était pas encore arrivé.
  const TOLERANCE_FUTUR_MS = 10 * 60 * 1000
  const maintenantMs = options.referenceNow ? new Date(options.referenceNow).getTime() : Date.now()

  let openIn = null
  let lastOpenIn = null
  let openDay = null
  let lastClosedOut = null
  let lastClosedDay = null

  //  Arbitrage n°3 — états qui ne doivent jamais disparaître silencieusement :
  let totalSecondesPresumes = 0   // durées d'estimations (non payées tant que non validées)
  let nuitRattachee = null        // fin de garde de nuit tombée sur CE jour (A6)
  let estimationEcartee = null    // estimation qu'un admin a écartée sur cette journée
  const nonRattachees = []        // sorties réelles impossibles à rattacher (A4)
  const horsCalcul = []           // estimations écartées/remplacées (audit, jamais comptées)

  const attendancesDuJour = []
  const validPairs = []
  let totalSecondes = 0

  for (const att of sorted) {
    const attTime = new Date(att.check_time)
    const attDateStr = jourLocal(att.check_time) || att.check_time.split('T')[0]
    const attMinutes = minutesDepuisMinuit(att.check_time)

    // ── LIGNE HORS CALCUL (estimation ÉCARTÉE ou REMPLACÉE) ──────────────
    //  Ces lignes restent en base pour l'audit et la mesure d'erreur, mais ce
    //  ne sont pas des badges : jamais appariées, jamais comptées. (Cas Mercia
    //  16/10 : une estimation écartée continuait de gonfler la journée.)
    if (estLigneHorsCalcul(att)) {
      horsCalcul.push(att)
      if (estEstimationEcartee(att)) {
        estimationEcartee = estimationEcartee || {
          heure: att.check_time,
          sourceId: att.estimation_source_id || null,
        }
      }
      if (attDateStr === selectedDate) {
        attendancesDuJour.push(att)
      }
      continue
    }

    // ── GARDE-FOU « DATE FUTURE » ────────────────────────────────────────
    //  Un pointage ne peut pas se trouver dans le futur. On l'affiche (pour que
    //  l'admin le voie et le corrige via Modifier) mais on ne l'apparie jamais :
    //  sinon la journée se noue sur un instant qui n'est pas encore arrivé
    //  (cas Hippo 16/10 : entrée 10:57 appariée à une sortie « datée » du 17 →
    //  14h15 de service inventées + 2 fausses alertes).
    if (attTime.getTime() > maintenantMs + TOLERANCE_FUTUR_MS) {
      if (attDateStr === selectedDate) {
        attendancesDuJour.push({ ...att, __futur: true })
      }
      continue
    }

    if (att.check_type === 'in') {
      if (openIn) {
        const diffHoursFromOpen = (attTime - new Date(openIn.check_time)) / (1000 * 60 * 60)
        const isConsecutiveInSameShift =
          diffHoursFromOpen >= 0 &&
          diffHoursFromOpen <= APPARIEMENT_H &&
          (attDateStr === openDay || (attDateStr > openDay && attMinutes < 360))

        if (isConsecutiveInSameShift) {
          lastOpenIn = att
          if (openDay === selectedDate) {
            attendancesDuJour.push(att)
          }
          continue
        }
      }

      if (!openIn && lastClosedOut && lastClosedDay === selectedDate && attDateStr > selectedDate && attMinutes < 360) {
        const diffSinceLastOut = (attTime - new Date(lastClosedOut.check_time)) / (1000 * 60 * 60)
        if (diffSinceLastOut >= 0 && diffSinceLastOut < 8) {
          openIn = att
          lastOpenIn = att
          openDay = selectedDate
          attendancesDuJour.push(att)
          continue
        }
      }

      openIn = att
      lastOpenIn = att
      openDay = attDateStr
      if (openDay === selectedDate) {
        attendancesDuJour.push(att)
      }
    } else if (att.check_type === 'out') {
      if (openIn) {
        const diffSecondsFromFirst = (attTime - new Date(openIn.check_time)) / 1000
        const diffFromFirst = diffSecondsFromFirst / 3600
        const diffFromLast = lastOpenIn
          ? (attTime - new Date(lastOpenIn.check_time)) / (1000 * 60 * 60)
          : diffFromFirst

        // Anti-rebond QR Code (< 60s) : un OUT enregistré à moins de 60s de l'IN (ex: 06:32:20 -> 06:32:32)
        // est un double scan accidentel. On le conserve dans attendancesDuJour pour l'audit/modal Modifier,
        // mais il ne ferme PAS la session ouverte !
        if (diffSecondsFromFirst >= 0 && diffSecondsFromFirst < REBOND_S && !att.is_auto_closed && !att.modifie_le) {
          if (openDay === selectedDate) {
            attendancesDuJour.push(att)
          }
          continue
        }

        //  R1 : tolérance d'appariement normale. R2 (arbitrage n°2) : une sortie
        //  avant 06:00 dans les GARDE_MAX_H après une entrée ouverte est la fin
        //  de la garde de la veille — deux VRAIS badges ne se perdent plus.
        const matchedIn =
          diffFromFirst >= 0 && diffFromFirst <= APPARIEMENT_H
            ? openIn
            : diffFromLast >= 0 && diffFromLast <= APPARIEMENT_H
              ? lastOpenIn
              : attMinutes < 360 && diffFromFirst > APPARIEMENT_H && diffFromFirst <= GARDE_MAX_H
                ? openIn
                : attMinutes < 360 && diffFromLast > APPARIEMENT_H && diffFromLast <= GARDE_MAX_H
                  ? lastOpenIn
                  : null

        if (matchedIn) {
          const payable = !att.is_auto_closed || !!att.estimation_validee_le
          if (openDay === selectedDate) {
            attendancesDuJour.push(att)
            const duree = calculerDureeSecondes(matchedIn.check_time, att.check_time)
            //  Une estimation non validée ne gonfle JAMAIS la durée travaillée
            //  (décision « on invente, on marque, on n'encaisse pas ») : elle
            //  est comptée à part, en attendant la décision humaine.
            if (payable) totalSecondes += duree
            else totalSecondesPresumes += duree
            validPairs.push({ in: matchedIn, out: att })
          } else if (attDateStr === selectedDate && openDay && openDay < selectedDate) {
            //  A6 — la garde de la veille s'est terminée dans la nuit de CE jour :
            //  l'écran affichera « Fin de garde de nuit » au lieu de « Absent ».
            nuitRattachee = {
              heure: att.check_time,
              jourOrigine: openDay,
              dureeSecondes: calculerDureeSecondes(matchedIn.check_time, att.check_time),
            }
          }
          lastClosedOut = att
          lastClosedDay = openDay
          openIn = null
          lastOpenIn = null
          openDay = null
          continue
        } else {
          //  A4 — NE JAMAIS effacer la session ouverte ici (arbitrage n°2,
          //  faille 4). Avant, ce bloc vidait `openIn` : la journée n'était ni
          //  fermée par le badge ni par l'estimation → « 0 sec » à vie. La
          //  sortie devient « non rattachée » (visible, corrigeable en 1 clic)
          //  et la session reste ouverte pour l'auto-clôture/estimation.
          nonRattachees.push(att)
          if (attDateStr === selectedDate) {
            attendancesDuJour.push({ ...att, __nonRattachee: true })
          }
          continue
        }
      }

      if (lastClosedOut && (attTime - new Date(lastClosedOut.check_time)) / (1000 * 60 * 60) <= 4 && attMinutes < 360) {
        if (lastClosedDay === selectedDate) {
          attendancesDuJour.push(att)
        }
      } else if (attDateStr === selectedDate) {
        attendancesDuJour.push(att)
      }
    }
  }

  // Gestion des sessions restées ouvertes sur `selectedDate` (Oubli de dépointage vs Session en cours)
  if (openIn && openDay === selectedDate && options?.enableAutoClose) {
    const now = options.referenceNow ? new Date(options.referenceNow) : new Date()
    const nowDayStr = jourLocal(now) || now.toISOString().split('T')[0]
    const inDate = new Date(openIn.check_time)
    const elapsedHours = (now - inDate) / (1000 * 60 * 60)
    const inMinutes = minutesDepuisMinuit(openIn.check_time)

    // Oubli de dépointage avéré :
    // - soit plus de `oubliSortieHeures` se sont écoulées sans sortie (jour ou nuit),
    // - soit la journée est passée (selectedDate < nowDayStr) et l'entrée était un service de jour (< 16:00).
    // (Si l'employé est entré à 22:00 la veille et qu'il est 02:00 du matin, elapsed < oubli et inMinutes >= 960 :
    //  sa garde de nuit est toujours en cours, on ne la coupe pas !)
    const estOubliSortie =
      elapsedHours >= OUBLI_H || (selectedDate < nowDayStr && inMinutes < 960 && elapsedHours >= 4)

    //  Ne JAMAIS ré-inventer une sortie sur une session dont l'estimation a déjà
    //  été ÉCARTÉE par un admin : il a dit « cette heure est fausse ». On montre
    //  la journée comme non fermée, on ne redevine pas à l'identique.
    const estimationDejaTraitee = horsCalcul.some(
      (a) => (a.estimation_source_id && a.estimation_source_id === openIn.id) ||
        (!a.estimation_source_id && estEstimationEcartee(a) && a.check_type === 'out')
    )

    if (estOubliSortie && !estimationDejaTraitee) {
      const resolvedPlan =
        options.plan ||
        resolvePlanForExpected(options.employeeSchedule || null, options.defaultSchedule || null)

      const virtualOutDate = calculerSortieAutoClose(openIn, {
        plan: resolvedPlan,
        enterpriseCfg: options.enterpriseCfg || null,
        referenceNow: now,
      })

      if (virtualOutDate > inDate) {
        const virtualOut = {
          id: `virtual-out-${openIn.id}`,
          estimation_niveau: virtualOutDate.autoCloseNiveau,
          employee_id: openIn.employee_id,
          enterprise_id: openIn.enterprise_id,
          check_time: virtualOutDate.toISOString(),
          check_type: 'out',
          is_auto_closed: true,
          __virtual: true,
        }
        //  Durée INVENTÉE = jamais dans le total « travaillé » (décision §4.1) :
        //  comptée dans `totalSecondesPresumes`, affichée à part, non payée.
        totalSecondesPresumes += calculerDureeSecondes(openIn.check_time, virtualOut.check_time)
        validPairs.push({ in: openIn, out: virtualOut })
        openIn = null
        lastOpenIn = null
        openDay = null
      }
    }
  }

  let firstIn = validPairs.length > 0 ? validPairs[0].in : null
  // Si une nouvelle session est actuellement ouverte sur selectedDate (openIn non clôturé),
  // l'employé est actuellement en service : lastOut reste null (--:--:--) au lieu d'afficher une sortie passée.
  let lastOut =
    openIn && openDay === selectedDate
      ? null
      : validPairs.length > 0
        ? validPairs[validPairs.length - 1].out
        : null

  if (!firstIn && openIn && openDay === selectedDate) {
    firstIn = openIn
  }
  if (!firstIn) {
    firstIn = attendancesDuJour.find(a => a.check_type === 'in') || null
  }

  return {
    attendances: attendancesDuJour,
    validPairs,
    totalSecondes,
    totalSecondesPresumes,
    nuitRattachee,
    estimationEcartee,
    nonRattachees,
    firstIn,
    lastOut,
  }
}

export function compterRetardsDuJour(
  retardEntries = [],
  employeeSchedulesData = [],
  defaultSchedulesData = [],
  todayStr = null
) {
  const empSchedulesMap = {}
  ;(employeeSchedulesData || []).forEach(es => {
    if (es && es.employee_id && es.is_active !== false) {
      empSchedulesMap[es.employee_id] = es
    }
  })

  const defaultByEnterprise = {}
  ;(defaultSchedulesData || []).forEach(ws => {
    if (ws && ws.enterprise_id && ws.is_active !== false && !defaultByEnterprise[ws.enterprise_id]) {
      defaultByEnterprise[ws.enterprise_id] = ws
    }
  })

  const firstInByEmployee = new Map()
  const sorted = [...(retardEntries || [])].sort(
    (a, b) => new Date(a.check_time) - new Date(b.check_time)
  )

  for (const att of sorted) {
    if (!att || !att.employee_id) continue
    if (todayStr) {
      const attDate = jourLocal(att.check_time) || att.check_time.split('T')[0]
      if (attDate !== todayStr) continue
    }
    const mins = minutesDepuisMinuit(att.check_time)
    if (mins < 300) continue
    if (!firstInByEmployee.has(att.employee_id)) {
      firstInByEmployee.set(att.employee_id, att)
    }
  }

  let count = 0
  for (const [empId, att] of firstInByEmployee.entries()) {
    const schedulePerso = empSchedulesMap[empId]
    const defaultSchedule =
      (att.enterprise_id && defaultByEnterprise[att.enterprise_id]) ||
      defaultSchedulesData?.[0] ||
      null

    let heureArrivee = '08:00'
    let tolerance = 15

    if (schedulePerso) {
      if (schedulePerso.use_custom_hours && schedulePerso.custom_start_time) {
        heureArrivee = schedulePerso.custom_start_time.slice(0, 5)
        tolerance =
          schedulePerso.custom_late_tolerance_minutes ||
          defaultSchedule?.late_tolerance_minutes ||
          15
      } else if (schedulePerso.schedule_id && schedulePerso.work_schedules?.start_time) {
        heureArrivee = schedulePerso.work_schedules.start_time.slice(0, 5)
        tolerance = schedulePerso.work_schedules.late_tolerance_minutes || 15
      } else if (defaultSchedule?.start_time) {
        heureArrivee = defaultSchedule.start_time.slice(0, 5)
        tolerance = defaultSchedule.late_tolerance_minutes || 15
      }
    } else if (defaultSchedule?.start_time) {
      heureArrivee = defaultSchedule.start_time.slice(0, 5)
      tolerance = defaultSchedule.late_tolerance_minutes || 15
    }

    const [hA, mA] = heureArrivee.split(':').map(Number)
    const seuilRetard = (hA || 0) * 60 + (mA || 0) + (Number(tolerance) || 15)
    if (minutesDepuisMinuit(att.check_time) > seuilRetard) {
      count += 1
    }
  }

  return count
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 EXPORTS POUR TESTS UNITAIRES (VD-15 — Gardien des fondations)
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI : La règle 4.4 de la Roadmap technique v1.1 et la règle 5.2 n°2
// du Cap CEO v2.1 imposent de couvrir à ≥ 80 % toutes les branches de calcul
// (chevauchement de nuit, bascule, jour férié, pause, heures sup et
// majorations, grilles horaires multi-versions) sans dépendre de la base de
// production.
export const __internal = {
  buildDaySummariesStrict,
  computeDayStrict,
  computeVirtualAutoCloseOut,
  calculerSortieAutoClose,
  minutesDeBascule,
  cleJourDeTravail,
  grilleValableLe,
  choisirGrilleParDefaut,
  construirePlanningsParJour,
  computeExpectedForRange,
  computeExpectedForDay,
  resolvePlanForExpected,
  computeRetardsAlignedRetardsJSX,
  resolveScheduleLikeRetards,
  buildAbsenceDaySet,
  formatDurationSeconds,
  parseDurationToHours,
  getPlanDayIndex,
  timeToMinutes,
  resoudrePointagesJournee,
  compterRetardsDuJour,
}
