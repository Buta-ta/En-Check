// ═══════════════════════════════════════════════════════════
// 🔴⚪🔵 PERLES ZOULOU — le dessin de la page Employés
//
// Le zoulou n'est pas un fond décoratif : c'est une écriture.
// Dans une parure, la couleur d'une perle dit un âge, un état,
// une appartenance ; deux perles qui se touchent racontent une
// union. On reprend exactement cela :
//
//   · la FRISE     — la couture perlée qui coiffe une vue : une
//                    trame tissée, une couture en dents, un rang
//                    de grosses perles ;
//   · l'ANNEAU     — un cercle de perles dont la part pleine
//                    donne une proportion (jamais un camembert) ;
//   · le LOSANGE   — une marque de repère, quatre perles et un
//                    centre, à la taille d'une puce ;
//   · la ROSACE    — deux anneaux de perles, en filigrane ;
//   · le COLLIER   — une perle par jour restant avant une échéance.
//
// Tout est dessiné ici, en SVG : aucune image, aucune police
// d'icônes. Les couleurs viennent des variables --zl-*, donc le
// passage clair / sombre se fait sans redessiner.
// ═══════════════════════════════════════════════════════════

import { useId } from 'react'

const TONS = ['creme', 'cuivre', 'teal', 'sauge', 'corail']

/**
 * La frise : un rang de perles posé sur une couture brodée.
 *
 * Elle tient en trois signes qui se répètent — une trame tissée très
 * discrète, une couture en dents de scie, et le rang de perles qui
 * ondule doucement. Rien de plus : une frise qui court sur toute la
 * largeur doit être calme, sinon elle vole la vedette au titre.
 *
 * `motif` change la couture : « chevrons » pour les Équipes (dents
 * larges), « zigzag » pour les Tâches (dents serrées, plus nerveuses).
 * Pas de viewBox : une unité vaut un pixel, sinon le motif s'étire.
 */
export function FrisePerlesSvg({
  hauteur = 46,
  motif = 'chevrons',
  className = '',
  fond = 'transparent',
}) {
  const id = useId().replace(/:/g, '')
  const pas = motif === 'chevrons' ? 116 : 84
  const dent = motif === 'chevrons' ? 11 : 8
  const m = hauteur / 2
  const perles = motif === 'chevrons' ? 6 : 5

  return (
    <svg
      className={className}
      width="100%"
      height={hauteur}
      aria-hidden="true"
      data-testid="frise-perles"
      data-motif={motif}
      style={{ display: 'block', background: fond }}
    >
      <defs>
        <pattern id={`frise-${id}`} width={pas} height={hauteur} patternUnits="userSpaceOnUse">
          {/* la trame tissée, à peine visible */}
          {Array.from({ length: Math.ceil(hauteur / 10) }, (_, i) => (
            <rect
              key={`t${i}`}
              x="0" y={5 + i * 10}
              width={pas} height="2.6"
              fill="var(--zl-fil-faible)"
              opacity="0.16"
            />
          ))}

          {/* la couture : des dents régulières, dessinées au fil */}
          <polyline
            points={
              motif === 'chevrons'
                ? `0,${m - dent} ${pas / 2},${m + dent} ${pas},${m - dent}`
                : `0,${m - dent} ${pas / 4},${m + dent} ${pas / 2},${m - dent} ${(pas * 3) / 4},${m + dent} ${pas},${m - dent}`
            }
            fill="none"
            stroke="var(--zl-fil)"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          {/* le rang de perles : il ondule, les tailles alternent */}
          {Array.from({ length: perles }, (_, i) => {
            const x = 5 + i * (pas / (perles - 0.2))
            const y = m + Math.sin((i / perles) * Math.PI * 2) * (dent - 6)
            return (
              <circle
                key={`p${i}`}
                cx={Number(x.toFixed(2))}
                cy={Number(y.toFixed(2))}
                r={i % 4 === 0 ? 5 : 4.1}
                fill={`var(--zl-perle-${TONS[i % TONS.length]})`}
              />
            )
          })}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#frise-${id})`} />
    </svg>
  )
}

/**
 * L'anneau de perles : `parts` perles réparties en cercle, les
 * `remplis` premières pleines. Au centre, on pose un nombre ou des
 * initiales. C'est la jauge de la page — jamais un camembert.
 */
export function AnneauPerlesSvg({
  taille = 78,
  parts = 28,
  remplis = 0,
  ton = 'cuivre',
  className = '',
}) {
  const rayon = taille / 2 - 4
  const centre = taille / 2
  const part = Math.max(0, Math.min(parts, Math.round(remplis)))

  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox={`0 0 ${taille} ${taille}`}
      aria-hidden="true"
      data-testid="anneau-perles"
      data-parts={parts}
      data-remplis={part}
    >
      <circle
        cx={centre} cy={centre} r={rayon}
        fill="none"
        stroke="var(--zl-fil-faible)"
        strokeWidth="1"
      />
      {Array.from({ length: parts }, (_, i) => {
        const angle = (i / parts) * Math.PI * 2 - Math.PI / 2
        const plein = i < part
        // les perles pleines grossissent légèrement : la part lue
        // se voit à l'œil, avant même de compter
        const r = plein ? 3.1 : 2.1
        return (
          <circle
            key={i}
            cx={centre + rayon * Math.cos(angle)}
            cy={centre + rayon * Math.sin(angle)}
            r={r}
            fill={plein ? `var(--zl-perle-${ton})` : 'var(--zl-creux)'}
            stroke={plein ? 'transparent' : 'var(--zl-fil-faible)'}
            strokeWidth={plein ? 0 : 0.8}
          />
        )
      })}
    </svg>
  )
}

/** Le losange de perles : quatre perles, un centre. Une puce qui a du sens. */
export function LosangePerlesSvg({
  taille = 22,
  ton = 'cuivre',
  className = '',
}) {
  const c = taille / 2
  const d = c - 2.6
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox={`0 0 ${taille} ${taille}`}
      aria-hidden="true"
      data-testid="losange-perles"
    >
      <circle cx={c} cy={c - d} r="2.1" fill={`var(--zl-perle-${ton})`} />
      <circle cx={c + d} cy={c} r="2.1" fill={`var(--zl-perle-${ton})`} />
      <circle cx={c} cy={c + d} r="2.1" fill={`var(--zl-perle-${ton})`} />
      <circle cx={c - d} cy={c} r="2.1" fill={`var(--zl-perle-${ton})`} />
      <circle cx={c} cy={c} r="1.7" fill="var(--zl-perle-creme)" />
    </svg>
  )
}

/**
 * La rosace : un centre, deux anneaux de perles. Sert de repère
 * discret (coin d'une carte, état vide). Purement décorative.
 */
export function RosacePerlesSvg({ taille = 64, ton = 'teal', className = '' }) {
  const c = taille / 2
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox={`0 0 ${taille} ${taille}`}
      aria-hidden="true"
      data-testid="rosace-perles"
    >
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        const r = c - 3
        return (
          <circle
            key={`e${i}`}
            cx={c + r * Math.cos(a)}
            cy={c + r * Math.sin(a)}
            r="1.5"
            fill={`var(--zl-perle-${TONS[i % TONS.length]})`}
            opacity="0.72"
          />
        )
      })}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = (c - 3) * 0.56
        return (
          <circle
            key={`i${i}`}
            cx={c + r * Math.cos(a)}
            cy={c + r * Math.sin(a)}
            r="2.2"
            fill={`var(--zl-perle-${ton})`}
          />
        )
      })}
      <circle cx={c} cy={c} r="3" fill="var(--zl-perle-creme)" />
    </svg>
  )
}

/**
 * Le fil de membres : une ligne légèrement courbe sur laquelle les
 * avatars sont enfilés. Employée derrière une bande d'avatars pour
 * que les perles aient l'air posées, et non flottantes.
 */
export function FilMembresSvg({ className = '' }) {
  return (
    <svg
      className={className}
      width="100%"
      height="18"
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="fil-membres"
      style={{ display: 'block' }}
    >
      <path
        d="M0,9 C14,3 28,15 42,9 C56,3 70,15 84,9 C92,5.5 96,6 100,9"
        fill="none"
        stroke="var(--zl-fil)"
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Le collier d'échéance : une perle par jour qui reste avant la
 * date, la dernière étant le jour même. En retard, le collier est
 * corail et se termine par une perle éclatée ; le jour même, une
 * seule perle brûle. Au-delà de quatorze jours, le collier se
 * resserre et se termine par trois points — on ne compte pas
 * l'infini, on donne l'ordre de grandeur.
 */
export function CollierEcheanceSvg({
  jours = 0,
  enRetard = false,
  max = 14,
  className = '',
}) {
  const nombre = Math.min(max, Math.max(1, Math.abs(Math.round(jours)) || 1))
  const deborde = Math.abs(Math.round(jours)) > max
  const ton = enRetard ? 'corail' : jours <= 2 ? 'cuivre' : 'teal'
  const pas = 7.5
  //  la largeur suit exactement les perles : le fil s'arrête au
  //  bout, sans traîner une amorce qui ferait un accroc visuel
  const largeur = 3 + (nombre - 1) * pas + 3.4 + 3 + (deborde ? 7.2 : 0)

  return (
    <svg
      className={className}
      width={largeur}
      height="12"
      viewBox={`0 0 ${largeur} 12`}
      aria-hidden="true"
      data-testid="collier-echeance"
      data-jours={Math.round(jours)}
      data-etat={enRetard ? 'retard' : 'a-venir'}
      style={{ display: 'block', flex: 'none' }}
    >
      {/* le fil qui tient les perles */}
      <line
        x1="1.5" y1="6" x2={largeur - 2.5} y2="6"
        stroke="var(--zl-fil)" strokeWidth="1" strokeLinecap="round"
      />
      {Array.from({ length: nombre }, (_, i) => {
        const dernier = i === nombre - 1
        return (
          <circle
            key={i}
            cx={3 + i * pas}
            cy="6"
            r={dernier ? 3.4 : 2.3}
            fill={`var(--zl-perle-${ton})`}
            opacity={dernier ? 1 : 0.62}
          />
        )
      })}
      {deborde && (
        <g fill="var(--zl-fil)">
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
          stroke="var(--zl-perle-corail)"
          strokeWidth="1"
          opacity="0.5"
        />
      )}
    </svg>
  )
}
