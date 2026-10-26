// ═══════════════════════════════════════════════════════════
// ✍️ NSIBIDI — le vocabulaire visuel des Rapports
//
// Les signes nsibidi des Ejagham et des peuples de la Cross River
// (sud-est du Nigeria, ouest du Cameroun) : des idéogrammes tracés
// à la craie sur un fond sombre — doubles flèches, spirales, arcs
// à points, nœuds croisés, feuilles de fougère, échelles, cercles
// barrés.
//
// ⚠️ Interprétation contemporaine, pas reproduction : on garde le
//    geste — la craie blanche, le trait rond, les signes espacés
//    comme sur un tableau de comptes — et une palette resserrée
//    sur l'indigo, la craie et la terre.
//
// ⚠️ Comme les frises d'Abomey, de Korhogo et de Dogon : une bande
//    de neuf tuiles que `slice` agrandit sans déformer. Chaque tuile
//    tient deux registres de signes, séparés par un pointillé de
//    craie — la lecture d'un registre comptable.
// ═══════════════════════════════════════════════════════════

const INDIGO = '#101c28'
const INDIGO_FONCE = '#0a1219'
const INDIGO_CLAIR = '#17293a'
const CRAIE = '#f2e8d5'
const CRAIE_DOUCE = '#c9c2b0'
const TERRE = '#b4622a'

const TUILE = 300
const NB_TUILES = 9

// ── La double flèche ───────────────────────────────────────
// Deux traits parallèles, pointes aux deux bouts : le signe du
// va-et-vient, celui qu'on lit sur un relevé d'entrées/sorties.
function Fleche({ x = 0, y = 0, s = 1, doubles = true }) {
  const tete = (cx, sens) => (
    <path
      d={`M ${cx + sens * 7} -6 L ${cx} 0 L ${cx + sens * 7} 6`}
      fill="none"
      stroke={CRAIE}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, doubles ? 12 : 0].map((dy) => (
        <g key={dy} transform={`translate(0 ${dy})`}>
          <path d="M -20 0 H 20" stroke={CRAIE} strokeWidth="2.6" strokeLinecap="round" />
          {tete(20, -1)}
          {tete(-20, 1)}
        </g>
      ))}
    </g>
  )
}

// ── La spirale ─────────────────────────────────────────────
function Spirale({ x = 0, y = 0, s = 1, sens = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s * sens} ${s})`}>
      <path
        d="M 0 0 C 1 -5 7 -5 8 0 C 9 6 3 10 -3 7 C -11 3 -11 -8 -3 -12 C 6 -16 16 -8 15 3"
        fill="none"
        stroke={CRAIE}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </g>
  )
}

// ── L'arc à points ─────────────────────────────────────────
function Arc({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -16 6 Q 0 -16 16 6" fill="none" stroke={CRAIE} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="-16" cy="6" r="3" fill={CRAIE} />
      <circle cx="16" cy="6" r="3" fill={CRAIE} />
    </g>
  )
}

// ── Le nœud croisé ─────────────────────────────────────────
function Croix({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -13 -13 L 13 13 M 13 -13 L -13 13" stroke={CRAIE} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="-13" cy="-13" r="3.2" fill={CRAIE} />
      <circle cx="13" cy="-13" r="3.2" fill={CRAIE} />
      <circle cx="-13" cy="13" r="3.2" fill={CRAIE} />
      <circle cx="13" cy="13" r="3.2" fill={CRAIE} />
    </g>
  )
}

// ── La feuille de fougère ──────────────────────────────────
function Fougere({ x = 0, y = 0, s = 1, sens = 1 }) {
  const branches = [0, 1, 2, 3, 4]
  return (
    <g transform={`translate(${x} ${y}) scale(${s * sens} ${s})`}>
      <path d="M 0 14 L 0 -14" stroke={CRAIE} strokeWidth="2.6" strokeLinecap="round" />
      {branches.map((i) => {
        const cy = 8 - i * 5.5
        const longueur = 10 - i * 1.2
        return (
          <g key={i}>
            <path d={`M 0 ${cy} L -${longueur} ${cy - 4}`} stroke={CRAIE} strokeWidth="2" strokeLinecap="round" />
            <path d={`M 0 ${cy} L ${longueur} ${cy - 4}`} stroke={CRAIE} strokeWidth="2" strokeLinecap="round" />
          </g>
        )
      })}
    </g>
  )
}

// ── L'échelle ──────────────────────────────────────────────
// Deux montants et quatre barreaux : sur un registre, c'est la
// colonne, la rangée, la grille du tableau.
function Echelle({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -7 -15 L -7 15 M 7 -15 L 7 15" stroke={CRAIE} strokeWidth="2.6" strokeLinecap="round" />
      {[-10, -3.4, 3.4, 10].map((cy) => (
        <path key={cy} d={`M -7 ${cy} L 7 ${cy}`} stroke={CRAIE} strokeWidth="2.2" strokeLinecap="round" />
      ))}
    </g>
  )
}

// ── Le cercle barré ────────────────────────────────────────
function Cercle({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="0" r="12" fill="none" stroke={CRAIE} strokeWidth="2.6" />
      <path d="M -12 0 H 12" stroke={CRAIE} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  )
}

// ── Le pointillé du registre ───────────────────────────────
function Pointilles({ y, pas = 12 }) {
  const points = []
  for (let x = pas / 2; x < TUILE; x += pas) points.push(x)
  return (
    <g opacity="0.55">
      {points.map((x) => (
        <circle key={x} cx={x} cy={y} r="1.6" fill={CRAIE_DOUCE} />
      ))}
    </g>
  )
}

// ── Une tuile : deux registres de signes ───────────────────
function Tuile({ index }) {
  const pair = index % 2 === 0

  return (
    <g transform={`translate(${index * TUILE} 0)`}>
      {/* fond, avec un léger battement d'indigo d'une tuile à l'autre */}
      <rect
        width={TUILE}
        height="120"
        fill={pair ? INDIGO : INDIGO_CLAIR}
        opacity={pair ? 1 : 0.55}
      />

      {/* les montants de la tuile : deux traits de craie */}
      <path d={`M 1 0 V 120 M ${TUILE - 1} 0 V 120`} stroke={CRAIE} strokeWidth="1" opacity="0.22" />

      {/* ═══ BORDURE HAUTE ═══ */}
      <rect width={TUILE} height="5" fill={INDIGO_FONCE} />
      <path d="M 0 7 H 300" stroke={CRAIE} strokeWidth="0.9" opacity="0.35" />

      {/* ═══ REGISTRE 1 ═══ */}
      {pair ? (
        <>
          <Fleche x={54} y={30} s={0.92} />
          <Spirale x={126} y={34} s={0.95} sens={1} />
          <Arc x={192} y={36} s={0.9} />
          <Echelle x={254} y={32} s={0.7} />
        </>
      ) : (
        <>
          <Arc x={54} y={36} s={0.86} />
          <Croix x={122} y={32} s={0.8} />
          <Spirale x={188} y={34} s={0.85} sens={-1} />
          <Fleche x={250} y={30} s={0.8} doubles={false} />
        </>
      )}

      {/* ═══ LE POINTILLÉ DE SÉPARATION ═══ */}
      <Pointilles y={58} pas={13} />

      {/* ═══ REGISTRE 2 ═══ */}
      {pair ? (
        <>
          <Fougere x={42} y={84} s={0.92} sens={1} />
          <Cercle x={104} y={86} s={0.86} />
          <Croix x={162} y={86} s={0.78} />
          <Echelle x={216} y={86} s={0.68} />
          <Spirale x={266} y={88} s={0.62} sens={1} />
        </>
      ) : (
        <>
          <Echelle x={44} y={86} s={0.68} />
          <Fougere x={104} y={84} s={0.86} sens={-1} />
          <Fleche x={166} y={82} s={0.78} />
          <Cercle x={232} y={88} s={0.7} />
          <Arc x={274} y={90} s={0.62} />
        </>
      )}

      {/* la petite marque de terre : le sceau du scribe, tous les trois */
      }
      {index % 3 === 0 && <circle cx={TUILE - 22} cy={112} r="2.6" fill={TERRE} />}

      {/* ═══ BORDURE BASSE ═══ */}
      <path d="M 0 113 H 300" stroke={CRAIE} strokeWidth="0.9" opacity="0.35" />
      <rect y="115" width={TUILE} height="5" fill={INDIGO_FONCE} />
    </g>
  )
}

export function NsibidiFriseSvg({ className = '' }) {
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
      <rect width={TUILE * NB_TUILES} height="120" fill={INDIGO} />
      {Array.from({ length: NB_TUILES }, (_, i) => (
        <Tuile key={i} index={i} />
      ))}
    </svg>
  )
}

// ── LE BLASON ──────────────────────────────────────────────
// Le carré de l'en-tête : une plaque d'indigo cerclée de craie,
// avec au centre le cercle barré — le signe du compte — gardé
// par deux doubles flèches, et l'échelle des colonnes en bas.
export function NsibidiBlasonSvg({ size = 52, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
      focusable="false"
    >
      {/* la plaque d'indigo, cerclée deux fois de craie */}
      <rect x="1.5" y="1.5" width="49" height="49" rx="1" fill={INDIGO} stroke={CRAIE} strokeWidth="1.6" />
      <rect x="5" y="5" width="42" height="42" fill="none" stroke={CRAIE} strokeWidth="0.8" opacity="0.45" />

      {/* les deux montants du registre */}
      <path d="M 26 5 V 47" stroke={CRAIE} strokeWidth="0.9" opacity="0.4" />
      <path d="M 5 26 H 47" stroke={CRAIE} strokeWidth="0.9" opacity="0.4" />

      {/* ── quadr. 1 : la double flèche ── */}
      <g transform="translate(15.5 15.5) scale(0.3)">
        <path d="M -18 2 H 18 M -12 -5 L -19 2 L -12 9 M 12 -5 L 19 2 L 12 9" fill="none" stroke={CRAIE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M -18 13 H 18 M -12 6 L -19 13 L -12 20 M 12 6 L 19 13 L 12 20" fill="none" stroke={CRAIE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </g>

      {/* ── quadr. 2 : la spirale ── */}
      <g transform="translate(36.5 15.5) scale(0.46)">
        <path d="M 0 0 C 1 -5 7 -5 8 0 C 9 6 3 10 -3 7 C -11 3 -11 -8 -3 -12 C 6 -16 16 -8 15 3" fill="none" stroke={CRAIE} strokeWidth="4.4" strokeLinecap="round" />
      </g>

      {/* ── quadr. 3 : l'échelle ── */}
      <g transform="translate(15.5 36.5) scale(0.44)">
        <path d="M -8 -9 L -8 9 M 8 -9 L 8 9" stroke={CRAIE} strokeWidth="4.4" strokeLinecap="round" />
        {[-6, -2, 2, 6].map((cy) => (
          <path key={cy} d={`M -8 ${cy} L 8 ${cy}`} stroke={CRAIE} strokeWidth="3.6" strokeLinecap="round" />
        ))}
      </g>

      {/* ── quadr. 4 : le cercle barré, le signe du compte ── */}
      <circle cx="36.5" cy="36.5" r="5.6" fill="none" stroke={CRAIE} strokeWidth="1.8" />
      <path d="M 30.9 36.5 H 42.1" stroke={CRAIE} strokeWidth="1.8" strokeLinecap="round" />

      {/* le sceau de terre, au croisement */}
      <circle cx="26" cy="26" r="1.9" fill={TERRE} />
    </svg>
  )
}
