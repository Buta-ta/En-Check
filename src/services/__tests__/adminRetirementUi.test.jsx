// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminAccountRetirement from '../../components/AdminAccountRetirement'
const mock = vi.hoisted(() => ({
  items: [],
  invoke: vi.fn(),
  rpc: vi.fn(),
  level: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: mock.items }) }),
      }),
    }),
    rpc: mock.rpc,
    functions: { invoke: mock.invoke },
    auth: { mfa: { getAuthenticatorAssuranceLevel: mock.level } },
  },
}))
let host, root
const account = { id: 'target', is_active: false }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  mock.items = [{ id: 'job', state: 'requested', requested_by: 'requester' }]
  mock.level.mockResolvedValue({
    data: { currentLevel: 'aal2', nextLevel: 'aal2' },
  })
  mock.invoke.mockResolvedValue({
    data: { completed: true, shared_identity_preserved: true },
  })
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
async function mount(currentId) {
  await act(async () =>
    root.render(
      <AdminAccountRetirement
        account={account}
        currentId={currentId}
        accounts={[]}
      />,
    ),
  )
}
const approval = () =>
  [...host.querySelectorAll('button')].find(
    (b) => b.textContent === 'Approuver et clôturer',
  )
it('disables self approval of a request', async () => {
  await mount('requester')
  expect(approval().disabled).toBe(true)
  expect(mock.invoke).not.toHaveBeenCalled()
})
it('sends only the request ID; never accepts a client-supplied Auth identity', async () => {
  await mount('reviewer')
  await act(async () => approval().click())
  expect(mock.invoke).toHaveBeenCalledWith('admin-retirement', {
    body: { request_id: 'job' },
  })
  expect(host.textContent).toContain('identité employé/partagée conservée')
})
it('does not execute when confirmation is cancelled', async () => {
  window.confirm.mockReturnValue(false)
  await mount('reviewer')
  await act(async () => approval().click())
  expect(mock.invoke).not.toHaveBeenCalled()
})
it('does not display success after an incomplete cleanup', async () => {
  mock.invoke.mockResolvedValue({ error: new Error('sensitive provider data') })
  await mount('reviewer')
  await act(async () => approval().click())
  expect(host.textContent).toContain('nettoyage non confirmé')
  expect(host.textContent).not.toContain('sensitive provider data')
  expect(host.textContent).not.toContain('Profil clôturé et nettoyage confirmé')
})
