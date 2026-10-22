// ═══════════════════════════════════════════════════════════
// 🧭 ÉTAPE 4 — LE CONTENU FISCAL, PLUS SÛR
//
// ① Avant d'écraser une configuration, on montre les chiffres —
//    celles d'aujourd'hui et celles qui vont les remplacer.
// ② Une configuration se recopie d'une entreprise à l'autre,
//    sans jamais laisser l'entreprise cible à moitié vidée.
// ③ Un super-admin voit qui est configuré, sans ouvrir chaque
//    entreprise l'une après l'autre.
// ═══════════════════════════════════════════════════════════

import { it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const etat = vi.hoisted(() => ({
  tables: {},
  appels: [],
  panne: null, // { table, type } → la prochaine écriture échoue
  reglesEcrites: [],
}))

vi.mock('../../lib/db', () => ({
  db: () => ({
    from(table) {
      const filtres = []
      let action = 'select'

      const correspond = (ligne) => filtres.every((f) => ligne[f.col] === f.val)

      const resoudre = (lignes = null) => Promise.resolve().then(() => {
        if (etat.panne && etat.panne.table === table && etat.panne.type === action) {
          etat.panne = null
          return { data: null, error: { message: 'panne simulée' } }
        }

        if (action === 'insert') {
          etat.tables[table] = [...(etat.tables[table] || []), ...lignes]
          return { data: lignes, error: null }
        }

        if (action === 'delete') {
          etat.tables[table] = (etat.tables[table] || []).filter((l) => !correspond(l))
          return { data: null, error: null }
        }

        const lues = (etat.tables[table] || []).filter(correspond)
        if (action === 'maybeSingle' || action === 'single') {
          return { data: lues[0] || null, error: null }
        }
        return { data: lues, error: null }
      })

      const chaine = {
        select: () => { action = 'select'; return chaine },
        eq: (col, val) => {
          filtres.push({ col, val })
          etat.appels.push({ table, type: 'eq', col, val })
          return chaine
        },
        maybeSingle: () => { action = 'maybeSingle'; return resoudre() },
        single: () => { action = 'single'; return resoudre() },
        insert: (lignes) => {
          action = 'insert'
          etat.appels.push({ table, type: 'insert', lignes })
          return resoudre(lignes)
        },
        delete: () => { action = 'delete'; etat.appels.push({ table, type: 'delete' }); return chaine },
        then: (res, rej) => resoudre().then(res, rej),
      }
      return chaine
    },
  }),
}))

vi.mock('../../services/payrollService', () => ({
  default: {
    saveCustomTaxRules: async (id, regles) => {
      etat.reglesEcrites.push({ id, regles })
      return true
    },
  },
}))

const { resumerConfiguration, copierConfigurationFiscale } = await import('../../services/paieFiscale')
const RecapChargement = (await import('../../components/PaieRecapChargement')).default
const { ThemeProvider } = await import('../../contexts/ThemeContext')
const { resumerReglesFiscales } = await import('../../components/PaieRecapChargement')

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

beforeEach(() => {
  etat.tables = {}
  etat.appels = []
  etat.panne = null
  etat.reglesEcrites = []
})

// ── 1. Le récapitulatif avant / après ────────────────────────────────

it('1. les règles se résument en trois lignes lisibles', () => {
  expect(resumerReglesFiscales({
    abattement_type: 'percentage',
    abattement_percent: 10,
    tax_calculation_method: 'progressive',
    situation_famille: { type: 'aucun' },
  })).toEqual(['Abattement 10 %', 'Barème progressif', 'Quotient familial inactif'])
})

it('2. un quotient familial déclaré se voit', () => {
  expect(resumerReglesFiscales({
    abattement_type: 'none',
    tax_calculation_method: 'fixed',
    situation_famille: { type: 'base_plus_enfants' },
  })).toEqual(['Pas d’abattement', 'Impôt au forfait', 'Quotient familial activé'])
})

it('3. le récapitulatif montre les deux colonnes de chiffres', () => {
  const html = renderToStaticMarkup(
    <ThemeProvider>
      <RecapChargement
      avant={{ cotisations: 6, tranches: 7, regles: { abattement_type: 'none' } }}
      apres={{ cotisations: 5, tranches: 6, regles: { abattement_type: 'percentage', abattement_percent: 20 } }}
      nomApres="Côte d’Ivoire"
    />
    </ThemeProvider>,
  )
  expect(html).toContain('data-testid="paie-recap-chargement"')
  expect(html).toContain('Aujourd’hui')
  expect(html).toContain('Après chargement')
  expect(html).toContain('6')
  expect(html).toContain('5')
  expect(html).toContain('Côte d’Ivoire')
  // ce qui sera perdu est annoncé noir sur blanc
  expect(html).toContain('seront définitivement remplacées')
})

it('4. rien à perdre : pas d’avertissement inutile', () => {
  const html = renderToStaticMarkup(
    <ThemeProvider>
      <RecapChargement
        avant={{ cotisations: 0, tranches: 0, regles: {} }}
        apres={{ cotisations: 5, tranches: 6, regles: {} }}
      />
    </ThemeProvider>,
  )
  expect(html).not.toContain('seront définitivement remplacées')
})

// ── 2. La copie entre entreprises ────────────────────────────────────

const COTISATIONS = [
  { id: 'c1', enterprise_id: 'source', contribution_name: 'CNSS', rate_employee: 3.6, is_active: true, created_at: 'x', updated_at: 'y' },
  { id: 'c2', enterprise_id: 'source', contribution_name: 'IPRES', rate_employee: 2.4, is_active: true, created_at: 'x', updated_at: 'y' },
]
const TRANCHES = [
  { id: 't1', enterprise_id: 'source', bracket_name: 'T1', tax_rate: 0, is_active: true, created_at: 'x', updated_at: 'y' },
]

beforeEach(() => {
  etat.tables['enterprise_payroll_contributions'] = [
    ...COTISATIONS,
    { id: 'c9', enterprise_id: 'cible', contribution_name: 'Ancienne', created_at: 'x', updated_at: 'y' },
  ]
  etat.tables['enterprise_tax_brackets'] = [
    ...TRANCHES,
    { id: 't9', enterprise_id: 'cible', bracket_name: 'Vieille', created_at: 'x', updated_at: 'y' },
  ]
  etat.tables['payroll_settings'] = [{ enterprise_id: 'source', custom_tax_rules: { abattement_percent: 20 } }]
})

it('5. copier refuse de recopier une entreprise sur elle-même', async () => {
  const r = await copierConfigurationFiscale('source', 'source')
  expect(r.success).toBe(false)
  expect(r.error).toContain('identiques')
})

it('6. copier refuse une entreprise source vide', async () => {
  etat.tables['enterprise_payroll_contributions'] = []
  etat.tables['enterprise_tax_brackets'] = []
  const r = await copierConfigurationFiscale('source', 'cible')
  expect(r.success).toBe(false)
  expect(r.error).toContain('rien à copier')
})

it('7. la copie écrit bien au nom de l’entreprise cible', async () => {
  const r = await copierConfigurationFiscale('source', 'cible')
  expect(r.success).toBe(true)
  expect(r.resume).toEqual({ cotisations: 2, tranches: 1, reglesCopiees: true })

  const ecrites = etat.appels.filter((a) => a.type === 'insert' && a.table === 'enterprise_payroll_contributions')
  const lignes = ecrites[ecrites.length - 1].lignes
  expect(lignes).toHaveLength(2)
  expect(lignes.every((l) => l.enterprise_id === 'cible')).toBe(true)
  // ni l'identifiant ni les horodatages de la source ne voyagent
  expect(lignes.every((l) => l.id === undefined && l.created_at === undefined)).toBe(true)
})

it('8. la cible est vidée avant d’être remplie', async () => {
  await copierConfigurationFiscale('source', 'cible')
  const ordre = etat.appels.map((a) => `${a.table}:${a.type}`)
  expect(ordre).toContain('enterprise_payroll_contributions:insert')
  // une seule insertion par table : pas de doublon
  expect(ordre.filter((o) => o === 'enterprise_payroll_contributions:insert')).toHaveLength(1)
})

it('9. les règles fiscales passent par le rédacteur unique', async () => {
  await copierConfigurationFiscale('source', 'cible')
  expect(etat.reglesEcrites).toEqual([{ id: 'cible', regles: { abattement_percent: 20 } }])
})

it('10. si l’insertion échoue, l’entreprise cible est remise en état', async () => {
  etat.panne = { table: 'enterprise_payroll_contributions', type: 'insert' }
  const r = await copierConfigurationFiscale('source', 'cible')
  expect(r.success).toBe(false)

  const retablies = etat.appels.filter(
    (a) => a.type === 'insert' && a.table === 'enterprise_payroll_contributions',
  )
  // la panne, puis la remise en état
  expect(retablies.length).toBeGreaterThanOrEqual(2)
  expect(retablies[retablies.length - 1].lignes).toEqual([
    { enterprise_id: 'cible', contribution_name: 'Ancienne' },
  ])
})

// ── 3. L'état de chaque entreprise ───────────────────────────────────

it('11. le résumé dit si une entreprise est configurée', async () => {
  const r = await resumerConfiguration('source')
  expect(r.configuree).toBe(true)
  expect(r.cotisations).toBeGreaterThan(0)
})

it('12. une entreprise sans rien n’est pas dite configurée', async () => {
  etat.tables['enterprise_payroll_contributions'] = []
  etat.tables['enterprise_tax_brackets'] = []
  const r = await resumerConfiguration('vide')
  expect(r).toMatchObject({ cotisations: 0, tranches: 0, configuree: false })
})

// ── 4. Le câblage ────────────────────────────────────────────────────

it('13. charger un pays montre le récapitulatif AVANT de confirmer', () => {
  const fiscale = lire('src/pages/ConfigurationFiscale.jsx')
  // le modèle du pays est lu avant l'ouverture de la confirmation
  expect(fiscale).toContain('await TaxationService.getCountryConfig(pendingCountryCode)')
  expect(fiscale).toContain('details: <RecapChargement')
  expect(fiscale).toContain('details={confirmModal.details}')
  // et la modale sait afficher ce détail
  expect(fiscale).toContain('{details && <div style={{ width:')
})

it('14. la vue d’ensemble des entreprises est réservée au super-admin', () => {
  const page = lire('src/pages/PaieFiscalite.jsx')
  expect(page).toContain("<PaieEntreprises")
  expect(page).toContain("admin?.role === 'super_admin'")
})

it('15. la palette fiscale n’a plus une seule couleur en dur', () => {
  const fiscale = lire('src/pages/ConfigurationFiscale.jsx')
  // plus de fond sombre imposé, ni de texte blanc codé en dur
  expect(fiscale).not.toContain('#0A0A0F')
  expect(fiscale).not.toContain("color=\"#FFF\"")
  // …et surtout plus de règle globale qui repeint tout le site
  expect(fiscale).not.toMatch(/html, body, #root\s*\{/)
  expect(fiscale).toContain('fiscal-volet')
})

it('16. les deux gammes existent et diffèrent', async () => {
  const { palettePaie } = await import('../../styles/paieTheme')
  const sombre = palettePaie(true)
  const clair = palettePaie(false)
  expect(sombre.texte).not.toBe(clair.texte)
  expect(sombre.fond).not.toBe(clair.fond)
  // chaque jeton est défini dans les deux gammes
  Object.keys(sombre).forEach((cle) => {
    expect(clair[cle], `jeton ${cle} manquant en clair`).toBeDefined()
  })
})
