// src/components/SpotlightSearch/ResultCards/EmployeeCard.jsx

import { User, Mail, Phone, Briefcase, Calendar, Shield } from 'lucide-react'

export default function EmployeeCard({ employee, isSelected, onClick }) {
  return (
    <div 
      className={`result-card employee-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="employee-card-header">
        <div className="employee-avatar">
          {employee.photo_url ? (
            <img src={employee.photo_url} alt={employee.first_name} />
          ) : (
            <div className="employee-avatar-placeholder">
              <User size={24} />
            </div>
          )}
        </div>
        
        <div className="employee-info">
          <h3 className="employee-name">
            {employee.first_name} {employee.last_name}
          </h3>
          <span className="employee-matricule">{employee.matricule}</span>
        </div>

        {employee.todayStatus && (
          <div className="employee-status-badge" style={{
            background: employee.todayStatus.type === 'absent' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: employee.todayStatus.type === 'absent' ? '#EF4444' : '#10B981',
            border: `1px solid ${employee.todayStatus.type === 'absent' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          }}>
            {employee.todayStatus.label}
          </div>
        )}
      </div>

      <div className="employee-card-details">
        {employee.position && (
          <div className="employee-detail-item">
            <Briefcase size={14} />
            <span>{employee.position}</span>
          </div>
        )}

        {employee.department && (
          <div className="employee-detail-item">
            <Shield size={14} />
            <span>{employee.department}</span>
          </div>
        )}

        {employee.email && (
          <div className="employee-detail-item">
            <Mail size={14} />
            <span>{employee.email}</span>
          </div>
        )}

        {employee.phone && (
          <div className="employee-detail-item">
            <Phone size={14} />
            <span>{employee.phone}</span>
          </div>
        )}

        <div className="employee-badges">
          {employee.contract_type && (
            <span className="employee-badge" style={{
              background: employee.contract_type === 'CDI' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: employee.contract_type === 'CDI' ? '#10B981' : '#F59E0B',
            }}>
              {employee.contract_type === 'CDI' ? '📝 CDI' : '📄 CDD'}
            </span>
          )}

          {employee.professional_category && (
            <span className="employee-badge" style={{
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#6366F1',
            }}>
              {employee.professional_category === 'cadre' ? '👔 Cadre' : '👷 Non-cadre'}
            </span>
          )}

          {employee.cnps_number && (
            <span className="employee-badge" style={{
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6',
            }}>
              CNPS: {employee.cnps_number}
            </span>
          )}

          {employee.hire_date && (
            <span className="employee-badge" style={{
              background: 'rgba(236, 72, 153, 0.1)',
              color: '#EC4899',
            }}>
              <Calendar size={12} />
              {new Date(employee.hire_date).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}