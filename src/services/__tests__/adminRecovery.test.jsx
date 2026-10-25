// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import AdminRecovery from '../../pages/AdminRecovery'
import { adminPasswordChangeRequired } from '../adminPasswordCheckpoint'
const mock = vi.hoisted(() => ({
  reset: vi.fn(),
  update: vi.fn(),
  user: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  level: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mock.rpc,
    auth: {
      resetPasswordForEmail: mock.reset,
      updateUser: mock.update,
      getUser: mock.user,
      signOut: mock.signOut,
      mfa: { getAuthenticatorAssuranceLevel: mock.level },
    },
  },
}))
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false }),
}))
let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  mock.reset.mockResolvedValue({ error: null })
  mock.update.mockResolvedValue({ error: null })
  mock.user.mockResolvedValue({ data: { user: { id: 'test' } } })
  mock.signOut.mockResolvedValue({ error: null })
  mock.rpc.mockResolvedValue({ data: true, error: null })
  mock.level.mockResolvedValue({
    data: { currentLevel: 'aal1', nextLevel: 'aal1' },
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function mount(mode) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AdminRecovery mode={mode} />
      </MemoryRouter>,
    ),
  )
}
async function fill(values) {
  await act(async () => {
    host.querySelectorAll('input').forEach((input, index) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set.call(input, values[index])
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  })
}
async function submit() {
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
it('does not disclose account existence or provider errors when requesting recovery', async () => {
  mock.reset.mockResolvedValue({ error: { message: 'user not found' } })
  await mount('request')
  await fill(['unknown@example.test'])
  await submit()
  expect(host.textContent).toContain('Si cette adresse peut recevoir un lien')
  expect(host.textContent).not.toContain('user not found')
  expect(mock.reset).toHaveBeenCalledWith('unknown@example.test', {
    redirectTo: `${window.location.origin}/admin/recuperation`,
  })
})
it('rejects mismatches before changing credentials', async () => {
  await mount('reset')
  await fill(['Password-Test-123!', 'Different-Test-123!'])
  await submit()
  expect(mock.update).not.toHaveBeenCalled()
  expect(host.textContent).toContain('identiques')
  expect([...host.querySelectorAll('input')].every((i) => i.value === '')).toBe(
    true,
  )
})
it('never activates an invitation when password update fails', async () => {
  mock.update.mockResolvedValue({ error: new Error('secret provider error') })
  await mount('invite')
  await fill(['Password-Test-123!', 'Password-Test-123!'])
  await submit()
  expect(mock.rpc).not.toHaveBeenCalled()
  expect(host.textContent).not.toContain('secret provider error')
})
it('activates only after Auth update, then signs out and removes local account data', async () => {
  localStorage.setItem('admin', 'obsolete')
  await mount('invite')
  await fill(['Password-Test-123!', 'Password-Test-123!'])
  await submit()
  expect(mock.rpc).toHaveBeenCalledWith('encheck_invitation_accept', {})
  expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(localStorage.getItem('admin')).toBe(null)
  expect(host.textContent).toContain('Compte activé')
})
it('password checkpoint fails closed except for explicitly absent additive migration', async () => {
  expect(await adminPasswordChangeRequired()).toBe(true)
  mock.rpc.mockResolvedValue({ error: { code: '42501' } })
  await expect(adminPasswordChangeRequired()).rejects.toThrow('indisponible')
  mock.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  expect(await adminPasswordChangeRequired()).toBe(false)
})
