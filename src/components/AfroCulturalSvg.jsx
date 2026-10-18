// Motifs et icônes vectoriels géométriques inspirés des tissages Kente, Bogolan et symboles Adinkra
export function KenteFriezeSvg({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 640 24"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="encheck-kente-pattern" x="0" y="0" width="64" height="24" patternUnits="userSpaceOnUse">
          {/* Losange central Bogolan */}
          <path d="M16 3 L27 12 L16 21 L5 12 Z" stroke="#B86B35" strokeWidth="1.6" fill="rgba(184,107,53,0.12)" />
          <circle cx="16" cy="12" r="2.4" fill="#3D2B1F" />
          {/* Chevrons Kente */}
          <path d="M34 4 L42 12 L34 20" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M41 4 L49 12 L41 20" stroke="#26734D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          {/* Double trait tissé */}
          <line x1="55" y1="3" x2="55" y2="21" stroke="#B86B35" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="59" y1="6" x2="59" y2="18" stroke="#3D2B1F" strokeWidth="1.5" strokeOpacity="0.45" />
        </pattern>
      </defs>
      <rect width="640" height="24" fill="url(#encheck-kente-pattern)" />
    </svg>
  )
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
      <g stroke="#B86B35" strokeWidth="1.6" opacity="0.32">
        <path d="M6 6 H78 L54 30 H30 V54 L6 78 Z" fill="rgba(196,165,116,0.12)" />
        <path d="M18 18 H46 L32 32 H18 Z" fill="rgba(184,107,53,0.16)" />
        <path d="M6 92 L34 64 L62 92 L34 120 Z" />
        <path d="M92 6 L64 34 L92 62 L120 34 Z" />
        <circle cx="34" cy="92" r="4" fill="#B86B35" />
        <circle cx="92" cy="34" r="4" fill="#26734D" />
      </g>
    </svg>
  )
}

// 1. Présence : Soleil géométrique Akan / Rythme du jour
export function CulturalPresenceSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <polygon points="14,2 17.5,8.5 24.5,8.5 19.5,14 24.5,19.5 17.5,19.5 14,26 10.5,19.5 3.5,19.5 8.5,14 3.5,8.5 10.5,8.5" stroke="currentColor" strokeWidth="1.75" fill="currentColor" fillOpacity="0.14" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="4" fill="currentColor" />
    </svg>
  )
}

// 2. Ponctualité / Retards : Tambour sablier Tama (temps & rythme)
export function CulturalTimeDrumSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M6 4 H22 L16.5 14 L22 24 H6 L11.5 14 Z" stroke="currentColor" strokeWidth="1.75" fill="currentColor" fillOpacity="0.14" strokeLinejoin="round" />
      <line x1="6" y1="4" x2="6" y2="24" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
      <line x1="22" y1="4" x2="22" y2="24" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
      <circle cx="14" cy="14" r="2.2" fill="currentColor" />
    </svg>
  )
}

// 3. Vigilance / Conflits & Sorties : Bouclier géométrique sculpté
export function CulturalShieldSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 2.5 L24 7 V14.5 C24 20.2 19.6 24.2 14 26 C8.4 24.2 4 20.2 4 14.5 V7 L14 2.5 Z" stroke="currentColor" strokeWidth="1.75" fill="currentColor" fillOpacity="0.12" strokeLinejoin="round" />
      <path d="M14 7 L19 14 L14 21 L9 14 Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.22" />
    </svg>
  )
}

// 4. Preuves Tech (PIN / QR / Photo / GPS) : Losange Cauris & Oeil de vérification
export function CulturalProofSvg({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M2.5 14 L14 4.5 L25.5 14 L14 23.5 Z" stroke="currentColor" strokeWidth="1.75" fill="currentColor" fillOpacity="0.14" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="14" r="1.8" fill="currentColor" />
      <path d="M7.5 14 H9.5 M18.5 14 H20.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
