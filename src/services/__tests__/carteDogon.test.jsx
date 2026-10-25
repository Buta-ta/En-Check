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
    // les filtres et le temps réel n'ont pas bougé
    expect(page).toContain('filterStatut')
    expect(page).toContain('filterEmploye')
    expect(page).toContain('carte-realtime-')
    expect(page).toContain('markerClusterGroup')
    expect(page).toContain('fitBounds')
    // les couleurs de statut restent celles du produit : en CSS pour
    // l'habillage, en JavaScript pour ce que Leaflet trace lui-même
    for (const couleur of ['#10B981', '#F59E0B', '#EF4444']) {
      expect(css.toLowerCase()).toContain(couleur.toLowerCase())
    }
    expect(page).toContain("#EF4444")
    expect(page).toContain("#10B981")
  })

  it('passe au téléphone', () => {
    expect(css).toContain('@media (max-width: 650px)')
    expect(css).toContain('.ct-entete')
    // la coque est mesurée en border-box : rien ne déborde de l'écran
    expect(css).toMatch(/\.ct-page \*[^{]*\{[^}]*box-sizing:\s*border-box/)
    expect(css).toMatch(/\.ct-coque\s*\{[^}]*box-sizing|box-sizing:\s*border-box/)
  })
})

// ── 3. La refonte ──────────────────────────────────────────

describe('3. la refonte', () => {
  it('ne pose plus une seule règle de style dans le JSX', () => {
    // plus de feuille inline, plus d'objet styles, plus d'attribut style
    expect(page).not.toContain('<style>')
    expect(page).not.toMatch(/\bstyle=\{\{/)
    expect(page).not.toMatch(/\bstyle="/)
    expect(page).not.toContain('const styles =')
    // ce que Leaflet dessine passe par des classes de la feuille
    expect(page).toContain('ct-pin')
    expect(page).toContain('ct-groupe')
    expect(page).toContain('ct-zone')
    expect(css).toContain('.ct-pin[data-etat=\'ok\']')
    expect(css).toContain('.ct-groupe--petit')
  })

  it('bat la page en registres, en seuil et en atelier', () => {
    for (const classe of [
      'ct-coque', 'ct-seuil', 'ct-raccourcis', 'ct-registres', 'ct-stele',
      'ct-outils', 'ct-champ', 'ct-cles', 'ct-cle', 'ct-atelier', 'ct-cadre', 'ct-linteau',
      'ct-carte-niche', 'ct-legende', 'ct-liste', 'ct-planche', 'ct-fiche',
      'ct-fond',
    ]) {
      expect(css).toContain(`.${classe}`)
    }
    // les cinq registres de la journée
    expect(page).toContain('Employés GPS')
    expect(page).toContain('Présents')
    expect(page).toContain('Sortis')
    expect(page).toContain('Hors zone')
    expect(page).toContain('Non vérifié')
  })

  it('remplace le menu de statut par quatre clés, sans changer les valeurs', () => {
    for (const cle of ['tous', 'dans_zone', 'hors_zone', 'non_verifie']) {
      expect(page).toContain(`cle: '${cle}'`)
    }
    expect(page).toContain('aria-pressed={filterStatut === cle}')
    expect(css).toContain(".ct-cle[aria-pressed='true']")
  })

  it('donne à la page ses raccourcis, comme les autres coques', () => {
    expect(page).toContain('RaccourcisPages compact')
    expect(page).toContain("excludePaths={['/carte-temps-reel']}")
    expect(css).toContain('.ct-raccourcis .abs-raccourci')
  })

  it('nomme les employés dans une colonne, avec leur heure et leur état', () => {
    expect(page).toContain('Employés du jour')
    expect(page).toContain('ct-planche')
    expect(page).toContain('formaterHeureLocale(data.lastTime)')
    // la recherche ne touche qu'à l'affichage
    expect(page).toContain('recherche')
    expect(page).toContain('Chercher un nom ou un matricule')
  })

  it('ouvre une vraie fiche, refermable au clavier', () => {
    expect(page).toContain('role="dialog"')
    expect(page).toContain('aria-modal="true"')
    expect(page).toContain("e.key === 'Escape'")
    expect(page).toContain('aria-label="Fermer la fiche"')
    expect(css).toContain('@keyframes ct-fiche')
  })

  it('remplace les alertes du navigateur par un avis dans la page', () => {
    expect(page).not.toMatch(/[^.\w]alert\(/)
    expect(page).toContain('className="ct-avis"')
    expect(page).toContain('role="status"')
  })
})

// ── 4. Le jour et la poche ─────────────────────────────────

describe('4. la bascule et le téléphone', () => {
  it('prend la bascule clair / sombre de l’application', () => {
    expect(page).toContain("import { useTheme } from '../contexts/ThemeContext'")
    expect(page).toContain('const { darkMode, toggleTheme } = useTheme()')
    // la page ne s'invente pas un thème : elle suit celui de l'admin
    expect(page).toContain("className={`ct-page${darkMode ? '' : ' ct-clair'}`}")
  })

  it('pose un vrai interrupteur, nommé pour les deux sens', () => {
    expect(page).toContain('className="ct-bascule"')
    expect(page).toContain('role="switch"')
    expect(page).toContain('aria-checked={darkMode}')
    expect(page).toContain('onClick={toggleTheme}')
    expect(page).toContain("darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'")
    expect(css).toContain('.ct-bascule')
  })

  it('dessine le jour, pas seulement un bouton', () => {
    expect(css).toContain('.ct-page.ct-clair')
    // la patine prend la place de la nuit, l'encre celle de la patine
    expect(css).toMatch(/\.ct-page\.ct-clair\s*\{[^}]*--ct-nuit:\s*#f4ead6/)
    expect(css).toMatch(/\.ct-page\.ct-clair\s*\{[^}]*--ct-panneau:\s*#fbf4e4/)
    expect(css).toMatch(/\.ct-page\.ct-clair\s*\{[^}]*--ct-patine:\s*#241a14/)
    // les surfaces qui étaient noires doivent s'éclaircir
    expect(css).toContain('.ct-page.ct-clair .ct-voile')
    expect(css).toContain('.ct-page.ct-clair .ct-legende')
    expect(css).toContain('.ct-page.ct-clair .ct-fond')
  })

  it('garde une encre lisible sur les fonds clairs', () => {
    expect(css).toMatch(/\.ct-page\.ct-clair\s*\{[^}]*--ct-ok-texte:\s*#0b5f43/)
    expect(css).toMatch(/\.ct-page\.ct-clair\s*\{[^}]*--ct-attente-texte:\s*#8a5506/)
    expect(css).toMatch(/\.ct-page\.ct-clair\s*\{[^}]*--ct-alerte-texte:\s*#b91c1c/)
    // le texte posé sur le bois reste clair dans les deux thèmes
    expect(css).toContain('--ct-sur-bois: #f4ead6')
  })

  it('tient dans une poche : grille d’outils et champs à 16 px', () => {
    expect(css).toContain('@media (max-width: 720px)')
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.ct-outils\s*\{[^}]*display:\s*grid/)
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?grid-template-columns:\s*repeat\(2/)
    // 16 px : iOS ne zoome plus quand on touche un champ
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?font-size:\s*16px/)
    // la légende se replie sous la carte, la liste passe dessous
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.ct-atelier\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.ct-legende\s*\{[^}]*position:\s*static/)
  })

  it('fait de la fiche une feuille sur téléphone', () => {
    expect(css).toContain('@keyframes ct-fiche-sheet')
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.ct-fond\s*\{[^}]*place-items:\s*end stretch/)
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?animation:\s*ct-fiche-sheet/)
    expect(css).toContain('env(safe-area-inset-bottom)')
  })

  it('tient encore sur les plus petits écrans', () => {
    expect(css).toContain('@media (max-width: 460px)')
    expect(css).toContain('@media (max-width: 380px)')
    // les registres restent deux par deux jusqu'à 380 px
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.ct-registres\s*\{[^}]*grid-template-columns:\s*repeat\(2/)
    expect(css).toMatch(/@media \(max-width: 460px\)[\s\S]*?\.ct-outils\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
  })
})

// ── 5. Le titre, la carte vide et les calques ──────────────

describe('5. le titre, la carte vide et les calques', () => {
  it('donne à la carte un titre de travail', () => {
    expect(page).toContain('Localisation des pointages')
    expect(page).not.toContain("Le plateau vu d'en haut")
  })

  it('habille la carte vide comme une plaque gravée', () => {
    for (const classe of [
      'ct-voile--vide',
      'ct-vide',
      'ct-vide-sceau',
      'ct-vide-titre',
      'ct-vide-note',
      'ct-vide-chevrons',
    ]) {
      expect(css).toContain(`.${classe}`)
    }
    expect(page).toContain('className="ct-voile ct-voile--vide"')
    expect(page).toContain('Aucun pointage GPS pour cette date.')
    expect(page).toContain('Les pointages apparaîtront ici en temps réel.')
    // le chargement garde ses propres styles
    expect(page).toContain('className="ct-voile ct-voile--charge"')
    expect(css).toContain('.ct-voile--charge p')
  })

  it('garde la carte et ses voiles sous la barre de recherche', () => {
    // la barre de l'assistant est fixe à z-index 80 : rien de la carte ne la couvre
    expect(css).toMatch(/\.ct-carte-niche\s*\{[^}]*z-index:\s*0/)
    expect(css).toMatch(/\.ct-carte-niche\s*\{[^}]*isolation:\s*isolate/)
    expect(css).toMatch(/\.ct-carte\s*\{[^}]*z-index:\s*0/)
    const zIndex = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]))
    const horsModale = zIndex.filter((z) => z < 1000)
    expect(Math.max(...horsModale)).toBeLessThan(80)
  })
})

// ── 6. Le vocabulaire ──────────────────────────────────────

describe('6. le vocabulaire de gestion', () => {
  // la page parle comme un outil RH : entreprises, employés, pointages.
  // Les métaphores restent dans les matières et les ornements, jamais
  // dans un libellé qu'un responsable lirait à son comptable.
  it('appelle une entreprise une entreprise', () => {
    expect(page).not.toContain('Toutes les maisons')
    expect(page).not.toContain("'La maison'")
    expect(page).not.toContain('>La maison<')
    expect(page).toContain('Toutes les entreprises')
    expect(page).toContain('Entreprise non renseignée')
    expect(page).toContain('<span className="ct-seuil-libelle">Entreprise</span>')
  })

  it('appelle un employé un employé', () => {
    expect(page).not.toContain('Les gens du jour')
    expect(page).not.toContain('Toutes les personnes')
    expect(page).not.toContain('Aucune personne ne correspond')
    expect(page).toMatch(/ct-etiquette">\s*<[^>]+aria-hidden="true" \/>\s*Employé\s*</)
    expect(page).toContain('Tous les employés')
    expect(page).toContain('Aucun employé ne correspond à ces filtres.')
  })

  it('nomme les champs comme des champs', () => {
    expect(page).toMatch(/ct-etiquette">\s*<[^>]+aria-hidden="true" \/>\s*Date\s*</)
    expect(page).toContain('<span className="ct-etiquette">Statut</span>')
    expect(page).not.toContain('>Le jour<')
    expect(page).not.toContain('>Le statut<')
  })

  it('garde le décor dans le décor, pas dans les textes de travail', () => {
    // l'identité dogon reste, mais les messages de service sont neutres
    expect(page).toContain('La porte du plateau')
    expect(page).toContain('Chaque point correspond à un pointage géolocalisé sur le site.')
    expect(page).toContain('Chargement des pointages…')
    expect(page).not.toContain('On relève les traces')
  })

  it('ne laisse aucun identifiant « maison » traîner', () => {
    expect(page).not.toContain('maisonAffichee')
    expect(css).not.toContain('ct-seuil-maison')
    expect(page).toContain('entrepriseAffichee')
    expect(css).toContain('.ct-seuil-entreprise')
  })
})
