// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import AdminAccounts from '../../pages/AdminAccounts'
import MyAdminAccount from '../../pages/MyAdminAccount'
import {
  filterAdminAccounts,
  currentAdminAccount,
  accountRpc,
} from '../adminAccounts'
const mock = vi.hoisted(() => ({
  role: 'super_admin',
  rpc: vi.fn(),
  user: vi.fn(),
  from: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mock.user,
      mfa: { listFactors: async () => ({ data: { totp: [] } }) },
    },
    from: mock.from,
    rpc: mock.rpc,
  },
}))
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false, toggleTheme: vi.fn() }),
}))
const admin = {
  id: 'super',
  user_id: 'auth-super',
  role: 'super_admin',
  first_name: 'Sara',
  last_name: 'Test',
  email: 'sara@example.test',
  is_active: true,
}
const member = {
  id: 'member',
  role: 'admin',
  first_name: 'Aïcha',
  last_name: 'Test',
  email: 'aicha@example.test',
  enterprise_id: 'ent',
  is_active: false,
}
let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mock.role = 'super_admin'
  mock.rpc.mockReset()
  mock.user.mockReset()
  mock.user.mockResolvedValue({ data: { user: { id: 'auth-super' } } })
  mock.from.mockImplementation((table) => {
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      order: vi.fn(() => q),
      limit: vi.fn(async () => ({
        data:
          table === 'admins'
            ? [admin, member]
            : table === 'enterprises'
              ? [{ id: 'ent', name: 'Horizon' }]
              : [],
      })),
      single: vi.fn(async () => ({ data: { ...admin, role: mock.role } })),
    }
    return q
  })
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
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
      <MemoryRouter>
        <AdminAccounts />
      </MemoryRouter>,
    ),
  )
}
it('uses authenticated server identity instead of a localStorage role', async () => {
  localStorage.setItem(
    'admin',
    JSON.stringify({ ...admin, role: 'super_admin' }),
  )
  mock.user.mockResolvedValue({
    data: { user: null },
    error: { message: 'expired' },
  })
  await expect(currentAdminAccount()).rejects.toThrow('reconnecter')
  localStorage.removeItem('admin')
})
it('does not load the administrator directory for an ordinary admin', async () => {
  mock.role = 'admin'
  await mount()
  expect(host.textContent).toContain('réservé au superadministrateur')
  expect(host.querySelector('.aa-row')).toBeNull()
  expect(
    mock.from.mock.calls.filter(([table]) => table === 'enterprises'),
  ).toHaveLength(0)
})
it('renders actual counts, both active and inactive accounts and opens the selected profile', async () => {
  await mount()
  expect(host.querySelectorAll('.aa-row')).toHaveLength(2)
  expect(
    [...host.querySelectorAll('.aa-metrics strong')].map((e) => e.textContent),
  ).toEqual(['1', '1', '1'])
  await act(async () => host.querySelectorAll('.aa-row')[1].click())
  expect(host.querySelector('dialog').open).toBe(true)
  expect(host.querySelector('#aa-account-title').textContent).toBe('Aïcha Test')
  expect(host.textContent).not.toContain('2 invitations')
  const close = host.querySelector('[aria-label="Fermer la fiche"]')
  await act(async () => close.click())
  expect(host.querySelector('dialog').open).toBe(false)
})
it('filters without silently dropping inactive accounts', () => {
  expect(
    filterAdminAccounts([admin, member], 'aïcha', 'ent', 'inactive'),
  ).toEqual([member])
  expect(filterAdminAccounts([admin, member], '', '', '')).toHaveLength(2)
  expect(filterAdminAccounts([admin, member], '', 'ent', 'active')).toEqual([])
})
it('clearly reports missing server migration, without insecure fallback', async () => {
  mock.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  await expect(accountRpc('encheck_account_profile', {})).rejects.toThrow(
    'migration sécurisée',
  )
})
it('protects both management routes and exposes the personal account to all admins', () => {
  const source = readFileSync('src/App.jsx', 'utf8')
  expect(source).toContain(
    'path="/admins" element={<AdminRoute requireSuperAdmin>',
  )
  expect(source).toContain(
    'path="/admins/gestion-existante" element={<AdminRoute requireSuperAdmin>',
  )
  expect(source).toContain(".eq('user_id', session.user.id)")
  expect(
    readFileSync('src/components/DashboardExperience.jsx', 'utf8'),
  ).toContain("path: '/mon-compte', show: true")
})

it('provides an own-account form without editable permissions or email', async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <MyAdminAccount />
      </MemoryRouter>,
    ),
  )
  expect(host.textContent).toContain('Mon profil')
  expect(
    [...host.querySelectorAll('input')].find(
      (input) => input.value === admin.email,
    ).readOnly,
  ).toBe(true)
  expect(host.querySelector('select')).toBeNull()
  mock.rpc.mockResolvedValue({ data: null, error: null })
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
  expect(mock.rpc).toHaveBeenCalledWith('encheck_account_profile', {
    p_first_name: admin.first_name,
    p_last_name: admin.last_name,
    p_photo_url: null,
  })
  expect(host.textContent).toContain('Votre profil a été enregistré')
})
it('preserves the form and shows a server refusal instead of claiming a profile save', async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <MyAdminAccount />
      </MemoryRouter>,
    ),
  )
  mock.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
  expect(host.textContent).toContain('migration sécurisée')
  expect(host.textContent).not.toContain('Votre profil a été enregistré')
})
