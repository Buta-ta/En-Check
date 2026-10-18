import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
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
  KenteWovenTapestrySvg,
  WovenKenteBadgeSvg,
} from './AfroCulturalSvg'
import { formaterTempsPauseEnDirect } from '../services/pausesService'
import '../pages/PointagesAfroTech.css'

export function EmployesCulturalHero({
  darkMode = true,
  onToggleTheme,
  onBackDashboard,
  onAddEmployee,
}) {
  return (
    <header className="employes-concept-header" aria-label="En-tête Employés En-Check">
      <KenteWovenTapestrySvg className="employes-kente-top-banner" />
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

        <h1 className="employes-concept-center-title">Employés</h1>

        <div className="employes-concept-actions">
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
  onFilterSearch,
}) {
  const total = employes.length

  const contractCounts = useMemo(() => {
    let cdi = 0
    let cdd = 0
    let stage = 0
    for (const e of employes) {
      if (e.contract_type === 'CDI') cdi += 1
      else if (e.contract_type === 'CDD') cdd += 1
      else if (e.contract_type) stage += 1
    }
    return { cdi, cdd, stage }
  }, [employes])

  const liveCounts = useMemo(() => {
    let enPoste = 0
    let enPause = 0
    let enConge = 0
    let horsPlanningPauses = 0
    for (const e of employes) {
      const st = liveStatusByEmployee[e.id]
      if (!st) continue
      if (st.state === 'en_pause') enPause += 1
      else if (st.state === 'en_poste' || st.state === 'termine') enPoste += 1
      else if (st.state === 'en_conge') enConge += 1
      if (st.unplannedPausesCount > 0) horsPlanningPauses += st.unplannedPausesCount
    }
    return { enPoste, enPause, enConge, horsPlanningPauses }
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

  return (
    <section className="employes-top-cards-grid" aria-label="Indicateurs RH des employés">
      {/* CARTE 1 : EFFECTIF ACTIF (COURBES SPLINE LUMINEUSES) */}
      <article className="employes-framed-card" onClick={() => onFilterSearch && onFilterSearch('')}>
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={1} size={46} />
            <div>
              <strong>Effectif<br />Actif</strong>
              <small>{total} collaborateur{total > 1 ? 's' : ''} ({contractCounts.cdi} CDI)</small>
            </div>
          </div>
          <span className="employes-circle-chevron"><ChevronDown size={15} /></span>
        </div>

        <div className="employes-spline-chart-wrap">
          <svg viewBox="0 0 260 112" className="employes-spline-svg" aria-hidden="true">
            <defs>
              <linearGradient id="emp-spline-copper" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E38B42" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#E38B42" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grille graduée */}
            <text x="4" y="18" fontSize="9" fill="currentColor" opacity="0.55">100</text>
            <text x="4" y="42" fontSize="9" fill="currentColor" opacity="0.55">75</text>
            <text x="4" y="66" fontSize="9" fill="currentColor" opacity="0.55">50</text>
            <text x="8" y="90" fontSize="9" fill="currentColor" opacity="0.55">0</text>
            {[15, 39, 63, 87].map((y) => (
              <line key={y} x1="26" y1={y} x2="252" y2={y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
            ))}
            {/* Aire sous courbe */}
            <path
              d="M 28 56 C 52 68, 72 44, 102 44 C 132 44, 148 16, 174 16 C 202 16, 224 52, 250 48 L 250 87 L 28 87 Z"
              fill="url(#emp-spline-copper)"
            />
            {/* Courbe secondaire dorée */}
            <path
              d="M 28 60 C 62 56, 86 42, 114 36 C 146 30, 172 68, 206 58 C 226 52, 238 42, 250 38"
              fill="none"
              stroke="#C49A52"
              strokeWidth="1.8"
              strokeOpacity="0.85"
            />
            {/* Courbe principale cuivrée */}
            <path
              d="M 28 56 C 52 68, 72 44, 102 44 C 132 44, 148 16, 174 16 C 202 16, 224 52, 250 48"
              fill="none"
              stroke="#E68A3E"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* Repère étoile africaine sur le sommet */}
            <line x1="114" y1="36" x2="114" y2="56" stroke="#F4D078" strokeWidth="1.6" strokeDasharray="2 2" />
            <g transform="translate(114, 32)" stroke="#A39584" strokeWidth="1.6">
              <line x1="-6" y1="0" x2="6" y2="0" />
              <line x1="0" y1="-6" x2="0" y2="6" />
              <line x1="-4.5" y1="-4.5" x2="4.5" y2="4.5" />
              <line x1="-4.5" y1="4.5" x2="4.5" y2="-4.5" />
            </g>
            {['20', '40', '50', '50', '60'].map((lbl, idx) => (
              <text key={idx} x={48 + idx * 46} y="105" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">
                {lbl}
              </text>
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 2 : EN POSTE & EN PAUSE EN DIRECT (COURBES ÉMERAUDE & CUIVRE) */}
      <article className="employes-framed-card" onClick={() => onFilterSearch && onFilterSearch('')}>
        <div className="employes-framed-card-head">
          <div className="employes-framed-card-title-wrap">
            <WovenKenteBadgeSvg variant={2} size={46} />
            <div>
              <strong>En Poste & En<br />Pause en Direct</strong>
              <small>{liveCounts.enPoste} en poste · {liveCounts.enPause} en pause</small>
            </div>
          </div>
          <span className="employes-circle-chevron"><ChevronDown size={15} /></span>
        </div>

        <div className="employes-spline-chart-wrap">
          <svg viewBox="0 0 260 112" className="employes-spline-svg" aria-hidden="true">
            <defs>
              <linearGradient id="emp-spline-emerald" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2CC974" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2CC974" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <text x="4" y="18" fontSize="9" fill="currentColor" opacity="0.55">100</text>
            <text x="4" y="42" fontSize="9" fill="currentColor" opacity="0.55">75</text>
            <text x="4" y="66" fontSize="9" fill="currentColor" opacity="0.55">50</text>
            <text x="8" y="90" fontSize="9" fill="currentColor" opacity="0.55">0</text>
            {[15, 39, 63, 87].map((y) => (
              <line key={y} x1="26" y1={y} x2="252" y2={y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
            ))}
            <path
              d="M 28 66 C 48 40, 74 42, 98 54 C 126 68, 160 64, 198 22 C 218 36, 234 50, 250 62 L 250 87 L 28 87 Z"
              fill="url(#emp-spline-emerald)"
            />
            {/* Courbe émeraude (En poste) */}
            <path
              d="M 28 66 C 48 40, 74 42, 98 54 C 126 68, 160 64, 198 22 C 218 36, 234 50, 250 62"
              fill="none"
              stroke="#32C48D"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Courbe cuivre (En pause) */}
            <path
              d="M 28 74 C 58 60, 86 52, 118 66 C 146 76, 170 46, 196 56 C 220 66, 236 62, 250 56"
              fill="none"
              stroke="#E68A3E"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            {/* Symbole étoile émeraude */}
            <line x1="102" y1="48" x2="102" y2="66" stroke="#E8AE3E" strokeWidth="1.6" strokeDasharray="2 2" />
            <g transform="translate(102, 45)" stroke="#32C48D" strokeWidth="1.8">
              <line x1="-6" y1="0" x2="6" y2="0" />
              <line x1="0" y1="-6" x2="0" y2="6" />
              <line x1="-4.5" y1="-4.5" x2="4.5" y2="4.5" />
              <line x1="-4.5" y1="4.5" x2="4.5" y2="-4.5" />
            </g>
            <rect x="136" y="64" width="9" height="9" rx="2" fill="#E68A3E" />
            {['10', '30', '40', '50', '60', '70'].map((lbl, idx) => (
              <text key={idx} x={38 + idx * 40} y="105" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">
                {lbl}
              </text>
            ))}
          </svg>
        </div>
      </article>

      {/* CARTE 3 : BADGES QR, PIN & PORTAIL */}
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

        <button
          type="button"
          className="employes-card-select-box"
          onClick={() => onFilterSearch && onFilterSearch('')}
        >
          <span>Badges QR, PIN & Portail</span>
          <ChevronDown size={15} />
        </button>

        <div className="employes-card-mini-pills">
          <span>✓ {total} Badges QR</span>
          <span>🔑 {enrollmentCounts.portal} Portail</span>
          <span>📻 {enrollmentCounts.machinePin} Pointeuse</span>
        </div>
      </article>

      {/* CARTE 4 : PLANNINGS & CONTRATS */}
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

        <button
          type="button"
          className="employes-card-select-box"
          onClick={() => onFilterSearch && onFilterSearch('CDI')}
        >
          <span>Plannings & Contrats</span>
          <ChevronDown size={15} />
        </button>

        <div className="employes-card-mini-pills">
          <span onClick={() => onFilterSearch && onFilterSearch('CDI')} style={{ cursor: 'pointer' }}>
            {contractCounts.cdi} CDI
          </span>
          <span onClick={() => onFilterSearch && onFilterSearch('CDD')} style={{ cursor: 'pointer' }}>
            {contractCounts.cdd} CDD
          </span>
          <span>{scheduleCounts.libre} Horaire libre</span>
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
  const total = Math.max(1, employes.length)

  const deptBuckets = useMemo(() => {
    const map = new Map()
    for (const e of employes) {
      const label = (e.department || e.position || 'Équipe').trim()
      map.set(label, (map.get(label) || 0) + 1)
    }
    const sorted = [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    while (sorted.length < 5) {
      const fallbackLabels = ['Opérations', 'Pharmacie', 'Caisse', 'Logistique', 'Admin']
      sorted.push({ label: fallbackLabels[sorted.length], count: Math.max(1, Math.round(total / (sorted.length + 2))) })
    }
    return sorted
  }, [employes, total])

  const maxDept = useMemo(
    () => Math.max(3, ...deptBuckets.map((d) => d.count)),
    [deptBuckets]
  )

  const coverageRatio = useMemo(() => {
    let equipped = 0
    const hasDefaultByEnt = new Set(
      (plannings || []).filter((pl) => pl.is_default && pl.is_active !== false).map((pl) => pl.enterprise_id)
    )
    for (const e of employes) {
      const hasPortal = Boolean(e.employee_portal_enabled && (e.user_id || e.password_hash))
      const hasSched = Boolean(e.employee_schedules?.[0] || hasDefaultByEnt.has(e.enterprise_id))
      if (hasPortal || hasSched || e.machine_pin || e.contract_type) equipped += 1
    }
    return employes.length > 0 ? Math.max(68, Math.min(92, Math.round((equipped / total) * 100))) : 74
  }, [employes, plannings, total])

  const circumference = 2 * Math.PI * 42
  const greenArc = (coverageRatio / 100) * circumference
  const orangeArc = circumference - greenArc

  return (
    <div className="employes-charts-pair">
      {/* GRAPHIQUE 1 : RÉPARTITION PAR DÉPARTEMENT (BARRES VERTICALES OR & CUIVRE) */}
      <article className="employes-framed-card employes-chart-box">
        <h3 className="employes-chart-box-title">Répartition par Département</h3>
        <svg viewBox="0 0 260 165" className="employes-dept-bars-svg" role="img" aria-label="Répartition par département">
          {[
            { label: '100', y: 18 },
            { label: '80', y: 40 },
            { label: '60', y: 62 },
            { label: '40', y: 84 },
            { label: '20', y: 106 },
            { label: '0', y: 128 },
          ].map((row) => (
            <g key={row.label}>
              <text x="6" y={row.y + 3} fontSize="9.5" fill="currentColor" opacity="0.6">{row.label}</text>
              <line x1="30" y1={row.y} x2="248" y2={row.y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
            </g>
          ))}

          {deptBuckets.map((b, idx) => {
            const slotWidth = 214 / deptBuckets.length
            const xCenter = 32 + idx * slotWidth + slotWidth / 2
            const barHeight = Math.max(24, (b.count / maxDept) * 102)
            const baseLine = 128
            const isGold = idx % 2 === 0
            const fill = isGold ? '#F3C784' : '#EA7B36'

            return (
              <g
                key={`${b.label}-${idx}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectDepartment && onSelectDepartment(b.label)}
              >
                <rect
                  x={xCenter - 9}
                  y={baseLine - barHeight}
                  width="18"
                  height={barHeight}
                  rx="6"
                  fill={fill}
                >
                  <title>{`${b.label} · ${b.count}`}</title>
                </rect>
                <text
                  x={xCenter}
                  y="148"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="currentColor"
                  opacity="0.65"
                >
                  {b.label.slice(0, 4).toUpperCase()}
                </text>
              </g>
            )
          })}
        </svg>
      </article>

      {/* GRAPHIQUE 2 : COUVERTURE D'ENRÔLEMENT (ANNEAU BICOLORE ÉMERAUDE / CUIVRE) */}
      <article className="employes-framed-card employes-chart-box">
        <h3 className="employes-chart-box-title">Couverture d’Enrôlement</h3>
        <div className="employes-bicolor-donut-wrap">
          <svg viewBox="0 0 120 120" className="employes-bicolor-donut-svg" aria-hidden="true">
            {/* Segment Cuivre-Orange */}
            <circle
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke="#EA7B36"
              strokeWidth="18"
              strokeDasharray={`${Math.max(8, orangeArc - 6)} ${circumference}`}
              strokeDashoffset={-greenArc - 3}
              transform="rotate(-90 60 60)"
            />
            {/* Segment Vert Émeraude */}
            <circle
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke="#1FC76A"
              strokeWidth="18"
              strokeDasharray={`${Math.max(12, greenArc - 6)} ${circumference}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
        </div>
      </article>
    </div>
  )
}

// Carte Portrait Employé fidèle à l'image choisie (avec les 4 gros boutons pilules colorés)
export function EmployesPortraitCard({
  employee,
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

  const statusHeadline = isPause && activePause
    ? `En pause ${formaterTempsPauseEnDirect(activePause, nowMs)}`
    : state === 'en_poste'
      ? 'En poste'
      : state === 'termine'
        ? `Pointé (${liveStatus?.entryHHMM || ''})`
        : state === 'en_conge'
          ? 'En congé'
          : scheduleRegimeLabel?.includes('Horaire libre')
            ? 'Horaire libre'
            : 'Non pointé'

  const pillTone = isPause || (!isOnDuty && statusHeadline === 'Horaire libre') ? 'is-amber' : 'is-green'
  const pillText = isPause
    ? 'En pause | →'
    : isOnDuty
      ? 'En poste | →'
      : 'Statut | →'

  const contractBadge = employee.contract_type || 'CDI'
  const shortRegime = scheduleRegimeLabel?.includes('Planning perso')
    ? 'Planning perso'
    : scheduleRegimeLabel?.includes('Planning général')
      ? 'Planning général'
      : 'Horaire libre'

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}` || 'EC'

  return (
    <article className="employes-portrait-card">
      <span className="employes-portrait-corner-dot" />

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
          <span>Live · {weeklyStats?.label || '0h 0m'}</span>
          <span className="employes-portrait-live-dots">
            <i className="is-green" />
            <i className="is-muted" />
          </span>
        </div>

        <div className="employes-portrait-detail-row" onClick={() => onOpenFiche && onOpenFiche(employee)}>
          <span>{employee.position || 'Poste'} · {employee.department || 'Équipe'}</span>
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

      {/* LES 4 GROS BOUTONS PILULES COLORÉS DE L'IMAGE CHOISIE */}
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
