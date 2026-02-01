// ═══════════════════════════════════════════════════════════
// ⏰ PAGE GESTION DES RETARDS (Avec Modal Suppression)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { 
  Footprints, 
  ArrowLeft,
  Clock,
  AlertTriangle,
  Users,
  Building2,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  UserX,
  Timer,
  Trash2 // ✅
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Retards() {
  const [admin, setAdmin] = useState(null)
  const [retards, setRetards] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntreprise, setSelectedEntreprise] = useState('all')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState('jour')
  
  // ✅ MODAL SUPPRESSION
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [retardToDelete, setRetardToDelete] = useState(null)

  const [stats, setStats] = useState({
    totalRetards: 0,
    totalMinutesRetard: 0,
    employesPonctuels: 0,
    employesEnRetard: 0
  })
  
  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    
    const parsedAdmin = JSON.parse(adminData)
    
    // Vérification des droits d'accès au module
    if (parsedAdmin.role !== 'super_admin') {
      checkModuleAccess(parsedAdmin)
    }
    
    setAdmin(parsedAdmin)
    loadEntreprises(parsedAdmin)
  }, [navigate])

  useEffect(() => {
    if (admin) {
      loadRetards()
    }
  }, [admin, selectedDate, selectedEntreprise, viewMode])

  const checkModuleAccess = async (adminData) => {
    const { data } = await supabase
      .from('enterprises')
      .select('module_retards')
      .eq('id', adminData.enterprise_id)
      .single()

    if (!data?.module_retards) {
      toast.error('Module Retards non activé pour votre entreprise')
      navigate('/dashboard')
    }
  }

  const loadEntreprises = async (adminData) => {
    if (adminData.role === 'super_admin') {
      const { data } = await supabase
        .from('enterprises')
        .select('*')
        .eq('is_active', true)
      setEntreprises(data || [])
    } else {
      setSelectedEntreprise(adminData.enterprise_id)
    }
  }

  const loadRetards = async () => {
    setLoading(true)
    try {
      let startDate, endDate
      const date = new Date(selectedDate)

      if (viewMode === 'jour') {
        startDate = selectedDate
        endDate = selectedDate
      } else if (viewMode === 'semaine') {
        const dayOfWeek = date.getDay()
        const monday = new Date(date)
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        startDate = monday.toISOString().split('T')[0]
        endDate = sunday.toISOString().split('T')[0]
      } else {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
      }

      // 1. Charger les employés
      let employeesQuery = supabase
        .from('employees')
        .select('*, enterprises(name)')
        .eq('is_active', true)

      if (admin.role !== 'super_admin') {
        employeesQuery = employeesQuery.eq('enterprise_id', admin.enterprise_id)
      } else if (selectedEntreprise !== 'all') {
        employeesQuery = employeesQuery.eq('enterprise_id', selectedEntreprise)
      }

      const { data: employees } = await employeesQuery

      // 2. Charger les horaires
      const employeeIds = employees?.map(e => e.id) || []
      
      let schedulesData = []
      if (employeeIds.length > 0) {
        const { data: schedules } = await supabase
          .from('employee_schedules')
          .select('*, work_schedules(*)')
          .in('employee_id', employeeIds)

        schedulesData = schedules || []
      }

      // 3. Charger les pointages d'entrée
      let attendancesQuery = supabase
        .from('attendances')
        .select('*')
        .gte('check_time', `${startDate}T00:00:00`)
        .lte('check_time', `${endDate}T23:59:59`)
        .eq('check_type', 'in')
        .order('check_time', { ascending: true })

      if (admin.role !== 'super_admin') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', admin.enterprise_id)
      } else if (selectedEntreprise !== 'all') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', selectedEntreprise)
      }

      const { data: attendances } = await attendancesQuery

      // 4. Calculer les retards
      const retardsCalcules = []
      let totalRetards = 0
      let totalMinutes = 0
      let employesPonctuels = new Set()
      let employesEnRetard = new Set()

      employees?.forEach(employee => {
        const schedule = schedulesData.find(s => s.employee_id === employee.id)
        
        let heureArrivee = '08:00'
        let tolerance = 15

        if (schedule) {
          if (schedule.use_custom_hours && schedule.custom_start_time) {
            heureArrivee = schedule.custom_start_time.slice(0, 5)
          } else if (schedule.schedule_id && schedule.work_schedules) {
            heureArrivee = schedule.work_schedules.start_time?.slice(0, 5) || '08:00'
            tolerance = schedule.work_schedules.late_tolerance_minutes || 15
          }
        }

        const employeeAttendances = attendances?.filter(a => a.employee_id === employee.id) || []
        
        const parJour = {}
        employeeAttendances.forEach(att => {
          const jour = att.check_time.split('T')[0]
          if (!parJour[jour]) {
            parJour[jour] = att
          }
        })

        Object.entries(parJour).forEach(([jour, premierPointage]) => {
          const heurePointage = premierPointage.check_time.split('T')[1].slice(0, 5)
          
          const [hA, mA] = heureArrivee.split(':').map(Number)
          const [hP, mP] = heurePointage.split(':').map(Number)
          
          const minutesArriveeMax = hA * 60 + mA + tolerance
          const minutesPointage = hP * 60 + mP
          
          const retardMinutes = minutesPointage - (hA * 60 + mA)
          const estEnRetard = minutesPointage > minutesArriveeMax

          if (estEnRetard && retardMinutes > 0) {
            totalRetards++
            totalMinutes += retardMinutes
            employesEnRetard.add(employee.id)

            retardsCalcules.push({
              id: premierPointage.id, // ID du pointage pour suppression
              employee,
              date: jour,
              heureArrivee: heureArrivee,
              heurePointage: heurePointage,
              retardMinutes,
              tolerance
            })
          } else {
            employesPonctuels.add(employee.id)
          }
        })
      })

      retardsCalcules.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        return b.retardMinutes - a.retardMinutes
      })

      setRetards(retardsCalcules)
      setStats({
        totalRetards,
        totalMinutesRetard: totalMinutes,
        employesPonctuels: employesPonctuels.size,
        employesEnRetard: employesEnRetard.size
      })

    } catch (error) {
      console.error('Erreur chargement retards:', error)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }

  // ✅ LOGIQUE SUPPRESSION RETARD
  const initiateDelete = (retard) => {
    setRetardToDelete(retard)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!retardToDelete) return

    try {
      // Supprimer le pointage d'entrée qui a causé le retard
      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('id', retardToDelete.id)

      if (error) throw error

      toast.success('Retard (pointage) supprimé')
      loadRetards()
    } catch (e) {
      console.error(e)
      toast.error('Erreur suppression')
    } finally {
      setShowDeleteModal(false)
      setRetardToDelete(null)
    }
  }

  const changeDate = (delta) => {
    const date = new Date(selectedDate)
    if (viewMode === 'jour') {
      date.setDate(date.getDate() + delta)
    } else if (viewMode === 'semaine') {
      date.setDate(date.getDate() + (delta * 7))
    } else {
      date.setMonth(date.getMonth() + delta)
    }
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const formatRetard = (minutes) => {
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h${m.toString().padStart(2, '0')}`
  }

  if (loading && !retards.length) {
    return (
      <div className="loading-container">
        <Footprints size={50} className="loading-walk" color="#8B6914" />
        <p>Chargement des retards...</p>
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
          <h1 style={styles.headerTitle}>RETARDS</h1>
        </div>
      </header>

      <main style={styles.main}>
        {/* Filtres */}
        <div style={styles.filters}>
          <div style={styles.viewModeContainer}>
            {['jour', 'semaine', 'mois'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  ...styles.viewModeBtn,
                  ...(viewMode === mode ? styles.viewModeBtnActive : {})
                }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={styles.dateNav}>
            <button onClick={() => changeDate(-1)} style={styles.navBtn}>
              <ChevronLeft size={20} />
            </button>
            <span style={styles.dateDisplay}>{selectedDate}</span>
            <button onClick={() => changeDate(1)} style={styles.navBtn}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* ✅ FILTRE PAR ENTREPRISE (SUPER ADMIN) */}
          {admin?.role === 'super_admin' && (
            <div style={styles.filterGroup}>
              <Building2 size={18} color="#8B6914" />
              <select
                value={selectedEntreprise}
                onChange={(e) => setSelectedEntreprise(e.target.value)}
                style={styles.select}
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Liste des retards */}
        <div style={styles.list}>
          {retards.length === 0 ? (
            <div style={styles.empty}>
              <Clock size={60} color="#4A7C59" />
              <p>Aucun retard ! 🎉</p>
            </div>
          ) : (
            retards.map((retard, index) => (
              <div key={index} style={styles.retardCard}>
                <div style={styles.retardInfo}>
                  <span style={styles.retardName}>
                    {retard.employee.first_name} {retard.employee.last_name}
                  </span>
                  <span style={styles.retardMatricule}>
                    {retard.employee.matricule}
                  </span>
                  {admin?.role === 'super_admin' && (
                    <span style={styles.retardEntreprise}>
                      🏢 {retard.employee.enterprises?.name}
                    </span>
                  )}
                </div>

                <div style={styles.retardHeures}>
                  <div style={styles.heureItem}>
                    <span style={styles.heureLabel}>Prévu</span>
                    <span style={styles.heureValue}>{retard.heureArrivee}</span>
                  </div>
                  <span style={styles.heureArrow}>→</span>
                  <div style={styles.heureItem}>
                    <span style={styles.heureLabel}>Arrivée</span>
                    <span style={{...styles.heureValue, color: '#9B2C2C'}}>
                      {retard.heurePointage}
                    </span>
                  </div>
                </div>

                <div style={styles.retardBadge}>
                  <AlertTriangle size={14} />
                  <span>+{formatRetard(retard.retardMinutes)}</span>
                </div>

                {/* ✅ BOUTON SUPPRESSION */}
                <button 
                  onClick={() => initiateDelete(retard)} 
                  style={styles.deleteBtn}
                  title="Supprimer ce pointage"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ✅ MODAL CONFIRMATION */}
      {showDeleteModal && retardToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.modalIconContainer}>
              <AlertTriangle size={32} color="#9B2C2C" />
            </div>
            
            <h3 style={styles.modalTitle}>Supprimer ce retard ?</h3>
            
            <p style={styles.modalText}>
              Attention, cela supprimera le <strong>pointage d'entrée</strong> de {retardToDelete.employee.first_name}.<br/>
              L'employé sera considéré comme absent ou devra repointer.
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
  filters: { display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' },
  
  viewModeContainer: { display: 'flex', background: '#FFFBF5', borderRadius: '12px', padding: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  viewModeBtn: { padding: '8px 16px', border: 'none', background: 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' },
  viewModeBtnActive: { background: '#8B6914', color: '#FFFBF5' },
  
  dateNav: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFBF5', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer' },
  dateDisplay: { fontWeight: '600', color: '#3D2B1F', minWidth: '100px', textAlign: 'center' },
  
  filterGroup: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFBF5', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  select: { border: 'none', background: 'none', fontSize: '15px', color: '#3D2B1F', cursor: 'pointer', outline: 'none' },

  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9E9E9E' },
  
  retardCard: { display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBF5', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  retardInfo: { flex: 1 },
  retardName: { display: 'block', fontWeight: '600', color: '#3D2B1F' },
  retardMatricule: { display: 'block', fontSize: '13px', color: '#9E9E9E' },
  retardEntreprise: { display: 'block', fontSize: '12px', color: '#8B6914', marginTop: '2px' },
  
  retardHeures: { display: 'flex', alignItems: 'center', gap: '10px' },
  heureItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  heureLabel: { fontSize: '10px', color: '#9E9E9E' },
  heureValue: { fontWeight: '600', color: '#3D2B1F' },
  heureArrow: { color: '#C4A574' },
  
  retardBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: '#FEE2E2', color: '#9B2C2C', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' },
  deleteBtn: { background: 'none', border: 'none', color: '#9E9E9E', cursor: 'pointer', padding: '8px', marginLeft: 'auto' },
  
  // Modals
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 },
  confirmModal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' },
  modalIconContainer: { width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F', marginBottom: '12px' },
  modalText: { color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' },
  modalButtons: { display: 'flex', gap: '12px' },
  cancelBtn: { flex: 1, padding: '12px', background: '#E5D4C0', color: '#3D2B1F', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
  confirmDeleteBtn: { flex: 1, padding: '12px', background: '#9B2C2C', color: '#FFF', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
}