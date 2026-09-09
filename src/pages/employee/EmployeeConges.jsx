// src/pages/employee/EmployeeConges.jsx
// ═══════════════════════════════════════════════════════════
// 📅 MES CONGÉS - ESPACE EMPLOYÉ
// Avec affichage des jours fériés de l'entreprise
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Plus, Clock, CheckCircle, XCircle,
  X, Send, FileText, Trash2, AlertTriangle,
  Upload, Paperclip, FileImage, File, Eye, ExternalLink,
  Download, RefreshCw, ZoomIn, ZoomOut
} from 'lucide-react'
import { db } from '../../lib/db'
import EmployeeAuthService from '../../services/employeeAuthService'
import HolidayService from '../../services/holidayService'
import EmployeeLayout from '../../components/EmployeeLayout'
import LeaveBalanceService from '../../services/leaveBalanceService'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}

function getFileType(url) {
  if (!url) return null
  const ext = url.split('.').pop().toLowerCase().split('?')[0]
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

function getFileName(url) {
  if (!url) return ''
  const parts = url.split('/')
  const name = parts[parts.length - 1].split('?')[0]
  const match = name.match(/^\d+_(.+)$/)
  return match ? match[1] : name
}

function formatDateShortUTC(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function countCalendarDays(startStr, endStr) {
  if (!startStr || !endStr) return 0
  const diff = Math.ceil(
    (new Date(endStr) - new Date(startStr)) / (1000 * 60 * 60 * 24)
  ) + 1
  return diff > 0 ? diff : 0
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT UPLOAD ZONE
// ═══════════════════════════════════════════════════════════
function UploadZone({ file, onFileSelect, onRemove, uploading }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) validateAndSelect(e.dataTransfer.files[0])
  }

  const handleChange = (e) => {
    if (e.target.files?.[0]) validateAndSelect(e.target.files[0])
  }

  const validateAndSelect = (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error('Format non supporté. JPG, PNG, WebP ou PDF uniquement.')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error('Fichier trop volumineux (max 5 Mo)')
      return
    }
    onFileSelect(f)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontSize: '12px', fontWeight: '600', color: '#888',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Paperclip size={13} /> Justificatif
        <span style={{ color: '#555', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
      </label>

      {!file ? (
        <div
          style={{
            border: `2px dashed ${dragActive ? '#10B981' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 12, padding: '20px 16px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, cursor: 'pointer',
            background: dragActive ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s ease',
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <Upload size={26} color={dragActive ? '#10B981' : '#555'} />
          <p style={{ color: '#CCC', fontSize: 13, margin: 0, textAlign: 'center' }}>
            <span style={{ color: '#10B981', fontWeight: 600 }}>Cliquez</span> ou glissez un fichier
          </p>
          <p style={{ color: '#555', fontSize: 11, margin: 0 }}>
            PDF, JPG, PNG, WebP · Max 5 Mo
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'rgba(16,185,129,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {file.type.startsWith('image/')
              ? <FileImage size={22} color="#10B981" />
              : <File size={22} color="#3B82F6" />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              color: '#E5E5E5', fontSize: 13, fontWeight: 500, margin: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {file.name}
            </p>
            <p style={{ color: '#888', fontSize: 11, margin: '2px 0 0 0' }}>
              {formatFileSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={uploading}
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#EF4444', cursor: uploading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT VISUALISEUR DE DOCUMENT
// ═══════════════════════════════════════════════════════════
function DocumentViewer({ url, onClose }) {
  const [zoom, setZoom] = useState(1)
  const [loadingDoc, setLoadingDoc] = useState(true)
  const fileType = getFileType(url)
  const fileName = getFileName(url)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#141423', borderRadius: 20,
          width: '100%', maxWidth: 860, maxHeight: '95vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Paperclip size={16} color="#10B981" />
            <span style={{ color: '#FFF', fontSize: 15, fontWeight: 600 }}>Justificatif</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {fileType === 'image' && (
              <>
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} style={docBtnStyle}>
                  <ZoomOut size={16} />
                </button>
                <span style={{ color: '#888', fontSize: 12, minWidth: 42, textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} style={docBtnStyle}>
                  <ZoomIn size={16} />
                </button>
              </>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" style={docBtnStyle}>
              <ExternalLink size={16} />
            </a>
            <a href={url} download style={docBtnStyle}>
              <Download size={16} />
            </a>
            <button onClick={onClose} style={{ ...docBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, background: 'rgba(0,0,0,0.2)', minHeight: 280,
        }}>
          {loadingDoc && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <RefreshCw size={28} color="#10B981" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#888', margin: 0, fontSize: 13 }}>Chargement...</p>
            </div>
          )}
          {fileType === 'image' && (
            <img
              src={url}
              alt="Justificatif"
              style={{
                maxWidth: '100%', maxHeight: '65vh',
                objectFit: 'contain', borderRadius: 8,
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s ease',
                display: loadingDoc ? 'none' : 'block',
              }}
              onLoad={() => setLoadingDoc(false)}
            />
          )}
          {fileType === 'pdf' && (
            <iframe
              src={url}
              style={{
                width: '100%', height: '65vh',
                border: 'none', borderRadius: 8,
                display: loadingDoc ? 'none' : 'block',
              }}
              title="Justificatif PDF"
              onLoad={() => setLoadingDoc(false)}
            />
          )}
          {fileType === 'other' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <File size={48} color="#666" />
              <p style={{ color: '#888', margin: 0 }}>Aperçu non disponible</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: '#10B981', textDecoration: 'none',
                  padding: '10px 20px',
                  background: 'rgba(16,185,129,0.1)',
                  borderRadius: 8, fontWeight: 500,
                }}
              >
                <Download size={16} /> Télécharger
              </a>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.1)',
        }}>
          <span style={{ color: '#888', fontSize: 12 }}>📄 {fileName}</span>
        </div>
      </div>
    </div>
  )
}

const docBtnStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  width: 34,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#E5E5E5',
  cursor: 'pointer',
  textDecoration: 'none',
  flexShrink: 0,
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function EmployeeConges() {
  const [employee, setEmployee] = useState(null)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('all')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [requestToDelete, setRequestToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [viewingDocument, setViewingDocument] = useState(null)

  const [holidaysInRange, setHolidaysInRange] = useState([])
  const [companyHolidays, setCompanyHolidays] = useState([])
  const [showHolidaysPanel, setShowHolidaysPanel] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState(null)
  const [loadingLeaveBalance, setLoadingLeaveBalance] = useState(false)

  const [formData, setFormData] = useState({
    leave_type: 'conge_paye',
    start_date: '',
    end_date: '',
    reason: '',
    document_file: null,
  })

  const navigate = useNavigate()

  const leaveTypes = [
    { value: 'conge_paye', label: 'Congé payé', emoji: '🏖️' },
    { value: 'conge_maladie', label: 'Congé maladie', emoji: '🏥' },
    { value: 'conge_familial', label: 'Congé familial', emoji: '👨‍👩‍👧' },
    { value: 'conge_sans_solde', label: 'Congé sans solde', emoji: '📋' },
    { value: 'permission', label: 'Permission', emoji: '🎫' },
    { value: 'autre', label: 'Autre', emoji: '📝' },
  ]

  const statusConfig = {
    en_attente: { label: 'En attente', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', icon: Clock },
    approuve: { label: 'Approuvée', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icon: CheckCircle },
    refuse: { label: 'Refusée', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', icon: XCircle },
  }

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) { navigate('/employee/login'); return }
    if (!emp.features?.conges) { navigate('/employee/dashboard'); return }
    setEmployee(emp)
    loadLeaveRequests(emp)
    loadLeaveBalance(emp)
  }, [navigate])

  useEffect(() => {
    const loadHolidays = async () => {
      if (!employee) return
      const year = new Date().getFullYear()
      const holidays = await HolidayService.getHolidaysForEnterprise(employee.enterprise_id, year)
      setCompanyHolidays(holidays.filter(h => !h.is_worked))
    }
    if (employee) loadHolidays()
  }, [employee])

  useEffect(() => {
    const loadRangeHolidays = async () => {
      if (!formData.start_date || !formData.end_date || !employee) {
        setHolidaysInRange([])
        return
      }
      const holidays = await HolidayService.getHolidaysForRange(
        employee.enterprise_id,
        formData.start_date,
        formData.end_date
      )
      setHolidaysInRange(holidays.filter(h => !h.is_worked))
    }
    loadRangeHolidays()
  }, [formData.start_date, formData.end_date, employee])

  const loadLeaveBalance = async (emp) => {
    if (!emp?.id) return
    try {
      setLoadingLeaveBalance(true)
      const year = new Date().getFullYear()

      // ✅ CHANGEMENT : Toujours recalculer pour avoir les données à jour
      const balance = await LeaveBalanceService.calculateBalance(emp.id, year)

      setLeaveBalance(balance)
    } catch (err) {
      console.error('Erreur chargement solde congés:', err)
      toast.error('Impossible de charger votre solde de congés')
    }
    setLoadingLeaveBalance(false)
  }

  const loadLeaveRequests = async (emp) => {
    try {
      const { data, error } = await db()
        .from('leave_requests')
        .select('*')
        .eq('employee_id', emp.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeaveRequests(data || [])
    } catch (err) {
      console.error('Erreur chargement congés:', err)
      toast.error('Erreur de chargement')
    }
    setLoading(false)
  }

  const uploadDocument = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const randomId = Math.random().toString(36).substring(7)
    const fileName = `leave_requests/${Date.now()}_${randomId}.${ext}`

    const { error } = await db().storage
      .from('documents')
      .upload(fileName, file, { contentType: file.type })

    if (error) throw error

    const { data: urlData } = db().storage
      .from('documents')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  }

  const deleteDocument = async (url) => {
    if (!url) return
    try {
      const parts = url.split('/documents/')
      if (parts.length > 1) {
        const filePath = parts[1].split('?')[0]
        await db().storage.from('documents').remove([filePath])
      }
    } catch (err) {
      console.error('Erreur suppression document:', err)
    }
  }

 const handleSubmit = async () => {
  if (!formData.start_date || !formData.end_date) {
    toast.error('Veuillez sélectionner les dates')
    return
  }
  if (new Date(formData.end_date) < new Date(formData.start_date)) {
    toast.error('La date de fin doit être après la date de début')
    return
  }

  setSubmitting(true)
  setUploading(!!formData.document_file)

  try {
    let documentUrl = null

    if (formData.document_file) {
      try {
        documentUrl = await uploadDocument(formData.document_file)
      } catch (uploadErr) {
        console.error('Erreur upload:', uploadErr)
        toast.error('Erreur lors de l\'upload du justificatif')
        setSubmitting(false)
        setUploading(false)
        return
      }
    }

    // ✅ ÉTAPE 1 : Insérer la demande de congé
    const { data: leaveRequest, error: leaveError } = await db()
      .from('leave_requests')
      .insert({
        employee_id: employee.id,
        enterprise_id: employee.enterprise_id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || null,
        document_url: documentUrl,
        status: 'en_attente',
      })
      .select()
      .single()

    if (leaveError) {
      if (documentUrl) await deleteDocument(documentUrl)
      throw leaveError
    }

    // ✅ ÉTAPE 2 : Créer la notification pour les admins
    try {
      const leaveTypeLabel = leaveTypes.find(t => t.value === formData.leave_type)?.label || 'Congé'
      const days = countCalendarDays(formData.start_date, formData.end_date)
      
      await db()
        .from('notifications')
        .insert({
          enterprise_id: employee.enterprise_id,
          user_type: 'admin',
          type: 'leave_request',
          title: 'Nouvelle demande de congé',
          message: `${employee.first_name} ${employee.last_name} a demandé un ${leaveTypeLabel} de ${days} jour${days > 1 ? 's' : ''}`,
          priority: 'medium',
          related_id: leaveRequest.id,
          related_type: 'leave_request',
          data: {
            employee_id: employee.id,
            employee_name: `${employee.first_name} ${employee.last_name}`,
            leave_type: formData.leave_type,
            start_date: formData.start_date,
            end_date: formData.end_date,
            days: days,
            has_document: !!documentUrl
          }
        })
    } catch (notifError) {
      console.error('Erreur création notification:', notifError)
      // ⚠️ On ne bloque pas la demande si la notification échoue
    }

    toast.success('Demande de congé envoyée !')
    setShowModal(false)
    setFormData({
      leave_type: 'conge_paye',
      start_date: '',
      end_date: '',
      reason: '',
      document_file: null,
    })
    setHolidaysInRange([])

    await loadLeaveRequests(employee)
    await LeaveBalanceService.calculateBalance(employee.id, new Date().getFullYear())
    await loadLeaveBalance(employee)

  } catch (err) {
    console.error('Erreur soumission:', err)
    toast.error('Erreur lors de l\'envoi')
  }

  setSubmitting(false)
  setUploading(false)
}

  const confirmDelete = (request) => {
    setRequestToDelete(request)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!requestToDelete) return
    setDeleting(true)

    try {
      if (requestToDelete.document_url) {
        await deleteDocument(requestToDelete.document_url)
      }

      const { error } = await db()
        .from('leave_requests')
        .delete()
        .eq('id', requestToDelete.id)
        .eq('employee_id', employee.id)

      if (error) throw error

      toast.success('Demande annulée')
      setShowDeleteModal(false)
      setRequestToDelete(null)

      // ✅ NOUVEAU : Recalculer automatiquement après suppression
      await loadLeaveRequests(employee)
      await LeaveBalanceService.calculateBalance(employee.id, new Date().getFullYear())
      await loadLeaveBalance(employee)

    } catch (err) {
      console.error('Erreur suppression:', err)
      toast.error('Erreur lors de l\'annulation')
    }
    setDeleting(false)
  }

  const calculateWorkingDays = () => {
    if (!formData.start_date || !formData.end_date) return 0
    const holidaySet = HolidayService.buildHolidaySet(holidaysInRange)
    return HolidayService.countWorkingDays(
      formData.start_date,
      formData.end_date,
      holidaySet,
      true
    )
  }

  const calculateCalendarDuration = () => {
    return countCalendarDays(formData.start_date, formData.end_date)
  }

  const upcomingCompanyHolidays = companyHolidays
    .filter(h => h.date >= new Date().toISOString().split('T')[0])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)

  const filteredRequests = leaveRequests.filter(req => {
    if (filter === 'all') return true
    return req.status === filter
  })

  const countByStatus = {
    all: leaveRequests.length,
    en_attente: leaveRequests.filter(r => r.status === 'en_attente').length,
    approuve: leaveRequests.filter(r => r.status === 'approuve').length,
    refuse: leaveRequests.filter(r => r.status === 'refuse').length,
  }

  if (!employee) return null

  return (
    <EmployeeLayout>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .leave-card { transition: all 0.2s ease !important; }
        .leave-card:hover { border-color: rgba(255,255,255,0.1) !important; transform: translateY(-2px) !important; }
        .new-leave-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 30px rgba(16, 185, 129, 0.3) !important;
        }
        .delete-req-btn:hover {
          background: rgba(239,68,68,0.15) !important;
          border-color: rgba(239,68,68,0.35) !important;
        }
        .filter-btn:hover { background: rgba(255,255,255,0.06) !important; }
        .doc-view-btn:hover { background: rgba(59,130,246,0.15) !important; border-color: rgba(59,130,246,0.35) !important; }
        .holiday-toggle-btn:hover { background: rgba(139,92,246,0.14) !important; }
        select option { background: #141423; color: #E5E5E5; }
      `}</style>

      <div style={S.container}>
        <div style={S.header}>
          <div>
            <h1 style={S.title}>Mes congés</h1>
            <p style={S.subtitle}>Gérez vos demandes de congés</p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="holiday-toggle-btn"
              onClick={() => setShowHolidaysPanel(s => !s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: showHolidaysPanel ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
                color: showHolidaysPanel ? '#8B5CF6' : '#CCC',
                padding: '12px 16px',
                borderRadius: '12px',
                border: showHolidaysPanel ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(255,255,255,0.08)',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                fontFamily: 'inherit',
              }}
            >
              <CalendarDays size={17} />
              <span>Jours fériés</span>
              {companyHolidays.length > 0 && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: showHolidaysPanel ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)',
                  fontSize: 11,
                  fontWeight: 800,
                }}>
                  {companyHolidays.length}
                </span>
              )}
            </button>

            <button
              className="new-leave-btn"
              onClick={() => setShowModal(true)}
              style={S.newBtn}
            >
              <Plus size={18} />
              <span>Nouvelle demande</span>
            </button>
          </div>
        </div>


        <div style={S.balanceGrid}>
  {/* Jours acquis */}
  <div style={S.balanceCard}>
    <div style={{ ...S.balanceIconWrap, background: 'rgba(16,185,129,0.12)' }}>
      <CalendarDays size={20} color="#10B981" />
    </div>
    <div>
      <div style={S.balanceValue}>
        {loadingLeaveBalance ? '...' : `${leaveBalance?.total_acquired || 0}j`}
      </div>
      <div style={S.balanceLabel}>Jours acquis</div>
    </div>
  </div>

  {/* Jours pris */}
  <div style={S.balanceCard}>
    <div style={{ ...S.balanceIconWrap, background: 'rgba(245,158,11,0.12)' }}>
      <CheckCircle size={20} color="#F59E0B" />
    </div>
    <div>
      <div style={S.balanceValue}>
        {loadingLeaveBalance ? '...' : `${leaveBalance?.total_taken || 0}j`}
      </div>
      <div style={S.balanceLabel}>Jours pris</div>
    </div>
  </div>

  {/* En attente - ✅ CORRIGÉ */}
  <div style={S.balanceCard}>
    <div style={{ ...S.balanceIconWrap, background: 'rgba(99,102,241,0.12)' }}>
      <Clock size={20} color="#6366F1" />
    </div>
    <div>
      <div style={S.balanceValue}>
        {loadingLeaveBalance ? '...' : `${leaveBalance?.total_pending || 0}j`}
      </div>
      <div style={S.balanceLabel}>
        En attente
        {leaveBalance?.pending_calendar_days > 0 && 
         leaveBalance.pending_calendar_days !== leaveBalance.total_pending && (
          <span style={{ 
            fontSize: '10px', 
            color: '#666', 
            display: 'block', 
            marginTop: 2,
            fontWeight: 400 
          }}>
            ({leaveBalance.pending_calendar_days}j cal.)
          </span>
        )}
      </div>
    </div>
  </div>

  {/* Solde restant */}
  <div style={S.balanceCard}>
    <div style={{ ...S.balanceIconWrap, background: 'rgba(139,92,246,0.12)' }}>
      <CheckCircle size={20} color="#8B5CF6" />
    </div>
    <div>
      <div style={{
        ...S.balanceValue,
        color: (leaveBalance?.balance || 0) < 0 ? '#EF4444' : '#FFF',
      }}>
        {loadingLeaveBalance ? '...' : `${leaveBalance?.balance || 0}j`}
      </div>
      <div style={S.balanceLabel}>Solde restant</div>
    </div>
  </div>
</div>
        {leaveBalance && (
          <div style={S.balanceInfoBox}>
            <span style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>
              Vos droits sont calculés automatiquement à partir de la configuration de votre entreprise
              {leaveBalance?.calculation_details?.leave_days_per_month
                ? ` (${leaveBalance.calculation_details.leave_days_per_month} jour(s) acquis par mois)`
                : ''
              }.
            </span>
          </div>
        )}

        {showHolidaysPanel && (
          <div style={S.holidaysPanel}>
            <div style={S.holidaysPanelHeader}>
              <div>
                <h3 style={S.holidaysTitle}>Jours fériés de votre entreprise</h3>
                <p style={S.holidaysSubtitle}>Les jours fériés non travaillés sont exclus du décompte de vos congés.</p>
              </div>
            </div>

            {upcomingCompanyHolidays.length === 0 ? (
              <div style={S.holidaysEmpty}>
                <CalendarDays size={26} color="#666" />
                <span style={{ color: '#777', fontSize: 13 }}>Aucun jour férié à venir enregistré</span>
              </div>
            ) : (
              <div style={S.holidaysList}>
                {upcomingCompanyHolidays.map(holiday => (
                  <div key={holiday.id} style={S.holidayItem}>
                    <div style={S.holidayIcon}>🎌</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.holidayName}>{holiday.name}</div>
                      <div style={S.holidayDate}>{formatDateShortUTC(holiday.date)}</div>
                    </div>
                    <div style={S.holidayBadge}>Férié</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={S.filterRow}>
          {[
            { key: 'all', label: 'Toutes' },
            { key: 'en_attente', label: 'En attente' },
            { key: 'approuve', label: 'Approuvées' },
            { key: 'refuse', label: 'Refusées' },
          ].map(f => (
            <button
              key={f.key}
              className="filter-btn"
              onClick={() => setFilter(f.key)}
              style={{
                ...S.filterBtn,
                ...(filter === f.key ? S.filterBtnActive : {}),
              }}
            >
              {f.label}
              {countByStatus[f.key] > 0 && (
                <span style={{
                  ...S.filterCount,
                  background: filter === f.key ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                  color: filter === f.key ? '#10B981' : '#666',
                }}>
                  {countByStatus[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={S.emptyWrap}>
            <CalendarDays size={48} color="#666" />
            <h3 style={{ color: '#FFF', margin: '12px 0 4px 0' }}>Aucune demande</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px 0' }}>
              {filter !== 'all'
                ? 'Aucune demande avec ce statut'
                : 'Vous n\'avez pas encore soumis de demande de congé'
              }
            </p>
            {filter === 'all' && (
              <button onClick={() => setShowModal(true)} style={S.emptyBtn}>
                <Plus size={16} /> Faire une demande
              </button>
            )}
          </div>
        ) : (
          <div style={S.list}>
            {filteredRequests.map((request, index) => {
              const status = statusConfig[request.status] || statusConfig.en_attente
              const StatusIcon = status.icon
              const leaveType = leaveTypes.find(t => t.value === request.leave_type)
              const isPending = request.status === 'en_attente'
              const days = countCalendarDays(request.start_date, request.end_date)
              const hasDocument = !!request.document_url
              const docType = hasDocument ? getFileType(request.document_url) : null

              return (
                <div
                  key={request.id}
                  className="leave-card"
                  style={{
                    ...S.card,
                    borderLeft: `4px solid ${status.color}`,
                    animation: `fadeInUp 0.3s ease ${index * 0.05}s forwards`,
                    opacity: 0,
                  }}
                >
                  <div style={S.cardHeader}>
                    <div style={S.cardTop}>
                      <span style={{
                        ...S.leaveTypeBadge,
                        background: `${status.color}10`,
                        color: status.color,
                        border: `1px solid ${status.color}30`,
                      }}>
                        {leaveType?.emoji} {leaveType?.label || request.leave_type}
                      </span>
                      <div style={{
                        ...S.statusBadge,
                        background: status.bg,
                        color: status.color,
                      }}>
                        <StatusIcon size={12} />
                        <span>{status.label}</span>
                      </div>
                      {hasDocument && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 9px', borderRadius: '7px',
                          fontSize: '11px', fontWeight: '600',
                          background: 'rgba(59,130,246,0.12)',
                          color: '#3B82F6',
                          border: '1px solid rgba(59,130,246,0.25)',
                        }}>
                          <Paperclip size={10} /> Justificatif joint
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <button
                        className="delete-req-btn"
                        onClick={() => confirmDelete(request)}
                        title="Annuler cette demande"
                        style={S.cancelBtn}
                      >
                        <X size={14} />
                        Annuler
                      </button>
                    )}
                  </div>

                  <div style={S.datesRow}>
                    <div style={S.dateBox}>
                      <span style={S.dateLabel}>DU</span>
                      <span style={S.dateValue}>
                        {new Date(request.start_date + 'T12:00:00Z').toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                        })}
                      </span>
                    </div>
                    <div style={S.daysBadge}>
                      <span style={S.daysNumber}>{days}</span>
                      <span style={S.daysLabel}>jour{days > 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ ...S.dateBox, textAlign: 'right' }}>
                      <span style={S.dateLabel}>AU</span>
                      <span style={S.dateValue}>
                        {new Date(request.end_date + 'T12:00:00Z').toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                        })}
                      </span>
                    </div>
                  </div>

                  {request.reason && (
                    <div style={S.reasonBox}>
                      <FileText size={12} color="#888" />
                      <span style={S.reasonText}>{request.reason}</span>
                    </div>
                  )}

                  {hasDocument && (
                    <button
                      className="doc-view-btn"
                      onClick={() => setViewingDocument(request.document_url)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px',
                        background: 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 10, color: '#3B82F6',
                        fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                        width: '100%', textAlign: 'left',
                      }}
                    >
                      {docType === 'image'
                        ? <FileImage size={15} />
                        : <File size={15} />
                      }
                      <span>Voir le justificatif</span>
                      <Eye size={14} style={{ marginLeft: 'auto' }} />
                    </button>
                  )}

                  {request.review_comment && !isPending && (
                    <div style={{
                      ...S.reviewBox,
                      borderColor: `${status.color}30`,
                      background: status.bg,
                    }}>
                      <span style={{ color: status.color, fontSize: '11px', fontWeight: '700' }}>
                        Réponse de l'administrateur :
                      </span>
                      <p style={S.reviewText}>{request.review_comment}</p>
                    </div>
                  )}

                  {isPending && (
                    <div style={S.pendingInfo}>
                      <Clock size={13} color="#F59E0B" />
                      <span style={{ color: '#F59E0B', fontSize: '12px' }}>
                        En attente de validation par votre administrateur
                      </span>
                    </div>
                  )}

                  <div style={S.cardFooter}>
                    <span style={S.submittedAt}>
                      Soumise le {new Date(request.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showModal && (
          <div style={S.overlay} onClick={() => !submitting && setShowModal(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitleWrap}>
                  <div style={S.modalIcon}>
                    <CalendarDays size={22} color="#10B981" />
                  </div>
                  <div>
                    <h2 style={S.modalTitle}>Nouvelle demande</h2>
                    <span style={S.modalSub}>Demande de congé</span>
                  </div>
                </div>
                <button
                  onClick={() => !submitting && setShowModal(false)}
                  style={S.closeBtn}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={S.modalBody}>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Type de congé</label>
                  <select
                    value={formData.leave_type}
                    onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                    style={S.select}
                    disabled={submitting}
                  >
                    {leaveTypes.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={S.dateRow}>
                  <div style={S.field}>
                    <label style={S.fieldLabel}>Date de début</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      style={S.input}
                      disabled={submitting}
                    />
                  </div>
                  <div style={S.field}>
                    <label style={S.fieldLabel}>Date de fin</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                      min={formData.start_date || new Date().toISOString().split('T')[0]}
                      style={S.input}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {calculateCalendarDuration() > 0 && (
                  <div style={{
                    ...S.durationPreview,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarDays size={16} color="#10B981" />
                      <span>
                        Durée calendaire : <strong style={{ color: '#10B981' }}>{calculateCalendarDuration()}</strong> jour{calculateCalendarDuration() > 1 ? 's' : ''}
                      </span>
                    </div>

                    {calculateWorkingDays() !== calculateCalendarDuration() && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#888',
                        flexWrap: 'wrap',
                      }}>
                        <span style={{
                          background: 'rgba(139,92,246,0.12)',
                          color: '#8B5CF6',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {calculateWorkingDays()} jours ouvrés décomptés
                        </span>
                        <span>(weekends & fériés exclus)</span>
                      </div>
                    )}

                    {holidaysInRange.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        width: '100%',
                        paddingTop: '4px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <span style={{ fontSize: '11px', color: '#666' }}>
                          🎌 Jours fériés de votre entreprise dans cette période :
                        </span>
                        {holidaysInRange.map(h => (
                          <span key={h.id} style={{
                            fontSize: '11px',
                            color: '#8B5CF6',
                            paddingLeft: '8px',
                          }}>
                            • {h.name} ({new Date(h.date + 'T12:00:00Z').toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'UTC',
                            })})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={S.field}>
                  <label style={S.fieldLabel}>
                    Motif
                    <span style={{ color: '#555', fontWeight: '400', textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>(optionnel)</span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Décrivez la raison de votre demande..."
                    style={S.textarea}
                    rows={3}
                    disabled={submitting}
                  />
                </div>

                <UploadZone
                  file={formData.document_file}
                  onFileSelect={(f) => setFormData({ ...formData, document_file: f })}
                  onRemove={() => setFormData({ ...formData, document_file: null })}
                  uploading={uploading}
                />

                {uploading && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 10,
                  }}>
                    <RefreshCw size={14} color="#10B981" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#10B981', fontSize: 13 }}>
                      Upload du justificatif en cours...
                    </span>
                  </div>
                )}
              </div>

              <div style={S.modalFooter}>
                <button
                  onClick={() => !submitting && setShowModal(false)}
                  disabled={submitting}
                  style={S.cancelBtn2}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.start_date || !formData.end_date}
                  style={{
                    ...S.submitBtn,
                    opacity: submitting || !formData.start_date || !formData.end_date ? 0.5 : 1,
                    cursor: submitting || !formData.start_date || !formData.end_date ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>{uploading ? 'Upload...' : 'Envoi...'}</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Envoyer la demande</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && requestToDelete && (
          <div style={S.overlay} onClick={() => !deleting && setShowDeleteModal(false)}>
            <div
              style={{
                background: '#141423',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 24, width: '100%', maxWidth: 420,
                padding: 32, textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                animation: 'slideUp 0.3s ease forwards',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <AlertTriangle size={30} color="#EF4444" />
              </div>

              <h3 style={{ color: '#FFF', fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>
                Annuler cette demande ?
              </h3>

              <div style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, margin: '16px 0', textAlign: 'left',
              }}>
                <p style={{ color: '#FFF', fontSize: 14, fontWeight: 600, margin: '0 0 4px 0' }}>
                  {leaveTypes.find(t => t.value === requestToDelete.leave_type)?.emoji}{' '}
                  {leaveTypes.find(t => t.value === requestToDelete.leave_type)?.label}
                </p>
                <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
                  {new Date(requestToDelete.start_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                  {' → '}
                  {new Date(requestToDelete.end_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                </p>
                {requestToDelete.document_url && (
                  <p style={{ color: '#F59E0B', fontSize: 11, margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Paperclip size={11} /> Le justificatif joint sera aussi supprimé
                  </p>
                )}
              </div>

              <p style={{ color: '#888', fontSize: 13, margin: '0 0 24px 0' }}>
                Votre demande sera définitivement supprimée. Cette action est irréversible.
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setShowDeleteModal(false); setRequestToDelete(null) }}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '13px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#E5E5E5', borderRadius: 12,
                    fontWeight: 600, fontSize: 14,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Garder
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '13px',
                    background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
                    color: '#FFF', border: 'none', borderRadius: 12,
                    fontWeight: 700, fontSize: 14,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: deleting ? 0.7 : 1,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  {deleting ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Annulation...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      Annuler la demande
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewingDocument && (
          <DocumentViewer
            url={viewingDocument}
            onClose={() => setViewingDocument(null)}
          />
        )}
      </div>
    </EmployeeLayout>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const S = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px' },

  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: '12px',
  },
  title: { color: '#FFF', fontSize: '24px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#666', fontSize: '14px', margin: '4px 0 0 0' },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFF', padding: '12px 20px',
    borderRadius: '12px', border: 'none',
    fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', transition: 'all 0.3s ease',
    fontFamily: 'inherit',
  },

  balanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  balanceCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(20,20,35,0.78)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
  },
  balanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  balanceValue: {
    color: '#FFF',
    fontSize: '22px',
    fontWeight: '800',
    lineHeight: 1,
  },
  balanceLabel: {
    color: '#888',
    fontSize: '12px',
    marginTop: 4,
  },
  balanceInfoBox: {
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },

  holidaysPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '18px',
    background: 'rgba(20, 20, 35, 0.72)',
    borderRadius: '18px',
    border: '1px solid rgba(139,92,246,0.16)',
  },
  holidaysPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  holidaysTitle: {
    color: '#FFF',
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
  },
  holidaysSubtitle: {
    color: '#888',
    fontSize: '12px',
    margin: '4px 0 0 0',
  },
  holidaysEmpty: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },
  holidaysList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '10px',
  },
  holidayItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },
  holidayIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(139,92,246,0.12)',
    flexShrink: 0,
    fontSize: 14,
  },
  holidayName: {
    color: '#EDE9FE',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  holidayDate: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  holidayBadge: {
    background: 'rgba(139,92,246,0.14)',
    color: '#8B5CF6',
    border: '1px solid rgba(139,92,246,0.25)',
    padding: '4px 8px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  },

  filterRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  filterBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '9px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', color: '#888',
    fontSize: '13px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  filterBtnActive: {
    background: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: '#10B981',
  },
  filterCount: {
    padding: '2px 7px', borderRadius: '8px',
    fontSize: '11px', fontWeight: '700',
  },

  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '60px' },
  spinner: {
    width: '40px', height: '40px',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#10B981', borderRadius: '50%',
    animation: 'spinSlow 0.8s linear infinite',
  },

  emptyWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px',
    background: 'rgba(20, 20, 35, 0.5)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
  },
  emptyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFF', padding: '10px 20px',
    borderRadius: '10px', border: 'none',
    fontWeight: '600', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  list: { display: 'flex', flexDirection: 'column', gap: '12px' },

  card: {
    background: 'rgba(20, 20, 35, 0.85)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },

  cardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap',
  },
  cardTop: {
    display: 'flex', alignItems: 'center',
    gap: '8px', flexWrap: 'wrap', flex: 1,
  },
  leaveTypeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '5px 12px', borderRadius: '8px',
    fontSize: '12px', fontWeight: '600',
  },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '5px 10px', borderRadius: '8px',
    fontSize: '11px', fontWeight: '700',
  },
  cancelBtn: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 12px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '9px', color: '#EF4444',
    fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease', flexShrink: 0,
  },

  datesRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px', background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px', gap: '8px',
  },
  dateBox: { display: 'flex', flexDirection: 'column', gap: '2px' },
  dateLabel: { color: '#666', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  dateValue: { color: '#E5E5E5', fontSize: '13px', fontWeight: '500' },
  daysBadge: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px', padding: '6px 14px',
  },
  daysNumber: { color: '#F59E0B', fontSize: '18px', fontWeight: '800', lineHeight: '1' },
  daysLabel: { color: '#F59E0B', fontSize: '9px', opacity: 0.8 },

  reasonBox: {
    display: 'flex', gap: '8px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
    borderLeft: '2px solid rgba(245,158,11,0.3)',
  },
  reasonText: { color: '#AAA', fontSize: '12px', lineHeight: '1.5', fontStyle: 'italic' },

  reviewBox: {
    padding: '10px 12px', borderRadius: '10px',
    border: '1px solid', display: 'flex',
    flexDirection: 'column', gap: '4px',
  },
  reviewText: { color: '#CCC', fontSize: '12px', margin: 0, lineHeight: '1.5' },

  pendingInfo: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '10px',
  },

  cardFooter: { paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' },
  submittedAt: { color: '#555', fontSize: '11px' },

  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '16px',
    zIndex: 1000, animation: 'fadeIn 0.3s ease',
  },
  modal: {
    background: '#0F0F19',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    width: '100%', maxWidth: '500px',
    maxHeight: '92vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  modalTitleWrap: { display: 'flex', alignItems: 'center', gap: '14px' },
  modalIcon: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(16,185,129,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: '#FFF', fontSize: '18px', fontWeight: '700', margin: 0 },
  modalSub: { color: '#666', fontSize: '12px', marginTop: '2px', display: 'block' },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '8px',
    color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: {
    padding: '24px', overflow: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldLabel: {
    fontSize: '12px', fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  select: {
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '14px',
    background: 'rgba(255,255,255,0.04)',
    color: '#E5E5E5', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '14px',
    background: 'rgba(255,255,255,0.04)',
    color: '#E5E5E5', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
    outline: 'none',
  },
  dateRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  durationPreview: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px',
    background: 'rgba(16,185,129,0.06)',
    border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '10px', color: '#10B981', fontSize: '14px',
  },
  textarea: {
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '14px',
    background: 'rgba(255,255,255,0.04)',
    color: '#E5E5E5', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
    outline: 'none', resize: 'vertical', minHeight: '80px',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  cancelBtn2: {
    padding: '12px 20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#E5E5E5', borderRadius: '12px',
    fontWeight: '600', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  submitBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFF', border: 'none', borderRadius: '12px',
    fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
}