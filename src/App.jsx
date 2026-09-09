// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Landing page
import LandingPage from './pages/en-check'

// Admin pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employes from './pages/Employes'
import Pointages from './pages/Pointages'
import Entreprises from './pages/Entreprises'
import Rapports from './pages/Rapports'
import Admins from './pages/Admins'
import Planning from './pages/Planning'
import Retards from './pages/Retards'
import SystemMessages from './pages/SystemMessages'
import Absences from './pages/Absences'
import HeuresSupplementaires from './pages/HeuresSupplementaires'
import Prospection from './pages/Prospection'
import Devis from './pages/Devis'
import ConfigGeofencing from './pages/ConfigGeofencing'
import CarteTempsReel from './pages/CarteTempsReel'
import JoursFeries from './pages/JoursFeries'

// Employee pages
import EmployeeLogin from './pages/employee/EmployeeLogin'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import EmployeeConges from './pages/employee/EmployeeConges'
import EmployeeHeures from './pages/employee/EmployeeHeures'
import EmployeeHoraires from './pages/employee/EmployeeHoraires'
import EmployeeRoute from './components/EmployeeRoute'
// Le verrou des options payantes : une adresse tapée à la main n'ouvre pas un
// écran que l'entreprise n'a pas acheté.
import VerrouOptions from './components/VerrouOptions'

import GestionEnrolements from './pages/GestionEnrolements'
// Le poste de pointage : l'écran qu'on laisse allumé à l'entrée du site — la
// tablette lit le badge de l'employé et enregistre son arrivée ou son départ.
import PostePointage from './pages/PostePointage'
// La page « Pointeuses » : enregistrer une machine ADMS, lire son secret,
// télécharger `appareils.json` — sans jamais ouvrir Supabase.
import Pointeuses from './pages/Pointeuses'
import CoutSalarial from './pages/CoutSalarial'
import Remunerations from './pages/Remunerations'
import ConfigRecoFaciale from './pages/ConfigRecoFaciale'
import FichesPaie from './pages/FichesPaie'
import EmployeeFichesPaie from './pages/employee/EmployeeFichesPaie'
import ConfigurationFiscale from './pages/ConfigurationFiscale'
import ConnectionLogs from './pages/ConnectionLogs'
import ConnectionsMap from './pages/ConnectionsMap'
import Teams from './pages/Teams'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import EmployeeTasks from './pages/employee/EmployeeTasks'
import Predictions from './pages/Predictions'
import PushNotifications from './pages/PushNotifications'
import SpotlightSearch from './pages/SpotlightSearch'

// ═══════════════════════════════════════════════════════════
// 🔐 COMPOSANT DE PROTECTION DES ROUTES ADMIN
// ═══════════════════════════════════════════════════════════
function AdminRoute({ children, requireSuperAdmin = false }) {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      try {
        const adminRaw = localStorage.getItem('admin')
        if (!adminRaw) {
          setAuthorized(false)
          setChecking(false)
          return
        }

        const admin = JSON.parse(adminRaw)

        // ✅ Vérifier l'expiration de session
        if (!admin.expiresAt || Date.now() > admin.expiresAt) {
          localStorage.removeItem('admin')
          localStorage.removeItem('last_enterprise_id')
          setAuthorized(false)
          setChecking(false)
          return
        }

        // ✅ Vérifier le rôle super_admin si requis
        if (requireSuperAdmin && admin.role !== 'super_admin') {
          setAuthorized(false)
          setChecking(false)
          return
        }

        // ✅ Vérifier la session Supabase Auth
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            // Session Supabase expirée → déconnexion
            localStorage.removeItem('admin')
            localStorage.removeItem('last_enterprise_id')
            setAuthorized(false)
          } else {
            setAuthorized(true)
          }
          setChecking(false)
        })

      } catch {
        localStorage.removeItem('admin')
        setAuthorized(false)
        setChecking(false)
      }
    }

    checkAuth()
  }, [requireSuperAdmin])

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(245,158,11,0.2)',
          borderTopColor: '#F59E0B',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/login" replace />
  }

  return children
}

// ═══════════════════════════════════════════════════════════
// 🔄 LISTENER DE SESSION SUPABASE
// ═══════════════════════════════════════════════════════════
function SessionListener() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (!session) {
          // Session expirée côté Supabase → nettoyer le localStorage
          localStorage.removeItem('admin')
          localStorage.removeItem('last_enterprise_id')
          window.location.href = '/login'
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}

// ═══════════════════════════════════════════════════════════
// 🚀 APP
// ═══════════════════════════════════════════════════════════
function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-center" />
        <SessionListener />
        <VerrouOptions>
        <Routes>

          {/* ═══ LANDING PAGE ═══ */}
          <Route path="/" element={<LandingPage />} />

          {/* ═══ AUTH ═══ */}
          <Route path="/login" element={<Login />} />


          <Route path="/employee/login" element={<EmployeeLogin />} />

          {/* Le poste de pointage : aucun compte à ouvrir, la tablette se lie à
              l'entreprise une seule fois avec son code, puis elle sert tout le monde. */}
          <Route path="/poste" element={<PostePointage />} />

          {/* ═══ ADMIN ROUTES PROTÉGÉES ═══ */}
          <Route path="/dashboard" element={
            <AdminRoute>
              <Dashboard />
            </AdminRoute>
          } />


          <Route path="/employes" element={
            <AdminRoute>
              <Employes />
            </AdminRoute>
          } />
          <Route path="/pointages" element={
            <AdminRoute>
              <Pointages />
            </AdminRoute>
          } />
          <Route path="/entreprises" element={
            <AdminRoute>
              <Entreprises />
            </AdminRoute>
          } />
          <Route path="/rapports" element={
            <AdminRoute>
              <Rapports />
            </AdminRoute>
          } />
          <Route path="/admins" element={
            <AdminRoute>
              <Admins />
            </AdminRoute>
          } />
          <Route path="/planning" element={
            <AdminRoute>
              <Planning />
            </AdminRoute>
          } />
          <Route path="/retards" element={
            <AdminRoute>
              <Retards />
            </AdminRoute>
          } />
          <Route path="/system-messages" element={
            <AdminRoute>
              <SystemMessages />
            </AdminRoute>
          } />

          <Route path="/push-notifications" element={
            <AdminRoute requireSuperAdmin>
              <PushNotifications />
            </AdminRoute>
          } />
          <Route path="/absences" element={
            <AdminRoute>
              <Absences />
            </AdminRoute>
          } />
          <Route path="/heures-supplementaires" element={
            <AdminRoute>
              <HeuresSupplementaires />
            </AdminRoute>
          } />
          <Route path="/jours-feries" element={
            <AdminRoute>
              <JoursFeries />
            </AdminRoute>
          } />
          <Route path="/fiches-paie" element={
            <AdminRoute>
              <FichesPaie />
            </AdminRoute>
          } />
          <Route path="/configuration-fiscale" element={
            <AdminRoute>
              <ConfigurationFiscale />
            </AdminRoute>
          } />
          <Route path="/geofencing" element={
            <AdminRoute>
              <ConfigGeofencing />
            </AdminRoute>
          } />
          <Route path="/carte-temps-reel" element={
            <AdminRoute>
              <CarteTempsReel />
            </AdminRoute>
          } />
          <Route path="/enrollements-faciaux" element={
            <AdminRoute>
              <GestionEnrolements />
            </AdminRoute>
          } />
          <Route path="/config-reco-faciale" element={
            <AdminRoute>
              <ConfigRecoFaciale />
            </AdminRoute>
          } />
          <Route path="/pointeuses" element={
            <AdminRoute>
              <Pointeuses />
            </AdminRoute>
          } />
          <Route path="/cout-salarial" element={
            <AdminRoute>
              <CoutSalarial />
            </AdminRoute>
          } />
          <Route path="/remunerations" element={
            <AdminRoute>
              <Remunerations />
            </AdminRoute>
          } />

          {/* ⚡ NOUVELLE ROUTE SPOTLIGHT */}
          <Route path="/search" element={<SpotlightSearch />} />


          {/* ═══ ROUTES SUPER ADMIN UNIQUEMENT ═══ */}
          <Route path="/prospection" element={
            <AdminRoute requireSuperAdmin>
              <Prospection />
            </AdminRoute>
          } />
          <Route path="/devis" element={
            <AdminRoute requireSuperAdmin>
              <Devis />
            </AdminRoute>
          } />
          <Route path="/connexions" element={
            <AdminRoute requireSuperAdmin>
              <ConnectionLogs />
            </AdminRoute>
          } />
          <Route path="/connexions-map" element={
            <AdminRoute requireSuperAdmin>
              <ConnectionsMap />
            </AdminRoute>
          } />



          {/* ═══ EMPLOYEE ROUTES ═══ */}
          <Route path="/employee/dashboard" element={
            <EmployeeRoute>
              <EmployeeDashboard />
            </EmployeeRoute>
          } />
          <Route path="/employee/conges" element={
            <EmployeeRoute requiredFeature="conges">
              <EmployeeConges />
            </EmployeeRoute>
          } />
          <Route path="/employee/heures" element={
            <EmployeeRoute requiredFeature="heures_supplementaires">
              <EmployeeHeures />
            </EmployeeRoute>
          } />
          <Route path="/employee/horaires" element={
            <EmployeeRoute requiredFeature="planning">
              <EmployeeHoraires />
            </EmployeeRoute>
          } />
          <Route path="/employee/fiches-paie" element={
            <EmployeeRoute requiredFeature="fiches_paie">
              <EmployeeFichesPaie />
            </EmployeeRoute>
          } />

          <Route path="/employee/taches" element={
            <EmployeeRoute requiredFeature="gestion_taches">
              <EmployeeTasks />
            </EmployeeRoute>
          } />

          <Route path="/equipes" element={
            <AdminRoute>
              <Teams />
            </AdminRoute>
          } />

          <Route path="/taches" element={
            <AdminRoute>
              <Tasks />
            </AdminRoute>
          } />



          <Route path="/taches/:taskId" element={
            <AdminRoute>
              <TaskDetail />
            </AdminRoute>
          } />

          <Route path="/predictions" element={
            <AdminRoute>
              <Predictions />
            </AdminRoute>
          } />



          {/* ═══ CATCH-ALL → Landing ═══ */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
        </VerrouOptions>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App