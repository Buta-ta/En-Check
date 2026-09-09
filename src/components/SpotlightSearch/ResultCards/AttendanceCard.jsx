// src/components/SpotlightSearch/ResultCards/AttendanceCard.jsx

import { LogIn, LogOut, Camera, MapPin, Clock } from 'lucide-react'

export default function AttendanceCard({ attendance, isSelected, onClick }) {
  const isCheckIn = attendance.check_type === 'in'
  
  const methodLabels = {
    pin: '🔢 Code PIN',
    qr_code: '📱 QR Code',
    pin_photo: '📸 PIN + Photo',
    qr_photo: '📸 QR + Photo',
    face: '👤 Reconnaissance faciale',
    pin_face: '🔐 PIN + Faciale',
  }

  return (
    <div 
      className={`result-card attendance-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ 
        borderLeft: `3px solid ${isCheckIn ? '#10B981' : '#F59E0B'}` 
      }}
    >
      <div className="attendance-card-header">
        <div 
          className="attendance-icon" 
          style={{ 
            background: isCheckIn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' 
          }}
        >
          {isCheckIn ? (
            <LogIn size={20} color="#10B981" />
          ) : (
            <LogOut size={20} color="#F59E0B" />
          )}
        </div>

        <div className="attendance-info">
          <h3 className="attendance-employee">
            {attendance.employee?.first_name} {attendance.employee?.last_name}
          </h3>
          <span className="attendance-matricule">{attendance.employee?.matricule}</span>
        </div>

        {attendance.has_photo && (
          <div className="attendance-photo-badge">
            <Camera size={14} />
          </div>
        )}
      </div>

      <div className="attendance-card-details">
        <div className="attendance-detail-item">
          <Clock size={14} />
          <span>{new Date(attendance.check_time).toLocaleString('fr-FR')}</span>
        </div>

        <div className="attendance-detail-item">
          <span className="attendance-method-badge">
            {methodLabels[attendance.method] || attendance.method}
          </span>
        </div>

        {attendance.location_lat && attendance.location_lng && (
          <div className="attendance-detail-item">
            <MapPin size={14} />
            <span>GPS: {attendance.location_lat.toFixed(6)}, {attendance.location_lng.toFixed(6)}</span>
          </div>
        )}

        {attendance.is_auto_closed && (
          <div className="attendance-warning">
            ⚠️ Fermeture automatique
          </div>
        )}
      </div>
    </div>
  )
}