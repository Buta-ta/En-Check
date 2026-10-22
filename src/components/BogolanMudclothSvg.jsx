// ═══════════════════════════════════════════════════════════
// 🟤 BOGOLAN — le motif de la page Paie & fiscalité
//
// Les autres pages ont déjà leur famille : le Kente tissé pour les
// Absences, l'Adinkra pour le Planning. La paie prend le bogolan,
// le « tissu de boue » du Mali : chevrons, grilles de points, croix
// et triangles décalés, en cuivre et espresso sur ivoire.
//
// Même gamme que la charte (ivoire, espresso, cuivre, ambre), donc
// le motif se fond dans la page au lieu de la concurrencer.
// ═══════════════════════════════════════════════════════════

import { useId } from 'react'

/**
 * Frise horizontale : chevrons et points, à poser sous un bandeau.
 * Se répète sur toute la largeur grâce à un motif SVG.
 */
export function BogolanFriseSvg({ hauteur = 10, couleur = '#B86B35', fond = 'transparent', className = '' }) {
  const id = useId().replace(/:/g, '')

  return (
    <svg
      className={className}
      width="100%"
      height={hauteur}
      viewBox={`0 0 40 ${hauteur}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="bogolan-frise"
      style={{ display: 'block', background: fond }}
    >
      <defs>
        <pattern id={`bogolan-frise-${id}`} width="20" height={hauteur} patternUnits="userSpaceOnUse">
          {/* chevrons emboîtés */}
          <polyline
            points={`0,${hauteur - 1} 5,1 10,${hauteur - 1}`}
            fill="none"
            stroke={couleur}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <polyline
            points={`10,${hauteur - 1} 15,1 20,${hauteur - 1}`}
            fill="none"
            stroke={couleur}
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.55"
          />
          {/* grille de points */}
          <circle cx="2" cy={hauteur / 2} r="1" fill={couleur} opacity="0.5" />
          <circle cx="18" cy={hauteur / 2} r="1" fill={couleur} opacity="0.5" />
        </pattern>
      </defs>
      <rect width="40" height={hauteur} fill={`url(#bogolan-frise-${id})`} />
    </svg>
  )
}

/**
 * Filigrane d'angle : triangles décalés et croix, très pâle, à poser
 * derrière un panneau ou dans un coin de page.
 */
export function BogolanFiligraneSvg({ size = 180, opacite = 0.07, couleur = '#B86B35', className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      data-testid="bogolan-filigrane"
      style={{ opacity: opacite }}
    >
      <g fill="none" stroke={couleur} strokeWidth="3" strokeLinejoin="round">
        {/* triangles décalés, comme les pans de boue successifs */}
        <polyline points="10,110 10,70 30,70 30,50 50,50 50,30 70,30 70,10 110,10" />
        <polyline points="10,90 30,90 30,70 50,70 50,50 70,50 70,30 90,30" opacity="0.7" />
        <polyline points="10,110 50,110 50,90 90,90 90,70 110,70" opacity="0.45" />
      </g>
      <g fill={couleur}>
        {/* croix bogolan */}
        <path d="M78 78 l14 14 M92 78 l-14 14" stroke={couleur} strokeWidth="3" strokeLinecap="round" />
        <path d="M20 20 l12 12 M32 20 l-12 12" stroke={couleur} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        {/* grille de points */}
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <circle key={`${r}-${c}`} cx={96 + c * 8} cy={40 + r * 8} r="1.6" opacity="0.55" />
          ))
        )}
      </g>
    </svg>
  )
}

/**
 * Pastille carrée, pour les icônes de cartes : une croix et deux
 * chevrons dans un carré à coins arrondis.
 */
export function BogolanPastilleSvg({ size = 34, couleur = '#B86B35', className = '' }) {
  const id = useId().replace(/:/g, '')

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 34 34"
      aria-hidden="true"
      data-testid="bogolan-pastille"
    >
      <defs>
        <linearGradient id={`bogolan-pastille-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={couleur} stopOpacity="0.20" />
          <stop offset="100%" stopColor={couleur} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="33" height="33" rx="10" fill={`url(#bogolan-pastille-${id})`} stroke={couleur} strokeOpacity="0.28" />
      <g stroke={couleur} strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M9 20 l4 -5 l4 5" />
        <path d="M17 20 l4 -5 l4 5" opacity="0.6" />
      </g>
      <path d="M13 9 l8 8 M21 9 l-8 8" stroke={couleur} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export default BogolanFriseSvg
