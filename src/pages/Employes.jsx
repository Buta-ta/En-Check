// ═══════════════════════════════════════════════════════════
// 👥 PAGE GESTION DES EMPLOYÉS (CORRIGÉE AVEC SHARE2 ET MODAL SUPPRESSION)
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
  Camera,
  Upload,
  QrCode,
  Clock,
  Share2,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import BadgeEmploye from '../components/BadgeEmploye'

export default function Employes() {
  const [admin, setAdmin] = useState(null)
  const [employes, setEmployes] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [plannings, setPlannings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false) // ✅ MODAL SUPPRESSION
  const [showBadge, setShowBadge] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [employeeToDelete, setEmployeeToDelete] = useState(null) // ✅ EMPLOYE A SUPPRIMER
  const [badgeEmployee, setBadgeEmployee] = useState(null)
  const [selectedEmployeeForSchedule, setSelectedEmployeeForSchedule] = useState(null)
  
  const [showPin, setShowPin] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // 🔐 MODULES ACTIVÉS
  const [modulePlanning, setModulePlanning] = useState(false)
  const [moduleQRCode, setModuleQRCode] = useState(false)
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef(null)

  // Jours de la semaine
  const joursSemaine = [
    { id: 1, nom: 'Lundi', court: 'Lun' },
    { id: 2, nom: 'Mardi', court: 'Mar' },
    { id: 3, nom: 'Mercredi', court: 'Mer' },
    { id: 4, nom: 'Jeudi', court: 'Jeu' },
    { id: 5, nom: 'Vendredi', court: 'Ven' },
    { id: 6, nom: 'Samedi', court: 'Sam' },
    { id: 7, nom: 'Dimanche', court: 'Dim' },
  ]

  // Formulaire employé
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
    photo_url: ''
  })

  // Formulaire horaires
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
    setAdmin(parsedAdmin)
    loadData(parsedAdmin)
  }, [navigate])

  const loadData = async (adminData) => {
    try {
      // 1. Charger les employés
      let employesQuery = supabase
        .from('employees')
        .select('*, enterprises(name, matricule_prefix, logo_url, primary_color, module_planning, module_qr_scanner)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (adminData.role !== 'super_admin') {
        employesQuery = employesQuery.eq('enterprise_id', adminData.enterprise_id)
      } else {
        const enterpriseFilter = searchParams.get('enterprise')
        if (enterpriseFilter) {
          employesQuery = employesQuery.eq('enterprise_id', enterpriseFilter)
        }
      }

      const { data: employesData, error: empError } = await employesQuery
      
      if (empError) {
        console.error('Erreur employés:', empError)
      }

      // 2. Charger les horaires des employés
      let employesAvecHoraires = employesData || []
      
      if (employesData && employesData.length > 0) {
        const employeeIds = employesData.map(e => e.id)
        
        const { data: schedulesData, error: schedError } = await supabase
          .from('employee_schedules')
          .select('*, work_schedules(id, name, start_time, end_time)')
          .in('employee_id', employeeIds)

        if (schedError) {
          console.error('Erreur horaires:', schedError)
        } else {
          employesAvecHoraires = employesData.map(emp => {
            const schedule = schedulesData?.find(s => s.employee_id === emp.id)
            return {
              ...emp,
              employee_schedules: schedule ? [schedule] : []
            }
          })
        }
      }

      setEmployes(employesAvecHoraires)

      // 3. Charger les entreprises et vérifier les modules
      if (adminData.role === 'super_admin') {
        const { data: entreprisesData } = await supabase
          .from('enterprises')
          .select('*')
          .eq('is_active', true)
        setEntreprises(entreprisesData || [])
        
        // Super admin a accès à tout
        setModulePlanning(true)
        setModuleQRCode(true)
      } else {
        const { data: entrepriseData } = await supabase
          .from('enterprises')
          .select('*')
          .eq('id', adminData.enterprise_id)
          .single()
        setEntreprises(entrepriseData ? [entrepriseData] : [])
        
        // 🔐 Vérifier les modules activés pour cette entreprise
        if (entrepriseData) {
          setModulePlanning(entrepriseData.module_planning || false)
          setModuleQRCode(entrepriseData.module_qr_scanner || false)
        }
      }

      // 4. Charger les plannings (seulement si module activé ou super admin)
      if (adminData.role === 'super_admin' || modulePlanning) {
        let planningsQuery = supabase
          .from('work_schedules')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (adminData.role !== 'super_admin') {
          planningsQuery = planningsQuery.eq('enterprise_id', adminData.enterprise_id)
        }

        const { data: planningsData } = await planningsQuery
        setPlannings(planningsData || [])
      }

    } catch (error) {
      console.error('Erreur chargement:', error)
    }
    setLoading(false)
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
    
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('enterprise_id', enterpriseId)

    const numero = ((count || 0) + 1).toString().padStart(4, '0')
    return `${prefix}-${numero}`
  }

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

  const uploadPhoto = async (matricule) => {
    if (!photoFile) return null

    setUploading(true)

    try {
      const extension = photoFile.name.split('.').pop()
      const fileName = `${matricule}-${Date.now()}.${extension}`

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

  const handleAdd = async () => {
    const defaultEnterpriseId = admin.role === 'super_admin' 
      ? (entreprises[0]?.id || '') 
      : admin.enterprise_id

    const matricule = await genererMatricule(defaultEnterpriseId)

    setFormData({
      enterprise_id: defaultEnterpriseId,
      matricule: matricule,
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      pin: '',
      photo_url: ''
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
      photo_url: employee.photo_url || ''
    })
    setEditingEmployee(employee)
    setPhotoPreview(employee.photo_url || null)
    setPhotoFile(null)
    setShowModal(true)
  }

  const handleShowBadge = (employee) => {
    setBadgeEmployee(employee)
    setShowBadge(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.first_name || !formData.last_name) {
        alert('Le prénom et le nom sont obligatoires')
        return
      }

      if (!editingEmployee && !formData.pin) {
        alert('Le code PIN est obligatoire pour un nouvel employé')
        return
      }

      if (formData.pin && formData.pin.length !== 4) {
        alert('Le code PIN doit contenir 4 chiffres')
        return
      }

      let pinHash = null
      if (formData.pin) {
        pinHash = await hasherPin(formData.pin)
      }

      let photoUrl = formData.photo_url
      if (photoFile) {
        const uploadedUrl = await uploadPhoto(formData.matricule)
        if (uploadedUrl) {
          photoUrl = uploadedUrl
        }
      }

      if (editingEmployee) {
        const updateData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          department: formData.department || null,
          position: formData.position || null,
          photo_url: photoUrl || null,
          updated_at: new Date().toISOString()
        }

        if (pinHash) {
          updateData.pin_hash = pinHash
        }

        await supabase
          .from('employees')
          .update(updateData)
          .eq('id', editingEmployee.id)

        toast.success('Employé modifié !')

      } else {
        await supabase
          .from('employees')
          .insert({
            enterprise_id: formData.enterprise_id,
            matricule: formData.matricule,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email || null,
            phone: formData.phone || null,
            department: formData.department || null,
            position: formData.position || null,
            pin_hash: pinHash,
            photo_url: photoUrl || null,
            is_active: true
          })

        toast.success('Employé ajouté !')
      }

      setShowModal(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      loadData(admin)

    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // ✅ LOGIQUE DE SUPPRESSION AVEC MODAL
  const initiateDelete = (employee) => {
    setEmployeeToDelete(employee)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!employeeToDelete) return

    try {
      await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', employeeToDelete.id)

      toast.success('Employé supprimé')
      loadData(admin)
    } catch (error) {
      console.error('Erreur suppression:', error)
      toast.error('Erreur lors de la suppression')
    } finally {
      setShowDeleteModal(false)
      setEmployeeToDelete(null)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ⏰ GÉRER LES HORAIRES D'UN EMPLOYÉ
  // ═══════════════════════════════════════════════════════════
  const handleOpenSchedule = async (employee) => {
    setSelectedEmployeeForSchedule(employee)
    
    const { data: existingSchedule } = await supabase
      .from('employee_schedules')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle()

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
        schedule_id: '',
        use_custom_hours: false,
        custom_start_time: '08:00',
        custom_end_time: '17:00',
        custom_break_start: '12:00',
        custom_break_end: '13:00',
        custom_has_break: true,
        custom_work_days: [1, 2, 3, 4, 5]
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

      const { data: existing } = await supabase
        .from('employee_schedules')
        .select('id')
        .eq('employee_id', selectedEmployeeForSchedule.id)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('employee_schedules')
          .update(dataToSave)
          .eq('id', existing.id)
      } else {
        await supabase
          .from('employee_schedules')
          .insert(dataToSave)
      }

      toast.success('Horaires enregistrés !')
      setShowScheduleModal(false)
      loadData(admin)

    } catch (error) {
      console.error('Erreur sauvegarde horaires:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const toggleJourTravail = (jourId) => {
    if (scheduleFormData.custom_work_days.includes(jourId)) {
      setScheduleFormData({
        ...scheduleFormData,
        custom_work_days: scheduleFormData.custom_work_days.filter(j => j !== jourId)
      })
    } else {
      setScheduleFormData({
        ...scheduleFormData,
        custom_work_days: [...scheduleFormData.custom_work_days, jourId].sort()
      })
    }
  }

  const getEmployeeScheduleInfo = (employee) => {
    // Vérifier si le module est activé pour cette entreprise
    const entreprise = employee.enterprises
    const moduleActif = admin?.role === 'super_admin' || entreprise?.module_planning
    
    if (!moduleActif) {
      return null // Ne rien afficher si module non activé
    }
    
    const scheduleData = employee.employee_schedules?.[0]
    
    if (!scheduleData) {
      return 'Non défini'
    }
    
    if (scheduleData.use_custom_hours) {
      const start = scheduleData.custom_start_time?.slice(0, 5) || '--:--'
      const end = scheduleData.custom_end_time?.slice(0, 5) || '--:--'
      return `${start} - ${end}`
    }
    
    if (scheduleData.schedule_id && scheduleData.work_schedules) {
      const planning = scheduleData.work_schedules
      return planning.name
    }
    
    if (scheduleData.schedule_id) {
      return 'Planning attribué'
    }
    
    return 'Non défini'
  }

  // 🔐 Vérifier si le module planning est activé pour un employé
  const isModulePlanningEnabled = (employee) => {
    if (admin?.role === 'super_admin') return true
    return employee.enterprises?.module_planning || false
  }

  // 📱 PARTAGE WHATSAPP DES HORAIRES
  const handleShareSchedule = (employee) => {
    const scheduleData = employee.employee_schedules?.[0]
    let horaires = 'Non défini'
    
    if (scheduleData) {
      if (scheduleData.use_custom_hours) {
        const start = scheduleData.custom_start_time?.slice(0, 5) || '--:--'
        const end = scheduleData.custom_end_time?.slice(0, 5) || '--:--'
        horaires = `${start} - ${end}`
      } else if (scheduleData.work_schedules) {
        const start = scheduleData.work_schedules.start_time?.slice(0, 5) || '--:--'
        const end = scheduleData.work_schedules.end_time?.slice(0, 5) || '--:--'
        horaires = `${scheduleData.work_schedules.name} (${start} - ${end})`
      }
    }

    const message = `📋 *Horaires de travail*\n\n👤 *${employee.first_name} ${employee.last_name}*\n🆔 Matricule: ${employee.matricule}\n⏰ Horaires: ${horaires}\n\n_Envoyé via En-Check_`
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const employesFiltres = employes.filter(emp => {
    const search = searchTerm.toLowerCase()
    return (
      emp.first_name?.toLowerCase().includes(search) ||
      emp.last_name?.toLowerCase().includes(search) ||
      emp.matricule?.toLowerCase().includes(search) ||
      emp.department?.toLowerCase().includes(search) ||
      emp.position?.toLowerCase().includes(search)
    )
  })

  const handleEnterpriseChange = async (enterpriseId) => {
    const matricule = await genererMatricule(enterpriseId)
    setFormData({ ...formData, enterprise_id: enterpriseId, matricule })
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setFormData({ ...formData, photo_url: '' })
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Footprints size={50} color="#8B6914" className="loading-walk" />
        <p>Chargement des employés...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
          <Footprints size={32} color="#FFFBF5" />
          <h1 style={styles.headerTitle}>EMPLOYÉS</h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <div style={styles.searchContainer}>
            <Search size={20} color="#9E9E9E" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <button onClick={handleAdd} style={styles.addBtn}>
            <Plus size={20} />
            Ajouter
          </button>
        </div>

        <div style={styles.stats}>
          <Users size={20} color="#8B6914" />
          <span>{employesFiltres.length} employé(s)</span>
        </div>

        <div style={styles.list}>
          {employesFiltres.length === 0 ? (
            <div style={styles.empty}>
              <Users size={60} color="#C4A574" />
              <p>Aucun employé trouvé</p>
            </div>
          ) : (
            employesFiltres.map((employee) => (
              <div key={employee.id} style={styles.employeeCard}>
                <div style={styles.avatar}>
                  {employee.photo_url ? (
                    <img src={employee.photo_url} alt="" style={styles.avatarImg} />
                  ) : (
                    <span style={styles.avatarInitials}>
                      {employee.first_name?.[0]}{employee.last_name?.[0]}
                    </span>
                  )}
                </div>

                <div style={styles.employeeInfo}>
                  <span style={styles.employeeName}>
                    {employee.first_name} {employee.last_name}
                  </span>
                  <span style={styles.employeeMatricule}>
                    {employee.matricule}
                  </span>
                  {employee.position && (
                    <span style={styles.employeePosition}>
                      {employee.position}
                      {employee.department && ` • ${employee.department}`}
                    </span>
                  )}
                  {admin.role === 'super_admin' && (
                    <span style={styles.employeeEntreprise}>
                      🏢 {employee.enterprises?.name}
                    </span>
                  )}
                  {/* 🔐 Afficher horaires seulement si module activé */}
                  {getEmployeeScheduleInfo(employee) && (
                    <span style={styles.employeeSchedule}>
                      🕐 {getEmployeeScheduleInfo(employee)}
                    </span>
                  )}
                </div>

                <div style={styles.actions}>
                  {/* 🔐 Bouton Horaires - seulement si module activé */}
                  {isModulePlanningEnabled(employee) && (
                    <button 
                      onClick={() => handleOpenSchedule(employee)} 
                      style={styles.actionBtn}
                      title="Définir les horaires"
                    >
                      <Clock size={18} color="#4A7C59" />
                    </button>
                  )}

                  {/* 📱 Bouton Partage WhatsApp */}
                  {isModulePlanningEnabled(employee) && (
                    <button 
                      onClick={() => handleShareSchedule(employee)} 
                      style={{...styles.actionBtn, background: '#25D366'}}
                      title="Partager les horaires"
                    >
                      <Share2 size={18} color="#fff" />
                    </button>
                  )}
                  
                  {/* 🔐 Bouton Badge QR - toujours visible (le badge basique) */}
                  <button 
                    onClick={() => handleShowBadge(employee)} 
                    style={styles.actionBtn}
                    title="Générer Badge"
                  >
                    <QrCode size={18} color="#8B6914" />
                  </button>
                  
                  <button 
                    onClick={() => handleEdit(employee)} 
                    style={styles.actionBtn}
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => initiateDelete(employee)} 
                    style={{...styles.actionBtn, ...styles.deleteBtn}}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ✅ MODAL SUPPRESSION */}
      {showDeleteModal && employeeToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.modalIconContainer}>
              <AlertTriangle size={32} color="#9B2C2C" />
            </div>
            
            <h3 style={styles.modalTitle}>Confirmer la suppression</h3>
            
            <p style={styles.modalText}>
              Voulez-vous vraiment supprimer l'employé <strong>{employeeToDelete.first_name} {employeeToDelete.last_name}</strong> ?
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

      {/* Modal Employé */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingEmployee ? 'Modifier l\'employé' : 'Nouvel employé'}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            <div style={styles.modalBody}>
              
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
                      <span style={styles.photoText}>Ajouter photo</span>
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

              {admin.role === 'super_admin' && !editingEmployee && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Entreprise</label>
                  <select
                    value={formData.enterprise_id}
                    onChange={(e) => handleEnterpriseChange(e.target.value)}
                    style={styles.select}
                  >
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Matricule</label>
                <input
                  type="text"
                  value={formData.matricule}
                  disabled
                  style={{...styles.input, background: '#f0f0f0'}}
                />
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

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Code PIN (4 chiffres) {editingEmployee ? '(laisser vide pour ne pas changer)' : '*'}
                </label>
                <div style={styles.pinContainer}>
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={formData.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setFormData({...formData, pin: value})
                    }}
                    style={styles.input}
                    placeholder="••••"
                    maxLength={4}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPin(!showPin)} 
                    style={styles.pinToggle}
                  >
                    {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Poste / Rôle</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    style={styles.input}
                    placeholder="Ex: Développeur"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Département</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    style={styles.input}
                    placeholder="Ex: Informatique"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    style={styles.input}
                    placeholder="email@exemple.com"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    style={styles.input}
                    placeholder="+221 77 000 00 00"
                  />
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button 
                onClick={handleSave} 
                style={styles.saveBtn}
                disabled={uploading}
              >
                {uploading ? (
                  'Upload en cours...'
                ) : (
                  <>
                    <Save size={20} />
                    {editingEmployee ? 'Modifier' : 'Ajouter'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Badge */}
      {showBadge && badgeEmployee && (
        <BadgeEmploye 
          employee={badgeEmployee}
          entrepriseName={badgeEmployee.enterprises?.name || 'En-Check'}
          entrepriseLogo={badgeEmployee.enterprises?.logo_url}
          primaryColor={badgeEmployee.enterprises?.primary_color ?? '#D4AF37'} 
          onClose={() => setShowBadge(false)}
        />
      )}

      {/* Modal Horaires - seulement si module activé */}
      {showScheduleModal && selectedEmployeeForSchedule && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Horaires de {selectedEmployeeForSchedule.first_name} {selectedEmployeeForSchedule.last_name}
              </h2>
              <button onClick={() => setShowScheduleModal(false)} style={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.scheduleChoice}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={!scheduleFormData.use_custom_hours}
                    onChange={() => setScheduleFormData({...scheduleFormData, use_custom_hours: false})}
                    style={styles.radio}
                  />
                  <div>
                    <span style={styles.radioTitle}>Utiliser un planning existant</span>
                    <span style={styles.radioDesc}>Sélectionnez parmi les plannings de l'entreprise</span>
                  </div>
                </label>

                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={scheduleFormData.use_custom_hours}
                    onChange={() => setScheduleFormData({...scheduleFormData, use_custom_hours: true})}
                    style={styles.radio}
                  />
                  <div>
                    <span style={styles.radioTitle}>Horaires personnalisés</span>
                    <span style={styles.radioDesc}>Définir des horaires spécifiques pour cet employé</span>
                  </div>
                </label>
              </div>

              {!scheduleFormData.use_custom_hours && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Sélectionner un planning</label>
                  <select
                    value={scheduleFormData.schedule_id}
                    onChange={(e) => setScheduleFormData({...scheduleFormData, schedule_id: e.target.value})}
                    style={styles.select}
                  >
                    <option value="">-- Aucun planning --</option>
                    {plannings
                      .filter(p => p.enterprise_id === selectedEmployeeForSchedule.enterprise_id)
                      .map((planning) => (
                        <option key={planning.id} value={planning.id}>
                          {planning.name} ({planning.start_time?.slice(0, 5)} - {planning.end_time?.slice(0, 5)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {scheduleFormData.use_custom_hours && (
                <>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Heure d'arrivée</label>
                      <input
                        type="time"
                        value={scheduleFormData.custom_start_time}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, custom_start_time: e.target.value})}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Heure de départ</label>
                      <input
                        type="time"
                        value={scheduleFormData.custom_end_time}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, custom_end_time: e.target.value})}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={scheduleFormData.custom_has_break}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, custom_has_break: e.target.checked})}
                        style={styles.checkboxInput}
                      />
                      Pause déjeuner
                    </label>
                  </div>

                  {scheduleFormData.custom_has_break && (
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Début pause</label>
                        <input
                          type="time"
                          value={scheduleFormData.custom_break_start}
                          onChange={(e) => setScheduleFormData({...scheduleFormData, custom_break_start: e.target.value})}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Fin pause</label>
                        <input
                          type="time"
                          value={scheduleFormData.custom_break_end}
                          onChange={(e) => setScheduleFormData({...scheduleFormData, custom_break_end: e.target.value})}
                          style={styles.input}
                        />
                      </div>
                    </div>
                  )}

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Jours de travail</label>
                    <div style={styles.daysGrid}>
                      {joursSemaine.map((jour) => (
                        <button
                          key={jour.id}
                          type="button"
                          onClick={() => toggleJourTravail(jour.id)}
                          style={{
                            ...styles.dayBtn,
                            ...(scheduleFormData.custom_work_days.includes(jour.id) ? styles.dayBtnActive : {})
                          }}
                        >
                          {jour.court}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowScheduleModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button onClick={handleSaveSchedule} style={styles.saveBtn}>
                <Save size={20} />
                Enregistrer
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
  employeeCard: { display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBF5', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexWrap: 'wrap' },
  avatar: { width: '50px', height: '50px', borderRadius: '50%', background: '#C4A574', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: { color: '#3D2B1F', fontWeight: '600', fontSize: '18px' },
  employeeInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '200px' },
  employeeName: { fontWeight: '600', color: '#3D2B1F', fontSize: '16px' },
  employeeMatricule: { color: '#8B6914', fontSize: '14px' },
  employeePosition: { color: '#9E9E9E', fontSize: '13px' },
  employeeEntreprise: { color: '#C4A574', fontSize: '12px', marginTop: '4px' },
  employeeSchedule: { display: 'flex', alignItems: 'center', gap: '4px', color: '#4A7C59', fontSize: '12px', marginTop: '2px' },
  actions: { display: 'flex', gap: '8px' },
  actionBtn: { background: '#E5D4C0', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', color: '#3D2B1F', display: 'flex', alignItems: 'center', justifyContent: 'center' },
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
  input: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box' },
  select: { padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' },
  pinContainer: { position: 'relative', display: 'flex', alignItems: 'center' },
  pinToggle: { position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5D4C0' },
  cancelBtn: { padding: '12px 24px', background: '#E5D4C0', color: '#3D2B1F', border: 'none', borderRadius: '10px', fontWeight: '500', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#8B6914', color: '#FFFBF5', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
  
  // Styles pour les horaires
  scheduleChoice: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' },
  radioLabel: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: '#F5F0EB', borderRadius: '12px', cursor: 'pointer', border: '2px solid transparent', transition: 'border-color 0.2s' },
  radio: { width: '20px', height: '20px', accentColor: '#8B6914', marginTop: '2px' },
  radioTitle: { display: 'block', fontWeight: '600', color: '#3D2B1F', fontSize: '15px' },
  radioDesc: { display: 'block', fontSize: '13px', color: '#9E9E9E', marginTop: '2px' },
  daysGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  dayBtn: { padding: '10px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#3D2B1F', transition: 'all 0.2s' },
  dayBtnActive: { background: '#8B6914', borderColor: '#8B6914', color: '#fff' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500', color: '#3D2B1F', cursor: 'pointer' },
  checkboxInput: { width: '18px', height: '18px', accentColor: '#8B6914' },

  // ✅ STYLES MODAL CONFIRMATION
  confirmModal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' },
  modalIconContainer: { width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F', marginBottom: '12px' },
  modalText: { color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' },
  modalButtons: { display: 'flex', gap: '12px' },
  confirmDeleteBtn: { flex: 1, padding: '12px', background: '#9B2C2C', color: '#FFF', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
}