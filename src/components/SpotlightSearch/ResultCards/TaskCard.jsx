// src/components/SpotlightSearch/ResultCards/TaskCard.jsx

import { CheckSquare, Clock, AlertCircle, Users } from 'lucide-react'

export default function TaskCard({ task, isSelected, onClick }) {
  const priorityConfig = {
    urgent: { color: '#EF4444', label: '🔥 Urgent', bg: 'rgba(239, 68, 68, 0.1)' },
    high: { color: '#F97316', label: '⚠️ Haute', bg: 'rgba(249, 115, 22, 0.1)' },
    medium: { color: '#F59E0B', label: '📌 Moyenne', bg: 'rgba(245, 158, 11, 0.1)' },
    low: { color: '#10B981', label: '✅ Basse', bg: 'rgba(16, 185, 129, 0.1)' },
  }

  const statusConfig = {
    pending: { color: '#6B7280', label: 'En attente' },
    in_progress: { color: '#3B82F6', label: 'En cours' },
    completed: { color: '#10B981', label: 'Terminée' },
    validated: { color: '#8B5CF6', label: 'Validée' },
    overdue: { color: '#EF4444', label: 'En retard' },
  }

  const priority = priorityConfig[task.priority] || priorityConfig.medium
  const status = statusConfig[task.status] || statusConfig.pending

  return (
    <div 
      className={`result-card task-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ borderLeft: `3px solid ${priority.color}` }}
    >
      <div className="task-card-header">
        <div className="task-icon" style={{ background: priority.bg }}>
          <CheckSquare size={20} color={priority.color} />
        </div>
        <div className="task-info">
          <h3 className="task-title">{task.title}</h3>
          {task.description && (
            <p className="task-description">{task.description}</p>
          )}
        </div>
      </div>

      <div className="task-card-meta">
        <span 
          className="task-badge" 
          style={{ 
            background: priority.bg, 
            color: priority.color,
            border: `1px solid ${priority.color}40`
          }}
        >
          {priority.label}
        </span>

        <span 
          className="task-badge"
          style={{ 
            background: `${status.color}10`, 
            color: status.color,
            border: `1px solid ${status.color}40`
          }}
        >
          {status.label}
        </span>

        {task.team && (
          <span className="task-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
            <Users size={12} />
            {task.team.name}
          </span>
        )}

        {task.due_date && (
          <span className="task-badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#EC4899' }}>
            <Clock size={12} />
            {new Date(task.due_date).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>

      {task.assigned_employee && (
        <div className="task-assignee">
          <div className="task-assignee-avatar">
            {task.assigned_employee.photo_url ? (
              <img src={task.assigned_employee.photo_url} alt="" />
            ) : (
              <span>{task.assigned_employee.first_name?.[0]}{task.assigned_employee.last_name?.[0]}</span>
            )}
          </div>
          <span className="task-assignee-name">
            {task.assigned_employee.first_name} {task.assigned_employee.last_name}
          </span>
        </div>
      )}
    </div>
  )
}