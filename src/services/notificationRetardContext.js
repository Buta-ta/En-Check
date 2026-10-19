// Read-only. Disabled/missing modules and inactive schedules never establish lateness.
export async function loadNotificationRetardContext(client, candidates = []) {
  const ids = [...new Set(candidates.map(e => e.enterprise_id).filter(Boolean))]
  const empty = { employees: [], employeeSchedulesMap: {}, defaultScheduleByEnterprise: {}, timezones: {} }
  if (!ids.length) return empty
  const { data: companies, error } = await client.from('enterprises')
    .select('id,timezone').in('id', ids).eq('module_planning', true).eq('module_retards', true)
  if (error) throw error
  const enabled = new Set((companies || []).map(e => e.id))
  const employees = candidates.filter(e => enabled.has(e.enterprise_id))
  if (!employees.length) return empty
  const employeeIds = employees.map(e => e.id)
  const companyIds = [...enabled]
  const { data: assignments, error: assignmentError } = await client.from('employee_schedules')
    .select('id,employee_id,use_custom_hours,custom_start_time,schedule_id,is_active')
    .in('employee_id', employeeIds).eq('is_active', true).order('id', { ascending: true })
  if (assignmentError) throw assignmentError
  const { data: schedules, error: scheduleError } = await client.from('work_schedules')
    .select('id,enterprise_id,start_time,late_tolerance_minutes,is_default,is_active')
    .in('enterprise_id', companyIds).eq('is_active', true).order('id', { ascending: true })
  if (scheduleError) throw scheduleError
  const byId = Object.fromEntries((schedules || []).map(s => [s.id, s]))
  const employeeSchedulesMap = {}
  // Ambiguous active assignments are not arbitrarily picked: exclude that employee.
  const grouped = new Map()
  for (const a of assignments || []) grouped.set(a.employee_id, [...(grouped.get(a.employee_id) || []), a])
  const ambiguous = new Set()
  for (const [id, rows] of grouped) {
    if (rows.length !== 1) { ambiguous.add(id); continue }
    const row = rows[0]
    const enterprise = employees.find(e => e.id === id)?.enterprise_id
    const linked = byId[row.schedule_id]
    employeeSchedulesMap[id] = { ...row, work_schedule: linked?.enterprise_id === enterprise ? linked : null }
  }
  const defaultScheduleByEnterprise = {}
  for (const enterprise of companyIds) {
    const defaults = (schedules || []).filter(s => s.enterprise_id === enterprise && s.is_default === true)
    if (defaults.length === 1) defaultScheduleByEnterprise[enterprise] = defaults[0]
  }
  return { employees: employees.filter(e => !ambiguous.has(e.id)), employeeSchedulesMap, defaultScheduleByEnterprise,
    timezones: Object.fromEntries((companies || []).map(e => [e.id, e.timezone])) }
}
