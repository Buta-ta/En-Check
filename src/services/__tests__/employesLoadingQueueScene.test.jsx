// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import EmployesLoadingScreen, {
  EMPLOYES_INTRO_MS,
  ETAPES_CHARGEMENT_EMPLOYES,
} from '../../components/EmployesLoadingScreen'

let host
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const monter = (props) =>
  act(async () => {
    root.render(<EmployesLoadingScreen {...props} />)
  })

describe('EmployesLoadingScreen — Concept A : file devant la borne de pointage', () => {
  it('affiche l’illustration choisie et active les calques des 4 personnes une fois chargés', async () => {
    await monter({ etape: 1 })
    const approuvee = host.querySelector('.emp-loading-approved')
    expect(approuvee.getAttribute('src')).toBe('/images/employes-loading-approved.webp')
    expect(host.querySelector('.emp-loading-stage.is-ready')).toBeNull()

    const images = host.querySelectorAll('.emp-loading-stage img')
    expect(images).toHaveLength(6)
    for (const img of images) {
      await act(async () => {
        img.dispatchEvent(new Event('load'))
      })
    }
    expect(host.querySelector('.emp-loading-stage.is-ready')).not.toBeNull()
  })

  it('suit la progression réelle sur les 4 étapes et affiche le nom de l’entreprise', async () => {
    await monter({ etape: 2, progression: 55, nomEntreprise: 'Pharmacie du Soleil' })
    expect(host.textContent).toContain('Pharmacie du Soleil')
    expect(host.textContent).toContain('55 %')
    expect(host.textContent).toContain('Étape 2/4')
    expect(host.querySelector('.emp-queue-pip--1.is-done')?.textContent).toBe('✓')
    expect(host.querySelector('.emp-queue-pip--2.is-active')?.textContent).toBe('2')

    await monter({ etape: 4, progression: 100, dataReady: true, nomEntreprise: 'Pharmacie du Soleil' })
    expect(host.textContent).toContain('100 %')
    expect(host.textContent).toContain('L’espace collaborateurs est prêt')
    expect(host.querySelectorAll('.emp-queue-pip.is-done')).toHaveLength(4)
  })

  it('maintient la scène quelques secondes courtes puis déclenche onIntroDone', async () => {
    const fin = vi.fn()
    await monter({ onIntroDone: fin, dataReady: true })
    await act(async () => {
      vi.advanceTimersByTime(EMPLOYES_INTRO_MS - 1)
    })
    expect(fin).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(fin).toHaveBeenCalledTimes(1)
  })

  it('coupe l’attente et les animations si prefers-reduced-motion est actif', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const fin = vi.fn()
    await monter({ onIntroDone: fin })
    expect(fin).toHaveBeenCalledTimes(1)
    const css = readFileSync('src/components/EmployesLoadingScreen.css', 'utf8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('animation: none !important')
  })

  it('dispose des 6 fichiers WebP optimisés et branche la progression réelle dans Employes.jsx', () => {
    for (const suffixe of ['approved', 'decor', 'p1', 'p2', 'p3', 'p4']) {
      const chemin = `public/images/employes-loading-${suffixe}.webp`
      expect(existsSync(chemin)).toBe(true)
      expect(readFileSync(chemin).subarray(8, 12).toString()).toBe('WEBP')
      expect(statSync(chemin).size).toBeLessThan(220 * 1024)
    }
    expect(ETAPES_CHARGEMENT_EMPLOYES).toHaveLength(4)

    const page = readFileSync('src/pages/Employes.jsx', 'utf8')
    expect(page).toContain('etape={etapeChargement}')
    expect(page).toContain('progression={progressionChargement}')
    expect(page).toContain('dataReady={!loading}')
  })
})
