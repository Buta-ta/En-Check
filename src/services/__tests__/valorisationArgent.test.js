// src/services/__tests__/valorisationArgent.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 💰 L'ARGENT — testé de bout en bout (constat A0 de l'audit)
//
// POURQUOI CE FICHIER
//   `calculateValorization` transforme des heures en montants. C'est la seule
//   fonction du moteur qui touche à l'argent… et c'était la seule qui n'avait
//   AUCUN test. Toutes les corrections de calcul du monde ne valent rien si
//   l'étape qui écrit le montant n'est jamais vérifiée.
//
// CE QUE CES TESTS PROUVENT
//   · 8 h de férié à 1 500 FCFA/h valent 24 000, pas 12 000 ;
//   · deux taux d'heures sup le même mois ne se moyennent pas ;
//   · sans taux horaire, le moteur ne rend pas 0 : il rend `null` — on ne
//     fabrique pas un montant à partir de rien ;
//   · une panne de la base ne produit pas un bulletin à zéro.
//
// Le taux horaire vient de `employee_payroll_profiles` : on simule la base.
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from 'vitest'
import { __internal } from '../hoursCalculator'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
  supabaseEmployee: { from },
  default: { from },
}))

const { calculateValorization } = __internal

/** Simule `employee_payroll_profiles` pour un taux horaire donné. */
function profil(tauxHoraire) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({
      data: tauxHoraire === null ? null : { hourly_rate: tauxHoraire },
      error: null,
    }),
  }
  return builder
}

const TAUX_AWA = 1500

/** Résumé mensuel tel que le produit le moteur (secondes brutes). */
const moisComplet = {
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

afterEach(() => {
  from.mockReset()
})

describe('Valorisation : le montant écrit sur le bulletin', () => {
  it('A0 — 40 h normales + 4 h à 25 % + 8 h de férié = 91 500 FCFA', async () => {
    from.mockReturnValue(profil(TAUX_AWA))

    const v = await calculateValorization('emp-1', 'ent-1', moisComplet, 'XOF')

    expect(v.normal.amount).toBe(60_000) // 40 × 1 500
    expect(v.overtime_normal.amount).toBe(7_500) // 4 × 1 500 × 1,25
    expect(v.overtime_ferie.amount).toBe(24_000) // 8 × 1 500 × 2
    expect(v.total_gross).toBe(91_500)
    expect(v.currency).toBe('XOF')
  })

  it('le férié a sa propre ligne, avec son taux affichable', async () => {
    from.mockReturnValue(profil(TAUX_AWA))

    const v = await calculateValorization('emp-1', 'ent-1', moisComplet, 'XOF')

    expect(v.overtime_ferie.hours).toBe('8h00')
    expect(v.overtime_ferie.ratePercent).toBe(100)
    expect(v.overtime_ferie.rate).toBe(3000) // 1 500 × 2
    expect(v.overtime_ferie.lignes).toHaveLength(1)
  })

  it('un pays à +150 % paie le férié 30 000, pas 24 000', async () => {
    from.mockReturnValue(profil(TAUX_AWA))

    const v = await calculateValorization('emp-1', 'ent-1', {
      normal: '0h00',
      overtime_seconds: {
        normal: 0,
        major: 0,
        ferie: 8 * 3600,
        normal_par_taux: {},
        major_par_taux: {},
        ferie_par_taux: { 150: 8 * 3600 },
      },
    }, 'XOF')

    expect(v.overtime_ferie.amount).toBe(30_000) // 8 × 1 500 × 2,5
    expect(v.total_gross).toBe(30_000)
  })

  it('deux taux d’heures sup le même mois : deux lignes, aucun mélange', async () => {
    from.mockReturnValue(profil(TAUX_AWA))

    const v = await calculateValorization('emp-1', 'ent-1', {
      normal: '0h00',
      overtime_seconds: {
        normal: 7200,
        major: 0,
        ferie: 0,
        normal_par_taux: { 25: 3600, 60: 3600 },
        major_par_taux: {},
        ferie_par_taux: {},
      },
    }, 'XOF')

    expect(v.overtime_normal.lignes).toHaveLength(2)
    expect(v.overtime_normal.amount).toBe(4275) // 1 875 + 2 400
    expect(v.overtime_normal.ratePercent).toBeNull() // pas de taux unique : on n'en invente pas
    expect(v.total_gross).toBe(4275)
  })

  it('la somme des lignes égale TOUJOURS le total brut (invariant de cohérence)', async () => {
    from.mockReturnValue(profil(TAUX_AWA))

    const v = await calculateValorization('emp-1', 'ent-1', {
      ...moisComplet,
      overtime_seconds: {
        normal: 4 * 3600,
        major: 2 * 3600,
        ferie: 8 * 3600,
        normal_par_taux: { 25: 4 * 3600 },
        major_par_taux: { 50: 3600, 100: 3600 },
        ferie_par_taux: { 100: 8 * 3600 },
      },
    }, 'XOF')

    const lignes = [
      v.overtime_normal.amount,
      v.overtime_major.amount,
      v.overtime_ferie.amount,
    ].reduce((a, b) => a + b, 0)

    expect(v.total_gross).toBe(v.normal.amount + lignes)
  })

  it('sans taux horaire enregistré, aucun montant n’est inventé (null, pas 0)', async () => {
    from.mockReturnValue(profil(null))

    expect(await calculateValorization('emp-1', 'ent-1', moisComplet, 'XOF')).toBeNull()
  })

  it('un taux horaire nul ou négatif est refusé', async () => {
    from.mockReturnValue(profil(0))
    expect(await calculateValorization('emp-1', 'ent-1', moisComplet, 'XOF')).toBeNull()

    from.mockReturnValue(profil(-100))
    expect(await calculateValorization('emp-1', 'ent-1', moisComplet, 'XOF')).toBeNull()
  })

  it('une panne de la base ne produit pas un bulletin à zéro', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => { throw new Error('database unavailable') },
    }
    from.mockReturnValue(builder)

    expect(await calculateValorization('emp-1', 'ent-1', moisComplet, 'XOF')).toBeNull()
  })

  it('les secondes ne sont pas arrondies avant le calcul', async () => {
    //  3 599 s = 0,9997 h. Un arrondi d'affichage à « 1h00 » gonflerait la paie.
    from.mockReturnValue(profil(TAUX_AWA))

    const v = await calculateValorization('emp-1', 'ent-1', {
      normal: '0h00',
      overtime_seconds: {
        normal: 3599,
        major: 0,
        ferie: 0,
        normal_par_taux: { 0: 3599 },
        major_par_taux: {},
        ferie_par_taux: {},
      },
    }, 'XOF')

    expect(v.overtime_normal.amount).toBe(1500) // 3 599 s × 1 500 / 3 600 = 1 499,58 → 1 500
    expect(v.total_gross).toBe(1500)
  })

  it('A3 — les heures normales ne sont plus relues depuis « 39h59 »', async () => {
    from.mockReturnValue(profil(TAUX_AWA))

    //  39 h 59 min 30 s. L'affichage dit « 39h59 » (39,9833 h) ; la valeur
    //  réelle est 39,9917 h. À 1 500 FCFA/h, l'écart est de 12,5 FCFA.
    const v = await calculateValorization('emp-1', 'ent-1', {
      normal: '39h59',
      normal_seconds: 39 * 3600 + 59 * 60 + 30,
      overtime_seconds: { normal: 0, major: 0, ferie: 0, normal_par_taux: {}, major_par_taux: {}, ferie_par_taux: {} },
    }, 'XOF')

    expect(v.normal.amount).toBe(59_988) // 39,9917 × 1 500 = 59 987,5 → 59 988
    //  La relecture du texte donnait 59 975 : 13 FCFA perdus en silence.
  })

  it('F3 — parseDurationToHours lit « 8h », « 8h30 » et refuse le vide', () => {
    const { parseDurationToHours } = __internal
    expect(parseDurationToHours('8h30')).toBe(8.5)
    expect(parseDurationToHours('0h00')).toBe(0)
    expect(parseDurationToHours('8h')).toBe(8) // valait 0 : zéro silencieux
    expect(parseDurationToHours(null)).toBe(0)
    expect(parseDurationToHours('')).toBe(0)
    expect(parseDurationToHours('n’importe quoi')).toBe(0)
  })

  it('la devise de l’entreprise est conservée (TND, CHF, EUR…)', async () => {
    from.mockReturnValue(profil(12.5))

    const v = await calculateValorization('emp-1', 'ent-1', moisComplet, 'TND')
    expect(v.currency).toBe('TND')
  })
})
