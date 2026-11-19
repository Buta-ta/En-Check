// ═══════════════════════════════════════════════════════════
// 🟤 LE BANDEAU BOGOLAN D'UNE CARTE EMPLOYÉ
//
// Sa demande du 19/11 : « une touche avec motif africain ». La
// maquette retenue (modèle B) pose une bande de tissu de boue en
// haut de la carte, qui s'estompe vers la droite pour laisser
// lire le nom sur le papier.
//
// Trois règles tenues ici :
//   · le motif est DESSINÉ (SVG), donc net à toutes les tailles
//     et léger — pas une image à charger ;
//   · il s'estompe vraiment : le texte ne se pose jamais sur le
//     motif (lisibilité, WCAG) ;
//   · la palette reste celle de la charte : cuivre et espresso.
// ═══════════════════════════════════════════════════════════

import { useId } from 'react'

const CUIVRE = '#A26537'
const ESPRESSO = '#2A1708'
const IVOIRE = '#FBF4E9'

/**
 * @param hauteur  hauteur du bandeau, en pixels
 * @param vers     côté où le motif s'efface : 'droite' (défaut) ou 'gauche'
 */
export default function BandeauBogolan({ hauteur = 96, vers = 'droite', className = '' }) {
  const id = useId().replace(/:/g, '')
  const sens = vers === 'gauche' ? 1 : 0

  return (
    <svg
      className={className}
      width="100%"
      height={hauteur}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-testid="bandeau-bogolan"
      style={{ display: 'block' }}
    >
      <defs>
        <pattern id={`bande-${id}`} width="46" height={hauteur} patternUnits="userSpaceOnUse">
          <rect width="46" height={hauteur} fill={IVOIRE} />

          <g fill="none" stroke={CUIVRE} strokeWidth="2.2">
            <path d={`M6 ${hauteur * 0.26} L15 ${hauteur * 0.26 - 9} L24 ${hauteur * 0.26} L15 ${hauteur * 0.26 + 9} Z`} />
            <path d={`M29 ${hauteur * 0.74} L38 ${hauteur * 0.74 - 9} L47 ${hauteur * 0.74} L38 ${hauteur * 0.74 + 9} Z`} />
          </g>
          <g fill={ESPRESSO}>
            <circle cx="15" cy={hauteur * 0.26} r="2" />
            <circle cx="38" cy={hauteur * 0.74} r="2" />
          </g>

          <g fill="none" stroke={ESPRESSO} strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
            <polyline points={`30,${hauteur * 0.16} 34,${hauteur * 0.08} 38,${hauteur * 0.16}`} />
            <polyline points={`30,${hauteur * 0.84} 34,${hauteur * 0.92} 38,${hauteur * 0.84}`} />
            <polyline points={`2,${hauteur * 0.66} 6,${hauteur * 0.58} 10,${hauteur * 0.66}`} />
            <polyline points={`2,${hauteur * 0.34} 6,${hauteur * 0.42} 10,${hauteur * 0.34}`} />
          </g>

          <g fill={CUIVRE} opacity="0.7">
            <circle cx="22" cy={hauteur * 0.5} r="1.4" />
            <circle cx="27" cy={hauteur * 0.5} r="1.4" />
            <circle cx="32" cy={hauteur * 0.5} r="1.4" />
          </g>

          <g stroke={CUIVRE} strokeWidth="1.2" opacity="0.55">
            <line x1="0" y1={hauteur * 0.5} x2="46" y2={hauteur * 0.5} />
          </g>
        </pattern>

        <linearGradient id={`voile-${id}`} x1={sens} y1="0" x2={1 - sens} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.72" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        <mask id={`masque-${id}`}>
          <rect width="100%" height="100%" fill={`url(#voile-${id})`} />
        </mask>
      </defs>

      <rect width="100%" height="100%" fill={`url(#bande-${id})`} mask={`url(#masque-${id})`} />
    </svg>
  )
}
