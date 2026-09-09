// ═══════════════════════════════════════════════════════════
// ⏱️ PAGE HEURES SUPPLÉMENTAIRES - AFROFUTURISTE
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import FeatureService, { FEATURES } from '../services/featureService'
import HolidayService from '../services/holidayService'
import {
  Timer,
  Calendar,
  Building2,
  Download,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Settings,
  Save,
  X,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  Lock,
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formaterHeureLocale,
  calculerDureeSecondes,
  formaterDureeComplete
} from '../utils/timezoneUtils'

export default function HeuresSupplementaires() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')

  // Période
  const [viewMode, setViewMode] = useState('daily') // daily, weekly, monthly
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Feature & Settings
  const [hasAccess, setHasAccess] = useState(false)
  const [overtimeSettings, setOvertimeSettings] = useState(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsForm, setSettingsForm] = useState({})
  const [savingSettings, setSavingSettings] = useState(false)

  // Data
  const [overtimeData, setOvertimeData] = useState([])

  const [holidayMap, setHolidayMap] = useState(new Map())

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
      loadEntreprises(parsedAdmin)
    } else {
      const activeId = parsedAdmin.selectedEnterprise?.id || parsedAdmin.enterprise_id
      setSelectedEntrepriseId(activeId)
    }
  }, [navigate])

  // Check access & load settings
  useEffect(() => {
    const checkAccess = async () => {
      if (!admin) return

      const enterpriseId = admin.role === 'super_admin'
        ? selectedEntrepriseId
        : (admin.selectedEnterprise?.id || admin.enterprise_id)

      if (!enterpriseId || enterpriseId === 'all') {
        setHasAccess(admin.role === 'super_admin')
        return
      }

      const access = await FeatureService.hasFeature(enterpriseId, FEATURES.HEURES_SUPPLEMENTAIRES)
      setHasAccess(access)

      if (access) {
        const settings = await FeatureService.getOvertimeSettings(enterpriseId)
        setOvertimeSettings(settings)
        setSettingsForm(settings || {})
      }
    }

    checkAccess()
  }, [admin, selectedEntrepriseId])

  // Load overtime data
  useEffect(() => {
    if (admin && hasAccess) {
      loadOvertimeData()
    }
  }, [admin, selectedDate, selectedEntrepriseId, hasAccess, overtimeSettings])

  const loadEntreprises = async (adminData) => {
    if (adminData.role === 'super_admin') {
      const { data } = await supabase
        .from('enterprises')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setEntreprises(data || [])
    }
  }

const loadOvertimeData = async () => {
    setLoading(true)
    try {
      let targetEnterpriseId = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        targetEnterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id
      }

      let employeesQuery = supabase
        .from('employees')
        .select('*, enterprises(name)')
        .eq('is_active', true)

      if (targetEnterpriseId !== 'all') {
        employeesQuery = employeesQuery.eq('enterprise_id', targetEnterpriseId)
      }

      const { data: employees } = await employeesQuery

      const startOfDay = new Date(`${selectedDate}T00:00:00`)
      const endOfNextDay = new Date(startOfDay)
      endOfNextDay.setDate(endOfNextDay.getDate() + 1)
      endOfNextDay.setHours(14, 0, 0, 0)

      let attendancesQuery = supabase
        .from('attendances')
        .select('*')
        .gte('check_time', startOfDay.toISOString())
        .lte('check_time', endOfNextDay.toISOString())
        .order('check_time', { ascending: true })

      if (targetEnterpriseId !== 'all') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', targetEnterpriseId)
      }

      const { data: attendances } = await attendancesQuery

      const enterpriseIds = targetEnterpriseId !== 'all'
        ? [targetEnterpriseId]
        : [...new Set(employees?.map(e => e.enterprise_id).filter(Boolean) || [])]

      const allSchedules = await FeatureService.loadSchedules(enterpriseIds)

      // ── Charger les jours fériés ──
      const loadedHolidayMap = new Map()
      await Promise.all(
        enterpriseIds.map(async (entId) => {
          const holiday = await HolidayService.isHoliday(entId, selectedDate)
          if (holiday) loadedHolidayMap.set(entId, holiday)
        })
      )
      setHolidayMap(loadedHolidayMap)

      // ══════════════════════════════════════════════════════════
      // ✅ NOUVEAU : Charger les plannings employés en une requête
      // ══════════════════════════════════════════════════════════
      const employeeIds = employees?.map(e => e.id) || []

      const { data: allEmployeeSchedules } = await supabase
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .in('employee_id', employeeIds)
        .eq('is_active', true)

      const employeeScheduleMap = new Map()
      ;(allEmployeeSchedules || []).forEach(es => {
        employeeScheduleMap.set(es.employee_id, es)
      })

      // ══════════════════════════════════════════════════════════

      const results = employees?.map(employee => {
        const empAttendances = attendances?.filter(
          a => a.employee_id === employee.id
        ) || []

        let totalSecondes = 0
        let currentIn = null
        let validPairs = []

        for (let i = 0; i < empAttendances.length; i++) {
          const att = empAttendances[i]
          const attDate = new Date(att.check_time)
          const pointageDateStr = att.check_time.split('T')[0]

          if (att.check_type === 'in') {
            let isValidIn = false

            if (pointageDateStr === selectedDate) {
              isValidIn = true
            } else {
              if (validPairs.length > 0) {
                const lastOutTime = new Date(validPairs[validPairs.length - 1].out.check_time)
                const diffHours = (attDate - lastOutTime) / (1000 * 60 * 60)
                if (diffHours < 8) {
                  isValidIn = true
                }
              }
            }

            if (isValidIn) {
              currentIn = att
            } else {
              currentIn = null
            }
          } else if (att.check_type === 'out' && currentIn) {
            const inDate = new Date(currentIn.check_time)
            const diffHours = (attDate - inDate) / (1000 * 60 * 60)

            if (diffHours <= 16) {
              totalSecondes += calculerDureeSecondes(
                currentIn.check_time,
                att.check_time
              )
              validPairs.push({ in: currentIn, out: att })
              currentIn = null
            }
          }
        }

        // ══════════════════════════════════════════════════════
        // ✅ APPEL UNIQUE AU MOTEUR CENTRAL
        // ══════════════════════════════════════════════════════
        const holiday = loadedHolidayMap.get(employee.enterprise_id) || null

        const overtime = FeatureService.calculateOvertimeForEmployeeDay({
          totalWorkedSeconds: totalSecondes,
          employeeSchedule: employeeScheduleMap.get(employee.id) || null,
          enterpriseId: employee.enterprise_id,
          dateStr: selectedDate,
          allSchedules,
          overtimeSettings,
          holiday,
        })

        return {
          employee,
          totalSecondes,
          overtime,
          schedule: overtime.appliedSchedule || null,
          attendanceCount: empAttendances.length,
          isHoliday: !!holiday,
          holidayName: holiday?.name || null,
        }
      })
        ?.filter(r => r.totalSecondes > 0)
        .sort((a, b) =>
          (b.overtime.totalOvertimeSeconds || 0) -
          (a.overtime.totalOvertimeSeconds || 0)
        ) || []

      setOvertimeData(results)

    } catch (error) {
      console.error('Erreur chargement heures sup:', error)
    }
    setLoading(false)
  }

  // Save settings
  const handleSaveSettings = async () => {
    const enterpriseId = admin.role === 'super_admin'
      ? selectedEntrepriseId
      : (admin.selectedEnterprise?.id || admin.enterprise_id)

    if (!enterpriseId || enterpriseId === 'all') {
      toast.error('Sélectionnez une entreprise')
      return
    }

    setSavingSettings(true)
    const success = await FeatureService.saveOvertimeSettings(enterpriseId, settingsForm)
    setSavingSettings(false)

    if (success) {
      toast.success('Paramètres sauvegardés')
      setOvertimeSettings(settingsForm)
      setShowSettingsModal(false)
      loadOvertimeData()
    } else {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // Stats
  const stats = {
    totalEmployees: overtimeData.length,
    withOvertime: overtimeData.filter(r => r.overtime.hasOvertime).length,
    totalOvertimeSeconds: overtimeData.reduce((sum, r) => sum + (r.overtime.totalOvertimeSeconds || 0), 0),
    totalWorkedSeconds: overtimeData.reduce((sum, r) => sum + r.totalSecondes, 0),
  }

  const changeDate = (days) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  const exportCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Temps travaillé', 'Seuil',
      'Heures Sup', 'H.Sup Majorées', 'Total H.Sup', 'Taux Normal', 'Taux Majoré']

    const rows = overtimeData.map(r => [
      r.employee.matricule,
      r.employee.last_name,
      r.employee.first_name,
      r.employee.position || '',
      formaterDureeComplete(r.totalSecondes),
      `${overtimeSettings?.daily_threshold || 8}h`,
      r.overtime.hasOvertime ? formaterDureeComplete(r.overtime.overtimeSeconds) : '0',
      r.overtime.overtimeMajorSeconds ? formaterDureeComplete(r.overtime.overtimeMajorSeconds) : '0',
      r.overtime.hasOvertime ? formaterDureeComplete(r.overtime.totalOvertimeSeconds) : '0',
      r.overtime.hasOvertime ? `${r.overtime.rateApplied}%` : '',
      r.overtime.overtimeMajorSeconds ? `${r.overtime.rateMajorApplied}%` : '',
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `heures_sup_${selectedDate}.csv`
    link.click()
  }

  // No access view
  if (!hasAccess && admin) {
    return (
      <div style={pageStyles.container}>
        <PageHeader title="HEURES SUPPLÉMENTAIRES" />
        <main style={pageStyles.main}>
          <div style={pageStyles.noAccess}>
            <div style={pageStyles.noAccessIcon}>
              <Lock size={48} color="#F59E0B" />
            </div>
            <h2 style={pageStyles.noAccessTitle}>Module non activé</h2>
            <p style={pageStyles.noAccessText}>
              La gestion des heures supplémentaires nécessite l'activation du module correspondant.
            </p>
            <button onClick={() => navigate('/pointages')} style={pageStyles.backButton}>
              <ArrowLeft size={16} /> Retour aux pointages
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .afro-ot-card { transition: all 0.3s ease !important; }
        .afro-ot-card:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; border-color: rgba(249, 115, 22, 0.3) !important; }
        .afro-stat-card:hover { transform: translateY(-4px) scale(1.02) !important; box-shadow: 0 16px 50px rgba(0,0,0,0.4) !important; }
        .afro-nav-btn:hover { background: rgba(249, 115, 22, 0.2) !important; color: #F97316 !important; }
        .afro-settings-btn:hover { background: rgba(249, 115, 22, 0.15) !important; }
        .afro-export-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 25px rgba(249, 115, 22, 0.4) !important; }
        @media (max-width: 768px) { .mobile-stack { flex-direction: column !important; } .mobile-full { width: 100% !important; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F97316; border-radius: 3px; }
      `}</style>

      <div style={pageStyles.container}>
        <div style={pageStyles.bgPattern}></div>
        <PageHeader title="HEURES SUPPLÉMENTAIRES" />

        <main style={pageStyles.main}>
          {/* Title */}
          <div style={pageStyles.titleSection}>
            <div style={pageStyles.titleLeft}>
              <button onClick={() => navigate('/pointages')} style={pageStyles.backBtn}>
                <ArrowLeft size={18} />
              </button>
              <div style={pageStyles.titleIcon}>
                <Timer size={24} color="#F97316" />
              </div>
              <div>
                <h2 style={pageStyles.pageTitle}>Heures Supplémentaires</h2>
                <p style={pageStyles.pageSubtitle}>{formatDate(selectedDate)}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {overtimeSettings && (
                <div style={pageStyles.thresholdBadge}>
                  <Info size={12} />
                  <span>Seuil: {overtimeSettings.daily_threshold || 8}h/jour</span>
                </div>
              )}

              {(() => {
                const entId = admin?.role !== 'super_admin'
                  ? (admin?.selectedEnterprise?.id || admin?.enterprise_id)
                  : selectedEntrepriseId

                const holiday = holidayMap.get(entId)
                if (!holiday) return null

                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    color: '#A78BFA',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}>
                    <span>🎌</span>
                    <span>{holiday.name}</span>
                  </div>
                )
              })()}

              {(admin?.role === 'super_admin' || admin?.role === 'admin') && (
                <button className="afro-settings-btn" onClick={() => setShowSettingsModal(true)} style={pageStyles.settingsBtn}>
                  <Settings size={16} />
                  <span>Paramètres</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div style={pageStyles.filtersContainer}>
            <div style={pageStyles.dateNavContainer}>
              <button className="afro-nav-btn" onClick={() => changeDate(-1)} style={pageStyles.dateNavBtn}>
                <ChevronLeft size={20} />
              </button>
              <div style={pageStyles.dateInputWrap}>
                <Calendar size={16} color="#F97316" />
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={pageStyles.dateInput} />
              </div>
              <button className="afro-nav-btn" onClick={() => changeDate(1)} style={pageStyles.dateNavBtn}>
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="mobile-stack" style={pageStyles.filterRow}>
              {admin?.role === 'super_admin' && (
                <div className="mobile-full" style={pageStyles.filterGroup}>
                  <Building2 size={16} color="#F97316" />
                  <select value={selectedEntrepriseId} onChange={(e) => setSelectedEntrepriseId(e.target.value)} style={pageStyles.filterSelect}>
                    <option value="all">Toutes les entreprises</option>
                    {entreprises.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button className="afro-export-btn mobile-full" onClick={exportCSV} style={pageStyles.exportBtn}>
                <Download size={16} />
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={pageStyles.statsGrid}>
            <div className="afro-stat-card" style={pageStyles.statCard}>
              <div style={{ ...pageStyles.statIconWrap, background: 'rgba(99, 102, 241, 0.15)' }}>
                <Users size={24} color="#6366F1" />
              </div>
              <div style={pageStyles.statContent}>
                <span style={pageStyles.statNumber}>{stats.totalEmployees}</span>
                <span style={pageStyles.statLabel}>Ont travaillé</span>
              </div>
            </div>

            <div className="afro-stat-card" style={pageStyles.statCard}>
              <div style={{ ...pageStyles.statIconWrap, background: 'rgba(249, 115, 22, 0.15)' }}>
                <Timer size={24} color="#F97316" />
              </div>
              <div style={pageStyles.statContent}>
                <span style={pageStyles.statNumber}>{stats.withOvertime}</span>
                <span style={pageStyles.statLabel}>Avec H. Sup</span>
              </div>
            </div>

            <div className="afro-stat-card" style={pageStyles.statCard}>
              <div style={{ ...pageStyles.statIconWrap, background: 'rgba(239, 68, 68, 0.15)' }}>
                <TrendingUp size={24} color="#EF4444" />
              </div>
              <div style={pageStyles.statContent}>
                <span style={pageStyles.statNumber}>
                  {FeatureService.formatOvertimeDisplay(stats.totalOvertimeSeconds) || '0h'}
                </span>
                <span style={pageStyles.statLabel}>Total H. Sup</span>
              </div>
            </div>

            <div className="afro-stat-card" style={pageStyles.statCard}>
              <div style={{ ...pageStyles.statIconWrap, background: 'rgba(16, 185, 129, 0.15)' }}>
                <Clock size={24} color="#10B981" />
              </div>
              <div style={pageStyles.statContent}>
                <span style={pageStyles.statNumber}>
                  {formaterDureeComplete(stats.totalWorkedSeconds)}
                </span>
                <span style={pageStyles.statLabel}>Total travaillé</span>
              </div>
            </div>
          </div>

          {/* List */}
          <div style={pageStyles.listHeader}>
            <div style={pageStyles.listHeaderLeft}>
              <div style={pageStyles.listHeaderIcon}>
                <Timer size={18} color="#F97316" />
              </div>
              <h3 style={pageStyles.listTitle}>
                Détail par employé
                <span style={pageStyles.listCount}>{overtimeData.length}</span>
              </h3>
            </div>
          </div>

          <div style={pageStyles.list}>
            {loading && !overtimeData.length ? (
              <div style={pageStyles.empty}>
                <div style={{ animation: 'float 2s ease-in-out infinite' }}>
                  <Timer size={48} color="#F97316" />
                </div>
                <p style={{ color: '#888', marginTop: '16px' }}>Chargement...</p>
              </div>
            ) : overtimeData.length === 0 ? (
              <div style={pageStyles.empty}>
                <div style={pageStyles.emptyIcon}>
                  <Timer size={48} color="#F97316" />
                </div>
                <p style={pageStyles.emptyTitle}>Aucun pointage ce jour</p>
                <p style={pageStyles.emptySubtitle}>Sélectionnez une autre date</p>
              </div>
            ) : (
              overtimeData.map((r, index) => (
                <div
                  key={r.employee.id}
                  className="afro-ot-card"
                  style={{
                    ...pageStyles.otCard,
                    animation: `fadeInUp 0.4s ease ${index * 0.05}s forwards`,
                    opacity: 0,
                    borderLeftColor: r.overtime.hasOvertime ? 'rgba(249, 115, 22, 0.5)' : 'rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <div style={pageStyles.otCardTop}>
                    <div style={pageStyles.otCardLeft}>
                      <div style={pageStyles.otAvatar}>
                        {r.employee.photo_url ? (
                          <img src={r.employee.photo_url} alt="" style={pageStyles.otAvatarImg} />
                        ) : (
                          <span style={pageStyles.otAvatarInitials}>
                            {r.employee.first_name?.[0]}{r.employee.last_name?.[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <span style={pageStyles.otName}>
                          {r.employee.first_name} {r.employee.last_name}
                        </span>
                        <span style={pageStyles.otMeta}>
                          {r.employee.matricule} • {r.employee.position || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div style={pageStyles.otCardRight}>
                      {r.overtime.hasOvertime ? (
                        <div style={pageStyles.otBadgeOvertime}>
                          <Timer size={12} />
                          {FeatureService.formatOvertimeDisplay(r.overtime.totalOvertimeSeconds)}
                        </div>
                      ) : (
                        <div style={pageStyles.otBadgeNormal}>
                          <CheckCircle2 size={12} />
                          Normal
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={pageStyles.otCardDetails}>
                    {r.isHoliday && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'rgba(139,92,246,0.08)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: '10px',
                      }}>
                        <span style={{ fontSize: '14px' }}>🎌</span>
                        <span style={{ color: '#A78BFA', fontSize: '12px', fontWeight: '600' }}>
                          {r.holidayName || 'Jour férié'}
                          {r.overtime.thresholdSource !== 'holiday' && ' — jour travaillé, taux majoré appliqué'}
                          {r.overtime.thresholdSource === 'holiday' && ' — tout le temps travaillé compte en H.Sup'}
                        </span>
                      </div>
                    )}

                    <div style={pageStyles.otDetailItem}>
                      <span style={pageStyles.otDetailLabel}>Travaillé</span>
                      <span style={pageStyles.otDetailValue}>
                        {formaterDureeComplete(r.totalSecondes)}
                      </span>
                    </div>
                    <div style={pageStyles.otDetailItem}>
                      <span style={pageStyles.otDetailLabel}>Seuil</span>
                      <span style={pageStyles.otDetailValue}>
                        {overtimeSettings?.daily_threshold || 8}h00
                      </span>
                    </div>
                    {r.overtime.hasOvertime && (
                      <>
                        <div style={pageStyles.otDetailItem}>
                          <span style={pageStyles.otDetailLabel}>H.Sup ({r.overtime.rateApplied}%)</span>
                          <span style={{ ...pageStyles.otDetailValue, color: '#F97316' }}>
                            {FeatureService.formatOvertimeDisplay(r.overtime.overtimeSeconds)}
                          </span>
                        </div>
                        {r.overtime.overtimeMajorSeconds > 0 && (
                          <div style={pageStyles.otDetailItem}>
                            <span style={pageStyles.otDetailLabel}>Majoré ({r.overtime.rateMajorApplied}%)</span>
                            <span style={{ ...pageStyles.otDetailValue, color: '#EF4444' }}>
                              {FeatureService.formatOvertimeDisplay(r.overtime.overtimeMajorSeconds)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {r.overtime.hasOvertime && (
                    <div style={pageStyles.otProgressBar}>
                      <div style={{
                        ...pageStyles.otProgressNormal,
                        width: `${Math.min(100, ((overtimeSettings?.daily_threshold || 8) * 3600 / r.totalSecondes) * 100)}%`
                      }}></div>
                      <div style={{
                        ...pageStyles.otProgressOvertime,
                        width: `${Math.min(100 - ((overtimeSettings?.daily_threshold || 8) * 3600 / r.totalSecondes) * 100, (r.overtime.overtimeSeconds / r.totalSecondes) * 100)}%`
                      }}></div>
                      {r.overtime.overtimeMajorSeconds > 0 && (
                        <div style={{
                          ...pageStyles.otProgressMajor,
                          width: `${(r.overtime.overtimeMajorSeconds / r.totalSecondes) * 100}%`
                        }}></div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>

        {/* ═══ SETTINGS MODAL ═══ */}
        {showSettingsModal && (
          <div style={pageStyles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
            <div style={pageStyles.settingsModal} onClick={(e) => e.stopPropagation()}>
              <div style={pageStyles.settingsHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Settings size={20} color="#F97316" />
                  </div>
                  <div>
                    <h2 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '700', margin: 0 }}>
                      Paramètres Heures Sup
                    </h2>
                    <span style={{ color: '#888', fontSize: '12px' }}>
                      Configuration des seuils et taux
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowSettingsModal(false)} style={pageStyles.closeSettingsBtn}>
                  <X size={20} />
                </button>
              </div>

              <div style={pageStyles.settingsBody}>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}>
                  <Info size={16} color="#6366F1" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p style={{ color: '#6366F1', fontSize: '13px', fontWeight: '700', margin: '0 0 4px 0' }}>
                      Le Planning définit le seuil de base
                    </p>
                    <p style={{ color: '#888', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                      Les heures contractuelles sont calculées automatiquement depuis le planning
                      (ex: 08h-17h avec 1h pause = 8h de seuil). Ces paramètres définissent
                      uniquement les <strong style={{ color: '#E5E5E5' }}>taux de majoration</strong> et
                      <strong style={{ color: '#E5E5E5' }}> l'écart déclenchant le taux majoré</strong>.
                    </p>
                  </div>
                </div>

                <div style={pageStyles.settingsSection}>
                  <h3 style={pageStyles.settingsSectionTitle}>
                    ⏱️ Déclenchement du taux majoré
                  </h3>
                  <div style={pageStyles.settingsField}>
                    <label style={pageStyles.settingsLabel}>
                      Après combien d'heures sup (heures)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="8"
                      value={settingsForm.overtime_major_after_hours || 2}
                      onChange={(e) => setSettingsForm({
                        ...settingsForm,
                        overtime_major_after_hours: parseFloat(e.target.value)
                      })}
                      style={pageStyles.settingsInput}
                    />
                    <span style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>
                      Ex: 2 → les 2 premières heures sup à taux normal,
                      le reste à taux majoré
                    </span>
                  </div>

                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(249, 115, 22, 0.05)',
                    border: '1px solid rgba(249, 115, 22, 0.12)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#888',
                    lineHeight: '1.8'
                  }}>
                    <p style={{ margin: 0, color: '#F97316', fontWeight: '700', marginBottom: '4px' }}>
                      Aperçu du calcul (planning 08h-17h, 1h pause)
                    </p>
                    <p style={{ margin: 0 }}>
                      0h → 8h = temps contractuel (pas de majoration)
                    </p>
                    <p style={{ margin: 0, color: '#F97316' }}>
                      8h → {(8 + (settingsForm.overtime_major_after_hours || 2))}h
                      = +{settingsForm.overtime_major_after_hours || 2}h
                      à {settingsForm.rate_normal || 25}% (taux normal)
                    </p>
                    <p style={{ margin: 0, color: '#EF4444' }}>
                      Au-delà de {(8 + (settingsForm.overtime_major_after_hours || 2))}h
                      = taux majoré {settingsForm.rate_major || 50}%
                    </p>
                  </div>
                </div>

                <div style={pageStyles.settingsSection}>
                  <h3 style={pageStyles.settingsSectionTitle}>💰 Taux de majoration</h3>
                  <div style={pageStyles.settingsRow}>
                    <div style={pageStyles.settingsField}>
                      <label style={pageStyles.settingsLabel}>Taux normal (%)</label>
                      <input
                        type="number"
                        value={settingsForm.rate_normal || 25}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          rate_normal: parseFloat(e.target.value)
                        })}
                        style={pageStyles.settingsInput}
                      />
                      <span style={{ color: '#555', fontSize: '10px' }}>
                        Premières heures sup
                      </span>
                    </div>
                    <div style={pageStyles.settingsField}>
                      <label style={pageStyles.settingsLabel}>Taux majoré (%)</label>
                      <input
                        type="number"
                        value={settingsForm.rate_major || 50}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          rate_major: parseFloat(e.target.value)
                        })}
                        style={pageStyles.settingsInput}
                      />
                      <span style={{ color: '#555', fontSize: '10px' }}>
                        Après {settingsForm.overtime_major_after_hours || 2}h sup
                      </span>
                    </div>
                  </div>
                  <div style={pageStyles.settingsRow}>
                    <div style={pageStyles.settingsField}>
                      <label style={pageStyles.settingsLabel}>Taux dimanche (%)</label>
                      <input
                        type="number"
                        value={settingsForm.rate_sunday || 100}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          rate_sunday: parseFloat(e.target.value)
                        })}
                        style={pageStyles.settingsInput}
                      />
                    </div>
                    <div style={pageStyles.settingsField}>
                      <label style={pageStyles.settingsLabel}>Taux jours fériés (%)</label>
                      <input
                        type="number"
                        value={settingsForm.rate_holiday || 100}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          rate_holiday: parseFloat(e.target.value)
                        })}
                        style={pageStyles.settingsInput}
                      />
                    </div>
                  </div>
                </div>

                <div style={pageStyles.settingsSection}>
                  <h3 style={pageStyles.settingsSectionTitle}>⚙️ Options</h3>
                  <label style={pageStyles.settingsToggle}>
                    <input
                      type="checkbox"
                      checked={settingsForm.include_weekends || false}
                      onChange={(e) => setSettingsForm({
                        ...settingsForm,
                        include_weekends: e.target.checked
                      })}
                    />
                    <span>Calculer les heures sup le weekend</span>
                  </label>
                </div>
              </div>

              <div style={pageStyles.settingsFooter}>
                <button onClick={() => setShowSettingsModal(false)} style={pageStyles.settingsCancelBtn}>
                  Annuler
                </button>
                <button onClick={handleSaveSettings} style={pageStyles.settingsSaveBtn} disabled={savingSettings}>
                  <Save size={16} />
                  {savingSettings ? 'Sauvegarde...' : 'Sauvegarder'}
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
const pageStyles = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at 15% 50%, rgba(249, 115, 22, 0.04) 0%, transparent 50%), radial-gradient(circle at 85% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)`, pointerEvents: 'none', zIndex: 0 },

  main: { padding: '20px', maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 },

  noAccess: { textAlign: 'center', padding: '100px 20px', maxWidth: '500px', margin: '0 auto' },
  noAccessIcon: { width: '90px', height: '90px', borderRadius: '24px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' },
  noAccessTitle: { color: '#FFFFFF', fontSize: '24px', fontWeight: '700', margin: '0 0 12px 0' },
  noAccessText: { color: '#888', fontSize: '15px', lineHeight: '1.6', margin: '0 0 32px 0' },
  backButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },

  titleSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  titleLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)', borderRadius: '10px', padding: '8px', color: '#F97316', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  titleIcon: { width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#FFFFFF', fontSize: 'clamp(18px, 3.5vw, 26px)', fontWeight: '600', margin: 0 },
  pageSubtitle: { color: '#888', fontSize: '13px', margin: '2px 0 0 0', textTransform: 'capitalize' },
  thresholdBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.18)', color: '#F97316', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  settingsBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.18)', borderRadius: '10px', padding: '8px 14px', color: '#F97316', cursor: 'pointer', transition: 'all 0.2s ease', fontSize: '13px', fontWeight: '600' },

  filtersContainer: { marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  dateNavContainer: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '6px' },
  dateNavBtn: { background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)', borderRadius: '10px', padding: '10px', color: '#F97316', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  dateInputWrap: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center', padding: '0 8px' },
  dateInput: { border: 'none', background: 'transparent', fontSize: '15px', color: '#FFFFFF', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', maxWidth: '140px' },
  filterRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', borderRadius: '12px', flex: '1 1 200px' },
  filterSelect: { border: 'none', background: 'transparent', fontSize: '14px', color: '#E5E5E5', cursor: 'pointer', outline: 'none', width: '100%', fontFamily: 'inherit' },
  exportBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFF', padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s ease', flex: '0 0 auto' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px', marginBottom: '32px' },
  statCard: { background: 'rgba(20, 20, 35, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '18px', padding: 'clamp(16px, 3vw, 24px)', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'default', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' },
  statIconWrap: { width: '50px', height: '50px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statContent: { display: 'flex', flexDirection: 'column', zIndex: 1 },
  statNumber: { fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: '700', color: '#FFFFFF', lineHeight: '1', marginBottom: '4px' },
  statLabel: { fontSize: '12px', color: '#888', fontWeight: '500' },

  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  listHeaderLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  listHeaderIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  listTitle: { color: '#FFFFFF', fontSize: '16px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' },
  listCount: { background: 'rgba(249, 115, 22, 0.15)', color: '#F97316', padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },

  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: { textAlign: 'center', padding: '60px 20px', background: 'rgba(20, 20, 35, 0.6)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' },
  emptyIcon: { width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(249, 115, 22, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' },
  emptyTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' },
  emptySubtitle: { color: '#666', fontSize: '14px', margin: 0 },

  otCard: { background: 'rgba(20, 20, 35, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid', padding: 'clamp(14px, 3vw, 20px)', display: 'flex', flexDirection: 'column', gap: '12px' },
  otCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  otCardLeft: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 },
  otAvatar: { width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  otAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  otAvatarInitials: { color: '#F97316', fontWeight: '700', fontSize: '14px' },
  otName: { display: 'block', color: '#FFFFFF', fontWeight: '600', fontSize: '14px' },
  otMeta: { display: 'block', color: '#666', fontSize: '12px', marginTop: '2px' },
  otCardRight: { flexShrink: 0 },
  otBadgeOvertime: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#F97316', padding: '5px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', fontFamily: "'SF Mono', 'Fira Code', monospace" },
  otBadgeNormal: { display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '5px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' },
  otCardDetails: { display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '10px 14px' },
  otDetailItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  otDetailLabel: { color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' },
  otDetailValue: { color: '#FFFFFF', fontSize: '14px', fontWeight: '700', fontFamily: "'SF Mono', 'Fira Code', monospace" },

  otProgressBar: { display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' },
  otProgressNormal: { background: '#10B981', height: '100%', transition: 'width 0.5s ease' },
  otProgressOvertime: { background: '#F97316', height: '100%', transition: 'width 0.5s ease' },
  otProgressMajor: { background: '#EF4444', height: '100%', transition: 'width 0.5s ease' },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 },
  settingsModal: { background: '#0F0F19', border: '1px solid rgba(249, 115, 22, 0.15)', borderRadius: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' },
  settingsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  closeSettingsBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  settingsBody: { padding: '24px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' },
  settingsSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  settingsSectionTitle: { color: '#FFFFFF', fontSize: '14px', fontWeight: '700', margin: 0, letterSpacing: '0.5px' },
  settingsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  settingsField: { display: 'flex', flexDirection: 'column', gap: '4px' },
  settingsLabel: { color: '#888', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' },
  settingsInput: { padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#FFFFFF', fontSize: '15px', fontWeight: '600', fontFamily: "'SF Mono', 'Fira Code', monospace", outline: 'none', width: '100%', boxSizing: 'border-box' },
  settingsHint: { color: '#555', fontSize: '10px' },
  settingsToggle: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', color: '#E5E5E5', fontSize: '13px', cursor: 'pointer' },
  settingsFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  settingsCancelBtn: { padding: '12px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
  settingsSaveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
}