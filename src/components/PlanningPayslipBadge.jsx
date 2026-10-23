import './PlanningPayslipBadge.css'

export default function PlanningPayslipBadge({ entries }) {
  if (!entries.length) return null
  const label = entries.length === 1 ? 'Fiche de paie envoyée' : `${entries.length} salariés avec une fiche envoyée`
  return <details className="sk-payslip-badge" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    <summary aria-label={label} title={`${label} — voir les périodes couvertes`}>
      <svg viewBox="0 0 32 22" width="25" height="19" aria-hidden="true"><rect x="2" y="2" width="28" height="18" rx="3"/><path d="M8 5h16q0 3 3 3v6q-3 0-3 3H8q0-3-3-3V8q3 0 3-3Z"/><circle cx="16" cy="11" r="4"/><path d="m16 8 2 3-2 3-2-3Z"/></svg>
      <span className="sk-payslip-caption">{entries.length === 1 ? 'Fiche envoyée' : `${entries.length} salariés`}</span>
      <span className="sk-payslip-count" aria-hidden="true">{entries.length}</span>
    </summary>
    <div className="sk-payslip-info"><strong>Disponible dans l’espace salarié</strong>
      {entries.map(({ employee, slips }) => <div key={employee.id}><b>{employee.first_name} {employee.last_name}</b>{slips.map(s => <span key={s.id}>Période : {s.period_start.split('-').reverse().join('/')} — {s.period_end.split('-').reverse().join('/')}</span>)}</div>)}
      <p>Ce jour est couvert par une fiche envoyée. Cela ne prouve ni le paiement du salaire, ni un jour travaillé.</p>
    </div>
  </details>
}
