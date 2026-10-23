import { useMemo, useState } from 'react'
import { Users, UserCheck, TriangleAlert, FileText, ArrowRight, Upload, History, Search, Check, SlidersHorizontal, ChartNoAxesCombined, CircleHelp, CalendarDays } from 'lucide-react'
import { initialesDe as initiales } from '../utils/initiales'
import PaieCoin from './PaieCoin'

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
export function grouperControles(issues) {
  const groups = new Map()
  issues.forEach(issue => {
    const key = issue.employeeId || issue.employee
    if (!groups.has(key)) groups.set(key, { key, name: issue.employee, reasons: [] })
    groups.get(key).reasons.push(issue.reason)
  })
  return [...groups.values()]
}
function Bars({ rows, currency }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return <div className="pw-money-bars">{rows.map(r => <div className="pw-money-row" key={r.label}>
    <div><span>{r.label}</span><strong>{r.value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <small>{currency || 'Devise non définie'}</small></strong></div>
    <div className="pw-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(0, r.value) / max * 100}%`, background: r.color }}/></div>
  </div>)}</div>
}
function formatPeriod(start, end) {
  const format = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : '—'
  return `${format(start)} — ${format(end)}`
}
export default function PaiePreparation({ employees, profiles, previewRows, currency, start, end, setStart, setEnd, onHistory, onGenerate, onNavigate, onEmployee, generating, issues = [] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const { rows, ready, total } = useMemo(() => resumePreparation(employees, profiles), [employees, profiles])
  const groups = useMemo(() => grouperControles(issues), [issues])
  const visible = rows.filter(r => `${r.employee.first_name} ${r.employee.last_name}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')) && (filter === 'all' || (filter === 'ready' ? r.status === 'Profil prêt' : r.status !== 'Profil prêt')))
  const money = value => value == null ? '—' : `${Number(value).toLocaleString('fr-FR')} ${currency || ''}`
  const totals = previewRows.reduce((a, r) => ({ gross: a.gross + (Number(r.grossSalary) || 0), net: a.net + (Number(r.netSalary) || 0) }), { gross: 0, net: 0 })
  const readyPercent = total ? Math.round(ready / total * 100) : 0
  return <section aria-label="Préparation de la paie">
    <div className="pw-titlebar">
      <div><span className="pw-eyebrow">ESPACE BULLETINS</span><h2>Préparer la paie</h2><p>Une préparation soignée, des bulletins maîtrisés.</p></div>
      <div className="pw-period">
        <div className="pw-date-range"><CalendarDays size={18} aria-hidden="true"/><label>Du<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label><span aria-hidden="true">—</span><label>Au<input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
        <button className="paie-btn pw-history" onClick={onHistory}><History size={18}/><span>Historique</span></button>
      </div>
    </div>
    <div className="pw-steps" aria-label="Parcours de paie">{['Préparation', 'Vérification', 'Calcul', 'Envoi'].map((s, i) => <span key={s} aria-current={i === (previewRows.length ? 2 : 0) ? 'step' : undefined}><b>{i + 1}</b>{s}</span>)}</div>
    <div className="pw-kpis">{[[Users, total, 'Salariés'], [UserCheck, ready, 'Profils prêts'], [TriangleAlert, total - ready, 'Profils à vérifier'], [FileText, previewRows.length, 'Bulletins calculés']].map(([Icon, value, label], i) => <div className="pw-card pw-kpi" key={label}><PaieCoin variant={i}><Icon size={22}/></PaieCoin><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className="pw-grid">
      <div className="pw-card pw-table-card">
        <div className="pw-search"><div className="pw-table-heading"><h3>Salariés de la période</h3><span className="pw-count" aria-live="polite">{visible.length} / {total}</span></div>
          <label className="pw-search-field"><Search size={16}/><input aria-label="Rechercher un salarié" placeholder="Nom, prénom…" value={search} onChange={e => setSearch(e.target.value)}/></label>
          <label className="pw-filter-field"><SlidersHorizontal size={16}/><select aria-label="Filtrer les profils" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="ready">Profils prêts</option><option value="review">À vérifier</option></select></label>
        </div>
        <div className="pw-table-scroll"><table className="pw-table"><thead><tr><th>Salarié</th><th>Base du profil</th><th>État du profil</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visible.map(({ employee: e, profile: p, status }) => <tr key={e.id}>
          <td><div className="pw-person">{e.photo_url ? <img src={e.photo_url} alt="" loading="lazy"/> : <span>{initiales(e.first_name, e.last_name)}</span>}{e.first_name} {e.last_name}</div></td>
          <td>{p ? money(p.salary_type === 'hourly' ? p.hourly_rate : p.salary_type === 'daily' ? p.daily_rate : p.base_salary) : '—'}{p?.salary_type === 'hourly' ? ' / h' : p?.salary_type === 'daily' ? ' / jour' : ''}</td>
          <td><span className={`pw-status ${status === 'Profil prêt' ? 'ready' : ''}`}>{status === 'Profil prêt' ? <Check size={13}/> : <TriangleAlert size={13}/>} {status}</span></td>
          <td><button aria-label={`Modifier le profil de ${e.first_name} ${e.last_name}`} onClick={() => onEmployee(e.id)}><ArrowRight size={18}/></button></td>
        </tr>)}</tbody></table></div>
        {!visible.length && <div className="pw-table-empty"><Search size={24}/><strong>{total ? 'Aucun salarié ne correspond' : 'Aucun salarié actif'}</strong><span>{total ? 'Modifiez votre recherche ou le filtre de statut.' : 'Les salariés actifs apparaîtront ici.'}</span></div>}
        <div className="pw-table-footer"><span><Users size={14}/><strong>{visible.length}</strong> sur {total} {total === 1 ? 'salarié' : 'salariés'}</span><span>Entreprise sélectionnée · Profils enregistrés</span></div>
      </div>
      <aside className="pw-card pw-aside">
        <div className="pw-review-heading"><span className="pw-review-icon"><SlidersHorizontal size={21}/></span><div><span className="pw-eyebrow">CONTRÔLE DE PRÉPARATION</span><h3>Avant le calcul</h3></div></div>
        <div className={`pw-review-summary ${issues.length ? '' : 'is-clear'}`} role="status"><strong>{issues.length}</strong><div>{issues.length ? 'points à vérifier' : 'point à vérifier'}<small>{groups.length ? `${groups.length} ${groups.length === 1 ? 'salarié concerné' : 'salariés concernés'}` : 'Contrôles disponibles effectués'}</small></div>{issues.length ? <TriangleAlert size={22}/> : <Check size={22}/>}</div>
        <div className="pw-issues">{groups.map(group => <div className="pw-issue-person" key={group.key}><span className="pw-issue-dot" aria-hidden="true"/><div><h4>{group.name}</h4><ul>{group.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div></div>)}</div>
        {issues.length > 0 && <button className="pw-text-action" onClick={() => onNavigate('profiles')}>Vérifier les profils <ArrowRight size={15}/></button>}
        <details className="pw-review-help"><summary><CircleHelp size={15}/>Comprendre ces contrôles</summary><p>Un profil prêt concerne sa base salariale. Vérifiez aussi les variables et les règles fiscales. Le numéro social et la date d’embauche se complètent dans la fiche Employé.</p></details>
        <div className="pw-review-actions"><button className="paie-btn paie-btn-principal" onClick={onGenerate} disabled={generating || !total}><FileText size={17}/><span>{generating ? 'Calcul en cours…' : 'Vérifier et calculer'}</span><ArrowRight size={17}/></button><button className="paie-btn pw-import-btn" onClick={() => onNavigate('imports')}><Upload size={17}/><span>Importer les variables</span></button></div>
      </aside>
    </div>
    <div className="pw-graphs">
      <section className="pw-card pw-profile-chart" aria-label="Graphique de préparation">
        <div className="pw-chart-heading"><div><span className="pw-eyebrow">PRÉPARATION</span><h3>État des profils</h3></div><span className="pw-chart-tag">{total} salariés</span></div>
        <div className="pw-readiness-layout"><div className="pw-readiness-ring" style={{ '--readiness': `${readyPercent}%` }} aria-hidden="true"><div><strong>{total ? `${readyPercent}%` : '—'}</strong><span>profils prêts</span></div></div>
          <div className="pw-chart-legend"><div><span><i className="is-ready"/>Prêts</span><strong>{ready}</strong></div><div><span><i className="is-review"/>À vérifier</span><strong>{total - ready}</strong></div><p>{total ? `${ready} profil${ready > 1 ? 's' : ''} sur ${total} avec une base salariale renseignée.` : 'Aucun profil à analyser.'}</p></div>
        </div><footer className="pw-chart-footer"><UserCheck size={14}/>Données des profils enregistrés</footer>
      </section>
      <section className="pw-card pw-pay-chart" aria-label="Graphique des bulletins calculés">
        <div className="pw-chart-heading"><div><span className="pw-eyebrow">RÉSULTATS DE LA PÉRIODE</span><h3>Brut et net calculés</h3></div><span className="pw-chart-tag">{previewRows.length ? `${previewRows.length} calculés` : 'En attente'}</span></div>
        {previewRows.length ? <Bars currency={currency} rows={[{ label: 'Brut', value: totals.gross }, { label: 'Net', value: totals.net, color: 'var(--paie-emerald)' }]}/> : <div className="pw-chart-empty"><span className="pw-empty-emblem"><ChartNoAxesCombined size={30}/></span><div><strong>Votre prochaine vue d’ensemble</strong><p>Le graphique apparaîtra après le calcul des bulletins. Seuls les montants calculés seront affichés.</p></div></div>}
        <details className="pw-chart-explanation"><summary>Que représentent ces deux barres ?</summary><p><strong>Brut</strong> = somme des salaires bruts des {previewRows.length} bulletins calculés pour cette période. <strong>Net</strong> = somme de leurs montants nets à verser, après les déductions calculées.</p><p>Exemple illustratif : deux bulletins de 100 000 et 150 000 bruts donnent une barre « Brut » de 250 000. Si leurs nets sont 90 000 et 130 000, la barre « Net » vaut 220 000.</p><p>La longueur de chaque barre est proportionnelle à son montant, avec la plus grande à 100 %. Ce n’est pas un taux d’impôt. Avant le calcul, « 0 bulletin » signifie qu’aucun résultat n’est disponible, pas que la masse salariale est nulle. Changer les dates efface le calcul précédent. Ces résultats ne deviennent des fiches consultables par les salariés qu’après leur envoi.</p></details>
        <footer className="pw-chart-footer"><CalendarDays size={14}/><span>{formatPeriod(start, end)}</span><strong>{previewRows.length} bulletin{previewRows.length > 1 ? 's' : ''}</strong></footer>
      </section>
    </div>
  </section>
}
