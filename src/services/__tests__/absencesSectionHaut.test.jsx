// @vitest-environment jsdom
// Absences · LA SECTION DU HAUT — le transat.
// Contrat écrit le 27/11/2026, maquette retenue
// `maquettes/absences-haut-E-cremaillere.png` (figure E du lot de six).
//
//   Ce qui est affiché est vrai ; un chiffre ne se dit pas deux fois ; le motif est
//   un fond, le mot est un élément ; une correction = un contrat.
//
// Trois décisions du fondateur, toutes trois verrouillées ici :
//   · « dans chaque nouvelle page enlève les raccourcis » → plus de rail sur Absences ;
//   · « un bandeau motif bogolan servira autrement »     → plus de bandeau dans l'en-tête ;
//   · « enlève le bouton clair/sombre »                   → plus de lune, thème toujours lu.
// Et une figure : deux montants, une suspente en crémaillère, un nombre suspendu
// dedans, le jour du retour à droite. Les vacances ne se dessinent pas, elles tiennent.
//
// Les verrous de SOURCE ne lisent que les lignes qui ne commentent pas : un contrat
// qui cherche une sous-chaîne dans tout le fichier se fait avoir par un paragraphe de
// commentaire. Ce qui peut être prouvé sur du HTML rendu l'est donc sur du HTML rendu.

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import AbsencesHamac, { MARCHES, PAS_PX, FONDS } from '../../components/AbsencesHamac'
import { soldeMoyen, prochainRetour, formatRetourFr } from '../congesRestants'
import { culturalMotifForPath } from '../../components/culturalMotif.js'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const PAGE = lire('src/pages/Absences.jsx')
const CSS = lire('src/pages/AbsencesAfroTech.css')
const RAIL = lire('src/components/RaccourcisPages.jsx')
const KPI = lire('src/components/AbsencesKpiCards.jsx')

const codes = (src) =>
  src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
const CODE_PAGE = codes(PAGE)
const porte = (lignes, motif) => lignes.some((l) => l.includes(motif))
// Un bloc de la feuille, de son sélecteur à son accolade fermante. `bloc` exige que
// le bloc existe — un contrat qui ne trouve pas sa règle doit hurler, pas passer.
// `trou` sert aux verrous d'ABSENCE, où le succès est justement de ne rien trouver.
const trou = (depart) => {
  const i = CSS.indexOf(depart)
  return i < 0 ? '' : CSS.slice(i, CSS.indexOf('\n}', i) + 2)
}
const bloc = (depart) => {
  const b = trou(depart)
  expect(b, `bloc manquant : ${depart}`).not.toBe('')
  return b
}

describe('Absences · la section du haut, figure E', () => {
  it('ne monte plus le rail de raccourcis', () => {
    expect(porte(CODE_PAGE, '<RaccourcisPages')).toBe(false)
    expect(porte(CODE_PAGE, "import RaccourcisPages")).toBe(false)
    expect(porte(CODE_PAGE, 'abs-topbar-nav')).toBe(false)
    expect(trou('.abs-topbar-nav')).toBe('') // la règle qui pendait le rail est morte avec lui
    // les classes partagées du rail restent intactes : quatorze autres écrans les
    // habillent dans leur propre feuille, une reprise d'Absences ne les repeint pas
    expect(porte(codes(CSS), '.abs-raccourcis {')).toBe(true)
    expect(RAIL).toContain('className="abs-raccourcis"')
  })

  it('ne borde plus l’en-tête de bogolan, et ne change pas l’identité de la page', () => {
    expect(porte(CODE_PAGE, '<AbsencesCulturalBand')).toBe(false)
    expect(porte(CODE_PAGE, '<PageCulturalBand')).toBe(false)
    expect(CSS).not.toContain('.abs-bogolan-tete')
    expect(culturalMotifForPath('/absences')).toBe('bogolan') // l'empreinte et le chargement
    // le tissu reste là où il servait déjà : les deux tiroirs
    expect(lire('src/components/AbsenceTiroir.jsx')).toContain('<AbsencesCulturalBand drawer/>')
  })

  it("n'a plus de bouton clair/sombre, mais lit toujours le thème", () => {
    expect(porte(CODE_PAGE, 'abs-theme-toggle')).toBe(false)
    expect(porte(CODE_PAGE, 'toggleTheme')).toBe(false)
    expect(CSS).not.toContain('.abs-theme-btn')
    const lucide = PAGE.match(/import \{([^}]*)\} from 'lucide-react'/)[1]
    expect(lucide).not.toMatch(/\bMoon\b|\bSun\b/) // plus d'icône de bascule à importer
    expect(porte(CODE_PAGE, 'const { darkMode } = useTheme()')).toBe(true)
    expect(porte(CODE_PAGE, "data-theme={darkMode ? 'dark' : 'light'}")).toBe(true)
  })

  it('rend le transat HORS page, et ne le monte plus dans la page', () => {
    // R1 (2/12/2026) : « je choisis la R1-poutre ». Le composant reste VIVANT et
    // testé — c'est le seul endroit du dépôt qui vérifie la géométrie de la
    // crémaillère — mais la page ne l'accroche plus : son nombre est descendu dans la
    // rangée des compteurs, comme septième planche. Un composant qu'on ne monte plus
    // et qu'on ne teste plus est un composant mort qu'on ne sait plus enterrer.
    const html = renderToStaticMarkup(<AbsencesHamac jours={30} retour="lun. 30 nov." />)
    expect(html).toContain('data-testid="abs-hamac"')
    expect(html.match(/class="abs-hamac-montant/g)).toHaveLength(2) // deux poteaux, pas un de plus
    expect(html.match(/abs-hamac-cran/g)).toHaveLength(MARCHES * 2 + 1)
    expect(MARCHES).toBe(8)
    expect(PAS_PX).toBe(8)
    expect(FONDS).toBe(MARCHES * PAS_PX) // 64 px de creux, mesurés au haut du dernier carreau
    // la descente est une tente, pas une courbe : 0 → 64 → 0 en marches franches
    const pas = [...html.matchAll(/margin-top:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(pas).toHaveLength(17)
    expect(pas.join(',')).toBe('0,8,16,24,32,40,48,56,64,56,48,40,32,24,16,8,0')
    expect(html).toContain('aria-hidden="true"') // la corde est muette, seul le nombre parle
    expect(html).toContain('>30<')
    expect(html).toContain('jours de congé qui restent')
    expect(html).toContain('lun. 30 nov.')
    // et la page, elle, ne le monte plus : la feuille ne porte plus aucune de ses
    // règles, et chercher dans le CSS commenté ferait croire le contraire
    expect(porte(CODE_PAGE, '<AbsencesHamac')).toBe(false)
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('.abs-hamac {')
    // le nombre, lui, traverse : c'est la page qui calcule, le compteur qui affiche
    expect(porte(CODE_PAGE, 'jours={transat.jours}')).toBe(true)
    expect(porte(CODE_PAGE, 'retour={transat.retour}')).toBe(true)
  })

  it('ne devine rien : sans retour à venir, la note ne se montre pas', () => {
    // la base ne contient qu'une absence (28 → 30/11/2026) : le 8, personne ne revient
    const html = renderToStaticMarkup(<AbsencesHamac jours={12} retour={null} />)
    expect(html).not.toContain('abs-hamac-retour')
    expect(html).toContain('>12<')
    // un solde non chargé s'écrit comme tel — un « 0 » suspendu serait une promesse
    const vide = renderToStaticMarkup(<AbsencesHamac jours={null} />)
    expect(vide).toContain('soldes non chargés')
    expect(vide).not.toMatch(/abs-hamac-valeur/)
  })

  it('garde la peau de la page : aucune courbe, aucune ombre floue, un seul rayon', () => {
    // La peau se vérifie maintenant sur ce qui a remplacé la tuile : le bois d'une
    // planche de la poutre. Mêmes promesses — un rayon, une ombre à flou zéro, un
    // contour d'encre — et le même refus de deviner une hauteur.
    const poutre = [
      bloc('.abs-planche {'),
      bloc('.abs-planche-corde {'),
      bloc('.abs-planche::before {'),
      bloc('.abs-planche-corde i::before {'),
      bloc('.abs-planche-corps {'),
    ].join('\n')
    expect(poutre).not.toContain('blur(') // C9 — D-016 : ombre dure
    expect(poutre).not.toMatch(/border-radius:\s*999/) // la pilule est l'anneau, pas le bois
    const rayons = [...poutre.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(rayons).toEqual(['var(--charte-rayon-pilule)']) // UN seul rayon : l'anneau. Le bois, lui, est carré.
    // le contour du bois est celui d'un objet actif, à l'encre de la charte
    expect(bloc('.abs-planche-corps {')).toContain('border: var(--charte-trait) solid var(--charte-encre)')
    expect(bloc('.abs-planche-corps {')).toContain('box-shadow: var(--charte-ombre-dure)')
    // et l'anneau se pose au HAUT DE LA CORDE, pas à son décalage : la corde est déjà
    // montée, additionner les deux (la pose du 2/12) faisait remonter l'anneau de
    // 20 px par-dessus le titre — « les trous (ronds) sont mal placés », 3/12.
    const corde = declarations('.abs-planche-corde')
    const anneau = declarations('.abs-planche-corde i::before')
    expect(nud(corde)).toContain('top:calc(-1*(var(--abs-corde)+var(--abs-tringle)))')
    expect(nud(anneau)).toContain('top:calc(var(--abs-tringle)-var(--abs-anneau))')
    // l'arithmétique, relue dans la feuille (pas un expect(20).toBe(20) qui ne peut
    // pas tomber) : corde + traverse − cran − épaisseur = le remplissage de `<main>`
    const jeton = (nom) => parseInt(declarations('.abs-etagere').split(`${nom}: `)[1], 10)
    const épaisseur = parseInt(anneau.split('height: ')[1], 10) + 2 * parseInt(anneau.split('border: ')[1], 10)
    expect(jeton('--abs-corde') + jeton('--abs-tringle') - jeton('--abs-anneau') - épaisseur)
      .toBe(parseInt(/main:\s*\{\s*padding:\s*(\d+)/.exec(PAGE)[1], 10))
    // la coupe de 1180 px ne reposition RIEN : chaque rang garde son rail et ses
    // cordes, parce qu'ils appartiennent à la planche
    expect(media('@media (max-width: 1180px)')).not.toMatch(/\n\s*(left|right|top|bottom):/)
  })

  // lecteurs partagés par les deux verrous ci-dessus
  function declarations(sélecteur) {
    const i = CSS.indexOf(`${sélecteur} {`)
    expect(i, `règle absente : ${sélecteur}`).toBeGreaterThan(-1)
    return CSS.slice(CSS.indexOf('{', i) + 1, CSS.indexOf('}', i))
  }
  function media(état) {
    const i = CSS.indexOf(état)
    expect(i, `média absent : ${état}`).toBeGreaterThan(-1)
    let n = 0
    for (let j = CSS.indexOf('{', i); j < CSS.length; j += 1) {
      if (CSS[j] === '{') n += 1
      if (CSS[j] === '}') { n -= 1; if (n === 0) return CSS.slice(i, j + 1) }
    }
    throw new Error(`média non fermé : ${état}`)
  }
  const nud = (c) => c.replace(/\s+/g, '')

  it('ne dit le solde qu’une seule fois, et du même calcul', () => {
    // la maquette montre le « 30 » deux fois : dans la suspente et dans la tuile de
    // compteur. Deux affichages d'un même nombre se tolèrent ; deux CALCULS non.
    expect(porte(CODE_PAGE, 'soldeMoyen({ employes, joursPrisParEmploye, plafond: leaveConfig.annual_leave_cap || 30 })')).toBe(true)
    const codeKpi = codes(KPI)
    expect(porte(codeKpi, 'soldeMoyen({ employes, joursPrisParEmploye, plafond })')).toBe(true)
    expect(porte(codeKpi, "import { soldeMoyen } from '../services/congesRestants'")).toBe(true)
    // la tuile ne recompute plus son côté pour son compte
    expect(porte(codeKpi, 'const restants = employes.map')).toBe(false)
  })

  it('laisse la ligne d’outils et les compteurs où ils sont, les onglets en haut', () => {
    // 28/11/2026 : les trois onglets de section ont MONTÉ dans la chemise (maquette C) —
    // ce n'est pas un retrait, c'est un objet de moins. Le reste de la partie haute ne
    // bouge pas : la barre d'outils garde sa couture pointillée, les compteurs leur rangée.
    expect(porte(CODE_PAGE, 'className="abs-section-tabs"')).toBe(false)
    expect(lire('src/components/AbsencesChemise.jsx')).toContain('className="abs-chemise-onglets"')
    expect(porte(CODE_PAGE, '<AbsencesKpiCards')).toBe(true)
    expect(bloc('.abs-page .toolbar-top {')).toContain('border-top: 1px dashed')
    expect(porte(CODE_PAGE, 'className="abs-tuile"')).toBe(true)
  })
})

describe('congesRestants · les deux nombres du transat', () => {
  it('soldeMoyen : la moyenne, une décimale, jamais de solde négatif', () => {
    expect(soldeMoyen({ employes: [], joursPrisParEmploye: {}, plafond: 30 })).toBe(30)
    expect(soldeMoyen({ employes: [{ id: 'a' }, { id: 'b' }], joursPrisParEmploye: { a: 0, b: 3 }, plafond: 30 })).toBe(28.5)
    expect(soldeMoyen({ employes: [{ id: 'a' }], joursPrisParEmploye: { a: 44 }, plafond: 30 })).toBe(0)
    expect(soldeMoyen()).toBe(30) // rien de passé : le plafond, pas un zéro muet
  })

  it('prochainRetour : ni refusé, ni passé, le plus proche d’abord', () => {
    const absences = [
      { end_date: '2026-12-05', status: 'en_attente' },
      { end_date: '2026-11-30', status: 'approuve' },
      { end_date: '2026-11-20', status: 'refuse' },
      { end_date: '2026-11-02', status: 'approuve' },
    ]
    expect(prochainRetour(absences, '2026-11-08')).toBe('2026-11-30')
    expect(prochainRetour([], '2026-11-08')).toBe(null)
    expect(prochainRetour([{ end_date: '2026-11-02', status: 'approuve' }], '2026-11-08')).toBe(null)
    // une absence sans date de fin retombe sur sa date de début, jamais sur rien
    expect(prochainRetour([{ start_date: '2026-12-01', status: 'approuve' }], '2026-11-08')).toBe('2026-12-01')
  })

  it('formatRetourFr : le jour court devant la date, ou rien du tout', () => {
    expect(formatRetourFr(null)).toBe(null)
    expect(formatRetourFr('2026-11-30')).toMatch(/^lun\.\s*30\s*nov\./)
  })
})
