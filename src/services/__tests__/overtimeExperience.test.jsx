// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext'
import {
  OvertimeCalculationGuide,
  OvertimeLoadingScreen,
} from '../../components/OvertimeExperience'

/*  LE 26/12, CE TEST DÉFENDAIT LES RACCOURCIS. Il rendait `OvertimeNavigation`,
    énumérait les quatre `href` (`/pointages /planning /employes /paie`) et
    vérifiait que le bouton de la page bascule `encheck.theme`. Le fondateur a
    demandé l'inverse — « enlever les raccourcis, le bouton sombre/clair » — et
    le composant a été supprimé. On ne laisse pas un test orphelin pleurer son
    sujet, et on ne le supprime pas sans remplacer l'aiguille : ce qui compte,
    c'est que le RACCOURCI ne revienne pas et que le MÉCANISME du thème, lui,
    survive à la disparition de son bouton. Deux aiguilles, donc, plus le relevé
    des exports. */
it('n’exporte que le guide et l’écran de chargement : les raccourcis sont morts', async () => {
  const module = await import('../../components/OvertimeExperience')
  expect(Object.keys(module).sort()).toEqual([
    'OvertimeCalculationGuide',
    'OvertimeLoadingScreen',
  ])
  const source = readFileSync('src/components/OvertimeExperience.jsx', 'utf8')
  // ni le `<nav>` des quatre destinations ni le bouton sombre/clair n'ont
  // survécu sous une autre forme (un `Link` importé et non monté est déjà trop)
  expect(source).not.toMatch(/<nav|<Link|aria-label="Passer en mode/)
})

it('laisse le thème global vivant alors que son bouton de page est parti', async () => {
  //  la bascule vit ailleurs (l'en-tête de l'admin) : la suppression du bouton
  //    de la page ne doit pas avoir désactivé la persistance du thème.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.setItem('encheck.theme', 'clair')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  function Témoin() {
    const { darkMode, toggleTheme } = useTheme()
    return <button onClick={toggleTheme}>{darkMode ? 'Mode clair' : 'Mode sombre'}</button>
  }
  try {
    await act(async () =>
      root.render(
        <ThemeProvider>
          <Témoin />
        </ThemeProvider>,
      ),
    )
    await act(async () => host.querySelector('button').click())
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('encheck.theme')).toBe('sombre')
    await act(async () => host.querySelector('button').click())
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('encheck.theme')).toBe('clair')
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
