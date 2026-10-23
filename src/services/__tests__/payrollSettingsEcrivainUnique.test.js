// ═══════════════════════════════════════════════════════════
// 🧾 PAYROLL_SETTINGS — UN SEUL RÉDACTEUR PAR COLONNE
//
// Trois endroits écrivaient `payroll_settings` : la page « Fiches
// de paie » (57 colonnes d'un coup, depuis un état parfois périmé),
// la page « Configuration fiscale » (3 colonnes) et TaxationService.
// Sur la colonne `custom_tax_rules`, les trois se marchaient dessus :
// les 4 entreprises de production ont toutes des règles non vides,
// donc l'écrasement n'est pas un risque théorique.
//
// Désormais : `custom_tax_rules` s'écrit par
// `PayrollService.saveCustomTaxRules`, et nulle part ailleurs.
// ═══════════════════════════════════════════════════════════

import { it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const etat = vi.hoisted(() => ({
  appels: [],
  ligneExistante: { id: 'ps-1' },
}))

vi.mock('../../lib/db', () => ({
  db: () => ({
    rpc: async (name, payload) => { etat.appels.push({ type: "rpc", name, payload }); return { data: true, error: null } },
    from(table) {
      const chaine = {
        select: () => chaine,
        eq: (col, val) => {
          etat.appels.push({ table, type: 'eq', col, val })
          return chaine
        },
        single: async () => ({ data: etat.ligneExistante, error: null }),
        maybeSingle: async () => ({ data: etat.ligneExistante, error: null }),
        update: (payload) => {
          etat.appels.push({ table, type: 'update', payload })
          return chaine
        },
        insert: (payload) => {
          etat.appels.push({ table, type: 'insert', payload })
          return chaine
        },
      }
      return chaine
    },
  }),
}))

const PayrollService = (await import('../../services/payrollService')).default

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const service = lire('src/services/payrollService.js')
const fiscale = lire('src/pages/ConfigurationFiscale.jsx')

const ecriture = (type) => etat.appels.filter((a) => a.type === type).pop()

beforeEach(() => {
  etat.appels = []
  etat.ligneExistante = { id: 'ps-1' }
})

// ── 1. Le rédacteur unique ───────────────────────────────────────────

it('le service transmet les règles et leur snapshot sans toucher aux autres colonnes', async () => {
  expect(await PayrollService.saveCustomTaxRules('ent-1', { a: 1 }, { a: 0 })).toBe(true)
  expect(ecriture('rpc')).toEqual({ type: 'rpc', name: 'paie_enregistrer_regles', payload: { p_enterprise_id: 'ent-1', p_rules: { a: 1 }, p_expected_rules: { a: 0 } } })
  expect(ecriture('update')).toBeUndefined()
})

// ── 2. La sauvegarde générale ne touche plus à la colonne fiscale ────

it('3. sauver les paramètres de paie N’ÉCRASE PLUS les règles fiscales', async () => {
  await PayrollService.savePayrollSettings('ent-1', {
    ...PayrollService.getDefaultPayrollSettings(),
    custom_tax_rules: { abattement: 0.72, plafond: 100000 },
    annual_leave_cap: 30,
  })

  const maj = ecriture('update')
  expect(maj.payload).not.toHaveProperty('custom_tax_rules')
  // les autres réglages, eux, continuent de s'écrire
  expect(maj.payload.annual_leave_cap).toBe(30)
  expect(maj.payload.working_days_divisor).toBe(22)
})

it('4. le service explique pourquoi la colonne est absente du payload', () => {
  const debut = service.indexOf('static async savePayrollSettings')
  const fin = service.indexOf('static async saveCustomTaxRules')
  const corps = service.slice(debut, fin)
  expect(corps).not.toMatch(/^\s*custom_tax_rules:/m)
  expect(corps).toContain('custom_tax_rules')
})

// ── 3. La page fiscale passe par le service ──────────────────────────

// ── 4. La devise n'a qu'une seule maison ─────────────────────────────

it('5. la devise saisie sur les fiches de paie est écrite sur l’entreprise', () => {
  const fiches = lire('src/pages/FichesPaie.jsx')
  // elle était écrite dans payroll_settings… mais lue sur enterprises :
  // le réglage était ignoré en silence.
  expect(fiches).toContain('changerDevise')
  expect(fiches).toContain("from('enterprises')")
  expect(fiches).toMatch(/update\(\{ currency: devise \}\)\s*\n?\s*\.eq\('id', enterpriseId\)/)
  expect(fiches).toContain("onChange={e => changerDevise(e.target.value)}")
})

it('6. la page fiscale ne branche plus Supabase elle-même pour cette colonne', () => {
  expect(fiscale).toContain('PayrollService.saveCustomTaxRules')
  expect(fiscale).not.toContain('custom_tax_rules: rules')
  expect(fiscale).not.toMatch(/update\(\{\s*enterprise_id/)
})
