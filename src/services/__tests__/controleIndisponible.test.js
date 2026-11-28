// src/services/__tests__/controleIndisponible.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 G7 — « CE CONTRÔLE N'A PAS ÉTÉ FAIT », et le dire sans crier
//
//   Deux décisions du fondateur tiennent ensemble, et ce fichier les garde :
//     · pas d'alerte sur une règle que personne n'a posée (24/10/2026) ;
//     · pas de silence qui se lise comme une conformité (V-B3).
//   L'alerte reste muette ; une LIGNE dit que le contrôle n'a pas été fait.
//
//   Et V-C2 : « prévu » et « pointé » sont deux sources, jamais une.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  ETIQUETTE_INDISPONIBLE,
  RAISONS_INDISPONIBLE,
  SOURCES_TEMPS,
  pourquoiControleIndisponible,
  legendeDesDeuxSources,
} from '../../lib/controleDisponible'

/** Un plafond tel que le moteur le rend, quand le contrôle a été fait. */
const evalue = { disponible: true, seuil: 45, nb_depassees: 0, source: 'entreprise' }

/** Et quand il ne l'a pas été, avec le motif que le moteur écrit vraiment. */
const nonEvalue = (motif) => ({
  disponible: false,
  motif_silence: motif,
  seuil: null,
  nb_depassees: 0,
})

describe('Un contrôle FAIT ne dit rien de plus', () => {
  it('évalué : aucune étiquette, même sans dépassement', () => {
    expect(pourquoiControleIndisponible(evalue)).toBeNull()
  })
})

describe('Un contrôle NON fait s’explique, il ne se tait pas', () => {
  it('aucun seuil choisi — le cas le plus fréquent', () => {
    const e = pourquoiControleIndisponible(nonEvalue('aucun seuil hebdomadaire valide enregistré'))
    expect(e.etiquette).toBe(ETIQUETTE_INDISPONIBLE)
    expect(e.raison).toMatch(/Aucun seuil hebdomadaire choisi/)
  })

  it('alerte désactivée par une décision : ce n’est pas un oubli, c’est un acte', () => {
    const e = pourquoiControleIndisponible(nonEvalue('alerte désactivée par une décision enregistrée'))
    expect(e.raison).toMatch(/décision enregistrée/)
    //  Le mot « case » ne doit pas apparaître : personne n'a oublié de cocher,
    //  quelqu'un a dit non.
    expect(e.raison).not.toMatch(/cochée/)
  })

  it('case non cochée : on nomme l’absence d’acte, sans accuser', () => {
    const e = pourquoiControleIndisponible(
      nonEvalue('alerte non activée : la case « m’alerter au-delà de ce seuil » n’est pas cochée'),
    )
    expect(e.raison).toMatch(/personne n’a demandé/)
  })

  it('période sans calcul : on ne laisse pas croire à un zéro', () => {
    const e = pourquoiControleIndisponible(null)
    expect(e.raison).toBe(RAISONS_INDISPONIBLE.non_calcule)
  })

  it('un motif inconnu ne devient jamais rassurant', () => {
    const e = pourquoiControleIndisponible(nonEvalue(''))
    expect(e.etiquette).toBe(ETIQUETTE_INDISPONIBLE)
    expect(e.raison).not.toMatch(/conforme/)
    //  ⚠️ Et il ne NOMME pas une cause qu'il ignore. Avant, il répondait
    //  « Aucun seuil hebdomadaire choisi » alors qu'il n'en savait rien : sur
    //  un serveur sans migration, un seuil de 45 h enregistré était annoncé
    //  absent. Le motif inconnu dit désormais qu'aucun verdict n'a pu être
    //  rendu, ce qui est exactement ce que l'on sait.
    expect(e.raison).toBe(RAISONS_INDISPONIBLE.regle_sans_verdict)
    expect(e.raison).not.toMatch(/Aucun seuil/)
  })

  it('aucune des raisons ne prétend à une conformité', () => {
    for (const raison of Object.values(RAISONS_INDISPONIBLE)) {
      expect(raison).not.toMatch(/\bconforme\b/i)
      expect(raison).not.toMatch(/\blégal/i)
    }
  })
})

describe('V-C2 — prévu et pointé restent deux choses', () => {
  it('chaque source a son mot et sa précision', () => {
    expect(SOURCES_TEMPS.prevue.etiquette).toBe('Prévu')
    expect(SOURCES_TEMPS.pointee.etiquette).toBe('Pointé')
    expect(SOURCES_TEMPS.prevue.precision).toMatch(/prévu, pas ce qui a été fait/)
    expect(SOURCES_TEMPS.pointee.precision).toMatch(/fait, pas ce qui était prévu/)
  })

  it('la légende nomme les deux, dans l’ordre de lecture', () => {
    const legende = legendeDesDeuxSources()
    expect(legende).toContain('« Prévu »')
    expect(legende).toContain('« Pointé »')
    expect(legende.indexOf('Prévu')).toBeLessThan(legende.indexOf('Pointé'))
  })

  it('la légende ne présente jamais l’écart comme un contrôle de conformité', () => {
    const legende = legendeDesDeuxSources()
    expect(legende).not.toMatch(/conforme/i)
    expect(legende).not.toMatch(/légal/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  G7-bis — « évalué » ne veut pas dire « la semaine a eu lieu »
//
//  Trouvé le 24/10/2026 en préparant l'affichage : une semaine ENTIÈREMENT
//  FUTURE (26/10 → 01/11, consultée le 24/10) ressortait `partielle: false`,
//  `niveau: 'aucun'`, `heures: 0`. Autrement dit « rien à signaler » sur des
//  jours qui n'étaient pas encore arrivés.
//
//  C'est la même faute que V-B3, un cran plus loin : le silence ne disait pas
//  qu'il portait sur du vide. Ces cas sont désormais nommés.
// ─────────────────────────────────────────────────────────────────────────────

describe('⏳ G7-bis — semaines en cours et à venir', () => {
  const semaine = (extra) => ({
    debut: '2026-10-26',
    fin: '2026-11-01',
    heures: 0,
    depasse: false,
    niveau: 'non_evalue',
    ...extra,
  })
  const plafondEvaluate = (...semaines) => ({
    disponible: true,
    seuil: 48,
    source: 'entreprise',
    semaines,
  })

  it('une semaine entièrement future n’est pas « sans dépassement »', () => {
    const etat = pourquoiControleIndisponible(
      plafondEvaluate(semaine({ a_venir: true, partielle: true, joursEchues: 0 })),
    )
    expect(etat).not.toBeNull()
    expect(etat.raison).toMatch(/pas encore commencé/i)
  })

  it('une semaine en cours dit qu’elle n’est pas terminée', () => {
    const etat = pourquoiControleIndisponible(
      plafondEvaluate(
        semaine({ a_venir: false, partielle: true, joursEchues: 6 }),
        semaine({ debut: '2026-10-19', fin: '2026-10-25', partielle: true, joursEchues: 6 }),
      ),
    )
    expect(etat).not.toBeNull()
    expect(etat.raison).toMatch(/n’est pas terminée|pas terminée/i)
  })

  it('une semaine pleinement échue et sans dépassement reste silencieuse', () => {
    //  Le silence doit rester possible : c'est le seul cas où « rien à
    //  signaler » est vrai.
    const etat = pourquoiControleIndisponible(
      plafondEvaluate(
        semaine({ a_venir: false, partielle: false, joursEchues: 7, debut: '2026-10-05' }),
      ),
    )
    expect(etat).toBeNull()
  })

  it('un dépassement prouvé garde la parole, même sur une semaine partielle', () => {
    //  La ligne ne contredit pas l'alerte : un dépassement constaté est vrai,
    //  quel que soit le nombre de jours couverts.
    const etat = pourquoiControleIndisponible(
      plafondEvaluate(
        semaine({ a_venir: false, partielle: true, joursEchues: 5, depasse: true, heures: 60 }),
        semaine({ debut: '2026-10-19', fin: '2026-10-25', partielle: true, joursEchues: 5, depasse: true, heures: 55 }),
      ),
    )
    expect(etat).toBeNull()
  })

  it('aucune raison ne dit « conforme » ni « légal »', () => {
    const raisons = Object.values(RAISONS_INDISPONIBLE).join(' ').toLowerCase()
    expect(raisons).not.toContain('conforme')
    expect(raisons).not.toContain('légal')
    expect(raisons).not.toContain('legal')
  })
})
