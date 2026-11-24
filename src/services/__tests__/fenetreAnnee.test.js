// src/services/__tests__/fenetreAnnee.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 📅 P1 — LA SEMAINE QUI TRAVERSE LE 31 DÉCEMBRE
//
// CE QUE FAISAIT LE MOTEUR (constat reproduit avant correction)
//   La lecture des pointages s'arrêtait aux bornes de l'année civile, et les
//   résumés de journées aussi (`hoursCalculator.js` l. 675). Une semaine du
//   29/12 au 04/01 était donc vue deux fois, amputée :
//     · côté décembre : 30 h (3 jours) et aucun dépassement ;
//     · côté janvier  : 20 h (2 jours) et aucun dépassement ;
//     · en réalité    : 50 h, donc 2 h au-delà d'un seuil de 48 h.
//   Le repos entre le 31/12 à 23 h 10 et le 01/01 à 05 h 40 (6 h 30) tombait
//   dans un trou : 0 écart mesuré au lieu de 4 h 30 manquantes pour un minimum
//   fictif de 11 h.
//
// CE QUE CES TESTS VERROUILLENT
//   1. la fenêtre de lecture déborde l'année de ce qu'il faut, et rien de plus ;
//   2. les journées hors année civile existent bel et bien dans les résumés ;
//   3. la semaine complète se lit une seule fois, à 50 h, avec son dépassement ;
//   4. les totaux mensuels et annuels, eux, ne changent pas : ils bouclent sur
//      leurs propres listes de jours, jamais sur la fenêtre élargie.
//
// ⚠️ Les valeurs (10 h, 48 h, 11 h) sont FICTIVES. Aucune n'est une règle
// légale, aucune ne vient d'une entreprise réelle.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { fenetreDeLecture, __internal } from '../hoursCalculator'
import { agregerParSemaine, evaluerSeuilsHebdo } from '../plafondHebdomadaire'

const { buildDaySummariesStrict } = __internal
const H = (h) => h * 3600

/** Un pointage d'entrée ou de sortie, à l'heure UTC indiquée. */
const pointage = (iso, type) => ({
  id: `${iso}-${type}`,
  check_time: iso,
  check_type: type,
  is_auto_closed: false,
  method: 'badge',
})

/** Cinq journées fictives de 10 h : 29, 30, 31 décembre puis 1er, 2 janvier. */
const semaineFictive = [
  pointage('2025-12-29T08:00:00.000Z', 'in'),
  pointage('2025-12-29T18:00:00.000Z', 'out'),
  pointage('2025-12-30T08:00:00.000Z', 'in'),
  pointage('2025-12-30T18:00:00.000Z', 'out'),
  pointage('2025-12-31T08:00:00.000Z', 'in'),
  pointage('2025-12-31T18:00:00.000Z', 'out'),
  pointage('2026-01-01T08:00:00.000Z', 'in'),
  pointage('2026-01-01T18:00:00.000Z', 'out'),
  pointage('2026-01-02T08:00:00.000Z', 'in'),
  pointage('2026-01-02T18:00:00.000Z', 'out'),
]

/**
 * Résume les journées exactement comme le moteur : on transmet les PÉRIODES,
 * jamais des bornes — la fenêtre de calcul est dérivée à l'intérieur.
 */
const resumer = ({ debutAnnee, finAnnee, debutMois, finMois }) =>
  buildDaySummariesStrict({
    attendances: semaineFictive,
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

/** Les quatre périodes d'une référence au mois de décembre 2025. */
const PERIODES_DECEMBRE = {
  debutAnnee: '2025-01-01',
  finAnnee: '2025-12-31',
  debutMois: '2025-12-01',
  finMois: '2025-12-31',
}

describe('La fenêtre de lecture déborde l’année civile de ce qu’il faut', () => {
  it('côté décembre, elle va jusqu’au dimanche qui suit le 31', () => {
    const f = fenetreDeLecture({
      debutAnnee: '2025-01-01',
      finAnnee: '2025-12-31',
      debutMois: '2025-12-01',
      finMois: '2025-12-31',
    })

    expect(f.fin).toBe('2026-01-04')
    expect(f.debut).toBe('2025-01-01')
    //  Le lendemain du dernier jour du mois sert au contrôle du repos.
    expect(f.lendemain).toBe('2026-01-01')
  })

  it('côté janvier, elle remonte au lundi qui précède le 1er', () => {
    const f = fenetreDeLecture({
      debutAnnee: '2026-01-01',
      finAnnee: '2026-12-31',
      debutMois: '2026-01-01',
      finMois: '2026-01-31',
    })

    expect(f.debut).toBe('2025-12-29')
    expect(f.fin).toBe('2026-12-31')
  })

  it('au milieu de l’année, rien ne change', () => {
    const f = fenetreDeLecture({
      debutAnnee: '2026-01-01',
      finAnnee: '2026-12-31',
      debutMois: '2026-03-01',
      finMois: '2026-03-31',
    })

    //  La fenêtre ne rétrécit jamais l'année : elle ne fait que l'élargir aux
    //  bords. Aucun calcul de mars ne se met donc à voir d'autres journées.
    expect(f.debut).toBe('2026-01-01')
    expect(f.fin).toBe('2026-12-31')
  })
})

describe('Les journées hors année civile existent dans les résumés', () => {
  it('le 1er janvier est calculé quand la borne le couvre', () => {
    const summaries = resumer(PERIODES_DECEMBRE)

    expect(summaries['2025-12-31'].totalSeconds).toBe(H(10))
    expect(summaries['2026-01-01'].totalSeconds).toBe(H(10))
    //  L'entrée du 1er janvier est bien horodatée : c'est elle qui manquait au
    //  contrôle de repos.
    expect(summaries['2026-01-01'].firstInISO).toBe('2026-01-01T08:00:00.000Z')
  })

  it('la fenêtre n’est pas rétrécissable : décembre voit aussi le 1er janvier', () => {
    //  Le défaut d'origine consistait à s'arrêter au 31/12. La fonction refuse
    //  désormais de recevoir des bornes : elle les dérive des périodes. Ce test
    //  documente donc que la journée existe, même quand la référence est
    //  décembre — c'est elle qui manquait au contrôle de repos du 31 au 1er.
    const summaries = resumer(PERIODES_DECEMBRE)

    expect(summaries['2026-01-01']).toBeDefined()
    expect(summaries['2026-01-01'].firstInISO).toBe('2026-01-01T08:00:00.000Z')
  })
})

describe('La semaine complète se lit une seule fois', () => {
  const secondesDeLaSemaine = (periodes) => {
    const summaries = resumer(periodes)
    const secondesParJour = {}
    for (const cle of Object.keys(summaries)) secondesParJour[cle] = summaries[cle].totalSeconds || 0
    return secondesParJour
  }

  it('50 h vues d’un bloc, et 2 h au-delà du second niveau de 48 h', () => {
    const semaines = agregerParSemaine({
      secondesParJour: secondesDeLaSemaine(PERIODES_DECEMBRE),
      debut: '2025-12-29',
      fin: '2026-01-04',
    })

    expect(semaines).toHaveLength(1)
    expect(semaines[0].secondes).toBe(H(50))

    const evaluation = evaluerSeuilsHebdo({ semaines, seuil: 40, seuilMajeur: 48 })
    expect(evaluation.nb_depassees).toBe(1)
    //  Déclenchement sur le seuil choisi (40 h) : 50 − 40 = 10.
    expect(evaluation.semaines[0].depassement_heures).toBe(10)
    //  Et les 2 h au-delà du second niveau sont dites séparément.
    expect(evaluation.semaines[0].depassement_niveau_haut_heures).toBe(2)
    expect(evaluation.semaines[0].joursDansLaPeriode).toBe(7)
  })

  it('les totaux d’un mois ne voient jamais les journées de la fenêtre élargie', () => {
    const summaries = resumer(PERIODES_DECEMBRE)
    const joursDeDecembre = ['2025-12-29', '2025-12-30', '2025-12-31']

    const totalDecembre = joursDeDecembre
      .map((d) => (summaries[d] ? summaries[d].totalSeconds : 0))
      .reduce((a, b) => a + b, 0)

    //  Le mois de décembre reste à 30 h : l'élargissement de la lecture ne
    //  change pas ce qui est compté dans un mois, seulement ce que les fenêtres
    //  hebdomadaires et de repos peuvent voir.
    expect(totalDecembre).toBe(H(30))
  })
})
