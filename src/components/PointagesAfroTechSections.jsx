import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Coffee,
  Edit,
  ExternalLink,
  Lock,
  MapPin,
  MessageCircle,
  Moon,
  QrCode,
  ScanFace,
  Smartphone,
  Sun,
  Timer,
  UserCheck,
  X,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import {
  AdinkraWatermarkSvg,
  CulturalCalabashPauseSvg,
  CulturalPresenceSvg,
  CulturalProofSvg,
  CulturalShieldSvg,
  CulturalTimeDrumSvg,
  KenteFriezeSvg,
} from './AfroCulturalSvg'
import { formaterTempsPauseEnDirect } from '../services/pausesService'
import { estEstimationAStatuer } from '../services/seuilsPointage'
import {
  formaterDureeComplete,
  formaterHeureLocale,
  getHeuresMinutesLocales,
  minutesDepuisMinuit,
} from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

const parseHHMMToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return null
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

const isLatePointage = (p) => {
  if (p?.status !== 'present' || !p?.firstIn?.check_time) return false
  const sched = p?.scheduleInfo
  if (!sched || sched.mode === 'none' || !sched.startTime) return false
  const startMins = parseHHMMToMinutes(sched.startTime)
  if (startMins == null) return false
  const tolerance = Number(sched.toleranceMinutes) || 0
  const checkMins = minutesDepuisMinuit(p.firstIn.check_time)
  return typeof checkMins === 'number' && checkMins > startMins + tolerance
}

const isNightShiftPointage = (p) => {
  if (!p) return false
  // 1) Fin de garde de nuit rattachée à la veille (aucune entrée de jour aujourd'hui)
  if (p.status === 'nuit_rattachee') return true

  // 2) Prise de service nocturne (entrée entre 20h00 et 04h59)
  if (p.firstIn?.check_time) {
    const inParts = getHeuresMinutesLocales(p.firstIn.check_time)
    if (inParts && (inParts.heures >= 20 || inParts.heures < 5)) return true

    // 3) Service commencé en soirée (>= 18h) et terminé le lendemain matin (< 09h)
    if (p.lastOut?.check_time && !p.lastOut.is_auto_closed && !p.lastOut.__virtual) {
      const outParts = getHeuresMinutesLocales(p.lastOut.check_time)
      if (
        inParts?.jourISO &&
        outParts?.jourISO &&
        outParts.jourISO > inParts.jourISO &&
        inParts.heures >= 18 &&
        outParts.heures < 9
      ) {
        return true
      }
    }
  }
  return false
}

const getFirstPhotoUrl = (p) => {
  if (!p?.attendances?.length) return null
  for (const att of p.attendances) {
    const url = att?.pointages_photos?.[0]?.photo_url
    if (url) return url
  }
  return null
}

// Carte interactive Leaflet intégrée dans le tiroir d'inspection
function PointageInlineMap({ gps, attendances = [], employeeName = 'Employé' }) {
  const containerRef = useRef(null)
  const mapInstanceRef = useRef(null)

  const gpsPoints = useMemo(() => {
    const pts = (attendances || [])
      .filter((a) => a?.location_lat != null && a?.location_lng != null)
      .map((a) => ({
        id: a.id,
        lat: Number(a.location_lat),
        lng: Number(a.location_lng),
        type: String(a.check_type || '').toLowerCase() === 'out' ? 'Sortie' : 'Entrée',
        time: formaterHeureLocale(a.check_time),
        inZone: a.is_within_zone !== false,
        accuracy: a.gps_accuracy != null ? Math.round(Number(a.gps_accuracy)) : 20,
      }))
      .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))

    if (!pts.length && gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)) {
      pts.push({
        id: 'primary',
        lat: gps.lat,
        lng: gps.lng,
        type: 'Pointage',
        time: '',
        inZone: gps.isWithinZone !== false,
        accuracy: gps.accuracy || 20,
      })
    }
    return pts
  }, [attendances, gps])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !gpsPoints.length) return undefined

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }
    if (el._leaflet_id) {
      el._leaflet_id = null
    }

    const first = gpsPoints[0]
    const map = L.map(el, {
      center: [first.lat, first.lng],
      zoom: 16,
      zoomControl: true,
      attributionControl: false,
    })
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    const bounds = []
    gpsPoints.forEach((pt) => {
      const color = pt.inZone ? '#26734D' : '#C23B2B'
      L.circle([pt.lat, pt.lng], {
        radius: Math.max(12, Math.min(120, pt.accuracy || 20)),
        color,
        fillColor: color,
        fillOpacity: 0.14,
        weight: 1.5,
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: 'pointages-leaflet-pin',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35);display:grid;place-items:center;color:#fff;font-size:11px;font-weight:800;">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      const marker = L.marker([pt.lat, pt.lng], { icon: pinIcon }).addTo(map)
      marker.bindPopup(
        `<strong>${employeeName}</strong><br/>${pt.type}${pt.time ? ` · ${pt.time}` : ''}<br/><small>${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}</small>`
      )
      bounds.push([pt.lat, pt.lng])
    })

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 17 })
    }

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize()
    }, 180)

    return () => {
      window.clearTimeout(resizeTimer)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [gpsPoints, employeeName])

  if (!gpsPoints.length) return null

  return (
    <div className="pointages-inline-map-wrap">
      <div
        ref={containerRef}
        className="pointages-inline-map-canvas"
        aria-label={`Carte géolocalisée de ${employeeName}`}
      />
    </div>
  )
}

export function PointagesCulturalHero({
  formattedDate,
  checkingPermissions,
  canEditPointages,
  anomaliesCount = 0,
  criticalAnomaliesCount = 0,
  darkMode = true,
  onToggleTheme,
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
            <span>On gère ! · Analyse 24h, plannings, pauses en direct, GPS & reco faciale</span>
          </div>
        </div>

        <div className="pointages-cultural-right">
          <span className="pointages-cultural-date">{formattedDate}</span>

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
  selectedDate,
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

  const lateCount = useMemo(
    () => pointages.filter((p) => isLatePointage(p)).length,
    [pointages]
  )
  const nightCount = useMemo(
    () => pointages.filter((p) => isNightShiftPointage(p, selectedDate)).length,
    [pointages, selectedDate]
  )
  const presumedCount = useMemo(
    () => pointages.filter((p) => p.lastOut && estEstimationAStatuer(p.lastOut)).length,
    [pointages]
  )
  const pausesSummary = useMemo(() => {
    let totalCount = 0
    let activeCount = 0
    let unplannedCount = 0
    for (const p of pointages) {
      for (const pa of p.pauses || []) {
        totalCount += 1
        if (pa.ouverte) activeCount += 1
        if (pa.estNonPlanifiee) unplannedCount += 1
      }
    }
    return { totalCount, activeCount, unplannedCount }
  }, [pointages])

  const gpsCount = useMemo(
    () => pointages.filter((p) => p.hasGPS).length,
    [pointages]
  )
  const faceCount = useMemo(
    () => pointages.filter((p) => p.hasFaceRecognition).length,
    [pointages]
  )
  const scheduleBreakdown = useMemo(() => {
    let personal = 0
    let enterprise = 0
    let free = 0
    for (const p of pointages) {
      const m = p.scheduleInfo?.mode
      if (m === 'personal') personal += 1
      else if (m === 'enterprise') enterprise += 1
      else free += 1
    }
    return { personal, enterprise, free }
  }, [pointages])

  const presenceRate = total > 0 ? Math.round((presents / total) * 100) : 0
  const onTimeCount = Math.max(0, presents - lateCount)
  const punctualityRate = presents > 0 ? Math.round((onTimeCount / presents) * 100) : 100
  const verifiedTotal = gpsCount + faceCount + avecPhoto

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
      title: '2. Plannings & Retards',
      value: String(lateCount).padStart(2, '0'),
      badge: scheduleBreakdown.personal + scheduleBreakdown.enterprise > 0
        ? `${punctualityRate}% à l’heure`
        : 'Horaire libre',
      subtitle: `${scheduleBreakdown.personal} perso · ${scheduleBreakdown.enterprise} général · ${scheduleBreakdown.free} libre`,
      progress: punctualityRate,
      tone: 'amber',
      active: false,
      onClick: () => onUpdateFilter && onUpdateFilter('status', 'present'),
      IconSvg: CulturalTimeDrumSvg,
      sparkPoints: '4,16 18,14 32,18 46,12 60,15 74,9 88,8',
    },
    {
      id: 'night-and-breaks',
      title: '3. Gardes de nuit, Pauses & Sorties',
      value: `${nightCount} 🌙 · ${pausesSummary.totalCount} ☕`,
      badge: pausesSummary.activeCount > 0
        ? `⏱️ ${pausesSummary.activeCount} pause(s) en cours`
        : presumedCount + conflits > 0
          ? `${presumedCount + conflits} à statuer`
          : `${pausesSummary.unplannedCount} non planifiée(s)`,
      subtitle: `${nightCount} nuit · ${pausesSummary.totalCount} pause${pausesSummary.totalCount > 1 ? 's' : ''} (${pausesSummary.unplannedCount} hors planning) · ${presumedCount} sortie${presumedCount > 1 ? 's' : ''} présumée${presumedCount > 1 ? 's' : ''}`,
      progress: Math.min(100, Math.max(18, (nightCount + pausesSummary.totalCount + presumedCount) * 14)),
      tone: pausesSummary.activeCount > 0 || presumedCount + conflits > 0 ? 'danger' : 'copper',
      active: filterStatus === 'nuit_rattachee',
      onClick: () => {
        if (nightCount > 0 && onUpdateFilter) {
          onUpdateFilter('status', filterStatus === 'nuit_rattachee' ? 'tous' : 'nuit_rattachee')
        } else if (onToggleAlerts) {
          onToggleAlerts()
        }
      },
      IconSvg: CulturalShieldSvg,
      sparkPoints: '4,20 18,19 32,14 46,16 60,11 74,13 88,10',
    },
    {
      id: 'proofs',
      title: '4. Géoloc, Reco Faciale & Photos',
      value: String(verifiedTotal).padStart(2, '0'),
      badge: `${gpsCount} GPS · ${faceCount} Reco · ${avecPhoto} Photos`,
      subtitle: 'Cliquez sur un employé pour voir la carte GPS & sa fiche',
      progress: presents > 0 ? Math.min(100, Math.max(22, Math.round((verifiedTotal / presents) * 100))) : 20,
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

export function PointagesAnalyticsCharts({ pointages = [], stats = {} }) {
  const hourlyBuckets = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => h)
    const map = new Map(
      hours.map((h) => [
        h,
        {
          hour: h,
          label: `${String(h).padStart(2, '0')}h`,
          isNight: h < 6 || h >= 20,
          inCount: 0,
          outCount: 0,
        },
      ])
    )

    for (const p of pointages) {
      for (const att of p.attendances || []) {
        if (!att?.check_time) continue
        const hm = getHeuresMinutesLocales(att.check_time)
        const h = hm ? hm.heures : new Date(att.check_time).getHours()
        const clamped = Math.max(0, Math.min(23, h))
        const bucket = map.get(clamped)
        if (!bucket) continue
        if (String(att.check_type || '').toLowerCase() === 'in') bucket.inCount += 1
        else bucket.outCount += 1
      }
    }

    return [...map.values()]
  }, [pointages])

  const maxHourly = useMemo(
    () => Math.max(3, ...hourlyBuckets.map((b) => Math.max(b.inCount, b.outCount))),
    [hourlyBuckets]
  )

  const nightActivityTotal = useMemo(
    () => hourlyBuckets.filter((b) => b.isNight).reduce((acc, b) => acc + b.inCount + b.outCount, 0),
    [hourlyBuckets]
  )

  const methodStats = useMemo(() => {
    let pinCount = 0
    let qrCount = 0
    let photoCount = 0
    let gpsCount = 0
    let faceCount = 0
    let pausesCount = 0
    let unplannedPausesCount = 0

    for (const p of pointages) {
      if (p.pauses?.length) {
        pausesCount += p.pauses.length
        unplannedPausesCount += p.pauses.filter((pa) => pa.estNonPlanifiee).length
      }
      if (p.status !== 'present' && p.status !== 'conflit_absence_pointage' && p.status !== 'nuit_rattachee') continue
      const m = String(p.firstIn?.method || '').toLowerCase()
      if (m.includes('qr')) qrCount += 1
      else if (p.firstIn) pinCount += 1
      if (p.hasPhoto) photoCount += 1
      if (p.hasGPS) gpsCount += 1
      if (p.hasFaceRecognition) faceCount += 1
    }

    const base = Math.max(1, Number(stats.presents) || pinCount + qrCount || 1)
    return [
      { id: 'pin', label: 'Code PIN / Poste', count: `${pinCount}`, pct: Math.min(100, Math.round((pinCount / base) * 100)), color: '#B86B35', Icon: Smartphone },
      { id: 'qr', label: 'Scan QR Code', count: `${qrCount}`, pct: Math.min(100, Math.round((qrCount / base) * 100)), color: '#26734D', Icon: QrCode },
      { id: 'gps', label: 'Géolocalisation GPS', count: `${gpsCount}`, pct: Math.min(100, Math.round((gpsCount / base) * 100)), color: '#0EA5E9', Icon: MapPin },
      { id: 'face', label: 'Reconnaissance faciale', count: `${faceCount}`, pct: Math.min(100, Math.round((faceCount / base) * 100)), color: '#7C5CFC', Icon: ScanFace },
      { id: 'photo', label: 'Photo signée', count: `${photoCount}`, pct: Math.min(100, Math.round((photoCount / base) * 100)), color: '#D4AF37', Icon: Camera },
      {
        id: 'pauses',
        label: `Pauses (${unplannedPausesCount} hors planning)`,
        count: `${pausesCount}`,
        pct: Math.min(100, Math.round((pausesCount / base) * 100)),
        color: '#E58D4B',
        Icon: Coffee,
      },
    ]
  }, [pointages, stats.presents])

  const totalTeam = Math.max(1, Number(stats.total) || pointages.length || 1)
  const presentShare = Math.round(((Number(stats.presents) || 0) / totalTeam) * 100)
  const circumference = 2 * Math.PI * 36
  const presentStroke = (presentShare / 100) * circumference

  return (
    <section className="pointages-charts-grid" aria-label="Graphiques d’analyse 24h des pointages">
      <article className="pointages-chart-card">
        <div className="pointages-chart-header">
          <div>
            <h3>Flux 24h des Arrivées, Sorties & Gardes de nuit</h3>
            <p>Cycle complet 00h – 23h (zones 🌙 Nuit 00h–05h et 20h–23h + sorties J+1 incluses)</p>
          </div>
          <div className="pointages-chart-legend">
            <span className="is-in">● Entrées</span>
            <span className="is-out">● Sorties</span>
            <span className="is-night">🌙 Nuit ({nightActivityTotal})</span>
          </div>
        </div>

        <div className="pointages-hourly-chart">
          <svg viewBox="0 0 600 172" className="pointages-hourly-svg" role="img" aria-label="Histogramme 24h des entrées, sorties et gardes de nuit">
            <rect x="14" y="14" width="142" height="122" rx="8" fill="rgba(56, 189, 248, 0.09)" />
            <rect x="490" y="14" width="96" height="122" rx="8" fill="rgba(56, 189, 248, 0.09)" />
            <text x="22" y="27" fontSize="9" fontWeight="700" fill="#38BDF8">🌙 Nuit 00h–05h</text>
            <text x="496" y="27" fontSize="9" fontWeight="700" fill="#38BDF8">🌙 20h–23h</text>

            {[0, 0.5, 1].map((ratio, idx) => {
              const y = 22 + ratio * 110
              return (
                <line
                  key={idx}
                  x1="14"
                  y1={y}
                  x2="586"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="3 3"
                />
              )
            })}

            {hourlyBuckets.map((b, idx) => {
              const slotWidth = 572 / hourlyBuckets.length
              const xCenter = 14 + idx * slotWidth + slotWidth / 2
              const inHeight = Math.max(3, (b.inCount / maxHourly) * 104)
              const outHeight = Math.max(3, (b.outCount / maxHourly) * 104)
              const baseLine = 134

              return (
                <g key={b.hour}>
                  <rect
                    x={xCenter - 5.5}
                    y={baseLine - inHeight}
                    width="5"
                    height={inHeight}
                    rx="2.5"
                    fill={b.isNight ? '#38BDF8' : '#26734D'}
                  >
                    <title>{`${b.label}${b.isNight ? ' (Nuit)' : ''} · ${b.inCount} entrée(s)`}</title>
                  </rect>
                  <rect
                    x={xCenter + 0.5}
                    y={baseLine - outHeight}
                    width="5"
                    height={outHeight}
                    rx="2.5"
                    fill="#D58D4B"
                  >
                    <title>{`${b.label}${b.isNight ? ' (Nuit)' : ''} · ${b.outCount} sortie(s)`}</title>
                  </rect>
                  {idx % 2 === 0 && (
                    <text
                      x={xCenter}
                      y="154"
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill={b.isNight ? '#38BDF8' : 'currentColor'}
                      opacity={b.isNight ? '0.9' : '0.68'}
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

      <article className="pointages-chart-card">
        <div className="pointages-chart-header">
          <div>
            <h3>Canaux, Géolocalisation, Reco Faciale & Pauses</h3>
            <p>Preuves terrain et pauses (planifiées ou non) sur la journée</p>
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
                    <strong>{m.count}</strong>
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

export function PointagesLivePulseRibbon({
  pointages = [],
  selectedDate,
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
          <span style={{ color: 'var(--pt-good)' }}>● À l’heure / Présent</span>
          <span style={{ color: 'var(--pt-amber)' }}>● En retard / En pause</span>
          <span style={{ color: '#38BDF8' }}>● Garde de nuit</span>
          <span>● Absent / Congé</span>
        </div>
      </div>

      <div className="pointages-live-pulse-track">
        {pointages.slice(0, 18).map((p) => {
          const late = isLatePointage(p)
          const night = isNightShiftPointage(p, selectedDate)
          const hasOpenPause = (p.pauses || []).some((pa) => pa.ouverte)
          const isPresent = p.status === 'present' || p.status === 'conflit_absence_pointage'
          const ringColor = hasOpenPause
            ? '#F59E0B'
            : night
              ? '#38BDF8'
              : isPresent
                ? (late ? 'var(--pt-amber)' : 'var(--pt-good)')
                : p.status === 'en_conge'
                  ? '#8B5CF6'
                  : 'rgba(125, 106, 88, 0.35)'
          const stateLabel = hasOpenPause
            ? '☕ En pause'
            : night
              ? '🌙 Nuit'
              : isPresent
                ? (late ? 'Retard' : 'Présent')
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
  selectedDate,
  selectedEmployeeId,
  onSelectPointage,
  onOpenEmployeeFiche,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!pointages.length) return null

  return (
    <section className="pointages-passport-section" aria-label="Passeport de Présence">
      <div className="pointages-passport-grid">
        {pointages.slice(0, 8).map((p) => {
          const late = isLatePointage(p)
          const night = isNightShiftPointage(p, selectedDate)
          const isPresent = p.status === 'present' || p.status === 'conflit_absence_pointage'
          const sched = p.scheduleInfo || { mode: 'none', label: 'Horaire libre (sans planning)' }
          const hasScheduleBounds = sched.mode !== 'none' && sched.startTime && sched.endTime

          const entryLabel = p.firstIn?.check_time
            ? formaterHeureLocale(p.firstIn.check_time)
            : (p.status === 'nuit_rattachee' ? '🌙 Garde J-1' : 'Sans entrée')
          const exitLabel = p.lastOut?.check_time ? formaterHeureLocale(p.lastOut.check_time) : null

          const progressPct = isPresent
            ? Math.max(16, Math.min(100, Math.round(((p.totalSecondes || 14400) / (8 * 3600)) * 100)))
            : p.status === 'nuit_rattachee'
              ? 100
              : 0

          const rawMethod = String(p.firstIn?.method || '').toLowerCase()
          const usedQr = isPresent && rawMethod.includes('qr')
          const usedPin = isPresent && !usedQr
          const pausesList = p.pauses || []
          const activePause = pausesList.find((pa) => pa.ouverte)
          const hasUnplannedPause = pausesList.some((pa) => pa.estNonPlanifiee)
          const totalPauseMin = pausesList.reduce((acc, pa) => acc + (Number(pa.dureeMinutes) || 0), 0)
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
                {onOpenEmployeeFiche && (
                  <button
                    type="button"
                    className="pointages-card-fiche-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenEmployeeFiche(p)
                    }}
                    title="Ouvrir la fiche de l’employé sans quitter Pointages"
                  >
                    <UserCheck size={12} />
                    <span>Fiche</span>
                  </button>
                )}
              </div>

              <div className="pointages-schedule-tag-row">
                <span className={`pointages-schedule-tag is-${sched.mode}`}>
                  <Calendar size={11} />
                  <span>
                    {sched.label}
                    {hasScheduleBounds ? ` (${sched.startTime} – ${sched.endTime})` : ''}
                  </span>
                </span>
                {night && (
                  <span className="pointages-schedule-tag is-night">
                    <Moon size={11} />
                    <span>Garde de nuit</span>
                  </span>
                )}
              </div>

              <div className="pointages-passport-timeline">
                <div className="pointages-passport-timeline-top">
                  <span>{isPresent ? `Entrée ${entryLabel}` : entryLabel}</span>
                  <span>
                    {p.totalSecondes > 0
                      ? formaterDureeComplete(p.totalSecondes)
                      : p.status === 'en_conge'
                        ? 'En congé'
                        : p.status === 'nuit_rattachee'
                          ? `Sortie à ${formaterHeureLocale(p.nuitRattachee?.heure || p.nuitRattachee?.sortie)}`
                          : '—'}
                  </span>
                </div>
                <div className={`pointages-passport-bar${late ? ' is-late' : ''}${night ? ' is-night' : ''}`}>
                  <span style={{ width: `${progressPct}%` }} />
                </div>
                <div className="pointages-passport-timeline-bottom">
                  {hasScheduleBounds ? (
                    <>
                      <span>Prévu {sched.startTime}</span>
                      <span>{exitLabel ? `Sortie ${exitLabel}` : `Prévu ${sched.endTime}`}</span>
                    </>
                  ) : isPresent ? (
                    <>
                      <span>Arrivée {entryLabel}</span>
                      <span>{exitLabel ? `Sortie ${exitLabel}` : 'En poste (horaire libre)'}</span>
                    </>
                  ) : (
                    <span>Aucun créneau imposé</span>
                  )}
                </div>
              </div>

              {/* Pauses effectuées (planifiées ou non planifiées) + chronomètre temps réel */}
              {pausesList.length > 0 && (
                <div className={`pointages-pause-inline${activePause ? ' is-live' : ''}`}>
                  <CulturalCalabashPauseSvg size={14} />
                  <span>
                    {activePause ? (
                      <>
                        <strong>⏱️ En pause en direct : {formaterTempsPauseEnDirect(activePause, nowMs)}</strong>
                        {` (depuis ${activePause.debutHHMM})`}
                      </>
                    ) : (
                      <>
                        {pausesList.length} pause{pausesList.length > 1 ? 's' : ''} ({totalPauseMin} min) ·{' '}
                        {pausesList[0].debutHHMM}
                        {pausesList[0].finHHMM ? ` → ${pausesList[0].finHHMM}` : ''}
                      </>
                    )}
                    {hasUnplannedPause && (
                      <em className="pointages-unplanned-pill">Hors planning</em>
                    )}
                  </span>
                </div>
              )}

              {isPresent ? (
                <div className="pointages-passport-badges">
                  {usedPin && (
                    <span className="pointages-proof-chip is-verified">
                      <Smartphone size={12} /> Code PIN
                    </span>
                  )}
                  {usedQr && (
                    <span className="pointages-proof-chip is-verified">
                      <QrCode size={12} /> QR Code
                    </span>
                  )}
                  {p.hasPhoto && (
                    <span className="pointages-proof-chip is-verified">
                      <Camera size={12} /> Photo vérifiée
                    </span>
                  )}
                  {p.hasGPS && (
                    <span className="pointages-proof-chip is-verified is-geo">
                      <MapPin size={12} />
                      GPS{p.gpsDetails?.distanceMeters != null ? ` · ${p.gpsDetails.distanceMeters}m` : ' validé'}
                    </span>
                  )}
                  {p.hasFaceRecognition && (
                    <span className="pointages-proof-chip is-verified is-face">
                      <ScanFace size={12} />
                      Reco{p.faceDetails?.score != null ? ` ${Math.round(p.faceDetails.score <= 1 ? p.faceDetails.score * 100 : p.faceDetails.score)}%` : ' faciale'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="pointages-passport-empty-status">
                  {p.status === 'en_conge'
                    ? `🌴 Absence / Congé${p.absenceReason ? ` · ${p.absenceReason}` : ''}`
                    : p.status === 'nuit_rattachee'
                      ? '🌙 Fin de garde de nuit rattachée à la veille'
                      : 'Aucun pointage enregistré aujourd’hui'}
                </div>
              )}
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
  onOpenEmployeeFiche,
  onShareEmployee,
  onClose,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!pointage) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [pointage])

  if (!pointage) return null
  const checkPhotoUrl = getFirstPhotoUrl(pointage) || pointage.employee?.photo_url || null
  const needsEstimationDecision = Boolean(pointage.lastOut && estEstimationAStatuer(pointage.lastOut))
  const sched = pointage.scheduleInfo || { mode: 'none', label: 'Horaire libre (sans planning)' }
  const gps = pointage.gpsDetails
  const face = pointage.faceDetails
  const pauses = pointage.pauses || []
  const fullName = `${pointage.employee?.first_name || ''} ${pointage.employee?.last_name || ''}`.trim() || 'Employé'

  return (
    <div className="pointages-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="pointages-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Inspection du pointage de ${fullName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointages-drawer-header">
          <div>
            <h3>Inspection du pointage</h3>
            <span style={{ fontSize: 11, color: 'var(--pt-muted)' }}>
              {fullName} · {pointage.employee?.matricule}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onOpenEmployeeFiche && (
              <button
                type="button"
                className="pointages-card-fiche-btn"
                onClick={() => onOpenEmployeeFiche(pointage)}
              >
                <UserCheck size={13} />
                <span>Fiche employé</span>
              </button>
            )}
            <button type="button" className="pointages-drawer-close" onClick={onClose} aria-label="Fermer l’inspection">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="pointages-drawer-photo-frame">
          {checkPhotoUrl ? (
            <PhotoSignee
              url={checkPhotoUrl}
              alt={`Photo de ${fullName}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="pointages-drawer-photo-empty">
              <EnCheckBrandMark size={44} />
              <span>Aucune photo capturée sur ce pointage</span>
            </div>
          )}
        </div>

        {/* 1. PLANNING & HORAIRES */}
        <div className="pointages-passport-timeline" style={{ marginBottom: 10 }}>
          <div className="pointages-passport-timeline-top">
            <span>Entrée : {pointage.firstIn?.check_time ? formaterHeureLocale(pointage.firstIn.check_time) : '—'}</span>
            <span>Sortie : {pointage.lastOut?.check_time ? formaterHeureLocale(pointage.lastOut.check_time) : '—'}</span>
          </div>
          <div className="pointages-passport-timeline-bottom">
            <span>Durée : {formaterDureeComplete(pointage.totalSecondes || 0)}</span>
            <span>
              {sched.label}
              {sched.startTime && sched.endTime ? ` (${sched.startTime}–${sched.endTime})` : ''}
            </span>
          </div>
        </div>

        {/* 2. CARTE INTERACTIVE & POINT GÉOLOCALISÉ */}
        <div className="pointages-drawer-section">
          <div className="pointages-drawer-section-title">
            <MapPin size={14} color="#38BDF8" />
            <strong>Carte & Point géolocalisé de l’employé</strong>
          </div>
          {gps ? (
            <div className="pointages-geo-card">
              <PointageInlineMap
                gps={gps}
                attendances={pointage.attendances}
                employeeName={fullName}
              />
              <div className="pointages-geo-meta">
                <span className={`pointages-geo-zone-pill ${gps.isWithinZone === false ? 'is-out' : 'is-in'}`}>
                  {gps.isWithinZone === false ? '⚠️ Hors zone autorisée' : '✓ Dans le périmètre'}
                </span>
                {gps.distanceMeters != null && <span>Distance : <strong>{gps.distanceMeters} m</strong></span>}
                {gps.accuracy != null && <span>Précision : ±{gps.accuracy} m</span>}
              </div>
              <div className="pointages-geo-coords">
                Coordonnées : {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
              </div>
              <a
                className="pointages-geo-map-link"
                href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin size={13} />
                <span>Ouvrir dans Google Maps</span>
                <ExternalLink size={12} />
              </a>
            </div>
          ) : (
            <p className="pointages-drawer-muted">Aucune coordonnée GPS enregistrée pour ce pointage.</p>
          )}
        </div>

        {/* 3. RECONNAISSANCE FACIALE */}
        {pointage.hasFaceRecognition && (
          <div className="pointages-drawer-section">
            <div className="pointages-drawer-section-title">
              <ScanFace size={14} color="#7C5CFC" />
              <strong>Reconnaissance faciale</strong>
            </div>
            <div className="pointages-face-card">
              <span>Statut : <strong>{face?.verified ? 'Identité confirmée ✓' : 'Vérifiée'}</strong></span>
              {face?.score != null && (
                <span>Score : <strong>{Math.round(face.score <= 1 ? face.score * 100 : face.score)}%</strong></span>
              )}
              {face?.livenessPassed != null && (
                <span>Preuve de vie : <strong>{face.livenessPassed ? 'Validée' : 'Échec'}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* 4. PAUSES DE L'EMPLOYÉ (PLANIFIÉES + NON PLANIFIÉES + TEMPS RÉEL) */}
        <div className="pointages-drawer-section">
          <div className="pointages-drawer-section-title">
            <Clock size={14} color="var(--pt-copper)" />
            <strong>Pauses effectuées ({pauses.length})</strong>
          </div>
          {pauses.length > 0 ? (
            <div className="pointages-drawer-pauses-list">
              {pauses.map((pa) => (
                <div className="pointages-drawer-pause-item" key={pa.id}>
                  <div>
                    <strong>
                      {pa.debutHHMM} → {pa.finHHMM || 'En cours'}
                      {pa.estNonPlanifiee && <em className="pointages-unplanned-pill">Hors planning</em>}
                    </strong>
                    <span>
                      {pa.source === 'inter_sessions'
                        ? 'Coupure pointée entre 2 sessions (non planifiée)'
                        : pa.statut === 'presumee'
                          ? 'Pause présumée du planning'
                          : pa.estNonPlanifiee
                            ? 'Pause réelle effectuée (hors planning)'
                            : 'Pause réelle pointée'}
                    </span>
                  </div>
                  <span className={`pointages-drawer-pause-duration${pa.ouverte ? ' is-live' : ''}`}>
                    {pa.ouverte && <Timer size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                    {formaterTempsPauseEnDirect(pa, nowMs)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pointages-drawer-muted">
              {sched.hasBreak && sched.breakStart
                ? `Créneau de pause prévu (${sched.breakStart} – ${sched.breakEnd || ''}), aucune pause pointée.`
                : 'Aucune pause enregistrée aujourd’hui (ni planifiée, ni hors planning).'}
            </p>
          )}
        </div>

        <div className="pointages-drawer-actions">
          {onOpenEmployeeFiche && (
            <button
              type="button"
              className="pointages-drawer-btn is-primary"
              onClick={() => onOpenEmployeeFiche(pointage)}
            >
              <UserCheck size={15} />
              <span>Accéder à la fiche de l’employé</span>
            </button>
          )}

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
              <span>Corriger / Modifier le pointage</span>
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
