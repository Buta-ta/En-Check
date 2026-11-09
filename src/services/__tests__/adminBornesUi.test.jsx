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
const revokes = {
  revoque: {
    id: 'br1',
    device_id: 'borne-test',
    enterprise_id: 'ent',
    expire_le: new Date(Date.now() + 30 * 86400000).toISOString(),
    revoque_le: new Date(Date.now() - 86400000).toISOString(),
  },
  active: {
    id: 'ba1',
    device_id: 'borne-active',
    enterprise_id: 'ent',
    expire_le: new Date(Date.now() + 30 * 86400000).toISOString(),
    revoque_le: null,
  },
}
async function loadBornes() {
  await mount()
  mock.rpc.mockImplementation(async (name) =>
    name === 'encheck_bornes_lister'
      ? { ok: true, bornes: [revokes.revoque, revokes.active] }
      : { ok: true, borne_id: 'b' },
  )
  await act(async () => {
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Charger les bornes'))
      .click()
  })
}
it('replaces window.confirm with a styled modal and deletes a revoked borne', async () => {
  await loadBornes()
  const boutons = [...host.querySelectorAll('ul button')]
  const supprimer = boutons.find((b) => b.textContent === 'Supprimer')
  expect(supprimer.disabled).toBe(false)
  await act(async () => supprimer.click())
  const modal = host.querySelector('[role="dialog"]')
  expect(modal).not.toBeNull()
  expect(modal.textContent).toContain('Supprimer définitivement borne-test')
  await act(async () => {
    const champ = host.querySelector('.aa-modal textarea')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      champ,
      'Recette terminée',
    )
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const valider = [...host.querySelectorAll('.aa-modal button')].find(
    (b) => b.textContent === 'Supprimer définitivement',
  )
  expect(valider.disabled).toBe(false)
  await act(async () => valider.click())
  expect(mock.rpc).toHaveBeenCalledWith('encheck_borne_supprimer', {
    p_borne_id: 'br1',
    p_motif: 'Recette terminée',
  })
  expect(host.querySelector('[role="dialog"]')).toBeNull()
})
it('blocks deletion of an active borne and allows renewal without the global motif', async () => {
  await loadBornes()
  const lignes = host.querySelectorAll('ul li')
  const boutonsActive = [...lignes[1].querySelectorAll('button')]
  const supprimerActive = boutonsActive.find(
    (b) => b.textContent === 'Supprimer',
  )
  expect(supprimerActive.disabled).toBe(true)
  const renouvelerActive = boutonsActive.find(
    (b) => b.textContent === 'Renouveler le secret',
  )
  // Le motif global (textarea du formulaire de création) est vide : le
  // bouton ne doit plus dépendre de lui.
  expect(host.querySelector('textarea').value).toBe('')
  expect(renouvelerActive.disabled).toBe(false)
  await act(async () => renouvelerActive.click())
  const modal = host.querySelector('[role="dialog"]')
  expect(modal.textContent).toContain('Renouveler le secret de borne-active')
  await act(async () => {
    const champ = host.querySelector('.aa-modal textarea')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      champ,
      'Changement de secret demandé',
    )
    champ.dispatchEvent(new Event('input', { bubbles: true }))
    const valider = host.querySelectorAll('.aa-modal button')
    for (const b of valider) {
      if (b.textContent === 'Renouveler le secret') b.click()
    }
  })
  expect(mock.rpc).toHaveBeenCalledWith('encheck_borne_secret_renouveler', {
    p_borne_id: 'ba1',
    p_motif: 'Changement de secret demandé',
  })
  expect(host.querySelector('[role="dialog"]')).toBeNull()
})
