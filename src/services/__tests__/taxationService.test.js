// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS UNITAIRES — taxationService.js (VD-15 + Audits CF-1 & CF-2)
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   Couvre le moteur fiscal multi-pays d'En-Check sur les 4 pays promis
//   (Décision D3 du Cap CEO v2.1 : Bénin, Côte d'Ivoire, Sénégal, République
//   du Congo) ainsi que les garde-fous de conformité (CF-1 / CF-2) :
//     1. Cotisations sociales salarié/employeur (avec et sans plafond)
//     2. Bénin (BEN) : barème progressif 5 tranches + test d'écart assiette
//        Brut vs Brut - CNSS 3,6 % identifié par le Gardien de la conformité
//     3. République du Congo (COG, V9) : quotient familial (CGI art. 116 A-I,
//        loi n° 42-2025) + minimum de perception 1 200 F/an
//     4. Côte d'Ivoire (CIV) : grille des parts (CGI art. 120) + réduction
//        RICF après barème (ordonnance n° 2023-718/719) sans double division
//     5. Sénégal (SEN) : abattement plafonné + réduction d'impôt encadrée +
//        plafond de taux moyen à 40 %
//     6. Filet de conformité CF-2 : impotEstAVerifier et verifierAvantRemise
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  supabaseEmployee: {
    from: vi.fn(),
  },
  default: {
    from: vi.fn(),
  },
}))

import TaxationService from '../taxationService'

describe('TaxationService — Moteur fiscal 4 pays & filet CF-2 (VD-15)', () => {
  it('1. calcule les cotisations sociales CNSS Bénin (3,6 % salarié, 6,4 % + 9 % + 2 % employeur, sans plafond)', () => {
    const contributionsBenin = [
      {
        code: 'CNSS_PENSION',
        name: 'CNSS Assurance Vieillesse',
        paid_by: 'both',
        calculation_method: 'percentage',
        calculation_base: 'gross_salary',
        rate_employee: 3.6,
        rate_employer: 6.4,
        max_base: null,
        is_mandatory: true,
      },
      {
        code: 'CNSS_PF',
        name: 'CNSS Prestations Familiales',
        paid_by: 'employer',
        calculation_method: 'percentage',
        calculation_base: 'gross_salary',
        rate_employer: 9.0,
        max_base: null,
        is_mandatory: true,
      },
      {
        code: 'CNSS_RP',
        name: 'CNSS Risques Professionnels',
        paid_by: 'employer',
        calculation_method: 'percentage',
        calculation_base: 'gross_salary',
        rate_employer: 2.0,
        max_base: null,
        is_mandatory: true,
      },
    ]

    const res = TaxationService.calculateSocialContributions(200000, contributionsBenin)
    expect(res.totalEmployee).toBe(7200) // 3,6 % de 200 000
    expect(res.totalEmployer).toBe(34800) // (6,4 % + 9 % + 2 %) = 17,4 % de 200 000
  })

  it('2. Bénin (CF-1) : calcule le barème progressif ITS et vérifie l’écart exact Brut (15 700 F) vs Brut-CNSS (14 420 F) sur 200 000 FCFA', () => {
    const baremeBenin = [
      { bracket_order: 1, min_amount: 0, max_amount: 60000, tax_rate: 0 },
      { bracket_order: 2, min_amount: 60000, max_amount: 150000, tax_rate: 10 },
      { bracket_order: 3, min_amount: 150000, max_amount: 250000, tax_rate: 15 },
      { bracket_order: 4, min_amount: 250000, max_amount: 500000, tax_rate: 19 },
      { bracket_order: 5, min_amount: 500000, max_amount: null, tax_rate: 30 },
    ]

    const contribs = {
      employee: [{ code: 'CNSS_PENSION', amount: 7200 }],
      totalEmployee: 7200,
    }

    // Cas A (CGI Bénin 2025 art. 122-125 sans déduction ni abattement)
    const rulesBrutDirect = {
      abattement_type: 'none',
      charges_deductibles: [],
      situation_famille: { type: 'aucun' },
    }
    const assietteA = TaxationService.calculateTaxableIncome(200000, contribs, rulesBrutDirect)
    expect(assietteA).toBe(200000)
    const itsA = TaxationService.calculateIncomeTax(assietteA, baremeBenin, rulesBrutDirect, 1)
    // 0-60k: 0 | 60k-150k: 9 000 | 150k-200k: 7 500 => Total = 16 500 FCFA
    expect(itsA.totalTax).toBe(16500)

    // Cas B (avec déduction CNSS 3,6 % = 7 200 F -> assiette 192 800 F)
    const rulesBrutMoinsCnss = {
      abattement_type: 'none',
      charges_deductibles: ['CNSS_PENSION'],
      situation_famille: { type: 'aucun' },
    }
    const assietteB = TaxationService.calculateTaxableIncome(200000, contribs, rulesBrutMoinsCnss)
    expect(assietteB).toBe(192800)
    const itsB = TaxationService.calculateIncomeTax(assietteB, baremeBenin, rulesBrutMoinsCnss, 1)
    // 0-60k: 0 | 60k-150k: 9 000 | 150k-192.8k: 6 420 => Total = 15 420 FCFA
    expect(itsB.totalTax).toBe(15420)
  })

  it('3. République du Congo (V9 / loi n° 42-2025) : applique le quotient familial (diviser avant barème, remultiplier après) + minimum de perception 1 200 F/an', () => {
    const rulesCongo = {
      abattement_type: 'percentage',
      abattement_percent: 20,
      charges_deductibles: ['CNSS'],
      minimum_perception_annuel: 1200, // 100 F/mois par part
      situation_famille: {
        type: 'parts',
        mode: 'base_plus_enfants',
        application: 'quotient',
        parts_base: { marie: 2, celibataire: 1, defaut: 1 },
        parts_par_enfant: 0.5,
        parts_max: 6.5,
      },
    }

    // Barème mensuel congolais par part (au-delà de la 1re tranche couverte par le minimum de perception)
    const baremeCongoMensuel = [
      { bracket_order: 1, min_amount: 0, max_amount: 51250, tax_rate: 0 },
      { bracket_order: 2, min_amount: 51250, max_amount: 125000, tax_rate: 10 },
      { bracket_order: 3, min_amount: 125000, max_amount: 291667, tax_rate: 15 },
      { bracket_order: 4, min_amount: 291667, max_amount: 416667, tax_rate: 20 },
      { bracket_order: 5, min_amount: 416667, max_amount: null, tax_rate: 30 },
    ]

    // Marié + 2 enfants = 2 + (2 * 0.5) = 3 parts
    const employeMarie2Enfants = { marital_status: 'marie', dependents_count: 2 }
    const parts = TaxationService.getFiscalParts(employeMarie2Enfants, rulesCongo)
    expect(parts).toBe(3)

    // Plafond à 6,5 parts même avec 12 enfants
    expect(TaxationService.getFiscalParts({ marital_status: 'marie', dependents_count: 12 }, rulesCongo)).toBe(6.5)

    // À revenu imposable égal (ex. 251 280 F), un parent de 3 parts paie nettement moins qu'un célibataire (1 part)
    const impot1Part = TaxationService.calculateIncomeTax(251280, baremeCongoMensuel, rulesCongo, 1)
    const impot3Parts = TaxationService.calculateIncomeTax(251280, baremeCongoMensuel, rulesCongo, 3)

    expect(impot3Parts.fiscal_parts).toBe(3)
    expect(impot3Parts.totalTax).toBeLessThan(impot1Part.totalTax)
    // Vérification mathématique pour 3 parts :
    // assiette par part = 251 280 / 3 = 83 760 F
    // Tranche 2 (51 250 -> 83 760) = 32 510 * 10 % = 3 251 F par part
    // Minimum de perception = 1 200 / 12 = 100 F par part
    // Total 1 part = 3 351 F -> * 3 parts = 10 053 F
    expect(impot3Parts.totalTax).toBe(10053)
  })

  it('4. Côte d’Ivoire (CGI art. 120 + RICF) : utilise la grille familiale et retranche la RICF APRÈS le barème (sans double division)', () => {
    const rulesCI = {
      abattement_type: 'none',
      situation_famille: {
        type: 'parts',
        mode: 'grille',
        application: 'reduction',
        grille_defaut: 'celibataire',
        parts_grille: {
          celibataire: [1, 2, 2.5, 3, 3.5, 4, 4.5, 5],
          marie: [2, 2.5, 3, 3.5, 4, 4.5, 5],
        },
        reduction_par_part: 11000,
        reduction_max: 44000,
      },
    }

    // Spécificité CI art. 120 : célibataire avec 1 enfant = 2 parts (comme marié sans enfant)
    expect(TaxationService.getFiscalParts({ marital_status: 'celibataire', dependents_count: 1 }, rulesCI)).toBe(2)
    expect(TaxationService.getFiscalParts({ marital_status: 'marie', dependents_count: 0 }, rulesCI)).toBe(2)

    const baremeCI = [
      { bracket_order: 1, min_amount: 0, max_amount: 75000, tax_rate: 0 },
      { bracket_order: 2, min_amount: 75000, max_amount: 240000, tax_rate: 16 },
      { bracket_order: 3, min_amount: 240000, max_amount: 800000, tax_rate: 21 },
    ]

    // Pour 200 000 F imposable :
    // Impôt brut (sur 1 part, SANS diviser par 2 !) = (200 000 - 75 000) * 16 % = 20 000 F
    // RICF pour 2 parts = (2 - 1) * 11 000 = 11 000 F
    // Impôt net = 20 000 - 11 000 = 9 000 F
    const resCI = TaxationService.calculateIncomeTax(200000, baremeCI, rulesCI, 2)
    expect(resCI.impots_brut).toBe(20000)
    expect(resCI.reduction_famille).toBe(11000)
    expect(resCI.totalTax).toBe(9000)
  })

  it('5. Sénégal : applique la réduction en taux encadrée (plancher/plafond annuels ÷ 12) et le plafond de taux moyen de 40 %', () => {
    const rulesSenegal = {
      abattement_type: 'percentage',
      abattement_percent: 30,
      max_abattement: 75000, // 900 000 F/an ÷ 12
      impot_max_percent_revenu: 40,
      situation_famille: {
        type: 'parts',
        mode: 'base_plus_enfants',
        application: 'reduction_taux',
        parts_base: { marie: 1.5, defaut: 1 },
        parts_par_enfant: 0.5,
        parts_max: 5,
        reduction_grille: [
          { parts: 2, taux: 15, min: 240000, max: 650000 }, // min = 20 000 F/mois
        ],
      },
    }

    const baremeTest = [
      { bracket_order: 1, min_amount: 0, max_amount: 50000, tax_rate: 0 },
      { bracket_order: 2, min_amount: 50000, max_amount: null, tax_rate: 43 },
    ]

    // Pour 200 000 F imposable : impôt brut = 150 000 * 43 % = 64 500 F
    // Réduction 15 % = 9 675 F < plancher mensuel (240 000 / 12 = 20 000 F) -> plancher appliqué = 20 000 F
    const res = TaxationService.calculateIncomeTax(200000, baremeTest, rulesSenegal, 2)
    expect(res.impots_brut).toBe(64500)
    expect(res.reduction_famille).toBe(20000)
    expect(res.reduction_plafonnee).toBe(true)
    expect(res.totalTax).toBe(44500)
  })

  it('6. Filet CF-2 : présume tout pays non vérifié par défaut et bloque la remise officielle via verifierAvantRemise()', () => {
    // Par défaut (drapeau absent), le pays est présumé NON VÉRIFIÉ
    expect(TaxationService.impotEstAVerifier({})).toBe(true)
    expect(TaxationService.impotEstAVerifier({ impot_a_verifier: true })).toBe(true)
    expect(TaxationService.impotEstAVerifier({ impot_a_verifier: false, taux_a_verifier: true })).toBe(true)
    expect(TaxationService.impotEstAVerifier({ impot_a_verifier: false })).toBe(false)

    // Un barème vide retourne impot_a_verifier: true (impôt inconnu != impôt nul)
    const sansTranche = TaxationService.calculateIncomeTax(150000, [], { impot_a_verifier: false }, 1)
    expect(sansTranche.impot_a_verifier).toBe(true)

    // verifierAvantRemise bloque tout bulletin provisoire
    expect(() => TaxationService.verifierAvantRemise({ impot_a_verifier: true })).toThrow(/Bulletin refusé/)
    expect(() => TaxationService.verifierAvantRemise({ impot_a_verifier: false })).not.toThrow()
  })
})
