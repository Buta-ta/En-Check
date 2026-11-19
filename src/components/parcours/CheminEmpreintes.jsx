// ═══════════════════════════════════════════════════════════
// 👣 LE CHEMIN — des traces de pieds humains, minuscules
//
// Sa demande du 21/11 : « un chemin serpenté de traces de pied
// humain et non des humains ». Une trace = un pied NU, dessiné
// avec ses cinq orteils. Pas une ellipse, pas un point, pas une
// chaussure.
//
// Il descend de la pancarte de l'en-tête, serpente en S, passe
// dans la marge gauche, et s'arrête à la borne de pointage — là
// où il y a le plus d'espace. Il ne prend aucun clic.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'

// un pied nu, vu de dessus : talon, plante, cinq orteils
const PIED = [
  // la plante et le talon
  'M0 1.6 C-2.1 1.2 -3.1 3.6 -2.6 6.4 C-2.1 9.2 -1.2 11.6 -0.4 13.6 C0 14.5 1 14.5 1.4 13.6 C2.2 11.6 3.1 9.2 3.6 6.4 C4.1 3.6 3.1 1.2 1 1.6 Z',
]

// les orteils : du gros (à gauche) au petit (à droite)
const ORTEILS = [
  { cx: -3.0, cy: -0.6, r: 1.35 },
  { cx: -1.1, cy: -2.2, r: 1.0 },
  { cx: 0.5, cy: -2.8, r: 0.85 },
  { cx: 2.0, cy: -2.5, r: 0.72 },
  { cx: 3.2, cy: -1.8, r: 0.6 },
]

/** une trace seule, tournée, à l'échelle — sert au motif et à l'aperçu */
export function TracePied({ x, y, angle = 0, echelle = 1, gauche = true }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${gauche ? -echelle : echelle} ${echelle})`}>
      {PIED.map((d, i) => <path key={i} d={d} />)}
      {ORTEILS.map((o, i) => <circle key={i} cx={o.cx} cy={o.cy} r={o.r} />)}
    </g>
  )
}

const TUILE_H = 264
const TUILE_L = 132
const PAS = 16

export default function CheminEmpreintes({ className = '', opacite = 0.55 }) {
  // la hauteur réelle du chemin, pour dessiner la bonne quantité de traces
  const [hauteur, setHauteur] = useState(1200)

  useEffect(() => {
    const mesurer = () => {
      const parent = document.querySelector('.empv3-parcours')
      if (parent) setHauteur(Math.max(parent.getBoundingClientRect().height, 400))
    }
    mesurer()
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [])

  // ⚠️ un tour de sinus COMPLET par tuile : sinon le tracé saute
  // d'une tuile à l'autre (défaut vu à l'image au premier essai).
  const traces = []
  const nombre = Math.ceil(hauteur / PAS) + 2
  for (let i = 0; i < nombre; i += 1) {
    const y = 10 + i * PAS
    const phase = (y / TUILE_H) * Math.PI * 2
    const x = 46 + Math.sin(phase) * 30
    traces.push({
      x,
      y,
      angle: Math.cos(phase) > 0 ? 9 : -9,
      gauche: i % 2 === 0,
    })
  }

  return (
    <svg
      className={`chemin-empreintes ${className}`.trim()}
      viewBox={`0 0 ${TUILE_L} ${hauteur}`}
      width={TUILE_L}
      height={hauteur}
      preserveAspectRatio="xMidYMin meet"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: opacite }}
    >
      <g fill="#A26537">
        {traces.map((t, i) => (
          <TracePied key={i} x={t.x} y={t.y} angle={t.angle} echelle={1} gauche={t.gauche} />
        ))}
      </g>
    </svg>
  )
}
