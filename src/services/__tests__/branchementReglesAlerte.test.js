// src/services/__tests__/branchementReglesAlerte.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🔌 LOT 2b — LE SEUIL D'ALERTE LIT LA TABLE VERSIONNÉE
//
// La règle du branchement, et c'est elle qu'on teste :
//   · une règle versionnée fait AUTORITÉ dès qu'elle existe ;
//   · sans règle, on retombe EXACTEMENT sur le comportement d'avant — pas de
//     « petite amélioration » glissée dans une bascule ;
//   · si la migration n'est pas installée, rien ne casse : repli silencieux ;
//   · la PAIE ne dépend pas de cette lecture : mêmes réglages, mêmes montants.
//
// ⚠️ Valeurs FICTIVES (45 h, 48 h, 50 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resoudre = vi.fn()

vi.mock('../reglesTempsTravail', () => ({
  resoudre: (...args) => resoudre(...args),
}))

const FeatureService = (await import('../featureService')).default
const { __internal } = await import('../hoursCalculator')
const { evaluerSeuilsHebdo } = await import('../plafondHebdomadaire')

const { seuilsAlerteHebdo, chargerReglesAlerte, loadOvertimeContext } = __internal

const H = (h) => h * 3600

const reglage = (valeur, activee = true, majeur = null) => ({
  settings: {
    ...FeatureService.getDefaultOvertimeSettings(),
    weekly_threshold: valeur,
    weekly_threshold_major: majeur,
    alerte_hebdo_activee: activee,
  },
  provenance: { origine: 'entreprise', motif: 'test' },
})

const regle = (valeur, origine = 'entreprise', dateEffet = '2026-09-01') => ({
  valeur, origine, dateEffet, majPar: 'admin-1', majLe: '2026-09-01T10:00:00Z', verrouille: false, regleId: 'r1',
})

const aucune = { valeur: null, origine: 'aucune', dateEffet: null }

beforeEach(() => {
  resoudre.mockReset()
  resoudre.mockResolvedValue({ ...aucune })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Sans règle versionnée : le comportement d’avant, à l’identique', () => {
  it('case cochée + réglage 48 h : seuil 48, alerte active — comme avant le lot', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, true), { seuil: aucune, niveau2: aucune })

    expect(seuils.actif).toBe(true)
    expect(seuils.seuil).toBe(48)
    expect(seuils.sourceValeur).toBe('reglage_entreprise')
  })

  it('case décochée : toujours muet, malgré un seuil présent', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, false), { seuil: aucune, niveau2: aucune })
    expect(seuils.actif).toBe(false)
    expect(seuils.seuil).toBeNull()
  })

  it('sans contexte de règles du tout, on ne casse rien', () => {
    const seuils = seuilsAlerteHebdo(reglage(45, true), null)
    expect(seuils.actif).toBe(true)
    expect(seuils.seuil).toBe(45)
  })
})

describe('Avec une règle versionnée : elle fait autorité', () => {
  it('la règle de 45 h l’emporte sur le réglage de 48 h', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, true), { seuil: regle(45), niveau2: aucune })

    expect(seuils.seuil).toBe(45)
    expect(seuils.sourceValeur).toBe('table_versionnee')
    expect(seuils.source).toBe('entreprise')
    expect(seuils.dateEffetRegle).toBe('2026-09-01')
  })

  it('une règle personnelle est nommée comme telle, pas comme une règle d’entreprise', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, true), {
      seuil: regle(38, 'employe'),
      niveau2: aucune,
    })
    expect(seuils.seuil).toBe(38)
    expect(seuils.source).toBe('employe')
  })

  it('le second niveau vient aussi de la table quand il y existe', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, true, 50), {
      seuil: regle(45),
      niveau2: regle(52),
    })
    expect(seuils.seuilMajeur).toBe(52)
  })

  it('la case reste la preuve : une règle sans activation n’alerte pas', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, false), { seuil: regle(45), niveau2: aucune })
    expect(seuils.actif).toBe(false)
    expect(seuils.seuil).toBeNull()
    expect(seuils.seuilPropose).toBe(45)
  })

  it('une semaine de 50 h déclenche sur la règle de 45 h, pas sur le 48 h hérité', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, true), { seuil: regle(45), niveau2: aucune })
    const semaines = [{ debut: '2026-10-05', fin: '2026-10-11', secondes: H(50), joursTravailles: 5, joursDansLaPeriode: 7 }]

    //  La primitive qui décide, pas une réimplémentation dans le test.
    const evaluation = evaluerSeuilsHebdo({ semaines, ...seuils })
    expect(evaluation.seuil).toBe(45)
    expect(evaluation.nb_depassees).toBe(1)
    expect(evaluation.semaines[0].depassement_heures).toBe(5)
  })
})

describe('Si la migration n’est pas installée', () => {
  it('la lecture des règles échoue sans bruit et rend null', async () => {
    resoudre.mockRejectedValue(new Error('PGRST202 function not found'))
    await expect(chargerReglesAlerte('ent-fictive')).resolves.toBeNull()
  })

  it('le calcul retombe alors sur le réglage existant', async () => {
    resoudre.mockRejectedValue(new Error('PGRST202'))
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(false)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(48, true))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')
    expect(ctx.reglesAlerte).toBeNull()

    const seuils = seuilsAlerteHebdo(ctx.reglageHebdo, ctx.reglesAlerte)
    expect(seuils.actif).toBe(true)
    expect(seuils.seuil).toBe(48)
  })
})

describe('La paie ne dépend pas de cette lecture', () => {
  it('les réglages de paie sont identiques avec ou sans règle versionnée', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(true)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(48, true))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    resoudre.mockResolvedValue({ ...aucune })
    const sansRegle = await loadOvertimeContext('ent-fictive')

    resoudre.mockImplementation(({ cle }) =>
      Promise.resolve(cle === 'alerte_hebdo_heures' ? regle(45) : { ...aucune }),
    )
    const avecRegle = await loadOvertimeContext('ent-fictive')

    //  La paie voit la MÊME chose ; seule l'alerte change de source.
    expect(avecRegle.overtimeSettings).toEqual(sansRegle.overtimeSettings)
    expect(seuilsAlerteHebdo(avecRegle.reglageHebdo, avecRegle.reglesAlerte).seuil).toBe(45)
    expect(seuilsAlerteHebdo(sansRegle.reglageHebdo, sansRegle.reglesAlerte).seuil).toBe(48)
  })

  it('la règle est lue sur la portée entreprise, sans employé inventé', async () => {
    resoudre.mockResolvedValue({ ...aucune })
    await chargerReglesAlerte('ent-42')

    const appels = resoudre.mock.calls.map(([arg]) => arg)
    expect(appels).toEqual([
      { entrepriseId: 'ent-42', cle: 'alerte_hebdo_heures' },
      { entrepriseId: 'ent-42', cle: 'alerte_hebdo_niveau2_heures' },
    ])
  })
})
