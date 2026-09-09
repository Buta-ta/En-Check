// src/components/SpotlightSearch/ActivityFeed.jsx
// ═══════════════════════════════════════════════════════════
// 🕐 ACTIVITY FEED (MAJ)
// - Realtime filtré strictement par enterpriseId
// - Re-subscribe quand enterpriseId change
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { LogIn, LogOut, CheckCircle2, Calendar, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formaterHeureLocale } from '../../utils/timezoneUtils'

export default function ActivityFeed({ admin, enterpriseId, onActivityClick }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!admin) return
    if (!enterpriseId) {
      setActivities([])
      setLoading(false)
      return
    }

    loadRecentActivity()

    const channel = setupRealtimeSubscription()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id, enterpriseId])

  const loadRecentActivity = async () => {
    setLoading(true)

    try {
      const today = new Date().toISOString().split('T')[0]
      const startOfDay = `${today}T00:00:00Z`

      // Pointages récents
      const { data: attendances } = await supabase
        .from('attendances')
        .select('id, check_time, check_type, employees(id, first_name, last_name, photo_url)')
        .eq('enterprise_id', enterpriseId)
        .gte('check_time', startOfDay)
        .order('check_time', { ascending: false })
        .limit(3)

      // Tâches complétées
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, completed_at, status, employees!tasks_assigned_employee_id_fkey(id, first_name, last_name)')
        .eq('enterprise_id', enterpriseId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(2)

      // Congés en attente
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('id, created_at, leave_type, employees(id, first_name, last_name)')
        .eq('enterprise_id', enterpriseId)
        .eq('status', 'en_attente')
        .order('created_at', { ascending: false })
        .limit(2)

      const allActivities = [
        ...(attendances || []).map(a => ({
          id: `att-${a.id}`,
          type: 'attendance',
          subtype: a.check_type,
          timestamp: a.check_time,
          employee: a.employees,
          data: a,
        })),
        ...(tasks || []).map(t => ({
          id: `task-${t.id}`,
          type: 'task',
          timestamp: t.completed_at,
          employee: t.employees,
          data: t,
        })),
        ...(leaves || []).map(l => ({
          id: `leave-${l.id}`,
          type: 'leave_request',
          timestamp: l.created_at,
          employee: l.employees,
          data: l,
        })),
      ]
        .filter(x => x.timestamp)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)

      setActivities(allActivities)
    } catch (error) {
      console.error('Erreur chargement activité:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`activity-feed-${enterpriseId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendances', filter: `enterprise_id=eq.${enterpriseId}` },
        () => loadRecentActivity()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `enterprise_id=eq.${enterpriseId}` },
        (payload) => {
          if (payload?.new?.status === 'completed') loadRecentActivity()
        }
      )
      .subscribe()

    return channel
  }

  const getActivityIcon = (activity) => {
    switch (activity.type) {
      case 'attendance':
        return activity.subtype === 'in' ? LogIn : LogOut
      case 'task':
        return CheckCircle2
      case 'leave_request':
        return Calendar
      default:
        return Clock
    }
  }

  const getActivityColor = (activity) => {
    switch (activity.type) {
      case 'attendance':
        return activity.subtype === 'in' ? '#10B981' : '#F59E0B'
      case 'task':
        return '#6366F1'
      case 'leave_request':
        return '#8B5CF6'
      default:
        return '#888'
    }
  }

  const getTimeAgo = (timestamp) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now - past
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "À l'instant"
    if (diffMins === 1) return 'il y a 1 minute'
    if (diffMins < 60) return `il y a ${diffMins} minutes`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return 'il y a 1 heure'
    if (diffHours < 24) return `il y a ${diffHours} heures`

    return past.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  const getActivityText = (activity) => {
    const employeeName = activity.employee
      ? `${activity.employee.first_name} ${activity.employee.last_name}`
      : 'Employé'

    switch (activity.type) {
      case 'attendance':
        return activity.subtype === 'in'
          ? `${employeeName} a pointé (Entrée)`
          : `${employeeName} a pointé (Sortie)`
      case 'task':
        return `${employeeName} a terminé "${activity.data.title}"`
      case 'leave_request':
        return `${employeeName} a demandé un congé`
      default:
        return 'Activité'
    }
  }

  const getActivitySubtext = (activity) => {
    const timeAgo = getTimeAgo(activity.timestamp)

    if (activity.type === 'attendance') {
      return `${timeAgo} • ${formaterHeureLocale(activity.timestamp)}`
    }
    if (activity.type === 'task') return `${timeAgo} • Tâche complétée`
    if (activity.type === 'leave_request') return `${timeAgo} • Nécessite validation`

    return timeAgo
  }

  if (loading) {
    return (
      <div className="activity-feed-container">
        <div className="activity-feed-header">
          <h3 className="activity-feed-title">Activité récente</h3>
        </div>
        <div className="activity-feed-loading">
          <div className="activity-feed-skeleton"></div>
          <div className="activity-feed-skeleton"></div>
          <div className="activity-feed-skeleton"></div>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="activity-feed-container">
        <div className="activity-feed-header">
          <h3 className="activity-feed-title">Activité récente</h3>
        </div>
        <div className="activity-feed-empty">
          <Clock size={32} color="#666" />
          <p>Aucune activité récente</p>
        </div>
      </div>
    )
  }

  return (
    <div className="activity-feed-container">
      <div className="activity-feed-header">
        <h3 className="activity-feed-title">Activité récente</h3>
        <button className="activity-feed-refresh" onClick={loadRecentActivity} title="Actualiser">
          ↻
        </button>
      </div>

      <div className="activity-feed-list">
        {activities.map((activity, index) => {
          const Icon = getActivityIcon(activity)
          const color = getActivityColor(activity)

          return (
            <button
              key={activity.id}
              className="activity-feed-item"
              style={{ '--activity-color': color, animationDelay: `${index * 0.05}s` }}
              onClick={() => onActivityClick(activity)}
            >
              <div className="activity-feed-item-icon">
                <div className="activity-feed-item-dot"></div>
                <Icon size={18} />
              </div>

              <div className="activity-feed-item-content">
                <p className="activity-feed-item-text">{getActivityText(activity)}</p>
                <p className="activity-feed-item-subtext">{getActivitySubtext(activity)}</p>
              </div>

              {activity.employee?.photo_url && (
                <img src={activity.employee.photo_url} alt="" className="activity-feed-item-avatar" />
              )}
            </button>
          )
        })}
      </div>

      <button className="activity-feed-view-all" onClick={() => onActivityClick({ type: 'view_all' })}>
        Voir toute l'activité →
      </button>
    </div>
  )
}