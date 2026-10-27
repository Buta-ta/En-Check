// Bibliothèque d'illustrations et de motifs textiles vectoriels africains (Kente, Bogolan, Adinkra, Tama, Cauris)

import { useId } from 'react'

export function KenteWovenTapestrySvg({ className = '' }) {
  // Deux bandeaux peuvent vivre sur la même page (une frise et un
  // badge) : l'identifiant du motif est donc propre à chaque rendu.
  const motifId = `encheck-kente-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      className={className}
      viewBox="0 0 960 28"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={motifId} x="0" y="0" width="240" height="28" patternUnits="userSpaceOnUse">
          {/* Fond sombre expresso */}
          <rect width="240" height="28" fill="#1A120C" />

          {/* Bloc 1 : Tissage Or & Terracotta à rayures horizontales */}
          <rect x="0" y="0" width="38" height="28" fill="#C85A28" />
          <rect x="0" y="4" width="38" height="4" fill="#E8AE3E" />
          <rect x="0" y="12" width="38" height="4" fill="#1E140E" />
          <rect x="0" y="20" width="38" height="4" fill="#E8AE3E" />
          <path d="M5 0 V28 M19 0 V28 M33 0 V28" stroke="#F4D078" strokeWidth="1.5" strokeOpacity="0.65" />

          {/* Bloc 2 : Damier Kente Or / Émeraude / Noir */}
          <rect x="38" y="0" width="34" height="28" fill="#1E5E3E" />
          <rect x="40" y="2" width="9" height="7" fill="#E8AE3E" />
          <rect x="51" y="2" width="9" height="7" fill="#1A120C" />
          <rect x="62" y="2" width="8" height="7" fill="#E8AE3E" />
          <rect x="40" y="11" width="9" height="6" fill="#C85A28" />
          <rect x="51" y="11" width="9" height="6" fill="#E8AE3E" />
          <rect x="62" y="11" width="8" height="6" fill="#C85A28" />
          <rect x="40" y="19" width="9" height="7" fill="#E8AE3E" />
          <rect x="51" y="19" width="9" height="7" fill="#1A120C" />
          <rect x="62" y="19" width="8" height="7" fill="#E8AE3E" />

          {/* Bloc 3 : Losange Royal Bogolan sur fond Indigo-Ardoise */}
          <rect x="72" y="0" width="44" height="28" fill="#24384A" />
          <polygon points="94,2 112,14 94,26 76,14" fill="#E8AE3E" stroke="#1A120C" strokeWidth="1.5" />
          <polygon points="94,6 105,14 94,22 83,14" fill="#C85A28" />
          <circle cx="94" cy="14" r="2.8" fill="#FFF3D1" />

          {/* Bloc 4 : Chevrons tissés Terre de Sienne & Or */}
          <rect x="116" y="0" width="46" height="28" fill="#8C3418" />
          <path d="M120 3 L130 14 L120 25" stroke="#E8AE3E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M130 3 L140 14 L130 25" stroke="#288256" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M140 3 L150 14 L140 25" stroke="#E8AE3E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M150 3 L159 14 L150 25" stroke="#F5D78E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Bloc 5 : Tissage Vert Émeraude & Or */}
          <rect x="162" y="0" width="38" height="28" fill="#1F6A45" />
          <rect x="162" y="5" width="38" height="4" fill="#E8AE3E" />
          <rect x="162" y="13" width="38" height="3" fill="#C85A28" />
          <rect x="162" y="20" width="38" height="4" fill="#E8AE3E" />
          <path d="M170 0 V28 M181 0 V28 M192 0 V28" stroke="#1A120C" strokeWidth="2" />

          {/* Bloc 6 : Sabliers Adinkra Or & Ocre */}
          <rect x="200" y="0" width="40" height="28" fill="#B54B22" />
          <polygon points="206,3 234,3 220,14 234,25 206,25 220,14" fill="#E8AE3E" stroke="#1A120C" strokeWidth="1.4" />
          <line x1="200" y1="0" x2="200" y2="28" stroke="#E8AE3E" strokeWidth="2" />
          <line x1="239" y1="0" x2="239" y2="28" stroke="#E8AE3E" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="960" height="28" fill={`url(#${motifId})`} />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// FRISE KENTE — PALETTE AMBRE (orange · jaune · noir)
// Même trame tissée que KenteWovenTapestrySvg, mais restreinte aux trois
// teintes du bandeau haut de page : aucune touche émeraude ni indigo.
// Utilisée par la page Absences ; réutilisable par les autres pages.
// ═══════════════════════════════════════════════════════════════════════
export function KenteAmberWeaveSvg({ className = '' }) {
  const NOIR = '#15110E'
  const NOIR_TISSE = '#1A120C'
  const OR = '#E8AE3E'
  const OR_CLAIR = '#F4D078'
  const OR_PALE = '#FFF3D1'
  const AMBRE = '#F59E0B'
  const CUIVRE = '#C25E28'
  const SIENNE = '#8C3418'

  return (
    <svg
      className={className}
      viewBox="0 0 960 28"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id="encheck-kente-amber"
          x="0"
          y="0"
          width="240"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          {/* Bloc 1 : rayures horizontales cuivre & or sur trame noire */}
          <rect width="38" height="28" fill={CUIVRE} />
          <rect x="0" y="4" width="38" height="4" fill={OR} />
          <rect x="0" y="12" width="38" height="4" fill={NOIR} />
          <rect x="0" y="20" width="38" height="4" fill={OR} />
          <path
            d="M5 0 V28 M19 0 V28 M33 0 V28"
            stroke={OR_CLAIR}
            strokeWidth="1.5"
            strokeOpacity="0.65"
          />

          {/* Bloc 2 : damier Kente ambre / or / noir sur sienne brûlée */}
          <rect x="38" y="0" width="34" height="28" fill={SIENNE} />
          <rect x="40" y="2" width="9" height="7" fill={OR} />
          <rect x="51" y="2" width="9" height="7" fill={NOIR} />
          <rect x="62" y="2" width="8" height="7" fill={OR} />
          <rect x="40" y="11" width="9" height="6" fill={AMBRE} />
          <rect x="51" y="11" width="9" height="6" fill={OR} />
          <rect x="62" y="11" width="8" height="6" fill={AMBRE} />
          <rect x="40" y="19" width="9" height="7" fill={OR} />
          <rect x="51" y="19" width="9" height="7" fill={NOIR} />
          <rect x="62" y="19" width="8" height="7" fill={OR} />

          {/* Bloc 3 : losange royal ambre sur fond noir */}
          <rect x="72" y="0" width="44" height="28" fill={NOIR} />
          <polygon points="94,2 112,14 94,26 76,14" fill={AMBRE} stroke={NOIR} strokeWidth="1.5" />
          <polygon points="94,6 105,14 94,22 83,14" fill={CUIVRE} />
          <circle cx="94" cy="14" r="2.8" fill={OR_PALE} />

          {/* Bloc 4 : chevrons tissés sienne & or */}
          <rect x="116" y="0" width="46" height="28" fill={SIENNE} />
          <path
            d="M120 3 L130 14 L120 25"
            stroke={OR}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M130 3 L140 14 L130 25"
            stroke={AMBRE}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M140 3 L150 14 L140 25"
            stroke={OR}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M150 3 L159 14 L150 25"
            stroke={OR_CLAIR}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Bloc 5 : tissage noir, fils or & cuivre */}
          <rect x="162" y="0" width="38" height="28" fill={NOIR_TISSE} />
          <rect x="162" y="5" width="38" height="4" fill={OR} />
          <rect x="162" y="13" width="38" height="3" fill={CUIVRE} />
          <rect x="162" y="20" width="38" height="4" fill={OR} />
          <path d="M170 0 V28 M181 0 V28 M192 0 V28" stroke={NOIR} strokeWidth="2" />

          {/* Bloc 6 : sabliers Adinkra ambre sur cuivre */}
          <rect x="200" y="0" width="40" height="28" fill={CUIVRE} />
          <polygon
            points="206,3 234,3 220,14 234,25 206,25 220,14"
            fill={AMBRE}
            stroke={NOIR}
            strokeWidth="1.4"
          />
          <line x1="200" y1="0" x2="200" y2="28" stroke={OR} strokeWidth="2" />
          <line x1="239" y1="0" x2="239" y2="28" stroke={OR} strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="960" height="28" fill="url(#encheck-kente-amber)" />
    </svg>
  )
}

// Carré d'art textile africain tissé (4 variantes pour les 4 cartes KPI)
export function WovenKenteBadgeSvg({ variant = 1, size = 46 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ borderRadius: 10, flexShrink: 0 }}
    >
      <rect width="48" height="48" rx="9" fill="#23160E" stroke="#D58D4B" strokeWidth="1.5" />
      {variant === 1 && (
        <g>
          <rect x="3" y="3" width="42" height="10" rx="3" fill="#C85A28" />
          <path d="M5 8 L11 4 L17 8 L23 4 L29 8 L35 4 L41 8" stroke="#F4D078" strokeWidth="2" strokeLinecap="round" />
          <rect x="3" y="15" width="42" height="18" fill="#E8AE3E" />
          <polygon points="12,17 20,24 12,31 4,24" fill="#1E5E3E" />
          <polygon points="24,17 32,24 24,31 16,24" fill="#C85A28" />
          <polygon points="36,17 44,24 36,31 28,24" fill="#1E5E3E" />
          <rect x="3" y="35" width="42" height="10" rx="3" fill="#8C3418" />
          <path d="M6 40 H42" stroke="#F4D078" strokeWidth="2.2" strokeDasharray="4 3" />
        </g>
      )}
      {variant === 2 && (
        <g>
          <rect x="3" y="3" width="42" height="11" rx="3" fill="#9E3B1C" />
          <path d="M6 9 L12 5 L18 9 L24 5 L30 9 L36 5 L42 9" stroke="#E8AE3E" strokeWidth="2" />
          <rect x="3" y="16" width="42" height="16" fill="#23160E" />
          <polygon points="14,17 24,24 14,31 4,24" fill="#E8AE3E" />
          <polygon points="34,17 44,24 34,31 24,24" fill="#C85A28" />
          <circle cx="14" cy="24" r="2.5" fill="#1E5E3E" />
          <circle cx="34" cy="24" r="2.5" fill="#F4D078" />
          <rect x="3" y="34" width="42" height="11" rx="3" fill="#D9822B" />
          <path d="M5 39 H43" stroke="#23160E" strokeWidth="2.2" strokeDasharray="3 3" />
        </g>
      )}
      {variant === 3 && (
        <g>
          <rect x="3" y="3" width="42" height="9" rx="2" fill="#E8AE3E" />
          <rect x="3" y="14" width="42" height="20" fill="#1E5E3E" />
          <polygon points="24,15 39,24 24,33 9,24" fill="#C85A28" stroke="#F4D078" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="3.5" fill="#F4D078" />
          <rect x="3" y="36" width="42" height="9" rx="2" fill="#C85A28" />
          <path d="M6 40.5 H42" stroke="#F4D078" strokeWidth="2" strokeDasharray="5 3" />
        </g>
      )}
      {variant === 4 && (
        <g>
          <rect x="3" y="3" width="42" height="10" rx="2" fill="#B54B22" />
          <path d="M5 8 H43" stroke="#F4D078" strokeWidth="2.2" />
          <rect x="3" y="15" width="42" height="18" fill="#D9822B" />
          <path d="M6 19 L14 29 L22 19 L30 29 L38 19 L43 26" stroke="#23160E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="35" width="42" height="10" rx="2" fill="#1E5E3E" />
          <path d="M6 40 H42" stroke="#E8AE3E" strokeWidth="2" strokeDasharray="4 3" />
        </g>
      )}
    </svg>
  )
}

export function KenteFriezeSvg({ className = '' }) {
  return <KenteWovenTapestrySvg className={className} />
}

export function CulturalCornerMotifSvg({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="#B86B35" strokeWidth="1.6" opacity="0.34">
        <path d="M6 6 H82 L56 32 H32 V56 L6 82 Z" fill="rgba(196,165,116,0.14)" />
        <path d="M16 16 H50 L34 34 H16 Z" fill="rgba(184,107,53,0.18)" />
        <path d="M6 92 L34 64 L62 92 L34 120 Z" fill="rgba(38,115,77,0.08)" />
        <path d="M92 6 L64 34 L92 62 L120 34 Z" fill="rgba(212,175,55,0.1)" />
        <circle cx="34" cy="92" r="4.2" fill="#B86B35" />
        <circle cx="92" cy="34" r="4.2" fill="#26734D" />
      </g>
    </svg>
  )
}

export function AdinkraWatermarkSvg({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.12">
        <circle cx="40" cy="40" r="34" />
        <circle cx="40" cy="40" r="22" strokeDasharray="4 3" />
        <path d="M40 6 L52 40 L40 74 L28 40 Z" />
        <path d="M6 40 L40 28 L74 40 L40 52 Z" />
        <rect x="31" y="31" width="18" height="18" transform="rotate(45 40 40)" />
      </g>
    </svg>
  )
}

export function CulturalPresenceSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <polygon
        points="14,1.8 17.4,7.8 24.2,7.8 19.6,14 24.2,20.2 17.4,20.2 14,26.2 10.6,20.2 3.8,20.2 8.4,14 3.8,7.8 10.6,7.8"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.15"
        strokeLinejoin="round"
      />
      <path d="M14 8.5 L19.5 14 L14 19.5 L8.5 14 Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="14" cy="14" r="2.6" fill="currentColor" />
    </svg>
  )
}

export function CulturalTimeDrumSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M6.5 3.5 H21.5 L16.2 14 L21.5 24.5 H6.5 L11.8 14 Z"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.15"
        strokeLinejoin="round"
      />
      <line x1="7" y1="3.5" x2="9.5" y2="24.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
      <line x1="21" y1="3.5" x2="18.5" y2="24.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
      <line x1="10" y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="14" cy="14" r="2.3" fill="currentColor" />
    </svg>
  )
}

export function CulturalShieldSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 2.2 L24 6.8 V14.4 C24 20.3 19.6 24.4 14 26.2 C8.4 24.4 4 20.3 4 14.4 V6.8 L14 2.2 Z"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.13"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 9.2 A4.8 4.8 0 1 0 19.2 17.2 A3.8 3.8 0 1 1 15.8 9.2 Z"
        fill="currentColor"
      />
      <circle cx="11.5" cy="11" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function CulturalProofSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M2.5 14 L14 4 L25.5 14 L14 24 Z"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.14"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="4.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="14" r="2" fill="currentColor" />
      <path d="M14 6.5 V9 M14 19 V21.5 M6.5 14 H9 M19 14 H21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CulturalCalabashPauseSvg({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M5 13.5 H23 C23 19.8 19 24 14 24 C9 24 5 19.8 5 13.5 Z"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.15"
        strokeLinejoin="round"
      />
      <path d="M7.5 17 L10.5 19.5 L14 17 L17.5 19.5 L20.5 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 6 C11 8 13 8.5 13 10.5 M16 5.5 C16 7.5 18 8 18 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
