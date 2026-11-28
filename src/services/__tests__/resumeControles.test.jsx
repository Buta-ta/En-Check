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
  expect(document.body.textContent).toContain('2 prêts')
})

it('offre la réparation, et la met en avant', async () => {
  const actions = await afficher()
  const reparer = bouton('Compléter les 4 profils')
  expect(reparer).toBeTruthy()
  //  C'est le bouton PLEIN de la modale : celui qui répare, pas celui qui force.
  //  Il porte l'encre pleine, là où l'autre reste en papier contouré.
  expect(reparer.style.backgroundColor).toBe('var(--charte-encre)')
  expect(reparer.style.color).toBe('var(--charte-blanc)')
  await act(async () => reparer.click())
  expect(actions.onProfils).toHaveBeenCalledTimes(1)
})

it('laisse forcer, mais en le nommant et sans le mettre en avant', async () => {
  const actions = await afficher()
  const forcer = bouton('Générer des bulletins incomplets')
  expect(forcer).toBeTruthy()
  //  Plus de « Générer quand même » : le libellé dit ce qu'on obtient.
  expect(document.body.textContent).not.toContain('Générer quand même')
  //  Et ce n'est pas le bouton plein — papier contouré, pas encre pleine.
  expect(forcer.style.backgroundColor).toBe('var(--charte-surface)')
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

it('se centre vraiment — sans rembourrage qui déplace, sans défilement qui glisse', async () => {
  await afficher({ zoneHaute: 168, zoneBasse: 0 })
  const fond = document.querySelector('.pw-resume-controles-fond')

  //  LE DÉFAUT DE LA CAPTURE DU 28/11, verrouillé ici.
  //  `safe center` n'est pas reconnu sur `justify-content` : la déclaration
  //  tombait et la fenêtre partait en haut à gauche.
  expect(fond.style.justifyContent).toBe('center')
  expect(fond.style.alignItems).toBe('center')

  //  Et le voile ne porte AUCUN rembourrage haut ou bas : c'est lui qui
  //  poussait la fenêtre vers le bas dès que la boîte défilait.
  expect(fond.style.paddingTop).toBe('')
  expect(fond.style.paddingBottom).toBe('')
  expect(fond.style.overflowY).toBe('')

  //  Seul le rembourrage latéral demeure, pour ne pas toucher les bords.
  expect(fond.style.paddingLeft).toBe('16px')
})

it('garde sa hauteur dans la place libre, et c’est ELLE qui défile', async () => {
  await afficher({ zoneHaute: 200, zoneBasse: 72 })
  const feuille = document.querySelector('.pw-resume-controles')
  //  200 + 72 + 32 : jamais plus haut que la place réellement libre.
  expect(feuille.style.maxHeight).toBe('calc(100dvh - 304px)')
  //  Le débordement se règle dans la feuille, jamais dans le voile : ainsi
  //  rien ne peut la décaler, et son en-tête reste atteignable.
  expect(feuille.style.overflow).toBe('auto')
})

it('dit la vérité au singulier comme au pluriel', async () => {
  await act(async () => racine.render(<ResumeControles blockers={[QUATRE[0]]} ready={0} onFermer={vi.fn()} />))
  expect(document.body.textContent).toContain('Un profil salarial manque')
  expect(document.body.textContent).toContain('Ce bulletin naîtra incomplet')
  expect(bouton('Compléter le profil')).toBeTruthy()
})

it('aucune couleur en dur : tout vient des jetons de la charte', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync('src/components/paie/ResumeControles.jsx', 'utf8')
  //  La règle de la charte (C1) : un #hex dans un composant, et le compte
  //  global monte. Cette modale ne doit pas l'aggraver.
  expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toEqual([])
  //  La peau est en styles en ligne, sur des JETONS de charte : aucune valeur
  //  de couleur n'est écrite ici, c'est le thème qui les fournit.
  expect(source).toContain('var(--charte-encre)')
  //  Et aucun flou, nulle part (peau D, D-016).
  expect(source).not.toContain('blur(')
  expect(source).not.toContain('backdropFilter')
})
