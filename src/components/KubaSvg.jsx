// ═══════════════════════════════════════════════════════════
// 🧶 LE VELOURS KUBA — le vocabulaire visuel de la reconnaissance faciale
//
// Le royaume kuba (Kasaï, RDC) tisse le raphia en velours : des losanges
// imbriqués, des chevrons, une trame serrée, sur un fond de terre brune,
// d'écru et d'ocre. On garde ici le geste — le losange concentrique, la
// bordure en chevrons, la trame — et une palette resserrée sur trois tons.
//
// ⚠️ Interprétation contemporaine, pas reproduction : ce blason identifie
//    la page, il ne prétend pas reproduire un tissu précis.
//
// La page reprend aussi le motif du bandeau (`planning-kuba.webp`) par
// `PageCulturalBand` : le blason est son signet, pas son remplaçant.
// ═══════════════════════════════════════════════════════════

const TERRE = '#241a12'
const RAPHIA = '#c98a4b'
const RAPHIA_CLAIR = '#e0ad6a'
const ECRU = '#e8d4b0'

/**
 * Le blason : un losange concentrique dans un carré bordé de chevrons.
 * Il vit dans l'en-tête de la page, à côté du titre.
 */
export function KubaEmblemeSvg({ size = 48, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="50" height="50" rx="2" fill={TERRE} stroke={RAPHIA} strokeOpacity="0.6" />
      {/* la bordure en chevrons, aux quatre angles */}
      <path
        d="M7 15 13 7h8M45 15 39 7h-8M7 37l6 8h8M45 37l-6 8h-8"
        stroke={RAPHIA_CLAIR}
        strokeWidth="1.6"
        strokeLinecap="square"
      />
      {/* trois losanges, du plus large au plus étroit */}
      <path d="M26 7 45 26 26 45 7 26Z" fill="none" stroke={ECRU} strokeOpacity="0.9" strokeWidth="1.4" />
      <path d="M26 12 40 26 26 40 12 26Z" fill={RAPHIA} fillOpacity="0.24" stroke={RAPHIA} strokeWidth="1.2" />
      <path d="M26 18 34 26 26 34 18 26Z" fill={RAPHIA} />
      <path d="M26 22 30 26 26 30 22 26Z" fill={TERRE} />
      {/* la trame : quatre fils qui traversent le losange */}
      <path
        d="M26 2v5M26 45v5M2 26h5M45 26h5"
        stroke={RAPHIA_CLAIR}
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
    </svg>
  )
}

export default KubaEmblemeSvg
