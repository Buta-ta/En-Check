import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Edit,
  Lock,
  MapPin,
  MessageCircle,
  QrCode,
  ScanFace,
  Smartphone,
  X,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import {
  CulturalPresenceSvg,
  CulturalProofSvg,
  CulturalShieldSvg,
  CulturalTimeDrumSvg,
  KenteFriezeSvg,
} from './AfroCulturalSvg'
import { estEstimationAStatuer } from '../services/seuilsPointage'
import {
  formaterDureeComplete,
  formaterHeureLocale,
  getHeuresMinutesLocales,
  minutesDepuisMinuit,
} from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

const isLatePointage = (p) => {
  if (p?.status !== 'present' || !p?.firstIn?.check_time) return false
  const mins = minutesDepuisMinuit(p.firstIn.check_time)
  return typeof mins === 'number' && mins > 9 * 60
}

const getFirstPhotoUrl = (p) => {
  if (!p?.attendances?.length) return null
  for (const att of p.attendances) {
    const url = att?.pointages_photos?.[0]?.photo_url
    if (url) return url
  }
  return null
}

export function PointagesCulturalHero({
  formattedDate,
  checkingPermissions,
  canEditPointages,
  anomaliesCount = 0,
  criticalAnomaliesCount = 0,
  onBackDashboard,
  onToggleAlerts,
  onShareWhatsApp,
}) {
  return (
    <header className="pointages-cultural-hero" aria-label="En-tête Pointages En-Check">
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
            <strong>En-Check · Pointages</strong>
            <span>On gère ! · Analyse & journal de présence</span>
          </div>
        </div>

        <div className="pointages-cultural-right">
          <span className="pointages-cultural-date">{formattedDate}</span>

          {!checkingPermissions && (
            <span
              className="pointages-cultural-date"
              style={{
                color: canEditPointages ? 'var(--pt-good)' : 'var(--pt-copper)',
                borderColor: canEditPointages ? 'rgba(38,115,77,0.28)' : 'rgba(184,107,53,0.28)',
              }}
            >
              {canEditPointages ? (
                <>
                  <Edit size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Modif. ON
                </>
              ) : (
                <>
                  <Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Lecture
                </>
              )}
            </span>
          )}

          {anomaliesCount > 0 && (
            <button
              type="button"
              className="pointages-cultural-date"
              onClick={onToggleAlerts}
              style={{
                cursor: 'pointer',
                color: criticalAnomaliesCount > 0 ? 'var(--pt-danger)' : 'var(--pt-amber)',
                borderColor: criticalAnomaliesCount > 0 ? 'rgba(194,59,43,0.32)' : 'rgba(201,122,22,0.32)',
              }}
            >
              <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              {anomaliesCount} alerte{anomaliesCount > 1 ? 's' : ''}
            </button>
          )}

          <button type="button" className="pointages-whatsapp-btn" onClick={onShareWhatsApp}>
            <MessageCircle size={14} />
            <span>Partager sur WhatsApp</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export function PointagesExecutiveKpis({
  stats = {},
  pointages = [],
  filterStatus = 'tous',
  filterPhotos = 'all',
  onUpdateFilter,
  onToggleAlerts,
}) {
  const total = Number(stats.total) || pointages.length || 0
  const presents = Number(stats.presents) || 0
  const absents = Number(stats.absents) || 0
  const conges = Number(stats.en_conge) || 0
  const conflits = Number(stats.conflits) || 0
  const avecPhoto = Number(stats.avecPhoto) || 0
  const avecGPS = Number(stats.avecGPS) || 0

  const lateCount = useMemo(
    () => pointages.filter((p) => isLatePointage(p)).length,
    [pointages]
  )
  const presumedCount = useMemo(
    () => pointages.filter((p) => p.lastOut && estEstimationAStatuer(p.lastOut)).length,
    [pointages]
  )

  const presenceRate = total > 0 ? Math.round((presents / total) * 100) : 0
  const onTimeCount = Math.max(0, presents - lateCount)
  const punctualityRate = presents > 0 ? Math.round((onTimeCount / presents) * 100) : 100
  const reviewTotal = presumedCount + conflits
  const proofCount = Math.max(avecPhoto, avecGPS, presents)
  const proofRate = presents > 0 ? Math.min(100, Math.round(((avecPhoto + avecGPS) / (presents * 2)) * 100)) : 0

  const cards = [
    {
      id: 'presence',
      title: '1. Pointages du jour',
      value: `${presents} / ${total}`,
      badge: `${presenceRate}% présents`,
      subtitle: `${absents} absent${absents > 1 ? 's' : ''} · ${conges} en congé`,
      progress: presenceRate,
      tone: 'good',
      active: filterStatus === 'present',
      onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'present' ? 'tous' : 'present'),
      IconSvg: CulturalPresenceSvg,
      sparkPoints: '4,22 18,18 32,19 46,13 60,10 74,6 88,4',
    },
    {
      id: 'punctuality',
      title: '2. Ponctualité & Retards',
      value: String(lateCount).padStart(2, '0'),
      badge: `${punctualityRate}% à l’heure`,
      subtitle: `${onTimeCount} arrivée${onTimeCount > 1 ? 's' : ''} à l’heure aujourd’hui`,
      progress: punctualityRate,
      tone: 'amber',
      active: false,
      onClick: () => onUpdateFilter && onUpdateFilter('status', 'present'),
      IconSvg: CulturalTimeDrumSvg,
      sparkPoints: '4,16 18,14 32,18 46,12 60,15 74,9 88,8',
    },
    {
      id: 'review',
      title: '3. Sorties & Conflits',
      value: String(reviewTotal).padStart(2, '0'),
      badge: reviewTotal > 0 ? 'À statuer' : 'Tout validé',
      subtitle: `${presumedCount} sortie${presumedCount > 1 ? 's' : ''} présumée${presumedCount > 1 ? 's' : ''} · ${conflits} conflit${conflits > 1 ? 's' : ''}`,
      progress: total > 0 ? Math.min(100, Math.round((reviewTotal / total) * 100)) : 0,
      tone: reviewTotal > 0 ? 'danger' : 'good',
      active: filterStatus === 'conflit_absence_pointage',
      onClick: () => {
        if (conflits > 0 && onUpdateFilter) {
          onUpdateFilter('status', filterStatus === 'conflit_absence_pointage' ? 'tous' : 'conflit_absence_pointage')
        } else if (onToggleAlerts) {
          onToggleAlerts()
        }
      },
      IconSvg: CulturalShieldSvg,
      sparkPoints: '4,20 18,19 32,14 46,16 60,11 74,13 88,10',
    },
    {
      id: 'proofs',
      title: '4. Preuves Tech & Terrain',
      value: String(proofCount).padStart(2, '0'),
      badge: `${avecPhoto} photos · ${avecGPS} GPS`,
      subtitle: 'Code PIN, QR Code, Photo signée & GPS',
      progress: Math.max(24, proofRate),
      tone: 'copper',
      active: filterPhotos === 'with',
      onClick: () => onUpdateFilter && onUpdateFilter('photos', filterPhotos === 'with' ? 'all' : 'with'),
      IconSvg: CulturalProofSvg,
      sparkPoints: '4,21 18,17 32,15 46,12 60,9 74,7 88,5',
    },
  ]

  return (
    <section className="pointages-kpi-grid" aria-label="Indicateurs clés des pointages">
      {cards.map((card) => {
        const IconSvg = card.IconSvg
        return (
          <button
            type="button"
            key={card.id}
            className={`pointages-kpi-card is-${card.tone}${card.active ? ' is-active' : ''}`}
            onClick={card.onClick}
          >
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

export function PointagesAnalyticsCharts({ pointages = [], stats = {} }) {
  const hourlyBuckets = useMemo(() => {
    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const map = new Map(hours.map((h) => [h, { hour: h, label: `${String(h).padStart(2, '0')}h`, inCount: 0, outCount: 0 }]))

    for (const p of pointages) {
      for (const att of p.attendances || []) {
        if (!att?.check_time) continue
        const hm = getHeuresMinutesLocales(att.check_time)
        const h = hm ? hm.heures : new Date(att.check_time).getHours()
        const clamped = Math.max(6, Math.min(20, h))
        const bucket = map.get(clamped)
        if (!bucket) continue
        if (String(att.check_type || '').toLowerCase() === 'in') bucket.inCount += 1
        else bucket.outCount += 1
      }
    }

    return [...map.values()]
  }, [pointages])

  const maxHourly = useMemo(
    () => Math.max(4, ...hourlyBuckets.map((b) => Math.max(b.inCount, b.outCount))),
    [hourlyBuckets]
  )

  const peakHour = useMemo(() => {
    let best = hourlyBuckets[2] || { label: '08h', inCount: 0 }
    for (const b of hourlyBuckets) {
      if (b.inCount > best.inCount) best = b
    }
    return best
  }, [hourlyBuckets])

  const methodStats = useMemo(() => {
    let pinCount = 0
    let qrCount = 0
    let photoCount = 0
    let gpsCount = 0
    let faceCount = 0

    for (const p of pointages) {
      if (p.status !== 'present' && p.status !== 'conflit_absence_pointage') continue
      const m = String(p.firstIn?.method || '').toLowerCase()
      if (m.includes('qr')) qrCount += 1
      else pinCount += 1
      if (p.hasPhoto) photoCount += 1
      if (p.hasGPS) gpsCount += 1
      if (p.hasFaceRecognition) faceCount += 1
    }

    const base = Math.max(1, Number(stats.presents) || pinCount + qrCount || 1)
    return [
      { id: 'pin', label: 'Code PIN / Poste', count: pinCount, pct: Math.min(100, Math.round((pinCount / base) * 100)), color: '#B86B35', Icon: Smartphone },
      { id: 'qr', label: 'Scan QR Code', count: qrCount, pct: Math.min(100, Math.round((qrCount / base) * 100)), color: '#26734D', Icon: QrCode },
      { id: 'photo', label: 'Photo vérifiée', count: photoCount, pct: Math.min(100, Math.round((photoCount / base) * 100)), color: '#D4AF37', Icon: Camera },
      { id: 'gps', label: 'GPS validé', count: gpsCount, pct: Math.min(100, Math.round((gpsCount / base) * 100)), color: '#3D2B1F', Icon: MapPin },
      { id: 'face', label: 'Reco faciale', count: faceCount, pct: Math.min(100, Math.round((faceCount / base) * 100)), color: '#7C5CFC', Icon: ScanFace },
    ]
  }, [pointages, stats.presents])

  const totalTeam = Math.max(1, Number(stats.total) || pointages.length || 1)
  const presentShare = Math.round(((Number(stats.presents) || 0) / totalTeam) * 100)
  const circumference = 2 * Math.PI * 36
  const presentStroke = (presentShare / 100) * circumference

  return (
    <section className="pointages-charts-grid" aria-label="Graphiques d’analyse des pointages">
      {/* CHART 1: FLUX HORAIRE */}
      <article className="pointages-chart-card">
        <div className="pointages-chart-header">
          <div>
            <h3>Flux horaire des Arrivées & Sorties</h3>
            <p>Répartition des pointages enregistrés entre 06h et 20h</p>
          </div>
          <div className="pointages-chart-legend">
            <span className="is-in">● Entrées (pic : {peakHour.label})</span>
            <span className="is-out">● Sorties</span>
          </div>
        </div>

        <div className="pointages-hourly-chart">
          <svg viewBox="0 0 540 165" className="pointages-hourly-svg" role="img" aria-label="Histogramme horaire des entrées et sorties">
            {[0, 0.5, 1].map((ratio, idx) => {
              const y = 20 + ratio * 112
              return (
                <line
                  key={idx}
                  x1="16"
                  y1={y}
                  x2="524"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="3 3"
                />
              )
            })}

            {hourlyBuckets.map((b, idx) => {
              const slotWidth = 508 / hourlyBuckets.length
              const xCenter = 16 + idx * slotWidth + slotWidth / 2
              const inHeight = Math.max(3, (b.inCount / maxHourly) * 108)
              const outHeight = Math.max(3, (b.outCount / maxHourly) * 108)
              const baseLine = 132

              return (
                <g key={b.hour}>
                  <rect
                    x={xCenter - 8}
                    y={baseLine - inHeight}
                    width="7"
                    height={inHeight}
                    rx="3.5"
                    fill="#26734D"
                  >
                    <title>{`${b.label} · ${b.inCount} entrée(s)`}</title>
                  </rect>
                  <rect
                    x={xCenter + 1}
                    y={baseLine - outHeight}
                    width="7"
                    height={outHeight}
                    rx="3.5"
                    fill="#B86B35"
                  >
                    <title>{`${b.label} · ${b.outCount} sortie(s)`}</title>
                  </rect>
                  {idx % 2 === 0 && (
                    <text
                      x={xCenter}
                      y="152"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="currentColor"
                      opacity="0.68"
                    >
                      {b.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </article>

      {/* CHART 2: DONUT + MÉTHODES DE VÉRIFICATION */}
      <article className="pointages-chart-card">
        <div className="pointages-chart-header">
          <div>
            <h3>Méthodes & Preuves de Pointage</h3>
            <p>Canaux d’authentification utilisés aujourd’hui</p>
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
                strokeDasharray={`${presentStroke} ${circumference}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="pointages-donut-center">
              <strong>{presentShare}%</strong>
              <span>Présence</span>
            </div>
          </div>

          <div className="pointages-methods-bars">
            {methodStats.map((m) => {
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
                    <span style={{ width: `${Math.max(6, m.pct)}%`, background: m.color }} />
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

export function PointagesLivePulseRibbon({
  pointages = [],
  selectedEmployeeId,
  onSelectPointage,
}) {
  if (!pointages.length) return null

  return (
    <section className="pointages-live-pulse" aria-label="Live Pulse de l’équipe">
      <div className="pointages-live-pulse-header">
        <span className="pointages-live-pulse-title">
          <span className="pointages-live-pulse-dot" />
          Live Pulse · Équipe du jour ({pointages.length})
        </span>
        <div className="pointages-live-pulse-legend">
          <span style={{ color: 'var(--pt-good)' }}>● À l’heure</span>
          <span style={{ color: 'var(--pt-amber)' }}>● En retard</span>
          <span>● Absent / Congé</span>
        </div>
      </div>

      <div className="pointages-live-pulse-track">
        {pointages.slice(0, 18).map((p) => {
          const late = isLatePointage(p)
          const isPresent = p.status === 'present' || p.status === 'conflit_absence_pointage'
          const ringColor = isPresent
            ? (late ? 'var(--pt-amber)' : 'var(--pt-good)')
            : p.status === 'en_conge'
              ? '#8B5CF6'
              : 'rgba(125, 106, 88, 0.35)'
          const stateLabel = isPresent
            ? (late ? 'Retard' : 'À l’heure')
            : p.status === 'en_conge'
              ? 'Congé'
              : 'Absent'
          const initials = `${p.employee?.first_name?.[0] || ''}${p.employee?.last_name?.[0] || ''}` || 'EC'

          return (
            <button
              type="button"
              key={p.employee?.id}
              className={`pointages-pulse-avatar-btn${selectedEmployeeId === p.employee?.id ? ' is-selected' : ''}`}
              onClick={() => onSelectPointage(p)}
              title={`${p.employee?.first_name || ''} ${p.employee?.last_name || ''} · ${stateLabel}`}
            >
              <span className="pointages-pulse-ring" style={{ '--ring-color': ringColor }}>
                <span className="pointages-pulse-photo">
                  {p.employee?.photo_url ? (
                    <img src={p.employee.photo_url} alt="" />
                  ) : (
                    initials
                  )}
                </span>
              </span>
              <span className="pointages-pulse-name">{p.employee?.first_name || 'Employé'}</span>
              <span className="pointages-pulse-state" style={{ color: ringColor }}>
                {stateLabel}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function PointagesPassportGrid({
  pointages = [],
  selectedEmployeeId,
  onSelectPointage,
}) {
  if (!pointages.length) return null

  return (
    <section className="pointages-passport-section" aria-label="Passeport de Présence">
      <div className="pointages-passport-grid">
        {pointages.slice(0, 8).map((p) => {
          const late = isLatePointage(p)
          const isPresent = p.status === 'present' || p.status === 'conflit_absence_pointage'
          const rawMethod = String(p.firstIn?.method || '').toLowerCase()
          const hasPin = isPresent && (rawMethod.includes('pin') || rawMethod.includes('code') || rawMethod.includes('poste') || !rawMethod)
          const hasQr = isPresent && rawMethod.includes('qr')
          const entryLabel = p.firstIn?.check_time ? formaterHeureLocale(p.firstIn.check_time) : '08:00'
          const exitLabel = p.lastOut?.check_time ? formaterHeureLocale(p.lastOut.check_time) : '18:00'
          const progressPct = isPresent
            ? Math.max(18, Math.min(100, Math.round(((p.totalSecondes || 14400) / (8 * 3600)) * 100)))
            : 0
          const initials = `${p.employee?.first_name?.[0] || ''}${p.employee?.last_name?.[0] || ''}` || 'EC'

          return (
            <article
              key={p.employee?.id}
              className={`pointages-passport-card${selectedEmployeeId === p.employee?.id ? ' is-selected' : ''}`}
              onClick={() => onSelectPointage(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectPointage(p)
                }
              }}
            >
              <div className="pointages-passport-top">
                <div className="pointages-passport-avatar">
                  {p.employee?.photo_url ? (
                    <img src={p.employee.photo_url} alt="" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="pointages-passport-identity">
                  <strong>{p.employee?.first_name} {p.employee?.last_name}</strong>
                  <span>{p.employee?.matricule}{p.employee?.position ? ` · ${p.employee.position}` : ' · Équipe'}</span>
                </div>
              </div>

              <div className="pointages-passport-timeline">
                <div className="pointages-passport-timeline-top">
                  <span>{isPresent ? entryLabel : 'Sans entrée'}</span>
                  <span>{p.totalSecondes > 0 ? formaterDureeComplete(p.totalSecondes) : (p.status === 'en_conge' ? 'Congé' : '—')}</span>
                </div>
                <div className={`pointages-passport-bar${late ? ' is-late' : ''}`}>
                  <span style={{ width: `${progressPct}%` }} />
                </div>
                <div className="pointages-passport-timeline-bottom">
                  <span>08:00</span>
                  <span>{p.lastOut?.check_time ? exitLabel : '18:00'}</span>
                </div>
              </div>

              <div className="pointages-passport-badges">
                <span className={`pointages-proof-chip${hasPin ? ' is-verified' : ''}`}>
                  <Smartphone size={12} /> Code PIN
                </span>
                <span className={`pointages-proof-chip${hasQr ? ' is-verified' : ''}`}>
                  <QrCode size={12} /> QR Code
                </span>
                <span className={`pointages-proof-chip${p.hasPhoto ? ' is-verified' : ''}`}>
                  <Camera size={12} /> Photo vérifiée
                </span>
                <span className={`pointages-proof-chip${p.hasGPS ? ' is-verified' : ''}`}>
                  <MapPin size={12} /> GPS validé
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function PointagesSlideOverDrawer({
  pointage,
  canEdit,
  statuerEstimation,
  estimationEnCours,
  onModify,
  onShareEmployee,
  onClose,
}) {
  if (!pointage) return null
  const checkPhotoUrl = getFirstPhotoUrl(pointage) || pointage.employee?.photo_url || null
  const needsEstimationDecision = Boolean(pointage.lastOut && estEstimationAStatuer(pointage.lastOut))

  return (
    <div className="pointages-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="pointages-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Inspection du pointage de ${pointage.employee?.first_name || ''} ${pointage.employee?.last_name || ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointages-drawer-header">
          <div>
            <h3>Inspection du pointage</h3>
            <span style={{ fontSize: 11, color: 'var(--pt-muted)' }}>
              {pointage.employee?.first_name} {pointage.employee?.last_name} · {pointage.employee?.matricule}
            </span>
          </div>
          <button type="button" className="pointages-drawer-close" onClick={onClose} aria-label="Fermer l’inspection">
            <X size={16} />
          </button>
        </div>

        <div className="pointages-drawer-photo-frame">
          {checkPhotoUrl ? (
            <PhotoSignee
              url={checkPhotoUrl}
              alt={`Photo de ${pointage.employee?.first_name || ''}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="pointages-drawer-photo-empty">
              <EnCheckBrandMark size={44} />
              <span>Aucune photo capturée sur ce pointage</span>
            </div>
          )}
        </div>

        <div className="pointages-passport-timeline">
          <div className="pointages-passport-timeline-top">
            <span>Entrée : {pointage.firstIn?.check_time ? formaterHeureLocale(pointage.firstIn.check_time) : '—'}</span>
            <span>Sortie : {pointage.lastOut?.check_time ? formaterHeureLocale(pointage.lastOut.check_time) : '—'}</span>
          </div>
          <div className="pointages-passport-timeline-bottom">
            <span>Durée : {formaterDureeComplete(pointage.totalSecondes || 0)}</span>
            <span>{pointage.hasGPS ? '📍 GPS validé' : 'Poste / Badge'}</span>
          </div>
        </div>

        <div className="pointages-drawer-actions">
          {canEdit && needsEstimationDecision && statuerEstimation && (
            <button
              type="button"
              className="pointages-drawer-btn is-primary"
              disabled={estimationEnCours === pointage.lastOut?.id}
              onClick={() => statuerEstimation(pointage.lastOut, 'valider')}
            >
              <CheckCircle2 size={15} />
              <span>Valider Pointage</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              className="pointages-drawer-btn is-copper"
              onClick={() => {
                onModify(pointage)
                onClose()
              }}
            >
              <Edit size={15} />
              <span>Corriger / Modifier</span>
            </button>
          )}

          <button
            type="button"
            className="pointages-drawer-btn is-outline"
            onClick={() => {
              onShareEmployee(pointage)
              onClose()
            }}
          >
            <MessageCircle size={15} />
            <span>Partager ce pointage</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
