import EmployeeProfilePhoto from './EmployeeProfilePhoto'
import PageCulturalBand from './PageCulturalBand'
import {
  OvertimeCalculationGuide,
  OvertimeLoadingScreen,
} from './OvertimeExperience'
import { useState, useRef, useEffect } from 'react'
import {
  Clock,
  Users,
  Timer,
  Search,
  SearchX,
  CalendarClock,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
} from 'lucide-react'
import { overtimeEmployees, overtimeChart } from '../utils/overtimePresentation'
import { formaterDureeComplete } from '../utils/timezoneUtils'

const duration = (seconds) => formaterDureeComplete(seconds || 0)

/*  Le tiroir ne connaît plus le thème : il ne PEUT pas le connaître. Sa feuille
    est la feuille de la page, qui lit les jetons de la maison, et `[data-theme]`
    les retourne déjà à la racine. Le prop `darkMode` était le deuxième circuit —
    celui par lequel `.ot-dark` survivait. */
export function OvertimeRulesDrawer({ children, onClose, busy }) {
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
      className="ot-page ot-drawer"
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
      <PageCulturalBand pathname="/heures-supplementaires" placement="top" />
      {children}
      <PageCulturalBand pathname="/heures-supplementaires" placement="bottom" />
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
  /*  UN AVIS, PAS UN MESSAGE D'ERREUR. Deux boutons de cet écran savaient déjà
        se rendre indisponibles (`disabled`) et c'est exactement ce que le
        fondateur a signalé le 27/11 : « les boutons Exporter CSV et Règles de
        calcul ne sont pas fonctionnels ». Ils l'étaient : le clic était avalé
        sans un mot. Un bouton inerte n'apprend rien ; ici il reste VIVANT et il
        répond — le motif est écrit, la raison aussi, et le focus part vers la
        commande qui débloque. Le `disabled` ne garde que sa justification
        légitime : ce qui est en train d'arriver (chargement, erreur réseau). */
  const [avis, setAvis] = useState(null)
  const selecteur = (id) => document.getElementById(id)
  const viser = (id) => {
    selecteur(id)?.focus()
  }
  /*  l'avis meurt avec la situation qui l'a fait naître : changer de période,
        d'entreprise ou de vue le rend faux, donc il part. */
  useEffect(() => setAvis(null), [enterpriseId, selectedDate, mode])
  const exporter = () => {
    if (!rows.length) {
      setAvis({
        motif: 'Rien à exporter',
        raison:
          'Aucun pointage clôturé sur la période affichée : le fichier n’aurait que ses colonnes.',
      })
      viser('ot-filtre-date')
      return
    }
    setAvis(null)
    onExport()
  }
  const regles = () => {
    /*  Le refus ne vaut que là où le sélecteur existe : un admin d'une seule
        entreprise n'a jamais « Toutes » à déselectionner — son entreprise est
        collée à son compte. Le refuser là serait envoyer un clic vers un champ
        que l'écran ne montre pas. */
    if (enterpriseId === 'all' && isSuperAdmin) {
      setAvis({
        motif: 'Une entreprise à la fois',
        raison:
          'Les seuils et les taux s’enregistrent par entreprise : choisissez-en une, puis rouvrez ces réglages.',
      })
      viser('ot-filtre-entreprise')
      return
    }
    setAvis(null)
    onSettings()
  }
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
          {/*  LES DEUX BOUTONS DE L'ÉCRAN sont au CONTOUR du kit, pas à sa
                PLEINE : la charte ne donne qu'une pleine par écran — « la seule
                action principale » — et ici l'action principale est à
                l'intérieur du tiroir (Sauvegarder). Deux pleines côte à côte
                voulaient dire deux fois « clique-moi en premier ». */}
          <button
            className="ch-btn-contour"
            disabled={loading || !!error}
            onClick={exporter}
          >
            <Download size={17} aria-hidden="true" />
            Exporter CSV
          </button>
          {canEdit && (
            <button className="ch-btn-contour" onClick={regles}>
              <Settings size={17} aria-hidden="true" />
              Règles de calcul
            </button>
          )}
          {avis && (
            <p className="ot-controle-indisponible ot-avis" role="status">
              <strong className="ot-controle-mot">{avis.motif}</strong>
              <span>{avis.raison}</span>
            </p>
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
              id="ot-filtre-entreprise"
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
            <button
              className="ch-btn-contour ot-carre"
              aria-label="Période précédente"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <input
              id="ot-filtre-date"
              aria-label="Date de référence"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))
                  setDate(e.target.value)
              }}
            />
            <button
              className="ch-btn-contour ot-carre"
              aria-label="Période suivante"
              onClick={() => shift(1)}
            >
              <ChevronRight size={18} aria-hidden="true" />
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
        <OvertimeLoadingScreen />
      ) : error ? (
        <div className="ot-state" role="alert">
          <p>{error}</p>
          {/*  l'erreur réseau est le seul écran où « Réessayer » EST l'action
                principale : c'est là, et nulle part ailleurs, que la pleine du
                kit se pose sur cette page. */}
          <button className="ch-btn-pleine" onClick={retry}>
            Réessayer
          </button>
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
                /*  L'ÉTAT VIDE DU GRAPHE. Avant : une phrase de 11 px perdue
                      dans les 205 px du trou. Un trou n'explique rien — et ici
                      le silence veut dire deux choses opposées : « personne n'a
                      pointé » ou « tout le monde est resté sous le seuil ». La
                      page sait lequel, elle le dit, avec le nombre qu'elle a
                      déjà calculé. Le bloc garde la cote du graphe (le trou ne
                      bouge pas d'un pixel quand les données arrivent) et prend
                      la figure du lavis + règle d'encre, PAS une carte cerclée
                      dans une carte cerclée. */
                <div className="ot-vide ot-vide-creux" role="status">
                  <span className="ot-coin">
                    <Inbox size={20} aria-hidden="true" />
                  </span>
                  <div className="ot-vide-texte">
                    <p className="ot-vide-titre">
                      Aucune heure supplémentaire sur cette période.
                    </p>
                    <p className="ot-vide-cause">
                      <strong className="ot-vide-nombre">
                        {duration(totalWorked)}
                      </strong>{' '}
                      travaillées sur{' '}
                      <strong className="ot-vide-nombre">{dates.length}</strong>{' '}
                      journée{dates.length > 1 ? 's' : ''} examinée
                      {dates.length > 1 ? 's' : ''} · aucune ne dépasse le seuil
                      du planning.
                    </p>
                  </div>
                </div>
              )}
            </section>
            <OvertimeCalculationGuide />
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
            {visible.length > 0 && (
              <div className="ot-table-head" aria-hidden="true">
                <span>Employé</span>
                <span>Heures travaillées</span>
                <span>Heures supplémentaires</span>
                <span>Majoration / détail</span>
              </div>
            )}
            {/*  LES DEUX VIDES DE LA LISTE ne sont pas le même fait, et ils ne
                    se lisent plus de la même façon : « personne n'a pointé »
                    mène à la période, « aucun nom ne correspond » mène à la
                    recherche. Le geste est donc DIFFÉRENT sous chaque phrase —
                    c'est ça, l'UI d'un état vide : une cause et une sortie, pas
                    un adjectif de plus. Les deux chiffres viennent des données
                    déjà chargées, rien n'est simulé. */}
            {!visible.length && (
              <div className="ot-vide" role="status">
                <span className="ot-coin">
                  {employees.length ? (
                    <SearchX size={20} aria-hidden="true" />
                  ) : (
                    <CalendarClock size={20} aria-hidden="true" />
                  )}
                </span>
                <div className="ot-vide-texte">
                  <p className="ot-vide-titre">
                    {employees.length
                      ? 'Aucun employé ne correspond à la recherche.'
                      : 'Aucun pointage clôturé sur cette période.'}
                  </p>
                  <p className="ot-vide-cause">
                    {employees.length ? (
                      <>
                        <strong className="ot-vide-nombre">
                          {employees.length}
                        </strong>{' '}
                        employé{employees.length > 1 ? 's' : ''} ont des heures
                        sur la période · le filtre lit le nom et le matricule.
                      </>
                    ) : (
                      <>
                        {dates.length > 1
                          ? `Du ${dates[0]} au ${dates.at(-1)}`
                          : `Journée du ${selectedDate}`}{' '}
                        ·{' '}
                        <strong className="ot-vide-nombre">
                          {dates.length}
                        </strong>{' '}
                        journée{dates.length > 1 ? 's' : ''} examinée
                        {dates.length > 1 ? 's' : ''} · seuls les couples entrée
                        et sortie clôturés comptent.
                      </>
                    )}
                  </p>
                  <div className="ot-vide-gestes">
                    {employees.length ? (
                      <button
                        className="ch-btn-contour"
                        onClick={() => setSearch('')}
                      >
                        Effacer la recherche
                      </button>
                    ) : (
                      <button
                        className="ch-btn-contour"
                        onClick={() => shift(-1)}
                      >
                        Période précédente
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {visible.map((r) => (
              <details key={r.employee.id} className="ot-employee">
                <summary>
                  <span className="ot-person">
                    <EmployeeProfilePhoto
                      employee={r.employee}
                      className="ot-avatar"
                    />
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
