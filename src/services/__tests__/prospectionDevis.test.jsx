// ═══════════════════════════════════════════════════════════
// 🧭 PROSPECTION — prospect et devis, une seule page
//
// Ce que ces tests défendent :
//
//   ① les deux pages n'en font plus qu'une : une route, une
//     redirection depuis /devis, une entrée de menu, un motif ;
//   ② l'arithmétique du devis n'a pas bougé d'un franc — barème,
//     remises, engagement, échéances, scoring, plancher ;
//   ③ les gestes marchent pour de vrai : chercher, ouvrir une
//     fiche, changer une étape, créer un prospect, enregistrer un
//     devis, changer son statut, le supprimer après confirmation ;
//   ④ la page se lit : pipeline, stèles, devis, appels — sans nom
//     technique, sans emoji, sans formule d'atelier ;
//   ⑤ le survol ne touche ni le fond, ni la couleur, ni l'opacité.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import Prospection from '../../pages/Prospection'
import PageCulturalBand from '../../components/PageCulturalBand'
import { AbomeyBlasonAppliqueSvg } from '../../components/AbomeySvg'
import { culturalMotifForPath } from '../../components/culturalMotif'
import {
  CONFIG_INITIAL, ENGAGEMENTS, appliquerPriorites, calculerDevis, calculerScore,
  echeanceFixe, estLigneSousMinimum, formatF, getEngagementConfig,
  getAlerteMinDetail, nombreDeMois, prixAutoUnitaire, totauxDuDevis,
} from '../../lib/devis'
import { etapeSuivante, joursDeRetard, relanceDue, statutDe } from '../../lib/prospection'

// ── la fausse base ─────────────────────────────────────────
const { faux } = vi.hoisted(() => {
  const journal = []
  const tables = { prospects: [], devis: [] }

  const correspond = (ligne, filtres) =>
    Object.entries(filtres).every(([colonne, valeur]) => ligne[colonne] === valeur)

  const executer = (etat) => {
    const lignes = tables[etat.table] || []

    if (etat.action === 'insert') {
      const ligne = { id: `${etat.table}-${lignes.length + 1}`, ...etat.payload }
      tables[etat.table] = [...lignes, ligne]
      journal.push({ table: etat.table, action: 'insert', payload: { ...etat.payload } })
      return { data: [{ ...ligne }], error: null }
    }

    if (etat.action === 'update') {
      tables[etat.table] = lignes.map((ligne) =>
        correspond(ligne, etat.filtres) ? { ...ligne, ...etat.payload } : ligne)
      journal.push({ table: etat.table, action: 'update', filtres: { ...etat.filtres }, payload: { ...etat.payload } })
      return { data: null, error: null }
    }

    if (etat.action === 'delete') {
      tables[etat.table] = lignes.filter((ligne) => !correspond(ligne, etat.filtres))
      journal.push({ table: etat.table, action: 'delete', filtres: { ...etat.filtres } })
      return { data: null, error: null }
    }

    let vues = lignes.filter((ligne) => correspond(ligne, etat.filtres))
    if (etat.limite) vues = vues.slice(0, etat.limite)
    const donnees = vues.map((ligne) => ({ ...ligne }))
    return { data: etat.head ? null : donnees, count: donnees.length, error: null }
  }

  const fabriquer = (table) => {
    const etat = {
      table, action: 'select', filtres: {}, payload: null,
      head: false, limite: null, unique: false,
    }
    const chaine = {
      select: (_colonnes, options = {}) => {
        if (options.head) etat.head = true
        return chaine
      },
      eq: (colonne, valeur) => { etat.filtres[colonne] = valeur; return chaine },
      order: () => chaine,
      limit: (nombre) => { etat.limite = nombre; return chaine },
      single: () => { etat.unique = true; return chaine },
      maybeSingle: () => { etat.unique = true; return chaine },
      insert: (payload) => { etat.action = 'insert'; etat.payload = payload; return chaine },
      update: (payload) => { etat.action = 'update'; etat.payload = payload; return chaine },
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
        tables.prospects = []
        tables.devis = []
      },
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => faux.from(table),
    rpc: async () => ({ data: null, error: null }),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'adm-1' } } } }) },
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: () => {} }),
}))

vi.mock('html2pdf.js', () => ({
  default: () => ({ set: () => ({ from: () => ({ save: async () => {} }) }) }),
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const PAGE = lire('src/pages/Prospection.jsx')
const CSS = lire('src/pages/Prospection.css')
const ATELIER = lire('src/components/AtelierDevis.jsx')
const ATELIER_CSS = lire('src/components/AtelierDevis.css')
const LIB = lire('src/lib/devis.js')
const DOCS = lire('src/lib/devisDocuments.js')
const PROSPECTION = lire('src/lib/prospection.js')
const APP = lire('src/App.jsx')
const MENU = lire('src/components/DashboardExperience.jsx')
const MOTIFS = lire('src/components/culturalMotif.js')

// ── les données ────────────────────────────────────────────
const prospect = (extra = {}) => ({
  id: 'p-1',
  company_name: 'Maison Adjovi',
  sector: 'Commerce / Retail',
  city: 'Cotonou',
  nb_employees_estimate: 24,
  nb_sites_estimate: 2,
  contact_name: 'Rosine Adjovi',
  contact_phone: '+229 96 12 34 56',
  contact_role: 'Gérante',
  potentiel: 'fort',
  status: 'a_contacter',
  next_contact_date: null,
  notes: null,
  created_at: '2026-10-20T09:00:00.000Z',
  ...extra,
})

const devisEnregistre = (extra = {}) => ({
  id: 'd-1',
  numero: 'DEV-2026-014',
  prospect_id: 'p-1',
  status: 'accepte',
  engagement: 'annuel',
  paiement_fois: 1,
  mois_gratuit: false,
  montant_fixe_net: 960000,
  montant_mensuel_net: 121000,
  montant_annuel_net: 2412000,
  detail_calcul: { lignesFixe: [], lignesMensuel: [], totaux: { nbMois: 12, paiementFois: 1, engagement: 'annuel' } },
  created_at: '2026-10-21T10:00:00.000Z',
  ...extra,
})

const ADMIN = { id: 'adm-1', role: 'super_admin' }

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  faux.vider()

  faux.tables.prospects = [
    prospect(),
    prospect({
      id: 'p-2', company_name: 'Groupe Tossou', sector: 'BTP / Construction', city: 'Cotonou',
      contact_name: 'Serge Tossou', potentiel: 'fort', status: 'en_negociation',
      next_contact_date: '2020-01-01', nb_employees_estimate: 42, nb_sites_estimate: 3,
    }),
    prospect({
      id: 'p-3', company_name: 'Pharmacie Zongo', sector: 'Santé / Médical', city: 'Parakou',
      contact_name: null, contact_phone: null, potentiel: 'moyen', status: 'devis_envoye',
      next_contact_date: '2030-01-01',
    }),
  ]
  faux.tables.devis = [
    devisEnregistre(),
    devisEnregistre({
      id: 'd-2', numero: 'DEV-2026-017', prospect_id: 'p-2', status: 'envoye',
      montant_fixe_net: 1480000, montant_mensuel_net: 184000, montant_annuel_net: 3688000,
    }),
  ]

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

async function ouvrir(admin = ADMIN) {
  localStorage.setItem('admin', JSON.stringify(admin))
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={['/prospection']}>
        <Prospection />
      </MemoryRouter>,
    )
  })
  await laisser()
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes(texte))
const onglet = (texte) => [...hote.querySelectorAll('.ps-onglet')].find((b) => b.textContent.includes(texte))
const carte = (nom) => [...hote.querySelectorAll('.ps-carte')].find((c) => c.textContent.includes(nom))
const lienDans = (conteneur, texte) => [...conteneur.querySelectorAll('button')].find((b) => b.textContent.includes(texte))

async function cliquer(element) {
  expect(element, 'le contrôle à cliquer doit exister').toBeTruthy()
  await act(async () => element.click())
  await laisser()
}

function saisir(champ, valeur) {
  const prototype = champ.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value').set
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

describe('1. une seule page pour prospect et devis', () => {
  it('n’a plus de page Devis séparée', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/pages/Devis.jsx'))).toBe(false)
    expect(APP).not.toContain("from './pages/Devis'")
    expect(APP).toContain('<Route path="/devis" element={<Navigate to="/prospection?vue=devis" replace />} />')
    expect(APP).toContain('<Route path="/prospection"')
  })

  it('ne garde qu’une entrée de menu', () => {
    expect(MENU).toContain("label: 'Prospection'")
    expect(MENU).not.toContain("label: 'Devis'")
    expect(MENU.match(/'\/prospection'/g)).toHaveLength(1)
    expect(MENU).not.toContain("path: '/devis'")
  })

  it('ouvre la vue devis depuis l’ancienne adresse', async () => {
    localStorage.setItem('admin', JSON.stringify(ADMIN))
    await act(async () => {
      racine.render(
        <MemoryRouter initialEntries={['/prospection?vue=devis']}>
          <Prospection />
        </MemoryRouter>,
      )
    })
    await laisser()
    expect(hote.querySelector('#ps-vue-devis')).not.toBeNull()
    expect(hote.querySelector('.ps-onglet[aria-selected="true"]').textContent).toContain('Devis')
  })

  it('garde les trois vues dans la même page', async () => {
    await ouvrir()
    expect(hote.querySelectorAll('.ps-onglet')).toHaveLength(3)
    expect(hote.querySelector('#ps-vue-prospects')).not.toBeNull()
    await cliquer(onglet('Devis'))
    expect(hote.querySelector('#ps-vue-devis')).not.toBeNull()
    await cliquer(onglet('Appels'))
    expect(hote.querySelector('#ps-vue-appels')).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// 2. L'APPLIQUÉ D'ABOMEY
// ═══════════════════════════════════════════════════════════

describe('2. l’appliqué d’Abomey', () => {
  it('devient le motif de la page, y compris pour l’ancienne adresse', () => {
    expect(culturalMotifForPath('/prospection')).toBe('abomey')
    expect(culturalMotifForPath('/prospection/')).toBe('abomey')
    expect(culturalMotifForPath('/devis')).toBe('abomey')
    expect(MOTIFS).toContain("page === 'prospection' || page === 'devis'")
    // les comptes gardent le leur, les entreprises aussi
    expect(culturalMotifForPath('/admins')).toBe('abomey')
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
  })

  it('pose le vrai bandeau, en haut et en bas', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/prospection" />)
    expect(html).toContain('data-cultural-motif="abomey"')
    expect(html).toContain('<svg')
    expect(PAGE).toContain('<PageCulturalBand pathname="/prospection" />')
    expect(PAGE).toContain('placement="bottom"')
  })

  it('a son propre blason cousu, sans toucher aux anciens', () => {
    const blason = renderToStaticMarkup(<AbomeyBlasonAppliqueSvg size={56} />)
    expect(blason).toContain('viewBox="0 0 56 56"')
    expect(blason).toContain('aria-hidden="true"')
    expect(blason.match(/<circle/g).length).toBeGreaterThanOrEqual(2)
    expect(blason.match(/stroke-dasharray/g).length).toBeGreaterThanOrEqual(2)
    expect(readAbomey()).toContain('export function AbomeyBlasonSvg')
    expect(readAbomey()).toContain('export function AbomeyFriseSvg')
    expect(readAbomey()).toContain('export function AbomeyCoinSvg')
  })

  it('a sa propre bascule de thème et un thème clair complet', () => {
    expect(PAGE).toContain('role="switch"')
    expect(PAGE).toContain('aria-checked={darkMode}')
    expect(CSS).toMatch(/\.ps-page\.ps-clair \{/)
    const clair = CSS.slice(CSS.indexOf('.ps-page.ps-clair'))
    for (const jeton of ['--ps-fond', '--ps-patch', '--ps-ivoire', '--ps-terre', '--ps-ligne']) {
      expect(clair).toContain(`${jeton}:`)
    }
  })

  it('garde une planche de référence', () => {
    const planche = path.join(ROOT, 'docs/design/refonte-prospection.png')
    expect(fs.existsSync(planche)).toBe(true)
    expect(fs.statSync(planche).size).toBeGreaterThan(50_000)
  })
})

function readAbomey() {
  return lire('src/components/AbomeySvg.jsx')
}

// ═══════════════════════════════════════════════════════════
// 3. L'ARITHMÉTIQUE — les montants ne changent pas
// ═══════════════════════════════════════════════════════════

describe('3. l’arithmétique du devis', () => {
  const calcul = calculerDevis(CONFIG_INITIAL, 'moy', {})

  it('calcule le barème à partir des quantités', () => {
    // logiciel 15 000 × 1 site, installation 2 000 × 2 machines,
    // formation équipe 500 × 10, formation admin 1 500 × 1,
    // formation options 500 × 1 option × 1 admin
    expect(calcul.sousTotalFixe).toBe(15000 + 4000 + 5000 + 1500 + 500)
    // pack de base 3 000 × 1 site, pointage PIN 1 000 × 10 employés
    expect(calcul.sousTotalMensuel).toBe(3000 + 10000)
    expect(calcul.lignesFixe.map((l) => l.key)).toContain('logiciel')
    expect(calcul.lignesMensuel.map((l) => l.key)).toContain('pointage')
    expect(calcul.lignesMensuel.find((l) => l.key === 'jours_feries').isGratuit).toBe(true)
  })

  it('applique l’engagement annuel de 15 % et compte douze mois', () => {
    const totaux = appliquerPriorites(calcul, { engagement: 'annuel' })
    expect(totaux.totalFixeNet).toBe(26000)
    expect(totaux.totalMensuelNet).toBe(11050)
    expect(totaux.nbMois).toBe(12)
    expect(totaux.totalAnnuelNet).toBe(26000 + 11050 * 12)
    expect(totaux.engagementLabel).toContain('Annuel')
  })

  it('offre un mois sans changer la ligne', () => {
    const totaux = appliquerPriorites(calcul, { engagement: 'annuel', moisGratuit: true })
    expect(totaux.nbMois).toBe(11)
    expect(nombreDeMois('annuel', true)).toBe(11)
    expect(nombreDeMois('sans', true)).toBe(1)
  })

  it('répartit l’investissement en échéances', () => {
    const totaux = appliquerPriorites(calcul, { engagement: 'annuel', paiementFois: 4 })
    expect(totaux.echeanceFixe).toBe(6500)
    expect(echeanceFixe({ totalFixeNet: 26001, paiementFois: 4 })).toBe(6501)
  })

  it('donne la priorité au montant convenu, puis à la catégorie', () => {
    const convenu = appliquerPriorites(calcul, {
      engagement: 'annuel',
      montantConvenu: { fixe: '900000', mensuel: '120000' },
      totalCategorie: { fixe: '700000', mensuel: '90000' },
    })
    expect(convenu.totalFixeNet).toBe(900000)
    expect(convenu.totalMensuelNet).toBe(120000)

    const categorie = appliquerPriorites(calcul, {
      engagement: 'annuel',
      totalCategorie: { fixe: '700000', mensuel: '90000' },
    })
    expect(categorie.totalFixeNet).toBe(700000)
    expect(categorie.totalMensuelNet).toBe(90000)
  })

  it('plafonne les remises mensuelles à 50 %', () => {
    const totaux = appliquerPriorites(calcul, { engagement: 'annuel', remiseMensuel: 90 })
    expect(totaux.totalMensuelNet).toBe(Math.round(13000 * 0.5))
  })

  it('sait lire un prix négocié, à l’unité ou au total', () => {
    const nego = { logiciel: { unitaire: '10000', total: '' } }
    const negocie = calculerDevis(CONFIG_INITIAL, 'moy', nego)
    const ligne = negocie.lignesFixe.find((l) => l.key === 'logiciel')
    expect(ligne.total).toBe(10000)
    expect(ligne.negocie).toBe(true)
    expect(ligne.modeNego).toBe('unitaire')
    expect(ligne.sousMinimum).toBe(true)
  })

  it('allume une ligne sous le tarif minimum, jamais les jours fériés', () => {
    expect(estLigneSousMinimum('logiciel', 1, { logiciel: { unitaire: '11000' } })).toBe(true)
    expect(estLigneSousMinimum('logiciel', 1, { logiciel: { unitaire: '12000' } })).toBe(false)
    expect(estLigneSousMinimum('jours_feries', 2, { jours_feries: { unitaire: '1' } })).toBe(false)

    const detail = getAlerteMinDetail('logiciel', 1, { logiciel: { total: '9000' } })
    expect(detail.sousMin).toBe(true)
    expect(detail.ecartTotal).toBe(3000)
    expect(detail.unitaireImplicite).toBe(9000)
  })

  it('choisit le niveau par la moyenne du scoring', () => {
    expect(calculerScore({})).toBeNull()
    expect(calculerScore({ secteur: 'mini', budget: 'mini' })).toBe('mini')
    expect(calculerScore({ secteur: 'mini', budget: 'max' })).toBe('moy')
    expect(calculerScore({ secteur: 'max', budget: 'max', urgence: 'max' })).toBe('max')
    expect(calculerScore({ secteur: 'moy', budget: null })).toBe('moy')
  })

  it('lit les prix du barème selon le niveau et le type de pointage', () => {
    expect(prixAutoUnitaire('logiciel', 'mini')).toBe(12000)
    expect(prixAutoUnitaire('logiciel', 'max')).toBe(20000)
    expect(prixAutoUnitaire('pointage', 'moy', 'pin')).toBe(1000)
    expect(prixAutoUnitaire('pointage', 'moy', 'qr')).toBe(1500)
    expect(getEngagementConfig('annuel').mois).toBe(12)
    expect(ENGAGEMENTS.map((e) => e.value)).toContain('6mois')
  })

  it('relit un devis enregistré sans recalculer', () => {
    const totaux = totauxDuDevis(devisEnregistre())
    expect(totaux.totalFixeNet).toBe(960000)
    expect(totaux.totalMensuelNet).toBe(121000)
    expect(totaux.nbMois).toBe(12)
  })

  it('écrit les montants à la française', () => {
    expect(formatF(1480000).replace(/\u202f|\u00a0/g, ' ')).toBe('1 480 000')
    expect(formatF(null)).toBe('0')
    expect(formatF(0)).toBe('0')
  })
})

// ═══════════════════════════════════════════════════════════
// 4. LES DOCUMENTS
// ═══════════════════════════════════════════════════════════

describe('4. les documents', () => {
  it('sont extraits, pas réinventés', () => {
    for (const nom of ['handleDownloadPDF', 'handleDownloadFacture', 'handleDownloadFactureSimplifiee', 'handleDownloadEcheancier']) {
      expect(DOCS).toContain(`export function ${nom}`)
    }
    expect(DOCS).toContain("import html2pdf from 'html2pdf.js'")
    expect(DOCS).toContain("from './devis'")
    expect(DOCS).toContain('RCCM')
    expect(DOCS).toContain('Échéance')
  })

  it('garde les mentions du devis et l’ordre des totaux', () => {
    expect(DOCS).toContain('Investissement initial')
    expect(DOCS).toContain('Abonnement mensuel')
    expect(DOCS).toContain('TOTAL GÉNÉRAL')
    expect(LIB).toContain("export function appliquerPriorites")
  })
})

// ═══════════════════════════════════════════════════════════
// 5. LES GESTES SUR LA PAGE
// ═══════════════════════════════════════════════════════════

describe('5. les gestes de la page', () => {
  it('montre les vrais chiffres et le pipeline', async () => {
    await ouvrir()
    const nombres = [...hote.querySelectorAll('.ps-stele-nombre')].map((n) => n.textContent)
    expect(nombres).toEqual(['3', '1', '1', '1'])
    expect(hote.querySelectorAll('.ps-colonne')).toHaveLength(6)
    expect(carte('Maison Adjovi')).toBeTruthy()
    expect(hote.querySelector('.ps-colonne[data-statut="en_negociation"]').textContent).toContain('Groupe Tossou')
  })

  it('compte les relances dues, pas les relances futures', async () => {
    await ouvrir()
    const relances = hote.querySelector('.ps-stele[data-ton="terre"] .ps-stele-nombre')
    expect(relances.textContent).toBe('1')
    expect(carte('Groupe Tossou').textContent).toContain('Relance due')
    expect(carte('Pharmacie Zongo').textContent).toContain('Relance le')
  })

  it('cherche dans ce qui est écrit, et filtre par potentiel', async () => {
    await ouvrir()
    await ecrire(hote.querySelector('.ps-recherche input'), 'tossou')
    expect(hote.querySelectorAll('.ps-carte')).toHaveLength(1)
    expect(hote.textContent).toContain('Groupe Tossou')

    await ecrire(hote.querySelector('.ps-recherche input'), '')
    await cliquer([...hote.querySelectorAll('.ps-filtre')].find((b) => b.textContent === 'Moyen'))
    expect(hote.querySelectorAll('.ps-carte')).toHaveLength(1)
    expect(hote.textContent).toContain('Pharmacie Zongo')
  })

  it('ouvre la fiche et dit ce qui manque', async () => {
    await ouvrir()
    await cliquer(carte('Pharmacie Zongo').querySelector('.ps-carte-ouvrir'))
    const fiche = hote.querySelector('.ps-fiche')
    expect(fiche).toBeTruthy()
    expect(fiche.textContent).toContain('Le contact')
    expect(fiche.textContent).toContain('Aucun devis pour ce prospect.')
    expect(carte('Pharmacie Zongo').textContent).toContain('Il manque : contact, téléphone')
  })

  it('change l’étape d’un prospect, et la base suit', async () => {
    await ouvrir()
    await cliquer(carte('Maison Adjovi').querySelector('.ps-carte-ouvrir'))
    await cliquer([...hote.querySelectorAll('.ps-etape-bouton')].find((b) => b.textContent.includes('Contacté')))

    expect(dernier('update', 'prospects').payload.status).toBe('contacte')
    expect(dernier('update', 'prospects').filtres).toEqual({ id: 'p-1' })
    expect(hote.querySelector('.ps-avis').textContent).toContain('Contacté')
  })

  it('ouvre une fiche par la fenêtre et l’enregistre', async () => {
    await ouvrir()
    await cliquer(bouton('Nouveau prospect'))
    expect(hote.querySelector('.ps-fenetre')).toBeTruthy()

    await ecrire(hote.querySelector('.ps-fenetre input'), 'Atelier Kpèdo')
    await cliquer(bouton('Ouvrir la fiche'))

    const envoi = dernier('insert', 'prospects')
    expect(envoi.payload).toMatchObject({ company_name: 'Atelier Kpèdo', status: 'a_contacter', nb_sites_estimate: 1 })
    expect(hote.textContent).toContain('Maison Adjovi')
  })

  it('refuse une fiche sans nom, sans appeler le serveur', async () => {
    await ouvrir()
    await cliquer(bouton('Nouveau prospect'))
    await cliquer(bouton('Ouvrir la fiche'))
    expect(faux.journal.some((e) => e.action === 'insert')).toBe(false)
    expect(hote.querySelector('.ps-erreur').textContent).toContain('nom de l’entreprise est obligatoire')
  })

  it('supprime un prospect après confirmation', async () => {
    await ouvrir()
    await cliquer(carte('Maison Adjovi').querySelector('.ps-carte-ouvrir'))
    await cliquer(lienDans(hote.querySelector('.ps-fiche-pied'), 'Supprimer'))
    expect(faux.journal.some((e) => e.action === 'delete')).toBe(false)

    await cliquer(bouton('Supprimer la fiche'))
    expect(dernier('delete', 'prospects').filtres).toEqual({ id: 'p-1' })
  })

  it('liste les devis avec leurs montants et change leur statut', async () => {
    await ouvrir()
    await cliquer(onglet('Devis'))

    const lignes = hote.querySelectorAll('.ps-devis')
    expect(lignes).toHaveLength(2)
    expect(lignes[0].textContent).toContain('DEV-2026-014')
    expect(lignes[0].textContent).toContain(formatF(960000))
    expect(lignes[0].textContent).toContain('Maison Adjovi')

    const selection = lignes[1].querySelector('select')
    expect(selection).toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(selection, 'accepte')
      selection.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await laisser()
    expect(dernier('update', 'devis').payload.status).toBe('accepte')
  })

  it('prépare une facture depuis le devis', async () => {
    await ouvrir()
    await cliquer(onglet('Devis'))
    await cliquer(lienDans(hote.querySelectorAll('.ps-devis')[0], 'Facture'))

    expect(hote.querySelector('.ps-fenetre')).toBeTruthy()
    expect(hote.querySelector('.ps-fenetre').textContent).toContain('Date d’émission')
    expect(hote.querySelector('.ps-fenetre').textContent).toContain('Date d’échéance')
  })

  it('supprime un devis après confirmation', async () => {
    await ouvrir()
    await cliquer(onglet('Devis'))
    await cliquer(lienDans(hote.querySelectorAll('.ps-devis')[0], 'Supprimer'))
    await cliquer(bouton('Supprimer le devis'))
    expect(dernier('delete', 'devis').filtres).toEqual({ id: 'd-1' })
  })

  it('écrit le vide comme un vide, pas comme une erreur', async () => {
    faux.tables.prospects = []
    faux.tables.devis = []
    await ouvrir()
    expect(hote.querySelector('.ps-vide')).toBeTruthy()
    expect(hote.querySelector('.ps-vide-titre').textContent).toContain('Aucun prospect')
    await cliquer(onglet('Devis'))
    expect(hote.querySelector('.ps-vide-titre').textContent).toContain('Aucun devis')
  })
})

// ═══════════════════════════════════════════════════════════
// 6. L'ATELIER
// ═══════════════════════════════════════════════════════════

describe('6. l’atelier de devis', () => {
  async function ouvrirAtelier() {
    await ouvrir()
    await cliquer(onglet('Devis'))
    await cliquer(bouton('Nouveau devis'))
    return hote.querySelector('.at-panneau')
  }

  it('ouvre quatre étapes, sans jamais cacher où l’on est', async () => {
    const panneau = await ouvrirAtelier()
    expect(panneau).toBeTruthy()
    expect(hote.querySelectorAll('.at-etape')).toHaveLength(4)
    expect(hote.querySelector('.at-etape[data-etat="active"]').textContent).toContain('Prospect')
    expect(PAGE).toContain('<AtelierDevis')
    expect(ATELIER).toContain("import './AtelierDevis.css'")
  })

  it('avance et recule dans les étapes', async () => {
    await ouvrirAtelier()
    await cliquer(bouton('Continuer'))
    expect(hote.querySelector('.at-etape[data-etat="active"]').textContent).toContain('Configuration')
    await cliquer(bouton('Retour'))
    expect(hote.querySelector('.at-etape[data-etat="active"]').textContent).toContain('Prospect')
  })

  it('applique un niveau de scoring au barème', async () => {
    await ouvrirAtelier()
    const criteres = hote.querySelectorAll('.at-critere')
    expect(criteres).toHaveLength(6)
    // secteur « Banque / Télécom » = max, budget « Budget défini » = max
    const secteur = criteres[0].querySelectorAll('.at-choix input')[2]
    await act(async () => secteur.click())
    await laisser()
    expect(hote.querySelector('.at-niveau-suggere').textContent).toContain('MAX')
    expect(hote.querySelector('.at-niveau-bouton[data-choisi="oui"]').textContent).toBe('MAX')
  })

  it('montre les options et leur total, gratuit compris', async () => {
    await ouvrirAtelier()
    await cliquer(bouton('Continuer'))
    const options = hote.querySelectorAll('.at-option')
    expect(options.length).toBe(12)
    const gratuite = [...options].find((o) => o.textContent.includes('Jours fériés'))
    expect(gratuite.dataset.active).toBe('oui')
    expect(gratuite.textContent).toContain('Gratuit')
  })

  it('enregistre un devis avec les mêmes colonnes qu’avant', async () => {
    await ouvrirAtelier()
    await cliquer(bouton('Continuer'))
    await cliquer(bouton('Continuer'))
    // étape 3 : négociation
    expect(hote.querySelector('.at-tableau')).toBeTruthy()
    await cliquer(bouton('Continuer'))
    // étape 4 : résultat
    expect(hote.querySelector('.at-totaux')).toBeTruthy()
    await cliquer(bouton('Enregistrer le devis'))

    const envoi = dernier('insert', 'devis')
    expect(envoi).toBeTruthy()
    // deux devis existent déjà : le numéro suit le compte du serveur
    expect(envoi.payload.numero).toBe('DEV-2026-003')
    expect(envoi.payload.montant_fixe_brut).toBe(26000)
    expect(envoi.payload.montant_mensuel_brut).toBe(13000)
    expect(envoi.payload.montant_mensuel_net).toBe(11050)
    expect(envoi.payload.status).toBe('brouillon')
    expect(envoi.payload.detail_calcul.nego_ligne).toBeTruthy()
  })

  it('signale une ligne négociée sous le plancher', async () => {
    await ouvrirAtelier()
    await cliquer(bouton('Continuer'))
    await cliquer(bouton('Continuer'))
    const premiereSaisie = hote.querySelector('.at-tableau-ligne .at-saisie input')
    await ecrire(premiereSaisie, '5000')
    const ligne = hote.querySelector('.at-tableau-ligne')
    expect(ligne.dataset.alerte).toBe('oui')
    expect(ligne.textContent).toContain('minimum')
  })

  it('se ferme à Échap et ne laisse pas la page défiler', async () => {
    await ouvrirAtelier()
    expect(document.body.style.overflow).toBe('hidden')
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    await laisser()
    expect(hote.querySelector('.at-panneau')).toBeNull()
  })

  it('part d’un prospect quand on le demande', async () => {
    await ouvrir()
    await cliquer(lienDans(carte('Groupe Tossou'), 'Devis'))
    const etat = hote.querySelector('.at-panneau')
    expect(etat).toBeTruthy()
    expect(hote.querySelector('.at-sous-titre').textContent).toContain('Groupe Tossou')
    await cliquer(bouton('Continuer'))
    const employes = [...hote.querySelectorAll('.at-champ')].find((c) => c.textContent.includes('Employés'))
    expect(employes.querySelector('input').value).toBe('42')
  })
})

// ═══════════════════════════════════════════════════════════
// 7. LE TEXTE ET LES RÈGLES DE DESSIN
// ═══════════════════════════════════════════════════════════

describe('7. le texte et les règles de dessin', () => {
  it('n’écrit ni nom de table, ni formule d’atelier', async () => {
    await ouvrir()
    await cliquer(onglet('Devis'))
    const texte = hote.textContent
    expect(texte).not.toMatch(/supabase|detail_calcul|montant_fixe_net|prospect_id|p_enterprise/i)
    expect(texte).not.toMatch(/pagne|tissé|métier à tisser|au fuseau|navette/i)
    expect(texte).toMatch(/Investissement|Mensuel|Engagement/)
  })

  it('n’affiche aucun emoji', () => {
    for (const source of [PAGE, ATELIER, PROSPECTION]) {
      const rendu = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(rendu).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u)
    }
  })

  it('n’écrit pas de couleur en dur dans le JSX', () => {
    expect(PAGE).not.toMatch(/style=\{\{[^}]*(background|color):/i)
    expect(ATELIER).not.toMatch(/style=\{\{[^}]*(background|color):/i)
    expect(PAGE).not.toContain("from 'react-hot-toast'")
    expect(ATELIER).not.toContain("from 'react-hot-toast'")
  })

  it('ne change au survol ni le fond d’un texte, ni sa couleur, ni son opacité', () => {
    for (const feuille of [CSS, ATELIER_CSS]) {
      const regles = feuille.match(/[^{}]*:hover[^{}]*\{[^}]*\}/g) || []
      expect(regles.length).toBeGreaterThan(4)
      for (const regle of regles) {
        const corps = regle.slice(regle.indexOf('{') + 1)
        expect(corps, regle).not.toMatch(/(^|;)\s*background(-color)?\s*:/)
        expect(corps, regle).not.toMatch(/(^|;)\s*opacity\s*:/)
        expect(corps.replace(/border-color\s*:/g, ''), regle).not.toMatch(/(^|;)\s*color\s*:/)
      }
    }
  })

  it('dessine ses contrôles au lieu de cases nues', () => {
    expect(CSS).toMatch(/\.ps-onglet\[data-actif='oui'\]/)
    expect(CSS).toMatch(/\.ps-stele-marque/)
    expect(CSS).toMatch(/\.ps-charge-chevron/)
    expect(ATELIER_CSS).toMatch(/\.at-option-case/)
    expect(ATELIER_CSS).toMatch(/\.at-choix-point/)
    expect(PAGE).toContain('role="tablist"')
    expect(ATELIER).toContain('aria-pressed={active}')
  })

  it('a un chargement dessiné, pas une roue photo', () => {
    expect(PAGE).toContain('ps-charge-chevron')
    expect(CSS).toContain('@keyframes ps-cheuron')
  })

  it('reste lisible sur téléphone et respecte le mouvement réduit', () => {
    expect(CSS).toContain('@media (max-width: 900px)')
    expect(CSS).toContain('@media (max-width: 760px)')
    expect(CSS).toContain('@media (max-width: 520px)')
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(ATELIER_CSS).toContain('@media (max-width: 860px)')
    // les cibles tactiles tiennent
    expect(CSS).toMatch(/\.ps-bouton,[\s\S]{0,200}min-height: 36px/)
    expect(ATELIER_CSS).toMatch(/\.at-bouton,[\s\S]{0,200}min-height: 38px/)
  })

  it('sait que la relance d’hier est due et que demain ne l’est pas', () => {
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    expect(relanceDue(hier)).toBe(true)
    expect(relanceDue(demain)).toBe(false)
    expect(joursDeRetard(hier)).toBe(1)
    expect(joursDeRetard(null)).toBe(0)
    expect(statutDe('signe').label).toContain('Signé')
    expect(etapeSuivante('contacte')).toBe('en_negociation')
  })
})
