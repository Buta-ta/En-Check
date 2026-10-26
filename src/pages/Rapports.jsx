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
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import { NsibidiBlasonSvg } from '../components/NsibidiSvg'
import { useTheme } from '../contexts/ThemeContext'
import {
  DOC,
  MARGES,
  dessinerEntete,
  dessinerResume,
  dessinerTitreSection,
  stylesTableau,
  ajouterPageDetail,
  ajouterJournalPointages,
  construireJournalPointages,
  numeroterPages,
  colonnesProportionnelles,
  largeurUtile,
  dessinerBlason,
} from '../utils/documentsRapports'
import './Rapports.css'
import {
  ArrowLeft, Calendar, Building2, FileText, Download,
  FileSpreadsheet, Users, Clock, CheckCircle, AlertTriangle,
  Timer, CalendarOff, Sparkles, Eye, RefreshCw, CalendarDays,
  TrendingUp, Sun, Moon, MapPin
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
    return '#B4622A' // la terre de la page, par défaut
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

    // Fond de papier, pas de blanc d'écran
    ctx.fillStyle = '#FBF7EC'
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
  ctx.strokeStyle = '#3B4A55'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()

  // Grille horizontale
  ctx.strokeStyle = '#E6DCC8'
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
    const baseColor = data.colors?.[index] || '#B4622A'
    
    // Gradient
    const gradient = ctx.createLinearGradient(x, y, x, height - padding)
    gradient.addColorStop(0, baseColor)
    
    // Couleur plus foncée pour le bas
    const darkerColor = adjustColor(baseColor, -30)
    gradient.addColorStop(1, darkerColor)
    
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, barWidth, barHeight)

    // Bordure
    ctx.strokeStyle = '#3B4A55'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, barWidth, barHeight)

    // Valeur au-dessus
    ctx.fillStyle = '#16222C'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(value.toString(), x + barWidth / 2, y - 5)

    // Label
    ctx.save()
    ctx.translate(x + barWidth / 2, height - padding + 15)
    ctx.rotate(-Math.PI / 6)
    ctx.font = '10px Arial'
    ctx.fillStyle = '#55636E'
    ctx.textAlign = 'right'
    const label = data.labels[index].length > 15 ? data.labels[index].substring(0, 12) + '...' : data.labels[index]
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })

  // Titre
  ctx.font = 'bold 16px Arial'
  ctx.fillStyle = '#16222C'
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
    ctx.fillStyle = '#55636E'
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
    ctx.strokeStyle = '#FBF7EC'
    ctx.lineWidth = 3
    ctx.stroke()

    // Label et pourcentage
    if (value > 0) {
      const labelAngle = currentAngle + sliceAngle / 2
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.6)
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.6)
      
      const percentage = ((value / total) * 100).toFixed(1)
      ctx.fillStyle = '#FBF7EC'
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
      ctx.strokeStyle = '#3B4A55'
      ctx.lineWidth = 1
      ctx.strokeRect(legendX, legendY, 18, 18)
      
      // Texte
      ctx.fillStyle = '#16222C'
      ctx.font = '11px Arial'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${label}: ${data.values[index]}`, legendX + 25, legendY + 9)
      
      legendY += 25
    }
  })

  // Titre
  ctx.font = 'bold 16px Arial'
  ctx.fillStyle = '#16222C'
  ctx.textAlign = 'center'
  ctx.fillText(data.title || '', width / 2, 25)
}

const drawLineChart = (ctx, data, width, height) => {
  const padding = 60
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const maxValue = Math.max(...data.values, 1)
  
  // Axes
  ctx.strokeStyle = '#3B4A55'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()

  // Grille horizontale
  ctx.strokeStyle = '#E6DCC8'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
    
    // Valeur
    ctx.fillStyle = '#55636E'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(Math.round(maxValue * (1 - i / 5)).toString(), padding - 10, y + 4)
  }

  // Ligne
  ctx.strokeStyle = '#8B3E1D'
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
    ctx.fillStyle = '#8B3E1D'
    ctx.fill()
    ctx.strokeStyle = '#FBF7EC'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // Label
    if (data.labels[index]) {
      ctx.save()
      ctx.translate(x, height - padding + 15)
      ctx.rotate(-Math.PI / 6)
      ctx.font = '9px Arial'
      ctx.fillStyle = '#55636E'
      ctx.textAlign = 'right'
      ctx.fillText(data.labels[index], 0, 0)
      ctx.restore()
    }
  })

  // Titre
  ctx.font = 'bold 16px Arial'
  ctx.fillStyle = '#16222C'
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

  const [includePointages, setIncludePointages] = useState(false)

  const [includeHolidays, setIncludeHolidays] = useState(false)
  const [includeWorkedHolidays, setIncludeWorkedHolidays] = useState(true)
  const [includeNonWorkedHolidays, setIncludeNonWorkedHolidays] = useState(true)

  const [hasHeuresSupFeature, setHasHeuresSupFeature] = useState(false)
  const [hasAbsencesFeature, setHasAbsencesFeature] = useState(false)

  const [previewData, setPreviewData] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const navigate = useNavigate()
  // Le même thème que le reste de l'application : le choix suit l'admin
  // d'une page à l'autre et se retient d'une visite à l'autre.
  const { darkMode, toggleTheme } = useTheme()

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

      // Le journal nomme les zones : on charge leurs noms seulement s'il est demandé.
      const geofencesById = {}
      if (includePointages) {
        let geofencesQuery = supabase.from('geofences').select('id, name')
        if (targetEnterpriseId !== 'all') {
          geofencesQuery = geofencesQuery.eq('enterprise_id', targetEnterpriseId)
        }
        const { data: zones } = await geofencesQuery
        ;(zones || []).forEach(z => { geofencesById[z.id] = z.name })
      }

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
        geofencesById,
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
        geofencesById: {},
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
    const empAttendances = filtrerPointagesPayables(allAttendances || [])
      .filter(a => a.employee_id === employeeId)
      //  Même doctrine que la paie (§4.1) : une sortie estimée et non validée par
      //  un humain ne doit pas gonfler un rapport, un graphique, ni un cumul.
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
        totalPointages: includePointages ? data.attendances.length : 0,
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
        holidayMapByEnterprise,
        geofencesById
      } = await fetchReportData()

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const periodeLongue = `${formatDateLong(dateDebut)} — ${formatDateLong(dateFin)}`

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

      // Une page neuve reprend la bande gravée, en plus court.
      const nouvellePage = () => {
        doc.addPage()
        return dessinerEntete(doc, {
          titre: 'Rapport graphique',
          sousTitre: 'En-Check · les registres de craie',
          periode: periodeLongue,
          entreprise: selectedEnterpriseName,
          complement: 'Suite des graphiques',
        })
      }

      let yPos = dessinerEntete(doc, {
        titre: 'Rapport graphique',
        sousTitre: 'En-Check · les registres de craie',
        periode: periodeLongue,
        entreprise: selectedEnterpriseName,
        complement: 'Lecture visuelle de la période',
      })

      const hauteurImage = 84

      const poserGraphique = async (titre, chartData, type, accent) => {
        const image = await createChartImage(chartData, type)
        if (yPos + hauteurImage + 18 > 272) yPos = nouvellePage()
        yPos = dessinerTitreSection(doc, titre, yPos, accent)
        doc.addImage(image, 'PNG', MARGES.gauche, yPos, pageWidth - MARGES.gauche - MARGES.droite, hauteurImage)
        yPos += hauteurImage + 10
      }

      // ═══ GRAPHIQUE 1 : TOP 10 EMPLOYÉS PAR HEURES TRAVAILLÉES ═══
      const topEmployees = [...employeesData]
        .sort((a, b) => b.stats.totalMinutes - a.stats.totalMinutes)
        .slice(0, 10)

      if (topEmployees.length > 0) {
        const teintes = ['#8B3E1D', '#A8551F', '#B4622A', '#C9773C', '#96603A', '#7A4A26', '#B8783F', '#8E5A2E', '#C08A52', '#6F4423']

        await poserGraphique(
          'Top 10 des employés par heures travaillées',
          {
            title: 'Heures travaillées sur la période',
            labels: topEmployees.map(e => `${e.emp.first_name} ${e.emp.last_name.charAt(0)}.`),
            values: topEmployees.map(e => Math.round(e.stats.totalMinutes / 60)),
            colors: topEmployees.map((_, i) => teintes[i % teintes.length]),
          },
          'bar',
          DOC.terre
        )
      }

      // ═══ GRAPHIQUE 2 : RÉPARTITION PRÉSENCE ═══
      if (includeRetards || includeAbsences || includeConges) {
        const totalDaysPresent = employeesData.reduce((sum, e) => sum + e.stats.joursPresent, 0)
        const totalAbsences = employeesData.reduce((sum, e) => sum + e.absStats.total, 0)
        const totalRetards = employeesData.reduce((sum, e) => sum + e.stats.retardsCount, 0)

        if (totalDaysPresent > 0 || totalAbsences > 0 || totalRetards > 0) {
          await poserGraphique(
            'Présence, absences et retards',
            {
              title: 'Répartition globale',
              labels: ['Jours présent', 'Absences', 'Retards'],
              values: [totalDaysPresent, totalAbsences, totalRetards],
              colors: ['#0B5F43', '#B91C1C', '#8A5506'],
            },
            'pie',
            DOC.vert
          )
        }
      }

      // ═══ GRAPHIQUE 3 : HEURES SUP PAR EMPLOYÉ ═══
      if (includeHeuresSup) {
        const empWithOvertime = employeesData.filter(e => e.stats.totalHeuresSupMinutes > 0)

        if (empWithOvertime.length > 0) {
          const topOvertime = [...empWithOvertime]
            .sort((a, b) => b.stats.totalHeuresSupMinutes - a.stats.totalHeuresSupMinutes)
            .slice(0, 10)

          await poserGraphique(
            'Heures supplémentaires par employé',
            {
              title: 'Top 10 des heures supplémentaires',
              labels: topOvertime.map(e => `${e.emp.first_name} ${e.emp.last_name.charAt(0)}.`),
              values: topOvertime.map(e => Math.round(e.stats.totalHeuresSupMinutes / 60)),
              colors: topOvertime.map(() => '#8A5506'),
            },
            'bar',
            DOC.ambre
          )
        }
      }

      // ═══ GRAPHIQUE 4 : ABSENCES PAR TYPE ═══
      if (includeAbsences || includeConges) {
        const totalConges = employeesData.reduce((sum, e) => sum + e.absStats.conges, 0)
        const totalMaladie = employeesData.reduce((sum, e) => sum + e.absStats.maladie, 0)
        const totalAutre = employeesData.reduce((sum, e) => sum + e.absStats.autre, 0)

        if (totalConges + totalMaladie + totalAutre > 0) {
          await poserGraphique(
            'Absences par motif',
            {
              title: 'Répartition des absences',
              labels: ['Congés', 'Maladie', 'Autre'],
              values: [totalConges, totalMaladie, totalAutre],
              colors: ['#0B5F43', '#4338CA', '#6D28D9'],
            },
            'pie',
            DOC.indigoTexte
          )
        }
      }

      // ═══ GRAPHIQUE 5 : ÉVOLUTION DES HEURES PAR SEMAINE ═══
      const weeklyHours = {}

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
        await poserGraphique(
          'Évolution hebdomadaire',
          {
            title: 'Heures travaillées, semaine par semaine',
            labels: sortedWeeks.map(w => `S${w}`),
            values: sortedWeeks.map(w => Math.round(weeklyHours[w] / 60)),
          },
          'line',
          DOC.brun
        )
      }

      // ═══ LE JOURNAL DES POINTAGES, SI ON L'A DEMANDÉ ═══
      if (includePointages) {
        const journal = construireJournalPointages({ attendances, employees, geofencesById })
        ajouterJournalPointages(doc, {
          lignes: journal,
          periode: periodeLongue,
          entreprise: selectedEnterpriseName,
        })
      }

      numeroterPages(doc, {
        titre: 'Rapport graphique',
        entreprise: selectedEnterpriseName,
        periode: periodeLongue,
      })

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
        holidayMapByEnterprise,
        geofencesById
      } = await fetchReportData()

      const doc = new jsPDF()
      const periodeLongue = `${formatDateLong(dateDebut)} — ${formatDateLong(dateFin)}`

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

      const journal = includePointages
        ? construireJournalPointages({ attendances, employees, geofencesById })
        : []

      // ═══ LA TÊTE ═══
      let yPos = dessinerEntete(doc, {
        titre: 'Rapport de pointage',
        sousTitre: 'En-Check · les registres de craie',
        periode: periodeLongue,
        entreprise: selectedEnterpriseName,
        complement: `Édité le ${new Date().toLocaleDateString('fr-FR')}${includePointages ? ' · journal des pointages inclus' : ''}`,
      })

      // ═══ LE RÉSUMÉ ═══
      const resume = [
        { label: 'Employés', valeur: totalEmployes },
        { label: 'Jours ouvrés', valeur: joursOuvres },
        { label: 'Total travaillé', valeur: formatMinutesToHM(totalHeuresTravail) },
      ]

      if (includeRetards) {
        resume.push({ label: 'Retards', valeur: totalRetards, accent: DOC.rouge })
        resume.push({ label: 'Temps perdu', valeur: formatMinutesToHM(totalMinutesRetard), accent: DOC.rouge })
      }

      if (includeHeuresSup && totalHeuresSup > 0) {
        resume.push({ label: 'Heures sup', valeur: formatMinutesToHM(totalHeuresSup), accent: DOC.ambre })
      }

      if ((includeAbsences || includeConges) && totalAbsencesDays > 0) {
        resume.push({ label: 'Jours d’absence', valeur: totalAbsencesDays, accent: DOC.indigoTexte })
      }

      if (includeHolidays) {
        resume.push({ label: 'Jours fériés', valeur: filteredHolidayRows.length, accent: DOC.violet })
        resume.push({ label: 'Fériés travaillés', valeur: totalWorkedHolidays, accent: DOC.violet })
      }

      if (includePointages) {
        resume.push({ label: 'Pointages', valeur: journal.length, accent: DOC.terre })
      }

      yPos = dessinerResume(doc, { y: yPos, entrees: resume, titre: 'Résumé de la période' })

      if (nbSansPlanningRetards > 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7.2)
        doc.setTextColor(...DOC.encreDouce)
        doc.text(
          `Note : ${nbSansPlanningRetards} employé(s) sans planning — retards non évalués.`,
          MARGES.gauche + 1,
          yPos
        )
        yPos += 6
      }

      // ═══ LE REGISTRE DES EMPLOYÉS ═══
      yPos = dessinerTitreSection(doc, 'Registre des employés', yPos, DOC.terre)

      const tableHeaders = ['Matricule', 'Nom complet', 'Poste', 'Jours', 'Heures', 'Moy/J']
      const poidsColonnes = [1.2, 2.45, 1.62, 0.86, 1.02, 0.92]
      const alignements = ['center', 'left', 'left', 'center', 'center', 'center']

      if (includeRetards) {
        tableHeaders.push('Retards', 'Tps perdu')
        poidsColonnes.push(0.96, 1.05)
        alignements.push('center', 'center')
      }

      if (includeHeuresSup) {
        tableHeaders.push('H. sup')
        poidsColonnes.push(0.9)
        alignements.push('center')
      }

      if (includeHolidays) {
        tableHeaders.push('Fériés')
        poidsColonnes.push(0.86)
        alignements.push('center')
      }

      if (includeAbsences || includeConges) {
        tableHeaders.push('Absences')
        poidsColonnes.push(1.12)
        alignements.push('center')
      }

      const columnStyles = colonnesProportionnelles(poidsColonnes, {
        largeur: largeurUtile(doc),
        halign: alignements,
      })

      const tableData = employeesData.map(({ emp, stats, absStats }) => {
        const row = [
          emp.matricule || '—',
          `${emp.first_name} ${emp.last_name}`,
          emp.position || '—',
          stats.joursPresent.toString(),
          formatMinutesToHM(stats.totalMinutes),
          formatMinutesToHM(stats.moyenneMinutes),
        ]

        if (includeRetards) {
          row.push(stats.hasPlanningRetards ? stats.retardsCount.toString() : '—')
          row.push(stats.hasPlanningRetards ? formatMinutesToHM(stats.retardsMinutes) : '—')
        }

        if (includeHeuresSup) {
          row.push(stats.totalHeuresSupMinutes > 0 ? formatMinutesToHM(stats.totalHeuresSupMinutes) : '—')
        }

        if (includeHolidays) {
          row.push(stats.workedHolidaysCount > 0 ? `${stats.workedHolidaysCount}` : '—')
        }

        if (includeAbsences || includeConges) {
          row.push(absStats.total > 0 ? `${absStats.total}j` : '—')
        }

        return row
      })

      autoTable(doc, {
        startY: yPos,
        head: [tableHeaders],
        body: tableData,
        columnStyles,
        ...stylesTableau(DOC.terre),
        didParseCell: (data) => {
          if (includeRetards && data.section === 'body') {
            const retardsColStart = 6
            if (data.column.index === retardsColStart || data.column.index === retardsColStart + 1) {
              if (data.cell.text[0] === '—') {
                data.cell.styles.textColor = DOC.craieFaible
              } else {
                data.cell.styles.textColor = DOC.rouge
              }
            }
          }
        }
      })

      // ═══ LES ANNEXES, À LA SUITE ═══
      // Elles commencent sous le registre quand la place suffit, sinon
      // sur une page neuve avec la bande gravée.
      let yAnnexe = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : null

      // LES JOURS FÉRIÉS
      if (includeHolidays && filteredHolidayRows.length > 0) {
        const holidayRows = filteredHolidayRows.map(h => [
          formatDateFr(h.date),
          h.name || 'Jour férié',
          selectedEntrepriseId === 'all'
            ? (entreprises.find(e => e.id === h.enterprise_id)?.name || 'Entreprise')
            : selectedEnterpriseName,
          h.is_worked ? 'Travaillé' : 'Non travaillé',
          `${h.overtime_rate ?? 100}%`,
        ])

        yAnnexe = ajouterPageDetail(doc, {
          titre: 'Détail des jours fériés',
          sousTitre: `${holidayRows.length} jour${holidayRows.length > 1 ? 's' : ''} · ${periodeLongue}`,
          accent: DOC.violet,
          tete: ['Date', 'Jour férié', 'Entreprise', 'Type', 'Taux'],
          lignes: holidayRows,
          colonnes: colonnesProportionnelles([1.1, 2.8, 2.4, 1.5, 0.9], {
            largeur: largeurUtile(doc),
            halign: ['left', 'left', 'left', 'left', 'right'],
          }),
          continuer: true,
          y: yAnnexe,
          hauteurEstimee: 22 + holidayRows.length * 7,
        }) + 12
      }

      // LES ABSENCES ET CONGÉS
      if ((includeAbsences || includeConges) && absences.length > 0) {
        const typeLabels = {
          conge: 'Congé payé',
          maladie: 'Maladie',
          maternite: 'Maternité / paternité',
          formation: 'Formation',
          deces: 'Deuil',
          injustifie: 'Absence injustifiée',
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
            `${abs.employees?.first_name || ''} ${abs.employees?.last_name || ''}`.trim() || '—',
            typeLabels[abs.reason] || abs.reason || '—',
            formatDateFr(abs.start_date),
            formatDateFr(abs.end_date),
            `${days}j`,
            (abs.notes || '—').substring(0, 35) + (abs.notes?.length > 35 ? '…' : ''),
          ]
        })

        yAnnexe = ajouterPageDetail(doc, {
          titre: 'Absences et congés',
          sousTitre: `${absData.length} absence${absData.length > 1 ? 's' : ''} · ${periodeLongue}`,
          accent: DOC.indigoTexte,
          tete: ['Employé', 'Motif', 'Du', 'Au', 'Jours', 'Notes'],
          lignes: absData,
          colonnes: colonnesProportionnelles([2.4, 2.6, 1.2, 1.2, 0.8, 2.2], {
            largeur: largeurUtile(doc),
            halign: ['left', 'left', 'left', 'left', 'right', 'left'],
          }),
          continuer: true,
          y: yAnnexe,
          hauteurEstimee: 22 + absData.length * 7,
        }) + 12
      }

      // LES HEURES SUPPLÉMENTAIRES
      if (includeHeuresSup) {
        const employeesWithOvertime = employeesData.filter(({ stats }) => stats.totalHeuresSupMinutes > 0)

        if (employeesWithOvertime.length > 0) {
          const otHeaders = ['Matricule', 'Employé', 'Travail', 'Seuil', 'H. sup', 'Majorées', 'Total']
          const poidsSup = [1.2, 2.6, 1.2, 1.1, 1.05, 1.15, 1]
          const alignSup = ['center', 'left', 'center', 'center', 'center', 'center', 'center']

          if (includeHolidays) {
            otHeaders.push('Fériés')
            poidsSup.push(0.8)
            alignSup.push('center')
          }

          const otData = employeesWithOvertime.map(({ emp, stats }) => {
            const row = [
              emp.matricule || '—',
              `${emp.first_name} ${emp.last_name}`,
              formatMinutesToHM(stats.totalMinutes),
              formatMinutesToHM(stats.dailyThresholdMinutes) + '/j',
              formatMinutesToHM(stats.heuresSupMinutes),
              stats.heuresSupMajorees > 0 ? formatMinutesToHM(stats.heuresSupMajorees) : '—',
              formatMinutesToHM(stats.totalHeuresSupMinutes),
            ]
            if (includeHolidays) row.push(stats.workedHolidaysCount > 0 ? `${stats.workedHolidaysCount}` : '—')
            return row
          })

          yAnnexe = ajouterPageDetail(doc, {
            titre: 'Heures supplémentaires',
            sousTitre: `${otData.length} employé${otData.length > 1 ? 's' : ''} · ${periodeLongue}`,
            accent: DOC.ambre,
            tete: otHeaders,
            lignes: otData,
            colonnes: colonnesProportionnelles(poidsSup, {
              largeur: largeurUtile(doc),
              halign: alignSup,
            }),
            continuer: true,
            y: yAnnexe,
            hauteurEstimee: 22 + otData.length * 7,
          }) + 12
        }
      }

      // ═══ ANNEXE : LE JOURNAL DES POINTAGES ═══
      if (includePointages) {
        ajouterJournalPointages(doc, {
          lignes: journal,
          periode: periodeLongue,
          entreprise: selectedEnterpriseName,
        })
      }

      numeroterPages(doc, {
        titre: 'Rapport de pointage',
        entreprise: selectedEnterpriseName,
        periode: periodeLongue,
      })

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
        holidayMapByEnterprise,
        geofencesById
      } = await fetchReportData()

      const periodeCourte = `${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)}`
      const titreDocument = `En-Check — Rapport de pointage — ${periodeCourte}`

      const headers = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Département', 'Jours présent', 'Heures total', 'Moyenne/jour']
      if (includeRetards) headers.push('Nb retards', 'Temps retard', 'Planning retards')
      if (includeHeuresSup) headers.push('Heures sup', 'H. sup majorées', 'Total H. sup')
      if (includeHolidays) headers.push('Fériés travaillés', 'Minutes fériées')
      if (includeAbsences || includeConges) headers.push('Congés (j)', 'Maladie (j)', 'Autre (j)')
      if (includePointages) headers.push('Pointages')

      const journal = includePointages
        ? construireJournalPointages({ attendances, employees, geofencesById })
        : []

      const pointagesParEmploye = new Map()
      if (includePointages) {
        journal.forEach(p => {
          const cle = p.matricule
          pointagesParEmploye.set(cle, (pointagesParEmploye.get(cle) || 0) + 1)
        })
      }

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

        if (includePointages) {
          row.push(pointagesParEmploye.get(emp.matricule || '') || 0)
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

      const absencesRows = (includeAbsences || includeConges) && absences.length > 0
        ? absences.map(abs => [
            `${abs.employees?.first_name || ''} ${abs.employees?.last_name || ''}`.trim(),
            abs.employees?.matricule || '',
            abs.reason || '',
            formatDateFr(abs.start_date),
            formatDateFr(abs.end_date),
            includeNonWorkedHolidays
              ? calcBusinessDays(abs.start_date, abs.end_date)
              : HolidayService.countWorkingDays(
                  abs.start_date,
                  abs.end_date,
                  holidaySetByEnterprise[abs.enterprise_id] || new Set(),
                  true
                ),
            (abs.notes || '').replace(/;/g, ','),
          ])
        : []

      const journalLignes = includePointages
        ? journal.map(p => [
            p.date,
            p.heure,
            p.matricule,
            p.nom,
            p.prenom,
            p.sens,
            p.dansZone,
            p.distance,
            p.precision,
            p.methode,
            p.autoCloture,
            p.suspect,
            (p.motifSuspect || '').replace(/;/g, ','),
            p.zone,
            p.latitude,
            p.longitude,
          ])
        : []

      const csvContent = [
        titreDocument,
        `Entreprise;${selectedEnterpriseName}`,
        includeRetards ? 'Note;Les employés sans planning (N/A) ne sont pas évalués pour les retards.' : '',
        includeHolidays ? `Jours fériés inclus;${includeWorkedHolidays ? 'Travaillés ' : ''}${includeNonWorkedHolidays ? 'Non travaillés' : ''}` : '',
        includePointages ? `Pointages;${journal.length}` : '',
        '',
        'REGISTRE DES EMPLOYÉS',
        headers.join(';'),
        ...rows.map(row => row.join(';')),
        ...(includeHolidays && holidayRows.length > 0
          ? ['', 'DETAIL JOURS FERIES', 'Date;Nom;Entreprise;Type;Taux', ...holidayRows.map(r => r.join(';'))]
          : []),
        ...(absencesRows.length > 0
          ? ['', 'DETAIL ABSENCES ET CONGES', 'Employé;Matricule;Motif;Du;Au;Jours;Notes', ...absencesRows.map(r => r.join(';'))]
          : []),
        ...(journalLignes.length > 0
          ? [
              '',
              'JOURNAL DES POINTAGES',
              'Date;Heure;Matricule;Nom;Prénom;Sens;Zone GPS;Distance;Précision (m);Méthode;Clôture auto;Suspect;Motif suspect;Zone;Latitude;Longitude',
              ...journalLignes.map(r => r.join(';')),
            ]
          : []),
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

  // Compté une fois pour la page entière (les PDF ont le leur).
  const joursOuvresPeriode = calculateWorkingDays(dateDebut, dateFin)

  // Les contenus qui se déclenchent dans le rapport : un ton par famille.
  // Les libellés sont ceux du produit, le dessin celui de la page.
  const SCEAUX = [
    {
      cle: 'retards',
      ton: 'alerte',
      Icone: AlertTriangle,
      titre: 'Retards',
      desc: 'Employés disposant d’un planning',
      actif: includeRetards,
      bascule: () => setIncludeRetards(v => !v),
      bloque: false,
    },
    {
      cle: 'heures-sup',
      ton: 'attente',
      Icone: Timer,
      titre: 'Heures supplémentaires',
      desc: hasHeuresSupFeature ? 'Dépassements horaires' : 'Module non activé',
      actif: includeHeuresSup,
      bascule: () => setIncludeHeuresSup(v => !v),
      bloque: !hasHeuresSupFeature,
    },
    {
      cle: 'conges',
      ton: 'ok',
      Icone: CalendarDays,
      titre: 'Congés',
      desc: hasAbsencesFeature ? 'Congés approuvés' : 'Module non activé',
      actif: includeConges,
      bascule: () => setIncludeConges(v => !v),
      bloque: !hasAbsencesFeature,
    },
    {
      cle: 'absences',
      ton: 'indigo',
      Icone: CalendarOff,
      titre: 'Absences',
      desc: hasAbsencesFeature ? 'Maladie, autres…' : 'Module non activé',
      actif: includeAbsences,
      bascule: () => setIncludeAbsences(v => !v),
      bloque: !hasAbsencesFeature,
    },
    {
      cle: 'feries',
      ton: 'violet',
      Icone: Calendar,
      titre: 'Jours fériés',
      desc: 'Travaillés ou non travaillés',
      actif: includeHolidays,
      bascule: () => setIncludeHolidays(v => !v),
      bloque: false,
    },
    {
      cle: 'pointages',
      ton: 'terre',
      Icone: MapPin,
      titre: 'Pointages',
      desc: 'Le journal brut : heures, zones, GPS',
      actif: includePointages,
      bascule: () => setIncludePointages(v => !v),
      bloque: false,
    },
  ]

  const CONTENUS = [
    { libelle: 'Résumé de la période', Icone: CheckCircle, ton: 'ok', actif: true },
    { libelle: 'Liste des employés', Icone: CheckCircle, ton: 'ok', actif: true },
    { libelle: 'Jours de présence', Icone: CheckCircle, ton: 'ok', actif: true },
    { libelle: 'Heures travaillées', Icone: CheckCircle, ton: 'ok', actif: true },
    { libelle: 'Moyenne par jour', Icone: CheckCircle, ton: 'ok', actif: true },
    { libelle: 'Retards (planning requis)', Icone: AlertTriangle, ton: 'alerte', actif: includeRetards },
    { libelle: 'Heures supplémentaires', Icone: Timer, ton: 'attente', actif: includeHeuresSup },
    { libelle: 'Détail des congés', Icone: CalendarDays, ton: 'ok', actif: includeConges },
    { libelle: 'Registre des absences', Icone: CalendarOff, ton: 'indigo', actif: includeAbsences },
    { libelle: 'Jours fériés, travaillés ou non', Icone: Calendar, ton: 'violet', actif: includeHolidays },
    { libelle: 'Journal des pointages (entrées, sorties, zones)', Icone: MapPin, ton: 'terre', actif: includePointages },
  ]

  return (
    <div className={`rp-page${darkMode ? '' : ' rp-clair'}`}>
      <PageCulturalBand pathname="/rapports" />
      <div className="rp-bordure" aria-hidden="true" />

      <header className="rp-entete">
        <button
          type="button"
          className="rp-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={16} />
        </button>

        <NsibidiBlasonSvg size={48} />

        <div className="rp-titre-bloc">
          <span className="rp-eyebrow">Les registres de craie</span>
          <h1 className="rp-titre">
            Rapports<span>.</span>
          </h1>
          <p className="rp-sous-titre">
            Choisissez une période et ce que le rapport doit compter, puis exportez-le en PDF ou en tableur.
          </p>
        </div>

        <div className="rp-entete-droite">
          <button
            type="button"
            className="rp-bascule"
            role="switch"
            aria-checked={darkMode}
            onClick={toggleTheme}
            aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={darkMode ? 'Thème clair' : 'Thème sombre'}
          >
            {darkMode ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="rp-coque">

        {/* ── Le seuil : l'entreprise, la période, les autres écrans ── */}
        <section className="rp-seuil" aria-label="Entreprise et accès rapides">
          <div className="rp-seuil-entreprise">
            <span className="rp-seuil-libelle">Entreprise</span>
            <span className="rp-seuil-nom">{selectedEnterpriseName}</span>
            <span className="rp-seuil-fait">
              <Calendar size={11} aria-hidden="true" />
              {formatDateFr(dateDebut)} → {formatDateFr(dateFin)}
            </span>
            <span className="rp-seuil-fait">
              <Clock size={11} aria-hidden="true" />
              {joursOuvresPeriode} jour{joursOuvresPeriode > 1 ? 's' : ''} ouvré{joursOuvresPeriode > 1 ? 's' : ''}
            </span>
            {loading && <span className="rp-seuil-fait">Génération en cours…</span>}
          </div>

          <div className="rp-raccourcis">
            <span className="rp-seuil-libelle">Aller à</span>
            <RaccourcisPages compact excludePaths={['/rapports']} />
          </div>
        </section>

        <div className="rp-atelier">

          {/* ── La colonne du composeur ── */}
          <div className="rp-colonne">

            <section className="rp-cartouche" aria-labelledby="rp-composer-titre">
              <div className="rp-cartouche-tete">
                <span className="rp-cartouche-icone">
                  <FileText size={17} aria-hidden="true" />
                </span>
                <div className="rp-cartouche-titres">
                  <h2 className="rp-cartouche-titre" id="rp-composer-titre">Composer le rapport</h2>
                  <p className="rp-cartouche-note">La période, l’entreprise et les rubriques à compter.</p>
                </div>
              </div>

              <div className="rp-champs">
                <label className="rp-champ">
                  <span className="rp-etiquette">
                    <Calendar size={11} aria-hidden="true" />
                    Du
                  </span>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={e => setDateDebut(e.target.value)}
                    aria-label="Date de début de la période"
                  />
                </label>

                <label className="rp-champ">
                  <span className="rp-etiquette">
                    <Calendar size={11} aria-hidden="true" />
                    Au
                  </span>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={e => setDateFin(e.target.value)}
                    aria-label="Date de fin de la période"
                  />
                </label>

                {admin?.role === 'super_admin' && (
                  <label className="rp-champ rp-champ--large">
                    <span className="rp-etiquette">
                      <Building2 size={11} aria-hidden="true" />
                      Entreprise
                    </span>
                    <select
                      value={selectedEntrepriseId}
                      onChange={e => setSelectedEntrepriseId(e.target.value)}
                      aria-label="Choisir l’entreprise du rapport"
                    >
                      <option value="all">Toutes les entreprises</option>
                      {entreprises.map(ent => (
                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="rp-sceaux" role="group" aria-label="Rubriques du rapport">
                {SCEAUX.map(({ cle, ton, Icone, titre, desc, actif, bascule, bloque }) => (
                  <button
                    key={cle}
                    type="button"
                    className="rp-sceau"
                    data-ton={ton}
                    aria-pressed={actif}
                    disabled={bloque}
                    onClick={bascule}
                  >
                    <span className="rp-sceau-icone">
                      <Icone size={15} aria-hidden="true" />
                    </span>
                    <span className="rp-sceau-texte">
                      <span className="rp-sceau-titre">{titre}</span>
                      <span className="rp-sceau-desc">{desc}</span>
                    </span>
                    <span className="rp-sceau-marque" aria-hidden="true">
                      {actif && <CheckCircle size={12} />}
                    </span>
                  </button>
                ))}
              </div>

              {includeHolidays && (
                <div className="rp-sous-sceaux">
                  <button
                    type="button"
                    className="rp-sceau"
                    data-ton="attente"
                    aria-pressed={includeWorkedHolidays}
                    onClick={() => setIncludeWorkedHolidays(v => !v)}
                  >
                    <span className="rp-sceau-icone">
                      <Timer size={15} aria-hidden="true" />
                    </span>
                    <span className="rp-sceau-texte">
                      <span className="rp-sceau-titre">Fériés travaillés</span>
                      <span className="rp-sceau-desc">Fériés avec pointage</span>
                    </span>
                    <span className="rp-sceau-marque" aria-hidden="true">
                      {includeWorkedHolidays && <CheckCircle size={12} />}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="rp-sceau"
                    data-ton="indigo"
                    aria-pressed={includeNonWorkedHolidays}
                    onClick={() => setIncludeNonWorkedHolidays(v => !v)}
                  >
                    <span className="rp-sceau-icone">
                      <CalendarOff size={15} aria-hidden="true" />
                    </span>
                    <span className="rp-sceau-texte">
                      <span className="rp-sceau-titre">Fériés non travaillés</span>
                      <span className="rp-sceau-desc">Fériés sans pointage</span>
                    </span>
                    <span className="rp-sceau-marque" aria-hidden="true">
                      {includeNonWorkedHolidays && <CheckCircle size={12} />}
                    </span>
                  </button>
                </div>
              )}

              {includeRetards && (
                <p className="rp-note">
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>
                    Les retards ne sont calculés que pour les employés ayant un planning défini,
                    individuel ou d’entreprise. Les autres apparaissent avec <strong>N/A</strong>.
                  </span>
                </p>
              )}

              <div className="rp-exports">
                <button
                  type="button"
                  className="rp-export"
                  data-ton="principal"
                  onClick={generatePDF}
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={16} className="rp-tourne" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                  {loading ? 'Génération…' : 'Télécharger le PDF'}
                </button>

                <button
                  type="button"
                  className="rp-export"
                  data-ton="creux"
                  onClick={generateGraphicalPDF}
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={16} className="rp-tourne" aria-hidden="true" /> : <TrendingUp size={16} aria-hidden="true" />}
                  {loading ? 'Génération…' : 'PDF graphique'}
                </button>

                <button
                  type="button"
                  className="rp-export"
                  data-ton="creux"
                  onClick={generateExcel}
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={16} className="rp-tourne" aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
                  {loading ? 'Génération…' : 'Télécharger le tableur'}
                </button>
              </div>
            </section>

            {/* ── La marge : ce que le rapport contient ── */}
            <section className="rp-marge" aria-labelledby="rp-marge-titre">
              <h2 className="rp-marge-titre" id="rp-marge-titre">
                <Sparkles size={12} aria-hidden="true" />
                Ce que contient le rapport
              </h2>
              <ul className="rp-marge-liste">
                {CONTENUS.filter(c => c.actif).map(({ libelle, Icone, ton }) => (
                  <li key={libelle} className="rp-marge-ligne" data-ton={ton}>
                    <Icone size={13} aria-hidden="true" />
                    <span>{libelle}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ── La marge du scribe : l'aperçu ── */}
          <aside className="rp-colonne">
            <section className="rp-apercu" aria-labelledby="rp-apercu-titre">
              <div className="rp-apercu-tete">
                <h2 className="rp-apercu-titre" id="rp-apercu-titre">
                  <Eye size={12} aria-hidden="true" />
                  Aperçu du rapport
                </h2>
                <button
                  type="button"
                  className="rp-actualiser"
                  onClick={loadPreview}
                  disabled={loadingPreview}
                >
                  <RefreshCw size={12} className={loadingPreview ? 'rp-tourne' : ''} aria-hidden="true" />
                  {loadingPreview ? 'Chargement…' : 'Actualiser'}
                </button>
              </div>

              <div className="rp-apercu-lignes">
                <span className="rp-apercu-ligne">
                  <Calendar size={12} aria-hidden="true" />
                  {formatDateFr(dateDebut)} — {formatDateFr(dateFin)}
                </span>
                <span className="rp-apercu-ligne">
                  <Clock size={12} aria-hidden="true" />
                  {joursOuvresPeriode} jours ouvrés
                </span>
                <span className="rp-apercu-ligne">
                  <Building2 size={12} aria-hidden="true" />
                  {selectedEnterpriseName}
                </span>
              </div>

              {(includeRetards || includeHeuresSup || includeConges || includeAbsences || includeHolidays || includePointages) && (
                <div className="rp-etiquettes">
                  {includeRetards && (
                    <span className="rp-etiquette-ton" data-ton="alerte">
                      <AlertTriangle size={10} aria-hidden="true" /> Retards
                    </span>
                  )}
                  {includeHeuresSup && (
                    <span className="rp-etiquette-ton" data-ton="attente">
                      <Timer size={10} aria-hidden="true" /> H. sup
                    </span>
                  )}
                  {includeConges && (
                    <span className="rp-etiquette-ton" data-ton="ok">
                      <CalendarDays size={10} aria-hidden="true" /> Congés
                    </span>
                  )}
                  {includeAbsences && (
                    <span className="rp-etiquette-ton" data-ton="indigo">
                      <CalendarOff size={10} aria-hidden="true" /> Absences
                    </span>
                  )}
                  {includeHolidays && (
                    <span className="rp-etiquette-ton" data-ton="violet">
                      <Calendar size={10} aria-hidden="true" /> Fériés
                    </span>
                  )}
                  {includePointages && (
                    <span className="rp-etiquette-ton" data-ton="terre">
                      <MapPin size={10} aria-hidden="true" /> Pointages
                    </span>
                  )}
                </div>
              )}

              {previewData ? (
                <>
                  <div className="rp-mesures">
                    <div className="rp-mesure">
                      <span className="rp-mesure-valeur">{previewData.totalEmployees}</span>
                      <span className="rp-mesure-libelle">Employés</span>
                    </div>
                    <div className="rp-mesure">
                      <span className="rp-mesure-valeur">{formatMinutesToHM(previewData.totalHeuresTravaillees)}</span>
                      <span className="rp-mesure-libelle">Travaillé</span>
                    </div>
                    {includeRetards && (
                      <div className="rp-mesure" data-ton="alerte">
                        <span className="rp-mesure-valeur">{previewData.totalRetards}</span>
                        <span className="rp-mesure-libelle">Retards</span>
                      </div>
                    )}
                    {includeHeuresSup && previewData.totalHeuresSup > 0 && (
                      <div className="rp-mesure" data-ton="attente">
                        <span className="rp-mesure-valeur">{formatMinutesToHM(previewData.totalHeuresSup)}</span>
                        <span className="rp-mesure-libelle">H. sup</span>
                      </div>
                    )}
                    {includeHolidays && (
                      <div className="rp-mesure" data-ton="violet">
                        <span className="rp-mesure-valeur">{previewData.totalHolidayDays}</span>
                        <span className="rp-mesure-libelle">Fériés</span>
                      </div>
                    )}
                    {includePointages && (
                      <div className="rp-mesure" data-ton="terre">
                        <span className="rp-mesure-valeur">{previewData.totalPointages}</span>
                        <span className="rp-mesure-libelle">Pointages</span>
                      </div>
                    )}
                  </div>

                  {includeHolidays && previewData.totalWorkedHolidays > 0 && (
                    <p className="rp-constat">
                      <Calendar size={12} aria-hidden="true" />
                      <span>
                        {previewData.totalWorkedHolidays} jour{previewData.totalWorkedHolidays > 1 ? 's' : ''} férié{previewData.totalWorkedHolidays > 1 ? 's' : ''} travaillé{previewData.totalWorkedHolidays > 1 ? 's' : ''} · {formatMinutesToHM(previewData.totalWorkedHolidaysMinutes)}
                      </span>
                    </p>
                  )}

                  {includeRetards && previewData.employesSansPlanningRetards > 0 && (
                    <p className="rp-constat" data-ton="neutre">
                      <Users size={12} aria-hidden="true" />
                      <span>
                        {previewData.employesSansPlanningRetards} employé{previewData.employesSansPlanningRetards > 1 ? 's' : ''} sans planning : retards non évalués.
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <div className="rp-apercu-vide">
                  <Eye size={18} aria-hidden="true" />
                  <p>
                    Aucun aperçu pour l’instant.<br />
                    Touchez « Actualiser » pour compter la période.
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>

      <div className="rp-pied">
        <PageCulturalBand pathname="/rapports" placement="bottom" />
      </div>
    </div>
  )
}
