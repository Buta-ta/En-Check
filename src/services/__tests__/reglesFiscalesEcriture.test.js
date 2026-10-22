// ═══════════════════════════════════════════════════════════
// 🧾 UN SEUL RÉDACTEUR POUR `custom_tax_rules`
//
// Cette colonne était écrite par trois endroits : la page
// « Règles fiscales », la page « Fiches de paie » (au milieu de 57
// colonnes) et `TaxationService.initializeEnterpriseFromCountry`.
// Les trois s'écrasaient : charger la configuration d'un pays juste
// après avoir réglé une règle à la main effaçait la règle, et
// inversement.
//
// Les tests ci-dessous tiennent les deux bouts :
//   · le module d'écriture n'écrit QUE sa colonne ;
//   · les deux appelants passent bien par lui.
// ═══════════════════════════════════════════════════════════

import { it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const etat = vi.hoisted(() => ({
  appels: [],
  existante: { id: 'ps-1' },
  panne: null,
}))

vi.mock('../../lib/db', () => ({
  db: () => ({
    from(table) {
      const chaine = {
        select: () => chaine,
        eq: (col, val) => {
          etat.appels.push({ table, type: 'eq', col, val })
          return chaine
        },
        maybeSingle: async () => {
          if (etat.panne === 'lecture') throw new Error('réseau')
          return { data: etat.existante, error: null }
        },
        update: (payload) => {
          etat.appels.push({ table, type: 'update', payload })
          return chaine
        },
        insert: (payload) => {
          etat.appels.push({ table, type: 'insert', payload })
          return chaine
        },
        then: (resolve) => {
          // le `await` d'une chaîne update/insert sans filtre
          const erreur = etat.panne === 'ecriture' ? { message: 'refusée' } : null
          return Promise.resolve({ error: erreur }).then(resolve)
        },
      }
      return chaine
    },
  }),
}))

const { ecrireReglesFiscales } = await import('../../services/reglesFiscalesEcriture')

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const ecriture = (type) => etat.appels.filter((a) => a.type === type).pop()

beforeEach(() => {
  etat.appels = []
  etat.existante = { id: 'ps-1' }
  etat.panne = null
})

// ── 1. Ce que le module écrit ────────────────────────────────────────

it('1. la fiche existe : une mise à jour, deux colonnes, pas trois', async () => {
  const ok = await ecrireReglesFiscales('ent-1', { abattement: 0.3 })
  expect(ok).toBe(true)

  const maj = ecriture('update')
  expect(maj.table).toBe('payroll_settings')
  // ni currency, ni signatures, ni congés : uniquement ce qu'on maîtrise
  expect(Object.keys(maj.payload).sort()).toEqual(['custom_tax_rules', 'updated_at'])
  expect(maj.payload.custom_tax_rules).toEqual({ abattement: 0.3 })
  expect(ecriture('insert')).toBeUndefined()
})

it('2. pas de fiche : une insertion, sans inventer les autres réglages', async () => {
  etat.existante = null
  await ecrireReglesFiscales('ent-2', { abattement: 0.1 })

  const ajout = ecriture('insert')
  expect(ajout.table).toBe('payroll_settings')
  expect(ajout.payload.enterprise_id).toBe('ent-2')
  expect(Object.keys(ajout.payload).sort()).toEqual([
    'created_at',
    'custom_tax_rules',
    'enterprise_id',
    'updated_at',
  ])
  // surtout pas de devise : elle n'a qu'une maison, l'entreprise
  expect(ajout.payload.currency).toBeUndefined()
})

it('3. des règles vides restent un objet vide, jamais `undefined`', async () => {
  await ecrireReglesFiscales('ent-3', null)
  expect(ecriture('update').payload.custom_tax_rules).toEqual({})

  etat.appels = []
  await ecrireReglesFiscales('ent-3', undefined)
  expect(ecriture('update').payload.custom_tax_rules).toEqual({})
})

it('4. sans entreprise, on n’écrit rien du tout', async () => {
  const ok = await ecrireReglesFiscales(null, { a: 1 })
  expect(ok).toBe(false)
  expect(etat.appels).toEqual([])
})

it('5. une panne d’écriture remonte, elle n’est pas avalée', async () => {
  // les appelants doivent pouvoir remettre l'état d'avant
  etat.panne = 'ecriture'
  await expect(ecrireReglesFiscales('ent-4', { a: 1 })).rejects.toThrow()
})

// ── 2. Ce que les appelants font ─────────────────────────────────────

it('6. les deux services passent par le même module', () => {
  const paye = lire('src/services/payrollService.js')
  const fiscal = lire('src/services/taxationService.js')

  expect(paye).toContain("from './reglesFiscalesEcriture'")
  expect(fiscal).toContain("from './reglesFiscalesEcriture'")
  expect(paye).toContain('return await ecrireReglesFiscales(enterpriseId, rules)')
  expect(fiscal).toContain('await ecrireReglesFiscales(enterpriseId, rulesPayload)')
})

it('7. plus personne n’écrit `custom_tax_rules` à la main', () => {
  // Toute écriture de cette colonne hors du module dédié est un
  // rédacteur de trop : c'est exactement le défaut qu'on a corrigé.
  const sources = [
    'src/services/payrollService.js',
    'src/services/taxationService.js',
    'src/pages/ConfigurationFiscale.jsx',
    'src/pages/FichesPaie.jsx',
    'src/services/paieFiscale.js',
  ]
  for (const chemin of sources) {
    const source = lire(chemin)
    // on tolère les commentaires qui parlent de la colonne
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(sansCommentaires, chemin).not.toMatch(/custom_tax_rules:\s*(rules|rulesPayload)/)
  }
})

it('8. le chargement d’un pays ne touche plus `payroll_settings` du tout', () => {
  const fiscal = lire('src/services/taxationService.js')
  // L'entreprise porte la devise, et c'est elle qu'on met à jour.
  // La recopier dans payroll_settings en faisait une seconde maison ;
  // les règles, elles, passent par le rédacteur unique.
  // une seule lecture subsiste (les règles custom) ; aucune écriture
  expect(fiscal.match(/from\('payroll_settings'\)/g) || []).toHaveLength(1)
  expect(fiscal).toMatch(/from\('enterprises'\)[\s\S]{0,120}currency: countryConfig\.currency/)
})
