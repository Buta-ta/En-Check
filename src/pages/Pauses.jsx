// ═══════════════════════════════════════════════════════════════════════════
// ⏸ PAGE PAUSES — Design Afro-Tech Kente & Adinkra (fidèle à la maquette)
// ═══════════════════════════════════════════════════════════════════════════
//  Doctrine :
//   · Pauses réellement effectuées (non présumées : pointées ou saisies admin)
//     constituent seules l'historique des pauses effectuées.
//   · Les pauses présumées (créneaux de la grille horaire, non pointées)
//     sont strictement distinguées et isolées pour décision (Valider / Écarter).
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
import {
  PausesAdinkraSidePillarSvg,
  PausesAnalyticsCharts,
  PausesCollaborateursSection,
  PausesCulturalHero,
  PausesExecutiveKpis,
  PausesKenteTopBannerSvg,
} from '../components/PausesAfroTechSections'
import FicheEmployeModal from '../components/FicheEmployeModal'
import { formaterHeureLocale } from '../utils/timezoneUtils'
import toast from 'react-hot-toast'
import './PointagesAfroTech.css'

export default function Pauses () {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const [admin, setAdmin] = useState(null)
  const [paies, setPaies] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHold, setLoadingHold] = useState(true)
  const [entreprises, setEntreprises] = useState([])
  const [employes, setEmployes] = useState([])
  const [empSchedules, setEmpSchedules] = useState([])
  const [workSchedules, setWorkSchedules] = useState([])
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [viewMode, setViewMode] = useState('jour')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState('reelles')
  const [subFilter, setSubFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [ficheEmployee, setFicheEmployee] = useState(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [form, setForm] = useState({
    employee_id: '',
    jour: new Date().toISOString().split('T')[0],
    debut: '12:00',
    fin: '13:00',
    motif: '',
  })

  // Maintien volontaire de 4,5 secondes (4500ms) pour l'écran de chargement illustré 2 scènes
  useEffect(() => {
    const timer = window.setTimeout(() => setLoadingHold(false), 4500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const hasOpen = paies.some((p) => p.ouverte)
    if (!hasOpen) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [paies])

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
      const date = new Date(selectedDate)
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
        startDate = monday.toISOString().split('T')[0]
        endDate = sunday.toISOString().split('T')[0]
      } else {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
      }

      let target = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        target = admin.selectedEnterprise?.id || admin.enterprise_id
      }
      const entArg = target === 'all' ? null : target

      // ── Le moteur d'abord : présumées + anomalies à jour, puis lecture ──
      if (entArg) {
        await supabase.rpc('encheck_pauses_controler', { p_enterprise: entArg })
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
  }, [admin, selectedDate, selectedEntrepriseId, viewMode, hasPlannedBreakForEmployee])

  useEffect(() => {
    loadPauses()
  }, [loadPauses])

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
        : paies
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
    const d = new Date(selectedDate)
    const delta = viewMode === 'jour' ? dir : viewMode === 'semaine' ? dir * 7 : dir * 30
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  if (loadingHold || (loading && paies.length === 0)) {
    return (
      <PausesLoadingScreen
        darkMode={darkMode}
        onSkip={() => setLoadingHold(false)}
      />
    )
  }

  return (
    <div
      className="pointages-afrotech-shell"
      data-theme={darkMode ? 'dark' : 'light'}
      style={{
        minHeight: '100vh',
        background: darkMode ? '#120E0A' : 'var(--pt-bg)',
        padding: 0,
      }}
    >
      <style>{`
        @media (max-width: 1120px) {
          .pauses-kpi-four-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .pauses-charts-two-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 860px) {
          .pauses-adinkra-side-col {
            display: none !important;
          }
          .pauses-collab-row-card {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 620px) {
          .pauses-kpi-four-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Frise Kente géométrique supérieure pleine largeur */}
      <PausesKenteTopBannerSvg />

      {/* Disposition principale : Pilier Adinkra Gauche | Grand Cadre Central | Pilier Adinkra Droit */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'stretch',
          maxWidth: 1600,
          margin: '0 auto',
          padding: '10px 4px 28px',
        }}
      >
        <div className="pauses-adinkra-side-col" style={{ paddingTop: 6 }}>
          <PausesAdinkraSidePillarSvg side="left" />
        </div>

        <main
          style={{
            background: darkMode
              ? 'linear-gradient(180deg, #1A140F 0%, #14100C 100%)'
              : 'var(--pt-surface)',
            border: '1.5px solid rgba(196, 147, 74, 0.45)',
            borderRadius: 18,
            padding: '18px 22px 24px',
            boxShadow: '0 22px 50px rgba(0, 0, 0, 0.52)',
          }}
        >
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
            onToggleTheme={toggleTheme}
            onBackDashboard={() => navigate('/dashboard')}
            onToggleAddForm={() => setShowForm((prev) => !prev)}
            showAddForm={showForm}
            onExportCsv={exporterCsv}
          />

          {/* Formulaire de saisie manuelle d'une pause réelle par l'admin */}
          {showForm && (
            <section
              aria-label="Nouvelle pause réelle"
              style={{
                background: 'rgba(28, 21, 15, 0.96)',
                border: '1px solid rgba(226, 168, 75, 0.5)',
                borderRadius: 14,
                padding: '16px 18px',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '0.96rem', color: '#F3C784', fontWeight: 800 }}>
                  Nouvelle pause réelle (correction / saisie manuelle par l’administrateur)
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
                  className="employes-card-select-box"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  style={{ margin: 0 }}
                >
                  <option value="">— Collaborateur —</option>
                  {employes.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.matricule})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="employes-card-select-box"
                  value={form.jour}
                  onChange={(e) => setForm({ ...form, jour: e.target.value })}
                  style={{ margin: 0 }}
                />
                <input
                  type="time"
                  className="employes-card-select-box"
                  value={form.debut}
                  onChange={(e) => setForm({ ...form, debut: e.target.value })}
                  style={{ margin: 0 }}
                />
                <input
                  type="time"
                  className="employes-card-select-box"
                  value={form.fin}
                  onChange={(e) => setForm({ ...form, fin: e.target.value })}
                  style={{ margin: 0 }}
                />
                <input
                  type="text"
                  className="employes-card-select-box"
                  placeholder="Motif (facultatif)"
                  value={form.motif}
                  onChange={(e) => setForm({ ...form, motif: e.target.value })}
                  style={{ margin: 0 }}
                />
                <button
                  type="button"
                  className="employes-add-pill-btn"
                  onClick={creerPause}
                  style={{ justifyContent: 'center' }}
                >
                  Enregistrer la pause réelle
                </button>
              </div>
            </section>
          )}

          {/* 4 Cartes KPI exécutives */}
          <PausesExecutiveKpis
            paies={paies}
            activeTab={activeTab}
            subFilter={subFilter}
            onSelectTab={setActiveTab}
            onSelectSubFilter={setSubFilter}
            nowMs={nowMs}
          />

          {/* 2 Graphiques analytiques (Activité 24h Réelles vs Présumées + Donut Répartition) */}
          <PausesAnalyticsCharts
            paies={paies}
            onSelectTab={(tab) => {
              setActiveTab(tab)
              setSubFilter('all')
            }}
          />

          {/* Liste des pauses collaborateurs (Historique des pauses réelles vs Pauses présumées) */}
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
            onOpenPointages={(p) =>
              navigate(`/pointages?search=${encodeURIComponent(p.employe || p.matricule || '')}`)
            }
          />
        </main>

        <div className="pauses-adinkra-side-col" style={{ paddingTop: 6 }}>
          <PausesAdinkraSidePillarSvg side="right" />
        </div>
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
