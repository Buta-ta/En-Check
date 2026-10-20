import { useEffect, useRef, useState } from 'react'
import {
  Award,
  Baby,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  CheckSquare,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Hash,
  Heart,
  Layers,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Radio,
  Shield,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import BadgeEmploye from './BadgeEmploye'
import {
  AdinkraWatermarkSvg,
  KenteWovenTapestrySvg,
  WovenKenteBadgeSvg,
} from './AfroCulturalSvg'
import '../pages/PointagesAfroTech.css'

async function hasherPinEmploye(pin) {
  const sel = 'EnCheck_2024_Secure'
  const contenu = `${sel}${pin}${sel}`
  const encoder = new TextEncoder()
  const data = encoder.encode(contenu)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function FicheEmployeModal({
  employee = null,
  mode,
  scheduleInfo = null,
  entreprises = [],
  defaultEnterpriseId = '',
  isSuperAdmin = false,
  canEdit = true,
  onClose,
  onSaved,
}) {
  const { darkMode = true } = useTheme() || { darkMode: true }
  const isCreate = mode === 'create' || !employee?.id
  const effectiveCanEdit = isCreate ? true : Boolean(canEdit)

  const [activeTab, setActiveTab] = useState('identite')
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingFullEmployee, setLoadingFullEmployee] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [enterpriseList, setEnterpriseList] = useState(entreprises)
  const [enterpriseMeta, setEnterpriseMeta] = useState(employee?.enterprises || null)

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(employee?.photo_url || null)
  const fileInputRef = useRef(null)
  const initialMachinePinRef = useRef(
    employee?.machine_pin != null ? String(employee.machine_pin) : ''
  )

  const [formData, setFormData] = useState(() => ({
    enterprise_id:
      employee?.enterprise_id ||
      defaultEnterpriseId ||
      entreprises?.[0]?.id ||
      '',
    matricule: employee?.matricule || '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    pin: '',
    machine_pin: employee?.machine_pin != null ? String(employee.machine_pin) : '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    department: employee?.department || '',
    position: employee?.position || '',
    photo_url: employee?.photo_url || '',
    date_of_birth: employee?.date_of_birth || '',
    place_of_birth: employee?.place_of_birth || '',
    nationality: employee?.nationality || '',
    gender: employee?.gender || '',
    marital_status: employee?.marital_status || '',
    dependents_count: employee?.dependents_count ?? 0,
    national_id_number: employee?.national_id_number || '',
    hire_date:
      employee?.hire_date ||
      (isCreate ? new Date().toISOString().split('T')[0] : ''),
    contract_type: employee?.contract_type || (isCreate ? 'CDI' : ''),
    contract_end_date: employee?.contract_end_date || '',
    professional_category: employee?.professional_category || '',
    echelon: employee?.echelon || '',
    classification: employee?.classification || '',
    cnps_number: employee?.cnps_number || '',
    tax_id_number: employee?.tax_id_number || '',
  }))

  // Charge la liste des entreprises si nécessaire (mode création Super Admin)
  useEffect(() => {
    if (entreprises && entreprises.length > 0) {
      setEnterpriseList(entreprises)
      return
    }
    let cancelled = false
    supabase
      .from('enterprises')
      .select('id, name, code, matricule_prefix, logo_url, primary_color')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data)) {
          setEnterpriseList(data)
        }
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [entreprises])

  // Charge la fiche complète depuis Supabase si l'objet passé est partiel (ex: depuis Pauses)
  useEffect(() => {
    if (isCreate || !employee?.id) return undefined
    let cancelled = false
    setLoadingFullEmployee(true)
    supabase
      .from('employees')
      .select('*, enterprises(id, name, code, matricule_prefix, logo_url, primary_color)')
      .eq('id', employee.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        initialMachinePinRef.current =
          data.machine_pin != null ? String(data.machine_pin) : ''
        if (data.enterprises) setEnterpriseMeta(data.enterprises)
        if (data.photo_url) setPhotoPreview(data.photo_url)
        setFormData((prev) => ({
          ...prev,
          enterprise_id: data.enterprise_id || prev.enterprise_id,
          matricule: data.matricule || prev.matricule,
          first_name: data.first_name ?? prev.first_name,
          last_name: data.last_name ?? prev.last_name,
          machine_pin:
            data.machine_pin != null ? String(data.machine_pin) : prev.machine_pin,
          email: data.email || '',
          phone: data.phone || '',
          department: data.department || '',
          position: data.position || '',
          photo_url: data.photo_url || '',
          date_of_birth: data.date_of_birth || '',
          place_of_birth: data.place_of_birth || '',
          nationality: data.nationality || '',
          gender: data.gender || '',
          marital_status: data.marital_status || '',
          dependents_count: data.dependents_count ?? 0,
          national_id_number: data.national_id_number || '',
          hire_date: data.hire_date || '',
          contract_type: data.contract_type || '',
          contract_end_date: data.contract_end_date || '',
          professional_category: data.professional_category || '',
          echelon: data.echelon || '',
          classification: data.classification || '',
          cnps_number: data.cnps_number || '',
          tax_id_number: data.tax_id_number || '',
        }))
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoadingFullEmployee(false)
      })
    return () => {
      cancelled = true
    }
  }, [isCreate, employee?.id])

  // Génère automatiquement le matricule en mode création quand l'entreprise change
  useEffect(() => {
    if (!isCreate) return undefined
    const targetEid = formData.enterprise_id || defaultEnterpriseId || enterpriseList?.[0]?.id
    if (!targetEid) return undefined
    let cancelled = false
    const ent = enterpriseList.find((e) => e.id === targetEid)
    const prefix = ent?.matricule_prefix || ent?.code || 'EMP'
    supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('enterprise_id', targetEid)
      .then(({ count }) => {
        if (cancelled) return
        const numero = ((count || 0) + 1).toString().padStart(4, '0')
        setFormData((prev) => ({
          ...prev,
          enterprise_id: targetEid,
          matricule: `${prefix}-${numero}`,
        }))
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [isCreate, formData.enterprise_id, defaultEnterpriseId, enterpriseList])

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image valide')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image est trop volumineuse (max 5 Mo)")
      return
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setPhotoPreview(null)
    setPhotoFile(null)
    setFormData((prev) => ({ ...prev, photo_url: '' }))
  }

  const uploadPhotoIfNeeded = async (matricule) => {
    if (!photoFile) return formData.photo_url || null
    const extension = photoFile.name.split('.').pop() || 'jpg'
    const safeMatricule = (matricule || 'emp').replace(/[^a-zA-Z0-9_-]/g, '')
    const fileName = `${safeMatricule}-${Date.now()}.${extension}`
    const { error } = await supabase.storage
      .from('photos')
      .upload(fileName, photoFile, { cacheControl: '3600', upsert: true })
    if (error) {
      console.error('Erreur upload photo:', error)
      return formData.photo_url || null
    }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
    return urlData?.publicUrl || formData.photo_url || null
  }

  const fullNameDisplay =
    `${formData.first_name || ''} ${formData.last_name || ''}`.trim() ||
    (isCreate ? 'Nouvel employé' : 'Employé')
  const initials =
    `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() ||
    'EC'

  const resolvedEnterprise =
    enterpriseList.find((e) => e.id === formData.enterprise_id) ||
    enterpriseMeta ||
    employee?.enterprises ||
    null
  const enterpriseName = resolvedEnterprise?.name || 'Entreprise En-Check'

  const handleSave = async (event) => {
    if (event) event.preventDefault()
    if (!effectiveCanEdit) return

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('Le prénom et le nom sont obligatoires')
      setActiveTab('identite')
      return
    }
    if (isCreate && !formData.pin.trim()) {
      toast.error('Le code PIN (4 chiffres) est obligatoire pour un nouvel employé')
      setActiveTab('identite')
      return
    }
    if (formData.pin && formData.pin.length !== 4) {
      toast.error('Le code PIN doit contenir exactement 4 chiffres')
      setActiveTab('identite')
      return
    }

    setSaving(true)
    try {
      let pinHash = null
      if (formData.pin) {
        pinHash = await hasherPinEmploye(formData.pin)
      }

      const photoUrl = await uploadPhotoIfNeeded(formData.matricule)

      const commonPayload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        department: formData.department.trim() || null,
        position: formData.position.trim() || null,
        photo_url: photoUrl || null,
        date_of_birth: formData.date_of_birth || null,
        place_of_birth: formData.place_of_birth.trim() || null,
        nationality: formData.nationality.trim() || null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        dependents_count: parseInt(formData.dependents_count, 10) || 0,
        national_id_number: formData.national_id_number.trim() || null,
        hire_date: formData.hire_date || null,
        contract_type: formData.contract_type || null,
        contract_end_date: formData.contract_end_date || null,
        professional_category: formData.professional_category.trim() || null,
        echelon: formData.echelon.trim() || null,
        classification: formData.classification || null,
        cnps_number: formData.cnps_number.trim() || null,
        tax_id_number: formData.tax_id_number.trim() || null,
        updated_at: new Date().toISOString(),
      }

      let targetEmployeeId = employee?.id || null

      if (isCreate) {
        const { data: created, error: insertErr } = await supabase
          .from('employees')
          .insert({
            ...commonPayload,
            enterprise_id: formData.enterprise_id,
            matricule: formData.matricule,
            pin_hash: pinHash,
            is_active: true,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        targetEmployeeId = created?.id || null
        toast.success('Nouvel employé enregistré avec succès')
      } else {
        const updatePayload = { ...commonPayload }
        if (pinHash) updatePayload.pin_hash = pinHash
        const { error: updateErr } = await supabase
          .from('employees')
          .update(updatePayload)
          .eq('id', employee.id)
        if (updateErr) throw updateErr
        toast.success('Fiche employé mise à jour')
      }

      // Synchronisation du numéro sur la pointeuse via la RPC dédiée
      const numeroSaisi = formData.machine_pin.trim()
      if (
        targetEmployeeId &&
        (isCreate || numeroSaisi !== initialMachinePinRef.current)
      ) {
        const { data: resPin, error: errPin } = await supabase.rpc(
          'encheck_employe_pin_machine',
          {
            p_employee_id: targetEmployeeId,
            p_pin: numeroSaisi,
          }
        )
        if (errPin) {
          toast.error(
            "Le numéro de pointeuse n'a pas pu être enregistré. Réessayez depuis la fiche."
          )
        } else if (resPin?.ok === false && resPin.reason === 'numero_deja_pris') {
          toast.error(
            'Numéro de pointeuse refusé : déjà attribué à un autre employé de cette entreprise.',
            { duration: 7000 }
          )
        }
      }

      if (onSaved) await onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fiche-v2-overlay"
        data-theme={darkMode ? 'dark' : 'light'}
        role="presentation"
        onClick={onClose}
      >
        <section
          className="fiche-v2-modal"
          role="dialog"
          aria-modal="true"
          aria-label={
            isCreate
              ? 'Nouvel employé'
              : `Fiche de l'employé ${fullNameDisplay}`
          }
          onClick={(event) => event.stopPropagation()}
        >
          {/* Frise textile africaine Kente en sommet de modale */}
          <KenteWovenTapestrySvg className="fiche-v2-kente-top" />

          {/* En-tête */}
          <header className="fiche-v2-header">
            <div className="fiche-v2-header-left">
              <WovenKenteBadgeSvg variant={isCreate ? 3 : 1} size={36} />
              <div className="fiche-v2-header-title">
                <h2>
                  {isCreate
                    ? '+ Nouvel Employé'
                    : `Fiche Employé · ${fullNameDisplay}`}
                </h2>
                <span>
                  {isCreate
                    ? 'Création de dossier collaborateur En-Check'
                    : `Dossier RH, accès pointage & sécurité sociale${loadingFullEmployee ? ' · synchronisation…' : ''}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="fiche-v2-close-btn"
              onClick={onClose}
              aria-label="Fermer la fiche employé"
            >
              <X size={18} />
            </button>
          </header>

          {/* Corps en 2 colonnes : Carte Passeport à gauche + Onglets à droite */}
          <form onSubmit={handleSave} style={{ display: 'contents' }}>
            <div className="fiche-v2-layout">
              {/* COLONNE GAUCHE : CARTE PASSEPORT IDENTITÉ */}
              <aside className="fiche-v2-passport-col">
                <div className="fiche-v2-passport-card">
                  <AdinkraWatermarkSvg className="fiche-v2-watermark" />

                  <div
                    className="fiche-v2-photo-ring"
                    onClick={() => effectiveCanEdit && fileInputRef.current?.click()}
                    title={
                      effectiveCanEdit
                        ? 'Cliquer pour ajouter ou remplacer la photo'
                        : fullNameDisplay
                    }
                  >
                    <div className="fiche-v2-photo-inner">
                      {photoPreview ? (
                        <img src={photoPreview} alt={fullNameDisplay} />
                      ) : (
                        <Camera size={28} />
                      )}
                    </div>
                    {effectiveCanEdit && (
                      <span className="fiche-v2-photo-plus" aria-hidden="true">
                        +
                      </span>
                    )}
                  </div>

                  {effectiveCanEdit && photoPreview && (
                    <button
                      type="button"
                      className="fiche-v2-remove-photo-btn"
                      onClick={handleRemovePhoto}
                    >
                      Retirer la photo
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />

                  <h3 className="fiche-v2-emp-name">{fullNameDisplay}</h3>

                  <span className="fiche-v2-pill is-matricule">
                    #{formData.matricule || 'MAT-AUTO'}
                  </span>

                  <span className="fiche-v2-pill is-enterprise">
                    <Building2 size={13} />
                    <span>{enterpriseName}</span>
                  </span>

                  <span className="fiche-v2-pill is-contract">
                    <Briefcase size={12} />
                    <span>{formData.contract_type || 'Contrat non précisé'}</span>
                  </span>

                  <span className="fiche-v2-pill is-machine">
                    <Radio size={12} />
                    <span>
                      N° Pointeuse :{' '}
                      <strong>{formData.machine_pin || 'Non attribué'}</strong>
                    </span>
                  </span>

                  {scheduleInfo?.label && (
                    <span className="fiche-v2-pill is-machine" style={{ fontSize: '0.7rem' }}>
                      {scheduleInfo.label}
                    </span>
                  )}
                </div>

                {!isCreate && employee?.id && (
                  <button
                    type="button"
                    className="fiche-v2-qr-btn"
                    onClick={() => setShowBadgeModal(true)}
                  >
                    <QrCode size={16} />
                    <span>Badge QR</span>
                  </button>
                )}
              </aside>

              {/* COLONNE DROITE : ONGLETS HORIZONTAUX + CHAMPS */}
              <div className="fiche-v2-form-col">
                <div className="fiche-v2-tabs" role="tablist" aria-label="Sections de la fiche employé">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'identite'}
                    className={`fiche-v2-tab-btn${activeTab === 'identite' ? ' is-active' : ''}`}
                    onClick={() => setActiveTab('identite')}
                  >
                    1. Identité & Accès
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'contrat'}
                    className={`fiche-v2-tab-btn${activeTab === 'contrat' ? ' is-active' : ''}`}
                    onClick={() => setActiveTab('contrat')}
                  >
                    2. Poste & Contrat
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'civil_cnps'}
                    className={`fiche-v2-tab-btn${activeTab === 'civil_cnps' ? ' is-active' : ''}`}
                    onClick={() => setActiveTab('civil_cnps')}
                  >
                    3. État civil & CNPS
                  </button>
                </div>

                {/* ONGLET 1 : IDENTITÉ & ACCÈS */}
                {activeTab === 'identite' && (
                  <div className="fiche-v2-grid">
                    {isCreate && isSuperAdmin && enterpriseList.length > 0 && (
                      <div className="fiche-v2-field is-full">
                        <label>
                          <Building2 size={13} /> Entreprise d’affectation *
                        </label>
                        <select
                          value={formData.enterprise_id}
                          onChange={(e) =>
                            setFormData({ ...formData, enterprise_id: e.target.value })
                          }
                        >
                          {enterpriseList.map((ent) => (
                            <option key={ent.id} value={ent.id}>
                              {ent.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="fiche-v2-field">
                      <label>
                        <User size={13} /> Prénom *
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.first_name}
                        onChange={(e) =>
                          setFormData({ ...formData, first_name: e.target.value })
                        }
                        placeholder="Ex: Hippo"
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <User size={13} /> Nom *
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.last_name}
                        onChange={(e) =>
                          setFormData({ ...formData, last_name: e.target.value })
                        }
                        placeholder="Ex: BIYOKILA"
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Shield size={13} /> Code PIN (4 chiffres){isCreate ? ' *' : ''}
                      </label>
                      <div className="fiche-v2-pin-wrap">
                        <input
                          type={showPin ? 'text' : 'password'}
                          disabled={!effectiveCanEdit}
                          value={formData.pin}
                          maxLength={4}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                            setFormData({ ...formData, pin: val })
                          }}
                          placeholder={isCreate ? '••••' : '•••• (laisser vide = inchangé)'}
                        />
                        <button
                          type="button"
                          className="fiche-v2-pin-eye"
                          onClick={() => setShowPin((prev) => !prev)}
                          tabIndex={-1}
                          aria-label={showPin ? 'Masquer le PIN' : 'Afficher le PIN'}
                        >
                          {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Radio size={13} /> Numéro sur la pointeuse
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.machine_pin}
                        onChange={(e) =>
                          setFormData({ ...formData, machine_pin: e.target.value })
                        }
                        placeholder="Ex: 12 (Menu → Utilisateur)"
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Mail size={13} /> Email
                      </label>
                      <input
                        type="email"
                        disabled={!effectiveCanEdit}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="prenom.nom@entreprise.com"
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Phone size={13} /> Téléphone
                      </label>
                      <input
                        type="tel"
                        disabled={!effectiveCanEdit}
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="+242 / +229 / +237..."
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Briefcase size={13} /> Poste / Fonction
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.position}
                        onChange={(e) =>
                          setFormData({ ...formData, position: e.target.value })
                        }
                        placeholder="Ex: Analyste, Comptable, Pharmacien..."
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Building2 size={13} /> Département / Service
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.department}
                        onChange={(e) =>
                          setFormData({ ...formData, department: e.target.value })
                        }
                        placeholder="Ex: Opérations, BI & Data, RH..."
                      />
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : POSTE & CONTRAT */}
                {activeTab === 'contrat' && (
                  <div className="fiche-v2-grid">
                    <div className="fiche-v2-field">
                      <label>
                        <Hash size={13} /> Matricule attribué
                      </label>
                      <input type="text" value={formData.matricule} disabled />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <FileText size={13} /> Type de contrat
                      </label>
                      <select
                        disabled={!effectiveCanEdit}
                        value={formData.contract_type}
                        onChange={(e) =>
                          setFormData({ ...formData, contract_type: e.target.value })
                        }
                      >
                        <option value="">Non précisé</option>
                        <option value="CDI">CDI</option>
                        <option value="CDD">CDD</option>
                        <option value="Stage">Stage</option>
                        <option value="Interim">Intérim</option>
                        <option value="Apprentissage">Apprentissage</option>
                        <option value="Freelance">Freelance</option>
                      </select>
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Calendar size={13} /> Date d’embauche
                      </label>
                      <input
                        type="date"
                        disabled={!effectiveCanEdit}
                        value={formData.hire_date}
                        onChange={(e) =>
                          setFormData({ ...formData, hire_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Calendar size={13} /> Fin de contrat (si CDD / Stage / Intérim)
                      </label>
                      <input
                        type="date"
                        disabled={!effectiveCanEdit}
                        value={formData.contract_end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, contract_end_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Layers size={13} /> Classification professionnelle
                      </label>
                      <select
                        disabled={!effectiveCanEdit}
                        value={formData.classification}
                        onChange={(e) =>
                          setFormData({ ...formData, classification: e.target.value })
                        }
                      >
                        <option value="">Non précisé</option>
                        <option value="cadre">Cadre</option>
                        <option value="agent_maitrise">Agent de maîtrise</option>
                        <option value="employe">Employé</option>
                        <option value="ouvrier">Ouvrier</option>
                        <option value="stagiaire">Stagiaire</option>
                      </select>
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Award size={13} /> Catégorie professionnelle
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.professional_category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            professional_category: e.target.value,
                          })
                        }
                        placeholder="Ex: A1, B2, C3..."
                      />
                    </div>

                    <div className="fiche-v2-field is-full">
                      <label>
                        <Award size={13} /> Échelon
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.echelon}
                        onChange={(e) =>
                          setFormData({ ...formData, echelon: e.target.value })
                        }
                        placeholder="Ex: 1, 2, 3 ou A, B, C..."
                      />
                    </div>
                  </div>
                )}

                {/* ONGLET 3 : ÉTAT CIVIL & CNPS */}
                {activeTab === 'civil_cnps' && (
                  <div className="fiche-v2-grid">
                    <div className="fiche-v2-field">
                      <label>
                        <Calendar size={13} /> Date de naissance
                      </label>
                      <input
                        type="date"
                        disabled={!effectiveCanEdit}
                        value={formData.date_of_birth}
                        onChange={(e) =>
                          setFormData({ ...formData, date_of_birth: e.target.value })
                        }
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <MapPin size={13} /> Lieu de naissance
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.place_of_birth}
                        onChange={(e) =>
                          setFormData({ ...formData, place_of_birth: e.target.value })
                        }
                        placeholder="Ex: Cotonou, Brazzaville, Douala..."
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Globe size={13} /> Nationalité
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.nationality}
                        onChange={(e) =>
                          setFormData({ ...formData, nationality: e.target.value })
                        }
                        placeholder="Ex: Béninoise, Congolaise..."
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <User size={13} /> Genre
                      </label>
                      <select
                        disabled={!effectiveCanEdit}
                        value={formData.gender}
                        onChange={(e) =>
                          setFormData({ ...formData, gender: e.target.value })
                        }
                      >
                        <option value="">Non précisé</option>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Heart size={13} /> Situation familiale
                      </label>
                      <select
                        disabled={!effectiveCanEdit}
                        value={formData.marital_status}
                        onChange={(e) =>
                          setFormData({ ...formData, marital_status: e.target.value })
                        }
                      >
                        <option value="">Non précisé</option>
                        <option value="celibataire">Célibataire</option>
                        <option value="marie">Marié(e)</option>
                        <option value="divorce">Divorcé(e)</option>
                        <option value="veuf">Veuf / Veuve</option>
                      </select>
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Baby size={13} /> Personnes à charge
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="25"
                        disabled={!effectiveCanEdit}
                        value={formData.dependents_count}
                        onChange={(e) =>
                          setFormData({ ...formData, dependents_count: e.target.value })
                        }
                      />
                    </div>

                    <div className="fiche-v2-field is-full">
                      <label>
                        <CreditCard size={13} /> N° Pièce d’identité (CNI / Passeport)
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.national_id_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            national_id_number: e.target.value,
                          })
                        }
                        placeholder="Numéro de pièce officielle"
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <Shield size={13} /> N° CNPS / Sécurité sociale
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.cnps_number}
                        onChange={(e) =>
                          setFormData({ ...formData, cnps_number: e.target.value })
                        }
                        placeholder="Ex: 123-456-789"
                      />
                    </div>

                    <div className="fiche-v2-field">
                      <label>
                        <FileText size={13} /> N° Identifiant fiscal (IFU / NIU)
                      </label>
                      <input
                        type="text"
                        disabled={!effectiveCanEdit}
                        value={formData.tax_id_number}
                        onChange={(e) =>
                          setFormData({ ...formData, tax_id_number: e.target.value })
                        }
                        placeholder="Identifiant fiscal"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pied de modale */}
            <footer className="fiche-v2-footer">
              <button
                type="button"
                className="fiche-v2-btn-cancel"
                onClick={onClose}
              >
                Annuler
              </button>
              {effectiveCanEdit && (
                <button
                  type="submit"
                  className="fiche-v2-btn-save"
                  disabled={saving}
                >
                  {isCreate ? <UserPlus size={16} /> : <CheckSquare size={16} />}
                  <span>
                    {saving
                      ? 'Enregistrement…'
                      : isCreate
                        ? 'Enregistrer l’employé'
                        : 'Enregistrer l’employé'}
                  </span>
                </button>
              )}
            </footer>
          </form>
        </section>
      </div>

      {showBadgeModal && employee && (
        <BadgeEmploye
          employee={{ ...employee, ...formData, photo_url: photoPreview || formData.photo_url }}
          entrepriseName={enterpriseName}
          entrepriseLogo={resolvedEnterprise?.logo_url}
          primaryColor={resolvedEnterprise?.primary_color ?? '#D4AF37'}
          onClose={() => setShowBadgeModal(false)}
        />
      )}
    </>
  )
}
