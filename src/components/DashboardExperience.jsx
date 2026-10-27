import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  CalendarOff,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  GripVertical,
  Coffee,
  FileSearch,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  MoveDown,
  MoveUp,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Router,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  TrendingUp,
  UserCheck,
  ScanFace,
  UserPlus,
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import EnterpriseSwitcher from './EnterpriseSwitcher'
import SidebarNavigation from './SidebarNavigation'
import NotificationBell from './NotificationBell'
import SystemMessageBanner from './SystemMessageBanner'
import AttendanceHeroImage from './AttendanceHeroImage'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import { formaterHeureLocale } from '../utils/timezoneUtils'
import { estPauseReelleEffectuee, formaterTempsPauseEnDirect } from '../services/pausesService'
import {
  loadRemoteDashboardPreferences,
  saveRemoteDashboardPreferences,
} from '../services/dashboardPreferencesService'
import {
  addDashboardWidget,
  DEFAULT_DASHBOARD_WIDGETS,
  moveDashboardWidget,
  moveDashboardWidgetByOffset,
  normalizeDashboardWidgetIds,
  removeDashboardWidget,
} from '../utils/dashboardWidgets'
import '../pages/Dashboard.css'

const formatName = (person) => {
  const name = `${person?.first_name || ''} ${person?.last_name || ''}`.trim()
  return name || 'Employé'
}

const formatDate = (date) => {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const readDashboardWidgetLayout = (storageKey, availableIds, fallbackIds) => {
  try {
    const saved = window.localStorage.getItem(storageKey)
    return normalizeDashboardWidgetIds(saved ? JSON.parse(saved) : null, availableIds, fallbackIds)
  } catch {
    return normalizeDashboardWidgetIds(null, availableIds, fallbackIds)
  }
}

const readDashboardLayoutIds = (storageKey, availableIds, fallbackIds, allowEmpty = false) => {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved === null) return fallbackIds.filter((id) => availableIds.includes(id))
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return fallbackIds.filter((id) => availableIds.includes(id))
    const available = new Set(availableIds)
    const validIds = [...new Set(parsed.filter((id) => typeof id === 'string' && available.has(id)))]
    return validIds.length || (allowEmpty && parsed.length === 0) ? validIds : fallbackIds.filter((id) => available.has(id))
  } catch {
    return fallbackIds.filter((id) => availableIds.includes(id))
  }
}

const TOPBAR_LEFT_CATALOG = [
  { id: 'enterprise', label: 'Entreprise active', description: 'Changer d’entreprise affichée.', icon: Building2, region: 'left' },
  { id: 'date', label: 'Date du jour', description: 'Afficher la date courante.', icon: CalendarDays, region: 'left' },
]
const TOPBAR_RIGHT_CATALOG = [
  { id: 'dashboard-customize', label: 'Personnaliser le tableau', description: 'Réorganiser les widgets KPI et l’en-tête.', icon: SlidersHorizontal, region: 'right' },
  { id: 'add-widget', label: 'Ajouter un widget', description: 'Ajouter un KPI au tableau.', icon: Plus, region: 'right' },
  { id: 'theme', label: 'Thème clair / sombre', description: 'Changer l’apparence du tableau.', icon: Moon, region: 'right' },
  { id: 'notifications', label: 'Notifications', description: 'Consulter les notifications.', icon: Bell, region: 'right' },
  { id: 'profile', label: 'Profil administrateur', description: 'Voir le compte connecté.', icon: Users, region: 'right' },
]
const TOPBAR_LEFT_AVAILABLE_IDS = TOPBAR_LEFT_CATALOG.map((item) => item.id)
const TOPBAR_RIGHT_AVAILABLE_IDS = TOPBAR_RIGHT_CATALOG.map((item) => item.id)
const ALL_TOPBAR_AVAILABLE_IDS = [...TOPBAR_LEFT_AVAILABLE_IDS, ...TOPBAR_RIGHT_AVAILABLE_IDS]
const DEFAULT_TOPBAR_LEFT_ITEM_IDS = ['enterprise', 'date']
const DEFAULT_TOPBAR_RIGHT_ITEM_IDS = ['dashboard-customize', 'theme', 'notifications', 'profile']

export default function DashboardExperience({
  admin,
  entreprises = [],
  isSuperAdmin,
  isMultiEntreprise,
  modulePlanning,
  moduleRetards,
  retardsOptionActive = false,
  moduleConges,
  moduleHeuresSup,
  moduleGeofencing,
  moduleCarteTempsReel,
  moduleRecoFaciale,
  moduleFichesPaie,
  moduleTaches,
  modulePredictions,
  modulePointeuses,
  modulePostePointage,
  moduleRemunerations,
  moduleCoutSalarial,
  moduleConfigFiscale,
  stats,
  recentActivity = [],
  topEntreprises = [],
  conflictsPending = [],
  scheduleRequestsPending = [],
  handleQuickScheduleRequest,
  processingScheduleRequestId,
  forgottenExitItems = [],
  confirmForgottenExit,
  savingForgottenExitId,
  pausesToday = [],
  todayHoliday,
  currentTime,
  loadError,
  notifications = [],
  unreadCount = 0,
  hasHighPriority = false,
  markAsRead,
  markAllAsRead,
  handleLogout,
  handleEnterpriseSwitch,
  mobileMenuOpen,
  setMobileMenuOpen,
  tabStates = {},
  markTabAsViewed,
  canManageConflict,
  openConflictModal,
  showConflictModal,
  setShowConflictModal,
  selectedConflict,
  conflictNote,
  setConflictNote,
  resolvingConflict,
  resolveConflict,
  retryLoad,
  darkMode,
  toggleTheme,
  showSystemMessages = true,
}) {
  const navigate = useNavigate()
  const employeeCount = Number(stats?.employes) || 0
  const presentCount = Number(stats?.presentsToday) || 0
  const absentCount = Number(stats?.absentsToday) || 0
  const leaveCount = Number(stats?.congesToday) || 0
  const lateCount = Number(stats?.retardsToday) || 0
  const forgottenExits = Number(stats?.oublisSortie) || 0
  const conflictCount = conflictsPending.length || Number(stats?.conflitsPending) || 0
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now())
  const realPausesToday = pausesToday.filter((pa) => estPauseReelleEffectuee(pa))
  const activePauses = realPausesToday.filter((pa) => pa?.ouverte)
  const unplannedPauses = realPausesToday.filter((pa) => pa?.estNonPlanifiee)

  useEffect(() => {
    if (!activePauses.length) return undefined
    const timer = window.setInterval(() => setLiveNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activePauses.length])

  const nowMs = currentTime?.getTime ? currentTime.getTime() : liveNowMs
  const presenceRate = employeeCount > 0
    ? Math.max(0, Math.min(100, Math.round((presentCount / employeeCount) * 100)))
    : 0
  const reviewCount = conflictCount + scheduleRequestsPending.length + forgottenExits
  const metricValue = (value, pad = false) => loadError ? '—' : (pad ? String(value).padStart(2, '0') : value)
  const metricCaption = (caption) => loadError ? 'Données indisponibles' : caption
  const metricShare = (value) => loadError ? null : (employeeCount ? Math.min(100, Math.round((value / employeeCount) * 100)) : 0)
  const adminName = `${admin?.first_name || ''} ${admin?.last_name || ''}`.trim() || 'Administrateur'
  const adminInitials = `${admin?.first_name?.[0] || ''}${admin?.last_name?.[0] || ''}` || 'EC'
  const adminRole = isSuperAdmin ? 'Super administrateur' : (isMultiEntreprise ? 'Administrateur multi-entreprises' : 'Administrateur')
  const selectedEnterpriseName = admin?.selectedEnterprise?.name || admin?.enterprise_name || 'Toutes les entreprises'
  const todayLabel = currentTime?.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) || new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const currentTimeLabel = currentTime?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '--:--'
  const greeting = currentTime?.getHours() < 12
    ? 'Bonjour'
    : currentTime?.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir'

  const navigationSections = [
    {
      label: 'Aujourd’hui',
      items: [
        { label: 'Vue d’ensemble', icon: LayoutDashboard, path: '/dashboard', show: true, active: true },
        { label: 'Pointages', icon: Clock, path: '/pointages', show: true, tabKey: 'POINTAGES', count: forgottenExits + conflictCount },
        { label: 'Équipe', icon: Users, path: '/employes', show: true, tabKey: 'EMPLOYES' },
        { label: 'Planning', icon: Calendar, path: '/planning', show: isSuperAdmin || modulePlanning, tabKey: 'PLANNING', count: scheduleRequestsPending.length },
        { label: 'Absences', icon: CalendarOff, path: '/absences', show: isSuperAdmin || moduleConges, tabKey: 'ABSENCES' },
        { label: 'Retards', icon: Timer, path: '/retards', show: isSuperAdmin || moduleRetards, tabKey: 'RETARDS', count: lateCount },
        { label: 'Pauses', icon: Coffee, path: '/pauses', show: true, count: activePauses.length },
        { label: 'Rapports', icon: FileText, path: '/rapports', show: true },
        { label: 'Jours fériés', icon: CalendarDays, path: '/jours-feries', show: true, tabKey: 'JOURS_FERIES' },
      ],
    },
    {
      label: 'Gestion RH',
      items: [
        { label: 'Heures supplémentaires', icon: Timer, path: '/heures-supplementaires', show: isSuperAdmin || moduleHeuresSup, tabKey: 'HEURES_SUP' },
        { label: 'Rémunérations', icon: Wallet, path: '/remunerations', show: isSuperAdmin || moduleRemunerations },
        { label: 'Paie & fiscalité', icon: Shield, path: '/paie', show: isSuperAdmin || moduleFichesPaie || moduleConfigFiscale },
      ],
    },
    {
      label: 'Outils',
      items: [
        { label: 'Prédictions', icon: Sparkles, path: '/predictions', show: isSuperAdmin || modulePredictions, tabKey: 'PREDICTIONS' },
        // Le plateau et les zones sont un seul écran : l'un ou l'autre des
        // deux modules ouvre « Géopointage ».
        { label: 'Géopointage', icon: MapPin, path: '/geopointage', show: isSuperAdmin || moduleCarteTempsReel || moduleGeofencing, tabKey: 'GEOFENCING' },
        // Les enrôlements et leurs réglages sont un seul écran : une seule
        // entrée pour la reconnaissance faciale.
        { label: 'Reconnaissance faciale', icon: ScanFace, path: '/reconnaissance-faciale', show: isSuperAdmin || moduleRecoFaciale },
        // Les machines ADMS et le poste de pointage font un seul écran :
        // l'une ou l'autre des deux options ouvre « Configuration pointeuse ».
        { label: 'Configuration pointeuse', icon: Router, path: '/configuration-pointeuse', show: isSuperAdmin || modulePointeuses || modulePostePointage },
      ],
    },
    {
      label: 'Administration',
      items: [
        { label: 'Entreprises', icon: Building2, path: '/entreprises', show: isSuperAdmin },
        { label: 'Administrateurs', icon: ShieldCheck, path: '/admins', show: isSuperAdmin },
        { label: 'Messages système', icon: Bell, path: '/system-messages', show: isSuperAdmin },
        { label: 'Prospection', icon: TrendingUp, path: '/prospection', show: isSuperAdmin },
        { label: 'Test IA (isolé)', icon: Sparkles, path: '/test-ia', show: isSuperAdmin },
        { label: 'Analytics du site', icon: TrendingUp, path: '/analytics', show: isSuperAdmin },
      ],
    },
  ]

  const handleNavigation = (item) => {
    if (item.tabKey) markTabAsViewed?.(item.tabKey)
    if (item.action) item.action()
    else if (item.path) navigate(item.path)
    setMobileMenuOpen(false)
  }

  const reviewItems = []
  activePauses.slice(0, 3).forEach((pa) => {
    reviewItems.push({
      key: `pause-live-${pa.id}`,
      kind: 'late',
      icon: Coffee,
      title: `☕ En pause en direct · ${pa.employe || 'Employé'} — ⏱️ ${formaterTempsPauseEnDirect(pa, nowMs)}`,
      description: `Pause réelle déclenchée à ${pa.debutHHMM}${pa.matricule ? ` · ${pa.matricule}` : ''}${pa.estNonPlanifiee ? ' · Hors planning' : ''}`,
      actionLabel: 'Suivre',
      onAction: () => navigate('/pauses'),
    })
  })
  conflictsPending.slice(0, 2).forEach((conflict) => {
    const name = formatName(conflict.employees)
    const reason = conflict.absences?.reason ? `Absence déclarée · ${conflict.absences.reason}` : 'Pointage effectué pendant une absence déclarée'
    reviewItems.push({
      key: `conflict-${conflict.id}`,
      kind: 'conflict',
      icon: ShieldCheck,
      title: `Conflit à vérifier · ${name}`,
      description: `${reason}${conflict.absences?.start_date ? ` · ${formatDate(conflict.absences.start_date)}` : ''}`,
      actionLabel: canManageConflict ? 'Examiner' : 'Voir',
      onAction: () => canManageConflict ? openConflictModal(conflict) : navigate('/pointages'),
    })
  })
  scheduleRequestsPending.slice(0, 1).forEach((request) => {
    reviewItems.push({
      key: `schedule-${request.id}`,
      kind: 'schedule',
      icon: CalendarDays,
      title: `Demande d’horaire · ${formatName(request.employees)}`,
      description: `À examiner dans le planning${request.created_at ? ` · reçue le ${formatDate(request.created_at)}` : ''}`,
      actionLabel: 'Ouvrir',
      onAction: () => navigate('/planning'),
      quickScheduleRequest: canManageConflict && handleQuickScheduleRequest ? request : null,
    })
  })
  if (forgottenExits > 0) {
    reviewItems.push({
      key: 'forgotten-exits',
      kind: 'missing',
      icon: Clock,
      title: `${forgottenExits} sortie${forgottenExits > 1 ? 's' : ''} manquante${forgottenExits > 1 ? 's' : ''} à vérifier`,
      description: 'Des arrivées n’ont pas encore de sortie enregistrée.',
      actionLabel: 'Vérifier',
      onAction: () => (forgottenExitItems.length > 0 ? setIsForgottenExitModalOpen(true) : navigate('/pointages')),
    })
  }
  if (lateCount > 0) {
    reviewItems.push({
      key: 'late-arrivals',
      kind: 'late',
      icon: AlertTriangle,
      title: `${lateCount} retard${lateCount > 1 ? 's' : ''} aujourd’hui`,
      description: 'Les arrivées tardives sont prêtes à être consultées.',
      actionLabel: 'Consulter',
      onAction: () => navigate(isSuperAdmin || moduleRetards ? '/retards' : '/pointages'),
    })
  }
  const visibleReviewItems = reviewItems.slice(0, 4)

  const quickActionCatalog = [
    { id: 'add-employee', label: 'Ajouter un employé', description: 'Compléter l’équipe', icon: UserPlus, path: '/employes', category: 'Équipe', show: true },
    { id: 'attendance', label: 'Consulter les pointages', description: 'Entrées et sorties', icon: Clock, path: '/pointages', category: 'Présence', show: true },
    { id: 'planning', label: 'Ouvrir le planning', description: 'Horaires et équipes', icon: Calendar, path: '/planning', category: 'Planning', show: isSuperAdmin || modulePlanning },
    { id: 'reports', label: 'Créer un rapport', description: 'Exporter les données', icon: FileText, path: '/rapports', category: 'Rapports', show: true },
    { id: 'absences', label: 'Consulter les absences', description: 'Congés et maladies', icon: CalendarOff, path: '/absences', category: 'Absences', show: isSuperAdmin || moduleConges },
    { id: 'lateness', label: 'Voir les retards', description: 'Arrivées à vérifier', icon: Timer, path: '/retards', category: 'Retards', show: isSuperAdmin || moduleRetards },
    { id: 'breaks', label: 'Gérer les pauses', description: 'Suivre les pauses en cours', icon: Coffee, path: '/pauses', category: 'Présence', show: true },
    { id: 'overtime', label: 'Heures supplémentaires', description: 'Consulter les heures déclarées', icon: Timer, path: '/heures-supplementaires', category: 'Paie', show: isSuperAdmin || moduleHeuresSup },
    { id: 'payslips', label: 'Ouvrir les fiches de paie', description: 'Accéder aux bulletins', icon: Wallet, path: '/paie?onglet=fiches', category: 'Paie', show: isSuperAdmin || moduleFichesPaie || moduleConfigFiscale },
    { id: 'remuneration', label: 'Gérer les rémunérations', description: 'Consulter les rémunérations', icon: Wallet, path: '/remunerations', category: 'Paie', show: isSuperAdmin || moduleRemunerations },
    { id: 'salary-cost', label: 'Voir le coût salarial', description: 'Accéder aux indicateurs de coût', icon: TrendingUp, path: '/remunerations?vue=cout', category: 'Paie', show: isSuperAdmin || moduleCoutSalarial },
    { id: 'teams', label: 'Gérer les équipes et les tâches', description: 'Ouvrir l’annuaire, les équipes et les tâches', icon: Users, path: '/employes?vue=equipes', category: 'Outils', show: isSuperAdmin || moduleTaches },
    { id: 'predictions', label: 'Ouvrir les prédictions', description: 'Consulter les prévisions disponibles', icon: Sparkles, path: '/predictions', category: 'Outils', show: isSuperAdmin || modulePredictions },
    { id: 'companies', label: 'Gérer les entreprises', description: 'Accéder aux entreprises', icon: Building2, path: '/entreprises', category: 'Administration', show: Boolean(isSuperAdmin) },
  ].filter((action) => action.show)

  const widgetCatalog = [
    { id: 'present', label: 'Ayant pointé aujourd’hui', description: 'Membres de l’équipe ayant pointé.', icon: UserCheck, value: loadError ? '—' : `${presentCount} / ${employeeCount}`, caption: metricCaption(`${presenceRate}% de l’équipe`), tone: 'present', progress: loadError ? null : presenceRate, sourceLabel: 'Pointages', path: '/pointages?status=present' },
    { id: 'review', label: 'À traiter', description: 'Conflits, demandes et sorties à vérifier.', icon: ShieldCheck, value: metricValue(reviewCount, true), caption: metricCaption('Situations à examiner'), tone: 'review', progress: metricShare(reviewCount), sourceLabel: 'Activité', path: '/pointages' },
    { id: 'late', label: 'Retards', description: 'Arrivées après l’horaire prévu.', icon: Timer, value: metricValue(lateCount, true), caption: metricCaption('Retards du jour'), tone: 'late', progress: metricShare(lateCount), sourceLabel: 'Retards', path: isSuperAdmin || moduleRetards ? '/retards' : '/pointages?status=present', available: retardsOptionActive },
    { id: 'absence', label: 'Absents', description: 'Membres sans pointage ni congé déclaré.', icon: UserX, value: metricValue(absentCount, true), caption: metricCaption('Sans pointage déclaré'), tone: 'absent', progress: metricShare(absentCount), sourceLabel: 'Pointages', path: '/pointages?status=absent' },
    { id: 'leaves', label: 'Congés / maladie', description: 'Absences autorisées aujourd’hui.', icon: CalendarOff, value: metricValue(leaveCount, true), caption: metricCaption('Congés ou maladie'), tone: 'leave', progress: metricShare(leaveCount), sourceLabel: 'Absences', path: '/absences', available: isSuperAdmin || moduleConges },
    { id: 'presence-rate', label: 'Taux de pointage', description: 'Part de l’équipe ayant pointé aujourd’hui.', icon: TrendingUp, value: metricValue(`${presenceRate}%`), caption: metricCaption('Taux du jour'), tone: 'present', progress: loadError ? null : presenceRate, sourceLabel: 'Rapports', path: '/rapports' },
    { id: 'punches', label: 'Pointages enregistrés', description: 'Entrées et sorties du jour.', icon: Clock, value: metricValue(Number(stats?.pointages) || 0), caption: metricCaption('Pointages aujourd’hui'), tone: 'neutral', sourceLabel: 'Pointages', path: '/pointages' },
    { id: 'team-size', label: 'Effectif', description: 'Collaborateurs actifs dans l’entreprise.', icon: Users, value: metricValue(employeeCount), caption: metricCaption('Collaborateurs'), tone: 'team', sourceLabel: 'Équipe', path: '/employes' },
    { id: 'checkouts', label: 'Sorties manquantes à vérifier', description: 'Arrivées qui n’ont pas encore de sortie.', icon: LogOut, value: metricValue(forgottenExits, true), caption: metricCaption('Sorties manquantes'), tone: 'review', progress: metricShare(forgottenExits), sourceLabel: 'Pointages', path: '/pointages?status=present' },
    { id: 'conflicts', label: 'Conflits à examiner', description: 'Pointages effectués pendant une absence.', icon: ShieldCheck, value: metricValue(conflictCount, true), caption: metricCaption('Pointage / absence'), tone: 'late', progress: metricShare(conflictCount), sourceLabel: 'Absences', path: '/pointages?status=conflit_absence_pointage' },
    { id: 'photos', label: 'Photos de pointage', description: 'Preuves photo enregistrées aujourd’hui.', icon: Camera, value: metricValue(Number(stats?.photosToday) || 0), caption: metricCaption('Photos aujourd’hui'), tone: 'photos', sourceLabel: 'Pointages', path: '/pointages?photos=with' },
    { id: 'breaks', label: 'Pauses du jour', description: 'Pauses réelles en cours, planifiées et hors planning.', icon: Coffee, value: metricValue(realPausesToday.length, true), caption: metricCaption(activePauses.length > 0 ? `${activePauses.length} en cours (${formaterTempsPauseEnDirect(activePauses[0], nowMs)})` : `${unplannedPauses.length} hors planning`), tone: 'review', progress: metricShare(realPausesToday.length), sourceLabel: 'Pauses', path: '/pauses' },
    { id: 'companies', label: 'Entreprises actives', description: 'Vue consolidée de votre portefeuille.', icon: Building2, value: metricValue(Number(stats?.entreprises) || entreprises.length), caption: metricCaption('Entreprises'), tone: 'team', sourceLabel: 'Administration', path: '/entreprises', available: Boolean(isSuperAdmin) },
  ]
  const availableWidgets = widgetCatalog.filter((widget) => widget.available !== false)
  const availableWidgetIds = availableWidgets.map((widget) => widget.id)
  const defaultWidgetIds = DEFAULT_DASHBOARD_WIDGETS.filter((id) => availableWidgetIds.includes(id))
  const widgetStorageKey = `encheck_dashboard_widgets_v1:${admin?.id || 'preview'}:${admin?.selectedEnterprise?.id || admin?.enterprise_id || 'all'}`
  const [widgetIds, setWidgetIds] = useState(() => readDashboardWidgetLayout(widgetStorageKey, availableWidgetIds, defaultWidgetIds))
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [isWidgetCatalogOpen, setIsWidgetCatalogOpen] = useState(false)
  const [draggedWidgetId, setDraggedWidgetId] = useState(null)

  const topbarLeftCatalog = TOPBAR_LEFT_CATALOG
  const topbarRightCatalog = TOPBAR_RIGHT_CATALOG
  const topbarLeftAvailableIds = ALL_TOPBAR_AVAILABLE_IDS
  const topbarRightAvailableIds = ALL_TOPBAR_AVAILABLE_IDS
  const defaultTopbarLeftItemIds = DEFAULT_TOPBAR_LEFT_ITEM_IDS
  const defaultTopbarRightItemIds = DEFAULT_TOPBAR_RIGHT_ITEM_IDS
  const layoutOwnerKey = `${admin?.id || 'preview'}:${admin?.selectedEnterprise?.id || admin?.enterprise_id || 'all'}`
  const topbarLeftStorageKey = `encheck_dashboard_topbar_left_v2:${layoutOwnerKey}`
  const topbarRightStorageKey = `encheck_dashboard_topbar_right_v2:${layoutOwnerKey}`
  const [topbarLeftItemIds, setTopbarLeftItemIds] = useState(() => readDashboardLayoutIds(topbarLeftStorageKey, topbarLeftAvailableIds, defaultTopbarLeftItemIds, true))
  const [topbarRightItemIds, setTopbarRightItemIds] = useState(() => readDashboardLayoutIds(topbarRightStorageKey, topbarRightAvailableIds, defaultTopbarRightItemIds, true))
  const [isTopbarCustomizing, setIsTopbarCustomizing] = useState(false)
  const [isTopbarCatalogOpen, setIsTopbarCatalogOpen] = useState(false)
  const [draggedTopbarItemId, setDraggedTopbarItemId] = useState(null)
  const [activityFilter, setActivityFilter] = useState('all')
  // L'option « retards » peut être coupée par le module : le filtre retenu
  // revient alors à « tout », sans passer par un état intermédiaire.
  const filtreActivite = !retardsOptionActive && activityFilter === 'late' ? 'all' : activityFilter
  const [selectedActivityItem, setSelectedActivityItem] = useState(null)
  const [isForgottenExitModalOpen, setIsForgottenExitModalOpen] = useState(false)
  const [exitTimesById, setExitTimesById] = useState({})
  const enterpriseScopeKey = String(admin?.selectedEnterprise?.id || admin?.enterprise_id || 'all')

  const availableQuickActionIds = quickActionCatalog.map((action) => action.id)
  const defaultQuickActionIds = ['add-employee', 'attendance', 'planning', 'reports'].filter((id) => availableQuickActionIds.includes(id))
  const quickActionStorageKey = `encheck_dashboard_quick_actions_v1:${layoutOwnerKey}`
  const [quickActionIds, setQuickActionIds] = useState(() => readDashboardLayoutIds(quickActionStorageKey, availableQuickActionIds, defaultQuickActionIds, true))
  const [isCustomizingQuickActions, setIsCustomizingQuickActions] = useState(false)
  const [isQuickActionCatalogOpen, setIsQuickActionCatalogOpen] = useState(false)
  const [draggedQuickActionId, setDraggedQuickActionId] = useState(null)
  useEffect(() => {
    ;[
      '/images/pointage-loading-pin.jpg',
      '/images/pointage-loading-qr.jpg',
      '/images/employes-loading-badge.jpg',
      '/images/employes-loading-team.jpg',
    ].forEach((src) => {
      const img = new window.Image()
      img.src = src
    })
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(widgetStorageKey, JSON.stringify(widgetIds))
    } catch {
      // La personnalisation reste fonctionnelle même si le stockage est bloqué.
    }
  }, [widgetStorageKey, widgetIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(topbarLeftStorageKey, JSON.stringify(topbarLeftItemIds))
    } catch {
      // La disposition reste utilisable si le stockage du navigateur est bloqué.
    }
  }, [topbarLeftStorageKey, topbarLeftItemIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(topbarRightStorageKey, JSON.stringify(topbarRightItemIds))
    } catch {
      // La disposition reste utilisable si le stockage du navigateur est bloqué.
    }
  }, [topbarRightStorageKey, topbarRightItemIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(quickActionStorageKey, JSON.stringify(quickActionIds))
    } catch {
      // La disposition reste utilisable si le stockage du navigateur est bloqué.
    }
  }, [quickActionStorageKey, quickActionIds])

  //  Les tableaux `availableWidgetIds` / `defaultWidgetIds` / `availableQuickActionIds`
  //  sont reconstruits à CHAQUE rendu. Les mettre tels quels dans les dépendances
  //  de l'effet le relançait donc après chaque clic : il relisait les préférences
  //  distantes — qui ne sont enregistrées qu'après 650 ms de temporisation — et
  //  réappliquait l'ANCIENNE liste. Le widget qu'on venait de retirer réapparaissait
  //  aussitôt. D'où : dépendances en signatures texte + chargement une seule fois
  //  par périmètre, pour qu'une modification locale ne soit plus jamais écrasée.
  const widgetCatalogSignature = availableWidgetIds.join('|')
  const quickActionSignature = availableQuickActionIds.join('|')
  const remotePrefsLoadedRef = useRef('')

  useEffect(() => {
    let cancelled = false
    if (!admin?.id) return undefined
    const clePerimetre = `${admin.id}:${enterpriseScopeKey}:${widgetCatalogSignature}:${quickActionSignature}`
    if (remotePrefsLoadedRef.current === clePerimetre) return undefined
    loadRemoteDashboardPreferences(admin.id, enterpriseScopeKey).then((remote) => {
      if (cancelled || !remote) return
      remotePrefsLoadedRef.current = clePerimetre
      if (Array.isArray(remote.widgetIds)) {
        const nextWidgets = normalizeDashboardWidgetIds(remote.widgetIds, availableWidgetIds, defaultWidgetIds)
        if (nextWidgets.length) setWidgetIds(nextWidgets)
      }
      if (Array.isArray(remote.topbarLeftItemIds)) {
        const validLeft = remote.topbarLeftItemIds.filter((id) => topbarLeftAvailableIds.includes(id))
        setTopbarLeftItemIds(validLeft)
      }
      if (Array.isArray(remote.topbarRightItemIds)) {
        const validRight = remote.topbarRightItemIds.filter((id) => topbarRightAvailableIds.includes(id))
        setTopbarRightItemIds(validRight)
      }
      if (Array.isArray(remote.quickActionIds)) {
        const validActions = remote.quickActionIds.filter((id) => availableQuickActionIds.includes(id))
        setQuickActionIds(validActions)
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    admin?.id,
    enterpriseScopeKey,
    widgetCatalogSignature,
    quickActionSignature,
    topbarLeftAvailableIds,
    topbarRightAvailableIds,
  ])

  useEffect(() => {
    if (!admin?.id) return undefined
    const timer = window.setTimeout(() => {
      saveRemoteDashboardPreferences(admin.id, enterpriseScopeKey, {
        widgetIds,
        topbarLeftItemIds,
        topbarRightItemIds,
        quickActionIds,
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [admin?.id, enterpriseScopeKey, widgetIds, topbarLeftItemIds, topbarRightItemIds, quickActionIds])

  const visibleWidgets = widgetIds
    .map((id) => availableWidgets.find((widget) => widget.id === id))
    .filter(Boolean)
  const unaddedWidgets = availableWidgets.filter((widget) => !widgetIds.includes(widget.id))
  const allTopbarCatalog = [...topbarLeftCatalog, ...topbarRightCatalog]
  const visibleTopbarLeftItems = topbarLeftItemIds
    .map((id) => allTopbarCatalog.find((item) => item.id === id))
    .filter(Boolean)
  const visibleTopbarRightItems = topbarRightItemIds
    .map((id) => allTopbarCatalog.find((item) => item.id === id))
    .filter(Boolean)
  const unaddedTopbarItems = allTopbarCatalog.filter((item) =>
    !topbarLeftItemIds.includes(item.id) && !topbarRightItemIds.includes(item.id),
  )
  const hasTopbarCustomizeButton = topbarLeftItemIds.includes('dashboard-customize') || topbarRightItemIds.includes('dashboard-customize')
  const quickActions = quickActionIds
    .map((id) => quickActionCatalog.find((action) => action.id === id))
    .filter(Boolean)
  const unaddedQuickActions = quickActionCatalog.filter((action) => !quickActionIds.includes(action.id))

  const handleWidgetDragStart = (event, widgetId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', widgetId)
    setDraggedWidgetId(widgetId)
  }
  const handleWidgetDrop = (event, targetId) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedWidgetId
    if (sourceId) setWidgetIds((current) => moveDashboardWidget(current, sourceId, targetId))
    setDraggedWidgetId(null)
  }
  const addWidget = (widgetId) => {
    setWidgetIds((current) => addDashboardWidget(current, widgetId))
    setIsCustomizing(true)
    setIsWidgetCatalogOpen(false)
  }
  const removeWidget = (widgetId) => setWidgetIds((current) => removeDashboardWidget(current, widgetId))
  const moveWidget = (widgetId, offset) => setWidgetIds((current) => moveDashboardWidgetByOffset(current, widgetId, offset))
  const resetWidgets = () => setWidgetIds(defaultWidgetIds)

  const addTopbarItem = (item) => {
    if (item.region === 'left') setTopbarLeftItemIds((current) => addDashboardWidget(current, item.id))
    else setTopbarRightItemIds((current) => addDashboardWidget(current, item.id))
    setIsCustomizing(true)
    setIsTopbarCustomizing(true)
    setIsTopbarCatalogOpen(false)
  }
  const removeTopbarItem = (itemId, region) => {
    const setter = region === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
    setter((current) => removeDashboardWidget(current, itemId))
  }
  const moveTopbarItem = (itemId, offset, region) => {
    const setter = region === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
    setter((current) => moveDashboardWidgetByOffset(current, itemId, offset))
  }
  const handleTopbarDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
    setDraggedTopbarItemId(itemId)
  }
  const handleTopbarDrop = (event, targetId, targetRegion) => {
    event.preventDefault()
    event.stopPropagation()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedTopbarItemId
    const sourceRegion = topbarLeftItemIds.includes(sourceId)
      ? 'left'
      : topbarRightItemIds.includes(sourceId) ? 'right' : null
    if (sourceId && sourceRegion) {
      if (sourceRegion === targetRegion) {
        if (targetId) {
          const setter = targetRegion === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
          setter((current) => moveDashboardWidget(current, sourceId, targetId))
        }
      } else {
        const sourceSetter = sourceRegion === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
        const targetSetter = targetRegion === 'left' ? setTopbarLeftItemIds : setTopbarRightItemIds
        sourceSetter((current) => removeDashboardWidget(current, sourceId))
        targetSetter((current) => {
          const next = removeDashboardWidget(current, sourceId)
          const targetIndex = targetId ? next.indexOf(targetId) : -1
          next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceId)
          return next
        })
      }
    }
    setDraggedTopbarItemId(null)
  }
  const resetTopbarLayout = () => {
    setTopbarLeftItemIds(defaultTopbarLeftItemIds)
    setTopbarRightItemIds(defaultTopbarRightItemIds)
  }

  const addQuickAction = (actionId) => {
    setQuickActionIds((current) => addDashboardWidget(current, actionId))
    setIsCustomizingQuickActions(true)
    setIsQuickActionCatalogOpen(false)
  }
  const removeQuickAction = (actionId) => setQuickActionIds((current) => removeDashboardWidget(current, actionId))
  const moveQuickAction = (actionId, offset) => setQuickActionIds((current) => moveDashboardWidgetByOffset(current, actionId, offset))
  const handleQuickActionDragStart = (event, actionId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', actionId)
    setDraggedQuickActionId(actionId)
  }
  const handleQuickActionDrop = (event, targetId) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedQuickActionId
    if (sourceId) setQuickActionIds((current) => moveDashboardWidget(current, sourceId, targetId))
    setDraggedQuickActionId(null)
  }
  const resetQuickActions = () => setQuickActionIds(defaultQuickActionIds)

  const toggleDashboardCustomize = () => {
    setIsCustomizing((value) => {
      const next = !value
      if (!next) setIsTopbarCustomizing(false)
      return next
    })
  }

  const renderTopbarElement = (itemId) => {
    if (itemId === 'enterprise') {
      return <div className="topbar-company"><EnterpriseSwitcher admin={admin} onSwitch={handleEnterpriseSwitch} /></div>
    }
    if (itemId === 'date') return <span className="topbar-date">{todayLabel}</span>
    if (itemId === 'dashboard-customize') {
      return (
        <button
          type="button"
          className={`dashboard-customize-button${isCustomizing ? ' is-active' : ''}`}
          onClick={toggleDashboardCustomize}
          aria-pressed={isCustomizing}
          aria-label={isCustomizing ? 'Terminer la personnalisation du tableau' : 'Personnaliser le tableau'}
          title={isCustomizing ? 'Terminer la personnalisation' : 'Personnaliser le tableau'}
        >
          {isCustomizing ? <CheckCircle2 size={15} /> : <SlidersHorizontal size={15} />}
          <span>{isCustomizing ? 'Terminer' : 'Personnaliser le tableau'}</span>
        </button>
      )
    }
    if (itemId === 'add-widget') {
      return (
        <button type="button" className="dashboard-add-widget-button" aria-label="Ajouter un widget" onClick={() => setIsWidgetCatalogOpen(true)} aria-haspopup="dialog" aria-expanded={isWidgetCatalogOpen}>
          <Plus size={15} /><span>Ajouter un widget</span>
        </button>
      )
    }
    if (itemId === 'theme') {
      return (
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={themeLabel} aria-pressed={darkMode} title={themeLabel}>
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          <span>{darkMode ? 'Clair' : 'Sombre'}</span>
        </button>
      )
    }
    if (itemId === 'notifications') {
      return (
        <div className="topbar-icon-button">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} hasHighPriority={hasHighPriority} markAsRead={markAsRead} markAllAsRead={markAllAsRead} />
        </div>
      )
    }
    if (itemId === 'profile') {
      // Le bloc entier mène à la page Administrateurs : l'avatar, le nom,
      // le rôle. Un simple bouton d'avatar ne se voyait pas cliquable.
      if (!isSuperAdmin) {
        return (
          <div className="topbar-admin" title={`${adminName} · ${adminRole}`}>
            <div className="topbar-avatar">{adminInitials}</div>
            <div className="topbar-admin-copy">
              <span className="topbar-admin-name">{adminName}</span>
              <span className="topbar-admin-role">{adminRole}</span>
            </div>
          </div>
        )
      }
      return (
        <Link
          className="topbar-admin topbar-admin--lien"
          to="/admins"
          title={`${adminName} · ${adminRole} — ouvrir la page Administrateurs`}
          aria-label={`${adminName}, ${adminRole} — ouvrir la page Administrateurs`}
        >
          <span className="topbar-avatar">{adminInitials}</span>
          <span className="topbar-admin-copy">
            <span className="topbar-admin-name">{adminName}</span>
            <span className="topbar-admin-role">{adminRole}</span>
          </span>
          <ChevronRight className="topbar-admin-chevron" size={14} aria-hidden="true" />
        </Link>
      )
    }
    return null
  }

  const renderTopbarLayoutItem = (item, region, index, itemCount) => (
    <div
      className={`topbar-layout-item${isTopbarCustomizing ? ' is-editing' : ''}${draggedTopbarItemId === item.id ? ' is-dragging' : ''}`}
      key={item.id}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => handleTopbarDrop(event, item.id, region)}
    >
      {isTopbarCustomizing && (
        <div className="topbar-layout-controls" aria-label={`Contrôles de ${item.label}`}>
          <button type="button" className="topbar-layout-drag-handle" draggable="true" onDragStart={(event) => handleTopbarDragStart(event, item.id)} onDragEnd={() => setDraggedTopbarItemId(null)} aria-label={`Déplacer ${item.label}`} title="Glisser pour déplacer"><GripVertical size={13} /></button>
          <button type="button" onClick={() => moveTopbarItem(item.id, -1, region)} disabled={index === 0} aria-label={`Déplacer ${item.label} vers le début`} title="Monter"><MoveUp size={12} /></button>
          <button type="button" onClick={() => moveTopbarItem(item.id, 1, region)} disabled={index === itemCount - 1} aria-label={`Déplacer ${item.label} vers la fin`} title="Descendre"><MoveDown size={12} /></button>
          <button type="button" onClick={() => removeTopbarItem(item.id, region)} aria-label={`Retirer ${item.label}`} title="Retirer de la barre du haut"><X size={12} /></button>
        </div>
      )}
      {renderTopbarElement(item.id)}
    </div>
  )

  const themeLabel = darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'

  return (
    <div className="encheck-dashboard" data-theme={darkMode ? 'dark' : 'light'}>
      <div className="dashboard-frame">
        {mobileMenuOpen && (
          <button
            type="button"
            className="dashboard-mobile-overlay"
            aria-label="Fermer le menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside className={`dashboard-sidebar${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Navigation principale">
          <div className="sidebar-brand">
            <EnCheckBrandMark className="sidebar-brand-mark" size={42} />
            <div className="sidebar-brand-copy">
              <span className="sidebar-brand-wordmark">En-Check</span>
              <span className="sidebar-brand-tagline">On gère !</span>
            </div>
          </div>

          <div className="sidebar-bogolan" aria-hidden="true" />

          <div className="dashboard-sidebar-scroll">
            <SidebarNavigation
              sections={navigationSections}
              tabStates={tabStates}
              onSelect={handleNavigation}
              idAdministrateur={admin?.id}
            />

            <a
              className="sidebar-portal-link"
              href="/employee/login"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Users size={16} />
              <span>Espace employé</span>
              <ArrowRight size={14} />
            </a>
          </div>

          <div className="sidebar-bogolan sidebar-bogolan--bas" aria-hidden="true" />

          <div className="sidebar-profile">
            {isSuperAdmin ? (
              <Link
                className="sidebar-profile-link"
                to="/admins"
                title="Ouvrir la page Administrateurs"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sidebar-profile-avatar">{adminInitials}</span>
                <span className="sidebar-profile-copy">
                  <span className="sidebar-profile-name">{adminName}</span>
                  <span className="sidebar-profile-role">{adminRole}</span>
                </span>
                <ChevronRight className="sidebar-profile-chevron" size={15} aria-hidden="true" />
              </Link>
            ) : (
              <div className="sidebar-profile-link is-statique">
                <span className="sidebar-profile-avatar">{adminInitials}</span>
                <span className="sidebar-profile-copy">
                  <span className="sidebar-profile-name">{adminName}</span>
                  <span className="sidebar-profile-role">{adminRole}</span>
                </span>
              </div>
            )}
            <button type="button" className="sidebar-logout" onClick={handleLogout} title="Déconnexion" aria-label="Déconnexion">
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        <div className="dashboard-workspace">
          <header className={`dashboard-topbar${isTopbarCustomizing ? ' is-customizing-layout' : ''}`}>
            <div
              className="topbar-left"
              onDragOver={(event) => isTopbarCustomizing && event.preventDefault()}
              onDrop={(event) => isTopbarCustomizing && handleTopbarDrop(event, null, 'left')}
            >
              <button
                type="button"
                className="mobile-menu-button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
              >
                {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
              {visibleTopbarLeftItems.map((item, index) => renderTopbarLayoutItem(item, 'left', index, visibleTopbarLeftItems.length))}
            </div>

            <div className="topbar-actions">
              <div
                className="topbar-actions-list"
                onDragOver={(event) => isTopbarCustomizing && event.preventDefault()}
                onDrop={(event) => isTopbarCustomizing && handleTopbarDrop(event, null, 'right')}
              >
                {visibleTopbarRightItems.map((item, index) => renderTopbarLayoutItem(item, 'right', index, visibleTopbarRightItems.length))}
                {isTopbarCustomizing && (
                  <button type="button" className="topbar-add-item-button" onClick={() => setIsTopbarCatalogOpen(true)} aria-label="Ajouter un élément à la barre du haut" title="Ajouter un élément" aria-haspopup="dialog" aria-expanded={isTopbarCatalogOpen}>
                    <Plus size={14} /><span>Ajouter un élément</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* LE BANDEAU DU BOGOLAN — juste après la barre du haut, pleine
              largeur : la pièce réelle de la page Paie & fiscalité. */}
          <div className="dashboard-bogolan" aria-hidden="true" />

          <main className="dashboard-main">
            {isCustomizing && (
              <div className="dashboard-customize-hint" role="status">
                <span>
                  {isTopbarCustomizing
                    ? 'Glisse ou utilise les flèches pour organiser l’en-tête et les cartes du tableau.'
                    : 'Glisse une poignée pour réorganiser les cartes, ou personnalise l’en-tête.'}
                </span>
                <div className="dashboard-customize-hint-actions">
                  <button
                    type="button"
                    onClick={() => setIsWidgetCatalogOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={isWidgetCatalogOpen}
                  >
                    <Plus size={13} />
                    <span>Ajouter un widget</span>
                  </button>
                  <button
                    type="button"
                    className={`dashboard-customize-header-button${isTopbarCustomizing ? ' is-active' : ''}`}
                    onClick={() => setIsTopbarCustomizing((value) => !value)}
                    aria-pressed={isTopbarCustomizing}
                    aria-label={isTopbarCustomizing ? 'Terminer la personnalisation de la barre du haut' : 'Personnaliser la barre du haut'}
                  >
                    <SlidersHorizontal size={13} />
                    <span>En-tête</span>
                  </button>
                  {isTopbarCustomizing && (
                    <button
                      type="button"
                      onClick={() => setIsTopbarCatalogOpen(true)}
                      aria-haspopup="dialog"
                      aria-expanded={isTopbarCatalogOpen}
                    >
                      <Plus size={13} />
                      <span>Ajouter en haut</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      resetWidgets()
                      if (isTopbarCustomizing) resetTopbarLayout()
                    }}
                  >
                    <RotateCcw size={13} /> Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomizing(false)
                      setIsTopbarCustomizing(false)
                    }}
                  >
                    <CheckCircle2 size={13} /> Terminer
                  </button>
                </div>
              </div>
            )}

            {showSystemMessages && <SystemMessageBanner userType="admins" />}

            {loadError && (
              <div className="dashboard-error-banner" role="alert">
                <AlertTriangle size={19} />
                <div className="dashboard-error-banner-copy">
                  <strong>Les données ne sont pas à jour</strong>
                  <span>Impossible de charger l’activité du jour ({loadError}). Les compteurs ne doivent pas être interprétés comme des données réelles.</span>
                </div>
                <button type="button" onClick={retryLoad}>Réessayer</button>
              </div>
            )}

            {conflictCount > 0 && (
              <div className="dashboard-alert-banner">
                <ShieldCheck size={18} />
                <div className="dashboard-alert-banner-copy">
                  <strong>{conflictCount} conflit{conflictCount > 1 ? 's' : ''} pointage / absence à examiner</strong>
                  <span>Une présence a été enregistrée pendant une absence déclarée.</span>
                </div>
                <button type="button" onClick={() => navigate('/pointages')}>Voir les pointages</button>
              </div>
            )}

            {scheduleRequestsPending.length > 0 && (
              <div className="dashboard-alert-banner is-schedule">
                <CalendarDays size={18} />
                <div className="dashboard-alert-banner-copy">
                  <strong>{scheduleRequestsPending.length} demande{scheduleRequestsPending.length > 1 ? 's' : ''} d’horaire en attente</strong>
                  <span>Les demandes peuvent être examinées depuis le planning.</span>
                </div>
                <button type="button" onClick={() => navigate('/planning')}>Ouvrir le planning</button>
              </div>
            )}

            {realPausesToday.length > 0 && (
              <div className="dashboard-alert-banner is-breaks" role="region" aria-label="Pauses en direct et effectuées">
                <Coffee size={18} />
                <div className="dashboard-alert-banner-copy">
                  <strong>
                    {activePauses.length > 0
                      ? `⏱️ ${activePauses.length} collaborateur${activePauses.length > 1 ? 's' : ''} en pause réelle en direct`
                      : `${realPausesToday.length} pause${realPausesToday.length > 1 ? 's' : ''} réelle${realPausesToday.length > 1 ? 's' : ''} effectuée${realPausesToday.length > 1 ? 's' : ''} aujourd’hui (${unplannedPauses.length} hors planning)`}
                  </strong>
                  <span>
                    {(activePauses.length > 0 ? activePauses : realPausesToday).slice(0, 3).map((pa) => (
                      `${pa.employe} : ⏱️ ${formaterTempsPauseEnDirect(pa, nowMs)}${pa.ouverte ? ` (depuis ${pa.debutHHMM})` : ` (${pa.debutHHMM}→${pa.finHHMM || ''})`}${pa.estNonPlanifiee ? ' [Hors planning]' : ''}`
                    )).join(' · ')}
                  </span>
                </div>
                <button type="button" onClick={() => navigate('/pauses')}>Voir les pauses</button>
              </div>
            )}

            <section className="dashboard-hero">
              <div className="dashboard-hero-copy">
                <p className="dashboard-eyebrow"><span className="dashboard-live-dot" /> En-Check · Votre équipe en un coup d’œil</p>
                <h1 className="dashboard-greeting">{greeting}, <span className="dashboard-greeting-name">{admin?.first_name || 'bienvenue'}</span></h1>
                <p className="dashboard-subtitle">Voici la présence de votre équipe et les points à vérifier aujourd’hui.</p>
                <div className="dashboard-hero-meta">
                  <span className="dashboard-meta-chip"><Building2 size={13} />{selectedEnterpriseName}</span>
                  <span className="dashboard-meta-chip is-positive"><UserCheck size={13} />{presentCount} ayant pointé aujourd’hui</span>
                  {realPausesToday.length > 0 && (
                    <button
                      type="button"
                      className="dashboard-meta-chip dashboard-customize-fallback"
                      onClick={() => navigate('/pauses')}
                    >
                      <Coffee size={13} />
                      <span>
                        {activePauses.length > 0
                          ? `☕ ${activePauses[0].employe} en pause : ⏱️ ${formaterTempsPauseEnDirect(activePauses[0], nowMs)} (depuis ${activePauses[0].debutHHMM})`
                          : `${realPausesToday.length} pause${realPausesToday.length > 1 ? 's' : ''} réelle${realPausesToday.length > 1 ? 's' : ''} (${unplannedPauses.length} hors planning)`}
                      </span>
                    </button>
                  )}
                  {todayHoliday && <span className="dashboard-meta-chip"><Calendar size={13} />{todayHoliday.name}</span>}
                  {conflictCount > 0 && <span className="dashboard-meta-chip is-alert"><AlertTriangle size={13} />{conflictCount} à examiner</span>}
                  {!hasTopbarCustomizeButton && !isCustomizing && (
                    <button
                      type="button"
                      className="dashboard-meta-chip dashboard-customize-fallback"
                      onClick={() => setIsCustomizing(true)}
                    >
                      <SlidersHorizontal size={13} />
                      <span>Personnaliser le tableau</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="dashboard-hero-art"><AttendanceHeroImage /></div>
            </section>

            <section className={`dashboard-kpis${isCustomizing ? ' is-customizing' : ''}`} aria-label="Indicateurs du jour">
              {visibleWidgets.map((widget, index) => {
                const Icon = widget.icon
                return (
                  <article
                    className={`dashboard-kpi dashboard-kpi--${widget.tone}${draggedWidgetId === widget.id ? ' is-dragging' : ''}`}
                    key={widget.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleWidgetDrop(event, widget.id)}
                  >
                    <div className="dashboard-kpi-top">
                      <span className="dashboard-kpi-label">{widget.label}</span>
                      {!isCustomizing ? (
                        <span className="dashboard-kpi-icon"><Icon size={16} /></span>
                      ) : (
                        <div className="dashboard-widget-controls" aria-label={`Contrôles de ${widget.label}`}>
                          <button
                            type="button"
                            className="dashboard-widget-drag-handle"
                            draggable="true"
                            onDragStart={(event) => handleWidgetDragStart(event, widget.id)}
                            onDragEnd={() => setDraggedWidgetId(null)}
                            aria-label={`Déplacer ${widget.label}`}
                            title="Faire glisser pour déplacer"
                          >
                            <GripVertical size={14} />
                          </button>
                          <button type="button" onClick={() => moveWidget(widget.id, -1)} disabled={index === 0} aria-label={`Déplacer ${widget.label} vers le début`} title="Monter"><MoveUp size={13} /></button>
                          <button type="button" onClick={() => moveWidget(widget.id, 1)} disabled={index === visibleWidgets.length - 1} aria-label={`Déplacer ${widget.label} vers la fin`} title="Descendre"><MoveDown size={13} /></button>
                          <button type="button" onClick={() => removeWidget(widget.id)} disabled={visibleWidgets.length === 1} aria-label={`Retirer ${widget.label}`} title={visibleWidgets.length === 1 ? 'Conservez au moins un widget' : 'Retirer du tableau'}><X size={13} /></button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="dashboard-kpi-content"
                      onClick={() => widget.path && navigate(widget.path)}
                      disabled={isCustomizing || !widget.path}
                      aria-label={`Ouvrir ${widget.label}`}
                    >
                      <strong className="dashboard-kpi-value">{widget.value}</strong>
                      {typeof widget.progress === 'number' && (
                        <span className="dashboard-kpi-progress" aria-hidden="true">
                          <span style={{ width: `${Math.max(0, Math.min(100, widget.progress))}%` }} />
                        </span>
                      )}
                      <span className="dashboard-kpi-caption">{widget.caption}</span>
                      {!isCustomizing && <ArrowRight className="dashboard-kpi-arrow" size={14} aria-hidden="true" />}
                    </button>
                    <span className="dashboard-kpi-source">{widget.sourceLabel}</span>
                  </article>
                )
              })}
            </section>

            <section className="dashboard-content-grid">
              <article className="dashboard-panel">
                <div className="dashboard-panel-heading">
                  <div className="dashboard-panel-title-wrap">
                    <span className="dashboard-panel-icon"><AlertTriangle size={16} /></span>
                    <div><h2 className="dashboard-panel-title">À vérifier</h2><p className="dashboard-panel-subtitle">Les situations qui demandent votre attention.</p></div>
                  </div>
                  <button type="button" className="dashboard-panel-link" onClick={() => navigate('/pointages')}>Tout voir <ArrowRight size={13} /></button>
                </div>

                {visibleReviewItems.length > 0 ? (
                  <div className="dashboard-review-list">
                    {visibleReviewItems.map((item) => {
                      const Icon = item.icon
                      const isProcessingReq = Boolean(item.quickScheduleRequest && processingScheduleRequestId === item.quickScheduleRequest.id)
                      return (
                        <div className={`dashboard-review-row is-${item.kind}`} key={item.key}>
                          <span className="dashboard-review-icon"><Icon size={15} /></span>
                          <div className="dashboard-review-copy">
                            <span className="dashboard-review-title">{item.title}</span>
                            <span className="dashboard-review-description">{item.description}</span>
                          </div>
                          <div className="dashboard-review-actions-group">
                            {item.quickScheduleRequest && (
                              <>
                                <button
                                  type="button"
                                  className="dashboard-review-action is-approve"
                                  disabled={isProcessingReq}
                                  onClick={() => handleQuickScheduleRequest(item.quickScheduleRequest, 'approved')}
                                  title="Approuver directement"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Approuver</span>
                                </button>
                                <button
                                  type="button"
                                  className="dashboard-review-action is-reject"
                                  disabled={isProcessingReq}
                                  onClick={() => handleQuickScheduleRequest(item.quickScheduleRequest, 'rejected')}
                                  title="Refuser directement"
                                >
                                  <X size={12} />
                                  <span>Refuser</span>
                                </button>
                              </>
                            )}
                            <button type="button" className="dashboard-review-action" onClick={item.onAction}>{item.actionLabel}<ChevronRight size={12} /></button>
                          </div>
                        </div>
                      )
                    })}
                    {reviewItems.length > visibleReviewItems.length && (
                      <button type="button" className="dashboard-panel-link" onClick={() => navigate('/pointages')}>
                        + {reviewItems.length - visibleReviewItems.length} autre{reviewItems.length - visibleReviewItems.length > 1 ? 's' : ''} élément{reviewItems.length - visibleReviewItems.length > 1 ? 's' : ''} à examiner
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="dashboard-empty-state">
                    <span className="dashboard-empty-state-icon"><CheckCircle2 size={19} /></span>
                    <strong>{loadError ? 'Activité à recharger' : 'Tout est calme pour le moment'}</strong>
                    <span>{loadError ? 'Réessayez de charger les données avant de conclure.' : 'Aucun conflit, oubli de sortie ou demande d’horaire en attente.'}</span>
                  </div>
                )}
              </article>

              <article className="dashboard-panel dashboard-presence-card">
                <div className="dashboard-panel-heading">
                  <div className="dashboard-panel-title-wrap">
                    <span className="dashboard-panel-icon"><Activity size={16} /></span>
                    <div><h2 className="dashboard-panel-title">Présence aujourd’hui</h2><p className="dashboard-panel-subtitle">Répartition sur {employeeCount} employé{employeeCount === 1 ? '' : 's'}.</p></div>
                  </div>
                </div>
                <div className="dashboard-presence-summary">
                  <div className="dashboard-presence-ring" style={{ '--presence-angle': `${presenceRate * 3.6}deg` }}>
                    <div className="dashboard-presence-ring-inner"><strong>{presenceRate}%</strong><span>présence</span></div>
                  </div>
                  <div className="dashboard-presence-copy">
                    <strong>{presentCount} sur {employeeCount} ont pointé</strong>
                    <p>Mis à jour à {currentTimeLabel}</p>
                  </div>
                </div>
                <div className="dashboard-presence-legend">
                  <div className="dashboard-legend-row"><span className="dashboard-legend-dot" style={{ '--legend-color': 'var(--good)' }} /><span>Ayant pointé</span><strong className="dashboard-legend-value">{presentCount}</strong></div>
                  <div className="dashboard-legend-row"><span className="dashboard-legend-dot" style={{ '--legend-color': 'var(--violet)' }} /><span>Congés / maladie</span><strong className="dashboard-legend-value">{leaveCount}</strong></div>
                  <div className="dashboard-legend-row"><span className="dashboard-legend-dot" style={{ '--legend-color': 'var(--surface-raised)' }} /><span>Sans pointage déclaré</span><strong className="dashboard-legend-value">{absentCount}</strong></div>
                </div>
              </article>
            </section>

            <section className="dashboard-lower-grid">
              <article className="dashboard-panel">
                <div className="dashboard-panel-heading">
                  <div className="dashboard-panel-title-wrap">
                    <span className="dashboard-panel-icon"><Activity size={16} /></span>
                    <div><h2 className="dashboard-panel-title">Activité récente</h2><p className="dashboard-panel-subtitle">Les derniers mouvements enregistrés.</p></div>
                  </div>
                  <div className="dashboard-panel-actions">
                    <div className="dashboard-activity-filters" role="group" aria-label="Filtrer l’activité">
                      {[
                        { id: 'all', label: 'Tous' },
                        { id: 'in', label: 'Entrées' },
                        { id: 'out', label: 'Sorties' },
                        //  Sans l'option payante, aucun retard n'est détecté :
                        //  l'onglet n'a rien à montrer, il ne s'affiche pas.
                        ...(retardsOptionActive ? [{ id: 'late', label: 'Retards' }] : []),
                      ].map((filter) => (
                        <button
                          type="button"
                          key={filter.id}
                          className={`dashboard-activity-filter${filtreActivite === filter.id ? ' is-active' : ''}`}
                          onClick={() => setActivityFilter(filter.id)}
                          aria-pressed={filtreActivite === filter.id}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="dashboard-panel-link" onClick={() => navigate('/pointages')}>Pointages <ArrowRight size={13} /></button>
                  </div>
                </div>
                {recentActivity.filter((item) => (
                  filtreActivite === 'all'
                    ? true
                    : filtreActivite === 'late'
                      ? Boolean(item.isLate)
                      : String(item.type || '').toLowerCase() === filtreActivite
                )).length > 0 ? (
                  <div className="dashboard-activity-list">
                    {recentActivity
                      .filter((item) => (
                        filtreActivite === 'all'
                          ? true
                          : filtreActivite === 'late'
                            ? Boolean(item.isLate)
                            : String(item.type || '').toLowerCase() === filtreActivite
                      ))
                      .slice(0, 5)
                      .map((item) => {
                      const isEntry = String(item.type || '').toLowerCase() === 'in'
                      const Icon = isEntry ? UserCheck : LogOut
                      return (
                        <div
                          className="dashboard-activity-row is-interactive"
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedActivityItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedActivityItem(item)
                            }
                          }}
                          aria-label={`Voir le détail du pointage de ${formatName(item.employee)}`}
                        >
                          <div className="dashboard-activity-avatar">
                            {item.employee?.photo_url
                              ? <img src={item.employee.photo_url} alt="" />
                              : `${item.employee?.first_name?.[0] || ''}${item.employee?.last_name?.[0] || ''}` || <Users size={14} />}
                          </div>
                          <div className="dashboard-activity-copy">
                            <span className="dashboard-activity-name">{formatName(item.employee)}</span>
                            <span className="dashboard-activity-meta">{item.employee?.matricule || 'Pointage'}{item.hasPhoto ? ' · Photo enregistrée' : ''}</span>
                          </div>
                          <div className="dashboard-activity-right">
                            {item.isLate && (
                              <span className="dashboard-type-pill is-late" style={{ '--pill-color': 'var(--danger)', '--pill-bg': 'var(--danger-soft)' }}>
                                <Timer size={11} />Retard
                              </span>
                            )}
                            <span className={`dashboard-type-pill ${isEntry ? 'is-entry' : 'is-exit'}`} style={{ '--pill-color': isEntry ? 'var(--good)' : 'var(--accent-strong)', '--pill-bg': isEntry ? 'var(--good-soft)' : 'var(--accent-soft)' }}><Icon size={11} />{isEntry ? 'Entrée' : 'Sortie'}</span>
                            <time className="dashboard-activity-time">{formaterHeureLocale(item.time)}</time>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="dashboard-empty-state">
                    <span className="dashboard-empty-state-icon"><Clock size={18} /></span>
                    <strong>{loadError ? 'Activité non disponible' : 'Aucun pointage récent'}</strong>
                    <span>{loadError ? 'Réessayez après avoir vérifié la connexion.' : 'Les mouvements de l’équipe apparaîtront ici.'}</span>
                  </div>
                )}
              </article>

              {isSuperAdmin ? (
                <article className="dashboard-panel">
                  <div className="dashboard-panel-heading">
                    <div className="dashboard-panel-title-wrap">
                      <span className="dashboard-panel-icon"><Building2 size={16} /></span>
                      <div><h2 className="dashboard-panel-title">Entreprises actives</h2><p className="dashboard-panel-subtitle">Taux de présence aujourd’hui.</p></div>
                    </div>
                    <button type="button" className="dashboard-panel-link" onClick={() => navigate('/entreprises')}>Gérer <ArrowRight size={13} /></button>
                  </div>
                  {topEntreprises.length > 0 ? (
                    <div className="dashboard-company-list">
                      {topEntreprises.slice(0, 4).map((enterprise, index) => (
                        <div className="dashboard-company-row" key={enterprise.id}>
                          <span className="dashboard-company-rank">{index + 1}</span>
                          <span className="dashboard-company-logo">
                            {enterprise.logo_url ? <img src={enterprise.logo_url} alt="" /> : <Building2 size={15} />}
                          </span>
                          <span className="dashboard-company-copy">
                            <span className="dashboard-company-name">{enterprise.name}</span>
                            <span className="dashboard-company-meta">{enterprise.presentsToday}/{enterprise.employeesCount} ont pointé</span>
                          </span>
                          <strong className="dashboard-company-rate">{enterprise.tauxPresence}%</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state"><span className="dashboard-empty-state-icon"><Building2 size={18} /></span><strong>Aucune donnée disponible</strong><span>Les entreprises apparaîtront ici une fois les données chargées.</span></div>
                  )}
                </article>
              ) : (
                <article className="dashboard-panel">
                  <div className="dashboard-panel-heading">
                    <div className="dashboard-panel-title-wrap">
                      <span className="dashboard-panel-icon"><TrendingUp size={16} /></span>
                      <div><h2 className="dashboard-panel-title">Répartition du jour</h2><p className="dashboard-panel-subtitle">Les principaux indicateurs de présence.</p></div>
                    </div>
                  </div>
                  <div className="dashboard-distribution-list">
                    {[
                      { label: 'Ayant pointé', value: presentCount, color: 'var(--good)' },
                      { label: 'Absents', value: absentCount, color: 'var(--danger)' },
                      { label: 'Congés / maladie', value: leaveCount, color: 'var(--violet)' },
                    ].map((item) => {
                      const ratio = employeeCount > 0 ? Math.min((item.value / employeeCount) * 100, 100) : 0
                      return (
                        <div key={item.label}>
                          <div className="dashboard-distribution-label"><span>{item.label}</span><strong>{item.value}</strong></div>
                          <div className="dashboard-progress-track"><div className="dashboard-progress-fill" style={{ '--progress-color': item.color, width: `${ratio}%` }} /></div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="dashboard-summary-inline"><span>Taux de présence enregistré</span><strong>{presenceRate}%</strong></div>
                </article>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div className="dashboard-panel-title-wrap">
                  <span className="dashboard-panel-icon"><Sparkles size={16} /></span>
                  <div><h2 className="dashboard-panel-title">Accès rapide</h2><p className="dashboard-panel-subtitle">Les actions courantes, sans parcourir les menus.</p></div>
                </div>
                <div className="dashboard-quick-action-tools">
                  {isCustomizingQuickActions && (
                    <button type="button" className="dashboard-panel-link" onClick={() => setIsQuickActionCatalogOpen(true)} aria-haspopup="dialog" aria-expanded={isQuickActionCatalogOpen}>
                      <Plus size={14} /> Ajouter une action
                    </button>
                  )}
                  <button
                    type="button"
                    className={`dashboard-panel-link dashboard-quick-action-edit${isCustomizingQuickActions ? ' is-active' : ''}`}
                    onClick={() => setIsCustomizingQuickActions((value) => !value)}
                    aria-pressed={isCustomizingQuickActions}
                  >
                    {isCustomizingQuickActions ? <CheckCircle2 size={14} /> : <SlidersHorizontal size={14} />}
                    {isCustomizingQuickActions ? 'Terminer' : 'Personnaliser'}
                  </button>
                </div>
              </div>
              {isCustomizingQuickActions && (
                <div className="dashboard-quick-action-hint" role="status">
                  Glisse les poignées ou utilise les flèches pour organiser tes actions. Tu peux aussi les retirer ou en ajouter.
                  <button type="button" onClick={resetQuickActions}><RotateCcw size={12} /> Réinitialiser</button>
                </div>
              )}
              <div className={`dashboard-quick-actions${isCustomizingQuickActions ? ' is-customizing' : ''}`}>
                {quickActions.map((action, index) => {
                  const Icon = action.icon
                  return (
                    <article
                      className={`dashboard-quick-action-item${isCustomizingQuickActions ? ' is-editing' : ''}${draggedQuickActionId === action.id ? ' is-dragging' : ''}`}
                      key={action.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleQuickActionDrop(event, action.id)}
                    >
                      {isCustomizingQuickActions && (
                        <div className="quick-action-layout-controls" aria-label={`Contrôles de ${action.label}`}>
                          <button type="button" className="quick-action-drag-handle" draggable="true" onDragStart={(event) => handleQuickActionDragStart(event, action.id)} onDragEnd={() => setDraggedQuickActionId(null)} aria-label={`Déplacer ${action.label}`} title="Glisser pour déplacer"><GripVertical size={13} /></button>
                          <button type="button" onClick={() => moveQuickAction(action.id, -1)} disabled={index === 0} aria-label={`Déplacer ${action.label} vers le début`} title="Monter"><MoveUp size={12} /></button>
                          <button type="button" onClick={() => moveQuickAction(action.id, 1)} disabled={index === quickActions.length - 1} aria-label={`Déplacer ${action.label} vers la fin`} title="Descendre"><MoveDown size={12} /></button>
                          <button type="button" onClick={() => removeQuickAction(action.id)} aria-label={`Retirer ${action.label}`} title="Retirer des accès rapides"><X size={12} /></button>
                        </div>
                      )}
                      <button type="button" className="dashboard-quick-action" onClick={() => navigate(action.path)} disabled={isCustomizingQuickActions}>
                        <span className="dashboard-quick-action-icon"><Icon size={15} /></span>
                        <span className="dashboard-quick-action-copy"><span className="dashboard-quick-action-title">{action.label}</span><span className="dashboard-quick-action-subtitle">{action.description}</span></span>
                        {!isCustomizingQuickActions && <ChevronRight size={13} />}
                      </button>
                    </article>
                  )
                })}
                {quickActions.length === 0 && (
                  <div className="dashboard-quick-actions-empty">
                    <Sparkles size={17} />
                    <span>Aucune action rapide pour le moment. Ajoute celles que tu utilises le plus.</span>
                  </div>
                )}
              </div>
            </section>

            <footer className="dashboard-footer"><span>EN-CHECK</span> · Système de pointage intelligent · {todayLabel}</footer>
          </main>
        </div>
      </div>


      {isWidgetCatalogOpen && (
        <div className="dashboard-widget-catalog-overlay" role="presentation" onClick={() => setIsWidgetCatalogOpen(false)}>
          <section
            className="dashboard-widget-catalog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-widget-catalog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dashboard-widget-catalog-header">
              <div>
                <span className="dashboard-eyebrow">En-Check · Tableau personnel</span>
                <h2 id="dashboard-widget-catalog-title">Ajouter un widget</h2>
                <p>Choisis tes indicateurs. Seules les données réellement chargées par tes modules sont proposées.</p>
              </div>
              <button type="button" className="dashboard-widget-catalog-close" onClick={() => setIsWidgetCatalogOpen(false)} aria-label="Fermer la liste des widgets"><X size={17} /></button>
            </header>
            <div className="dashboard-widget-catalog-body">
              {unaddedWidgets.length > 0 ? (
                <div className="dashboard-widget-catalog-grid">
                  {unaddedWidgets.map((widget) => {
                    const Icon = widget.icon
                    return (
                      <article className={`dashboard-widget-choice dashboard-kpi--${widget.tone}`} key={widget.id}>
                        <span className="dashboard-widget-choice-icon"><Icon size={16} /></span>
                        <div className="dashboard-widget-choice-copy">
                          <strong>{widget.label}</strong>
                          <span>{widget.description}</span>
                          <small>{widget.sourceLabel}</small>
                        </div>
                        <button type="button" onClick={() => addWidget(widget.id)} aria-label={`Ajouter ${widget.label}`}><Plus size={15} /><span>Ajouter</span></button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-widget-catalog-empty">
                  <CheckCircle2 size={22} />
                  <strong>Tous les indicateurs disponibles sont déjà sur ton tableau.</strong>
                  <span>Tu peux les réorganiser ou retirer ceux dont tu n’as pas besoin.</span>
                </div>
              )}
              <p className="dashboard-widget-storage-note">Ta disposition est enregistrée sur cet appareil et pour ce compte.</p>
            </div>
          </section>
        </div>
      )}

      {isTopbarCatalogOpen && (
        <div className="dashboard-widget-catalog-overlay" role="presentation" onClick={() => setIsTopbarCatalogOpen(false)}>
          <section className="dashboard-widget-catalog" role="dialog" aria-modal="true" aria-labelledby="dashboard-topbar-catalog-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-widget-catalog-header">
              <div>
                <span className="dashboard-eyebrow">En-Check · En-tête personnel</span>
                <h2 id="dashboard-topbar-catalog-title">Ajouter un élément en haut</h2>
                <p>Choisis les éléments visibles dans la barre. Tu pourras ensuite les glisser, les retirer ou les réordonner.</p>
              </div>
              <div className="dashboard-widget-catalog-header-actions">
                <button type="button" className="dashboard-widget-catalog-reset" onClick={resetTopbarLayout}><RotateCcw size={13} /><span>Réinitialiser</span></button>
                <button type="button" className="dashboard-widget-catalog-close" onClick={() => setIsTopbarCatalogOpen(false)} aria-label="Fermer le catalogue de la barre du haut"><X size={17} /></button>
              </div>
            </header>
            <div className="dashboard-widget-catalog-body">
              {unaddedTopbarItems.length > 0 ? (
                <div className="dashboard-widget-catalog-grid">
                  {unaddedTopbarItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <article className="dashboard-widget-choice dashboard-topbar-choice" key={item.id}>
                        <span className="dashboard-widget-choice-icon"><Icon size={16} /></span>
                        <div className="dashboard-widget-choice-copy">
                          <strong>{item.label}</strong>
                          <span>{item.description}</span>
                          <small>Zone par défaut · {item.region === 'left' ? 'entreprise et date' : 'commandes'}</small>
                        </div>
                        <button type="button" onClick={() => addTopbarItem(item)} aria-label={`Ajouter ${item.label}`}><Plus size={15} /><span>Ajouter</span></button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-widget-catalog-empty">
                  <CheckCircle2 size={22} />
                  <strong>Tous les éléments de la barre sont déjà affichés.</strong>
                  <span>Tu peux les réorganiser ou retirer ceux que tu n’utilises pas.</span>
                </div>
              )}
              <p className="dashboard-widget-storage-note">La disposition est mémorisée par compte et par entreprise sur cet appareil.</p>
            </div>
          </section>
        </div>
      )}

      {isQuickActionCatalogOpen && (
        <div className="dashboard-widget-catalog-overlay" role="presentation" onClick={() => setIsQuickActionCatalogOpen(false)}>
          <section className="dashboard-widget-catalog" role="dialog" aria-modal="true" aria-labelledby="dashboard-quick-action-catalog-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-widget-catalog-header">
              <div>
                <span className="dashboard-eyebrow">En-Check · Actions rapides</span>
                <h2 id="dashboard-quick-action-catalog-title">Ajouter une action rapide</h2>
                <p>Choisis les raccourcis vers les pages auxquelles ton compte a accès.</p>
              </div>
              <button type="button" className="dashboard-widget-catalog-close" onClick={() => setIsQuickActionCatalogOpen(false)} aria-label="Fermer le catalogue des actions"><X size={17} /></button>
            </header>
            <div className="dashboard-widget-catalog-body">
              {unaddedQuickActions.length > 0 ? (
                <div className="dashboard-widget-catalog-grid">
                  {unaddedQuickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <article className="dashboard-widget-choice dashboard-quick-action-choice" key={action.id}>
                        <span className="dashboard-widget-choice-icon"><Icon size={16} /></span>
                        <div className="dashboard-widget-choice-copy">
                          <strong>{action.label}</strong>
                          <span>{action.description}</span>
                          <small>{action.category}</small>
                        </div>
                        <button type="button" onClick={() => addQuickAction(action.id)} aria-label={`Ajouter ${action.label}`}><Plus size={15} /><span>Ajouter</span></button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-widget-catalog-empty">
                  <CheckCircle2 size={22} />
                  <strong>Toutes les actions disponibles sont déjà dans tes accès rapides.</strong>
                  <span>Tu peux les réorganiser ou retirer celles dont tu n’as pas besoin.</span>
                </div>
              )}
              <p className="dashboard-widget-storage-note">Seuls les raccourcis vers les modules accessibles à ton compte sont proposés.</p>
            </div>
          </section>
        </div>
      )}

      {selectedActivityItem && (
        <div className="dashboard-conflict-overlay" role="presentation" onClick={() => setSelectedActivityItem(null)}>
          <section className="dashboard-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-activity-detail-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-conflict-header">
              <div className="dashboard-conflict-heading-icon"><Clock size={20} /></div>
              <div className="dashboard-conflict-heading-copy">
                <h2 id="dashboard-activity-detail-title">{formatName(selectedActivityItem.employee)}</h2>
                <p>{selectedActivityItem.employee?.matricule || 'Employé'} · {String(selectedActivityItem.type || '').toLowerCase() === 'in' ? 'Entrée' : 'Sortie'}</p>
              </div>
              <button type="button" className="dashboard-conflict-close" onClick={() => setSelectedActivityItem(null)} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="dashboard-conflict-body">
              <div className="dashboard-conflict-facts">
                <div><span>Heure enregistrée</span><strong>{formaterHeureLocale(selectedActivityItem.time)}</strong></div>
                <div><span>Statut</span><strong>{selectedActivityItem.isLate ? 'Arrivée en retard' : (String(selectedActivityItem.type || '').toLowerCase() === 'in' ? 'Arrivée à l’heure' : (selectedActivityItem.isAutoClosed ? 'Sortie auto-clôturée' : 'Sortie enregistrée'))}</strong></div>
                <div><span>Preuve</span><strong>{selectedActivityItem.hasPhoto ? 'Photo de pointage vérifiée' : 'Badge / Poste En-Check'}</strong></div>
              </div>
              {selectedActivityItem.photoUrl && (
                <div className="dashboard-activity-photo-preview">
                  <PhotoSignee url={selectedActivityItem.photoUrl} alt={`Pointage de ${formatName(selectedActivityItem.employee)}`} />
                </div>
              )}
              <div className="dashboard-conflict-actions">
                <button
                  type="button"
                  className="dashboard-conflict-option is-keep"
                  onClick={() => {
                    const query = selectedActivityItem.employee?.matricule || selectedActivityItem.employee?.last_name || ''
                    setSelectedActivityItem(null)
                    navigate(query ? `/pointages?q=${encodeURIComponent(query)}` : '/pointages')
                  }}
                >
                  <Clock size={17} /><span><strong>Ouvrir dans Pointages</strong><small>Consulter ou modifier la journée complète de ce collaborateur.</small></span><ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isForgottenExitModalOpen && (
        <div className="dashboard-conflict-overlay" role="presentation" onClick={() => setIsForgottenExitModalOpen(false)}>
          <section className="dashboard-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-forgotten-exit-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-conflict-header">
              <div className="dashboard-conflict-heading-icon"><LogOut size={20} /></div>
              <div className="dashboard-conflict-heading-copy">
                <h2 id="dashboard-forgotten-exit-title">Sorties manquantes à vérifier</h2>
                <p>Vérifiez les badges avant de renseigner une sortie manquante. Cette alerte ne constitue pas une estimation.</p>
              </div>
              <button type="button" className="dashboard-conflict-close" onClick={() => setIsForgottenExitModalOpen(false)} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="dashboard-conflict-body">
              {forgottenExitItems.length > 0 ? (
                <div className="dashboard-forgotten-exit-list">
                  {forgottenExitItems.map((item) => {
                    const exitTime = exitTimesById[item.id] || '18:00'
                    const isSaving = savingForgottenExitId === item.id
                    return (
                      <div className="dashboard-forgotten-exit-row" key={item.id}>
                        <div className="dashboard-forgotten-exit-copy">
                          <strong>{formatName(item.employee)}</strong>
                          <span>Arrivée à {formaterHeureLocale(item.check_time)}</span>
                        </div>
                        <div className="dashboard-forgotten-exit-controls">
                          <input
                            type="time"
                            value={exitTime}
                            aria-label={`Heure de sortie pour ${formatName(item.employee)}`}
                            onChange={(event) => setExitTimesById((current) => ({ ...current, [item.id]: event.target.value }))}
                          />
                          <button
                            type="button"
                            disabled={isSaving || !confirmForgottenExit}
                            onClick={async () => {
                              const ok = await confirmForgottenExit(item, exitTime)
                              if (ok && forgottenExitItems.length <= 1) setIsForgottenExitModalOpen(false)
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>{isSaving ? 'Enregistrement…' : 'Confirmer'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="dashboard-widget-storage-note">Toutes les sorties en attente ont été confirmées.</p>
              )}
              <div className="dashboard-conflict-actions">
                <button type="button" className="dashboard-conflict-option is-ignore" onClick={() => { setIsForgottenExitModalOpen(false); navigate('/pointages') }}>
                  <Clock size={17} /><span><strong>Voir tous les pointages</strong><small>Accéder au journal complet des entrées et sorties.</small></span><ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showConflictModal && selectedConflict && (
        <div className="dashboard-conflict-overlay" role="presentation" onClick={() => setShowConflictModal(false)}>
          <section className="dashboard-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-conflict-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-conflict-header">
              <div className="dashboard-conflict-heading-icon"><ShieldCheck size={21} /></div>
              <div className="dashboard-conflict-heading-copy">
                <h2 id="dashboard-conflict-title">Examiner le conflit</h2>
                <p>{formatName(selectedConflict.employees)}</p>
              </div>
              <button type="button" className="dashboard-conflict-close" onClick={() => setShowConflictModal(false)} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="dashboard-conflict-body">
              <div className="dashboard-conflict-facts">
                <div><span>Motif d’absence</span><strong>{selectedConflict.absences?.reason || 'Non précisé'}</strong></div>
                <div><span>Période</span><strong>{selectedConflict.absences?.start_date ? `${formatDate(selectedConflict.absences.start_date)}${selectedConflict.absences?.end_date ? ` – ${formatDate(selectedConflict.absences.end_date)}` : ''}` : '—'}</strong></div>
              </div>
              <label className="dashboard-conflict-label" htmlFor="dashboard-conflict-note">Note de résolution <span>(facultatif)</span></label>
              <textarea
                id="dashboard-conflict-note"
                className="dashboard-conflict-note"
                value={conflictNote}
                onChange={(event) => setConflictNote(event.target.value)}
                placeholder="Ajouter un contexte pour le suivi…"
                rows={3}
              />
              <div className="dashboard-conflict-actions">
                <button type="button" className="dashboard-conflict-option is-keep" onClick={() => resolveConflict('kept_absence')} disabled={resolvingConflict}>
                  <CheckCircle2 size={17} /><span><strong>Maintenir l’absence</strong><small>Conserver l’absence et le pointage.</small></span><ChevronRight size={15} />
                </button>
                <button type="button" className="dashboard-conflict-option is-cancel" onClick={() => resolveConflict('cancelled_absence')} disabled={resolvingConflict}>
                  <CalendarOff size={17} /><span><strong>Annuler l’absence</strong><small>Le pointage est conservé, l’absence annulée.</small></span><ChevronRight size={15} />
                </button>
                <button type="button" className="dashboard-conflict-option is-ignore" onClick={() => resolveConflict('ignored_conflict')} disabled={resolvingConflict}>
                  <X size={17} /><span><strong>Ignorer le conflit</strong><small>Marquer comme vu sans autre modification.</small></span><ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
