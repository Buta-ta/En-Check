/*  L'HORLOGE GRAVÉE — décorative, et maintenant VIVANTE (25/11).

    Elle était un seul tracé fixe : `M60 30v30l20 12`, une aiguille des heures
    et une des minutes soudées dans la même instruction. On ne peut pas faire
    tourner deux chemins qui n'en font qu'un. Les aiguilles sont donc deux
    groupes, chacune pivotant autour du même axe (60,60), à des vitesses
    différentes — l'heure fait le tour en 12 h, la minute en 1 h, comme une
    vraie horloge. Le balancier du haut et le carillon sont animés par la
    feuille de style, pas ici : le dessin reste du dessin.

    ⚠️ `aria-hidden` et AUCUN texte : c'est une vignette, pas une mesure. Le
    test de signature le vérifie (`retardsSignature.test.jsx`).
    ⚠️ L'animation s'arrête net pour qui a demandé « moins d'animation »
    (`prefers-reduced-motion`) — voir Retards.css. */

export default function RetardsEngraving({ className = '' }) {
  return (
    <svg
      className={`rt-engraving ${className}`}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="57" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth=".7" />
      <circle cx="60" cy="60" r="42" stroke="currentColor" strokeWidth=".7" />
      {Array.from({ length: 24 }, (_, i) => (
        <path
          key={i}
          d={i % 2 ? 'M60 12v3' : 'M60 10v6'}
          stroke="currentColor"
          strokeWidth={i % 2 ? '.7' : '1.5'}
          transform={`rotate(${i * 15} 60 60)`}
        />
      ))}

      {/*  L'aiguille des heures : courte et épaisse. Elle tourne en 12 h.
          `transform-box: view-box` + `transform-origin: 60px 60px` viennent
          de la feuille — sans eux, le SVG ferait tourner autour du coin. */}
      <g className="rt-engraving-heures">
        <path
          d="M60 60V34"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </g>

      {/*  L'aiguille des minutes : longue et fine, un tour par heure. */}
      <g className="rt-engraving-minutes">
        <path
          d="M60 60V25"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>

      {/*  La trotteuse : un trait d'encre, un tour par minute. Elle est le
          seul mouvement continu de la vignette — c'est elle qui fait qu'on
          voit tout de suite que l'horloge est vivante. */}
      <g className="rt-engraving-secondes">
        <path
          d="M60 66V22"
          stroke="currentColor"
          strokeWidth=".9"
          strokeLinecap="round"
        />
      </g>

      {/* le noyau passe PAR-DESSUS les aiguilles : c'est lui qui les tient */}
      <circle cx="60" cy="60" r="4" fill="currentColor" />
      <circle cx="60" cy="60" r="1.4" fill="var(--rt-fiche)" />

      {/* les quatre fermoirs aux points cardinaux */}
      <path
        d="m60 2 3 4-3 4-3-4Zm58 58-4 3-4-3 4-3ZM60 118l-3-4 3-4 3 4ZM2 60l4-3 4 3-4 3Z"
        fill="currentColor"
      />
    </svg>
  )
}
