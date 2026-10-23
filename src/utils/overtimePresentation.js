import { calculerDureeSecondes } from './timezoneUtils'

// Calendar periods only: each day's overtime still goes through FeatureService.
export function overtimePeriod(dateStr, mode = 'daily') {
  const start = new Date(`${dateStr}T12:00:00Z`)
  if (!Number.isFinite(start.getTime())) return []
  if (mode === 'weekly')
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  if (mode === 'monthly') start.setUTCDate(1)
  const month = start.getUTCMonth()
  const dates = []
  const count = mode === 'daily' ? 1 : mode === 'weekly' ? 7 : 31
  for (let i = 0; i < count; i++) {
    if (mode === 'monthly' && start.getUTCMonth() !== month) break
    dates.push(start.toISOString().slice(0, 10))
    start.setUTCDate(start.getUTCDate() + 1)
  }
  return dates
}

export function overtimeEmployees(rows) {
  const employees = new Map()
  for (const row of rows) {
    const id = row.employee.id
    if (!employees.has(id))
      employees.set(id, {
        employee: row.employee,
        worked: 0,
        overtime: 0,
        days: [],
      })
    const item = employees.get(id)
    item.worked += row.totalSecondes || 0
    item.overtime += row.overtime.totalOvertimeSeconds || 0
    item.days.push(row)
  }
  return [...employees.values()].sort((a, b) => b.overtime - a.overtime)
}

export function overtimeChart(rows, dates, mode) {
  if (mode === 'daily')
    return overtimeEmployees(rows)
      .filter((r) => r.overtime > 0)
      .slice(0, 8)
      .map((r) => ({
        label: `${r.employee.first_name || ''} ${r.employee.last_name || ''}`,
        seconds: r.overtime,
      }))
  const groups =
    mode === 'monthly'
      ? Array.from({ length: Math.ceil(dates.length / 7) }, (_, i) => ({
          label: `${i * 7 + 1}–${Math.min(dates.length, (i + 1) * 7)}`,
          seconds: 0,
        }))
      : dates.map((date) => ({
          label: date.slice(8) + '/' + date.slice(5, 7),
          seconds: 0,
        }))
  for (const row of rows) {
    const index = dates.indexOf(row.dateStr)
    if (index >= 0)
      groups[mode === 'monthly' ? Math.floor(index / 7) : index].seconds +=
        row.overtime.totalOvertimeSeconds || 0
  }
  return groups
}

export function csvCell(value) {
  const text = String(value ?? '')
  return (
    '"' +
    (/^[=+\-@\t\r]/.test(text) ? "'" : '') +
    text.replaceAll('"', '""') +
    '"'
  )
}

// Supabase caps responses: a monthly view must not silently omit later rows.
export async function loadOvertimeRows(query) {
  const rows = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

// Assign an overnight shift to its entry day; do not count it again the next day.
export function overtimeWorkedSeconds(attendances, dateStr) {
  let currentIn = null
  let total = 0
  for (const attendance of attendances) {
    if (attendance.check_type === 'in') {
      currentIn =
        attendance.check_time.slice(0, 10) === dateStr ? attendance : null
    } else if (attendance.check_type === 'out' && currentIn) {
      const hours =
        (new Date(attendance.check_time) - new Date(currentIn.check_time)) /
        3600000
      if (hours >= 0 && hours <= 16) {
        total += calculerDureeSecondes(
          currentIn.check_time,
          attendance.check_time,
        )
        currentIn = null
      }
    }
  }
  return total
}
