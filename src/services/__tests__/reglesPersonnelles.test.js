// src/services/__tests__/reglesPersonnelles.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 👤 LES TROIS ÉTATS D'UN RÉGLAGE — la logique, sans base et sans écran
//
// Ce que ces tests verrouillent :
//   1. le verrou gagne sur l'origine : une valeur verrouillée n'est jamais
//      présentée comme « règle de l'entreprise » ;
//   2. « aucune valeur » s'écrit « non configuré » — jamais « 0 h » ;
//   3. l'aperçu d'impact d'une écriture personnelle ne parle que d'UNE
//      personne, et ne bloque que sur un verrou réel ;
//   4. les clés du libellé sont exactement celles que la RPC accepte.
//
// ⚠️ Valeurs FICTIVES. Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/db', () => ({ db: () => ({ rpc: vi.fn() }) }))

const {
  CLES_REGLAGES,
  apercuReglagePersonnel,
  dateEffetCourte,
  estPersonnelle,
  etatReglage,
  formaterValeurHeures,
  libelleEtat,
  phraseImpact,
  retourPossible,
} = await import('../../lib/reglesPersonnelles')

const { CLES } = await import('../reglesTempsTravail')

describe('Les clés personnalisables ne dérivent pas de celles de la RPC', () => {
  it('ce sont les trois mêmes chaînes, dans l’ordre de lecture', () => {
    expect(CLES_REGLAGES.map((r) => r.cle)).toEqual([
      CLES.REPOS_MINIMUM,
      CLES.ALERTE_HEBDO,
      CLES.ALERTE_HEBDO_NIVEAU2,
    ])
  })

  it('aucune clé de paie n’est offerte en personnalisation', () => {
    const cles = CLES_REGLAGES.map((r) => r.cle)
    expect(cles).not.toContain(CLES.DECLENCHEMENT_PAIE_HEBDO)
    expect(cles).not.toContain(CLES.PLAFOND_LEGAL)
  })
})

describe('etatReglage — quatre vérités, aucune devinée', () => {
  it('une règle d’entreprise se lit « suit l’entreprise »', () => {
    expect(etatReglage({ valeur: 45, origine: 'entreprise', verrouille: false })).toBe('suit_entreprise')
  })

  it('une valeur nominative se lit « personnelle »', () => {
    expect(etatReglage({ valeur: 38, origine: 'employe', verrouille: false })).toBe('personnelle')
  })

  it('le VERROU prime : même nominative, elle se dit verrouillée', () => {
    expect(etatReglage({ valeur: 38, origine: 'employe', verrouille: true })).toBe('personnelle_verrouillee')
  })

  it('sans valeur, l’état est « aucune » — pas « conforme »', () => {
    expect(etatReglage({ valeur: null, origine: 'aucune', verrouille: false })).toBe('aucune')
    expect(etatReglage(null)).toBe('aucune')
    expect(etatReglage(undefined)).toBe('aucune')
  })

  it('une valeur de contrat se lit comme l’entreprise : elle n’est pas nominative', () => {
    expect(etatReglage({ valeur: 42, origine: 'contrat', verrouille: false })).toBe('suit_entreprise')
  })
})

describe('Les mots de l’écran', () => {
  it('une valeur absente s’écrit « non configuré », jamais « 0 h »', () => {
    expect(formaterValeurHeures(null)).toBe('non configuré')
    expect(formaterValeurHeures(undefined)).toBe('non configuré')
    expect(formaterValeurHeures('')).toBe('non configuré')
    expect(formaterValeurHeures(0)).not.toBe('non configuré')
  })

  it('les heures s’écrivent en clair', () => {
    expect(formaterValeurHeures(11)).toBe('11 h')
    expect(formaterValeurHeures('48')).toBe('48 h')
    expect(formaterValeurHeures(11.5)).toBe('11.5 h')
  })

  it('chaque état porte un mot, jamais une couleur seule (C7)', () => {
    expect(libelleEtat('suit_entreprise')).toBe('Règle de l’entreprise')
    expect(libelleEtat('personnelle')).toBe('Réglage personnel')
    expect(libelleEtat('personnelle_verrouillee')).toBe('Réglage personnel · verrouillé')
    expect(libelleEtat('aucune')).toBe('Aucune valeur')
    expect(libelleEtat('inconnu')).toBe('Aucune valeur')
  })

  it('la date d’effet se lit sans glisser d’un jour', () => {
    expect(dateEffetCourte('2026-10-12')).toBe('12 oct. 2026')
    expect(dateEffetCourte(null)).toBeNull()
  })

  it('seuls les états nominatifs peuvent revenir à l’entreprise', () => {
    expect(retourPossible('personnelle')).toBe(true)
    expect(retourPossible('personnelle_verrouillee')).toBe(true)
    expect(retourPossible('suit_entreprise')).toBe(false)
    expect(retourPossible('aucune')).toBe(false)
    expect(estPersonnelle('suit_entreprise')).toBe(false)
  })
})

describe('apercuReglagePersonnel — une personne, et ce qui change', () => {
  const entreprise = { valeur: 45, origine: 'entreprise', verrouille: false }
  const personnelle = { valeur: 38, origine: 'employe', verrouille: false }
  const verrouillee = { valeur: 38, origine: 'employe', verrouille: true }

  it('ne concerne jamais qu’une personne : c’est un réglage nominatif', () => {
    expect(apercuReglagePersonnel({ resolution: entreprise, valeur: 40 }).personnesConcernees).toBe(1)
  })

  it('dit le changement quand il y en a un', () => {
    const impact = apercuReglagePersonnel({ resolution: entreprise, valeur: 40 })
    expect(impact.change).toBe(true)
    expect(impact.valeurActuelle).toBe(45)
    expect(impact.nouvelleValeur).toBe(40)
  })

  it('ne prétend pas à un changement quand la valeur est la même', () => {
    const impact = apercuReglagePersonnel({ resolution: personnelle, valeur: 38 })
    expect(impact.change).toBe(false)
  })

  it('une chaîne vide veut dire « non configuré », pas zéro', () => {
    const impact = apercuReglagePersonnel({ resolution: personnelle, valeur: '' })
    expect(impact.nouvelleValeur).toBeNull()
    expect(impact.change).toBe(true)
  })

  it('le verrou bloque — sauf pour un super-administrateur', () => {
    expect(apercuReglagePersonnel({ resolution: verrouillee, valeur: 40 }).ecritureBloquee).toBe(true)
    expect(
      apercuReglagePersonnel({ resolution: verrouillee, valeur: 40, superAdmin: true }).ecritureBloquee,
    ).toBe(false)
  })

  it('un verrou demandé n’est pas un verrou existant', () => {
    const impact = apercuReglagePersonnel({ resolution: entreprise, valeur: 40, verrouille: true })
    expect(impact.verrouDemande).toBe(true)
    expect(impact.verrouillee).toBe(false)
    expect(impact.ecritureBloquee).toBe(false)
  })

  it('la phrase d’impact dit les deux valeurs, sans jargon', () => {
    const impact = apercuReglagePersonnel({ resolution: personnelle, valeur: 11 })
    expect(phraseImpact(impact)).toBe('Cette personne passerait de 38 h à 11 h.')
  })

  it('sans changement de valeur, la phrase le dit au lieu de faire semblant', () => {
    const impact = apercuReglagePersonnel({ resolution: personnelle, valeur: 38 })
    expect(phraseImpact(impact)).toContain('sans changement de valeur')
  })

  it('sans valeur applicable, la phrase le dit', () => {
    const impact = apercuReglagePersonnel({
      resolution: { valeur: null, origine: 'aucune', verrouille: false },
      valeur: 48,
    })
    expect(phraseImpact(impact)).toBe('Cette personne passerait de non configuré à 48 h.')
  })
})
