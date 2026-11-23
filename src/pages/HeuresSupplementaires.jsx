import {
  OvertimeNavigation,
  OvertimeLoadingScreen,
} from '../components/OvertimeExperience'
// ═══════════════════════════════════════════════════════════
// ⏱️ PAGE HEURES SUPPLÉMENTAIRES - AFROFUTURISTE
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import PageCulturalBand from '../components/PageCulturalBand'
import OvertimeDashboard, {
  OvertimeRulesDrawer,
} from '../components/OvertimeDashboard'
import {
  overtimePeriod,
  csvCell,
  loadOvertimeRows,
  overtimeWorkedSeconds,
} from '../utils/overtimePresentation'
import './HeuresSupplementaires.css'
import PageHeader from '../components/PageHeader'
import FeatureService, { FEATURES } from '../services/featureService'
import HolidayService from '../services/holidayService'
import { Settings, Save, X, Lock, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { formaterDureeComplete } from '../utils/timezoneUtils'

export default function HeuresSupplementaires() {
  const { darkMode, toggleTheme } = useTheme()
  const requestId = useRef(0)
  const [loadError, setLoadError] = useState('')
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')

  // Période
  const [viewMode, setViewMode] = useState('daily') // daily, weekly, monthly
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  )

  // Feature & Settings
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [overtimeSettings, setOvertimeSettings] = useState(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsForm, setSettingsForm] = useState({})
  const [savingSettings, setSavingSettings] = useState(false)

  // Data
  const [overtimeData, setOvertimeData] = useState([])

  const dates = overtimePeriod(selectedDate, viewMode)

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
      const activeId =
        parsedAdmin.selectedEnterprise?.id || parsedAdmin.enterprise_id
      setSelectedEntrepriseId(activeId)
    }
  }, [navigate])

  // Ignore late permission/settings responses after an enterprise switch.
  useEffect(() => {
    let active = true
    setAccessChecked(false)
    setHasAccess(false)
    setOvertimeSettings(null)
    setSettingsForm({})
    const checkAccess = async () => {
      if (!admin) return
      const enterpriseId =
        admin.role === 'super_admin'
          ? selectedEntrepriseId
          : admin.selectedEnterprise?.id || admin.enterprise_id
      try {
        const access =
          enterpriseId === 'all'
            ? admin.role === 'super_admin'
            : !!enterpriseId &&
              (await FeatureService.hasFeature(
                enterpriseId,
                FEATURES.HEURES_SUPPLEMENTAIRES,
              ))
        const settings =
          access && enterpriseId !== 'all'
            ? await FeatureService.getOvertimeSettings(enterpriseId)
            : null
        if (!active) return
        setOvertimeSettings(settings)
        setSettingsForm(settings || {})
        setHasAccess(access)
      } catch {
        if (active) setHasAccess(false)
      } finally {
        if (active) setAccessChecked(true)
      }
    }
    checkAccess()
    return () => {
      active = false
      requestId.current++
    }
  }, [admin, selectedEntrepriseId])

  useEffect(() => {
    if (admin && hasAccess && accessChecked) loadOvertimeData()
    return () => {
      requestId.current++
    }
  }, [
    admin,
    selectedDate,
    selectedEntrepriseId,
    hasAccess,
    accessChecked,
    overtimeSettings,
    viewMode,
  ])

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
    const request = ++requestId.current
    setLoading(true)
    setLoadError('')
    setOvertimeData([])
    try {
      let targetEnterpriseId = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        targetEnterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id
      }

      let employeesQuery = supabase
        .from('employees')
        .select('*, enterprises(name)')
        .eq('is_active', true)
        .order('id')

      if (targetEnterpriseId !== 'all') {
        employeesQuery = employeesQuery.eq('enterprise_id', targetEnterpriseId)
      }

      const employees = await loadOvertimeRows(employeesQuery)

      const startOfDay = new Date(`${dates[0]}T00:00:00Z`)
      const endOfNextDay = new Date(`${dates.at(-1)}T00:00:00Z`)
      endOfNextDay.setUTCDate(endOfNextDay.getUTCDate() + 1)
      endOfNextDay.setUTCHours(16, 0, 0, 0)

      let attendancesQuery = supabase
        .from('attendances')
        .select('*')
        .gte('check_time', startOfDay.toISOString())
        .lte('check_time', endOfNextDay.toISOString())
        .order('check_time', { ascending: true })
        .order('id')

      if (targetEnterpriseId !== 'all') {
        attendancesQuery = attendancesQuery.eq(
          'enterprise_id',
          targetEnterpriseId,
        )
      }

      const attendances = await loadOvertimeRows(attendancesQuery)

      const enterpriseIds =
        targetEnterpriseId !== 'all'
          ? [targetEnterpriseId]
          : [
              ...new Set(
                employees?.map((e) => e.enterprise_id).filter(Boolean) || [],
              ),
            ]

      const allSchedules = await FeatureService.loadSchedules(enterpriseIds)

      // Resolve settings per company; never apply one company's rates to another.
      const settingsByEnterprise = new Map()
      const loadedHolidayMap = new Map()
      await Promise.all(
        enterpriseIds.map(async (entId) => {
          settingsByEnterprise.set(
            entId,
            targetEnterpriseId !== 'all'
              ? overtimeSettings
              : await FeatureService.getOvertimeSettings(entId),
          )
          // Sequential dates bound provider concurrency to the number of enterprises.
          for (const date of dates) {
            const holiday = await HolidayService.isHoliday(entId, date)
            if (holiday) loadedHolidayMap.set(`${entId}:${date}`, holiday)
          }
        }),
      )

      // ══════════════════════════════════════════════════════════
      // ✅ NOUVEAU : Charger les plannings employés en une requête
      // ══════════════════════════════════════════════════════════
      const employeeIds = employees?.map((e) => e.id) || []

      const allEmployeeSchedules = employeeIds.length
        ? await loadOvertimeRows(
            supabase
              .from('employee_schedules')
              .select('*, work_schedules(*)')
              .in('employee_id', employeeIds)
              .eq('is_active', true)
              .order('id'),
          )
        : []

      const employeeScheduleMap = new Map()
      ;(allEmployeeSchedules || []).forEach((es) => {
        employeeScheduleMap.set(es.employee_id, es)
      })

      // ══════════════════════════════════════════════════════════

      const results =
        dates
          .flatMap((dateStr) =>
            (employees || []).map((employee) => {
              const empAttendances =
                attendances?.filter((a) => a.employee_id === employee.id) || []

              const totalSecondes = overtimeWorkedSeconds(
                empAttendances,
                dateStr,
              )

              // ══════════════════════════════════════════════════════
              // ✅ APPEL UNIQUE AU MOTEUR CENTRAL
              // ══════════════════════════════════════════════════════
              const holiday =
                loadedHolidayMap.get(`${employee.enterprise_id}:${dateStr}`) ||
                null

              const overtime = FeatureService.calculateOvertimeForEmployeeDay({
                totalWorkedSeconds: totalSecondes,
                employeeSchedule: employeeScheduleMap.get(employee.id) || null,
                enterpriseId: employee.enterprise_id,
                dateStr,
                allSchedules,
                overtimeSettings: settingsByEnterprise.get(
                  employee.enterprise_id,
                ),
                holiday,
              })

              return {
                employee,
                dateStr,
                totalSecondes,
                overtime,
                schedule: overtime.appliedSchedule || null,
                attendanceCount: empAttendances.length,
                isHoliday: !!holiday,
                holidayName: holiday?.name || null,
              }
            }),
          )
          .filter((r) => r.totalSecondes > 0)
          .sort(
            (a, b) =>
              (b.overtime.totalOvertimeSeconds || 0) -
              (a.overtime.totalOvertimeSeconds || 0),
          ) || []

      if (request === requestId.current) setOvertimeData(results)
    } catch (error) {
      console.error('Erreur chargement heures sup:', error)
      if (request === requestId.current)
        setLoadError(
          'Impossible de charger les pointages. Réessayez pour obtenir des résultats fiables.',
        )
    }
    if (request === requestId.current) setLoading(false)
  }

  // Save settings
  const handleSaveSettings = async () => {
    const enterpriseId =
      admin.role === 'super_admin'
        ? selectedEntrepriseId
        : admin.selectedEnterprise?.id || admin.enterprise_id

    if (!enterpriseId || enterpriseId === 'all') {
      toast.error('Sélectionnez une entreprise')
      return
    }

    const fields = [
      ['overtime_major_after_hours', 0.5, 8],
      ['rate_normal', 0.01, Infinity],
      ['rate_major', 0.01, Infinity],
      ['rate_sunday', 0.01, Infinity],
      ['rate_holiday', 0.01, Infinity],
    ]
    if (
      fields.some(
        ([key, min, max]) =>
          settingsForm[key] != null &&
          (settingsForm[key] === '' ||
            !Number.isFinite(settingsForm[key]) ||
            settingsForm[key] < min ||
            settingsForm[key] > max),
      )
    ) {
      toast.error(
        'Vérifiez les valeurs : taux strictement positifs et palier entre 0,5 et 8 heures.',
      )
      return
    }
    if (savingSettings) return
    setSavingSettings(true)
    try {
      const success = await FeatureService.saveOvertimeSettings(
        enterpriseId,
        settingsForm,
      )
      if (!success) throw new Error('save failed')
      toast.success('Paramètres sauvegardés')
      setOvertimeSettings({ ...settingsForm })
      setShowSettingsModal(false)
    } catch {
      toast.error(
        'Erreur lors de la sauvegarde. Vos modifications sont conservées.',
      )
    } finally {
      setSavingSettings(false)
    }
  }

  const exportCSV = () => {
    const headers = [
      'Date',
      'Matricule',
      'Nom',
      'Prénom',
      'Poste',
      'Temps travaillé',
      'Seuil',
      'Heures Sup',
      'H.Sup Majorées',
      'Total H.Sup',
      'Taux Normal',
      'Taux Majoré',
    ]

    const rows = overtimeData.map((r) => [
      r.dateStr,
      r.employee.matricule,
      r.employee.last_name,
      r.employee.first_name,
      r.employee.position || '',
      formaterDureeComplete(r.totalSecondes),
      formaterDureeComplete(r.overtime.contractualSeconds || 0),
      r.overtime.hasOvertime
        ? formaterDureeComplete(r.overtime.overtimeSeconds)
        : '0',
      r.overtime.overtimeMajorSeconds
        ? formaterDureeComplete(r.overtime.overtimeMajorSeconds)
        : '0',
      r.overtime.hasOvertime
        ? formaterDureeComplete(r.overtime.totalOvertimeSeconds)
        : '0',
      r.overtime.hasOvertime ? `${r.overtime.rateApplied}%` : '',
      r.overtime.overtimeMajorSeconds ? `${r.overtime.rateMajorApplied}%` : '',
    ])

    const csvContent = [
      headers.map(csvCell).join(','),
      ...rows.map((r) => r.map(csvCell).join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `heures_sup_${dates[0]}_${dates.at(-1)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  return (
    <div className={`ot-page ${darkMode ? 'ot-dark' : ''}`}>
      <PageHeader title="Heures supplémentaires" />
      <PageCulturalBand pathname="/heures-supplementaires" />
      <OvertimeNavigation darkMode={darkMode} onToggleTheme={toggleTheme} />
      <main className="ot-main">
        {!accessChecked ? (
          <OvertimeLoadingScreen checkingAccess />
        ) : !hasAccess ? (
          <section className="ot-state">
            <Lock size={36} />
            <h1>
              {accessChecked ? 'Module non activé' : 'Vérification de l’accès…'}
            </h1>
            <p>
              La gestion des heures supplémentaires nécessite l’activation du
              module correspondant.
            </p>
            <button onClick={() => navigate('/pointages')}>
              Retour aux pointages
            </button>
          </section>
        ) : (
          <OvertimeDashboard
            rows={overtimeData}
            dates={dates}
            mode={viewMode}
            setMode={setViewMode}
            selectedDate={selectedDate}
            setDate={setSelectedDate}
            loading={loading}
            error={loadError}
            retry={loadOvertimeData}
            enterprises={entreprises}
            enterpriseId={selectedEntrepriseId}
            setEnterprise={(id) => {
              requestId.current++
              setOvertimeData([])
              setLoading(true)
              setSelectedEntrepriseId(id)
              setShowSettingsModal(false)
            }}
            isSuperAdmin={admin?.role === 'super_admin'}
            canEdit={admin?.role === 'super_admin' || admin?.role === 'admin'}
            onSettings={() => setShowSettingsModal(true)}
            onExport={exportCSV}
          />
        )}
      </main>
      <PageCulturalBand pathname="/heures-supplementaires" placement="bottom" />
      {showSettingsModal && (
        <OvertimeRulesDrawer
          darkMode={darkMode}
          busy={savingSettings}
          onClose={() => setShowSettingsModal(false)}
        >
          <div className="ot-rules-header" style={pageStyles.settingsHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(249, 115, 22, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings size={20} color="#F97316" />
              </div>
              <div>
                <h2
                  style={{
                    color: 'var(--ot-text)',
                    fontSize: '18px',
                    fontWeight: '700',
                    margin: 0,
                  }}
                >
                  Règles de calcul
                </h2>
                <span style={{ color: 'var(--ot-muted)', fontSize: '12px' }}>
                  Configuration des seuils et taux
                </span>
              </div>
            </div>
            <button
              aria-label="Fermer les règles"
              disabled={savingSettings}
              onClick={() => setShowSettingsModal(false)}
              style={pageStyles.closeSettingsBtn}
            >
              <X aria-label="Fermer les règles" size={20} />
            </button>
          </div>

          <div className="ot-rules-body" style={pageStyles.settingsBody}>
            <details>
              <summary>Comment les seuils sont-ils définis ?</summary>
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <Info
                  size={16}
                  color="#6366F1"
                  style={{ flexShrink: 0, marginTop: '1px' }}
                />
                <div>
                  <p
                    style={{
                      color: 'var(--ot-indigo)',
                      fontSize: '13px',
                      fontWeight: '700',
                      margin: '0 0 4px 0',
                    }}
                  >
                    Le Planning définit le seuil de base
                  </p>
                  <p
                    style={{
                      color: 'var(--ot-muted)',
                      fontSize: '12px',
                      margin: 0,
                      lineHeight: '1.5',
                    }}
                  >
                    Les heures contractuelles sont calculées automatiquement
                    depuis le planning (ex: 08h-17h avec 1h pause = 8h de
                    seuil). Ces paramètres définissent uniquement les{' '}
                    <strong style={{ color: 'var(--ot-text)' }}>
                      taux de majoration
                    </strong>{' '}
                    et
                    <strong style={{ color: 'var(--ot-text)' }}>
                      {' '}
                      l'écart déclenchant le taux majoré
                    </strong>
                    .
                  </p>
                </div>
              </div>
            </details>
            <div
              className="ot-rules-section"
              style={pageStyles.settingsSection}
            >
              <h3 style={pageStyles.settingsSectionTitle}>Déclenchement</h3>
              <div style={pageStyles.settingsField}>
                <label
                  htmlFor="ot-overtime_major_after_hours"
                  style={pageStyles.settingsLabel}
                >
                  Après combien d'heures sup (heures)
                </label>
                <input
                  id="ot-overtime_major_after_hours"
                  disabled={savingSettings}
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={settingsForm.overtime_major_after_hours ?? 2}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      overtime_major_after_hours:
                        e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  style={pageStyles.settingsInput}
                />
                <span
                  style={{
                    color: 'var(--ot-muted)',
                    fontSize: '11px',
                    marginTop: '4px',
                  }}
                >
                  Ex: 2 → les 2 premières heures sup à taux normal, le reste à
                  taux majoré
                </span>
              </div>

              <details>
                <summary>Exemple de répartition par palier</summary>
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(249, 115, 22, 0.05)',
                    border: '1px solid rgba(249, 115, 22, 0.12)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: 'var(--ot-muted)',
                    lineHeight: '1.8',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--ot-copper)',
                      fontWeight: '700',
                      marginBottom: '4px',
                    }}
                  >
                    Aperçu du calcul (planning 08h-17h, 1h pause)
                  </p>
                  <p style={{ margin: 0 }}>
                    0h → 8h = temps contractuel (pas de majoration)
                  </p>
                  <p style={{ margin: 0, color: 'var(--ot-copper)' }}>
                    8h → {8 + (settingsForm.overtime_major_after_hours ?? 2)}h =
                    +{settingsForm.overtime_major_after_hours ?? 2}h à{' '}
                    {settingsForm.rate_normal ?? 25}% (taux normal)
                  </p>
                  <p style={{ margin: 0, color: 'var(--ot-copper)' }}>
                    Au-delà de{' '}
                    {8 + (settingsForm.overtime_major_after_hours ?? 2)}h = taux
                    majoré {settingsForm.rate_major ?? 50}%
                  </p>
                </div>
              </details>
            </div>

            <div
              className="ot-rules-section"
              style={pageStyles.settingsSection}
            >
              <h3 style={pageStyles.settingsSectionTitle}>Majorations</h3>
              <div style={pageStyles.settingsRow}>
                <div style={pageStyles.settingsField}>
                  <label
                    htmlFor="ot-rate_normal"
                    style={pageStyles.settingsLabel}
                  >
                    Taux normal (%)
                  </label>
                  <input
                    id="ot-rate_normal"
                    min="0.01"
                    step="0.01"
                    disabled={savingSettings}
                    type="number"
                    value={settingsForm.rate_normal ?? 25}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        rate_normal:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    style={pageStyles.settingsInput}
                  />
                  <span style={{ color: 'var(--ot-muted)', fontSize: '10px' }}>
                    Premières heures sup
                  </span>
                </div>
                <div style={pageStyles.settingsField}>
                  <label
                    htmlFor="ot-rate_major"
                    style={pageStyles.settingsLabel}
                  >
                    Taux majoré (%)
                  </label>
                  <input
                    id="ot-rate_major"
                    min="0.01"
                    step="0.01"
                    disabled={savingSettings}
                    type="number"
                    value={settingsForm.rate_major ?? 50}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        rate_major:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    style={pageStyles.settingsInput}
                  />
                  <span style={{ color: 'var(--ot-muted)', fontSize: '10px' }}>
                    Après {settingsForm.overtime_major_after_hours ?? 2}h sup
                  </span>
                </div>
              </div>
            </div>

            <div
              className="ot-rules-section"
              style={pageStyles.settingsSection}
            >
              <h3 style={pageStyles.settingsSectionTitle}>
                Jours particuliers
              </h3>
              <div style={pageStyles.settingsRow}>
                <div style={pageStyles.settingsField}>
                  <label
                    htmlFor="ot-rate_sunday"
                    style={pageStyles.settingsLabel}
                  >
                    Taux dimanche (%)
                  </label>
                  <input
                    id="ot-rate_sunday"
                    min="0.01"
                    step="0.01"
                    disabled={savingSettings}
                    type="number"
                    value={settingsForm.rate_sunday ?? 100}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        rate_sunday:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    style={pageStyles.settingsInput}
                  />
                </div>
                <div style={pageStyles.settingsField}>
                  <label
                    htmlFor="ot-rate_holiday"
                    style={pageStyles.settingsLabel}
                  >
                    Taux jours fériés (%)
                  </label>
                  <input
                    id="ot-rate_holiday"
                    min="0.01"
                    step="0.01"
                    disabled={savingSettings}
                    type="number"
                    value={settingsForm.rate_holiday ?? 100}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        rate_holiday:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    style={pageStyles.settingsInput}
                  />
                </div>
              </div>
              <label style={pageStyles.settingsToggle}>
                <input
                  disabled={savingSettings}
                  type="checkbox"
                  checked={settingsForm.include_weekends || false}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      include_weekends: e.target.checked,
                    })
                  }
                />
                <span>Calculer les heures sup le weekend</span>
              </label>
            </div>
          </div>

          <div className="ot-rules-footer" style={pageStyles.settingsFooter}>
            <button
              disabled={savingSettings}
              onClick={() => setShowSettingsModal(false)}
              style={pageStyles.settingsCancelBtn}
            >
              Annuler
            </button>
            <button
              onClick={handleSaveSettings}
              style={pageStyles.settingsSaveBtn}
              disabled={savingSettings}
            >
              <Save size={16} />
              {savingSettings ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </OvertimeRulesDrawer>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const pageStyles = {
  settingsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  closeSettingsBtn: {
    background: 'var(--ot-border)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '8px',
    color: 'var(--ot-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBody: {
    padding: '24px',
    overflow: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  settingsSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  settingsSectionTitle: {
    color: 'var(--ot-text)',
    fontSize: '14px',
    fontWeight: '700',
    margin: 0,
    letterSpacing: '0.5px',
  },
  settingsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  settingsField: { display: 'flex', flexDirection: 'column', gap: '4px' },
  settingsLabel: {
    color: 'var(--ot-muted)',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  settingsInput: {
    padding: '10px 12px',
    border: '1px solid var(--ot-border)',
    borderRadius: '10px',
    background: 'var(--ot-surface)',
    color: 'var(--ot-text)',
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    width: '100%',
    boxSizing: 'border-box',
  },
  settingsToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'var(--ot-surface)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.05)',
    color: 'var(--ot-text)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  settingsFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  settingsCancelBtn: {
    padding: '12px 20px',
    background: 'var(--ot-border)',
    border: '1px solid var(--ot-border)',
    color: 'var(--ot-text)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
  },
  settingsSaveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #F97316, #EA580C)',
    color: '#FFF',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
  },
}
