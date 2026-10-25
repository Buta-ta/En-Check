// ═══════════════════════════════════════════════════════════
// 🎬 LE CHARGEMENT — le chef, sa paperasse et le carton
//
// La scène se joue en deux temps, dans la même toile :
//   ① le chef est assis devant une pile de feuilles, l'écran
//     du carton est éteint, la bouche est une ligne ;
//   ② la pile a fondu, le carton s'allume au-dessus de lui
//     dans une bulle, et le sourire arrive.
//
// ⚠️ C'est un dessin, pas une photo : aplats, couture en
//    pointillé, silhouette noire sans dégradé. Le personnage
//    n'a pas de visage détaillé — juste un œil, un trait de
//    bouche et un bandeau ocre.
//
// ⚠️ Les deux temps vivent dans le MÊME SVG : le fondu est
//    piloté en CSS (`.ch-t1` / `.ch-t2`), donc aucun minuteur
//    JavaScript, et `prefers-reduced-motion` peut figer la
//    scène sur le sourire sans rien recoder.
// ═══════════════════════════════════════════════════════════

import './ChargementEntreprises.css'

const ECRU = '#efe3cb'
const ECRU_CLAIR = '#f7efdf'
const NOIR = '#241c16'
const OCRE = '#b4622a'
const TERRE = '#8b3e1d'
const OR = '#c8863f'
const FIL = '#c9a961'

// ── Le chef d'entreprise, assis de profil ──────────────────
function Chef({ sourire = false }) {
  return (
    <g>
      {/* le tabouret */}
      <rect x="64" y="230" width="116" height="10" fill={TERRE} stroke={NOIR} strokeWidth="1.6" />
      <path d="M 78 240 L 74 270 M 164 240 L 168 270" stroke={NOIR} strokeWidth="5" strokeLinecap="round" />

      {/* le dos et l'assise */}
      <path
        d="M 96 150 C 80 164 76 198 80 230 L 172 230 C 178 202 174 176 160 164 C 150 152 128 146 112 148 Z"
        fill={NOIR}
      />
      {/* l'avant-bras posé, tourné vers la pile */}
      <path d="M 158 178 C 172 186 182 194 186 202" fill="none" stroke={NOIR} strokeWidth="13" strokeLinecap="round" />

      {/* le cou */}
      <path d="M 133 152 L 131 141" stroke={NOIR} strokeWidth="13" strokeLinecap="round" />

      {/* la tête de profil : nuque à gauche, nez à droite */}
      <path
        d="M 109 114 C 105 93 119 77 137 77 C 153 77 163 89 165 101 C 166 105 173 109 175 114 C 176 117 173 119 169 119 C 167 125 161 131 153 133 C 141 136 121 131 113 125 Z"
        fill={NOIR}
      />
      {/* le bandeau, un fil d'or */}
      <path d="M 111 97 C 119 82 143 77 159 91" fill="none" stroke={OCRE} strokeWidth="3.4" strokeLinecap="round" />
      {/* l'œil */}
      <circle cx="151" cy="103" r="2.6" fill={ECRU_CLAIR} />

      {/* la bouche : le sourire est le deuxième temps */}
      {sourire ? (
        <path
          data-sourire="oui"
          d="M 150 117 C 155 123 163 123 167 116"
          fill="none"
          stroke={ECRU_CLAIR}
          strokeWidth="2.9"
          strokeLinecap="round"
        />
      ) : (
        <path d="M 151 120 L 166 121" stroke={ECRU_CLAIR} strokeWidth="2.6" strokeLinecap="round" opacity="0.8" />
      )}

      {/* la cravate cousue, fil visible */}
      <path d="M 127 154 L 133 198" stroke={OCRE} strokeWidth="2" strokeDasharray="4 3" opacity="0.85" />
    </g>
  )
}

// ── La pile de paperasse ───────────────────────────────────
function Feuilles({ nombre, x = 250, yBas = 226, largeur = 82 }) {
  return Array.from({ length: nombre }, (_, i) => {
    const y = yBas - i * 10
    const dx = ((i % 3) - 1) * 3.5
    return (
      <g key={i} transform={`translate(${x + dx} ${y}) rotate(${((i % 4) - 1.5) * 1.2})`}>
        <rect width={largeur} height="9" fill={i % 2 ? OCRE : ECRU_CLAIR} stroke={NOIR} strokeWidth="1.5" />
        <path d={`M 10 4.5 H ${largeur - 14}`} stroke={NOIR} strokeWidth="0.9" opacity="0.35" />
      </g>
    )
  })
}

// ── Le carton d'En-Check : éteint, puis allumé ─────────────
function Carton({ allume = false, x = 452, y = 78, largeur = 150, hauteur = 118 }) {
  const chevrons = Array.from({ length: 12 }, (_, i) => (
    <path
      key={i}
      d={`M ${8 + i * 11} 0 l 5.5 8 l 5.5 -8 Z`}
      fill={TERRE}
      opacity={allume ? 0.9 : 0.26}
    />
  ))

  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={allume ? 1 : 0.55}
      data-allume={allume ? 'oui' : 'non'}
    >
      <rect width={largeur} height={hauteur} fill={ECRU_CLAIR} stroke={NOIR} strokeWidth="3.4" />
      <rect x="6" y="6" width={largeur - 12} height={hauteur - 12} fill="none" stroke={OCRE} strokeWidth="1.4" strokeDasharray="5 3.4" />
      <g transform="translate(6 10)">{chevrons}</g>

      {allume ? (
        <g>
          {/* la fiche d'une entreprise : logo, lignes, barre */}
          <rect x="14" y="40" width="30" height="30" fill={TERRE} stroke={NOIR} strokeWidth="1.5" />
          <path d="M 20 50 h 18 M 20 56 h 14 M 20 62 h 16" stroke={ECRU_CLAIR} strokeWidth="1.6" opacity="0.85" />
          <path d="M 52 46 h 62 M 52 55 h 44 M 52 64 h 54" stroke={NOIR} strokeWidth="3" strokeLinecap="round" opacity="0.62" />
          <rect x="14" y="80" width={largeur - 28} height="12" fill={OCRE} stroke={NOIR} strokeWidth="1.3" />
          <path d="M 24 86 h 34" stroke={ECRU_CLAIR} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      ) : (
        <path
          d={`M ${largeur / 2 - 13} ${hauteur / 2 - 7} h 26 M ${largeur / 2} ${hauteur / 2 - 20} v 26`}
          stroke={OCRE}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />
      )}
    </g>
  )
}

// ── La bulle de pensée, cousue ─────────────────────────────
function Bulle({ x = 362, y = 30, largeur = 180, hauteur = 112 }) {
  const d = `
    M 0 14 C 0 4 8 0 18 0 H ${largeur - 18} C ${largeur - 8} 0 ${largeur} 4 ${largeur} 14
    V ${hauteur - 14} C ${largeur} ${hauteur - 4} ${largeur - 8} ${hauteur} ${largeur - 18} ${hauteur}
    H 54 L 30 ${hauteur + 24} L 36 ${hauteur} H 18 C 8 ${hauteur} 0 ${hauteur - 4} 0 ${hauteur - 14} Z
  `
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={d} fill={ECRU_CLAIR} stroke={NOIR} strokeWidth="3" strokeLinejoin="round" />
      <rect x="8" y="9" width={largeur - 16} height={hauteur - 18} fill="none" stroke={FIL} strokeWidth="1.3" strokeDasharray="5 4" opacity="0.9" />
    </g>
  )
}

export default function ChargementEntreprises() {
  return (
    <svg
      className="ch-scene"
      viewBox="0 0 620 300"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="617" height="297" fill={ECRU} stroke={NOIR} strokeWidth="3" />
      <rect
        x="9"
        y="9"
        width="602"
        height="282"
        fill="none"
        stroke={OCRE}
        strokeWidth="1.4"
        strokeDasharray="6 4"
        opacity="0.8"
      />

      {/* ═══ TEMPS 1 : la paperasse et l'écran éteint ═══ */}
      <g className="ch-t1">
        <Chef />
        <Feuilles nombre={11} />
        <Carton allume={false} />
        <path
          d="M 208 250 C 300 266 392 260 452 240"
          fill="none"
          stroke={TERRE}
          strokeWidth="1.6"
          strokeDasharray="4 5"
          opacity="0.4"
        />
      </g>

      {/* ═══ TEMPS 2 : la pile a fondu, le carton s'allume ═══ */}
      <g className="ch-t2">
        <Chef sourire />
        <Feuilles nombre={3} />
        <Bulle />
        <Carton allume x={380} y={44} largeur={142} hauteur={88} />
        <path
          d="M 250 100 C 300 86 330 76 366 66"
          fill="none"
          stroke={NOIR}
          strokeWidth="1.4"
          strokeDasharray="5 4"
          opacity="0.32"
        />
      </g>
    </svg>
  )
}
