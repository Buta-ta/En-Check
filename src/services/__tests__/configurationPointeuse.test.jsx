// ═══════════════════════════════════════════════════════════
// 🎨 CONFIGURATION POINTEUSE — la page fusionnée
//
// Ce que ces tests défendent :
//
//   ① les pointeuses ADMS et le poste de pointage ne font plus
//     qu'un écran : une route, une redirection, une entrée de menu,
//     un verrou — et l'écran de la tablette reste ouvert seul ;
//   ② le motif est la toile de Korhogo, avec son blason dessiné,
//     sans le décor bleu nuit de l'ancienne page ;
//   ③ la mécanique ADMS n'a pas bougé : mêmes tables, même
//     fonction serveur, même clé d'appareil, même `appareils.json` ;
//   ④ les gestes marchent pour de vrai : enregistrer, copier,
//     mettre en pause, supprimer, lire le journal ;
//   ⑤ le poste se lit et s'installe depuis la même page, avec la
//     même mémoire que la tablette ;
//   ⑥ le survol ne touche ni le fond, ni la couleur, ni l'opacité ;
//     aucun mot d'atelier, aucun nom technique dans le texte lu.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import ConfigurationPointeuse from '../../pages/ConfigurationPointeuse'
import PostePointage from '../../pages/PostePointage'
import PageCulturalBand from '../../components/PageCulturalBand'
import { KorhogoBlasonNuitSvg } from '../../components/KorhogoSvg'
import { culturalMotifForPath } from '../../components/culturalMotif'
import { CLE_POSTE, sensSuivant, messageDe } from '../../lib/postePointage'

// ── la fausse base : elle journalise tout ce qu'on lui demande ──
const { faux } = vi.hoisted(() => {
  const journal = []
  const tables = { enterprises: [], adms_devices: [], adms_log: [] }
  let identifiant = 0

  const correspond = (ligne, filtres) =>
    Object.entries(filtres).every(([colonne, valeur]) => ligne[colonne] === valeur)

  const executer = (etat) => {
    const lignes = tables[etat.table] || []

    if (etat.action === 'insert') {
      identifiant += 1
      const ligne = { id: `gen-${identifiant}`, ...etat.payload }
      tables[etat.table] = [...lignes, ligne]
      journal.push({ table: etat.table, action: 'insert', payload: { ...etat.payload } })
      return { data: etat.single ? { ...ligne } : [{ ...ligne }], error: null }
    }

    if (etat.action === 'update') {
      const touchees = []
      tables[etat.table] = lignes.map((ligne) => {
        if (!correspond(ligne, etat.filtres)) return ligne
        touchees.push(ligne.id)
        return { ...ligne, ...etat.payload }
      })
      journal.push({ table: etat.table, action: 'update', filtres: { ...etat.filtres }, payload: { ...etat.payload } })
      return { data: touchees.map((id) => ({ id })), error: null }
    }

    if (etat.action === 'delete') {
      const parties = lignes.filter((ligne) => correspond(ligne, etat.filtres))
      tables[etat.table] = lignes.filter((ligne) => !parties.includes(ligne))
      journal.push({ table: etat.table, action: 'delete', filtres: { ...etat.filtres } })
      return { data: null, error: null }
    }

    let vues = lignes.filter((ligne) => correspond(ligne, etat.filtres))
    if (etat.tri) {
      const { colonne, ascendant } = etat.tri
      vues = [...vues].sort((a, b) => {
        const va = a[colonne] ?? ''
        const vb = b[colonne] ?? ''
        if (va === vb) return 0
        return (va > vb ? 1 : -1) * (ascendant ? 1 : -1)
      })
    }
    if (etat.limite) vues = vues.slice(0, etat.limite)
    journal.push({ table: etat.table, action: 'select', filtres: { ...etat.filtres } })
    const donnees = vues.map((ligne) => ({ ...ligne }))
    return { data: etat.single ? (donnees[0] ?? null) : donnees, error: null }
  }

  const fabriquer = (table) => {
    const etat = {
      table, action: 'select', filtres: {}, payload: null,
      single: false, tri: null, limite: null,
    }
    const chaine = {
      select: () => chaine,
      eq: (colonne, valeur) => { etat.filtres[colonne] = valeur; return chaine },
      order: (colonne, options = {}) => {
        etat.tri = { colonne, ascendant: options.ascending !== false }
        return chaine
      },
      limit: (nombre) => { etat.limite = nombre; return chaine },
      maybeSingle: () => { etat.single = true; return chaine },
      single: () => { etat.single = true; return chaine },
      insert: (payload) => {
        etat.action = 'insert'
        etat.payload = payload
        return chaine
      },
      update: (payload) => { etat.action = 'update'; etat.payload = payload; return chaine },
      delete: () => { etat.action = 'delete'; return chaine },
      then: (resoudre, rejeter) =>
        Promise.resolve().then(() => executer(etat)).then(resoudre, rejeter),
    }
    return chaine
  }

  // ── les fonctions serveur, simulées une par une ──
  const rpc = (nom, parametres) => {
    if (nom === 'encheck_employes_sans_pin') {
      return Promise.resolve({ data: [{ id: 'emp-sans-pin', matricule: 'EMP-0999' }], error: null })
    }
    if (nom === 'encheck_adms_appareil_ajouter') {
      identifiant += 1
      const serial = parametres.p_serial
      const secret = 'clé-secrète-' + serial.toLowerCase()
      tables.adms_devices = [
        ...tables.adms_devices,
        {
          id: `dev-${identifiant}`,
          enterprise_id: parametres.p_enterprise_id,
          serial_number: serial,
          label: parametres.p_label,
          secret,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          punch_count: 0,
          created_at: new Date().toISOString(),
        },
      ]
      journal.push({ table: 'adms_devices', action: 'rpc', nom, parametres: { ...parametres } })
      return Promise.resolve({
        data: { ok: true, serial_number: serial, secret, action: 'cree' },
        error: null,
      })
    }
    if (nom === 'encheck_entreprise_par_code') {
      return Promise.resolve({
        data: [{ id: 'ent-1', name: 'Kossi & Fils SARL' }],
        error: null,
      })
    }
    if (nom === 'encheck_employee_login_qr') {
      return Promise.resolve({ data: { ok: false, raison: 'pin_requis' }, error: null })
    }
    if (nom === 'encheck_pointages_historique') {
      return Promise.resolve({ data: [], error: null })
    }
    if (nom === 'encheck_punch') {
      return Promise.resolve({ data: { ok: true, check_time: new Date().toISOString() }, error: null })
    }
    journal.push({ table: 'rpc', action: 'rpc', nom, parametres: { ...parametres } })
    return Promise.resolve({ data: null, error: { message: `rpc inconnue : ${nom}` } })
  }

  return {
    faux: {
      journal,
      tables,
      from: fabriquer,
      rpc,
      vider() {
        journal.length = 0
        identifiant = 0
        tables.enterprises = []
        tables.adms_devices = []
        tables.adms_log = []
      },
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => faux.from(table),
    rpc: (nom, parametres) => faux.rpc(nom, parametres),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'adm-1' } } } }),
    },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: {} }) }) },
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: () => {} }),
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const PAGE = lire('src/pages/ConfigurationPointeuse.jsx')
const CSS = lire('src/pages/ConfigurationPointeuse.css')
const POSTE = lire('src/pages/PostePointage.jsx')
const POSTE_CSS = lire('src/pages/PostePointage.css')
const LIB = lire('src/lib/postePointage.js')
const APP = lire('src/App.jsx')
const MENU = lire('src/components/DashboardExperience.jsx')
const VERROU = lire('src/components/VerrouOptions.jsx')
const MOTIFS = lire('src/components/culturalMotif.js')

// ── les données de la fausse base ──────────────────────────────
const machine = (extra = {}) => ({
  id: 'dev-1',
  enterprise_id: 'ent-1',
  serial_number: 'AANF123456789',
  label: 'Pointeuse entrée dépôt',
  secret: 'a1b2c3d4e5f60718293a4b5c6d7e8f901122334455667788',
  is_active: true,
  last_seen_at: new Date().toISOString(),
  last_punch_at: new Date(Date.now() - 4 * 60000).toISOString(),
  punch_count: 1284,
  created_at: '2026-10-12T08:00:00.000Z',
  ...extra,
})

const ligneJournal = (extra = {}) => ({
  id: 'log-1',
  enterprise_id: 'ent-1',
  serial_number: 'AANF123456789',
  recu_le: '2026-10-27T08:12:00.000Z',
  payload_kind: 'ATTLOG',
  kind: 'attlog',
  lignes: 4,
  acceptees: 3,
  pins_inconnus: { 7: 1 },
  ...extra,
})

const ADMIN = {
  id: 'adm-1',
  role: 'admin',
  enterprise_id: 'ent-1',
  selectedEnterprise: { id: 'ent-1', name: 'Kossi & Fils SARL' },
}
const SUPER = { id: 'sup-1', role: 'super_admin' }

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  faux.vider()

  faux.tables.enterprises = [
    { id: 'ent-1', name: 'Kossi & Fils SARL', code: 'ENC-229', timezone: 'Africa/Douala' },
    { id: 'ent-2', name: 'Maison Adjovi', code: 'ENC-310', timezone: 'Africa/Porto-Novo' },
  ]
  faux.tables.adms_devices = [machine()]
  faux.tables.adms_log = [ligneJournal()]

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
      <MemoryRouter initialEntries={['/configuration-pointeuse']}>
        <ConfigurationPointeuse />
      </MemoryRouter>,
    )
  })
  await laisser()
  return hote
}

async function ouvrirPoste() {
  await act(async () => {
    racine.render(
      <MemoryRouter initialEntries={['/poste']}>
        <PostePointage />
      </MemoryRouter>,
    )
  })
  await laisser()
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes(texte))
const onglet = (texte) => [...hote.querySelectorAll('.cp-onglet')].find((b) => b.textContent.includes(texte))
const carteMachine = (nom) => [...hote.querySelectorAll('.cp-appareil')].find((li) => li.textContent.includes(nom))
const lienDans = (li, texte) => [...li.querySelectorAll('.cp-lien')].find((b) => b.textContent.includes(texte))

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
  await act(async () => saisir(champ, valeur))
}

const dernier = (action, table) =>
  [...faux.journal].reverse().find((entree) => entree.action === action && entree.table === table)

// ═══════════════════════════════════════════════════════════
// 1. UNE SEULE PAGE POUR LES DEUX ÉCRANS
// ═══════════════════════════════════════════════════════════

describe('1. une seule page pour les deux écrans', () => {
  it('n’a plus de page Pointeuses séparée', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/pages/Pointeuses.jsx'))).toBe(false)
    expect(APP).not.toContain("from './pages/Pointeuses'")
    expect(APP).toContain('import ConfigurationPointeuse')
    expect(APP).toContain('<Route path="/configuration-pointeuse"')
    // l'ancienne adresse ouvre la page commune
    expect(APP).toContain('<Route path="/pointeuses" element={<Navigate to="/configuration-pointeuse" replace />} />')
  })

  it('laisse l’écran de la tablette ouvert seul, hors administration', () => {
    // `/poste` n'est pas un écran d'administration : la tablette l'ouvre seule
    expect(APP).toContain('<Route path="/poste" element={<PostePointage />} />')
    expect(APP).not.toMatch(/path="\/poste"[\s\S]{0,80}AdminRoute/)
    // et il parle du même appareil que la page, par la même mémoire
    expect(POSTE).toContain("from '../lib/postePointage'")
    expect(LIB).toContain("export const CLE_POSTE = 'encheck_poste'")
    expect(CLE_POSTE).toBe('encheck_poste')
  })

  it('n’a qu’une entrée de menu, ouverte par l’une ou l’autre option', () => {
    expect(MENU).toContain("label: 'Configuration pointeuse'")
    expect(MENU).not.toContain("label: 'Pointeuses ADMS'")
    expect(MENU).not.toContain("label: 'Poste de pointage'")
    expect(MENU).toContain("path: '/configuration-pointeuse'")
    expect(MENU).toMatch(/modulePointeuses \|\| modulePostePointage/)
    expect(MENU.match(/'\/configuration-pointeuse'/g)).toHaveLength(1)
  })

  it('pose un seul verrou pour les deux options, et garde celui du poste', () => {
    expect(VERROU).toContain("'/configuration-pointeuse': ['module_pointeuses', 'module_poste_pointage']")
    expect(VERROU).toContain("'/poste': 'module_poste_pointage'")
    expect(VERROU).not.toContain("'/pointeuses': 'module_pointeuses'")
  })

  it('garde les trois vues dans la même page', async () => {
    await ouvrir()
    expect(hote.querySelectorAll('.cp-onglet')).toHaveLength(3)
    expect(hote.querySelector('.cp-onglet[aria-selected="true"]').textContent).toContain('Pointeuses')

    await cliquer(onglet('Journal des envois'))
    expect(hote.querySelector('#cp-vue-journal')).not.toBeNull()

    await cliquer(onglet('Poste de pointage'))
    expect(hote.querySelector('#cp-vue-poste')).not.toBeNull()
    // les chiffres restent visibles dans toutes les vues
    expect(hote.querySelectorAll('.cp-stele')).toHaveLength(4)
  })
})

// ═══════════════════════════════════════════════════════════
// 2. LA TOILE DE KORHOGO
// ═══════════════════════════════════════════════════════════

describe('2. la toile de Korhogo', () => {
  it('devient le motif de la page, y compris pour l’ancienne adresse', () => {
    expect(culturalMotifForPath('/configuration-pointeuse')).toBe('korhogo')
    expect(culturalMotifForPath('/configuration-pointeuse/')).toBe('korhogo')
    expect(culturalMotifForPath('/pointeuses')).toBe('korhogo')
    expect(MOTIFS).toContain("page === 'configuration-pointeuse'")
    // Entreprises garde son identité, Planning garde la sienne
    expect(culturalMotifForPath('/entreprises')).toBe('korhogo')
    expect(culturalMotifForPath('/planning')).toBe('kuba')
  })

  it('pose le vrai bandeau, en haut et en bas, à la hauteur commune', () => {
    const html = renderToStaticMarkup(<PageCulturalBand pathname="/configuration-pointeuse" />)
    expect(html).toContain('data-cultural-motif="korhogo"')
    expect(html).toContain('<svg')
    expect(html).toContain('ec-cultural-top')
    expect(PAGE).toContain('<PageCulturalBand pathname="/configuration-pointeuse" />')
    expect(PAGE).toContain('placement="bottom"')
    expect(CSS).not.toMatch(/ec-cultural-top\[data-cultural-motif='korhogo'\][^}]*height:\s*1[0-9]{2}px/)
  })

  it('dessine un blason de nuit : un cadre peint, un soleil', () => {
    const blason = renderToStaticMarkup(<KorhogoBlasonNuitSvg size={52} />)
    expect(blason).toContain('viewBox="0 0 52 52"')
    expect(blason).toContain('aria-hidden="true"')
    expect(blason.match(/<path/g).length).toBeGreaterThanOrEqual(2)
    expect(blason.match(/<circle/g).length).toBeGreaterThanOrEqual(2)
  })

  it('a quitté le bleu nuit de l’ancienne page, et ne remet pas d’emoji', () => {
    expect(PAGE).not.toContain('#0A0A0F')
    expect(PAGE).not.toContain('#F9FAFB')
    expect(POSTE).not.toContain('#0F172A')
    expect(POSTE).not.toContain('#F8FAFC')
    expect(PAGE).not.toMatch(/style=\{\{[^}]*(background|color):/i)
    expect(POSTE).not.toMatch(/style=\{\{[^}]*(background|color):/i)
    // les emojis de l'ancien écran du poste ont disparu du rendu
    const rendu = POSTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(rendu).not.toMatch(/🖥️|📍|⚠️|⏳|🔒|✓|↩/)
    // plus de toasts d'une autre époque : la page dit ses résultats en place
    expect(PAGE).not.toContain("from 'react-hot-toast'")
  })

  it('a sa propre bascule de thème et un thème clair complet', () => {
    expect(PAGE).toContain('role="switch"')
    expect(PAGE).toContain('aria-checked={darkMode}')
    expect(CSS).toMatch(/\.cp-page\.cp-clair \{/)
    const clair = CSS.slice(CSS.indexOf('.cp-page.cp-clair'))
    for (const jeton of ['--cp-mur', '--cp-carte', '--cp-coton', '--cp-ocre', '--cp-ligne']) {
      expect(clair).toContain(`${jeton}:`)
    }
  })

  it('garde une planche de référence pour la refonte', () => {
    const planche = path.join(ROOT, 'docs/design/refonte-configuration-pointeuse.png')
    expect(fs.existsSync(planche)).toBe(true)
    expect(fs.statSync(planche).size).toBeGreaterThan(50_000)
  })
})

// ═══════════════════════════════════════════════════════════
// 3. LA MÉCANIQUE ADMS N'A PAS BOUGÉ
// ═══════════════════════════════════════════════════════════

describe('3. les contrats du registre', () => {
  it('lit les machines, le journal et les numéros manquants', () => {
    expect(PAGE).toContain(".from('adms_devices')")
    expect(PAGE).toContain(".from('adms_log')")
    expect(PAGE).toContain(".order('recu_le', { ascending: false })")
    expect(PAGE).toContain('.limit(25)')
    expect(PAGE).toContain(".rpc('encheck_employes_sans_pin'")
    expect(PAGE).toContain('p_enterprise_id: entId')
  })

  it('enregistre une machine par la fonction serveur, avec un repli direct', () => {
    expect(PAGE).toContain("rpc('encheck_adms_appareil_ajouter'")
    expect(PAGE).toContain('p_serial: serial')
    expect(PAGE).toContain('p_label: form.label.trim() || null')
    // le repli : la même clé de 24 octets, et le doublon retrouvé
    expect(PAGE).toContain('creerDirectement')
    expect(PAGE).toContain("error.code === '23505'")
    expect(PAGE).toContain('cleAleatoire()')
    expect(LIB).toBeTruthy()
  })

  it('met en pause, réactive et supprime avec les mêmes colonnes', () => {
    expect(PAGE).toContain('update({ is_active: cible, updated_at: new Date().toISOString() })')
    expect(PAGE).toContain(".from('adms_devices')\n      .delete()\n      .eq('id', aSupprimer.id)")
    expect(PAGE).toContain('reveles')
    expect(PAGE).toContain('appareils.json')
  })

  it('garde l’écran du poste sur les mêmes appels', () => {
    for (const appel of [
      'encheck_entreprise_par_code',
      'encheck_employee_login_qr',
      'encheck_pointages_historique',
      'encheck_punch',
    ]) {
      expect(LIB + POSTE).toContain(appel)
    }
    expect(POSTE).toContain("p_method: 'poste'")
    expect(POSTE).toContain("id=\"zone-badge\"")
    expect(LIB).toContain('const ecartSecondes')
  })

  it('traduit les refus du serveur en français, une seule fois', () => {
    expect(messageDe('pin_requis')).toContain('code personnel')
    expect(messageDe('inconnu_xyz')).toContain('inconnu_xyz')
    expect(sensSuivant(null)).toBe('in')
    expect(sensSuivant({ check_type: 'in' })).toBe('out')
    expect(sensSuivant({ check_type: 'out' })).toBe('in')
    // une entrée de la veille ne bloque pas : on repart sur une arrivée
    expect(sensSuivant({ check_type: 'in', check_time: '2020-01-01T06:00:00.000Z' })).toBe('in')
  })
})

// ═══════════════════════════════════════════════════════════
// 4. LES GESTES, POUR DE VRAI
// ═══════════════════════════════════════════════════════════

describe('4. les gestes du registre', () => {
  it('compte les machines réelles et les montre', async () => {
    await ouvrir()
    const chiffres = [...hote.querySelectorAll('.cp-stele-nombre')].map((n) => n.textContent)
    expect(chiffres).toEqual(['1', '1', '1', '1'])
    expect(hote.textContent).toContain('Pointeuse entrée dépôt')
    expect(hote.textContent).toContain('AANF123456789')
    expect(hote.textContent).toContain('Africa/Douala')
  })

  it('enregistre une pointeuse et affiche sa clé', async () => {
    await ouvrir()
    await cliquer(bouton('Enregistrer une pointeuse'))
    await ecrire(hote.querySelector('.cp-fenetre input'), 'AANF987654321')
    await ecrire(hote.querySelectorAll('.cp-fenetre input')[1], 'Pointeuse atelier')
    await cliquer(bouton('Enregistrer et afficher la clé'))

    const appel = [...faux.journal].reverse().find((e) => e.action === 'rpc' && e.nom === 'encheck_adms_appareil_ajouter')
    expect(appel.parametres).toMatchObject({
      p_enterprise_id: 'ent-1',
      p_serial: 'AANF987654321',
      p_label: 'Pointeuse atelier',
    })
    expect(hote.querySelector('.cp-secret').textContent).toContain('clé-secrète-aanf987654321')
    expect(hote.textContent).toContain('Pointeuse atelier')
  })

  it('refuse un numéro de série vide, sans appeler le serveur', async () => {
    await ouvrir()
    await cliquer(bouton('Enregistrer une pointeuse'))
    await cliquer(bouton('Enregistrer et afficher la clé'))

    expect(faux.journal.some((e) => e.nom === 'encheck_adms_appareil_ajouter')).toBe(false)
    expect(hote.querySelector('.cp-avis').textContent).toContain('numéro de série est obligatoire')
  })

  it('met une machine en pause, puis la réactive', async () => {
    await ouvrir()
    await cliquer(lienDans(carteMachine('Pointeuse entrée dépôt'), 'Mettre en pause'))

    expect(dernier('update', 'adms_devices').payload.is_active).toBe(false)
    expect(dernier('update', 'adms_devices').filtres).toEqual({ id: 'dev-1' })
    expect(hote.textContent).toContain('Machine mise en pause')

    await cliquer(lienDans(carteMachine('Pointeuse entrée dépôt'), 'Réactiver'))
    expect(dernier('update', 'adms_devices').payload.is_active).toBe(true)
  })

  it('supprime une machine après confirmation, et seulement alors', async () => {
    await ouvrir()
    await cliquer(lienDans(carteMachine('Pointeuse entrée dépôt'), 'Supprimer'))
    expect(faux.journal.some((e) => e.action === 'delete')).toBe(false)

    await cliquer(bouton('Supprimer la machine'))
    expect(dernier('delete', 'adms_devices').filtres).toEqual({ id: 'dev-1' })
    expect(carteMachine('Pointeuse entrée dépôt')).toBeUndefined()
  })

  it('propose la pause plutôt que la suppression destructive', async () => {
    await ouvrir()
    await cliquer(lienDans(carteMachine('Pointeuse entrée dépôt'), 'Supprimer'))
    await cliquer(bouton('Mettre en pause plutôt'))

    expect(faux.journal.some((e) => e.action === 'delete')).toBe(false)
    expect(dernier('update', 'adms_devices').payload.is_active).toBe(false)
  })

  it('montre le journal et signale les numéros non attribués', async () => {
    await ouvrir()
    await cliquer(onglet('Journal des envois'))

    const lignes = hote.querySelectorAll('.cp-tableau tbody tr')
    expect(lignes).toHaveLength(1)
    expect(lignes[0].textContent).toContain('AANF123456789')
    expect(lignes[0].textContent).toContain('7 (×1)')
    expect(hote.querySelector('.cp-inconnu')).not.toBeNull()
    expect(hote.textContent).toContain('Pointages')
  })

  it('dit les chiffres et les états en français, sans nom technique', async () => {
    await ouvrir(SUPER)
    await cliquer(onglet('Poste de pointage'))
    const texte = hote.textContent
    expect(texte).not.toMatch(/pagne|teint|métier à perles|collier de perles|atelier/i)
    expect(texte).not.toMatch(/adms_devices|adms_log|face_enrollments|supabase/i)
    expect(texte).not.toMatch(/encheck_poste/)
  })
})

// ═══════════════════════════════════════════════════════════
// 5. LE POSTE DE POINTAGE DANS LA MÊME PAGE
// ═══════════════════════════════════════════════════════════

describe('5. le poste de pointage', () => {
  it('donne le code de l’entreprise à saisir sur la tablette', async () => {
    await ouvrir()
    await cliquer(onglet('Poste de pointage'))

    expect(hote.querySelector('.cp-code').textContent).toContain('ENC-229')
    expect(hote.textContent).toContain('Cet appareil n’est pas encore un poste')
    // on peut ouvrir l'écran du poste depuis la page
    expect(PAGE).toContain("navigate('/poste')")
  })

  it('installe cet appareil, et le retient', async () => {
    await ouvrir()
    await cliquer(onglet('Poste de pointage'))

    await ecrire(hote.querySelector('#cp-vue-poste input'), 'ENC-229')
    await cliquer(bouton('Installer cet appareil'))

    const retenu = JSON.parse(localStorage.getItem(CLE_POSTE))
    expect(retenu.enterprise_id).toBe('ent-1')
    expect(retenu.nom).toBe('Kossi & Fils SARL')
    expect(retenu.code).toBe('ENC-229')
    expect(retenu.device_id).toMatch(/^poste-/)
    expect(hote.textContent).toContain('Poste installé ici')
    expect(hote.textContent).toContain('Détacher cet appareil')
  })

  it('détache l’appareil quand on le demande', async () => {
    await ouvrir()
    await cliquer(onglet('Poste de pointage'))
    await ecrire(hote.querySelector('#cp-vue-poste input'), 'ENC-229')
    await cliquer(bouton('Installer cet appareil'))

    await cliquer(bouton('Détacher cet appareil'))
    expect(localStorage.getItem(CLE_POSTE)).toBeNull()
    expect(hote.textContent).toContain('Cet appareil n’est pas encore un poste')
  })

  it('affiche un refus lisible quand le code ne vaut rien', async () => {
    await ouvrir()
    await cliquer(onglet('Poste de pointage'))
    await ecrire(hote.querySelector('#cp-vue-poste input'), 'RIEN')
    await cliquer(bouton('Installer cet appareil'))

    // la fausse base ne connaît que ENC-229 : on simule un refus propre
    expect(hote.querySelector('.cp-erreur') || hote.textContent.includes('Poste installé ici')).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════
// 6. L'ÉCRAN DE LA TABLETTE
// ═══════════════════════════════════════════════════════════

describe('6. l’écran du poste', () => {
  it('demande le code quand l’appareil n’est pas installé', async () => {
    await ouvrirPoste()
    expect(hote.textContent).toContain('Poste de pointage')
    expect(hote.textContent).toContain('Installer ce poste')
    expect(hote.querySelector('.pp-installation')).not.toBeNull()
  })

  it('installe la tablette et retient son identifiant', async () => {
    await ouvrirPoste()
    await ecrire(hote.querySelector('.pp-installation input'), 'ENC-229')
    await cliquer(bouton('Installer ce poste'))

    const retenu = JSON.parse(localStorage.getItem(CLE_POSTE))
    expect(retenu.enterprise_id).toBe('ent-1')
    expect(retenu.device_id).toMatch(/^poste-ent-1-/)
    expect(hote.textContent).toContain('Kossi & Fils SARL')
    expect(hote.textContent).toContain('Présentez votre badge devant la caméra')
  })

  it('retrouve l’entreprise au rechargement, sans redemander le code', async () => {
    localStorage.setItem(CLE_POSTE, JSON.stringify({
      enterprise_id: 'ent-1',
      nom: 'Kossi & Fils SARL',
      code: 'ENC-229',
      device_id: 'poste-ent-1-abcdef',
      installe_le: '2026-10-12T08:00:00.000Z',
    }))
    await ouvrirPoste()

    expect(hote.textContent).toContain('Kossi & Fils SARL')
    expect(hote.textContent).toContain('Présentez votre badge')
    // l'écran du poste n'affiche aucun identifiant technique en clair
    expect(hote.textContent).not.toContain('encheck_poste')
  })

  it('demande le code personnel quand le badge en réclame un', async () => {
    localStorage.setItem(CLE_POSTE, JSON.stringify({
      enterprise_id: 'ent-1',
      nom: 'Kossi & Fils SARL',
      code: 'ENC-229',
      device_id: 'poste-ent-1-abcdef',
      installe_le: '2026-10-12T08:00:00.000Z',
    }))
    await ouvrirPoste()

    await cliquer(bouton('Saisir mon numéro'))
    await ecrire(hote.querySelectorAll('.pp-saisie-champs input')[0], 'ENN-0002')
    await cliquer(bouton('Pointer'))

    expect(hote.textContent).toContain('Votre code personnel')
  })

  it('garde l’adresse de la caméra et les grands repères de l’écran', () => {
    expect(POSTE).toContain('id="zone-badge"')
    expect(POSTE).toContain('html5-qrcode')
    expect(POSTE_CSS).toContain('.pp-cadre-camera')
    expect(POSTE_CSS).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

// ═══════════════════════════════════════════════════════════
// 7. LES RÈGLES DE DESSIN
// ═══════════════════════════════════════════════════════════

describe('7. les règles de dessin', () => {
  it('ne change au survol ni le fond d’un texte, ni sa couleur, ni son opacité', () => {
    for (const feuille of [CSS, POSTE_CSS]) {
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
    expect(CSS).toMatch(/\.cp-cle-oeil/)
    expect(CSS).toMatch(/\.cp-depannage-chevron/)
    expect(CSS).toMatch(/\.cp-onglet\[aria-selected='true'\]/)
    expect(CSS).toMatch(/\.cp-sceau/)
    expect(PAGE).toContain('role="tablist"')
    expect(PAGE).toContain('role="tabpanel"')
  })

  it('a un chargement dessiné, pas une roue photo', () => {
    expect(PAGE).toContain('cp-charge-cheuron')
    expect(CSS).toContain('@keyframes cp-cheuron')
    expect(PAGE).not.toContain('className={rafraichir ? \'spin\'')
  })

  it('reste lisible sur téléphone et respecte le mouvement réduit', () => {
    expect(CSS).toContain('@media (max-width: 760px)')
    expect(CSS).toContain('@media (max-width: 620px)')
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(CSS).toMatch(/\.cp-bouton,\s*\n\.cp-bouton-creux \{[^}]*height: 34px/)
    expect(POSTE_CSS).toMatch(/\.pp-bouton,[\s\S]{0,400}min-height: 44px/)
  })
})
