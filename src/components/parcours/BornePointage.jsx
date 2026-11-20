import EmpreinteDigitale from './EmpreinteDigitale'

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
