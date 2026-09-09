// ═══════════════════════════════════════════════════════════
// ⏰ PAGE GESTION DES RETARDS - STYLE DASHBOARD
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import HolidayService from '../services/holidayService'
import { getHeuresMinutesLocales, jourDeTravail, minutesDeBascule } from '../utils/timezoneUtils'
import { 
  Footprints, 
  ArrowLeft,
  Clock,
  AlertTriangle,
  Users,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Timer,
  TrendingUp,
  UserCheck,
  UserX
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Retards() {
  const [admin, setAdmin] = useState(null)
  const [retards, setRetards] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState('jour')
  
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [retardToDelete, setRetardToDelete] = useState(null)

  const [stats, setStats] = useState({
    totalRetards: 0,
    totalMinutesRetard: 0,
    employesPonctuels: 0,
    employesEnRetard: 0,
    employesSansPlanningIgnores: 0,
  })
  
  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)
    
    if (parsedAdmin.role === 'super_admin') {
      loadEntreprises()
    } else {
      checkModuleAccess(parsedAdmin)
      const activeId = parsedAdmin.selectedEnterprise?.id || parsedAdmin.enterprise_id
      setSelectedEntrepriseId(activeId)
    }
  }, [navigate])

  useEffect(() => {
    if (admin) {
      loadRetards()
    }
  }, [admin, selectedDate, selectedEntrepriseId, viewMode])

  const checkModuleAccess = async (adminData) => {
    const enterpriseId = adminData.selectedEnterprise?.id || adminData.enterprise_id
    
    const { data } = await supabase
      .from('enterprises')
      .select('module_retards')
      .eq('id', enterpriseId)
      .single()

    if (!data?.module_retards) {
      toast.error('Module Retards non activé pour cette entreprise')
      navigate('/dashboard')
    }
  }

  const loadEntreprises = async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setEntreprises(data || [])
  }

// ═══ REMPLACER loadRetards() ENTIÈREMENT ═══
const loadRetards = async () => {
  setLoading(true)
  try {
    let startDate, endDate
    const date = new Date(selectedDate)

    if (viewMode === 'jour') {
      startDate = selectedDate
      endDate   = selectedDate
    } else if (viewMode === 'semaine') {
      const dayOfWeek = date.getDay()
      const monday = new Date(date)
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      startDate = monday.toISOString().split('T')[0]
      endDate   = sunday.toISOString().split('T')[0]
    } else {
      startDate = new Date(date.getFullYear(), date.getMonth(), 1)
        .toISOString().split('T')[0]
      endDate   = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        .toISOString().split('T')[0]
    }

    let targetEnterpriseId = selectedEntrepriseId
    if (admin.role !== 'super_admin') {
      targetEnterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id
    }

    // ═══ 1. EMPLOYÉS ═══
    let employeesQuery = supabase
      .from('employees')
      .select('*, enterprises(id, name)')
      .eq('is_active', true)

    if (targetEnterpriseId !== 'all') {
      employeesQuery = employeesQuery.eq('enterprise_id', targetEnterpriseId)
    }

    const { data: employees } = await employeesQuery
    const employeeIds = employees?.map(e => e.id) || []

    if (employeeIds.length === 0) {
      setRetards([])
      setStats({
        totalRetards: 0, totalMinutesRetard: 0,
        employesPonctuels: 0, employesEnRetard: 0,
        employesSansPlanningIgnores: 0,
      })
      setLoading(false)
      return
    }

    // ═══ 2. PLANNINGS INDIVIDUELS ═══
    const { data: employeeSchedules } = await supabase
      .from('employee_schedules')
      .select('*, work_schedules(*)')
      .in('employee_id', employeeIds)

    const employeeSchedulesMap = {}
    ;(employeeSchedules || []).forEach(s => {
      employeeSchedulesMap[s.employee_id] = s
    })

    // ═══ 3. PLANNINGS PAR DÉFAUT PAR ENTREPRISE ═══
    const enterpriseIds = [...new Set((employees || []).map(e => e.enterprise_id))]

    const { data: defaultSchedules } = await supabase
      .from('work_schedules')
      .select('*')
      .in('enterprise_id', enterpriseIds)
      .eq('is_default', true)
      .eq('is_active', true)

    const defaultScheduleByEnterprise = {}
    ;(defaultSchedules || []).forEach(s => {
      if (!defaultScheduleByEnterprise[s.enterprise_id]) {
        defaultScheduleByEnterprise[s.enterprise_id] = s
      }
    })

    // ═══ 4. JOURS FÉRIÉS ═══
    // On charge par enterprise (chacune a ses propres fériés)
    // Si mode "all" on charge pour chaque enterprise distincte
    const holidaysByEnterprise = {}
    const enterpriseIdsToLoad = targetEnterpriseId === 'all'
      ? enterpriseIds
      : [targetEnterpriseId]

    await Promise.all(
      enterpriseIdsToLoad.map(async (entId) => {
        const holidays = await HolidayService.getHolidaysForRange(
          entId, startDate, endDate
        )
        // Set pour lookup O(1) — uniquement les non-travaillés
        holidaysByEnterprise[entId] = HolidayService.buildHolidaySet(
          holidays.filter(h => !h.is_worked)
        )
      })
    )

    // ═══ 5. POINTAGES ═══
    let attendancesQuery = supabase
      .from('attendances')
      .select('*')
      .gte('check_time', `${startDate}T00:00:00`)
      .lte('check_time', `${endDate}T23:59:59`)
      .eq('check_type', 'in')
      .in('employee_id', employeeIds)
      .order('check_time', { ascending: true })

    if (targetEnterpriseId !== 'all') {
      attendancesQuery = attendancesQuery.eq('enterprise_id', targetEnterpriseId)
    }

    const { data: attendances } = await attendancesQuery

    // ═══ 6. CALCULER LES RETARDS ═══
    const retardsCalcules = []
    let totalRetards  = 0
    let totalMinutes  = 0
    const employesPonctuelSet = new Set()
    const employesEnRetardSet = new Set()
    let employesSansPlanningIgnores = 0

    employees?.forEach(employee => {
      const schedulePerso = employeeSchedulesMap[employee.id]
      let heureArrivee = null
      let tolerance    = 15
      let bascule      = 0

      if (schedulePerso) {
        if (schedulePerso.use_custom_hours && schedulePerso.custom_start_time) {
          heureArrivee = schedulePerso.custom_start_time.slice(0, 5)
          tolerance    = schedulePerso.custom_late_tolerance_minutes || 15
          bascule      = minutesDeBascule(schedulePerso.custom_bascule)
        } else if (schedulePerso.schedule_id && schedulePerso.work_schedules) {
          heureArrivee = schedulePerso.work_schedules.start_time?.slice(0, 5) || null
          tolerance    = schedulePerso.work_schedules.late_tolerance_minutes || 15
          bascule      = minutesDeBascule(schedulePerso.work_schedules.bascule)
        }
      }

      if (!heureArrivee) {
        const defaultSchedule = defaultScheduleByEnterprise[employee.enterprise_id]
        if (defaultSchedule) {
          heureArrivee = defaultSchedule.start_time?.slice(0, 5) || null
          tolerance    = defaultSchedule.late_tolerance_minutes || 15
          bascule      = minutesDeBascule(defaultSchedule.bascule)
        }
      }

      if (!heureArrivee) {
        employesSansPlanningIgnores++
        return
      }

      const employeeAttendances = attendances?.filter(
        a => a.employee_id === employee.id
      ) || []

      const parJour = {}
      employeeAttendances.forEach(att => {
        //  La journée de travail, et non la date UTC : un pointage de 00h30 avec
        //  une bascule à 04:00 appartient à la veille.
        const jour = jourDeTravail(att.check_time, undefined, bascule)
        if (!parJour[jour]) parJour[jour] = att
      })

      Object.entries(parJour).forEach(([jour, premierPointage]) => {
        //  Une bascule peut ranger un pointage sur une journée hors de la
        //  période demandée : on ne compte pas de retard pour celle-là.
        if (jour < startDate || jour > endDate) return

        // ── FILTRE JOUR FÉRIÉ ──────────────────────────────
        const holidaySet = holidaysByEnterprise[employee.enterprise_id]
        if (holidaySet && holidaySet.has(jour)) {
          // Jour férié non travaillé → pas de retard comptabilisé
          return
        }
        // ──────────────────────────────────────────────────

        // ⭐ LIVRAISON 04 : heure locale de l'entreprise (voir l'en-tête de
        // timezoneUtils.js). C'est LE correctif qui remet les retards justes.
        const { heures: hLocale, minutes: mLocale } = getHeuresMinutesLocales(premierPointage.check_time)
        const heurePointage = `${String(hLocale).padStart(2, '0')}:${String(mLocale).padStart(2, '0')}`

        const [hA, mA] = heureArrivee.split(':').map(Number)
        const [hP, mP] = heurePointage.split(':').map(Number)

        const minutesArriveeBase = hA * 60 + mA
        const minutesArriveeMax  = minutesArriveeBase + tolerance
        const minutesPointage    = hP * 60 + mP

        const retardMinutes = minutesPointage - minutesArriveeBase
        const estEnRetard   = minutesPointage > minutesArriveeMax

        if (estEnRetard && retardMinutes > 0) {
          totalRetards++
          totalMinutes += retardMinutes
          employesEnRetardSet.add(employee.id)

          retardsCalcules.push({
            id: premierPointage.id,
            employee,
            date: jour,
            heureArrivee,
            heurePointage,
            retardMinutes,
            tolerance,
            sourceHoraire: schedulePerso
              ? (schedulePerso.use_custom_hours ? 'personnalisé' : 'planning')
              : 'entreprise',
          })
        } else {
          employesPonctuelSet.add(employee.id)
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
      employesPonctuels:  employesPonctuelSet.size,
      employesEnRetard:   employesEnRetardSet.size,
      employesSansPlanningIgnores,
    })

  } catch (error) {
    console.error('Erreur chargement retards:', error)
    toast.error('Erreur lors du chargement')
  }
  setLoading(false)
}

  const initiateDelete = (retard) => {
    setRetardToDelete(retard)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!retardToDelete) return

    try {
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

  const formatDateDisplay = () => {
    const date = new Date(selectedDate)
    if (viewMode === 'jour') {
      return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    } else if (viewMode === 'semaine') {
      return `Sem. ${Math.ceil(date.getDate() / 7)}`
    } else {
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }
  }

  const getSourceBadge = (source) => {
    if (source === 'personnalisé') return { label: 'Horaire perso', color: '#8B5CF6' }
    if (source === 'planning') return { label: 'Planning', color: '#6366F1' }
    return { label: 'Défaut entreprise', color: '#F59E0B' }
  }

  if (loading && !retards.length) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingPulse}>
          <Footprints size={50} color="#F59E0B" />
        </div>
        <p style={styles.loadingText}>Chargement des retards...</p>
        <div style={styles.loadingBar}>
          <div style={styles.loadingBarFill}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .afro-retard-card:hover {
          background: rgba(239, 68, 68, 0.08) !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          transform: translateY(-2px);
        }
        .afro-action-btn:hover {
          transform: scale(1.1) !important;
        }
        .afro-view-btn:hover {
          background: rgba(245, 158, 11, 0.15) !important;
        }
        .afro-modal-overlay {
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #D97706; }
        select option { background: #141423; color: #E5E5E5; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>
        <div style={styles.bgOrb1}></div>
        <div style={styles.bgOrb2}></div>

        {/* ═══ HEADER ═══ */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={styles.logoContainer}>
                <AlertTriangle size={24} color="#EF4444" />
              </div>
              <div style={styles.headerTitleWrap}>
                <h1 style={styles.headerTitle}>RETARDS</h1>
                <span style={styles.headerSubtitle}>Suivi & alertes</span>
              </div>
            </div>
            <div style={styles.headerRight}>
              <div style={styles.statBadge}>
                <Clock size={16} color="#EF4444" />
                <span>{stats.totalRetards}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ═══ MAIN CONTENT ═══ */}
        <main style={styles.main}>

          {/* ═══ BANNIÈRE EMPLOYÉS SANS PLANNING ═══ */}
          {stats.employesSansPlanningIgnores > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'rgba(107,114,128,0.08)',
              border: '1px solid rgba(107,114,128,0.2)',
              borderRadius: '14px',
              marginBottom: '20px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(107,114,128,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Users size={18} color="#9CA3AF" />
              </div>
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: '600', margin: '0 0 2px 0' }}>
                  {stats.employesSansPlanningIgnores} employé{stats.employesSansPlanningIgnores > 1 ? 's' : ''} sans planning — non évalué{stats.employesSansPlanningIgnores > 1 ? 's' : ''}
                </p>
                <p style={{ color: '#6B7280', fontSize: '11px', margin: 0 }}>
                  Aucun horaire de référence défini (ni planning individuel, ni planning entreprise par défaut)
                </p>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={{...styles.statIconWrap, background: 'rgba(239, 68, 68, 0.15)'}}>
                <AlertTriangle size={22} color="#EF4444" />
              </div>
              <div style={styles.statContent}>
                <span style={styles.statNumber}>{stats.totalRetards}</span>
                <span style={styles.statLabel}>Retards</span>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{...styles.statIconWrap, background: 'rgba(245, 158, 11, 0.15)'}}>
                <Timer size={22} color="#F59E0B" />
              </div>
              <div style={styles.statContent}>
                <span style={styles.statNumber}>{formatRetard(stats.totalMinutesRetard)}</span>
                <span style={styles.statLabel}>Temps perdu</span>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{...styles.statIconWrap, background: 'rgba(16, 185, 129, 0.15)'}}>
                <UserCheck size={22} color="#10B981" />
              </div>
              <div style={styles.statContent}>
                <span style={styles.statNumber}>{stats.employesPonctuels}</span>
                <span style={styles.statLabel}>Ponctuels</span>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{...styles.statIconWrap, background: 'rgba(239, 68, 68, 0.15)'}}>
                <UserX size={22} color="#EF4444" />
              </div>
              <div style={styles.statContent}>
                <span style={styles.statNumber}>{stats.employesEnRetard}</span>
                <span style={styles.statLabel}>En retard</span>
              </div>
            </div>

            {stats.employesSansPlanningIgnores > 0 && (
              <div style={styles.statCard}>
                <div style={{...styles.statIconWrap, background: 'rgba(107,114,128,0.15)'}}>
                  <Users size={22} color="#9CA3AF" />
                </div>
                <div style={styles.statContent}>
                  <span style={{...styles.statNumber, color: '#9CA3AF'}}>{stats.employesSansPlanningIgnores}</span>
                  <span style={styles.statLabel}>Sans planning</span>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div style={styles.filtersSection}>
            <div style={styles.viewModeContainer}>
              {['jour', 'semaine', 'mois'].map(mode => (
                <button
                  key={mode}
                  className="afro-view-btn"
                  onClick={() => setViewMode(mode)}
                  style={{
                    ...styles.viewModeBtn,
                    ...(viewMode === mode ? styles.viewModeBtnActive : {})
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <div style={styles.dateNav}>
              <button onClick={() => changeDate(-1)} style={styles.navBtn}>
                <ChevronLeft size={20} />
              </button>
              <div style={styles.dateDisplayWrap}>
                <Calendar size={14} color="#F59E0B" />
                <span style={styles.dateDisplay}>{formatDateDisplay()}</span>
              </div>
              <button onClick={() => changeDate(1)} style={styles.navBtn}>
                <ChevronRight size={20} />
              </button>
            </div>

            {admin?.role === 'super_admin' && (
              <div style={styles.filterBox}>
                <Building2 size={18} color="#F59E0B" />
                <select
                  value={selectedEntrepriseId}
                  onChange={(e) => setSelectedEntrepriseId(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="all">Toutes les entreprises</option>
                  {entreprises.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Retards List */}
          <div style={styles.listContainer}>
            {retards.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <UserCheck size={48} color="#10B981" />
                </div>
                <h3 style={styles.emptyTitle}>Aucun retard ! 🎉</h3>
                <p style={styles.emptyText}>
                  {stats.employesSansPlanningIgnores > 0
                    ? `Tous les employés avec un planning sont ponctuels. ${stats.employesSansPlanningIgnores} sans planning non évalué${stats.employesSansPlanningIgnores > 1 ? 's' : ''}.`
                    : 'Tous les employés sont ponctuels sur cette période'
                  }
                </p>
              </div>
            ) : (
              retards.map((retard, index) => {
                const sourceBadge = getSourceBadge(retard.sourceHoraire)
                return (
                  <div
                    key={index}
                    className="afro-retard-card"
                    style={{
                      ...styles.retardCard,
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    {/* Avatar */}
                    <div style={styles.avatarSection}>
                      <div style={styles.avatarPlaceholder}>
                        <span>{retard.employee.first_name?.[0]}{retard.employee.last_name?.[0]}</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={styles.retardInfo}>
                      <div style={styles.retardNameRow}>
                        <span style={styles.retardName}>
                          {retard.employee.first_name} {retard.employee.last_name}
                        </span>
                        <span style={styles.retardDate}>{retard.date}</span>
                      </div>
                      <span style={styles.retardMatricule}>
                        {retard.employee.matricule}
                      </span>
                      {admin?.role === 'super_admin' && (
                        <span style={styles.retardEntreprise}>
                          <Building2 size={12} />
                          {retard.employee.enterprises?.name}
                        </span>
                      )}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '4px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        background: `${sourceBadge.color}15`,
                        color: sourceBadge.color,
                        border: `1px solid ${sourceBadge.color}30`,
                        alignSelf: 'flex-start',
                      }}>
                        {sourceBadge.label}
                      </span>
                    </div>

                    {/* Hours */}
                    <div style={styles.hoursSection}>
                      <div style={styles.hourItem}>
                        <span style={styles.hourLabel}>Prévu</span>
                        <span style={styles.hourValue}>{retard.heureArrivee}</span>
                        <span style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                          ±{retard.tolerance}min
                        </span>
                      </div>
                      <div style={styles.hourArrow}>→</div>
                      <div style={styles.hourItem}>
                        <span style={styles.hourLabel}>Arrivée</span>
                        <span style={styles.hourValueLate}>{retard.heurePointage}</span>
                      </div>
                    </div>

                    {/* Badge */}
                    <div style={styles.retardBadge}>
                      <AlertTriangle size={14} />
                      <span>+{formatRetard(retard.retardMinutes)}</span>
                    </div>

                    {/* Delete */}
                    <button
                      className="afro-action-btn"
                      onClick={() => initiateDelete(retard)}
                      style={styles.deleteBtn}
                      title="Supprimer ce pointage"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <div style={styles.footerLine}></div>
            <p style={styles.footerText}>
              <Footprints size={14} color="#F59E0B" />
              EN-CHECK • Suivi des Retards
            </p>
          </div>
        </main>

        {/* ═══ MODAL SUPPRESSION ═══ */}
        {showDeleteModal && retardToDelete && (
          <div className="afro-modal-overlay" style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
              <div style={styles.confirmIconWrap}>
                <AlertTriangle size={32} color="#EF4444" />
              </div>
              <h3 style={styles.confirmTitle}>Supprimer ce retard ?</h3>
              <p style={styles.confirmText}>
                Attention, cela supprimera le <strong>pointage d'entrée</strong> de {retardToDelete.employee.first_name}.
                <br />L'employé sera considéré comme absent ou devra repointer.
              </p>
              <div style={styles.confirmActions}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>
                  Annuler
                </button>
                <button onClick={confirmDelete} style={styles.deleteConfirmBtn}>
                  Supprimer
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
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.03) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)`, pointerEvents: 'none', zIndex: 0 },
  bgOrb1: { position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  bgOrb2: { position: 'fixed', bottom: '-30%', left: '-15%', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#0A0A0F' },
  loadingPulse: { animation: 'float 2s ease-in-out infinite' },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px' },
  loadingBar: { width: '200px', height: '2px', background: 'rgba(245,158,11,0.1)', borderRadius: '2px', overflow: 'hidden' },
  loadingBarFill: { width: '40%', height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: '2px', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' },
  header: { background: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(239, 68, 68, 0.15)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: '1200px', margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' },
  logoContainer: { width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { display: 'flex', flexDirection: 'column' },
  headerTitle: { color: '#FFFFFF', fontSize: 'clamp(16px, 3vw, 20px)', fontWeight: '700', letterSpacing: '2px', margin: 0, lineHeight: '1.2' },
  headerSubtitle: { color: '#EF4444', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '500' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  statBadge: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 16px', borderRadius: '10px', color: '#EF4444', fontSize: '14px', fontWeight: '600' },
  main: { padding: '24px 20px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' },
  statCard: { background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' },
  statIconWrap: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { display: 'flex', flexDirection: 'column' },
  statNumber: { fontSize: '20px', fontWeight: '700', color: '#FFFFFF', lineHeight: '1' },
  statLabel: { fontSize: '11px', color: '#888', marginTop: '4px' },
  filtersSection: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' },
  viewModeContainer: { display: 'flex', background: 'rgba(20, 20, 35, 0.8)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.06)' },
  viewModeBtn: { padding: '8px 16px', border: 'none', background: 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '13px', color: '#888', transition: 'all 0.2s ease' },
  viewModeBtnActive: { background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000' },
  dateNav: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(20, 20, 35, 0.8)', padding: '8px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' },
  navBtn: { width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  dateDisplayWrap: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px', justifyContent: 'center' },
  dateDisplay: { fontWeight: '600', color: '#FFFFFF', fontSize: '14px' },
  filterBox: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px 16px', flex: 1, maxWidth: '300px' },
  filterSelect: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '14px', cursor: 'pointer' },
  listContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' },
  emptyIcon: { width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', animation: 'float 3s ease-in-out infinite' },
  emptyTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' },
  emptyText: { color: '#666', fontSize: '14px' },
  retardCard: { display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '16px', padding: '16px 20px', animation: 'fadeInUp 0.5s ease forwards', transition: 'all 0.3s ease', flexWrap: 'wrap' },
  avatarSection: { flexShrink: 0 },
  avatarPlaceholder: { width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: '700', fontSize: '14px' },
  retardInfo: { flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' },
  retardNameRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  retardName: { color: '#FFFFFF', fontSize: '15px', fontWeight: '600' },
  retardDate: { color: '#888', fontSize: '12px' },
  retardMatricule: { color: '#666', fontSize: '12px' },
  retardEntreprise: { display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontSize: '12px' },
  hoursSection: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  hourItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  hourLabel: { fontSize: '10px', color: '#666', marginBottom: '2px' },
  hourValue: { fontWeight: '600', color: '#FFFFFF', fontSize: '14px' },
  hourValueLate: { fontWeight: '600', color: '#EF4444', fontSize: '14px' },
  hourArrow: { color: '#555', fontSize: '14px' },
  retardBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', flexShrink: 0 },
  deleteBtn: { width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0 },
  footer: { marginTop: '48px', paddingBottom: '24px' },
  footerLine: { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.2), transparent)', marginBottom: '20px' },
  footerText: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555', fontSize: '12px', letterSpacing: '2px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 200 },
  confirmModal: { background: '#0F0F19', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '30px', textAlign: 'center' },
  confirmIconWrap: { width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' },
  confirmTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '600', margin: '0 0 12px 0' },
  confirmText: { color: '#888', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' },
  confirmActions: { display: 'flex', gap: '12px' },
  cancelBtn: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', fontWeight: '500', cursor: 'pointer' },
  deleteConfirmBtn: { flex: 1, padding: '14px', background: '#EF4444', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
}