// src/services/__tests__/snapshotCalcul.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧊 LA MÉMOIRE DU MOTEUR (constats C1/C2)
//
// LE SCÉNARIO QUI MOTIVE CES TESTS
//   Le comptable corrige un badge du 12 mars. Le bulletin de mars, déjà remis,
//   change… et personne ne le sait. Un salarié qui conteste n'a aucun moyen de
//   savoir quel chiffre a été calculé, ni avec quels pointages.
//
// CE QUE CES TESTS VERROUILLENT
//   1. deux lectures des MÊMES pointages donnent la même empreinte, quel que
//      soit leur ordre (sinon tout calcul serait « périmé » en permanence) ;
//   2. corriger un badge change l'empreinte (sinon le calcul ne serait jamais
//      signalé comme périmé — le pire des deux mondes) ;
//   3. changer un seuil ou un taux horaire change l'empreinte des règles ;
//   4. une photo déjà prise est reconnue comme telle (idempotence), sans être
//      présentée comme une panne ;
//   5. on sait dire CE QUI a bougé entre deux photos, en dinars comme en clair.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it, vi } from 'vitest'
import {
  comparerSnapshots,
  construireSnapshot,
  empreinte,
  empreinteEntrees,
  empreinteRegles,
  enregistrerSnapshot,
  etatSnapshot,
} from '../snapshotCalcul'

const att = (id, type, iso, extra = {}) => ({ id, check_type: type, check_time: iso, ...extra })

const JOURNEE = [
  att('a1', 'in', '2026-03-12T08:00:00'),
  att('a2', 'out', '2026-03-12T17:00:00'),
]

describe('Empreinte des pointages', () => {
  it('deux lectures du même jour donnent la même empreinte, quel que soit l’ordre', () => {
    const inverse = [...JOURNEE].reverse()
    expect(empreinteEntrees(JOURNEE)).toBe(empreinteEntrees(inverse))
  })

  it('une sortie corrigée change l’empreinte', () => {
    const corrigee = [JOURNEE[0], { ...JOURNEE[1], check_time: '2026-03-12T18:00:00' }]
    expect(empreinteEntrees(corrigee)).not.toBe(empreinteEntrees(JOURNEE))
  })

  it('une correction tracée (modifie_le) change l’empreinte, même à heures égales', () => {
    const tracee = [JOURNEE[0], { ...JOURNEE[1], modifie_le: '2026-03-20T10:00:00Z' }]
    expect(empreinteEntrees(tracee)).not.toBe(empreinteEntrees(JOURNEE))
  })

  it('un badge ajouté change l’empreinte', () => {
    const avecPause = [...JOURNEE, att('a3', 'in', '2026-03-12T12:00:00')]
    expect(empreinteEntrees(avecPause)).not.toBe(empreinteEntrees(JOURNEE))
  })

  it('une journée vide a une empreinte stable', () => {
    expect(empreinteEntrees([])).toBe(empreinteEntrees([]))
    expect(empreinteEntrees([])).not.toBe(empreinteEntrees(JOURNEE))
  })
})

describe('Empreinte des règles', () => {
  const seuils = { appariementHeures: 16, plafondInventionHeures: 12, chargement: 'base' }
  const overtime = { id: 'ot-1', rate_normal: 25, rate_major: 50 }

  it('les métadonnées techniques ne changent pas l’empreinte', () => {
    const a = empreinteRegles({ seuils, overtimeSettings: overtime, tauxHoraire: 1500 })
    const b = empreinteRegles({
      seuils: { ...seuils, chargement: 'secours' },
      overtimeSettings: { ...overtime, updated_at: '2026-04-01T00:00:00Z' },
      tauxHoraire: 1500,
    })
    //  Sinon la moindre relecture « périmerait » tous les calculs figés.
    expect(a).toBe(b)
  })

  it('un seuil modifié, un taux horaire modifié ou un taux de férié modifié changent l’empreinte', () => {
    const base = empreinteRegles({ seuils, overtimeSettings: overtime, tauxHoraire: 1500 })

    expect(empreinteRegles({ seuils: { ...seuils, appariementHeures: 14 }, overtimeSettings: overtime, tauxHoraire: 1500 }))
      .not.toBe(base)
    expect(empreinteRegles({ seuils, overtimeSettings: overtime, tauxHoraire: 1600 }))
      .not.toBe(base)
    expect(empreinteRegles({
      seuils,
      overtimeSettings: overtime,
      tauxHoraire: 1500,
      feries: { jours: [{ date: '2026-05-01', taux_percent: 150, niveau: 'plancher' }] },
    })).not.toBe(base)
  })

  it('l’ordre des clés d’un réglage ne compte pas', () => {
    const a = empreinteRegles({ seuils: { a: 1, b: 2 } })
    const b = empreinteRegles({ seuils: { b: 2, a: 1 } })
    expect(a).toBe(b)
  })
})

describe('Photographie et péremption', () => {
  const calcul = { valorization: { total_gross: 91_500, currency: 'XOF' }, thisMonth: { normal: '40h00' } }
  const regles = { seuils: { appariementHeures: 16 }, overtimeSettings: { rate_normal: 25 }, tauxHoraire: 1500 }

  const snapshot = construireSnapshot({
    calcul,
    attendances: JOURNEE,
    regles,
    enterpriseId: 'ent-1',
    employeeId: 'emp-1',
    periodeDebut: '2026-03-01',
    periodeFin: '2026-03-31',
  })

  it('la photo reprend le montant figé et sa devise', () => {
    expect(snapshot.total_brut).toBe(91_500)
    expect(snapshot.devise).toBe('XOF')
    expect(snapshot.empreinte_entrees).toBe(empreinteEntrees(JOURNEE))
    expect(snapshot.payload.valorization.total_gross).toBe(91_500)
  })

  it('la photo reste valable tant que rien ne bouge', () => {
    expect(etatSnapshot({ snapshot, attendances: JOURNEE, regles })).toEqual({ perime: false, raisons: [] })
  })

  it('elle devient périmée si un badge change, et la raison est nommée', () => {
    const corrigee = [JOURNEE[0], { ...JOURNEE[1], check_time: '2026-03-12T19:00:00' }]
    const etat = etatSnapshot({ snapshot, attendances: corrigee, regles })

    expect(etat.perime).toBe(true)
    expect(etat.raisons).toContain('pointages modifiés')
  })

  it('elle devient périmée si un taux horaire change', () => {
    const etat = etatSnapshot({ snapshot, attendances: JOURNEE, regles: { ...regles, tauxHoraire: 1600 } })
    expect(etat.perime).toBe(true)
    expect(etat.raisons).toContain('règles modifiées')
  })

  it('sans photo, on ne prétend pas que tout va bien', () => {
    expect(etatSnapshot({}).perime).toBe(true)
    expect(etatSnapshot({}).raisons).toContain('aucun calcul figé')
  })
})

describe('Comparaison de deux photos', () => {
  it('dit ce qui a bougé, en montant', () => {
    const avant = { total_brut: 91_500, empreinte_entrees: 'a', empreinte_regles: 'r' }
    const apres = { total_brut: 88_500, empreinte_entrees: 'b', empreinte_regles: 'r' }

    const comparaison = comparerSnapshots(avant, apres)

    expect(comparaison.identique).toBe(false)
    const montant = comparaison.ecarts.find(e => e.champ === 'total_brut')
    expect(montant.delta).toBe(-3000)
    expect(comparaison.ecarts.every(e => e.champ !== 'empreinte_regles')).toBe(true)
  })

  it('deux photos identiques le disent', () => {
    const meme = { total_brut: 91_500, empreinte_entrees: 'a', empreinte_regles: 'r' }
    expect(comparerSnapshots(meme, { ...meme }).identique).toBe(true)
  })

  it('sans les deux photos, aucune conclusion', () => {
    expect(comparerSnapshots(null, { total_brut: 1 }).comparable).toBe(false)
  })
})

describe('Écriture', () => {
  const snapshot = { employee_id: 'emp-1', periode_debut: '2026-03-01' }

  it('signale une écriture réussie', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: () => ({ insert }) }

    expect(await enregistrerSnapshot(client, snapshot)).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith(snapshot)
  })

  it('une photo déjà prise n’est pas une panne (violation d’unicité)', async () => {
    const client = { from: () => ({ insert: async () => ({ error: { code: '23505', message: 'duplicate' } }) }) }
    expect(await enregistrerSnapshot(client, snapshot)).toEqual({ ok: true, deja_fige: true })
  })

  it('une vraie erreur remonte le message, sans le masquer', async () => {
    const client = { from: () => ({ insert: async () => ({ error: { code: '42501', message: 'permission denied' } }) }) }
    expect(await enregistrerSnapshot(client, snapshot)).toEqual({ ok: false, erreur: 'permission denied' })
  })

  it('sans client ou avec une photo incomplète, on refuse d’écrire', async () => {
    expect((await enregistrerSnapshot(null, snapshot)).ok).toBe(false)
    expect((await enregistrerSnapshot({ from: () => ({}) }, { employee_id: 'emp-1' })).ok).toBe(false)
  })
})

describe('Empreinte', () => {
  it('deux textes différents ont (presque toujours) deux empreintes différentes', () => {
    expect(empreinte('journee A')).not.toBe(empreinte('journee B'))
    expect(empreinte('')).toBe(empreinte(''))
  })
})
