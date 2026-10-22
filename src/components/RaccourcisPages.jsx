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
// ═══════════════════════════════════════════════════════════

import { Link, useLocation } from 'react-router-dom'
import { Fingerprint, CalendarDays, CalendarOff, FileText, Users, BarChart3 } from 'lucide-react'

// Les écrans qu'on enchaîne toute la journée
const PAGES_RAPIDES = [
  { chemin: '/pointages', libelle: 'Pointages', icone: Fingerprint },
  { chemin: '/planning', libelle: 'Planning', icone: CalendarDays },
  { chemin: '/absences', libelle: 'Absences', icone: CalendarOff },
  { chemin: '/fiches-paie', libelle: 'Fiches de paie', icone: FileText },
  { chemin: '/employes', libelle: 'Employés', icone: Users },
  { chemin: '/rapports', libelle: 'Rapports', icone: BarChart3 },
]

export default function RaccourcisPages({ pages = PAGES_RAPIDES, compact = false }) {
  const { pathname } = useLocation()
  const ici = (chemin) => pathname === chemin || pathname.startsWith(`${chemin}/`)

  return (
    <nav
      className="abs-raccourcis"
      aria-label="Aller à une autre page"
      data-testid="raccourcis-pages"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        overflowX: 'auto', paddingBottom: 2,
      }}
    >
      {pages.map(({ chemin, libelle, icone: Icone }) => {
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
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
              padding: compact ? '6px 12px' : '8px 14px', borderRadius: 999,
              fontSize: compact ? 12 : 12.5, fontWeight: actif ? 700 : 600,
              textDecoration: 'none', fontFamily: 'inherit',
              background: actif ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${actif ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.08)'}`,
              color: actif ? '#F59E0B' : 'rgba(245,242,235,0.7)',
              cursor: actif ? 'default' : 'pointer',
            }}
          >
            <Picto size={14} />
            {libelle}
          </Link>
        )
      })}
    </nav>
  )
}
