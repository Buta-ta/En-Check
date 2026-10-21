// ═══════════════════════════════════════════════════════════
// 🌴 PAGE GESTION DES ABSENCES & CONGÉS - V7
// Avec jours fériés intégrés + affichage calendrier corrigé
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { KenteAmberWeaveSvg } from '../components/AfroCulturalSvg'
import AbsencesCalendrier from '../components/AbsencesCalendrier'
import { MOTIFS, STATUTS_ABSENCE, getMotifConfig } from '../constants/motifsAbsence'
import { compterJoursOuvres } from '../services/absencesCalendrier'
import AbsencesDock from '../components/AbsencesDock'
import AbsencesMotifsManager from '../components/AbsencesMotifsManager'
import { MotifsAbsenceProvider } from '../contexts/MotifsAbsenceContext'
import './AbsencesAfroTech.css'
import HolidayService from '../services/holidayService'
import LeaveBalanceService from '../services/leaveBalanceService'
import {
  ArrowLeft,
  Footprints, Plus, Trash2, X, Save, CalendarOff, Building2, User,
  FileText, AlertTriangle, Clock, Search, Edit3, Check, XCircle,
  Download, ChevronLeft, ChevronRight, Calendar,CalendarDays, List, TrendingUp,
  Timer, BarChart3, Filter, Hourglass, RefreshCw, CheckCircle2,
  AlertCircle, Upload, Paperclip, Eye, FileImage, File, ZoomIn,
  ZoomOut, ExternalLink, ShieldCheck, Ban, Inbox, MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════
function calcBusinessDays(startStr, endStr) {
  const start = new Date(startStr)
  const end = new Date(endStr)
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count || 1
}

function countCalendarDays(startStr, endStr) {
  const diff = Math.ceil((new Date(endStr) - new Date(startStr)) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
}

function getTemporalStatus(startStr, endStr) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (now < start) return 'a_venir'
  if (now > end) return 'passee'
  return 'en_cours'
}

function formatDateFr(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
  })
}

function formatDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  })
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

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

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════
// Les motifs et leurs couleurs vivent dans src/constants/motifsAbsence.js :
// la page, le calendrier mensuel et le tiroir partagent la même source.

const LEAVE_TYPES = {
  conge_paye: { label: 'Congé payé', emoji: '🏖️', color: '#10B981', motifId: 'conge' },
  conge_maladie: { label: 'Congé maladie', emoji: '🏥', color: '#F59E0B', motifId: 'maladie' },
  conge_familial: { label: 'Congé familial', emoji: '👨‍👩‍👧', color: '#8B5CF6', motifId: 'autre' },
  conge_sans_solde: { label: 'Congé sans solde', emoji: '📋', color: '#6B7280', motifId: 'autre' },
  permission: { label: 'Permission', emoji: '🎫', color: '#3B82F6', motifId: 'autre' },
  autre: { label: 'Autre', emoji: '📝', color: '#9CA3AF', motifId: 'autre' },
}

const TEMPORAL_CONFIG = {
  en_cours: { label: 'En cours', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: Timer },
  a_venir: { label: 'À venir', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: Clock },
  passee: { label: 'Terminée', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: CheckCircle2 }
}

const STATUS_CONFIG = {
  en_attente: { ...STATUTS_ABSENCE.en_attente, icon: Hourglass },
  approuve: { ...STATUTS_ABSENCE.approuve, icon: CheckCircle2 },
  refuse: { ...STATUTS_ABSENCE.refuse, icon: XCircle }
}

const ITEMS_PER_PAGE = 12
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// ═══════════════════════════════════════════════════════════
// COMPOSANT UPLOAD ZONE
// ═══════════════════════════════════════════════════════════
function UploadZone({ file, existingUrl, onFileSelect, onRemove, uploading }) {
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
    if (!ALLOWED_TYPES.includes(f.type)) { toast.error('Format non supporté. JPG, PNG, WebP ou PDF.'); return }
    if (f.size > MAX_FILE_SIZE) { toast.error('Fichier trop volumineux (max 5 Mo)'); return }
    onFileSelect(f)
  }

  const hasFile = file || existingUrl

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Paperclip size={14} /> Justificatif
        <span style={{ color: '#666', fontWeight: 400, fontSize: 12 }}>(optionnel)</span>
      </label>
      {!hasFile ? (
        <div
          style={{
            border: `2px dashed ${dragActive ? '#F59E0B' : 'rgba(255,255,255,.15)'}`,
            borderRadius: 12,
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            background: dragActive ? 'rgba(245,158,11,.08)' : 'rgba(255,255,255,.02)',
            transition: 'all .2s ease'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleChange} style={{ display: 'none' }} />
          <Upload size={28} color={dragActive ? '#F59E0B' : '#666'} />
          <p style={{ color: '#ccc', fontSize: 13, margin: 0, textAlign: 'center' }}>
            <span style={{ color: '#F59E0B', fontWeight: 600 }}>Cliquez</span> ou glissez un fichier
          </p>
          <p style={{ color: '#666', fontSize: 11, margin: 0 }}>PDF, JPG, PNG, WebP · Max 5 Mo</p>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {file
              ? (file.type.startsWith('image/') ? <FileImage size={24} color="#10B981" /> : <File size={24} color="#3B82F6" />)
              : (getFileType(existingUrl) === 'image' ? <FileImage size={24} color="#10B981" /> : <File size={24} color="#3B82F6" />)
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file ? file.name : getFileName(existingUrl)}
            </p>
            <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 11, margin: '2px 0 0 0' }}>
              {file ? formatFileSize(file.size) : 'Document existant'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {existingUrl && !file && (
              <button type="button" onClick={() => window.open(existingUrl, '_blank')}
                style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', cursor: 'pointer' }}>
                <Eye size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', cursor: 'pointer' }}
              disabled={uploading}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT VISUALISEUR DE DOCUMENT
// ═══════════════════════════════════════════════════════════
function DocumentViewer({ url, onClose, employeeName, absenceInfo }) {
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const fileType = getFileType(url)
  const fileName = getFileName(url)

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#1D1713', borderRadius: 20, width: '100%', maxWidth: 900, maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 25px 80px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Paperclip size={18} color="#F59E0B" />
            <div>
              <h3 style={{ color: '#FFF', fontSize: 16, fontWeight: 600, margin: 0 }}>Justificatif</h3>
              {employeeName && <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 12, margin: '2px 0 0 0' }}>{employeeName}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {fileType === 'image' && (
              <>
                <button onClick={() => setZoom(z => Math.max(z - .25, .5))} style={viewerBtnStyle}><ZoomOut size={18} /></button>
                <span style={{ color: 'rgba(245,242,235,0.55)', fontSize: 12, minWidth: 45, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(z + .25, 3))} style={viewerBtnStyle}><ZoomIn size={18} /></button>
              </>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" style={viewerBtnStyle}><ExternalLink size={18} /></a>
            <a href={url} download style={viewerBtnStyle}><Download size={18} /></a>
            <button onClick={onClose} style={{ ...viewerBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,.25)', background: 'rgba(239,68,68,.1)' }}><X size={20} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,.2)', minHeight: 300 }}>
          {loading && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(245,242,235,0.55)' }}><RefreshCw size={32} color="#F59E0B" style={{ animation: 'spin 1s linear infinite' }} /><p>Chargement...</p></div>}
          {fileType === 'image' && <img src={url} alt="Justificatif" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, transform: `scale(${zoom})`, transition: 'transform .2s ease', display: loading ? 'none' : 'block' }} onLoad={() => setLoading(false)} />}
          {fileType === 'pdf' && <iframe src={url} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8, display: loading ? 'none' : 'block' }} title="Document PDF" onLoad={() => setLoading(false)} />}
          {fileType === 'other' && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: 'rgba(245,242,235,0.55)', textAlign: 'center' }}><File size={48} color="#666" /><p>Aperçu non disponible</p><a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F59E0B', textDecoration: 'none', padding: '10px 20px', background: 'rgba(245,158,11,.1)', borderRadius: 8, fontWeight: 500 }}><Download size={16} /> Télécharger</a></div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#F5F2EB', fontSize: 12, fontWeight: 500 }}>📄 {fileName}</span>
            {absenceInfo && <span style={{ color: 'rgba(245,242,235,0.55)', fontSize: 11 }}>{absenceInfo}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

const viewerBtnStyle = {
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8,
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#F5F2EB',
  cursor: 'pointer',
  textDecoration: 'none',
  flexShrink: 0,
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT CARTE ABSENCE
// ═══════════════════════════════════════════════════════════
function AbsenceCard({ absence, admin, onEdit, onDelete, onStatusChange, onViewDocument, onManageConflict, conflict, index, holidaySet, holidayMapByDate }) {
  const config = getMotifConfig(absence.reason)

  const nbJoursOuvres = HolidayService.countWorkingDays(
    absence.start_date,
    absence.end_date,
    holidaySet || new Set(),
    true
  )
  const nbJoursCalendaires = countCalendarDays(absence.start_date, absence.end_date)
  const feriesInPeriod = holidaySet
    ? [...holidaySet].filter(d => d >= absence.start_date && d <= absence.end_date).length
    : 0

  const temporal = getTemporalStatus(absence.start_date, absence.end_date)
  const tc = TEMPORAL_CONFIG[temporal]
  const absStatus = absence.status || 'approuve'
  const sc = STATUS_CONFIG[absStatus] || STATUS_CONFIG.approuve
  const TemporalIcon = tc.icon
  const StatusIcon = sc.icon
  const hasDocument = !!absence.document_url
  const docType = getFileType(absence.document_url)
  const canManageConflict = ['admin', 'manager', 'super_admin'].includes(admin?.role)
  const hasConflict = !!conflict
  const conflictPending = conflict?.status === 'pending'

  const holidayNamesInRange = holidaySet
    ? [...holidaySet]
        .filter(d => d >= absence.start_date && d <= absence.end_date)
        .map(d => holidayMapByDate?.get(d)?.name)
        .filter(Boolean)
    : []

  return (
    <div className="afro-card absence-card-hover" style={{ ...CS.card, animationDelay: `${index * 0.03}s`, ...(hasConflict && conflictPending ? { borderColor: 'rgba(249,115,22,.25)' } : {}) }}>
      <div style={CS.topBadges}>
        <div style={{ ...CS.badge, background: tc.bg, color: tc.color, border: `1px solid ${tc.color}30` }}>
          <TemporalIcon size={11} /> {tc.label}
        </div>
        <div style={{ ...CS.badge, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}30` }}>
          <StatusIcon size={11} /> {sc.label}
        </div>
        {hasDocument && (
          <div style={{ ...CS.badge, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
            <Paperclip size={11} /> Doc
          </div>
        )}
        {feriesInPeriod > 0 && (
          <div style={{ ...CS.badge, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.25)' }}>
            🎌 {feriesInPeriod} férié{feriesInPeriod > 1 ? 's' : ''}
          </div>
        )}
        {hasConflict && conflictPending && (
          <div style={{ ...CS.badge, background: 'rgba(249,115,22,.12)', color: '#F97316', border: '1px solid rgba(249,115,22,.3)' }}>
            <AlertTriangle size={11} /> Conflit
          </div>
        )}
        {hasConflict && !conflictPending && (
          <div style={{ ...CS.badge, background: 'rgba(107,114,128,.12)', color: '#9CA3AF', border: '1px solid rgba(107,114,128,.2)' }}>
            <CheckCircle2 size={11} /> Conflit traité
          </div>
        )}
      </div>

      <div style={CS.cardHeader}>
        <div style={CS.employeeInfo}>
          <div style={CS.avatar}>
            {absence.employees?.photo_url
              ? <img src={absence.employees.photo_url} alt="" style={CS.avatarImg} />
              : <User size={18} color="#F59E0B" />}
          </div>
          <div style={CS.empDetails}>
            <h4 style={CS.empName}>{absence.employees?.first_name} {absence.employees?.last_name}</h4>
            <span style={CS.empMatricule}>{absence.employees?.matricule}</span>
          </div>
        </div>
        <div style={{ ...CS.reasonBadge, background: config.bg, color: config.color, border: `1px solid ${config.color}40` }}>
          <span style={CS.reasonEmoji}>{config.emoji}</span>
          <span style={CS.reasonLabel}>{config.label}</span>
        </div>
      </div>

      <div style={CS.datesRow}>
        <div style={CS.dateBox}>
          <span style={CS.dateLabel}>DÉBUT</span>
          <span style={CS.dateValue}>{formatDateFr(absence.start_date)}</span>
        </div>
        <div style={CS.daysBadge}>
          <span style={CS.daysNumber}>{nbJoursOuvres}</span>
          <span style={CS.daysLabel}>ouvré{nbJoursOuvres > 1 ? 's' : ''}</span>
          <span style={{ fontSize: '9px', color: 'rgba(245,242,235,0.55)', marginTop: '2px' }}>
            ({nbJoursCalendaires} cal.)
          </span>
        </div>
        <div style={{ ...CS.dateBox, textAlign: 'right' }}>
          <span style={CS.dateLabel}>FIN</span>
          <span style={CS.dateValue}>{formatDateFr(absence.end_date)}</span>
        </div>
      </div>

      {holidayNamesInRange.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '10px 12px',
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: 10,
        }}>
          <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700 }}>Jours fériés inclus</span>
          {holidayNamesInRange.slice(0, 3).map((name, idx) => (
            <span key={idx} style={{ color: '#C4B5FD', fontSize: 11 }}>• {name}</span>
          ))}
          {holidayNamesInRange.length > 3 && (
            <span style={{ color: '#8B5CF6', fontSize: 11 }}>+{holidayNamesInRange.length - 3} autres</span>
          )}
        </div>
      )}

      {hasConflict && conflictPending && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.18)', borderRadius: 12 }}>
          <AlertTriangle size={16} color="#F97316" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ color: '#F97316', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' }}>Conflit RH détecté</p>
            <p style={{ color: '#BFA48A', fontSize: 12, margin: 0, lineHeight: '1.4' }}>
              Un pointage a été enregistré pendant cette absence. Action requise.
            </p>
          </div>
        </div>
      )}

      {hasConflict && !conflictPending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(107,114,128,.06)', border: '1px solid rgba(107,114,128,.15)', borderRadius: 12 }}>
          <CheckCircle2 size={16} color="#9CA3AF" />
          <p style={{ color: '#9CA3AF', fontSize: 12, margin: 0 }}>
            Conflit traité ({conflict.status === 'resolved'
              ? conflict.resolution_action === 'kept_absence' ? 'absence maintenue'
                : conflict.resolution_action === 'cancelled_absence' ? 'absence annulée'
                : 'résolu'
              : 'ignoré'})
          </p>
        </div>
      )}

      {absence.notes && (
        <div style={CS.notesBox}>
          <FileText size={13} color="#888" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={CS.notesText}>{absence.notes}</span>
        </div>
      )}

      {hasDocument && (
        <button onClick={() => onViewDocument(absence)} style={CS.docButton}>
          {docType === 'image' ? <FileImage size={16} /> : <File size={16} />}
          <span>Voir le justificatif</span>
          <Eye size={14} style={{ marginLeft: 'auto' }} />
        </button>
      )}

      <div style={CS.cardFooter}>
        <div style={CS.footerLeft}>
          {admin?.role === 'super_admin' && absence.enterprises?.name && (
            <span style={CS.enterpriseTag}>🏢 {absence.enterprises.name}</span>
          )}
        </div>
        <div style={CS.footerActions}>
          {hasConflict && conflictPending && canManageConflict && (
            <button onClick={() => onManageConflict(absence, conflict)} style={CS.conflictBtn} title="Gérer conflit">
              <ShieldCheck size={14} />
            </button>
          )}
          {(admin?.role === 'super_admin' || admin?.role === 'admin' || admin?.role === 'manager') && absStatus === 'en_attente' && (
            <>
              <button onClick={() => onStatusChange(absence.id, 'approuve')} style={CS.approveBtn} title="Approuver"><Check size={14} /></button>
              <button onClick={() => onStatusChange(absence.id, 'refuse')} style={CS.refuseBtn} title="Refuser"><X size={14} /></button>
            </>
          )}
          <button onClick={() => onEdit(absence)} style={CS.editBtn} title="Modifier"><Edit3 size={14} /></button>
          <button onClick={() => onDelete(absence.id)} style={CS.deleteBtn} title="Supprimer"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function Absences() {
  const [admin, setAdmin] = useState(null)
  const [accessChecked, setAccessChecked] = useState(false)
  const [absences, setAbsences] = useState([])
  const [employes, setEmployes] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')

  const [holidaysByEnterprise, setHolidaysByEnterprise] = useState({})
  const [holidayMapsByEnterprise, setHolidayMapsByEnterprise] = useState({})

  const [activeTab, setActiveTab] = useState('absences')

    const [leaveConfig, setLeaveConfig] = useState({
    leave_days_per_month: 1.75,
    annual_leave_cap: 30,
    leave_carry_over: false,
    leave_reference_date: 'hire_date',
  })
  const [savingLeaveConfig, setSavingLeaveConfig] = useState(false)
  const [recalculatingBalances, setRecalculatingBalances] = useState(false)
  const [leaveBalancesPreview, setLeaveBalancesPreview] = useState([])
  const [loadingLeaveBalancesPreview, setLoadingLeaveBalancesPreview] = useState(false)

  const [leaveRequests, setLeaveRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestFilter, setRequestFilter] = useState('all')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewAction, setReviewAction] = useState(null)
  const [submittingReview, setSubmittingReview] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterMotif, setFilterMotif] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTemporal, setFilterTemporal] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterConflict, setFilterConflict] = useState('all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState('date_desc')

  // 'planning' = calendrier mensuel par employé (vue par défaut)
  const [viewMode, setViewMode] = useState('planning')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null)

  const [currentPage, setCurrentPage] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [showEmployeeHistory, setShowEmployeeHistory] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState(null)
  const [viewingDocument, setViewingDocument] = useState(null)

  const [showConflictModal, setShowConflictModal] = useState(false)
  const [selectedConflictData, setSelectedConflictData] = useState(null)
  const [conflictNote, setConflictNote] = useState('')
  const [resolvingConflict, setResolvingConflict] = useState(false)

  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false)
  const [requestToDelete, setRequestToDelete] = useState(null)

  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    employee_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: 'conge',
    status: 'approuve',
    notes: '',
    document_file: null,
    existing_document_url: null,
    remove_document: false,
    count_holidays_as_leave: false,
  })

  useEffect(() => {
    document.body.style.backgroundColor = '#15110E'
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsed = JSON.parse(adminData)
    setAdmin(parsed)
    checkAccess(parsed)
  }, [navigate])

  const checkAccess = async (parsedAdmin) => {
    if (parsedAdmin.role === 'super_admin') {
      setAccessChecked(true)
      loadEntreprises()
      return
    }
    const enterpriseId = parsedAdmin.selectedEnterprise?.id || parsedAdmin.enterprise_id
    if (!enterpriseId) { toast.error('Accès non autorisé'); navigate('/dashboard'); return }
    try {
      const { data: entreprise } = await supabase.from('enterprises').select('module_conges').eq('id', enterpriseId).single()
      if (!entreprise?.module_conges) { toast.error('Le module Absences & Congés n\'est pas activé pour votre entreprise'); navigate('/dashboard'); return }
      setSelectedEntrepriseId(enterpriseId)
      setAccessChecked(true)
    } catch {
      toast.error('Erreur de vérification des accès')
      navigate('/dashboard')
    }
  }
  useEffect(() => {
    if (admin && accessChecked) {
      loadData()
      loadLeaveRequests()
      loadLeaveConfig()
      loadLeaveBalancesPreview()
    }
  }, [admin, accessChecked, selectedEntrepriseId])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, filterMotif, filterStatus, filterTemporal, filterPeriod, filterConflict, sortBy])

  const getHolidaySet = useCallback((enterpriseId) => holidaysByEnterprise[enterpriseId] || new Set(), [holidaysByEnterprise])
  const getHolidayMap = useCallback((enterpriseId) => holidayMapsByEnterprise[enterpriseId] || new Map(), [holidayMapsByEnterprise])

  // ─── CHARGEMENT ───────────────────────────────────────
  const loadEntreprises = async () => {
    const { data } = await supabase.from('enterprises').select('*').eq('is_active', true).order('name')
    setEntreprises(data || [])
  }

  const loadData = async () => {
    setLoading(true)
    try {
      let targetId = selectedEntrepriseId
      if (admin.role !== 'super_admin') targetId = admin.selectedEnterprise?.id || admin.enterprise_id

      let empQuery = supabase
        .from('employees')
        .select('id, first_name, last_name, matricule, enterprise_id, photo_url')
        .eq('is_active', true)
        .order('first_name')
      if (targetId !== 'all') empQuery = empQuery.eq('enterprise_id', targetId)
      const { data: empData } = await empQuery
      setEmployes(empData || [])

      let absQuery = supabase
        .from('absences')
        .select(`
          id, employee_id, enterprise_id, start_date, end_date, reason, status, notes, document_url, created_at,
          count_holidays_as_leave,
          employees (id, first_name, last_name, matricule, photo_url),
          enterprises (name)
        `)
        .order('start_date', { ascending: false })
      if (targetId !== 'all') absQuery = absQuery.eq('enterprise_id', targetId)
      const { data: absData, error } = await absQuery
      if (error) throw error
      setAbsences(absData || [])

      let conflictQuery = supabase.from('attendance_conflicts').select('*').order('created_at', { ascending: false })
      if (targetId !== 'all') conflictQuery = conflictQuery.eq('enterprise_id', targetId)
      const { data: conflictsData } = await conflictQuery
      setConflicts(conflictsData || [])

      const enterpriseIdsToLoad = targetId === 'all'
        ? [...new Set((empData || []).map(e => e.enterprise_id).filter(Boolean))]
        : [targetId]

      const holidaySets = {}
      const holidayMaps = {}
      await Promise.all(
        enterpriseIdsToLoad.map(async (entId) => {
          const start = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-01`
          const end = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth())).padStart(2, '0')}`
          const holidays = await HolidayService.getHolidaysForRange(entId, start, end)
          const nonWorked = holidays.filter(h => !h.is_worked)
          holidaySets[entId] = HolidayService.buildHolidaySet(nonWorked)
          holidayMaps[entId] = HolidayService.buildHolidayMap(nonWorked)
        })
      )
      setHolidaysByEnterprise(holidaySets)
      setHolidayMapsByEnterprise(holidayMaps)
    } catch (error) {
      console.error('Erreur chargement:', error)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }

  const loadLeaveRequests = async () => {
    setLoadingRequests(true)
    try {
      let targetId = selectedEntrepriseId
      if (admin?.role !== 'super_admin') targetId = admin?.selectedEnterprise?.id || admin?.enterprise_id

      let query = supabase.from('leave_requests').select(`
        *,
        employees (id, first_name, last_name, matricule, photo_url, department, position),
        enterprises (name)
      `).order('created_at', { ascending: false })

      if (targetId && targetId !== 'all') query = query.eq('enterprise_id', targetId)
      const { data, error } = await query
      if (error) throw error
      setLeaveRequests(data || [])
    } catch (err) {
      console.error('Erreur chargement demandes:', err)
      toast.error('Erreur lors du chargement des demandes')
    }
    setLoadingRequests(false)
  }



    const loadLeaveConfig = async () => {
    try {
      let targetId = selectedEntrepriseId
      if (admin?.role !== 'super_admin') {
        targetId = admin?.selectedEnterprise?.id || admin?.enterprise_id
      }

      if (!targetId || targetId === 'all') return

      const { data, error } = await supabase
        .from('payroll_settings')
        .select('leave_days_per_month, annual_leave_cap, leave_carry_over, leave_reference_date')
        .eq('enterprise_id', targetId)
        .maybeSingle()

      if (error) throw error

      setLeaveConfig({
        leave_days_per_month: parseFloat(data?.leave_days_per_month) || 1.75,
        annual_leave_cap: parseInt(data?.annual_leave_cap) || 30,
        leave_carry_over: !!data?.leave_carry_over,
        leave_reference_date: data?.leave_reference_date || 'hire_date',
      })
    } catch (err) {
      console.error('Erreur chargement config congés:', err)
      toast.error('Erreur lors du chargement de la configuration des congés')
    }
  }

  const loadLeaveBalancesPreview = async () => {
    try {
      let targetId = selectedEntrepriseId
      if (admin?.role !== 'super_admin') {
        targetId = admin?.selectedEnterprise?.id || admin?.enterprise_id
      }

      if (!targetId || targetId === 'all') {
        setLeaveBalancesPreview([])
        return
      }

      setLoadingLeaveBalancesPreview(true)

      const year = new Date().getFullYear()
      const balances = await LeaveBalanceService.getEnterpriseBalances(targetId, year)
      setLeaveBalancesPreview(balances || [])
    } catch (err) {
      console.error('Erreur chargement aperçu soldes congés:', err)
      toast.error('Erreur lors du chargement des soldes de congés')
    }
    setLoadingLeaveBalancesPreview(false)
  }


    const handleSaveLeaveConfig = async () => {
    try {
      let targetId = selectedEntrepriseId
      if (admin?.role !== 'super_admin') {
        targetId = admin?.selectedEnterprise?.id || admin?.enterprise_id
      }

      if (!targetId || targetId === 'all') {
        toast.error('Sélectionnez une entreprise')
        return
      }

      setSavingLeaveConfig(true)

      const payload = {
        enterprise_id: targetId,
        leave_days_per_month: parseFloat(leaveConfig.leave_days_per_month) || 1.75,
        annual_leave_cap: parseInt(leaveConfig.annual_leave_cap) || 30,
        leave_carry_over: !!leaveConfig.leave_carry_over,
        leave_reference_date: leaveConfig.leave_reference_date || 'hire_date',
      }

      const { error } = await supabase
        .from('payroll_settings')
        .upsert(payload, { onConflict: 'enterprise_id' })

      if (error) throw error

      toast.success('Configuration des congés enregistrée')
      await loadLeaveConfig()
    } catch (err) {
      console.error('Erreur sauvegarde config congés:', err)
      toast.error('Erreur lors de la sauvegarde')
    }
    setSavingLeaveConfig(false)
  }

  const handleRecalculateLeaveBalances = async () => {
    try {
      let targetId = selectedEntrepriseId
      if (admin?.role !== 'super_admin') {
        targetId = admin?.selectedEnterprise?.id || admin?.enterprise_id
      }

      if (!targetId || targetId === 'all') {
        toast.error('Sélectionnez une entreprise')
        return
      }

      setRecalculatingBalances(true)

      const year = new Date().getFullYear()
      const result = await LeaveBalanceService.recalculateAllBalances(targetId, year)

      toast.success(`Recalcul terminé : ${result.success}/${result.total} employé(s) mis à jour`)
      await loadLeaveBalancesPreview()
    } catch (err) {
      console.error('Erreur recalcul congés:', err)
      toast.error('Erreur lors du recalcul des soldes')
    }
    setRecalculatingBalances(false)
  }

  const uploadDocument = async (file, folder = 'absences') => {
    const ext = file.name.split('.').pop().toLowerCase()
    const randomId = Math.random().toString(36).substring(7)
    const fileName = `${folder}/${Date.now()}_${randomId}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(fileName, file, { contentType: file.type })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName)
    return urlData.publicUrl
  }

  const deleteDocument = async (url) => {
    if (!url) return
    try {
      const parts = url.split('/documents/')
      if (parts.length > 1) {
        const filePath = parts[1].split('?')[0]
        await supabase.storage.from('documents').remove([filePath])
      }
    } catch (error) {
      console.error('Erreur suppression document:', error)
    }
  }

  const openReviewModal = (request, action) => {
    setSelectedRequest(request)
    setReviewAction(action)
    setReviewComment('')
    setShowReviewModal(true)
  }

  const handleReviewRequest = async () => {
    if (!selectedRequest || !reviewAction) return
    setSubmittingReview(true)
    try {
      const { error: updateError } = await supabase.from('leave_requests').update({
        status: reviewAction,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        review_comment: reviewComment || null,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedRequest.id)
      if (updateError) throw updateError

      if (reviewAction === 'approuve') {
        const leaveTypeConfig = LEAVE_TYPES[selectedRequest.leave_type] || LEAVE_TYPES.autre
        const hSet = getHolidaySet(selectedRequest.enterprise_id)
        const feriesInRange = [...hSet].filter(d => d >= selectedRequest.start_date && d <= selectedRequest.end_date)
        const notesBase = selectedRequest.reason ? `[Demande employé] ${selectedRequest.reason}` : '[Approuvé via espace employé]'
        const notes =
          feriesInRange.length > 0
            ? `${notesBase}\n[Jours fériés exclus automatiquement: ${feriesInRange.length}]`
            : notesBase

        const { error: absError } = await supabase.from('absences').insert({
          employee_id: selectedRequest.employee_id,
          enterprise_id: selectedRequest.enterprise_id,
          start_date: selectedRequest.start_date,
          end_date: selectedRequest.end_date,
          reason: leaveTypeConfig.motifId,
          status: 'approuve',
          notes,
          document_url: selectedRequest.document_url || null,
          created_by: admin.id,
          count_holidays_as_leave: false,
        })
        if (absError) throw absError
        toast.success('Demande approuvée et absence créée !')
      } else {
        toast.success('Demande refusée')
      }

      setShowReviewModal(false)
      setSelectedRequest(null)
      setReviewComment('')
      setReviewAction(null)
      await Promise.all([loadLeaveRequests(), loadData()])
    } catch (err) {
      console.error('Erreur review:', err)
      toast.error('Erreur lors du traitement')
    }
    setSubmittingReview(false)
  }

  const handleDeleteRequest = async (request) => {
    try {
      if (request.status === 'approuve') {
        const { data: linkedAbsence } = await supabase
          .from('absences')
          .select('id, document_url')
          .eq('employee_id', request.employee_id)
          .eq('start_date', request.start_date)
          .eq('end_date', request.end_date)
          .maybeSingle()
        if (linkedAbsence) {
          if (linkedAbsence.document_url) await deleteDocument(linkedAbsence.document_url)
          await supabase.from('absences').delete().eq('id', linkedAbsence.id)
        }
      }
      if (request.document_url) await deleteDocument(request.document_url)
      const { error } = await supabase.from('leave_requests').delete().eq('id', request.id)
      if (error) throw error
      toast.success('Demande supprimée')
      loadLeaveRequests()
      loadData()
    } catch (err) {
      console.error('Erreur suppression demande:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const confirmDeleteRequest = (request) => {
    setRequestToDelete(request)
    setShowDeleteRequestModal(true)
  }

  const executeDeleteRequest = async () => {
    if (!requestToDelete) return
    await handleDeleteRequest(requestToDelete)
    setShowDeleteRequestModal(false)
    setRequestToDelete(null)
  }

  const getConflictForAbsence = (absenceId) => conflicts.find(c => c.absence_id === absenceId) || null

  // Conflits de pointage indexés par absence (pour le calendrier)
  const conflitParAbsence = useMemo(() => {
    const map = {}
    conflicts.forEach(c => { if (c.absence_id) map[c.absence_id] = c })
    return map
  }, [conflicts])

  // Jours de congé déjà pris dans l'année affichée, par employé.
  // Un congé refusé ne consomme rien ; les fériés suivent la règle de l'absence.
  const joursPrisParEmploye = useMemo(() => {
    const annee = calendarDate.getFullYear()
    const debutAnnee = `${annee}-01-01`
    const finAnnee = `${annee}-12-31`
    const map = {}
    absences.forEach(a => {
      if ((a.reason || 'autre') !== 'conge') return
      if (a.status === 'refuse') return
      if (!a.start_date || !a.end_date) return
      if (a.end_date < debutAnnee || a.start_date > finAnnee) return
      const debut = a.start_date < debutAnnee ? debutAnnee : a.start_date
      const fin = a.end_date > finAnnee ? finAnnee : a.end_date
      map[a.employee_id] = (map[a.employee_id] || 0)
        + compterJoursOuvres(debut, fin, getHolidaySet(a.enterprise_id), a.count_holidays_as_leave)
    })
    return map
  }, [absences, calendarDate, getHolidaySet])

  const openConflictModal = (absence, conflict) => {
    setSelectedConflictData({ absence, conflict })
    setConflictNote('')
    setShowConflictModal(true)
  }

  const resolveConflict = async (action) => {
    if (!selectedConflictData?.conflict) return
    setResolvingConflict(true)
    try {
      const conflictId = selectedConflictData.conflict.id
      const absenceId = selectedConflictData.absence.id
      if (action === 'kept_absence') {
        const { error } = await supabase.from('attendance_conflicts').update({
          status: 'resolved',
          resolution_action: 'kept_absence',
          notes: conflictNote || 'Absence maintenue malgré le pointage',
          resolved_by: admin.id,
          resolved_at: new Date().toISOString()
        }).eq('id', conflictId)
        if (error) throw error
        toast.success('Conflit résolu : absence maintenue')
      } else if (action === 'cancelled_absence') {
        const { error: delError } = await supabase.from('absences').delete().eq('id', absenceId)
        if (delError) throw delError
        const { error } = await supabase.from('attendance_conflicts').update({
          status: 'resolved',
          resolution_action: 'cancelled_absence',
          notes: conflictNote || 'Absence annulée suite au pointage',
          resolved_by: admin.id,
          resolved_at: new Date().toISOString()
        }).eq('id', conflictId)
        if (error) throw error
        toast.success('Conflit résolu : absence annulée')
      } else if (action === 'ignored_conflict') {
        const { error } = await supabase.from('attendance_conflicts').update({
          status: 'ignored',
          resolution_action: 'ignored_conflict',
          notes: conflictNote || 'Conflit ignoré',
          resolved_by: admin.id,
          resolved_at: new Date().toISOString()
        }).eq('id', conflictId)
        if (error) throw error
        toast.success('Conflit ignoré')
      }
      setShowConflictModal(false)
      setSelectedConflictData(null)
      setConflictNote('')
      loadData()
    } catch (error) {
      console.error('Erreur résolution:', error)
      toast.error('Erreur lors de la résolution du conflit')
    }
    setResolvingConflict(false)
  }

  const filteredAbsences = useMemo(() => {
    let result = [...absences]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a =>
        `${a.employees?.first_name} ${a.employees?.last_name}`.toLowerCase().includes(q) ||
        a.employees?.matricule?.toLowerCase().includes(q)
      )
    }
    if (filterMotif !== 'all') result = result.filter(a => a.reason === filterMotif)
    if (filterStatus !== 'all') result = result.filter(a => (a.status || 'approuve') === filterStatus)
    if (filterTemporal !== 'all') result = result.filter(a => getTemporalStatus(a.start_date, a.end_date) === filterTemporal)
    if (filterConflict !== 'all') {
      result = result.filter(a => {
        const c = getConflictForAbsence(a.id)
        if (filterConflict === 'with_conflict') return !!c && c.status === 'pending'
        if (filterConflict === 'no_conflict') return !c || c.status !== 'pending'
        return true
      })
    }
    if (filterPeriod !== 'all') {
      const now = new Date()
      let from, to
      switch (filterPeriod) {
        case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0); break
        case 'last_month': from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); break
        case 'this_year': from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 11, 31); break
        case 'custom':
          if (customDateFrom) from = new Date(customDateFrom)
          if (customDateTo) to = new Date(customDateTo)
          break
      }
      if (from || to) {
        result = result.filter(a => {
          const s = new Date(a.start_date), e = new Date(a.end_date)
          if (from && to) return e >= from && s <= to
          if (from) return e >= from
          if (to) return s <= to
          return true
        })
      }
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return new Date(a.start_date) - new Date(b.start_date)
        case 'date_desc': return new Date(b.start_date) - new Date(a.start_date)
        case 'name_asc': return `${a.employees?.first_name}`.localeCompare(`${b.employees?.first_name}`)
        case 'name_desc': return `${b.employees?.first_name}`.localeCompare(`${a.employees?.first_name}`)
        case 'duration_desc': {
          const aDays = HolidayService.countWorkingDays(a.start_date, a.end_date, getHolidaySet(a.enterprise_id), !a.count_holidays_as_leave)
          const bDays = HolidayService.countWorkingDays(b.start_date, b.end_date, getHolidaySet(b.enterprise_id), !b.count_holidays_as_leave)
          return bDays - aDays
        }
        default: return 0
      }
    })
    return result
  }, [absences, searchQuery, filterMotif, filterStatus, filterTemporal, filterPeriod, filterConflict, customDateFrom, customDateTo, sortBy, conflicts, getHolidaySet])

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'all') return leaveRequests
    return leaveRequests.filter(r => r.status === requestFilter)
  }, [leaveRequests, requestFilter])

  const pendingRequestsCount = leaveRequests.filter(r => r.status === 'en_attente').length
  const totalPages = Math.ceil(filteredAbsences.length / ITEMS_PER_PAGE)
  const paginatedAbsences = filteredAbsences.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const stats = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const cm = now.getMonth(), cy = now.getFullYear()
    const enCours = absences.filter(a => getTemporalStatus(a.start_date, a.end_date) === 'en_cours').length
    const ceMois = absences.filter(a => {
      const s = new Date(a.start_date + 'T12:00:00Z')
      return s.getUTCMonth() === cm && s.getUTCFullYear() === cy
    }).length
    const joursMois = absences.filter(a => {
      const s = new Date(a.start_date + 'T12:00:00Z')
      return s.getUTCMonth() === cm && s.getUTCFullYear() === cy
    }).reduce((sum, a) => {
      if (a.count_holidays_as_leave) return sum + countCalendarDays(a.start_date, a.end_date)
      return sum + HolidayService.countWorkingDays(a.start_date, a.end_date, getHolidaySet(a.enterprise_id), true)
    }, 0)

    const enAttente = absences.filter(a => (a.status || 'approuve') === 'en_attente').length
    const conflitsPending = conflicts.filter(c => c.status === 'pending').length
    return { enCours, ceMois, joursMois, enAttente, conflitsPending }
  }, [absences, conflicts, getHolidaySet])

  const checkOverlap = useCallback((empId, startDate, endDate, excludeId = null) => {
    if (!empId || !startDate || !endDate) return null
    const s = new Date(startDate), e = new Date(endDate)
    return absences.find(a => {
      if (a.employee_id !== empId) return false
      if (excludeId && a.id === excludeId) return false
      return s <= new Date(a.end_date) && e >= new Date(a.start_date)
    }) || null
  }, [absences])

  useEffect(() => {
    if (showModal) setOverlapWarning(checkOverlap(formData.employee_id, formData.start_date, formData.end_date, editingAbsence?.id))
  }, [formData.employee_id, formData.start_date, formData.end_date, showModal, checkOverlap, editingAbsence])

  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = new Date(year, month, 1).getDay()
    const adj = firstDay === 0 ? 6 : firstDay - 1
    const days = []
    for (let i = 0; i < adj; i++) days.push(null)

    let currentHolidaySet = new Set()
    let currentHolidayMap = new Map()
    if (admin?.role === 'super_admin') {
      if (selectedEntrepriseId !== 'all') {
        currentHolidaySet = getHolidaySet(selectedEntrepriseId)
        currentHolidayMap = getHolidayMap(selectedEntrepriseId)
      }
    } else {
      const entId = admin?.selectedEnterprise?.id || admin?.enterprise_id
      currentHolidaySet = getHolidaySet(entId)
      currentHolidayMap = getHolidayMap(entId)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

      const dayAbs = absences.filter(a => {
        if (admin?.role === 'super_admin' && selectedEntrepriseId !== 'all' && a.enterprise_id !== selectedEntrepriseId) return false
        return dateStr >= a.start_date && dateStr <= a.end_date
      })

      const isHoliday = currentHolidaySet.has(dateStr)
      const holiday = currentHolidayMap.get(dateStr) || null

      days.push({
        day: d,
        date: dateStr,
        absences: dayAbs,
        isHoliday,
        holiday,
      })
    }
    return days
  }, [calendarDate, absences, admin, selectedEntrepriseId, getHolidaySet, getHolidayMap])

  // prefill vient du dock : { employee_id, start_date, end_date, reason }
  const handleAdd = (prefill = null) => {
    const aujourdhui = new Date().toISOString().split('T')[0]
    setEditingAbsence(null)
    setFormData({
      employee_id: prefill?.employee_id ?? (employes.length > 0 ? employes[0].id : ''),
      start_date: prefill?.start_date ?? aujourdhui,
      end_date: prefill?.end_date ?? aujourdhui,
      reason: prefill?.reason ?? 'conge',
      status: 'approuve',
      notes: '',
      document_file: null,
      existing_document_url: null,
      remove_document: false,
      count_holidays_as_leave: false,
    })
    setOverlapWarning(null)
    setShowModal(true)
  }

  const handleEdit = (abs) => {
    setEditingAbsence(abs)
    setFormData({
      employee_id: abs.employee_id,
      start_date: abs.start_date,
      end_date: abs.end_date,
      reason: abs.reason,
      status: abs.status || 'approuve',
      notes: abs.notes || '',
      document_file: null,
      existing_document_url: abs.document_url || null,
      remove_document: false,
      count_holidays_as_leave: !!abs.count_holidays_as_leave,
    })
    setOverlapWarning(null)
    setShowModal(true)
  }

  const getModalEnterpriseId = () => {
    if (admin?.role === 'super_admin') {
      const emp = employes.find(e => e.id === formData.employee_id)
      return emp?.enterprise_id || selectedEntrepriseId
    }
    return admin?.selectedEnterprise?.id || admin?.enterprise_id
  }

  const getModalHolidaySet = () => getHolidaySet(getModalEnterpriseId())
  const getModalHolidayMap = () => getHolidayMap(getModalEnterpriseId())

  const getModalLeaveCount = () => {
    if (!formData.start_date || !formData.end_date) return 0
    if (formData.count_holidays_as_leave) return countCalendarDays(formData.start_date, formData.end_date)
    return HolidayService.countWorkingDays(formData.start_date, formData.end_date, getModalHolidaySet(), true)
  }

  const getModalHolidaysInRange = () => {
    const hSet = getModalHolidaySet()
    return [...hSet].filter(d => d >= formData.start_date && d <= formData.end_date)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.employee_id) { toast.error('Sélectionnez un employé'); return }
    if (new Date(formData.start_date) > new Date(formData.end_date)) { toast.error('La date de fin doit être après le début'); return }
    if (overlapWarning) {
      const ok = window.confirm(`⚠️ Chevauchement détecté avec une absence du ${formatDateFr(overlapWarning.start_date)} au ${formatDateFr(overlapWarning.end_date)}.\n\nContinuer ?`)
      if (!ok) return
    }
    setUploading(true)
    try {
      const { data: empDetails, error: empErr } = await supabase
        .from('employees')
        .select('enterprise_id')
        .eq('id', formData.employee_id)
        .single()
      if (empErr) throw empErr

      let documentUrl = formData.existing_document_url
      if (formData.document_file) {
        if (formData.existing_document_url) await deleteDocument(formData.existing_document_url)
        documentUrl = await uploadDocument(formData.document_file, 'absences')
        toast.success('Document uploadé ✅')
      } else if (formData.remove_document && formData.existing_document_url) {
        await deleteDocument(formData.existing_document_url)
        documentUrl = null
      }

      const holidaysInRange = getModalHolidaysInRange()
      const holidayNames = holidaysInRange.map(d => getModalHolidayMap().get(d)?.name).filter(Boolean)
      let notes = formData.notes || null

      if (holidayNames.length > 0 && !formData.count_holidays_as_leave) {
        const holidayNote = `[Jours fériés exclus du décompte: ${holidayNames.join(', ')}]`
        notes = notes ? `${notes}\n${holidayNote}` : holidayNote
      } else if (holidayNames.length > 0 && formData.count_holidays_as_leave) {
        const holidayNote = `[Jours fériés inclus volontairement dans le congé: ${holidayNames.join(', ')}]`
        notes = notes ? `${notes}\n${holidayNote}` : holidayNote
      }

      const record = {
        employee_id: formData.employee_id,
        enterprise_id: empDetails.enterprise_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        status: formData.status,
        notes,
        document_url: documentUrl,
        count_holidays_as_leave: !!formData.count_holidays_as_leave,
        updated_at: new Date().toISOString(),
      }

      if (editingAbsence) {
        const { error } = await supabase.from('absences').update(record).eq('id', editingAbsence.id)
        if (error) throw error
        toast.success('Absence modifiée ✅')
      } else {
        record.created_by = admin.id
        const { error } = await supabase.from('absences').insert([record])
        if (error) throw error
        toast.success('Absence enregistrée ✅')
      }

      setShowModal(false)
      loadData()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error(error.message || 'Erreur lors de l\'enregistrement')
    }
    setUploading(false)
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('absences').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      toast.success(newStatus === 'approuve' ? '✅ Approuvée' : '❌ Refusée')
      loadData()
    } catch {
      toast.error('Erreur changement de statut')
    }
  }

  const confirmDelete = (id) => {
    setItemToDelete(id)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setUploading(true)
    try {
      const absence = absences.find(a => a.id === itemToDelete)
      if (absence?.document_url) await deleteDocument(absence.document_url)
      const { error } = await supabase.from('absences').delete().eq('id', itemToDelete)
      if (error) throw error
      toast.success('Absence supprimée')
      setShowDeleteModal(false)
      setItemToDelete(null)
      loadData()
    } catch {
      toast.error('Impossible de supprimer')
    }
    setUploading(false)
  }

  const handleViewDocument = (absence) => {
    setViewingDocument({
      url: absence.document_url,
      employeeName: `${absence.employees?.first_name} ${absence.employees?.last_name}`,
      absenceInfo: `${getMotifConfig(absence.reason).emoji} ${getMotifConfig(absence.reason).label} • ${formatDateFr(absence.start_date)} → ${formatDateFr(absence.end_date)}`
    })
  }

  const handleViewRequestDocument = (request) => {
    const leaveType = LEAVE_TYPES[request.leave_type] || LEAVE_TYPES.autre
    setViewingDocument({
      url: request.document_url,
      employeeName: `${request.employees?.first_name} ${request.employees?.last_name}`,
      absenceInfo: `${leaveType.emoji} ${leaveType.label} • ${formatDateFr(request.start_date)} → ${formatDateFr(request.end_date)}`
    })
  }

  const handleExportCSV = () => {
    if (filteredAbsences.length === 0) { toast.error('Aucune donnée'); return }
    const headers = ['Employé', 'Matricule', 'Début', 'Fin', 'Jours décomptés', 'Jours calendaires', 'Fériés inclus', 'Motif', 'Statut', 'Conflit', 'Justificatif', 'Notes']
    const rows = filteredAbsences.map(a => {
      const conflict = getConflictForAbsence(a.id)
      const hSet = getHolidaySet(a.enterprise_id)
      const joursDecomptes = a.count_holidays_as_leave
        ? countCalendarDays(a.start_date, a.end_date)
        : HolidayService.countWorkingDays(a.start_date, a.end_date, hSet, true)
      const joursCalendaires = countCalendarDays(a.start_date, a.end_date)
      const feriesCount = [...hSet].filter(d => d >= a.start_date && d <= a.end_date).length
      return [
        `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`,
        a.employees?.matricule || '',
        a.start_date,
        a.end_date,
        joursDecomptes,
        joursCalendaires,
        a.count_holidays_as_leave ? 'Oui' : 'Non',
        getMotifConfig(a.reason).label,
        a.status || 'approuve',
        conflict ? (conflict.status === 'pending' ? 'En attente' : conflict.status === 'resolved' ? 'Résolu' : 'Ignoré') : 'Aucun',
        a.document_url ? 'Oui' : 'Non',
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ]
    })
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `absences_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${filteredAbsences.length} ligne(s) exportée(s) 📁`)
  }

  const employeeHistory = useMemo(() => {
    if (!showEmployeeHistory) return { absences: [], stats: {}, totalJours: 0 }
    const empAbs = absences.filter(a => a.employee_id === showEmployeeHistory.id).sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    const statsByReason = {}
    MOTIFS.forEach(m => { statsByReason[m.id] = 0 })
    empAbs.forEach(a => {
      const jours = a.count_holidays_as_leave
        ? countCalendarDays(a.start_date, a.end_date)
        : HolidayService.countWorkingDays(a.start_date, a.end_date, getHolidaySet(a.enterprise_id), true)
      statsByReason[a.reason] = (statsByReason[a.reason] || 0) + jours
    })
    const totalJours = empAbs.reduce((s, a) => {
      const jours = a.count_holidays_as_leave
        ? countCalendarDays(a.start_date, a.end_date)
        : HolidayService.countWorkingDays(a.start_date, a.end_date, getHolidaySet(a.enterprise_id), true)
      return s + jours
    }, 0)
    return { absences: empAbs, stats: statsByReason, totalJours }
  }, [showEmployeeHistory, absences, getHolidaySet])

  const resetFilters = () => {
    setSearchQuery('')
    setFilterMotif('all')
    setFilterStatus('all')
    setFilterTemporal('all')
    setFilterPeriod('all')
    setFilterConflict('all')
    setCustomDateFrom('')
    setCustomDateTo('')
    setSortBy('date_desc')
  }

  if (!accessChecked || loading) {
    return (
      <div style={S.loadingContainer}>
        <div className="loading-pulse"><Footprints size={50} color="#F59E0B" /></div>
        <p style={S.loadingText}>{!accessChecked ? 'Vérification des accès...' : 'Chargement des absences...'}</p>
      </div>
    )
  }

  // L'entreprise active décide des motifs visibles (globaux + les siens)
  const entrepriseActiveId = admin?.role === 'super_admin'
    ? selectedEntrepriseId
    : (admin?.selectedEnterprise?.id || admin?.enterprise_id)

  return (
    <MotifsAbsenceProvider enterpriseId={entrepriseActiveId}>
    <>
      <style>{`
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  
  .afro-card{animation:slideUp .4s ease forwards;opacity:0}
  .afro-btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(245,158,11,.3)}
  .absence-card-hover{transition:all .3s ease}
  .absence-card-hover:hover{border-color:rgba(245,158,11,.2)!important;transform:translateY(-2px)}
  .stat-card:hover{transform:translateY(-4px);transition:all .3s ease}
  .loading-pulse{animation:pulse 1.5s ease infinite}
  .cal-day-click{cursor:pointer;transition:all .2s ease}
  .cal-day-click:hover{transform:scale(1.02);border-color:rgba(245,158,11,.4)!important}
  .req-card:hover{border-color:rgba(255,255,255,0.1)!important;transform:translateY(-2px)}
  .req-card{transition:all .3s ease}
  .tab-btn:hover{background:rgba(245,158,11,0.08)!important}
  .doc-view-btn:hover{background:rgba(59,130,246,0.15)!important;border-color:rgba(59,130,246,0.4)!important}
  
  select:focus,input:focus,textarea:focus{border-color:#F59E0B!important;outline:none;box-shadow:0 0 0 3px rgba(245,158,11,.1)}
  select option{background:#1D1713;color:#F5F2EB}


  /* Classes utilitaires responsive */
.hide-mobile { display: block; }
.show-mobile { display: none; }

@media(max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: block !important; }
}

/* Amélioration scroll */
.hide-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
  
  /* ═══════════════════════════════════════════════════════════
     🎯 RESPONSIVE MOBILE - CORRECTIONS CRITIQUES
  ═══════════════════════════════════════════════════════════ */
  
  @media(max-width: 1024px) {
    /* Stats en 3 colonnes sur tablette */
    .stats-grid {
      grid-template-columns: repeat(3, 1fr) !important;
    }
  }
  
  @media(max-width: 768px) {
    /* ✅ CONTAINER PRINCIPAL */
    .container {
      padding: 12px !important;
    }
    
    /* ✅ STATS EN 2 COLONNES */
    .stats-grid { 
      grid-template-columns: repeat(2, 1fr) !important; 
      gap: 10px !important; 
    }
    
    .stat-card {
      padding: 14px !important;
      gap: 12px !important;
    }
    
    .stat-icon {
      width: 40px !important;
      height: 40px !important;
    }
    
    .stat-number {
      font-size: 22px !important;
    }
    
    .stat-label {
      font-size: 11px !important;
    }
    
    /* ✅ TOOLBAR EMPILABLE */
    .toolbar-top { 
      flex-direction: column !important; 
      gap: 12px !important; 
      align-items: stretch !important; 
    }
    
    .toolbar-left, .toolbar-right {
      width: 100% !important;
      flex-direction: column !important;
      gap: 10px !important;
    }
    
    .search-box {
      flex: 1 !important;
      min-width: 100% !important;
    }
    
    .filter-group {
      flex: 1 !important;
      min-width: 100% !important;
    }
    
    .view-toggle {
      width: 100% !important;
    }
    
    .view-btn {
      flex: 1 !important;
      justify-content: center !important;
    }
    
    /* ✅ FILTRES EN COLONNE */
    .filters-panel { 
      flex-direction: column !important; 
      gap: 10px !important;
      padding: 16px !important;
    }
    
    .filter-item {
      min-width: 100% !important;
      flex: 1 !important;
    }
    
    /* ✅ LISTE ABSENCES EN 1 COLONNE */
    .abs-list { 
      grid-template-columns: 1fr !important; 
    }
    
    /* ✅ CARTES ABSENCES COMPACTES */
    .absence-card-hover {
      padding: 14px !important;
    }
    
    .card-header {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 10px !important;
    }
    
    .dates-row {
      flex-direction: column !important;
      gap: 10px !important;
      padding: 10px !important;
    }
    
    .card-footer {
      flex-wrap: wrap !important;
      gap: 10px !important;
    }
    
    .footer-actions {
      flex-wrap: wrap !important;
      gap: 6px !important;
      width: 100% !important;
      justify-content: flex-end !important;
    }
    
    /* ✅ ONGLETS EMPILABLES */
    .tab-container {
      flex-wrap: wrap !important;
      gap: 6px !important;
    }
    
    .tab-btn {
      padding: 10px 16px !important;
      font-size: 13px !important;
    }
    
    /* ✅ CALENDRIER COMPACT */
    .cal-grid {
      gap: 2px !important;
    }
    
    .cal-day {
      min-height: 80px !important;
      padding: 6px !important;
      font-size: 11px !important;
    }
    
    .cal-day-num {
      font-size: 12px !important;
    }
    
    .cal-emp-name {
      font-size: 9px !important;
    }
    
    .cal-detail {
      padding: 16px !important;
    }
    
    .cal-detail-item {
      flex-wrap: wrap !important;
      gap: 10px !important;
    }
    
    /* ✅ MODALS RESPONSIVE */
    .modal-content, .modal {
      max-width: 95vw !important;
      max-height: 95vh !important;
      margin: 10px !important;
      padding: 20px !important;
    }
    
    .modal-header {
      flex-wrap: wrap !important;
      gap: 10px !important;
    }
    
    .modal-footer {
      flex-direction: column !important;
      gap: 10px !important;
    }
    
    .save-btn, .modal-footer button {
      width: 100% !important;
    }
    
    /* ✅ FORMULAIRE MODAL */
    .form-row {
      flex-direction: column !important;
      gap: 14px !important;
    }
    
    .reason-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    
    /* ✅ DEMANDES EMPLOYÉS */
    .req-card {
      padding: 16px !important;
    }
    
    /* ✅ CONFIG CONGÉS */
    .config-grid {
      grid-template-columns: 1fr !important;
    }
  }
  
  @media(max-width: 480px) {
    /* ✅ STATS EN 1 COLONNE SUR TRÈS PETIT ÉCRAN */
    .stats-grid { 
      grid-template-columns: 1fr !important; 
    }
    
    /* ✅ PADDING RÉDUIT */
    .container {
      padding: 8px !important;
    }
    
    .main {
      padding: 12px !important;
    }
    
    /* ✅ BOUTONS COMPACTS */
    .afro-btn, .export-btn, .add-btn {
      padding: 10px 14px !important;
      font-size: 13px !important;
    }
    
    /* ✅ CARTES PLUS COMPACTES */
    .stat-card {
      padding: 12px !important;
      flex-direction: column !important;
      text-align: center !important;
    }
    
    .stat-icon {
      width: 36px !important;
      height: 36px !important;
    }
    
    /* ✅ CALENDRIER TRÈS COMPACT */
    .cal-grid {
      font-size: 10px !important;
    }
    
    .cal-day {
      min-height: 60px !important;
      padding: 4px !important;
    }
    
    .cal-day-num {
      font-size: 11px !important;
    }
    
    .cal-emp-list {
      display: none !important; /* Cache les noms sur très petit écran */
    }
    
    /* ✅ MODAL PLEIN ÉCRAN */
    .modal-content, .modal {
      border-radius: 0 !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      margin: 0 !important;
      padding: 16px !important;
    }
    
    /* ✅ REASON GRID EN 1 COLONNE */
    .reason-grid {
      grid-template-columns: 1fr !important;
    }
    
    /* ✅ TOOLBAR ACTIONS EMPILÉES */
    .toolbar-right button {
      width: 100% !important;
    }
    
    /* ✅ BADGES PLUS PETITS */
    .badge, .cal-detail-badge {
      font-size: 9px !important;
      padding: 2px 6px !important;
    }
    
    /* ✅ HIST STATS VERTICAL */
    .hist-stats {
      flex-direction: column !important;
    }
    
    .hist-total-box {
      border-right: none !important;
      border-bottom: 1px solid rgba(255,255,255,0.06) !important;
      padding-right: 0 !important;
      padding-bottom: 12px !important;
      margin-bottom: 12px !important;
    }
  }
  
  /* ═══════════════════════════════════════════════════════════
     🎯 AMÉLIORATION TACTILE (iOS GUIDELINES)
  ═══════════════════════════════════════════════════════════ */
  
  @media(max-width: 768px) {
    /* Zones tactiles minimum 44x44px */
    button, a, select, input[type="date"], input[type="checkbox"] {
      min-height: 44px !important;
    }
    
    button:not(.icon-only) {
      min-width: 44px !important;
    }
    
    /* Boutons d'action dans les cartes */
    .footer-actions button {
      min-width: 40px !important;
      min-height: 40px !important;
      padding: 10px !important;
    }
    
    /* Espacement entre éléments cliquables */
    .toolbar-right {
      gap: 12px !important;
    }
    
    .footer-actions {
      gap: 8px !important;
    }
  }
  
  /* ═══════════════════════════════════════════════════════════
     🎯 CORRECTIONS OVERFLOW
  ═══════════════════════════════════════════════════════════ */
  
  @media(max-width: 768px) {
    /* Empêcher le scroll horizontal */
    body {
      overflow-x: hidden !important;
    }
    
    /* Textes longs */
    .emp-name, .cal-emp-name, .cal-detail-name {
      max-width: 150px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    
    /* Badges qui débordent */
    .top-badges, .card-header {
      max-width: 100% !important;
      overflow-x: auto !important;
      scrollbar-width: none !important; /* Firefox */
    }
    
    .top-badges::-webkit-scrollbar,
    .card-header::-webkit-scrollbar {
      display: none !important; /* Chrome/Safari */
    }
  }
  
  /* ═══════════════════════════════════════════════════════════
     🎯 FRISE TEXTILE KENTE — HAUT DE PAGE (orange · jaune · noir)
  ═══════════════════════════════════════════════════════════ */

  .abs-kente-top-strip {
    width: 100%;
    height: 14px;
    overflow: hidden;
    line-height: 0;
    border-bottom: 1px solid rgba(245, 158, 11, 0.18);
  }

  .abs-kente-top-strip svg {
    width: 100%;
    height: 14px;
    display: block;
  }

  /* ═══════════════════════════════════════════════════════════
     🎯 ACCESSIBILITÉ
  ═══════════════════════════════════════════════════════════ */
  
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`}</style>

      <div className="abs-page" data-theme="dark" style={S.container}>
        {/* Frise supérieure textile Kente — palette ambre (orange · jaune · noir) */}
        <div className="abs-kente-top-strip" aria-hidden="true">
          <KenteAmberWeaveSvg />
        </div>

        {/* Barre supérieure En-Check — même charte que la page Planning */}
        <div className="abs-topbar">
          <div className="abs-topbar-inner">
            <div className="abs-topbar-left">
              <button
                type="button"
                className="abs-back-btn"
                onClick={() => navigate('/dashboard')}
                aria-label="Retour au tableau de bord"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="abs-brand">
                <span className="abs-brand-title">En-Check · ABSENCES &amp; CONGÉS</span>
                <span className="abs-brand-sub">Congés, maladies, formations et justificatifs</span>
              </div>
            </div>
            <div className="abs-topbar-right">
              <button type="button" className="abs-btn" onClick={handleExportCSV}>
                <Download size={16} /> <span>Export</span>
              </button>
              <button type="button" className="abs-btn abs-btn-primary" onClick={() => handleAdd()}>
                <Plus size={16} /> <span>Déclarer</span>
              </button>
            </div>
          </div>
        </div>

        <main style={S.main}>
                  <div style={TAB.container}>
            <button className="tab-btn" onClick={() => setActiveTab('absences')} style={{ ...TAB.tab, ...(activeTab === 'absences' ? TAB.tabActive : {}) }}>
              <CalendarOff size={16} />
              <span>Absences</span>
              <span style={{ ...TAB.badge, background: activeTab === 'absences' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: activeTab === 'absences' ? '#F59E0B' : '#666' }}>
                {absences.length}
              </span>
            </button>

            <button className="tab-btn" onClick={() => setActiveTab('demandes')} style={{ ...TAB.tab, ...(activeTab === 'demandes' ? TAB.tabActive : {}) }}>
              <Inbox size={16} />
              <span>Demandes employés</span>
              {pendingRequestsCount > 0 ? (
                <span style={{ ...TAB.badge, background: 'rgba(239,68,68,0.15)', color: '#EF4444', animation: 'pulse 2s ease infinite' }}>
                  {pendingRequestsCount}
                </span>
              ) : leaveRequests.length > 0 ? (
                <span style={{ ...TAB.badge, background: activeTab === 'demandes' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: activeTab === 'demandes' ? '#F59E0B' : '#666' }}>
                  {leaveRequests.length}
                </span>
              ) : null}
            </button>

            <button className="tab-btn" onClick={() => setActiveTab('config_conges')} style={{ ...TAB.tab, ...(activeTab === 'config_conges' ? TAB.tabActive : {}) }}>
              <CalendarDays size={16} />
              <span>Configuration congés</span>
            </button>
          </div>

          {activeTab === 'absences' && (
            <>
              <div className="stats-grid" style={S.statsGrid}>
                {[
                  { icon: Timer, color: '#F59E0B', value: stats.enCours, label: 'En cours' },
                  { icon: Calendar, color: '#3B82F6', value: stats.ceMois, label: 'Ce mois-ci' },
                  { icon: TrendingUp, color: '#EF4444', value: stats.joursMois, label: 'Jours décomptés' },
                  { icon: Hourglass, color: '#8B5CF6', value: stats.enAttente, label: 'En attente' },
                  { icon: AlertTriangle, color: '#F97316', value: stats.conflitsPending, label: 'Conflits à traiter' },
                  { icon: BarChart3, color: '#10B981', value: absences.length, label: 'Total absences' },
                ].map((s, i) => (
                  <div key={i} className="stat-card" style={S.statCard}>
                    <div style={{ ...S.statIcon, background: `${s.color}15` }}>
                      <s.icon size={22} color={s.color} />
                    </div>
                    <div>
                      <p style={S.statNumber}>{s.value}</p>
                      <p style={S.statLabel}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {stats.conflitsPending > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 14, marginBottom: 20 }}>
                  <AlertTriangle size={20} color="#F97316" />
                  <p style={{ color: '#F97316', fontSize: 14, fontWeight: 600, margin: 0 }}>
                    {stats.conflitsPending} conflit{stats.conflitsPending > 1 ? 's' : ''} absence/pointage nécessite{stats.conflitsPending > 1 ? 'nt' : ''} votre attention.
                  </p>
                  <button onClick={() => setFilterConflict('with_conflict')} style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.3)', color: '#F97316', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto', fontFamily: 'inherit' }}>
                    Voir les conflits
                  </button>
                </div>
              )}

              <div className="toolbar-top" style={S.toolbar}>
                <div style={S.toolbarLeft}>
                  <div style={S.searchBox}>
                    <Search size={16} color="#888" />
                    <input type="text" placeholder="Rechercher un employé..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={S.searchInput} />
                    {searchQuery && <button onClick={() => setSearchQuery('')} style={S.clearSearch}><X size={14} /></button>}
                  </div>
                  {admin?.role === 'super_admin' && (
                    <div style={S.filterGroup}>
                      <Building2 size={16} color="#F59E0B" />
                      <select value={selectedEntrepriseId} onChange={e => setSelectedEntrepriseId(e.target.value)} style={S.filterSelect}>
                        <option value="all">Toutes entreprises</option>
                        {entreprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={S.toolbarRight}>
                  <button onClick={() => setShowFilters(!showFilters)} style={{ ...S.iconBtn, background: showFilters ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.05)', color: showFilters ? '#F59E0B' : 'rgba(245,242,235,0.55)' }}><Filter size={18} /></button>
                  <div style={S.viewToggle}>
                    <button onClick={() => setViewMode('planning')} title="Planning — calendrier par employé" style={{ ...S.viewBtn, gap: 6, ...(viewMode === 'planning' ? S.viewBtnActive : {}) }}><CalendarDays size={15} /><span style={{ fontSize: 12, fontWeight: 600 }}>Planning</span></button>
                    <button onClick={() => setViewMode('calendar')} title="Mois — grille du mois" style={{ ...S.viewBtn, gap: 6, ...(viewMode === 'calendar' ? S.viewBtnActive : {}) }}><Calendar size={15} /><span style={{ fontSize: 12, fontWeight: 600 }}>Mois</span></button>
                    <button onClick={() => setViewMode('list')} title="Liste — cartes détaillées" style={{ ...S.viewBtn, gap: 6, ...(viewMode === 'list' ? S.viewBtnActive : {}) }}><List size={15} /><span style={{ fontSize: 12, fontWeight: 600 }}>Liste</span></button>
                  </div>
                  <button onClick={handleExportCSV} style={S.exportBtn}><Download size={16} /><span>Export</span></button>
                  <button onClick={() => handleAdd()} className="afro-btn" style={S.addBtn}><Plus size={18} /><span>Déclarer</span></button>
                </div>
              </div>

              {showFilters && (
                <div className="filters-panel" style={S.filtersPanel}>
                  <div style={S.filterItem}>
                    <label style={S.filterLabel}>Motif</label>
                    <select value={filterMotif} onChange={e => setFilterMotif(e.target.value)} style={S.filterSelectSmall}>
                      <option value="all">Tous</option>
                      {MOTIFS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
                    </select>
                  </div>
                  <div style={S.filterItem}>
                    <label style={S.filterLabel}>Statut</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={S.filterSelectSmall}>
                      <option value="all">Tous</option>
                      <option value="en_attente">⏳ En attente</option>
                      <option value="approuve">✅ Approuvé</option>
                      <option value="refuse">❌ Refusé</option>
                    </select>
                  </div>
                  <div style={S.filterItem}>
                    <label style={S.filterLabel}>État</label>
                    <select value={filterTemporal} onChange={e => setFilterTemporal(e.target.value)} style={S.filterSelectSmall}>
                      <option value="all">Tous</option>
                      <option value="en_cours">🔶 En cours</option>
                      <option value="a_venir">🔵 À venir</option>
                      <option value="passee">⚪ Terminée</option>
                    </select>
                  </div>
                  <div style={S.filterItem}>
                    <label style={S.filterLabel}>Conflit</label>
                    <select value={filterConflict} onChange={e => setFilterConflict(e.target.value)} style={S.filterSelectSmall}>
                      <option value="all">Tous</option>
                      <option value="with_conflict">⚠ Avec conflit</option>
                      <option value="no_conflict">✓ Sans conflit</option>
                    </select>
                  </div>
                  <div style={S.filterItem}>
                    <label style={S.filterLabel}>Période</label>
                    <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={S.filterSelectSmall}>
                      <option value="all">Toutes</option>
                      <option value="this_month">Ce mois</option>
                      <option value="last_month">Mois dernier</option>
                      <option value="this_year">Cette année</option>
                      <option value="custom">Personnalisé</option>
                    </select>
                  </div>
                  <div style={S.filterItem}>
                    <label style={S.filterLabel}>Trier</label>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={S.filterSelectSmall}>
                      <option value="date_desc">Date ↓</option>
                      <option value="date_asc">Date ↑</option>
                      <option value="name_asc">Nom A→Z</option>
                      <option value="name_desc">Nom Z→A</option>
                      <option value="duration_desc">Durée ↓</option>
                    </select>
                  </div>
                  {filterPeriod === 'custom' && (
                    <>
                      <div style={S.filterItem}>
                        <label style={S.filterLabel}>Du</label>
                        <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} style={S.filterSelectSmall} />
                      </div>
                      <div style={S.filterItem}>
                        <label style={S.filterLabel}>Au</label>
                        <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} style={S.filterSelectSmall} />
                      </div>
                    </>
                  )}
                  <button onClick={resetFilters} style={S.resetBtn}><RefreshCw size={14} /> Réinitialiser</button>
                </div>
              )}

              <div style={S.resultCount}>
                <span style={S.resultText}>
                  {filteredAbsences.length} absence{filteredAbsences.length > 1 ? 's' : ''}
                  {filteredAbsences.length !== absences.length && <span style={{ color: '#666' }}> / {absences.length}</span>}
                </span>
              </div>

              {viewMode === 'planning' && (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <AbsencesDock onDeclarer={({ motifId }) => handleAdd({ reason: motifId })} />
                <div style={{ flex: 1, minWidth: 0 }}>
                <AbsencesCalendrier
                  absences={absences}
                  employes={employes}
                  darkMode
                  annee={calendarDate.getFullYear()}
                  mois={calendarDate.getMonth()}
                  onChangerMois={(delta) => {
                    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1))
                    setSelectedCalendarDay(null)
                  }}
                  getHolidaySet={getHolidaySet}
                  joursPrisParEmploye={joursPrisParEmploye}
                  plafondConges={leaveConfig.annual_leave_cap || 30}
                  conflitParAbsence={conflitParAbsence}
                  onModifier={handleEdit}
                  onChangerStatut={(a, statut) => handleStatusChange(a.id, statut)}
                  onVoirDocument={handleViewDocument}
                  onDeclarer={() => handleAdd()}
                  onDeposerMotif={({ employeeId, dateIso, motifId }) =>
                    handleAdd({ employee_id: employeeId, start_date: dateIso, end_date: dateIso, reason: motifId })
                  }
                />
                </div>
                </div>
              )}

              {viewMode === 'list' && (
                <>
                  <div className="abs-list" style={S.list}>
                    {paginatedAbsences.length === 0 ? (
                      <div style={S.empty}>
                        <CalendarOff size={48} color="#555" style={{ marginBottom: 16 }} />
                        <p style={S.emptyTitle}>Aucune absence trouvée</p>
                        <p style={S.emptySubtitle}>{searchQuery || filterMotif !== 'all' ? 'Modifiez vos filtres' : 'Aucune absence enregistrée'}</p>
                      </div>
                    ) : paginatedAbsences.map((abs, i) => (
                      <AbsenceCard
                        key={abs.id}
                        absence={abs}
                        admin={admin}
                        onEdit={handleEdit}
                        onDelete={confirmDelete}
                        onStatusChange={handleStatusChange}
                        onViewDocument={handleViewDocument}
                        onManageConflict={openConflictModal}
                        conflict={getConflictForAbsence(abs.id)}
                        index={i}
                        holidaySet={getHolidaySet(abs.enterprise_id)}
                        holidayMapByDate={getHolidayMap(abs.enterprise_id)}
                      />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div style={S.pagination}>
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ ...S.pageBtn, opacity: currentPage === 1 ? .3 : 1 }}><ChevronLeft size={18} /></button>
                      <span style={{ color: 'rgba(245,242,235,0.55)', fontSize: 13 }}>{currentPage} / {totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ ...S.pageBtn, opacity: currentPage === totalPages ? .3 : 1 }}><ChevronRight size={18} /></button>
                    </div>
                  )}
                </>
              )}

              {viewMode === 'calendar' && (
                <div style={S.calContainer}>
                  <div style={S.calHeader}>
                    <button onClick={() => { setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1)); setSelectedCalendarDay(null) }} style={S.calNavBtn}><ChevronLeft size={20} /></button>
                    <h3 style={S.calTitle}>{calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => { setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1)); setSelectedCalendarDay(null) }} style={S.calNavBtn}><ChevronRight size={20} /></button>
                  </div>
                  <div style={S.calGrid}>
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} style={S.calDayHeader}>{d}</div>)}
                    {calendarData.map((cell, idx) => {
                      if (!cell) return <div key={`e${idx}`} style={S.calDayEmpty} />
                      const todayStr = new Date().toISOString().split('T')[0]
                      const isToday = cell.date === todayStr
                      const hasAbs = cell.absences.length > 0
                      const isSelected = selectedCalendarDay?.date === cell.date
                      const isWeekend = new Date(cell.date + 'T12:00:00Z').getUTCDay() === 0 || new Date(cell.date + 'T12:00:00Z').getUTCDay() === 6
                      const hasConflictOnDay = cell.absences.some(a => { const c = getConflictForAbsence(a.id); return c && c.status === 'pending' })

                      return (
                        <div
                          key={cell.date}
                          className={hasAbs ? 'cal-day-click' : ''}
                          onClick={() => hasAbs && setSelectedCalendarDay(isSelected ? null : cell)}
                          style={{
                            ...S.calDay,
                            ...(isWeekend ? S.calDayWeekend : {}),
                            ...(isToday ? S.calDayToday : {}),
                            ...(hasAbs ? S.calDayHasAbs : {}),
                            ...(isSelected ? S.calDaySelected : {}),
                            ...(hasConflictOnDay ? { borderColor: 'rgba(249,115,22,.4)' } : {}),
                            ...(cell.isHoliday ? { background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.18)' } : {})
                          }}
                        >
                          <div style={S.calDayTop}>
                            <span style={{ ...S.calDayNum, ...(isToday ? { color: '#F59E0B' } : {}) }}>{cell.day}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {cell.isHoliday && <span style={{ fontSize: 10 }}>🎌</span>}
                              {hasAbs && <span style={S.calAbsCount}>{cell.absences.length}</span>}
                            </div>
                          </div>

                          {cell.isHoliday && (
                            <div style={{ fontSize: 9, color: '#A78BFA', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cell.holiday?.name}
                            </div>
                          )}

                          {hasAbs && (
                            <div style={S.calEmpList}>
                              {cell.absences.slice(0, 3).map((a, i) => {
                                const mc = getMotifConfig(a.reason)
                                const c = getConflictForAbsence(a.id)
                                return (
                                  <div key={i} style={S.calEmpItem}>
                                    <div style={{ ...S.calEmpDot, background: c && c.status === 'pending' ? '#F97316' : mc.color }} />
                                    <span style={S.calEmpName}>{a.employees?.first_name} {a.employees?.last_name?.[0]}.</span>
                                  </div>
                                )
                              })}
                              {cell.absences.length > 3 && <span style={S.calMore}>+{cell.absences.length - 3} autres</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {selectedCalendarDay && selectedCalendarDay.absences.length > 0 && (
                    <div style={S.calDetail}>
                      <div style={S.calDetailHeader}>
                        <span style={S.calDetailTitle}>📅 {formatDateLong(selectedCalendarDay.date)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {selectedCalendarDay.isHoliday && (
                            <span style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                              🎌 {selectedCalendarDay.holiday?.name}
                            </span>
                          )}
                          <span style={S.calDetailCount}>{selectedCalendarDay.absences.length} absent{selectedCalendarDay.absences.length > 1 ? 's' : ''}</span>
                          <button onClick={() => setSelectedCalendarDay(null)} style={S.calDetailClose}><X size={16} /></button>
                        </div>
                      </div>
                      <div style={S.calDetailList}>
                        {selectedCalendarDay.absences.map((a, i) => {
                          const mc = getMotifConfig(a.reason)
                          const conflict = getConflictForAbsence(a.id)
                          return (
                            <div key={i} style={S.calDetailItem}>
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {a.employees?.photo_url
                                  ? <img src={a.employees.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                                  : <User size={18} color="#F59E0B" />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={S.calDetailName}>{a.employees?.first_name} {a.employees?.last_name}</p>
                                <p style={S.calDetailMeta}>{a.employees?.matricule} · {formatDateFr(a.start_date)} → {formatDateFr(a.end_date)}</p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <div style={{ ...S.calDetailBadge, background: mc.bg, color: mc.color, border: `1px solid ${mc.color}40` }}>{mc.emoji} {mc.label}</div>
                                {conflict && conflict.status === 'pending' && (
                                  <div style={{ ...S.calDetailBadge, background: 'rgba(249,115,22,.12)', color: '#F97316', border: '1px solid rgba(249,115,22,.3)', fontSize: 9 }}>⚠ Conflit</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div style={S.calLegend}>
                    {MOTIFS.map(m => (
                      <div key={m.id} style={S.calLegendItem}>
                        <div style={{ ...S.calLegendDot, background: m.color }} />
                        <span style={S.calLegendLabel}>{m.label}</span>
                      </div>
                    ))}
                    <div style={S.calLegendItem}>
                      <div style={{ ...S.calLegendDot, background: '#F97316' }} />
                      <span style={S.calLegendLabel}>Conflit RH</span>
                    </div>
                    <div style={S.calLegendItem}>
                      <span style={{ fontSize: 12 }}>🎌</span>
                      <span style={S.calLegendLabel}>Jour férié</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'demandes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pendingRequestsCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Inbox size={20} color="#EF4444" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#EF4444', fontSize: 14, fontWeight: 700, margin: '0 0 2px 0' }}>
                      {pendingRequestsCount} demande{pendingRequestsCount > 1 ? 's' : ''} en attente de validation
                    </p>
                    <p style={{ color: '#999', fontSize: 12, margin: 0 }}>Les employés attendent votre réponse</p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: 'Toutes' },
                  { key: 'en_attente', label: '⏳ En attente' },
                  { key: 'approuve', label: '✅ Approuvées' },
                  { key: 'refuse', label: '❌ Refusées' },
                ].map(f => {
                  const count = f.key === 'all' ? leaveRequests.length : leaveRequests.filter(r => r.status === f.key).length
                  return (
                    <button key={f.key} onClick={() => setRequestFilter(f.key)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                      background: requestFilter === f.key ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${requestFilter === f.key ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 10, color: requestFilter === f.key ? '#F59E0B' : 'rgba(245,242,235,0.55)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
                    }}>
                      {f.label}
                      {count > 0 && (
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: requestFilter === f.key ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: requestFilter === f.key ? '#F59E0B' : '#666' }}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {loadingRequests ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px' }}>
                  <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ color: '#666', marginTop: 12, fontSize: 14 }}>Chargement...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', background: 'rgba(29,23,19,0.5)', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                  <Inbox size={48} color="#555" />
                  <h3 style={{ color: '#FFF', margin: '12px 0 4px 0', fontSize: 18 }}>Aucune demande</h3>
                  <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
                    {requestFilter !== 'all' ? 'Aucune demande avec ce statut' : 'Les employés n\'ont pas encore soumis de demandes de congé'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredRequests.map((request, index) => {
                    const leaveType = LEAVE_TYPES[request.leave_type] || LEAVE_TYPES.autre
                    const isPending = request.status === 'en_attente'
                    const hSet = getHolidaySet(request.enterprise_id)
                    const ouvrés = HolidayService.countWorkingDays(request.start_date, request.end_date, hSet, true)
                    const calendaire = countCalendarDays(request.start_date, request.end_date)
                    const feriesCount = [...hSet].filter(d => d >= request.start_date && d <= request.end_date).length
                    const statusCfg = {
                      en_attente: { label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
                      approuve: { label: 'Approuvée', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
                      refuse: { label: 'Refusée', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
                    }
                    const sc = statusCfg[request.status] || statusCfg.en_attente
                    const hasDocument = !!request.document_url
                    const docType = hasDocument ? getFileType(request.document_url) : null

                    return (
                      <div key={request.id} className="req-card" style={{ background: 'rgba(29,23,19,0.85)', border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `4px solid ${sc.color}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, animation: `slideUp 0.3s ease ${index * 0.04}s forwards`, opacity: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                              {request.employees?.photo_url
                                ? <img src={request.employees.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: 14 }}>{request.employees?.first_name?.[0]}{request.employees?.last_name?.[0]}</span>
                              }
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ color: '#FFF', fontSize: 15, fontWeight: 600, margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {request.employees?.first_name} {request.employees?.last_name}
                              </p>
                              <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 12, margin: 0 }}>
                                {request.employees?.matricule}
                                {request.employees?.position && ` · ${request.employees.position}`}
                              </p>
                              {admin?.role === 'super_admin' && request.enterprises?.name && (
                                <p style={{ color: '#F59E0B', fontSize: 11, margin: '2px 0 0 0' }}>🏢 {request.enterprises.name}</p>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {hasDocument && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }}>
                                <Paperclip size={10} /> Justificatif
                              </span>
                            )}
                            {feriesCount > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.25)' }}>
                                🎌 {feriesCount} férié{feriesCount > 1 ? 's' : ''}
                              </span>
                            )}
                            <span style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', background: sc.bg, color: sc.color, flexShrink: 0 }}>
                              {sc.label}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: `${leaveType.color}15`, color: leaveType.color, border: `1px solid ${leaveType.color}30`, width: 'fit-content' }}>
                            {leaveType.emoji} {leaveType.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, gap: 8 }}>
                            <div>
                              <span style={{ color: '#666', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>DU</span>
                              <span style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>
                                {new Date(request.start_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '6px 14px' }}>
                              <span style={{ color: '#F59E0B', fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{ouvrés}</span>
                              <span style={{ color: '#F59E0B', fontSize: 9, opacity: 0.8 }}>jour{ouvrés > 1 ? 's' : ''} ouvrés</span>
                              <span style={{ color: 'rgba(245,242,235,0.55)', fontSize: 9, marginTop: 2 }}>({calendaire} cal.)</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: '#666', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>AU</span>
                              <span style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>
                                {new Date(request.end_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {request.reason && (
                          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: '2px solid rgba(245,158,11,0.3)' }}>
                            <MessageSquare size={13} color="#888" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ color: '#AAA', fontSize: 12, lineHeight: '1.5', fontStyle: 'italic' }}>{request.reason}</span>
                          </div>
                        )}

                        {hasDocument && (
                          <button
                            className="doc-view-btn"
                            onClick={() => handleViewRequestDocument(request)}
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
                            {docType === 'image' ? <FileImage size={15} /> : <File size={15} />}
                            <span>Voir le justificatif</span>
                            <Eye size={14} style={{ marginLeft: 'auto' }} />
                          </button>
                        )}

                        {request.review_comment && !isPending && (
                          <div style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${sc.color}30`, background: sc.bg }}>
                            <span style={{ color: sc.color, fontSize: 11, fontWeight: 700 }}>Réponse admin :</span>
                            <p style={{ color: '#CCC', fontSize: 12, margin: '4px 0 0 0', lineHeight: '1.5' }}>{request.review_comment}</p>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: 10 }}>
                          <span style={{ color: '#555', fontSize: 11 }}>
                            Soumise le {new Date(request.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {!isPending && (
                              <button
                                onClick={() => confirmDeleteRequest(request)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' }}
                              >
                                <Trash2 size={13} />
                                {request.status === 'approuve' ? 'Supprimer (+ absence)' : 'Supprimer'}
                              </button>
                            )}
                            {isPending && (
                              <>
                                <button onClick={() => openReviewModal(request, 'refuse')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  <X size={14} /> Refuser
                                </button>
                                <button onClick={() => openReviewModal(request, 'approuve')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#10B981', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  <Check size={14} /> Approuver
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}


                    {activeTab === 'config_conges' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <AbsencesMotifsManager absences={absences} />
              <div style={{
                background: 'rgba(29,23,19,0.8)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ color: '#FFF', fontSize: 18, fontWeight: 700, margin: 0 }}>Configuration des congés</h3>
                    <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 13, margin: '4px 0 0 0' }}>
                      Ces paramètres seront utilisés dans l’espace employé et les fiches de paie.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveLeaveConfig}
                    disabled={savingLeaveConfig}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      color: '#000',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    {savingLeaveConfig ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                    <span>{savingLeaveConfig ? 'Enregistrement...' : 'Enregistrer'}</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 600 }}>Jours acquis par mois</label>
                    <input
                      type="number"
                      step="0.25"
                      value={leaveConfig.leave_days_per_month}
                      onChange={e => setLeaveConfig(prev => ({ ...prev, leave_days_per_month: e.target.value }))}
                      style={S.input}
                    />
                    <span style={{ color: '#666', fontSize: 11 }}>Ex: 1.75 jours/mois</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 600 }}>Plafond annuel</label>
                    <input
                      type="number"
                      value={leaveConfig.annual_leave_cap}
                      onChange={e => setLeaveConfig(prev => ({ ...prev, annual_leave_cap: e.target.value }))}
                      style={S.input}
                    />
                    <span style={{ color: '#666', fontSize: 11 }}>Ex: 30 jours maximum</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 600 }}>Référence de calcul</label>
                    <select
                      value={leaveConfig.leave_reference_date}
                      onChange={e => setLeaveConfig(prev => ({ ...prev, leave_reference_date: e.target.value }))}
                      style={S.filterSelectSmall}
                    >
                      <option value="hire_date">Depuis la date d’embauche</option>
                      <option value="calendar_year">Année civile</option>
                    </select>
                    <span style={{ color: '#666', fontSize: 11 }}>Méthode d’acquisition des congés</span>
                  </div>
                </div>

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={leaveConfig.leave_carry_over}
                    onChange={e => setLeaveConfig(prev => ({ ...prev, leave_carry_over: e.target.checked }))}
                    style={{ accentColor: '#F59E0B', marginTop: 2 }}
                  />
                  <div>
                    <span style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 600 }}>
                      Autoriser le report des congés N-1
                    </span>
                    <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 11, margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      Si activé, le solde positif de l’année précédente sera reporté automatiquement.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{
                background: 'rgba(29,23,19,0.8)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ color: '#FFF', fontSize: 18, fontWeight: 700, margin: 0 }}>Recalcul des soldes</h3>
                    <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 13, margin: '4px 0 0 0' }}>
                      Recalcule les soldes pour tous les employés actifs de l’entreprise.
                    </p>
                  </div>

                  <button
                    onClick={handleRecalculateLeaveBalances}
                    disabled={recalculatingBalances}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid rgba(16,185,129,0.25)',
                      background: 'rgba(16,185,129,0.12)',
                      color: '#10B981',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    {recalculatingBalances ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
                    <span>{recalculatingBalances ? 'Recalcul...' : 'Recalculer tous les soldes'}</span>
                  </button>
                </div>
              </div>

              <div style={{
                background: 'rgba(29,23,19,0.8)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <div>
                  <h3 style={{ color: '#FFF', fontSize: 18, fontWeight: 700, margin: 0 }}>Aperçu des soldes employés</h3>
                  <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 13, margin: '4px 0 0 0' }}>
                    Année en cours — lecture depuis <code style={{ color: '#F59E0B' }}>employee_leave_balances</code>
                  </p>
                </div>

                {loadingLeaveBalancesPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 }}>
                    <RefreshCw size={20} color="#F59E0B" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'rgba(245,242,235,0.55)' }}>Chargement des soldes...</span>
                  </div>
                ) : leaveBalancesPreview.length === 0 ? (
                  <div style={S.emptyMini}>
                    <CalendarDays size={20} color="#666" />
                    <span>Aucun solde disponible. Lancez un recalcul.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {leaveBalancesPreview.map((item, index) => (
                      <div
                        key={item.id || `${item.employee_id}-${index}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(180px, 2fr) repeat(4, minmax(90px, 1fr))',
                          gap: 12,
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div>
                          <div style={{ color: '#FFF', fontSize: 13, fontWeight: 700 }}>
                            {item.employees?.first_name} {item.employees?.last_name}
                          </div>
                          <div style={{ color: '#777', fontSize: 11 }}>
                            {item.employees?.matricule || '—'} {item.employees?.department ? `• ${item.employees.department}` : ''}
                          </div>
                        </div>

                        <div>
                          <div style={{ color: '#666', fontSize: 10, textTransform: 'uppercase' }}>Acquis</div>
                          <div style={{ color: '#10B981', fontSize: 13, fontWeight: 700 }}>{item.total_acquired || 0}j</div>
                        </div>

                        <div>
                          <div style={{ color: '#666', fontSize: 10, textTransform: 'uppercase' }}>Pris</div>
                          <div style={{ color: '#F59E0B', fontSize: 13, fontWeight: 700 }}>{item.total_taken || 0}j</div>
                        </div>

                        <div>
                          <div style={{ color: '#666', fontSize: 10, textTransform: 'uppercase' }}>Attente</div>
                          <div style={{ color: '#818CF8', fontSize: 13, fontWeight: 700 }}>{item.total_pending || 0}j</div>
                        </div>

                        <div>
                          <div style={{ color: '#666', fontSize: 10, textTransform: 'uppercase' }}>Solde</div>
                          <div style={{ color: (item.balance || 0) < 0 ? '#EF4444' : '#FFF', fontSize: 14, fontWeight: 800 }}>
                            {item.balance || 0}j
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ═══ MODAL AJOUT/MODIF ABSENCE ═══ */}
        {showModal && (
          <div style={S.overlay} onClick={() => !uploading && setShowModal(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <h2 style={S.modalTitleText}>{editingAbsence ? '✏️ Modifier' : '📝 Nouvelle absence'}</h2>
                <button onClick={() => !uploading && setShowModal(false)} style={S.closeBtnModal} disabled={uploading}><X size={20} /></button>
              </div>

              <form onSubmit={handleSave} style={S.form}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Employé *</label>
                  <select value={formData.employee_id} onChange={e => setFormData({ ...formData, employee_id: e.target.value })} style={S.input} required>
                    {employes.length === 0 && <option value="">Aucun employé</option>}
                    {employes.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule})</option>)}
                  </select>
                  {formData.employee_id && (
                    <button type="button" onClick={() => setShowEmployeeHistory(employes.find(e => e.id === formData.employee_id))} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#F59E0B', fontSize: 12, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', opacity: .8 }}>
                      <Clock size={12} /> Voir l'historique
                    </button>
                  )}
                </div>

                <div style={S.formRow}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Début *</label>
                    <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} style={S.input} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Fin *</label>
                    <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} style={S.input} min={formData.start_date} required />
                  </div>
                </div>

                {formData.start_date && formData.end_date && new Date(formData.end_date) >= new Date(formData.start_date) && (
                  <>
                    <div style={S.daysCounter}>
                      <Calendar size={16} color="#F59E0B" />
                      <strong style={{ color: '#F59E0B', fontSize: 20 }}>{getModalLeaveCount()}</strong>
                      <span style={{ color: '#ccc', fontSize: 14 }}>jour(s) décompté(s)</span>
                      <span style={{ marginLeft: 'auto', color: 'rgba(245,242,235,0.55)', fontSize: 12 }}>
                        {countCalendarDays(formData.start_date, formData.end_date)} jour(s) calendaires
                      </span>
                    </div>

                    {getModalHolidaysInRange().length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}>🎌</span>
                          <span style={{ color: '#A78BFA', fontSize: 13, fontWeight: 700 }}>
                            {getModalHolidaysInRange().length} jour(s) férié(s) dans cette période
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {getModalHolidaysInRange().map(d => (
                            <span key={d} style={{ color: '#C4B5FD', fontSize: 12 }}>
                              • {getModalHolidayMap().get(d)?.name || d} ({formatDateFr(d)})
                            </span>
                          ))}
                        </div>

                        <label style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 10,
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.count_holidays_as_leave}
                            onChange={e => setFormData({ ...formData, count_holidays_as_leave: e.target.checked })}
                            style={{ accentColor: '#8B5CF6', marginTop: 2 }}
                          />
                          <div>
                            <span style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 600 }}>
                              Décompter quand même les jours fériés comme congé
                            </span>
                            <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 11, margin: '4px 0 0 0', lineHeight: 1.4 }}>
                              Active cette option si l’entreprise considère qu’un congé posé sur un jour férié doit tout de même être consommé.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </>
                )}

                {overlapWarning && (
                  <div style={S.overlapBox}>
                    <AlertCircle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={S.overlapTitle}>⚠️ Chevauchement détecté</p>
                      <p style={S.overlapText}>Absence existante du <strong>{formatDateFr(overlapWarning.start_date)}</strong> au <strong>{formatDateFr(overlapWarning.end_date)}</strong></p>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Motif *</label>
                  <div style={S.reasonGrid}>
                    {MOTIFS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, reason: m.id })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          padding: '12px 8px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'center',
                          background: formData.reason === m.id ? m.bg : 'rgba(255,255,255,.02)',
                          border: `1px solid ${formData.reason === m.id ? m.color + '60' : 'rgba(255,255,255,.06)'}`,
                          color: formData.reason === m.id ? m.color : '#777'
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{m.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: formData.reason === m.id ? 700 : 400 }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Statut</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={S.input}>
                    <option value="approuve">✅ Approuvé</option>
                    <option value="en_attente">⏳ En attente</option>
                    <option value="refuse">❌ Refusé</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Notes</label>
                  <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Certificat médical, justificatif..." />
                </div>

                <UploadZone
                  file={formData.document_file}
                  existingUrl={formData.remove_document ? null : formData.existing_document_url}
                  onFileSelect={(file) => setFormData({ ...formData, document_file: file, remove_document: false })}
                  onRemove={() => setFormData({ ...formData, document_file: null, remove_document: true })}
                  uploading={uploading}
                />

                <div style={S.modalFooter}>
                  <button type="button" onClick={() => !uploading && setShowModal(false)} style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,.05)', color: '#FFF', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} disabled={uploading}>Annuler</button>
                  <button type="submit" className="afro-btn" style={S.saveBtn} disabled={uploading}>
                    {uploading ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enregistrement...</> : <><Save size={18} /> {editingAbsence ? 'Modifier' : 'Enregistrer'}</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══ MODAL REVIEW DEMANDE EMPLOYÉ ═══ */}
        {showReviewModal && selectedRequest && (
          <div style={S.overlay} onClick={() => !submittingReview && setShowReviewModal(false)}>
            <div style={{ background: '#1D1713', border: `1px solid ${reviewAction === 'approuve' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease forwards', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: reviewAction === 'approuve' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: reviewAction === 'approuve' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {reviewAction === 'approuve' ? <Check size={22} color="#10B981" /> : <X size={22} color="#EF4444" />}
                  </div>
                  <div>
                    <h2 style={{ color: '#FFF', fontSize: 18, fontWeight: 700, margin: 0 }}>
                      {reviewAction === 'approuve' ? 'Approuver la demande' : 'Refuser la demande'}
                    </h2>
                    <p style={{ color: reviewAction === 'approuve' ? '#10B981' : '#EF4444', fontSize: 13, margin: '4px 0 0 0' }}>
                      {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowReviewModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,242,235,0.55)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Type', value: `${LEAVE_TYPES[selectedRequest.leave_type]?.emoji || ''} ${LEAVE_TYPES[selectedRequest.leave_type]?.label || selectedRequest.leave_type}` },
                    {
                      label: 'Période',
                      value: `${new Date(selectedRequest.start_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })} → ${new Date(selectedRequest.end_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`
                    },
                    {
                      label: 'Durée',
                      value: (() => {
                        const hSet = getHolidaySet(selectedRequest.enterprise_id)
                        const ouvrés = HolidayService.countWorkingDays(selectedRequest.start_date, selectedRequest.end_date, hSet, true)
                        const calendaire = countCalendarDays(selectedRequest.start_date, selectedRequest.end_date)
                        const feriesCount = [...hSet].filter(d => d >= selectedRequest.start_date && d <= selectedRequest.end_date).length
                        return feriesCount > 0
                          ? `${ouvrés} jours ouvrés (${calendaire} cal. − ${feriesCount} férié${feriesCount > 1 ? 's' : ''})`
                          : `${ouvrés} jour${ouvrés > 1 ? 's' : ''}`
                      })()
                    },
                  ].map((item, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ color: 'rgba(245,242,235,0.55)', fontSize: 13 }}>{item.label}</span>
                      <span style={{ color: '#FFF', fontSize: 13, fontWeight: 600 }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {selectedRequest.document_url && (
                  <button
                    className="doc-view-btn"
                    onClick={() => handleViewRequestDocument(selectedRequest)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, color: '#3B82F6', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease', textAlign: 'left' }}
                  >
                    {getFileType(selectedRequest.document_url) === 'image' ? <FileImage size={15} /> : <File size={15} />}
                    <span>Voir le justificatif joint</span>
                    <Eye size={14} style={{ marginLeft: 'auto' }} />
                  </button>
                )}

                {reviewAction === 'approuve' && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12 }}>
                    <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: '#10B981', fontSize: 13, margin: 0, lineHeight: '1.5' }}>
                      Une absence sera automatiquement créée dans le registre des absences. Les jours fériés seront exclus du décompte.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>
                    Message pour l'employé
                    <span style={{ color: '#666', fontWeight: 400 }}> (optionnel)</span>
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder={reviewAction === 'approuve' ? 'Ex: Bonne vacances ! Votre demande est acceptée.' : 'Ex: Effectif insuffisant pour cette période...'}
                    style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#FFF', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', minHeight: 90, outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setShowReviewModal(false)} disabled={submittingReview} style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F5F2EB', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
                <button onClick={handleReviewRequest} disabled={submittingReview} style={{ flex: 2, padding: 14, background: reviewAction === 'approuve' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #EF4444, #B91C1C)', color: '#FFF', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: submittingReview ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: submittingReview ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {submittingReview ? 'Traitement...' : reviewAction === 'approuve' ? <><Check size={16} /> Approuver</> : <><X size={16} /> Refuser</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL SUPPRESSION ABSENCE ═══ */}
        {showDeleteModal && (
          <div style={S.overlay}>
            <div style={{ background: '#1D1713', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, width: '100%', maxWidth: 420, padding: 36, textAlign: 'center', animation: 'slideUp .3s ease forwards' }}>
              <div style={{ width: 68, height: 68, borderRadius: 18, background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={32} color="#EF4444" />
              </div>
              <h3 style={{ color: '#FFF', fontSize: 20, fontWeight: 600, margin: '0 0 12px 0' }}>Supprimer cette absence ?</h3>
              <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 14, marginBottom: 28, lineHeight: '1.5' }}>Cette action est irréversible.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,.05)', color: '#FFF', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Annuler</button>
                <button onClick={handleDelete} style={{ flex: 1, padding: 14, background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#FFF', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} disabled={uploading}>
                  {uploading ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL HISTORIQUE EMPLOYÉ ═══ */}
        {showEmployeeHistory && (
          <div style={S.overlay} onClick={() => setShowEmployeeHistory(null)}>
            <div style={{ ...S.modal, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <h2 style={S.modalTitleText}>📋 {showEmployeeHistory.first_name} {showEmployeeHistory.last_name}</h2>
                <button onClick={() => setShowEmployeeHistory(null)} style={S.closeBtnModal}><X size={20} /></button>
              </div>
              <div style={S.histStats}>
                <div style={S.histTotalBox}>
                  <span style={S.histTotalNum}>{employeeHistory.totalJours}</span>
                  <span style={S.histTotalLabel}>jours décomptés</span>
                </div>
                <div style={S.histBreakdown}>
                  {MOTIFS.map(m => {
                    const j = employeeHistory.stats[m.id] || 0
                    if (j === 0) return null
                    return (
                      <div key={m.id} style={S.histMotifRow}>
                        <span>{m.emoji}</span>
                        <span style={{ color: '#ccc', flex: 1, fontSize: 13 }}>{m.label}</span>
                        <span style={{ color: m.color, fontWeight: 700 }}>{j}j</span>
                      </div>
                    )
                  })}
                  {employeeHistory.totalJours === 0 && <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 13, margin: 0 }}>Aucune absence</p>}
                </div>
              </div>
              <div style={S.histList}>
                {employeeHistory.absences.map(a => {
                  const mc = getMotifConfig(a.reason)
                  const conflict = getConflictForAbsence(a.id)
                  const jours = a.count_holidays_as_leave
                    ? countCalendarDays(a.start_date, a.end_date)
                    : HolidayService.countWorkingDays(a.start_date, a.end_date, getHolidaySet(a.enterprise_id), true)
                  return (
                    <div key={a.id} style={S.histItem}>
                      <div style={{ ...S.histDot, background: mc.color }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>{mc.emoji} {mc.label}</span>
                          <span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700 }}>{jours}j</span>
                        </div>
                        <span style={{ color: 'rgba(245,242,235,0.55)', fontSize: 12 }}>{formatDateFr(a.start_date)} → {formatDateFr(a.end_date)}</span>
                        {a.count_holidays_as_leave && <span style={{ display: 'block', color: '#8B5CF6', fontSize: 11, marginTop: 2 }}>🎌 Jours fériés inclus dans le décompte</span>}
                        {conflict && conflict.status === 'pending' && <span style={{ display: 'block', color: '#F97316', fontSize: 11, marginTop: 2 }}>⚠ Conflit en attente</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL GESTION CONFLIT ═══ */}
        {showConflictModal && selectedConflictData && (
          <div style={S.overlay} onClick={() => setShowConflictModal(false)}>
            <div style={{ background: '#1D1713', border: '1px solid rgba(249,115,22,.2)', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.5)', animation: 'slideUp .3s ease forwards' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(249,115,22,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={24} color="#F97316" />
                  </div>
                  <div>
                    <h2 style={{ color: '#FFF', fontSize: 20, fontWeight: 700, margin: 0 }}>Gérer le conflit</h2>
                    <p style={{ color: '#F97316', fontSize: 13, margin: '4px 0 0 0' }}>
                      {selectedConflictData.absence.employees?.first_name} {selectedConflictData.absence.employees?.last_name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowConflictModal(false)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(245,242,235,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
                  {[
                    { label: 'Employé', value: `${selectedConflictData.absence.employees?.first_name} ${selectedConflictData.absence.employees?.last_name}` },
                    { label: 'Motif absence', value: getMotifConfig(selectedConflictData.absence.reason).label },
                    { label: 'Période', value: `${formatDateFr(selectedConflictData.absence.start_date)} → ${formatDateFr(selectedConflictData.absence.end_date)}` }
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 14 }}>
                      <span style={{ display: 'block', color: '#666', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{item.label}</span>
                      <span style={{ display: 'block', color: '#FFF', fontSize: 13, fontWeight: 600 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#F5F2EB', fontSize: 13, fontWeight: 500 }}>Note de résolution (optionnel)</label>
                  <textarea value={conflictNote} onChange={e => setConflictNote(e.target.value)} style={{ minHeight: 90, resize: 'vertical', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#FFF', fontFamily: 'inherit', fontSize: 14, outline: 'none' }} placeholder="Ex: Retour anticipé validé par le responsable..." />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { action: 'kept_absence', icon: CheckCircle2, color: '#10B981', borderColor: 'rgba(16,185,129,.2)', bg: 'rgba(16,185,129,.08)', title: 'Maintenir l\'absence', subtitle: 'Le pointage reste, l\'absence est conservée' },
                    { action: 'cancelled_absence', icon: ShieldCheck, color: '#6366F1', borderColor: 'rgba(99,102,241,.2)', bg: 'rgba(99,102,241,.08)', title: 'Annuler l\'absence', subtitle: 'Le pointage reste, l\'absence est supprimée' },
                    { action: 'ignored_conflict', icon: Ban, color: '#9CA3AF', borderColor: 'rgba(107,114,128,.2)', bg: 'rgba(107,114,128,.08)', title: 'Ignorer le conflit', subtitle: 'Marquer comme vu sans modifier les données' },
                  ].map((item, i) => (
                    <button key={i} onClick={() => resolveConflict(item.action)} disabled={resolvingConflict} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, border: `1px solid ${item.borderColor}`, background: item.bg, color: item.color, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      <item.icon size={20} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px 0' }}>{item.title}</p>
                        <p style={{ fontSize: 12, opacity: .8, margin: 0 }}>{item.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ VISUALISEUR DOCUMENT ═══ */}
        {viewingDocument && (
          <DocumentViewer
            url={viewingDocument.url}
            employeeName={viewingDocument.employeeName}
            absenceInfo={viewingDocument.absenceInfo}
            onClose={() => setViewingDocument(null)}
          />
        )}

        {/* ═══ MODAL CONFIRMATION SUPPRESSION DEMANDE ═══ */}
        {showDeleteRequestModal && requestToDelete && (
          <div style={S.overlay} onClick={() => setShowDeleteRequestModal(false)}>
            <div style={{ background: '#1D1713', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 24, width: '100%', maxWidth: 440, padding: 36, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease forwards' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 68, height: 68, borderRadius: 18, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trash2 size={32} color="#EF4444" />
              </div>
              <h3 style={{ color: '#FFF', fontSize: 20, fontWeight: 700, margin: '0 0 12px 0' }}>Supprimer cette demande ?</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 16, textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {requestToDelete.employees?.photo_url
                    ? <img src={requestToDelete.employees.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: 13 }}>{requestToDelete.employees?.first_name?.[0]}{requestToDelete.employees?.last_name?.[0]}</span>
                  }
                </div>
                <div>
                  <p style={{ color: '#FFF', fontSize: 14, fontWeight: 600, margin: 0 }}>
                    {requestToDelete.employees?.first_name} {requestToDelete.employees?.last_name}
                  </p>
                  <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 12, margin: '2px 0 0 0' }}>
                    {LEAVE_TYPES[requestToDelete.leave_type]?.emoji} {LEAVE_TYPES[requestToDelete.leave_type]?.label}
                    {' · '}
                    {new Date(requestToDelete.start_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                    {' → '}
                    {new Date(requestToDelete.end_date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                  </p>
                </div>
              </div>
              {requestToDelete.status === 'approuve' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, marginBottom: 20, textAlign: 'left' }}>
                  <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ color: '#F59E0B', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' }}>Suppression en cascade</p>
                    <p style={{ color: '#AAA', fontSize: 12, margin: 0, lineHeight: '1.5' }}>
                      Cette demande a été approuvée. L'absence correspondante dans le registre sera également supprimée.
                    </p>
                  </div>
                </div>
              )}
              {requestToDelete.status !== 'approuve' && (
                <p style={{ color: 'rgba(245,242,235,0.55)', fontSize: 14, marginBottom: 24, lineHeight: '1.5' }}>Cette action est irréversible.</p>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setShowDeleteRequestModal(false); setRequestToDelete(null) }} style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F5F2EB', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
                <button onClick={executeDeleteRequest} style={{ flex: 1, padding: 14, background: 'linear-gradient(135deg, #EF4444, #B91C1C)', color: '#FFF', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Trash2 size={16} />
                  {requestToDelete.status === 'approuve' ? 'Supprimer tout' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
    </MotifsAbsenceProvider>
  )
}

// ═══════════════════════════════════════════════════════════
// STYLES ONGLETS
// ═══════════════════════════════════════════════════════════
const TAB = {
    container: { 
    display: 'flex', 
    gap: '4px', 
    padding: '4px', 
    background: 'var(--abs-bg-panel)', 
    borderRadius: '14px', 
    border: '1px solid rgba(255,255,255,0.06)', 
    marginBottom: '20px', 
    width: '100%', // ✅ Au lieu de 'fit-content'
    maxWidth: 'fit-content',
    overflowX: 'auto', // ✅ Scroll horizontal si nécessaire
    scrollbarWidth: 'none', // Firefox
  },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--abs-text-soft)', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' },
  tabActive: { background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontWeight: '600' },
  badge: { padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', transition: 'all 0.2s ease' },
}

// ═══════════════════════════════════════════════════════════
// STYLES CARTE (CS)
// ═══════════════════════════════════════════════════════════
const CS = {
  card: { background: 'rgba(29,23,19,.85)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, transition: 'all .3s ease' },
  topBadges: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  badge: { padding: '3px 8px', borderRadius: 16, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' },
  employeeInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  empDetails: { minWidth: 0 },
  empName: { color: '#FFF', fontSize: 14, fontWeight: 600, margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  empMatricule: { color: 'rgba(245,242,235,0.55)', fontSize: 11 },
  reasonBadge: { padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  reasonEmoji: { fontSize: 12 },
  reasonLabel: { textTransform: 'uppercase', letterSpacing: .3 },
  datesRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.02)', padding: 12, borderRadius: 10, gap: 8 },
  dateBox: { display: 'flex', flexDirection: 'column', gap: 2 },
  dateLabel: { color: '#666', fontSize: 9, textTransform: 'uppercase', letterSpacing: .5 },
  dateValue: { color: '#F5F2EB', fontSize: 12, fontWeight: 500 },
  daysBadge: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, padding: '6px 14px', minWidth: 50 },
  daysNumber: { color: '#F59E0B', fontSize: 18, fontWeight: 800, lineHeight: '1' },
  daysLabel: { color: '#F59E0B', fontSize: 9, opacity: .8 },
  notesBox: { display: 'flex', gap: 8, padding: 10, background: 'rgba(255,255,255,.02)', borderRadius: 8, borderLeft: '2px solid rgba(245,158,11,.3)' },
  notesText: { color: '#aaa', fontSize: 12, lineHeight: 1.4, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  docButton: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 10, color: '#3B82F6', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.04)', gap: 8 },
  footerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  enterpriseTag: { color: '#F59E0B', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  footerActions: { display: 'flex', gap: 5, flexShrink: 0 },
  approveBtn: { background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', padding: 6, borderRadius: 7, color: '#10B981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  refuseBtn: { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', padding: 6, borderRadius: 7, color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  editBtn: { background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', padding: 6, borderRadius: 7, color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', padding: 6, borderRadius: 7, color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  conflictBtn: { background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.25)', padding: 7, borderRadius: 8, color: '#F97316', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}

// ═══════════════════════════════════════════════════════════
// STYLES PRINCIPAUX (S)
// ═══════════════════════════════════════════════════════════
const S = {
  container: { minHeight: '100vh', background: '#15110E' },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#15110E', gap: 16 },
  loadingText: { color: 'rgba(245,242,235,0.55)', marginTop: 20 },
  main: { padding: 20, maxWidth: 1200, margin: '0 auto' },
  statsGrid: { 
    display: 'grid', 
     gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', // ✅ Au lieu de repeat(6, 1fr)
    gap: 14, 
    marginBottom: 24 
  },
  statCard: { background: 'rgba(29,23,19,.8)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16, transition: 'all .3s ease', minWidth: 0, },
  statIcon: { width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statNumber: { color: '#FFF', fontSize: 26, fontWeight: 800, margin: '0 0 2px 0', lineHeight: '1' },
  statLabel: { color: 'rgba(245,242,235,0.55)', fontSize: 12, margin: 0, whiteSpace: 'nowrap',  textOverflow: 'ellipsis', // ✅ AJOUT : Coupe le texte avec ...
    maxWidth: '100%',},
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 300px', flexWrap: 'wrap' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(29,23,19,.8)', border: '1px solid rgba(255,255,255,.08)', padding: '10px 16px', borderRadius: 12, flex: '1 1 220px', minWidth: 200 },
  searchInput: { background: 'transparent', border: 'none', color: '#F5F2EB', width: '100%', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  clearSearch: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 2, display: 'flex' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(29,23,19,.8)', border: '1px solid rgba(255,255,255,.06)', padding: '10px 16px', borderRadius: 12, flex: '0 1 250px' },
  filterSelect: { background: 'transparent', border: 'none', color: '#F5F2EB', width: '100%', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  iconBtn: { border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s' },
  viewToggle: { display: 'flex', background: 'rgba(29,23,19,.8)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' },
  viewBtn: { background: 'transparent', border: 'none', color: '#666', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' },
  viewBtnActive: { background: 'rgba(245,158,11,.15)', color: '#F59E0B' },
  exportBtn: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#F5F2EB', padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13, fontFamily: 'inherit' },
  addBtn: { background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', border: 'none', padding: '12px 20px', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', transition: 'all .3s ease' },
  filtersPanel: { display: 'flex', flexWrap: 'wrap', gap: 14, background: 'rgba(29,23,19,.6)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'flex-end', animation: 'slideUp .3s ease forwards' },
  filterItem: { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 160px', minWidth: 140 },
  filterLabel: { color: 'rgba(245,242,235,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 },
  filterSelectSmall: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', color: '#F5F2EB', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' },
  resetBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#EF4444', padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-end' },
  resultCount: { marginBottom: 16, paddingLeft: 4 },
  resultText: { color: '#F5F2EB', fontSize: 14, fontWeight: 500 },
  list: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', // ✅ Responsive
    gap: 16 
  },

  empty: { gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', background: 'rgba(29,23,19,.5)', borderRadius: 20, border: '1px dashed rgba(255,255,255,.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: 600, margin: 0 },
  emptySubtitle: { color: 'rgba(245,242,235,0.55)', fontSize: 14, margin: 0 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32, paddingBottom: 20 },
  pageBtn: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#F5F2EB', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' },
  calContainer: { background: 'rgba(29,23,19,.8)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 20, padding: 24, animation: 'slideUp .4s ease forwards' },
  calHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  calTitle: { color: '#FFF', fontSize: 22, fontWeight: 700, margin: 0, textTransform: 'capitalize' },
  calNavBtn: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F2EB', cursor: 'pointer' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 },
  calDayHeader: { textAlign: 'center', color: 'rgba(245,242,235,0.55)', fontSize: 12, fontWeight: 600, padding: '10px 0' },
  calDay: { minHeight: 110, background: 'rgba(255,255,255,.02)', borderRadius: 10, padding: 8, border: '1px solid transparent', display: 'flex', flexDirection: 'column', gap: 4 },
  calDayEmpty: { minHeight: 110 },
  calDayWeekend: { background: 'rgba(255,255,255,.01)', opacity: .6 },
  calDayToday: { border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.05)' },
  calDayHasAbs: { background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)' },
  calDaySelected: { background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.5)', boxShadow: '0 0 20px rgba(245,158,11,.15)' },
  calDayTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  calDayNum: { color: '#F5F2EB', fontSize: 13, fontWeight: 600 },
  calAbsCount: { background: 'rgba(239,68,68,.2)', color: '#EF4444', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' },
  calEmpList: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2, overflow: 'hidden' },
  calEmpItem: { display: 'flex', alignItems: 'center', gap: 4 },
  calEmpDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  calEmpName: { color: '#ccc', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  calMore: { color: 'rgba(245,242,235,0.55)', fontSize: 9, fontStyle: 'italic', paddingLeft: 10 },
  calDetail: { marginTop: 20, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 16, padding: 20, animation: 'slideUp .3s ease forwards' },
  calDetailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 },
  calDetailTitle: { color: '#FFF', fontSize: 16, fontWeight: 600, margin: 0, textTransform: 'capitalize' },
  calDetailCount: { background: 'rgba(239,68,68,.15)', color: '#EF4444', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  calDetailClose: { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,242,235,0.55)', cursor: 'pointer' },
  calDetailList: { display: 'flex', flexDirection: 'column', gap: 10 },
  calDetailItem: { display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap' },
  calDetailName: { color: '#FFF', fontSize: 15, fontWeight: 600, margin: '0 0 4px 0' },
  calDetailMeta: { color: 'rgba(245,242,235,0.55)', fontSize: 12, margin: 0 },
  calDetailBadge: { padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' },
  calLegend: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' },
  calLegendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  calLegendDot: { width: 10, height: 10, borderRadius: '50%' },
  calLegendLabel: { color: 'rgba(245,242,235,0.55)', fontSize: 12 },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, animation: 'fadeIn .2s ease' },
  modal: { background: '#1D1713', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, width: '100%', maxWidth: 540, padding: 28, boxShadow: '0 25px 70px rgba(0,0,0,.6)', maxHeight: '90vh', overflowY: 'auto', animation: 'slideUp .3s ease forwards' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitleText: { color: '#FFF', fontSize: 20, fontWeight: 700, margin: 0 },
  closeBtnModal: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,242,235,0.55)', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  formRow: { display: 'flex', gap: 14 },
  input: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', color: '#FFF', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  daysCounter: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 12, flexWrap: 'wrap' },
  overlapBox: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12 },
  overlapTitle: { color: '#F59E0B', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' },
  overlapText: { color: '#ccc', fontSize: 12, margin: 0, lineHeight: '1.4' },
  reasonGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 },
  modalFooter: { display: 'flex', gap: 12, marginTop: 8 },
  saveBtn: { flex: 2, padding: 14, background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', border: 'none', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 },
  histStats: { display: 'flex', gap: 20, marginBottom: 24, padding: 20, background: 'rgba(255,255,255,.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)' },
  histTotalBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 90, borderRight: '1px solid rgba(255,255,255,.06)', paddingRight: 20 },
  histTotalNum: { color: '#F59E0B', fontSize: 36, fontWeight: 800, lineHeight: '1' },
  histTotalLabel: { color: 'rgba(245,242,235,0.55)', fontSize: 12, marginTop: 4 },
  histBreakdown: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  histMotifRow: { display: 'flex', alignItems: 'center', gap: 8 },
  histList: { maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  histItem: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(255,255,255,.02)', borderRadius: 10 },
    histDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  emptyMini: {
    minHeight: 90,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#777',
    fontSize: 13,
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: 14,
    marginTop: 8,
    padding: 16,
  },
}