// src/components/EmployeeLayout.jsx
// ═══════════════════════════════════════════════════════════
// 🏠 LAYOUT ESPACE EMPLOYÉ
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Footprints, LayoutDashboard, Calendar, Clock, CalendarDays,
  LogOut, User, ChevronRight, Menu, X, ClipboardList
} from 'lucide-react'
import EmployeeAuthService from '../services/employeeAuthService'

export default function EmployeeLayout({ children }) {
  const [employee, setEmployee] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) {
      navigate('/employee/login')
      return
    }
    setEmployee(emp)
  }, [navigate])

  const handleLogout = () => {
    EmployeeAuthService.logout()
    navigate('/employee/login')
  }

  if (!employee) return null

  const menuItems = [
    {
      path: '/employee/dashboard',
      icon: LayoutDashboard,
      label: 'Tableau de bord',
      always: true,
    },


    {
      path: '/employee/taches',
      icon: ClipboardList,
      label: 'Mes tâches',
      feature: 'gestion_taches',
    },
    {
      path: '/employee/conges',
      icon: CalendarDays,
      label: 'Mes congés',
      feature: 'conges',
    },
    {
      path: '/employee/heures',
      icon: Clock,
      label: 'Heures supplémentaires',
      feature: 'heures_supplementaires',
    },
    {
      path: '/employee/horaires',
      icon: Calendar,
      label: 'Mes horaires',
      feature: 'planning',
    },
  ]

  const visibleItems = menuItems.filter(item => 
    item.always || employee.features?.[item.feature]
  )

  const primaryColor = employee.enterprise?.primary_color || '#F59E0B'

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .emp-nav-item {
          transition: all 0.2s ease !important;
        }
        .emp-nav-item:hover {
          background: rgba(255,255,255,0.06) !important;
          transform: translateX(4px) !important;
        }
        .emp-logout-btn:hover {
          background: rgba(239, 68, 68, 0.15) !important;
        }
        @media (max-width: 768px) {
          .emp-sidebar {
            position: fixed !important;
            z-index: 200 !important;
            transform: translateX(-100%);
            transition: transform 0.3s ease !important;
          }
          .emp-sidebar.open {
            transform: translateX(0) !important;
          }
          .emp-main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>

      <div style={layoutStyles.container}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            style={layoutStyles.overlay} 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={`emp-sidebar ${sidebarOpen ? 'open' : ''}`}
          style={layoutStyles.sidebar}
        >
          {/* Header */}
          <div style={layoutStyles.sidebarHeader}>
            <div style={layoutStyles.logoSection}>
              {employee.enterprise?.logo_url ? (
                <img 
                  src={employee.enterprise.logo_url} 
                  alt="" 
                  style={layoutStyles.logoImg}
                />
              ) : (
                <div style={{
                  ...layoutStyles.logoPlaceholder,
                  background: `${primaryColor}20`,
                  border: `1px solid ${primaryColor}40`,
                }}>
                  <Footprints size={20} color={primaryColor} />
                </div>
              )}
              <div>
                <h3 style={layoutStyles.enterpriseName}>
                  {employee.enterprise?.name || 'Mon espace'}
                </h3>
                <span style={layoutStyles.portalLabel}>Espace employé</span>
              </div>
            </div>
          </div>

          {/* Profile card */}
          <div style={layoutStyles.profileCard}>
            <div style={{
              ...layoutStyles.profileAvatar,
              border: `2px solid ${primaryColor}50`,
            }}>
              {employee.photo_url ? (
                <img src={employee.photo_url} alt="" style={layoutStyles.profileImg} />
              ) : (
                <User size={20} color={primaryColor} />
              )}
            </div>
            <div style={layoutStyles.profileInfo}>
              <span style={layoutStyles.profileName}>
                {employee.first_name} {employee.last_name}
              </span>
              <span style={layoutStyles.profileRole}>
                {employee.position || employee.matricule}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav style={layoutStyles.nav}>
            {visibleItems.map(item => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  className="emp-nav-item"
                  onClick={() => {
                    navigate(item.path)
                    setSidebarOpen(false)
                  }}
                  style={{
                    ...layoutStyles.navItem,
                    ...(isActive ? {
                      background: `${primaryColor}15`,
                      borderLeft: `3px solid ${primaryColor}`,
                      color: primaryColor,
                    } : {}),
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
                </button>
              )
            })}
          </nav>

          {/* Logout */}
          <div style={layoutStyles.sidebarFooter}>
            <button
              className="emp-logout-btn"
              onClick={handleLogout}
              style={layoutStyles.logoutBtn}
            >
              <LogOut size={18} />
              <span>Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="emp-main-content" style={layoutStyles.mainContent}>
          {/* Mobile header */}
          <header style={layoutStyles.mobileHeader}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={layoutStyles.menuBtn}
            >
              <Menu size={22} color="#FFF" />
            </button>
            <span style={layoutStyles.mobileTitle}>
              {visibleItems.find(i => i.path === location.pathname)?.label || 'Mon espace'}
            </span>
            <div style={{
              ...layoutStyles.mobileAvatar,
              border: `2px solid ${primaryColor}50`,
            }}>
              {employee.photo_url ? (
                <img src={employee.photo_url} alt="" style={layoutStyles.profileImg} />
              ) : (
                <User size={16} color={primaryColor} />
              )}
            </div>
          </header>

          {/* Page content */}
          <main style={layoutStyles.pageContent}>
            {children}
          </main>
        </div>
      </div>
    </>
  )
}

const layoutStyles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0A0A0F',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 150,
  },
  sidebar: {
    width: '260px',
    background: 'rgba(15, 15, 25, 0.98)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100vh',
    position: 'sticky',
    top: 0,
  },
  sidebarHeader: {
    padding: '20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    objectFit: 'cover',
  },
  logoPlaceholder: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterpriseName: {
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '700',
    margin: 0,
    lineHeight: '1.2',
  },
  portalLabel: {
    color: '#666',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: '600',
  },
  profileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    margin: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  profileAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(245, 158, 11, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  profileImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  profileName: {
    color: '#FFF',
    fontSize: '13px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileRole: {
    color: '#666',
    fontSize: '11px',
  },
  nav: {
    flex: 1,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: 'none',
    borderLeft: '3px solid transparent',
    background: 'transparent',
    color: '#999',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    width: '100%',
  },
  sidebarFooter: {
    padding: '12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.06)',
    border: '1px solid rgba(239, 68, 68, 0.1)',
    borderRadius: '10px',
    color: '#EF4444',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mainContent: {
    flex: 1,
    marginLeft: 0,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  mobileHeader: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'rgba(15, 15, 25, 0.95)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  menuBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    borderRadius: '10px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTitle: {
    color: '#FFF',
    fontSize: '15px',
    fontWeight: '600',
  },
  mobileAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: 'rgba(245, 158, 11, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pageContent: {
    flex: 1,
    padding: '24px',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
}

// Media query via JS pour le mobile header
if (typeof window !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @media (max-width: 768px) {
      .emp-main-content header {
        display: flex !important;
      }
    }
  `
  document.head.appendChild(style)
}