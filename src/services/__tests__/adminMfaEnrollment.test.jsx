// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminMfaSettings from '../../components/AdminMfaSettings'
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  ensure: vi.fn(),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}))
vi.mock('../adminAccounts', () => ({ accountRpc: mock.rpc }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { mfa: mock.mfa } } }))
vi.mock('../../hooks/useAdminMfaCheckpoint', () => ({
  default: () => ({ ensureMfa: mock.ensure, challenge: null }),
}))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  mock.rpc.mockResolvedValue({ rest_guard_active: true })
  mock.mfa.listFactors.mockResolvedValue({ data: { totp: [] } })
  mock.mfa.enroll.mockResolvedValue({
    data: {
      id: 'fixture-factor',
      totp: { qr_code: '<svg/>', secret: 'fixture-only-secret' },
    },
  })
  mock.mfa.challengeAndVerify.mockResolvedValue({ error: null })
  mock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal2' },
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
const button = () =>
  [...host.querySelectorAll('button')].find(
    (b) => b.textContent === 'Ajouter un authentificateur',
  )
async function mount() {
  await act(async () => root.render(<AdminMfaSettings />))
}
it('does not enroll when the server does not confirm the REST guard', async () => {
  mock.rpc.mockResolvedValue({ rest_guard_active: false })
  await mount()
  expect(button().disabled).toBe(true)
  expect(mock.mfa.enroll).not.toHaveBeenCalled()
})
it('enrolls explicitly, verifies the native factor and removes its secret from the screen', async () => {
  await mount()
  await act(async () => button().click())
  expect(mock.ensure).toHaveBeenCalled()
  expect(host.textContent).toContain('fixture-only-secret')
  await act(async () => {
    const field = host.querySelector('input')
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(field, '123456')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  mock.mfa.listFactors.mockResolvedValue({
    data: { totp: [{ id: 'fixture-factor', status: 'verified' }] },
  })
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
  expect(mock.mfa.challengeAndVerify).toHaveBeenCalledWith({
    factorId: 'fixture-factor',
    code: '123456',
  })
  expect(host.textContent).not.toContain('fixture-only-secret')
  expect(host.textContent).toContain('Vérifié')
})

async function submitCode() {
  await act(async () => {
    const field = host.querySelector('input')
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(field, '123456')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
it('explains a rejected TOTP code without losing the enrollment or exposing provider details', async () => {
  await mount()
  await act(async () => button().click())
  mock.mfa.challengeAndVerify.mockResolvedValue({
    error: {
      code: 'mfa_verification_failed',
      status: 422,
      message: 'private provider details',
    },
  })
  await submitCode()
  expect(host.textContent).toContain('mfa_verification_failed')
  expect(host.textContent).toContain('date et l’heure automatiques')
  expect(host.textContent).not.toContain('private provider details')
  expect(host.querySelector('input').value).toBe('')
  expect(host.querySelector('form')).not.toBeNull()
  expect(mock.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled()
  expect(host.textContent).not.toContain('Facteur vérifié.')
})
it('does not mistake a failed Admin refresh for a rejected native verification', async () => {
  await mount()
  await act(async () => button().click())
  mock.rpc.mockRejectedValue(Error('missing optional service'))
  await submitCode()
  expect(host.textContent).toContain('Facteur vérifié.')
  expect(host.textContent).toContain('ne recréez pas le facteur')
  expect(host.textContent).not.toContain('fixture-only-secret')
  expect(host.querySelector('form')).toBeNull()
})
it('does not announce verification without confirmed AAL2', async () => {
  await mount()
  await act(async () => button().click())
  mock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1' },
  })
  await submitCode()
  expect(host.textContent).toContain('mfa_assurance_not_confirmed')
  expect(host.textContent).not.toContain('Facteur vérifié.')
})
