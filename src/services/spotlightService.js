// src/services/spotlightService.js
// ═══════════════════════════════════════════════════════════
// 🔍 SPOTLIGHT SERVICE (v3.0 - ENRICHI)
// ✅ +12 nouvelles entités recherchables
// ✅ Recherche avancée employés (CDI/CDD, CNPS, etc.)
// ✅ Équipes, géofences, demandes congés, etc.
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'
import { getHeuresMinutesLocales } from '../utils/timezoneUtils'
import { parseQuery } from './queryParser'
import { calculateEmployeeHours } from './hoursCalculator'
import HolidayService from './holidayService'
import Fuse from 'fuse.js'

export async function searchSpotlight(query, admin) {
  const q = (query || '').trim()
  if (!q) return []

  // ✅ NOUVEAU : Vérifier si c'est une recherche "télécharger"
  const downloadResult = detectDownloadQuery(q)
  if (downloadResult) {
    return [downloadResult]
  }

  const enterpriseId = admin?.selectedEnterprise?.id || admin?.enterprise_id || null
  if (!enterpriseId) {
    return [{
      id: 'need-enterprise',
      type: 'action',
      category: 'actions',
      title: 'Sélectionnez une entreprise',
      subtitle: 'Une entreprise active est requise pour la recherche.',
      action: 'focusSearch',
    }]
  }

  const parsed = parseQuery(q, admin)

  switch (parsed.type) {
    case 'COMMAND':
      return handleCommand(parsed.command, admin, enterpriseId)
    case 'EMPLOYEE_HOURS':
      return searchEmployeeHours(parsed, enterpriseId)
    case 'EMPLOYEE_SEARCH':
      return searchEmployees(parsed, enterpriseId)
    case 'TASK_SEARCH':
      return searchTasks(parsed, enterpriseId)
    case 'ATTENDANCE_SEARCH':
      return searchAttendances(parsed, enterpriseId)
    case 'ABSENCE_SEARCH':
      return searchAbsences(parsed, enterpriseId)
    case 'PAYSLIP_SEARCH':
      return searchPayslips(parsed, enterpriseId)
    default:
      return globalSearch(parsed, enterpriseId)
  }
}

// ═══════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════

async function handleCommand(command, admin, enterpriseId) {
  const c = (command || '').toLowerCase()

  if (c === 'stats') return getStatsCommand(enterpriseId)
  if (c === 'absents') return getAbsentsToday(enterpriseId)
  if (c === 'retards') return getRetardsToday(enterpriseId)
  if (c === 'scan') return [{ id: 'scan', type: 'action', category: 'actions', title: 'Scanner un QR Code', subtitle: 'Ouvrir le scanner QR', action: 'openScanner' }]
  if (c === 'export') return [{ id: 'export', type: 'action', category: 'actions', title: 'Exporter', subtitle: 'Ouvrir Rapports / Exports', action: 'goReports' }]
  if (c === 'map') return [{ id: 'map', type: 'action', category: 'actions', title: 'Carte temps réel', subtitle: 'Ouvrir la carte temps réel', action: 'goMap' }]

  return []
}

// ═══════════════════════════════════════════════════════════
// RECHERCHE HEURES
// ═══════════════════════════════════════════════════════════

async function searchEmployeeHours(parsed, enterpriseId) {
  let q = supabase
    .from('employees')
    .select('id, enterprise_id, matricule, first_name, last_name, photo_url')
    .eq('enterprise_id', enterpriseId)
    .eq('is_active', true)

  if (parsed.employeeSearchTerm) {
    const term = parsed.employeeSearchTerm.trim()
    q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,matricule.ilike.%${term}%`)
  }
  if (parsed.employeeMatricule) q = q.ilike('matricule', `%${parsed.employeeMatricule}%`)

  const { data: employees } = await q.limit(5)
  if (!employees?.length) return []

  const results = await Promise.all(
    employees.map(async (e) => {
      const hoursData = await calculateEmployeeHours(e.id, e.enterprise_id, new Date())
      return { id: `hours-${e.id}`, type: 'hours_detail', category: 'hours', ...hoursData }
    })
  )

  return results
}

// ═══════════════════════════════════════════════════════════
// ✅ RECHERCHE EMPLOYÉS ENRICHIE
// ═══════════════════════════════════════════════════════════

async function searchEmployees(parsed, enterpriseId) {
  const { searchTerm, filters } = parsed

  let q = supabase
    .from('employees')
    .select(`
      id, matricule, first_name, last_name, email, phone, photo_url,
      department, position, is_active,
      contract_type, professional_category, cnps_number, hire_date,
      date_of_birth, gender, marital_status
    `)
    .eq('enterprise_id', enterpriseId)
    .eq('is_active', true)

  if (filters?.department) q = q.ilike('department', `%${filters.department}%`)
  if (filters?.matricule) q = q.ilike('matricule', `%${filters.matricule}%`)

  const { data } = await q.limit(30)
  let list = data || []

  if (searchTerm && list.length) {
    const fuse = new Fuse(list, { 
      keys: ['first_name', 'last_name', 'matricule', 'email', 'position', 'cnps_number'], 
      threshold: 0.3 
    })
    list = fuse.search(searchTerm).map(r => r.item)
  }

  return list.slice(0, 10).map(e => ({ 
    ...e, 
    type: 'employee', 
    category: 'employees',
    // ✅ Enrichir les infos affichées
    subtitle: buildEmployeeSubtitle(e)
  }))
}

// Remplace la fonction buildEmployeeSubtitle() (ligne ~120 environ)

function buildEmployeeSubtitle(employee) {
  const parts = []
  
  // Département
  if (employee.department) parts.push(employee.department)
  
  // Poste
  if (employee.position) parts.push(employee.position)
  
  // Email
  if (employee.email) parts.push(employee.email)
  
  // Contrat
  if (employee.contract_type) {
    const contractLabel = employee.contract_type === 'CDI' ? '📝 CDI' : '📄 CDD'
    parts.push(contractLabel)
  }
  
  // Catégorie professionnelle
  if (employee.professional_category) {
    const catLabel = employee.professional_category === 'cadre' ? '👔 Cadre' : '👷 Non-cadre'
    parts.push(catLabel)
  }
  
  // CNPS
  if (employee.cnps_number) {
    parts.push(`CNPS: ${employee.cnps_number}`)
  }
  
  return parts.join(' • ')
}

// ═══════════════════════════════════════════════════════════
// ✅ RECHERCHE TÂCHES ENRICHIE
// ═══════════════════════════════════════════════════════════

async function searchTasks(parsed, enterpriseId) {
  let q = supabase
    .from('tasks')
    .select(`
      *,
      teams(id, name, color),
      employees!tasks_assigned_employee_id_fkey(id, first_name, last_name, photo_url),
      task_categories(id, name, color, icon)
    `)
    .eq('enterprise_id', enterpriseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (parsed.filters?.priority) q = q.eq('priority', parsed.filters.priority)
  if (parsed.filters?.status) q = q.eq('status', parsed.filters.status)
  if (parsed.filters?.teamName) q = q.ilike('teams.name', `%${parsed.filters.teamName}%`)

  const { data } = await q.limit(20)
  
  return (data || []).map(t => ({
    ...t,
    type: 'task',
    category: 'tasks',
    assigned_employee: t.employees,
    team: t.teams,
    task_category: t.task_categories,
  }))
}

// ═══════════════════════════════════════════════════════════
// RECHERCHE POINTAGES
// ═══════════════════════════════════════════════════════════

async function searchAttendances(parsed, enterpriseId) {
  const today = new Date().toISOString().split('T')[0]

  let q = supabase
    .from('attendances')
    .select(`
      *, 
      employees(id, first_name, last_name, matricule, photo_url), 
      pointages_photos(id, photo_url)
    `)
    .eq('enterprise_id', enterpriseId)
    .gte('check_time', `${today}T00:00:00`)
    .lte('check_time', `${today}T23:59:59`)
    .order('check_time', { ascending: false })

  if (parsed.filters?.type) q = q.eq('check_type', parsed.filters.type)
  if (parsed.filters?.method) q = q.eq('method', parsed.filters.method)

  const { data } = await q.limit(20)
  
  return (data || []).map(a => ({
    ...a,
    type: 'attendance',
    category: 'attendances',
    employee: a.employees,
    has_photo: a.pointages_photos?.length > 0,
  }))
}

// ═══════════════════════════════════════════════════════════
// ✅ RECHERCHE ABSENCES ENRICHIE
// ═══════════════════════════════════════════════════════════

async function searchAbsences(parsed, enterpriseId) {
  const today = new Date().toISOString().split('T')[0]
  
  const { data } = await supabase
    .from('absences')
    .select(`
      *, 
      employees(id, first_name, last_name, matricule, photo_url, position)
    `)
    .eq('enterprise_id', enterpriseId)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data || []).map(a => ({ 
    ...a, 
    type: 'absence', 
    category: 'absences', 
    employee: a.employees 
  }))
}

// ═══════════════════════════════════════════════════════════
// ✅ NOUVELLES RECHERCHES
// ═══════════════════════════════════════════════════════════

async function searchLeaveRequests(enterpriseId) {
  const { data } = await supabase
    .from('leave_requests')
    .select(`
      *,
      employees(id, first_name, last_name, matricule, photo_url)
    `)
    .eq('enterprise_id', enterpriseId)
    .eq('status', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(10)

  return (data || []).map(lr => ({
    ...lr,
    type: 'leave_request',
    category: 'leave_requests',
    employee: lr.employees
  }))
}

async function searchTeams(enterpriseId, searchTerm = '') {
  let q = supabase
    .from('teams')
    .select(`
      *,
      leader:leader_employee_id(id, first_name, last_name, photo_url),
      team_members(count)
    `)
    .eq('enterprise_id', enterpriseId)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (searchTerm) {
    q = q.ilike('name', `%${searchTerm}%`)
  }

  const { data } = await q.limit(10)

  return (data || []).map(t => ({
    ...t,
    type: 'team',
    category: 'teams',
    members_count: t.team_members?.[0]?.count || 0
  }))
}

async function searchGeofences(enterpriseId, searchTerm = '') {
  let q = supabase
    .from('geofences')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .eq('is_active', true)

  if (searchTerm) {
    q = q.ilike('name', `%${searchTerm}%`)
  }

  const { data } = await q.limit(10)

  return (data || []).map(g => ({
    ...g,
    type: 'geofence',
    category: 'geofences'
  }))
}

async function searchScheduleRequests(enterpriseId) {
  const { data } = await supabase
    .from('schedule_change_requests')
    .select(`
      *,
      employees(id, first_name, last_name, matricule, photo_url),
      requested_schedule:requested_schedule_id(name)
    `)
    .eq('enterprise_id', enterpriseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  return (data || []).map(sr => ({
    ...sr,
    type: 'schedule_request',
    category: 'schedule_requests',
    employee: sr.employees
  }))
}

async function searchFaceEnrollments(enterpriseId) {
  const { data } = await supabase
    .from('face_enrollments')
    .select(`
      *,
      employees(id, first_name, last_name, matricule, photo_url)
    `)
    .eq('enterprise_id', enterpriseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  return (data || []).map(fe => ({
    ...fe,
    type: 'face_enrollment',
    category: 'face_enrollments',
    employee: fe.employees
  }))
}

async function searchPayslips(parsed, enterpriseId) {
  const { data } = await supabase
    .from('employee_payslips')
    .select('*, employees(id, first_name, last_name, matricule)')
    .eq('enterprise_id', enterpriseId)
    .eq('is_deleted', false)
    .order('period_start', { ascending: false })
    .limit(20)

  return (data || []).map(p => ({ 
    ...p, 
    type: 'payslip', 
    category: 'payslips', 
    employee: p.employees 
  }))
}



/**
 * Détecte si la recherche concerne le téléchargement de l'app
 */
function detectDownloadQuery(query) {
  const normalized = query.toLowerCase().trim()
  
  const downloadKeywords = [
    'télécharger', 'telecharger', 'telechargement', 'téléchargement',
    'download', 'install', 'installer', 'installation',
    'app', 'application', 'mobile', 'pwa',
    'en-check', 'encheck', 'en check',
  ]

  // Compter les mots-clés présents
  const matchCount = downloadKeywords.filter(keyword => 
    normalized.includes(keyword)
  ).length


  console.log('✅ Match count:', matchCount) // ✅ DEBUG

  // Si au moins 1 mot-clé (ex: "télécharger" ou "app")
  if (matchCount >= 1) {

     console.log('📱 Résultat download retourné !') // ✅ DEBUG
    return {
      type: 'download_app',
      title: 'Télécharger EN-CHECK Administration',
      description: 'Installez l\'application pour un accès hors-ligne',
      icon: '📱',
      score: 100, // Score max pour apparaître en premier
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════
// ✅ RECHERCHE GLOBALE ENRICHIE
// ═══════════════════════════════════════════════════════════

async function globalSearch(parsed, enterpriseId) {
  const searchTerm = parsed.searchTerm || ''
  if (searchTerm.length < 2) return []

  const [
    employees,
    tasks,
    teams,
    leaveRequests,
    scheduleRequests,
    faceEnrollments,
    geofences,
    payslips, // ✅ AJOUTÉ
  ] = await Promise.all([
    searchEmployees({ type: 'EMPLOYEE_SEARCH', searchTerm, filters: {} }, enterpriseId).catch(() => []),
    searchTasks({ type: 'TASK_SEARCH', filters: {} }, enterpriseId).catch(() => []),
    searchTeams(enterpriseId, searchTerm).catch(() => []),
    searchLeaveRequests(enterpriseId).catch(() => []),
    searchScheduleRequests(enterpriseId).catch(() => []),
    searchFaceEnrollments(enterpriseId).catch(() => []),
    searchGeofences(enterpriseId, searchTerm).catch(() => []),
    searchPayslips({ searchTerm }, enterpriseId).catch(() => []), // ✅ AJOUTÉ
  ])

  return [
    ...employees.slice(0, 5),
    ...tasks.slice(0, 3),
    ...teams.slice(0, 2),
    ...leaveRequests.slice(0, 2),
    ...payslips.slice(0, 2), // ✅ AJOUTÉ
    ...scheduleRequests.slice(0, 2),
    ...faceEnrollments.slice(0, 2),
    ...geofences.slice(0, 2),
  ]
}

// ═══════════════════════════════════════════════════════════
// COMMANDES MÉTIER
// ═══════════════════════════════════════════════════════════

async function getStatsCommand(enterpriseId) {
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: employeesCount }, 
    { data: ins }, 
    { data: absences }
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId).eq('is_active', true),
    supabase.from('attendances').select('employee_id').eq('enterprise_id', enterpriseId).eq('check_type', 'in')
      .gte('check_time', `${today}T00:00:00`).lte('check_time', `${today}T23:59:59`),
    supabase.from('absences').select('employee_id').eq('enterprise_id', enterpriseId).lte('start_date', today).gte('end_date', today),
  ])

  const presentSet = new Set((ins || []).map(x => x.employee_id))
  const absenceSet = new Set((absences || []).map(x => x.employee_id))

  return [{
    id: 'stats-today',
    type: 'stats_summary',
    category: 'stats',
    title: `📊 Stats du jour (${today})`,
    subtitle: `${presentSet.size} présents • ${absenceSet.size} en congé • ${(employeesCount || 0) - presentSet.size - absenceSet.size} absents`,
  }]
}

async function getAbsentsToday(enterpriseId) {
  const today = new Date().toISOString().split('T')[0]

  const holiday = await HolidayService.isHoliday(enterpriseId, today)
  if (holiday && holiday.is_worked === false) {
    return [{
      id: 'holiday-info',
      type: 'stats_summary',
      category: 'stats',
      title: `🎌 Jour férié : ${holiday.name}`,
      subtitle: `Les absences ne sont pas évaluées aujourd'hui (jour non travaillé).`,
    }]
  }

  const [
    { data: employees }, 
    { data: ins }, 
    { data: absences }
  ] = await Promise.all([
    supabase.from('employees').select('id, first_name, last_name, matricule, photo_url').eq('enterprise_id', enterpriseId).eq('is_active', true),
    supabase.from('attendances').select('employee_id').eq('enterprise_id', enterpriseId).eq('check_type', 'in')
      .gte('check_time', `${today}T00:00:00`).lte('check_time', `${today}T23:59:59`),
    supabase.from('absences').select('employee_id').eq('enterprise_id', enterpriseId).lte('start_date', today).gte('end_date', today),
  ])

  const presentSet = new Set((ins || []).map(x => x.employee_id))
  const absenceSet = new Set((absences || []).map(x => x.employee_id))

  const absents = (employees || []).filter(e => !presentSet.has(e.id) && !absenceSet.has(e.id))

  return absents.slice(0, 20).map(e => ({
    ...e,
    type: 'employee',
    category: 'employees',
    todayStatus: { type: 'absent', label: '🔴 Absent' }
  }))
}

// Remplace la fonction getRetardsToday() (ligne ~500 environ)

async function getRetardsToday(enterpriseId) {
  const today = new Date().toISOString().split('T')[0]

  const holiday = await HolidayService.isHoliday(enterpriseId, today)
  if (holiday && holiday.is_worked === false) {
    return [{
      id: 'holiday-retards',
      type: 'stats_summary',
      category: 'stats',
      title: `🎌 Jour férié : ${holiday.name}`,
      subtitle: `Les retards ne sont pas évalués aujourd'hui (jour non travaillé).`,
    }]
  }

  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, matricule, photo_url, enterprise_id')
    .eq('enterprise_id', enterpriseId)
    .eq('is_active', true)

  const employeeIds = (employees || []).map(e => e.id)
  if (!employeeIds.length) return []

  const [
    { data: employeeSchedules }, 
    { data: defaultSchedule }, 
    { data: ins }
  ] = await Promise.all([
    supabase.from('employee_schedules').select('*, work_schedules(*)').in('employee_id', employeeIds),
    supabase.from('work_schedules').select('*').eq('enterprise_id', enterpriseId).eq('is_default', true).eq('is_active', true).limit(1),
    supabase.from('attendances').select('id, employee_id, check_time').eq('enterprise_id', enterpriseId).eq('check_type', 'in')
      .gte('check_time', `${today}T00:00:00`).lte('check_time', `${today}T23:59:59`).order('check_time', { ascending: true }),
  ])

  const defaultSched = defaultSchedule?.[0] || null

  const scheduleByEmp = {}
  ;(employeeSchedules || []).forEach(s => { scheduleByEmp[s.employee_id] = s })

  const firstInByEmp = {}
  ;(ins || []).forEach(a => { if (!firstInByEmp[a.employee_id]) firstInByEmp[a.employee_id] = a })

  const results = []
  

  for (const emp of (employees || [])) {
    const sPerso = scheduleByEmp[emp.id]
    const { heureArrivee, tolerance } = resolveScheduleLikeRetards(sPerso, defaultSched)

    if (!heureArrivee) continue
    const firstIn = firstInByEmp[emp.id]
    if (!firstIn) continue

    // ⭐ LIVRAISON 04 : heure locale de l'entreprise
    const { heures: hLocale, minutes: mLocale } = getHeuresMinutesLocales(firstIn.check_time)
    const heurePointage = `${String(hLocale).padStart(2, '0')}:${String(mLocale).padStart(2, '0')}`

    const [hA, mA] = heureArrivee.split(':').map(Number)
    const [hP, mP] = heurePointage.split(':').map(Number)

    const minutesArriveeBase = hA * 60 + mA
    const minutesArriveeMax = minutesArriveeBase + (tolerance || 15)
    const minutesPointage = hP * 60 + mP

    const retardMinutes = minutesPointage - minutesArriveeBase
    const estEnRetard = minutesPointage > minutesArriveeMax

    if (estEnRetard && retardMinutes > 0) {
      // ✅ Convertir les minutes en heures + minutes
      const heures = Math.floor(retardMinutes / 60)
      const mins = retardMinutes % 60
      const retardFormatted = heures > 0 
        ? `${heures}h${mins.toString().padStart(2, '0')}`
        : `${mins}min`

      results.push({
        id: `retard-${firstIn.id}`,
        type: 'retard',
        category: 'retards',
        title: `⏰ ${emp.first_name} ${emp.last_name}`,
        subtitle: `Prévu ${heureArrivee} (±${tolerance}min) • Pointé ${heurePointage} • +${retardFormatted}`,
        employee: emp,
        retardMinutes,
        attendance_id: firstIn.id,
      })
    }
  }

  return results.sort((a, b) => b.retardMinutes - a.retardMinutes).slice(0, 20)
}

function resolveScheduleLikeRetards(schedulePerso, defaultSchedule) {
  let heureArrivee = null
  let tolerance = 15

  if (schedulePerso) {
    if (schedulePerso.use_custom_hours && schedulePerso.custom_start_time) {
      heureArrivee = schedulePerso.custom_start_time.slice(0, 5)
      tolerance = schedulePerso.custom_late_tolerance_minutes || 15
    } else if (schedulePerso.schedule_id && schedulePerso.work_schedules) {
      heureArrivee = schedulePerso.work_schedules.start_time?.slice(0, 5) || null
      tolerance = schedulePerso.work_schedules.late_tolerance_minutes || 15
    }
  }

  if (!heureArrivee && defaultSchedule) {
    heureArrivee = defaultSchedule.start_time?.slice(0, 5) || null
    tolerance = defaultSchedule.late_tolerance_minutes || 15
  }

  return { heureArrivee, tolerance }
}

async function fetchLastAttendanceForEmployee(employeeId, enterpriseId) {
  const { data, error } = await supabase
    .from('attendances')
    .select('id, employee_id, enterprise_id, check_time, check_type, method, is_auto_closed, location_lat, location_lng, pointages_photos(id, photo_url)')
    .eq('enterprise_id', enterpriseId)
    .eq('employee_id', employeeId)
    .order('check_time', { ascending: false })
    .limit(1)

  if (error) return null
  return data?.[0] || null
}