// ═══════════════════════════════════════════════════════════
// 🕐 ACTIVITY FEED - Flux d'activité en temps réel
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formaterHeureLocale } from '../../utils/timezoneUtils'

export default function ActivityFeed({ admin, onActivityClick }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecentActivity()
    
    // Setup realtime subscription
    const channel = setupRealtimeSubscription()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [admin])

  const loadRecentActivity = async () => {
    setLoading(true)
    
    try {
      const today = new Date().toISOString().split('T')[0]
      const startOfDay = `${today}T00:00:00Z`
      
      // Déterminer le scope selon le rôle
      const isSuperAdmin = admin.role === 'super_admin'
      const enterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id

      // Charger pointages récents
      let attendancesQuery = supabase
        .from('attendances')
        .select('id, check_time, check_type, employees(id, first_name, last_name, photo_url)')
        .gte('check_time', startOfDay)
        .order('check_time', { ascending: false })
        .limit(3)

      if (!isSuperAdmin || enterpriseId) {
        attendancesQuery = attendancesQuery.eq('enterprise_id', enterpriseId)
      }

      const { data: attendances } = await attendancesQuery

      // Charger tâches récemment complétées
      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, completed_at, status, assigned_employee_id, employees(id, first_name, last_name)')
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(2)

      if (!isSuperAdmin || enterpriseId) {
        tasksQuery = tasksQuery.eq('enterprise_id', enterpriseId)
      }

      const { data: tasks } = await tasksQuery

      // Charger demandes de congés en attente
      let leavesQuery = supabase
        .from('leave_requests')
        .select('id, created_at, leave_type, employees(id, first_name, last_name)')
        .eq('status', 'en_attente')
        .order('created_at', { ascending: false })
        .limit(2)

      if (!isSuperAdmin || enterpriseId) {
        leavesQuery = leavesQuery.eq('enterprise_id', enterpriseId)
      }

      const { data: leaves } = await leavesQuery

      // Fusionner et trier par date
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
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)

      setActivities(allActivities)
    } catch (error) {
      console.error('Erreur chargement activité:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const enterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id

    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendances',
          filter: enterpriseId ? `enterprise_id=eq.${enterpriseId}` : undefined,
        },
        (payload) => {
          // Recharger l'activité quand nouveau pointage
          loadRecentActivity()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: enterpriseId ? `enterprise_id=eq.${enterpriseId}` : undefined,
        },
        (payload) => {
          if (payload.new.status === 'completed') {
            loadRecentActivity()
          }
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
        return 'Activité inconnue'
    }
  }

  const getActivitySubtext = (activity) => {
    const timeAgo = getTimeAgo(activity.timestamp)
    
    switch (activity.type) {
      case 'attendance':
        return `${timeAgo} • ${formaterHeureLocale(activity.timestamp)}`
      
      case 'task':
        return `${timeAgo} • Tâche validée`
      
      case 'leave_request':
        return `${timeAgo} • Nécessite validation`
      
      default:
        return timeAgo
    }
  }

  const getTimeAgo = (timestamp) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now - past
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'À l\'instant'
    if (diffMins === 1) return 'il y a 1 minute'
    if (diffMins < 60) return `il y a ${diffMins} minutes`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return 'il y a 1 heure'
    if (diffHours < 24) return `il y a ${diffHours} heures`
    
    return past.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  if (loading) {
    return (
      <div className="activity-feed-container">
        <div className="activity-feed-header">
          <h3 className="activity-feed-title">🕐 Activité récente</h3>
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
          <h3 className="activity-feed-title">🕐 Activité récente</h3>
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
        <h3 className="activity-feed-title">🕐 Activité récente</h3>
        <button 
          className="activity-feed-refresh"
          onClick={loadRecentActivity}
          title="Actualiser"
        >
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
              style={{ 
                '--activity-color': color,
                animationDelay: `${index * 0.05}s`
              }}
              onClick={() => onActivityClick(activity)}
            >
              <div className="activity-feed-item-icon">
                <div className="activity-feed-item-dot"></div>
                <Icon size={18} />
              </div>

              <div className="activity-feed-item-content">
                <p className="activity-feed-item-text">
                  {getActivityText(activity)}
                </p>
                <p className="activity-feed-item-subtext">
                  {getActivitySubtext(activity)}
                </p>
              </div>

              {activity.employee?.photo_url && (
                <img
                  src={activity.employee.photo_url}
                  alt=""
                  className="activity-feed-item-avatar"
                />
              )}
            </button>
          )
        })}
      </div>

      <button 
        className="activity-feed-view-all"
        onClick={() => onActivityClick({ type: 'view_all' })}
      >
        Voir toute l'activité →
      </button>
    </div>
  )
}