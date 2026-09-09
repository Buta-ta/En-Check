// ═══════════════════════════════════════════════════════════
// 👤 PAGE GESTION DES ENRÔLEMENTS FACIAUX
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
// les photos d'enrôlement viennent d'un bucket privé : cette pièce
// signe leur adresse au moment de l'affichage (3 secondes de validité de plus que
// nécessaire, on ne signe jamais deux fois la même).
import PhotoSignee from '../components/PhotoSignee'
import PageHeader from '../components/PageHeader'
import {
  CheckCircle2, XCircle, RefreshCw, Trash2,
  Eye, X, Clock, Users, AlertTriangle, Camera
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function GestionEnrolements() {
  const [admin, setAdmin] = useState(null)
  const [enrolements, setEnrolements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [entreprises, setEntreprises] = useState([])
  const [photoModal, setPhotoModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [motifRefus, setMotifRefus] = useState('')

  useEffect(() => {
    const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
    setAdmin(adminData)

    if (adminData.role === 'super_admin') {
      loadEntreprises()
    } else {
      const entId = adminData.selectedEnterprise?.id || adminData.enterprise_id
      setSelectedEntrepriseId(entId)
    }
  }, [])

  useEffect(() => {
    if (admin) loadEnrolements()
  }, [admin, selectedEntrepriseId, filterStatut])

  // ═══════════════════════════════════════════════════════════
  // 📊 CHARGER LES DONNÉES
  // ═══════════════════════════════════════════════════════════

  const loadEntreprises = async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setEntreprises(data || [])
  }

  const loadEnrolements = async () => {
    setLoading(true)
    try {
      let targetId = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        targetId = admin.selectedEnterprise?.id || admin.enterprise_id
      }

      let query = supabase
        .from('face_enrollments')
        .select(`
          *,
          employees (id, first_name, last_name, matricule, photo_url),
          enterprises (id, name)
        `)
        .order('created_at', { ascending: false })

      if (targetId && targetId !== 'all') {
        query = query.eq('enterprise_id', targetId)
      }

      if (filterStatut !== 'tous') {
        query = query.eq('status', filterStatut)
      }

      const { data, error } = await query
      if (error) throw error
      setEnrolements(data || [])
    } catch (err) {
      console.error('Erreur chargement enrôlements:', err)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ APPROUVER UN ENRÔLEMENT
  // ═══════════════════════════════════════════════════════════

  const approuver = async (enrollmentId) => {
    try {
      const { error } = await supabase
        .from('face_enrollments')
        .update({
          status: 'approved',
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)

      if (error) throw error
      toast.success('Enrôlement approuvé')
      loadEnrolements()
    } catch (err) {
      console.error('Erreur approbation:', err)
      toast.error('Erreur lors de l\'approbation')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ❌ REFUSER UN ENRÔLEMENT
  // ═══════════════════════════════════════════════════════════

  const refuser = async (enrollmentId) => {
    if (!motifRefus.trim()) {
      toast.error('Veuillez indiquer un motif de refus')
      return
    }

    try {
      const { error } = await supabase
        .from('face_enrollments')
        .update({
          status: 'rejected',
          rejection_reason: motifRefus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)

      if (error) throw error
      toast.success('Enrôlement refusé')
      setConfirmModal(null)
      setMotifRefus('')
      loadEnrolements()
    } catch (err) {
      console.error('Erreur refus:', err)
      toast.error('Erreur lors du refus')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔄 DEMANDER RÉ-ENRÔLEMENT
  // ═══════════════════════════════════════════════════════════

  const demanderReEnrolement = async (enrollmentId, employeeName) => {
    try {
      const { error } = await supabase
        .from('face_enrollments')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)

      if (error) throw error
      toast.success(`Ré-enrôlement demandé pour ${employeeName}`)
      loadEnrolements()
    } catch (err) {
      console.error('Erreur ré-enrôlement:', err)
      toast.error('Erreur')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🗑️ SUPPRIMER UN ENRÔLEMENT
  // ═══════════════════════════════════════════════════════════

  const supprimer = async (enrollmentId) => {
    try {
      const { error } = await supabase
        .from('face_enrollments')
        .delete()
        .eq('id', enrollmentId)

      if (error) throw error
      toast.success('Enrôlement supprimé')
      setConfirmModal(null)
      loadEnrolements()
    } catch (err) {
      console.error('Erreur suppression:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 STATS
  // ═══════════════════════════════════════════════════════════

  const stats = {
    total: enrolements.length,
    pending: enrolements.filter(e => e.status === 'pending').length,
    approved: enrolements.filter(e => e.status === 'approved').length,
    rejected: enrolements.filter(e => e.status === 'rejected').length,
  }

  // ═══════════════════════════════════════════════════════════
  // 🖥️ RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div style={styles.container}>
      <PageHeader
        title="Gestion des Enrôlements"
        subtitle="Validez les profils faciaux des employés"
      />

      {/* STATS */}
      <div style={styles.statsGrid}>
        {[
          { icon: Users, color: '#6366F1', bg: 'rgba(99,102,241,0.15)', value: stats.total, label: 'Total' },
          { icon: Clock, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', value: stats.pending, label: 'En attente' },
          { icon: CheckCircle2, color: '#10B981', bg: 'rgba(16,185,129,0.15)', value: stats.approved, label: 'Approuvés' },
          { icon: XCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)', value: stats.rejected, label: 'Refusés' },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: s.bg }}>
              <s.icon size={22} color={s.color} />
            </div>
            <div>
              <span style={styles.statNumber}>{s.value}</span>
              <span style={styles.statLabel}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* FILTRES */}
      <div style={styles.filters}>
        {admin?.role === 'super_admin' && (
          <select
            value={selectedEntrepriseId}
            onChange={e => setSelectedEntrepriseId(e.target.value)}
            style={styles.select}
          >
            <option value="all">Toutes les entreprises</option>
            {entreprises.map(ent => (
              <option key={ent.id} value={ent.id}>{ent.name}</option>
            ))}
          </select>
        )}

        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          style={styles.select}
        >
          <option value="tous">Tous les statuts</option>
          <option value="pending">⏳ En attente</option>
          <option value="approved">✅ Approuvés</option>
          <option value="rejected">❌ Refusés</option>
        </select>
      </div>

      {/* LISTE */}
      {loading ? (
        <div style={styles.loading}>
          <Clock size={40} color="#F59E0B" />
          <p style={{ color: '#888', marginTop: '16px' }}>Chargement...</p>
        </div>
      ) : enrolements.length === 0 ? (
        <div style={styles.empty}>
          <Camera size={64} color="#666" />
          <p style={styles.emptyText}>Aucun enrôlement trouvé</p>
        </div>
      ) : (
        <div style={styles.list}>
          {enrolements.map(enr => (
            <div key={enr.id} style={styles.card}>

              {/* PHOTO + INFOS */}
              <div style={styles.cardLeft}>
                <div style={styles.photoWrap}>
                  {enr.enrollment_photo_url ? (
                    <PhotoSignee
                      url={enr.enrollment_photo_url}
                      alt="Enrôlement"
                      style={styles.photo}
                    />
                  ) : (
                    <div style={styles.photoPlaceholder}>
                      <Camera size={28} color="#666" />
                    </div>
                  )}
                  {enr.enrollment_photo_url && (
                    <button
                      onClick={() => setPhotoModal(enr)}
                      style={styles.viewPhotoBtn}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>

                <div style={styles.infoBlock}>
                  <div style={styles.employeeName}>
                    {enr.employees?.first_name} {enr.employees?.last_name}
                  </div>
                  <div style={styles.employeeMeta}>
                    {enr.employees?.matricule}
                    {enr.enterprises?.name && ` • ${enr.enterprises.name}`}
                  </div>
                  <div style={styles.enrollDate}>
                    {new Date(enr.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                  {enr.rejection_reason && (
                    <div style={styles.rejectionReason}>
                      Motif : {enr.rejection_reason}
                    </div>
                  )}
                </div>
              </div>

              {/* STATUT + ACTIONS */}
              <div style={styles.cardRight}>
                {/* Badge statut */}
                <span style={{
                  ...styles.statusBadge,
                  background: enr.status === 'approved'
                    ? 'rgba(16,185,129,0.12)'
                    : enr.status === 'pending'
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(239,68,68,0.12)',
                  color: enr.status === 'approved' ? '#10B981'
                    : enr.status === 'pending' ? '#F59E0B'
                    : '#EF4444',
                  border: `1px solid ${
                    enr.status === 'approved' ? 'rgba(16,185,129,0.3)'
                    : enr.status === 'pending' ? 'rgba(245,158,11,0.3)'
                    : 'rgba(239,68,68,0.3)'
                  }`,
                }}>
                  {enr.status === 'approved' ? '✅ Approuvé'
                    : enr.status === 'pending' ? '⏳ En attente'
                    : '❌ Refusé'}
                </span>

                {/* Actions */}
                <div style={styles.actions}>
                  {enr.status === 'pending' && (
                    <>
                      <button
                        onClick={() => approuver(enr.id)}
                        style={styles.btnApprove}
                        title="Approuver"
                      >
                        <CheckCircle2 size={16} />
                        Approuver
                      </button>
                      <button
                        onClick={() => setConfirmModal({ type: 'refus', enr })}
                        style={styles.btnReject}
                        title="Refuser"
                      >
                        <XCircle size={16} />
                        Refuser
                      </button>
                    </>
                  )}

                  {enr.status === 'approved' && (
                    <button
                      onClick={() => demanderReEnrolement(enr.id,
                        `${enr.employees?.first_name} ${enr.employees?.last_name}`
                      )}
                      style={styles.btnRenew}
                      title="Demander ré-enrôlement"
                    >
                      <RefreshCw size={16} />
                      Ré-enrôler
                    </button>
                  )}

                  <button
                    onClick={() => setConfirmModal({ type: 'suppression', enr })}
                    style={styles.btnDelete}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PHOTO */}
      {photoModal && (
        <div style={styles.modalOverlay} onClick={() => setPhotoModal(null)}>
          <div style={styles.photoModalContent} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoModal(null)} style={styles.closeBtn}>
              <X size={20} />
            </button>
            <PhotoSignee
              url={photoModal.enrollment_photo_url}
              alt="Photo d'enrôlement"
              style={styles.fullPhoto}
            />
            <div style={styles.photoModalInfo}>
              <strong style={{ color: '#FFF' }}>
                {photoModal.employees?.first_name} {photoModal.employees?.last_name}
              </strong>
              <span style={{ color: '#888', fontSize: '13px' }}>
                {' • '}{photoModal.employees?.matricule}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMATION REFUS */}
      {confirmModal?.type === 'refus' && (
        <div style={styles.modalOverlay} onClick={() => setConfirmModal(null)}>
          <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div style={styles.confirmIcon}>
              <XCircle size={32} color="#EF4444" />
            </div>
            <h3 style={styles.confirmTitle}>Refuser l'enrôlement</h3>
            <p style={styles.confirmText}>
              {confirmModal.enr.employees?.first_name}{' '}
              {confirmModal.enr.employees?.last_name}
            </p>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Motif du refus *</label>
              <textarea
                value={motifRefus}
                onChange={e => setMotifRefus(e.target.value)}
                placeholder="Ex: Photo floue, mauvais cadrage..."
                style={styles.textarea}
              />
            </div>

            <div style={styles.confirmBtns}>
              <button
                onClick={() => { setConfirmModal(null); setMotifRefus('') }}
                style={styles.btnCancel}
              >
                Annuler
              </button>
              <button
                onClick={() => refuser(confirmModal.enr.id)}
                style={styles.btnConfirmReject}
              >
                <XCircle size={16} />
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMATION SUPPRESSION */}
      {confirmModal?.type === 'suppression' && (
        <div style={styles.modalOverlay} onClick={() => setConfirmModal(null)}>
          <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div style={styles.confirmIcon}>
              <AlertTriangle size={32} color="#EF4444" />
            </div>
            <h3 style={styles.confirmTitle}>Supprimer l'enrôlement</h3>
            <p style={styles.confirmText}>
              Cette action est irréversible.{' '}
              {confirmModal.enr.employees?.first_name}{' '}
              {confirmModal.enr.employees?.last_name} devra se ré-enrôler.
            </p>
            <div style={styles.confirmBtns}>
              <button
                onClick={() => setConfirmModal(null)}
                style={styles.btnCancel}
              >
                Annuler
              </button>
              <button
                onClick={() => supprimer(confirmModal.enr.id)}
                style={styles.btnConfirmDelete}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════

const styles = {
  container: {
    padding: '30px',
    minHeight: '100vh',
    background: '#0A0A0F',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'rgba(20,20,35,0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statNumber: {
    display: 'block',
    fontSize: '28px',
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: '1',
    marginBottom: '4px',
  },
  statLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#888',
    fontWeight: '500',
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  select: {
    padding: '10px 16px',
    background: 'rgba(20,20,35,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    color: '#E5E5E5',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    background: 'rgba(20,20,35,0.6)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  emptyText: {
    color: '#888',
    fontSize: '16px',
    marginTop: '16px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: 'rgba(20,20,35,0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    minWidth: 0,
  },
  photoWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  photo: {
    width: '64px',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '10px',
    border: '2px solid rgba(255,255,255,0.1)',
    display: 'block',
  },
  photoPlaceholder: {
    width: '64px',
    height: '80px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '2px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPhotoBtn: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    borderRadius: '6px',
    padding: '4px',
    cursor: 'pointer',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBlock: {
    flex: 1,
    minWidth: 0,
  },
  employeeName: {
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '4px',
  },
  employeeMeta: {
    color: '#888',
    fontSize: '13px',
    marginBottom: '4px',
  },
  enrollDate: {
    color: '#666',
    fontSize: '12px',
    marginBottom: '4px',
  },
  rejectionReason: {
    color: '#EF4444',
    fontSize: '12px',
    fontStyle: 'italic',
    marginTop: '4px',
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px',
    flexShrink: 0,
  },
  statusBadge: {
    padding: '5px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  btnApprove: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '10px',
    color: '#10B981',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnReject: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px',
    color: '#EF4444',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnRenew: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '10px',
    color: '#6366F1',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnDelete: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#EF4444',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  photoModalContent: {
    background: '#141423',
    borderRadius: '20px',
    maxWidth: '400px',
    width: '100%',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0,0,0,0.6)',
    border: 'none',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#FFF',
    zIndex: 10,
  },
  fullPhoto: {
    width: '100%',
    height: 'auto',
    display: 'block',
    maxHeight: '500px',
    objectFit: 'contain',
    background: '#000',
  },
  photoModalInfo: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  confirmModal: {
    background: '#141423',
    borderRadius: '20px',
    maxWidth: '440px',
    width: '100%',
    padding: '32px',
    border: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'center',
  },
  confirmIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'rgba(239,68,68,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px auto',
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  confirmText: {
    color: '#888',
    fontSize: '14px',
    margin: '0 0 24px 0',
    lineHeight: '1.6',
  },
  formGroup: {
    textAlign: 'left',
    marginBottom: '24px',
  },
  formLabel: {
    display: 'block',
    color: '#E5E5E5',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    padding: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#E5E5E5',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  confirmBtns: {
    display: 'flex',
    gap: '12px',
  },
  btnCancel: {
    flex: 1,
    padding: '13px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#E5E5E5',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnConfirmReject: {
    flex: 1,
    padding: '13px',
    background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    border: 'none',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  btnConfirmDelete: {
    flex: 1,
    padding: '13px',
    background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    border: 'none',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
}