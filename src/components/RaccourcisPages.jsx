// ═══════════════════════════════════════════════════════════
// 🧭 RACCOURCIS VERS LES AUTRES PAGES
//
// Une bande de boutons pour sauter d'un écran à l'autre sans
// repasser par le tableau de bord. Ce sont de vrais liens : clic
// milieu, « ouvrir dans un nouvel onglet » et navigation au
// clavier fonctionnent comme partout ailleurs.
//
// La page affichée est marquée (`aria-current`) et son raccourci
// devient inerte : pas de rechargement pour rien.
//
// L'apparence vit dans la feuille de style de la page (classes
// .abs-raccourcis / .abs-raccourci), aux couleurs de la charte :
// le bandeau suit donc le thème clair ou sombre sans rien coder ici.
// ═══════════════════════════════════════════════════════════

import { Link, useLocation } from 'react-router-dom'
import { Fingerprint, CalendarDays, CalendarOff, FileText, Users, BarChart3 } from 'lucide-react'

// Les écrans qu'on enchaîne toute la journée
const PAGES_RAPIDES = [
  { chemin: '/pointages', libelle: 'Pointages', icone: Fingerprint },
  { chemin: '/planning', libelle: 'Planning', icone: CalendarDays },
  { chemin: '/absences', libelle: 'Absences', icone: CalendarOff },
  { chemin: '/paie?onglet=fiches', libelle: 'Fiches de paie', icone: FileText },
  { chemin: '/employes', libelle: 'Employés', icone: Users },
  { chemin: '/rapports', libelle: 'Rapports', icone: BarChart3 },
]

export default function RaccourcisPages({ pages = PAGES_RAPIDES, compact = false, excludePaths = [] }) {
  const { pathname, search } = useLocation()
  // « /paie?onglet=fiches » n'est actif que sur cet onglet précis
  const ici = (chemin) => {
    const [cible, query] = chemin.split('?')
    if (pathname !== cible && !pathname.startsWith(`${cible}/`)) return false
    if (!query) return true
    return search.replace(/^\?/, '') === query
  }

  return (
    <nav
      className="abs-raccourcis"
      aria-label="Aller à une autre page"
      data-testid="raccourcis-pages"
    >
      {pages.filter(page => !excludePaths.includes(page.chemin.split('?')[0])).map(({ chemin, libelle, icone: Icone }) => {
        const actif = ici(chemin)
        const Picto = Icone
        return (
          <Link
            key={chemin}
            to={chemin}
            className="abs-raccourci"
            data-testid={`raccourci-${chemin.replace(/\//g, '')}`}
            data-page={chemin}
            data-actif={actif ? 'oui' : 'non'}
            aria-current={actif ? 'page' : undefined}
            title={actif ? `Vous êtes sur ${libelle}` : `Aller à ${libelle}`}
            data-compact={compact ? 'oui' : 'non'}
          >
            <Picto size={13} />
            {libelle}
          </Link>
        )
      })}
    </nav>
  )
}
