import RetardsEngraving from './RetardsEngraving'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  Users,
  Timer,
  CalendarDays,
  FileText,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Download,
  Settings,
  X,
  Trash2,
  Search,
} from 'lucide-react'
import PageCulturalBand from './PageCulturalBand'
import {
  retardChart,
  retardSource,
  retardDuration,
  retardDateLabel,
} from '../utils/retardsPresentation'

export function RetardsDialog({ title, darkMode, onClose, busy, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    const dialog = ref.current
    const previous = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previous
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`rt-page rt-dialog ${darkMode ? 'rt-dark' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return
        const items = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled),a[href],input:not(:disabled),summary,[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length)
        if (!items.length) {
          e.preventDefault()
          return
        }
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault()
          items.at(-1).focus()
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault()
          items[0].focus()
        }
      }}
    >
      <PageCulturalBand pathname="/retards" />
      <header className="rt-dialog-header">
        <h2>{title}</h2>
        <button aria-label="Fermer" disabled={busy} onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="rt-dialog-body">{children}</div>
      <PageCulturalBand pathname="/retards" placement="bottom" />
    </dialog>
  )
}

export function RetardsNavigation({ darkMode, onToggleTheme }) {
  return (
    <div className="rt-nav">
      <nav aria-label="Raccourcis Retards">
        {[
          [Clock, 'Pointages', '/pointages'],
          [CalendarDays, 'Planning', '/planning'],
          [Users, 'Employés', '/employes'],
          [FileText, 'Rapports', '/rapports'],
        ].map(([Icon, label, path]) => (
          <Link key={path} to={path}>
            <span className="rt-nav-coin">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span>{label}</span>
            <ChevronRight
              className="rt-nav-arrow"
              size={14}
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
      <button
        onClick={onToggleTheme}
        aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        {darkMode ? 'Mode clair' : 'Mode sombre'}
      </button>
    </div>
  )
}

export function RetardsHelp() {
  return (
    <section className="rt-panel rt-help">
      <div className="rt-help-heading">
        <div>
          <span className="rt-eyebrow">LES REPÈRES</span>
          <h2>Le temps, expliqué.</h2>
        </div>
        <RetardsEngraving />
      </div>
      <ol>
        <li>
          <strong>Le rendez-vous</strong>
          <span>L’heure attendue par le planning.</span>
        </li>
        <li>
          <strong>L’arrivée</strong>
          <span>Le pointage réellement enregistré.</span>
        </li>
        <li>
          <strong>La différence</strong>
          <span>L’écart comparé à la tolérance.</span>
        </li>
      </ol>
      <details>
        <summary>Voir un exemple</summary>
        <p>
          Exemple illustratif : une arrivée à 08:12 pour 08:00 donne un écart de
          12 min. Avec une tolérance de 10 min, cet écart est retenu comme
          retard. Ce ne sont pas nécessairement les règles de votre entreprise.
        </p>
      </details>
      <details>
        <summary>Comprendre la tolérance</summary>
        <p>
          Le moteur retient un retard lorsque l’écart dépasse la tolérance du
          planning applicable. La durée affichée reste l’écart complet, sans
          soustraire la tolérance.
        </p>
        <p>
          Sans planning applicable, aucun jugement de ponctualité n’est fait.
          Les jours fériés non travaillés sont exclus.
        </p>
      </details>
    </section>
  )
}

export function RetardsContent({
  retards,
  stats,
  dates,
  mode,
  filters,
  onDelete,
  onExport,
  onRules,
  busy,
  search,
  setSearch,
}) {
  const [page, setPage] = useState(0)
  const filtered = retards.filter((r) =>
    `${r.employee.first_name || ''} ${r.employee.last_name || ''} ${r.employee.matricule || ''} ${r.employee.enterprises?.name || ''}`
      .toLocaleLowerCase('fr')
      .includes(search.trim().toLocaleLowerCase('fr')),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * 8, currentPage * 8 + 8)
  const chart = retardChart(retards, dates)
  const maxCount = Math.max(1, ...chart.map((r) => r.count))
  return (
    <>
      <div className="rt-title-row">
        <div>
          <span className="rt-eyebrow">LE CARNET DE PONCTUALITÉ</span>
          <h1>
            Retards
            <span className="rt-title-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p>Chaque arrivée, replacée dans son contexte.</p>
        </div>
        <div className="rt-actions">
          <button
            disabled={!filtered.length || busy}
            onClick={() => onExport(filtered)}
          >
            <Download size={16} />
            Exporter
          </button>
          <button onClick={onRules}>
            <Settings size={16} />
            Règles & tolérance
          </button>
        </div>
      </div>
      {filters}
      <section className="rt-summary" aria-label="Résumé de la période">
        {[
          [
            Timer,
            stats.totalRetards,
            stats.totalRetards === 1 ? 'Retard constaté' : 'Retards constatés',
          ],
          [
            Users,
            stats.employesEnRetard,
            stats.employesEnRetard === 1
              ? 'Employé concerné'
              : 'Employés concernés',
          ],
          [Clock, retardDuration(stats.totalMinutesRetard), 'Écart cumulé'],
        ].map(([Icon, value, label], index) => (
          <div key={label} className="rt-metric">
            <span className="rt-metric-index" aria-hidden="true">
              0{index + 1}
            </span>
            <span className="rt-summary-icon">
              <Icon size={19} />
            </span>
            <div className="rt-metric-copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </section>
      {stats.employesSansPlanningIgnores > 0 && (
        <details className="rt-exclusions">
          <summary>
            {stats.employesSansPlanningIgnores} employé(s) sans planning
            applicable : hors évaluation
          </summary>
          <p>
            Aucune conclusion de ponctualité n’est tirée pour ces employés. Le
            nombre peut recouper des employés évalués sur d’autres jours de la
            période.
          </p>
        </details>
      )}
      <div className="rt-grid">
        <section className="rt-panel rt-arrivals">
          <div className="rt-list-heading">
            <div>
              <span className="rt-eyebrow">LES FICHES HORAIRES</span>
              <h2>Chaque arrivée raconte un horaire.</h2>
              <p>Les faits d’abord. Le contexte, au clic.</p>
            </div>
            <label className="rt-search">
              <Search size={16} />
              <input
                aria-label="Rechercher un employé"
                value={search}
                placeholder="Nom ou matricule"
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
              />
            </label>
          </div>

          {!visible.length && (
            <p className="rt-empty">
              {retards.length
                ? 'Aucun résultat pour cette recherche.'
                : 'Aucun retard constaté sur cette période parmi les journées évaluées.'}
            </p>
          )}
          {visible.map((r) => (
            <details
              className="rt-arrival"
              key={`${r.employee.id}-${r.date}-${r.id || ''}`}
            >
              <summary>
                <div className="rt-person">
                  <span className="rt-avatar">
                    {r.employee.first_name?.[0]}
                    {r.employee.last_name?.[0]}
                  </span>
                  <span>
                    <strong>
                      {r.employee.first_name} {r.employee.last_name}
                    </strong>
                    <small>
                      {retardDateLabel(r.date)}
                      <span className="rt-source-tag">
                        {retardSource(r.sourceHoraire)}
                      </span>
                    </small>
                  </span>
                  <ChevronRight className="rt-expand" size={18} />
                </div>
                <div className="rt-time-ticket">
                  <div className="rt-time-stop">
                    <span>Heure prévue</span>
                    <strong>{r.heureArrivee || '—'}</strong>
                    <small>Le rendez-vous</small>
                  </div>
                  <div className="rt-ticket-bridge">
                    <span className="rt-ticket-line" aria-hidden="true" />
                    <strong className="rt-delay">
                      +{retardDuration(r.retardMinutes)}
                    </strong>
                    <small>Écart constaté</small>
                  </div>
                  <div className="rt-time-stop rt-time-actual">
                    <span>Arrivée réelle</span>
                    <strong>{r.heurePointage || '—'}</strong>
                    <small>Le pointage</small>
                  </div>
                </div>
                <div className="rt-ticket-footer">
                  <span>
                    <Clock size={12} aria-hidden="true" /> Tolérance :{' '}
                    {r.tolerance} min
                  </span>
                  <span className="rt-ticket-open">
                    Voir le contexte{' '}
                    <ChevronRight size={13} aria-hidden="true" />
                  </span>
                </div>
              </summary>
              <div className="rt-arrival-detail">
                <dl>
                  <div>
                    <dt>Entreprise</dt>
                    <dd>{r.employee.enterprises?.name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Matricule</dt>
                    <dd>{r.employee.matricule || '—'}</dd>
                  </div>
                  <div>
                    <dt>Tolérance appliquée</dt>
                    <dd>{r.tolerance} min</dd>
                  </div>
                  <div>
                    <dt>Horaire appliqué</dt>
                    <dd>{retardSource(r.sourceHoraire)}</dd>
                  </div>
                </dl>
                <p>
                  Écart fourni par le moteur de calcul du planning pour cette
                  journée.
                </p>
                {r.id && (
                  <button
                    className="rt-danger"
                    disabled={busy}
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 size={15} />
                    Supprimer le pointage source…
                  </button>
                )}
              </div>
            </details>
          ))}
          <footer className="rt-pagination">
            <span>
              {filtered.length === 1
                ? '1 fiche horaire'
                : `${visible.length} fiches sur ${filtered.length}`}
              {search && ` · ${retards.length} sur la période`}
            </span>
            {pageCount > 1 && (
              <div>
                <button
                  aria-label="Page précédente"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {currentPage + 1} / {pageCount}
                </span>
                <button
                  aria-label="Page suivante"
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </footer>
        </section>
        <aside>
          <RetardsHelp />
          <section
            className={`rt-panel rt-chart ${mode === 'jour' ? 'rt-day-chart' : ''}`}
          >
            <h2>
              {mode === 'semaine'
                ? 'La semaine en un regard'
                : mode === 'mois'
                  ? 'Le mois en un regard'
                  : 'L’empreinte du jour'}
            </h2>
            {mode === 'jour' ? (
              <div className="rt-day-summary">
                <div className="rt-day-seal">
                  <span className="rt-day-seal-ring" aria-hidden="true" />
                  <strong>{stats.totalRetards}</strong>
                  <span>
                    {stats.totalRetards === 1
                      ? 'retard constaté'
                      : 'retards constatés'}
                  </span>
                </div>
                <div className="rt-day-caption">
                  <span>{retardDateLabel(dates[0])}</span>
                  <p>
                    <strong>{retardDuration(stats.totalMinutesRetard)}</strong>{' '}
                    d’écart cumulé
                  </p>
                  <small>Sur les journées évaluées, sans estimation.</small>
                </div>
              </div>
            ) : (
              <>
                <p>Nombre de retards par jour · période entière</p>
                <div
                  className="rt-chart-scroll"
                  tabIndex={0}
                  aria-label="Graphique des retards par jour"
                >
                  <div
                    className="rt-bars"
                    style={{
                      minWidth:
                        dates.length > 7 ? dates.length * 38 : undefined,
                    }}
                  >
                    {chart.map((day) => (
                      <div className="rt-bar-column" key={day.date}>
                        <b>{day.count}</b>
                        <div className="rt-bar-track">
                          <span
                            style={{
                              height: `${(day.count / maxCount) * 100}%`,
                            }}
                          />
                        </div>
                        <span>{day.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
