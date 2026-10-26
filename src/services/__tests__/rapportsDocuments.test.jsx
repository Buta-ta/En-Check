// ═══════════════════════════════════════════════════════════
// ✍️ LES DOCUMENTS DES RAPPORTS
//
// Ce que ces tests gardent :
//   ① les PDF et le tableur sortent de la même matière que la
//     page : bande d'indigo, craie, terre — plus d'orange sur
//     anthracite ;
//   ② le document a une tête, un résumé, des registres et un
//     pied qui numérote ;
//   ③ la rubrique « Pointages » existe, et quand on la coche le
//     journal brut part dans les trois exports ;
//   ④ le journal se construit sans jsPDF : tri, noms, zones,
//     trous — c'est du calcul, pas du dessin.
// ═══════════════════════════════════════════════════════════

import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { NsibidiBlasonSvg } from '../../components/NsibidiSvg'

// autoTable dessine dans un vrai jsPDF : ici on ne veut que savoir
// où il commence et combien de pages il a fallu.
vi.mock('jspdf-autotable', () => ({
  default: (doc, options) => {
    doc.appels.push(['autoTable', options.startY, options.head?.[0]?.length ?? 0, options.body?.length ?? 0])
    doc.lastAutoTable = { finalY: (options.startY || 0) + 8 + (options.body?.length || 0) * 7 }
  },
}))
import {
  DOC,
  MARGES,
  colonnesProportionnelles,
  construireJournalPointages,
  dessinerEntete,
  dessinerResume,
  dessinerTitreSection,
  heurePointage,
  jourPointage,
  largeurUtile,
  stylesTableau,
  ajouterPageDetail,
  numeroterPages,
} from '../../utils/documentsRapports'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/Rapports.jsx')
const css = lire('src/pages/Rapports.css')
const fichierDocument = lire('src/utils/documentsRapports.js')

// ── Un faux jsPDF, qui note tout ce qu'on lui demande ──────
//
// Les documents se dessinent par appels : on peut donc vérifier
// la géométrie et les couleurs sans rendre un seul pixel.
function fauxDoc({ pages = 1 } = {}) {
  const appels = []
  return {
    appels,
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      getNumberOfPages: () => pages,
    },
    setFillColor: (...a) => appels.push(['fill', ...a]),
    setDrawColor: (...a) => appels.push(['draw', ...a]),
    setTextColor: (...a) => appels.push(['text-color', ...a]),
    setLineWidth: (...a) => appels.push(['line-width', ...a]),
    setFont: (...a) => appels.push(['font', ...a]),
    setFontSize: (...a) => appels.push(['font-size', ...a]),
    setPage: (...a) => appels.push(['page', ...a]),
    rect: (...a) => appels.push(['rect', ...a]),
    roundedRect: (...a) => appels.push(['rounded-rect', ...a]),
    line: (...a) => appels.push(['line', ...a]),
    circle: (...a) => appels.push(['circle', ...a]),
    text: (...a) => appels.push(['text', ...a]),
    addImage: (...a) => appels.push(['image', ...a]),
    addPage: () => appels.push(['nouvelle-page']),
  }
}

const textes = (doc) => doc.appels.filter(a => a[0] === 'text').map(a => a[1])

// ── 1. La matière du document ──────────────────────────────

describe('1. la matière du document', () => {
  it('reprend l’indigo, la craie et la terre de la page', () => {
    expect(DOC.indigo).toEqual([16, 28, 40])
    expect(DOC.craie).toEqual([242, 232, 213])
    expect(DOC.terre).toEqual([180, 98, 42])
    // les états du produit, en encres d'impression lisibles
    expect(DOC.rouge).toEqual([185, 28, 28])
    expect(DOC.ambre).toEqual([138, 85, 6])
    expect(DOC.vert).toEqual([11, 95, 67])
  })

  it('ne laisse plus l’orange sur anthracite des anciens documents', () => {
    expect(page).not.toContain('const primaryColor = [245, 158, 11]')
    expect(page).not.toContain('const darkColor = [20, 20, 35]')
    expect(page).not.toContain("doc.rect(0, 0, pageWidth, 50, 'F')")
    // les trois exports passent par la même tête
    expect(page.match(/dessinerEntete\(doc/g)).toHaveLength(3)
    expect(page.match(/numeroterPages\(doc/g)).toHaveLength(2)
    expect(page).toContain('stylesTableau(DOC.terre)')
  })

  it('dessine la tête : bande pleine, blason, titre, filet de terre', () => {
    const doc = fauxDoc()
    const y = dessinerEntete(doc, {
      titre: 'Rapport de pointage',
      periode: '1 octobre 2026 — 31 octobre 2026',
      entreprise: 'Kandi SARL',
    })

    const bande = doc.appels.find(a => a[0] === 'fill' && a[1] === 16 && a[2] === 28 && a[3] === 40)
    expect(bande).toBeTruthy()

    const rectBande = doc.appels.find(a => a[0] === 'rect' && a[3] === 210 && a[4] === 42)
    expect(rectBande).toBeTruthy()

    // le filet de terre, sous la bande
    const filet = doc.appels.find(a => a[0] === 'rect' && a[3] === 210 && a[4] === 1.2)
    expect(filet).toBeTruthy()

    const mots = textes(doc)
    expect(mots).toContain('Rapport de pointage')
    expect(mots).toContain('1 octobre 2026 — 31 octobre 2026')
    expect(mots).toContain('Kandi SARL')

    // la craie sur l'indigo
    expect(doc.appels.some(a => a[0] === 'text-color' && a[1] === 242 && a[2] === 232)).toBe(true)

    expect(y).toBe(50)
  })

  it('tient le résumé sur une grille de trois colonnes', () => {
    const doc = fauxDoc()
    const y = dessinerResume(doc, {
      y: 50,
      titre: 'Résumé de la période',
      entrees: [
        { label: 'Employés', valeur: 12 },
        { label: 'Jours ouvrés', valeur: 22 },
        { label: 'Total travaillé', valeur: '1 204h30' },
        { label: 'Retards', valeur: 4, accent: DOC.rouge },
      ],
    })

    const mots = textes(doc)
    expect(mots).toContain('RÉSUMÉ DE LA PÉRIODE')
    expect(mots).toEqual(expect.arrayContaining(['EMPLOYÉS', 'JOURS OUVRÉS', 'TOTAL TRAVAILLÉ', 'RETARDS']))
    // deux lignes de trois colonnes : 8 + 2 × 11
    expect(y).toBe(50 + 30 + 6)
  })

  it('dessine un titre de section avec son carré de terre et son filet', () => {
    const doc = fauxDoc()
    const y = dessinerTitreSection(doc, 'Registre des employés', 80, DOC.terre)
    expect(textes(doc)).toContain('REGISTRE DES EMPLOYÉS')
    expect(doc.appels.some(a => a[0] === 'rect' && a[1] === MARGES.gauche && a[4] === 2.6)).toBe(true)
    expect(doc.appels.some(a => a[0] === 'line')).toBe(true)
    expect(y).toBe(88)
  })

  it('garde le contrat des tableaux : tête d’indigo, lignes de craie', () => {
    const style = stylesTableau(DOC.terre)
    expect(style.headStyles.fillColor).toEqual(DOC.indigo)
    expect(style.headStyles.textColor).toEqual(DOC.craie)
    expect(style.bodyStyles.textColor).toEqual(DOC.encre)
    expect(style.alternateRowStyles.fillColor).toEqual(DOC.bande)
    expect(style.margin).toEqual({ left: MARGES.gauche, right: MARGES.droite })
    expect(typeof style.didDrawCell).toBe('function')
  })
})

// ── 2. Le journal des pointages ────────────────────────────

describe('2. le journal des pointages', () => {
  const employees = [
    { id: 'e1', first_name: 'Awa', last_name: 'Traoré', matricule: 'KD-001' },
    { id: 'e2', first_name: 'Bilal', last_name: 'Sow', matricule: 'KD-002' },
  ]
  const geofencesById = { z1: 'Siège Kandi' }
  const attendances = [
    {
      id: 'a2', employee_id: 'e1', check_time: '2026-10-01T12:05:00Z', check_type: 'out',
      geofence_id: 'z1', is_within_zone: true, distance_meters: 12, method: 'gps',
      location_lat: 11.13, location_lng: 2.93, gps_accuracy: 8,
    },
    {
      id: 'a1', employee_id: 'e1', check_time: '2026-10-01T07:58:00Z', check_type: 'in',
      geofence_id: 'z1', is_within_zone: false, distance_meters: 240.6, method: 'face',
      location_lat: 11.14, location_lng: 2.94, gps_accuracy: 15, suspect: true, suspect_reason: 'hors zone',
    },
    {
      id: 'a3', employee_id: 'e9', check_time: '2026-10-02T08:00:00Z', check_type: 'in',
      geofence_id: null, is_within_zone: null, distance_meters: null, method: 'manual',
    },
  ]

  it('range les pointages dans l’ordre du temps', () => {
    const journal = construireJournalPointages({ attendances, employees, geofencesById })
    expect(journal.map(p => p.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('nomme l’employé, le sens et la zone', () => {
    const [entree, sortie] = construireJournalPointages({ attendances, employees, geofencesById })
    expect(entree.employe).toBe('Awa Traoré')
    expect(entree.matricule).toBe('KD-001')
    expect(entree.sens).toBe('Entrée')
    expect(sortie.sens).toBe('Sortie')
    expect(entree.zone).toBe('Siège Kandi')
    expect(entree.dansZone).toBe('Hors')
    expect(sortie.dansZone).toBe('Dans')
    expect(sortie.distance).toBe('12 m')
    expect(entree.methode).toBe('Visage')
    expect(sortie.methode).toBe('GPS')
    expect(entree.suspect).toBe('Oui')
  })

  it('ne ment pas sur ce qu’il ne sait pas', () => {
    const inconnu = construireJournalPointages({ attendances, employees, geofencesById })[2]
    expect(inconnu.employe).toBe('Employé inconnu')
    expect(inconnu.matricule).toBe('—')
    expect(inconnu.zone).toBe('Hors zone')
    expect(inconnu.dansZone).toBe('—')
    expect(inconnu.distance).toBe('—')
    expect(inconnu.methode).toBe('Manuel')
  })

  it('formate le jour et l’heure sans casser sur du vide', () => {
    expect(heurePointage('2026-10-01T07:58:00Z')).toMatch(/^\d{2}:\d{2}$/)
    expect(jourPointage('2026-10-01T07:58:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    expect(heurePointage(null)).toBe('—')
    expect(jourPointage('pas une date')).toBe('—')
  })

  it('rend un journal vide plutôt qu’une erreur', () => {
    expect(construireJournalPointages()).toEqual([])
    expect(construireJournalPointages({ attendances: null })).toEqual([])
  })
})

// ── 3. La rubrique dans la page ────────────────────────────

describe('3. la rubrique « Pointages »', () => {
  it('est un sceau de plus, dans la couleur de la page', () => {
    expect(page).toContain('const [includePointages, setIncludePointages] = useState(false)')
    expect(page).toContain("cle: 'pointages'")
    expect(page).toContain("ton: 'terre'")
    expect(page).toContain("titre: 'Pointages'")
    expect(page).toContain("desc: 'Le journal brut : heures, zones, GPS'")
    expect(css).toContain(".rp-sceau[data-ton='terre']")
  })

  it('apparaît dans la marge « ce que contient le rapport »', () => {
    expect(page).toContain('Journal des pointages (entrées, sorties, zones)')
    expect(page).toContain('data-ton="terre"')
  })

  it('compte les pointages dans l’aperçu, seulement quand elle est cochée', () => {
    expect(page).toContain('totalPointages: includePointages ? data.attendances.length : 0')
    expect(page).toContain('previewData.totalPointages')
  })

  it('charge le nom des zones pour le journal', () => {
    expect(page).toContain("supabase.from('geofences').select('id, name')")
    expect(page).toContain('geofencesById')
  })
})

// ── 4. Le journal dans les trois exports ───────────────────

describe('4. le journal part dans les exports', () => {
  it('ouvre une annexe dans le PDF', () => {
    expect(page).toContain('ajouterJournalPointages(doc, {')
    expect(fichierDocument).toContain('export function ajouterJournalPointages')
    expect(fichierDocument).toContain("'Journal des pointages'")
  })

  it('ouvre la même annexe dans le PDF graphique', () => {
    const graphique = page.slice(
      page.indexOf('const generateGraphicalPDF'),
      page.indexOf('const generatePDF')
    )
    expect(graphique).toContain('construireJournalPointages')
    expect(graphique).toContain('ajouterJournalPointages')
  })

  it('ajoute une section au tableur, avec toutes les colonnes brutes', () => {
    const excel = page.slice(page.indexOf('const generateExcel'), page.indexOf('const selectedEnterpriseName'))
    expect(excel).toContain('JOURNAL DES POINTAGES')
    expect(excel).toContain('Date;Heure;Matricule;Nom;Prénom;Sens;Zone GPS;Distance;Précision (m);Méthode;Clôture auto;Suspect;Motif suspect;Zone;Latitude;Longitude')
    expect(excel).toContain('journalLignes')
  })

  it('ajoute une colonne « Pointages » au registre des employés', () => {
    const excel = page.slice(page.indexOf('const generateExcel'), page.indexOf('const selectedEnterpriseName'))
    expect(excel).toContain("if (includePointages) headers.push('Pointages')")
    expect(excel).toContain('pointagesParEmploye')
  })

  it('ne met rien dans les documents si la rubrique est décochée', () => {
    expect(page).toContain('includePointages\n        ? construireJournalPointages')
    expect(page).toContain('if (includePointages) {')
  })
})

// ── 5. Le document reste un document ───────────────────────

describe('5. le document se tient', () => {
  it('garde le blason de la page, pas une image', () => {
    const blason = renderToStaticMarkup(<NsibidiBlasonSvg size={48} />)
    expect(blason).toContain('<svg')
    expect(fichierDocument).toContain('export function dessinerBlason')
  })

  it('numérote les pages et rappelle le document', () => {
    const doc = fauxDoc({ pages: 3 })
    expect(doc.internal.getNumberOfPages()).toBe(3)
    expect(fichierDocument).toContain('export function numeroterPages')
    expect(fichierDocument).toContain('Page ${p} / ${pages}')
  })

  it('imprime des encres lisibles, pas des couleurs d’écran', () => {
    // les statuts passent en version papier
    expect(fichierDocument).toContain("rouge: [185, 28, 28]")
    expect(fichierDocument).toContain("ambre: [138, 85, 6]")
    expect(fichierDocument).toContain("vert: [11, 95, 67]")
    // et le fond des graphiques reste du papier
    expect(page).toContain("ctx.fillStyle = '#FBF7EC'")
  })

  it('garde le métier des rapports intact', () => {
    expect(page).toContain('calculateEmployeeStats')
    expect(page).toContain('calculateAbsenceStats')
    expect(page).toContain('filtrerPointagesPayables')
    expect(page).toContain('autoTable(doc, {')
  })
})

// ── 6. La géométrie du document ────────────────────────────

describe('6. la géométrie du document', () => {
  it('répartit les colonnes pour remplir la page, jamais pour la déborder', () => {
    const doc = fauxDoc()
    const utile = largeurUtile(doc)

    // le registre des employés avec ses onze colonnes possibles
    const poids = [1.2, 2.45, 1.62, 0.86, 1.02, 0.92, 0.96, 1.05, 0.9, 0.86, 1.12]
    const colonnes = colonnesProportionnelles(poids, { largeur: utile })
    const somme = Object.values(colonnes).reduce((t, c) => t + c.cellWidth, 0)

    // on remplit la page à un arrondi près, et on ne la dépasse pas
    expect(somme).toBeLessThanOrEqual(utile + 0.05)
    expect(somme).toBeGreaterThan(utile - 1.5)
    expect(Object.keys(colonnes)).toHaveLength(poids.length)
  })

  it('laisse toujours un millimètre de sécurité', () => {
    const doc = fauxDoc()
    expect(largeurUtile(doc)).toBe(210 - MARGES.gauche - MARGES.droite - 1)
    expect(largeurUtile(doc)).toBeLessThan(210 - MARGES.gauche - MARGES.droite)
  })

  it('garde l’alignement demandé pour chaque colonne', () => {
    const colonnes = colonnesProportionnelles([1, 1, 1], {
      largeur: 60,
      halign: ['center', 'left', 'right'],
    })
    expect(colonnes[0]).toEqual({ cellWidth: 20, halign: 'center' })
    expect(colonnes[1]).toEqual({ cellWidth: 20, halign: 'left' })
    expect(colonnes[2]).toEqual({ cellWidth: 20, halign: 'right' })
  })

  it('ne coupe pas un titre de colonne en deux', () => {
    const style = stylesTableau(DOC.terre)
    expect(style.headStyles.overflow).toBe('visible')
    expect(style.headStyles.fontSize).toBeLessThanOrEqual(7)
  })
})

// ── 7. Les annexes ne gaspillent pas de feuille ────────────

describe('7. les annexes s’enchaînent', () => {
  it('garde la page courante quand la place suffit', () => {
    const doc = fauxDoc()
    const y = ajouterPageDetail(doc, {
      titre: 'Détail des jours fériés',
      accent: DOC.violet,
      tete: ['Date', 'Nom'],
      lignes: [['01/11/2026', 'Toussaint'], ['25/12/2026', 'Noël']],
      colonnes: colonnesProportionnelles([1, 2], { largeur: 120 }),
      continuer: true,
      y: 120,
      hauteurEstimee: 30,
    })
    // aucune page ajoutée : l'annexe se pose sous le registre
    expect(doc.appels.some(a => a[0] === 'nouvelle-page')).toBe(false)
    expect(y).toBeGreaterThan(120)
  })

  it('ouvre une page quand il n’y a plus de place', () => {
    const doc = fauxDoc()
    ajouterPageDetail(doc, {
      titre: 'Journal des pointages',
      accent: DOC.terre,
      tete: ['Date', 'Nom'],
      lignes: [['01/11/2026', 'Toussaint']],
      colonnes: colonnesProportionnelles([1, 2], { largeur: 120 }),
      continuer: true,
      y: 268,
      hauteurEstimee: 40,
    })
    expect(doc.appels.some(a => a[0] === 'nouvelle-page')).toBe(true)
  })

  it('imprime le pied en encre lisible, pas en craie pâle', () => {
    const doc = fauxDoc({ pages: 1 })
    numeroterPages(doc, { titre: 'Rapport de pointage', entreprise: 'Kandi SARL' })
    const encre = doc.appels.filter(a => a[0] === 'text-color' && a[1] === DOC.encreDouce[0] && a[2] === DOC.encreDouce[1])
    expect(encre.length).toBeGreaterThan(0)
    expect(textes(doc).some(t => t.includes('Page 1 / 1'))).toBe(true)
  })
})
