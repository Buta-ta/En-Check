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

it("6. la page Absences n'a plus de bouton clair/sombre, mais elle lit toujours le thème", () => {
  // 27/11/2026 : « enlève le bouton clair/sombre ». Ce qui est enlevé est
  // l'interrupteur de CET écran, pas le thème — D-005 le garde dans
  // `localStorage['encheck.theme']`, et un utilisateur qui l'a réglé hier doit
  // retrouver sa nuit aujourd'hui.
  expect(pageAbsences).not.toContain('abs-theme-toggle')
  expect(lire('src/pages/AbsencesAfroTech.css')).not.toContain('.abs-theme-btn')
  /* 08/12 — « RAMENE THE SIDEBAR ET LE RAIL DANS LA PAGE ABSENCE ». L'interrupteur
     a un porteur unique dans la coque : le rail (`SidebarUnique` → `surTheme`), qui
     le montre sur TOUTES les pages admin. La page Absences ne se dessine donc
     toujours pas de bouton — elle ne fait que le BRANCHER, et le vérifie ici :
     `toggleTheme` n'apparaît que dans la déstructuration du contexte et dans la
     prop du rail, jamais dans un `<button>`. Un bouton de page en plus du rail
     serait la faute du 27/11, reproduite en deux exemplaires. */
  for (const ligne of pageAbsences.split('\n')) {
    if (!ligne.includes('toggleTheme')) continue
    expect(ligne).toMatch(/useTheme\(\)|surTheme=\{toggleTheme\}/)
  }
  expect(pageAbsences).toContain('surTheme={toggleTheme}')
  expect(pageAbsences).toContain("const { darkMode, toggleTheme } = useTheme()")
  expect(pageAbsences).toContain("data-theme={darkMode ? 'dark' : 'light'}")
  // les composants suivent le thème au lieu de rester figés au sombre
  expect(pageAbsences).toContain('darkMode={darkMode}')
  // le fond n'est plus écrit en dur
  expect(pageAbsences).not.toContain("document.body.style.backgroundColor = '#15110E'")
  // 08/12 : la page vit dans `.coque-admin-page`, qui connaît déjà sa hauteur ;
  // un `minHeight: 100vh` ICI aurait posé un second plancher sous la coque.
  expect(pageAbsences).toContain("container: { background: 'var(--abs-bg)' }")
  expect(pageAbsences).not.toContain("container: { minHeight: '100vh'")
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

it('9. le bandeau du planning reste une carte collée, celui des Absences une feuille posée', () => {
  const regleDe = (fichier, classe) => {
    const css = lire(fichier)
    const debut = css.indexOf(`${classe} {`)
    expect(debut).toBeGreaterThan(-1)
    return css.slice(debut, css.indexOf('}', debut))
  }
  // Le Planning n'a rien demandé : sa carte garde son rayon, son ombre et son collant.
  const sk = regleDe('src/pages/PlanningAfroTech.css', '.sk-topbar')
  expect(sk).toContain('position: sticky')
  expect(sk).toContain('border-radius')
  expect(sk).toContain('box-shadow')
  // Absences, 26/11/2026 : la maquette retenue (`maquettes/absences-en-tete-lisiere.png`)
  // couche la bande du titre SUR le sable, pleine largeur, qui défile avec la page.
  // « je veux tout comme dans la maquette » — donc ni collant, ni carton flottant.
  // Absences, 28/11/2026 : la maquette C (`absences-titre-C-chemise.png`) remplace la
  // bande plate par une chemise. Ce qui est gardé de la décision du 26/11 : elle ne se
  // colle pas, elle ne se voile pas. Ce qui change : la feuille EST un objet posé —
  // cercle d'encre de 2 px et ombre dure à flou zéro, les deux jetons du kit, pas des
  // valeurs recopiées à la main. Et « bordure: 0, rayon: 0 » n'était pas une vertu :
  // c'était l'absence de peau d'une bande qui ne ressemblait à rien dans la maison.
  const chimise = regleDe('src/pages/AbsencesAfroTech.css', '.abs-chemise-feuille')
  expect(chimise).not.toContain('position: sticky')
  expect(chimise).not.toContain('backdrop-filter')
  expect(chimise).toContain('border: var(--charte-trait) solid var(--charte-encre)')
  expect(chimise).toContain('box-shadow: var(--charte-ombre-dure)')
  expect(chimise).toContain('background: var(--charte-surface)')
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
  //
  // 08/12 — LE COMPTE SE RELIT SUR UN MINIMUM, PAS SUR UN RESTE. Cette aiguille
  // comptait « plus de 20 `var(--abs-amber)` » pour interdire l'ambre brut ; les
  // deux sections retravaillées ce soir (le rang des demandes, l'onglet
  // « configuration congés ») peignent maintenant à l'argile de la maison
  // (`--charte-aplat`, `--charte-encre`) et non plus à l'ambre — donc le compte
  // nu baissait SANS QU'UNE COULEUR CRUE REVIENT. Le total relit les deux familles
  // (une teinte doit passer par UNE variable, la sienne ou celle de la charte),
  // et l'interdiction devient DIRECTE : les deux blocs redessinés sont pesés au
  // hex et au rgba, et ne doivent RIEN peser.
  const accents = (pageAbsences.match(/var\(--(?:abs|charte)-(?:amber|coral|emerald|orange|aplat|encre|douce)\)/g) || [])
  expect(accents.length).toBeGreaterThan(45)
  expect((pageAbsences.match(/var\(--abs-coral\)/g) || []).length).toBeGreaterThan(5)
  expect((pageAbsences.match(/var\(--abs-emerald\)/g) || []).length).toBeGreaterThan(3)
  expect((pageAbsences.match(/var\(--abs-orange\)/g) || []).length).toBeGreaterThan(3)
  for (const [début, fin] of [
    ['<div className="abs-demandes">', '{activeTab === \'config_conges\''],
    ["{activeTab === 'config_conges' && (", '</main>'],
  ]) {
    const i = pageAbsences.indexOf(début)
    const j = pageAbsences.indexOf(fin, i)
    expect(i, `bloc introuvable : ${début}`).toBeGreaterThan(-1)
    expect(j, `fin de bloc introuvable après ${début}`).toBeGreaterThan(i)
    const bloc = pageAbsences.slice(i, j)
    expect(bloc).not.toMatch(/#[0-9A-F]{6}/i)
    expect(bloc).not.toMatch(/rgba?\(/)
  }
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

// ── 15. La fenêtre « Aller à » du sélecteur de période ─────────────
// Le fondateur a demandé de la retravailler (22/11). Elle se peignait
// elle-même, en styles en ligne et en deux palettes cousues selon l'humeur
// de la page qui la montait. Le contrat ci-dessous ne dit pas « joli » :
// il dit « une seule peau pour les deux îles, et elle vient des jetons ».

it('15. la fenêtre « Aller à » porte la peau de la maison, pas la sienne', () => {
  const fenetre = lire('src/components/ChoixPeriode.jsx')
  const peau = lire('src/components/ChoixPeriode.css')

  // Les commentaires racontent l'histoire, y compris les fautes corrigées : ce
  // qui compte, c'est le CODE. Il est isolé avant d'être jugé.
  const code = fenetre.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\/\/.*$/gm, '')
  const feuilleDeStyle = peau.replace(/\/\*[\s\S]*?\*\//g, '')

  // plus un style en ligne, plus une couleur en dur, plus un rgba de fortune
  expect(code).not.toContain('style={{')
  expect(code).not.toContain('rgba(')
  for (const source of [code, feuilleDeStyle]) {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(source).not.toContain('!important')
    expect(source).not.toContain('clip-path')
  }

  // la fenêtre ne demande plus à son hôte s'il fait nuit : le thème vient de
  // la racine du document, et les deux appelants ne le passent plus
  expect(code).not.toContain('darkMode')
  const appel = (source) => source.match(/<ChoixPeriode[\s\S]*?\/>/)[0]
  expect(appel(lire('src/pages/Planning.jsx'))).not.toContain('darkMode')
  expect(appel(lire('src/components/AbsencesCalendrier.jsx'))).not.toContain('darkMode')

  // D-016 : aucun flou, jamais. Une assise qui appelle un jeton répond par la
  // charte elle-même ; les autres se lisent ici, flou à zéro obligatoire.
  const assises = [...peau.matchAll(/box-shadow\s*:\s*([^;]+);/g)].map((m) => m[1].replace(/\s+/g, ' '))
  expect(assises.length).toBeGreaterThan(0)
  for (const assise of assises) {
    for (const couche of assise.split(/,(?![^(]*\))/)) {
      const valeur = couche.trim()
      // « aucune assise » et « l'assise est un jeton » répondent par la charte
      if (valeur === 'none' || valeur.includes('var(')) continue
      expect(valeur, `un flou s'est glissé dans « ${valeur} »`).toMatch(/\s0\s/)
    }
  }
  expect(peau).not.toMatch(/backdrop-filter\s*:\s*(?!none)/)

  // D-013 : les trois tailles de la maison, rien d'autre. L'ancienne fenêtre
  // en parlait quatre qu'elle avait inventées.
  const tailles = [...peau.matchAll(/font-size\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
  expect(tailles.length).toBeGreaterThanOrEqual(4)
  for (const taille of tailles) {
    expect(taille).toMatch(/^var\(--charte-taille-(titre|corps|micro|bouton)\)$/)
  }

  // les rayons : la feuille est carrée SANS UNITÉ, les objets appellent un jeton
  const rayons = [...peau.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
  for (const rayon of rayons) {
    expect(['0', 'var(--charte-rayon-champ)', 'var(--charte-rayon-carte)']).toContain(rayon)
  }

  // la bande de colle est une COUCHE : le raccourci du fond l'effacerait
  // (piège déjà payé sur la fiche employé)
  const debut = peau.indexOf('.cap-feuille {')
  const feuille = peau.slice(debut, peau.indexOf('}', debut))
  expect(feuille).toContain('background-color: var(--charte-surface);')
  expect(feuille).toContain('background-image: linear-gradient(')
  expect(feuille).not.toMatch(/^\s*background\s*:/m)

  // le fond d'un champ ne se peint pas en blanc de jeton : `--charte-blanc`
  // est une couleur de TEXTE sur remplissage, en thème sombre elle vire au
  // beige clair et le mot disparaît dedans. Le papier se LAVE.
  const debutChamp = peau.indexOf('.cap-champ {')
  const champ = peau.slice(debutChamp, peau.indexOf('}', debutChamp))
  expect(champ).not.toMatch(/background-color\s*:\s*var\(--charte-blanc\)/)
  expect(champ).toContain('color-mix(in srgb, var(--charte-blanc) 12%, var(--charte-surface))')
  // et le calendrier natif suit le thème de l'application
  expect(peau).toContain("[data-theme='dark'] .cap-champ")
  expect(peau).toContain('color-scheme: dark')

  // l'ancrage et le geste du dehors sont ceux d'avant : la fenêtre s'ouvre
  // toujours sous le titre de période, un clic ailleurs la referme
  expect(feuille).toContain('top: calc(100% + 8px)')
  expect(feuille).toContain('left: 0')
  expect(feuille).toContain('min-width: 232px')
  expect(fenetre).toContain('className="cap-voile"')
  expect(fenetre).toContain('onClick={onFermer}')

  // le focus ENTRE avec la fenêtre, et la réductions des mouvements est lue
  expect(fenetre).toContain('champ.current?.focus()')
  expect(peau).toContain('prefers-reduced-motion')
})
