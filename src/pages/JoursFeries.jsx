// src/pages/JoursFeries.jsx
// ══════════════════════════════════════════════════════════
// 🎌 PAGE GESTION DES JOURS FÉRIÉS
// - Vue admin entreprise : gérer ses propres + opt-out globaux
// - Vue superadmin : gérer les globaux par pays
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Globe, Building2, Calendar,
  Pencil, Trash2, ToggleLeft, ToggleRight, X,
  CheckCircle, AlertCircle, Save, RefreshCw,
  ChevronDown, Info, Power, PowerOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import HolidayService, { SUPPORTED_COUNTRIES } from '../services/holidayService'

// ── Tabs ──
const TABS = {
  GLOBAL: 'global', // Fériés globaux par pays (tous)
  OWN:    'own',    // Fériés propres à l'enterprise
}

export default function JoursFeries() {
  const [admin, setAdmin]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState(TABS.GLOBAL)

  // Entreprise active
  const [enterprises, setEnterprises]   = useState([])
  const [selectedEntId, setSelectedEntId] = useState(null)

  // Données
  const [globalHolidays, setGlobalHolidays]   = useState([])
  const [ownHolidays, setOwnHolidays]         = useState([])
  const [overrides, setOverrides]             = useState([]) // Map holiday_id → override

  // Filtres
  const [filterCountry, setFilterCountry]   = useState('ALL')

  // Modal
  const [showModal, setShowModal]     = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null) // null = création
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState(defaultForm())

  // Modal suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId]           = useState(null)
  const [deleting, setDeleting]               = useState(false)

  // Toggle en masse
  const [togglingAll, setTogglingAll] = useState(false)

  const navigate = useNavigate()

  function defaultForm() {
    return {
      name:          '',
      date:          '',
      is_recurring:  true,
      // Plus de défaut 'FR' : ton marché est d'abord africain.
      country_code:  '',
      is_worked:     false,
      overtime_rate: 100,
    }
  }

  // ════════════════════════════════════
  // INIT
  // ════════════════════════════════════
  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }

    const parsed = JSON.parse(adminData)
    setAdmin(parsed)

    if (parsed.role === 'super_admin') {
      loadEnterprises().then(() => {
        // superadmin : par défaut on affiche les globaux
        loadGlobalHolidays()
      })
    } else {
      const entId = parsed.selectedEnterprise?.id || parsed.enterprise_id
      setSelectedEntId(entId)
      loadAll(entId)
    }
  }, [navigate])

  const loadEnterprises = async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')
    setEnterprises(data || [])
  }

  const loadAll = async (entId) => {
    setLoading(true)
    await Promise.all([
      loadGlobalHolidays(),
      loadOwnHolidays(entId),
      loadOverrides(entId),
    ])
    setLoading(false)
  }

  const loadGlobalHolidays = async () => {
    const data = await HolidayService.getGlobalHolidays()
    setGlobalHolidays(data)
    if (!selectedEntId) setLoading(false)
  }

  const loadOwnHolidays = async (entId) => {
    if (!entId) return
    const { data } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('enterprise_id', entId)
      .order('date', { ascending: true })
    setOwnHolidays(data || [])
  }

  const loadOverrides = async (entId) => {
    if (!entId) return
    const data = await HolidayService.getEnterpriseOverrides(entId)
    const map = {}
    data.forEach(ov => { map[ov.holiday_id] = ov })
    setOverrides(map)
  }

  // Quand l'admin superadmin change d'enterprise
  const handleEntChange = async (entId) => {
    setSelectedEntId(entId)
    if (entId) await loadAll(entId)
  }

  // ════════════════════════════════════
  // ACTIONS — Toggle global ON/OFF
  // ════════════════════════════════════
  const handleToggleGlobal = async (holiday) => {
    if (!selectedEntId) {
      toast.error('Sélectionnez une entreprise d\'abord')
      return
    }
    const currentOverride = overrides[holiday.id]
    const newEnabled = currentOverride ? !currentOverride.is_enabled : false // par défaut activé donc on désactive

    const result = await HolidayService.toggleGlobalHoliday(
      selectedEntId,
      holiday.id,
      newEnabled
    )

    if (result.success) {
      toast.success(newEnabled ? 'Jour férié activé' : 'Jour férié désactivé')
      await loadOverrides(selectedEntId)
    } else {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const isGlobalEnabled = (holidayId) => {
    const ov = overrides[holidayId]
    if (!ov) return true // Pas d'override = activé par défaut
    return ov.is_enabled !== false
  }

  // ════════════════════════════════════
  // NOUVELLE FONCTION — Toggle ALL
  // ════════════════════════════════════
  const handleToggleAllGlobal = async () => {
    if (!selectedEntId) {
      toast.error('Sélectionnez une entreprise d\'abord')
      return
    }

    if (filteredGlobal.length === 0) {
      toast.error('Aucun jour férié à modifier')
      return
    }

    // Déterminer si on doit tout activer ou tout désactiver
    // Si au moins un est activé, on désactive tout. Sinon on active tout.
    const hasEnabledHolidays = filteredGlobal.some(h => isGlobalEnabled(h.id))
    const newEnabledState = !hasEnabledHolidays

    setTogglingAll(true)
    
    try {
      // Traiter tous les jours fériés filtrés
      const promises = filteredGlobal.map(holiday => 
        HolidayService.toggleGlobalHoliday(
          selectedEntId,
          holiday.id,
          newEnabledState
        )
      )

      const results = await Promise.all(promises)
      
      // Vérifier si toutes les opérations ont réussi
      const allSuccessful = results.every(r => r.success)
      
      if (allSuccessful) {
        toast.success(
          newEnabledState 
            ? `✅ ${filteredGlobal.length} jour(s) férié(s) activé(s)`
            : `🚫 ${filteredGlobal.length} jour(s) férié(s) désactivé(s)`
        )
        await loadOverrides(selectedEntId)
      } else {
        toast.error('Certaines modifications ont échoué')
        await loadOverrides(selectedEntId)
      }
    } catch (error) {
      toast.error('Erreur lors de la modification en masse')
      console.error(error)
    } finally {
      setTogglingAll(false)
    }
  }

  // Déterminer le label du bouton toggle all
  const getToggleAllLabel = () => {
    if (filteredGlobal.length === 0) return 'Aucun jour férié'
    const hasEnabled = filteredGlobal.some(h => isGlobalEnabled(h.id))
    return hasEnabled ? 'Tout désactiver' : 'Tout activer'
  }

  const getToggleAllIcon = () => {
    if (filteredGlobal.length === 0) return Power
    const hasEnabled = filteredGlobal.some(h => isGlobalEnabled(h.id))
    return hasEnabled ? PowerOff : Power
  }

  // ════════════════════════════════════
  // ACTIONS — CRUD propres fériés
  // ════════════════════════════════════
  const openCreateModal = () => {
    setEditingHoliday(null)
    setForm(defaultForm())
    setShowModal(true)
  }

  const openEditModal = (holiday) => {
    setEditingHoliday(holiday)
    setForm({
      name:          holiday.name,
      date:          holiday.date,
      is_recurring:  holiday.is_recurring ?? true,
      country_code:  holiday.country_code || '',
      is_worked:     holiday.is_worked ?? false,
      overtime_rate: holiday.overtime_rate ?? 100,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    if (!form.date)         { toast.error('Date requise'); return }

    if (!selectedEntId && admin.role !== 'super_admin') {
      toast.error('Enterprise non sélectionnée')
      return
    }

    setSaving(true)
    try {
      let result
      if (editingHoliday) {
        result = await HolidayService.updateHoliday(
          editingHoliday.id,
          selectedEntId,
          form
        )
      } else {
        // Superadmin peut créer un global (enterprise_id = null)
        const entId = admin.role === 'super_admin' && activeTab === TABS.GLOBAL
          ? null
          : selectedEntId
        result = await HolidayService.createHoliday(entId, form)
      }

      if (result.success) {
        toast.success(editingHoliday ? 'Jour férié modifié' : 'Jour férié créé')
        setShowModal(false)
        // Recharger
        if (activeTab === TABS.GLOBAL) await loadGlobalHolidays()
        else await loadOwnHolidays(selectedEntId)
      } else {
        toast.error('Erreur : ' + (result.error || 'inconnue'))
      }
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (id) => {
    setDeletingId(id)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    const result = await HolidayService.deleteHoliday(deletingId, selectedEntId)
    if (result.success) {
      toast.success('Jour férié supprimé')
      setShowDeleteModal(false)
      await loadOwnHolidays(selectedEntId)
    } else {
      toast.error('Erreur suppression')
    }
    setDeleting(false)
    setDeletingId(null)
  }

  // ════════════════════════════════════
  // FILTRES
  // ════════════════════════════════════
  const filteredGlobal = filterCountry === 'ALL'
    ? globalHolidays
    : globalHolidays.filter(h => h.country_code === filterCountry)

  // Pays disponibles dans les globaux
  const availableCountries = [...new Set(globalHolidays.map(h => h.country_code))]

  const isSuperAdmin = admin?.role === 'super_admin'

  // ════════════════════════════════════
  // RENDER
  // ════════════════════════════════════
  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <RefreshCw size={32} color="#8B5CF6" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#888', marginTop: '12px' }}>Chargement des jours fériés...</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  const ToggleAllIcon = getToggleAllIcon()

  return (
    <>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(30px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .holiday-row:hover { background: rgba(139,92,246,0.05) !important; }
        .toggle-btn:hover  { opacity: 0.8 !important; }
        .action-btn:hover  { transform: scale(1.1) !important; }
        select option { background:#141423; color:#E5E5E5; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      <div style={S.container}>
        {/* ── Fond ── */}
        <div style={S.bgOrb1} />
        <div style={S.bgOrb2} />

        {/* ══ HEADER ══ */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={S.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={S.logoWrap}>
                <span style={{ fontSize: '22px' }}>🎌</span>
              </div>
              <div>
                <h1 style={S.headerTitle}>JOURS FÉRIÉS</h1>
                <span style={S.headerSub}>Configuration par entreprise</span>
              </div>
            </div>

            {/* Sélecteur enterprise (superadmin) */}
            {isSuperAdmin && (
              <div style={S.entSelector}>
                <Building2 size={16} color="#8B5CF6" />
                <select
                  value={selectedEntId || ''}
                  onChange={e => handleEntChange(e.target.value || null)}
                  style={S.select}
                >
                  <option value="">— Sélectionner une entreprise —</option>
                  {enterprises.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* ══ MAIN ══ */}
        <main style={S.main}>

          {/* Info banner si pas d'enterprise sélectionnée (superadmin) */}
          {isSuperAdmin && !selectedEntId && (
            <div style={S.infoBanner}>
              <Info size={18} color="#8B5CF6" />
              <span style={{ color: '#A78BFA', fontSize: '14px' }}>
                Sélectionnez une entreprise pour gérer ses jours fériés spécifiques
                et activer/désactiver les fériés globaux.
              </span>
            </div>
          )}

          {/* ── TABS ── */}
          <div style={S.tabs}>
            <button
              onClick={() => setActiveTab(TABS.GLOBAL)}
              style={{
                ...S.tab,
                ...(activeTab === TABS.GLOBAL ? S.tabActive : {}),
              }}
            >
              <Globe size={16} />
              Jours fériés globaux
              <span style={S.tabCount}>{filteredGlobal.length}</span>
            </button>
            <button
              onClick={() => setActiveTab(TABS.OWN)}
              style={{
                ...S.tab,
                ...(activeTab === TABS.OWN ? S.tabActive : {}),
              }}
            >
              <Building2 size={16} />
              Propres à l'entreprise
              <span style={S.tabCount}>{ownHolidays.length}</span>
            </button>
          </div>

          {/* ══ TAB GLOBAL ══ */}
          {activeTab === TABS.GLOBAL && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Barre d'outils */}
              <div style={S.toolbar}>
                {/* Filtre pays */}
                <div style={S.filterBox}>
                  <Globe size={16} color="#8B5CF6" />
                  <select
                    value={filterCountry}
                    onChange={e => setFilterCountry(e.target.value)}
                    style={S.select}
                  >
                    <option value="ALL">Tous les pays</option>
                    {availableCountries.map(code => {
                      const country = SUPPORTED_COUNTRIES.find(c => c.code === code)
                      return (
                        <option key={code} value={code}>
                          {country?.flag} {country?.name || code}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* NOUVEAU BOUTON - Toggle All (seulement si entreprise sélectionnée) */}
                {selectedEntId && (
                  <button 
                    onClick={handleToggleAllGlobal}
                    disabled={togglingAll || filteredGlobal.length === 0}
                    style={{
                      ...S.toggleAllBtn,
                      opacity: togglingAll || filteredGlobal.length === 0 ? 0.5 : 1,
                      cursor: togglingAll || filteredGlobal.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {togglingAll ? (
                      <>
                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        Modification...
                      </>
                    ) : (
                      <>
                        <ToggleAllIcon size={16} />
                        {getToggleAllLabel()}
                      </>
                    )}
                  </button>
                )}

                {/* Bouton créer un global (superadmin seulement) */}
                {isSuperAdmin && (
                  <button onClick={openCreateModal} style={S.createBtn}>
                    <Plus size={16} />
                    Ajouter un jour férié global
                  </button>
                )}
              </div>

              {/* Note explicative */}
              {selectedEntId && (
                <div style={S.noteBox}>
                  <ToggleRight size={16} color="#10B981" />
                  <span style={{ color: '#888', fontSize: '13px' }}>
                    Utilisez les interrupteurs pour activer/désactiver chaque
                    jour férié global pour <strong style={{ color: '#E5E5E5' }}>
                      {enterprises.find(e => e.id === selectedEntId)?.name || 'cette entreprise'}
                    </strong>.
                    Les jours désactivés ne seront pas comptés dans les retards,
                    absences et calculs d'heures.
                  </span>
                </div>
              )}

              {/* Liste */}
              <div style={S.listWrap}>
                {filteredGlobal.length === 0 ? (
                  <div style={S.emptyState}>
                    <Globe size={40} color="#555" />
                    <p style={{ color: '#666', margin: '12px 0 0 0' }}>
                      Aucun jour férié global pour ce pays
                    </p>
                  </div>
                ) : (
                  filteredGlobal.map((holiday, i) => {
                    const enabled    = selectedEntId ? isGlobalEnabled(holiday.id) : true
                    const country    = SUPPORTED_COUNTRIES.find(c => c.code === holiday.country_code)
                    const resolvedDate = resolveHolidayDate(holiday)

                    return (
                      <div
                        key={holiday.id}
                        className="holiday-row"
                        style={{
                          ...S.row,
                          opacity: selectedEntId && !enabled ? 0.45 : 1,
                          borderLeft: `3px solid ${enabled ? '#8B5CF6' : '#333'}`,
                          animation: `fadeInUp 0.3s ease ${i * 0.03}s forwards`,
                        }}
                      >
                        {/* Infos */}
                        <div style={S.rowInfo}>
                          <div style={S.rowMain}>
                            <span style={S.rowName}>{holiday.name}</span>
                            {holiday.is_recurring && (
                              <span style={S.recurringBadge}>📅 Récurrent</span>
                            )}
                            {holiday.is_worked && (
                              <span style={S.workedBadge}>🔨 Travaillé</span>
                            )}
                          </div>
                          <div style={S.rowMeta}>
                            <span style={S.rowDate}>
                              <Calendar size={12} />
                              {resolvedDate}
                            </span>
                            <span style={S.rowCountry}>
                              {country?.flag} {country?.name || holiday.country_code}
                            </span>
                            <span style={S.rowRate}>
                              +{holiday.overtime_rate}% si travaillé
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={S.rowActions}>
                          {/* Toggle (seulement si enterprise sélectionnée) */}
                          {selectedEntId && (
                            <button
                              className="toggle-btn"
                              onClick={() => handleToggleGlobal(holiday)}
                              style={{
                                ...S.toggleBtn,
                                color: enabled ? '#10B981' : '#555',
                              }}
                              title={enabled ? 'Désactiver pour cette entreprise' : 'Activer pour cette entreprise'}
                            >
                              {enabled
                                ? <ToggleRight size={26} />
                                : <ToggleLeft size={26} />
                              }
                            </button>
                          )}

                          {/* Edit (superadmin seulement pour les globaux) */}
                          {isSuperAdmin && (
                            <>
                              <button
                                className="action-btn"
                                onClick={() => openEditModal(holiday)}
                                style={S.editBtn}
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="action-btn"
                                onClick={() => confirmDelete(holiday.id)}
                                style={S.deleteBtn}
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ══ TAB OWN ══ */}
          {activeTab === TABS.OWN && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {!selectedEntId ? (
                <div style={S.emptyState}>
                  <Building2 size={40} color="#555" />
                  <p style={{ color: '#666', margin: '12px 0 0 0' }}>
                    Sélectionnez une entreprise pour voir ses jours fériés
                  </p>
                </div>
              ) : (
                <>
                  {/* Barre d'outils */}
                  <div style={S.toolbar}>
                    <div style={S.noteBox}>
                      <Info size={15} color="#F59E0B" />
                      <span style={{ color: '#888', fontSize: '13px' }}>
                        Ajoutez ici les jours fériés spécifiques à votre entreprise
                        (fêtes locales, ponts, jours exceptionnels...).
                      </span>
                    </div>
                    <button onClick={openCreateModal} style={S.createBtn}>
                      <Plus size={16} />
                      Ajouter
                    </button>
                  </div>

                  {/* Liste */}
                  <div style={S.listWrap}>
                    {ownHolidays.length === 0 ? (
                      <div style={S.emptyState}>
                        <Calendar size={40} color="#555" />
                        <p style={{ color: '#666', margin: '12px 0 8px 0' }}>
                          Aucun jour férié propre à cette entreprise
                        </p>
                        <button onClick={openCreateModal} style={S.emptyAddBtn}>
                          <Plus size={14} /> Ajouter le premier
                        </button>
                      </div>
                    ) : (
                      ownHolidays.map((holiday, i) => {
                        const resolvedDate = resolveHolidayDate(holiday)
                        return (
                          <div
                            key={holiday.id}
                            className="holiday-row"
                            style={{
                              ...S.row,
                              borderLeft: '3px solid #F59E0B',
                              animation: `fadeInUp 0.3s ease ${i * 0.03}s forwards`,
                            }}
                          >
                            <div style={S.rowInfo}>
                              <div style={S.rowMain}>
                                <span style={S.rowName}>{holiday.name}</span>
                                {holiday.is_recurring && (
                                  <span style={S.recurringBadge}>📅 Récurrent</span>
                                )}
                                {holiday.is_worked && (
                                  <span style={S.workedBadge}>🔨 Travaillé</span>
                                )}
                              </div>
                              <div style={S.rowMeta}>
                                <span style={S.rowDate}>
                                  <Calendar size={12} />
                                  {resolvedDate}
                                </span>
                                <span style={S.rowRate}>
                                  +{holiday.overtime_rate}% si travaillé
                                </span>
                              </div>
                            </div>

                            <div style={S.rowActions}>
                              <button
                                className="action-btn"
                                onClick={() => openEditModal(holiday)}
                                style={S.editBtn}
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="action-btn"
                                onClick={() => confirmDelete(holiday.id)}
                                style={S.deleteBtn}
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </main>

        {/* ══ MODAL CRÉATION / ÉDITION ══ */}
        {showModal && (
          <div style={S.overlay} onClick={() => !saving && setShowModal(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={S.modalIcon}>
                    <span style={{ fontSize: '20px' }}>🎌</span>
                  </div>
                  <div>
                    <h2 style={S.modalTitle}>
                      {editingHoliday ? 'Modifier le jour férié' : 'Nouveau jour férié'}
                    </h2>
                    <span style={S.modalSub}>
                      {activeTab === TABS.GLOBAL && isSuperAdmin
                        ? 'Jour férié global (tous pays)'
                        : enterprises.find(e => e.id === selectedEntId)?.name || 'Entreprise'
                      }
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => !saving && setShowModal(false)}
                  style={S.closeBtn}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={S.modalBody}>
                {/* Nom */}
                <div style={S.field}>
                  <label style={S.label}>Nom du jour férié *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="ex: Fête de l'Indépendance"
                    style={S.input}
                    disabled={saving}
                  />
                </div>

                {/* Date + Pays */}
                <div style={S.fieldRow}>
                  <div style={S.field}>
                    <label style={S.label}>Date *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      style={S.input}
                      disabled={saving}
                    />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>Pays</label>
                    <select
                      value={form.country_code}
                      onChange={e => setForm({ ...form, country_code: e.target.value })}
                      style={S.select}
                      disabled={saving}
                    >
                      {SUPPORTED_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options */}
                <div style={S.optionsGrid}>
                  {/* Récurrent */}
                  <label style={S.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form.is_recurring}
                      onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                      style={{ accentColor: '#8B5CF6', width: '16px', height: '16px' }}
                      disabled={saving}
                    />
                    <div>
                      <span style={{ color: '#E5E5E5', fontSize: '14px', fontWeight: '500' }}>
                        Récurrent
                      </span>
                      <span style={{ display: 'block', color: '#666', fontSize: '11px' }}>
                        Se répète chaque année (même jour/mois)
                      </span>
                    </div>
                  </label>

                  {/* Travaillé */}
                  <label style={S.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form.is_worked}
                      onChange={e => setForm({ ...form, is_worked: e.target.checked })}
                      style={{ accentColor: '#F59E0B', width: '16px', height: '16px' }}
                      disabled={saving}
                    />
                    <div>
                      <span style={{ color: '#E5E5E5', fontSize: '14px', fontWeight: '500' }}>
                        Jour travaillé
                      </span>
                      <span style={{ display: 'block', color: '#666', fontSize: '11px' }}>
                        Les retards sont quand même comptés
                      </span>
                    </div>
                  </label>
                </div>

                {/* Taux HS */}
                <div style={S.field}>
                  <label style={S.label}>
                    Taux heures supplémentaires si travaillé (%)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="number"
                      value={form.overtime_rate}
                      onChange={e => setForm({
                        ...form,
                        overtime_rate: parseInt(e.target.value) || 0,
                      })}
                      min="0"
                      max="300"
                      step="25"
                      style={{ ...S.input, width: '120px' }}
                      disabled={saving}
                    />
                    <span style={{ color: '#666', fontSize: '13px' }}>
                      {form.overtime_rate === 100
                        ? '→ Paie doublée'
                        : form.overtime_rate === 50
                        ? '→ Majoration 50%'
                        : form.overtime_rate === 25
                        ? '→ Majoration 25%'
                        : `→ Majoration ${form.overtime_rate}%`
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div style={S.modalFooter}>
                <button
                  onClick={() => !saving && setShowModal(false)}
                  disabled={saving}
                  style={S.cancelBtn}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.date}
                  style={{
                    ...S.saveBtn,
                    opacity: saving || !form.name.trim() || !form.date ? 0.5 : 1,
                    cursor: saving || !form.name.trim() || !form.date
                      ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      {editingHoliday ? 'Modifier' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL SUPPRESSION ══ */}
        {showDeleteModal && (
          <div style={S.overlay} onClick={() => !deleting && setShowDeleteModal(false)}>
            <div
              style={{
                background: '#0F0F19',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '20px',
                width: '100%', maxWidth: '380px',
                padding: '28px', textAlign: 'center',
                animation: 'slideUp 0.3s ease forwards',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Trash2 size={26} color="#EF4444" />
              </div>
              <h3 style={{ color: '#FFF', fontSize: '18px', fontWeight: '700', margin: '0 0 8px' }}>
                Supprimer ce jour férié ?
              </h3>
              <p style={{ color: '#888', fontSize: '13px', margin: '0 0 24px' }}>
                Cette action est irréversible. Il ne sera plus pris en compte
                dans les calculs de retards, absences et heures supplémentaires.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', color: '#FFF',
                    fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '12px',
                    background: '#EF4444', border: 'none',
                    borderRadius: '10px', color: '#FFF',
                    fontWeight: '700', cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: deleting ? 0.7 : 1,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px',
                  }}
                >
                  {deleting
                    ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Suppression...</>
                    : <><Trash2 size={14} /> Supprimer</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Helper : affichage de la date résolue pour l'année courante ──
function resolveHolidayDate(holiday) {
  const currentYear = new Date().getFullYear()
  const originalDate = new Date(holiday.date + 'T12:00:00Z')

  let displayDate
  if (holiday.is_recurring) {
    const month = String(originalDate.getUTCMonth() + 1).padStart(2, '0')
    const day   = String(originalDate.getUTCDate()).padStart(2, '0')
    displayDate = new Date(`${currentYear}-${month}-${day}T12:00:00Z`)
  } else {
    displayDate = originalDate
  }

  return displayDate.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

// ══════════════════════════════════════════════════════════
// 🎨 STYLES
// ══════════════════════════════════════════════════════════
const S = {
  container: {
    minHeight: '100vh',
    background: '#0A0A0F',
    position: 'relative',
    overflow: 'hidden',
  },
  bgOrb1: {
    position: 'fixed', top: '-20%', right: '-10%',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed', bottom: '-20%', left: '-10%',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,158,11,0.03) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  loadingWrap: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: '#0A0A0F',
  },
  header: {
    background: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(139,92,246,0.15)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerInner: {
    maxWidth: '1100px', margin: '0 auto', padding: '12px 20px',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '12px', flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
    color: '#F59E0B', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
  },
  logoWrap: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(139,92,246,0.12)',
    border: '1px solid rgba(139,92,246,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF', fontSize: '18px', fontWeight: '700',
    letterSpacing: '2px', margin: 0, lineHeight: '1.2',
  },
  headerSub: {
    color: '#8B5CF6', fontSize: '10px', letterSpacing: '3px',
    textTransform: 'uppercase', fontWeight: '500',
  },
  entSelector: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(20,20,35,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '8px 14px',
  },
  main: {
    padding: '24px 20px', maxWidth: '1100px',
    margin: '0 auto', position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  infoBanner: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 18px',
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: '12px',
  },
  tabs: {
    display: 'flex', gap: '4px',
    background: 'rgba(20,20,35,0.8)',
    borderRadius: '14px', padding: '4px',
    border: '1px solid rgba(255,255,255,0.06)',
    width: 'fit-content',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 18px', borderRadius: '10px',
    border: 'none', background: 'transparent',
    color: '#888', fontSize: '13px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    color: '#FFF',
  },
  tabCount: {
    background: 'rgba(255,255,255,0.12)',
    color: 'inherit', padding: '1px 7px',
    borderRadius: '8px', fontSize: '11px', fontWeight: '700',
  },
  toolbar: {
    display: 'flex', gap: '12px',
    alignItems: 'center', flexWrap: 'wrap',
  },
  filterBox: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(20,20,35,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '8px 14px', flex: 1, maxWidth: '300px',
  },
  select: {
    background: 'transparent', border: 'none',
    outline: 'none', color: '#FFF',
    fontSize: '14px', cursor: 'pointer', width: '100%',
  },
  toggleAllBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFF', border: 'none', borderRadius: '10px',
    fontWeight: '600', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  createBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    color: '#FFF', border: 'none', borderRadius: '10px',
    fontWeight: '600', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  noteBox: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', flex: 1,
  },
  listWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '48px 20px',
    background: 'rgba(20,20,35,0.5)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '16px', textAlign: 'center',
  },
  emptyAddBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 18px',
    background: 'rgba(139,92,246,0.1)',
    border: '1px solid rgba(139,92,246,0.2)',
    color: '#8B5CF6', borderRadius: '10px',
    fontWeight: '600', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: 'rgba(20,20,35,0.6)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', padding: '14px 18px',
    transition: 'all 0.2s ease',
  },
  rowInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  rowMain: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  rowName: { color: '#FFF', fontSize: '14px', fontWeight: '600' },
  recurringBadge: {
    padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
    fontWeight: '600',
    background: 'rgba(99,102,241,0.12)', color: '#818CF8',
    border: '1px solid rgba(99,102,241,0.2)',
  },
  workedBadge: {
    padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
    fontWeight: '600',
    background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
    border: '1px solid rgba(245,158,11,0.2)',
  },
  rowMeta: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
  rowDate: {
    display: 'flex', alignItems: 'center', gap: '4px',
    color: '#888', fontSize: '12px',
  },
  rowCountry: { color: '#666', fontSize: '12px' },
  rowRate:    { color: '#555', fontSize: '11px' },
  rowActions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  toggleBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: '4px',
    transition: 'opacity 0.2s ease',
    display: 'flex', alignItems: 'center',
  },
  editBtn: {
    width: '32px', height: '32px', borderRadius: '8px',
    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
    color: '#818CF8', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  deleteBtn: {
    width: '32px', height: '32px', borderRadius: '8px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#EF4444', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 1000, animation: 'fadeIn 0.3s ease',
  },
  modal: {
    background: '#0F0F19', border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: '24px', width: '100%', maxWidth: '520px',
    maxHeight: '92vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    animation: 'slideUp 0.3s ease forwards',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  modalIcon: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(139,92,246,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: '#FFF', fontSize: '17px', fontWeight: '700', margin: 0 },
  modalSub:   { color: '#666', fontSize: '12px', display: 'block', marginTop: '2px' },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '8px',
    color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  },
  modalBody: {
    padding: '24px', overflow: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: {
    fontSize: '12px', fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  input: {
    padding: '11px 14px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', fontSize: '14px',
    background: 'rgba(255,255,255,0.04)', color: '#E5E5E5',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    width: '100%',
  },
  optionsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
  },
  checkLabel: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', cursor: 'pointer',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  cancelBtn: {
    padding: '11px 20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#E5E5E5', borderRadius: '10px',
    fontWeight: '600', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  saveBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '11px 24px',
    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    color: '#FFF', border: 'none', borderRadius: '10px',
    fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
}