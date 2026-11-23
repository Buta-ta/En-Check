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
//   2. la PAIE, elle, ne reçoit rien quand le module est coupé — les réglages
//      restent `null` pour tout ce qui calcule de l'argent ;
//   3. le seuil d'alerte est toujours accompagné de son origine (P5) ;
//   4. preuve du risque évité : charger les réglages sans condition ferait
//      passer une majoration de férié de 100 % à 150 %.
//
// ET SURTOUT (réponse à la question « pourquoi les alerter ? »)
//   5. UNE ENTREPRISE QUI N'A RIEN CONFIGURÉ N'EST PAS ALERTÉE. Le défaut
//      produit (48 h) pré-remplit un formulaire ; il n'allume pas un
//      avertissement. Une alerte est une affirmation (« vous avez dépassé VOTRE
//      seuil ») : elle exige un seuil choisi, prouvé.
//
// ⚠️ Les valeurs (45 h, 48 h, 50 h, 150 %) sont FICTIVES. Aucune n'est une
// règle légale, aucune ne vient d'une entreprise réelle.
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

/**
 * Un réglage fictif, tel que le rendrait `getOvertimeSettingsAvecOrigine`.
 * `activee` reproduit la case « m'alerter au-delà de ce seuil » : elle est
 * distincte de la valeur, c'est tout l'objet du lot.
 */
const reglage = (valeur, origine, majeur = null, activee = true) => ({
  settings: {
    ...FeatureService.getDefaultOvertimeSettings(),
    weekly_threshold: valeur,
    weekly_threshold_major: majeur,
    alerte_hebdo_activee: activee,
  },
  provenance: { origine, motif: 'test' },
})

const SEMAINE_50H = [{ debut: '2026-10-05', fin: '2026-10-11', secondes: H(50), joursTravailles: 5, joursDansLaPeriode: 7 }]

describe('Le seuil d’alerte ne dépend plus du module de paie', () => {
  it('module coupé : l’alerte reçoit quand même ses seuils', async () => {
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
    expect(seuilsAlerteHebdo(ctx.reglageHebdo)).toMatchObject({
      seuil: null,
      seuilMajeur: null,
      source: 'inconnue',
      actif: false,
    })
  })
})

describe('Le sélecteur de seuils d’alerte', () => {
  it('un seuil d’entreprise est utilisable et nommé', () => {
    expect(seuilsAlerteHebdo(reglage(45, 'entreprise', 50))).toMatchObject({
      seuil: 45,
      seuilMajeur: 50,
      source: 'entreprise',
      actif: true,
      motif: null,
    })
  })

  it('le défaut du produit reste une proposition tant que la case n’est pas cochée', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, 'defaut_produit', null, false))
    expect(seuils).toMatchObject({
      seuil: null,
      seuilMajeur: null,
      actif: false,
      seuilPropose: 48,
    })
    expect(seuils.motif).toContain('non activée')
  })

  it('une valeur héritée (48 ou 40) reste muette sans la case', () => {
    for (const valeur of [48, 40]) {
      const seuils = seuilsAlerteHebdo(reglage(valeur, 'historique_incertain', null, false))
      expect(seuils.actif).toBe(false)
      expect(seuils.seuil).toBeNull()
      expect(seuils.seuilPropose).toBe(valeur)
    }
  })

  it('la case cochée confirme une valeur héritée — c’est l’ambiguïté que G2 décrivait', () => {
    //  G2 : « une valeur égale à un défaut ne prouve pas un choix ».
    //  La case répond à cette question : un humain l'a confirmée, seuil affiché.
    const seuils = seuilsAlerteHebdo(reglage(48, 'historique_incertain', null, true))
    expect(seuils.actif).toBe(true)
    expect(seuils.seuil).toBe(48)
    //  Ce qu'on peut affirmer au salarié…
    expect(seuils.source).toBe('entreprise')
    //  …et ce qui reste vrai pour l'audit.
    expect(seuils.origineEnregistree).toBe('historique_incertain')
  })

  it('sans valeur, aucune origine n’est affirmée', () => {
    expect(seuilsAlerteHebdo({ settings: { weekly_threshold: null }, provenance: { origine: 'entreprise' } }))
      .toMatchObject({ seuil: null, seuilMajeur: null, source: 'inconnue', actif: false })
  })

  it('sans provenance, on ne devine pas l’entreprise', () => {
    const seuils = seuilsAlerteHebdo({ settings: { weekly_threshold: 45 }, provenance: null })
    expect(seuils.source).toBe('inconnue')
    //  Une valeur sans origine connue ne déclenche pas d'alerte.
    expect(seuils.actif).toBe(false)
  })
})

describe('Aucune alerte sans seuil choisi', () => {
  it('une semaine de 50 h ne déclenche RIEN sur le seul défaut produit', () => {
    const seuils = seuilsAlerteHebdo(reglage(48, 'defaut_produit', null, false))
    const evaluation = evaluerSeuilsHebdo({ semaines: SEMAINE_50H, ...seuils })

    expect(evaluation.disponible).toBe(false)
    expect(evaluation.nb_depassees).toBe(0)
  })

  it('la même semaine déclenche dès que le seuil est un choix d’entreprise', () => {
    const seuils = seuilsAlerteHebdo(reglage(45, 'entreprise'))
    const evaluation = evaluerSeuilsHebdo({ semaines: SEMAINE_50H, ...seuils })

    expect(evaluation.disponible).toBe(true)
    expect(evaluation.nb_depassees).toBe(1)
    expect(evaluation.semaines[0].depassement_heures).toBe(5)
  })

  it('un seuil prouvé ne suffit pas : sans la case cochée, l’alerte reste muette', () => {
    const seuils = seuilsAlerteHebdo(reglage(45, 'entreprise', null, false))
    const evaluation = evaluerSeuilsHebdo({ semaines: SEMAINE_50H, ...seuils })

    expect(seuils.actif).toBe(false)
    expect(seuils.alerteActivee).toBe(false)
    expect(seuils.motif).toContain('non activée')
    expect(evaluation.disponible).toBe(false)
    expect(evaluation.nb_depassees).toBe(0)
    //  Le seuil reste connu : il sert à pré-remplir, pas à alerter.
    expect(seuils.seuilPropose).toBe(45)
  })

  it('la case cochée sans aucun seuil valide n’allume rien', () => {
    for (const valeur of [null, '', 0, -3, 'abc']) {
      const seuils = seuilsAlerteHebdo(reglage(valeur, 'entreprise', null, true))
      expect(seuils.actif).toBe(false)
      expect(seuils.seuil).toBeNull()
      expect(seuils.motif).toContain('seuil')
    }
  })

  it('une case absente n’est jamais un oui', () => {
    const sansCase = {
      settings: { weekly_threshold: 45 },
      provenance: { origine: 'entreprise' },
    }
    const seuils = seuilsAlerteHebdo(sansCase)
    expect(seuils.alerteActivee).toBe(false)
    expect(seuils.actif).toBe(false)
  })

  it('les deux conditions réunies allument l’alerte', () => {
    const seuils = seuilsAlerteHebdo(reglage(45, 'entreprise', 50, true))
    expect(seuils.actif).toBe(true)
    expect(seuils.seuil).toBe(45)
    expect(seuils.motif).toBeNull()
  })

  it('le second niveau est neutralisé avec le premier', () => {
    //  Un niveau 2 à 50 h sans niveau 1 prouvé ne doit pas devenir un seuil.
    const seuils = seuilsAlerteHebdo(reglage(48, 'defaut_produit', 50, false))
    expect(seuils.seuilMajeur).toBeNull()
  })
})

describe('Bout en bout : une alerte existe sans module de paie', () => {
  it('une semaine de 50 h dépasse un seuil de 45 h, module coupé', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(false)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(45, 'entreprise'))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')
    const seuils = seuilsAlerteHebdo(ctx.reglageHebdo)
    const evaluation = evaluerSeuilsHebdo({ semaines: SEMAINE_50H, ...seuils })

    expect(evaluation.disponible).toBe(true)
    expect(evaluation.nb_depassees).toBe(1)
    expect(evaluation.semaines[0].depassement_heures).toBe(5)
    expect(evaluation.source).toBe('entreprise')
  })

  it('le module coupé ne fabrique pas d’alerte pour qui n’a rien configuré', async () => {
    vi.spyOn(FeatureService, 'hasFeature').mockResolvedValue(false)
    vi.spyOn(FeatureService, 'getOvertimeSettingsAvecOrigine').mockResolvedValue(reglage(48, 'defaut_produit', null, false))
    vi.spyOn(FeatureService, 'loadSchedules').mockResolvedValue([])

    const ctx = await loadOvertimeContext('ent-fictive')
    const evaluation = evaluerSeuilsHebdo({ semaines: SEMAINE_50H, ...seuilsAlerteHebdo(ctx.reglageHebdo) })

    expect(evaluation.disponible).toBe(false)
    expect(evaluation.nb_depassees).toBe(0)
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
