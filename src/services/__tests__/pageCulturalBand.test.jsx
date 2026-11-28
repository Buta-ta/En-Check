import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, existsSync } from 'node:fs'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import PlanningLoadingScreen from '../../components/PlanningLoadingScreen'

it('résout routes, sous-routes, paramètres, alias paie et repli sans faux préfixe', () => {
  for (const path of ['/planning','/planning/','/planning?date=2026-10-23','/planning/team']) expect(culturalMotifForPath(path)).toBe('kuba')
  for (const path of ['/paie','/fiches-paie','/configuration-fiscale']) expect(culturalMotifForPath(path)).toBe('bogolan')
  // Absences, 24/11/2026 : bogolan, sur demande du fondateur.
  expect(culturalMotifForPath('/absences')).toBe('bogolan')
  for (const [path, motif] of [['/pointages','adinkra'],['/pauses','lesotho'],['/employes','zoulou']]) expect(culturalMotifForPath(path)).toBe(motif)
  for (const path of ['/planning-other','/','/salaires-inconnus']) expect(culturalMotifForPath(path)).toBe('kente')
  // Rapports, 29/11 : « remplace le bandeau motif actuel par le bandeau
  // bogolan ». La carte est la seule source du tissu ; le nsibidi reste le
  // blason du document, plus sa bande.
  for (const path of ['/rapports', '/rapports/', '/rapports?periode=mois']) {
    expect(culturalMotifForPath(path)).toBe('bogolan')
  }
})
it('les bandeaux sont décoratifs et le Kente existant reste disponible', () => {
  const html=renderToStaticMarkup(<PageCulturalBand pathname="/planning"/> )
  expect(html).toContain('aria-hidden="true"'); expect(html).not.toContain('<svg')
  /*  Un motif est soit un SVG dessiné par la maison, soit une image tissée
      posée en fond — jamais les deux. `/rapports` était du premier bord, il est
      passé du second avec le bogolan (29/11) : le bandeau se tend maintenant
      comme celui de la Paie, sans balise. L'invariant tenu par la loi est donc
      « un seul rendu du motif », et non « un SVG ». */
  const rapports = renderToStaticMarkup(<PageCulturalBand pathname="/rapports"/>)
  expect(rapports).toContain('data-cultural-motif="bogolan"')
  expect(rapports).not.toContain('<svg')
  expect(rapports).toContain('aria-hidden="true"')
  // et le repli kente, lui, est toujours un dessin
  expect(renderToStaticMarkup(<PageCulturalBand pathname="/une-page-sans-motif"/>)).toContain('<svg')
})
it('le chargement Planning rend son bandeau motif, mais garde carte et étapes', () => {
  // Le 22/11, au second regard sur la maquette : « Enlève le bandeau motif qui est
  // dans la page loading ». La carte reste celle des Employés — en-tête, scène,
  // barre, étapes, « Passer l’animation » —, la toile kuba sort de l'écran.
  for (const darkMode of [false,true]) {
    const html=renderToStaticMarkup(<PlanningLoadingScreen darkMode={darkMode} onSkip={()=>{}}/> )
    expect(html).not.toContain('ec-cultural-')
    expect(html).not.toContain('data-cultural-motif')
    expect(html).toContain('Passer l’animation')
    expect(html).toContain('planning-loading-scene.webp')
    expect(html).toContain('pointages-loading-bar-fill')
    expect(html).toContain(darkMode ? 'data-theme="dark"' : 'data-theme="light"')
  }
})
it('les images de chaque identité existent et les motifs ne sont pas déformés', () => {
  for (const name of ['planning-kuba','absences-ndebele','paie-bogolan-haut','paie-bogolan-bas','pointages-adinkra','pauses-lesotho','employes-zoulou','planning-loading-scene']) expect(existsSync(`public/images/${name}.webp`)).toBe(true)
  const css=readFileSync('src/components/PageCulturalBand.css','utf8')
  expect(css).toContain('background-size: auto 100%')
  expect(css).toContain('.ec-cultural-compact { height: 100%; }')
})
