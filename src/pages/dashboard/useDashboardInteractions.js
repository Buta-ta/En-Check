// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — INTERACTIONS
// Résolution des conflits absence/pointage, traitement rapide
// des demandes d'horaire, régularisation des sorties
// manquantes et déconnexion.
// ═══════════════════════════════════════════════════════════
import { supabase } from '../../lib/supabase'

export function useDashboardInteractions(ctx) {
  const {
    admin, today, navigate, loadData, refreshNotifications,
    selectedConflict, conflictNote, setSelectedConflict,
    setConflictNote, setShowConflictModal, setResolvingConflict,
    setProcessingScheduleRequestId, setSavingForgottenExitId,
  } = ctx
  const canManageConflict = ['admin', 'manager', 'super_admin'].includes(admin?.role)

  const openConflictModal = (conflict) => {
    setSelectedConflict(conflict)
    setConflictNote('')
    setShowConflictModal(true)
  }

  const resolveConflict = async (action) => {
    if (!selectedConflict) return
    setResolvingConflict(true)
    try {
      const conflictId = selectedConflict.id
      const absenceId = selectedConflict.absence_id

      if (action === 'kept_absence') {
        const { error } = await supabase.from('attendance_conflicts').update({ status: 'resolved', resolution_action: 'kept_absence', notes: conflictNote || 'Absence maintenue malgré le pointage', resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', conflictId)
        if (error) throw error
      } else if (action === 'cancelled_absence') {
        const { error: delError } = await supabase.from('absences').delete().eq('id', absenceId)
        if (delError) throw delError
        const { error } = await supabase.from('attendance_conflicts').update({ status: 'resolved', resolution_action: 'cancelled_absence', notes: conflictNote || 'Absence annulée suite au pointage', resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', conflictId)
        if (error) throw error
      } else if (action === 'ignored_conflict') {
        const { error } = await supabase.from('attendance_conflicts').update({ status: 'ignored', resolution_action: 'ignored_conflict', notes: conflictNote || 'Conflit ignoré', resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', conflictId)
        if (error) throw error
      }

      setShowConflictModal(false)
      setSelectedConflict(null)
      setConflictNote('')
      loadData(admin)
      refreshNotifications()
    } catch (error) {
      console.error('Erreur résolution:', error)
    }
    setResolvingConflict(false)
  }

  const handleQuickScheduleRequest = async (request, decision) => {
    if (!request?.id || !admin || !['approved', 'rejected'].includes(decision)) return
    setProcessingScheduleRequestId(request.id)
    try {
      if (decision === 'approved') {
        const payload = {
          employee_id: request.employee_id,
          schedule_id: request.use_custom_hours ? null : request.requested_schedule_id || null,
          use_custom_hours: Boolean(request.use_custom_hours),
          custom_start_time: request.use_custom_hours ? request.requested_start_time : null,
          custom_end_time: request.use_custom_hours ? request.requested_end_time : null,
          custom_break_start: request.use_custom_hours && request.requested_has_break ? request.requested_break_start : null,
          custom_break_end: request.use_custom_hours && request.requested_has_break ? request.requested_break_end : null,
          custom_has_break: request.use_custom_hours ? Boolean(request.requested_has_break) : true,
          custom_work_days: request.use_custom_hours ? request.requested_work_days : null,
          is_active: true,
          updated_at: new Date().toISOString(),
        }
        const { error: scheduleError } = await supabase
          .from('employee_schedules')
          .upsert(payload, { onConflict: 'employee_id' })
        if (scheduleError) throw scheduleError
      }

      const { error: requestError } = await supabase
        .from('schedule_change_requests')
        .update({
          status: decision,
          admin_comment: decision === 'approved' ? 'Approuvée depuis le Dashboard' : 'Refusée depuis le Dashboard',
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (requestError) throw requestError
      await loadData(admin)
      refreshNotifications()
    } catch (error) {
      console.error('Erreur traitement rapide demande horaire:', error)
    } finally {
      setProcessingScheduleRequestId(null)
    }
  }

  const confirmForgottenExit = async (item, exitTimeStr = '18:00') => {
    if (!item?.employee_id || !item?.enterprise_id) return false
    setSavingForgottenExitId(item.id)
    try {
      const checkTimeIso = new Date(`${today}T${exitTimeStr || '18:00'}:00`).toISOString()
      const { error } = await supabase.from('attendances').insert({
        employee_id: item.employee_id,
        enterprise_id: item.enterprise_id,
        check_type: 'out',
        check_time: checkTimeIso,
      })
      if (error) throw error
      await loadData(admin)
      refreshNotifications()
      return true
    } catch (error) {
      console.error('Erreur régularisation sortie manquante:', error)
      return false
    } finally {
      setSavingForgottenExitId(null)
    }
  }
  const handleLogout = () => {
    localStorage.removeItem('admin')
    localStorage.removeItem('last_enterprise_id')
    navigate('/login')
  }

  return {
    canManageConflict,
    openConflictModal,
    resolveConflict,
    handleQuickScheduleRequest,
    confirmForgottenExit,
    handleLogout,
  }
}
