// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════
// 🧵 LE CHARGEMENT DE COMPTES & ACCÈS
//
// Une seule illustration, deux lectures. L'écran ne doit pas
// clignoter sur un chargement rapide : il n'apparaît qu'au-delà
// de 300 ms, et « Passer l'animation » ne le ramène jamais.
// ═══════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import AdminsLoadingScreen from '../../components/AdminsLoadingScreen'
import AdminAccounts from '../../pages/AdminAccounts'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'auth-super' } } }),
      mfa: { listFactors: async () => ({ data: { totp: [] } }) },
    },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => new Promise(() => {}),
        single: () => new Promise(() => {}),
      }
      return q
    },
    rpc: async () => ({ data: null, error: null }),
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

// La lecture ne répond jamais : on veut voir le chargement, pas la page.
vi.mock('../../services/adminAccounts', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    currentAdminAccount: () => new Promise(() => {}),
  }
})

const ROOT = path.resolve(import.meta.dirname, '../../..')
let root, host

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('1. la case de BD', () => {
  it('dessine les cauris du Fa, en deux lectures', async () => {
    await act(async () => {
      root.render(<AdminsLoadingScreen darkMode onSkip={() => {}} />)
    })
    const image = host.querySelector('.aa-loading img')
    expect(image.getAttribute('src')).toBe('/images/admins-loading-fa.jpg')
    expect(image.getAttribute('alt')).toContain('Cauris')
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    expect(host.querySelectorAll('.aa-loading-etape')).toHaveLength(2)
    expect(host.textContent).toContain('Étape 1 · Les cauris sont jetés')
    expect(host.textContent).toContain('Le signe se lit')
    // la seconde lecture change le cartouche, pas l'image
    await act(async () =>
      host.querySelectorAll('.aa-loading-etape')[1].click(),
    )
    expect(host.textContent).toContain('Étape 2 · Le signe se lit')
    expect(host.querySelectorAll('.aa-loading img')).toHaveLength(1)
    // l'image est bien livrée avec le site, pas seulement référencée
    expect(fs.existsSync(path.join(ROOT, 'public/images/admins-loading-fa.jpg'))).toBe(true)
  })

  it('ne raconte rien de faux sur les données', async () => {
    await act(async () => {
      root.render(<AdminsLoadingScreen darkMode onSkip={() => {}} />)
    })
    expect(host.textContent).toContain('Lecture des comptes')
    await act(async () =>
      host.querySelectorAll('.aa-loading-etape')[1].click(),
    )
    const texte = host.textContent
    expect(texte).toContain('Composition des rôles')
    // aucun chiffre, aucun résultat annoncé pendant le chargement
    expect(texte).not.toMatch(/\d+\s*(comptes?|administrateurs?)/i)
  })
})

describe('2. dans la page', () => {
  it('n’apparaît que si le chargement dure, et se laisse passer', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>,
      )
    })
    // sous 300 ms, pas d'écran : un éclair serait pire que rien
    expect(host.querySelector('.aa-loading')).toBeNull()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 380))
    })
    expect(host.querySelector('.aa-loading')).not.toBeNull()

    await act(async () => host.querySelector('.aa-loading-passer').click())
    expect(host.querySelector('.aa-loading')).toBeNull()
    // et il ne revient pas tout seul
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 380))
    })
    expect(host.querySelector('.aa-loading')).toBeNull()
  })
})
