// ═══════════════════════════════════════════════════════════
// 🪧 LA PANCARTE — un carré sur une tige, comme un tableau
//
// Sa demande du 20/11 : « pancarte est un carré + une tige comme un
// tableau ». Modèle V2 validé : carré ivoire sur poteau, deux clous,
// un fil de cuivre tendu, un monticule de terre.
//
// Sa demande du 22/11 : dans la pancarte du haut, « dessine un cahier
// avec un signe de check pour illustrer le pointage par cahier » et
// « tu écris dedans "Avant…" ». Le cahier est donc un motif, et le
// mot du cahier est du VRAI texte : il se lit, et il grossit avec la
// préférence du système.
// ═══════════════════════════════════════════════════════════

const CUIVRE = '#A26537'
const ESPRESSO = '#2A1708'
const TAN = '#E5D4C0'
const IVOIRE = '#FFFDF7'

/** le pied de marque — le vrai logo, dessiné sans dégradé (charte) */
function PiedDeMarque() {
  return (
    <svg className="pancarte-logo" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="48" fill={TAN} stroke={CUIVRE} strokeWidth="3" />
      <g fill={ESPRESSO} fillOpacity="0.88">
        <path d="M 30.5 44.5 C 27 51.5 28 58.5 32.5 62.5 C 39.5 67.5 40.5 73.5 39.5 81 C 38.5 87.5 41.5 92.5 49.5 93 C 56.5 93.5 60.5 88.5 63 80.5 C 66 71 69.5 63.5 72 56.5 C 74 50.5 72.5 45.5 68.5 44 C 62.5 46.5 56 49.5 49.5 50.5 C 42.5 50.5 35.5 48 30.5 44.5 Z" />
        <ellipse cx="35" cy="31.5" rx="7.8" ry="10.8" transform="rotate(-6 35 31.5)" />
        <ellipse cx="48" cy="27.5" rx="5.8" ry="8.8" transform="rotate(-2 48 27.5)" />
        <ellipse cx="59.8" cy="29.8" rx="5.2" ry="7.8" transform="rotate(5 59.8 29.8)" />
        <ellipse cx="69.8" cy="34.2" rx="4.7" ry="6.8" transform="rotate(11 69.8 34.2)" />
        <ellipse cx="77.8" cy="40.5" rx="4.2" ry="5.8" transform="rotate(17 77.8 40.5)" />
      </g>
    </svg>
  )
}

/** le cahier de pointage, ouvert, avec sa coche */
function CahierDePointage() {
  return (
    <span className="pancarte-cahier">
      <svg viewBox="0 0 100 76" aria-hidden="true" focusable="false">
        {/* les deux pages */}
        <path d="M6 12 C22 6 40 6 50 12 L50 68 C40 62 22 62 6 68 Z" fill={IVOIRE} stroke={ESPRESSO} strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M94 12 C78 6 60 6 50 12 L50 68 C60 62 78 62 94 68 Z" fill={IVOIRE} stroke={ESPRESSO} strokeWidth="3.2" strokeLinejoin="round" />
        {/* la reliure à spirales */}
        <g stroke={ESPRESSO} strokeWidth="3" strokeLinecap="round">
          <path d="M50 12 L50 68" />
          <path d="M30 9 L30 17" />
          <path d="M40 7 L40 15" />
          <path d="M60 7 L60 15" />
          <path d="M70 9 L70 17" />
        </g>
        {/* la coche, sur la page de droite */}
        <path d="M60 38 L67 47 L84 27" fill="none" stroke={CUIVRE} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        {/* deux lignes d'écriture, sur la page de gauche */}
        <g stroke={ESPRESSO} strokeWidth="2" strokeOpacity="0.35" strokeLinecap="round">
          <path d="M14 30 L38 30" />
          <path d="M14 40 L38 40" />
        </g>
      </svg>
    </span>
  )
}

/**
 * @param taille   largeur du carré, en pixels
 * @param compact  pour le pied de page : plus petit, sans la ligne du bas
 * @param motif    'pied' (l'identité) ou 'cahier' (le pointage d'avant)
 */
export default function PancarteEnseigne({ taille = 88, compact = false, motif = 'pied', className = '' }) {
  const ratio = compact ? 1.12 : 1.45
  const hauteur = Math.round(taille * ratio)
  const poteau = Math.max(5, Math.round(taille * 0.075))
  const base = Math.round(taille * 0.22)
  const cahier = motif === 'cahier'

  return (
    <div
      className={`pancarte${compact ? ' pancarte--compacte' : ''}${cahier ? ' pancarte--cahier' : ''} ${className}`.trim()}
      style={{ '--pancarte-taille': `${taille}px`, '--pancarte-hauteur': `${hauteur}px` }}
    >
      <div className="pancarte-panneau">
        <svg className="pancarte-fil" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M4 2 Q50 11 96 2" fill="none" stroke={CUIVRE} strokeWidth="1.4" strokeLinecap="round" />
        </svg>

        <span className="pancarte-clou pancarte-clou--gauche" aria-hidden="true" />
        <span className="pancarte-clou pancarte-clou--droite" aria-hidden="true" />

        {cahier ? <CahierDePointage /> : <PiedDeMarque />}

        <span className="pancarte-marque">EN-CHECK</span>

        {cahier ? (
          <span className="pancarte-mot">Avant…</span>
        ) : (
          <span className="pancarte-slogan">
            <i className="pancarte-losange" aria-hidden="true" />
            On gère !
          </span>
        )}

        {!compact && !cahier && (
          <span className="pancarte-sous">Gestion du personnel</span>
        )}
      </div>

      <div className="pancarte-poteau" style={{ height: `${base}px`, width: `${poteau}px` }} aria-hidden="true">
        <span className="pancarte-plaque" />
        <svg className="pancarte-terre" viewBox="0 0 60 14" preserveAspectRatio="none">
          <ellipse cx="30" cy="7" rx="28" ry="6" fill={CUIVRE} opacity="0.22" />
          <ellipse cx="30" cy="5" rx="19" ry="4" fill={CUIVRE} opacity="0.35" />
        </svg>
      </div>
    </div>
  )
}
