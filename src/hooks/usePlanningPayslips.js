import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function indexPublishedPayslips(rows, employees) {
  const allowed = new Set(employees.map(e => `${e.enterprise_id}:${e.id}`))
  const index = new Map()
  for (const row of rows) {
    const key = `${row.enterprise_id}:${row.employee_id}`
    if (!allowed.has(key) || row.is_deleted || row.status !== 'sent' || !row.sent_at ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.period_start || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.period_end || '') || row.period_start > row.period_end) continue
    if (!index.has(key)) index.set(key, [])
    if (!index.get(key).some(slip => slip.id === row.id)) index.get(key).push(row)
  }
  return index
}
export function payslipsForDay(index, employee, date) {
  return (index.get(`${employee.enterprise_id}:${employee.id}`) || [])
    .filter(row => row.period_start <= date && row.period_end >= date)
}

// Metadata only: never fetch salary amounts into the planning grid.
export default function usePlanningPayslips(employees, dates) {
  const scope = JSON.stringify(employees.map(e => [e.enterprise_id, e.id]).filter(([id]) => id).sort())
  const start = dates[0], end = dates.at(-1)
  const key = `${scope}|${start}|${end}`
  const [state, setState] = useState({ key: '', rows: [], loading: false, error: '' })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(n => n + 1), [])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, 60000)
    return () => { window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer) }
  }, [refresh])
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const enterprises = [...new Set(JSON.parse(scope).map(([id]) => id))]
    async function load() {
      setState({ key, rows: [], loading: true, error: '' })
      if (!start || !end || !enterprises.length) { setState({ key, rows: [], loading: false, error: '' }); return }
      try {
        const rows = []
        for (const enterprise of enterprises) {
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from('employee_payslips')
              .select('id,enterprise_id,employee_id,period_start,period_end,status,sent_at,is_deleted')
              .eq('enterprise_id', enterprise).eq('status', 'sent').not('sent_at', 'is', null)
              .or('is_deleted.is.null,is_deleted.eq.false')
              .lte('period_start', end).gte('period_end', start)
              .order('id').range(offset, offset + 499).abortSignal(controller.signal)
            if (error) throw error
            if (cancelled) return
            rows.push(...(data || []))
            if ((data || []).length < 500) break
          }
        }
        if (!cancelled) setState({ key, rows, loading: false, error: '' })
      } catch { if (!cancelled) setState({ key, rows: [], loading: false, error: 'Statut des fiches de paie indisponible. Les billets ne peuvent pas être affichés.' }) }
    }
    load()
    return () => { cancelled = true; controller.abort() }
  }, [scope, start, end, key, revision])
  const index = useMemo(() => indexPublishedPayslips(state.key === key ? state.rows : [], employees), [state, key, employees])
  return { index, loading: state.key !== key || state.loading, error: state.key === key ? state.error : '', refresh }
}
