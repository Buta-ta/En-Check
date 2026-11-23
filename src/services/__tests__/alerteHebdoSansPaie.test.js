// src/services/__tests__/alerteHebdoSansPaie.test.js
// ═══════════════════════════════════════════════════════════════════════════
// ⏰ L'ALERTE HEBDO NE MEURT PLUS AVEC LA PAIE (constat G6)
//
// CE QUE FAISAIT LE MOTEUR
//   `loadOvertimeContext` ne chargeait les réglages que si le module « heures
//   supplémentaires » était actif. L'alerte hebdomadaire lisait ensuite ces
//   réglages : couper la paie ÉTEIGNAIT donc le contrôle du temps de travail.
//   Une entreprise sans module de paie n'avait aucun contrôle hebdomadaire — et
//   ne le savait pas.
//
// CE QUE CES TESTS VERROUILLENT
//   1. l'alerte reçoit ses seuils même quand le module est coupé ;
//   2. la PAIIE, elle, ne reçoit rien quand le module est coupé — les réglages
//      restent `null` pour tout ce qui calcule de l'argent ;
//   3. le seuil d'alerte est toujours accompagné de son origine (P5) ;
//   4. preuve du risque évité : charger les réglages sans condition ferait
//      passer une majoration de férié de 100 % à 150 %.
//
// ⚠️ Les valeurs (45 h, 50 h, 150 %) sont FICTIVES. Aucune n'est une règle
// légale, aucune ne vient d'une entreprise réelle.
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from 'vitest'
import FeatureService from '../featureService'
import { __internal } from '../hoursCalculator'
import { evaluerSeuilsHebdo } from '../plafondHebdomadaire'

const { loadOvertimeContext, seuilsAlerteHebdo, resoudreFerieDuJour } = __internal

const H = (h) => h * 3600

afterEach(() => {
  vi.restoreAllMocks()
})

/** Un réglage d'entreprise fictif, tel que le rendrait `getOvertimeSettingsAvecOrigine`. */
const reglage = (valeur, origine, majeur = null) => ({
  settings: { ...FeatureService.getDefaultOvertimeSettings(), weekly_threshold: valeur, weekly_threshold_major: majeur },
  provenance: { origine, motif: 'test' },
})

describe('Le seuil d’alerte ne dépend plus du module de paie', () => {
  it('module coupé : l’alertage reçoit quand même ses seuils', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(false)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(45, 'entreprise'))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')

    expect(ctx.hasOvertimeFeature).toBe(false)
    //  ⚠️ La paie ne reçoit RIEN : c'est ce qui protège les montants.
    expect(ctx.overtimeSettings).toBeNull()
    //  L'alerte, elle, reçoit tout.
    expect(ctx.reglageHebdo.settings.weekly_threshold).toBe(45)
    expect(ctx.reglageHebdo.provenance.origine).toBe('entreprise')
  })

  it('module actif : la paie reçoit les réglages, comme avant', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(true)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(45, 'entreprise'))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')

    expect(ctx.hasOvertimeFeature).toBe(true)
    expect(ctx.overtimeSettings.weekly_threshold).toBe(45)
  })

  it('une lecture impossible ne prétend rien', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(false)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockRejectedValue(new Error('base injoignable'))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')

    expect(ctx.reglageHebdo).toBeNull()
    expect(seuilsAlerteHebdo(ctx.reglageHebdo)).toEqual({
      seuil: null,
      seuilMajeur: null,
      source: 'inconnue',
    })
  })
})

describe('Le sélecteur de seuils d’alerte', () => {
  it('transmet la valeur et son origine', () => {
    expect(seuilsAlerteHebdo(reglage(45, 'entreprise', 50))).toEqual({
      seuil: 45,
      seuilMajeur: 50,
      source: 'entreprise',
    })
  })

  it('un défaut du produit s’annonce comme tel', () => {
    expect(seuilsAlerteHebdo(reglage(48, 'defaut_produit'))).toEqual({
      seuil: 48,
      seuilMajeur: null,
      source: 'defaut_produit',
    })
  })

  it('sans valeur, aucune origine n’est affirmée', () => {
    expect(seuilsAlerteHebdo({ settings: { weekly_threshold: null }, provenance: { origine: 'entreprise' } }))
      .toEqual({ seuil: null, seuilMajeur: null, source: 'inconnue' })
  })

  it('sans provenance, on ne devine pas l’entreprise', () => {
    expect(seuilsAlerteHebdo({ settings: { weekly_threshold: 48 }, provenance: null }).source).toBe('inconnue')
  })
})

describe('Bout en bout : une alerte existe sans module de paie', () => {
  it('une semaine de 50 h dépasse un seuil de 45 h, module coupé', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(false)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(45, 'entreprise'))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')
    const seuils = seuilsAlerteHebdo(ctx.reglageHebdo)

    const semaines = [{
      debut: '2026-10-05',
      fin: '2026-10-11',
      secondes: H(50),
      joursTravailles: 5,
      joursDansLaPeriode: 7,
    }]
    const evaluation = evaluerSeuilsHebdo({ semaines, ...seuils })

    expect(evaluation.disponible).toBe(true)
    expect(evaluation.nb_depassees).toBe(1)
    expect(evaluation.semaines[0].depassement_heures).toBe(5)
    expect(evaluation.source).toBe('entreprise')
  })

  it('sans règle d’entreprise, l’alerte se fait sur le défaut, dite comme telle', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, 'defaut_produit'))
    const evaluation = evaluerSeuilsHebdo({
      semaines: [{ debut: '2026-10-05', fin: '2026-10-11', secondes: H(50), joursTravailles: 5, joursDansLaPeriode: 7 }],
      ...seuils,
    })

    expect(evaluation.source).toBe('defaut_produit')
    expect(evaluation.nb_depassees).toBe(1)
  })
})

describe('Preuve du risque évité : la paie garde sa porte fermée', () => {
  it('des réglages chargés sans condition changeraient une majoration de férié', () => {
    const holiday = { name: 'Fête fictive', is_worked: false, overtime_rate: null }
    const enterpriseCfg = { pays: 'BJ', zone: null }

    //  Ce que voit la paie quand le module est coupé : aucun réglage.
    const sans = resoudreFerieDuJour({ date: '2026-01-01', holiday, enterpriseCfg, overtimeSettings: null })
    //  Ce qu'elle verrait si on chargeait les réglages sans condition.
    const avec = resoudreFerieDuJour({
      date: '2026-01-01',
      holiday,
      enterpriseCfg,
      overtimeSettings: { id: 'reglage-existent', rate_holiday: 150 },
    })

    expect(sans.tauxPercent).toBe(100)
    expect(avec.tauxPercent).toBe(150)
    //  D'où la règle : `overtimeSettings` reste conditionné au module.
    expect(sans.tauxPercent).not.toBe(avec.tauxPercent)
  })
})
