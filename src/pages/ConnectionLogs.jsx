// src/pages/ConnectionLogs.jsx
// ═══════════════════════════════════════════════════════════
// 📋 JOURNAL DES CONNEXIONS — avec suppression + responsive
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, Users, Building2, Clock, Monitor, Smartphone,
  Tablet, CheckCircle, XCircle, Filter, Download, RefreshCw,
  Globe, Shield, UserCircle, ArrowLeft, Calendar, MapPin,
  TrendingUp, AlertTriangle, Trash2, X, CheckSquare, Square
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import ConnectionLogService from '../services/connectionLogService'
import toast from 'react-hot-toast'

export default function ConnectionLogs() {
  const [admin, setAdmin] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [entreprises, setEntreprises] = useState([])
  const [stats, setStats] = useState(null)
  const [expandedLog, setExpandedLog] = useState(null)

  // ── Sélection & suppression ──
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteType, setDeleteType] = useState(null) // 'selected' | 'all' | 'old'
  const [deleteOlderDays, setDeleteOlderDays] = useState(30)
  const [deleting, setDeleting] = useState(false)

  const [filters, setFilters] = useState({
    user_type: '',
    enterprise_id: 'all',
    success: '',
    date_from: '',
    date_to: '',
  })

  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    const parsed = JSON.parse(adminData)
    if (parsed.role !== 'super_admin') {
      navigate('/dashboard')
      toast.error('Accès réservé aux super admins')
      return
    }
    setAdmin(parsed)
    loadEntreprises()
  }, [navigate])

  useEffect(() => {
    if (admin) {
      loadLogs()
      loadStats()
    }
  }, [admin, filters])

  const loadEntreprises = async () => {
    try {
      const { data } = await supabase
        .from('enterprises')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      setEntreprises(data || [])
    } catch (e) {
      console.error('Erreur chargement entreprises:', e)
    }
  }

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ConnectionLogService.getLogs({
        ...filters,
        success: filters.success === '' ? undefined : filters.success === 'true',
      })
      setLogs(data)
    } catch (e) {
      console.error('Erreur chargement logs:', e)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }, [filters])

  const loadStats = useCallback(async () => {
    try {
      const data = await ConnectionLogService.getStats(
        filters.enterprise_id === 'all' ? null : filters.enterprise_id,
        7
      )
      setStats(data)
    } catch (e) {
      console.error('Erreur chargement stats:', e)
    }
  }, [filters.enterprise_id])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadLogs(), loadStats()])
    setRefreshing(false)
    toast.success('Données actualisées')
  }

  // ── GESTION SÉLECTION ──
  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(logs.map(l => l.id)))
    }
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  // ── SUPPRESSION ──
  const openDeleteModal = (type) => {
    setDeleteType(type)
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      let count = 0

      if (deleteType === 'selected') {
        const ids = Array.from(selectedIds)
        const { error } = await supabase
          .from('connection_logs')
          .delete()
          .in('id', ids)
        if (error) throw error
        count = ids.length

      } else if (deleteType === 'all') {
        // Supprimer tous les logs visibles (filtrés)
        const ids = logs.map(l => l.id)
        if (ids.length === 0) {
          toast.error('Aucun log à supprimer')
          setDeleting(false)
          return
        }
        // Supprimer par batch de 100
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100)
          const { error } = await supabase
            .from('connection_logs')
            .delete()
            .in('id', batch)
          if (error) throw error
        }
        count = ids.length

      } else if (deleteType === 'old') {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - deleteOlderDays)
        const { data, error } = await supabase
          .from('connection_logs')
          .delete()
          .lt('connected_at', cutoffDate.toISOString())
          .select('id')
        if (error) throw error
        count = data?.length || 0
      }

      toast.success(`${count} trace${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}`)
      setDeleteModalOpen(false)
      setSelectedIds(new Set())
      setSelectionMode(false)
      await Promise.all([loadLogs(), loadStats()])

    } catch (e) {
      console.error('Erreur suppression:', e)
      toast.error('Erreur lors de la suppression')
    }
    setDeleting(false)
  }

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'mobile': return <Smartphone size={14} color="#10B981" />
      case 'tablet': return <Tablet size={14} color="#6366F1" />
      default: return <Monitor size={14} color="#F59E0B" />
    }
  }

  const getDeviceLabel = (type) => {
    switch (type) {
      case 'mobile': return 'Mobile'
      case 'tablet': return 'Tablette'
      default: return 'Desktop'
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins}min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  const exportCSV = () => {
    if (logs.length === 0) {
      toast.error('Aucune donnée à exporter')
      return
    }
    const headers = ['Date', 'Type', 'Nom', 'Email/Matricule', 'Entreprise', 'IP', 'Ville', 'Pays', 'Appareil', 'Statut', 'Raison échec']
    const rows = logs.map(log => [
      formatDate(log.connected_at),
      log.user_type === 'admin' ? 'Admin' : 'Employé',
      log.user_type === 'admin'
        ? `${log.admins?.first_name || ''} ${log.admins?.last_name || ''}`.trim() || 'N/A'
        : `${log.employees?.first_name || ''} ${log.employees?.last_name || ''}`.trim() || 'N/A',
      log.user_type === 'admin'
        ? (log.admins?.email || 'N/A')
        : (log.employees?.matricule || log.employees?.email || 'N/A'),
      log.enterprises?.name || 'N/A',
      log.ip_address || 'N/A',
      log.city || 'N/A',
      log.country || 'N/A',
      getDeviceLabel(log.device_type),
      log.success ? 'Succès' : 'Échec',
      log.failure_reason || '',
    ])

    const csvContent = [headers.join(';'), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `connexions_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`${logs.length} connexions exportées`)
  }

  const resetFilters = () => {
    setFilters({
      user_type: '',
      enterprise_id: 'all',
      success: '',
      date_from: '',
      date_to: '',
    })
  }

  const hasActiveFilters = filters.user_type || filters.enterprise_id !== 'all' || filters.success || filters.date_from || filters.date_to

  const successRate = logs.length > 0
    ? Math.round((logs.filter(l => l.success).length / logs.length) * 100)
    : 0

  if (!admin) return null

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .log-row {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .log-row:hover {
          background: rgba(255,255,255,0.04) !important;
          border-left-color: rgba(16,185,129,0.5) !important;
        }
        .log-row-selected {
          background: rgba(245,158,11,0.06) !important;
          border-left-color: rgba(245,158,11,0.5) !important;
        }
        .filter-select:focus { outline: none; }
        .filter-input:focus { outline: none; }
        select option { background: #141423; color: #E5E5E5; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        .checkbox-btn {
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .checkbox-btn:hover {
          transform: scale(1.1);
        }
        .delete-btn:hover {
          background: rgba(239,68,68,0.2) !important;
          border-color: rgba(239,68,68,0.4) !important;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .table-header-desktop { display: none !important; }
          .table-row-desktop { display: none !important; }
          .mobile-log-card { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .mobile-log-card { display: none !important; }
        }
        @media (max-width: 768px) {
          .header-responsive-logs {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .stats-grid-logs {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .filters-bar-logs {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .header-btns-logs {
            width: 100% !important;
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
          }
        }
        @media (max-width: 480px) {
          .stats-grid-logs {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

      <div style={S.container}>
        <PageHeader title="JOURNAL DES CONNEXIONS" />

        <main style={S.main}>

          {/* ── HEADER ── */}
          <div className="header-responsive-logs" style={S.header}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={S.backBtn}>
                <ArrowLeft size={18} />
              </button>
              <div style={S.headerIcon}>
                <Activity size={24} color="#10B981" />
              </div>
              <div>
                <h1 style={S.title}>Journal des connexions</h1>
                <p style={S.subtitle}>
                  Suivi des accès admin et employés
                  {!loading && logs.length > 0 && (
                    <span style={{ marginLeft: '8px', color: successRate >= 90 ? '#10B981' : successRate >= 70 ? '#F59E0B' : '#EF4444' }}>
                      • {successRate}% de succès
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="header-btns-logs" style={S.headerRight}>
              {/* Bouton mode sélection */}
              {!selectionMode ? (
                <button
                  onClick={() => setSelectionMode(true)}
                  style={S.selectModeBtn}
                  title="Mode sélection"
                >
                  <Trash2 size={16} />
                  <span className="btn-label-desktop">Supprimer</span>
                </button>
              ) : (
                <div style={S.selectionBar}>
                  <span style={{ color: '#F59E0B', fontSize: '13px', fontWeight: '600' }}>
                    {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    style={S.selectAllBtn}
                  >
                    {selectedIds.size === logs.length ? <CheckSquare size={14} /> : <Square size={14} />}
                    Tout
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => openDeleteModal('selected')}
                      className="delete-btn"
                      style={S.deleteSelectedBtn}
                    >
                      <Trash2 size={14} />
                      Supprimer ({selectedIds.size})
                    </button>
                  )}
                  <button onClick={exitSelectionMode} style={S.cancelSelectionBtn}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Purge anciens logs */}
              <button
                onClick={() => openDeleteModal('old')}
                className="delete-btn"
                style={S.purgeBtn}
                title="Purger les anciennes traces"
              >
                <Clock size={16} />
                <span className="btn-label-desktop">Purger</span>
              </button>

              <button
                onClick={() => navigate('/connexions-map')}
                style={S.mapBtn}
              >
                <Globe size={16} />
                <span className="btn-label-desktop">Carte</span>
              </button>
              <button
                onClick={handleRefresh}
                style={S.refreshBtn}
                title="Rafraîchir"
                disabled={refreshing}
              >
                <RefreshCw
                  size={16}
                  style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}}
                />
              </button>
              <button onClick={exportCSV} style={S.exportBtn}>
                <Download size={16} />
                <span className="btn-label-desktop">Exporter</span>
              </button>
            </div>
          </div>

          {/* ── STATS ── */}
          {stats ? (
            <div className="stats-grid-logs" style={S.statsGrid}>
              <div style={S.statCard}>
                <div style={{ ...S.statIcon, background: 'rgba(16,185,129,0.15)' }}>
                  <Activity size={20} color="#10B981" />
                </div>
                <div>
                  <span style={S.statValue}>{stats.totalConnections}</span>
                  <span style={S.statLabel}>Connexions (7j)</span>
                </div>
              </div>
              <div style={S.statCard}>
                <div style={{ ...S.statIcon, background: 'rgba(99,102,241,0.15)' }}>
                  <Shield size={20} color="#6366F1" />
                </div>
                <div>
                  <span style={S.statValue}>{stats.adminConnections}</span>
                  <span style={S.statLabel}>Admins ({stats.uniqueAdmins} uniq.)</span>
                </div>
              </div>
              <div style={S.statCard}>
                <div style={{ ...S.statIcon, background: 'rgba(249,115,22,0.15)' }}>
                  <Users size={20} color="#F97316" />
                </div>
                <div>
                  <span style={S.statValue}>{stats.employeeConnections}</span>
                  <span style={S.statLabel}>Employés ({stats.uniqueEmployees} uniq.)</span>
                </div>
              </div>
              <div style={S.statCard}>
                <div style={{ ...S.statIcon, background: successRate >= 90 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                  <TrendingUp size={20} color={successRate >= 90 ? '#10B981' : '#EF4444'} />
                </div>
                <div>
                  <span style={{ ...S.statValue, color: successRate >= 90 ? '#10B981' : successRate >= 70 ? '#F59E0B' : '#EF4444' }}>
                    {successRate}%
                  </span>
                  <span style={S.statLabel}>Taux de succès</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="stats-grid-logs" style={S.statsGrid}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={S.statCard}>
                  <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '24px', width: '60px', marginBottom: '6px' }} />
                    <div className="skeleton" style={{ height: '12px', width: '80px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FILTRES ── */}
          <div className="filters-bar-logs" style={S.filtersBar}>
            <div style={S.filterGroup}>
              <Filter size={14} color="#666" />
              <select
                className="filter-select"
                value={filters.user_type}
                onChange={(e) => setFilters({ ...filters, user_type: e.target.value })}
                style={S.filterSelect}
              >
                <option value="">Tous types</option>
                <option value="admin">Admins</option>
                <option value="employee">Employés</option>
              </select>
            </div>

            <div style={S.filterGroup}>
              <Building2 size={14} color="#666" />
              <select
                className="filter-select"
                value={filters.enterprise_id}
                onChange={(e) => setFilters({ ...filters, enterprise_id: e.target.value })}
                style={S.filterSelect}
              >
                <option value="all">Toutes entreprises</option>
                {entreprises.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>

            <div style={S.filterGroup}>
              <CheckCircle size={14} color="#666" />
              <select
                className="filter-select"
                value={filters.success}
                onChange={(e) => setFilters({ ...filters, success: e.target.value })}
                style={S.filterSelect}
              >
                <option value="">Tous statuts</option>
                <option value="true">Succès</option>
                <option value="false">Échecs</option>
              </select>
            </div>

            <div style={S.filterGroup}>
              <Calendar size={14} color="#666" />
              <input
                type="date"
                className="filter-input"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                style={S.filterInput}
              />
              <span style={{ color: '#555', fontSize: '12px' }}>→</span>
              <input
                type="date"
                className="filter-input"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                style={S.filterInput}
              />
            </div>

            {hasActiveFilters && (
              <button onClick={resetFilters} style={S.resetFiltersBtn}>
                <XCircle size={13} /> Réinitialiser
              </button>
            )}

            <div style={{ marginLeft: 'auto', color: '#555', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
              {!loading && `${logs.length} résultat${logs.length > 1 ? 's' : ''}`}
            </div>
          </div>

          {/* ── TABLEAU DESKTOP ── */}
          <div style={S.tableWrap}>

            <div className="table-header-desktop" style={S.tableHeader}>
              {selectionMode && (
                <span style={{ width: '40px', flexShrink: 0 }}>
                  <button onClick={toggleSelectAll} className="checkbox-btn" style={{ background: 'none', border: 'none', color: '#F59E0B', padding: '4px', cursor: 'pointer' }}>
                    {selectedIds.size === logs.length && logs.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </span>
              )}
              <span style={{ ...S.th, flex: 2 }}>Utilisateur</span>
              <span style={S.th}>Entreprise</span>
              <span style={S.th}>Date</span>
              <span style={S.th}>Localisation</span>
              <span style={S.th}>Appareil</span>
              <span style={S.th}>IP</span>
              <span style={{ ...S.th, textAlign: 'center' }}>Statut</span>
              {selectionMode && <span style={{ ...S.th, width: '50px', flexShrink: 0, textAlign: 'center' }}>🗑️</span>}
            </div>

            {loading ? (
              <div>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="table-row-desktop" style={{ ...S.tableRow, borderLeftColor: 'transparent' }}>
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0 }} />
                      <div>
                        <div className="skeleton" style={{ height: '13px', width: '120px', marginBottom: '6px' }} />
                        <div className="skeleton" style={{ height: '11px', width: '80px' }} />
                      </div>
                    </div>
                    {[1, 2, 3, 4, 5].map(j => (
                      <div key={j} style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: '12px', width: `${50 + j * 10}px` }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div style={S.empty}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '18px',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Activity size={32} color="#333" />
                </div>
                <p style={{ color: '#666', fontSize: '15px', fontWeight: '600', margin: '0 0 8px' }}>
                  Aucune connexion trouvée
                </p>
                <p style={{ color: '#444', fontSize: '13px', margin: '0 0 20px' }}>
                  {hasActiveFilters ? 'Essayez de modifier vos filtres' : 'Aucune donnée disponible'}
                </p>
                {hasActiveFilters && (
                  <button onClick={resetFilters} style={{ ...S.resetFiltersBtn, alignSelf: 'center' }}>
                    <XCircle size={13} /> Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* ── LIGNES DESKTOP ── */}
                {logs.map((log, index) => (
                  <div key={log.id}>
                    <div
                      className={`log-row table-row-desktop ${selectedIds.has(log.id) ? 'log-row-selected' : ''}`}
                      style={{
                        ...S.tableRow,
                        animation: `fadeInUp 0.25s ease ${Math.min(index * 0.015, 0.3)}s forwards`,
                        opacity: 0,
                        borderLeftColor: log.user_type === 'admin'
                          ? 'rgba(99,102,241,0.5)'
                          : 'rgba(249,115,22,0.5)',
                        background: expandedLog === log.id
                          ? 'rgba(255,255,255,0.04)'
                          : selectedIds.has(log.id)
                            ? 'rgba(245,158,11,0.06)'
                            : 'transparent',
                      }}
                      onClick={() => {
                        if (selectionMode) {
                          toggleSelection(log.id)
                        } else {
                          setExpandedLog(expandedLog === log.id ? null : log.id)
                        }
                      }}
                    >
                      {selectionMode && (
                        <span style={{ width: '40px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <span className="checkbox-btn" style={{ color: selectedIds.has(log.id) ? '#F59E0B' : '#555' }}>
                            {selectedIds.has(log.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                          </span>
                        </span>
                      )}

                      {/* Utilisateur */}
                      <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          ...S.avatar,
                          background: log.user_type === 'admin'
                            ? 'rgba(99,102,241,0.15)'
                            : 'rgba(249,115,22,0.15)',
                        }}>
                          {log.employees?.photo_url ? (
                            <img
                              src={log.employees.photo_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                          ) : log.user_type === 'admin' ? (
                            <Shield size={14} color="#6366F1" />
                          ) : (
                            <UserCircle size={14} color="#F97316" />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={S.userName}>
                            {log.user_type === 'admin'
                              ? `${log.admins?.first_name || ''} ${log.admins?.last_name || ''}`.trim() || log.admins?.email || 'Admin'
                              : `${log.employees?.first_name || ''} ${log.employees?.last_name || ''}`.trim() || 'Employé'
                            }
                          </span>
                          <span style={S.userSub}>
                            {log.user_type === 'admin'
                              ? log.admins?.email || ''
                              : log.employees?.matricule || log.employees?.email || log.employees?.phone || ''
                            }
                          </span>
                        </div>
                      </div>

                      <span style={S.td}>
                        {log.enterprises?.name
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Building2 size={11} color="#555" />
                              {log.enterprises.name}
                            </span>
                          : <span style={{ color: '#444' }}>—</span>
                        }
                      </span>

                      <span style={S.td}>
                        <span style={{ display: 'block', fontSize: '12px', color: '#CCC' }}>
                          {formatDateShort(log.connected_at)}
                        </span>
                        <span style={{ display: 'block', fontSize: '10px', color: '#555', fontFamily: 'monospace', marginTop: '2px' }}>
                          {new Date(log.connected_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>

                      <span style={S.td}>
                        {log.city || log.country ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                            <MapPin size={11} color="#555" />
                            <span style={{ color: '#AAA' }}>
                              {[log.city, log.country_code || log.country].filter(Boolean).join(', ')}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#444', fontSize: '12px' }}>—</span>
                        )}
                      </span>

                      <span style={{ ...S.td, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getDeviceIcon(log.device_type)}
                        <span style={{ textTransform: 'capitalize', fontSize: '12px', color: '#AAA' }}>
                          {getDeviceLabel(log.device_type)}
                        </span>
                      </span>

                      <span style={{ ...S.td, fontFamily: 'monospace', fontSize: '10px', color: '#555' }}>
                        {log.ip_address || '—'}
                      </span>

                      <div style={{ ...S.td, textAlign: 'center' }}>
                        {log.success ? (
                          <span style={S.successBadge}>
                            <CheckCircle size={11} /> OK
                          </span>
                        ) : (
                          <span style={S.failBadge}>
                            <XCircle size={11} /> Échec
                          </span>
                        )}
                      </div>

                      {selectionMode && (
                        <span style={{ width: '50px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedIds(new Set([log.id]))
                              openDeleteModal('selected')
                            }}
                            style={{
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: '6px', padding: '4px 6px',
                              color: '#EF4444', cursor: 'pointer',
                              display: 'flex', alignItems: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      )}
                    </div>

                    {/* Détail expandé (desktop) */}
                    {expandedLog === log.id && !selectionMode && (
                      <div className="table-row-desktop" style={{ display: 'block', ...S.expandedRow }}>
                        <div style={S.expandedGrid}>
                          {[
                            { label: '📅 Date complète', value: formatDate(log.connected_at) },
                            { label: '🌐 IP', value: log.ip_address || '—' },
                            { label: '📍 Ville', value: log.city || '—' },
                            { label: '🗺️ Pays', value: log.country || '—' },
                            { label: '📱 Appareil', value: getDeviceLabel(log.device_type) },
                            { label: '🔗 User Agent', value: log.user_agent ? log.user_agent.substring(0, 60) + '...' : '—' },
                            ...(log.failure_reason ? [{ label: '⚠️ Raison échec', value: log.failure_reason, isError: true }] : []),
                            ...(log.latitude && log.longitude ? [{ label: '📌 Coordonnées', value: `${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}` }] : []),
                          ].map((item, i) => (
                            <div key={i} style={S.expandedItem}>
                              <span style={S.expandedLabel}>{item.label}</span>
                              <span style={{ ...S.expandedValue, color: item.isError ? '#EF4444' : '#CCC' }}>
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                          {log.latitude && log.longitude && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate('/connexions-map')
                              }}
                              style={S.expandedActionBtn}
                            >
                              <Globe size={12} /> Voir sur la carte
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedIds(new Set([log.id]))
                              openDeleteModal('selected')
                            }}
                            style={S.expandedDeleteBtn}
                          >
                            <Trash2 size={12} /> Supprimer cette trace
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* ── CARTES MOBILE ── */}
                {logs.map((log, index) => (
                  <div
                    key={`mobile-${log.id}`}
                    className={`mobile-log-card ${selectedIds.has(log.id) ? 'log-row-selected' : ''}`}
                    style={{
                      display: 'none',
                      flexDirection: 'column', gap: '10px',
                      padding: '14px', margin: '8px 12px',
                      borderRadius: '14px',
                      background: selectedIds.has(log.id) ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: `3px solid ${log.user_type === 'admin' ? 'rgba(99,102,241,0.5)' : 'rgba(249,115,22,0.5)'}`,
                      animation: `fadeInUp 0.25s ease ${Math.min(index * 0.02, 0.3)}s forwards`,
                      opacity: 0,
                    }}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelection(log.id)
                      } else {
                        setExpandedLog(expandedLog === log.id ? null : log.id)
                      }
                    }}
                  >
                    {/* Ligne 1 : Avatar + Nom + Statut */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {selectionMode && (
                        <span className="checkbox-btn" style={{ color: selectedIds.has(log.id) ? '#F59E0B' : '#555', flexShrink: 0 }}>
                          {selectedIds.has(log.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                        </span>
                      )}
                      <div style={{
                        ...S.avatar,
                        background: log.user_type === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(249,115,22,0.15)',
                      }}>
                        {log.employees?.photo_url ? (
                          <img src={log.employees.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} onError={(e) => { e.target.style.display = 'none' }} />
                        ) : log.user_type === 'admin' ? <Shield size={14} color="#6366F1" /> : <UserCircle size={14} color="#F97316" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ ...S.userName, maxWidth: '100%' }}>
                          {log.user_type === 'admin'
                            ? `${log.admins?.first_name || ''} ${log.admins?.last_name || ''}`.trim() || 'Admin'
                            : `${log.employees?.first_name || ''} ${log.employees?.last_name || ''}`.trim() || 'Employé'
                          }
                        </span>
                        <span style={S.userSub}>
                          {log.user_type === 'admin' ? log.admins?.email || '' : log.employees?.matricule || ''}
                        </span>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {log.success ? (
                          <span style={S.successBadge}><CheckCircle size={11} /> OK</span>
                        ) : (
                          <span style={S.failBadge}><XCircle size={11} /> Échec</span>
                        )}
                      </div>
                    </div>

                    {/* Ligne 2 : Infos */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: '#888' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {formatDateShort(log.connected_at)}
                      </span>
                      {(log.city || log.country) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={11} /> {[log.city, log.country_code].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {getDeviceIcon(log.device_type)} {getDeviceLabel(log.device_type)}
                      </span>
                      {log.enterprises?.name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={11} /> {log.enterprises.name}
                        </span>
                      )}
                    </div>

                    {/* Détail expandé mobile */}
                    {expandedLog === log.id && !selectionMode && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '4px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {[
                            { label: 'IP', value: log.ip_address || '—' },
                            { label: 'Appareil', value: getDeviceLabel(log.device_type) },
                            { label: 'Ville', value: log.city || '—' },
                            { label: 'Pays', value: log.country || '—' },
                            ...(log.failure_reason ? [{ label: 'Raison', value: log.failure_reason, isError: true }] : []),
                          ].map((item, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                              <span style={{ color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>{item.label}</span>
                              <span style={{ color: item.isError ? '#EF4444' : '#CCC', fontSize: '12px' }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          {log.latitude && log.longitude && (
                            <button onClick={(e) => { e.stopPropagation(); navigate('/connexions-map') }} style={{ ...S.expandedActionBtn, flex: 1 }}>
                              <Globe size={12} /> Carte
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([log.id])); openDeleteModal('selected') }}
                            style={{ ...S.expandedDeleteBtn, flex: 1 }}
                          >
                            <Trash2 size={12} /> Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── FOOTER ── */}
          {!loading && logs.length > 0 && (
            <div style={S.footer}>
              <span style={{ color: '#555', fontSize: '12px' }}>
                {logs.length} connexion{logs.length > 1 ? 's' : ''} affichée{logs.length > 1 ? 's' : ''}
                {hasActiveFilters && ' (filtrées)'}
              </span>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: '#10B981' }}>
                  ✓ {logs.filter(l => l.success).length} succès
                </span>
                <span style={{ color: '#EF4444' }}>
                  ✗ {logs.filter(l => !l.success).length} échecs
                </span>
                {selectionMode && selectedIds.size > 0 && (
                  <span style={{ color: '#F59E0B' }}>
                    ☑ {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 🗑️ MODALE DE CONFIRMATION SUPPRESSION                */}
      {/* ═══════════════════════════════════════════════════════ */}
      {deleteModalOpen && (
        <div style={S.modalOverlay} onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>

            {/* Icône */}
            <div style={S.modalIconWrap}>
              <Trash2 size={28} color="#EF4444" />
            </div>

            {/* Titre */}
            <h2 style={S.modalTitle}>
              {deleteType === 'selected' && `Supprimer ${selectedIds.size} trace${selectedIds.size > 1 ? 's' : ''} ?`}
              {deleteType === 'all' && `Supprimer tous les logs affichés (${logs.length}) ?`}
              {deleteType === 'old' && 'Purger les anciennes traces'}
            </h2>

            {/* Description */}
            <p style={S.modalDesc}>
              {deleteType === 'selected' && (
                <>Les traces de connexion sélectionnées seront définitivement supprimées. Cette action est irréversible.</>
              )}
              {deleteType === 'all' && (
                <>Tous les {logs.length} logs actuellement affichés (avec les filtres actifs) seront supprimés définitivement.</>
              )}
              {deleteType === 'old' && (
                <>Supprimer toutes les traces de connexion antérieures à la période sélectionnée.</>
              )}
            </p>

            {/* Sélecteur de période (pour purge) */}
            {deleteType === 'old' && (
              <div style={S.modalPurgeSelect}>
                <span style={{ color: '#888', fontSize: '13px' }}>Supprimer les traces de plus de :</span>
                <select
                  value={deleteOlderDays}
                  onChange={(e) => setDeleteOlderDays(Number(e.target.value))}
                  style={S.modalSelect}
                >
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={60}>60 jours</option>
                  <option value={90}>90 jours</option>
                  <option value={180}>6 mois</option>
                  <option value={365}>1 an</option>
                </select>
              </div>
            )}

            {/* Avertissement */}
            <div style={S.modalWarning}>
              <AlertTriangle size={16} color="#F59E0B" />
              <span>Cette action est irréversible</span>
            </div>

            {/* Boutons */}
            <div style={S.modalActions}>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={S.modalCancelBtn}
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={S.modalDeleteBtn}
              >
                {deleting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                    Suppression...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trash2 size={14} />
                    {deleteType === 'old' ? 'Purger' : 'Supprimer'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const S = {
  container: { minHeight: '100vh', background: '#0A0A0F' },
  main: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '24px', flexWrap: 'wrap', gap: '16px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '10px', color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: {
    width: '50px', height: '50px', borderRadius: '14px',
    background: 'rgba(16,185,129,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: '22px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#666', fontSize: '13px', margin: '2px 0 0 0' },
  headerRight: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },

  selectModeBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px', padding: '10px 14px',
    color: '#EF4444', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s ease',
  },
  selectionBar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px', padding: '6px 12px',
    flexWrap: 'wrap',
  },
  selectAllBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '4px 10px',
    color: '#F59E0B', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  deleteSelectedBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px', padding: '4px 10px',
    color: '#EF4444', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  cancelSelectionBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '4px 6px',
    color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  },
  purgeBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px', padding: '10px 14px',
    color: '#F59E0B', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s ease',
  },
  mapBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '10px', padding: '10px 14px',
    color: '#10B981', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  refreshBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '10px', color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  exportBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg,#10B981,#059669)',
    border: 'none', borderRadius: '10px', padding: '10px 14px',
    color: '#FFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resetFiltersBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#EF4444', padding: '7px 12px', borderRadius: '8px',
    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    fontFamily: 'inherit',
  },

  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px', marginBottom: '20px',
  },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '14px',
    background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '16px',
  },
  statIcon: {
    width: '44px', height: '44px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statValue: { display: 'block', color: '#FFF', fontSize: '24px', fontWeight: '700' },
  statLabel: { display: 'block', color: '#666', fontSize: '11px', fontWeight: '500', marginTop: '2px' },

  filtersBar: {
    display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
    padding: '14px', background: 'rgba(20,20,35,0.6)',
    borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  filterGroup: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '10px',
  },
  filterSelect: {
    background: 'transparent', border: 'none', color: '#E5E5E5',
    fontSize: '13px', outline: 'none', cursor: 'pointer', minWidth: '120px',
    fontFamily: 'inherit',
  },
  filterInput: {
    background: 'transparent', border: 'none', color: '#E5E5E5',
    fontSize: '12px', outline: 'none', width: '110px',
    fontFamily: 'inherit', colorScheme: 'dark',
  },

  tableWrap: {
    background: 'rgba(20,20,35,0.7)', borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
    marginBottom: '12px',
  },
  tableHeader: {
    display: 'flex', padding: '12px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  th: {
    flex: 1, color: '#555', fontSize: '10px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  tableRow: {
    display: 'flex', alignItems: 'center', padding: '12px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s ease',
  },
  td: { flex: 1, fontSize: '13px', color: '#CCC' },

  avatar: {
    width: '32px', height: '32px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  userName: {
    display: 'block', color: '#FFF', fontSize: '13px', fontWeight: '600',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    maxWidth: '180px',
  },
  userSub: { display: 'block', color: '#555', fontSize: '11px', marginTop: '1px' },

  successBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'rgba(16,185,129,0.12)', color: '#10B981',
    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
  },
  failBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'rgba(239,68,68,0.12)', color: '#EF4444',
    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
  },

  expandedRow: {
    padding: '12px 18px 16px 60px',
    background: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    borderLeft: '3px solid rgba(16,185,129,0.3)',
    animation: 'fadeInUp 0.2s ease forwards',
  },
  expandedGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
  },
  expandedItem: {
    display: 'flex', flexDirection: 'column', gap: '3px',
    background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px',
  },
  expandedLabel: { color: '#666', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  expandedValue: { color: '#CCC', fontSize: '12px', wordBreak: 'break-all' },
  expandedActionBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.2)',
    color: '#10B981', padding: '6px 12px',
    borderRadius: '8px', fontSize: '12px',
    fontWeight: '600', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  expandedDeleteBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    color: '#EF4444', padding: '6px 12px',
    borderRadius: '8px', fontSize: '12px',
    fontWeight: '600', cursor: 'pointer',
    fontFamily: 'inherit',
  },

  empty: { padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },

  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 4px', flexWrap: 'wrap', gap: '8px',
  },

  // ── MODALE ──
  modalOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000, padding: '20px',
    animation: 'fadeIn 0.2s ease',
  },
  modalCard: {
    background: 'rgba(20,20,35,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '440px',
    width: '100%',
    animation: 'scaleIn 0.25s ease',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalIconWrap: {
    width: '60px', height: '60px', borderRadius: '16px',
    background: 'rgba(239,68,68,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  modalTitle: {
    color: '#FFF', fontSize: '18px', fontWeight: '700',
    textAlign: 'center', margin: '0 0 12px',
  },
  modalDesc: {
    color: '#888', fontSize: '13px', lineHeight: '1.6',
    textAlign: 'center', margin: '0 0 20px',
  },
  modalPurgeSelect: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px', padding: '14px',
    marginBottom: '16px',
  },
  modalSelect: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '10px 14px',
    color: '#E5E5E5', fontSize: '14px',
    outline: 'none', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  modalWarning: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '10px', padding: '10px 14px',
    marginBottom: '20px',
    color: '#F59E0B', fontSize: '13px', fontWeight: '600',
  },
  modalActions: {
    display: 'flex', gap: '12px',
  },
  modalCancelBtn: {
    flex: 1, padding: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', color: '#888',
    fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  modalDeleteBtn: {
    flex: 1, padding: '12px',
    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
    border: 'none', borderRadius: '12px',
    color: '#FFF', fontSize: '14px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}