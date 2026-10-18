// Bibliothèque d'illustrations et d'icônes vectorielles africaines (Kente, Bogolan, Adinkra, Tama, Cauris)

export function KenteFriezeSvg({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 720 28"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="encheck-kente-rich" x="0" y="0" width="72" height="28" patternUnits="userSpaceOnUse">
          {/* Bandeau de fond tissé */}
          <rect x="0" y="0" width="72" height="28" fill="rgba(184,107,53,0.06)" />
          {/* Losange royal Kente à double contour */}
          <path d="M18 3 L31 14 L18 25 L5 14 Z" stroke="#B86B35" strokeWidth="1.7" fill="rgba(212,175,55,0.16)" />
          <path d="M18 7.5 L25.5 14 L18 20.5 L10.5 14 Z" stroke="#26734D" strokeWidth="1.3" fill="rgba(38,115,77,0.14)" />
          <circle cx="18" cy="14" r="2.3" fill="#3D2B1F" />
          {/* Chevrons Bogolan */}
          <path d="M36 4 L44 14 L36 24" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M43 4 L51 14 L43 24" stroke="#26734D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M50 4 L58 14 L50 24" stroke="#B86B35" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          {/* Motif escalier Adinkra ( Nkyinkyim ) */}
          <path d="M62 5 H67 V11 H62 V17 H67 V23" stroke="#3D2B1F" strokeWidth="1.5" strokeOpacity="0.65" strokeLinecap="round" strokeLinejoin="round" />
        </pattern>
      </defs>
      <rect width="720" height="28" fill="url(#encheck-kente-rich)" />
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

// Filigrane Adinkra décoratif pour les cartes KPI et panneaux
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

// 1. Présence : Soleil Royal Akan & couronne tressée
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

// 2. Ponctualité & Planning : Tambour parlant Tama (rythme & respect de l'heure)
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

// 3. Gardes de nuit, Sorties & Vigilance : Bouclier sculpté & Lune étoilée
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

// 4. Géolocalisation, Reco Faciale & Preuves : Boussole Cauris & Rose des vents
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

// 5. Pauses & Repos : Calebasse gravée de partage
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
