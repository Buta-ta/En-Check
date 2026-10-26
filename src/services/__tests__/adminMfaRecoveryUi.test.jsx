// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminMfaRecovery from '../../components/AdminMfaRecovery'
const m = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), ensure: vi.fn() }))
vi.mock('../adminAccounts', () => ({ accountRpc: m.rpc }))
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: m.invoke } },
}))
vi.mock('../../hooks/useAdminMfaCheckpoint', () => ({
  default: () => ({ ensureMfa: m.ensure, challenge: null }),
}))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})
async function mount(currentId = 'operator') {
  await act(async () =>
    root.render(
      <AdminMfaRecovery
        account={{ id: 'target', email: 'fixture@example.test' }}
        currentId={currentId}
      />,
    ),
  )
}
async function submit() {
  await act(async () => {
    for (const [el, proto, value] of [
      [
        host.querySelector('input'),
        HTMLInputElement.prototype,
        'fixture@example.test',
      ],
      [
        host.querySelector('textarea'),
        HTMLTextAreaElement.prototype,
        'Identity checked by callback',
      ],
    ]) {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
it('does not offer self-recovery or call providers on mount', async () => {
  await mount('target')
  expect(host.textContent).toBe('')
  expect(m.invoke).not.toHaveBeenCalled()
})
it('shows a safe running-state message after an explicit MFA status check', async () => {
  await mount()
  m.rpc.mockResolvedValue({ state: 'running' })
  await act(async () => host.querySelector('button').click())
  expect(m.ensure).toHaveBeenCalled()
  expect(m.rpc).toHaveBeenCalledWith('encheck_mfa_recovery_status_v2', {
    p_target_id: 'target',
  })
  expect(host.textContent).toContain('Ne la relancez pas')
  expect(m.invoke).not.toHaveBeenCalled()
})
it('does not report success on ambiguous or partial responses', async () => {
  await mount()
  m.invoke.mockResolvedValue({ data: { completed: 'false' } })
  await submit()
  expect(host.textContent).toContain('Récupération non confirmée')
  expect(host.textContent).not.toContain('Facteurs retirés.')
})
it('requires an explicit success and explains reconnection without lifting MFA', async () => {
  await mount()
  m.invoke.mockResolvedValue({ data: { completed: true } })
  await submit()
  expect(host.textContent).toContain('Le titulaire doit se reconnecter')
  expect(host.textContent).toContain('L’obligation MFA reste active.')
})
