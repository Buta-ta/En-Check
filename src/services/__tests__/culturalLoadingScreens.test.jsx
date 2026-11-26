import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, existsSync } from 'node:fs'
import AbsencesLoadingScreen from '../../components/AbsencesLoadingScreen'
import PausesLoadingScreen from '../../components/PausesLoadingScreen'
import EmployesLoadingScreen from '../../components/EmployesLoadingScreen'

it('Pauses emprunte la carte Employés, et Employés garde sa scène illustrée devant la borne', () => {
  //  « Remplacer le loading actuel de cette page par le loading de la page
  //  employés », 26/11. La carte est empruntée, comme pour le Planning : la
  //  même structure, le même compteur, le même bouton de sortie. Ce qui est
  //  propre à Pauses, c'est la scène (le dépointage) et les quatre étapes.
  const htmlPauses=renderToStaticMarkup(<PausesLoadingScreen onSkip={()=>{}}/>)
  expect(htmlPauses).not.toContain('data-cultural-motif')
  expect(htmlPauses).toContain('emp-loading-card')
  expect(htmlPauses).toContain('/images/pauses-loading-depointage.jpg')
  expect(htmlPauses).toContain('Étape 1/4')
  expect(htmlPauses).toContain('Passer l’animation')
  expect(htmlPauses).toContain('pointages-loading-bar-fill')

  const htmlEmployes=renderToStaticMarkup(<EmployesLoadingScreen onSkip={()=>{}} etape={2} nomEntreprise="Maison Koffi"/>)
  expect(htmlEmployes).not.toContain('data-cultural-motif')
  expect(htmlEmployes).toContain('employes-loading-approved.webp')
  expect(htmlEmployes).toContain('Maison Koffi')
  expect(htmlEmployes).toContain('Passer l’animation')
  expect(htmlEmployes).toContain('pointages-loading-bar-fill')
})
it('Absences : vrai état d’attente accessible, pas de pourcentage ni de fausse approbation', () => {
  for (const darkMode of [true,false]) {
    const html=renderToStaticMarkup(<AbsencesLoadingScreen darkMode={darkMode}/>)
    expect(html).toContain(`data-theme="${darkMode?'dark':'light'}"`)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Aucune demande n’est approuvée')
    // Absences, 24/11/2026 : l'écran d'attente suit la page — bogolan, deux toiles.
    expect(html.match(/data-cultural-motif="bogolan"/g)).toHaveLength(2)
    expect(html).not.toContain('progressbar')
  }
  expect(renderToStaticMarkup(<AbsencesLoadingScreen checkingAccess/>)).toContain('Vérification des accès')
})
it('la scène validée dispose de calques distincts et d’un repli sans mouvement', () => {
  for (const part of ['scene','base','paper','lid']) expect(existsSync(`public/images/absences-loading-${part}.webp`)).toBe(true)
  const css=readFileSync('src/components/AbsencesLoadingScreen.css','utf8')
  for (const name of ['abs-paper-arrival','abs-days-highlight','abs-suitcase-close']) expect(css).toContain(`@keyframes ${name}`)
  expect(css).toContain('prefers-reduced-motion:reduce')
  expect(css).toContain('.abs-loading-layers { display: none; }')
})
it('les pages réutilisent les mêmes bandeaux et le chargement Absences reste lié au chargement réel', () => {
  for (const name of ['Pointages']) {
    expect(readFileSync(`src/pages/${name}.jsx`,'utf8')).toContain(`pathname="/${name.toLowerCase()}" placement="bottom"`)
  }
  /*  Pauses garde la bande du HAUT — c'est l'identité de la page — mais la
      bande du bas a été retirée à sa demande le 26/11 : « enlève le bandeau
      motif en bas de l'écran ». Elle fermait la page sur un motif qui
      n'annonçait plus rien. */
  const pauses = readFileSync('src/pages/Pauses.jsx','utf8')
  expect(pauses).toContain('pathname="/pauses"')
  expect(pauses).not.toContain('placement="bottom"')
  // Employés : le bandeau de motif a été retiré de cette page
  // (demande du fondateur, 08/11 : « enlève le bandeau motif culturel »).
  // La page ne doit plus en porter, ni en haut ni en bas.
  const employes = readFileSync('src/pages/Employes.jsx','utf8')
  expect(employes).not.toContain('PageCulturalBand')
  expect(employes).not.toContain('placement="bottom"')
  const source=readFileSync('src/pages/Absences.jsx','utf8')
  expect(source).toContain('if (!accessChecked || loading)')
  expect(source).toContain('<AbsencesLoadingScreen darkMode={darkMode} checkingAccess={!accessChecked}/>')
})
