// src/pages/FichesPaie.jsx
// ═══════════════════════════════════════════════════════════
// 💰 PAGE FICHES DE PAIE V5
// Améliorations : 2 signataires, cachet/tampon, infos entreprise
// enrichies, logo, cumuls annuels, solde congés, net imposable,
// mention légale, jours ouvrables
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import FeatureService, { FEATURES } from '../services/featureService'
import PayrollService from '../services/payrollService'
import TaxationService from '../services/taxationService'
import * as XLSX from 'xlsx'
import LeaveBalanceService from '../services/leaveBalanceService'
import {
  ArrowLeft, ArrowRight, Wallet, Settings, Users, Eye, Save,
  RefreshCw, Building2, Calendar, DollarSign, Briefcase, Upload,
  CheckCircle, AlertTriangle, Download, FileSpreadsheet, Trash2,
  HelpCircle, Info, Send, CheckCircle2, FileText, Shield, X,
  Plus, Edit, CreditCard, Smartphone, Landmark, Clock, TrendingUp,
  Gift, Minus, AlertCircle, ChevronDown, ChevronUp, Layers,
  PenTool, Image, RotateCcw, Search, Copy, History, Table,
  Filter, Stamp, Award, MapPin, Phone, Mail, Globe, Hash
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// COMPOSANT SIGNATURE PAD
// ═══════════════════════════════════════════════════════════

function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.beginPath()
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(30, rect.height - 40)
    ctx.lineTo(rect.width - 30, rect.height - 40)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
  }, [])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDrawing = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); setIsDrawing(true); setHasDrawn(true) }
  const draw = (e) => { e.preventDefault(); if (!isDrawing) return; const ctx = canvasRef.current.getContext('2d'); const pos = getPos(e); ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; ctx.lineTo(pos.x, pos.y); ctx.stroke() }
  const stopDrawing = (e) => { if (e) e.preventDefault(); setIsDrawing(false) }

  const clearCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.beginPath(); ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.moveTo(30, rect.height - 40); ctx.lineTo(rect.width - 30, rect.height - 40); ctx.stroke()
    ctx.setLineDash([]); ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; setHasDrawn(false)
  }

  const handleSave = () => { if (!hasDrawn) { toast.error('Veuillez dessiner votre signature'); return }; onSave(canvasRef.current.toDataURL('image/png')) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(245,158,11,0.25)', background: '#FFF' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 200, cursor: 'crosshair', touchAction: 'none', display: 'block' }}
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
        <div style={{ position: 'absolute', bottom: 8, left: 12, color: '#BBB', fontSize: 10, fontStyle: 'italic', pointerEvents: 'none' }}>Dessinez votre signature ici</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={clearCanvas} style={S.sigClearBtn}><RotateCcw size={14} /><span>Effacer</span></button>
        {onCancel && <button onClick={onCancel} style={S.sigCancelBtn}><X size={14} /><span>Annuler</span></button>}
        <button onClick={handleSave} style={S.sigSaveBtn}><CheckCircle size={14} /><span>Valider</span></button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GESTIONNAIRE DE SIGNATURE UNIQUE (pour 1 signataire)
// ═══════════════════════════════════════════════════════════

function SingleSignatureManager({ label, signature, onSignatureChange, sigName, onSigNameChange, sigTitle, onSigTitleChange, enterpriseId, color = '#F59E0B' }) {
  const [mode, setMode] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const uploadToStorage = async (base64Data) => {
    if (!enterpriseId) return base64Data
    setUploading(true)
    try {
      const response = await fetch(base64Data)
      const blob = await response.blob()
      const fileName = `signatures/${enterpriseId}/sig_${Date.now()}.png`
      if (signature && signature.startsWith('http')) {
        try { const oldPath = signature.split('/storage/v1/object/public/payroll-assets/')[1]; if (oldPath) await supabase.storage.from('payroll-assets').remove([oldPath]) } catch (e) { console.warn(e) }
      }
      const { data, error } = await supabase.storage.from('payroll-assets').upload(fileName, blob, { contentType: 'image/png', upsert: true })
      if (error) { console.warn('Storage non disponible, utilisation base64:', error); setUploading(false); return base64Data }
      const { data: publicData } = supabase.storage.from('payroll-assets').getPublicUrl(fileName)
      setUploading(false)
      return publicData?.publicUrl || base64Data
    } catch (err) { console.warn('Erreur upload storage, fallback base64:', err); setUploading(false); return base64Data }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { toast.error('Format non supporté. Utilisez PNG, JPG ou WebP.'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 2 Mo)'); return }
    const reader = new FileReader()
    reader.onload = async (e) => { const url = await uploadToStorage(e.target.result); onSignatureChange(url); setMode(null); toast.success('Signature importée') }
    reader.onerror = () => toast.error('Erreur de lecture du fichier')
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrawSave = async (dataURL) => { const url = await uploadToStorage(dataURL); onSignatureChange(url); setMode(null); toast.success('Signature enregistrée') }

  const handleRemove = async () => {
    if (signature && signature.startsWith('http')) {
      try { const path = signature.split('/storage/v1/object/public/payroll-assets/')[1]; if (path) await supabase.storage.from('payroll-assets').remove([path]) } catch (e) { console.warn(e) }
    }
    onSignatureChange(''); toast.success('Signature supprimée')
  }

  return (
    <div style={{ padding: 14, borderRadius: 14, background: `${color}08`, border: `1px solid ${color}18` }}>
      <p style={{ color: '#DDD', fontSize: 13, fontWeight: 700, margin: '0 0 10px 0' }}>{label}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={S.labelSmall}>Nom</label>
          <input value={sigName || ''} onChange={e => onSigNameChange(e.target.value)} style={S.input} placeholder="Ex: Jean Dupont" />
        </div>
        <div>
          <label style={S.labelSmall}>Titre / Fonction</label>
          <input value={sigTitle || ''} onChange={e => onSigTitleChange(e.target.value)} style={S.input} placeholder="Ex: Directeur RH" />
        </div>
      </div>

      {signature && !mode && (
        <div style={{ marginBottom: 12 }}>
          <div style={S.signaturePreview}>
            <img src={signature} alt="Signature" style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain' }} />
            {sigName && <p style={{ color: '#374151', fontSize: 11, fontWeight: 600, margin: '6px 0 0 0', borderTop: '1px solid #E5E7EB', paddingTop: 6 }}>{sigName}</p>}
            {sigTitle && <p style={{ color: '#6B7280', fontSize: 10, margin: '2px 0 0 0' }}>{sigTitle}</p>}
          </div>
        </div>
      )}

      {!mode && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('draw')} style={{ ...S.sigActionBtn, borderColor: `${color}30`, background: `${color}15`, color }} disabled={uploading}>
            <PenTool size={14} /><span>{signature ? 'Redessiner' : 'Dessiner'}</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...S.sigActionBtn, borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.1)', color: '#818CF8' }} disabled={uploading}>
            <Image size={14} /><span>{signature ? 'Remplacer' : 'Importer'}</span>
          </button>
          {signature && (
            <button onClick={handleRemove} style={{ ...S.sigActionBtn, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} disabled={uploading}>
              <Trash2 size={14} /><span>Supprimer</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      )}

      {uploading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><RefreshCw size={14} color={color} style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ color, fontSize: 12 }}>Upload en cours...</span></div>}
      {mode === 'draw' && <div style={{ marginTop: 8 }}><SignaturePad onSave={handleDrawSave} onCancel={() => setMode(null)} /></div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GESTIONNAIRE CACHET / TAMPON
// ═══════════════════════════════════════════════════════════

function StampManager({ stamp, onStampChange, enterpriseId }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleImport = async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { toast.error('Format non supporté.'); return }
    if (file.size > 3 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 3 Mo)'); return }
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result
        if (enterpriseId) {
          try {
            const response = await fetch(base64); const blob = await response.blob()
            const fileName = `stamps/${enterpriseId}/stamp_${Date.now()}.png`
            const { error } = await supabase.storage.from('payroll-assets').upload(fileName, blob, { contentType: 'image/png', upsert: true })
            if (!error) {
              const { data: publicData } = supabase.storage.from('payroll-assets').getPublicUrl(fileName)
              onStampChange(publicData?.publicUrl || base64); setUploading(false); toast.success('Cachet importé'); return
            }
          } catch (err) { console.warn('Storage non disponible:', err) }
        }
        onStampChange(base64); setUploading(false); toast.success('Cachet importé')
      }
      reader.readAsDataURL(file)
    } catch { toast.error('Erreur import'); setUploading(false) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = () => { onStampChange(''); toast.success('Cachet supprimé') }

  return (
    <div style={{ padding: 14, borderRadius: 14, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ ...S.cardIcon, background: 'rgba(139,92,246,0.12)' }}><Stamp size={18} color="#8B5CF6" /></div>
        <div>
          <p style={{ color: '#FFF', fontSize: 13, fontWeight: 700, margin: 0 }}>Cachet / Tampon de l'entreprise</p>
          <p style={{ color: '#777', fontSize: 11, margin: '2px 0 0 0' }}>Image PNG avec fond transparent recommandé</p>
        </div>
      </div>

      {stamp && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...S.signaturePreview, padding: 20 }}>
            <img src={stamp} alt="Cachet" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ ...S.sigActionBtn, borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.1)', color: '#A78BFA' }} disabled={uploading}>
          <Image size={14} /><span>{stamp ? 'Remplacer le cachet' : 'Importer un cachet'}</span>
        </button>
        {stamp && (
          <button onClick={handleRemove} style={{ ...S.sigActionBtn, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            <Trash2 size={14} /><span>Supprimer</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImport} style={{ display: 'none' }} />
      </div>

      {uploading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><RefreshCw size={14} color="#8B5CF6" style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ color: '#8B5CF6', fontSize: 12 }}>Upload en cours...</span></div>}

      <div style={S.signatureInfo}>
        <Info size={13} color="#666" style={{ flexShrink: 0 }} />
        <span style={{ color: '#666', fontSize: 11, lineHeight: 1.5 }}>Formats : PNG, JPG, WebP (max 3 Mo). Le cachet apparaîtra entre les signatures sur le bulletin.</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// COMPOSANTS UTILITAIRES
// ═══════════════════════════════════════════════════════════

function FieldHelp({ text, example }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <HelpCircle size={14} color="#666" style={{ cursor: 'pointer', marginLeft: 6, flexShrink: 0 }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} />
      {show && (
        <div style={S.tooltip}>
          <p style={{ color: '#DDD', fontSize: 12, margin: '0 0 6px 0', lineHeight: 1.5 }}>{text}</p>
          {example && <div style={S.tooltipExample}><span style={{ color: '#888', fontSize: 10, display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>Exemple</span><span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 600 }}>{example}</span></div>}
          <div style={S.tooltipArrow} />
        </div>
      )}
    </span>
  )
}

function FormLabel({ children, help, example, required }) {
  return <label style={S.labelSmall}>{children}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}{help && <FieldHelp text={help} example={example} />}</label>
}

function Badge({ children, color = '#F59E0B' }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}20`, border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>{children}</span>
}

function CategoryBadge({ category }) {
  const config = { transport: { label: 'Transport', color: '#3B82F6' }, housing: { label: 'Logement', color: '#8B5CF6' }, food: { label: 'Repas', color: '#F59E0B' }, seniority: { label: 'Ancienneté', color: '#10B981' }, responsibility: { label: 'Responsabilité', color: '#6366F1' }, performance: { label: 'Performance', color: '#EC4899' }, exceptional: { label: 'Exceptionnel', color: '#EF4444' }, representation: { label: 'Représentation', color: '#14B8A6' }, advance: { label: 'Avance', color: '#F97316' }, loan: { label: 'Prêt', color: '#EF4444' }, discipline: { label: 'Discipline', color: '#DC2626' }, garnishment: { label: 'Saisie', color: '#991B1B' }, voluntary: { label: 'Volontaire', color: '#059669' }, reimbursement: { label: 'Remboursement', color: '#D97706' }, other: { label: 'Autre', color: '#6B7280' } }
  const c = config[category] || config.other
  return <Badge color={c.color}>{c.label}</Badge>
}

function SearchBar({ value, onChange, placeholder = 'Rechercher...' }) {
  return (
    <div style={S.searchWrap}>
      <Search size={16} color="#666" style={{ flexShrink: 0 }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={S.searchInput} />
      {value && <button onClick={() => onChange('')} style={S.searchClear}><X size={14} /></button>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════

export default function FichesPaie() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('settings')

  const [enterpriseId, setEnterpriseId] = useState(null)
  const [enterpriseName, setEnterpriseName] = useState('')
  const [enterpriseData, setEnterpriseData] = useState(null)
  const [enterprisesList, setEnterprisesList] = useState([])

  const [employees, setEmployees] = useState([])
  const [profiles, setProfiles] = useState([])
  const [settings, setSettings] = useState(PayrollService.getDefaultPayrollSettings())
  const [overtimeSettings, setOvertimeSettings] = useState(null)

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const [searchProfile, setSearchProfile] = useState('')
  const [searchPreview, setSearchPreview] = useState('')
  const [searchAllowance, setSearchAllowance] = useState('')

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [profileForm, setProfileForm] = useState({
    employee_id: '', salary_type: 'monthly', base_salary: '', hourly_rate: '', daily_rate: '',
    transport_allowance: '', housing_allowance: '', fixed_bonus: '', fixed_deduction: '',
    contract_hours_per_month: '', contract_days_per_month: '', min_guaranteed_hours: '',
    overtime_eligible: true, payment_method: '', bank_name: '', bank_account: '',
    iban: '', bic_swift: '', mobile_money_provider: '', mobile_money_number: '',
    payment_frequency: 'monthly', preferred_payment_day: 28,
  })

  const [showCopyProfileModal, setShowCopyProfileModal] = useState(false)
  const [copySourceEmployeeId, setCopySourceEmployeeId] = useState('')

  const [allowanceTypes, setAllowanceTypes] = useState([])
  const [deductionTypes, setDeductionTypes] = useState([])
  const [selectedEmployeeAllowances, setSelectedEmployeeAllowances] = useState([])
  const [selectedEmployeeDeductions, setSelectedEmployeeDeductions] = useState([])
  const [periodBonuses, setPeriodBonuses] = useState([])
  const [periodDeductions, setPeriodDeductions] = useState([])

  const [showAllowanceModal, setShowAllowanceModal] = useState(false)
  const [showDeductionModal, setShowDeductionModal] = useState(false)
  const [showBonusModal, setShowBonusModal] = useState(false)
  const [showPeriodDeductionModal, setShowPeriodDeductionModal] = useState(false)
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [editingAllowance, setEditingAllowance] = useState(null)
  const [editingDeduction, setEditingDeduction] = useState(null)
  const [selectedBonusEmployeeId, setSelectedBonusEmployeeId] = useState('')
  const [selectedDeductionEmployeeId, setSelectedDeductionEmployeeId] = useState('')

  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)

  const [previewRows, setPreviewRows] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [importFileName, setImportFileName] = useState('')
  const [importPreviewRows, setImportPreviewRows] = useState([])
  const [importColumns, setImportColumns] = useState([])
  const [importingFile, setImportingFile] = useState(false)
  const [savingImport, setSavingImport] = useState(false)

  const [sendingSlips, setSendingSlips] = useState(false)
  const [sentSlips, setSentSlips] = useState(new Set())

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [slipToDelete, setSlipToDelete] = useState(null)
  const [deletingSlip, setDeletingSlip] = useState(false)

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyPeriods, setHistoryPeriods] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Cumuls annuels
  const [annualCumuls, setAnnualCumuls] = useState({})
  const [loadingCumuls, setLoadingCumuls] = useState(false)

  // Solde congés
  const [leaveBalances, setLeaveBalances] = useState({})

  const navigate = useNavigate()


  const socialOrgLabel = settings.hide_social_label
    ? ''
    : (settings.company_social_label?.trim() || 'Organisme social')

  // ═══════════════════════════════════════════════════════════
  // INITIALISATION
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    initPage(parsedAdmin)
  }, [navigate])

  const loadEnterpriseContext = async (targetEnterpriseId, adminId, start, end) => {
    const { data: enterprise } = await supabase.from('enterprises').select('id, name, address, email, phone, logo_url, country_code, currency').eq('id', targetEnterpriseId).single()
    setEnterpriseId(targetEnterpriseId)
    setEnterpriseName(enterprise?.name || 'Entreprise')
    setEnterpriseData(enterprise)
    setPreviewRows([])

    const [employeesRes, loadedSettings, loadedProfiles, loadedOvertimeSettings, loadedAllowanceTypes, loadedDeductionTypes] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, matricule, department, position, is_active, hire_date, cnps_number, professional_category, echelon, classification, contract_type, marital_status, dependents_count').eq('enterprise_id', targetEnterpriseId).eq('is_active', true).order('last_name'),
      PayrollService.getPayrollSettings(targetEnterpriseId),
      PayrollService.getEmployeePayrollProfiles(targetEnterpriseId),
      FeatureService.getOvertimeSettings(targetEnterpriseId),
      PayrollService.getAllowanceTypes(targetEnterpriseId),
      PayrollService.getDeductionTypes(targetEnterpriseId),
    ])

    const employeesData = employeesRes.data || []
    setEmployees(employeesData)
    setProfiles(loadedProfiles || [])

    const enrichedSettings = {
      ...loadedSettings,
      company_rccm: loadedSettings.company_rccm || '',
      company_nif: loadedSettings.company_nif || '',
      company_cnps_number: loadedSettings.company_cnps_number || '',
      company_collective_agreement: loadedSettings.company_collective_agreement || '',
      legal_mention: loadedSettings.legal_mention || 'Ce bulletin de paie doit être conservé sans limitation de durée. Il peut servir de justificatif pour faire valoir vos droits.',
      signatory1_name: loadedSettings.signatory1_name || loadedSettings.signature_name || '',
      signatory1_title: loadedSettings.signatory1_title || '',
      signatory1_signature: loadedSettings.signatory1_signature || loadedSettings.signature_image || '',
      signatory2_name: loadedSettings.signatory2_name || '',
      signatory2_title: loadedSettings.signatory2_title || '',
      signatory2_signature: loadedSettings.signatory2_signature || '',
      company_stamp: loadedSettings.company_stamp || '',
    }
    setSettings(enrichedSettings)
    setOvertimeSettings(loadedOvertimeSettings)
    setAllowanceTypes(loadedAllowanceTypes)
    setDeductionTypes(loadedDeductionTypes)

    await loadSentSlips(targetEnterpriseId, start, end)

    if (employeesData.length > 0) {
      setSelectedEmployeeId(employeesData[0].id)
      setProfileForm(prev => ({ ...prev, employee_id: employeesData[0].id }))
    } else {
      setSelectedEmployeeId('')
    }

    if (loadedAllowanceTypes.length === 0 || loadedDeductionTypes.length === 0) {
      await PayrollService.initializeTypesFromTemplates(targetEnterpriseId, adminId)
      const [freshAllowances, freshDeductions] = await Promise.all([
        PayrollService.getAllowanceTypes(targetEnterpriseId),
        PayrollService.getDeductionTypes(targetEnterpriseId),
      ])
      setAllowanceTypes(freshAllowances)
      setDeductionTypes(freshDeductions)
    }

    await loadLeaveBalances(targetEnterpriseId, employeesData, new Date().getFullYear())
  }

  const initPage = async (adminData) => {
    setLoading(true)
    try {
      const isSuperAdmin = adminData.role === 'super_admin'
      let targetEnterpriseId = adminData.selectedEnterprise?.id || adminData.enterprise_id

      if (isSuperAdmin) {
        const { data: allEnts } = await supabase
          .from('enterprises')
          .select('id, name, code, logo_url, country_code, currency')
          .eq('is_active', true)
          .order('name')
        const list = allEnts || []
        setEnterprisesList(list)

        if (!targetEnterpriseId && list.length > 0) {
          const lastId =
            (adminData.id && localStorage.getItem(`last_enterprise_id_${adminData.id}`)) ||
            localStorage.getItem('last_enterprise_id')
          const picked = (lastId && list.find(e => e.id === lastId)) || list[0]
          targetEnterpriseId = picked.id
          const updatedAdmin = { ...adminData, entreprises: list, selectedEnterprise: picked }
          setAdmin(updatedAdmin)
          localStorage.setItem('admin', JSON.stringify(updatedAdmin))
          localStorage.setItem('last_enterprise_id', picked.id)
        }
      } else if (Array.isArray(adminData.entreprises) && adminData.entreprises.length > 1) {
        setEnterprisesList(adminData.entreprises)
      }

      if (!targetEnterpriseId) { toast.error('Aucune entreprise sélectionnée'); navigate('/dashboard'); return }

      if (!isSuperAdmin) {
        const hasAccess = await FeatureService.hasFeature(targetEnterpriseId, FEATURES.FICHES_PAIE)
        if (!hasAccess) { toast.error('Module fiches de paie non activé'); navigate('/dashboard'); return }
      }

      const today = new Date()
      const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
      const start = firstDay.toISOString().split('T')[0]
      const end = lastDay.toISOString().split('T')[0]
      setPeriodStart(start)
      setPeriodEnd(end)

      await loadEnterpriseContext(targetEnterpriseId, adminData.id, start, end)
    } catch (err) { console.error(err); toast.error('Erreur chargement module paie'); navigate('/dashboard') }
    setLoading(false)
  }

  const handleEnterpriseSelectChange = async (newEntId) => {
    if (!newEntId || newEntId === enterpriseId) return
    setLoading(true)
    try {
      const chosen = enterprisesList.find(e => e.id === newEntId)
      if (chosen && admin) {
        const updatedAdmin = { ...admin, selectedEnterprise: chosen }
        setAdmin(updatedAdmin)
        localStorage.setItem('admin', JSON.stringify(updatedAdmin))
        localStorage.setItem('last_enterprise_id', chosen.id)
        if (admin.id) localStorage.setItem(`last_enterprise_id_${admin.id}`, chosen.id)
      }
      await loadEnterpriseContext(newEntId, admin?.id, periodStart, periodEnd)
      toast.success(`Entreprise chargée : ${chosen?.name || ''}`)
    } catch (err) {
      console.error('Erreur changement entreprise:', err)
      toast.error('Impossible de charger cette entreprise')
    }
    setLoading(false)
  }

  const loadSentSlips = async (entId, pStart, pEnd) => {
    try {
      const { data } = await supabase.from('employee_payslips').select('employee_id').eq('enterprise_id', entId).eq('period_start', pStart).eq('period_end', pEnd).or('is_deleted.is.null,is_deleted.eq.false')
      setSentSlips(new Set((data || []).map(d => d.employee_id)))
    } catch (err) { console.error('Erreur chargement fiches envoyées:', err) }
  }

  // ═══════════════════════════════════════════════════════════
  // CUMULS ANNUELS
  // ═══════════════════════════════════════════════════════════

  const loadAnnualCumuls = async (entId, year) => {
    setLoadingCumuls(true)
    try {
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`
      const { data, error } = await supabase.from('employee_payslips')
        .select('employee_id, gross_salary, net_salary, employee_contributions, employer_contributions, income_tax, total_earnings, total_deductions')
        .eq('enterprise_id', entId)
        .gte('period_start', yearStart).lte('period_end', yearEnd)
        .or('is_deleted.is.null,is_deleted.eq.false')

      if (error) throw error

      const cumuls = {}
        ; (data || []).forEach(slip => {
          if (!cumuls[slip.employee_id]) {
            cumuls[slip.employee_id] = { grossTotal: 0, netTotal: 0, employeeContribTotal: 0, employerContribTotal: 0, taxTotal: 0, earningsTotal: 0, deductionsTotal: 0, slipCount: 0 }
          }
          const c = cumuls[slip.employee_id]
          c.grossTotal += slip.gross_salary || 0
          c.netTotal += slip.net_salary || 0
          c.employeeContribTotal += slip.employee_contributions || 0
          c.employerContribTotal += slip.employer_contributions || 0
          c.taxTotal += slip.income_tax || 0
          c.earningsTotal += slip.total_earnings || 0
          c.deductionsTotal += slip.total_deductions || 0
          c.slipCount++
        })
      setAnnualCumuls(cumuls)
    } catch (err) { console.error('Erreur cumuls:', err) }
    setLoadingCumuls(false)
  }

  // ═══════════════════════════════════════════════════════════
  // SOLDE CONGÉS
  // ═══════════════════════════════════════════════════════════

const loadLeaveBalances = async (entId, employeesList, year) => {
  try {
    const balances = {}
    await Promise.all(
      employeesList.map(async (emp) => {
        const balance = await LeaveBalanceService.getOrCalculateBalance(emp.id, year)
        balances[emp.id] = {
          acquired: balance.total_acquired || 0,
          taken: balance.total_taken || 0,
          remaining: balance.balance || 0,
        }
      })
    )
    setLeaveBalances(balances)
  } catch (err) {
    console.error('Erreur congés:', err)
  }
}


  const loadEmployeeAllowancesAndDeductions = useCallback(async (empId) => {
    if (!enterpriseId || !empId) return
    const [allowances, deductions] = await Promise.all([
      PayrollService.getEmployeeAllowances(enterpriseId, empId),
      PayrollService.getEmployeeDeductions(enterpriseId, empId),
    ])
    setSelectedEmployeeAllowances(allowances)
    setSelectedEmployeeDeductions(deductions)
  }, [enterpriseId])

  const loadPeriodBonusesAndDeductions = useCallback(async () => {
    if (!enterpriseId || !periodStart || !periodEnd) return
    const [bonuses, deductions] = await Promise.all([
      PayrollService.getPayrollBonuses(enterpriseId, periodStart, periodEnd),
      PayrollService.getPayrollDeductions(enterpriseId, periodStart, periodEnd),
    ])
    setPeriodBonuses(bonuses)
    setPeriodDeductions(deductions)
  }, [enterpriseId, periodStart, periodEnd])

  useEffect(() => {
    if (enterpriseId && periodStart && periodEnd) loadPeriodBonusesAndDeductions()
  }, [enterpriseId, periodStart, periodEnd])

  // Après les autres useEffect
  useEffect(() => {
    if (enterpriseId && employees.length > 0 && settings.leave_days_per_month) {
      const year = periodStart ? new Date(periodStart + 'T12:00:00Z').getFullYear() : new Date().getFullYear()
      loadLeaveBalances(enterpriseId, employees, year)
    }
  }, [enterpriseId, employees, settings.leave_days_per_month, settings.annual_leave_cap, periodStart])

  // ═══════════════════════════════════════════════════════════
  // HISTORIQUE DES PÉRIODES
  // ═══════════════════════════════════════════════════════════

  const loadHistory = async () => {
    if (!enterpriseId) return
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase.from('employee_payslips')
        .select('period_start, period_end, employee_id, net_salary, gross_salary, sent_at')
        .eq('enterprise_id', enterpriseId).or('is_deleted.is.null,is_deleted.eq.false')
        .order('period_start', { ascending: false })
      if (error) throw error
      const periodsMap = new Map()
        ; (data || []).forEach(slip => {
          const key = `${slip.period_start}_${slip.period_end}`
          if (!periodsMap.has(key)) periodsMap.set(key, { period_start: slip.period_start, period_end: slip.period_end, count: 0, totalNet: 0, totalGross: 0, lastSent: slip.sent_at })
          const p = periodsMap.get(key); p.count++; p.totalNet += slip.net_salary || 0; p.totalGross += slip.gross_salary || 0
          if (slip.sent_at > p.lastSent) p.lastSent = slip.sent_at
        })
      setHistoryPeriods(Array.from(periodsMap.values()))
    } catch (err) { console.error(err); toast.error('Erreur chargement historique') }
    setLoadingHistory(false)
  }

  const handleSelectHistoryPeriod = (period) => {
    setPeriodStart(period.period_start); setPeriodEnd(period.period_end); setShowHistoryModal(false)
    loadSentSlips(enterpriseId, period.period_start, period.period_end)
    toast.success(`Période ${new Date(period.period_start + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })} sélectionnée`)
  }

  // ═══════════════════════════════════════════════════════════
  // PROFIL EMPLOYÉ
  // ═══════════════════════════════════════════════════════════

  const selectedProfile = useMemo(() => profiles.find(p => p.employee_id === selectedEmployeeId) || null, [profiles, selectedEmployeeId])

  useEffect(() => {
    if (!selectedEmployeeId) return
    if (selectedProfile) {
      setProfileForm({
        employee_id: selectedProfile.employee_id || '', salary_type: selectedProfile.salary_type || 'monthly',
        base_salary: selectedProfile.base_salary ?? '', hourly_rate: selectedProfile.hourly_rate ?? '',
        daily_rate: selectedProfile.daily_rate ?? '', transport_allowance: selectedProfile.transport_allowance ?? '',
        housing_allowance: selectedProfile.housing_allowance ?? '', fixed_bonus: selectedProfile.fixed_bonus ?? '',
        fixed_deduction: selectedProfile.fixed_deduction ?? '', contract_hours_per_month: selectedProfile.contract_hours_per_month ?? '',
        contract_days_per_month: selectedProfile.contract_days_per_month ?? '', min_guaranteed_hours: selectedProfile.min_guaranteed_hours ?? '',
        overtime_eligible: selectedProfile.overtime_eligible ?? true, payment_method: selectedProfile.payment_method || '',
        bank_name: selectedProfile.bank_name || '', bank_account: selectedProfile.bank_account || '',
        iban: selectedProfile.iban || '', bic_swift: selectedProfile.bic_swift || '',
        mobile_money_provider: selectedProfile.mobile_money_provider || '', mobile_money_number: selectedProfile.mobile_money_number || '',
        payment_frequency: selectedProfile.payment_frequency || 'monthly', preferred_payment_day: selectedProfile.preferred_payment_day || 28,
      })
    } else {
      setProfileForm({
        employee_id: selectedEmployeeId, salary_type: 'monthly', base_salary: '', hourly_rate: '', daily_rate: '',
        transport_allowance: '', housing_allowance: '', fixed_bonus: '', fixed_deduction: '',
        contract_hours_per_month: '', contract_days_per_month: '', min_guaranteed_hours: '', overtime_eligible: true,
        payment_method: '', bank_name: '', bank_account: '', iban: '', bic_swift: '',
        mobile_money_provider: '', mobile_money_number: '', payment_frequency: 'monthly', preferred_payment_day: 28,
      })
    }
    loadEmployeeAllowancesAndDeductions(selectedEmployeeId)
  }, [selectedEmployeeId, selectedProfile, loadEmployeeAllowancesAndDeductions])

  // ═══════════════════════════════════════════════════════════
  // COPIE DE PROFIL
  // ═══════════════════════════════════════════════════════════

  const handleCopyProfile = () => {
    const sourceProfile = profiles.find(p => p.employee_id === copySourceEmployeeId)
    if (!sourceProfile) { toast.error('Profil source introuvable'); return }
    setProfileForm({
      employee_id: selectedEmployeeId, salary_type: sourceProfile.salary_type || 'monthly',
      base_salary: sourceProfile.base_salary ?? '', hourly_rate: sourceProfile.hourly_rate ?? '',
      daily_rate: sourceProfile.daily_rate ?? '', transport_allowance: sourceProfile.transport_allowance ?? '',
      housing_allowance: sourceProfile.housing_allowance ?? '', fixed_bonus: sourceProfile.fixed_bonus ?? '',
      fixed_deduction: sourceProfile.fixed_deduction ?? '', contract_hours_per_month: sourceProfile.contract_hours_per_month ?? '',
      contract_days_per_month: sourceProfile.contract_days_per_month ?? '', min_guaranteed_hours: sourceProfile.min_guaranteed_hours ?? '',
      overtime_eligible: sourceProfile.overtime_eligible ?? true, payment_method: sourceProfile.payment_method || '',
      bank_name: '', bank_account: '', iban: '', bic_swift: '', mobile_money_provider: '', mobile_money_number: '',
      payment_frequency: sourceProfile.payment_frequency || 'monthly', preferred_payment_day: sourceProfile.preferred_payment_day || 28,
    })
    setShowCopyProfileModal(false); setCopySourceEmployeeId('')
    toast.success('Profil copié — modifiez si nécessaire puis enregistrez')
  }

  // ═══════════════════════════════════════════════════════════
  // SAUVEGARDE
  // ═══════════════════════════════════════════════════════════

  // ⚠️ LA DEVISE N'A QU'UNE SEULE MAISON : L'ENTREPRISE.
  //   Elle était écrite ici dans `payroll_settings.currency`, mais
  //   `resolveCurrency` lit d'abord `enterprises.currency` : le réglage
  //   saisi sur cette page était donc ignoré en silence. On l'écrit où
  //   il est lu, et on garde la copie de `payroll_settings` alignée
  //   (elle sert de repli si l'entreprise n'en a pas).
  const changerDevise = async (valeur) => {
    const devise = String(valeur || '').toUpperCase().slice(0, 3)
    setSettings(p => ({ ...p, currency: devise }))
    if (!enterpriseId || devise.length < 3) return
    try {
      const { error } = await supabase
        .from('enterprises')
        .update({ currency: devise })
        .eq('id', enterpriseId)
      if (error) throw error
      toast.success(`Devise de l’entreprise : ${devise}`)
    } catch (err) {
      console.error(err)
      toast.error('Erreur enregistrement devise')
    }
  }

  const handleSaveSettings = async () => {
    if (!enterpriseId) return
    setSaving(true)
    try {
      // Nettoyer les anciens champs de signature unique
      const settingsToSave = { ...settings }
      delete settingsToSave.signature_name
      delete settingsToSave.signature_image

      const ok = await PayrollService.savePayrollSettings(enterpriseId, settingsToSave)
      if (!ok) throw new Error()
      toast.success('Paramètres de paie enregistrés')
    } catch { toast.error('Erreur sauvegarde paramètres') }
    setSaving(false)
  }

  const handleSaveProfile = async () => {
    if (!enterpriseId || !profileForm.employee_id) { toast.error('Sélectionnez un employé'); return }
    setSaving(true)
    try {
      const ok = await PayrollService.saveEmployeePayrollProfile({ ...profileForm, enterprise_id: enterpriseId })
      if (!ok) throw new Error()
      const refreshed = await PayrollService.getEmployeePayrollProfiles(enterpriseId)
      setProfiles(refreshed)
      toast.success('Profil salarial enregistré')
    } catch { toast.error('Erreur sauvegarde profil') }
    setSaving(false)
  }

  // ═══════════════════════════════════════════════════════════
  // GÉNÉRATION PREVIEW
  // ═══════════════════════════════════════════════════════════

  const handleTryGenerate = () => {
    if (!enterpriseId || !periodStart || !periodEnd) { toast.error('Choisissez une période'); return }
    if (preCheckResults.blockers.length > 0) setShowGenerateConfirm(true)
    else handleGeneratePreview()
  }

  const handleGeneratePreview = async () => {
    setShowGenerateConfirm(false)
    if (!enterpriseId || !periodStart || !periodEnd) { toast.error('Choisissez une période'); return }
    setLoadingPreview(true)
    try {
      // Charger cumuls annuels
      const year = new Date(periodStart + 'T12:00:00Z').getFullYear()
      await loadAnnualCumuls(enterpriseId, year)

      const sourceData = await PayrollService.loadPayrollSourceData(enterpriseId, periodStart, periodEnd)
      const importedMap = await PayrollService.getImportedVariablesMap(enterpriseId, periodStart, periodEnd)

      const rows = await Promise.all(
        sourceData.employees.map(async (emp) => {
          const profile = profiles.find(p => p.employee_id === emp.id) || { employee_id: emp.id, salary_type: 'monthly', base_salary: 0 }
          const enCheckData = PayrollService.getEmployeeEnCheckData(emp, sourceData.attendances, sourceData.absences, sourceData.overtimeSettings, sourceData.schedules, sourceData.holidaySet, sourceData.holidayMap, periodStart, periodEnd)
          const [recurringAllowances, recurringDeductions, pBonuses, pDeductions] = await Promise.all([
            PayrollService.getActiveAllowancesForPeriod(enterpriseId, emp.id, periodStart, periodEnd),
            PayrollService.getActiveDeductionsForPeriod(enterpriseId, emp.id, periodStart, periodEnd),
            PayrollService.getPayrollBonuses(enterpriseId, periodStart, periodEnd, emp.id),
            PayrollService.getPayrollDeductions(enterpriseId, periodStart, periodEnd, emp.id),
          ])
          return await PayrollService.buildPayrollSlip({
            employee: emp, profile, settings, enCheckData,
            importedData: importedMap.get(emp.id) || {},
            periodStart, periodEnd,
            overtimeSettings: sourceData.overtimeSettings,
            recurringAllowances, periodBonuses: pBonuses,
            recurringDeductions, periodDeductions: pDeductions,
          })
        })
      )

      setPreviewRows(rows)
      setActiveTab('preview')
      await loadSentSlips(enterpriseId, periodStart, periodEnd)
      toast.success(`${rows.length} fiche(s) générée(s)`)
    } catch (err) { console.error(err); toast.error('Erreur génération preview') }
    setLoadingPreview(false)
  }

  // ═══════════════════════════════════════════════════════════
  // JOURS OUVRABLES DU MOIS
  // ═══════════════════════════════════════════════════════════

  const getWorkingDaysInMonth = useMemo(() => {
    if (!periodStart || !periodEnd) return 0
    const start = new Date(periodStart + 'T12:00:00Z')
    const end = new Date(periodEnd + 'T12:00:00Z')
    let count = 0
    const current = new Date(start)
    while (current <= end) {
      const day = current.getDay()
      if (day !== 0 && day !== 6) count++
      current.setDate(current.getDate() + 1)
    }
    return count
  }, [periodStart, periodEnd])

  // ═══════════════════════════════════════════════════════════
  // EXPORT EXCEL
  // ═══════════════════════════════════════════════════════════

  const handleExportExcel = () => {
    if (previewRows.length === 0) { toast.error('Aucune fiche à exporter'); return }
    const data = previewRows.map(row => ({
      'Matricule': row.employee?.matricule || '', 'Nom': row.employee?.last_name || '', 'Prénom': row.employee?.first_name || '',
      'Département': row.employee?.department || '', 'Poste': row.employee?.position || '',
      'Classification': row.employee?.classification || '', 'Catégorie': row.employee?.professional_category || '',
      'CNPS': row.employee?.cnps_number || '',
      'Mode': row.profile?.salary_type === 'monthly' ? 'Mensuel' : row.profile?.salary_type === 'hourly' ? 'Horaire' : 'Journalier',
      'Salaire de base': row.profile?.base_salary || row.profile?.hourly_rate || row.profile?.daily_rate || 0,
      'Jours travaillés': row.sources?.encheck?.workedDays || 0,
      'Heures sup (min)': row.sources?.encheck?.totalOvertimeAllMinutes || 0,
      'Absences (j)': row.sources?.encheck?.absencesDays || 0,
      'Total gains': row.totalEarnings || 0, 'Salaire brut': row.grossSalary || 0,
      'Total retenues': row.totalDeductions || 0, 'Net à payer': row.netSalary || 0,
      'Coût employeur': row.employerCost || 0,
      'Cotis. salariales': row.taxation?.contributions?.totalEmployee || 0,
      'Cotis. patronales': row.taxation?.contributions?.totalEmployer || 0,
      'Impôt (IRPP)': row.taxation?.tax?.totalTax || 0,
      'Mode paiement': row.profile?.payment_method || '',
      'Envoyée': sentSlips.has(row.employee?.id) ? 'Oui' : 'Non',
    }))
    data.push({
      'Matricule': '', 'Nom': 'TOTAUX', 'Prénom': '', 'Département': '', 'Poste': '', 'Classification': '', 'Catégorie': '', 'CNPS': '', 'Mode': '', 'Salaire de base': '',
      'Jours travaillés': '', 'Heures sup (min)': '', 'Absences (j)': '',
      'Total gains': previewRows.reduce((s, r) => s + (r.totalEarnings || 0), 0),
      'Salaire brut': previewRows.reduce((s, r) => s + (r.grossSalary || 0), 0),
      'Total retenues': previewRows.reduce((s, r) => s + (r.totalDeductions || 0), 0),
      'Net à payer': previewRows.reduce((s, r) => s + (r.netSalary || 0), 0),
      'Coût employeur': previewRows.reduce((s, r) => s + (r.employerCost || 0), 0),
      'Cotis. salariales': previewRows.reduce((s, r) => s + (r.taxation?.contributions?.totalEmployee || 0), 0),
      'Cotis. patronales': previewRows.reduce((s, r) => s + (r.taxation?.contributions?.totalEmployer || 0), 0),
      'Impôt (IRPP)': previewRows.reduce((s, r) => s + (r.taxation?.tax?.totalTax || 0), 0),
      'Mode paiement': '', 'Envoyée': '',
    })
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Masse salariale')
    const periodLabel = new Date(periodStart + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    XLSX.writeFile(wb, `masse_salariale_${periodLabel.replace(/\s/g, '_')}.xlsx`)
    toast.success('Export Excel téléchargé')
  }

  // ═══════════════════════════════════════════════════════════
  // ENVOI FICHES
  // ═══════════════════════════════════════════════════════════

  const buildPayslipData = (row) => ({
    enterprise_id: enterpriseId, employee_id: row.employee.id,
    period_start: periodStart, period_end: periodEnd,
    gross_salary: row.grossSalary || 0, net_salary: row.netSalary || 0,
    total_earnings: row.totalEarnings || 0, total_deductions: row.totalDeductions || 0,
    currency: settings.currency || 'XAF',
    worked_days: row.sources?.encheck?.workedDays || 0,
    worked_hours: (row.sources?.encheck?.totalWorkedMinutes || 0) / 60,
    overtime_hours: (row.sources?.encheck?.totalOvertimeAllMinutes || 0) / 60,
    overtime_amount: row.earnings?.filter(e => e.code?.startsWith('overtime')).reduce((s, e) => s + e.amount, 0) || 0,
    absence_days: row.sources?.encheck?.absencesDays || 0,
    taxable_income: row.taxation?.taxableIncome || 0,
    income_tax: row.taxation?.tax?.totalTax || 0,
    employee_contributions: row.taxation?.contributions?.totalEmployee || 0,
    employer_contributions: row.taxation?.contributions?.totalEmployer || 0,
    bonuses_total: row.earnings?.filter(e => ['recurring_allowance', 'period_bonus'].includes(e.source)).reduce((s, e) => s + e.amount, 0) || 0,
    deductions_total: row.totalDeductions || 0,
    details: {
      profile: row.profile, earnings: row.earnings, deductions: row.deductions,
      taxation: row.taxation || null, sources: row.sources,
      settings_snapshot: {
        salary_period: settings.salary_period,
        company_header: settings.company_header, company_footer: settings.company_footer,
        signatory1_name: settings.signatory1_name, signatory1_title: settings.signatory1_title,
        signatory1_signature: settings.signatory1_signature,
        signatory2_name: settings.signatory2_name, signatory2_title: settings.signatory2_title,
        signatory2_signature: settings.signatory2_signature,
        company_stamp: settings.company_stamp,
        company_rccm: settings.company_rccm, company_nif: settings.company_nif,
        company_cnps_number: settings.company_cnps_number,
        company_collective_agreement: settings.company_collective_agreement,
        legal_mention: settings.legal_mention,
        overtime_settings: overtimeSettings,
      },
      enterprise_name: enterpriseName,
      enterprise_data: enterpriseData,
      employee_extra: {
        hire_date: row.employee?.hire_date,
        cnps_number: row.employee?.cnps_number,
        professional_category: row.employee?.professional_category,
        echelon: row.employee?.echelon,
        classification: row.employee?.classification,
        contract_type: row.employee?.contract_type,
      },
      annual_cumuls: annualCumuls[row.employee.id] || null,
      leave_balance: leaveBalances[row.employee.id] || null,
      working_days_in_month: getWorkingDaysInMonth,
    },
    sent_by: admin?.id || null, status: 'sent', sent_at: new Date().toISOString(),
  })

  const handleSendToEmployee = async (row) => {
    if (!enterpriseId || !row?.employee?.id) return
    // 🛡️ CF-2 : Bloquer l'envoi officiel au salarié si le barème fiscal n'est pas validé
    const controle = TaxationService.verifierAvantRemise(row)
    if (!controle.remissable) {
      toast.error(controle.motif || 'Ce bulletin est provisoire et son barème fiscal doit être validé avant envoi au salarié.', { duration: 6000 })
      return
    }
    try {
      const { error } = await supabase.from('employee_payslips').upsert(buildPayslipData(row), { onConflict: 'enterprise_id,employee_id,period_start,period_end' })
      if (error) throw error
      setSentSlips(prev => new Set([...prev, row.employee.id]))
      toast.success(`Fiche envoyée à ${row.employee.first_name} ${row.employee.last_name}`)
      await PayrollService.logAuditAction({ enterpriseId, action: 'payslip_sent', entityType: 'payslip', employeeId: row.employee.id, periodStart, periodEnd, metadata: { net_salary: row.netSalary, gross_salary: row.grossSalary }, performedBy: admin?.id })
    } catch (err) { console.error(err); toast.error('Erreur envoi fiche') }
  }

  const handleSendAllToEmployees = async () => {
    if (!previewRows.length) return
    // 🛡️ CF-2 : Vérifier qu'aucun bulletin n'a un barème fiscal non validé avant envoi groupé
    const nonRemissables = previewRows.filter(r => !TaxationService.verifierAvantRemise(r).remissable)
    if (nonRemissables.length > 0) {
      const premierMotif = TaxationService.verifierAvantRemise(nonRemissables[0]).motif
      toast.error(premierMotif || `${nonRemissables.length} bulletin(s) ont un barème fiscal à vérifier avant remise officielle.`, { duration: 7000 })
      return
    }
    setSendingSlips(true)
    let ok = 0, ko = 0
    for (const row of previewRows) {
      try {
        const { error } = await supabase.from('employee_payslips').upsert(buildPayslipData(row), { onConflict: 'enterprise_id,employee_id,period_start,period_end' })
        if (error) throw error; ok++; setSentSlips(prev => new Set([...prev, row.employee.id]))
      } catch { ko++ }
    }
    if (ko === 0) toast.success(`${ok} fiche(s) envoyée(s)`); else toast.error(`${ok} envoyée(s), ${ko} erreur(s)`)
    setSendingSlips(false)
  }

  const handleDeleteSentSlip = (row) => { setSlipToDelete(row); setShowDeleteModal(true) }

  const confirmDeleteSentSlip = async () => {
    if (!enterpriseId || !slipToDelete?.employee?.id) return
    setDeletingSlip(true)
    try {
      const { error } = await supabase.from('employee_payslips')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: admin?.id || null })
        .eq('enterprise_id', enterpriseId).eq('employee_id', slipToDelete.employee.id)
        .eq('period_start', periodStart).eq('period_end', periodEnd)
      if (error) throw error
      setSentSlips(prev => { const u = new Set(prev); u.delete(slipToDelete.employee.id); return u })
      toast.success('Fiche retirée'); setShowDeleteModal(false); setSlipToDelete(null)
    } catch { toast.error('Erreur suppression fiche') }
    setDeletingSlip(false)
  }

  const handleDownloadSlip = async (row) => {
    try {
      const empCumul = annualCumuls[row.employee?.id] || null
      const empLeave = leaveBalances[row.employee?.id] || null

      const ok = await PayrollService.generatePayrollSlipPDF(
        row,
        settings,
        enterpriseName,
        periodStart,
        periodEnd,
        enterpriseData,
        empCumul,
        empLeave
      )

      if (!ok) throw new Error()
      toast.success('Fiche téléchargée')
    } catch (err) {
      console.error(err)
      toast.error('Erreur téléchargement PDF')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // IMPORT EXCEL
  // ═══════════════════════════════════════════════════════════

  const normalizeColumnKey = (key) => String(key || '').trim().toLowerCase().replace(/\s+/g, '_')

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]; if (!file) return
    setImportingFile(true)
    try {
      const ab = await file.arrayBuffer(); const wb = XLSX.read(ab, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!json?.length) { toast.error('Fichier vide'); setImportingFile(false); return }
      const normalized = json.map(row => { const n = {}; Object.keys(row).forEach(k => { n[normalizeColumnKey(k)] = row[k] }); return n })
      setImportColumns(Object.keys(normalized[0] || {}))
      const byMatricule = {}; employees.forEach(emp => { if (emp.matricule) byMatricule[String(emp.matricule).trim().toLowerCase()] = emp })
      const preview = normalized.map((row, i) => {
        const matricule = String(row.matricule || row.employee_matricule || '').trim()
        const matched = byMatricule[matricule.toLowerCase()] || null
        const data = { ...row }; delete data.matricule; delete data.employee_matricule
        return { rowIndex: i + 1, matricule, employee_id: matched?.id || null, employee_name: matched ? `${matched.first_name} ${matched.last_name}` : null, is_valid: !!matched, error_message: matched ? null : 'Matricule introuvable', data }
      })
      setImportFileName(file.name); setImportPreviewRows(preview)
      const invalid = preview.filter(r => !r.is_valid).length
      if (invalid > 0) toast.error(`${invalid} ligne(s) invalide(s)`); else toast.success('Fichier importé')
    } catch (err) { console.error(err); toast.error('Erreur lecture fichier') }
    setImportingFile(false)
  }

  const handleSaveImport = async () => {
    if (!enterpriseId || !periodStart || !periodEnd) { toast.error('Veuillez définir la période'); return }
    setSavingImport(true)
    try {
      const validRows = importPreviewRows.filter(r => r.is_valid)
      const { data: payrollImport, error: ie } = await supabase.from('payroll_imports').insert({ enterprise_id: enterpriseId, period_start: periodStart, period_end: periodEnd, file_name: importFileName || 'import.xlsx', raw_data: importPreviewRows, imported_by: admin?.id || null }).select().single()
      if (ie) throw ie
      if (validRows.length > 0) {
        const { error: re } = await supabase.from('payroll_import_rows').insert(validRows.map(row => ({ payroll_import_id: payrollImport.id, enterprise_id: enterpriseId, employee_id: row.employee_id, matricule: row.matricule, data: row.data || {}, is_valid: true, error_message: null })))
        if (re) throw re
      }
      toast.success('Import enregistré'); setImportFileName(''); setImportPreviewRows([]); setImportColumns([])
    } catch (err) { console.error(err); toast.error('Erreur enregistrement import') }
    setSavingImport(false)
  }

  // ═══════════════════════════════════════════════════════════
  // PRIMES & RETENUES
  // ═══════════════════════════════════════════════════════════

  const handleSaveAllowance = async (d) => { setSaving(true); try { const ok = await PayrollService.saveEmployeeAllowance({ ...d, enterprise_id: enterpriseId, created_by: admin?.id }); if (!ok) throw new Error(); await loadEmployeeAllowancesAndDeductions(selectedEmployeeId); toast.success('Prime enregistrée'); setShowAllowanceModal(false); setEditingAllowance(null) } catch { toast.error('Erreur') } setSaving(false) }
  const handleDeleteAllowance = async (id) => { setSaving(true); try { const ok = await PayrollService.deleteEmployeeAllowance(id); if (!ok) throw new Error(); await loadEmployeeAllowancesAndDeductions(selectedEmployeeId); toast.success('Prime supprimée') } catch { toast.error('Erreur') } setSaving(false) }
  const handleSaveDeduction = async (d) => { setSaving(true); try { const ok = await PayrollService.saveEmployeeDeduction({ ...d, enterprise_id: enterpriseId, created_by: admin?.id }); if (!ok) throw new Error(); await loadEmployeeAllowancesAndDeductions(selectedEmployeeId); toast.success('Retenue enregistrée'); setShowDeductionModal(false); setShowLoanModal(false); setEditingDeduction(null); await PayrollService.logAuditAction({ enterpriseId, action: d.category === 'loan' ? 'loan_created' : 'deduction_added', entityType: 'deduction', employeeId: d.employee_id, metadata: { name: d.name, amount: d.monthly_amount }, performedBy: admin?.id }) } catch { toast.error('Erreur') } setSaving(false) }
  const handleSaveBonus = async (d) => { setSaving(true); try { const ok = await PayrollService.savePayrollBonus({ ...d, enterprise_id: enterpriseId, period_start: periodStart, period_end: periodEnd, created_by: admin?.id }); if (!ok) throw new Error(); await loadPeriodBonusesAndDeductions(); toast.success('Prime ponctuelle enregistrée'); setShowBonusModal(false) } catch { toast.error('Erreur') } setSaving(false) }
  const handleSavePeriodDeduction = async (d) => { setSaving(true); try { const ok = await PayrollService.savePayrollDeduction({ ...d, enterprise_id: enterpriseId, period_start: periodStart, period_end: periodEnd, created_by: admin?.id }); if (!ok) throw new Error(); await loadPeriodBonusesAndDeductions(); toast.success('Retenue ponctuelle enregistrée'); setShowPeriodDeductionModal(false) } catch { toast.error('Erreur') } setSaving(false) }
  const handleDeleteBonus = async (id) => { const ok = await PayrollService.deletePayrollBonus(id); if (ok) { await loadPeriodBonusesAndDeductions(); toast.success('Prime supprimée') } else toast.error('Erreur') }
  const handleDeletePeriodDeduction = async (id) => { const ok = await PayrollService.deletePayrollDeduction(id); if (ok) { await loadPeriodBonusesAndDeductions(); toast.success('Retenue supprimée') } else toast.error('Erreur') }

  // ═══════════════════════════════════════════════════════════
  // FILTRAGE
  // ═══════════════════════════════════════════════════════════

  const filteredEmployees = useMemo(() => {
    if (!searchProfile.trim()) return employees
    const s = searchProfile.toLowerCase()
    return employees.filter(e => `${e.first_name} ${e.last_name} ${e.matricule} ${e.department || ''} ${e.position || ''}`.toLowerCase().includes(s))
  }, [employees, searchProfile])

  const filteredPreviewRows = useMemo(() => {
    if (!searchPreview.trim()) return previewRows
    const s = searchPreview.toLowerCase()
    return previewRows.filter(r => `${r.employee?.first_name} ${r.employee?.last_name} ${r.employee?.matricule} ${r.employee?.department || ''}`.toLowerCase().includes(s))
  }, [previewRows, searchPreview])

  // ═══════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════════════

  const summary = useMemo(() => {
    const totalNet = previewRows.reduce((s, r) => s + (r.netSalary || 0), 0)
    const totalGross = previewRows.reduce((s, r) => s + (r.grossSalary || 0), 0)
    const totalCost = previewRows.reduce((s, r) => s + (r.employerCost || r.grossSalary || 0), 0)
    const totalEmployees = previewRows.length
    const alreadySent = previewRows.filter(r => sentSlips.has(r.employee?.id)).length
    return { totalNet, totalGross, totalCost, totalEmployees, alreadySent }
  }, [previewRows, sentSlips])

  const fmt = (amount) => PayrollService.formatMoney(amount, settings.currency)

  // ═══════════════════════════════════════════════════════════
  // PRÉ-VALIDATION
  // ═══════════════════════════════════════════════════════════

  const preCheckResults = useMemo(() => {
  const ready = [], warnings = [], blockers = []

  // ✅ Définir le libellé une fois
  const socialOrgLabel = settings.hide_social_label
    ? ''
    : (settings.company_social_label?.trim() || 'Organisme social')

  employees.forEach(emp => {
    const profile = profiles.find(p => p.employee_id === emp.id)
    const name = `${emp.first_name} ${emp.last_name}`

    // Vérifier si le profil existe
    if (!profile) {
      blockers.push({ employee: name, reason: 'Aucun profil salarial' })
      return
    }

    // Vérifier selon le type de salaire
    if (profile.salary_type === 'monthly' && (!profile.base_salary || profile.base_salary <= 0)) {
      warnings.push({ employee: name, reason: 'Salaire de base = 0' })
    } else if (profile.salary_type === 'hourly' && (!profile.hourly_rate || profile.hourly_rate <= 0)) {
      blockers.push({ employee: name, reason: 'Taux horaire non défini' })
      return
    } else if (profile.salary_type === 'daily' && (!profile.daily_rate || profile.daily_rate <= 0)) {
      blockers.push({ employee: name, reason: 'Taux journalier non défini' })
      return
    }

    // ✅ CORRECTION : Vérifier le numéro organisme social avec libellé dynamique
    if (!emp.cnps_number) {
      warnings.push({
        employee: name,
        reason: socialOrgLabel
          ? `N° ${socialOrgLabel} manquant`
          : 'Numéro organisme social manquant'
      })
    }

    // Vérifier la date d'embauche
    if (!emp.hire_date) {
      warnings.push({ employee: name, reason: 'Date d\'embauche manquante' })
    }

    // Si toutes les vérifications passent, l'employé est prêt
    ready.push({ employee: name })
  })

  return { ready, warnings, blockers }
}, [employees, profiles, settings.company_social_label, settings.hide_social_label])


  // Vérifier si signatures/cachet configurés
  const hasSignatures = settings.signatory1_signature || settings.signatory2_signature
  const hasStamp = !!settings.company_stamp

  if (loading) {
    return <div style={S.loadingWrap}><RefreshCw size={34} color="#F59E0B" style={{ animation: 'spin 0.9s linear infinite' }} /><p style={{ color: '#999', marginTop: 12 }}>Chargement du module fiches de paie...</p></div>
  }

  // ═══════════════════════════════════════════════════════════
  // FIN PARTIE 1 — SUITE DANS PARTIE 2
  // Le rendu JSX (return) est dans la partie 2
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // RENDU PRINCIPAL (suite de la partie 1)
  // ═══════════════════════════════════════════════════════════

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .pay-card { animation: fadeInUp 0.3s ease forwards; }
        .pay-btn:hover { transform: translateY(-1px); }
        html, body, #root { background: #0A0A0F !important; }
        select, input, textarea { background: rgba(255,255,255,0.04) !important; color: #FFF !important; }
        select option { background: #141423 !important; color: #E5E5E5 !important; }
        input::placeholder, textarea::placeholder { color: #666 !important; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        @media (max-width: 768px) {
          .pay-grid-2 { grid-template-columns: 1fr !important; }
          .pay-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0A0A0F', width: '100%' }}>
        <div style={S.container}>

          {/* HEADER */}
          <header style={S.header}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={S.backBtn}><ArrowLeft size={18} /></button>
              <div style={S.logoBox}><Wallet size={22} color="#F59E0B" /></div>
              <div>
                <h1 style={S.title}>FICHES DE PAIE</h1>
                {enterprisesList.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ color: '#9CA3AF', fontSize: 12 }}>Entreprise :</span>
                    <select
                      value={enterpriseId || ''}
                      onChange={(e) => handleEnterpriseSelectChange(e.target.value)}
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 8,
                        padding: '5px 10px',
                        color: '#F59E0B',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {enterprisesList.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name} {ent.country_code ? `(${ent.country_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p style={S.subtitle}>{enterpriseName}</p>
                )}
              </div>
            </div>
            <div style={S.headerRight}>
              {overtimeSettings && (
                <div style={S.otBadge}><Clock size={14} color="#F97316" /><span style={{ color: '#F97316', fontSize: 12, fontWeight: 700 }}>H.sup: +{overtimeSettings.rate_normal}% / +{overtimeSettings.rate_major}%</span></div>
              )}
              <button onClick={() => { loadHistory(); setShowHistoryModal(true) }} style={S.historyBtn} className="pay-btn"><History size={16} /><span>Historique</span></button>
              <button onClick={handleTryGenerate} style={S.primaryBtn} className="pay-btn" disabled={loadingPreview}>
                {loadingPreview ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Eye size={16} />}
                <span>{loadingPreview ? 'Calcul...' : 'Générer les fiches'}</span>
              </button>
            </div>
          </header>

          {/* GUIDE */}
          <div style={S.guideBar}>
            <Info size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={S.guideTitle}>Comment utiliser ce module ?</p>
              <p style={S.guideText}>
                <strong>1.</strong> Configurez les <strong>paramètres</strong>, <strong>signatures</strong> et <strong>cachet</strong>.{' '}
                <strong>2.</strong> Créez les <strong>profils salariaux</strong>.{' '}
                <strong>3.</strong> Gérez les <strong>primes & retenues</strong>.{' '}
                <strong>4.</strong> Importez les <strong>variables</strong>.{' '}
                <strong>5.</strong> Générez et envoyez les bulletins.
              </p>
            </div>
          </div>

          {/* PRÉ-VALIDATION */}
          {(preCheckResults.blockers.length > 0 || preCheckResults.warnings.length > 0) && (
            <div style={S.preCheckBar}>
              {preCheckResults.blockers.length > 0 && (
                <div style={S.preCheckSection}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><AlertCircle size={14} color="#EF4444" /><span style={{ color: '#EF4444', fontSize: 12, fontWeight: 700 }}>{preCheckResults.blockers.length} problème(s) bloquant(s)</span></div>
                  {preCheckResults.blockers.slice(0, 5).map((b, i) => <div key={i} style={S.preCheckItem}><span style={{ color: '#FCA5A5', fontSize: 11 }}>⚠ {b.employee} — {b.reason}</span></div>)}
                  {preCheckResults.blockers.length > 5 && <div style={S.preCheckItem}><span style={{ color: '#FCA5A5', fontSize: 11 }}>...et {preCheckResults.blockers.length - 5} autre(s)</span></div>}
                </div>
              )}
              {preCheckResults.warnings.length > 0 && (
                <div style={S.preCheckSection}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><AlertTriangle size={14} color="#F59E0B" /><span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700 }}>{preCheckResults.warnings.length} avertissement(s)</span></div>
                  {preCheckResults.warnings.slice(0, 3).map((w, i) => <div key={i} style={S.preCheckItem}><span style={{ color: '#FCD34D', fontSize: 11 }}>⚠ {w.employee} — {w.reason}</span></div>)}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} color="#10B981" /><span style={{ color: '#10B981', fontSize: 12, fontWeight: 700 }}>{preCheckResults.ready.length} employé(s) prêt(s)</span></div>
            </div>
          )}

          {/* PÉRIODE */}
          <div style={S.periodBar}>
            <div style={S.periodGroup}>
              <FormLabel help="Date de début" example="01/06/2025">Début période</FormLabel>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={S.input} />
            </div>
            <div style={S.periodGroup}>
              <FormLabel help="Date de fin" example="30/06/2025">Fin période</FormLabel>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={S.input} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={S.periodInfo}>
                <Calendar size={14} color="#888" />
                <span style={{ color: '#888', fontSize: 12 }}>
                  {periodStart && periodEnd ? `${Math.ceil((new Date(periodEnd) - new Date(periodStart)) / 86400000) + 1} jours (${getWorkingDaysInMonth} ouvrables)` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ONGLETS */}
          <div style={S.tabs}>
            {[
              { key: 'settings', icon: Settings, label: 'Paramètres' },
              { key: 'profiles', icon: Users, label: 'Profils salariés' },
              { key: 'allowances', icon: Gift, label: 'Primes & Retenues', badge: (periodBonuses.length + periodDeductions.length) || null },
              { key: 'imports', icon: Upload, label: 'Import variables' },
              { key: 'preview', icon: Eye, label: 'Fiches générées', badge: previewRows.length || null },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ ...S.tabBtn, ...(activeTab === tab.key ? S.tabBtnActive : {}) }}>
                <tab.icon size={15} /><span>{tab.label}</span>
                {tab.badge && <span style={S.tabBadge}>{tab.badge}</span>}
              </button>
            ))}
          </div>

          {/* ═══ ONGLET PARAMÈTRES ═══ */}
          {activeTab === 'settings' && (
            <div className="pay-grid-2" style={S.grid2}>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}>
                    <div style={S.cardIcon}><Settings size={18} color="#F59E0B" /></div>
                    <div><h3 style={S.cardTitle}>Paramètres du moteur de paie</h3><p style={S.cardSub}>Configurez les règles de calcul</p></div>
                  </div>
                </div>

                <div className="pay-form-grid" style={S.formGrid}>
                  <div style={S.formGroup}><FormLabel help="Devise de l’entreprise — elle est enregistrée sur l’entreprise, et sert à tous les bulletins" example="XAF, EUR" required>Devise</FormLabel><input value={settings.currency || ''} onChange={e => changerDevise(e.target.value)} style={S.input} placeholder="XAF, XOF, EUR" /></div>
                  <div style={S.formGroup}><FormLabel help="Fréquence de paie">Périodicité</FormLabel>
                    <select value={settings.salary_period || 'monthly'} onChange={e => setSettings(p => ({ ...p, salary_period: e.target.value }))} style={S.select}>
                      <option value="monthly">Mensuelle</option><option value="biweekly">Bimensuelle</option><option value="weekly">Hebdomadaire</option>
                    </select>
                  </div>
                  <div style={S.formGroup}><FormLabel help="Diviseur journalier" example="22">Diviseur jours</FormLabel><input type="number" value={settings.working_days_divisor} onChange={e => setSettings(p => ({ ...p, working_days_divisor: e.target.value }))} style={S.input} /></div>
                  <div style={S.formGroup}><FormLabel help="Diviseur horaire" example="173.33">Diviseur heures</FormLabel><input type="number" step="0.01" value={settings.hourly_divisor} onChange={e => setSettings(p => ({ ...p, hourly_divisor: e.target.value }))} style={S.input} /></div>
                </div>

                {overtimeSettings && (
                  <div style={S.otInfoBox}>
                    <Clock size={16} color="#F97316" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#F97316', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' }}>Heures supplémentaires configurées</p>
                      <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Normal: +{overtimeSettings.rate_normal}% • Majoré: +{overtimeSettings.rate_major}% • Dimanche: +{overtimeSettings.rate_sunday}% • Férié: +{overtimeSettings.rate_holiday}%</p>
                    </div>
                    <button onClick={() => navigate('/heures-supplementaires')} style={S.otEditBtn}><Edit size={14} /><span>Modifier</span></button>
                  </div>
                )}

                <div style={S.toggleSection}>
                  <p style={S.toggleSectionTitle}>Sources de données</p>
                  <div style={S.toggleGrid}>
                    {[
                      ['use_attendance_data', 'Présences En-Check', 'Utilise les pointages réels'],
                      ['use_overtime_data', 'Heures supplémentaires', 'Intègre les heures sup calculées'],
                      ['use_absence_data', 'Absences & congés', 'Prend en compte les absences'],
                      ['use_late_data', 'Retards', 'Comptabilise les retards'],
                      ['use_holiday_work_data', 'Jours fériés travaillés', 'Détecte les fériés travaillés'],
                      ['use_imported_variables', 'Variables importées', 'Prend en compte les variables Excel'],
                    ].map(([key, label, desc]) => (
                      <label key={key} style={S.toggleItem}><input type="checkbox" checked={!!settings[key]} onChange={e => setSettings(p => ({ ...p, [key]: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>{label}</span><span style={S.toggleDesc}>{desc}</span></div></label>
                    ))}
                  </div>
                </div>

                <div style={S.toggleSection}>
                  <p style={S.toggleSectionTitle}>Règles de calcul</p>
                  <div style={S.toggleGrid}>
                    {[
                      ['deduct_absence', 'Déduire les absences', 'Retire automatiquement les absences'],
                      ['deduct_late', 'Déduire les retards', 'Retire automatiquement les retards'],
                      ['include_overtime_in_payroll', 'Payer les heures sup', 'Ajoute les heures sup au brut'],
                    ].map(([key, label, desc]) => (
                      <label key={key} style={S.toggleItem}><input type="checkbox" checked={!!settings[key]} onChange={e => setSettings(p => ({ ...p, [key]: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>{label}</span><span style={S.toggleDesc}>{desc}</span></div></label>
                    ))}
                  </div>
                </div>

                {/* INFOS ENTREPRISE ENRICHIES */}
                <div style={S.toggleSection}>
                  <p style={S.toggleSectionTitle}>Informations entreprise (bulletin)</p>
                  <div className="pay-form-grid" style={S.formGrid}>
                    <div style={S.formGroup}><FormLabel help="Registre de Commerce">N° RCCM</FormLabel><input value={settings.company_rccm || ''} onChange={e => setSettings(p => ({ ...p, company_rccm: e.target.value }))} style={S.input} placeholder="Ex: RC/DLA/2024/B/1234" /></div>
                    <div style={S.formGroup}><FormLabel help="Numéro Identifiant Fiscal">N° Contribuable / NIF</FormLabel><input value={settings.company_nif || ''} onChange={e => setSettings(p => ({ ...p, company_nif: e.target.value }))} style={S.input} placeholder="Ex: M012345678901A" /></div>
                    <div style={S.formGroup}>
                      <FormLabel help="Numéro d'affiliation de l'organisme social, caisse sociale ou institution équivalente">
                        {socialOrgLabel ? `N° ${socialOrgLabel} employeur` : 'Numéro organisme employeur'}
                      </FormLabel>
                      <input
                        value={settings.company_cnps_number || ''}
                        onChange={e => setSettings(p => ({ ...p, company_cnps_number: e.target.value }))}
                        style={S.input}
                        placeholder="Ex: 1234567-X"
                      />
                    </div>

                    <div style={S.formGroup}>
                      <FormLabel help="Libellé affiché dans le bulletin de paie" example="CNPS, CNSS, IPRES / CSS, INPS">
                        Libellé organisme social
                      </FormLabel>
                      <input
                        value={settings.company_social_label || ''}
                        onChange={e => setSettings(p => ({ ...p, company_social_label: e.target.value }))}
                        style={S.input}
                        placeholder="Ex: CNPS"
                      />
                    </div>

                    <label style={S.toggleItem}>
                      <input
                        type="checkbox"
                        checked={!!settings.hide_social_label}
                        onChange={e => setSettings(p => ({ ...p, hide_social_label: e.target.checked }))}
                        style={S.checkbox}
                      />
                      <div>
                        <span style={S.toggleLabel}>Masquer le libellé organisme social</span>
                        <span style={S.toggleDesc}>Si activé, seul le numéro sera affiché sur le bulletin</span>
                      </div>
                    </label>
                    <div style={S.formGroup}><FormLabel help="Convention collective applicable">Convention collective</FormLabel><input value={settings.company_collective_agreement || ''} onChange={e => setSettings(p => ({ ...p, company_collective_agreement: e.target.value }))} style={S.input} placeholder="Ex: Commerce et Distribution" /></div>
                  </div>
                </div>


                

                {/* PERSONNALISATION BULLETIN */}
                <div style={S.toggleSection}>
                  <p style={S.toggleSectionTitle}>Personnalisation du bulletin</p>
                  <div style={S.formGroup}><FormLabel help="Texte en haut du bulletin">En-tête</FormLabel><textarea rows={3} value={settings.company_header || ''} onChange={e => setSettings(p => ({ ...p, company_header: e.target.value }))} style={S.textarea} /></div>
                  <div style={S.formGroup}><FormLabel help="Texte en bas du bulletin">Pied de page</FormLabel><textarea rows={3} value={settings.company_footer || ''} onChange={e => setSettings(p => ({ ...p, company_footer: e.target.value }))} style={S.textarea} /></div>
                  <div style={S.formGroup}><FormLabel help="Mention légale obligatoire en bas du bulletin">Mention légale</FormLabel><textarea rows={2} value={settings.legal_mention || ''} onChange={e => setSettings(p => ({ ...p, legal_mention: e.target.value }))} style={S.textarea} placeholder="Ce bulletin de paie doit être conservé sans limitation de durée..." /></div>
                </div>




                {/* ═══ SIGNATURES (2 SIGNATAIRES) ═══ */}
                <div style={S.signatureBlock}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ ...S.cardIcon, background: 'rgba(245,158,11,0.12)' }}><PenTool size={18} color="#F59E0B" /></div>
                    <div>
                      <p style={{ color: '#FFF', fontSize: 14, fontWeight: 700, margin: 0 }}>Signatures numériques</p>
                      <p style={{ color: '#777', fontSize: 11, margin: '2px 0 0 0' }}>Configurez jusqu'à 2 signataires pour vos bulletins</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <SingleSignatureManager
                      label="✍️ Signataire 1 (principal)"
                      signature={settings.signatory1_signature || ''}
                      onSignatureChange={sig => setSettings(p => ({ ...p, signatory1_signature: sig }))}
                      sigName={settings.signatory1_name || ''}
                      onSigNameChange={name => setSettings(p => ({ ...p, signatory1_name: name }))}
                      sigTitle={settings.signatory1_title || ''}
                      onSigTitleChange={title => setSettings(p => ({ ...p, signatory1_title: title }))}
                      enterpriseId={enterpriseId}
                      color="#F59E0B"
                    />

                    <SingleSignatureManager
                      label="✍️ Signataire 2 (optionnel)"
                      signature={settings.signatory2_signature || ''}
                      onSignatureChange={sig => setSettings(p => ({ ...p, signatory2_signature: sig }))}
                      sigName={settings.signatory2_name || ''}
                      onSigNameChange={name => setSettings(p => ({ ...p, signatory2_name: name }))}
                      sigTitle={settings.signatory2_title || ''}
                      onSigTitleChange={title => setSettings(p => ({ ...p, signatory2_title: title }))}
                      enterpriseId={enterpriseId}
                      color="#6366F1"
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <StampManager
                      stamp={settings.company_stamp || ''}
                      onStampChange={stamp => setSettings(p => ({ ...p, company_stamp: stamp }))}
                      enterpriseId={enterpriseId}
                    />
                  </div>

                  <div style={S.signatureInfo}>
                    <Info size={13} color="#666" style={{ flexShrink: 0 }} />
                    <span style={{ color: '#666', fontSize: 11, lineHeight: 1.5 }}>Les signatures et le cachet apparaîtront en bas de chaque bulletin PDF. Formats : PNG, JPG, WebP (max 2-3 Mo).</span>
                  </div>
                </div>

                {/* LIEN CONFIG FISCALE */}
                <div style={S.fiscalLinkBox} onClick={() => navigate('/configuration-fiscale')}>
                  <div style={S.fiscalLinkIcon}><Shield size={22} color="#8B5CF6" /></div>
                  <div style={{ flex: 1 }}>
                    <p style={S.fiscalLinkTitle}>Configuration Fiscale Avancée</p>
                    <p style={S.fiscalLinkText}>Cotisations sociales, barème d'imposition, règles par pays</p>
                  </div>
                  <ArrowRight size={18} color="#8B5CF6" />
                </div>

                <div style={S.actionsRow}>
                  <button onClick={handleSaveSettings} style={S.primaryBtn} disabled={saving}>
                    {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}
                    <span>Enregistrer les paramètres</span>
                  </button>
                </div>
              </div>

              {/* RÉSUMÉ */}
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}>
                    <div style={{ ...S.cardIcon, background: 'rgba(16,185,129,0.12)' }}><Building2 size={18} color="#10B981" /></div>
                    <div><h3 style={S.cardTitle}>Résumé</h3><p style={S.cardSub}>État de la configuration</p></div>
                  </div>
                </div>

                {/* Logo entreprise */}
                {enterpriseData?.logo_url && (
                  <div style={{ textAlign: 'center', marginBottom: 16, padding: 14, background: '#FFF', borderRadius: 14 }}>
                    <img src={enterpriseData.logo_url} alt="Logo" style={{ maxWidth: 150, maxHeight: 60, objectFit: 'contain' }} />
                  </div>
                )}

                <div style={S.summaryList}>
                  {[
                    { label: 'Entreprise', value: enterpriseName },
                    { label: 'Adresse', value: enterpriseData?.address || 'Non renseignée', color: enterpriseData?.address ? undefined : '#666' },
                    { label: 'Devise', value: settings.currency },
                    { label: 'RCCM', value: settings.company_rccm || 'Non renseigné', color: settings.company_rccm ? undefined : '#666' },
                    { label: 'NIF', value: settings.company_nif || 'Non renseigné', color: settings.company_nif ? undefined : '#666' },
                    {
                      label: socialOrgLabel ? `${socialOrgLabel} employeur` : 'Numéro organisme employeur',
                      value: settings.company_cnps_number || 'Non renseigné',
                      color: settings.company_cnps_number ? undefined : '#666'
                    },
                    {
                      label: 'Libellé organisme social',
                      value: settings.hide_social_label
                        ? 'Masqué'
                        : (settings.company_social_label || 'Organisme social'),
                      color: settings.hide_social_label ? '#F59E0B' : undefined
                    },
                    { label: 'Conv. collective', value: settings.company_collective_agreement || 'Non renseignée', color: settings.company_collective_agreement ? undefined : '#666' },
                    { label: 'Employés actifs', value: employees.length },
                    { label: 'Profils configurés', value: `${profiles.length} / ${employees.length}` },
                    { label: 'Signataire 1', value: settings.signatory1_name ? `${settings.signatory1_name}${settings.signatory1_title ? ` (${settings.signatory1_title})` : ''}` : '✗ Non configuré', color: settings.signatory1_name ? '#10B981' : '#EF4444' },
                    { label: 'Signataire 2', value: settings.signatory2_name ? `${settings.signatory2_name}${settings.signatory2_title ? ` (${settings.signatory2_title})` : ''}` : '— Optionnel', color: settings.signatory2_name ? '#10B981' : '#666' },
                    { label: 'Signatures', value: `${[settings.signatory1_signature, settings.signatory2_signature].filter(Boolean).length}/2 configurée(s)`, color: settings.signatory1_signature ? '#10B981' : '#EF4444' },
                    { label: 'Cachet', value: settings.company_stamp ? '✓ Configuré' : '✗ Non configuré', color: settings.company_stamp ? '#10B981' : '#666' },
                  ].map((item, i) => (
                    <div key={i} style={S.summaryItem}>
                      <span style={S.summaryLabel}>{item.label}</span>
                      <span style={{ ...S.summaryValue, color: item.color || '#FFF' }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Aperçu signatures + cachet */}
                {(settings.signatory1_signature || settings.signatory2_signature || settings.company_stamp) && (
                  <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: '#FFF', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ color: '#888', fontSize: 10, fontWeight: 600, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 1 }}>Aperçu zone signatures</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                      {settings.signatory1_signature && (
                        <div style={{ textAlign: 'center', flex: 1, minWidth: 120 }}>
                          <img src={settings.signatory1_signature} alt="Sig1" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain' }} />
                          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 4, marginTop: 4 }}>
                            {settings.signatory1_name && <p style={{ color: '#374151', fontSize: 11, fontWeight: 600, margin: 0 }}>{settings.signatory1_name}</p>}
                            {settings.signatory1_title && <p style={{ color: '#6B7280', fontSize: 9, margin: '2px 0 0 0' }}>{settings.signatory1_title}</p>}
                          </div>
                        </div>
                      )}
                      {settings.company_stamp && (
                        <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                          <img src={settings.company_stamp} alt="Cachet" style={{ maxWidth: 100, maxHeight: 100, objectFit: 'contain', opacity: 0.85 }} />
                        </div>
                      )}
                      {settings.signatory2_signature && (
                        <div style={{ textAlign: 'center', flex: 1, minWidth: 120 }}>
                          <img src={settings.signatory2_signature} alt="Sig2" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain' }} />
                          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 4, marginTop: 4 }}>
                            {settings.signatory2_name && <p style={{ color: '#374151', fontSize: 11, fontWeight: 600, margin: 0 }}>{settings.signatory2_name}</p>}
                            {settings.signatory2_title && <p style={{ color: '#6B7280', fontSize: 9, margin: '2px 0 0 0' }}>{settings.signatory2_title}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {preCheckResults.blockers.length > 0 && <div style={S.warningNote}><AlertTriangle size={14} color="#EF4444" /><span>{preCheckResults.blockers.length} problème(s) bloquant(s)</span></div>}
                {preCheckResults.ready.length === employees.length && employees.length > 0 && <div style={S.successNote}><CheckCircle size={14} color="#10B981" /><span>Tous les employés sont prêts ✓</span></div>}
              </div>
            </div>
          )}

          {/* ═══ ONGLET PROFILS ═══ */}
          {activeTab === 'profiles' && (
            <div className="pay-grid-2" style={S.grid2}>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}>
                    <div style={{ ...S.cardIcon, background: 'rgba(99,102,241,0.12)' }}><Users size={18} color="#6366F1" /></div>
                    <div><h3 style={S.cardTitle}>Profil salarial</h3><p style={S.cardSub}>Rémunération de base par employé</p></div>
                  </div>
                  <button onClick={() => { setCopySourceEmployeeId(''); setShowCopyProfileModal(true) }} style={S.copyBtn} title="Copier un profil existant"><Copy size={14} /><span>Copier un profil</span></button>
                </div>

                <SearchBar value={searchProfile} onChange={setSearchProfile} placeholder="Rechercher un employé..." />

                <div style={{ ...S.formGroup, marginTop: 12 }}>
                  <FormLabel required>Employé</FormLabel>
                  <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} style={S.select}>
                    {filteredEmployees.map(emp => {
                      const hasProfile = profiles.some(p => p.employee_id === emp.id)
                      return <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule}) {hasProfile ? '✓' : '⚠'}</option>
                    })}
                  </select>
                </div>

                {/* Info employé sélectionné */}
                {selectedEmployeeId && (() => {
                  const emp = employees.find(e => e.id === selectedEmployeeId)
                  if (!emp) return null
                  return (
                    <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', marginBottom: 12 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: '#888' }}>
                        {emp.hire_date && <span>📅 Embauche: {new Date(emp.hire_date).toLocaleDateString('fr-FR')}</span>}
                        {emp.classification && <span>🏷 {emp.classification}</span>}
                        {emp.professional_category && <span>📊 Cat. {emp.professional_category}</span>}
                        {emp.cnps_number && (
                          <span>
                            🛡 {socialOrgLabel ? `${socialOrgLabel}: ${emp.cnps_number}` : emp.cnps_number}
                          </span>
                        )}
                        {emp.contract_type && <span>📄 {emp.contract_type}</span>}
                      </div>
                    </div>
                  )
                })()}

                {/* Mode de rémunération */}
                <div style={S.formGroup}>
                  <FormLabel help="Mensuel, Horaire ou Journalier">Mode de rémunération</FormLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ value: 'monthly', label: '💼 Mensuel', desc: 'CDI, fonctionnaires' }, { value: 'hourly', label: '⏱ Horaire', desc: 'Vacataires' }, { value: 'daily', label: '📅 Journalier', desc: 'Saisonniers' }].map(mode => (
                      <button key={mode.value} onClick={() => setProfileForm(p => ({ ...p, salary_type: mode.value }))} style={{ ...S.modeBtn, ...(profileForm.salary_type === mode.value ? S.modeBtnActive : {}) }}>
                        <div style={{ color: profileForm.salary_type === mode.value ? '#F59E0B' : '#DDD', fontSize: 13, fontWeight: 700 }}>{mode.label}</div>
                        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pay-form-grid" style={S.formGrid}>
                  {profileForm.salary_type === 'monthly' && (<>
                    <div style={S.formGroup}><FormLabel required>Salaire de base</FormLabel><input type="number" value={profileForm.base_salary} onChange={e => setProfileForm(p => ({ ...p, base_salary: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Prime transport</FormLabel><input type="number" value={profileForm.transport_allowance} onChange={e => setProfileForm(p => ({ ...p, transport_allowance: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Prime logement</FormLabel><input type="number" value={profileForm.housing_allowance} onChange={e => setProfileForm(p => ({ ...p, housing_allowance: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Prime fixe</FormLabel><input type="number" value={profileForm.fixed_bonus} onChange={e => setProfileForm(p => ({ ...p, fixed_bonus: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Retenue fixe</FormLabel><input type="number" value={profileForm.fixed_deduction} onChange={e => setProfileForm(p => ({ ...p, fixed_deduction: e.target.value }))} style={S.input} /></div>
                  </>)}
                  {profileForm.salary_type === 'hourly' && (<>
                    <div style={S.formGroup}><FormLabel required>Taux horaire ({settings.currency})</FormLabel><input type="number" value={profileForm.hourly_rate} onChange={e => setProfileForm(p => ({ ...p, hourly_rate: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Heures contractuelles/mois</FormLabel><input type="number" value={profileForm.contract_hours_per_month} onChange={e => setProfileForm(p => ({ ...p, contract_hours_per_month: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Minimum garanti ({settings.currency})</FormLabel><input type="number" value={profileForm.min_guaranteed_hours} onChange={e => setProfileForm(p => ({ ...p, min_guaranteed_hours: e.target.value }))} style={S.input} /></div>
                  </>)}
                  {profileForm.salary_type === 'daily' && (<>
                    <div style={S.formGroup}><FormLabel required>Taux journalier ({settings.currency})</FormLabel><input type="number" value={profileForm.daily_rate} onChange={e => setProfileForm(p => ({ ...p, daily_rate: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Jours contractuels/mois</FormLabel><input type="number" value={profileForm.contract_days_per_month} onChange={e => setProfileForm(p => ({ ...p, contract_days_per_month: e.target.value }))} style={S.input} /></div>
                  </>)}
                </div>

                <label style={S.toggleItem}><input type="checkbox" checked={profileForm.overtime_eligible} onChange={e => setProfileForm(p => ({ ...p, overtime_eligible: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>Éligible aux heures supplémentaires</span><span style={S.toggleDesc}>Les heures sup seront valorisées</span></div></label>

                {/* Mode paiement */}
                <div style={{ ...S.toggleSection, marginTop: 16 }}>
                  <p style={S.toggleSectionTitle}>Mode de paiement</p>
                  <div className="pay-form-grid" style={S.formGrid}>
                    <div style={S.formGroup}><FormLabel>Mode principal</FormLabel>
                      <select value={profileForm.payment_method} onChange={e => setProfileForm(p => ({ ...p, payment_method: e.target.value }))} style={S.select}>
                        <option value="">Sélectionner</option><option value="virement_bancaire">Virement bancaire</option><option value="mobile_money">Mobile Money</option><option value="especes">Espèces</option><option value="cheque">Chèque</option>
                      </select>
                    </div>
                    <div style={S.formGroup}><FormLabel>Fréquence</FormLabel>
                      <select value={profileForm.payment_frequency} onChange={e => setProfileForm(p => ({ ...p, payment_frequency: e.target.value }))} style={S.select}>
                        <option value="monthly">Mensuelle</option><option value="biweekly">Bimensuelle</option><option value="weekly">Hebdomadaire</option>
                      </select>
                    </div>
                    <div style={S.formGroup}><FormLabel>Jour de paiement</FormLabel><input type="number" min="1" max="31" value={profileForm.preferred_payment_day} onChange={e => setProfileForm(p => ({ ...p, preferred_payment_day: e.target.value }))} style={S.input} /></div>
                  </div>

                  {profileForm.payment_method === 'mobile_money' && (
                    <div className="pay-form-grid" style={S.formGrid}>
                      <div style={S.formGroup}><FormLabel>Opérateur</FormLabel>
                        <select value={profileForm.mobile_money_provider} onChange={e => setProfileForm(p => ({ ...p, mobile_money_provider: e.target.value }))} style={S.select}>
                          <option value="">Sélectionner</option><option value="Orange Money">Orange Money</option><option value="MTN MoMo">MTN MoMo</option><option value="Wave">Wave</option><option value="Moov Money">Moov Money</option><option value="Free Money">Free Money</option><option value="M-Pesa">M-Pesa</option><option value="Airtel Money">Airtel Money</option>
                        </select>
                      </div>
                      <div style={S.formGroup}><FormLabel>Numéro</FormLabel><input value={profileForm.mobile_money_number} onChange={e => setProfileForm(p => ({ ...p, mobile_money_number: e.target.value }))} style={S.input} placeholder="6XXXXXXXX" /></div>
                    </div>
                  )}
                  {profileForm.payment_method === 'virement_bancaire' && (
                    <div className="pay-form-grid" style={S.formGrid}>
                      <div style={S.formGroup}><FormLabel>Banque</FormLabel><input value={profileForm.bank_name} onChange={e => setProfileForm(p => ({ ...p, bank_name: e.target.value }))} style={S.input} /></div>
                      <div style={S.formGroup}><FormLabel>N° Compte</FormLabel><input value={profileForm.bank_account} onChange={e => setProfileForm(p => ({ ...p, bank_account: e.target.value }))} style={S.input} /></div>
                      <div style={S.formGroup}><FormLabel>IBAN</FormLabel><input value={profileForm.iban} onChange={e => setProfileForm(p => ({ ...p, iban: e.target.value }))} style={S.input} placeholder="Optionnel" /></div>
                      <div style={S.formGroup}><FormLabel>BIC/SWIFT</FormLabel><input value={profileForm.bic_swift} onChange={e => setProfileForm(p => ({ ...p, bic_swift: e.target.value }))} style={S.input} placeholder="Optionnel" /></div>
                    </div>
                  )}
                </div>

                <div style={S.actionsRow}><button onClick={handleSaveProfile} style={S.primaryBtn} disabled={saving}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Enregistrer ce profil</span></button></div>

                {/* Primes récurrentes */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ color: '#DDD', fontSize: 13, fontWeight: 700, margin: 0 }}>Primes récurrentes ({selectedEmployeeAllowances.length})</p>
                    <button onClick={() => { setEditingAllowance(null); setShowAllowanceModal(true) }} style={S.addBtnSmall}><Plus size={14} /><span>Ajouter</span></button>
                  </div>
                  {selectedEmployeeAllowances.length === 0 ? <div style={S.emptyMini}><Gift size={16} color="#666" /><span>Aucune prime récurrente</span></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedEmployeeAllowances.map((a, i) => (
                        <div key={a.id || i} style={S.allowanceItem}>
                          <div style={{ flex: 1 }}><div style={{ color: '#FFF', fontSize: 13, fontWeight: 600 }}>{a.allowance_types?.name || a.custom_name || 'Prime'}</div><div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{a.calculation_type === 'fixed' ? fmt(a.amount) : `${a.percentage}% du salaire de base`}{a.end_date && ` • jusqu'au ${PayrollService.formatDate(a.end_date)}`}</div></div>
                          <CategoryBadge category={a.allowance_types?.category || 'other'} />
                          <button onClick={() => { setEditingAllowance(a); setShowAllowanceModal(true) }} style={S.iconBtn}><Edit size={14} /></button>
                          <button onClick={() => handleDeleteAllowance(a.id)} style={{ ...S.iconBtn, color: '#EF4444' }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Retenues récurrentes */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ color: '#DDD', fontSize: 13, fontWeight: 700, margin: 0 }}>Retenues récurrentes ({selectedEmployeeDeductions.length})</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingDeduction(null); setShowLoanModal(true) }} style={{ ...S.addBtnSmall, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#EF4444' }}><CreditCard size={14} /><span>Prêt</span></button>
                      <button onClick={() => { setEditingDeduction(null); setShowDeductionModal(true) }} style={{ ...S.addBtnSmall, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#EF4444' }}><Minus size={14} /><span>Retenue</span></button>
                    </div>
                  </div>
                  {selectedEmployeeDeductions.length === 0 ? <div style={S.emptyMini}><Minus size={16} color="#666" /><span>Aucune retenue récurrente</span></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedEmployeeDeductions.map((d, i) => (
                        <div key={d.id || i} style={{ ...S.allowanceItem, borderColor: 'rgba(239,68,68,0.15)' }}>
                          <div style={{ flex: 1 }}><div style={{ color: '#FFF', fontSize: 13, fontWeight: 600 }}>{d.name}</div><div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{fmt(d.monthly_amount)}/mois {d.remaining_balance !== null && `• Solde: ${fmt(d.remaining_balance)}`}{d.status === 'paused' && ' • ⏸ Pause'}{d.status === 'completed' && ' • ✓ Soldé'}</div></div>
                          <CategoryBadge category={d.deduction_types?.category || 'other'} />
                          <span style={{ ...S.statusBadge, background: d.status === 'active' ? 'rgba(16,185,129,0.12)' : d.status === 'paused' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)', color: d.status === 'active' ? '#10B981' : d.status === 'paused' ? '#F59E0B' : '#818CF8' }}>{d.status === 'active' ? 'Actif' : d.status === 'paused' ? 'Pause' : 'Soldé'}</span>
                          <button onClick={() => { setEditingDeduction(d); setShowDeductionModal(true) }} style={S.iconBtn}><Edit size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Liste profils */}
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: 'rgba(139,92,246,0.12)' }}><Briefcase size={18} color="#8B5CF6" /></div><div><h3 style={S.cardTitle}>Profils enregistrés</h3><p style={S.cardSub}>{profiles.length} / {employees.length} configurés</p></div></div>
                </div>
                <div style={S.profileProgress}><div style={S.profileProgressTrack}><div style={{ ...S.profileProgressFill, width: `${employees.length > 0 ? (profiles.length / employees.length) * 100 : 0}%` }} /></div><span style={S.profileProgressText}>{employees.length > 0 ? `${Math.round((profiles.length / employees.length) * 100)}% complété` : 'Aucun employé'}</span></div>
                <div style={S.listWrap}>
                  {profiles.length === 0 ? <div style={S.emptyMini}><AlertTriangle size={18} color="#666" /><span>Aucun profil enregistré</span></div> : profiles.map((profile, i) => (
                    <div key={profile.id || i} style={{ ...S.listItem, ...(profile.employee_id === selectedEmployeeId ? { borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' } : {}) }} onClick={() => setSelectedEmployeeId(profile.employee_id)}>
                      <div><div style={S.listTitle}>{profile.employees?.first_name} {profile.employees?.last_name}</div><div style={S.listSub}>{profile.employees?.matricule} • {profile.salary_type === 'monthly' ? 'Mensuel' : profile.salary_type === 'hourly' ? 'Horaire' : 'Journalier'} • {profile.salary_type === 'monthly' ? fmt(profile.base_salary) : profile.salary_type === 'hourly' ? `${fmt(profile.hourly_rate)}/h` : `${fmt(profile.daily_rate)}/j`}</div></div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <CheckCircle size={16} color="#10B981" />
                        <span style={{ ...S.typeBadge, background: profile.salary_type === 'monthly' ? 'rgba(99,102,241,0.12)' : profile.salary_type === 'hourly' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: profile.salary_type === 'monthly' ? '#818CF8' : profile.salary_type === 'hourly' ? '#F59E0B' : '#10B981' }}>{profile.salary_type === 'monthly' ? 'MENSUEL' : profile.salary_type === 'hourly' ? 'HORAIRE' : 'JOURNALIER'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ ONGLET PRIMES & RETENUES ═══ */}
          {activeTab === 'allowances' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: 'rgba(16,185,129,0.12)' }}><Gift size={18} color="#10B981" /></div><div><h3 style={S.cardTitle}>Primes ponctuelles — {periodStart ? new Date(periodStart + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Période'}</h3><p style={S.cardSub}>13ème mois, performance, mariage...</p></div></div>
                  <button onClick={() => { setSelectedBonusEmployeeId(employees[0]?.id || ''); setShowBonusModal(true) }} style={S.addBtn}><Plus size={16} /><span>Ajouter une prime</span></button></div>
                {periodBonuses.length === 0 ? <div style={S.emptyMini}><Gift size={18} color="#666" /><span>Aucune prime ponctuelle</span></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {periodBonuses.map((bonus, i) => (<div key={bonus.id || i} style={S.bonusItem}><div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#FFF', fontSize: 13, fontWeight: 700 }}>{bonus.name}</span><CategoryBadge category={bonus.allowance_types?.category || 'other'} />{bonus.is_taxable && <Badge color="#F59E0B">Imposable</Badge>}</div><div style={{ color: '#888', fontSize: 11, marginTop: 3 }}>{bonus.employees?.first_name} {bonus.employees?.last_name} ({bonus.employees?.matricule}){bonus.reason && ` • ${bonus.reason}`}</div></div><span style={{ color: '#10B981', fontSize: 15, fontWeight: 800 }}>{fmt(bonus.amount)}</span><button onClick={() => handleDeleteBonus(bonus.id)} style={{ ...S.iconBtn, color: '#EF4444' }}><Trash2 size={14} /></button></div>))}
                    <div style={S.totalRow}><span style={{ color: '#888' }}>Total</span><span style={{ color: '#10B981', fontWeight: 800 }}>{fmt(periodBonuses.reduce((s, b) => s + (b.amount || 0), 0))}</span></div>
                  </div>
                )}
              </div>

              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: 'rgba(239,68,68,0.12)' }}><Minus size={18} color="#EF4444" /></div><div><h3 style={S.cardTitle}>Retenues ponctuelles — {periodStart ? new Date(periodStart + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Période'}</h3><p style={S.cardSub}>Avances, remboursements...</p></div></div>
                  <button onClick={() => { setSelectedDeductionEmployeeId(employees[0]?.id || ''); setShowPeriodDeductionModal(true) }} style={{ ...S.addBtn, borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}><Plus size={16} /><span>Ajouter une retenue</span></button></div>
                {periodDeductions.length === 0 ? <div style={S.emptyMini}><Minus size={18} color="#666" /><span>Aucune retenue ponctuelle</span></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {periodDeductions.map((ded, i) => (<div key={ded.id || i} style={{ ...S.bonusItem, borderColor: 'rgba(239,68,68,0.15)' }}><div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#FFF', fontSize: 13, fontWeight: 700 }}>{ded.name}</span><CategoryBadge category={ded.deduction_types?.category || 'other'} /></div><div style={{ color: '#888', fontSize: 11, marginTop: 3 }}>{ded.employees?.first_name} {ded.employees?.last_name}{ded.reason && ` • ${ded.reason}`}</div></div><span style={{ color: '#EF4444', fontSize: 15, fontWeight: 800 }}>- {fmt(ded.amount)}</span><button onClick={() => handleDeletePeriodDeduction(ded.id)} style={{ ...S.iconBtn, color: '#EF4444' }}><Trash2 size={14} /></button></div>))}
                    <div style={S.totalRow}><span style={{ color: '#888' }}>Total</span><span style={{ color: '#EF4444', fontWeight: 800 }}>- {fmt(periodDeductions.reduce((s, d) => s + (d.amount || 0), 0))}</span></div>
                  </div>
                )}
              </div>

              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: 'rgba(99,102,241,0.12)' }}><Layers size={18} color="#6366F1" /></div><div><h3 style={S.cardTitle}>Primes récurrentes par employé</h3><p style={S.cardSub}>Gérez depuis l'onglet Profils</p></div></div></div>
                <SearchBar value={searchAllowance} onChange={setSearchAllowance} placeholder="Rechercher un employé..." />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {(searchAllowance ? employees.filter(e => `${e.first_name} ${e.last_name} ${e.matricule}`.toLowerCase().includes(searchAllowance.toLowerCase())) : employees.slice(0, 10)).map(emp => (
                    <div key={emp.id} style={S.listItem} onClick={() => { setSelectedEmployeeId(emp.id); setActiveTab('profiles') }}>
                      <div><div style={S.listTitle}>{emp.first_name} {emp.last_name}</div><div style={S.listSub}>{emp.matricule}</div></div>
                      <button style={S.addBtnSmall} onClick={(e) => { e.stopPropagation(); setSelectedEmployeeId(emp.id); setActiveTab('profiles') }}><Edit size={12} /><span>Gérer</span></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ ONGLET IMPORT ═══ */}
          {activeTab === 'imports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={S.guideBar}><FileSpreadsheet size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} /><div><p style={S.guideTitle}>Format attendu</p><p style={S.guideText}>Le fichier doit contenir une colonne <strong>matricule</strong>. Les colonnes positives sont des gains, les négatives des retenues.</p></div></div>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={S.cardIcon}><Upload size={18} color="#F59E0B" /></div><div><h3 style={S.cardTitle}>Importer les variables mensuelles</h3><p style={S.cardSub}>Primes, avances, commissions...</p></div></div></div>
                <div style={S.importZone}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={S.fileInput} id="payroll-file-input" />
                  <label htmlFor="payroll-file-input" style={S.fileInputLabel}>{importingFile ? <><RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /><span>Lecture...</span></> : <><FileSpreadsheet size={16} /><span>Choisir un fichier Excel / CSV</span></>}</label>
                  {importFileName && <div style={S.importFileInfo}><span style={{ color: '#FFF', fontWeight: 600 }}>{importFileName}</span><button onClick={() => { setImportFileName(''); setImportPreviewRows([]); setImportColumns([]) }} style={S.clearBtn}><Trash2 size={14} /><span>Effacer</span></button></div>}
                </div>
              </div>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: 'rgba(16,185,129,0.12)' }}><Eye size={18} color="#10B981" /></div><div><h3 style={S.cardTitle}>Aperçu de l'import</h3><p style={S.cardSub}>Validation par matricule</p></div></div>
                  {importPreviewRows.length > 0 && <button onClick={handleSaveImport} style={S.primaryBtn} disabled={savingImport}>{savingImport ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>{savingImport ? 'Enregistrement...' : 'Valider et enregistrer'}</span></button>}
                </div>
                {importPreviewRows.length === 0 ? <div style={S.emptyMini}><Upload size={18} color="#666" /><span>Importez un fichier pour voir l'aperçu</span></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {importPreviewRows.map((row, i) => (
                      <div key={i} style={{ ...S.importPreviewItem, borderColor: row.is_valid ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)', background: row.is_valid ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)' }}>
                        <div style={S.importPreviewHeader}><div><div style={S.importPreviewTitle}>Ligne {row.rowIndex} — {row.matricule || 'Sans matricule'}</div><div style={S.importPreviewSub}>{row.is_valid ? `✓ ${row.employee_name}` : `✗ ${row.error_message}`}</div></div><div style={{ ...S.importStatusBadge, background: row.is_valid ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: row.is_valid ? '#10B981' : '#EF4444' }}>{row.is_valid ? '✓ Valide' : '✗ Erreur'}</div></div>
                        <div style={S.importDataGrid}>{Object.entries(row.data || {}).map(([key, value]) => (<div key={key} style={S.importDataItem}><span style={S.importDataKey}>{key.replace(/_/g, ' ')}</span><span style={{ ...S.importDataValue, color: Number(value) < 0 ? '#EF4444' : '#FFF' }}>{String(value || 0)}</span></div>))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ ONGLET PREVIEW ═══ */}
          {activeTab === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={S.summaryTopGrid}>
                <div style={S.summaryTopCard}><DollarSign size={18} color="#10B981" /><div><div style={S.summaryTopValue}>{fmt(summary.totalGross)}</div><div style={S.summaryTopLabel}>Total brut</div></div></div>
                <div style={S.summaryTopCard}><Wallet size={18} color="#F59E0B" /><div><div style={S.summaryTopValue}>{fmt(summary.totalNet)}</div><div style={S.summaryTopLabel}>Total net</div></div></div>
                <div style={S.summaryTopCard}><TrendingUp size={18} color="#EF4444" /><div><div style={S.summaryTopValue}>{fmt(summary.totalCost)}</div><div style={S.summaryTopLabel}>Coût employeur</div></div></div>
                <div style={S.summaryTopCard}><Users size={18} color="#6366F1" /><div><div style={S.summaryTopValue}>{summary.totalEmployees}</div><div style={S.summaryTopLabel}>Fiches calculées</div></div></div>
                <div style={S.summaryTopCard}><Send size={18} color={summary.alreadySent > 0 ? '#10B981' : '#666'} /><div><div style={S.summaryTopValue}>{summary.alreadySent} / {summary.totalEmployees}</div><div style={S.summaryTopLabel}>Envoyées</div></div></div>
              </div>

              {previewRows.length > 0 && (
                <div style={S.sendAllBar}>
                  <div style={{ flex: 1 }}><p style={{ color: '#FFF', fontSize: 14, fontWeight: 700, margin: '0 0 4px 0' }}>Publier les fiches</p><p style={{ color: '#888', fontSize: 12, margin: 0 }}>Chaque employé pourra consulter sa fiche.{hasSignatures && ' Les signatures seront incluses.'}{hasStamp && ' Le cachet sera inclus.'}</p></div>
                  <button onClick={handleExportExcel} style={S.exportBtn}><Table size={16} /><span>Export Excel</span></button>
                  <button onClick={handleSendAllToEmployees} style={S.sendAllBtn} disabled={sendingSlips}>
                    {sendingSlips ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Send size={16} />}
                    <span>{sendingSlips ? 'Envoi...' : `Envoyer ${previewRows.length} fiche(s)`}</span>
                  </button>
                </div>
              )}

              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: 'rgba(16,185,129,0.12)' }}><FileText size={18} color="#10B981" /></div><div><h3 style={S.cardTitle}>Bulletins de paie</h3><p style={S.cardSub}>Période : {periodStart} → {periodEnd} • {getWorkingDaysInMonth} jours ouvrables</p></div></div></div>
                <SearchBar value={searchPreview} onChange={setSearchPreview} placeholder="Filtrer les fiches..." />

                {filteredPreviewRows.length === 0 ? (
                  <div style={{ ...S.emptyMini, marginTop: 12 }}><Calendar size={18} color="#666" /><span>{previewRows.length === 0 ? 'Cliquez sur "Générer les fiches"' : 'Aucun résultat'}</span></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {filteredPreviewRows.map((row, i) => {
                      const isSent = sentSlips.has(row.employee?.id)
                      const salaryTypeLabel = { monthly: 'Mensuel', hourly: 'Horaire', daily: 'Journalier' }[row.profile?.salary_type] || 'Mensuel'
                      const empCumul = annualCumuls[row.employee?.id]
                      const empLeave = leaveBalances[row.employee?.id]

                      return (
                        <div key={row.employee?.id || i} style={S.previewCard}>
                          <div style={S.previewHeader}>
                            <div>
                              <div style={S.previewName}>
                                {row.employee?.first_name} {row.employee?.last_name}
                                <Badge color={row.profile?.salary_type === 'monthly' ? '#6366F1' : row.profile?.salary_type === 'hourly' ? '#F59E0B' : '#10B981'}>{salaryTypeLabel}</Badge>
                                {row.employee?.classification && <Badge color="#8B5CF6">{row.employee.classification}</Badge>}
                                {isSent && <span style={S.sentBadge}><CheckCircle2 size={12} /> Envoyée</span>}
                              </div>
                              <div style={S.previewSub}>
                                {row.employee?.matricule} • {row.employee?.position || row.employee?.department || 'Employé'}
                                {row.employee?.cnps_number && ` • ${socialOrgLabel ? `${socialOrgLabel}: ${row.employee.cnps_number}` : row.employee.cnps_number}`}
                                {row.sources?.encheck?.workedDays > 0 && ` • ${row.sources.encheck.workedDays}j travaillés`}
                                {row.employee?.hire_date && ` • Emb: ${new Date(row.employee.hire_date).toLocaleDateString('fr-FR')}`}
                              </div>
                            </div>
                            <div style={S.previewActions}>
                              <div style={S.previewNet}>{fmt(row.netSalary)}</div>
                              <button onClick={() => handleDownloadSlip(row)} style={S.downloadBtn}><Download size={14} /><span>PDF</span></button>
                              <button onClick={() => handleSendToEmployee(row)} style={{ ...S.sendBtn, ...(isSent ? { opacity: 0.6 } : {}) }}><Send size={14} /><span>{isSent ? 'Renvoyer' : 'Envoyer'}</span></button>
                              {isSent && <button onClick={() => handleDeleteSentSlip(row)} style={S.deleteSentBtn} title="Retirer"><Trash2 size={14} /><span>Retirer</span></button>}
                            </div>
                          </div>

                          <div style={S.previewGrid}>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Base / Taux</span><span style={S.previewMiniValue}>{row.profile?.salary_type === 'monthly' ? fmt(row.profile?.base_salary) : row.profile?.salary_type === 'hourly' ? `${fmt(row.profile?.hourly_rate)}/h` : `${fmt(row.profile?.daily_rate)}/j`}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Total gains</span><span style={{ ...S.previewMiniValue, color: '#10B981' }}>{fmt(row.totalEarnings)}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Salaire brut</span><span style={S.previewMiniValue}>{fmt(row.grossSalary)}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Total retenues</span><span style={{ ...S.previewMiniValue, color: '#EF4444' }}>- {fmt(row.totalDeductions)}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Coût employeur</span><span style={S.previewMiniValue}>{fmt(row.employerCost)}</span></div>
                            {row.sources?.encheck?.totalOvertimeAllMinutes > 0 && <div style={S.previewMini}><span style={S.previewMiniLabel}>Heures sup</span><span style={{ ...S.previewMiniValue, color: '#F97316' }}>{Math.floor(row.sources.encheck.totalOvertimeAllMinutes / 60)}h{(row.sources.encheck.totalOvertimeAllMinutes % 60).toString().padStart(2, '0')}</span></div>}
                            {empLeave && <div style={S.previewMini}><span style={S.previewMiniLabel}>Congés restants</span><span style={{ ...S.previewMiniValue, color: '#6366F1' }}>{empLeave.remaining}j / {empLeave.acquired}j</span></div>}
                          </div>

                          {row.earnings?.length > 0 && (
                            <div style={S.earningsDetail}><p style={S.detailTitle}>Gains ({row.earnings.length})</p><div style={S.detailGrid}>{row.earnings.map((e, ei) => (<div key={ei} style={S.detailLine}><span style={{ color: '#AAA', fontSize: 11 }}>{e.label}</span><span style={{ color: '#10B981', fontSize: 11, fontWeight: 700 }}>{fmt(e.amount)}</span></div>))}</div></div>
                          )}

                          {row.taxation && (
                            <div style={S.taxBlock}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Shield size={15} color="#8B5CF6" />
                                <span style={{ color: '#A78BFA', fontSize: 13, fontWeight: 700 }}>Fiscalité & Cotisations</span>
                                {(row.impot_a_verifier || row.taxation?.impot_a_verifier) && (
                                  <span style={{
                                    marginLeft: 'auto',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(245,158,11,0.16)',
                                    border: '1px solid rgba(245,158,11,0.35)',
                                    color: '#F59E0B',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}>
                                    ⚠️ Simulation provisoire — Barème à vérifier
                                  </span>
                                )}
                              </div>
                              {(row.avertissement || row.taxation?.avertissement) && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  padding: '10px 12px',
                                  marginBottom: 10,
                                  borderRadius: 10,
                                  background: 'rgba(245,158,11,0.08)',
                                  border: '1px solid rgba(245,158,11,0.28)',
                                  color: '#FCD34D',
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                }}>
                                  <AlertTriangle size={15} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                                  <span>{row.avertissement || row.taxation?.avertissement}</span>
                                </div>
                              )}
                              <div style={S.taxGrid}>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Revenu imposable</span><span style={S.taxMiniValue}>{fmt(row.taxation.taxableIncome || 0)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Net imposable</span><span style={S.taxMiniValue}>{fmt((row.grossSalary || 0) - (row.taxation?.contributions?.totalEmployee || 0))}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Impôt IRPP</span><span style={{ ...S.taxMiniValue, color: '#EF4444' }}>{fmt(row.taxation.tax?.totalTax || 0)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Taux effectif</span><span style={S.taxMiniValue}>{row.taxation.tax?.effectiveRate || 0}%</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Cotis. salariales</span><span style={S.taxMiniValue}>{fmt(row.taxation.contributions?.totalEmployee || 0)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Cotis. patronales</span><span style={S.taxMiniValue}>{fmt(row.taxation.contributions?.totalEmployer || 0)}</span></div>
                              </div>
                            </div>
                          )}

                          {/* Cumuls annuels */}
                          {empCumul && empCumul.slipCount > 0 && (
                            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><TrendingUp size={14} color="#F59E0B" /><span style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700 }}>Cumuls annuels ({empCumul.slipCount} mois)</span></div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Brut cumulé</span><span style={S.taxMiniValue}>{fmt(empCumul.grossTotal)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Net cumulé</span><span style={S.taxMiniValue}>{fmt(empCumul.netTotal)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Cotis. cumulées</span><span style={S.taxMiniValue}>{fmt(empCumul.employeeContribTotal)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Impôt cumulé</span><span style={S.taxMiniValue}>{fmt(empCumul.taxTotal)}</span></div>
                              </div>
                            </div>
                          )}

                          {/* Zone signatures + cachet */}
                          {(settings.signatory1_signature || settings.signatory2_signature || settings.company_stamp) && (
                            <div style={S.signaturePreviewBlock}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                                {settings.signatory1_signature && (
                                  <div style={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
                                    <img src={settings.signatory1_signature} alt="Sig1" style={{ maxWidth: 120, maxHeight: 50, objectFit: 'contain' }} />
                                    {settings.signatory1_name && <p style={{ color: '#888', fontSize: 10, fontWeight: 600, margin: '4px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>{settings.signatory1_name}</p>}
                                    {settings.signatory1_title && <p style={{ color: '#555', fontSize: 9, margin: '2px 0 0 0' }}>{settings.signatory1_title}</p>}
                                  </div>
                                )}
                                {settings.company_stamp && (
                                  <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                                    <img src={settings.company_stamp} alt="Cachet" style={{ maxWidth: 80, maxHeight: 80, objectFit: 'contain', opacity: 0.8 }} />
                                  </div>
                                )}
                                {settings.signatory2_signature && (
                                  <div style={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
                                    <img src={settings.signatory2_signature} alt="Sig2" style={{ maxWidth: 120, maxHeight: 50, objectFit: 'contain' }} />
                                    {settings.signatory2_name && <p style={{ color: '#888', fontSize: 10, fontWeight: 600, margin: '4px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>{settings.signatory2_name}</p>}
                                    {settings.signatory2_title && <p style={{ color: '#555', fontSize: 9, margin: '2px 0 0 0' }}>{settings.signatory2_title}</p>}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Mention légale */}
                          {settings.legal_mention && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <p style={{ color: '#555', fontSize: 9, margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{settings.legal_mention}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ MODALES ═══ */}
          {showAllowanceModal && <AllowanceModal allowance={editingAllowance} employeeId={selectedEmployeeId} employees={employees} allowanceTypes={allowanceTypes} currency={settings.currency} onSave={handleSaveAllowance} onClose={() => { setShowAllowanceModal(false); setEditingAllowance(null) }} saving={saving} />}
          {showDeductionModal && <DeductionModal deduction={editingDeduction} employeeId={selectedEmployeeId} employees={employees} deductionTypes={deductionTypes} currency={settings.currency} onSave={handleSaveDeduction} onClose={() => { setShowDeductionModal(false); setEditingDeduction(null) }} saving={saving} />}
          {showLoanModal && <LoanModal employeeId={selectedEmployeeId} employees={employees} currency={settings.currency} onSave={handleSaveDeduction} onClose={() => setShowLoanModal(false)} saving={saving} />}
          {showBonusModal && <BonusModal employees={employees} allowanceTypes={allowanceTypes} defaultEmployeeId={selectedBonusEmployeeId} currency={settings.currency} periodStart={periodStart} periodEnd={periodEnd} onSave={handleSaveBonus} onClose={() => setShowBonusModal(false)} saving={saving} />}
          {showPeriodDeductionModal && <PeriodDeductionModal employees={employees} deductionTypes={deductionTypes} defaultEmployeeId={selectedDeductionEmployeeId} currency={settings.currency} onSave={handleSavePeriodDeduction} onClose={() => setShowPeriodDeductionModal(false)} saving={saving} />}

          {/* Modale suppression */}
          {showDeleteModal && slipToDelete && (
            <div style={S.modalOverlay} onClick={() => { if (!deletingSlip) { setShowDeleteModal(false); setSlipToDelete(null) } }}>
              <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={22} color="#EF4444" /></div><div><h3 style={S.modalTitle}>Retirer cette fiche ?</h3><p style={S.modalSub}>Elle ne sera plus visible par l'employé.</p></div></div><button onClick={() => { if (!deletingSlip) { setShowDeleteModal(false); setSlipToDelete(null) } }} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20 }}><div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}><p style={{ margin: 0, color: '#DDD', fontSize: 13 }}><strong>Employé :</strong> {slipToDelete.employee?.first_name} {slipToDelete.employee?.last_name}</p><p style={{ margin: 0, color: '#DDD', fontSize: 13 }}><strong>Période :</strong> {periodStart} → {periodEnd}</p><p style={{ margin: 0, color: '#DDD', fontSize: 13 }}><strong>Net :</strong> {fmt(slipToDelete.netSalary)}</p></div></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button onClick={() => { if (!deletingSlip) { setShowDeleteModal(false); setSlipToDelete(null) } }} style={S.modalCancelBtn} disabled={deletingSlip}>Annuler</button>
                  <button onClick={confirmDeleteSentSlip} style={S.modalDeleteBtn} disabled={deletingSlip}>{deletingSlip ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Trash2 size={16} />}<span>{deletingSlip ? 'Suppression...' : 'Retirer'}</span></button>
                </div>
              </div>
            </div>
          )}

          {/* Modale confirmation génération */}
          {showGenerateConfirm && (
            <div style={S.modalOverlay} onClick={() => setShowGenerateConfirm(false)}>
              <div style={{ ...S.modalContent, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={22} color="#F59E0B" /></div><div><h3 style={S.modalTitle}>Problèmes détectés</h3><p style={S.modalSub}>{preCheckResults.blockers.length} employé(s) sans profil valide</p></div></div><button onClick={() => setShowGenerateConfirm(false)} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20 }}><p style={{ color: '#AAA', fontSize: 13, margin: '0 0 12px 0' }}>Les employés suivants auront une fiche à 0 :</p><div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>{preCheckResults.blockers.map((b, i) => (<div key={i} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 10 }}><span style={{ color: '#FCA5A5', fontSize: 12 }}>{b.employee} — {b.reason}</span></div>))}</div></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={() => setShowGenerateConfirm(false)} style={S.modalCancelBtn}>Annuler</button><button onClick={handleGeneratePreview} style={S.primaryBtn}><Eye size={16} /><span>Générer quand même</span></button></div>
              </div>
            </div>
          )}

          {/* Modale historique */}
          {showHistoryModal && (
            <div style={S.modalOverlay} onClick={() => setShowHistoryModal(false)}>
              <div style={{ ...S.modalContent, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><History size={22} color="#818CF8" /></div><div><h3 style={S.modalTitle}>Historique des périodes</h3><p style={S.modalSub}>Cliquez sur une période pour la sélectionner</p></div></div><button onClick={() => setShowHistoryModal(false)} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
                  {loadingHistory ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 }}><RefreshCw size={20} color="#F59E0B" style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ color: '#888' }}>Chargement...</span></div>
                    : historyPeriods.length === 0 ? <div style={S.emptyMini}><History size={20} color="#666" /><span>Aucune fiche envoyée</span></div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {historyPeriods.map((period, i) => {
                          const isCurrentPeriod = period.period_start === periodStart && period.period_end === periodEnd
                          const periodLabel = new Date(period.period_start + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
                          return (<div key={i} onClick={() => handleSelectHistoryPeriod(period)} style={{ padding: '14px 16px', borderRadius: 14, background: isCurrentPeriod ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', border: isCurrentPeriod ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}>
                            <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><span style={{ color: '#FFF', fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{periodLabel}</span>{isCurrentPeriod && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.2)', color: '#818CF8' }}>Période actuelle</span>}</div><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><span style={{ color: '#888', fontSize: 12 }}><span style={{ color: '#10B981', fontWeight: 700 }}>{period.count}</span> fiche(s)</span><span style={{ color: '#888', fontSize: 12 }}>Net: <span style={{ color: '#F59E0B', fontWeight: 700 }}>{fmt(period.totalNet)}</span></span></div></div>
                            <ArrowRight size={16} color="#666" />
                          </div>)
                        })}
                      </div>}
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setShowHistoryModal(false)} style={S.modalCancelBtn}>Fermer</button></div>
              </div>
            </div>
          )}

          {/* Modale copie profil */}
          {showCopyProfileModal && (
            <div style={S.modalOverlay} onClick={() => setShowCopyProfileModal(false)}>
              <div style={{ ...S.modalContent, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Copy size={22} color="#F59E0B" /></div><div><h3 style={S.modalTitle}>Copier un profil</h3><p style={S.modalSub}>Vers : {employees.find(e => e.id === selectedEmployeeId)?.first_name} {employees.find(e => e.id === selectedEmployeeId)?.last_name}</p></div></div><button onClick={() => setShowCopyProfileModal(false)} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20 }}>
                  <div style={S.formGroup}><label style={S.labelSmall}>Copier le profil de</label>
                    <select value={copySourceEmployeeId} onChange={e => setCopySourceEmployeeId(e.target.value)} style={S.select}><option value="">Sélectionner un employé source</option>{profiles.filter(p => p.employee_id !== selectedEmployeeId).map(p => (<option key={p.employee_id} value={p.employee_id}>{p.employees?.first_name} {p.employees?.last_name} ({p.employees?.matricule}) — {p.salary_type === 'monthly' ? fmt(p.base_salary) : p.salary_type === 'hourly' ? `${fmt(p.hourly_rate)}/h` : `${fmt(p.daily_rate)}/j`}</option>))}</select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={() => setShowCopyProfileModal(false)} style={S.modalCancelBtn}>Annuler</button><button onClick={handleCopyProfile} style={S.primaryBtn} disabled={!copySourceEmployeeId}><Copy size={16} /><span>Copier ce profil</span></button></div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// MODALES PRIMES & RETENUES (identiques à l'original)
// ═══════════════════════════════════════════════════════════

function AllowanceModal({ allowance, employeeId, employees, allowanceTypes, currency, onSave, onClose, saving }) {
  const [form, setForm] = useState(allowance || { employee_id: employeeId || '', allowance_type_id: '', custom_name: '', calculation_type: 'fixed', amount: '', percentage: '', is_taxable: true, is_subject_to_contributions: true, start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' })
  const selectedType = allowanceTypes.find(t => t.id === form.allowance_type_id)
  useEffect(() => { if (selectedType) setForm(prev => ({ ...prev, custom_name: selectedType.name, calculation_type: selectedType.calculation_type || 'fixed', is_taxable: selectedType.is_taxable, is_subject_to_contributions: selectedType.is_subject_to_contributions })) }, [form.allowance_type_id])
  return (<div style={S.modalOverlay} onClick={onClose}><div style={S.modalContent} onClick={e => e.stopPropagation()}><div style={S.modalHeader}><h3 style={S.modalTitle}>{allowance ? 'Modifier la prime' : 'Nouvelle prime récurrente'}</h3><button onClick={onClose} style={S.modalCloseBtn}><X size={18} /></button></div><div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}><div style={S.formGroup}><label style={S.labelSmall}>Employé *</label><select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} style={S.select}><option value="">Sélectionner</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule})</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Type de prime</label><select value={form.allowance_type_id} onChange={e => setForm(p => ({ ...p, allowance_type_id: e.target.value }))} style={S.select}><option value="">Personnalisée</option>{allowanceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Nom *</label><input value={form.custom_name} onChange={e => setForm(p => ({ ...p, custom_name: e.target.value }))} style={S.input} placeholder="Ex: Prime d'ancienneté" /></div><div style={S.formGroup}><label style={S.labelSmall}>Mode de calcul</label><select value={form.calculation_type} onChange={e => setForm(p => ({ ...p, calculation_type: e.target.value }))} style={S.select}><option value="fixed">Montant fixe</option><option value="percentage">% du salaire de base</option></select></div>{form.calculation_type === 'fixed' && <div style={S.formGroup}><label style={S.labelSmall}>Montant ({currency}) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={S.input} /></div>}{form.calculation_type === 'percentage' && <div style={S.formGroup}><label style={S.labelSmall}>Pourcentage (%) *</label><input type="number" step="0.1" value={form.percentage} onChange={e => setForm(p => ({ ...p, percentage: e.target.value }))} style={S.input} /></div>}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={S.formGroup}><label style={S.labelSmall}>Date début *</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Date fin</label><input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} style={S.input} /></div></div><label style={S.toggleItem}><input type="checkbox" checked={form.is_taxable} onChange={e => setForm(p => ({ ...p, is_taxable: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>Imposable</span></div></label><label style={S.toggleItem}><input type="checkbox" checked={form.is_subject_to_contributions} onChange={e => setForm(p => ({ ...p, is_subject_to_contributions: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>Soumise aux cotisations</span></div></label></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={onClose} style={S.modalCancelBtn}>Annuler</button><button onClick={() => onSave(form)} style={S.primaryBtn} disabled={saving || !form.employee_id || !form.custom_name}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Enregistrer</span></button></div></div></div>)
}

function DeductionModal({ deduction, employeeId, employees, deductionTypes, currency, onSave, onClose, saving }) {
  const [form, setForm] = useState(deduction || { employee_id: employeeId || '', deduction_type_id: '', code: '', name: '', calculation_type: 'fixed', monthly_amount: '', max_percentage_of_net: '', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '', status: 'active' })
  return (<div style={S.modalOverlay} onClick={onClose}><div style={S.modalContent} onClick={e => e.stopPropagation()}><div style={S.modalHeader}><h3 style={S.modalTitle}>{deduction ? 'Modifier la retenue' : 'Nouvelle retenue récurrente'}</h3><button onClick={onClose} style={S.modalCloseBtn}><X size={18} /></button></div><div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}><div style={S.formGroup}><label style={S.labelSmall}>Employé *</label><select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} style={S.select}><option value="">Sélectionner</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule})</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Type</label><select value={form.deduction_type_id} onChange={e => { const type = deductionTypes.find(t => t.id === e.target.value); setForm(p => ({ ...p, deduction_type_id: e.target.value, name: type?.name || p.name, code: type?.code || p.code })) }} style={S.select}><option value="">Personnalisée</option>{deductionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Nom *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Montant mensuel ({currency}) *</label><input type="number" value={form.monthly_amount} onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} style={S.input} /></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div style={S.formGroup}><label style={S.labelSmall}>Date début *</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Date fin</label><input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} style={S.input} /></div></div></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={onClose} style={S.modalCancelBtn}>Annuler</button><button onClick={() => onSave({ ...form, code: form.code || `deduction_${Date.now()}` })} style={S.primaryBtn} disabled={saving || !form.employee_id || !form.name}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Enregistrer</span></button></div></div></div>)
}

function LoanModal({ employeeId, employees, currency, onSave, onClose, saving }) {
  const [form, setForm] = useState({ employee_id: employeeId || '', code: `loan_${Date.now()}`, name: 'Prêt entreprise', calculation_type: 'remaining', monthly_amount: '', total_amount: '', remaining_balance: '', interest_rate: '', start_date: new Date().toISOString().split('T')[0], status: 'active', notes: '' })
  const monthsToRepay = form.monthly_amount && form.total_amount ? Math.ceil(parseFloat(form.total_amount) / parseFloat(form.monthly_amount)) : null
  return (<div style={S.modalOverlay} onClick={onClose}><div style={S.modalContent} onClick={e => e.stopPropagation()}><div style={S.modalHeader}><h3 style={S.modalTitle}>Nouveau prêt / Avance</h3><button onClick={onClose} style={S.modalCloseBtn}><X size={18} /></button></div><div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}><div style={S.formGroup}><label style={S.labelSmall}>Employé *</label><select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} style={S.select}><option value="">Sélectionner</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule})</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Libellé *</label><select value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.select}><option value="Prêt entreprise">Prêt entreprise</option><option value="Avance sur salaire">Avance sur salaire</option><option value="Prêt équipement">Prêt équipement</option></select></div><div style={S.formGroup}><label style={S.labelSmall}>Montant total ({currency}) *</label><input type="number" value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: e.target.value, remaining_balance: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Remboursement mensuel ({currency}) *</label><input type="number" value={form.monthly_amount} onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} style={S.input} /></div>{monthsToRepay && <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12 }}><p style={{ color: '#818CF8', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' }}>Simulation</p><p style={{ color: '#888', fontSize: 12, margin: 0 }}>{monthsToRepay} mois</p></div>}<div style={S.formGroup}><label style={S.labelSmall}>Date début *</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={S.input} /></div></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={onClose} style={S.modalCancelBtn}>Annuler</button><button onClick={() => onSave(form)} style={S.primaryBtn} disabled={saving || !form.employee_id || !form.total_amount || !form.monthly_amount}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Créer le prêt</span></button></div></div></div>)
}

function BonusModal({ employees, allowanceTypes, defaultEmployeeId, currency, onSave, onClose, saving }) {
  const [form, setForm] = useState({ employee_id: defaultEmployeeId || '', allowance_type_id: '', code: `bonus_${Date.now()}`, name: '', amount: '', is_taxable: true, is_subject_to_contributions: true, reason: '' })
  return (<div style={S.modalOverlay} onClick={onClose}><div style={S.modalContent} onClick={e => e.stopPropagation()}><div style={S.modalHeader}><h3 style={S.modalTitle}>Nouvelle prime ponctuelle</h3><button onClick={onClose} style={S.modalCloseBtn}><X size={18} /></button></div><div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}><div style={S.formGroup}><label style={S.labelSmall}>Employé *</label><select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} style={S.select}><option value="">Sélectionner</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule})</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Type</label><select value={form.allowance_type_id} onChange={e => { const type = allowanceTypes.find(t => t.id === e.target.value); setForm(p => ({ ...p, allowance_type_id: e.target.value, name: type?.name || p.name, code: type?.code || `bonus_${Date.now()}`, is_taxable: type?.is_taxable ?? p.is_taxable })) }} style={S.select}><option value="">Personnalisée</option>{allowanceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Libellé *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Montant ({currency}) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Motif</label><input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} style={S.input} /></div><label style={S.toggleItem}><input type="checkbox" checked={form.is_taxable} onChange={e => setForm(p => ({ ...p, is_taxable: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>Imposable</span></div></label></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={onClose} style={S.modalCancelBtn}>Annuler</button><button onClick={() => onSave(form)} style={S.primaryBtn} disabled={saving || !form.employee_id || !form.name || !form.amount}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Ajouter</span></button></div></div></div>)
}

function PeriodDeductionModal({ employees, deductionTypes, defaultEmployeeId, currency, onSave, onClose, saving }) {
  const [form, setForm] = useState({ employee_id: defaultEmployeeId || '', deduction_type_id: '', code: `ded_${Date.now()}`, name: '', amount: '', reason: '' })
  return (<div style={S.modalOverlay} onClick={onClose}><div style={S.modalContent} onClick={e => e.stopPropagation()}><div style={S.modalHeader}><h3 style={S.modalTitle}>Nouvelle retenue ponctuelle</h3><button onClick={onClose} style={S.modalCloseBtn}><X size={18} /></button></div><div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}><div style={S.formGroup}><label style={S.labelSmall}>Employé *</label><select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} style={S.select}><option value="">Sélectionner</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.matricule})</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Type</label><select value={form.deduction_type_id} onChange={e => { const type = deductionTypes.find(t => t.id === e.target.value); setForm(p => ({ ...p, deduction_type_id: e.target.value, name: type?.name || p.name, code: type?.code || `ded_${Date.now()}` })) }} style={S.select}><option value="">Personnalisée</option>{deductionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div style={S.formGroup}><label style={S.labelSmall}>Libellé *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Montant ({currency}) *</label><input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={S.input} /></div><div style={S.formGroup}><label style={S.labelSmall}>Motif</label><input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} style={S.input} /></div></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}><button onClick={onClose} style={S.modalCancelBtn}>Annuler</button><button onClick={() => onSave(form)} style={S.primaryBtn} disabled={saving || !form.employee_id || !form.name || !form.amount}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Ajouter</span></button></div></div></div>)
}

// ═══════════════════════════════════════════════════════════
// STYLES COMPLETS
// ═══════════════════════════════════════════════════════════

const S = {
  container: { maxWidth: 1200, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', minHeight: '100vh' },
  loadingWrap: { minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  backBtn: { width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  logoBox: { width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '2px' },
  subtitle: { color: '#888', fontSize: '12px', margin: '4px 0 0 0' },
  otBadge: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: 20 },
  historyBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.1)', color: '#818CF8', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  guideBar: { display: 'flex', gap: 12, padding: '16px 18px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 16 },
  guideTitle: { color: '#F59E0B', fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' },
  guideText: { color: '#AAA', fontSize: 12, margin: 0, lineHeight: 1.6 },
  preCheckBar: { padding: '14px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  preCheckSection: { display: 'flex', flexDirection: 'column', gap: 4 },
  preCheckItem: { paddingLeft: 20 },
  periodBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: 'rgba(20,20,35,0.75)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16 },
  periodGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  periodInfo: { display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(20,20,35,0.75)', color: '#888', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 13 },
  tabBtnActive: { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' },
  tabBadge: { background: 'rgba(245,158,11,0.2)', color: '#F59E0B', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  grid2: { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: { background: 'rgba(20,20,35,0.75)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: 700, margin: 0 },
  cardSub: { color: '#777', fontSize: 12, margin: '3px 0 0 0' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  labelSmall: { color: '#AAA', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#FFF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: 14 },
  select: { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#FFF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: 14 },
  textarea: { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#FFF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', fontSize: 14 },
  toggleSection: { marginBottom: 20 },
  toggleSectionTitle: { color: '#DDD', fontSize: 13, fontWeight: 700, margin: '0 0 8px 0' },
  toggleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 },
  toggleItem: { display: 'flex', alignItems: 'flex-start', gap: 10, color: '#DDD', fontSize: 13, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' },
  checkbox: { marginTop: 2, flexShrink: 0, accentColor: '#F59E0B' },
  toggleLabel: { display: 'block', fontWeight: 600, fontSize: 13, color: '#DDD' },
  toggleDesc: { display: 'block', fontSize: 11, color: '#777', marginTop: 2, lineHeight: 1.4 },
  otInfoBox: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 14, marginBottom: 16 },
  otEditBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)', color: '#F97316', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  actionsRow: { display: 'flex', gap: 10, marginTop: 8 },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.12)', color: '#10B981', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  addBtnSmall: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  copyBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.08)', color: '#F59E0B', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  exportBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  sendAllBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFF', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  downloadBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.22)', background: 'rgba(99,102,241,0.12)', color: '#818CF8', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  sendBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.22)', background: 'rgba(16,185,129,0.12)', color: '#10B981', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  deleteSentBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  modeBtn: { flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', textAlign: 'center' },
  modeBtnActive: { border: '2px solid #F59E0B', background: 'rgba(245,158,11,0.1)' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 4 },
  searchInput: { flex: 1, background: 'transparent !important', border: 'none', color: '#FFF', outline: 'none', fontFamily: 'inherit', fontSize: 13, padding: '0 !important' },
  searchClear: { width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 },
  signatureBlock: { marginTop: 16, padding: '18px', borderRadius: 16, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' },
  signaturePreview: { padding: 16, borderRadius: 14, background: '#FFF', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  signaturePreviewBlock: { marginTop: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' },
  signatureInfo: { marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' },
  sigActionBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  sigClearBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#AAA', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
  sigCancelBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#DDD', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
  sigSaveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
  summaryList: { display: 'flex', flexDirection: 'column', gap: 8 },
  summaryItem: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' },
  summaryLabel: { color: '#888', fontSize: 12 },
  summaryValue: { color: '#FFF', fontSize: 13, fontWeight: 700 },
  warningNote: { marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '12px 14px' },
  successNote: { marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#10B981', fontSize: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '12px 14px' },
  profileProgress: { marginBottom: 16 },
  profileProgressTrack: { width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 6 },
  profileProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #F59E0B, #10B981)' },
  profileProgressText: { color: '#888', fontSize: 11, fontWeight: 600 },
  listWrap: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' },
  listTitle: { color: '#FFF', fontSize: 13, fontWeight: 700 },
  listSub: { color: '#777', fontSize: 11, marginTop: 3 },
  typeBadge: { fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999 },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999 },
  allowanceItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)' },
  bonusItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 },
  importZone: { display: 'flex', flexDirection: 'column', gap: 12, padding: 18, borderRadius: 16, border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' },
  fileInput: { display: 'none' },
  fileInputLabel: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', fontWeight: 700, cursor: 'pointer', width: 'fit-content' },
  importFileInfo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' },
  clearBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' },
  importPreviewItem: { padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' },
  importPreviewHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' },
  importPreviewTitle: { color: '#FFF', fontSize: 13, fontWeight: 700 },
  importPreviewSub: { color: '#888', fontSize: 11, marginTop: 3 },
  importStatusBadge: { padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  importDataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  importDataItem: { padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 4 },
  importDataKey: { color: '#777', fontSize: 11, textTransform: 'capitalize', letterSpacing: 0.4 },
  importDataValue: { fontSize: 13, fontWeight: 700 },
  summaryTopGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  summaryTopCard: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, background: 'rgba(20,20,35,0.75)', border: '1px solid rgba(255,255,255,0.06)' },
  summaryTopValue: { color: '#FFF', fontSize: 18, fontWeight: 800 },
  summaryTopLabel: { color: '#777', fontSize: 12, marginTop: 3 },
  sendAllBar: { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 16, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', flexWrap: 'wrap' },
  previewCard: { padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  previewName: { color: '#FFF', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  previewSub: { color: '#777', fontSize: 12, marginTop: 4 },
  previewActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  previewNet: { color: '#10B981', fontSize: 16, fontWeight: 800 },
  previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 },
  previewMini: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  previewMiniLabel: { color: '#777', fontSize: 11 },
  previewMiniValue: { color: '#FFF', fontSize: 13, fontWeight: 700 },
  sentBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 },
  earningsDetail: { marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.08)' },
  detailTitle: { color: '#10B981', fontSize: 12, fontWeight: 700, margin: '0 0 8px 0' },
  detailGrid: { display: 'flex', flexDirection: 'column', gap: 4 },
  detailLine: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' },
  taxBlock: { marginTop: 12, padding: 14, borderRadius: 14, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)' },
  taxGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 },
  taxMini: { padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 4 },
  taxMiniLabel: { color: '#777', fontSize: 11 },
  taxMiniValue: { color: '#FFF', fontSize: 13, fontWeight: 700 },
  fiscalLinkBox: { marginTop: 20, padding: '16px 18px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' },
  fiscalLinkIcon: { width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fiscalLinkTitle: { color: '#A78BFA', fontSize: 14, fontWeight: 700, margin: '0 0 3px 0' },
  fiscalLinkText: { color: '#888', fontSize: 12, margin: 0 },
  emptyMini: { minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#777', fontSize: 13, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14, marginTop: 8 },
  tooltip: { position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, background: '#1E1E2E', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 14px', minWidth: 240, maxWidth: 320, zIndex: 999, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' },
  tooltipExample: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: '8px 10px', marginTop: 6 },
  tooltipArrow: { position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 12, height: 12, background: '#1E1E2E', borderRight: '1px solid rgba(245,158,11,0.2)', borderBottom: '1px solid rgba(245,158,11,0.2)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modalContent: { width: '100%', maxWidth: 520, background: '#141423', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  modalTitle: { color: '#FFF', fontSize: 16, fontWeight: 700, margin: 0 },
  modalSub: { color: '#888', fontSize: 12, margin: '4px 0 0 0' },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  modalCancelBtn: { padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#DDD', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modalDeleteBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFF', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}