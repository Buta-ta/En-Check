// ═══════════════════════════════════════════════════════════
// 📈 L'ÉTINCELLE — la petite courbe d'une carte de chiffres
//
// Elle ne raconte jamais autre chose que la série qu'on lui passe :
// pas de série, pas de courbe. Une ligne, deux points minimum,
// l'étirement ne déforme pas le trait (vector-effect).
// ═══════════════════════════════════════════════════════════

export default function Etincelle({ valeurs = [], largeur = 220, hauteur = 28 }) {
  const serie = (valeurs || []).filter((v) => Number.isFinite(Number(v)))
  if (serie.length < 2) return null

  const nombres = serie.map(Number)
  const max = Math.max(...nombres)
  const min = Math.min(...nombres)
  const etendue = max - min || 1

  const points = nombres
    .map((valeur, index) => {
      const x = (index / (nombres.length - 1)) * largeur
      const y = hauteur - ((valeur - min) / etendue) * (hauteur - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className="empv3-etincelle"
      viewBox={`0 0 ${largeur} ${hauteur}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
