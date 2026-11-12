// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — CHARGEURS DE DONNÉES
// Chargement des conflits, par entreprise, vue globale
// super-admin, alertes générées, demandes d'horaire, jours
// fériés, pauses du jour (+ temps réel). Ne garde aucun état :
// il reçoit les setters.
// ═══════════════════════════════════════════════════════════
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  AlertTriangle, Calendar, CalendarDays, CalendarOff, CheckCircle2, Clock,
  ShieldCheck, UserX,
} from 'lucide-react'
import FeatureService, { FEATURES } from '../../services/featureService'
import HolidayService from '../../services/holidayService'
import { findMissingExitEntries } from '../../services/missingExits'
import { compterRetardsDuJour } from '../../services/hoursCalculator'
import { construirePauses, estPauseReelleEffectuee } from '../../services/pausesService'
import { formaterHeureLocale } from '../../utils/timezoneUtils'

export function useDashboardLoaders(ctx) {
  const {
    admin, today, navigate, setStats, setRecentActivity, setAlerts,
    setTopEntreprises, setConflictsPending, setScheduleRequestsPending,
    setForgottenExitItems, setPausesToday, setTodayHoliday,
    setModulePlanning, setModuleRetards, setModuleConges,
    setModuleGeofencing, setModuleCarteTempsReel, setModuleRecoFaciale,
    setModuleTaches, setModulePredictions, setModuleFichesPaie,
    setRetardsOptionActive,
  } = ctx
  const loadConflicts = async (targetId) => {
    try {
      let conflictQuery = supabase
        .from('attendance_conflicts')
        .select(`*, employees (id, first_name, last_name, matricule, photo_url), absences (id, reason, start_date, end_date), attendances (id, check_time, check_type)`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (targetId && targetId !== 'all') {
        conflictQuery = conflictQuery.eq('enterprise_id', targetId)
      }

      const { data } = await conflictQuery
      setConflictsPending(data || [])
      return data || []
    } catch (error) {
      console.error('Erreur chargement conflits:', error)
      return []
    }
  }

  const loadSingleEnterpriseDashboard = async (enterpriseId, entreprisesCount = 1) => {
    const startOfDay = new Date(`${today}T00:00:00`).toISOString()
    const endOfDay = new Date(`${today}T23:59:59`).toISOString()

    const [
      entrepriseRes, employesRes, pointagesTotalRes, attendancesTodayRes,
      absencesTodayRes, recentActivityRes, photosTodayRes, retardEmployeesRes,
      allEnterprisesRes,
      allAttendancesTodayRes,
      employeeSchedulesRes,
      defaultSchedulesRes,
    ] = await Promise.all([
      supabase.from('enterprises').select('*').eq('id', enterpriseId).single(),
      supabase.from('employees').select('id, first_name, last_name, matricule, photo_url').eq('enterprise_id', enterpriseId).eq('is_active', true),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId),
      supabase.from('attendances').select(`id, employee_id, enterprise_id, check_time, check_type, is_auto_closed, employees (id, first_name, last_name, matricule, photo_url), pointages_photos (id, photo_url)`).eq('enterprise_id', enterpriseId).gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: false }),
      supabase.from('absences').select('id, employee_id, reason, status').eq('enterprise_id', enterpriseId).lte('start_date', today).gte('end_date', today),
      supabase.from('attendances').select(`id, employee_id, enterprise_id, check_time, check_type, is_auto_closed, employees (id, first_name, last_name, matricule, photo_url), pointages_photos (id, photo_url)`).eq('enterprise_id', enterpriseId).gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: false }).limit(16),
      supabase.from('attendances').select(`id, pointages_photos(id)`).eq('enterprise_id', enterpriseId).gte('check_time', startOfDay).lte('check_time', endOfDay),
      supabase.from('attendances').select(`id, employee_id, enterprise_id, check_time, check_type`).eq('enterprise_id', enterpriseId).eq('check_type', 'in').gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: true }),
      supabase.from('enterprises').select('id, name, logo_url, employees(count)').eq('is_active', true).order('name'),
      supabase.from('attendances').select('id, employee_id, enterprise_id').gte('check_time', startOfDay).lte('check_time', endOfDay).limit(5000),
      supabase.from('employee_schedules').select('*, work_schedules(*)').eq('is_active', true),
      supabase.from('work_schedules').select('*').eq('enterprise_id', enterpriseId).eq('is_default', true).eq('is_active', true),
    ])

    if (employesRes.error) throw employesRes.error
    if (attendancesTodayRes.error) throw attendancesTodayRes.error

    const entrepriseData = entrepriseRes.data
    const employesData = employesRes.data || []
    const attendancesToday = attendancesTodayRes.data || []
    const absencesToday = absencesTodayRes.data || []
    const recentData = recentActivityRes.data || []
    const photosData = photosTodayRes.data || []
    const retardEntries = retardEmployeesRes.data || []

    if (entrepriseData) {
      setModulePlanning(entrepriseData.module_planning || false)
      setModuleRetards(entrepriseData.module_retards || false)
      setModuleConges(entrepriseData.module_conges || false)
      setModuleGeofencing(entrepriseData.module_geolocalisation || false)
      setModuleCarteTempsReel(entrepriseData.module_carte_temps_reel || false)
      setModuleRecoFaciale(entrepriseData.module_reconnaissance_faciale || false)
      setModuleTaches(entrepriseData.module_taches || false)
      setModulePredictions(entrepriseData.module_predictions || false)
      const hasFichesPaie = await FeatureService.hasFeature(enterpriseId, FEATURES.FICHES_PAIE)
      setModuleFichesPaie(hasFichesPaie)
    }

    const allEnterprises = allEnterprisesRes.data || []
    const allAttendancesToday = allAttendancesTodayRes.data || []

    const employeeIdsWithAttendance = new Set(attendancesToday.map(a => a.employee_id))
    const employeeIdsOnLeave = new Set(absencesToday.map(a => a.employee_id))

    const presentsToday = employeeIdsWithAttendance.size
    const congesToday = absencesToday.length
    const absentsToday = employesData.filter(emp => !employeeIdsWithAttendance.has(emp.id) && !employeeIdsOnLeave.has(emp.id)).length
    const photosToday = photosData.filter(a => a.pointages_photos?.length > 0).length
    // Alerte de sortie manquante, seuil configuré commun (pas une estimation).
    const missingExitEntries = await findMissingExitEntries(attendancesToday, { enterpriseId })
    const oublisSortie = missingExitEntries.length
    setForgottenExitItems(
      missingExitEntries.map((d) => ({
        id: d.row.id,
        employee_id: d.row.employee_id,
        enterprise_id: d.row.enterprise_id || enterpriseId,
        check_time: d.row.check_time,
        employee: d.row.employees,
      }))
    )
    // Heure locale de l'entreprise + respect du planning personnalisé ou par défaut de chaque employé.
    const empSchedData = employeeSchedulesRes?.data || []
    const defSchedData = defaultSchedulesRes?.data || []
    const retardsOptionActive = Boolean(entrepriseData?.module_retards)
    setRetardsOptionActive(retardsOptionActive)
    const retardsToday = retardsOptionActive
      ? compterRetardsDuJour(retardEntries, empSchedData, defSchedData, today)
      : 0
    const tauxPresence = employesData.length > 0 ? Math.round((presentsToday / employesData.length) * 100) : 0

    const conflictsData = await loadConflicts(enterpriseId)
    const conflitsPending = conflictsData.length

    const scheduleRequests = await loadScheduleRequests(enterpriseId)
    const todayHolidayData = await loadTodayHoliday(enterpriseId)
    await loadDashboardPauses(enterpriseId, attendancesToday, empSchedData, defSchedData)

    setStats({ entreprises: entreprisesCount, employes: employesData.length, pointages: pointagesTotalRes.count || 0, presentsToday, absentsToday, congesToday, retardsToday, photosToday, oublisSortie, tauxPresence, conflitsPending })

    setRecentActivity(recentData.map(item => {
      const isEntry = String(item.check_type || '').toLowerCase() === 'in'
      const isLate = isEntry && retardsOptionActive && compterRetardsDuJour(
        [{ ...item, enterprise_id: item.enterprise_id || enterpriseId }],
        empSchedData,
        defSchedData,
        today
      ) > 0
      return {
        id: item.id,
        employee_id: item.employee_id,
        enterprise_id: item.enterprise_id || enterpriseId,
        type: item.check_type,
        time: item.check_time,
        employee: item.employees,
        hasPhoto: item.pointages_photos?.length > 0,
        photoUrl: item.pointages_photos?.[0]?.photo_url || null,
        isAutoClosed: Boolean(item.is_auto_closed),
        isLate,
      }
    }))

    buildAlerts(
      retardsToday,
      oublisSortie,
      absentsToday,
      congesToday,
      conflitsPending,
      scheduleRequests.length,
      todayHolidayData
    )
    const top = allEnterprises.map(ent => {
      const eeCount = ent.employees?.[0]?.count || 0
      const entAtts = allAttendancesToday.filter(a => a.enterprise_id === ent.id)
      const entPresents = new Set(entAtts.map(a => a.employee_id)).size
      const rate = eeCount > 0 ? Math.round((entPresents / eeCount) * 100) : 0
      return {
        id: ent.id,
        name: ent.name,
        logo_url: ent.logo_url,
        employeesCount: eeCount,
        presentsToday: entPresents,
        tauxPresence: rate,
      }
    }).sort((a, b) => b.tauxPresence - a.tauxPresence).slice(0, 5)

    setTopEntreprises(top)
  }

  const loadGlobalSuperAdminDashboard = async (entreprisesData) => {
    const startOfDay = new Date(`${today}T00:00:00`).toISOString()
    const endOfDay = new Date(`${today}T23:59:59`).toISOString()

    const [
      employesCountRes, pointagesTotalRes, attendancesTodayRes,
      absencesTodayRes, recentActivityRes, photosTodayRes, retardEntriesRes,
      employeeSchedulesRes, defaultSchedulesRes,
    ] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('attendances').select('*', { count: 'exact', head: true }),
      supabase.from('attendances').select(`id, employee_id, enterprise_id, check_time, check_type, is_auto_closed, employees (id, first_name, last_name, matricule, photo_url), pointages_photos (id, photo_url)`).gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: false }),
      supabase.from('absences').select('id, employee_id, reason, status, enterprise_id').lte('start_date', today).gte('end_date', today),
      supabase.from('attendances').select(`id, employee_id, enterprise_id, check_time, check_type, is_auto_closed, employees (id, first_name, last_name, matricule, photo_url), pointages_photos (id, photo_url)`).gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: false }).limit(16),
      supabase.from('attendances').select(`id, pointages_photos(id)`).gte('check_time', startOfDay).lte('check_time', endOfDay),
      supabase.from('attendances').select(`id, employee_id, enterprise_id, check_time, check_type`).eq('check_type', 'in').gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: true }),
      supabase.from('employee_schedules').select('*, work_schedules(*)').eq('is_active', true),
      supabase.from('work_schedules').select('*').eq('is_default', true).eq('is_active', true),
    ])

    if (employesCountRes.error) throw employesCountRes.error
    if (attendancesTodayRes.error) throw attendancesTodayRes.error

    const attendancesToday = attendancesTodayRes.data || []
    const absencesToday = absencesTodayRes.data || []
    const recentData = recentActivityRes.data || []
    const photosData = photosTodayRes.data || []
    const retardEntries = retardEntriesRes.data || []

    const employeeIdsWithAttendance = new Set(attendancesToday.map(a => a.employee_id))
    const employeeIdsOnLeave = new Set(absencesToday.map(a => a.employee_id))

    const totalEmployes = employesCountRes.count || 0
    const presentsToday = employeeIdsWithAttendance.size
    const congesToday = absencesToday.length
    const absentsToday = Math.max(totalEmployes - presentsToday - employeeIdsOnLeave.size, 0)
    const photosToday = photosData.filter(a => a.pointages_photos?.length > 0).length
    // Alerte de sortie manquante, seuil configuré commun (pas une estimation).
    const missingExitEntries = await findMissingExitEntries(attendancesToday)
    const oublisSortie = missingExitEntries.length
    setForgottenExitItems(
      missingExitEntries.map((d) => ({
        id: d.row.id,
        employee_id: d.row.employee_id,
        enterprise_id: d.row.enterprise_id,
        check_time: d.row.check_time,
        employee: d.row.employees,
      }))
    )
    // Heure locale de l'entreprise + respect du planning personnalisé ou par défaut de chaque employé.
    const empSchedData = employeeSchedulesRes?.data || []
    const defSchedData = defaultSchedulesRes?.data || []
    const entreprisesAvecRetards = new Set(
      (entreprisesData || []).filter((ent) => ent.module_retards).map((ent) => ent.id),
    )
    const retardsAutorises = (entId) => entreprisesAvecRetards.has(entId)
    setRetardsOptionActive(entreprisesAvecRetards.size > 0)
    const retardsToday = compterRetardsDuJour(
      retardEntries.filter((a) => retardsAutorises(a.enterprise_id)),
      empSchedData,
      defSchedData,
      today
    )
    const tauxPresence = totalEmployes > 0 ? Math.round((presentsToday / totalEmployes) * 100) : 0

    const conflictsData = await loadConflicts(null)
    const conflitsPending = conflictsData.length
    const scheduleRequests = await loadScheduleRequests(null)
    setTodayHoliday(null)
    await loadDashboardPauses(null, attendancesToday, empSchedData, defSchedData)

    setStats({ entreprises: entreprisesData.length || 0, employes: totalEmployes, pointages: pointagesTotalRes.count || 0, presentsToday, absentsToday, congesToday, retardsToday, photosToday, oublisSortie, tauxPresence, conflitsPending })

    setRecentActivity(recentData.map(item => {
      const isEntry = String(item.check_type || '').toLowerCase() === 'in'
      const isLate = isEntry && retardsAutorises(item.enterprise_id) && compterRetardsDuJour(
        [item],
        empSchedData,
        defSchedData,
        today
      ) > 0
      return {
        id: item.id,
        employee_id: item.employee_id,
        enterprise_id: item.enterprise_id,
        type: item.check_type,
        time: item.check_time,
        employee: item.employees,
        hasPhoto: item.pointages_photos?.length > 0,
        photoUrl: item.pointages_photos?.[0]?.photo_url || null,
        isAutoClosed: Boolean(item.is_auto_closed),
        isLate,
      }
    }))

    buildAlerts(
      retardsToday,
      oublisSortie,
      absentsToday,
      congesToday,
      conflitsPending,
      scheduleRequests.length,
      null
    )

    const top = entreprisesData.map(ent => {
      const eeCount = ent.employees?.[0]?.count || 0
      const entAtts = attendancesToday.filter(a => a.enterprise_id === ent.id)
      const entPresents = new Set(entAtts.map(a => a.employee_id)).size
      const rate = eeCount > 0 ? Math.round((entPresents / eeCount) * 100) : 0
      return { id: ent.id, name: ent.name, logo_url: ent.logo_url, employeesCount: eeCount, presentsToday: entPresents, tauxPresence: rate }
    }).sort((a, b) => b.tauxPresence - a.tauxPresence).slice(0, 5)

    setTopEntreprises(top)
  }

  const buildAlerts = (
    retardsToday,
    oublisSortie,
    absentsToday = 0,
    congesToday = 0,
    conflitsPending = 0,
    scheduleRequestsPendingCount = 0,
    holidayData = null
  ) => {
    const generatedAlerts = []

    if (holidayData) {
      generatedAlerts.push({
        type: 'holiday',
        icon: Calendar,
        color: '#8B5CF6',
        title: `Aujourd'hui : ${holidayData.name}`,
        subtitle: 'Jour férié actif pour cette entreprise',
        action: 'Voir les jours fériés',
        actionFn: () => navigate('/jours-feries')
      })
    }

    if (scheduleRequestsPendingCount > 0) {
      generatedAlerts.push({
        type: 'schedule_request',
        icon: CalendarDays,
        color: '#6366F1',
        title: `${scheduleRequestsPendingCount} demande${scheduleRequestsPendingCount > 1 ? 's' : ''} de modification d'horaires`,
        subtitle: 'Des employés souhaitent modifier leur planning',
        action: 'Voir le planning',
        actionFn: () => navigate('/planning')
      })
    }

    if (conflitsPending > 0) {
      generatedAlerts.push({
        type: 'conflict',
        icon: ShieldCheck,
        color: '#F97316',
        title: `${conflitsPending} conflit${conflitsPending > 1 ? 's' : ''} absence/pointage`,
        subtitle: 'Des employés ont pointé pendant une absence déclarée',
        action: 'Voir les conflits',
        actionFn: () => navigate('/pointages')
      })
    }

    if (retardsToday > 0) {
      generatedAlerts.push({
        type: 'warning',
        icon: AlertTriangle,
        color: '#EF4444',
        title: `${retardsToday} retard${retardsToday > 1 ? 's' : ''} aujourd'hui`,
        subtitle: 'Des employés ont pointé après l\'heure prévue'
      })
    }

    if (oublisSortie > 0) {
      generatedAlerts.push({
        type: 'warning',
        icon: Clock,
        color: '#F59E0B',
        title: `${oublisSortie} oubli${oublisSortie > 1 ? 's de sortie' : ' de sortie'}`,
        subtitle: 'Des pointages ont été auto-fermés'
      })
    }

    if (absentsToday > 0) {
      generatedAlerts.push({
        type: 'info',
        icon: UserX,
        color: '#6B7280',
        title: `${absentsToday} absent${absentsToday > 1 ? 's' : ''} aujourd'hui`,
        subtitle: 'Employés sans pointage ni congé déclaré'
      })
    }

    if (congesToday > 0) {
      generatedAlerts.push({
        type: 'success',
        icon: CalendarOff,
        color: '#8B5CF6',
        title: `${congesToday} en congé / maladie`,
        subtitle: 'Absences planifiées ou justifiées'
      })
    }

    if (generatedAlerts.length === 0) {
      generatedAlerts.push({
        type: 'success',
        icon: CheckCircle2,
        color: '#10B981',
        title: 'Aucune alerte critique',
        subtitle: 'La journée se déroule normalement'
      })
    }

    setAlerts(generatedAlerts)
  }

  const loadScheduleRequests = async (targetId) => {
    try {
      let query = supabase
        .from('schedule_change_requests')
        .select(`
        *,
        employees (id, first_name, last_name, matricule, photo_url)
      `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (targetId && targetId !== 'all') {
        query = query.eq('enterprise_id', targetId)
      }

      const { data, error } = await query
      if (error) throw error

      setScheduleRequestsPending(data || [])
      return data || []
    } catch (error) {
      console.error('Erreur chargement demandes horaires:', error)
      setScheduleRequestsPending([])
      return []
    }
  }

  const loadTodayHoliday = async (enterpriseId) => {
    try {
      if (!enterpriseId || enterpriseId === 'all') {
        setTodayHoliday(null)
        return null
      }

      const holiday = await HolidayService.isHoliday(enterpriseId, today)
      setTodayHoliday(holiday || null)
      return holiday || null
    } catch (error) {
      console.error('Erreur chargement jour férié du jour:', error)
      setTodayHoliday(null)
      return null
    }
  }

  const loadDashboardPauses = async (enterpriseId, attendancesToday = [], empSchedData = [], defSchedData = []) => {
    try {
      const entArg = !enterpriseId || enterpriseId === 'all' ? null : enterpriseId
      let directQuery = supabase
        .from('encheck_pauses')
        .select('*, employees(id, first_name, last_name, matricule, photo_url)')
        .eq('jour', today)
      if (entArg) directQuery = directQuery.eq('enterprise_id', entArg)

      const [rpcRes, directRes] = await Promise.all([
        supabase
          .rpc('encheck_pauses_lire', { p_enterprise: entArg, p_du: today, p_au: today })
          .then((r) => r)
          .catch(() => ({ data: [] })),
        directQuery.then((r) => r).catch(() => ({ data: [] })),
      ])

      const rows = (rpcRes?.data && rpcRes.data.length > 0) ? rpcRes.data : (directRes?.data || [])
      const basePauses = construirePauses(rows).paies || []

      const empById = new Map()
      for (const a of attendancesToday || []) {
        if (!a?.employee_id) continue
        if (a.employees) empById.set(a.employee_id, a.employees)
      }
      for (const row of directRes?.data || []) {
        const empId = row?.employee_id || row?.employe_id
        if (empId && row?.employees && !empById.has(empId)) {
          empById.set(empId, row.employees)
        }
      }

      const empSchedMap = new Map()
      for (const es of empSchedData || []) {
        if (es?.employee_id && !empSchedMap.has(es.employee_id)) empSchedMap.set(es.employee_id, es)
      }
      const defSchedByEnt = new Map()
      for (const ws of defSchedData || []) {
        if (ws?.enterprise_id && !defSchedByEnt.has(ws.enterprise_id)) defSchedByEnt.set(ws.enterprise_id, ws)
      }

      const hasPlannedBreakForEmp = (empId, entId) => {
        const es = empSchedMap.get(empId)
        if (es) {
          return es.use_custom_hours ? Boolean(es.custom_has_break) : Boolean(es.work_schedules?.has_break)
        }
        const def = defSchedByEnt.get(entId)
        return Boolean(def?.has_break)
      }

      // L'historique des pauses du jour ne concerne QUE les pauses réellement effectuées (non présumées).
      // Aucun intervalle entre deux pointages d'entrée/sortie (`attendances`) ni aucune pause présumée
      // de la grille horaire n'est considéré comme une pause réellement effectuée.
      const enriched = basePauses
        .filter((p) => estPauseReelleEffectuee(p))
        .map((p) => {
          const emp = empById.get(p.employe_id)
          const planned = hasPlannedBreakForEmp(p.employe_id, p.enterprise_id || entArg)
          return {
            ...p,
            employe: p.employe || `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim() || 'Employé',
            matricule: p.matricule || emp?.matricule || '',
            debutHHMM: p.debutISO ? formaterHeureLocale(p.debutISO) : p.debutHHMM,
            finHHMM: p.finISO ? formaterHeureLocale(p.finISO) : p.finHHMM,
            estNonPlanifiee: !planned,
          }
        })

      setPausesToday(enriched)
    } catch (err) {
      console.error('Erreur chargement pauses dashboard:', err)
      setPausesToday([])
    }
  }

  useEffect(() => {
    if (!admin) return undefined
    const targetEnterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id || null
    const channel = supabase
      .channel('dashboard_pauses_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'encheck_pauses' },
        () => {
          loadDashboardPauses(targetEnterpriseId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [admin])

  return {
    loadSingleEnterpriseDashboard,
    loadGlobalSuperAdminDashboard,
    loadScheduleRequests,
    loadTodayHoliday,
    loadDashboardPauses,
  }
}
