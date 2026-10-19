import { chargerSeuilsPointage } from './seuilsPointage'

// A review candidate, NOT a presumed exit or proof of physical presence.
// Current-day raw badge semantics are retained; thresholds come from the shared loader.
export async function findMissingExitEntries(attendances, { enterpriseId, now = Date.now(), loadThresholds = chargerSeuilsPointage } = {}) {
  const latest = new Map()
  for (const row of attendances || []) {
    const enterprise = row.enterprise_id || enterpriseId
    const t = Date.parse(row.check_time)
    if (!enterprise || !row.employee_id || !Number.isFinite(t)) continue
    const key = `${enterprise}:${row.employee_id}`
    const before = latest.get(key)
    if (!before || t > before.t || (t === before.t && String(row.id) > String(before.row.id))) {
      latest.set(key, { t, type: String(row.check_type || '').toLowerCase(), row, enterprise })
    }
  }
  const settings = new Map(await Promise.all([...new Set([...latest.values()].map(d => d.enterprise))]
    .map(async enterprise => [enterprise, await loadThresholds(enterprise)])))
  return [...latest.values()].filter(d => {
    const hours = Number(settings.get(d.enterprise)?.oubliSortieHeures)
    return d.type === 'in' && Number.isFinite(hours) && hours > 0 && now - d.t >= hours * 3600000
  })
}
