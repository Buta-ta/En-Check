// ═══════════════════════════════════════════════════════════
// ✍️ LA SIGNATURE NSIBIDI DU DOCUMENT — page Rapports
//
// 29/11 : la bande de la page est passée au BOGOLAN (« remplace le bandeau
// motif actuel par le bandeau bogolan »). Ce fichier ne défend plus la peau de
// l'écran — c'est le procès de `rapportsBogolan.test.jsx` — mais ce qui reste
// nsibidi malgré tout :
//   ① le dessin de la maison, intact : frise de neuf tuiles, blason, signes ;
//   ② le blason en tête de la page ET en tête du PDF : la signature du
//     document ne se confond pas avec le tissu de la page ;
//   ③ le métier des rapports, intouchable : mêmes requêtes, mêmes calculs,
//     mêmes trois exports ;
//   ④ les rubriques restent des sceaux dessinés, pas des cases natives ;
//   ⑤ la poche : le pli n'a pas été mangé par l'enveloppe d'étoffe.
// ═══════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import { NsibidiBlasonSvg, NsibidiFriseSvg } from '../../components/NsibidiSvg'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/Rapports.jsx')
const css = lire('src/pages/Rapports.css')
const frise = lire('src/components/NsibidiSvg.jsx')
const partage = lire('src/components/PageCulturalBand.css')

// ── 1. Le motif ────────────────────────────────────────────

describe('1. le motif nsibidi', () => {
  it('n’est plus la bande de la page, mais reste le motif dessiné', () => {
    //  la BANDE est au bogolan (29/11) — la loi en est à `rapportsBogolan` ;
    //  ce fichier vérifie seulement que le nsibidi n'a pas été effacé du projet
    expect(culturalMotifForPath('/rapports')).toBe('bogolan')
    expect(culturalMotifForPath('/rapports?periode=mois')).toBe('bogolan')
    expect(culturalMotifForPath('/rapports?vue=mois')).toBe('bogolan')
    // les autres pages gardent leur identité
    expect(culturalMotifForPath('/carte-temps-reel')).toBe('dogon')
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
    expect(culturalMotifForPath('/admins')).toBe('abomey')
    // et une page sans motif propre retombe sur le Kente
    expect(culturalMotifForPath('/une-page-sans-motif')).toBe('kente')
  })

  it('est dessiné en SVG, une frise de neuf tuiles', () => {
    //  le composant de frise se rend toujours, même si plus aucune bande de
    //  page ne l'appelle : le dessin reste un actif du projet, pas un vestige
    const rendu = renderToStaticMarkup(<NsibidiFriseSvg />)
    expect(rendu).toContain('aria-hidden="true"')
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

  it('a laissé ses hauteurs de bande dans la feuille partagée', () => {
    //  la base de toutes les bandes reste 76 / 32 px — le bogolan les prend
    //  sans rien redéclarer, c'est ce qui a rendu les règles nsibidi inutiles
    expect(partage).toMatch(/\.ec-cultural-band\s*\{[^}]*height:\s*76px/)
    expect(partage).toMatch(/\.ec-cultural-bottom\s*\{\s*height:\s*32px/)
    //  et la feuille ne traîne plus les quatre règles d'une identité qu'aucune
    //  route ne demande : un CSS que plus personne ne lit est une dette
    expect(partage).not.toMatch(/data-cultural-motif='nsibidi'/)
    expect(partage).toContain('NSIBIDI — la page Rapports a pris le bogolan')
  })
})

// ── 2. La page ─────────────────────────────────────────────

describe('2. la page : ce que le changement de tissu ne doit pas emporter', () => {
  it('ne pose plus une seule règle de style dans le JSX', () => {
    expect(page).not.toContain('<style>')
    expect(page).not.toMatch(/\bstyle=\{\{/)
    expect(page).not.toMatch(/\bstyle="/)
    expect(page).not.toContain('const S =')
    // l'ancien vocabulaire de classes afro a disparu avec les styles
    expect(page).not.toContain('afro-card')
    expect(page).not.toContain('afro-btn')
  })

  it('garde ses libellés, hors des bandeaux', () => {
    //  le changement de tissu n'a pas fait tourner un mot de la page
    for (const mot of ['Les registres de craie', 'Composer le rapport',
      'Aperçu du rapport', 'Ce que contient le rapport',
      'Télécharger le PDF', 'PDF graphique', 'Télécharger le tableur']) {
      expect(page).toContain(mot)
    }
    //  et le seuil ne promet plus ce que la passe a enlevé
    expect(page).toContain('aria-label="Entreprise et période du rapport"')
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

describe('5. le téléphone', () => {
  it('tient dans une poche, avec son enveloppe d’étoffe', () => {
    expect(css).toContain('@media (max-width: 720px)')
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?font-size:\s*16px/)
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.rp-atelier\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.rp-apercu\s*\{[^}]*position:\s*static/)
    expect(css).toContain('@media (max-width: 460px)')
    //  et le cartouche du haut ne se redéclare pas pour la poche : la cote de
    //  tissu est unique, sinon le tour d'étoffe se défait aux coins
    const mobile = css.slice(css.indexOf('@media (max-width: 650px)'))
    expect(mobile).not.toMatch(/--rp-tissu:/)
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
