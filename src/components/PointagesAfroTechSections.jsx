import PageCulturalBand from './PageCulturalBand'
import PlanningPayslipBadge from './PlanningPayslipBadge'
import IgnoredExitNotice from './IgnoredExitNotice'
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
} from './AfroCulturalSvg'
import {
  estPausePresumee,
  estPauseReelleEffectuee,
  estPointageEnRetard,
  estPresumeeValidee,
  estServiceDeNuit,
  formaterTempsPauseEnDirect,
  pausesVisiblesDansPointages,
} from '../services/pausesService'
import FeatureService from '../services/featureService'
import { estEstimationAStatuer } from '../services/seuilsPointage'
import {
  formaterDureeComplete,
  formaterHeureLocale,
  formaterHeureLocaleShort,
  getHeuresMinutesLocales,
} from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

const isLatePointage = (p) => estPointageEnRetard(p)
const isNightShiftPointage = (p) => estServiceDeNuit(p)

const formatMethodLabel = (method) => {
  const m = String(method || '').toLowerCase()
  if (m.includes('qr')) return 'QR Code'
  if (m.includes('face')) return 'Reco faciale'
  if (m.includes('poste')) return 'Poste kiosque'
  if (m.includes('pin') || m.includes('code')) return 'Code PIN'
  return 'Badge'
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

const buildDynamicSparkPoints = (progress = 0, hasActivity = true) => {
  if (!hasActivity || progress <= 0) {
    return '4,23 18,23 32,23 46,23 60,23 74,23 88,23'
  }
  const ratio = Math.max(0.08, Math.min(1, progress / 100))
  const ys = [0.25, 0.4, 0.35, 0.6, 0.72, 0.88, 1].map((step) =>
    Math.round(23 - step * ratio * 18)
  )
  const xs = [4, 18, 32, 46, 60, 74, 88]
  return xs.map((x, idx) => `${x},${ys[idx]}`).join(' ')
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
  onNavigate,
  onToggleAlerts,
  onShareWhatsApp,
}) {
  return (
    <header className="pointages-cultural-hero" aria-label="En-tête Pointages En-Check">
      <PageCulturalBand pathname="/pointages"/>
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

        {onNavigate && (
          <nav className="pointages-quick-nav" aria-label="Navigation rapide En-Check">
            <button type="button" onClick={() => onNavigate('/dashboard')}>Dashboard</button>
            <button type="button" className="is-active" aria-current="page">Pointages</button>
            <button type="button" onClick={() => onNavigate('/employes')}>Employés</button>
            <button type="button" onClick={() => onNavigate('/pauses')}>Pauses</button>
            <button type="button" onClick={() => onNavigate('/planning')}>Planning</button>
          </nav>
        )}

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
  filterStatus = 'tous',
  filterPhotos = 'all',
  onUpdateFilter,
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
    () => pointages.filter((p) => isNightShiftPointage(p)).length,
    [pointages]
  )
  const rattachedNightCount = useMemo(
    () => pointages.filter((p) => p.status === 'nuit_rattachee').length,
    [pointages]
  )
  const presumedCount = useMemo(
    () => pointages.filter((p) => p.lastOut && estEstimationAStatuer(p.lastOut)).length,
    [pointages]
  )
  const [nowMs, setNowMs] = useState(() => Date.now())
  const pausesSummary = useMemo(() => {
    let totalCount = 0
    let activeCount = 0
    let unplannedCount = 0
    const activeItems = []
    for (const p of pointages) {
      for (const pa of p.pauses || []) {
        if (!estPauseReelleEffectuee(pa)) continue
        totalCount += 1
        if (pa.ouverte) {
          activeCount += 1
          activeItems.push({ pointage: p, pause: pa, employee: p.employee })
        }
        if (pa.estNonPlanifiee) unplannedCount += 1
      }
    }
    return {
      totalCount,
      activeCount,
      unplannedCount,
      activeItems,
      firstActivePause: activeItems[0]?.pause || null,
    }
  }, [pointages])

  useEffect(() => {
    if (!pausesSummary.activeCount) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [pausesSummary.activeCount])

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
      sparkPoints: buildDynamicSparkPoints(presenceRate, presents > 0),
    },
    {
      id: 'punctuality',
      title: '2. Plannings & Retards',
      value: String(lateCount).padStart(2, '0'),
      badge: scheduleBreakdown.personal + scheduleBreakdown.enterprise > 0
        ? `${punctualityRate}% à l’heure`
        : 'Planning non disponible',
      subtitle: `${lateCount} en retard · ${scheduleBreakdown.personal} perso · ${scheduleBreakdown.enterprise} général · ${scheduleBreakdown.free} sans planning`,
      progress: lateCount > 0 ? Math.min(100, Math.round((lateCount / Math.max(1, presents)) * 100)) : punctualityRate,
      tone: 'amber',
      active: filterStatus === 'retard',
      onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'retard' ? 'tous' : 'retard'),
      IconSvg: CulturalTimeDrumSvg,
      sparkPoints: buildDynamicSparkPoints(
        lateCount > 0 ? Math.min(100, Math.round((lateCount / Math.max(1, presents)) * 100)) : (presents > 0 ? punctualityRate : 0),
        presents > 0 || lateCount > 0
      ),
    },
    {
      id: 'night-and-breaks',
      title: '3. Services de nuit, Pauses & Sorties',
      value: `${nightCount} 🌙 · ${presumedCount} ⏳`,
      badge: pausesSummary.activeCount > 0 && pausesSummary.firstActivePause
        ? `⏱️ ${pausesSummary.activeCount} pause(s) en cours · ${formaterTempsPauseEnDirect(pausesSummary.firstActivePause, nowMs)}`
        : presumedCount > 0
          ? `${presumedCount} sortie(s) présumée(s)`
          : `${nightCount} service(s) de nuit`,
      subtitle: 'Chaque sous-compteur ci-dessous active son propre filtre :',
      progress: nightCount + pausesSummary.totalCount + presumedCount > 0
        ? Math.min(100, Math.max(18, (nightCount + pausesSummary.totalCount + presumedCount) * 16))
        : 0,
      tone: pausesSummary.activeCount > 0 || presumedCount + conflits > 0 ? 'danger' : 'copper',
      active: ['service_nuit', 'nuit_rattachee', 'pause_en_cours', 'sortie_presumee'].includes(filterStatus),
      onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'service_nuit' ? 'tous' : 'service_nuit'),
      IconSvg: CulturalShieldSvg,
      sparkPoints: buildDynamicSparkPoints(
        Math.min(100, (nightCount + pausesSummary.totalCount + presumedCount) * 20),
        nightCount + pausesSummary.totalCount + presumedCount > 0
      ),
      subFilters: [
        {
          id: 'service_nuit',
          label: `🌙 Services de nuit (${nightCount})`,
          active: filterStatus === 'service_nuit',
          onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'service_nuit' ? 'tous' : 'service_nuit'),
        },
        {
          id: 'nuit_rattachee',
          label: `↩️ Fins garde J-1 (${rattachedNightCount})`,
          active: filterStatus === 'nuit_rattachee',
          onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'nuit_rattachee' ? 'tous' : 'nuit_rattachee'),
        },
        {
          id: 'pause_en_cours',
          label: pausesSummary.activeCount > 0 && pausesSummary.firstActivePause
            ? `☕ Pauses en cours (${pausesSummary.activeCount} · ⏱️ ${formaterTempsPauseEnDirect(pausesSummary.firstActivePause, nowMs)})`
            : `☕ Pauses en cours (${pausesSummary.activeCount})`,
          active: filterStatus === 'pause_en_cours',
          onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'pause_en_cours' ? 'tous' : 'pause_en_cours'),
        },
        {
          id: 'sortie_presumee',
          label: `⏳ Sorties présumées (${presumedCount})`,
          active: filterStatus === 'sortie_presumee',
          onClick: () => onUpdateFilter && onUpdateFilter('status', filterStatus === 'sortie_presumee' ? 'tous' : 'sortie_presumee'),
        },
      ],
    },
    {
      id: 'proofs',
      title: '4. Géoloc, Reco Faciale & Photos',
      value: String(verifiedTotal).padStart(2, '0'),
      badge: `${gpsCount} GPS · ${faceCount} Reco · ${avecPhoto} Photos`,
      subtitle: 'Cliquez sur un employé pour voir la carte GPS & sa fiche',
      progress: presents > 0 ? Math.min(100, Math.round((verifiedTotal / presents) * 100)) : 0,
      tone: 'copper',
      active: filterPhotos === 'with',
      onClick: () => onUpdateFilter && onUpdateFilter('photos', filterPhotos === 'with' ? 'all' : 'with'),
      IconSvg: CulturalProofSvg,
      sparkPoints: buildDynamicSparkPoints(
        presents > 0 ? Math.min(100, Math.round((verifiedTotal / presents) * 100)) : 0,
        verifiedTotal > 0
      ),
    },
  ]

  return (
    <>
      {pausesSummary.activeItems.length > 0 && (
        <section className="pauses-v2-live-banner" aria-label="Pauses réelles en cours en direct">
          <div className="pauses-v2-live-banner-left">
            <span className="pauses-v2-live-pulse-dot" />
            <strong style={{ fontSize: '0.88rem', color: 'var(--pv-text, var(--pt-text, #F7F2EB))' }}>
              {pausesSummary.activeItems.length === 1
                ? '1 collaborateur est actuellement en pause réelle :'
                : `${pausesSummary.activeItems.length} collaborateurs sont actuellement en pause réelle :`}
            </strong>
            {pausesSummary.activeItems.map(({ pause, employee }) => {
              const fullName = `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || pause.employe || 'Employé'
              const matricule = employee?.matricule || pause.matricule || ''
              return (
                <span key={pause.id} className="pauses-v2-live-chip">
                  <Timer size={14} color="#f59e0b" />
                  <strong>{fullName}</strong>
                  {matricule && <span style={{ opacity: 0.72 }}>({matricule})</span>}
                  <span style={{ opacity: 0.8 }}>depuis {pause.debutHHMM || '--:--'}</span>
                  <span className="pauses-v2-live-timer-mono">
                    ⏱️ {formaterTempsPauseEnDirect(pause, nowMs)}
                  </span>
                </span>
              )
            })}
          </div>
          <button
            type="button"
            className="pauses-v2-Ghost-btn"
            onClick={() => onUpdateFilter && onUpdateFilter('status', filterStatus === 'pause_en_cours' ? 'tous' : 'pause_en_cours')}
          >
            {filterStatus === 'pause_en_cours' ? 'Voir toute l’équipe' : 'Filtrer les pauses en direct'}
          </button>
        </section>
      )}
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

            {card.subFilters && (
              <div
                className="pointages-kpi-subfilters"
                onClick={(event) => event.stopPropagation()}
              >
                {card.subFilters.map((sf) => (
                  <span
                    key={sf.id}
                    role="button"
                    tabIndex={0}
                    className={`pointages-kpi-subfilter-chip${sf.active ? ' is-active' : ''}`}
                    onClick={sf.onClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        sf.onClick()
                      }
                    }}
                  >
                    {sf.label}
                  </span>
                ))}
              </div>
            )}
          </button>
        )
      })}
      </section>
    </>
  )
}

export function PointagesAnalyticsCharts({ pointages = [], stats = {} }) {
  //  Heure actuellement parcourue dans le flux 24h (null = aucun filtre).
  //  Les données sont relues à chaque changement de `pointages` : le panneau
  //  de détail est donc toujours synchronisé avec la journée affichée.
  const [activeHour, setActiveHour] = useState(null)
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
          entrees: [],
          sorties: [],
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
        const nom = `${p.employee?.first_name || ''} ${p.employee?.last_name || ''}`.trim() || 'Employé'
        const ligne = {
          employeId: p.employee?.id || null,
          nom,
          matricule: p.employee?.matricule || '',
          heure: formaterHeureLocale(att.check_time),
          methode: formatMethodLabel(att.method),
        }
        if (String(att.check_type || '').toLowerCase() === 'in') {
          bucket.inCount += 1
          bucket.entrees.push(ligne)
        } else {
          bucket.outCount += 1
          bucket.sorties.push(ligne)
        }
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

  const activeBucket = useMemo(
    () => (activeHour === null ? null : hourlyBuckets.find((b) => b.hour === activeHour) || null),
    [activeHour, hourlyBuckets]
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
      const realPauses = (p.pauses || []).filter((pa) => estPauseReelleEffectuee(pa))
      if (realPauses.length) {
        pausesCount += realPauses.length
        unplannedPausesCount += realPauses.filter((pa) => pa.estNonPlanifiee).length
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
              const slotX = 14 + idx * slotWidth
              const xCenter = slotX + slotWidth / 2
              const inHeight = Math.max(3, (b.inCount / maxHourly) * 104)
              const outHeight = Math.max(3, (b.outCount / maxHourly) * 104)
              const baseLine = 134
              const isActiveHour = activeHour === b.hour

              return (
                <g
                  key={b.hour}
                  className={`pointages-hourly-slot${isActiveHour ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${b.label} : ${b.inCount} entrée(s), ${b.outCount} sortie(s) — voir le détail`}
                  onClick={() => setActiveHour(isActiveHour ? null : b.hour)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setActiveHour(isActiveHour ? null : b.hour)
                    } else if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      setActiveHour((prev) => (prev === null ? 0 : (prev + 1) % 24))
                    } else if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      setActiveHour((prev) => (prev === null ? 23 : (prev + 23) % 24))
                    } else if (event.key === 'Escape') {
                      setActiveHour(null)
                    }
                  }}
                >
                  <rect
                    className="pointages-hourly-hit"
                    x={slotX}
                    y={14}
                    width={slotWidth}
                    height={146}
                    rx="6"
                  />
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

          {activeBucket ? (
            <div className="pointages-hourly-detail" role="status" aria-live="polite">
              <div className="pointages-hourly-detail-head">
                <strong>
                  {activeBucket.label}
                  {activeBucket.isNight ? ' · 🌙 Nuit' : ''}
                </strong>
                <span>
                  {activeBucket.entrees.length} entrée
                  {activeBucket.entrees.length > 1 ? 's' : ''} ·{' '}
                  {activeBucket.sorties.length} sortie
                  {activeBucket.sorties.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  className="pointages-hourly-detail-close"
                  onClick={() => setActiveHour(null)}
                >
                  Fermer
                </button>
              </div>

              {activeBucket.entrees.length === 0 && activeBucket.sorties.length === 0 ? (
                <p className="pointages-hourly-detail-empty">
                  Aucun badge enregistré entre {activeBucket.label} et{' '}
                  {`${String((activeBucket.hour + 1) % 24).padStart(2, '0')}h`}.
                </p>
              ) : (
                <ul className="pointages-hourly-detail-list">
                  {activeBucket.entrees.map((ligne, i) => (
                    <li key={`in-${i}`} className="is-in-row">
                      <span className="pointages-hourly-dot is-in" aria-hidden="true" />
                      <strong>{ligne.nom}</strong>
                      {ligne.matricule ? <em>{ligne.matricule}</em> : null}
                      <span className="pointages-hourly-time">{ligne.heure}</span>
                      <span className="pointages-hourly-method">Entrée · {ligne.methode}</span>
                    </li>
                  ))}
                  {activeBucket.sorties.map((ligne, i) => (
                    <li key={`out-${i}`} className="is-out-row">
                      <span className="pointages-hourly-dot is-out" aria-hidden="true" />
                      <strong>{ligne.nom}</strong>
                      {ligne.matricule ? <em>{ligne.matricule}</em> : null}
                      <span className="pointages-hourly-time">{ligne.heure}</span>
                      <span className="pointages-hourly-method">Sortie · {ligne.methode}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="pointages-hourly-detail-hint">
                Cliquez une heure du graphique pour l’ouvrir · ← → pour parcourir · Échap pour quitter.
              </p>
            </div>
          ) : (
            <p className="pointages-hourly-detail-hint is-idle">
              Cliquez sur une heure du graphique (ou utilisez ← →) pour lire qui a badgé, à quelle heure et par quel canal.
            </p>
          )}
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
  const [nowMs, setNowMs] = useState(() => Date.now())
  const hasAnyOpenPause = useMemo(
    () => pointages.some((p) => (p.pauses || []).some((pa) => pa.ouverte && estPauseReelleEffectuee(pa))),
    [pointages]
  )

  useEffect(() => {
    if (!hasAnyOpenPause) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasAnyOpenPause])

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
        {pointages.map((p) => {
          const late = isLatePointage(p)
          const night = isNightShiftPointage(p, selectedDate)
          const openRealPause = (p.pauses || []).find((pa) => pa.ouverte && estPauseReelleEffectuee(pa))
          const hasOpenPause = Boolean(openRealPause) || (p.pauses || []).some((pa) => pa.ouverte)
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
          const stateLabel = openRealPause
            ? `☕ ${formaterTempsPauseEnDirect(openRealPause, nowMs)}`
            : hasOpenPause
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
              title={`${p.employee?.first_name || ''} ${p.employee?.last_name || ''} · ${stateLabel}${openRealPause ? ` (depuis ${openRealPause.debutHHMM})` : ''}`}
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
  hasOvertimeFeature = false,
  onSelectPointage,
  onOpenEmployeeFiche,
  onExamineEstimation,
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
        {pointages.map((p) => {
          const late = isLatePointage(p)
          const night = isNightShiftPointage(p, selectedDate)
          const isPresent = p.status === 'present' || p.status === 'conflit_absence_pointage'
          const sched = p.scheduleInfo || { mode: 'none', label: 'Planning non disponible dans En-Check' }
          const hasScheduleBounds = sched.mode !== 'none' && sched.startTime && sched.endTime
          const needsEstimation = Boolean(p.lastOut && estEstimationAStatuer(p.lastOut))
          const isValidatedEstimation = Boolean(p.lastOut?.is_auto_closed && p.lastOut?.estimation_validee_le && !needsEstimation)
          const isRealExit = Boolean(p.lastOut?.check_time && !p.lastOut.is_auto_closed)

          const entryLabel = p.firstIn?.check_time ? formaterHeureLocale(p.firstIn.check_time) : null
          const entryMethodLabel = p.firstIn ? formatMethodLabel(p.firstIn.method) : null
          const exitLabel = p.lastOut?.check_time ? formaterHeureLocale(p.lastOut.check_time) : null
          const exitMethodLabel = isRealExit ? formatMethodLabel(p.lastOut.method || p.firstIn?.method) : null

          const progressPct = isPresent
            ? Math.max(16, Math.min(100, Math.round(((p.totalSecondes || 14400) / (8 * 3600)) * 100)))
            : p.status === 'nuit_rattachee'
              ? 100
              : 0

          //  Pauses réelles + pauses présumées VALIDÉES par un humain : une
          //  pause validée ne disparaît pas de l'écran, elle est seulement
          //  étiquetée (jamais comptée comme réelle).
          const pausesList = pausesVisiblesDansPointages(p.pauses)
          const pausesReelles = (p.pauses || []).filter((pa) => estPauseReelleEffectuee(pa))
          const activePause = pausesReelles.find((pa) => pa.ouverte)
          const presumedValidees = pausesList.filter((pa) => estPresumeeValidee(pa)).length
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

              <PlanningPayslipBadge entries={p.payslipEntries || []}/>
              <div className="pointages-schedule-tag-row">
                <span className={`pointages-schedule-tag is-${sched.mode}`}>
                  <Calendar size={11} />
                  <span>
                    {sched.mode === 'none' ? 'Planning non disponible dans En-Check' : sched.label}
                    {hasScheduleBounds ? ` (${sched.startTime} – ${sched.endTime})` : ''}
                  </span>
                </span>
                {night && (
                  <span className="pointages-schedule-tag is-night">
                    <Moon size={11} />
                    <span>Service de nuit</span>
                  </span>
                )}
              </div>

              {/* DISTINCTION EXPLICITE : ENTRÉE BADGÉE vs SORTIE BADGÉE / PRÉSUMÉE À CONFIRMER / PRÉSUMÉE VALIDÉE */}
              <IgnoredExitNotice exits={p.sortiesNonRetenues} />
              <div className="pointages-passport-timeline">
                {isPresent ? (
                  <div className="pointages-explicit-hours">
                    <div className="pointages-explicit-hour-row is-entry">
                      <span className="pointages-explicit-hour-kind">Entrée badgée</span>
                      <strong className="pointages-explicit-hour-val">
                        {entryLabel} · <small>{entryMethodLabel}</small>
                      </strong>
                    </div>

                    {needsEstimation ? (
                      <div className="pointages-explicit-hour-row is-presumed-pending">
                        <span className="pointages-explicit-hour-kind">⏳ Sortie présumée — à confirmer</span>
                        <strong className="pointages-explicit-hour-val">
                          {exitLabel} · <small>À confirmer</small>
                        </strong>
                      </div>
                    ) : isValidatedEstimation ? (
                      <div className="pointages-explicit-hour-row is-presumed-validated">
                        <span className="pointages-explicit-hour-kind">✓ Sortie présumée validée</span>
                        <strong className="pointages-explicit-hour-val">
                          {exitLabel} · <small>Origine présumée</small>
                        </strong>
                      </div>
                    ) : isRealExit ? (
                      <div className="pointages-explicit-hour-row is-real-exit">
                        <span className="pointages-explicit-hour-kind">Sortie badgée</span>
                        <strong className="pointages-explicit-hour-val">
                          {exitLabel} · <small>{exitMethodLabel}</small>
                        </strong>
                      </div>
                    ) : (
                      <div className="pointages-explicit-hour-row is-open-shift">
                        <span className="pointages-explicit-hour-kind">Sortie</span>
                        <strong className="pointages-explicit-hour-val">Session non clôturée (sortie à vérifier)</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pointages-passport-timeline-top">
                    <span>{p.status === 'nuit_rattachee' ? '🌙 Fin de garde J-1' : 'Sans entrée'}</span>
                    <span>
                      {p.status === 'en_conge'
                        ? 'En congé'
                        : p.status === 'nuit_rattachee'
                          ? `Sortie badgée à ${formaterHeureLocale(p.nuitRattachee?.heure || p.nuitRattachee?.sortie)}`
                          : '—'}
                    </span>
                  </div>
                )}

                <div className={`pointages-passport-bar${late ? ' is-late' : ''}${night ? ' is-night' : ''}`} style={{ marginTop: 8 }}>
                  <span style={{ width: `${progressPct}%` }} />
                </div>

                <div className="pointages-passport-timeline-bottom">
                  {needsEstimation ? (
                    <span className="pointages-unpaid-presumed-note">
                      Durée présumée non payée avant validation ({formaterDureeComplete(p.totalSecondesPresumes || 0)})
                    </span>
                  ) : (
                    <>
                      <span>
                        {p.totalSecondes > 0 ? `Durée : ${formaterDureeComplete(p.totalSecondes)}` : 'Durée : —'}
                      </span>
                      <span>
                        {hasScheduleBounds ? `Prévu ${sched.startTime}–${sched.endTime}` : 'Sans créneau En-Check'}
                      </span>
                      {hasOvertimeFeature && p.overtimeData?.hasOvertime && (
                        <span
                          className="pointages-passport-overtime"
                          title={
                            p.overtimeData.overtimeMajorSeconds > 0
                              ? `Total ${FeatureService.formatOvertimeDisplay(p.overtimeData.totalOvertimeSeconds)} · Normal ${FeatureService.formatOvertimeDisplay(p.overtimeData.overtimeSeconds)} (${p.overtimeData.rateApplied}%) · Majoré ${FeatureService.formatOvertimeDisplay(p.overtimeData.overtimeMajorSeconds)} (${p.overtimeData.rateMajorApplied}%)`
                              : `Heures supplémentaires : ${FeatureService.formatOvertimeDisplay(p.overtimeData.totalOvertimeSeconds)} au taux de ${p.overtimeData.rateApplied}%`
                          }
                        >
                          <span className="pointages-passport-overtime-total">
                            <Timer size={11} />
                            <span>
                              HS {FeatureService.formatOvertimeDisplay(p.overtimeData.totalOvertimeSeconds)}
                            </span>
                          </span>
                          <span className="pointages-passport-overtime-parts">
                            <em className="pointages-passport-overtime-rate">
                              Normal {FeatureService.formatOvertimeDisplay(p.overtimeData.overtimeSeconds)}
                              {' · '}
                              {p.overtimeData.rateApplied}%
                            </em>
                            {p.overtimeData.overtimeMajorSeconds > 0 && (
                              <em className="pointages-passport-overtime-rate is-major">
                                Majoré {FeatureService.formatOvertimeDisplay(p.overtimeData.overtimeMajorSeconds)}
                                {' · '}
                                {p.overtimeData.rateMajorApplied}%
                              </em>
                            )}
                          </span>
                        </span>
                      )}
                    </>
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
                    {presumedValidees > 0 && (
                      <em className="pointages-unplanned-pill is-presumed-validated">
                        dont {presumedValidees} présumée{presumedValidees > 1 ? 's' : ''} validée
                        {presumedValidees > 1 ? 's' : ''}
                      </em>
                    )}
                  </span>
                </div>
              )}

              {/* Pause(s) SUPPRIMÉE(S) — ce qui a été retiré ne disparaît pas en silence */}
              {(p.pausesSupprimees || []).length > 0 && (
                <div
                  className="pointages-pause-supprimee"
                  title={`Pause supprimée — ${(p.pausesSupprimees || [])
                    .map((l) =>
                      [
                        `de ${l.debut ? formaterHeureLocaleShort(l.debut) : '--:--'}`,
                        `à ${l.fin ? formaterHeureLocaleShort(l.fin) : 'en cours'}`,
                        l.source === 'presumee' ? 'présumée' : 'réelle',
                      ].join(' · '),
                    )
                    .join(' | ')}`}
                >
                  <span>
                    <strong>
                      🗑️ Pause supprimée
                      {p.pausesSupprimees.length > 1 ? ` (${p.pausesSupprimees.length})` : ''}
                    </strong>
                    {` · ${(p.pausesSupprimees || [])
                      .map(
                        (l) =>
                          `de ${l.debut ? formaterHeureLocaleShort(l.debut) : '--:--'} à ${
                            l.fin ? formaterHeureLocaleShort(l.fin) : 'en cours'
                          } (${l.source === 'presumee' ? 'présumée' : 'réelle'})`
                      )
                      .join(' · ')}`}
                  </span>
                </div>
              )}

              {isPresent ? (
                <div className="pointages-passport-badges">
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

              {/* UN SEUL BOUTON « EXAMINER L'ESTIMATION » SUR LE PASSEPORT */}
              {needsEstimation && onExamineEstimation && (
                <div className="pointages-passport-estimation-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="pointages-passport-est-btn is-examine"
                    onClick={() => onExamineEstimation(p)}
                  >
                    ⏳ Examiner l’estimation ({exitLabel})
                  </button>
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
  isInert = false,
  onModify,
  onOpenEmployeeFiche,
  onExamineEstimation,
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
  const isValidatedEstimation = Boolean(pointage.lastOut?.is_auto_closed && pointage.lastOut?.estimation_validee_le && !needsEstimationDecision)
  const isRealExit = Boolean(pointage.lastOut?.check_time && !pointage.lastOut.is_auto_closed)
  const sched = pointage.scheduleInfo || { mode: 'none', label: 'Planning non disponible dans En-Check' }
  const gps = pointage.gpsDetails
  const face = pointage.faceDetails
  const pauses = pointage.pauses || []
  const realPauses = pauses.filter((pa) => estPauseReelleEffectuee(pa))
  const presumedPauses = pauses.filter((pa) => estPausePresumee(pa) && pa.statut !== 'ecartee')
  const fullName = `${pointage.employee?.first_name || ''} ${pointage.employee?.last_name || ''}`.trim() || 'Employé'
  const entryMethodLabel = pointage.firstIn ? formatMethodLabel(pointage.firstIn.method) : null
  const exitMethodLabel = isRealExit ? formatMethodLabel(pointage.lastOut.method || pointage.firstIn?.method) : null

  return (
    <div
      className="pointages-drawer-backdrop"
      role="presentation"
      onClick={onClose}
      aria-hidden={isInert || undefined}
      style={isInert ? { pointerEvents: 'none', opacity: 0.45 } : undefined}
    >
      <aside
        className="pointages-drawer"
        role="dialog"
        aria-modal={!isInert}
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

        <IgnoredExitNotice exits={pointage.sortiesNonRetenues} />
        {/* 1. PLANNING & NATURE EXPLICITE DES HEURES */}
        <div className="pointages-passport-timeline" style={{ marginBottom: 10 }}>
          <div className="pointages-explicit-hours">
            <div className="pointages-explicit-hour-row is-entry">
              <span className="pointages-explicit-hour-kind">Entrée badgée</span>
              <strong className="pointages-explicit-hour-val">
                {pointage.firstIn?.check_time ? `${formaterHeureLocale(pointage.firstIn.check_time)} · ${entryMethodLabel}` : '—'}
              </strong>
            </div>

            {needsEstimationDecision ? (
              <div className="pointages-explicit-hour-row is-presumed-pending">
                <span className="pointages-explicit-hour-kind">⏳ Sortie présumée — à confirmer</span>
                <strong className="pointages-explicit-hour-val">
                  {formaterHeureLocale(pointage.lastOut.check_time)} · À confirmer
                </strong>
              </div>
            ) : isValidatedEstimation ? (
              <div className="pointages-explicit-hour-row is-presumed-validated">
                <span className="pointages-explicit-hour-kind">✓ Sortie présumée validée</span>
                <strong className="pointages-explicit-hour-val">
                  {formaterHeureLocale(pointage.lastOut.check_time)} · Origine présumée conservée
                </strong>
              </div>
            ) : isRealExit ? (
              <div className="pointages-explicit-hour-row is-real-exit">
                <span className="pointages-explicit-hour-kind">Sortie badgée</span>
                <strong className="pointages-explicit-hour-val">
                  {formaterHeureLocale(pointage.lastOut.check_time)} · {exitMethodLabel}
                </strong>
              </div>
            ) : (
              <div className="pointages-explicit-hour-row is-open-shift">
                <span className="pointages-explicit-hour-kind">Sortie</span>
                <strong className="pointages-explicit-hour-val">—</strong>
              </div>
            )}
          </div>

          <div className="pointages-passport-timeline-bottom" style={{ marginTop: 8 }}>
            <span>
              {needsEstimationDecision
                ? `Durée présumée non payée : ${formaterDureeComplete(pointage.totalSecondesPresumes || 0)}`
                : `Durée : ${formaterDureeComplete(pointage.totalSecondes || 0)}`}
            </span>
            <span>
              {sched.mode === 'none' ? 'Planning non disponible dans En-Check' : sched.label}
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

        {/* 4. HISTORIQUE DES PAUSES RÉELLEMENT EFFECTUÉES (NON PRÉSUMÉES) */}
        <div className="pointages-drawer-section">
          <div className="pointages-drawer-section-title">
            <Clock size={14} color="var(--pt-copper)" />
            <strong>Pauses réellement effectuées ({realPauses.length})</strong>
          </div>
          {realPauses.length > 0 ? (
            <div className="pointages-drawer-pauses-list">
              {realPauses.map((pa) => (
                <div className="pointages-drawer-pause-item" key={pa.id}>
                  <div>
                    <strong>
                      {pa.debutHHMM} → {pa.finHHMM || 'En cours'}
                      {pa.estNonPlanifiee && <em className="pointages-unplanned-pill">Hors planning</em>}
                    </strong>
                    <span>
                      {pa.estNonPlanifiee
                        ? 'Pause réelle effectuée (non présumée · hors planning)'
                        : pa.source === 'admin'
                          ? 'Pause réelle enregistrée par l’administrateur'
                          : 'Pause réelle pointée (non présumée)'}
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
                ? `Créneau de pause prévu (${sched.breakStart} – ${sched.breakEnd || ''}), aucune pause réelle pointée.`
                : 'Aucune pause réelle effectuée aujourd’hui.'}
            </p>
          )}

          {presumedPauses.length > 0 && (
            <div className="pointages-drawer-pauses-list" style={{ marginTop: 8 }}>
              {presumedPauses.map((pa) => (
                <div
                  className="pointages-drawer-pause-item"
                  key={pa.id}
                  style={{ borderStyle: 'dashed', opacity: 0.9 }}
                >
                  <div>
                    <strong>
                      ⏳ {pa.debutHHMM} → {pa.finHHMM || '--:--'}
                    </strong>
                    <span>
                      {pa.statut === 'validee'
                        ? '✓ Pause présumée validée (grille horaire)'
                        : '⏳ Pause présumée du planning — non pointée (hors historique réel)'}
                    </span>
                  </div>
                  <span className="pointages-drawer-pause-duration">
                    {formaterTempsPauseEnDirect(pa, nowMs)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pointages-drawer-actions">
          {needsEstimationDecision && onExamineEstimation && (
            <button
              type="button"
              className="pointages-drawer-btn is-copper"
              onClick={() => onExamineEstimation(pointage)}
            >
              <Clock size={15} />
              <span>⏳ Examiner l’estimation</span>
            </button>
          )}

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

          {/* Actions secondaires regroupées */}
          <div className="pointages-drawer-secondary-row">
            {canEdit && (
              <button
                type="button"
                className="pointages-drawer-btn is-outline"
                onClick={() => {
                  onModify(pointage?.employee?.id || pointage)
                  onClose()
                }}
              >
                <Edit size={14} />
                <span>Modifier le pointage</span>
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
              <MessageCircle size={14} />
              <span>Partager</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
