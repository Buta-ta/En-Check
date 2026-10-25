// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminPermissionRoles from '../../components/AdminPermissionRoles'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), level: vi.fn(), catalog: null }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mock.rpc,
    auth: { mfa: { getAuthenticatorAssuranceLevel: mock.level } },
  },
}))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks()
  mock.catalog = {
    enabled: false,
    blockers: [],
    roles: [
      {
        id: 'role-1',
        name: 'Lecture RH',
        grants: [
          { module: 'employees', enterprise_id: 'ent', actions: ['read'] },
        ],
      },
    ],
    bindings: [],
  }
  mock.rpc.mockImplementation(async (name) => ({
    data: name === 'encheck_permission_roles_list' ? mock.catalog : 'role-new',
    error: null,
  }))
  mock.level.mockResolvedValue({
    data: { currentLevel: 'aal2', nextLevel: 'aal2' },
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function mount() {
  await act(async () =>
    root.render(
      <AdminPermissionRoles
        accounts={[
          { id: 'member', first_name: 'Test', role: 'admin', is_active: true },
        ]}
        enterprises={[{ id: 'ent', name: 'Test enterprise' }]}
      />,
    ),
  )
}
async function set(field, value) {
  await act(async () => {
    const prototype =
      field.tagName === 'SELECT'
        ? HTMLSelectElement.prototype
        : field.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value)
    field.dispatchEvent(
      new Event(field.tagName === 'SELECT' ? 'change' : 'input', {
        bubbles: true,
      }),
    )
  })
}
it('shows server activation state and refuses assigning a disabled custom role', async () => {
  await mount()
  expect(host.textContent).toContain('Attribution désactivée')
  const selects = host.querySelectorAll('select')
  await set(selects[2], 'member')
  await set(selects[3], 'role-1')
  await set(host.querySelectorAll('textarea')[1], 'Valid reason')
  expect(
    [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Appliquer au compte',
    ).disabled,
  ).toBe(true)
})
it('creates a version with explicit scope without assigning it automatically', async () => {
  await mount()
  await set(
    host.querySelector('input:not([type=checkbox])'),
    'Lecture RH nouvelle',
  )
  await set(host.querySelector('select'), 'ent')
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Ajouter cette règle')
      .click(),
  )
  await set(host.querySelector('textarea'), 'Accès limité demandé')
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
  expect(mock.rpc).toHaveBeenCalledWith('encheck_permission_role_create', {
    p_name: 'Lecture RH nouvelle',
    p_grants: [
      { enterprise_id: 'ent', module: 'employees', actions: ['read'] },
    ],
    p_reason: 'Accès limité demandé',
  })
  expect(
    mock.rpc.mock.calls.some(
      ([name]) => name === 'encheck_permission_role_assign',
    ),
  ).toBe(false)
  expect(host.textContent).toContain('Aucune attribution automatique')
})
it('shows an explicit failure instead of inventing an empty successful catalog', async () => {
  mock.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  await mount()
  expect(host.querySelector('[role=alert]').textContent).toContain('migration')
  expect(
    [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Créer la version',
    ).disabled,
  ).toBe(true)
})
it('rejects an incomplete catalog response', async () => {
  mock.catalog = { roles: [] }
  await mount()
  expect(host.querySelector('[role=alert]').textContent).toContain(
    'indisponible',
  )
})
