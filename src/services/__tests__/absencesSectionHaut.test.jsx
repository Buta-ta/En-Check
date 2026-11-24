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

  it('pose deux montants, dix-sept crans de 8 px, une tuile suspendue', () => {
    const html = renderToStaticMarkup(<AbsencesHamac jours={30} retour="lun. 30 nov." />)
    expect(html).toContain('data-testid="abs-hamac"')
    expect(html.match(/class="abs-hamac-montant/g)).toHaveLength(2) // deux poteaux, pas un de plus
    expect(html.match(/abs-hamac-cran/g)).toHaveLength(MARCHES * 2 + 1)
    expect(MARCHES).toBe(8)
    // le pas est le même du côté JSX et du côté CSS : sinon l'escalier se défait
    expect(PAS_PX).toBe(8)
    expect(FONDS).toBe(MARCHES * PAS_PX) // 64 px de creux, mesurés au haut du dernier carreau
    expect(bloc('.abs-hamac-cran {')).toContain('height: 8px')
    // la descente est une tente, pas une courbe : 0 → 64 → 0 en marches franches
    const pas = [...html.matchAll(/margin-top:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(pas).toHaveLength(17)
    expect(pas.join(',')).toBe('0,8,16,24,32,40,48,56,64,56,48,40,32,24,16,8,0')
    // la corde est muette, seul le nombre parle
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('>30<')
    expect(html).toContain('jours de congé qui restent')
    expect(html).toContain('lun. 30 nov.')
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
    const transat = [
      bloc('.abs-hamac {'),
      bloc('.abs-hamac-corde {'),
      bloc('.abs-hamac-cran {'),
      bloc('.abs-hamac-suspendu {'),
      bloc('.abs-hamac-retour {'),
    ].join('\n')
    expect(transat).not.toContain('blur(') // C9 — D-016 : ombre dure
    expect(transat).not.toMatch(/border-radius:\s*999/) // pas de pilule ici
    expect([...transat.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())).toEqual(['8px'])
    // le contour de la tuile est bien celui d'un objet actif, en encre de la page
    expect(bloc('.abs-hamac-suspendu {')).toContain('border: 2px solid var(--abs-text)')
    expect(bloc('.abs-hamac-suspendu {')).toContain('box-shadow: 2px 2px 0 0')
    // Et la tuile est posée dans l'affaissement, sur l'axe de la corde. Ces trois
    // lignes sont le seul endroit du dépôt où le -46 se vérifie : c'est une soustraction
    // entre deux mesures de la feuille, pas un goût.
    const corde = bloc('.abs-hamac-corde {')
    const montant = bloc('.abs-hamac-montant,')
    const hauteurCorde = Number(corde.match(/min-height:\s*(\d+)px/)[1])
    expect(montant).toContain(`height: ${hauteurCorde}px`) // la corde tient RAIDE
    const creux = FONDS + PAS_PX // le BAS du dernier carreau, pas son haut
    expect(creux).toBe(72)
    expect(bloc('.abs-hamac-suspendu {')).toContain(`margin: ${creux - hauteurCorde}px auto 0`)
    // un centrage partagé, pas deux centrages séparés : la corde et ce qu'elle tient
    // se règlent sur la même référence, sinon le nombre pend de travers
    expect(corde).toContain('margin: 0 15%')
    expect(corde).toContain('align-self: stretch')
    expect(corde).not.toContain('width: 100%') // 100 % + marges = débordement de 30 %
    // et l'étroitesse est prévue, pas subie
    expect(CSS).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.abs-hamac-retour \{\n\s*position: static/)
    expect(CSS).toMatch(/@media \(max-width: 650px\)[\s\S]*?\.abs-hamac-suspendu \{\n\s*min-width: 0/)
  })

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
