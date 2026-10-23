import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  overtimePeriod,
  overtimeEmployees,
  overtimeChart,
  csvCell,
  loadOvertimeRows,
  overtimeWorkedSeconds,
} from '../../utils/overtimePresentation'
import OvertimeDashboard from '../../components/OvertimeDashboard'
import { culturalMotifForPath } from '../../components/PageCulturalBand'

const row = (id, dateStr, worked, overtime) => ({
  employee: { id, first_name: 'Amina', last_name: id },
  dateStr,
  totalSecondes: worked,
  overtime: {
    totalOvertimeSeconds: overtime,
    contractualSeconds: 28800,
    overtimeSeconds: overtime,
    rateApplied: 25,
  },
})
const rows = [
  row('a', '2026-10-01', 32400, 3600),
  row('a', '2026-10-08', 36000, 7200),
  row('b', '2026-10-08', 28800, 0),
]
describe('overtime periods and real-data presentation', () => {
  it('keeps the daily date', () =>
    expect(overtimePeriod('2026-10-23')).toEqual(['2026-10-23']))
  it('uses Monday through Sunday across years', () =>
    expect(overtimePeriod('2027-01-01', 'weekly')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]))
  it('includes leap day and every last day of month', () => {
    expect(overtimePeriod('2024-02-18', 'monthly')).toHaveLength(29)
    expect(overtimePeriod('2026-02-18', 'monthly')).toHaveLength(28)
    expect(overtimePeriod('2026-10-23', 'monthly').at(-1)).toBe('2026-10-31')
  })
  it('rejects an empty date', () => expect(overtimePeriod('')).toEqual([]))
  it('aggregates employees without duplicating headcount or losing daily rates', () => {
    const data = overtimeEmployees(rows)
    expect(data).toHaveLength(2)
    expect(data[0].worked).toBe(68400)
    expect(data[0].overtime).toBe(10800)
    expect(data[0].days).toHaveLength(2)
  })
  it('monthly chart accounts for every overtime second', () => {
    const chart = overtimeChart(
      rows,
      overtimePeriod('2026-10-23', 'monthly'),
      'monthly',
    )
    expect(chart).toHaveLength(5)
    expect(chart[0].seconds).toBe(3600)
    expect(chart[1].seconds).toBe(7200)
    expect(chart.reduce((n, r) => n + r.seconds, 0)).toBe(10800)
  })
  it('weekly chart preserves zero days', () => {
    const chart = overtimeChart(
      rows,
      overtimePeriod('2026-10-08', 'weekly'),
      'weekly',
    )
    expect(chart).toHaveLength(7)
    expect(chart.reduce((n, r) => n + r.seconds, 0)).toBe(7200)
  })
  it('daily chart excludes employees without overtime', () =>
    expect(overtimeChart(rows, [], 'daily')).toHaveLength(1))
  it('CSV escapes separators, quotes, newlines and spreadsheet formulas', () => {
    expect(csvCell('A,"B"\nC')).toBe('"A,""B""\nC"')
    expect(csvCell('=1+1')).toBe('"\'=1+1"')
  })
  it('loads all pages beyond the provider row cap', async () => {
    const query = {
      range: vi
        .fn()
        .mockResolvedValueOnce({ data: Array(500).fill({ id: 1 }) })
        .mockResolvedValueOnce({ data: [{ id: 2 }] }),
    }
    expect(await loadOvertimeRows(query)).toHaveLength(501)
    expect(query.range).toHaveBeenLastCalledWith(500, 999)
  })
  it('never presents partial results after an API error', async () => {
    const query = {
      range: vi
        .fn()
        .mockResolvedValueOnce({ data: Array(500).fill({}) })
        .mockResolvedValueOnce({ error: new Error('offline') }),
    }
    await expect(loadOvertimeRows(query)).rejects.toThrow('offline')
  })
  it('shares aso-oke with the assistant and ignores similar prefixes', () => {
    expect(culturalMotifForPath('/heures-supplementaires?date=2026')).toBe(
      'aso-oke',
    )
    expect(culturalMotifForPath('/heures-supplementaires-other')).toBe('kente')
  })
})
const props = {
  rows,
  dates: overtimePeriod('2026-10-23', 'monthly'),
  mode: 'monthly',
  selectedDate: '2026-10-23',
  enterprises: [],
  enterpriseId: 'all',
  isSuperAdmin: true,
  canEdit: true,
}
it('renders a real summary and collapsed daily detail, not demo numbers', () => {
  const html = renderToStaticMarkup(<OvertimeDashboard {...props} />)
  expect(html).toContain('Heures travaillées')
  expect(html).toContain('aria-pressed="true">Mois')
  expect(html).toContain('Seuil applicable')
  expect(html).not.toContain('1 248')
  expect(html).not.toContain(' open=')
  expect(html).toContain('Voir les taux et les jours')
})
it('hides stale metrics and details while loading or on error', () => {
  for (const state of [{ loading: true }, { error: 'Impossible de charger' }]) {
    const html = renderToStaticMarkup(
      <OvertimeDashboard {...props} {...state} />,
    )
    expect(html).not.toContain('Amina')
    expect(html).not.toContain('ot-stats')
    expect(html).toContain('disabled=""')
  }
})
it('uses explicit zero-data and no-overtime messages', () => {
  const html = renderToStaticMarkup(<OvertimeDashboard {...props} rows={[]} />)
  expect(html).toContain('Aucun pointage clôturé')
  expect(html).toContain('Aucune heure supplémentaire')
})

it('ignores open and overlong shifts, handles multiple completed sessions', () => {
  const att = (type, time) => ({ check_type: type, check_time: time })
  expect(
    overtimeWorkedSeconds([att('in', '2026-10-23T08:00:00Z')], '2026-10-23'),
  ).toBe(0)
  expect(
    overtimeWorkedSeconds(
      [att('in', '2026-10-23T01:00:00Z'), att('out', '2026-10-23T19:00:00Z')],
      '2026-10-23',
    ),
  ).toBe(0)
  expect(
    overtimeWorkedSeconds(
      [
        att('in', '2026-10-23T08:00:00Z'),
        att('out', '2026-10-23T12:00:00Z'),
        att('in', '2026-10-23T13:00:00Z'),
        att('out', '2026-10-23T17:00:00Z'),
      ],
      '2026-10-23',
    ),
  ).toBe(28800)
})
