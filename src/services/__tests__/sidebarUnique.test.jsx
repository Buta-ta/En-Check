// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════
// LA SIDEBAR UNIQUE — le reproche du 24/11 :
// « dans la page employée quand je clique sur la sidebar, rien ne se
// passe, le rail ne se déroule pas ».
//
// Ces tests cliquent POUR DE VRAI. Pas de lecture de fichier : un clic,
// puis on regarde ce qui est à l'écran.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Calendar, LayoutDashboard, Users } from 'lucide-react'
import SidebarUnique from '../../components/SidebarUnique'
import { SidebarProvider } from '../../hooks/useSidebarRepliee.jsx'

const SECTIONS = [
  {
    id: 'accueil',
    label: 'Accueil',
    icon: LayoutDashboard,
    items: [{ label: 'Vue d\u2019ensemble', icon: LayoutDashboard, path: '/dashboard', show: true }],
  },
  {
    id: 'equipe',
    label: 'Équipe',
    icon: Users,
    items: [
      { label: 'Employés', icon: Users, path: '/employes', show: true },
      { label: 'Planning', icon: Calendar, path: '/planning', show: true },
    ],
  },
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

const laisser = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

async function monter(route = '/employes') {
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={[route]}>
        <SidebarProvider>
          <SidebarUnique sections={SECTIONS} nomAdmin="Butacode" darkMode={false} />
        </SidebarProvider>
      </MemoryRouter>,
    )
  })
  await laisser()
}

const parTexte = (selecteur, texte) => Array.from(document.querySelectorAll(selecteur))
  .find((el) => el.textContent.replace(/\s+/g, ' ').trim().includes(texte))

const parAria = (nom) => document.querySelector(`[aria-label="${nom}"]`)

describe('la sidebar se déroule quand on clique (le reproche du 24/11)', () => {
  it('s’ouvre avec le panneau visible', async () => {
    await monter()
    expect(document.querySelector('input[aria-label="Filtrer la navigation"]')).toBeTruthy()
    expect(parTexte('.sb-lien', 'Employés')).toBeTruthy()
  })

  it('se referme par le chevron, puis se ROUVRE par une icône du rail', async () => {
    await monter()
    await act(async () => parAria('Réduire la barre de navigation en icônes').click())
    expect(document.querySelector('.sb').className).toContain('sb--repliee')

    // ⚠️ LE CŒUR DU REPROCHE : cliquer une icône du rail doit DÉPLIER
    const rail = document.querySelector('.sb-rail')
    const iconeEquipe = Array.from(rail.querySelectorAll('button'))
      .find((b) => b.getAttribute('aria-label') === 'Équipe')
    await act(async () => iconeEquipe.click())
    expect(document.querySelector('.sb').className).not.toContain('sb--repliee')
  })

  it('garde l’état quand on change de page (une seule sidebar pour tout)', async () => {
    await monter()
    await act(async () => parAria('Réduire la barre de navigation en icônes').click())
    expect(localStorage.getItem('encheck.sidebar.repliee')).toBe('1')
    await act(() => racine.unmount())
    racine = createRoot(hote)

    await monter('/dashboard')
    expect(document.querySelector('.sb').className).toContain('sb--repliee')
  })

  it('filtre la navigation, et ne garde que ce qui correspond', async () => {
    await monter()
    const champ = document.querySelector('input[aria-label="Filtrer la navigation"]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(champ, 'plan')
      champ.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    await laisser()
    expect(parTexte('.sb-lien', 'Planning')).toBeTruthy()
    expect(parTexte('.sb-lien', 'Vue d')).toBeFalsy()
  })

  it('replie un groupe, puis le déplie', async () => {
    await monter()
    const titre = parTexte('.sb-feuillet-titre', 'Équipe')
    expect(parTexte('.sb-lien', 'Planning')).toBeTruthy()
    await act(async () => titre.click())
    expect(parTexte('.sb-lien', 'Planning')).toBeFalsy()
    await act(async () => titre.click())
    expect(parTexte('.sb-lien', 'Planning')).toBeTruthy()
  })

  it('marque la page courante, une seule fois', async () => {
    await monter('/employes')
    const actifs = document.querySelectorAll('.sb-lien.is-actif')
    expect(actifs.length).toBe(1)
    expect(actifs[0].textContent).toContain('Employés')
  })
})

describe('le panneau est ivoire, pas espresso (sa capture du 24/11)', () => {
  const UNIQUE = readFileSync('src/components/SidebarUnique.css', 'utf8')
  const ANCIEN = readFileSync('src/components/SidebarNavigation.css', 'utf8')
  const REGISTRE = readFileSync('src/components/RegistreRepli.jsx', 'utf8')

  it('ne laisse AUCUNE règle .registre dans l’ancien fichier', () => {
    // ⚠️ .registre { background: var(--sidebar) } = espresso, et il gagnait
    // par l'ordre des imports : le panneau sortait sombre.
    expect(ANCIEN).not.toMatch(/\.registre\s*\{/)
    expect(ANCIEN).not.toMatch(/registre--anime/)
  })

  it('nomme le registre d’un préfixe qui ne peut rien attraper d’autre', () => {
    expect(REGISTRE).toContain('sn-registre')
    expect(REGISTRE).not.toMatch(/className=\{`registre/)
  })

  it('donne au panneau la surface ivoire de la charte, contour 2 px', () => {
    expect(UNIQUE).toMatch(/\.sn-registre \{[\s\S]{0,400}background: var\(--charte-surface\)/)
    expect(UNIQUE).toMatch(/\.sn-registre \{[\s\S]{0,400}border: 2px solid var\(--charte-encre\)/)
    // et surtout JAMAIS --sidebar, qui vaut l'espresso
    expect(UNIQUE).not.toMatch(/\.sn-registre \{[\s\S]{0,400}var\(--sidebar\)/)
  })

  it('n’a plus de filet vertical qui pend sous les groupes', () => {
    // c'est lui qui creusait les grands vides sur sa capture
    expect(UNIQUE).not.toMatch(/\.sb-liste \{[\s\S]{0,300}border-left/)
    expect(UNIQUE).not.toMatch(/\.sb-feuillet-liste \{[\s\S]{0,300}border-left/)
  })

  it('fait remplir la hauteur par la pile : plus de vide en bas', () => {
    expect(UNIQUE).toMatch(/\.sb-feuillet:not\(\.est-etendu\) \{[\s\S]{0,200}flex: 1 1 0/)
    expect(UNIQUE).toMatch(/\.sb-feuillet\.est-etendu \{ flex: 0 0 auto; \}/)
  })

  it('empile des feuilles avec un escalier qui suit la profondeur', () => {
    expect(UNIQUE).toContain('.sb-feuillet')
    // l'escalier vient de --etage, jamais de l'ouverture
    expect(UNIQUE).toMatch(/margin-right: calc\(\(var\(--etage, 0\) \/ var\(--sb-pile, 1\)\) \* 34px\)/)
    // une ombre qui DÉPASSE à droite : c'est la tranche de la feuille
    expect(UNIQUE).toMatch(/\.sb-feuillet \{[\s\S]{0,300}box-shadow: 4px 3px 0 var\(--charte-encre\)/)
    expect(UNIQUE).toMatch(/\.sb-feuillet:not\(\.est-etendu\) \{[\s\S]{0,120}flex: 1 1 0/)
  })
})
