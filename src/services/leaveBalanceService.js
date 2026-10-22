// src/services/leaveBalanceService.js
import { db } from '../lib/db'
import HolidayService from './holidayService'

function countCalendarDays(startStr, endStr) {
  if (!startStr || !endStr) return 0
  const diff = Math.ceil((new Date(endStr) - new Date(startStr)) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
}

class LeaveBalanceService {
  async getEnterpriseLeaveConfig(enterpriseId) {
    const { data, error } = await db()
      .from('payroll_settings')
      .select('leave_days_per_month, annual_leave_cap, leave_carry_over, leave_reference_date')
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur config congés:', error)
    }

    return {
      leave_days_per_month: parseFloat(data?.leave_days_per_month) || 1.75,
      annual_leave_cap: parseInt(data?.annual_leave_cap) || 30,
      leave_carry_over: !!data?.leave_carry_over,
      leave_reference_date: data?.leave_reference_date || 'hire_date',
    }
  }

  async calculateBalance(employeeId, year = new Date().getFullYear()) {
    const { data: employee, error: employeeError } = await db()
      .from('employees')
      .select('id, enterprise_id, hire_date, first_name, last_name, is_active')
      .eq('id', employeeId)
      .single()

    if (employeeError || !employee) {
      throw new Error('Employé introuvable')
    }

    const config = await this.getEnterpriseLeaveConfig(employee.enterprise_id)

    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    let monthsWorked = 0

    if (config.leave_reference_date === 'hire_date' && employee.hire_date) {
      const hireDate = new Date(employee.hire_date + 'T12:00:00Z')
      const refStart = hireDate.getUTCFullYear() > year
        ? null
        : hireDate.getUTCFullYear() === year
          ? hireDate
          : new Date(`${year}-01-01T12:00:00Z`)

      if (refStart) {
        const endRef = new Date(`${year}-12-31T12:00:00Z`)
        monthsWorked =
          (endRef.getUTCFullYear() - refStart.getUTCFullYear()) * 12 +
          (endRef.getUTCMonth() - refStart.getUTCMonth()) + 1
      }
    } else {
      monthsWorked = 12
    }

    monthsWorked = Math.max(0, monthsWorked)

    const totalAcquiredRaw = monthsWorked * config.leave_days_per_month
    const totalAcquired = Math.min(
      Math.round(totalAcquiredRaw * 100) / 100,
      config.annual_leave_cap
    )

    const holidayList = await HolidayService.getHolidaysForEnterprise(employee.enterprise_id, year)
    const holidaySet = HolidayService.buildHolidaySet((holidayList || []).filter(h => !h.is_worked))

    // ═══════════════════════════════════════════════════════════
    // ✅ CALCUL DES JOURS PRIS (absences approuvées)
    // ═══════════════════════════════════════════════════════════
    const { data: approvedAbsences, error: approvedError } = await db()
      .from('absences')
      .select('start_date, end_date, reason, status, count_holidays_as_leave')
      .eq('employee_id', employeeId)
      .gte('start_date', yearStart)
      .lte('end_date', yearEnd)
      .in('status', ['approuve', 'approved', 'Approuvée'])
      .eq('reason', 'conge')

    if (approvedError) throw approvedError

    // ═══════════════════════════════════════════════════════════
    // ✅ CALCUL DES JOURS EN ATTENTE (leave_requests en_attente)
    // ═══════════════════════════════════════════════════════════
    const { data: pendingRequests, error: pendingError } = await db()
      .from('leave_requests')
      .select('start_date, end_date, leave_type')
      .eq('employee_id', employeeId)
      .gte('start_date', yearStart)
      .lte('end_date', yearEnd)
      .eq('status', 'en_attente')
      .eq('leave_type', 'conge_paye')

    if (pendingError) throw pendingError

    let totalTaken = 0
    let totalPendingWorkingDays = 0
    let totalPendingCalendarDays = 0

    // Calcul jours pris (absences approuvées)
    for (const absence of approvedAbsences || []) {
      const days = absence.count_holidays_as_leave
        ? countCalendarDays(absence.start_date, absence.end_date)
        : HolidayService.countWorkingDays(absence.start_date, absence.end_date, holidaySet, true)
      totalTaken += days
    }

    // ✅ CALCUL JOURS EN ATTENTE (jours ouvrés ET calendaires)
    for (const request of pendingRequests || []) {
      const workingDays = HolidayService.countWorkingDays(
        request.start_date,
        request.end_date,
        holidaySet,
        true
      )
      const calendarDays = countCalendarDays(request.start_date, request.end_date)
      
      totalPendingWorkingDays += workingDays
      totalPendingCalendarDays += calendarDays
    }

    const totalPending = totalPendingWorkingDays

    // Report de l'année précédente si activé
    let carryOverPrevious = 0
    if (config.leave_carry_over) {
      const { data: previousBalance } = await db()
        .from('employee_leave_balances')
        .select('balance')
        .eq('employee_id', employeeId)
        .eq('year', year - 1)
        .maybeSingle()

      carryOverPrevious = Math.max(0, parseFloat(previousBalance?.balance) || 0)
    }

    const balance = Math.round((totalAcquired + carryOverPrevious - totalTaken - totalPending) * 100) / 100

    const payload = {
      employee_id: employeeId,
      enterprise_id: employee.enterprise_id,
      year,
      total_acquired: totalAcquired,
      total_taken: totalTaken,
      total_pending: totalPending,
      pending_calendar_days: totalPendingCalendarDays,  // ✅ NOUVEAU
      balance,
      carry_over_previous: carryOverPrevious,
      calculation_details: {
        employee_name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        months_worked: monthsWorked,
        leave_days_per_month: config.leave_days_per_month,
        annual_leave_cap: config.annual_leave_cap,
        leave_reference_date: config.leave_reference_date,
        leave_carry_over: config.leave_carry_over,
      },
      last_calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await db()
      .from('employee_leave_balances')
      .upsert(payload, { onConflict: 'employee_id,year' })

    if (upsertError) throw upsertError

    return payload
  }

  async getBalance(employeeId, year = new Date().getFullYear()) {
    const { data, error } = await db()
      .from('employee_leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .maybeSingle()

    if (error) {
      console.error('Erreur récupération solde congé:', error)
      throw error
    }

    return data || {
      employee_id: employeeId,
      year,
      total_acquired: 0,
      total_taken: 0,
      total_pending: 0,
      pending_calendar_days: 0,  // ✅ NOUVEAU
      balance: 0,
      carry_over_previous: 0,
      calculation_details: null,
    }
  }

  async getOrCalculateBalance(employeeId, year = new Date().getFullYear()) {
    // ✅ CHANGEMENT : Toujours recalculer pour avoir les données à jour
    return this.calculateBalance(employeeId, year)
  }

  async recalculateAllBalances(enterpriseId, year = new Date().getFullYear()) {
    const { data: employees, error } = await db()
      .from('employees')
      .select('id')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)

    if (error) throw error

    let success = 0
    let failed = 0

    for (const employee of employees || []) {
      try {
        await this.calculateBalance(employee.id, year)
        success++
      } catch (err) {
        console.error(`Erreur recalcul employé ${employee.id}:`, err)
        failed++
      }
    }

    return {
      total: (employees || []).length,
      success,
      failed,
    }
  }

  async recalculateForEmployee(employeeId, year = new Date().getFullYear()) {
    return this.calculateBalance(employeeId, year)
  }

  async getEnterpriseBalances(enterpriseId, year = new Date().getFullYear()) {
    const { data, error } = await db()
      .from('employee_leave_balances')
      .select(`
        *,
        employees (
          id,
          first_name,
          last_name,
          matricule,
          department,
          position,
          hire_date,
          is_active
        )
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('year', year)
      .order('employee_id')

    if (error) throw error
    return data || []
  }
}

export default new LeaveBalanceService()