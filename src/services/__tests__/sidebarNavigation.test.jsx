// ═══════════════════════════════════════════════════════════
// LA SIDEBAR BENTO — les gestes à l'écran
//
// Ce que ces tests défendent : les groupes s'affichent dans
// l'ordre, une page dont le module est éteint ne s'affiche
// jamais, la page courante est marquée, le compteur d'attente
// est visible, le repli en rail se retient par administrateur,
// le profil super admin mène aux Administrateurs, et la
// déconnexion reste un vrai bouton annoncé.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import BentoSidebar from '../../pages/dashboard/BentoSidebar'

const SECTIONS = [
  {
    label: 'Aujourd’hui',
    items: [
      { label: 'Vue d’ensemble', path: '/dashboard', show: true },
      { label: 'Pointages', path: '/pointages', show: true, count: 3 },
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
const surLogout = vi.fn()

beforeEach(() => {
  localStorage.clear()
  surSelection.mockReset()
  surLogout.mockReset()
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

async function ouvrir(chemin = '/pointages', props = {}) {
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={[chemin]}>
        <BentoSidebar
          sections={SECTIONS}
          tabStates={{}}
          onSelect={surSelection}
          idAdministrateur="admin-1"
          handleLogout={surLogout}
          adminName="Bintou K."
          adminRole="Super admin"
          adminInitials="BK"
          isSuperAdmin
          {...props}
        />
      </MemoryRouter>,
    )
  })
  await laisser()
}

const liens = () => [...hote.querySelectorAll('.bento-nav-item')]
const libelles = () => liens().map((a) => a.querySelector('.nav-label').textContent)
const titresGroupe = () => [...hote.querySelectorAll('.bento-nav-group-label')].map((e) => e.textContent.trim())

describe('la navigation', () => {
  it('dessine les groupes dans l’ordre, avec leurs libellés', async () => {
    await ouvrir()
    expect(titresGroupe()).toEqual(['Aujourd’hui', 'Administration'])
  })

  it('affiche les pages visibles, dans l’ordre du code', async () => {
    await ouvrir()
    expect(libelles()).toEqual(['Vue d’ensemble', 'Pointages', 'Équipe', 'Entreprises', 'Messages système'])
  })

  it('n’affiche pas une page dont le module est éteint', async () => {
    await ouvrir()
    expect(libelles()).not.toContain('Planning')
  })

  it('marque la page courante comme active', async () => {
    await ouvrir('/pointages')
    const actif = liens().find((a) => a.classList.contains('is-active'))
    expect(actif).toBeTruthy()
    expect(actif.querySelector('.nav-label').textContent).toBe('Pointages')
    expect(actif.getAttribute('aria-current')).toBe('page')
  })

  it('prévient la coque quand on choisit une page', async () => {
    await ouvrir()
    await act(async () => {
      liens()[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(surSelection).toHaveBeenCalledWith(expect.objectContaining({ path: '/dashboard' }))
  })

  it('affiche le compteur d’une page qui en a un', async () => {
    await ouvrir()
    const pointages = liens().find((a) => a.querySelector('.nav-label').textContent === 'Pointages')
    expect(pointages.querySelector('.bento-nav-badge')).toBeTruthy()
    expect(pointages.querySelector('.bento-nav-badge').textContent).toBe('3')
  })

  it('signale l’activité à examiner sur un onglet', async () => {
    // Le composant reçoit les sections telles que la page les construit ;
    // ici on vérifie que le point d'activité existe quand l'état le porte.
    const sectionsAvecTab = [
      { label: 'A', items: [{ label: 'Pointages', path: '/pointages', show: true, tabKey: 'POINTAGES' }] },
    ]
    await act(async () => {
      racine.render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <BentoSidebar
            sections={sectionsAvecTab}
            tabStates={{ POINTAGES: { tabKey: 'POINTAGES', viewed: false, activeTriggers: [{ priority: 'medium' }] } }}
            onSelect={surSelection}
            idAdministrateur="admin-1"
          />
        </MemoryRouter>,
      )
    })
    await laisser()
    expect(hote.querySelector('.bento-nav-dot')).toBeTruthy()
  })
})

describe('le repli en rail d’icônes', () => {
  it('s’ouvre et se referme', async () => {
    await ouvrir()
    const bouton = hote.querySelector('.bento-sidebar-collapse')
    const sidebar = hote.querySelector('.bento-sidebar')
    expect(sidebar.classList.contains('is-mini')).toBe(false)
    await act(async () => bouton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(sidebar.classList.contains('is-mini')).toBe(true)
    await act(async () => bouton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(sidebar.classList.contains('is-mini')).toBe(false)
  })

  it('se retient d’une visite à l’autre, par administrateur', async () => {
    await ouvrir()
    await act(async () => hote.querySelector('.bento-sidebar-collapse').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(localStorage.getItem('encheck_bento_sidebar_mini_v1:admin-1')).toBe('1')

    await ouvrir()
    const sidebar = hote.querySelector('.bento-sidebar')
    expect(sidebar.classList.contains('is-mini')).toBe(true)
  })

  it('annonce le geste au lecteur d’écran', async () => {
    await ouvrir()
    const bouton = hote.querySelector('.bento-sidebar-collapse')
    expect(bouton.getAttribute('aria-label')).toContain('Replier')
    expect(bouton.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('le pied de sidebar', () => {
  it('le profil super admin mène à la page Administrateurs', async () => {
    await ouvrir()
    const profil = hote.querySelector('a.sidebar-profile-link')
    expect(profil).toBeTruthy()
    expect(profil.getAttribute('href')).toBe('/admins')
    expect(profil.textContent).toContain('Bintou K.')
  })

  it('le profil simple n’est pas un lien', async () => {
    await ouvrir('/dashboard', { isSuperAdmin: false, adminRole: 'Administrateur' })
    expect(hote.querySelector('a.sidebar-profile-link')).toBe(null)
    expect(hote.querySelector('.sidebar-profile-link.is-statique')).toBeTruthy()
  })

  it('garde le lien espace employé', async () => {
    await ouvrir()
    const portail = hote.querySelector('a.bento-portal-link')
    expect(portail).toBeTruthy()
    expect(portail.getAttribute('href')).toBe('/employee/login')
  })

  it('la déconnexion est un vrai bouton qui rappelle la coque', async () => {
    await ouvrir()
    const bouton = hote.querySelector('.bento-logout')
    expect(bouton.getAttribute('aria-label')).toBe('Déconnexion')
    await act(async () => bouton.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(surLogout).toHaveBeenCalledTimes(1)
  })
})
