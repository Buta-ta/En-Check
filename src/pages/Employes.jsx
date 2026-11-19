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
  Coffee, CalendarX,
  Briefcase, Hash, Mail, Phone, Building2, Shield,
  Key, Lock, UserCheck, UserX, Calendar, Heart, Globe, CreditCard,
  FileText, Award, User, MapPin, Flag, Baby, Layers, Radio, ClipboardList, Network,
  LayoutDashboard, CalendarDays, CalendarOff, Timer, Wallet, Sparkles, Settings,
  Cpu, TrendingUp, Megaphone, Router, ScanFace, ShieldCheck, Bell, LogOut,
  Moon, Sun, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import BadgeEmploye from '../components/BadgeEmploye'
import ModaleAccesPortail from '../components/employes/ModaleAccesPortail'
import ModaleHoraires from '../components/employes/ModaleHoraires'
import EnCheckBrandMark from '../components/EnCheckBrandMark'
import EmployesLoadingScreen from '../components/EmployesLoadingScreen'
import { grouperAbsences } from '../utils/barresSemaine'
import CurrencyService from '../services/currencyService'
import FicheEmployeModal from '../components/FicheEmployeModal'
import CarteEmploye from '../components/equipes/CarteEmploye'
import PancarteEnseigne from '../components/parcours/PancarteEnseigne'
import CheminEmpreintes from '../components/parcours/CheminEmpreintes'
import BornePointage from '../components/parcours/BornePointage'
import DecorationChemin from '../components/parcours/DecorationChemin'
import Etincelle from '../components/equipes/Etincelle'
import { useTheme } from '../contexts/ThemeContext'
import { KenteWovenTapestrySvg } from '../components/AfroCulturalSvg'
import EquipesVue from '../components/equipes/EquipesVue'
import { getTeams } from '../services/teamService'
import { getTasks, TASK_STATUS } from '../services/taskService'
import TachesVue from '../components/taches/TachesVue'
import '../components/zoulou/zoulou.css'
import '../pages/Dashboard.css'
import './EmployesRefonte.css'
import './EquipesTaches.css'
import './EmployesV3.css'
import { construirePauses, estPauseReelleEffectuee } from '../services/pausesService'
import { formaterHeureLocale, jourLocal, minutesDepuisMinuit, obtenirDateDuJour } from '../utils/timezoneUtils'

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

// Un retard se dit en heures et minutes, jamais en minutes seules :
// « 523 min » ne veut rien dire, « 8 h 43 » se lit.
function dureeEnHeuresEtMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
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
  // La série des présences des quatorze derniers jours — pour l'étincelle.
  const [seriePresents, setSeriePresents] = useState(null)
  // 0 = cette semaine ; -1 = la précédente. On ne va jamais dans le futur.
  const [decalageSemaine, setDecalageSemaine] = useState(0)
  // Les tâches par équipe : lues sur les mêmes équipes que la vue Équipes.
  const [tachesParEquipe, setTachesParEquipe] = useState(null)
  // La semaine et le fil d'annonces : deux lectures silencieuses, aucune
  // donnée inventée si le serveur ne répond pas.
  const [semainePointages, setSemainePointages] = useState(null)
  const [semaineAbsences, setSemaineAbsences] = useState([])
  const [remunerations, setRemunerations] = useState(null)

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
        // Les quatorze derniers jours, dans l'ordre, zéros compris :
        // un jour sans pointage est un zéro, pas un trou dans la courbe.
        // Les clés sont celles que `jourLocal` produit pour les pointages :
        // une date UTC ici décalerait tout d'un jour à Cotonou (UTC+1).
        const serie = []
        for (let i = 13; i >= 0; i -= 1) {
          const jour = new Date(fin.getTime() - i * 24 * 3600 * 1000)
          const cle = jourLocal(jour)
          serie.push(jours.has(cle) ? jours.get(cle).size : 0)
        }
        if (!annule) setSeriePresents(serie)
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
        lundi.setDate(maintenant.getDate() - decalage + decalageSemaine * 7)
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
            .lte('start_date', jourLocal(dimanche))
            .gte('end_date', jourLocal(lundi)),
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
  }, [employes, decalageSemaine])

  // La masse salariale : les profils de rémunération des entreprises
  // réellement chargées — pas seulement celle de l'administrateur, sinon
  // un super-administrateur lisait une table vide.
  useEffect(() => {
    let annule = false
    const lire = async () => {
      try {
        const entreprisesDesEmployes = [...new Set(employes.map((e) => e.enterprise_id).filter(Boolean))]
        if (entreprisesDesEmployes.length === 0) { if (!annule) setRemunerations([]); return }
        const { data, error } = await supabase
          .from('employee_payroll_profiles')
          .select('employee_id, enterprise_id, salary_type, base_salary, hourly_rate, daily_rate, contract_hours_per_month, contract_days_per_month, transport_allowance, housing_allowance, fixed_bonus, is_active')
          .in('enterprise_id', entreprisesDesEmployes)
        if (error) throw error
        if (!annule) setRemunerations((data || []).filter((p) => p.is_active !== false))
      } catch {
        if (!annule) setRemunerations(null)
      }
    }
    lire()
    return () => { annule = true }
  }, [employes])

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

  // L'annuaire se lit par pages de 9 cartes — trois rangées de trois.
  const TAILLE_PAGE_ANNUAIRE = 9
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

  // L'entreprise dont on lit les équipes : celle qu'on regarde, sinon la sienne.
  const entrepriseDesVues = selectedEnterpriseFilter !== 'all'
    ? selectedEnterpriseFilter
    : (admin?.selectedEnterprise?.id || admin?.enterprise_id || null)

  // ── les tâches par équipe ───────────────────────────────
  // On lit les équipes de l'entreprise affichée, puis leurs tâches.
  // Une tâche « finie » = terminée ou validée ; le reste est en cours.
  useEffect(() => {
    let annule = false
    const lire = async () => {
      if (!entrepriseDesVues) { if (!annule) setTachesParEquipe(null); return }
      try {
        const { data: equipes } = await getTeams(entrepriseDesVues, { includeMembers: true })
        if (!equipes) { if (!annule) setTachesParEquipe([]); return }
        const { data: taches } = await getTasks(entrepriseDesVues, { limit: 1000 })
        const finies = new Set([TASK_STATUS.COMPLETED, TASK_STATUS.VALIDATED])
        const parEquipe = new Map()
        ;(taches || []).forEach((tache) => {
          if (!tache.team_id) return
          if (!parEquipe.has(tache.team_id)) parEquipe.set(tache.team_id, { total: 0, faites: 0 })
          const compteur = parEquipe.get(tache.team_id)
          compteur.total += 1
          if (finies.has(tache.status)) compteur.faites += 1
        })
        if (!annule) {
          setTachesParEquipe(equipes.map((equipe) => ({
            id: equipe.id,
            nom: equipe.name,
            couleur: equipe.color || null,
            membres: (equipe.members || [])
              .map((m) => m.employee)
              .filter((e) => e && e.is_active !== false),
            ...(parEquipe.get(equipe.id) || { total: 0, faites: 0 }),
          })))
        }
      } catch {
        if (!annule) setTachesParEquipe(null)
      }
    }
    lire()
    return () => { annule = true }
  }, [entrepriseDesVues])


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

  // ── les cartes de chiffres agissent ─────────────────────
  // Chaque carte applique un filtre à la liste, puis y amène l'écran.
  // On ne promet pas une page qu'on n'ouvre pas.
  const allerALaListe = () => {
    const cible = document.querySelector('.empv2-filtres')
    if (cible?.scrollIntoView) cible.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const filtrerParLaCarte = (cle) => {
    setCategoryFilter((actuel) => (actuel === cle ? 'all' : cle))
    allerALaListe()
  }
  const montrerLesSansCompte = () => {
    setCategoryFilter((actuel) => (actuel === 'sans_compte' ? 'all' : 'sans_compte'))
    allerALaListe()
  }
  const montrerLesRetards = () => {
    setCategoryFilter((actuel) => (actuel === 'live_retard' ? 'all' : 'live_retard'))
    allerALaListe()
  }

  // La semaine en cours, découpée en sept jours.
  const semaineAffichee = (() => {
    const maintenant = new Date()
    const lundi = new Date(maintenant)
    lundi.setDate(maintenant.getDate() - ((maintenant.getDay() + 6) % 7) + decalageSemaine * 7)
    lundi.setHours(0, 0, 0, 0)
    const noms = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
    const aujourdhuiISO = obtenirDateDuJour()
    return Array.from({ length: 7 }, (_, i) => {
      const jour = new Date(lundi)
      jour.setDate(lundi.getDate() + i)
      // La clé d'un jour doit être celle de l'entreprise, pas celle d'UTC :
      // sinon un pointage du 19 à 00 h 30 heure de Cotonou se lit le 18.
      const iso = jourLocal(jour)
      return {
        iso,
        nom: noms[i],
        num: jour.getDate(),
        futur: iso > aujourdhuiISO,
        aujourdhui: iso === aujourdhuiISO,
      }
    })
  })()

  const libelleSemaine = (() => {
    if (decalageSemaine === 0) return 'Cette semaine'
    const premier = semaineAffichee[0]
    const dernier = semaineAffichee[6]
    const court = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return `Semaine du ${court(premier.iso)} au ${court(dernier.iso)}`
  })()

  // Une ligne = une personne, sept cases. Trois états, jamais devinés :
  // absence connue, pointage connu, ou rien.
  const lignesPlanning = employes.slice(0, 6).map((employee) => {
    const jours = semaineAffichee.map((jour) => {
      const absence = semaineAbsences.find(
        (a) => a.employee_id === employee.id
          && String(a.start_date || '').slice(0, 10) <= jour.iso
          && String(a.end_date || '').slice(0, 10) >= jour.iso,
      )
      if (absence) return { etat: 'conge', mot: absence.reason || 'Congé' }
      if (semainePointages?.get(employee.id)?.has(jour.iso)) {
        const retard = liveStatusByEmployee?.[employee.id]
        if (jour.aujourdhui && retard?.retardMinutes) {
          return {
            etat: 'retard',
            mot: `Retard de ${dureeEnHeuresEtMinutes(retard.retardMinutes)}`,
            minutes: retard.retardMinutes,
            court: dureeEnHeuresEtMinutes(retard.retardMinutes),
          }
        }
        return { etat: 'pointe', mot: 'Pointé' }
      }
      // Un jour passé sans pointage est un fait, pas un vide : on le nomme.
      return {
        etat: jour.futur ? 'avenir' : 'rien',
        mot: jour.futur ? 'À venir — jour non encore écoulé' : 'Non pointé',
      }
    })
    // Une absence de trois jours est une barre, pas trois cases.
    return { employee, jours, barres: grouperAbsences(jours) }
  })

  // ── la masse salariale ──────────────────────────────────
  // Le coût mensuel d'une personne = sa base (salaire mensuel, ou taux
  // horaire × heures, ou taux journalier × jours) plus ses indemnités.
  // On ne convertit rien : ce qui n'est pas chiffré en base ne compte pas.
  const coutMensuelDe = (profil) => {
    const n = (v) => Number(v) || 0
    const fixe = profil.salary_type === 'hourly'
      ? n(profil.hourly_rate) * n(profil.contract_hours_per_month)
      : profil.salary_type === 'daily'
        ? n(profil.daily_rate) * n(profil.contract_days_per_month)
        : n(profil.base_salary)
    return fixe + n(profil.transport_allowance) + n(profil.housing_allowance) + n(profil.fixed_bonus)
  }

  const devise = (() => {
    const id = selectedEnterpriseFilter !== 'all'
      ? selectedEnterpriseFilter
      : admin?.enterprise_id
    const ent = entreprises.find((e) => e.id === id) || entreprises[0] || null
    return CurrencyService.resolveCurrency({ enterprise: ent }) || null
  })()

  const masseSalariale = (() => {
    if (!remunerations) return null
    let total = 0
    const parService = new Map()
    remunerations.forEach((profil) => {
      const montant = coutMensuelDe(profil)
      if (montant <= 0) return
      total += montant
      const employe = employes.find((e) => e.id === profil.employee_id)
      const service = employe?.department || employe?.position || 'Sans service'
      parService.set(service, (parService.get(service) || 0) + montant)
    })
    const compter = new Map()
    remunerations.forEach((profil) => {
      if (coutMensuelDe(profil) <= 0) return
      const employe = employes.find((e) => e.id === profil.employee_id)
      const service = employe?.department || employe?.position || 'Sans service'
      compter.set(service, (compter.get(service) || 0) + 1)
    })
    const lignes = [...parService.entries()]
      .map(([service, montant]) => ({ service, montant, personnes: compter.get(service) || 0 }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 6)
    return { total, lignes, max: lignes[0]?.montant || 0, nbProfils: remunerations.length }
  })()

  const montant = (valeur) => CurrencyService.format(valeur, devise)

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

          {/* les deux vues de la page vivent ici, pas dans l'en-tête :
              une seule navigation, celle du rail */}
          <div className="nav3-rail-vues" role="group" aria-label="Vues de la page Employés">
            {vueAutorisee && (
              <>
                <button
                  type="button"
                  className={`nav3-rail-item nav3-rail-sous${vueActive === 'equipes' ? ' is-actif' : ''}`}
                  aria-current={vueActive === 'equipes' ? 'page' : undefined}
                  title="Vue : Équipes"
                  aria-label="Vue Équipes"
                  onClick={() => changerVue('equipes')}
                >
                  <Network size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`nav3-rail-item nav3-rail-sous${vueActive === 'taches' ? ' is-actif' : ''}`}
                  aria-current={vueActive === 'taches' ? 'page' : undefined}
                  title="Vue : Tâches"
                  aria-label="Vue Tâches"
                  onClick={() => changerVue('taches')}
                >
                  <ClipboardList size={15} aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          <div className="nav3-rail-pied">
            <button
              type="button"
              className="nav3-rail-item"
              onClick={toggleTheme}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              aria-pressed={darkMode}
            >
              {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
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
        {/* ═══ MAIN ═══ */}
        <main className="empv2-main">
          {/* L'en-tête est un bloc posé sur la page : une étiquette, un titre
              qui occupe la place, et trois actions à droite. Plus de barre de
              raccourcis (le rail les porte) et plus de bouton de thème ici :
              il vit dans le rail, une seule fois. */}
          <header className="empv3-entete">
            <span className="empv3-entete-bandeau" aria-hidden="true" />
            {/* la pancarte plante ses racines dans l'en-tête, au milieu */}
            <span className="empv3-entete-pancarte">
              <PancarteEnseigne taille={104} motif="cahier" />
            </span>
            <div className="empv3-entete-corps">
            <div className="empv3-entete-gauche">
              <span className="empv3-entete-eyebrow">
                Équipe
                <i className="empv3-entete-point" aria-hidden="true" />
              </span>
              <h1 className="empv3-entete-titre">
                Employés
                {vueActive === null && (
                  <span className="empv3-entete-compte">
                    {employes.length} employé{employes.length > 1 ? 's' : ''}
                  </span>
                )}
              </h1>
              <p className="empv3-entete-sous">
                {vueActive === null
                  ? `Bonjour, ${prenomAdmin} — ${jourEnClair}`
                  : 'La page Employés, vue par vue'}
              </p>
            </div>

            <div className="empv3-entete-actions">
              <div className="empv3-entete-chips">
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
              </div>

              <div className="empv3-entete-principale">
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
              </div>
            </div>
            </div>
            <span className="empv3-entete-bandeau empv3-entete-bandeau--bas" aria-hidden="true" />
          </header>

          {vueActive === null && (
            <div className="empv3-parcours">
            {/* le chemin descend de la pancarte, serpente, et s'arrête à la borne.
                Il ne prend aucun clic : pointer-events: none. */}
            <span className="empv3-chemin" aria-hidden="true">
              <CheminEmpreintes />
            </span>
            <DecorationChemin haut={9} decalage={-44} variante={0} taille={20} />
            <DecorationChemin haut={14} decalage={44} variante={1} taille={18} />
            <DecorationChemin haut={23} decalage={-52} variante={2} taille={26} />
            <DecorationChemin haut={31} decalage={48} variante={0} taille={20} />
            <DecorationChemin haut={44} decalage={-48} variante={1} taille={18} />
            <DecorationChemin haut={53} decalage={52} variante={2} taille={24} />
            <DecorationChemin haut={64} decalage={-50} variante={0} taille={20} />
            <DecorationChemin haut={73} decalage={46} variante={1} taille={18} />
            <DecorationChemin haut={84} decalage={-46} variante={2} taille={24} />
            <DecorationChemin haut={92} decalage={50} variante={0} taille={20} />
            <div className="empv2-annuaire">
              {/* les chiffres du jour : trois tuiles, le chiffre porte sa période.
                  Tout est compté sur le personnel chargé, jamais une estimation. */}
              {/* les quatre cartes — l'anatomie de la maquette du 08/11 :
                  icône ronde teintée, libellé, gros chiffre, légende.
                  L'écart ne s'affiche que là où il est mesuré. */}
              <div className="empv3-cartes empv3-cartes--quatre">

                <button
                  type="button"
                  className={`empv3-carte empv3-kpi empv3-kpi--agissante${categoryFilter === 'all' ? '' : ''}`}
                  onClick={() => { setCategoryFilter('all'); allerALaListe() }}
                  aria-label={`Effectif total : ${employes.length} collaborateurs — voir toute la liste`}
                >
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="argile">
                      <Users size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Effectif total</span>
                  </div>
                  <div className="empv3-kpi-ligne">
                    <span className="empv3-kpi-chiffre">{employes.length}</span>
                  </div>
                  <div className="empv3-kpi-pied">Collaborateurs dans l’entreprise</div>
                  <span className="empv3-kpi-action">Voir la liste <ArrowRight size={10} aria-hidden="true" /></span>
                </button>

                <button
                  type="button"
                  className={`empv3-carte empv3-kpi empv3-kpi--agissante${categoryFilter === 'live_en_poste' ? ' empv3-kpi--active' : ''}`}
                  onClick={() => filtrerParLaCarte('live_en_poste')}
                  aria-pressed={categoryFilter === 'live_en_poste'}
                  aria-label={`Présents : ${presentsDuJour} — filtrer la liste sur les personnes en poste`}
                >
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="succes">
                      <Briefcase size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Présents</span>
                  </div>
                  <div className="empv3-kpi-ligne">
                    <span className="empv3-kpi-chiffre">{suiviPresence ? presentsDuJour : '—'}</span>
                    {ecartPresents !== null && (
                      <span className={ecartPresents >= 0 ? 'empv3-ecart empv3-ecart--haut' : 'empv3-ecart empv3-ecart--bas'}>
                        {ecartPresents >= 0 ? '↗' : '↘'} {Math.abs(ecartPresents)} %
                      </span>
                    )}
                  </div>
                  <div className="empv3-kpi-pied">
                    {ecartPresents === null
                      ? 'pointés aujourd’hui'
                      : 'par rapport à la moyenne des 30 jours'}
                  </div>
                  <span className="empv3-kpi-action">
                    {categoryFilter === 'live_en_poste' ? 'Filtre posé' : 'Filtrer'}
                    <ArrowRight size={10} aria-hidden="true" />
                  </span>
                  {seriePresents && (
                    <span className="empv3-kpi-etincelle">
                      <Etincelle valeurs={seriePresents} />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`empv3-carte empv3-kpi empv3-kpi--agissante${categoryFilter === 'sans_compte' ? ' empv3-kpi--active' : ''}`}
                  onClick={montrerLesSansCompte}
                  aria-pressed={categoryFilter === 'sans_compte'}
                  aria-label={`Accès au portail : ${actifsPortail} comptes actifs sur ${employes.length} — montrer les personnes sans compte`}
                >
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="texte">
                      <Key size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Accès au portail</span>
                  </div>
                  <div className="empv3-kpi-ligne">
                    <span className="empv3-kpi-chiffre">{actifsPortail}</span>
                  </div>
                  <div className="empv3-kpi-pied">
                    comptes actifs sur {employes.length}
                    <span className="empv3-kpi-note"> · {Math.max(employes.length - actifsPortail, 0)} à activer</span>
                  </div>
                  <span className="empv3-kpi-action">
                    {Math.max(employes.length - actifsPortail, 0) === 0
                      ? 'Tous activés'
                      : categoryFilter === 'sans_compte' ? 'Filtre posé' : 'Voir les sans-compte'}
                    <ArrowRight size={10} aria-hidden="true" />
                  </span>
                </button>

                <button
                  type="button"
                  className={`empv3-carte empv3-kpi empv3-kpi--agissante${categoryFilter === 'live_retard' ? ' empv3-kpi--active' : ''}`}
                  onClick={montrerLesRetards}
                  aria-pressed={categoryFilter === 'live_retard'}
                  aria-label={`Retards : ${liveCounts.retards} — filtrer la liste sur les retards`}
                >
                  <div className="empv3-kpi-tete">
                    <span className="empv3-kpi-ico" data-ton="alerte">
                      <Clock size={16} aria-hidden="true" />
                    </span>
                    <span className="empv3-carte-titre">Retards</span>
                  </div>
                  <div className="empv3-kpi-ligne">
                    <span className="empv3-kpi-chiffre">{suiviPresence ? liveCounts.retards : '—'}</span>
                  </div>
                  <div className="empv3-kpi-pied">arrivées après l’heure, aujourd’hui</div>
                  <span className="empv3-kpi-action">
                    {categoryFilter === 'live_retard' ? 'Filtre posé' : 'Voir les retards'}
                    <ArrowRight size={10} aria-hidden="true" />
                  </span>
                </button>
              </div>

              {/* les deux blocs du milieu — planning de la semaine, annonces */}
              <div className="empv3-grille-planning">

                <div className="empv3-carte">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Planning de la semaine</span>
                    <span className="empv3-semaine-commande">
                      <button
                        type="button"
                        className="empv3-fleche"
                        aria-label="La semaine précédente"
                        onClick={() => setDecalageSemaine((n) => n - 1)}
                      >
                        <ChevronLeft size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="empv3-chip empv3-chip--bouton"
                        aria-label={`Afficher la semaine du ${semaineAffichee[0].num} : ${libelleSemaine}`}
                        onClick={() => setDecalageSemaine(0)}
                        title="Revenir à la semaine en cours"
                      >
                        {libelleSemaine}
                      </button>
                      <button
                        type="button"
                        className="empv3-fleche"
                        aria-label="La semaine suivante"
                        disabled={decalageSemaine >= 0}
                        onClick={() => setDecalageSemaine((n) => Math.min(0, n + 1))}
                      >
                        <ChevronRight size={13} aria-hidden="true" />
                      </button>
                    </span>
                  </div>

                    <div className="empv3-pistes">
                      {/* la règle des jours, au-dessus des pistes */}
                      <div className="empv3-piste empv3-piste--regle">
                        <span aria-hidden="true" />
                        {semaineAffichee.map((jour) => (
                          <span
                            key={`regle-${jour.iso}`}
                            className={`empv3-jour${jour.aujourdhui ? ' is-aujourdhui' : ''}`}
                          >
                            {jour.nom}
                            <b>{jour.num}</b>
                          </span>
                        ))}
                      </div>

                      {lignesPlanning.map(({ employee, jours, barres }) => {
                        const presence = liveStatusByEmployee?.[employee.id]
                        const motEtat = presence?.state === 'en_poste' ? 'En poste'
                          : presence?.state === 'en_pause' ? 'En pause'
                          : presence?.state === 'en_conge' ? 'Absent'
                          : presence?.state === 'termine' ? 'Parti'
                          : null
                        return (
                          <div className="empv3-piste" key={employee.id}>
                            <span className="empv3-piste-identite">
                              <span className="empv3-avatar empv3-avatar--piste">
                                {employee.photo_url
                                  ? <img src={employee.photo_url} alt="" loading="lazy" />
                                  : `${(employee.first_name || '?')[0]}${(employee.last_name || '')[0] || ''}`}
                              </span>
                              <span className="empv3-semaine-textes">
                                <span className="empv3-semaine-qui">{nomCompletDe(employee)}</span>
                                <span className="empv3-semaine-poste">
                                  {[employee.position, employee.department].filter(Boolean).join(' · ')
                                    || 'poste non renseigné'}
                                </span>
                              </span>
                              {motEtat && (
                                <span className={`empv3-etat empv3-etat--${presence.state}`}>{motEtat}</span>
                              )}
                            </span>

                            {jours.map((jour, index) => {
                              const couvert = barres.some((b) => index > b.debut && index <= b.fin)
                              return (
                                <span
                                  key={`${employee.id}-${index}`}
                                  className={`empv3-case empv3-case--${jour.etat}`}
                                  data-infobulle={`${semaineAffichee[index].nom} ${semaineAffichee[index].num} — ${jour.mot}`}
                                  aria-label={couvert
                                    ? undefined
                                    : `${semaineAffichee[index].nom} ${semaineAffichee[index].num} — ${jour.mot}`}
                                  aria-hidden={couvert ? 'true' : undefined}
                                >
                                  {jour.etat === 'pointe' && (
                                    <span className="empv3-case-marque" aria-hidden="true">✓</span>
                                  )}
                                  {jour.etat === 'retard' && (
                                    <span className="empv3-case-plus" aria-hidden="true">+{jour.court}</span>
                                  )}
                                </span>
                              )
                            })}

                            {barres.map((barre) => (
                              <span
                                key={`${employee.id}-barre-${barre.debut}`}
                                className="empv3-barre"
                                style={{ gridColumn: `${barre.debut + 2} / ${barre.fin + 3}` }}
                                data-infobulle={`${semaineAffichee[barre.debut].nom} ${semaineAffichee[barre.debut].num} → ${semaineAffichee[barre.fin].nom} ${semaineAffichee[barre.fin].num} — ${barre.mot}`}
                              >
                                <span className="empv3-barre-mot">{barre.mot}</span>
                              </span>
                            ))}
                          </div>
                        )
                      })}
                    </div>

                    <div className="empv3-legende-etats" aria-label="Ce que veulent dire les cases">
                      <span className="empv3-legende-intro">Comment lire</span>
                      <span className="empv3-legende-item">
                        <i className="empv3-case empv3-case--pointe"><b aria-hidden="true">✓</b></i>
                        Pointé
                      </span>
                      <span className="empv3-legende-item">
                        <i className="empv3-case empv3-case--retard"><b className="empv3-case-plus" aria-hidden="true">+42 min</b></i>
                        Retard
                      </span>
                      <span className="empv3-legende-item">
                        <i className="empv3-case empv3-case--conge" />
                        Absence
                      </span>
                      <span className="empv3-legende-item">
                        <i className="empv3-case empv3-case--avenir" />
                        À venir
                      </span>
                      <span className="empv3-legende-item">
                        <i className="empv3-case empv3-case--rien" />
                        Rien pointé
                      </span>
                    </div>
                </div>

                <div className="empv3-colonne-droite">
                <div className="empv3-carte">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Masse salariale</span>
                    <span className="empv3-carte-total">par mois</span>
                  </div>

                  {masseSalariale === null ? (
                    <p className="empv3-legende">Les rémunérations n’ont pas pu être lues.</p>
                  ) : masseSalariale.nbProfils === 0 ? (
                    <p className="empv3-legende">
                      Aucune rémunération renseignée : la masse ne peut pas être calculée.
                    </p>
                  ) : masseSalariale.total === 0 ? (
                    <p className="empv3-legende">
                      Aucun montant chiffré dans les profils de paie : rien à additionner.
                    </p>
                  ) : (
                    <>
                      <p className="empv3-masse">{montant(masseSalariale.total)}</p>

                      <div
                        className="empv3-rang"
                        role="img"
                        aria-label={`Coût mensuel par service : ${masseSalariale.lignes
                          .map((l) => `${l.service}, ${montant(l.montant)}`)
                          .join(' ; ')}`}
                      >
                        {masseSalariale.lignes.map((ligne, index) => (
                          <div className="empv3-rang-ligne" key={ligne.service}>
                            <span className="empv3-rang-mot" title={ligne.service}>
                              {ligne.service}
                              <small className="empv3-rang-detail">
                                {ligne.personnes} pers. · {Math.round((ligne.montant / masseSalariale.total) * 100)} %
                              </small>
                            </span>
                            <span className="empv3-rang-piste">
                              <span
                                className={`empv3-rang-barre${index === 0 ? ' is-forte' : ''}`}
                                style={{
                                  width: `${Math.max(
                                    4,
                                    Math.round((ligne.montant / masseSalariale.max) * 100),
                                  )}%`,
                                }}
                              />
                            </span>
                            <span className="empv3-rang-montant">{montant(ligne.montant)}</span>
                          </div>
                        ))}
                      </div>

                      <p className="empv3-legende">
                        Coût mensuel par service — salaire de base et indemnités fixes.
                        {masseSalariale.nbProfils < employes.length
                          ? ` ${employes.length - masseSalariale.nbProfils} personne(s) sans profil de paie.`
                          : ''}
                      </p>
                    </>
                  )}
                </div>

                {/* Les tâches par équipe, sous la masse salariale : le travail
                    en cours, avec les visages des membres. */}
                <div className="empv3-carte empv3-carte--taches">
                  <div className="empv3-carte-tete">
                    <span className="empv3-carte-titre">Tâches par équipe</span>
                    <span className="empv3-carte-total">
                      {tachesParEquipe === null
                        ? '—'
                        : `${tachesParEquipe.reduce((n, e) => n + e.total, 0)} tâches`}
                    </span>
                  </div>

                  {tachesParEquipe === null ? (
                    <p className="empv3-legende">Les équipes n’ont pas pu être lues.</p>
                  ) : tachesParEquipe.length === 0 ? (
                    <p className="empv3-legende">
                      Aucune équipe formée : créez-en une dans la vue Équipes pour voir
                      ici le travail de chacune.
                    </p>
                  ) : (
                    <div className="empv3-equipes-taches">
                      {tachesParEquipe.slice(0, 5).map((equipe) => {
                        const part = equipe.total > 0 ? Math.round((equipe.faites / equipe.total) * 100) : 0
                        return (
                          <button
                            type="button"
                            key={equipe.id}
                            className="empv3-equipe-ligne"
                            data-infobulle={`${equipe.nom} — ${equipe.faites} finie${equipe.faites > 1 ? 's' : ''} sur ${equipe.total} — ${equipe.membres.length} membre${equipe.membres.length > 1 ? 's' : ''}`}
                            onClick={() => changerVue('taches')}
                          >
                            <span className="empv3-equipe-nom" title={equipe.nom}>
                              {equipe.couleur && (
                                <i className="empv3-equipe-teinte" style={{ background: equipe.couleur }} aria-hidden="true" />
                              )}
                              {equipe.nom}
                            </span>
                            <span className="empv3-equipe-avatars">
                              {equipe.membres.slice(0, 4).map((membre) => (
                                <span className="empv3-avatar empv3-avatar--pile" key={membre.id}>
                                  {membre.photo_url
                                    ? <img src={membre.photo_url} alt="" loading="lazy" />
                                    : `${(membre.first_name || '?')[0]}${(membre.last_name || '')[0] || ''}`}
                                </span>
                              ))}
                              {equipe.membres.length > 4 && (
                                <span className="empv3-avatar empv3-avatar--pile empv3-avatar--plus">
                                  +{equipe.membres.length - 4}
                                </span>
                              )}
                              {equipe.membres.length === 0 && (
                                <span className="empv3-equipe-vide">sans membre</span>
                              )}
                            </span>
                            <span className="empv3-equipe-piste" aria-hidden="true">
                              <span
                                className="empv3-equipe-part"
                                style={{ width: `${equipe.total > 0 ? Math.max(3, part) : 0}%` }}
                              />
                            </span>
                            <span className="empv3-equipe-compte">
                              {equipe.total > 0
                                ? `${equipe.faites}/${equipe.total}`
                                : 'aucune tâche'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <p className="empv3-legende">
                    Tâches terminées ou validées sur le total de l’équipe.
                  </p>
                </div>
                </div>
              </div>

              {/* la barre d'outils de « Tous les employés » :
                  la recherche, puis l'état de la journée */}
              <div className="empv3-liste-tete">
                <span className="empv3-bloc-titre">
                  Tous les employés
                  <small className="empv3-bloc-compte">
                    {employesFiltres.length} sur {employes.length}
                  </small>
                </span>
                <label className="empv3-recherche">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nom, matricule, poste, service, CNPS…"
                    aria-label="Rechercher un employé"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="empv3-recherche-effacer"
                      aria-label="Effacer la recherche"
                      onClick={() => setSearchTerm('')}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  )}
                </label>

                {/* la borne se plante au milieu de la ligne, entre le titre
                    et la recherche : elle ne recouvre plus rien */}
                <span className="empv3-borne empv3-borne--entete">
                  <BornePointage taille={112} />
                </span>
              </div>

              <div className="empv2-filtres" role="group" aria-label="Filtrer la liste">
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
                  {/* l'annuaire : une carte par personne — visage, poste,
                      contrat, contacts, état du jour, 9 cartes par page */}
                  <div className="empv3-fiches" aria-label="Le personnel">
                    {employesPageAnnuaire.map((employee) => (
                          <CarteEmploye
                            key={employee.id}
                            employee={employee}
                            liveStatus={liveStatusByEmployee[employee.id]}
                            contractLabel={employee.contract_type ? getContractLabel(employee.contract_type) : ''}
                            portalEnabled={isPortalModuleEnabled(employee) && employee.employee_portal_enabled}
                            planningEnabled={isModulePlanningEnabled(employee)}
                            aCompte={aUnCompteEmploye(employee)}
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
                    {nbPagesAnnuaire > 1 && (
                      <div className="empv2-pagination">
                        <span className="ch-mono">{plageAnnuaire} sur {employesFiltres.length} — 9 par page</span>
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

            {/* la seconde pancarte ferme le chemin */}
            <footer className="empv3-pancarte">
              <PancarteEnseigne taille={96} compact />
            </footer>
            </div>
          )}

          {vueActive === 'equipes' && (
            <EquipesVue enterpriseId={entrepriseDesVues} employes={employes} signalCreation={signalCreationEquipe} />
          )}

          {vueActive === 'taches' && (
            <TachesVue enterpriseId={entrepriseDesVues} employes={employes} signalCreation={signalCreationTache} />
          )}

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
