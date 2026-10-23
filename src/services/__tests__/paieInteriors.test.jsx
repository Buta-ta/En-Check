// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ darkMode: false }) }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
import PaieWalletLoader from '../../components/PaieWalletLoader'
import PaieDrawer from '../../components/PaieDrawer'
import { BracketModal, RulesModal, ConfirmModal } from '../../components/PaieFiscalModales'
import { BracketCard } from '../../components/PaieFiscalCartes'
import { PaieRulesSummary, PaieSectionIntro } from '../../components/PaieInteriorSections'
let host, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
const render = async element => { await act(async () => root.render(element)) }
it('ouvre un dialogue dans un portail, rend le fond inerte et restaure le focus et le scroll', async () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
  const close = vi.fn()
  await render(<PaieDrawer title="Tranche" onClose={close} help="Un repère" example="Un exemple"><button>Enregistrer</button></PaieDrawer>)
  const dialog = document.querySelector('[role="dialog"]')
  expect(dialog.getAttribute('aria-modal')).toBe('true'); expect(host.contains(dialog)).toBe(false)
  expect(host.inert).toBe(true); expect(document.activeElement).toBe(dialog); expect(document.body.style.overflow).toBe('hidden')
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(close).toHaveBeenCalledTimes(1)
  await render(null); expect(host.inert).not.toBe(true); expect(document.body.style.overflow).toBe(''); expect(document.activeElement).toBe(trigger); trigger.remove()
})
it('bloque fermeture et champs pendant la sauvegarde', async () => {
  const close = vi.fn()
  await render(<PaieDrawer title="Tranche" onClose={close} busy><input/><button>Enregistrer</button></PaieDrawer>)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  document.querySelector('.pw-drawer-layer').click()
  expect(close).not.toHaveBeenCalled(); expect(document.querySelector('fieldset').disabled).toBe(true)
})
it('boucle au clavier entre le premier et le dernier contrôle', async () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 30, height: 30 }])
  await render(<PaieDrawer title="Test" onClose={() => {}}><button>Premier</button><button>Dernier</button></PaieDrawer>)
  const buttons = document.querySelectorAll('.pw-drawer button')
  buttons[1].focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(buttons[0])
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); expect(document.activeElement).toBe(buttons[1])
})
it('conserve le payload de la tranche et fournit un exemple', async () => {
  const save = vi.fn()
  await render(<BracketModal bracket={{ bracket_name: 'Tranche 1', bracket_order: 1, min_amount: 0, max_amount: 50000, tax_rate: 10, fixed_deduction: 0 }} currency="XOF" onSave={save} onClose={() => {}}/>)
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Voir un exemple')
  const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Enregistrer'))
  await act(async () => button.click())
  expect(save.mock.calls[0][0]).toMatchObject({ min_amount: 0, max_amount: 50000, tax_rate: 10 })
})
it('ouvre et supprime une tranche par deux actions distinctes et respecte une borne zéro', async () => {
  const edit = vi.fn(), remove = vi.fn()
  await render(<BracketCard bracket={{ bracket_order: 1, bracket_name: 'Exonérée', min_amount: 0, max_amount: 0, tax_rate: 0 }} currency="XOF" onEdit={edit} onDelete={remove}/>)
  expect(host.textContent).not.toContain('Sans limite')
  await act(async () => host.querySelector('button').click()); expect(edit).toHaveBeenCalledOnce(); expect(remove).not.toHaveBeenCalled()
  await act(async () => host.querySelectorAll('button')[1].click()); expect(remove).toHaveBeenCalledOnce()
})
it('présente les règles en français et résout le nom des charges', async () => {
  await render(<PaieRulesSummary rules={{ abattement_type: 'percentage', tax_calculation_method: 'progressive', charges_deductibles: ['PVID'], max_abattement: 0 }} contributions={[{ contribution_code: 'PVID', contribution_name: 'Pension vieillesse' }]} formatMoney={String} onEdit={() => {}}/>)
  expect(host.textContent).toContain('En pourcentage'); expect(host.textContent).toContain('Par tranches progressives'); expect(host.textContent).toContain('Pension vieillesse'); expect(host.textContent).not.toContain('percentage')
})
it('les règles et confirmations restent des dialogues actionnables', async () => {
  await render(<RulesModal rules={{}} contributions={[]} currency="XOF" onSave={() => {}} onClose={() => {}}/>)
  expect(document.querySelector('[role="dialog"]').textContent).toContain('abattement')
  const confirm = vi.fn()
  await render(<ConfirmModal title="Supprimer ?" message="Une tranche" onCancel={() => {}} onConfirm={confirm} confirmText="Confirmer"/>)
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Confirmer').click()); expect(confirm).toHaveBeenCalledOnce()
})
it('chaque intérieur de bulletin possède un exemple repliable', async () => {
  for (const section of ['settings', 'profiles', 'allowances', 'imports', 'preview']) {
    await render(<PaieSectionIntro section={section}/>); expect(host.querySelector('details').textContent).toContain('Exemple'); expect(host.querySelector('h2')).not.toBeNull()
  }
})

it('annonce le chargement avec une illustration décorative et sans dialogue bloquant', async () => {
  await render(<PaieWalletLoader label="Chargement fiscal…"/>);
  expect(host.querySelector('[role="status"]').textContent).toContain('Chargement fiscal');
  expect(host.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
})
