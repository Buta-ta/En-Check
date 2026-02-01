// ═══════════════════════════════════════════════════════════
// 👤 PAGE GESTION DES ADMINISTRATEURS (Complet - Avec Modal Suppression)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Footprints, 
  Users, 
  Plus, 
  ArrowLeft,
  Search,
  Edit,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
  Mail,
  Shield,
  Building2,
  Camera,
  Upload,
  User,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Admins() {
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [admins, setAdmins] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  
  // ✅ MODAL SUPPRESSION
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState(null)

  const [editingAdmin, setEditingAdmin] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Formulaire
  const [formData, setFormData] = useState({
    enterprise_id: '',
    email: '',
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'admin',
    photo_url: ''
  })

  // Photo temporaire
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    
    const parsedAdmin = JSON.parse(adminData)
    
    // Seul le Super Admin peut accéder à cette page
    if (parsedAdmin.role !== 'super_admin') {
      navigate('/dashboard')
      return
    }
    
    setCurrentAdmin(parsedAdmin)
    loadData()
  }, [navigate])

  const loadData = async () => {
    try {
      // Charger les entreprises
      const { data: entreprisesData } = await supabase
        .from('enterprises')
        .select('*')
        .eq('is_active', true)
        .order('name')

      setEntreprises(entreprisesData || [])

      // Charger les admins
      const { data: adminsData } = await supabase
        .from('admins')
        .select('*, enterprises(name, logo_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setAdmins(adminsData || [])

      // Pré-sélectionner l'entreprise si passée en paramètre
      const enterpriseId = searchParams.get('enterprise')
      if (enterpriseId) {
        setFormData(prev => ({ ...prev, enterprise_id: enterpriseId }))
      }

    } catch (error) {
      console.error('Erreur chargement:', error)
    }
    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 🔐 HASHER LE MOT DE PASSE
  // ═══════════════════════════════════════════════════════════
  const hasherPassword = async (password) => {
    const sel = 'EnCheck_Admin_2024'
    const contenu = `${sel}${password}${sel}`
    
    const encoder = new TextEncoder()
    const data = encoder.encode(contenu)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex
  }

  // ═══════════════════════════════════════════════════════════
  // 📸 GÉRER LA SÉLECTION DE PHOTO
  // ═══════════════════════════════════════════════════════════
  const handlePhotoSelect = (e) => {
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

    setPhotoFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // ═══════════════════════════════════════════════════════════
  // 📤 UPLOADER LA PHOTO
  // ═══════════════════════════════════════════════════════════
  const uploadPhoto = async (identifier) => {
    if (!photoFile) return null

    setUploading(true)

    try {
      const extension = photoFile.name.split('.').pop()
      const safeIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '-')
      const fileName = `admin-${safeIdentifier}-${Date.now()}.${extension}`

      const { error } = await supabase.storage
        .from('photos')
        .upload(fileName, photoFile, {
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

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setFormData({ ...formData, photo_url: '' })
  }

  const handleAdd = () => {
    const enterpriseId = searchParams.get('enterprise') || (entreprises[0]?.id || '')

    setFormData({
      enterprise_id: enterpriseId,
      email: '',
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'admin',
      photo_url: ''
    })
    setEditingAdmin(null)
    setShowPassword(false)
    setPhotoPreview(null)
    setPhotoFile(null)
    setShowModal(true)
  }

  const handleEdit = (admin) => {
    setFormData({
      enterprise_id: admin.enterprise_id || '',
      email: admin.email || '',
      username: admin.username || '',
      password: '',
      first_name: admin.first_name || '',
      last_name: admin.last_name || '',
      role: admin.role,
      photo_url: admin.photo_url || ''
    })
    setEditingAdmin(admin)
    setShowPassword(false)
    setPhotoPreview(admin.photo_url || null)
    setPhotoFile(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.email && !formData.username) {
        alert('Il faut soit un email, soit un nom d\'utilisateur')
        return
      }

      if (!formData.first_name || !formData.last_name) {
        alert('Le prénom et le nom sont obligatoires')
        return
      }

      if (!editingAdmin && !formData.password) {
        alert('Le mot de passe est obligatoire pour un nouvel administrateur')
        return
      }

      if (formData.password && formData.password.length < 6) {
        alert('Le mot de passe doit contenir au moins 6 caractères')
        return
      }

      if (formData.role !== 'super_admin' && !formData.enterprise_id) {
        alert('Veuillez sélectionner une entreprise')
        return
      }

      if (!editingAdmin && formData.username) {
        const { data: existingUser } = await supabase
          .from('admins')
          .select('id')
          .eq('username', formData.username)
          .single()

        if (existingUser) {
          alert('Ce nom d\'utilisateur est déjà pris')
          return
        }
      }

      if (!editingAdmin && formData.email) {
        const { data: existingEmail } = await supabase
          .from('admins')
          .select('id')
          .eq('email', formData.email)
          .single()

        if (existingEmail) {
          alert('Cet email est déjà utilisé')
          return
        }
      }

      let passwordHash = null
      if (formData.password) {
        passwordHash = await hasherPassword(formData.password)
      }

      let photoUrl = formData.photo_url
      if (photoFile) {
        const identifier = formData.email || formData.username
        const uploadedUrl = await uploadPhoto(identifier)
        if (uploadedUrl) {
          photoUrl = uploadedUrl
        }
      }

      if (editingAdmin) {
        const updateData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          enterprise_id: formData.role === 'super_admin' ? null : formData.enterprise_id,
          email: formData.email || null,
          username: formData.username || null,
          photo_url: photoUrl || null,
          updated_at: new Date().toISOString()
        }

        if (passwordHash) {
          updateData.password_hash = passwordHash
        }

        await supabase
          .from('admins')
          .update(updateData)
          .eq('id', editingAdmin.id)

        toast.success('Administrateur modifié')

      } else {
        await supabase
          .from('admins')
          .insert({
            email: formData.email ? formData.email.toLowerCase().trim() : null,
            username: formData.username ? formData.username.trim() : null,
            password_hash: passwordHash,
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            enterprise_id: formData.role === 'super_admin' ? null : formData.enterprise_id,
            photo_url: photoUrl || null,
            is_active: true
          })
        
        toast.success('Administrateur créé')
      }

      setShowModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      loadData()

    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // ✅ LOGIQUE DE SUPPRESSION AVEC MODAL
  const initiateDelete = (admin) => {
    if (admin.id === currentAdmin.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
      return
    }
    setAdminToDelete(admin)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!adminToDelete) return

    try {
      await supabase
        .from('admins')
        .update({ is_active: false })
        .eq('id', adminToDelete.id)

      loadData()
      toast.success('Administrateur supprimé')
    } catch (error) {
      console.error('Erreur suppression:', error)
      toast.error('Erreur lors de la suppression')
    } finally {
      setShowDeleteModal(false)
      setAdminToDelete(null)
    }
  }

  const adminsFiltres = admins.filter(adm => {
    const search = searchTerm.toLowerCase()
    
    const enterpriseFilter = searchParams.get('enterprise')
    if (enterpriseFilter && adm.enterprise_id !== enterpriseFilter) {
      return false
    }

    return (
      adm.first_name?.toLowerCase().includes(search) ||
      adm.last_name?.toLowerCase().includes(search) ||
      adm.email?.toLowerCase().includes(search) ||
      adm.username?.toLowerCase().includes(search) ||
      adm.enterprises?.name?.toLowerCase().includes(search)
    )
  })

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'manager': return 'Manager'
      default: return role
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'super_admin': return { bg: '#FEF3C7', color: '#92400E' }
      case 'admin': return { bg: '#DEF7EC', color: '#03543F' }
      case 'manager': return { bg: '#E0E7FF', color: '#3730A3' }
      default: return { bg: '#F3F4F6', color: '#374151' }
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Footprints size={50} color="#8B6914" className="loading-walk" />
        <p>Chargement...</p>
      </div>
    )
  }

  const selectedEnterprise = searchParams.get('enterprise')
  const entrepriseInfo = entreprises.find(e => e.id === selectedEnterprise)

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
          <Footprints size={32} color="#FFFBF5" />
          <h1 style={styles.headerTitle}>ADMINISTRATEURS</h1>
        </div>
      </header>

      <main style={styles.main}>
        {entrepriseInfo && (
          <div style={styles.enterpriseInfo}>
            {entrepriseInfo.logo_url ? (
              <img src={entrepriseInfo.logo_url} alt="" style={styles.enterpriseLogo} />
            ) : (
              <Building2 size={20} color="#8B6914" />
            )}
            <span>Entreprise : <strong>{entrepriseInfo.name}</strong></span>
            <button 
              onClick={() => navigate('/admins')} 
              style={styles.clearFilterBtn}
            >
              Voir tous
            </button>
          </div>
        )}

        <div style={styles.toolbar}>
          <div style={styles.searchContainer}>
            <Search size={20} color="#9E9E9E" />
            <input
              type="text"
              placeholder="Rechercher un administrateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <button onClick={handleAdd} style={styles.addBtn}>
            <Plus size={20} />
            Nouvel admin
          </button>
        </div>

        <div style={styles.stats}>
          <Shield size={20} color="#8B6914" />
          <span>{adminsFiltres.length} administrateur(s)</span>
        </div>

        <div style={styles.list}>
          {adminsFiltres.length === 0 ? (
            <div style={styles.empty}>
              <Users size={60} color="#C4A574" />
              <p>Aucun administrateur trouvé</p>
            </div>
          ) : (
            adminsFiltres.map((admin) => (
              <div key={admin.id} style={styles.adminCard}>
                <div style={styles.avatar}>
                  {admin.photo_url ? (
                    <img src={admin.photo_url} alt="" style={styles.avatarImg} />
                  ) : (
                    <span style={styles.avatarInitials}>
                      {admin.first_name?.[0]}{admin.last_name?.[0]}
                    </span>
                  )}
                </div>

                   <div style={styles.adminInfo}>
                  <span style={styles.adminName}>
                    {admin.first_name} {admin.last_name}
                  </span>
                  
                  {/* Afficher Email ET Username */}
                  <div style={styles.adminCredentials}>
                    {admin.email && (
                      <span style={styles.credentialItem}>
                        <Mail size={14} />
                        {admin.email}
                      </span>
                    )}
                    {admin.username && (
                      <span style={styles.credentialItem}>
                        <User size={14} />
                        {admin.username}
                      </span>
                    )}
                  </div>

                  {admin.enterprises && (
                    <span style={styles.adminEntreprise}>
                      <Building2 size={14} />
                      {admin.enterprises.name}
                    </span>
                  )}
                </div>

                <div style={{
                  ...styles.roleBadge,
                  background: getRoleColor(admin.role).bg,
                  color: getRoleColor(admin.role).color
                }}>
                  {getRoleLabel(admin.role)}
                </div>

                <div style={styles.actions}>
                  <button 
                    onClick={() => handleEdit(admin)} 
                    style={styles.actionBtn}
                  >
                    <Edit size={18} />
                  </button>
                  {admin.id !== currentAdmin.id && (
                    <button 
                      onClick={() => initiateDelete(admin)} 
                      style={{...styles.actionBtn, ...styles.deleteBtn}}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ✅ MODAL CONFIRMATION SUPPRESSION */}
      {showDeleteModal && adminToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.modalIconContainer}>
              <AlertTriangle size={32} color="#9B2C2C" />
            </div>
            
            <h3 style={styles.modalTitle}>Confirmer la suppression</h3>
            
            <p style={styles.modalText}>
              Voulez-vous vraiment supprimer l'administrateur <strong>{adminToDelete.first_name} {adminToDelete.last_name}</strong> ?
              <br/>
              Cette action est irréversible.
            </p>

            <div style={styles.modalButtons}>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={styles.cancelBtn}
              >
                Annuler
              </button>
              <button 
                onClick={confirmDelete}
                style={styles.confirmDeleteBtn}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingAdmin ? 'Modifier l\'administrateur' : 'Nouvel administrateur'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Photo */}
              <div style={styles.photoSection}>
                <div 
                  style={styles.photoContainer}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" style={styles.photoPreview} />
                  ) : (
                    <div style={styles.photoPlaceholder}>
                      <Camera size={32} color="#9E9E9E" />
                      <span style={styles.photoText}>Photo</span>
                    </div>
                  )}
                  
                  <div style={styles.photoOverlay}>
                    <Upload size={20} color="#FFFBF5" />
                  </div>
                </div>

                {photoPreview && (
                  <button onClick={handleRemovePhoto} style={styles.removePhotoBtn}>
                    <X size={16} />
                    Supprimer
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Entreprise *</label>
                <select
                  value={formData.enterprise_id}
                  onChange={(e) => setFormData({...formData, enterprise_id: e.target.value})}
                  style={styles.select}
                  disabled={formData.role === 'super_admin'}
                >
                  <option value="">-- Sélectionner --</option>
                  {entreprises.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prénom *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    style={styles.input}
                    placeholder="Prénom"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nom *</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    style={styles.input}
                    placeholder="Nom"
                  />
                </div>
              </div>

              {/* Username */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Nom d'utilisateur (pour connexion)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value.trim()})}
                  style={styles.input}
                  placeholder="Ex: amadou.ndiaye"
                  disabled={editingAdmin} // Optionnel : empêcher modif
                />
              </div>

              <div style={styles.separator}>OU</div>

              {/* Email */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Email (optionnel)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  style={styles.input}
                  placeholder="admin@entreprise.com"
                  disabled={editingAdmin && !!formData.email} // Désactiver si déjà un email
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Mot de passe {editingAdmin ? '(laisser vide pour ne pas changer)' : '*'}
                </label>
                <div style={styles.passwordContainer}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    style={styles.input}
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)} 
                    style={styles.passwordToggle}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Rôle *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  style={styles.select}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button onClick={handleSave} style={styles.saveBtn} disabled={uploading}>
                {uploading ? 'Upload...' : (
                  <>
                    <Save size={20} />
                    {editingAdmin ? 'Modifier' : 'Créer'}
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
  enterpriseInfo: { display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFBF5', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  enterpriseLogo: { width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' },
  clearFilterBtn: { marginLeft: 'auto', background: 'none', border: '1px solid #C4A574', borderRadius: '6px', padding: '6px 12px', color: '#8B6914', fontSize: '13px', cursor: 'pointer' },
  toolbar: { display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  searchContainer: { flex: 1, minWidth: '250px', display: 'flex', alignItems: 'center', gap: '12px', background: '#FFFBF5', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: '#8B6914', color: '#FFFBF5', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  stats: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#3D2B1F' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9E9E9E' },
  adminCard: { display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBF5', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexWrap: 'wrap' },
  avatar: { width: '50px', height: '50px', borderRadius: '50%', background: '#8B6914', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: { color: '#FFFBF5', fontWeight: '600', fontSize: '18px' },
  adminInfo: { flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' },
  adminName: { fontWeight: '600', color: '#3D2B1F', fontSize: '16px' },
  adminEmail: { display: 'flex', alignItems: 'center', gap: '6px', color: '#9E9E9E', fontSize: '14px' },
  adminEntreprise: { display: 'flex', alignItems: 'center', gap: '6px', color: '#8B6914', fontSize: '13px' },
  roleBadge: { padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' },
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
  photoContainer: { width: '100px', height: '100px', borderRadius: '50%', background: '#E5D4C0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '3px solid #C4A574' },
  photoPreview: { width: '100%', height: '100%', objectFit: 'cover' },
  photoPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  photoText: { fontSize: '11px', color: '#9E9E9E' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '6px', display: 'flex', justifyContent: 'center' },
  removePhotoBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#9B2C2C', fontSize: '13px', cursor: 'pointer' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { fontSize: '14px', fontWeight: '500', color: '#3D2B1F' },
  input: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', width: '100%' },
  select: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', background: '#fff' },
  passwordContainer: { position: 'relative', display: 'flex', alignItems: 'center' },
  passwordToggle: { position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5D4C0' },
  cancelBtn: { padding: '12px 24px', background: '#E5D4C0', color: '#3D2B1F', border: 'none', borderRadius: '10px', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#8B6914', color: '#FFFBF5', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
  separator: { textAlign: 'center', color: '#9E9E9E', fontSize: '12px', margin: '10px 0', fontWeight: 'bold' },

  adminCredentials: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    margin: '4px 0',
  },
  credentialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#555',
    fontSize: '13px',
    background: '#F3F4F6',
    padding: '2px 6px',
    borderRadius: '4px',
    width: 'fit-content',
  },

  // ✅ STYLES MODAL CONFIRMATION
  confirmModal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' },
  modalIconContainer: { width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F', marginBottom: '12px' },
  modalText: { color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' },
  modalButtons: { display: 'flex', gap: '12px' },
  confirmDeleteBtn: { flex: 1, padding: '12px', background: '#9B2C2C', color: '#FFF', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
}