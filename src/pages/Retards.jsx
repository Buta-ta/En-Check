import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTheme } from '../contexts/ThemeContext'
import PageHeader from '../components/PageHeader'
import PageCulturalBand from '../components/PageCulturalBand'
import {
  RetardsContent,
  RetardsDialog,
  RetardsNavigation,
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
  const filters = (
    <section className="rt-filters" aria-label="Filtres des retards">
      {admin?.role === 'super_admin' && (
        <label>
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
      )}
      <div>
        <span className="rt-label">Période</span>
        <div className="rt-date">
          <button
            aria-label="Période précédente"
            onClick={() =>
              changeContext(() =>
                setSelectedDate(shiftRetardDate(selectedDate, viewMode, -1)),
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            aria-label="Date de référence"
            value={selectedDate}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))
                changeContext(() => setSelectedDate(e.target.value))
            }}
          />
          <button
            aria-label="Période suivante"
            onClick={() =>
              changeContext(() =>
                setSelectedDate(shiftRetardDate(selectedDate, viewMode, 1)),
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div>
        <span className="rt-label">Vue</span>
        <div
          className="rt-segments"
          role="group"
          aria-label="Durée de la période"
        >
          {[
            ['jour', 'Jour'],
            ['semaine', 'Semaine'],
            ['mois', 'Mois'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={viewMode === value}
              onClick={() => {
                if (value !== viewMode) changeContext(() => setViewMode(value))
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="rt-period-caption">
        {dates.length > 1
          ? `Du ${retardDateLabel(dates[0])} au ${retardDateLabel(dates.at(-1))}`
          : retardDateLabel(selectedDate)}{' '}
        · {selectedDate.slice(0, 4)}
      </p>
    </section>
  )

  return (
    <div className={`rt-page ${darkMode ? 'rt-dark' : ''}`}>
      <PageCulturalBand pathname="/retards" />
      <PageHeader title="Retards" />
      <RetardsNavigation darkMode={darkMode} onToggleTheme={toggleTheme} />
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
        ) : loading || error ? (
          <>
            <div className="rt-title-row">
              <div>
                <h1>Retards</h1>
                <p>Chaque arrivée, replacée dans son contexte.</p>
              </div>
            </div>
            {filters}
            <div className="rt-state" role={error ? 'alert' : 'status'}>
              {error ? (
                <>
                  <p>{error}</p>
                  <button onClick={loadRetards}>Réessayer</button>
                </>
              ) : (
                <>
                  <Clock className="rt-loading-icon" size={36} />
                  <p>Lecture des pointages et du planning applicable…</p>
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
  )
}
