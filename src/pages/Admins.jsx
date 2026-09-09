// ═══════════════════════════════════════════════════════════
// 👤 PAGE GESTION DES ADMINISTRATEURS - STYLE DASHBOARD
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Footprints, Users, Plus, ArrowLeft, Search, Edit, Trash2, X,
  Save, Eye, EyeOff, Mail, Shield, Building2, Camera, Upload,
  User, AlertTriangle, Check, Minus, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'

const MAX_ENTREPRISES = 10

export default function Admins() {
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [admins, setAdmins] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState(null)
  const [showEntreprisesModal, setShowEntreprisesModal] = useState(false)
  const [selectedAdminForEntreprises, setSelectedAdminForEntreprises] = useState(null)
  const [adminEntreprises, setAdminEntreprises] = useState([])
  const [loadingEntreprises, setLoadingEntreprises] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

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

  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    if (parsedAdmin.role !== 'super_admin') { navigate('/dashboard'); return }
    setCurrentAdmin(parsedAdmin)
    loadData()
  }, [navigate])

  const loadData = async () => {
    try {
      const { data: entreprisesData } = await supabase
        .from('enterprises').select('*').eq('is_active', true).order('name')
      setEntreprises(entreprisesData || [])

      const { data: adminsData } = await supabase
        .from('admins')
        .select(`
          *,
          enterprises(name, logo_url),
          admin_entreprises(
            id, enterprise_id, role, is_active,
            enterprises(id, name, logo_url)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setAdmins(adminsData || [])

      const enterpriseId = searchParams.get('enterprise')
      if (enterpriseId) {
        setFormData(prev => ({ ...prev, enterprise_id: enterpriseId }))
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
    }
    setLoading(false)
  }

  const openEntreprisesModal = async (admin) => {
    setSelectedAdminForEntreprises(admin)
    setLoadingEntreprises(true)
    setShowEntreprisesModal(true)
    try {
      const { data } = await supabase
        .from('admin_entreprises').select('*, enterprises(*)')
        .eq('admin_id', admin.id).eq('is_active', true)
      setAdminEntreprises(data || [])
    } catch (error) {
      toast.error('Erreur lors du chargement')
    }
    setLoadingEntreprises(false)
  }

  const addEntrepriseToAdmin = async (entreprise) => {
    if (adminEntreprises.length >= MAX_ENTREPRISES) {
      toast.error(`Maximum ${MAX_ENTREPRISES} entreprises par admin`)
      return
    }
    try {
      const { error } = await supabase.from('admin_entreprises').insert({
        admin_id: selectedAdminForEntreprises.id,
        enterprise_id: entreprise.id,
        role: 'admin',
        is_active: true
      })
      if (error) {
        if (error.code === '23505') { toast.error('Cette entreprise est déjà assignée'); return }
        throw error
      }
      toast.success(`${entreprise.name} ajoutée`)
      const { data } = await supabase.from('admin_entreprises').select('*, enterprises(*)')
        .eq('admin_id', selectedAdminForEntreprises.id).eq('is_active', true)
      setAdminEntreprises(data || [])
      loadData()
    } catch (error) {
      toast.error("Erreur lors de l'ajout")
    }
  }

  const removeEntrepriseFromAdmin = async (adminEntreprise) => {
    if (adminEntreprises.length <= 1) {
      toast.error('Un admin doit avoir au moins une entreprise')
      return
    }
    try {
      const { error } = await supabase.from('admin_entreprises').delete().eq('id', adminEntreprise.id)
      if (error) throw error
      toast.success(`${adminEntreprise.enterprises?.name} retirée`)
      const { data } = await supabase.from('admin_entreprises').select('*, enterprises(*)')
        .eq('admin_id', selectedAdminForEntreprises.id).eq('is_active', true)
      setAdminEntreprises(data || [])
      loadData()
    } catch (error) {
      toast.error('Erreur lors du retrait')
    }
  }

  const changeRoleInEntreprise = async (adminEntreprise, newRole) => {
    try {
      const { error } = await supabase.from('admin_entreprises')
        .update({ role: newRole }).eq('id', adminEntreprise.id)
      if (error) throw error
      toast.success('Rôle modifié')
      const { data } = await supabase.from('admin_entreprises').select('*, enterprises(*)')
        .eq('admin_id', selectedAdminForEntreprises.id).eq('is_active', true)
      setAdminEntreprises(data || [])
    } catch (error) {
      toast.error('Erreur lors du changement')
    }
  }

  const entreprisesDisponibles = entreprises.filter(
    ent => !adminEntreprises.some(ae => ae.enterprise_id === ent.id)
  )

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Veuillez sélectionner une image'); return }
    if (file.size > 5 * 1024 * 1024) { alert("L'image est trop grande (max 5MB)"); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const uploadPhoto = async (identifier) => {
    if (!photoFile) return null
    setUploading(true)
    try {
      const extension = photoFile.name.split('.').pop()
      const safeIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '-')
      const fileName = `admin-${safeIdentifier}-${Date.now()}.${extension}`
      const { error } = await supabase.storage.from('photos').upload(fileName, photoFile, {
        cacheControl: '3600', upsert: true
      })
      if (error) { console.error('Erreur upload:', error); return null }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
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
      enterprise_id: enterpriseId, email: '', username: '',
      password: '', first_name: '', last_name: '', role: 'admin', photo_url: ''
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
      password: '', // ← Toujours vide en édition
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

  // ═══════════════════════════════════════════════════════════
  // 🔑 DONNER OU CHANGER LE MOT DE PASSE D'UN ADMINISTRATEUR
  // ═══════════════════════════════════════════════════════════
  //
  //  On passe l'identifiant de l'ADMINISTRATEUR, pas celui de son compte de
  //  connexion : la base retrouve le compte toute seule, et le crée si cet
  //  administrateur n'en a jamais eu. Avant, l'écran s'arrêtait net sur
  //  « user_id introuvable » dès que le compte n'existait pas encore — et
  //  c'était le cas de tous les administrateurs créés avant l'arrivée des
  //  comptes de connexion.
  //
  //  Quand la base refuse, elle dit POURQUOI. On affiche sa raison au lieu
  //  d'un message générique : « adresse e-mail manquante » ou « 8 caractères
  //  minimum » se comprend tout seul, « réessayez plus tard » non.
  const updatePasswordInSupabaseAuth = async (adminId, newPassword) => {
    try {
      const { error } = await supabase.rpc('encheck_admin_definir_mot_de_passe', {
        p_admin_id: adminId,
        p_mot_de_passe: newPassword
      })

      if (!error) return { ok: true, message: '' }

      //  La nouvelle fonction n'est pas encore sur cette base : on retombe sur
      //  l'ancienne, qui attend l'identifiant du compte de connexion.
      const fonctionAbsente = error.code === 'PGRST202'
        || /function|fonction/i.test(error.message || '')

      if (fonctionAbsente) {
        const { data: adminData } = await supabase
          .from('admins')
          .select('user_id')
          .eq('id', adminId)
          .maybeSingle()

        if (adminData?.user_id) {
          const { error: erreurAncienne } = await supabase.rpc('update_admin_password', {
            p_user_id: adminData.user_id,
            p_new_password: newPassword
          })
          if (!erreurAncienne) return { ok: true, message: '' }
          return {
            ok: false,
            message: erreurAncienne.message || 'La base a refusé le changement de mot de passe.'
          }
        }

        return {
          ok: false,
          message: 'La fonction de changement de mot de passe n\u2019est pas encore installée sur le serveur.'
        }
      }

      return {
        ok: false,
        message: error.message || 'La base a refusé le changement de mot de passe.'
      }
    } catch (err) {
      return {
        ok: false,
        message: err?.message || 'Erreur inattendue pendant le changement de mot de passe.'
      }
    }
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
      if (formData.password && formData.password.length < 8) {
        alert('Le mot de passe doit contenir au moins 8 caractères (la base refuse en dessous).')
        return
      }
      if (formData.role !== 'super_admin' && !formData.enterprise_id) {
        alert('Veuillez sélectionner une entreprise')
        return
      }

      let photoUrl = formData.photo_url
      if (photoFile) {
        const identifier = formData.email || formData.username
        const uploadedUrl = await uploadPhoto(identifier)
        if (uploadedUrl) photoUrl = uploadedUrl
      }

      if (editingAdmin) {
        // ═══ MISE À JOUR ADMIN EXISTANT ═══
        setSavingPassword(true)

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

        const { error: updateError } = await supabase
          .from('admins')
          .update(updateData)
          .eq('id', editingAdmin.id)

        if (updateError) throw updateError

        // ✅ Si un nouveau mot de passe est fourni → mettre à jour dans Supabase Auth
        if (formData.password) {
          const r = await updatePasswordInSupabaseAuth(
            editingAdmin.id,
            formData.password
          )

          if (r.ok) {
            toast.success('Administrateur modifié et mot de passe mis à jour ✅')
          } else {
            toast.success('Profil modifié')
            toast.error('⚠️ Mot de passe non changé — ' + r.message, { duration: 9000 })
          }
        } else {
          toast.success('Administrateur modifié')
        }

        setSavingPassword(false)

      } else {
        // ═══ CRÉATION NOUVEL ADMIN ═══
        setSavingPassword(true)

        // ✅ 1. Créer le compte dans Supabase Auth d'abord
        if (!formData.email) {
          alert('Un email est obligatoire pour créer un admin (nécessaire pour Supabase Auth)')
          setSavingPassword(false)
          return
        }

        // Créer via Admin API (nécessite service role key - à faire via Edge Function)
        // Pour l'instant, insérer dans admins et créer auth manuellement
        const { data: newAdmin, error: insertError } = await supabase
          .from('admins')
          .insert({
            email: formData.email ? formData.email.toLowerCase().trim() : null,
            username: formData.username ? formData.username.trim() : null,
            password_hash: 'supabase_auth', // Placeholder - plus utilisé
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            enterprise_id: formData.role === 'super_admin' ? null : formData.enterprise_id,
            photo_url: photoUrl || null,
            is_active: true
          })
          .select()
          .single()

        if (insertError) throw insertError

        if (formData.role !== 'super_admin' && formData.enterprise_id) {
          await supabase.from('admin_entreprises').insert({
            admin_id: newAdmin.id,
            enterprise_id: formData.enterprise_id,
            role: 'admin',
            is_active: true
          })
        }

        // ✅ Créer le compte auth via SQL
        const { error: authError } = await supabase.rpc('create_admin_auth_user', {
          p_email: formData.email.toLowerCase().trim(),
          p_password: formData.password,
          p_first_name: formData.first_name,
          p_last_name: formData.last_name,
          p_role: formData.role,
          p_admin_id: newAdmin.id
        })

        if (authError) {
          console.error('Erreur création auth:', authError)
          toast.success('Admin créé dans la base')
          toast.error('⚠️ Compte de connexion non créé — ' + (authError.message || 'raison inconnue'), { duration: 9000 })
        } else {
          toast.success('Administrateur créé avec accès complet ✅')
        }

        setSavingPassword(false)
      }

      setShowModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      loadData()

    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setSavingPassword(false)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const initiateDelete = (admin) => {
    if (admin.id === currentAdmin?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
      return
    }
    setAdminToDelete(admin)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!adminToDelete) return
    try {
      await supabase.from('admins').update({ is_active: false }).eq('id', adminToDelete.id)
      loadData()
      toast.success('Administrateur désactivé')
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    } finally {
      setShowDeleteModal(false)
      setAdminToDelete(null)
    }
  }

  const adminsFiltres = admins.filter(adm => {
    const search = searchTerm.toLowerCase()
    const enterpriseFilter = searchParams.get('enterprise')
    if (enterpriseFilter && adm.enterprise_id !== enterpriseFilter) return false
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
      case 'super_admin': return '⚡ Super Admin'
      case 'admin': return '👤 Admin'
      case 'manager': return '📋 Manager'
      default: return role
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'super_admin': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' }
      case 'admin': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: 'rgba(16, 185, 129, 0.3)' }
      case 'manager': return { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', border: 'rgba(99, 102, 241, 0.3)' }
      default: return { bg: 'rgba(255,255,255,0.1)', color: '#888', border: 'rgba(255,255,255,0.2)' }
    }
  }

  const getAdminEntreprisesCount = (admin) => {
    if (admin.role === 'super_admin') return '∞'
    return admin.admin_entreprises?.filter(ae => ae.is_active)?.length || 0
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingPulse}><Footprints size={50} color="#F59E0B" /></div>
        <p style={styles.loadingText}>Chargement des administrateurs...</p>
        <div style={styles.loadingBar}><div style={styles.loadingBarFill}></div></div>
      </div>
    )
  }

  const selectedEnterprise = searchParams.get('enterprise')
  const entrepriseInfo = entreprises.find(e => e.id === selectedEnterprise)

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .afro-admin-card:hover { background: rgba(245, 158, 11, 0.08) !important; border-color: rgba(245, 158, 11, 0.3) !important; transform: translateY(-2px); }
        .afro-action-btn:hover { transform: scale(1.1) !important; }
        .afro-modal-overlay { animation: fadeIn 0.3s ease; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 4px; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={styles.logoContainer}><Shield size={24} color="#F59E0B" /></div>
              <div style={styles.headerTitleWrap}>
                <h1 style={styles.headerTitle}>ADMINISTRATEURS</h1>
                <span style={styles.headerSubtitle}>Gestion des accès</span>
              </div>
            </div>
            <div style={styles.headerRight}>
              <div style={styles.statBadge}>
                <Users size={16} color="#F59E0B" />
                <span>{adminsFiltres.length}</span>
              </div>
              <button onClick={handleAdd} style={styles.addBtn}>
                <Plus size={18} />
                <span>Nouveau</span>
              </button>
            </div>
          </div>
        </header>

        <main style={styles.main}>
          {/* Filter Banner */}
          {entrepriseInfo && (
            <div style={styles.filterBanner}>
              <div style={styles.filterBannerLeft}>
                {entrepriseInfo.logo_url
                  ? <img src={entrepriseInfo.logo_url} alt="" style={styles.filterLogo} />
                  : <div style={styles.filterLogoPlaceholder}><Building2 size={18} color="#F59E0B" /></div>
                }
                <div>
                  <span style={styles.filterLabel}>Filtré par entreprise</span>
                  <span style={styles.filterName}>{entrepriseInfo.name}</span>
                </div>
              </div>
              <button onClick={() => navigate('/admins')} style={styles.clearFilterBtn}>
                <X size={16} /><span>Retirer</span>
              </button>
            </div>
          )}

          {/* Search */}
          <div style={styles.searchSection}>
            <div style={styles.searchBox}>
              <Search size={20} color="#666" />
              <input
                type="text"
                placeholder="Rechercher un administrateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={styles.clearSearchBtn}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Admin List */}
          <div style={styles.listContainer}>
            {adminsFiltres.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}><Users size={48} color="#F59E0B" /></div>
                <h3 style={styles.emptyTitle}>Aucun administrateur</h3>
                <p style={styles.emptyText}>Commencez par créer un nouvel admin</p>
                <button onClick={handleAdd} style={styles.emptyBtn}>
                  <Plus size={18} /><span>Créer un admin</span>
                </button>
              </div>
            ) : (
              adminsFiltres.map((admin, index) => (
                <div
                  key={admin.id}
                  className="afro-admin-card"
                  style={{ ...styles.adminCard, animationDelay: `${index * 0.05}s` }}
                >
                  <div style={styles.avatarSection}>
                    {admin.photo_url
                      ? <img src={admin.photo_url} alt="" style={styles.avatar} />
                      : <div style={styles.avatarPlaceholder}>
                          <span>{admin.first_name?.[0]}{admin.last_name?.[0]}</span>
                        </div>
                    }
                    {admin.role === 'super_admin' && (
                      <div style={styles.superAdminBadge}><Zap size={10} /></div>
                    )}
                  </div>

                  <div style={styles.adminInfo}>
                    <div style={styles.adminNameRow}>
                      <span style={styles.adminName}>{admin.first_name} {admin.last_name}</span>
                      <span style={{
                        ...styles.roleBadge,
                        background: getRoleColor(admin.role).bg,
                        color: getRoleColor(admin.role).color,
                        borderColor: getRoleColor(admin.role).border
                      }}>
                        {getRoleLabel(admin.role)}
                      </span>
                    </div>
                    <div style={styles.credentialsRow}>
                      {admin.email && (
                        <span style={styles.credential}><Mail size={12} />{admin.email}</span>
                      )}
                      {admin.username && (
                        <span style={styles.credential}><User size={12} />@{admin.username}</span>
                      )}
                    </div>
                    {admin.role !== 'super_admin' && (
                      <div style={styles.entreprisesRow}>
                        <Building2 size={12} color="#F59E0B" />
                        <span style={styles.entreprisesCount}>
                          {getAdminEntreprisesCount(admin)}/{MAX_ENTREPRISES} entreprises
                        </span>
                        {admin.admin_entreprises?.filter(ae => ae.is_active)?.slice(0, 2).map(ae => (
                          <span key={ae.id} style={styles.entrepriseChip}>
                            {ae.enterprises?.name?.substring(0, 12)}{ae.enterprises?.name?.length > 12 ? '...' : ''}
                          </span>
                        ))}
                        {(admin.admin_entreprises?.filter(ae => ae.is_active)?.length || 0) > 2 && (
                          <span style={styles.moreChip}>
                            +{admin.admin_entreprises.filter(ae => ae.is_active).length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    {/* ✅ Badge si admin non migré vers Supabase Auth */}
                    {!admin.user_id && (
                      <div style={styles.noAuthBadge}>
                        <AlertTriangle size={11} />
                        <span>Non lié à Supabase Auth</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.actionsRow}>
                    {admin.role !== 'super_admin' && (
                      <button
                        className="afro-action-btn"
                        onClick={() => openEntreprisesModal(admin)}
                        style={{ ...styles.actionBtn, ...styles.actionBtnBlue }}
                        title="Gérer les entreprises"
                      >
                        <Building2 size={16} />
                      </button>
                    )}
                    <button
                      className="afro-action-btn"
                      onClick={() => handleEdit(admin)}
                      style={{ ...styles.actionBtn, ...styles.actionBtnGold }}
                      title="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                    {admin.id !== currentAdmin?.id && (
                      <button
                        className="afro-action-btn"
                        onClick={() => initiateDelete(admin)}
                        style={{ ...styles.actionBtn, ...styles.actionBtnRed }}
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.footer}>
            <div style={styles.footerLine}></div>
            <p style={styles.footerText}>
              <Footprints size={14} color="#F59E0B" />
              EN-CHECK • Gestion des Administrateurs
            </p>
          </div>
        </main>

        {/* Modal Entreprises */}
        {showEntreprisesModal && selectedAdminForEntreprises && (
          <div className="afro-modal-overlay" style={styles.modalOverlay} onClick={() => setShowEntreprisesModal(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={styles.modalTitleRow}>
                  <div style={styles.modalIconWrap}><Building2 size={22} color="#F59E0B" /></div>
                  <div>
                    <h2 style={styles.modalTitle}>Entreprises</h2>
                    <p style={styles.modalSubtitle}>
                      {selectedAdminForEntreprises.first_name} {selectedAdminForEntreprises.last_name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowEntreprisesModal(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
              <div style={styles.modalBody}>
                {loadingEntreprises ? (
                  <div style={styles.modalLoading}>
                    <Footprints size={30} color="#F59E0B" /><p>Chargement...</p>
                  </div>
                ) : (
                  <>
                    <div style={styles.modalSection}>
                      <div style={styles.modalSectionHeader}>
                        <Check size={16} color="#10B981" />
                        <span>Assignées ({adminEntreprises.length}/{MAX_ENTREPRISES})</span>
                      </div>
                      {adminEntreprises.length === 0
                        ? <p style={styles.noDataText}>Aucune entreprise assignée</p>
                        : (
                          <div style={styles.entreprisesList}>
                            {adminEntreprises.map(ae => (
                              <div key={ae.id} style={styles.entrepriseItem}>
                                <div style={styles.entrepriseItemLeft}>
                                  {ae.enterprises?.logo_url
                                    ? <img src={ae.enterprises.logo_url} alt="" style={styles.entItemLogo} />
                                    : <div style={styles.entItemLogoPlaceholder}><Building2 size={16} color="#F59E0B" /></div>
                                  }
                                  <div style={styles.entItemInfo}>
                                    <span style={styles.entItemName}>{ae.enterprises?.name}</span>
                                    <select
                                      value={ae.role}
                                      onChange={(e) => changeRoleInEntreprise(ae, e.target.value)}
                                      style={styles.roleSelect}
                                    >
                                      <option value="admin">Admin</option>
                                      <option value="manager">Manager</option>
                                      <option value="proprietaire">Propriétaire</option>
                                    </select>
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeEntrepriseFromAdmin(ae)}
                                  style={styles.removeEntBtn}
                                  disabled={adminEntreprises.length <= 1}
                                >
                                  <Minus size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>
                    {adminEntreprises.length < MAX_ENTREPRISES && entreprisesDisponibles.length > 0 && (
                      <div style={styles.modalSection}>
                        <div style={styles.modalSectionHeader}>
                          <Plus size={16} color="#F59E0B" />
                          <span>Ajouter une entreprise</span>
                        </div>
                        <div style={styles.entreprisesList}>
                          {entreprisesDisponibles.map(ent => (
                            <div key={ent.id} style={styles.entrepriseItemAdd}>
                              <div style={styles.entrepriseItemLeft}>
                                {ent.logo_url
                                  ? <img src={ent.logo_url} alt="" style={styles.entItemLogo} />
                                  : <div style={styles.entItemLogoPlaceholderGray}><Building2 size={16} color="#666" /></div>
                                }
                                <span style={styles.entItemNameGray}>{ent.name}</span>
                              </div>
                              <button onClick={() => addEntrepriseToAdmin(ent)} style={styles.addEntBtn}>
                                <Plus size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {adminEntreprises.length >= MAX_ENTREPRISES && (
                      <div style={styles.limitWarning}>
                        <AlertTriangle size={16} />
                        <span>Limite de {MAX_ENTREPRISES} entreprises atteinte</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={styles.modalFooter}>
                <button onClick={() => setShowEntreprisesModal(false)} style={styles.modalPrimaryBtn}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Suppression */}
        {showDeleteModal && adminToDelete && (
          <div className="afro-modal-overlay" style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
              <div style={styles.confirmIconWrap}><AlertTriangle size={32} color="#EF4444" /></div>
              <h3 style={styles.confirmTitle}>Supprimer cet administrateur ?</h3>
              <p style={styles.confirmText}>
                <strong>{adminToDelete.first_name} {adminToDelete.last_name}</strong>
                <br />Cette action est irréversible.
              </p>
              <div style={styles.confirmActions}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button onClick={confirmDelete} style={styles.deleteBtn}>Supprimer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Création/Édition */}
        {showModal && (
          <div className="afro-modal-overlay" style={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div style={styles.formModal} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={styles.modalTitleRow}>
                  <div style={styles.modalIconWrap}>
                    {editingAdmin ? <Edit size={22} color="#F59E0B" /> : <Plus size={22} color="#F59E0B" />}
                  </div>
                  <div>
                    <h2 style={styles.modalTitle}>
                      {editingAdmin ? "Modifier l'admin" : 'Nouvel administrateur'}
                    </h2>
                    {editingAdmin && (
                      <p style={{ color: '#888', fontSize: '12px', margin: '2px 0 0 0' }}>
                        Laissez le mot de passe vide pour ne pas le modifier
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div style={styles.formBody}>
                {/* Photo */}
                <div style={styles.photoSection}>
                  <div style={styles.photoUpload} onClick={() => fileInputRef.current?.click()}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Preview" style={styles.photoPreviewImg} />
                      : <div style={styles.photoPlaceholder}><Camera size={28} color="#666" /><span>Photo</span></div>
                    }
                    <div style={styles.photoOverlay}><Upload size={16} color="#FFF" /></div>
                  </div>
                  {photoPreview && (
                    <button onClick={handleRemovePhoto} style={styles.removePhotoBtn}>
                      <X size={14} /><span>Retirer</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                </div>

                {/* Entreprise */}
                <div style={styles.formGroup}>
                  <label style={styles.label}><Building2 size={14} />Entreprise principale</label>
                  <select
                    value={formData.enterprise_id}
                    onChange={(e) => setFormData({ ...formData, enterprise_id: e.target.value })}
                    style={styles.select}
                    disabled={formData.role === 'super_admin'}
                  >
                    <option value="">-- Sélectionner --</option>
                    {entreprises.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </div>

                {/* Nom / Prénom */}
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Prénom *</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      style={styles.input}
                      placeholder="Prénom"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nom *</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      style={styles.input}
                      placeholder="Nom"
                    />
                  </div>
                </div>

                {/* Username */}
                <div style={styles.formGroup}>
                  <label style={styles.label}><User size={14} />Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                    style={styles.input}
                    placeholder="amadou.ndiaye"
                    disabled={!!editingAdmin}
                  />
                </div>

                <div style={styles.divider}><span>OU</span></div>

                {/* Email */}
                <div style={styles.formGroup}>
                  <label style={styles.label}><Mail size={14} />Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={styles.input}
                    placeholder="admin@entreprise.com"
                    disabled={editingAdmin && !!formData.email}
                  />
                </div>

                {/* Mot de passe */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Mot de passe {editingAdmin ? '(laisser vide = inchangé)' : '*'}
                  </label>
                  {/* ✅ Avertissement si admin a un user_id (Supabase Auth actif) */}
                  {editingAdmin?.user_id && (
                    <div style={styles.authInfoBadge}>
                      <Check size={12} color="#10B981" />
                      <span>Ce mot de passe sera mis à jour dans Supabase Auth</span>
                    </div>
                  )}
                  {editingAdmin && !editingAdmin?.user_id && (
                    <div style={styles.authWarnBadge}>
                      <AlertTriangle size={12} color="#F59E0B" />
                      <span>Pas encore de compte de connexion — il sera créé dès que tu donneras un mot de passe</span>
                    </div>
                  )}
                  <div style={styles.passwordWrapper}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={styles.input}
                      placeholder={editingAdmin ? '••••••• (optionnel)' : '••••••••'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <span style={styles.indiceChamp}>
                    8 caractères minimum{editingAdmin ? ' — laisse vide pour ne rien changer' : ''}
                  </span>
                </div>

                {/* Rôle */}
                <div style={styles.formGroup}>
                  <label style={styles.label}><Shield size={14} />Rôle</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={styles.select}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button
                  onClick={handleSave}
                  style={styles.saveBtn}
                  disabled={uploading || savingPassword}
                >
                  {uploading || savingPassword ? 'Sauvegarde...' : (
                    <><Save size={16} />{editingAdmin ? 'Modifier' : 'Créer'}</>
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

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)`,
    pointerEvents: 'none', zIndex: 0,
  },
  bgOrb1: {
    position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0,
  },
  bgOrb2: {
    position: 'fixed', bottom: '-30%', left: '-15%', width: '800px', height: '800px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0,
  },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#0A0A0F' },
  loadingPulse: { animation: 'float 2s ease-in-out infinite' },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px' },
  loadingBar: { width: '200px', height: '2px', background: 'rgba(245,158,11,0.1)', borderRadius: '2px', overflow: 'hidden' },
  loadingBarFill: { width: '40%', height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: '2px', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' },
  header: { background: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(245, 158, 11, 0.15)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: '1200px', margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  logoContainer: { width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { display: 'flex', flexDirection: 'column' },
  headerTitle: { color: '#FFFFFF', fontSize: 'clamp(16px, 3vw, 20px)', fontWeight: '700', letterSpacing: '2px', margin: 0, lineHeight: '1.2' },
  headerSubtitle: { color: '#F59E0B', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '500' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  statBadge: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '8px 16px', borderRadius: '10px', color: '#F59E0B', fontSize: '14px', fontWeight: '600' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', padding: '10px 20px', borderRadius: '10px', color: '#000', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
  main: { padding: '24px 20px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 },
  filterBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  filterBannerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  filterLogo: { width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(245, 158, 11, 0.3)' },
  filterLogoPlaceholder: { width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  filterLabel: { display: 'block', color: '#888', fontSize: '12px' },
  filterName: { display: 'block', color: '#F59E0B', fontSize: '16px', fontWeight: '600' },
  clearFilterBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '8px 14px', color: '#EF4444', fontSize: '13px', cursor: 'pointer' },
  searchSection: { marginBottom: '24px' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 20px' },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '15px' },
  clearSearchBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  listContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' },
  emptyIcon: { width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', animation: 'float 3s ease-in-out infinite' },
  emptyTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' },
  emptyText: { color: '#666', fontSize: '14px', marginBottom: '24px' },
  emptyBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', padding: '14px 28px', borderRadius: '12px', color: '#000', fontWeight: '700', fontSize: '15px', cursor: 'pointer' },
  adminCard: { display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px 20px', animation: 'fadeInUp 0.5s ease forwards', transition: 'all 0.3s ease', flexWrap: 'wrap' },
  avatarSection: { position: 'relative', flexShrink: 0 },
  avatar: { width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover', border: '2px solid rgba(245, 158, 11, 0.3)' },
  avatarPlaceholder: { width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '700', fontSize: '16px' },
  superAdminBadge: { position: 'absolute', bottom: '-4px', right: '-4px', width: '20px', height: '20px', borderRadius: '6px', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', border: '2px solid #0A0A0F' },
  adminInfo: { flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' },
  adminNameRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  adminName: { color: '#FFFFFF', fontSize: '16px', fontWeight: '600' },
  roleBadge: { display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid' },
  credentialsRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  credential: { display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px' },
  entreprisesRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  entreprisesCount: { color: '#888', fontSize: '12px' },
  entrepriseChip: { background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: '500' },
  moreChip: { background: 'rgba(255,255,255,0.1)', color: '#888', fontSize: '11px', padding: '3px 10px', borderRadius: '10px' },
  // ✅ NOUVEAUX STYLES
  noAuthBadge: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', fontSize: '10px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', width: 'fit-content' },
  authInfoBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10B981', fontSize: '11px', padding: '6px 10px', borderRadius: '8px', marginBottom: '4px' },
  authWarnBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#F59E0B', fontSize: '11px', padding: '6px 10px', borderRadius: '8px', marginBottom: '4px' },
  actionsRow: { display: 'flex', gap: '8px', flexShrink: 0 },
  actionBtn: { width: '40px', height: '40px', borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' },
  actionBtnGold: { background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' },
  actionBtnBlue: { background: 'rgba(99, 102, 241, 0.15)', color: '#6366F1' },
  actionBtnRed: { background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' },
  footer: { marginTop: '48px', paddingBottom: '24px' },
  footerLine: { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.2), transparent)', marginBottom: '20px' },
  footerText: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555', fontSize: '12px', letterSpacing: '2px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 200, overflowY: 'auto' },
  modal: { background: '#0F0F19', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' },
  formModal: { background: '#0F0F19', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' },
  confirmModal: { background: '#0F0F19', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '380px', padding: '30px', textAlign: 'center' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  modalTitleRow: { display: 'flex', alignItems: 'center', gap: '14px' },
  modalIconWrap: { width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '600', margin: 0 },
  modalSubtitle: { color: '#F59E0B', fontSize: '13px', margin: '2px 0 0 0' },
  closeBtn: { width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalBody: { padding: '20px' },
  modalLoading: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: '#F59E0B' },
  modalSection: { marginBottom: '20px' },
  modalSectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF', fontSize: '13px', fontWeight: '600', marginBottom: '12px' },
  noDataText: { color: '#666', fontSize: '14px', textAlign: 'center', padding: '20px' },
  entreprisesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  entrepriseItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' },
  entrepriseItemAdd: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '12px' },
  entrepriseItemLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  entItemLogo: { width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' },
  entItemLogoPlaceholder: { width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  entItemLogoPlaceholderGray: { width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  entItemInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  entItemName: { color: '#FFFFFF', fontSize: '14px', fontWeight: '500' },
  entItemNameGray: { color: '#888', fontSize: '14px' },
  roleSelect: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: '#FFFFFF', outline: 'none' },
  removeEntBtn: { width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  addEntBtn: { width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: 'none', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  limitWarning: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '14px', color: '#F59E0B', fontSize: '13px' },
  modalFooter: { display: 'flex', gap: '12px', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  modalPrimaryBtn: { flex: 1, padding: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', borderRadius: '12px', color: '#000', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', borderRadius: '12px', color: '#000', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  deleteBtn: { flex: 1, padding: '14px', background: '#EF4444', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  confirmIconWrap: { width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' },
  confirmTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '600', margin: '0 0 12px 0' },
  confirmText: { color: '#888', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' },
  confirmActions: { display: 'flex', gap: '12px' },
  formBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  photoSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '8px' },
  photoUpload: { position: 'relative', width: '90px', height: '90px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' },
  photoPreviewImg: { width: '100%', height: '100%', objectFit: 'cover' },
  photoPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#666', fontSize: '11px' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '6px', display: 'flex', justifyContent: 'center' },
  removePhotoBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px', fontWeight: '500' },
  input: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' },
  indiceChamp: {
    display: 'block',
    marginTop: '6px',
    fontSize: '11px',
    color: '#6B6B6B',
  },
  passwordWrapper: { position: 'relative' },
  passwordToggle: { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer' },
  divider: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '12px', fontWeight: '600', margin: '8px 0' },
}