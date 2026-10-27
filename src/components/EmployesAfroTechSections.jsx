import PageCulturalBand from './PageCulturalBand'
import PlanningPayslipBadge from './PlanningPayslipBadge'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  Key,
  Moon,
  Sun,
  Trash2,
  UserPlus,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import {
  WovenKenteBadgeSvg,
} from './AfroCulturalSvg'
import { formaterTempsPauseEnDirect } from '../services/pausesService'
import '../pages/PointagesAfroTech.css'

// Construit dynamiquement une courbe cubique lisse + aire fermée à partir de 5 valeurs réelles
function buildDynamicSplineGeometry(values = [0, 0, 0, 0, 0], maxValue = 1) {
  const safeMax = Math.max(1, maxValue)
  const xs = [34, 82, 130, 178, 226]
  const baseLine = 86
  const topLine = 18
  const span = baseLine - topLine

  const pts = xs.map((x, idx) => {
    const v = Math.max(0, Number(values[idx]) || 0)
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

  let peak = pts[0]
  for (const pt of pts) {
    if (pt.v > peak.v) peak = pt
  }

  return { pts, linePath, areaPath, peak, baseLine }
}

export function EmployesCulturalHero({
  darkMode = true,
  entreprises = [],
  selectedEnterpriseId = 'all',
  onSelectEnterprise,
  onToggleTheme,
  onBackDashboard,
  onAddEmployee,
}) {
  return (
    <header className="employes-concept-header" aria-label="En-tête Employés En-Check">
      <PageCulturalBand pathname="/employes"/>
      <div className="employes-concept-topbar">
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
          <EnCheckBrandMark size={44} />
          <div className="employes-concept-brand-text">
            <strong>En-Check · Employés</strong>
            <span>On gère !</span>
          </div>
        </div>

        <div className="employes-concept-center-col">
          <h1 className="employes-concept-center-title">Employés</h1>
        </div>

        <div className="employes-concept-actions">
          {entreprises.length > 1 && onSelectEnterprise && (
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

          {onAddEmployee && (
            <button
              type="button"
              className="employes-add-pill-btn"
              onClick={onAddEmployee}
            >
              <UserPlus size={15} />
              <span>+ Nouvel employé</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export function EmployesExecutiveKpis({
  employes = [],
  liveStatusByEmployee = {},
  plannings = [],
  categoryFilter = 'all',
  onCategoryFilterChange,
  onFilterSearch,
}) {
  const total = employes.length

  const contractCounts = useMemo(() => {
    let cdi = 0
    let cdd = 0
    let stage = 0
    let autres = 0
    for (const e of employes) {
      if (e.contract_type === 'CDI') cdi += 1
      else if (e.contract_type === 'CDD') cdd += 1
      else if (e.contract_type === 'Stage') stage += 1
      else autres += 1
    }
    return { cdi, cdd, stage, autres }
  }, [employes])

  const liveCounts = useMemo(() => {
    let enPoste = 0
    let enPause = 0
    let termine = 0
    let enConge = 0
    let nonPointe = 0
    let horsPlanningPauses = 0
    for (const e of employes) {
      const st = liveStatusByEmployee[e.id]
      if (!st || st.state === 'non_pointe') nonPointe += 1
      else if (st.state === 'en_pause') enPause += 1
      else if (st.state === 'en_poste') enPoste += 1
      else if (st.state === 'termine') termine += 1
      else if (st.state === 'en_conge') enConge += 1
      if (st?.unplannedPausesCount > 0) horsPlanningPauses += st.unplannedPausesCount
    }
    return { enPoste, enPause, termine, enConge, nonPointe, horsPlanningPauses }
  }, [employes, liveStatusByEmployee])

  const enrollmentCounts = useMemo(() => {
    let portal = 0
    let machinePin = 0
    let toMigrate = 0
    for (const e of employes) {
      if (e.employee_portal_enabled && (e.user_id || e.password_hash)) portal += 1
      if (e.machine_pin) machinePin += 1
      if (e.password_hash && !e.user_id) toMigrate += 1
    }
    return { portal, machinePin, toMigrate }
  }, [employes])

  const scheduleCounts = useMemo(() => {
    let perso = 0
    let general = 0
    let libre = 0
    const hasDefaultByEnt = new Set(
      (plannings || []).filter((pl) => pl.is_default && pl.is_active !== false).map((pl) => pl.enterprise_id)
    )
    for (const e of employes) {
      const sched = e.employee_schedules?.[0]
      const entPlanningOn = e.enterprises?.module_planning !== false
      if (sched && (sched.use_custom_hours || sched.schedule_id)) perso += 1
      else if (entPlanningOn && hasDefaultByEnt.has(e.enterprise_id)) general += 1
      else libre += 1
    }
    return { perso, general, libre }
  }, [employes, plannings])

  // Courbes dynamiques calculées sur les vraies données RH
  const headcountSpline = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [contractCounts.cdi, contractCounts.cdd, contractCounts.stage, contractCounts.autres, total],
        Math.max(1, total)
      ),
    [contractCounts, total]
  )

  const scheduleSpline = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [scheduleCounts.perso, scheduleCounts.general, scheduleCounts.libre, enrollmentCounts.portal, enrollmentCounts.machinePin],
        Math.max(1, total)
      ),
    [scheduleCounts, enrollmentCounts, total]
  )

  const livePresenceSpline = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [liveCounts.enPoste, liveCounts.enPause, liveCounts.termine, liveCounts.enConge, liveCounts.nonPointe],
        Math.max(1, total)
      ),
    [liveCounts, total]
  )

  const livePauseSpline = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [liveCounts.enPause, liveCounts.horsPlanningPauses, liveCounts.enPoste, liveCounts.termine, liveCounts.enConge],
        Math.max(1, total)
      ),
    [liveCounts, total]
  )

  const headcountAxisLabels = [
    { label: 'CDI', val: contractCounts.cdi },
    { label: 'CDD', val: contractCounts.cdd },
    { label: 'Stage', val: contractCounts.stage },
    { label: 'Autres', val: contractCounts.autres },
    { label: 'Total', val: total },
  ]

  const liveAxisLabels = [
    { label: 'Poste', val: liveCounts.enPoste },
    { label: 'Pause', val: liveCounts.enPause },
    { label: 'Pointé', val: liveCounts.termine },
    { label: 'Congé', val: liveCounts.enConge },
    { label: 'Non pt.', val: liveCounts.nonPointe },
  ]

  const yAxisTicks = [total, Math.round(total * 0.75), Math.round(total * 0.5), 0]

  return (
    <section className="employes-top-cards-grid" aria-label="Indicateurs RH des employés">
      {/* CARTE 1 : EFFECTIF ACTIF (COURBE DYNAMIQUE BASÉE SUR LES VRAIS CONTRATS) */}
      <article
        className="employes-framed-card"
        onClick={() => {
          if (onCategoryFilterChange) onCategoryFilterChange('all')
          if (onFilterSearch) onFilterSearch('')
        }}
      >
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={1} size={46} />
            <div>
              <strong>Effectif<br />Actif ({total})</strong>
              <small>{contractCounts.cdi} CDI · {contractCounts.cdd} CDD · {contractCounts.stage} Stage</small>
            </div>
          </div>
          <span className="employes-circle-chevron"><ChevronDown size={15} /></span>
        </div>

        <div className="employes-spline-chart-wrap">
          <svg viewBox="0 0 260 112" className="employes-spline-svg" aria-label="Courbe de répartition de l'effectif actif">
            <defs>
              <linearGradient id="emp-spline-copper" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E38B42" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#E38B42" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {[18, 40, 63, 86].map((y, idx) => (
              <g key={y}>
                <text x="4" y={y + 3} fontSize="8.5" fill="currentColor" opacity="0.58">
                  {yAxisTicks[idx]}
                </text>
                <line x1="26" y1={y} x2="248" y2={y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
              </g>
            ))}
            <path d={headcountSpline.areaPath} fill="url(#emp-spline-copper)" />
            <path
              d={scheduleSpline.linePath}
              fill="none"
              stroke="#C49A52"
              strokeWidth="1.7"
              strokeOpacity="0.82"
            />
            <path
              d={headcountSpline.linePath}
              fill="none"
              stroke="#E68A3E"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {total > 0 && (
              <>
                <line
                  x1={headcountSpline.peak.x}
                  y1={headcountSpline.peak.y}
                  x2={headcountSpline.peak.x}
                  y2={headcountSpline.baseLine}
                  stroke="#F4D078"
                  strokeWidth="1.4"
                  strokeDasharray="2 2"
                />
                <g transform={`translate(${headcountSpline.peak.x}, ${headcountSpline.peak.y})`} stroke="#F4D078" strokeWidth="1.6">
                  <line x1="-5" y1="0" x2="5" y2="0" />
                  <line x1="0" y1="-5" x2="0" y2="5" />
                  <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" />
                  <line x1="-3.5" y1="3.5" x2="3.5" y2="-3.5" />
                </g>
              </>
            )}
            {headcountAxisLabels.map((item, idx) => (
              <text
                key={item.label}
                x={34 + idx * 48}
                y="104"
                textAnchor="middle"
                fontSize="8.5"
                fill="currentColor"
                opacity="0.68"
              >
                {`${item.label}(${item.val})`}
              </text>
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 2 : EN POSTE & EN PAUSE EN DIRECT (COURBE DYNAMIQUE BASÉE SUR L'ÉTAT RÉEL DU JOUR) */}
      <article
        className="employes-framed-card"
        onClick={() => {
          if (onCategoryFilterChange) onCategoryFilterChange(categoryFilter === 'live_on_duty' ? 'all' : 'live_on_duty')
        }}
      >
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={2} size={46} />
            <div>
              <strong>En Poste & En<br />Pause en Direct</strong>
              <small>
                {liveCounts.enPoste + liveCounts.termine} présents · {liveCounts.enPause} en pause · {liveCounts.nonPointe} non pointés
              </small>
            </div>
          </div>
          <span className="employes-circle-chevron"><ChevronDown size={15} /></span>
        </div>

        <div className="employes-spline-chart-wrap">
          <svg viewBox="0 0 260 112" className="employes-spline-svg" aria-label="Courbe de présence et pauses en direct">
            <defs>
              <linearGradient id="emp-spline-emerald" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2CC974" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2CC974" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {[18, 40, 63, 86].map((y, idx) => (
              <g key={y}>
                <text x="4" y={y + 3} fontSize="8.5" fill="currentColor" opacity="0.58">
                  {yAxisTicks[idx]}
                </text>
                <line x1="26" y1={y} x2="248" y2={y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
              </g>
            ))}
            <path d={livePresenceSpline.areaPath} fill="url(#emp-spline-emerald)" />
            <path
              d={livePresenceSpline.linePath}
              fill="none"
              stroke="#32C48D"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <path
              d={livePauseSpline.linePath}
              fill="none"
              stroke="#E68A3E"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {total > 0 && (
              <>
                <line
                  x1={livePresenceSpline.peak.x}
                  y1={livePresenceSpline.peak.y}
                  x2={livePresenceSpline.peak.x}
                  y2={livePresenceSpline.baseLine}
                  stroke="#32C48D"
                  strokeWidth="1.4"
                  strokeDasharray="2 2"
                />
                <g transform={`translate(${livePresenceSpline.peak.x}, ${livePresenceSpline.peak.y})`} stroke="#32C48D" strokeWidth="1.7">
                  <line x1="-5" y1="0" x2="5" y2="0" />
                  <line x1="0" y1="-5" x2="0" y2="5" />
                  <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" />
                  <line x1="-3.5" y1="3.5" x2="3.5" y2="-3.5" />
                </g>
              </>
            )}
            {liveAxisLabels.map((item, idx) => (
              <text
                key={item.label}
                x={34 + idx * 48}
                y="104"
                textAnchor="middle"
                fontSize="8.5"
                fill="currentColor"
                opacity="0.68"
              >
                {`${item.label}(${item.val})`}
              </text>
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 3 : BADGES QR, PIN & PORTAIL (VRAI MENU DÉROULANT DE FILTRE) */}
      <article className="employes-framed-card">
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={3} size={46} />
            <div>
              <strong>Badges QR,<br />PIN & Portail</strong>
              <small>{enrollmentCounts.portal}/{total} portails actifs</small>
            </div>
          </div>
          <span className="employes-circle-chevron"><ChevronDown size={15} /></span>
        </div>

        <select
          className="employes-card-select-box"
          aria-label="Filtrer par équipement et portail"
          value={
            ['portal_active', 'portal_migrate', 'machine_pin', 'no_machine_pin'].includes(categoryFilter)
              ? categoryFilter
              : 'all'
          }
          onChange={(e) => onCategoryFilterChange && onCategoryFilterChange(e.target.value)}
        >
          <option value="all">Tous les équipements ({total})</option>
          <option value="portal_active">🔑 Portail Employé actif ({enrollmentCounts.portal})</option>
          <option value="portal_migrate">⚠️ À migrer vers nouveau portail ({enrollmentCounts.toMigrate})</option>
          <option value="machine_pin">📻 Avec N° Pointeuse ({enrollmentCounts.machinePin})</option>
          <option value="no_machine_pin">⚪ Sans N° Pointeuse ({Math.max(0, total - enrollmentCounts.machinePin)})</option>
        </select>

        <div className="employes-card-mini-pills">
          <span onClick={() => onCategoryFilterChange && onCategoryFilterChange('all')} style={{ cursor: 'pointer' }}>
            ✓ {total} Badges QR
          </span>
          <span onClick={() => onCategoryFilterChange && onCategoryFilterChange('portal_active')} style={{ cursor: 'pointer' }}>
            🔑 {enrollmentCounts.portal} Portail
          </span>
          <span onClick={() => onCategoryFilterChange && onCategoryFilterChange('machine_pin')} style={{ cursor: 'pointer' }}>
            📻 {enrollmentCounts.machinePin} Pointeuse
          </span>
        </div>
      </article>

      {/* CARTE 4 : PLANNINGS & CONTRATS (VRAI MENU DÉROULANT DE FILTRE) */}
      <article className="employes-framed-card">
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={4} size={46} />
            <div>
              <strong>Plannings<br />& Contrats</strong>
              <small>{scheduleCounts.perso + scheduleCounts.general} planifiés · {scheduleCounts.libre} libres</small>
            </div>
          </div>
          <span className="employes-circle-chevron"><ChevronDown size={15} /></span>
        </div>

        <select
          className="employes-card-select-box"
          aria-label="Filtrer par planning ou type de contrat"
          value={
            ['sched_personal', 'sched_general', 'sched_free', 'contract_CDI', 'contract_CDD', 'contract_other'].includes(categoryFilter)
              ? categoryFilter
              : 'all'
          }
          onChange={(e) => onCategoryFilterChange && onCategoryFilterChange(e.target.value)}
        >
          <option value="all">Tous les plannings & contrats ({total})</option>
          <option value="sched_personal">📅 Planning personnalisé ({scheduleCounts.perso})</option>
          <option value="sched_general">🏢 Planning général ({scheduleCounts.general})</option>
          <option value="sched_free">⏱️ Planning non disponible dans En-Check ({scheduleCounts.libre})</option>
          <option value="contract_CDI">📄 Contrat CDI ({contractCounts.cdi})</option>
          <option value="contract_CDD">📄 Contrat CDD ({contractCounts.cdd})</option>
          <option value="contract_other">📄 Stage / Autre ({contractCounts.stage + contractCounts.autres})</option>
        </select>

        <div className="employes-card-mini-pills">
          <span onClick={() => onCategoryFilterChange && onCategoryFilterChange('contract_CDI')} style={{ cursor: 'pointer' }}>
            {contractCounts.cdi} CDI
          </span>
          <span onClick={() => onCategoryFilterChange && onCategoryFilterChange('contract_CDD')} style={{ cursor: 'pointer' }}>
            {contractCounts.cdd} CDD
          </span>
          <span onClick={() => onCategoryFilterChange && onCategoryFilterChange('sched_free')} style={{ cursor: 'pointer' }}>
            {scheduleCounts.libre} Sans planning En-Check
          </span>
        </div>
      </article>
    </section>
  )
}

export function EmployesAnalyticsCharts({
  employes = [],
  plannings = [],
  onSelectDepartment,
}) {
  const total = employes.length

  // Zéro faux département inventé : uniquement les vrais départements/postes des employés
  const deptBuckets = useMemo(() => {
    if (!employes.length) {
      return [{ label: 'Aucun employé', count: 0, isFallback: true }]
    }
    const map = new Map()
    for (const e of employes) {
      const raw = (e.department || e.position || '').trim()
      const label = raw || 'Non renseigné'
      map.set(label, (map.get(label) || 0) + 1)
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count, isFallback: label === 'Non renseigné' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [employes])

  const maxDept = useMemo(
    () => Math.max(1, ...deptBuckets.map((d) => d.count)),
    [deptBuckets]
  )

  const { equippedCount, coverageRatio } = useMemo(() => {
    if (!employes.length) return { equippedCount: 0, coverageRatio: 0 }
    let equipped = 0
    const hasDefaultByEnt = new Set(
      (plannings || []).filter((pl) => pl.is_default && pl.is_active !== false).map((pl) => pl.enterprise_id)
    )
    for (const e of employes) {
      const hasPortal = Boolean(e.employee_portal_enabled && (e.user_id || e.password_hash))
      const hasSched = Boolean(e.employee_schedules?.[0] || hasDefaultByEnt.has(e.enterprise_id))
      if (hasPortal || hasSched || e.machine_pin) equipped += 1
    }
    return {
      equippedCount: equipped,
      coverageRatio: Math.round((equipped / employes.length) * 100),
    }
  }, [employes, plannings])

  const circumference = 2 * Math.PI * 42
  const greenArc = (coverageRatio / 100) * circumference
  const orangeArc = Math.max(0, circumference - greenArc)
  const remainingCount = Math.max(0, total - equippedCount)

  const yTicks = [
    { label: String(maxDept), y: 18 },
    { label: String(Math.round(maxDept * 0.75)), y: 45 },
    { label: String(Math.round(maxDept * 0.5)), y: 73 },
    { label: String(Math.round(maxDept * 0.25)), y: 100 },
    { label: '0', y: 128 },
  ]

  return (
    <div className="employes-charts-pair">
      {/* GRAPHIQUE 1 : RÉPARTITION PAR DÉPARTEMENT (100% VRAIES DONNÉES) */}
      <article className="employes-framed-card employes-chart-box">
        <h3 className="employes-chart-box-title">Répartition par Département & Poste</h3>
        <svg viewBox="0 0 260 165" className="employes-dept-bars-svg" role="img" aria-label="Répartition par département">
          {yTicks.map((row, i) => (
            <g key={i}>
              <text x="6" y={row.y + 3} fontSize="9" fill="currentColor" opacity="0.6">{row.label}</text>
              <line x1="28" y1={row.y} x2="250" y2={row.y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
            </g>
          ))}

          {deptBuckets.map((b, idx) => {
            const slotWidth = 220 / deptBuckets.length
            const xCenter = 30 + idx * slotWidth + slotWidth / 2
            const barHeight = b.count > 0 ? Math.max(12, (b.count / maxDept) * 106) : 4
            const baseLine = 128
            const isGold = idx % 2 === 0
            const fill = isGold ? '#F3C784' : '#EA7B36'
            const shortLabel = b.label.length > 10 ? `${b.label.slice(0, 9)}…` : b.label

            return (
              <g
                key={`${b.label}-${idx}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectDepartment && onSelectDepartment(b.isFallback ? '' : b.label)}
              >
                <rect
                  x={xCenter - 11}
                  y={baseLine - barHeight}
                  width="22"
                  height={barHeight}
                  rx="6"
                  fill={fill}
                >
                  <title>{`${b.label} · ${b.count} employé(s)`}</title>
                </rect>
                <text
                  x={xCenter}
                  y={baseLine - barHeight - 5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="800"
                  fill="currentColor"
                >
                  {b.count}
                </text>
                <text
                  x={xCenter}
                  y="148"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="currentColor"
                  opacity="0.78"
                >
                  {shortLabel}
                </text>
              </g>
            )
          })}
        </svg>
      </article>

      {/* GRAPHIQUE 2 : COUVERTURE D'ENRÔLEMENT (VRAI % AU CENTRE + LÉGENDE EXPLICITE) */}
      <article className="employes-framed-card employes-chart-box">
        <h3 className="employes-chart-box-title">Couverture d’Enrôlement</h3>
        <div className="employes-bicolor-donut-wrap">
          <div style={{ position: 'relative', width: 132, height: 132 }}>
            <svg viewBox="0 0 120 120" className="employes-bicolor-donut-svg" style={{ width: '100%', height: '100%' }} aria-hidden="true">
              <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="16" />
              {orangeArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#EA7B36"
                  strokeWidth="16"
                  strokeDasharray={`${orangeArc} ${circumference}`}
                  strokeDashoffset={-greenArc}
                  transform="rotate(-90 60 60)"
                />
              )}
              {greenArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke="#1FC76A"
                  strokeWidth="16"
                  strokeDasharray={`${greenArc} ${circumference}`}
                  transform="rotate(-90 60 60)"
                />
              )}
            </svg>
            <div className="pointages-donut-center">
              <strong>{coverageRatio}%</strong>
              <span>{equippedCount}/{total} équipés</span>
            </div>
          </div>
          <div className="employes-donut-legend">
            <span style={{ color: '#1FC76A' }}>● Équipés ({equippedCount})</span>
            <span style={{ color: '#EA7B36' }}>● À compléter ({remainingCount})</span>
          </div>
        </div>
      </article>
    </div>
  )
}

export function EmployesPortraitCard({
  employee,
  payslipEntries = [],
  payslipDate,
  liveStatus,
  weeklyStats,
  scheduleRegimeLabel,
  portalEnabled = false,
  hasAccount = false,
  isLegacyAccount = false,
  canEditPlanning = false,
  onOpenFiche,
  onShowBadge,
  onOpenSchedule,
  onOpenPointages,
  onOpenPassword,
  onDelete,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!liveStatus?.activePause) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [liveStatus?.activePause])

  const state = liveStatus?.state || 'non_pointe'
  const activePause = liveStatus?.activePause || null
  const isPause = state === 'en_pause'
  const isOnDuty = state === 'en_poste' || state === 'termine'
  const isLeave = state === 'en_conge'

  const statusHeadline = isPause && activePause
    ? `En pause ${formaterTempsPauseEnDirect(activePause, nowMs)}`
    : state === 'en_poste'
      ? `En poste${liveStatus?.entryHHMM ? ` · ${liveStatus.entryHHMM}` : ''}`
      : state === 'termine'
        ? `Pointé (${liveStatus?.entryHHMM || ''} → ${liveStatus?.exitHHMM || ''})`
        : isLeave
          ? 'En congé / absence'
          : 'Non pointé aujourd’hui'

  const pillTone = isPause
    ? 'is-amber'
    : isOnDuty
      ? 'is-green'
      : isLeave
        ? 'is-violet'
        : 'is-neutral'

  const pillText = isPause
    ? '☕ En pause | →'
    : state === 'en_poste'
      ? '🟢 En poste | →'
      : state === 'termine'
        ? '✓ Pointé | →'
        : isLeave
          ? '🌴 En congé | →'
          : '⚪ Non pointé | →'

  const contractBadge = employee.contract_type || 'Non précisé'
  const shortRegime = scheduleRegimeLabel?.includes('Planning perso')
    ? 'Planning perso'
    : scheduleRegimeLabel?.includes('Planning général') || scheduleRegimeLabel?.includes('Planning ·')
      ? 'Planning général'
      : 'Planning non disponible dans En-Check'

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}` || 'EC'

  return (
    <article className="employes-portrait-card">
      <span
        className="employes-portrait-corner-dot"
        style={{
          background: isOnDuty ? '#33cf7a' : isPause ? '#f29d52' : isLeave ? '#8B5CF6' : 'rgba(166,147,126,0.45)',
        }}
      />

      <div className="employes-portrait-top">
        <div className="employes-portrait-avatar">
          {employee.photo_url ? (
            <img src={employee.photo_url} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="employes-portrait-status-col">
          <strong className="employes-portrait-name">
            {employee.first_name} {employee.last_name}
          </strong>
          <PlanningPayslipBadge entries={payslipEntries} referenceDate={payslipDate}/>
          <span className="employes-portrait-state-title">{statusHeadline}</span>
          <button
            type="button"
            className={`employes-portrait-status-pill ${pillTone}`}
            onClick={() => onOpenPointages && onOpenPointages(employee)}
          >
            <span>{pillText}</span>
          </button>
        </div>
      </div>

      <div className="employes-portrait-regime-row">
        <span className="employes-portrait-regime-text">{shortRegime}</span>
        <span className="employes-portrait-contract-chip">{contractBadge}</span>
        <span className="employes-portrait-matricule">{employee.matricule}</span>
      </div>

      <div className="employes-portrait-details-list">
        <div className="employes-portrait-detail-row" onClick={() => onOpenPointages && onOpenPointages(employee)}>
          <span>Cette semaine : {weeklyStats?.label || '0h 0m'}</span>
          <span className="employes-portrait-live-dots">
            <i className={isOnDuty ? 'is-green' : 'is-muted'} />
            <i className={isPause ? 'is-green' : 'is-muted'} />
          </span>
        </div>

        <div className="employes-portrait-detail-row" onClick={() => onOpenFiche && onOpenFiche(employee)}>
          <span>{employee.position || 'Poste non renseigné'} · {employee.department || 'Équipe'}</span>
          <ChevronRight size={13} />
        </div>

        <div
          className="employes-portrait-detail-row"
          onClick={() => (portalEnabled && onOpenPassword ? onOpenPassword(employee) : onOpenFiche && onOpenFiche(employee))}
        >
          <span>
            Pointeuse : {employee.machine_pin || '—'} ·{' '}
            {isLegacyAccount ? '⚠️ À migrer' : hasAccount ? 'Portail actif' : 'Portail'}
          </span>
          <ChevronRight size={13} />
        </div>
      </div>

      <div className="employes-portrait-pills-grid">
        <button
          type="button"
          className="employes-pill-action is-sand"
          onClick={() => onOpenFiche && onOpenFiche(employee)}
        >
          Fiche
        </button>
        <button
          type="button"
          className="employes-pill-action is-green"
          onClick={() => onShowBadge && onShowBadge(employee)}
        >
          Badge QR
        </button>
        <button
          type="button"
          className="employes-pill-action is-copper"
          onClick={() => (canEditPlanning && onOpenSchedule ? onOpenSchedule(employee) : onOpenFiche && onOpenFiche(employee))}
        >
          Planning
        </button>
        <button
          type="button"
          className="employes-pill-action is-emerald"
          onClick={() => onOpenPointages && onOpenPointages(employee)}
        >
          Pointages
        </button>
      </div>

      <div className="employes-portrait-Utilities">
        {portalEnabled && onOpenPassword && (
          <button
            type="button"
            className="employes-utility-icon-btn"
            onClick={() => onOpenPassword(employee)}
            title={isLegacyAccount ? 'Migrer accès portail' : 'Gérer mot de passe portail'}
          >
            <Key size={13} />
            <span>{isLegacyAccount ? 'Migrer portail' : 'Accès portail'}</span>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="employes-utility-icon-btn is-danger"
            onClick={() => onDelete(employee)}
            title="Supprimer cet employé"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  )
}

export function EmployesLiveStatusBanner({
  liveStatus,
  scheduleRegimeLabel,
  onOpenPointages,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!liveStatus?.activePause) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [liveStatus?.activePause])

  const state = liveStatus?.state || 'non_pointe'
  const activePause = liveStatus?.activePause || null

  return (
    <div className="employes-live-strip">
      <div className="employes-live-pills">
        {state === 'en_pause' && activePause ? (
          <span className="pointages-schedule-tag is-personal">
            <span>
              ☕ En pause : <strong>{formaterTempsPauseEnDirect(activePause, nowMs)}</strong>
              {activePause.estNonPlanifiee ? ' · Hors planning' : ''}
            </span>
          </span>
        ) : state === 'en_poste' ? (
          <span className="pointages-schedule-tag is-enterprise">
            <span>🟢 En poste{liveStatus?.entryHHMM ? ` · ${liveStatus.entryHHMM}` : ''}</span>
          </span>
        ) : state === 'termine' ? (
          <span className="pointages-schedule-tag is-enterprise">
            <span>✓ Pointé ({liveStatus?.entryHHMM || ''} → {liveStatus?.exitHHMM || ''})</span>
          </span>
        ) : state === 'en_conge' ? (
          <span className="pointages-schedule-tag is-night">
            <span>🌴 En congé</span>
          </span>
        ) : (
          <span className="pointages-schedule-tag is-none">
            <span>⚪ Non pointé</span>
          </span>
        )}
        {scheduleRegimeLabel && (
          <span className="pointages-schedule-tag is-none">
            <span>{scheduleRegimeLabel}</span>
          </span>
        )}
      </div>
      {onOpenPointages && (
        <button type="button" className="pointages-card-fiche-btn" onClick={onOpenPointages}>
          <span>Pointages →</span>
        </button>
      )}
    </div>
  )
}
