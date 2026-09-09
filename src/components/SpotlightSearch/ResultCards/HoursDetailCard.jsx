// src/components/SpotlightSearch/ResultCards/HoursDetailCard.jsx
// ═══════════════════════════════════════════════════════════
// ⏱️ HOURS DETAIL CARD (v2.0 - Taux dynamiques)
// ✅ Affichage des taux réels depuis les settings entreprise
// ✅ Gestion valorisation avec taux dynamiques
// ═══════════════════════════════════════════════════════════

import {
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ChevronRight,
} from 'lucide-react'

export default function HoursDetailCard({ data, isSelected, onClick }) {
  const {
    employee,
    today,
    thisWeek,
    thisMonth,
    thisYear,
    valorization,
    alerts,
  } = data

  const hasWeekExpected = !!thisWeek?.expected
  const hasMonthExpected = !!thisMonth?.total_expected
  const hasMonthRate = thisMonth?.rate !== null && thisMonth?.rate !== undefined && hasMonthExpected
  const hasYearAttendanceRate = thisYear?.attendance_rate !== null && thisYear?.attendance_rate !== undefined

  return (
    <div
      className={`hours-detail-card ${isSelected ? 'hours-detail-card-selected' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="hours-detail-header">
        <div className="hours-detail-employee">
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={employee.name}
              className="hours-detail-avatar"
            />
          ) : (
            <div className="hours-detail-avatar-placeholder">
              {employee.name.split(' ').map(n => n[0]).join('')}
            </div>
          )}
          <div className="hours-detail-employee-info">
            <h4 className="hours-detail-employee-name">{employee.name}</h4>
            <span className="hours-detail-employee-matricule">{employee.matricule}</span>
          </div>
        </div>

        {/* ✅ Bouton export supprimé ici */}
      </div>

      {/* Grille périodes */}
      <div className="hours-detail-grid">
        {/* AUJOURD'HUI */}
        <div className="hours-detail-period">
          <div className="hours-detail-period-header">
            <Clock size={14} />
            <span>Aujourd&apos;hui</span>
          </div>

          <div className="hours-detail-period-value">
            {today?.worked || '0h00'}
          </div>

          {today?.entries && today.entries.length > 0 && (
            <div className="hours-detail-period-meta">
              {today.entries[0].in} → {today.entries[0].out || 'En cours'}
            </div>
          )}

          {today?.openSessionsCount > 0 && (
            <div className="hours-detail-period-note" style={{ color: '#F59E0B' }}>
              ⚠ Oubli de dépointer (auto-close plafonné)
            </div>
          )}
        </div>

        {/* CETTE SEMAINE */}
        <div className="hours-detail-period">
          <div className="hours-detail-period-header">
            <Calendar size={14} />
            <span>Cette semaine</span>
          </div>

          <div className="hours-detail-period-value">
            {thisWeek?.total || '0h00'}
          </div>

          {hasWeekExpected && (
            <>
              <div className="hours-detail-period-meta">
                / {thisWeek.expected} attendues
              </div>

              {thisWeek?.completion !== undefined && thisWeek.completion !== null && (
                <div className="hours-detail-progress-bar">
                  <div
                    className="hours-detail-progress-fill"
                    style={{
                      width: `${Math.min(thisWeek.completion, 100)}%`,
                      background: thisWeek.completion >= 100 ? '#10B981' : '#F59E0B'
                    }}
                  />
                </div>
              )}
            </>
          )}

          {!hasWeekExpected && (
            <div className="hours-detail-period-note">
              Attendu non disponible (aucun planning)
            </div>
          )}
        </div>

        {/* CE MOIS */}
        <div className="hours-detail-period hours-detail-period-highlight">
          <div className="hours-detail-period-header">
            <TrendingUp size={14} />
            <span>Ce mois</span>
          </div>

          <div className="hours-detail-month-breakdown">
            <div className="hours-detail-month-row">
              <span className="hours-detail-month-label">Heures normales</span>
              <span className="hours-detail-month-value">{thisMonth?.normal || '0h00'}</span>
            </div>

            {/* ✅ HEURES SUP NORMALES (taux dynamique) */}
            {thisMonth?.overtime_normal && thisMonth.overtime_normal.hours !== '0h00' && (
              <div className="hours-detail-month-row hours-detail-month-row-overtime">
                <span className="hours-detail-month-label">
                  Heures sup {thisMonth.overtime_normal.rate}%
                </span>
                <span className="hours-detail-month-value">
                  {thisMonth.overtime_normal.hours}
                </span>
              </div>
            )}

            {/* ✅ HEURES SUP MAJORÉES (taux dynamique) */}
            {thisMonth?.overtime_major && thisMonth.overtime_major.hours !== '0h00' && (
              <div className="hours-detail-month-row hours-detail-month-row-overtime">
                <span className="hours-detail-month-label">
                  Heures sup {thisMonth.overtime_major.rate}%
                </span>
                <span className="hours-detail-month-value">
                  {thisMonth.overtime_major.hours}
                </span>
              </div>
            )}

            {/* ✅ Fallback ancien format (si overtime_normal absent) */}
            {!thisMonth?.overtime_normal && thisMonth?.overtime_25 && thisMonth.overtime_25 !== '0h00' && (
              <div className="hours-detail-month-row hours-detail-month-row-overtime">
                <span className="hours-detail-month-label">Heures sup 25%</span>
                <span className="hours-detail-month-value">{thisMonth.overtime_25}</span>
              </div>
            )}

            {!thisMonth?.overtime_major && thisMonth?.overtime_50 && thisMonth.overtime_50 !== '0h00' && (
              <div className="hours-detail-month-row hours-detail-month-row-overtime">
                <span className="hours-detail-month-label">Heures sup 50%</span>
                <span className="hours-detail-month-value">{thisMonth.overtime_50}</span>
              </div>
            )}

            {thisMonth?.overtime_100 && thisMonth.overtime_100 !== '0h00' && (
              <div className="hours-detail-month-row hours-detail-month-row-overtime">
                <span className="hours-detail-month-label">Heures sup 100%</span>
                <span className="hours-detail-month-value">{thisMonth.overtime_100}</span>
              </div>
            )}

            {thisMonth?.absences && thisMonth.absences !== '0h00' && (
              <div className="hours-detail-month-row hours-detail-month-row-absence">
                <span className="hours-detail-month-label">Absences (planning)</span>
                <span className="hours-detail-month-value">{thisMonth.absences}</span>
              </div>
            )}

            <div className="hours-detail-month-divider" />

            <div className="hours-detail-month-row hours-detail-month-row-total">
              <span className="hours-detail-month-label">Total effectué</span>
              <span className="hours-detail-month-value">{thisMonth?.total_worked || '0h00'}</span>
            </div>

            {hasMonthExpected ? (
              <>
                <div className="hours-detail-month-row">
                  <span className="hours-detail-month-label">Attendu (planning)</span>
                  <span className="hours-detail-month-value">{thisMonth.total_expected}</span>
                </div>

                {hasMonthRate && (
                  <div className="hours-detail-month-rate">
                    <span className="hours-detail-month-rate-label">Taux de présence</span>
                    <span
                      className="hours-detail-month-rate-value"
                      style={{
                        color: thisMonth.rate >= 90 ? '#10B981' : thisMonth.rate >= 70 ? '#F59E0B' : '#EF4444'
                      }}
                    >
                      {thisMonth.rate}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="hours-detail-period-note">
                Attendu / taux non disponibles (aucun planning)
              </div>
            )}

            {thisMonth?.openSessionsCount > 0 && (
              <div className="hours-detail-period-note" style={{ color: '#F59E0B' }}>
                ⚠ {thisMonth.openSessionsCount} session(s) ouverte(s) (auto-close plafonné)
              </div>
            )}
          </div>
        </div>

        {/* CETTE ANNÉE */}
        <div className="hours-detail-period">
          <div className="hours-detail-period-header">
            <Calendar size={14} />
            <span>Cette année</span>
          </div>

          <div className="hours-detail-period-value">
            {thisYear?.total || '0h00'}
          </div>

          {thisYear?.overtime && (
            <div className="hours-detail-period-meta">
              dont {thisYear.overtime} heures sup
            </div>
          )}

          <div className="hours-detail-year-stats">
            {thisYear?.avg_per_day && (
              <div className="hours-detail-year-stat">
                <span>Moy/jour</span>
                <strong>{thisYear.avg_per_day}</strong>
              </div>
            )}

            {hasYearAttendanceRate ? (
              <div className="hours-detail-year-stat">
                <span>Assiduité</span>
                <strong>{thisYear.attendance_rate}%</strong>
              </div>
            ) : (
              <div className="hours-detail-year-stat">
                <span>Assiduité</span>
                <strong>—</strong>
              </div>
            )}

            {thisYear?.delays && !thisYear.delays.ignored_no_schedule && thisYear.delays.count > 0 && (
              <div className="hours-detail-year-stat hours-detail-year-stat-warning">
                <span>Retards</span>
                <strong>{thisYear.delays.count}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ VALORISATION (avec taux dynamiques) */}
      {valorization && (
        <div className="hours-detail-valorization">
          <div className="hours-detail-valorization-header">
            <DollarSign size={14} />
            <span>Valorisation du mois</span>
          </div>

          <div className="hours-detail-valorization-grid">
            {valorization.normal && (
              <div className="hours-detail-valorization-row">
                <span>{valorization.normal.hours} × {Math.round(valorization.normal.rate)} {valorization.currency}</span>
                <strong>{valorization.normal.amount.toLocaleString('fr-FR')} {valorization.currency}</strong>
              </div>
            )}

            {/* ✅ Heures sup normales (taux dynamique) */}
            {valorization.overtime_normal && valorization.overtime_normal.amount > 0 && (
              <div className="hours-detail-valorization-row">
                <span>
                  {valorization.overtime_normal.hours} × {Math.round(valorization.overtime_normal.rate)} {valorization.currency}
                  {valorization.overtime_normal.ratePercent && (
                    <em style={{ color: '#F59E0B', fontSize: '10px', marginLeft: '4px' }}>
                      (+{valorization.overtime_normal.ratePercent}%)
                    </em>
                  )}
                </span>
                <strong>{valorization.overtime_normal.amount.toLocaleString('fr-FR')} {valorization.currency}</strong>
              </div>
            )}

            {/* ✅ Heures sup majorées (taux dynamique) */}
            {valorization.overtime_major && valorization.overtime_major.amount > 0 && (
              <div className="hours-detail-valorization-row">
                <span>
                  {valorization.overtime_major.hours} × {Math.round(valorization.overtime_major.rate)} {valorization.currency}
                  {valorization.overtime_major.ratePercent && (
                    <em style={{ color: '#EF4444', fontSize: '10px', marginLeft: '4px' }}>
                      (+{valorization.overtime_major.ratePercent}%)
                    </em>
                  )}
                </span>
                <strong>{valorization.overtime_major.amount.toLocaleString('fr-FR')} {valorization.currency}</strong>
              </div>
            )}

            <div className="hours-detail-valorization-divider" />

            <div className="hours-detail-valorization-row hours-detail-valorization-total">
              <span>Total brut</span>
              <strong>{valorization.total_gross.toLocaleString('fr-FR')} {valorization.currency}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Alertes */}
      {alerts && alerts.length > 0 && (
        <div className="hours-detail-alerts">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`hours-detail-alert hours-detail-alert-${alert.type}`}
            >
              {alert.type === 'warning' && <AlertTriangle size={14} />}
              {alert.type === 'success' && <CheckCircle2 size={14} />}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="hours-detail-footer">
        <span className="hours-detail-footer-hint">Cliquer pour voir le détail complet</span>
        <ChevronRight size={18} className="hours-detail-arrow" />
      </div>
    </div>
  )
}