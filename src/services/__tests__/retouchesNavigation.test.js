// ═══════════════════════════════════════════════════════════
// LES RETOUCHES DE NAVIGATION — ce qui doit rester vrai
//
//   ① le profil est cliquable, dans la barre du haut comme dans la
//     barre latérale, et mène à la page Administrateurs ;
//   ② un bandeau bogolan (la vraie pièce) suit la barre du haut ;
//   ③ les pages Administrateurs et Entreprises ont leur flèche de
//     retour en haut à gauche ;
//   ④ la barre de filtres du planning se replie, se souvient de son
//     état, et ne perd ni le filtre ni la légende ;
//   ⑤ les survols ne changent que le cadre.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const dashboard = lire('src/components/DashboardExperience.jsx')
const dashboardCss = lire('src/pages/Dashboard.css')
const admins = lire('src/pages/AdminAccounts.jsx')
const adminsCss = lire('src/pages/AdminAccounts.css')
const entreprises = lire('src/pages/Entreprises.jsx')
const entreprisesCss = lire('src/pages/Entreprises.css')
const planning = lire('src/pages/Planning.jsx')
const planningCss = lire('src/pages/PlanningAfroTech.css')

describe('le profil mène à la page Administrateurs', () => {
  it('la barre du haut porte un lien, pas un simple bloc', () => {
    expect(dashboard).toContain('className="topbar-admin topbar-admin--lien"')
    expect(dashboard).toContain('to="/admins"')
    expect(dashboard).toContain('topbar-admin-chevron')
  })

  it('la barre latérale garde son lien', () => {
    expect(dashboard).toContain('className="sidebar-profile-link"')
    expect(dashboard).toContain('to="/admins"')
  })

  it('le lien est dessiné comme un contrôle, pas comme du texte', () => {
    expect(dashboardCss).toContain('.topbar-admin--lien')
    expect(dashboardCss).toMatch(/\.topbar-admin--lien:hover\s*\{[^}]*border-color/)
    expect(dashboardCss).toMatch(/\.sidebar-profile-link:hover\s*\{[^}]*border-color/)
  })
})

describe('le bandeau bogolan de la dashboard', () => {
  it('se pose juste après la barre du haut', () => {
    expect(dashboard).toMatch(/<\/header>\s*\{?\/?\*?[\s\S]{0,600}dashboard-bogolan/)
    expect(dashboard).toContain('className="dashboard-bogolan"')
  })

  it('utilise la vraie pièce de la page Paie', () => {
    expect(dashboardCss).toMatch(/\.dashboard-bogolan\s*\{[\s\S]*paie-bogolan-haut\.webp/)
    expect(dashboardCss).toMatch(/\.dashboard-bogolan\s*\{[\s\S]*background-repeat:\s*repeat-x/)
  })
})

describe('la flèche de retour', () => {
  it('existe en haut à gauche de la page Administrateurs', () => {
    expect(admins).toContain('className="aa-retour"')
    expect(admins).toContain('aria-label="Retour au tableau de bord"')
    expect(admins).toContain('to="/dashboard"')
    expect(adminsCss).toContain('.aa-register .aa-retour')
  })

  it('existe en haut à gauche de la page Entreprises', () => {
    expect(entreprises).toContain('className="en-retour"')
    expect(entreprises).toContain('aria-label="Retour au tableau de bord"')
    expect(entreprisesCss).toContain('.en-page .en-retour')
  })

  it('ne double pas le retour déjà présent dans les actions', () => {
    expect(entreprises).not.toContain('Tableau de bord\n            </button>')
    expect(entreprisesCss).toMatch(/\.en-page \.en-retour:hover\s*\{[^}]*border-color/)
  })

  it('ne change pas le fond ni le texte au survol', () => {
    const survol = adminsCss.match(/\.aa-register \.aa-retour:hover\s*\{[^}]*\}/)[0]
    expect(survol).not.toContain('background')
    expect(survol).not.toMatch(/(^|[\s;{])color:/)
  })
})

describe('la barre de filtres du planning se replie', () => {
  it('le repli est un vrai contrôle, annoncé aux lecteurs d’écran', () => {
    expect(planning).toContain('className="sk-focus-toggle"')
    expect(planning).toContain('aria-expanded={legendeOuverte}')
    expect(planning).toContain('aria-controls="sk-focus-corps"')
  })

  it('le corps disparaît quand la barre est repliée', () => {
    expect(planning).toMatch(/\{legendeOuverte && \(\s*<div className="sk-focus-corps"/)
    expect(planning).toContain('is-repliee')
  })

  it('garde le choix d’une visite à l’autre', () => {
    expect(planning).toContain('planning_legende_ouverte')
    expect(planning).toContain('localStorage.setItem("planning_legende_ouverte", String(suite))')
  })

  it('garde le filtre et la légende dans le corps', () => {
    expect(planning).toContain('sk-focus-left')
    expect(planning).toContain('sk-focus-count')
    expect(planning).toContain('sk-legend-title">Signaux')
  })

  it('annonce le résumé quand elle est repliée', () => {
    expect(planning).toContain('sk-focus-resume')
    expect(planning).toContain('filtre actif')
  })

  it('la feuille de style suit le repli', () => {
    expect(planningCss).toContain('.sk-focus-tete')
    expect(planningCss).toContain('.sk-focus-corps')
    expect(planningCss).toMatch(/\.sk-focus-bar\.is-repliee \.sk-focus-chevron\s*\{[^}]*rotate\(-90deg\)/)
  })

  it('le survol du bouton ne touche qu’au cadre', () => {
    const survol = planningCss.match(/\.sk-focus-toggle:hover\s*\{[^}]*\}/)[0]
    expect(survol).not.toContain('background')
    expect(survol).not.toMatch(/(^|[\s;{])color:/)
    expect(survol).toContain('border-color')
  })
})
