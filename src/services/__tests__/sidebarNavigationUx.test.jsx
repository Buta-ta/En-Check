// ═══════════════════════════════════════════════════════════
// LA BARRE LATÉRALE — le modèle de la maquette (15/10)
//
// Ce que ces tests défendent, au-dessus du mode Personnaliser :
// 1. les groupes se replient et se redéplient, avec un badge
//    additionné quand le groupe est replié, et le repli est
//    retenu par administrateur (clé _repli_v1) ;
// 2. le filtre réduit la barre aux pages qui correspondent
//    (accents et casse ignorés), sans jamais masquer le vide ;
// 3. le rail « icônes seules » (desktop) : libellé redevient
//    un tooltip au survol, aria-label au clavier, filtre et
//    replis inappliqués pour ne jamais faire disparaître
//    une icône.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import SidebarNavigation from '../../components/SidebarNavigation'
import { cleReplis, chargerReplis, sauvegarderReplis } from '../../lib/navigationPerso'

const SECTIONS = [
  {
    label: 'Aujourd’hui',
    items: [
      { label: 'Vue d’ensemble', path: '/dashboard', show: true },
      { label: 'Pointages', path: '/pointages', show: true, count: 3, Icone: null },
      { label: 'Équipe', path: '/employes', show: true },
      { label: 'Planning', path: '/planning', show: false },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Entreprises', path: '/entreprises', show: true },
      { label: 'Messages système', path: '/system-messages', show: true },
    ],
  },
]

let hote
let racine
const surSelection = vi.fn()

beforeEach(() => {
  localStorage.clear()
  surSelection.mockReset()
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
})

afterEach(() => {
  act(() => racine.unmount())
  hote.remove()
})

const laisser = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

async function ouvrir(props = {}) {
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={['/pointages']}>
        <SidebarNavigation
          sections={SECTIONS}
          tabStates={{}}
          onSelect={surSelection}
          idAdministrateur="admin-1"
          {...props}
        />
      </MemoryRouter>,
    )
  })
  await laisser()
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((element) => element.textContent.trim().includes(texte))
const chevron = (nomGroupe) => {
  const etiquettes = [...hote.querySelectorAll('.sidebar-section-label')]
  const etiquette = etiquettes.find((element) => element.textContent.includes(nomGroupe))
  return etiquette?.querySelector('.sn-chevron')
}
const libelles = () => [...hote.querySelectorAll('.sidebar-link-label')].map((element) => element.textContent)
const champFiltre = () => hote.querySelector('.sn-filtre input')

async function cliquer(element) {
  expect(element, 'le contrôle à cliquer doit exister').toBeTruthy()
  await act(async () => element.click())
  await laisser()
}

async function ecrire(champ, valeur) {
  expect(champ, 'le champ doit exister').toBeTruthy()
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(champ, valeur)
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await laisser()
}

async function survoler(element) {
  expect(element).toBeTruthy()
  await act(async () => { element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
  await laisser()
}

async function quitter(element) {
  expect(element).toBeTruthy()
  await act(async () => { element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })) })
  await laisser()
}

describe('les groupes repliables (accordeon)', () => {
  it('chaque groupe a un chevron, déplié au départ', async () => {
    await ouvrir()
    const chevrons = hote.querySelectorAll('.sn-chevron')
    expect(chevrons).toHaveLength(2)
    for (const chevron of chevrons) expect(chevron.getAttribute('aria-expanded')).toBe('true')
  })

  it('replier un groupe masque ses pages et affiche le total en badge', async () => {
    await ouvrir()
    await cliquer(chevron('Aujourd’hui'))
    expect(libelles()).toEqual(['Entreprises', 'Messages système'])
    const etiquette = [...hote.querySelectorAll('.sidebar-section-label')].find((element) => element.textContent.includes('Aujourd’hui'))
    expect(etiquette.classList.contains('est-repliee')).toBe(true)
    expect(etiquette.querySelector('.sidebar-section-count').textContent).toBe('3')
  })

  it('replier un groupe sans compteur n’affiche pas de badge', async () => {
    await ouvrir()
    await cliquer(chevron('Administration'))
    const etiquette = [...hote.querySelectorAll('.sidebar-section-label')].find((element) => element.textContent.includes('Administration'))
    expect(etiquette.querySelector('.sidebar-section-count')).toBeNull()
  })

  it('déplier de nouveau ramène les pages', async () => {
    await ouvrir()
    await cliquer(chevron('Aujourd’hui'))
    await cliquer(chevron('Aujourd’hui'))
    expect(libelles()).toEqual(['Vue d’ensemble', 'Pointages', 'Équipe', 'Entreprises', 'Messages système'])
  })

  it('retient le repli par administrateur et le retrouve après un rechargement', async () => {
    await ouvrir()
    await cliquer(chevron('Aujourd’hui'))
    const brut = localStorage.getItem(cleReplis('admin-1'))
    expect(JSON.parse(brut)).toContain('groupe-1')

    act(() => racine.unmount())
    racine = createRoot(hote)
    await ouvrir()
    expect(libelles()).toEqual(['Entreprises', 'Messages système'])
    expect(chargerReplis(null, 'admin-1')).toContain('groupe-1')
  })

  it('le repli ne s’applique pas en mode Personnaliser', async () => {
    await ouvrir()
    await cliquer(chevron('Aujourd’hui'))
    expect(libelles()).toEqual(['Entreprises', 'Messages système'])

    await cliquer(bouton('Personnaliser la navigation'))
    // Le chevron disparaît et les pages reviennent pour être rangeables.
    expect(hote.querySelector('.sn-chevron')).toBeNull()
    expect(libelles()).toEqual([])
    expect(hote.querySelectorAll('.sn-champ--page')).toHaveLength(5)
  })
})

describe('le filtre de navigation', () => {
  it('ne garde que les pages qui correspondent, accents et casse ignorés', async () => {
    await ouvrir()
    await ecrire(champFiltre(), 'EQUIPE')
    expect(libelles()).toEqual(['Équipe'])
  })

  it('affiche un message quand aucune page ne correspond', async () => {
    await ouvrir()
    await ecrire(champFiltre(), 'zzz')
    expect(libelles()).toEqual([])
    expect(hote.querySelector('.sn-vide--filtre').textContent).toContain('zzz')
  })

  it('le bouton d’effacement ramène toute la barre', async () => {
    await ouvrir()
    await ecrire(champFiltre(), 'point')
    expect(libelles()).toEqual(['Pointages'])
    await cliquer(hote.querySelector('[aria-label="Effacer le filtre"]'))
    expect(libelles()).toEqual(['Vue d’ensemble', 'Pointages', 'Équipe', 'Entreprises', 'Messages système'])
  })

  it('force un groupe replié à se déplier pendant le filtrage', async () => {
    await ouvrir()
    await cliquer(chevron('Aujourd’hui'))
    await ecrire(champFiltre(), 'pointages')
    expect(libelles()).toEqual(['Pointages'])
    // Le groupe reste replié dans la mémoire une fois le filtre effacé.
    await cliquer(hote.querySelector('[aria-label="Effacer le filtre"]'))
    expect(libelles()).toEqual(['Entreprises', 'Messages système'])
  })

  it('le filtre n’est pas appliqué en mode Personnaliser', async () => {
    await ouvrir()
    await ecrire(champFiltre(), 'point')
    await cliquer(bouton('Personnaliser la navigation'))
    expect(hote.querySelectorAll('.sn-champ--page')).toHaveLength(5)
  })
})

describe('le rail « icônes seules » (desktop)', () => {
  it('chaque bouton porte le libellé en aria-label pour le clavier', async () => {
    await ouvrir({ rail: true })
    const lien = [...hote.querySelectorAll('.sidebar-link')].find((element) => element.textContent.includes('Vue d’ensemble'))
    expect(lien.getAttribute('aria-label')).toBe('Vue d’ensemble')
  })

  it('le libellé devient un tooltip au survol, puis disparaît', async () => {
    await ouvrir({ rail: true })
    const lien = [...hote.querySelectorAll('.sidebar-link')].find((element) => element.textContent.includes('Pointages'))
    expect(document.querySelector('.sn-rail-tooltip')).toBeNull()
    await survoler(lien)
    const tooltip = document.querySelector('.sn-rail-tooltip')
    expect(tooltip).toBeTruthy()
    expect(tooltip.textContent).toBe('Pointages')
    await quitter(lien)
    expect(document.querySelector('.sn-rail-tooltip')).toBeNull()
  })

  it('le filtre ne masque jamais une icône en rail', async () => {
    await ouvrir({ rail: true })
    await ecrire(champFiltre(), 'point')
    expect(libelles()).toEqual(['Vue d’ensemble', 'Pointages', 'Équipe', 'Entreprises', 'Messages système'])
  })

  it('un groupe replié reste déplié en rail', async () => {
    sauvegarderReplis(null, 'admin-1', ['groupe-1'])
    await ouvrir({ rail: true })
    expect(libelles()).toContain('Vue d’ensemble')
  })
})
