import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Coffee,
  FileText,
  Key,
  Moon,
  QrCode,
  Radio,
  Sun,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import {
  AdinkraWatermarkSvg,
  CulturalCalabashPauseSvg,
  CulturalPresenceSvg,
  CulturalProofSvg,
  CulturalTimeDrumSvg,
  KenteFriezeSvg,
} from './AfroCulturalSvg'
import { formaterTempsPauseEnDirect } from '../services/pausesService'
import '../pages/PointagesAfroTech.css'

export function EmployesCulturalHero({
  totalCount = 0,
  departmentsCount = 0,
  darkMode = true,
  onToggleTheme,
  onBackDashboard,
  onAddEmployee,
}) {
  return (
    <header className="pointages-cultural-hero" aria-label="En-tête Employés En-Check">
      <KenteFriezeSvg className="pointages-hero-frieze" />
      <div className="pointages-cultural-hero-row">
        <div className="pointages-cultural-brand">
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
          <div className="pointages-cultural-copy">
            <strong>En-Check · Employés</strong>
            <span>On gère ! · Dossiers RH, statut en direct, pauses, plannings & badges QR</span>
          </div>
        </div>

        <div className="pointages-cultural-right">
          <span className="pointages-cultural-date">
            {totalCount} collaborateur{totalCount > 1 ? 's' : ''} · {departmentsCount} département{departmentsCount > 1 ? 's' : ''}
          </span>

          {onToggleTheme && (
            <button
              type="button"
              className="pointages-cultural-date"
              onClick={onToggleTheme}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {darkMode ? <Sun size={12} /> : <Moon size={12} />}
              <span>{darkMode ? 'Clair' : 'Sombre'}</span>
            </button>
          )}

          {onAddEmployee && (
            <button
              type="button"
              className="pointages-whatsapp-btn"
              style={{
                background: 'linear-gradient(135deg, #C87B3E, #9C5321)',
                borderColor: '#9C5321',
                boxShadow: '0 6px 16px rgba(184, 107, 53, 0.25)',
              }}
              onClick={onAddEmployee}
            >
              <UserPlus size={14} />
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

  const activeShare = total > 0 ? Math.round(((liveCounts.enPoste + liveCounts.enPause) / total) * 100) : 0
  const portalShare = total > 0 ? Math.round((enrollmentCounts.portal / total) * 100) : 0
  const plannedShare = total > 0 ? Math.round(((scheduleCounts.perso + scheduleCounts.general) / total) * 100) : 0

  const cards = [
    {
      id: 'headcount',
      title: '1. Effectif Actif',
      value: String(total).padStart(2, '0'),
      badge: `${contractCounts.cdi} CDI · ${contractCounts.cdd} CDD`,
      subtitle: `${contractCounts.stage} autre(s) contrat(s) · Cliquez pour tout voir`,
      progress: 100,
      tone: 'good',
      onClick: () => onFilterSearch && onFilterSearch(''),
      IconSvg: CulturalPresenceSvg,
      sparkPoints: '4,22 18,19 32,16 46,14 60,11 74,8 88,5',
    },
    {
      id: 'live-status',
      title: '2. En Poste & En Pause en Direct',
      value: `${liveCounts.enPoste} 🟢 · ${liveCounts.enPause} ☕`,
      badge: liveCounts.enPause > 0
        ? `⏱️ ${liveCounts.enPause} en pause en direct`
        : `${activeShare}% actifs aujourd’hui`,
      subtitle: `${liveCounts.enConge} en congé · ${liveCounts.horsPlanningPauses} pause(s) hors planning`,
      progress: Math.max(14, activeShare),
      tone: liveCounts.enPause > 0 ? 'amber' : 'good',
      onClick: () => onFilterSearch && onFilterSearch(''),
      IconSvg: CulturalCalabashPauseSvg,
      sparkPoints: '4,18 18,15 32,17 46,11 60,13 74,8 88,7',
    },
    {
      id: 'enrollment',
      title: '3. Badges QR, PIN & Portail',
      value: `${enrollmentCounts.portal} / ${total}`,
      badge: enrollmentCounts.toMigrate > 0
        ? `⚠️ ${enrollmentCounts.toMigrate} à migrer`
        : `${portalShare}% Portail actif`,
      subtitle: `${total} badges QR prêts · ${enrollmentCounts.machinePin} N° pointeuse attribué(s)`,
      progress: Math.max(18, portalShare),
      tone: enrollmentCounts.toMigrate > 0 ? 'danger' : 'copper',
      onClick: () => onFilterSearch && onFilterSearch(''),
      IconSvg: CulturalProofSvg,
      sparkPoints: '4,20 18,18 32,15 46,13 60,10 74,9 88,6',
    },
    {
      id: 'schedules',
      title: '4. Plannings & Contrats',
      value: `${scheduleCounts.perso + scheduleCounts.general} 📅 · ${scheduleCounts.libre} ⏱️`,
      badge: scheduleCounts.perso + scheduleCounts.general > 0
        ? `${plannedShare}% planifiés`
        : 'Horaire libre',
      subtitle: `${scheduleCounts.perso} perso · ${scheduleCounts.general} général · ${scheduleCounts.libre} horaire libre`,
      progress: Math.max(20, plannedShare || 45),
      tone: 'copper',
      onClick: () => onFilterSearch && onFilterSearch('CDI'),
      IconSvg: CulturalTimeDrumSvg,
      sparkPoints: '4,19 18,16 32,17 46,12 60,11 74,8 88,6',
    },
  ]

  return (
    <section className="pointages-kpi-grid" aria-label="Indicateurs RH des employés">
      {cards.map((card) => {
        const IconSvg = card.IconSvg
        return (
          <button
            type="button"
            key={card.id}
            className={`pointages-kpi-card is-${card.tone}`}
            onClick={card.onClick}
          >
            <AdinkraWatermarkSvg className="pointages-kpi-watermark" />
            <div className="pointages-kpi-top">
              <span className="pointages-kpi-title">{card.title}</span>
              <span className="pointages-kpi-icon">
                <IconSvg size={21} />
              </span>
            </div>

            <div className="pointages-kpi-main">
              <div>
                <strong className="pointages-kpi-value">{card.value}</strong>
                <span className="pointages-kpi-badge">{card.badge}</span>
              </div>
              <svg className="pointages-kpi-sparkline" viewBox="0 0 92 26" fill="none" aria-hidden="true">
                <polyline
                  points={card.sparkPoints}
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="pointages-kpi-progress" aria-hidden="true">
              <span style={{ width: `${Math.max(6, Math.min(100, card.progress))}%` }} />
            </div>

            <span className="pointages-kpi-subtitle">{card.subtitle}</span>
          </button>
        )
      })}
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
      const label = (e.department || e.position || 'Équipe générale').trim()
      map.set(label, (map.get(label) || 0) + 1)
    }
    const sorted = [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    if (!sorted.length) {
      return [{ label: 'Équipe', count: 0 }]
    }
    return sorted
  }, [employes])

  const maxDept = useMemo(
    () => Math.max(3, ...deptBuckets.map((d) => d.count)),
    [deptBuckets]
  )

  const enrollmentBars = useMemo(() => {
    let portal = 0
    let machinePin = 0
    let planned = 0
    let contracts = 0
    const hasDefaultByEnt = new Set(
      (plannings || []).filter((pl) => pl.is_default && pl.is_active !== false).map((pl) => pl.enterprise_id)
    )

    for (const e of employes) {
      if (e.employee_portal_enabled && (e.user_id || e.password_hash)) portal += 1
      if (e.machine_pin) machinePin += 1
      const sched = e.employee_schedules?.[0]
      if ((sched && (sched.use_custom_hours || sched.schedule_id)) || (e.enterprises?.module_planning !== false && hasDefaultByEnt.has(e.enterprise_id))) {
        planned += 1
      }
      if (e.contract_type) contracts += 1
    }

    return [
      { id: 'qr', label: 'Badge QR & Code PIN', count: employes.length, pct: 100, color: '#26734D', Icon: QrCode },
      { id: 'portal', label: 'Accès Portail Employé', count: portal, pct: Math.round((portal / total) * 100), color: '#D58D4B', Icon: Key },
      { id: 'machine', label: 'N° Pointeuse attribué', count: machinePin, pct: Math.round((machinePin / total) * 100), color: '#38BDF8', Icon: Radio },
      { id: 'planning', label: 'Planning rattaché', count: planned, pct: Math.round((planned / total) * 100), color: '#D4AF37', Icon: Calendar },
      { id: 'contract', label: 'Contrat renseigné (CDI/CDD)', count: contracts, pct: Math.round((contracts / total) * 100), color: '#7C5CFC', Icon: FileText },
    ]
  }, [employes, plannings, total])

  const circumference = 2 * Math.PI * 36
  const portalPct = enrollmentBars[1]?.pct ?? 100
  const strokeLen = (portalPct / 100) * circumference

  return (
    <section className="pointages-charts-grid" aria-label="Graphiques RH des employés">
      {/* CHART 1: RÉPARTITION PAR DÉPARTEMENT / POSTE */}
      <article className="pointages-chart-card">
        <div className="pointages-chart-header">
          <div>
            <h3>Répartition par Département & Poste</h3>
            <p>Cliquez sur une barre pour filtrer l’annuaire sur ce pôle</p>
          </div>
        </div>

        <div className="pointages-hourly-chart">
          <svg viewBox="0 0 540 168" className="pointages-hourly-svg" role="img" aria-label="Répartition par département">
            {[0, 0.5, 1].map((ratio, idx) => {
              const y = 20 + ratio * 112
              return (
                <line
                  key={idx}
                  x1="20"
                  y1={y}
                  x2="520"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="3 3"
                />
              )
            })}

            {deptBuckets.map((b, idx) => {
              const slotWidth = 500 / deptBuckets.length
              const xCenter = 20 + idx * slotWidth + slotWidth / 2
              const barHeight = Math.max(8, (b.count / maxDept) * 106)
              const baseLine = 132
              const colors = ['#D58D4B', '#26734D', '#E5A568', '#38BDF8', '#D4AF37', '#7C5CFC']
              const barColor = colors[idx % colors.length]

              return (
                <g
                  key={b.label}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectDepartment && onSelectDepartment(b.label === 'Équipe générale' ? '' : b.label)}
                >
                  <rect
                    x={xCenter - 18}
                    y={baseLine - barHeight}
                    width="36"
                    height={barHeight}
                    rx="8"
                    fill={barColor}
                  >
                    <title>{`${b.label} · ${b.count} employé(s)`}</title>
                  </rect>
                  <text
                    x={xCenter}
                    y={baseLine - barHeight - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="800"
                    fill="currentColor"
                  >
                    {b.count}
                  </text>
                  <text
                    x={xCenter}
                    y="152"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="currentColor"
                    opacity="0.78"
                  >
                    {b.label.length > 12 ? `${b.label.slice(0, 11)}…` : b.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </article>

      {/* CHART 2: COUVERTURE D'ENRÔLEMENT & CONTRATS */}
      <article className="pointages-chart-card">
        <div className="pointages-chart-header">
          <div>
            <h3>Couverture d’Enrôlement & Dossiers RH</h3>
            <p>Badges QR, Portail Employé, Pointeuse, Plannings & Contrats</p>
          </div>
        </div>

        <div className="pointages-methods-layout">
          <div className="pointages-donut-wrap">
            <svg viewBox="0 0 100 100" className="pointages-donut-svg" aria-hidden="true">
              <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="36"
                fill="none"
                stroke="#26734D"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${strokeLen} ${circumference}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="pointages-donut-center">
              <strong>{portalPct}%</strong>
              <span>Portail</span>
            </div>
          </div>

          <div className="pointages-methods-bars">
            {enrollmentBars.map((m) => {
              const Icon = m.Icon
              return (
                <div className="pointages-method-row" key={m.id}>
                  <div className="pointages-method-label">
                    <span>
                      <Icon size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                      {m.label}
                    </span>
                    <strong>{m.count} ({m.pct}%)</strong>
                  </div>
                  <div className="pointages-method-track">
                    <span style={{ width: `${Math.max(5, m.pct)}%`, background: m.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </article>
    </section>
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
          <span className="pointages-schedule-tag is-personal" style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.38)' }}>
            <Coffee size={11} />
            <span>
              ☕ En pause en direct : <strong>{formaterTempsPauseEnDirect(activePause, nowMs)}</strong>
              {activePause.estNonPlanifiee ? ' · Hors planning' : ''}
            </span>
          </span>
        ) : state === 'en_poste' ? (
          <span className="pointages-schedule-tag is-enterprise">
            <UserCheck size={11} />
            <span>🟢 En poste{liveStatus.entryHHMM ? ` · depuis ${liveStatus.entryHHMM}` : ''}</span>
          </span>
        ) : state === 'termine' ? (
          <span className="pointages-schedule-tag is-enterprise">
            <Clock size={11} />
            <span>✓ Pointé ({liveStatus.entryHHMM || ''} → {liveStatus.exitHHMM || ''})</span>
          </span>
        ) : state === 'en_conge' ? (
          <span className="pointages-schedule-tag is-night">
            <Calendar size={11} />
            <span>🌴 En congé / absence</span>
          </span>
        ) : (
          <span className="pointages-schedule-tag is-none">
            <Clock size={11} />
            <span>⚪ Non pointé aujourd’hui</span>
          </span>
        )}

        {liveStatus?.pausesCount > 0 && state !== 'en_pause' && (
          <span className="pointages-schedule-tag is-personal">
            <Coffee size={11} />
            <span>
              {liveStatus.pausesCount} pause{liveStatus.pausesCount > 1 ? 's' : ''} ({liveStatus.totalPauseMinutes} min)
              {liveStatus.unplannedPausesCount > 0 ? ' · Hors planning' : ''}
            </span>
          </span>
        )}

        {scheduleRegimeLabel && (
          <span className="pointages-schedule-tag is-none">
            <Calendar size={11} />
            <span>{scheduleRegimeLabel}</span>
          </span>
        )}
      </div>

      {onOpenPointages && (
        <button
          type="button"
          className="pointages-card-fiche-btn"
          onClick={onOpenPointages}
          title="Voir les pointages de cet employé"
        >
          <span>Pointages</span>
          <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}
