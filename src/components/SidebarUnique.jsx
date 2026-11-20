// ═══════════════════════════════════════════════════════════
// 📕 LA SIDEBAR — une seule, pour toute l'application
//
// Sa décision du 24/11 : « il faut refaire toute la sidebar. la sidebar
// de production doit etre refaite. Le modèle de rail est celui de la page
// employée, le dépliage est le registre qui se ferme. »
//
// Donc : le rail ivoire de la page Employés (cartes 2 px, ombre nette,
// actif en cartouche argile), et le panneau qui se comprime PAR PALIERS.
//
// ⚠️ Ce composant remplace DEUX barres qui vivaient en parallèle :
// SidebarRail + nav-panel (tableau de bord) et nav3-rail (page Employés,
// écrit en dur dans Employes.jsx). C'était la cause du « rien ne se
// passe » : le rail de la page Employés n'avait aucun panneau à dérouler.
//
// ⚠️ Il accepte une prop `encadre` : sur le tableau de bord la barre est
// posée dans la page (deux cartes), sur la page Employés elle vit dans
// une coque qui défile — les rayons et le fond diffèrent.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Moon, Search, Sun, Users } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import RegistreRepli from './RegistreRepli'
import { useSidebarRepliee } from '../hooks/useSidebarRepliee.jsx'
import './SidebarUnique.css'

const LARGEUR_PANNEAU = 254

export default function SidebarUnique({
  sections = [],
  nomAdmin = '',
  initialeAdmin = '',
  darkMode = false,
  surTheme = () => {},
  surDeconnexion = () => {},
  vues = null,
  vueActive = '',
  surVue = () => {},
}) {
  const { repliee, basculer, deplier } = useSidebarRepliee()
  const { pathname } = useLocation()
  const [filtre, setFiltre] = useState('')
  const [groupesReplies, setGroupesReplies] = useState({})

  const rubriques = sections.filter((s) => s && s.show !== false)
  const estActive = (section) => (section.items || []).some(
    (item) => item && item.show !== false && item.path === pathname,
  )

  // Le filtre ne s'applique que si on a tapé quelque chose : sinon tout est là.
  const terme = filtre.trim().toLowerCase()
  const correspond = (texte) => !terme || String(texte).toLowerCase().includes(terme)

  const ouvrirSurRubrique = (sectionId) => {
    if (repliee) deplier()
    // on déplie le groupe pour que sa rubrique soit visible
    setGroupesReplies((etat) => ({ ...etat, [sectionId]: false }))
    window.setTimeout(() => {
      const cible = document.querySelector(`.sb-groupe[data-rubrique="${sectionId}"]`)
      // ⚠️ scrollIntoView n'existe pas partout (jsdom, vieux navigateurs) :
      // sans ce garde-fou, un test ou un appareil ancien plante ici.
      if (cible && typeof cible.scrollIntoView === 'function') {
        cible.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 230)
  }

  return (
    <div className={`sb${repliee ? ' sb--repliee' : ''}`}>
      {/* ═══ LE RAIL : permanent, jamais animé ═══ */}
      <aside className="sb-rail" aria-label="Rubriques">
        <span className="sb-rail-logo">
          <EnCheckBrandMark size={26} />
        </span>
        <span className="sb-rail-sep" aria-hidden="true" />

        {rubriques.map((section) => {
          const Icone = section.icon
          const active = estActive(section)
          return (
            <button
              key={section.id}
              type="button"
              className={`sb-rail-item${active ? ' is-actif' : ''}`}
              aria-current={active ? 'true' : undefined}
              aria-label={section.label}
              title={section.label}
              onClick={() => ouvrirSurRubrique(section.id)}
            >
              {Icone ? <Icone size={18} aria-hidden="true" /> : null}
            </button>
          )
        })}

        {/* les vues de la page courante (ex. Équipes / Tâches sur Employés) :
            elles vivaient dans le rail de la page, elles vivent ici. */}
        {vues && vues.length > 0 && (
          <div className="sb-rail-vues" role="group" aria-label="Vues de la page">
            {vues.map((vue) => {
              const Icone = vue.icon
              const active = vueActive === vue.id
              return (
                <button
                  key={vue.id}
                  type="button"
                  className={`sb-rail-item sb-rail-sous${active ? ' is-actif' : ''}`}
                  aria-label={`Vue ${vue.label}`}
                  aria-current={active ? 'page' : undefined}
                  title={vue.label}
                  onClick={() => surVue(vue.id)}
                >
                  {Icone ? <Icone size={15} aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>
        )}

        <div className="sb-rail-pied">
          <button
            type="button"
            className="sb-rail-item"
            onClick={surTheme}
            title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-pressed={darkMode}
          >
            {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <a
            className="sb-rail-item"
            href="/employee/login"
            target="_blank"
            rel="noreferrer"
            title="Espace employé"
            aria-label="Espace employé (s'ouvre dans un nouvel onglet)"
          >
            <Users size={18} aria-hidden="true" />
          </a>
          <button
            type="button"
            className="sb-rail-item"
            onClick={surDeconnexion}
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
          {/* le compte mène au profil, comme dans l'ancienne barre */}
          <Link
            className="sb-rail-compte sidebar-profile-link"
            to="/admins"
            title={`${nomAdmin} — administrateur`}
            aria-label={`${nomAdmin} — ouvrir la page Administrateurs`}
          >
            {(initialeAdmin || nomAdmin || 'A').trim().charAt(0).toUpperCase()}
          </Link>
        </div>
      </aside>

      {/* ═══ LE REGISTRE : se comprime par paliers (son choix C) ═══ */}
      <RegistreRepli ferme={repliee} largeur={LARGEUR_PANNEAU} className="sb-panneau">
        <div className="sb-panneau-inner" style={{ width: `${LARGEUR_PANNEAU}px` }}>
          <header className="sb-tete">
            <span className="sb-tete-marque">
              <EnCheckBrandMark size={22} />
            </span>
            <span className="sb-tete-copy">
              <strong>En-Check</strong>
              <em>On gère !</em>
            </span>
            <button
              type="button"
              className="sb-plier"
              onClick={basculer}
              aria-label="Réduire la barre de navigation en icônes"
              title="Barre en icônes"
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
          </header>

          <label className="sb-recherche">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Filtrer la navigation"
              aria-label="Filtrer la navigation"
            />
          </label>

          <nav
            className="sb-groupes"
            aria-label="Navigation principale"
            style={{ '--sb-pile': Math.max(1, (rubriques || []).length - 1) }}
          >
            {rubriques.map((section, rang) => {
              const items = (section.items || []).filter(
                (item) => item && item.show !== false && item.path && correspond(item.label),
              )
              if (!items.length) return null
              const replieGroupe = Boolean(groupesReplies[section.id])
              const etendu = !replieGroupe
              return (
                <section
                  key={section.id}
                  className={`sb-feuillet${etendu ? ' est-etendu' : ''}`}
                  data-rubrique={section.id}
                  style={{ '--etage': rang }}
                >
                  <button
                    type="button"
                    className="sb-feuillet-titre"
                    aria-expanded={etendu}
                    onClick={() => setGroupesReplies((e) => ({ ...e, [section.id]: !e[section.id] }))}
                  >
                    <span>{section.label}</span>
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                  {etendu && (
                    <ul className="sb-feuillet-liste">
                      {items.map((item) => {
                        const Icone = item.icon
                        const actif = item.path === pathname
                        return (
                          <li key={item.path}>
                            <Link
                              to={item.path}
                              className={`sb-lien${actif ? ' is-actif' : ''}`}
                              aria-current={actif ? 'page' : undefined}
                            >
                              {Icone ? <Icone size={15} aria-hidden="true" /> : null}
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </nav>
        </div>
      </RegistreRepli>
    </div>
  )
}
