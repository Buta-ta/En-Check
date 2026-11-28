// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════════════
//  LA MODALE « PROFILS MANQUANTS » — ce qu'elle dit, et ce qu'elle répare
//
//  Capture du 28/11 : « Les employés suivants auront une fiche à 0 », quatre
//  lignes rouges identiques, « Générer quand même » en brun sur brun (1,7:1),
//  et aucune issue autre que forcer. Ces tests verrouillent les quatre
//  corrections, pour qu'aucune ne se perde en route.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ResumeControles from '../../components/paie/ResumeControles'

vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, toggleTheme: vi.fn() }) }))

const QUATRE = [
  { employeeId: '1', employee: 'RECETTE A', reason: 'Aucun profil salarial' },
  { employeeId: '2', employee: 'RECETTE B', reason: 'Aucun profil salarial' },
  { employeeId: '3', employee: 'Hector H', reason: 'Aucun profil salarial' },
  { employeeId: '4', employee: 'ya Ya', reason: 'Aucun profil salarial' },
]

let hote, racine
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
})
afterEach(async () => {
  await act(async () => racine.unmount())
  hote.remove()
  document.body.innerHTML = ''
})

const afficher = async (props = {}) => {
  const actions = { onFermer: vi.fn(), onGenerer: vi.fn(), onProfils: vi.fn(), ...props }
  await act(async () => racine.render(<ResumeControles blockers={QUATRE} ready={2} {...actions} />))
  return actions
}
const bouton = (texte) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(texte))

it('ne parle plus de « fiche à 0 » — ce sont des bulletins incomplets', async () => {
  await afficher()
  const texte = document.body.textContent
  //  La phrase fausse a disparu : ces salariés n'ont pas un net de 0, ils
  //  n'ont ni impôt ni cotisations (le service retombe sur un bulletin
  //  marqué `impot_a_verifier`).
  expect(texte).not.toContain('fiche à 0')
  expect(texte).toContain('4 profils salariaux manquent')
  expect(texte).toContain('ne pourront pas être remis aux salariés')
  expect(texte).toContain('ni l’impôt ni les cotisations sociales')
})

it('nomme chacun, et compte à part ceux qui sont prêts', async () => {
  await afficher()
  const lignes = [...document.querySelectorAll('li')]
  expect(lignes).toHaveLength(4)
  expect(lignes.map((l) => l.textContent)).toEqual([
    'RECETTE A—Aucun profil salarial',
    'RECETTE B—Aucun profil salarial',
    'Hector H—Aucun profil salarial',
    'ya Ya—Aucun profil salarial',
  ])
  //  Le nom porte le poids, le motif porte la couleur : deux traitements
  //  distincts là où la capture n'en montrait qu'un.
  expect(lignes[0].querySelector('strong').textContent).toBe('RECETTE A')
  expect(document.body.textContent).toContain('Les 2 autres sont prêts')
})

it('offre la réparation, et la met en avant', async () => {
  const actions = await afficher()
  const reparer = bouton('Compléter les 4 profils')
  expect(reparer).toBeTruthy()
  //  C'est le bouton PLEIN de la modale : celui qui répare, pas celui qui force.
  expect(reparer.style.background).toBeTruthy()
  expect(reparer.style.background).not.toBe('transparent')
  await act(async () => reparer.click())
  expect(actions.onProfils).toHaveBeenCalledTimes(1)
})

it('laisse forcer, mais en le nommant et sans le mettre en avant', async () => {
  const actions = await afficher()
  const forcer = bouton('Générer des bulletins incomplets')
  expect(forcer).toBeTruthy()
  //  Plus de « Générer quand même » : le libellé dit ce qu'on obtient.
  expect(document.body.textContent).not.toContain('Générer quand même')
  //  Et ce n'est pas le bouton plein — contour seulement.
  expect(forcer.style.background).toBe('transparent')
  await act(async () => forcer.click())
  expect(actions.onGenerer).toHaveBeenCalledTimes(1)
})

it('se ferme par Échap, par Annuler et par le fond — jamais par la boîte', async () => {
  const actions = await afficher()
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  expect(actions.onFermer).toHaveBeenCalled()

  actions.onFermer.mockClear()
  await act(async () => bouton('Annuler').click())
  expect(actions.onFermer).toHaveBeenCalled()

  //  Un clic DANS la boîte ne ferme pas : on ne perd pas la liste en visant
  //  un bouton.
  actions.onFermer.mockClear()
  await act(async () => document.querySelector('.pw-resume-controles').click())
  expect(actions.onFermer).not.toHaveBeenCalled()
})

it('naît sous la barre figée, pas derrière elle', async () => {
  await afficher({ hauteurBarre: 168 })
  const fond = document.querySelector('.pw-resume-controles-fond')
  //  168 + 16 : la barre mesurée, puis la respiration habituelle. Sans cette
  //  marge, le haut de la modale passait SOUS la barre — la capture montrait
  //  le bouton coupé par le bord du bloc collant.
  expect(fond.style.paddingTop).toBe('184px')
})

it('dit la vérité au singulier comme au pluriel', async () => {
  await act(async () => racine.render(<ResumeControles blockers={[QUATRE[0]]} ready={0} onFermer={vi.fn()} />))
  expect(document.body.textContent).toContain('Un profil salarial manque')
  expect(document.body.textContent).toContain('Ce bulletin naîtra incomplet')
  expect(bouton('Compléter le profil')).toBeTruthy()
})

it('aucune couleur en dur : tout vient de la palette', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync('src/components/paie/ResumeControles.jsx', 'utf8')
  //  La règle de la charte (C1) : un #hex dans un composant, et le compte
  //  global monte. Cette modale ne doit pas l'aggraver.
  expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toEqual([])
  expect(source).toContain('palettePaie')
  expect(source).toContain('encreSurAccent')
})
