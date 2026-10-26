// ═══════════════════════════════════════════════════════════
// ✍️ LES DOCUMENTS DES RAPPORTS — l'identité exportée
//
// Le PDF, le PDF graphique et le tableur sortent désormais de la
// même matière que la page : indigo, craie, terre. Pas de dégradé
// orange sur fond anthracite : une bande d'indigo en tête, des
// signes nsibidi tracés au trait, des registres bordés de filets.
//
// ⚠️ Sur papier, l'indigo devient une bande et le fond reste
//    blanc : on n'imprime pas l'écran. Les encres de statut sont
//    celles du thème clair du produit, lisibles à l'impression.
//
// ⚠️ Ce fichier ne décide de rien : il dessine ce qu'on lui donne.
//    `construireJournalPointages` est pur — c'est lui qui range
//    les pointages bruts, et c'est lui qu'on teste sans jsPDF.
// ═══════════════════════════════════════════════════════════

import autoTable from 'jspdf-autotable'
import { texteImprimable } from './textePdf'

// ── La palette imprimée ────────────────────────────────────

export const DOC = {
  indigo: [16, 28, 40],
  indigoFonce: [10, 18, 25],
  indigoClair: [23, 41, 58],
  craie: [242, 232, 213],
  craieDouce: [201, 194, 176],
  craieFaible: [147, 162, 174],
  terre: [180, 98, 42],
  brun: [139, 62, 29],

  encre: [22, 34, 44],
  encreDouce: [59, 74, 85],
  filet: [222, 212, 190],
  bande: [247, 242, 230],
  papier: [255, 255, 255],

  // les états du produit, en version lisible sur papier clair
  rouge: [185, 28, 28],
  ambre: [138, 85, 6],
  vert: [11, 95, 67],
  indigoTexte: [67, 56, 202],
  violet: [109, 40, 217],
}

export const MARGES = { gauche: 14, droite: 14 }

const LARGEUR_PAGE = 210
const HAUTEUR_PAGE = 297

// ── Les signes, tracés au trait ────────────────────────────
// Les mêmes que la frise de la page, réduits à ce que jsPDF
// sait faire sans image : des lignes, des cercles, des rectangles.

function signeFleche(doc, x, y, t) {
  doc.line(x - t / 2, y, x + t / 2, y)
  doc.line(x - t / 2, y, x - t / 4, y - t / 6)
  doc.line(x - t / 2, y, x - t / 4, y + t / 6)
  doc.line(x + t / 2, y, x + t / 4, y - t / 6)
  doc.line(x + t / 2, y, x + t / 4, y + t / 6)
}

function signeEchelle(doc, x, y, t) {
  doc.line(x - t / 5, y - t / 2, x - t / 5, y + t / 2)
  doc.line(x + t / 5, y - t / 2, x + t / 5, y + t / 2)
  for (const dy of [-t / 3, 0, t / 3]) doc.line(x - t / 5, y + dy, x + t / 5, y + dy)
}

function signeCroix(doc, x, y, t) {
  const e = t / 2.6
  doc.line(x - e, y - e, x + e, y + e)
  doc.line(x + e, y - e, x - e, y + e)
}

function signeCercle(doc, x, y, t) {
  doc.circle(x, y, t / 3, 'S')
  doc.line(x - t / 3, y, x + t / 3, y)
}

function signeZigzag(doc, x, y, t) {
  const pas = t / 5
  let cx = x - t / 2
  let haut = true
  for (let i = 0; i < 5; i += 1) {
    doc.line(cx, y + (haut ? t / 5 : -t / 5), cx + pas, y + (haut ? -t / 5 : t / 5))
    cx += pas
    haut = !haut
  }
}

function signeDamier(doc, x, y, t) {
  const c = t / 3
  doc.rect(x - t / 2, y - t / 2, t, t, 'S')
  doc.rect(x - t / 2, y - t / 2, c, c, 'F')
  doc.rect(x - t / 2 + c, y - t / 2 + c, c, c, 'F')
  doc.rect(x - t / 2 + 2 * c, y - t / 2, c, c, 'F')
  doc.rect(x - t / 2, y - t / 2 + 2 * c, c, c, 'F')
}

const SIGNES = [signeFleche, signeEchelle, signeCroix, signeZigzag, signeCercle, signeDamier]

/** Une frise de signes, de craie sur indigo (ou d'encre sur papier). */
export function dessinerFriseDeSignes(doc, {
  x = MARGES.gauche,
  y = 12,
  largeur = 70,
  taille = 6,
  couleur = DOC.craieFaible,
} = {}) {
  const pas = largeur / SIGNES.length
  doc.setDrawColor(...couleur)
  doc.setFillColor(...couleur)
  doc.setLineWidth(0.35)
  SIGNES.forEach((signe, i) => {
    signe(doc, x + pas * (i + 0.5), y, taille)
  })
}

/** Le blason : quatre signes autour d'un sceau, comme sur la page. */
export function dessinerBlason(doc, { x = MARGES.gauche, y = 9, taille = 16 } = {}) {
  doc.setFillColor(...DOC.indigoClair)
  doc.setDrawColor(...DOC.craie)
  doc.setLineWidth(0.4)
  doc.rect(x, y, taille, taille, 'FD')

  // la croix de craie
  doc.setDrawColor(...DOC.craieDouce)
  doc.setLineWidth(0.15)
  doc.line(x + taille / 2, y, x + taille / 2, y + taille)
  doc.line(x, y + taille / 2, x + taille, y + taille / 2)

  doc.setDrawColor(...DOC.craie)
  doc.setFillColor(...DOC.craie)
  doc.setLineWidth(0.3)
  signeFleche(doc, x + taille * 0.27, y + taille * 0.27, taille * 0.26)
  signeEchelle(doc, x + taille * 0.73, y + taille * 0.73, taille * 0.3)
  signeCercle(doc, x + taille * 0.73, y + taille * 0.27, taille * 0.3)

  doc.setFillColor(...DOC.terre)
  doc.circle(x + taille / 2, y + taille / 2, 0.9, 'F')
}

// ── La bande de tête ───────────────────────────────────────

/**
 * Dessine la bande d'indigo en haut de la première page.
 * Renvoie l'ordonnée où le contenu peut commencer.
 */
export function dessinerEntete(doc, {
  titre = 'Rapport de pointage',
  sousTitre = 'En-Check · les registres de craie',
  periode = '',
  entreprise = '',
  complement = '',
} = {}) {
  const largeur = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : LARGEUR_PAGE

  //  Ce que la police ne sait pas dessiner ne part pas dans le document :
  //  une flèche entre deux dates sortait en « !’ ».
  titre = texteImprimable(titre)
  sousTitre = texteImprimable(sousTitre)
  periode = texteImprimable(periode)
  entreprise = texteImprimable(entreprise)
  complement = texteImprimable(complement)

  doc.setFillColor(...DOC.indigo)
  doc.rect(0, 0, largeur, 42, 'F')
  doc.setFillColor(...DOC.terre)
  doc.rect(0, 41.2, largeur, 1.2, 'F')

  dessinerBlason(doc, { x: MARGES.gauche, y: 9, taille: 17 })

  doc.setTextColor(...DOC.craieDouce)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.text(sousTitre.toUpperCase(), MARGES.gauche + 23, 13, { charSpace: 0.45 })

  doc.setTextColor(...DOC.craie)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(titre, MARGES.gauche + 23, 21.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DOC.craie)
  if (periode) doc.text(periode, MARGES.gauche + 23, 29)

  doc.setFontSize(8)
  doc.setTextColor(...DOC.craieDouce)
  if (entreprise) doc.text(entreprise, MARGES.gauche + 23, 34.5)
  if (complement) doc.text(complement, MARGES.gauche + 23, 38.5)

  dessinerFriseDeSignes(doc, { x: largeur - 92, y: 16, largeur: 74, taille: 7, couleur: DOC.craieFaible })

  return 50
}

// ── Le cartouche du résumé ─────────────────────────────────

/**
 * Le registre de tête : des couples libellé / valeur, sur trois
 * colonnes, dans un panneau bordé de filets.
 */
export function dessinerResume(doc, { y = 50, entrees = [], titre = 'Résumé de la période' } = {}) {
  if (!entrees.length) return y
  titre = texteImprimable(titre)
  entrees = entrees.map(e => ({
    ...e,
    label: texteImprimable(e.label),
    valeur: texteImprimable(e.valeur),
  }))

  const largeur = (doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : LARGEUR_PAGE) - MARGES.gauche - MARGES.droite
  const colonnes = 3
  const lignes = Math.ceil(entrees.length / colonnes)
  const hauteurLigne = 11
  const hauteur = 8 + lignes * hauteurLigne

  // le panneau
  doc.setFillColor(...DOC.bande)
  doc.setDrawColor(...DOC.filet)
  doc.setLineWidth(0.3)
  doc.rect(MARGES.gauche, y, largeur, hauteur, 'FD')

  // le liseré de terre
  doc.setFillColor(...DOC.terre)
  doc.rect(MARGES.gauche, y, 2.2, hauteur, 'F')

  // le titre
  doc.setTextColor(...DOC.encreDouce)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(titre.toUpperCase(), MARGES.gauche + 6, y + 5.4)

  // les couples
  entrees.forEach(({ label, valeur, accent }, i) => {
    const colonne = i % colonnes
    const ligne = Math.floor(i / colonnes)
    const x = MARGES.gauche + 6 + colonne * ((largeur - 8) / colonnes)
    const dy = y + 10.5 + ligne * hauteurLigne

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.6)
    doc.setTextColor(...DOC.encreDouce)
    doc.text(String(label).toUpperCase(), x, dy)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...(accent || DOC.encre))
    doc.text(String(valeur), x, dy + 4.6)
  })

  // les séparateurs verticaux
  doc.setDrawColor(...DOC.filet)
  doc.setLineWidth(0.2)
  for (let c = 1; c < colonnes; c += 1) {
    const x = MARGES.gauche + 4 + c * ((largeur - 8) / colonnes)
    doc.line(x, y + 3, x, y + hauteur - 3)
  }

  return y + hauteur + 6
}

// ── Les titres de section ──────────────────────────────────

/** Un petit carré de terre, un titre, un filet : comme sur la page. */
export function dessinerTitreSection(doc, texte, y, accent = DOC.terre) {
  texte = texteImprimable(texte)
  const largeur = (doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : LARGEUR_PAGE) - MARGES.gauche - MARGES.droite

  doc.setFillColor(...accent)
  doc.rect(MARGES.gauche, y - 2.8, 2.6, 2.6, 'F')

  doc.setTextColor(...DOC.encre)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(texte.toUpperCase(), MARGES.gauche + 5, y)

  doc.setDrawColor(...DOC.filet)
  doc.setLineWidth(0.3)
  doc.line(MARGES.gauche, y + 2.4, MARGES.gauche + largeur, y + 2.4)

  return y + 8
}

// ── Les colonnes ───────────────────────────────────────────

/**
 * La largeur utile entre les deux marges, en millimètres.
 * On retire un millimètre de sécurité : une colonne ne doit jamais
 * venir toucher le bord, même arrondie au centième.
 */
export function largeurUtile(doc) {
  const page = doc?.internal?.pageSize?.getWidth ? doc.internal.pageSize.getWidth() : LARGEUR_PAGE
  return page - MARGES.gauche - MARGES.droite - 1
}

/**
 * Répartit des largeurs proportionnelles qui remplissent exactement
 * la page. Un tableau ne déborde jamais à droite : c'est la somme
 * des colonnes qui décide, pas une largeur écrite à la main.
 */
export function colonnesProportionnelles(poids, { largeur = LARGEUR_PAGE - MARGES.gauche - MARGES.droite, halign = [] } = {}) {
  const total = poids.reduce((a, b) => a + b, 0) || 1
  return poids.reduce((acc, p, i) => {
    acc[i] = {
      cellWidth: Math.round(((p / total) * largeur) * 100) / 100,
      ...(halign[i] ? { halign: halign[i] } : {}),
    }
    return acc
  }, {})
}

// ── Les tableaux ───────────────────────────────────────────

/**
 * Nettoie le texte d'une cellule. Branché deux fois : à la composition
 * (`didParseCell`) et au moment de peindre (`willDrawCell`), pour qu'un
 * tableau qui pose son propre `didParseCell` — les couleurs de retard,
 * par exemple — ne puisse pas laisser passer de charabia.
 */
export function nettoyerCellule(data) {
  if (Array.isArray(data?.cell?.text)) {
    data.cell.text = data.cell.text.map(texteImprimable)
  }
}

/** Le contrat de style commun à tous les registres du document. */
export function stylesTableau(accent = DOC.terre) {
  return {
    margin: { left: MARGES.gauche, right: MARGES.droite },
    theme: 'plain',
    headStyles: {
      fillColor: DOC.indigo,
      textColor: DOC.craie,
      fontStyle: 'bold',
      fontSize: 6.9,
      cellPadding: { top: 3, right: 1.7, bottom: 3, left: 1.7 },
      lineWidth: 0,
      // un titre de colonne ne se coupe pas en deux : « Jours » reste « Jours »
      overflow: 'visible',
    },
    bodyStyles: {
      fontSize: 7.4,
      cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 },
      textColor: DOC.encre,
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: DOC.bande },
    styles: { overflow: 'linebreak', font: 'helvetica' },
    // le filet de terre sous la ligne de tête, un trait de craie entre les lignes
    didParseCell: nettoyerCellule,
    //  Et au moment de peindre : un tableau qui pose ses propres couleurs
    //  (didParseCell) ne peut pas laisser passer de charabia pour autant.
    willDrawCell: nettoyerCellule,
    didDrawCell: (data) => {
      if (data.section === 'head' && data.row.index === 0) {
        data.doc.setFillColor(...accent)
        data.doc.rect(data.cell.x, data.cell.y + data.cell.height - 0.6, data.cell.width, 0.6, 'F')
      }
      if (data.section === 'body') {
        data.doc.setDrawColor(...DOC.filet)
        data.doc.setLineWidth(0.2)
        data.doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        )
      }
    },
  }
}

/**
 * Une annexe : bande compacte, titre de section, tableau.
 *
 * `continuer` garde la page courante quand il reste de la place —
 * deux petites annexes tiennent alors sur la même feuille au lieu
 * d'en gaspiller deux.
 *
 * Renvoie l'ordonnée finale.
 */
export function ajouterPageDetail(doc, {
  titre,
  sousTitre = '',
  accent = DOC.terre,
  tete = [],
  lignes = [],
  colonnes = {},
  continuer = false,
  y = null,
  hauteurEstimee = null,
} = {}) {
  titre = texteImprimable(titre)
  sousTitre = texteImprimable(sousTitre)
  tete = tete.map(texteImprimable)
  lignes = lignes.map(ligne => (Array.isArray(ligne) ? ligne.map(texteImprimable) : ligne))

  const besoin = hauteurEstimee ?? (26 + Math.min(lignes.length, 6) * 7)

  if (continuer && y !== null && y + besoin < 272) {
    const debut = dessinerTitreSection(doc, titre, y, accent)
    if (sousTitre) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...DOC.encreDouce)
      doc.text(sousTitre, MARGES.gauche + 1, debut - 1)
      autoTable(doc, {
        startY: debut + 4,
        head: [tete],
        body: lignes,
        columnStyles: colonnes,
        ...stylesTableau(accent),
      })
    } else {
      autoTable(doc, {
        startY: debut,
        head: [tete],
        body: lignes,
        columnStyles: colonnes,
        ...stylesTableau(accent),
      })
    }
    return doc.lastAutoTable ? doc.lastAutoTable.finalY : debut
  }

  doc.addPage()

  const largeur = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : LARGEUR_PAGE

  doc.setFillColor(...DOC.indigo)
  doc.rect(0, 0, largeur, 24, 'F')
  doc.setFillColor(...accent)
  doc.rect(0, 23.4, largeur, 0.9, 'F')

  dessinerBlason(doc, { x: MARGES.gauche, y: 4.5, taille: 12 })

  doc.setTextColor(...DOC.craie)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(titre, MARGES.gauche + 17, 12)

  if (sousTitre) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.4)
    doc.setTextColor(...DOC.craieDouce)
    doc.text(sousTitre, MARGES.gauche + 17, 17)
  }

  dessinerFriseDeSignes(doc, { x: largeur - 74, y: 12, largeur: 56, taille: 5.6, couleur: DOC.craieFaible })

  autoTable(doc, {
    startY: 32,
    head: [tete],
    body: lignes,
    columnStyles: colonnes,
    ...stylesTableau(accent),
  })

  return doc.lastAutoTable ? doc.lastAutoTable.finalY : 32
}

// ── Le journal des pointages ───────────────────────────────

const SENS = { in: 'Entrée', out: 'Sortie' }
const METHODES = {
  gps: 'GPS',
  face: 'Visage',
  nfc: 'NFC',
  qr: 'QR',
  manual: 'Manuel',
  editor: 'Corrigé',
  import: 'Import',
}

/** L'heure locale d'un pointage, en HH:MM. */
export function heurePointage(checkTime) {
  if (!checkTime) return '—'
  const date = new Date(checkTime)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Le jour d'un pointage, en JJ/MM/AAAA. */
export function jourPointage(checkTime) {
  if (!checkTime) return '—'
  const date = new Date(checkTime)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Range les pointages bruts, dans l'ordre du temps, avec le nom de
 * l'employé et celui de la zone. Fonction pure : aucune requête,
 * aucune impression — c'est ici qu'on vérifie le tri et les trous.
 */
export function construireJournalPointages({
  attendances = [],
  employees = [],
  geofencesById = {},
  entreprisesById = {},
} = {}) {
  const employesParId = new Map()
  employees.forEach((e) => {
    employesParId.set(e.id, e)
  })

  return (Array.isArray(attendances) ? [...attendances] : [])
    .filter(Boolean)
    .sort((a, b) => new Date(a.check_time) - new Date(b.check_time))
    .map((a) => {
      const employe = employesParId.get(a.employee_id) || {}
      const nom = `${employe.first_name || ''} ${employe.last_name || ''}`.trim()
      const type = String(a.check_type || '').toLowerCase()

      return {
        id: a.id,
        iso: a.check_time,
        date: jourPointage(a.check_time),
        heure: heurePointage(a.check_time),
        matricule: employe.matricule || '—',
        employe: nom || 'Employé inconnu',
        prenom: employe.first_name || '',
        nom: employe.last_name || '',
        sens: SENS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '—'),
        type,
        zone: a.geofence_id ? (geofencesById[a.geofence_id] || 'Zone inconnue') : 'Hors zone',
        dansZone: a.is_within_zone === true ? 'Dans' : a.is_within_zone === false ? 'Hors' : '—',
        distance: a.distance_meters === null || a.distance_meters === undefined ? '—' : `${Math.round(a.distance_meters)} m`,
        methode: METHODES[String(a.method || '').toLowerCase()] || a.method || '—',
        autoCloture: a.is_auto_closed ? 'Oui' : 'Non',
        suspect: a.suspect ? 'Oui' : 'Non',
        motifSuspect: a.suspect_reason || '',
        latitude: a.location_lat ?? '',
        longitude: a.location_lng ?? '',
        precision: a.gps_accuracy ?? '',
        entreprise: entreprisesById[a.enterprise_id] || '',
      }
    })
}

/**
 * L'annexe « Journal des pointages » : une page par lots de lignes,
 * avec un rappel du total en tête de section.
 */
export function ajouterJournalPointages(doc, {
  lignes = [],
  periode = '',
  entreprise = '',
} = {}) {
  if (!lignes.length) return null

  const corps = lignes.map((l) => [
    l.date,
    l.heure,
    l.matricule,
    l.employe,
    l.sens,
    l.dansZone,
    l.distance,
    l.methode,
  ])

  const tete = ['Date', 'Heure', 'Matricule', 'Employé', 'Sens', 'Zone', 'Distance', 'Méthode']
  const colonnes = {
    0: { cellWidth: 20, halign: 'left' },
    1: { cellWidth: 14, halign: 'center' },
    2: { cellWidth: 22, halign: 'left' },
    3: { cellWidth: 54, halign: 'left' },
    4: { cellWidth: 18, halign: 'left' },
    5: { cellWidth: 16, halign: 'center' },
    6: { cellWidth: 20, halign: 'right' },
    7: { cellWidth: 18, halign: 'left' },
  }

  const sousTitre = `${lignes.length} pointage${lignes.length > 1 ? 's' : ''}${periode ? ` · ${periode}` : ''}${entreprise ? ` · ${entreprise}` : ''}`

  const fin = ajouterPageDetail(doc, {
    titre: 'Journal des pointages',
    sousTitre,
    accent: DOC.terre,
    tete,
    lignes: corps,
    colonnes,
  })

  return fin
}

// ── Le pied de page, sur toutes les pages ──────────────────

/** Numérote chaque page et rappelle de quel document il s'agit. */
export function numeroterPages(doc, { titre = 'Rapport de pointage', entreprise = '', periode = '' } = {}) {
  titre = texteImprimable(titre)
  entreprise = texteImprimable(entreprise)
  periode = texteImprimable(periode)
  const pages = doc.internal.getNumberOfPages()
  const largeur = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : LARGEUR_PAGE

  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p)

    doc.setDrawColor(...DOC.filet)
    doc.setLineWidth(0.3)
    doc.line(MARGES.gauche, HAUTEUR_PAGE - 14, largeur - MARGES.droite, HAUTEUR_PAGE - 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...DOC.encreDouce)
    const gauche = [ 'En-Check', titre, entreprise ].filter(Boolean).join(' · ')
    doc.text(gauche, MARGES.gauche, HAUTEUR_PAGE - 9.5)

    doc.text(periode, largeur / 2, HAUTEUR_PAGE - 9.5, { align: 'center' })

    doc.text(`Page ${p} / ${pages}`, largeur - MARGES.droite, HAUTEUR_PAGE - 9.5, { align: 'right' })

    // deux signes de craie, discrets, au-dessus du filet
    doc.setDrawColor(...DOC.filet)
    doc.setLineWidth(0.25)
    signeFleche(doc, largeur - MARGES.droite - 22, HAUTEUR_PAGE - 17.5, 5)
    signeCercle(doc, largeur - MARGES.droite - 12, HAUTEUR_PAGE - 17.5, 5)
  }
}
