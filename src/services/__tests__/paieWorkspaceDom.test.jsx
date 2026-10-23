// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const state = vi.hoisted(() => ({ enterprises: [], error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select() { return this }, eq() { return this }, order: async () => ({ data: state.enterprises, error: state.error }) }) } }))
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, toggleTheme: vi.fn() }) }))
vi.mock('../../components/RaccourcisPages', () => ({ default: () => <nav>Pointages · Planning</nav> }))
vi.mock('../../components/PaieEntreprises', () => ({ default: () => <div>Copies administratives</div> }))
vi.mock('../../pages/FichesPaie', () => ({ default: function Draft({ entrepriseIdForce }) { const [value, setValue] = useState(''); return <input aria-label={`Brouillon ${entrepriseIdForce}`} value={value} onChange={e => setValue(e.target.value)}/> } }))
vi.mock('../../pages/ConfigurationFiscale', () => ({ default: () => <div>Éditeur fiscal</div> }))
import PaieFiscalite, { paieAccess } from '../../pages/PaieFiscalite'
import PaiePreparation, { resumePreparation } from '../../components/PaiePreparation'
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  state.enterprises = [{ id: 'A', name: 'Entreprise A', country_code: 'COG', currency: 'XAF', module_fiches_paie: true, module_config_fiscale: true }, { id: 'B', name: 'Entreprise B', module_fiches_paie: false, module_config_fiscale: true }]
  state.error = null
  localStorage.setItem('admin', JSON.stringify({ id: 'admin', role: 'admin', enterprise_id: 'A', entreprises: [{ id: 'A' }, { id: 'B' }] }))
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
const render = async element => { await act(async () => { root.render(element) }) }
const click = async label => { const button = [...host.querySelectorAll('button')].find(b => b.textContent === label); expect(button).toBeTruthy(); await act(async () => button.click()) }
const input = async (el, value) => { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) }) }
it('matrice des deux modules : fiscalité seule, paie seule, aucun, super-admin', () => {
  expect(paieAccess({ module_config_fiscale: true }, false)).toEqual({ fiscal: true, bulletins: false })
  expect(paieAccess({ module_fiches_paie: true }, false)).toEqual({ fiscal: false, bulletins: true })
  expect(paieAccess({}, false)).toEqual({ fiscal: false, bulletins: false })
  expect(paieAccess({}, true)).toEqual({ fiscal: true, bulletins: true })
})
it('trois sections et les deux bandeaux validés, brouillon conservé en changeant de volet', async () => {
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  expect(host.querySelectorAll('.pw-tabs button')).toHaveLength(3)
  expect(host.querySelectorAll('.pw-bogolan')).toHaveLength(2)
  const draft = host.querySelector('[aria-label="Brouillon A"]')
  await input(draft, 'En cours')
  await click('Fiscalité')
  expect(draft.closest('[hidden]')).toBeTruthy()
  await click('Bulletins')
  expect(host.querySelector('[aria-label="Brouillon A"]')).toBe(draft)
  expect(draft.value).toBe('En cours')
})
it('changement entreprise confirmé : le volet précédent est démonté et les droits sont recalculés', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  const previous = host.querySelector('[aria-label="Brouillon A"]')
  await act(async () => { const select = host.querySelector('select'); select.value = 'B'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(previous.isConnected).toBe(false)
  expect(host.querySelectorAll('.pw-tabs button')).toHaveLength(1)
  expect(host.querySelector('.pw-tabs').textContent).toBe('Fiscalité')
})
it('une erreur réseau ne devient pas un zéro salarié', async () => {
  state.error = { message: 'Connexion interrompue' }
  await render(<MemoryRouter><PaieFiscalite/></MemoryRouter>)
  expect(host.querySelector('[role="alert"]').textContent).toContain('Connexion interrompue')
  expect(host.querySelector('main')).toBeNull()
})
const employees = [{ id: '1', first_name: 'Awa', last_name: 'D.' }, { id: '2', first_name: 'Paul', last_name: 'B.' }]
const profiles = [{ employee_id: '1', salary_type: 'monthly', base_salary: 250000 }]
it('les graphiques et statuts viennent des profils et calculs, sans données fictives', async () => {
  expect(resumePreparation(employees, profiles).ready).toBe(1)
  const props = { employees, profiles, currency: 'XAF', start: '2026-10-01', end: '2026-10-31', onGenerate: vi.fn(), onHistory: vi.fn(), onNavigate: vi.fn(), onEmployee: vi.fn() }
  await render(<PaiePreparation {...props} previewRows={[]}/>)
  expect(host.textContent).toContain('Le graphique apparaîtra après le calcul')
  await click('Vérifier et calculer'); expect(props.onGenerate).toHaveBeenCalledTimes(1)
  await click(' Historique'); expect(props.onHistory).toHaveBeenCalledTimes(1)
  await input(host.querySelector('[aria-label="Rechercher un salarié"]'), 'Paul')
  expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
  await render(<PaiePreparation {...props} previewRows={[{ grossSalary: 250000, netSalary: 220000 }]}/>)
  expect(host.querySelector('[aria-label="Graphique des bulletins calculés"]').textContent).toContain('220')
  expect(host.textContent).not.toContain('Le graphique apparaîtra après le calcul')
})
it('les actions intégrées sont branchées au vrai moteur et à l’historique', () => {
  const source = readFileSync('src/pages/FichesPaie.jsx', 'utf8')
  expect(source).toContain('onGenerate={handleTryGenerate}')
  expect(source).toContain('onHistory={() => { loadHistory(); setShowHistoryModal(true) }}')
  expect(source).toContain("integre && activeTab === 'preview'")
  expect(source).toContain('settings: persistedSettings')
})
