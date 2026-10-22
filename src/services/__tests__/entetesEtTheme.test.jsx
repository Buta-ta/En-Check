// ═══════════════════════════════════════════════════════════
// 🎛️ ENTÊTES, THÈME ET PHOTOS — ABSENCES & PLANNING
//
// ① Un bouton « Aujourd'hui » et un bouton clair/sombre sur
//    Absences. ② Le même libellé de période des deux côtés,
//    et il s'ouvre. ③ Des bandeaux arrondis qui collent en
//    haut. ④ Les photos de profil dans les demandes et la vue
//    Jour du Planning.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import ChoixPeriode from '../../components/ChoixPeriode'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const pageAbsences = lire('src/pages/Absences.jsx')
const planning = lire('src/pages/Planning.jsx')

// ── 1. Le panneau de période partagé ─────────────────────────────────

it('1. le panneau de période n’existe que lorsqu’il est ouvert', () => {
  const ferme = renderToStaticMarkup(
    <ChoixPeriode ouvert={false} onFermer={() => {}} jourSel="2026-10-22" annee={2026} onAllerA={() => {}} />
  )
  expect(ferme).toBe('')

  const ouvert = renderToStaticMarkup(
    <ChoixPeriode ouvert onFermer={() => {}} jourSel="2026-10-22" annee={2026} onAllerA={() => {}} />
  )
  expect(ouvert).toContain('data-testid="choix-periode"')
  expect(ouvert).toContain('type="date"')
  expect(ouvert).toContain('value="2026-10-22"')
  expect(ouvert).toContain('data-testid="choix-periode-annee-moins"')
  expect(ouvert).toContain('data-testid="choix-periode-annee-plus"')
  expect(ouvert).toContain('Revenir à aujourd’hui')
})

// ── 2. Le libellé « Lun 19 – Dim 25 Oct. 2026 », des deux côtés ──────

it('2. le Planning construit bien « Lun 19 – Dim 25 Oct. 2026 »', () => {
  expect(planning).toContain(
    '`${first.court} ${first.dayOfMonth} – ${last.court} ${last.dayOfMonth} ${capMonth} ${last.dateObj.getFullYear()}`'
  )
})

it('3. le libellé du Planning s’ouvre, comme celui des Absences', () => {
  expect(planning).toContain('data-testid="sk-period-label"')
  expect(planning).toContain('<ChoixPeriode')
  expect(planning).toContain('toIsoDateLocal(calendarDate)')
  // Absences garde le même bouton, plus son raccourci « Aujourd'hui »
  expect(pageAbsences).not.toContain('Semaine du')
})

// ── 3. Photos de profil ──────────────────────────────────────────────

it('4. les demandes ramènent la photo de l’employé', () => {
  const requetes = planning.match(
    /employees\(id, first_name, last_name, matricule, enterprise_id, department, position, photo_url\)/g
  ) || []
  // les horaires des employés + les demandes de changement
  expect(requetes).toHaveLength(2)
})

it('5. la vue Jour affiche la photo (et retombe sur les initiales sinon)', () => {
  const blocJour = planning.slice(planning.indexOf('<div className="sk-day-emp">'))
  expect(blocJour.slice(0, 800)).toContain('emp.photo_url ?')
  expect(blocJour.slice(0, 800)).toContain('<img')
  expect(blocJour.slice(0, 800)).toContain('toUpperCase()')
  // grille semaine + vue jour + demandes
  expect((planning.match(/emp\.photo_url/g) || []).length).toBeGreaterThanOrEqual(3)
})

// ── 4. Bouton clair / sombre ─────────────────────────────────────────

it('6. la page Absences a un bouton clair/sombre qui agit vraiment', () => {
  expect(pageAbsences).toContain("data-testid=\"abs-theme-toggle\"")
  expect(pageAbsences).toContain("const { darkMode, toggleTheme } = useTheme()")
  expect(pageAbsences).toContain("data-theme={darkMode ? 'dark' : 'light'}")
  // les composants suivent le thème au lieu de rester figés au sombre
  expect(pageAbsences).toContain('darkMode={darkMode}')
  // le fond n'est plus écrit en dur
  expect(pageAbsences).not.toContain("document.body.style.backgroundColor = '#15110E'")
  expect(pageAbsences).toContain("container: { minHeight: '100vh', background: 'var(--abs-bg)' }")
})

it('7. plus aucune teinte sombre figée dans les écrans d’absences', () => {
  for (const fichier of [
    'src/pages/Absences.jsx',
    'src/components/AbsencesMotifsManager.jsx',
    'src/components/DemandeCongeCard.jsx',
    'src/components/AbsencesFiltres.jsx',
  ]) {
    const source = lire(fichier)
    expect(source).not.toContain('rgba(255,255,255,')
    expect(source).not.toContain("'#1D1713'")
    expect(source).not.toContain("'#15110E'")
    expect(source).not.toContain("'#F5F2EB'")
  }
})

it('8. le mode clair a bien ses propres valeurs pour chaque variable', () => {
  const css = lire('src/pages/AbsencesAfroTech.css')
  expect(css).toContain(".abs-page[data-theme='light']")
  for (const variable of ['--abs-fill-soft', '--abs-fill', '--abs-line-soft', '--abs-line', '--abs-bg']) {
    expect((css.match(new RegExp(`${variable}:`, 'g')) || []).length).toBe(2) // sombre + clair
  }
})

// ── 5. Bandeaux arrondis et collants ─────────────────────────────────

it('9. les bandeaux des deux pages sont arrondis et restent collés', () => {
  for (const [fichier, classe] of [
    ['src/pages/AbsencesAfroTech.css', '.abs-topbar'],
    ['src/pages/PlanningAfroTech.css', '.sk-topbar'],
  ]) {
    const css = lire(fichier)
    const debut = css.indexOf(`${classe} {`)
    expect(debut).toBeGreaterThan(-1)
    const regles = css.slice(debut, css.indexOf('}', debut))
    expect(regles).toContain('position: sticky')
    expect(regles).toContain('border-radius')
    expect(regles).toContain('box-shadow')
  }
})

// ── 6. Lisibilité du mode clair ──────────────────────────────────────

/** Luminance relative WCAG d'un #RRGGBB */
const luminance = (hex) => {
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste WCAG entre deux #RRGGBB (1 → 21) */
const contraste = (a, b) => {
  const claires = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (claires[0] + 0.05) / (claires[1] + 0.05)
}

it('10. le mode clair garde un contraste lisible partout (WCAG ≥ 4.5)', () => {
  const css = lire('src/pages/AbsencesAfroTech.css')
  const clair = css.slice(css.indexOf(".abs-page[data-theme='light']"))
  const valeur = (nom) => {
    const trouve = new RegExp(`${nom}:\\s*#([0-9A-Fa-f]{6})`).exec(clair)
    expect(trouve, `${nom} doit être une couleur solide`).toBeTruthy()
    return trouve[1]
  }
  const fond = valeur('--abs-bg')

  expect(contraste(valeur('--abs-text'), fond)).toBeGreaterThanOrEqual(7)
  expect(contraste(valeur('--abs-text-soft'), fond)).toBeGreaterThanOrEqual(4.5)
  expect(contraste(valeur('--abs-text-faint'), fond)).toBeGreaterThanOrEqual(4.5)
  // les accents servent de texte et d'icônes : ils doivent rester lisibles
  for (const accent of ['--abs-amber', '--abs-emerald', '--abs-coral', '--abs-orange', '--abs-indigo']) {
    expect(contraste(valeur(accent), fond)).toBeGreaterThanOrEqual(4.5)
  }
  // le cuivre, lui, est un aplat (bouton principal) : il porte du texte crème,
  // on vérifie seulement qu'il se détache franchement de la page
  expect(contraste(valeur('--abs-copper'), fond)).toBeGreaterThanOrEqual(3)
})

it('11. aucun texte blanc ne subsiste en dehors des boutons en dégradé', () => {
  // du blanc sur une carte claire, c'est invisible : seuls les boutons
  // pleins (rouge/vert) gardent du blanc, et ils sont sur un dégradé.
  const coupables = pageAbsences
    .split('\n')
    .filter((ligne) => ligne.includes("'#FFF'") && !ligne.includes('linear-gradient'))
  expect(coupables).toEqual([])
})

it('12. les teintes d’accent passent par les variables de la charte', () => {
  // les seules qui restent figées sont les couleurs « données »
  // (motifs, statuts, filtres) et les dégradés des boutons pleins
  expect((pageAbsences.match(/var\(--abs-amber\)/g) || []).length).toBeGreaterThan(20)
  expect((pageAbsences.match(/var\(--abs-coral\)/g) || []).length).toBeGreaterThan(5)
  expect((pageAbsences.match(/var\(--abs-emerald\)/g) || []).length).toBeGreaterThan(3)
  expect((pageAbsences.match(/var\(--abs-orange\)/g) || []).length).toBeGreaterThan(3)
})

it('13. les boutons et pastilles suivent les gabarits des autres pages', () => {
  const css = lire('src/pages/AbsencesAfroTech.css')
  const bloc = (classe) => {
    const debut = css.indexOf(`${classe} {`)
    return css.slice(debut, css.indexOf('}', debut))
  }
  // boutons : hauteur 40, rayon 11, 12,5 px / 700 — comme la page Pointages
  const bouton = bloc('.abs-btn')
  expect(bouton).toContain('min-height: 40px')
  expect(bouton).toContain('border-radius: 11px')
  expect(bouton).toContain('font-size: 12.5px')
  expect(bouton).toContain('font-weight: 700')
  // pastilles de raccourcis : 11 px / 740, dégradé cuivre pour la page courante
  const pastille = bloc('.abs-raccourci')
  expect(pastille).toContain('font-size: 11px')
  expect(pastille).toContain('font-weight: 740')
})

it('14. la bande de raccourcis n’a plus de couleurs figées au sombre', () => {
  const source = lire('src/components/RaccourcisPages.jsx')
  // l'apparence vit dans la feuille de style, donc plus rien de codé ici
  expect(source).not.toContain('rgba(255,255,255')
  expect(source).not.toContain('#F59E0B')
  expect(source).toContain('className="abs-raccourci"')
})
