// ═══════════════════════════════════════════════════════════
// 👣 LE CHEMIN — des traces minuscules qui serpentent
//
// DEUX ERREURS CORRIGÉES ICI, toutes deux visibles à l'écran :
//
// 1. Un SVG de 100×100 étiré sur toute la page → chaque trace
//    devenait une tache de 200 px. C'étaient les « auréoles » de
//    sa capture. Corrigé : un MOTIF en pixels (132 × 260).
//
// 2. `<use x="58" y="4" transform="rotate(-8 58 4)">` — le
//    décalage de <use> s'applique AVANT la rotation, et la
//    rotation tourne donc autour d'un point vide : la trace
//    revenait à l'origine, empilée sur les autres. Vérifié par
//    le calcul : un pied posé en (3.5, 6) ressortait en (4.3,
//    13.6) au lieu de (61, 10). Corrigé : `translate` puis
//    `rotate` autour de 0,0, sans attribut x/y.
// ═══════════════════════════════════════════════════════════

// une trace de pied : 11 px de haut, 7 px de large, centrée sur 0,0
const TRACE = 'M0.9 -4.8 C2.6 -4.8 3.4 -3.4 3.2 -1.9 C3 -0.6 2.4 0.2 2 1.4 C1.7 2.6 1.9 3.8 1.9 4.8 C1.9 5.4 1 5.6 0.4 5.6 C-0.2 5.6 -1.1 5.4 -1.1 4.8 C-1.1 3.8 -0.9 2.6 -1.2 1.4 C-1.6 0.2 -2.2 -0.6 -2.4 -1.9 C-2.6 -3.4 -1.8 -4.8 0.9 -4.8 Z'

// le petit orteil, séparé du talon : c'est lui qui fait « pied »
const ORTEIL = 'M1.1 -7.5 C2.3 -7.5 2.8 -6.9 2.8 -6.2 C2.8 -5.5 2.2 -5.1 1.1 -5.1 C0.1 -5.1 -0.5 -5.5 -0.5 -6.2 C-0.5 -6.9 0 -7.5 1.1 -7.5 Z'

export default function CheminEmpreintes({ opacite = 0.5, className = '' }) {
  // le tracé descend en S dans une bande de 132 px de large
  const pas = []
  for (let i = 0; i < 18; i += 1) {
    const y = 8 + i * 14
    // ⚠️ le sinus doit valoir 0 aux DEUX bouts de la tuile, sinon le tracé
    // saute d'une tuile à l'autre (vérifié à l'image). Un tour complet règle ça.
    const phase = (i / 17) * Math.PI * 2
    const x = 54 + Math.sin(phase) * 26
    pas.push({ x, y, angle: Math.cos(phase) > 0 ? 7 : -7 })
  }

  return (
    <svg
      className={`chemin-empreintes ${className}`.trim()}
      viewBox="0 0 132 260"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: opacite }}
    >
      <defs>
        <pattern id="motif-traces" width="132" height="260" patternUnits="userSpaceOnUse">
          <g fill="#A26537">
            {pas.map((trace, i) => (
              <g key={i} transform={`translate(${trace.x.toFixed(1)} ${trace.y}) rotate(${trace.angle})`}>
                <path d={TRACE} />
                <path d={ORTEIL} />
              </g>
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="132" height="100%" fill="url(#motif-traces)" />
    </svg>
  )
}
