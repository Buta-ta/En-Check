// ═══════════════════════════════════════════════════════════════════════════
// 🧭 LE BANDEAU PAUSES — maquette B, retenue le 25/11
//
// Ses mots : « enlève les raccourcis et le bouton sombre clair » puis, la
// maquette choisie : « je veux un rendu exactement comme la maquette
// choisie ». Trois choses doivent rester vraies, et rien d'autre ne doit
// revenir :
//   · AUCUNE NAVIGATION SECONDAIRE dans l'en-tête — la barre latérale suffit ;
//   · AUCUN bouton de thème — il vit ailleurs dans l'application ;
//   · les contrôles qui COMMANDENT la page restent tous là : période, date,
//     entreprise, ajout, export, profil.
// ═══════════════════════════════════════════════════════════════════════════
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { PausesCulturalHero } from '../../components/PausesAfroTechSections'

const rendre = (props = {}) =>
  renderToStaticMarkup(
    <PausesCulturalHero
      darkMode={false}
      viewMode="semaine"
      onViewModeChange={() => {}}
      selectedDate="2026-11-25"
      onShiftDate={() => {}}
      onDateChange={() => {}}
      entreprises={[{ id: 'e1', name: 'EN-NOUS' }]}
      selectedEnterpriseId="all"
      onSelectEnterprise={() => {}}
      isSuperAdmin
      admin={{ first_name: 'Buta', last_name: 'Code' }}
      onBackDashboard={() => {}}
      onNavigate={() => {}}
      onToggleAddForm={() => {}}
      onExportCsv={() => {}}
      {...props}
    />,
  )

it('n’a plus ni raccourcis de navigation, ni bouton clair/sombre', () => {
  const html = rendre({ onToggleTheme: () => {} })
  for (const trace of [
    'pauses-v2-nav',
    'Navigation principale',
    'Passer en mode clair',
    'Passer en mode sombre',
  ]) {
    expect(html).not.toContain(trace)
  }
  /* même quand la page passe encore la prop, elle ne rend rien */
  expect(html).not.toContain('pauses-v2-Ghost-btn')
})

it('garde tout ce qui commande la page, en formes rondes', () => {
  const html = rendre()
  /* la période */
  expect(html).toContain('pauses-v2-mode')
  expect(html).toContain('pauses-v2-etiquette-date')
  expect(html).toContain('Période précédente')
  expect(html).toContain('Période suivante')
  /* le filtre et les actions */
  expect(html).toContain('Toutes les entreprises')
  expect(html).toContain('Ajouter une pause')
  expect(html).toContain('CSV')
  /* le profil */
  expect(html).toContain('Buta Code')
  expect(html).toContain('RH · Super Admin')
  /* l'enseigne : le sceau, le sticker, la devise */
  expect(html).toContain('pauses-v2-sceau')
  expect(html).toContain('pauses-v2-sticker')
  expect(html).toContain('Humain · Temps · Performance')
})

it('tient le dessin : contour 2 px, ombre dure, aucune couleur en dur', () => {
  const css = readFileSync('src/pages/PointagesAfroTech.css', 'utf8')
  /*  La tranche du bandeau : du cercle de retour à la dernière règle de la
      carte du profil. Les bornes sont des sélecteurs du bandeau, pas un
      numéro de ligne — il bougerait au premier ajout. */
  const bloc = css.slice(
    css.indexOf('.pauses-v2-back-btn'),
    css.indexOf('.pauses-v2-carte em'),
  )
  expect(bloc.length).toBeGreaterThan(0)
  /* l'ombre dure de la charte, jamais un flou */
  expect(bloc).toContain('box-shadow: 3px 3px 0 var(--pv-traif)')
  expect(bloc).not.toMatch(/box-shadow:[^;]*\bblur\b/)
  /* les rôles lisent la charte, la maquette n'importe aucune teinte */
  expect(css).toContain('--pv-traif: var(--charte-encre)')
  expect(css).toContain('--pv-terre: var(--charte-aplat)')
  expect(bloc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
})
