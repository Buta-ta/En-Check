// src/hooks/useEmployeeRealtimeNotifications.js

import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import notificationService from '../services/notificationService'

export default function useEmployeeRealtimeNotifications(employee) {
  const navigate = useNavigate()

  const handlePayslipInsert = useCallback((payload) => {
    const { eventType } = payload
    if (eventType !== 'INSERT') return

    notificationService.show('💰 Nouvelle fiche de paie', {
      body: 'Votre bulletin de salaire est disponible',
      vibrate: [200, 100, 200],
      sound: 'success.mp3',
      tag: 'employee-payslip',
      requireInteraction: true,
      onClick: () => navigate('/employee/fiches-paie'),
    })
  }, [navigate])

  const handleAbsenceUpdate = useCallback((payload) => {
    const { eventType, new: absence, old } = payload
    if (eventType !== 'UPDATE') return
    if (!old || old.status === absence.status) return

    if (old.status === 'en_attente' && absence.status === 'approuvee') {
      notificationService.show('✅ Demande approuvée', {
        body: 'Votre demande de congé a été validée',
        vibrate: [180, 100, 180],
        sound: 'success.mp3',
        tag: 'employee-absence-approved',
        autoClose: 7000,
        onClick: () => navigate('/employee/conges'),
      })
    }

    if (old.status === 'en_attente' && absence.status === 'refusee') {
      notificationService.show('❌ Demande refusée', {
        body: 'Votre demande de congé a été refusée',
        vibrate: [120, 80, 120],
        sound: 'alert.mp3',
        tag: 'employee-absence-rejected',
        requireInteraction: true,
        onClick: () => navigate('/employee/conges'),
      })
    }
  }, [navigate])

  const handleTaskInsertOrUpdate = useCallback((payload) => {
    const { eventType, new: task, old } = payload

    const shouldNotify =
      eventType === 'INSERT' ||
      (eventType === 'UPDATE' && old?.assigned_employee_id !== task?.assigned_employee_id)

    if (!shouldNotify) return

    notificationService.show('🎯 Nouvelle tâche', {
      body: task.title || 'Une tâche vous a été assignée',
      vibrate: [200],
      sound: 'task.mp3',
      tag: 'employee-task',
      autoClose: 7000,
      onClick: () => navigate('/employee/tasks'),
    })
  }, [navigate])

  const handleScheduleRequestUpdate = useCallback((payload) => {
    const { eventType, new: request, old } = payload
    if (eventType !== 'UPDATE') return
    if (!old || old.status === request.status) return

    if (old.status === 'pending' && request.status === 'approved') {
      notificationService.show('🗓️ Planning validé', {
        body: 'Votre demande de modification d’horaires a été approuvée',
        vibrate: [180, 100, 180],
        sound: 'success.mp3',
        tag: 'employee-schedule-approved',
        autoClose: 7000,
        onClick: () => navigate('/employee/horaires'),
      })
    }

    if (old.status === 'pending' && request.status === 'rejected') {
      notificationService.show('⚠️ Planning refusé', {
        body: 'Votre demande de modification d’horaires a été refusée',
        vibrate: [120, 80, 120],
        sound: 'alert.mp3',
        tag: 'employee-schedule-rejected',
        requireInteraction: true,
        onClick: () => navigate('/employee/horaires'),
      })
    }
  }, [navigate])

  useEffect(() => {
    if (!employee?.id) return

    notificationService.requestPermission()

    const employeeFilter = `employee_id=eq.${employee.id}`
    const unsubscribers = []

    unsubscribers.push(
      notificationService.listenToTable(
        'employee_payslips',
        { filter: employeeFilter, event: 'INSERT' },
        handlePayslipInsert
      )
    )

    unsubscribers.push(
      notificationService.listenToTable(
        'absences',
        { filter: employeeFilter, event: 'UPDATE' },
        handleAbsenceUpdate
      )
    )

    unsubscribers.push(
      notificationService.listenToTable(
        'tasks',
        { filter: `assigned_employee_id=eq.${employee.id}`, event: '*' },
        handleTaskInsertOrUpdate
      )
    )

    unsubscribers.push(
      notificationService.listenToTable(
        'schedule_change_requests',
        { filter: employeeFilter, event: 'UPDATE' },
        handleScheduleRequestUpdate
      )
    )

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [
    employee,
    handlePayslipInsert,
    handleAbsenceUpdate,
    handleTaskInsertOrUpdate,
    handleScheduleRequestUpdate,
  ])

  return {
    requestPermission: () => notificationService.requestPermission(),
  }
}