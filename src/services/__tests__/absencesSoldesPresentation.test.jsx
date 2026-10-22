// ═══════════════════════════════════════════════════════════
// 🧾 SOLDES DE CONGÉS — PRÉSENTATION, RIEN DE TECHNIQUE
//
// Le nom de la table ne doit jamais apparaître à l'écran, et les
// employés désactivés ne doivent pas remonter dans l'aperçu.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const absencesSrc = lire('src/pages/Absences.jsx')
const serviceSrc = lire('src/services/leaveBalanceService.js')

/** Tous les écrans, hors tests et hors accès base assumés (services) */
const ecrans = () => {
  const dossiers = ['src/pages', 'src/components']
  const fichiers = []
  for (const d of dossiers) {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      if (f.endsWith('.jsx')) fichiers.push(path.join(d, f))
    }
  }
  return fichiers
}

it('1. le nom de la table ne s’affiche dans aucun écran', () => {
  for (const f of ecrans()) {
    expect(lire(f)).not.toContain('employee_leave_balances')
  }
})

it('2. l’aperçu des soldes garde un titre en français', () => {
  expect(absencesSrc).toContain('Soldes de congés')
  expect(absencesSrc).toContain('abs-soldes-liste')
  expect(absencesSrc).toContain('abs-solde-ligne')
})

it('3. les employés désactivés sont écartés de l’aperçu', () => {
  expect(absencesSrc).toContain('is_active !== false')
  // la colonne est bien ramenée par la requête, sinon le filtre ne sert à rien
  expect(serviceSrc).toContain('is_active')
})

it('4. le service, lui, interroge toujours la bonne table', () => {
  expect(serviceSrc).toContain("from('employee_leave_balances')")
})
