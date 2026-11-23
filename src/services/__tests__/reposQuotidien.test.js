// src/services/__tests__/reposQuotidien.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🌙 LE REPOS ENTRE DEUX JOURNÉES (constat D2 de l'audit)
//
// LE CAS QUI A MOTIVÉ CE FICHIER
//   Sortie à 23:10, reprise à 05:40 le lendemain : 6 h 30 de repos.
//   Le moteur n'avait rien à dire — il ne connaissait que des totaux.
//
// CE QUE CES TESTS VERROUILLENT
//   1. l'écart se mesure entre la SORTIE d'une journée et l'ENTRÉE de la
//      suivante, dans l'ordre réel des pointages (pas l'ordre des dates) ;
//   2. un enchaînement (entrée avant la sortie de la veille) n'est pas un
//      « repos de 0 h » : il est signalé comme chevauchement ;
//   3. sans minimum configuré, RIEN n'est affirmé — ni conformité, ni
//      violation ;
//   4. le message ne dit jamais « légal » : c'est un seuil d'entreprise.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  ecartsDeRepos,
  evaluerReposQuotidien,
  messageRepos,
} from '../reposQuotidien'

const journee = (date, debut, fin) => ({ date, debut, fin })

describe('Mesure de l’écart', () => {
  it('D2 — sortie 23:10, reprise 05:40 : 6 h 30 de repos, sous un minimum de 11 h', () => {
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-12', '2026-10-12T08:00:00', '2026-10-12T23:10:00'),
        journee('2026-10-13', '2026-10-13T05:40:00', '2026-10-13T14:00:00'),
      ],
      minimumHeures: 11,
    })

    expect(evaluation.ecarts).toHaveLength(1)
    expect(evaluation.ecarts[0].heures).toBe(6.5)
    expect(evaluation.ecarts[0].respecte).toBe(false)
    expect(evaluation.ecarts[0].manque_heures).toBe(4.5) // 11 − 6,5
    expect(evaluation.nb_violations).toBe(1)
  })

  it('un repos de 12 h respecte un minimum de 11 h', () => {
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-12', '2026-10-12T08:00:00', '2026-10-12T17:00:00'),
        journee('2026-10-13', '2026-10-13T05:00:00', '2026-10-13T14:00:00'),
      ],
      minimumHeures: 11,
    })

    expect(evaluation.ecarts[0].heures).toBe(12)
    expect(evaluation.ecarts[0].respecte).toBe(true)
    expect(evaluation.nb_violations).toBe(0)
    expect(messageRepos(evaluation)).toBeNull()
  })

  it('l’ordre réel des pointages prime sur l’ordre des dates', () => {
    //  La garde du 12 finit le 13 à 06:00 ; la journée du 13 commence à 18:00.
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-13', '2026-10-13T18:00:00', '2026-10-13T22:00:00'),
        journee('2026-10-12', '2026-10-12T22:00:00', '2026-10-13T06:00:00'),
      ],
      minimumHeures: 11,
    })

    expect(evaluation.ecarts[0].de).toBe('2026-10-12')
    expect(evaluation.ecarts[0].vers).toBe('2026-10-13')
    expect(evaluation.ecarts[0].heures).toBe(12) // 06:00 → 18:00
    expect(evaluation.nb_violations).toBe(0)
  })

  it('un enchaînement (entrée avant la sortie de la veille) est un chevauchement, pas un repos nul', () => {
    //  Garde du 12 : 22:00 → 06:00 le 13. Puis une entrée à 05:00 le 13,
    //  avant même la sortie de la garde.
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-12', '2026-10-12T22:00:00', '2026-10-13T06:00:00'),
        journee('2026-10-13', '2026-10-13T05:00:00', '2026-10-13T14:00:00'),
      ],
      minimumHeures: 11,
    })

    expect(evaluation.ecarts[0].chevauchement).toBe(true)
    //  Jamais présenté comme « 0 h de repos » : le chiffre serait faux.
    expect(evaluation.ecarts[0].heures).toBe(0)
    expect(evaluation.ecarts[0].respecte).toBe(false)
    expect(messageRepos(evaluation)).toContain('enchaînement')
  })

  it('une journée sans entrée ou sans sortie ne sert pas de base de mesure', () => {
    const ecarts = ecartsDeRepos([
      journee('2026-10-12', '2026-10-12T08:00:00', null),
      journee('2026-10-13', '2026-10-13T08:00:00', '2026-10-13T17:00:00'),
      journee('2026-10-14', '2026-10-14T08:00:00', '2026-10-14T17:00:00'),
    ])

    expect(ecarts).toHaveLength(1)
    expect(ecarts[0].de).toBe('2026-10-13')
  })
})

describe('Le refus de conclure sans seuil', () => {
  it('sans minimum configuré : disponible=false, aucune violation affirmée', () => {
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-12', '2026-10-12T08:00:00', '2026-10-12T23:10:00'),
        journee('2026-10-13', '2026-10-13T05:40:00', '2026-10-13T14:00:00'),
      ],
      minimumHeures: null,
    })

    expect(evaluation.disponible).toBe(false)
    expect(evaluation.motif).toContain('aucun minimum')
    expect(evaluation.nb_violations).toBe(0)
    expect(evaluation.ecarts[0].respecte).toBeNull() // non évalué, pas « conforme »
    expect(messageRepos(evaluation)).toBeNull()
  })

  it('un minimum de 0 ou négatif n’est pas un minimum', () => {
    const journees = [journee('2026-10-12', '2026-10-12T08:00:00', '2026-10-12T17:00:00')]

    expect(evaluerReposQuotidien({ journees, minimumHeures: 0 }).disponible).toBe(false)
    expect(evaluerReposQuotidien({ journees, minimumHeures: -3 }).disponible).toBe(false)
    expect(evaluerReposQuotidien({ journees, minimumHeures: 'onze' }).disponible).toBe(false)
  })
})

describe('Le message', () => {
  it('nomme le seuil d’entreprise, le pire écart et les dates — sans jamais dire « légal »', () => {
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-12', '2026-10-12T08:00:00', '2026-10-12T23:10:00'),
        journee('2026-10-13', '2026-10-13T05:40:00', '2026-10-13T14:00:00'),
      ],
      minimumHeures: 11,
    })

    const message = messageRepos(evaluation)

    expect(message).toContain('1 repos trop court')
    expect(message).toContain('seuil d’entreprise 11 h')
    expect(message).toContain('6.5 h')
    expect(message).toContain('12/10')
    expect(message).toContain('13/10')
    expect(message.toLowerCase()).not.toContain('légal')
  })

  it('accorde le pluriel', () => {
    const evaluation = evaluerReposQuotidien({
      journees: [
        journee('2026-10-12', '2026-10-12T08:00:00', '2026-10-12T23:00:00'),
        journee('2026-10-13', '2026-10-13T04:00:00', '2026-10-13T14:00:00'),
        journee('2026-10-13', '2026-10-13T22:00:00', '2026-10-14T02:00:00'),
      ],
      minimumHeures: 11,
    })

    //  23:00 → 04:00 = 5 h ; 14:00 → 22:00 = 8 h : deux repos trop courts.
    expect(messageRepos(evaluation)).toContain('2 repos trop courts')
  })
})
