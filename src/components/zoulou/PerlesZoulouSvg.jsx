// ═══════════════════════════════════════════════════════════════
// 🔵 LES DESSINS PERLÉS — page Employés, registre perlé
//
// Deux dessins seulement, parce que la page n'en demande que deux :
//
//   · le collier d'échéance — une perle par jour qui reste, corail
//     quand la date est passée. C'est le seul endroit où l'on compte
//     le temps d'un coup d'œil ;
//   · la rosace creuse — un état vide qui reste dessiné, sans image
//     ni aplat : une couronne de perles non enfilées.
//
// Les couleurs viennent des variables --rg-* posées par zoulou.css,
// avec les tons perles en repli pour un rendu hors de la page.
// ═══════════════════════════════════════════════════════════════

const TONS = {
  teal: 'var(--rg-perle-teal, #4f9389)',
  cuivre: 'var(--rg-perle-cuivre, #b8823f)',
  sauge: 'var(--rg-perle-sauge, #8ba268)',
  corail: 'var(--rg-perle-corail, #c8785c)',
  creme: 'var(--rg-perle-creme, #e0c9a0)',
}

/**
 * La rosace creuse : quatorze perles posées en couronne sur un fil
 * pointillé. Elle sert d'état vide — on montre le motif plutôt qu'un
 * cadre vide.
 */
export function RosacePerlesSvg({ taille = 52, ton = 'cuivre', className = '' }) {
  const perles = 14
  const rayon = 17
  const centre = 23
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 46 46"
      aria-hidden="true"
      focusable="false"
      data-testid="rosace-perles"
      data-ton={ton}
    >
      <circle
        cx={centre}
        cy={centre}
        r={rayon}
        fill="none"
        stroke="var(--rg-hair-fort, rgba(60,40,22,.32))"
        strokeWidth="0.8"
        strokeDasharray="2 3"
      />
      {Array.from({ length: perles }, (_, i) => {
        const angle = (i / perles) * Math.PI * 2 - Math.PI / 2
        return (
          <circle
            key={i}
            cx={(centre + Math.cos(angle) * rayon).toFixed(2)}
            cy={(centre + Math.sin(angle) * rayon).toFixed(2)}
            r="1.7"
            fill="none"
            stroke={TONS[ton] || TONS.cuivre}
            strokeWidth="1.1"
            opacity={i % 3 === 0 ? 0.95 : 0.55}
          />
        )
      })}
    </svg>
  )
}

/**
 * Le collier d'échéance : une perle par jour qui reste avant la date,
 * la dernière étant le jour même. En retard, le collier passe au
 * corail et la dernière perle est cerclée ; le jour même, une seule
 * perle tient le fil. Au-delà de onze jours, le collier se resserre
 * et se termine par trois points — on donne l'ordre de grandeur,
 * pas l'infini.
 */
export function CollierEcheanceSvg({
  jours = 0,
  enRetard = false,
  max = 11,
  className = '',
}) {
  const arrondi = Math.round(jours) || 0
  const nombre = Math.min(max, Math.max(1, Math.abs(arrondi) || 1))
  const deborde = Math.abs(arrondi) > max
  const ton = enRetard ? 'corail' : Math.abs(arrondi) <= 2 ? 'cuivre' : 'teal'
  const pas = 7.5
  const largeur = 3 + (nombre - 1) * pas + 3.4 + 3 + (deborde ? 7.2 : 0)

  return (
    <svg
      className={className}
      width={largeur}
      height="12"
      viewBox={`0 0 ${largeur} 12`}
      aria-hidden="true"
      focusable="false"
      data-testid="collier-echeance"
      data-jours={arrondi}
      data-etat={enRetard ? 'retard' : 'a-venir'}
      style={{ display: 'block', flex: 'none' }}
    >
      <line
        x1="1.5"
        y1="6"
        x2={largeur - 2.5}
        y2="6"
        stroke="var(--rg-hair-fort, rgba(60,40,22,.32))"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {Array.from({ length: nombre }, (_, i) => {
        const dernier = i === nombre - 1
        return (
          <circle
            key={i}
            cx={3 + i * pas}
            cy="6"
            r={dernier ? 3.4 : 2.3}
            fill={TONS[ton]}
            opacity={dernier ? 1 : 0.6}
          />
        )
      })}
      {deborde && (
        <g fill="var(--rg-hair-fort, rgba(60,40,22,.32))">
          {[0, 1, 2].map((i) => (
            <circle key={`p${i}`} cx={3 + nombre * pas + i * 2.4} cy="6" r="1" />
          ))}
        </g>
      )}
      {enRetard && (
        <circle
          cx={3 + (nombre - 1) * pas}
          cy="6"
          r="5.4"
          fill="none"
          stroke={TONS.corail}
          strokeWidth="1"
          opacity="0.5"
        />
      )}
    </svg>
  )
}

export default { RosacePerlesSvg, CollierEcheanceSvg }
