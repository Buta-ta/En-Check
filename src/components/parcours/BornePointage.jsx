// ═══════════════════════════════════════════════════════════
// 🕗 LA BORNE DE POINTAGE — forme « colonne », comme les vraies
//
// Sa demande du 22/11 : « fais une borne avec cette forme » (une
// colonne sur socle, écran en haut) et « l'empreinte digitale est mal
// faite ».
//
// La forme : un fût vertical, un écran carré en haut, un pied plus
// large que le fût. Tout en HTML pour le cadre, en SVG pour la seule
// empreinte.
//
// L'empreinte : des demi-elliipses concentriques, calculées par
// formule — pas des courbes tracées à la main, qui donnaient des arcs
// de travers.
// ═══════════════════════════════════════════════════════════

/** une empreinte propre : des demi-ellipses concentriques + la boucle */
export function EmpreinteDigitale({ className = '' }) {
  const arcs = [26, 21, 16, 11]
  return (
    <svg className={className} viewBox="0 0 64 44" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {arcs.map((r, i) => (
          <path
            key={i}
            d={`M ${32 - r} 34 A ${r} ${r * 0.86} 0 0 1 ${32 + r} 34`}
            strokeWidth={i === 0 ? 3.2 : 3}
          />
        ))}
        {/* la boucle du centre, ouverte vers le bas */}
        <path d="M 27 34 A 5 5.6 0 0 1 37 34" strokeWidth={3} />
      </g>
    </svg>
  )
}

export default function BornePointage({ taille = 96, className = '' }) {
  return (
    <div className={`borne ${className}`.trim()} style={{ '--borne-taille': `${taille}px` }}>
      {/* le fût : toute la colonne */}
      <div className="borne-fut">
        {/* l'écran, en haut du fût */}
        <div className="borne-ecran">
          <span className="borne-ecran-mot">Et maintenant…</span>
          <EmpreinteDigitale className="borne-empreinte" />
        </div>

        {/* le corps du fût, avec son liseré */}
        <span className="borne-corps" aria-hidden="true" />
      </div>

      {/* le pied, plus large que le fût */}
      <span className="borne-pied" aria-hidden="true" />
      <span className="borne-mot">Borne de pointage</span>
    </div>
  )
}
