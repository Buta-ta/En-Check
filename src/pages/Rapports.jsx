// ═══════════════════════════════════════════════════════════
// 📊 PAGE RAPPORTS - V5 CORRIGÉE + RAPPORT GRAPHIQUE
// Heures Sup alignées sur FeatureService.calculateOvertimeWithSchedule
// + Congés, Absences, Jours Fériés, Cohérence travail de nuit
// + Génération de rapport graphique
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { minutesDepuisMinuit } from '../utils/timezoneUtils'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ArrowLeft, Calendar, Building2, FileText, Download,
  FileSpreadsheet, Users, Clock, CheckCircle, AlertTriangle,
  BarChart3, Timer, CalendarOff, Settings,
  Sparkles, Eye, RefreshCw, CalendarDays, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import FeatureService from '../services/featureService'
import HolidayService from '../services/holidayService'
import { filtrerPointagesPayables } from '../services/seuilsPointage'

// ═══════════════════════════════════════════════════════════
// UTILITAIRES DE FORMATAGE
// ═══════════════════════════════════════════════════════════

const formatMinutesToHM = (minutes) => {
  if (!minutes || minutes <= 0) return '0h00'
  const totalMins = Math.round(minutes)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

const formatDateFr = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
  })
}

const formatDateLong = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  })
}

const calculateWorkingDays = (start, end) => {
  let count = 0
  const startDate = new Date(start + 'T12:00:00Z')
  const endDate = new Date(end + 'T12:00:00Z')
  while (startDate <= endDate) {
    const day = startDate.getUTCDay()
    if (day !== 0 && day !== 6) count++
    startDate.setUTCDate(startDate.getUTCDate() + 1)
  }
  return count
}

const calcBusinessDays = (startStr, endStr) => {
  const start = new Date(startStr + 'T12:00:00Z')
  const end = new Date(endStr + 'T12:00:00Z')
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) count++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return count || 1
}

// ═══════════════════════════════════════════════════════════
// UTILITAIRES DE CONVERSION DE COULEURS
// ═══════════════════════════════════════════════════════════

const hslToHex = (h, s, l) => {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x
  }

  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

const adjustColor = (color, amount) => {
  // Assurer que color est une chaîne valide
  if (!color || typeof color !== 'string') {
    return '#F59E0B' // Couleur par défaut
  }

  // Nettoyer la couleur
  const cleanColor = color.replace(/^#/, '')
  
  // Vérifier si c'est un format hexadécimal valide
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
    return color // Retourner la couleur originale si invalide
  }

  // Convertir et ajuster
  const num = parseInt(cleanColor, 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// ═══════════════════════════════════════════════════════════
// UTILITAIRES GRAPHIQUES
// ═══════════════════════════════════════════════════════════

const createChartImage = (chartData, type = 'bar') => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 400
    const ctx = canvas.getContext('2d')

    // Fond
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (type === 'bar') {
      drawBarChart(ctx, chartData, canvas.width, canvas.height)
    } else if (type === 'pie') {
      drawPieChart(ctx, chartData, canvas.width, canvas.height)
    } else if (type === 'line') {
      drawLineChart(ctx, chartData, canvas.width, canvas.height)
    }

    resolve(canvas.toDataURL('image/png'))
  })
}

const drawBarChart = (ctx, data, width, height) => {
  const padding = 60
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const maxValue = Math.max(...data.values, 1)
  const barWidth = Math.min((chartWidth / data.labels.length) - 20, 60)
  
  // Axes
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()

  // Grille horizontale
  ctx.strokeStyle = '#E5E5E5'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }

  // Barres
  data.values.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight
    const x = padding + (index * (chartWidth / data.labels.length)) + ((chartWidth / data.labels.length) - barWidth) / 2
    const y = height - padding - barHeight

    // Couleur de base
    const baseColor = data.colors?.[index] || '#F59E0B'
    
    // Gradient
    const gradient = ctx.createLinearGradient(x, y, x, height - padding)
    gradient.addColorStop(0, baseColor)
    
    // Couleur plus foncée pour le bas
    const darkerColor = adjustColor(baseColor, -30)
    gradient.addColorStop(1, darkerColor)
    
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, barWidth, barHeight)

    // Bordure
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, barWidth, barHeight)

    // Valeur au-dessus
    ctx.fillStyle = '#333333'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(value.toString(), x + barWidth / 2, y - 5)

    // Label
    ctx.save()
    ctx.translate(x + barWidth / 2, height - padding + 15)
    ctx.rotate(-Math.PI / 6)
    ctx.font = '10px Arial'
    ctx.fillStyle = '#666666'
    ctx.textAlign = 'right'
    const label = data.labels[index].length > 15 ? data.labels[index].substring(0, 12) + '...' : data.labels[index]
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })

  // Titre
  ctx.font = 'bold 16px Arial'
  ctx.fillStyle = '#141423'
  ctx.textAlign = 'center'
  ctx.fillText(data.title || '', width / 2, 30)
}

const drawPieChart = (ctx, data, width, height) => {
  const centerX = width / 2
  const centerY = height / 2 + 10
  const radius = Math.min(width, height) / 3.5
  const total = data.values.reduce((a, b) => a + b, 0)
  
  if (total === 0) {
    ctx.font = '14px Arial'
    ctx.fillStyle = '#666666'
    ctx.textAlign = 'center'
    ctx.fillText('Aucune donnée disponible', centerX, centerY)
    return
  }
  
  let currentAngle = -Math.PI / 2

  data.values.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI
    
    // Slice
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
    ctx.closePath()
    ctx.fillStyle = data.colors?.[index] || `hsl(${index * 360 / data.values.length}, 70%, 60%)`
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 3
    ctx.stroke()

    // Label et pourcentage
    if (value > 0) {
      const labelAngle = currentAngle + sliceAngle / 2
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.6)
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.6)
      
      const percentage = ((value / total) * 100).toFixed(1)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      ctx.strokeText(`${percentage}%`, labelX, labelY)
      ctx.fillText(`${percentage}%`, labelX, labelY)
    }

    currentAngle += sliceAngle
  })

  // Légende
  const legendX = 20
  let legendY = height - (data.labels.length * 25) - 10
  
  data.labels.forEach((label, index) => {
    if (data.values[index] > 0) {
      // Carré couleur
      ctx.fillStyle = data.colors?.[index] || `hsl(${index * 360 / data.values.length}, 70%, 60%)`
      ctx.fillRect(legendX, legendY, 18, 18)
      ctx.strokeStyle = '#333333'
      ctx.lineWidth = 1
      ctx.strokeRect(legendX, legendY, 18, 18)
      
      // Texte
      ctx.fillStyle = '#333333'
      ctx.font = '11px Arial'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${label}: ${data.values[index]}`, legendX + 25, legendY + 9)
      
      legendY += 25
    }
  })

  // Titre
  ctx.font = 'bold 16px Arial'
  ctx.fillStyle = '#141423'
  ctx.textAlign = 'center'
  ctx.fillText(data.title || '', width / 2, 25)
}

const drawLineChart = (ctx, data, width, height) => {
  const padding = 60
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const maxValue = Math.max(...data.values, 1)
  
  // Axes
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()

  // Grille horizontale
  ctx.strokeStyle = '#E5E5E5'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
    
    // Valeur
    ctx.fillStyle = '#666666'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(Math.round(maxValue * (1 - i / 5)).toString(), padding - 10, y + 4)
  }

  // Ligne
  ctx.strokeStyle = '#F59E0B'
  ctx.lineWidth = 3
  ctx.beginPath()
  
  data.values.forEach((value, index) => {
    const x = padding + (index * (chartWidth / Math.max(data.values.length - 1, 1)))
    const y = height - padding - (value / maxValue) * chartHeight
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.stroke()

  // Points
  data.values.forEach((value, index) => {
    const x = padding + (index * (chartWidth / Math.max(data.values.length - 1, 1)))
    const y = height - padding - (value / maxValue) * chartHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#F59E0B'
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // Label
    if (data.labels[index]) {
      ctx.save()
      ctx.translate(x, height - padding + 15)
      ctx.rotate(-Math.PI / 6)
      ctx.font = '9px Arial'
      ctx.fillStyle = '#666666'
      ctx.textAlign = 'right'
      ctx.fillText(data.labels[index], 0, 0)
      ctx.restore()
    }
  })

  // Titre
  ctx.font = 'bold 16px Arial'
  ctx.fillStyle = '#141423'
  ctx.textAlign = 'center'
  ctx.fillText(data.title || '', width / 2, 30)
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════

export default function Rapports() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const [includeRetards, setIncludeRetards] = useState(true)
  const [includeHeuresSup, setIncludeHeuresSup] = useState(false)
  const [includeAbsences, setIncludeAbsences] = useState(false)
  const [includeConges, setIncludeConges] = useState(false)

  const [includeHolidays, setIncludeHolidays] = useState(false)
  const [includeWorkedHolidays, setIncludeWorkedHolidays] = useState(true)
  const [includeNonWorkedHolidays, setIncludeNonWorkedHolidays] = useState(true)

  const [hasHeuresSupFeature, setHasHeuresSupFeature] = useState(false)
  const [hasAbsencesFeature, setHasAbsencesFeature] = useState(false)

  const [previewData, setPreviewData] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }

    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setDateDebut(firstDay.toISOString().split('T')[0])
    setDateFin(lastDay.toISOString().split('T')[0])

    if (parsedAdmin.role === 'super_admin') {
      setSelectedEntrepriseId('all')
      loadEntreprises()
    } else {
      const activeId = parsedAdmin.selectedEnterprise?.id || parsedAdmin.enterprise_id
      setSelectedEntrepriseId(activeId)
    }
  }, [navigate])

  useEffect(() => {
    checkFeatures()
  }, [selectedEntrepriseId, admin])

  const loadEntreprises = async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setEntreprises(data || [])
  }

  const checkFeatures = async () => {
    if (!admin) return

    const enterpriseId = admin.role === 'super_admin'
      ? selectedEntrepriseId
      : (admin.selectedEnterprise?.id || admin.enterprise_id)

    if (!enterpriseId || enterpriseId === 'all') {
      setHasHeuresSupFeature(admin.role === 'super_admin')
      setHasAbsencesFeature(admin.role === 'super_admin')
      return
    }

    try {
      const { data: enterprise } = await supabase
        .from('enterprises')
        .select('module_heures_supplementaires, module_conges')
        .eq('id', enterpriseId)
        .single()

      setHasHeuresSupFeature(enterprise?.module_heures_supplementaires || false)
      setHasAbsencesFeature(enterprise?.module_conges || false)
    } catch {
      setHasHeuresSupFeature(false)
      setHasAbsencesFeature(false)
    }
  }

  // ═══ FETCH DATA ═══
  const fetchReportData = async () => {
    try {
      let targetEnterpriseId = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        targetEnterpriseId = admin.selectedEnterprise?.id || admin.enterprise_id
      }

      let employeesQuery = supabase
        .from('employees')
        .select('*, enterprises(id, name)')
        .eq('is_active', true)
        .order('last_name')

      if (targetEnterpriseId !== 'all') {
        employeesQuery = employeesQuery.eq('enterprise_id', targetEnterpriseId)
      }

      const { data: employees } = await employeesQuery
      const employeeIds = employees?.map(e => e.id) || []

      let employeeSchedulesMap = {}
      if (employeeIds.length > 0) {
        const { data: schedules } = await supabase
          .from('employee_schedules')
          .select('*, work_schedules(*)')
          .in('employee_id', employeeIds)

        ;(schedules || []).forEach(s => {
          employeeSchedulesMap[s.employee_id] = s
        })
      }

      const enterpriseIds = [...new Set((employees || []).map(e => e.enterprise_id).filter(Boolean))]
      let defaultScheduleByEnterprise = {}

      if (enterpriseIds.length > 0) {
        const { data: defaultSchedules } = await supabase
          .from('work_schedules')
          .select('*')
          .in('enterprise_id', enterpriseIds)
          .eq('is_default', true)
          .eq('is_active', true)

        ;(defaultSchedules || []).forEach(s => {
          if (!defaultScheduleByEnterprise[s.enterprise_id]) {
            defaultScheduleByEnterprise[s.enterprise_id] = s
          }
        })
      }

      let attendancesQuery = supabase
        .from('attendances')
        .select('*')
        .gte('check_time', `${dateDebut}T00:00:00`)
        .lte('check_time', `${dateFin}T23:59:59`)
        .order('check_time', { ascending: true })

      if (targetEnterpriseId !== 'all') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', targetEnterpriseId)
      }

      const { data: attendances } = await attendancesQuery

      let absencesData = []
      if (includeAbsences || includeConges) {
        let absQuery = supabase
          .from('absences')
          .select('*, employees(first_name, last_name, matricule)')
          .gte('start_date', dateDebut)
          .lte('end_date', dateFin)
          .eq('status', 'approuve')

        if (targetEnterpriseId !== 'all') {
          absQuery = absQuery.eq('enterprise_id', targetEnterpriseId)
        }

        const { data: absences } = await absQuery
        absencesData = absences || []
      }

      let overtimeSettings = null
      if (includeHeuresSup && targetEnterpriseId !== 'all') {
        overtimeSettings = await FeatureService.getOvertimeSettings(targetEnterpriseId)
      }

      // ═══ CHARGEMENT DES PLANNINGS (work_schedules) POUR HEURES SUP ═══
      let allSchedules = []
      if (includeHeuresSup) {
        const enterpriseIdsToLoad = targetEnterpriseId === 'all'
          ? enterpriseIds
          : [targetEnterpriseId]
        allSchedules = await FeatureService.loadSchedules(enterpriseIdsToLoad)
      }

      let holidays = []
      let holidaySetByEnterprise = {}
      let holidayMapByEnterprise = {}

      if (includeHolidays || includeHeuresSup) {
        const enterpriseIdsToLoad =
          targetEnterpriseId === 'all'
            ? enterpriseIds
            : [targetEnterpriseId]

        const allHolidayRows = []

        await Promise.all(
          enterpriseIdsToLoad.map(async (entId) => {
            const entHolidays = await HolidayService.getHolidaysForRange(entId, dateDebut, dateFin)
            const activeHolidays = entHolidays || []
            holidaySetByEnterprise[entId] = HolidayService.buildHolidaySet(activeHolidays)
            holidayMapByEnterprise[entId] = HolidayService.buildHolidayMap(activeHolidays)
            activeHolidays.forEach(h => {
              allHolidayRows.push({ ...h, enterprise_id: entId })
            })
          })
        )

        holidays = allHolidayRows
      }

      // ═══ CHARGEMENT DES OVERTIME SETTINGS PAR ENTERPRISE (multi-tenant) ═══
      let overtimeSettingsByEnterprise = {}
      if (includeHeuresSup) {
        if (targetEnterpriseId === 'all') {
          await Promise.all(
            enterpriseIds.map(async (entId) => {
              overtimeSettingsByEnterprise[entId] = await FeatureService.getOvertimeSettings(entId)
            })
          )
        } else {
          overtimeSettingsByEnterprise[targetEnterpriseId] = overtimeSettings
        }
      }

      return {
        employees: employees || [],
        attendances: attendances || [],
        employeeSchedulesMap,
        defaultScheduleByEnterprise,
        absences: absencesData,
        overtimeSettings,
        overtimeSettingsByEnterprise,
        allSchedules,
        holidays,
        holidaySetByEnterprise,
        holidayMapByEnterprise,
      }
    } catch (error) {
      console.error('Erreur fetchReportData:', error)
      return {
        employees: [],
        attendances: [],
        employeeSchedulesMap: {},
        defaultScheduleByEnterprise: {},
        absences: [],
        overtimeSettings: null,
        overtimeSettingsByEnterprise: {},
        allSchedules: [],
        holidays: [],
        holidaySetByEnterprise: {},
        holidayMapByEnterprise: {},
      }
    }
  }

  // ═══ CALCUL HEURES PAR JOUR AVEC NUIT ═══
  //  ⚠️ DETTE SIGNALÉE À L'IA ARBITRE : ceci est une COPIE conforme de
  //  `PayrollService.calculateWorkedMinutesByDay`. Deux copies = deux endroits à
  //  corriger ensemble (c'est fait, même filtre au même endroit) ; la vraie
  //  correction est de supprimer le doublon et d'appeler le service. À arbitrer
  //  séparément — hors périmètre de cette PR, pour ne pas mélanger un nettoyage
  //  de 600 lignes avec un correctif de paie.
  const calculateWorkedMinutesByDay = (employeeId, allAttendances) => {
    const empAttendances = (allAttendances || [])
      .filter(a => a.employee_id === employeeId)
      //  Même doctrine que la paie (§4.1) : une sortie estimée et non validée par
      //  un humain ne doit pas gonfler un rapport, un graphique, ni un cumul.
      .filter(filtrerPointagesPayables)
      .sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

    const dateSet = new Set(empAttendances.map(a => a.check_time.split('T')[0]))
    const dailyMinutes = {}

    dateSet.forEach(dateStr => {
      const startOfDay = new Date(`${dateStr}T00:00:00Z`)
      const endOfNextDay = new Date(startOfDay)
      endOfNextDay.setUTCDate(endOfNextDay.getUTCDate() + 1)
      endOfNextDay.setUTCHours(14, 0, 0, 0)

      const relevantAttendances = empAttendances.filter(att => {
        const t = new Date(att.check_time)
        return t >= startOfDay && t <= endOfNextDay
      })

      let totalSeconds = 0
      let currentIn = null
      let validPairs = []

      for (let i = 0; i < relevantAttendances.length; i++) {
        const pt = relevantAttendances[i]
        const ptDate = new Date(pt.check_time)
        const pointageDateStr = pt.check_time.split('T')[0]

        if (pt.check_type === 'in') {
          let isValidIn = false

          if (pointageDateStr === dateStr) {
            isValidIn = true
          } else {
            if (validPairs.length > 0) {
              const lastOutTime = new Date(validPairs[validPairs.length - 1].out.check_time)
              const diffHours = (ptDate - lastOutTime) / (1000 * 60 * 60)
              if (diffHours < 8) {
                isValidIn = true
              }
            }
          }

          if (isValidIn) {
            currentIn = pt
          } else {
            currentIn = null
          }
        } else if (pt.check_type === 'out' && currentIn) {
          const inDate = new Date(currentIn.check_time)
          const diffHours = (ptDate - inDate) / (1000 * 60 * 60)

          if (diffHours <= 16) {
            totalSeconds += (ptDate - inDate) / 1000
            validPairs.push({ in: currentIn, out: pt })
            currentIn = null
          }
        }
      }

      dailyMinutes[dateStr] = Math.round(totalSeconds / 60)
    })

    return dailyMinutes
  }

  // ═══ CALCULS EMPLOYÉ — ALIGNÉ SUR EmployeeHeures.jsx ═══
  const calculateEmployeeStats = (
    employee,
    attendances,
    employeeSchedulesMap,
    defaultScheduleByEnterprise,
    overtimeSettingsByEnterprise,
    holidaySetByEnterprise = {},
    holidayMapByEnterprise = {},
    allSchedules = []
  ) => {
    const employeeId = employee.id
    const enterpriseId = employee.enterprise_id

    const schedulePerso = employeeSchedulesMap[employeeId]
    let heureArrivee = null
    let tolerance = 15
    let dailyThresholdMinutes = 8 * 60
    let hasPlanningRetards = false

    if (schedulePerso) {
      if (schedulePerso.use_custom_hours && schedulePerso.custom_start_time) {
        heureArrivee = schedulePerso.custom_start_time.slice(0, 5)
        tolerance = schedulePerso.custom_late_tolerance_minutes || 15
        hasPlanningRetards = true
      } else if (schedulePerso.schedule_id && schedulePerso.work_schedules) {
        heureArrivee = schedulePerso.work_schedules.start_time?.slice(0, 5) || null
        tolerance = schedulePerso.work_schedules.late_tolerance_minutes || 15

        if (schedulePerso.work_schedules.start_time && schedulePerso.work_schedules.end_time) {
          const [hS, mS] = schedulePerso.work_schedules.start_time.split(':').map(Number)
          const [hE, mE] = schedulePerso.work_schedules.end_time.split(':').map(Number)
          let pauseMinutes = 0
          if (
            schedulePerso.work_schedules.has_break &&
            schedulePerso.work_schedules.break_start &&
            schedulePerso.work_schedules.break_end
          ) {
            const [bS, bmS] = schedulePerso.work_schedules.break_start.split(':').map(Number)
            const [bE, bmE] = schedulePerso.work_schedules.break_end.split(':').map(Number)
            pauseMinutes = (bE * 60 + bmE) - (bS * 60 + bmS)
          }
          dailyThresholdMinutes = (hE * 60 + mE) - (hS * 60 + mS) - pauseMinutes
        }

        if (heureArrivee) hasPlanningRetards = true
      }
    }

    if (!heureArrivee) {
      const defaultSchedule = defaultScheduleByEnterprise[enterpriseId]
      if (defaultSchedule) {
        heureArrivee = defaultSchedule.start_time?.slice(0, 5) || null
        tolerance = defaultSchedule.late_tolerance_minutes || 15

        if (defaultSchedule.start_time && defaultSchedule.end_time) {
          const [hS, mS] = defaultSchedule.start_time.split(':').map(Number)
          const [hE, mE] = defaultSchedule.end_time.split(':').map(Number)
          let pauseMinutes = 0
          if (
            defaultSchedule.has_break &&
            defaultSchedule.break_start &&
            defaultSchedule.break_end
          ) {
            const [bS, bmS] = defaultSchedule.break_start.split(':').map(Number)
            const [bE, bmE] = defaultSchedule.break_end.split(':').map(Number)
            pauseMinutes = (bE * 60 + bmE) - (bS * 60 + bmS)
          }
          dailyThresholdMinutes = (hE * 60 + mE) - (hS * 60 + mS) - pauseMinutes
        }

        if (heureArrivee) hasPlanningRetards = true
      }
    }

    const holidaySet = holidaySetByEnterprise[enterpriseId] || new Set()
    const holidayMap = holidayMapByEnterprise[enterpriseId] || new Map()
    const overtimeSettings = overtimeSettingsByEnterprise[enterpriseId] || FeatureService.getDefaultOvertimeSettings()
    const empAttendances = attendances.filter(a => a.employee_id === employeeId)

    const parJour = {}
    empAttendances.forEach(att => {
      const jour = att.check_time.split('T')[0]
      if (!parJour[jour]) parJour[jour] = []
      parJour[jour].push(att)
    })

    const workedMinutesByDay = calculateWorkedMinutesByDay(employeeId, attendances)

    let totalMinutes = 0
    let joursPresent = 0
    let retardsCount = 0
    let retardsMinutes = 0
    let heuresSupNormalesSeconds = 0
    let heuresSupMajoreesSeconds = 0
    let workedHolidaysCount = 0
    let workedHolidaysMinutes = 0
    let holidayDaysInRange = 0
    let nonWorkedHolidayDays = 0
    let workedHolidayDetails = []

    Object.entries(parJour).forEach(([jour, atts]) => {
      atts.sort((a, b) => new Date(a.check_time) - new Date(b.check_time))

      const firstIn = atts.find(a => a.check_type === 'in')
      const holiday = holidayMap.get(jour) || null
      const isHoliday = holidaySet.has(jour)
      const holidayRate = holiday?.overtime_rate ?? (overtimeSettings?.rate_holiday || 100)
      const jourMinutes = workedMinutesByDay[jour] || 0
      const jourSeconds = jourMinutes * 60

      if (firstIn) {
        joursPresent++

        if (hasPlanningRetards && heureArrivee && !(isHoliday && !holiday?.is_worked)) {
          // ⭐ LIVRAISON 04 : heure locale de l'entreprise
          const minutesPointage = minutesDepuisMinuit(firstIn.check_time)
          const [hA, mA] = heureArrivee.split(':').map(Number)

          const minutesArriveeBase = hA * 60 + mA
          const minutesArriveeMax = minutesArriveeBase + tolerance
          const retardMin = minutesPointage - minutesArriveeBase

          if (minutesPointage > minutesArriveeMax && retardMin > 0) {
            retardsCount++
            retardsMinutes += retardMin
          }
        }
      }

      totalMinutes += jourMinutes

      if (isHoliday) {
        holidayDaysInRange += 1
        if (!holiday?.is_worked) {
          nonWorkedHolidayDays += 1
        }

        if (jourMinutes > 0) {
          workedHolidaysCount += 1
          workedHolidaysMinutes += jourMinutes
          workedHolidayDetails.push({
            date: jour,
            name: holiday?.name || 'Jour férié',
            minutes: jourMinutes,
            rate: holidayRate,
          })
        }
      }

      // ═══════════════════════════════════════════════════════
      // ✅ CALCUL HEURES SUP — MÊME LOGIQUE QUE EmployeeHeures.jsx
      //    Utilise FeatureService.calculateOvertimeWithSchedule
      // ═══════════════════════════════════════════════════════
      if (includeHeuresSup && jourSeconds > 0) {
        const overtime = FeatureService.calculateOvertimeForEmployeeDay({
          totalWorkedSeconds: jourSeconds,
          employeeSchedule: schedulePerso || null,
          enterpriseId,
          dateStr: jour,
          allSchedules: allSchedules || [],
          overtimeSettings,
          holiday: holiday || null,
        })

        heuresSupNormalesSeconds += (overtime.overtimeSeconds || 0)
        heuresSupMajoreesSeconds += (overtime.overtimeMajorSeconds || 0)
      }
    })

    // Recalculer dailyThresholdMinutes depuis le schedule réel pour affichage cohérent
    const firstDayWithWork = Object.keys(parJour).sort()[0]
    if (firstDayWithWork) {
      const overtimePreview = FeatureService.calculateOvertimeForEmployeeDay({
        totalWorkedSeconds: 0,
        employeeSchedule: schedulePerso || null,
        enterpriseId,
        dateStr: firstDayWithWork,
        allSchedules: allSchedules || [],
        overtimeSettings,
        holiday: holidayMap.get(firstDayWithWork) || null,
      })

      if (overtimePreview.contractualSeconds && overtimePreview.contractualSeconds > 0) {
        dailyThresholdMinutes = Math.round(overtimePreview.contractualSeconds / 60)
      }
    }

    const heuresSupMinutes = Math.round(heuresSupNormalesSeconds / 60)
    const heuresSupMajoreesMinutes = Math.round(heuresSupMajoreesSeconds / 60)

    return {
      joursPresent,
      totalMinutes: Math.round(totalMinutes),
      moyenneMinutes: joursPresent > 0 ? Math.round(totalMinutes / joursPresent) : 0,
      retardsCount,
      retardsMinutes: Math.round(retardsMinutes),
      heureArrivee,
      hasPlanningRetards,
      heuresSupMinutes,
      heuresSupMajorees: heuresSupMajoreesMinutes,
      totalHeuresSupMinutes: heuresSupMinutes + heuresSupMajoreesMinutes,
      rateNormal: overtimeSettings?.rate_normal || 25,
      rateMajor: overtimeSettings?.rate_major || 50,
      dailyThresholdMinutes,
      workedHolidaysCount,
      workedHolidaysMinutes: Math.round(workedHolidaysMinutes),
      holidayDaysInRange,
      nonWorkedHolidayDays,
      workedHolidayDetails,
    }
  }

  const calculateAbsenceStats = (
    employeeId,
    absences,
    holidaySetByEnterprise = {},
    enterpriseId,
    includeNonWorkedHolidayDays = false
  ) => {
    const empAbsences = absences.filter(a => a.employee_id === employeeId)
    const holidaySet = holidaySetByEnterprise[enterpriseId] || new Set()

    let congesDays = 0
    let maladieDays = 0
    let autreDays = 0

    empAbsences.forEach(abs => {
      let days
      if (includeNonWorkedHolidayDays) {
        days = calcBusinessDays(abs.start_date, abs.end_date)
      } else {
        days = HolidayService.countWorkingDays(abs.start_date, abs.end_date, holidaySet, true)
      }

      if (abs.reason === 'conge') congesDays += days
      else if (abs.reason === 'maladie') maladieDays += days
      else autreDays += days
    })

    return {
      total: congesDays + maladieDays + autreDays,
      conges: congesDays,
      maladie: maladieDays,
      autre: autreDays,
      details: empAbsences,
    }
  }

  const loadPreview = async () => {
    setLoadingPreview(true)
    try {
      const data = await fetchReportData()

      const allHolidayRows = data.holidays || []
      const filteredHolidayRows = allHolidayRows.filter(h => {
        if (!includeWorkedHolidays && h.is_worked) return false
        if (!includeNonWorkedHolidays && !h.is_worked) return false
        return true
      })

      const stats = {
        totalEmployees: data.employees.length,
        joursOuvres: calculateWorkingDays(dateDebut, dateFin),
        totalRetards: 0,
        totalRetardsMinutes: 0,
        totalHeuresTravaillees: 0,
        totalHeuresSup: 0,
        totalAbsences: 0,
        totalConges: 0,
        employesSansPlanningRetards: 0,
        totalHolidayDays: filteredHolidayRows.length,
        totalWorkedHolidays: 0,
        totalWorkedHolidaysMinutes: 0,
        employees: [],
      }

      data.employees.forEach(emp => {
        const empStats = calculateEmployeeStats(
          emp,
          data.attendances,
          data.employeeSchedulesMap,
          data.defaultScheduleByEnterprise,
          data.overtimeSettingsByEnterprise,
          data.holidaySetByEnterprise,
          data.holidayMapByEnterprise,
          data.allSchedules
        )
        const absStats = calculateAbsenceStats(
          emp.id,
          data.absences,
          data.holidaySetByEnterprise,
          emp.enterprise_id,
          includeNonWorkedHolidays
        )

        stats.totalRetards += empStats.retardsCount
        stats.totalRetardsMinutes += empStats.retardsMinutes
        stats.totalHeuresTravaillees += empStats.totalMinutes
        stats.totalHeuresSup += empStats.totalHeuresSupMinutes
        stats.totalAbsences += absStats.total
        stats.totalConges += absStats.conges
        stats.totalWorkedHolidays += empStats.workedHolidaysCount
        stats.totalWorkedHolidaysMinutes += empStats.workedHolidaysMinutes

        if (!empStats.hasPlanningRetards) {
          stats.employesSansPlanningRetards++
        }

        stats.employees.push({ ...emp, ...empStats, absences: absStats })
      })

      setPreviewData(stats)
    } catch (error) {
      console.error('Erreur preview:', error)
      toast.error('Erreur lors du chargement de l\'aperçu')
    }
    setLoadingPreview(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 GÉNÉRATION PDF AVEC GRAPHIQUES
  // ═══════════════════════════════════════════════════════════

  const generateGraphicalPDF = async () => {
    setLoading(true)

    try {
      const {
        employees,
        attendances,
        employeeSchedulesMap,
        defaultScheduleByEnterprise,
        absences,
        overtimeSettingsByEnterprise,
        allSchedules,
        holidays,
        holidaySetByEnterprise,
        holidayMapByEnterprise
      } = await fetchReportData()

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      const primaryColor = [245, 158, 11]
      const darkColor = [20, 20, 35]

      // ═══ EN-TÊTE ═══
      doc.setFillColor(...darkColor)
      doc.rect(0, 0, pageWidth, 50, 'F')
      doc.setFillColor(...primaryColor)
      doc.rect(0, 48, pageWidth, 2, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.text('EN-CHECK', pageWidth / 2, 20, { align: 'center' })

      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text('Rapport Graphique de Pointage', pageWidth / 2, 30, { align: 'center' })

      doc.setFontSize(11)
      doc.setTextColor(...primaryColor)
      doc.text(`${formatDateLong(dateDebut)} - ${formatDateLong(dateFin)}`, pageWidth / 2, 42, { align: 'center' })

      const employeesData = employees.map(emp => {
        const stats = calculateEmployeeStats(
          emp,
          attendances,
          employeeSchedulesMap,
          defaultScheduleByEnterprise,
          overtimeSettingsByEnterprise,
          holidaySetByEnterprise,
          holidayMapByEnterprise,
          allSchedules
        )

        const absStats = calculateAbsenceStats(
          emp.id,
          absences,
          holidaySetByEnterprise,
          emp.enterprise_id,
          includeNonWorkedHolidays
        )

        return { emp, stats, absStats }
      })

      let yPos = 60

      // ═══ GRAPHIQUE 1: TOP 10 EMPLOYÉS PAR HEURES TRAVAILLÉES ═══
      const topEmployees = [...employeesData]
        .sort((a, b) => b.stats.totalMinutes - a.stats.totalMinutes)
        .slice(0, 10)

      if (topEmployees.length > 0) {
        // Générer des couleurs en format hexadécimal valide
        const colors = topEmployees.map((_, i) => {
          const hue = 45 + i * 5
          const saturation = 90
          const lightness = 60 - i * 3
          return hslToHex(hue, saturation, lightness)
        })

        const chartData1 = {
          title: 'Top 10 Employés - Heures Travaillées',
          labels: topEmployees.map(e => `${e.emp.first_name} ${e.emp.last_name.charAt(0)}.`),
          values: topEmployees.map(e => Math.round(e.stats.totalMinutes / 60)),
          colors: colors,
        }

        const chart1Image = await createChartImage(chartData1, 'bar')
        doc.addImage(chart1Image, 'PNG', 10, yPos, pageWidth - 20, 90)
        yPos += 100
      }

      // ═══ GRAPHIQUE 2: RÉPARTITION PRÉSENCE ═══
      if (includeRetards || includeAbsences || includeConges) {
        if (yPos > 200) {
          doc.addPage()
          yPos = 20
        }

        const totalDaysPresent = employeesData.reduce((sum, e) => sum + e.stats.joursPresent, 0)
        const totalAbsences = employeesData.reduce((sum, e) => sum + e.absStats.total, 0)
        const totalRetards = employeesData.reduce((sum, e) => sum + e.stats.retardsCount, 0)

        if (totalDaysPresent > 0 || totalAbsences > 0 || totalRetards > 0) {
          const chartData2 = {
            title: 'Répartition Globale - Présence & Retards',
            labels: ['Jours Présent', 'Absences', 'Retards'],
            values: [totalDaysPresent, totalAbsences, totalRetards],
            colors: ['#10B981', '#EF4444', '#F59E0B'],
          }

          const chart2Image = await createChartImage(chartData2, 'pie')
          doc.addImage(chart2Image, 'PNG', 10, yPos, pageWidth - 20, 90)
          yPos += 100
        }
      }

      // ═══ GRAPHIQUE 3: HEURES SUP PAR EMPLOYÉ ═══
      if (includeHeuresSup) {
        const empWithOvertime = employeesData.filter(e => e.stats.totalHeuresSupMinutes > 0)
        
        if (empWithOvertime.length > 0) {
          doc.addPage()
          yPos = 20

          const topOvertime = empWithOvertime
            .sort((a, b) => b.stats.totalHeuresSupMinutes - a.stats.totalHeuresSupMinutes)
            .slice(0, 10)

          const chartData3 = {
            title: 'Top 10 - Heures Supplémentaires',
            labels: topOvertime.map(e => `${e.emp.first_name} ${e.emp.last_name.charAt(0)}.`),
            values: topOvertime.map(e => Math.round(e.stats.totalHeuresSupMinutes / 60)),
            colors: topOvertime.map(() => '#F59E0B'),
          }

          const chart3Image = await createChartImage(chartData3, 'bar')
          doc.addImage(chart3Image, 'PNG', 10, yPos, pageWidth - 20, 90)
          yPos += 100
        }
      }

      // ═══ GRAPHIQUE 4: ABSENCES PAR TYPE ═══
      if (includeAbsences || includeConges) {
        const totalConges = employeesData.reduce((sum, e) => sum + e.absStats.conges, 0)
        const totalMaladie = employeesData.reduce((sum, e) => sum + e.absStats.maladie, 0)
        const totalAutre = employeesData.reduce((sum, e) => sum + e.absStats.autre, 0)

        if (totalConges + totalMaladie + totalAutre > 0) {
          if (yPos > 200) {
            doc.addPage()
            yPos = 20
          }

          const chartData4 = {
            title: 'Répartition des Absences par Type',
            labels: ['Congés', 'Maladie', 'Autre'],
            values: [totalConges, totalMaladie, totalAutre],
            colors: ['#10B981', '#6366F1', '#8B5CF6'],
          }

          const chart4Image = await createChartImage(chartData4, 'pie')
          doc.addImage(chart4Image, 'PNG', 10, yPos, pageWidth - 20, 90)
          yPos += 100
        }
      }

      // ═══ GRAPHIQUE 5: ÉVOLUTION DES HEURES PAR SEMAINE ═══
      const weeklyHours = {}
      
      // Calculer les heures travaillées par semaine
      employeesData.forEach(({ emp }) => {
        const empAttendances = attendances.filter(a => a.employee_id === emp.id)
        const dailyMinutes = calculateWorkedMinutesByDay(emp.id, empAttendances)
        
        Object.entries(dailyMinutes).forEach(([dateStr, minutes]) => {
          const date = new Date(dateStr + 'T12:00:00Z')
          const weekNum = getWeekNumber(date)
          weeklyHours[weekNum] = (weeklyHours[weekNum] || 0) + minutes
        })
      })

      const sortedWeeks = Object.keys(weeklyHours).sort((a, b) => parseInt(a) - parseInt(b))
      
      if (sortedWeeks.length > 1) {
        doc.addPage()
        yPos = 20

        const chartData5 = {
          title: 'Évolution des Heures Travaillées par Semaine',
          labels: sortedWeeks.map(w => `S${w}`),
          values: sortedWeeks.map(w => Math.round(weeklyHours[w] / 60)),
        }

        const chart5Image = await createChartImage(chartData5, 'line')
        doc.addImage(chart5Image, 'PNG', 10, yPos, pageWidth - 20, 90)
      }

      let enterpriseName = 'Toutes_Entreprises'
      if (selectedEntrepriseId !== 'all') {
        if (admin.role === 'super_admin') {
          enterpriseName = entreprises.find(e => e.id === selectedEntrepriseId)?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Entreprise'
        } else {
          enterpriseName = admin.selectedEnterprise?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'MonEntreprise'
        }
      }

      doc.save(`Rapport_Graphique_${enterpriseName}_${dateDebut}_${dateFin}.pdf`)
      toast.success('PDF graphique généré avec succès !')
    } catch (error) {
      console.error('Erreur génération PDF graphique:', error)
      toast.error('Erreur lors de la génération du PDF graphique')
    }

    setLoading(false)
  }

  const generatePDF = async () => {
    setLoading(true)

    try {
      const {
        employees,
        attendances,
        employeeSchedulesMap,
        defaultScheduleByEnterprise,
        absences,
        overtimeSettingsByEnterprise,
        allSchedules,
        holidays,
        holidaySetByEnterprise,
        holidayMapByEnterprise
      } = await fetchReportData()

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      const primaryColor = [245, 158, 11]
      const darkColor = [20, 20, 35]
      const redColor = [239, 68, 68]
      const blueColor = [99, 102, 241]
      const purpleColor = [139, 92, 246]
      const grayColor = [100, 100, 100]

      doc.setFillColor(...darkColor)
      doc.rect(0, 0, pageWidth, 50, 'F')
      doc.setFillColor(...primaryColor)
      doc.rect(0, 48, pageWidth, 2, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.text('EN-CHECK', pageWidth / 2, 20, { align: 'center' })

      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text('Rapport de Pointage', pageWidth / 2, 30, { align: 'center' })

      doc.setFontSize(11)
      doc.setTextColor(...primaryColor)
      doc.text(`${formatDateLong(dateDebut)} - ${formatDateLong(dateFin)}`, pageWidth / 2, 42, { align: 'center' })

      const totalEmployes = employees.length
      const joursOuvres = calculateWorkingDays(dateDebut, dateFin)

      let totalRetards = 0
      let totalMinutesRetard = 0
      let totalHeuresTravail = 0
      let totalHeuresSup = 0
      let totalAbsencesDays = 0
      let nbSansPlanningRetards = 0
      let totalWorkedHolidays = 0
      let totalWorkedHolidaysMinutes = 0

      const filteredHolidayRows = (holidays || []).filter(h => {
        if (!includeWorkedHolidays && h.is_worked) return false
        if (!includeNonWorkedHolidays && !h.is_worked) return false
        return true
      })

      const employeesData = employees.map(emp => {
        const stats = calculateEmployeeStats(
          emp,
          attendances,
          employeeSchedulesMap,
          defaultScheduleByEnterprise,
          overtimeSettingsByEnterprise,
          holidaySetByEnterprise,
          holidayMapByEnterprise,
          allSchedules
        )

        const absStats = calculateAbsenceStats(
          emp.id,
          absences,
          holidaySetByEnterprise,
          emp.enterprise_id,
          includeNonWorkedHolidays
        )

        totalRetards += stats.retardsCount
        totalMinutesRetard += stats.retardsMinutes
        totalHeuresTravail += stats.totalMinutes
        totalHeuresSup += stats.totalHeuresSupMinutes
        totalAbsencesDays += absStats.total
        totalWorkedHolidays += stats.workedHolidaysCount
        totalWorkedHolidaysMinutes += stats.workedHolidaysMinutes

        if (!stats.hasPlanningRetards) nbSansPlanningRetards++

        return { emp, stats, absStats }
      })

      let yPos = 60

      const summaryHeight = includeHolidays
        ? (nbSansPlanningRetards > 0 ? 74 : 64)
        : (nbSansPlanningRetards > 0 ? 62 : 52)

      doc.setFillColor(248, 250, 252)
      doc.roundedRect(14, yPos - 4, pageWidth - 28, summaryHeight, 3, 3, 'F')
      doc.setDrawColor(230, 230, 230)
      doc.roundedRect(14, yPos - 4, pageWidth - 28, summaryHeight, 3, 3, 'S')

      doc.setTextColor(...darkColor)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('RESUME GENERAL', 20, yPos + 8)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      const col1 = 20
      const col2 = 85
      const col3 = 145

      doc.setTextColor(...grayColor)
      doc.text(`Employes : ${totalEmployes}`, col1, yPos + 22)
      doc.text(`Jours ouvres : ${joursOuvres}`, col2, yPos + 22)
      doc.text(`Total travaille : ${formatMinutesToHM(totalHeuresTravail)}`, col3, yPos + 22)

      let ligne2Y = yPos + 34
      if (includeRetards) {
        doc.setTextColor(...redColor)
        doc.text(`Retards : ${totalRetards}`, col1, ligne2Y)
        doc.text(`Temps perdu : ${formatMinutesToHM(totalMinutesRetard)}`, col2, ligne2Y)
      }

      if (includeHeuresSup && totalHeuresSup > 0) {
        doc.setTextColor(...primaryColor)
        doc.text(`Heures sup : ${formatMinutesToHM(totalHeuresSup)}`, includeRetards ? col3 : col1, ligne2Y)
      }

      let line3Y = yPos + 46
      if ((includeAbsences || includeConges) && totalAbsencesDays > 0) {
        doc.setTextColor(...blueColor)
        doc.text(`Jours d'absence : ${totalAbsencesDays}`, col1, line3Y)
      }

      if (includeHolidays) {
        doc.setTextColor(...purpleColor)
        doc.text(`Jours feries : ${filteredHolidayRows.length}`, col2, line3Y)
        doc.text(`Feries travailles : ${totalWorkedHolidays}`, col3, line3Y)
      }

      if (nbSansPlanningRetards > 0) {
        doc.setTextColor(...grayColor)
        doc.text(
          `Note : ${nbSansPlanningRetards} employe(s) sans planning — retards non evalues`,
          col1,
          includeHolidays ? yPos + 58 : yPos + (includeRetards || includeHeuresSup ? 58 : 46)
        )
      }

      yPos += summaryHeight + 10

      const tableHeaders = ['Matricule', 'Nom Complet', 'Poste', 'Jours', 'Heures', 'Moy/J']
      const columnStyles = {
        0: { halign: 'center', cellWidth: 24 },
        1: { halign: 'left', cellWidth: 42 },
        2: { halign: 'left', cellWidth: 26 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 16 },
      }

      let colIdx = 6

      if (includeRetards) {
        tableHeaders.push('Retards', 'Tps perdu')
        columnStyles[colIdx] = { halign: 'center', cellWidth: 16 }
        columnStyles[colIdx + 1] = { halign: 'center', cellWidth: 20 }
        colIdx += 2
      }

      if (includeHeuresSup) {
        tableHeaders.push('H. Sup')
        columnStyles[colIdx] = { halign: 'center', cellWidth: 18 }
        colIdx++
      }

      if (includeHolidays) {
        tableHeaders.push('Feries')
        columnStyles[colIdx] = { halign: 'center', cellWidth: 16 }
        colIdx++
      }

      if (includeAbsences || includeConges) {
        tableHeaders.push('Absences')
        columnStyles[colIdx] = { halign: 'center', cellWidth: 18 }
      }

      const tableData = employeesData.map(({ emp, stats, absStats }) => {
        const row = [
          emp.matricule || '-',
          `${emp.first_name} ${emp.last_name}`,
          emp.position || '-',
          stats.joursPresent.toString(),
          formatMinutesToHM(stats.totalMinutes),
          formatMinutesToHM(stats.moyenneMinutes),
        ]

        if (includeRetards) {
          row.push(stats.hasPlanningRetards ? stats.retardsCount.toString() : '-')
          row.push(stats.hasPlanningRetards ? formatMinutesToHM(stats.retardsMinutes) : '-')
        }

        if (includeHeuresSup) {
          row.push(stats.totalHeuresSupMinutes > 0 ? formatMinutesToHM(stats.totalHeuresSupMinutes) : '-')
        }

        if (includeHolidays) {
          row.push(stats.workedHolidaysCount > 0 ? `${stats.workedHolidaysCount}` : '-')
        }

        if (includeAbsences || includeConges) {
          row.push(absStats.total > 0 ? `${absStats.total}j` : '-')
        }

        return row
      })

      autoTable(doc, {
        startY: yPos,
        head: [tableHeaders],
        body: tableData,
        headStyles: {
          fillColor: darkColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8,
          cellPadding: 4,
        },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [250, 250, 252] },
        columnStyles,
        styles: { overflow: 'linebreak', font: 'helvetica' },
        didParseCell: (data) => {
          if (includeRetards && data.section === 'body') {
            const retardsColStart = 6
            if (data.column.index === retardsColStart || data.column.index === retardsColStart + 1) {
              if (data.cell.text[0] === '-') {
                data.cell.styles.textColor = [150, 150, 150]
              } else {
                data.cell.styles.textColor = redColor
              }
            }
          }
        }
      })

      if (includeHolidays && filteredHolidayRows.length > 0) {
        doc.addPage()

        doc.setFillColor(...darkColor)
        doc.rect(0, 0, pageWidth, 35, 'F')
        doc.setFillColor(...purpleColor)
        doc.rect(0, 33, pageWidth, 2, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('DETAIL DES JOURS FERIES', pageWidth / 2, 22, { align: 'center' })

        const holidayHeaders = ['Date', 'Jour férié', 'Entreprise', 'Type', 'Taux']
        const holidayRows = filteredHolidayRows.map(h => [
          formatDateFr(h.date),
          h.name || 'Jour férié',
          selectedEntrepriseId === 'all'
            ? (entreprises.find(e => e.id === h.enterprise_id)?.name || 'Entreprise')
            : selectedEnterpriseName,
          h.is_worked ? 'Travaillé' : 'Non travaillé',
          `${h.overtime_rate ?? 100}%`,
        ])

        autoTable(doc, {
          startY: 45,
          head: [holidayHeaders],
          body: holidayRows,
          headStyles: {
            fillColor: purpleColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4,
          },
          bodyStyles: { fontSize: 8, cellPadding: 3 },
          alternateRowStyles: { fillColor: [248, 245, 255] },
        })
      }

      if ((includeAbsences || includeConges) && absences.length > 0) {
        doc.addPage()

        doc.setFillColor(...darkColor)
        doc.rect(0, 0, pageWidth, 35, 'F')
        doc.setFillColor(...blueColor)
        doc.rect(0, 33, pageWidth, 2, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('DETAIL DES ABSENCES ET CONGES', pageWidth / 2, 22, { align: 'center' })

        const absHeaders = ['Employe', 'Type', 'Du', 'Au', 'Jours', 'Notes']

        const typeLabels = {
          conge: 'Conge paye',
          maladie: 'Maladie',
          maternite: 'Maternite/Paternite',
          formation: 'Formation',
          deces: 'Deuil',
          injustifie: 'Absence injustifiee',
          autre: 'Autre',
        }

        const absData = absences.map(abs => {
          const days = includeNonWorkedHolidays
            ? calcBusinessDays(abs.start_date, abs.end_date)
            : HolidayService.countWorkingDays(
                abs.start_date,
                abs.end_date,
                holidaySetByEnterprise[abs.enterprise_id] || new Set(),
                true
              )

          return [
            `${abs.employees?.first_name || ''} ${abs.employees?.last_name || ''}`.trim() || '-',
            typeLabels[abs.reason] || abs.reason || '-',
            formatDateFr(abs.start_date),
            formatDateFr(abs.end_date),
            `${days}j`,
            (abs.notes || '-').substring(0, 35) + (abs.notes?.length > 35 ? '...' : ''),
          ]
        })

        autoTable(doc, {
          startY: 45,
          head: [absHeaders],
          body: absData,
          headStyles: {
            fillColor: blueColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4,
          },
          bodyStyles: { fontSize: 8, cellPadding: 3 },
          alternateRowStyles: { fillColor: [245, 247, 255] },
        })
      }

      if (includeHeuresSup) {
        const employeesWithOvertime = employeesData.filter(({ stats }) => stats.totalHeuresSupMinutes > 0)

        if (employeesWithOvertime.length > 0) {
          doc.addPage()

          doc.setFillColor(...darkColor)
          doc.rect(0, 0, pageWidth, 35, 'F')
          doc.setFillColor(...primaryColor)
          doc.rect(0, 33, pageWidth, 2, 'F')

          doc.setTextColor(255, 255, 255)
          doc.setFontSize(18)
          doc.setFont('helvetica', 'bold')
          doc.text('DETAIL DES HEURES SUPPLEMENTAIRES', pageWidth / 2, 22, { align: 'center' })

          const otHeaders = [
            'Matricule', 'Employe', 'Heures travaillees',
            'Seuil', 'H. Sup normales', 'H. Sup majorees', 'Total H. Sup',
          ]

          if (includeHolidays) {
            otHeaders.push('Fériés travaillés')
          }

          const otData = employeesWithOvertime.map(({ emp, stats }) => {
            const row = [
              emp.matricule || '-',
              `${emp.first_name} ${emp.last_name}`,
              formatMinutesToHM(stats.totalMinutes),
              formatMinutesToHM(stats.dailyThresholdMinutes) + '/j',
              formatMinutesToHM(stats.heuresSupMinutes),
              stats.heuresSupMajorees > 0 ? formatMinutesToHM(stats.heuresSupMajorees) : '-',
              formatMinutesToHM(stats.totalHeuresSupMinutes),
            ]

            if (includeHolidays) {
              row.push(stats.workedHolidaysCount > 0 ? `${stats.workedHolidaysCount}` : '-')
            }

            return row
          })

          autoTable(doc, {
            startY: 45,
            head: [otHeaders],
            body: otData,
            headStyles: {
              fillColor: primaryColor,
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              fontSize: 8,
              cellPadding: 4,
            },
            bodyStyles: { fontSize: 8, cellPadding: 3 },
            alternateRowStyles: { fillColor: [255, 251, 245] },
          })
        }
      }

      let enterpriseName = 'Toutes_Entreprises'
      if (selectedEntrepriseId !== 'all') {
        if (admin.role === 'super_admin') {
          enterpriseName = entreprises.find(e => e.id === selectedEntrepriseId)?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Entreprise'
        } else {
          enterpriseName = admin.selectedEnterprise?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'MonEntreprise'
        }
      }

      doc.save(`Rapport_${enterpriseName}_${dateDebut}_${dateFin}.pdf`)
      toast.success('PDF généré avec succès !')
    } catch (error) {
      console.error('Erreur génération PDF:', error)
      toast.error('Erreur lors de la génération du PDF')
    }

    setLoading(false)
  }

  const generateExcel = async () => {
    setLoading(true)

    try {
      const {
        employees,
        attendances,
        employeeSchedulesMap,
        defaultScheduleByEnterprise,
        absences,
        overtimeSettingsByEnterprise,
        allSchedules,
        holidays,
        holidaySetByEnterprise,
        holidayMapByEnterprise
      } = await fetchReportData()

      const headers = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Département', 'Jours Présent', 'Heures Total', 'Moyenne/Jour']
      if (includeRetards) headers.push('Nb Retards', 'Temps Retard', 'Planning Retards')
      if (includeHeuresSup) headers.push('Heures Sup', 'H.Sup Majorées', 'Total H.Sup')
      if (includeHolidays) headers.push('Fériés travaillés', 'Minutes fériées')
      if (includeAbsences || includeConges) headers.push('Congés (j)', 'Maladie (j)', 'Autre (j)')

      const rows = employees.map(emp => {
        const stats = calculateEmployeeStats(
          emp,
          attendances,
          employeeSchedulesMap,
          defaultScheduleByEnterprise,
          overtimeSettingsByEnterprise,
          holidaySetByEnterprise,
          holidayMapByEnterprise,
          allSchedules
        )
        const absStats = calculateAbsenceStats(
          emp.id,
          absences,
          holidaySetByEnterprise,
          emp.enterprise_id,
          includeNonWorkedHolidays
        )

        const row = [
          emp.matricule || '',
          emp.last_name || '',
          emp.first_name || '',
          emp.position || '',
          emp.department || '',
          stats.joursPresent,
          formatMinutesToHM(stats.totalMinutes),
          formatMinutesToHM(stats.moyenneMinutes),
        ]

        if (includeRetards) {
          row.push(stats.hasPlanningRetards ? stats.retardsCount : 'N/A')
          row.push(stats.hasPlanningRetards ? formatMinutesToHM(stats.retardsMinutes) : 'N/A')
          row.push(stats.hasPlanningRetards ? 'Oui' : 'Non (non évalué)')
        }

        if (includeHeuresSup) {
          row.push(formatMinutesToHM(stats.heuresSupMinutes))
          row.push(formatMinutesToHM(stats.heuresSupMajorees))
          row.push(formatMinutesToHM(stats.totalHeuresSupMinutes))
        }

        if (includeHolidays) {
          row.push(stats.workedHolidaysCount)
          row.push(formatMinutesToHM(stats.workedHolidaysMinutes))
        }

        if (includeAbsences || includeConges) {
          row.push(absStats.conges)
          row.push(absStats.maladie)
          row.push(absStats.autre)
        }

        return row
      })

      const holidayRows = includeHolidays
        ? (holidays || [])
            .filter(h => {
              if (!includeWorkedHolidays && h.is_worked) return false
              if (!includeNonWorkedHolidays && !h.is_worked) return false
              return true
            })
            .map(h => [
              formatDateFr(h.date),
              h.name || '',
              selectedEntrepriseId === 'all'
                ? (entreprises.find(e => e.id === h.enterprise_id)?.name || '')
                : selectedEnterpriseName,
              h.is_worked ? 'Travaille' : 'Non travaille',
              `${h.overtime_rate ?? 100}%`
            ])
        : []

      const csvContent = [
        `Rapport En-Check - ${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)}`,
        includeRetards ? 'Note: Les employés sans planning (N/A) ne sont pas évalués pour les retards.' : '',
        includeHolidays ? `Jours fériés inclus: ${includeWorkedHolidays ? 'Travaillés ' : ''}${includeNonWorkedHolidays ? 'Non travaillés' : ''}` : '',
        '',
        headers.join(';'),
        ...rows.map(row => row.join(';')),
        ...(includeHolidays && holidayRows.length > 0 ? ['', 'DETAIL JOURS FERIES', 'Date;Nom;Entreprise;Type;Taux', ...holidayRows.map(r => r.join(';'))] : [])
      ].filter(line => line !== null).join('\n')

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)

      let enterpriseName = 'Rapport'
      if (selectedEntrepriseId !== 'all') {
        if (admin.role === 'super_admin') {
          enterpriseName = entreprises.find(e => e.id === selectedEntrepriseId)?.name || 'Entreprise'
        } else {
          enterpriseName = admin.selectedEnterprise?.name || 'MonEntreprise'
        }
      }

      link.download = `Rapport_${enterpriseName}_${dateDebut}_${dateFin}.csv`
      link.click()

      toast.success('Excel généré avec succès !')
    } catch (error) {
      console.error('Erreur génération Excel:', error)
      toast.error('Erreur lors de la génération du fichier Excel')
    }

    setLoading(false)
  }

  const selectedEnterpriseName = useMemo(() => {
    if (admin?.role === 'super_admin') {
      return selectedEntrepriseId === 'all'
        ? 'Toutes les entreprises'
        : entreprises.find(e => e.id === selectedEntrepriseId)?.name || 'Entreprise'
    }
    return admin?.selectedEnterprise?.name || 'Mon entreprise'
  }, [admin, selectedEntrepriseId, entreprises])

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .afro-btn { transition: all 0.3s ease !important; }
        .afro-btn:hover:not(:disabled) { transform: translateY(-2px) !important; box-shadow: 0 8px 25px rgba(0,0,0,0.3) !important; }
        .afro-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .afro-card { animation: fadeInUp 0.5s ease forwards; }
        .option-toggle { transition: all 0.2s ease; cursor: pointer; }
        .option-toggle:hover { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.15) !important; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 4px; }
        select option { background: #141423; color: #E5E5E5; }
      `}</style>

      <div style={S.container}>
        <div style={S.bgPattern}></div>

        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={S.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={S.logoContainer}>
                <BarChart3 size={24} color="#F59E0B" />
              </div>
              <div>
                <h1 style={S.headerTitle}>RAPPORTS</h1>
                <span style={S.headerSubtitle}>Exports & Statistiques</span>
              </div>
            </div>
          </div>
        </header>

        <main style={S.main}>
          <div className="afro-card" style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap}>
                <FileText size={24} color="#F59E0B" />
              </div>
              <div>
                <h2 style={S.cardTitle}>Générer un Rapport</h2>
                <p style={S.cardSubtitle}>Configurez et exportez vos données</p>
              </div>
            </div>

            <div style={S.section}>
              <label style={S.label}><Calendar size={16} /> Période</label>
              <div style={S.dateRow}>
                <div style={S.dateGroup}>
                  <span style={S.dateLabel}>Du</span>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={S.dateInput} />
                </div>
                <div style={S.dateGroup}>
                  <span style={S.dateLabel}>Au</span>
                  <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={S.dateInput} />
                </div>
              </div>
            </div>

            {admin?.role === 'super_admin' && (
              <div style={S.section}>
                <label style={S.label}><Building2 size={16} /> Entreprise</label>
                <select value={selectedEntrepriseId} onChange={e => setSelectedEntrepriseId(e.target.value)} style={S.select}>
                  <option value="all">Toutes les entreprises</option>
                  {entreprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
            )}

            <div style={S.section}>
              <label style={S.label}><Settings size={16} /> Contenu du rapport</label>
              <div style={S.optionsGrid}>
                <label className="option-toggle" style={{
                  ...S.optionCard,
                  borderColor: includeRetards ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)',
                  background: includeRetards ? 'rgba(239,68,68,0.08)' : 'transparent',
                }}>
                  <input type="checkbox" checked={includeRetards} onChange={e => setIncludeRetards(e.target.checked)} style={{ display: 'none' }} />
                  <div style={{ ...S.optionIcon, background: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle size={20} color="#EF4444" />
                  </div>
                  <div style={S.optionContent}>
                    <span style={{ ...S.optionTitle, color: includeRetards ? '#EF4444' : '#888' }}>Retards</span>
                    <span style={S.optionDesc}>Employés avec planning uniquement</span>
                  </div>
                  <div style={{ ...S.optionCheck, background: includeRetards ? '#EF4444' : 'rgba(255,255,255,0.06)' }}>
                    {includeRetards && <CheckCircle size={14} color="#FFF" />}
                  </div>
                </label>

                <label className="option-toggle" style={{
                  ...S.optionCard,
                  borderColor: includeHeuresSup ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)',
                  background: includeHeuresSup ? 'rgba(245,158,11,0.08)' : 'transparent',
                  opacity: hasHeuresSupFeature ? 1 : 0.5,
                  pointerEvents: hasHeuresSupFeature ? 'auto' : 'none',
                }}>
                  <input type="checkbox" checked={includeHeuresSup} onChange={e => setIncludeHeuresSup(e.target.checked)} disabled={!hasHeuresSupFeature} style={{ display: 'none' }} />
                  <div style={{ ...S.optionIcon, background: 'rgba(245,158,11,0.15)' }}>
                    <Timer size={20} color="#F59E0B" />
                  </div>
                  <div style={S.optionContent}>
                    <span style={{ ...S.optionTitle, color: includeHeuresSup ? '#F59E0B' : '#888' }}>Heures Sup</span>
                    <span style={S.optionDesc}>{hasHeuresSupFeature ? 'Dépassements horaires' : 'Module non activé'}</span>
                  </div>
                  <div style={{ ...S.optionCheck, background: includeHeuresSup ? '#F59E0B' : 'rgba(255,255,255,0.06)' }}>
                    {includeHeuresSup && <CheckCircle size={14} color="#FFF" />}
                  </div>
                </label>

                <label className="option-toggle" style={{
                  ...S.optionCard,
                  borderColor: includeConges ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)',
                  background: includeConges ? 'rgba(16,185,129,0.08)' : 'transparent',
                  opacity: hasAbsencesFeature ? 1 : 0.5,
                  pointerEvents: hasAbsencesFeature ? 'auto' : 'none',
                }}>
                  <input type="checkbox" checked={includeConges} onChange={e => setIncludeConges(e.target.checked)} disabled={!hasAbsencesFeature} style={{ display: 'none' }} />
                  <div style={{ ...S.optionIcon, background: 'rgba(16,185,129,0.15)' }}>
                    <CalendarDays size={20} color="#10B981" />
                  </div>
                  <div style={S.optionContent}>
                    <span style={{ ...S.optionTitle, color: includeConges ? '#10B981' : '#888' }}>Congés</span>
                    <span style={S.optionDesc}>{hasAbsencesFeature ? 'Congés approuvés' : 'Module non activé'}</span>
                  </div>
                  <div style={{ ...S.optionCheck, background: includeConges ? '#10B981' : 'rgba(255,255,255,0.06)' }}>
                    {includeConges && <CheckCircle size={14} color="#FFF" />}
                  </div>
                </label>

                <label className="option-toggle" style={{
                  ...S.optionCard,
                  borderColor: includeAbsences ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)',
                  background: includeAbsences ? 'rgba(99,102,241,0.08)' : 'transparent',
                  opacity: hasAbsencesFeature ? 1 : 0.5,
                  pointerEvents: hasAbsencesFeature ? 'auto' : 'none',
                }}>
                  <input type="checkbox" checked={includeAbsences} onChange={e => setIncludeAbsences(e.target.checked)} disabled={!hasAbsencesFeature} style={{ display: 'none' }} />
                  <div style={{ ...S.optionIcon, background: 'rgba(99,102,241,0.15)' }}>
                    <CalendarOff size={20} color="#6366F1" />
                  </div>
                  <div style={S.optionContent}>
                    <span style={{ ...S.optionTitle, color: includeAbsences ? '#6366F1' : '#888' }}>Absences</span>
                    <span style={S.optionDesc}>{hasAbsencesFeature ? 'Maladie, autres...' : 'Module non activé'}</span>
                  </div>
                  <div style={{ ...S.optionCheck, background: includeAbsences ? '#6366F1' : 'rgba(255,255,255,0.06)' }}>
                    {includeAbsences && <CheckCircle size={14} color="#FFF" />}
                  </div>
                </label>

                <label className="option-toggle" style={{
                  ...S.optionCard,
                  borderColor: includeHolidays ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)',
                  background: includeHolidays ? 'rgba(139,92,246,0.08)' : 'transparent',
                }}>
                  <input type="checkbox" checked={includeHolidays} onChange={e => setIncludeHolidays(e.target.checked)} style={{ display: 'none' }} />
                  <div style={{ ...S.optionIcon, background: 'rgba(139,92,246,0.15)' }}>
                    <Calendar size={20} color="#8B5CF6" />
                  </div>
                  <div style={S.optionContent}>
                    <span style={{ ...S.optionTitle, color: includeHolidays ? '#8B5CF6' : '#888' }}>Jours fériés</span>
                    <span style={S.optionDesc}>Travaillés ou non travaillés</span>
                  </div>
                  <div style={{ ...S.optionCheck, background: includeHolidays ? '#8B5CF6' : 'rgba(255,255,255,0.06)' }}>
                    {includeHolidays && <CheckCircle size={14} color="#FFF" />}
                  </div>
                </label>
              </div>

              {includeHolidays && (
                <div style={{
                  marginTop: 14,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 10,
                }}>
                  <label className="option-toggle" style={{
                    ...S.optionCard,
                    borderColor: includeWorkedHolidays ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)',
                    background: includeWorkedHolidays ? 'rgba(245,158,11,0.08)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={includeWorkedHolidays} onChange={e => setIncludeWorkedHolidays(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ ...S.optionIcon, background: 'rgba(245,158,11,0.15)' }}>
                      <Timer size={18} color="#F59E0B" />
                    </div>
                    <div style={S.optionContent}>
                      <span style={{ ...S.optionTitle, color: includeWorkedHolidays ? '#F59E0B' : '#888' }}>Fériés travaillés</span>
                      <span style={S.optionDesc}>Inclure les jours fériés avec pointage</span>
                    </div>
                    <div style={{ ...S.optionCheck, background: includeWorkedHolidays ? '#F59E0B' : 'rgba(255,255,255,0.06)' }}>
                      {includeWorkedHolidays && <CheckCircle size={14} color="#FFF" />}
                    </div>
                  </label>

                  <label className="option-toggle" style={{
                    ...S.optionCard,
                    borderColor: includeNonWorkedHolidays ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)',
                    background: includeNonWorkedHolidays ? 'rgba(99,102,241,0.08)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={includeNonWorkedHolidays} onChange={e => setIncludeNonWorkedHolidays(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ ...S.optionIcon, background: 'rgba(99,102,241,0.15)' }}>
                      <CalendarOff size={18} color="#6366F1" />
                    </div>
                    <div style={S.optionContent}>
                      <span style={{ ...S.optionTitle, color: includeNonWorkedHolidays ? '#6366F1' : '#888' }}>Fériés non travaillés</span>
                      <span style={S.optionDesc}>Inclure les jours fériés sans pointage</span>
                    </div>
                    <div style={{ ...S.optionCheck, background: includeNonWorkedHolidays ? '#6366F1' : 'rgba(255,255,255,0.06)' }}>
                      {includeNonWorkedHolidays && <CheckCircle size={14} color="#FFF" />}
                    </div>
                  </label>
                </div>
              )}

              {includeRetards && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  marginTop: '12px', padding: '12px 14px',
                  background: 'rgba(107,114,128,0.08)',
                  border: '1px solid rgba(107,114,128,0.15)',
                  borderRadius: '10px',
                }}>
                  <AlertTriangle size={14} color="#9CA3AF" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                    Les retards ne sont calculés que pour les employés ayant un planning défini (individuel ou entreprise par défaut). Les autres apparaissent avec <strong>N/A</strong>.
                  </p>
                </div>
              )}
            </div>

            <div style={S.previewSection}>
              <div style={S.previewHeader}>
                <h3 style={S.previewTitle}><Eye size={16} color="#F59E0B" /> Aperçu du rapport</h3>
                <button onClick={loadPreview} disabled={loadingPreview} style={S.previewBtn}>
                  <RefreshCw size={14} style={loadingPreview ? { animation: 'spin 1s linear infinite' } : {}} />
                  {loadingPreview ? 'Chargement...' : 'Actualiser'}
                </button>
              </div>

              <div style={S.previewContent}>
                <div style={S.previewItem}>
                  <Calendar size={14} color="#F59E0B" />
                  <span>{formatDateFr(dateDebut)} — {formatDateFr(dateFin)}</span>
                </div>
                <div style={S.previewItem}>
                  <Clock size={14} color="#F59E0B" />
                  <span>{calculateWorkingDays(dateDebut, dateFin)} jours ouvrés</span>
                </div>
                <div style={S.previewItem}>
                  <Building2 size={14} color="#F59E0B" />
                  <span>{selectedEnterpriseName}</span>
                </div>

                <div style={S.previewTags}>
                  {includeRetards && <span style={{ ...S.previewTag, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}><AlertTriangle size={10} /> Retards</span>}
                  {includeHeuresSup && <span style={{ ...S.previewTag, background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}><Timer size={10} /> H.Sup</span>}
                  {includeConges && <span style={{ ...S.previewTag, background: 'rgba(16,185,129,0.15)', color: '#10B981' }}><CalendarDays size={10} /> Congés</span>}
                  {includeAbsences && <span style={{ ...S.previewTag, background: 'rgba(99,102,241,0.15)', color: '#6366F1' }}><CalendarOff size={10} /> Absences</span>}
                  {includeHolidays && <span style={{ ...S.previewTag, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}><Calendar size={10} /> Fériés</span>}
                </div>

                {previewData && (
                  <>
                    <div style={S.previewStats}>
                      <div style={S.previewStatItem}>
                        <span style={S.previewStatValue}>{previewData.totalEmployees}</span>
                        <span style={S.previewStatLabel}>Employés</span>
                      </div>
                      <div style={S.previewStatItem}>
                        <span style={S.previewStatValue}>{formatMinutesToHM(previewData.totalHeuresTravaillees)}</span>
                        <span style={S.previewStatLabel}>Travaillé</span>
                      </div>
                      {includeRetards && (
                        <div style={S.previewStatItem}>
                          <span style={{ ...S.previewStatValue, color: '#EF4444' }}>{previewData.totalRetards}</span>
                          <span style={S.previewStatLabel}>Retards</span>
                        </div>
                      )}
                      {includeHeuresSup && previewData.totalHeuresSup > 0 && (
                        <div style={S.previewStatItem}>
                          <span style={{ ...S.previewStatValue, color: '#F59E0B' }}>{formatMinutesToHM(previewData.totalHeuresSup)}</span>
                          <span style={S.previewStatLabel}>H.Sup</span>
                        </div>
                      )}
                      {includeHolidays && (
                        <div style={S.previewStatItem}>
                          <span style={{ ...S.previewStatValue, color: '#8B5CF6' }}>{previewData.totalHolidayDays}</span>
                          <span style={S.previewStatLabel}>Fériés</span>
                        </div>
                      )}
                    </div>

                    {includeHolidays && previewData.totalWorkedHolidays > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginTop: '8px', padding: '10px 12px',
                        background: 'rgba(139,92,246,0.08)',
                        border: '1px solid rgba(139,92,246,0.15)',
                        borderRadius: '8px',
                      }}>
                        <Calendar size={13} color="#8B5CF6" />
                        <span style={{ color: '#C4B5FD', fontSize: '12px' }}>
                          {previewData.totalWorkedHolidays} jour{previewData.totalWorkedHolidays > 1 ? 's' : ''} férié{previewData.totalWorkedHolidays > 1 ? 's' : ''} travaillé{previewData.totalWorkedHolidays > 1 ? 's' : ''} • {formatMinutesToHM(previewData.totalWorkedHolidaysMinutes)}
                        </span>
                      </div>
                    )}

                    {previewData.employesSansPlanningRetards > 0 && includeRetards && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginTop: '8px', padding: '10px 12px',
                        background: 'rgba(107,114,128,0.08)',
                        border: '1px solid rgba(107,114,128,0.15)',
                        borderRadius: '8px',
                      }}>
                        <Users size={13} color="#9CA3AF" />
                        <span style={{ color: '#9CA3AF', fontSize: '12px' }}>
                          {previewData.employesSansPlanningRetards} employé{previewData.employesSansPlanningRetards > 1 ? 's' : ''} sans planning — retards non évalués
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div style={S.downloadButtons}>
              <button className="afro-btn" onClick={generatePDF} style={S.pdfBtn} disabled={loading}>
                {loading
                  ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Download size={18} />
                }
                {loading ? 'Génération...' : 'Télécharger PDF'}
              </button>
              <button className="afro-btn" onClick={generateGraphicalPDF} style={S.graphicalBtn} disabled={loading}>
                {loading
                  ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : <TrendingUp size={18} />
                }
                {loading ? 'Génération...' : 'PDF Graphique'}
              </button>
              <button className="afro-btn" onClick={generateExcel} style={S.excelBtn} disabled={loading}>
                {loading
                  ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : <FileSpreadsheet size={18} />
                }
                {loading ? 'Génération...' : 'Télécharger Excel'}
              </button>
            </div>
          </div>

          <div className="afro-card" style={{ ...S.infoCard, animationDelay: '0.1s' }}>
            <h3 style={S.infoTitle}><Sparkles size={18} color="#F59E0B" /> Ce que contient votre rapport</h3>
            <div style={S.infoGrid}>
              <div style={S.infoItem}><CheckCircle size={16} color="#10B981" /><span>Résumé de la période</span></div>
              <div style={S.infoItem}><CheckCircle size={16} color="#10B981" /><span>Liste des employés</span></div>
              <div style={S.infoItem}><CheckCircle size={16} color="#10B981" /><span>Jours de présence</span></div>
              <div style={S.infoItem}><CheckCircle size={16} color="#10B981" /><span>Heures travaillées</span></div>
              <div style={S.infoItem}><CheckCircle size={16} color="#10B981" /><span>Moyenne par jour</span></div>
              {includeRetards && <div style={{ ...S.infoItem, color: '#EF4444' }}><AlertTriangle size={16} /><span>Retards (planning requis)</span></div>}
              {includeHeuresSup && <div style={{ ...S.infoItem, color: '#F59E0B' }}><Timer size={16} /><span>Heures supplémentaires</span></div>}
              {includeConges && <div style={{ ...S.infoItem, color: '#10B981' }}><CalendarDays size={16} /><span>Détail des congés</span></div>}
              {includeAbsences && <div style={{ ...S.infoItem, color: '#6366F1' }}><CalendarOff size={16} /><span>Registre absences</span></div>}
              {includeHolidays && <div style={{ ...S.infoItem, color: '#8B5CF6' }}><Calendar size={16} /><span>Jours fériés travaillés ou non</span></div>}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const S = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)`, pointerEvents: 'none', zIndex: 0 },
  header: { background: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(245, 158, 11, 0.15)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: '900px', margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  logoContainer: { width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700', letterSpacing: '2px', margin: 0 },
  headerSubtitle: { color: '#F59E0B', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500' },
  main: { padding: '24px 20px 60px', maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1 },
  card: { background: 'rgba(20, 20, 35, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px', marginBottom: '20px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  cardIconWrap: { width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '700', margin: 0 },
  cardSubtitle: { color: '#888', fontSize: '13px', margin: '4px 0 0 0' },
  section: { marginBottom: '24px' },
  label: { display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontWeight: '600', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  dateRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  dateGroup: { flex: 1, minWidth: '140px' },
  dateLabel: { display: 'block', fontSize: '11px', color: '#666', marginBottom: '6px' },
  dateInput: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  select: { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'inherit' },
  optionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' },
  optionCard: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '14px', border: '1px solid', transition: 'all 0.2s ease' },
  optionIcon: { width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionContent: { flex: 1, minWidth: 0 },
  optionTitle: { display: 'block', fontSize: '14px', fontWeight: '600' },
  optionDesc: { display: 'block', fontSize: '11px', color: '#666', marginTop: '2px' },
  optionCheck: { width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  previewSection: { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: '16px', padding: '18px', marginBottom: '24px' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  previewTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', margin: 0 },
  previewBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#888', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' },
  previewContent: { display: 'flex', flexDirection: 'column', gap: '10px' },
  previewItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#CCC' },
  previewTags: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' },
  previewTag: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  previewStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  previewStatItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' },
  previewStatValue: { fontSize: '20px', fontWeight: '800', color: '#FFF', fontFamily: "'SF Mono', 'Fira Code', monospace" },
  previewStatLabel: { fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' },
  downloadButtons: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  pdfBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', minWidth: '140px', fontFamily: 'inherit' },
  graphicalBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', color: '#FFFFFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', minWidth: '140px', fontFamily: 'inherit' },
  excelBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', minWidth: '140px', fontFamily: 'inherit' },
  infoCard: { background: 'rgba(20, 20, 35, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' },
  infoTitle: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '700', color: '#FFFFFF', marginBottom: '16px' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  infoItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#CCC' },
}