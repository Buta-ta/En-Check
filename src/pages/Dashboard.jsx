// ═══════════════════════════════════════════════════════════
// 📊 PAGE DASHBOARD AFROFUTURISTE ENRICHI
// Avec conflits absence/pointage intégrés + Notifications + ANIMATIONS
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import DashboardExperience from '../components/DashboardExperience'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import { useNavigate } from 'react-router-dom'
import useNotifications from '../hooks/useNotifications'
import HolidayService from '../services/holidayService'
import FeatureService, { FEATURES } from '../services/featureService'
import useRealtimeNotifications from '../hooks/useRealtimeNotifications'
import NotificationPermissionPrompt from '../components/NotificationPermissionPrompt'

// ✅ NOUVEAUX IMPORTS POUR ANIMATIONS
import useTabAnimations from '../hooks/useTabAnimations'




import {
  Building2,
  Users,
  Clock,
  Coffee,
  LogOut,
  Plus,
  ChevronRight,
  Shield,
  FileText,
  Calendar,
  CalendarOff,
  CalendarDays,
  AlertTriangle,
  Menu,
  X,
  Zap,
  Activity,
  ArrowRight,
  UserCheck,
  UserX,
  Timer,
  Camera,
  BellRing,
  CheckCircle2,
  LogIn,
  LogOut as LogOutIcon,
  ShieldCheck,
  Ban,
  TrendingUp,
  FileSearch,
  Users2,
  MapPin,
  Settings,
  Wallet,
  ClipboardList,
  UsersRound,
  Sparkles,
  Bell,
  Volume2,
  VolumeX,
  Globe,
  Radio,
} from 'lucide-react'
import { formaterHeureLocale, minutesDepuisMinuit, jourLocal } from '../utils/timezoneUtils'
import { compterRetardsDuJour } from '../services/hoursCalculator'

export { compterRetardsDuJour }

export default function Dashboard() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showAnalytics, setShowAnalytics] = useState(false)

  const [modulePlanning, setModulePlanning] = useState(false)
  const [moduleRetards, setModuleRetards] = useState(false)
  const [moduleConges, setModuleConges] = useState(false)
  const [moduleHeuresSup, setModuleHeuresSup] = useState(false)
  const [moduleGeofencing, setModuleGeofencing] = useState(false)
  const [moduleCarteTempsReel, setModuleCarteTempsReel] = useState(false)
  const [moduleRecoFaciale, setModuleRecoFaciale] = useState(false)
  const [moduleFichesPaie, setModuleFichesPaie] = useState(false)
  const [moduleTaches, setModuleTaches] = useState(false)
  const [modulePredictions, setModulePredictions] = useState(false)
  // 💼 Les options payantes ajoutées après les modules historiques : chacune
  //    commande un écran à elle (ou un canal d'alerte), et chacune s'allume
  //    entreprise par entreprise depuis la fiche de l'entreprise.
  const [modulePointeuses, setModulePointeuses] = useState(false)
  const [modulePostePointage, setModulePostePointage] = useState(false)
  const [moduleRemunerations, setModuleRemunerations] = useState(false)
  const [moduleCoutSalarial, setModuleCoutSalarial] = useState(false)
  const [moduleConfigFiscale, setModuleConfigFiscale] = useState(false)
  const [moduleAlertesTelephone, setModuleAlertesTelephone] = useState(false)
  const [moduleAlertesCourrier, setModuleAlertesCourrier] = useState(false)

  const [stats, setStats] = useState({
    entreprises: 0, employes: 0, pointages: 0, presentsToday: 0,
    absentsToday: 0, congesToday: 0, retardsToday: 0, photosToday: 0,
    oublisSortie: 0, tauxPresence: 0, conflitsPending: 0,
  })

  const [recentActivity, setRecentActivity] = useState([])
  const [alerts, setAlerts] = useState([])
  const [topEntreprises, setTopEntreprises] = useState([])

  const [conflictsPending, setConflictsPending] = useState([])
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [selectedConflict, setSelectedConflict] = useState(null)
  const [conflictNote, setConflictNote] = useState('')
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const [conflictEmployees, setConflictEmployees] = useState({})

  const [scheduleRequestsPending, setScheduleRequestsPending] = useState([])
  const [todayHoliday, setTodayHoliday] = useState(null)

  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const today = jourLocal(new Date()) || new Date().toISOString().split('T')[0]

  // ═══ NOTIFICATIONS HOOK ═══
  const {
    notifications,
    unreadCount,
    hasHighPriority,
    markAsRead,
    markAllAsRead,
    refresh: refreshNotifications,
  } = useNotifications(admin)
  useRealtimeNotifications(admin)

  // ✅ Mémoriser l'objet des modules activés pour éviter que `setCurrentTime`
  //    (appelé chaque seconde) ne déclenche en boucle `useTabAnimations`.
  const enabledModulesForTabs = useMemo(() => ({
    moduleConges,
    modulePlanning,
    moduleTaches,
    moduleGeofencing,
    moduleRetards,
    moduleHeuresSup,
    moduleFichesPaie,
    modulePredictions
  }), [
    moduleConges,
    modulePlanning,
    moduleTaches,
    moduleGeofencing,
    moduleRetards,
    moduleHeuresSup,
    moduleFichesPaie,
    modulePredictions
  ])

  const {
    tabStates,
    isCalculating,
    markTabAsViewed,
    clearTab,
    refreshAllTriggers,
  } = useTabAnimations(
    admin,
    admin?.selectedEnterprise?.id || admin?.enterprise_id,
    enabledModulesForTabs
  )

  // ═══ HANDLER : Marquer onglet comme vu ═══
  const handleTabClick = (tabKey) => {
    if (tabKey) {
      markTabAsViewed(tabKey)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    loadData(parsedAdmin)
  }, [navigate])

  const loadData = async (adminData) => {
    setLoading(true)
    setLoadError(null)
    try {
      const isSuperAdmin = adminData.role === 'super_admin'
      const selectedEnterprise = adminData.selectedEnterprise
      const enterpriseId = selectedEnterprise?.id || adminData.enterprise_id

      if (isSuperAdmin) {
        const { data: entreprisesData, error: entErr } = await supabase
          .from('enterprises')
          .select('*, employees(count)')
          .eq('is_active', true)
          .order('name')
        if (entErr) throw entErr
        const list = entreprisesData || []
        setEntreprises(list)

        // Synchroniser la liste des entreprises dans admin + localStorage
        // pour que le sélecteur d'entreprise (EnterpriseSwitcher) et les
        // onglets (Config Fiscale, Fiches de Paie, etc.) y aient toujours accès.
        const lastId =
          (adminData.id && localStorage.getItem(`last_enterprise_id_${adminData.id}`)) ||
          localStorage.getItem('last_enterprise_id')
        const resolvedSelected =
          (selectedEnterprise?.id && list.find(e => e.id === selectedEnterprise.id)) ||
          (lastId && list.find(e => e.id === lastId)) ||
          selectedEnterprise ||
          null

        const syncedAdmin = {
          ...adminData,
          entreprises: list,
          selectedEnterprise: resolvedSelected,
          isMultiEntreprise: list.length > 1,
        }
        setAdmin(syncedAdmin)
        localStorage.setItem('admin', JSON.stringify(syncedAdmin))

        if (resolvedSelected) {
          await loadSingleEnterpriseDashboard(resolvedSelected.id, list.length, true)
        } else {
          await loadGlobalSuperAdminDashboard(list)
          setModulePlanning(true)
          setModuleRetards(true)
          setModuleConges(true)
          setModuleHeuresSup(true)
          setModuleGeofencing(true)
          setModuleCarteTempsReel(true)
          setModuleRecoFaciale(true)
          setModuleFichesPaie(true)
          setModuleTaches(true)
          setModulePredictions(true)
          setModulePointeuses(true)
          setModulePostePointage(true)
          setModuleRemunerations(true)
          setModuleCoutSalarial(true)
          setModuleConfigFiscale(true)
          setModuleAlertesTelephone(true)
          setModuleAlertesCourrier(true)
        }
      } else {
        if (enterpriseId) {
          const { data: entrepriseData, error: entErr } = await supabase
            .from('enterprises').select('*').eq('id', enterpriseId).single()
          if (entErr) throw entErr

          if (entrepriseData) {
            setAdmin(prev => ({
              ...prev,
              enterprise_name: entrepriseData.name,
              selectedEnterprise: { ...prev?.selectedEnterprise, name: entrepriseData.name },
            }))
            setModulePlanning(entrepriseData.module_planning || false)
            setModuleRetards(entrepriseData.module_retards || false)
            setModuleConges(entrepriseData.module_conges || false)
            setModuleGeofencing(entrepriseData.module_geolocalisation || false)
            setModuleHeuresSup(entrepriseData.module_heures_supplementaires || false)
            setModuleCarteTempsReel(entrepriseData.module_carte_temps_reel || false)
            setModuleRecoFaciale(entrepriseData.module_reconnaissance_faciale || false)
            setModuleTaches(entrepriseData.module_taches || false)
            setModulePredictions(entrepriseData.module_predictions || false)
            setModulePointeuses(entrepriseData.module_pointeuses || false)
            setModulePostePointage(entrepriseData.module_poste_pointage || false)
            setModuleRemunerations(entrepriseData.module_remunerations || false)
            setModuleCoutSalarial(entrepriseData.module_cout_salarial || false)
            setModuleConfigFiscale(entrepriseData.module_config_fiscale || false)
            setModuleAlertesTelephone(entrepriseData.module_alertes_telephone || false)
            setModuleAlertesCourrier(entrepriseData.module_alertes_courrier || false)
            const hasFichesPaie = await FeatureService.hasFeature(enterpriseId, FEATURES.FICHES_PAIE)
            setModuleFichesPaie(hasFichesPaie)
          }
          await loadSingleEnterpriseDashboard(enterpriseId, adminData.entreprises?.length || 1, false)
        }
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error)
      const message = error?.message || 'Impossible de charger les données du tableau de bord'
      setLoadError(message)
      // ═══════════════════════════════════════════════════════════════════
      // VD-01 — ÉTAT D'ERREUR HONNÊTE (anti-dashboard menteur)
      // ═══════════════════════════════════════════════════════════════════
      // POURQUOI : en cas d'échec réseau ou d'exception, les compteurs
      // restent à zéro. Afficher « Aucune alerte critique — La journée se
      // déroule normalement » produirait une fausse tranquillité. On
      // remplace donc explicitement la liste d'alertes par une alerte
      // d'erreur critique avec bouton « Réessayer ».
      setAlerts([
        {
          type: 'error',
          icon: AlertTriangle,
          color: '#EF4444',
          title: 'Impossible de charger les données',
          subtitle: 'Une erreur est survenue lors de la récupération de l’activité du jour.',
          action: 'Réessayer',
          actionFn: () => loadData(adminData),
        },
      ])
    }
    setLoading(false)
  }

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
      supabase.from('attendances').select(`id, check_time, check_type, employees (id, first_name, last_name, matricule, photo_url), pointages_photos (id, photo_url)`).eq('enterprise_id', enterpriseId).gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: false }).limit(8),
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
    // Oublis de badge : l'employé a pointé son arrivée et n'a jamais pointé sa
    // sortie. On regarde le DERNIER geste de la journée : s'il est à l'entrée et
    // qu'il date de plus de 8 heures, la sortie a été oubliée — le même seuil que
    // l'alerte « Sortie manquante », pour que l'écran et la cloche disent la même chose.
    const dernierGesteDuJour = new Map()
    for (const a of attendancesToday) {
      const t = new Date(a.check_time).getTime()
      if (isNaN(t)) continue
      const deja = dernierGesteDuJour.get(a.employee_id)
      if (!deja || t > deja.t) {
        dernierGesteDuJour.set(a.employee_id, { t, type: String(a.check_type || '').toLowerCase() })
      }
    }
    const oublisSortie = [...dernierGesteDuJour.values()].filter(
      (d) => d.type === 'in' && Date.now() - d.t > 8 * 3600 * 1000,
    ).length
    // Heure locale de l'entreprise + respect du planning personnalisé ou par défaut de chaque employé.
    const retardsToday = compterRetardsDuJour(
      retardEntries,
      employeeSchedulesRes?.data || [],
      defaultSchedulesRes?.data || [],
      today
    )
    const tauxPresence = employesData.length > 0 ? Math.round((presentsToday / employesData.length) * 100) : 0

    const conflictsData = await loadConflicts(enterpriseId)
    const conflitsPending = conflictsData.length

    const scheduleRequests = await loadScheduleRequests(enterpriseId)
    const todayHolidayData = await loadTodayHoliday(enterpriseId)

    setStats({ entreprises: entreprisesCount, employes: employesData.length, pointages: pointagesTotalRes.count || 0, presentsToday, absentsToday, congesToday, retardsToday, photosToday, oublisSortie, tauxPresence, conflitsPending })

    setRecentActivity(recentData.map(item => ({ id: item.id, type: item.check_type, time: item.check_time, employee: item.employees, hasPhoto: item.pointages_photos?.length > 0 })))

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
      supabase.from('attendances').select(`id, check_time, check_type, enterprise_id, employees (id, first_name, last_name, matricule, photo_url), pointages_photos (id, photo_url)`).gte('check_time', startOfDay).lte('check_time', endOfDay).order('check_time', { ascending: false }).limit(10),
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
    // Oublis de badge : l'employé a pointé son arrivée et n'a jamais pointé sa
    // sortie. On regarde le DERNIER geste de la journée : s'il est à l'entrée et
    // qu'il date de plus de 8 heures, la sortie a été oubliée — le même seuil que
    // l'alerte « Sortie manquante », pour que l'écran et la cloche disent la même chose.
    const dernierGesteDuJour = new Map()
    for (const a of attendancesToday) {
      const t = new Date(a.check_time).getTime()
      if (isNaN(t)) continue
      const deja = dernierGesteDuJour.get(a.employee_id)
      if (!deja || t > deja.t) {
        dernierGesteDuJour.set(a.employee_id, { t, type: String(a.check_type || '').toLowerCase() })
      }
    }
    const oublisSortie = [...dernierGesteDuJour.values()].filter(
      (d) => d.type === 'in' && Date.now() - d.t > 8 * 3600 * 1000,
    ).length
    // Heure locale de l'entreprise + respect du planning personnalisé ou par défaut de chaque employé.
    const retardsToday = compterRetardsDuJour(
      retardEntries,
      employeeSchedulesRes?.data || [],
      defaultSchedulesRes?.data || [],
      today
    )
    const tauxPresence = totalEmployes > 0 ? Math.round((presentsToday / totalEmployes) * 100) : 0

    const conflictsData = await loadConflicts(null)
    const conflitsPending = conflictsData.length
    const scheduleRequests = await loadScheduleRequests(null)
    setTodayHoliday(null)

    setStats({ entreprises: entreprisesData.length || 0, employes: totalEmployes, pointages: pointagesTotalRes.count || 0, presentsToday, absentsToday, congesToday, retardsToday, photosToday, oublisSortie, tauxPresence, conflitsPending })

    setRecentActivity(recentData.map(item => ({ id: item.id, type: item.check_type, time: item.check_time, enterprise_id: item.enterprise_id, employee: item.employees, hasPhoto: item.pointages_photos?.length > 0 })))

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

  const canManageConflict = ['admin', 'manager', 'super_admin'].includes(admin?.role)

  const openConflictModal = (conflict) => {
    setSelectedConflict(conflict)
    setConflictNote('')
    setShowConflictModal(true)
  }

  const resolveConflict = async (action) => {
    if (!selectedConflict) return
    setResolvingConflict(true)
    try {
      const conflictId = selectedConflict.id
      const absenceId = selectedConflict.absence_id

      if (action === 'kept_absence') {
        const { error } = await supabase.from('attendance_conflicts').update({ status: 'resolved', resolution_action: 'kept_absence', notes: conflictNote || 'Absence maintenue malgré le pointage', resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', conflictId)
        if (error) throw error
      } else if (action === 'cancelled_absence') {
        const { error: delError } = await supabase.from('absences').delete().eq('id', absenceId)
        if (delError) throw delError
        const { error } = await supabase.from('attendance_conflicts').update({ status: 'resolved', resolution_action: 'cancelled_absence', notes: conflictNote || 'Absence annulée suite au pointage', resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', conflictId)
        if (error) throw error
      } else if (action === 'ignored_conflict') {
        const { error } = await supabase.from('attendance_conflicts').update({ status: 'ignored', resolution_action: 'ignored_conflict', notes: conflictNote || 'Conflit ignoré', resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', conflictId)
        if (error) throw error
      }

      setShowConflictModal(false)
      setSelectedConflict(null)
      setConflictNote('')
      loadData(admin)
      refreshNotifications()
    } catch (error) {
      console.error('Erreur résolution:', error)
    }
    setResolvingConflict(false)
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

  const handleLogout = () => {
    localStorage.removeItem('admin')
    localStorage.removeItem('last_enterprise_id')
    navigate('/login')
  }

  const handleEnterpriseSwitch = () => window.location.reload()

  const isSuperAdmin = admin?.role === 'super_admin'
  const isMultiEntreprise = admin?.isMultiEntreprise || (admin?.entreprises?.length > 1)

  if (loading) {
    return (
      <div className="encheck-dashboard dashboard-loading" data-theme={darkMode ? 'dark' : 'light'} role="status" aria-live="polite">
        <div className="dashboard-loading-mark"><EnCheckBrandMark size={42} /></div>
        <p>Préparation de votre tableau de bord…</p>
        <span className="dashboard-loading-track"><span /></span>
      </div>
    )
  }

  return (
    <>
      <NotificationPermissionPrompt userType="admin" />
      <DashboardExperience
        admin={admin}
        entreprises={entreprises}
        isSuperAdmin={isSuperAdmin}
        isMultiEntreprise={isMultiEntreprise}
        modulePlanning={modulePlanning}
        moduleRetards={moduleRetards}
        moduleConges={moduleConges}
        moduleHeuresSup={moduleHeuresSup}
        moduleGeofencing={moduleGeofencing}
        moduleCarteTempsReel={moduleCarteTempsReel}
        moduleRecoFaciale={moduleRecoFaciale}
        moduleFichesPaie={moduleFichesPaie}
        moduleTaches={moduleTaches}
        modulePredictions={modulePredictions}
        modulePointeuses={modulePointeuses}
        modulePostePointage={modulePostePointage}
        moduleRemunerations={moduleRemunerations}
        moduleCoutSalarial={moduleCoutSalarial}
        moduleConfigFiscale={moduleConfigFiscale}
        stats={stats}
        recentActivity={recentActivity}
        topEntreprises={topEntreprises}
        conflictsPending={conflictsPending}
        scheduleRequestsPending={scheduleRequestsPending}
        todayHoliday={todayHoliday}
        currentTime={currentTime}
        loadError={loadError}
        notifications={notifications}
        unreadCount={unreadCount}
        hasHighPriority={hasHighPriority}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
        handleLogout={handleLogout}
        handleEnterpriseSwitch={handleEnterpriseSwitch}
        showAnalytics={showAnalytics}
        setShowAnalytics={setShowAnalytics}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        tabStates={tabStates}
        markTabAsViewed={markTabAsViewed}
        canManageConflict={canManageConflict}
        openConflictModal={openConflictModal}
        showConflictModal={showConflictModal}
        setShowConflictModal={setShowConflictModal}
        selectedConflict={selectedConflict}
        conflictNote={conflictNote}
        setConflictNote={setConflictNote}
        resolvingConflict={resolvingConflict}
        resolveConflict={resolveConflict}
        retryLoad={() => admin && loadData(admin)}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
      />
    </>
  )
}
