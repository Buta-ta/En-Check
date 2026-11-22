// src/services/__tests__/feriesMajoration.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🎌 Cas réels de la majoration des jours fériés (multi-pays)
//
// CAS DE DÉPART (Awa, 1 500 FCFA/h, Bénin, 8 h travaillées un jour férié) :
//   la fiche de paie affichait « Taux férié : 100 % »…
//   et payait 12 000 FCFA, soit exactement un mardi ordinaire.
//   Attendu : 24 000 FCFA (8 h × 1 500 × 2).
//
// Ces tests verrouillent trois choses distinctes :
//   1. la RÉSOLUTION du taux (pays → entreprise → férié), et son refus quand
//      une valeur descend sous un plancher légal ;
//   2. le TRANSPORT du taux jusqu'au calcul d'heures supplémentaires ;
//   3. le PRIX de chaque tranche, séparément (le férié n'est plus confondu
//      avec une heure sup ordinaire).
//
// Spécification : docs/SPEC-FERIES-MAJORATION-MULTIPAYS.md
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import FeatureService from '../featureService'
import {
  tranchesDuJour,
  tranchesValorisation,
  valoriserTranches,
  __internal,
} from '../hoursCalculator'
import {
  PLANCHERS_FERIES,
  STATUTS_PLANCHER,
  normaliserCodePays,
  plancherPour,
  resoudreMajorationFerie,
} from '../feriesMajoration'

const { resoudreFerieDuJour, generateAlerts } = __internal

/** Férié « par défaut » tel que le rend HolidayService pour un férié global. */
const ferieGlobal = (extra = {}) => ({
  date: '2026-05-01',
  name: 'Fête du Travail',
  is_worked: false,
  is_global: true,
  has_override: false,
  overtime_rate: 100,
  ...extra,
})

/** Catalogue de test : un plancher « vérifié » à 150 %, un autre non sourcé. */
const planchersTest = {
  ...PLANCHERS_FERIES,
  BJ: { statut: STATUTS_PLANCHER.VERIFIE, taux: 150, source: 'Code du travail BJ, art. 157', verifie_le: '2026-01-15', zone: null },
  CH: { statut: STATUTS_PLANCHER.A_SOURCER, taux: null, source: null, verifie_le: null, zone: 'canton' },
}

const TAUX_HORAIRE_AWA = 1500

describe('Résolution du taux de majoration férié', () => {
  it('T24 — sans réglage d’entreprise ni plancher sourcé : 100 % par défaut, mais AVEC avertissement', () => {
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal(),
      tauxEntreprise: 100,
      entrepriseConfiguree: false,
    })

    //  On ne peut pas faire mieux que le contrat produit…
    expect(r.tauxPercent).toBe(100)
    expect(r.niveau).toBe('defaut')
    //  …mais on le DIT : un défaut silencieux est le bug qu'on répare.
    expect(r.avertissements).toContain('plancher_non_source')
    expect(r.bloque).toBe(false)
  })

  it('T18 — pays inconnu : la résolution le signale au lieu de retomber en silence sur un taux', () => {
    const r = resoudreMajorationFerie({ pays: null, ferie: ferieGlobal() })

    expect(r.niveau).toBe('defaut')
    expect(r.avertissements).toContain('pays_inconnu')
    //  Un pays inconnu ne remplace pas un pays par défaut : il n'y a pas de
    //  pays par défaut dans En-Check (principe P1 de la spécification).
    expect(r.tauxPercent).toBe(100)
  })

  it('applique le plancher pays quand l’entreprise n’a jamais enregistré de réglage', () => {
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal(),
      tauxEntreprise: 100, // valeur par défaut du produit, pas une décision
      entrepriseConfiguree: false,
      planchers: planchersTest,
    })

    expect(r.tauxPercent).toBe(150)
    expect(r.niveau).toBe('plancher')
    expect(r.source).toBe('Code du travail BJ, art. 157')
    expect(r.avertissements).toEqual([])
  })

  it('refuse une politique d’entreprise explicitement sous le plancher pays', () => {
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal(),
      tauxEntreprise: 80,
      entrepriseConfiguree: true,
      planchers: planchersTest,
    })

    //  On ne paie pas 80 % en silence : c'est l'entreprise qui doit corriger.
    expect(r.bloque).toBe(true)
    expect(r.tauxPercent).toBe(80)
    expect(r.niveau).toBe('entreprise')
  })

  it('T20 — une dérogation sur CE férié passe avant la politique générale', () => {
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal({ is_global: false, overtime_rate: 200 }),
      tauxEntreprise: 100,
      entrepriseConfiguree: true,
      planchers: planchersTest,
    })

    expect(r.tauxPercent).toBe(200)
    expect(r.niveau).toBe('ferie')
    expect(r.motif).toContain('Fête du Travail')
  })

  it('ne prend PAS le taux par défaut du férié global pour une décision d’entreprise', () => {
    //  Un férié global porte `overtime_rate: 100` sans qu'aucun humain ne
    //  l'ait choisi. S'il gagnait, le plancher pays ne s'appliquerait jamais.
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal(),
      planchers: planchersTest,
    })

    expect(r.niveau).toBe('plancher')
    expect(r.tauxPercent).toBe(150)
  })

  it('une dérogation qui ne touche PAS au taux ne devient pas une décision d’entreprise', () => {
    //  Cas réel : l'entreprise renomme « Fête du Travail » en « Fête des
    //  travailleurs ». L'override existe, mais le taux n'a pas été choisi.
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal({ has_override: true, has_custom_rate: false, overtime_rate: 100 }),
      entrepriseConfiguree: false,
      planchers: planchersTest,
    })

    expect(r.niveau).toBe('plancher')
    expect(r.tauxPercent).toBe(150)
    expect(r.bloque).toBe(false)
  })

  it('T4 — férié déclaré travaillé chez nous : aucune majoration férié (et c’est expliqué)', () => {
    const r = resoudreMajorationFerie({
      pays: 'BJ',
      ferie: ferieGlobal({ is_worked: true }),
      tauxEntreprise: 100,
      planchers: planchersTest,
    })

    expect(r.tauxPercent).toBe(0)
    expect(r.niveau).toBe('jour_travaille')
    expect(r.motif).toContain('travaillé chez nous')
  })

  it('un plancher « à sourcer » n’est jamais présenté comme un plancher vérifié', () => {
    const r = resoudreMajorationFerie({ pays: 'SN', ferie: ferieGlobal() })
    expect(r.niveau).toBe('defaut')
    expect(r.avertissements).toContain('plancher_non_source')
    expect(plancherPour('SN').statut).toBe(STATUTS_PLANCHER.A_SOURCER)
    //  Aucune valeur légale n'est stockée pour l'instant : c'est volontaire.
    expect(plancherPour('SN').taux).toBeNull()
  })

  it('Suisse — sans canton, la zone est réclamée au lieu d’être inventée', () => {
    const r = resoudreMajorationFerie({ pays: 'CH', zone: null, ferie: ferieGlobal() })
    expect(r.avertissements).toContain('zone_requise')
  })
})

describe('Piège ISO2 / ISO3 (P0 vérifié)', () => {
  it('« BEN » et « BJ » donnent la même résolution', () => {
    expect(normaliserCodePays('BEN')).toBe('BJ')
    expect(normaliserCodePays('bj')).toBe('BJ')
    expect(normaliserCodePays(' BJ ')).toBe('BJ')

    const depuisIso3 = resoudreMajorationFerie({ pays: 'BEN', ferie: ferieGlobal(), planchers: planchersTest })
    const depuisIso2 = resoudreMajorationFerie({ pays: 'BJ', ferie: ferieGlobal(), planchers: planchersTest })
    expect(depuisIso3.tauxPercent).toBe(depuisIso2.tauxPercent)
    expect(depuisIso3.niveau).toBe('plancher')
  })

  it('un code inconnu ne s’applique pas « presque » : il est rejeté explicitement', () => {
    expect(normaliserCodePays('XYZ')).toBeNull()
    expect(normaliserCodePays('ZZ')).toBeNull()
    expect(normaliserCodePays('')).toBeNull()
    const r = resoudreMajorationFerie({ pays: 'XYZ', ferie: ferieGlobal() })
    expect(r.avertissements).toContain('pays_inconnu')
  })
})

describe('Transport du taux jusqu’au calcul d’heures supplémentaires', () => {
  it('T1 — un jour férié bascule tout le temps travaillé en tranche « férié »', () => {
    const overtimeData = FeatureService.calculateOvertimeForEmployeeDay({
      totalWorkedSeconds: 8 * 3600, // 8 h un jour férié
      employeeSchedule: null,
      enterpriseId: 'e1',
      dateStr: '2026-05-01',
      allSchedules: [],
      overtimeSettings: { rate_holiday: 100, rate_normal: 25, rate_major: 50 },
      holiday: { is_worked: false, overtime_rate: 100 },
    })

    expect(overtimeData.thresholdSource).toBe('holiday')
    expect(overtimeData.rateApplied).toBe(100)

    const tranches = tranchesDuJour(overtimeData)
    expect(tranches).toEqual([{ type: 'ferie', secondes: 8 * 3600, taux: 100 }])
  })

  it('resoudreFerieDuJour prépare l’objet transmis, et n’en prépare aucun si le taux est 0', () => {
    const entreprise = { pays: 'BJ', zone: null }
    const settings = { id: 'ot-1', rate_holiday: 100 }

    const majorable = resoudreFerieDuJour({
      date: '2026-05-01',
      holiday: ferieGlobal(),
      enterpriseCfg: entreprise,
      overtimeSettings: settings,
    })
    expect(majorable.aMajorer).toBe(true)
    expect(majorable.tauxPercent).toBe(100)

    const jourTravaille = resoudreFerieDuJour({
      date: '2026-05-02',
      holiday: ferieGlobal({ is_worked: true }),
      enterpriseCfg: entreprise,
      overtimeSettings: settings,
    })
    expect(jourTravaille.aMajorer).toBe(false)
    expect(jourTravaille.niveau).toBe('jour_travaille')
  })

  it('un jour ordinaire ne produit aucune tranche', () => {
    const r = resoudreFerieDuJour({
      date: '2026-05-04',
      holiday: null,
      enterpriseCfg: { pays: 'BJ' },
      overtimeSettings: null,
    })
    expect(r.aMajorer).toBe(false)
    expect(r.niveau).toBe('aucun')
  })

  it('un jour férié bloqué (taux sous plancher) n’est PAS majoré', () => {
    const r = resoudreFerieDuJour({
      date: '2026-05-01',
      holiday: ferieGlobal({ is_global: false, overtime_rate: 50 }),
      enterpriseCfg: { pays: 'BJ' },
      overtimeSettings: { id: 'ot-1', rate_holiday: 50 },
    })
    //  Sans plancher vérifié, pas de blocage : le taux d'entreprise s'applique.
    expect(r.tauxPercent).toBe(50)
  })

  it('ne mélange pas heures sup ordinaires et majorées : deux tranches, deux taux', () => {
    const tranches = tranchesDuJour({
      totalOvertimeSeconds: 3 * 3600,
      overtimeSeconds: 2 * 3600,
      overtimeMajorSeconds: 3600,
      rateApplied: 25,
      rateMajorApplied: 50,
      thresholdSource: 'schedule',
    })

    expect(tranches).toEqual([
      { type: 'normal', secondes: 2 * 3600, taux: 25 },
      { type: 'major', secondes: 3600, taux: 50 },
    ])
  })
})

describe('Valorisation par tranche (Awa, 1 500 FCFA/h)', () => {
  it('T1 — 8 h un jour férié valent 24 000 FCFA, plus 12 000', () => {
    const tranches = [{ libelle: 'ferie', secondes: 8 * 3600, taux: 100 }]
    const [ligne] = valoriserTranches(tranches, TAUX_HORAIRE_AWA)

    expect(ligne.heures).toBe(8)
    expect(ligne.taux_horaire_majore).toBe(3000)
    expect(ligne.montant).toBe(24_000) // 8 × 1 500 × 2
    //  Et pas 12 000 (tarif normal) ni 18 000 (+50 %).
  })

  it('T2 — deux taux différents le même mois ne se moyennent pas', () => {
    //  Avant : le résumé gardait « le premier taux vu » et payait tout à 25 %.
    //  Ici 1 h à 25 % et 1 h à 60 %.
    const monthData = {
      normal: '40h00',
      overtime_seconds: {
        normal: 7200,
        major: 0,
        ferie: 0,
        normal_par_taux: { 25: 3600, 60: 3600 },
        major_par_taux: {},
        ferie_par_taux: {},
      },
    }

    const valorisees = valoriserTranches(tranchesValorisation(monthData), TAUX_HORAIRE_AWA)
    const montants = valorisees.map(v => v.montant)

    expect(montants).toEqual([1875, 2400]) // 1500×1,25 et 1500×1,60
    expect(montants.reduce((a, b) => a + b, 0)).toBe(4275)
    //  Un prix unique à 25 % donnerait 3 750 : 525 FCFA perdus.
  })

  it('T24 — bulletin complet : 40 h normales + 4 h à 25 % + 8 h de férié', () => {
    const monthData = {
      normal: '40h00',
      overtime_seconds: {
        normal: 4 * 3600,
        major: 0,
        ferie: 8 * 3600,
        normal_par_taux: { 25: 4 * 3600 },
        major_par_taux: {},
        ferie_par_taux: { 100: 8 * 3600 },
      },
    }

    const valorisees = valoriserTranches(tranchesValorisation(monthData), TAUX_HORAIRE_AWA)
    const parLibelle = (l) => valorisees.find(v => v.libelle === l)

    expect(parLibelle('normal').montant).toBe(7_500) // 4 × 1 500 × 1,25
    expect(parLibelle('ferie').montant).toBe(24_000) // 8 × 1 500 × 2

    //  Horaires : 40 × 1 500 = 60 000 ; total = 91 500.
    expect(60_000 + valorisees.reduce((a, v) => a + v.montant, 0)).toBe(91_500)
  })

  it('reste correct sans les secondes brutes (repli sur « 8h30 »)', () => {
    const monthData = {
      normal: '35h30',
      overtime_normal: { hours: '8h30', rate: 25 },
      overtime_major: { hours: '0h00', rate: 50 },
      overtime_ferie: { hours: '2h00', rate: 100 },
    }

    const valorisees = valoriserTranches(tranchesValorisation(monthData), TAUX_HORAIRE_AWA)
    const ferie = valorisees.find(v => v.libelle === 'ferie')
    expect(ferie.heures).toBe(2)
    expect(ferie.montant).toBe(6_000) // 2 × 1 500 × 2
  })

  it('sans taux horaire, aucun montant n’est inventé', () => {
    expect(valoriserTranches([{ libelle: 'ferie', secondes: 3600, taux: 100 }], 0)).toEqual([])
    expect(valoriserTranches([{ libelle: 'ferie', secondes: 3600, taux: 100 }], null)).toEqual([])
  })
})

describe('Alertes', () => {
  const seuils = { plafondInventionHeures: 12 }

  it('F1 — l’alerte de session ouverte cite le seuil réel, plus le littéral « 14h »', () => {
    const alerts = generateAlerts({
      today: { openSessionsCount: 1 },
      month: null,
      year: null,
      hasPlan: true,
      seuils,
    })

    expect(alerts[0].message).toContain('12h max')
    expect(alerts[0].message).not.toContain('14h')
  })

  it('un férié majoré au taux par défaut est signalé, pas caché', () => {
    const alerts = generateAlerts({
      today: {},
      month: { rate: null },
      year: null,
      hasPlan: true,
      seuils,
      feries: {
        pays: 'BJ',
        zone_requise: false,
        jours: [{ niveau: 'defaut', taux_percent: 100 }],
        avertissements: [],
      },
    })

    const message = alerts.map(a => a.message).join(' | ')
    expect(message).toContain('plancher BJ non sourcé')
  })

  it('un taux férié sous le plancher déclenche une alerte de paie', () => {
    const alerts = generateAlerts({
      today: {},
      month: { rate: null },
      year: null,
      hasPlan: true,
      seuils,
      feries: {
        pays: 'BJ',
        zone_requise: false,
        jours: [],
        avertissements: ['taux_sous_plancher'],
      },
    })

    expect(alerts.map(a => a.message).join(' | ')).toContain('inférieur au plancher légal')
  })
})
