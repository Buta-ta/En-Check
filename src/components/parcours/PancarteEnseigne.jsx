// ═══════════════════════════════════════════════════════════
// 🪧 LA PANCARTE — un carré sur une tige, comme un tableau
//
// Sa demande du 20/11 : « pancarte est un carré + une tige comme
// un tableau ». Le modèle V2 validé : carré ivoire sur un poteau
// épais, deux clous et un fil de cuivre tendu entre eux, un
// monticule de terre à la base.
//
// Le logo est le vrai : le pied, dessiné ici à l'identique de
// `EnCheckBrandMark` mais sans dégradés (la charte n'en veut pas
// dans les pages). Le texte reste du HTML : il se lit, il se
// sélectionne, et il grossit avec la préférence du système.
// ═══════════════════════════════════════════════════════════

const CUIVRE = '#A26537'
const ESPRESSO = '#2A1708'
const IVOIRE = '#FBF4E9'
const TAN = '#E5D4C0'

/**
 * @param taille   largeur du carré, en pixels (84 sur desktop)
 * @param compact  pour le pied de page : plus petit, sans la ligne du bas
 */
export default function PancarteEnseigne({ taille = 84, compact = false, className = '' }) {
  const ratio = compact ? 1.12 : 1.6
  const hauteur = Math.round(taille * ratio)
  const poteau = Math.max(5, Math.round(taille * 0.075))
  const base = Math.round(taille * 0.22)

  return (
    <div
      className={`pancarte${compact ? ' pancarte--compacte' : ''} ${className}`.trim()}
      style={{ '--pancarte-taille': `${taille}px`, '--pancarte-hauteur': `${hauteur}px` }}
    >
      <div className="pancarte-panneau">
        {/* le fil de cuivre, d'un clou à l'autre */}
        <svg className="pancarte-fil" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M4 2 Q50 11 96 2" fill="none" stroke={CUIVRE} strokeWidth="1.4" strokeLinecap="round" />
        </svg>

        <span className="pancarte-clou pancarte-clou--gauche" aria-hidden="true" />
        <span className="pancarte-clou pancarte-clou--droite" aria-hidden="true" />

        {/* le pied : le vrai logo de la marque */}
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

        <span className="pancarte-marque">EN-CHECK</span>
        <span className="pancarte-slogan">
          <i className="pancarte-losange" aria-hidden="true" />
          On gère !
        </span>
        {!compact && (
          <span className="pancarte-sous">Gestion du personnel</span>
        )}
      </div>

      {/* le poteau, sa plaque de base et la terre */}
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
