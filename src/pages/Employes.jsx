import PlanningPayslipBadge from '../components/PlanningPayslipBadge'
import PayslipIndicatorStatus from '../components/PayslipIndicatorStatus'
import useEmployeePayslipIndicators from '../hooks/useEmployeePayslipIndicators'
// ═══════════════════════════════════════════════════════════
// 👥 PAGE GESTION DES EMPLOYÉS - V2 ENRICHIE
// Ajouts : Infos personnelles, professionnelles, sociales
// Sections repliables, date embauche, CNPS, catégorie...
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Footprints, Users, Plus, ArrowLeft, Search, Edit, Trash2, X, Save,
  Eye, EyeOff, Camera, Upload, QrCode, Clock, Share2, AlertTriangle,
  BarChart2, ChevronDown, ChevronUp, Zap, Activity, ArrowRight, UserPlus,
  Briefcase, Hash, Mail, Phone, Building2, Shield, Grid3X3, LayoutList,
  Key, Lock, UserCheck, UserX, Calendar, Heart, Globe, CreditCard,
  FileText, Award, User, MapPin, Flag, Baby, Layers, Radio
} from 'lucide-react'
import toast from 'react-hot-toast'
import BadgeEmploye from '../components/BadgeEmploye'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import EmployesLoadingScreen from '../components/EmployesLoadingScreen'
import FicheEmployeModal from '../components/FicheEmployeModal'
import {
  EmployesAnalyticsCharts,
  EmployesCulturalHero,
  EmployesExecutiveKpis,
  EmployesLiveStatusBanner,
  EmployesPortraitCard,
} from '../components/EmployesAfroTechSections'
import { useTheme } from '../contexts/ThemeContext'
import { construirePauses, estPauseReelleEffectuee } from '../services/pausesService'
import { formaterHeureLocale, jourLocal } from '../utils/timezoneUtils'

// ═══════════════════════════════════════════════════════════
// COMPOSANT SECTION REPLIABLE
// ═══════════════════════════════════════════════════════════

function CollapsibleSection({ title, icon: Icon, iconColor = '#F59E0B', defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid var(--pt-line)',
      background: 'var(--pt-surface-soft)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `${iconColor}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color={iconColor} />
          </div>
          <span style={{ color: 'var(--pt-ink)', fontSize: 13, fontWeight: 700 }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
            }}>{badge}</span>
          )}
        </div>
        <div style={{ color: 'var(--pt-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronDown size={18} />
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════

export default function Employes() {
  const [admin, setAdmin] = useState(null)
  const [employes, setEmployes] = useState([])
  const payslipIndicators = useEmployeePayslipIndicators(employes)
  const [entreprises, setEntreprises] = useState([])
  const [plannings, setPlannings] = useState([])
  const [loading, setLoading] = useState(true)
  const [minLoadingDone, setMinLoadingDone] = useState(true)
  const [liveStatusByEmployee, setLiveStatusByEmployee] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedEnterpriseFilter, setSelectedEnterpriseFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const { darkMode, toggleTheme } = useTheme()

  const [weeklyStats, setWeeklyStats] = useState({})

  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showBadge, setShowBadge] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const [editingEmployee, setEditingEmployee] = useState(null)
  const [employeeToDelete, setEmployeeToDelete] = useState(null)
  const [badgeEmployee, setBadgeEmployee] = useState(null)
  const [selectedEmployeeForSchedule, setSelectedEmployeeForSchedule] = useState(null)

  const [showPin, setShowPin] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [modulePlanning, setModulePlanning] = useState(false)
  const [moduleQRCode, setModuleQRCode] = useState(false)

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef(null)

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
    matricule: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    pin: '',
    machine_pin: '',
    photo_url: '',
    // Nouveaux champs personnels
    date_of_birth: '',
    place_of_birth: '',
    nationality: '',
    gender: '',
    marital_status: '',
    dependents_count: 0,
    national_id_number: '',
    // Nouveaux champs professionnels
    hire_date: '',
    contract_type: '',
    contract_end_date: '',
    professional_category: '',
    echelon: '',
    classification: '',
    // Nouveaux champs sociaux
    cnps_number: '',
    tax_id_number: '',
  })

  const [scheduleFormData, setScheduleFormData] = useState({
    schedule_id: '',
    use_custom_hours: false,
    custom_start_time: '08:00',
    custom_end_time: '17:00',
    custom_break_start: '12:00',
    custom_break_end: '13:00',
    custom_has_break: true,
    custom_work_days: [1, 2, 3, 4, 5]
  })

  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    loadData(parsedAdmin)
  }, [navigate])

  // ═══════════════════════════════════════════════════════════
  // FONCTIONS UTILITAIRES
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // 06.B.4 — « CET EMPLOYÉ A-T-IL UN ACCÈS PORTAIL ? »
  // ═══════════════════════════════════════════════════════════
  // Deux marques possibles selon l'époque où le compte a été créé :
  //   • user_id       → compte Supabase (nouveau, 06.B). Le mot de passe
  //                     est vérifié par Supabase, jamais dans le navigateur.
  //   • password_hash → ancien système (empreinte locale). Les employés
  //                     équipés AVANT la 06.B le portent encore.
  //
  // ⚠️ L'interface doit reconnaître LES DEUX. Sans ça, un employé équipé
  //    depuis la 06.B réafficherait « Créer l'accès » alors qu'il a déjà
  //    un compte — et l'administrateur recréerait un doublon.
  const aUnCompteEmploye = (employe) => !!(employe?.user_id || employe?.password_hash)

  // ═══════════════════════════════════════════════════════════
  // 06.B.8 — « COMPTE SUPABASE » vs « ANCIEN SYSTÈME »
  // ═══════════════════════════════════════════════════════════
  // Les deux donnent accès au portail, mais il faut les DISTINGUER :
  //
  //   user_id       → compte Supabase. Mot de passe vérifié côté serveur.
  //                   C'est l'état VISÉ.
  //   password_hash → ancien système. Le mot de passe était vérifié dans
  //                   le navigateur. Ces employés doivent être MIGRÉS.
  //
  // ⚠️ POURQUOI C'EST IMPORTANT, ET PAS COSMÉTIQUE
  //    Sans cette distinction, un employé de l'ancien système affiche
  //    « Portail » en vert et un bouton « Modifier le mot de passe » —
  //    l'administrateur croit donc qu'il n'y a rien à faire, saute la
  //    ligne, et cet employé ne migre JAMAIS.
  //    Or la fermeture des Fiches de paie (06.B.3, partie 2) exige que
  //    TOUS les employés aient un compte. Un seul oubli bloque tout.
  const aUnCompteSupabase = (employe) => !!employe?.user_id
  const estAncienSysteme  = (employe) => !!employe?.password_hash && !employe?.user_id

  // ═══════════════════════════════════════════════════════════
  // 06.B.7 — « DERNIÈRE CONNEXION »
  // ═══════════════════════════════════════════════════════════
  // Remplie par `mark_employee_login()`, appelée à la connexion (06.B.7).
  //   • NULL          → l'employé ne s'est JAMAIS connecté. C'est une
  //                     information, pas un manque : c'est celui-là qu'il
  //                     faut aider.
  //   • une date      → il utilise son accès.
  const aDejaConnecte = (employe) => !!employe?.last_login_at

  const formatDerniereConnexion = (employe) => {
    if (!aUnCompteEmploye(employe)) return null   // pas de compte : rien à dire
    if (!employe?.last_login_at) return 'Jamais connecté'
    const date = new Date(employe.last_login_at)
    if (isNaN(date.getTime())) return null        // date illisible : on se taît
    const jours = Math.floor((Date.now() - date.getTime()) / 86400000)
    if (jours <= 0) return "Vu aujourd'hui"
    if (jours === 1) return 'Vu hier'
    if (jours < 30) return `Vu il y a ${jours} jours`
    return `Vu le ${date.toLocaleDateString('fr-FR')}`
  }

  const isPortalModuleEnabled = (employee) => {
    if (admin?.role === 'super_admin') return true
    return employee.enterprises?.module_espace_employe || false
  }

  const handleOpenPasswordModal = (employee) => {
    setSelectedEmployeeForPassword(employee)
    setNewPassword('')
    setConfirmPassword('')
    setShowNewPassword(false)
    setShowPasswordModal(true)
  }

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Le mot de passe doit contenir au moins 6 caractères'); return }
    if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return }
    const employe = selectedEmployeeForPassword
    setSavingPassword(true)
    try {
      // ═══════════════════════════════════════════════════════════
      // 06.B.4 — LE MOT DE PASSE EST VÉRIFIÉ PAR SUPABASE, PAS ICI
      // ═══════════════════════════════════════════════════════════
      // Avant : le navigateur calculait une empreinte SHA-256 et l'écrivait
      // dans `password_hash` — la vérification se faisait donc côté client.
      //
      // Maintenant tout passe par une fonction de la base :
      //   • pas encore de compte → on le crée
      //   • compte existant      → on change le mot de passe
      // Dans les deux cas, Supabase enregistre un bcrypt. Le mot de passe
      // n'est jamais conservé en clair et le navigateur ne le vérifie plus.
      if (employe.user_id) {
        const { data, error } = await supabase.rpc('set_employee_password', {
          p_employee_id: employe.id,
          p_password: newPassword,
        })
        if (error) throw error
        if (data && data.ok === false) throw new Error(data.message || 'Refus de la base')
        toast.success(`Mot de passe modifié pour ${employe.first_name} !`)
      } else {
        // `p_email: null` → l'identifiant de connexion est fabriqué à partir
        // du MATRICULE. C'est volontaire : l'employé se connecte avec un
        // matricule qu'il connaît déjà, et aucun email d'emprunt ne peut
        // être relié au compte de quelqu'un d'autre.
        const { data, error } = await supabase.rpc('create_employee_auth_user', {
          p_employee_id: employe.id,
          p_email: null,
          p_password: newPassword,
        })
        if (error) throw error
        if (data && data.ok === false) throw new Error(data.message || 'Refus de la base')
        toast.success(
          `Compte créé pour ${employe.first_name} — il se connecte avec son matricule ${employe.matricule || ''} et ce mot de passe.`,
          { duration: 10000 }
        )
      }

      // Le portail est marqué actif : c'est ce qui allume le badge vert.
      const { error: errPortail } = await supabase.from('employees')
        .update({ employee_portal_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', employe.id)
      if (errPortail) throw errPortail

      setShowPasswordModal(false)
      loadData(admin)
    } catch (err) { console.error('Erreur accès portail:', err); toast.error(err?.message || 'Erreur lors de la sauvegarde', { duration: 9000 }) }
    setSavingPassword(false)
  }

  const handleTogglePortalAccess = async (employee, enabled) => {
    try {
      const { error } = await supabase.from('employees').update({
        employee_portal_enabled: enabled,
        updated_at: new Date().toISOString(),
      }).eq('id', employee.id)
      if (error) throw error
      toast.success(enabled ? 'Accès portail activé' : 'Accès portail désactivé')
      loadData(admin)
    } catch (err) { console.error('Erreur:', err); toast.error('Erreur lors de la modification') }
  }

  // ═══════════════════════════════════════════════════════════
  // CHARGEMENT DES DONNÉES
  // ═══════════════════════════════════════════════════════════

  const loadData = async (adminData) => {
    try {
      const isSuperAdmin = adminData.role === 'super_admin'
      const selectedEnterprise = adminData.selectedEnterprise
      let targetEnterpriseId = isSuperAdmin
        ? selectedEnterprise?.id || null
        : selectedEnterprise?.id || adminData.enterprise_id || null

      let employesQuery = supabase
        .from('employees')
        .select(`*, enterprises(name, matricule_prefix, logo_url, primary_color, module_planning, module_qr_scanner, module_espace_employe)`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (targetEnterpriseId) employesQuery = employesQuery.eq('enterprise_id', targetEnterpriseId)

      const { data: employesData, error: empError } = await employesQuery
      if (empError) console.error('Erreur employés:', empError)

      let employesAvecHoraires = employesData || []

      if (employesData && employesData.length > 0) {
        const employeeIds = employesData.map(e => e.id)
        const { data: schedulesData } = await supabase
          .from('employee_schedules')
          .select('*, work_schedules(id, name, start_time, end_time)')
          .in('employee_id', employeeIds)

        employesAvecHoraires = employesData.map(emp => {
          const schedule = schedulesData?.find(s => s.employee_id === emp.id)
          return { ...emp, employee_schedules: schedule ? [schedule] : [] }
        })

        await calculateWeeklyStats(employeeIds, targetEnterpriseId)
        await loadTodayLiveEmployeeStatus(employesAvecHoraires, targetEnterpriseId)
      }

      setEmployes(employesAvecHoraires)

      let modulePlanningActif = false
      let moduleQRCodeActif = false

      if (isSuperAdmin && !targetEnterpriseId) {
        const { data: entreprisesData } = await supabase.from('enterprises').select('*').eq('is_active', true).order('name')
        setEntreprises(entreprisesData || [])
        modulePlanningActif = true
        moduleQRCodeActif = true
      } else if (targetEnterpriseId) {
        const { data: entrepriseData } = await supabase.from('enterprises').select('*').eq('id', targetEnterpriseId).single()
        setEntreprises(entrepriseData ? [entrepriseData] : [])
        if (entrepriseData) {
          modulePlanningActif = entrepriseData.module_planning || false
          moduleQRCodeActif = entrepriseData.module_qr_scanner || false
        }
      }

      setModulePlanning(modulePlanningActif)
      setModuleQRCode(moduleQRCodeActif)

      if (isSuperAdmin || modulePlanningActif) {
        const enterpriseIdsDesEmployes = [...new Set((employesAvecHoraires || []).map(e => e.enterprise_id).filter(Boolean))]
        let planningsData = []
        if (enterpriseIdsDesEmployes.length > 0) {
          const { data, error: planErr } = await supabase.from('work_schedules').select('*').in('enterprise_id', enterpriseIdsDesEmployes).eq('is_active', true).order('name')
          if (planErr) console.error('Erreur plannings:', planErr)
          planningsData = data || []
        } else if (isSuperAdmin) {
          const { data } = await supabase.from('work_schedules').select('*').eq('is_active', true).order('name')
          planningsData = data || []
        }
        setPlannings(planningsData)
      }
    } catch (error) { console.error('Erreur chargement:', error) }
    setLoading(false)
  }

  const calculateWeeklyStats = async (employeeIds, enterpriseId) => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const { data: attendances } = await supabase
      .from('attendances')
      .select('employee_id, check_time, check_type')
      .in('employee_id', employeeIds)
      .gte('check_time', monday.toISOString())
      .lte('check_time', sunday.toISOString())
      .order('check_time', { ascending: true })

    const stats = {}
    employeeIds.forEach(empId => {
      const empPoints = (attendances || []).filter(a => a.employee_id === empId)
      let totalSeconds = 0, lastIn = null
      empPoints.forEach(pt => {
        if (pt.check_type === 'in') lastIn = new Date(pt.check_time)
        else if (pt.check_type === 'out' && lastIn) { totalSeconds += (new Date(pt.check_time) - lastIn) / 1000; lastIn = null }
      })
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      stats[empId] = { totalSeconds, hours, minutes, label: `${hours}h ${minutes}m`, percentage: Math.min((hours / 40) * 100, 100) }
    })
    setWeeklyStats(stats)
  }

  const loadTodayLiveEmployeeStatus = async (employesList, targetEnterpriseId) => {
    try {
      const todayStr = jourLocal(new Date()) || new Date().toISOString().split('T')[0]
      const startOfDay = new Date(`${todayStr}T00:00:00`).toISOString()
      const endOfDay = new Date(`${todayStr}T23:59:59`).toISOString()
      const empIds = (employesList || []).map((e) => e.id)
      if (!empIds.length) return

      let directPausesQuery = supabase.from('encheck_pauses').select('*').eq('jour', todayStr)
      if (targetEnterpriseId) directPausesQuery = directPausesQuery.eq('enterprise_id', targetEnterpriseId)

      const [attRes, absRes, rpcPausesRes, directPausesRes] = await Promise.all([
        supabase
          .from('attendances')
          .select('id, employee_id, check_time, check_type, is_auto_closed')
          .in('employee_id', empIds)
          .gte('check_time', startOfDay)
          .lte('check_time', endOfDay)
          .order('check_time', { ascending: true }),
        supabase
          .from('absences')
          .select('id, employee_id, reason')
          .in('employee_id', empIds)
          .lte('start_date', todayStr)
          .gte('end_date', todayStr),
        supabase
          .rpc('encheck_pauses_lire', {
            p_enterprise: targetEnterpriseId || null,
            p_du: todayStr,
            p_au: todayStr,
          })
          .then((r) => r)
          .catch(() => ({ data: [] })),
        directPausesQuery.then((r) => r).catch(() => ({ data: [] })),
      ])

      const rawPauses = (rpcPausesRes?.data && rpcPausesRes.data.length > 0)
        ? rpcPausesRes.data
        : (directPausesRes?.data || [])
      const parsedPauses = construirePauses(rawPauses).paies || []
      const atts = attRes?.data || []
      const absences = absRes?.data || []

      const nextMap = {}
      for (const emp of employesList) {
        const empAtts = atts.filter((a) => a.employee_id === emp.id)
        const empAbs = absences.find((ab) => ab.employee_id === emp.id)
        const sched = emp.employee_schedules?.[0]
        const hasPlannedBreak = Boolean(
          sched && (sched.use_custom_hours ? sched.custom_has_break : sched.work_schedules?.has_break)
        )

        const empPauses = parsedPauses
          .filter((pa) => pa.employe_id === emp.id && estPauseReelleEffectuee(pa))
          .map((pa) => ({
            ...pa,
            debutHHMM: pa.debutISO ? formaterHeureLocale(pa.debutISO) : pa.debutHHMM,
            finHHMM: pa.finISO ? formaterHeureLocale(pa.finISO) : pa.finHHMM,
            estNonPlanifiee: !hasPlannedBreak,
          }))

        const activePause = empPauses.find((pa) => pa.ouverte) || null
        const firstIn = empAtts.find((a) => String(a.check_type || '').toLowerCase() === 'in') || null
        const lastPunch = empAtts.length > 0 ? empAtts[empAtts.length - 1] : null
        const lastOut = lastPunch && String(lastPunch.check_type || '').toLowerCase() === 'out' ? lastPunch : null

        let state = 'non_pointe'
        if (activePause) state = 'en_pause'
        else if (firstIn && !lastOut) state = 'en_poste'
        else if (firstIn && lastOut) state = 'termine'
        else if (empAbs) state = 'en_conge'

        nextMap[emp.id] = {
          state,
          activePause,
          entryHHMM: firstIn ? formaterHeureLocale(firstIn.check_time) : null,
          exitHHMM: lastOut ? formaterHeureLocale(lastOut.check_time) : null,
          pausesCount: empPauses.length,
          unplannedPausesCount: empPauses.filter((pa) => pa.estNonPlanifiee).length,
          totalPauseMinutes: empPauses.reduce((acc, pa) => acc + (Number(pa.dureeMinutes) || 0), 0),
        }
      }

      setLiveStatusByEmployee(nextMap)
    } catch (err) {
      console.error('Erreur statut live employés:', err)
    }
  }

  const getHoursColor = (hours) => {
    if (hours >= 35) return '#10B981'
    if (hours >= 20) return '#F59E0B'
    if (hours > 0) return '#EF4444'
    return '#555'
  }

  const hasherPin = async (pin) => {
    const sel = 'EnCheck_2024_Secure'
    const contenu = `${sel}${pin}${sel}`
    const encoder = new TextEncoder()
    const data = encoder.encode(contenu)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const genererMatricule = async (enterpriseId) => {
    const entreprise = entreprises.find(e => e.id === enterpriseId)
    if (!entreprise) return ''
    const prefix = entreprise.matricule_prefix || 'EMP'
    const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId)
    const numero = ((count || 0) + 1).toString().padStart(4, '0')
    return `${prefix}-${numero}`
  }

  // ═══════════════════════════════════════════════════════════
  // PHOTO
  // ═══════════════════════════════════════════════════════════

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Veuillez sélectionner une image'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image est trop grande (max 5MB)"); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => { setPhotoPreview(null); setPhotoFile(null); setFormData({ ...formData, photo_url: '' }) }

  const uploadPhoto = async (matricule) => {
    if (!photoFile) return null
    setUploading(true)
    try {
      const extension = photoFile.name.split('.').pop()
      const fileName = `${matricule}-${Date.now()}.${extension}`
      const { error } = await supabase.storage.from('photos').upload(fileName, photoFile, { cacheControl: '3600', upsert: true })
      if (error) { console.error('Erreur upload:', error); return null }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
      return urlData.publicUrl
    } catch (error) { console.error('Erreur upload:', error); return null }
    finally { setUploading(false) }
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD EMPLOYÉS
  // ═══════════════════════════════════════════════════════════

  const handleAdd = async () => {
    const targetEnterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id
    const matricule = await genererMatricule(targetEnterpriseId)
    setFormData({
      enterprise_id: targetEnterpriseId,
      matricule,
      first_name: '', last_name: '', email: '', phone: '',
      department: '', position: '', pin: '', machine_pin: '', photo_url: '',
      date_of_birth: '', place_of_birth: '', nationality: '',
      gender: '', marital_status: '', dependents_count: 0,
      national_id_number: '',
      hire_date: new Date().toISOString().split('T')[0],
      contract_type: 'CDI', contract_end_date: '',
      professional_category: '', echelon: '', classification: '',
      cnps_number: '', tax_id_number: '',
    })
    setEditingEmployee(null)
    setPhotoPreview(null)
    setPhotoFile(null)
    setShowModal(true)
  }

  const handleEdit = (employee) => {
    setFormData({
      enterprise_id: employee.enterprise_id,
      matricule: employee.matricule,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email || '',
      phone: employee.phone || '',
      department: employee.department || '',
      position: employee.position || '',
      pin: '',
      machine_pin: employee.machine_pin || '',
      photo_url: employee.photo_url || '',
      date_of_birth: employee.date_of_birth || '',
      place_of_birth: employee.place_of_birth || '',
      nationality: employee.nationality || '',
      gender: employee.gender || '',
      marital_status: employee.marital_status || '',
      dependents_count: employee.dependents_count || 0,
      national_id_number: employee.national_id_number || '',
      hire_date: employee.hire_date || '',
      contract_type: employee.contract_type || '',
      contract_end_date: employee.contract_end_date || '',
      professional_category: employee.professional_category || '',
      echelon: employee.echelon || '',
      classification: employee.classification || '',
      cnps_number: employee.cnps_number || '',
      tax_id_number: employee.tax_id_number || '',
    })
    setEditingEmployee(employee)
    setPhotoPreview(employee.photo_url || null)
    setPhotoFile(null)
    setShowModal(true)
  }

  const handleShowBadge = (employee) => { setBadgeEmployee(employee); setShowBadge(true) }

  const handleSave = async () => {
    try {
      if (!formData.first_name || !formData.last_name) { toast.error('Le prénom et le nom sont obligatoires'); return }
      if (!editingEmployee && !formData.pin) { toast.error('Le code PIN est obligatoire pour un nouvel employé'); return }
      if (formData.pin && formData.pin.length !== 4) { toast.error('Le code PIN doit contenir 4 chiffres'); return }

      let pinHash = null
      if (formData.pin) pinHash = await hasherPin(formData.pin)

      let photoUrl = formData.photo_url
      if (photoFile) {
        const uploadedUrl = await uploadPhoto(formData.matricule)
        if (uploadedUrl) photoUrl = uploadedUrl
      }

      const commonData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        department: formData.department || null,
        position: formData.position || null,
        photo_url: photoUrl || null,
        // Nouveaux champs personnels
        date_of_birth: formData.date_of_birth || null,
        place_of_birth: formData.place_of_birth || null,
        nationality: formData.nationality || null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        dependents_count: parseInt(formData.dependents_count) || 0,
        national_id_number: formData.national_id_number || null,
        // Nouveaux champs professionnels
        hire_date: formData.hire_date || null,
        contract_type: formData.contract_type || null,
        contract_end_date: formData.contract_end_date || null,
        professional_category: formData.professional_category || null,
        echelon: formData.echelon || null,
        classification: formData.classification || null,
        // Nouveaux champs sociaux
        cnps_number: formData.cnps_number || null,
        tax_id_number: formData.tax_id_number || null,
        updated_at: new Date().toISOString(),
      }

      let employeId = editingEmployee?.id || null

      if (editingEmployee) {
        const updateData = { ...commonData }
        if (pinHash) updateData.pin_hash = pinHash
        const { error: errMaj } = await supabase.from('employees').update(updateData).eq('id', editingEmployee.id)
        if (errMaj) throw errMaj
        toast.success('Employé modifié !')
      } else {
        const { data: cree, error: errInsert } = await supabase
          .from('employees')
          .insert({
            ...commonData,
            enterprise_id: formData.enterprise_id,
            matricule: formData.matricule,
            pin_hash: pinHash,
            is_active: true,
          })
          .select('id')
          .single()
        if (errInsert) throw errInsert
        employeId = cree?.id || null
        toast.success('Employé ajouté !')
      }

      // ── Le numéro porté SUR la pointeuse ─────────────────────────────────
      //  Attribué par la fonction dédiée : elle normalise la saisie
      //  (« 0001 » et « 1 » désignent le même numéro), refuse un numéro déjà
      //  porté par un collègue de la même entreprise, et efface le champ
      //  lorsqu'il est vidé.
      if (employeId) {
        const numeroSaisi = formData.machine_pin.trim()
        const { data: resPin, error: errPin } = await supabase.rpc('encheck_employe_pin_machine', {
          p_employee_id: employeId,
          p_pin: numeroSaisi,
        })

        if (errPin) {
          console.warn('[Employés] numéro de pointeuse :', errPin.message)
          toast.error("Le numéro de pointeuse n'a pas pu être enregistré. Réessayez depuis la fiche de l'employé.")
        } else if (resPin?.ok === false && resPin.reason === 'numero_deja_pris') {
          toast.error(
            'Numéro refusé : il est déjà porté par un autre employé de cette entreprise. '
            + 'Deux employés avec le même numéro faussent les pointages.',
            { duration: 9000 },
          )
        } else if (resPin?.ok === false) {
          console.warn('[Employés] numéro de pointeuse refusé :', resPin.reason)
          toast.error("Le numéro de pointeuse n'a pas pu être enregistré.")
        } else if (numeroSaisi) {
          toast.success(`Numéro ${resPin.machine_pin} attribué sur la pointeuse.`)
        } else {
          toast.success('Numéro de pointeuse retiré.')
        }
      }

      setShowModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      loadData(admin)
    } catch (error) { console.error('Erreur sauvegarde:', error); toast.error('Erreur lors de la sauvegarde') }
  }

  const initiateDelete = (employee) => { setEmployeeToDelete(employee); setShowDeleteModal(true) }

  const confirmDelete = async () => {
    if (!employeeToDelete) return
    try {
      await supabase.from('employees').update({ is_active: false }).eq('id', employeeToDelete.id)
      toast.success('Employé supprimé')
      loadData(admin)
    } catch (error) { console.error('Erreur suppression:', error); toast.error('Erreur lors de la suppression') }
    finally { setShowDeleteModal(false); setEmployeeToDelete(null) }
  }

  // ═══════════════════════════════════════════════════════════
  // HORAIRES
  // ═══════════════════════════════════════════════════════════

  const handleOpenSchedule = async (employee) => {
    setSelectedEmployeeForSchedule(employee)
    const { data: employeePlannings } = await supabase.from('work_schedules').select('*').eq('enterprise_id', employee.enterprise_id).eq('is_active', true).order('name')
    if (employeePlannings && employeePlannings.length > 0) {
      setPlannings(prev => {
        const autresEntreprises = prev.filter(p => p.enterprise_id !== employee.enterprise_id)
        return [...autresEntreprises, ...employeePlannings]
      })
    }

    const { data: existingSchedule } = await supabase.from('employee_schedules').select('*').eq('employee_id', employee.id).maybeSingle()

    if (existingSchedule) {
      setScheduleFormData({
        schedule_id: existingSchedule.schedule_id || '',
        use_custom_hours: existingSchedule.use_custom_hours || false,
        custom_start_time: existingSchedule.custom_start_time?.slice(0, 5) || '08:00',
        custom_end_time: existingSchedule.custom_end_time?.slice(0, 5) || '17:00',
        custom_break_start: existingSchedule.custom_break_start?.slice(0, 5) || '12:00',
        custom_break_end: existingSchedule.custom_break_end?.slice(0, 5) || '13:00',
        custom_has_break: existingSchedule.custom_has_break ?? true,
        custom_work_days: existingSchedule.custom_work_days || [1, 2, 3, 4, 5]
      })
    } else {
      setScheduleFormData({
        schedule_id: '', use_custom_hours: false,
        custom_start_time: '08:00', custom_end_time: '17:00',
        custom_break_start: '12:00', custom_break_end: '13:00',
        custom_has_break: true, custom_work_days: [1, 2, 3, 4, 5]
      })
    }
    setShowScheduleModal(true)
  }

  const handleSaveSchedule = async () => {
    if (!selectedEmployeeForSchedule) return
    try {
      const dataToSave = {
        employee_id: selectedEmployeeForSchedule.id,
        schedule_id: scheduleFormData.use_custom_hours ? null : (scheduleFormData.schedule_id || null),
        use_custom_hours: scheduleFormData.use_custom_hours,
        custom_start_time: scheduleFormData.use_custom_hours ? scheduleFormData.custom_start_time + ':00' : null,
        custom_end_time: scheduleFormData.use_custom_hours ? scheduleFormData.custom_end_time + ':00' : null,
        custom_break_start: scheduleFormData.use_custom_hours && scheduleFormData.custom_has_break ? scheduleFormData.custom_break_start + ':00' : null,
        custom_break_end: scheduleFormData.use_custom_hours && scheduleFormData.custom_has_break ? scheduleFormData.custom_break_end + ':00' : null,
        custom_has_break: scheduleFormData.use_custom_hours ? scheduleFormData.custom_has_break : null,
        custom_work_days: scheduleFormData.use_custom_hours ? scheduleFormData.custom_work_days : null,
        updated_at: new Date().toISOString()
      }
      const { data: existing } = await supabase.from('employee_schedules').select('id').eq('employee_id', selectedEmployeeForSchedule.id).maybeSingle()
      if (existing) await supabase.from('employee_schedules').update(dataToSave).eq('id', existing.id)
      else await supabase.from('employee_schedules').insert(dataToSave)
      toast.success('Horaires enregistrés !')
      setShowScheduleModal(false)
      loadData(admin)
    } catch (error) { console.error('Erreur sauvegarde horaires:', error); toast.error('Erreur lors de la sauvegarde') }
  }

  const toggleJourTravail = (jourId) => {
    if (scheduleFormData.custom_work_days.includes(jourId)) {
      setScheduleFormData({ ...scheduleFormData, custom_work_days: scheduleFormData.custom_work_days.filter(j => j !== jourId) })
    } else {
      setScheduleFormData({ ...scheduleFormData, custom_work_days: [...scheduleFormData.custom_work_days, jourId].sort() })
    }
  }

  const getEmployeeScheduleInfo = (employee) => {
    const entreprise = employee.enterprises
    const moduleActif = admin?.role === 'super_admin' || entreprise?.module_planning
    if (!moduleActif) return null
    const scheduleData = employee.employee_schedules?.[0]
    if (!scheduleData) return 'Non défini'
    if (scheduleData.use_custom_hours) {
      const start = scheduleData.custom_start_time?.slice(0, 5) || '--:--'
      const end = scheduleData.custom_end_time?.slice(0, 5) || '--:--'
      return `${start} - ${end}`
    }
    if (scheduleData.schedule_id && scheduleData.work_schedules) return scheduleData.work_schedules.name
    if (scheduleData.schedule_id) return 'Planning attribué'
    return 'Non défini'
  }

  const isModulePlanningEnabled = (employee) => {
    if (admin?.role === 'super_admin') return true
    return employee.enterprises?.module_planning || false
  }

  const handleShareSchedule = (employee) => {
    const scheduleData = employee.employee_schedules?.[0]
    let horaires = 'Non défini'
    if (scheduleData) {
      if (scheduleData.use_custom_hours) {
        horaires = `${scheduleData.custom_start_time?.slice(0, 5) || '--:--'} - ${scheduleData.custom_end_time?.slice(0, 5) || '--:--'}`
      } else if (scheduleData.work_schedules) {
        horaires = `${scheduleData.work_schedules.name} (${scheduleData.work_schedules.start_time?.slice(0, 5) || '--:--'} - ${scheduleData.work_schedules.end_time?.slice(0, 5) || '--:--'})`
      }
    }
    const message = `📋 *Horaires de travail*\n\n👤 *${employee.first_name} ${employee.last_name}*\n🆔 Matricule: ${employee.matricule}\n⏰ Horaires: ${horaires}\n\n_Envoyé via En-Check_`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleEnterpriseChange = async (enterpriseId) => {
    const matricule = await genererMatricule(enterpriseId)
    setFormData({ ...formData, enterprise_id: enterpriseId, matricule })
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS D'AFFICHAGE
  // ═══════════════════════════════════════════════════════════

  const getContractLabel = (type) => {
    const labels = { CDI: 'CDI', CDD: 'CDD', Stage: 'Stage', Interim: 'Intérim', Apprentissage: 'Apprentissage', Freelance: 'Freelance' }
    return labels[type] || type || ''
  }

  const getContractColor = (type) => {
    const colors = { CDI: '#10B981', CDD: '#F59E0B', Stage: '#6366F1', Interim: '#EC4899', Apprentissage: '#14B8A6', Freelance: '#F97316' }
    return colors[type] || '#888'
  }

  const getClassificationLabel = (cls) => {
    const labels = { cadre: 'Cadre', agent_maitrise: 'Agent de maîtrise', employe: 'Employé', ouvrier: 'Ouvrier', stagiaire: 'Stagiaire' }
    return labels[cls] || cls || ''
  }

  const calculateSeniority = (hireDate) => {
    if (!hireDate) return null
    const hire = new Date(hireDate)
    const now = new Date()
    const years = now.getFullYear() - hire.getFullYear()
    const months = now.getMonth() - hire.getMonth()
    if (years > 0) return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months}m` : ''}`
    if (months > 0) return `${months} mois`
    return 'Nouveau'
  }

  // ═══════════════════════════════════════════════════════════
  // FILTRAGE
  // ═══════════════════════════════════════════════════════════

  const hasDefaultPlanByEnterprise = new Set(
    (plannings || []).filter((pl) => pl.is_default && pl.is_active !== false).map((pl) => pl.enterprise_id)
  )

  const employesFiltres = employes.filter(emp => {
    if (selectedEnterpriseFilter !== 'all' && emp.enterprise_id !== selectedEnterpriseFilter) {
      return false
    }
    if (categoryFilter !== 'all') {
      const sched = emp.employee_schedules?.[0]
      const hasPersonal = Boolean(sched && (sched.use_custom_hours || sched.schedule_id))
      const hasGeneral = !hasPersonal && emp.enterprises?.module_planning !== false && hasDefaultPlanByEnterprise.has(emp.enterprise_id)
      const st = liveStatusByEmployee[emp.id]
      if (categoryFilter === 'portal_active' && !(emp.employee_portal_enabled && aUnCompteEmploye(emp))) return false
      if (categoryFilter === 'portal_migrate' && !estAncienSysteme(emp)) return false
      if (categoryFilter === 'machine_pin' && !emp.machine_pin) return false
      if (categoryFilter === 'no_machine_pin' && emp.machine_pin) return false
      if (categoryFilter === 'sched_personal' && !hasPersonal) return false
      if (categoryFilter === 'sched_general' && !hasGeneral) return false
      if (categoryFilter === 'sched_free' && (hasPersonal || hasGeneral)) return false
      if (categoryFilter === 'contract_CDI' && emp.contract_type !== 'CDI') return false
      if (categoryFilter === 'contract_CDD' && emp.contract_type !== 'CDD') return false
      if (categoryFilter === 'contract_other' && (!emp.contract_type || emp.contract_type === 'CDI' || emp.contract_type === 'CDD')) return false
      if (categoryFilter === 'live_on_duty' && !(st?.state === 'en_poste' || st?.state === 'en_pause' || st?.state === 'termine')) return false
    }
    const search = searchTerm.toLowerCase()
    if (!search) return true
    return (
      emp.first_name?.toLowerCase().includes(search) ||
      emp.last_name?.toLowerCase().includes(search) ||
      emp.matricule?.toLowerCase().includes(search) ||
      emp.department?.toLowerCase().includes(search) ||
      emp.position?.toLowerCase().includes(search) ||
      emp.cnps_number?.toLowerCase().includes(search) ||
      emp.classification?.toLowerCase().includes(search) ||
      emp.contract_type?.toLowerCase().includes(search)
    )
  })

  const getScheduleRegimeLabel = (employee) => {
    const scheduleData = employee.employee_schedules?.[0]
    if (scheduleData) {
      if (scheduleData.use_custom_hours) {
        const start = scheduleData.custom_start_time?.slice(0, 5) || '08:00'
        const end = scheduleData.custom_end_time?.slice(0, 5) || '17:00'
        return `Planning perso (${start}–${end})`
      }
      if (scheduleData.work_schedules) {
        return `Planning · ${scheduleData.work_schedules.name}`
      }
    }
    const defaultEntPlan = plannings.find((pl) => pl.enterprise_id === employee.enterprise_id && pl.is_default && pl.is_active !== false)
    if (employee.enterprises?.module_planning !== false && defaultEntPlan) {
      return `Planning général · ${defaultEntPlan.name}`
    }
    return 'Planning non disponible dans En-Check'
  }

  const departments = [...new Set(employes.map(e => e.department).filter(Boolean))]

  if (loading || !minLoadingDone) {
    return <EmployesLoadingScreen darkMode={darkMode} onSkip={() => setMinLoadingDone(true)} />
  }

  // ═══════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes progressFill { from { width: 0%; } to { width: var(--target-width); } }
        .afro-emp-card { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .afro-emp-card:hover { transform: translateY(-4px) !important; box-shadow: 0 16px 50px rgba(0,0,0,0.4) !important; border-color: rgba(245, 158, 11, 0.25) !important; }
        .afro-grid-card { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .afro-grid-card:hover { transform: translateY(-6px) scale(1.02) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.5) !important; border-color: rgba(245, 158, 11, 0.3) !important; }
        .afro-action-icon { transition: all 0.2s ease !important; }
        .afro-action-icon:hover { transform: scale(1.15) !important; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3) !important; }
        .afro-add-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 30px rgba(245, 158, 11, 0.4) !important; }
        .afro-search:focus-within { border-color: rgba(245, 158, 11, 0.5) !important; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1) !important; }
        .progress-bar-fill { animation: progressFill 1s ease-out forwards; }
        .afro-modal-overlay { animation: fadeIn 0.3s ease; }
        .afro-modal-content { animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .afro-view-btn:hover { background: rgba(245, 158, 11, 0.15) !important; }
        .afro-back-btn:hover { background: rgba(245, 158, 11, 0.2) !important; border-color: rgba(245, 158, 11, 0.4) !important; }
        @media (max-width: 768px) { .desktop-only { display: none !important; } .mobile-stack { flex-direction: column !important; } .mobile-full { width: 100% !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0A0A0F; } ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 3px; }
        select option { background: #141423; color: #E5E5E5; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      <div className="pointages-afrotech-shell" data-theme={darkMode ? 'dark' : 'light'} style={styles.container}>
        <EmployesCulturalHero
          totalCount={employesFiltres.length}
          departmentsCount={departments.length}
          entreprises={entreprises}
          selectedEnterpriseId={selectedEnterpriseFilter}
          onSelectEnterprise={(val) => setSelectedEnterpriseFilter(val)}
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          onBackDashboard={() => navigate('/dashboard')}
          onNavigate={(path) => navigate(path)}
          onAddEmployee={handleAdd}
        />

        {/* ═══ MAIN ═══ */}
        <main style={styles.main}>
          <EmployesExecutiveKpis
            employes={employesFiltres}
            liveStatusByEmployee={liveStatusByEmployee}
            plannings={plannings}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={(val) => setCategoryFilter(val)}
            onFilterSearch={(val) => setSearchTerm(val)}
          />

          <div className="employes-middle-showcase">
            <div className="employes-directory-head-col">
              <div className="employes-directory-title-row">
                <h2>Annuaire des Employés</h2>
                <div className="employes-directory-dots" aria-hidden="true">
                  <span />
                  <span className="is-active" />
                </div>
              </div>

              {/* Toolbar */}
              <div style={styles.toolbar}>
                <div className="afro-search" style={styles.searchContainer}>
                  <Search size={18} color="#888" />
                  <input type="text" placeholder="Rechercher par nom, matricule, poste, contrat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
                  {(searchTerm || categoryFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setCategoryFilter('all')
                      }}
                      style={styles.clearSearch}
                      title="Réinitialiser les filtres"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div style={styles.toolbarRight}>
                  <div style={styles.viewToggle}>
                    <button className="afro-view-btn" onClick={() => setViewMode('grid')} style={{ ...styles.viewBtn, ...(viewMode === 'grid' ? styles.viewBtnActive : {}) }} title="Vue Cartes Portrait"><Grid3X3 size={16} /></button>
                    <button className="afro-view-btn" onClick={() => setViewMode('list')} style={{ ...styles.viewBtn, ...(viewMode === 'list' ? styles.viewBtnActive : {}) }} title="Vue Liste"><LayoutList size={16} /></button>
                  </div>
                  <div style={styles.resultCount}>
                    <span style={styles.resultNumber}>{employesFiltres.length}</span>
                    <span style={styles.resultText}>résultat{employesFiltres.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {employes.filter(e => estAncienSysteme(e)).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 12 }}>
                  <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{ color: '#F59E0B', fontSize: 12, fontWeight: 700, margin: '0 0 2px 0' }}>
                      {employes.filter(e => estAncienSysteme(e)).length} employé{employes.filter(e => estAncienSysteme(e)).length > 1 ? 's' : ''} à migrer vers le nouveau portail
                    </p>
                    <p style={{ color: 'var(--pt-muted)', fontSize: 11, margin: 0 }}>
                      Cliquez sur « Migrer portail » sur leur carte pour activer leur nouveau mot de passe.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <EmployesAnalyticsCharts
              employes={employesFiltres}
              plannings={plannings}
              onSelectDepartment={(dept) => setSearchTerm(dept)}
            />
          </div>

          <PayslipIndicatorStatus status={payslipIndicators}/>
          {/* ═══ EMPLOYEE LIST ═══ */}
          {employesFiltres.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}><Users size={48} color="#F59E0B" /></div>
              <h3 style={styles.emptyTitle}>Aucun employé trouvé</h3>
              <p style={styles.emptySubtitle}>{searchTerm ? 'Essayez avec un autre terme de recherche' : 'Commencez par ajouter votre premier employé'}</p>
              {!searchTerm && <button onClick={handleAdd} className="afro-add-btn" style={styles.emptyAddBtn}><UserPlus size={18} /><span>Ajouter un employé</span></button>}
            </div>
          ) : viewMode === 'grid' ? (
            /* ─── PORTRAIT CARDS VIEW (FIDÈLE À L'IMAGE CHOISIE) ─── */
            <div className="employes-portrait-grid">
              {employesFiltres.map((employee) => {
                const stats = weeklyStats[employee.id]
                const portalEnabled = isPortalModuleEnabled(employee)
                return (
                  <EmployesPortraitCard
                    key={employee.id}
                    employee={employee}
                    payslipEntries={payslipIndicators.entriesFor(employee)}
                    payslipDate={payslipIndicators.date}
                    liveStatus={liveStatusByEmployee[employee.id]}
                    weeklyStats={stats}
                    scheduleRegimeLabel={getScheduleRegimeLabel(employee)}
                    portalEnabled={portalEnabled}
                    hasAccount={aUnCompteEmploye(employee)}
                    isLegacyAccount={estAncienSysteme(employee)}
                    canEditPlanning={isModulePlanningEnabled(employee)}
                    onOpenFiche={handleEdit}
                    onShowBadge={handleShowBadge}
                    onOpenSchedule={handleOpenSchedule}
                    onOpenPointages={(emp) => navigate(`/pointages?q=${encodeURIComponent(emp.matricule || emp.last_name || '')}`)}
                    onOpenPassword={handleOpenPasswordModal}
                    onDelete={initiateDelete}
                  />
                )
              })}
            </div>
          ) : (
            /* ─── LIST VIEW ─── */
            <div style={styles.listView}>
              {employesFiltres.map((employee, index) => {
                const stats = weeklyStats[employee.id]
                const scheduleInfo = getEmployeeScheduleInfo(employee)
                const portalEnabled = isPortalModuleEnabled(employee)
                const seniority = calculateSeniority(employee.hire_date)

                return (
                  <div key={employee.id} className="afro-emp-card" style={{ ...styles.listCard, animation: `fadeInUp 0.4s ease ${index * 0.04}s forwards`, opacity: 0 }}>
                    <div style={styles.listCardLeft}>
                      <div style={styles.listAvatar}>
                        {employee.photo_url ? <img src={employee.photo_url} alt="" style={styles.listAvatarImg} /> : <span style={styles.listAvatarInitials}>{employee.first_name?.[0]}{employee.last_name?.[0]}</span>}
                        {stats && stats.totalSeconds > 0 && <div style={{ ...styles.avatarStatusRing, borderColor: getHoursColor(stats.hours) }}></div>}
                      </div>

                      <div style={styles.listInfo}>
                        <PlanningPayslipBadge entries={payslipIndicators.entriesFor(employee)} referenceDate={payslipIndicators.date}/>
                        <div style={styles.listNameRow}>
                          <span style={styles.listName}>{employee.first_name} {employee.last_name}</span>
                          <span style={styles.listMatricule}>{employee.matricule}</span>
                          <span
                            title={employee.machine_pin ? `Numéro sur la pointeuse : ${employee.machine_pin}` : 'Aucun numéro sur la pointeuse : les pointages de la machine ne pourront pas lui être rattachés'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6, fontSize: 10,
                              fontWeight: 800, letterSpacing: '.02em',
                              background: employee.machine_pin ? 'rgba(20,184,166,.12)' : 'rgba(156,163,175,.15)',
                              color: employee.machine_pin ? '#0F766E' : '#6B7280',
                            }}
                          >
                            <Radio size={10} />
                            {employee.machine_pin ? employee.machine_pin : '—'}
                          </span>
                          {employee.contract_type && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${getContractColor(employee.contract_type)}12`, color: getContractColor(employee.contract_type) }}>
                              {getContractLabel(employee.contract_type)}
                            </span>
                          )}
                          {aUnCompteEmploye(employee) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: estAncienSysteme(employee) ? 'rgba(245, 158, 11, 0.12)' : (employee.employee_portal_enabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)'), color: estAncienSysteme(employee) ? '#F59E0B' : (employee.employee_portal_enabled ? '#22C55E' : '#EF4444') }}>
                              {estAncienSysteme(employee) ? <AlertTriangle size={10} /> : (employee.employee_portal_enabled ? <UserCheck size={10} /> : <UserX size={10} />)} {estAncienSysteme(employee) ? 'À migrer' : 'Portail'}
                            </span>
                          )}
                        </div>

                        <div style={styles.listMetaRow}>
                          {employee.position && <span style={styles.listMeta}><Briefcase size={11} />{employee.position}</span>}
                          {employee.department && <span style={styles.listMeta}><Building2 size={11} />{employee.department}</span>}
                          {employee.classification && <span style={{ ...styles.listMeta, color: '#818CF8' }}><Award size={11} />{getClassificationLabel(employee.classification)}</span>}
                          {seniority && <span style={{ ...styles.listMeta, color: '#10B981' }}><Calendar size={11} />{seniority}</span>}
                          {formatDerniereConnexion(employee) && (
                            <span style={{ ...styles.listMeta, color: aDejaConnecte(employee) ? '#60A5FA' : '#F59E0B' }}>
                              <Clock size={11} />{formatDerniereConnexion(employee)}
                            </span>
                          )}
                          {scheduleInfo && <span style={{ ...styles.listMeta, color: '#10B981' }}><Clock size={11} />{scheduleInfo}</span>}
                          {employee.cnps_number && <span style={{ ...styles.listMeta, color: '#888' }}><Shield size={11} />CNPS: {employee.cnps_number}</span>}
                          {admin?.role === 'super_admin' && <span style={{ ...styles.listMeta, color: '#F59E0B' }}><Building2 size={11} />{employee.enterprises?.name}</span>}
                        </div>

                        {stats && (
                          <div style={styles.listProgressContainer}>
                            <div style={styles.progressTrackSmall}><div className="progress-bar-fill" style={{ ...styles.progressFillSmall, '--target-width': `${stats.percentage}%`, background: getHoursColor(stats.hours) }}></div></div>
                            <span style={{ ...styles.listProgressLabel, color: getHoursColor(stats.hours) }}>{stats.label}</span>
                          </div>
                        )}

                        <EmployesLiveStatusBanner
                          liveStatus={liveStatusByEmployee[employee.id]}
                          scheduleRegimeLabel={getScheduleRegimeLabel(employee)}
                          onOpenPointages={() => navigate(`/pointages?q=${encodeURIComponent(employee.matricule || employee.last_name || '')}`)}
                        />
                      </div>
                    </div>

                    <div style={styles.listActions}>
                      {isModulePlanningEnabled(employee) && (
                        <>
                          <button className="afro-action-icon" onClick={() => handleOpenSchedule(employee)} style={styles.listActionBtn} title="Horaires"><Clock size={16} color="#10B981" /></button>
                          <button className="afro-action-icon" onClick={() => handleShareSchedule(employee)} style={styles.listActionBtn} title="WhatsApp"><Share2 size={16} color="#25D366" /></button>
                        </>
                      )}
                      <button className="afro-action-icon" onClick={() => handleShowBadge(employee)} style={styles.listActionBtn} title="Badge QR"><QrCode size={16} color="#F59E0B" /></button>
                      {portalEnabled && (
                        <>
                          <button className="afro-action-icon" onClick={() => handleOpenPasswordModal(employee)} style={{ ...styles.listActionBtn, borderColor: aUnCompteEmploye(employee) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)' }} title={aUnCompteSupabase(employee) ? 'Modifier mot de passe' : (estAncienSysteme(employee) ? "Migrer vers le nouveau systeme (cree un compte)" : 'Créer accès portail')}><Key size={16} color={aUnCompteEmploye(employee) ? '#22C55E' : '#F59E0B'} /></button>
                          {aUnCompteEmploye(employee) && <button className="afro-action-icon" onClick={() => handleTogglePortalAccess(employee, !employee.employee_portal_enabled)} style={{ ...styles.listActionBtn, borderColor: employee.employee_portal_enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }} title={employee.employee_portal_enabled ? 'Désactiver accès' : 'Activer accès'}>{employee.employee_portal_enabled ? <UserCheck size={16} color="#22C55E" /> : <UserX size={16} color="#EF4444" />}</button>}
                        </>
                      )}
                      <button className="afro-action-icon" onClick={() => handleEdit(employee)} style={styles.listActionBtn} title="Modifier"><Edit size={16} color="#6366F1" /></button>
                      <button className="afro-action-icon" onClick={() => initiateDelete(employee)} style={{ ...styles.listActionBtn, ...styles.listDeleteBtn }} title="Supprimer"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={styles.footer}>
            <div style={styles.footerLine}></div>
            <p style={styles.footerText}><EnCheckBrandMark size={18} />EN-CHECK • On gère ! • Gestion du Personnel</p>
          </div>
        </main>

        {/* ═══════════ MODALS ═══════════ */}

        {/* ─── DELETE CONFIRM ─── */}
        {showDeleteModal && employeeToDelete && (
          <div className="afro-modal-overlay" style={styles.modalOverlay}>
            <div className="afro-modal-content" style={styles.confirmModal}>
              <div style={styles.modalIconWrap}><AlertTriangle size={28} color="#EF4444" /></div>
              <h3 style={styles.modalTitle}>Confirmer la suppression</h3>
              <p style={styles.modalText}>Voulez-vous vraiment supprimer <strong style={{ color: '#F59E0B' }}>{employeeToDelete.first_name} {employeeToDelete.last_name}</strong> ?<br />Cette action est irréversible.</p>
              <div style={styles.modalBtns}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.modalCancelBtn}>Annuler</button>
                <button onClick={confirmDelete} style={styles.modalDeleteBtn}><Trash2 size={16} /> Supprimer</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADD/EDIT EMPLOYEE (ENRICHI) ─── */}
        {showModal && (
          <FicheEmployeModal
            employee={editingEmployee}
            mode={editingEmployee ? 'edit' : 'create'}
            scheduleInfo={
              editingEmployee
                ? { label: getScheduleRegimeLabel(editingEmployee) }
                : null
            }
            entreprises={entreprises}
            defaultEnterpriseId={
              selectedEnterpriseFilter !== 'all'
                ? selectedEnterpriseFilter
                : admin?.selectedEnterprise?.id || admin?.enterprise_id || entreprises?.[0]?.id || ''
            }
            isSuperAdmin={admin?.role === 'super_admin'}
            canEdit={true}
            onClose={() => {
              setShowModal(false)
              setEditingEmployee(null)
            }}
            onSaved={() => loadData(admin)}
          />
        )}

        {/* ─── BADGE ─── */}
        {showBadge && badgeEmployee && (
          <BadgeEmploye
            employee={badgeEmployee}
            entrepriseName={badgeEmployee.enterprises?.name || 'En-Check'}
            entrepriseLogo={badgeEmployee.enterprises?.logo_url}
            primaryColor={badgeEmployee.enterprises?.primary_color ?? '#D4AF37'}
            onClose={() => setShowBadge(false)}
          />
        )}

        {/* ─── SCHEDULE MODAL ─── */}
        {showScheduleModal && selectedEmployeeForSchedule && (
          <div className="afro-modal-overlay" style={styles.modalOverlay}>
            <div className="afro-modal-content" style={styles.formModal}>
              <div style={styles.formModalHeader}>
                <div style={styles.formModalTitleWrap}>
                  <div style={{ ...styles.formModalIcon, background: 'rgba(16,185,129,0.12)' }}><Clock size={20} color="#10B981" /></div>
                  <div>
                    <h2 style={styles.formModalTitle}>Horaires de {selectedEmployeeForSchedule.first_name}</h2>
                    <span style={styles.formModalSub}>Définir le planning de travail</span>
                  </div>
                </div>
                <button onClick={() => setShowScheduleModal(false)} style={styles.formCloseBtn}><X size={20} /></button>
              </div>

              <div style={styles.formModalBody}>
                <div style={styles.scheduleChoiceWrap}>
                  <label style={{ ...styles.scheduleOption, borderColor: !scheduleFormData.use_custom_hours ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.06)', background: !scheduleFormData.use_custom_hours ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                    <input type="radio" name="scheduleType" checked={!scheduleFormData.use_custom_hours} onChange={() => setScheduleFormData({ ...scheduleFormData, use_custom_hours: false })} style={styles.radioInput} />
                    <div><span style={styles.scheduleOptionTitle}>Planning existant</span><span style={styles.scheduleOptionDesc}>Utiliser un planning prédéfini</span></div>
                  </label>
                  <label style={{ ...styles.scheduleOption, borderColor: scheduleFormData.use_custom_hours ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.06)', background: scheduleFormData.use_custom_hours ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                    <input type="radio" name="scheduleType" checked={scheduleFormData.use_custom_hours} onChange={() => setScheduleFormData({ ...scheduleFormData, use_custom_hours: true })} style={styles.radioInput} />
                    <div><span style={styles.scheduleOptionTitle}>Personnalisé</span><span style={styles.scheduleOptionDesc}>Horaires sur mesure</span></div>
                  </label>
                </div>

                {!scheduleFormData.use_custom_hours && (
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Sélectionner un planning</label>
                    {plannings.filter(p => p.enterprise_id === selectedEmployeeForSchedule.enterprise_id).length === 0 && (
                      <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: 10, color: '#F59E0B', fontSize: 12, marginBottom: 8 }}>
                        ⚠️ Aucun planning trouvé pour cette entreprise.
                      </div>
                    )}
                    <select value={scheduleFormData.schedule_id} onChange={(e) => setScheduleFormData({ ...scheduleFormData, schedule_id: e.target.value })} style={styles.formSelect}>
                      <option value="">-- Aucun planning --</option>
                      {plannings.filter(p => p.enterprise_id === selectedEmployeeForSchedule.enterprise_id).map((planning) => (
                        <option key={planning.id} value={planning.id}>{planning.name} ({planning.start_time?.slice(0, 5)} - {planning.end_time?.slice(0, 5)}){planning.is_default ? ' ★' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {scheduleFormData.use_custom_hours && (
                  <>
                    <div style={styles.formRow}>
                      <div style={styles.formField}><label style={styles.formLabel}>Arrivée</label><input type="time" value={scheduleFormData.custom_start_time} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_start_time: e.target.value })} style={styles.formInput} /></div>
                      <div style={styles.formField}><label style={styles.formLabel}>Départ</label><input type="time" value={scheduleFormData.custom_end_time} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_end_time: e.target.value })} style={styles.formInput} /></div>
                    </div>
                    <label style={styles.checkboxWrap}>
                      <input type="checkbox" checked={scheduleFormData.custom_has_break} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_has_break: e.target.checked })} style={styles.checkboxInput} />
                      <span style={styles.checkboxText}>Pause déjeuner</span>
                    </label>
                    {scheduleFormData.custom_has_break && (
                      <div style={styles.formRow}>
                        <div style={styles.formField}><label style={styles.formLabel}>Début pause</label><input type="time" value={scheduleFormData.custom_break_start} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_break_start: e.target.value })} style={styles.formInput} /></div>
                        <div style={styles.formField}><label style={styles.formLabel}>Fin pause</label><input type="time" value={scheduleFormData.custom_break_end} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_break_end: e.target.value })} style={styles.formInput} /></div>
                      </div>
                    )}
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Jours de travail</label>
                      <div style={styles.daysRow}>
                        {joursSemaine.map((jour) => (
                          <button key={jour.id} type="button" onClick={() => toggleJourTravail(jour.id)} style={{ ...styles.dayChip, ...(scheduleFormData.custom_work_days.includes(jour.id) ? styles.dayChipActive : {}) }}>{jour.court}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={styles.formModalFooter}>
                <button onClick={() => setShowScheduleModal(false)} style={styles.modalCancelBtn}>Annuler</button>
                <button onClick={handleSaveSchedule} style={styles.modalSaveBtn}><Save size={16} /> Enregistrer</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSWORD MODAL ═══ */}
        {showPasswordModal && selectedEmployeeForPassword && (
          <div className="afro-modal-overlay" style={styles.modalOverlay}>
            <div className="afro-modal-content" style={styles.formModal}>
              <div style={styles.formModalHeader}>
                <div style={styles.formModalTitleWrap}>
                  <div style={{ ...styles.formModalIcon, background: 'rgba(34, 197, 94, 0.12)' }}><Key size={20} color="#22C55E" /></div>
                  <div>
                    <h2 style={styles.formModalTitle}>{aUnCompteSupabase(selectedEmployeeForPassword) ? 'Modifier le mot de passe' : (estAncienSysteme(selectedEmployeeForPassword) ? 'Migrer l\'accès portail' : 'Créer l\'accès portail')}</h2>
                    <span style={styles.formModalSub}>{selectedEmployeeForPassword.first_name} {selectedEmployeeForPassword.last_name}</span>
                  </div>
                </div>
                <button onClick={() => setShowPasswordModal(false)} style={styles.formCloseBtn}><X size={20} /></button>
              </div>

              <div style={styles.formModalBody}>
                <div style={{ padding: '14px 16px', background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Shield size={20} color="#22C55E" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ color: '#22C55E', fontSize: 13, fontWeight: 600, margin: '0 0 4px 0' }}>Accès Espace Employé</p>
                    <p style={{ color: '#888', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                      L'employé se connectera sur <strong style={{ color: '#22C55E' }}>/employee/login</strong> avec son{' '}
                      <strong style={{ color: '#FFF' }}>matricule</strong>
                      {selectedEmployeeForPassword.matricule
                        ? <> (<strong style={{ color: '#FFF' }}>{selectedEmployeeForPassword.matricule}</strong>)</>
                        : null}{' '}
                      — ou son téléphone, ou son email s'il en a un — et ce mot de passe.
                    </p>
                  </div>
                </div>

                {/* 06.B.7 — où en est cet employé ? Visible au moment même
                    où l'administrateur gère son accès. */}
                {formatDerniereConnexion(selectedEmployeeForPassword) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={14} color={aDejaConnecte(selectedEmployeeForPassword) ? '#60A5FA' : '#F59E0B'} />
                    <span style={{ fontSize: 12, color: '#888' }}>
                      Dernière connexion :{' '}
                      <strong style={{ color: aDejaConnecte(selectedEmployeeForPassword) ? '#60A5FA' : '#F59E0B' }}>
                        {formatDerniereConnexion(selectedEmployeeForPassword)}
                      </strong>
                    </span>
                  </div>
                )}

                {/* 06.B.8 — AVERTISSEMENT DE MIGRATION
                    L'employé a déjà un mot de passe qu'il utilise. Celui
                    qu'on va définir le REMPLACE. S'il n'est pas prévenu,
                    il est enfermé dehors sans comprendre pourquoi. */}
                {estAncienSysteme(selectedEmployeeForPassword) && (
                  <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: '#F59E0B', fontSize: 12, lineHeight: 1.5 }}>
                      Cet employé se connecte aujourd'hui avec l'<strong>ancien système</strong>.
                      Le mot de passe ci-dessous le <strong>remplacera définitivement</strong> :
                      l'ancien cessera de fonctionner. <strong>Communiquez-lui le nouveau</strong> dès maintenant.
                    </span>
                  </div>
                )}

                {/* 06.B.4 — Avant, un employé sans email ET sans téléphone ne
                    pouvait pas recevoir d'accès : le bouton restait désactivé.
                    Ce n'est plus nécessaire — l'identifiant de connexion est
                    fabriqué à partir du MATRICULE. Le seul vrai prérequis est
                    donc le matricule. */}
                {!aUnCompteEmploye(selectedEmployeeForPassword) && !selectedEmployeeForPassword.matricule && (
                  <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} color="#EF4444" />
                    <span style={{ color: '#EF4444', fontSize: 12 }}>Cet employé n'a pas de matricule. Renseignez-en un : c'est avec lui qu'il se connectera.</span>
                  </div>
                )}

                <div style={styles.formField}>
                  <label style={styles.formLabel}><Lock size={14} /> Nouveau mot de passe</label>
                  <div style={styles.pinFieldWrap}>
                    <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={styles.formInput} placeholder="Minimum 6 caractères" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={styles.pinEyeBtn}>{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </div>
                  {newPassword && newPassword.length < 6 && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Le mot de passe doit contenir au moins 6 caractères</span>}
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}><Lock size={14} /> Confirmer le mot de passe</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={styles.formInput} placeholder="Retaper le mot de passe" autoComplete="new-password" />
                  {confirmPassword && newPassword && (
                    <span style={{ fontSize: 12, marginTop: 4, color: confirmPassword === newPassword ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {confirmPassword === newPassword ? <><UserCheck size={12} /> Les mots de passe correspondent</> : <><UserX size={12} /> Les mots de passe ne correspondent pas</>}
                    </span>
                  )}
                </div>

                {aUnCompteEmploye(selectedEmployeeForPassword) && (
                  <div style={{ padding: '12px 16px', background: selectedEmployeeForPassword.employee_portal_enabled ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)', border: `1px solid ${selectedEmployeeForPassword.employee_portal_enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: selectedEmployeeForPassword.employee_portal_enabled ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {selectedEmployeeForPassword.employee_portal_enabled ? <><UserCheck size={14} /> Accès portail actif</> : <><UserX size={14} /> Accès portail désactivé</>}
                    </span>
                    <button onClick={() => handleTogglePortalAccess(selectedEmployeeForPassword, !selectedEmployeeForPassword.employee_portal_enabled)} style={{ padding: '6px 12px', background: selectedEmployeeForPassword.employee_portal_enabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: 'none', borderRadius: 8, color: selectedEmployeeForPassword.employee_portal_enabled ? '#EF4444' : '#22C55E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {selectedEmployeeForPassword.employee_portal_enabled ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.formModalFooter}>
                <button onClick={() => setShowPasswordModal(false)} style={styles.modalCancelBtn}>Annuler</button>
                <button onClick={handleSavePassword} disabled={savingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword || (!aUnCompteEmploye(selectedEmployeeForPassword) && !selectedEmployeeForPassword.matricule)}
                  style={{ ...styles.modalSaveBtn, background: 'linear-gradient(135deg, #22C55E, #16A34A)', opacity: (savingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword || (!aUnCompteEmploye(selectedEmployeeForPassword) && !selectedEmployeeForPassword.matricule)) ? 0.5 : 1, cursor: (savingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword || (!aUnCompteEmploye(selectedEmployeeForPassword) && !selectedEmployeeForPassword.matricule)) ? 'not-allowed' : 'pointer' }}>
                  {savingPassword ? <span>Enregistrement...</span> : <><Key size={16} />{aUnCompteSupabase(selectedEmployeeForPassword) ? 'Modifier' : (estAncienSysteme(selectedEmployeeForPassword) ? 'Migrer l\'accès' : 'Créer l\'accès')}</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════

const styles = {
  container: { minHeight: '100vh', background: 'var(--pt-canvas)', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0 },
  bgOrb1: { position: 'fixed', top: '-20%', right: '-8%', width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none', zIndex: 0 },
  bgOrb2: { position: 'fixed', bottom: '-25%', left: '-12%', width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none', zIndex: 0 },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'var(--pt-canvas)' },
  loadingPulse: { animation: 'float 2s ease-in-out infinite' },
  loadingText: { color: 'var(--pt-muted)', fontSize: 16, letterSpacing: 2 },
  loadingBar: { width: 200, height: 2, background: 'rgba(245,158,11,0.1)', borderRadius: 2, overflow: 'hidden' },
  loadingBarFill: { width: '40%', height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: 2, animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' },
  header: { background: 'var(--pt-surface)', borderBottom: '1px solid var(--pt-line)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: 1400, margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { background: 'var(--pt-surface-soft)', border: '1px solid var(--pt-line)', borderRadius: 10, padding: 8, color: 'var(--pt-copper-strong)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  logoMark: { width: 38, height: 38, borderRadius: 10, background: 'var(--pt-copper-soft)', border: '1px solid var(--pt-line)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: 'var(--pt-ink)', fontSize: 18, fontWeight: 700, letterSpacing: 3, margin: 0, lineHeight: 1.2 },
  headerSub: { color: 'var(--pt-copper-strong)', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500 },
  addBtnHeader: { display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #C87B3E, #9C5321)', color: '#FFF', padding: '10px 20px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.3s ease', letterSpacing: 0.5 },
  main: { padding: 20, maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 },
  summaryStrip: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, background: 'var(--pt-surface)', borderRadius: 16, border: '1px solid var(--pt-line)', padding: '16px 24px', marginBottom: 20, flexWrap: 'wrap' },
  summaryCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '4px 20px', flex: '1 1 auto', justifyContent: 'center', minWidth: 100 },
  summaryDivider: { width: 1, height: 32, background: 'var(--pt-line)' },
  summaryIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  summaryInfo: { display: 'flex', flexDirection: 'column' },
  summaryNumber: { color: 'var(--pt-ink)', fontSize: 22, fontWeight: 700, lineHeight: 1 },
  summaryLabel: { color: 'var(--pt-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
  searchContainer: { flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--pt-surface)', border: '1px solid var(--pt-line)', padding: '12px 16px', borderRadius: 14, transition: 'all 0.3s ease' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--pt-ink)', fontFamily: 'inherit' },
  clearSearch: { background: 'var(--pt-surface-soft)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', color: 'var(--pt-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 12 },
  viewToggle: { display: 'flex', gap: 2, background: 'var(--pt-surface)', borderRadius: 10, padding: 3, border: '1px solid var(--pt-line)' },
  viewBtn: { background: 'transparent', border: 'none', borderRadius: 8, padding: '8px 10px', color: 'var(--pt-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  viewBtnActive: { background: 'var(--pt-copper-soft)', color: 'var(--pt-copper-strong)' },
  resultCount: { display: 'flex', alignItems: 'baseline', gap: 6 },
  resultNumber: { color: 'var(--pt-copper-strong)', fontSize: 20, fontWeight: 700 },
  resultText: { color: 'var(--pt-muted)', fontSize: 12 },
  empty: { textAlign: 'center', padding: '80px 20px', background: 'var(--pt-surface)', borderRadius: 24, border: '1px solid var(--pt-line)' },
  emptyIcon: { width: 80, height: 80, borderRadius: 20, background: 'var(--pt-copper-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' },
  emptyTitle: { color: 'var(--pt-ink)', fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' },
  emptySubtitle: { color: 'var(--pt-muted)', fontSize: 14, margin: '0 0 24px 0' },
  emptyAddBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #C87B3E, #9C5321)', color: '#FFF', padding: '12px 24px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.3s ease' },
  gridView: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 14 },
  gridCard: { background: 'var(--pt-surface)', borderRadius: 20, border: '1px solid var(--pt-line)', padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' },
  cardGlowLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(213, 141, 75, 0.45), transparent)' },
  gridAvatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  gridAvatar: { width: 64, height: 64, borderRadius: 18, background: 'var(--pt-surface-soft)', border: '2px solid var(--pt-copper)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gridAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  gridAvatarInitials: { color: 'var(--pt-copper-strong)', fontWeight: 700, fontSize: 20, letterSpacing: 2 },
  gridName: { color: 'var(--pt-ink)', fontSize: 16, fontWeight: 700, margin: 0, textAlign: 'center' },
  gridMatricule: { color: 'var(--pt-copper-strong)', fontSize: 12, fontWeight: 700, letterSpacing: 1 },
  gridInfoSection: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' },
  gridInfoRow: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pt-muted)', fontSize: 12 },
  gridProgress: { width: '100%', padding: 12, background: 'var(--pt-surface-soft)', borderRadius: 10 },
  gridProgressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  gridProgressLabel: { color: 'var(--pt-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  gridProgressValue: { fontSize: 14, fontWeight: 700, fontFamily: "'SF Mono', 'Fira Code', monospace" },
  progressTrack: { width: '100%', height: 4, background: 'var(--pt-line)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, width: 'var(--target-width)' },
  gridActions: { display: 'flex', gap: 6, width: '100%', justifyContent: 'center', paddingTop: 8, borderTop: '1px solid var(--pt-line)', flexWrap: 'wrap' },
  gridActionBtn: { border: 'none', borderRadius: 10, padding: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  listView: { display: 'flex', flexDirection: 'column', gap: 8 },
  listCard: { background: 'var(--pt-surface)', borderRadius: 16, border: '1px solid var(--pt-line)', padding: 'clamp(12px, 3vw, 18px)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  listCardLeft: { display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 300px', minWidth: 0 },
  listAvatar: { width: 48, height: 48, borderRadius: 14, background: 'var(--pt-surface-soft)', border: '2px solid var(--pt-copper)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' },
  listAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  listAvatarInitials: { color: 'var(--pt-copper-strong)', fontWeight: 700, fontSize: 15, letterSpacing: 1 },
  avatarStatusRing: { position: 'absolute', inset: -3, borderRadius: 16, border: '2px solid', pointerEvents: 'none' },
  listInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  listNameRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  listName: { color: 'var(--pt-ink)', fontWeight: 700, fontSize: 15 },
  listMatricule: { color: 'var(--pt-copper-strong)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, background: 'var(--pt-copper-soft)', padding: '2px 8px', borderRadius: 6 },
  listMetaRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  listMeta: { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--pt-muted)', fontSize: 12 },
  listProgressContainer: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, maxWidth: 200 },
  progressTrackSmall: { flex: 1, height: 3, background: 'var(--pt-line)', borderRadius: 2, overflow: 'hidden' },
  progressFillSmall: { height: '100%', borderRadius: 2, width: 'var(--target-width)' },
  listProgressLabel: { fontSize: 11, fontWeight: 700, fontFamily: "'SF Mono', 'Fira Code', monospace", whiteSpace: 'nowrap' },
  listActions: { display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' },
  listActionBtn: { background: 'var(--pt-surface-soft)', border: '1px solid var(--pt-line)', borderRadius: 10, padding: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: 'var(--pt-ink-soft)' },
  listDeleteBtn: { borderColor: 'rgba(239, 68, 68, 0.25)', color: '#EF4444' },
  footer: { marginTop: 48, paddingBottom: 24 },
  footerLine: { height: 1, background: 'linear-gradient(90deg, transparent, rgba(213, 141, 75, 0.3), transparent)', marginBottom: 20 },
  footerText: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--pt-muted)', fontSize: 12, letterSpacing: 2 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 12, 9, 0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 },
  confirmModal: { background: 'var(--pt-surface)', border: '1px solid var(--pt-line)', borderRadius: 24, width: '100%', maxWidth: 420, padding: 'clamp(24px, 5vw, 36px)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 18, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' },
  modalTitle: { fontSize: 20, fontWeight: 700, color: 'var(--pt-ink)', marginBottom: 12 },
  modalText: { color: 'var(--pt-muted)', marginBottom: 28, lineHeight: 1.6, fontSize: 14 },
  modalBtns: { display: 'flex', gap: 12 },
  modalCancelBtn: { flex: 1, padding: 14, background: 'var(--pt-surface-soft)', border: '1px solid var(--pt-line)', color: 'var(--pt-ink)', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit' },
  modalDeleteBtn: { flex: 1, padding: 14, background: 'linear-gradient(135deg, #EF4444, #B91C1C)', color: '#FFF', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s ease', fontFamily: 'inherit' },
  formModal: { background: 'var(--pt-surface)', border: '1px solid var(--pt-line)', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' },
  formModalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--pt-line)', flexShrink: 0 },
  formModalTitleWrap: { display: 'flex', alignItems: 'center', gap: 14 },
  formModalIcon: { width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  formModalTitle: { color: 'var(--pt-ink)', fontSize: 18, fontWeight: 700, margin: 0 },
  formModalSub: { color: 'var(--pt-muted)', fontSize: 12, marginTop: 2, display: 'block' },
  formCloseBtn: { background: 'var(--pt-surface-soft)', border: '1px solid var(--pt-line)', borderRadius: 10, padding: 8, color: 'var(--pt-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  formModalBody: { padding: 24, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 },
  formModalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--pt-line)', flexShrink: 0 },
  modalSaveBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'linear-gradient(135deg, #C87B3E, #9C5321)', color: '#FFF', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit' },
  photoUploadSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 },
  photoUploadCircle: { width: 90, height: 90, borderRadius: 20, background: 'var(--pt-copper-soft)', border: '2px dashed var(--pt-copper)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' },
  photoUploadImg: { width: '100%', height: '100%', objectFit: 'cover' },
  photoUploadPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  photoUploadOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: 6, display: 'flex', justifyContent: 'center' },
  photoRemoveBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  formField: { display: 'flex', flexDirection: 'column', gap: 6 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formLabel: { fontSize: 12, fontWeight: 600, color: 'var(--pt-muted)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  formHint: { fontSize: 10, color: 'var(--pt-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 },
  formInput: { padding: '12px 14px', border: '1px solid var(--pt-line)', borderRadius: 12, fontSize: 14, outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', background: 'var(--pt-surface-soft)', color: 'var(--pt-ink)', fontFamily: 'inherit' },
  formSelect: { padding: '12px 14px', border: '1px solid var(--pt-line)', borderRadius: 12, fontSize: 14, outline: 'none', background: 'var(--pt-surface-soft)', color: 'var(--pt-ink)', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer' },
  pinFieldWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  pinEyeBtn: { position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pt-muted)', display: 'flex', alignItems: 'center' },
  scheduleChoiceWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  scheduleOption: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, border: '1px solid var(--pt-line)', cursor: 'pointer', transition: 'all 0.2s ease' },
  radioInput: { width: 18, height: 18, accentColor: '#F59E0B', marginTop: 2, flexShrink: 0 },
  scheduleOptionTitle: { display: 'block', fontWeight: 600, color: 'var(--pt-ink)', fontSize: 14 },
  scheduleOptionDesc: { display: 'block', fontSize: 12, color: 'var(--pt-muted)', marginTop: 2 },
  checkboxWrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'var(--pt-surface-soft)', cursor: 'pointer' },
  checkboxInput: { width: 18, height: 18, accentColor: '#F59E0B' },
  checkboxText: { color: 'var(--pt-ink)', fontSize: 14, fontWeight: 500 },
  daysRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  dayChip: { padding: '10px 14px', border: '1px solid var(--pt-line)', borderRadius: 10, background: 'var(--pt-surface-soft)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--pt-muted)', transition: 'all 0.2s ease' },
  dayChipActive: { background: 'linear-gradient(135deg, #C87B3E, #9C5321)', borderColor: '#C87B3E', color: '#FFF' },
}