// src/pages/employee/EmployeeHoraires.jsx
// ═══════════════════════════════════════════════════════════
// 📅 MES HORAIRES - ESPACE EMPLOYÉ
// Avec demande de modification d'horaires / planning
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Clock,
  Coffee,
  Sun,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Shield,
  AlertCircle,
  CalendarDays,
  Briefcase,
  User,
  Timer,
  Plus,
  X,
  Send,
  RefreshCw,
  MessageSquare
} from 'lucide-react'
import { db } from '../../lib/db'
import EmployeeAuthService from '../../services/employeeAuthService'
import HolidayService from '../../services/holidayService'
import EmployeeLayout from '../../components/EmployeeLayout'
import toast from 'react-hot-toast'

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function formatDateLongUTC(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDateShortUTC(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export default function EmployeeHoraires() {
  const [employee, setEmployee] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [workSchedule, setWorkSchedule] = useState(null)
  const [availableSchedules, setAvailableSchedules] = useState([])
  const [loading, setLoading] = useState(true)

  const [calendarDate, setCalendarDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('calendar')
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null)

  const [companyHolidays, setCompanyHolidays] = useState([])
  const [holidaySet, setHolidaySet] = useState(new Set())
  const [holidayMap, setHolidayMap] = useState(new Map())

  const [changeRequests, setChangeRequests] = useState([])
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [submittingRequest, setSubmittingRequest] = useState(false)

  const [requestForm, setRequestForm] = useState({
    requested_schedule_id: '',
    use_custom_hours: false,
    requested_start_time: '08:00',
    requested_end_time: '17:00',
    requested_break_start: '12:00',
    requested_break_end: '13:00',
    requested_has_break: true,
    requested_work_days: [1, 2, 3, 4, 5],
    reason: '',
  })

  const navigate = useNavigate()

  const joursSemaine = [
    { id: 1, nom: 'Lundi', court: 'Lun' },
    { id: 2, nom: 'Mardi', court: 'Mar' },
    { id: 3, nom: 'Mercredi', court: 'Mer' },
    { id: 4, nom: 'Jeudi', court: 'Jeu' },
    { id: 5, nom: 'Vendredi', court: 'Ven' },
    { id: 6, nom: 'Samedi', court: 'Sam' },
    { id: 7, nom: 'Dimanche', court: 'Dim' },
  ]

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) { navigate('/employee/login'); return }
    if (!emp.features?.planning) { navigate('/employee/dashboard'); return }
    setEmployee(emp)
    loadInitialData(emp)
  }, [navigate])

  useEffect(() => {
    if (employee) loadHolidays(employee)
  }, [employee, calendarDate])

  const loadInitialData = async (emp) => {
    setLoading(true)
    try {
      await Promise.all([
        loadSchedule(emp),
        loadAvailableSchedules(emp),
        loadChangeRequests(emp),
      ])
    } catch (err) {
      console.error(err)
      toast.error('Erreur de chargement')
    }
    setLoading(false)
  }

  const loadSchedule = async (emp) => {
    try {
      const { data: empSchedule } = await db()
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .eq('employee_id', emp.id)
        .maybeSingle()

      setSchedule(empSchedule)

      if (empSchedule?.schedule_id && !empSchedule.use_custom_hours) {
        setWorkSchedule(empSchedule.work_schedules)
      } else {
        setWorkSchedule(null)
      }
    } catch (err) {
      console.error('Erreur chargement horaires:', err)
      throw err
    }
  }

  const loadAvailableSchedules = async (emp) => {
    const { data, error } = await db()
      .from('work_schedules')
      .select('id, name, start_time, end_time, break_start, break_end, has_break, work_days, late_tolerance_minutes, is_default')
      .eq('enterprise_id', emp.enterprise_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })

    if (error) throw error
    setAvailableSchedules(data || [])
  }

  const loadChangeRequests = async (emp) => {
    const { data, error } = await db()
      .from('schedule_change_requests')
      .select('*')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    setChangeRequests(data || [])
  }

  const loadHolidays = async (emp) => {
    try {
      const year = calendarDate.getFullYear()
      const holidays = await HolidayService.getHolidaysForEnterprise(emp.enterprise_id, year)
      const activeHolidays = holidays.filter(h => !h.is_worked)
      setCompanyHolidays(activeHolidays)
      setHolidaySet(HolidayService.buildHolidaySet(activeHolidays))
      setHolidayMap(HolidayService.buildHolidayMap(activeHolidays))
    } catch (err) {
      console.error('Erreur chargement jours fériés:', err)
    }
  }

  const getWorkDays = () => {
    if (!schedule) return []
    if (schedule.use_custom_hours) return schedule.custom_work_days || []
    if (workSchedule?.work_days) return workSchedule.work_days
    return []
  }

  const getStartTime = () => {
    if (!schedule) return '--:--'
    if (schedule.use_custom_hours) return schedule.custom_start_time?.slice(0, 5) || '--:--'
    return workSchedule?.start_time?.slice(0, 5) || '--:--'
  }

  const getEndTime = () => {
    if (!schedule) return '--:--'
    if (schedule.use_custom_hours) return schedule.custom_end_time?.slice(0, 5) || '--:--'
    return workSchedule?.end_time?.slice(0, 5) || '--:--'
  }

  const hasBreak = () => {
    if (!schedule) return false
    if (schedule.use_custom_hours) return schedule.custom_has_break
    return workSchedule?.has_break
  }

  const getBreakStart = () => {
    if (!schedule) return '--:--'
    if (schedule.use_custom_hours) return schedule.custom_break_start?.slice(0, 5) || '--:--'
    return workSchedule?.break_start?.slice(0, 5) || '--:--'
  }

  const getBreakEnd = () => {
    if (!schedule) return '--:--'
    if (schedule.use_custom_hours) return schedule.custom_break_end?.slice(0, 5) || '--:--'
    return workSchedule?.break_end?.slice(0, 5) || '--:--'
  }

  const getLateTolerance = () => {
    if (!schedule) return 0
    if (schedule.use_custom_hours) return schedule.custom_late_tolerance_minutes || 15
    return workSchedule?.late_tolerance_minutes || 15
  }

  const getScheduleTypeLabel = () => {
    if (!schedule) return 'Aucun planning'
    return schedule.use_custom_hours ? 'Horaires personnalisés' : (workSchedule?.name || 'Planning standard')
  }

  const getScheduleTypeSubtitle = () => {
    if (!schedule) return 'Non défini'
    return schedule.use_custom_hours ? 'Planning spécifique à votre profil' : 'Planning général de l’entreprise'
  }

  const today = new Date()
  const todayId = today.getDay() === 0 ? 7 : today.getDay()
  const todayStr = new Date().toISOString().split('T')[0]

  const upcomingHolidays = companyHolidays
    .filter(h => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  const monthlyCalendar = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDayUTC = new Date(Date.UTC(year, month, 1)).getUTCDay()
    const offset = firstDayUTC === 0 ? 6 : firstDayUTC - 1

    const cells = []

    for (let i = 0; i < offset; i++) {
      cells.push({ empty: true, key: `empty-${i}` })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const jsDay = new Date(dateStr + 'T12:00:00Z').getUTCDay()
      const planningDay = jsDay === 0 ? 7 : jsDay
      const isWorkDay = getWorkDays().includes(planningDay)
      const isToday = dateStr === todayStr
      const isHoliday = holidaySet.has(dateStr)
      const holiday = holidayMap.get(dateStr) || null

      cells.push({
        empty: false,
        key: dateStr,
        date: dateStr,
        day: d,
        planningDay,
        isWorkDay,
        isToday,
        isHoliday,
        holiday,
      })
    }

    return cells
  }, [calendarDate, schedule, workSchedule, holidaySet, holidayMap])

  const previousMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    setSelectedCalendarDay(null)
  }

  const nextMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    setSelectedCalendarDay(null)
  }

  const toggleRequestDay = (dayId) => {
    if (requestForm.requested_work_days.includes(dayId)) {
      setRequestForm({
        ...requestForm,
        requested_work_days: requestForm.requested_work_days.filter(d => d !== dayId),
      })
    } else {
      setRequestForm({
        ...requestForm,
        requested_work_days: [...requestForm.requested_work_days, dayId].sort(),
      })
    }
  }

  const handleOpenRequestModal = () => {
    setRequestForm({
      requested_schedule_id: availableSchedules[0]?.id || '',
      use_custom_hours: false,
      requested_start_time: getStartTime() !== '--:--' ? getStartTime() : '08:00',
      requested_end_time: getEndTime() !== '--:--' ? getEndTime() : '17:00',
      requested_break_start: getBreakStart() !== '--:--' ? getBreakStart() : '12:00',
      requested_break_end: getBreakEnd() !== '--:--' ? getBreakEnd() : '13:00',
      requested_has_break: hasBreak(),
      requested_work_days: getWorkDays().length > 0 ? getWorkDays() : [1, 2, 3, 4, 5],
      reason: '',
    })
    setShowRequestModal(true)
  }

  const handleSubmitRequest = async () => {
    if (!employee) return

    if (!requestForm.reason.trim()) {
      toast.error('Veuillez expliquer votre demande')
      return
    }

    if (!requestForm.use_custom_hours && !requestForm.requested_schedule_id) {
      toast.error('Sélectionnez un planning demandé')
      return
    }

    if (requestForm.use_custom_hours && requestForm.requested_work_days.length === 0) {
      toast.error('Sélectionnez au moins un jour de travail')
      return
    }

    setSubmittingRequest(true)
    try {
      const payload = {
        employee_id: employee.id,
        enterprise_id: employee.enterprise_id,
        current_schedule_id: schedule?.schedule_id || null,
        requested_schedule_id: requestForm.use_custom_hours ? null : requestForm.requested_schedule_id || null,
        use_custom_hours: requestForm.use_custom_hours,
        requested_start_time: requestForm.use_custom_hours ? requestForm.requested_start_time + ':00' : null,
        requested_end_time: requestForm.use_custom_hours ? requestForm.requested_end_time + ':00' : null,
        requested_break_start: requestForm.use_custom_hours && requestForm.requested_has_break ? requestForm.requested_break_start + ':00' : null,
        requested_break_end: requestForm.use_custom_hours && requestForm.requested_has_break ? requestForm.requested_break_end + ':00' : null,
        requested_has_break: requestForm.use_custom_hours ? requestForm.requested_has_break : true,
        requested_work_days: requestForm.use_custom_hours ? requestForm.requested_work_days : null,
        reason: requestForm.reason.trim(),
        status: 'pending',
        updated_at: new Date().toISOString(),
      }

      const { error } = await db()
        .from('schedule_change_requests')
        .insert(payload)

      if (error) throw error

      toast.success('Demande envoyée à l’administrateur')
      setShowRequestModal(false)
      await loadChangeRequests(employee)
    } catch (err) {
      console.error('Erreur demande changement planning:', err)
      toast.error('Erreur lors de l’envoi')
    }
    setSubmittingRequest(false)
  }

  const latestPendingRequest = changeRequests.find(r => r.status === 'pending')

  if (!employee) return null

  return (
    <EmployeeLayout>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .schedule-card-hover { transition: all 0.25s ease; }
        .schedule-card-hover:hover {
          transform: translateY(-2px);
          border-color: rgba(16,185,129,0.18) !important;
          background: rgba(16,185,129,0.04) !important;
        }
        .calendar-day-hover:hover {
          transform: translateY(-2px);
          border-color: rgba(245,158,11,0.3) !important;
        }
        .toggle-btn:hover {
          background: rgba(255,255,255,0.06) !important;
        }
        @media (max-width: 980px) {
          .employee-planning-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .employee-planning-header { flex-direction: column !important; align-items: stretch !important; }
          .employee-planning-toolbar { flex-direction: column !important; align-items: stretch !important; }
          .employee-planning-calendar-cell { min-height: 84px !important; }
          .employee-planning-summary { grid-template-columns: repeat(2, 1fr) !important; }
          .employee-planning-form-row { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .employee-planning-summary { grid-template-columns: 1fr !important; }
          .employee-planning-calendar-cell { min-height: 76px !important; }
        }
      `}</style>

      <div style={S.container}>
        <div style={S.header} className="employee-planning-header">
          <div>
            <h1 style={S.title}>Mes horaires</h1>
            <p style={S.subtitle}>Votre planning de travail en temps réel</p>
          </div>

          <div style={S.headerActions} className="employee-planning-toolbar">
            <div style={S.viewSwitch}>
              <button
                className="toggle-btn"
                onClick={() => setViewMode('calendar')}
                style={{ ...S.viewBtn, ...(viewMode === 'calendar' ? S.viewBtnActive : {}) }}
              >
                <CalendarDays size={15} />
                <span>Calendrier</span>
              </button>
              <button
                className="toggle-btn"
                onClick={() => setViewMode('weekly')}
                style={{ ...S.viewBtn, ...(viewMode === 'weekly' ? S.viewBtnActive : {}) }}
              >
                <Clock size={15} />
                <span>Semaine</span>
              </button>
            </div>

            <button onClick={handleOpenRequestModal} style={S.requestBtn}>
              <Plus size={16} />
              <span>Demander une modification</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={S.loading}>
            <div style={S.spinner}></div>
          </div>
        ) : !schedule ? (
          <div style={S.empty}>
            <Calendar size={48} color="#666" />
            <h3 style={{ color: '#FFF', margin: 0 }}>Aucun horaire défini</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Votre administrateur n'a pas encore défini vos horaires de travail.
            </p>
          </div>
        ) : (
          <>
            {latestPendingRequest && (
              <div style={S.pendingBanner}>
                <div style={S.pendingBannerIcon}>
                  <RefreshCw size={18} color="#F59E0B" />
                </div>
                <div>
                  <div style={S.pendingBannerTitle}>Demande de modification en attente</div>
                  <div style={S.pendingBannerText}>
                    Votre demande du {new Date(latestPendingRequest.created_at).toLocaleDateString('fr-FR')} est en cours d’examen.
                  </div>
                </div>
              </div>
            )}

            <div style={S.summaryGrid} className="employee-planning-summary">
              <div style={S.summaryCard}>
                <div style={{ ...S.summaryIcon, background: 'rgba(16,185,129,0.14)' }}>
                  <Clock size={20} color="#10B981" />
                </div>
                <div>
                  <span style={S.summaryValue}>{getStartTime()} - {getEndTime()}</span>
                  <span style={S.summaryLabel}>Horaires</span>
                </div>
              </div>

              <div style={S.summaryCard}>
                <div style={{ ...S.summaryIcon, background: 'rgba(245,158,11,0.14)' }}>
                  <Coffee size={20} color="#F59E0B" />
                </div>
                <div>
                  <span style={S.summaryValue}>{hasBreak() ? `${getBreakStart()} - ${getBreakEnd()}` : 'Aucune'}</span>
                  <span style={S.summaryLabel}>Pause</span>
                </div>
              </div>

              <div style={S.summaryCard}>
                <div style={{ ...S.summaryIcon, background: 'rgba(99,102,241,0.14)' }}>
                  <AlertCircle size={20} color="#6366F1" />
                </div>
                <div>
                  <span style={S.summaryValue}>{getLateTolerance()} min</span>
                  <span style={S.summaryLabel}>Tolérance retard</span>
                </div>
              </div>

              <div style={S.summaryCard}>
                <div style={{ ...S.summaryIcon, background: 'rgba(139,92,246,0.14)' }}>
                  {schedule.use_custom_hours ? <Shield size={20} color="#8B5CF6" /> : <Briefcase size={20} color="#8B5CF6" />}
                </div>
                <div>
                  <span style={S.summaryValue}>{schedule.use_custom_hours ? 'Personnalisé' : 'Entreprise'}</span>
                  <span style={S.summaryLabel}>Type de planning</span>
                </div>
              </div>
            </div>

            <div style={S.infoBanner}>
              <div style={S.infoBannerIcon}>
                <Sparkles size={18} color="#10B981" />
              </div>
              <div>
                <div style={S.infoTitle}>{getScheduleTypeLabel()}</div>
                <div style={S.infoText}>{getScheduleTypeSubtitle()}</div>
              </div>
            </div>

            <div style={S.mainGrid} className="employee-planning-grid">
              <div style={S.mainCol}>
                {viewMode === 'weekly' && (
                  <div style={S.card}>
                    <div style={S.cardHeader}>
                      <div style={S.cardHeaderLeft}>
                        <div style={S.cardHeaderIcon}>
                          <Clock size={18} color="#10B981" />
                        </div>
                        <div>
                          <h3 style={S.cardTitle}>Vue hebdomadaire</h3>
                          <p style={S.cardSub}>Vos jours de travail et horaires associés</p>
                        </div>
                      </div>
                    </div>

                    <div style={S.weekList}>
                      {joursSemaine.map((jour, i) => {
                        const isWorkDay = getWorkDays().includes(jour.id)
                        const isToday = jour.id === todayId
                        return (
                          <div
                            key={jour.id}
                            className="schedule-card-hover"
                            style={{
                              ...S.weekCard,
                              ...(isWorkDay ? S.weekCardActive : {}),
                              ...(isToday ? S.weekCardToday : {}),
                              animation: `fadeInUp 0.3s ease ${i * 0.05}s forwards`,
                              opacity: 0,
                            }}
                          >
                            <div style={S.weekCardHeader}>
                              <div>
                                <span style={{ ...S.weekDayName, color: isWorkDay ? '#FFF' : '#666' }}>
                                  {jour.nom}
                                </span>
                                {isToday && <span style={S.todayBadge}>Aujourd'hui</span>}
                              </div>
                            </div>

                            {isWorkDay ? (
                              <div style={S.weekInfo}>
                                <div style={S.weekInfoRow}>
                                  <Sun size={15} color="#F59E0B" />
                                  <span style={S.weekInfoText}>{getStartTime()} → {getEndTime()}</span>
                                </div>
                                {hasBreak() && (
                                  <div style={S.weekInfoRow}>
                                    <Coffee size={15} color="#8B5CF6" />
                                    <span style={S.weekInfoText}>Pause {getBreakStart()} - {getBreakEnd()}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={S.weekOff}>Jour de repos</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {viewMode === 'calendar' && (
                  <div style={S.card}>
                    <div style={S.calendarHeader}>
                      <button onClick={previousMonth} style={S.calendarNavBtn}>
                        <ChevronLeft size={18} />
                      </button>
                      <div style={{ textAlign: 'center' }}>
                        <h3 style={S.cardTitle}>
                          {calendarDate.toLocaleDateString('fr-FR', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </h3>
                        <p style={S.cardSub}>Calendrier de vos horaires</p>
                      </div>
                      <button onClick={nextMonth} style={S.calendarNavBtn}>
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div style={S.calendarGrid}>
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                        <div key={i} style={S.calendarDayHeader}>{d}</div>
                      ))}

                      {monthlyCalendar.map((cell, idx) => {
                        if (cell.empty) {
                          return <div key={cell.key || `empty-${idx}`} style={S.calendarEmpty}></div>
                        }

                        const isSelected = selectedCalendarDay?.date === cell.date

                        return (
                          <div
                            key={cell.key}
                            className="calendar-day-hover employee-planning-calendar-cell"
                            onClick={() => setSelectedCalendarDay(isSelected ? null : cell)}
                            style={{
                              ...S.calendarCell,
                              ...(cell.isWorkDay ? S.calendarCellWork : {}),
                              ...(cell.isToday ? S.calendarCellToday : {}),
                              ...(cell.isHoliday ? S.calendarCellHoliday : {}),
                              ...(isSelected ? S.calendarCellSelected : {}),
                            }}
                          >
                            <div style={S.calendarCellTop}>
                              <span style={S.calendarCellDay}>{cell.day}</span>
                              {cell.isHoliday && <span style={S.calendarHolidayEmoji}>🎌</span>}
                            </div>

                            {cell.isHoliday && (
                              <div style={S.calendarHolidayName}>
                                {cell.holiday?.name}
                              </div>
                            )}

                            {cell.isWorkDay ? (
                              <div style={S.calendarShiftChip}>
                                {getStartTime()}
                              </div>
                            ) : (
                              <div style={S.calendarRestChip}>Repos</div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div style={S.calendarLegend}>
                      <div style={S.legendItem}>
                        <div style={{ ...S.legendDot, background: '#10B981' }}></div>
                        <span style={S.legendText}>Jour travaillé</span>
                      </div>
                      <div style={S.legendItem}>
                        <div style={{ ...S.legendDot, background: '#8B5CF6' }}></div>
                        <span style={S.legendText}>Jour férié</span>
                      </div>
                      <div style={S.legendItem}>
                        <div style={{ ...S.legendDot, background: '#F59E0B' }}></div>
                        <span style={S.legendText}>Aujourd’hui</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={S.sideCol}>
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <div style={S.cardHeaderLeft}>
                      <div style={S.cardHeaderIcon}>
                        <CalendarDays size={18} color="#8B5CF6" />
                      </div>
                      <div>
                        <h3 style={S.cardTitle}>Jours fériés entreprise</h3>
                        <p style={S.cardSub}>Visibles en temps réel</p>
                      </div>
                    </div>
                  </div>

                  <div style={S.sideList}>
                    {upcomingHolidays.length === 0 ? (
                      <div style={S.emptyMini}>Aucun jour férié à venir</div>
                    ) : (
                      upcomingHolidays.map(h => (
                        <div key={h.id} style={S.sideItem}>
                          <div>
                            <div style={S.sideItemTitle}>🎌 {h.name}</div>
                            <div style={S.sideItemSub}>{formatDateShortUTC(h.date)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedCalendarDay && !selectedCalendarDay.empty && (
                  <div style={S.card}>
                    <div style={S.cardHeader}>
                      <div style={S.cardHeaderLeft}>
                        <div style={S.cardHeaderIcon}>
                          <Calendar size={18} color="#F59E0B" />
                        </div>
                        <div>
                          <h3 style={S.cardTitle}>Détail du jour</h3>
                          <p style={S.cardSub}>{formatDateLongUTC(selectedCalendarDay.date)}</p>
                        </div>
                      </div>
                    </div>

                    <div style={S.dayDetailBox}>
                      {selectedCalendarDay.isHoliday && (
                        <div style={S.dayHighlightHoliday}>
                          <span style={{ fontSize: 16 }}>🎌</span>
                          <div>
                            <div style={S.dayHighlightTitle}>{selectedCalendarDay.holiday?.name}</div>
                            <div style={S.dayHighlightSub}>Jour férié entreprise</div>
                          </div>
                        </div>
                      )}

                      {selectedCalendarDay.isWorkDay ? (
                        <div style={S.dayHighlightWork}>
                          <CheckCircle size={18} color="#10B981" />
                          <div>
                            <div style={S.dayHighlightTitle}>Jour travaillé</div>
                            <div style={S.dayHighlightSub}>
                              {getStartTime()} → {getEndTime()}
                              {hasBreak() && ` • Pause ${getBreakStart()} - ${getBreakEnd()}`}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={S.dayHighlightRest}>
                          <Calendar size={18} color="#666" />
                          <div>
                            <div style={S.dayHighlightTitle}>Jour de repos</div>
                            <div style={S.dayHighlightSub}>Aucun horaire prévu</div>
                          </div>
                        </div>
                      )}

                      <div style={S.dayMiniGrid}>
                        <div style={S.dayMiniCard}>
                          <span style={S.dayMiniLabel}>Type</span>
                          <span style={S.dayMiniValue}>{schedule.use_custom_hours ? 'Personnalisé' : 'Entreprise'}</span>
                        </div>
                        <div style={S.dayMiniCard}>
                          <span style={S.dayMiniLabel}>Tolérance</span>
                          <span style={S.dayMiniValue}>{getLateTolerance()} min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <div style={S.cardHeaderLeft}>
                      <div style={S.cardHeaderIcon}>
                        <MessageSquare size={18} color="#F59E0B" />
                      </div>
                      <div>
                        <h3 style={S.cardTitle}>Mes demandes</h3>
                        <p style={S.cardSub}>Historique des demandes de changement</p>
                      </div>
                    </div>
                  </div>

                  <div style={S.sideList}>
                    {changeRequests.length === 0 ? (
                      <div style={S.emptyMini}>Aucune demande envoyée</div>
                    ) : (
                      changeRequests.slice(0, 6).map(req => (
                        <div key={req.id} style={S.sideItem}>
                          <div>
                            <div style={S.sideItemTitle}>
                              {req.use_custom_hours ? 'Horaires personnalisés' : 'Changement de planning'}
                            </div>
                            <div style={S.sideItemSub}>
                              {new Date(req.created_at).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          <div style={{
                            ...S.requestStatusBadge,
                            background: req.status === 'pending'
                              ? 'rgba(245,158,11,0.12)'
                              : req.status === 'approved'
                                ? 'rgba(16,185,129,0.12)'
                                : 'rgba(239,68,68,0.12)',
                            color: req.status === 'pending'
                              ? '#F59E0B'
                              : req.status === 'approved'
                                ? '#10B981'
                                : '#EF4444',
                          }}>
                            {req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuvée' : 'Refusée'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* MODAL DEMANDE */}
        {showRequestModal && (
          <div style={S.modalOverlay} onClick={() => !submittingRequest && setShowRequestModal(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalHeaderLeft}>
                  <div style={S.modalIcon}>
                    <MessageSquare size={20} color="#F59E0B" />
                  </div>
                  <div>
                    <h3 style={S.modalTitle}>Demander une modification</h3>
                    <p style={S.modalSubtitle}>Votre demande sera envoyée à l’administrateur</p>
                  </div>
                </div>
                <button onClick={() => setShowRequestModal(false)} style={S.closeBtn}>
                  <X size={18} />
                </button>
              </div>

              <div style={S.modalBody}>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>Type de demande</label>
                  <div style={S.choiceRow}>
                    <button
                      type="button"
                      onClick={() => setRequestForm({ ...requestForm, use_custom_hours: false })}
                      style={{
                        ...S.choiceBtn,
                        ...(!requestForm.use_custom_hours ? S.choiceBtnActive : {})
                      }}
                    >
                      <Briefcase size={15} />
                      <span>Planning existant</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestForm({ ...requestForm, use_custom_hours: true })}
                      style={{
                        ...S.choiceBtn,
                        ...(requestForm.use_custom_hours ? S.choiceBtnActive : {})
                      }}
                    >
                      <Shield size={15} />
                      <span>Horaire personnalisé</span>
                    </button>
                  </div>
                </div>

                {!requestForm.use_custom_hours ? (
                  <div style={S.formGroup}>
                    <label style={S.formLabel}>Planning demandé</label>
                    <select
                      value={requestForm.requested_schedule_id}
                      onChange={e => setRequestForm({ ...requestForm, requested_schedule_id: e.target.value })}
                      style={S.select}
                    >
                      <option value="">-- Sélectionner un planning --</option>
                      {availableSchedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} • {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="employee-planning-form-row" style={S.formRow}>
                      <div style={S.formGroup}>
                        <label style={S.formLabel}>Heure d’arrivée</label>
                        <input
                          type="time"
                          value={requestForm.requested_start_time}
                          onChange={e => setRequestForm({ ...requestForm, requested_start_time: e.target.value })}
                          style={S.input}
                        />
                      </div>
                      <div style={S.formGroup}>
                        <label style={S.formLabel}>Heure de départ</label>
                        <input
                          type="time"
                          value={requestForm.requested_end_time}
                          onChange={e => setRequestForm({ ...requestForm, requested_end_time: e.target.value })}
                          style={S.input}
                        />
                      </div>
                    </div>

                    <div style={S.formGroup}>
                      <label style={S.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={requestForm.requested_has_break}
                          onChange={e => setRequestForm({ ...requestForm, requested_has_break: e.target.checked })}
                        />
                        <span>Inclure une pause</span>
                      </label>
                    </div>

                    {requestForm.requested_has_break && (
                      <div className="employee-planning-form-row" style={S.formRow}>
                        <div style={S.formGroup}>
                          <label style={S.formLabel}>Début pause</label>
                          <input
                            type="time"
                            value={requestForm.requested_break_start}
                            onChange={e => setRequestForm({ ...requestForm, requested_break_start: e.target.value })}
                            style={S.input}
                          />
                        </div>
                        <div style={S.formGroup}>
                          <label style={S.formLabel}>Fin pause</label>
                          <input
                            type="time"
                            value={requestForm.requested_break_end}
                            onChange={e => setRequestForm({ ...requestForm, requested_break_end: e.target.value })}
                            style={S.input}
                          />
                        </div>
                      </div>
                    )}

                    <div style={S.formGroup}>
                      <label style={S.formLabel}>Jours demandés</label>
                      <div style={S.daysGrid}>
                        {joursSemaine.map(jour => (
                          <button
                            key={jour.id}
                            type="button"
                            onClick={() => toggleRequestDay(jour.id)}
                            style={{
                              ...S.dayBtn,
                              ...(requestForm.requested_work_days.includes(jour.id) ? S.dayBtnActive : {})
                            }}
                          >
                            {jour.court}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div style={S.formGroup}>
                  <label style={S.formLabel}>Motif de la demande *</label>
                  <textarea
                    value={requestForm.reason}
                    onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })}
                    placeholder="Expliquez pourquoi vous souhaitez modifier vos horaires..."
                    style={S.textarea}
                    rows={4}
                  />
                </div>
              </div>

              <div style={S.modalFooter}>
                <button onClick={() => setShowRequestModal(false)} style={S.cancelBtn} disabled={submittingRequest}>
                  Annuler
                </button>
                <button onClick={handleSubmitRequest} style={S.submitBtn} disabled={submittingRequest}>
                  {submittingRequest ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spinSlow 0.8s linear infinite' }} />
                      <span>Envoi...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Envoyer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  )
}

const S = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px' },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: { color: '#FFF', fontSize: '24px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#666', fontSize: '14px', margin: '4px 0 0 0' },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  viewSwitch: {
    display: 'flex',
    background: 'rgba(20,20,35,0.8)',
    borderRadius: '12px',
    padding: '4px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
    fontFamily: 'inherit',
  },
  viewBtnActive: {
    background: 'rgba(16,185,129,0.12)',
    color: '#10B981',
  },
  requestBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '11px 16px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: '60px',
  },
  spinner: {
    width: '40px', height: '40px',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#10B981', borderRadius: '50%',
    animation: 'spinSlow 0.8s linear infinite',
  },

  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '60px 20px',
    background: 'rgba(20, 20, 35, 0.5)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
  },

  pendingBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.16)',
    borderRadius: '16px',
  },
  pendingBannerIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    background: 'rgba(245,158,11,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pendingBannerTitle: {
    color: '#F59E0B',
    fontSize: '14px',
    fontWeight: '700',
  },
  pendingBannerText: {
    color: '#D6B570',
    fontSize: '12px',
    marginTop: '3px',
    lineHeight: '1.5',
  },

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(20, 20, 35, 0.72)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  summaryIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryValue: {
    display: 'block',
    color: '#FFF',
    fontSize: '16px',
    fontWeight: '700',
    lineHeight: 1.2,
  },
  summaryLabel: {
    display: 'block',
    color: '#666',
    fontSize: '11px',
    marginTop: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'rgba(16,185,129,0.06)',
    border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '16px',
  },
  infoBannerIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    background: 'rgba(16,185,129,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTitle: {
    color: '#10B981',
    fontSize: '14px',
    fontWeight: '700',
    marginBottom: '2px',
  },
  infoText: {
    color: '#A7F3D0',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 0.95fr)',
    gap: '16px',
    alignItems: 'start',
  },
  mainCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sideCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  card: {
    background: 'rgba(20, 20, 35, 0.72)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '18px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardHeaderIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'rgba(16,185,129,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
    textTransform: 'capitalize',
  },
  cardSub: {
    color: '#666',
    fontSize: '12px',
    margin: '3px 0 0 0',
  },

  weekList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  weekCard: {
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  weekCardActive: {
    background: 'rgba(16,185,129,0.05)',
    borderColor: 'rgba(16,185,129,0.14)',
  },
  weekCardToday: {
    borderColor: 'rgba(245,158,11,0.3)',
    boxShadow: '0 0 0 1px rgba(245,158,11,0.15)',
  },
  weekCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  weekDayName: {
    fontSize: '15px',
    fontWeight: '700',
  },
  todayBadge: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '700',
  },
  weekInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  weekInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  weekInfoText: {
    color: '#E5E5E5',
    fontSize: '13px',
    fontWeight: '500',
  },
  weekOff: {
    color: '#666',
    fontSize: '13px',
    fontStyle: 'italic',
  },

  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  calendarNavBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.18)',
    color: '#F59E0B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  calendarDayHeader: {
    textAlign: 'center',
    color: '#888',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '8px 0',
  },
  calendarEmpty: {
    minHeight: '96px',
    borderRadius: '12px',
    border: '1px solid transparent',
  },
  calendarCell: {
    minHeight: '96px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  calendarCellWork: {
    background: 'rgba(16,185,129,0.04)',
    borderColor: 'rgba(16,185,129,0.12)',
  },
  calendarCellToday: {
    borderColor: 'rgba(245,158,11,0.35)',
  },
  calendarCellHoliday: {
    background: 'rgba(139,92,246,0.05)',
    borderColor: 'rgba(139,92,246,0.14)',
  },
  calendarCellSelected: {
    background: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  calendarCellTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarCellDay: {
    color: '#FFF',
    fontSize: '12px',
    fontWeight: '700',
  },
  calendarHolidayEmoji: {
    fontSize: '11px',
  },
  calendarHolidayName: {
    color: '#A78BFA',
    fontSize: '9px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  calendarShiftChip: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    background: 'rgba(16,185,129,0.14)',
    border: '1px solid rgba(16,185,129,0.2)',
    color: '#10B981',
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 7px',
    borderRadius: '8px',
  },
  calendarRestChip: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#666',
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 7px',
    borderRadius: '8px',
  },
  calendarLegend: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  legendText: {
    color: '#888',
    fontSize: '12px',
  },

  sideList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sideItem: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '14px',
    padding: '12px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  sideItemTitle: {
    color: '#FFF',
    fontSize: '13px',
    fontWeight: '700',
  },
  sideItemSub: {
    color: '#888',
    fontSize: '11px',
    marginTop: '3px',
  },
  requestStatusBadge: {
    padding: '4px 9px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: '700',
    flexShrink: 0,
  },

  dayDetailBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dayHighlightHoliday: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.18)',
    borderRadius: '14px',
    padding: '14px',
  },
  dayHighlightWork: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.18)',
    borderRadius: '14px',
    padding: '14px',
  },
  dayHighlightRest: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '14px',
  },
  dayHighlightTitle: {
    color: '#FFF',
    fontSize: '14px',
    fontWeight: '700',
  },
  dayHighlightSub: {
    color: '#888',
    fontSize: '12px',
    marginTop: '3px',
    lineHeight: '1.5',
  },
  dayMiniGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  dayMiniCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  dayMiniLabel: {
    color: '#666',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '700',
  },
  dayMiniValue: {
    color: '#FFF',
    fontSize: '13px',
    fontWeight: '700',
  },

  emptyMini: {
    padding: '16px',
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.08)',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 300,
  },
  modal: {
    width: '100%',
    maxWidth: '560px',
    background: '#141423',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  modalHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  modalIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(245,158,11,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: '17px',
    fontWeight: '700',
    margin: 0,
  },
  modalSubtitle: {
    color: '#666',
    fontSize: '12px',
    margin: '3px 0 0 0',
  },
  closeBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formLabel: {
    color: '#E5E5E5',
    fontSize: '13px',
    fontWeight: '600',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '90px',
  },
  choiceRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  choiceBtn: {
    flex: 1,
    minWidth: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#888',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  choiceBtnActive: {
    background: 'rgba(245,158,11,0.12)',
    color: '#F59E0B',
    borderColor: 'rgba(245,158,11,0.22)',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#E5E5E5',
    fontSize: '13px',
    fontWeight: '500',
  },
  daysGrid: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  dayBtn: {
    padding: '10px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: '#888',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  dayBtnActive: {
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    borderColor: '#F59E0B',
    color: '#000',
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  cancelBtn: {
    flex: 1,
    padding: '13px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#E5E5E5',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  submitBtn: {
    flex: 1,
    padding: '13px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    color: '#000',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
}