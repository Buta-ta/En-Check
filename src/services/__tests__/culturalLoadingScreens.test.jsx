import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, existsSync } from 'node:fs'
import AbsencesLoadingScreen, { ETAPES_CHARGEMENT_ABSENCES } from '../../components/AbsencesLoadingScreen'
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
it('Absences : la carte des Employés est EMPRUNTÉE, pas imitée — et sans bandeau motif', () => {
  /* 08/12 : « utilise cette même animation, juste retravaille ça comme dans la page
     employés ». L'aiguille d'avant (24/11) exigeait DEUX toiles de bogolan dans
     l'écran ; le fondateur a depuis posé la règle contraire deux fois (Planning
     22/11 : « enlève le bandeau motif qui est dans la page loading », Pauses 26/11 :
     « enlève le bandeau motif en bas de l'écran »), et l'animation empruntée ne
     laisse aucun place pour elles. Le contrat se relit donc : MÊME carte (compteur,
     file, « Passer l'animation»), aucune tribune. » */
  for (const darkMode of [true,false]) {
    const html=renderToStaticMarkup(<AbsencesLoadingScreen darkMode={darkMode} onSkip={()=>{}}/>)
    expect(html).toContain(`data-theme="${darkMode?'dark':'light'}"`)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('data-cultural-motif')
    expect(html).toContain('emp-loading-card')
    expect(html).toContain('Étape 1/4')
    expect(html).toContain('Passer l’animation')
    expect(html).toContain('pointages-loading-bar-fill')
    expect(html).toContain('/images/absences-loading-scene.webp')
    expect(html).not.toContain('progressbar')
  }
  // les quatre étapes sont CELLES de la page, dans son ordre réel
  const html=renderToStaticMarkup(<AbsencesLoadingScreen onSkip={()=>{}} nomEntreprise="En-Nous"/>)
  expect(html).toContain('Préparation des absences et congés de En-Nous…')
  // la carte n'a plus de variante d'accès : c'est le TITRE qui la porte (un écran
  // de chargement n'a pas deux figures, il a un texte)
  const accès=renderToStaticMarkup(<AbsencesLoadingScreen onSkip={()=>{}} accessChecked={false}/>)
  expect(accès).toContain('Vérification de votre accès')
  expect(accès).not.toContain('Préparation des absences')
  expect(renderToStaticMarkup(<AbsencesLoadingScreen onSkip={()=>{}}/>)).toContain('Préparation de vos absences et congés…')
  // la sortie est conditionnée à `onSkip` dans la carte : la page doit le passer,
  // sinon « Passer l'animation » n'existe pas et l'écran tient le visiteur en otage
  expect(readFileSync('src/pages/Absences.jsx','utf8')).toContain('onSkip={() => {')
  for (const mot of ['Collaborateurs','Absences de la période','Demandes & conflits','Solde de congés']) {
    expect(ETAPES_CHARGEMENT_ABSENCES.map((e)=>e.court)).toContain(mot)
  }
  expect(html).toContain('En-Nous')
  // la promesse du 24/11 tient toujours, sans le <details> d'avant : rien n'est
  // approuvé pendant l'animation — et le minuteur ne ment jamais sur la donnée
  expect(html).not.toContain('approuvé')
})
it('Absences : l’écran ne s’efface que sur la donnée réelle, et « Passer » ne fait pas semblant', () => {
  const source = readFileSync('src/pages/Absences.jsx','utf8')
  // le plancher est celui de la maison (`useLoadingMinimum`), pas un `setTimeout` posé ici
  expect(source).toContain("import useLoadingMinimum from '../hooks/useLoadingMinimum'")
  expect(source).toContain('const { minLoadingDone, skipLoading } = useLoadingMinimum()')
  expect(source).toContain('dataReady={!loading}')
  expect(source).toContain('|| !minLoadingDone')
  // « Passer l'animation » saute le plancher, il ne vire pas les données en cours
  expect(source).toContain('if (!accessChecked) return')
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
  // 08/12 : la carte empruntée change le branchement (le plancher de la maison,
  // la donnée réelle, plus de prop `checkingAccess` — un titre). L'aiguille relit
  // le branchement NEUF, elle ne laisse pas l'ancien passer par inattention.
  expect(source).toContain('|| !minLoadingDone')
  expect(source).toContain('<AbsencesLoadingScreen')
  expect(source).not.toContain('checkingAccess={!accessChecked}')

})
it('la carte des Absences ne se branche pas sur la fin de son introduction', () => {
  // Le plancher d'une page se libère par sa propre minuterie (`useLoadingMinimum`),
  // jamais par la carte : `onIntroDone` de la carte des Employés tombe à 2 600 ms,
  // le plancher d'Absences à 4 500. Branché sur `onSkip` de la page, il éteignait
  // l'écran avant la donnée — et le fondateur voyait un calendrier vide deux fois
  // sur trois (26/12, reprise du câblage de Pauses et du Planning, qui ne le
  // passent pas).
  const composant = readFileSync('src/components/AbsencesLoadingScreen.jsx', 'utf8')
  expect(composant).not.toContain('onIntroDone={')
  const page = readFileSync('src/pages/Absences.jsx', 'utf8')
  expect(page).toContain('dataReady={!loading}')
  expect(page).toContain('skipLoading()')
})
