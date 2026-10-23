import { useState, useRef, useEffect } from 'react'
import {
  Clock,
  Users,
  Timer,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
} from 'lucide-react'
import { overtimeEmployees, overtimeChart } from '../utils/overtimePresentation'
import { formaterDureeComplete } from '../utils/timezoneUtils'

const duration = (seconds) => formaterDureeComplete(seconds || 0)

export function OvertimeRulesDrawer({ children, onClose, darkMode, busy }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
      dialog.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`ot-page ot-drawer ${darkMode ? 'ot-dark' : ''}`}
      aria-label="Règles de calcul des heures supplémentaires"
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return
        const items = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
          ),
        ].filter((item) => item.getClientRects().length > 0)
        const first = items[0]
        const last = items.at(-1)
        if (!first) {
          e.preventDefault()
          return
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      {children}
    </dialog>
  )
}

export default function OvertimeDashboard({
  rows,
  dates,
  mode,
  setMode,
  selectedDate,
  setDate,
  loading,
  error,
  retry,
  enterprises,
  enterpriseId,
  setEnterprise,
  isSuperAdmin,
  canEdit,
  onSettings,
  onExport,
}) {
  const [search, setSearch] = useState('')
  const employees = overtimeEmployees(rows)
  const visible = employees.filter(({ employee: e }) =>
    `${e.first_name} ${e.last_name} ${e.matricule || ''}`
      .toLocaleLowerCase('fr')
      .includes(search.toLocaleLowerCase('fr')),
  )
  const chart = overtimeChart(rows, dates, mode)
  const max = Math.max(1, ...chart.map((r) => r.seconds))
  const totalWorked = employees.reduce((sum, r) => sum + r.worked, 0)
  const totalOvertime = employees.reduce((sum, r) => sum + r.overtime, 0)
  const shift = (direction) => {
    const date = new Date(`${selectedDate}T12:00:00Z`)
    if (mode === 'monthly') {
      date.setUTCDate(1)
      date.setUTCMonth(date.getUTCMonth() + direction)
    } else
      date.setUTCDate(
        date.getUTCDate() + direction * (mode === 'weekly' ? 7 : 1),
      )
    setDate(date.toISOString().slice(0, 10))
  }
  return (
    <>
      <header className="ot-heading">
        <div>
          <h1>Heures supplémentaires</h1>
          <p>Comprendre les dépassements, maîtriser les majorations.</p>
        </div>
        <div className="ot-actions">
          <button
            disabled={loading || !!error || !rows.length}
            onClick={onExport}
          >
            <Download size={17} />
            Exporter CSV
          </button>
          {canEdit && (
            <button
              onClick={onSettings}
              disabled={enterpriseId === 'all' && isSuperAdmin}
            >
              <Settings size={17} />
              Règles de calcul
            </button>
          )}
        </div>
      </header>
      <section
        className="ot-filters"
        aria-label="Filtres des heures supplémentaires"
      >
        {isSuperAdmin && (
          <label>
            Entreprise
            <select
              value={enterpriseId}
              onChange={(e) => setEnterprise(e.target.value)}
            >
              <option value="all">Toutes les entreprises</option>
              {enterprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div>
          <span className="ot-label">Période</span>
          <div className="ot-period">
            <button aria-label="Période précédente" onClick={() => shift(-1)}>
              <ChevronLeft size={18} />
            </button>
            <input
              aria-label="Date de référence"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))
                  setDate(e.target.value)
              }}
            />
            <button aria-label="Période suivante" onClick={() => shift(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div>
          <span className="ot-label">Vue</span>
          <div
            className="ot-segments"
            role="group"
            aria-label="Durée de la période"
          >
            {[
              ['daily', 'Jour'],
              ['weekly', 'Semaine'],
              ['monthly', 'Mois'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <p className="ot-period-caption">
        {dates.length > 1
          ? `Du ${dates[0]} au ${dates.at(-1)} · calcul jour par jour`
          : `Journée du ${selectedDate}`}{' '}
        · seuls les temps de pointage clôturés sont comptés.
      </p>
      {loading ? (
        <div className="ot-state" role="status">
          <Timer size={32} />
          <p>Chargement des pointages et calcul des heures…</p>
        </div>
      ) : error ? (
        <div className="ot-state" role="alert">
          <p>{error}</p>
          <button onClick={retry}>Réessayer</button>
        </div>
      ) : (
        <>
          <section className="ot-stats" aria-label="Résumé de la période">
            {[
              [Clock, 'Heures travaillées', duration(totalWorked)],
              [Timer, 'Heures supplémentaires', duration(totalOvertime)],
              [
                Users,
                'Employés concernés',
                employees.filter((r) => r.overtime > 0).length,
              ],
            ].map(([Icon, label, value]) => (
              <article key={label}>
                <span className="ot-coin">
                  <Icon size={25} />
                </span>
                <div>
                  <p>{label}</p>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </section>
          <div className="ot-insights">
            <section className="ot-panel">
              <h2>Répartition des heures supplémentaires</h2>
              <p className="ot-muted">
                {mode === 'daily'
                  ? 'Par employé · les 8 plus grands dépassements'
                  : mode === 'monthly'
                    ? 'Par tranches de 7 jours du mois'
                    : 'Par jour de la semaine'}
              </p>
              {totalOvertime > 0 ? (
                <div
                  className="ot-chart"
                  aria-label="Heures supplémentaires en durée"
                >
                  <div className="ot-bars">
                    {chart.map((bar, i) => (
                      <div className="ot-bar-column" key={i}>
                        <span>{duration(bar.seconds)}</span>
                        <div className="ot-bar-track">
                          <div
                            className="ot-bar"
                            style={{ height: `${(bar.seconds / max) * 100}%` }}
                          />
                        </div>
                        <span title={bar.label}>{bar.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ot-chart-empty">
                  Aucune heure supplémentaire sur cette période.
                </div>
              )}
            </section>
            <section className="ot-panel ot-help">
              <h2>Comprendre le calcul</h2>
              <div>
                <span className="ot-coin ot-clock">
                  <Clock size={48} />
                </span>
                <p>
                  Les dépassements dépendent du planning et des seuils
                  configurés.
                </p>
              </div>
              <details>
                <summary>Voir un exemple</summary>
                <p>
                  Pour un seuil applicable de 8 h, une journée de 9 h donne 1 h
                  supplémentaire. Le taux dépend des règles de l’entreprise, du
                  jour et des paliers.
                </p>
                <p>
                  Les jours fériés et weekends peuvent avoir des règles
                  spécifiques. Ces durées ne constituent pas une confirmation de
                  paiement.
                </p>
              </details>
            </section>
          </div>
          <section className="ot-panel ot-list">
            <div className="ot-list-heading">
              <h2>
                Détail par employé <small>({visible.length})</small>
              </h2>
              <label className="ot-search">
                <Search size={17} />
                <input
                  aria-label="Rechercher un employé"
                  placeholder="Rechercher un employé"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="ot-table-head" aria-hidden="true">
              <span>Employé</span>
              <span>Heures travaillées</span>
              <span>Heures supplémentaires</span>
              <span>Majoration / détail</span>
            </div>
            {!visible.length && (
              <p className="ot-state">
                {employees.length
                  ? 'Aucun employé ne correspond à la recherche.'
                  : 'Aucun pointage clôturé sur cette période.'}
              </p>
            )}
            {visible.map((r) => (
              <details key={r.employee.id} className="ot-employee">
                <summary>
                  <span className="ot-person">
                    <span className="ot-avatar">
                      {r.employee.first_name?.[0]}
                      {r.employee.last_name?.[0]}
                    </span>
                    <span>
                      {r.employee.first_name} {r.employee.last_name}
                      <small>
                        {r.employee.matricule}{' '}
                        {isSuperAdmin && r.employee.enterprises?.name}
                      </small>
                    </span>
                  </span>
                  <span>
                    <small className="ot-mobile-label">Travaillé</small>
                    {duration(r.worked)}
                  </span>
                  <strong>
                    <small className="ot-mobile-label">Heures sup.</small>
                    {duration(r.overtime)}
                  </strong>
                  <span className="ot-see">Voir les taux et les jours</span>
                </summary>
                <div className="ot-days">
                  {r.days.map((day) => (
                    <article key={day.dateStr}>
                      <h3>
                        {day.dateStr}
                        {day.isHoliday
                          ? ` · ${day.holidayName || 'Jour férié'}`
                          : ''}
                      </h3>
                      <dl>
                        <div>
                          <dt>Travaillé</dt>
                          <dd>{duration(day.totalSecondes)}</dd>
                        </div>
                        <div>
                          <dt>Seuil applicable</dt>
                          <dd>{duration(day.overtime.contractualSeconds)}</dd>
                        </div>
                        <div>
                          <dt>
                            Heures sup. · {day.overtime.rateApplied ?? 0} %
                          </dt>
                          <dd>{duration(day.overtime.overtimeSeconds)}</dd>
                        </div>
                        <div>
                          <dt>
                            Palier majoré · {day.overtime.rateMajorApplied ?? 0}{' '}
                            %
                          </dt>
                          <dd>{duration(day.overtime.overtimeMajorSeconds)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </section>
        </>
      )}
    </>
  )
}
