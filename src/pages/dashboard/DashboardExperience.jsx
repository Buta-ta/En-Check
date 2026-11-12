// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — ASSEMBLAGE BENTO (maquette validée 12/11)
// Topbar flottante en pilule, sidebar en carte arrondie, grille
// bento de tuiles (vedette kente, KPI, flux direct, à traiter…).
// Les données réelles viennent de useDashboardData ; la
// synthèse kente de la RPC encheck_dashboard_synthese.
// ═══════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Share2 } from 'lucide-react'
import SystemMessageBanner from '../../components/SystemMessageBanner'
import BentoSidebar from './BentoSidebar'
import BentoGrid from './BentoGrid'
import DashboardTopbar from './DashboardTopbar'
import DashboardDialogs from './DashboardDialogs'
import KenteModalRapport from './kente/KenteModalRapport'
import { estPauseReelleEffectuee, formaterTempsPauseEnDirect } from '../../services/pausesService'
import {
  buildNavigationSections,
  buildQuickActionCatalog,
  buildReviewItems,
  buildWidgetCatalog,
} from './experienceCatalogs'
import { useDashboardLayout } from './useDashboardLayout'
import { useKenteSynthese } from './useKenteSynthese'
import { JOURS_FR, choisirInsight, formatDelta, moyenne, pctDelta } from './kente/kenteUtils'
import './bento.css'
import './sections.css'
import './kente/kente.css'
import './kente/kente-widgets.css'

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
  const adminRole = isSuperAdmin ? 'Super admin' : (isMultiEntreprise ? 'Admin multi-entreprises' : 'Administrateur')
  const selectedEnterpriseName = admin?.selectedEnterprise?.name || admin?.enterprise_name || 'Toutes les entreprises'
  const nowChipLabel = currentTime
    ? `${currentTime.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : '--:--'

  // Catalogues reconstruits à chaque rendu : la personnalisation s'appuie
  // sur des signatures texte (useDashboardLayout), jamais sur ces tableaux.
  const quickActionCatalog = buildQuickActionCatalog({
    isSuperAdmin, modulePlanning, moduleConges, moduleRetards, moduleHeuresSup,
    moduleFichesPaie, moduleConfigFiscale, moduleCoutSalarial,
    moduleRemunerations, moduleTaches, modulePredictions,
  })
  const widgetCatalog = buildWidgetCatalog({
    loadError, presentCount, employeeCount, presenceRate, reviewCount, lateCount,
    absentCount, leaveCount, forgottenExits, conflictCount, retardsOptionActive,
    isSuperAdmin, moduleConges, moduleRetards, stats, entreprises,
    realPausesToday, activePauses, unplannedPauses, nowMs, metricValue,
    metricCaption, metricShare,
  })
  const layout = useDashboardLayout({ admin, retardsOptionActive, widgetCatalog, quickActionCatalog })
  const navigationSections = buildNavigationSections({
    isSuperAdmin, modulePlanning, moduleConges, moduleRetards, moduleHeuresSup,
    moduleRemunerations, moduleFichesPaie, moduleConfigFiscale, modulePredictions,
    moduleCarteTempsReel, moduleGeofencing, moduleRecoFaciale, modulePointeuses,
    modulePostePointage, forgottenExits, conflictCount, scheduleRequestsPending,
    lateCount, activePauses,
  })
  const { reviewItems } = buildReviewItems({
    activePauses, conflictsPending, scheduleRequestsPending, forgottenExits,
    forgottenExitItems, lateCount, canManageConflict, openConflictModal,
    handleQuickScheduleRequest,
    setIsForgottenExitModalOpen: layout.setIsForgottenExitModalOpen,
    nowMs, navigate, isSuperAdmin, moduleRetards,
  })

  // ═══ SYNTHÈSE KENTE (tuile vedette + sparklines + rapport) ═══
  const kente = useKenteSynthese({ admin, isSuperAdmin })
  const { serie, tendances, sante, bornes, echec, chargement } = kente
  const insight = useMemo(
    () => (kente.donnees
      ? choisirInsight({ serie, heatmap: kente.donnees.heatmap, tendance: tendances, stats })
      : null),
    [kente.donnees, serie, tendances, stats],
  )
  const entreesJour = serie.length ? serie[serie.length - 1].entrees : 0
  const moy7 = Math.round(moyenne(serie.slice(-7).map((p) => p.entrees)))
  const deltaSemaine = pctDelta(tendances?.entrees_7j, tendances?.entrees_7j_prev)

  const [rapportOuvert, setRapportOuvert] = useState(false)
  const [copie, setCopie] = useState(false)
  const rapport = useMemo(() => {
    if (!kente.donnees) return ''
    const lignes = [
      'En-Check — Synthèse du tableau de bord',
      `Généré le ${new Date().toLocaleDateString('fr-FR')} · ${kente.scopeNom || 'Toutes les entreprises'}`,
      `Période : ${JOURS_FR[kente.jours]}`,
      '',
      "Aujourd'hui",
      `- Présents : ${stats?.presentsToday ?? '—'} (taux de présence ${stats?.tauxPresence ?? '—'} %)`,
      `- Retards : ${stats?.retardsToday ?? '—'} · Absents : ${stats?.absentsToday ?? '—'} · En congé : ${stats?.congesToday ?? '—'}`,
      `- Pointages : ${entreesJour} (moyenne 7 jours : ${moy7}/jour)`,
      '',
      'Tendance',
      `- Pointages 7 jours : ${tendances?.entrees_7j ?? '—'} (semaine précédente : ${tendances?.entrees_7j_prev ?? '—'}${deltaSemaine !== null ? ` → ${formatDelta(deltaSemaine)}` : ''})`,
      `- Assiduité : ${sante?.assiduite ?? '—'} % · Régularité : ${sante?.regularite ?? '—'} %`,
      '',
      'Bornes',
      `- ${bornes?.actives ?? '—'} borne(s) active(s) sur ${bornes?.total ?? '—'}`,
      '',
      'Insight du jour',
      insight || '—',
    ]
    return lignes.join('\n')
  }, [kente.donnees, kente.scopeNom, kente.jours, stats, entreesJour, moy7, tendances, deltaSemaine, sante, bornes, insight])

  async function copierRapport() {
    try {
      await navigator.clipboard.writeText(rapport)
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      // Le presse-papiers peut être bloqué : on n'échoue pas le rapport.
    }
  }

  const topbarData = {
    admin, handleEnterpriseSwitch, isSuperAdmin, isMultiEntreprise,
    darkMode, toggleTheme, notifications, unreadCount, hasHighPriority,
    markAsRead, markAllAsRead, adminName, adminRole, adminInitials,
    mobileMenuOpen, setMobileMenuOpen, nowChipLabel,
  }
  const dialogsData = {
    forgottenExitItems, confirmForgottenExit, savingForgottenExitId,
    showConflictModal, setShowConflictModal, selectedConflict, conflictNote,
    setConflictNote, resolvingConflict, resolveConflict,
  }
  const handleNavigation = (item) => {
    if (item.action === 'close' || !item.path) {
      setMobileMenuOpen(false)
      return
    }
    if (item.tabKey) markTabAsViewed?.(item.tabKey)
    navigate(item.path)
    setMobileMenuOpen(false)
  }
  const onItemAction = (item) => {
    if (item.quickScheduleRequest) {
      if (handleQuickScheduleRequest) handleQuickScheduleRequest(item.quickScheduleRequest)
      return
    }
    if (item.onAction) item.onAction()
  }

  return (
    <div className="encheck-dashboard bento-app" data-theme={darkMode ? 'dark' : 'light'}>
      <DashboardTopbar layout={layout} data={topbarData} />
      <BentoSidebar
        sections={navigationSections}
        tabStates={tabStates}
        onSelect={handleNavigation}
        idAdministrateur={admin?.id}
        mobileMenuOpen={mobileMenuOpen}
        adminName={adminName}
        adminRole={adminRole}
        adminInitials={adminInitials}
        isSuperAdmin={isSuperAdmin}
        handleLogout={handleLogout}
      />
      {mobileMenuOpen && (
        <button
          type="button"
          className="bento-mobile-overlay"
          aria-label="Fermer le menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="bento-main">
        {showSystemMessages && <SystemMessageBanner userType="admins" />}

        {loadError && (
          <div className="bento-error-banner" role="alert">
            <AlertTriangle size={19} />
            <div className="copy">
              <strong>Les données ne sont pas à jour</strong>
              <span>Impossible de charger l'activité du jour ({loadError}). Les compteurs ne doivent pas être interprétés comme des données réelles.</span>
            </div>
            <button type="button" onClick={retryLoad}>Réessayer</button>
          </div>
        )}

        <div className="page-head">
          <div>
            <h1>Vue d'ensemble</h1>
            <div className="sub">
              <span className="chip"><span className="d" aria-hidden="true" />Temps réel</span>
              <span className="chip">{selectedEnterpriseName}</span>
              {isMultiEntreprise && entreprises.length > 0 && <span className="chip">{entreprises.length} entreprises</span>}
              {todayHoliday && <span className="chip is-gold">{todayHoliday.name}</span>}
              {conflictCount > 0 && <span className="chip is-alert">{conflictCount} à examiner</span>}
            </div>
            <div className="kente-accent" aria-hidden="true" />
          </div>
          <div className="head-actions">
            <button type="button" className="btn" onClick={() => navigate('/pointages')}>
              <span className="plus">+</span> Pointage manuel
            </button>
            <button type="button" className="btn" onClick={() => navigate('/planning')}>
              <span className="plus">+</span> Demande d'horaire
            </button>
            <button
              type="button"
              className="btn gold"
              onClick={() => setRapportOuvert(true)}
              disabled={!kente.donnees}
              aria-haspopup="dialog"
            >
              <Share2 size={14} />
              Rapport kente{!kente.donnees && chargement ? '…' : ''}
            </button>
          </div>
        </div>

        <BentoGrid
          layout={layout}
          employeeCount={employeeCount}
          presentCount={presentCount}
          absentCount={absentCount}
          lateCount={lateCount}
          leaveCount={leaveCount}
          presenceRate={presenceRate}
          stats={stats}
          retardsOptionActive={retardsOptionActive}
          isSuperAdmin={isSuperAdmin}
          loadError={loadError}
          reviewItems={reviewItems}
          reviewCount={reviewCount}
          topEntreprises={topEntreprises}
          todayHoliday={todayHoliday}
          recentActivity={recentActivity}
          activePauses={activePauses}
          realPausesToday={realPausesToday}
          unplannedPauses={unplannedPauses}
          nowMs={nowMs}
          bornes={bornes}
          serie={serie}
          kente={kente.donnees || !echec ? {
            ...kente,
            insight,
            onRapport: () => setRapportOuvert(true),
          } : null}
          onItemAction={onItemAction}
          processingScheduleRequestId={processingScheduleRequestId}
          formaterPause={formaterTempsPauseEnDirect}
        />
      </main>

      <DashboardDialogs layout={layout} data={dialogsData} />
      <KenteModalRapport
        ouvert={rapportOuvert}
        onFermer={() => setRapportOuvert(false)}
        rapport={rapport}
        copie={copie}
        onCopier={copierRapport}
      />
    </div>
  )
}
