import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  FileText,
  Home,
  Hourglass,
  Moon,
  PieChart,
  Plus,
  Search,
  Sun,
  Timer,
  Users,
  X,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import { AdinkraWatermarkSvg, KenteWovenTapestrySvg, WovenKenteBadgeSvg } from './AfroCulturalSvg'
import {
  badgeAnomalie,
  estPausePresumee,
  estPauseReelleEffectuee,
  formatDuree,
  formaterTempsPauseEnDirect,
} from '../services/pausesService'
import { getHeuresMinutesLocales, jourLocal } from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

function formatPeriodRangeLabel(selectedDate, viewMode = 'semaine') {
  if (!selectedDate) return ''
  const parsed = new Date(`${selectedDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return selectedDate

  if (viewMode === 'jour') {
    const raw = parsed.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  if (viewMode === 'mois') {
    const raw = parsed.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  const dayOfWeek = parsed.getDay()
  const monday = new Date(parsed)
  monday.setDate(parsed.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const d1 = monday.getDate()
  const d2 = sunday.getDate()
  const m1 = monday.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  const m2 = sunday.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  const year = sunday.getFullYear()
  const capM2 = m2.charAt(0).toUpperCase() + m2.slice(1)

  if (monday.getMonth() === sunday.getMonth()) {
    return `${d1} – ${d2} ${capM2} ${year}`
  }
  const capM1 = m1.charAt(0).toUpperCase() + m1.slice(1)
  return `${d1} ${capM1} – ${d2} ${capM2} ${year}`
}

function formatTableRowDate(dateStr) {
  if (!dateStr) return '—'
  const parsed = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateStr
  const raw = parsed.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function PausesCulturalHero({
  darkMode = true,
  viewMode = 'semaine',
  onViewModeChange,
  selectedDate,
  onShiftDate,
  onDateChange,
  entreprises = [],
  selectedEnterpriseId = 'all',
  onSelectEnterprise,
  isSuperAdmin = false,
  admin = null,
  onToggleTheme,
  onBackDashboard,
  onNavigate,
  onToggleAddForm,
  showAddForm = false,
  onExportCsv,
}) {
  const dateInputRef = useRef(null)
  const periodLabel = useMemo(
    () => formatPeriodRangeLabel(selectedDate, viewMode),
    [selectedDate, viewMode]
  )

  const todayIso = jourLocal(new Date()) || new Date().toISOString().split('T')[0]
  const adminFullName = `${admin?.first_name || ''} ${admin?.last_name || ''}`.trim() || 'Administrateur'
  const adminRoleLabel = isSuperAdmin
    ? 'RH · Super Admin'
    : (admin?.selectedEnterprise?.name || 'RH · Siège')
  const adminInitials = `${admin?.first_name?.[0] || ''}${admin?.last_name?.[0] || ''}`.toUpperCase() || 'AD'

  const openDatePicker = () => {
    const el = dateInputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // Fallback ci-dessous
      }
    }
    el.focus()
    el.click()
  }

  return (
    <header aria-label="En-tête Pauses En-Check">
      <div className="pauses-v2-topbar">
        {/* Flèche Retour + Marque En-Check · Pauses */}
        <div className="pauses-v2-brand">
          {onBackDashboard && (
            <button
              type="button"
              className="pauses-v2-back-btn"
              onClick={onBackDashboard}
              title="Retour au Dashboard"
              aria-label="Retour au Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div
            onClick={onBackDashboard}
            role={onBackDashboard ? 'button' : undefined}
            tabIndex={onBackDashboard ? 0 : undefined}
            style={{ cursor: onBackDashboard ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 11 }}
            title="Retour au Dashboard"
          >
            <EnCheckBrandMark size={40} />
            <div className="pauses-v2-brand-copy">
              <strong>Pauses · En-Check</strong>
              <span>Humain · Temps · Performance</span>
            </div>
          </div>
          <WovenKenteBadgeSvg variant={2} size={34} />
        </div>

        {/* Navigation principale (fidèle à la maquette) */}
        {onNavigate && (
          <nav className="pauses-v2-nav" aria-label="Navigation principale En-Check">
            <button type="button" className="pauses-v2-nav-item" onClick={() => onNavigate('/dashboard')}>
              <Home size={15} />
              <span>Dashboard</span>
            </button>
            <button type="button" className="pauses-v2-nav-item" onClick={() => onNavigate('/pointages')}>
              <Clock size={15} />
              <span>Pointages</span>
            </button>
            <button type="button" className="pauses-v2-nav-item" onClick={() => onNavigate('/employes')}>
              <Users size={15} />
              <span>Employés</span>
            </button>
            <button type="button" className="pauses-v2-nav-item is-active" aria-current="page">
              <Coffee size={15} />
              <span>Pauses</span>
            </button>
            <button type="button" className="pauses-v2-nav-item" onClick={() => onNavigate('/planning')}>
              <Calendar size={15} />
              <span>Planning</span>
            </button>
          </nav>
        )}

        {/* Contrôles de droite */}
        <div className="pauses-v2-actions">
          {/* Sélecteur Jour | Semaine | Mois */}
          <div className="pauses-v2-period-pills" role="group" aria-label="Mode de période">
            {['jour', 'semaine', 'mois'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={`pauses-v2-period-pill${viewMode === mode ? ' is-active' : ''}`}
                onClick={() => onViewModeChange && onViewModeChange(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Sélecteur de plage de dates fonctionnel */}
          <div className="pauses-v2-date-box">
            <button
              type="button"
              className="pauses-v2-date-nav-btn"
              onClick={() => onShiftDate && onShiftDate(-1)}
              aria-label="Période précédente"
              title="Période précédente"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              type="button"
              className="pauses-v2-date-trigger"
              onClick={openDatePicker}
              title="Choisir une date au calendrier"
            >
              <Calendar size={14} color="var(--pv-gold)" />
              <span>{periodLabel}</span>
            </button>

            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange && onDateChange(e.target.value)}
              aria-label="Choisir une date"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: 'none',
              }}
            />

            <button
              type="button"
              className="pauses-v2-date-nav-btn"
              onClick={() => onShiftDate && onShiftDate(1)}
              aria-label="Période suivante"
              title="Période suivante"
            >
              <ChevronRight size={15} />
            </button>

            {selectedDate !== todayIso && (
              <button
                type="button"
                className="pauses-v2-date-nav-btn"
                onClick={() => onDateChange && onDateChange(todayIso)}
                style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--pv-gold)', padding: '2px 6px' }}
                title="Revenir à aujourd’hui"
              >
                Auj.
              </button>
            )}
          </div>

          {/* Filtre entreprise pour Super Admin */}
          {isSuperAdmin && entreprises.length > 0 && onSelectEnterprise && (
            <select
              className="pauses-v2-select"
              value={selectedEnterpriseId || 'all'}
              onChange={(e) => onSelectEnterprise(e.target.value)}
              aria-label="Sélectionner une entreprise"
            >
              <option value="all">Toutes les entreprises</option>
              {entreprises.map((ent) => (
                <option key={ent.id} value={ent.id}>{ent.name}</option>
              ))}
            </select>
          )}

          {/* Bouton + Ajouter une pause */}
          {onToggleAddForm && (
            <button
              type="button"
              className="pauses-v2-add-btn"
              onClick={onToggleAddForm}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{showAddForm ? 'Fermer' : 'Ajouter une pause'}</span>
            </button>
          )}

          {/* Export CSV */}
          {onExportCsv && (
            <button
              type="button"
              className="pauses-v2-Ghost-btn"
              onClick={onExportCsv}
              title="Exporter en CSV"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          )}

          {/* Thème Clair / Sombre */}
          {onToggleTheme && (
            <button
              type="button"
              className="pauses-v2-Ghost-btn"
              onClick={onToggleTheme}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          )}

          {/* Profil Admin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 4 }}>
            <div className="pauses-v2-avatar" style={{ width: 36, height: 36, flexBasis: 36, fontSize: '0.74rem' }}>
              {adminInitials}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <strong style={{ display: 'block', fontSize: '0.78rem', color: 'var(--pv-text)' }}>{adminFullName}</strong>
              <span style={{ fontSize: '0.68rem', color: 'var(--pv-muted)' }}>{adminRoleLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export function PausesExecutiveKpis({
  paies = [],
  activeTab = 'all',
  subFilter = 'all',
  onSelectTab,
  onSelectSubFilter,
  nowMs = Date.now(),
}) {
  const activeRecords = useMemo(() => paies.filter((p) => p.statut !== 'ecartee'), [paies])
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const openPauses = useMemo(() => realPauses.filter((p) => p.ouverte), [realPauses])
  const presumedPending = useMemo(() => paies.filter((p) => p.statut === 'presumee'), [paies])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])

  const realDurationMin = useMemo(
    () =>
      realPauses.reduce((acc, p) => {
        if (p.ouverte && p.debutISO) {
          const elapsedMin = Math.max(0, Math.round((nowMs - new Date(p.debutISO).getTime()) / 60000))
          return acc + elapsedMin
        }
        return acc + (Number(p.dureeMinutes) || 0)
      }, 0),
    [realPauses, nowMs]
  )

  const totalBase = Math.max(1, activeRecords.length)
  const openPct = activeRecords.length > 0 ? Math.min(100, Math.round((openPauses.length / Math.max(1, realPauses.length)) * 100)) : 0
  const realPct = activeRecords.length > 0 ? Math.min(100, Math.round((realPauses.length / totalBase) * 100)) : 0
  const presumedPct = activeRecords.length > 0 ? Math.min(100, Math.round((presumedPending.length / totalBase) * 100)) : 0
  const anomaliesPct = activeRecords.length > 0 ? Math.min(100, Math.round((anomaliesPauses.length / totalBase) * 100)) : 0

  return (
    <>
      {/* Bandeau Chronomètre Dynamique en Direct dès qu'une pause réelle est déclenchée */}
      {openPauses.length > 0 && (
        <section className="pauses-v2-live-banner" aria-label="Pauses réelles en cours en direct">
          <div className="pauses-v2-live-banner-left">
            <span className="pauses-v2-live-pulse-dot" />
            <strong style={{ fontSize: '0.88rem', color: 'var(--pv-text)' }}>
              {openPauses.length === 1
                ? '1 collaborateur est actuellement en pause réelle :'
                : `${openPauses.length} collaborateurs sont actuellement en pause réelle :`}
            </strong>
            {openPauses.map((op) => (
              <span key={op.id} className="pauses-v2-live-chip">
                <Timer size={14} color="#f59e0b" />
                <strong>{op.employe}</strong>
                {op.matricule && <span style={{ opacity: 0.72 }}>({op.matricule})</span>}
                <span style={{ opacity: 0.8 }}>depuis {op.debutHHMM}</span>
                <span className="pauses-v2-live-timer-mono">
                  ⏱️ {formaterTempsPauseEnDirect(op, nowMs)}
                </span>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="pauses-v2-Ghost-btn"
            onClick={() => {
              onSelectTab && onSelectTab('reelles')
              onSelectSubFilter && onSelectSubFilter('en_direct')
            }}
          >
            Filtrer les pauses en direct
          </button>
        </section>
      )}

      {/* 4 Cartes KPI Exécutives (fidèles à redesign-pauses-v2.png) */}
      <section className="pauses-v2-kpi-grid" aria-label="Indicateurs exécutifs des pauses">
        {/* CARTE 1 : EN PAUSE EN DIRECT */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-amber${subFilter === 'en_direct' ? ' is-selected' : ''}`}
          style={{ position: 'relative', overflow: 'hidden' }}
          onClick={() => {
            if (subFilter === 'en_direct') {
              onSelectTab && onSelectTab('all')
              onSelectSubFilter && onSelectSubFilter('all')
            } else {
              onSelectTab && onSelectTab('reelles')
              onSelectSubFilter && onSelectSubFilter('en_direct')
            }
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-kpi-top">
            <div className="pauses-v2-kpi-circle">
              <Coffee size={24} />
            </div>
            <div>
              <strong className="pauses-v2-kpi-number">
                {String(openPauses.length).padStart(2, '0')}
              </strong>
              <span className="pauses-v2-kpi-label">En pause en direct</span>
              {openPauses.length > 0 && (
                <span className="pauses-v2-kpi-live-sub">
                  <Timer size={12} />
                  <span>
                    {openPauses[0].employe} · {formaterTempsPauseEnDirect(openPauses[0], nowMs)} (depuis {openPauses[0].debutHHMM})
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${openPauses.length > 0 ? Math.max(16, openPct) : 0}%`,
                  background: 'linear-gradient(90deg, #f0b254, #d97706)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{openPct}%</span>
          </div>
        </button>

        {/* CARTE 2 : PAUSES RÉELLES */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-emerald${activeTab === 'reelles' && subFilter !== 'en_direct' ? ' is-selected' : ''}`}
          style={{ position: 'relative', overflow: 'hidden' }}
          onClick={() => {
            onSelectTab && onSelectTab(activeTab === 'reelles' && subFilter === 'all' ? 'all' : 'reelles')
            onSelectSubFilter && onSelectSubFilter('all')
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-kpi-top">
            <div className="pauses-v2-kpi-circle">
              <Users size={24} />
            </div>
            <div>
              <strong className="pauses-v2-kpi-number">
                {String(realPauses.length).padStart(2, '0')}
              </strong>
              <span className="pauses-v2-kpi-label">
                Pauses réelles · {formatDuree(realDurationMin)}
              </span>
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${realPauses.length > 0 ? Math.max(12, realPct) : 0}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{realPct}%</span>
          </div>
        </button>

        {/* CARTE 3 : PRÉSUMÉES À STATUER */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-copper${activeTab === 'presumees' ? ' is-selected' : ''}`}
          style={{ position: 'relative', overflow: 'hidden' }}
          onClick={() => {
            onSelectTab && onSelectTab(activeTab === 'presumees' ? 'all' : 'presumees')
            onSelectSubFilter && onSelectSubFilter('presumees_a_statuer')
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-kpi-top">
            <div className="pauses-v2-kpi-circle">
              <Hourglass size={23} />
            </div>
            <div>
              <strong className="pauses-v2-kpi-number">
                {String(presumedPending.length).padStart(2, '0')}
              </strong>
              <span className="pauses-v2-kpi-label">Présumées à statuer</span>
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${presumedPending.length > 0 ? Math.max(12, presumedPct) : 0}%`,
                  background: 'linear-gradient(90deg, #e07a38, #f0b254)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{presumedPct}%</span>
          </div>
        </button>

        {/* CARTE 4 : ANOMALIES */}
        <button
          type="button"
          className={`pauses-v2-kpi-card is-coral${activeTab === 'anomalies' ? ' is-selected' : ''}`}
          style={{ position: 'relative', overflow: 'hidden' }}
          onClick={() => {
            onSelectTab && onSelectTab(activeTab === 'anomalies' ? 'all' : 'anomalies')
            onSelectSubFilter && onSelectSubFilter('anomalies_toutes')
          }}
        >
          <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
          <div className="pauses-v2-kpi-top">
            <div className="pauses-v2-kpi-circle">
              <AlertTriangle size={23} />
            </div>
            <div>
              <strong className="pauses-v2-kpi-number">
                {String(anomaliesPauses.length).padStart(2, '0')}
              </strong>
              <span className="pauses-v2-kpi-label">
                {anomaliesPauses.length > 1 ? 'Anomalies' : 'Anomalie'}
              </span>
            </div>
          </div>
          <div className="pauses-v2-kpi-bar-row">
            <div className="pauses-v2-kpi-track">
              <span
                className="pauses-v2-kpi-fill"
                style={{
                  width: `${anomaliesPauses.length > 0 ? Math.max(10, anomaliesPct) : 0}%`,
                  background: 'linear-gradient(90deg, #ef4444, #f87171)',
                }}
              />
            </div>
            <span className="pauses-v2-kpi-pct">{anomaliesPct}%</span>
          </div>
        </button>
      </section>
    </>
  )
}

export function PausesAnalyticsCharts({ paies = [], onSelectTab }) {
  const [chartScope, setChartScope] = useState('all')

  // Histogramme horaire (08h -> 18h par défaut, étendu si pauses matinales/nocturnes)
  const { slots, maxCount } = useMemo(() => {
    const countsByHour = Array(24).fill(0)

    for (const p of paies) {
      if (p.statut === 'ecartee') continue
      if (chartScope === 'reelles' && !estPauseReelleEffectuee(p)) continue
      if (chartScope === 'presumees' && !estPausePresumee(p)) continue

      let hour = null
      if (p.debutISO) {
        const parts = getHeuresMinutesLocales(p.debutISO)
        if (parts && Number.isFinite(parts.heures)) hour = parts.heures
      }
      if (hour === null && p.debutHHMM && /^\d{2}:\d{2}/.test(p.debutHHMM)) {
        hour = parseInt(p.debutHHMM.slice(0, 2), 10)
      }
      if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
        countsByHour[hour] += 1
      }
    }

    let minH = 8
    let maxH = 18
    for (let h = 0; h < 24; h++) {
      if (countsByHour[h] > 0) {
        if (h < minH) minH = h
        if (h > maxH) maxH = h
      }
    }

    const result = []
    for (let h = minH; h <= maxH; h++) {
      result.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}h`,
        count: countsByHour[h],
      })
    }

    const peak = Math.max(4, ...result.map((s) => s.count))
    return { slots: result, maxCount: peak }
  }, [paies, chartScope])

  // Statistiques du Donut (Réelles vs Présumées vs Anomalies)
  const donutStats = useMemo(() => {
    const active = paies.filter((p) => p.statut !== 'ecartee')
    const realList = active.filter((p) => estPauseReelleEffectuee(p))
    const presumedList = active.filter((p) => estPausePresumee(p))
    const anomalyList = active.filter((p) => Boolean(p.anomalie))

    const realMin = realList.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0)
    const presumedMin = presumedList.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0)
    const anomalyMin = anomalyList.reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0)

    const total = Math.max(1, realList.length + presumedList.length)
    const realPct = active.length > 0 ? Math.round((realList.length / total) * 100) : 0
    const presumedPct = active.length > 0 ? Math.max(0, 100 - realPct) : 0
    const anomalyPct = active.length > 0 ? Math.min(100, Math.round((anomalyList.length / total) * 100)) : 0

    return {
      realCount: realList.length,
      presumedCount: presumedList.length,
      anomalyCount: anomalyList.length,
      realMin,
      presumedMin,
      anomalyMin,
      realPct,
      presumedPct,
      anomalyPct,
      total,
    }
  }, [paies])

  const circumference = 2 * Math.PI * 46
  const realArc = (donutStats.realCount / donutStats.total) * circumference
  const presumedArc = (donutStats.presumedCount / donutStats.total) * circumference

  const yTicks = useMemo(() => {
    const top = Math.ceil(maxCount / 3) * 3
    return [
      { label: top, y: 26 },
      { label: Math.round((top * 2) / 3), y: 66 },
      { label: Math.round(top / 3), y: 106 },
      { label: 0, y: 146 },
    ]
  }, [maxCount])

  const chartTopVal = yTicks[0].label || 4

  return (
    <section className="pauses-v2-charts-grid" aria-label="Graphiques analytiques des pauses">
      {/* GRAPHIQUE GAUCHE : ACTIVITÉ DES PAUSES (HISTOGRAMME HORAIRE) */}
      <article className="pauses-v2-panel">
        <div className="pauses-v2-panel-head">
          <div className="pauses-v2-panel-title-wrap">
            <div className="pauses-v2-panel-icon">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="pauses-v2-panel-title">Activité des pauses</h3>
              <p className="pauses-v2-panel-subtitle">Nombre de pauses par tranche horaire</p>
            </div>
          </div>

          <select
            className="pauses-v2-select"
            value={chartScope}
            onChange={(e) => setChartScope(e.target.value)}
            aria-label="Filtrer les pauses du graphique"
          >
            <option value="all">Toutes les pauses</option>
            <option value="reelles">Pauses réelles pointées</option>
            <option value="presumees">Pauses présumées</option>
          </select>
        </div>

        <svg
          viewBox="0 0 580 174"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label="Histogramme du nombre de pauses par tranche horaire"
        >
          <defs>
            <linearGradient id="pauses-v2-bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2a950" />
              <stop offset="100%" stopColor="#d97228" />
            </linearGradient>
          </defs>

          {/* Lignes de grille horizontales */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <text x="8" y={t.y + 3} fontSize="10" fill="currentColor" opacity="0.55">
                {t.label}
              </text>
              <line
                x1="34"
                y1={t.y}
                x2="566"
                y2={t.y}
                stroke="currentColor"
                strokeOpacity="0.1"
              />
            </g>
          ))}

          {/* Barres horaires */}
          {slots.map((slot, idx) => {
            const slotWidth = 524 / Math.max(1, slots.length)
            const xCenter = 38 + idx * slotWidth + slotWidth / 2
            const barWidth = Math.min(28, Math.max(14, slotWidth * 0.56))
            const baseLine = 146
            const maxBarHeight = 116
            const rawHeight = (slot.count / chartTopVal) * maxBarHeight
            const barHeight = slot.count > 0 ? Math.max(8, rawHeight) : 2

            return (
              <g key={slot.label}>
                <rect
                  x={xCenter - barWidth / 2}
                  y={baseLine - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={slot.count > 0 ? 'url(#pauses-v2-bar-grad)' : 'currentColor'}
                  fillOpacity={slot.count > 0 ? 1 : 0.14}
                >
                  <title>{`${slot.label} · ${slot.count} pause(s)`}</title>
                </rect>
                {slot.count > 0 && (
                  <text
                    x={xCenter}
                    y={baseLine - barHeight - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="800"
                    fill="currentColor"
                    opacity="0.9"
                  >
                    {slot.count}
                  </text>
                )}
                <text
                  x={xCenter}
                  y="164"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="650"
                  fill="currentColor"
                  opacity="0.65"
                >
                  {slot.label}
                </text>
              </g>
            )
          })}
        </svg>
      </article>

      {/* GRAPHIQUE DROITE : RÉPARTITION DES PAUSES (DONUT + LÉGENDE ALIGNÉE) */}
      <article className="pauses-v2-panel">
        <div className="pauses-v2-panel-head">
          <div className="pauses-v2-panel-title-wrap">
            <div className="pauses-v2-panel-icon">
              <PieChart size={18} />
            </div>
            <div>
              <h3 className="pauses-v2-panel-title">Répartition des pauses</h3>
              <p className="pauses-v2-panel-subtitle">Sur la période sélectionnée</p>
            </div>
          </div>
        </div>

        <div className="pauses-v2-donut-layout">
          <div style={{ position: 'relative', width: 156, height: 156, margin: '0 auto' }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }} aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r="46"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="14"
              />
              {realArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray={`${realArc} ${circumference}`}
                  transform="rotate(-90 60 60)"
                />
              )}
              {presumedArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="#e07a38"
                  strokeWidth="14"
                  strokeDasharray={`${presumedArc} ${circumference}`}
                  strokeDashoffset={-realArc}
                  transform="rotate(-90 60 60)"
                />
              )}
            </svg>
            <div className="pointages-donut-center">
              <strong style={{ fontSize: '1.5rem', fontWeight: 850 }}>{donutStats.realPct}%</strong>
              <span style={{ fontSize: '0.74rem', color: 'var(--pv-text-soft)', fontWeight: 700 }}>
                Pauses réelles
              </span>
            </div>
          </div>

          <div className="pauses-v2-donut-legend">
            <button
              type="button"
              className="pauses-v2-legend-item"
              onClick={() => onSelectTab && onSelectTab('reelles')}
            >
              <div className="pauses-v2-legend-left">
                <span className="pauses-v2-legend-dot" style={{ background: '#10b981' }} />
                <div>
                  <strong>Pauses réelles</strong>
                  <small>
                    {donutStats.realCount} pause{donutStats.realCount > 1 ? 's' : ''} · {formatDuree(donutStats.realMin)}
                  </small>
                </div>
              </div>
              <span className="pauses-v2-legend-pct">{donutStats.realPct}%</span>
            </button>

            <button
              type="button"
              className="pauses-v2-legend-item"
              onClick={() => onSelectTab && onSelectTab('presumees')}
            >
              <div className="pauses-v2-legend-left">
                <span className="pauses-v2-legend-dot" style={{ background: '#e07a38' }} />
                <div>
                  <strong>Pauses présumées</strong>
                  <small>
                    {donutStats.presumedCount} pause{donutStats.presumedCount > 1 ? 's' : ''} · {formatDuree(donutStats.presumedMin)}
                  </small>
                </div>
              </div>
              <span className="pauses-v2-legend-pct">{donutStats.presumedPct}%</span>
            </button>

            <button
              type="button"
              className="pauses-v2-legend-item"
              onClick={() => onSelectTab && onSelectTab('anomalies')}
              style={{ borderBottomColor: 'transparent' }}
            >
              <div className="pauses-v2-legend-left">
                <span className="pauses-v2-legend-dot" style={{ background: '#ef4444' }} />
                <div>
                  <strong>Anomalies</strong>
                  <small>
                    {donutStats.anomalyCount} pause{donutStats.anomalyCount > 1 ? 's' : ''} · {formatDuree(donutStats.anomalyMin)}
                  </small>
                </div>
              </div>
              <span className="pauses-v2-legend-pct">{donutStats.anomalyPct}%</span>
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

export function PausesCollaborateursSection({
  paies = [],
  employesById = {},
  activeTab = 'all',
  subFilter = 'all',
  searchTerm = '',
  onSearchChange,
  onSelectTab,
  onSelectSubFilter,
  onStatuer,
  onOpenEmployeeFiche,
  onOpenPointages,
  nowMs = Date.now(),
}) {
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const presumedPauses = useMemo(() => paies.filter((p) => estPausePresumee(p) && p.statut !== 'ecartee'), [paies])
  const presumedPending = useMemo(() => presumedPauses.filter((p) => p.statut === 'presumee'), [presumedPauses])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])
  const openPauses = useMemo(() => realPauses.filter((p) => p.ouverte), [realPauses])

  const filteredList = useMemo(() => {
    let base = []
    if (activeTab === 'reelles') {
      base = realPauses
      if (subFilter === 'reelles_pointees') base = base.filter((p) => p.source === 'pointee')
      else if (subFilter === 'reelles_admin') base = base.filter((p) => p.source === 'admin')
      else if (subFilter === 'reelles_hors_planning') base = base.filter((p) => p.estNonPlanifiee)
      else if (subFilter === 'en_direct') base = base.filter((p) => p.ouverte)
    } else if (activeTab === 'presumees') {
      base = presumedPauses
      if (subFilter === 'presumees_a_statuer') base = base.filter((p) => p.statut === 'presumee')
      else if (subFilter === 'presumees_validees') base = base.filter((p) => p.statut === 'validee')
    } else if (activeTab === 'anomalies') {
      base = anomaliesPauses
      if (subFilter === 'anomalie_sans_reprise') base = base.filter((p) => p.anomalie === 'sans_reprise')
      else if (subFilter === 'anomalie_trop_longue') base = base.filter((p) => p.anomalie === 'trop_longue')
    } else {
      // Vue 'all' : pauses en direct en tête, puis réelles et présumées non écartées
      base = paies.filter((p) => p.statut !== 'ecartee')
      if (subFilter === 'en_direct') base = base.filter((p) => p.ouverte)
      else if (subFilter === 'reelles_hors_planning') base = base.filter((p) => p.estNonPlanifiee)
    }

    const q = String(searchTerm || '').trim().toLowerCase()
    const searched = !q
      ? base
      : base.filter((p) => {
          const emp = employesById[p.employe_id]
          const dept = emp?.department || emp?.position || ''
          const hay = `${p.employe || ''} ${p.matricule || ''} ${p.entreprise_nom || ''} ${dept} ${p.motif || ''}`.toLowerCase()
          return hay.includes(q)
        })

    // Toujours mettre les pauses en cours en tout premier pour les voir immédiatement
    return [...searched].sort((a, b) => {
      if (a.ouverte && !b.ouverte) return -1
      if (!a.ouverte && b.ouverte) return 1
      return 0
    })
  }, [activeTab, subFilter, realPauses, presumedPauses, anomaliesPauses, paies, searchTerm, employesById])

  const selectDropdownValue = useMemo(() => {
    if (subFilter === 'en_direct') return 'en_direct'
    if (activeTab === 'reelles' && subFilter === 'reelles_pointees') return 'reelles_pointees'
    if (activeTab === 'reelles' && subFilter === 'reelles_admin') return 'reelles_admin'
    if (subFilter === 'reelles_hors_planning') return 'reelles_hors_planning'
    if (activeTab === 'reelles') return 'reelles_all'
    if (activeTab === 'presumees' && subFilter === 'presumees_a_statuer') return 'presumees_a_statuer'
    if (activeTab === 'presumees' && subFilter === 'presumees_validees') return 'presumees_validees'
    if (activeTab === 'presumees') return 'presumees_all'
    if (activeTab === 'anomalies') return 'anomalies_all'
    return 'all'
  }, [activeTab, subFilter])

  const handleStatusDropdownChange = (val) => {
    if (val === 'all') {
      onSelectTab && onSelectTab('all')
      onSelectSubFilter && onSelectSubFilter('all')
    } else if (val === 'en_direct') {
      onSelectTab && onSelectTab('reelles')
      onSelectSubFilter && onSelectSubFilter('en_direct')
    } else if (val === 'reelles_all') {
      onSelectTab && onSelectTab('reelles')
      onSelectSubFilter && onSelectSubFilter('all')
    } else if (val === 'reelles_pointees' || val === 'reelles_admin' || val === 'reelles_hors_planning') {
      onSelectTab && onSelectTab('reelles')
      onSelectSubFilter && onSelectSubFilter(val)
    } else if (val === 'presumees_all') {
      onSelectTab && onSelectTab('presumees')
      onSelectSubFilter && onSelectSubFilter('all')
    } else if (val === 'presumees_a_statuer' || val === 'presumees_validees') {
      onSelectTab && onSelectTab('presumees')
      onSelectSubFilter && onSelectSubFilter(val)
    } else if (val === 'anomalies_all') {
      onSelectTab && onSelectTab('anomalies')
      onSelectSubFilter && onSelectSubFilter('anomalies_toutes')
    }
  }

  return (
    <section className="pauses-v2-panel" aria-label="Pauses des employés">
      {/* En-tête de la table (fidèle à redesign-pauses-v2.png) */}
      <div className="pauses-v2-panel-head" style={{ marginBottom: 14 }}>
        <div className="pauses-v2-panel-title-wrap">
          <div className="pauses-v2-panel-icon">
            <Users size={18} />
          </div>
          <div>
            <h2 className="pauses-v2-panel-title">Pauses des employés</h2>
            <p className="pauses-v2-panel-subtitle">
              Détail des pauses sur la période ({filteredList.length} affichée{filteredList.length > 1 ? 's' : ''})
            </p>
          </div>
        </div>

        {/* Barre de recherche + Filtre de statut + Actions en lot */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {presumedPending.length > 1 && onStatuer && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="pauses-v2-btn-validate"
                onClick={() => onStatuer(presumedPending.map((p) => p.id), 'valider')}
                title="Valider toutes les pauses présumées en attente"
              >
                <Check size={13} />
                <span>Valider les {presumedPending.length} présumées</span>
              </button>
              <button
                type="button"
                className="pauses-v2-btn-reject"
                onClick={() => onStatuer(presumedPending.map((p) => p.id), 'ecarter')}
                title="Écarter toutes les pauses présumées en attente"
              >
                <X size={13} />
                <span>Tout écarter</span>
              </button>
            </div>
          )}

          {/* Recherche employé */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 13px',
              borderRadius: 9,
              border: '1px solid var(--pv-border)',
              background: 'var(--pv-card-elevated)',
            }}
          >
            <Search size={14} color="var(--pv-muted)" />
            <input
              type="search"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--pv-text)',
                fontSize: '0.8rem',
                width: 190,
              }}
            />
          </label>

          {/* Menu déroulant Tous les statuts */}
          <select
            className="pauses-v2-select"
            value={selectDropdownValue}
            onChange={(e) => handleStatusDropdownChange(e.target.value)}
            aria-label="Filtrer par statut de pause"
          >
            <option value="all">Tous les statuts ({paies.filter((p) => p.statut !== 'ecartee').length})</option>
            <option value="en_direct">⏱️ En pause en direct ({openPauses.length})</option>
            <option value="reelles_all">✓ Pauses réelles ({realPauses.length})</option>
            <option value="reelles_pointees">📱 Réelles pointées ({realPauses.filter((p) => p.source === 'pointee').length})</option>
            <option value="reelles_admin">🛡️ Saisies par l’admin ({realPauses.filter((p) => p.source === 'admin').length})</option>
            <option value="reelles_hors_planning">⚡ Hors planning ({realPauses.filter((p) => p.estNonPlanifiee).length})</option>
            <option value="presumees_a_statuer">⏳ Présumées à statuer ({presumedPending.length})</option>
            <option value="presumees_all">📋 Toutes les présumées ({presumedPauses.length})</option>
            <option value="presumees_validees">✓ Présumées validées ({presumedPauses.filter((p) => p.statut === 'validee').length})</option>
            <option value="anomalies_all">⚠️ Anomalies ({anomaliesPauses.length})</option>
          </select>
        </div>
      </div>

      {/* Onglets rapides */}
      <div
        role="tablist"
        aria-label="Onglets rapides des pauses"
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}
      >
        {[
          { id: 'all', label: `Toutes (${paies.filter((p) => p.statut !== 'ecartee').length})`, active: activeTab === 'all' && subFilter === 'all' },
          { id: 'en_direct', label: `⏱️ En direct (${openPauses.length})`, active: subFilter === 'en_direct' },
          { id: 'reelles', label: `✓ Pauses réelles (${realPauses.length})`, active: activeTab === 'reelles' && subFilter !== 'en_direct' },
          { id: 'presumees', label: `⏳ Présumées (${presumedPauses.length})`, active: activeTab === 'presumees' },
          { id: 'anomalies', label: `⚠️ Anomalies (${anomaliesPauses.length})`, active: activeTab === 'anomalies' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.active}
            className="pauses-v2-Ghost-btn"
            style={{
              borderColor: t.active ? 'var(--pv-gold)' : undefined,
              color: t.active ? 'var(--pv-gold)' : undefined,
              background: t.active ? 'rgba(240, 178, 84, 0.12)' : undefined,
            }}
            onClick={() => {
              if (t.id === 'en_direct') {
                onSelectTab && onSelectTab('reelles')
                onSelectSubFilter && onSelectSubFilter('en_direct')
              } else {
                onSelectTab && onSelectTab(t.id)
                onSelectSubFilter && onSelectSubFilter('all')
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tableau RH des pauses */}
      {filteredList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '42px 18px', color: 'var(--pv-muted)' }}>
          <Coffee size={36} color="var(--pv-gold)" style={{ opacity: 0.75, marginBottom: 8 }} />
          <h3 style={{ margin: '0 0 6px', color: 'var(--pv-text)', fontSize: '1rem', fontWeight: 800 }}>
            Aucune pause trouvée pour ce filtre
          </h3>
          <p style={{ margin: '0 auto', maxWidth: 460, fontSize: '0.82rem' }}>
            Changez la période en haut (Jour / Semaine / Mois) ou sélectionnez « Toutes » pour afficher l’ensemble des pauses.
          </p>
        </div>
      ) : (
        <div className="pauses-v2-table-wrap">
          <table className="pauses-v2-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Service</th>
                <th>Date</th>
                <th>Plage horaire</th>
                <th>Durée</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((p) => {
                const empObj = employesById[p.employe_id] || null
                const initials = (p.employe || 'EC')
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                const serviceLabel =
                  empObj?.department ||
                  empObj?.position ||
                  p.entreprise_nom ||
                  'Équipe'
                const anomalie = badgeAnomalie(p.anomalie)
                const isPresumed = estPausePresumee(p)
                const isReal = estPauseReelleEffectuee(p)
                const liveElapsed = p.ouverte ? formaterTempsPauseEnDirect(p, nowMs) : null

                return (
                  <tr key={p.id} className={p.ouverte ? 'is-live-row' : undefined}>
                    {/* 1. Employé */}
                    <td>
                      <div className="pauses-v2-emp-cell">
                        <div className="pauses-v2-avatar">
                          {empObj?.photo_url ? (
                            <PhotoSignee
                              url={empObj.photo_url}
                              alt={p.employe}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              fallback={<span>{initials}</span>}
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div>
                          <strong className="pauses-v2-emp-name">{p.employe || 'Collaborateur'}</strong>
                          <span className="pauses-v2-emp-mat">
                            {p.matricule ? `#${p.matricule}` : 'Collaborateur'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Service */}
                    <td style={{ color: 'var(--pv-text-soft)', fontWeight: 600 }}>
                      {serviceLabel}
                    </td>

                    {/* 3. Date */}
                    <td style={{ color: 'var(--pv-text-soft)', whiteSpace: 'nowrap' }}>
                      {formatTableRowDate(p.jour)}
                    </td>

                    {/* 4. Plage horaire */}
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>
                      {p.ouverte ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--pv-amber)' }}>
                          <span className="pauses-v2-live-pulse-dot" />
                          <span>{p.debutHHMM} → En cours</span>
                        </span>
                      ) : (
                        <span>
                          {p.debutHHMM} <span style={{ opacity: 0.5, margin: '0 3px' }}>→</span> {p.finHHMM || '--:--'}
                        </span>
                      )}
                    </td>

                    {/* 5. Durée (ou Timer Dynamique en Direct) */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {p.ouverte ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            className="pauses-v2-live-timer-mono"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: '0.92rem',
                            }}
                          >
                            <Timer size={14} />
                            <span>{liveElapsed}</span>
                          </span>
                          <small style={{ fontSize: '0.69rem', color: 'var(--pv-muted)', fontWeight: 600 }}>
                            Depuis {p.debutHHMM}
                          </small>
                        </div>
                      ) : (
                        <strong style={{ fontWeight: 750 }}>{formatDuree(p.dureeMinutes)}</strong>
                      )}
                    </td>

                    {/* 6. Statut */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        {p.ouverte ? (
                          <span className="pauses-v2-status-pill is-live">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
                            <span>En pause en direct</span>
                          </span>
                        ) : isReal ? (
                          <span className="pauses-v2-status-pill is-real">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                            <span>
                              {p.source === 'admin'
                                ? 'Pause réelle (admin)'
                                : p.statut === 'validee'
                                  ? 'Pause réelle validée'
                                  : 'Pause réelle pointée'}
                            </span>
                          </span>
                        ) : isPresumed ? (
                          <span className="pauses-v2-status-pill is-presumed">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f0b254' }} />
                            <span>
                              {p.statut === 'validee' ? 'Présumée validée' : 'Pause présumée'}
                            </span>
                          </span>
                        ) : null}

                        {p.estNonPlanifiee && isReal && (
                          <span className="pauses-v2-status-pill is-presumed" title="Pause prise hors planning prévu">
                            ⚡ Hors planning
                          </span>
                        )}

                        {anomalie && (
                          <span className="pauses-v2-status-pill is-anomaly">
                            {anomalie.label}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 7. Actions */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {p.aStatuer && onStatuer ? (
                          <>
                            <button
                              type="button"
                              className="pauses-v2-btn-validate"
                              onClick={() => onStatuer([p.id], 'valider')}
                            >
                              <Check size={13} />
                              <span>Valider</span>
                            </button>
                            <button
                              type="button"
                              className="pauses-v2-btn-reject"
                              onClick={() => onStatuer([p.id], 'ecarter')}
                            >
                              <X size={13} />
                              <span>Écarter</span>
                            </button>
                          </>
                        ) : p.statut === 'validee' ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--pv-emerald)', fontWeight: 700, marginRight: 4 }}>
                            ✓ Validée
                          </span>
                        ) : null}

                        {onOpenEmployeeFiche && empObj && (
                          <button
                            type="button"
                            className="pauses-v2-icon-btn"
                            onClick={() => onOpenEmployeeFiche(empObj)}
                            title="Ouvrir la fiche de l’employé"
                          >
                            <FileText size={13} />
                            <span>Fiche</span>
                          </button>
                        )}

                        {onOpenPointages && (
                          <button
                            type="button"
                            className="pauses-v2-icon-btn"
                            onClick={() => onOpenPointages(p)}
                            title="Voir le pointage de ce collaborateur à cette date"
                          >
                            <Clock size={13} />
                            <span>Pointages</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export { KenteWovenTapestrySvg }
