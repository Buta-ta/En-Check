import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coffee,
  FileSearch,
  FileText,
  Footprints,
  Globe,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Radio,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EnterpriseSwitcher from './EnterpriseSwitcher'
import NotificationBell from './NotificationBell'
import SpotlightFAB from './SpotlightFAB'
import SystemMessageBanner from './SystemMessageBanner'
import AttendanceIllustration from './AttendanceIllustration'
import LandingAnalytics from '../pages/LandingAnalytics'
import { formaterHeureLocale } from '../utils/timezoneUtils'
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

function DashboardNavItem({ item, isActive, tabState, onSelect }) {
  const Icon = item.icon
  const hasNewActivity = Boolean(tabState?.activeTriggers?.length && !tabState.viewed)

  return (
    <button
      type="button"
      className={`sidebar-link${isActive ? ' is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelect(item)}
    >
      <span className="sidebar-link-icon"><Icon size={16} strokeWidth={1.8} /></span>
      <span className="sidebar-link-label">{item.label}</span>
      {item.count > 0 && <span className="sidebar-link-count">{item.count > 99 ? '99+' : item.count}</span>}
      {!item.count && hasNewActivity && <span className="sidebar-link-dot" aria-label="Nouvelle activité" />}
    </button>
  )
}

export default function DashboardExperience({
  admin,
  entreprises = [],
  isSuperAdmin,
  isMultiEntreprise,
  modulePlanning,
  moduleRetards,
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
  showAnalytics,
  setShowAnalytics,
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
  const presenceRate = employeeCount > 0
    ? Math.max(0, Math.min(100, Math.round((presentCount / employeeCount) * 100)))
    : 0
  const reviewCount = conflictCount + scheduleRequestsPending.length + forgottenExits
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
        { label: 'Pauses', icon: Coffee, path: '/pauses', show: true },
        { label: 'Rapports', icon: FileText, path: '/rapports', show: true },
        { label: 'Jours fériés', icon: CalendarDays, path: '/jours-feries', show: true, tabKey: 'JOURS_FERIES' },
      ],
    },
    {
      label: 'Gestion RH',
      items: [
        { label: 'Heures supplémentaires', icon: Timer, path: '/heures-supplementaires', show: isSuperAdmin || moduleHeuresSup, tabKey: 'HEURES_SUP' },
        { label: 'Fiches de paie', icon: Wallet, path: '/fiches-paie', show: isSuperAdmin || moduleFichesPaie, tabKey: 'FICHES_PAIE' },
        { label: 'Rémunérations', icon: Wallet, path: '/remunerations', show: isSuperAdmin || moduleRemunerations },
        { label: 'Coût salarial', icon: TrendingUp, path: '/cout-salarial', show: isSuperAdmin || moduleCoutSalarial },
        { label: 'Configuration fiscale', icon: Shield, path: '/configuration-fiscale', show: isSuperAdmin || moduleConfigFiscale },
      ],
    },
    {
      label: 'Outils',
      items: [
        { label: 'Équipes & tâches', icon: CalendarDays, path: '/taches', show: isSuperAdmin || moduleTaches, tabKey: 'TACHES' },
        { label: 'Équipes', icon: Users, path: '/equipes', show: isSuperAdmin || moduleTaches },
        { label: 'Prédictions', icon: Sparkles, path: '/predictions', show: isSuperAdmin || modulePredictions, tabKey: 'PREDICTIONS' },
        { label: 'Carte en direct', icon: MapPin, path: '/carte-temps-reel', show: isSuperAdmin || moduleCarteTempsReel },
        { label: 'Zones de pointage', icon: Globe, path: '/geofencing', show: isSuperAdmin || moduleGeofencing, tabKey: 'GEOFENCING' },
        { label: 'Enrôlements faciaux', icon: UserCheck, path: '/enrollements-faciaux', show: isSuperAdmin || moduleRecoFaciale },
        { label: 'Configuration faciale', icon: Settings, path: '/config-reco-faciale', show: isSuperAdmin || moduleRecoFaciale },
        { label: 'Pointeuses ADMS', icon: Radio, path: '/pointeuses', show: isSuperAdmin || modulePointeuses },
        { label: 'Poste de pointage', icon: Activity, path: '/poste', show: isSuperAdmin || modulePostePointage },
      ],
    },
    {
      label: 'Administration',
      items: [
        { label: 'Entreprises', icon: Building2, path: '/entreprises', show: isSuperAdmin },
        { label: 'Administrateurs', icon: ShieldCheck, path: '/admins', show: isSuperAdmin },
        { label: 'Messages système', icon: Bell, path: '/system-messages', show: isSuperAdmin },
        { label: 'Prospection', icon: TrendingUp, path: '/prospection', show: isSuperAdmin },
        { label: 'Devis', icon: FileSearch, path: '/devis', show: isSuperAdmin },
        { label: 'Journal des connexions', icon: Activity, path: '/connexions', show: isSuperAdmin },
        { label: 'Carte des connexions', icon: Globe, path: '/connexions-map', show: isSuperAdmin },
        { label: 'Notifications push', icon: Bell, path: '/push-notifications', show: isSuperAdmin },
        { label: 'Analytics du site', icon: TrendingUp, show: isSuperAdmin, action: () => setShowAnalytics((visible) => !visible) },
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
    })
  })
  if (forgottenExits > 0) {
    reviewItems.push({
      key: 'forgotten-exits',
      kind: 'missing',
      icon: Clock,
      title: `${forgottenExits} sortie${forgottenExits > 1 ? 's' : ''} à confirmer`,
      description: 'Des arrivées n’ont pas encore de sortie enregistrée.',
      actionLabel: 'Vérifier',
      onAction: () => navigate('/pointages'),
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

  const quickActions = [
    { label: 'Ajouter un employé', description: 'Compléter l’équipe', icon: UserPlus, path: '/employes', show: true },
    { label: 'Consulter les pointages', description: 'Entrées et sorties', icon: Clock, path: '/pointages', show: true },
    { label: 'Ouvrir le planning', description: 'Horaires et équipes', icon: Calendar, path: '/planning', show: isSuperAdmin || modulePlanning },
    { label: 'Créer un rapport', description: 'Exporter les données', icon: FileText, path: '/rapports', show: true },
  ].filter((action) => action.show)

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
            <div className="sidebar-brand-mark"><Footprints size={22} strokeWidth={1.8} /></div>
            <div className="sidebar-brand-wordmark">en-check<span>ADMINISTRATION</span></div>
          </div>

          <div className="dashboard-sidebar-scroll">
            {navigationSections.map((section) => {
              const visibleItems = section.items.filter((item) => item.show)
              if (!visibleItems.length) return null
              return (
                <div className="sidebar-nav-group" key={section.label}>
                  <p className="sidebar-section-label">{section.label}</p>
                  <nav className="sidebar-nav-list" aria-label={section.label}>
                    {visibleItems.map((item) => (
                      <DashboardNavItem
                        key={item.path || item.label}
                        item={item}
                        isActive={Boolean(item.active)}
                        tabState={item.tabKey ? tabStates[item.tabKey] : null}
                        onSelect={handleNavigation}
                      />
                    ))}
                  </nav>
                </div>
              )
            })}

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

          <div className="sidebar-profile">
            <div className="sidebar-profile-avatar">{adminInitials}</div>
            <div className="sidebar-profile-copy">
              <span className="sidebar-profile-name">{adminName}</span>
              <span className="sidebar-profile-role">{adminRole}</span>
            </div>
            <button type="button" className="sidebar-logout" onClick={handleLogout} title="Déconnexion" aria-label="Déconnexion">
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        <div className="dashboard-workspace">
          <header className="dashboard-topbar">
            <div className="topbar-left">
              <button
                type="button"
                className="mobile-menu-button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
              >
                {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
              <div className="topbar-company">
                <EnterpriseSwitcher admin={admin} onSwitch={handleEnterpriseSwitch} />
              </div>
              <span className="topbar-date">{todayLabel}</span>
            </div>

            <div className="topbar-actions">
              <button type="button" className="topbar-search" onClick={() => navigate('/search')} aria-label="Ouvrir la recherche">
                <Search size={14} /><span>Rechercher</span><kbd>⌘ K</kbd>
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={themeLabel}
                aria-pressed={darkMode}
                title={themeLabel}
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                <span>{darkMode ? 'Clair' : 'Sombre'}</span>
              </button>
              <div className="topbar-icon-button">
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadCount}
                  hasHighPriority={hasHighPriority}
                  markAsRead={markAsRead}
                  markAllAsRead={markAllAsRead}
                />
              </div>
              <div className="topbar-admin" title={`${adminName} · ${adminRole}`}>
                <div className="topbar-avatar">{adminInitials}</div>
                <div className="topbar-admin-copy">
                  <span className="topbar-admin-name">{adminName}</span>
                  <span className="topbar-admin-role">{adminRole}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="dashboard-main">
            {showSystemMessages && <SystemMessageBanner userType="admins" />}

            {isSuperAdmin && showAnalytics && (
              <section className="dashboard-analytics-panel" aria-label="Analytics de la page d’accueil">
                <div className="dashboard-analytics-heading">
                  <span>Analytics de la page d’accueil</span>
                  <button type="button" className="dashboard-analytics-close" onClick={() => setShowAnalytics(false)}>Fermer</button>
                </div>
                <LandingAnalytics />
              </section>
            )}

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

            <section className="dashboard-hero">
              <div className="dashboard-hero-copy">
                <p className="dashboard-eyebrow"><span className="dashboard-live-dot" /> En-Check · Votre équipe en un coup d’œil</p>
                <h1 className="dashboard-greeting">{greeting}, <span className="dashboard-greeting-name">{admin?.first_name || 'bienvenue'}</span></h1>
                <p className="dashboard-subtitle">Voici la présence de votre équipe et les points à vérifier aujourd’hui.</p>
                <div className="dashboard-hero-meta">
                  <span className="dashboard-meta-chip"><Building2 size={13} />{selectedEnterpriseName}</span>
                  <span className="dashboard-meta-chip is-positive"><UserCheck size={13} />{presentCount} présent{presentCount > 1 ? 's' : ''}</span>
                  {todayHoliday && <span className="dashboard-meta-chip"><Calendar size={13} />{todayHoliday.name}</span>}
                  {conflictCount > 0 && <span className="dashboard-meta-chip is-alert"><AlertTriangle size={13} />{conflictCount} à examiner</span>}
                </div>
              </div>
              <div className="dashboard-hero-art"><AttendanceIllustration /></div>
            </section>

            <section className="dashboard-kpis" aria-label="Indicateurs du jour">
              <article className="dashboard-kpi dashboard-kpi--present">
                <div className="dashboard-kpi-top"><span className="dashboard-kpi-label">Présents aujourd’hui</span><span className="dashboard-kpi-icon"><UserCheck size={16} /></span></div>
                <strong className="dashboard-kpi-value">{presentCount}<span className="dashboard-kpi-total"> / {employeeCount}</span></strong>
                <span className="dashboard-kpi-caption">Employés avec au moins un pointage</span>
              </article>
              <article className="dashboard-kpi dashboard-kpi--review">
                <div className="dashboard-kpi-top"><span className="dashboard-kpi-label">À traiter</span><span className="dashboard-kpi-icon"><ShieldCheck size={16} /></span></div>
                <strong className="dashboard-kpi-value">{reviewCount}</strong>
                <span className="dashboard-kpi-caption">Conflits, demandes et sorties à vérifier</span>
              </article>
              <article className="dashboard-kpi dashboard-kpi--late">
                <div className="dashboard-kpi-top"><span className="dashboard-kpi-label">Retards</span><span className="dashboard-kpi-icon"><Timer size={16} /></span></div>
                <strong className="dashboard-kpi-value">{lateCount}</strong>
                <span className="dashboard-kpi-caption">Arrivées après l’horaire prévu</span>
              </article>
              <article className="dashboard-kpi dashboard-kpi--absent">
                <div className="dashboard-kpi-top"><span className="dashboard-kpi-label">Absents</span><span className="dashboard-kpi-icon"><UserX size={16} /></span></div>
                <strong className="dashboard-kpi-value">{absentCount}</strong>
                <span className="dashboard-kpi-caption">Sans pointage ni congé déclaré</span>
              </article>
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
                      return (
                        <div className={`dashboard-review-row is-${item.kind}`} key={item.key}>
                          <span className="dashboard-review-icon"><Icon size={15} /></span>
                          <div className="dashboard-review-copy">
                            <span className="dashboard-review-title">{item.title}</span>
                            <span className="dashboard-review-description">{item.description}</span>
                          </div>
                          <button type="button" className="dashboard-review-action" onClick={item.onAction}>{item.actionLabel}<ChevronRight size={12} /></button>
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
                    <strong>{presentCount} sur {employeeCount} présents</strong>
                    <p>Mis à jour à {currentTimeLabel}</p>
                  </div>
                </div>
                <div className="dashboard-presence-legend">
                  <div className="dashboard-legend-row"><span className="dashboard-legend-dot" style={{ '--legend-color': 'var(--good)' }} /><span>Présents</span><strong className="dashboard-legend-value">{presentCount}</strong></div>
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
                  <button type="button" className="dashboard-panel-link" onClick={() => navigate('/pointages')}>Pointages <ArrowRight size={13} /></button>
                </div>
                {recentActivity.length > 0 ? (
                  <div className="dashboard-activity-list">
                    {recentActivity.slice(0, 5).map((item) => {
                      const isEntry = String(item.type || '').toLowerCase() === 'in'
                      const Icon = isEntry ? UserCheck : LogOut
                      return (
                        <div className="dashboard-activity-row" key={item.id}>
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
                            <span className="dashboard-company-meta">{enterprise.presentsToday}/{enterprise.employeesCount} présents</span>
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
                      { label: 'Présents', value: presentCount, color: 'var(--good)' },
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
              </div>
              <div className="dashboard-quick-actions">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <button type="button" className="dashboard-quick-action" key={action.path} onClick={() => navigate(action.path)}>
                      <span className="dashboard-quick-action-icon"><Icon size={15} /></span>
                      <span className="dashboard-quick-action-copy"><span className="dashboard-quick-action-title">{action.label}</span><span className="dashboard-quick-action-subtitle">{action.description}</span></span>
                      <ChevronRight size={13} />
                    </button>
                  )
                })}
              </div>
            </section>

            <footer className="dashboard-footer"><span>EN-CHECK</span> · Système de pointage intelligent · {todayLabel}</footer>
          </main>
        </div>
      </div>

      <SpotlightFAB admin={admin} />

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
