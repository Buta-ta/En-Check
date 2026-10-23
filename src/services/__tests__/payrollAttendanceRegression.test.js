import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: {}, supabaseEmployee: {} }))
vi.mock('../../lib/db', () => ({ db: () => ({ from: () => ({ select() { return this }, eq() { return this }, maybeSingle: mocks.maybeSingle }) }) }))
import PayrollService from '../payrollService'
import FeatureService from '../featureService'
import LeaveBalanceService from '../leaveBalanceService'

const pair = (date = '2026-10-20', extra = {}) => [
  { id: 'in', employee_id: 'E', check_type: 'in', check_time: `${date}T08:00:00Z` },
  { id: 'out', employee_id: 'E', check_type: 'out', check_time: `${date}T16:00:00Z`, ...extra },
]
describe('régression filter is not a function dans la génération de paie', () => {
  it('calcule une journée réelle sans traiter un pointage comme un tableau', () => {
    const rows = pair()
    const before = structuredClone(rows)
    expect(PayrollService.calculateWorkedMinutesByDay('E', rows)).toEqual({ '2026-10-20': 480 })
    expect(rows).toEqual(before)
  })
  it('isole les salariés et accepte une liste vide', () => {
    expect(PayrollService.calculateWorkedMinutesByDay('autre', pair())).toEqual({})
    expect(PayrollService.calculateWorkedMinutesByDay('E', [])).toEqual({})
    expect(PayrollService.calculateWorkedMinutesByDay('E', null)).toEqual({})
  })
  it('exclut la sortie estimée non validée et le rebond neutralisé', () => {
    expect(PayrollService.calculateWorkedMinutesByDay('E', pair(undefined, { is_auto_closed: true }))['2026-10-20']).toBe(0)
    expect(PayrollService.calculateWorkedMinutesByDay('E', pair(undefined, { anomalie: 'rebond_qr' }))['2026-10-20']).toBe(0)
  })
  it('conserve la validation humaine et la borne de non-rétroactivité', () => {
    expect(PayrollService.calculateWorkedMinutesByDay('E', pair(undefined, { is_auto_closed: true, estimation_validee_le: '2026-10-21T10:00:00Z' }))['2026-10-20']).toBe(480)
    expect(PayrollService.calculateWorkedMinutesByDay('E', pair('2026-10-15', { is_auto_closed: true }))['2026-10-15']).toBe(480)
    expect(PayrollService.calculateWorkedMinutesByDay('E', pair(undefined, { is_auto_closed: true, estimation_validee_le: '2026-10-21', estimation_remplacee_le: '2026-10-22' }))['2026-10-20']).toBe(0)
  })
  it('le chemin appelé pendant la génération fournit les minutes attendues', () => {
    const result = PayrollService.getEmployeeEnCheckData({ id: 'E', enterprise_id: 'ENT' }, pair(), [], FeatureService.getDefaultOvertimeSettings(), [], new Set(), new Map(), '2026-10-01', '2026-10-31')
    expect(result.totalWorkedMinutes).toBe(480)
    expect(result.workedDays).toBe(1)
  })
  it('le même mauvais appel ne subsiste pas dans les rapports', () => {
    expect(readFileSync('src/pages/Rapports.jsx', 'utf8')).not.toContain('.filter(filtrerPointagesPayables)')
  })
})
describe('lectures de configuration facultative : absence ≠ erreur 406', () => {
  beforeEach(() => { mocks.maybeSingle.mockReset() })
  it('absence de paramètres : lecture facultative et valeurs par défaut', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await PayrollService.getPayrollSettings('ENT')).toEqual(PayrollService.getDefaultPayrollSettings())
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1)
  })
  it('une erreur de lecture réelle ne devient pas une paie avec paramètres inventés', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501', message: 'Accès refusé' } })
    await expect(PayrollService.getPayrollSettings('ENT')).rejects.toMatchObject({ code: '42501' })
  })
  it('des lignes multiples ne sont pas assimilées à une absence', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Multiple rows' } })
    await expect(PayrollService.getPayrollSettings('ENT')).rejects.toMatchObject({ code: 'PGRST116' })
  })
  it('les réglages congés et heures supplémentaires acceptent une configuration absente', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await LeaveBalanceService.getEnterpriseLeaveConfig('ENT')).leave_days_per_month).toBe(1.75)
    expect(await FeatureService.getOvertimeSettings('ENT')).toEqual(FeatureService.getDefaultOvertimeSettings())
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2)
  })
})
