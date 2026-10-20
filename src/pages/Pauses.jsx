// ═══════════════════════════════════════════════════════════════════════════
// ⏸ PAGE PAUSES — Design Afro-Tech Kente & Adinkra + Chronomètre Dynamique
// ═══════════════════════════════════════════════════════════════════════════
//  Doctrine :
//   · Pauses réellement effectuées (non présumées : pointées ou saisies admin)
//     avec chronomètre dynamique en direct dès qu'une pause réelle est ouverte.
//   · Les pauses présumées (créneaux de la grille horaire, non pointées)
//     sont strictement distinguées pour décision (Valider / Écarter).
//   · Le moteur (`encheck_pauses_controler`) tourne au chargement.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import {
  construirePauses,
  estPauseReelleEffectuee,
  exportCsvPauses,
} from '../services/pausesService'
import PausesLoadingScreen from '../components/PausesLoadingScreen'
import useLoadingMinimum from '../hooks/useLoadingMinimum'
import {
  KenteWovenTapestrySvg,
  PausesAnalyticsCharts,
  PausesCollaborateursSection,
  PausesCulturalHero,
  PausesExecutiveKpis,
} from '../components/PausesAfroTechSections'
import FicheEmployeModal from '../components/FicheEmployeModal'
import { formaterHeureLocale, jourLocal } from '../utils/timezoneUtils'
import toast from 'react-hot-toast'
import './PointagesAfroTech.css'

export default function Pauses () {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const todayIso = jourLocal(new Date()) || new Date().toISOString().split('T')[0]

  const [admin, setAdmin] = useState(null)
  const [paies, setPaies] = useState([])
  const [loading, setLoading] = useState(true)
  const { minLoadingDone, skipLoading } = useLoadingMinimum()
  const [entreprises, setEntreprises] = useState([])
  const [employes, setEmployes] = useState([])
  const [empSchedules, setEmpSchedules] = useState([])
  const [workSchedules, setWorkSchedules] = useState([])
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [viewMode, setViewMode] = useState('semaine')
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [subFilter, setSubFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [ficheEmployee, setFicheEmployee] = useState(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [form, setForm] = useState({
    employee_id: '',
    jour: todayIso,
    debut: '12:00',
    fin: '13:00',
    motif: '',
  })

  // Chronomètre dynamique temps réel (1 tick / seconde)
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const parsed = JSON.parse(localStorage.getItem('admin') || 'null')
    if (!parsed) {
      navigate('/login')
      return
    }
    setAdmin(parsed)
    if (parsed.role === 'super_admin') {
      supabase
        .from('enterprises')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => setEntreprises(data || []))
    } else {
      setSelectedEntrepriseId(parsed.selectedEnterprise?.id || parsed.enterprise_id)
    }

    Promise.all([
      supabase
        .from('employees')
        .select('*, enterprises(id, name)')
        .eq('is_active', true)
        .order('last_name'),
      supabase
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .eq('is_active', true),
      supabase
        .from('work_schedules')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true),
    ]).then(([empRes, esRes, wsRes]) => {
      setEmployes(empRes?.data || [])
      setEmpSchedules(esRes?.data || [])
      setWorkSchedules(wsRes?.data || [])
    })
  }, [navigate])

  const employesById = useMemo(() => {
    const map = {}
    for (const emp of employes) {
      if (emp?.id) map[emp.id] = emp
    }
    return map
  }, [employes])

  const employesForForm = useMemo(() => {
    let target = selectedEntrepriseId
    if (admin && admin.role !== 'super_admin') {
      target = admin.selectedEnterprise?.id || admin.enterprise_id
    }
    if (!target || target === 'all') return employes
    return employes.filter((emp) => emp.enterprise_id === target)
  }, [employes, selectedEntrepriseId, admin])

  const hasPlannedBreakForEmployee = useCallback(
    (empId, entId) => {
      const es = empSchedules.find((row) => row.employee_id === empId)
      if (es) {
        return es.use_custom_hours
          ? Boolean(es.custom_has_break)
          : Boolean(es.work_schedules?.has_break)
      }
      const def = workSchedules.find((row) => row.enterprise_id === entId)
      return Boolean(def?.has_break)
    },
    [empSchedules, workSchedules]
  )

  const loadPauses = useCallback(async () => {
    if (!admin) return
    setLoading(true)
    try {
      const date = new Date(`${selectedDate}T12:00:00`)
      let startDate
      let endDate
      if (viewMode === 'jour') {
        startDate = selectedDate
        endDate = selectedDate
      } else if (viewMode === 'semaine') {
        const dayOfWeek = date.getDay()
        const monday = new Date(date)
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        startDate = jourLocal(monday) || monday.toISOString().split('T')[0]
        endDate = jourLocal(sunday) || sunday.toISOString().split('T')[0]
      } else {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0)
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0)
        startDate = jourLocal(firstDay) || firstDay.toISOString().split('T')[0]
        endDate = jourLocal(lastDay) || lastDay.toISOString().split('T')[0]
      }

      let target = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        target = admin.selectedEnterprise?.id || admin.enterprise_id
      }
      const entArg = target === 'all' ? null : target

      // ── Le moteur d'abord : présumées + anomalies à jour, puis lecture ──
      if (entArg) {
        await supabase.rpc('encheck_pauses_controler', { p_enterprise: entArg })
      } else if (entreprises.length > 0) {
        await Promise.allSettled(
          entreprises.map((ent) =>
            supabase.rpc('encheck_pauses_controler', { p_enterprise: ent.id })
          )
        )
      }

      const { data: lignes, error } = await supabase.rpc('encheck_pauses_lire', {
        p_enterprise: entArg,
        p_du: startDate,
        p_au: endDate,
      })
      if (error) throw error

      const { paies: liste } = construirePauses(lignes || [])
      const enriched = liste.map((p) => {
        const planned = hasPlannedBreakForEmployee(p.employe_id, p.enterprise_id || entArg)
        return {
          ...p,
          debutHHMM: p.debutISO ? formaterHeureLocale(p.debutISO).slice(0, 5) : p.debutHHMM,
          finHHMM: p.finISO ? formaterHeureLocale(p.finISO).slice(0, 5) : p.finHHMM,
          estNonPlanifiee: estPauseReelleEffectuee(p) && !planned,
        }
      })
      setPaies(enriched)
    } catch (e) {
      console.error('Erreur chargement pauses:', e)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }, [admin, selectedDate, selectedEntrepriseId, viewMode, entreprises, hasPlannedBreakForEmployee])

  useEffect(() => {
    loadPauses()
  }, [loadPauses])

  // Abonnement Realtime sur `encheck_pauses` pour détecter immédiatement un départ ou retour de pause
  useEffect(() => {
    if (!admin) return undefined
    const channel = supabase
      .channel('pauses_realtime_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'encheck_pauses' },
        () => {
          loadPauses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [admin, loadPauses])

  const statuer = async (ids, decision) => {
    const { error } = await supabase.rpc('encheck_pauses_statuer', {
      p_ids: ids,
      p_decision: decision,
      p_motif: null,
    })
    if (error) {
      toast.error('Erreur lors de la décision')
      return
    }
    toast.success(decision === 'valider' ? 'Pause validée ✅' : 'Pause écartée 🚫')
    loadPauses()
  }

  const creerPause = async () => {
    if (!form.employee_id || !form.jour || !form.debut || !form.fin) {
      toast.error('Employé, jour et horaires sont obligatoires')
      return
    }
    const { data, error } = await supabase.rpc('encheck_pause_creer', {
      p_employee: form.employee_id,
      p_debut: `${form.jour}T${form.debut}:00`,
      p_fin: `${form.jour}T${form.fin}:00`,
      p_motif: form.motif || null,
    })
    if (error || (data && data.ok === false)) {
      toast.error((data && data.erreur) || 'Erreur lors de la création')
      return
    }
    toast.success('Pause réelle enregistrée ✅')
    setShowForm(false)
    setForm({ ...form, motif: '' })
    setActiveTab('reelles')
    loadPauses()
  }

  const exporterCsv = () => {
    const sourceForCsv =
      activeTab === 'reelles'
        ? paies.filter((p) => estPauseReelleEffectuee(p))
        : paies.filter((p) => p.statut !== 'ecartee')
    const csv = exportCsvPauses(sourceForCsv)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pauses-${activeTab}-${selectedDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const shiftDate = (dir) => {
    const d = new Date(`${selectedDate}T12:00:00`)
    const delta = viewMode === 'jour' ? dir : viewMode === 'semaine' ? dir * 7 : dir * 30
    d.setDate(d.getDate() + delta)
    setSelectedDate(jourLocal(d) || d.toISOString().split('T')[0])
  }

  //  Même plancher que le Planning : les deux scènes de pause ont le temps
  //  d'être vues, même quand la lecture est instantanée.
  if ((loading && paies.length === 0) || !minLoadingDone) {
    return (
      <PausesLoadingScreen
        darkMode={darkMode}
        onSkip={() => {
          skipLoading()
          setLoading(false)
        }}
      />
    )
  }

  return (
    <div
      className="pauses-v2-shell"
      data-theme={darkMode ? 'dark' : 'light'}
    >
      <KenteWovenTapestrySvg className="pauses-v2-kente-strip" />

      <div className="pauses-v2-container">
        <PausesCulturalHero
          darkMode={darkMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDate={selectedDate}
          onShiftDate={shiftDate}
          onDateChange={setSelectedDate}
          entreprises={entreprises}
          selectedEnterpriseId={selectedEntrepriseId}
          onSelectEnterprise={setSelectedEntrepriseId}
          isSuperAdmin={admin?.role === 'super_admin'}
          admin={admin}
          onToggleTheme={toggleTheme}
          onBackDashboard={() => navigate('/dashboard')}
          onNavigate={(path) => navigate(path)}
          onToggleAddForm={() => setShowForm((prev) => !prev)}
          showAddForm={showForm}
          onExportCsv={exporterCsv}
        />

        {/* Formulaire de saisie manuelle d'une pause réelle par l'admin */}
        {showForm && (
          <section
            className="pauses-v2-panel"
            aria-label="Nouvelle pause réelle"
            style={{
              marginBottom: 18,
              borderColor: 'var(--pv-border-strong)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '0.94rem', color: 'var(--pv-gold)', fontWeight: 800 }}>
                Saisir une pause réelle (correction / saisie manuelle par l’administrateur)
              </h3>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
                gap: 10,
              }}
            >
              <select
                className="pauses-v2-select"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              >
                <option value="">— Collaborateur —</option>
                {employesForForm.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.matricule})
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="pauses-v2-select"
                value={form.jour}
                onChange={(e) => setForm({ ...form, jour: e.target.value })}
              />
              <input
                type="time"
                className="pauses-v2-select"
                value={form.debut}
                onChange={(e) => setForm({ ...form, debut: e.target.value })}
              />
              <input
                type="time"
                className="pauses-v2-select"
                value={form.fin}
                onChange={(e) => setForm({ ...form, fin: e.target.value })}
              />
              <input
                type="text"
                className="pauses-v2-select"
                placeholder="Motif (facultatif)"
                value={form.motif}
                onChange={(e) => setForm({ ...form, motif: e.target.value })}
              />
              <button
                type="button"
                className="pauses-v2-add-btn"
                onClick={creerPause}
                style={{ justifyContent: 'center' }}
              >
                Enregistrer la pause
              </button>
            </div>
          </section>
        )}

        {/* 4 Cartes KPI exécutives + Bandeau Chronomètre Dynamique en direct */}
        <PausesExecutiveKpis
          paies={paies}
          activeTab={activeTab}
          subFilter={subFilter}
          onSelectTab={setActiveTab}
          onSelectSubFilter={setSubFilter}
          nowMs={nowMs}
        />

        {/* 2 Graphiques analytiques (Histogramme horaire + Donut Répartition) */}
        <PausesAnalyticsCharts
          paies={paies}
          onSelectTab={(tab) => {
            setActiveTab(tab)
            setSubFilter('all')
          }}
        />

        {/* Tableau des pauses des employés */}
        <PausesCollaborateursSection
          paies={paies}
          employesById={employesById}
          activeTab={activeTab}
          subFilter={subFilter}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSelectTab={setActiveTab}
          onSelectSubFilter={setSubFilter}
          onStatuer={statuer}
          onOpenEmployeeFiche={(emp) => setFicheEmployee(emp)}
          onOpenPointages={(p) => {
            const q = p.matricule || p.employe || ''
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (p.jour) params.set('date', p.jour)
            navigate(`/pointages?${params.toString()}`)
          }}
          nowMs={nowMs}
        />
      </div>

      {ficheEmployee && (
        <FicheEmployeModal
          employee={ficheEmployee}
          canEdit={Boolean(admin)}
          onClose={() => setFicheEmployee(null)}
          onSaved={(updated) => {
            setEmployes((prev) =>
              prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
            )
            setFicheEmployee((prev) => (prev ? { ...prev, ...updated } : null))
          }}
        />
      )}
    </div>
  )
}
