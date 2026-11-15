// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — BARRE DU HAUT (maquette v4 validée 15/11)
// Marque, navigation horizontale (Dashboard · Pointages ·
// Équipe · Planning · Paie · Plus), bascule de thème,
// notifications et profil. Le menu « Plus » regroupe le reste
// de la navigation (catalogue buildNavigationSections),
// l'espace employé et la déconnexion. Sur mobile, le
// hamburger ouvre le même menu en panneau plein écran.
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ExternalLink, LogOut, Menu, Moon, Sun } from 'lucide-react'
import NotificationBell from '../../components/NotificationBell'
import EnCheckBrandMark from '../../components/EnCheckBrandMark'

const NAV_PRIMAIRE = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Pointages', path: '/pointages' },
  { label: 'Équipe', path: '/employes' },
  { label: 'Planning', path: '/planning' },
  { label: 'Paie', path: '/paie' },
]

export default function DashboardTopbar({
  admin,
  isSuperAdmin,
  darkMode,
  toggleTheme,
  notifications,
  unreadCount,
  hasHighPriority,
  markAsRead,
  markAllAsRead,
  adminName,
  adminRole,
  adminInitials,
  mobileMenuOpen,
  setMobileMenuOpen,
  sections = [],
  handleNavigation,
  handleLogout,
}) {
  const location = useLocation()
  const [plusOuvert, setPlusOuvert] = useState(false)
  const plusRef = useRef(null)

  // Fermer le menu « Plus » au clic extérieur
  useEffect(() => {
    if (!plusOuvert) return undefined
    const surDocument = (evenement) => {
      if (plusRef.current && !plusRef.current.contains(evenement.target)) setPlusOuvert(false)
    }
    document.addEventListener('mousedown', surDocument)
    return () => document.removeEventListener('mousedown', surDocument)
  }, [plusOuvert])

  const estActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  const themeLabel = darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'

  // Le menu « Plus » : tout ce que la nav primaire ne montre pas
  const plusSections = sections
    .map((section) => ({
      label: section.label,
      items: section.items.filter(
        (item) => item.show && !NAV_PRIMAIRE.some((nav) => nav.path === item.path),
      ),
    }))
    .filter((section) => section.items.length > 0)

  const menuContenu = (
    <>
      {plusSections.map((section) => (
        <div className="mq-plus-group" key={section.label}>
          <div className="mq-plus-label microlabel">{section.label}</div>
          {section.items.map((item) => {
            const Icone = item.icon
            return (
              <button
                type="button"
                key={item.path}
                className="mq-plus-item"
                onClick={() => {
                  setPlusOuvert(false)
                  handleNavigation(item)
                }}
              >
                <Icone size={16} />
                {item.label}
                {item.count > 0 && <span className="count">{item.count}</span>}
              </button>
            )
          })}
        </div>
      ))}
      <div className="mq-plus-sep" aria-hidden="true" />
      <button
        type="button"
        className="mq-plus-item"
        onClick={() => {
          setPlusOuvert(false)
          setMobileMenuOpen(false)
          window.location.href = '/employee/login'
        }}
      >
        <ExternalLink size={16} />
        Espace employé
      </button>
      <button type="button" className="mq-plus-item mq-plus-logout" onClick={handleLogout}>
        <LogOut size={16} />
        Déconnexion
      </button>
    </>
  )

  return (
    <header className="bento-topbar">
      <button
        type="button"
        className="mq-menu-button"
        aria-label="Ouvrir le menu de navigation"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu size={19} />
      </button>

      <a className="mq-brand" href="/dashboard" aria-label="En-Check — Tableau de bord">
        <EnCheckBrandMark size={38} />
        <span className="copy">
          <b>En-Check</b>
          <span>On gère !</span>
        </span>
      </a>

      <nav className="mq-nav" aria-label="Navigation principale">
        {NAV_PRIMAIRE.map((nav) => (
          <Link
            key={nav.path}
            to={nav.path}
            className={`mq-nav-item${estActive(nav.path) ? ' is-active' : ''}`}
            aria-current={estActive(nav.path) ? 'page' : undefined}
          >
            {nav.label}
          </Link>
        ))}
        <span className="mq-plus" ref={plusRef}>
          <button
            type="button"
            className={`mq-nav-item mq-nav-plus${plusOuvert ? ' is-open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={plusOuvert}
            onClick={() => setPlusOuvert((v) => !v)}
          >
            Plus
            <ChevronDown size={14} />
          </button>
          {plusOuvert && (
            <div className="mq-plus-menu" role="menu" aria-label="Autres pages">
              {menuContenu}
            </div>
          )}
        </span>
      </nav>

      <div className="mq-topbar-right">
        <button
          type="button"
          className="mq-theme-btn"
          onClick={toggleTheme}
          aria-label={themeLabel}
          aria-pressed={darkMode}
          title={themeLabel}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
        <div className="mq-bell">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            hasHighPriority={hasHighPriority}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
          />
        </div>
        {isSuperAdmin ? (
          <Link
            className="topbar-admin topbar-admin--lien"
            to="/admins"
            title={`${adminName} · ${adminRole} — ouvrir la page Administrateurs`}
            aria-label={`${adminName}, ${adminRole} — ouvrir la page Administrateurs`}
          >
            <span className="bento-avatar">{adminInitials}</span>
            <span className="who">
              <b>{adminName}</b>
              <span>{adminRole}</span>
            </span>
            <ChevronDown size={14} className="topbar-admin-chevron" aria-hidden="true" />
          </Link>
        ) : (
          <div className="topbar-admin topbar-admin--statique" title={`${adminName} · ${adminRole}`}>
            <span className="bento-avatar">{adminInitials}</span>
            <span className="who">
              <b>{adminName}</b>
              <span>{adminRole}</span>
            </span>
          </div>
        )}
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="mq-mobile-overlay"
            aria-label="Fermer le menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="mq-mobile-menu" aria-label="Navigation">
            {menuContenu}
          </nav>
        </>
      )}
    </header>
  )
}
