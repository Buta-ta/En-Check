// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import Retards from '../../pages/Retards'
import { construireRetards } from '../retardsService'
import {
  retardDates,
  shiftRetardDate,
  retardChart,
  retardsCSV,
  allRetardRows,
} from '../../utils/retardsPresentation'
import { culturalMotifForPath } from '../../components/PageCulturalBand'

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  deletion: vi.fn(),
  allowed: true,
  profiles: [],
}))
const line = (id = 'a', minutes = 12) => ({
  pointage_id: id,
  employe_id: id,
  enterprise_id: 'ent',
  entreprise_nom: 'Atelier',
  prenom: 'Amina',
  nom: id,
  matricule: id,
  jour: '2026-10-23',
  heure_prevue: '08:00',
  heure_arrivee: '08:12',
  est_retard: true,
  retard_minutes: minutes,
  tolerance_minutes: 0,
  grille_source: 'liee',
})
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false, toggleTheme: vi.fn() }),
}))
vi.mock('../../components/PageHeader', () => ({ default: () => null }))
vi.mock('../holidayService', () => ({
  default: {
    getHolidaysForRange: async () => [],
    buildHolidaySet: () => new Set(),
  },
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => mock.rpc(...args),
    from: (table) => {
      let deleting = false
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        delete: () => {
          deleting = true
          return query
        },
        single: async () => ({ data: { module_retards: mock.allowed } }),
        range: async () => ({
          data: table === 'enterprises' ? [{ id: 'ent', name: 'Atelier' }] : [],
        }),
        then: (resolve, reject) =>
          deleting
            ? mock.deletion().then(resolve, reject)
            : Promise.resolve({
                data: table === 'employees' ? mock.profiles : [],
              }).then(resolve, reject),
      }
      return query
    },
  },
}))
function rpcResponse(result) {
  const query = { order: () => query, range: () => Promise.resolve(result) }
  return query
}
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'))
  mock.profiles = []
  mock.allowed = true
  mock.rpc.mockReset().mockImplementation(() => rpcResponse({ data: [line()] }))
  mock.deletion.mockReset().mockResolvedValue({ data: [{ id: 'a' }] })
  localStorage.setItem(
    'admin',
    JSON.stringify({ role: 'admin', enterprise_id: 'ent' }),
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
async function skipIntroIfReady() {
  const button = host.querySelector('.rt-arrival-skip')
  if (button && !button.disabled) await act(async () => button.click())
}
async function mount(skipIntro = true) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <Retards />
      </MemoryRouter>,
    ),
  )
  if (skipIntro) await skipIntroIfReady()
}
async function click(label) {
  const el = [...host.querySelectorAll('button')].find(
    (el) => el.textContent === label || el.getAttribute('aria-label') === label,
  )
  expect(el).toBeTruthy()
  await act(async () => el.click())
  await skipIntroIfReady()
}

it('renders SQL times and a zero tolerance faithfully, without another schedule calculation', async () => {
  await mount()
  expect(mock.rpc).toHaveBeenCalledWith('encheck_retards_plage', {
    p_enterprise: 'ent',
    p_du: '2026-10-23',
    p_au: '2026-10-23',
  })
  expect(host.querySelector('.rt-summary').textContent).toContain('12 min')
  expect(host.querySelector('.rt-arrival').textContent).toContain('08:00')
  expect(host.querySelector('.rt-arrival').textContent).toContain('0 min')
  expect(host.querySelectorAll('.rt-nav nav a')).toHaveLength(4)
  await click('Règles & tolérance')
  expect(host.querySelectorAll('dialog .ec-cultural-band')).toHaveLength(2)
  expect(host.querySelector('dialog details[open]')).toBeNull()
})
it('waits for module access before requesting data', async () => {
  mock.allowed = false
  await mount()
  expect(mock.rpc).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Module Retards non activé')
})
it('sends a Monday–Sunday range and a complete month to the existing RPC', async () => {
  await mount()
  await click('Semaine')
  expect(mock.rpc).toHaveBeenLastCalledWith('encheck_retards_plage', {
    p_enterprise: 'ent',
    p_du: '2026-10-19',
    p_au: '2026-10-25',
  })
  await click('Mois')
  expect(mock.rpc).toHaveBeenLastCalledWith('encheck_retards_plage', {
    p_enterprise: 'ent',
    p_du: '2026-10-01',
    p_au: '2026-10-31',
  })
})
it('shows an error instead of stale or zero metrics and supports retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mock.rpc.mockImplementationOnce(() =>
    rpcResponse({ error: new Error('offline') }),
  )
  await mount()
  expect(host.querySelector('[role="alert"]')).toBeTruthy()
  expect(host.querySelector('.rt-summary')).toBeNull()
  await click('Réessayer')
  expect(host.querySelector('.rt-summary')).toBeTruthy()
})
it('ignores late results from a previous period', async () => {
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  mock.rpc.mockImplementationOnce(() => {
    const q = { order: () => q, range: () => pending }
    return q
  })
  await mount()
  await click('Semaine')
  expect(host.querySelector('.rt-summary').textContent).toContain('12 min')
  await act(async () => release({ data: [line('stale', 99)] }))
  expect(host.textContent).not.toContain('stale')
  expect(host.querySelector('.rt-summary').textContent).toContain('12 min')
})
it('requires explicit confirmation to delete a source attendance; failures remain visible', async () => {
  await mount()
  await click('Supprimer le pointage source…')
  expect(host.querySelector('dialog').textContent).toContain(
    'pas seulement l’alerte',
  )
  await click('Annuler')
  expect(mock.deletion).not.toHaveBeenCalled()
  await click('Supprimer le pointage source…')
  mock.deletion.mockResolvedValueOnce({ data: [] })
  await click('Supprimer définitivement le pointage')
  expect(host.querySelector('dialog [role="alert"]')).toBeTruthy()
  await click('Supprimer définitivement le pointage')
  expect(host.querySelector('dialog')).toBeNull()
  expect(mock.deletion).toHaveBeenCalledTimes(2)
})
it('paginates the visible list without truncating the period summary', async () => {
  mock.rpc.mockImplementation(() =>
    rpcResponse({
      data: Array.from({ length: 10 }, (_, i) => line(String(i))),
    }),
  )
  await mount()
  expect(host.querySelectorAll('.rt-arrival')).toHaveLength(8)
  expect(host.querySelector('.rt-summary').textContent).toContain('10')
  await click('Page suivante')
  expect(host.querySelectorAll('.rt-arrival')).toHaveLength(2)
})
it('preserves zero tolerance in the presentation service', () => {
  expect(construireRetards([line()]).retards[0].tolerance).toBe(0)
})
it('handles leap months and month navigation without date overflow', () => {
  expect(retardDates('2024-02-15', 'mois')).toHaveLength(29)
  expect(shiftRetardDate('2026-01-31', 'mois', 1)).toBe('2026-02-01')
  expect(retardDates('2027-01-01', 'semaine')[0]).toBe('2026-12-28')
})
it('counts chart totals from the same SQL-derived rows, including empty days', () => {
  const chart = retardChart(
    construireRetards([line(), line('b')]).retards,
    retardDates('2026-10-23', 'semaine'),
  )
  expect(chart).toHaveLength(7)
  expect(chart.reduce((n, r) => n + r.count, 0)).toBe(2)
  expect(chart[0].count).toBe(0)
})
it('escapes CSV and exports the exact applied tolerance and source', () => {
  const r = construireRetards([line()]).retards[0]
  r.employee.first_name = '=1+1'
  const csv = retardsCSV([r])
  expect(csv).toContain('"\'=1+1"')
  expect(csv).toContain('"0"')
  expect(csv).toContain('"Planning"')
})
it('loads past server caps, rejecting partial results on any page error', async () => {
  const query = {
    range: vi
      .fn()
      .mockResolvedValueOnce({ data: Array(500).fill({}) })
      .mockResolvedValueOnce({ data: [{}] }),
  }
  expect(await allRetardRows(query)).toHaveLength(501)
  query.range.mockResolvedValueOnce({ error: new Error('offline') })
  await expect(allRetardRows(query)).rejects.toThrow('offline')
})
it('shares the selected Retards motif with its contextual assistant only', () => {
  expect(culturalMotifForPath('/retards?date=2026')).toBe('retards-tissage')
  expect(culturalMotifForPath('/retards-other')).toBe('kente')
})

it('loads the real employee photo after the SQL result without changing lateness', async () => {
  mock.profiles = [
    { id: 'a', enterprise_id: 'ent', photo_url: '/profile-a.jpg' },
  ]
  await mount()
  expect(host.querySelector('.rt-avatar img').getAttribute('src')).toBe(
    '/profile-a.jpg',
  )
  expect(host.querySelector('.rt-summary').textContent).toContain('12 min')
})

it('keeps the first ready result behind the intro, but does not repeat it on period changes', async () => {
  await mount(false)
  expect(host.querySelector('.rt-summary')).toBeNull()
  expect(host.querySelector('.rt-arrival-skip').disabled).toBe(false)
  expect(host.textContent).toContain('Les arrivées sont prêtes')
  await click('Passer l’animation')
  expect(host.querySelector('.rt-summary')).not.toBeNull()
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent === 'Semaine')
      .click(),
  )
  expect(host.querySelector('.rt-summary')).not.toBeNull()
  expect(host.querySelector('.rt-arrival-skip')).toBeNull()
})

it('never reveals results merely because the six-second intro has expired', async () => {
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  mock.rpc.mockImplementationOnce(() => {
    const q = { order: () => q, range: () => pending }
    return q
  })
  await mount(false)
  expect(host.querySelector('.rt-arrival-skip').disabled).toBe(true)
  await act(async () => vi.advanceTimersByTime(6000))
  expect(host.querySelector('.rt-summary')).toBeNull()
  expect(host.querySelector('.rt-run-loader')).not.toBeNull()
  await act(async () => release({ data: [line()] }))
  expect(host.querySelector('.rt-summary')).not.toBeNull()
})
