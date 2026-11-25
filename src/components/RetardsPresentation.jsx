/* ═══════════════════════════════════════════════════════════════════════
   RETARDS — « LE REGISTRE DU JOUR », la direction A retenue le 27/11.

   La question que la page pose est : QUI DOIS-JE RELANCER, AUJOURD'HUI ?
   Tout part de ce geste. Une fiche par retard, dans l'ordre d'arrivée ;
   le rail des jours situe la période ; la marge porte l'empreinte du jour
   et ce que dit la règle ; un seul objet attire l'œil — l'écart le plus
   fort, cerclé et soulevé. Le reste baisse d'un ton.

   Les jetons de la charte, les trois tailles, les rayons du kit. Aucune
   couleur en dur : les valeurs passent par `--charte-*` et par des
   variables locales de gabarit (`--rt-p`), de sorte que la feuille de
   style ne peigne rien que la charte ne nomme.
   ═══════════════════════════════════════════════════════════════════════ */

import EmployeeProfilePhoto from './EmployeeProfilePhoto'
import RetardsEngraving from './RetardsEngraving'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Clock,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  Settings,
  X,
  Trash2,
  Search,
  AlertTriangle,
} from 'lucide-react'
import PageCulturalBand from './PageCulturalBand'
import EnCheckBrandMark from './EnCheckBrandMark'
import {
  retardChart,
  retardDates,
  retardSource,
  retardDuration,
  retardDateLabel,
} from '../utils/retardsPresentation'

const MOIS_LONGS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

/* Le nombre de fiches par page — il ne dépend plus de la hauteur d'écran :
   la pagination est une décision de lecture, pas de place. */
const PAR_PAGE = 8

/* ═══ LES FENÊTRES — le cadre n'a pas changé, la peau si ═══ */
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

/* ═══ LE BANDEAU — la maquette A ═══
   Une seule ligne, tout au même niveau : le rond du retour, la marque, le
   titre, puis la période à droite. Rien d'autre.

   Trois choses ont quitté cette barre (décision du 25/11) :
   · les raccourcis Pointages / Planning / Employés / Rapports — le rail du
     tableau de bord fait déjà ce voyage, une page n'a pas à se refaire menu ;
   · le bouton clair / sombre — le thème est un choix de l'application, pas
     d'une page ;
   · la bande de motif posée AU-DESSUS — elle ne disparaît pas pour autant :
     elle fait maintenant le TOUR du bandeau (voir `rt-cadre`).

   Formes RONDES ou en PILULE uniquement : le retour est un rond de 36 px,
   jamais un carré (correction du 25/11 : « arrête de proposer une forme
   carrée »). Le titre ne se répète pas : celui de la barre sombre est parti,
   il n'en reste qu'un, ici. */
export function RetardsBandeau() {
  const navigate = useNavigate()
  return (
    <header className="rt-bandeau">
      <button
        type="button"
        className="rt-retour"
        onClick={() => navigate('/dashboard')}
        title="Retour au tableau de bord"
        aria-label="Retour au tableau de bord"
      >
        <ArrowLeft size={17} aria-hidden="true" />
      </button>

      <span className="rt-marque" aria-hidden="true">
        <EnCheckBrandMark size={34} />
      </span>

      <div className="rt-bandeau-titre">
        <h1>Retards</h1>
        <p>Le registre du jour</p>
      </div>
    </header>
  )
}

/* Les commandes de période, posées dans la ligne du bandeau, à droite :
   la case date et la pilule Jour / Semaine / Mois. */
export function RetardsPeriode({
  selectedDate,
  onDate,
  onShift,
  mode,
  onMode,
  dates,
}) {
  return (
    <div className="rt-bandeau-periode">
      <span className="rt-eyebrow">Période</span>
      {/* une journée à la fois : les flèches sont le geste le plus courant */}
      <div className="rt-date">
        <button type="button" aria-label="Période précédente" onClick={() => onShift(-1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onDate(event.target.value)}
          aria-label="Journée de référence"
        />
        <button type="button" aria-label="Période suivante" onClick={() => onShift(1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="rt-segments" role="tablist" aria-label="Période affichée">
        {[
          ['jour', 'Jour'],
          ['semaine', 'Semaine'],
          ['mois', 'Mois'],
        ].map(([cle, label]) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={mode === cle}
            className={mode === cle ? 'is-actif' : undefined}
            onClick={() => onMode(cle)}
          >
            {label}
          </button>
        ))}
      </div>
      {dates.length > 1 && (
        <span className="rt-bandeau-jours">
          {dates.length} journées évaluées
        </span>
      )}
    </div>
  )
}

/* ═══ LES REPÈRES — le même texte, mis en page comme la marge de la
   maquette : trois repères numérotés, puis les deux explications pliées.
   Rien n'est retiré, rien n'est ajouté. ═══ */
export function RetardsHelp({ compact = false }) {
  return (
    <section className={`rt-help${compact ? ' rt-help--marge' : ''}`}>
      <div className="rt-help-heading">
        <div>
          <span className="rt-eyebrow">Les repères</span>
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

/* ═══ LE BILLET HORAIRE : prévu → écart → réel ═══
   C'est la pièce centrale de la fiche. Les trois valeurs sont posées sur
   une même ligne de base, reliées par un trait : on lit le trajet d'un
   regard, pas trois chiffres séparés. */
function BilletHoraire({ prevu, reel, minutes }) {
  return (
    <div className="rt-time-ticket">
      <div className="rt-time-stop">
        <span>Heure prévue</span>
        <strong>{prevu || '—'}</strong>
      </div>
      <div className="rt-ticket-bridge">
        <span className="rt-ticket-line" aria-hidden="true" />
        <strong className="rt-delay">+{retardDuration(minutes)}</strong>
      </div>
      <div className="rt-time-stop rt-time-actual">
        <span>Arrivée réelle</span>
        <strong>{reel || '—'}</strong>
      </div>
    </div>
  )
}

/* ═══ LA FICHE ═══
   `<details>` : le fait est toujours visible, le contexte s'ouvre au clic.
   La fiche au plus fort écart reçoit `is-focus` — une seule par page. */
function Fiche({ retard, focus }) {
  const { employee } = retard
  return (
    <details className={`rt-arrival${focus ? ' is-focus' : ''}`}>
      <summary>
        <div className="rt-person">
          <EmployeeProfilePhoto employee={employee} className="rt-avatar" />
          <span className="rt-person-copie">
            <strong>
              {employee.first_name} {employee.last_name}
            </strong>
            <small>
              {employee.matricule || '—'}
              <span className="rt-source-tag">
                {retardSource(retard.sourceHoraire)}
              </span>
            </small>
          </span>
        </div>
        <BilletHoraire
          prevu={retard.heureArrivee}
          reel={retard.heurePointage}
          minutes={retard.retardMinutes}
        />
        <div className="rt-ticket-footer">
          <span>
            <Clock size={12} aria-hidden="true" /> Tolérance :{' '}
            {retard.tolerance} min
            {focus && (
              <b className="rt-focus-seal">Le pire écart de la journée</b>
            )}
          </span>
          <span className="rt-ticket-open">
            Voir le contexte <ChevronDown size={13} aria-hidden="true" />
          </span>
        </div>
      </summary>
      <div className="rt-arrival-detail">
        <dl>
          <div>
            <dt>Date</dt>
            <dd>{retardDateLabel(retard.date)}</dd>
          </div>
          <div>
            <dt>Entreprise</dt>
            <dd>{employee.enterprises?.name || '—'}</dd>
          </div>
          <div>
            <dt>Matricule</dt>
            <dd>{employee.matricule || '—'}</dd>
          </div>
          <div>
            <dt>Tolérance appliquée</dt>
            <dd>{retard.tolerance} min</dd>
          </div>
          <div>
            <dt>Horaire appliqué</dt>
            <dd>{retardSource(retard.sourceHoraire)}</dd>
          </div>
        </dl>
        <p>
          Écart fourni par le moteur de calcul du planning pour cette journée.
        </p>
        {retard.id && (
          <button
            className="rt-danger"
            onClick={(e) => {
              e.preventDefault()
              retard.onDelete(retard)
            }}
          >
            <Trash2 size={15} />
            Supprimer le pointage source…
          </button>
        )}
      </div>
    </details>
  )
}

/* ═══ LE CHOIX DU MOIS ═══
   Le titre du rail (« NOV. ») se clique : il ouvre un panneau de douze mois
   et de l'année, et choisir y amène directement. C'est un panneau maison, pas
   un `<select>` : dans une colonne de 64 px, le sélecteur natif du système
   déborde et prend la couleur du système, pas la nôtre.

   Trois choses qu'il doit faire, et qu'on ne voit qu'à l'usage :
   · il se pose AU-DESSUS du rail (z-index), sinon la molette le recouvre ;
   · Échap le ferme, et un clic ailleurs aussi — sans quoi il reste ouvert
     au-dessus des fiches et on ne sait plus le refermer ;
   · les mois s'écrivent en toutes lettres : « nov. » est déjà dans le titre,
     un panneau de douze abréviations se lit mal. */
function SelecteurMois({ mois, annee, dateCourante, onChoisir }) {
  const [ouvert, setOuvert] = useState(false)
  const ancre = useRef(null)
  const [anneeVue, setAnneeVue] = useState(Number(annee))
  const moisCourant = Number(dateCourante.slice(5, 7)) - 1

  useEffect(() => {
    if (!ouvert) return
    setAnneeVue(Number(annee))
    const fermer = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && ancre.current?.contains(event.target))
        return
      setOuvert(false)
    }
    document.addEventListener('keydown', fermer)
    document.addEventListener('pointerdown', fermer)
    return () => {
      document.removeEventListener('keydown', fermer)
      document.removeEventListener('pointerdown', fermer)
    }
  }, [ouvert, annee])

  const choisir = (indexMois) => {
    const valeur = `${anneeVue}-${String(indexMois + 1).padStart(2, '0')}-01`
    setOuvert(false)
    onChoisir(valeur)
  }

  return (
    <div className="rt-choix-mois" ref={ancre}>
      <button
        type="button"
        className="rt-rail-titre rt-choix-mois-bouton"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={`Choisir le mois — ${mois} ${annee}`}
        onClick={() => setOuvert((v) => !v)}
      >
        {mois}
        <ChevronDown size={11} aria-hidden="true" />
      </button>

      {ouvert && (
        <div
          className="rt-choix-mois-panneau"
          role="dialog"
          aria-label="Choisir un mois et une année"
        >
          <div className="rt-choix-mois-annee">
            <button
              type="button"
              aria-label="Année précédente"
              onClick={() => setAnneeVue((a) => a - 1)}
            >
              <ChevronLeft size={13} aria-hidden="true" />
            </button>
            <b>{anneeVue}</b>
            <button
              type="button"
              aria-label="Année suivante"
              onClick={() => setAnneeVue((a) => a + 1)}
            >
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
          <div className="rt-choix-mois-grille">
            {MOIS_LONGS.map((nom, index) => {
              const actif =
                anneeVue === Number(annee) && index === moisCourant
              return (
                <button
                  key={nom}
                  type="button"
                  className={actif ? 'is-actif' : undefined}
                  aria-current={actif ? 'date' : undefined}
                  aria-label={`${nom} ${anneeVue}`}
                  onClick={() => choisir(index)}
                >
                  {nom}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ LE RAIL DES JOURS — la molette ═══
   Toute la période est là, pas neuf jours figés : la colonne défile (à la
   molette, au doigt, aux flèches du clavier) et CHAQUE JOUR SE CLIQUE pour
   changer de journée sans quitter la page. Un jour qui porte des retards est
   souligné et porte son compte ; le jour choisi est plein et amené dans la
   vue. Le bandeau du mois ne défile pas avec elle : il reste en tête.

   En vue du jour — une seule journée chargée — le rail montre la semaine qui
   contient le jour choisi, pour situer le jour dans la période. */
function RailDesJours({ dates, retards, selectedDate, onSelect, mode, onSauter }) {
  const liste = useRef(null)
  const jours = useMemo(() => {
    if (dates && dates.length > 1) return dates
    const ancre = selectedDate || dates?.[0]
    return ancre ? retardDates(ancre, 'semaine') : []
  }, [dates, selectedDate])

  /* Amener le jour choisi dans la vue de la molette, sans secouer la page :
     la colonne défile en silence, c'est elle qu'on règle, pas l'écran. Un
     `block: 'nearest'` ne bouge rien quand le jour est déjà visible. */
  useEffect(() => {
    const actif = liste.current?.querySelector('.is-actif')
    actif?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [selectedDate, jours.length])

  if (!jours.length) return null

  const compte = new Map()
  for (const r of retards) compte.set(r.date, (compte.get(r.date) || 0) + 1)
  const mois = new Date(`${jours[0]}T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'short',
    timeZone: 'UTC',
  })
  const annee = jours[0].slice(0, 4)
  const saut = typeof onSauter === 'function'

  /* la molette s'ouvre sur le jour choisi, pas au premier jour du mois :
     sinon, en mode mois, on arrive sur un mois qu'on ne voit pas entièrement
     et il faut chercher où l'on est. */
  return (
    <nav className="rt-rail" aria-label="Jours de la période">
      {saut ? (
        <SelecteurMois
          mois={mois}
          annee={annee}
          dateCourante={jours[0]}
          onChoisir={(valeur) => onSauter(valeur)}
        />
      ) : (
        <span className="rt-rail-titre">{mois}</span>
      )}
      <div className="rt-rail-liste" role="list" ref={liste}>
        {jours.map((date) => {
          const n = compte.get(date) || 0
          const actif = date === selectedDate
          return (
            <button
              key={date}
              type="button"
              role="listitem"
              className={`rt-rail-jour${actif ? ' is-actif' : ''}${n ? ' a-des-retards' : ''}`}
              aria-current={actif ? 'date' : undefined}
              aria-label={`${retardDateLabel(date)}${n ? `, ${n} retard${n > 1 ? 's' : ''}` : ', aucun retard'}`}
              onClick={() => onSelect(date)}
            >
              <span className="rt-rail-num">{Number(date.slice(8, 10))}</span>
              {n ? <i aria-hidden="true">{n}</i> : null}
            </button>
          )
        })}
      </div>
      <span className="rt-rail-note">{jours.length} j.</span>
    </nav>
  )
}

/* ═══ LA MARGE : l'empreinte du jour, puis la règle ═══ */
function Marge({ stats, mode, dates, onRules, retards }) {
  /* Le rappel de règle ne dit QUE ce que les données disent : la
     tolérance la plus fréquente, le nombre de règles distinctes, et les
     employés sans planning. Rien qui ne soit calculable. */
  const tolerances = new Map()
  for (const r of retards) tolerances.set(r.tolerance, (tolerances.get(r.tolerance) || 0) + 1)
  const seuils = [...tolerances.entries()].sort((a, b) => b[1] - a[1])
  const principal = seuils[0]
  const sansPlanning = stats.employesSansPlanningIgnores || 0
  const jours = [...new Set(retards.map((r) => r.date))].length
  const moyenne = stats.totalRetards
    ? Math.round(stats.totalMinutesRetard / stats.totalRetards)
    : 0

  return (
    <aside className="rt-marge">
      <section className="rt-marge-carte rt-empreinte">
        <span className="rt-eyebrow">L’empreinte du jour</span>
        <div className="rt-day-seal">
          <span className="rt-day-seal-ring" aria-hidden="true" />
          <strong>{stats.totalRetards}</strong>
          <span>
            {stats.totalRetards === 1 ? 'retard' : 'retards'}
          </span>
        </div>
        <div className="rt-empreinte-date">
          {mode === 'jour'
            ? retardDateLabel(dates[0])
            : `${dates.length} jour${dates.length > 1 ? 's' : ''} évalué${dates.length > 1 ? 's' : ''}`}
        </div>
        <p className="rt-empreinte-cumul">
          <strong>{retardDuration(stats.totalMinutesRetard)}</strong> d’écart
          cumulé
        </p>
        <p className="rt-empreinte-note">
          {stats.totalRetards
            ? `${jours} jour${jours > 1 ? 's' : ''} avec retard · ${retardDuration(moyenne)} en moyenne`
            : 'Sur les journées évaluées, sans estimation.'}
        </p>
      </section>

      <section className="rt-marge-carte rt-marge-regle">
        <span className="rt-eyebrow">Ce que dit la règle</span>
        <ul>
          <li>
            {principal
              ? `${retardDuration(principal[0])} de tolérance sur ${principal[1]} fiche${principal[1] > 1 ? 's' : ''}.`
              : 'Aucune tolérance à afficher sur cette période.'}
          </li>
          {seuils.length > 1 && (
            <li>
              {seuils.length} tolérances différentes s’appliquent : chaque
              fiche porte la sienne.
            </li>
          )}
          <li>
            Le retard se compte sur l’<b>heure prévue</b>, jamais sur une
            moyenne.
          </li>
          {sansPlanning > 0 && (
            <li>
              {sansPlanning} employé{sansPlanning > 1 ? 's' : ''} sans planning
              applicable : <b>hors évaluation</b>.
            </li>
          )}
        </ul>
        <div className="rt-marge-pied">
          <button type="button" className="rt-marge-lien" onClick={onRules}>
            Voir la règle
          </button>
          <span className="rt-marge-source">Source unique</span>
        </div>
      </section>

      {mode !== 'jour' && <ChartCarte stats={stats} retards={retards} dates={dates} mode={mode} />}
    </aside>
  )
}

/* ═══ LA RÉPARTITION — elle ne s'affiche qu'en semaine et en mois : en
   jour, elle n'aurait qu'une barre, et une barre seule ne dit rien. ═══ */
function ChartCarte({ retards, dates, mode }) {
  const chart = retardChart(retards, dates)
  const maxCount = Math.max(1, ...chart.map((r) => r.count))
  return (
    <section className="rt-marge-carte rt-chart">
      <span className="rt-eyebrow">La répartition</span>
      <h2>{mode === 'mois' ? 'Le mois en un regard' : 'La semaine en un regard'}</h2>
      <div className="rt-chart-scroll" tabIndex={0} aria-label="Graphique des retards par jour">
        <div className="rt-bars" style={{ minWidth: dates.length > 7 ? dates.length * 30 : undefined }}>
          {chart.map((day) => (
            <div className="rt-bar-column" key={day.date}>
              <b>{day.count}</b>
              <div className="rt-bar-track">
                <span style={{ height: `${(day.count / maxCount) * 100}%` }} />
              </div>
              <span>{day.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LE CONTENU
   ═══════════════════════════════════════════════════════════════════════ */
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
  selectedDate,
  onSelectDate,
  onSauterMois,
}) {
  const [page, setPage] = useState(0)
  const terme = search.trim().toLocaleLowerCase('fr')
  const filtered = retards.filter((r) =>
    `${r.employee.first_name || ''} ${r.employee.last_name || ''} ${r.employee.matricule || ''} ${r.employee.enterprises?.name || ''}`
      .toLocaleLowerCase('fr')
      .includes(terme),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAR_PAGE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * PAR_PAGE, currentPage * PAR_PAGE + PAR_PAGE)

  /* Le focus : la fiche au plus fort écart de CE QUI EST AFFICHÉ. Il ne
     faut pas qu'une fiche de la page 3 attire l'œil sur la page 1. */
  const pire = visible.reduce(
    (max, r) => (r.retardMinutes > (max?.retardMinutes ?? -1) ? r : max),
    null,
  )
  const plusieursFiches = visible.length > 1
  /* La maquette A met la fiche cerclée EN TÊTE : elle ouvre le regard.
     L'ordre des autres ne bouge pas. */
  const ordonnees =
    plusieursFiches && pire
      ? [pire, ...visible.filter((r) => r !== pire)]
      : visible

  const employes = stats.employesEnRetard
  return (
    <>
      {/* Le titre de page a quitté cette ligne (25/11) : la barre sombre de
          l'application portait déjà « Retards », et le bandeau le porte
          maintenant une seule fois. Ici, on entre directement dans les
          commandes et les compteurs. */}
      <header className="rt-title-row">
        <div>
          <span className="rt-eyebrow">Le carnet de ponctualité</span>
          <p className="rt-sous-titre">Chaque arrivée, replacée dans son contexte.</p>
        </div>
        <div className="rt-actions">
          <button disabled={!filtered.length || busy} onClick={() => onExport(filtered)}>
            <Download size={15} /> Exporter
          </button>
          <button onClick={onRules} aria-label="Règles & tolérance">
            <Settings size={15} /> Règles &amp; tolérance
          </button>
        </div>
      </header>

      {filters}

      <section className="rt-summary" aria-label="Résumé de la période">
        {[
          [stats.totalRetards, stats.totalRetards === 1 ? 'Retard constaté' : 'Retards constatés'],
          [employes, employes === 1 ? 'Employé concerné' : 'Employés concernés'],
          [retardDuration(stats.totalMinutesRetard), 'Écart cumulé'],
        ].map(([value, label], index) => (
          <div key={label} className="rt-metric">
            <span className="rt-metric-index" aria-hidden="true">
              0{index + 1}
            </span>
            <div className="rt-metric-copie">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </section>

      <section className="rt-workspace" aria-label="Le registre du jour">
      <div className="rt-list-heading">
        <div>
          <span className="rt-eyebrow">Les fiches horaires</span>
          <h2>Chaque arrivée raconte un horaire.</h2>
        </div>
        <label className="rt-search">
          <Search size={15} aria-hidden="true" />
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

      <div className="rt-grid">
        <RailDesJours
          dates={dates}
          retards={retards}
          selectedDate={selectedDate || dates[0]}
          onSelect={onSelectDate || (() => {})}
          onSauter={onSauterMois}
          mode={mode}
        />

        <section className="rt-panel rt-arrivals" aria-label="Fiches horaires">
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

          {/*  L'ÉTAT VIDE, refait le 25/11. Il disait « Aucun retard constaté
              sur cette période parmi les journées évaluées. » puis, juste en
              dessous, « 0 fiches sur 0 » : deux fois rien, et aucune issue.
              Il dit maintenant ce qui est vrai, et propose la sortie quand il
              y en a une — élargir la période, ou effacer la recherche. */}
          {!visible.length && (
            <div className="rt-empty">
              <span className="rt-empty-marque" aria-hidden="true">
                {terme ? <Search size={18} /> : <Clock size={18} />}
              </span>
              <div className="rt-empty-copie">
                <strong>
                  {terme
                    ? 'Aucun nom ne correspond.'
                    : 'Aucun retard sur cette période.'}
                </strong>
                <p>
                  {terme
                    ? `Rien au nom de « ${search.trim()} » parmi les ${retards.length} fiche${retards.length > 1 ? 's' : ''} de la période.`
                    : `${dates.length} journée${dates.length > 1 ? 's' : ''} évaluée${dates.length > 1 ? 's' : ''} sans aucun retard. Rien à relancer ici.`}
                </p>
                <div className="rt-empty-gestes">
                  {terme ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setPage(0)
                      }}
                    >
                      Effacer la recherche
                    </button>
                  ) : (
                    <span className="rt-empty-note">
                      Pour voir plus large, changez de période dans la barre du
                      haut — Jour, Semaine ou Mois.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {ordonnees.map((r) => (
            <Fiche
              key={`${r.employee.id}-${r.date}-${r.id || ''}`}
              retard={{ ...r, onDelete }}
              focus={plusieursFiches && pire && r === pire}
            />
          ))}

          <footer className="rt-pagination">
            <span>
              {!filtered.length
                ? 'Aucune fiche sur cette période'
                : filtered.length === 1
                  ? '1 fiche horaire'
                  : `${visible.length} fiche${visible.length > 1 ? 's' : ''} sur ${filtered.length}`}
              {search && retards.length > 0 && ` · ${retards.length} sur la période`}
            </span>
            {pageCount > 1 && (
              <div>
                <button
                  aria-label="Page précédente"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {currentPage + 1} / {pageCount}
                </span>
                <button
                  aria-label="Page suivante"
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </footer>
        </section>

        <Marge
          stats={stats}
          mode={mode}
          dates={dates}
          retards={retards}
          onRules={onRules}
        />
      </div>
      </section>

      {busy && (
        <p className="rt-busy" role="status">
          <AlertTriangle size={14} aria-hidden="true" /> Mise à jour de la
          fiche…
        </p>
      )}
    </>
  )
}
