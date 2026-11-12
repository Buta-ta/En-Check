// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — DONNÉES DE LA PAGE
// État central : admin, entreprises, modules, stats du jour,
// conflits, demandes, sorties manquantes, pauses, notifications,
// animations d'onglets. Lance le premier chargement.
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import useNotifications from '../../hooks/useNotifications'
import useRealtimeNotifications from '../../hooks/useRealtimeNotifications'
import useTabAnimations from '../../hooks/useTabAnimations'
import FeatureService, { FEATURES } from '../../services/featureService'
import { jourLocal } from '../../utils/timezoneUtils'
import { useDashboardLoaders } from './useDashboardLoaders'

export function useDashboardData() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  const [modulePlanning, setModulePlanning] = useState(false)
  const [moduleRetards, setModuleRetards] = useState(false)
  //  Option payante « Retards », lue ENTREPRISE PAR ENTREPRISE : un super admin
  //  qui voit toutes les entreprises ne doit pas voir les retards de celles qui
  //  n'ont pas souscrit.
  const [retardsOptionActive, setRetardsOptionActive] = useState(false)
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

  const [scheduleRequestsPending, setScheduleRequestsPending] = useState([])
  const [processingScheduleRequestId, setProcessingScheduleRequestId] = useState(null)
  const [forgottenExitItems, setForgottenExitItems] = useState([])
  const [savingForgottenExitId, setSavingForgottenExitId] = useState(null)
  const [pausesToday, setPausesToday] = useState([])
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


  const {
    loadSingleEnterpriseDashboard,
    loadGlobalSuperAdminDashboard,
  } = useDashboardLoaders({
    admin, today, navigate, setStats, setRecentActivity, setAlerts,
    setTopEntreprises, setConflictsPending, setScheduleRequestsPending,
    setForgottenExitItems, setPausesToday, setTodayHoliday,
    setModulePlanning, setModuleRetards, setModuleConges,
    setModuleGeofencing, setModuleCarteTempsReel, setModuleRecoFaciale,
    setModuleTaches, setModulePredictions, setModuleFichesPaie,
    setRetardsOptionActive,
  })

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    loadData(parsedAdmin)
  }, [navigate])

  return {
    navigate, today,
    admin, setAdmin, entreprises, setEntreprises, loading, loadError,
    mobileMenuOpen, setMobileMenuOpen, currentTime,
    modulePlanning, moduleRetards, retardsOptionActive, moduleConges,
    moduleHeuresSup, moduleGeofencing, moduleCarteTempsReel,
    moduleRecoFaciale, moduleFichesPaie, moduleTaches, modulePredictions,
    modulePointeuses, modulePostePointage, moduleRemunerations,
    moduleCoutSalarial, moduleConfigFiscale,
    moduleAlertesTelephone, moduleAlertesCourrier,
    stats, recentActivity, alerts, topEntreprises, conflictsPending,
    scheduleRequestsPending, forgottenExitItems,
    showConflictModal, setShowConflictModal, selectedConflict,
    setSelectedConflict, conflictNote, setConflictNote,
    resolvingConflict, setResolvingConflict,
    processingScheduleRequestId, setProcessingScheduleRequestId,
    savingForgottenExitId, setSavingForgottenExitId,
    pausesToday, todayHoliday,
    notifications, unreadCount, hasHighPriority, markAsRead,
    markAllAsRead, refreshNotifications,
    tabStates, isCalculating, markTabAsViewed, clearTab,
    refreshAllTriggers, handleTabClick,
    darkMode, toggleTheme, loadData,
  }
}
