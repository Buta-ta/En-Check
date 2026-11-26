/*  LE PIED GRAVÉ — l'illustration du bandeau Pauses (maquette B, 26/11).

    Ce n'est PAS la petite marque de l'application : la maquette montre une
    **empreinte de pied vue de dessus**, haute et étroite — le talon en bas
    à gauche, la voûte qui rentre au milieu, le gros orteil en haut et les
    cinq orteils en éventail vers la droite. Le contour est doublé (deux
    traits parallèles), comme une gravure repassée deux fois.

    On le dessine ici, à part, pour ne pas déformer la marque officielle —
    `EnCheckBrandMark` sert partout ailleurs et n'a pas à changer de dessin.

    ⚠️ LE TRACÉ N'EST PAS INVENTÉ : il est relevé colonne par colonne sur
    `image-23.png`. Le pied y occupe exactement 67 × 114 px à (183,105), et
    voici son bord gauche et son bord droit mesurés tous les 6 px :

      y     0   6  12  18  24  30  36  42  48  54  60  66  72  78  84  90  96 102 108
      g    12  19  11   8   7   7   9  12  14  16  21  19  15   8   3   1   0   2   7
      d    51  60  64  66  56  59  61  61  60  57  55  52  49  46  44  42  40  37  32

    Le `g` du haut est le gros orteil, pas la sole : la sole commence vers
    y=26. C'est ce qui donne la forme : un talon rond en bas à gauche, une
    taille étranglée à mi-hauteur, et une plante qui s'élargit vers les
    orteils. */

export default function PiedGrave({ className = '' }) {
  /*  La sole — un trait continu qui suit le relevé ci-dessus. On part du
      haut (sous le gros orteil), on descend le bord droit jusqu'au talon,
      puis on remonte le bord gauche en repassant par l'étranglement. */
  const sole =
    'M 20 27 ' +                      // sous le gros orteil
    'C 26 22 34 20 42 21 ' +          // la plante, vers le haut
    'C 49 22 54 25 56 31 ' +          // la naissance des orteils
    'C 58 37 60 42 61 48 ' +          // le bord droit s'élargit
    'C 58 56 55 62 52 68 ' +          // il redescend en pente douce
    'C 49 74 46 80 44 86 ' +          // vers le talon
    'C 42 92 40 98 37 104 ' +
    'C 33 109 27 112 21 112 ' +       // le talon, ovale en bas
    'C 14 112 8 109 4 105 ' +
    'C 1 101 0 96 1 91 ' +            // le coin bas-gauche
    'C 2 85 5 80 9 76 ' +
    'C 13 72 17 69 19 64 ' +          // la voûte remonte
    'C 21 59 20 55 17 51 ' +          // l'étranglement (l'S)
    'C 14 47 13 42 14 37 ' +
    'C 15 32 17 29 20 27 Z'

  return (
    <svg
      className={className}
      viewBox="0 0 67 114"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* le double trait : la même sole, deux fois, à 1,8 px d'écart */}
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={sole} />
        <path d={sole} transform="translate(1.8 1.4) scale(0.972)" transform-origin="30 66" />
      </g>

      {/*  Les cinq orteils — mesurés sur la maquette : le gros à gauche
          (le plus gros, incliné), puis quatre pastilles de plus en plus
          petites, qui descendent vers la droite. */}
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <ellipse cx="15" cy="13" rx="10" ry="8" transform="rotate(-12 15 13)" />
        <ellipse cx="33" cy="6" rx="6.8" ry="5.8" transform="rotate(-8 33 6)" />
        <ellipse cx="45" cy="5.5" rx="5.6" ry="5.2" transform="rotate(2 45 5.5)" />
        <ellipse cx="54.5" cy="9.5" rx="4.8" ry="4.6" transform="rotate(12 54.5 9.5)" />
        <ellipse cx="61" cy="16.5" rx="4" ry="3.9" transform="rotate(22 61 16.5)" />
      </g>
    </svg>
  )
}
