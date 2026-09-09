// src/hooks/useRealtimeNotifications.js

import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import notificationService from '../services/notificationService'

export default function useRealtimeNotifications(admin) {
  const navigate = useNavigate()

  const getEnterpriseFilter = useCallback(() => {
    if (!admin) return null

    if (admin.role === 'super_admin') {
      const selectedEnterpriseId = admin.selectedEnterprise?.id
      return selectedEnterpriseId ? `enterprise_id=eq.${selectedEnterpriseId}` : null
    }

    return admin.enterprise_id ? `enterprise_id=eq.${admin.enterprise_id}` : null
  }, [admin])

  const handleAttendanceInsert = useCallback(async (payload) => {
    const { eventType, new: attendance } = payload
    if (eventType !== 'INSERT') return
    if (attendance.check_type !== 'in') return

    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', attendance.employee_id)
        .single()

      const fullName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : 'Employé'

      notificationService.show('🔔 Nouveau pointage', {
        body: `${fullName} a pointé en entrée`,
        vibrate: [200, 100, 200],
        sound: 'notification.mp3',
        tag: 'attendance-in',
        autoClose: 5000,
        onClick: () => navigate('/pointages'),
      })
    } catch (err) {
      console.error('Notification pointage:', err)
    }
  }, [navigate])

  const handleAttendanceUpdate = useCallback(async (payload) => {
    const { eventType, new: attendance, old } = payload
    if (eventType !== 'UPDATE') return

    if (!old?.is_auto_closed && attendance?.is_auto_closed) {
      try {
        const { data: employee } = await supabase
          .from('employees')
          .select('first_name, last_name')
          .eq('id', attendance.employee_id)
          .single()

        const fullName = employee
          ? `${employee.first_name} ${employee.last_name}`
          : 'Employé'

        notificationService.show('⚠️ Oubli de sortie', {
          body: `${fullName} n’a pas pointé sa sortie`,
          vibrate: [120, 80, 120],
          sound: 'alert.mp3',
          tag: 'attendance-autoclosed',
          autoClose: 7000,
          onClick: () => navigate('/pointages'),
        })
      } catch (err) {
        console.error('Notification oubli sortie:', err)
      }
    }
  }, [navigate])

  const handleConflictInsert = useCallback(async (payload) => {
    const { eventType, new: conflict } = payload
    if (eventType !== 'INSERT') return
    if (conflict.status !== 'pending') return

    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', conflict.employee_id)
        .single()

      const fullName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : 'Employé'

      notificationService.show('🚨 Conflit absence / pointage', {
        body: `${fullName} a pointé pendant une absence`,
        vibrate: [250, 100, 250, 100, 250],
        sound: 'alert.mp3',
        tag: 'attendance-conflict',
        requireInteraction: true,
        onClick: () => navigate('/pointages'),
      })
    } catch (err) {
      console.error('Notification conflit:', err)
    }
  }, [navigate])

  const handleAbsenceInsert = useCallback(async (payload) => {
    const { eventType, new: absence } = payload
    if (eventType !== 'INSERT') return
    if (absence.status !== 'en_attente') return

    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', absence.employee_id)
        .single()

      const fullName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : 'Employé'

      notificationService.show('📅 Nouvelle demande de congé', {
        body: `${fullName} a soumis une demande`,
        vibrate: [200],
        sound: 'notification.mp3',
        tag: 'absence-pending',
        autoClose: 7000,
        onClick: () => navigate('/absences'),
      })
    } catch (err) {
      console.error('Notification absence:', err)
    }
  }, [navigate])

  const handleScheduleRequestInsert = useCallback(async (payload) => {
    const { eventType, new: request } = payload
    if (eventType !== 'INSERT') return
    if (request.status !== 'pending') return

    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', request.employee_id)
        .single()

      const fullName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : 'Employé'

      notificationService.show('🗓️ Demande de changement d’horaires', {
        body: `${fullName} souhaite modifier son planning`,
        vibrate: [180, 100, 180],
        sound: 'notification.mp3',
        tag: 'schedule-request',
        autoClose: 7000,
        onClick: () => navigate('/planning'),
      })
    } catch (err) {
      console.error('Notification planning:', err)
    }
  }, [navigate])

  const handleTaskInsertOrUpdate = useCallback(async (payload) => {
    const { eventType, new: task, old } = payload

    const assignedChanged =
      eventType === 'INSERT' ||
      (eventType === 'UPDATE' && old?.assigned_employee_id !== task?.assigned_employee_id)

    if (!assignedChanged) return
    if (!task?.assigned_employee_id) return

    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', task.assigned_employee_id)
        .single()

      const fullName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : 'Employé'

      notificationService.show('🎯 Tâche assignée', {
        body: `${task.title || 'Nouvelle tâche'} → ${fullName}`,
        vibrate: [200, 60, 200],
        sound: 'task.mp3',
        tag: 'task-assigned-admin',
        autoClose: 6000,
        onClick: () => navigate('/taches'),
      })
    } catch (err) {
      console.error('Notification tâche:', err)
    }
  }, [navigate])

  const handleTaskPredictionInsert = useCallback((payload) => {
    const { eventType, new: prediction } = payload
    if (eventType !== 'INSERT') return
    if (prediction.is_dismissed) return
    if (!['critical', 'warning'].includes(prediction.severity)) return

    const isCritical = prediction.severity === 'critical'

    let title = '🧠 Nouvelle prédiction'
    if (prediction.prediction_type === 'staffing_need') {
      title = '📈 Besoin de renfort détecté'
    } else if (prediction.prediction_type === 'workload_alert') {
      title = '⚠️ Surcharge détectée'
    } else if (prediction.prediction_type === 'absence_impact') {
      title = '📅 Impact d’absence détecté'
    } else if (prediction.prediction_type === 'bottleneck') {
      title = '🚧 Goulot détecté'
    }

    notificationService.show(title, {
      body: prediction.message || 'Une alerte prédictive a été générée',
      vibrate: isCritical ? [260, 100, 260, 100, 260] : [180, 80, 180],
      sound: isCritical ? 'alert.mp3' : 'notification.mp3',
      tag: `prediction-${prediction.prediction_type}`,
      requireInteraction: isCritical,
      autoClose: isCritical ? undefined : 8000,
      onClick: () => navigate('/predictions'),
    })
  }, [navigate])

  useEffect(() => {
    if (!admin) return

    notificationService.requestPermission()

    const filter = getEnterpriseFilter()
    const unsubscribers = []

    unsubscribers.push(
      notificationService.listenToTable('attendances', { filter, event: '*' }, (payload) => {
        handleAttendanceInsert(payload)
        handleAttendanceUpdate(payload)
      })
    )

    unsubscribers.push(
      notificationService.listenToTable('attendance_conflicts', { filter, event: 'INSERT' }, handleConflictInsert)
    )

    unsubscribers.push(
      notificationService.listenToTable('absences', { filter, event: 'INSERT' }, handleAbsenceInsert)
    )

    unsubscribers.push(
      notificationService.listenToTable('schedule_change_requests', { filter, event: 'INSERT' }, handleScheduleRequestInsert)
    )

    unsubscribers.push(
      notificationService.listenToTable('tasks', { filter, event: '*' }, handleTaskInsertOrUpdate)
    )

    unsubscribers.push(
      notificationService.listenToTable('task_predictions', { filter, event: 'INSERT' }, handleTaskPredictionInsert)
    )

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [
    admin,
    getEnterpriseFilter,
    handleAttendanceInsert,
    handleAttendanceUpdate,
    handleConflictInsert,
    handleAbsenceInsert,
    handleScheduleRequestInsert,
    handleTaskInsertOrUpdate,
    handleTaskPredictionInsert,
  ])

  return {
    requestPermission: () => notificationService.requestPermission(),
  }
}