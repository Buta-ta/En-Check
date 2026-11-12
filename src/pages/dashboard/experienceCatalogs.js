// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — CATALOGUES ET HELPERS PARTAGÉS
// Helpers de formatage, lecture des dispositions locales,
// catalogues topbar, sections de navigation, éléments à
// vérifier, actions rapides et widgets KPI. Construits à
// chaque rendu par la page (la personnalisation s'appuie sur
// des signatures, jamais sur ces tableaux).
// ═══════════════════════════════════════════════════════════
import {
  AlertTriangle, Bell, Building2, Calendar, CalendarDays, CalendarOff, Camera,
  Clock, Coffee, FileText, LayoutDashboard, LogOut, MapPin, Megaphone, Moon,
  Plus, Router, ScanFace, Shield, ShieldCheck, SlidersHorizontal, Sparkles,
  Timer, TrendingUp, UserCheck, UserPlus, UserX, Users, Wallet,
} from 'lucide-react'
import {
  DEFAULT_DASHBOARD_WIDGETS,
  normalizeDashboardWidgetIds,
} from './dashboardWidgets'
import { formaterTempsPauseEnDirect } from '../../services/pausesService'

export const formatName = (person) => {
  const name = `${person?.first_name || ''} ${person?.last_name || ''}`.trim()
  return name || 'Employé'
}

export const formatDate = (date) => {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export const readDashboardWidgetLayout = (storageKey, availableIds, fallbackIds) => {
  try {
    const saved = window.localStorage.getItem(storageKey)
    return normalizeDashboardWidgetIds(saved ? JSON.parse(saved) : null, availableIds, fallbackIds)
  } catch {
    return normalizeDashboardWidgetIds(null, availableIds, fallbackIds)
  }
}

export const readDashboardLayoutIds = (storageKey, availableIds, fallbackIds, allowEmpty = false) => {
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

export const TOPBAR_LEFT_CATALOG = [
  { id: 'enterprise', label: 'Entreprise active', description: 'Changer d’entreprise affichée.', icon: Building2, region: 'left' },
  { id: 'date', label: 'Date du jour', description: 'Afficher la date courante.', icon: CalendarDays, region: 'left' },
]
export const TOPBAR_RIGHT_CATALOG = [
  { id: 'dashboard-customize', label: 'Personnaliser le tableau', description: 'Réorganiser les widgets KPI et l’en-tête.', icon: SlidersHorizontal, region: 'right' },
  { id: 'add-widget', label: 'Ajouter un widget', description: 'Ajouter un KPI au tableau.', icon: Plus, region: 'right' },
  { id: 'theme', label: 'Thème clair / sombre', description: 'Changer l’apparence du tableau.', icon: Moon, region: 'right' },
  { id: 'notifications', label: 'Notifications', description: 'Consulter les notifications.', icon: Bell, region: 'right' },
  { id: 'profile', label: 'Profil administrateur', description: 'Voir le compte connecté.', icon: Users, region: 'right' },
]
const TOPBAR_LEFT_AVAILABLE_IDS = TOPBAR_LEFT_CATALOG.map((item) => item.id)
const TOPBAR_RIGHT_AVAILABLE_IDS = TOPBAR_RIGHT_CATALOG.map((item) => item.id)
export const ALL_TOPBAR_AVAILABLE_IDS = [...TOPBAR_LEFT_AVAILABLE_IDS, ...TOPBAR_RIGHT_AVAILABLE_IDS]
export const DEFAULT_TOPBAR_LEFT_ITEM_IDS = ['enterprise', 'date']
export const DEFAULT_TOPBAR_RIGHT_ITEM_IDS = ['dashboard-customize', 'theme', 'notifications', 'profile']


export function buildNavigationSections({
  isSuperAdmin, modulePlanning, moduleConges, moduleRetards, moduleHeuresSup,
  moduleRemunerations, moduleFichesPaie, moduleConfigFiscale, modulePredictions,
  moduleCarteTempsReel, moduleGeofencing, moduleRecoFaciale, modulePointeuses,
  modulePostePointage, forgottenExits, conflictCount, scheduleRequestsPending,
  lateCount, activePauses,
}) {
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
        { label: 'Annonces d’accueil', icon: Megaphone, path: '/annonces-accueil', show: isSuperAdmin },
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
  return navigationSections
}

export function buildReviewItems({
  activePauses, conflictsPending, scheduleRequestsPending, forgottenExits,
  forgottenExitItems, lateCount, canManageConflict, openConflictModal,
  handleQuickScheduleRequest, setIsForgottenExitModalOpen, nowMs, navigate,
  isSuperAdmin, moduleRetards,
}) {
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
  return { reviewItems, visibleReviewItems }
}

export function buildQuickActionCatalog({
  isSuperAdmin, modulePlanning, moduleConges, moduleRetards, moduleHeuresSup,
  moduleFichesPaie, moduleConfigFiscale, moduleCoutSalarial, moduleRemunerations,
  moduleTaches, modulePredictions,
}) {
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
  return quickActionCatalog
}

export function buildWidgetCatalog({
  loadError, presentCount, employeeCount, presenceRate, reviewCount, lateCount,
  absentCount, leaveCount, forgottenExits, conflictCount, retardsOptionActive,
  isSuperAdmin, moduleConges, moduleRetards, stats, entreprises,
  realPausesToday, activePauses,
  unplannedPauses, nowMs, metricValue, metricCaption, metricShare,
}) {
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
  return widgetCatalog
}
