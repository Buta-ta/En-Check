// ═══════════════════════════════════════════════════════════════════════════
// ⏸ PAGE PAUSES — déclarées, présumées, jamais inventées
// ═══════════════════════════════════════════════════════════════════════════
//  Doctrine (16/10/2026) : la pause RÉELLE pointée gagne ; à défaut, le
//  créneau de la grille donne une pause PRÉSUMÉE (marquée) ; l'admin statue
//  (Valider / Écarter — décision définitive, jamais de suppression).
//  Le moteur (`encheck_pauses_controler`) tourne au chargement : présumées et
//  anomalies sont toujours à jour avant l'affichage.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  construirePauses,
  badgeStatut,
  badgeAnomalie,
  formatDuree,
  exportCsvPauses,
} from '../services/pausesService'
import {
  Coffee, ArrowLeft, ChevronLeft, ChevronRight, Plus, Download,
  CheckCircle2, XCircle, AlertTriangle, Timer, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Pauses () {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [paies, setPaies] = useState([])
  const [stats, setStats] = useState({
    totalPauses: 0, nbReelles: 0, nbPresumees: 0, nbValidees: 0,
    nbEcartees: 0, nbOuvertes: 0, nbAnomalies: 0, dureeTotale: 0,
  })
  const [loading, setLoading] = useState(true)
  const [entreprises, setEntreprises] = useState([])
  const [employes, setEmployes] = useState([])
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [viewMode, setViewMode] = useState('semaine')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    employee_id: '', jour: new Date().toISOString().split('T')[0],
    debut: '12:00', fin: '13:00', motif: '',
  })

  useEffect(() => {
    const parsed = JSON.parse(localStorage.getItem('admin') || 'null')
    if (!parsed) { navigate('/login'); return }
    setAdmin(parsed)
    if (parsed.role === 'super_admin') {
      supabase.from('enterprises').select('id, name').eq('is_active', true).order('name')
        .then(({ data }) => setEntreprises(data || []))
    } else {
      setSelectedEntrepriseId(parsed.selectedEnterprise?.id || parsed.enterprise_id)
    }
    supabase.from('employees').select('id, first_name, last_name, matricule')
      .eq('is_active', true).order('last_name')
      .then(({ data }) => setEmployes(data || []))
  }, [navigate])

  const loadPauses = useCallback(async () => {
    if (!admin) return
    setLoading(true)
    try {
      const date = new Date(selectedDate)
      let startDate, endDate
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
      //  (présomption = marquage, jamais d'invention silencieuse)
      if (entArg) {
        await supabase.rpc('encheck_pauses_controler', { p_enterprise: entArg })
      }

      const { data: lignes, error } = await supabase.rpc('encheck_pauses_lire', {
        p_enterprise: entArg, p_du: startDate, p_au: endDate,
      })
      if (error) throw error

      const { paies: liste, stats: s } = construirePauses(lignes || [])
      setPaies(liste)
      setStats(s)
    } catch (e) {
      console.error('Erreur chargement pauses:', e)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }, [admin, selectedDate, selectedEntrepriseId, viewMode])

  useEffect(() => { loadPauses() }, [loadPauses])

  const statuer = async (ids, decision) => {
    const { error } = await supabase.rpc('encheck_pauses_statuer', {
      p_ids: ids, p_decision: decision, p_motif: null,
    })
    if (error) { toast.error('Erreur lors de la décision'); return }
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
    toast.success('Pause enregistrée ✅')
    setShowForm(false)
    setForm({ ...form, motif: '' })
    loadPauses()
  }

  const exporterCsv = () => {
    const csv = exportCsvPauses(paies)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pauses-${selectedDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const shiftDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  return (
    <div style={styles.page}>
      <style>{`
        .afro-pause-card:hover { transform: translateY(-2px); border-color: rgba(245,158,11,0.3) !important; }
        .afro-pause-btn:hover { transform: scale(1.04); }
      `}</style>

      {/* ── EN-TÊTE ─────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} /> Retour
        </button>
        <div style={styles.headerTitle}>
          <Coffee size={26} color="#F59E0B" />
          <div>
            <h1 style={styles.title}>PAUSES</h1>
            <p style={styles.subtitle}>Réelles pointées · présumées marquées · l'admin statue</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> Ajouter une pause
          </button>
          <button style={styles.ghostBtn} onClick={exporterCsv}>
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      {/* ── FORMULAIRE DE CRÉATION MANUELLE ─────────────────────────────── */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Nouvelle pause (correction manuelle)</h3>
          <div style={styles.formGrid}>
            <select style={styles.input}
              value={form.employee_id}
              onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">— Employé —</option>
              {employes.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.matricule})
                </option>
              ))}
            </select>
            <input type="date" style={styles.input} value={form.jour}
              onChange={e => setForm({ ...form, jour: e.target.value })} />
            <input type="time" style={styles.input} value={form.debut}
              onChange={e => setForm({ ...form, debut: e.target.value })} />
            <input type="time" style={styles.input} value={form.fin}
              onChange={e => setForm({ ...form, fin: e.target.value })} />
            <input type="text" style={styles.input} placeholder="Motif (facultatif)"
              value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })} />
            <button style={styles.primaryBtn} onClick={creerPause}>Enregistrer</button>
          </div>
        </div>
      )}

      {/* ── FILTRES ─────────────────────────────────────────────────────── */}
      <div style={styles.filtersBar}>
        <div style={styles.segment}>
          {['jour', 'semaine', 'mois'].map(mode => (
            <button key={mode}
              style={viewMode === mode ? styles.segActive : styles.segBtn}
              onClick={() => setViewMode(mode)}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div style={styles.dateNav}>
          <button style={styles.navBtn} onClick={() => shiftDate(-1)}><ChevronLeft size={18} /></button>
          <span style={styles.dateLabel}>{selectedDate}</span>
          <button style={styles.navBtn} onClick={() => shiftDate(1)}><ChevronRight size={18} /></button>
        </div>
        {admin?.role === 'super_admin' && (
          <select style={styles.select} value={selectedEntrepriseId}
            onChange={e => setSelectedEntrepriseId(e.target.value)}>
            <option value="all">Toutes les entreprises</option>
            {entreprises.map(ent => (
              <option key={ent.id} value={ent.id}>{ent.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── STATISTIQUES ────────────────────────────────────────────────── */}
      <div style={styles.statsGrid}>
        <StatCard icon={Coffee} color="#F59E0B" value={stats.totalPauses} label="Pauses" />
        <StatCard icon={CheckCircle2} color="#10B981" value={stats.nbReelles + stats.nbValidees} label="Réelles" />
        <StatCard icon={Timer} color="#F59E0B" value={stats.nbPresumees} label="Présumées" />
        <StatCard icon={AlertTriangle} color="#EF4444" value={stats.nbAnomalies} label="Anomalies" />
        <StatCard icon={Users} color="#8B5CF6" value={formatDuree(stats.dureeTotale)} label="Temps de pause" />
      </div>

      {/* ── LISTE ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={styles.empty}><p style={styles.emptyText}>Chargement…</p></div>
      ) : paies.length === 0 ? (
        <div style={styles.empty}>
          <Coffee size={40} color="#555" />
          <p style={styles.emptyTitle}>Aucune pause sur la période</p>
          <p style={styles.emptyText}>
            Les pauses pointées apparaissent ici ; à défaut, le moteur présume
            le créneau de la grille (marqué « Présumée »).
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {paies.map(p => {
            const badge = badgeStatut(p.statut)
            const anomalie = badgeAnomalie(p.anomalie)
            return (
              <div key={p.id} className="afro-pause-card" style={styles.card}>
                <div style={{ ...styles.avatar, background: `${badge.color}22`, color: badge.color }}>
                  {p.employe.split(' ').map(m => m[0]).slice(0, 2).join('')}
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.cardTitleRow}>
                    <span style={styles.cardName}>{p.employe}</span>
                    <span style={styles.cardDate}>{p.jour}</span>
                  </div>
                  <span style={styles.cardMatricule}>
                    {p.matricule} · {p.entreprise_nom}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span style={{ ...styles.badge, background: `${badge.color}15`, color: badge.color, border: `1px solid ${badge.color}30` }}>
                      {badge.label}
                    </span>
                    {anomalie && (
                      <span style={{ ...styles.badge, background: `${anomalie.color}15`, color: anomalie.color, border: `1px solid ${anomalie.color}30` }}>
                        {anomalie.label}
                      </span>
                    )}
                    {p.motif && <span style={styles.motif}>« {p.motif} »</span>}
                  </div>
                </div>

                <div style={styles.hours}>
                  <div style={styles.hourItem}>
                    <span style={styles.hourLabel}>Début</span>
                    <span style={styles.hourValue}>{p.debutHHMM}</span>
                  </div>
                  <span style={styles.hourArrow}>→</span>
                  <div style={styles.hourItem}>
                    <span style={styles.hourLabel}>Reprise</span>
                    <span style={p.ouverte ? styles.hourOpen : styles.hourValue}>
                      {p.ouverte ? 'ouverte…' : p.finHHMM}
                    </span>
                  </div>
                  <div style={styles.dureeBadge}>{formatDuree(p.dureeMinutes)}</div>
                </div>

                {p.aStatuer && (
                  <div style={styles.actions}>
                    <button className="afro-pause-btn" style={styles.validerBtn}
                      onClick={() => statuer([p.id], 'valider')}>
                      <CheckCircle2 size={14} /> Valider
                    </button>
                    <button className="afro-pause-btn" style={styles.ecarterBtn}
                      onClick={() => statuer([p.id], 'ecarter')}>
                      <XCircle size={14} /> Écarter
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard ({ icon: Icon, color, value, label }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: `${color}15` }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#0A0A0F', padding: '24px', color: '#fff' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: '12px' },
  title: { fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '1px' },
  subtitle: { fontSize: '12px', color: '#888', margin: 0 },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', fontWeight: '700', border: 'none', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' },
  ghostBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#ddd', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' },
  formCard: { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '14px', padding: '16px', marginBottom: '18px' },
  formTitle: { margin: '0 0 12px', fontSize: '14px', color: '#F59E0B' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '9px 10px', borderRadius: '8px', fontSize: '13px' },
  filtersBar: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' },
  segment: { display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px', gap: '2px' },
  segBtn: { background: 'transparent', border: 'none', color: '#999', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', textTransform: 'capitalize' },
  segActive: { background: 'rgba(245,158,11,0.2)', border: 'none', color: '#F59E0B', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize' },
  dateNav: { display: 'flex', alignItems: 'center', gap: '8px' },
  navBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer' },
  dateLabel: { fontSize: '13px', color: '#ddd', fontWeight: '600' },
  select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '8px 12px', borderRadius: '10px', fontSize: '12px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '22px' },
  statCard: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px' },
  statIcon: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: '20px', fontWeight: '800' },
  statLabel: { fontSize: '11px', color: '#888' },
  empty: { textAlign: 'center', padding: '60px 20px' },
  emptyTitle: { fontSize: '16px', fontWeight: '700', color: '#ccc', marginTop: '12px' },
  emptyText: { fontSize: '12px', color: '#777', marginTop: '6px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.6' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 16px', transition: 'all 0.2s ease' },
  avatar: { width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  cardName: { fontSize: '14px', fontWeight: '700' },
  cardDate: { fontSize: '11px', color: '#888' },
  cardMatricule: { fontSize: '11px', color: '#777' },
  badge: { padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600' },
  motif: { fontSize: '10px', color: '#999', fontStyle: 'italic' },
  hours: { display: 'flex', alignItems: 'center', gap: '12px' },
  hourItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '52px' },
  hourLabel: { fontSize: '10px', color: '#777' },
  hourValue: { fontSize: '15px', fontWeight: '700' },
  hourOpen: { fontSize: '15px', fontWeight: '700', color: '#EF4444' },
  hourArrow: { color: '#666', fontSize: '14px' },
  dureeBadge: { background: 'rgba(139,92,246,0.15)', color: '#A78BFA', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' },
  actions: { display: 'flex', flexDirection: 'column', gap: '6px' },
  validerBtn: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#10B981', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' },
  ecarterBtn: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' },
}
