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
    expect(e.raison).toBe(RAISONS_INDISPONIBLE.aucun_seuil)
    expect(e.raison).not.toMatch(/conforme/)
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
