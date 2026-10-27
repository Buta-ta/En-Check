// ═══════════════════════════════════════════════════════════
// LA BARRE LATÉRALE PERSONNELLE — les gestes à l'écran
//
// Ce que ces tests défendent : renommer une page et le retrouver
// après un rechargement, descendre une page au clavier, créer un
// groupe, colorer un groupe, rétablir l'ordre d'origine, et ne
// jamais afficher une page dont le module est éteint.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import SidebarNavigation from '../../components/SidebarNavigation'
import { cleStockage } from '../../lib/navigationPerso'

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

async function ouvrir() {
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={['/pointages']}>
        <SidebarNavigation
          sections={SECTIONS}
          tabStates={{}}
          onSelect={surSelection}
          idAdministrateur="admin-1"
        />
      </MemoryRouter>,
    )
  })
  await laisser()
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((element) => element.textContent.trim().includes(texte))
const libelles = () => [...hote.querySelectorAll('.sidebar-link-label')].map((element) => element.textContent)
const champsPage = () => [...hote.querySelectorAll('.sn-champ--page')]
const titresGroupe = () => [...hote.querySelectorAll('.sidebar-section-label')].map((element) => element.textContent.trim())

async function cliquer(element) {
  expect(element, 'le contrôle à cliquer doit exister').toBeTruthy()
  await act(async () => element.click())
  await laisser()
}

async function ecrire(champ, valeur) {
  expect(champ).toBeTruthy()
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(champ, valeur)
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await laisser()
}

const memoire = () => {
  const brut = localStorage.getItem(cleStockage('admin-1'))
  return brut ? JSON.parse(brut) : null
}

describe('la barre, au repos', () => {
  it('dessine un groupe coloré par section, dans l’ordre', async () => {
    await ouvrir()
    expect(titresGroupe()).toEqual(['Aujourd’hui', 'Administration'])
    expect(hote.querySelectorAll('.sn-groupe-point')).toHaveLength(2)
  })

  it('affiche les pages visibles, dans l’ordre du code', async () => {
    await ouvrir()
    expect(libelles()).toEqual(['Vue d’ensemble', 'Pointages', 'Équipe', 'Entreprises', 'Messages système'])
  })

  it('n’affiche pas une page dont le module est éteint', async () => {
    await ouvrir()
    expect(libelles()).not.toContain('Planning')
  })

  it('marque la page courante', async () => {
    await ouvrir()
    const actif = hote.querySelector('.sidebar-link.is-active')
    expect(actif.textContent).toContain('Pointages')
    expect(actif.getAttribute('aria-current')).toBe('page')
  })

  it('prévient la coque quand on choisit une page', async () => {
    await ouvrir()
    await cliquer([...hote.querySelectorAll('.sidebar-link')].find((element) => element.textContent.includes('Équipe')))
    expect(surSelection).toHaveBeenCalledTimes(1)
    expect(surSelection.mock.calls[0][0].path).toBe('/employes')
  })

  it('affiche le compteur d’une page qui en a un', async () => {
    await ouvrir()
    expect(hote.querySelector('.sidebar-link-count').textContent).toBe('3')
  })
})

describe('le mode Personnaliser', () => {
  it('s’ouvre et se referme', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    expect(hote.querySelector('.sn-aide')).toBeTruthy()
    expect(champsPage()).toHaveLength(5)
    await cliquer(bouton('Terminer'))
    expect(hote.querySelector('.sn-aide')).toBeNull()
  })

  it('se referme avec Échap', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    await laisser()
    expect(hote.querySelector('.sn-aide')).toBeNull()
  })

  it('renomme une page et retient le nom', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    await ecrire(champsPage()[1], 'Pointages du matin')
    expect(champsPage()[1].value).toBe('Pointages du matin')
    expect(memoire().pages.find((page) => page.cle === '/pointages').libelle).toBe('Pointages du matin')
  })

  it('retrouve le nom après un rechargement', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    await ecrire(champsPage()[1], 'Pointages du matin')

    act(() => racine.unmount())
    racine = createRoot(hote)
    await ouvrir()
    expect(libelles()).toContain('Pointages du matin')
  })

  it('descend une page au clavier et garde l’ordre', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    const avant = champsPage().map((champ) => champ.value)
    await cliquer(hote.querySelector('[aria-label="Descendre Vue d’ensemble"]'))
    const apres = champsPage().map((champ) => champ.value)
    expect(apres[0]).toBe(avant[1])
    expect(apres[1]).toBe(avant[0])
  })

  it('range une page dans un autre groupe par le sélecteur', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    const select = hote.querySelector('.sn-page select')
    expect(select).toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'groupe-2')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await laisser()
    expect(memoire().pages.find((page) => page.cle === '/dashboard').groupe).toBe('groupe-2')
  })

  it('crée un groupe nommé, avec sa couleur', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    await ecrire(hote.querySelector('[aria-label="Nom du nouveau groupe"]'), 'Mon atelier')
    await cliquer(hote.querySelector('[aria-label="Couleur du nouveau groupe : Olive"]'))
    await cliquer(bouton('Créer'))
    expect(memoire().groupes.map((groupe) => groupe.nom)).toContain('Mon atelier')
    expect(memoire().groupes.at(-1).couleur).toBe('olive')
  })

  it('colore un groupe existant', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    const olive = hote.querySelector('[aria-label="Couleur du groupe Administration : Olive"]')
    await cliquer(olive)
    expect(olive.getAttribute('aria-pressed')).toBe('true')
    expect(memoire().groupes.find((groupe) => groupe.id === 'groupe-2').couleur).toBe('olive')
  })

  it('rétablit la navigation d’origine', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    await ecrire(champsPage()[1], 'Pointages du matin')
    await cliquer(bouton('Rétablir'))
    expect(champsPage()[1].value).toBe('Pointages')
    expect(memoire().pages.find((page) => page.cle === '/pointages').libelle).toBe('Pointages')
  })

  it('annonce les gestes aux lecteurs d’écran', async () => {
    await ouvrir()
    await cliquer(bouton('Personnaliser la navigation'))
    expect(hote.querySelector('.sn-annonce').getAttribute('aria-live')).toBe('polite')
    await cliquer(hote.querySelector('[aria-label="Descendre Vue d’ensemble"]'))
    expect(hote.querySelector('.sn-annonce').textContent).toContain('descendue')
  })
})
