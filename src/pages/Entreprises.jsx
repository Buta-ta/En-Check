// ═══════════════════════════════════════════════════════════
// 🏢 PAGE GESTION DES ENTREPRISES (avec Logo)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
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
  Upload
} from 'lucide-react'

export default function Entreprises() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEntreprise, setEditingEntreprise] = useState(null)
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Formulaire
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    sector: '',
    matricule_prefix: '',
    primary_color: '#D4AF37', 
    logo_url: '',
     // 🔐 MODULES
    license_type: 'basic',
    module_qr_scanner: false,
    module_planning: false,
    module_retards: false,
    module_rapports_avances: false,
  })

  // Logo temporaire
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

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
  }, [navigate])

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('enterprises')
        .select(`
          *,
          employees(count),
          attendances(count)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setEntreprises(data || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
    }
    setLoading(false)
  }

  const genererCode = (name) => {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${base}${random}`
  }

  // ═══════════════════════════════════════════════════════════
  // 📸 GÉRER LA SÉLECTION DE LOGO
  // ═══════════════════════════════════════════════════════════
  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('L\'image est trop grande (max 5MB)')
      return
    }

    setLogoFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // ═══════════════════════════════════════════════════════════
  // 📤 UPLOADER LE LOGO
  // ═══════════════════════════════════════════════════════════
  const uploadLogo = async (code) => {
    if (!logoFile) return null

    setUploading(true)

    try {
      const extension = logoFile.name.split('.').pop()
      const fileName = `enterprise-${code}-${Date.now()}.${extension}`

      const { error } = await supabase.storage
        .from('photos')
        .upload(fileName, logoFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Erreur upload:', error)
        return null
      }

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName)

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
      matricule_prefix: '',
      logo_url: ''
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
      matricule_prefix: entreprise.matricule_prefix || '',
      primary_color: entreprise.primary_color || '#D4AF37',
      logo_url: entreprise.logo_url || '',
      // 🔐 MODULES
    license_type: entreprise.license_type || 'basic',
    module_qr_scanner: entreprise.module_qr_scanner || false,
    module_planning: entreprise.module_planning || false,
    module_retards: entreprise.module_retards || false,
    module_rapports_avances: entreprise.module_rapports_avances || false,
    })
    setEditingEntreprise(entreprise)
    setLogoPreview(entreprise.logo_url || null)
    setLogoFile(null)
    setShowModal(true)
  }

  const handleSave = async () => {
  try {
    if (!formData.name) {
      alert('Le nom de l\'entreprise est obligatoire')
      return
    }

    let code = formData.code
    let matricule_prefix = formData.matricule_prefix

    if (!editingEntreprise) {
      if (!code) {
        code = genererCode(formData.name)
      }
      if (!matricule_prefix) {
        matricule_prefix = formData.name
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 3)
      }
    }

    let logoUrl = formData.logo_url
    if (logoFile) {
      const uploadedUrl = await uploadLogo(code || formData.code)
      if (uploadedUrl) {
        logoUrl = uploadedUrl
      }
    }

    if (editingEntreprise) {
      await supabase
        .from('enterprises')
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          sector: formData.sector || null,
          matricule_prefix: formData.matricule_prefix || matricule_prefix,
          primary_color: formData.primary_color || '#D4AF37',
          logo_url: logoUrl || null,
          // 🔐 MODULES
          license_type: formData.license_type,
          module_qr_scanner: formData.module_qr_scanner,
          module_planning: formData.module_planning,
          module_retards: formData.module_retards,
          module_rapports_avances: formData.module_rapports_avances,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingEntreprise.id)

    } else {
      await supabase
        .from('enterprises')
        .insert({
          name: formData.name,
          code: code,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          sector: formData.sector || null,
          matricule_prefix: matricule_prefix,
          primary_color: formData.primary_color || '#D4AF37',
          logo_url: logoUrl || null,
          // 🔐 MODULES
          license_type: formData.license_type || 'basic',
          module_qr_scanner: formData.module_qr_scanner || false,
          module_planning: formData.module_planning || false,
          module_retards: formData.module_retards || false,
          module_rapports_avances: formData.module_rapports_avances || false,
          is_active: true
        })
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
      return
    }

    if (!confirm(`Supprimer l'entreprise "${entreprise.name}" ?`)) {
      return
    }

    try {
      await supabase
        .from('enterprises')
        .update({ is_active: false })
        .eq('id', entreprise.id)

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
      ent.email?.toLowerCase().includes(search)
    )
  })

  const handleNameChange = (name) => {
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3)
    
    setFormData({
      ...formData, 
      name,
      matricule_prefix: editingEntreprise ? formData.matricule_prefix : prefix
    })
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Footprints size={50} color="#8B6914" />
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
          <Footprints size={32} color="#FFFBF5" />
          <h1 style={styles.headerTitle}>ENTREPRISES</h1>
        </div>
      </header>

      {/* Contenu */}
      <main style={styles.main}>
        <div style={styles.toolbar}>
          <div style={styles.searchContainer}>
            <Search size={20} color="#9E9E9E" />
            <input
              type="text"
              placeholder="Rechercher une entreprise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <button onClick={handleAdd} style={styles.addBtn}>
            <Plus size={20} />
            Nouvelle entreprise
          </button>
        </div>

        <div style={styles.stats}>
          <Building2 size={20} color="#8B6914" />
          <span>{entreprisesFiltrees.length} entreprise(s)</span>
        </div>

        <div style={styles.list}>
          {entreprisesFiltrees.length === 0 ? (
            <div style={styles.empty}>
              <Building2 size={60} color="#C4A574" />
              <p>Aucune entreprise trouvée</p>
            </div>
          ) : (
            entreprisesFiltrees.map((entreprise) => (
              <div key={entreprise.id} style={styles.entrepriseCard}>
                {/* Logo */}
                <div style={styles.logoContainer}>
                  {entreprise.logo_url ? (
                    <img src={entreprise.logo_url} alt="" style={styles.logoImg} />
                  ) : (
                    <Building2 size={28} color="#8B6914" />
                  )}
                </div>

                {/* Infos */}
                <div style={styles.entrepriseInfo}>
                  <span style={styles.entrepriseName}>{entreprise.name}</span>
                  {/* Afficher le secteur */}
                  {entreprise.sector && (
                    <span style={styles.entrepriseSector}>
                      {entreprise.sector}
                    </span>
                  )}

                  <span style={styles.entrepriseCode}>
                    Code: {entreprise.code} • Préfixe: {entreprise.matricule_prefix}
                  </span>
                  {entreprise.email && (
                    <span style={styles.entrepriseEmail}>{entreprise.email}</span>
                  )}
                </div>

                {/* Stats */}
                <div style={styles.entrepriseStats}>
                  <div style={styles.statItem}>
                    <Users size={16} color="#8B6914" />
                    <span>{entreprise.employees?.[0]?.count || 0}</span>
                  </div>
                  <div style={styles.statItem}>
                    <Clock size={16} color="#8B6914" />
                    <span>{entreprise.attendances?.[0]?.count || 0}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={styles.actions}>
                  <button 
                    onClick={() => navigate(`/admins?enterprise=${entreprise.id}`)} 
                    style={styles.actionBtn}
                    title="Gérer les admins"
                  >
                    <Users size={18} />
                  </button>
                  <button 
                    onClick={() => handleEdit(entreprise)} 
                    style={styles.actionBtn}
                    title="Modifier"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(entreprise)} 
                    style={{...styles.actionBtn, ...styles.deleteBtn}}
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingEntreprise ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Logo */}
              <div style={styles.photoSection}>
                <div 
                  style={styles.photoContainer}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview" style={styles.photoPreview} />
                  ) : (
                    <div style={styles.photoPlaceholder}>
                      <Camera size={32} color="#9E9E9E" />
                      <span style={styles.photoText}>Logo</span>
                    </div>
                  )}
                  
                  <div style={styles.photoOverlay}>
                    <Upload size={20} color="#FFFBF5" />
                  </div>
                </div>

                {logoPreview && (
                  <button onClick={handleRemoveLogo} style={styles.removePhotoBtn}>
                    <X size={16} />
                    Supprimer
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Nom */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Nom de l'entreprise *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  style={styles.input}
                  placeholder="Ex: TechSenegal"
                />
              </div>


                            {/* Couleur du Badge */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Couleur du badge</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                    style={{ width: '50px', height: '40px', padding: '0', border: 'none', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#666' }}>{formData.primary_color}</span>
                </div>
              </div>





              {/* ═══════════════════════════════════════════════════════════ */}
{/* 🔐 SECTION MODULES / LICENCE */}
{/* ═══════════════════════════════════════════════════════════ */}
<div style={styles.modulesSection}>
  <h3 style={styles.modulesSectionTitle}>
    <Shield size={20} color="#8B6914" />
    Modules & Licence
  </h3>

  {/* Type de licence */}
  <div style={styles.formGroup}>
    <label style={styles.label}>Type de licence</label>
    <select
      value={formData.license_type}
      onChange={(e) => setFormData({...formData, license_type: e.target.value})}
      style={styles.select}
    >
      <option value="basic">Basic (Gratuit)</option>
      <option value="premium">Premium</option>
      <option value="enterprise">Enterprise</option>
    </select>
  </div>

  {/* Modules */}
  <div style={styles.modulesGrid}>
    <label style={styles.moduleItem}>
      <input
        type="checkbox"
        checked={formData.module_qr_scanner}
        onChange={(e) => setFormData({...formData, module_qr_scanner: e.target.checked})}
        style={styles.checkbox}
      />
      <div style={styles.moduleInfo}>
        <span style={styles.moduleName}>📷 Scanner QR Code</span>
        <span style={styles.moduleDesc}>Pointage par scan de badge</span>
      </div>
    </label>

    <label style={styles.moduleItem}>
      <input
        type="checkbox"
        checked={formData.module_planning}
        onChange={(e) => setFormData({...formData, module_planning: e.target.checked})}
        style={styles.checkbox}
      />
      <div style={styles.moduleInfo}>
        <span style={styles.moduleName}>📅 Planning Horaires</span>
        <span style={styles.moduleDesc}>Définir les heures de travail</span>
      </div>
    </label>

    <label style={styles.moduleItem}>
      <input
        type="checkbox"
        checked={formData.module_retards}
        onChange={(e) => setFormData({...formData, module_retards: e.target.checked})}
        style={styles.checkbox}
      />
      <div style={styles.moduleInfo}>
        <span style={styles.moduleName}>⏰ Gestion Retards</span>
        <span style={styles.moduleDesc}>Statistiques et alertes retards</span>
      </div>
    </label>

    <label style={styles.moduleItem}>
      <input
        type="checkbox"
        checked={formData.module_rapports_avances}
        onChange={(e) => setFormData({...formData, module_rapports_avances: e.target.checked})}
        style={styles.checkbox}
      />
      <div style={styles.moduleInfo}>
        <span style={styles.moduleName}>📊 Rapports Avancés</span>
        <span style={styles.moduleDesc}>PDF et Excel détaillés</span>
      </div>
    </label>
  </div>
</div>


                {/* Domaine / Secteur (NOUVEAU) */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Domaine / Secteur d'activité</label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => setFormData({...formData, sector: e.target.value})}
                  style={styles.input}
                  placeholder="Ex: Banque, BTP, Santé..."
                />
              </div>

              {/* Préfixe */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Préfixe des matricules</label>
                <input
                  type="text"
                  value={formData.matricule_prefix}
                  onChange={(e) => setFormData({...formData, matricule_prefix: e.target.value.toUpperCase().slice(0, 5)})}
                  style={styles.input}
                  placeholder="Ex: TS"
                  maxLength={5}
                />
                <span style={styles.hint}>
                  Les matricules seront : {formData.matricule_prefix || 'XXX'}-0001, {formData.matricule_prefix || 'XXX'}-0002...
                </span>
              </div>

              {/* Email et Téléphone */}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    style={styles.input}
                    placeholder="contact@entreprise.com"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    style={styles.input}
                    placeholder="+221 33 000 00 00"
                  />
                </div>
              </div>

              {/* Adresse */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Adresse</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  style={{...styles.input, minHeight: '80px', resize: 'vertical'}}
                  placeholder="Adresse complète..."
                />
              </div>

              {editingEntreprise && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Code entreprise</label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled
                    style={{...styles.input, background: '#f0f0f0'}}
                  />
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button onClick={handleSave} style={styles.saveBtn} disabled={uploading}>
                {uploading ? 'Upload...' : (
                  <>
                    <Save size={20} />
                    {editingEntreprise ? 'Modifier' : 'Créer'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#E5D4C0' },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: '#8B6914' },
  header: { background: '#3D2B1F', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px', color: '#FFFBF5', cursor: 'pointer' },
  headerTitle: { color: '#FFFBF5', fontSize: '24px', fontWeight: '300', letterSpacing: '4px' },
  main: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  toolbar: { display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  searchContainer: { flex: 1, minWidth: '250px', display: 'flex', alignItems: 'center', gap: '12px', background: '#FFFBF5', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: '#8B6914', color: '#FFFBF5', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  stats: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#3D2B1F' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9E9E9E' },
  entrepriseCard: { display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBF5', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexWrap: 'wrap' },
  logoContainer: { width: '56px', height: '56px', borderRadius: '12px', background: '#E5D4C0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  entrepriseInfo: { flex: 1, minWidth: '200px' },
  entrepriseName: { display: 'block', fontWeight: '600', color: '#3D2B1F', fontSize: '18px', marginBottom: '4px' },
  entrepriseCode: { display: 'block', color: '#8B6914', fontSize: '14px' },
  entrepriseEmail: { display: 'block', color: '#9E9E9E', fontSize: '13px', marginTop: '4px' },
  entrepriseStats: { display: 'flex', gap: '20px' },
  statItem: { display: 'flex', alignItems: 'center', gap: '6px', color: '#3D2B1F', fontSize: '14px' },
  actions: { display: 'flex', gap: '8px' },
  actionBtn: { background: '#E5D4C0', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', color: '#3D2B1F' },
  deleteBtn: { background: '#FEE2E2', color: '#9B2C2C' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 },
  modal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E5D4C0' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  photoSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '10px' },
  photoContainer: { width: '100px', height: '100px', borderRadius: '16px', background: '#E5D4C0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '3px solid #C4A574' },
  photoPreview: { width: '100%', height: '100%', objectFit: 'cover' },
  photoPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  photoText: { fontSize: '11px', color: '#9E9E9E' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '6px', display: 'flex', justifyContent: 'center' },
  removePhotoBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#9B2C2C', fontSize: '13px', cursor: 'pointer' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { fontSize: '14px', fontWeight: '500', color: '#3D2B1F' },
  input: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none' },
  hint: { fontSize: '12px', color: '#9E9E9E', marginTop: '4px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5D4C0' },
  cancelBtn: { padding: '12px 24px', background: '#E5D4C0', color: '#3D2B1F', border: 'none', borderRadius: '10px', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#8B6914', color: '#FFFBF5', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
    entrepriseSector: {
    display: 'inline-block',
    fontSize: '12px',
    color: '#8B6914',
    background: '#FEF3C7',
    padding: '2px 8px',
    borderRadius: '10px',
    marginBottom: '4px',
    fontWeight: '500',
  },


  // Ajoute dans const styles = { ... }

modulesSection: {
  marginTop: '20px',
  padding: '20px',
  background: '#F5F0EB',
  borderRadius: '12px',
  border: '2px solid #E5D4C0'
},
modulesSectionTitle: {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '16px',
  fontWeight: '600',
  color: '#3D2B1F',
  marginBottom: '16px'
},
modulesGrid: {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
},
moduleItem: {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '12px',
  background: '#FFFBF5',
  borderRadius: '10px',
  cursor: 'pointer',
  border: '1px solid #E5D4C0',
  transition: 'border-color 0.2s'
},
checkbox: {
  width: '20px',
  height: '20px',
  accentColor: '#8B6914',
  cursor: 'pointer',
  marginTop: '2px'
},
moduleInfo: {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px'
},
moduleName: {
  fontWeight: '600',
  color: '#3D2B1F',
  fontSize: '14px'
},
moduleDesc: {
  fontSize: '12px',
  color: '#9E9E9E'
},
}