// ═══════════════════════════════════════════════════════════
// 🗿 PORTE DE GRENIER DOGON — le vocabulaire visuel de la Carte
//
// Panneau de bois gravé du plateau de Bandiagara (Mali) : trois
// registres superposés, des figures d'ancêtres schématiques, des
// spirales, des damiers et des losanges, séparés par des bandes
// de chevrons taillés au ciseau.
//
// ⚠️ Interprétation contemporaine, pas reproduction : on garde le
//    geste — le bois chaud, l'incision noire, les registres qui se
//    lisent comme une vue du dessus — et une palette resserrée sur
//    le bois, la gravure, la patine et la terre.
//
// ⚠️ Comme les frises d'Abomey et de Korhogo : une bande de neuf
//    tuiles que `slice` agrandit sans déformer. Le motif ne se
//    répète jamais en hauteur.
// ═══════════════════════════════════════════════════════════

const BOIS = '#7a5230'
const BOIS_CLAIR = '#8e6240'
const BOIS_FONCE = '#5f3d22'
const GRAVURE = '#241c16'
const PATINE = '#e8dcc4'
const TERRE = '#8b3e1d'

const TUILE = 300
const NB_TUILES = 9

// ── Les figures d'ancêtres ─────────────────────────────────
// Le schéma dogon est très simple : une tête ronde, un corps
// étroit, deux bras et deux jambes. Rien de plus — c'est la
// répétition en registre qui fait le rythme.
function Ancetre({ x = 0, y = 0, s = 1, bras = 'leves' }) {
  const brasHaut =
    bras === 'leves'
      ? `M -3 -13 L -9 -21 M 3 -13 L 9 -21`
      : `M -3 -13 L -9 -9 M 3 -13 L 9 -9`
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-20" r="4.4" fill={GRAVURE} />
      <path d="M -4 -15 H 4 V 2 H -4 Z" fill={GRAVURE} />
      <path d={brasHaut} stroke={GRAVURE} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M -2 2 L -5 11 M 2 2 L 5 11" stroke={GRAVURE} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  )
}

// ── La spirale taillée ─────────────────────────────────────
function Spirale({ x = 0, y = 0, s = 1, sens = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s * sens} ${s})`}>
      <path
        d="M 0 0 C 0 -4 6 -5 8 -1 C 10 4 5 9 0 8 C -7 7 -10 -1 -7 -7 C -4 -14 5 -16 11 -12 C 17 -8 18 2 13 9"
        fill="none"
        stroke={GRAVURE}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </g>
  )
}

// ── Le losange à chevrons ──────────────────────────────────
function Losange({ x = 0, y = 0, s = 1, plein = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <polygon points="0,-13 12,0 0,13 -12,0" fill={plein ? TERRE : 'none'} stroke={GRAVURE} strokeWidth="2.2" />
      <polygon points="0,-7 6.5,0 0,7 -6.5,0" fill="none" stroke={GRAVURE} strokeWidth="1.5" />
      <circle cx="0" cy="0" r="1.8" fill={GRAVURE} />
    </g>
  )
}

// ── Le damier taillé ───────────────────────────────────────
function Damier({ x = 0, y = 0, cote = 22, cases = 3 }) {
  const pas = cote / cases
  const carres = []
  for (let l = 0; l < cases; l += 1) {
    for (let c = 0; c < cases; c += 1) {
      if ((l + c) % 2 === 0) {
        carres.push(
          <rect
            key={`${l}-${c}`}
            x={c * pas}
            y={l * pas}
            width={pas}
            height={pas}
            fill={GRAVURE}
          />,
        )
      }
    }
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={cote} height={cote} fill="none" stroke={GRAVURE} strokeWidth="2.2" />
      {carres}
    </g>
  )
}

// ── La bande de chevrons, entre deux registres ─────────────
function Chevrons({ y, pas = 12, hauteur = 6 }) {
  const pointes = Array.from({ length: Math.ceil(TUILE / pas) + 1 }, (_, i) => {
    const x = i * pas
    return `${x},${y + hauteur} ${x + pas / 2},${y} ${x + pas},${y + hauteur}`
  })
  return (
    <g>
      <polyline points={pointes.join(' ')} fill="none" stroke={GRAVURE} strokeWidth="2.2" />
      <polyline
        points={pointes.join(' ')}
        fill="none"
        stroke={GRAVURE}
        strokeWidth="1.4"
        opacity="0.7"
        transform={`translate(0 ${hauteur + 2})`}
      />
    </g>
  )
}

// ── La tuile ───────────────────────────────────────────────
function Tuile({ index }) {
  // les figures varient d'une tuile à l'autre : nul ne compte les mêmes
  const bras = index % 2 ? 'leves' : 'ecartes'
  return (
    <g transform={`translate(${index * TUILE} 0)`}>
      <rect width={TUILE} height="120" fill={BOIS} />

      {/* le fil du bois */}
      <path
        d="M 0 18 C 70 14 140 22 210 17 C 250 14 280 19 300 16
           M 0 60 C 60 57 150 63 220 59 C 260 57 285 61 300 58
           M 0 101 C 80 98 160 104 240 99 C 270 97 290 101 300 99"
        fill="none"
        stroke={BOIS_FONCE}
        strokeWidth="1.2"
        opacity="0.55"
      />
      <path
        d="M 34 0 C 38 30 30 60 36 90 C 39 105 37 112 38 120
           M 168 0 C 172 26 164 54 170 82 C 173 100 171 110 172 120"
        fill="none"
        stroke={BOIS_CLAIR}
        strokeWidth="1"
        opacity="0.4"
      />

      {/* ═══ BORDURE HAUTE : chevrons taillés ═══ */}
      <rect width={TUILE} height="7" fill={GRAVURE} />
      <Chevrons y={8} hauteur={4} pas={10} />

      {/* ═══ REGISTRE 1 : ancêtre, losange, spirale ═══ */}
      <Ancetre x={52} y={43} s={0.85} bras={bras} />
      <Losange x={108} y={32} s={0.9} plein={index % 3 === 0} />
      <Spirale x={158} y={30} s={0.95} sens={index % 2 ? 1 : -1} />
      <Ancetre x={210} y={43} s={0.8} bras="leves" />
      <Losange x={258} y={32} s={0.7} />

      {/* ═══ SÉPARATEUR ═══ */}
      <Chevrons y={56} hauteur={5} pas={12} />

      {/* ═══ REGISTRE 2 : damier, points, figures, spirale ═══ */}
      <Damier x={28} y={72} cote={22} cases={3} />
      <Ancetre x={92} y={93} s={0.82} bras={index % 2 ? 'ecartes' : 'leves'} />
      <Spirale x={132} y={86} s={0.8} sens={index % 2 ? -1 : 1} />
      <Losange x={176} y={89} s={0.8} plein={index % 2 === 0} />
      <Ancetre x={214} y={93} s={0.78} bras="leves" />
      <Damier x={250} y={74} cote={18} cases={3} />

      {/* les points taillés, entre les motifs */}
      {[70, 288].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="74" r="1.7" fill={GRAVURE} />
          <circle cx={cx} cy="83" r="1.7" fill={GRAVURE} />
          <circle cx={cx} cy="92" r="1.7" fill={GRAVURE} />
        </g>
      ))}

      {/* ═══ BORDURE BASSE ═══ */}
      <Chevrons y={108} hauteur={4} pas={10} />
      <rect y="113" width={TUILE} height="7" fill={GRAVURE} />
    </g>
  )
}

export function DogonFriseSvg({ className = '' }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox={`0 0 ${TUILE * NB_TUILES} 120`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width={TUILE * NB_TUILES} height="120" fill={BOIS} />
      {Array.from({ length: NB_TUILES }, (_, i) => (
        <Tuile key={i} index={i} />
      ))}
    </svg>
  )
}

// ── LE BLASON ──────────────────────────────────────────────
// Le carré de l'en-tête : un panneau gravé, avec la porte de
// grenier au centre — le verrou, les deux montants, et les
// ancêtres qui la gardent. C'est l'emblème de la page.
export function DogonBlasonSvg({ size = 52, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="49" height="49" rx="2" fill={BOIS} stroke={GRAVURE} strokeWidth="2.4" />

      {/* les chevrons du haut et du bas */}
      <polyline
        points="5,9 8.5,5.5 12,9 15.5,5.5 19,9 22.5,5.5 26,9 29.5,5.5 33,9 36.5,5.5 40,9 43.5,5.5 47,9"
        fill="none"
        stroke={GRAVURE}
        strokeWidth="1.5"
      />
      <polyline
        points="5,43 8.5,46.5 12,43 15.5,46.5 19,43 22.5,46.5 26,43 29.5,46.5 33,43 36.5,46.5 40,43 43.5,46.5 47,43"
        fill="none"
        stroke={GRAVURE}
        strokeWidth="1.5"
      />

      {/* la porte : deux montants, un linteau, le verrou */}
      <rect x="17" y="14" width="18" height="24" fill={BOIS_CLAIR} stroke={GRAVURE} strokeWidth="1.8" />
      <path d="M 17 20 H 35 M 17 32 H 35" stroke={GRAVURE} strokeWidth="1.2" opacity="0.75" />
      <rect x="23.5" y="22" width="5" height="9" fill={GRAVURE} />
      <circle cx="26" cy="26.5" r="1.3" fill={PATINE} />

      {/* les deux ancêtres qui gardent la porte */}
      <g transform="translate(9 34) scale(0.6)">
        <circle cx="0" cy="-20" r="4.4" fill={GRAVURE} />
        <path d="M -4 -15 H 4 V 2 H -4 Z" fill={GRAVURE} />
        <path d="M -3 -13 L -9 -21 M 3 -13 L 9 -21" stroke={GRAVURE} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M -2 2 L -5 11 M 2 2 L 5 11" stroke={GRAVURE} strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g transform="translate(43 34) scale(0.6)">
        <circle cx="0" cy="-20" r="4.4" fill={GRAVURE} />
        <path d="M -4 -15 H 4 V 2 H -4 Z" fill={GRAVURE} />
        <path d="M -3 -13 L -9 -21 M 3 -13 L 9 -21" stroke={GRAVURE} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M -2 2 L -5 11 M 2 2 L 5 11" stroke={GRAVURE} strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* les spirales, aux deux coins hauts */}
      <path
        d="M 9 17 C 9 14 13 13 14 16 C 15 20 10 22 8 19"
        fill="none"
        stroke={GRAVURE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 43 17 C 43 14 39 13 38 16 C 37 20 42 22 44 19"
        fill="none"
        stroke={GRAVURE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
