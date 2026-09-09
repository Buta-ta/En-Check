// ═══════════════════════════════════════════════════════════
// 🧮 CALCULATEUR DE DÉCLENCHEURS D'ANIMATIONS - latest_event_at
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
const toMillis = (v) => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

const maxIsoFrom = (values) => {
  let max = null
  for (const v of values) {
    const t = toMillis(v)
    if (t !== null && (max === null || t > max)) max = t
  }
  return max === null ? null : new Date(max).toISOString()
}

const maxIsoFromRows = (rows, pickFn) => {
  if (!rows || rows.length === 0) return null
  return maxIsoFrom(rows.map(pickFn).filter(Boolean))
}

const isoMidnightUTC = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return null
  return new Date(`${yyyy_mm_dd}T00:00:00.000Z`).toISOString()
}

/**
 * Calcule les déclencheurs pour l'onglet EMPLOYÉS
 */
export const calculateEmployeesTriggers = async (enterpriseId, lastCheck) => {
  try {
    // Essayer d'abord la fonction RPC optimisée
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_employees_triggers', {
      p_enterprise_id: enterpriseId,
      p_last_check: lastCheck
    })

    // Même si RPC marche, on a besoin d'un latest_event_at fiable
    // -> on récupère le dernier updated_at/created_at
    const { data: latestEmpRow } = await supabase
      .from('employees')
      .select('updated_at, created_at')
      .eq('enterprise_id', enterpriseId)
      .order('updated_at', { ascending: false })
      .limit(1)

    const latest_event_at =
      latestEmpRow?.[0]?.updated_at ||
      latestEmpRow?.[0]?.created_at ||
      null

    if (!rpcError && rpcData) {
      return {
        ...rpcData,
        latest_event_at: latest_event_at ? new Date(latest_event_at).toISOString() : null,
      }
    }

    // Fallback : Requête standard
    console.log('⚠️ Fonction RPC inexistante, utilisation du fallback')

    const { data: employees } = await supabase
      .from('employees')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)

    if (!employees) {
      return { latest_event_at: null }
    }

    const now = new Date()
    const yesterday = new Date(now - 24 * 60 * 60 * 1000)

    const triggers = {
      new_employees: employees.filter(e => new Date(e.created_at) > yesterday).length,
      without_photo: employees.filter(e => !e.photo_url).length,
      without_matricule: employees.filter(e => !e.matricule || e.matricule === '').length,
      birthdays: employees.filter(e => {
        if (!e.date_of_birth) return false
        const dob = new Date(e.date_of_birth)
        return dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate()
      }).length,
      expiring_contracts: employees.filter(e => {
        if (!e.contract_end_date) return false
        const endDate = new Date(e.contract_end_date)
        const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
        return diffDays >= 0 && diffDays <= 30
      }).length,
      portal_disabled: employees.filter(e => !e.employee_portal_enabled).length,

      // Dernier événement "employés" : dernière modification d’un employé
      latest_event_at: maxIsoFromRows(employees, (e) => e.updated_at || e.created_at),
    }

    return triggers
  } catch (error) {
    console.error('Erreur calcul triggers employés:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet POINTAGES
 */
export const calculateAttendancesTriggers = async (enterpriseId, lastCheck) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const startOfDay = `${today}T00:00:00Z`
    const endOfDay = `${today}T23:59:59Z`

    const { data: todayAttendances } = await supabase
      .from('attendances')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .gte('check_time', startOfDay)
      .lte('check_time', endOfDay)

    if (!todayAttendances) {
      return { latest_event_at: null }
    }

    const newAttendances = todayAttendances.filter(a =>
      new Date(a.created_at) > new Date(lastCheck)
    )

    const newLates = newAttendances.filter(a => {
      if (a.check_type !== 'in') return false
      const time = new Date(a.check_time).toTimeString().split(' ')[0]
      return time > '08:15:00'
    })

    const triggers = {
      new_attendances: newAttendances.length,
      new_ins: newAttendances.filter(a => a.check_type === 'in').length,
      new_outs: newAttendances.filter(a => a.check_type === 'out').length,
      new_lates: newLates.length,
      auto_closed: todayAttendances.filter(a => a.is_auto_closed).length,
      outside_zone: todayAttendances.filter(a => a.is_within_zone === false).length,
      no_photo: todayAttendances.filter(a =>
        a.method?.includes('face') && !a.face_verified
      ).length,
      low_quality: todayAttendances.filter(a =>
        a.face_score && a.face_score < 0.7
      ).length,

      // Dernier événement "pointages" : dernier pointage inséré (du jour)
      latest_event_at: maxIsoFromRows(todayAttendances, (a) => a.created_at || a.check_time),
    }

    return triggers
  } catch (error) {
    console.error('Erreur calcul triggers pointages:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet ABSENCES
 */
export const calculateAbsencesTriggers = async (enterpriseId, lastCheck) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Demandes de congé
    const { data: leaveRequests } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('status', 'en_attente')

    const newRequests = leaveRequests?.filter(lr =>
      new Date(lr.created_at) > new Date(lastCheck)
    ).length || 0

    const urgentRequests = leaveRequests?.filter(lr => {
      const startDate = new Date(lr.start_date)
      const diffDays = Math.ceil((startDate - new Date()) / (1000 * 60 * 60 * 24))
      return diffDays < 2 && diffDays >= 0
    }).length || 0

    // Documents manquants
    const { data: absences } = await supabase
      .from('absences')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('reason', 'maladie')
      .is('document_url', null)

    const missingDocuments = absences?.filter(a => {
      const start = new Date(a.start_date)
      const end = new Date(a.end_date)
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      return diffDays >= 3
    }).length || 0

    // Absences en cours
    const { data: activeAbsences } = await supabase
      .from('absences')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .lte('start_date', today)
      .gte('end_date', today)

    // Conflits
    const { data: conflicts } = await supabase
      .from('attendance_conflicts')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('status', 'pending')

    const latest_event_at = maxIsoFrom([
      maxIsoFromRows(leaveRequests || [], (x) => x.updated_at || x.created_at),
      maxIsoFromRows(absences || [], (x) => x.updated_at || x.created_at),
      maxIsoFromRows(activeAbsences || [], (x) => x.updated_at || x.created_at),
      maxIsoFromRows(conflicts || [], (x) => x.created_at),
    ])

    return {
      new_requests: newRequests,
      urgent_requests: urgentRequests,
      missing_documents: missingDocuments,
      active_absences: activeAbsences?.length || 0,
      conflicts: conflicts?.length || 0,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers absences:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet TÂCHES
 */
export const calculateTasksTriggers = async (enterpriseId, lastCheck) => {
  try {
    const now = new Date()
    const oneHourAgo = new Date(now - 60 * 60 * 1000)
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const today = now.toISOString().split('T')[0]

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .is('deleted_at', null)

    if (!tasks) {
      return { latest_event_at: null }
    }

    const triggers = {
      new_tasks: tasks.filter(t => new Date(t.created_at) > oneHourAgo).length,
      overdue_tasks: tasks.filter(t =>
        t.due_at &&
        new Date(t.due_at) < now &&
        !['completed', 'validated', 'cancelled'].includes(t.status)
      ).length,
      due_today: tasks.filter(t =>
        t.due_at &&
        t.due_at.split('T')[0] === today &&
        ['assigned', 'in_progress'].includes(t.status)
      ).length,
      unassigned_tasks: tasks.filter(t =>
        new Date(t.created_at) > oneDayAgo &&
        !t.assigned_employee_id &&
        !t.team_id
      ).length,
      newly_completed: tasks.filter(t =>
        t.completed_at &&
        new Date(t.completed_at) > new Date(lastCheck)
      ).length,
      urgent_tasks: tasks.filter(t =>
        t.priority === 'urgent' &&
        t.status === 'assigned'
      ).length
    }

    // Équipes
    const { data: teams } = await supabase
      .from('teams')
      .select(`
        *,
        team_members (count)
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)

    triggers.teams_without_leader = teams?.filter(t => !t.leader_employee_id).length || 0
    triggers.empty_teams = teams?.filter(t => {
      const memberCount = t.team_members?.[0]?.count || 0
      return memberCount === 0
    }).length || 0

    // latest_event_at: dernière mise à jour d'une tâche ou d'une équipe
    const latest_event_at = maxIsoFrom([
      maxIsoFromRows(tasks, (t) => t.updated_at || t.completed_at || t.created_at),
      maxIsoFromRows(teams || [], (t) => t.updated_at || t.created_at),
    ])

    return { ...triggers, latest_event_at }
  } catch (error) {
    console.error('Erreur calcul triggers tâches:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet GEOFENCING
 */
export const calculateGeofencingTriggers = async (enterpriseId, lastCheck) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const startOfDay = `${today}T00:00:00Z`
    const endOfDay = `${today}T23:59:59Z`

    const { data: todayAttendances } = await supabase
      .from('attendances')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .gte('check_time', startOfDay)
      .lte('check_time', endOfDay)

    const newOutsideZone = todayAttendances?.filter(a =>
      a.is_within_zone === false &&
      new Date(a.created_at) > new Date(lastCheck)
    ).length || 0

    const gpsDisabled = todayAttendances?.filter(a =>
      !a.location_lat || !a.location_lng
    ).length || 0

    const lowAccuracy = todayAttendances?.filter(a =>
      a.gps_accuracy && a.gps_accuracy > 50
    ).length || 0

    // Vérifier si des zones sont définies
    const { data: geofences } = await supabase
      .from('geofences')
      .select('id, updated_at, created_at')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)

    const no_geofences = (geofences?.length === 0) ? 1 : 0

    // latest_event_at:
    // - si on a des événements GPS/zone: max created_at des pointages concernés
    // - si no_geofences (config) : on met "midnight du jour" pour pouvoir animer 1x/jour max,
    //   et surtout stopper après clic (lastSeenAt > midnight).
    const latestFromAttendances = maxIsoFromRows(
      (todayAttendances || []).filter(a =>
        a.is_within_zone === false ||
        (!a.location_lat || !a.location_lng) ||
        (a.gps_accuracy && a.gps_accuracy > 50)
      ),
      (a) => a.created_at || a.check_time
    )

    const latestFromGeofences = maxIsoFromRows(geofences || [], (g) => g.updated_at || g.created_at)

    const latest_event_at =
      latestFromAttendances ||
      (no_geofences ? isoMidnightUTC(today) : null) ||
      latestFromGeofences ||
      null

    return {
      outside_zone: newOutsideZone,
      no_geofences,
      gps_disabled: gpsDisabled,
      low_accuracy: lowAccuracy,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers geofencing:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet RETARDS
 */
export const calculateRetardsTriggers = async (enterpriseId, lastCheck) => {
  try {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Lundi

    const todayStr = today.toISOString().split('T')[0]
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0]

    // Nouveaux retards (depuis lastCheck)
    const { data: newLatesData } = await supabase
      .from('attendances')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('check_type', 'in')
      .gte('created_at', lastCheck)

    const lateNewRows = (newLatesData || []).filter(att => {
      const time = new Date(att.check_time).toTimeString().split(' ')[0]
      return time > '08:15:00'
    })

    const new_lates = lateNewRows.length

    // Retards de la semaine
    const { data: weekLatesData } = await supabase
      .from('attendances')
      .select('employee_id, check_time, created_at')
      .eq('enterprise_id', enterpriseId)
      .eq('check_type', 'in')
      .gte('check_time', `${startOfWeekStr}T00:00:00Z`)

    const weekLateRows = (weekLatesData || []).filter(att => {
      const time = new Date(att.check_time).toTimeString().split(' ')[0]
      return time > '08:15:00'
    })

    const latesByEmployee = {}
    weekLateRows.forEach(l => {
      latesByEmployee[l.employee_id] = (latesByEmployee[l.employee_id] || 0) + 1
    })
    const repeated_lates = Object.values(latesByEmployee).filter(count => count >= 3).length

    // Retards excessifs (> 1h = > 09:15)
    const { data: excessiveLatesData } = await supabase
      .from('attendances')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('check_type', 'in')
      .gte('check_time', `${todayStr}T00:00:00Z`)
      .lte('check_time', `${todayStr}T23:59:59Z`)

    const excessiveRows = (excessiveLatesData || []).filter(att => {
      const time = new Date(att.check_time).toTimeString().split(' ')[0]
      return time > '09:15:00'
    })

    const excessive_lates = excessiveRows.length

    const latest_event_at = maxIsoFrom([
      maxIsoFromRows(lateNewRows, (a) => a.created_at || a.check_time),
      maxIsoFromRows(weekLateRows, (a) => a.created_at || a.check_time),
      maxIsoFromRows(excessiveRows, (a) => a.created_at || a.check_time),
    ])

    return {
      new_lates,
      repeated_lates,
      excessive_lates,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers retards:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet HEURES SUP
 */
export const calculateOvertimeTriggers = async (enterpriseId, lastCheck) => {
  try {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const todayStr = now.toISOString().split('T')[0]

    // Nouvelles heures sup
    const { data: newOvertime } = await supabase
      .from('heures_supplementaires')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .gte('created_at', lastCheck)

    // Heures sup du mois (ajout created_at pour latest_event_at)
    const { data: monthOvertime } = await supabase
      .from('heures_supplementaires')
      .select('employee_id, heures_sup_25, heures_sup_50, heures_sup_100, created_at')
      .eq('enterprise_id', enterpriseId)
      .eq('mois', currentMonth)
      .eq('annee', currentYear)

    const overtimeByEmployee = {}
    monthOvertime?.forEach(o => {
      if (!overtimeByEmployee[o.employee_id]) overtimeByEmployee[o.employee_id] = 0
      overtimeByEmployee[o.employee_id] +=
        (parseFloat(o.heures_sup_25) || 0) +
        (parseFloat(o.heures_sup_50) || 0) +
        (parseFloat(o.heures_sup_100) || 0)
    })
    const threshold_exceeded = Object.values(overtimeByEmployee).filter(h => h > 35).length

    // Heures sup aujourd'hui
    const { data: todayOvertime } = await supabase
      .from('heures_supplementaires')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('date', todayStr)

    // Majorations 100%
    const { data: rate100 } = await supabase
      .from('heures_supplementaires')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('mois', currentMonth)
      .eq('annee', currentYear)
      .gt('heures_sup_100', 0)

    const latest_event_at = maxIsoFrom([
      maxIsoFromRows(newOvertime || [], (x) => x.created_at),
      maxIsoFromRows(monthOvertime || [], (x) => x.created_at),
      maxIsoFromRows(todayOvertime || [], (x) => x.created_at),
      maxIsoFromRows(rate100 || [], (x) => x.created_at),
    ])

    return {
      new_overtime: newOvertime?.length || 0,
      threshold_exceeded,
      overtime_today: todayOvertime?.length || 0,
      rate_100: rate100?.length || 0,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers heures sup:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet FICHES DE PAIE
 */
export const calculatePayrollTriggers = async (enterpriseId) => {
  try {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const lastMonthNum = lastMonth.getMonth() + 1
    const lastMonthYear = lastMonth.getFullYear()

    const { count: totalEmployees } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)

    // Vérifier si la table payroll_runs existe
    let payrollRuns = []
    try {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('id, pay_period_end')
        .eq('enterprise_id', enterpriseId)

      if (error) throw error
      payrollRuns = data || []
    } catch (err) {
      console.warn('⚠️ Table payroll_runs inexistante ou inaccessible')
      return {
        missing_slips: 0,
        no_pdf: 0,
        zero_salary: 0,
        latest_event_at: null,
      }
    }

    const lastMonthRuns = payrollRuns.filter(pr => {
      const endDate = new Date(pr.pay_period_end)
      return endDate.getMonth() + 1 === lastMonthNum && endDate.getFullYear() === lastMonthYear
    })

    if (!lastMonthRuns || lastMonthRuns.length === 0) {
      // Pas de run => pas de “nouvel événement” exploitable => on n’anime pas
      return {
        missing_slips: totalEmployees || 0,
        no_pdf: 0,
        zero_salary: 0,
        latest_event_at: null,
      }
    }

    const runIds = lastMonthRuns.map(r => r.id)

    const { data: slips } = await supabase
      .from('payroll_slips')
      .select('*')
      .in('payroll_run_id', runIds)

    const missing_slips = Math.max((totalEmployees || 0) - (slips?.length || 0), 0)
    const no_pdf = slips?.filter(s => !s.pdf_url).length || 0
    const zero_salary = slips?.filter(s => parseFloat(s.net_salary) === 0).length || 0

    const latest_event_at = maxIsoFromRows(slips || [], (s) => s.generated_at)

    return {
      missing_slips,
      no_pdf,
      zero_salary,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers fiches paie:', error)
    return {
      missing_slips: 0,
      no_pdf: 0,
      zero_salary: 0,
      latest_event_at: null,
    }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet PLANNING
 */
export const calculatePlanningTriggers = async (enterpriseId, lastCheck) => {
  try {
    // Employés sans horaire (count)
    const { count: withoutSchedule } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('schedule_id', null)

    // Dernier employé sans schedule (pour latest_event_at)
    const { data: latestEmpNoSchedule } = await supabase
      .from('employees')
      .select('updated_at, created_at')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('schedule_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    // Horaires modifiés récemment
    const { data: modifiedSchedules } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    // Demandes de modification (si table existe)
    let scheduleRequests = 0
    let scheduleRequestsData = []
    try {
      const { data: requests, error } = await supabase
        .from('schedule_change_requests')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('status', 'pending')

      if (!error) {
        scheduleRequestsData = requests || []
        scheduleRequests = scheduleRequestsData.length
      }
    } catch (e) {
      console.warn('⚠️ Table schedule_change_requests inexistante')
    }

    const latest_event_at = maxIsoFrom([
      latestEmpNoSchedule?.[0]?.updated_at || latestEmpNoSchedule?.[0]?.created_at || null,
      maxIsoFromRows(modifiedSchedules || [], (s) => s.updated_at || s.created_at),
      maxIsoFromRows(scheduleRequestsData || [], (r) => r.updated_at || r.created_at),
    ])

    return {
      without_schedule: withoutSchedule || 0,
      schedule_modified: modifiedSchedules?.length || 0,
      schedule_requests: scheduleRequests,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers planning:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet PRÉDICTIONS
 */
export const calculatePredictionsTriggers = async (enterpriseId, lastCheck) => {
  try {
    const now = new Date().toISOString()

    const { data: predictions } = await supabase
      .from('task_predictions')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('is_dismissed', false)
      .gt('valid_until', now)

    const critical_predictions = predictions?.filter(p => p.severity === 'critical').length || 0
    const warning_predictions = predictions?.filter(p => p.severity === 'warning').length || 0
    const new_predictions = predictions?.filter(p =>
      new Date(p.calculated_at) > new Date(lastCheck)
    ).length || 0

    const latest_event_at = maxIsoFromRows(predictions || [], (p) => p.calculated_at)

    return {
      critical_predictions,
      warning_predictions,
      new_predictions,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers prédictions:', error)
    return { latest_event_at: null }
  }
}

/**
 * Calcule les déclencheurs pour l'onglet JOURS FÉRIÉS
 */
export const calculateHolidaysTriggers = async (enterpriseId) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('*')
      .or(`enterprise_id.eq.${enterpriseId},enterprise_id.is.null`)
      .in('date', [today, tomorrowStr])

    const today_holiday = holidays?.filter(h => h.date === today).length || 0
    const tomorrow_holiday = holidays?.filter(h => h.date === tomorrowStr).length || 0

    // Pour “animer une fois puis stop au clic”, on utilise minuit du jour concerné
    const latest_event_at =
      today_holiday > 0 ? isoMidnightUTC(today)
      : (tomorrow_holiday > 0 ? isoMidnightUTC(tomorrowStr) : null)

    return {
      today_holiday,
      tomorrow_holiday,
      latest_event_at,
    }
  } catch (error) {
    console.error('Erreur calcul triggers jours fériés:', error)
    return { latest_event_at: null }
  }
}

/**
 * Fonction principale : Calcule TOUS les déclencheurs
 */
export const calculateAllTriggers = async (enterpriseId, admin) => {
  if (!enterpriseId || !admin) {
    console.warn('⚠️ calculateAllTriggers: enterpriseId ou admin manquant')
    return {}
  }

  const lastCheck = localStorage.getItem(`last_triggers_check_${admin.id}`) ||
    new Date(Date.now() - 5 * 60 * 1000).toISOString()

  console.log(`📊 Calcul des triggers pour entreprise ${enterpriseId}`)

  const results = await Promise.allSettled([
    calculateEmployeesTriggers(enterpriseId, lastCheck),
    calculateAttendancesTriggers(enterpriseId, lastCheck),
    calculateAbsencesTriggers(enterpriseId, lastCheck),
    calculateTasksTriggers(enterpriseId, lastCheck),
    calculateGeofencingTriggers(enterpriseId, lastCheck),
    calculateRetardsTriggers(enterpriseId, lastCheck),
    calculateOvertimeTriggers(enterpriseId, lastCheck),
    calculatePayrollTriggers(enterpriseId),
    calculatePlanningTriggers(enterpriseId, lastCheck),
    calculatePredictionsTriggers(enterpriseId, lastCheck),
    calculateHolidaysTriggers(enterpriseId)
  ])

  const [
    employees,
    attendances,
    absences,
    tasks,
    geofencing,
    retards,
    overtime,
    payroll,
    planning,
    predictions,
    holidays
  ] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value || {}
    } else {
      const labels = [
        'EMPLOYES', 'POINTAGES', 'ABSENCES', 'TACHES', 'GEOFENCING',
        'RETARDS', 'HEURES_SUP', 'FICHES_PAIE', 'PLANNING', 'PREDICTIONS', 'JOURS_FERIES'
      ]
      console.warn(`⚠️ Erreur calcul ${labels[index]}:`, result.reason)
      return { latest_event_at: null }
    }
  })

  localStorage.setItem(`last_triggers_check_${admin.id}`, new Date().toISOString())

  return {
    EMPLOYES: employees,
    POINTAGES: attendances,
    ABSENCES: absences,
    TACHES: tasks,
    GEOFENCING: geofencing,
    RETARDS: retards,
    HEURES_SUP: overtime,
    FICHES_PAIE: payroll,
    PLANNING: planning,
    PREDICTIONS: predictions,
    JOURS_FERIES: holidays,
    lastCheck: new Date().toISOString(),
  }
}

export default {
  calculateAllTriggers,
  calculateEmployeesTriggers,
  calculateAttendancesTriggers,
  calculateAbsencesTriggers,
  calculateTasksTriggers,
  calculateGeofencingTriggers,
  calculateRetardsTriggers,
  calculateOvertimeTriggers,
  calculatePayrollTriggers,
  calculatePlanningTriggers,
  calculatePredictionsTriggers,
  calculateHolidaysTriggers
}