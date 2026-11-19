import PayslipIndicatorStatus from '../components/PayslipIndicatorStatus'
import useEmployeePayslipIndicators from '../hooks/useEmployeePayslipIndicators'
// ═══════════════════════════════════════════════════════════
// 👥 PAGE GESTION DES EMPLOYÉS - V2 ENRICHIE
// Ajouts : Infos personnelles, professionnelles, sociales
// Sections repliables, date embauche, CNPS, catégorie...
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { accountRpc } from '../services/adminAccounts'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Footprints, Users, Plus, ArrowLeft, Search, Edit, Trash2, X, Save,
  Eye, EyeOff, Camera, Upload, QrCode, Clock, Share2, AlertTriangle,
  BarChart2, ChevronDown, ChevronUp, Zap, Activity, ArrowRight, UserPlus,
  Coffee, CalendarX,
  Briefcase, Hash, Mail, Phone, Building2, Shield,
  Key, Lock, UserCheck, UserX, Calendar, Heart, Globe, CreditCard,
  FileText, Award, User, MapPin, Flag, Baby, Layers, Radio, ClipboardList, Network,
  LayoutDashboard, CalendarDays, CalendarOff, Timer, Wallet, Sparkles, Settings,
  Cpu, TrendingUp, Megaphone, Router, ScanFace, ShieldCheck, Bell, LogOut,
  Moon, Sun,
} from 'lucide-react'
import toast from 'react-hot-toast'
import BadgeEmploye from '../components/BadgeEmploye'
import ModaleAccesPortail from '../components/employes/ModaleAccesPortail'
import ModaleHoraires from '../components/employes/ModaleHoraires'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import EmployesLoadingScreen from '../components/EmployesLoadingScreen'
import FicheEmployeModal from '../components/FicheEmployeModal'
import LigneAnnuaire from '../components/equipes/LigneAnnuaire'
import { useTheme } from '../contexts/ThemeContext'
import { KenteWovenTapestrySvg } from '../components/AfroCulturalSvg'
import EnterpriseSwitcher from '../components/EnterpriseSwitcher'
import EquipesVue from '../components/equipes/EquipesVue'
import TachesVue from '../components/taches/TachesVue'
import '../components/zoulou/zoulou.css'
import '../pages/Dashboard.css'
import './EmployesRefonte.css'
import './EquipesTaches.css'
import './EmployesV3.css'
import { construirePauses, estPauseReelleEffectuee } from '../services/pausesService'
import { formaterHeureLocale, jourLocal, minutesDepuisMinuit } from '../utils/timezoneUtils'

// Les filtres de la refonte : l'état de la journée d'abord —
// devant la liste, c'est la présence qui compte — puis le compte
// portail. Chacun correspond à un état réellement mesuré.
// Dix minutes de tolérance avant de parler de retard : une arrivée à
// 08:05 pour un poste qui commence à 08:00 n'est pas un retard.
const RETARD_TOLERANCE_MINUTES = 10

const FILTRES_ANNUAIRE = [
  { key: 'all', label: 'Tous' },
  { key: 'live_en_poste', label: 'En poste', classe: 'empv2-filtre--poste' },
  { key: 'live_en_pause', label: 'En pause', classe: 'empv2-filtre--pause' },
  { key: 'live_retard', label: 'Retard', classe: 'empv2-filtre--retard' },
  { key: 'live_absent', label: 'Absent', classe: 'empv2-filtre--absent' },
  { key: 'sans_compte', label: 'Sans compte', classe: 'empv2-filtre--migrer' },
]

// Une part réelle, ou un tiret quand il n'y a rien à diviser.
// Les quatre morceaux d'une fiche complète — l'anatomie de la page.
function morceauxDeFiche(employee, aCompte) {
  return [
    { mot: 'Poste', ok: Boolean(employee.position) },
    { mot: 'Service', ok: Boolean(employee.department) },
    { mot: 'Contrat', ok: Boolean(employee.contract_type) },
    { mot: 'Portail', ok: Boolean(aCompte) },
  ]
}

function nomCompletDe(employee) {
  return [employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'Sans nom'
}

const pourcent = (morceau, total) =>
  (total > 0 ? `${Math.round((morceau / total) * 100)} %` : '—')

// ═══════════════════════════════════════════════════════════
// COMPOSANT SECTION REPLIABLE
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════

export default function Employes() {
  const [admin, setAdmin] = useState(null)
  const [employes, setEmployes] = useState([])
  // La moyenne des présents sur 30 jours : elle seule permet un écart honnête.
  // Pas de donnée → pas d'écart affiché (jamais un chiffre inventé).
  const [moyennePresents30j, setMoyennePresents30j] = useState(null)
  // La semaine et le fil d'annonces : deux lectures silencieuses, aucune
  // donnée inventée si le serveur ne répond pas.
  const [semainePointages, setSemainePointages] = useState(null)
  const [semaineAbsences, setSemaineAbsences] = useState([])
  const [annoncesAccueil, setAnnoncesAccueil] = useState(null)

  // La moyenne des présents sur les 30 derniers jours, jour par jour.
  // Une seule requête, silencieuse en cas d'échec : on n'affiche rien.
  useEffect(() => {
    let annule = false
    const mesurer = async () => {
      try {
        const ids = employes.map((e) => e.id)
        if (!ids.length) { if (!annule) setMoyennePresents30j(null); return }
        const fin = new Date()
        const debut = new Date(fin.getTime() - 30 * 24 * 3600 * 1000)
        const { data, error } = await supabase
          .from('attendances')
          .select('employee_id, check_time, check_type')
          .in('employee_id', ids)
          .gte('check_time', debut.toISOString())
          .lt('check_time', fin.toISOString())
        if (error) throw error
        const jours = new Map()
        ;(data || []).forEach((pointage) => {
          if (String(pointage.check_type || '').toLowerCase() !== 'in') return
          const jour = String(pointage.check_time || '').slice(0, 10)
          if (!jours.has(jour)) jours.set(jour, new Set())
          jours.get(jour).add(pointage.employee_id)
        })
        const valeurs = [...jours.values()].map((ensemble) => ensemble.size)
        if (!valeurs.length) { if (!annule) setMoyennePresents30j(null); return }
        const moyenne = valeurs.reduce((somme, v) => somme + v, 0) / valeurs.length
        if (!annule) setMoyennePresents30j(moyenne)
      } catch {
        if (!annule) setMoyennePresents30j(null)
      }
    }
    mesurer()
    return () => { annule = true }
  }, [employes])

  // La semaine en cours : pointages et absences, pour la grille du milieu.
  useEffect(() => {
    let annule = false
    const lire = async () => {
      try {
        const ids = employes.map((e) => e.id)
        if (!ids.length) { if (!annule) { setSemainePointages(null); setSemaineAbsences([]) } return }

        const maintenant = new Date()
        const lundi = new Date(maintenant)
        const decalage = (maintenant.getDay() + 6) % 7
        lundi.setDate(maintenant.getDate() - decalage)
        lundi.setHours(0, 0, 0, 0)
        const dimanche = new Date(lundi)
        dimanche.setDate(lundi.getDate() + 6)
        dimanche.setHours(23, 59, 59 , 999)

        const [pointagesRes, absencesRes] = await Promise.all([
          supabase
            .from('attendances')
            .select('employee_id, check_time, check_type')
            .in('employee_id', ids)
            .gte('check_time', lundi.toISOString())
            .lte('check_time', dimanche.toISOString()),
          supabase
            .from('absences')
            .select('id, employee_id, start_date, end_date, reason')
            .in('employee_id', ids)
            .lte('start_date', dimanche.toISOString().slice(0, 10))
            .gte('end_date', lundi.toISOString().slice(0, 10)),
        ])

        const carte = new Map()
        ;(pointagesRes.data || []).forEach((pointage) => {
          if (String(pointage.check_type || '').toLowerCase() !== 'in') return
          const jour = jourLocal(pointage.check_time) || String(pointage.check_time || '').slice(0, 10)
          if (!carte.has(pointage.employee_id)) carte.set(pointage.employee_id, new Set())
          carte.get(pointage.employee_id).add(jour)
        })
        if (!annule) {
          setSemainePointages(carte)
          setSemaineAbsences(absencesRes.data || [])
        }
      } catch {
        if (!annule) { setSemainePointages(null); setSemaineAbsences([]) }
      }
    }
    lire()
    return () => { annule = true }
  }, [employes])

  // Le fil des annonces d'accueil — la même fonction que la page dédiée.
  useEffect(() => {
    let annule = false
    const lire = async () => {
      try {
        const entreprise = admin?.enterprise_id
        if (!entreprise) { if (!annule) setAnnoncesAccueil(null); return }
        const data = await accountRpc('encheck_annonce_accueil_lister', { p_enterprise_id: entreprise })
        if (!annule) setAnnoncesAccueil(data?.ok === true ? (data.annonces || []) : null)
      } catch {
        if (!annule) setAnnoncesAccueil(null)
      }
    }
    lire()
    return () => { annule = true }
  }, [admin?.enterprise_id])

  const payslipIndicators = useEmployeePayslipIndicators(employes)
  const [entreprises, setEntreprises] = useState([])
  const [plannings, setPlannings] = useState([])
  // Le bouton du titre déclenche la création dans la vue affichée.
  const [signalCreationEquipe, setSignalCreationEquipe] = useState(0)
  const [signalCreationTache, setSignalCreationTache] = useState(0)
  const [loading, setLoading] = useState(true)
  const [minLoadingDone, setMinLoadingDone] = useState(true)
  const [liveStatusByEmployee, setLiveStatusByEmployee] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedEnterpriseFilter, setSelectedEnterpriseFilter] = useState('all')
  const { darkMode, toggleTheme } = useTheme()


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

  const [moduleTaches, setModuleTaches] = useState(false)
  const [modulePlanning, setModulePlanning] = useState(false)
  const [moduleQRCode, setModuleQRCode] = useState(false)

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState(null)
  // l'employé dont on prépare l'envoi des horaires
  const [horairesEmploye, setHorairesEmploye] = useState(null)

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
    setShowPasswordModal(true)
  }

  const enregistrerMotDePasse = async (employe, motDePasse) => {
    if (!motDePasse || motDePasse.length < 6) {
      return { ok: false, message: 'Le mot de passe doit contenir au moins 6 caractères.' }
    }
    if (!employe) return { ok: false, message: 'Aucun employé sélectionné.' }
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
          p_password: motDePasse,
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
          p_password: motDePasse,
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
      return { ok: true }
    } catch (err) {
      console.error('Erreur accès portail:', err)
      return { ok: false, message: err?.message || 'La base a refusé l’enregistrement. Réessayez.' }
    }
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
      return { ok: true }
    } catch (err) {
      console.error('Erreur:', err)
      toast.error('L’accès portail n’a pas pu être modifié')
      return { ok: false }
    }
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
        setModuleTaches(true)
      } else if (targetEnterpriseId) {
        const { data: entrepriseData } = await supabase.from('enterprises').select('*').eq('id', targetEnterpriseId).single()
        setEntreprises(entrepriseData ? [entrepriseData] : [])
        if (entrepriseData) {
          modulePlanningActif = entrepriseData.module_planning || false
          moduleQRCodeActif = entrepriseData.module_qr_scanner || false
          setModuleTaches(Boolean(entrepriseData.module_taches))
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

        // Le départ prévu, au fuseau de l'entreprise. Sans horaire connu,
        // il n'y a pas de retard à mesurer — on n'invente pas un référent.
        const departHHMM = sched?.use_custom_hours ? sched.custom_start_time
          : (sched?.schedule_id ? sched.work_schedules?.start_time : null)
        const departMinutes = departHHMM && /^\d{2}:\d{2}/.test(departHHMM)
          ? Number(departHHMM.slice(0, 2)) * 60 + Number(departHHMM.slice(3, 5))
          : null
        let retardMinutes = null
        if (departMinutes !== null) {
          const maintenant = minutesDepuisMinuit(new Date().toISOString())
          if (firstIn) {
            const arrivee = minutesDepuisMinuit(firstIn.check_time)
            if (arrivee !== null && arrivee - departMinutes >= RETARD_TOLERANCE_MINUTES) {
              retardMinutes = arrivee - departMinutes
            }
          } else if (maintenant - departMinutes >= RETARD_TOLERANCE_MINUTES) {
            // pas encore pointé, et le poste a démarré : on compte les minutes
            retardMinutes = maintenant - departMinutes
          }
        }
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
          retardMinutes,
        }
      }

      setLiveStatusByEmployee(nextMap)
    } catch (err) {
      console.error('Erreur statut live employés:', err)
    }
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

  const isModulePlanningEnabled = (employee) => {
    if (admin?.role === 'super_admin') return true
    return employee.enterprises?.module_planning || false
  }

  // Le clic ouvre une fenêtre : le message est montré avant d'être
  // envoyé, et le navigateur ne peut plus « ne rien faire » en silence.
  const handleShareSchedule = (employee) => {
    setHorairesEmploye(employee)
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

  // ═══════════════════════════════════════════════════════════
  // FILTRAGE
  // ═══════════════════════════════════════════════════════════

  const employesFiltres = employes.filter(emp => {
    if (selectedEnterpriseFilter !== 'all' && emp.enterprise_id !== selectedEnterpriseFilter) {
      return false
    }
    if (categoryFilter !== 'all') {
      const statut = liveStatusByEmployee[emp.id]
      if (categoryFilter === 'live_en_poste' && statut?.state !== 'en_poste') return false
      if (categoryFilter === 'live_en_pause' && statut?.state !== 'en_pause') return false
      if (categoryFilter === 'live_retard' && (statut?.retardMinutes ?? null) === null) return false
      if (categoryFilter === 'live_absent' && statut?.state !== 'en_conge') return false
      if (categoryFilter === 'sans_compte' && aUnCompteEmploye(emp)) return false
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


  // ═══════════════════════════════════════════════════════════
  // LES CHIFFRES DU REGISTRE — annuaire
  // Tout est compté sur le personnel chargé : jamais une estimation.
  // ═══════════════════════════════════════════════════════════
  const suiviPresence = Object.keys(liveStatusByEmployee || {}).length > 0
  const liveCounts = employes.reduce((compte, employe) => {
    const statut = liveStatusByEmployee?.[employe.id]
    const etat = statut?.state
    if (etat === 'en_poste') compte.enPoste += 1
    else if (etat === 'en_pause') compte.enPause += 1
    else if (etat === 'termine') compte.termine += 1
    else if (etat === 'en_conge') compte.enConge += 1
    else compte.nonPointe += 1
    if (statut?.retardMinutes != null) compte.retards += 1
    return compte
  }, { enPoste: 0, enPause: 0, termine: 0, enConge: 0, nonPointe: 0, retards: 0 })
  const enrollmentCounts = employes.reduce((compte, employe) => {
    if (aUnCompteEmploye(employe) && employe.employee_portal_enabled) compte.portal += 1
    if (estAncienSysteme(employe)) compte.toMigrate += 1
    return compte
  }, { portal: 0, toMigrate: 0 })

  // L'annuaire se lit par pages de 25 lignes (kit v1.3).
  const TAILLE_PAGE_ANNUAIRE = 25
  const [pageAnnuaire, setPageAnnuaire] = useState(1)
  useEffect(() => { setPageAnnuaire(1) }, [searchTerm, categoryFilter, selectedEnterpriseFilter])
  const nbPagesAnnuaire = Math.max(1, Math.ceil(employesFiltres.length / TAILLE_PAGE_ANNUAIRE))
  const pageAnnuaireCourante = Math.min(pageAnnuaire, nbPagesAnnuaire)
  const employesPageAnnuaire = employesFiltres.slice(
    (pageAnnuaireCourante - 1) * TAILLE_PAGE_ANNUAIRE,
    pageAnnuaireCourante * TAILLE_PAGE_ANNUAIRE
  )
  const plageAnnuaire = employesFiltres.length === 0
    ? '0'
    : `${(pageAnnuaireCourante - 1) * TAILLE_PAGE_ANNUAIRE + 1}\u2013${Math.min(pageAnnuaireCourante * TAILLE_PAGE_ANNUAIRE, employesFiltres.length)}`

  if (loading || !minLoadingDone) {
    return <EmployesLoadingScreen darkMode={darkMode} onSkip={() => setMinLoadingDone(true)} />
  }

  // ═══════════════════════════════════════════════════════════
  // LA PAGE A TROIS VUES : ANNUAIRE · ÉQUIPES · TÂCHES
  //
  // L'annuaire reste la vue d'entrée. Les deux autres vues
  // remplacent les anciennes pages /equipes et /taches, qui
  // renvoient maintenant ici (App.jsx). L'adresse porte la vue
  // (`?vue=equipes`), donc un lien reste partageable et le
  // bouton « retour » du navigateur fonctionne.
  //
  // Si l'option « Équipes et tâches » est éteinte sur la fiche
  // de l'entreprise, ces deux vues ne sont pas proposées : on
  // ne montre pas une porte qui ne mène nulle part.
  // ═══════════════════════════════════════════════════════════
  const vueDemandee = searchParams.get('vue')
  const vueAutorisee = moduleTaches || admin?.role === 'super_admin'
  // L'annuaire n'est plus un onglet : c'est la page elle-même.
  // vueActive = 'equipes' | 'taches' | null (null = la liste).
  const vueActive = vueAutorisee && (vueDemandee === 'equipes' || vueDemandee === 'taches')
    ? vueDemandee
    : null
  const entrepriseDesVues = selectedEnterpriseFilter !== 'all'
    ? selectedEnterpriseFilter
    : (admin?.selectedEnterprise?.id || admin?.enterprise_id || null)

  const changerVue = (cle) => {
    // Re-cliquer l'onglet actif rabat sur la liste.
    setSearchParams(cle === vueActive ? {} : { vue: cle }, { replace: true })
  }

  // ═══════════════════════════════════════════════════════════
  // LA SIDEBAR — la même navigation que le tableau de bord :
  // mêmes entrées, mêmes rubriques, mêmes garde-fous par module,
  // et la même personnalisation (renommage, couleurs, ordre)
  // conservée par administrateur.
  // ═══════════════════════════════════════════════════════════
  const entrepriseActive = (() => {
    if (selectedEnterpriseFilter !== 'all') {
      return entreprises.find((e) => e.id === selectedEnterpriseFilter) || null
    }
    const idCible = admin?.selectedEnterprise?.id || admin?.enterprise_id
    return entreprises.find((e) => e.id === idCible) || entreprises[0] || null
  })()

  const moduleActif = (champ) =>
    admin?.role === 'super_admin' || Boolean(entrepriseActive?.[champ])

  const sectionsNav = [
    {
      id: 'accueil',
      label: 'Accueil',
      icon: LayoutDashboard,
      items: [
        { label: 'Vue d’ensemble', icon: LayoutDashboard, path: '/dashboard', show: true },
      ],
    },
    {
      id: 'equipe',
      label: 'Équipe',
      icon: Users,
      items: [
        { label: 'Employés', icon: Users, path: '/employes', show: true },
        { label: 'Planning', icon: Calendar, path: '/planning', show: moduleActif('module_planning') },
        { label: 'Absences', icon: CalendarOff, path: '/absences', show: moduleActif('module_conges') },
        { label: 'Annonces d’accueil', icon: Megaphone, path: '/annonces-accueil', show: admin?.role === 'super_admin' },
      ],
    },
    {
      id: 'temps',
      label: 'Temps de travail',
      icon: Clock,
      items: [
        { label: 'Pointages', icon: Clock, path: '/pointages', show: true },
        { label: 'Retards', icon: Timer, path: '/retards', show: moduleActif('module_retards') },
        { label: 'Pauses', icon: Coffee, path: '/pauses', show: true },
        { label: 'Jours fériés', icon: CalendarDays, path: '/jours-feries', show: true },
      ],
    },
    {
      id: 'paie',
      label: 'Paie',
      icon: Wallet,
      items: [
        { label: 'Heures supplémentaires', icon: Timer, path: '/heures-supplementaires', show: moduleActif('module_heures_supplementaires') },
        { label: 'Rémunérations', icon: Wallet, path: '/remunerations', show: moduleActif('module_remunerations') },
        { label: 'Paie & fiscalité', icon: Shield, path: '/paie', show: moduleActif('module_fiches_paie') || moduleActif('module_config_fiscale') },
      ],
    },
    {
      id: 'rapports',
      label: 'Rapports',
      icon: FileText,
      items: [
        { label: 'Rapports', icon: FileText, path: '/rapports', show: true },
        { label: 'Prédictions', icon: Sparkles, path: '/predictions', show: moduleActif('module_predictions') },
      ],
    },
    {
      id: 'reglages',
      label: 'Réglages',
      icon: Settings,
      items: [
        { label: 'Configuration pointeuse', icon: Router, path: '/configuration-pointeuse', show: moduleActif('module_pointeuses') || moduleActif('module_poste_pointage') },
        { label: 'Géopointage', icon: MapPin, path: '/geopointage', show: moduleActif('module_carte_temps_reel') || moduleActif('module_geolocalisation') },
        { label: 'Reconnaissance faciale', icon: ScanFace, path: '/reconnaissance-faciale', show: moduleActif('module_reconnaissance_faciale') },
      ],
    },
    // L'intérieur de la maison ne s'ouvre qu'au super admin.
    ...(admin?.role === 'super_admin' ? [{
      id: 'interne',
      label: 'En-Check interne',
      icon: Cpu,
      items: [
        { label: 'Entreprises', icon: Building2, path: '/entreprises', show: true },
        { label: 'Administrateurs', icon: ShieldCheck, path: '/admins', show: true },
        { label: 'Messages système', icon: Bell, path: '/system-messages', show: true },
        { label: 'Prospection', icon: TrendingUp, path: '/prospection', show: true },
        { label: 'Analytics du site', icon: TrendingUp, path: '/analytics', show: true },
      ],
    }] : []),
  ]

  // La rubrique de cette page : Équipe. Le rail la marque, la barre du haut
  // porte ses pages — c'est le modèle de la maquette du 08/11.
  const SECTION_ACTIVE = 'equipe'
  const SECTION_ACTIVE_LABEL = 'Équipe'
  const pagesDeLaRubrique = (sectionsNav.find((section) => section.id === SECTION_ACTIVE)?.items || [])
    .filter((item) => item.show && item.path)

  const surNavigation = (item) => { if (item?.path) navigate(item.path) }
  const deconnexion = () => {
    localStorage.removeItem('admin')
    localStorage.removeItem('last_enterprise_id')
    navigate('/login')
  }

  const nomAdmin = admin?.name || admin?.email || 'Administrateur'

  // ── les chiffres de la page : tout est compté, rien n'est estimé ──
  const prenomAdmin = nomAdmin.includes('@') ? nomAdmin.split('@')[0] : nomAdmin.split(' ')[0]
  const jourEnClair = (() => {
    const texte = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
    return texte.charAt(0).toUpperCase() + texte.slice(1)
  })()

  const enPoste = suiviPresence ? liveCounts.enPoste : 0
  const enPause = suiviPresence ? liveCounts.enPause : 0

  const presentsDuJour = enPoste + enPause
  // L'écart n'existe que si la moyenne existe : sinon, rien.
  const ecartPresents = (suiviPresence && moyennePresents30j && moyennePresents30j > 0)
    ? Math.round(((presentsDuJour - moyennePresents30j) / moyennePresents30j) * 100)
    : null

  const actifsPortail = employes.filter((e) => aUnCompteEmploye(e)).length

  // Les contrats, comptés par libellé.
  const contratsParType = (() => {
    const compte = new Map()
    employes.forEach((e) => {
      const mot = e.contract_type ? getContractLabel(e.contract_type) : 'Sans contrat renseigné'
      compte.set(mot, (compte.get(mot) || 0) + 1)
    })
    return [...compte.entries()]
      .map(([mot, nombre]) => ({ mot, nombre }))
      .sort((a, b) => b.nombre - a.nombre)
      .slice(0, 5)
  })()
  const maxContrat = contratsParType.reduce((m, c) => Math.max(m, c.nombre), 0)

  // Les fiches incomplètes : on montre d'abord les plus trouées.
  const fichesIncompletes = employes
    .map((e) => {
      const morceaux = morceauxDeFiche(e, aUnCompteEmploye(e))
      return { employee: e, morceaux, remplis: morceaux.filter((m) => m.ok).length }
    })
    .filter((f) => f.remplis < 4)
    .sort((a, b) => a.remplis - b.remplis)
    .slice(0, 5)

  // La semaine en cours, découpée en sept jours.
  const semaineAffichee = (() => {
    const maintenant = new Date()
    const lundi = new Date(maintenant)
    lundi.setDate(maintenant.getDate() - ((maintenant.getDay() + 6) % 7))
    lundi.setHours(0, 0, 0, 0)
    const noms = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
    return Array.from({ length: 7 }, (_, i) => {
      const jour = new Date(lundi)
      jour.setDate(lundi.getDate() + i)
      return {
        iso: jour.toISOString().slice(0, 10),
        nom: noms[i],
        num: jour.getDate(),
        futur: jour.getTime() > maintenant.getTime(),
        aujourdhui: jour.toDateString() === maintenant.toDateString(),
      }
    })
  })()

  // Une ligne = une personne, sept cases. Trois états, jamais devinés :
  // absence connue, pointage connu, ou rien.
  const lignesPlanning = employes.slice(0, 6).map((employee) => ({
    employee,
    jours: semaineAffichee.map((jour) => {
      const absence = semaineAbsences.find(
        (a) => a.employee_id === employee.id
          && String(a.start_date || '').slice(0, 10) <= jour.iso
          && String(a.end_date || '').slice(0, 10) >= jour.iso,
      )
      if (absence) return { etat: 'conge', mot: absence.reason || 'Congé' }
      if (semainePointages?.get(employee.id)?.has(jour.iso)) return { etat: 'pointe', mot: 'Pointé' }
      return { etat: 'rien', mot: jour.futur ? 'À venir' : 'Rien ce jour' }
    }),
  }))

  const annoncesEnLigne = (annoncesAccueil || [])
    .filter((annonce) => annonce.statut === 'en_ligne')
    .slice(0, 3)

  // L'export : ce que l'écran montre, à l'identique.
  const exporterCsv = () => {
    const entetes = ['Matricule', 'Nom', 'E-mail', 'Poste', 'Service', 'Contrat', 'Portail']
    const lignes = employesFiltres.map((e) => [
      e.matricule || '',
      nomCompletDe(e),
      e.email || '',
      e.position || '',
      e.department || '',
      e.contract_type ? getContractLabel(e.contract_type) : '',
      aUnCompteEmploye(e) ? 'Actif' : 'À activer',
    ])
    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${String(cellule).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `employes-${new Date().toISOString().slice(0, 10)}.csv`
    lien.click()
    URL.revokeObjectURL(url)
    toast.success(`${employesFiltres.length} ligne${employesFiltres.length > 1 ? 's' : ''} exportée${employesFiltres.length > 1 ? 's' : ''}`)
  }

  // ═══════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════

  return (
    <>

      {/* Le bandeau de motif est retiré de cette page — demande du fondateur
          du 08/11 : « enlève le bandeau motif culturel de la page ». */}
      <div className="pointages-afrotech-shell empv2-coque">
        <div className="empv2-layout">
        {/* ═══ LA COQUE : rail d'icônes à gauche, pastilles en haut ═══ */}
        <aside className="nav3-rail" aria-label="Rubriques">
          <span className="nav3-rail-logo">
            <EnCheckBrandMark size={26} />
          </span>
          <span className="nav3-rail-sep" aria-hidden="true" />

          {sectionsNav.map((section) => {
            const SectionIcone = section.icon
            const active = section.id === SECTION_ACTIVE
            return (
              <button
                key={section.id}
                type="button"
                className={`nav3-rail-item${active ? ' is-actif' : ''}`}
                aria-current={active ? 'true' : undefined}
                title={section.label}
                aria-label={section.label}
                onClick={() => {
                  const premiere = section.items.find((i) => i.show && i.path)
                  if (premiere) navigate(premiere.path)
                }}
              >
                <SectionIcone size={18} aria-hidden="true" />
              </button>
            )
          })}

          <div className="nav3-rail-pied">
            <a
              className="nav3-rail-item"
              href="/employee/login"
              target="_blank"
              rel="noreferrer"
              title="Espace employé"
              aria-label="Espace employé"
            >
              <Users size={18} aria-hidden="true" />
            </a>
            <button
              type="button"
              className="nav3-rail-item"
              onClick={deconnexion}
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
            <span className="nav3-rail-compte" title={`${nomAdmin} — administrateur`}>
              {(nomAdmin || 'A').trim().charAt(0).toUpperCase()}
            </span>
          </div>
        </aside>

        <div className="nav3-colonne">
          {/* la barre du haut : les pages de la rubrique, en pastilles */}
          <header className="nav3-haut">
            <nav className="nav3-pastilles" aria-label={`Pages de la rubrique ${SECTION_ACTIVE_LABEL}`}>
              {pagesDeLaRubrique.map((item) => {
                const ItemIcone = item.icon
                const active = item.path === '/employes'
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`nav3-pastille${active ? ' is-actif' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => surNavigation(item)}
                  >
                    <ItemIcone size={13} aria-hidden="true" />
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div className="nav3-haut-droite">
              <EnterpriseSwitcher admin={admin} onSwitch={() => window.location.reload()} />
              <button
                type="button"
                className="nav3-rond"
                onClick={toggleTheme}
                title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
                aria-pressed={darkMode}
              >
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </header>


        {/* ═══ MAIN ═══ */}
        <main className="empv2-main">
          {/* la ligne de titre : Employés · le compte — l'action, à droite.
              Une seule action de poids maximal par écran (D-013). */}
          <div className="empv2-tete">
            <h1 className="empv2-titre">
              Employés
              {vueActive === null && (
                <span className="empv2-titre-compte">
                  {employes.length} employé{employes.length > 1 ? 's' : ''}
                </span>
              )}
              <span className="empv3-sous">
                {vueActive === null
                  ? `Bonjour, ${prenomAdmin} · ${jourEnClair}`
                  : 'La page Employés, vue par vue'}
              </span>
            </h1>
            <div className="empv2-tete-actions">
              {vueActive === null && (
                <span className="empv3-chip">
                  <CalendarDays size={12} aria-hidden="true" />
                  {jourEnClair}
                </span>
              )}
              {vueActive === null && (
                <button type="button" className="ch-btn-contour" onClick={exporterCsv}>
                  <FileText size={13} aria-hidden="true" /> Exporter
                </button>
              )}
              {vueActive === 'equipes' && (
                <button type="button" className="ch-btn-pleine" onClick={() => setSignalCreationEquipe((n) => n + 1)}>
                  <Plus size={13} aria-hidden="true" /> Nouvelle équipe
                </button>
              )}
              {vueActive === 'taches' && (
                <button type="button" className="ch-btn-pleine" onClick={() => setSignalCreationTache((n) => n + 1)}>
                  <Plus size={13} aria-hidden="true" /> Nouvelle tâche
                </button>
              )}
              {vueActive === null && (
                <button type="button" className="ch-btn-pleine" onClick={handleAdd}>
                  <UserPlus size={13} aria-hidden="true" /> Nouvel employé
                </button>
              )}

              <button
                type="button"
                className="empv2-theme"
                onClick={toggleTheme}
                title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
                aria-pressed={darkMode}
              >
                {darkMode ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
                <span>{darkMode ? 'Clair' : 'Sombre'}</span>
              </button>
            </div>
          </div>

          {/* Les deux vues optionnelles. L'annuaire n'est plus un
              onglet : c'est la page — re-cliquer l'onglet actif
              rabat sur la liste. */}
          <div className="empv2-tetes">
            {vueAutorisee && (
              <nav className="empv2-onglets" aria-label="Vues de la page Employés">
                {[
                  { cle: 'equipes', libelle: 'Équipes', icone: Network },
                  { cle: 'taches', libelle: 'Tâches', icone: ClipboardList },
                ].map(({ cle, libelle, icone: Icone }) => (
                  <button
                    key={cle}
                    type="button"
                    className="empv2-onglet"
                    aria-current={vueActive === cle ? 'page' : undefined}
                    onClick={() => changerVue(cle)}
                  >
                    <Icone size={13} aria-hidden="true" /> {libelle}
                  </button>
                ))}
              </nav>
            )}
          </div>

          {vueActive === null && (
            <div className="empv2-annuaire">
              {/* les chiffres du jour : trois tuiles, le chiffre porte sa période.
                  Tout est compté sur le personnel chargé, jamais une estimation. */}
              {/* les quatre cartes — l'anatomie de la maquette du 08/11 :
                  icône ronde teintée, libellé, gros chiffre, légende.
                  L'écart ne s'affiche que là où il est mesuré. */}
              <div className="empv3-cartes empv3-cartes--quatre">

                <div className="empv3-carte empv3-kpi">
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="argile">
                      <Users size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Effectif total</span>
                  </div>
                  <div className="empv3-kpi-chiffre">{employes.length}</div>
                  <div className="empv3-kpi-pied">au registre</div>
                </div>

                <div className="empv3-carte empv3-kpi">
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="succes">
                      <Briefcase size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Présents</span>
                  </div>
                  <div className="empv3-kpi-chiffre">{suiviPresence ? presentsDuJour : '—'}</div>
                  <div className="empv3-kpi-pied">
                    {ecartPresents === null ? (
                      'en poste ou en pause, aujourd’hui'
                    ) : (
                      <>
                        <span className={ecartPresents >= 0 ? 'empv3-ecart empv3-ecart--haut' : 'empv3-ecart empv3-ecart--bas'}>
                          {ecartPresents >= 0 ? '↗' : '↘'} {Math.abs(ecartPresents)} %
                        </span>
                        <span className="empv3-kpi-note">vs 30 jours</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="empv3-carte empv3-kpi">
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="texte">
                      <Key size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Accès au portail</span>
                  </div>
                  <div className="empv3-kpi-chiffre">{actifsPortail}</div>
                  <div className="empv3-kpi-pied">
                    comptes actifs sur {employes.length}
                    <span className="empv3-kpi-note"> · {Math.max(employes.length - actifsPortail, 0)} à activer</span>
                  </div>
                </div>

                <div className="empv3-carte empv3-kpi">
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="alerte">
                      <Clock size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Retards</span>
                  </div>
                  <div className="empv3-kpi-chiffre">{suiviPresence ? liveCounts.retards : '—'}</div>
                  <div className="empv3-kpi-pied">ce jour — le mot est écrit</div>
                </div>
              </div>

              {/* les deux blocs du milieu — planning de la semaine, annonces */}
              <div className="empv3-grille-planning">

                <div className="empv3-carte">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Planning de la semaine</span>
                    <span className="empv3-carte-total">
                      {semainePointages === null ? '—' : `${employes.slice(0, 6).length} personne${employes.length > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  <div className="empv3-semaine">
                    <div className="empv3-semaine-tete">
                      <span className="empv3-semaine-nom" />
                      {semaineAffichee.map((jour) => (
                        <span
                          key={jour.iso}
                          className={`empv3-jour${jour.aujourdhui ? ' is-aujourdhui' : ''}`}
                        >
                          {jour.nom}
                          <b>{jour.num}</b>
                        </span>
                      ))}
                    </div>

                    {lignesPlanning.map(({ employee, jours }) => (
                      <div className="empv3-semaine-ligne" key={employee.id}>
                        <span className="empv3-semaine-nom">
                          <span className="empv3-avatar" aria-hidden="true">
                            {(employee.first_name || '?')[0]}{(employee.last_name || '')[0] || ''}
                          </span>
                          <span className="empv3-semaine-qui">{nomCompletDe(employee)}</span>
                        </span>
                        {jours.map((jour, index) => (
                          <span
                            key={`${employee.id}-${index}`}
                            className={`empv3-case empv3-case--${jour.etat}`}
                            title={`${semaineAffichee[index].nom} ${semaineAffichee[index].num} — ${jour.mot}`}
                            aria-label={`${semaineAffichee[index].nom} ${semaineAffichee[index].num} — ${jour.mot}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="empv3-legende">
                    <span><i style={{ background: 'var(--charte-aplat)' }} />Pointé</span>
                    <span><i style={{ background: 'var(--charte-alerte)' }} />Absence</span>
                    <span><i style={{ background: 'var(--charte-surface2)' }} />Rien</span>
                  </div>
                </div>

                <div className="empv3-carte">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Annonces d’accueil</span>
                    <span className="empv3-carte-total">{annoncesEnLigne.length}</span>
                  </div>

                  {annoncesAccueil === null ? (
                    <p className="empv3-legende">Les annonces n’ont pas pu être lues.</p>
                  ) : annoncesEnLigne.length === 0 ? (
                    <p className="empv3-legende">Aucune annonce en ligne pour l’instant.</p>
                  ) : (
                    <div className="empv3-annonces">
                      {annoncesEnLigne.map((annonce, index) => (
                        <article key={annonce.id} className={`empv3-annonce empv3-annonce--${index % 3}`}>
                          <strong>
                            {annonce.type_media === 'video' ? 'Vidéo d’accueil' : 'Image d’accueil'}
                          </strong>
                          <p>
                            Diffusée sur l’écran d’accueil
                            {annonce.duree_affichage_ms
                              ? ` · ${Math.round(Number(annonce.duree_affichage_ms) / 1000)} s`
                              : ''}
                          </p>
                          <div className="empv3-annonce-chips">
                            <span>
                              {annonce.debute_le
                                ? new Date(annonce.debute_le).toLocaleDateString('fr-FR')
                                : 'sans début'}
                            </span>
                            <span>
                              {annonce.termine_le
                                ? new Date(annonce.termine_le).toLocaleDateString('fr-FR')
                                : 'sans fin'}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* les deux grands blocs */}
              <div className="empv3-deux">

                <div className="empv3-carte">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Fiches à compléter</span>
                    <span className="empv3-carte-total">{fichesIncompletes.length}</span>
                  </div>
                  {fichesIncompletes.length === 0 ? (
                    <p className="empv3-legende">Toutes les fiches sont complètes : poste, service, contrat et accès au portail.</p>
                  ) : (
                    <div className="empv3-perf-lignes">
                      {fichesIncompletes.map(({ employee, morceaux, remplis }) => (
                        <div className="empv3-perf-ligne" key={employee.id}>
                          <span className="empv3-perf-nom">{nomCompletDe(employee)}</span>
                          <span className="empv3-perf-bar">
                            {morceaux.map((m) => (
                              <i
                                key={m.mot}
                                title={`${m.mot} : ${m.ok ? 'renseigné' : 'manquant'}`}
                                style={{ width: '25%', background: m.ok ? 'var(--charte-aplat)' : 'var(--charte-surface2)' }}
                              />
                            ))}
                          </span>
                          <span className="empv3-perf-total">{remplis}/4</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="empv3-carte">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Contrats par type</span>
                  </div>
                  {contratsParType.length === 0 ? (
                    <p className="empv3-legende">Aucun contrat renseigné pour l’instant.</p>
                  ) : (
                    <div className="empv3-perf-lignes">
                      {contratsParType.map(({ mot, nombre }) => (
                        <div className="empv3-barre-ligne" key={mot}>
                          <span>{mot}</span>
                          <span className="empv3-barre-piste">
                            <i style={{ width: `${maxContrat > 0 ? (nombre / maxContrat) * 100 : 0}%` }} />
                          </span>
                          <span className="empv3-barre-val">{nombre}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* la barre d'outils de « Tous les employés » :
                  la recherche, puis l'état de la journée */}
              <div className="empv2-filtres" role="group" aria-label="Filtrer la liste">
                <span className="empv3-bloc-titre">Tous les employés</span>

                <label className="empv3-saisie">
                  <Search size={12} aria-hidden="true" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher un nom, un matricule…"
                    aria-label="Rechercher un employé"
                  />
                </label>

                {FILTRES_ANNUAIRE.map((filtre) => (
                  <button
                    key={filtre.key}
                    type="button"
                    className={`empv2-filtre ${filtre.classe || ''}`}
                    aria-pressed={categoryFilter === filtre.key}
                    onClick={() => setCategoryFilter(filtre.key)}
                  >
                    {filtre.classe && <i className="ch-badge-point" aria-hidden="true" />}
                    {filtre.label}
                  </button>
                ))}
                {(searchTerm || categoryFilter !== 'all') && (
                  <button
                    type="button"
                    className="empv2-filtre"
                    onClick={() => { setSearchTerm(''); setCategoryFilter('all') }}
                  >
                    Tout montrer
                  </button>
                )}
              </div>

              {enrollmentCounts.toMigrate > 0 && (
                <div className="ch-message-fiche" role="status">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>
                    {enrollmentCounts.toMigrate} employé{enrollmentCounts.toMigrate > 1 ? 's' : ''} encore sur
                    l'ancien portail — ouvrez <strong>Mot de passe</strong> dans leur menu pour activer
                    leur nouvel accès.
                  </span>
                </div>
              )}

              <PayslipIndicatorStatus status={payslipIndicators} />

              {employesFiltres.length === 0 ? (
                <div className="empv2-vide">
                  <h3>{employes.length === 0 ? 'Aucun employé pour l’instant' : 'Aucune personne ne correspond'}</h3>
                  <p>
                    {employes.length === 0
                      ? 'Créez la première fiche : le nom, le matricule et le poste suffisent pour commencer.'
                      : 'Élargissez la recherche ou retirez un filtre pour revoir tout le personnel.'}
                  </p>
                  {employes.length === 0 ? (
                    <button type="button" className="ch-btn-pleine" onClick={handleAdd}>
                      <UserPlus size={13} aria-hidden="true" /> Nouvel employé
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ch-btn-contour"
                      onClick={() => { setSearchTerm(''); setCategoryFilter('all') }}
                    >
                      Tout montrer
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* l'annuaire : tableau filets, lignes 34 px, pas de
                      zébrures, une action par ligne, 25 lignes par page */}
                  <div className="empv2-tableau" aria-label="Le personnel">
                    <table className="ch-tableau ch-tableau-filets">
                      <thead>
                        <tr>
                          <th scope="col">Employé</th>
                          <th scope="col">Poste · service</th>
                          <th scope="col">Statut du jour</th>
                          <th scope="col"><span className="visually-hidden">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {employesPageAnnuaire.map((employee) => (
                          <LigneAnnuaire
                            key={employee.id}
                            employee={employee}
                            liveStatus={liveStatusByEmployee[employee.id]}
                            contractLabel={employee.contract_type ? getContractLabel(employee.contract_type) : ''}
                            portalEnabled={isPortalModuleEnabled(employee) && employee.employee_portal_enabled}
                            planningEnabled={isModulePlanningEnabled(employee)}
                            aCompte={aUnCompteEmploye(employee)}
                            ancienSysteme={estAncienSysteme(employee)}
                            onOuvrirFiche={handleEdit}
                            onOuvrirPage={(emp) => navigate(`/employes/${emp.id}`)}
                            onBadge={handleShowBadge}
                            onHoraires={handleOpenSchedule}
                            onPartagerHoraires={handleShareSchedule}
                            onPointages={(emp) => navigate(`/pointages?q=${encodeURIComponent(emp.matricule || emp.last_name || '')}`)}
                            onMotDePasse={handleOpenPasswordModal}
                            onBasulerPortail={handleTogglePortalAccess}
                            onSupprimer={initiateDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                    {nbPagesAnnuaire > 1 && (
                      <div className="empv2-pagination">
                        <span className="ch-mono">{plageAnnuaire} sur {employesFiltres.length} — 25 par page</span>
                        <span className="empv2-pagination-boutons">
                          <button
                            type="button"
                            className="empv2-pagbtn"
                            disabled={pageAnnuaireCourante <= 1}
                            onClick={() => setPageAnnuaire(pageAnnuaireCourante - 1)}
                          >
                            ← Précédent
                          </button>
                          <button
                            type="button"
                            className="empv2-pagbtn"
                            disabled={pageAnnuaireCourante >= nbPagesAnnuaire}
                            onClick={() => setPageAnnuaire(pageAnnuaireCourante + 1)}
                          >
                            Suivant →
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {vueActive === 'equipes' && (
            <EquipesVue enterpriseId={entrepriseDesVues} employes={employes} signalCreation={signalCreationEquipe} />
          )}

          {vueActive === 'taches' && (
            <TachesVue enterpriseId={entrepriseDesVues} employes={employes} signalCreation={signalCreationTache} />
          )}

          <div className="empv2-pied">
            <EnCheckBrandMark size={16} />
            <span>EN-CHECK · On gère ! · Gestion du Personnel</span>
          </div>
        </main>
        </div>
        </div>
        {/* D-003 — une seule bande de motif par page : le bandeau du haut. */}

        {/* ═══════════ MODALS ═══════════ */}

        {/* ─── DELETE CONFIRM ─── */}
        {showDeleteModal && employeeToDelete && (
<div className="empv2-voile">
            <div className="empv2-modale empv2-modale--petite" role="dialog" aria-modal="true" aria-labelledby="titre-supp">
              <div className="empv2-modale-corps empv2-modale-corps--centre">
                <AlertTriangle size={26} aria-hidden="true" className="empv2-icone-erreur" />
                <h3 id="titre-supp" className="empv2-modale-titre">Confirmer la suppression</h3>
                <p>Voulez-vous vraiment supprimer <strong>{employeeToDelete.first_name} {employeeToDelete.last_name}</strong> ?<br />Cette action est irréversible.</p>
              </div>
              <div className="empv2-modale-pied">
                <button type="button" className="ch-btn-contour" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                <button type="button" className="ch-btn-inverse ch-btn-danger" onClick={confirmDelete}><Trash2 size={14} aria-hidden="true" /> Supprimer</button>
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
          <div className="empv2-voile">
            <div className="empv2-modale" role="dialog" aria-modal="true" aria-labelledby="titre-horaires">
              <div className="empv2-modale-tete">
                <h2 id="titre-horaires" className="empv2-modale-titre">Horaires de {selectedEmployeeForSchedule.first_name}</h2>
                <button type="button" className="empv2-modale-fermer" onClick={() => setShowScheduleModal(false)} aria-label="Fermer">
                  <X size={15} />
                </button>
              </div>

              <div className="empv2-modale-corps">
                <div className="empv2-choix" role="radiogroup" aria-label="Type d'horaires">
                  <label className="empv2-choix-option" aria-pressed={!scheduleFormData.use_custom_hours}>
                    <input
                      type="radio"
                      name="scheduleType"
                      checked={!scheduleFormData.use_custom_hours}
                      onChange={() => setScheduleFormData({ ...scheduleFormData, use_custom_hours: false })}
                    />
                    <span><strong>Planning existant</strong><span>Utiliser un planning prédéfini</span></span>
                  </label>
                  <label className="empv2-choix-option" aria-pressed={scheduleFormData.use_custom_hours}>
                    <input
                      type="radio"
                      name="scheduleType"
                      checked={scheduleFormData.use_custom_hours}
                      onChange={() => setScheduleFormData({ ...scheduleFormData, use_custom_hours: true })}
                    />
                    <span><strong>Personnalisé</strong><span>Horaires sur mesure</span></span>
                  </label>
                </div>

                {!scheduleFormData.use_custom_hours && (
                  <div className="empv2-champ">
                    <label htmlFor="select-planning">Sélectionner un planning</label>
                    {plannings.filter((pl) => pl.enterprise_id === selectedEmployeeForSchedule.enterprise_id).length === 0 && (
                      <div className="ch-message-fiche" role="status">
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>Aucun planning trouvé pour cette entreprise.</span>
                      </div>
                    )}
                    <select id="select-planning" className="ch-champ-cadre" value={scheduleFormData.schedule_id} onChange={(e) => setScheduleFormData({ ...scheduleFormData, schedule_id: e.target.value })}>
                      <option value="">-- Aucun planning --</option>
                      {plannings.filter((pl) => pl.enterprise_id === selectedEmployeeForSchedule.enterprise_id).map((planning) => (
                        <option key={planning.id} value={planning.id}>{planning.name} ({planning.start_time?.slice(0, 5)} - {planning.end_time?.slice(0, 5)}){planning.is_default ? ' ★' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {scheduleFormData.use_custom_hours && (
                  <>
                    <div className="empv2-champ--double">
                      <div className="empv2-champ">
                        <label htmlFor="horaires-arrivee">Arrivée</label>
                        <input id="horaires-arrivee" type="time" className="ch-champ-cadre" value={scheduleFormData.custom_start_time} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_start_time: e.target.value })} />
                      </div>
                      <div className="empv2-champ">
                        <label htmlFor="horaires-depart">Départ</label>
                        <input id="horaires-depart" type="time" className="ch-champ-cadre" value={scheduleFormData.custom_end_time} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_end_time: e.target.value })} />
                      </div>
                    </div>
                    <label className="empv2-choix-option">
                      <input
                        type="checkbox"
                        checked={scheduleFormData.custom_has_break}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_has_break: e.target.checked })}
                      />
                      <span><strong>Pause déjeuner</strong></span>
                    </label>
                    {scheduleFormData.custom_has_break && (
                      <div className="empv2-champ--double">
                        <div className="empv2-champ">
                          <label htmlFor="horaires-pause-debut">Début pause</label>
                          <input id="horaires-pause-debut" type="time" className="ch-champ-cadre" value={scheduleFormData.custom_break_start} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_break_start: e.target.value })} />
                        </div>
                        <div className="empv2-champ">
                          <label htmlFor="horaires-pause-fin">Fin pause</label>
                          <input id="horaires-pause-fin" type="time" className="ch-champ-cadre" value={scheduleFormData.custom_break_end} onChange={(e) => setScheduleFormData({ ...scheduleFormData, custom_break_end: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <div className="empv2-champ">
                      <label>Jours de travail</label>
                      <div className="empv2-jours" role="group" aria-label="Jours de travail">
                        {joursSemaine.map((jour) => (
                          <button
                            key={jour.id}
                            type="button"
                            className="empv2-jour"
                            aria-pressed={scheduleFormData.custom_work_days.includes(jour.id)}
                            onClick={() => toggleJourTravail(jour.id)}
                          >
                            {jour.court}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="empv2-modale-pied">
                <button type="button" className="ch-btn-contour" onClick={() => setShowScheduleModal(false)}>Annuler</button>
                <button type="button" className="ch-btn-pleine" onClick={handleSaveSchedule}><Save size={14} aria-hidden="true" /> Enregistrer</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACCÈS PORTAIL — la fenêtre du registre ═══ */}
        {showPasswordModal && selectedEmployeeForPassword && (
          <ModaleAccesPortail
            employee={selectedEmployeeForPassword}
            aCompte={aUnCompteEmploye(selectedEmployeeForPassword)}
            compteSupabase={aUnCompteSupabase(selectedEmployeeForPassword)}
            ancienSysteme={estAncienSysteme(selectedEmployeeForPassword)}
            derniereConnexion={formatDerniereConnexion(selectedEmployeeForPassword)}
            portailActif={Boolean(selectedEmployeeForPassword.employee_portal_enabled)}
            onEnregistrer={(motDePasse) => enregistrerMotDePasse(selectedEmployeeForPassword, motDePasse)}
            onBasculerPortail={handleTogglePortalAccess}
            onClose={() => setShowPasswordModal(false)}
          />
        )}

        {/* ═══ ENVOYER LES HORAIRES — on montre avant d'envoyer ═══ */}
        {horairesEmploye && (
          <ModaleHoraires
            employee={horairesEmploye}
            entrepriseName={horairesEmploye.enterprises?.name || ''}
            onDefinirHoraires={() => {
              const cible = horairesEmploye
              setHorairesEmploye(null)
              handleOpenSchedule(cible)
            }}
            onClose={() => setHorairesEmploye(null)}
          />
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
