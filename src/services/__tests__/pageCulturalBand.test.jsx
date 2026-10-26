import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, existsSync } from 'node:fs'
import PageCulturalBand, { culturalMotifForPath } from '../../components/PageCulturalBand'
import PlanningLoadingScreen from '../../components/PlanningLoadingScreen'

it('résout routes, sous-routes, paramètres, alias paie et repli sans faux préfixe', () => {
  for (const path of ['/planning','/planning/','/planning?date=2026-10-23','/planning/team']) expect(culturalMotifForPath(path)).toBe('kuba')
  for (const path of ['/paie','/fiches-paie','/configuration-fiscale']) expect(culturalMotifForPath(path)).toBe('bogolan')
  expect(culturalMotifForPath('/absences')).toBe('ndebele')
  for (const [path, motif] of [['/pointages','adinkra'],['/pauses','lesotho'],['/employes','zoulou']]) expect(culturalMotifForPath(path)).toBe(motif)
  for (const path of ['/planning-other','/','/salaires-inconnus']) expect(culturalMotifForPath(path)).toBe('kente')
  expect(culturalMotifForPath('/rapports')).toBe('nsibidi')
  expect(culturalMotifForPath('/rapports?periode=mois')).toBe('nsibidi')
})
it('les bandeaux sont décoratifs et le Kente existant reste disponible', () => {
  const html=renderToStaticMarkup(<PageCulturalBand pathname="/planning"/> )
  expect(html).toContain('aria-hidden="true"'); expect(html).not.toContain('<svg')
  expect(renderToStaticMarkup(<PageCulturalBand pathname="/rapports"/>)).toContain('<svg')
})
it('le chargement Planning emploie le même motif, dans les deux thèmes, sans supprimer ses étapes', () => {
  for (const darkMode of [false,true]) {
    const html=renderToStaticMarkup(<PlanningLoadingScreen darkMode={darkMode} onSkip={()=>{}}/> )
    expect(html).toContain('data-cultural-motif="kuba"')
    expect(html).toContain('ec-cultural-loading')
    expect(html).toContain('Passer l’animation')
    expect(html).toContain('planning-loading-grid-femme.jpg')
  }
})
it('les images de chaque identité existent et les motifs ne sont pas déformés', () => {
  for (const name of ['planning-kuba','absences-ndebele','paie-bogolan-haut','paie-bogolan-bas','pointages-adinkra','pauses-lesotho','employes-zoulou']) expect(existsSync(`public/images/${name}.webp`)).toBe(true)
  const css=readFileSync('src/components/PageCulturalBand.css','utf8')
  expect(css).toContain('background-size: auto 100%')
  expect(css).toContain('.ec-cultural-compact { height: 100%; }')
})
