// src/services/__tests__/plafondHebdomadaire.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 📅 LA FENÊTRE DE 7 JOURS (constat D1 de l'audit)
//
// CE QUE FAISAIT LE MOTEUR
//   `weekly_threshold` (40 h) et `weekly_threshold_major` (48 h) étaient lus
//   dans les réglages… et jamais utilisés. Une semaine à 62 h s'affichait
//   normalement, sans un mot.
//
// CE QUE CES TESTS VERROUILLENT
//   1. une semaine est une FENÊTRE lundi → dimanche, pas un mois ;
//   2. une semaine à cheval sur deux mois reste UNE semaine (sinon 50 h se
//      cachent dans deux « semaines » de 25 h) ;
//   3. sans seuil configuré, RIEN n'est conclu — un « 0 dépassement »
//      silencieux ferait croire à une conformité jamais évaluée ;
//   4. le message ne dit jamais « légal » : c'est un paramètre d'entreprise.
//
// ⚠️ Le quota « 964 h » n'est PAS testé ici, et ne doit pas l'être : c'est un
// cumul ancré (remise à zéro à l'anniversaire de l'ancre, proratisation), une
// autre primitive. Voir docs/AUDIT-ALGORITHMES-ET-ANTICIPATION.md §13.2.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  agregerParSemaine,
  dimancheDe,
  evaluerSeuilsHebdo,
  lundiDe,
  messageDepassement,
  semainesDeLaPeriode,
} from '../plafondHebdomadaire'

const H = (heures) => heures * 3600

/** Construit un map jour → secondes à partir d'une liste de [jour, heures]. */
const jours = (paires) => Object.fromEntries(paires.map(([cle, heures]) => [cle, H(heures)]))

describe('La semaine est une fenêtre, pas un mois', () => {
  it('le lundi et le dimanche d’une même semaine sont trouvés correctement', () => {
    //  2026-10-07 est un mercredi.
    expect(lundiDe('2026-10-07')).toBe('2026-10-05')
    expect(dimancheDe('2026-10-07')).toBe('2026-10-11')
    //  Un dimanche appartient à SA semaine (celle du lundi précédent).
    expect(lundiDe('2026-10-11')).toBe('2026-10-05')
    expect(dimancheDe('2026-10-05')).toBe('2026-10-11')
  })

  it('une semaine à cheval sur deux mois reste UNE semaine', () => {
    const semaines = semainesDeLaPeriode('2026-10-01', '2026-11-30')
    const chevauchement = semaines.find(s => s.debut === '2026-10-26')

    expect(chevauchement).toBeTruthy()
    expect(chevauchement.fin).toBe('2026-11-01')

    //  50 h réparties du 28/10 au 01/11 : un découpage par mois donnerait
    //  30 h (octobre) + 10 h (novembre), donc AUCUN dépassement de 48 h.
    //  La fenêtre, elle, voit 50 h.
    const agrege = agregerParSemaine({
      secondesParJour: jours([
        ['2026-10-28', 10], ['2026-10-29', 10], ['2026-10-30', 10],
        ['2026-10-31', 10], ['2026-11-01', 10],
      ]),
      debut: '2026-10-26',
      fin: '2026-11-01',
    })

    const semaine = agrege.find(s => s.debut === '2026-10-26')
    expect(semaine.secondes).toBe(H(50))
  })

  it('une fenêtre partielle reste chiffrée honnêtement : 3 jours couverts, pas 7', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([['2026-10-07', 8]]),
      debut: '2026-10-07',
      fin: '2026-10-09',
    })

    const evaluation = evaluerSeuilsHebdo({ semaines: agrege, seuil: 40, seuilMajeur: 48 })
    const semaine = evaluation.semaines[0]

    //  La couverture est portée par le chiffre, pas par un booléen : un drapeau
    //  « complete » vaudrait toujours vrai depuis que le moteur demande les
    //  semaines sur leurs 7 jours réels (constat P1, `fenetreDeLecture`).
    expect(semaine.joursDansLaPeriode).toBe(3)
    expect(semaine).not.toHaveProperty('complete')
  })
})

describe('Évaluation contre les seuils d’entreprise', () => {
  it('D1 — une semaine de 62 h dépasse le seuil de 48 h de 14 h', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([
        ['2026-10-05', 12], ['2026-10-06', 13], ['2026-10-07', 12],
        ['2026-10-08', 13], ['2026-10-09', 12],
      ]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    const evaluation = evaluerSeuilsHebdo({
      semaines: agrege,
      seuil: 40,
      seuilMajeur: 48,
      source: 'entreprise',
    })

    expect(evaluation.disponible).toBe(true)
    //  La source n'est plus affirmée par défaut : elle vient de l'appelant (P5).
    expect(evaluation.source).toBe('entreprise')
    expect(evaluation.semaines[0].heures).toBe(62)
    expect(evaluation.semaines[0].depasse).toBe(true)
    expect(evaluation.semaines[0].depassement_heures).toBe(14)
    expect(evaluation.semaines[0].niveau).toBe('majeur')
    expect(evaluation.nb_depassees).toBe(1)
    expect(evaluation.max.heures).toBe(62)
  })

  it('une semaine à 40 h déclenche les heures sup sans dépasser le plafond haut', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([
        ['2026-10-05', 8], ['2026-10-06', 8], ['2026-10-07', 8],
        ['2026-10-08', 8], ['2026-10-09', 8],
      ]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    const evaluation = evaluerSeuilsHebdo({ semaines: agrege, seuil: 40, seuilMajeur: 48 })

    expect(evaluation.semaines[0].heures).toBe(40)
    expect(evaluation.semaines[0].depasse).toBe(false)
    //  Le seuil « normal » est atteint : on le nomme, sans crier au dépassement.
    expect(evaluation.semaines[0].niveau).toBe('normal')
    expect(evaluation.nb_depassees).toBe(0)
  })

  it('sans seuil configuré : aucune conclusion, et surtout pas « 0 dépassement »', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([['2026-10-05', 12], ['2026-10-06', 12], ['2026-10-07', 12]]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    const evaluation = evaluerSeuilsHebdo({ semaines: agrege, seuil: null, seuilMajeur: null })

    expect(evaluation.disponible).toBe(false)
    expect(evaluation.motif).toContain('aucun seuil')
    expect(evaluation.semaines.every(s => s.niveau === 'non_evalue')).toBe(true)
    expect(evaluation.semaines.every(s => s.depasse === false)).toBe(true)
    expect(evaluation.max).toBeNull()
  })

  it('un seuil à 0 ou négatif n’est pas un seuil', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([['2026-10-05', 8]]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    expect(evaluerSeuilsHebdo({ semaines: agrege, seuil: 0 }).disponible).toBe(false)
    expect(evaluerSeuilsHebdo({ semaines: agrege, seuil: -5 }).disponible).toBe(false)
  })

  it('si seul le seuil haut est renseigné, c’est lui qui sert de plafond', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([['2026-10-05', 10], ['2026-10-06', 10], ['2026-10-07', 10],
        ['2026-10-08', 10], ['2026-10-09', 10]]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    const evaluation = evaluerSeuilsHebdo({ semaines: agrege, seuil: null, seuilMajeur: 48 })
    expect(evaluation.disponible).toBe(true)
    expect(evaluation.semaines[0].depasse).toBe(true) // 50 h > 48 h
  })
})

describe('Le message d’alerte', () => {
  it('dit le seuil, le maximum, et ne prétend jamais au « légal »', () => {
    const agrege = agregerParSemaine({
      secondesParJour: jours([['2026-10-05', 12], ['2026-10-06', 13], ['2026-10-07', 12],
        ['2026-10-08', 13], ['2026-10-09', 12]]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    //  Le seuil est ici explicitement déclaré comme celui de l'entreprise : c'est
    //  l'appelant qui le sait, pas la fonction. Sans cette information, le
    //  message ne prétend rien (voir origineSeuilHebdo.test.js).
    const message = messageDepassement(
      evaluerSeuilsHebdo({ semaines: agrege, seuil: 40, seuilMajeur: 48, source: 'entreprise' }),
    )

    expect(message).toContain('seuil hebdomadaire d’entreprise')
    expect(message).toContain('48 h')
    expect(message).toContain('62')
    expect(message.toLowerCase()).not.toContain('légal')
  })

  it('aucun message quand rien ne dépasse, ni quand rien n’est évalué', () => {
    const calme = agregerParSemaine({
      secondesParJour: jours([['2026-10-05', 8]]),
      debut: '2026-10-05',
      fin: '2026-10-11',
    })

    expect(messageDepassement(evaluerSeuilsHebdo({ semaines: calme, seuil: 48 }))).toBeNull()
    expect(messageDepassement(evaluerSeuilsHebdo({ semaines: calme, seuil: null }))).toBeNull()
    expect(messageDepassement(null)).toBeNull()
  })
})
