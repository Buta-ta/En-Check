// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS UNITAIRES — payrollService.js (VD-15 + Correctif CF-2)
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   Vérifie la construction complète d'un bulletin de paie (`buildPayrollSlip`) :
//     1. Cohérence mathématique Brut / Gains / Retenues / Net / Coût employeur
//     2. Retenues d'absences et de retards issues d'En-Check
//     3. Propagation obligatoire de `impot_a_verifier` et `avertissement` à la
//        racine du bulletin pour que `TaxationService.verifierAvantRemise()`
//        bloque l'impression/remise des bulletins non validés (CF-2)
//     4. Sécurité du bloc `catch` : si le moteur fiscal échoue, le bulletin de
//        secours est obligatoirement marqué `impot_a_verifier: true`
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest'

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

import PayrollService from '../payrollService'
import TaxationService from '../taxationService'

describe('PayrollService — Cohérence du bulletin & filet de conformité CF-2 (VD-15)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const employee = {
    id: 'emp-bj-01',
    enterprise_id: 'ent-bj-01',
    matricule: 'BJ001',
    first_name: 'Koffi',
    last_name: 'Mensah',
    department: 'Opérations Terrain',
    position: 'Chef de poste',
    marital_status: 'marie',
    dependents_count: 2,
  }

  const profile = {
    salary_type: 'monthly',
    base_salary: 200000,
    transport_allowance: 25000,
    housing_allowance: 15000,
    fixed_bonus: 10000,
    fixed_deduction: 5000,
    payment_method: 'mobile_money',
    mobile_money_provider: 'MTN',
  }

  const settings = {
    include_overtime: true,
    deduct_absence: true,
    deduct_late: true,
    working_days_divisor: 22,
    hourly_divisor: 173.33,
  }

  it('1. calcule un bulletin complet cohérent et propage impot_a_verifier à la racine (CF-2)', async () => {
    // Brut attendu = 200 000 + 25 000 + 15 000 + 10 000 = 250 000 FCFA
    vi.spyOn(TaxationService, 'calculateDetailedPayslip').mockResolvedValue({
      grossSalary: 250000,
      taxableIncome: 250000,
      netSalary: 215500,
      contributions: {
        employee: [{ code: 'CNSS_PENSION', name: 'CNSS Salarié (3,6%)', amount: 9000, base: 250000, rate: 3.6, is_mandatory: true }],
        employer: [{ code: 'CNSS_EMPLOYEUR', name: 'CNSS Employeur', amount: 43500, base: 250000, rate: 17.4, is_mandatory: true }],
        totalEmployee: 9000,
        totalEmployer: 43500,
      },
      tax: {
        totalTax: 25500,
        effectiveRate: 10.2,
        details: [],
        impot_a_verifier: true,
      },
      fiscal_parts: 1,
      parts_non_renseignees: false,
      impot_a_verifier: true,
      avertissement: '⚠️ Les règles d’impôt du pays « Bénin » n’ont pas été vérifiées avec un bulletin réel.',
      config: { countryCode: 'BEN', currency: 'XOF' },
    })

    const slip = await PayrollService.buildPayrollSlip({
      employee,
      profile,
      settings,
      enCheckData: { absencesDays: 0, retardsMinutes: 0, overtime25Hours: 0, overtime50Hours: 0, overtime100Hours: 0 },
      importedData: null,
      periodBonuses: [{ id: 'b1', name: 'Prime de chantier', amount: 20000 }],
      recurringDeductions: [],
      periodDeductions: [],
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    })

    // Brut = 250 000 (profil) + 20 000 (prime de période) = 270 000 FCFA
    expect(slip.grossSalary).toBe(270000)
    expect(slip.totalEarnings).toBe(270000)

    // Retenues = 5 000 (retenue fixe) + 9 000 (CNSS) + 25 500 (ITS) = 39 500 FCFA
    expect(slip.totalDeductions).toBe(39500)
    expect(slip.netSalary).toBe(270000 - 39500)
    expect(slip.employerCost).toBe(270000 + 43500)

    // CF-2 : le drapeau et l'avertissement sont présents à la racine du bulletin
    expect(slip.impot_a_verifier).toBe(true)
    expect(slip.avertissement).toContain('Bénin')
    expect(() => TaxationService.verifierAvantRemise(slip)).toThrow(/Bulletin refusé/)
  })

  it('2. marque obligatoirement le bulletin de secours comme impot_a_verifier: true si le calcul fiscal échoue', async () => {
    vi.spyOn(TaxationService, 'calculateDetailedPayslip').mockRejectedValue(
      new Error('Pays fiscal non défini pour l’entreprise')
    )

    const fallbackSlip = await PayrollService.buildPayrollSlip({
      employee,
      profile,
      settings,
      enCheckData: {},
      importedData: null,
      periodBonuses: [],
      recurringDeductions: [],
      periodDeductions: [],
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    })

    expect(fallbackSlip.error).toBe('Calcul fiscal incomplet')
    expect(fallbackSlip.impot_a_verifier).toBe(true)
    expect(fallbackSlip.avertissement).toContain('Calcul fiscal incomplet')
    // Toute tentative de remise officielle d'un bulletin dégradé est bloquée
    expect(() => TaxationService.verifierAvantRemise(fallbackSlip)).toThrow(/Bulletin refusé/)
  })
})
