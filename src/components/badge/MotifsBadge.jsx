// ═══════════════════════════════════════════════════════════════
// LA BANDE DE LA CARTE — les vrais motifs, à la hauteur du badge
//
// Les bandeaux de page mesurent 76 px ; la carte en a 28. On ne
// redessine rien : on reprend l'image ou la frise du bandeau et on
// la pose à la hauteur de la carte. Un badge imprimé porte donc
// exactement le motif de la page dont il vient.
// ═══════════════════════════════════════════════════════════════

import { KenteWovenTapestrySvg } from '../AfroCulturalSvg'
import { DogonFriseSvg } from '../DogonSvg'
import { motifParId } from './motifs'

export const HAUTEUR_BANDE = 28

// les frises maison sont des SVG : elles prennent la largeur du cadre
const FRISES = {
  kente: KenteWovenTapestrySvg,
  dogon: DogonFriseSvg,
}

export function BandeMotif({ motif = 'perles', hauteur = HAUTEUR_BANDE, palette }) {
  const choix = motifParId(motif)

  if (!choix || choix.id === 'aucun') {
    return (
      <div
        aria-hidden="true"
        data-motif="aucun"
        style={{
          width: '100%',
          height: `${hauteur}px`,
          borderTop: `1px solid ${palette?.filets || 'rgba(60, 40, 22, 0.16)'}`,
        }}
      />
    )
  }

  if (choix.image) {
    return (
      <div
        aria-hidden="true"
        data-motif={choix.id}
        style={{
          width: '100%',
          height: `${hauteur}px`,
          backgroundImage: `url(${choix.image})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 100%',
        }}
      />
    )
  }

  const Frise = FRISES[choix.svg]
  return (
    <div
      aria-hidden="true"
      data-motif={choix.id}
      className="bge-bande-svg"
      style={{ width: '100%', height: `${hauteur}px`, overflow: 'hidden', lineHeight: 0 }}
    >
      <Frise />
    </div>
  )
}
