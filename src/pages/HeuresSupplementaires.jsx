import { OvertimeLoadingScreen } from '../components/OvertimeExperience'
// ═══════════════════════════════════════════════════════════
// ⏱️ PAGE HEURES SUPPLÉMENTAIRES - AFROFUTURISTE
// ═══════════════════════════════════════════════════════════
import { useMemo, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
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
import { ETIQUETTE_INDISPONIBLE } from '../lib/controleDisponible'

export default function HeuresSupplementaires() {
  /*  LE THÈME N'EST PLUS UNE AFFAIRE DE CETTE PAGE (26/12 : « enlever les
      raccourcis, le bouton sombre/clair »). `darkMode` ne sert plus à habiller :
      les jetons de la maison s'inversent à la racine (`[data-theme='dark']`,
      tokens.css), donc la page lit le thème GLOBAL et n'a plus de classe
      `.ot-dark` à entretenir à côté — deux thèmes l'un sur l'autre, c'est celui
      qui gagne par accident. */
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
  //  D'où vient le seuil ? `provenance.origine` ∈ entreprise | defaut_produit |
  //  historique_incertain | inconnue. G7 : l'écran doit le dire, pas le deviner.
  const [provenance, setProvenance] = useState(null)

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
    setProvenance(null)
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
        //  ⚠️ `AvecOrigine` et pas `getOvertimeSettings` : la seconde fusionne
        //  les défauts avec la ligne en base et perd le fait qu'un seuil ait
        //  été CHOISI. C'est exactement le mensonge de libellé corrigé ici.
        const complet =
          access && enterpriseId !== 'all'
            ? await FeatureService.getOvertimeSettingsAvecOrigine(enterpriseId)
            : null
        if (!active) return
        setOvertimeSettings(complet?.settings || null)
        setProvenance(complet?.provenance || null)
        setSettingsForm(complet?.settings || {})
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
    //  Une case cochée sans seuil valide produirait une alerte fantôme : on
    //  refuse la sauvegarde plutôt que d'enregistrer un réglage inopérant.
    if (settingsForm.alerte_hebdo_activee === true) {
      const seuil = Number(settingsForm.weekly_threshold)
      if (!Number.isFinite(seuil) || seuil <= 0 || seuil > 168) {
        toast.error(
          'Indiquez un seuil hebdomadaire entre 1 et 168 heures pour activer l’alerte.',
        )
        return
      }
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

  //  ⚠️ G7 / V-B3 : l'écran affiche des heures et un seuil. S'il ne peut pas
  //  évaluer le contrôle hebdomadaire, il le DIT — un tableau plein de chiffres
  //  muet sur le contrôle se lit comme une conformité constatée.
  //
  //  On ne réutilise pas `pourquoiControleIndisponible` tel quel : ici, le
  //  moteur de paie n'est pas passé, c'est le RÉGLAGE qui parle. On construit
  //  donc le même objet, avec le même vocabulaire, à partir de l'origine lue.
  const etatControle = useMemo(() => {
    if (!hasAccess) return null
    const seuil = Number(settingsForm.weekly_threshold)
    const seuilChoisi = Number.isFinite(seuil) && seuil > 0

    if (!seuilChoisi) {
      return {
        etiquette: ETIQUETTE_INDISPONIBLE,
        raison: 'Aucun seuil hebdomadaire choisi : le dépassement n’est pas mesuré.',
      }
    }
    if (settingsForm.alerte_hebdo_activee !== true) {
      return {
        etiquette: ETIQUETTE_INDISPONIBLE,
        raison: 'L’alerte n’est pas activée : aucun dépassement n’est signalé.',
      }
    }
    //  Origine incertaine : la valeur existe, mais personne ne peut prouver
    //  qu'elle a été CHOISIE. On le dit sans retirer l'alerte (la case est la
    //  preuve de l'acte, décision du 24/10/2026).
    if (provenance?.origine === 'historique_incertain') {
      return {
        etiquette: 'Origine à confirmer',
        raison: `Seuil de ${seuil} h identique à un défaut du produit : impossible de savoir s’il a été choisi.`,
      }
    }
    if (provenance?.origine === 'inconnue') {
      return {
        etiquette: 'Origine inconnue',
        raison: 'Le seuil enregistré n’a pas pu être relu : son origine n’est pas établie.',
      }
    }
    return null
  }, [hasAccess, settingsForm.weekly_threshold, settingsForm.alerte_hebdo_activee, provenance])

  return (
    <div className="ot-page">
      <PageHeader title="Heures supplémentaires" />
      <PageCulturalBand pathname="/heures-supplementaires" />
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
          <>
            {etatControle && (
              <p className="ot-controle-indisponible" role="status">
                <strong className="ot-controle-mot">{etatControle.etiquette}</strong>
                <span>{etatControle.raison}</span>
              </p>
            )}
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
          </>
        )}
      </main>
      <PageCulturalBand pathname="/heures-supplementaires" placement="bottom" />
      {showSettingsModal && (
        <OvertimeRulesDrawer
          busy={savingSettings}
          onClose={() => setShowSettingsModal(false)}
        >
          <div className="ot-rules-header">
            <div className="ot-rules-titre">
              <span className="ot-coin">
                <Settings size={20} aria-hidden="true" />
              </span>
              <div>
                <h2>Règles de calcul</h2>
                <span className="ot-aide">Configuration des seuils et taux</span>
              </div>
            </div>
            <button
              aria-label="Fermer les règles"
              disabled={savingSettings}
              onClick={() => setShowSettingsModal(false)}
              className="ot-pince"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="ot-rules-body">
            <details>
              <summary>Comment les seuils sont-ils définis ?</summary>
              <div className="ot-info">
                <Info size={16} className="ot-info-icone" aria-hidden="true" />
                <div>
                  <p className="ot-info-titre">Le Planning définit le seuil de base</p>
                  <p className="ot-info-texte">
                    Les heures contractuelles sont calculées automatiquement
                    depuis le planning (ex: 08h-17h avec 1h pause = 8h de
                    seuil). Ces paramètres définissent uniquement les{' '}
                    <strong>taux de majoration</strong> et{' '}
                    <strong>l'écart déclenchant le taux majoré</strong>.
                  </p>
                </div>
              </div>
            </details>
            <div className="ot-rules-section">
              <h3>Déclenchement</h3>
              <div className="ot-champ">
                <label className="ot-etiquette" htmlFor="ot-overtime_major_after_hours">
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
                  className="ot-champ-cadre"
                />
                <span className="ot-aide">
                  Ex: 2 → les 2 premières heures sup à taux normal, le reste à
                  taux majoré
                </span>
              </div>

              <details>
                <summary>Exemple de répartition par palier</summary>
                <div className="ot-palier">
                  <p className="ot-palier-titre">
                    Aperçu du calcul (planning 08h-17h, 1h pause)
                  </p>
                  <p>0h → 8h = temps contractuel (pas de majoration)</p>
                  <p className="ot-palier-nombre">
                    8h → {8 + (settingsForm.overtime_major_after_hours ?? 2)}h =
                    +{settingsForm.overtime_major_after_hours ?? 2}h à{' '}
                    {settingsForm.rate_normal ?? 25}% (taux normal)
                  </p>
                  <p className="ot-palier-nombre">
                    Au-delà de{' '}
                    {8 + (settingsForm.overtime_major_after_hours ?? 2)}h = taux
                    majoré {settingsForm.rate_major ?? 50}%
                  </p>
                </div>
              </details>
            </div>

            <div className="ot-rules-section">
              <h3>Majorations</h3>
              <div className="ot-rang">
                <div className="ot-champ">
                  <label className="ot-etiquette" htmlFor="ot-rate_normal">
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
                    className="ot-champ-cadre"
                  />
                  <span className="ot-aide">Premières heures sup</span>
                </div>
                <div className="ot-champ">
                  <label className="ot-etiquette" htmlFor="ot-rate_major">
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
                    className="ot-champ-cadre"
                  />
                  <span className="ot-aide">
                    Après {settingsForm.overtime_major_after_hours ?? 2}h sup
                  </span>
                </div>
              </div>
            </div>

            <div className="ot-rules-section">
              <h3>
                Jours particuliers
              </h3>
              <div className="ot-rang">
                <div className="ot-champ">
                  <label className="ot-etiquette" htmlFor="ot-rate_sunday">
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
                    className="ot-champ-cadre"
                  />
                </div>
                <div className="ot-champ">
                  <label className="ot-etiquette" htmlFor="ot-rate_holiday">
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
                    className="ot-champ-cadre"
                  />
                </div>
              </div>
              <label className="ot-bascule">
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

            {/*  ⏰ Seuil et alerte : deux objets distincts (décision 24/10/2026).
                Le seuil peut servir de point de repère sans que personne ne
                veuille être prévenu — d'où la case séparée. Et aucune alerte
                ne se déduit d'une valeur : seule la case l'allume. */}
            <div className="ot-rules-section">
              <h3>
                Alerte hebdomadaire
              </h3>
              <div className="ot-rang">
                <div className="ot-champ">
                  <label className="ot-etiquette" htmlFor="ot-weekly_threshold">
                    Seuil hebdomadaire (heures)
                  </label>
                  <input
                    id="ot-weekly_threshold"
                    min="1"
                    max="168"
                    step="0.5"
                    disabled={savingSettings}
                    type="number"
                    value={settingsForm.weekly_threshold ?? ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        weekly_threshold:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="ot-champ-cadre"
                  />
                </div>
              </div>
              <label className="ot-bascule">
                <input
                  id="ot-alerte_hebdo_activee"
                  disabled={savingSettings}
                  type="checkbox"
                  checked={settingsForm.alerte_hebdo_activee === true}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      alerte_hebdo_activee: e.target.checked,
                    })
                  }
                />
                <span>M’alerter au-delà de ce seuil</span>
              </label>
              <small className="ot-aide">
                Le seuil et l’alerte sont deux choses : vous pouvez fixer un
                seuil sans être prévenu. Sans case cochée, aucune alerte n’est
                produite. 48 h est une valeur proposée par le produit, pas une
                obligation.
              </small>
            </div>
          </div>

          <div className="ot-rules-footer">
            {/*  Le kit ne connaît qu'une seule espèce de bouton — l'argile pleine.
                « Annuler » n'a donc pas le droit d'être un troisième objet : il
                prend le CONTOUR du kit (même gabarit, même cerclage, encre sur
                papier) et laisse la charge à « Sauvegarder ». */}
            <button
              disabled={savingSettings}
              onClick={() => setShowSettingsModal(false)}
              className="ot-btn-contour"
            >
              Annuler
            </button>
            <button onClick={handleSaveSettings} disabled={savingSettings}>
              <Save size={16} />
              {savingSettings ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </OvertimeRulesDrawer>
      )}
    </div>
  )
}
