import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  RetardsContent,
  RetardsHelp,
} from '../../components/RetardsPresentation'
import RetardsEngraving from '../../components/RetardsEngraving'
import { construireRetards } from '../retardsService'
import { retardDates } from '../../utils/retardsPresentation'

/* une seconde arrivée, délibérément plus faible : le focus doit aller à
   `input` (123 min), jamais à elle. */
const ligneEnPlus = {
  ...{
    pointage_id: 'fixture-2',
    employe_id: 'fixture-2',
    enterprise_id: 'ent',
    entreprise_nom: 'Entreprise de test',
    prenom: 'Koffi',
    nom: 'MENSAH',
    jour: '2026-10-23',
    heure_prevue: '08:00',
    heure_arrivee: '08:21',
    est_retard: true,
    retard_minutes: 21,
    tolerance_minutes: 0,
    grille_source: 'custom',
  },
}
const input = {
  pointage_id: 'fixture',
  employe_id: 'fixture',
  enterprise_id: 'ent',
  entreprise_nom: 'Entreprise de test',
  prenom: 'Hippo',
  nom: 'BIYOKILA',
  jour: '2026-10-23',
  heure_prevue: '09:00',
  heure_arrivee: '11:03',
  est_retard: true,
  retard_minutes: 123,
  tolerance_minutes: 0,
  grille_source: 'custom',
}
function render(rows = [input], mode = 'jour') {
  const { retards, stats } = construireRetards(rows)
  return renderToStaticMarkup(
    <RetardsContent
      retards={retards}
      stats={stats}
      dates={retardDates('2026-10-23', mode)}
      mode={mode}
      search=""
    />,
  )
}
it('presents the reported single-arrival scenario as an exact time ticket', () => {
  const html = render()
  for (const text of [
    'Hippo',
    'BIYOKILA',
    '09:00',
    '11:03',
    '+2 h 03',
    'Heure prévue',
    'Arrivée réelle',
    'Horaire personnalisé',
    '1 fiche horaire',
  ])
    expect(html).toContain(text)
  expect(html).toContain('Retard constaté')
  expect(html).toContain('Employé concerné')
  expect(html).toContain('rt-time-ticket')
  expect(html).not.toContain('rt-track')
  expect(html).not.toContain('Lignes indicatives')
  expect(html).not.toContain('Page suivante')
})
it('uses a day summary instead of a meaningless single full-height bar', () => {
  const html = render()
  expect(html).toContain('rt-day-seal')
  expect(html).toContain('L’empreinte du jour')
  expect(html).not.toContain('rt-bars')
  expect(html).not.toContain('progressbar')
  expect(html).not.toContain('%')
})
it('does not invent data for an empty day and uses plural counts', () => {
  const html = render([])
  expect(html).toContain('0 min')
  expect(html).toContain('Retards constatés')
  /*  25/11 : l'état vide ne dit plus la même chose. Il nomme ce qui est vrai
      (« Aucune retard sur cette période ») et donne une issue au lieu de
      répéter « 0 fiches sur 0 » juste en dessous. */
  expect(html).toContain('Aucun retard sur cette période.')
  expect(html).toContain('Aucune fiche sur cette période')
  expect(html).not.toContain('0 fiches sur 0')
  expect(html).not.toContain('Hippo')
})
it('keeps the real weekly distribution and all zero days', () => {
  const html = render([input], 'semaine')
  expect((html.match(/class="rt-bar-column"/g) || []).length).toBe(7)
  /* 27/11 : l'empreinte du jour ne quitte plus la marge — elle est la
     pièce centrale de la colonne de droite, demande de la maquette A. */
  expect(html).toContain('rt-day-seal')
})

/*  LA DIRECTION A, retenue le 27/11 — « je le veux exactement comme la
    maquette choisie ». Trois pièces doivent tenir :
      · le rail des jours n'apparaît qu'en semaine et en mois ;
      · une SEULE fiche est mise en avant, celle du plus fort écart ;
      · la marge porte l'empreinte et la règle, jamais dans le flux des fiches. */
it('met en avant une seule fiche, celle du plus fort écart', () => {
  /* une fiche seule ne se met pas en avant : sans voisine, elle n'a rien
     à quoi se comparer — le focus ne prend son sens qu'à partir de deux */
  expect((render([input], 'jour').match(/is-focus/g) || []).length).toBe(0)

  const html = render([input, ligneEnPlus], 'jour')
  expect((html.match(/is-focus/g) || []).length).toBe(1)
  expect(html).toContain('rt-marge')
  expect(html).toContain('L’empreinte du jour')
  expect(html).toContain('Ce que dit la règle')
  /* le rail situe le jour dans sa semaine, comme la maquette A */
  expect(html).toContain('rt-rail')
  expect(html).toContain('Jours de la période')
})

it('ouvre le rail des jours dès que la période en compte plusieurs', () => {
  const html = render([input], 'semaine')
  expect(html).toContain('rt-rail')
  expect(html).toContain('Jours de la période')
})
it('keeps explanations closed and the engraving purely decorative', () => {
  const html = renderToStaticMarkup(<RetardsHelp />)
  expect((html.match(/<details>/g) || []).length).toBe(2)
  expect(html).not.toContain('open=""')
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('Le temps, expliqué.')
})

/*  L'HORLOGE ANIMÉE — 25/11, « anime cette horloge ». Ce qui doit rester
    vrai : elle est vivante (trois groupes qui tournent, à trois vitesses),
    elle reste décorative, et le choix du système est respecté. */
it('anime les trois aiguilles, et s’arrête pour qui a demandé moins d’animation', async () => {
  const { readFileSync } = await import('node:fs')
  const html = renderToStaticMarkup(<RetardsEngraving />)
  const css = readFileSync('src/pages/Retards.css', 'utf8')

  /* trois groupes distincts : heure, minute, trotteuse */
  for (const aiguille of [
    'rt-engraving-heures',
    'rt-engraving-minutes',
    'rt-engraving-secondes',
  ]) {
    expect(html).toContain(aiguille)
    expect(css).toContain(`.${aiguille}`)
  }
  /* trois vitesses différentes — sinon ce n'est pas une horloge */
  expect(css).toContain('rt-aiguille-heures 43200s')
  expect(css).toContain('rt-aiguille-minutes 3600s')
  expect(css).toContain('rt-trotteuse 60s')

  /* `transform-box` : sans lui, un groupe SVG tourne autour du coin */
  expect(css).toContain('transform-box: view-box')

  /* décorative, jamais une mesure */
  expect(html).toContain('aria-hidden="true"')
  expect(html).not.toMatch(/<text/)

  /* et le réglage du système gagne toujours */
  const bloc = css.slice(css.indexOf('prefers-reduced-motion'))
  expect(bloc).toContain('.rt-engraving-secondes')
  expect(bloc).toContain('.rt-engraving-heures')
  expect(bloc).toContain('animation: none')
})
