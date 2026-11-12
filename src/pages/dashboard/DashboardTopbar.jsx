// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — BARRE DU HAUT FLOTTANTE (maquette Bento)
// Pilule en verre : marque, sélecteur d'entreprise, recherche
// ⌘K, horloge temps réel, thème, notifications, profil.
// ═══════════════════════════════════════════════════════════
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Moon, Search, Sun } from 'lucide-react'
import EnterpriseSwitcher from '../../components/EnterpriseSwitcher'
import NotificationBell from '../../components/NotificationBell'
import EnCheckBrandMark from '../../components/EnCheckBrandMark'

export default function DashboardTopbar({ data }) {
  const navigate = useNavigate()
  const {
    admin, handleEnterpriseSwitch, isSuperAdmin, isMultiEntreprise,
    darkMode, toggleTheme, notifications, unreadCount, hasHighPriority,
    markAsRead, markAllAsRead, adminName, adminRole, adminInitials,
    setMobileMenuOpen, nowChipLabel,
  } = data
  const themeLabel = darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'
  const montrerLeSwitcher = isSuperAdmin || Boolean(isMultiEntreprise)

  return (
    <header className="bento-topbar">
      <button
        type="button"
        className="bento-icon-pill bento-menu-button"
        aria-label="Ouvrir le menu de navigation"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu size={17} />
      </button>

      <a className="bento-brand" href="/dashboard" aria-label="En-Check — Tableau de bord">
        <EnCheckBrandMark size={26} />
        <span>En-Check</span>
        <small>Pilotage</small>
      </a>

      {montrerLeSwitcher && (
        <div className="bento-topbar-ent" title="Entreprise affichée">
          <EnterpriseSwitcher admin={admin} onSwitch={handleEnterpriseSwitch} />
        </div>
      )}

      <button type="button" className="bento-search" onClick={() => navigate('/dashboard?assistant=1')} aria-label="Rechercher (assistant)">
        <Search size={14} />
        <span>Rechercher employé, matricule, borne…</span>
        <kbd>⌘K</kbd>
        <span className="bento-search-go" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </span>
      </button>

      <div className="bento-topbar-right">
        <span className="bento-date-chip">
          <span className="live-dot" aria-hidden="true" />
          {nowChipLabel}
        </span>
        <button
          type="button"
          className="bento-icon-pill"
          onClick={toggleTheme}
          aria-label={themeLabel}
          aria-pressed={darkMode}
          title={themeLabel}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="bento-topbar-notifications">
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
            <svg className="topbar-admin-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
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
    </header>
  )
}
