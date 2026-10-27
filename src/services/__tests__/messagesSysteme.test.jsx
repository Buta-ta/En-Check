// ═══════════════════════════════════════════════════════════
// MESSAGES SYSTÈME — les annonces, les push et les courriels
//
// Ce que ces tests défendent :
//
//   ① les deux pages n'en font plus qu'une : une route, une
//     redirection, une entrée de menu, un motif ;
//   ② « Mon compte » a quitté la barre latérale, la page reste
//     accessible depuis « Administrateurs » ;
//   ③ la bibliothèque `messagesSysteme.js` lit les trois sources
//     sans inventer : états, compteurs, filtres, CSV, confirmation ;
//   ④ les gestes marchent : publier, couper, supprimer, composer,
//     envoyer, filtrer, exporter, vider après avoir tapé « EFFACER » ;
//   ⑤ la page se lit : stèles, sommaire, cartouches d'écru, aucun
//     emoji, aucun style en ligne, aucun nom de table ;
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

import MessagesSysteme from '../../pages/MessagesSysteme'
import PageCulturalBand from '../../components/PageCulturalBand'
import { culturalMotifForPath } from '../../components/culturalMotif'
import {
  compterAnnonces, confirmationValide, construireCSV, dateCourte, dateHeure,
  estDansFenetre, etatAnnonce, filtrerEnvois, graviteDe, libelleCible, libelleCibleLog,
  libelleGravite, libellePriorite, libelleType, nomPersonne, plageAnnonce,
  resumeCourriels, resumeDestinataires, resumeEnvois, statutCourriel, tempsRelatif,
  trierAnnonces,
} from '../../lib/messagesSysteme'

// ── la fausse base ─────────────────────────────────────────
const { faux } = vi.hoisted(() => {
  const journal = []
  const tables = {
    messages_systeme: [],
    push_logs: [],
    enterprises: [],
    admins: [],
    employees: [],
    encheck_email_logs: [],
  }

  const executer = (etat) => {
    const lignes = tables[etat.table] || []
    const retenues = lignes.filter((ligne) => etat.filtres.every((filtre) => filtre(ligne)))

    if (etat.action === 'insert') {
      const lignesAjoutees = (Array.isArray(etat.payload) ? etat.payload : [etat.payload])
        .map((ligne, index) => ({ id: `${etat.table}-${lignes.length + index + 1}`, ...ligne }))
      tables[etat.table] = [...lignes, ...lignesAjoutees]
      journal.push({ table: etat.table, action: 'insert', payload: etat.payload })
      return { data: lignesAjoutees, error: null }
    }

    if (etat.action === 'update') {
      tables[etat.table] = lignes.map((ligne) =>
        etat.filtres.every((filtre) => filtre(ligne)) ? { ...ligne, ...etat.payload } : ligne)
      journal.push({ table: etat.table, action: 'update', payload: etat.payload, appels: [...etat.appels] })
      return { data: null, error: null }
    }

    if (etat.action === 'delete') {
      const ids = retenues.map((ligne) => ligne.id)
      tables[etat.table] = lignes.filter((ligne) => !ids.includes(ligne.id))
      journal.push({ table: etat.table, action: 'delete', nombre: ids.length, appels: [...etat.appels] })
      return { data: null, error: null }
    }

    const vues = etat.limite ? retenues.slice(0, etat.limite) : retenues
    journal.push({ table: etat.table, action: 'select', nombre: vues.length, appels: [...etat.appels] })
    return { data: vues.map((ligne) => ({ ...ligne })), error: null }
  }

  const fabriquer = (table) => {
    const etat = { table, action: 'select', filtres: [], appels: [], payload: null, limite: null }
    const chaine = {
      select: () => chaine,
      eq: (colonne, valeur) => {
        etat.filtres.push((ligne) => ligne[colonne] === valeur)
        etat.appels.push(`eq:${colonne}=${valeur}`)
        return chaine
      },
      neq: (colonne, valeur) => {
        etat.filtres.push((ligne) => ligne[colonne] !== valeur)
        etat.appels.push(`neq:${colonne}`)
        return chaine
      },
      gte: (colonne, valeur) => {
        etat.filtres.push((ligne) => new Date(ligne[colonne]) >= new Date(valeur))
        etat.appels.push(`gte:${colonne}`)
        return chaine
      },
      order: () => chaine,
      limit: (nombre) => { etat.limite = nombre; etat.appels.push(`limit:${nombre}`); return chaine },
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
        Object.keys(tables).forEach((cle) => { tables[cle] = [] })
      },
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => faux.from(table),
    auth: { getSession: async () => ({ data: { session: { access_token: 'jeton-de-test' } } }) },
  },
  supabaseEmployee: { from: (table) => faux.from(table) },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: () => {} }),
}))

vi.mock('../../components/EmailDeliveryMonitor', () => ({
  default: () => <div data-testid="moniteur-email">Le moniteur e-mail</div>,
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const PAGE = lire('src/pages/MessagesSysteme.jsx')
const CSS = lire('src/pages/MessagesSysteme.css')
const LIB = lire('src/lib/messagesSysteme.js')
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

const annonce = (extra = {}) => ({
  id: 'a-1',
  type: 'maintenance',
  titre: 'Maintenance du serveur de pointage',
  message: 'Les pointages seront indisponibles samedi de 22 h à 23 h.',
  date_debut: null,
  date_fin: null,
  priorite: 'haute',
  cible: 'tous',
  created_by: 'adm-1',
  is_active: true,
  created_at: ilYA(1),
  ...extra,
})

const envoi = (extra = {}) => ({
  id: 'p-1',
  title: 'Coupure de pointage ce soir',
  body: 'Les pointages seront indisponibles de 22 h à 23 h.',
  target_type: 'all',
  success_count: 48,
  failed_count: 2,
  payload: { severity: 'critical' },
  created_at: ilYA(0, 18),
  ...extra,
})

const courriel = (extra = {}) => ({
  statut: 'accepted',
  envoyes: 1,
  echecs: 0,
  created_at: ilYA(0, 8),
  ...extra,
})

const ADMIN = { id: 'adm-1', role: 'super_admin', first_name: 'Rosine' }

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  localStorage.setItem('push_sound_enabled', 'false')
  faux.vider()

  faux.tables.messages_systeme = [
    annonce(),
    annonce({
      id: 'a-2', type: 'mise_a_jour', titre: 'Nouveaux rapports de paie',
      message: 'Les bulletins mensuels sortent le 3.', priorite: 'normale', cible: 'admins',
    }),
    annonce({
      id: 'a-3', type: 'info', titre: 'Nouveau règlement des pauses',
      message: 'La pause déjeuner passe à 45 minutes.', priorite: 'basse', cible: 'employes',
      is_active: false,
    }),
  ]

  faux.tables.push_logs = [
    envoi(),
    envoi({ id: 'p-2', title: 'Retards non justifiés', payload: { severity: 'warning' }, target_type: 'enterprise', success_count: 18, failed_count: 0, created_at: ilYA(1, 9) }),
    envoi({ id: 'p-3', title: 'Nouveaux rapports de paie', payload: { severity: 'info' }, target_type: 'admins', success_count: 12, failed_count: 0, created_at: ilYA(2, 16) }),
  ]

  faux.tables.enterprises = [{ id: 'ent-1', name: 'Sèmè City', is_active: true }]
  faux.tables.admins = [
    { id: 'adm-1', first_name: 'Rosine', last_name: 'Adjovi', email: 'rosine@encheck.bj', is_active: true },
    { id: 'adm-2', first_name: 'Serge', last_name: 'Tossou', email: 'serge@encheck.bj', is_active: true },
  ]
  faux.tables.employees = [
    { id: 'e-1', first_name: 'Alice', last_name: 'Houngbo', email: 'alice@encheck.bj', is_active: true },
  ]
  faux.tables.encheck_email_logs = [
    courriel(),
    courriel({ statut: 'failed', envoyes: 0, echecs: 1 }),
    courriel({ statut: 'partial', envoyes: 2, echecs: 1 }),
  ]

  URL.createObjectURL = vi.fn(() => 'blob:envois')
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
  delete global.fetch
})

const laisser = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

async function ouvrir(chemin = '/system-messages', admin = ADMIN) {
  localStorage.setItem('admin', JSON.stringify(admin))
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={[chemin]}>
        <MessagesSysteme />
      </MemoryRouter>,
    )
  })
  await laisser()
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.trim().includes(texte))
const onglet = (texte) => [...hote.querySelectorAll('.ms-onglet')].find((b) => b.textContent.includes(texte))

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

async function choisir(select, valeur) {
  expect(select).toBeTruthy()
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(select, valeur)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await laisser()
}

const dernier = (action, table) =>
  [...faux.journal].reverse().find((entree) => entree.action === action && entree.table === table)

// ═══════════════════════════════════════════════════════════
// 1. UNE SEULE PAGE, ET MON COMPTE QUITTE LA BARRE
// ═══════════════════════════════════════════════════════════

describe('1. une seule page pour les messages', () => {
  it('n’a plus de pages séparées', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/pages/SystemMessages.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/pages/PushNotifications.jsx'))).toBe(false)
    expect(APP).not.toContain("from './pages/SystemMessages'")
    expect(APP).not.toContain("from './pages/PushNotifications'")
  })

  it('sert la page sur /system-messages et renvoie l’ancienne adresse', () => {
    expect(APP).toContain("import MessagesSysteme from './pages/MessagesSysteme'")
    expect(APP).toContain('<Route path="/system-messages"')
    expect(APP).toContain('<Route path="/push-notifications" element={<Navigate to="/system-messages?vue=push" replace />} />')
  })

  it('ne garde qu’une entrée de menu', () => {
    expect(MENU).toContain("label: 'Messages système'")
    expect(MENU).not.toContain("label: 'Notifications push'")
    expect(MENU).not.toContain('/push-notifications')
    expect(MENU.match(/'\/system-messages'/g)).toHaveLength(1)
  })

  it('a retiré « Mon compte » de la barre latérale, sans tuer la page', () => {
    expect(MENU).not.toContain("label: 'Mon compte'")
    expect(MENU).not.toContain("'/mon-compte'")
    // la page existe toujours : « Administrateurs » y renvoie
    expect(APP).toContain('<Route path="/mon-compte"')
    expect(fs.existsSync(path.join(ROOT, 'src/pages/MyAdminAccount.jsx'))).toBe(true)
    const comptes = lire('src/pages/AdminAccounts.jsx')
    expect(comptes).toContain('to="/mon-compte"')
  })

  it('ne laisse aucun pointeur mort vers l’ancienne page push', () => {
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
      return /['"`]\/push-notifications['"`]/.test(fs.readFileSync(fichier, 'utf8'))
    })
    expect(pointeurs.map((f) => path.relative(ROOT, f))).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════
// 2. LA TOILE DE KORHOGO
// ═══════════════════════════════════════════════════════════

describe('2. la toile de korhogo', () => {
  it('devient le motif de la page, y compris pour l’ancienne adresse', () => {
    expect(culturalMotifForPath('/system-messages')).toBe('korhogo')
    expect(culturalMotifForPath('/system-messages?vue=push')).toBe('korhogo')
    expect(culturalMotifForPath('/push-notifications')).toBe('korhogo')
    expect(MOTIFS).toContain("['system-messages', 'push-notifications']")
    expect(culturalMotifForPath('/analytics')).toBe('korhogo')
  })

  it('pose le vrai bandeau, en haut et en bas', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/system-messages" />)
    expect(html).toContain('data-cultural-motif="korhogo"')
    expect(html).toContain('<svg')
    expect(PAGE).toContain('<PageCulturalBand pathname="/system-messages" />')
    expect(PAGE).toContain('placement="bottom"')
  })

  it('garde la bascule clair/sombre propre à la page', () => {
    expect(PAGE).toContain('useTheme')
    expect(PAGE).toContain('role="switch"')
    expect(CSS).toContain('.ms-page.ms-clair')
    expect(CSS).toMatch(/--ms-fumee:/)
    expect(CSS).toMatch(/--ms-ecru:/)
    expect(CSS).toMatch(/--ms-ocre:/)
  })
})

// ═══════════════════════════════════════════════════════════
// 3. LA BIBLIOTHÈQUE
// ═══════════════════════════════════════════════════════════

describe('3. ce que les trois sources disent', () => {
  it('nomme les types, priorités, cibles et gravités', () => {
    expect(libelleType('maintenance')).toBe('Maintenance')
    expect(libelleType('mise_a_jour')).toBe('Mise à jour')
    expect(libelleType('n_importe_quoi')).toBe('Information')
    expect(libellePriorite('haute')).toBe('Haute')
    expect(libelleCible('employes')).toBe('Employés')
    expect(libelleGravite('critical')).toBe('Critique')
    expect(libelleCibleLog({ target_type: 'all' })).toBe('Diffusion générale')
    expect(libelleCibleLog({ target_type: 'enterprise' })).toBe('Entreprise')
    expect(graviteDe({ payload: { severity: 'warning' } })).toBe('warning')
    expect(graviteDe({})).toBe('info')
  })

  it('lit la fenêtre et l’état d’une annonce', () => {
    const maintenant = new Date('2026-10-27T12:00:00Z')
    expect(estDansFenetre(null, null, maintenant)).toBe(true)
    expect(estDansFenetre('2026-10-28T00:00:00Z', null, maintenant)).toBe(false)
    expect(estDansFenetre(null, '2026-10-26T00:00:00Z', maintenant)).toBe(false)
    expect(etatAnnonce({ is_active: true }, maintenant)).toBe('active')
    expect(etatAnnonce({ is_active: false }, maintenant)).toBe('coupee')
    expect(etatAnnonce({ is_active: true, date_debut: '2026-10-28T00:00:00Z' }, maintenant)).toBe('a_venir')
    expect(etatAnnonce({ is_active: true, date_fin: '2026-10-26T00:00:00Z' }, maintenant)).toBe('terminee')
  })

  it('compte et trie les annonces', () => {
    const compte = compterAnnonces([
      annonce(), annonce({ id: 'b', is_active: false }),
      annonce({ id: 'c', priorite: 'normale' }),
    ])
    expect(compte.total).toBe(3)
    expect(compte.actives).toBe(2)
    expect(compte.coupees).toBe(1)
    expect(compte.hautes).toBe(2)

    const triees = trierAnnonces([
      { id: '1', is_active: false, priorite: 'haute' },
      { id: '2', is_active: true, priorite: 'basse' },
      { id: '3', is_active: true, priorite: 'haute' },
    ])
    expect(triees.map((item) => item.id)).toEqual(['3', '2', '1'])
  })

  it('écrit la plage d’une annonce', () => {
    expect(plageAnnonce({})).toBe('Sans limite de dates')
    expect(plageAnnonce({ date_debut: '2026-11-01T22:00:00Z' })).toContain('Depuis le')
    expect(plageAnnonce({ date_fin: '2026-11-08T23:00:00Z' })).toContain('Jusqu’au')
    expect(plageAnnonce({ date_debut: '2026-11-01T22:00:00Z', date_fin: '2026-11-02T23:00:00Z' })).toContain('→')
  })

  it('filtre et résume les envois', () => {
    const logs = [
      envoi(), envoi({ id: 'b', payload: { severity: 'warning' }, target_type: 'admins', success_count: 2, failed_count: 0 }),
      envoi({ id: 'c', payload: { severity: 'info' }, target_type: 'employees', success_count: 1, failed_count: 0 }),
    ]
    expect(filtrerEnvois(logs, { gravite: 'warning' })).toHaveLength(1)
    expect(filtrerEnvois(logs, { cible: 'admins' })).toHaveLength(1)
    expect(filtrerEnvois(logs, { gravite: 'critical', cible: 'admins' })).toHaveLength(0)

    const resume = resumeEnvois(logs)
    expect(resume.total).toBe(3)
    expect(resume.envoyes).toBe(51)
    expect(resume.echecs).toBe(2)
    expect(resume.taux).toBe(96)
    expect(resume.parGravite.critical).toBe(1)
  })

  it('écrit l’historique en CSV', () => {
    const csv = construireCSV([envoi()])
    const lignes = csv.split('\n')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toContain('"Quand";"Titre";"Message";"Gravité";"Destinataires"')
    expect(lignes[1]).toContain('"Coupure de pointage ce soir"')
    expect(lignes[1]).toContain('"Critique"')
    expect(lignes[1]).toContain('"Diffusion générale"')
    expect(lignes[1]).toContain('"48";"2"')
  })

  it('résume les courriels comme le moniteur', () => {
    expect(statutCourriel({ envoyes: 1, echecs: 0 })).toBe('accepted')
    expect(statutCourriel({ envoyes: 0, echecs: 1 })).toBe('failed')
    expect(statutCourriel({ envoyes: 2, echecs: 1 })).toBe('partial')
    const resume = resumeCourriels([courriel(), courriel({ statut: 'failed' }), courriel({ statut: 'partial' })])
    expect(resume.tentatives).toBe(3)
    expect(resume.acceptees).toBe(1)
    expect(resume.echecs).toBe(1)
    expect(resume.partiels).toBe(1)
  })

  it('exige le mot « EFFACER », rien d’autre', () => {
    expect(confirmationValide('EFFACER')).toBe(true)
    expect(confirmationValide('  effacer ')).toBe(true)
    expect(confirmationValide('efface')).toBe(false)
    expect(confirmationValide('')).toBe(false)
  })

  it('dit qui l’envoi va toucher', () => {
    expect(resumeDestinataires({ cible: 'all', admins: [1, 2], employes: [1, 2, 3] })).toContain('5 personnes')
    expect(resumeDestinataires({ cible: 'admins', admins: [1, 2], employes: [] })).toBe('2 administrateurs')
    expect(resumeDestinataires({ cible: 'employees', admins: [], employes: [1] })).toBe('1 employés')
    expect(resumeDestinataires({ cible: 'enterprise', entreprise: 'Sèmè City' })).toContain('Sèmè City')
    expect(resumeDestinataires({ cible: 'enterprise' })).toContain('Choisissez')
    expect(nomPersonne({ first_name: 'Rosine', last_name: 'Adjovi' })).toBe('Rosine Adjovi')
    expect(nomPersonne({ email: 'x@y.bj' })).toBe('x@y.bj')
  })

  it('formate les dates sans planter sur du vide', () => {
    expect(dateHeure(null)).toBe('—')
    expect(dateHeure('pas une date')).toBe('—')
    expect(dateCourte(null)).toBe('')
    expect(tempsRelatif(null)).toBe('—')
    expect(tempsRelatif(new Date(Date.now() - 3 * 60000).toISOString())).toBe('il y a 3 min')
    expect(LIB).toContain("MOT_CONFIRMATION = 'EFFACER'")
  })
})

// ═══════════════════════════════════════════════════════════
// 4. LA PAGE — ANNONCES
// ═══════════════════════════════════════════════════════════

describe('4. les annonces', () => {
  it('affiche les stèles, le sommaire et les annonces', async () => {
    await ouvrir()
    expect(hote.querySelectorAll('.ms-stele')).toHaveLength(4)
    expect(hote.querySelectorAll('.ms-onglet')).toHaveLength(3)
    expect(hote.querySelector('.ms-onglet[aria-selected="true"]').textContent).toContain('Annonces')
    expect(hote.querySelector('#ms-vue-annonces')).not.toBeNull()
    expect(hote.querySelectorAll('.ms-annonce')).toHaveLength(3)
    expect(hote.textContent).toContain('Maintenance du serveur de pointage')
    expect(hote.textContent).toContain('À l’écran')
    expect(hote.textContent).toContain('Coupée')
    expect(hote.textContent).toContain('Employés')
    expect(hote.textContent).toContain('2 annonces à l’écran')
  })

  it('ne montre ni emoji, ni nom de table, ni toast', async () => {
    await ouvrir()
    expect(hote.innerHTML).not.toMatch(/messages_systeme|push_logs|encheck_email_logs|is_active|created_by/)
    expect(hote.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })

  it('publie une annonce avec sa cible et sa fenêtre', async () => {
    await ouvrir()
    const formulaire = hote.querySelector('.ms-formulaire')
    await ecrire(formulaire.querySelector('input[placeholder*="Maintenance"]'), 'Coupure de pointage')
    await ecrire(formulaire.querySelector('textarea'), 'Samedi de 22 h à 23 h.')
    await choisir(formulaire.querySelectorAll('select')[2], 'admins')
    await cliquer([...formulaire.querySelectorAll('button')].find((b) => b.textContent.includes('Publier')))

    const insertion = dernier('insert', 'messages_systeme')
    expect(insertion).toBeTruthy()
    expect(insertion.payload[0].titre).toBe('Coupure de pointage')
    expect(insertion.payload[0].cible).toBe('admins')
    expect(insertion.payload[0].is_active).toBe(true)
    expect(insertion.payload[0].created_by).toBe('adm-1')
    expect(hote.textContent).toContain('L’annonce est publiée')
  })

  it('refuse une annonce sans titre ni message', async () => {
    await ouvrir()
    const avant = faux.journal.length
    await cliquer([...hote.querySelectorAll('.ms-formulaire button')].find((b) => b.textContent.includes('Publier')))
    expect(dernier('insert', 'messages_systeme')).toBeUndefined()
    expect(faux.journal.length).toBe(avant)
    expect(hote.textContent).toContain('Un titre et un message sont nécessaires')
  })

  it('coupe et rallume une annonce', async () => {
    await ouvrir()
    const premiere = hote.querySelector('.ms-annonce')
    await cliquer(premiere.querySelector('.ms-interrupteur'))
    expect(dernier('update', 'messages_systeme').payload).toEqual({ is_active: false })
    expect(hote.textContent).toContain('Annonce coupée')
  })

  it('supprime une annonce après confirmation', async () => {
    await ouvrir()
    await cliquer([...hote.querySelectorAll('.ms-annonce')][0].querySelector('.ms-icon-bouton'))
    const fenetre = hote.querySelector('.ms-fenetre')
    expect(fenetre.textContent).toContain('Supprimer cette annonce ?')
    expect(fenetre.textContent).toContain('disparaît des écrans')
    await cliquer([...fenetre.querySelectorAll('button')].find((b) => b.textContent.includes('Supprimer')))
    expect(dernier('delete', 'messages_systeme').nombre).toBe(1)
    expect(hote.textContent).toContain('Annonce supprimée')
  })

  it('montre l’aperçu du bandeau pendant la saisie', async () => {
    await ouvrir()
    const formulaire = hote.querySelector('.ms-formulaire')
    await ecrire(formulaire.querySelector('input[placeholder*="Maintenance"]'), 'Titre d’essai')
    expect(hote.querySelector('.ms-apercu-bandeau').textContent).toContain('Titre d’essai')
    expect(hote.querySelector('.ms-apercu-bandeau').textContent).toContain('Le message de l’annonce')
  })
})

// ═══════════════════════════════════════════════════════════
// 5. LA PAGE — NOTIFICATIONS PUSH
// ═══════════════════════════════════════════════════════════

describe('5. les notifications push', () => {
  it('change de vue et affiche le composeur et l’historique', async () => {
    await ouvrir('/system-messages?vue=push')
    expect(hote.querySelector('#ms-vue-push')).not.toBeNull()
    expect(hote.querySelector('.ms-onglet[aria-selected="true"]').textContent).toContain('Notifications push')
    expect(hote.textContent).toContain('Composer un envoi')
    expect(hote.querySelectorAll('.ms-envoi')).toHaveLength(3)
    expect(hote.textContent).toContain('Coupure de pointage ce soir')
    expect(hote.textContent).toContain('Diffusion générale')
  })

  it('dit qui l’envoi va toucher avant de partir', async () => {
    await ouvrir('/system-messages?vue=push')
    expect(hote.querySelector('.ms-destinataires').textContent).toContain('3 personnes')
    await choisir(hote.querySelector('.ms-formulaire select'), 'admins')
    expect(hote.querySelector('.ms-destinataires').textContent).toContain('2 administrateurs')
    await choisir(hote.querySelector('.ms-formulaire select'), 'employee')
    const choix = hote.querySelectorAll('.ms-formulaire select')[1]
    await choisir(choix, 'e-1')
    expect(hote.querySelector('.ms-destinataires').textContent).toContain('Un employé choisi')
  })

  it('envoie une notification et dit combien sont parties', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sent: 26, failed: 0 }),
    }))
    await ouvrir('/system-messages?vue=push')
    const formulaire = hote.querySelector('.ms-formulaire')
    const champs = formulaire.querySelectorAll('input')
    await ecrire(champs[0], 'Coupure de pointage ce soir')
    await ecrire(formulaire.querySelector('textarea'), 'Pointez avant 22 h.')
    await cliquer([...formulaire.querySelectorAll('button')].find((b) => b.type === 'submit'))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [, options] = global.fetch.mock.calls[0]
    const charge = JSON.parse(options.body)
    expect(charge.title).toBe('Coupure de pointage ce soir')
    expect(charge.severity).toBe('info')
    expect(charge.user_type).toBeNull()
    expect(options.headers.Authorization).toBe('Bearer jeton-de-test')
    expect(hote.textContent).toContain('26 notifications envoyées')
  })

  it('n’envoie rien sans titre ni message', async () => {
    global.fetch = vi.fn()
    await ouvrir('/system-messages?vue=push')
    await cliquer([...hote.querySelectorAll('.ms-formulaire button')].find((b) => b.type === 'submit'))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(hote.textContent).toContain('Un titre et un message sont nécessaires')
  })

  it('dit l’échec au lieu de faire semblant', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'fonction absente' }),
    }))
    await ouvrir('/system-messages?vue=push')
    const formulaire = hote.querySelector('.ms-formulaire')
    await ecrire(formulaire.querySelectorAll('input')[0], 'Essai')
    await ecrire(formulaire.querySelector('textarea'), 'Message d’essai')
    await cliquer([...formulaire.querySelectorAll('button')].find((b) => b.type === 'submit'))
    expect(hote.textContent).toContain('fonction absente')
  })

  it('filtre l’historique sans rappeler le serveur', async () => {
    await ouvrir('/system-messages?vue=push')
    const avant = faux.journal.length
    const [filtreGravite] = hote.querySelectorAll('.ms-date select')
    await choisir(filtreGravite, 'warning')
    expect(hote.querySelectorAll('.ms-envoi')).toHaveLength(1)
    expect(hote.textContent).toContain('Retards non justifiés')
    expect(faux.journal.length).toBe(avant)
    await choisir(filtreGravite, 'all')
    await choisir(hote.querySelectorAll('.ms-date select')[1], 'admins')
    expect(hote.querySelectorAll('.ms-envoi')).toHaveLength(1)
    expect(hote.textContent).toContain('Nouveaux rapports de paie')
  })

  it('exporte l’historique filtré en CSV', async () => {
    await ouvrir('/system-messages?vue=push')
    const cree = URL.createObjectURL
    await cliquer(bouton('Exporter'))
    expect(cree).toHaveBeenCalledTimes(1)
    expect(hote.textContent).toContain('3 envois exportés')
  })

  it('retire un envoi de l’historique après confirmation', async () => {
    await ouvrir('/system-messages?vue=push')
    await cliquer(hote.querySelector('.ms-envoi .ms-icon-bouton'))
    const fenetre = hote.querySelector('.ms-fenetre')
    expect(fenetre.textContent).toContain('Retirer cette entrée ?')
    expect(fenetre.textContent).toContain('Le téléphone qui l’a reçue la garde')
    await cliquer([...fenetre.querySelectorAll('button')].find((b) => b.textContent.includes('Retirer')))
    expect(dernier('delete', 'push_logs').nombre).toBe(1)
  })

  it('vide l’historique seulement après avoir tapé « EFFACER »', async () => {
    await ouvrir('/system-messages?vue=push')
    await cliquer(bouton('Vider l’historique'))
    const fenetre = hote.querySelector('.ms-fenetre')
    expect(fenetre.textContent).toContain('Vider 3 envois de l’historique ?')
    expect(fenetre.textContent).toContain('Les annonces, les courriels, les comptes et les pointages ne sont pas touchés')
    const confirmer = [...fenetre.querySelectorAll('button')].find((b) => b.textContent.includes('Supprimer'))
    expect(confirmer.disabled).toBe(true)
    await ecrire(fenetre.querySelector('input'), 'EFFACER')
    expect(confirmer.disabled).toBe(false)
    await cliquer(confirmer)
    expect(dernier('delete', 'push_logs').appels).toContain('neq:id')
    expect(hote.textContent).toContain('L’historique des envois est vidé')
  })

  it('garde le son de confirmation dans les préférences', async () => {
    await ouvrir('/system-messages?vue=push')
    await cliquer(bouton('Son coupé'))
    expect(localStorage.getItem('push_sound_enabled')).toBe('true')
    expect(hote.textContent).toContain('Le son de confirmation est activé')
  })
})

// ═══════════════════════════════════════════════════════════
// 6. LA PAGE — E-MAILS
// ═══════════════════════════════════════════════════════════

describe('6. les courriels', () => {
  it('monte le moniteur existant dans la vue e-mails', async () => {
    await ouvrir()
    await cliquer(onglet('E-mails'))
    expect(hote.querySelector('#ms-vue-emails')).not.toBeNull()
    expect(hote.querySelector('[data-testid="moniteur-email"]')).not.toBeNull()
    expect(hote.textContent).toContain('le moniteur reste maître de ses envois')
  })

  it('compte les courriels en échec dans la stèle', async () => {
    await ouvrir()
    const stele = [...hote.querySelectorAll('.ms-stele')].find((s) => s.textContent.includes('Courriels en échec'))
    expect(stele.textContent).toContain('2')
    expect(stele.textContent).toContain('1 acceptés')
    expect(stele.textContent).toContain('1 partiels')
  })
})

// ═══════════════════════════════════════════════════════════
// 7. LE DESSIN
// ═══════════════════════════════════════════════════════════

describe('7. la toile, à la lecture', () => {
  it('n’écrit pas de style en ligne ni de toast parallèle', () => {
    expect(PAGE).not.toContain('<style')
    expect(PAGE).not.toContain('toast')
    expect(PAGE).not.toContain('alert(')
    expect(PAGE).not.toContain('confirm(')
    const enLigne = PAGE.split('\n').filter((ligne) => ligne.includes('style={{'))
    expect(enLigne).toHaveLength(0)
  })

  it('n’a aucun emoji dans le dessin', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
    expect(PAGE).not.toMatch(emoji)
    expect(CSS).not.toMatch(emoji)
    expect(PAGE).not.toMatch(/[✓↩•]/u)
  })

  it('ne change au survol ni le fond, ni la couleur, ni l’opacité', () => {
    const blocs = [...CSS.matchAll(/:hover[^{]*\{([^}]*)\}/g)].map((m) => m[1])
    expect(blocs.length).toBeGreaterThan(5)
    blocs.forEach((bloc) => {
      expect(bloc).not.toMatch(/(^|[\s;])color\s*:/)
      expect(bloc).not.toMatch(/(^|[\s;])background(-color)?\s*:/)
      expect(bloc).not.toMatch(/(^|[\s;])opacity\s*:/)
    })
  })

  it('dessine les contrôles au lieu de les laisser nus', () => {
    expect(CSS).toContain('.ms-segment')
    expect(CSS).toContain('.ms-case')
    expect(CSS).toContain('.ms-interrupteur-piste')
    expect(CSS).toContain('.ms-champ input')
    expect(CSS).toContain('border: 1px solid var(--ms-ligne)')
    expect(CSS).toContain('.ms-cartouche-ecru')
  })

  it('reste lisible sur un téléphone', () => {
    expect(CSS).toContain('@media (max-width: 720px)')
    expect(CSS).toContain('@media (max-width: 980px)')
    expect(CSS).toContain('prefers-reduced-motion')
  })

  it('garde les raccourcis en haut, jamais en bas', () => {
    const positions = [...PAGE.matchAll(/<RaccourcisPages[^>]*>/g)].map((m) => m.index)
    expect(positions).toHaveLength(1)
    const pied = PAGE.indexOf('<footer className="ms-pied"')
    expect(positions[0]).toBeLessThan(pied)
  })
})
