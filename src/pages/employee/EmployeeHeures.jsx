// src/pages/employee/EmployeeHeures.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, TrendingUp, Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { db } from '../../lib/db'
import EmployeeAuthService from '../../services/employeeAuthService'
import FeatureService from '../../services/featureService'
import HolidayService from '../../services/holidayService'
import EmployeeLayout from '../../components/EmployeeLayout'
import { formaterHeureLocaleShort } from '../../utils/timezoneUtils'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// ✅ UTILITAIRES UTC
// ═══════════════════════════════════════════════════════════
function getUTCDateKey(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthBoundsUTC(date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0))
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))
  return {
    start: firstDay.toISOString(),
    end: lastDay.toISOString(),
  }
}

function getUTCDay(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay()
}

function formatUTCDayLabel(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z')
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    timeZone: 'UTC',
  })
}

function formatUTCDateShort(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z')
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// ═══════════════════════════════════════════════════════════
// ⚠️ SUPPRIMÉ : calculateContractualSecondsFromEmployeeSchedule
//    → Cette logique est maintenant dans FeatureService.calculateOvertimeForEmployeeDay()
// ═══════════════════════════════════════════════════════════

export default function EmployeeHeures() {
  const [employee, setEmployee] = useState(null)
  const [dailyData, setDailyData] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [overtimeSettings, setOvertimeSettings] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [employeeSchedule, setEmployeeSchedule] = useState(null)

  const navigate = useNavigate()

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) { navigate('/employee/login'); return }
    if (!emp.features?.heures_supplementaires) { navigate('/employee/dashboard'); return }
    setEmployee(emp)
  }, [navigate])

  useEffect(() => {
    if (employee) loadData(employee)
  }, [employee, currentMonth])

  const loadData = async (emp) => {
    setLoading(true)
    try {
      // ═══ CHARGER LE PLANNING PERSONNALISÉ DE L'EMPLOYÉ ═══
      const { data: empScheduleData } = await db()
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .eq('employee_id', emp.id)
        .eq('is_active', true)
        .single()

      setEmployeeSchedule(empScheduleData || null)

      const [settings, loadedSchedules] = await Promise.all([
        FeatureService.getOvertimeSettings(emp.enterprise_id),
        FeatureService.loadSchedules(emp.enterprise_id),
      ])
      setOvertimeSettings(settings)
      setSchedules(loadedSchedules)

      const { start, end } = getMonthBoundsUTC(currentMonth)
      const startDate = start.split('T')[0]
      const endDate = end.split('T')[0]

      const [attendancesResult, holidays] = await Promise.all([
        db()
          .from('attendances')
          .select('check_time, check_type')
          .eq('employee_id', emp.id)
          .gte('check_time', start)
          .lte('check_time', end)
          .order('check_time', { ascending: true }),
        HolidayService.getHolidaysForRange(emp.enterprise_id, startDate, endDate),
      ])

      if (attendancesResult.error) throw attendancesResult.error

      const holidayMap = HolidayService.buildHolidayMap(holidays)

      const allAttendances = attendancesResult.data || []

      const daily = []
      const year = currentMonth.getUTCFullYear()
      const month = currentMonth.getUTCMonth()
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

        const startOfDay = new Date(`${dateStr}T00:00:00Z`)
        const endOfNextDay = new Date(startOfDay)
        endOfNextDay.setUTCDate(endOfNextDay.getUTCDate() + 1)
        endOfNextDay.setUTCHours(14, 0, 0, 0)

        const relevantAttendances = allAttendances.filter(att => {
          const t = new Date(att.check_time)
          return t >= startOfDay && t <= endOfNextDay
        })

        if (relevantAttendances.length === 0) continue

        let totalSeconds = 0
        let currentIn = null
        let validPairs = []
        let firstCheckIn = null
        let lastCheckOut = null

        for (let i = 0; i < relevantAttendances.length; i++) {
          const pt = relevantAttendances[i]
          const ptDate = new Date(pt.check_time)
          const pointageDateStr = pt.check_time.split('T')[0]

          if (pt.check_type === 'in') {
            let isValidIn = false

            if (pointageDateStr === dateStr) {
              isValidIn = true
            } else {
              if (validPairs.length > 0) {
                const lastOutTime = new Date(validPairs[validPairs.length - 1].out.check_time)
                const diffHours = (ptDate - lastOutTime) / (1000 * 60 * 60)
                if (diffHours < 8) {
                  isValidIn = true
                }
              }
            }

            if (isValidIn) {
              currentIn = pt
              if (!firstCheckIn) firstCheckIn = new Date(pt.check_time)
            } else {
              currentIn = null
            }
          } else if (pt.check_type === 'out' && currentIn) {
            const inDate = new Date(currentIn.check_time)
            const diffHours = (ptDate - inDate) / (1000 * 60 * 60)

            if (diffHours <= 16) {
              totalSeconds += (ptDate - inDate) / 1000
              validPairs.push({ in: currentIn, out: pt })
              lastCheckOut = ptDate
              currentIn = null
            }
          }
        }

        if (totalSeconds <= 0 && !firstCheckIn) continue

        const holiday = holidayMap.get(dateStr) || null
        const isHoliday = !!holiday

        // ═══════════════════════════════════════════════════════════
        // ✅ APPEL UNIQUE AU MOTEUR CENTRAL — REMPLACE TOUT LE BLOC
        // ═══════════════════════════════════════════════════════════
        const overtime = FeatureService.calculateOvertimeForEmployeeDay({
          totalWorkedSeconds: totalSeconds,
          employeeSchedule: empScheduleData || null,
          enterpriseId: emp.enterprise_id,
          dateStr,
          allSchedules: loadedSchedules || [],
          overtimeSettings: settings,
          holiday: holiday || null,
        })

        const contractualSecondsDisplay = overtime.contractualSeconds || 0

        daily.push({
          date: dateStr,
          totalSeconds,
          checkIn: firstCheckIn
            ? formaterHeureLocaleShort(firstCheckIn.toISOString())
            : null,
          checkOut: lastCheckOut
            ? formaterHeureLocaleShort(lastCheckOut.toISOString())
            : null,
          isHoliday,
          holidayName: holiday?.name || null,
          holidayRate: holiday?.overtime_rate || null,
          ...overtime,
          contractualSeconds: contractualSecondsDisplay,
        })
      }

      setDailyData(daily.reverse())
    } catch (err) {
      console.error('Erreur chargement heures:', err)
      toast.error('Erreur de chargement')
    }
    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // ⚠️ SUPPRIMÉ : calculateOvertimeFromThreshold
  //    → Cette logique est maintenant dans FeatureService
  // ═══════════════════════════════════════════════════════════

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0h00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h${m.toString().padStart(2, '0')}`
  }

  const prevMonth = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev)
      d.setUTCMonth(d.getUTCMonth() - 1)
      d.setUTCDate(1)
      return d
    })
  }

  const nextMonth = () => {
    const next = new Date(currentMonth)
    next.setUTCMonth(next.getUTCMonth() + 1)
    next.setUTCDate(1)
    const now = new Date()
    if (next <= now) setCurrentMonth(next)
  }

  const isNextMonthDisabled = () => {
    const next = new Date(currentMonth)
    next.setUTCMonth(next.getUTCMonth() + 1)
    next.setUTCDate(1)
    return next > new Date()
  }

  const monthLabel = currentMonth.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const totalOvertime = dailyData.reduce((s, d) => s + (d.totalOvertimeSeconds || 0), 0)
  const totalWorked = dailyData.reduce((s, d) => s + (d.totalSeconds || 0), 0)
  const daysWithOvertime = dailyData.filter(d => d.hasOvertime).length
  const daysWorked = dailyData.length

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
        .ot-row { transition: all 0.2s ease; }
        .ot-row:hover { background: rgba(255,255,255,0.03) !important; }
        .month-btn:hover:not(:disabled) { background: rgba(245,158,11,0.15) !important; border-color: rgba(245,158,11,0.3) !important; }
      `}</style>

      <div style={S.container}>
        <div>
          <h1 style={S.title}>Heures supplémentaires</h1>
          <p style={S.subtitle}>Suivi mensuel de vos heures travaillées</p>
        </div>

        <div style={S.monthNav}>
          <button className="month-btn" onClick={prevMonth} style={S.monthBtn}>
            <ChevronLeft size={20} />
          </button>
          <span style={S.monthLabel}>{monthLabel}</span>
          <button
            className="month-btn"
            onClick={nextMonth}
            disabled={isNextMonthDisabled()}
            style={{
              ...S.monthBtn,
              opacity: isNextMonthDisabled() ? 0.3 : 1,
              cursor: isNextMonthDisabled() ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div style={S.summaryGrid}>
          {[
            {
              icon: Clock, color: '#6366F1',
              value: formatTime(totalWorked),
              label: 'Total travaillé',
            },
            {
              icon: TrendingUp,
              color: totalOvertime > 0 ? '#F59E0B' : '#555',
              value: totalOvertime > 0 ? `+${formatTime(totalOvertime)}` : '—',
              label: 'Heures sup',
            },
            {
              icon: Calendar, color: '#10B981',
              value: daysWorked,
              label: 'Jours travaillés',
            },
            {
              icon: TrendingUp, color: '#EC4899',
              value: daysWithOvertime,
              label: 'Jours avec h.sup',
            },
          ].map((card, i) => (
            <div key={i} style={S.summaryCard}>
              <div style={{
                ...S.summaryIcon,
                background: `${card.color}18`,
              }}>
                <card.icon size={20} color={card.color} />
              </div>
              <div>
                <span style={{ ...S.summaryValue, color: card.color !== '#555' ? card.color : '#FFF' }}>
                  {card.value}
                </span>
                <span style={S.summaryLabel}>{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
            <p style={{ color: '#666', marginTop: '12px', fontSize: '14px' }}>
              Chargement...
            </p>
          </div>
        ) : dailyData.length === 0 ? (
          <div style={S.emptyWrap}>
            <AlertCircle size={48} color="#555" />
            <h3 style={{ color: '#FFF', margin: '12px 0 4px 0' }}>Aucun pointage</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Aucune donnée pour {monthLabel}
            </p>
          </div>
        ) : (
          <div style={S.tableWrap}>
            <div style={S.tableHeader}>
              <span style={{ ...S.th, flex: 2 }}>Date</span>
              <span style={S.th}>Arrivée</span>
              <span style={S.th}>Départ</span>
              <span style={S.th}>Travaillé</span>
              <span style={{ ...S.th, textAlign: 'right' }}>H.Sup</span>
            </div>

            {dailyData.map((day, i) => {
              const utcDow = getUTCDay(day.date)
              const isWeekend = utcDow === 0 || utcDow === 6

              return (
                <div
                  key={day.date}
                  className="ot-row"
                  style={{
                    ...S.tableRow,
                    animation: `fadeInUp 0.3s ease ${i * 0.03}s forwards`,
                    opacity: 0,
                    background: isWeekend
                      ? 'rgba(255,255,255,0.01)'
                      : 'transparent',
                    borderLeft: day.hasOvertime
                      ? '3px solid rgba(245,158,11,0.5)'
                      : '3px solid transparent',
                  }}
                >
                  <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={S.dayName}>
                      {formatUTCDayLabel(day.date)}
                    </span>
                    <span style={S.dayDate}>
                      {formatUTCDateShort(day.date)}
                    </span>
                    {isWeekend && (
                      <span style={S.weekendBadge}>WE</span>
                    )}
                    {day.isHoliday && (
                      <span style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: '#8B5CF6',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        padding: '1px 7px',
                        borderRadius: '5px',
                        fontSize: '9px',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                      }}>
                        🎌 {day.holidayName || 'Férié'}
                      </span>
                    )}
                  </div>

                  <span style={{ ...S.td, color: '#10B981', fontFamily: 'monospace' }}>
                    {day.checkIn || '—'}
                  </span>

                  <span style={{ ...S.td, color: '#EF4444', fontFamily: 'monospace' }}>
                    {day.checkOut || '—'}
                  </span>

                  <div style={S.td}>
                    <span style={{ color: '#CCC', fontSize: '13px' }}>
                      {formatTime(day.totalSeconds)}
                    </span>
                    {day.contractualSeconds > 0 && (
                      <span style={{
                        display: 'block',
                        color: '#555',
                        fontSize: '10px',
                        marginTop: '2px',
                      }}>
                        / {formatTime(day.contractualSeconds)}
                      </span>
                    )}
                  </div>

                  <div style={{ ...S.td, textAlign: 'right' }}>
                    {day.hasOvertime ? (
                      <>
                        <span style={S.overtimeBadge}>
                          {FeatureService.formatOvertimeDisplay(day.totalOvertimeSeconds)}
                        </span>
                        {day.rateApplied > 0 && (
                          <span style={{
                            display: 'block',
                            color: '#888',
                            fontSize: '10px',
                            marginTop: '2px',
                            textAlign: 'right',
                          }}>
                            +{day.rateApplied}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </div>
                </div>
              )
            })}

            <div style={S.totalRow}>
              <span style={{ ...S.th, flex: 2, color: '#FFF' }}>
                Total ({daysWorked} jour{daysWorked > 1 ? 's' : ''})
              </span>
              <span style={S.th} />
              <span style={S.th} />
              <span style={{ ...S.th, color: '#FFF' }}>
                {formatTime(totalWorked)}
              </span>
              <span style={{
                ...S.th,
                textAlign: 'right',
                color: totalOvertime > 0 ? '#F59E0B' : '#666',
                fontWeight: '700',
              }}>
                {totalOvertime > 0 ? `+${formatTime(totalOvertime)}` : '—'}
              </span>
            </div>
          </div>
        )}

        <div style={S.infoNote}>
          <Clock size={12} color="#555" />
          <span>Heures affichées en UTC • Cohérent avec le système de pointage</span>
        </div>
      </div>
    </EmployeeLayout>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  title: {
    color: '#FFF',
    fontSize: 'clamp(20px, 4vw, 24px)',
    fontWeight: '700',
    margin: 0,
  },
  subtitle: {
    color: '#666',
    fontSize: '14px',
    margin: '4px 0 0 0',
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    padding: '16px',
    background: 'rgba(20, 20, 35, 0.7)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  monthBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '8px',
    color: '#FFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  monthLabel: {
    color: '#FFF',
    fontSize: '16px',
    fontWeight: '600',
    textTransform: 'capitalize',
    minWidth: '180px',
    textAlign: 'center',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '18px',
    background: 'rgba(20, 20, 35, 0.7)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  summaryIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryValue: {
    display: 'block',
    fontSize: '20px',
    fontWeight: '700',
    lineHeight: '1',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },
  summaryLabel: {
    display: 'block',
    color: '#666',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '4px',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#F59E0B',
    borderRadius: '50%',
    animation: 'spinSlow 0.8s linear infinite',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    background: 'rgba(20, 20, 35, 0.5)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
  },
  tableWrap: {
    background: 'rgba(20, 20, 35, 0.7)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  th: {
    flex: 1,
    color: '#666',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    transition: 'all 0.2s ease',
  },
  td: {
    flex: 1,
    fontSize: '13px',
  },
  dayName: {
    color: '#888',
    fontSize: '11px',
    textTransform: 'capitalize',
    minWidth: '28px',
  },
  dayDate: {
    color: '#FFF',
    fontSize: '13px',
    fontWeight: '600',
  },
  weekendBadge: {
    background: 'rgba(255,255,255,0.06)',
    color: '#555',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: '700',
  },
  overtimeBadge: {
    display: 'inline-block',
    background: 'rgba(245,158,11,0.12)',
    color: '#F59E0B',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 18px',
    background: 'rgba(255,255,255,0.03)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderLeft: '3px solid transparent',
  },
  infoNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#555',
    fontSize: '11px',
    paddingTop: '4px',
  },
}