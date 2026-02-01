// ═══════════════════════════════════════════════════════════
// 📊 PAGE RAPPORTS (AVEC RETARDS)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  Footprints, 
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Download,
  FileSpreadsheet,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Rapports() {
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEntreprise, setSelectedEntreprise] = useState('all')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [includeRetards, setIncludeRetards] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) {
      navigate('/login')
      return
    }
    
    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    setDateDebut(firstDay.toISOString().split('T')[0])
    setDateFin(lastDay.toISOString().split('T')[0])

    if (parsedAdmin.role !== 'super_admin') {
      setSelectedEntreprise(parsedAdmin.enterprise_id)
    }

    loadEntreprises(parsedAdmin)
  }, [navigate])

  const loadEntreprises = async (adminData) => {
    if (adminData.role === 'super_admin') {
      const { data } = await supabase
        .from('enterprises')
        .select('*')
        .eq('is_active', true)
      setEntreprises(data || [])
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 RÉCUPÉRER LES DONNÉES DU RAPPORT
  // ═══════════════════════════════════════════════════════════
  const fetchReportData = async () => {
    try {
      // Récupérer les employés
      let employeesQuery = supabase
        .from('employees')
        .select('*, enterprises(name)')
        .eq('is_active', true)

      if (selectedEntreprise !== 'all') {
        employeesQuery = employeesQuery.eq('enterprise_id', selectedEntreprise)
      } else if (admin.role !== 'super_admin') {
        employeesQuery = employeesQuery.eq('enterprise_id', admin.enterprise_id)
      }

      const { data: employees } = await employeesQuery

      // Récupérer les horaires des employés
      const employeeIds = employees?.map(e => e.id) || []
      let schedulesData = []
      
      if (employeeIds.length > 0) {
        const { data: schedules } = await supabase
          .from('employee_schedules')
          .select('*, work_schedules(*)')
          .in('employee_id', employeeIds)
        schedulesData = schedules || []
      }

      // Récupérer les pointages
      let attendancesQuery = supabase
        .from('attendances')
        .select('*')
        .gte('check_time', `${dateDebut}T00:00:00`)
        .lte('check_time', `${dateFin}T23:59:59`)

      if (selectedEntreprise !== 'all') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', selectedEntreprise)
      } else if (admin.role !== 'super_admin') {
        attendancesQuery = attendancesQuery.eq('enterprise_id', admin.enterprise_id)
      }

      const { data: attendances } = await attendancesQuery

      return { 
        employees: employees || [], 
        attendances: attendances || [],
        schedules: schedulesData
      }
    } catch (error) {
      console.error('Erreur fetchReportData:', error)
      return { employees: [], attendances: [], schedules: [] }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🧮 CALCULER LES STATISTIQUES PAR EMPLOYÉ (AVEC RETARDS)
  // ═══════════════════════════════════════════════════════════
  const calculateEmployeeStats = (employeeId, attendances, schedules) => {
    const empAttendances = attendances.filter(a => a.employee_id === employeeId)
    const schedule = schedules.find(s => s.employee_id === employeeId)
    
    // Obtenir l'heure d'arrivée prévue
    let heureArrivee = '08:00'
    let tolerance = 15

    if (schedule) {
      if (schedule.use_custom_hours && schedule.custom_start_time) {
        heureArrivee = schedule.custom_start_time.slice(0, 5)
      } else if (schedule.schedule_id && schedule.work_schedules) {
        heureArrivee = schedule.work_schedules.start_time?.slice(0, 5) || '08:00'
        tolerance = schedule.work_schedules.late_tolerance_minutes || 15
      }
    }

    // Grouper par jour
    const parJour = {}
    empAttendances.forEach(att => {
      const jour = att.check_time.split('T')[0]
      if (!parJour[jour]) parJour[jour] = []
      parJour[jour].push(att)
    })

    let totalMinutes = 0
    let joursPresent = 0
    let retardsCount = 0
    let retardsMinutes = 0

    Object.entries(parJour).forEach(([jour, atts]) => {
      atts.sort((a, b) => new Date(a.check_time) - new Date(b.check_time))
      
      const firstIn = atts.find(a => a.check_type === 'in')
      if (firstIn) {
        joursPresent++
        
        // Calculer le retard
        const heurePointage = firstIn.check_time.split('T')[1].slice(0, 5)
        const [hA, mA] = heureArrivee.split(':').map(Number)
        const [hP, mP] = heurePointage.split(':').map(Number)
        
        const minutesArriveeMax = hA * 60 + mA + tolerance
        const minutesPointage = hP * 60 + mP
        
        if (minutesPointage > minutesArriveeMax) {
          retardsCount++
          retardsMinutes += (minutesPointage - (hA * 60 + mA))
        }
      }

      // Calculer les heures travaillées
      let currentIn = null
      atts.forEach(att => {
        if (att.check_type === 'in') {
          currentIn = new Date(att.check_time)
        } else if (att.check_type === 'out' && currentIn) {
          const outTime = new Date(att.check_time)
          totalMinutes += (outTime - currentIn) / (1000 * 60)
          currentIn = null
        }
      })
    })

    return {
      joursPresent,
      heuresTotal: Math.round(totalMinutes / 60 * 100) / 100,
      moyenneJour: joursPresent > 0 ? Math.round(totalMinutes / joursPresent / 60 * 100) / 100 : 0,
      retardsCount,
      retardsMinutes,
      heureArrivee
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 📥 GÉNÉRER LE PDF
  // ═══════════════════════════════════════════════════════════
  const generatePDF = async () => {
    setLoading(true)

    try {
      const { employees, attendances, schedules } = await fetchReportData()
      
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      const brunProfond = [61, 43, 31]
      const rouge = [155, 44, 44]
      
      // En-tête
      doc.setFillColor(...brunProfond)
      doc.rect(0, 0, pageWidth, 45, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.text('EN-CHECK', pageWidth / 2, 18, { align: 'center' })

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Rapport de Pointage', pageWidth / 2, 28, { align: 'center' })

      doc.setFontSize(10)
      doc.text(`Période : ${formatDateFr(dateDebut)} - ${formatDateFr(dateFin)}`, pageWidth / 2, 38, { align: 'center' })

      // Résumé
      doc.setTextColor(...brunProfond)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Résumé', 14, 58)

      const totalEmployes = employees.length
      const joursOuvres = calculateWorkingDays(dateDebut, dateFin)
      
      // Calculer les stats globales
      let totalRetards = 0
      let totalMinutesRetard = 0
      employees.forEach(emp => {
        const stats = calculateEmployeeStats(emp.id, attendances, schedules)
        totalRetards += stats.retardsCount
        totalMinutesRetard += stats.retardsMinutes
      })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Nombre d'employés : ${totalEmployes}`, 14, 68)
      doc.text(`Jours ouvrés : ${joursOuvres}`, 14, 75)
      
      if (includeRetards) {
        doc.setTextColor(...rouge)
        doc.text(`Total retards : ${totalRetards}`, 14, 82)
        doc.text(`Temps perdu : ${formatDuree(totalMinutesRetard)}`, 14, 89)
        doc.setTextColor(...brunProfond)
      }

      // Tableau des employés
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Détail par Employé', 14, includeRetards ? 105 : 92)

      const tableHeaders = includeRetards 
        ? ['Matricule', 'Nom Complet', 'Poste', 'Jours', 'Heures', 'Moy/J', 'Retards', 'Temps perdu']
        : ['Matricule', 'Nom Complet', 'Poste', 'Jours Présent', 'Heures Total', 'Moy./Jour']

      const tableData = employees.map(emp => {
        const stats = calculateEmployeeStats(emp.id, attendances, schedules)
        
        if (includeRetards) {
          return [
            emp.matricule,
            `${emp.first_name} ${emp.last_name}`,
            emp.position || '-',
            stats.joursPresent.toString(),
            `${stats.heuresTotal}h`,
            `${stats.moyenneJour}h`,
            stats.retardsCount.toString(),
            formatDuree(stats.retardsMinutes)
          ]
        } else {
          return [
            emp.matricule,
            `${emp.first_name} ${emp.last_name}`,
            emp.position || '-',
            stats.joursPresent.toString(),
            `${stats.heuresTotal}h`,
            `${stats.moyenneJour}h`
          ]
        }
      })

      autoTable(doc, {
        startY: includeRetards ? 110 : 97,
        head: [tableHeaders],
        body: tableData,
        headStyles: {
          fillColor: brunProfond,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [245, 240, 235]
        },
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        columnStyles: includeRetards ? {
          0: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center', textColor: rouge },
          7: { halign: 'center', textColor: rouge }
        } : {
          0: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' }
        }
      })

      // Pied de page
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }

      const entrepriseName = selectedEntreprise === 'all' 
        ? 'Toutes' 
        : entreprises.find(e => e.id === selectedEntreprise)?.name || 'Rapport'
      
      doc.save(`Rapport_${entrepriseName}_${dateDebut}_${dateFin}.pdf`)
      toast.success('PDF généré avec succès !')

    } catch (error) {
      console.error('Erreur génération PDF:', error)
      toast.error('Erreur lors de la génération du PDF')
    }

    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 GÉNÉRER EXCEL (CSV)
  // ═══════════════════════════════════════════════════════════
  const generateExcel = async () => {
    setLoading(true)

    try {
      const { employees, attendances, schedules } = await fetchReportData()

      const headers = includeRetards
        ? ['Matricule', 'Nom', 'Prénom', 'Poste', 'Département', 'Horaire Prévu', 'Jours Présent', 'Heures Total', 'Moyenne/Jour', 'Nb Retards', 'Minutes Retard']
        : ['Matricule', 'Nom', 'Prénom', 'Poste', 'Département', 'Jours Présent', 'Heures Total', 'Moyenne/Jour']

      const rows = employees.map(emp => {
        const stats = calculateEmployeeStats(emp.id, attendances, schedules)
        
        if (includeRetards) {
          return [
            emp.matricule,
            emp.last_name,
            emp.first_name,
            emp.position || '',
            emp.department || '',
            stats.heureArrivee,
            stats.joursPresent,
            stats.heuresTotal,
            stats.moyenneJour,
            stats.retardsCount,
            stats.retardsMinutes
          ]
        } else {
          return [
            emp.matricule,
            emp.last_name,
            emp.first_name,
            emp.position || '',
            emp.department || '',
            stats.joursPresent,
            stats.heuresTotal,
            stats.moyenneJour
          ]
        }
      })

      const csvContent = [
        `Rapport En-Check - ${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)}`,
        '',
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      
      const entrepriseName = selectedEntreprise === 'all' 
        ? 'Toutes' 
        : entreprises.find(e => e.id === selectedEntreprise)?.name || 'Rapport'
      
      link.download = `Rapport_${entrepriseName}_${dateDebut}_${dateFin}.csv`
      link.click()
      
      toast.success('Excel généré avec succès !')

    } catch (error) {
      console.error('Erreur génération Excel:', error)
      toast.error('Erreur lors de la génération du fichier Excel')
    }

    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 🔧 FONCTIONS UTILITAIRES
  // ═══════════════════════════════════════════════════════════
  const formatDateFr = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDuree = (minutes) => {
    if (!minutes || minutes <= 0) return '0min'
    if (minutes < 60) return `${minutes}min`
    const heures = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${heures}h${mins.toString().padStart(2, '0')}`
  }

  const calculateWorkingDays = (start, end) => {
    let count = 0
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    while (startDate <= endDate) {
      const day = startDate.getDay()
      if (day !== 0 && day !== 6) count++
      startDate.setDate(startDate.getDate() + 1)
    }
    
    return count
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
          <Footprints size={32} color="#FFFBF5" />
          <h1 style={styles.headerTitle}>RAPPORTS</h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            <FileText size={24} color="#8B6914" />
            Générer un Rapport
          </h2>

          {/* Période */}
          <div style={styles.section}>
            <label style={styles.label}>
              <Calendar size={18} />
              Période
            </label>
            <div style={styles.dateRow}>
              <div style={styles.dateGroup}>
                <span style={styles.dateLabel}>Du</span>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  style={styles.dateInput}
                />
              </div>
              <div style={styles.dateGroup}>
                <span style={styles.dateLabel}>Au</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  style={styles.dateInput}
                />
              </div>
            </div>
          </div>

          {/* Entreprise (Super Admin) */}
          {admin?.role === 'super_admin' && (
            <div style={styles.section}>
              <label style={styles.label}>
                <Building2 size={18} />
                Entreprise
              </label>
              <select
                value={selectedEntreprise}
                onChange={(e) => setSelectedEntreprise(e.target.value)}
                style={styles.select}
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Option Retards */}
          <div style={styles.section}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeRetards}
                onChange={(e) => setIncludeRetards(e.target.checked)}
                style={styles.checkbox}
              />
              <AlertTriangle size={18} color="#9B2C2C" />
              Inclure les statistiques de retards
            </label>
          </div>

          {/* Aperçu */}
          <div style={styles.preview}>
            <h3 style={styles.previewTitle}>Aperçu du rapport</h3>
            <div style={styles.previewContent}>
              <div style={styles.previewItem}>
                <Calendar size={16} color="#8B6914" />
                <span>Période : {formatDateFr(dateDebut)} - {formatDateFr(dateFin)}</span>
              </div>
              <div style={styles.previewItem}>
                <Clock size={16} color="#8B6914" />
                <span>Jours ouvrés : {calculateWorkingDays(dateDebut, dateFin)}</span>
              </div>
              <div style={styles.previewItem}>
                <Building2 size={16} color="#8B6914" />
                <span>
                  {selectedEntreprise === 'all' 
                    ? 'Toutes les entreprises' 
                    : entreprises.find(e => e.id === selectedEntreprise)?.name || 'Mon entreprise'}
                </span>
              </div>
              {includeRetards && (
                <div style={styles.previewItem}>
                  <AlertTriangle size={16} color="#9B2C2C" />
                  <span style={{color: '#9B2C2C'}}>Retards inclus</span>
                </div>
              )}
            </div>
          </div>

          {/* Boutons de téléchargement */}
          <div style={styles.downloadButtons}>
            <button 
              onClick={generatePDF} 
              style={styles.pdfBtn}
              disabled={loading}
            >
              {loading ? 'Génération...' : (
                <>
                  <Download size={20} />
                  Télécharger PDF
                </>
              )}
            </button>

            <button 
              onClick={generateExcel} 
              style={styles.excelBtn}
              disabled={loading}
            >
              {loading ? 'Génération...' : (
                <>
                  <FileSpreadsheet size={20} />
                  Télécharger Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Informations */}
        <div style={styles.infoCard}>
          <h3 style={styles.infoTitle}>📋 Contenu du rapport</h3>
          <ul style={styles.infoList}>
            <li><CheckCircle size={16} color="#4A7C59" /> Résumé de la période</li>
            <li><CheckCircle size={16} color="#4A7C59" /> Liste des employés</li>
            <li><CheckCircle size={16} color="#4A7C59" /> Jours de présence par employé</li>
            <li><CheckCircle size={16} color="#4A7C59" /> Total des heures travaillées</li>
            <li><CheckCircle size={16} color="#4A7C59" /> Moyenne d'heures par jour</li>
            {includeRetards && (
              <>
                <li><AlertTriangle size={16} color="#9B2C2C" /> Nombre de retards par employé</li>
                <li><AlertTriangle size={16} color="#9B2C2C" /> Temps total de retard</li>
              </>
            )}
          </ul>
        </div>
      </main>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#E5D4C0' },
  header: { background: '#3D2B1F', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px', color: '#FFFBF5', cursor: 'pointer' },
  headerTitle: { color: '#FFFBF5', fontSize: '24px', fontWeight: '300', letterSpacing: '4px' },
  main: { padding: '24px', maxWidth: '600px', margin: '0 auto' },
  card: { background: '#FFFBF5', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', marginBottom: '20px' },
  cardTitle: { display: 'flex', alignItems: 'center', gap: '12px', color: '#3D2B1F', fontSize: '20px', fontWeight: '600', marginBottom: '24px' },
  section: { marginBottom: '20px' },
  label: { display: 'flex', alignItems: 'center', gap: '8px', color: '#3D2B1F', fontWeight: '500', marginBottom: '10px' },
  dateRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  dateGroup: { flex: 1, minWidth: '150px' },
  dateLabel: { display: 'block', fontSize: '12px', color: '#9E9E9E', marginBottom: '6px' },
  dateInput: { width: '100%', padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '12px 14px', border: '2px solid #E5D4C0', borderRadius: '10px', fontSize: '15px', outline: 'none', background: '#fff' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '10px', color: '#3D2B1F', fontWeight: '500', cursor: 'pointer' },
  checkbox: { width: '20px', height: '20px', accentColor: '#9B2C2C' },
  preview: { background: '#F5F0EB', borderRadius: '12px', padding: '16px', marginBottom: '24px' },
  previewTitle: { fontSize: '14px', fontWeight: '600', color: '#3D2B1F', marginBottom: '12px' },
  previewContent: { display: 'flex', flexDirection: 'column', gap: '8px' },
  previewItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#3D2B1F' },
  downloadButtons: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  pdfBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: '#9B2C2C', color: '#FFFBF5', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', minWidth: '150px' },
  excelBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: '#217346', color: '#FFFBF5', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', minWidth: '150px' },
  infoCard: { background: '#FFFBF5', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' },
  infoTitle: { fontSize: '16px', fontWeight: '600', color: '#3D2B1F', marginBottom: '16px' },
  infoList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
}