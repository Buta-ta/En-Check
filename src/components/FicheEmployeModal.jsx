import { createElement, useState } from 'react'
import {
  Award,
  Baby,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
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
  Save,
  Shield,
  User,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import BadgeEmploye from './BadgeEmploye'
import EnCheckBrandMark from './EnCheckBrandMark'

function FicheSection({ title, icon, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="pointages-fiche-section">
      <button
        type="button"
        className="pointages-fiche-section-header"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="pointages-fiche-section-title">
          {icon ? createElement(icon, { size: 15 }) : null}
          <strong>{title}</strong>
          {badge && <small>{badge}</small>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="pointages-fiche-section-body">{children}</div>}
    </div>
  )
}

export default function FicheEmployeModal({
  employee,
  scheduleInfo,
  canEdit = false,
  onClose,
  onSaved,
}) {
  const [formData, setFormData] = useState(() => ({
    matricule: employee?.matricule || '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    machine_pin: employee?.machine_pin ? String(employee.machine_pin) : '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    department: employee?.department || '',
    position: employee?.position || '',
    date_of_birth: employee?.date_of_birth || '',
    place_of_birth: employee?.place_of_birth || '',
    nationality: employee?.nationality || '',
    gender: employee?.gender || '',
    marital_status: employee?.marital_status || '',
    dependents_count: employee?.dependents_count ?? 0,
    national_id_number: employee?.national_id_number || '',
    hire_date: employee?.hire_date || '',
    contract_type: employee?.contract_type || '',
    contract_end_date: employee?.contract_end_date || '',
    professional_category: employee?.professional_category || '',
    echelon: employee?.echelon || '',
    classification: employee?.classification || '',
    cnps_number: employee?.cnps_number || '',
    tax_id_number: employee?.tax_id_number || '',
  }))
  const [saving, setSaving] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)

  if (!employee) return null

  const initials = `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}` || 'EC'
  const enterpriseName = employee.enterprises?.name || 'Entreprise'

  const handleSave = async (event) => {
    event.preventDefault()
    if (!canEdit) return
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('Le prénom et le nom sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const updatePayload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        department: formData.department.trim() || null,
        position: formData.position.trim() || null,
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

      const { error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', employee.id)

      if (error) throw error

      if (String(employee.machine_pin || '') !== formData.machine_pin.trim()) {
        await supabase.rpc('encheck_employe_pin_machine', {
          p_employee_id: employee.id,
          p_pin: formData.machine_pin.trim() || null,
        }).catch(() => null)
      }

      toast.success('Fiche employé mise à jour')
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
      <div className="pointages-fiche-overlay" role="presentation" onClick={onClose}>
        <section
          className="pointages-fiche-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Fiche de l'employé ${formData.first_name} ${formData.last_name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="pointages-fiche-header">
            <div className="pointages-fiche-hero">
              <div className="pointages-fiche-avatar">
                {employee.photo_url ? (
                  <img src={employee.photo_url} alt="" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="pointages-fiche-title-block">
                <span className="pointages-fiche-eyebrow">
                  <EnCheckBrandMark size={16} />
                  <span>En-Check · Fiche de l’employé</span>
                </span>
                <h2>{formData.first_name} {formData.last_name}</h2>
                <p>
                  <strong>{formData.matricule}</strong> · {enterpriseName}
                  {scheduleInfo?.label ? ` · ${scheduleInfo.label}` : ''}
                </p>
              </div>
            </div>

            <div className="pointages-fiche-header-actions">
              <button
                type="button"
                className="pointages-fiche-badge-btn"
                onClick={() => setShowBadgeModal(true)}
              >
                <QrCode size={14} />
                <span>Badge QR</span>
              </button>
              <button
                type="button"
                className="pointages-drawer-close"
                onClick={onClose}
                aria-label="Fermer la fiche employé"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <form className="pointages-fiche-body" onSubmit={handleSave}>
            {/* SECTION 1 : IDENTITÉ & CONTACT */}
            <FicheSection title="Identité & Contact" icon={User} defaultOpen={true} badge={formData.matricule}>
              <div className="pointages-fiche-grid">
                <label className="pointages-fiche-field">
                  <span><Hash size={12} /> Matricule</span>
                  <input type="text" value={formData.matricule} disabled />
                </label>
                <label className="pointages-fiche-field">
                  <span><Radio size={12} /> N° sur la pointeuse</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.machine_pin}
                    onChange={(e) => setFormData({ ...formData, machine_pin: e.target.value })}
                    placeholder="Non attribué"
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span>Prénom *</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span>Nom *</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><Mail size={12} /> Email</span>
                  <input
                    type="email"
                    disabled={!canEdit}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@entreprise.com"
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><Phone size={12} /> Téléphone</span>
                  <input
                    type="tel"
                    disabled={!canEdit}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+229 / +237..."
                  />
                </label>
              </div>
            </FicheSection>

            {/* SECTION 2 : INFORMATIONS PROFESSIONNELLES */}
            <FicheSection title="Informations professionnelles" icon={Briefcase} defaultOpen={true} badge={formData.contract_type || 'Poste'}>
              <div className="pointages-fiche-grid">
                <label className="pointages-fiche-field">
                  <span><Briefcase size={12} /> Poste</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Ex: Auxiliaire, Comptable..."
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><Building2 size={12} /> Département</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ex: Opérations, RH..."
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><Calendar size={12} /> Date d’embauche</span>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><FileText size={12} /> Type de contrat</span>
                  <select
                    disabled={!canEdit}
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                  >
                    <option value="">Non précisé</option>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Interim">Intérim</option>
                    <option value="Apprentissage">Apprentissage</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </label>
                <label className="pointages-fiche-field">
                  <span><Layers size={12} /> Classification</span>
                  <select
                    disabled={!canEdit}
                    value={formData.classification}
                    onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                  >
                    <option value="">Non précisé</option>
                    <option value="cadre">Cadre</option>
                    <option value="agent_maitrise">Agent de maîtrise</option>
                    <option value="employe">Employé</option>
                    <option value="ouvrier">Ouvrier</option>
                    <option value="stagiaire">Stagiaire</option>
                  </select>
                </label>
                <label className="pointages-fiche-field">
                  <span><Award size={12} /> Catégorie & Échelon</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.professional_category}
                    onChange={(e) => setFormData({ ...formData, professional_category: e.target.value })}
                    placeholder="Ex: A1, B2, C3..."
                  />
                </label>
              </div>
            </FicheSection>

            {/* SECTION 3 : INFORMATIONS PERSONNELLES */}
            <FicheSection title="Informations personnelles" icon={Heart} defaultOpen={false}>
              <div className="pointages-fiche-grid">
                <label className="pointages-fiche-field">
                  <span><Calendar size={12} /> Date de naissance</span>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><MapPin size={12} /> Lieu de naissance</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.place_of_birth}
                    onChange={(e) => setFormData({ ...formData, place_of_birth: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><Globe size={12} /> Nationalité</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><User size={12} /> Genre</span>
                  <select
                    disabled={!canEdit}
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Non précisé</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </label>
                <label className="pointages-fiche-field">
                  <span><Baby size={12} /> Personnes à charge</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    disabled={!canEdit}
                    value={formData.dependents_count}
                    onChange={(e) => setFormData({ ...formData, dependents_count: e.target.value })}
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><CreditCard size={12} /> N° Pièce d’identité</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.national_id_number}
                    onChange={(e) => setFormData({ ...formData, national_id_number: e.target.value })}
                  />
                </label>
              </div>
            </FicheSection>

            {/* SECTION 4 : INFORMATIONS SOCIALES & FISCALES */}
            <FicheSection title="Informations sociales & fiscales" icon={Shield} defaultOpen={false} badge="Paie">
              <div className="pointages-fiche-grid">
                <label className="pointages-fiche-field">
                  <span><Shield size={12} /> N° CNPS / Sécurité sociale</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.cnps_number}
                    onChange={(e) => setFormData({ ...formData, cnps_number: e.target.value })}
                    placeholder="Ex: 123-456-789"
                  />
                </label>
                <label className="pointages-fiche-field">
                  <span><FileText size={12} /> N° Identifiant fiscal (IFU/NIU)</span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.tax_id_number}
                    onChange={(e) => setFormData({ ...formData, tax_id_number: e.target.value })}
                  />
                </label>
              </div>
            </FicheSection>

            <footer className="pointages-fiche-footer">
              <button type="button" className="pointages-drawer-btn is-outline" onClick={onClose}>
                Fermer
              </button>
              {canEdit && (
                <button type="submit" className="pointages-drawer-btn is-copper" disabled={saving}>
                  <Save size={15} />
                  <span>{saving ? 'Enregistrement…' : 'Enregistrer la fiche'}</span>
                </button>
              )}
            </footer>
          </form>
        </section>
      </div>

      {showBadgeModal && (
        <BadgeEmploye
          employee={{ ...employee, ...formData }}
          entrepriseName={enterpriseName}
          entrepriseLogo={employee.enterprises?.logo_url}
          onClose={() => setShowBadgeModal(false)}
        />
      )}
    </>
  )
}
