// ═══════════════════════════════════════════════════════════
// 📅 PAGE GESTION DES PLANNINGS / HORAIRES (AVEC MODALE)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { 
  Footprints, 
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Clock,
  Calendar,
  Building2,
  AlertCircle,
  Coffee,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Planning() {
  const [admin, setAdmin] = useState(null)
  const [plannings, setPlannings] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlanning, setEditingPlanning] = useState(null)
  const [selectedEntreprise, setSelectedEntreprise] = useState('all')
  
  // ✅ AJOUT : État pour la modale de suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [planningToDelete, setPlanningToDelete] = useState(null)
  
  const navigate = useNavigate()

  const joursSemaine = [
    { id: 1, nom: 'Lundi', court: 'Lun' },
    { id: 2, nom: 'Mardi', court: 'Mar' },
    { id: 3, nom: 'Mercredi', court: 'Mer' },
    { id: 4, nom: 'Jeudi', court: 'Jeu' },
    { id: 5, nom: 'Vendredi', court: 'Ven' },
    { id: 6, nom: 'Samedi', court: 'Sam' },
    { id: 7, nom: 'Dimanche', court: 'Dim' },
  ]

  const [formData, setFormData] = useState({
    enterprise_id: '',
    name: 'Horaires standard',
    start_time: '08:00',
    end_time: '17:00',
    break_start: '12:00',
    break_end: '13:00',
    has_break: true,
    work_days: [1, 2, 3, 4, 5],
    late_tolerance_minutes: 15,
    is_default: true
  })

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    loadData(parsedAdmin)
  }, [navigate])

  const loadData = async (adminData) => {
    try {
      let entreprisesQuery = supabase
        .from('enterprises')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (adminData.role !== 'super_admin') {
        entreprisesQuery = entreprisesQuery.eq('id', adminData.enterprise_id)
      }

      const { data: entreprisesData } = await entreprisesQuery
      setEntreprises(entreprisesData || [])

      let planningsQuery = supabase
        .from('work_schedules')
        .select('*, enterprises(name, logo_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (adminData.role !== 'super_admin') {
        planningsQuery = planningsQuery.eq('enterprise_id', adminData.enterprise_id)
      }

      const { data: planningsData } = await planningsQuery
      setPlannings(planningsData || [])

    } catch (error) {
      console.error('Erreur chargement:', error)
    }
    setLoading(false)
  }

  const handleAdd = () => {
    const defaultEnterpriseId = admin.role === 'super_admin' 
      ? (entreprises[0]?.id || '') 
      : admin.enterprise_id

    setFormData({
      enterprise_id: defaultEnterpriseId,
      name: 'Horaires standard',
      start_time: '08:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '13:00',
      has_break: true,
      work_days: [1, 2, 3, 4, 5],
      late_tolerance_minutes: 15,
      is_default: true
    })
    setEditingPlanning(null)
    setShowModal(true)
  }

  const handleEdit = (planning) => {
    setFormData({
      enterprise_id: planning.enterprise_id,
      name: planning.name,
      start_time: planning.start_time?.slice(0, 5) || '08:00',
      end_time: planning.end_time?.slice(0, 5) || '17:00',
      break_start: planning.break_start?.slice(0, 5) || '12:00',
      break_end: planning.break_end?.slice(0, 5) || '13:00',
      has_break: planning.has_break ?? true,
      work_days: planning.work_days || [1, 2, 3, 4, 5],
      late_tolerance_minutes: planning.late_tolerance_minutes || 15,
      is_default: planning.is_default ?? true
    })
    setEditingPlanning(planning)
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast.error('Le nom du planning est obligatoire')
        return
      }

      if (!formData.enterprise_id) {
        toast.error('Veuillez sélectionner une entreprise')
        return
      }

      if (formData.work_days.length === 0) {
        toast.error('Sélectionnez au moins un jour de travail')
        return
      }

      const dataToSave = {
        enterprise_id: formData.enterprise_id,
        name: formData.name,
        start_time: formData.start_time + ':00',
        end_time: formData.end_time + ':00',
        break_start: formData.has_break ? formData.break_start + ':00' : null,
        break_end: formData.has_break ? formData.break_end + ':00' : null,
        has_break: formData.has_break,
        work_days: formData.work_days,
        late_tolerance_minutes: parseInt(formData.late_tolerance_minutes) || 15,
        is_default: formData.is_default,
        updated_at: new Date().toISOString()
      }

      if (editingPlanning) {
        await supabase
          .from('work_schedules')
          .update(dataToSave)
          .eq('id', editingPlanning.id)

        toast.success('Planning modifié !')
      } else {
        await supabase
          .from('work_schedules')
          .insert(dataToSave)

        toast.success('Planning créé !')
      }

      setShowModal(false)
      loadData(admin)

    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // ✅ CORRECTION : Ouvrir la modale au lieu de confirm()
  const confirmDelete = (planning) => {
    setPlanningToDelete(planning)
    setShowDeleteModal(true)
  }

  // ✅ CORRECTION : Exécuter la suppression
  const handleDelete = async () => {
    if (!planningToDelete) return

    try {
      await supabase
        .from('work_schedules')
        .update({ is_active: false })
        .eq('id', planningToDelete.id)

      toast.success('Planning supprimé')
      setShowDeleteModal(false)
      setPlanningToDelete(null)
      loadData(admin)
    } catch (error) {
      console.error('Erreur suppression:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const toggleJour = (jourId) => {
    if (formData.work_days.includes(jourId)) {
      setFormData({
        ...formData,
        work_days: formData.work_days.filter(j => j !== jourId)
      })
    } else {
      setFormData({
        ...formData,
        work_days: [...formData.work_days, jourId].sort()
      })
    }
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--'
    return timeStr.slice(0, 5)
  }

  const formatWorkDays = (days) => {
    if (!days || days.length === 0) return 'Aucun'
    if (days.length === 7) return 'Tous les jours'
    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])) return 'Lun - Ven'
    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Lun - Sam'
    
    return days.map(d => joursSemaine.find(j => j.id === d)?.court).join(', ')
  }

  const planningsFiltres = plannings.filter(p => {
    if (selectedEntreprise === 'all') return true
    return p.enterprise_id === selectedEntreprise
  })

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Footprints size={50} color="#8B6914" />
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
          <Footprints size={32} color="#FFFBF5" />
          <h1 style={styles.headerTitle}>PLANNING</h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.toolbar}>
          {admin?.role === 'super_admin' && (
            <div style={styles.filterGroup}>
              <Building2 size={18} color="#8B6914" />
              <select
                value={selectedEntreprise}
                onChange={(e) => setSelectedEntreprise(e.target.value)}
                style={styles.select}
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>
          )}

          <button onClick={handleAdd} style={styles.addBtn}>
            <Plus size={20} />
            Nouveau planning
          </button>
        </div>

        <div style={styles.stats}>
          <Calendar size={20} color="#8B6914" />
          <span>{planningsFiltres.length} planning(s)</span>
        </div>

        <div style={styles.list}>
          {planningsFiltres.length === 0 ? (
            <div style={styles.empty}>
              <Clock size={60} color="#C4A574" />
              <p>Aucun planning défini</p>
              <p style={styles.emptyHint}>Créez un planning pour définir les horaires de travail</p>
            </div>
          ) : (
            planningsFiltres.map((planning) => (
              <div key={planning.id} style={styles.planningCard}>
                <div style={styles.planningIcon}>
                  <Clock size={24} color="#8B6914" />
                </div>

                <div style={styles.planningInfo}>
                  <span style={styles.planningName}>{planning.name}</span>
                  
                  {admin?.role === 'super_admin' && planning.enterprises && (
                    <span style={styles.planningEntreprise}>
                      <Building2 size={14} />
                      {planning.enterprises.name}
                    </span>
                  )}

                  <div style={styles.planningDetails}>
                    <span style={styles.planningTime}>
                      🕐 {formatTime(planning.start_time)} - {formatTime(planning.end_time)}
                    </span>
                    {planning.has_break && (
                      <span style={styles.planningBreak}>
                        ☕ Pause: {formatTime(planning.break_start)} - {formatTime(planning.break_end)}
                      </span>
                    )}
                  </div>

                  <div style={styles.planningDays}>
                    📅 {formatWorkDays(planning.work_days)}
                  </div>
                </div>

                <div style={styles.toleranceBox}>
                  <AlertCircle size={16} color="#8B6914" />
                  <span>{planning.late_tolerance_minutes} min</span>
                </div>

                {planning.is_default && (
                  <div style={styles.defaultBadge}>
                    Par défaut
                  </div>
                )}

                <div style={styles.actions}>
                  <button 
                    onClick={() => handleEdit(planning)} 
                    style={styles.actionBtn}
                    title="Modifier"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => confirmDelete(planning)}
                    style={{...styles.actionBtn, ...styles.deleteBtn}}
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal Formulaire */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingPlanning ? 'Modifier le planning' : 'Nouveau planning'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {admin?.role === 'super_admin' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Entreprise *</label>
                  <select
                    value={formData.enterprise_id}
                    onChange={(e) => setFormData({...formData, enterprise_id: e.target.value})}
                    style={styles.selectInput}
                  >
                    <option value="">-- Sélectionner --</option>
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Nom du planning *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  style={styles.input}
                  placeholder="Ex: Horaires standard"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Heure d'arrivée</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Heure de départ</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.has_break}
                    onChange={(e) => setFormData({...formData, has_break: e.target.checked})}
                    style={styles.checkbox}
                  />
                  <Coffee size={18} color="#8B6914" />
                  Pause déjeuner
                </label>
              </div>

              {formData.has_break && (
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Début pause</label>
                    <input
                      type="time"
                      value={formData.break_start}
                      onChange={(e) => setFormData({...formData, break_start: e.target.value})}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Fin pause</label>
                    <input
                      type="time"
                      value={formData.break_end}
                      onChange={(e) => setFormData({...formData, break_end: e.target.value})}
                      style={styles.input}
                    />
                  </div>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Jours de travail</label>
                <div style={styles.daysGrid}>
                  {joursSemaine.map((jour) => (
                    <button
                      key={jour.id}
                      type="button"
                      onClick={() => toggleJour(jour.id)}
                      style={{
                        ...styles.dayBtn,
                        ...(formData.work_days.includes(jour.id) ? styles.dayBtnActive : {})
                      }}
                    >
                      {jour.court}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <AlertCircle size={16} color="#8B6914" />
                  Tolérance retard (minutes)
                </label>
                <input
                  type="number"
                  value={formData.late_tolerance_minutes}
                  onChange={(e) => setFormData({...formData, late_tolerance_minutes: e.target.value})}
                  style={styles.input}
                  min="0"
                  max="60"
                />
                <span style={styles.hint}>
                  Un employé arrivant avant {formData.start_time} + {formData.late_tolerance_minutes} min ne sera pas considéré en retard
                </span>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                    style={styles.checkbox}
                  />
                  Planning par défaut pour cette entreprise
                </label>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button onClick={handleSave} style={styles.saveBtn}>
                <Save size={20} />
                {editingPlanning ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODALE DE CONFIRMATION SUPPRESSION */}
      {showDeleteModal && planningToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.modalIconContainer}>
              <AlertTriangle size={32} color="#9B2C2C" />
            </div>
            
            <h3 style={styles.modalTitle}>Confirmer la suppression</h3>
            
            <p style={styles.modalText}>
              Voulez-vous vraiment supprimer le planning <strong>"{planningToDelete.name}"</strong> ?
              <br/>
              Cette action est irréversible.
            </p>

            <div style={styles.modalButtons}>
              <button 
                onClick={() => {
                  setShowDeleteModal(false)
                  setPlanningToDelete(null)
                }}
                style={styles.cancelBtn}
              >
                Annuler
              </button>
              <button 
                onClick={handleDelete}
                style={styles.confirmDeleteBtn}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#E5D4C0' },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: '#8B6914' },
  header: { background: '#3D2B1F', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px', color: '#FFFBF5', cursor: 'pointer' },
  headerTitle: { color: '#FFFBF5', fontSize: '24px', fontWeight: '300', letterSpacing: '4px' },
  main: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  toolbar: { display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFBF5', padding: '10px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  select: { border: 'none', background: 'none', fontSize: '15px', color: '#3D2B1F', cursor: 'pointer', outline: 'none' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: '#8B6914', color: '#FFFBF5', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', marginLeft: 'auto' },
  stats: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#3D2B1F' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9E9E9E' },
  emptyHint: { fontSize: '14px', marginTop: '10px' },
  planningCard: { display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBF5', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexWrap: 'wrap' },
  planningIcon: { width: '50px', height: '50px', borderRadius: '12px', background: '#E5D4C0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  planningInfo: { flex: 1, minWidth: '200px' },
  planningName: { display: 'block', fontWeight: '600', color: '#3D2B1F', fontSize: '18px', marginBottom: '4px' },
  planningEntreprise: { display: 'flex', alignItems: 'center', gap: '6px', color: '#8B6914', fontSize: '13px', marginBottom: '8px' },
  planningDetails: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '4px' },
  planningTime: { color: '#3D2B1F', fontSize: '14px' },
  planningBreak: { color: '#9E9E9E', fontSize: '14px' },
  planningDays: { color: '#666', fontSize: '13px' },
  toleranceBox: { display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF3C7', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', color: '#92400E' },
  defaultBadge: { background: '#DEF7EC', color: '#03543F', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  actions: { display: 'flex', gap: '8px' },
  actionBtn: { background: '#E5D4C0', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', color: '#3D2B1F' },
  deleteBtn: { background: '#FEE2E2', color: '#9B2C2C' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 },
  modal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E5D4C0' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: '#3D2B1F' },
  input: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none' },
  selectInput: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', background: '#fff' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500', color: '#3D2B1F', cursor: 'pointer' },
  checkbox: { width: '18px', height: '18px', accentColor: '#8B6914' },
  daysGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  dayBtn: { padding: '10px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#3D2B1F', transition: 'all 0.2s' },
  dayBtnActive: { background: '#8B6914', borderColor: '#8B6914', color: '#fff' },
  hint: { fontSize: '12px', color: '#9E9E9E', marginTop: '4px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5D4C0' },
  cancelBtn: { padding: '12px 24px', background: '#E5D4C0', color: '#3D2B1F', border: 'none', borderRadius: '10px', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#8B6914', color: '#FFFBF5', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
  
  // ✅ Styles modale de confirmation
  confirmModal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' },
  modalIconContainer: { width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' },
  modalText: { color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' },
  modalButtons: { display: 'flex', gap: '12px' },
  confirmDeleteBtn: { flex: 1, padding: '12px', background: '#9B2C2C', color: '#FFF', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
}