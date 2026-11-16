// ═══════════════════════════════════════════════════════════
// LE RAIL — la colonne d'icônes du modèle 2 niveaux
//
// Toujours visible sur desktop : la marque, une icône par
// rubrique (tooltip au survol, point de compteur, état actif),
// puis en bas : l'espace employé, le profil (menu) et la
// déconnexion. Quand le panneau est replié, c'est tout ce
// qui reste — chaque icône rouvre le panneau sur sa rubrique.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  ChevronsRight,
  ExternalLink,
  LogOut,
  UserCheck,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import RailTooltip from './RailTooltip'

/**
 * Le contenu du menu du profil — partagé entre le rail
 * (portail, desktop) et le tiroir mobile (dans le DOM).
 */
export function ContenuMenuProfil({ surChoix, surDeconnexion }) {
  return (
    <>
      <Link
        role="menuitem"
        className="sidebar-profile-menu-item"
        to="/admins"
        onClick={surChoix}
      >
        <UserCheck size={14} aria-hidden="true" />
        Profil & administrateurs
      </Link>
      <Link
        role="menuitem"
        className="sidebar-profile-menu-item"
        to="/analytics"
        onClick={surChoix}
      >
        <BarChart3 size={14} aria-hidden="true" />
        Analytics du site
      </Link>
      <button
        type="button"
        role="menuitem"
        className="sidebar-profile-menu-item sidebar-profile-menu-item--danger"
        onClick={surDeconnexion}
      >
        <LogOut size={14} aria-hidden="true" />
        Déconnexion
      </button>
    </>
  )
}

/** Position (fixe) d'une ancre à l'écran — suit scroll et resize. */
function usePositionAncre(refAncre, actif) {
  const [position, setPosition] = useState(null)
  useEffect(() => {
    if (!actif) {
      setPosition(null)
      return undefined
    }
    const mesurer = () => {
      const element = refAncre.current
      if (!element) return
      const cadre = element.getBoundingClientRect()
      const largeur = 218
      const hauteur = 156
      setPosition({
        top: Math.max(8, Math.min(cadre.top - 14, window.innerHeight - hauteur - 8)),
        left: Math.min(cadre.right + 8, window.innerWidth - largeur - 8),
      })
    }
    mesurer()
    window.addEventListener('resize', mesurer)
    window.addEventListener('scroll', mesurer, true)
    return () => {
      window.removeEventListener('resize', mesurer)
      window.removeEventListener('scroll', mesurer, true)
    }
  }, [actif, refAncre])
  return position
}

function ItemRail({ section, estActive, onChoix }) {
  const [survole, setSurvole] = useState(false)
  const refAncre = useRef(null)
  const Icone = section.icon
  const total = (section.items || []).reduce((somme, item) => somme + (Number(item?.count) || 0), 0)
  return (
    <>
      <button
        ref={refAncre}
        type="button"
        className={`nav-rail-item${estActive ? ' is-active' : ''}`}
        aria-label={section.label}
        onMouseEnter={() => setSurvole(true)}
        onMouseLeave={() => setSurvole(false)}
        onFocus={() => setSurvole(true)}
        onBlur={() => setSurvole(false)}
        onClick={onChoix}
      >
        {Icone ? <Icone size={17} strokeWidth={1.8} aria-hidden="true" /> : null}
        {total > 0 && <span className="nav-rail-dot" aria-hidden="true" />}
      </button>
      {survole && <RailTooltip texte={section.label} actif={survole} ancre={refAncre} />}
    </>
  )
}

export default function SidebarRail({
  sections = [],
  cheminActif,
  panneauReplie = false,
  onBasculerPanneau,
  onRubrique,
  profil = {},
  menuProfilOuvert = false,
  surMenuProfil,
  surDeconnexion,
}) {
  const [survolPortail, setSurvolPortail] = useState(false)
  const [survolDeconnexion, setSurvolDeconnexion] = useState(false)
  const refAvatar = useRef(null)
  const refPortail = useRef(null)
  const refDeconnexion = useRef(null)
  const positionMenu = usePositionAncre(refAvatar, menuProfilOuvert)

  const rubriques = sections.filter((section) => (section.items || []).some((item) => item && item.show !== false && item.path))

  return (
    <div className="nav-rail">
      <div className="nav-rail-marque" aria-hidden="true">
        <EnCheckBrandMark className="nav-rail-logo" size={30} />
      </div>

      {panneauReplie && (
        <button
          type="button"
          className="nav-rail-bascule"
          aria-label="Déplier la barre de navigation"
          title="Déplier la barre"
          onClick={onBasculerPanneau}
        >
          <ChevronsRight size={15} />
        </button>
      )}

      <nav className="nav-rail-list" aria-label="Rubriques">
        {rubriques.map((section) => (
          <ItemRail
            key={section.id}
            section={section}
            estActive={(section.items || []).some((item) => item && item.show !== false && item.path === cheminActif)}
            onChoix={() => onRubrique(section.id)}
          />
        ))}
      </nav>

      <div className="nav-rail-pied ec-nav-pied">
        <a
          ref={refPortail}
          className="nav-rail-item"
          href="/employee/login"
          target="_blank"
          rel="noreferrer"
          aria-label="Espace employé (s'ouvre dans un nouvel onglet)"
          onMouseEnter={() => setSurvolPortail(true)}
          onMouseLeave={() => setSurvolPortail(false)}
          onFocus={() => setSurvolPortail(true)}
          onBlur={() => setSurvolPortail(false)}
        >
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        {survolPortail && (
          <RailTooltip texte="Espace employé" actif={survolPortail} ancre={refPortail} />
        )}

        <button
          ref={refAvatar}
          type="button"
          className={`nav-rail-avatar${menuProfilOuvert ? ' is-ouvert' : ''}`}
          aria-haspopup="menu"
          aria-expanded={menuProfilOuvert}
          aria-label={`Menu du profil de ${profil.nom || "l'administrateur"}`}
          onClick={() => surMenuProfil(!menuProfilOuvert)}
        >
          {profil.photo
            ? <img className="profil-avatar-photo" src={profil.photo} alt="" />
            : (profil.initiales || 'EC')}
        </button>

        <button
          ref={refDeconnexion}
          type="button"
          className="nav-rail-item nav-rail-deconnexion"
          aria-label="Déconnexion"
          onMouseEnter={() => setSurvolDeconnexion(true)}
          onMouseLeave={() => setSurvolDeconnexion(false)}
          onFocus={() => setSurvolDeconnexion(true)}
          onBlur={() => setSurvolDeconnexion(false)}
          onClick={surDeconnexion}
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
        {survolDeconnexion && (
          <RailTooltip texte="Déconnexion" actif={survolDeconnexion} ancre={refDeconnexion} />
        )}

        {menuProfilOuvert && positionMenu && createPortal(
          <div
            className="sidebar-profile-menu is-portail ec-nav-pied"
            role="menu"
            aria-label="Actions du profil"
            style={{ top: positionMenu.top, left: positionMenu.left }}
          >
            <ContenuMenuProfil
              surChoix={() => surMenuProfil(false)}
              surDeconnexion={() => {
                surMenuProfil(false)
                surDeconnexion()
              }}
            />
          </div>,
          // Dans le périmètre des variables de thème du tableau.
          document.querySelector('.encheck-dashboard') || document.body,
        )}
      </div>
    </div>
  )
}
