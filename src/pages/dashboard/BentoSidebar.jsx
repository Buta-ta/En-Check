// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — SIDEBAR FLOTTANTE (maquette Bento)
// Carte arrondie en verre, bande kente tissée en tête, groupes
// Pilotage / RH / Outils / Administration, item actif avec filet
// doré lumineux, badge d'attente, repli en rail d'icônes
// (mémoire par administrateur), profil et déconnexion en pied.
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, LogOut, PanelLeft, Users } from 'lucide-react'

function cleMini(idAdministrateur) {
  return `encheck_bento_sidebar_mini_v1:${idAdministrateur || 'preview'}`
}

export default function BentoSidebar({
  sections = [],
  tabStates = {},
  onSelect,
  idAdministrateur,
  mobileMenuOpen = false,
  adminName = 'Administrateur',
  adminRole = 'Administrateur',
  adminInitials = 'EC',
  isSuperAdmin = false,
  handleLogout,
}) {
  const { pathname } = useLocation()
  const [isMini, setIsMini] = useState(() => {
    try {
      return window.localStorage.getItem(cleMini(idAdministrateur)) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(cleMini(idAdministrateur), isMini ? '1' : '0')
    } catch {
      // Le repli reste utilisable même si le stockage est bloqué.
    }
  }, [isMini, idAdministrateur])

  const basculerMini = () => setIsMini((v) => !v)

  return (
    <aside
      className={`bento-sidebar${isMini ? ' is-mini' : ''}${mobileMenuOpen ? ' is-open' : ''}`}
      aria-label="Navigation principale"
    >
      <div className="bento-sidebar-scroll">
        {sections.map((section) => {
          const visibles = section.items.filter((item) => item.show !== false)
          if (!visibles.length) return null
          return (
            <div className="bento-nav-group" key={section.label}>
              <div className="bento-nav-group-label microlabel">{section.label}</div>
              {visibles.map((item) => {
                const Icon = item.icon
                const actif = item.active === true || pathname === item.path
                const tabState = item.tabKey ? tabStates[item.tabKey] : null
                const activiteNeuve = Boolean(tabState?.activeTriggers?.length && !tabState.viewed)
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    className={`bento-nav-item${actif ? ' is-active' : ''}`}
                    aria-current={actif ? 'page' : undefined}
                    onClick={(event) => {
                      event.preventDefault()
                      onSelect(item)
                    }}
                  >
                    {Icon ? <Icon size={18} /> : <span aria-hidden="true">•</span>}
                    <span className="nav-label">{item.label}</span>
                    {activiteNeuve && <span className="bento-nav-dot" aria-label="Activité à examiner" />}
                    {item.count > 0 && (
                      <span className={`bento-nav-badge${item.count >= 2 ? ' hot' : ''}`} aria-label={`${item.count} éléments en attente`}>
                        {item.count}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="bento-sidebar-footer">
        <button type="button" className="bento-sidebar-collapse" onClick={basculerMini} aria-pressed={isMini} aria-label={isMini ? 'Déplier le menu' : 'Replier le menu'}>
          <PanelLeft size={18} />
          <span className="lbl">{isMini ? 'Déplier' : 'Replier'}</span>
        </button>
        <a
          className="bento-portal-link"
          href="/employee/login"
          target="_blank"
          rel="noreferrer"
          onClick={() => onSelect({ action: 'close' })}
        >
          <Users size={16} />
          <span className="lbl">Espace employé</span>
          <ArrowRight size={14} />
        </a>
        <div className="bento-profile-row">
          {isSuperAdmin ? (
            <Link
              className="sidebar-profile-link"
              to="/admins"
              title="Ouvrir la page Administrateurs"
              onClick={() => onSelect({ action: 'close' })}
            >
              <span className="bento-avatar">{adminInitials}</span>
              <span className="meta">
                <b>{adminName}</b>
                <span>{adminRole}</span>
              </span>
              <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          ) : (
            <div className="sidebar-profile-link is-statique" title={`${adminName} · ${adminRole}`}>
              <span className="bento-avatar">{adminInitials}</span>
              <span className="meta">
                <b>{adminName}</b>
                <span>{adminRole}</span>
              </span>
            </div>
          )}
          <button type="button" className="bento-logout" onClick={handleLogout} title="Déconnexion" aria-label="Déconnexion">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
