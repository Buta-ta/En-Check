import { supabase } from '../lib/supabase'
import { TASK_STATUS } from './taskService'

// ═══════════════════════════════════════════════════════════
// 🔮 SERVICE PRÉDICTIONS - V1 STATISTIQUE
// Charge, durées, absences, besoins
// ═══════════════════════════════════════════════════════════

const ACTIVE_TASK_STATUSES = ['assigned', 'seen', 'in_progress', 'paused', 'rejected']
const COMPLETED_TASK_STATUSES = ['completed', 'validated']


// Fonction pour formater les heures en format lisible
function formatHoursToReadable(hours) {
  if (hours == null || isNaN(hours) || hours <= 0) return '0 min'

  const totalMinutes = Math.round(hours * 60)

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}


function round(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) return 0
  const factor = 10 ** decimals
  return Math.round(Number(value) * factor) / factor
}

function avg(arr) {
  if (!arr?.length) return 0
  return arr.reduce((sum, n) => sum + Number(n || 0), 0) / arr.length
}

function toMinutesFromSeconds(seconds) {
  return round((Number(seconds || 0) / 60), 2)
}

function severityFromRatio(ratio) {
  if (ratio >= 1.4) return 'critical'
  if (ratio >= 1.1) return 'warning'
  return 'info'
}

function workloadSeverity(hours) {
  if (hours >= 8) return 'critical'
  if (hours >= 6) return 'warning'
  return 'info'
}

function staffingSeverity(score) {
  if (score >= 3) return 'critical'
  if (score >= 2) return 'warning'
  return 'info'
}

function buildReadableMessageDuration(categoryName, expectedAvg, actualAvg) {
  if (!expectedAvg && actualAvg) {
    const actualMinutes = Math.round(actualAvg)
    return `${categoryName} prend en moyenne ${actualMinutes} min.`
  }

  if (!expectedAvg) {
    return `${categoryName} ne dispose pas encore d'estimation prévue fiable.`
  }

  const expectedMinutes = Math.round(expectedAvg)
  const actualMinutes = Math.round(actualAvg)
  const diffMinutes = actualMinutes - expectedMinutes
  const sign = diffMinutes > 0 ? '+' : ''

  return `${categoryName} : prévu ${expectedMinutes} min, réel ${actualMinutes} min (${sign}${diffMinutes} min).`
}

function buildReadableMessageWorkload(targetName, predictedHours, openTasks) {
  const duration = formatHoursToReadable(predictedHours)
  const taskText = openTasks === 1 ? 'tâche ouverte' : 'tâches ouvertes'
  return `${targetName} a ${openTasks} ${taskText} pour une charge estimée à ${duration}.`
}

function buildReadableMessageAbsence(teamName, absentCount, impactedTasks) {
  const absenceText = absentCount === 1 ? 'absence planifiée' : 'absences planifiées'
  const taskText = impactedTasks === 1 ? 'tâche potentiellement impactée' : 'tâches potentiellement impactées'
  return `${teamName} aura ${absentCount} ${absenceText} avec ${impactedTasks} ${taskText}.`
}

function normalizeDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

async function savePredictionCache(enterpriseId, predictionType, targetType, targetId, severity, message, predictionData, validHours = 6) {
  try {
    const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000).toISOString()

    await supabase.from('task_predictions').insert({
      enterprise_id: enterpriseId,
      prediction_type: predictionType,
      target_type: targetType,
      target_id: targetId || null,
      prediction_data: predictionData || {},
      severity,
      message,
      valid_until: validUntil,
    })
  } catch (error) {
    console.error('Erreur savePredictionCache:', error)
  }
}

// ═══════════════════════════════════════════════════════════
// 📦 CHARGEMENT DE BASE
// ═══════════════════════════════════════════════════════════
async function loadPredictionBaseData(enterpriseId) {
  const today = normalizeDate(new Date())
  const next30Days = normalizeDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

  const [
    tasksRes,
    employeesRes,
    teamsRes,
    teamMembersRes,
    leaveRequestsRes,
    absencesRes,
    schedulesRes,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        id, enterprise_id, title, task_type, team_id, assigned_employee_id,
        category_id, priority, status, due_at, expected_duration_minutes,
        actual_duration_seconds, performance_score, created_at, completed_at, deleted_at
      `)
      .eq('enterprise_id', enterpriseId)
      .is('deleted_at', null),

    supabase
      .from('employees')
      .select(`
        id, enterprise_id, first_name, last_name, department, position, is_active
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true),

    supabase
      .from('teams')
      .select(`
        id, enterprise_id, name, leader_employee_id, is_active, deleted_at
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('deleted_at', null),

    supabase
      .from('team_members')
      .select(`
        id, team_id, employee_id, is_active, removed_at
      `)
      .eq('is_active', true)
      .is('removed_at', null),

    // ✅ CORRIGÉ : Filtrage par enterprise_id via jointure
    supabase
      .from('leave_requests')
      .select(`
        id, employee_id, start_date, end_date, status,
        employees!inner (enterprise_id)
      `)
      .in('status', ['approuve', 'approuvée', 'approved'])
      .lte('start_date', next30Days)
      .gte('end_date', today)
      .eq('employees.enterprise_id', enterpriseId),

    // ✅ CORRIGÉ : Filtrage par enterprise_id via jointure
    supabase
      .from('absences')
      .select(`
        id, employee_id, start_date, end_date, status, reason,
        employees!inner (enterprise_id)
      `)
      .lte('start_date', next30Days)
      .gte('end_date', today)
      .eq('employees.enterprise_id', enterpriseId),

    supabase
      .from('employee_schedules')
      .select(`
        id, employee_id, use_custom_hours, custom_start_time, custom_end_time,
        custom_has_break, custom_break_start, custom_break_end, custom_work_days,
        schedule_id,
        work_schedules (
          id, name, start_time, end_time, has_break, break_start, break_end, work_days
        )
      `),
  ])

  if (tasksRes.error) throw tasksRes.error
  if (employeesRes.error) throw employeesRes.error
  if (teamsRes.error) throw teamsRes.error
  if (teamMembersRes.error) throw teamMembersRes.error
  if (leaveRequestsRes.error) throw leaveRequestsRes.error
  if (absencesRes.error) throw absencesRes.error
  if (schedulesRes.error) throw schedulesRes.error

  // ✅ Filtrer team_members pour ne garder que ceux des équipes de cette entreprise
  const validTeamIds = new Set((teamsRes.data || []).map(t => t.id))
  const filteredTeamMembers = (teamMembersRes.data || []).filter(tm => 
    validTeamIds.has(tm.team_id)
  )

  return {
    tasks: tasksRes.data || [],
    employees: employeesRes.data || [],
    teams: teamsRes.data || [],
    teamMembers: filteredTeamMembers,  // ✅ FILTRÉ
    leaveRequests: leaveRequestsRes.data || [],
    absences: absencesRes.data || [],
    schedules: schedulesRes.data || [],
    today,           // ✅ Ajouter
    next30Days,      // ✅ Ajouter
  }
}

// ═══════════════════════════════════════════════════════════
// ⏱️ DURÉES PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════

export async function getDurationPredictions(enterpriseId) {
  try {
    const { data: categories, error: catError } = await supabase
      .from('task_categories')
      .select('id, name, color, avg_duration_minutes, total_tasks_completed')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')

    if (catError) throw catError

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        category_id,
        expected_duration_minutes,
        actual_duration_seconds,
        status,
        deleted_at
      `)
      .eq('enterprise_id', enterpriseId)
      .is('deleted_at', null)
      .in('status', COMPLETED_TASK_STATUSES)
      .not('category_id', 'is', null)

    if (tasksError) throw tasksError

    const result = (categories || []).map(category => {
      const categoryTasks = (tasks || []).filter(t => t.category_id === category.id)

      const expectedValues = categoryTasks
        .map(t => Number(t.expected_duration_minutes || 0))
        .filter(v => v > 0)

      const actualValues = categoryTasks
        .map(t => toMinutesFromSeconds(t.actual_duration_seconds || 0))
        .filter(v => v > 0)

      const expectedAvg = avg(expectedValues)
      const actualAvg = avg(actualValues)
      const varianceMinutes = round(actualAvg - expectedAvg, 2)
      const variancePercent = expectedAvg > 0 ? round((varianceMinutes / expectedAvg) * 100, 2) : 0

      let trend = 'stable'
      if (variancePercent > 15) trend = 'slower'
      if (variancePercent < -10) trend = 'faster'

      return {
        category_id: category.id,
        category_name: category.name,
        color: category.color,
        completed_count: categoryTasks.length,
        expected_avg_minutes: round(expectedAvg, 2),
        actual_avg_minutes: round(actualAvg, 2),
        variance_minutes: varianceMinutes,
        variance_percent: variancePercent,
        trend,
        severity: variancePercent > 35 ? 'critical' : variancePercent > 15 ? 'warning' : 'info',
        message: buildReadableMessageDuration(category.name, expectedAvg, actualAvg),
      }
    })

    const sorted = result.sort((a, b) => Math.abs(b.variance_percent) - Math.abs(a.variance_percent))

    return { data: sorted, error: null }
  } catch (error) {
    console.error('Erreur getDurationPredictions:', error)
    return { data: [], error }
  }
}

// ═══════════════════════════════════════════════════════════
// 👤 CHARGE EMPLOYÉ
// ═══════════════════════════════════════════════════════════

export async function getEmployeeWorkloadPredictions(enterpriseId) {
  try {
    const base = await loadPredictionBaseData(enterpriseId)

    const employeeMap = new Map(base.employees.map(emp => [emp.id, emp]))
    const historicalTasks = base.tasks.filter(t =>
      t.assigned_employee_id &&
      COMPLETED_TASK_STATUSES.includes(t.status) &&
      Number(t.expected_duration_minutes || 0) > 0 &&
      Number(t.actual_duration_seconds || 0) > 0
    )

    const activeTasks = base.tasks.filter(t =>
      t.assigned_employee_id &&
      ACTIVE_TASK_STATUSES.includes(t.status)
    )

    const result = base.employees.map(emp => {
      const employeeHistory = historicalTasks.filter(t => t.assigned_employee_id === emp.id)
      const employeeActiveTasks = activeTasks.filter(t => t.assigned_employee_id === emp.id)

      const expectedHistoryMinutes = employeeHistory
        .map(t => Number(t.expected_duration_minutes || 0))
        .filter(v => v > 0)

      const actualHistoryMinutes = employeeHistory
        .map(t => toMinutesFromSeconds(t.actual_duration_seconds || 0))
        .filter(v => v > 0)

      const historicalExpectedAvg = avg(expectedHistoryMinutes)
      const historicalActualAvg = avg(actualHistoryMinutes)

      const productivityRatio =
        historicalExpectedAvg > 0 && historicalActualAvg > 0
          ? historicalActualAvg / historicalExpectedAvg
          : 1

      const plannedOpenMinutes = employeeActiveTasks.reduce(
        (sum, t) => sum + Number(t.expected_duration_minutes || 0),
        0
      )

      const predictedRealMinutes = plannedOpenMinutes * productivityRatio
      const predictedHours = predictedRealMinutes / 60
      const overdueOpenTasks = employeeActiveTasks.filter(t =>
        t.due_at &&
        new Date(t.due_at) < new Date() &&
        !COMPLETED_TASK_STATUSES.includes(t.status)
      ).length

      const performanceLabel =
        productivityRatio <= 0.95 ? 'fast'
          : productivityRatio <= 1.1 ? 'normal'
            : 'slow'

      const severity = overdueOpenTasks > 0
        ? 'critical'
        : workloadSeverity(predictedHours)

      return {
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department,
        position: emp.position,
        open_tasks: employeeActiveTasks.length,
        overdue_tasks: overdueOpenTasks,
        planned_minutes: round(plannedOpenMinutes, 2),
        predicted_real_minutes: round(predictedRealMinutes, 2),
        predicted_real_hours: round(predictedHours, 2),
        productivity_ratio: round(productivityRatio, 2),
        historical_expected_avg: round(historicalExpectedAvg, 2),
        historical_actual_avg: round(historicalActualAvg, 2),
        performance_label: performanceLabel,
        severity,
        message: buildReadableMessageWorkload(`${emp.first_name} ${emp.last_name}`, predictedHours, employeeActiveTasks.length),
      }
    })

    const sorted = result
      .filter(r => r.open_tasks > 0)
      .sort((a, b) => b.predicted_real_hours - a.predicted_real_hours)

    return { data: sorted, error: null }
  } catch (error) {
    console.error('Erreur getEmployeeWorkloadPredictions:', error)
    return { data: [], error }
  }
}

// ═══════════════════════════════════════════════════════════
// 👥 CHARGE ÉQUIPE
// ═══════════════════════════════════════════════════════════

export async function getTeamWorkloadPredictions(enterpriseId) {
  try {
    const base = await loadPredictionBaseData(enterpriseId)

    const activeTasks = base.tasks.filter(t =>
      t.team_id &&
      ACTIVE_TASK_STATUSES.includes(t.status)
    )

    const completedTeamTasks = base.tasks.filter(t =>
      t.team_id &&
      COMPLETED_TASK_STATUSES.includes(t.status)
    )

    const result = base.teams.map(team => {
      const members = base.teamMembers.filter(tm => tm.team_id === team.id)
      const openTasks = activeTasks.filter(t => t.team_id === team.id)
      const history = completedTeamTasks.filter(t => t.team_id === team.id)

      const completedCount = history.length
      const openCount = openTasks.length
      const plannedMinutes = openTasks.reduce((sum, t) => sum + Number(t.expected_duration_minutes || 0), 0)

      const avgExpected = avg(history.map(t => Number(t.expected_duration_minutes || 0)).filter(v => v > 0))
      const avgActual = avg(history.map(t => toMinutesFromSeconds(t.actual_duration_seconds || 0)).filter(v => v > 0))
      const ratio = avgExpected > 0 && avgActual > 0 ? avgActual / avgExpected : 1

      const predictedMinutes = plannedMinutes * ratio
      const predictedHours = predictedMinutes / 60
      const loadPerMember = members.length > 0 ? predictedHours / members.length : predictedHours

      const overdue = openTasks.filter(t => t.due_at && new Date(t.due_at) < new Date()).length
      const completionRate = completedCount + openCount > 0
        ? round((completedCount / (completedCount + openCount)) * 100, 1)
        : 0

      let severity = 'info'
      if (overdue > 0 || loadPerMember >= 6) severity = 'critical'
      else if (loadPerMember >= 4 || completionRate < 70) severity = 'warning'

      return {
        team_id: team.id,
        team_name: team.name,
        member_count: members.length,
        open_tasks: openCount,
        overdue_tasks: overdue,
        completed_history_count: completedCount,
        completion_rate: completionRate,
        planned_minutes: round(plannedMinutes, 2),
        predicted_real_minutes: round(predictedMinutes, 2),
        predicted_real_hours: round(predictedHours, 2),
        load_per_member_hours: round(loadPerMember, 2),
        ratio: round(ratio, 2),
        severity,
        message: buildReadableMessageWorkload(team.name, predictedHours, openCount),
      }
    })

    const sorted = result
      .filter(r => r.open_tasks > 0 || r.completed_history_count > 0)
      .sort((a, b) => b.load_per_member_hours - a.load_per_member_hours)

    return { data: sorted, error: null }
  } catch (error) {
    console.error('Erreur getTeamWorkloadPredictions:', error)
    return { data: [], error }
  }
}

// ═══════════════════════════════════════════════════════════
// 🏖️ IMPACT DES ABSENCES
// ═══════════════════════════════════════════════════════════

export async function getAbsenceImpactPredictions(enterpriseId) {
  try {
    const base = await loadPredictionBaseData(enterpriseId)
    const today = normalizeDate(new Date())
    const next30Days = normalizeDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

    const approvedLeaveEmployees = (base.leaveRequests || []).map(lr => ({
      employee_id: lr.employee_id,
      start_date: lr.start_date,
      end_date: lr.end_date,
      source: 'leave_request',
    }))

    const absencesEmployees = (base.absences || []).map(abs => ({
      employee_id: abs.employee_id,
      start_date: abs.start_date,
      end_date: abs.end_date,
      source: 'absence',
      reason: abs.reason,
    }))

    const mergedAbsences = [...approvedLeaveEmployees, ...absencesEmployees].filter(a =>
      a.start_date <= next30Days && a.end_date >= today
    )

    const employeeToTeams = {}
    base.teamMembers.forEach(tm => {
      if (!employeeToTeams[tm.employee_id]) employeeToTeams[tm.employee_id] = []
      employeeToTeams[tm.employee_id].push(tm.team_id)
    })

    const activeTasks = base.tasks.filter(t => ACTIVE_TASK_STATUSES.includes(t.status))

    const teamMap = new Map(base.teams.map(t => [t.id, t]))
    const employeeMap = new Map(base.employees.map(e => [e.id, e]))

    const impactsByTeam = {}

    mergedAbsences.forEach(abs => {
      const teams = employeeToTeams[abs.employee_id] || []
      const employee = employeeMap.get(abs.employee_id)

      teams.forEach(teamId => {
        const team = teamMap.get(teamId)
        
        // ✅ VÉRIFIER QUE L'ÉQUIPE APPARTIENT À L'ENTREPRISE
        if (!team || team.enterprise_id !== enterpriseId) {
          return
        }
        
        if (!impactsByTeam[teamId]) {
          impactsByTeam[teamId] = {
            team_id: teamId,
            team_name: team.name || 'Équipe',
            absent_employees: [],
            impacted_tasks: 0,
            direct_tasks: 0,
            team_tasks: 0,
          }
        }

        impactsByTeam[teamId].absent_employees.push({
          employee_id: abs.employee_id,
          employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'Employé',
          start_date: abs.start_date,
          end_date: abs.end_date,
          source: abs.source,
          reason: abs.reason || null,
        })
      })
    })

    Object.values(impactsByTeam).forEach(teamImpact => {
      const absentIds = teamImpact.absent_employees.map(a => a.employee_id)

      const directTasks = activeTasks.filter(t => absentIds.includes(t.assigned_employee_id)).length
      const teamTasks = activeTasks.filter(t => t.team_id === teamImpact.team_id).length

      teamImpact.direct_tasks = directTasks
      teamImpact.team_tasks = teamTasks
      teamImpact.impacted_tasks = directTasks + teamTasks
      teamImpact.absent_count = teamImpact.absent_employees.length
      teamImpact.severity =
        teamImpact.absent_count >= 2 || teamImpact.impacted_tasks >= 5
          ? 'critical'
          : teamImpact.impacted_tasks >= 2
            ? 'warning'
            : 'info'
      teamImpact.message = buildReadableMessageAbsence(
        teamImpact.team_name,
        teamImpact.absent_count,
        teamImpact.impacted_tasks
      )
    })

    const result = Object.values(impactsByTeam).sort((a, b) => b.impacted_tasks - a.impacted_tasks)

    return { data: result, error: null }
  } catch (error) {
    console.error('Erreur getAbsenceImpactPredictions:', error)
    return { data: [], error }
  }
}

// ═══════════════════════════════════════════════════════════
// 🧑‍🏭 BESOINS DE RENFORT
// ═══════════════════════════════════════════════════════════

export async function getStaffingNeedPredictions(enterpriseId) {
  try {
    const teamWorkloadRes = await getTeamWorkloadPredictions(enterpriseId)
    const durationRes = await getDurationPredictions(enterpriseId)
    const absenceRes = await getAbsenceImpactPredictions(enterpriseId)

    const teamWorkloads = teamWorkloadRes.data || []
    const durations = durationRes.data || []
    const absences = absenceRes.data || []

    const durationPenalty = durations.filter(d => d.variance_percent > 20).length > 0 ? 1 : 0

    const result = teamWorkloads.map(team => {
      const absenceImpact = absences.find(a => a.team_id === team.team_id)
      let score = 0

      if (team.load_per_member_hours >= 6) score += 2
      else if (team.load_per_member_hours >= 4) score += 1

      if (team.overdue_tasks > 0) score += 1
      if (team.completion_rate < 70) score += 1
      if (absenceImpact?.absent_count >= 1) score += 1
      if (durationPenalty > 0) score += durationPenalty

      const estimatedAdditionalPeople =
        score >= 4 ? 2
          : score >= 2 ? 1
            : 0

      const severity = staffingSeverity(score)

      return {
        team_id: team.team_id,
        team_name: team.team_name,
        score,
        severity,
        open_tasks: team.open_tasks,
        load_per_member_hours: team.load_per_member_hours,
        overdue_tasks: team.overdue_tasks,
        completion_rate: team.completion_rate,
        absent_count: absenceImpact?.absent_count || 0,
        estimated_additional_people: estimatedAdditionalPeople,
        recommendation:
          estimatedAdditionalPeople === 0
            ? `Aucun renfort immédiat nécessaire pour ${team.team_name}.`
            : `${team.team_name} pourrait nécessiter ${estimatedAdditionalPeople} renfort(s) au rythme actuel.`,
      }
    }).sort((a, b) => b.score - a.score)

    return { data: result, error: null }
  } catch (error) {
    console.error('Erreur getStaffingNeedPredictions:', error)
    return { data: [], error }
  }
}

// ═══════════════════════════════════════════════════════════
// 📊 DASHBOARD GLOBAL PRÉDICTIONS
// ═══════════════════════════════════════════════════════════

export async function getPredictionDashboard(enterpriseId, options = {}) {
  try {
    const [
      durationsRes,
      employeeWorkloadRes,
      teamWorkloadRes,
      absencesRes,
      staffingRes,
    ] = await Promise.all([
      getDurationPredictions(enterpriseId),
      getEmployeeWorkloadPredictions(enterpriseId),
      getTeamWorkloadPredictions(enterpriseId),
      getAbsenceImpactPredictions(enterpriseId),
      getStaffingNeedPredictions(enterpriseId),
    ])

    const durations = durationsRes.data || []
    const employeeWorkloads = employeeWorkloadRes.data || []
    const teamWorkloads = teamWorkloadRes.data || []
    const absenceImpact = absencesRes.data || []
    const staffingNeeds = staffingRes.data || []

    const criticalEmployeeCount = employeeWorkloads.filter(w => w.severity === 'critical').length
    const warningEmployeeCount = employeeWorkloads.filter(w => w.severity === 'warning').length
    const criticalTeamCount = teamWorkloads.filter(w => w.severity === 'critical').length
    const warningTeamCount = teamWorkloads.filter(w => w.severity === 'warning').length
    const criticalAbsenceCount = absenceImpact.filter(a => a.severity === 'critical').length
    const severeStaffingCount = staffingNeeds.filter(s => s.severity === 'critical').length

    const avgVariancePercent = durations.length
      ? round(avg(durations.map(d => d.variance_percent)), 2)
      : 0

    const alerts = []

    employeeWorkloads
      .filter(w => w.severity !== 'info')
      .slice(0, 5)
      .forEach(item => {
        alerts.push({
          prediction_type: 'workload_alert',
          target_type: 'employee',
          target_id: item.employee_id,
          severity: item.severity,
          title: `Surcharge employé`,
          message: item.message,
          data: item,
        })
      })

    teamWorkloads
      .filter(t => t.severity !== 'info')
      .slice(0, 5)
      .forEach(item => {
        alerts.push({
          prediction_type: 'workload_alert',
          target_type: 'team',
          target_id: item.team_id,
          severity: item.severity,
          title: `Équipe à risque`,
          message: item.message,
          data: item,
        })
      })

    absenceImpact
      .filter(a => a.severity !== 'info')
      .slice(0, 5)
      .forEach(item => {
        alerts.push({
          prediction_type: 'absence_impact',
          target_type: 'team',
          target_id: item.team_id,
          severity: item.severity,
          title: `Impact absence`,
          message: item.message,
          data: item,
        })
      })

    staffingNeeds
      .filter(s => s.estimated_additional_people > 0)
      .slice(0, 5)
      .forEach(item => {
        alerts.push({
          prediction_type: 'staffing_need',
          target_type: 'team',
          target_id: item.team_id,
          severity: item.severity,
          title: `Besoin de renfort`,
          message: item.recommendation,
          data: item,
        })
      })

    alerts.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 }
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
    })

    if (!options?.skipCache) {
      const topAlerts = alerts.slice(0, 10)
      for (const alert of topAlerts) {
        await savePredictionCache(
          enterpriseId,
          alert.prediction_type,
          alert.target_type,
          alert.target_id,
          alert.severity,
          alert.message,
          alert.data,
          6
        )
      }
    }

    return {
      data: {
        summary: {
          critical_alerts: alerts.filter(a => a.severity === 'critical').length,
          warning_alerts: alerts.filter(a => a.severity === 'warning').length,
          overloaded_employees: criticalEmployeeCount + warningEmployeeCount,
          risky_teams: criticalTeamCount + warningTeamCount,
          impactful_absences: criticalAbsenceCount,
          staffing_needs: severeStaffingCount,
          avg_duration_variance_percent: avgVariancePercent,
        },
        alerts,
        durations,
        employee_workloads: employeeWorkloads,
        team_workloads: teamWorkloads,
        absence_impact: absenceImpact,
        staffing_needs: staffingNeeds,
      },
      error: null,
    }
  } catch (error) {
    console.error('Erreur getPredictionDashboard:', error)
    return {
      data: {
        summary: {
          critical_alerts: 0,
          warning_alerts: 0,
          overloaded_employees: 0,
          risky_teams: 0,
          impactful_absences: 0,
          staffing_needs: 0,
          avg_duration_variance_percent: 0,
        },
        alerts: [],
        durations: [],
        employee_workloads: [],
        team_workloads: [],
        absence_impact: [],
        staffing_needs: [],
      },
      error,
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 📦 EXPORT
// ═══════════════════════════════════════════════════════════

export default {
  getPredictionDashboard,
  getDurationPredictions,
  getEmployeeWorkloadPredictions,
  getTeamWorkloadPredictions,
  getAbsenceImpactPredictions,
  getStaffingNeedPredictions,
}