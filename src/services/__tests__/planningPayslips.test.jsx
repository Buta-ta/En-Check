// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const mock = vi.hoisted(() => ({ pages: [], calls: [] }))
vi.mock('../../lib/supabase', () => ({ supabase: { from(table) {
  const call = { table }; mock.calls.push(call)
  return { select(fields) { call.fields = fields; return this }, eq(k,v) { call[k] = v; return this }, not() { return this }, or() { return this }, lte(k,v) { call.lte = [k,v]; return this }, gte(k,v) { call.gte = [k,v]; return this }, order() { return this }, range(a,b) { call.range = [a,b]; return this }, abortSignal(signal) { call.signal = signal; return Promise.resolve(mock.pages.shift() || { data: [] }) } }
} } }))
import usePlanningPayslips, { indexPublishedPayslips, payslipsForDay } from '../../hooks/usePlanningPayslips'
import PlanningPayslipBadge from '../../components/PlanningPayslipBadge'
import useEmployeePayslipIndicators from '../../hooks/useEmployeePayslipIndicators'
import RaccourcisPages from '../../components/RaccourcisPages'
const employee = { id: 'e', enterprise_id: 'a', first_name: 'Awa', last_name: 'Test' }
const slip = changes => ({ id: 's', enterprise_id: 'a', employee_id: 'e', period_start: '2026-10-01', period_end: '2026-10-31', sent_at: '2026-11-01T12:00:00Z', status: 'sent', is_deleted: false, ...changes })
let host, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mock.calls = []; mock.pages = []; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
const render = async element => { await act(async () => root.render(element)) }
function Probe({ people = [employee], dates = ['2026-10-19','2026-10-25'] }) {
  const { index, error, loading, refresh } = usePlanningPayslips(people, dates)
  return <div><span>{loading ? 'loading' : error || [...index.values()].flat().length}</span><button onClick={refresh}>Actualiser</button></div>
}
it('seuls les envois effectifs, non retirés, du salarié et de son entreprise sont indexés', () => {
  const rows = [slip({}), slip({ id: 'draft', status: 'draft' }), slip({ id: 'empty', sent_at: null }), slip({ id: 'removed', is_deleted: true }), slip({ id: 'other', enterprise_id: 'b' }), slip({ id: 'wrong', employee_id: 'x' }), slip({ id: 'invalid', period_end: '2026-09-01' })]
  expect([...indexPublishedPayslips(rows, [employee]).values()].flat()).toEqual([rows[0]])
})
it('la période inclut ses deux bornes, même un jour sans planning, pas la date d’envoi hors période', () => {
  const index = indexPublishedPayslips([slip({})], [employee])
  for (const day of ['2026-10-01','2026-10-04','2026-10-31']) expect(payslipsForDay(index, employee, day)).toHaveLength(1)
  for (const day of ['2026-09-30','2026-11-01']) expect(payslipsForDay(index, employee, day)).toHaveLength(0)
})
it('dédoublonne un envoi sans perdre deux périodes qui se chevauchent', () => {
  const index = indexPublishedPayslips([slip({}), slip({}), slip({ id:'s2',period_end:'2026-10-15' })], [employee])
  expect(payslipsForDay(index, employee, '2026-10-10')).toHaveLength(2)
})
it('requêtes paginées avec filtre entreprise, période chevauchante et sans montants', async () => {
  mock.pages = [{ data: Array.from({length:500},(_,i)=>slip({id:String(i)})) }, { data:[slip({id:'last'})] }]
  await render(<Probe/>); expect(host.textContent).toContain('501'); expect(mock.calls).toHaveLength(2)
  expect(mock.calls[0]).toMatchObject({ enterprise_id:'a', status:'sent', lte:['period_start','2026-10-25'], gte:['period_end','2026-10-19'], range:[0,499] })
  expect(mock.calls[1].range).toEqual([500,999]); expect(mock.calls[0].fields).not.toMatch(/salary|amount|net|gross/)
})
it('affiche une erreur explicite et permet une reprise', async () => {
  mock.pages = [{ error:{ message:'denied' } }]; await render(<Probe/>); expect(host.textContent).toContain('indisponible')
  mock.pages = [{ data:[slip({})] }]; await act(async()=>host.querySelector('button').click()); expect(host.textContent).toBe('1Actualiser')
})
it('un retrait est reflété après actualisation au retour dans la fenêtre', async () => {
  mock.pages = [{data:[slip({})]}]; await render(<Probe/>); expect(host.textContent).toBe('1Actualiser')
  await act(async()=>window.dispatchEvent(new Event('focus'))); expect(host.textContent).toBe('0Actualiser')
})
it('ignore une réponse tardive après changement d’entreprise et annule son signal', async () => {
  let resolve; mock.pages = [new Promise(r=>{resolve=r})]; await render(<Probe/>); const signal = mock.calls[0].signal
  await render(<Probe people={[{...employee,enterprise_id:'b'}]}/>); expect(signal.aborted).toBe(true)
  await act(async()=>resolve({data:[slip({})]})); expect(host.textContent).toBe('0Actualiser')
})
it('ne lance aucune lecture sans employés ou sans dates', async () => {
  await render(<Probe people={[]}/>); await render(<Probe dates={[]}/>); expect(mock.calls).toHaveLength(0)
})
it('le badge ne se montre pas pour un calcul seul et explique publication versus paiement', async () => {
  await render(<PlanningPayslipBadge entries={[]}/>); expect(host.textContent).toBe('')
  await render(<PlanningPayslipBadge entries={[{employee,slips:[slip({})]}]}/>); expect(host.querySelector('summary').getAttribute('aria-label')).toBe('Fiche de paie envoyée')
  expect(host.textContent).toContain('01/10/2026'); expect(host.textContent).toContain('ni le paiement'); expect(host.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
})
it('retire le raccourci de la coque paie, mais garde Planning et les autres pages', async () => {
  await render(<MemoryRouter initialEntries={['/paie']}><RaccourcisPages excludePaths={['/paie']}/></MemoryRouter>)
  expect(host.querySelector('a[href^="/paie"]')).toBeNull(); expect(host.querySelector('a[href="/planning"]')).not.toBeNull(); expect(host.querySelectorAll('a')).toHaveLength(5)
})
it('câblage : accueil paie depuis Planning et billet dans les trois vues', () => {
  const source=readFileSync('src/pages/Planning.jsx','utf8')
  expect(source).toContain('path: "/paie"'); expect(source).not.toContain('path: "/paie?onglet=fiches"')
  expect(source.match(/<PlanningPayslipBadge entries=/g)).toHaveLength(3)
  expect(readFileSync('src/pages/PaieFiscalite.jsx','utf8')).toContain("excludePaths={['/paie']}")
  expect(readFileSync('src/components/PlanningPayslipBadge.css','utf8')).toContain('prefers-reduced-motion:reduce')
})

function EmployeeIndicatorsProbe({ date }) {
  const people = [employee, { ...employee, id: 'other' }]
  const status = useEmployeePayslipIndicators(people, date)
  return <div>{people.map(person => <section key={person.id} data-employee={person.id}><PlanningPayslipBadge entries={status.entriesFor(person)} referenceDate={status.date}/></section>)}</div>
}
it('Pointages/Employés : un seul chargement pour plusieurs salariés, billet seulement pour le destinataire', async () => {
  mock.pages = [{ data: [slip({})] }]
  await render(<EmployeeIndicatorsProbe date="2026-10-23"/> )
  expect(mock.calls).toHaveLength(1)
  expect(host.querySelector('[data-employee="e"] summary')).not.toBeNull()
  expect(host.querySelector('[data-employee="other"] summary')).toBeNull()
  expect(host.textContent).toContain('Situation au 23/10/2026')
  expect(host.querySelector('details').open).toBe(false)
})
it('changer le jour consulté retire le billet hors période sans garder une ancienne fiche', async () => {
  mock.pages = [{ data: [slip({})] }]
  await render(<EmployeeIndicatorsProbe date="2026-10-23"/> )
  mock.pages = [{ data: [slip({})] }]
  await render(<EmployeeIndicatorsProbe date="2026-11-01"/> )
  expect(host.querySelector('summary')).toBeNull()
  expect(mock.calls.at(-1).lte).toEqual(['period_start', '2026-11-01'])
})
it('ouvrir le billet au clic ou au clavier ne déclenche pas la carte parente', async () => {
  const click = vi.fn(), key = vi.fn()
  await render(<div onClick={click} onKeyDown={key}><PlanningPayslipBadge entries={[{employee, slips:[slip({})]}]}/></div>)
  await act(async () => { host.querySelector('summary').click(); host.querySelector('summary').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })) })
  expect(click).not.toHaveBeenCalled(); expect(key).not.toHaveBeenCalled()
})
it('les billets sont câblés aux vues passeport/groupée/liste et aux deux vues Employés', () => {
  const pointages = readFileSync('src/pages/Pointages.jsx','utf8')
  expect(pointages).toContain('useEmployeePayslipIndicators(payslipEmployees, selectedDate)')
  expect(pointages).toContain('payslipEntries: payslipIndicators.entriesFor(p.employee)')
  expect(pointages).toContain('<PlanningPayslipBadge entries={p.payslipEntries || []}')
  expect(readFileSync('src/components/PointagesAfroTechSections.jsx','utf8')).toContain('<PlanningPayslipBadge entries={p.payslipEntries || []}')
  const employes = readFileSync('src/pages/Employes.jsx','utf8')
  expect(employes).toContain('useEmployeePayslipIndicators(employes)')
  expect(employes).toContain('payslipEntries={payslipIndicators.entriesFor(employee)}')
  expect(employes).toContain('payslipDate={payslipIndicators.date}')
  // l'annuaire porte le billet dans chaque entrée de registre
  expect(readFileSync('src/components/equipes/EntreeEmploye.jsx','utf8')).toContain('<PlanningPayslipBadge entries={payslipEntries} referenceDate={payslipDate}')
})
