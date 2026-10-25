// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminMyPermissions from '../../components/AdminMyPermissions'
const mock = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../adminAccounts', () => ({ accountRpc: mock.rpc }))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
it('shows the server role and readable company scope', async () => {
  mock.rpc.mockResolvedValue({
    name: 'Lecture RH',
    grants: [
      {
        module: 'employees',
        enterprise_id: 'ent',
        enterprise_name: 'Maison Kora',
        actions: ['read'],
      },
    ],
  })
  await act(async () => root.render(<AdminMyPermissions />))
  expect(mock.rpc).toHaveBeenCalledWith('encheck_my_permissions', {})
  expect(host.textContent).toContain('Maison Kora')
  expect(host.textContent).toContain('Employés')
  expect(host.textContent).toContain('Lire')
})
it('does not claim historical rights when the server response is invalid', async () => {
  mock.rpc.mockResolvedValue({})
  await act(async () => root.render(<AdminMyPermissions />))
  expect(host.textContent).toContain('indisponibles')
  expect(host.textContent).not.toContain('Vos droits restent')
})
