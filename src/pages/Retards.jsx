import RetardsLoadingScreen from '../components/RetardsLoadingScreen'
import { enrichRetardPhotos } from '../services/retardsPhotos'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
/*  LA SIDEBAR ET SON RAIL — « ramène la sidebar + son rail dans cette page
    comme dans Annonces accueil » (25/11). On ne recopie pas le patron : on
    rend les deux composants partagés, `CoqueAdmin` et `SidebarUnique`, avec
    la fabrique de sections que Planning, Employés et Annonces lisent déjà. */
import CoqueAdmin from '../components/coque/CoqueAdmin'
import SidebarUnique from '../components/SidebarUnique'
import { sectionsNavAdmin } from '../components/coque/sectionsNavAdmin'
import {
  RetardsBandeau,
  RetardsContent,
  RetardsDialog,
  RetardsPeriode,
  RetardsHelp,
} from '../components/RetardsPresentation'
import HolidayService from '../services/holidayService'
import { construireRetards } from '../services/retardsService'
import {
  retardDates,
  shiftRetardDate,
  retardDateLabel,
  retardsCSV,
  allRetardRows,
} from '../utils/retardsPresentation'
import './Retards.css'

export default function Retards() {
  const { darkMode, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [access, setAccess] = useState(null)
  const [accessError, setAccessError] = useState('')
  const [accessAttempt, setAccessAttempt] = useState(0)
  const [entreprises, setEntreprises] = useState([])
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [viewMode, setViewMode] = useState('jour')
  const [retards, setRetards] = useState([])
  const [stats, setStats] = useState(construireRetards([]).stats)
  const [loading, setLoading] = useState(true)
  const [introPending, setIntroPending] = useState(true)
  const finishIntro = useCallback(() => setIntroPending(false), [])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [retardToDelete, setRetardToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deletionLock = useRef(false)
  const requestId = useRef(0)
  const dates = retardDates(selectedDate, viewMode)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('admin') || 'null')
      if (!stored) {
        navigate('/login')
        return
      }
      setAdmin(stored)
      if (stored.role !== 'super_admin')
        setSelectedEntrepriseId(
          stored.selectedEnterprise?.id || stored.enterprise_id,
        )
    } catch {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    if (!admin) return
    let active = true
    setAccess(null)
    setAccessError('')
    const check = async () => {
      try {
        if (admin.role === 'super_admin') {
          const companies = await allRetardRows(
            supabase
              .from('enterprises')
              .select('id,name')
              .eq('is_active', true)
              .order('name')
              .order('id'),
          )
          if (active) {
            setEntreprises(companies)
            setAccess(true)
          }
        } else {
          const enterpriseId =
            admin.selectedEnterprise?.id || admin.enterprise_id
          if (!enterpriseId) throw new Error('Missing enterprise')
          const { data, error: accessFailure } = await supabase
            .from('enterprises')
            .select('module_retards')
            .eq('id', enterpriseId)
            .single()
          if (accessFailure) throw accessFailure
          if (active) setAccess(!!data?.module_retards)
        }
      } catch {
        if (active)
          setAccessError('Impossible de vérifier l’accès au module Retards.')
      }
    }
    check()
    return () => {
      active = false
    }
  }, [admin, accessAttempt])

  const loadRetards = useCallback(async () => {
    if (!admin || access !== true) return
    const request = ++requestId.current
    setLoading(true)
    setError('')
    setRetards([])
    try {
      const period = retardDates(selectedDate, viewMode)
      const startDate = period[0],
        endDate = period.at(-1)
      const targetEnterpriseId =
        admin.role === 'super_admin'
          ? selectedEntrepriseId
          : admin.selectedEnterprise?.id || admin.enterprise_id
      if (!targetEnterpriseId || !startDate || !endDate)
        throw new Error('Missing scope')
      const ids =
        targetEnterpriseId === 'all'
          ? entreprises.map((e) => e.id)
          : [targetEnterpriseId]
      const holidaysByEnterprise = {}
      await Promise.all(
        ids.map(async (id) => {
          const holidays = await HolidayService.getHolidaysForRange(
            id,
            startDate,
            endDate,
            { strict: true },
          )
          holidaysByEnterprise[id] = HolidayService.buildHolidaySet(
            holidays.filter((h) => !h.is_worked),
          )
        }),
      )
      // One authoritative calculation: SQL resolves active schedules and tolerance.
      // Stable pagination avoids silently truncating long periods at the API row limit.
      const lignesRetards = await allRetardRows(
        supabase
          .rpc('encheck_retards_plage', {
            p_enterprise:
              targetEnterpriseId === 'all' ? null : targetEnterpriseId,
            p_du: startDate,
            p_au: endDate,
          })
          .order('jour')
          .order('enterprise_id')
          .order('employe_id'),
      )
      const result = construireRetards(lignesRetards, holidaysByEnterprise)
      if (request !== requestId.current) return
      setRetards(result.retards)
      setStats(result.stats)
      setLoading(false)
      // Photos are optional: do not delay result display or completion of refresh.
      void enrichRetardPhotos(
        result.retards,
        lignesRetards,
        supabase,
        targetEnterpriseId,
      )
        .then((withPhotos) => {
          if (request === requestId.current) setRetards(withPhotos)
        })
        .catch(() => {
          /* Keep initials if optional enrichment fails. */
        })
    } catch (failure) {
      console.error('Erreur chargement retards:', failure)
      if (request === requestId.current)
        setError(
          'Impossible de charger les retards. Aucun résultat partiel n’est affiché.',
        )
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [admin, access, selectedDate, selectedEntrepriseId, viewMode, entreprises])

  useEffect(() => {
    loadRetards()
    return () => {
      requestId.current++
    }
  }, [loadRetards])

  const changeContext = (action) => {
    requestId.current++
    setLoading(true)
    setSearch('')
    setRetardToDelete(null)
    action()
  }
  const confirmDelete = async () => {
    if (!retardToDelete?.id || deletionLock.current) return
    deletionLock.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      const { data, error: failure } = await supabase
        .from('attendances')
        .delete()
        .eq('id', retardToDelete.id)
        .select('id')
      if (failure) throw failure
      if (!data?.length)
        throw new Error('Pointage absent ou suppression non autorisée')
      toast.success('Pointage source supprimé')
      setRetardToDelete(null)
      await loadRetards()
    } catch {
      setDeleteError(
        'La suppression n’a pas pu être confirmée. Vérifiez vos droits puis réessayez.',
      )
    } finally {
      deletionLock.current = false
      setDeleting(false)
    }
  }
  const exportCSV = (rows) => {
    const url = URL.createObjectURL(
      new Blob([retardsCSV(rows)], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `retards_${dates[0]}_${dates.at(-1)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  /* L'entreprise vit dans la planche (sous le bandeau), la période dans la
     ligne du bandeau : deux pièces, jamais rendues deux fois. */
  const filtreEntreprise =
    admin?.role === 'super_admin' ? (
      <label className="rt-filter-field" data-step="01">
        Entreprise
        <select
          value={selectedEntrepriseId}
          onChange={(e) =>
            changeContext(() => setSelectedEntrepriseId(e.target.value))
          }
        >
          <option value="all">Toutes les entreprises</option>
          {entreprises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
    ) : null
  /* La période se règle dans le bandeau. Ici, il ne reste que sa LÉGENDE —
     « du 23 au 27 nov. 2026 · 12 journées évaluées » — parce qu'elle informe,
     là où les contrôles, eux, sont uniques. */
  const filters = (
    <p className="rt-period-caption">
      {dates.length > 1
        ? `Du ${retardDateLabel(dates[0])} au ${retardDateLabel(dates.at(-1))}`
        : retardDateLabel(selectedDate)}{' '}
      · {selectedDate.slice(0, 4)}
    </p>
  )

  /*  Les sections du rail : la même fabrique que les autres pages, avec la
      même règle `super_admin` qui passe toujours — sans elle, le rail masquait
      Retards et la barre paraissait vide. */
  const sectionsNav = sectionsNavAdmin({
    admin,
    moduleActif: (champ) => {
      if (admin?.role === 'super_admin') return true
      const ligne = (entreprises || []).find(
        (e) => e.id === (selectedEntrepriseId === 'all' ? null : selectedEntrepriseId),
      )
      return Boolean(ligne?.[champ])
    },
  })

  return (
    <CoqueAdmin
      sidebar={
        <SidebarUnique
          sections={sectionsNav}
          nomAdmin={admin ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() : ''}
          initialeAdmin={(admin?.first_name || 'A').charAt(0)}
          darkMode={darkMode}
          surTheme={toggleTheme}
          surDeconnexion={() => navigate('/login')}
          entreprises={entreprises}
          entrepriseActive={
            entreprises.find((e) => e.id === selectedEntrepriseId) || null
          }
          surEntreprise={(e) =>
            changeContext(() =>
              setSelectedEntrepriseId(typeof e === 'string' ? e : e?.id || 'all'),
            )
          }
        />
      }
    >
      <div className={`rt-page ${darkMode ? 'rt-dark' : ''}`}>
        {/* Le motif ne se pose plus AU-DESSUS du bandeau : il l'ENTOURE.
            Même toile de tissage que la page, `placement="cadre"`, et la
            planche posée par-dessus — c'est elle qui masque le milieu, donc
            le motif ne se voit qu'en lisière (décision du 25/11). Le cadre ne
            porte aucun mot et ne boit aucun clic (D-004). */}
        <div className="rt-cadre">
          <PageCulturalBand pathname="/retards" placement="cadre" />
          <div className="rt-planche">
            <div className="rt-bandeau-ligne">
              <RetardsBandeau />
              <RetardsPeriode
                selectedDate={selectedDate}
                onDate={(value) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
                    changeContext(() => setSelectedDate(value))
                }}
                onShift={(delta) =>
                  changeContext(() =>
                    setSelectedDate(shiftRetardDate(selectedDate, viewMode, delta)),
                  )
                }
                mode={viewMode}
                onMode={(value) => {
                  if (value !== viewMode) changeContext(() => setViewMode(value))
                }}
                dates={dates}
              />
            </div>
            {filtreEntreprise && (
              <div className="rt-planche-entreprise">{filtreEntreprise}</div>
            )}
          </div>
        </div>
        <main className="rt-main">
          {accessError ? (
            <div className="rt-state" role="alert">
              <p>{accessError}</p>
              <button onClick={() => setAccessAttempt((n) => n + 1)}>
                Réessayer
              </button>
            </div>
          ) : access === false ? (
            <div className="rt-state">
              <h1>Module Retards non activé</h1>
              <Link to="/dashboard">Retour au tableau de bord</Link>
            </div>
          ) : access === null ? (
            <div className="rt-state" role="status">
              Vérification de l’accès…
            </div>
          ) : loading || error || introPending ? (
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
              </div>
              <div
                className={error ? 'rt-state' : 'rt-loading-slot'}
                role={error ? 'alert' : undefined}
              >
                {error ? (
                  <>
                    <p>{error}</p>
                    <button onClick={loadRetards}>Réessayer</button>
                  </>
                ) : (
                  <>
                    <RetardsLoadingScreen
                      onMinimumDone={introPending ? finishIntro : undefined}
                      onSkip={introPending ? finishIntro : undefined}
                      dataReady={!loading}
                    />
                  </>
                )}
              </div>
            </>
          ) : (
            <RetardsContent
              key={`${selectedEntrepriseId}-${selectedDate}-${viewMode}`}
              retards={retards}
              stats={stats}
              dates={dates}
              mode={viewMode}
              filters={filters}
              onExport={exportCSV}
              onRules={() => setRulesOpen(true)}
              onDelete={(r) => {
                setDeleteError('')
                setRetardToDelete(r)
              }}
              busy={deleting}
              search={search}
              setSearch={setSearch}
              selectedDate={selectedDate}
              /*  Un jour de la molette, c'est une JOURNÉE qu'on choisit — pas
                  une nouvelle ancre dans le mois. Sans le passage en vue du
                  jour, cliquer « le 12 » rechargeait le mois entier avec une
                  autre ancre et rien ne bougeait à l'écran. */
              onSelectDate={(date) =>
                changeContext(() => {
                  setSelectedDate(date)
                  setViewMode('jour')
                })
              }
              /*  Choisir un mois dans le rail amène au MOIS : c'est la vue
                  qui montre la période qu'on vient de demander. */
              onSauterMois={(premierJour) =>
                changeContext(() => {
                  setSelectedDate(premierJour)
                  setViewMode('mois')
                })
              }
            />
          )}
        </main>
        <PageCulturalBand pathname="/retards" placement="bottom" />
        {rulesOpen && (
          <RetardsDialog
            title="Règles & tolérance"
            darkMode={darkMode}
            onClose={() => setRulesOpen(false)}
          >
            <RetardsHelp />
            <section className="rt-rule-context">
              <h3>Les règles de cette période</h3>
              <p>
                Les heures et tolérances affichées dans chaque détail proviennent
                du planning applicable à l’employé pour la date concernée.
                Plusieurs règles peuvent coexister : aucun seuil unique n’est
                supposé pour toute l’entreprise.
              </p>
              <p>
                Ce panneau explique les règles ; il ne modifie pas les paramètres
                de calcul.
              </p>
              <Link to="/planning">
                Consulter le Planning <ChevronRight size={15} />
              </Link>
            </section>
          </RetardsDialog>
        )}
        {retardToDelete && (
          <RetardsDialog
            title="Supprimer le pointage source ?"
            darkMode={darkMode}
            busy={deleting}
            onClose={() => setRetardToDelete(null)}
          >
            <p>
              <strong>
                {retardToDelete.employee.first_name}{' '}
                {retardToDelete.employee.last_name}
              </strong>{' '}
              · {retardDateLabel(retardToDelete.date)} ·{' '}
              {retardToDelete.heurePointage}
            </p>
            <p>
              Cette action supprime le pointage d’arrivée, pas seulement l’alerte
              de retard. Elle peut modifier les heures travaillées et les calculs
              associés. Elle est irréversible depuis cette page.
            </p>
            {deleteError && (
              <p role="alert" className="rt-delete-error">
                {deleteError}
              </p>
            )}
            <div className="rt-confirm-actions">
              <button disabled={deleting} onClick={() => setRetardToDelete(null)}>
                Annuler
              </button>
              <button
                className="rt-danger"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting
                  ? 'Suppression…'
                  : 'Supprimer définitivement le pointage'}
              </button>
            </div>
          </RetardsDialog>
        )}
      </div>
    </CoqueAdmin>
  )
}
