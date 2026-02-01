// ═══════════════════════════════════════════════════════════
// 📊 PAGE POINTAGES (VERSION FINALE - SANS MODE SOMBRE + SECONDES)
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { 
  Footprints, // ✅ AJOUT
  Calendar,
  Building2,
  Download,
  Users,
  Clock,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  formaterHeureLocale, 
  calculerDureeSecondes,
  formaterDureeComplete
} from '../utils/timezoneUtils'


export default function Pointages() {
  const [admin, setAdmin] = useState(null)
  const [pointages, setPointages] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedEntreprise, setSelectedEntreprise] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    // Restaurer le fond clair si le mode sombre était activé ailleurs
    document.body.style.backgroundColor = '#E5D4C0'
    
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    loadEntreprises(parsedAdmin)
  }, [navigate])

  useEffect(() => {
    if (admin) {
      loadPointages()
    }
  }, [admin, selectedDate, selectedEntreprise])

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

  const loadPointages = async () => {
    setLoading(true)
    try {
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

      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      let attendancesQuery = supabase
        .from('attendances')
        .select('*')
        .gte('check_time', startOfDay)
        .lte('check_time', endOfDay)

      if (admin.role !== 'super_admin') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', admin.enterprise_id)
      } else if (selectedEntreprise !== 'all') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', selectedEntreprise)
      }

      const { data: attendances } = await attendancesQuery

      const pointagesData = employees?.map(employee => {
        const empAttendances = attendances?.filter(a => a.employee_id === employee.id) || []
        
        empAttendances.sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

        const firstIn = empAttendances.find(a => a.check_type === 'in')
        const lastOut = [...empAttendances].reverse().find(a => a.check_type === 'out')

        let totalSecondes = 0
        let currentIn = null

        for (const att of empAttendances) {
          if (att.check_type === 'in') {
            currentIn = att.check_time
          } else if (att.check_type === 'out' && currentIn) {
            totalSecondes += calculerDureeSecondes(currentIn, att.check_time)
            currentIn = null
          }
        }

        let status = 'absent'
        if (firstIn) {
          status = 'present'
        }

        return {
          employee,
          firstIn,
          lastOut,
          totalSecondes,
          status,
          attendances: empAttendances
        }
      }) || []

      setPointages(pointagesData)
    } catch (error) {
      console.error('Erreur chargement pointages:', error)
    }
    setLoading(false)
  }

  const confirmDelete = (employeeId) => {
    setItemToDelete(employeeId)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    setLoading(true)
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('employee_id', itemToDelete)
        .gte('check_time', startOfDay)
        .lte('check_time', endOfDay)

      if (error) throw error

      toast.success('Pointages supprimés avec succès')
      loadPointages()
      setShowDeleteModal(false)
      setItemToDelete(null)
      
    } catch (error) {
      console.error('Erreur suppression:', error)
      toast.error('Impossible de supprimer')
    }
    setLoading(false)
  }

  const stats = {
    presents: pointages.filter(p => p.status === 'present').length,
    absents: pointages.filter(p => p.status === 'absent').length,
  }

  const changeDate = (days) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    return date.toLocaleDateString('fr-FR', options)
  }

  const exportCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Entrée', 'Sortie', 'Temps total', 'Statut']
    
    const rows = pointages.map(p => [
      p.employee.matricule,
      p.employee.last_name,
      p.employee.first_name,
      p.employee.position || '',
      formaterHeureLocale(p.firstIn?.check_time),
      formaterHeureLocale(p.lastOut?.check_time),
      formaterDureeComplete(p.totalSecondes),
      p.status === 'present' ? 'Présent' : 'Absent'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pointages_${selectedDate}.csv`
    link.click()
  }

  if (loading && !pointages.length) {
    return (
      <div className="loading-container">
        <Footprints size={50} className="loading-walk" color="#8B6914" />
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <PageHeader title="POINTAGES" />

      <main style={styles.main}>
        <div style={styles.filters}>
          <div style={styles.dateNav}>
            <button onClick={() => changeDate(-1)} style={styles.navBtn}>
              <ChevronLeft size={20} />
            </button>
            <div style={styles.dateDisplay}>
              <Calendar size={18} color="#8B6914" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>
            <button onClick={() => changeDate(1)} style={styles.navBtn}>
              <ChevronRight size={20} />
            </button>
          </div>

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

          <button onClick={exportCSV} style={styles.exportBtn}>
            <Download size={18} />
            Exporter CSV
          </button>
        </div>

        <p style={styles.dateLabel}>{formatDate(selectedDate)}</p>

        <div style={styles.statsGrid}>
          <div style={{...styles.statCard, ...styles.statPresent}}>
            <UserCheck size={24} />
            <div>
              <span style={styles.statNumber}>{stats.presents}</span>
              <span style={styles.statLabel}>Présents</span>
            </div>
          </div>
          <div style={{...styles.statCard, ...styles.statAbsent}}>
            <UserX size={24} />
            <div>
              <span style={styles.statNumber}>{stats.absents}</span>
              <span style={styles.statLabel}>Absents</span>
            </div>
          </div>
        </div>

        <div style={styles.list}>
          {pointages.length === 0 ? (
            <div style={styles.empty}>
              <Clock size={60} color="#C4A574" />
              <p>Aucun employé trouvé</p>
            </div>
          ) : (
            pointages.map((p) => (
              <div key={p.employee.id} style={styles.pointageCard}>
                <div style={styles.avatar}>
                  {p.employee.photo_url ? (
                    <img src={p.employee.photo_url} alt="" style={styles.avatarImg} />
                  ) : (
                    <span style={styles.avatarInitials}>
                      {p.employee.first_name?.[0]}{p.employee.last_name?.[0]}
                    </span>
                  )}
                </div>

                <div style={styles.employeeInfo}>
                  <span style={styles.employeeName}>
                    {p.employee.first_name} {p.employee.last_name}
                  </span>
                  <span style={styles.employeeMatricule}>
                    {p.employee.matricule}
                    {p.employee.position && ` • ${p.employee.position}`}
                  </span>
                </div>

                <div style={styles.timeBlock}>
                  <LogIn size={16} color={p.firstIn ? '#4A7C59' : '#9E9E9E'} />
                  <span style={{
                    ...styles.time,
                    color: p.firstIn ? '#4A7C59' : '#9E9E9E'
                  }}>
                    {formaterHeureLocale(p.firstIn?.check_time)}
                  </span>
                </div>

                <span style={styles.arrow}>→</span>

                <div style={styles.timeBlock}>
                  <LogOut size={16} color={p.lastOut ? '#8B6914' : '#9E9E9E'} />
                  <span style={{
                    ...styles.time,
                    color: p.lastOut ? '#8B6914' : '#9E9E9E'
                  }}>
                    {formaterHeureLocale(p.lastOut?.check_time)}
                  </span>
                </div>

                <div style={styles.duration}>
                  <Clock size={14} color="#8B6914" />
                  <span>{formaterDureeComplete(p.totalSecondes)}</span>
                </div>

                <div style={{
                  ...styles.statusBadge,
                  background: p.status === 'present' ? '#DEF7EC' : '#FEE2E2',
                  color: p.status === 'present' ? '#03543F' : '#9B2C2C'
                }}>
                  {p.status === 'present' ? '✓ Présent' : '✗ Absent'}
                </div>

                {p.status === 'present' && (
                  <button 
                    onClick={() => confirmDelete(p.employee.id)}
                    style={styles.deleteBtn}
                    title="Supprimer cette journée"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {showDeleteModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.modalIconContainer}>
              <AlertTriangle size={32} color="#9B2C2C" />
            </div>
            
            <h3 style={styles.modalTitle}>Confirmer la suppression</h3>
            
            <p style={styles.modalText}>
              Voulez-vous vraiment supprimer tous les pointages de cet employé pour cette journée ?
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
                onClick={handleDelete}
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
  header: { background: '#3D2B1F', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px', color: '#FFFBF5', cursor: 'pointer' },
  headerTitle: { color: '#FFFBF5', fontSize: '24px', fontWeight: '300', letterSpacing: '4px' },
  main: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  filters: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  dateNav: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFBF5', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#3D2B1F', padding: '4px' },
  dateDisplay: { display: 'flex', alignItems: 'center', gap: '8px' },
  dateInput: { border: 'none', background: 'none', fontSize: '15px', color: '#3D2B1F', cursor: 'pointer' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFBF5', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  select: { border: 'none', background: 'none', fontSize: '15px', color: '#3D2B1F', cursor: 'pointer', outline: 'none' },
  exportBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: '#8B6914', color: '#FFFBF5', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: '500', cursor: 'pointer', marginLeft: 'auto' },
  dateLabel: { color: '#3D2B1F', fontSize: '18px', marginBottom: '20px', textTransform: 'capitalize' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  statPresent: { background: '#DEF7EC', color: '#03543F' },
  statAbsent: { background: '#FEE2E2', color: '#9B2C2C' },
  statNumber: { display: 'block', fontSize: '28px', fontWeight: '600' },
  statLabel: { display: 'block', fontSize: '13px' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9E9E9E' },
  pointageCard: { display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBF5', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexWrap: 'wrap' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', background: '#C4A574', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: { color: '#3D2B1F', fontWeight: '600', fontSize: '16px' },
  employeeInfo: { flex: 1, minWidth: '150px' },
  employeeName: { display: 'block', fontWeight: '600', color: '#3D2B1F', fontSize: '15px' },
  employeeMatricule: { display: 'block', color: '#9E9E9E', fontSize: '13px' },
  timeBlock: { display: 'flex', alignItems: 'center', gap: '6px' },
  time: { fontSize: '14px', fontWeight: '500', fontFamily: 'monospace' },
  arrow: { color: '#C4A574', fontSize: '18px' },
  duration: { display: 'flex', alignItems: 'center', gap: '6px', color: '#8B6914', fontSize: '13px', fontWeight: '600', minWidth: '120px', fontFamily: 'monospace' },
  statusBadge: { padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  deleteBtn: { background: 'none', border: 'none', color: '#9E9E9E', cursor: 'pointer', padding: '8px', marginLeft: 'auto' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 },
  confirmModal: { background: '#FFFBF5', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' },
  modalIconContainer: { width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F', marginBottom: '12px' },
  modalText: { color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' },
  modalButtons: { display: 'flex', gap: '12px' },
  cancelBtn: { flex: 1, padding: '12px', background: '#E5D4C0', color: '#3D2B1F', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
  confirmDeleteBtn: { flex: 1, padding: '12px', background: '#9B2C2C', color: '#FFF', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' },
}