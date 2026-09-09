// ═══════════════════════════════════════════════════════════
// 📄 PDF EXPORT SERVICE (FRANÇAIS + EXCEL COMPATIBLE)
// ═══════════════════════════════════════════════════════════

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function exportAnalyticsToPDF(stats, fileName = 'analytics-landing-page.pdf') {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // ⚠️ 26/09/2026 — SUPPRESSION de doc.addFont('Helvetica', 'normal')
    //
    //    Helvetica fait partie des 14 polices STANDARD du format PDF : elle est
    //    déjà connue de tous les lecteurs et n'a pas besoin d'être embarquée.
    //    Cet appel ne servait donc à rien, et il ÉCHOUAIT :
    //      « Font is not stored as string-data in vFS, import fonts or remove
    //        declaration doc.addFont('Helvetica') »
    //    Résultat : une erreur rouge dans la console à CHAQUE PDF généré — ce qui
    //    finit par masquer les vraies erreurs pendant un débogage.
    //
    //    Vérifié : les accents français (é à ç ù ô) s'affichent correctement sans
    //    cet appel, et le PDF se génère à l'identique.
    doc.setFont('Helvetica')

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 15

    // ─── Header ─────────────────────────────────────────────
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 0, pageWidth, 30, 'F')

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(24)
    doc.setFont('Helvetica', 'bold')
    doc.text('EN-CHECK Analytics', 15, 20)

    doc.setTextColor(100, 100, 100)
    doc.setFontSize(10)
    doc.setFont('Helvetica', 'normal')
    doc.text('Statistiques de la Landing Page', pageWidth - 15, 20, { align: 'right' })

    yPosition = 40

    // ─── Date généré ────────────────────────────────────────
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    const dateStr = `Genere le: ${new Date().toLocaleString('fr-FR')}`
    doc.text(dateStr, 15, yPosition)
    yPosition += 8

    // ─── KPIs ───────────────────────────────────────────────
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('Helvetica', 'bold')
    doc.text('Indicateurs Cles', 15, yPosition)
    yPosition += 10

    const kpiData = [
      ['Total visites', stats.total.toString()],
      ['Nouveaux visiteurs', stats.newVisitors.toString()],
      ['Visiteurs recurrents', stats.returning.toString()],
      ['Duree moyenne', formatDuration(stats.avgDuration)],
      ['Taux de rebond', `${stats.bounceRate}%`],
    ]

    autoTable(doc, {
      head: [['Metrique', 'Valeur']],
      body: kpiData,
      startY: yPosition,
      margin: { left: 15, right: 15 },
      styles: {
        fontSize: 10,
        cellPadding: 5,
        halign: 'left',
        font: 'Helvetica',
      },
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        font: 'Helvetica',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    })

    yPosition = doc.lastAutoTable.finalY + 10

    // ─── Répartition par device ─────────────────────────────
    if (Object.keys(stats.byDevice).length > 0) {
      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Appareils', 15, yPosition)
      yPosition += 10

      const deviceData = Object.entries(stats.byDevice).map(([device, count]) => {
        const total = Object.values(stats.byDevice).reduce((a, b) => a + b, 0)
        const pct = Math.round((count / total) * 100)
        return [
          device === 'desktop' ? 'Ordinateur' : device === 'mobile' ? 'Telephone' : 'Tablette',
          count.toString(),
          `${pct}%`,
        ]
      })

      autoTable(doc, {
        head: [['Appareil', 'Visites', 'Pourcentage']],
        body: deviceData,
        startY: yPosition,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 10, cellPadding: 5, font: 'Helvetica' },
        headStyles: { 
          fillColor: [245, 158, 11], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          font: 'Helvetica',
        },
      })

      yPosition = doc.lastAutoTable.finalY + 10
    }

    // ─── Top pays ───────────────────────────────────────────
    if (Object.keys(stats.byCountry).length > 0) {
      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Top Pays', 15, yPosition)
      yPosition += 10

      const topCountries = Object.entries(stats.byCountry)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 15)
        .map(([country, { count, code }]) => {
          const total = stats.total
          const pct = Math.round((count / total) * 100)
          return [country, count.toString(), code || '—', `${pct}%`]
        })

      autoTable(doc, {
        head: [['Pays', 'Visites', 'Code', '%']],
        body: topCountries,
        startY: yPosition,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 10, cellPadding: 5, font: 'Helvetica' },
        headStyles: { 
          fillColor: [245, 158, 11], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          font: 'Helvetica',
        },
      })

      yPosition = doc.lastAutoTable.finalY + 10
    }

    // ─── Top sections ───────────────────────────────────────
    if (Object.keys(stats.sectionCounts).length > 0) {
      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Sections Vues', 15, yPosition)
      yPosition += 10

      const sectionLabels = {
        hero: 'Accueil',
        features: 'Fonctionnalites',
        demo: 'Demo',
        how: 'Mode d\'emploi',
        pricing: 'Tarifs',
        contact: 'Contact',
      }

      const topSections = Object.entries(stats.sectionCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([section, count]) => [
          sectionLabels[section] || section,
          count.toString(),
        ])

      autoTable(doc, {
        head: [['Section', 'Vues']],
        body: topSections,
        startY: yPosition,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 10, cellPadding: 5, font: 'Helvetica' },
        headStyles: { 
          fillColor: [245, 158, 11], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          font: 'Helvetica',
        },
      })

      yPosition = doc.lastAutoTable.finalY + 10
    }

    // ─── Top CTAs ───────────────────────────────────────────
    if (Object.keys(stats.ctaCounts).length > 0) {
      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Boutons les Plus Cliques', 15, yPosition)
      yPosition += 10

      const topCTAs = Object.entries(stats.ctaCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([cta, count]) => [
          formatCTAName(cta),
          count.toString(),
        ])

      autoTable(doc, {
        head: [['Bouton', 'Clics']],
        body: topCTAs,
        startY: yPosition,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 10, cellPadding: 5, font: 'Helvetica' },
        headStyles: { 
          fillColor: [245, 158, 11], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold',
          font: 'Helvetica',
        },
      })
    }

    // ─── Pied de page ───────────────────────────────────────
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.setFont('Helvetica', 'normal')
    doc.text(
      'EN-CHECK (c) 2024 | Statistiques Confidentielles',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )

    // ─── Sauvegarder le PDF ─────────────────────────────────
    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`analytics-${timestamp}.pdf`)
    return { success: true, message: 'PDF exporte avec succes' }
  } catch (error) {
    console.error('Erreur export PDF:', error)
    throw error
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatCTAName(cta) {
  if (cta.length > 50) return cta.substring(0, 50) + '...'
  return cta
}

// ─── Export CSV (Excel natif) ──────────────────────────────

export function exportAnalyticsToCSV(stats, fileName = 'analytics-landing-page.csv') {
  try {
    // UTF-8 BOM pour Excel
    let csv = '\ufeff'
    
    csv += 'EN-CHECK Analytics - Landing Page\n'
    csv += `Genere le,${new Date().toLocaleString('fr-FR')}\n\n`

    // KPIs
    csv += 'INDICATEURS CLES\n'
    csv += 'Metrique,Valeur\n'
    csv += `Total visites,${stats.total}\n`
    csv += `Nouveaux visiteurs,${stats.newVisitors}\n`
    csv += `Visiteurs recurrents,${stats.returning}\n`
    csv += `Duree moyenne,${formatDuration(stats.avgDuration)}\n`
    csv += `Taux de rebond,${stats.bounceRate}%\n\n`

    // Devices
    csv += 'APPAREILS\n'
    csv += 'Appareil,Visites\n'
    Object.entries(stats.byDevice).forEach(([device, count]) => {
      const label = device === 'desktop' ? 'Ordinateur' : device === 'mobile' ? 'Telephone' : 'Tablette'
      csv += `${label},${count}\n`
    })
    csv += '\n'

    // Pays
    csv += 'PAYS (Top 20)\n'
    csv += 'Pays,Code,Visites,Pourcentage\n'
    Object.entries(stats.byCountry)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20)
      .forEach(([country, { count, code }]) => {
        const pct = Math.round((count / stats.total) * 100)
        csv += `"${country}","${code || '—'}",${count},${pct}%\n`
      })

    csv += '\n'

    // Sections
    csv += 'SECTIONS VUES\n'
    csv += 'Section,Vues\n'
    const sectionLabels = {
      hero: 'Accueil',
      features: 'Fonctionnalites',
      demo: 'Demo',
      how: 'Mode d\'emploi',
      pricing: 'Tarifs',
      contact: 'Contact',
    }
    
    Object.entries(stats.sectionCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([section, count]) => {
        const label = sectionLabels[section] || section
        csv += `${label},${count}\n`
      })

    csv += '\n'

    // CTAs
    csv += 'BOUTONS CLIQUES\n'
    csv += 'Bouton,Clics\n'
    Object.entries(stats.ctaCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .forEach(([cta, count]) => {
        const formatted = formatCTAName(cta)
        csv += `"${formatted}",${count}\n`
      })

    csv += '\n'

    // Villes
    if (Object.keys(stats.byCity).length > 0) {
      csv += 'VILLES (Top 10)\n'
      csv += 'Ville,Visites\n'
      Object.entries(stats.byCity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([city, count]) => {
          csv += `"${city}",${count}\n`
        })
    }

    // Créer le fichier avec encodage UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const timestamp = new Date().toISOString().split('T')[0]
    link.download = `analytics-${timestamp}.csv`
    
    // Forcer le téléchargement
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(link.href)

    return { success: true, message: 'CSV exporte avec succes' }
  } catch (error) {
    console.error('Erreur export CSV:', error)
    throw error
  }
}