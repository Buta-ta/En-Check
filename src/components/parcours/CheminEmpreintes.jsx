// ═══════════════════════════════════════════════════════════
// 👣 LE CHEMIN — des traces de pieds humains
//
// Il les voulait « mieux dessinées » et « un peu plus grosses » :
// la plante est plus pleine, le talon plus rond, l'arche plus
// creuse, et les cinq orteils se lisent un par un. Un pied fait
// maintenant ~16 px de haut au lieu de 11.
//
// Le chemin part de la pancarte, serpente, et s'arrête à la borne.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'

// la plante du pied, vue de dessus, orteils vers le haut
const PLANTE = [
  'M-1.4 -4.4 C-3.6 -4.4 -4.4 -2.6 -4.1 -0.2',
  'C-3.8 1.8 -2.6 3.0 -2.0 4.4',
  'C-1.5 5.6 -2.2 7.4 -2.1 8.8',
  'C-2.0 10.6 -1.2 11.8 0.4 11.8',
  'C2.0 11.8 2.8 10.6 2.9 8.8',
  'C3.0 7.2 2.4 5.8 2.8 4.2',
  'C3.4 1.8 4.4 0.2 4.1 -1.8',
  'C3.8 -3.6 2.6 -4.4 1.4 -4.4 Z',
].join(' ')

// les cinq orteils : le gros à gauche, de plus en plus petits vers la droite
const ORTEILS = [
  { cx: -3.3, cy: -6.0, rx: 1.75, ry: 1.55 },
  { cx: -0.9, cy: -7.0, rx: 1.2, ry: 1.35 },
  { cx: 0.7, cy: -7.3, rx: 1.0, ry: 1.2 },
  { cx: 2.1, cy: -6.9, rx: 0.85, ry: 1.05 },
  { cx: 3.3, cy: -6.0, rx: 0.7, ry: 0.9 },
]

/** une trace seule : sert au chemin, et à l'aperçu de contrôle */
export function TracePied({ x, y, angle = 0, echelle = 1, gauche = true }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${gauche ? -echelle : echelle} ${echelle})`}>
      <path d={PLANTE} />
      {ORTEILS.map((o, i) => (
        <ellipse key={i} cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry} />
      ))}
    </g>
  )
}

const TUILE_H = 264
const TUILE_L = 150
const PAS = 22
const ECHELLE = 1.35

export default function CheminEmpreintes({ className = '', opacite = 0.52 }) {
  // la hauteur réelle du parcours : le chemin doit aller jusqu'en bas
  const [hauteur, setHauteur] = useState(1400)

  useEffect(() => {
    const mesurer = () => {
      const parent = document.querySelector('.empv3-parcours')
      if (parent) setHauteur(Math.max(parent.getBoundingClientRect().height, 400))
    }
    mesurer()
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [])

  // ⚠️ un tour de sinus COMPLET par tuile, sinon le tracé saute
  // d'une tuile à l'autre — défaut vu à l'image au premier essai.
  const traces = []
  const nombre = Math.ceil(hauteur / PAS) + 2
  for (let i = 0; i < nombre; i += 1) {
    const y = 14 + i * PAS
    const phase = (y / TUILE_H) * Math.PI * 2
    const x = (TUILE_L / 2) + Math.sin(phase) * 34
    traces.push({ x, y, angle: Math.cos(phase) > 0 ? 8 : -8, gauche: i % 2 === 0 })
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
          <TracePied key={i} x={t.x} y={t.y} angle={t.angle} echelle={ECHELLE} gauche={t.gauche} />
        ))}
      </g>
    </svg>
  )
}
