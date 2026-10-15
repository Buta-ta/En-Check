// ═══════════════════════════════════════════════════════════
// 📊 PAGE DASHBOARD AFROFUTURISTE ENRICHI
// Avec conflits absence/pointage intégrés + Notifications + ANIMATIONS
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import EnterpriseSwitcher from '../components/EnterpriseSwitcher'
import SystemMessageBanner from '../components/SystemMessageBanner'
import NotificationBell from '../components/NotificationBell'
import useNotifications from '../hooks/useNotifications'
import HolidayService from '../services/holidayService'
import FeatureService, { FEATURES } from '../services/featureService'
import useRealtimeNotifications from '../hooks/useRealtimeNotifications'
import NotificationPermissionPrompt from '../components/NotificationPermissionPrompt'

// ✅ NOUVEAUX IMPORTS POUR ANIMATIONS
import useTabAnimations from '../hooks/useTabAnimations'
import AnimatedTabButton from '../components/AnimatedTabButton'

import { TABS_CONFIG } from '../utils/animationConfig'
import SpotlightFAB from '../components/SpotlightFAB'
import LandingAnalytics from './LandingAnalytics'



import {
  Footprints,
  Building2,
  Users,
  Clock,
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
  BarChart3,
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

  const greeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const kpiCards = useMemo(() => {
    const cards = []
    if (isSuperAdmin) {
      cards.push({ key: 'entreprises', icon: Building2, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', value: stats.entreprises, label: 'Entreprises', decor: BarChart3 })
    } else if (!isSuperAdmin && isMultiEntreprise) {
      cards.push({ key: 'entreprises', icon: Building2, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', value: admin?.entreprises?.length || 0, label: 'Mes entreprises', decor: BarChart3 })
    }
    cards.push(
      { key: 'employes', icon: Users, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', value: stats.employes, label: 'Employés', decor: Users },
      { key: 'pointages', icon: Clock, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', value: stats.pointages, label: 'Pointages', decor: Clock },
      { key: 'presentsToday', icon: UserCheck, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', value: stats.presentsToday, label: 'Présents aujourd\'hui', decor: UserCheck },
      { key: 'absentsToday', icon: UserX, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', value: stats.absentsToday, label: 'Absents aujourd\'hui', decor: UserX },
      { key: 'congesToday', icon: CalendarOff, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', value: stats.congesToday, label: 'Congés / maladie', decor: CalendarOff },
      { key: 'retardsToday', icon: AlertTriangle, color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', value: stats.retardsToday, label: 'Retards du jour', decor: AlertTriangle },
      { key: 'conflitsPending', icon: ShieldCheck, color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', value: stats.conflitsPending, label: 'Conflits à traiter', decor: ShieldCheck },
      { key: 'tauxPresence', icon: TrendingUp, color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.15)', value: `${stats.tauxPresence}%`, label: 'Taux de présence', decor: TrendingUp },
      { key: 'photosToday', icon: Camera, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', value: stats.photosToday, label: 'Photos aujourd\'hui', decor: Camera }
    )
    return cards
  }, [isSuperAdmin, isMultiEntreprise, stats, admin])

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingPulse}><Footprints size={50} color="#F59E0B" /></div>
        <p style={styles.loadingText}>Chargement du tableau de bord...</p>
        <div style={styles.loadingBar}><div style={styles.loadingBarFill}></div></div>
      </div>
    )
  }

  return (
    <>
      <NotificationPermissionPrompt userType="admin" />
      <style>{`
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes badge-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }
        @keyframes tab-glow { 0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.3); } 50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.6); } }
        .afro-stat-card:hover { transform: translateY(-8px) scale(1.02) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4) !important; }
        .afro-action-btn:hover { transform: translateY(-4px) !important; box-shadow: 0 12px 40px rgba(245, 158, 11, 0.3) !important; border-color: #F59E0B !important; }
        .afro-list-item:hover { background: rgba(245, 158, 11, 0.1) !important; border-left: 3px solid #F59E0B !important; padding-left: 17px !important; }
        .afro-nav-btn:hover { background: rgba(245, 158, 11, 0.15) !important; }
        .afro-conflict-item:hover { border-color: rgba(249,115,22,0.4) !important; background: rgba(249,115,22,0.06) !important; }
        .section-card { background: rgba(20, 20, 35, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; }
        .sound-toggle-btn { transition: all 0.3s ease; }
        .sound-toggle-btn:hover { transform: scale(1.1); }
        .sound-toggle-btn:active { transform: scale(0.95); }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .dashboard-two-cols { grid-template-columns: 1fr !important; }
          .dashboard-recent-item { flex-direction: column !important; align-items: flex-start !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
          .desktop-only { display: flex !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 4px; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        {/* ═══ HEADER ═══ */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <div style={styles.logoContainer}><Footprints size={28} color="#F59E0B" /></div>
              <div className="desktop-only" style={{ flexDirection: 'column' }}>
                <h1 style={styles.headerTitle}>EN-CHECK</h1>
                <span style={styles.headerSubtitle}>Administration</span>
              </div>
            </div>
            <div className="desktop-only" style={styles.headerCenter}>
              <EnterpriseSwitcher admin={admin} onSwitch={handleEnterpriseSwitch} />
            </div>
            <div className="desktop-only" style={styles.headerRight}>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                hasHighPriority={hasHighPriority}
                markAsRead={markAsRead}
                markAllAsRead={markAllAsRead}
              />



              <div style={styles.adminInfo}>
                <div style={styles.adminAvatar}>{admin?.first_name?.[0]}{admin?.last_name?.[0]}</div>
                <div style={styles.adminDetails}>
                  <span style={styles.adminName}>{admin?.first_name} {admin?.last_name}</span>
                  <span style={styles.adminRole}>{isSuperAdmin ? '⚡ Super Admin' : (isMultiEntreprise ? '🏢 Multi-Admin' : '👤 Admin')}</span>
                </div>
              </div>
              

                            {isSuperAdmin && (
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  title="Analytics Landing Page"
                  style={{
                    background: showAnalytics ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${showAnalytics ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10,
                    padding: 10,
                    color: showAnalytics ? '#F59E0B' : '#888',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  <Globe size={16} />
                  Analytics
                </button>
              )}
              <button onClick={handleLogout} style={styles.logoutBtn} title="Déconnexion"><LogOut size={18} /></button>
            </div>
            <div className="mobile-only" style={{ alignItems: 'center', gap: '12px' }}>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                hasHighPriority={hasHighPriority}
                markAsRead={markAsRead}
                markAllAsRead={markAllAsRead}
              />



              <div style={styles.adminAvatarSmall}>{admin?.first_name?.[0]}{admin?.last_name?.[0]}</div>
              <button onClick={() => setMobileMenuOpen(true)} style={styles.menuBtn}><Menu size={24} color="#F59E0B" /></button>
            </div>
          </div>
        </header>

        {/* ═══ MOBILE MENU ═══ */}
        {mobileMenuOpen && (
          <div style={styles.mobileOverlay} onClick={() => setMobileMenuOpen(false)}>
            <div style={styles.mobilePanel} onClick={e => e.stopPropagation()}>
              <div style={styles.mobilePanelHeader}>
                <div style={styles.mobilePanelUser}>
                  <div style={styles.adminAvatarLarge}>{admin?.first_name?.[0]}{admin?.last_name?.[0]}</div>
                  <div>
                    <div style={styles.mobilePanelName}>{admin?.first_name} {admin?.last_name}</div>
                    <div style={styles.mobilePanelRole}>{isSuperAdmin ? '⚡ Super Admin' : (isMultiEntreprise ? '🏢 Multi-Admin' : '👤 Admin')}</div>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} style={styles.closeMenuBtn}><X size={24} color="#F59E0B" /></button>
              </div>
              <div style={styles.mobileSwitcher}><EnterpriseSwitcher admin={admin} onSwitch={handleEnterpriseSwitch} /></div>
              <div style={styles.mobileMenuDivider}></div>
              <nav style={styles.mobileNav}>
                {/* ✅ EMPLOYÉS AVEC ANIMATION */}
                <AnimatedTabButton
                  tabState={tabStates.EMPLOYES}
                  icon={Users}
                  label="Employés"
                  path="/employes"
                  onClick={handleTabClick}
                  style={styles.mobileNavBtn}
                  className="afro-nav-btn"
                />

                {/* ✅ POINTAGES AVEC ANIMATION */}
                <AnimatedTabButton
                  tabState={tabStates.POINTAGES}
                  icon={Clock}
                  label="Pointages"
                  path="/pointages"
                  onClick={handleTabClick}
                  style={styles.mobileNavBtn}
                  className="afro-nav-btn"
                />

                {/* ✅ ABSENCES AVEC ANIMATION */}
                {(isSuperAdmin || moduleConges) && (
                  <AnimatedTabButton
                    tabState={tabStates.ABSENCES}
                    icon={CalendarOff}
                    label="Absences & Congés"
                    path="/absences"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ✅ JOURS FÉRIÉS AVEC ANIMATION */}
                <AnimatedTabButton
                  tabState={tabStates.JOURS_FERIES}
                  icon={Calendar}
                  label="Jours fériés"
                  path="/jours-feries"
                  onClick={handleTabClick}
                  style={styles.mobileNavBtn}
                  className="afro-nav-btn"
                />

                {/* ✅ PLANNING AVEC ANIMATION */}
                {(isSuperAdmin || modulePlanning) && (
                  <AnimatedTabButton
                    tabState={tabStates.PLANNING}
                    icon={Calendar}
                    label="Planning"
                    path="/planning"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ✅ PRÉDICTIONS AVEC ANIMATION */}
                {(isSuperAdmin || modulePredictions) && (
                  <AnimatedTabButton
                    tabState={tabStates.PREDICTIONS}
                    icon={Sparkles}
                    label="Prédictions"
                    path="/predictions"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ✅ ÉQUIPES & TÂCHES AVEC ANIMATION */}
                {(isSuperAdmin || moduleTaches) && (
                  <AnimatedTabButton
                    tabState={tabStates.TACHES}
                    icon={ClipboardList}
                    label="Équipes & Tâches"
                    path="/taches"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ✅ RETARDS AVEC ANIMATION */}
                {(isSuperAdmin || moduleRetards) && (
                  <AnimatedTabButton
                    tabState={tabStates.RETARDS}
                    icon={AlertTriangle}
                    label="Retards"
                    path="/retards"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ✅ HEURES SUP AVEC ANIMATION */}
                {(isSuperAdmin || moduleHeuresSup) && (
                  <AnimatedTabButton
                    tabState={tabStates.HEURES_SUP}
                    icon={Timer}
                    label="Heures Sup"
                    path="/heures-supplementaires"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ✅ GEOFENCING AVEC ANIMATION */}
                {(isSuperAdmin || moduleGeofencing) && (
                  <AnimatedTabButton
                    tabState={tabStates.GEOFENCING}
                    icon={MapPin}
                    label="Geofencing"
                    path="/geofencing"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* ENRÔLEMENTS FACIAUX (sans animation) */}
                {(isSuperAdmin || moduleRecoFaciale) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/enrollements-faciaux'); setMobileMenuOpen(false) }}>
                    <Users size={20} color="#EC4899" /><span>Enrôlements Faciaux</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* POINTEUSES / ADMS (option payante) */}
                {(isSuperAdmin || modulePointeuses) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/pointeuses'); setMobileMenuOpen(false) }}>
                    <Radio size={20} color="#14B8A6" /><span>Pointeuses (ADMS)</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* CONFIG RECO FACIALE (sans animation) */}
                {(isSuperAdmin || moduleRecoFaciale) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/config-reco-faciale'); setMobileMenuOpen(false) }}>
                    <Settings size={20} color="#6366F1" /><span>Config Reco Faciale</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* ✅ FICHES DE PAIE AVEC ANIMATION */}
                {(isSuperAdmin || moduleFichesPaie) && (
                  <AnimatedTabButton
                    tabState={tabStates.FICHES_PAIE}
                    icon={Wallet}
                    label="Fiches de Paie"
                    path="/fiches-paie"
                    onClick={handleTabClick}
                    style={styles.mobileNavBtn}
                    className="afro-nav-btn"
                  />
                )}

                {/* RÉMUNÉRATIONS (option payante) */}
                {(isSuperAdmin || moduleRemunerations) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/remunerations'); setMobileMenuOpen(false) }}>
                    <Wallet size={20} color="#0EA5E9" /><span>Rémunérations</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* COÛT SALARIAL (option payante) */}
                {(isSuperAdmin || moduleCoutSalarial) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/cout-salarial'); setMobileMenuOpen(false) }}>
                    <TrendingUp size={20} color="#6366F1" /><span>Coût salarial</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* CONFIGURATION FISCALE (option payante) */}
                {(isSuperAdmin || moduleConfigFiscale) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/configuration-fiscale'); setMobileMenuOpen(false) }}>
                    <Shield size={20} color="#8B5CF6" /><span>Config Fiscale</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* CARTE TEMPS RÉEL (sans animation) */}
                {(isSuperAdmin || moduleCarteTempsReel) && (
                  <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/carte-temps-reel'); setMobileMenuOpen(false) }}>
                    <div className="mobile-only" style={{ alignItems: 'center', gap: '12px' }}></div>          <Activity size={20} color="#6366F1" /><span>Carte Temps Réel</span><ChevronRight size={16} color="#666" />
                  </button>
                )}

                {/* RAPPORTS (sans animation) */}
                <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/rapports'); setMobileMenuOpen(false) }}>
                  <FileText size={20} color="#F59E0B" /><span>Rapports</span><ChevronRight size={16} color="#666" />
                </button>

                {isSuperAdmin && (
                  <>
                    <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/entreprises'); setMobileMenuOpen(false) }}>
                      <Building2 size={20} color="#F59E0B" /><span>Entreprises</span><ChevronRight size={16} color="#666" />
                    </button>
                    <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/admins'); setMobileMenuOpen(false) }}>
                      <Shield size={20} color="#F59E0B" /><span>Admins</span><ChevronRight size={16} color="#666" />
                    </button>
                    <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/system-messages'); setMobileMenuOpen(false) }}>
                      <AlertTriangle size={20} color="#F59E0B" /><span>Messages Système</span><ChevronRight size={16} color="#666" />
                    </button>
                    <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/connexions'); setMobileMenuOpen(false) }}>
                      <Activity size={20} color="#10B981" /><span>Journal Connexions</span><ChevronRight size={16} color="#666" />
                    </button>
                  </>
                )}

                <div style={styles.mobileMenuDivider}></div>
                <div style={{ padding: '8px 16px 4px', color: '#22C55E', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Portail Employé
                </div>
                <button className="afro-nav-btn" style={{ ...styles.mobileNavBtn, color: '#22C55E' }} onClick={() => { window.open('/employee/login', '_blank'); setMobileMenuOpen(false) }}>
                  <Users size={20} color="#22C55E" />
                  <span style={{ flex: 1 }}>Espace Employé</span>
                  <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>↗ Portail</span>
                </button>

                {isSuperAdmin && (
                  <>
                    <div style={styles.mobileMenuDivider}></div>
                    <div style={{ padding: '8px 16px 4px', color: '#F59E0B', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>
                      Espace En-Check
                    </div>
                    <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/prospection'); setMobileMenuOpen(false) }}>
                      <TrendingUp size={20} color="#10B981" /><span>Prospection</span><ChevronRight size={16} color="#666" />
                    </button>
                    <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/devis'); setMobileMenuOpen(false) }}>
                      <FileSearch size={20} color="#6366F1" /><span>Devis</span><ChevronRight size={16} color="#666" />
                    </button>
                    

                                        <button className="afro-nav-btn" style={styles.mobileNavBtn} onClick={() => { navigate('/push-notifications'); setMobileMenuOpen(false) }}>
                      <Bell size={20} color="#F59E0B" /><span>Notifications Push</span><ChevronRight size={16} color="#666" />
                    </button>
                    <button
                      className="afro-nav-btn"
                      style={styles.mobileNavBtn}
                      onClick={() => {
                        setShowAnalytics(true)
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Globe size={20} color="#F59E0B" />
                      <span>Analytics Landing Page</span>
                      <ChevronRight size={16} color="#666" />
                    </button>
                  </>
                )}
              </nav>
              <div style={styles.mobileMenuDivider}></div>
              <button onClick={handleLogout} style={styles.mobileLogoutBtn}><LogOut size={20} /><span>Déconnexion</span></button>
            </div>
          </div>
        )}

        {/* ═══ MAIN ═══ */}
        <main style={styles.main}>
                    <SystemMessageBanner userType="admins" />

          {/* ═══ ANALYTICS PANEL (superadmin seulement) ═══ */}
          {isSuperAdmin && showAnalytics && (
            <div
              style={{
                background: 'rgba(20,20,35,0.8)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 20,
                padding: 24,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={20} color="#F59E0B" />
                  <span style={{ color: '#F59E0B', fontWeight: 900, fontSize: 16 }}>
                    Analytics Landing Page
                  </span>
                </div>
                <button
                  onClick={() => setShowAnalytics(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  ✕ Fermer
                </button>
              </div>
              <LandingAnalytics />
            </div>
          )}






          {/* Welcome */}
          <div style={styles.welcomeSection}>
            <div style={styles.welcomeContent}>
              <h2 style={styles.welcomeGreeting}>
                {greeting()}, <span style={styles.welcomeName}>{admin?.first_name}</span> 👋
              </h2>
              <p style={styles.welcomeDate}>
                {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div style={styles.welcomeBadges}>
                {admin?.selectedEnterprise && (
                  <div style={styles.activeEnterpriseBadge}><Activity size={14} /><span>{admin.selectedEnterprise.name}</span></div>
                )}
                <div style={styles.todayBadge}><UserCheck size={14} /><span>{stats.presentsToday} présents aujourd'hui</span></div>

                {todayHoliday && (
                  <div style={{
                    ...styles.alertBadge,
                    background: 'rgba(139,92,246,0.12)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    color: '#8B5CF6'
                  }}>
                    <Calendar size={14} />
                    <span>🎌 {todayHoliday.name}</span>
                  </div>
                )}
                {stats.conflitsPending > 0 && (
                  <div style={{ ...styles.alertBadge, background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.25)', color: '#F97316' }}>
                    <ShieldCheck size={14} /><span>{stats.conflitsPending} conflit{stats.conflitsPending > 1 ? 's' : ''} à traiter</span>
                  </div>
                )}

                {scheduleRequestsPending.length > 0 && (
                  <div style={{ ...styles.alertBadge, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#6366F1' }}>
                    <CalendarDays size={14} /><span>{scheduleRequestsPending.length} demande{scheduleRequestsPending.length > 1 ? 's' : ''}</span>
                  </div>
                )}

                {unreadCount > 0 && (
                  <div style={{ ...styles.alertBadge, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', color: '#F59E0B' }}>
                    <BellRing size={14} /><span>{unreadCount} notification{unreadCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={styles.welcomeTime}>
              <span style={styles.timeDisplay}>{currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={styles.timeSeconds}>{currentTime.toLocaleTimeString('fr-FR', { second: '2-digit' }).split(':').pop()}s</span>
            </div>
          </div>

          {/* Bannière conflits prioritaire */}
          {stats.conflitsPending > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(249,115,22,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={22} color="#F97316" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#F97316', fontSize: 15, fontWeight: 700, margin: '0 0 4px 0' }}>
                  {stats.conflitsPending} conflit{stats.conflitsPending > 1 ? 's' : ''} absence/pointage en attente
                </p>
                <p style={{ color: '#BFA48A', fontSize: 13, margin: 0 }}>
                  Des employés ont pointé alors qu'une absence était déclarée. Votre action est requise.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/pointages')} style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.3)', color: '#F97316', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Voir dans Pointages
                </button>
                {moduleConges && (
                  <button onClick={() => navigate('/absences')} style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.3)', color: '#F97316', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Voir dans Absences
                  </button>
                )}
              </div>
            </div>
          )}

          {scheduleRequestsPending.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 16,
              marginBottom: 24,
              flexWrap: 'wrap'
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(99,102,241,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CalendarDays size={22} color="#6366F1" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#818CF8', fontSize: 15, fontWeight: 700, margin: '0 0 4px 0' }}>
                  {scheduleRequestsPending.length} demande{scheduleRequestsPending.length > 1 ? 's' : ''} de modification d'horaires
                </p>
                <p style={{ color: '#A5B4FC', fontSize: 13, margin: 0 }}>
                  Des employés souhaitent modifier leur planning ou leurs horaires de travail.
                </p>
              </div>
              <button
                onClick={() => navigate('/planning')}
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818CF8',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Voir le planning
              </button>
            </div>
          )}

          {/* VD-01 : Bandeau d'erreur explicite si le chargement a échoué */}
          {loadError && (
            <div
              role="alert"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.16), rgba(185,28,28,0.10))',
                border: '1px solid rgba(239,68,68,0.45)',
                borderRadius: 16,
                padding: '16px 22px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#EF4444" />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: '#FCA5A5', fontSize: 15, fontWeight: 700, margin: '0 0 4px 0' }}>
                  Impossible de charger les données — Réessayer
                </p>
                <p style={{ color: '#FECACA', fontSize: 13, margin: 0 }}>
                  Les compteurs affichés ne reflètent pas l’activité réelle ({loadError}).
                </p>
              </div>
              <button
                onClick={() => admin && loadData(admin)}
                style={{
                  background: '#EF4444',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Réessayer
              </button>
            </div>
          )}

          {/* KPI Cards */}
          <div className="stats-grid" style={styles.statsGrid}>
            {kpiCards.map((card) => {
              const Icon = card.icon
              const Decor = card.decor
              return (
                <div key={card.key} className="afro-stat-card" style={{ ...styles.statCard, ...(card.key === 'conflitsPending' && stats.conflitsPending > 0 ? { borderColor: 'rgba(249,115,22,.25)' } : {}) }}>
                  <div style={styles.statCardGlow}></div>
                  <div style={{ ...styles.statIconWrap, background: card.bg }}><Icon size={28} color={card.color} /></div>
                  <div style={styles.statContent}>
                    <span style={styles.statNumber}>{card.value}</span>
                    <span style={styles.statLabel}>{card.label}</span>
                  </div>
                  <div style={styles.statDecor}><Decor size={60} color={`${card.color}20`} /></div>
                </div>
              )
            })}
          </div>

          {/* Dashboard blocks */}
          <div className="dashboard-two-cols" style={styles.dashboardGrid}>
            {/* Alertes + Conflits */}
            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleWrap}>
                  <div style={styles.sectionIcon}><AlertTriangle size={20} color="#F59E0B" /></div>
                  <h3 style={styles.sectionTitle}>Alertes & Vigilance</h3>
                </div>
              </div>

              <div style={styles.alertsList}>
                {alerts.map((alert, index) => {
                  const Icon = alert.icon
                  return (
                    <div key={index} style={styles.alertItem}>
                      <div style={{ ...styles.alertIconWrap, background: `${alert.color}20` }}><Icon size={18} color={alert.color} /></div>
                      <div style={styles.alertContent}>
                        <p style={styles.alertTitle}>{alert.title}</p>
                        <p style={styles.alertSubtitle}>{alert.subtitle}</p>
                      </div>
                      {alert.action && alert.actionFn && (
                        <button onClick={alert.actionFn} style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.3)', color: '#F97316', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          {alert.action}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {conflictsPending.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ color: '#F97316', fontSize: 13, fontWeight: 700, margin: 0 }}>
                      <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Conflits en attente ({conflictsPending.length})
                    </p>
                    {canManageConflict && (
                      <button onClick={() => navigate('/pointages')} style={{ background: 'none', border: 'none', color: '#F59E0B', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Tout voir →
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {conflictsPending.slice(0, 5).map((conflict, i) => {
                      const motifMap = { conge: { label: 'Congé payé', emoji: '🌴' }, maladie: { label: 'Maladie', emoji: '🏥' }, maternite: { label: 'Maternité', emoji: '👶' }, injustifie: { label: 'Injustifiée', emoji: '⚠️' }, formation: { label: 'Formation', emoji: '📚' }, deces: { label: 'Décès', emoji: '🕊️' }, autre: { label: 'Autre', emoji: '📋' } }
                      const motif = motifMap[conflict.absences?.reason] || motifMap.autre
                      return (
                        <div key={conflict.id} className="afro-conflict-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(249,115,22,.05)', border: '1px solid rgba(249,115,22,.12)', borderRadius: 12, transition: 'all .2s ease' }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {conflict.employees?.photo_url
                              ? <img src={conflict.employees.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: 13 }}>{conflict.employees?.first_name?.[0]}{conflict.employees?.last_name?.[0]}</span>
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: '#FFF', fontSize: 13, fontWeight: 600, margin: '0 0 3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {conflict.employees?.first_name} {conflict.employees?.last_name}
                            </p>
                            <p style={{ color: '#888', fontSize: 11, margin: 0 }}>
                              {motif.emoji} {motif.label}
                              {conflict.absences?.start_date && ` · Du ${new Date(conflict.absences.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                              {conflict.absences?.end_date && ` au ${new Date(conflict.absences.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                            </p>
                          </div>
                          {canManageConflict && (
                            <button onClick={() => openConflictModal(conflict)} style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.3)', color: '#F97316', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                              Gérer
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {conflictsPending.length > 5 && (
                      <button onClick={() => navigate('/pointages')} style={{ background: 'none', border: '1px dashed rgba(249,115,22,.3)', color: '#F97316', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        +{conflictsPending.length - 5} autres conflits → Voir dans Pointages
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Activité récente */}
            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleWrap}>
                  <div style={styles.sectionIcon}><Activity size={20} color="#F59E0B" /></div>
                  <h3 style={styles.sectionTitle}>Activité récente</h3>
                </div>
                <button style={styles.manageBtn} onClick={() => navigate('/pointages')}>
                  <span>Voir tout</span><ArrowRight size={14} />
                </button>
              </div>
              <div style={styles.recentList}>
                {recentActivity.length === 0 ? (
                  <div style={styles.emptyMini}><Clock size={24} color="#666" /><span style={styles.emptyMiniText}>Aucun pointage aujourd'hui</span></div>
                ) : (
                  recentActivity.map((item) => (
                    <div key={item.id} className="dashboard-recent-item" style={styles.recentItem}>
                      <div style={styles.recentLeft}>
                        <div style={styles.recentAvatar}>
                          {item.employee?.photo_url
                            ? <img src={item.employee.photo_url} alt="" style={styles.recentAvatarImg} />
                            : <span style={styles.recentAvatarText}>{item.employee?.first_name?.[0]}{item.employee?.last_name?.[0]}</span>
                          }
                        </div>
                        <div style={styles.recentInfo}>
                          <span style={styles.recentName}>{item.employee?.first_name} {item.employee?.last_name}</span>
                          <span style={styles.recentMeta}>{item.employee?.matricule} {item.hasPhoto ? '• 📸' : ''}</span>
                        </div>
                      </div>
                      <div style={styles.recentRight}>
                        <span style={{ ...styles.recentTypeBadge, background: item.type === 'in' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: item.type === 'in' ? '#10B981' : '#F59E0B', border: `1px solid ${item.type === 'in' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                          {item.type === 'in' ? <LogIn size={12} /> : <LogOutIcon size={12} />}
                          {item.type === 'in' ? 'Entrée' : 'Sortie'}
                        </span>
                        <span style={styles.recentTime}>{formaterHeureLocale(item.time)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Répartition + Top entreprises */}
          <div className="dashboard-two-cols" style={styles.dashboardGrid}>
            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleWrap}>
                  <div style={styles.sectionIcon}><BarChart3 size={20} color="#F59E0B" /></div>
                  <h3 style={styles.sectionTitle}>Répartition du jour</h3>
                </div>
              </div>
              <div style={styles.progressList}>
                {[
                  { label: 'Présents', value: stats.presentsToday, color: '#10B981', gradient: 'linear-gradient(90deg, #10B981, #34D399)' },
                  { label: 'Absents', value: stats.absentsToday, color: '#EF4444', gradient: 'linear-gradient(90deg, #EF4444, #F87171)' },
                  { label: 'Congés / maladie', value: stats.congesToday, color: '#8B5CF6', gradient: 'linear-gradient(90deg, #8B5CF6, #A78BFA)' },
                ].map((item, i) => (
                  <div key={i} style={styles.progressItem}>
                    <div style={styles.progressTop}>
                      <span style={styles.progressLabel}>{item.label}</span>
                      <span style={{ ...styles.progressValue, color: item.color }}>{item.value}</span>
                    </div>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${stats.employes ? Math.min((item.value / stats.employes) * 100, 100) : 0}%`, background: item.gradient }} />
                    </div>
                  </div>
                ))}
                <div style={styles.progressSummaryBox}>
                  <div style={styles.progressSummaryItem}>
                    <span style={styles.progressSummaryLabel}>Taux de présence</span>
                    <span style={styles.progressSummaryNumber}>{stats.tauxPresence}%</span>
                  </div>
                  <div style={{ ...styles.progressSummaryItem, ...(stats.conflitsPending > 0 ? { borderColor: 'rgba(249,115,22,.2)', background: 'rgba(249,115,22,.05)' } : {}) }}>
                    <span style={styles.progressSummaryLabel}>Conflits en attente</span>
                    <span style={{ ...styles.progressSummaryNumber, color: stats.conflitsPending > 0 ? '#F97316' : '#FFF' }}>{stats.conflitsPending}</span>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleWrap}>
                  <div style={styles.sectionIcon}><TrendingUp size={20} color="#F59E0B" /></div>
                  <h3 style={styles.sectionTitle}>{isSuperAdmin ? 'Top entreprises du jour' : 'Synthèse opérationnelle'}</h3>
                </div>
              </div>
              {isSuperAdmin ? (
                <div style={styles.topList}>
                  {topEntreprises.length === 0
                    ? <div style={styles.emptyMini}><Building2 size={24} color="#666" /><span style={styles.emptyMiniText}>Aucune donnée disponible</span></div>
                    : topEntreprises.map((ent, index) => (
                      <div key={ent.id} style={styles.topItem}>
                        <div style={styles.topRank}>{index + 1}</div>
                        <div style={styles.topLogoWrap}>
                          {ent.logo_url
                            ? <img src={ent.logo_url} alt="" style={styles.topLogo} />
                            : <div style={styles.topLogoPlaceholder}><Building2 size={16} color="#F59E0B" /></div>
                          }
                        </div>
                        <div style={styles.topInfo}>
                          <span style={styles.topName}>{ent.name}</span>
                          <span style={styles.topMeta}>{ent.presentsToday}/{ent.employeesCount} présents</span>
                        </div>
                        <div style={styles.topRate}>{ent.tauxPresence}%</div>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <div style={styles.summaryCardsGrid}>
                  {[
                    { icon: Timer, color: '#F97316', value: stats.retardsToday, label: 'retards du jour' },
                    { icon: Camera, color: '#EC4899', value: stats.photosToday, label: 'pointages photo' },
                    { icon: Clock, color: '#F59E0B', value: stats.oublisSortie, label: 'oublis de sortie' },
                    { icon: ShieldCheck, color: '#F97316', value: stats.conflitsPending, label: 'conflits à traiter' },
                  ].map((item, i) => (
                    <div key={i} style={{ ...styles.summaryMiniCard, ...(item.label === 'conflits à traiter' && item.value > 0 ? { borderColor: 'rgba(249,115,22,.2)', background: 'rgba(249,115,22,.05)' } : {}) }}>
                      <item.icon size={18} color={item.color} />
                      <div>
                        <span style={{ ...styles.summaryMiniValue, color: item.label === 'conflits à traiter' && item.value > 0 ? '#F97316' : '#FFF' }}>{item.value}</span>
                        <span style={styles.summaryMiniLabel}>{item.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Entreprises */}
          {isSuperAdmin && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleWrap}>
                  <div style={styles.sectionIcon}><Building2 size={20} color="#F59E0B" /></div>
                  <h3 style={styles.sectionTitle}>Entreprises</h3>
                </div>
                <button style={styles.manageBtn} onClick={() => navigate('/entreprises')}><Plus size={16} /><span>Gérer</span></button>
              </div>
              <div style={styles.listContainer}>
                {entreprises.slice(0, 5).map((entreprise, index) => (
                  <div
                    key={entreprise.id}
                    className="afro-list-item"
                    style={{
                      ...styles.listItem,
                      animationDelay: `${index * 0.1}s`,
                      borderLeft: admin?.selectedEnterprise?.id === entreprise.id ? '3px solid #F59E0B' : '3px solid transparent',
                    }}
                    title="Cliquer pour sélectionner cette entreprise et charger ses données"
                    onClick={() => {
                      const updatedAdmin = {
                        ...admin,
                        entreprises,
                        selectedEnterprise: entreprise,
                      }
                      localStorage.setItem('admin', JSON.stringify(updatedAdmin))
                      localStorage.setItem('last_enterprise_id', entreprise.id)
                      if (admin?.id) {
                        localStorage.setItem(`last_enterprise_id_${admin.id}`, entreprise.id)
                      }
                      window.location.reload()
                    }}
                  >
                    <div style={styles.listItemLeft}>
                      {entreprise.logo_url
                        ? <img src={entreprise.logo_url} alt="" style={styles.enterpriseLogo} />
                        : <div style={styles.enterpriseLogoPlaceholder}><Building2 size={20} color="#F59E0B" /></div>
                      }
                      <div>
                        <div style={styles.listItemName}>
                          {entreprise.name}
                          {admin?.selectedEnterprise?.id === entreprise.id && (
                            <span style={styles.activeBadge}><Zap size={10} /> Active</span>
                          )}
                        </div>
                        <span style={styles.listItemSub}>{entreprise.employees?.[0]?.count || 0} employés · Cliquer pour activer</span>
                      </div>
                    </div>
                    <ArrowRight size={18} color="#F59E0B" />
                  </div>
                ))}
              </div>
              {entreprises.length > 5 && (
                <button onClick={() => navigate('/entreprises')} style={styles.viewAllBtn}>
                  <span>Voir toutes les entreprises ({entreprises.length})</span><ArrowRight size={16} />
                </button>
              )}
            </div>
          )}

          {/* Actions rapides */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitleWrap}>
                <div style={styles.sectionIcon}><Zap size={20} color="#F59E0B" /></div>
                <h3 style={styles.sectionTitle}>Actions Rapides</h3>
              </div>
            </div>
            <div style={styles.actionsGrid}>
              {[
                { label: 'Employés', sub: 'Gérer l\'équipe', icon: Users, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', path: '/employes', show: true, animated: true, tabKey: 'EMPLOYES' },
                { label: 'Pointages', sub: 'Voir les présences', icon: Clock, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', path: '/pointages', show: true, animated: true, tabKey: 'POINTAGES' },
                { label: 'Absences & Congés', sub: 'Suivi des absences', icon: CalendarOff, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', path: '/absences', show: isSuperAdmin || moduleConges, animated: true, tabKey: 'ABSENCES' },
                { label: 'Jours fériés', sub: 'Configurer les jours fériés', icon: Calendar, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', path: '/jours-feries', show: true, animated: true, tabKey: 'JOURS_FERIES' },
                { label: 'Planning', sub: 'Horaires & shifts', icon: Calendar, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', path: '/planning', show: isSuperAdmin || modulePlanning, animated: true, tabKey: 'PLANNING' },
                { label: 'Équipes & Tâches', sub: 'Créer, assigner et suivre', icon: ClipboardList, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', path: '/taches', show: isSuperAdmin || moduleTaches, animated: true, tabKey: 'TACHES' },
                { label: 'Équipes', sub: 'Structurer les équipes', icon: Users2, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', path: '/equipes', show: isSuperAdmin || moduleTaches, animated: false },
                { label: 'Prédictions', sub: 'Charge, besoins, tendances', icon: Sparkles, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', path: '/predictions', show: isSuperAdmin || modulePredictions, animated: true, tabKey: 'PREDICTIONS' },
                { label: 'Retards', sub: 'Suivi & alertes', icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', path: '/retards', show: isSuperAdmin || moduleRetards, animated: true, tabKey: 'RETARDS' },
                { label: 'Heures Sup', sub: 'Calcul & majorations', icon: Timer, color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', path: '/heures-supplementaires', show: isSuperAdmin || moduleHeuresSup, animated: true, tabKey: 'HEURES_SUP' },
                { label: 'Geofencing', sub: 'Zones GPS autorisées', icon: MapPin, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', path: '/geofencing', show: isSuperAdmin || moduleGeofencing, animated: true, tabKey: 'GEOFENCING' },
                { label: 'Enrôlements Faciaux', sub: 'Valider les profils', icon: Users, color: '#EC4899', bg: 'rgba(236,72,153,0.15)', path: '/enrollements-faciaux', show: isSuperAdmin || moduleRecoFaciale, animated: false },
                { label: 'Pointeuses (ADMS)', sub: 'Machines à badge réseau', icon: Radio, color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', path: '/pointeuses', show: isSuperAdmin || modulePointeuses, animated: false },
                { label: 'Config Faciale', sub: 'Paramètres biométriques', icon: Settings, color: '#6366F1', bg: 'rgba(99,102,241,0.15)', path: '/config-reco-faciale', show: isSuperAdmin || moduleRecoFaciale, animated: false },
                { label: 'Fiches de Paie', sub: 'Bulletins & variables', icon: Wallet, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', path: '/fiches-paie', show: isSuperAdmin || moduleFichesPaie, animated: true, tabKey: 'FICHES_PAIE' },
                { label: 'Rémunérations', sub: 'Contrats, bases et taux', icon: Wallet, color: '#0EA5E9', bg: 'rgba(14,165,233,0.15)', path: '/remunerations', show: isSuperAdmin || moduleRemunerations, animated: false },
                { label: 'Coût salarial', sub: 'Ce que coûte chaque personne', icon: TrendingUp, color: '#6366F1', bg: 'rgba(99,102,241,0.15)', path: '/cout-salarial', show: isSuperAdmin || moduleCoutSalarial, animated: false },
                { label: 'Config Fiscale', sub: 'Cotisations & barème d\'impôt', icon: Shield, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', path: '/configuration-fiscale', show: isSuperAdmin || moduleConfigFiscale, animated: false },
                { label: 'Carte Temps Réel', sub: 'Visualisation géographique', icon: Activity, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', path: '/carte-temps-reel', show: isSuperAdmin || moduleCarteTempsReel, animated: false },
                { label: 'Rapports', sub: 'Exports & stats', icon: FileText, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', path: '/rapports', show: true, animated: false },
                { label: 'Admins', sub: 'Gestion des accès', icon: Shield, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', path: '/admins', show: isSuperAdmin, animated: false },
                { label: 'Messages', sub: 'Notifications système', icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', path: '/system-messages', show: isSuperAdmin, animated: false },
                { label: 'Prospection', sub: 'Suivi des prospects', icon: TrendingUp, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', path: '/prospection', show: isSuperAdmin, animated: false },
                { label: 'Devis', sub: 'Générer un devis', icon: FileSearch, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', path: '/devis', show: isSuperAdmin, animated: false },
                { label: 'Push Notifications', sub: 'Envoyer des notifications ciblées', icon: Bell, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', path: '/push-notifications', show: isSuperAdmin, animated: false },
                { label: 'Journal Connexions', sub: 'Suivi des accès admin & employés', icon: Activity, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', path: '/connexions', show: isSuperAdmin, animated: false },
                { label: 'Portail Employé', sub: 'Accès espace self-service', icon: Users, color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)', path: '/employee/login', show: true, external: true, animated: false },
              ].filter(a => a.show).map((action, i) => {
                   if (action.animated && action.tabKey) {
      const tabState = tabStates[action.tabKey]
      
      return (
        <div key={i} style={{ position: 'relative' }}>
          <button
            className="afro-action-btn"
            style={{
              ...styles.actionBtn,
              ...(tabState && !tabState.viewed ? {
                borderColor: `rgba(${hexToRgb(action.color)}, 0.4)`,
                background: `rgba(${hexToRgb(action.color)}, 0.08)`
              } : {})
            }}
            onClick={() => {
              // ✅ IMPORTANT : Marquer comme vu AVANT de naviguer
              if (action.tabKey) {
                console.log(`🖱️ Clic sur ${action.tabKey}`)
                markTabAsViewed(action.tabKey)
              }
              navigate(action.path)
            }}
          >
            <div style={{ ...styles.actionIconWrap, background: action.bg }}>
              <action.icon size={22} color={action.color} />
            </div>
            <div style={styles.actionTextWrap}>
              <span style={{ ...styles.actionTitle }}>
                {action.label}
              </span>
              <span style={styles.actionSub}>{action.sub}</span>
            </div>
            <ArrowRight size={16} color="#555" />
          </button>
        </div>
      )
    }

    // Bouton normal (sans animation)
    return (
      <button
        key={i}
        className="afro-action-btn"
        style={styles.actionBtn}
        onClick={() => action.external ? window.open(action.path, '_blank') : navigate(action.path)}
      >
        <div style={{ ...styles.actionIconWrap, background: action.bg }}>
          <action.icon size={22} color={action.color} />
        </div>
        <div style={styles.actionTextWrap}>
          <span style={styles.actionTitle}>{action.label}</span>
          <span style={styles.actionSub}>{action.sub}</span>
        </div>
        {action.external && (
          <span style={{ 
            background: 'rgba(34, 197, 94, 0.15)', 
            color: '#22C55E', 
            borderRadius: '8px', 
            padding: '3px 8px', 
            fontSize: '10px', 
            fontWeight: '700'
          }}>↗</span>
        )}
        <ArrowRight size={16} color="#555" />
      </button>
                )
              })}
            </div>
          </div>

          <div style={styles.footer}>
            <div style={styles.footerLine}></div>
            <p style={styles.footerText}><Footprints size={14} color="#F59E0B" />EN-CHECK • Système de Pointage Intelligent</p>
          </div>
        </main>

        <SpotlightFAB admin={admin} />

      </div>

      {/* ═══ MODAL GESTION CONFLIT ═══ */}
      {showConflictModal && selectedConflict && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, animation: 'fadeIn .2s ease' }} onClick={() => setShowConflictModal(false)}>
          <div style={{ background: '#141423', border: '1px solid rgba(249,115,22,.2)', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.5)', animation: 'slideUp .3s ease forwards' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(249,115,22,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={24} color="#F97316" />
                </div>
                <div>
                  <h2 style={{ color: '#FFF', fontSize: 20, fontWeight: 700, margin: 0 }}>Gérer le conflit</h2>
                  <p style={{ color: '#F97316', fontSize: 13, margin: '4px 0 0 0' }}>
                    {selectedConflict.employees?.first_name} {selectedConflict.employees?.last_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowConflictModal(false)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
                {[
                  { label: 'Employé', value: `${selectedConflict.employees?.first_name} ${selectedConflict.employees?.last_name}` },
                  { label: 'Motif absence', value: selectedConflict.absences?.reason || 'Inconnu' },
                  { label: 'Période', value: selectedConflict.absences?.start_date ? `${new Date(selectedConflict.absences.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} → ${new Date(selectedConflict.absences.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : '—' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 14 }}>
                    <span style={{ display: 'block', color: '#666', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{item.label}</span>
                    <span style={{ display: 'block', color: '#FFF', fontSize: 13, fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ color: '#E5E5E5', fontSize: 13, fontWeight: 500 }}>Note de résolution (optionnel)</label>
                <textarea value={conflictNote} onChange={e => setConflictNote(e.target.value)} style={{ minHeight: 90, resize: 'vertical', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#FFF', fontFamily: 'inherit', fontSize: 14, outline: 'none' }} placeholder="Ex: Retour anticipé validé par le responsable..." />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { action: 'kept_absence', icon: CheckCircle2, color: '#10B981', borderColor: 'rgba(16,185,129,.2)', bg: 'rgba(16,185,129,.08)', title: 'Maintenir l\'absence', subtitle: 'Le pointage reste, l\'absence est conservée' },
                  { action: 'cancelled_absence', icon: ShieldCheck, color: '#6366F1', borderColor: 'rgba(99,102,241,.2)', bg: 'rgba(99,102,241,.08)', title: 'Annuler l\'absence', subtitle: 'Le pointage reste, l\'absence est supprimée' },
                  { action: 'ignored_conflict', icon: Ban, color: '#9CA3AF', borderColor: 'rgba(107,114,128,.2)', bg: 'rgba(107,114,128,.08)', title: 'Ignorer le conflit', subtitle: 'Marquer comme vu sans modifier les données' },
                ].map((item, i) => (
                  <button key={i} onClick={() => resolveConflict(item.action)} disabled={resolvingConflict} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, border: `1px solid ${item.borderColor}`, background: item.bg, color: item.color, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <item.icon size={20} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px 0' }}>{item.title}</p>
                      <p style={{ fontSize: 12, opacity: .8, margin: 0 }}>{item.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ✅ HELPER FUNCTION
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '245, 158, 11'
}

const styles = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)`, pointerEvents: 'none', zIndex: 0 },
  bgOrb1: { position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  bgOrb2: { position: 'fixed', bottom: '-30%', left: '-15%', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#0A0A0F' },
  loadingPulse: { animation: 'float 2s ease-in-out infinite' },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px' },
  loadingBar: { width: '200px', height: '2px', background: 'rgba(245,158,11,0.1)', borderRadius: '2px', overflow: 'hidden' },
  loadingBarFill: { width: '40%', height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: '2px', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' },
  header: { background: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(245, 158, 11, 0.15)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: '1400px', margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoContainer: { width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '700', letterSpacing: '3px', margin: 0, lineHeight: '1.2' },
  headerSubtitle: { color: '#F59E0B', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: '500' },
  headerCenter: { alignItems: 'center' },
  headerRight: { alignItems: 'center', gap: '16px' },
  adminInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  adminAvatar: { width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '700', fontSize: '14px', letterSpacing: '1px' },
  adminAvatarSmall: { width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '700', fontSize: '12px' },
  adminAvatarLarge: { width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '700', fontSize: '16px', letterSpacing: '1px' },
  adminDetails: { display: 'flex', flexDirection: 'column' },
  adminName: { color: '#FFFFFF', fontWeight: '600', fontSize: '14px' },
  adminRole: { color: '#F59E0B', fontSize: '11px', fontWeight: '500' },
  logoutBtn: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '10px', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  menuBtn: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mobileOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200 },
  mobilePanel: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(85vw, 360px)', background: '#0F0F19', borderLeft: '1px solid rgba(245, 158, 11, 0.15)', display: 'flex', flexDirection: 'column', overflow: 'auto' },
  mobilePanelHeader: { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  mobilePanelUser: { display: 'flex', alignItems: 'center', gap: '12px' },
  mobilePanelName: { color: '#FFFFFF', fontWeight: '600', fontSize: '16px' },
  mobilePanelRole: { color: '#F59E0B', fontSize: '12px', marginTop: '2px' },
  closeMenuBtn: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mobileSwitcher: { padding: '16px 20px' },
  mobileMenuDivider: { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 20px' },
  mobileNav: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  mobileNavBtn: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', background: 'transparent', border: 'none', color: '#E5E5E5', fontSize: '15px', fontWeight: '500', cursor: 'pointer', width: '100%', textAlign: 'left' },
  mobileLogoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '16px 20px', padding: '14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  main: { padding: '24px 20px', maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 },
  welcomeSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' },
  welcomeContent: { flex: 1, minWidth: '200px' },
  welcomeGreeting: { color: '#FFFFFF', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: '300', margin: '0 0 8px 0', letterSpacing: '0.5px' },
  welcomeName: { color: '#F59E0B', fontWeight: '600' },
  welcomeDate: { color: '#888', fontSize: '14px', margin: '0 0 12px 0', textTransform: 'capitalize' },
  welcomeBadges: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  activeEnterpriseBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '6px 16px', borderRadius: '20px', color: '#F59E0B', fontSize: '13px', fontWeight: '500' },
  todayBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px 16px', borderRadius: '20px', color: '#10B981', fontSize: '13px', fontWeight: '500' },
  alertBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 16px', borderRadius: '20px', color: '#EF4444', fontSize: '13px', fontWeight: '500' },
  welcomeTime: { display: 'flex', alignItems: 'baseline', gap: '4px' },
  timeDisplay: { color: '#FFFFFF', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: '200', letterSpacing: '2px', fontVariantNumeric: 'tabular-nums' },
  timeSeconds: { color: '#F59E0B', fontSize: '14px', fontWeight: '500' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '32px' },
  statCard: { background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: 'clamp(16px, 3vw, 28px)', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', cursor: 'default', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' },
  statCardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.4), transparent)' },
  statIconWrap: { width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { display: 'flex', flexDirection: 'column', zIndex: 1 },
  statNumber: { fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: '700', color: '#FFFFFF', lineHeight: '1', marginBottom: '4px' },
  statLabel: { fontSize: '13px', color: '#888', fontWeight: '500', letterSpacing: '0.5px' },
  statDecor: { position: 'absolute', right: '16px', bottom: '12px', opacity: 0.5 },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '32px' },
  sectionCard: { background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '20px' },
  section: { marginBottom: '40px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  sectionTitleWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
  sectionIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '600', margin: 0, letterSpacing: '0.5px' },
  manageBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', padding: '8px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  alertsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  alertItem: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' },
  alertIconWrap: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alertContent: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 },
  alertTitle: { color: '#FFFFFF', fontSize: '14px', fontWeight: '600', margin: 0 },
  alertSubtitle: { color: '#888', fontSize: '12px', margin: 0, lineHeight: '1.4' },
  recentList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  recentItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px' },
  recentLeft: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 },
  recentAvatar: { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  recentAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  recentAvatarText: { color: '#F59E0B', fontSize: '13px', fontWeight: '700' },
  recentInfo: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  recentName: { color: '#FFFFFF', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  recentMeta: { color: '#666', fontSize: '11px', marginTop: '2px' },
  recentRight: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  recentTypeBadge: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' },
  recentTime: { color: '#F59E0B', fontWeight: '700', fontSize: '12px', fontVariantNumeric: 'tabular-nums' },
  progressList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  progressItem: { display: 'flex', flexDirection: 'column', gap: '8px' },
  progressTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: '#E5E5E5', fontSize: '13px', fontWeight: '500' },
  progressValue: { fontSize: '13px', fontWeight: '700' },
  progressTrack: { width: '100%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '999px', transition: 'width 0.4s ease' },
  progressSummaryBox: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '8px' },
  progressSummaryItem: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' },
  progressSummaryLabel: { color: '#888', fontSize: '12px' },
  progressSummaryNumber: { color: '#FFFFFF', fontSize: '22px', fontWeight: '700' },
  topList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  topItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' },
  topRank: { width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', flexShrink: 0 },
  topLogoWrap: { flexShrink: 0 },
  topLogo: { width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' },
  topLogoPlaceholder: { width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  topInfo: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  topName: { color: '#FFFFFF', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  topMeta: { color: '#666', fontSize: '11px', marginTop: '2px' },
  topRate: { color: '#10B981', fontSize: '16px', fontWeight: '700', flexShrink: 0 },
  summaryCardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  summaryMiniCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' },
  summaryMiniValue: { display: 'block', color: '#FFFFFF', fontSize: '20px', fontWeight: '700', lineHeight: 1 },
  summaryMiniLabel: { display: 'block', color: '#888', fontSize: '11px', marginTop: '4px' },
  listContainer: { background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' },
  listItemLeft: { display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 },
  enterpriseLogo: { width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' },
  enterpriseLogoPlaceholder: { width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listItemName: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', color: '#FFFFFF', fontSize: '15px', flexWrap: 'wrap' },
  activeBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontSize: '10px', padding: '2px 10px', borderRadius: '10px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' },
  listItemSub: { display: 'block', fontSize: '13px', color: '#666', marginTop: '2px' },
  viewAllBtn: { width: '100%', padding: '14px', marginTop: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '14px', color: '#F59E0B', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  actionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '12px' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', padding: '18px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', textAlign: 'left', width: '100%', color: '#fff' },
  actionIconWrap: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionTextWrap: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  actionTitle: { color: '#FFFFFF', fontWeight: '600', fontSize: '15px' },
  actionSub: { color: '#666', fontSize: '12px', marginTop: '2px' },
  emptyMini: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', color: '#666' },
  emptyMiniText: { fontSize: '13px' },
  footer: { marginTop: '48px', paddingBottom: '24px' },
  footerLine: { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.2), transparent)', marginBottom: '20px' },
  footerText: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555', fontSize: '12px', letterSpacing: '2px' },
}