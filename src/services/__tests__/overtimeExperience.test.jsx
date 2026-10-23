// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext'
import {
  OvertimeNavigation,
  OvertimeCalculationGuide,
  OvertimeLoadingScreen,
} from '../../components/OvertimeExperience'

it('offers exactly four real routes and toggles the persisted global theme', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.setItem('encheck_admin_dark_mode_v2', 'false')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  function Navigation() {
    const { darkMode, toggleTheme } = useTheme()
    return (
      <OvertimeNavigation darkMode={darkMode} onToggleTheme={toggleTheme} />
    )
  }
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <Navigation />
          </ThemeProvider>
        </MemoryRouter>,
      ),
    )
    expect(
      [...host.querySelectorAll('nav a')].map((a) => a.getAttribute('href')),
    ).toEqual(['/pointages', '/planning', '/employes', '/paie'])
    await act(async () => host.querySelector('button').click())
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('encheck_admin_dark_mode_v2')).toBe('true')
    expect(host.querySelector('button').textContent).toBe('Mode clair')
    await act(async () => host.querySelector('button').click())
    expect(document.documentElement.dataset.theme).toBe('light')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
it('labels the example and keeps both explanations closed by default', () => {
  const html = renderToStaticMarkup(<OvertimeCalculationGuide />)
  expect(html).toContain('Exemple illustratif')
  expect(html).toContain('1 h supplémentaire')
  expect((html.match(/<details>/g) || []).length).toBe(2)
  expect(html).not.toContain(' open')
})
it('distinguishes real access/loading states with a decorative scene and no fake progress', () => {
  for (const checkingAccess of [true, false]) {
    const html = renderToStaticMarkup(
      <OvertimeLoadingScreen checkingAccess={checkingAccess} />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-cultural-motif="aso-oke"')
    expect(html).toContain(
      checkingAccess
        ? 'Vérification de l’accès'
        : 'Calcul des heures supplémentaires',
    )
    expect(html).not.toContain('progressbar')
  }
  const css = readFileSync('src/pages/HeuresSupplementaires.css', 'utf8')
  expect(css).toContain('prefers-reduced-motion:reduce')
  expect(css).toContain('.ot-loading-scene *{animation:none!important}')
  expect(css).toContain('.ot-drawer > .ot-rules-body')
  expect(css).not.toContain('.ot-drawer > div:nth-child(2)')
})
