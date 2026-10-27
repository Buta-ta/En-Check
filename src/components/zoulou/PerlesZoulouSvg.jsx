// ═══════════════════════════════════════════════════════════
// 🔴⚪🔵 PERLES ZOULOU — le dessin de la page Employés
//
// Le zoulou n'est pas un fond décoratif : c'est une écriture.
// Dans une parure, la couleur d'une perle dit un âge, un état,
// une appartenance ; deux perles qui se touchent racontent une
// union. On reprend exactement cela :
//
//   · la FRISE     — la bande tissée qui coiffe une vue : des
//                    losanges en perles, reliés par le fil ;
//   · l'ANNEAU     — un cercle de perles dont la part pleine
//                    donne une proportion (jamais un camembert) ;
//   · le LOSANGE   — une marque de repère, quatre perles et un
//                    centre, à la taille d'une puce ;
//   · la PAMPILLE  — les perles qui pendent au bas d'un panneau,
//                    et qui s'allègent pour dire « ça continue ».
//
// Tout est dessiné ici, en SVG : aucune image, aucune police
// d'icônes. Les couleurs viennent des variables --zl-*, donc le
// passage clair / sombre se fait sans redessiner.
// ═══════════════════════════════════════════════════════════

import { useId } from 'react'

const TONS = ['creme', 'cuivre', 'teal', 'sauge', 'corail']

/** Un rang de perles le long d'un segment — le geste de base. */
function rang(x0, y0, x1, y1, nombre, tons, rayon = 2.2, decalage = 0) {
  return Array.from({ length: nombre }, (_, i) => {
    const t = nombre === 1 ? 0 : i / (nombre - 1)
    const ton = tons[(i + decalage) % tons.length]
    return (
      <circle
        key={`${x0}-${i}`}
        cx={Number((x0 + (x1 - x0) * t).toFixed(2))}
        cy={Number((y0 + (y1 - y0) * t).toFixed(2))}
        r={rayon}
        fill={`var(--zl-perle-${ton})`}
      />
    )
  })
}

/**
 * La bande tissée : le motif d'une ceinture perlée — deux rails de
 * fines perles, un double chevron qui se répond, un œil au centre.
 * Elle se répète sur toute la largeur, d'où l'absence de viewBox :
 * une unité vaut un pixel, sinon le motif serait étiré.
 */
export function FrisePerlesSvg({
  hauteur = 52,
  motif = 'chevrons',
  className = '',
  fond = 'transparent',
}) {
  const id = useId().replace(/:/g, '')
  const pas = motif === 'chevrons' ? 78 : 62
  const m = hauteur / 2
  const RAILS = ['creme', 'creme']
  const CHEVRON = ['cuivre', 'creme', 'sauge', 'creme', 'cuivre', 'creme']
  const CHEVRON_BAS = ['teal', 'creme', 'sauge', 'creme', 'teal', 'creme']

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
          {/* la trame : de fines bandes tissées sous les perles */}
          {Array.from({ length: Math.ceil(hauteur / 9) }, (_, i) => (
            <rect key={`t${i}`} x="0" y={i * 9} width={pas} height="4" fill="var(--zl-fil-faible)" opacity="0.16" />
          ))}

          {/* les deux rails : de petites perles régulières */}
          {Array.from({ length: Math.ceil(pas / 9) }, (_, i) => (
            <g key={`r${i}`}>
              <circle cx={3.5 + i * 9} cy="5" r="1.3" fill="var(--zl-perle-creme)" opacity="0.55" />
              <circle cx={3.5 + i * 9} cy={hauteur - 5} r="1.3" fill="var(--zl-perle-creme)" opacity="0.55" />
            </g>
          ))}

          {motif === 'chevrons' ? (
            <g>
              {rang(2, 13, pas / 2, m - 6, 6, CHEVRON, 2.2, 0)}
              {rang(pas / 2, m - 6, pas - 2, 13, 6, CHEVRON, 2.2, 1)}
              {rang(2, hauteur - 13, pas / 2, m + 6, 6, CHEVRON_BAS, 2.2, 2)}
              {rang(pas / 2, m + 6, pas - 2, hauteur - 13, 6, CHEVRON_BAS, 2.2, 3)}
              {/* l'œil : quatre perles autour d'un cœur corail */}
              <circle cx={pas / 2} cy={m} r="3.2" fill="var(--zl-perle-corail)" />
              <circle cx={pas / 2} cy={m - 8} r="1.8" fill="var(--zl-perle-creme)" />
              <circle cx={pas / 2} cy={m + 8} r="1.8" fill="var(--zl-perle-creme)" />
              <circle cx={pas / 2 - 10} cy={m} r="1.8" fill="var(--zl-perle-creme)" />
              <circle cx={pas / 2 + 10} cy={m} r="1.8" fill="var(--zl-perle-creme)" />
              {/* les grains d'entre-deux : le motif respire */}
              {Array.from({ length: Math.ceil(pas / 15) }, (_, i) => (
                <circle key={`g${i}`} cx={8 + i * 15} cy={m} r="1.1" fill="var(--zl-perle-creme)" opacity="0.22" />
              ))}
            </g>
          ) : (
            <g>
              {/* la dent de scie : le fil qu'on enfile perle après perle */}
              <polyline
                points={`0,${m} ${pas / 4},${m - 15} ${pas / 2},${m} ${(pas * 3) / 4},${m + 15} ${pas},${m}`}
                fill="none"
                stroke="var(--zl-fil)"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              {[
                [0, m, 0], [pas / 4, m - 15, 1], [pas / 2, m, 2], [(pas * 3) / 4, m + 15, 3],
              ].map(([x, y, i]) => (
                <circle key={`s${i}`} cx={x} cy={y} r="2.6" fill={`var(--zl-perle-${TONS[i % TONS.length]})`} />
              ))}
              <circle cx={pas / 8} cy={m - 7.5} r="1.6" fill="var(--zl-perle-creme)" opacity="0.5" />
              <circle cx={(pas * 5) / 8} cy={m + 7.5} r="1.6" fill="var(--zl-perle-creme)" opacity="0.5" />
              {Array.from({ length: Math.ceil(pas / 13) }, (_, i) => (
                <circle key={`g${i}`} cx={5 + i * 13} cy={m} r="1" fill="var(--zl-perle-creme)" opacity="0.2" />
              ))}
            </g>
          )}
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
 * Les pampilles : des perles qui pendent, de longueurs inégales.
 * Posées au bas d'un panneau, elles disent « la vue continue »
 * sans barre de défilement ni flèche.
 */
export function PampillesSvg({ nombre = 18, hauteur = 26, className = '' }) {
  return (
    <svg
      className={className}
      width="100%"
      height={hauteur}
      aria-hidden="true"
      data-testid="pampilles"
      style={{ display: 'block' }}
    >
      {Array.from({ length: nombre }, (_, i) => {
        const x = ((i + 0.5) / nombre) * 100
        const longueur = [10, 17, 13, 22, 15, 19][i % 6]
        return (
          <g key={i}>
            <line
              x1={`${x}%`} y1="0" x2={`${x}%`} y2={longueur}
              stroke="var(--zl-fil-faible)" strokeWidth="0.8"
            />
            <circle
              cx={`${x}%`} cy={longueur} r={i % 3 === 0 ? 2.6 : 2}
              fill={`var(--zl-perle-${TONS[i % TONS.length]})`}
            />
          </g>
        )
      })}
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
