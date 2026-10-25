// ═══════════════════════════════════════════════════════════
// 🧵 APPLIQUÉ D'ABOMEY — vocabulaire visuel de la page
//    Administrateurs
//
// Tenture appliquée du Danhomè (Bénin) : des formes de coton
// DÉCOUPÉES ET COUSUES sur un fond contrasté — aplats francs,
// couture visible, emblèmes héraldiques, bandes répétées.
//
// ⚠️ Interprétation contemporaine, pas reproduction : les vraies
//    tentures sont bien plus saturées. Sur une page où l'on lit
//    des noms et des rôles, cette saturation rendrait le contenu
//    illisible. On garde le GESTE — aplat, couture, blason —
//    pas la palette d'origine.
//
// ⚠️ Aucun `viewBox` sur la frise : un motif placé dans un
//    viewBox plus petit que la zone de rendu ne se répète pas,
//    il s'étire. C'est le piège déjà rencontré sur le bogolan.
// ═══════════════════════════════════════════════════════════

const ENCRE = '#1B2440'
const INDIGO = '#2A3A63'
const INDIGO_CLAIR = '#3A4E7D'
const TERRE = '#B56235'
const TERRE_CLAIR = '#C4703F'
const IVOIRE = '#F0E6D2'
const FIL = '#D9B36A'

// ── La bande tissée ────────────────────────────────────────
export function AbomeyFriseSvg({ className = '' }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="encheck-abomey-frise" x="0" y="0" width="248" height="96" patternUnits="userSpaceOnUse">
          <rect width="248" height="96" fill={ENCRE} />

          {/* ── Rangée haute : chevrons et cauris ── */}
          {[0, 124, 248].map((cx) => (
            <g key={`chev-h-${cx}`}>
              <path d={`M ${cx - 32} 20 L ${cx} 6 L ${cx + 32} 20`} stroke={INDIGO_CLAIR} strokeWidth="7" fill="none" />
              <path
                d={`M ${cx - 32} 20 L ${cx} 6 L ${cx + 32} 20`}
                stroke={FIL} strokeWidth="1" fill="none" strokeDasharray="3 3" strokeOpacity="0.7"
              />
            </g>
          ))}
          {[62, 186].map((cx) => (
            <g key={`cauris-h-${cx}`}>
              <ellipse cx={cx} cy="13" rx="6" ry="8.5" fill={IVOIRE} />
              <path d={`M ${cx} 6 L ${cx} 20`} stroke={ENCRE} strokeWidth="1.6" strokeLinecap="round" />
              <path d={`M ${cx - 2.6} 10 L ${cx + 2.6} 10 M ${cx - 2.6} 16 L ${cx + 2.6} 16`} stroke={ENCRE} strokeWidth="0.8" />
            </g>
          ))}

          {/* ── Rangée basse, en miroir ── */}
          {[0, 124, 248].map((cx) => (
            <g key={`chev-b-${cx}`}>
              <path d={`M ${cx - 32} 76 L ${cx} 90 L ${cx + 32} 76`} stroke={INDIGO_CLAIR} strokeWidth="7" fill="none" />
              <path
                d={`M ${cx - 32} 76 L ${cx} 90 L ${cx + 32} 76`}
                stroke={FIL} strokeWidth="1" fill="none" strokeDasharray="3 3" strokeOpacity="0.7"
              />
            </g>
          ))}
          {[62, 186].map((cx) => (
            <g key={`cauris-b-${cx}`}>
              <ellipse cx={cx} cy="83" rx="6" ry="8.5" fill={IVOIRE} />
              <path d={`M ${cx} 76 L ${cx} 90`} stroke={ENCRE} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          ))}

          {/* ── Losanges royaux imbriqués ── */}
          {[0, 124, 248].map((cx) => (
            <g key={`losange-${cx}`}>
              <polygon
                points={`${cx},24 ${cx + 46},48 ${cx},72 ${cx - 46},48`}
                fill={TERRE}
                stroke={FIL} strokeWidth="1" strokeDasharray="3.5 3" strokeOpacity="0.75"
              />
              <polygon
                points={`${cx},30.2 ${cx + 34},48 ${cx},65.8 ${cx - 34},48`}
                fill={INDIGO}
              />
              <polygon
                points={`${cx},37 ${cx + 21},48 ${cx},59 ${cx - 21},48`}
                fill={IVOIRE}
              />
              <polygon
                points={`${cx},41.5 ${cx + 11.5},48 ${cx},54.5 ${cx - 11.5},48`}
                fill={INDIGO_CLAIR}
                stroke={FIL} strokeWidth="0.8" strokeDasharray="2 2"
              />
              <rect x={cx - 2.5} y={45.5} width="5" height="5" fill={TERRE} />
            </g>
          ))}

          {/* ── Emblèmes héraldiques : lion et oiseau ── */}
          <g transform="translate(62 48)" fill={TERRE_CLAIR}>
            <ellipse cx="-2" cy="0" rx="9" ry="5" />
            <circle cx="8.5" cy="-3.5" r="4.4" />
            <rect x="-8.5" y="3" width="3" height="5.5" />
            <rect x="1" y="3" width="3" height="5.5" />
            <path d="M -10.5 -1 q -6 -3.5 -5 -9" stroke={TERRE_CLAIR} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <circle cx="9.5" cy="-4" r="0.9" fill={IVOIRE} />
          </g>
          <g transform="translate(186 48)" fill={TERRE_CLAIR}>
            <ellipse cx="0" cy="1" rx="8" ry="5" />
            <circle cx="7" cy="-4" r="3.4" />
            <polygon points="10,-4.6 14.5,-2.6 10,-0.8" />
            <polygon points="-7.5,1 -14,-2.5 -13,4" />
            <path d="M -2 6 L -2 10 M 3 6 L 3 10" stroke={TERRE_CLAIR} strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="-4.4" r="0.9" fill={IVOIRE} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#encheck-abomey-frise)" />
    </svg>
  )
}

// ── L'emblème de la page (blason carré) ────────────────────
export function AbomeyBlasonSvg({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="44" height="44" rx="7" fill={INDIGO} />
      <rect
        x="3.5" y="3.5" width="39" height="39" rx="5"
        fill="none" stroke={FIL} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.8"
      />
      <polygon points="23,8 37,23 23,38 9,23" fill={TERRE} />
      <polygon points="23,12.5 32.5,23 23,33.5 13.5,23" fill={IVOIRE} />
      <polygon points="23,17 28.5,23 23,29 17.5,23" fill={INDIGO} />
      <rect x="21" y="21" width="4" height="4" fill={FIL} />
    </svg>
  )
}

// ── Pastille d'angle, la « pièce » cousue sur la carte ─────
export function AbomeyPastilleSvg({ variante = 'terre', size = 54 }) {
  const fond = variante === 'indigo' ? INDIGO : variante === 'or' ? '#8A6A33' : TERRE
  const motif = variante === 'indigo' ? TERRE : variante === 'or' ? IVOIRE : INDIGO
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="52" height="52" rx="8" fill={fond} />
      <rect
        x="4" y="4" width="46" height="46" rx="6"
        fill="none" stroke={FIL} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.85"
      />
      <polygon points="27,11 41,27 27,43 13,27" fill={motif} />
      <polygon points="27,17 34.5,27 27,37 19.5,27" fill={IVOIRE} />
      <rect x="24.5" y="24.5" width="5" height="5" fill={fond} />
    </svg>
  )
}

// ── La petite courbe des cartes (cumul réel) ───────────────
export function MiniCourbeSvg({ valeurs = [], ton = 'terre', width = 150, height = 34 }) {
  const trait = ton === 'vert' ? '#3E8E61' : ton === 'or' ? FIL : TERRE_CLAIR
  const serie = valeurs.length >= 2 ? valeurs : [0, 0]
  const max = Math.max(...serie, 1)
  const min = Math.min(...serie, 0)
  const amplitude = max - min || 1
  const pas = width / (serie.length - 1)

  const points = serie.map((v, i) => {
    const x = i * pas
    const y = height - 4 - ((v - min) / amplitude) * (height - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <polyline points={points.join(' ')} fill="none" stroke={trait} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline
        points={`0,${height} ${points.join(' ')} ${width},${height}`}
        fill={trait} fillOpacity="0.10" stroke="none"
      />
    </svg>
  )
}

// ── Le sceau d'état : petit cauris plein / creux ───────────
export function CaurisEtatSvg({ etat = 'lie', size = 12 }) {
  const plein = etat === 'lie'
  const teinte = etat === 'verrouille' ? '#C0452F' : etat === 'non_lie' ? '#C97A16' : '#3E8E61'
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <ellipse cx="6" cy="6" rx="3.4" ry="5.2" fill={plein ? teinte : 'none'} stroke={teinte} strokeWidth="1.3" />
      {plein && <path d="M6 1.6 L6 10.4" stroke="#15110E" strokeWidth="1" strokeOpacity="0.55" />}
    </svg>
  )
}
