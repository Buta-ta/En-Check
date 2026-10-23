// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const mock = vi.hoisted(() => ({ upsert: vi.fn(), from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: (...args) => { mock.from(...args); return { upsert: mock.upsert } } } }))
import { publishPayrollBatch, PayrollDeliveryBlocked } from '../payrollDelivery'
import TaxationService from '../taxationService'
import PaieDeliveryControl from '../../components/PaieDeliveryControl'
const row = (id, patch = {}) => ({ employee: { id }, grossSalary: 100000, netSalary: 90000, impot_a_verifier: false, profile: { salary_type: 'monthly', base_salary: 100000 }, ...patch })
const payload = row => ({ enterprise_id: 'a', employee_id: row.employee.id, period_start: '2026-10-01', period_end: '2026-10-31', currency: 'XOF', status: 'sent' })
let host, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mock.from.mockClear(); mock.upsert.mockReset().mockResolvedValue({ error: null }); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
it('respecte le vrai contrat void du garde fiscal et envoie un bulletin vérifié', async () => {
  expect(TaxationService.verifierAvantRemise(row('e'))).toBeUndefined()
  await expect(publishPayrollBatch([row('e')], payload)).resolves.toEqual(['e'])
  expect(mock.upsert).toHaveBeenCalledWith([payload(row('e'))], { onConflict: 'enterprise_id,employee_id,period_start,period_end' })
})
it('intercepte le refus fiscal dans une erreur métier explicite, avant toute écriture', async () => {
  await expect(publishPayrollBatch([row('e', { impot_a_verifier: true })], payload)).rejects.toThrow(PayrollDeliveryBlocked)
  expect(mock.upsert).not.toHaveBeenCalled()
})
it('un seul bulletin non vérifié bloque tout le lot, manuel ou automatique', async () => {
  for (const automatic of [false, true]) {
    await expect(publishPayrollBatch([row('e'), row('f', { impot_a_verifier: true })], payload, { automatic })).rejects.toThrow('Aucun envoi de ce lot')
  }
  expect(mock.from).not.toHaveBeenCalled()
})
it('préserve aussi un drapeau fiscal imbriqué', async () => {
  await expect(publishPayrollBatch([row('e', { taxation: { impot_a_verifier: true } })], payload)).rejects.toThrow(PayrollDeliveryBlocked)
  expect(mock.upsert).not.toHaveBeenCalled()
})
it('valide toutes les fiches avant un unique upsert groupé', async () => {
  await expect(publishPayrollBatch([row('e'), row('f')], payload, { automatic: true })).resolves.toEqual(['e','f'])
  expect(mock.upsert).toHaveBeenCalledOnce(); expect(mock.upsert.mock.calls[0][0]).toHaveLength(2)
})
it('refuse devise absente, montant inconnu, identité absente et doublons', async () => {
  await expect(publishPayrollBatch([row('e')], r => ({ ...payload(r), currency: null }))).rejects.toThrow(PayrollDeliveryBlocked)
  await expect(publishPayrollBatch([row('e', { netSalary: null })], payload)).rejects.toThrow(PayrollDeliveryBlocked)
  await expect(publishPayrollBatch([row('')], payload)).rejects.toThrow(PayrollDeliveryBlocked)
  await expect(publishPayrollBatch([row('e'), row('e')], payload)).rejects.toThrow(PayrollDeliveryBlocked)
  expect(mock.upsert).not.toHaveBeenCalled()
})
it('bloque l’auto-envoi des profils invalides même après « générer quand même »', async () => {
  await expect(publishPayrollBatch([row('e', { profile: { salary_type: 'hourly', hourly_rate: 0 } })], payload, { automatic: true })).rejects.toThrow('base salariale valide')
  expect(mock.upsert).not.toHaveBeenCalled()
})
it('contexte périmé et lot vide : aucune requête', async () => {
  await expect(publishPayrollBatch([row('e')], payload, { isCurrent: () => false })).rejects.toThrow('contexte')
  await expect(publishPayrollBatch([], payload)).rejects.toThrow('Aucune fiche')
  await expect(publishPayrollBatch([row('e', { periodStart: '2026-09-01' })], payload)).rejects.toThrow('période du bulletin')
  expect(mock.upsert).not.toHaveBeenCalled()
})
it('remonte les erreurs réseau/RLS et permet de réessayer sans conserver de faux succès', async () => {
  mock.upsert.mockResolvedValueOnce({ error: new Error('RLS') })
  await expect(publishPayrollBatch([row('e')], payload)).rejects.toThrow('RLS')
  await expect(publishPayrollBatch([row('e')], payload)).resolves.toEqual(['e'])
})
it('le switch expose son état, son effet et le blocage dans un message accessible', async () => {
  const change = vi.fn()
  await act(async () => root.render(<PaieDeliveryControl enabled={false} onChange={change} busy={false} notice={{ error: true, text: 'Envoi bloqué' }}/>))
  const control = host.querySelector('[role="switch"]'); expect(control.checked).toBe(false)
  await act(async () => control.click()); expect(change).toHaveBeenCalledWith(true)
  expect(host.querySelector('[role="alert"]').textContent).toBe('Envoi bloqué')
  await act(async () => root.render(<PaieDeliveryControl enabled onChange={change} busy/>))
  expect(host.querySelector('input').disabled).toBe(true); expect(host.textContent).toContain('met aussi à jour')
})
it('câblage : désactivé par défaut, périmètre limité, snapshots et verrouillage des formulaires', () => {
  const source = readFileSync('src/pages/FichesPaie.jsx', 'utf8')
  expect(source).toContain('const [autoSendAfterCalculation, setAutoSendAfterCalculation] = useState(false)')
  expect(source).toContain('setAutoSendAfterCalculation(false); setDeliveryNotice(null) }, [enterpriseId, periodStart, periodEnd]')
  expect(source).toContain('await deliverRows(rows, { automatic: true, request, payrollSettings: persistedSettings')
  expect(source).toContain('if (calculationLock.current || deliveryLock.current) return')
  expect(source).toContain('<fieldset disabled={loadingPreview || sendingSlips}')
  expect(source).not.toContain('.remissable')
})
