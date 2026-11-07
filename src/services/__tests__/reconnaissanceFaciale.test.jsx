// ═══════════════════════════════════════════════════════════
// 🧶 RECONNAISSANCE FACIALE — la page fusionnée
//
// Ce que ces tests défendent :
//
//   ① les enrôlements et leurs réglages ne font plus qu'un écran :
//     une route, deux redirections, une entrée de menu, un verrou ;
//   ② le motif est le velours kuba, celui de Planning, avec son
//     blason dessiné — pas un décor posé par-dessus ;
//   ③ la mécanique n'a pas changé : mêmes tables, mêmes colonnes,
//     même `upsert` sur `enterprise_id`, même photo signée ;
//   ④ les décisions marchent pour de vrai : valider, refuser avec
//     un motif obligatoire, ré-enrôler, supprimer ;
//   ⑤ les réglages s'écrivent sur la bonne entreprise, et rien ne
//     s'enregistre sans changement ;
//   ⑥ le survol ne touche ni le fond d'un texte, ni sa couleur ;
//     aucun mot d'atelier, aucun nom technique à l'écran.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import ReconnaissanceFaciale from '../../pages/ReconnaissanceFaciale'
import PageCulturalBand from '../../components/PageCulturalBand'
import { KubaEmblemeSvg } from '../../components/KubaSvg'
import { culturalMotifForPath } from '../../components/culturalMotif'

// ── la fausse base : elle enregistre tout ce qu'on lui demande ──
const { faux } = vi.hoisted(() => {
  const journal = []
  const tables = { enterprises: [], face_enrollments: [], face_recognition_config: [] }

  const correspond = (ligne, filtres) =>
    Object.entries(filtres).every(([colonne, valeur]) => ligne[colonne] === valeur)

  const executer = (etat) => {
    const lignes = tables[etat.table] || []

    if (etat.action === 'delete') {
      const parties = lignes.filter((ligne) => correspond(ligne, etat.filtres))
      tables[etat.table] = lignes.filter((ligne) => !parties.includes(ligne))
      journal.push({ table: etat.table, action: 'delete', filtres: { ...etat.filtres } })
      return { data: null, error: null }
    }

    if (etat.action === 'update') {
      const touchees = []
      tables[etat.table] = lignes.map((ligne) => {
        if (!correspond(ligne, etat.filtres)) return ligne
        touchees.push(ligne.id)
        return { ...ligne, ...etat.payload }
      })
      journal.push({
        table: etat.table,
        action: 'update',
        filtres: { ...etat.filtres },
        payload: { ...etat.payload },
      })
      return { data: touchees.map((id) => ({ id })), error: null }
    }

    if (etat.action === 'upsert') {
      const cle = etat.options?.onConflict || 'id'
      const existe = lignes.find((ligne) => ligne[cle] === etat.payload[cle])
      tables[etat.table] = existe
        ? lignes.map((ligne) => (ligne[cle] === etat.payload[cle] ? { ...ligne, ...etat.payload } : ligne))
        : [...lignes, { ...etat.payload }]
      journal.push({
        table: etat.table,
        action: 'upsert',
        options: etat.options,
        payload: { ...etat.payload },
      })
      return { data: [{ ...etat.payload }], error: null }
    }

    let vues = lignes.filter((ligne) => correspond(ligne, etat.filtres))
    if (etat.tri) {
      const { colonne, ascendant } = etat.tri
      vues = [...vues].sort((a, b) => {
        if (a[colonne] === b[colonne]) return 0
        return (a[colonne] > b[colonne] ? 1 : -1) * (ascendant ? 1 : -1)
      })
    }
    journal.push({ table: etat.table, action: 'select', filtres: { ...etat.filtres } })
    const donnees = vues.map((ligne) => ({ ...ligne }))
    return { data: etat.single ? (donnees[0] ?? null) : donnees, error: null }
  }

  const fabriquer = (table) => {
    const etat = {
      table, action: 'select', filtres: {}, payload: null,
      options: null, single: false, tri: null,
    }
    const chaine = {
      select: () => chaine,
      eq: (colonne, valeur) => { etat.filtres[colonne] = valeur; return chaine },
      order: (colonne, options = {}) => {
        etat.tri = { colonne, ascendant: options.ascending !== false }
        return chaine
      },
      maybeSingle: () => { etat.single = true; return chaine },
      single: () => { etat.single = true; return chaine },
      update: (payload) => { etat.action = 'update'; etat.payload = payload; return chaine },
      delete: () => { etat.action = 'delete'; return chaine },
      upsert: (payload, options) => {
        etat.action = 'upsert'; etat.payload = payload; etat.options = options
        return chaine
      },
      then: (resoudre, rejeter) =>
        Promise.resolve().then(() => executer(etat)).then(resoudre, rejeter),
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
        tables.enterprises = []
        tables.face_enrollments = []
        tables.face_recognition_config = []
      },
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => faux.from(table),
    // les buckets restent publics dans les tests : l'image garde son adresse
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: null, error: { message: 'bucket public' } }),
      }),
    },
  },
}))

// Le thème est simulé : on teste la page, pas le fournisseur de thème.
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: () => {} }),
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const PAGE = lire('src/pages/ReconnaissanceFaciale.jsx')
const CSS = lire('src/pages/ReconnaissanceFaciale.css')
const APP = lire('src/App.jsx')
const MENU = lire('src/components/DashboardExperience.jsx')
const VERROU = lire('src/components/VerrouOptions.jsx')
const ASSISTANT = lire('src/components/AssistantDock.jsx')
const MOTIFS = lire('src/components/culturalMotif.js')

// ── les données de la fausse base ──────────────────────────────
const enterprise = (id, name) => ({ id, name, is_active: true })
const employe = (prenom, nom, matricule) => ({
  id: `emp-${matricule}`, first_name: prenom, last_name: nom, matricule,
})

const fiche = (extra = {}) => ({
  id: 'f1',
  enterprise_id: 'ent-1',
  status: 'pending',
  is_active: true,
  created_at: '2026-10-24T09:12:00.000Z',
  enrollment_photo_url: 'https://exemple.test/storage/v1/object/public/face-photos/f1.jpg',
  rejection_reason: null,
  employees: employe('Awa', 'Koffi', 'EMP-0142'),
  enterprises: { id: 'ent-1', name: 'Kossi & Fils SARL' },
  ...extra,
})

const FICHES = () => [
  fiche(),
  fiche({
    id: 'f2', status: 'approved', created_at: '2026-10-22T16:40:00.000Z',
    employees: employe('Kossi', 'Mensah', 'EMP-0088'),
  }),
  fiche({
    id: 'f3', status: 'rejected', created_at: '2026-10-21T11:05:00.000Z',
    rejection_reason: 'Photo floue',
    employees: employe('Afi', 'Dossou', 'EMP-0101'),
  }),
  fiche({
    id: 'f4', enterprise_id: 'ent-2', status: 'approved',
    created_at: '2026-10-20T08:28:00.000Z',
    employees: employe('Sika', 'Bio', 'EMP-0117'),
    enterprises: { id: 'ent-2', name: 'Maison Adjovi' },
  }),
]

const CONFIG_ENT_1 = {
  id: 'cfg-1',
  enterprise_id: 'ent-1',
  confidence_threshold: 0.72,
  liveness_required: false,
  admin_approval_required: true,
  fallback_allowed: true,
  max_attempts: 5,
  kiosk_mode_enabled: true,
  pointage_mode: 'face_required',
}

const ADMIN_SIMPLE = {
  id: 'adm-1', role: 'admin', enterprise_id: 'ent-1',
  selectedEnterprise: { id: 'ent-1', name: 'Kossi & Fils SARL' },
}
const ADMIN_SUPER = { id: 'sup-1', role: 'super_admin' }

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  faux.vider()
  faux.tables.enterprises = [enterprise('ent-1', 'Kossi & Fils SARL'), enterprise('ent-2', 'Maison Adjovi')]
  faux.tables.face_enrollments = FICHES()
  faux.tables.face_recognition_config = [{ ...CONFIG_ENT_1 }]

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

async function laisser() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

async function ouvrir(admin = ADMIN_SIMPLE) {
  localStorage.setItem('admin', JSON.stringify(admin))
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={['/reconnaissance-faciale']}>
        <ReconnaissanceFaciale />
      </MemoryRouter>,
    )
  })
  await laisser()
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes(texte))
const entree = (nom) => [...hote.querySelectorAll('.rf-entree')].find((li) => li.textContent.includes(nom))
const lienDans = (li, texte) => [...li.querySelectorAll('.rf-lien')].find((b) => b.textContent.includes(texte))
const interrupteur = (libelle) => [...hote.querySelectorAll('.rf-interrupteur')]
  .find((bloc) => bloc.textContent.includes(libelle))
  .querySelector('.rf-bascule')
const cliquer = async (element) => { await act(async () => element.click()); await laisser() }

async function ecrire(champ, valeur) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  await act(async () => {
    setter.call(champ, valeur)
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function choisir(select, valeur) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  await act(async () => {
    setter.call(select, valeur)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await laisser()
}

const dernier = (action, table) =>
  [...faux.journal].reverse().find((entreeJournal) => entreeJournal.action === action && entreeJournal.table === table)

async function versReglages() {
  await cliquer([...hote.querySelectorAll('.rf-onglet')].find((b) => b.textContent.includes('Réglages')))
}

// ═══════════════════════════════════════════════════════════
// 1. UNE SEULE PAGE, UNE SEULE PORTE
// ═══════════════════════════════════════════════════════════

describe('1. une seule page pour les enrôlements et leurs réglages', () => {
  it('n’a plus deux fichiers ni deux routes', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/pages/GestionEnrolements.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/pages/ConfigRecoFaciale.jsx'))).toBe(false)
    expect(APP).not.toContain("from './pages/GestionEnrolements'")
    expect(APP).not.toContain("from './pages/ConfigRecoFaciale'")
    expect(APP).toContain('import ReconnaissanceFaciale')
    expect(APP).toContain('<Route path="/reconnaissance-faciale"')
  })

  it('garde les deux anciennes adresses vivantes, en redirection', () => {
    for (const ancienne of ['/enrollements-faciaux', '/config-reco-faciale']) {
      expect(APP).toContain(`<Route path="${ancienne}" element={<Navigate to="/reconnaissance-faciale" replace />} />`)
    }
  })

  it('n’a qu’une entrée de menu, et un seul verrou', () => {
    expect(MENU).toContain("label: 'Reconnaissance faciale'")
    expect(MENU).not.toContain("label: 'Enrôlements faciaux'")
    expect(MENU).not.toContain("label: 'Configuration faciale'")
    expect(MENU.match(/'\/reconnaissance-faciale'/g)).toHaveLength(1)
    expect(VERROU).toContain("'/reconnaissance-faciale': 'module_reconnaissance_faciale'")
    expect(VERROU).not.toContain("'/enrollements-faciaux'")
    expect(VERROU).not.toContain("'/config-reco-faciale'")
    // l'assistant ouvre la même porte
    expect(ASSISTANT).toContain("face_enrollment: '/reconnaissance-faciale'")
  })

  it('reprend l’entreprise retenue par l’en-tête de l’administration', async () => {
    localStorage.setItem('selected_enterprise_id', 'ent-2')
    await ouvrir(ADMIN_SUPER)

    expect(hote.textContent).toContain('Maison Adjovi')
    expect(hote.querySelectorAll('.rf-entree')).toHaveLength(1)
    expect(hote.textContent).toContain('Sika Bio')
  })

  it('garde les deux vues dans la même page', async () => {
    await ouvrir()
    expect(hote.querySelectorAll('.rf-onglet')).toHaveLength(2)
    expect(hote.querySelector('.rf-onglet[aria-selected="true"]').textContent).toContain('Enrôlements')
    await versReglages()
    expect(hote.querySelector('.rf-onglet[aria-selected="true"]').textContent).toContain('Réglages')
    expect(hote.querySelector('#rf-vue-reglages')).not.toBeNull()
    // les chiffres restent visibles dans les deux vues
    expect(hote.querySelectorAll('.rf-stele')).toHaveLength(4)
  })
})

// ═══════════════════════════════════════════════════════════
// 2. LE VELOURS KUBA
// ═══════════════════════════════════════════════════════════

describe('2. le velours kuba', () => {
  it('devient l’identité de la page, y compris pour les anciennes adresses', () => {
    expect(culturalMotifForPath('/reconnaissance-faciale')).toBe('kuba')
    expect(culturalMotifForPath('/reconnaissance-faciale/')).toBe('kuba')
    expect(culturalMotifForPath('/enrollements-faciaux')).toBe('kuba')
    expect(culturalMotifForPath('/config-reco-faciale')).toBe('kuba')
    // Planning garde le sien : deux pages, la même famille
    expect(culturalMotifForPath('/planning')).toBe('kuba')
    expect(MOTIFS).toContain("if (page === 'planning') return 'kuba'")
  })

  it('pose le vrai bandeau kuba, pas une image inventée', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/reconnaissance-faciale" />)
    expect(html).toContain('data-cultural-motif="kuba"')
    expect(html).toContain('ec-cultural-top')
    expect(fs.existsSync(path.join(ROOT, 'public/images/planning-kuba.webp'))).toBe(true)
    expect(PAGE).toContain('<PageCulturalBand pathname="/reconnaissance-faciale" />')
    expect(PAGE).toContain('placement="bottom"')
  })

  it('dessine un blason : trois losanges, une bordure de chevrons', () => {
    const blason = renderToStaticMarkup(<KubaEmblemeSvg size={48} />)
    expect(blason).toContain('viewBox="0 0 52 52"')
    expect(blason).toContain('aria-hidden="true"')
    expect(blason.match(/<path/g).length).toBeGreaterThanOrEqual(4)
    expect(blason.match(/<rect/g).length).toBeGreaterThanOrEqual(1)
  })

  it('garde la page distincte du Planning : son propre vocabulaire de velours', () => {
    expect(CSS).toContain('.rf-page {')
    expect(CSS).toContain('--rf-raphia')
    expect(CSS).toContain('--rf-ecru')
    expect(CSS).toContain('.rf-lisiere')
    // pas de décor hérité des anciennes pages sombres
    expect(PAGE).not.toContain('#0A0A0F')
    expect(CSS).not.toContain('#0A0A0F')
    expect(PAGE).not.toMatch(/style=\{\{[^}]*(background|color):/i)
  })

  it('donne à la page sa propre bascule de thème, et un thème clair complet', () => {
    expect(PAGE).toContain('role="switch"')
    expect(PAGE).toContain("aria-checked={darkMode}")
    expect(CSS).toMatch(/\.rf-page\.rf-clair \{/)
    // chaque jeton de la nuit a son équivalent clair
    for (const jeton of ['--rf-terre', '--rf-panneau', '--rf-ecru', '--rf-raphia', '--rf-ligne']) {
      const clair = CSS.slice(CSS.indexOf('.rf-page.rf-clair'))
      expect(clair).toContain(`${jeton}:`)
    }
  })

  it('garde une planche de référence pour la refonte', () => {
    const planche = path.join(ROOT, 'docs/design/refonte-reconnaissance-faciale.png')
    expect(fs.existsSync(planche)).toBe(true)
    expect(fs.statSync(planche).size).toBeGreaterThan(50_000)
  })
})

// ═══════════════════════════════════════════════════════════
// 3. LA MÉCANIQUE N'A PAS BOUGÉ
// ═══════════════════════════════════════════════════════════

describe('3. les contrats de données', () => {
  it('lit les fiches avec l’employé et l’entreprise, du plus récent au plus ancien', () => {
    expect(PAGE).toContain(".from('face_enrollments')")
    expect(PAGE).toContain('employees (id, first_name, last_name, matricule, photo_url)')
    expect(PAGE).toContain('enterprises (id, name)')
    expect(PAGE).toContain("order('created_at', { ascending: false })")
    expect(PAGE).toContain(".eq('enterprise_id', cible)")
    expect(PAGE).toContain('selectedEnterprise?.id || admin.enterprise_id')
  })

  it('écrit les quatre décisions avec les mêmes colonnes', () => {
    for (const colonne of ['status', 'approved_by', 'approved_at', 'updated_at', 'rejection_reason', 'is_active']) {
      expect(PAGE).toContain(colonne)
    }
    expect(PAGE).toContain("status: 'approved'")
    expect(PAGE).toContain("status: 'rejected'")
    expect(PAGE).toContain('is_active: false')
    expect(PAGE).toContain(".from('face_enrollments').delete().eq('id', enr.id)")
  })

  it('lit et écrit la configuration d’une entreprise, sans doublon', () => {
    expect(PAGE).toContain(".from('face_recognition_config')")
    expect(PAGE).toContain(".eq('enterprise_id', entrepriseDesReglages)")
    expect(PAGE).toContain('.maybeSingle()')
    expect(PAGE).toContain("{ onConflict: 'enterprise_id' }")
    expect(PAGE).toContain('updated_at: new Date().toISOString()')
  })

  it('garde les bornes et les valeurs par défaut du produit', () => {
    expect(PAGE).toMatch(/min="0\.6"/)
    expect(PAGE).toMatch(/max="0\.95"/)
    expect(PAGE).toMatch(/step="0\.01"/)
    expect(PAGE).toContain('confidence_threshold: 0.8')
    expect(PAGE).toContain('max_attempts: 3')
    expect(PAGE).toContain('Math.max(1,')
    expect(PAGE).toContain('Math.min(10,')
    for (const mode of ['free', 'face_required', 'face_exclusive']) {
      expect(PAGE).toContain(`'${mode}'`)
    }
    expect(PAGE).toContain('fallback_allowed')
    expect(PAGE).toContain('Sans autre mode, un employé non reconnu ne peut pas pointer du tout.')
  })

  it('affiche les photos par la signature, jamais en clair', () => {
    expect(PAGE).toContain("import PhotoSignee from '../components/PhotoSignee'")
    expect(PAGE.match(/<PhotoSignee/g).length).toBeGreaterThanOrEqual(2)
    expect(PAGE).toContain('enrollment_photo_url')
  })
})

// ═══════════════════════════════════════════════════════════
// 4. LES DÉCISIONS, POUR DE VRAI
// ═══════════════════════════════════════════════════════════

describe('4. les décisions', () => {
  it('compte les fiches réelles et les montre', async () => {
    await ouvrir(ADMIN_SUPER)
    const chiffres = [...hote.querySelectorAll('.rf-stele-nombre')].map((n) => n.textContent)
    expect(chiffres).toEqual(['4', '1', '2', '1'])
    expect(hote.textContent).toContain('Awa Koffi')
    expect(hote.textContent).toContain('Photo floue')
  })

  it('filtre par état et par recherche', async () => {
    await ouvrir(ADMIN_SUPER)
    const cle = (libelle) => [...hote.querySelectorAll('.rf-cle')].find((b) => b.textContent.includes(libelle))

    await cliquer(cle('Validées'))
    expect(hote.querySelectorAll('.rf-entree')).toHaveLength(2)
    expect(hote.textContent).not.toContain('Awa Koffi')

    await cliquer(cle('Toutes'))
    const champ = hote.querySelector('.rf-champ-recherche input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(champ, 'EMP-0101')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(hote.querySelectorAll('.rf-entree')).toHaveLength(1)
    expect(hote.textContent).toContain('Afi Dossou')
  })

  it('valide une fiche : l’auteur et l’instant sont enregistrés', async () => {
    await ouvrir()
    await cliquer(lienDans(entree('Awa Koffi'), 'Valider'))

    const ecriture = dernier('update', 'face_enrollments')
    expect(ecriture.filtres).toEqual({ id: 'f1' })
    expect(ecriture.payload.status).toBe('approved')
    expect(ecriture.payload.approved_by).toBe('adm-1')
    expect(typeof ecriture.payload.approved_at).toBe('string')
    expect(ecriture.payload.updated_at).toBe(ecriture.payload.approved_at)
    // la liste se relit : la fiche est désormais validée
    expect(entree('Awa Koffi').querySelector('.rf-sceau').textContent).toBe('Validée')
  })

  it('refuse sans motif : rien ne part, et l’écran dit pourquoi', async () => {
    await ouvrir()
    await cliquer(lienDans(entree('Awa Koffi'), 'Refuser'))
    await cliquer(bouton('Confirmer le refus'))

    expect(hote.querySelector('.rf-erreur').textContent).toContain('Indiquez un motif')
    expect(faux.journal.some((e) => e.action === 'update')).toBe(false)
  })

  it('refuse avec un motif : le motif part avec le refus', async () => {
    await ouvrir()
    await cliquer(lienDans(entree('Awa Koffi'), 'Refuser'))
    await ecrire(hote.querySelector('.rf-zone-texte'), 'Photo floue, visage masqué')
    await cliquer(bouton('Confirmer le refus'))

    const ecriture = dernier('update', 'face_enrollments')
    expect(ecriture.payload).toMatchObject({
      status: 'rejected',
      rejection_reason: 'Photo floue, visage masqué',
    })
    expect(entree('Awa Koffi').textContent).toContain('Motif du refus')
  })

  it('ré-enrôle : la fiche est désactivée jusqu’à la nouvelle photo', async () => {
    await ouvrir()
    await cliquer(lienDans(entree('Kossi Mensah'), 'Ré-enrôler'))

    const ecriture = dernier('update', 'face_enrollments')
    expect(ecriture.filtres).toEqual({ id: 'f2' })
    expect(ecriture.payload.is_active).toBe(false)
    expect(hote.textContent).toContain('Ré-enrôlement demandé pour Kossi Mensah')
  })

  it('supprime après confirmation, et seulement alors', async () => {
    await ouvrir()
    await cliquer(lienDans(entree('Awa Koffi'), 'Supprimer'))
    expect(faux.journal.some((e) => e.action === 'delete')).toBe(false)

    await cliquer(bouton('Supprimer la fiche'))
    expect(dernier('delete', 'face_enrollments').filtres).toEqual({ id: 'f1' })
    expect(entree('Awa Koffi')).toBeUndefined()
  })

  it('ne laisse aucun mot d’atelier ni nom technique à l’écran', async () => {
    await ouvrir(ADMIN_SUPER)
    await versReglages()
    const texte = hote.textContent
    expect(texte).not.toMatch(/pagne|teint|métier à perles|collier de perles|atelier/i)
    expect(texte).not.toMatch(/face_enrollments|face_recognition_config|supabase/i)
    // les états se disent en français, pas en emoji
    expect(PAGE).not.toMatch(/⏳|✅|❌/)
  })
})

// ═══════════════════════════════════════════════════════════
// 5. LES RÉGLAGES
// ═══════════════════════════════════════════════════════════

describe('5. les réglages', () => {
  it('lit la configuration de l’entreprise et la montre telle quelle', async () => {
    await ouvrir()
    await versReglages()

    expect(hote.textContent).toContain('72 %')
    expect(hote.querySelector('.rf-compteur output').textContent).toBe('5')
    const choisi = hote.querySelector('.rf-mode[data-actif="oui"]')
    expect(choisi.textContent).toContain('Visage obligatoire')
    expect(hote.querySelector('#rf-interrupteur-vivant').textContent).toContain('Vérifier que le visage est vivant')
  })

  it('demande une entreprise au super administrateur avant de régler quoi que ce soit', async () => {
    await ouvrir(ADMIN_SUPER)
    await versReglages()

    expect(hote.textContent).toContain('Choisissez une entreprise pour régler sa reconnaissance.')
    expect(hote.querySelector('.rf-enregistrement')).toBeNull()

    const select = hote.querySelector('#rf-vue-reglages select')
    await choisir(select, 'ent-1')
    expect(hote.textContent).toContain('72 %')
    expect(hote.textContent).toContain('Kossi & Fils SARL')
  })

  it('n’enregistre pas des réglages inchangés', async () => {
    await ouvrir()
    await versReglages()
    const enregistrer = bouton('Enregistrer les réglages')
    expect(enregistrer.disabled).toBe(true)
    expect(hote.querySelector('.rf-enregistrement-etat').textContent).toContain('Réglages à jour')
  })

  it('enregistre sur la bonne entreprise, en mettant à jour la ligne existante', async () => {
    await ouvrir()
    await versReglages()

    await cliquer(interrupteur('Autre mode autorisé après échec'))
    expect(hote.textContent).toContain('Sans autre mode, un employé non reconnu ne peut pas pointer du tout.')

    const enregistrer = bouton('Enregistrer les réglages')
    expect(enregistrer.disabled).toBe(false)
    await cliquer(enregistrer)

    const ecriture = dernier('upsert', 'face_recognition_config')
    expect(ecriture.options).toEqual({ onConflict: 'enterprise_id' })
    expect(ecriture.payload.enterprise_id).toBe('ent-1')
    expect(ecriture.payload.fallback_allowed).toBe(false)
    expect(ecriture.payload.confidence_threshold).toBe(0.72)
    expect(ecriture.payload.max_attempts).toBe(5)
    expect(typeof ecriture.payload.updated_at).toBe('string')
    expect(hote.querySelector('.rf-enregistrement-etat').textContent).toContain('Réglages à jour')
  })

  it('tient les bornes des tentatives', async () => {
    await ouvrir()
    await versReglages()
    const plus = () => hote.querySelectorAll('.rf-compteur button')[1]
    const moins = () => hote.querySelectorAll('.rf-compteur button')[0]

    for (let i = 0; i < 8; i += 1) await cliquer(plus())
    expect(hote.querySelector('.rf-compteur output').textContent).toBe('10')
    expect(plus().disabled).toBe(true)

    for (let i = 0; i < 12; i += 1) await cliquer(moins())
    expect(hote.querySelector('.rf-compteur output').textContent).toBe('1')
    expect(moins().disabled).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// 6. LES RÈGLES DE DESSIN
// ═══════════════════════════════════════════════════════════

describe('6. les règles de dessin', () => {
  it('ne change au survol ni le fond d’un texte, ni sa couleur, ni son opacité', () => {
    const regles = CSS.match(/[^{}]*:hover[^{}]*\{[^}]*\}/g) || []
    expect(regles.length).toBeGreaterThan(5)
    for (const regle of regles) {
      const corps = regle.slice(regle.indexOf('{') + 1)
      expect(corps, regle).not.toMatch(/(^|;)\s*background(-color)?\s*:/)
      expect(corps, regle).not.toMatch(/(^|;)\s*opacity\s*:/)
      expect(corps.replace(/border-color\s*:/g, ''), regle).not.toMatch(/(^|;)\s*color\s*:/)
    }
  })

  it('dessine ses contrôles au lieu de cases nues', () => {
    expect(CSS).toMatch(/\.rf-bascule-piste/)
    expect(CSS).toMatch(/\.rf-bascule-pouce/)
    expect(CSS).toMatch(/\.rf-compteur button/)
    expect(CSS).toMatch(/\.rf-cle \{/)
    // le mode de pointage est un vrai groupe de boutons radio
    expect(PAGE).toContain('type="radio"')
    expect(PAGE).toContain('role="radiogroup"')
    expect(CSS).toMatch(/\.rf-mode-puce/)
  })

  it('a un chargement dessiné, pas une roue photo', () => {
    expect(PAGE).toContain('rf-charge-losange')
    expect(CSS).toContain('@keyframes rf-losange')
    expect(PAGE).not.toContain('spin')
  })

  it('reste lisible sur téléphone et respecte le mouvement réduit', () => {
    expect(CSS).toContain('@media (max-width: 760px)')
    expect(CSS).toContain('@media (max-width: 560px)')
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    // les cibles de doigt ne descendent pas sous 34 px
    expect(CSS).toMatch(/\.rf-cle \{[^}]*height: 34px/)
    expect(CSS).toMatch(/\.rf-bouton,\s*\n\.rf-bouton-creux \{[^}]*height: 34px/)
  })
})
