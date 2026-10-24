import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, existsSync } from 'node:fs'
import AbsencesLoadingScreen from '../../components/AbsencesLoadingScreen'
import PausesLoadingScreen from '../../components/PausesLoadingScreen'
import EmployesLoadingScreen from '../../components/EmployesLoadingScreen'

it('Pauses et Employés utilisent les motifs validés, avec leurs étapes et bouton passer', () => {
  for (const [Screen,motif] of [[PausesLoadingScreen,'lesotho'],[EmployesLoadingScreen,'zoulou']]) {
    const html=renderToStaticMarkup(<Screen onSkip={()=>{}}/>)
    expect(html).toContain(`data-cultural-motif="${motif}"`)
    expect(html).toContain('Passer l’animation')
    expect(html).toContain('pointages-loading-bar-fill')
  }
})
it('Absences : vrai état d’attente accessible, pas de pourcentage ni de fausse approbation', () => {
  for (const darkMode of [true,false]) {
    const html=renderToStaticMarkup(<AbsencesLoadingScreen darkMode={darkMode}/>)
    expect(html).toContain(`data-theme="${darkMode?'dark':'light'}"`)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Aucune demande n’est approuvée')
    expect(html.match(/data-cultural-motif="ndebele"/g)).toHaveLength(2)
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
  for (const name of ['Pointages','Pauses','Employes']) {
    expect(readFileSync(`src/pages/${name}.jsx`,'utf8')).toContain(`pathname="/${name.toLowerCase()}" placement="bottom"`)
  }
  const source=readFileSync('src/pages/Absences.jsx','utf8')
  expect(source).toContain('if (!accessChecked || loading)')
  expect(source).toContain('<AbsencesLoadingScreen darkMode={darkMode} checkingAccess={!accessChecked}/>')
})
