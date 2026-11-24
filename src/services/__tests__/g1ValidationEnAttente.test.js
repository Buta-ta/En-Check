import { describe, it, expect } from 'vitest'
import { fenetreDeLecture, __internal } from '../hoursCalculator'
import { agregerParSemaine, evaluerSeuilsHebdo } from '../plafondHebdomadaire'
import { evaluerReposQuotidien } from '../reposQuotidien'

const { buildDaySummariesStrict } = __internal
const H = (h) => h * 3600

// ─────────────────────────────────────────────────────────────────────────────
//  G1 — les contrôles que le plan demandait et qui n'existaient pas
//
//  `fenetreAnnee.test.js` verrouille la fenêtre et les 50 h. Trois points du
//  §7 restaient pourtant sans test, et le plan lui-même parle de G1 comme
//  « réalisé, NON VALIDÉ ». Les voici :
//
//    1. le REPOS au passage d'année, mesuré à travers la fenêtre élargie —
//       c'est le cas 23 h 10 → 05 h 40 du plan (6 h 30 mesurées, 4 h 30
//       manquantes pour un minimum fictif de 11 h) ;
//    2. le cas SYMÉTRIQUE : une référence de janvier doit voir le 29-31/12 ;
//    3. les DONNÉES PARTIELLES : une semaine lue sur 3 jours ne doit jamais
//       rendre « aucun dépassement » — ce serait une conformité déduite d'une
//       lecture amputée (P5, D5).
//
//  ⚠️ 11 h et 48 h sont des valeurs FICTIVES de test. Aucune n'est une règle
//  légale, aucune ne vient d'une entreprise réelle.
// ─────────────────────────────────────────────────────────────────────────────

const pointage = (iso, type) => ({
  id: `${iso}-${type}`,
  check_time: iso,
  check_type: type,
  is_auto_closed: false,
  method: 'badge',
})

const resumer = ({ points, debutAnnee, finAnnee, debutMois, finMois }) =>
  buildDaySummariesStrict({
    attendances: points,
    enterpriseCfg: {},
    plan: null,
    plansParJour: null,
    debutAnnee,
    finAnnee,
    debutMois,
    finMois,
    basculeMinutes: 0,
    seuils: null,
  })

const PERIODES_DECEMBRE = {
  debutAnnee: '2025-01-01',
  finAnnee: '2025-12-31',
  debutMois: '2025-12-01',
  finMois: '2025-12-31',
}

const PERIODES_JANVIER = {
  debutAnnee: '2026-01-01',
  finAnnee: '2026-12-31',
  debutMois: '2026-01-01',
  finMois: '2026-01-31',
}

describe('🌙 G1 — le repos au passage d’année est enfin mesuré', () => {
  //  Garde de nuit du réveillon : sortie le 31/12 à 23 h 10, reprise le 01/01
  //  à 05 h 40. Repos réel : 6 h 30.
  const nuitDuReveillon = [
    pointage('2025-12-31T08:00:00.000Z', 'in'),
    pointage('2025-12-31T23:10:00.000Z', 'out'),
    pointage('2026-01-01T05:40:00.000Z', 'in'),
    pointage('2026-01-01T16:00:00.000Z', 'out'),
  ]

  it('côté décembre : 6 h 30 mesurées, 4 h 30 manquantes pour 11 h', () => {
    const summaries = resumer({ points: nuitDuReveillon, ...PERIODES_DECEMBRE })

    //  Sans la fenêtre élargie, `2026-01-01` n'existait pas et le 31/12
    //  ressortait avec `fin` nulle : 0 écart, silence total.
    expect(summaries['2026-01-01']).toBeDefined()

    const evaluation = evaluerReposQuotidien({
      journees: [
        { date: '2025-12-31', debut: summaries['2025-12-31'].firstInISO, fin: summaries['2025-12-31'].lastOutISO },
        { date: '2026-01-01', debut: summaries['2026-01-01'].firstInISO, fin: summaries['2026-01-01'].lastOutISO },
      ],
      minimumHeures: 11,
    })

    expect(evaluation.ecarts).toHaveLength(1)
    expect(evaluation.ecarts[0].heures).toBe(6.5)
    expect(evaluation.ecarts[0].manque_heures).toBe(4.5)
    expect(evaluation.nb_violations).toBe(1)
  })

  it('le cas symétrique : janvier voit bien le 31 décembre', () => {
    const summaries = resumer({ points: nuitDuReveillon, ...PERIODES_JANVIER })

    //  La fenêtre de janvier remonte au lundi 29/12. Le 31 y est donc lisible,
    //  et le repos se mesure depuis le MOIS DE JANVIER aussi.
    expect(summaries['2025-12-31']).toBeDefined()
    expect(summaries['2025-12-31'].lastOutISO).toBe('2025-12-31T23:10:00.000Z')
  })

  it('sans minimum configuré, aucun verdict n’est prononcé', () => {
    //  D5 : pas de valeur choisie ⇒ pas de verdict. Le moteur MESURE l'écart
    //  (il est vrai) mais refuse de dire s'il est respecté : `disponible` est
    //  faux, `respecte` vaut `null`, et aucune violation n'est fabriquée.
    const summaries = resumer({ points: nuitDuReveillon, ...PERIODES_DECEMBRE })
    const evaluation = evaluerReposQuotidien({
      journees: [
        { date: '2025-12-31', debut: summaries['2025-12-31'].firstInISO, fin: summaries['2025-12-31'].lastOutISO },
        { date: '2026-01-01', debut: summaries['2026-01-01'].firstInISO, fin: summaries['2026-01-01'].lastOutISO },
      ],
      minimumHeures: null,
    })
    expect(evaluation.disponible).toBe(false)
    expect(evaluation.ecarts[0].respecte).toBeNull()
    expect(evaluation.nb_violations).toBe(0)
    expect(evaluation.motif).toMatch(/aucun minimum/i)
  })
})

describe('📅 G1 — une semaine partielle ne prononce pas « aucun dépassement »', () => {
  //  Le dernier mensonge du module : `joursDansLaPeriode` était calculé puis
  //  jamais lu. Une fenêtre amputée rendait donc `niveau: 'aucun'` et
  //  `nb_depassees: 0` — un constat de conformité tiré de 3 jours sur 7.
  const troisJoursDeDixHeures = {
    '2025-12-29': H(10),
    '2025-12-30': H(10),
    '2025-12-31': H(10),
  }

  it('3 jours sur 7 ⇒ non évalué, même avec un seuil configuré', () => {
    const semaines = agregerParSemaine({
      secondesParJour: troisJoursDeDixHeures,
      debut: '2025-12-29',
      fin: '2025-12-31',
    })
    const evaluation = evaluerSeuilsHebdo({
      semaines,
      seuil: 40,
      seuilMajeur: 48,
      source: 'entreprise',
    })

    expect(semaines[0].joursDansLaPeriode).toBe(3)
    //  C'est LE point : pas « aucun », mais « on ne sait pas ».
    expect(evaluation.semaines[0].niveau).toBe('non_evalue')
    expect(evaluation.semaines[0].partielle).toBe(true)
  })

  it('7 jours couverts ⇒ le verdict redevient possible', () => {
    const semainePleine = {}
    for (const d of ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']) {
      semainePleine[d] = H(10)
    }
    const semaines = agregerParSemaine({
      secondesParJour: semainePleine,
      debut: '2025-12-29',
      fin: '2026-01-04',
    })
    const evaluation = evaluerSeuilsHebdo({
      semaines,
      seuil: 40,
      seuilMajeur: 48,
      source: 'entreprise',
    })

    expect(evaluation.semaines[0].partielle).toBe(false)
    expect(evaluation.semaines[0].niveau).toBe('majeur')
    expect(evaluation.nb_depassees).toBe(1)
  })

  it('un dépassement PROUVÉ survit à la semaine partielle', () => {
    //  Une semaine lue sur 3 jours peut déjà dépasser : 49 h en 3 jours (le
    //  barème haut vaut 48 h ; 48 h pile est « atteint », pas « dépassé »).
    //  Ce qui est constaté est vrai — c'est l'inverse (« rien à signaler ») qui
    //  ne se prononce pas sur une lecture incomplète.
    const semaines = agregerParSemaine({
      secondesParJour: { '2025-12-29': H(17), '2025-12-30': H(16), '2025-12-31': H(16) },
      debut: '2025-12-29',
      fin: '2025-12-31',
    })
    const evaluation = evaluerSeuilsHebdo({
      semaines,
      seuil: 40,
      seuilMajeur: 48,
      source: 'entreprise',
    })

    expect(evaluation.semaines[0].depasse).toBe(true)
    //  49 h atteint aussi le barème haut (48 h) : le niveau est « majeur »,
    //  et c'est le comportement voulu. Le point du test est que le
    //  DÉPASSEMENT est constaté malgré la semaine incomplète.
    expect(evaluation.semaines[0].niveau).toBe('majeur')
    expect(evaluation.nb_depassees).toBe(1)
  })
})

describe('📅 G1 — la fenêtre reste la même quel que soit le mois de référence', () => {
  it('décembre 2025 et janvier 2026 couvrent tous deux la semaine du réveillon', () => {
    const fDec = fenetreDeLecture(PERIODES_DECEMBRE)
    const fJan = fenetreDeLecture(PERIODES_JANVIER)

    //  Les deux fenêtres contiennent la semaine 29/12 → 04/01 : c'est ce qui
    //  garantit que la même semaine n'est pas vue deux fois amputée.
    expect(fDec.debut <= '2025-12-29').toBe(true)
    expect(fDec.fin >= '2026-01-04').toBe(true)
    expect(fJan.debut <= '2025-12-29').toBe(true)
    expect(fJan.fin >= '2026-01-04').toBe(true)
  })
})
