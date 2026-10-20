import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  FileText,
  Moon,
  Plus,
  Search,
  Sun,
  Timer,
  XCircle,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import {
  KenteWovenTapestrySvg,
  WovenKenteBadgeSvg,
} from './AfroCulturalSvg'
import {
  badgeAnomalie,
  estPausePresumee,
  estPauseReelleEffectuee,
  formatDuree,
  formaterTempsPauseEnDirect,
} from '../services/pausesService'
import { getHeuresMinutesLocales } from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

function buildDynamicSplineGeometry(values = [0, 0, 0, 0, 0, 0, 0], maxValue = 1) {
  const safeMax = Math.max(1, maxValue)
  const count = Math.max(2, values.length)
  const startX = 16
  const endX = 244
  const stepX = (endX - startX) / (count - 1)
  const baseLine = 54
  const topLine = 12
  const span = baseLine - topLine

  const pts = values.map((raw, idx) => {
    const v = Math.max(0, Number(raw) || 0)
    const x = Math.round(startX + idx * stepX)
    const y = Math.round(baseLine - (v / safeMax) * span)
    return { x, y, v }
  })

  let linePath = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const midX = Math.round((p0.x + p1.x) / 2)
    linePath += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${baseLine} L ${pts[0].x} ${baseLine} Z`
  return { pts, linePath, areaPath, baseLine }
}

function build24hCurveGeometry(points = [], maxVal = 1) {
  const safeMax = Math.max(1, maxVal)
  const leftX = 38
  const rightX = 582
  const topY = 24
  const baseY = 142
  const spanY = baseY - topY
  const count = Math.max(2, points.length)
  const stepX = (rightX - leftX) / (count - 1)

  const coords = points.map((v, idx) => {
    const num = Math.max(0, Number(v) || 0)
    const x = Math.round(leftX + idx * stepX)
    const y = Math.round(baseY - (num / safeMax) * spanY)
    return { x, y, v: num }
  })

  let linePath = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i]
    const p1 = coords[i + 1]
    const midX = Math.round((p0.x + p1.x) / 2)
    linePath += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${baseY} L ${coords[0].x} ${baseY} Z`
  return { coords, linePath, areaPath, baseY }
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
  onToggleTheme,
  onBackDashboard,
  onNavigate,
  onToggleAddForm,
  showAddForm = false,
  onExportCsv,
}) {
  const formattedDateLabel = useMemo(() => {
    if (!selectedDate) return ''
    const parsed = new Date(`${selectedDate}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return selectedDate
    const raw = parsed.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }, [selectedDate])

  return (
    <header className="employes-concept-header" aria-label="En-tête Pauses En-Check">
      <KenteWovenTapestrySvg className="employes-kente-top-banner" />
      <div className="employes-concept-topbar" style={{ flexWrap: 'wrap', gap: 14 }}>
        <div className="employes-concept-brand">
          {onBackDashboard && (
            <button
              type="button"
              className="pointages-back-dashboard-btn"
              onClick={onBackDashboard}
              title="Retour au Dashboard"
              aria-label="Retour au Dashboard"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <EnCheckBrandMark size={46} />
          <div className="employes-concept-brand-text">
            <strong style={{ fontSize: '1.22rem', letterSpacing: '0.03em' }}>PAUSES — ON GÈRE !</strong>
            <span>Réelles pointées (non présumées) · Présumées séparées · Pauses en direct &amp; Hors planning</span>
          </div>
        </div>

        {onNavigate && (
          <nav className="pointages-quick-nav" aria-label="Navigation rapide En-Check">
            <button type="button" onClick={() => onNavigate('/dashboard')}>Dashboard</button>
            <button type="button" onClick={() => onNavigate('/pointages')}>Pointages</button>
            <button type="button" onClick={() => onNavigate('/employes')}>Employés</button>
            <button type="button" className="is-active" aria-current="page">Pauses</button>
            <button type="button" onClick={() => onNavigate('/planning')}>Planning</button>
          </nav>
        )}

        <div className="employes-concept-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          {/* Sélecteur Jour | Semaine | Mois */}
          <div
            role="group"
            aria-label="Mode de période"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(243, 199, 132, 0.08)',
              border: '1px solid rgba(243, 199, 132, 0.28)',
              borderRadius: 999,
              padding: 3,
              gap: 2,
            }}
          >
            {['jour', 'semaine', 'mois'].map((mode) => {
              const active = viewMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange && onViewModeChange(mode)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '6px 13px',
                    fontSize: '0.78rem',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    background: active ? 'linear-gradient(135deg, #E6A24C, #C87A28)' : 'transparent',
                    color: active ? '#17120C' : 'var(--pt-text)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              )
            })}
          </div>

          {/* Navigateur de date */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(243, 199, 132, 0.07)',
              border: '1px solid rgba(243, 199, 132, 0.25)',
              borderRadius: 999,
              padding: '4px 10px',
            }}
          >
            <button
              type="button"
              onClick={() => onShiftDate && onShiftDate(-1)}
              aria-label="Période précédente"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--pt-text)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: 2,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
              <span>{formattedDateLabel}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange && onDateChange(e.target.value)}
                aria-label="Choisir une date"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: 1,
                  height: 1,
                  pointerEvents: 'none',
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => onShiftDate && onShiftDate(1)}
              aria-label="Période suivante"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--pt-text)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: 2,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {isSuperAdmin && entreprises.length > 0 && onSelectEnterprise && (
            <label className="employes-enterprise-select-pill" title="Filtrer par entreprise">
              <Building2 size={13} />
              <select
                value={selectedEnterpriseId || 'all'}
                onChange={(e) => onSelectEnterprise(e.target.value)}
                aria-label="Sélectionner une entreprise"
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map((ent) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </label>
          )}

          {onToggleTheme && (
            <button
              type="button"
              className="employes-theme-pill"
              onClick={onToggleTheme}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{darkMode ? 'Clair' : 'Sombre'}</span>
            </button>
          )}

          {onToggleAddForm && (
            <button
              type="button"
              className="employes-add-pill-btn"
              onClick={onToggleAddForm}
            >
              <Plus size={15} />
              <span>{showAddForm ? 'Fermer le formulaire' : '+ Ajouter une pause'}</span>
            </button>
          )}

          {onExportCsv && (
            <button
              type="button"
              className="employes-theme-pill"
              onClick={onExportCsv}
              title="Exporter la vue actuelle en CSV"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export function PausesExecutiveKpis({
  paies = [],
  activeTab = 'reelles',
  subFilter = 'all',
  onSelectTab,
  onSelectSubFilter,
  nowMs = Date.now(),
}) {
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const presumedPauses = useMemo(() => paies.filter((p) => estPausePresumee(p) && p.statut !== 'ecartee'), [paies])
  const presumedPending = useMemo(() => paies.filter((p) => p.statut === 'presumee'), [paies])
  const presumedValidated = useMemo(() => paies.filter((p) => estPausePresumee(p) && p.statut === 'validee'), [paies])
  const openPauses = useMemo(() => realPauses.filter((p) => p.ouverte), [realPauses])
  const unplannedRealPauses = useMemo(() => realPauses.filter((p) => p.estNonPlanifiee), [realPauses])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])

  const realDurationMin = useMemo(
    () => realPauses.filter((p) => !p.ouverte).reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0),
    [realPauses]
  )

  const pointeeCount = useMemo(() => realPauses.filter((p) => p.source === 'pointee').length, [realPauses])
  const adminCount = useMemo(() => realPauses.filter((p) => p.source === 'admin').length, [realPauses])
  const realValidatedCount = useMemo(() => realPauses.filter((p) => p.statut === 'validee').length, [realPauses])

  const maxBase = Math.max(1, paies.length)

  const splineCard1 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          pointeeCount,
          adminCount,
          realValidatedCount,
          unplannedRealPauses.length,
          openPauses.length,
          realPauses.length,
          Math.max(1, realPauses.length),
        ],
        maxBase
      ),
    [pointeeCount, adminCount, realValidatedCount, unplannedRealPauses.length, openPauses.length, realPauses.length, maxBase]
  )

  const splineCard2 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          realPauses.length,
          pointeeCount,
          realValidatedCount,
          adminCount,
          Math.max(0, realPauses.length - unplannedRealPauses.length),
          unplannedRealPauses.length,
          realPauses.length,
        ],
        maxBase
      ),
    [realPauses.length, pointeeCount, realValidatedCount, adminCount, unplannedRealPauses.length, maxBase]
  )

  const splineCard3 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          openPauses.length,
          unplannedRealPauses.length,
          openPauses.length + unplannedRealPauses.length,
          openPauses.length,
          unplannedRealPauses.length,
          openPauses.length,
          openPauses.length + unplannedRealPauses.length,
        ],
        Math.max(1, realPauses.length)
      ),
    [openPauses.length, unplannedRealPauses.length, realPauses.length]
  )

  const splineCard4 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          presumedPending.length,
          presumedValidated.length,
          presumedPauses.length,
          anomaliesPauses.length,
          paies.filter((p) => p.anomalie === 'sans_reprise').length,
          paies.filter((p) => p.anomalie === 'trop_longue').length,
          presumedPending.length + anomaliesPauses.length,
        ],
        maxBase
      ),
    [presumedPending.length, presumedValidated.length, presumedPauses.length, anomaliesPauses.length, paies, maxBase]
  )

  const liveTimerSample = openPauses.length > 0 ? formaterTempsPauseEnDirect(openPauses[0], nowMs) : '0 min'

  return (
    <section className="employes-top-cards-grid" aria-label="Indicateurs exécutifs des pauses">
      {/* CARTE 1 : PAUSES RÉELLEMENT EFFECTUÉES (NON PRÉSUMÉES) */}
      <article
        className="employes-framed-card"
        style={{
          borderColor: activeTab === 'reelles' ? 'rgba(243, 199, 132, 0.68)' : undefined,
          cursor: 'pointer',
        }}
        onClick={() => {
          onSelectTab && onSelectTab('reelles')
          onSelectSubFilter && onSelectSubFilter('all')
        }}
      >
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={1} size={44} />
            <div>
              <strong style={{ fontSize: '1.35rem', color: '#F3C784' }}>
                {realPauses.length} <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Pauses réelles</span>
              </strong>
              <small style={{ display: 'block', fontWeight: 700, color: 'var(--pt-text)' }}>
                {formatDuree(realDurationMin)} · Non présumées
              </small>
            </div>
          </div>
        </div>

        <div className="employes-spline-chart-wrap" style={{ height: 64 }}>
          <svg viewBox="0 0 260 64" className="employes-spline-svg" aria-hidden="true">
            <defs>
              <linearGradient id="pause-kpi-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={splineCard1.areaPath} fill="url(#pause-kpi-gold)" />
            <path d={splineCard1.linePath} fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
            {splineCard1.pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r="2.8" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 2 : RÉELLES POINTÉES & VALIDÉES */}
      <article
        className="employes-framed-card"
        style={{
          borderColor: activeTab === 'reelles' && subFilter !== 'all' ? 'rgba(16, 185, 129, 0.65)' : undefined,
        }}
      >
        <div
          className="employes-framed-card-head"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            onSelectTab && onSelectTab('reelles')
            onSelectSubFilter && onSelectSubFilter('all')
          }}
        >
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={2} size={44} />
            <div>
              <strong style={{ fontSize: '1.35rem', color: '#34D399' }}>
                {realPauses.length} <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Réelles &amp; Validées</span>
              </strong>
              <small style={{ display: 'block' }}>
                {pointeeCount} pointée(s) · {adminCount} admin
              </small>
            </div>
          </div>
        </div>

        <select
          className="employes-card-select-box"
          aria-label="Filtrer les pauses réellement effectuées"
          value={
            ['reelles_pointees', 'reelles_admin', 'reelles_planifiees', 'reelles_hors_planning'].includes(subFilter)
              ? subFilter
              : 'all'
          }
          onChange={(e) => {
            onSelectTab && onSelectTab('reelles')
            onSelectSubFilter && onSelectSubFilter(e.target.value)
          }}
          style={{ marginTop: 4, marginBottom: 4 }}
        >
          <option value="all">✓ Toutes les pauses réelles ({realPauses.length})</option>
          <option value="reelles_pointees">📱 Pointées par l’employé ({pointeeCount})</option>
          <option value="reelles_admin">🛡️ Saisies par l’admin ({adminCount})</option>
          <option value="reelles_planifiees">📅 Planifiées ({Math.max(0, realPauses.length - unplannedRealPauses.length)})</option>
          <option value="reelles_hors_planning">⚡ Hors planning ({unplannedRealPauses.length})</option>
        </select>

        <div className="employes-spline-chart-wrap" style={{ height: 48 }}>
          <svg viewBox="0 0 260 64" className="employes-spline-svg" aria-hidden="true">
            <defs>
              <linearGradient id="pause-kpi-emerald" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={splineCard2.areaPath} fill="url(#pause-kpi-emerald)" />
            <path d={splineCard2.linePath} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
            {splineCard2.pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r="2.8" fill="#A7F3D0" stroke="#059669" strokeWidth="1.2" />
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 3 : EN PAUSE EN DIRECT & HORS PLANNING */}
      <article
        className="employes-framed-card"
        style={{
          borderColor: subFilter === 'en_direct' ? 'rgba(245, 158, 11, 0.7)' : undefined,
          cursor: 'pointer',
        }}
        onClick={() => {
          onSelectTab && onSelectTab('reelles')
          onSelectSubFilter && onSelectSubFilter(subFilter === 'en_direct' ? 'all' : 'en_direct')
        }}
      >
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={3} size={44} />
            <div>
              <strong style={{ fontSize: '1.35rem', color: '#FBBF24' }}>
                {openPauses.length} <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>En pause en direct</span>
              </strong>
              <small style={{ display: 'block', color: openPauses.length > 0 ? '#FBBF24' : undefined, fontWeight: 700 }}>
                {openPauses.length > 0
                  ? `(⏱ ${liveTimerSample}) · ${unplannedRealPauses.length} hors planning`
                  : `${unplannedRealPauses.length} pause(s) réelle(s) hors planning`}
              </small>
            </div>
          </div>
        </div>

        <div className="employes-spline-chart-wrap" style={{ height: 64 }}>
          <svg viewBox="0 0 260 64" className="employes-spline-svg" aria-hidden="true">
            <defs>
              <linearGradient id="pause-kpi-amber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={splineCard3.areaPath} fill="url(#pause-kpi-amber)" />
            <path d={splineCard3.linePath} fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
            {splineCard3.pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r="2.8" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 4 : PAUSES PRÉSUMÉES À STATUER & ANOMALIES */}
      <article
        className="employes-framed-card"
        style={{
          borderColor: activeTab === 'presumees' || activeTab === 'anomalies' ? 'rgba(239, 68, 68, 0.65)' : undefined,
        }}
      >
        <div
          className="employes-framed-card-head"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            onSelectTab && onSelectTab('presumees')
            onSelectSubFilter && onSelectSubFilter('all')
          }}
        >
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={4} size={44} />
            <div>
              <strong style={{ fontSize: '1.35rem', color: '#F87171' }}>
                {presumedPending.length} <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Présumées à statuer</span>
              </strong>
              <small style={{ display: 'block' }}>
                · {anomaliesPauses.length} Anomalie{anomaliesPauses.length > 1 ? 's' : ''} ({presumedPauses.length} présumée{presumedPauses.length > 1 ? 's' : ''} au total)
              </small>
            </div>
          </div>
        </div>

        <select
          className="employes-card-select-box"
          aria-label="Filtrer les pauses présumées et anomalies"
          value={
            ['presumees_a_statuer', 'presumees_toutes', 'presumees_validees', 'anomalies_toutes', 'anomalie_sans_reprise', 'anomalie_trop_longue'].includes(subFilter)
              ? subFilter
              : 'presumees_a_statuer'
          }
          onChange={(e) => {
            const val = e.target.value
            if (val.startsWith('anomalie')) {
              onSelectTab && onSelectTab('anomalies')
            } else {
              onSelectTab && onSelectTab('presumees')
            }
            onSelectSubFilter && onSelectSubFilter(val)
          }}
          style={{ marginTop: 4, marginBottom: 4 }}
        >
          <option value="presumees_a_statuer">⏳ Présumées à statuer ({presumedPending.length})</option>
          <option value="presumees_toutes">📋 Toutes les pauses présumées ({presumedPauses.length})</option>
          <option value="presumees_validees">✓ Présumées validées ({presumedValidated.length})</option>
          <option value="anomalies_toutes">⚠️ Toutes les anomalies ({anomaliesPauses.length})</option>
          <option value="anomalie_sans_reprise">🚫 Sans reprise ({paies.filter((p) => p.anomalie === 'sans_reprise').length})</option>
          <option value="anomalie_trop_longue">⚠️ Très longue ({paies.filter((p) => p.anomalie === 'trop_longue').length})</option>
        </select>

        <div className="employes-spline-chart-wrap" style={{ height: 48 }}>
          <svg viewBox="0 0 260 64" className="employes-spline-svg" aria-hidden="true">
            <defs>
              <linearGradient id="pause-kpi-coral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={splineCard4.areaPath} fill="url(#pause-kpi-coral)" />
            <path d={splineCard4.linePath} fill="none" stroke="#F87171" strokeWidth="2.2" strokeLinecap="round" />
            {splineCard4.pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r="2.8" fill="#FECACA" stroke="#DC2626" strokeWidth="1.2" />
            ))}
          </svg>
        </div>
      </article>
    </section>
  )
}

export function PausesAnalyticsCharts({ paies = [], onSelectTab }) {
  // Calcul 100 % réel heure par heure (00h–23h) séparant Pauses Réelles (non présumées) et Pauses Présumées
  const { realByHour, presumedByHour, maxHourly } = useMemo(() => {
    const r = Array(24).fill(0)
    const pr = Array(24).fill(0)

    for (const p of paies) {
      if (p.statut === 'ecartee') continue
      let hour = null
      if (p.debutISO) {
        const parts = getHeuresMinutesLocales(p.debutISO)
        if (parts && Number.isFinite(parts.heures)) hour = parts.heures
      }
      if (hour === null && p.debutHHMM && /^\d{2}:\d{2}/.test(p.debutHHMM)) {
        hour = parseInt(p.debutHHMM.slice(0, 2), 10)
      }
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue

      if (estPauseReelleEffectuee(p)) {
        r[hour] += 1
      } else if (estPausePresumee(p)) {
        pr[hour] += 1
      }
    }

    // Regroupement en 12 points horaires (00h, 02h, ..., 22h) pour une courbe lisse lisible
    const rPoints = []
    const prPoints = []
    for (let h = 0; h < 24; h += 2) {
      rPoints.push(r[h] + (r[h + 1] || 0))
      prPoints.push(pr[h] + (pr[h + 1] || 0))
    }

    const maxVal = Math.max(2, ...rPoints, ...prPoints)
    return { realByHour: rPoints, presumedByHour: prPoints, maxHourly: maxVal }
  }, [paies])

  const realCurve = useMemo(() => build24hCurveGeometry(realByHour, maxHourly), [realByHour, maxHourly])
  const presumedCurve = useMemo(() => build24hCurveGeometry(presumedByHour, maxHourly), [presumedByHour, maxHourly])

  const yTicks = useMemo(() => {
    return [
      { val: maxHourly, y: 24 },
      { val: Math.round(maxHourly * 0.75), y: 53 },
      { val: Math.round(maxHourly * 0.5), y: 83 },
      { val: Math.round(maxHourly * 0.25), y: 112 },
      { val: 0, y: 142 },
    ]
  }, [maxHourly])

  // Donut : Répartition entre Pauses réelles (non présumées), Pauses présumées et Pauses en direct
  const donutStats = useMemo(() => {
    const active = paies.filter((p) => p.statut !== 'ecartee')
    const realClosed = active.filter((p) => estPauseReelleEffectuee(p) && !p.ouverte).length
    const realOpen = active.filter((p) => estPauseReelleEffectuee(p) && p.ouverte).length
    const presumed = active.filter((p) => estPausePresumee(p)).length
    const totalReal = realClosed + realOpen
    const grandTotal = Math.max(1, totalReal + presumed)

    const realPct = active.length > 0 ? Math.round((totalReal / grandTotal) * 100) : 0
    const presumedPct = active.length > 0 ? Math.round((presumed / grandTotal) * 100) : 0
    const openPct = active.length > 0 ? Math.round((realOpen / grandTotal) * 100) : 0

    return {
      totalActive: active.length,
      totalReal,
      realClosed,
      realOpen,
      presumed,
      realPct,
      presumedPct,
      openPct,
      grandTotal,
    }
  }, [paies])

  const circumference = 2 * Math.PI * 44
  const realClosedArc = (donutStats.realClosed / donutStats.grandTotal) * circumference
  const presumedArc = (donutStats.presumed / donutStats.grandTotal) * circumference
  const openArc = (donutStats.realOpen / donutStats.grandTotal) * circumference

  return (
    <section
      aria-label="Graphiques analytiques des pauses"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.85fr) minmax(290px, 1fr)',
        gap: 16,
        marginBottom: 18,
      }}
    >
      {/* GRAPHIQUE 1 : ACTIVITÉ DES PAUSES — 24 HEURES (RÉELLES NON PRÉSUMÉES VS PRÉSUMÉES) */}
      <article className="employes-framed-card employes-chart-box" style={{ padding: '16px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <h3 className="employes-chart-box-title" style={{ margin: 0 }}>
            Activité des pauses — 24 heures
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.78rem', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34D399' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              Réelles pointées (non présumées)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#F87171' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E07A5F', display: 'inline-block' }} />
              Présumées (grille horaire)
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 600 168"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label="Courbe 24 heures distinguant les pauses réelles pointées et les pauses présumées"
        >
          <defs>
            <linearGradient id="pauses-24h-emerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.36" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="pauses-24h-coral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#E07A5F" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Zones de nuit 00h–06h et 18h–23h */}
          <rect
            x="38"
            y="18"
            width="148"
            height="124"
            rx="6"
            fill="rgba(124, 92, 252, 0.14)"
            stroke="rgba(167, 139, 250, 0.28)"
            strokeDasharray="3 3"
          />
          <rect
            x="434"
            y="18"
            width="148"
            height="124"
            rx="6"
            fill="rgba(124, 92, 252, 0.14)"
            stroke="rgba(167, 139, 250, 0.28)"
            strokeDasharray="3 3"
          />
          <text x="112" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="#C4B5FD">
            Nuit
          </text>
          <text x="508" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="#C4B5FD">
            Nuit
          </text>

          {/* Grille horizontale */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <text x="14" y={t.y + 3} fontSize="9.5" fill="currentColor" opacity="0.65">
                {t.val}
              </text>
              <line
                x1="38"
                y1={t.y}
                x2="582"
                y2={t.y}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="3 3"
              />
            </g>
          ))}

          {/* Courbe Pauses Présumées */}
          <path d={presumedCurve.areaPath} fill="url(#pauses-24h-coral)" />
          <path
            d={presumedCurve.linePath}
            fill="none"
            stroke="#E07A5F"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {presumedCurve.coords.map((pt, idx) => (
            <circle key={`pr-${idx}`} cx={pt.x} cy={pt.y} r="3.2" fill="#FECACA" stroke="#E07A5F" strokeWidth="1.5">
              <title>{`${String(idx * 2).padStart(2, '0')}h · ${pt.v} pause(s) présumée(s)`}</title>
            </circle>
          ))}

          {/* Courbe Pauses Réelles (Non présumées) */}
          <path d={realCurve.areaPath} fill="url(#pauses-24h-emerald)" />
          <path
            d={realCurve.linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          {realCurve.coords.map((pt, idx) => (
            <circle key={`re-${idx}`} cx={pt.x} cy={pt.y} r="3.4" fill="#A7F3D0" stroke="#059669" strokeWidth="1.5">
              <title>{`${String(idx * 2).padStart(2, '0')}h · ${pt.v} pause(s) réelle(s) pointée(s)`}</title>
            </circle>
          ))}

          {/* Repères horaires X */}
          {['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h', '23h'].map((lbl, idx, arr) => {
            const x = Math.round(38 + (idx * (582 - 38)) / (arr.length - 1))
            return (
              <text
                key={lbl}
                x={x}
                y="159"
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="currentColor"
                opacity="0.72"
              >
                {lbl}
              </text>
            )
          })}
        </svg>
      </article>

      {/* GRAPHIQUE 2 : RÉPARTITION DES PAUSES (DONUT 0–100 %) */}
      <article className="employes-framed-card employes-chart-box" style={{ padding: '16px 18px' }}>
        <h3 className="employes-chart-box-title" style={{ margin: '0 0 10px' }}>
          Répartition des pauses
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 14,
            flexWrap: 'wrap',
            marginTop: 6,
          }}
        >
          <div style={{ position: 'relative', width: 136, height: 136 }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }} aria-hidden="true">
              <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="15" />
              {realClosedArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="15"
                  strokeDasharray={`${realClosedArc} ${circumference}`}
                  transform="rotate(-90 60 60)"
                />
              )}
              {presumedArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#E07A5F"
                  strokeWidth="15"
                  strokeDasharray={`${presumedArc} ${circumference}`}
                  strokeDashoffset={-realClosedArc}
                  transform="rotate(-90 60 60)"
                />
              )}
              {openArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="15"
                  strokeDasharray={`${openArc} ${circumference}`}
                  strokeDashoffset={-(realClosedArc + presumedArc)}
                  transform="rotate(-90 60 60)"
                />
              )}
            </svg>
            <div className="pointages-donut-center">
              <strong style={{ fontSize: '1.35rem' }}>{donutStats.realPct}%</strong>
              <span style={{ color: '#34D399', fontWeight: 700 }}>Réelles</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.82rem' }}>
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('reelles')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--pt-text)',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              <span>
                <strong>{donutStats.totalReal}</strong> Réelles · {donutStats.realPct}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('presumees')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--pt-text)',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E07A5F', display: 'inline-block' }} />
              <span>
                <strong>{donutStats.presumed}</strong> Présumées · {donutStats.presumedPct}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('reelles')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--pt-text)',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
              <span>
                <strong>{donutStats.realOpen}</strong> En direct · {donutStats.openPct}%
              </span>
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
  activeTab = 'reelles',
  subFilter = 'all',
  searchTerm = '',
  onSearchChange,
  onSelectTab,
  onSelectSubFilter,
  onStatuer,
  onOpenEmployeeFiche,
  onOpenPointages,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  const hasOpenPause = useMemo(() => paies.some((p) => p.ouverte), [paies])

  useEffect(() => {
    if (!hasOpenPause) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasOpenPause])

  // Séparation stricte :
  // 1) Historique des pauses réellement effectuées (non présumées)
  // 2) Pauses présumées (créneau de la grille horaire, non pointées)
  // 3) Anomalies
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const presumedPauses = useMemo(() => paies.filter((p) => estPausePresumee(p)), [paies])
  const presumedPending = useMemo(() => presumedPauses.filter((p) => p.statut === 'presumee'), [presumedPauses])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])

  const filteredList = useMemo(() => {
    let base = []
    if (activeTab === 'reelles') {
      base = realPauses
      if (subFilter === 'reelles_pointees') base = base.filter((p) => p.source === 'pointee')
      else if (subFilter === 'reelles_admin') base = base.filter((p) => p.source === 'admin')
      else if (subFilter === 'reelles_planifiees') base = base.filter((p) => !p.estNonPlanifiee)
      else if (subFilter === 'reelles_hors_planning') base = base.filter((p) => p.estNonPlanifiee)
      else if (subFilter === 'en_direct') base = base.filter((p) => p.ouverte)
    } else if (activeTab === 'presumees') {
      base = presumedPauses
      if (subFilter === 'presumees_a_statuer') base = base.filter((p) => p.statut === 'presumee')
      else if (subFilter === 'presumees_validees') base = base.filter((p) => p.statut === 'validee')
      else if (subFilter === 'presumees_ecartees') base = base.filter((p) => p.statut === 'ecartee')
      else base = base.filter((p) => p.statut !== 'ecartee')
    } else if (activeTab === 'anomalies') {
      base = anomaliesPauses
      if (subFilter === 'anomalie_sans_reprise') base = base.filter((p) => p.anomalie === 'sans_reprise')
      else if (subFilter === 'anomalie_trop_longue') base = base.filter((p) => p.anomalie === 'trop_longue')
    } else {
      base = paies.filter((p) => p.statut !== 'ecartee')
    }

    const q = String(searchTerm || '').trim().toLowerCase()
    if (!q) return base
    return base.filter((p) => {
      const hay = `${p.employe || ''} ${p.matricule || ''} ${p.entreprise_nom || ''} ${p.motif || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [activeTab, subFilter, realPauses, presumedPauses, anomaliesPauses, paies, searchTerm])

  const sectionTitle =
    activeTab === 'reelles'
      ? 'Historique des pauses réellement effectuées (non présumées)'
      : activeTab === 'presumees'
        ? 'Pauses présumées par la grille horaire (non pointées)'
        : activeTab === 'anomalies'
          ? 'Anomalies de pause à contrôler'
          : 'Registre complet (Pauses réelles + Présumées)'

  return (
    <section aria-label="Pauses des collaborateurs" style={{ marginTop: 6 }}>
      {/* En-tête de section + Onglets de séparation Réelles vs Présumées */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800 }}>
            Pauses des collaborateurs
          </h2>
          <span
            style={{
              background: 'rgba(243, 199, 132, 0.16)',
              border: '1px solid rgba(243, 199, 132, 0.38)',
              color: '#F3C784',
              borderRadius: 8,
              padding: '2px 9px',
              fontSize: '0.8rem',
              fontWeight: 800,
            }}
          >
            {filteredList.length}
          </span>
        </div>

        {/* Onglets distinguant explicitement Pauses réelles (non présumées) et Pauses présumées */}
        <div
          role="tablist"
          aria-label="Filtrer par nature de pause"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reelles'}
            onClick={() => {
              onSelectTab && onSelectTab('reelles')
              onSelectSubFilter && onSelectSubFilter('all')
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: activeTab === 'reelles' ? '1px solid #10B981' : '1px solid rgba(243, 199, 132, 0.22)',
              background: activeTab === 'reelles' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(243, 199, 132, 0.05)',
              color: activeTab === 'reelles' ? '#34D399' : 'var(--pt-text)',
            }}
          >
            <CheckCircle2 size={14} />
            <span>Historique · Pauses réelles ({realPauses.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'presumees'}
            onClick={() => {
              onSelectTab && onSelectTab('presumees')
              onSelectSubFilter && onSelectSubFilter('all')
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: activeTab === 'presumees' ? '1px solid #F59E0B' : '1px solid rgba(243, 199, 132, 0.22)',
              background: activeTab === 'presumees' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(243, 199, 132, 0.05)',
              color: activeTab === 'presumees' ? '#FBBF24' : 'var(--pt-text)',
            }}
          >
            <Clock size={14} />
            <span>Pauses présumées ({presumedPauses.filter((p) => p.statut !== 'ecartee').length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'anomalies'}
            onClick={() => {
              onSelectTab && onSelectTab('anomalies')
              onSelectSubFilter && onSelectSubFilter('anomalies_toutes')
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: activeTab === 'anomalies' ? '1px solid #EF4444' : '1px solid rgba(243, 199, 132, 0.22)',
              background: activeTab === 'anomalies' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(243, 199, 132, 0.05)',
              color: activeTab === 'anomalies' ? '#F87171' : 'var(--pt-text)',
            }}
          >
            <AlertTriangle size={14} />
            <span>Anomalies ({anomaliesPauses.length})</span>
          </button>

          {/* Recherche rapide */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(243, 199, 132, 0.06)',
              border: '1px solid rgba(243, 199, 132, 0.24)',
              borderRadius: 999,
              padding: '6px 12px',
            }}
          >
            <Search size={14} style={{ opacity: 0.7 }} />
            <input
              type="search"
              placeholder="Collaborateur, matricule…"
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--pt-text)',
                fontSize: '0.8rem',
                width: 170,
              }}
            />
          </label>
        </div>
      </div>

      {/* Bandeau d'explication contextuelle + action en lot pour les présumées */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          marginBottom: 12,
          borderRadius: 12,
          background:
            activeTab === 'reelles'
              ? 'rgba(16, 185, 129, 0.08)'
              : activeTab === 'presumees'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(239, 68, 68, 0.09)',
          border:
            activeTab === 'reelles'
              ? '1px solid rgba(16, 185, 129, 0.28)'
              : activeTab === 'presumees'
                ? '1px solid rgba(245, 158, 11, 0.32)'
                : '1px solid rgba(239, 68, 68, 0.28)',
          fontSize: '0.8rem',
        }}
      >
        <div>
          <strong style={{ marginRight: 6 }}>{sectionTitle} :</strong>
          {activeTab === 'reelles' ? (
            <span>
              Cet historique ne contient <strong>que les pauses réellement effectuées (non présumées)</strong>. Les pauses présumées par la grille horaire en sont exclues.
            </span>
          ) : activeTab === 'presumees' ? (
            <span>
              Ces pauses sont <strong>présumées à partir de la grille horaire</strong> (aucune pause réelle pointée par l’employé). Validez-les ou écartez-les.
            </span>
          ) : (
            <span>
              Pauses ouvertes sans reprise ou dépassant la durée maximale autorisée.
            </span>
          )}
        </div>

        {activeTab === 'presumees' && presumedPending.length > 1 && onStatuer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => onStatuer(presumedPending.map((p) => p.id), 'valider')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34D399',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <CheckCircle2 size={13} />
              <span>Valider les {presumedPending.length} présumées</span>
            </button>
            <button
              type="button"
              onClick={() => onStatuer(presumedPending.map((p) => p.id), 'ecarter')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#F87171',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <XCircle size={13} />
              <span>Écarter les {presumedPending.length} présumées</span>
            </button>
          </div>
        )}
      </div>

      {/* Liste des cartes collaborateurs */}
      {filteredList.length === 0 ? (
        <div
          className="employes-framed-card"
          style={{
            textAlign: 'center',
            padding: '44px 20px',
          }}
        >
          <Coffee size={36} color="#F3C784" style={{ opacity: 0.75, marginBottom: 8 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '1.02rem', fontWeight: 800 }}>
            {activeTab === 'reelles'
              ? 'Aucune pause réellement effectuée sur cette période'
              : activeTab === 'presumees'
                ? 'Aucune pause présumée sur cette période'
                : 'Aucune anomalie de pause sur cette période'}
          </h3>
          <p style={{ margin: '0 auto', maxWidth: 520, fontSize: '0.82rem', opacity: 0.78, lineHeight: 1.55 }}>
            {activeTab === 'reelles' ? (
              presumedPauses.length > 0 ? (
                <>
                  Aucun collaborateur n’a pointé de pause réelle sur la période sélectionnée.{' '}
                  <strong>{presumedPauses.length} pause(s) présumée(s)</strong> par la grille horaire sont disponibles dans l’onglet{' '}
                  <button
                    type="button"
                    onClick={() => onSelectTab && onSelectTab('presumees')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FBBF24',
                      fontWeight: 800,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Pauses présumées
                  </button>
                  .
                </>
              ) : (
                'Seules les pauses réellement pointées par les collaborateurs (ou enregistrées par l’administrateur) figurent dans cet historique.'
              )
            ) : (
              'Aucune ligne ne correspond aux filtres sélectionnés.'
            )}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredList.map((p) => {
            const empObj = employesById[p.employe_id] || null
            const initials = (p.employe || 'EC')
              .split(' ')
              .filter(Boolean)
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
            const anomalie = badgeAnomalie(p.anomalie)
            const isPresumed = estPausePresumee(p)
            const isReal = estPauseReelleEffectuee(p)

            return (
              <article
                key={p.id}
                className="employes-framed-card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px, 1.25fr) minmax(200px, 1.15fr) minmax(210px, 1.3fr) auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                }}
              >
                {/* Colonne 1 : Collaborateur (Avatar + Nom + Matricule) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1.5px solid rgba(243, 199, 132, 0.42)',
                      background: 'rgba(243, 199, 132, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      color: '#F3C784',
                    }}
                  >
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

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.employe || 'Collaborateur'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                      {p.matricule && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 7px',
                            borderRadius: 6,
                            background: 'rgba(243, 199, 132, 0.1)',
                            border: '1px solid rgba(243, 199, 132, 0.25)',
                            color: 'var(--pt-text)',
                          }}
                        >
                          {p.matricule}
                        </span>
                      )}
                      <span style={{ fontSize: '0.73rem', opacity: 0.72 }}>
                        {p.jour}{p.entreprise_nom ? ` · ${p.entreprise_nom}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Colonne 2 : Créneau horaire ou Chronomètre en direct */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {p.ouverte ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#F59E0B',
                        fontWeight: 900,
                        fontSize: '1.14rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      <Timer size={20} color="#F59E0B" />
                      <span>En cours : {formaterTempsPauseEnDirect(p, nowMs)}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.22rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                        {p.debutHHMM} <span style={{ opacity: 0.55, margin: '0 2px' }}>→</span> {p.finHHMM || '--:--'}
                      </strong>
                      <span style={{ fontSize: '0.84rem', opacity: 0.78, fontWeight: 700 }}>
                        ({formatDuree(p.dureeMinutes)})
                      </span>
                    </div>
                  )}
                </div>

                {/* Colonne 3 : Badges de nature (Pause réelle non présumée vs Pause présumée + Hors planning + Anomalie) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {isReal && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 12px',
                        borderRadius: 999,
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        background: 'rgba(16, 185, 129, 0.16)',
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        color: '#34D399',
                      }}
                    >
                      {p.natureLabel || '✓ Pause réelle pointée'}
                    </span>
                  )}

                  {isPresumed && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 12px',
                        borderRadius: 999,
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        background: p.statut === 'validee' ? 'rgba(59, 130, 246, 0.16)' : 'rgba(224, 122, 95, 0.18)',
                        border: p.statut === 'validee' ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(224, 122, 95, 0.5)',
                        color: p.statut === 'validee' ? '#60A5FA' : '#FDBA74',
                      }}
                    >
                      {p.statut === 'validee'
                        ? '✓ Pause présumée validée'
                        : '⏳ Pause présumée — à statuer'}
                    </span>
                  )}

                  {p.estNonPlanifiee && isReal && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: 'rgba(245, 158, 11, 0.16)',
                        border: '1px solid rgba(245, 158, 11, 0.42)',
                        color: '#FBBF24',
                      }}
                    >
                      ⚡ Hors planning
                    </span>
                  )}

                  {anomalie && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: 'rgba(239, 68, 68, 0.16)',
                        border: '1px solid rgba(239, 68, 68, 0.45)',
                        color: '#F87171',
                      }}
                    >
                      {anomalie.label}
                    </span>
                  )}

                  {p.motif && p.motif !== 'créneau de la grille' && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.75, fontStyle: 'italic' }}>
                      « {p.motif} »
                    </span>
                  )}
                </div>

                {/* Colonne 4 : Boutons d'action (Valider / Écarter / Fiche / Pointages) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {p.aStatuer && onStatuer && (
                    <>
                      <button
                        type="button"
                        onClick={() => onStatuer([p.id], 'valider')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 13px',
                          borderRadius: 999,
                          fontSize: '0.77rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.5)',
                          color: '#34D399',
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Valider</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onStatuer([p.id], 'ecarter')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 13px',
                          borderRadius: 999,
                          fontSize: '0.77rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          background: 'rgba(239, 68, 68, 0.18)',
                          border: '1px solid rgba(239, 68, 68, 0.48)',
                          color: '#F87171',
                        }}
                      >
                        <XCircle size={13} />
                        <span>Écarter</span>
                      </button>
                    </>
                  )}

                  {onOpenEmployeeFiche && empObj && (
                    <button
                      type="button"
                      onClick={() => onOpenEmployeeFiche(empObj)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        borderRadius: 999,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: 'rgba(243, 199, 132, 0.08)',
                        border: '1px solid rgba(243, 199, 132, 0.28)',
                        color: 'var(--pt-text)',
                      }}
                    >
                      <FileText size={13} />
                      <span>Fiche</span>
                    </button>
                  )}

                  {onOpenPointages && (
                    <button
                      type="button"
                      onClick={() => onOpenPointages(p)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        borderRadius: 999,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: 'rgba(243, 199, 132, 0.08)',
                        border: '1px solid rgba(243, 199, 132, 0.28)',
                        color: 'var(--pt-text)',
                      }}
                    >
                      <Clock size={13} />
                      <span>Pointages</span>
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
