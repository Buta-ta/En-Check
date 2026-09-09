// src/pages/employee/EmployeeDashboard.jsx
// ═══════════════════════════════════════════════════════════
// 🏠 DASHBOARD EMPLOYÉ
// Avec planning du jour, fiches de paie, congés
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  CalendarDays,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Activity,
  Wallet,
  FileText,
  Coffee,
  Sun,
  Timer,
  Briefcase,
  Shield,
  ClipboardList,
} from 'lucide-react'
import { db } from '../../lib/db'
import EmployeeAuthService from '../../services/employeeAuthService'
import EmployeeLayout from '../../components/EmployeeLayout'
import toast from 'react-hot-toast'
import { formaterHeureLocaleShort } from '../../utils/timezoneUtils'

export default function EmployeeDashboard() {
  const [employee, setEmployee] = useState(null)
  const [stats, setStats] = useState({
    todayStatus: null,
    todayCheckIn: null,
    todayCheckOut: null,
    weeklyHours: 0,
    monthlyHours: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    overtimeThisMonth: 0,
    availablePayslips: 0,
    lastPayslipPeriod: null,
    pendingTasks: 0,
  })
  const [loading, setLoading] = useState(true)

  // ═══════════════════════════════════════════════════════════
  // 📅 STATE PLANNING
  // ═══════════════════════════════════════════════════════════
  const [planningData, setPlanningData] = useState({
    loaded: false,
    hasSchedule: false,
    isWorkDay: false,
    startTime: '--:--',
    endTime: '--:--',
    hasBreak: false,
    breakStart: '--:--',
    breakEnd: '--:--',
    scheduleName: '',
    isCustom: false,
    workDaysCount: 0,
    todayLabel: '',
    nextWorkDay: null,
    lateTolerance: 0,
  })

  const navigate = useNavigate()

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) {
      navigate('/employee/login')
      return
    }
    setEmployee(emp)
    initDashboard(emp)
  }, [navigate])

  const initDashboard = async (emp) => {
    const refreshedEmp = await EmployeeAuthService.refreshFeatures()
    if (refreshedEmp) {
      setEmployee(refreshedEmp)
      emp = refreshedEmp
    }

    await Promise.all([
      loadDashboardData(emp),
      emp.features?.planning ? loadPlanningData(emp) : Promise.resolve(),
    ])
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 CHARGEMENT DONNÉES DASHBOARD (existant)
  // ═══════════════════════════════════════════════════════════
  const loadDashboardData = async (emp) => {
    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(today)
      monday.setDate(diff)
      monday.setHours(0, 0, 0, 0)

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      // 1. Pointages du jour
      const { data: todayAttendances } = await db()
        .from('attendances')
        .select('check_time, check_type')
        .eq('employee_id', emp.id)
        .gte('check_time', `${todayStr}T00:00:00`)
        .lte('check_time', `${todayStr}T23:59:59`)
        .order('check_time', { ascending: true })

      let todayStatus = null
      let todayCheckIn = null
      let todayCheckOut = null

      if (todayAttendances && todayAttendances.length > 0) {
        const firstIn = todayAttendances.find(a => a.check_type === 'in')
        const lastOut = [...(todayAttendances || [])].reverse().find(a => a.check_type === 'out')

        todayCheckIn = firstIn ? formaterHeureLocaleShort(firstIn.check_time) : null
        todayCheckOut = lastOut ? formaterHeureLocaleShort(lastOut.check_time) : null
        todayStatus = todayCheckIn ? 'present' : null
      }

      // 2. Heures de la semaine
      const { data: weekAttendances } = await db()
        .from('attendances')
        .select('check_time, check_type')
        .eq('employee_id', emp.id)
        .gte('check_time', monday.toISOString())
        .order('check_time', { ascending: true })

      const weeklySeconds = calculateWorkedSeconds(weekAttendances || [])

      // 3. Heures du mois
      const { data: monthAttendances } = await db()
        .from('attendances')
        .select('check_time, check_type')
        .eq('employee_id', emp.id)
        .gte('check_time', monthStart.toISOString())
        .order('check_time', { ascending: true })

      const monthlySeconds = calculateWorkedSeconds(monthAttendances || [])

      // 4. Congés
      let pendingLeaves = 0
      let approvedLeaves = 0

      if (emp.features?.conges) {
        const { count: pending } = await db()
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('employee_id', emp.id)
          .eq('status', 'en_attente')

        const { count: approved } = await db()
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('employee_id', emp.id)
          .eq('status', 'approuve')
          .gte('end_date', todayStr)

        pendingLeaves = pending || 0
        approvedLeaves = approved || 0
      }

      // 5. Fiches de paie disponibles
      let availablePayslips = 0
      let lastPayslipPeriod = null

      if (emp.features?.fiches_paie) {
        const { data: payslips } = await db()
          .from('employee_payslips')
          .select('id, period_start, period_end, created_at')
          .eq('employee_id', emp.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('period_start', { ascending: false })

        availablePayslips = payslips?.length || 0
        lastPayslipPeriod = payslips?.[0] || null
      }


            // 6. Tâches en attente / en cours
      let pendingTasks = 0

      if (emp.features?.gestion_taches) {
        const { data: employeeTaskRows } = await db()
          .from('tasks')
          .select('id, status, assigned_employee_id, team_id')
          .eq('enterprise_id', emp.enterprise_id)
          .is('deleted_at', null)

        if (employeeTaskRows?.length) {
          // Récupérer les équipes de l'employé
          const { data: memberships } = await db()
            .from('team_members')
            .select('team_id')
            .eq('employee_id', emp.id)
            .eq('is_active', true)
            .is('removed_at', null)

          const teamIds = memberships?.map(m => m.team_id) || []

          pendingTasks = employeeTaskRows.filter(task => {
            const forEmployee = task.assigned_employee_id === emp.id
            const forTeam = task.team_id && teamIds.includes(task.team_id)

            const visible = forEmployee || forTeam
            const activeStatus = ['assigned', 'seen', 'in_progress', 'paused', 'rejected'].includes(task.status)

            return visible && activeStatus
          }).length
        }
      }
      setStats({
        todayStatus,
        todayCheckIn,
        todayCheckOut,
        weeklyHours: Math.round((weeklySeconds / 3600) * 10) / 10,
        monthlyHours: Math.round((monthlySeconds / 3600) * 10) / 10,
        pendingLeaves,
        approvedLeaves,
        overtimeThisMonth: 0,
        availablePayslips,
        lastPayslipPeriod,
        pendingTasks,

      })
    } catch (err) {
      console.error('Erreur chargement dashboard:', err)
      toast.error('Erreur lors du chargement')
    }

    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 📅 CHARGEMENT PLANNING (inspiré de EmployeeHoraires.jsx)
  // ═══════════════════════════════════════════════════════════
  const loadPlanningData = async (emp) => {
    try {
      // Récupérer le planning de l'employé
      const { data: empSchedule } = await db()
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .eq('employee_id', emp.id)
        .maybeSingle()

      if (!empSchedule) {
        setPlanningData(prev => ({ ...prev, loaded: true, hasSchedule: false }))
        return
      }

      const isCustom = empSchedule.use_custom_hours
      const ws = empSchedule.work_schedules

      // Extraire les données selon le type (custom ou planning entreprise)
      const startTime = isCustom
        ? empSchedule.custom_start_time?.slice(0, 5) || '--:--'
        : ws?.start_time?.slice(0, 5) || '--:--'

      const endTime = isCustom
        ? empSchedule.custom_end_time?.slice(0, 5) || '--:--'
        : ws?.end_time?.slice(0, 5) || '--:--'

      const hasBreak = isCustom
        ? empSchedule.custom_has_break
        : ws?.has_break

      const breakStart = isCustom
        ? empSchedule.custom_break_start?.slice(0, 5) || '--:--'
        : ws?.break_start?.slice(0, 5) || '--:--'

      const breakEnd = isCustom
        ? empSchedule.custom_break_end?.slice(0, 5) || '--:--'
        : ws?.break_end?.slice(0, 5) || '--:--'

      const workDays = isCustom
        ? empSchedule.custom_work_days || []
        : ws?.work_days || []

      const lateTolerance = isCustom
        ? empSchedule.custom_late_tolerance_minutes || 15
        : ws?.late_tolerance_minutes || 15

      const scheduleName = isCustom
        ? 'Horaires personnalisés'
        : ws?.name || 'Planning standard'

      // Déterminer si aujourd'hui est un jour de travail
      const today = new Date()
      const jsDay = today.getDay()
      const planningDay = jsDay === 0 ? 7 : jsDay // Lundi=1 ... Dimanche=7
      const isWorkDay = workDays.includes(planningDay)

      // Nom du jour
      const joursSemaine = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
      const todayLabel = joursSemaine[jsDay]

      // Trouver le prochain jour de travail si aujourd'hui est un repos
      let nextWorkDay = null
      if (!isWorkDay && workDays.length > 0) {
        const joursNoms = {
          1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi',
          5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche'
        }
        for (let offset = 1; offset <= 7; offset++) {
          const checkDay = ((planningDay - 1 + offset) % 7) + 1
          if (workDays.includes(checkDay)) {
            nextWorkDay = joursNoms[checkDay]
            break
          }
        }
      }

      // Calculer les heures de travail quotidiennes
      const calculateDailyHours = () => {
        if (startTime === '--:--' || endTime === '--:--') return null

        const [sh, sm] = startTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        let totalMinutes = (eh * 60 + em) - (sh * 60 + sm)

        if (hasBreak && breakStart !== '--:--' && breakEnd !== '--:--') {
          const [bsh, bsm] = breakStart.split(':').map(Number)
          const [beh, bem] = breakEnd.split(':').map(Number)
          totalMinutes -= (beh * 60 + bem) - (bsh * 60 + bsm)
        }

        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}`
      }

      setPlanningData({
        loaded: true,
        hasSchedule: true,
        isWorkDay,
        startTime,
        endTime,
        hasBreak: !!hasBreak,
        breakStart,
        breakEnd,
        scheduleName,
        isCustom,
        workDaysCount: workDays.length,
        todayLabel,
        nextWorkDay,
        lateTolerance,
        dailyHours: calculateDailyHours(),
        workDays,
      })
    } catch (err) {
      console.error('Erreur chargement planning dashboard:', err)
      setPlanningData(prev => ({ ...prev, loaded: true, hasSchedule: false }))
    }
  }

  const calculateWorkedSeconds = (attendances) => {
    let totalSeconds = 0
    let lastIn = null

    attendances.forEach(pt => {
      if (pt.check_type === 'in') {
        lastIn = new Date(pt.check_time)
      } else if (pt.check_type === 'out' && lastIn) {
        totalSeconds += (new Date(pt.check_time) - lastIn) / 1000
        lastIn = null
      }
    })

    return totalSeconds
  }

  const formatHours = (hours) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h${m.toString().padStart(2, '0')}`
  }

  if (!employee) return null

  return (
    <EmployeeLayout>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-card {
          transition: all 0.3s ease !important;
        }
        .dash-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.3) !important;
        }
        .dash-action:hover {
          transform: translateX(4px) !important;
          background: rgba(255,255,255,0.06) !important;
        }
        .planning-mini-day {
          transition: all 0.2s ease;
        }
        .planning-mini-day:hover {
          transform: scale(1.1);
        }
      `}</style>

      <div style={dashStyles.container}>
        {/* ── GREETING ── */}
        <div style={dashStyles.greeting}>
          <h1 style={dashStyles.greetingTitle}>
            {getGreeting()}, {employee.first_name} 👋
          </h1>
          <p style={dashStyles.greetingSub}>
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* ── STATUS CARD ── */}
        <div
          className="dash-card"
          style={{
            ...dashStyles.statusCard,
            borderColor:
              stats.todayStatus === 'present'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(239, 68, 68, 0.15)',
          }}
        >
          <div style={dashStyles.statusHeader}>
            <div
              style={{
                ...dashStyles.statusIcon,
                background:
                  stats.todayStatus === 'present'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(255,255,255,0.04)',
              }}
            >
              {stats.todayStatus === 'present'
                ? <CheckCircle size={24} color="#10B981" />
                : <AlertCircle size={24} color="#666" />}
            </div>
            <div>
              <h3 style={dashStyles.statusTitle}>
                {stats.todayStatus === 'present' ? 'Présent aujourd\'hui' : 'Pas encore pointé'}
              </h3>
              {stats.todayCheckIn && (
                <div style={dashStyles.statusTimes}>
                  <span>Arrivée : <strong style={{ color: '#10B981' }}>{stats.todayCheckIn}</strong></span>
                  {stats.todayCheckOut && (
                    <span> — Départ : <strong style={{ color: '#EF4444' }}>{stats.todayCheckOut}</strong></span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── STATS GRID ── */}
        <div style={dashStyles.statsGrid}>
          {/* Heures semaine */}
          <div
            className="dash-card"
            style={{
              ...dashStyles.statCard,
              animation: 'fadeInUp 0.4s ease 0.1s forwards',
              opacity: 0,
            }}
          >
            <div style={{ ...dashStyles.statIcon, background: 'rgba(99, 102, 241, 0.12)' }}>
              <Clock size={22} color="#6366F1" />
            </div>
            <div style={dashStyles.statInfo}>
              <span style={dashStyles.statValue}>{formatHours(stats.weeklyHours)}</span>
              <span style={dashStyles.statLabel}>Cette semaine</span>
            </div>
          </div>

          {/* Heures mois */}
          <div
            className="dash-card"
            style={{
              ...dashStyles.statCard,
              animation: 'fadeInUp 0.4s ease 0.2s forwards',
              opacity: 0,
            }}
          >
            <div style={{ ...dashStyles.statIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
              <TrendingUp size={22} color="#F59E0B" />
            </div>
            <div style={dashStyles.statInfo}>
              <span style={dashStyles.statValue}>{formatHours(stats.monthlyHours)}</span>
              <span style={dashStyles.statLabel}>Ce mois</span>
            </div>
          </div>

          {/* Congés */}
          {employee.features?.conges && (
            <div
              className="dash-card"
              style={{
                ...dashStyles.statCard,
                animation: 'fadeInUp 0.4s ease 0.3s forwards',
                opacity: 0,
              }}
            >
              <div style={{ ...dashStyles.statIcon, background: 'rgba(16, 185, 129, 0.12)' }}>
                <CalendarDays size={22} color="#10B981" />
              </div>
              <div style={dashStyles.statInfo}>
                <span style={dashStyles.statValue}>{stats.pendingLeaves}</span>
                <span style={dashStyles.statLabel}>Congés en attente</span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* 📅 KPI PLANNING — AVEC DONNÉES RÉELLES             */}
          {/* ═══════════════════════════════════════════════════ */}
          {employee.features?.planning && (
            <div
              className="dash-card"
              style={{
                ...dashStyles.statCard,
                animation: 'fadeInUp 0.4s ease 0.4s forwards',
                opacity: 0,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/employee/horaires')}
            >
              <div style={{ ...dashStyles.statIcon, background: 'rgba(236, 72, 153, 0.12)' }}>
                <Calendar size={22} color="#EC4899" />
              </div>
              <div style={dashStyles.statInfo}>
                {!planningData.loaded ? (
                  <>
                    <span style={dashStyles.statValue}>...</span>
                    <span style={dashStyles.statLabel}>Planning</span>
                  </>
                ) : !planningData.hasSchedule ? (
                  <>
                    <span style={{ ...dashStyles.statValue, fontSize: '16px', color: '#666' }}>Non défini</span>
                    <span style={dashStyles.statLabel}>Planning</span>
                  </>
                ) : planningData.isWorkDay ? (
                  <>
                    <span style={dashStyles.statValue}>
                      {planningData.startTime}
                    </span>
                    <span style={dashStyles.statLabel}>
                      Début aujourd'hui
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ ...dashStyles.statValue, fontSize: '16px', color: '#EC4899' }}>Repos</span>
                    <span style={dashStyles.statLabel}>Aujourd'hui</span>
                  </>
                )}
              </div>
            </div>
          )}

                    {employee.features?.gestion_taches && (
            <div
              className="dash-card"
              style={{
                ...dashStyles.statCard,
                animation: 'fadeInUp 0.4s ease 0.45s forwards',
                opacity: 0,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/employee/taches')}
            >
              <div style={{ ...dashStyles.statIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
                <ClipboardList size={22} color="#F59E0B" />
              </div>
              <div style={dashStyles.statInfo}>
                <span style={dashStyles.statValue}>{stats.pendingTasks}</span>
                <span style={dashStyles.statLabel}>Tâches actives</span>
              </div>
            </div>
          )}

          {/* Fiches de paie */}
          {employee.features?.fiches_paie && (
            <div
              className="dash-card"
              style={{
                ...dashStyles.statCard,
                animation: 'fadeInUp 0.4s ease 0.5s forwards',
                opacity: 0,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/employee/fiches-paie')}
            >
              <div style={{ ...dashStyles.statIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
                <Wallet size={22} color="#F59E0B" />
              </div>
              <div style={dashStyles.statInfo}>
                <span style={dashStyles.statValue}>{stats.availablePayslips}</span>
                <span style={dashStyles.statLabel}>Fiches disponibles</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 📅 CARTE PLANNING DU JOUR — DÉTAILLÉE                  */}
        {/* ═══════════════════════════════════════════════════════ */}
        {employee.features?.planning && planningData.loaded && planningData.hasSchedule && (
          <div
            className="dash-card"
            style={{
              ...dashStyles.statusCard,
              borderColor: planningData.isWorkDay
                ? 'rgba(236, 72, 153, 0.2)'
                : 'rgba(139, 92, 246, 0.15)',
              background: planningData.isWorkDay
                ? 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(20,20,35,0.7))'
                : 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(20,20,35,0.7))',
              cursor: 'pointer',
              animation: 'fadeInUp 0.4s ease 0.3s forwards',
              opacity: 0,
            }}
            onClick={() => navigate('/employee/horaires')}
          >
            {/* Header */}
            <div style={dashStyles.statusHeader}>
              <div
                style={{
                  ...dashStyles.statusIcon,
                  background: planningData.isWorkDay
                    ? 'rgba(236, 72, 153, 0.12)'
                    : 'rgba(139, 92, 246, 0.12)',
                }}
              >
                {planningData.isWorkDay
                  ? <Briefcase size={24} color="#EC4899" />
                  : <Coffee size={24} color="#8B5CF6" />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={dashStyles.statusTitle}>
                  {planningData.isWorkDay
                    ? `Planning du jour — ${planningData.todayLabel}`
                    : `Jour de repos — ${planningData.todayLabel}`}
                </h3>
                <div style={dashStyles.statusTimes}>
                  {planningData.isWorkDay ? (
                    <>
                      <span style={{ color: '#EC4899' }}>
                        {planningData.scheduleName}
                      </span>
                      {planningData.isCustom && (
                        <span style={{
                          marginLeft: '8px',
                          background: 'rgba(139,92,246,0.15)',
                          color: '#A78BFA',
                          padding: '1px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '700',
                        }}>
                          Personnalisé
                        </span>
                      )}
                    </>
                  ) : (
                    <span>
                      {planningData.nextWorkDay
                        ? `Prochain jour travaillé : ${planningData.nextWorkDay}`
                        : planningData.scheduleName}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight size={18} color={planningData.isWorkDay ? '#EC4899' : '#8B5CF6'} />
            </div>

            {/* Détails horaires si jour de travail */}
            {planningData.isWorkDay && (
              <div style={dashStyles.planningDetails}>
                {/* Horaires */}
                <div style={dashStyles.planningRow}>
                  <div style={dashStyles.planningChip}>
                    <Sun size={14} color="#F59E0B" />
                    <span style={dashStyles.planningChipLabel}>Horaires</span>
                    <span style={dashStyles.planningChipValue}>
                      {planningData.startTime} → {planningData.endTime}
                    </span>
                  </div>

                  {planningData.hasBreak && (
                    <div style={dashStyles.planningChip}>
                      <Coffee size={14} color="#8B5CF6" />
                      <span style={dashStyles.planningChipLabel}>Pause</span>
                      <span style={dashStyles.planningChipValue}>
                        {planningData.breakStart} - {planningData.breakEnd}
                      </span>
                    </div>
                  )}

                  {planningData.dailyHours && (
                    <div style={dashStyles.planningChip}>
                      <Timer size={14} color="#10B981" />
                      <span style={dashStyles.planningChipLabel}>Durée</span>
                      <span style={dashStyles.planningChipValue}>
                        {planningData.dailyHours}
                      </span>
                    </div>
                  )}

                  <div style={dashStyles.planningChip}>
                    <AlertCircle size={14} color="#F97316" />
                    <span style={dashStyles.planningChipLabel}>Tolérance</span>
                    <span style={dashStyles.planningChipValue}>
                      {planningData.lateTolerance} min
                    </span>
                  </div>
                </div>

                {/* Mini vue semaine */}
                <div style={dashStyles.miniWeekRow}>
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letter, i) => {
                    const dayId = i + 1
                    const isActive = planningData.workDays?.includes(dayId)
                    const jsDay = new Date().getDay()
                    const currentDayId = jsDay === 0 ? 7 : jsDay
                    const isCurrent = dayId === currentDayId

                    return (
                      <div
                        key={i}
                        className="planning-mini-day"
                        style={{
                          ...dashStyles.miniDay,
                          background: isCurrent
                            ? 'rgba(236, 72, 153, 0.25)'
                            : isActive
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(255,255,255,0.03)',
                          borderColor: isCurrent
                            ? 'rgba(236, 72, 153, 0.5)'
                            : isActive
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(255,255,255,0.06)',
                          color: isCurrent
                            ? '#EC4899'
                            : isActive
                              ? '#10B981'
                              : '#555',
                          fontWeight: isCurrent || isActive ? '800' : '500',
                        }}
                      >
                        {letter}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Planning non défini */}
        {employee.features?.planning && planningData.loaded && !planningData.hasSchedule && (
          <div
            className="dash-card"
            style={{
              ...dashStyles.statusCard,
              borderColor: 'rgba(255,255,255,0.06)',
              background: 'rgba(20, 20, 35, 0.5)',
            }}
          >
            <div style={dashStyles.statusHeader}>
              <div style={{ ...dashStyles.statusIcon, background: 'rgba(255,255,255,0.04)' }}>
                <Calendar size={24} color="#666" />
              </div>
              <div>
                <h3 style={{ ...dashStyles.statusTitle, color: '#888' }}>Aucun planning défini</h3>
                <div style={dashStyles.statusTimes}>
                  Contactez votre administrateur pour configurer vos horaires.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DERNIÈRE FICHE DE PAIE ── */}
        {employee.features?.fiches_paie && stats.availablePayslips > 0 && (
          <div
            className="dash-card"
            style={{
              ...dashStyles.statusCard,
              borderColor: 'rgba(245, 158, 11, 0.2)',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(20,20,35,0.7))',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/employee/fiches-paie')}
          >
            <div style={dashStyles.statusHeader}>
              <div
                style={{
                  ...dashStyles.statusIcon,
                  background: 'rgba(245, 158, 11, 0.12)',
                }}
              >
                <FileText size={24} color="#F59E0B" />
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={dashStyles.statusTitle}>Nouvelle fiche de paie disponible</h3>
                <div style={dashStyles.statusTimes}>
                  {stats.lastPayslipPeriod
                    ? `Dernière période : ${formatPayslipPeriod(stats.lastPayslipPeriod.period_start, stats.lastPayslipPeriod.period_end)}`
                    : 'Consultez vos bulletins publiés'}
                </div>
              </div>

              <ArrowRight size={18} color="#F59E0B" />
            </div>
          </div>
        )}

        {/* ── QUICK ACTIONS ── */}
        <div style={dashStyles.quickActions}>
          <h3 style={dashStyles.sectionTitle}>Accès rapides</h3>

          {employee.features?.conges && (
            <button
              className="dash-action"
              onClick={() => navigate('/employee/conges')}
              style={dashStyles.actionItem}
            >
              <div style={{ ...dashStyles.actionIcon, background: 'rgba(16, 185, 129, 0.12)' }}>
                <CalendarDays size={20} color="#10B981" />
              </div>
              <div style={dashStyles.actionInfo}>
                <span style={dashStyles.actionTitle}>Demander un congé</span>
                <span style={dashStyles.actionDesc}>Soumettre une nouvelle demande</span>
              </div>
              <ArrowRight size={18} color="#666" />
            </button>
          )}

          {employee.features?.heures_supplementaires && (
            <button
              className="dash-action"
              onClick={() => navigate('/employee/heures')}
              style={dashStyles.actionItem}
            >
              <div style={{ ...dashStyles.actionIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
                <Activity size={20} color="#F59E0B" />
              </div>
              <div style={dashStyles.actionInfo}>
                <span style={dashStyles.actionTitle}>Mes heures supplémentaires</span>
                <span style={dashStyles.actionDesc}>Consulter le détail</span>
              </div>
              <ArrowRight size={18} color="#666" />
            </button>
          )}

          {employee.features?.fiches_paie && (
            <button
              className="dash-action"
              onClick={() => navigate('/employee/fiches-paie')}
              style={dashStyles.actionItem}
            >
              <div style={{ ...dashStyles.actionIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
                <Wallet size={20} color="#F59E0B" />
              </div>
              <div style={dashStyles.actionInfo}>
                <span style={dashStyles.actionTitle}>Mes fiches de paie</span>
                <span style={dashStyles.actionDesc}>
                  {stats.availablePayslips > 0
                    ? `${stats.availablePayslips} bulletin(s) disponible(s)`
                    : 'Consulter et télécharger mes bulletins'}
                </span>
              </div>
              <ArrowRight size={18} color="#666" />
            </button>
          )}


                    {employee.features?.gestion_taches && (
            <button
              className="dash-action"
              onClick={() => navigate('/employee/taches')}
              style={dashStyles.actionItem}
            >
              <div style={{ ...dashStyles.actionIcon, background: 'rgba(245, 158, 11, 0.12)' }}>
                <ClipboardList size={20} color="#F59E0B" />
              </div>
              <div style={dashStyles.actionInfo}>
                <span style={dashStyles.actionTitle}>Mes tâches</span>
                <span style={dashStyles.actionDesc}>
                  {stats.pendingTasks > 0
                    ? `${stats.pendingTasks} tâche(s) active(s)`
                    : 'Voir mes tâches assignées'}
                </span>
              </div>
              <ArrowRight size={18} color="#666" />
            </button>
          )}

          {employee.features?.planning && (
            <button
              className="dash-action"
              onClick={() => navigate('/employee/horaires')}
              style={dashStyles.actionItem}
            >
              <div style={{ ...dashStyles.actionIcon, background: 'rgba(99, 102, 241, 0.12)' }}>
                <Calendar size={20} color="#6366F1" />
              </div>
              <div style={dashStyles.actionInfo}>
                <span style={dashStyles.actionTitle}>Mes horaires</span>
                <span style={dashStyles.actionDesc}>
                  {planningData.hasSchedule
                    ? `${planningData.scheduleName} • ${planningData.workDaysCount}j/sem`
                    : 'Voir mon planning de travail'}
                </span>
              </div>
              <ArrowRight size={18} color="#666" />
            </button>
          )}
        </div>
      </div>
    </EmployeeLayout>
  )
}

// ═══════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function formatPayslipPeriod(start, end) {
  if (!start || !end) return '—'

  const s = new Date(start)
  const e = new Date(end)
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]

  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${monthNames[s.getMonth()]} ${s.getFullYear()}`
  }

  return `${s.toLocaleDateString('fr-FR')} → ${e.toLocaleDateString('fr-FR')}`
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const dashStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  greeting: {
    marginBottom: '4px',
  },

  greetingTitle: {
    color: '#FFF',
    fontSize: 'clamp(22px, 4vw, 28px)',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },

  greetingSub: {
    color: '#666',
    fontSize: '14px',
    margin: 0,
    textTransform: 'capitalize',
  },

  statusCard: {
    background: 'rgba(20, 20, 35, 0.7)',
    backdropFilter: 'blur(10px)',
    borderRadius: '18px',
    border: '1px solid',
    padding: '24px',
  },

  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },

  statusIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  statusTitle: {
    color: '#FFF',
    fontSize: '16px',
    fontWeight: '600',
    margin: 0,
  },

  statusTimes: {
    color: '#888',
    fontSize: '13px',
    marginTop: '4px',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },

  statCard: {
    background: 'rgba(20, 20, 35, 0.7)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },

  statIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },

  statValue: {
    color: '#FFF',
    fontSize: '22px',
    fontWeight: '700',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },

  statLabel: {
    color: '#666',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },

  // ═══════════════════════════════════════════════════════
  // 📅 PLANNING DETAILS STYLES
  // ═══════════════════════════════════════════════════════
  planningDetails: {
    marginTop: '18px',
    paddingTop: '18px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  planningRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },

  planningChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '10px 14px',
  },

  planningChipLabel: {
    color: '#888',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  planningChipValue: {
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },

  miniWeekRow: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
  },

  miniDay: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    cursor: 'default',
  },

  // ═══════════════════════════════════════════════════════
  // 🚀 QUICK ACTIONS
  // ═══════════════════════════════════════════════════════
  quickActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  sectionTitle: {
    color: '#888',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    margin: '0 0 8px 0',
  },

  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    background: 'rgba(20, 20, 35, 0.7)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },

  actionIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  actionInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },

  actionTitle: {
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '600',
  },

  actionDesc: {
    color: '#666',
    fontSize: '12px',
    marginTop: '2px',
  },
}