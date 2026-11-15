// ═══════════════════════════════════════════════════════════
// 🧭 ANALYTICS DU SITE — le journal, la carte et les visites
//
// Ce que ces tests défendent :
//
//   ① les trois écrans n'en font plus qu'un : une route, deux
//     redirections, une entrée de menu, un motif ;
//   ② la toile de korhogo est bien celle de la page, en haut et
//     en bas, et l'ancien panneau du tableau de bord a disparu ;
//   ③ la bibliothèque `analyticsSite.js` lit les traces sans
//     inventer : noms, taux, durées, jours, lieux, purge, CSV ;
//   ④ les gestes marchent : filtrer, chercher, déplier, exporter,
//     sélectionner, purger après avoir tapé « PURGER » ;
//   ⑤ la page se lit : stèles, sommaire, cartouches de toile,
//     aucun emoji, aucun style en ligne, aucun nom technique ;
//   ⑥ le survol ne touche ni le fond, ni la couleur, ni l'opacité.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import AnalyticsSite from '../../pages/AnalyticsSite'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import {
  centreDe, construireCSV, dateHeure, dureeLisible, estReussie, libelleAppareil,
  libelleSection, maximumDe, motifsDeRefus, nomUtilisateur, partPourcent,
  resumeDesLieux, tauxReussite, tempsRelatif, tracesASupprimer, visitesParJour,
} from '../../lib/analyticsSite'

// ── la fausse base ─────────────────────────────────────────
const { faux } = vi.hoisted(() => {
  const journal = []
  const tables = { connection_logs: [], enterprises: [], landing_page_visits: [] }

  const executer = (etat) => {
    const lignes = tables[etat.table] || []
    const retenues = lignes.filter((ligne) => etat.filtres.every((filtre) => filtre(ligne)))

    if (etat.action === 'delete') {
      const ids = retenues.map((ligne) => ligne.id)
      tables[etat.table] = lignes.filter((ligne) => !ids.includes(ligne.id))
      journal.push({ table: etat.table, action: 'delete', appels: [...etat.appels], nombre: ids.length })
      return { data: null, error: null }
    }

    const vues = etat.limite ? retenues.slice(0, etat.limite) : retenues
    journal.push({ table: etat.table, action: 'select', appels: [...etat.appels], nombre: vues.length })
    return { data: vues.map((ligne) => ({ ...ligne })), error: null }
  }

  const fabriquer = (table) => {
    const etat = { table, action: 'select', filtres: [], appels: [], limite: null }
    const chaine = {
      select: () => chaine,
      eq: (colonne, valeur) => {
        etat.filtres.push((ligne) => ligne[colonne] === valeur)
        etat.appels.push(`eq:${colonne}=${valeur}`)
        return chaine
      },
      gte: (colonne, valeur) => {
        etat.filtres.push((ligne) => new Date(ligne[colonne]) >= new Date(valeur))
        etat.appels.push(`gte:${colonne}`)
        return chaine
      },
      lte: (colonne, valeur) => {
        etat.filtres.push((ligne) => new Date(ligne[colonne]) <= new Date(valeur))
        etat.appels.push(`lte:${colonne}`)
        return chaine
      },
      lt: (colonne, valeur) => {
        etat.filtres.push((ligne) => new Date(ligne[colonne]) < new Date(valeur))
        etat.appels.push(`lt:${colonne}`)
        return chaine
      },
      not: (colonne, operateur, valeur) => {
        if (operateur === 'is' && valeur === null) {
          etat.filtres.push((ligne) => ligne[colonne] != null)
          etat.appels.push(`not:${colonne}`)
        }
        return chaine
      },
      in: (colonne, valeurs) => {
        etat.filtres.push((ligne) => valeurs.includes(ligne[colonne]))
        etat.appels.push(`in:${colonne}=${valeurs.length}`)
        return chaine
      },
      order: () => chaine,
      limit: (nombre) => { etat.limite = nombre; etat.appels.push(`limit:${nombre}`); return chaine },
      delete: () => { etat.action = 'delete'; return chaine },
      then: (resoudre, rejeter) => Promise.resolve().then(() => executer(etat)).then(resoudre, rejeter),
    }
    return chaine
  }

  return {
    faux: {
      journal,
      tables,
      from: fabriquer,
      vider() {
        journal.length = 0
        tables.connection_logs = []
        tables.enterprises = []
        tables.landing_page_visits = []
      },
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => faux.from(table),
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
  supabaseEmployee: { from: (table) => faux.from(table) },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: () => {} }),
}))

vi.mock('../../services/pdfExportService', () => ({
  exportAnalyticsToPDF: vi.fn(async () => {}),
  exportAnalyticsToCSV: vi.fn(),
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const PAGE = lire('src/pages/AnalyticsSite.jsx')
const CSS = lire('src/pages/AnalyticsSite.css')
const CARTE = lire('src/components/CarteConnexions.jsx')
const CARTE_CSS = lire('src/components/CarteConnexions.css')
const LIB = lire('src/lib/analyticsSite.js')
const APP = lire('src/App.jsx')
const MENU = lire('src/components/DashboardExperience.jsx')
const MOTIFS = lire('src/components/culturalMotif.js')

// ── les données ────────────────────────────────────────────
const ilYA = (jours, heures = 9) => {
  const date = new Date()
  date.setDate(date.getDate() - jours)
  date.setHours(heures, 12, 0, 0)
  return date.toISOString()
}

const trace = (extra = {}) => ({
  id: 'c-1',
  user_type: 'employee',
  admin_id: null,
  employee_id: 'e-1',
  enterprise_id: 'ent-1',
  success: true,
  connected_at: ilYA(0, 8),
  ip_address: '41.85.12.4',
  city: 'Cotonou',
  country: 'Bénin',
  device_type: 'mobile',
  user_agent: 'Mozilla/5.0 (Linux; Android 13)',
  login_method: 'mot_de_passe',
  latitude: 6.3654,
  longitude: 2.4183,
  failure_reason: null,
  admins: null,
  employees: { id: 'e-1', first_name: 'Alice', last_name: 'Houngbo', matricule: 'EMP-014' },
  enterprises: { id: 'ent-1', name: 'Sèmè City' },
  ...extra,
})

const visite = (extra = {}) => ({
  id: 'v-1',
  created_at: ilYA(0, 10),
  country: 'Bénin',
  country_code: 'BJ',
  city: 'Cotonou',
  device_type: 'mobile',
  duration_seconds: 84,
  is_returning: false,
  sections_viewed: ['hero', 'pricing'],
  cta_clicks: [{ name: 'Essayer gratuitement' }],
  ...extra,
})

const ADMIN = { id: 'adm-1', role: 'super_admin', first_name: 'Rosine' }

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  faux.vider()

  faux.tables.enterprises = [
    { id: 'ent-1', name: 'Sèmè City', is_active: true },
    { id: 'ent-2', name: 'Porte du Non-Retour', is_active: true },
  ]

  faux.tables.connection_logs = [
    trace(),
    trace({
      id: 'c-2', user_type: 'admin', admin_id: 'adm-1', employee_id: null,
      connected_at: ilYA(1, 7), device_type: 'desktop', city: 'Porto-Novo',
      latitude: 6.4969, longitude: 2.6289,
      admins: { id: 'adm-1', email: 'rosine@encheck.bj', first_name: 'Rosine', last_name: 'Adjovi', role: 'super_admin' },
      employees: null,
    }),
    trace({
      id: 'c-3', success: false, connected_at: ilYA(2, 21),
      failure_reason: 'Mot de passe incorrect', employee_id: null,
      employees: { id: 'e-9', first_name: 'Boris', last_name: 'Kiki', matricule: 'EMP-031' },
      latitude: null, longitude: null, city: null, country: null,
    }),
    trace({
      id: 'c-4', connected_at: ilYA(45, 6), city: 'Abomey',
      latitude: 7.1825, longitude: 1.9921,
      employees: { id: 'e-2', first_name: 'Céline', last_name: 'Dossou', matricule: 'EMP-008' },
    }),
  ]

  faux.tables.landing_page_visits = [
    visite(),
    visite({ id: 'v-2', created_at: ilYA(1, 15), country: 'France', country_code: 'FR', city: 'Lyon', device_type: 'desktop', duration_seconds: 240, is_returning: true }),
    visite({ id: 'v-3', created_at: ilYA(3, 11), country: 'Bénin', country_code: 'BJ', city: 'Parakou', device_type: 'tablet', duration_seconds: 5 }),
  ]

  URL.createObjectURL = vi.fn(() => 'blob:analytics')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
})

afterEach(() => {
  act(() => racine.unmount())
  hote.remove()
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})

const laisser = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

async function ouvrir(chemin = '/analytics', admin = ADMIN) {
  localStorage.setItem('admin', JSON.stringify(admin))
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={[chemin]}>
        <AnalyticsSite />
      </MemoryRouter>,
    )
  })
  await laisser()
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes(texte))
const onglet = (texte) => [...hote.querySelectorAll('.an-onglet')].find((b) => b.textContent.includes(texte))

async function cliquer(element) {
  expect(element, 'le contrôle à cliquer doit exister').toBeTruthy()
  await act(async () => element.click())
  await laisser()
}

function saisir(champ, valeur) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(champ, valeur)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
}

async function ecrire(champ, valeur) {
  expect(champ).toBeTruthy()
  await act(async () => saisir(champ, valeur))
}

const dernier = (action, table) =>
  [...faux.journal].reverse().find((entree) => entree.action === action && entree.table === table)

// ═══════════════════════════════════════════════════════════
// 1. UNE SEULE PAGE
// ═══════════════════════════════════════════════════════════

describe('1. trois écrans, une seule page', () => {
  it('n’a plus de pages séparées', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/pages/ConnectionLogs.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/pages/ConnectionsMap.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/pages/LandingAnalytics.jsx'))).toBe(false)
    expect(APP).not.toContain("from './pages/ConnectionLogs'")
    expect(APP).not.toContain("from './pages/ConnectionsMap'")
    expect(APP).not.toContain("from './pages/LandingAnalytics'")
  })

  it('sert la page sur /analytics et renvoie les anciennes adresses', () => {
    expect(APP).toContain("import AnalyticsSite from './pages/AnalyticsSite'")
    expect(APP).toContain('<Route path="/analytics"')
    expect(APP).toContain('<Route path="/connexions" element={<Navigate to="/analytics" replace />} />')
    expect(APP).toContain('<Route path="/connexions-map" element={<Navigate to="/analytics?vue=carte" replace />} />')
  })

  it('ne garde qu’une entrée de menu', () => {
    expect(MENU).toContain("label: 'Analytics du site'")
    expect(MENU).not.toContain("label: 'Journal des connexions'")
    expect(MENU).not.toContain("label: 'Carte des connexions'")
    expect(MENU.match(/'\/analytics'/g)).toHaveLength(1)
    expect(MENU).not.toContain('/connexions')
  })

  it('a retiré le panneau d’analytics du tableau de bord', () => {
    expect(MENU).not.toContain('LandingAnalytics')
    expect(MENU).not.toContain('dashboard-analytics-panel')
    expect(MENU).not.toContain('showAnalytics')
  })

  it('ne laisse aucun pointeur mort vers les anciennes routes', () => {
    const fichiers = []
    const parcourir = (dossier) => {
      for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
        const complet = path.join(dossier, entree.name)
        if (entree.isDirectory()) {
          if (entree.name !== '__tests__') parcourir(complet)
        } else if (/\.(jsx?|tsx?)$/.test(entree.name)) fichiers.push(complet)
      }
    }
    parcourir(path.join(ROOT, 'src'))
    const pointeurs = fichiers.filter((fichier) => {
      if (fichier.endsWith('App.jsx')) return false
      const source = fs.readFileSync(fichier, 'utf8')
      return /['"`]\/connexions(-map)?['"`]/.test(source)
    })
    expect(pointeurs.map((f) => path.relative(ROOT, f))).toEqual([])
    expect(APP).toContain('/connexions-map')
  })
})

// ═══════════════════════════════════════════════════════════
// 2. LA TOILE DE KORHOGO
// ═══════════════════════════════════════════════════════════

describe('2. la toile de korhogo', () => {
  it('devient le motif de la page, y compris pour les anciennes adresses', () => {
    expect(culturalMotifForPath('/analytics')).toBe('korhogo')
    expect(culturalMotifForPath('/analytics?vue=carte')).toBe('korhogo')
    expect(culturalMotifForPath('/connexions')).toBe('korhogo')
    expect(culturalMotifForPath('/connexions-map')).toBe('korhogo')
    expect(MOTIFS).toContain("['analytics', 'connexions', 'connexions-map']")
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
  })

  it('pose le vrai bandeau, en haut et en bas', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/analytics" />)
    expect(html).toContain('data-cultural-motif="korhogo"')
    expect(html).toContain('<svg')
    expect(PAGE).toContain('<PageCulturalBand pathname="/analytics" />')
    expect(PAGE).toContain('placement="bottom"')
  })

  it('garde la bascule clair/sombre propre à la page', () => {
    expect(PAGE).toContain('useTheme')
    expect(PAGE).toContain('role="switch"')
    expect(CSS).toContain('.an-page.an-clair')
    expect(CSS).toMatch(/--an-fumee:/)
    expect(CSS).toMatch(/--an-coton:/)
    expect(CSS).toMatch(/--an-ocre:/)
  })

  it('tient la carte hors de la page tant qu’on ne la demande pas', () => {
    expect(CARTE_CSS).toContain('.an-epingle')
    expect(CARTE_CSS).toContain('.an-amas')
    expect(CARTE_CSS).toContain('.an-bulle')
    expect(CARTE_CSS).toContain('.an-carte-attente-chevrons')
    expect(PAGE).toContain("vue === 'carte'")
  })
})

// ═══════════════════════════════════════════════════════════
// 3. LA BIBLIOTHÈQUE
// ═══════════════════════════════════════════════════════════

describe('3. ce que les traces disent', () => {
  it('nomme les gens sans nom technique', () => {
    expect(nomUtilisateur(trace())).toBe('Alice Houngbo')
    expect(nomUtilisateur(trace({ employees: null }))).toBe('Employé')
    expect(nomUtilisateur(trace({ user_type: 'admin', admins: null }))).toBe('Administrateur')
    expect(nomUtilisateur(trace({ user_type: 'admin', admins: { first_name: 'Rosine', last_name: 'Adjovi' } }))).toBe('Rosine Adjovi')
    expect(LIB).toContain("trace?.user_type === 'admin'")
  })

  it('calcule un taux sans arrondir au hasard', () => {
    expect(tauxReussite([])).toBe(0)
    expect(tauxReussite([trace(), trace({ success: false })])).toBe(50)
    expect(tauxReussite([trace(), trace(), trace({ id: 'x', success: false })])).toBe(67)
    expect(estReussie({})).toBe(true)
    expect(estReussie({ success: false })).toBe(false)
    expect(partPourcent(3, 4)).toBe(75)
    expect(partPourcent(3, 0)).toBe(0)
  })

  it('écrit les durées et les instants en français court', () => {
    expect(dureeLisible(0)).toBe('0 s')
    expect(dureeLisible(45)).toBe('45 s')
    expect(dureeLisible(134)).toBe('2 min 14')
    expect(dureeLisible(3900)).toBe('1 h 05')
    const maintenant = new Date('2026-10-27T12:00:00Z')
    expect(tempsRelatif('2026-10-27T11:58:00Z', maintenant)).toBe('il y a 2 min')
    expect(tempsRelatif('2026-10-27T09:00:00Z', maintenant)).toBe('il y a 3 h')
    expect(tempsRelatif('2026-10-25T12:00:00Z', maintenant)).toBe('il y a 2 j')
    expect(tempsRelatif(null, maintenant)).toBe('—')
  })

  it('remplit les jours vides du graphique', () => {
    const serie = visitesParJour(
      [{ created_at: '2026-10-26T10:00:00Z' }, { created_at: '2026-10-26T18:00:00Z' }],
      3,
      new Date('2026-10-27T12:00:00Z'),
    )
    expect(serie).toHaveLength(3)
    expect(serie.reduce((somme, jour) => somme + jour.nombre, 0)).toBe(2)
    expect(serie.map((jour) => jour.nombre)).toEqual([0, 2, 0])
    expect(maximumDe(serie)).toBe(2)
    expect(maximumDe([])).toBe(0)
  })

  it('regroupe les lieux au millième de degré', () => {
    const lieux = resumeDesLieux([
      trace(), trace({ id: 'c-2', latitude: 6.36541, longitude: 2.41832 }),
      trace({ id: 'c-3', latitude: 7.18, longitude: 1.99 }),
      trace({ id: 'c-4', latitude: null, longitude: null }),
    ])
    expect(lieux.lieuxDistincts).toBe(2)
    expect(lieux.lieuxSuperposes).toBe(1)
    expect(lieux.empilementMax).toBe(2)
    expect(centreDe([])).toBeNull()
    expect(centreDe([trace({ latitude: 6, longitude: 2 }), trace({ id: 'z', latitude: 8, longitude: 4 })])).toEqual([7, 3])
  })

  it('dit combien de traces une purge emporterait', () => {
    const maintenant = new Date('2026-10-27T12:00:00Z')
    const traces = [
      { connected_at: '2026-10-26T12:00:00Z' },
      { connected_at: '2026-08-01T12:00:00Z' },
      { connected_at: null },
    ]
    expect(tracesASupprimer(traces, 30, maintenant)).toBe(1)
    expect(tracesASupprimer(traces, 0, maintenant)).toBe(3)
  })

  it('écrit un CSV lisible par un tableur, refus compris', () => {
    const csv = construireCSV([trace(), trace({ id: 'c-9', success: false, failure_reason: 'Mot de passe incorrect' })])
    const lignes = csv.split('\n')
    expect(lignes).toHaveLength(3)
    expect(lignes[0]).toContain('"Quand";"Type";"Nom"')
    expect(lignes[0]).toContain('"Motif du refus"')
    expect(lignes[1]).toContain('"Alice Houngbo"')
    expect(lignes[1]).toContain('"Sèmè City"')
    expect(lignes[1]).toContain('"Mobile"')
    expect(lignes[1]).toContain('"Réussie"')
    expect(lignes[2]).toContain('"Refusée"')
    expect(lignes[2]).toContain('"Mot de passe incorrect"')
    expect(LIB).toContain("replace(/\"/g, '\"\"')")
  })

  it('compte les motifs de refus, du plus fréquent au plus rare', () => {
    const motifs = motifsDeRefus([
      trace({ id: 'a', success: false, failure_reason: 'Mot de passe incorrect' }),
      trace({ id: 'b', success: false, failure_reason: 'Mot de passe incorrect' }),
      trace({ id: 'c', success: false, failure_reason: '' }),
      trace({ id: 'd', success: true }),
    ])
    expect(motifs[0]).toEqual({ motif: 'Mot de passe incorrect', nombre: 2 })
    expect(motifs[1]).toEqual({ motif: 'Motif non renseigné', nombre: 1 })
    expect(motifs).toHaveLength(2)
  })

  it('donne des noms français aux appareils et aux sections', () => {
    expect(libelleAppareil('desktop')).toBe('Bureau')
    expect(libelleAppareil('mobile')).toBe('Mobile')
    expect(libelleAppareil('tablet')).toBe('Tablette')
    expect(libelleAppareil('montre')).toBe('Inconnu')
    expect(libelleSection('pricing')).toBe('Tarifs')
    expect(libelleSection('hero')).toBe('Accueil')
    expect(libelleSection('inconnue')).toBe('inconnue')
  })

  it('formate une date sans planter sur du vide', () => {
    expect(dateHeure(null)).toBe('—')
    expect(dateHeure('pas une date')).toBe('—')
    expect(dateHeure('2026-10-26T08:12:00Z')).toContain('2026')
  })
})

// ═══════════════════════════════════════════════════════════
// 4. LA PAGE — JOURNAL
// ═══════════════════════════════════════════════════════════

describe('4. le journal des connexions', () => {
  it('affiche les stèles, le sommaire et les traces', async () => {
    await ouvrir()
    expect(hote.querySelectorAll('.an-stele')).toHaveLength(4)
    expect(hote.querySelector('.an-stele').textContent).toContain('Connexions')
    expect(hote.querySelectorAll('.an-onglet')).toHaveLength(3)
    expect(hote.querySelector('.an-onglet[aria-selected="true"]').textContent).toContain('Connexions')
    expect(hote.querySelector('#an-vue-connexions')).not.toBeNull()
    const lignes = hote.querySelectorAll('.an-tableau-ligne')
    expect(lignes.length).toBe(4)
    expect(hote.textContent).toContain('Alice Houngbo')
    expect(hote.textContent).toContain('Sèmè City')
    expect(hote.textContent).toContain('Réussie')
    expect(hote.textContent).toContain('Refusée')
  })

  it('n’affiche pas les anciens emojis ni les noms de tables', async () => {
    await ouvrir()
    expect(hote.innerHTML).not.toMatch(/connection_logs|landing_page_visits|user_type|enterprise_id/)
    expect(hote.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })

  it('cherche dans la liste sans rappeler le serveur', async () => {
    await ouvrir()
    const avant = faux.journal.length
    await ecrire(hote.querySelector('.an-recherche input'), 'Porto')
    expect(hote.querySelectorAll('.an-tableau-ligne')).toHaveLength(1)
    expect(hote.textContent).toContain('Rosine Adjovi')
    expect(faux.journal.length).toBe(avant)
    await ecrire(hote.querySelector('.an-recherche input'), 'zzz')
    expect(hote.querySelectorAll('.an-tableau-ligne')).toHaveLength(0)
    expect(hote.textContent).toContain('Aucune trace ne correspond')
  })

  it('filtre par type et par état côté serveur', async () => {
    await ouvrir()
    await cliquer([...hote.querySelectorAll('.an-filtre')].find((b) => b.textContent === 'Admins'))
    expect(dernier('select', 'connection_logs').appels).toContain('eq:user_type=admin')
    await cliquer([...hote.querySelectorAll('.an-filtre')].find((b) => b.textContent === 'Refusées'))
    expect(dernier('select', 'connection_logs').appels).toContain('eq:success=false')
    await cliquer([...hote.querySelectorAll('.an-filtre')].find((b) => b.textContent === 'Réussies'))
    expect(dernier('select', 'connection_logs').appels).toContain('eq:success=true')
  })

  it('déplie une trace pour montrer le motif du refus', async () => {
    await ouvrir()
    const ligneRefus = [...hote.querySelectorAll('.an-tableau-ligne')].find((l) => l.textContent.includes('Boris Kiki'))
    expect(ligneRefus).toBeTruthy()
    expect(hote.querySelector('.an-detail')).toBeNull()
    await cliquer(ligneRefus.querySelector('.an-deplier'))
    const detail = hote.querySelector('.an-detail')
    expect(detail).not.toBeNull()
    expect(detail.textContent).toContain('Mot de passe incorrect')
    expect(detail.textContent).toContain('Adresse IP')
    await cliquer(hote.querySelector('.an-detail').parentElement.querySelector('.an-deplier'))
    expect(hote.querySelector('.an-detail')).toBeNull()
  })

  it('exporte le CSV filtré', async () => {
    await ouvrir()
    const cree = URL.createObjectURL
    await cliquer(bouton('Exporter'))
    expect(cree).toHaveBeenCalledTimes(1)
    expect(hote.textContent).toContain('connexions exportées')
  })

  it('sélectionne, puis purge après avoir tapé « PURGER »', async () => {
    await ouvrir()
    await cliquer(bouton('Sélectionner'))
    expect(hote.querySelectorAll('.an-case')).toHaveLength(4)
    await cliquer(bouton('Tout cocher'))
    expect(hote.textContent).toContain('4 traces choisies')
    await cliquer(bouton('Supprimer la sélection'))
    const fenetre = hote.querySelector('.an-fenetre')
    expect(fenetre).not.toBeNull()
    expect(fenetre.textContent).toContain('Supprimer 4 traces ?')
    const confirmer = [...fenetre.querySelectorAll('button')].find((b) => b.textContent.includes('Supprimer 4'))
    expect(confirmer.disabled).toBe(true)
    await ecrire(fenetre.querySelector('input'), 'PURGER')
    expect(confirmer.disabled).toBe(false)
    await cliquer(confirmer)
    expect(dernier('delete', 'connection_logs').nombre).toBe(4)
    expect(hote.textContent).toContain('4 traces supprimées')
  })

  it('n’efface rien sans le mot de confirmation', async () => {
    await ouvrir()
    await cliquer(bouton('Purger'))
    const fenetre = hote.querySelector('.an-fenetre')
    expect(fenetre.textContent).toContain('de plus de 30 jours')
    const confirmer = [...fenetre.querySelectorAll('button')].find((b) => b.textContent.includes('Supprimer'))
    expect(confirmer.disabled).toBe(true)
    await ecrire(fenetre.querySelector('input'), 'purger')
    expect(confirmer.disabled).toBe(false)
    await ecrire(fenetre.querySelector('input'), 'EFFACER')
    expect(confirmer.disabled).toBe(true)
    await cliquer(bouton('Annuler'))
    expect(hote.querySelector('.an-fenetre')).toBeNull()
    expect(dernier('delete', 'connection_logs')).toBeUndefined()
  })

  it('explique ce que la purge garde', async () => {
    await ouvrir()
    await cliquer(bouton('Purger'))
    const fenetre = hote.querySelector('.an-fenetre')
    expect(fenetre.textContent).toContain('Cette action est définitive')
    expect(fenetre.textContent).toContain('reste dans l’historique')
    expect(fenetre.textContent).toContain('PURGER')
  })
})

// ═══════════════════════════════════════════════════════════
// 5. LA PAGE — VISITES
// ═══════════════════════════════════════════════════════════

describe('5. les visites du site', () => {
  it('change de vue et affiche les cartouches de toile', async () => {
    await ouvrir()
    await cliquer(onglet('Visites du site'))
    expect(hote.querySelector('#an-vue-visites')).not.toBeNull()
    expect(hote.querySelectorAll('.an-cartouche-valeur')).toHaveLength(4)
    expect(hote.querySelector('.an-cartouche').textContent).toContain('Visites')
    expect(hote.textContent).toContain('Bénin')
    expect(hote.textContent).toContain('Mobile')
    expect(hote.textContent).toContain('Tarifs')
    expect(hote.textContent).toContain('Essayer gratuitement')
    expect(hote.querySelectorAll('.an-graphique-colonne')).toHaveLength(14)
  })

  it('ouvre la vue carte depuis l’adresse ?vue=carte', async () => {
    await ouvrir('/analytics?vue=carte')
    expect(hote.querySelector('#an-vue-carte')).not.toBeNull()
    expect(hote.querySelector('.an-onglet[aria-selected="true"]').textContent).toContain('Carte')
    expect(hote.textContent).toContain('géolocalisée')
  })

  it('supprime une visite après confirmation', async () => {
    await ouvrir()
    await cliquer(onglet('Visites du site'))
    const poubelle = [...hote.querySelectorAll('.an-visites-recentes .an-lien--danger')][0]
    await cliquer(poubelle)
    expect(hote.querySelector('.an-fenetre').textContent).toContain('Supprimer cette visite ?')
    await cliquer([...hote.querySelectorAll('.an-fenetre button')].find((b) => b.textContent.includes('Supprimer')))
    expect(dernier('delete', 'landing_page_visits')).toBeTruthy()
    expect(hote.textContent).toContain('La visite est supprimée')
  })

  it('supprime les visites d’un pays par son code', async () => {
    await ouvrir()
    await cliquer(onglet('Visites du site'))
    const pays = [...hote.querySelectorAll('.an-jauge-libelle--lien')].find((b) => b.textContent.includes('France'))
    await cliquer(pays)
    expect(hote.querySelector('.an-fenetre').textContent).toContain('Supprimer les visites de France ?')
    await cliquer([...hote.querySelectorAll('.an-fenetre button')].find((b) => b.textContent.includes('Supprimer')))
    expect(dernier('delete', 'landing_page_visits').appels).toContain('eq:country_code=FR')
  })
})

// ═══════════════════════════════════════════════════════════
// 6. LE DESSIN
// ═══════════════════════════════════════════════════════════

describe('6. la toile, à la lecture', () => {
  it('n’écrit pas de style en ligne ni de toast parallèle', () => {
    expect(PAGE).not.toContain('<style')
    // Les seules valeurs posées en ligne sont des mesures (largeur d'une
    // jauge, hauteur d'une barre), jamais une couleur ni un fond.
    const enLigne = PAGE.split('\n').filter((ligne) => ligne.includes('style={{'))
    expect(enLigne.length).toBeGreaterThan(2)
    enLigne.forEach((ligne) => {
      expect(ligne).not.toMatch(/color|background|border|font/)
    })
    expect(PAGE).not.toContain('toast')
    expect(PAGE).not.toContain('alert(')
    expect(PAGE).not.toContain('confirm(')
  })

  it('n’a aucun emoji dans le dessin', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
    expect(PAGE).not.toMatch(emoji)
    expect(CSS).not.toMatch(emoji)
    expect(CARTE).not.toMatch(emoji)
    expect(PAGE).not.toMatch(/[✓↩•]/u)
  })

  it('ne change au survol ni le fond, ni la couleur, ni l’opacité', () => {
    const blocs = [...CSS.matchAll(/:hover[^{]*\{([^}]*)\}/g)].map((m) => m[1])
    expect(blocs.length).toBeGreaterThan(6)
    blocs.forEach((bloc) => {
      expect(bloc).not.toMatch(/(^|[\s;])color\s*:/)
      expect(bloc).not.toMatch(/(^|[\s;])background(-color)?\s*:/)
      expect(bloc).not.toMatch(/(^|[\s;])opacity\s*:/)
    })
  })

  it('dessine les contrôles au lieu de les laisser nus', () => {
    expect(CSS).toContain('.an-segment')
    expect(CSS).toContain('.an-case')
    expect(CSS).toContain('.an-bouton-creux')
    expect(CSS).toContain('border: 1px solid var(--an-ligne)')
    expect(CSS).toContain('.an-champ input')
    expect(CSS).toContain('.an-bascule-case')
  })

  it('reste lisible sur un téléphone', () => {
    expect(CSS).toContain('@media (max-width: 720px)')
    expect(CSS).toContain('@media (max-width: 980px)')
    expect(CSS).toContain('.an-carte-grille { grid-template-columns: minmax(0, 1fr); }')
    expect(CSS).toContain('prefers-reduced-motion')
  })

  it('garde les raccourcis en haut, jamais en bas', () => {
    const positions = [...PAGE.matchAll(/<RaccourcisPages[^>]*>/g)].map((m) => m.index)
    expect(positions).toHaveLength(1)
    const pied = PAGE.indexOf('<footer className="an-pied"')
    expect(positions[0]).toBeLessThan(pied)
  })
})

// ═══════════════════════════════════════════════════════════
// 7. LE FOND DE CARTE ET SES CALQUES
// ═══════════════════════════════════════════════════════════

describe('7. un fond de carte sans clé', () => {
  it('n’a plus aucun fournisseur qui réclame une clé', () => {
    expect(CARTE).not.toContain('cartocdn')
    expect(CARTE).not.toContain('carto.com')
    expect(CARTE).not.toContain('api_key')
    expect(CARTE).not.toContain('apikey')
    expect(CARTE).not.toContain('access_token')
    expect(CARTE).not.toContain('maptiler')
    expect(CARTE).not.toContain('stadiamaps')
    expect(CARTE).not.toContain('unpkg.com')
  })

  it('prend le fond gris d’Esri, clair ou sombre, avec ses étiquettes', () => {
    expect(CARTE).toContain('World_Dark_Gray_Base')
    expect(CARTE).toContain('World_Light_Gray_Base')
    expect(CARTE).toContain('World_Dark_Gray_Reference')
    expect(CARTE).toContain('World_Light_Gray_Reference')
    expect(CARTE).toContain('sombre ? FONDS.sombre : FONDS.clair')
    expect(CARTE).toContain('esri.com')
  })

  it('garde OpenStreetMap en second, sans clé non plus', () => {
    expect(CARTE).toContain("url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'")
    expect(CARTE).toContain('openstreetmap.org/copyright')
    expect(CARTE).toContain('FONDS.secours')
  })

  it('essaie un fond, puis l’autre, puis dessine le monde', () => {
    expect(CARTE).toContain('if (erreurs >= 3 && !abandonne)')
    expect(CARTE).toContain('essai += 1')
    expect(CARTE).toContain('if (essai >= 2)')
    expect(CARTE).toContain('dessinerLeMonde()')
    expect(CARTE).toContain('data-fond={fond}')
  })

  it('embarque un monde vectoriel qui ne dépend d’aucun service', () => {
    expect(CARTE).toContain("const MONDE = '/data/monde-110m.geojson'")
    expect(CARTE).toContain('Leaflet.geoJSON(donnees')
    expect(CARTE).toContain("setFond('dessin')")
    expect(fs.existsSync(path.join(ROOT, 'public/data/monde-110m.geojson'))).toBe(true)
  })

  it('le monde embarqué est un vrai GeoJSON de côtes', () => {
    const monde = JSON.parse(lire('public/data/monde-110m.geojson'))
    expect(monde.type).toBe('FeatureCollection')
    expect(monde.features.length).toBeGreaterThan(0)
    expect(JSON.stringify(monde)).toContain('MultiPolygon')
    // Un monde, pas un caillou : plusieurs milliers de sommets.
    expect(JSON.stringify(monde).length).toBeGreaterThan(20000)
  })

  it('garde ses calques sous la barre de recherche de l’assistant', () => {
    // Sans barrière, les panneaux de Leaflet (z-index 400 à 1000)
    // passent par-dessus la barre fixée en bas de l'écran. `contain`
    // empêche même la peinture de sortir du cadre.
    expect(CARTE_CSS).toContain('isolation: isolate')
    expect(CARTE_CSS).toContain('contain: paint')
    expect(CARTE_CSS).toMatch(/\.an-carte-cadre \{[^}]*z-index: 0;/)
    expect(CARTE_CSS).not.toMatch(/z-index: (1[0-9]{3,}|[2-9][0-9]{2,})/)
    expect(CARTE_CSS).toContain('.an-carte-cadre .leaflet-tile-pane { z-index: 1; }')
    expect(CARTE_CSS).toContain('.an-carte-cadre .leaflet-popup-pane { z-index: 6; }')
  })

  it('ne reste pas figée sur un serveur muet', () => {
    expect(CARTE).toContain("tuiles.on('tileload'")
    expect(CARTE).toContain('}, 4000)')
    expect(CARTE).toContain('if (abandonne || tuilesChargees > 0) return')
  })

  it('reste vivante si plus aucun fond ne répond', () => {
    expect(CARTE).toContain('an-carte-muette')
    expect(CARTE_CSS).toContain('.an-carte-muette')
    expect(CARTE).toContain("setFond('aucun')")
    expect(CARTE).toContain('les épingles restent à leur place')
  })
})
