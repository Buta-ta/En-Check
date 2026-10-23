// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
const mock = vi.hoisted(() => ({ pages: [], calls: [], dark: false }))
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ darkMode: mock.dark }) }))
vi.mock('../../lib/supabase', () => ({ supabase: { from(table) {
  const call = { table }; mock.calls.push(call)
  return { select() { return this }, eq(key, value) { call[key] = value; return this }, gte() { return this }, lt() { return this }, or() { return this }, order() { return this }, range(a, b) { call.range = [a, b]; return this }, abortSignal() { return Promise.resolve(mock.pages.shift() || { data: [], error: null }) } }
} } }))
import { FieldHelp } from '../../components/PaieFiscalChamps'
import PaiePayrollChart, { payrollMonths, aggregatePayroll } from '../../components/PaiePayrollChart'
let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mock.pages = []; mock.calls = []; mock.dark = false; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = async element => { await act(async () => root.render(element)) }
const slip = overrides => ({ id: '1', period_start: '2026-10-01', gross_salary: '100000', employer_contributions: '15000', currency: 'XOF', ...overrides })
it('les six mois traversent une année sans dépendre du fuseau local', () => {
  expect(payrollMonths('2026-02-28').map(m => m.key)).toEqual(['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'])
  expect(payrollMonths('')).toEqual([])
})
it('additionne les montants numériques, sépare devises et bulletins retirés', () => {
  const rows = aggregatePayroll([slip({}), slip({ id: '2', gross_salary: '50000', employer_contributions: '5000' }), slip({ currency: 'XAF' }), slip({ is_deleted: true })], payrollMonths('2026-10-31'), 'XOF')
  expect(rows.at(-1)).toMatchObject({ gross: 150000, cost: 170000, count: 2 }); expect(rows[0].count).toBe(0)
})
it('ne masque pas un montant incomplet par un zéro', () => {
  expect(() => aggregatePayroll([slip({ gross_salary: null })], payrollMonths('2026-10-31'), 'XOF')).toThrow()
  expect(() => aggregatePayroll([slip({ employer_contributions: 'invalide' })], payrollMonths('2026-10-31'), 'XOF')).toThrow()
})
it('un vrai zéro conserve son bulletin', () => {
  expect(aggregatePayroll([slip({ gross_salary: 0, employer_contributions: 0 })], payrollMonths('2026-10-31'), 'XOF').at(-1)).toMatchObject({ gross: 0, count: 1 })
})
it('aide lisible au clic et fermable à Échap en clair et sombre', async () => {
  for (const dark of [false,true]) {
    mock.dark = dark
    await render(<FieldHelp key={String(dark)} text="Le revenu avant déductions" example="250 000 XAF"/>)
    const button = host.querySelector('button'); expect(button.getAttribute('aria-expanded')).toBe('false')
    await act(async () => button.click()); expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('.pw-field-explanation').textContent).toContain('250 000 XAF')
    expect(host.querySelector('.pw-field-help').dataset.theme).toBe(dark ? 'dark' : 'light')
    await act(async () => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(host.querySelector('.pw-field-explanation')).toBeNull()
  }
})
it('pagine et filtre explicitement l’entreprise et la devise', async () => {
  mock.pages = [{ data: Array.from({ length: 500 }, (_, i) => slip({ id: String(i) })) }, { data: [slip({ id: 'last' })] }]
  await render(<PaiePayrollChart enterpriseId="entreprise-a" currency="XOF" end="2026-10-31"/>)
  expect(mock.calls).toHaveLength(2); expect(mock.calls[0]).toMatchObject({ enterprise_id: 'entreprise-a', currency: 'XOF', range: [0,499] }); expect(mock.calls[1].range).toEqual([500,999])
  expect(host.textContent).toContain('501 bulletins')
})
it('une erreur réseau donne une erreur et un bouton de reprise, pas une masse nulle', async () => {
  mock.pages = [{ data: null, error: { message: 'indisponible' } }]
  await render(<PaiePayrollChart enterpriseId="a" currency="XOF" end="2026-10-31"/>)
  expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.querySelector('.pw-payroll-total')).toBeNull()
  await act(async () => host.querySelector('button').click()); expect(host.textContent).toContain('Aucun bulletin enregistré')
})
it('ne lance pas de requête sans entreprise ou sans devise', async () => {
  await render(<PaiePayrollChart enterpriseId="" currency="" end="2026-10-31"/>); expect(mock.calls).toHaveLength(0)
})
