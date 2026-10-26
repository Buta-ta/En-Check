// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminMfaRequirement from '../../components/AdminMfaRequirement'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), ensure: vi.fn() }))
vi.mock('../adminAccounts', () => ({ accountRpc: mock.rpc }))
vi.mock('../../hooks/useAdminMfaCheckpoint', () => ({
  default: () => ({ ensureMfa: mock.ensure, challenge: null }),
}))
let root, host
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
async function mount(currentId = 'actor') {
  await act(async () =>
    root.render(
      <AdminMfaRequirement account={{ id: 'target' }} currentId={currentId} />,
    ),
  )
}
async function submit() {
  await act(async () => {
    const input = host.querySelector('input')
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(input, 'Protection du compte')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
it('does not offer self-imposition or issue requirements on mount', async () => {
  await mount('target')
  expect(host.textContent).toBe('')
  expect(mock.rpc).not.toHaveBeenCalled()
})
it('requires confirmation and MFA and sends the selected account plus reason', async () => {
  await mount()
  mock.rpc.mockResolvedValue({ ok: true })
  await submit()
  expect(mock.ensure).toHaveBeenCalled()
  expect(mock.rpc).toHaveBeenCalledWith('encheck_mfa_exiger', {
    p_admin_id: 'target',
    p_motif: 'Protection du compte',
  })
  expect(host.textContent).toContain('Double authentification exigée.')
})
it('never claims success on a server refusal', async () => {
  await mount()
  mock.rpc.mockRejectedValue(Error('private details'))
  await submit()
  expect(host.textContent).toContain('Obligation non confirmée')
  expect(host.textContent).not.toContain('private details')
})
