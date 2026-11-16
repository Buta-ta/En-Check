// ═══════════════════════════════════════════════════════════
// LA BARRE LATÉRALE — le modèle de la maquette (15/10)
//
// Ce que ces tests défendent, au-dessus du mode Personnaliser :
// 1. les groupes se replient et se redéplient, avec un badge
//    additionné quand le groupe est replié, et le repli est
//    retenu par administrateur (clé _repli_v1) ;
// 2. le filtre réduit la barre aux pages qui correspondent
//    (accents et casse ignorés), sans jamais masquer le vide ;
// 3. le rail d'icônes (colonne permanente, desktop) : une icône
//    par rubrique, libellé en tooltip au survol et en aria-label
//    au clavier, état actif de la rubrique courante, point quand
//    la rubrique a des éléments à traiter, et le menu du profil
//    sous l'avatar (portail).
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import SidebarNavigation from '../../components/SidebarNavigation'
import SidebarRail from '../../components/SidebarRail'
import { cleReplis, chargerReplis } from '../../lib/navigationPerso'

const SECTIONS = [
  {
    id: 'auj',
    label: 'Aujourd’hui',
    items: [
      { label: 'Vue d’ensemble', path: '/dashboard', show: true },
      { label: 'Pointages', path: '/pointages', show: true, count: 3, Icone: null },
      { label: 'Équipe', path: '/employes', show: true },
      { label: 'Planning', path: '/planning', show: false },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { label: 'Entreprises', path: '/entreprises', show: true },
      { label: 'Messages système', path: '/system-messages', show: true },
      // L'entrée « Personnalisation » : sans chemin, hors du modèle.
      { label: 'Personnalisation', show: true, rubrique: 'admin' },
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

    await cliquer(bouton('Personnalisation'))
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
    // L'entrée Personnalisation se masque pendant le filtrage :
    // on efface le filtre avant d'ouvrir le mode.
    await cliquer(hote.querySelector('[aria-label="Effacer le filtre"]'))
    await cliquer(bouton('Personnalisation'))
    await cliquer(bouton('Personnaliser la navigation'))
    expect(hote.querySelectorAll('.sn-champ--page')).toHaveLength(5)
  })
})

describe('le rail d’icônes (colonne permanente, desktop)', () => {
  let surRubrique
  let surMenuProfil
  let surDeconnexion

  beforeEach(() => {
    surRubrique = vi.fn()
    surMenuProfil = vi.fn()
    surDeconnexion = vi.fn()
  })

  async function ouvrirRail(props = {}) {
    await act(async () => {
      racine.render(
        <MemoryRouter initialEntries={['/pointages']}>
          <SidebarRail
            sections={SECTIONS}
            cheminActif="/pointages"
            onRubrique={surRubrique}
            surMenuProfil={surMenuProfil}
            surDeconnexion={surDeconnexion}
            profil={{ nom: 'Awa Diarra', initiales: 'AD', role: 'admin' }}
            {...props}
          />
        </MemoryRouter>,
      )
    })
    await laisser()
  }

  const iconeRubrique = (nom) => [...hote.querySelectorAll('.nav-rail-item')]
    .find((element) => element.getAttribute('aria-label') === nom)

  it('une icône par rubrique, le libellé passe en aria-label', async () => {
    await ouvrirRail()
    expect(iconeRubrique('Aujourd’hui')).toBeTruthy()
    expect(iconeRubrique('Administration')).toBeTruthy()
    // Une rubrique sans élément visible n’apparaît pas.
    expect(hote.querySelectorAll('.nav-rail-list .nav-rail-item')).toHaveLength(2)
  })

  it('la rubrique de la page courante est active, pas les autres', async () => {
    await ouvrirRail()
    expect(iconeRubrique('Aujourd’hui').classList.contains('is-active')).toBe(true)
    expect(iconeRubrique('Administration').classList.contains('is-active')).toBe(false)
  })

  it('un point signale la rubrique qui a des éléments à traiter', async () => {
    await ouvrirRail()
    // « Aujourd’hui » a Pointages avec un compteur de 3.
    expect(iconeRubrique('Aujourd’hui').querySelector('.nav-rail-dot')).toBeTruthy()
    expect(iconeRubrique('Administration').querySelector('.nav-rail-dot')).toBeNull()
  })

  it('cliquer une rubrique ouvre le panneau sur elle', async () => {
    await ouvrirRail()
    await cliquer(iconeRubrique('Administration'))
    expect(surRubrique).toHaveBeenCalledWith('admin')
  })

  it('le libellé devient un tooltip au survol, puis disparaît', async () => {
    await ouvrirRail()
    const cible = iconeRubrique('Aujourd’hui')
    expect(document.querySelector('.sn-rail-tooltip')).toBeNull()
    await survoler(cible)
    const tooltip = document.querySelector('.sn-rail-tooltip')
    expect(tooltip).toBeTruthy()
    expect(tooltip.textContent).toBe('Aujourd’hui')
    await quitter(cible)
    expect(document.querySelector('.sn-rail-tooltip')).toBeNull()
  })

  it('replié, le rail propose de déplier le panneau', async () => {
    const surBascule = vi.fn()
    await ouvrirRail({ panneauReplie: true, onBasculerPanneau: surBascule })
    const bascule = hote.querySelector('.nav-rail-bascule')
    expect(bascule).toBeTruthy()
    await cliquer(bascule)
    expect(surBascule).toHaveBeenCalledTimes(1)
  })

  it('le menu du profil s’ouvre sous l’avatar (portail) et déconnecte', async () => {
    await ouvrirRail({ menuProfilOuvert: true })
    const menu = document.querySelector('.sidebar-profile-menu.is-portail')
    expect(menu).toBeTruthy()
    expect(menu.textContent).toContain('Profil & administrateurs')
    expect(menu.textContent).toContain('Déconnexion')
    const deconnexion = [...menu.querySelectorAll('button')].find((element) => element.textContent.includes('Déconnexion'))
    await cliquer(deconnexion)
    expect(surDeconnexion).toHaveBeenCalledTimes(1)
  })
})
