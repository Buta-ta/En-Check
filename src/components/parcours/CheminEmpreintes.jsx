// ═══════════════════════════════════════════════════════════
// 👣 LE CHEMIN — des traces minuscules qui serpentent
//
// Sa demande : « un chemin serpenté de petites traces minuscules
// de pieds humains ». Le tracé passe DERRIÈRE le contenu : on ne
// le voit que dans les espaces libres, les gouttières et les
// marges. Il ne capture aucun clic (pointer-events: none).
//
// Le chemin est calculé en pourcentage de la hauteur : il suit
// donc la page quelle que soit sa longueur.
// ═══════════════════════════════════════════════════════════

const PIED = 'M0,-5.2 C2.4,-5.2 3.4,-3 2.9,-0.4 C2.4,2 0.9,3.2 0,5.4 C-0.9,3.2 -2.4,2 -2.9,-0.4 C-3.4,-3 -2.4,-5.2 0,-5.2 Z'

export default function CheminEmpreintes({ nombre = 46, className = '' }) {
  const traces = Array.from({ length: nombre }, (_, i) => {
    const t = i / (nombre - 1)

    // serpent : deux sinusoïdes décalées, pour un vrai S et non un zigzag
    const x = 50 + Math.sin(t * Math.PI * 3.1) * 34 + Math.sin(t * Math.PI * 7.3) * 4
    const gauche = i % 2 === 0

    return {
      x,
      y: 4 + t * 92,
      rotation: Math.sin(t * Math.PI * 3.1) > 0 ? 12 : -12,
      gauche,
      taille: 0.9 + (i % 3) * 0.05,
    }
  })

  return (
    <svg
      className={`chemin-empreintes ${className}`.trim()}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {traces.map((trace, i) => (
        <path
          key={i}
          d={PIED}
          fill="currentColor"
          transform={`translate(${trace.x} ${trace.y}) rotate(${trace.rotation}) scale(${trace.taille}) translate(${trace.gauche ? -3 : 3} 0)`}
          opacity={0.55 + (i % 4) * 0.08}
        />
      ))}
    </svg>
  )
}
