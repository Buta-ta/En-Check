// src/services/__tests__/monEntreprise.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🏢 « MON ENTREPRISE » — ce que l'écran a le droit d'affirmer
//
// Quatre garanties, et ce sont elles qui comptent :
//   1. un administrateur ne voit pas l'entreprise d'un autre ;
//   2. un modèle non confirmé est affiché comme une PROPOSITION ;
//   3. une valeur choisie par l'entreprise n'est jamais écrasée par le modèle ;
//   4. aucun libellé ne présente un chiffre comme « légal ».
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  MODELES_HEBDO,
  MODELES_PAR_PAYS,
  REGLES_AFFICHEES,
  accesAutorise,
  entreprisesVisibles,
  formaterHeures,
  libelleStatutModele,
  modelePropose,
  statutModele,
} from '../../lib/monEntreprise'

const ENT = { id: 'ent-a', name: 'Fictive A' }
const AUTRE = { id: 'ent-b', name: 'Fictive B' }

describe('Qui voit quoi', () => {
  it('un super-admin voit toutes les entreprises', () => {
    const admin = { role: 'super_admin' }
    expect(entreprisesVisibles(admin, [ENT, AUTRE])).toHaveLength(2)
    expect(accesAutorise(admin, 'ent-b', [ENT, AUTRE])).toBe(true)
  })

  it('un administrateur ne voit que la sienne', () => {
    const admin = { role: 'admin', enterprise_id: 'ent-a' }
    expect(entreprisesVisibles(admin, [ENT, AUTRE])).toEqual([ENT])
    expect(accesAutorise(admin, 'ent-b', [ENT, AUTRE])).toBe(false)
  })

  it('sans administrateur, rien n’est visible', () => {
    expect(entreprisesVisibles(null, [ENT])).toEqual([])
    expect(accesAutorise(null, 'ent-a', [ENT])).toBe(false)
  })

  it('une entreprise absente de la liste n’est pas accessible, même pour un id connu', () => {
    const admin = { role: 'admin', enterprise_id: 'ent-a' }
    expect(accesAutorise(admin, 'ent-a', [])).toBe(false)
  })
})

describe('Le modèle proposé', () => {
  it('le défaut du produit est 48 h, et il est le premier proposé', () => {
    expect(modelePropose(null).heures).toBe(48)
    expect(MODELES_HEBDO[0].heures).toBe(48)
  })

  it('aucun pays n’est rattaché à un modèle : rien n’est inventé', () => {
    expect(Object.keys(MODELES_PAR_PAYS)).toHaveLength(0)
    //  Un pays connu ne change donc rien tant qu'aucune source n'existe.
    expect(modelePropose('BJ').heures).toBe(48)
  })

  it('sans règle, le statut est « proposé » — jamais « appliqué »', () => {
    const etat = statutModele({ valeurRegle: null })
    expect(etat.statut_source).toBe('propose')
    expect(libelleStatutModele(etat.statut_source)).toContain('non appliquée')
  })

  it('une règle égale au modèle est dite appliquée', () => {
    expect(statutModele({ valeurRegle: 48 }).statut_source).toBe('applique')
  })

  it('une valeur choisie par l’entreprise n’est pas écrasée : elle est signalée', () => {
    const etat = statutModele({ valeurRegle: 45 })
    expect(etat.statut_source).toBe('confirme_autre')
    expect(etat.valeur).toBe(45)
    expect(etat.ecart).toBe(-3)
    expect(libelleStatutModele(etat.statut_source)).toContain('autre valeur')
  })
})

describe('Les mots', () => {
  it('aucun statut ni modèle ne dit « légal »', () => {
    const textes = [
      ...MODELES_HEBDO.map((m) => m.libelle),
      ...['propose', 'applique', 'confirme_autre'].map(libelleStatutModele),
      ...REGLES_AFFICHEES.flatMap((r) => [r.libelle, r.aide]),
    ]
    for (const texte of textes) {
      expect(texte.toLowerCase()).not.toContain('légal')
    }
  })

  it('une valeur absente est dite « non configuré », pas 0 h', () => {
    expect(formaterHeures(null)).toBe('non configuré')
    expect(formaterHeures(undefined)).toBe('non configuré')
    expect(formaterHeures(0)).toBe('0 h')
    expect(formaterHeures('45')).toBe('45 h')
  })
})
