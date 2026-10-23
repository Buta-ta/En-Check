import { overtimePeriod, csvCell } from './overtimePresentation'

// Calendar navigation and display only. Lateness remains computed by the SQL RPC.
export const retardDates = (date, mode) =>
  overtimePeriod(
    date,
    { jour: 'daily', semaine: 'weekly', mois: 'monthly' }[mode] || 'daily',
  )
export const retardSource = (source) =>
  ({
    personnalisé: 'Horaire personnalisé',
    planning: 'Planning',
    entreprise: 'Entreprise',
  })[source] || 'Source non précisée'
export const retardDuration = (minutes) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
export const retardDateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
export function shiftRetardDate(date, mode, delta) {
  const next = new Date(`${date}T12:00:00Z`)
  if (mode === 'mois') {
    next.setUTCDate(1)
    next.setUTCMonth(next.getUTCMonth() + delta)
  } else
    next.setUTCDate(next.getUTCDate() + delta * (mode === 'semaine' ? 7 : 1))
  return next.toISOString().slice(0, 10)
}
export function retardChart(retards, dates) {
  return dates.map((date) => ({
    date,
    label: retardDateLabel(date),
    count: retards.filter((r) => r.date === date).length,
  }))
}
export function retardsCSV(rows) {
  return (
    '\uFEFF' +
    [
      [
        'Date',
        'Matricule',
        'Prénom',
        'Nom',
        'Entreprise',
        'Heure prévue',
        'Arrivée',
        'Retard (min)',
        'Tolérance (min)',
        'Horaire appliqué',
      ],
      ...rows.map((r) => [
        r.date,
        r.employee.matricule,
        r.employee.first_name,
        r.employee.last_name,
        r.employee.enterprises?.name,
        r.heureArrivee,
        r.heurePointage,
        r.retardMinutes,
        r.tolerance,
        retardSource(r.sourceHoraire),
      ]),
    ]
      .map((row) => row.map(csvCell).join(';'))
      .join('\r\n')
  )
}
export async function allRetardRows(query) {
  const result = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.range(offset, offset + 499)
    if (error) throw error
    result.push(...(data || []))
    if (!data || data.length < 500) return result
  }
}
