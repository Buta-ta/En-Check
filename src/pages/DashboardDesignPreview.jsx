import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import DashboardExperience from '../components/DashboardExperience'

const today = new Date()
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const enterprise = { id: 'preview-enterprise', name: 'Kora & Co.', code: 'KORA', logo_url: null }

const demoConflicts = [
  {
    id: 'preview-conflict-mireille',
    employees: { first_name: 'Mireille', last_name: 'Ahouansou', matricule: 'KOR-014' },
    absences: { reason: 'Congé planifié', start_date: todayIso, end_date: todayIso },
    attendances: { check_time: new Date().toISOString(), check_type: 'in' },
  },
  {
    id: 'preview-conflict-simon',
    employees: { first_name: 'Simon', last_name: 'Dossou', matricule: 'KOR-026' },
    absences: { reason: 'Absence déclarée', start_date: todayIso, end_date: todayIso },
    attendances: { check_time: new Date().toISOString(), check_type: 'in' },
  },
]

export default function DashboardDesignPreview() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [selectedConflict, setSelectedConflict] = useState(null)
  const [conflictNote, setConflictNote] = useState('')

  return (
    <>
      <div style={{ position: 'fixed', zIndex: 1200, right: 14, bottom: 14, padding: '7px 10px', color: '#fff', background: '#39332c', borderRadius: 9, fontSize: 10, boxShadow: '0 5px 20px #0002' }}>
        Aperçu de design · données fictives
      </div>
      <DashboardExperience
        admin={{
          id: 'preview-admin',
          first_name: 'Amélie',
          last_name: 'Akakpo',
          role: 'admin',
          enterprise_id: enterprise.id,
          enterprise_name: enterprise.name,
          selectedEnterprise: enterprise,
          entreprises: [enterprise],
        }}
        entreprises={[enterprise]}
        isSuperAdmin={false}
        isMultiEntreprise={false}
        modulePlanning
        moduleRetards
        moduleConges
        moduleHeuresSup
        moduleGeofencing
        moduleCarteTempsReel
        moduleRecoFaciale
        moduleFichesPaie
        moduleTaches
        modulePredictions
        modulePointeuses
        modulePostePointage
        moduleRemunerations
        moduleCoutSalarial
        moduleConfigFiscale
        stats={{
          entreprises: 1,
          employes: 56,
          pointages: 82,
          presentsToday: 42,
          absentsToday: 7,
          congesToday: 7,
          retardsToday: 3,
          photosToday: 18,
          oublisSortie: 2,
          tauxPresence: 75,
          conflitsPending: 2,
        }}
        recentActivity={[
          { id: 'punch-1', type: 'in', time: new Date(Date.now() - 4 * 60_000).toISOString(), employee: { first_name: 'Paule', last_name: 'Hountondji', matricule: 'KOR-008' }, hasPhoto: false },
          { id: 'punch-2', type: 'out', time: new Date(Date.now() - 15 * 60_000).toISOString(), employee: { first_name: 'Yannick', last_name: 'Adandé', matricule: 'KOR-031' }, hasPhoto: true },
          { id: 'punch-3', type: 'in', time: new Date(Date.now() - 26 * 60_000).toISOString(), employee: { first_name: 'Mireille', last_name: 'Ahouansou', matricule: 'KOR-014' }, hasPhoto: true },
          { id: 'punch-4', type: 'in', time: new Date(Date.now() - 37 * 60_000).toISOString(), employee: { first_name: 'Simon', last_name: 'Dossou', matricule: 'KOR-026' }, hasPhoto: false },
        ]}
        topEntreprises={[]}
        conflictsPending={demoConflicts}
        scheduleRequestsPending={[
          { id: 'request-1', created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), employees: { first_name: 'Paule', last_name: 'Hountondji', matricule: 'KOR-008' } },
        ]}
        todayHoliday={null}
        currentTime={new Date()}
        loadError={null}
        notifications={[]}
        unreadCount={0}
        hasHighPriority={false}
        markAsRead={() => {}}
        markAllAsRead={() => {}}
        handleLogout={() => navigate('/login')}
        handleEnterpriseSwitch={() => {}}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        tabStates={{
          POINTAGES: { tabKey: 'POINTAGES', viewed: false, activeTriggers: [{ priority: 'medium' }] },
          PLANNING: { tabKey: 'PLANNING', viewed: false, activeTriggers: [{ priority: 'info' }] },
        }}
        markTabAsViewed={() => {}}
        canManageConflict
        openConflictModal={(conflict) => {
          setSelectedConflict(conflict)
          setConflictNote('')
          setShowConflictModal(true)
        }}
        showConflictModal={showConflictModal}
        setShowConflictModal={setShowConflictModal}
        selectedConflict={selectedConflict}
        conflictNote={conflictNote}
        setConflictNote={setConflictNote}
        resolvingConflict={false}
        resolveConflict={() => setShowConflictModal(false)}
        retryLoad={() => {}}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        showSystemMessages={false}
      />
    </>
  )
}
