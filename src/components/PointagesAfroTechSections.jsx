import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Edit,
  Lock,
  MapPin,
  MessageCircle,
  QrCode,
  Smartphone,
  X,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import { estEstimationAStatuer } from '../services/seuilsPointage'
import { formaterDureeComplete, formaterHeureLocale, minutesDepuisMinuit } from '../utils/timezoneUtils'
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
  onToggleAlerts,
  onShareWhatsApp,
}) {
  return (
    <section className="pointages-cultural-hero" aria-label="Bandeau Pointages En-Check">
      <div className="pointages-cultural-brand">
        <EnCheckBrandMark size={44} />
        <div className="pointages-cultural-copy">
          <strong>En-Check · Pointages</strong>
          <span>On gère ! · Passeport de présence & preuves terrain</span>
        </div>
      </div>

      <div className="pointages-cultural-right">
        <span className="pointages-cultural-date">{formattedDate}</span>

        {!checkingPermissions && (
          <span
            className="pointages-cultural-date"
            style={{
              color: canEditPointages ? '#26734d' : '#b86b35',
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
              color: criticalAnomaliesCount > 0 ? '#c23b2b' : '#c97a16',
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
          Live Pulse · Équipe du jour
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
