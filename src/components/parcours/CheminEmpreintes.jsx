// ═══════════════════════════════════════════════════════════
// 👣 LE CHEMIN — des traces de pieds humains
//
// ⚠️ POURQUOI LE CHEMIN S'ARRÊTAIT (ses captures du 23/11) : la hauteur
// du SVG était figée par une mesure JavaScript. Si la mesure tombait trop
// tôt, le dessin se terminait à mi-page — et la pancarte du bas n'avait
// jamais de traces vers elle.
//
// La correction ne dépend plus d'aucune mesure : le SVG occupe 100 % de
// la hauteur du parcours (CSS), et son dessin se DÉFORME avec lui. Les
// traces sont donc toujours au bout.
//
// `preserveAspectRatio="none"` déforme aussi les pieds… d'où le
// `vector-effect` et, surtout, un compteur de traces large : la
// déformation est répartie, jamais visible sur un pied de 16 px.
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

const ORTEILS = [
  { cx: -3.3, cy: -6.0, rx: 1.75, ry: 1.55 },
  { cx: -0.9, cy: -7.0, rx: 1.2, ry: 1.35 },
  { cx: 0.7, cy: -7.3, rx: 1.0, ry: 1.2 },
  { cx: 2.1, cy: -6.9, rx: 0.85, ry: 1.05 },
  { cx: 3.3, cy: -6.0, rx: 0.7, ry: 0.9 },
]

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

/**
 * Le SVG couvre TOUT le parcours (100 % de sa hauteur, en CSS) et dessine
 * ses traces sur une grille normalisée de 0 à 1000. Il n'a donc besoin
 * d'aucune mesure : où que finisse la page, il finit avec elle.
 */
export default function CheminEmpreintes({ className = '', opacite = 0.52 }) {
  // les pieds doivent garder une taille constante : on ajuste leur échelle
  // à la hauteur réelle, quand on peut la lire. Sinon on garde 1.
  const [compensation, setCompensation] = useState(1)

  useEffect(() => {
    const parent = document.querySelector('.empv3-parcours')
    if (!parent) return undefined
    const mesurer = () => {
      const h = parent.getBoundingClientRect().height
      // la grille fait 1000 de haut : un pied de 16 unités y paraît 16/1000
      // de la hauteur. Pour qu'il fasse toujours ~17 px, on l'écrase.
      if (h > 0) setCompensation(Math.max(0.25, Math.min(1.6, 1000 / (h * 0.9))))
    }
    mesurer()
    if (typeof ResizeObserver !== 'undefined') {
      const o = new ResizeObserver(mesurer)
      o.observe(parent)
      window.addEventListener('resize', mesurer)
      return () => { o.disconnect(); window.removeEventListener('resize', mesurer) }
    }
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [])

  // 64 traces réparties sur 1000 : un tour de sinus complet, donc raccord
  // parfait entre le haut et le bas, sans tuile à recoller.
  const traces = []
  // il commence à 66/1000 de la hauteur : au-dessus, c'est l'en-tête et la
  // barre d'outils — le chemin n'a rien à y faire (espace gagné)
  const N = 60
  for (let i = 0; i < N; i += 1) {
    const t = i / (N - 1)
    const phase = t * Math.PI * 4
    traces.push({
      x: 50 + Math.sin(phase) * 26,
      y: 66 + t * 926,
      angle: Math.cos(phase) > 0 ? 8 : -8,
      gauche: i % 2 === 0,
    })
  }

  return (
    <svg
      className={`chemin-empreintes ${className}`.trim()}
      viewBox="0 0 100 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: opacite }}
    >
      <g fill="#A26537">
        {traces.map((t, i) => (
          <g key={i} transform={`translate(0 ${t.y}) scale(1 ${compensation}) translate(0 ${-t.y})`}>
            <TracePied x={t.x} y={t.y} angle={t.angle} echelle={1.05} gauche={t.gauche} />
          </g>
        ))}
      </g>
    </svg>
  )
}
