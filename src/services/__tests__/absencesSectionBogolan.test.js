// Absences · contrat de la SECTION DU HAUT — bogolan en LISIÈRE, six rabats pendus
// dessous, cadre défait. Absences, 26/11/2026 (maquette retenue
// `maquettes/absences-en-tete-lisiere.png`, option de gauche).
//
//   Ce qui est affiché est vrai ; ne pas confondre le tissu et l'encre ; le motif
//   est un fond, le mot est un élément ; les chiffres ne se racontent pas, ils se
//   comparent ; une correction = un contrat.
//
// Deux versions de cette section existent, et c'est la seconde qui tient :
//   1re (24/11, refusée) : le motif tournait autour de la page entière —
//     « tu n'as fait qu'entourer l'ancienne page d'une bande motif. je ne veux pas
//     de ça. » Un liseré autour d'un contenu intact n'est pas une reprise.
//   2e (26/11) : le motif ne border plus rien. La lisière EST le bord bas de la
//     section, et les six raccourcis pendent sous elle.
//
// Un verrou de source qui cherche une sous-chaîne dans TOUT un fichier se fait
// avoir par les commentaires : ces tests-là lisent le fichier découpé en lignes et
// ne regardent que celles qui ne commentent pas (le motif est devenu une propriété
// de structure, et une propriété de structure ne se prouve pas par un mot).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { culturalMotifForPath } from '../../components/culturalMotif.js'

// même convention que `bandeauKenteAmbre.test.js` : une racine, des chemins relatifs
const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const PAGE = lire('src/pages/Absences.jsx')
const CSS = lire('src/pages/AbsencesAfroTech.css')
const RAIL = lire('src/components/RaccourcisPages.jsx')
const BANDE = lire('src/components/AbsencesCulturalBand.jsx')

/* Le fichier réduit à ce qui code, commentaire retiré. */
const lignesUtiles = (src) =>
  src
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))

const CODE = { page: lignesUtiles(PAGE), css: lignesUtiles(CSS), rail: lignesUtiles(RAIL), bande: lignesUtiles(BANDE) }
const codeDe = (nom) => CODE[nom].join('\n')
const porte = (nom, motif) => CODE[nom].some((l) => l.includes(motif))
const nb = (haystack, aiguille) => haystack.split(aiguille).length - 1

describe("Absences · la section du haut, telle que la maquette l'a dessinée", () => {
  it('le motif de la page est le bogolan, et c’est le seul', () => {
    expect(culturalMotifForPath('/absences')).toBe('bogolan')
    expect(porte('page', "<PageCulturalBand")).toBe(false) // la frise SVG ne fait pas la section
  })

  // ── 1. le cadre est défait ──────────────────────────────────────────────────
  it('ne tourne plus autour du <main> : plus de liseré sur quatre côtés', () => {
    expect(porte('page', 'abs-section-cadre')).toBe(false)
    expect(porte('page', 'abs-section-papier')).toBe(false)
    expect(porte('css', '.abs-section-cadre')).toBe(false)
    expect(porte('css', '.abs-section-papier')).toBe(false)
    // et les onglets de section ne « remontent » plus sur une lisière inexistante
    expect(porte('css', '.abs-onglets-rabats')).toBe(false)
    expect(porte('page', 'abs-onglets-rabats')).toBe(false)
  })

  // ── 2. la feuille du titre est posée, pas collante ──────────────────────────
  it("n’est plus une carte flottante : pas de collant, pas de rayon, pas de flou", () => {
    const bloc = codeDe('css').match(/\.abs-topbar \{([^}]*)\}/)?.[1] || ''
    expect(bloc).toBeTruthy()
    expect(bloc).not.toContain('position: sticky') // « je veux tout comme dans la maquette »
    expect(bloc).not.toContain('backdrop-filter')
    expect(bloc).not.toContain('border-radius: 18px')
    expect(bloc).not.toContain('box-shadow: var(--abs-shadow)')
    expect(bloc).toContain('background: var(--abs-bg-elevated)') // l'ivoire de la variante claire
  })

  it('garde les textes exacts de la maquette, et les mêmes briques qu’avant', () => {
    expect(PAGE).toContain('En-Check · ABSENCES &amp; CONGÉS')
    expect(PAGE).toContain('Congés, maladies, formations et justificatifs')
    expect(porte('page', 'className="abs-topbar"')).toBe(true) // verrou de charteAbsences
    expect(porte('page', 'abs-back-btn')).toBe(true)
    expect(porte('page', 'abs-theme-toggle')).toBe(true)
    // le titre de la maquette est à ~20 px, pas 16
    expect(codeDe('css')).toMatch(/\.abs-brand-title \{[^}]*font-size: 20px/)
  })

  // ── 3. la lisière : le bord bas de la section, pleine largeur ───────────────
  it('porte la lisière sous la feuille, sur toute la largeur', () => {
    // dans le JSX : un seul élément, et il est FRÈRE de la feuille, pas son enfant
    const ligne = (motif) => CODE.page.findIndex((l) => l.includes(motif))
    expect(ligne('<AbsencesCulturalBand')).toBeGreaterThan(ligne('className="abs-topbar"')) // la lisière vient APRÈS la feuille
    expect(ligne('className="abs-topbar-nav"')).toBeGreaterThan(ligne('<AbsencesCulturalBand')) // et le rail, dessous
    expect(nb(PAGE, '<AbsencesCulturalBand')).toBe(1) // une lisière, pas deux
    expect(porte('page', 'position="tete"')).toBe(true)
    // le tissu est le webp de la paie, et sa largeur est implicite
    expect(porte('css', '.abs-bogolan-tete { height: 34px; }')).toBe(true)
    expect(codeDe('css')).toMatch(/\.abs-bogolan-band \{[^}]*background-size: auto 100%/)
  })

  it('ne peint aucun mot sur le tissu', () => {
    // la lisière est une image muette : un div vide, `aria-hidden`, sans titre de
    // motif ni texte — « le motif est un fond, le mot est un élément » (D-004)
    expect(porte('bande', 'aria-hidden')).toBe(true)
    expect(porte('bande', 'MotifTitre')).toBe(false)
    expect(CODE.bande.some((l) => l.includes('<span') || l.includes('<p '))).toBe(false)
    // et le tissu se réduit d'une hauteur : jamais étiré sur la largeur
    expect(codeDe('css')).toMatch(/\.abs-bogolan-band \{[^}]*background-size: auto 100%/ )
  })

  // ── 4. les six rabats : tout le style neuf est scoping sous `.abs-topbar-nav` ──
  it('habille les six rabats sans toucher au rail des 14 autres pages qui le partagent', () => {
    // `.abs-raccourcis` / `.abs-raccourci` sont globales : 14 autres pages posent le
    // même rail et le re-scopent dans 10 fichiers CSS (`.aa-raccourcis`, `.paie-page`,
    // `.emp-barre`, `.jf-raccourcis`…). Une règle nue ici aurait habillé la moitié de
    // l'application — d'où `.abs-topbar-nav` devant chaque sélecteur neuf.
    const debut = CSS.indexOf('LA SECTION DU HAUT')
    const fin = CSS.indexOf('La tuile de motif en tête de ligne')
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    const blocNeuf = lignesUtiles(CSS.slice(debut, fin))
    expect(blocNeuf.length).toBeGreaterThan(20) // le bloc existe, il n'est pas vide
    expect(blocNeuf.filter((l) => l.includes('.abs-raccourci')).length).toBeGreaterThan(3)
    expect(blocNeuf.filter((l) => l.includes('.abs-raccourci')).every((l) => l.includes('.abs-topbar-nav'))).toBe(true)
    // et le rail global, lui, n'a pas bougé d'un cheveu
    expect(codeDe('css')).not.toMatch(/\.abs-raccourci \{[^}]*grid-template-columns/)
    // le rail devient une portée de six parts égales, pleine largeur
    expect(codeDe('css')).toMatch(/\.abs-topbar-nav \.abs-raccourcis \{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/)
    // six libellés entiers, en minuscules, et le pictogramme rendu muet
    expect(codeDe('css')).toMatch(/\.abs-topbar-nav \.abs-raccourci svg \{ display: none; \}/)
    expect(codeDe('css')).not.toMatch(/\.abs-topbar-nav \.abs-raccourci \{[^}]*text-transform: uppercase/)
  })

  it('coud le rabat du jour en argile et y épingle le compte', () => {
    const actif = codeDe('css').match(/\.abs-topbar-nav \.abs-raccourci\[data-actif="oui"\][^{]*\{([^}]*)\}/)?.[1] || ''
    expect(actif).toContain('background: var(--abs-argile)') // l'argile du dessin, en aplat
    expect(actif).toContain('color: var(--charte-blanc)')      // le blanc cassé de la charte, jamais le blanc pur (D-017)
    // la crête : le rabat du jour descend plus bas que ses voisines, il ne masque pas le tissu
    expect(actif).toContain('padding-bottom: 16px')
    // le compte passe SUR le rabat (question 2 du fondateur : « comme dans la maquette »)
    expect(porte('rail', 'comptes = {}')).toBe(true)
    expect(porte('rail', 'abs-raccourci-compte')).toBe(true)
    expect(porte('page', "comptes={{ '/absences': absences.length }}")).toBe(true)
    // et il ne se dit pas deux fois : le compteur a quitté les onglets de section
    const onglets = CODE.page.slice(
      CODE.page.findIndex((l) => l.includes('className="abs-section-tabs"')),
      CODE.page.findIndex((l) => l.includes('className="abs-section-tabs"')) + 14,
    )
    expect(onglets.some((l) => l.includes('{absences.length}'))).toBe(false)
  })

  // ── 5. Export et + Déclarer : une seule fois, dans la feuille ───────────────
  it('ne dit Export et Déclarer qu’une seule fois dans la page', () => {
    const entete = CODE.page.slice(
      CODE.page.findIndex((l) => l.includes('className="abs-topbar"')),
      CODE.page.findIndex((l) => l.includes('className="abs-topbar-nav"')),
    )
    expect(entete.some((l) => l.includes('<Download size={16} /> <span>Export</span>'))).toBe(true)
    expect(entete.some((l) => l.includes('<Plus size={16} /> <span>Déclarer</span>'))).toBe(true)
    const corps = CODE.page.slice(CODE.page.findIndex((l) => l.includes('className="abs-topbar-nav"')))
    expect(corps.some((l) => l.includes('<Download size={16} /> <span>Export</span>'))).toBe(false)
    expect(corps.some((l) => l.includes('<Plus size={16} /> <span>Déclarer</span>'))).toBe(false)
    // le bouton d'action est un aplat, pas un dégradé (point 6 du dessin)
    const primaire = codeDe('css').match(/\.abs-btn-primary \{([^}]*)\}/)?.[1] || ''
    expect(primaire).toContain('background: var(--abs-argile)')
    expect(primaire).not.toContain('linear-gradient')
    // et `--abs-argile` est bien le cuivre freiné de tissu — un aplat de cuivre pur
    // sous un texte blanc cassé ne passe pas AA, et c'est le point que le dégradé
    // de la version refusée cachait
    expect(codeDe('css')).toContain('--abs-argile: color-mix(in srgb, var(--abs-copper) 78%, var(--charte-tissu));')
    // et la lune se pose carrée, comme ses deux voisines
    const lune = codeDe('css').match(/\.abs-theme-btn \{([^}]*)\}/)?.[1] || ''
    expect(lune).toContain('border-radius: 11px')
  })

  // ── 6. ce que la reprise laisse en place ───────────────────────────────────
  it('laisse la tuile de ligne et la couture de la barre d’outils', () => {
    // ce que le fondateur a demandé de garder (« Défaire le cadre seul, garder le
    // reste ») : les briques qui ne doivent rien au cadre. La couture de la barre
    // d'outils vivait sur `.abs-section-papier` — elle est réaccrochée à `.abs-page`,
    // sinon elle mourait avec le cadre sans qu'aucun test ne s'en plaigne.
    expect(porte('page', 'className="abs-tuile"')).toBe(true)
    expect(porte('css', '.abs-tuile { width: 22px; height: 22px;')).toBe(true)
    expect(porte('css', '.abs-couture-alerte')).toBe(true)
    expect(codeDe('css')).toMatch(/\.abs-page \.toolbar-top \{[^}]*border-top: 1px dashed/)
  })

  it('se repose au plus étroit comme au plus large', () => {
    // six rabats de front ne tiennent qu'au-dessus de 980 px : en dessous, trois
    // par rang et deux rangées — le rail shared impose `white-space: nowrap`, un
    // libellé tronqué serait un mensonge sur la page où l'on vient de cliquer
    const etroit = (max) => {
      const i = CSS.indexOf(`@media(max-width:${max}px)`)
      expect(i).toBeGreaterThan(-1)
      return lignesUtiles(CSS.slice(i, CSS.indexOf('\n}', i) + 2))
    }
    expect(etroit(980)).toContain('.abs-topbar-nav .abs-raccourcis { grid-template-columns: repeat(3, minmax(0, 1fr)); }')
    expect(etroit(650)).toContain('.abs-topbar-nav { padding: 0 12px 12px; }')
    // la lisière maigrit avec le rail : un motif qui déborde est un défaut, pas un accent
    expect(etroit(650)).toContain('.abs-bogolan-tete { height: 26px; }')
  })
})
