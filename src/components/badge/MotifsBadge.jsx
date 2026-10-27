// ═══════════════════════════════════════════════════════════════
// LES MOTIFS DE LA CARTE — une bande tissée sous le bandeau
//
// Sept écritures, dessinées en SVG : des perles, un kente, un aso
// oke, un bogolan, un ndebele, un dogon — ou rien, un simple filet.
//
// Le motif ne décore pas la carte : il dit d'où vient la maison.
// Il est tracé à la couleur de l'entreprise, dans ses valeurs
// claires et foncées, pour rester lisible quelle que soit la
// couleur choisie.
// ═══════════════════════════════════════════════════════════════

import { estMotif } from './motifs'

function formesDe(motif, palette, largeur, hauteur) {
  const { accent, accentTexte, perleA, perleB, papier } = palette
  const formes = []
  const milieu = hauteur / 2

  if (motif === 'aucun') {
    return [<line key="filet" x1="0" y1={hauteur - 0.6} x2={largeur} y2={hauteur - 0.6} stroke={accent} strokeWidth="0.8" />]
  }

  if (motif === 'perles') {
    for (let x = 4, i = 0; x < largeur; x += 7.5, i += 1) {
      formes.push(<circle key={`p-${x}`} cx={x} cy={milieu} r="1.5" fill={i % 2 === 0 ? perleA : perleB} />)
    }
    return formes
  }

  if (motif === 'kente') {
    const cycle = [accent, accentTexte, perleA, papier]
    for (let ligne = 0; ligne < 2; ligne += 1) {
      for (let x = 0, i = 0; x < largeur; x += 4.5, i += 1) {
        formes.push(
          <rect
            key={`k-${ligne}-${x}`}
            x={x}
            y={ligne * (hauteur / 2)}
            width="4.5"
            height={hauteur / 2}
            fill={cycle[(i + ligne) % cycle.length]}
          />
        )
      }
    }
    return formes
  }

  if (motif === 'aso-oke') {
    for (let x = 2; x < largeur; x += 7) {
      formes.push(<rect key={`a-${x}`} x={x} y="0" width="2.6" height={hauteur} fill={accent} />)
      formes.push(<rect key={`a2-${x}`} x={x + 3.4} y={milieu - 1} width="1.2" height="2" fill={accentTexte} />)
    }
    return formes
  }

  if (motif === 'bogolan') {
    for (let x = 1, i = 0; x < largeur; x += 7, i += 1) {
      formes.push(<rect key={`b-${x}`} x={x} y="1.3" width="3.2" height="3.2" fill={i % 2 === 0 ? accent : accentTexte} />)
      formes.push(<rect key={`b2-${x}`} x={x + 3.5} y="5.5" width="3.2" height="3.2" fill={i % 2 === 0 ? accentTexte : accent} />)
    }
    return formes
  }

  if (motif === 'ndebele') {
    for (let x = 0, i = 0; x < largeur; x += 9, i += 1) {
      formes.push(
        i % 2 === 0
          ? <polygon key={`n-${x}`} points={`${x},${hauteur} ${x + 4.5},0 ${x + 9},${hauteur}`} fill={accent} />
          : <polygon key={`n-${x}`} points={`${x},0 ${x + 4.5},${hauteur} ${x + 9},0`} fill={accentTexte} />
      )
    }
    return formes
  }

  // dogon : une grille de cases
  for (let ligne = 0; ligne < 2; ligne += 1) {
    for (let x = 1, i = 0; x < largeur; x += 5, i += 1) {
      formes.push(
        <rect
          key={`d-${ligne}-${x}`}
          x={x}
          y={1.2 + ligne * 4.4}
          width="2.4"
          height="2.4"
          fill={(i + ligne) % 2 === 0 ? accent : accentTexte}
        />
      )
    }
  }
  return formes
}

export function BandeMotif({ motif = 'perles', palette, largeur = 300, hauteur = 10 }) {
  const choisi = estMotif(motif) ? motif : 'perles'
  const fond = choisi === 'aucun' ? palette.papier : palette.accentVoile
  return (
    <svg
      width={largeur}
      height={hauteur}
      viewBox={`0 0 ${largeur} ${hauteur}`}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <rect x="0" y="0" width={largeur} height={hauteur} fill={fond} />
      {formesDe(choisi, palette, largeur, hauteur)}
    </svg>
  )
}

