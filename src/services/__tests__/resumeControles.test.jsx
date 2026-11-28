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
  //  La phrase est celle du TITRE : le grand chiffre du carré est décoratif,
  //  il se cumulerait avec celui que lit le lecteur d'écran.
  expect(document.getElementById('pw-resume-titre').textContent).toContain('4 profils salariaux manquent')
  expect(texte).toContain('ne pourront pas être remis aux salariés')
  expect(texte).toContain('ni l’impôt ni les cotisations sociales')
})

it('nomme chacun, et compte à part ceux qui sont prêts', async () => {
  await afficher()
  const lignes = [...document.querySelectorAll('li')]
  expect(lignes).toHaveLength(4)
  //  Cartouche : le nom, le guide pointillé, puis le tampon « Incomplet ».
  //  Le motif exact reste accessible par `title` — il ne se devine plus.
  expect(lignes.map((l) => l.querySelector('strong').textContent)).toEqual([
    'RECETTE A', 'RECETTE B', 'Hector H', 'ya Ya',
  ])
  lignes.forEach((l) => {
    expect(l.textContent).toContain('Incomplet')
    expect(l.querySelector('[title="Aucun profil salarial"]')).toBeTruthy()
  })
  //  Le nom porte le poids, le motif est une mention discrète : deux
  //  traitements distincts là où la capture n'en montrait qu'un.
  expect(document.body.textContent).toContain('2 prêts')
})

it('offre la réparation, et la met en avant', async () => {
  const actions = await afficher()
  const reparer = bouton('Compléter les 4 profils')
  expect(reparer).toBeTruthy()
  //  C'est le bouton PLEIN de la modale : celui qui répare, pas celui qui force.
  //  Il porte l'encre pleine, là où l'autre reste en papier contouré.
  expect(reparer.style.backgroundColor).toBe('var(--charte-encre)')
  //  Sur l'encre, le texte prend la surface : elle s'inverse avec le thème.
  expect(reparer.style.color).toBe('var(--charte-surface)')
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

it('se centre vraiment — sans `safe center`, sans rembourrage qui déplace', async () => {
  await afficher()
  const fond = document.querySelector('.pw-resume-controles-fond')

  //  `safe center` n'est pas reconnu sur `justify-content` : la déclaration
  //  tombait et la fenêtre partait en haut à gauche (capture du 28/11).
  expect(fond.style.justifyContent).toBe('center')
  expect(fond.style.alignItems).toBe('center')

  //  Le rembourrage est symétrique et sert de marge de respiration ; aucun
  //  rembourrage ASYMÉTRIQUE qui pousserait la fenêtre vers le bas.
  expect(fond.style.padding).toBe('28px 24px')

  //  Si la fenêtre est plus haute que l'écran, c'est le VOILE qui défile —
  //  avec `margin: auto` sur la feuille, le haut reste atteignable.
  expect(fond.style.overflowY).toBe('auto')
  expect(document.querySelector('.pw-resume-controles').style.margin).toBe('auto')
})

it('ne peut plus s’effondrer en bande — sa hauteur ne dépend d’aucune mesure', async () => {
  //  LE DÉFAUT DU 02/12, verrouillé ici : « on ne le voit même plus ».
  //  Une zone mesurée à l'envers donnait une `max-height` NÉGATIVE, et la
  //  fenêtre se réduisait à sa bordure. La feuille ne lit plus la zone du
  //  tout : elle prend sa hauteur pleine.
  await afficher({ zoneHaute: 168, zoneBasse: 732 })
  const feuille = document.querySelector('.pw-resume-controles')
  expect(feuille.style.maxHeight).toBe('none')
  expect(feuille.style.height).toBe('')
})

it('dit la vérité au singulier comme au pluriel', async () => {
  await act(async () => racine.render(<ResumeControles blockers={[QUATRE[0]]} ready={0} onFermer={vi.fn()} />))
  expect(document.getElementById('pw-resume-titre').textContent).toContain('Un profil salarial manque')
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
  //  Et le rabat n'est jamais découpé : il est peint au dégradé.
  expect(source).not.toContain('clipPath')
})

it('la page ne peut plus annoncer une zone basse négative — la faute de la bande', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync('src/pages/PaieFiscalite.jsx', 'utf8')

  //  `.pw-fixe` est `position: sticky; top: 0` : il ne colle qu'EN HAUT.
  //  Tout l'écran sous la barre est du contenu, pas de la barre. Mesurer
  //  `bas = hauteurEcran − basDeLaBarre` donnait 732 px sur 900, donc une
  //  `max-height` de −32 px : la fenêtre s'écrasait à sa bordure. C'est la
  //  bande rayée de la capture du 02/12.
  expect(page).not.toContain('window.innerHeight || 0) - r.bottom')

  //  La zone basse est donc zéro, et elle est écrite noir sur blanc.
  expect(page).toMatch(/bas:\s*0/)
})
