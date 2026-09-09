
// ═══════════════════════════════════════════════════════════
// 🏢 PAGE GESTION DES ENTREPRISES - AFROFUTURISTE
// + CONFIGURATION AUTO-CLOSE
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import TaxationService from '../services/taxationService'
import { useNavigate } from 'react-router-dom'
import {
  Footprints,
  Building2,
  Plus,
  ArrowLeft,
  Search,
  Edit,
  Trash2,
  X,
  Save,
  Users,
  Clock,
  Camera,
  Shield,
  Upload,
  Palette,
  Mail,
  Phone,
  MapPin,
  Hash,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  Globe,
  CreditCard,
  QrCode,
  Calendar,
  CalendarOff,
  AlertTriangle,
  FileText,
  PenTool,
  CheckCircle2,
  XCircle,
  ClipboardList,
  TrendingUp,
  Sparkles,
  Timer,
  ToggleLeft,
  Radio,
  Monitor,
  Wallet,
  Smartphone,
} from 'lucide-react'

export default function Entreprises() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEntreprise, setEditingEntreprise] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [expandedCard, setExpandedCard] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [paysDisponibles, setPaysDisponibles] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    sector: '',
    country_code: '',
    matricule_prefix: '',
    primary_color: '#D4AF37',
    logo_url: '',
    license_type: 'basic',

    // ✅ AUTO-CLOSE
    auto_close_enabled: false,
    auto_close_time: '23:59',
    auto_close_grace_minutes: 0,

    module_qr_scanner: false,
    module_photo_pointage: false,
    module_planning: false,
    module_retards: false,
    module_rapports_avances: false,
    module_modification_pointages: false,
    module_conges: false,
    module_geolocalisation: false,
    module_carte_temps_reel: false,
    module_reconnaissance_faciale: false,
    module_heures_supplementaires: false,
    module_espace_employe: false,
    module_fiches_paie: false,
    module_taches: false,
    module_predictions: false,
    module_pointeuses: false,
    module_poste_pointage: false,
    module_remunerations: false,
    module_cout_salarial: false,
    module_config_fiscale: false,
    module_alertes_telephone: false,
    module_alertes_courrier: false
  })

  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  const modulesConfig = [
    // ─── Le pointage ────────────────────────────────────────────────────────
    {
      key: 'module_qr_scanner',
      icon: <QrCode size={16} />,
      name: 'Scanner QR',
      desc: 'Pointage par scan de badge',
      color: '#F59E0B',
      groupe: 'Le pointage'
    },
    {
      key: 'module_photo_pointage',
      icon: <Camera size={16} />,
      name: 'Photo Pointage',
      desc: 'Capture photo anti-fraude',
      color: '#EC4899',
      groupe: 'Le pointage'
    },
    {
      key: 'module_modification_pointages',
      icon: <PenTool size={16} />,
      name: 'Modif. Pointages',
      desc: 'Modifier avec traçabilité',
      color: '#8B5CF6',
      groupe: 'Le pointage'
    },
    {
      key: 'module_pointeuses',
      icon: <Radio size={16} />,
      name: 'Pointeuses (ADMS)',
      desc: 'Machines à badge du réseau',
      color: '#14B8A6',
      groupe: 'Le pointage'
    },
    {
      key: 'module_poste_pointage',
      icon: <Monitor size={16} />,
      name: 'Poste de pointage',
      desc: 'Tablette laissée à l\'entrée du site',
      color: '#22C55E',
      groupe: 'Le pointage'
    },

    // ─── La sécurité ────────────────────────────────────────────────────────
    {
      key: 'module_geolocalisation',
      icon: <MapPin size={16} />,
      name: 'Geofencing',
      desc: 'Zones GPS autorisées',
      color: '#10B981',
      groupe: 'La sécurité'
    },
    {
      key: 'module_carte_temps_reel',
      icon: <Activity size={16} />,
      name: 'Carte Temps Réel',
      desc: 'Visualisation GPS live',
      color: '#6366F1',
      groupe: 'La sécurité'
    },
    {
      key: 'module_reconnaissance_faciale',
      icon: <Users size={16} />,
      name: 'Reconnaissance Faciale',
      desc: 'Pointage biométrique par visage',
      color: '#EC4899',
      groupe: 'La sécurité'
    },

    // ─── L\'organisation ────────────────────────────────────────────────────
    {
      key: 'module_planning',
      icon: <Calendar size={16} />,
      name: 'Planning',
      desc: 'Horaires de travail',
      color: '#10B981',
      groupe: 'L\'organisation'
    },
    {
      key: 'module_retards',
      icon: <AlertTriangle size={16} />,
      name: 'Retards',
      desc: 'Stats et alertes retards',
      color: '#EF4444',
      groupe: 'L\'organisation'
    },
    {
      key: 'module_heures_supplementaires',
      icon: <Clock size={16} />,
      name: 'Heures Supplémentaires',
      desc: 'Calcul auto avec majorations',
      color: '#F97316',
      groupe: 'L\'organisation'
    },
    {
      key: 'module_conges',
      icon: <CalendarOff size={16} />,
      name: 'Congés / Absences',
      desc: 'Gestion des absences et congés',
      color: '#14B8A6',
      groupe: 'L\'organisation'
    },
    {
      key: 'module_taches',
      icon: <ClipboardList size={16} />,
      name: 'Gestion des Tâches',
      desc: 'Équipes, tâches, suivi et preuves',
      color: '#F59E0B',
      groupe: 'L\'organisation'
    },
    {
      key: 'module_predictions',
      icon: <TrendingUp size={16} />,
      name: 'Prédictions',
      desc: 'Anticipation de charge et besoins',
      color: '#8B5CF6',
      groupe: 'L\'organisation'
    },
    {
      key: 'module_espace_employe',
      icon: <Users size={16} />,
      name: 'Espace Employé',
      desc: 'Portail self-service employés',
      color: '#22C55E',
      groupe: 'L\'organisation'
    },

    // ─── La paie ────────────────────────────────────────────────────────────
    {
      key: 'module_fiches_paie',
      icon: <CreditCard size={16} />,
      name: 'Fiches de Paie',
      desc: 'Bulletins de salaire & variables',
      color: '#F59E0B',
      groupe: 'La paie'
    },
    {
      key: 'module_remunerations',
      icon: <Wallet size={16} />,
      name: 'Rémunérations',
      desc: 'Contrat, base, taux et indemnités',
      color: '#0EA5E9',
      groupe: 'La paie'
    },
    {
      key: 'module_cout_salarial',
      icon: <TrendingUp size={16} />,
      name: 'Coût Salarial',
      desc: 'Coût de l\'heure et projection du mois',
      color: '#6366F1',
      groupe: 'La paie'
    },
    {
      key: 'module_config_fiscale',
      icon: <Shield size={16} />,
      name: 'Configuration Fiscale',
      desc: 'Cotisations et barème du pays',
      color: '#8B5CF6',
      groupe: 'La paie'
    },

    // ─── Les alertes ────────────────────────────────────────────────────────
    {
      key: 'module_alertes_telephone',
      icon: <Smartphone size={16} />,
      name: 'Alertes sur téléphone',
      desc: 'Poussées sans ouvrir l\'application',
      color: '#F59E0B',
      groupe: 'Les alertes'
    },
    {
      key: 'module_alertes_courrier',
      icon: <Mail size={16} />,
      name: 'Alertes par courrier',
      desc: 'Envoyées aux responsables',
      color: '#38BDF8',
      groupe: 'Les alertes'
    },

    // ─── Les rapports ───────────────────────────────────────────────────────
    {
      key: 'module_rapports_avances',
      icon: <FileText size={16} />,
      name: 'Rapports Avancés',
      desc: 'PDF et Excel détaillés',
      color: '#6366F1',
      groupe: 'Les rapports'
    },
  ]

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }

    const parsedAdmin = JSON.parse(adminData)
    if (parsedAdmin.role !== 'super_admin') {
      navigate('/dashboard')
      return
    }

    setAdmin(parsedAdmin)
    loadData()
    loadPays()
  }, [navigate])

  // ⭐ Les pays connus du référentiel fiscal. On en a besoin dès la création :
  //    choisir un pays doit charger son barème, et prévenir s'il n'en a pas.
  const loadPays = async () => {
    try {
      const { data } = await supabase
        .from('countries_payroll_config')
        .select('country_code, country_name, currency, default_tax_brackets')
        .eq('is_active', true)
        .order('country_name')
      setPaysDisponibles(data || [])
    } catch (error) {
      console.error('Erreur chargement des pays:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('enterprises')
        .select(`*, employees(count), attendances(count)`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setEntreprises(data || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
    }
    setLoading(false)
  }

  const genererCode = (name) => {
    const base = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${base}${random}`
  }

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("L'image est trop grande (max 5MB)")
      return
    }

    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const uploadLogo = async (code) => {
    if (!logoFile) return null
    setUploading(true)

    try {
      const extension = logoFile.name.split('.').pop()
      const fileName = `enterprise-${code}-${Date.now()}.${extension}`

      const { error } = await supabase.storage
        .from('photos')
        .upload(fileName, logoFile, { cacheControl: '3600', upsert: true })

      if (error) {
        console.error('Erreur upload:', error)
        return null
      }

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
      return urlData.publicUrl
    } catch (error) {
      console.error('Erreur upload:', error)
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleAdd = () => {
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      address: '',
      sector: '',
      matricule_prefix: '',
      primary_color: '#D4AF37',
      logo_url: '',
      license_type: 'basic',

      // ✅ AUTO-CLOSE
      auto_close_enabled: false,
      auto_close_time: '23:59',
      auto_close_grace_minutes: 0,

      module_qr_scanner: false,
      module_photo_pointage: false,
      module_planning: false,
      module_retards: false,
      module_rapports_avances: false,
      module_modification_pointages: false,
      module_conges: false,
      module_geolocalisation: false,
      module_carte_temps_reel: false,
      module_reconnaissance_faciale: false,
      module_heures_supplementaires: false,
      module_espace_employe: false,
      module_fiches_paie: false,
      module_taches: false,
      module_predictions: false,
      module_pointeuses: false,
      module_poste_pointage: false,
      module_remunerations: false,
      module_cout_salarial: false,
      module_config_fiscale: false,
      module_alertes_telephone: false,
      module_alertes_courrier: false,
    })
    setEditingEntreprise(null)
    setLogoPreview(null)
    setLogoFile(null)
    setShowModal(true)
  }

  const handleEdit = (entreprise) => {
    setFormData({
      name: entreprise.name,
      code: entreprise.code,
      email: entreprise.email || '',
      phone: entreprise.phone || '',
      address: entreprise.address || '',
      sector: entreprise.sector || '',
      country_code: entreprise.country_code || '',
      matricule_prefix: entreprise.matricule_prefix || '',
      primary_color: entreprise.primary_color || '#D4AF37',
      logo_url: entreprise.logo_url || '',
      license_type: entreprise.license_type || 'basic',

      // ✅ AUTO-CLOSE
      auto_close_enabled: entreprise.auto_close_enabled || false,
      auto_close_time: entreprise.auto_close_time || '23:59',
      auto_close_grace_minutes: entreprise.auto_close_grace_minutes ?? 0,

      module_qr_scanner: entreprise.module_qr_scanner || false,
      module_planning: entreprise.module_planning || false,
      module_retards: entreprise.module_retards || false,
      module_rapports_avances: entreprise.module_rapports_avances || false,
      module_modification_pointages: entreprise.module_modification_pointages || false,
      module_photo_pointage: entreprise.module_photo_pointage || false,
      module_conges: entreprise.module_conges || false,
      module_geolocalisation: entreprise.module_geolocalisation || false,
      module_carte_temps_reel: entreprise.module_carte_temps_reel || false,
      module_reconnaissance_faciale: entreprise.module_reconnaissance_faciale || false,
      module_heures_supplementaires: entreprise.module_heures_supplementaires || false,
      module_espace_employe: entreprise.module_espace_employe || false,
      module_fiches_paie: entreprise.module_fiches_paie || false,
      module_taches: entreprise.module_taches || false,
      module_predictions: entreprise.module_predictions || false,
      module_pointeuses: entreprise.module_pointeuses || false,
      module_poste_pointage: entreprise.module_poste_pointage || false,
      module_remunerations: entreprise.module_remunerations || false,
      module_cout_salarial: entreprise.module_cout_salarial || false,
      module_config_fiscale: entreprise.module_config_fiscale || false,
      module_alertes_telephone: entreprise.module_alertes_telephone || false,
      module_alertes_courrier: entreprise.module_alertes_courrier || false,
    })
    setEditingEntreprise(entreprise)
    setLogoPreview(entreprise.logo_url || null)
    setLogoFile(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.name) {
        alert("Le nom de l'entreprise est obligatoire")
        return
      }

      let code = formData.code
      let matricule_prefix = formData.matricule_prefix

      if (!editingEntreprise) {
        if (!code) code = genererCode(formData.name)
        if (!matricule_prefix) {
          matricule_prefix = formData.name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
        }
      }

      let logoUrl = formData.logo_url
      if (logoFile) {
        const uploadedUrl = await uploadLogo(code || formData.code)
        if (uploadedUrl) logoUrl = uploadedUrl
      }

      const saveData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        sector: formData.sector || null,
        country_code: formData.country_code || null,
        currency: paysDisponibles.find((x) => x.country_code === formData.country_code)?.currency || null,
        matricule_prefix: formData.matricule_prefix || matricule_prefix,
        primary_color: formData.primary_color || '#D4AF37',
        logo_url: logoUrl || null,
        license_type: formData.license_type,

        // ✅ AUTO-CLOSE
        auto_close_enabled: formData.auto_close_enabled,
        auto_close_time: formData.auto_close_time || '23:59',
        auto_close_grace_minutes: Number(formData.auto_close_grace_minutes || 0),

        module_qr_scanner: formData.module_qr_scanner,
        module_planning: formData.module_planning,
        module_retards: formData.module_retards,
        module_rapports_avances: formData.module_rapports_avances,
        module_modification_pointages: formData.module_modification_pointages,
        module_photo_pointage: formData.module_photo_pointage,
        module_conges: formData.module_conges,
        module_geolocalisation: formData.module_geolocalisation,
        module_carte_temps_reel: formData.module_carte_temps_reel,
        module_reconnaissance_faciale: formData.module_reconnaissance_faciale,
        module_heures_supplementaires: formData.module_heures_supplementaires,
        module_espace_employe: formData.module_espace_employe,
        module_fiches_paie: formData.module_fiches_paie,
        module_taches: formData.module_taches,
        module_predictions: formData.module_predictions,
        module_pointeuses: formData.module_pointeuses,
        module_poste_pointage: formData.module_poste_pointage,
        module_remunerations: formData.module_remunerations,
        module_cout_salarial: formData.module_cout_salarial,
        module_config_fiscale: formData.module_config_fiscale,
        module_alertes_telephone: formData.module_alertes_telephone,
        module_alertes_courrier: formData.module_alertes_courrier,
      }

      let idEntreprise = editingEntreprise ? editingEntreprise.id : null

      if (editingEntreprise) {
        await supabase
          .from('enterprises')
          .update({ ...saveData, updated_at: new Date().toISOString() })
          .eq('id', editingEntreprise.id)
      } else {
        const { data: creee, error: errInsert } = await supabase
          .from('enterprises')
          .insert({ ...saveData, code, is_active: true })
          .select('id')
          .single()
        if (errInsert) throw errInsert
        idEntreprise = creee?.id || null
      }

      // ⭐ LE PAYS CHARGE SA CONFIGURATION FISCALE.
      //    ⚠️ Sans ça, une entreprise créée avec un pays n'a pourtant ni barème
      //       ni cotisations : son impôt sort à zéro, et rien ne le dit. C'est
      //       arrivé à « Pharmacie Blanche Gomes » et à « EN-NOUS ».
      //    On ne recharge QUE si le pays est nouveau ou a changé : remettre à
      //    zéro une configuration réglée à la main serait une perte sèche.
      const paysAvant = editingEntreprise?.country_code || null
      const doitCharger = formData.country_code && formData.country_code !== paysAvant

      if (idEntreprise && doitCharger) {
        const res = await TaxationService.initializeEnterpriseFromCountry(
          idEntreprise,
          formData.country_code,
        )
        if (!res.success) {
          alert(
            '⚠️ Entreprise enregistrée, mais la configuration fiscale du pays n’a pas pu '
            + 'être chargée : ' + res.error,
          )
        }
      }

      setShowModal(false)
      setLogoFile(null)
      setLogoPreview(null)
      loadData()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  const handleDelete = async (entreprise) => {
    const employeesCount = entreprise.employees?.[0]?.count || 0
    if (employeesCount > 0) {
      alert(`Impossible de supprimer : ${employeesCount} employé(s) dans cette entreprise`)
      setShowDeleteConfirm(null)
      return
    }

    try {
      await supabase
        .from('enterprises')
        .update({ is_active: false })
        .eq('id', entreprise.id)

      setShowDeleteConfirm(null)
      loadData()
    } catch (error) {
      console.error('Erreur suppression:', error)
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setFormData({ ...formData, logo_url: '' })
  }

  const entreprisesFiltrees = entreprises.filter(ent => {
    const search = searchTerm.toLowerCase()
    return (
      ent.name?.toLowerCase().includes(search) ||
      ent.code?.toLowerCase().includes(search) ||
      ent.email?.toLowerCase().includes(search) ||
      ent.sector?.toLowerCase().includes(search)
    )
  })

  const handleNameChange = (name) => {
    const prefix = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
    setFormData({
      ...formData,
      name,
      matricule_prefix: editingEntreprise ? formData.matricule_prefix : prefix
    })
  }

  const getActiveModulesCount = (ent) => {
    return modulesConfig.filter(m => ent[m.key]).length
  }

  const getLicenseBadge = (type) => {
    switch (type) {
      case 'enterprise':
        return { label: 'Enterprise', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' }
      case 'premium':
        return { label: 'Premium', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' }
      default:
        return { label: 'Basic', color: '#10B981', bg: 'rgba(16,185,129,0.12)' }
    }
  }

  const formatGrace = (minutes) => {
    const value = Number(minutes || 0)
    if (value <= 0) return 'Aucune tolérance'
    return `${value} min de tolérance`
  }

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes pulseRing {
            0% { transform: scale(0.95); opacity: 0.6; }
            70% { transform: scale(1.08); opacity: 0; }
            100% { transform: scale(1.08); opacity: 0; }
          }
        `}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingIconWrap}>
            <div style={styles.loadingPulseRing}></div>
            <div style={styles.loadingPulse}>
              <Building2 size={50} color="#F59E0B" />
            </div>
          </div>
          <p style={styles.loadingText}>Chargement des entreprises...</p>
          <div style={styles.loadingBar}>
            <div style={styles.loadingBarFill}></div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 700px; }
        }
        .afro-ent-card {
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .afro-ent-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 16px 50px rgba(0,0,0,0.4) !important;
          border-color: rgba(245, 158, 11, 0.25) !important;
        }
        .afro-action-icon {
          transition: all 0.2s ease !important;
        }
        .afro-action-icon:hover {
          transform: scale(1.15) !important;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3) !important;
        }
        .afro-add-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 30px rgba(245, 158, 11, 0.4) !important;
        }
        .afro-search:focus-within {
          border-color: rgba(245, 158, 11, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1) !important;
        }
        .afro-back-btn:hover {
          background: rgba(245, 158, 11, 0.2) !important;
          border-color: rgba(245, 158, 11, 0.4) !important;
        }
        .afro-modal-overlay {
          animation: fadeIn 0.3s ease;
        }
        .afro-modal-content {
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .afro-module-toggle {
          transition: all 0.2s ease !important;
        }
        .afro-module-toggle:hover {
          background: rgba(245, 158, 11, 0.06) !important;
          border-color: rgba(245, 158, 11, 0.3) !important;
        }
        .expand-section {
          animation: expandIn 0.3s ease forwards;
          overflow: hidden;
        }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-stack { flex-direction: column !important; }
          .mobile-full { width: 100% !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 3px; }
        select option { background: #141423; color: #E5E5E5; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <button className="afro-back-btn" onClick={() => navigate('/dashboard')} style={styles.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={styles.logoMark}>
                <Building2 size={22} color="#F59E0B" />
              </div>
              <div>
                <h1 style={styles.headerTitle}>ENTREPRISES</h1>
                <span style={styles.headerSub}>Gestion des organisations</span>
              </div>
            </div>
            <button className="afro-add-btn" onClick={handleAdd} style={styles.addBtnHeader}>
              <Plus size={18} />
              <span className="desktop-only">Nouvelle entreprise</span>
              <span className="mobile-only" style={{ display: 'none' }}>Créer</span>
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <div style={styles.summaryStrip}>
            <div style={styles.summaryCard}>
              <div style={{ ...styles.summaryIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
                <Building2 size={20} color="#F59E0B" />
              </div>
              <div style={styles.summaryInfo}>
                <span style={styles.summaryNumber}>{entreprises.length}</span>
                <span style={styles.summaryLabel}>Entreprises</span>
              </div>
            </div>
            <div style={styles.summaryDivider}></div>
            <div style={styles.summaryCard}>
              <div style={{ ...styles.summaryIcon, background: 'rgba(16, 185, 129, 0.12)' }}>
                <Users size={20} color="#10B981" />
              </div>
              <div style={styles.summaryInfo}>
                <span style={styles.summaryNumber}>
                  {entreprises.reduce((sum, e) => sum + (e.employees?.[0]?.count || 0), 0)}
                </span>
                <span style={styles.summaryLabel}>Employés</span>
              </div>
            </div>
            <div style={styles.summaryDivider}></div>
            <div style={styles.summaryCard}>
              <div style={{ ...styles.summaryIcon, background: 'rgba(99, 102, 241, 0.12)' }}>
                <Activity size={20} color="#6366F1" />
              </div>
              <div style={styles.summaryInfo}>
                <span style={styles.summaryNumber}>
                  {entreprises.reduce((sum, e) => sum + (e.attendances?.[0]?.count || 0), 0)}
                </span>
                <span style={styles.summaryLabel}>Pointages</span>
              </div>
            </div>
          </div>

          <div style={styles.toolbar}>
            <div className="afro-search" style={styles.searchContainer}>
              <Search size={18} color="#666" />
              <input
                type="text"
                placeholder="Rechercher par nom, code, secteur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={styles.clearSearch}>
                  <X size={16} />
                </button>
              )}
            </div>
            <div style={styles.resultCount}>
              <span style={styles.resultNumber}>{entreprisesFiltrees.length}</span>
              <span style={styles.resultText}>résultat{entreprisesFiltrees.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div style={styles.list}>
            {entreprisesFiltrees.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>
                  <Building2 size={48} color="#F59E0B" />
                </div>
                <h3 style={styles.emptyTitle}>Aucune entreprise trouvée</h3>
                <p style={styles.emptySubtitle}>
                  {searchTerm ? 'Modifiez votre recherche' : 'Commencez par créer votre première entreprise'}
                </p>
                {!searchTerm && (
                  <button onClick={handleAdd} className="afro-add-btn" style={styles.emptyAddBtn}>
                    <Plus size={18} /> Créer une entreprise
                  </button>
                )}
              </div>
            ) : (
              entreprisesFiltrees.map((entreprise, index) => {
                const license = getLicenseBadge(entreprise.license_type)
                const activeModules = getActiveModulesCount(entreprise)
                const isExpanded = expandedCard === entreprise.id

                return (
                  <div
                    key={entreprise.id}
                    className="afro-ent-card"
                    style={{
                      ...styles.entCard,
                      animation: `fadeInUp 0.4s ease ${index * 0.06}s forwards`,
                      opacity: 0,
                    }}
                  >
                    <div
                      style={{
                        ...styles.cardGlowLine,
                        background: `linear-gradient(90deg, transparent, ${entreprise.primary_color || '#F59E0B'}66, transparent)`,
                      }}
                    ></div>

                    <div style={styles.cardMainRow}>
                      <div
                        style={{
                          ...styles.entLogo,
                          borderColor: `${entreprise.primary_color || '#F59E0B'}40`,
                        }}
                      >
                        {entreprise.logo_url ? (
                          <img src={entreprise.logo_url} alt="" style={styles.entLogoImg} />
                        ) : (
                          <Building2 size={24} color={entreprise.primary_color || '#F59E0B'} />
                        )}
                      </div>

                      <div style={styles.entInfo}>
                        <div style={styles.entNameRow}>
                          <span style={styles.entName}>{entreprise.name}</span>
                          <span
                            style={{
                              ...styles.licenseBadge,
                              color: license.color,
                              background: license.bg,
                              borderColor: `${license.color}30`,
                            }}
                          >
                            <CreditCard size={10} />
                            {license.label}
                          </span>
                        </div>

                        <div style={styles.entMetaRow}>
                          {entreprise.sector && (
                            <span style={styles.entMeta}>
                              <Globe size={11} />
                              {entreprise.sector}
                            </span>
                          )}
                          <span style={styles.entMeta}>
                            <Hash size={11} />
                            {entreprise.code}
                          </span>
                          <span style={styles.entMeta}>
                            <Hash size={11} />
                            {entreprise.matricule_prefix || '---'}
                          </span>
                        </div>

                        {entreprise.email && (
                          <span style={styles.entEmail}>
                            <Mail size={11} /> {entreprise.email}
                          </span>
                        )}

                        <div style={styles.modulesChips}>
                          {activeModules > 0 ? (
                            <span style={styles.modulesCountBadge}>
                              <Zap size={10} />
                              {activeModules} module{activeModules > 1 ? 's' : ''} actif{activeModules > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span
                              style={{
                                ...styles.modulesCountBadge,
                                color: '#666',
                                background: 'rgba(255,255,255,0.03)',
                                borderColor: 'rgba(255,255,255,0.06)',
                              }}
                            >
                              Aucun module
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={styles.entStats}>
                        <div style={styles.entStatItem}>
                          <Users size={14} color="#10B981" />
                          <span style={styles.entStatNumber}>{entreprise.employees?.[0]?.count || 0}</span>
                          <span style={styles.entStatLabel}>Empl.</span>
                        </div>
                        <div style={styles.entStatItem}>
                          <Clock size={14} color="#6366F1" />
                          <span style={styles.entStatNumber}>{entreprise.attendances?.[0]?.count || 0}</span>
                          <span style={styles.entStatLabel}>Point.</span>
                        </div>
                      </div>

                      <div style={styles.entActions}>
                        <button
                          className="afro-action-icon"
                          onClick={() => setExpandedCard(isExpanded ? null : entreprise.id)}
                          style={{
                            ...styles.entActionBtn,
                            background: isExpanded ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)',
                            color: isExpanded ? '#F59E0B' : '#888',
                          }}
                          title="Détails"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          className="afro-action-icon"
                          onClick={() => navigate(`/admins?enterprise=${entreprise.id}`)}
                          style={{ ...styles.entActionBtn, color: '#10B981' }}
                          title="Gérer les admins"
                        >
                          <Shield size={16} />
                        </button>
                        <button
                          className="afro-action-icon"
                          onClick={() => handleEdit(entreprise)}
                          style={{ ...styles.entActionBtn, color: '#6366F1' }}
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="afro-action-icon"
                          onClick={() => setShowDeleteConfirm(entreprise)}
                          style={{ ...styles.entActionBtn, ...styles.entDeleteBtn }}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="expand-section" style={styles.expandedSection}>
                        <div style={styles.expandDivider}></div>

                        <div style={styles.expandGrid}>
                          <div style={styles.expandBlock}>
                            <h4 style={styles.expandBlockTitle}>
                              <Mail size={14} color="#F59E0B" /> Contact
                            </h4>
                            <div style={styles.expandDetail}>
                              <span style={styles.expandLabel}>Email</span>
                              <span style={styles.expandValue}>{entreprise.email || '—'}</span>
                            </div>
                            <div style={styles.expandDetail}>
                              <span style={styles.expandLabel}>Téléphone</span>
                              <span style={styles.expandValue}>{entreprise.phone || '—'}</span>
                            </div>
                            <div style={styles.expandDetail}>
                              <span style={styles.expandLabel}>Adresse</span>
                              <span style={styles.expandValue}>{entreprise.address || '—'}</span>
                            </div>
                          </div>

                          <div style={styles.expandBlock}>
                            <h4 style={styles.expandBlockTitle}>
                              <Timer size={14} color="#F59E0B" /> Auto-Close
                            </h4>
                            <div style={styles.expandDetail}>
                              <span style={styles.expandLabel}>Statut</span>
                              <span style={styles.expandValue}>
                                {entreprise.auto_close_enabled ? 'Activé' : 'Désactivé'}
                              </span>
                            </div>
                            <div style={styles.expandDetail}>
                              <span style={styles.expandLabel}>Heure</span>
                              <span style={styles.expandValue}>
                                {entreprise.auto_close_time || '23:59'}
                              </span>
                            </div>
                            <div style={styles.expandDetail}>
                              <span style={styles.expandLabel}>Tolérance</span>
                              <span style={styles.expandValue}>
                                {formatGrace(entreprise.auto_close_grace_minutes)}
                              </span>
                            </div>
                          </div>

                          <div style={styles.expandBlock}>
                            <h4 style={styles.expandBlockTitle}>
                              <Zap size={14} color="#F59E0B" /> Modules
                            </h4>
                            <div style={styles.expandModulesGrid}>
                              {modulesConfig.map(mod => (
                                <div key={mod.key} style={styles.expandModuleItem}>
                                  {entreprise[mod.key] ? (
                                    <CheckCircle2 size={14} color="#10B981" />
                                  ) : (
                                    <XCircle size={14} color="#444" />
                                  )}
                                  <span
                                    style={{
                                      ...styles.expandModuleName,
                                      color: entreprise[mod.key] ? '#E5E5E5' : '#555',
                                    }}
                                  >
                                    {mod.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={styles.colorPreviewRow}>
                          <span style={styles.expandLabel}>Couleur badge</span>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: entreprise.primary_color || '#D4AF37',
                              border: '2px solid rgba(255,255,255,0.1)',
                            }}
                          ></div>
                          <span style={{ ...styles.expandValue, fontFamily: 'monospace', fontSize: '12px' }}>
                            {entreprise.primary_color || '#D4AF37'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div style={styles.footer}>
            <div style={styles.footerLine}></div>
            <p style={styles.footerText}>
              <Footprints size={14} color="#F59E0B" />
              EN-CHECK • Gestion des Entreprises
            </p>
          </div>
        </main>

        {showDeleteConfirm && (
          <div className="afro-modal-overlay" style={styles.modalOverlay}>
            <div className="afro-modal-content" style={styles.confirmModal}>
              <div style={styles.modalIconWrap}>
                <AlertTriangle size={28} color="#EF4444" />
              </div>
              <h3 style={styles.confirmTitle}>Supprimer cette entreprise ?</h3>
              <p style={styles.confirmText}>
                <strong style={{ color: '#F59E0B' }}>{showDeleteConfirm.name}</strong>
                <br />
                {(showDeleteConfirm.employees?.[0]?.count || 0) > 0
                  ? `⚠️ ${showDeleteConfirm.employees[0].count} employé(s) — suppression impossible`
                  : 'Cette action est irréversible.'}
              </p>
              <div style={styles.confirmBtns}>
                <button onClick={() => setShowDeleteConfirm(null)} style={styles.modalCancelBtn}>Annuler</button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  style={{
                    ...styles.modalDeleteBtn,
                    opacity: (showDeleteConfirm.employees?.[0]?.count || 0) > 0 ? 0.4 : 1,
                    pointerEvents: (showDeleteConfirm.employees?.[0]?.count || 0) > 0 ? 'none' : 'auto',
                  }}
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="afro-modal-overlay" style={styles.modalOverlay}>
            <div className="afro-modal-content" style={styles.formModal}>
              <div style={styles.formModalHeader}>
                <div style={styles.formModalTitleWrap}>
                  <div
                    style={{
                      ...styles.formModalIcon,
                      background: editingEntreprise ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)'
                    }}
                  >
                    {editingEntreprise
                      ? <Edit size={20} color="#6366F1" />
                      : <Building2 size={20} color="#F59E0B" />}
                  </div>
                  <div>
                    <h2 style={styles.formModalTitle}>
                      {editingEntreprise ? "Modifier l'entreprise" : 'Nouvelle entreprise'}
                    </h2>
                    <span style={styles.formModalSub}>
                      {editingEntreprise ? `Modification de ${editingEntreprise.name}` : 'Remplissez les informations'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={styles.formCloseBtn}>
                  <X size={20} />
                </button>
              </div>

              <div style={styles.formModalBody}>
                <div style={styles.logoUploadSection}>
                  <div style={styles.logoUploadBox} onClick={() => fileInputRef.current?.click()}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" style={styles.logoUploadImg} />
                    ) : (
                      <div style={styles.logoUploadPlaceholder}>
                        <Camera size={28} color="#F59E0B" />
                        <span style={styles.logoUploadText}>Logo</span>
                      </div>
                    )}
                    <div style={styles.logoUploadOverlay}>
                      <Upload size={16} color="#FFF" />
                    </div>
                  </div>
                  {logoPreview && (
                    <button onClick={handleRemoveLogo} style={styles.logoRemoveBtn}>
                      <X size={14} /> Retirer
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>
                    <Building2 size={14} /> Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    style={styles.formInput}
                    placeholder="Ex: TechSenegal"
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>
                    <Palette size={14} /> Couleur du badge
                  </label>
                  <div style={styles.colorPickerRow}>
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      style={styles.colorInput}
                    />
                    <span style={styles.colorValue}>{formData.primary_color}</span>
                    <div
                      style={{
                        flex: 1,
                        height: '32px',
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.primary_color}88)`,
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    ></div>
                  </div>
                </div>

                {/* ✅ CONFIG AUTO-CLOSE */}
                <div style={styles.autoCloseSection}>
                  <div style={styles.modulesSectionHeader}>
                    <Timer size={18} color="#F59E0B" />
                    <h3 style={styles.modulesSectionTitle}>Configuration Auto-Close</h3>
                  </div>

                  <div style={styles.formField}>
                    <label style={styles.autoCloseToggleRow}>
                      <div style={styles.autoCloseToggleLeft}>
                        <div style={styles.autoCloseToggleIcon}>
                          <ToggleLeft size={18} color={formData.auto_close_enabled ? '#10B981' : '#888'} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={styles.moduleToggleName}>Activer la fermeture automatique</span>
                          <span style={styles.moduleToggleDesc}>
                            Ferme automatiquement les pointages ouverts à l'heure définie
                          </span>
                        </div>
                      </div>
                      <div style={styles.toggleSwitch}>
                        <input
                          type="checkbox"
                          checked={formData.auto_close_enabled}
                          onChange={(e) => setFormData({ ...formData, auto_close_enabled: e.target.checked })}
                          style={styles.toggleInput}
                        />
                        <div
                          style={{
                            ...styles.toggleTrack,
                            background: formData.auto_close_enabled ? '#10B981' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <div
                            style={{
                              ...styles.toggleThumb,
                              transform: formData.auto_close_enabled ? 'translateX(18px)' : 'translateX(2px)',
                            }}
                          ></div>
                        </div>
                      </div>
                    </label>
                  </div>

                  <div style={styles.formRow}>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>
                        <Clock size={14} /> Heure auto-close
                      </label>
                      <input
                        type="time"
                        value={formData.auto_close_time}
                        onChange={(e) => setFormData({ ...formData, auto_close_time: e.target.value })}
                        style={styles.formInput}
                        disabled={!formData.auto_close_enabled}
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.formLabel}>
                        <Timer size={14} /> Tolérance (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={formData.auto_close_grace_minutes}
                        onChange={(e) => setFormData({ ...formData, auto_close_grace_minutes: e.target.value })}
                        style={styles.formInput}
                        placeholder="0"
                        disabled={!formData.auto_close_enabled}
                      />
                    </div>
                  </div>

                  <div style={styles.formHintBox}>
                    <span style={styles.formHintStrong}>Aperçu :</span>
                    <span style={styles.formHintText}>
                      {formData.auto_close_enabled
                        ? ` Auto-close à ${formData.auto_close_time || '23:59'}${Number(formData.auto_close_grace_minutes || 0) > 0 ? ` avec ${formData.auto_close_grace_minutes} min de tolérance` : ''}.`
                        : ' Auto-close désactivé pour cette entreprise.'}
                    </span>
                  </div>
                </div>

                <div style={styles.modulesFormSection}>
                  <div style={styles.modulesSectionHeader}>
                    <Shield size={18} color="#F59E0B" />
                    <h3 style={styles.modulesSectionTitle}>Modules & Licence</h3>
                  </div>

                  <div style={styles.formField}>
                    <label style={styles.formLabel}>
                      <CreditCard size={14} /> Type de licence
                    </label>
                    <select
                      value={formData.license_type}
                      onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                      style={styles.formSelect}
                    >
                      <option value="basic">🟢 Basic (Gratuit)</option>
                      <option value="premium">🟡 Premium</option>
                      <option value="enterprise">🟣 Enterprise</option>
                    </select>
                  </div>

                  <div style={styles.moduleTogglesGrid}>
                    {modulesConfig.map((mod, rang) => (
                      <Fragment key={mod.key}>
                      {(rang === 0 || modulesConfig[rang - 1].groupe !== mod.groupe) && (
                        <div style={styles.groupeOptions}>
                          <span>{mod.groupe}</span>
                          <span style={styles.groupeOptionsCompte}>
                            {modulesConfig.filter(m => m.groupe === mod.groupe && formData[m.key]).length}
                            {' sur '}
                            {modulesConfig.filter(m => m.groupe === mod.groupe).length}
                          </span>
                        </div>
                      )}
                      <label
                        className="afro-module-toggle"
                        style={{
                          ...styles.moduleToggle,
                          borderColor: formData[mod.key] ? `${mod.color}40` : 'rgba(255,255,255,0.06)',
                          background: formData[mod.key] ? `${mod.color}08` : 'transparent',
                        }}
                      >
                        <div style={{ ...styles.moduleToggleIcon, background: `${mod.color}15`, color: mod.color }}>
                          {mod.icon}
                        </div>
                        <div style={styles.moduleToggleInfo}>
                          <span style={styles.moduleToggleName}>{mod.name}</span>
                          <span style={styles.moduleToggleDesc}>{mod.desc}</span>
                        </div>
                        <div style={styles.toggleSwitch}>
                          <input
                            type="checkbox"
                            checked={formData[mod.key]}
                            onChange={(e) => setFormData({ ...formData, [mod.key]: e.target.checked })}
                            style={styles.toggleInput}
                          />
                          <div
                            style={{
                              ...styles.toggleTrack,
                              background: formData[mod.key] ? mod.color : 'rgba(255,255,255,0.1)',
                            }}
                          >
                            <div
                              style={{
                                ...styles.toggleThumb,
                                transform: formData[mod.key] ? 'translateX(18px)' : 'translateX(2px)',
                              }}
                            ></div>
                          </div>
                        </div>
                      </label>
                      </Fragment>
                    ))}
                  </div>
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>
                    <Globe size={14} /> Domaine / Secteur
                  </label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    style={styles.formInput}
                    placeholder="Ex: Banque, BTP, Santé..."
                  />
                </div>

                {/* ⭐ LE PAYS, DÈS LA CRÉATION.
                    Sans lui, l'entreprise n'a ni barème ni cotisations : son
                    impôt sort à zéro et rien ne le signale. Le pays choisi
                    charge sa configuration fiscale à la sauvegarde. */}
                <div style={styles.formField}>
                  <label style={styles.formLabel}>
                    <Globe size={14} /> Pays (fiscalité)
                  </label>
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    style={styles.formInput}
                  >
                    <option value="">— Aucun pays (impôt non calculé) —</option>
                    {paysDisponibles.map((p) => (
                      <option key={p.country_code} value={p.country_code}>
                        {p.country_name || p.country_code}
                        {(!p.default_tax_brackets || p.default_tax_brackets.length === 0)
                          ? '  ⚠️ sans barème' : ''}
                      </option>
                    ))}
                  </select>
                  {formData.country_code && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                      {(() => {
                        const pays = paysDisponibles.find((x) => x.country_code === formData.country_code)
                        if (!pays) return ''
                        if (!pays.default_tax_brackets || pays.default_tax_brackets.length === 0) {
                          return '⚠️ Ce pays n’a pas de barème d’impôt dans le référentiel : ' +
                                 'les salariés paieront ZÉRO impôt jusqu’à ce qu’on le renseigne.'
                        }
                        return 'Sa configuration fiscale (barème et cotisations) sera chargée ' +
                               'automatiquement à la sauvegarde.'
                      })()}
                    </div>
                  )}
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>
                    <Hash size={14} /> Préfixe matricules
                  </label>
                  <input
                    type="text"
                    value={formData.matricule_prefix}
                    onChange={(e) => setFormData({ ...formData, matricule_prefix: e.target.value.toUpperCase().slice(0, 5) })}
                    style={styles.formInput}
                    placeholder="Ex: TS"
                    maxLength={5}
                  />
                  <span style={styles.formHint}>
                    Format : {formData.matricule_prefix || 'XXX'}-0001, {formData.matricule_prefix || 'XXX'}-0002...
                  </span>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}><Mail size={14} /> Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={styles.formInput}
                      placeholder="contact@entreprise.com"
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}><Phone size={14} /> Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={styles.formInput}
                      placeholder="+221 33 000 00 00"
                    />
                  </div>
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}><MapPin size={14} /> Adresse</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    style={{ ...styles.formInput, minHeight: '80px', resize: 'vertical' }}
                    placeholder="Adresse complète..."
                  />
                </div>

                {editingEntreprise && (
                  <div style={styles.formField}>
                    <label style={styles.formLabel}><Hash size={14} /> Code entreprise</label>
                    <input
                      type="text"
                      value={formData.code}
                      disabled
                      style={{ ...styles.formInput, opacity: 0.5, cursor: 'not-allowed' }}
                    />
                  </div>
                )}
              </div>

              <div style={styles.formModalFooter}>
                <button onClick={() => setShowModal(false)} style={styles.modalCancelBtn}>Annuler</button>
                <button onClick={handleSave} style={styles.modalSaveBtn} disabled={uploading}>
                  {uploading ? 'Upload en cours...' : (
                    <>
                      <Save size={16} />
                      {editingEntreprise ? 'Enregistrer' : "Créer l'entreprise"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const styles = {
  container: {
    minHeight: '100vh', background: '#0A0A0F',
    position: 'relative', overflow: 'hidden',
  },
  bgPattern: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 25% 25%, rgba(245, 158, 11, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)
    `,
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb1: {
    position: 'fixed', top: '-15%', right: '-10%',
    width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed', bottom: '-20%', left: '-10%',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.03) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },

  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    background: '#0A0A0F',
  },
  loadingIconWrap: {
    position: 'relative',
    width: '90px',
    height: '90px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingPulseRing: {
    position: 'absolute',
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    border: '2px solid rgba(245, 158, 11, 0.25)',
    animation: 'pulseRing 1.8s ease-out infinite',
  },
  loadingPulse: { animation: 'float 2s ease-in-out infinite' },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px' },
  loadingBar: {
    width: '220px', height: '3px', background: 'rgba(245,158,11,0.1)',
    borderRadius: '3px', overflow: 'hidden',
  },
  loadingBarFill: {
    width: '40%', height: '100%',
    background: 'linear-gradient(90deg, #F59E0B, #D97706)',
    borderRadius: '3px', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%',
  },

  header: {
    background: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(245, 158, 11, 0.12)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerInner: {
    maxWidth: '1400px', margin: '0 auto', padding: '12px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
    borderRadius: '10px', padding: '8px', color: '#F59E0B', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  logoMark: {
    width: '38px', height: '38px', borderRadius: '10px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF', fontSize: '18px', fontWeight: '700',
    letterSpacing: '3px', margin: 0, lineHeight: '1.2',
  },
  headerSub: {
    color: '#F59E0B', fontSize: '10px', letterSpacing: '3px',
    textTransform: 'uppercase', fontWeight: '500',
  },
  addBtnHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', padding: '10px 20px', borderRadius: '12px',
    border: 'none', fontWeight: '700', fontSize: '14px',
    cursor: 'pointer', transition: 'all 0.3s ease', letterSpacing: '0.5px',
  },

  main: {
    padding: '20px', maxWidth: '1400px', margin: '0 auto',
    position: 'relative', zIndex: 1,
  },

  summaryStrip: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(20, 20, 35, 0.7)', backdropFilter: 'blur(10px)',
    borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)',
    padding: '16px 24px', marginBottom: '20px', flexWrap: 'wrap', gap: '0',
  },
  summaryCard: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '4px 20px', flex: '1 1 auto', justifyContent: 'center', minWidth: '100px',
  },
  summaryDivider: { width: '1px', height: '32px', background: 'rgba(255,255,255,0.08)' },
  summaryIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  summaryInfo: { display: 'flex', flexDirection: 'column' },
  summaryNumber: { color: '#FFFFFF', fontSize: '22px', fontWeight: '700', lineHeight: '1' },
  summaryLabel: {
    color: '#666', fontSize: '11px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px',
  },

  toolbar: {
    display: 'flex', gap: '12px', marginBottom: '20px',
    flexWrap: 'wrap', alignItems: 'center',
  },
  searchContainer: {
    flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 16px', borderRadius: '14px', transition: 'all 0.3s ease',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none', fontSize: '14px',
    background: 'transparent', color: '#E5E5E5', fontFamily: 'inherit',
  },
  clearSearch: {
    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px',
    padding: '4px', cursor: 'pointer', color: '#888',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  resultCount: { display: 'flex', alignItems: 'baseline', gap: '6px' },
  resultNumber: { color: '#F59E0B', fontSize: '20px', fontWeight: '700' },
  resultText: { color: '#666', fontSize: '12px' },

  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: {
    textAlign: 'center', padding: '80px 20px',
    background: 'rgba(20, 20, 35, 0.5)', borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  emptyIcon: {
    width: '80px', height: '80px', borderRadius: '20px',
    background: 'rgba(245, 158, 11, 0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 24px auto',
  },
  emptyTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' },
  emptySubtitle: { color: '#666', fontSize: '14px', margin: '0 0 24px 0' },
  emptyAddBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', padding: '12px 24px', borderRadius: '12px',
    border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
    transition: 'all 0.3s ease',
  },

  entCard: {
    background: 'rgba(20, 20, 35, 0.7)', backdropFilter: 'blur(10px)',
    borderRadius: '18px', border: '1px solid rgba(255,255,255,0.06)',
    padding: 'clamp(14px, 3vw, 20px)', position: 'relative', overflow: 'hidden',
  },
  cardGlowLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
  },
  cardMainRow: {
    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
  },
  entLogo: {
    width: '52px', height: '52px', borderRadius: '14px',
    background: 'rgba(245, 158, 11, 0.06)',
    border: '2px solid', display: 'flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  entLogoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  entInfo: { flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
  entNameRow: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
  },
  entName: { color: '#FFFFFF', fontWeight: '700', fontSize: '16px' },
  licenseBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 10px', borderRadius: '8px', fontSize: '10px',
    fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase',
    border: '1px solid',
  },
  entMetaRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  entMeta: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    color: '#888', fontSize: '12px',
  },
  entEmail: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    color: '#666', fontSize: '11px',
  },
  modulesChips: { marginTop: '4px' },
  modulesCountBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '8px', fontSize: '10px',
    fontWeight: '700', color: '#F59E0B', letterSpacing: '0.3px',
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
  },
  entStats: {
    display: 'flex', gap: '16px', flexShrink: 0,
  },
  entStatItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
  },
  entStatNumber: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700' },
  entStatLabel: { color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  entActions: { display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' },
  entActionBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '9px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease', color: '#888',
  },
  entDeleteBtn: {
    borderColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444',
  },

  expandedSection: {
    marginTop: '14px',
  },
  expandDivider: {
    height: '1px', background: 'rgba(255,255,255,0.06)',
    marginBottom: '16px',
  },
  expandGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    gap: '16px', marginBottom: '12px',
  },
  expandBlock: {
    background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
    padding: '14px', border: '1px solid rgba(255,255,255,0.04)',
  },
  expandBlockTitle: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: '#FFFFFF', fontSize: '13px', fontWeight: '700',
    marginBottom: '12px', margin: '0 0 12px 0',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  expandDetail: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  expandLabel: { color: '#666', fontSize: '12px' },
  expandValue: { color: '#E5E5E5', fontSize: '13px', fontWeight: '500' },
  expandModulesGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
  },
  expandModuleItem: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0',
  },
  expandModuleName: { fontSize: '12px', fontWeight: '500' },
  colorPreviewRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 14px', background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)',
  },

  footer: { marginTop: '48px', paddingBottom: '24px' },
  footerLine: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.2), transparent)',
    marginBottom: '20px',
  },
  footerText: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', color: '#555', fontSize: '12px', letterSpacing: '2px',
  },

  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 1000,
  },
  confirmModal: {
    background: '#141423', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px', width: '100%', maxWidth: '420px',
    padding: 'clamp(24px, 5vw, 36px)', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalIconWrap: {
    width: '64px', height: '64px', borderRadius: '18px',
    background: 'rgba(239, 68, 68, 0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px auto',
  },
  confirmTitle: {
    fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '12px',
  },
  confirmText: {
    color: '#888', marginBottom: '28px', lineHeight: '1.6', fontSize: '14px',
  },
  confirmBtns: { display: 'flex', gap: '12px' },
  modalCancelBtn: {
    flex: 1, padding: '14px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5',
    borderRadius: '14px', fontWeight: '600', fontSize: '14px',
    cursor: 'pointer', transition: 'all 0.2s ease',
  },
  modalDeleteBtn: {
    flex: 1, padding: '14px',
    background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    color: '#FFF', border: 'none', borderRadius: '14px',
    fontWeight: '700', fontSize: '14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    transition: 'all 0.2s ease',
  },

  formModal: {
    background: '#0F0F19', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px', width: '100%', maxWidth: '680px',
    maxHeight: '90vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
  },
  formModalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  formModalTitleWrap: { display: 'flex', alignItems: 'center', gap: '14px' },
  formModalIcon: {
    width: '42px', height: '42px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  formModalTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700', margin: 0 },
  formModalSub: { color: '#666', fontSize: '12px', marginTop: '2px', display: 'block' },
  formCloseBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '8px', color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  formModalBody: {
    padding: '24px', overflow: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  formModalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '12px',
    padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  modalSaveBtn: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000', border: 'none', borderRadius: '12px',
    fontWeight: '700', fontSize: '14px', cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  logoUploadSection: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '10px', marginBottom: '8px',
  },
  logoUploadBox: {
    width: '90px', height: '90px', borderRadius: '18px',
    background: 'rgba(245, 158, 11, 0.06)',
    border: '2px dashed rgba(245, 158, 11, 0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    transition: 'all 0.2s ease',
  },
  logoUploadImg: { width: '100%', height: '100%', objectFit: 'cover' },
  logoUploadPlaceholder: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  logoUploadText: { fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' },
  logoUploadOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.6)', padding: '6px',
    display: 'flex', justifyContent: 'center',
  },
  logoRemoveBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'none', border: 'none', color: '#EF4444',
    fontSize: '12px', cursor: 'pointer', fontWeight: '600',
  },

  formField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  formLabel: {
    fontSize: '12px', fontWeight: '600', color: '#888',
    display: 'flex', alignItems: 'center', gap: '6px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  formHint: { fontSize: '11px', color: '#555', marginTop: '2px' },
  formInput: {
    padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '14px', outline: 'none',
    transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', color: '#E5E5E5', fontFamily: 'inherit',
  },
  formSelect: {
    padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '14px', outline: 'none',
    background: 'rgba(255,255,255,0.04)', color: '#E5E5E5',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer',
  },
  colorPickerRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  colorInput: {
    width: '44px', height: '44px', padding: '0', border: 'none',
    cursor: 'pointer', borderRadius: '10px', background: 'transparent',
  },
  colorValue: {
    color: '#888', fontSize: '13px', fontFamily: 'monospace', minWidth: '70px',
  },

  // ✅ AUTO-CLOSE
  autoCloseSection: {
    padding: '20px',
    background: 'rgba(99, 102, 241, 0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(99, 102, 241, 0.12)',
  },
  autoCloseToggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    cursor: 'pointer',
  },
  autoCloseToggleLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  autoCloseToggleIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(99,102,241,0.12)',
    flexShrink: 0,
  },
  formHintBox: {
    marginTop: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  formHintStrong: {
    color: '#F59E0B',
    fontSize: '12px',
    fontWeight: '700',
  },
  formHintText: {
    color: '#888',
    fontSize: '12px',
  },

  modulesFormSection: {
    padding: '20px', background: 'rgba(245, 158, 11, 0.03)',
    borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.1)',
  },
  modulesSectionHeader: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
  },
  modulesSectionTitle: {
    color: '#FFFFFF', fontSize: '15px', fontWeight: '700',
    margin: 0, letterSpacing: '0.5px',
  },
  groupeOptions: {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '6px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#F59E0B',
  },
  groupeOptionsCompte: {
    fontSize: '11px',
    fontWeight: '500',
    letterSpacing: '0.02em',
    textTransform: 'none',
    color: '#6B6B6B',
  },
  moduleTogglesGrid: {
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  moduleToggle: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px', borderRadius: '12px',
    border: '1px solid', cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  moduleToggleIcon: {
    width: '34px', height: '34px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  moduleToggleInfo: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0,
  },
  moduleToggleName: { color: '#FFFFFF', fontSize: '13px', fontWeight: '600' },
  moduleToggleDesc: { color: '#666', fontSize: '11px' },
  toggleSwitch: { position: 'relative', flexShrink: 0 },
  toggleInput: {
    position: 'absolute', opacity: 0, width: 0, height: 0,
  },
  toggleTrack: {
    width: '38px', height: '20px', borderRadius: '10px',
    cursor: 'pointer', transition: 'background 0.3s ease',
    position: 'relative',
  },
  toggleThumb: {
    width: '16px', height: '16px', borderRadius: '50%',
    background: '#FFFFFF', position: 'absolute', top: '2px',
    transition: 'transform 0.3s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
}