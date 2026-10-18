// src/pages/SpotlightSearch.jsx

import { useState, useEffect, useMemo } from 'react'
import { getActiveTimezone, getPartsLocaux, libelleFuseau } from '../utils/timezoneUtils'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogOut, LayoutDashboard, Menu, X } from 'lucide-react'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import { supabase } from '../lib/supabase'

import SearchBar from '../components/SpotlightSearch/SearchBar'
import SearchResults from '../components/SpotlightSearch/SearchResults'
import QuickSuggestions from '../components/SpotlightSearch/QuickSuggestions'
import ActivityFeed from '../components/SpotlightSearch/ActivityFeed'
import UserGuide from '../components/SpotlightSearch/UserGuide'
import QRScanner from '../components/SpotlightSearch/QRScanner'
import EnterpriseSwitcher from '../components/EnterpriseSwitcher'

import useSpotlight from '../hooks/useSpotlight'
import '../styles/spotlight.css'

const lastEnterpriseKeyForAdmin = (adminId) => `last_enterprise_id_${adminId}`

export default function SpotlightSearch() {
  const navigate = useNavigate()

  const [admin, setAdmin] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showScanner, setShowScanner] = useState(false)
  const [autoOpenEnterpriseSwitcher, setAutoOpenEnterpriseSwitcher] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const {
    query,
    setQuery,
    results,
    loading,
    selectedIndex,
    setSelectedIndex,
    handleSearch,
    handleArrowNavigation,
    clearResults,
  } = useSpotlight(admin)

  const entreprises = useMemo(() => admin?.entreprises || [], [admin])

  const isMultiEntreprise = useMemo(() => {
    if (!admin) return false
    if (admin.role === 'super_admin') return entreprises.length > 0
    return entreprises.length > 1
  }, [admin, entreprises.length])

  const activeEnterpriseId = admin?.selectedEnterprise?.id || null
  const canSearch = !isMultiEntreprise || !!activeEnterpriseId

  // Init admin + entreprise active
  useEffect(() => {
    const raw = localStorage.getItem('admin')
    if (!raw) { navigate('/login'); return }

    const parsed = JSON.parse(raw)
    const resolved = resolveEnterpriseOnLoad(parsed)

    setAdmin(resolved.adminResolved)
    localStorage.setItem('admin', JSON.stringify(resolved.adminResolved))

    if (resolved.adminResolved?.id && resolved.adminResolved?.selectedEnterprise?.id) {
      localStorage.setItem('last_enterprise_id', resolved.adminResolved.selectedEnterprise.id)
      localStorage.setItem(lastEnterpriseKeyForAdmin(resolved.adminResolved.id), resolved.adminResolved.selectedEnterprise.id)
    }

    if (resolved.shouldAutoOpen) {
      setTimeout(() => setAutoOpenEnterpriseSwitcher(true), 150)
      setTimeout(() => setAutoOpenEnterpriseSwitcher(false), 1200)
    }
  }, [navigate])

  // Horloge
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ⌘K / Ctrl+K : focus input
  // Dans SpotlightSearch.jsx, remplace le useEffect existant par :

useEffect(() => {
  const handler = (e) => {
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key === 'k'
    if (isCmdK) {
      e.preventDefault()
      const input = document.getElementById('spotlight-search-input')
      if (input) {
        input.focus()
        input.select() // ✅ Sélectionner le texte existant
      }
    }
  }
  
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, []) // ✅ Dépendances vides

  // ESC : fermer scanner / clear
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (showScanner) setShowScanner(false)
      else if (query) {
        setQuery('')
        clearResults()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showScanner, query, setQuery, clearResults])

  const handleLogout = async () => {
    try { await supabase.auth.signOut() } catch {}
    try {
      if (admin?.id) localStorage.removeItem(lastEnterpriseKeyForAdmin(admin.id))
      localStorage.removeItem('admin')
      localStorage.removeItem('last_enterprise_id')
    } finally {
      navigate('/login')
    }
  }

  // ⭐ LIVRAISON 04 : cette horloge affichait l'heure du NAVIGATEUR tout en
  // annonçant en dur « Fuseau: WAT (GMT+1) ». Un administrateur de la
  // diaspora en France voyait donc l'heure de Paris avec l'étiquette de
  // Cotonou. Elle affiche maintenant l'heure réelle de l'entreprise.
  const fuseau = getActiveTimezone()

  const formatTime = (date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: fuseau })

  const formatDate = (date) =>
    date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: fuseau })

  const getGreeting = () => {
    const hour = getPartsLocaux(currentTime, fuseau).heures
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const handleEnterpriseSwitch = (enterprise, updatedAdminFromSwitcher) => {
    const nextAdmin = updatedAdminFromSwitcher || { ...admin, selectedEnterprise: enterprise }
    setAdmin(nextAdmin)

    // relancer la recherche (premium)
    if (query?.trim()) handleSearch(query)
    else clearResults()
  }

  const handleResultSelect = (result) => {
    if (!result) return

    // Actions
    if (result.type === 'action') {
      if (result.action === 'openScanner') setShowScanner(true)
      if (result.action === 'goDashboard') navigate('/dashboard')
      if (result.action === 'goReports') navigate('/rapports')
      if (result.action === 'goMap') navigate('/carte-temps-reel')
      if (result.action === 'goPredictions') navigate('/predictions')
      if (result.action === 'focusSearch') document.getElementById('spotlight-search-input')?.focus()
      return
    }

    // Navigation
    if (result.type === 'employee') navigate(`/employes?id=${result.id}`)
    else if (result.type === 'attendance') navigate('/pointages')
    else if (result.type === 'retard') navigate('/retards')
    else if (result.type === 'task') navigate(`/taches/${result.id}`)
    else if (result.type === 'hours_detail') {
      console.log('Détails heures:', result)
    }
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      handleArrowNavigation(e)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (!canSearch) return

      if (results.length > 0) {
        handleResultSelect(results[selectedIndex])
        return
      }

      handleSearch()
      return
    }
  }

  if (!admin) return null

  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════════ */
        /* 🎨 HEADER MODERNE & RESPONSIVE */
        /* ═══════════════════════════════════════════════════════ */
        
        .spotlight-top-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(15, 15, 25, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(245, 158, 11, 0.15);
          padding: 12px 20px;
        }
        
        .spotlight-header-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        
        .spotlight-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        
        .spotlight-admin-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 1px;
          flex-shrink: 0;
        }
        
        .spotlight-admin-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        
        .spotlight-admin-name {
          color: #FFFFFF;
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .spotlight-admin-role {
          color: #F59E0B;
          font-size: 11px;
          font-weight: 500;
        }
        
        .spotlight-header-center {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .spotlight-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .spotlight-dashboard-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.12);
          color: #F59E0B;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        
        .spotlight-dashboard-btn:hover {
          transform: translateY(-2px);
          background: rgba(245, 158, 11, 0.18);
          border-color: rgba(245, 158, 11, 0.45);
          box-shadow: 0 10px 30px rgba(245, 158, 11, 0.15);
        }
        
        .spotlight-logout-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(239, 68, 68, 0.10);
          color: #EF4444;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .spotlight-logout-btn:hover {
          transform: translateY(-2px);
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(239, 68, 68, 0.35);
          box-shadow: 0 10px 30px rgba(239, 68, 68, 0.12);
        }
        
        .spotlight-mobile-menu-btn {
          display: none;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 10px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          cursor: pointer;
          color: #F59E0B;
        }
        
        /* ═══════════════════════════════════════════════════════ */
        /* 📱 MOBILE MENU */
        /* ═══════════════════════════════════════════════════════ */
        
        .spotlight-mobile-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          z-index: 200;
          display: none;
          animation: fadeIn 0.2s ease;
        }
        
        .spotlight-mobile-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(85vw, 360px);
          background: #0F0F19;
          border-left: 1px solid rgba(245, 158, 11, 0.15);
          display: flex;
          flex-direction: column;
          overflow: auto;
          animation: slideIn 0.3s ease;
        }
        
        .spotlight-mobile-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .spotlight-mobile-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .spotlight-mobile-name {
          color: #FFFFFF;
          font-weight: 600;
          font-size: 16px;
        }
        
        .spotlight-mobile-role {
          color: #F59E0B;
          font-size: 12px;
          margin-top: 2px;
        }
        
        .spotlight-close-menu-btn {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 10px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #F59E0B;
        }
        
        .spotlight-mobile-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .spotlight-mobile-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
          margin: 8px 0;
        }
        
        .spotlight-mobile-action {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.2s ease;
          color: #E5E5E5;
          font-size: 15px;
          font-weight: 500;
        }
        
        .spotlight-mobile-action:hover {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.2);
        }
        
        /* ═══════════════════════════════════════════════════════ */
        /* 📱 RESPONSIVE */
        /* ═══════════════════════════════════════════════════════ */
        
        @media (max-width: 768px) {
          .spotlight-header-center,
          .spotlight-dashboard-btn-text {
            display: none !important;
          }
          
          .spotlight-mobile-menu-btn,
          .spotlight-mobile-overlay.active {
            display: flex !important;
          }
          
          .spotlight-admin-info {
            display: none;
          }
        }
        
        @media (max-width: 480px) {
          .spotlight-dashboard-btn {
            padding: 10px;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HEADER FIXE */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="spotlight-top-header">
        <div className="spotlight-header-inner">
          {/* LEFT: Avatar + Info */}
          <div className="spotlight-header-left">
            <div className="spotlight-admin-avatar">
              {admin?.first_name?.[0]}{admin?.last_name?.[0]}
            </div>
            <div className="spotlight-admin-info">
              <span className="spotlight-admin-name">
                {admin?.first_name} {admin?.last_name}
              </span>
              <span className="spotlight-admin-role">
                {admin?.role === 'super_admin' ? '⚡ Super Admin' : (isMultiEntreprise ? '🏢 Multi-Admin' : '👤 Admin')}
              </span>
            </div>
          </div>

          {/* CENTER: Enterprise Switcher (desktop only) */}
          {isMultiEntreprise && (
            <div className="spotlight-header-center">
              <EnterpriseSwitcher
                admin={admin}
                onSwitch={handleEnterpriseSwitch}
                autoOpen={autoOpenEnterpriseSwitcher}
              />
            </div>
          )}

          {/* RIGHT: Dashboard + Logout */}
          <div className="spotlight-header-right">
            <button
              type="button"
              className="spotlight-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              title="Accéder au Dashboard"
            >
              <LayoutDashboard size={18} />
              <span className="spotlight-dashboard-btn-text">Dashboard</span>
            </button>

            <button
              type="button"
              className="spotlight-logout-btn"
              onClick={handleLogout}
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile menu button */}
            <button
              type="button"
              className="spotlight-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MOBILE MENU */}
      {/* ═══════════════════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="spotlight-mobile-overlay active" onClick={() => setMobileMenuOpen(false)}>
          <div className="spotlight-mobile-panel" onClick={e => e.stopPropagation()}>
            <div className="spotlight-mobile-header">
              <div className="spotlight-mobile-user">
                <div className="spotlight-admin-avatar">
                  {admin?.first_name?.[0]}{admin?.last_name?.[0]}
                </div>
                <div>
                  <div className="spotlight-mobile-name">
                    {admin?.first_name} {admin?.last_name}
                  </div>
                  <div className="spotlight-mobile-role">
                    {admin?.role === 'super_admin' ? '⚡ Super Admin' : (isMultiEntreprise ? '🏢 Multi-Admin' : '👤 Admin')}
                  </div>
                </div>
              </div>
              <button className="spotlight-close-menu-btn" onClick={() => setMobileMenuOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="spotlight-mobile-content">
              {isMultiEntreprise && (
                <>
                  <EnterpriseSwitcher
                    admin={admin}
                    onSwitch={handleEnterpriseSwitch}
                    autoOpen={false}
                  />
                  <div className="spotlight-mobile-divider"></div>
                </>
              )}

              <button
                className="spotlight-mobile-action"
                onClick={() => {
                  navigate('/dashboard')
                  setMobileMenuOpen(false)
                }}
              >
                <LayoutDashboard size={20} color="#F59E0B" />
                <span>Dashboard</span>
              </button>

              <div className="spotlight-mobile-divider"></div>

              <button
                className="spotlight-mobile-action"
                style={{ color: '#EF4444' }}
                onClick={() => {
                  handleLogout()
                  setMobileMenuOpen(false)
                }}
              >
                <LogOut size={20} color="#EF4444" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONTENU PRINCIPAL (INCHANGÉ) */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="spotlight-container">
        <div className="spotlight-bg-pattern" />
        <div className="spotlight-bg-orb spotlight-bg-orb-1" />
        <div className="spotlight-bg-orb spotlight-bg-orb-2" />

        <div className="spotlight-content">
          <header className="spotlight-header">
            <div className="spotlight-logo-container">
              <div className="spotlight-logo-icon">
                <EnCheckBrandMark size={64} loading={loading} className="spotlight-logo-footprints" />
              </div>
              <h1 className="spotlight-logo-text">EN-CHECK</h1>
              <p className="spotlight-logo-subtitle">On gère ! • Intelligence Hub</p>
            </div>

            <div className="spotlight-clock">
              <div className="spotlight-clock-time">{formatTime(currentTime)}</div>
              <div className="spotlight-clock-date">{formatDate(currentTime)}</div>
              <div className="spotlight-clock-timezone">Fuseau : {libelleFuseau(fuseau)}</div>
            </div>

            <div className="spotlight-welcome">
              <p className="spotlight-welcome-text">
                {getGreeting()}, <span className="spotlight-welcome-name">{admin.first_name}</span>
              </p>

              {!isMultiEntreprise && admin.selectedEnterprise && (
                <span className="spotlight-welcome-enterprise">
                  {admin.selectedEnterprise.name}
                </span>
              )}
            </div>
          </header>

          <div className="spotlight-search-section">
            <SearchBar
              query={query}
              setQuery={(v) => {
                setQuery(v)
                if (selectedIndex !== 0) setSelectedIndex(0)
              }}
              onKeyDown={handleInputKeyDown}
              loading={loading}
              onScanClick={() => {
                if (!canSearch) return
                setShowScanner(true)
              }}
            />

            {loading && (
              <div className="spotlight-search-progress">
                <div className="spotlight-search-progress-bar" />
              </div>
            )}
          </div>

          {results.length > 0 && (
            <SearchResults
              results={results}
              selectedIndex={selectedIndex}
              onSelect={handleResultSelect}
            />
          )}

          {!query && !results.length && canSearch && <UserGuide />}

          {!query && !results.length && canSearch && (
            <QuickSuggestions
              onSuggestionClick={(s) => {
                if (s.type === 'action') {
                  handleResultSelect({ type: 'action', action: s.action })
                  return
                }
                if (s.type === 'command') {
                  setQuery(s.value)
                  handleSearch(s.value)
                }
              }}
            />
          )}

          {!query && !results.length && canSearch && (
            <ActivityFeed
              admin={admin}
              enterpriseId={activeEnterpriseId}
              onActivityClick={(activity) => {
                if (activity.type === 'attendance') navigate('/pointages')
                else if (activity.type === 'task') navigate('/taches')
                else if (activity.type === 'leave_request') navigate('/absences')
                else if (activity.type === 'view_all') navigate('/dashboard')
              }}
            />
          )}

          <div className="spotlight-cta">
            <button className="spotlight-cta-button" onClick={() => navigate('/dashboard')}>
              <span>Accéder au Dashboard complet</span>
              <ArrowRight size={20} />
            </button>
            <p className="spotlight-cta-subtitle">ou utilisez la recherche pour gagner du temps</p>
          </div>

          <footer className="spotlight-footer">
            <div className="spotlight-footer-line" />
            <p className="spotlight-footer-text">
              <EnCheckBrandMark size={16} />
              EN-CHECK • On gère !
            </p>
          </footer>
        </div>

         {showScanner && (
  <QRScanner
    onClose={() => setShowScanner(false)}
    onScan={(scannedValue) => {
      // scannedValue = "PIC-0002" (matricule) dans ton cas
      setQuery(scannedValue)
      handleSearch(scannedValue)
    }}
  />
)}
      </div>
    </>
  )
}

function resolveEnterpriseOnLoad(adminParsed) {
  const admin = { ...adminParsed }
  const entreprises = admin.entreprises || []
  const isMulti = admin.role === 'super_admin' || entreprises.length > 1

  if (!isMulti) {
    if (!admin.selectedEnterprise && entreprises.length === 1) admin.selectedEnterprise = entreprises[0]
    return { adminResolved: admin, shouldAutoOpen: false }
  }

  const key = admin.id ? lastEnterpriseKeyForAdmin(admin.id) : null
  const lastId = (key && localStorage.getItem(key)) || localStorage.getItem('last_enterprise_id')

  const findById = (id) => entreprises.find(e => e?.id === id) || null

  if (admin.selectedEnterprise?.id && findById(admin.selectedEnterprise.id)) {
    return { adminResolved: admin, shouldAutoOpen: false }
  }

  if (lastId) {
    const restored = findById(lastId)
    if (restored) {
      admin.selectedEnterprise = restored
      return { adminResolved: admin, shouldAutoOpen: false }
    }
  }

  if (entreprises.length > 0) {
    admin.selectedEnterprise = entreprises[0]
    return { adminResolved: admin, shouldAutoOpen: true }
  }

  admin.selectedEnterprise = null
  return { adminResolved: admin, shouldAutoOpen: true }
}