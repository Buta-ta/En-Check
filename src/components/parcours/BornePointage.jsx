// ═══════════════════════════════════════════════════════════
// 🕗 LA BORNE DE POINTAGE — forme « colonne », comme les vraies
//
// Ses reproches du 23/11 : « la borne est mal faite surtout l'empreinte
// digitale et le texte ne se lit pas bien car rétréci ».
//
// Le calcul, fait AVANT de dessiner : pour que « maintenant… » tienne
// sur une ligne à 12 px, il faut ~73 px de large libre. Avec 8 px de
// rembourrage de chaque côté, 3 px de contour et 6 px dans l'écran, la
// borne doit donc faire au moins 150 px de large. À 128, le mot se
// cassait en quatre. C'est pour ça qu'il ne se lisait pas.
//
// Le texte est écrit sur DEUX lignes fixes, chacune insécable : il ne
// peut plus se casser au milieu d'un mot.
// ═══════════════════════════════════════════════════════════

/** l'empreinte : trois arcs bien espacés et une boucle — lisible à 40 px */
export function EmpreinteDigitale({ className = '' }) {
  const arcs = [
    { r: 22, w: 3.6 },
    { r: 15, w: 3.4 },
    { r: 8.5, w: 3.2 },
  ]
  return (
    <svg className={className} viewBox="0 0 56 40" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={`M ${28 - arc.r} 33 A ${arc.r} ${arc.r * 0.92} 0 0 1 ${28 + arc.r} 33`}
            strokeWidth={arc.w}
          />
        ))}
        {/* la boucle du centre, ouverte vers le bas */}
        <path d="M 23.5 33 A 4.5 4.9 0 0 1 32.5 33" strokeWidth={3.2} />
      </g>
    </svg>
  )
}

export default function BornePointage({ taille = 150, className = '' }) {
  return (
    <div className={`borne ${className}`.trim()} style={{ '--borne-taille': `${taille}px` }}>
      <div className="borne-fut">
        <div className="borne-ecran">
          <span className="borne-ecran-mot">
            <span>Et</span>
            <span>maintenant…</span>
          </span>
          <EmpreinteDigitale className="borne-empreinte" />
        </div>
        <span className="borne-corps" aria-hidden="true" />
      </div>

      <span className="borne-pied" aria-hidden="true" />
      <span className="borne-mot">Borne de pointage</span>
    </div>
  )
}
