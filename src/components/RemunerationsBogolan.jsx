// ═══════════════════════════════════════════════════════════
// 🟤 LE BOGOLAN DES RÉMUNÉRATIONS
//
// La page Paie porte déjà le pagne de boue (BogolanMudclothSvg).
// Rémunérations est l'écran qui NOURRIT la paie : même famille,
// vocabulaire plus étroit, parce qu'une page de saisie ne doit pas
// décorer les chiffres.
//
// Quatre signes, quatre rôles — jamais gratuits :
//
//   le losange   → un salarié (son médaillon dans le pagne)
//   la frise     → un séparateur, sous un titre
//   la teinture  → ce qui reste à renseigner (une case = un champ)
//   le pan       → le bord décalé d'une bande, quand elle est incomplète
//
// Le pagne n'est pas un fond décoratif : c'est la métaphore de la
// complétude. Une bande non teinte est une bande dont il manque des
// chiffres pour calculer le coût.
// ═══════════════════════════════════════════════════════════

import { useId } from 'react'

const BOGOLAN = {
  boue: '#2A1509',
  cuve: '#180C00',
  cuivre: '#A85424',
  cuivreClair: '#C4702F',
  craie: '#E4CC9C',
  craieClaire: '#F0D8A8',
}

const TEINTES = {
  cuivre: { trait: BOGOLAN.cuivre, plein: BOGOLAN.cuivre, clair: BOGOLAN.craie },
  craie: { trait: BOGOLAN.craie, plein: BOGOLAN.craie, clair: BOGOLAN.cuivre },
  boue: { trait: BOGOLAN.boue, plein: BOGOLAN.boue, clair: BOGOLAN.craie },
}

const teinte = (ton) => TEINTES[ton] || TEINTES.cuivre

/**
 * Le médaillon d'un salarié : un carré de pagne teint, avec le losange
 * et les quatre points de la croix bogolan. Les initiales se posent
 * par-dessus, en HTML (voir `.rw-medaillon-initiales`).
 */
export function BogolanMedaillonSvg({ taille = 46, ton = 'cuivre', className = '' }) {
  const id = useId().replace(/:/g, '')
  const c = teinte(ton)

  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 46 46"
      aria-hidden="true"
      focusable="false"
      data-testid="bogolan-medaillon"
    >
      <defs>
        <linearGradient id={`rw-medaillon-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.trait} stopOpacity="0.34" />
          <stop offset="100%" stopColor={c.trait} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect
        x="0.75" y="0.75" width="44.5" height="44.5" rx="9"
        fill={`url(#rw-medaillon-${id})`}
        stroke={c.trait}
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      {/* le losange, en réserve */}
      <path d="M23 9.5 36.5 23 23 36.5 9.5 23Z" fill="none" stroke={c.trait} strokeWidth="1.3" strokeOpacity="0.55" />
      <path d="M23 14.5 31.5 23 23 31.5 14.5 23Z" fill="none" stroke={c.trait} strokeWidth="1.1" strokeOpacity="0.4" />
      {/* les quatre points de la croix */}
      <g fill={c.trait} fillOpacity="0.55">
        <circle cx="23" cy="5.4" r="1.25" />
        <circle cx="23" cy="40.6" r="1.25" />
        <circle cx="5.4" cy="23" r="1.25" />
        <circle cx="40.6" cy="23" r="1.25" />
      </g>
    </svg>
  )
}

/**
 * La jauge de teinture : une case par champ attendu. Les cases pleines
 * sont renseignées, les cases au trait restent à faire. Elle se lit
 * sans lire.
 */
export function BogolanTeinture({ remplis = 0, total = 3, ton = 'cuivre', className = '' }) {
  const c = teinte(ton)
  const cases = Math.max(total, 1)
  const faites = Math.min(Math.max(remplis, 0), cases)

  return (
    <svg
      className={className}
      width="16"
      height={cases * 11 - 3}
      viewBox={`0 0 16 ${cases * 11 - 3}`}
      aria-hidden="true"
      focusable="false"
      data-testid="bogolan-teinture"
      data-remplis={faites}
      data-total={cases}
    >
      {Array.from({ length: cases }, (_, i) => (
        <rect
          key={i}
          x="1"
          y={1 + i * 11}
          width="14"
          height="8"
          rx="1.5"
          fill={i < faites ? c.plein : 'none'}
          stroke={c.trait}
          strokeWidth="1.2"
          strokeOpacity={i < faites ? 1 : 0.45}
        />
      ))}
    </svg>
  )
}

/**
 * Un losange de mesure, pour les quatre chiffres du haut de page.
 */
export function BogolanLosangeSvg({ taille = 34, ton = 'cuivre', className = '' }) {
  const c = teinte(ton)
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 34 34"
      aria-hidden="true"
      focusable="false"
      data-testid="bogolan-losange"
    >
      <path d="M17 2.5 31.5 17 17 31.5 2.5 17Z" fill="none" stroke={c.trait} strokeWidth="1.6" />
      <path d="M17 8 26 17 17 26 8 17Z" fill="none" stroke={c.trait} strokeWidth="1.3" strokeOpacity="0.62" />
      <path d="M17 12.6 21.4 17 17 21.4 12.6 17Z" fill={c.plein} fillOpacity="0.85" />
      <g fill={c.trait} fillOpacity="0.4">
        <circle cx="17" cy="1.6" r="1.1" />
        <circle cx="17" cy="32.4" r="1.1" />
        <circle cx="1.6" cy="17" r="1.1" />
        <circle cx="32.4" cy="17" r="1.1" />
      </g>
    </svg>
  )
}

/**
 * Le pan décalé : le bord d'une bande de pagne. Il signale une bande
 * incomplète — pas une erreur, une étape à finir.
 */
export function BogolanPanSvg({ hauteur = 44, ton = 'cuivre', className = '' }) {
  const c = teinte(ton)
  return (
    <svg
      className={className}
      width="12"
      height={hauteur}
      viewBox={`0 0 12 ${hauteur}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-testid="bogolan-pan"
    >
      <path
        d={`M0 0 H11 V${hauteur / 2 - 6} H6 V${hauteur / 2} H11 V${hauteur} H0 Z`}
        fill={c.plein}
        fillOpacity="0.9"
      />
    </svg>
  )
}

export default BogolanMedaillonSvg
