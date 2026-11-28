import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './PaieInteriors.css'

export const PAYROLL_HISTORY_RANGES = [1, 2, 3, 6, 8, 12]

export function payrollMonths(end, range = 6) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return []
  const date = new Date(`${end.slice(0, 7)}-01T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return []
  const monthCount = PAYROLL_HISTORY_RANGES.includes(Number(range)) ? Number(range) : 6
  return Array.from({ length: monthCount }, (_, i) => {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthCount + 1 + i, 1, 12))
    return { key: month.toISOString().slice(0, 7), label: month.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }), gross: 0, cost: 0, count: 0 }
  })
}
export function aggregatePayroll(slips, months, currency) {
  const values = months.map(month => ({ ...month }))
  for (const slip of slips) {
    if (slip.is_deleted || slip.currency !== currency) continue
    const month = values.find(item => item.key === slip.period_start?.slice(0, 7))
    if (!month) continue
    const gross = Number(slip.gross_salary), employer = Number(slip.employer_contributions)
    if (slip.gross_salary == null || slip.employer_contributions == null || String(slip.gross_salary).trim() === '' || String(slip.employer_contributions).trim() === '' || !Number.isFinite(gross) || !Number.isFinite(employer)) throw new Error('Un bulletin contient un montant incomplet. Vérifiez l’historique.')
    month.gross += gross; month.cost += gross + employer; month.count += 1
  }
  return values
}
export default function PaiePayrollChart({ enterpriseId, currency, end, revision = 0 }) {
  const [state, setState] = useState({ rows: [], loading: true, error: '' })
  const [metric, setMetric] = useState('gross')
  const [range, setRange] = useState(6)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function load() {
      setState({ rows: [], loading: true, error: '' })
      const months = payrollMonths(end, range)
      if (!enterpriseId || !currency || !months.length) { setState({ rows: [], loading: false, error: '' }); return }
      try {
        const last = new Date(`${months.at(-1).key}-01T12:00:00Z`)
        const next = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
        const slips = []
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('employee_payslips')
            .select('id,period_start,gross_salary,employer_contributions,currency,is_deleted')
            .eq('enterprise_id', enterpriseId).eq('currency', currency)
            .gte('period_start', `${months[0].key}-01`).lt('period_start', next)
            .or('is_deleted.is.null,is_deleted.eq.false').order('id').range(offset, offset + 499).abortSignal(controller.signal)
          if (error) throw error
          if (cancelled) return
          slips.push(...(data || []))
          if ((data || []).length < 500) break
        }
        if (!cancelled) setState({ rows: aggregatePayroll(slips, months, currency), loading: false, error: '' })
      } catch { if (!cancelled) setState({ rows: [], loading: false, error: 'Historique indisponible ou incomplet. Aucun total ne peut être affiché.' }) }
    }
    load()
    return () => { cancelled = true; controller.abort() }
  }, [enterpriseId, currency, end, range, revision, retry])
  const max = Math.max(1, ...state.rows.map(row => Math.abs(row[metric])))
  const total = state.rows.reduce((sum, row) => sum + row[metric], 0)
  const count = state.rows.reduce((sum, row) => sum + row.count, 0)
  const money = value => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currency || ''}`
  return <section className="pw-card pw-payroll-history" aria-label="Masse salariale enregistrée">
    <header><div><span className="pw-eyebrow">VUE EMPLOYEUR · HISTORIQUE</span><h3>Masse salariale</h3><p>{range} mois, d’après les bulletins enregistrés — pas les brouillons de calcul.</p></div><div className="pw-payroll-controls"><label>Période<select aria-label="Période de l’historique" value={range} onChange={e => setRange(Number(e.target.value))}>{PAYROLL_HISTORY_RANGES.map(months => <option key={months} value={months}>{months} mois</option>)}</select></label><label>Afficher<select aria-label="Montant affiché" value={metric} onChange={e => setMetric(e.target.value)}><option value="gross">Salaires bruts</option><option value="cost">Brut + cotisations patronales</option></select></label></div></header>
    {!currency ? <p>Définissez la devise de l’entreprise pour consulter sa masse salariale.</p> : state.loading ? <p role="status">Chargement de l’historique…</p> : state.error ? <p role="alert">{state.error} <button onClick={() => setRetry(n => n + 1)}>Réessayer</button></p> : !count ? <p>Aucun bulletin enregistré dans cette devise sur cette période. Le graphique se remplira après publication des fiches.</p> : <>
      <strong className="pw-payroll-total">{money(total)} <small>sur {range} mois affiché{range > 1 ? 's' : ''}</small></strong>
      <div className="pw-payroll-bars">{state.rows.map(row => <div key={row.key}><span>{row.count ? money(row[metric]) : '—'}</span><div className="pw-payroll-column" aria-hidden="true"><i style={{ height: row.count ? `${Math.abs(row[metric]) / max * 100}%` : 0 }}/></div><strong>{row.label}</strong><small>{row.count ? `${row.count} bulletin${row.count > 1 ? 's' : ''}` : 'Aucun bulletin'}</small></div>)}</div>
    </>}
    <details><summary>Comment lire ce graphique ?</summary><p>Chaque colonne additionne les salaires bruts des bulletins rattachés à ce mois par leur date de début de période. Le second affichage ajoute les cotisations patronales enregistrées. Ce n’est ni le net versé aux salariés, ni l’ensemble des dépenses de l’entreprise.</p><p>Seuls les bulletins non retirés de l’entreprise sélectionnée, enregistrés en {currency || 'devise définie'}, sont inclus. Un mois sans bulletin est inconnu, pas une masse salariale nulle. Les périodes longues sont entièrement rattachées à leur mois de début ; elles ne sont pas réparties entre les mois.</p></details>
  </section>
}
