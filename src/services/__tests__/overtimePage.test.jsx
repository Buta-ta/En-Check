// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import HeuresSupplementaires from '../../pages/HeuresSupplementaires'

const mocks = vi.hoisted(() => ({
  calculate: vi.fn(),
  save: vi.fn(),
  fail: false,
}))
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false }),
}))
vi.mock('../../components/PageHeader', () => ({ default: () => null }))
vi.mock('../holidayService', () => ({
  default: { isHoliday: async () => null },
}))
vi.mock('../featureService', () => ({
  FEATURES: { HEURES_SUPPLEMENTAIRES: 'overtime' },
  default: {
    hasFeature: async () => true,
    getOvertimeSettings: async () => ({
      rate_normal: 25,
      rate_major: 50,
      overtime_major_after_hours: 2,
    }),
    loadSchedules: async () => [],
    calculateOvertimeForEmployeeDay: mocks.calculate,
    saveOvertimeSettings: mocks.save,
  },
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        gte: () => query,
        lte: () => query,
        order: () => query,
        range: async () => ({
          error: mocks.fail ? new Error('offline') : null,
          data:
            table === 'employees'
              ? [
                  {
                    id: 'a',
                    enterprise_id: 'ent',
                    first_name: 'Amina',
                    last_name: 'D.',
                  },
                ]
              : table === 'attendances'
                ? [
                    {
                      employee_id: 'a',
                      check_type: 'in',
                      check_time: '2026-10-22T22:00:00Z',
                    },
                    {
                      employee_id: 'a',
                      check_type: 'out',
                      check_time: '2026-10-23T07:00:00Z',
                    },
                    {
                      employee_id: 'a',
                      check_type: 'in',
                      check_time: '2026-10-23T09:00:00Z',
                    },
                    {
                      employee_id: 'a',
                      check_type: 'out',
                      check_time: '2026-10-23T18:00:00Z',
                    },
                  ]
                : [],
        }),
      }
      return query
    },
  },
}))
let root, host
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.fail = false
  mocks.calculate.mockReset().mockImplementation(({ totalWorkedSeconds }) => ({
    contractualSeconds: 28800,
    totalOvertimeSeconds: Math.max(0, totalWorkedSeconds - 28800),
    overtimeSeconds: Math.max(0, totalWorkedSeconds - 28800),
    rateApplied: 25,
  }))
  mocks.save.mockReset().mockResolvedValue(true)
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
  vi.restoreAllMocks()
  vi.useRealTimers()
})
async function mount() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HeuresSupplementaires />
      </MemoryRouter>,
    ),
  )
}
async function click(text) {
  const button = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  )
  expect(button).toBeTruthy()
  await act(async () => button.click())
}
it('uses the engine separately for every day of the month and aggregates overnight work once', async () => {
  await mount()
  mocks.calculate.mockClear()
  await click('Mois')
  const calls = mocks.calculate.mock.calls.map(([arg]) => arg)
  expect(calls).toHaveLength(31)
  expect(calls.find((c) => c.dateStr === '2026-10-22').totalWorkedSeconds).toBe(
    32400,
  )
  expect(calls.find((c) => c.dateStr === '2026-10-23').totalWorkedSeconds).toBe(
    32400,
  )
  expect(host.querySelectorAll('.ot-employee')).toHaveLength(1)
  expect(host.querySelector('.ot-stats').textContent).toContain('18h')
  expect(host.querySelector('.ot-stats').textContent).toContain('2h')
})
it('preserves draft on save failure and makes the rules explanations collapsible', async () => {
  await mount()
  await click('Règles de calcul')
  expect(host.querySelector('dialog[open]')).toBeTruthy()
  expect(host.querySelectorAll('dialog .ec-cultural-band')).toHaveLength(2)
  expect(host.querySelectorAll('dialog .ot-rules-section')).toHaveLength(3)
  expect(
    host
      .querySelectorAll('.ot-rules-section')[2]
      .querySelector('#ot-rate_sunday'),
  ).toBeTruthy()
  expect(host.querySelector('dialog details[open]')).toBeNull()
  expect(host.querySelector('label[for="ot-rate_normal"]')).toBeTruthy()
  mocks.save.mockRejectedValueOnce(new Error('offline'))
  await click('Sauvegarder')
  expect(host.querySelector('dialog[open]')).toBeTruthy()
  expect(
    [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Sauvegarder',
    ).disabled,
  ).toBe(false)
  await click('Sauvegarder')
  expect(host.querySelector('dialog')).toBeNull()
})
it('does not turn query errors into a zero-hours result and supports retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.fail = true
  await mount()
  expect(host.querySelector('[role="alert"]').textContent).toContain(
    'Impossible de charger',
  )
  expect(host.querySelector('.ot-stats')).toBeNull()
  mocks.fail = false
  await click('Réessayer')
  expect(host.querySelector('[role="alert"]')).toBeNull()
  expect(host.querySelector('.ot-stats')).toBeTruthy()
})
