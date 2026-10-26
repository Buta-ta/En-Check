// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminBornes from '../../components/AdminBornes'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), mfa: vi.fn() }))
vi.mock('../adminAccounts', () => ({ accountRpc: mock.rpc }))
vi.mock('../../hooks/useAdminMfaCheckpoint', () => ({
  default: () => ({ ensureMfa: mock.mfa, challenge: null }),
}))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  mock.mfa.mockResolvedValue()
  mock.rpc.mockImplementation(async (name) =>
    name === 'encheck_bornes_lister'
      ? { ok: true, bornes: [] }
      : { ok: true, borne_id: 'b', secret: 'one-time-fixture' },
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function mount() {
  await act(async () =>
    root.render(<AdminBornes enterprises={[{ id: 'ent', name: 'Demo' }]} />),
  )
}
async function fill() {
  await act(async () => {
    for (const [el, value] of [
      [host.querySelector('textarea'), 'Recette demandée'],
      [host.querySelector('input[maxlength]'), 'tablet'],
      [host.querySelector('select'), 'ent'],
    ]) {
      const proto =
        el.tagName === 'SELECT'
          ? HTMLSelectElement.prototype
          : el.tagName === 'TEXTAREA'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
      el.dispatchEvent(
        new Event(el.tagName === 'SELECT' ? 'change' : 'input', {
          bubbles: true,
        }),
      )
    }
  })
}
it('does not create a device or fetch secrets on mount', async () => {
  await mount()
  expect(mock.rpc).not.toHaveBeenCalled()
  expect(host.querySelector('details').open).toBe(false)
})
it('requires explicit scoped creation after MFA and allows hiding the one-time secret', async () => {
  await mount()
  await fill()
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
  expect(mock.mfa).toHaveBeenCalledTimes(1)
  expect(mock.rpc).toHaveBeenCalledWith(
    'encheck_borne_creer',
    expect.objectContaining({
      p_device_id: 'tablet',
      p_enterprise_id: 'ent',
      p_motif: 'Recette demandée',
    }),
  )
  expect(host.querySelector('input[readonly]').value).toBe('one-time-fixture')
  expect(localStorage.getItem('borne_secret')).toBeNull()
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Masquer le secret')
      .click(),
  )
  expect(host.querySelector('input[readonly]')).toBeNull()
})
it('shows an explicit empty state after loading with MFA', async () => {
  await mount()
  await act(async () => {
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Charger les bornes'))
      .click()
  })
  expect(mock.mfa).toHaveBeenCalledTimes(1)
  expect(mock.rpc).toHaveBeenCalledWith('encheck_bornes_lister', {})
  expect(host.textContent).toContain('Aucune borne autorisée')
})
it('does not echo raw server errors that could contain credentials', async () => {
  await mount()
  await fill()
  mock.rpc.mockRejectedValueOnce(Error('SECRET unexpected parameter'))
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
  expect(host.textContent).not.toContain('SECRET')
  expect(host.textContent).toContain('non confirmée')
})
