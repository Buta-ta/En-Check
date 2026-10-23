import PaiePayrollChart from '../components/PaiePayrollChart'
import PaieWalletLoader from '../components/PaieWalletLoader'
import { PaieSectionIntro } from '../components/PaieInteriorSections'
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
import CurrencyService from '../services/currencyService'
import { publishPayrollBatch, PayrollDeliveryBlocked, PayrollTaxReviewRequired } from '../services/payrollDelivery'
import PaieDeliveryControl from '../components/PaieDeliveryControl'
import PaieTaxOverrideDialog from '../components/PaieTaxOverrideDialog'
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
import PaiePreparation from '../components/PaiePreparation'
import { useTheme } from '../contexts/ThemeContext'
import { palettePaie } from '../styles/paieTheme'
import { stylesBulletins } from '../styles/paieThemeBulletins'
import {
  AvatarSalarie, FieldHelp, FormLabel, Badge, CategoryBadge, SearchBar,
} from '../components/BulletinChamps'
import { SignaturePad, SingleSignatureManager, StampManager } from '../components/BulletinSignatures'
import {
  AllowanceModal, DeductionModal, LoanModal, BonusModal, PeriodDeductionModal,
} from '../components/BulletinModales'

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════

export default function FichesPaie({ integre = false, ongletExterne = null, entrepriseIdForce = null, onOngletChange = null, onBusyChange = null } = {}) {
  const { darkMode } = useTheme()
  const S = stylesBulletins(darkMode)
  const P = palettePaie(darkMode)
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [ongletInterne, setOngletInterne] = useState('settings')
  const activeTab = ongletExterne || ongletInterne
  // Un clic interne (« Gérer » sur un employé, par exemple) doit aussi
  // déplacer l'onglet de la coque : sinon les deux barres se contredisent.
  const changerOnglet = (cle) => {
    setOngletInterne(cle)
    if (onOngletChange) onOngletChange(cle)
  }

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

  const generationRequest = useRef(0)
  const calculationLock = useRef(false)
  const deliveryLock = useRef(false)
  const [autoSendAfterCalculation, setAutoSendAfterCalculation] = useState(false)
  const [deliveryNotice, setDeliveryNotice] = useState(null)
  const [taxConfirmation, setTaxConfirmation] = useState(null)
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

  // Only active employees loaded for this enterprise belong in the progress denominator.
  const activeProfiles = employees.map(employee => {
    const profile = profiles.find(item => item.employee_id === employee.id)
    return profile ? { ...profile, employees: employee } : null
  }).filter(Boolean)

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
    // En mode intégré, la coque a déjà choisi l'entreprise : on la suit.
    initPage(entrepriseIdForce
      ? { ...parsedAdmin, selectedEnterprise: { ...(parsedAdmin.selectedEnterprise || {}), id: entrepriseIdForce } }
      : parsedAdmin)
  }, [navigate, entrepriseIdForce])

  const loadEnterpriseContext = async (targetEnterpriseId, adminId, start, end) => {
    const { data: enterprise } = await supabase.from('enterprises').select('id, name, address, email, phone, logo_url, country_code, currency').eq('id', targetEnterpriseId).single()
    if (!enterprise) throw new Error('Entreprise inaccessible')
    setEnterpriseId(targetEnterpriseId)
    setEnterpriseName(enterprise?.name || 'Entreprise')
    setEnterpriseData(enterprise)
    setPreviewRows([])

    const [employeesRes, loadedSettings, loadedProfiles, loadedOvertimeSettings, loadedAllowanceTypes, loadedDeductionTypes] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, matricule, department, position, is_active, hire_date, cnps_number, professional_category, echelon, classification, contract_type, marital_status, dependents_count, photo_url').eq('enterprise_id', targetEnterpriseId).eq('is_active', true).order('last_name'),
      PayrollService.getPayrollSettings(targetEnterpriseId),
      PayrollService.getEmployeePayrollProfiles(targetEnterpriseId),
      FeatureService.getOvertimeSettings(targetEnterpriseId),
      PayrollService.getAllowanceTypes(targetEnterpriseId),
      PayrollService.getDeductionTypes(targetEnterpriseId),
    ])

    if (employeesRes.error) throw employeesRes.error
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

      // Dans la coque « Paie & fiscalité », c'est elle qui arbitre l'accès :
      // un client qui n'a que la fiscalité doit pouvoir y entrer.
      if (!isSuperAdmin && !integre) {
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
    } catch (err) { console.error(err); setLoadError('Chargement de la paie impossible. Réessayez avant toute opération.') }
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
      return cumuls
    } catch (err) { console.error('Erreur cumuls:', err); return null }
    finally { setLoadingCumuls(false) }
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
    if (calculationLock.current || deliveryLock.current) return
    if (!enterpriseId || !periodStart || !periodEnd || periodStart > periodEnd) { toast.error('Choisissez une période valide'); return }
    if (preCheckResults.blockers.length > 0) setShowGenerateConfirm(true)
    else handleGeneratePreview()
  }

  const handleGeneratePreview = async () => {
    if (calculationLock.current || deliveryLock.current) return
    setShowGenerateConfirm(false)
    if (!enterpriseId || !periodStart || !periodEnd || periodStart > periodEnd) { toast.error('Choisissez une période valide'); return }
    calculationLock.current = true
    setDeliveryNotice(null)
    setLoadingPreview(true)
    const sendAutomatically = autoSendAfterCalculation
    const request = ++generationRequest.current
    try {
      // Charger cumuls annuels
      const year = new Date(periodStart + 'T12:00:00Z').getFullYear()
      const calculatedCumuls = await loadAnnualCumuls(enterpriseId, year)

      // Always calculate from persisted settings, not a hidden editor's stale snapshot.
      const persistedSettings = await PayrollService.getPayrollSettings(enterpriseId)
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
            employee: emp, profile, settings: persistedSettings, enCheckData,
            importedData: importedMap.get(emp.id) || {},
            periodStart, periodEnd,
            overtimeSettings: sourceData.overtimeSettings,
            recurringAllowances, periodBonuses: pBonuses,
            recurringDeductions, periodDeductions: pDeductions,
          })
        })
      )

      if (request !== generationRequest.current) { setLoadingPreview(false); return }
      setPreviewRows(rows)
      changerOnglet('preview')
      await loadSentSlips(enterpriseId, periodStart, periodEnd)
      toast.success(`${rows.length} fiche(s) générée(s)`)
      if (sendAutomatically && request === generationRequest.current) {
        await deliverRows(rows, { automatic: true, request, payrollSettings: persistedSettings, cumuls: calculatedCumuls || {}, overtime: sourceData.overtimeSettings })
      }
    } catch (err) { console.error(err); toast.error('Erreur génération preview') }
    finally { calculationLock.current = false; setLoadingPreview(false) }
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

  // ⚠️ PAS de `|| 'XAF'` ici. XOF et XAF s'écrivent tous les deux
  //   « FCFA » mais ne sont pas la même monnaie : deviner, c'est produire
  //   un bulletin faux sans qu'aucun écran ne s'en aperçoive. Si la devise
  //   n'est pas déterminable, on refuse d'enregistrer et on le dit.
  const buildPayslipData = (row, { payrollSettings = settings, cumuls = annualCumuls, overtime = overtimeSettings } = {}) => ({
    enterprise_id: enterpriseId, employee_id: row.employee.id,
    period_start: periodStart, period_end: periodEnd,
    gross_salary: row.grossSalary || 0, net_salary: row.netSalary || 0,
    total_earnings: row.totalEarnings || 0, total_deductions: row.totalDeductions || 0,
    currency: CurrencyService.resolveCurrency({ enterprise: enterpriseData, settings: payrollSettings }),
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
        salary_period: payrollSettings.salary_period,
        company_header: payrollSettings.company_header, company_footer: payrollSettings.company_footer,
        signatory1_name: payrollSettings.signatory1_name, signatory1_title: payrollSettings.signatory1_title,
        signatory1_signature: payrollSettings.signatory1_signature,
        signatory2_name: payrollSettings.signatory2_name, signatory2_title: payrollSettings.signatory2_title,
        signatory2_signature: payrollSettings.signatory2_signature,
        company_stamp: payrollSettings.company_stamp,
        company_rccm: payrollSettings.company_rccm, company_nif: payrollSettings.company_nif,
        company_cnps_number: payrollSettings.company_cnps_number,
        company_collective_agreement: payrollSettings.company_collective_agreement,
        legal_mention: payrollSettings.legal_mention,
        overtime_settings: overtime,
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
      annual_cumuls: cumuls[row.employee.id] || null,
      leave_balance: leaveBalances[row.employee.id] || null,
      working_days_in_month: getWorkingDaysInMonth,
    },
    is_deleted: false, deleted_at: null, deleted_by: null,
    sent_by: admin?.id || null, status: 'sent', sent_at: new Date().toISOString(),
  })

  const deliverRows = async (rows, options = {}) => {
    if (deliveryLock.current || !enterpriseId) return false
    deliveryLock.current = true
    setSendingSlips(true)
    setDeliveryNotice(null)
    const request = options.request ?? generationRequest.current
    try {
      const ids = await publishPayrollBatch(rows, row => buildPayslipData(row, options), {
        automatic: options.automatic, taxOverride: options.taxOverride,
        isCurrent: () => request === generationRequest.current,
      })
      setSentSlips(prev => new Set([...prev, ...ids]))
      const text = `${ids.length} fiche(s) ${options.automatic ? 'envoyée(s) automatiquement' : 'envoyée(s)'} dans les espaces salariés.`
      setDeliveryNotice({ error: false, text })
      toast.success(text)
      // Audit is separate from publication: an audit failure must not claim the delivery failed.
      try {
        await PayrollService.logAuditAction({ enterpriseId, action: 'payslip_sent', entityType: 'payslip',
          employeeId: rows.length === 1 ? rows[0].employee.id : undefined, periodStart, periodEnd,
          metadata: { employee_ids: ids, automatic: !!options.automatic, tax_override: !!options.taxOverride, ...(rows.length === 1 ? { net_salary: rows[0].netSalary, gross_salary: rows[0].grossSalary } : {}) }, performedBy: admin?.id })
      } catch (error) { console.error('Audit de remise indisponible:', error) }
      return true
    } catch (error) {
      const text = error instanceof PayrollDeliveryBlocked ? error.message : 'Envoi non confirmé. Vérifiez la connexion et les droits, puis consultez l’historique avant de réessayer. Les fiches calculées restent disponibles.'
      setDeliveryNotice({ error: true, text, taxReview: error instanceof PayrollTaxReviewRequired })
      if (error instanceof PayrollTaxReviewRequired && !options.automatic && !options.taxOverride) setTaxConfirmation({ rows, options: { ...options, request } })
      if (!(error instanceof PayrollTaxReviewRequired)) toast.error(text, { duration: 8000 })
      return false
    } finally { deliveryLock.current = false; setSendingSlips(false) }
  }
  const handleSendToEmployee = row => {
    if (calculationLock.current || deliveryLock.current) return
    return deliverRows([row])
  }
  const handleSendAllToEmployees = () => {
    if (calculationLock.current || deliveryLock.current) return
    return deliverRows(previewRows)
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
      blockers.push({ employeeId: emp.id, employee: name, reason: 'Aucun profil salarial' })
      return
    }

    // Vérifier selon le type de salaire
    if (profile.salary_type === 'monthly' && (!profile.base_salary || profile.base_salary <= 0)) {
      warnings.push({ employeeId: emp.id, employee: name, reason: 'Salaire de base = 0' })
    } else if (profile.salary_type === 'hourly' && (!profile.hourly_rate || profile.hourly_rate <= 0)) {
      blockers.push({ employeeId: emp.id, employee: name, reason: 'Taux horaire non défini' })
      return
    } else if (profile.salary_type === 'daily' && (!profile.daily_rate || profile.daily_rate <= 0)) {
      blockers.push({ employeeId: emp.id, employee: name, reason: 'Taux journalier non défini' })
      return
    }

    // ✅ CORRECTION : Vérifier le numéro organisme social avec libellé dynamique
    if (!emp.cnps_number) {
      warnings.push({
        employeeId: emp.id, employee: name,
        reason: socialOrgLabel
          ? `N° ${socialOrgLabel} manquant`
          : 'Numéro organisme social manquant'
      })
    }

    // Vérifier la date d'embauche
    if (!emp.hire_date) {
      warnings.push({ employeeId: emp.id, employee: name, reason: 'Date d\'embauche manquante' })
    }

    // Si toutes les vérifications passent, l'employé est prêt
    ready.push({ employeeId: emp.id, employee: name })
  })

  return { ready, warnings, blockers }
}, [employees, profiles, settings.company_social_label, settings.hide_social_label])

  useEffect(() => {
    onBusyChange?.(saving || loadingPreview || sendingSlips || savingImport)
  }, [saving, loadingPreview, sendingSlips, savingImport, onBusyChange])

  useEffect(() => { setAutoSendAfterCalculation(false); setDeliveryNotice(null) }, [enterpriseId, periodStart, periodEnd])

  useEffect(() => { if (activeTab !== 'preview') setTaxConfirmation(null) }, [activeTab])
  // Calculs invalidés dès qu'une entrée change : jamais de graphique d'une autre période.
  useEffect(() => { generationRequest.current += 1; setPreviewRows([]); setTaxConfirmation(null) }, [enterpriseId, periodStart, periodEnd, profiles, settings, periodBonuses, periodDeductions])
  useEffect(() => {
    const prevent = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => { generationRequest.current += 1; window.removeEventListener('beforeunload', prevent) }
  }, [])
  if (loadError) return <div role="alert" className="pw-error">{loadError}<button className="paie-btn" onClick={() => { setLoadError(''); initPage({ ...admin, selectedEnterprise: { id: entrepriseIdForce || enterpriseId } }) }}>Réessayer</button></div>

  // Vérifier si signatures/cachet configurés
  const hasSignatures = settings.signatory1_signature || settings.signatory2_signature
  const hasStamp = !!settings.company_stamp

  if (loading) {
    return <PaieWalletLoader label="Chargement des paramètres de paie…"/>
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
      {/* ⚠️ Ces règles étaient GLOBALES : `html, body, #root` repeints en
          noir, et tous les champs du SITE forcés en sombre. Elles
          débordaient de la page et imposaient l'ancien décor partout,
          y compris sur la coque « Paie & fiscalité » qui venait d'être
          refaite. Elles sont cantonnées au volet (`.pay-volet`) et
          teintées par le thème. */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .pay-card { animation: fadeInUp 0.3s ease forwards; }
        .pay-btn:hover { transform: translateY(-1px); }

        .pay-volet select, .pay-volet input, .pay-volet textarea {
          background: ${P.voile3} !important;
          color: ${P.texte} !important;
        }
        .pay-volet select option {
          background: ${P.surface2} !important;
          color: ${P.texte} !important;
        }
        .pay-volet input::placeholder, .pay-volet textarea::placeholder {
          color: ${P.texteFaint} !important;
        }
        /* le sélecteur de date est noir sur fond clair : ne l'inverser que la nuit */
        .pay-volet input[type="date"]::-webkit-calendar-picker-indicator {
          filter: ${darkMode ? 'invert(1)' : 'none'};
        }
        .pay-avatar { flex-shrink: 0; }
        .pay-volet .pay-liste-avatar { align-items: center; }
        @media (max-width: 768px) {
          .pay-grid-2 { grid-template-columns: 1fr !important; }
          .pay-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <fieldset disabled={loadingPreview || sendingSlips}
        className="pay-volet paie-page"
        data-theme={darkMode ? 'dark' : 'light'}
        style={integre ? { width: '100%' } : { minHeight: '100vh', background: P.fond, width: '100%' }}
      >
        <div
          style={
            integre
              // dans la coque : pas de hauteur d'écran ni de marge interne,
              // elle a déjà les siennes
              ? { display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }
              : S.container
          }
        >

          {/* HEADER — la coque « Paie & fiscalité » a le sien */}
          {!integre && (
          <header style={S.header}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={S.backBtn}><ArrowLeft size={18} /></button>
              <div style={S.logoBox}><Wallet size={22} color={P.ambre} /></div>
              <div>
                <h1 style={S.title}>FICHES DE PAIE</h1>
                {enterprisesList.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ color: P.texteDoux2, fontSize: 12 }}>Entreprise :</span>
                    <select
                      value={enterpriseId || ''}
                      onChange={(e) => handleEnterpriseSelectChange(e.target.value)}
                      style={{
                        background: P.ambre4,
                        border: `1px solid ${P.ambre10}`,
                        borderRadius: 8,
                        padding: '5px 10px',
                        color: P.ambre,
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
                <div style={S.otBadge}><Clock size={14} color={P.orange} /><span style={{ color: P.orange, fontSize: 12, fontWeight: 700 }}>H.sup: +{overtimeSettings.rate_normal}% / +{overtimeSettings.rate_major}%</span></div>
              )}
              <button onClick={() => { loadHistory(); setShowHistoryModal(true) }} style={S.historyBtn} className="pay-btn"><History size={16} /><span>Historique</span></button>
              <button onClick={handleTryGenerate} style={S.primaryBtn} className="pay-btn" disabled={loadingPreview}>
                {loadingPreview ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Eye size={16} />}
                <span>{loadingPreview ? 'Calcul...' : autoSendAfterCalculation ? 'Calculer et envoyer' : 'Générer les fiches'}</span>
              </button>
            </div>
          </header>
          )}

          <PaieSectionIntro section={activeTab}/>
          {['preparation', 'preview'].includes(activeTab) && <PaieDeliveryControl
            enabled={autoSendAfterCalculation} onChange={setAutoSendAfterCalculation}
            busy={loadingPreview || sendingSlips} notice={deliveryNotice} onOverride={activeTab === 'preview' ? handleSendAllToEmployees : undefined}/>
          }
          {taxConfirmation && activeTab === 'preview' && <PaieTaxOverrideDialog rows={taxConfirmation.rows} periodStart={periodStart} periodEnd={periodEnd}
            onCancel={() => setTaxConfirmation(null)} onConfirm={() => { const pending = taxConfirmation; setTaxConfirmation(null); return deliverRows(pending.rows, { ...pending.options, taxOverride: { acknowledged: true, confirmedBy: admin?.id } }) }}/>}
          {integre && activeTab === 'preparation' && <PaiePayrollChart key={`${enterpriseId}:${settings.currency}:${periodEnd}`} enterpriseId={enterpriseId} currency={settings.currency} end={periodEnd} revision={sentSlips.size}/>}
          {integre && activeTab === 'preparation' && <PaiePreparation
            employees={employees} profiles={profiles} previewRows={previewRows}
            currency={settings.currency} start={periodStart} end={periodEnd}
            setStart={setPeriodStart} setEnd={setPeriodEnd}
            onHistory={() => { loadHistory(); setShowHistoryModal(true) }}
            onGenerate={handleTryGenerate} generating={loadingPreview || sendingSlips} automaticDelivery={autoSendAfterCalculation}
            onNavigate={changerOnglet}
            onEmployee={id => { setSelectedEmployeeId(id); changerOnglet('profiles') }}
            issues={[...preCheckResults.blockers, ...preCheckResults.warnings]}
          />}
          {integre && activeTab === 'preview' && <div className="pw-toolbar">
            <button className="paie-btn" onClick={() => { loadHistory(); setShowHistoryModal(true) }}><History size={17}/>Historique</button>
            <button className="paie-btn paie-btn-principal" onClick={handleTryGenerate} disabled={loadingPreview || !employees.length}><Eye size={17}/>{loadingPreview ? 'Calcul en cours…' : autoSendAfterCalculation ? 'Calculer et envoyer les bulletins' : 'Vérifier et calculer les bulletins'}</button>
          </div>}
          {activeTab !== 'preparation' && <details className="pw-help"><summary>Comment préparer la paie ?</summary><p>Configurez les paramètres et les profils, vérifiez les primes et les variables, puis calculez et contrôlez les bulletins avant envoi.</p></details>}

          {/* PRÉ-VALIDATION — inutile sur les onglets de réglage */}
          {(!integre || activeTab === 'preview') && (preCheckResults.blockers.length > 0 || preCheckResults.warnings.length > 0) && (
            <div style={S.preCheckBar}>
              {preCheckResults.blockers.length > 0 && (
                <div style={S.preCheckSection}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><AlertCircle size={14} color={P.rouge} /><span style={{ color: P.rouge, fontSize: 12, fontWeight: 700 }}>{preCheckResults.blockers.length} problème(s) bloquant(s)</span></div>
                  {preCheckResults.blockers.slice(0, 5).map((b, i) => <div key={i} style={S.preCheckItem}><span style={{ color: P.rougeClair, fontSize: 11 }}>⚠ {b.employee} — {b.reason}</span></div>)}
                  {preCheckResults.blockers.length > 5 && <div style={S.preCheckItem}><span style={{ color: P.rougeClair, fontSize: 11 }}>...et {preCheckResults.blockers.length - 5} autre(s)</span></div>}
                </div>
              )}
              {preCheckResults.warnings.length > 0 && (
                <div style={S.preCheckSection}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><AlertTriangle size={14} color={P.ambre} /><span style={{ color: P.ambre, fontSize: 12, fontWeight: 700 }}>{preCheckResults.warnings.length} avertissement(s)</span></div>
                  {preCheckResults.warnings.slice(0, 3).map((w, i) => <div key={i} style={S.preCheckItem}><span style={{ color: P.ambreClair, fontSize: 11 }}>⚠ {w.employee} — {w.reason}</span></div>)}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} color={P.vert} /><span style={{ color: P.vert, fontSize: 12, fontWeight: 700 }}>{preCheckResults.ready.length} employé(s) prêt(s)</span></div>
            </div>
          )}

          {/* PÉRIODE — les primes, les imports et les fiches sont rattachés à une période */}
          {(!integre || ['allowances', 'imports', 'preview'].includes(activeTab)) && (
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
                <Calendar size={14} color={P.texteDoux2} />
                <span style={{ color: P.texteDoux2, fontSize: 12 }}>
                  {periodStart && periodEnd ? `${Math.ceil((new Date(periodEnd) - new Date(periodStart)) / 86400000) + 1} jours (${getWorkingDaysInMonth} ouvrables)` : '—'}
                </span>
              </div>
            </div>
          </div>

          )}

          {/* ONGLETS — la coque porte les siens */}
          {!integre && (
          <div style={S.tabs}>
            {[
              { key: 'settings', icon: Settings, label: 'Paramètres' },
              { key: 'profiles', icon: Users, label: 'Profils salariés' },
              { key: 'allowances', icon: Gift, label: 'Primes & Retenues', badge: (periodBonuses.length + periodDeductions.length) || null },
              { key: 'imports', icon: Upload, label: 'Import variables' },
              { key: 'preview', icon: Eye, label: 'Fiches générées', badge: previewRows.length || null },
            ].map(tab => (
              <button key={tab.key} onClick={() => changerOnglet(tab.key)} style={{ ...S.tabBtn, ...(activeTab === tab.key ? S.tabBtnActive : {}) }}>
                <tab.icon size={15} /><span>{tab.label}</span>
                {tab.badge && <span style={S.tabBadge}>{tab.badge}</span>}
              </button>
            ))}
          </div>

          )}

          {/* ═══ ONGLET PARAMÈTRES ═══ */}
          {activeTab === 'settings' && (
            <div className="pay-grid-2 pw-settings-layout" style={S.grid2}>
              <div style={S.card} className="pay-card pw-settings-editor">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}>
                    <div style={S.cardIcon}><Settings size={18} color={P.ambre} /></div>
                    <div><h3 style={S.cardTitle}>Paramètres du moteur de paie</h3><p style={S.cardSub}>Choisissez les données utilisées et les règles appliquées au salaire.</p></div>
                  </div>
                </div>

                <div className="pw-settings-guide"><span className="pw-eyebrow">PAS BESOIN D’ÊTRE COMPTABLE</span><p><strong>Trois choses à distinguer :</strong> les données reçues, les sommes ajoutées ou retirées, et la présentation du bulletin.</p><p>Vos choix restent en cours de modification jusqu’à leur enregistrement. Ils ne recalculent pas les bulletins déjà enregistrés.</p></div>
                <nav className="pw-settings-nav" aria-label="Aller à un groupe de paramètres"><a href="#paie-bases">Base de calcul</a><a href="#paie-sources">Données utilisées</a><a href="#paie-regles">Ajouts & déductions</a><a href="#paie-entreprise">Entreprise</a><a href="#paie-presentation">Présentation</a><a href="#paie-signatures">Signatures</a></nav>
                <h4 className="pw-settings-heading" id="paie-bases"><span>01</span> La base du calcul</h4>
                <p className="pw-settings-help">Le pays et ses règles fiscales se règlent dans Fiscalité. Ici, définissez la devise et les valeurs servant à convertir un salaire en montant par jour ou par heure.</p>
                <div className="pay-form-grid" style={S.formGrid}>
                  <div style={S.formGroup}><FormLabel help="Devise de l’entreprise — elle est enregistrée sur l’entreprise, et sert à tous les bulletins" example="XAF, EUR" required>Devise</FormLabel><input value={settings.currency || ''} onChange={e => changerDevise(e.target.value)} style={S.input} placeholder="XAF, XOF, EUR" /></div>
                  <div style={S.formGroup}><FormLabel help="Rythme de paie enregistré pour l’entreprise. Vérifiez aussi les dates sélectionnées avant de calculer.">Rythme de paie</FormLabel>
                    <select value={settings.salary_period || 'monthly'} onChange={e => setSettings(p => ({ ...p, salary_period: e.target.value }))} style={S.select}>
                      <option value="monthly">Mensuelle</option><option value="biweekly">Bimensuelle</option><option value="weekly">Hebdomadaire</option>
                    </select>
                  </div>
                  <div style={S.formGroup}><FormLabel help="Nombre de jours utilisé pour obtenir un montant journalier à partir du salaire de base" example="220 000 ÷ 22 = 10 000 par jour">Jours de référence</FormLabel><input type="number" value={settings.working_days_divisor} onChange={e => setSettings(p => ({ ...p, working_days_divisor: e.target.value }))} style={S.input} /></div>
                  <div style={S.formGroup}><FormLabel help="Nombre d’heures utilisé pour obtenir un montant horaire" example="173 330 ÷ 173,33 = 1 000 par heure">Heures de référence</FormLabel><input type="number" step="0.01" value={settings.hourly_divisor} onChange={e => setSettings(p => ({ ...p, hourly_divisor: e.target.value }))} style={S.input} /></div>
                </div>

                <div className="pw-settings-example"><strong>Un exemple simple</strong><p>Un salaire de base de 220 000 divisé par 22 donne 10 000 par jour. Avec 173 330 et 173,33 heures de référence, on obtient 1 000 par heure. Ces exemples ne sont pas des valeurs imposées.</p></div>
                {overtimeSettings && (
                  <div style={S.otInfoBox}>
                    <Clock size={16} color={P.orange} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: P.orange, fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' }}>Heures supplémentaires configurées</p>
                      <p style={{ color: P.texteDoux2, fontSize: 12, margin: 0 }}>Normal: +{overtimeSettings.rate_normal}% • Majoré: +{overtimeSettings.rate_major}% • Dimanche: +{overtimeSettings.rate_sunday}% • Férié: +{overtimeSettings.rate_holiday}%</p>
                    </div>
                    <button onClick={() => navigate('/heures-supplementaires')} className="pw-settings-button"><Edit size={14} /><span>Voir les taux des heures sup</span></button>
                  </div>
                )}

                <div style={S.toggleSection}>
                  <h4 className="pw-settings-heading" id="paie-sources"><span>02</span>Quelles données utiliser ?</h4><p className="pw-settings-help">Cocher une source permet de la prendre en compte. Cela ne signifie pas forcément qu’une somme sera retirée : les déductions se choisissent juste après.</p>
                  <div style={S.toggleGrid}>
                    {[
                      ['use_attendance_data', 'Présences En-Check', 'Reprend les heures issues des pointages retenus pour la paie.'],
                      ['use_overtime_data', 'Heures supplémentaires', 'Lit les heures supplémentaires calculées. Leur paiement se choisit ci-dessous.'],
                      ['use_absence_data', 'Absences & congés', 'Lit les absences et congés, dont le traitement dépend de leur type.'],
                      ['use_late_data', 'Retards', 'Lit les retards ; leur déduction se choisit ci-dessous.'],
                      ['use_holiday_work_data', 'Jours fériés travaillés', 'Repère le travail effectué un jour férié.'],
                      ['use_imported_variables', 'Variables importées', 'Utilise les variables enregistrées après import, par exemple une prime.'],
                    ].map(([key, label, desc]) => (
                      <label key={key} className="pw-setting-choice" style={S.toggleItem}><input type="checkbox" checked={!!settings[key]} onChange={e => setSettings(p => ({ ...p, [key]: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>{label}</span><span style={S.toggleDesc}>{desc}</span></div></label>
                    ))}
                  </div>
                </div>

                <div style={S.toggleSection}>
                  <h4 className="pw-settings-heading" id="paie-regles"><span>03</span>Que faut-il ajouter ou retirer ?</h4><p className="pw-settings-help">Ces choix ont un effet sur le montant calculé. Vérifiez les absences, congés et retards avant de calculer ; les règles applicables restent celles de votre entreprise.</p>
                  <div style={S.toggleGrid}>
                    {[
                      ['deduct_absence', 'Déduire les absences', 'Applique les déductions prévues pour les absences concernées, pas automatiquement pour tous les congés.'],
                      ['deduct_late', 'Déduire les retards', 'Déduit la durée de retard selon le montant horaire calculé.'],
                      ['include_overtime_in_payroll', 'Payer les heures sup', 'Ajoute au salaire les heures supplémentaires selon les taux configurés.'],
                    ].map(([key, label, desc]) => (
                      <label key={key} className="pw-setting-choice" style={S.toggleItem}><input type="checkbox" checked={!!settings[key]} onChange={e => setSettings(p => ({ ...p, [key]: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>{label}</span><span style={S.toggleDesc}>{desc}</span></div></label>
                    ))}
                  </div>
                </div>

                {/* INFOS ENTREPRISE ENRICHIES */}
                <div style={S.toggleSection}>
                  <h4 className="pw-settings-heading" id="paie-entreprise"><span>04</span>Identifier votre entreprise</h4><p className="pw-settings-help">Ces informations servent à identifier l’employeur sur le bulletin. Reprenez les numéros figurant sur ses documents officiels.</p>
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

                    <label className="pw-setting-choice" style={S.toggleItem}>
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
                  <h4 className="pw-settings-heading" id="paie-presentation"><span>05</span>Les textes du bulletin</h4><p className="pw-settings-help">Personnalisez la présentation sans changer le calcul. Exemple : un contact RH en pied de page. Faites vérifier les mentions obligatoires selon le pays.</p>
                  <div style={S.formGroup}><FormLabel help="Texte en haut du bulletin">En-tête</FormLabel><textarea rows={3} value={settings.company_header || ''} onChange={e => setSettings(p => ({ ...p, company_header: e.target.value }))} style={S.textarea} /></div>
                  <div style={S.formGroup}><FormLabel help="Texte en bas du bulletin">Pied de page</FormLabel><textarea rows={3} value={settings.company_footer || ''} onChange={e => setSettings(p => ({ ...p, company_footer: e.target.value }))} style={S.textarea} /></div>
                  <div style={S.formGroup}><FormLabel help="Mention légale obligatoire en bas du bulletin">Mention légale</FormLabel><textarea rows={2} value={settings.legal_mention || ''} onChange={e => setSettings(p => ({ ...p, legal_mention: e.target.value }))} style={S.textarea} placeholder="Ce bulletin de paie doit être conservé sans limitation de durée..." /></div>
                </div>

                {/* ═══ SIGNATURES (2 SIGNATAIRES) ═══ */}
                <div style={S.signatureBlock} id="paie-signatures">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ ...S.cardIcon, background: P.ambre4 }}><PenTool size={18} color={P.ambre} /></div>
                    <div>
                      <p style={{ color: P.texte, fontSize: 14, fontWeight: 700, margin: 0 }}>Signatures numériques</p>
                      <p style={{ color: P.texteFaint, fontSize: 11, margin: '2px 0 0 0' }}>Configurez jusqu'à 2 signataires pour vos bulletins</p>
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
                      color={P.ambre}
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
                      color={P.indigo}
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
                    <Info size={13} color={P.texteFaint} style={{ flexShrink: 0 }} />
                    <span style={{ color: P.texteFaint, fontSize: 11, lineHeight: 1.5 }}>Les signatures et le cachet apparaîtront en bas de chaque bulletin PDF. Formats : PNG, JPG, WebP (max 2-3 Mo).</span>
                  </div>
                </div>

                {/* LIEN CONFIG FISCALE */}
                <button type="button" className="pw-settings-fiscal" onClick={() => navigate(integre ? '/paie?onglet=apercu' : '/paie')}>
                  <div style={S.fiscalLinkIcon}><Shield size={22} color={P.violet} /></div>
                  <div style={{ flex: 1 }}>
                    <p style={S.fiscalLinkTitle}>Ouvrir les règles fiscales</p>
                    <p style={S.fiscalLinkText}>Pays, cotisations et impôt : les règles qui complètent ce calcul</p>
                  </div>
                  <ArrowRight size={18} color={P.violet} />
                </button>

                <div className="pw-settings-save">
                  <p>Prêt ? Enregistrez vos choix avant de calculer de nouvelles fiches.</p>
                  <button onClick={handleSaveSettings} className="pw-settings-button pw-settings-button-primary" disabled={saving}>
                    {saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}
                    <span>{saving ? 'Enregistrement…' : 'Enregistrer mes réglages'}</span>
                  </button>
                </div>
              </div>

              {/* RÉSUMÉ */}
              <div style={S.card} className="pay-card pw-settings-summary">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}>
                    <div style={{ ...S.cardIcon, background: P.vert1 }}><Building2 size={18} color={P.vert} /></div>
                    <div><h3 style={S.cardTitle}>Vos repères</h3><p style={S.cardSub}>Aperçu des valeurs actuellement saisies</p></div>
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
                    { label: 'Adresse', value: enterpriseData?.address || 'Non renseignée', color: enterpriseData?.address ? undefined : P.texteFaint },
                    { label: 'Devise', value: settings.currency },
                    { label: 'RCCM', value: settings.company_rccm || 'Non renseigné', color: settings.company_rccm ? undefined : P.texteFaint },
                    { label: 'NIF', value: settings.company_nif || 'Non renseigné', color: settings.company_nif ? undefined : P.texteFaint },
                    {
                      label: socialOrgLabel ? `${socialOrgLabel} employeur` : 'Numéro organisme employeur',
                      value: settings.company_cnps_number || 'Non renseigné',
                      color: settings.company_cnps_number ? undefined : P.texteFaint
                    },
                    {
                      label: 'Libellé organisme social',
                      value: settings.hide_social_label
                        ? 'Masqué'
                        : (settings.company_social_label || 'Organisme social'),
                      color: settings.hide_social_label ? P.ambre : undefined
                    },
                    { label: 'Conv. collective', value: settings.company_collective_agreement || 'Non renseignée', color: settings.company_collective_agreement ? undefined : P.texteFaint },
                    { label: 'Employés actifs', value: employees.length },
                    { label: 'Profils configurés', value: `${activeProfiles.length} / ${employees.length}` },
                    { label: 'Signataire 1', value: settings.signatory1_name ? `${settings.signatory1_name}${settings.signatory1_title ? ` (${settings.signatory1_title})` : ''}` : '✗ Non configuré', color: settings.signatory1_name ? P.vert : P.rouge },
                    { label: 'Signataire 2', value: settings.signatory2_name ? `${settings.signatory2_name}${settings.signatory2_title ? ` (${settings.signatory2_title})` : ''}` : '— Optionnel', color: settings.signatory2_name ? P.vert : P.texteFaint },
                    { label: 'Signatures', value: `${[settings.signatory1_signature, settings.signatory2_signature].filter(Boolean).length}/2 configurée(s)`, color: settings.signatory1_signature ? P.vert : P.rouge },
                    { label: 'Cachet', value: settings.company_stamp ? '✓ Configuré' : '✗ Non configuré', color: settings.company_stamp ? P.vert : P.texteFaint },
                  ].map((item, i) => (
                    <div key={i} style={S.summaryItem}>
                      <span style={S.summaryLabel}>{item.label}</span>
                      <span style={{ ...S.summaryValue, color: item.color || P.texte }}>{item.value}</span>
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

                {preCheckResults.blockers.length > 0 && <div style={S.warningNote}><AlertTriangle size={14} color={P.rouge} /><span>{preCheckResults.blockers.length} problème(s) bloquant(s)</span></div>}
                {preCheckResults.ready.length === employees.length && employees.length > 0 && <div style={S.successNote}><CheckCircle size={14} color={P.vert} /><span>Tous les employés sont prêts ✓</span></div>}
              </div>
            </div>
          )}

          {/* ═══ ONGLET PROFILS ═══ */}
          {activeTab === 'profiles' && (
            <div className="pay-grid-2 pw-profile-layout" style={S.grid2}>
              <div style={S.card} className="pay-card pw-profile-panel">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}>
                    <div style={{ ...S.cardIcon, background: P.indigo3 }}><Users size={18} color={P.indigo} /></div>
                    <div><h3 style={S.cardTitle}>Profil salarial</h3><p style={S.cardSub}>1. Choisir le salarié · 2. Définir sa rémunération · 3. Préparer son paiement</p></div>
                  </div>
                  <button onClick={() => { setCopySourceEmployeeId(''); setShowCopyProfileModal(true) }} className="pw-settings-button" title="Copier un profil existant"><Copy size={14} /><span>Copier un profil</span></button>
                </div>

                <div className="pw-settings-guide"><p><strong>Un profil décrit une rémunération, pas un versement.</strong> Le salaire net sera calculé ensuite avec les présences, les primes, les retenues et la fiscalité.</p><p>Copier un profil reprend des réglages : vérifiez les montants et les coordonnées de paiement avant d’enregistrer.</p></div>
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
                    <div style={{ padding: '10px 14px', borderRadius: 12, background: P.indigo1, border: `1px solid ${P.indigo3}`, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <AvatarSalarie employe={emp} taille={40} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, color: P.texte, fontSize: 13.5, fontWeight: 800 }}>
                            {emp.first_name} {emp.last_name}
                          </p>
                          <p style={{ margin: '2px 0 0 0', color: P.texteDoux2, fontSize: 11 }}>
                            {[emp.matricule, emp.position || emp.department].filter(Boolean).join(' • ') || 'Sans matricule'}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: P.texteDoux2 }}>
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
                  <div className="pw-salary-modes" role="group" aria-label="Mode de rémunération">
                    {[{ value: 'monthly', label: 'Mensuel', desc: 'Une base par mois' }, { value: 'hourly', label: 'Horaire', desc: 'Un montant par heure' }, { value: 'daily', label: 'Journalier', desc: 'Un montant par jour' }].map(mode => (
                      <button className="pw-salary-mode" aria-pressed={profileForm.salary_type === mode.value} key={mode.value} onClick={() => setProfileForm(p => ({ ...p, salary_type: mode.value }))} style={{ ...S.modeBtn, ...(profileForm.salary_type === mode.value ? S.modeBtnActive : {}) }}>
                        <div style={{ color: profileForm.salary_type === mode.value ? P.ambre : P.texteDoux, fontSize: 13, fontWeight: 700 }}>{mode.label}</div>
                        <div style={{ color: P.texteFaint, fontSize: 10, marginTop: 2 }}>{mode.desc}</div>
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
                    <div style={S.formGroup}><FormLabel help="Volume mensuel prévu au contrat, distinct du taux payé pour une heure." example="160 heures prévues dans le mois.">Heures contractuelles/mois</FormLabel><input type="number" value={profileForm.contract_hours_per_month} onChange={e => setProfileForm(p => ({ ...p, contract_hours_per_month: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel help="Nombre minimum d’heures rémunérées. Le moteur multiplie ces heures par le taux horaire." example="20 heures garanties × 1 000 = 20 000 de rémunération minimale.">Minimum garanti (heures)</FormLabel><input type="number" value={profileForm.min_guaranteed_hours} onChange={e => setProfileForm(p => ({ ...p, min_guaranteed_hours: e.target.value }))} style={S.input} /></div>
                  </>)}
                  {profileForm.salary_type === 'daily' && (<>
                    <div style={S.formGroup}><FormLabel required>Taux journalier ({settings.currency})</FormLabel><input type="number" value={profileForm.daily_rate} onChange={e => setProfileForm(p => ({ ...p, daily_rate: e.target.value }))} style={S.input} /></div>
                    <div style={S.formGroup}><FormLabel>Jours contractuels/mois</FormLabel><input type="number" value={profileForm.contract_days_per_month} onChange={e => setProfileForm(p => ({ ...p, contract_days_per_month: e.target.value }))} style={S.input} /></div>
                  </>)}
                </div>

                <label style={S.toggleItem}><input type="checkbox" checked={profileForm.overtime_eligible} onChange={e => setProfileForm(p => ({ ...p, overtime_eligible: e.target.checked }))} style={S.checkbox} /><div><span style={S.toggleLabel}>Éligible aux heures supplémentaires</span><span style={S.toggleDesc}>Autorise leur prise en compte si leur paiement est activé dans les paramètres.</span></div></label>

                {/* Mode paiement */}
                <div style={{ ...S.toggleSection, marginTop: 16 }}>
                  <h4 className="pw-settings-heading"><span>03</span>Comment régler ce salarié ?</h4><p className="pw-settings-help">Ces coordonnées préparent le paiement. Enregistrer ou envoyer une fiche ne fait pas de virement ni de transfert Mobile Money.</p>
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
                    <div style={S.formGroup}><FormLabel help="Jour souhaité du mois, de 1 à 31. Enregistrer le profil ne déclenche aucun transfert d’argent.">Jour de paiement</FormLabel><input type="number" min="1" max="31" value={profileForm.preferred_payment_day} onChange={e => setProfileForm(p => ({ ...p, preferred_payment_day: e.target.value }))} style={S.input} /></div>
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

                <div style={S.actionsRow}><button onClick={handleSaveProfile} className="pw-settings-button pw-settings-button-primary" disabled={saving}>{saving ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>Enregistrer ce profil</span></button></div>

                {/* Primes récurrentes */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ color: P.texteDoux, fontSize: 13, fontWeight: 700, margin: 0 }}>Primes récurrentes ({selectedEmployeeAllowances.length})</p>
                    <button onClick={() => { setEditingAllowance(null); setShowAllowanceModal(true) }} style={S.addBtnSmall}><Plus size={14} /><span>Ajouter</span></button>
                  </div>
                  {selectedEmployeeAllowances.length === 0 ? <div style={S.emptyMini}><Gift size={16} color={P.texteFaint} /><span>Aucune prime récurrente</span></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedEmployeeAllowances.map((a, i) => (
                        <div key={a.id || i} style={S.allowanceItem}>
                          <div style={{ flex: 1 }}><div style={{ color: P.texte, fontSize: 13, fontWeight: 600 }}>{a.allowance_types?.name || a.custom_name || 'Prime'}</div><div style={{ color: P.texteDoux2, fontSize: 11, marginTop: 2 }}>{a.calculation_type === 'fixed' ? fmt(a.amount) : `${a.percentage}% du salaire de base`}{a.end_date && ` • jusqu'au ${PayrollService.formatDate(a.end_date)}`}</div></div>
                          <CategoryBadge category={a.allowance_types?.category || 'other'} />
                          <button onClick={() => { setEditingAllowance(a); setShowAllowanceModal(true) }} aria-label="Modifier cette règle récurrente" style={S.iconBtn}><Edit size={14} /></button>
                          <button onClick={() => handleDeleteAllowance(a.id)} style={{ ...S.iconBtn, color: P.rouge }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Retenues récurrentes */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ color: P.texteDoux, fontSize: 13, fontWeight: 700, margin: 0 }}>Retenues récurrentes ({selectedEmployeeDeductions.length})</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingDeduction(null); setShowLoanModal(true) }} style={{ ...S.addBtnSmall, background: P.rouge2, borderColor: P.rouge3, color: P.rouge }}><CreditCard size={14} /><span>Prêt</span></button>
                      <button onClick={() => { setEditingDeduction(null); setShowDeductionModal(true) }} style={{ ...S.addBtnSmall, background: P.rouge2, borderColor: P.rouge3, color: P.rouge }}><Minus size={14} /><span>Retenue</span></button>
                    </div>
                  </div>
                  {selectedEmployeeDeductions.length === 0 ? <div style={S.emptyMini}><Minus size={16} color={P.texteFaint} /><span>Aucune retenue récurrente</span></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedEmployeeDeductions.map((d, i) => (
                        <div key={d.id || i} style={{ ...S.allowanceItem, borderColor: P.rouge9 }}>
                          <div style={{ flex: 1 }}><div style={{ color: P.texte, fontSize: 13, fontWeight: 600 }}>{d.name}</div><div style={{ color: P.texteDoux2, fontSize: 11, marginTop: 2 }}>{fmt(d.monthly_amount)}/mois {d.remaining_balance !== null && `• Solde: ${fmt(d.remaining_balance)}`}{d.status === 'paused' && ' • ⏸ Pause'}{d.status === 'completed' && ' • ✓ Soldé'}</div></div>
                          <CategoryBadge category={d.deduction_types?.category || 'other'} />
                          <span style={{ ...S.statusBadge, background: d.status === 'active' ? P.vert1 : d.status === 'paused' ? P.ambre4 : P.indigo3, color: d.status === 'active' ? P.vert : d.status === 'paused' ? P.ambre : P.indigoClair }}>{d.status === 'active' ? 'Actif' : d.status === 'paused' ? 'Pause' : 'Soldé'}</span>
                          <button onClick={() => { setEditingDeduction(d); setShowDeductionModal(true) }} aria-label="Modifier cette règle récurrente" style={S.iconBtn}><Edit size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Liste profils */}
              <div style={S.card} className="pay-card pw-profile-panel">
                <div style={S.cardHeader}>
                  <div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: P.violet5 }}><Briefcase size={18} color={P.violet} /></div><div><h3 style={S.cardTitle}>Profils enregistrés</h3><p style={S.cardSub}>{activeProfiles.length} / {employees.length} salariés actifs avec un profil enregistré</p></div></div>
                </div>
                <div style={S.profileProgress}><div style={S.profileProgressTrack}><div style={{ ...S.profileProgressFill, width: `${employees.length > 0 ? (activeProfiles.length / employees.length) * 100 : 0}%` }} /></div><span style={S.profileProgressText}>{employees.length > 0 ? `${Math.round((activeProfiles.length / employees.length) * 100)}% enregistrés` : 'Aucun employé'}</span></div>
                <div style={S.listWrap}>
                  {activeProfiles.length === 0 ? <div style={S.emptyMini}><AlertTriangle size={18} color={P.texteFaint} /><span>Aucun profil enregistré</span></div> : activeProfiles.map((profile, i) => (
                    <button type="button" className="pw-profile-pick" aria-pressed={profile.employee_id === selectedEmployeeId} key={profile.id || i} style={{ ...S.listItem, ...(profile.employee_id === selectedEmployeeId ? { borderColor: P.indigo11, background: P.indigo7 } : {}) }} onClick={() => setSelectedEmployeeId(profile.employee_id)}>
                      <AvatarSalarie employe={profile.employees} taille={34} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={S.listTitle}>{profile.employees?.first_name} {profile.employees?.last_name}</div><div style={S.listSub}>{profile.employees?.matricule} • {profile.salary_type === 'monthly' ? 'Mensuel' : profile.salary_type === 'hourly' ? 'Horaire' : 'Journalier'} • {profile.salary_type === 'monthly' ? fmt(profile.base_salary) : profile.salary_type === 'hourly' ? `${fmt(profile.hourly_rate)}/h` : `${fmt(profile.daily_rate)}/j`}</div></div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <CheckCircle size={16} color={P.vert} />
                        <span style={{ ...S.typeBadge, background: profile.salary_type === 'monthly' ? P.indigo3 : profile.salary_type === 'hourly' ? P.ambre4 : P.vert1, color: profile.salary_type === 'monthly' ? P.indigoClair : profile.salary_type === 'hourly' ? P.ambre : P.vert }}>{profile.salary_type === 'monthly' ? 'MENSUEL' : profile.salary_type === 'hourly' ? 'HORAIRE' : 'JOURNALIER'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ ONGLET PRIMES & RETENUES ═══ */}
          {activeTab === 'allowances' && (
            <div className="pw-adjustments">
              <div className="pw-adjustment-guide"><div><span className="pw-eyebrow">AJOUTER AU SALAIRE</span><h3>Une prime</h3><p>Une somme ajoutée pour cette période. Exemple : 25 000 de prime exceptionnelle. Si elle est imposable, elle peut aussi augmenter l’impôt : le net ne monte pas forcément du même montant.</p></div><div><span className="pw-eyebrow">DÉDUIRE DU MONTANT À VERSER</span><h3>Une retenue</h3><p>Une somme à retrancher pour cette période. Exemple : une avance de 10 000 déjà versée. Vérifiez qu’elle n’est pas déjà enregistrée ailleurs.</p></div></div>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: P.vert1 }}><Gift size={18} color={P.vert} /></div><div><h3 style={S.cardTitle}>Primes ponctuelles — {periodStart ? new Date(periodStart + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Période'}</h3><p style={S.cardSub}>Uniquement pour la période sélectionnée ci-dessus.</p></div></div>
                  <button onClick={() => { setSelectedBonusEmployeeId(employees[0]?.id || ''); setShowBonusModal(true) }} className="pw-settings-button pw-settings-button-primary"><Plus size={16} /><span>Ajouter une prime</span></button></div>
                {periodBonuses.length === 0 ? <div style={S.emptyMini}><Gift size={18} color={P.texteFaint} /><span>Aucune prime ponctuelle</span></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {periodBonuses.map((bonus, i) => (<div key={bonus.id || i} style={S.bonusItem}><div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: P.texte, fontSize: 13, fontWeight: 700 }}>{bonus.name}</span><CategoryBadge category={bonus.allowance_types?.category || 'other'} />{bonus.is_taxable && <Badge color={P.ambre}>Imposable</Badge>}</div><div style={{ color: P.texteDoux2, fontSize: 11, marginTop: 3 }}>{bonus.employees?.first_name} {bonus.employees?.last_name} ({bonus.employees?.matricule}){bonus.reason && ` • ${bonus.reason}`}</div></div><span style={{ color: P.vert, fontSize: 15, fontWeight: 800 }}>{fmt(bonus.amount)}</span><button aria-label="Supprimer cette prime ponctuelle" onClick={() => handleDeleteBonus(bonus.id)} style={{ ...S.iconBtn, color: P.rouge }}><Trash2 size={14} /></button></div>))}
                    <div style={S.totalRow}><span style={{ color: P.texteDoux2 }}>Total</span><span style={{ color: P.vert, fontWeight: 800 }}>{fmt(periodBonuses.reduce((s, b) => s + (Number(b.amount) || 0), 0))}</span></div>
                  </div>
                )}
              </div>

              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: P.rouge7 }}><Minus size={18} color={P.rouge} /></div><div><h3 style={S.cardTitle}>Retenues ponctuelles — {periodStart ? new Date(periodStart + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Période'}</h3><p style={S.cardSub}>Une déduction ponctuelle, à vérifier avant le calcul.</p></div></div>
                  <button onClick={() => { setSelectedDeductionEmployeeId(employees[0]?.id || ''); setShowPeriodDeductionModal(true) }} className="pw-settings-button"><Plus size={16} /><span>Ajouter une retenue</span></button></div>
                {periodDeductions.length === 0 ? <div style={S.emptyMini}><Minus size={18} color={P.texteFaint} /><span>Aucune retenue ponctuelle</span></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {periodDeductions.map((ded, i) => (<div key={ded.id || i} style={{ ...S.bonusItem, borderColor: P.rouge9 }}><div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: P.texte, fontSize: 13, fontWeight: 700 }}>{ded.name}</span><CategoryBadge category={ded.deduction_types?.category || 'other'} /></div><div style={{ color: P.texteDoux2, fontSize: 11, marginTop: 3 }}>{ded.employees?.first_name} {ded.employees?.last_name}{ded.reason && ` • ${ded.reason}`}</div></div><span style={{ color: P.rouge, fontSize: 15, fontWeight: 800 }}>- {fmt(ded.amount)}</span><button aria-label="Supprimer cette retenue ponctuelle" onClick={() => handleDeletePeriodDeduction(ded.id)} style={{ ...S.iconBtn, color: P.rouge }}><Trash2 size={14} /></button></div>))}
                    <div style={S.totalRow}><span style={{ color: P.texteDoux2 }}>Total</span><span style={{ color: P.rouge, fontWeight: 800 }}>- {fmt(periodDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0))}</span></div>
                  </div>
                )}
              </div>

              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: P.indigo3 }}><Layers size={18} color={P.indigo} /></div><div><h3 style={S.cardTitle}>Primes récurrentes par employé</h3><p style={S.cardSub}>Les règles répétées chaque mois se gèrent dans le profil du salarié, avec leurs dates de validité.</p></div></div></div>
                <SearchBar value={searchAllowance} onChange={setSearchAllowance} placeholder="Rechercher un employé..." />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {(searchAllowance ? employees.filter(e => `${e.first_name} ${e.last_name} ${e.matricule}`.toLowerCase().includes(searchAllowance.toLowerCase())) : employees.slice(0, 10)).map(emp => (
                    <div key={emp.id} style={S.listItem} onClick={() => { setSelectedEmployeeId(emp.id); changerOnglet('profiles') }}>
                      <AvatarSalarie employe={emp} taille={32} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={S.listTitle}>{emp.first_name} {emp.last_name}</div><div style={S.listSub}>{emp.matricule}</div></div>
                      <button style={S.addBtnSmall} onClick={(e) => { e.stopPropagation(); setSelectedEmployeeId(emp.id); changerOnglet('profiles') }}><Edit size={12} /><span>Gérer</span></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ ONGLET IMPORT ═══ */}
          {activeTab === 'imports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={S.guideBar}><FileSpreadsheet size={16} color={P.ambre} style={{ flexShrink: 0, marginTop: 2 }} /><div><p style={S.guideTitle}>Format attendu</p><p style={S.guideText}>Le fichier doit contenir une colonne <strong>matricule</strong>. Les colonnes positives sont des gains, les négatives des retenues.</p></div></div>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={S.cardIcon}><Upload size={18} color={P.ambre} /></div><div><h3 style={S.cardTitle}>Importer les variables mensuelles</h3><p style={S.cardSub}>Primes, avances, commissions...</p></div></div></div>
                <div style={S.importZone}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={S.fileInput} id="payroll-file-input" />
                  <label htmlFor="payroll-file-input" style={S.fileInputLabel}>{importingFile ? <><RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /><span>Lecture...</span></> : <><FileSpreadsheet size={16} /><span>Choisir un fichier Excel / CSV</span></>}</label>
                  {importFileName && <div style={S.importFileInfo}><span style={{ color: P.texte, fontWeight: 600 }}>{importFileName}</span><button onClick={() => { setImportFileName(''); setImportPreviewRows([]); setImportColumns([]) }} style={S.clearBtn}><Trash2 size={14} /><span>Effacer</span></button></div>}
                </div>
              </div>
              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: P.vert1 }}><Eye size={18} color={P.vert} /></div><div><h3 style={S.cardTitle}>Aperçu de l'import</h3><p style={S.cardSub}>Validation par matricule</p></div></div>
                  {importPreviewRows.length > 0 && <button onClick={handleSaveImport} style={S.primaryBtn} disabled={savingImport}>{savingImport ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Save size={16} />}<span>{savingImport ? 'Enregistrement...' : 'Valider et enregistrer'}</span></button>}
                </div>
                {importPreviewRows.length === 0 ? <div style={S.emptyMini}><Upload size={18} color={P.texteFaint} /><span>Importez un fichier pour voir l'aperçu</span></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {importPreviewRows.map((row, i) => (
                      <div key={i} style={{ ...S.importPreviewItem, borderColor: row.is_valid ? P.vert10 : P.rouge10, background: row.is_valid ? P.vert4 : P.rouge5 }}>
                        <div style={S.importPreviewHeader}><div><div style={S.importPreviewTitle}>Ligne {row.rowIndex} — {row.matricule || 'Sans matricule'}</div><div style={S.importPreviewSub}>{row.is_valid ? `✓ ${row.employee_name}` : `✗ ${row.error_message}`}</div></div><div style={{ ...S.importStatusBadge, background: row.is_valid ? P.vert8 : P.rouge8, color: row.is_valid ? P.vert : P.rouge }}>{row.is_valid ? '✓ Valide' : '✗ Erreur'}</div></div>
                        <div style={S.importDataGrid}>{Object.entries(row.data || {}).map(([key, value]) => (<div key={key} style={S.importDataItem}><span style={S.importDataKey}>{key.replace(/_/g, ' ')}</span><span style={{ ...S.importDataValue, color: Number(value) < 0 ? P.rouge : P.texte }}>{String(value || 0)}</span></div>))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ ONGLET PREVIEW ═══ */}
          {activeTab === 'preview' && (
            <div className="pw-calculated-slips">
              <details className="pw-slip-guide"><summary>Comprendre les fiches calculées et leur envoi</summary><h3>{autoSendAfterCalculation ? 'Ce calcul déclenchera l’envoi des fiches vérifiées' : 'Calculer n’est pas encore publier'}</h3><ol><li><strong>Contrôler</strong><span>{autoSendAfterCalculation ? 'Vérifiez les profils, variables et règles avant de lancer le calcul.' : 'Relisez chaque montant et les éléments utilisés.'}</span></li><li><strong>Télécharger</strong><span>Le PDF ou Excel reste un document de contrôle.</span></li><li><strong>{autoSendAfterCalculation ? 'Envoi automatique' : 'Publier'}</strong><span>{autoSendAfterCalculation ? 'Après le calcul et les contrôles, toutes les fiches du lot deviennent consultables, sans paiement.' : 'Envoyer rend la fiche consultable par le salarié, sans transférer d’argent.'}</span></li></ol><details><summary>Brut, net et coût employeur : quelle différence ?</summary><p>Le brut est la rémunération avant les déductions salariales. Le net est le montant à verser après les retenues, cotisations salariales et impôt calculés. Le coût employeur ajoute au brut les charges patronales calculées. Les totaux ci-dessous additionnent uniquement les fiches de ce calcul, pas l’historique.</p></details></details>
              <div style={S.summaryTopGrid}>
                <div style={S.summaryTopCard}><DollarSign size={18} color={P.vert} /><div><div style={S.summaryTopValue}>{previewRows.length ? fmt(summary.totalGross) : '—'}</div><div style={S.summaryTopLabel}>Total brut</div></div></div>
                <div style={S.summaryTopCard}><Wallet size={18} color={P.ambre} /><div><div style={S.summaryTopValue}>{previewRows.length ? fmt(summary.totalNet) : '—'}</div><div style={S.summaryTopLabel}>Total net</div></div></div>
                <div style={S.summaryTopCard}><TrendingUp size={18} color={P.rouge} /><div><div style={S.summaryTopValue}>{previewRows.length ? fmt(summary.totalCost) : '—'}</div><div style={S.summaryTopLabel}>Coût employeur</div></div></div>
                <div style={S.summaryTopCard}><Users size={18} color={P.indigo} /><div><div style={S.summaryTopValue}>{summary.totalEmployees}</div><div style={S.summaryTopLabel}>Fiches calculées</div></div></div>
                <div style={S.summaryTopCard}><Send size={18} color={summary.alreadySent > 0 ? P.vert : P.texteFaint} /><div><div style={S.summaryTopValue}>{summary.alreadySent} / {summary.totalEmployees}</div><div style={S.summaryTopLabel}>Envoyées</div></div></div>
              </div>

              {previewRows.length > 0 && (
                <div style={S.sendAllBar}>
                  <div style={{ flex: 1 }}><p style={{ color: P.texte, fontSize: 14, fontWeight: 700, margin: '0 0 4px 0' }}>Publier les fiches</p><p style={{ color: P.texteDoux2, fontSize: 12, margin: 0 }}>Chaque employé pourra consulter sa fiche.{hasSignatures && ' Les signatures seront incluses.'}{hasStamp && ' Le cachet sera inclus.'}</p></div>
                  <button onClick={handleExportExcel} className="pw-settings-button"><Table size={16} /><span>Export Excel</span></button>
                  <button onClick={handleSendAllToEmployees} className="pw-settings-button pw-settings-button-primary" disabled={sendingSlips}>
                    {sendingSlips ? <RefreshCw size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Send size={16} />}
                    <span>{sendingSlips ? 'Envoi...' : `Envoyer ${previewRows.length} fiche(s)`}</span>
                  </button>
                </div>
              )}

              <div style={S.card} className="pay-card">
                <div style={S.cardHeader}><div style={S.cardHeaderLeft}><div style={{ ...S.cardIcon, background: P.vert1 }}><FileText size={18} color={P.vert} /></div><div><h3 style={S.cardTitle}>Bulletins de paie</h3><p style={S.cardSub}>Période : {periodStart} → {periodEnd} • {getWorkingDaysInMonth} jours ouvrables</p></div></div></div>
                <SearchBar value={searchPreview} onChange={setSearchPreview} placeholder="Filtrer les fiches..." />

                {filteredPreviewRows.length === 0 ? (
                  <div style={{ ...S.emptyMini, marginTop: 12 }}><Calendar size={18} color={P.texteFaint} /><span>{previewRows.length === 0 ? 'Aucun calcul pour cette période. Utilisez « Vérifier et calculer les bulletins ».' : 'Aucun résultat'}</span></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {filteredPreviewRows.map((row, i) => {
                      const isSent = sentSlips.has(row.employee?.id)
                      const salaryTypeLabel = { monthly: 'Mensuel', hourly: 'Horaire', daily: 'Journalier' }[row.profile?.salary_type] || 'Mensuel'
                      const empCumul = annualCumuls[row.employee?.id]
                      const empLeave = leaveBalances[row.employee?.id]

                      return (
                        <div className="pw-calculated-card" key={row.employee?.id || i} style={S.previewCard}>
                          <div style={S.previewHeader}>
                            <div>
                              <div style={S.previewName}>
                                {row.employee?.first_name} {row.employee?.last_name}
                                <Badge color={row.profile?.salary_type === 'monthly' ? P.indigo : row.profile?.salary_type === 'hourly' ? P.ambre : P.vert}>{salaryTypeLabel}</Badge>
                                {row.employee?.classification && <Badge color={P.violet}>{row.employee.classification}</Badge>}
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
                              <div style={S.previewNet}><small className="pw-net-caption">Net à verser</small>{fmt(row.netSalary)}</div>
                              <button onClick={() => handleDownloadSlip(row)} style={S.downloadBtn}><Download size={14} /><span>PDF</span></button>
                              <button onClick={() => handleSendToEmployee(row)} style={{ ...S.sendBtn, ...(isSent ? { opacity: 0.6 } : {}) }}><Send size={14} /><span>{isSent ? 'Renvoyer' : 'Envoyer'}</span></button>
                              {isSent && <button onClick={() => handleDeleteSentSlip(row)} style={S.deleteSentBtn} title="Retirer"><Trash2 size={14} /><span>Retirer</span></button>}
                            </div>
                          </div>

                          <div style={S.previewGrid}>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Base / Taux</span><span style={S.previewMiniValue}>{row.profile?.salary_type === 'monthly' ? fmt(row.profile?.base_salary) : row.profile?.salary_type === 'hourly' ? `${fmt(row.profile?.hourly_rate)}/h` : `${fmt(row.profile?.daily_rate)}/j`}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Total gains</span><span style={{ ...S.previewMiniValue, color: P.vert }}>{fmt(row.totalEarnings)}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Salaire brut</span><span style={S.previewMiniValue}>{fmt(row.grossSalary)}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Total retenues</span><span style={{ ...S.previewMiniValue, color: P.rouge }}>- {fmt(row.totalDeductions)}</span></div>
                            <div style={S.previewMini}><span style={S.previewMiniLabel}>Coût employeur</span><span style={S.previewMiniValue}>{fmt(row.employerCost)}</span></div>
                            {row.sources?.encheck?.totalOvertimeAllMinutes > 0 && <div style={S.previewMini}><span style={S.previewMiniLabel}>Heures sup</span><span style={{ ...S.previewMiniValue, color: P.orange }}>{Math.floor(row.sources.encheck.totalOvertimeAllMinutes / 60)}h{(row.sources.encheck.totalOvertimeAllMinutes % 60).toString().padStart(2, '0')}</span></div>}
                            {empLeave && <div style={S.previewMini}><span style={S.previewMiniLabel}>Congés restants</span><span style={{ ...S.previewMiniValue, color: P.indigo }}>{empLeave.remaining}j / {empLeave.acquired}j</span></div>}
                          </div>

                          {row.earnings?.length > 0 && (
                            <div style={S.earningsDetail}><p style={S.detailTitle}>Gains ({row.earnings.length})</p><div style={S.detailGrid}>{row.earnings.map((e, ei) => (<div key={ei} style={S.detailLine}><span style={{ color: P.texteDoux, fontSize: 11 }}>{e.label}</span><span style={{ color: P.vert, fontSize: 11, fontWeight: 700 }}>{fmt(e.amount)}</span></div>))}</div></div>
                          )}

                          {row.taxation && (
                            <div style={S.taxBlock}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Shield size={15} color={P.violet} />
                                <span style={{ color: P.violetClair, fontSize: 13, fontWeight: 700 }}>Fiscalité & Cotisations</span>
                                {(row.impot_a_verifier || row.taxation?.impot_a_verifier) && (
                                  <span style={{
                                    marginLeft: 'auto',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: P.ambre12,
                                    border: `1px solid ${P.ambre14}`,
                                    color: P.ambre,
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
                                  background: P.ambre2,
                                  border: `1px solid ${P.ambre13}`,
                                  color: P.ambreClair,
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                }}>
                                  <AlertTriangle size={15} color={P.ambre} style={{ flexShrink: 0, marginTop: 2 }} />
                                  <span>{row.avertissement || row.taxation?.avertissement}</span>
                                </div>
                              )}
                              <div style={S.taxGrid}>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Revenu imposable</span><span style={S.taxMiniValue}>{fmt(row.taxation.taxableIncome || 0)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Net imposable</span><span style={S.taxMiniValue}>{fmt((row.grossSalary || 0) - (row.taxation?.contributions?.totalEmployee || 0))}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Impôt IRPP</span><span style={{ ...S.taxMiniValue, color: P.rouge }}>{fmt(row.taxation.tax?.totalTax || 0)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Taux effectif</span><span style={S.taxMiniValue}>{row.taxation.tax?.effectiveRate || 0}%</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Cotis. salariales</span><span style={S.taxMiniValue}>{fmt(row.taxation.contributions?.totalEmployee || 0)}</span></div>
                                <div style={S.taxMini}><span style={S.taxMiniLabel}>Cotis. patronales</span><span style={S.taxMiniValue}>{fmt(row.taxation.contributions?.totalEmployer || 0)}</span></div>
                              </div>
                            </div>
                          )}

                          {/* Cumuls annuels */}
                          {empCumul && empCumul.slipCount > 0 && (
                            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: P.ambre11, border: `1px solid ${P.ambre3}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><TrendingUp size={14} color={P.ambre} /><span style={{ color: P.ambre, fontSize: 12, fontWeight: 700 }}>Cumuls annuels ({empCumul.slipCount} mois)</span></div>
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
                                    {settings.signatory1_name && <p style={{ color: P.texteDoux2, fontSize: 10, fontWeight: 600, margin: '4px 0 0 0', borderTop: `1px solid ${P.voile6}`, paddingTop: 4 }}>{settings.signatory1_name}</p>}
                                    {settings.signatory1_title && <p style={{ color: P.texteFaint, fontSize: 9, margin: '2px 0 0 0' }}>{settings.signatory1_title}</p>}
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
                                    {settings.signatory2_name && <p style={{ color: P.texteDoux2, fontSize: 10, fontWeight: 600, margin: '4px 0 0 0', borderTop: `1px solid ${P.voile6}`, paddingTop: 4 }}>{settings.signatory2_name}</p>}
                                    {settings.signatory2_title && <p style={{ color: P.texteFaint, fontSize: 9, margin: '2px 0 0 0' }}>{settings.signatory2_title}</p>}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Mention légale */}
                          {settings.legal_mention && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: P.voile1, border: `1px solid ${P.voile3}` }}>
                              <p style={{ color: P.texteFaint, fontSize: 9, margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{settings.legal_mention}</p>
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
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: P.rouge7, border: `1px solid ${P.rouge11}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={22} color={P.rouge} /></div><div><h3 style={S.modalTitle}>Retirer cette fiche ?</h3><p style={S.modalSub}>Elle ne sera plus visible par l'employé.</p></div></div><button onClick={() => { if (!deletingSlip) { setShowDeleteModal(false); setSlipToDelete(null) } }} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20 }}><div style={{ padding: '14px 16px', borderRadius: 14, background: P.voile2, border: `1px solid ${P.voile4}`, display: 'flex', flexDirection: 'column', gap: 8 }}><p style={{ margin: 0, color: P.texteDoux, fontSize: 13 }}><strong>Employé :</strong> {slipToDelete.employee?.first_name} {slipToDelete.employee?.last_name}</p><p style={{ margin: 0, color: P.texteDoux, fontSize: 13 }}><strong>Période :</strong> {periodStart} → {periodEnd}</p><p style={{ margin: 0, color: P.texteDoux, fontSize: 13 }}><strong>Net :</strong> {fmt(slipToDelete.netSalary)}</p></div></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: `1px solid ${P.voile5}` }}>
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
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: P.ambre4, border: `1px solid ${P.ambre6}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={22} color={P.ambre} /></div><div><h3 style={S.modalTitle}>Problèmes détectés</h3><p style={S.modalSub}>{preCheckResults.blockers.length} employé(s) sans profil valide</p></div></div><button onClick={() => setShowGenerateConfirm(false)} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20 }}><p style={{ color: P.texteDoux, fontSize: 13, margin: '0 0 12px 0' }}>Les employés suivants auront une fiche à 0 :</p><div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>{preCheckResults.blockers.map((b, i) => (<div key={i} style={{ padding: '8px 12px', background: P.rouge6, border: `1px solid ${P.rouge7}`, borderRadius: 10 }}><span style={{ color: P.rougeClair, fontSize: 12 }}>{b.employee} — {b.reason}</span></div>))}</div></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: `1px solid ${P.voile5}` }}><button onClick={() => setShowGenerateConfirm(false)} style={S.modalCancelBtn}>Annuler</button><button onClick={handleGeneratePreview} style={S.primaryBtn}><Eye size={16} /><span>Générer quand même</span></button></div>
              </div>
            </div>
          )}

          {/* Modale historique */}
          {showHistoryModal && (
            <div style={S.modalOverlay} onClick={() => setShowHistoryModal(false)}>
              <div style={{ ...S.modalContent, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: P.indigo3, border: `1px solid ${P.indigo9}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><History size={22} color={P.indigoClair} /></div><div><h3 style={S.modalTitle}>Historique des périodes</h3><p style={S.modalSub}>Cliquez sur une période pour la sélectionner</p></div></div><button onClick={() => setShowHistoryModal(false)} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
                  {loadingHistory ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 }}><RefreshCw size={20} color={P.ambre} style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ color: P.texteDoux2 }}>Chargement...</span></div>
                    : historyPeriods.length === 0 ? <div style={S.emptyMini}><History size={20} color={P.texteFaint} /><span>Aucune fiche envoyée</span></div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {historyPeriods.map((period, i) => {
                          const isCurrentPeriod = period.period_start === periodStart && period.period_end === periodEnd
                          const periodLabel = new Date(period.period_start + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
                          return (<div key={i} onClick={() => handleSelectHistoryPeriod(period)} style={{ padding: '14px 16px', borderRadius: 14, background: isCurrentPeriod ? P.indigo2 : P.voile2, border: isCurrentPeriod ? `1px solid ${P.indigo11}` : `1px solid ${P.voile5}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}>
                            <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><span style={{ color: P.texte, fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{periodLabel}</span>{isCurrentPeriod && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: P.indigo5, color: P.indigoClair }}>Période actuelle</span>}</div><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><span style={{ color: P.texteDoux2, fontSize: 12 }}><span style={{ color: P.vert, fontWeight: 700 }}>{period.count}</span> fiche(s)</span><span style={{ color: P.texteDoux2, fontSize: 12 }}>Net: <span style={{ color: P.ambre, fontWeight: 700 }}>{fmt(period.totalNet)}</span></span></div></div>
                            <ArrowRight size={16} color={P.texteFaint} />
                          </div>)
                        })}
                      </div>}
                </div>
                <div style={{ padding: '14px 20px', borderTop: `1px solid ${P.voile5}`, display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setShowHistoryModal(false)} style={S.modalCancelBtn}>Fermer</button></div>
              </div>
            </div>
          )}

          {/* Modale copie profil */}
          {showCopyProfileModal && (
            <div style={S.modalOverlay} onClick={() => setShowCopyProfileModal(false)}>
              <div style={{ ...S.modalContent, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={S.modalHeader}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: P.ambre4, border: `1px solid ${P.ambre6}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Copy size={22} color={P.ambre} /></div><div><h3 style={S.modalTitle}>Copier un profil</h3><p style={S.modalSub}>Vers : {employees.find(e => e.id === selectedEmployeeId)?.first_name} {employees.find(e => e.id === selectedEmployeeId)?.last_name}</p></div></div><button onClick={() => setShowCopyProfileModal(false)} style={S.modalCloseBtn}><X size={18} /></button></div>
                <div style={{ padding: 20 }}>
                  <div style={S.formGroup}><label style={S.labelSmall}>Copier le profil de</label>
                    <select value={copySourceEmployeeId} onChange={e => setCopySourceEmployeeId(e.target.value)} style={S.select}><option value="">Sélectionner un employé source</option>{profiles.filter(p => p.employee_id !== selectedEmployeeId).map(p => (<option key={p.employee_id} value={p.employee_id}>{p.employees?.first_name} {p.employees?.last_name} ({p.employees?.matricule}) — {p.salary_type === 'monthly' ? fmt(p.base_salary) : p.salary_type === 'hourly' ? `${fmt(p.hourly_rate)}/h` : `${fmt(p.daily_rate)}/j`}</option>))}</select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: `1px solid ${P.voile5}` }}><button onClick={() => setShowCopyProfileModal(false)} style={S.modalCancelBtn}>Annuler</button><button onClick={handleCopyProfile} style={S.primaryBtn} disabled={!copySourceEmployeeId}><Copy size={16} /><span>Copier ce profil</span></button></div>
              </div>
            </div>
          )}

        </div>
      </fieldset>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// STYLES COMPLETS
// ═══════════════════════════════════════════════════════════
