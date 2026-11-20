// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════
// LE SÉLECTEUR D'ENTREPRISE — sa maquette du 24/11
//   「 la bande sort du cadre sans afficher le sidebar 」
// et : un clic dans le vide rabat la sidebar.
//
// Ces tests cliquent pour de vrai.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { LayoutDashboard, Users } from 'lucide-react'
import SidebarUnique from '../../components/SidebarUnique'
import { SidebarProvider } from '../../hooks/useSidebarRepliee.jsx'

const SECTIONS = [
  { id: 'accueil', label: 'Accueil', icon: LayoutDashboard, items: [{ label: 'Vue d’ensemble', icon: LayoutDashboard, path: '/dashboard', show: true }] },
  { id: 'equipe', label: 'Équipe', icon: Users, items: [{ label: 'Employés', icon: Users, path: '/employes', show: true }] },
]
const ENTREPRISES = [
  { id: 'e1', name: 'Maison Koffi', code: 'MK-01' },
  { id: 'e2', name: 'Abomey Textile', code: 'AT-02' },
  { id: 'e3', name: 'Porto Novo Fresh', code: 'PN-03' },
]

let hote
let racine

beforeEach(() => {
  localStorage.clear()
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
})

afterEach(() => {
  act(() => racine.unmount())
  hote.remove()
})

const laisser = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

async function monter(props = {}) {
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={['/employes']}>
        <SidebarProvider>
          <SidebarUnique sections={SECTIONS} nomAdmin="Butacode" darkMode={false}
            entreprises={ENTREPRISES} entrepriseActive={ENTREPRISES[0]}
            {...props} />
        </SidebarProvider>
      </MemoryRouter>,
    )
  })
  await laisser()
}

const bande = () => document.querySelector('.se-bande')
const liste = () => document.querySelector('.se-liste')

describe('la bande d’entreprise dans le rail', () => {
  it('écrit le nom de l’entreprise à la verticale', async () => {
    await monter()
    const b = bande()
    expect(b).toBeTruthy()
    expect(b.textContent).toContain('Maison Koffi')
    // ⚠️ l'écriture debout est le geste de sa maquette
    const CSS = (await import('node:fs')).readFileSync('src/components/SidebarUnique.css', 'utf8')
    expect(CSS).toMatch(/\.se-bande-nom \{[\s\S]{0,200}writing-mode: vertical-rl/)
  })

  it('ouvre la liste au clic, et montre toutes les entreprises', async () => {
    await monter()
    expect(liste()).toBeNull()
    await act(async () => bande().click())
    expect(liste()).toBeTruthy()
    expect(liste().textContent).toContain('Maison Koffi')
    expect(liste().textContent).toContain('Abomey Textile')
    expect(liste().textContent).toContain('Porto Novo Fresh')
    expect(liste().textContent).toContain('Toutes les entreprises')
  })

  it('N’OUVRE PAS la navigation : c’est tout le point', async () => {
    await monter()   // on part replié
    await act(async () => document.querySelector('[aria-label="Réduire la barre de navigation en icônes"]').click())
    expect(document.querySelector('.sb').className).toContain('sb--repliee')

    // on ouvre la liste d'entreprises
    await act(async () => bande().click())
    expect(liste()).toBeTruthy()
    // ⚠️ la barre doit RESTER fermée
    expect(document.querySelector('.sb').className).toContain('sb--repliee')
  })

  it('choisit une entreprise et referme la liste', async () => {
    let choisi = null
    await monter({ surEntreprise: (e) => { choisi = e } })
    await act(async () => bande().click())
    const ligne = Array.from(liste().querySelectorAll('.se-ligne'))
      .find((l) => l.textContent.includes('Abomey Textile'))
    await act(async () => ligne.click())
    expect(choisi).toBeTruthy()
    expect(choisi.name).toBe('Abomey Textile')
    expect(liste()).toBeNull()
  })
})

describe('le clic dans le vide rabat la sidebar', () => {
  it('referme une barre ouverte', async () => {
    await monter()
    expect(document.querySelector('.sb').className).not.toContain('sb--repliee')
    await act(async () => {
      document.body.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
    })
    await laisser()
    expect(document.querySelector('.sb').className).toContain('sb--repliee')
  })

  it('ne referme pas quand on clique DANS la barre', async () => {
    await monter()
    await act(async () => {
      document.querySelector('.sb-rail').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
    })
    await laisser()
    expect(document.querySelector('.sb').className).not.toContain('sb--repliee')
  })
})
