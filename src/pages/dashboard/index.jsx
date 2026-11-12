// ═══════════════════════════════════════════════════════════
// 📊 PAGE DASHBOARD — point d'entrée
// Récupère les données (useDashboardData), les interactions
// (useDashboardInteractions) et délègue tout le rendu à
// DashboardExperience (même dossier).
// ═══════════════════════════════════════════════════════════
import EnCheckBrandMark from '../../components/EnCheckBrandMark'
import NotificationPermissionPrompt from '../../components/NotificationPermissionPrompt'
import DashboardExperience from './DashboardExperience'
import { useDashboardData } from './useDashboardData'
import { useDashboardInteractions } from './useDashboardInteractions'

export default function Dashboard() {
  const data = useDashboardData()
  const {
    navigate, today, admin, entreprises, loading, loadError,
    mobileMenuOpen, setMobileMenuOpen,
    modulePlanning, moduleRetards, retardsOptionActive, moduleConges,
    moduleHeuresSup, moduleGeofencing, moduleCarteTempsReel,
    moduleRecoFaciale, moduleFichesPaie, moduleTaches, modulePredictions,
    modulePointeuses, modulePostePointage, moduleRemunerations,
    moduleCoutSalarial, moduleConfigFiscale, stats, recentActivity,
    topEntreprises, conflictsPending, scheduleRequestsPending,
    processingScheduleRequestId, forgottenExitItems, savingForgottenExitId,
    pausesToday, todayHoliday, currentTime, notifications, unreadCount,
    hasHighPriority, markAsRead, markAllAsRead, tabStates, markTabAsViewed,
    showConflictModal, setShowConflictModal, selectedConflict, conflictNote,
    setConflictNote, resolvingConflict, darkMode, toggleTheme, loadData,
  } = data
  const {
    canManageConflict, openConflictModal, resolveConflict,
    handleQuickScheduleRequest, confirmForgottenExit, handleLogout,
  } = useDashboardInteractions({
    admin, today, navigate, loadData, refreshNotifications: data.refreshNotifications,
    setSelectedConflict: data.setSelectedConflict, setConflictNote: data.setConflictNote,
    setShowConflictModal: data.setShowConflictModal,
    setResolvingConflict: data.setResolvingConflict,
    setProcessingScheduleRequestId: data.setProcessingScheduleRequestId,
    setSavingForgottenExitId: data.setSavingForgottenExitId,
  })
  const handleEnterpriseSwitch = () => window.location.reload()

  const isSuperAdmin = admin?.role === 'super_admin'
  const isMultiEntreprise = admin?.isMultiEntreprise || (admin?.entreprises?.length > 1)
  if (loading) {
    return (
      <div className="encheck-dashboard dashboard-loading" data-theme={darkMode ? 'dark' : 'light'} role="status" aria-live="polite">
        <div className="dashboard-loading-brand">
          <EnCheckBrandMark className="dashboard-loading-mark" size={48} loading />
          <div className="dashboard-loading-copy">
            <strong>En-Check</strong>
            <span>On gère !</span>
          </div>
        </div>
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
        retardsOptionActive={retardsOptionActive}
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
        kenteStats={stats}
        conflictsPending={conflictsPending}
        scheduleRequestsPending={scheduleRequestsPending}
        handleQuickScheduleRequest={handleQuickScheduleRequest}
        processingScheduleRequestId={processingScheduleRequestId}
        forgottenExitItems={forgottenExitItems}
        confirmForgottenExit={confirmForgottenExit}
        savingForgottenExitId={savingForgottenExitId}
        pausesToday={pausesToday}
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
