// ═══════════════════════════════════════════════════════════
// 🟤 LE BANDEAU BOGOLAN D'UNE CARTE EMPLOYÉ
//
// Le bogolan (« tissu de boue », Mali) ne s'improvise pas : il se
// lit par bandes horizontales qui alternent des rangées de motifs
// très denses — losanges pleins, créneaux en escalier, croix,
// pointillés — séparées par des filets.
//
// La version du 19/11 au matin était fausse : quatre petits
// chevrons très pâles, largement espacés. On ne reconnaissait ni
// le tissu ni le Mali. Celle-ci pose des bandes pleines, motif
// serré, contraste franc, puis s'estompe avant le nom.
//
// Le motif est DESSINÉ : net à toutes les tailles, aucun fichier
// à charger, et il s'efface pour que le texte ne s'y pose jamais.
// ═══════════════════════════════════════════════════════════

import { useId } from 'react'

const CUIVRE = '#A26537'
const ESPRESSO = '#2A1708'
const IVOIRE = '#FBF4E9'

/**
 * @param hauteur  hauteur du bandeau, en pixels
 * @param vers     côté où le motif s'efface : 'droite' (défaut) ou 'gauche'
 */
export default function BandeauBogolan({ hauteur = 112, vers = 'droite', className = '' }) {
  const id = useId().replace(/:/g, '')
  const sens = vers === 'gauche' ? 1 : 0
  const h = hauteur

  // Trois bandes de motif, séparées par des filets : c'est la structure
  // du vrai bogolan, et ce qui le rend reconnaissable.
  const bande = h / 3

  const losange = (cx, cy, r) => `M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`
  const escalier = (x, cy, unite, pas) => {
    // un créneau : montée, plateau, descente — répété par le motif
    const p = []
    for (let i = 0; i < pas; i += 1) {
      const x0 = x + i * unite * 2
      p.push(`M${x0} ${cy + unite} L${x0} ${cy} L${x0 + unite} ${cy} L${x0 + unite} ${cy - unite} L${x0 + unite * 2} ${cy - unite} L${x0 + unite * 2} ${cy + unite}`)
    }
    return p.join(' ')
  }

  return (
    <svg
      className={className}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-testid="bandeau-bogolan"
      style={{ display: 'block' }}
    >
      <defs>
        <pattern id={`bande-${id}`} width="64" height={h} patternUnits="userSpaceOnUse">
          {/* le tissu : ivoire, avec une trame de cuivre très pâle */}
          <rect width="64" height={h} fill={IVOIRE} />
          <rect width="64" height={h} fill={CUIVRE} opacity="0.06" />

          {/* ── bande 1 : losanges pleins et croix ── */}
          <g>
            <path d={losange(16, bande * 0.5, 11)} fill={CUIVRE} />
            <path d={losange(16, bande * 0.5, 5)} fill={IVOIRE} />
            <path d={losange(48, bande * 0.5, 11)} fill={ESPRESSO} />
            <path d={losange(48, bande * 0.5, 5)} fill={IVOIRE} />
            {/* croix entre les losanges */}
            <g stroke={ESPRESSO} strokeWidth="2.4" strokeLinecap="square">
              <line x1="30" y1={bande * 0.2} x2="34" y2={bande * 0.8} />
              <line x1="34" y1={bande * 0.2} x2="30" y2={bande * 0.8} />
            </g>
          </g>

          {/* filet de séparation, plein */}
          <rect x="0" y={bande - 1.5} width="64" height="3" fill={ESPRESSO} />

          {/* ── bande 2 : créneaux en escalier ── */}
          <g stroke={CUIVRE} strokeWidth="3" fill="none" strokeLinejoin="miter">
            <path d={escalier(2, bande + bande * 0.5, 5, 6)} />
          </g>
          {/* points pleins dans les creux */}
          <g fill={ESPRESSO}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <circle key={i} cx={6 + i * 8} cy={bande * 2 - 6} r="1.8" />
            ))}
          </g>

          {/* filet pointillé */}
          <g fill={ESPRESSO} opacity="0.75">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <rect key={i} x={i * 6 + 1} y={bande * 2 - 1} width="3" height="2.5" />
            ))}
          </g>

          {/* ── bande 3 : grille de points et petits losanges ── */}
          <g>
            <path d={losange(16, bande * 2.5, 9)} fill="none" stroke={ESPRESSO} strokeWidth="2.4" />
            <path d={losange(16, bande * 2.5, 3.5)} fill={ESPRESSO} />
            <path d={losange(48, bande * 2.5, 9)} fill="none" stroke={CUIVRE} strokeWidth="2.4" />
            <path d={losange(48, bande * 2.5, 3.5)} fill={CUIVRE} />
            <g fill={CUIVRE}>
              <circle cx="32" cy={bande * 2.28} r="2" />
              <circle cx="32" cy={bande * 2.72} r="2" />
            </g>
          </g>
        </pattern>

        {/* l'estompage : le tissu reste dense à gauche, le papier gagne à droite */}
        <linearGradient id={`voile-${id}`} x1={sens} y1="0" x2={1 - sens} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.34" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.58" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.78" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        <mask id={`masque-${id}`}>
          <rect width="100%" height="100%" fill={`url(#voile-${id})`} />
        </mask>
      </defs>

      <rect width="100%" height="100%" fill={`url(#bande-${id})`} mask={`url(#masque-${id})`} />
    </svg>
  )
}
