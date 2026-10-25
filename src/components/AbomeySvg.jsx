// ═══════════════════════════════════════════════════════════
// 🧵 APPLIQUÉ D'ABOMEY — le vocabulaire visuel de Comptes & accès
//
// Tenture appliquée du Danhomè (Bénin) : des formes de coton
// DÉCOUPÉES ET COUSUES sur un fond contrasté — aplats francs,
// couture visible, emblèmes, bandes répétées.
//
// ⚠️ Interprétation contemporaine, pas reproduction. Les vraies
//    tentures sont plus saturées ; on garde le geste — aplat,
//    couture, blason — et une palette resserrée sur l'indigo,
//    la terre cuite et l'ivoire, lisibles derrière du texte.
//
// ⚠️ La frise est une bande continue de neuf tuiles : `slice`
//    l'agrandit sans la déformer, et le motif ne se répète jamais
//    en hauteur. Une `<pattern>` se recopiait verticalement et
//    coupait les losanges dès que la bande dépassait 120 px.
// ═══════════════════════════════════════════════════════════

const INDIGO_NUIT = '#14202e'
const INDIGO = '#1e3252'
const INDIGO_CLAIR = '#2c4570'
const TERRE = '#8b3e1d'
const TERRE_CHAUD = '#a04a22'
const IVOIRE = '#e8dcc4'
const IVOIRE_CHAUD = '#f2e8d5'
const FIL = '#c9a961'
const FIL_SOMBRE = '#8a6f3a'

// ── LA BANDE TISSÉE ────────────────────────────────────────
// Tuile de 320 × 120 : losanges ivoire, chevrons terre cuite,
// cauris par deux, silhouettes d'animaux, couture en haut et
// en bas.
export function AbomeyFriseSvg({ className = '' }) {
  // Une tuile de 300 × 120, répétée NEUF fois dans une bande de 2700.
  // `slice` met l'ensemble à l'échelle sans jamais déformer : la frise
  // se contente de montrer plus ou moins de tuiles selon la largeur.
  // (Une `<pattern>` se répétait aussi en hauteur et coupait le motif
  //  dès que la bande dépassait 120 px.)
  const tuile = (x) => (
    <g key={x} transform={`translate(${x} 0)`}>
      <rect width="300" height="120" fill={INDIGO_NUIT} />

      {/* Bandeau de couture, en haut et en bas */}
      <line x1="0" y1="6" x2="300" y2="6" stroke={IVOIRE} strokeWidth="1.6" strokeDasharray="7 6" strokeOpacity="0.5" />
      <line x1="0" y1="114" x2="300" y2="114" stroke={IVOIRE} strokeWidth="1.6" strokeDasharray="7 6" strokeOpacity="0.5" />

      {/* ═══ LOSANGE IVOIRE — cœur du motif, touche les bords ═══ */}
      <polygon points="150,8 208,60 150,112 92,60" fill={IVOIRE} />
      <polygon points="150,22 191,60 150,98 109,60" fill={INDIGO} stroke={FIL} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
      <polygon points="150,44 166,60 150,76 134,60" fill={TERRE_CHAUD} />

      {/* ═══ CHEVRON TERRE CUITE — gauche, touche le bord ═══ */}
      <path d="M 0 14 L 46 14 L 46 34 L 18 34 L 18 86 L 46 86 L 46 106 L 0 106 Z" fill={TERRE} />
      <path d="M 3 18 L 42 18 L 42 30 L 14 30 L 14 90 L 42 90 L 42 102 L 3 102" fill="none" stroke={IVOIRE} strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />

      {/* ═══ CHEVRON INDIGO CLAIR — droite ═══ */}
      <path d="M 300 14 L 254 14 L 254 34 L 282 34 L 282 86 L 254 86 L 254 106 L 300 106 Z" fill={INDIGO_CLAIR} />
      <path d="M 297 18 L 258 18 L 258 30 L 286 30 L 286 90 L 258 90 L 258 102 L 297 102" fill="none" stroke={IVOIRE} strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />

      {/* ═══ CAURIS PAR DEUX ═══ */}
      <g transform="translate(60 34) rotate(-16)">
        <ellipse cx="0" cy="0" rx="7" ry="11" fill={IVOIRE_CHAUD} />
        <path d="M 0 -9 L 0 9" stroke={INDIGO_NUIT} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <g transform="translate(76 44) rotate(14)">
        <ellipse cx="0" cy="0" rx="7" ry="11" fill={IVOIRE_CHAUD} />
        <path d="M 0 -9 L 0 9" stroke={INDIGO_NUIT} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <g transform="translate(240 44) rotate(-14)">
        <ellipse cx="0" cy="0" rx="7" ry="11" fill={IVOIRE_CHAUD} />
        <path d="M 0 -9 L 0 9" stroke={INDIGO_NUIT} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <g transform="translate(256 34) rotate(16)">
        <ellipse cx="0" cy="0" rx="7" ry="11" fill={IVOIRE_CHAUD} />
        <path d="M 0 -9 L 0 9" stroke={INDIGO_NUIT} strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* ═══ SILHOUETTES — lion, oiseau, poisson ═══ */}
      <g transform="translate(150 22) scale(1.05)">
        <ellipse cx="0" cy="0" rx="9" ry="4.6" fill={TERRE_CHAUD} />
        <circle cx="8" cy="-3.8" r="4" fill={TERRE_CHAUD} />
        <rect x="-7" y="2.8" width="2.6" height="5" fill={TERRE_CHAUD} />
        <rect x="2" y="2.8" width="2.6" height="5" fill={TERRE_CHAUD} />
        <path d="M -9.5 -1 q -6 -3.5 -5 -9" stroke={TERRE_CHAUD} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <circle cx="9.2" cy="-4.4" r="0.9" fill={IVOIRE} />
      </g>
      <g transform="translate(150 100) scale(1.05)">
        <ellipse cx="0" cy="0" rx="8" ry="4.4" fill={TERRE_CHAUD} />
        <circle cx="7" cy="-4" r="3.4" fill={TERRE_CHAUD} />
        <polygon points="9.8,-4.8 13.6,-2.8 9.8,-1" fill={TERRE_CHAUD} />
        <polygon points="-7.4,0.4 -14,-2.8 -12.8,4" fill={TERRE_CHAUD} />
        <circle cx="8" cy="-4.6" r="0.85" fill={IVOIRE} />
      </g>
      <g transform="translate(46 60) scale(0.85)">
        <ellipse cx="0" cy="0" rx="8" ry="4" fill={IVOIRE} fillOpacity="0.8" />
        <circle cx="7" cy="-3.4" r="3.2" fill={IVOIRE} fillOpacity="0.8" />
        <polygon points="9.6,-4 13,-2.2 9.6,-0.4" fill={IVOIRE} fillOpacity="0.8" />
        <polygon points="-7,-0.4 -13,-3.6 -11.8,3" fill={IVOIRE} fillOpacity="0.8" />
      </g>
      <g transform="translate(254 60) scale(0.85) scale(-1,1)">
        <ellipse cx="0" cy="0" rx="8" ry="4" fill={IVOIRE} fillOpacity="0.8" />
        <circle cx="7" cy="-3.4" r="3.2" fill={IVOIRE} fillOpacity="0.8" />
        <polygon points="9.6,-4 13,-2.2 9.6,-0.4" fill={IVOIRE} fillOpacity="0.8" />
        <polygon points="-7,-0.4 -13,-3.6 -11.8,3" fill={IVOIRE} fillOpacity="0.8" />
      </g>

      {/* ═══ COUTURES DÉCORATIVES ═══ */}
      <path d="M 150 8 L 92 60 L 150 112 L 208 60 Z" fill="none" stroke={FIL_SOMBRE} strokeWidth="1" strokeDasharray="5 4" strokeOpacity="0.5" />
    </g>
  )

  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox="0 0 2700 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="2700" height="120" fill={INDIGO_NUIT} />
      {[0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400].map(tuile)}
    </svg>
  )
}

// ── LE BLASON : mosaïque cousue ────────────────────────────
// Le carré de l'en-tête : patchwork de losanges terre cuite,
// indigo et vert, bordé de couture. C'est l'emblème de la page.
export function AbomeyBlasonSvg({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="encheck-blason-clip">
          <rect x="3" y="3" width="46" height="46" rx="6" />
        </clipPath>
      </defs>
      <rect x="1.5" y="1.5" width="49" height="49" rx="8" fill={INDIGO_NUIT} />
      <g clipPath="url(#encheck-blason-clip)">
        <polygon points="23,10 33,20 23,30 13,20" fill={TERRE} />
        <polygon points="33,14 45,26 33,38 21,26" fill={INDIGO_CLAIR} />
        <polygon points="15,22 25,32 15,42 5,32" fill="#3f6b4e" />
        <polygon points="26,28 34,36 26,44 18,36" fill={TERRE_CHAUD} />
        <rect x="20" y="4" width="4" height="44" fill="none" />
      </g>
      <rect
        x="3" y="3" width="46" height="46" rx="6"
        fill="none" stroke={IVOIRE} strokeWidth="1.4" strokeDasharray="4 3.5" strokeOpacity="0.8"
      />
      <rect x="1.5" y="1.5" width="49" height="49" rx="8" fill="none" stroke={FIL_SOMBRE} strokeWidth="1" />
    </svg>
  )
}

// ── LE COIN COUSU : pièce d'appliqué triangulaire ──────────
// Posé en haut-gauche ou en bas-droite d'une carte.
export function AbomeyCoinSvg({ variante = 'terre', coin = 'haut', size = 76 }) {
  const fond =
    variante === 'indigo'
      ? INDIGO
      : variante === 'or'
        ? '#9a7529'
        : variante === 'ivoire'
          ? IVOIRE
          : TERRE
  const motif =
    variante === 'indigo'
      ? TERRE
      : variante === 'or'
        ? INDIGO_NUIT
        : variante === 'ivoire'
          ? TERRE
          : INDIGO
  const retourne = coin === 'bas' ? 'scale(-1,-1)' : ''
  const couture = variante === 'ivoire' ? FIL_SOMBRE : IVOIRE

  return (
    <svg width={size} height={size} viewBox="0 0 76 76" aria-hidden="true" focusable="false">
      <g transform={retourne === 'scale(-1,-1)' ? 'translate(76,76) scale(-1,-1)' : undefined}>
        {/* la pièce de tissu */}
        <path d="M 0 0 L 76 0 L 0 76 Z" fill={fond} />
        {/* couture le long de l'hypoténuse */}
        <path
          d="M 9 0 L 0 9 M 22 0 L 0 22 M 35 0 L 0 35 M 48 0 L 0 48 M 61 0 L 0 61"
          stroke={couture} strokeWidth="1.1" strokeOpacity="0.45"
        />
        <path
          d="M 68 0 L 0 68"
          stroke={couture} strokeWidth="1.6" strokeDasharray="5 4" strokeOpacity="0.75"
        />
        {/* motif : cauris ou losange selon la variante */}
        {variante === 'or' ? (
          <g transform="translate(26 16) rotate(-38)">
            <ellipse cx="0" cy="0" rx="7" ry="10.5" fill={IVOIRE} />
            <path d="M 0 -9 L 0 9" stroke={INDIGO_NUIT} strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ) : (
          <g transform="translate(27 15) rotate(-40)">
            <polygon points="0,-11 9,0 0,11 -9,0" fill={motif} stroke={IVOIRE} strokeWidth="1" strokeDasharray="3 2.5" strokeOpacity="0.6" />
            <polygon points="0,-5.5 4.5,0 0,5.5 -4.5,0" fill={IVOIRE} />
          </g>
        )}
      </g>
    </svg>
  )
}

// ── LA COURBE D'UNE CARTE ──────────────────────────────────
// Calme, sans remplissage, sur toute la largeur disponible.
// Les valeurs sont de VRAIES données (comptes par mois) : la
// courbe ondule donc naturellement, sans rien inventer.
export function CourbeOnduleeSvg({ valeurs = [], largeur = 280, hauteur = 46, ton = 'clair' }) {
  const trait =
    ton === 'terre' ? TERRE_CHAUD : ton === 'or' ? FIL : IVOIRE

  const n = valeurs.length
  const serie = n >= 2 ? valeurs : [0, 0]
  const max = Math.max(...serie, 1)
  const min = Math.min(...serie, 0)
  const amplitude = max - min || 1
  const marge = 5

  const pts = serie.map((v, i) => ({
    x: (i / (serie.length - 1)) * (largeur - marge * 2) + marge,
    y: hauteur - marge - ((v - min) / amplitude) * (hauteur - marge * 2),
  }))

  // lissage : on passe par des courbes de Bézier, jamais des angles
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  return (
    <svg
      width="100%"
      height={hauteur}
      viewBox={`0 0 ${largeur} ${hauteur}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke={trait}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
      />
    </svg>
  )
}

// ── LE CAURIS D'ÉTAT ───────────────────────────────────────
export function CaurisEtatSvg({ etat = 'lie', size = 12 }) {
  const plein = etat === 'lie'
  const teinte =
    etat === 'verrouille' ? '#c0452f' : etat === 'non_lie' ? '#c98a16' : '#3e8e61'
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <ellipse
        cx="6" cy="6" rx="3.4" ry="5.2"
        fill={plein ? teinte : 'none'}
        stroke={teinte} strokeWidth="1.3"
      />
      {plein && <path d="M6 1.6 L6 10.4" stroke="#15110e" strokeWidth="1" strokeOpacity="0.55" />}
    </svg>
  )
}
