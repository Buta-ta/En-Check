// ═══════════════════════════════════════════════════════════
// 🗿 LA PORTE DU PLATEAU — la Carte en direct
//
// Ce que ces tests gardent :
//   ① le motif de la page est la porte de grenier dogon, et il
//     est branché sur les deux bandeaux comme sur les autres
//     pages (76 px en haut, 32 px en bas, 60 px ailleurs) ;
//   ② la frise est un vrai dessin — trois registres, des
//     ancêtres, des chevrons — pas une image bitmap ;
//   ③ l'en-tête a quitté le bandeau afro pour le panneau gravé,
//     sans perdre le retour au tableau de bord ni la pastille
//     « en direct » ;
//   ④ la carte elle-même n'a pas bougé : Leaflet, les zones, la
//     légende et les données sont intacts.
// ═══════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import PageCulturalBand, { culturalMotifForPath } from '../../components/PageCulturalBand'
import { DogonBlasonSvg, DogonFriseSvg } from '../../components/DogonSvg'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/CarteTempsReel.jsx')
const css = lire('src/pages/CarteTempsReel.css')
const frise = lire('src/components/DogonSvg.jsx')
const partage = lire('src/components/PageCulturalBand.css')

// ── 1. Le motif ────────────────────────────────────────────

describe('1. la porte dogon', () => {
  it('devient le motif de la Carte en direct', () => {
    expect(culturalMotifForPath('/carte-temps-reel')).toBe('dogon')
    expect(culturalMotifForPath('/carte-temps-reel?date=2026-10-25')).toBe('dogon')
    // les autres pages gardent leur identité
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
    expect(culturalMotifForPath('/admins')).toBe('abomey')
    expect(culturalMotifForPath('/planning')).toBe('kuba')
  })

  it('est dessiné en SVG, une frise de neuf tuiles', () => {
    const rendu = renderToStaticMarkup(<PageCulturalBand pathname="/carte-temps-reel" />)
    expect(rendu).toContain('data-cultural-motif="dogon"')
    expect(rendu).toContain('<svg')

    const friseRendue = renderToStaticMarkup(<DogonFriseSvg />)
    expect(friseRendue).toContain('viewBox="0 0 2700 120"')
    expect(friseRendue).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(friseRendue).toContain('aria-hidden="true"')
    expect(frise).toContain('NB_TUILES = 9')
  })

  it('porte les trois registres et les figures qui les remplissent', () => {
    // les primitives du panneau
    for (const primitive of ['Ancetre', 'Spirale', 'Losange', 'Damier', 'Chevrons']) {
      expect(frise).toContain(`function ${primitive}`)
    }
    // deux registres de motifs + deux bordures de chevrons
    const friseRendue = renderToStaticMarkup(<DogonFriseSvg />)
    expect(friseRendue.split('<polyline').length - 1).toBeGreaterThanOrEqual(3)
    // la matière bois : une palette de panneau, pas de gris
    expect(frise).toContain("const BOIS = '#7a5230'")
    expect(frise).toContain("const GRAVURE = '#241c16'")
    expect(frise).toContain("const PATINE = '#e8dcc4'")
  })

  it('garde les hauteurs communes à toutes les pages', () => {
    // 76 px en haut par défaut, 60 px sur téléphone : rien de propre à Dogon
    expect(partage).toMatch(/\.ec-cultural-band\s*\{[^}]*height:\s*76px/)
    expect(partage).toMatch(/\.ec-cultural-bottom\s*\{\s*height:\s*32px/)
    expect(partage).toMatch(
      /@media\s*\(max-width:\s*650px\)\s*\{\s*\.ec-cultural-top\s*\{\s*height:\s*60px/,
    )
    // et la page ne se donne pas de hauteur plus grande
    expect(css).not.toMatch(/ec-cultural-top\[data-cultural-motif='dogon'\][^}]*height:\s*1[0-9]{2}px/)
  })

  it('a un blason : la porte gardée par deux ancêtres', () => {
    const blason = renderToStaticMarkup(<DogonBlasonSvg size={48} />)
    expect(blason).toContain('viewBox="0 0 52 52"')
    expect(blason).toContain('aria-hidden="true"')
    // la porte, son verrou et ses chevrons
    expect(frise).toContain('export function DogonBlasonSvg')
    expect(blason.split('<path').length).toBeGreaterThan(4)
  })
})

// ── 2. La page ─────────────────────────────────────────────

describe('2. la page', () => {
  it('tend la bande haute, la bordure et la bande basse', () => {
    expect(page).toContain('<PageCulturalBand pathname="/carte-temps-reel" />')
    expect(page).toContain('<PageCulturalBand pathname="/carte-temps-reel" placement="bottom" />')
    expect(page).toContain('className="ct-bordure"')
    expect(page).toContain('className="ct-pied"')
  })

  it('a remplacé le bandeau afro par le panneau gravé', () => {
    expect(page).not.toContain('PageHeader')
    expect(page).toContain('className="ct-entete"')
    expect(page).toContain('<DogonBlasonSvg size={48} />')
    expect(page).toContain('La porte du plateau')
    expect(page).toContain('Carte en direct')
    // le retour au tableau de bord reste un bouton nommé
    expect(page).toContain('aria-label="Revenir au tableau de bord"')
    expect(page).toContain("navigate('/dashboard')")
  })

  it('garde la pastille « en direct » et son animation discrète', () => {
    expect(page).toContain('className="ct-direct"')
    expect(css).toContain('@keyframes ct-souffle')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('n’a pas touché au métier de la carte', () => {
    // Leaflet, les clusters, le temps réel et les zones sont intacts
    expect(page).toContain("import L from 'leaflet'")
    expect(page).toContain('leaflet.markercluster')
    expect(page).toContain(".from('attendances')")
    expect(page).toContain(".from('geofences')")
    expect(page).toContain('is_within_zone')
    expect(page).toContain('Légende')
    expect(page).toContain('Ma position')
    // les couleurs de statut restent celles du produit
    for (const couleur of ['#10B981', '#F59E0B', '#EF4444']) {
      expect(page).toContain(couleur)
    }
  })

  it('passe au téléphone', () => {
    expect(css).toContain('@media (max-width: 650px)')
    // la zone principale respire, la coque ne s'écrase pas
    expect(css).toContain('.ct-entete')
    expect(page).toMatch(/main:\s*\{[^}]*boxSizing:\s*'border-box'/)
  })
})
