import { useMemo, useState } from 'react'
import { Users, UserCheck, TriangleAlert, FileText, ArrowRight, Upload, History } from 'lucide-react'
import { initialesDe as initiales } from '../utils/initiales'

export function statutProfil(profile) {
  if (!profile) return 'Profil incomplet'
  const field = { monthly: 'base_salary', hourly: 'hourly_rate', daily: 'daily_rate' }[profile.salary_type]
  return field && Number(profile[field]) > 0 ? 'Profil prêt' : 'À vérifier'
}
export function resumePreparation(employees, profiles) {
  const rows = employees.map(employee => {
    const profile = profiles.find(p => p.employee_id === employee.id)
    return { employee, profile, status: statutProfil(profile) }
  })
  return { rows, ready: rows.filter(r => r.status === 'Profil prêt').length, total: rows.length }
}
function Bars({ rows, monetary = false, currency }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return <>{rows.map(r => <div className="pw-bar-line" key={r.label}>
    <span>{r.label}</span><div className="pw-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(0, r.value) / max * 100}%`, background: r.color }}/></div>
    <strong>{r.value.toLocaleString('fr-FR', { maximumFractionDigits: monetary ? 0 : 0 })}{monetary ? ` ${currency || ''}` : ''}</strong>
  </div>)}</>
}
export default function PaiePreparation({ employees, profiles, previewRows, currency, start, end, setStart, setEnd, onHistory, onGenerate, onNavigate, onEmployee, generating, issues = [] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const { rows, ready, total } = useMemo(() => resumePreparation(employees, profiles), [employees, profiles])
  const visible = rows.filter(r => `${r.employee.first_name} ${r.employee.last_name}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')) && (filter === 'all' || (filter === 'ready' ? r.status === 'Profil prêt' : r.status !== 'Profil prêt')))
  const money = value => value == null ? '—' : `${Number(value).toLocaleString('fr-FR')} ${currency || ''}`
  const totals = previewRows.reduce((a, r) => ({ gross: a.gross + (Number(r.grossSalary) || 0), net: a.net + (Number(r.netSalary) || 0) }), { gross: 0, net: 0 })
  return <section aria-label="Préparation de la paie">
    <div className="pw-titlebar"><div><h2>Préparer la paie</h2><p>Profils, variables et vérifications avant le calcul</p></div>
      <div className="pw-period"><label>Début<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label><label>Fin<input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label><button className="paie-btn" onClick={onHistory}><History size={17}/> Historique</button></div>
    </div>
    <div className="pw-steps" aria-label="Parcours de paie">{['Préparation', 'Vérification', 'Calcul', 'Envoi'].map((s, i) => <span key={s} aria-current={i === (previewRows.length ? 2 : 0) ? 'step' : undefined}><b>{i + 1}</b>{s}</span>)}</div>
    <div className="pw-kpis">{[[Users, total, 'Salariés'], [UserCheck, ready, 'Profils prêts'], [TriangleAlert, total - ready, 'Profils à vérifier'], [FileText, previewRows.length, 'Bulletins calculés']].map(([Icon, value, label]) => <div className="pw-card pw-kpi" key={label}><Icon size={32}/><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className="pw-grid"><div>
      <div className="pw-card pw-table-card"><div className="pw-search"><h3>Salariés de la période</h3><input aria-label="Rechercher un salarié" placeholder="Rechercher un salarié…" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Filtrer les profils" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="ready">Profils prêts</option><option value="review">À vérifier</option></select></div>
        <div className="pw-table-scroll"><table className="pw-table"><thead><tr><th>Salarié</th><th>Base du profil</th><th>État du profil</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visible.map(({ employee: e, profile: p, status }) => <tr key={e.id}><td><div className="pw-person">{e.photo_url ? <img src={e.photo_url} alt="" loading="lazy"/> : <span>{initiales(e.first_name, e.last_name)}</span>}{e.first_name} {e.last_name}</div></td><td>{p ? money(p.salary_type === 'hourly' ? p.hourly_rate : p.salary_type === 'daily' ? p.daily_rate : p.base_salary) : '—'}{p?.salary_type === 'hourly' ? ' / h' : p?.salary_type === 'daily' ? ' / jour' : ''}</td><td><span className={`pw-status ${status === 'Profil prêt' ? 'ready' : ''}`}>● {status}</span></td><td><button aria-label={`Modifier le profil de ${e.first_name} ${e.last_name}`} onClick={() => onEmployee(e.id)}><ArrowRight size={18}/></button></td></tr>)}</tbody></table></div>
        <p className="pw-graph-note" style={{ padding: '0 20px' }}>{visible.length} salarié(s) affiché(s) sur {total}{total === 0 ? ' · Aucun salarié actif.' : ''}</p>
      </div>
    </div><aside className="pw-card pw-aside"><h3>Avant le calcul</h3><div className="pw-notice">{issues.length ? `${issues.length} point(s) à vérifier` : 'Aucune anomalie détectée par les contrôles disponibles'}</div><ul>{issues.slice(0, 4).map((issue, i) => <li key={i}>{issue.employee} — {issue.reason}</li>)}</ul><button className="paie-btn" onClick={() => { setFilter('review'); onNavigate('profiles') }}>Vérifier les profils</button><p>Un profil prêt ne garantit pas la conformité du bulletin. Vérifiez aussi les variables et les règles fiscales.</p><button className="paie-btn paie-btn-principal" onClick={onGenerate} disabled={generating || !total}>{generating ? 'Calcul en cours…' : 'Vérifier et calculer'}<ArrowRight size={17}/></button><button className="paie-btn" onClick={() => onNavigate('imports')}><Upload size={17}/>Importer les variables</button></aside></div>
    <div className="pw-graphs"><section className="pw-card" aria-label="Graphique de préparation"><h3>État des profils</h3><Bars rows={[{ label: 'Prêts', value: ready, color: 'var(--paie-emerald)' }, { label: 'À vérifier', value: total - ready, color: 'var(--paie-amber)' }]}/><p className="pw-graph-note">Mis à jour à partir des profils enregistrés de cette entreprise.</p></section><section className="pw-card" aria-label="Graphique des bulletins calculés"><h3>Brut et net calculés</h3>{previewRows.length ? <Bars monetary currency={currency} rows={[{ label: 'Brut', value: totals.gross }, { label: 'Net', value: totals.net, color: 'var(--paie-emerald)' }]}/> : <p className="pw-graph-note">Le graphique apparaîtra après le calcul des bulletins de la période. Aucun montant estimé n’est affiché.</p>}<p className="pw-graph-note">{previewRows.length} bulletin(s) · {start || '—'} → {end || '—'}</p></section></div>
  </section>
}
