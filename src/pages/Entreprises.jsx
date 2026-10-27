// ═══════════════════════════════════════════════════════════
// 🎨 ENTREPRISES — la toile peinte de Korhogo
//
// Le registre des entreprises tient dans un seul écran : la
// liste des entreprises (une carte = un cadre peint), un panneau de
// chiffres à droite, et le formulaire dans un carton de toile.
//
// ⚠️ Aucune donnée, aucune règle métier n'a bougé : mêmes
//    requêtes, mêmes champs, même chargement fiscal du pays à
//    la création, même suppression douce. Seul l'habillage est
//    neuf — et les boîtes de dialogue du navigateur ont laissé la place
//    à des avis intégrés à la page.
// ═══════════════════════════════════════════════════════════

import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CalendarOff,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Edit,
  FileText,
  Globe,
  Hash,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Palette,
  PenTool,
  Phone,
  Plus,
  QrCode,
  Radio,
  Save,
  Search,
  Shield,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import TaxationService from '../services/taxationService'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import { KorhogoBlasonSvg } from '../components/KorhogoSvg'
import ChargementEntreprises from '../components/ChargementEntreprises'
import './Entreprises.css'

// ── Les modules qu'une entreprise peut allumer ──────────────
// Les clés sont celles de la base : elles ne changent pas. Seuls
// les libellés ont été remis en français courant.
const MODULES = [
  // Le pointage
  { key: 'module_qr_scanner', icon: QrCode, name: 'Scanner QR', desc: 'Pointage par scan de badge', groupe: 'Le pointage' },
  { key: 'module_photo_pointage', icon: Camera, name: 'Photo au pointage', desc: 'Capture photo anti-fraude', groupe: 'Le pointage' },
  { key: 'module_modification_pointages', icon: PenTool, name: 'Correction des pointages', desc: 'Modifier, avec traçabilité', groupe: 'Le pointage' },
  { key: 'module_pointeuses', icon: Radio, name: 'Pointeuses du réseau', desc: 'Machines à badge reliées', groupe: 'Le pointage' },
  { key: 'module_poste_pointage', icon: Monitor, name: 'Poste de pointage', desc: 'Tablette laissée à l’entrée', groupe: 'Le pointage' },

  // La sécurité
  { key: 'module_geolocalisation', icon: MapPin, name: 'Zones autorisées', desc: 'Périmètre GPS du site', groupe: 'La sécurité' },
  { key: 'module_carte_temps_reel', icon: Activity, name: 'Carte en temps réel', desc: 'Position des équipes, en direct', groupe: 'La sécurité' },
  { key: 'module_reconnaissance_faciale', icon: Users, name: 'Reconnaissance faciale', desc: 'Pointage par le visage', groupe: 'La sécurité' },

  // L'organisation
  { key: 'module_planning', icon: Calendar, name: 'Planning', desc: 'Horaires de travail', groupe: 'L’organisation' },
  { key: 'module_retards', icon: AlertTriangle, name: 'Retards', desc: 'Statistiques et alertes', groupe: 'L’organisation' },
  { key: 'module_heures_supplementaires', icon: Clock, name: 'Heures supplémentaires', desc: 'Calcul auto et majorations', groupe: 'L’organisation' },
  { key: 'module_conges', icon: CalendarOff, name: 'Congés et absences', desc: 'Demandes et soldes', groupe: 'L’organisation' },
  { key: 'module_taches', icon: FileText, name: 'Tâches', desc: 'Équipes, suivi et preuves', groupe: 'L’organisation' },
  { key: 'module_predictions', icon: TrendingUp, name: 'Prévisions', desc: 'Anticipation de la charge', groupe: 'L’organisation' },
  { key: 'module_espace_employe', icon: Users, name: 'Espace employé', desc: 'Portail en libre-service', groupe: 'L’organisation' },

  // La paie
  { key: 'module_fiches_paie', icon: CreditCard, name: 'Fiches de paie', desc: 'Bulletins et variables', groupe: 'La paie' },
  { key: 'module_remunerations', icon: Wallet, name: 'Rémunérations', desc: 'Contrat, base, taux, indemnités', groupe: 'La paie' },
  { key: 'module_cout_salarial', icon: TrendingUp, name: 'Coût salarial', desc: 'Coût de l’heure et du mois, dans Rémunérations', groupe: 'La paie' },
  { key: 'module_config_fiscale', icon: Shield, name: 'Configuration fiscale', desc: 'Cotisations et barème du pays', groupe: 'La paie' },

  // Les alertes
  { key: 'module_alertes_telephone', icon: Smartphone, name: 'Alertes sur téléphone', desc: 'Sans ouvrir l’application', groupe: 'Les alertes' },
  { key: 'module_alertes_courrier', icon: Mail, name: 'Alertes par courrier', desc: 'Aux responsables', groupe: 'Les alertes' },

  // Les rapports
  { key: 'module_rapports_avances', icon: FileText, name: 'Rapports avancés', desc: 'PDF et Excel détaillés', groupe: 'Les rapports' },
]

const GROUPES = [...new Set(MODULES.map((m) => m.groupe))]

const LICENCES = {
  basic: { label: 'Basic', detail: 'Gratuit' },
  premium: { label: 'Premium', detail: 'Abonnement' },
  enterprise: { label: 'Enterprise', detail: 'Sur mesure' },
}

const VIDE = {
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

  // la fermeture automatique des pointages
  auto_close_enabled: false,
  auto_close_time: '23:59',
  auto_close_grace_minutes: 0,

  ...Object.fromEntries(MODULES.map((m) => [m.key, false])),
}

// ── Le formulaire d'une entreprise, pré-rempli ou vierge ────
function depuisEntreprise(entreprise) {
  if (!entreprise) return { ...VIDE }
  return {
    name: entreprise.name || '',
    code: entreprise.code || '',
    email: entreprise.email || '',
    phone: entreprise.phone || '',
    address: entreprise.address || '',
    sector: entreprise.sector || '',
    country_code: entreprise.country_code || '',
    matricule_prefix: entreprise.matricule_prefix || '',
    primary_color: entreprise.primary_color || '#D4AF37',
    logo_url: entreprise.logo_url || '',
    license_type: entreprise.license_type || 'basic',
    auto_close_enabled: Boolean(entreprise.auto_close_enabled),
    auto_close_time: entreprise.auto_close_time || '23:59',
    auto_close_grace_minutes: entreprise.auto_close_grace_minutes ?? 0,
    ...Object.fromEntries(MODULES.map((m) => [m.key, Boolean(entreprise[m.key])])),
  }
}

const modulesActifs = (ent) => MODULES.filter((m) => ent[m.key]).length

const tolerance = (minutes) => {
  const valeur = Number(minutes || 0)
  if (valeur <= 0) return 'Aucune tolérance'
  return `${valeur} min de tolérance`
}

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
  const [avis, setAvis] = useState(null)
  const [paysDisponibles, setPaysDisponibles] = useState([])
  const [formData, setFormData] = useState({ ...VIDE })
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const { darkMode, toggleTheme } = useTheme()

  // Échap referme le carton ouvert — comme une fenêtre de dialogue.
  useEffect(() => {
    if (!showModal && !showDeleteConfirm) return undefined
    const auClavier = (e) => {
      if (e.key !== 'Escape') return
      if (showDeleteConfirm) setShowDeleteConfirm(null)
      else setShowModal(false)
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [showModal, showDeleteConfirm])

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
    loadData({ dureeMin: 650 })
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

  // ⚠️ `dureeMin` : la scène de chargement se joue en deux temps.
  //    Si les données arrivent plus vite que le premier temps, on
  //    verrait une image clignoter — on tient donc l'écran le temps
  //    qu'une personne puisse lire la scène.
  //    `silencieux` : après un enregistrement, on recharge en
  //    arrière-plan sans renvoyer la page entière au chargement.
  const loadData = async ({ silencieux = false, dureeMin = 0 } = {}) => {
    const debut = Date.now()
    if (!silencieux) setLoading(true)
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
    if (!silencieux) {
      const reste = dureeMin - (Date.now() - debut)
      if (reste > 0) await new Promise((r) => setTimeout(r, reste))
      setLoading(false)
    }
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
      setAvis({ ton: 'erreur', texte: 'Choisissez une image : JPG, PNG ou WebP.' })
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvis({ ton: 'erreur', texte: 'Cette image dépasse 5 Mo. Allégez-la avant de la déposer.' })
      e.target.value = ''
      return
    }

    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
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
    setFormData({ ...VIDE })
    setEditingEntreprise(null)
    setLogoPreview(null)
    setLogoFile(null)
    setAvis(null)
    setShowModal(true)
  }

  const handleEdit = (entreprise) => {
    setFormData(depuisEntreprise(entreprise))
    setEditingEntreprise(entreprise)
    setLogoPreview(entreprise.logo_url || null)
    setLogoFile(null)
    setAvis(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.name) {
        setAvis({ ton: 'erreur', texte: 'Le nom de l’entreprise est obligatoire.' })
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
        currency:
          paysDisponibles.find((x) => x.country_code === formData.country_code)?.currency || null,
        matricule_prefix: formData.matricule_prefix || matricule_prefix,
        primary_color: formData.primary_color || '#D4AF37',
        logo_url: logoUrl || null,
        license_type: formData.license_type,

        auto_close_enabled: formData.auto_close_enabled,
        auto_close_time: formData.auto_close_time || '23:59',
        auto_close_grace_minutes: Number(formData.auto_close_grace_minutes || 0),

        ...Object.fromEntries(MODULES.map((m) => [m.key, Boolean(formData[m.key])])),
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
          setAvis({
            ton: 'erreur',
            texte:
              'Entreprise enregistrée, mais la configuration fiscale du pays n’a pas pu être '
              + 'chargée : ' + res.error,
          })
        }
      }

      setShowModal(false)
      setLogoFile(null)
      setLogoPreview(null)
      loadData({ silencieux: true })
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setAvis({ ton: 'erreur', texte: 'L’enregistrement a échoué. Réessayez.' })
    }
  }

  const handleDelete = async (entreprise) => {
    const employeesCount = entreprise.employees?.[0]?.count || 0
    if (employeesCount > 0) {
      setAvis({
        ton: 'erreur',
        texte: `Suppression impossible : ${employeesCount} employé${employeesCount > 1 ? 's' : ''} `
          + `travaille${employeesCount > 1 ? 'nt' : ''} encore dans ${entreprise.name}.`,
      })
      setShowDeleteConfirm(null)
      return
    }

    try {
      await supabase.from('enterprises').update({ is_active: false }).eq('id', entreprise.id)
      setShowDeleteConfirm(null)
      setAvis({ ton: 'succes', texte: `${entreprise.name} a été retirée du registre.` })
      loadData({ silencieux: true })
    } catch (error) {
      console.error('Erreur suppression:', error)
      setAvis({ ton: 'erreur', texte: 'La suppression a échoué. Réessayez.' })
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setFormData({ ...formData, logo_url: '' })
  }

  const entreprisesFiltrees = entreprises.filter((ent) => {
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
      matricule_prefix: editingEntreprise ? formData.matricule_prefix : prefix,
    })
  }

  const paysChoisi = paysDisponibles.find((x) => x.country_code === formData.country_code)
  const sansBareme =
    paysChoisi && (!paysChoisi.default_tax_brackets || paysChoisi.default_tax_brackets.length === 0)

  const totalEmployes = entreprises.reduce((s, e) => s + (e.employees?.[0]?.count || 0), 0)
  const totalPointages = entreprises.reduce((s, e) => s + (e.attendances?.[0]?.count || 0), 0)
  const totalModules = entreprises.reduce((s, e) => s + modulesActifs(e), 0)

  if (loading) {
    return (
      <div className={`en-page ${darkMode ? 'en-dark' : ''}`}>
        <PageCulturalBand pathname="/entreprises" />
        <div className="en-bordure" aria-hidden="true" />
        <div className="en-chargement" role="status">
          <ChargementEntreprises />
          <span className="ch-etapes" aria-hidden="true">
            <span className="ch-etape ch-etape--1">Étape 1 · La paperasse</span>
            <span className="ch-etape ch-etape--2">Étape 2 · Le carton s’allume</span>
          </span>
          <p className="en-chargement-texte">Chargement des entreprises…</p>
        </div>
      </div>
    )
  }

  return (
    <main className={`en-page ${darkMode ? 'en-dark' : ''}`}>
      <PageCulturalBand pathname="/entreprises" />
      <div className="en-bordure" aria-hidden="true" />

      <div className="en-shell">
        <header className="en-entete">
          <div className="en-titre-bloc">
            <KorhogoBlasonSvg size={54} />
            <div>
              <span className="en-eyebrow">Le registre des entreprises</span>
              <h1 className="en-titre">
                Entreprises<span>.</span>
              </h1>
              <p className="en-sous-titre">
                Chaque fiche réunit une entreprise : ses employés, ses pointages, ses modules.
              </p>
            </div>
          </div>

          <div className="en-entete-actions">
            <button
              type="button"
              className="en-bascule"
              role="switch"
              aria-checked={darkMode}
              onClick={toggleTheme}
              aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
              title={darkMode ? 'Thème clair' : 'Thème sombre'}
            >
              {darkMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button type="button" className="en-bouton-creux" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={14} />
              Tableau de bord
            </button>
            <button type="button" className="en-bouton" onClick={handleAdd}>
              <Plus size={15} />
              Nouvelle entreprise
            </button>
          </div>
        </header>

        <div className="en-raccourcis">
          <span className="en-raccourcis-libelle">Aller à</span>
          <RaccourcisPages compact excludePaths={['/entreprises']} />
        </div>

        <div className="en-corps">
          <div className="en-colonne">
            {avis && (
              <p className="en-avis" role="status" data-ton={avis.ton}>
                {avis.ton === 'succes' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>{avis.texte}</span>
              </p>
            )}

            <div className="en-outils">
              <div className="en-recherche">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Nom, code, secteur, email…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Rechercher une entreprise"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="en-effacer"
                    onClick={() => setSearchTerm('')}
                    aria-label="Effacer la recherche"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="en-compteur">
                <strong>{entreprisesFiltrees.length}</strong>
                <span>
                  {searchTerm ? `sur ${entreprises.length} ` : ''}
                  {entreprisesFiltrees.length > 1 ? 'entreprises' : 'entreprise'}
                </span>
              </div>
            </div>

            <div className="en-liste">
              {entreprisesFiltrees.length === 0 ? (
                <div className="en-vide">
                  <KorhogoBlasonSvg size={46} />
                  <h3>{searchTerm ? 'Aucune entreprise dans ce cadre' : 'Aucune entreprise pour l’instant'}</h3>
                  <p>
                    {searchTerm
                      ? 'Aucun nom, code, secteur ou email ne correspond à cette recherche.'
                      : 'Créez votre première entreprise : elle recevra son code, son préfixe de matricules et son pays fiscal.'}
                  </p>
                  {searchTerm ? (
                    <button type="button" className="en-bouton-creux" onClick={() => setSearchTerm('')}>
                      <X size={14} />
                      Effacer la recherche
                    </button>
                  ) : (
                    <button type="button" className="en-bouton" onClick={handleAdd}>
                      <Plus size={15} />
                      Créer une entreprise
                    </button>
                  )}
                </div>
              ) : (
                entreprisesFiltrees.map((entreprise) => (
                  <CarteEntreprise
                    key={entreprise.id}
                    entreprise={entreprise}
                    ouverte={expandedCard === entreprise.id}
                    peutSupprimer={admin?.role === 'super_admin'}
                    onBasculer={() =>
                      setExpandedCard(expandedCard === entreprise.id ? null : entreprise.id)
                    }
                    onAdmins={() => navigate(`/admins?enterprise=${entreprise.id}`)}
                    onModifier={() => handleEdit(entreprise)}
                    onSupprimer={() => setShowDeleteConfirm(entreprise)}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="en-colonne" aria-label="Chiffres du registre">
            <section className="en-panneau en-panneau--mesures">
              <h2 className="en-panneau-titre">
                <Zap size={12} />
                En résumé
              </h2>
              <div className="en-mesure">
                <span>Entreprises</span>
                <b>{entreprises.length}</b>
              </div>
              <div className="en-mesure">
                <span>Employés</span>
                <b>{totalEmployes}</b>
              </div>
              <div className="en-mesure">
                <span>Pointages</span>
                <b>{totalPointages}</b>
              </div>
            </section>

            <section className="en-panneau">
              <h2 className="en-panneau-titre">
                <Shield size={12} />
                Les licences
              </h2>
              {Object.entries(LICENCES).map(([cle, { label, detail }]) => (
                <div className="en-mesure" key={cle}>
                  <span>
                    {label} <em style={{ fontStyle: 'normal' }}>· {detail}</em>
                  </span>
                  <b style={{ fontSize: 13 }}>
                    {entreprises.filter((e) => (e.license_type || 'basic') === cle).length}
                  </b>
                </div>
              ))}
              <details className="en-note-pli">
                <summary>{totalModules} modules allumés</summary>
                <p>
                  Chaque module coché dans une fiche est facturé à cette entreprise. Les six groupes
                  sont : le pointage, la sécurité, l’organisation, la paie, les alertes et les
                  rapports.
                </p>
              </details>
            </section>

            <section className="en-panneau">
              <h2 className="en-panneau-titre">
                <Globe size={12} />
                Le pays d’abord
              </h2>
              <p className="en-note">
                Une entreprise sans pays n’a ni barème ni cotisations : son impôt sort à zéro sans
                que rien ne le signale. Le pays choisi charge sa configuration fiscale dès
                l’enregistrement.
              </p>
              <details className="en-note-pli">
                <summary>Ce qui est chargé</summary>
                <p>
                  Les tranches d’impôt du référentiel et les cotisations sociales du pays. Une
                  configuration réglée à la main n’est jamais écrasée tant que le pays ne change
                  pas.
                </p>
              </details>
            </section>
          </aside>
        </div>
      </div>

      {/* le fil de clôture, comme sur les autres pages */}
      <div className="en-pied">
        <PageCulturalBand pathname="/entreprises" placement="bottom" />
      </div>

      {showDeleteConfirm && (
        <div className="en-voile" role="presentation" onClick={() => setShowDeleteConfirm(null)}>
          <div
            className="en-carton en-carton--etroit"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="en-confirme-titre"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="en-carton-tete">
              <AlertTriangle size={18} color="var(--en-alerte)" />
              <div>
                <h2 id="en-confirme-titre">Retirer cette entreprise ?</h2>
                <p>Elle quittera le registre, ses données restent.</p>
              </div>
              <button
                type="button"
                className="en-carton-fermer"
                onClick={() => setShowDeleteConfirm(null)}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="en-carton-corps">
              <div className="en-confirmation">
                <Trash2 size={16} color="var(--en-alerte)" />
                <p>
                  <strong>{showDeleteConfirm.name}</strong>
                  <br />
                  {(showDeleteConfirm.employees?.[0]?.count || 0) > 0 ? (
                    <em>
                      {showDeleteConfirm.employees[0].count} employé
                      {showDeleteConfirm.employees[0].count > 1 ? 's' : ''} encore rattaché
                      {showDeleteConfirm.employees[0].count > 1 ? 's' : ''} — la suppression est
                      impossible.
                    </em>
                  ) : (
                    <em>Cette action ne peut pas être annulée depuis cet écran.</em>
                  )}
                </p>
              </div>
            </div>

            <div className="en-carton-pied">
              <button
                type="button"
                className="en-bouton-creux"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Garder
              </button>
              <button
                type="button"
                className="en-bouton-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={(showDeleteConfirm.employees?.[0]?.count || 0) > 0}
              >
                <Trash2 size={14} />
                Retirer du registre
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="en-voile" role="presentation">
          <div
            className="en-carton"
            role="dialog"
            aria-modal="true"
            aria-labelledby="en-form-titre"
          >
            <div className="en-carton-tete">
              <KorhogoBlasonSvg size={34} />
              <div>
                <h2 id="en-form-titre">
                  {editingEntreprise ? 'Modifier l’entreprise' : 'Nouvelle entreprise'}
                </h2>
                <p>
                  {editingEntreprise
                    ? `Modification de ${editingEntreprise.name}`
                    : 'Nom, pays et licence suffisent pour commencer.'}
                </p>
              </div>
              <button
                type="button"
                className="en-carton-fermer"
                onClick={() => setShowModal(false)}
                aria-label="Fermer le formulaire"
              >
                <X size={15} />
              </button>
            </div>

            <div className="en-carton-corps">
              {avis && (
                <p className="en-avis" role="alert" data-ton={avis.ton}>
                  <AlertTriangle size={14} />
                  <span>{avis.texte}</span>
                </p>
              )}

              {/* — 1. L'identité — */}
              <fieldset className="en-section">
                <legend>
                  <Building2 size={11} />
                  L’identité
                </legend>

                <div className="en-champs">
                  <div className="en-logo-champ">
                    <button
                      type="button"
                      className="en-logo-cadre"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Choisir le logo de l’entreprise"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="" />
                      ) : (
                        <Camera size={22} color="var(--en-encre-faible)" />
                      )}
                    </button>
                    <div className="en-logo-legende">
                      <strong>Le logo</strong>
                      <span>
                        JPG, PNG ou WebP, 5 Mo maximum. Il s’affiche dans le cadre, à gauche du nom.
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="en-bouton-creux"
                          style={{ minHeight: 28, fontSize: 10.5, padding: '0 10px' }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={12} />
                          {logoPreview ? 'Remplacer' : 'Choisir'}
                        </button>
                        {logoPreview && (
                          <button
                            type="button"
                            className="en-bouton-danger"
                            style={{ minHeight: 28, fontSize: 10.5, padding: '0 10px' }}
                            onClick={handleRemoveLogo}
                          >
                            <X size={12} />
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      style={{ display: 'none' }}
                    />
                  </div>

                  <div className="en-champ en-champ--large">
                    <label className="en-etiquette" htmlFor="en-nom">
                      Nom de l’entreprise <em>*</em>
                    </label>
                    <input
                      id="en-nom"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex. : Pharmacie Blanche Gomes"
                    />
                  </div>

                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-secteur">
                      <Globe size={11} />
                      Secteur
                    </label>
                    <input
                      id="en-secteur"
                      type="text"
                      value={formData.sector}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                      placeholder="Ex. : Banque, BTP, santé"
                    />
                  </div>

                  <div className="en-champ">
                    <span className="en-etiquette">
                      <Palette size={11} />
                      Couleur du badge
                    </span>
                    <div className="en-couleur">
                      <input
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) =>
                          setFormData({ ...formData, primary_color: e.target.value })
                        }
                        aria-label="Couleur du badge"
                      />
                      <code>{formData.primary_color}</code>
                      <i
                        aria-hidden="true"
                        style={{
                          background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.primary_color}88)`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* — 2. Les coordonnées — */}
              <fieldset className="en-section">
                <legend>
                  <Phone size={11} />
                  Les coordonnées
                </legend>
                <div className="en-champs">
                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-email">
                      <Mail size={11} />
                      Email
                    </label>
                    <input
                      id="en-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@entreprise.bj"
                    />
                  </div>
                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-tel">
                      <Phone size={11} />
                      Téléphone
                    </label>
                    <input
                      id="en-tel"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+229 01 97 00 00 00"
                    />
                  </div>
                  <div className="en-champ en-champ--large">
                    <label className="en-etiquette" htmlFor="en-adresse">
                      <MapPin size={11} />
                      Adresse
                    </label>
                    <textarea
                      id="en-adresse"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rue, quartier, ville…"
                    />
                  </div>
                </div>
              </fieldset>

              {/* — 3. Le pays et les matricules — */}
              <fieldset className="en-section">
                <legend>
                  <Globe size={11} />
                  Le pays et les matricules
                </legend>
                <div className="en-champs">
                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-pays">
                      Pays (fiscalité)
                    </label>
                    <select
                      id="en-pays"
                      value={formData.country_code}
                      onChange={(e) =>
                        setFormData({ ...formData, country_code: e.target.value })
                      }
                    >
                      <option value="">— Aucun pays —</option>
                      {paysDisponibles.map((p) => (
                        <option key={p.country_code} value={p.country_code}>
                          {p.country_name || p.country_code}
                          {!p.default_tax_brackets || p.default_tax_brackets.length === 0
                            ? ' — sans barème'
                            : ''}
                        </option>
                      ))}
                    </select>
                    {formData.country_code ? (
                      <span className="en-aide" data-ton={sansBareme ? 'alerte' : undefined}>
                        {sansBareme
                          ? 'Ce pays n’a pas de barème d’impôt : les salariés paieraient zéro impôt jusqu’à ce qu’on le renseigne.'
                          : 'Son barème et ses cotisations seront chargés automatiquement à l’enregistrement.'}
                      </span>
                    ) : (
                      <span className="en-aide" data-ton="alerte">
                        Sans pays, l’impôt de cette entreprise ne sera pas calculé.
                      </span>
                    )}
                  </div>

                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-prefixe">
                      <Hash size={11} />
                      Préfixe des matricules
                    </label>
                    <input
                      id="en-prefixe"
                      type="text"
                      value={formData.matricule_prefix}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          matricule_prefix: e.target.value.toUpperCase().slice(0, 5),
                        })
                      }
                      placeholder="Ex. : PBG"
                      maxLength={5}
                    />
                    <span className="en-aide">
                      Format : {formData.matricule_prefix || 'XXX'}-0001,{' '}
                      {formData.matricule_prefix || 'XXX'}-0002…
                    </span>
                  </div>

                  {editingEntreprise && (
                    <div className="en-champ en-champ--large">
                      <label className="en-etiquette" htmlFor="en-code">
                        Code de l’entreprise
                      </label>
                      <input id="en-code" type="text" value={formData.code} disabled />
                      <span className="en-aide">
                        Le code est attribué à la création et ne change plus : il sert de clé aux
                        badges et aux imports.
                      </span>
                    </div>
                  )}
                </div>
              </fieldset>

              {/* — 4. La fermeture automatique — */}
              <fieldset className="en-section">
                <legend>
                  <Timer size={11} />
                  La fermeture automatique
                </legend>

                <div className="en-interrupteur-ligne">
                  <span className="en-interrupteur-texte">
                    <strong>Fermer les pointages à l’heure dite</strong>
                    <span>
                      Une journée oubliée n’est plus comptée en heures supplémentaires.
                    </span>
                  </span>
                  <label className="en-interrupteur">
                    <input
                      type="checkbox"
                      checked={formData.auto_close_enabled}
                      onChange={(e) =>
                        setFormData({ ...formData, auto_close_enabled: e.target.checked })
                      }
                      aria-label="Fermer les pointages à l’heure dite"
                    />
                    <span className="en-piste" />
                  </label>
                </div>

                <div className="en-champs" style={{ marginTop: 10 }}>
                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-heure">
                      <Clock size={11} />
                      Heure de fermeture
                    </label>
                    <input
                      id="en-heure"
                      type="time"
                      value={formData.auto_close_time}
                      onChange={(e) =>
                        setFormData({ ...formData, auto_close_time: e.target.value })
                      }
                      disabled={!formData.auto_close_enabled}
                    />
                  </div>
                  <div className="en-champ">
                    <label className="en-etiquette" htmlFor="en-tolerance">
                      <Timer size={11} />
                      Tolérance (minutes)
                    </label>
                    <input
                      id="en-tolerance"
                      type="number"
                      min="0"
                      max="300"
                      value={formData.auto_close_grace_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          auto_close_grace_minutes: e.target.value,
                        })
                      }
                      placeholder="0"
                      disabled={!formData.auto_close_enabled}
                    />
                  </div>
                  <div className="en-champ en-champ--large">
                    <span className="en-aide">
                      {formData.auto_close_enabled
                        ? `Fermeture à ${formData.auto_close_time || '23:59'}${
                            Number(formData.auto_close_grace_minutes || 0) > 0
                              ? `, avec ${formData.auto_close_grace_minutes} min de tolérance`
                              : ''
                          }.`
                        : 'La fermeture automatique est désactivée pour cette entreprise.'}
                    </span>
                  </div>
                </div>
              </fieldset>

              {/* — 5. La licence et les modules — */}
              <fieldset className="en-section">
                <legend>
                  <Shield size={11} />
                  La licence et les modules
                </legend>

                <div className="en-champs">
                  <div className="en-champ en-champ--large">
                    <label className="en-etiquette" htmlFor="en-licence">
                      <CreditCard size={11} />
                      Type de licence
                    </label>
                    <select
                      id="en-licence"
                      value={formData.license_type}
                      onChange={(e) =>
                        setFormData({ ...formData, license_type: e.target.value })
                      }
                    >
                      <option value="basic">Basic — gratuit</option>
                      <option value="premium">Premium — abonnement</option>
                      <option value="enterprise">Enterprise — sur mesure</option>
                    </select>
                  </div>
                </div>

                {GROUPES.map((groupe) => {
                  const modules = MODULES.filter((m) => m.groupe === groupe)
                  const allumes = modules.filter((m) => formData[m.key]).length
                  return (
                    <Fragment key={groupe}>
                      <div className="en-sceaux-groupe">
                        <span>{groupe}</span>
                        <b>
                          {allumes} sur {modules.length}
                        </b>
                      </div>
                      <div className="en-sceaux">
                        {modules.map((mod) => {
                          const Icone = mod.icon
                          return (
                            <label className="en-sceau" key={mod.key}>
                              <input
                                type="checkbox"
                                checked={Boolean(formData[mod.key])}
                                onChange={(e) =>
                                  setFormData({ ...formData, [mod.key]: e.target.checked })
                                }
                              />
                              <span className="en-sceau-pastille" aria-hidden="true">
                                <Check size={11} strokeWidth={3.4} />
                              </span>
                              <span className="en-sceau-texte">
                                <b>
                                  <Icone size={10} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                                  {mod.name}
                                </b>
                                <span>{mod.desc}</span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </Fragment>
                  )
                })}
              </fieldset>
            </div>

            <div className="en-carton-pied">
              <button type="button" className="en-bouton-creux" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button type="button" className="en-bouton" onClick={handleSave} disabled={uploading}>
                <Save size={14} />
                {uploading
                  ? 'Envoi du logo…'
                  : editingEntreprise
                    ? 'Enregistrer'
                    : 'Créer l’entreprise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Une carte : un cadre peint sur la toile ────────────────
function CarteEntreprise({ entreprise, ouverte, peutSupprimer, onBasculer, onAdmins, onModifier, onSupprimer }) {
  const licence = LICENCES[entreprise.license_type] || LICENCES.basic
  const actifs = modulesActifs(entreprise)

  return (
    <article className="en-carte" data-ouvert={ouverte ? 'oui' : 'non'}>
      <div className="en-carte-tete">
        <div className="en-logo">
          {entreprise.logo_url ? (
            <img src={entreprise.logo_url} alt="" />
          ) : (
            <Building2 size={20} color={entreprise.primary_color || 'var(--en-terre)'} />
          )}
        </div>

        <div className="en-infos">
          <div className="en-nom-ligne">
            <span className="en-nom">{entreprise.name}</span>
            <span className="en-licence" data-licence={entreprise.license_type || 'basic'}>
              {licence.label}
            </span>
          </div>

          <div className="en-meta">
            {entreprise.sector && (
              <span>
                <Globe size={10} />
                {entreprise.sector}
              </span>
            )}
            <span>
              <Hash size={10} />
              <strong>{entreprise.code}</strong>
            </span>
            <span>
              <Hash size={10} />
              {entreprise.matricule_prefix || '—'}
            </span>
            {entreprise.email && (
              <span>
                <Mail size={10} />
                {entreprise.email}
              </span>
            )}
          </div>

          <span className="en-modules-pastille" data-vide={actifs === 0 ? 'oui' : 'non'}>
            <Zap size={10} />
            {actifs > 0
              ? `${actifs} module${actifs > 1 ? 's' : ''} allumé${actifs > 1 ? 's' : ''}`
              : 'Aucun module'}
          </span>
        </div>

        <div className="en-chiffres">
          <div className="en-chiffre">
            <b>{entreprise.employees?.[0]?.count || 0}</b>
            <span>empl.</span>
          </div>
          <div className="en-chiffre">
            <b>{entreprise.attendances?.[0]?.count || 0}</b>
            <span>point.</span>
          </div>
        </div>

        <div className="en-actions">
          <button
            type="button"
            className="en-action"
            data-actif={ouverte ? 'oui' : 'non'}
            onClick={onBasculer}
            title={ouverte ? 'Replier la fiche' : 'Déplier la fiche'}
            aria-expanded={ouverte}
            aria-label={ouverte ? `Replier ${entreprise.name}` : `Déplier ${entreprise.name}`}
          >
            {ouverte ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            type="button"
            className="en-action"
            onClick={onAdmins}
            title="Voir les administrateurs"
            aria-label={`Voir les administrateurs de ${entreprise.name}`}
          >
            <Shield size={14} />
          </button>
          <button
            type="button"
            className="en-action"
            onClick={onModifier}
            title="Modifier la fiche"
            aria-label={`Modifier ${entreprise.name}`}
          >
            <Edit size={14} />
          </button>
          {peutSupprimer && (
            <button
              type="button"
              className="en-action"
              data-ton="danger"
              onClick={onSupprimer}
              title="Retirer du registre"
              aria-label={`Retirer ${entreprise.name} du registre`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {ouverte && (
        <div className="en-detail">
          <div className="en-detail-grille">
            <div>
              <h4 className="en-bloc-titre">
                <Mail size={11} />
                Contact
              </h4>
              <div className="en-duo">
                <span>Email</span>
                <span>{entreprise.email || '—'}</span>
              </div>
              <div className="en-duo">
                <span>Téléphone</span>
                <span>{entreprise.phone || '—'}</span>
              </div>
              <div className="en-duo">
                <span>Adresse</span>
                <span>{entreprise.address || '—'}</span>
              </div>
            </div>

            <div>
              <h4 className="en-bloc-titre">
                <Timer size={11} />
                Fermeture auto.
              </h4>
              <div className="en-duo">
                <span>État</span>
                <span>{entreprise.auto_close_enabled ? 'Activée' : 'Désactivée'}</span>
              </div>
              <div className="en-duo">
                <span>Heure</span>
                <span>{entreprise.auto_close_time || '23:59'}</span>
              </div>
              <div className="en-duo">
                <span>Tolérance</span>
                <span>{tolerance(entreprise.auto_close_grace_minutes)}</span>
              </div>
              <div className="en-duo">
                <span>Pays fiscal</span>
                <span>{entreprise.country_code || '—'}</span>
              </div>
            </div>

            <div>
              <h4 className="en-bloc-titre">
                <Zap size={11} />
                Modules
              </h4>
              <div className="en-modules-liste">
                {MODULES.map((mod) => (
                  <span
                    className="en-module-etat"
                    key={mod.key}
                    data-actif={entreprise[mod.key] ? 'oui' : 'non'}
                  >
                    {entreprise[mod.key] ? (
                      <CheckCircle2 size={11} color="var(--en-ok)" />
                    ) : (
                      <XCircle size={11} color="var(--en-encre-faible)" />
                    )}
                    {mod.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="en-teinte">
            <span>Couleur du badge</span>
            <i style={{ background: entreprise.primary_color || '#D4AF37' }} />
            <code>{entreprise.primary_color || '#D4AF37'}</code>
          </div>
        </div>
      )}
    </article>
  )
}
