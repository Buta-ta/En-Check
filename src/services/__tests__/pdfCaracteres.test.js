// ═══════════════════════════════════════════════════════════
// 🖨️ CE QUE LE PDF PEUT RÉELLEMENT IMPRIMER
//
// jsPDF écrit ses polices standard en WinAnsi (cp1252). Un caractère
// hors de ce jeu ne lève aucune erreur : il sort en bouillie. Une
// flèche « → » dans une cellule de période est ainsi devenue « !’ »
// au milieu d'une date, dans l'annexe « Bulletins et paiements ».
//
// Ces tests lisent la source des documents et refusent tout caractère
// que la police ne sait pas écrire — les commentaires exceptés, ils ne
// s'impriment jamais.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import jsPDF from 'jspdf'
import { texteImprimable, estImprimable } from '../../utils/textePdf.js'

//  Le faux autoTable enregistre ce qu'on lui donne à peindre : c'est là
//  que se voit un caractère que la police ne saurait pas dessiner.
const recu = vi.hoisted(() => ({ tableaux: [] }))
vi.mock('jspdf-autotable', () => ({
  default: (doc, options) => {
    recu.tableaux.push({ tete: options.head?.[0] ?? [], lignes: options.body ?? [] })
    doc.lastAutoTable = { finalY: 120 }
  },
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

// Les caractères que WinAnsi sait écrire : le latin-1, plus les
// ponctuations typographiques françaises (’ « » — … € œ).
const IMPRIMABLE = /[^\u0000-\u00ff\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/u

/** Retire les commentaires : ils ne partent pas dans le document. */
const sansCommentaires = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('//'))
    .join('\n')

const coupures = (source, debut, fin) => {
  const a = source.indexOf(debut)
  const b = source.indexOf(fin, a + 1)
  if (a < 0 || b < 0) throw new Error(`Section introuvable : ${debut} → ${fin}`)
  return source.slice(a, b)
}

const SIGNES_FAUTIFS = (source) => {
  const trouves = new Set()
  for (const ligne of sansCommentaires(source).split('\n')) {
    for (const signe of ligne) {
      if (IMPRIMABLE.test(signe)) trouves.add(signe)
    }
  }
  return [...trouves]
}

describe('1. les textes du document partent en WinAnsi', () => {
  it('aucun caractère illisible dans les outils du document', () => {
    const source = sansCommentaires(lire('src/utils/documentsRapports.js'))
    expect(SIGNES_FAUTIFS(source)).toEqual([])
  })

  it('aucun caractère illisible dans les annexes et le registre', () => {
    const page = lire('src/pages/Rapports.jsx')
    const aide = coupures(page, 'const construireLigneEmploye', 'const loadPreview = async')
    expect(SIGNES_FAUTIFS(aide)).toEqual([])
  })

  it('aucun caractère illisible dans les trois exports', () => {
    const page = lire('src/pages/Rapports.jsx')
    const exportsTexte = coupures(page, 'const generateGraphicalPDF = async', 'const selectedEnterpriseName = useMemo')
    expect(SIGNES_FAUTIFS(exportsTexte)).toEqual([])
  })

  it('les accents et les guillemets français restent permis', () => {
    const permis = 'Présence brute · Pauses déduites — « Dossier de présence » · l’employé d’œuvre · 12 € · … → non'
    // la flèche est justement ce qui ne passe pas
    expect(SIGNES_FAUTIFS(permis)).toEqual(['→'])
  })
})

describe('2. le filet de sécurité', () => {
  it('retire ce que la police ne sait pas écrire, et rien d’autre', () => {
    // ce qui sortait en bouillie : une flèche devient un tiret, un émoji s'en va
    expect(texteImprimable('01/09/2026 → 30/09/2026')).toBe('01/09/2026 - 30/09/2026')
    expect(texteImprimable('⚠️ Barème à vérifier')).toBe('Barème à vérifier')
    expect(texteImprimable('08:02 − 17:04')).toBe('08:02 - 17:04')
    //  Ọ perd son point souscrit, á garde son accent : rien d'autre ne bouge
    expect(texteImprimable('Ọlá Kɔssi Ɛlisa')).toBe('Olá Kossi Elisa')
    expect(texteImprimable('東京')).toBe('')
    // ce qui doit rester intact
    const francais = 'Présence brute · Pauses déduites — « dossier » · l’employé d’œuvre · 12 € · …'
    expect(texteImprimable(francais)).toBe(francais)
    expect(texteImprimable(null)).toBe('')
    expect(texteImprimable(undefined)).toBe('')
    expect(texteImprimable(75)).toBe('75')
  })

  it('dit si un texte passerait tel quel', () => {
    expect(estImprimable('Awa Koné · EMP-004 — payé le 12/09')).toBe(true)
    expect(estImprimable('08:02 → 17:04')).toBe(false)
    expect(estImprimable(null)).toBe(true)
  })

  it('nettoie tout ce qui entre dans un document', () => {
    const outils = lire('src/utils/documentsRapports.js')
    // l'en-tête, le résumé, les annexes, les tableaux et le pied de page
    expect(outils).toContain('titre = texteImprimable(titre)')
    expect(outils).toContain('label: texteImprimable(e.label)')
    expect(outils).toContain('tete = tete.map(texteImprimable)')
    expect(outils).toContain('data.cell.text = data.cell.text.map(texteImprimable)')
    //  et au moment de peindre, pour les tableaux qui écrasent didParseCell
    expect(outils).toContain('willDrawCell: nettoyerCellule')
  })

  it('rien d’illisible n’atteint la page, même dans une annexe', async () => {
    const { DOC, dessinerEntete, ajouterPageDetail } = await import('../../utils/documentsRapports.js')
    recu.tableaux.length = 0

    const doc = new jsPDF()
    const ecrits = []
    const origine = doc.text.bind(doc)
    doc.text = (texte, ...reste) => {
      ecrits.push(String(texte))
      return origine(texte, ...reste)
    }

    dessinerEntete(doc, {
      titre: 'Dossier → présence',
      sousTitre: 'En-Check · ⚠️ test',
      periode: '1 → 31 octobre 2026',
      entreprise: 'Kandi SARL ✅',
      complement: 'Ọlá Kɔssi — ⏱ 42 h',
    })

    ajouterPageDetail(doc, {
      titre: 'Bulletins → paiements',
      sousTitre: '3 bulletins · ⚠️ non payés',
      accent: DOC.vert,
      tete: ['Employé', 'Période'],
      lignes: [['Awa Koné', '01/09/2026 → 30/09/2026'], ['Ọlá Kɔssi', '01/10/2026 − 31/10/2026']],
      colonnes: {},
    })

    //  Tout ce qui est allé sur la page est imprimable tel quel.
    expect(ecrits.filter(t => !estImprimable(t))).toEqual([])
    const cellules = recu.tableaux.flatMap(t => [...t.tete, ...t.lignes.flat()])
    expect(cellules.filter(t => !estImprimable(t))).toEqual([])
    expect(cellules).toContain('01/09/2026 - 30/09/2026')
    expect(cellules).toContain('Olá Kossi')
  })

  it('un tableau qui pose ses propres couleurs reste propre', async () => {
    const { stylesTableau } = await import('../../utils/documentsRapports.js')
    const style = stylesTableau()
    const cellule = { cell: { text: ['08:02 → 17:04', '⚠️ en retard'] } }
    //  willDrawCell s'applique même quand l'appelant a écrasé didParseCell
    style.willDrawCell(cellule)
    expect(cellule.cell.text).toEqual(['08:02 - 17:04', 'en retard'])
  })

  it('le bulletin de paie ne sort plus d’émoji en bouillie', () => {
    const service = lire('src/services/payrollService.js')
    expect(service).toContain('texteImprimable(provisionalWarning)')
  })
})

describe('3. la période d’un bulletin s’écrit en toutes lettres', () => {
  it('dit « du … au … », jamais une flèche', () => {
    const page = lire('src/pages/Rapports.jsx')
    const annexe = coupures(page, 'const ajouterAnnexePaie', 'const loadPreview = async')
    expect(annexe).toContain('} au ${formatDateFr(l.paie.periodEnd)}')
    expect(annexe).not.toContain('→')
  })
})
