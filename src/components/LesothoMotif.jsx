// ═══════════════════════════════════════════════════════════
// 🧶 LE MOTIF DU LESOTHO — le vocabulaire visuel de Jours fériés
//
// La couverture de laine du Lesotho : un champ de crème, encadré
// de bandes indigo tissées en chevrons, traversé d'un liseré de
// terre cuite. Sur le champ, des losanges et des flèches brodés
// en frise — les mêmes signes, répétés, d'un bord à l'autre.
//
// ⚠️ Interprétation contemporaine, pas reproduction : on garde le
//    geste — le champ, la lisière, le losange, la couture — et une
//    palette resserrée sur l'indigo, la terre et la crème.
//
// Le bandeau de la page reste l'image `pauses-lesotho.webp` : c'est
// la même identité, tissée une fois pour toutes dans le produit.
// Ces pièces-ci sont les objets de la page — le sceau, les
// médaillons de date, la couture entre les registres.
// ═══════════════════════════════════════════════════════════

const INDIGO_NUIT = '#0a1a2c'
const INDIGO = '#14263c'
const INDIGO_CLAIR = '#1d3752'
const TERRE = '#b4622a'
const TERRE_FONCE = '#8b3e1d'
const CRAIE = '#efe7d7'
const CRAIE_DOUCE = '#d8cbb2'

const TEINTES = {
  indigo: { fond: INDIGO, trait: INDIGO_CLAIR, signe: CRAIE, coeur: TERRE },
  terre: { fond: TERRE_FONCE, trait: TERRE, signe: CRAIE, coeur: INDIGO_NUIT },
  craie: { fond: CRAIE, trait: CRAIE_DOUCE, signe: INDIGO, coeur: TERRE },
}

/**
 * Le sceau de la page : un losange dans un losange, et la frise de
 * flèches qui court sur la lisière. `taille` en pixels.
 */
export function LesothoSceauSvg({ taille = 48, ton = 'terre', className = '' }) {
  const t = TEINTES[ton] || TEINTES.terre

  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 52 52"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* la lisière tissée, en haut et en bas */}
      <path d="M2 5h48M2 47h48" stroke={t.trait} strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M4 5l3 3 3-3M13 5l3 3 3-3M22 5l3 3 3-3M31 5l3 3 3-3M40 5l3 3 3-3M4 47l3-3 3 3M13 47l3-3 3 3M22 47l3-3 3 3M31 47l3-3 3 3M40 47l3-3 3 3"
        stroke={t.signe}
        strokeWidth="1"
        strokeOpacity="0.55"
      />

      {/* le losange extérieur */}
      <path d="M26 7 45 26 26 45 7 26Z" fill={t.fond} stroke={t.trait} strokeWidth="1.6" strokeLinejoin="round" />
      {/* le champ crème */}
      <path d="M26 14 38 26 26 38 14 26Z" fill={CRAIE} />
      {/* le losange intérieur */}
      <path d="M26 18 34 26 26 34 18 26Z" fill="none" stroke={t.coeur} strokeWidth="1.6" />
      {/* la couture : quatre points aux angles */}
      <g fill={t.coeur}>
        <circle cx="26" cy="24" r="1.1" />
        <circle cx="26" cy="28" r="1.1" />
        <circle cx="24" cy="26" r="1.1" />
        <circle cx="28" cy="26" r="1.1" />
      </g>
    </svg>
  )
}

/**
 * Le cadre d'un médaillon de date : un losange brodé, vide au centre.
 * Le jour et le mois sont écrits en HTML par-dessus (texte net,
 * lisible par les lecteurs d'écran).
 */
export function LesothoLosangeSvg({ taille = 58, ton = 'terre', className = '' }) {
  const t = TEINTES[ton] || TEINTES.terre

  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M32 2 62 32 32 62 2 32Z" fill={t.fond} />
      <path d="M32 6 58 32 32 58 6 32Z" fill="none" stroke={t.trait} strokeWidth="1.2" strokeOpacity="0.8" />
      <path d="M32 10 54 32 32 54 10 32Z" fill={CRAIE} />
      {/* la couture du pourtour : un point tous les huit pixels */}
      <path
        d="M32 6v4M32 54v4M6 32h4M54 32h4M14 14l2.6 2.6M50 14l-2.6 2.6M14 50l2.6-2.6M50 50l-2.6-2.6"
        stroke={t.coeur}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.65"
      />
    </svg>
  )
}

/**
 * La couture entre deux registres : une ligne piquée, et des losanges
 * qui la rythment. Elle s'étire sans se déformer.
 */
export function LesothoCoutureSvg({ className = '', ton = 'craie' }) {
  const t = TEINTES[ton] || TEINTES.craie

  return (
    <svg
      className={className}
      viewBox="0 0 240 10"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 5h240" stroke={t.signe} strokeWidth="1" strokeDasharray="5 5" strokeOpacity="0.5" />
      <path d="M60 1.5 64 5l-4 3.5L56 5Z" fill={t.signe} fillOpacity="0.7" />
      <path d="M120 1.5 124 5l-4 3.5L116 5Z" fill={t.signe} fillOpacity="0.7" />
      <path d="M180 1.5 184 5l-4 3.5L176 5Z" fill={t.signe} fillOpacity="0.7" />
    </svg>
  )
}

/**
 * Une frise de lisière : chevrons et losanges, comme la bordure de la
 * couverture. Sert de fond discret à un panneau ou à un en-tête.
 */
export function LesothoLisiereSvg({ className = '', hauteur = 18, ton = 'indigo' }) {
  const t = TEINTES[ton] || TEINTES.indigo

  return (
    <svg
      className={className}
      viewBox="0 0 160 18"
      height={hauteur}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="160" height="18" fill={t.fond} />
      <path d="M0 2.5h160M0 15.5h160" stroke={t.signe} strokeWidth="0.9" strokeOpacity="0.5" />
      <path
        d="M4 6l4 3-4 3M12 6l4 3-4 3M20 6l4 3-4 3M28 6l4 3-4 3M36 6l4 3-4 3M68 6l4 3-4 3M76 6l4 3-4 3M84 6l4 3-4 3M92 6l4 3-4 3M100 6l4 3-4 3M132 6l4 3-4 3M140 6l4 3-4 3M148 6l4 3-4 3"
        stroke={t.signe}
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />
      <path d="M50 9 55 4l5 5-5 5Z" fill={TERRE} />
      <path d="M114 9 119 4l5 5-5 5Z" fill={TERRE} />
    </svg>
  )
}

export default LesothoSceauSvg
