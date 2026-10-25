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
async function openPasswordForm() {
  await mount()
  await act(async () => host.querySelectorAll('.aa-row')[1].click())
  await act(async () =>
    [...host.querySelectorAll('dialog button')]
      .find((button) => button.textContent === 'Sécurité')
      .click(),
  )
  mock.rpc.mockClear()
}
async function fillPasswordForm(
  password = 'Secure-Example-123!',
  confirmation = password,
) {
  const details = host.querySelector('.aa-password-section')
  if (!details.open)
    await act(async () => details.querySelector('summary').click())
  const form = host.querySelector('.aa-password-form')
  const fields = form.querySelectorAll('input[type="password"]')
  await act(async () => {
    for (const [field, value] of [
      [fields[0], password],
      [fields[1], confirmation],
    ]) {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const reason = form.querySelector('textarea')
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    ).set.call(reason, 'Support demandé par le titulaire')
    reason.dispatchEvent(new Event('input', { bubbles: true }))
    form.querySelector('[type="checkbox"]').click()
  })
  return form
}
it('rejects mismatched credentials before any reset request', async () => {
  await openPasswordForm()
  const form = await fillPasswordForm(
    'Secure-Example-123!',
    'Different-Example-123!',
  )
  await act(async () =>
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    ),
  )
  expect(mock.rpc).not.toHaveBeenCalled()
  expect(host.querySelector('.aa-notice').textContent).toContain('identiques')
})
it('targets only the selected account, locks duplicate requests and clears secrets after success', async () => {
  await openPasswordForm()
  let release
  mock.rpc.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  const form = await fillPasswordForm()
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  expect(mock.rpc).toHaveBeenCalledTimes(1)
  expect(mock.rpc).toHaveBeenCalledWith('encheck_account_password', {
    p_admin_id: 'member',
    p_password: 'Secure-Example-123!',
    p_reason: 'Support demandé par le titulaire',
  })
  await act(async () => release({ error: null }))
  expect(
    [...form.querySelectorAll('input[type="password"]')].every(
      (input) => input.value === '',
    ),
  ).toBe(true)
  expect(host.querySelector('.aa-notice').textContent).toContain(
    'intervention enregistrée',
  )
})
it('does not echo service errors containing credentials and clears secrets on failure and navigation', async () => {
  await openPasswordForm()
  mock.rpc.mockResolvedValue({
    error: { message: 'Server detail Secure-Example-123!' },
  })
  let form = await fillPasswordForm()
  await act(async () =>
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    ),
  )
  expect(host.querySelector('.aa-notice').textContent).toContain(
    'Modification non confirmée',
  )
  expect(host.textContent).not.toContain('Server detail')
  expect(
    [...form.querySelectorAll('input[type="password"]')].every(
      (input) => input.value === '',
    ),
  ).toBe(true)
  await fillPasswordForm()
  await act(async () =>
    [...host.querySelectorAll('dialog button')]
      .find((button) => button.textContent === 'Profil')
      .click(),
  )
  await act(async () =>
    [...host.querySelectorAll('dialog button')]
      .find((button) => button.textContent === 'Sécurité')
      .click(),
  )
  form = host.querySelector('.aa-password-form')
  expect(
    [...form.querySelectorAll('input[type="password"]')].every(
      (input) => input.value === '',
    ),
  ).toBe(true)
})
it('renders the register without a duplicate sidebar and exposes the real journal', async () => {
  await mount()
  expect(host.querySelector('.aa-rail')).toBeNull()
  expect(host.querySelector('h1').textContent).toContain('Comptes & accès')
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Journal')
      .click(),
  )
  expect(host.textContent).toContain('Le journal des interventions')
  expect(host.textContent).toContain('Aucune intervention enregistrée')
  expect(mock.from).toHaveBeenCalledWith('admin_account_events')
})
it('keeps sensitive actions collapsed until requested and uses the selected band in the drawer', async () => {
  await openPasswordForm()
  expect(host.querySelector('.aa-danger-section').open).toBe(false)
  expect(host.querySelector('.aa-password-section').open).toBe(false)
  expect(
    host.querySelector('dialog [data-cultural-motif="abomey"]'),
  ).not.toBeNull()
  // Identité propre à la page : l'appliqué d'Abomey, en SVG maison.
  // Avant, /admins empruntait l'image du bogolan de la Paie — une bande
  // de 46 px qui n'était pas la sienne.
  const css = readFileSync('src/components/PageCulturalBand.css', 'utf8')
  expect(css).toContain(".ec-cultural-top[data-cultural-motif='abomey']")
  const band = readFileSync('src/components/PageCulturalBand.jsx', 'utf8')
  expect(band).toContain("motif === 'abomey' && <AbomeyFriseSvg/>")
})
it('reports an unavailable journal without pretending it is empty and allows retry', async () => {
  await mount()
  const original = mock.from.getMockImplementation()
  mock.from.mockImplementation((table) => {
    if (table !== 'admin_account_events') return original(table)
    const q = {
      select: () => q,
      order: () => q,
      limit: async () => ({ error: { message: 'missing migration' } }),
    }
    return q
  })
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Journal')
      .click(),
  )
  expect(
    host.querySelector('.aa-journal [role="alert"]').textContent,
  ).toContain('Journal indisponible')
  expect(host.querySelector('.aa-journal').textContent).not.toContain(
    'Aucune intervention enregistrée',
  )
  mock.from.mockImplementation(original)
  await act(async () =>
    [...host.querySelectorAll('.aa-journal button')]
      .find((b) => b.textContent === 'Réessayer')
      .click(),
  )
  expect(host.querySelector('.aa-journal').textContent).toContain(
    'Aucune intervention enregistrée',
  )
})
