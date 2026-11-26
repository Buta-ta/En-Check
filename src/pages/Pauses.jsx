import PageCulturalBand from '../components/PageCulturalBand'
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
import { Coffee, Check, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import {
  construirePauses,
  estPausePresumee,
  estPauseReelleEffectuee,
  exportCsvPauses,
} from '../services/pausesService'
import PausesLoadingScreen from '../components/PausesLoadingScreen'
import useLoadingMinimum from '../hooks/useLoadingMinimum'
import {
  PausesAnalyticsCharts,
  PausesCollaborateursSection,
  PausesCorbeille,
  PausesJournalDecisions,
  PausesCulturalHero,
  PausesExecutiveKpis,
} from '../components/PausesAfroTechSections'
import FicheEmployeModal from '../components/FicheEmployeModal'
import { formaterHeureLocale, jourLocal } from '../utils/timezoneUtils'
import toast from 'react-hot-toast'
import './PointagesAfroTech.css'


//  Les champs date et heure natifs s'affichent dans la langue du NAVIGATEUR :
//  sur une machine réglée en anglais, le 26/11/2026 devient « 11/26/2026 » et
//  midi devient « 12:00 PM ». On garde donc des champs texte, écrits au format
//  français, et on convertit pour le formulaire.
const isoVersFr = (iso) => {
  const [a, m, j] = String(iso || '').split('-')
  return a && m && j ? `${j}/${m}/${a}` : ''
}
const frVersIso = (fr) => {
  const [j, m, a] = String(fr || '').split('/')
  return j?.length === 2 && m?.length === 2 && a?.length === 4 ? `${a}-${m}-${j}` : ''
}
//  Saisie souple : « 9:5 », « 9h05 », « 0905 » deviennent tous « 09:05 ».
const normaliserHeure = (valeur) => {
  const brut = String(valeur || '').trim().toLowerCase().replace('h', ':')
  const compact = brut.replace(/[^0-9]/g, '')
  if (!compact) return ''
  const h = compact.length <= 2 ? compact : compact.slice(0, compact.length - 2)
  const mn = compact.length <= 2 ? '00' : compact.slice(-2)
  return `${String(Number(h)).padStart(2, '0')}:${mn}`
}

export default function Pauses () {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()
  const todayIso = jourLocal(new Date()) || new Date().toISOString().split('T')[0]

  const [admin, setAdmin] = useState(null)
  const [paies, setPaies] = useState([])
  const [corbeille, setCorbeille] = useState([])
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
      //    Deux juges, deux questions différentes :
      //      · `encheck_pauses_controler` → sans reprise / très longue ;
      //      · `encheck_pauses_juger_lot` → écart au créneau de la grille
      //        au-delà de la tolérance réglée par l'entreprise.
      //    Le second est idempotent : il ne rejuge pas ce qui est déjà marqué,
      //    et n'alerte qu'une fois. Il tourne ici pour que le badge apparaisse
      //    même sur les pauses fermées avant que la règle existe.
      if (entArg) {
        await supabase.rpc('encheck_pauses_controler', { p_enterprise: entArg })
        await supabase.rpc('encheck_pauses_juger_lot', { p_enterprise: entArg, p_jours: 30 })
      } else if (entreprises.length > 0) {
        await Promise.allSettled(
          entreprises.map((ent) =>
            supabase.rpc('encheck_pauses_controler', { p_enterprise: ent.id })
          )
        )
        await Promise.allSettled(
          entreprises.map((ent) =>
            supabase.rpc('encheck_pauses_juger_lot', { p_enterprise: ent.id, p_jours: 30 })
          )
        )
      }

      const { data: lignes, error } = await supabase.rpc('encheck_pauses_lire', {
        p_enterprise: entArg,
        p_du: startDate,
        p_au: endDate,
      })
      if (error) throw error

      // ── FILET DE LECTURE DIRECTE ──────────────────────────────────────────
      // `encheck_pauses_lire` est une FONCTION : si elle omet une ligne — dérive
      // de version entre le dépôt et la base de production, jointure cassée,
      // filtre de période — la pause devient introuvable à l'écran alors
      // qu'elle est bien dans la table. C'est exactement le symptôme
      // « j'ai validé et je ne retrouve plus la pause nulle part ».
      // On relit donc la table ELLE-MÊME, et toute ligne que la fonction n'a
      // pas renvoyée est récupérée et marquée `recupereeDirecte`.
      // Rien n'est inventé : on affiche ce qui existe réellement en base.
      let lignesDirectes = []
      try {
        let direct = supabase
          .from('encheck_pauses')
          .select(
            'id, enterprise_id, employee_id, jour, debut, fin, duree_minutes, statut, source, motif, anomalie, employees(id, first_name, last_name, matricule)'
          )
          .gte('jour', startDate)
          .lte('jour', endDate)
        if (entArg) direct = direct.eq('enterprise_id', entArg)
        const { data: brut, error: errDirect } = await direct
        if (errDirect) throw errDirect
        lignesDirectes = brut || []
      } catch (eDirect) {
        console.warn('[pauses] lecture directe indisponible :', eDirect)
      }

      const idsRpc = new Set((lignes || []).map((l) => l.id))
      const manquantes = lignesDirectes
        .filter((l) => l && !idsRpc.has(l.id))
        .map((l) => ({ ...l, recupereeDirecte: true }))

      const { paies: liste } = construirePauses([...(lignes || []), ...manquantes])
      const enriched = liste.map((p) => {
        const planned = hasPlannedBreakForEmployee(p.employe_id, p.enterprise_id || entArg)
        const nomEntreprise = p.entreprise_nom ||
          (entreprises || []).find((x) => x.id === p.enterprise_id)?.name ||
          ''
        return {
          ...p,
          entreprise_nom: nomEntreprise,
          debutHHMM: p.debutISO ? formaterHeureLocale(p.debutISO).slice(0, 5) : p.debutHHMM,
          finHHMM: p.finISO ? formaterHeureLocale(p.finISO).slice(0, 5) : p.finHHMM,
          estNonPlanifiee: estPauseReelleEffectuee(p) && !planned,
        }
      })
      setPaies(enriched)

      // ── Corbeille : tout ce qui a été supprimé, pour tout remettre ─────────
      //  Fonctionnalité optionnelle : si le script SQL du 21/10 n'est pas encore
      //  exécuté, la corbeille reste simplement vide.
      try {
        const { data: archives, error: errArch } = await supabase.rpc('encheck_pauses_archives_lire', {
          p_enterprise: entArg,
          p_du: startDate,
          p_au: endDate,
        })
        setCorbeille(errArch ? [] : (archives || []))
      } catch {
        setCorbeille([])
      }
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

  //  Une décision ne doit JAMAIS donner l'impression d'effacer une pause :
  //  on annonce où la ligne atterrit, et on y emmène l'utilisateur.
  const statuer = async (ids, decision) => {
    const concernees = (paies || []).filter((p) => ids.includes(p.id))
    const { error } = await supabase.rpc('encheck_pauses_statuer', {
      p_ids: ids,
      p_decision: decision,
      p_motif: null,
    })
    if (error) {
      toast.error('Erreur lors de la décision')
      return
    }

    if (decision === 'ecarter') {
      setActiveTab('all')
      setSubFilter('ecartees')
      toast.success('Pause écartée 🚫 — retrouvable dans « Écartées » et dans le journal')
    } else {
      const presumee = concernees.some((p) => estPausePresumee(p))
      if (presumee) {
        setActiveTab('presumees')
        setSubFilter('presumees_validees')
        toast.success('Pause validée ✅ — classée dans « Présumées → Validées »')
      } else {
        setActiveTab('reelles')
        setSubFilter('all')
        toast.success('Pause validée ✅ — toujours listée dans « Pauses réelles »')
      }
    }
    setSearchTerm('')
    loadPauses()
  }

  //  Ramener une pause du journal dans le tableau, quel que soit le filtre actif.
  const voirPause = useCallback((p) => {
    if (!p) return
    setSearchTerm('')
    if (p.statut === 'ecartee') {
      setActiveTab('all')
      setSubFilter('ecartees')
    } else if (estPausePresumee(p)) {
      setActiveTab('presumees')
      setSubFilter(p.statut === 'validee' ? 'presumees_validees' : 'all')
    } else {
      setActiveTab('reelles')
      setSubFilter('all')
    }
    const cible = document.querySelector('.pauses-v2-table-wrap')
    if (cible && typeof cible.scrollIntoView === 'function') {
      cible.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  //  Annuler une décision : la pause revient à son statut d'origine.
  //  La voie propre passe par la fonction SQL (journal d'audit). Si elle n'est
  //  pas encore déployée, repli par écriture directe sur la table.
  const annulerDecision = useCallback(
    async (p) => {
      if (!p || !p.id) return
      const { error } = await supabase.rpc('encheck_pauses_annuler_decision', {
        p_ids: [p.id],
        p_motif: 'annulé depuis le journal des décisions',
      })
      if (!error) {
        toast.success('Décision annulée — la pause est revenue à son statut d’origine')
        loadPauses()
        return
      }
      const { error: errDirect } = await supabase
        .from('encheck_pauses')
        .update({ statut: p.source === 'presumee' ? 'presumee' : 'reelle' })
        .eq('id', p.id)
      if (errDirect) {
        toast.error(
          'Annulation impossible : exécutez le script SQL du 21/10 (encheck_pauses_annuler_decision)'
        )
        return
      }
      toast.success('Décision annulée — la pause est revenue dans la liste')
      loadPauses()
    },
    [loadPauses]
  )

  //  Supprimer une pause : possible, mais JAMAIS en silence.
  //  La ligne est archivée en base avant l'effacement, et redevient remetable
  //  depuis la corbeille.
  const supprimerPause = async (p) => {
    if (!p || !p.id) return
    const ouverte = p.ouverte ? ' (pause en cours)' : ''
    const ok = window.confirm(
      `Supprimer la pause de ${p.employe || 'cet employé'} du ${p.jour || ''} — ${p.debutHHMM || '--:--'} → ${p.finHHMM || 'en cours'}${ouverte} ?\n\n` +
        'La ligne sera archivée : elle restera consultable et remetable depuis la corbeille.',
    )
    if (!ok) return
    const { error } = await supabase.rpc('encheck_pauses_supprimer', {
      p_ids: [p.id],
      p_motif: 'supprimée depuis la page Pauses',
    })
    if (error) {
      toast.error('Suppression impossible : exécutez le script SQL du 21/10 (encheck_pauses_supprimer)')
      return
    }
    toast.success('Pause supprimée 🗑️ — archivée, remetable depuis la corbeille')
    loadPauses()
  }

  const restaurerPause = useCallback(
    async (ligne) => {
      if (!ligne || !ligne.journal_id) return
      const { error } = await supabase.rpc('encheck_pauses_restaurer', {
        p_journal_ids: [ligne.journal_id],
      })
      if (error) {
        toast.error('Restauration impossible : exécutez le script SQL du 21/10 (encheck_pauses_restaurer)')
        return
      }
      toast.success('Pause remise dans la liste ♻️')
      loadPauses()
    },
    [loadPauses]
  )

  const creerPause = async () => {
    //  Le champ date est en cours de frappe : on convertit avant d'envoyer,
    //  pour ne pas dépendre de la perte de focus.
    const jour = form.jourTexte !== undefined ? frVersIso(form.jourTexte) : form.jour
    const debut = normaliserHeure(form.debut).length === 5 ? normaliserHeure(form.debut) : form.debut
    const fin = normaliserHeure(form.fin).length === 5 ? normaliserHeure(form.fin) : form.fin
    if (!form.employee_id || !jour || !debut || !fin) {
      toast.error('Employé, jour et horaires sont obligatoires')
      return
    }
    const { data, error } = await supabase.rpc('encheck_pause_creer', {
      p_employee: form.employee_id,
      p_debut: `${jour}T${debut}:00`,
      p_fin: `${jour}T${fin}:00`,
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

  //  Même plancher que le Planning : la scène a le temps d'être vue, même
  //  quand la lecture est instantanée. La carte est celle de la page
  //  Employés, et elle annonce « prêt » sur la donnée réelle — pas sur le
  //  minuteur.
  if ((loading && paies.length === 0) || !minLoadingDone) {
    return (
      <PausesLoadingScreen
        darkMode={darkMode}
        dataReady={!loading && paies.length > 0}
        nomEntreprise={admin?.selectedEnterprise?.name || ''}
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
      <PageCulturalBand pathname="/pauses"/>

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

        {/*  Saisie manuelle d'une pause réelle — la « correction » de l'admin.

             « On doit retravailler ça » (image 2, 26/11). Le formulaire était
             une grille de champs natifs posée à même le panneau : le select et
             les champs date/heure gardaient le dessin du navigateur, l'intitulé
             flottait, et rien ne disait quel champ attendait quoi. Il devient
             une section à part entière : un en-tête qui explique, des champs
             étiquetés, et l'action principale de la page — le même bouton
             d'argile que « Ajouter une pause ». */}
        {showForm && (
          <section
            className="pauses-v2-saisie"
            aria-label="Nouvelle pause réelle"
          >
            <header className="pauses-v2-saisie-head">
              <span className="pauses-v2-saisie-icon" aria-hidden="true">
                <Coffee size={18} />
              </span>
              <div className="pauses-v2-saisie-copy">
                <h3 className="pauses-v2-saisie-title">Saisir une pause réelle</h3>
                <p className="pauses-v2-saisie-subtitle">
                  Correction ou saisie manuelle par l’administrateur — la pause
                  apparaît immédiatement dans la table, en « Pause réelle ».
                </p>
              </div>
              <button
                type="button"
                className="pauses-v2-saisie-close"
                onClick={() => setShowForm(false)}
                aria-label="Refermer la saisie"
              >
                <X size={16} />
              </button>
            </header>

            <div className="pauses-v2-saisie-grid">
              <label className="pauses-v2-field pauses-v2-field--large">
                <span className="pauses-v2-field-label">Collaborateur</span>
                <select
                  className="pauses-v2-field-input"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                >
                  <option value="">— Choisir un collaborateur —</option>
                  {employesForForm.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.matricule})
                    </option>
                  ))}
                </select>
              </label>

              <label className="pauses-v2-field">
                <span className="pauses-v2-field-label">Jour</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="pauses-v2-field-input"
                  placeholder="JJ/MM/AAAA"
                  value={form.jourTexte ?? isoVersFr(form.jour)}
                  onChange={(e) => setForm({ ...form, jourTexte: e.target.value })}
                  onBlur={(e) => {
                    const iso = frVersIso(e.target.value)
                    setForm({ ...form, jour: iso || form.jour, jourTexte: undefined })
                  }}
                />
              </label>

              <label className="pauses-v2-field">
                <span className="pauses-v2-field-label">Début</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="pauses-v2-field-input"
                  placeholder="HH:MM"
                  value={form.debut}
                  onChange={(e) => setForm({ ...form, debut: e.target.value })}
                  onBlur={(e) => setForm({ ...form, debut: normaliserHeure(e.target.value) || form.debut })}
                />
              </label>

              <label className="pauses-v2-field">
                <span className="pauses-v2-field-label">Fin</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="pauses-v2-field-input"
                  placeholder="HH:MM"
                  value={form.fin}
                  onChange={(e) => setForm({ ...form, fin: e.target.value })}
                  onBlur={(e) => setForm({ ...form, fin: normaliserHeure(e.target.value) || form.fin })}
                />
              </label>

              <label className="pauses-v2-field pauses-v2-field--motif">
                <span className="pauses-v2-field-label">Motif (facultatif)</span>
                <input
                  type="text"
                  className="pauses-v2-field-input"
                  placeholder="Pause prise hors borne, oubli de pointage…"
                  value={form.motif}
                  onChange={(e) => setForm({ ...form, motif: e.target.value })}
                />
              </label>
            </div>

            <footer className="pauses-v2-saisie-foot">
              <p className="pauses-v2-saisie-note">
                La ligne n’est jamais supprimée : elle rejoint le journal des
                décisions et reste retrouvable.
              </p>
              <button
                type="button"
                className="pauses-v2-saisie-submit"
                onClick={creerPause}
              >
                <Check size={17} strokeWidth={3} />
                <span>Enregistrer la pause</span>
              </button>
            </footer>
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

        {/* Corbeille : ce qui a été supprimé reste consultable et remetable */}
        <PausesCorbeille lignes={corbeille} onRestaurer={restaurerPause} />

        {/* Journal des décisions : aucune pause validée ou écartée ne se perd */}
        <PausesJournalDecisions
          paies={paies}
          onVoir={voirPause}
          onAnnuler={annulerDecision}
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
          onAnnulerDecision={annulerDecision}
          onSupprimer={supprimerPause}
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
      <PageCulturalBand pathname="/pauses" placement="bottom"/>
    </div>
  )
}
