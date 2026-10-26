// ═══════════════════════════════════════════════════════════
// ✍️ LES REGISTRES DE CRAIE — la page Rapports
//
// Ce que ces tests gardent :
//   ① le motif de la page est nsibidi, dessiné en SVG et branché
//     sur les deux bandeaux comme sur les autres pages ;
//   ② la page a quitté les styles inline pour une coque dessinée
//     (en-tête gravé, seuil, cartouche, aperçu, marge, pied) ;
//   ③ le métier des rapports n'a pas bougé : mêmes requêtes, mêmes
//     calculs, mêmes trois exports ;
//   ④ les rubriques sont des sceaux dessinés, pas des cases natives ;
//   ⑤ la page suit le thème de l'application et tient en poche.
// ═══════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import PageCulturalBand, { culturalMotifForPath } from '../../components/PageCulturalBand'
import { NsibidiBlasonSvg, NsibidiFriseSvg } from '../../components/NsibidiSvg'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/Rapports.jsx')
const css = lire('src/pages/Rapports.css')
const frise = lire('src/components/NsibidiSvg.jsx')
const partage = lire('src/components/PageCulturalBand.css')

// ── 1. Le motif ────────────────────────────────────────────

describe('1. le motif nsibidi', () => {
  it('devient le motif des Rapports', () => {
    expect(culturalMotifForPath('/rapports')).toBe('nsibidi')
    expect(culturalMotifForPath('/rapports?vue=mois')).toBe('nsibidi')
    // les autres pages gardent leur identité
    expect(culturalMotifForPath('/carte-temps-reel')).toBe('dogon')
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
    expect(culturalMotifForPath('/admins')).toBe('abomey')
    // et une page sans motif propre retombe sur le Kente
    expect(culturalMotifForPath('/une-page-sans-motif')).toBe('kente')
  })

  it('est dessiné en SVG, une frise de neuf tuiles', () => {
    const rendu = renderToStaticMarkup(<PageCulturalBand pathname="/rapports" />)
    expect(rendu).toContain('data-cultural-motif="nsibidi"')
    expect(rendu).toContain('<svg')

    const friseRendue = renderToStaticMarkup(<NsibidiFriseSvg />)
    expect(friseRendue).toContain('viewBox="0 0 2700 120"')
    expect(friseRendue).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(friseRendue).toContain('aria-hidden="true"')
    expect(frise).toContain('NB_TUILES = 9')
    // les neuf tuiles sont bien posées côte à côte, pas empilées
    expect(frise).toContain('translate(${index * TUILE} 0)')
  })

  it('porte les signes de la Cross River', () => {
    for (const signe of ['Fleche', 'Spirale', 'Arc', 'Croix', 'Fougere', 'Echelle', 'Cercle']) {
      expect(frise).toContain(`function ${signe}`)
    }
    // la craie sur l'indigo, pas de gris tiède
    expect(frise).toContain("const INDIGO = '#101c28'")
    expect(frise).toContain("const CRAIE = '#f2e8d5'")
    expect(frise).toContain("const TERRE = '#b4622a'")
  })

  it('a un blason : quatre signes autour du sceau', () => {
    const blason = renderToStaticMarkup(<NsibidiBlasonSvg size={48} />)
    expect(blason).toContain('viewBox="0 0 52 52"')
    expect(blason).toContain('aria-hidden="true"')
    expect(frise).toContain('export function NsibidiBlasonSvg')
    // la frise et le blason sont deux dessins distincts
    expect(frise).toContain('export function NsibidiFriseSvg')
  })

  it('garde les hauteurs communes à toutes les pages', () => {
    expect(partage).toMatch(/\.ec-cultural-band\s*\{[^}]*height:\s*76px/)
    expect(partage).toMatch(/\.ec-cultural-bottom\s*\{\s*height:\s*32px/)
    expect(partage).toMatch(
      /\.ec-cultural-top\[data-cultural-motif='nsibidi'\]\s*\{\s*height:\s*76px/,
    )
    expect(partage).toMatch(
      /@media \(max-width: 650px\)\s*\{[^}]*\.ec-cultural-top\[data-cultural-motif='nsibidi'\]\s*\{\s*height:\s*60px/,
    )
  })
})

// ── 2. La page ─────────────────────────────────────────────

describe('2. la page', () => {
  it('tend la bande haute, la bordure et la bande basse', () => {
    expect(page).toContain('<PageCulturalBand pathname="/rapports" />')
    expect(page).toContain('<PageCulturalBand pathname="/rapports" placement="bottom" />')
    expect(page).toContain('className="rp-bordure"')
    expect(page).toContain('className="rp-pied"')
  })

  it('a un en-tête gravé, avec son blason et son retour', () => {
    expect(page).not.toContain('PageHeader')
    expect(page).toContain('className="rp-entete"')
    expect(page).toContain('<NsibidiBlasonSvg size={48} />')
    expect(page).toContain('Les registres de craie')
    expect(page).toContain('Rapports<span>.</span>')
    expect(page).toContain('aria-label="Revenir au tableau de bord"')
    expect(page).toContain("navigate('/dashboard')")
  })

  it('ne pose plus une seule règle de style dans le JSX', () => {
    expect(page).not.toContain('<style>')
    expect(page).not.toMatch(/\bstyle=\{\{/)
    expect(page).not.toMatch(/\bstyle="/)
    expect(page).not.toContain('const S =')
    // l'ancien vocabulaire de classes afro a disparu avec les styles
    expect(page).not.toContain('afro-card')
    expect(page).not.toContain('afro-btn')
  })

  it('bat la page en seuil, cartouche, aperçu et marge', () => {
    for (const classe of [
      'rp-coque', 'rp-seuil', 'rp-raccourcis', 'rp-cartouche', 'rp-champs',
      'rp-sceaux', 'rp-sceau', 'rp-exports', 'rp-export', 'rp-apercu',
      'rp-mesures', 'rp-mesure', 'rp-marge', 'rp-note',
    ]) {
      expect(css).toContain(`.${classe}`)
    }
    expect(page).toContain('Composer le rapport')
    expect(page).toContain('Aperçu du rapport')
    expect(page).toContain('Ce que contient le rapport')
  })

  it('donne à la page ses raccourcis, comme les autres coques', () => {
    expect(page).toContain('RaccourcisPages compact')
    expect(page).toContain("excludePaths={['/rapports']}")
    expect(css).toContain('.rp-raccourcis .abs-raccourci')
  })
})

// ── 3. La mécanique des rapports ───────────────────────────

describe('3. la mécanique n’a pas bougé', () => {
  it('garde les trois exports et leurs bibliothèques', () => {
    expect(page).toContain("import jsPDF from 'jspdf'")
    expect(page).toContain("import autoTable from 'jspdf-autotable'")
    expect(page).toContain('const generatePDF = async () => {')
    expect(page).toContain('const generateGraphicalPDF = async () => {')
    expect(page).toContain('const generateExcel = async () => {')
  })

  it('garde les requêtes et les calculs', () => {
    expect(page).toContain(".from('employees')")
    expect(page).toContain(".from('attendances')")
    expect(page).toContain('calculateEmployeeStats')
    expect(page).toContain('calculateAbsenceStats')
    expect(page).toContain('fetchReportData')
    expect(page).toContain('loadPreview')
    expect(page).toContain('filtrerPointagesPayables')
  })

  it('garde les cinq rubriques et leurs valeurs d’origine', () => {
    for (const drapeau of [
      'includeRetards', 'includeHeuresSup', 'includeConges',
      'includeAbsences', 'includeHolidays',
      'includeWorkedHolidays', 'includeNonWorkedHolidays',
    ]) {
      expect(page).toContain(drapeau)
    }
    // la rubrique des heures sup reste pilotée par le module de l'entreprise
    expect(page).toContain('hasHeuresSupFeature')
    expect(page).toContain('hasAbsencesFeature')
  })

  it('ouvre l’aperçu au lieu de le promettre', () => {
    expect(page).toContain('previewData')
    expect(page).toContain('totalEmployees')
    expect(page).toContain('totalHeuresTravaillees')
    expect(page).toContain('employesSansPlanningRetards')
    expect(page).toContain('rp-apercu-vide')
  })
})

// ── 4. Les sceaux ──────────────────────────────────────────

describe('4. les sceaux de rubrique', () => {
  it('remplace les cases natives par des boutons nommés', () => {
    expect(page).not.toContain('type="checkbox"')
    expect(page).toContain('className="rp-sceau"')
    expect(page).toContain('aria-pressed={actif}')
    expect(css).toContain(".rp-page .rp-sceau[aria-pressed='true']")
  })

  it('garde les cinq tons de données du produit', () => {
    for (const ton of ['alerte', 'attente', 'ok', 'indigo', 'violet']) {
      expect(css).toContain(`.rp-sceau[data-ton='${ton}']`)
    }
    expect(css).toContain('.rp-sceau:disabled')
  })

  it('laisse les sous-options des fériés apparaître seulement au besoin', () => {
    expect(page).toContain('{includeHolidays && (')
    expect(page).toContain('Fériés travaillés')
    expect(page).toContain('Fériés non travaillés')
    expect(css).toContain('.rp-sous-sceaux')
  })
})

// ── 5. Le thème et la poche ────────────────────────────────

describe('5. le thème et le téléphone', () => {
  it('prend la bascule clair / sombre de l’application', () => {
    expect(page).toContain("import { useTheme } from '../contexts/ThemeContext'")
    expect(page).toContain('const { darkMode, toggleTheme } = useTheme()')
    expect(page).toContain("className={`rp-page${darkMode ? '' : ' rp-clair'}`}")
    expect(page).toContain('className="rp-bascule"')
    expect(page).toContain('role="switch"')
    expect(page).toContain('aria-checked={darkMode}')
  })

  it('dessine le jour, pas seulement un bouton', () => {
    expect(css).toContain('.rp-page.rp-clair')
    expect(css).toMatch(/\.rp-page\.rp-clair\s*\{[^}]*--rp-panneau:\s*#fbf7ec/)
    expect(css).toMatch(/\.rp-page\.rp-clair\s*\{[^}]*--rp-craie:\s*#16222c/)
    expect(css).toMatch(/\.rp-page\.rp-clair\s*\{[^}]*--rp-alerte-texte:\s*#b91c1c/)
  })

  it('tient dans une poche', () => {
    expect(css).toContain('@media (max-width: 720px)')
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?font-size:\s*16px/)
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.rp-atelier\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.rp-apercu\s*\{[^}]*position:\s*static/)
    expect(css).toContain('@media (max-width: 460px)')
  })

  it('garde la page lisible quand on n’a pas d’aperçu', () => {
    expect(css).toContain('.rp-apercu-vide')
    expect(page).toContain('Touchez « Actualiser » pour compter la période.')
  })
})

// ── 6. Le vocabulaire ──────────────────────────────────────

describe('6. le vocabulaire de gestion', () => {
  it('parle d’entreprises et d’employés', () => {
    expect(page).toContain('Toutes les entreprises')
    expect(page).toContain('<span className="rp-seuil-libelle">Entreprise</span>')
    expect(page).not.toContain('Toutes les maisons')
    expect(page).not.toContain('Les gens')
  })

  it('nomme les champs comme des champs', () => {
    expect(page).toContain('Date de début de la période')
    expect(page).toContain('Date de fin de la période')
    expect(page).toContain('Choisir l’entreprise du rapport')
    // plus de titre crié en capitales dans l'en-tête
    expect(page).not.toContain('>RAPPORTS<')
  })
})
