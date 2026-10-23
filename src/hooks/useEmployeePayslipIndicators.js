import { useCallback, useEffect, useState } from 'react'
import usePlanningPayslips, { payslipsForDay } from './usePlanningPayslips'
import { jourLocal } from '../utils/timezoneUtils'

// One metadata query scope per page, never one query per employee card.
export default function useEmployeePayslipIndicators(employees, selectedDate) {
  const [today, setToday] = useState(() => jourLocal(new Date()))
  useEffect(() => {
    if (selectedDate) return
    const update = () => setToday(jourLocal(new Date()))
    const timer = window.setInterval(update, 60000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [selectedDate])
  const date = selectedDate || today
  const status = usePlanningPayslips(employees, [date])
  const entriesFor = useCallback(employee => {
    const slips = payslipsForDay(status.index, employee, date)
    return slips.length ? [{ employee, slips }] : []
  }, [status.index, date])
  return { ...status, date, entriesFor }
}
