import React from 'react'

/**
 * Illustration vectorielle originale du geste de pointage En-Check.
 * Les volumes restent légers pour préserver les performances et respecter
 * prefers-reduced-motion dans la feuille de style du Dashboard.
 */
export default function AttendanceIllustration() {
  return (
    <svg
      className="attendance-illustration"
      viewBox="0 0 440 300"
      role="img"
      aria-label="Deux collègues dans un lieu de travail moderne, près d’une tablette de pointage"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sceneArch" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4E7D4" />
          <stop offset="1" stopColor="#E9D6BA" />
        </linearGradient>
        <linearGradient id="skinWarm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9B5F43" />
          <stop offset="1" stopColor="#75402F" />
        </linearGradient>
        <linearGradient id="skinDeep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#75452F" />
          <stop offset="1" stopColor="#4D2C24" />
        </linearGradient>
        <linearGradient id="shirtRust" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E49A62" />
          <stop offset="1" stopColor="#C96D42" />
        </linearGradient>
        <linearGradient id="shirtOlive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#78907A" />
          <stop offset="1" stopColor="#4E6859" />
        </linearGradient>
        <linearGradient id="deviceFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#44413B" />
          <stop offset="1" stopColor="#262522" />
        </linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" />
          <feOffset dy="8" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="228" cy="267" rx="181" ry="17" fill="#8E7153" opacity="0.12" />
      <path d="M63 257V137C63 70 117 16 184 16h110c67 0 121 54 121 121v120H63Z" fill="url(#sceneArch)" />
      <path d="M91 256V139c0-51 42-93 93-93h110c51 0 93 42 93 93v117H91Z" fill="#F8F1E6" opacity="0.68" />
      <path d="M63 257h352" stroke="#C6AD8D" strokeWidth="2" opacity="0.55" />
      <path d="M102 205c43-24 75-23 112 0m84-70c34-17 63-17 96 0" fill="none" stroke="#D8C5A8" strokeWidth="2" strokeLinecap="round" opacity="0.55" />

      {/* Plante de bureau : un détail vivant, sans décor folklorique. */}
      <g opacity="0.9">
        <path d="M104 217c-18-27-15-47-1-62 14 18 13 38 1 62Z" fill="#80977A" />
        <path d="M116 216c-4-33 7-51 28-58 2 25-7 44-28 58Z" fill="#69846B" />
        <path d="M100 222c-28-15-37-32-31-51 23 11 34 28 31 51Z" fill="#91A287" />
        <path d="M82 219h47l-6 32H89l-7-32Z" fill="#C47C55" />
        <path d="M83 219h45" stroke="#A95F40" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Collègue au premier plan : tenue de travail contemporaine. */}
      <g filter="url(#softShadow)">
        <path d="M160 230 171 266h25l-2-38m25 2-3 36h24l9-42" fill="#454747" />
        <path d="m168 258-3 11h37l-5-11m24 0-2 11h37l-5-11" fill="#312F2C" />
        <path d="M162 146c6-14 18-22 38-22 21 0 36 8 42 24l8 67c-18 12-61 13-91 0l3-69Z" fill="url(#shirtRust)" />
        <path d="m176 135 20 17 20-17" fill="none" stroke="#F1B582" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
        <path d="M165 153c-12 10-18 23-21 40l-7 20c-2 7 2 12 8 12 4 0 7-3 9-8l12-25 7-19" fill="url(#skinWarm)" />
        <path d="M235 151c12 4 21 13 29 26l17 24c4 6 2 12-3 15-5 3-10 0-14-5l-25-24-15-17" fill="url(#skinWarm)" />
        <path d="M158 99c0-19 13-33 31-33 20 0 34 15 34 34 0 21-14 35-34 35-18 0-31-15-31-36Z" fill="url(#skinWarm)" />
        <path d="M156 103c-4-22 4-44 25-50 23-7 47 7 49 35-9-3-15-8-19-16-11 16-30 25-55 25v6Z" fill="#302521" />
        <path d="M169 107c3-2 6-2 9 0m20 0c3-2 6-2 9 0" fill="none" stroke="#3F2B25" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M184 119c5 4 11 4 16 0" fill="none" stroke="#5A3028" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M170 94c3-5 7-7 12-7m14 0c5 0 9 2 12 7" fill="none" stroke="#302521" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Poste de pointage sobre, lisible et intégré au lieu de travail. */}
      <g filter="url(#softShadow)">
        <path d="M323 232h31l9 27h-49l9-27Z" fill="#A88D6D" />
        <rect x="302" y="99" width="73" height="139" rx="18" fill="#D6C1A3" />
        <rect x="307" y="103" width="63" height="129" rx="15" fill="url(#deviceFace)" />
        <rect x="314" y="113" width="49" height="89" rx="9" fill="#F6F0E6" />
        <circle cx="338.5" cy="127" r="8" fill="#E5D4BC" />
        <path d="M324 151c4-8 9-12 15-12s12 4 15 12v13h-30v-13Z" fill="#719078" />
        <circle cx="338.5" cy="178" r="10" fill="#E7B35C" />
        <path d="m334 178 3 3 6-7" fill="none" stroke="#3D4C3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="338.5" cy="218" r="3" fill="#A9A198" />
      </g>

      {/* Petite carte flottante de confirmation. */}
      <g filter="url(#softShadow)">
        <rect x="274" y="65" width="105" height="43" rx="13" fill="#FFFCF6" />
        <circle cx="293" cy="86.5" r="10" fill="#E7F0E7" />
        <path d="m289 86 3 3 5-6" fill="none" stroke="#54765C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M311 82h50M311 91h34" stroke="#867D70" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Deuxième collègue, en retrait, pour donner de la profondeur à la scène. */}
      <g opacity="0.96">
        <path d="m264 225 6 36h18l2-39m13 1 2 38h18l4-38" fill="#C1A57F" />
        <path d="m268 257-3 10h27l-3-10m11 0-2 10h27l-3-10" fill="#695849" />
        <path d="M263 155c5-13 15-19 30-19 17 0 28 7 32 21l5 52c-18 10-51 10-72-1l5-53Z" fill="url(#shirtOlive)" />
        <path d="M272 104c0-17 11-29 27-29 17 0 29 12 29 29 0 18-12 30-29 30-16 0-27-12-27-30Z" fill="url(#skinDeep)" />
        <path d="M270 105c-3-20 7-40 28-42 18-2 32 10 32 30-10-1-19-6-25-14-8 10-20 17-35 19v7Z" fill="#28211E" />
        <path d="M280 107c3-2 5-2 8 0m17 0c3-2 5-2 8 0" fill="none" stroke="#2E201D" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M289 118c4 3 9 3 13 0" fill="none" stroke="#4B2925" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
