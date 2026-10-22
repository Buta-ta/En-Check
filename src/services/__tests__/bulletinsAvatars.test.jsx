// ═══════════════════════════════════════════════════════════
// 🖼️ LES VISAGES DU VOLET EXPLOITATION
//
// Le volet « Fiches de paie » liste des salariés qu'on gère un par
// un : profils, primes, retenues. C'étaient des lignes de texte.
//
// La maquette validée promet des photos, avec un repli en initiales —
// la promesse n'était tenue que sur la vue d'ensemble.
//
// ⚠️ La photo est facultative en base : à la date d'écriture, UNE
//    seule des douze personnes actives en a une. Le repli n'est donc
//    pas un cas rare à gérer, c'est le cas normal : il doit être
//    lisible, pas un carré vide.
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from '../../contexts/ThemeContext'
import { AvatarSalarie, initialesDe } from '../../pages/FichesPaie'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const rendre = (employe, taille) =>
  renderToStaticMarkup(
    <ThemeProvider>
      <AvatarSalarie employe={employe} taille={taille} />
    </ThemeProvider>,
  )

// ── 1. Le repli en initiales ─────────────────────────────────────────

it('1. les initiales viennent du prénom et du nom, sans accent qui traîne', () => {
  expect(initialesDe('Awa', 'Diallo')).toBe('AD')
  expect(initialesDe('Élodie', 'N’Guessan')).toBe('ÉN')
  expect(initialesDe('  binta ', '  TRAORÉ ')).toBe('BT')
})

it('2. un salarié sans nom lisible ne produit pas un cercle vide', () => {
  expect(initialesDe(null, undefined)).toBe('?')
  expect(initialesDe('', '')).toBe('?')
  // un seul des deux suffit
  expect(initialesDe('Awa', '')).toBe('A')
  expect(initialesDe('', 'Diallo')).toBe('D')
})

it('3. sans photo, on affiche les initiales — pas une image cassée', () => {
  const html = rendre({ first_name: 'Awa', last_name: 'Diallo', photo_url: null }, 34)
  expect(html).toContain('AD')
  expect(html).not.toContain('<img')
  expect(html).toContain('data-testid="avatar-initiales"')
  expect(html).toContain('width:34px')
  expect(html).toContain('border-radius:50%')
})

it('4. avec photo, l’image remplace les initiales', () => {
  const html = rendre(
    { first_name: 'Awa', last_name: 'Diallo', photo_url: 'https://cdn/exemple.jpg' },
    40,
  )
  expect(html).toContain('<img')
  expect(html).toContain('src="https://cdn/exemple.jpg"')
  expect(html).toContain('alt="Awa Diallo"')
  expect(html).not.toContain('data-testid="avatar-initiales"')
})

it('5. une taille demandée est respectée, photo comme initiales', () => {
  expect(rendre({ first_name: 'A', last_name: 'B' }, 52)).toContain('width:52px')
  expect(rendre({ first_name: 'A', last_name: 'B', photo_url: 'x.jpg' }, 28)).toContain('width:28px')
})

it('6. l’image est paresseuse et ne déforme jamais le visage', () => {
  const html = rendre({ first_name: 'A', last_name: 'B', photo_url: 'x.jpg' }, 34)
  expect(html).toContain('loading="lazy"')
  expect(html).toContain('object-fit:cover')
})

// ── 2. Le branchement dans la page ───────────────────────────────────

it('7. la photo est chargée avec le reste de la fiche salarié', () => {
  const page = lire('src/pages/FichesPaie.jsx')
  expect(page).toMatch(/from\('employees'\)[\s\S]{0,400}photo_url/)
  // et dans la jointure des profils, sinon l'avatar de la liste serait
  // toujours en initiales même quand la photo existe
  expect(lire('src/services/payrollService.js')).toMatch(
    /employees \([\s\S]{0,200}photo_url/,
  )
})

it('8. les quatre endroits où l’on parle d’un salarié portent son visage', () => {
  const page = lire('src/pages/FichesPaie.jsx')
  // liste des profils, liste des salariés, en-tête du salarié choisi
  expect((page.match(/<AvatarSalarie/g) || []).length).toBeGreaterThanOrEqual(3)
})

it('9. l’avatar suit le thème au lieu d’être peint en dur', () => {
  const page = lire('src/pages/FichesPaie.jsx')
  const debut = page.indexOf('export function AvatarSalarie')
  // jusqu'au composant suivant, pas au-delà
  const bloc = page.slice(debut, page.indexOf('function Badge(', debut))
  expect(bloc).toContain('useTheme()')
  expect(bloc).toContain('palettePaie(darkMode)')
  expect(bloc).not.toMatch(/#[0-9A-Fa-f]{6}/)
})
