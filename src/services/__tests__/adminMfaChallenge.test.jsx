// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminMfaChallenge from '../../components/AdminMfaChallenge'
const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { mfa } } }))
let root, host, verified, cancel
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  mfa.listFactors.mockResolvedValue({
    data: { totp: [{ id: 'factor-a', status: 'verified' }] },
  })
  mfa.challengeAndVerify.mockResolvedValue({ error: null })
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal2' },
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  verified = vi.fn()
  cancel = vi.fn()
  await act(async () =>
    root.render(<AdminMfaChallenge onVerified={verified} onCancel={cancel} />),
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function submit() {
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
it('requires a successful challenge and aal2 before granting access', async () => {
  await submit()
  expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
    factorId: 'factor-a',
    code: '123456',
  })
  expect(verified).toHaveBeenCalledTimes(1)
  expect(host.querySelector('input').value).toBe('')
})
it('never grants access on an aal1 response', async () => {
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1' },
  })
  await submit()
  expect(verified).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Vérification refusée')
})
it('clears codes and hides raw provider errors', async () => {
  mfa.challengeAndVerify.mockResolvedValue({
    error: new Error('sensitive provider response'),
  })
  await submit()
  expect(verified).not.toHaveBeenCalled()
  expect(host.querySelector('input').value).toBe('')
  expect(host.textContent).not.toContain('sensitive provider response')
  await act(async () => host.querySelector('[type="button"]').click())
  expect(cancel).toHaveBeenCalledTimes(1)
})
