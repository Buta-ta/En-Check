// ═══════════════════════════════════════════════════════════
// 🎨 TOILE DE KORHOGO — le vocabulaire visuel d'Entreprises
//
// Toile peinte du pays sénoufo (nord de la Côte d'Ivoire) : un
// coton é cru, des cadres tracés à main levée, et dans chaque
// cadre un emblème — soleil, calao, caméléon, caïman. Entre les
// cadres, des chevrons et des points, comme sur les bordures.
//
// ⚠️ Interprétation contemporaine, pas reproduction : on garde le
//    geste (aplat peint, cadre irrégulier, emblème lisible) et une
//    palette resserrée sur l'écru, le noir de fumée, l'ocre brûlé
//    et la terre — celles de la charte.
//
// ⚠️ Comme la frise d'Abomey, c'est une bande de neuf tuiles que
//    `slice` agrandit sans déformer : le motif ne se répète jamais
//    en hauteur et ne coupe pas les cadres.
// ═══════════════════════════════════════════════════════════

const ECRU = '#efe3cb'
const ECRU_CLAIR = '#f7efdf'
const NOIR = '#241c16'
const OCRE = '#b4622a'
const TERRE = '#8b3e1d'
const OR = '#c9a961'

const TUILE = 300
const NB_TUILES = 9

// ── Les emblèmes ───────────────────────────────────────────
// Chacun est dessiné autour de (0, 0) et tient dans ±34 × ±28 :
// c'est ce qui lui permet d'entrer dans un cadre de 100 × 84.

function Soleil() {
  return (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6
        const x1 = Math.cos(a) * 16
        const y1 = Math.sin(a) * 16
        const x2 = Math.cos(a) * 27
        const y2 = Math.sin(a) * 27
        const nx = -Math.sin(a) * 3.1
        const ny = Math.cos(a) * 3.1
        return (
          <polygon
            key={i}
            points={`${(x1 + nx).toFixed(1)},${(y1 + ny).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${(x1 - nx).toFixed(1)},${(y1 - ny).toFixed(1)}`}
            fill={TERRE}
          />
        )
      })}
      <circle r="14" fill={OCRE} stroke={NOIR} strokeWidth="2.4" />
      <circle r="8.5" fill="none" stroke={ECRU_CLAIR} strokeWidth="1.2" strokeDasharray="2.5 2.5" />
      <circle r="3" fill={NOIR} />
    </g>
  )
}

function Calao() {
  return (
    <g>
      {/* la branche */}
      <path d="M -30 21 L 30 19" stroke={NOIR} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 6 20 L 12 14" stroke={NOIR} strokeWidth="1.4" strokeLinecap="round" />
      {/* la queue */}
      <path d="M -11 7 L -28 16 L -18 17 L -14 12 Z" fill={TERRE} stroke={NOIR} strokeWidth="1.4" strokeLinejoin="round" />
      {/* le corps */}
      <path
        d="M -14 13 C -19 3 -11 -8 0 -8 C 10 -8 15 0 13 8 C 11 14 1 17 -7 15 Z"
        fill={OCRE}
        stroke={NOIR}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* l'aile */}
      <path d="M -8 3 C -2 -2 6 0 8 6 C 2 11 -6 10 -8 3 Z" fill={TERRE} />
      <path d="M -4 4 L 2 7 M 0 2 L 5 5" stroke={ECRU_CLAIR} strokeWidth="1" strokeOpacity="0.7" />
      {/* la tête */}
      <circle cx="11" cy="-9" r="5.6" fill={OCRE} stroke={NOIR} strokeWidth="1.8" />
      {/* le casque du calao */}
      <path d="M 9 -14 L 14 -18 L 16 -12 Z" fill={OR} stroke={NOIR} strokeWidth="1.1" strokeLinejoin="round" />
      {/* le bec, long et recourbé */}
      <path
        d="M 15 -11 C 24 -14 32 -8 30 -1 C 26 2 20 1 15 -4 Z"
        fill={TERRE}
        stroke={NOIR}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M 18 -8 C 23 -8 27 -5 27 -2" stroke={ECRU_CLAIR} strokeWidth="1" fill="none" strokeOpacity="0.65" />
      {/* l'œil et les pattes */}
      <circle cx="12.4" cy="-10" r="1.1" fill={NOIR} />
      <path d="M -2 16 L -2 20 M 5 15 L 5 19" stroke={NOIR} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}

function Cameleon() {
  return (
    <g>
      {/* la queue enroulée : une spirale qui sort du dos et rentre vers elle-même */}
      <path
        d="M -14 4 C -26 1 -33 9 -30 17 C -27 25 -16 24 -14 17 C -12.5 12 -18 10 -20 14"
        fill="none"
        stroke={NOIR}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M -14 4 C -26 1 -33 9 -30 17 C -27 25 -16 24 -14 17 C -12.5 12 -18 10 -20 14"
        fill="none"
        stroke={OCRE}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M -22 4 C -27 6 -29 10 -28 13"
        fill="none"
        stroke={NOIR}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />
      {/* le corps */}
      <path
        d="M -18 5 C -13 -7 -1 -11 9 -7 C 15 -4 17 1 15 6 C 8 12 -8 13 -18 5 Z"
        fill={OCRE}
        stroke={NOIR}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* la crête du dos */}
      {[-8, -2, 4].map((x, i) => (
        <path key={i} d={`M ${x} -8 L ${x + 3} -13 L ${x + 6} -7 Z`} fill={TERRE} stroke={NOIR} strokeWidth="1" />
      ))}
      {/* la tête et le museau */}
      <path
        d="M 10 -9 C 17 -13 23 -8 27 -3 L 30 0 C 26 4 19 5 14 3 Z"
        fill={OCRE}
        stroke={NOIR}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="-4" r="3.6" fill={ECRU_CLAIR} stroke={NOIR} strokeWidth="1.3" />
      <circle cx="19.6" cy="-4" r="1.5" fill={NOIR} />
      {/* la bouche */}
      <path d="M 26 2 L 30 1.5" stroke={NOIR} strokeWidth="1.3" strokeLinecap="round" />
      {/* les pattes */}
      <path
        d="M -6 9 L -9 16 L -3 17 M 6 9 L 8 16 L 14 15"
        fill="none"
        stroke={NOIR}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

function Caiman() {
  return (
    <g>
      {/* la queue qui s'enroule */}
      <path
        d="M -24 1 C -33 2 -36 11 -27 14 C -24 15 -22 13 -23 11"
        fill="none"
        stroke={NOIR}
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path
        d="M -24 1 C -33 2 -36 11 -27 14 C -24 15 -22 13 -23 11"
        fill="none"
        stroke={TERRE}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* le corps */}
      <path
        d="M -25 1 C -18 -6 -4 -8 7 -6 C 15 -5 19 -3 21 0 C 16 5 2 7 -8 6 C -18 6 -23 4 -25 1 Z"
        fill={TERRE}
        stroke={NOIR}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* les écailles du dos */}
      {[-16, -9, -2, 5, 12].map((x, i) => (
        <path
          key={i}
          d={`M ${x} -5.5 L ${x + 3} -10 L ${x + 6} -4.5 Z`}
          fill={i % 2 === 0 ? OCRE : NOIR}
          stroke={NOIR}
          strokeWidth="0.9"
        />
      ))}
      {/* la gueule ouverte : deux mâchoires plus courtes, et les dents */}
      <path d="M 19 -4 L 31 -8 L 33 -4 L 21 -1 Z" fill={OCRE} stroke={NOIR} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 21 0 L 34 3 L 32 7 L 20 4 Z" fill={OCRE} stroke={NOIR} strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M 23 -3.6 L 24 -1.6 L 25.4 -3.8 L 26.6 -1.8 L 28 -4 L 29.2 -2.2"
        fill="none"
        stroke={ECRU_CLAIR}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="-3.5" r="1.5" fill={NOIR} />
      {/* les pattes */}
      <path
        d="M -12 6 L -14 12 L -8 12 M 2 6 L 0 12 L 7 12"
        fill="none"
        stroke={NOIR}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

const EMBLEMES = [Soleil, Calao, Cameleon, Caiman]

// ── La tuile ───────────────────────────────────────────────
// 300 × 120 : deux bordures de chevrons, deux coutures
// verticales, un cadre peint et son emblème.

function Tuile({ index }) {
  const Embleme = EMBLEMES[index % EMBLEMES.length]
  return (
    <g transform={`translate(${index * TUILE} 0)`}>
      <rect width={TUILE} height="120" fill={ECRU} />

      {/* ═══ BORDURE HAUTE : bande noire, chevrons ocre, points ═══ */}
      <rect width={TUILE} height="9" fill={NOIR} />
      <path
        d={`M 0 5 ${Array.from({ length: 12 }, (_, i) => `L ${i * 24 + 12} ${i % 2 ? 5 : 1.5} L ${(i + 1) * 24} ${i % 2 ? 8.5 : 5}`).join(' ')}`}
        fill="none"
        stroke={OCRE}
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
      {Array.from({ length: 15 }, (_, i) => (
        <circle key={i} cx={i * 20 + 10} cy="15.5" r="1.5" fill={TERRE} />
      ))}

      {/* ═══ BORDURE BASSE ═══ */}
      <rect y="111" width={TUILE} height="9" fill={NOIR} />
      <path
        d={`M 0 115 ${Array.from({ length: 12 }, (_, i) => `L ${i * 24 + 12} ${i % 2 ? 115 : 118.5} L ${(i + 1) * 24} ${i % 2 ? 111.5 : 115}`).join(' ')}`}
        fill="none"
        stroke={OCRE}
        strokeWidth="1.6"
      />
      {Array.from({ length: 15 }, (_, i) => (
        <circle key={i} cx={i * 20 + 10} cy="104.5" r="1.5" fill={TERRE} />
      ))}

      {/* ═══ LES COUTURES VERTICALES, entre deux cases ═══ */}
      {[0, TUILE].map((x) => (
        <g key={x}>
          <line x1={x + 8} y1="22" x2={x + 8} y2="98" stroke={NOIR} strokeWidth="1.5" />
          <line x1={x + 20} y1="22" x2={x + 20} y2="98" stroke={NOIR} strokeWidth="1.5" />
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1={x + 8}
              y1={26 + i * 10}
              x2={x + 20}
              y2={22 + i * 10}
              stroke={TERRE}
              strokeWidth="1.1"
              strokeOpacity="0.85"
            />
          ))}
        </g>
      ))}

      {/* ═══ LES SIGNES ENTRE LES CADRES ═══ */}
      {[60, 240].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <rect x="-6" y="30" width="12" height="12" fill={x === 60 ? TERRE : OCRE} stroke={NOIR} strokeWidth="1.2" />
          <path d="M -6 30 L 6 42 M 6 30 L -6 42" stroke={ECRU_CLAIR} strokeWidth="1.1" />
          <polygon points="0,52 6,64 -6,64" fill={x === 60 ? OCRE : TERRE} stroke={NOIR} strokeWidth="1.1" />
          <circle cx="0" cy="74" r="2.6" fill={NOIR} />
          <circle cx="0" cy="84" r="2.6" fill="none" stroke={NOIR} strokeWidth="1.3" />
        </g>
      ))}

      {/* ═══ LE CADRE PEINT ═══ */}
      <rect x="100" y="18" width="100" height="84" fill={ECRU_CLAIR} stroke={NOIR} strokeWidth="3" />
      <rect
        x="105.5"
        y="23.5"
        width="89"
        height="73"
        fill="none"
        stroke={TERRE}
        strokeWidth="1.3"
        strokeDasharray="5 3"
        strokeOpacity="0.9"
      />
      {/* les quatre marques d'angle, tracées à la main */}
      <path
        d="M 101 24 L 108 24 M 101 24 L 101 31 M 199 24 L 192 24 M 199 24 L 199 31 M 101 96 L 108 96 M 101 96 L 101 89 M 199 96 L 192 96 M 199 96 L 199 89"
        stroke={OCRE}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* ═══ L'EMBLÈME ═══ */}
      <g transform="translate(150 60)">
        <Embleme />
      </g>
    </g>
  )
}

export function KorhogoFriseSvg({ className = '' }) {
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
      <rect width={TUILE * NB_TUILES} height="120" fill={ECRU} />
      {Array.from({ length: NB_TUILES }, (_, i) => (
        <Tuile key={i} index={i} />
      ))}
    </svg>
  )
}

// ── LE BLASON ──────────────────────────────────────────────
// Le carré de l'en-tête : un cadre peint, un soleil, des
// chevrons. C'est l'emblème de la page Entreprises.
export function KorhogoBlasonSvg({ size = 52, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="49" height="49" rx="3" fill={ECRU_CLAIR} stroke={NOIR} strokeWidth="2.2" />
      <rect
        x="4.5"
        y="4.5"
        width="43"
        height="43"
        rx="1.5"
        fill="none"
        stroke={TERRE}
        strokeWidth="1.1"
        strokeDasharray="4 2.6"
        strokeOpacity="0.85"
      />
      {/* chevrons du haut et du bas */}
      <path d="M 6 9 L 11 12 L 6 15 M 13 9 L 18 12 L 13 15 M 20 9 L 25 12 L 20 15" fill="none" stroke={OCRE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 6 37 L 11 40 L 6 43 M 13 37 L 18 40 L 13 43 M 20 37 L 25 40 L 20 43" fill="none" stroke={OCRE} strokeWidth="1.6" strokeLinejoin="round" />
      {/* le soleil, emblème du registre */}
      <g transform="translate(31 26)">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return (
            <line
              key={i}
              x1={Math.cos(a) * 6.5}
              y1={Math.sin(a) * 6.5}
              x2={Math.cos(a) * 10}
              y2={Math.sin(a) * 10}
              stroke={TERRE}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )
        })}
        <circle r="5.4" fill={OCRE} stroke={NOIR} strokeWidth="1.3" />
        <circle r="1.6" fill={NOIR} />
      </g>
      {/* un point de couture dans le coin libre */}
      <circle cx="16" cy="26" r="1.7" fill={TERRE} />
    </svg>
  )
}

// ── LE BLASON DE NUIT ─────────────────────────────────────
// Le même emblème, posé sur un mur de fumée : la toile reste
// reconnaissable (cadre peint, couture, soleil), mais elle ne
// troue plus l'écran d'une plaque claire. Sert à la fois à
// « Configuration pointeuse » et à l'écran du poste.
export function KorhogoBlasonNuitSvg({ size = 52, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="49" height="49" rx="3" fill="#241d18" stroke={OR} strokeWidth="1.6" />
      <rect
        x="4.5"
        y="4.5"
        width="43"
        height="43"
        rx="1.5"
        fill="none"
        stroke={TERRE}
        strokeWidth="1.1"
        strokeDasharray="4 2.6"
        strokeOpacity="0.9"
      />
      {/* les chevrons peints, en haut et en bas */}
      <path d="M 6 9 L 11 12 L 6 15 M 13 9 L 18 12 L 13 15 M 20 9 L 25 12 L 20 15" fill="none" stroke={OCRE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 6 37 L 11 40 L 6 43 M 13 37 L 18 40 L 13 43 M 20 37 L 25 40 L 20 43" fill="none" stroke={OCRE} strokeWidth="1.6" strokeLinejoin="round" />
      {/* le soleil, emblème du registre */}
      <g transform="translate(31 26)">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return (
            <line
              key={i}
              x1={Math.cos(a) * 6.5}
              y1={Math.sin(a) * 6.5}
              x2={Math.cos(a) * 10}
              y2={Math.sin(a) * 10}
              stroke={OR}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )
        })}
        <circle r="5.4" fill={OCRE} stroke="#f2e8d5" strokeWidth="1.2" />
        <circle r="1.6" fill="#241c16" />
      </g>
      {/* un point de couture dans le coin libre */}
      <circle cx="16" cy="26" r="1.7" fill={OR} />
    </svg>
  )
}
