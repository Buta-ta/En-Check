// ═══════════════════════════════════════════════════════════
// LES COURRIELS — le registre repris de zéro
//
// Ce que ces tests défendent :
//
//   ① la vue n'embarque plus l'ancien moniteur : elle a son propre
//     dessin, sa lisière de santé et son registre de sept compteurs ;
//   ② les chiffres disent ce qu'ils comptent (tentatives chargées,
//     statuts réels, `cree_le` et non `created_at`) ;
//   ③ le journal se lit : statut, source, adresses, erreurs, détail
//     par destinataire, trace technique ;
//   ④ les gestes marchent : filtrer sans rappeler le serveur, chercher,
//     voir les archivés, exporter, relancer, corriger, archiver ;
//   ⑤ un envoi réel ne part jamais sans aperçu, sans saisie de
//     « ENVOYER », et son résultat est dit — succès comme échec ;
//   ⑥ le dessin tient : aucun style en ligne, aucun emoji, aucun
//     `window.confirm`, et le survol ne change ni fond ni couleur.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

import CourrielsSysteme from '../../components/CourrielsSysteme'
import {
  MOT_ENVOI, STATUTS_COURRIEL, adressesDe, adressesRelance, adressesValides,
  analyseDe, brouillonRelance, brouillonVide, compteCourriels, confirmationEnvoiValide,
  construireCSV, dateCourriel, dureeCourriel, filtrerCourriels, lignesDe, metaSource,
  metaStatut, peutCorriger, peutRelancer, requeteCourriel, resumeBrouillon, resumeCourriels,
  resultatsDe, santeCourriels, sourceDe, statutCourriel,
} from '../../lib/courriels'

// ── la fausse base ─────────────────────────────────────────
const { faux } = vi.hoisted(() => {
  const journal = []
  const tables = { encheck_email_logs: [] }
  const mises = []
  const fonction = { appels: [], reponses: [] }

  const executer = (etat) => {
    if (etat.table === 'encheck_email_logs') {
      if (etat.action === 'update') {
        mises.push(etat.payload)
        return { data: null, error: null }
      }
      const lignes = tables.encheck_email_logs.slice(etat.debut || 0, (etat.fin ?? 10 ** 6) + 1)
      journal.push({ table: etat.table, action: 'select', debut: etat.debut, fin: etat.fin })
      return { data: lignes.map((ligne) => ({ ...ligne })), error: null }
    }
    if (etat.table === 'enterprises') return { data: [{ id: 'ent-1', name: 'Sèmè City' }], error: null }
    if (etat.table === 'admins') {
      return { data: [{ id: 'adm-1', first_name: 'Rosine', last_name: 'Adjovi', email: 'rosine@encheck.bj' }], error: null }
    }
    return { data: [], error: null }
  }

  const fabriquer = (table) => {
    const etat = { table, action: 'select', payload: null, debut: 0, fin: null }
    const chaine = {
      select: () => chaine,
      order: () => chaine,
      range: (debut, fin) => { etat.debut = debut; etat.fin = fin; return chaine },
      update: (payload) => { etat.action = 'update'; etat.payload = payload; return chaine },
      eq: () => chaine,
      then: (resoudre, rejeter) => Promise.resolve().then(() => executer(etat)).then(resoudre, rejeter),
    }
    return chaine
  }

  return {
    faux: {
      journal,
      tables,
      mises,
      fonction,
      from: fabriquer,
      vider() {
        journal.length = 0
        mises.length = 0
        fonction.appels.length = 0
        fonction.reponses.length = 0
        tables.encheck_email_logs = []
      },
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => faux.from(table),
    auth: { getUser: async () => ({ data: { user: { email: 'butacode08@gmail.com' } } }) },
    functions: {
      invoke: async (nom, options = {}) => {
        faux.fonction.appels.push({ nom, options })
        const suivante = faux.fonction.reponses.shift()
        if (suivante) return suivante
        if (options.method === 'GET') {
          return {
            data: {
              version: 'email-monitor-v1',
              configuration: {
                sender_configured: true,
                provider_configured: true,
                origin_allowed: true,
                trigger_secret_configured: false,
              },
            },
            error: null,
          }
        }
        if (options.body?.preview_only) {
          return { data: { preview: true, destinataires: ['butacode08@gmail.com'], note: '', analyse_destinataires: [] }, error: null }
        }
        return { data: { ok: true, envoyes: 1, echecs: 0, fournisseur: 'brevo', journalise: true }, error: null }
      },
    },
  },
}))

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const COMPOSANT = lire('src/components/CourrielsSysteme.jsx')
const CSS = lire('src/components/CourrielsSysteme.css')
const PAGE = lire('src/pages/MessagesSysteme.jsx')

// ── les données ────────────────────────────────────────────
const ilYA = (jours, heures = 9) => {
  const date = new Date()
  date.setDate(date.getDate() - jours)
  date.setHours(heures, 12, 0, 0)
  return date.toISOString()
}

const echec = {
  id: 'mail-1',
  sujet: '[En-Check] Votre entreprise — Test d’envoi En-Check',
  destinataires: 'butacode08@gmail.com',
  destinataires_json: ['butacode08@gmail.com'],
  resultats_destinataires: [{ email: 'butacode08@gmail.com', statut: 'failed', erreur: '401 unauthorized' }],
  envoyer: 0,
  envoyes: 0,
  echecs: 1,
  nb_alertes: 1,
  statut: 'failed',
  source: 'tableau_de_bord',
  erreur: 'Brevo 401 : adresse IP non reconnue',
  entreprise_id: null,
  fournisseur: 'brevo',
  duree_ms: 812,
  cree_le: ilYA(0, 23),
  archived_at: null,
  payload: {
    sujet: '[En-Check] Votre entreprise',
    lien: 'https://encheck.app/pointages',
    lignes: [{ titre: 'Test d’envoi', detail: 'Vérification de la réception.', gravite: 'info' }],
    destinataires: ['butacode08@gmail.com'],
  },
}

const accepte = {
  id: 'mail-2',
  sujet: 'Rappel : pauses déjeuner',
  destinataires_json: ['alice@encheck.bj', 'serge@encheck.bj'],
  resultats_destinataires: [],
  envoyes: 2,
  echecs: 0,
  nb_alertes: 1,
  statut: 'accepted',
  source: 'base',
  erreur: null,
  entreprise_id: 'ent-1',
  fournisseur: 'smtp',
  duree_ms: 430,
  cree_le: ilYA(1, 8),
  archived_at: null,
  payload: { lignes: [] },
}

const partiel = {
  id: 'mail-3',
  sujet: 'Récapitulatif de paie — octobre',
  destinataires_json: ['a@x.bj', 'b@x.bj', 'c@x.bj'],
  resultats_destinataires: [
    { email: 'a@x.bj', statut: 'accepted' },
    { email: 'b@x.bj', statut: 'accepted' },
    { email: 'c@x.bj', statut: 'failed', erreur: 'boîte pleine' },
  ],
  envoyes: 2,
  echecs: 1,
  nb_alertes: 0,
  statut: 'partial',
  source: 'relance',
  erreur: null,
  entreprise_id: 'ent-1',
  fournisseur: 'brevo',
  duree_ms: 1200,
  cree_le: ilYA(2, 17),
  archived_at: null,
  payload: { lignes: [{ titre: 'Paie', detail: 'Bulletins disponibles.' }] },
}

const archive = {
  id: 'mail-4',
  sujet: 'Ancien test de routage',
  destinataires_json: ['vieux@encheck.bj'],
  envoyes: 1,
  echecs: 0,
  nb_alertes: 0,
  statut: 'accepted',
  source: 'tableau_de_bord',
  cree_le: ilYA(30, 10),
  archived_at: ilYA(29, 10),
  payload: { lignes: [] },
}

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  faux.vider()
  faux.tables.encheck_email_logs = [echec, accepte, partiel, archive]
  URL.createObjectURL = vi.fn(() => 'blob:courriels')
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
  await act(async () => { await new Promise((resoudre) => setTimeout(resoudre, 0)) })
}

async function ouvrir() {
  await act(async () => {
    racine.render(<CourrielsSysteme onJournal={() => {}} />)
  })
  await laisser()
  await laisser()
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((item) => item.textContent.includes(texte))

async function cliquer(element) {
  expect(element, 'le contrôle à cliquer doit exister').toBeTruthy()
  await act(async () => element.click())
  await laisser()
}

function saisir(champ, valeur) {
  const prototype = champ.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement
    : champ.tagName === 'SELECT'
      ? window.HTMLSelectElement
      : window.HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value').set
  setter.call(champ, valeur)
  champ.dispatchEvent(new Event(champ.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}

async function ecrire(champ, valeur) {
  expect(champ).toBeTruthy()
  await act(async () => saisir(champ, valeur))
  await laisser()
}

// ═══════════════════════════════════════════════════════════
// 1. LA BIBLIOTHÈQUE
// ═══════════════════════════════════════════════════════════

describe('1. ce que dit une ligne du journal', () => {
  it('lit le statut, la source et leur libellé', () => {
    expect(statutCourriel({ statut: 'blocked' })).toBe('blocked')
    expect(statutCourriel({ envoyes: 2, echecs: 1 })).toBe('partial')
    expect(statutCourriel({ envoyes: 2 })).toBe('accepted')
    expect(statutCourriel({})).toBe('failed')
    expect(metaStatut('not_sent').court).toBe('Non envoyé')
    expect(metaStatut('inconnu').cle).toBe('failed')
    expect(sourceDe({ source: 'relance' })).toBe('relance')
    expect(sourceDe({ source: 'ancienne' })).toBe('tableau_de_bord')
    expect(metaSource('base').court).toBe('Automatique')
  })

  it('rassemble les adresses sans doublon', () => {
    expect(adressesDe({ destinataires_json: ['A@x.bj', 'a@x.bj', ' b@x.bj '] })).toEqual(['a@x.bj', 'b@x.bj'])
    expect(adressesDe({ destinataires: 'a@x.bj, b@x.bj' })).toEqual(['a@x.bj', 'b@x.bj'])
    expect(adressesDe({ payload: { destinataires: ['c@x.bj'] } })).toEqual(['c@x.bj'])
    expect(adressesDe({})).toEqual([])
  })

  it('lit les résultats, les lignes et le routage', () => {
    expect(resultatsDe(partiel)).toHaveLength(3)
    expect(resultatsDe({ payload: { resultats_destinataires: [{ email: 'z@x.bj' }] } })).toHaveLength(1)
    expect(lignesDe(echec)).toHaveLength(1)
    expect(lignesDe({})).toEqual([])
    expect(analyseDe({ payload: { analyse_destinataires: [{ inclus: true }] } })).toHaveLength(1)
  })

  it('écrit les dates et les durées sans mentir', () => {
    expect(dateCourriel(null)).toBe('Date inconnue')
    expect(dateCourriel('pas une date')).toBe('Date inconnue')
    expect(dateCourriel('2026-10-14T23:07:00Z')).toMatch(/2026/)
    expect(dureeCourriel(812)).toBe('812 ms')
    expect(dureeCourriel(1200)).toBe('1,2 s')
    expect(dureeCourriel(null)).toBe('non mesurée')
  })
})

describe('2. les chiffres et les filtres', () => {
  it('compte les sept familles, aujourd’hui compris, sur `cree_le`', () => {
    const compte = compteCourriels([echec, accepte, partiel, { ...archive }])
    expect(compte.total).toBe(4)
    expect(compte.accepted).toBe(2)
    expect(compte.failed).toBe(1)
    expect(compte.partial).toBe(1)
    expect(compte.today).toBe(1)
    const resume = resumeCourriels([echec, accepte, partiel])
    expect(resume).toEqual({ tentatives: 3, acceptees: 1, echecs: 1, partiels: 1, aujourdhui: 1 })
  })

  it('filtre par statut, source, recherche et archives', () => {
    const logs = [echec, accepte, partiel, archive]
    expect(filtrerCourriels(logs)).toHaveLength(3)
    expect(filtrerCourriels(logs, { archives: true })).toHaveLength(1)
    expect(filtrerCourriels(logs, { statut: 'failed' })).toHaveLength(1)
    expect(filtrerCourriels(logs, { source: 'relance' })).toHaveLength(1)
    expect(filtrerCourriels(logs, { recherche: 'pauses' })).toHaveLength(1)
    expect(filtrerCourriels(logs, { recherche: 'IP non reconnue' })).toHaveLength(1)
    expect(filtrerCourriels(logs, { recherche: 'sèmè' })).toHaveLength(0)
    expect(filtrerCourriels(
      [{ id: 'n-1', sujet: 'Rappel', archived_at: null, enterprise_id: 'ent-1' }],
      { recherche: 'sèmè', nomsEntreprises: { 'ent-1': 'Sèmè City' } },
    )).toHaveLength(1)
  })

  it('sait ce qui peut être relancé ou corrigé', () => {
    expect(peutRelancer(echec)).toBe(true)
    expect(peutRelancer(accepte)).toBe(false)
    expect(peutRelancer({ ...echec, envoyes: 1 })).toBe(false)
    expect(peutRelancer({ ...echec, payload: {} })).toBe(false)
    expect(peutCorriger(partiel)).toBe(true)
    expect(peutCorriger(accepte)).toBe(false)
    expect(adressesRelance(partiel)).toEqual(['c@x.bj'])
    expect(adressesRelance(accepte)).toEqual(['alice@encheck.bj', 'serge@encheck.bj'])
  })
})

describe('3. la santé de la fonction', () => {
  it('distingue vérification, prêt, partiel et ancienne version', () => {
    expect(santeCourriels({ etat: 'verification' }).ton).toBe('attente')
    expect(santeCourriels({ etat: 'verification' }).criteres).toEqual([])

    const pret = santeCourriels({
      etat: 'prete',
      configuration: {
        sender_configured: true, provider_configured: true,
        origin_allowed: true, trigger_secret_configured: true,
      },
    })
    expect(pret.ton).toBe('vert')
    expect(pret.verdict).toBe('Fonction e-mail connectée.')
    expect(pret.criteres).toHaveLength(4)
    expect(pret.manquants).toEqual([])
    expect(pret.peutEnvoyer).toBe(true)
    expect(pret.envoisAuto).toBe(true)

    const sansSecret = santeCourriels({
      etat: 'prete',
      configuration: {
        sender_configured: true, provider_configured: true,
        origin_allowed: true, trigger_secret_configured: false,
      },
    })
    expect(sansSecret.ton).toBe('attente')
    expect(sansSecret.verdict).toBe('Envois automatiques suspendus.')
    expect(sansSecret.manquants).toEqual(['Secret SQL'])
    expect(sansSecret.peutEnvoyer).toBe(true)
    expect(sansSecret.envoisAuto).toBe(false)

    const ancienne = santeCourriels({ etat: 'ancienne', message: 'Ancienne version.' })
    expect(ancienne.ton).toBe('alerte')
    expect(ancienne.peutEnvoyer).toBe(false)
  })
})

describe('4. le brouillon et l’envoi', () => {
  it('valide les adresses une par une', () => {
    expect(adressesValides('a@x.bj, b@x.bj, pas-une-adresse')).toEqual(['a@x.bj', 'b@x.bj'])
    expect(adressesValides('A@X.BJ\na@x.bj')).toEqual(['a@x.bj'])
    expect(adressesValides('')).toEqual([])
  })

  it('construit un brouillon vide et une relance', () => {
    const vide = brouillonVide({ adresse: 'moi@x.bj', origine: 'https://encheck.app' })
    expect(vide.mode).toBe('self')
    expect(vide.link).toBe('https://encheck.app/pointages')
    expect(vide.lines).toHaveLength(1)

    const relance = brouillonRelance(partiel, 'https://encheck.app')
    expect(relance.retryOf).toBe('mail-3')
    expect(relance.recipientsText).toBe('c@x.bj')
    expect(relance.lines[0].titre).toBe('Paie')
    expect(brouillonRelance({ ...accepte, payload: {} })).toBeNull()
  })

  it('résume qui sera touché, selon le mode', () => {
    const brouillon = brouillonVide({ adresse: 'moi@x.bj', origine: 'https://encheck.app' })
    expect(resumeBrouillon(brouillon, { adresseCourante: 'moi@x.bj' }).nombre).toBe(1)
    expect(resumeBrouillon({ ...brouillon, mode: 'manual', recipientsText: 'a@x.bj, b@x.bj' }).nombre).toBe(2)
    expect(resumeBrouillon({ ...brouillon, mode: 'admin', adminId: 'adm-1' }, { admins: [{ id: 'adm-1', email: 'r@x.bj' }] }).destinataires)
      .toEqual(['r@x.bj'])
    expect(resumeBrouillon({ ...brouillon, mode: 'enterprise', entrepriseId: 'ent-1' }).complet).toBe(true)
  })

  it('prépare le corps envoyé à la fonction', () => {
    const brouillon = brouillonVide({ adresse: 'moi@x.bj', origine: 'https://encheck.app' })
    const apercu = requeteCourriel(brouillon, { previewOnly: true, adresseCourante: 'moi@x.bj' })
    expect(apercu.preview_only).toBe(true)
    expect(apercu.destinataires).toEqual(['moi@x.bj'])
    expect(apercu.sujet).toBe('Test d’envoi En-Check')

    const entreprise = requeteCourriel({ ...brouillon, mode: 'enterprise', entrepriseId: 'ent-1' })
    expect(entreprise.enterprise_id).toBe('ent-1')
    expect(entreprise.destinataires).toBeUndefined()

    const relance = requeteCourriel(brouillonRelance(partiel), { adresseCourante: 'moi@x.bj' })
    expect(relance.retry_of).toBe('mail-3')
    expect(relance.destinataires).toEqual(['c@x.bj'])
  })

  it('exige le mot ENVOYER, rien d’autre', () => {
    expect(confirmationEnvoiValide(MOT_ENVOI)).toBe(true)
    expect(confirmationEnvoiValide(' envoyer ')).toBe(true)
    expect(confirmationEnvoiValide('envoi')).toBe(false)
    expect(MOT_ENVOI).toBe('ENVOYER')
  })

  it('écrit le journal en CSV', () => {
    const csv = construireCSV([echec], { 'ent-1': 'Sèmè City' })
    const lignes = csv.split('\n')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toContain('"Quand";"Sujet";"Statut";"Source"')
    expect(lignes[1]).toContain('"Échec fournisseur"')
    expect(lignes[1]).toContain('"Brevo 401 : adresse IP non reconnue"')
  })

  it('nomme les cinq statuts sans en oublier', () => {
    expect(STATUTS_COURRIEL.map((item) => item.cle))
      .toEqual(['accepted', 'failed', 'partial', 'not_sent', 'blocked'])
  })
})

// ═══════════════════════════════════════════════════════════
// 5. LA VUE
// ═══════════════════════════════════════════════════════════

describe('5. la lisière et le registre', () => {
  it('a remplacé le moniteur par son propre dessin', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/components/EmailDeliveryMonitor.jsx'))).toBe(false)
    expect(PAGE).toContain('<CourrielsSysteme onJournal={chargerCourriels} />')
    expect(PAGE).not.toContain('EmailDeliveryMonitor')
    expect(PAGE).toContain("select('statut, envoyes, echecs, cree_le, archived_at')")
    expect(PAGE).not.toContain("select('statut, envoyes, echecs, created_at')")
  })

  it('montre la santé, les quatre critères et le verdict', async () => {
    await ouvrir()
    expect(hote.querySelector('.ms-sante')).not.toBeNull()
    expect(hote.querySelectorAll('.ms-sante-criteres li')).toHaveLength(4)
    expect(hote.textContent).toContain('Expéditeur')
    expect(hote.textContent).toContain('Brevo / SMTP')
    expect(hote.textContent).toContain('Origine du site')
    expect(hote.textContent).toContain('Secret SQL')
    expect(hote.textContent).toContain('MANQUANT')
    expect(hote.textContent).toContain('Envois automatiques suspendus')
  })

  it('aligne sept compteurs sur un seul trait', async () => {
    await ouvrir()
    const cellules = hote.querySelectorAll('.ms-registre-cellule')
    expect(cellules).toHaveLength(7)
    expect(cellules[0].textContent).toContain('3')
    expect(cellules[0].textContent).toContain('tentatives')
    expect(cellules[1].textContent).toContain('1')
    expect(cellules[1].textContent).toContain('acceptés')
    expect(cellules[2].textContent).toContain('échecs')
    expect(hote.textContent).toContain('Les chiffres portent sur les 3 tentatives chargées')
    expect(hote.textContent).toContain('« Accepté » veut dire que le fournisseur a pris la demande')
  })

  it('ne montre ni emoji, ni nom de table, ni toast', async () => {
    await ouvrir()
    expect(hote.innerHTML).not.toMatch(/encheck_email_logs|cree_le|archived_at|preview_only/)
    expect(hote.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })
})

describe('6. le journal', () => {
  it('affiche statut, sujet, date, entreprise, source et compteurs', async () => {
    await ouvrir()
    const cartes = hote.querySelectorAll('.ms-courriel')
    expect(cartes).toHaveLength(3)
    expect(cartes[0].textContent).toContain('Échec')
    expect(cartes[0].textContent).toContain('Test d’envoi En-Check')
    expect(cartes[0].textContent).toContain('Sans entreprise')
    expect(cartes[0].textContent).toContain('Test / tableau de bord')
    expect(cartes[0].textContent).toContain('1 adresse')
    expect(cartes[0].textContent).toContain('0 accepté(s)')
    expect(cartes[0].textContent).toContain('1 échec(s)')
    expect(cartes[0].textContent).toContain('Brevo 401 : adresse IP non reconnue')
    expect(hote.textContent).toContain('Rappel : pauses déjeuner')
    expect(hote.textContent).toContain('Récapitulatif de paie — octobre')
    expect(hote.textContent).toContain('3 à l’écran')
  })

  it('filtre sans rappeler le serveur', async () => {
    await ouvrir()
    const avant = faux.journal.length
    const [statut] = hote.querySelectorAll('.ms-courriels-barre select')
    await ecrire(statut, 'partial')
    expect(hote.querySelectorAll('.ms-courriel')).toHaveLength(1)
    expect(hote.textContent).toContain('Récapitulatif de paie')
    expect(faux.journal.length).toBe(avant)
    await ecrire(statut, 'all')
    const [, source] = hote.querySelectorAll('.ms-courriels-barre select')
    await ecrire(source, 'base')
    expect(hote.querySelectorAll('.ms-courriel')).toHaveLength(1)
    await ecrire(source, 'all')
  })

  it('cherche dans les sujets et les erreurs', async () => {
    await ouvrir()
    const recherche = hote.querySelector('.ms-courriels-recherche input')
    await ecrire(recherche, 'pauses')
    expect(hote.querySelectorAll('.ms-courriel')).toHaveLength(1)
    await ecrire(recherche, 'IP non reconnue')
    expect(hote.querySelectorAll('.ms-courriel')).toHaveLength(1)
    await ecrire(recherche, 'zzz')
    expect(hote.querySelector('.ms-vide')).not.toBeNull()
    await ecrire(recherche, '')
  })

  it('ouvre les archivés puis revient aux actives', async () => {
    await ouvrir()
    await cliquer(bouton('Voir les archivés'))
    expect(hote.querySelectorAll('.ms-courriel')).toHaveLength(1)
    expect(hote.textContent).toContain('Ancien test de routage')
    await cliquer(bouton('Voir les actives'))
    expect(hote.querySelectorAll('.ms-courriel')).toHaveLength(3)
  })

  it('déplie le détail par adresse et la trace technique', async () => {
    await ouvrir()
    await cliquer([...hote.querySelectorAll('.ms-courriel')][0].querySelector('.ms-courriel-gestes button'))
    const detail = hote.querySelector('.ms-courriel-detail')
    expect(detail).not.toBeNull()
    expect(detail.textContent).toContain('butacode08@gmail.com')
    expect(detail.textContent).toContain('401 unauthorized')
    expect(detail.textContent).toContain('Fournisseur')
    expect(detail.textContent).toContain('brevo')
    expect(detail.textContent).toContain('812 ms')
    expect(detail.textContent).toContain('Contenu enregistré')
    expect(detail.textContent).toContain('Test d’envoi')
  })

  it('déplie le routage quand la tentative en garde la trace', async () => {
    faux.tables.encheck_email_logs = [{
      ...echec,
      payload: {
        ...echec.payload,
        analyse_destinataires: [
          { nom: 'Rosine Adjovi', email_auth: 'rosine@encheck.bj', inclus: true, raison: 'rattachée' },
          { nom: 'Serge Tossou', email_auth: null, email_fiche: 'serge@encheck.bj', inclus: false, raison: 'sans compte' },
        ],
      },
    }]
    await ouvrir()
    await cliquer(hote.querySelector('.ms-courriel-gestes button'))
    expect(hote.textContent).toContain('Contrôle du routage')
    expect(hote.textContent).toContain('Rosine Adjovi')
    expect(hote.textContent).toContain('sans compte')
  })

  it('exporte la vue filtrée en CSV', async () => {
    await ouvrir()
    const cree = URL.createObjectURL
    await cliquer(hote.querySelector('.ms-courriels-barre .ms-icon-bouton'))
    expect(cree).toHaveBeenCalledTimes(1)
    expect(hote.textContent).toContain('3 ligne(s) exportée(s) en CSV')
  })

  it('charge les pages plus anciennes', async () => {
    faux.tables.encheck_email_logs = Array.from({ length: 250 }, (_, index) => ({
      ...accepte,
      id: `page-1-${index}`,
      sujet: `Tentative ${index}`,
    }))
    await ouvrir()
    expect(hote.querySelector('.ms-courriels-plus')).not.toBeNull()
    faux.tables.encheck_email_logs = [...faux.tables.encheck_email_logs, { ...accepte, id: 'vieux-1', sujet: 'Très ancienne tentative' }]
    faux.journal.length = 0
    await cliquer(hote.querySelector('.ms-courriels-plus'))
    expect(faux.journal.some((entree) => entree.debut === 250)).toBe(true)
  })
})

describe('7. relancer, corriger, archiver', () => {
  it('demande confirmation avant de relancer, puis relance', async () => {
    await ouvrir()
    await cliquer([...hote.querySelectorAll('.ms-courriel')][0].querySelectorAll('.ms-courriel-gestes button')[1])
    const confirmation = hote.querySelector('.ms-courriel-confirme')
    expect(confirmation.textContent).toContain('Relancer vers 1 adresse(s)')
    expect(confirmation.textContent).toContain('nouvelle ligne datée')
    await cliquer([...confirmation.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Relancer'))

    const envoi = faux.fonction.appels.find((appel) => appel.options.body?.retry_of)
    expect(envoi).toBeTruthy()
    expect(envoi.options.body.destinataires).toEqual(['butacode08@gmail.com'])
    expect(hote.textContent).toContain('Relance acceptée par le fournisseur pour 1 destinataire(s)')
  })

  it('dit l’échec d’une relance au lieu de faire semblant', async () => {
    await ouvrir()
    faux.fonction.reponses.push({ data: null, error: { message: 'Fonction indisponible' } })
    await cliquer([...hote.querySelectorAll('.ms-courriel')][0].querySelectorAll('.ms-courriel-gestes button')[1])
    await cliquer(hote.querySelector('.ms-courriel-confirme .ms-bouton'))
    expect(hote.textContent).toContain('Fonction indisponible')
  })

  it('ouvre le composeur déjà rempli pour corriger un partiel', async () => {
    await ouvrir()
    const carte = [...hote.querySelectorAll('.ms-courriel')][2]
    await cliquer([...carte.querySelectorAll('.ms-courriel-gestes button')].find((item) => item.textContent.includes('Corriger')))
    const fenetre = hote.querySelector('.ms-fenetre[data-taille="large"]')
    expect(fenetre).not.toBeNull()
    expect(fenetre.textContent).toContain('Corriger et relancer l’e-mail')
    expect(fenetre.querySelector('textarea').value).toBe('c@x.bj')
  })

  it('archive après confirmation, puis restaure', async () => {
    await ouvrir()
    const carte = [...hote.querySelectorAll('.ms-courriel')][1]
    await cliquer([...carte.querySelectorAll('.ms-courriel-gestes button')].find((item) => item.textContent.includes('Archiver')))
    expect(hote.querySelector('.ms-courriel-confirme').textContent).toContain('restera conservée')
    await cliquer(hote.querySelector('.ms-courriel-confirme .ms-bouton'))
    expect(faux.mises[0]).toHaveProperty('archived_at')
    expect(hote.textContent).toContain('Entrée archivée')
  })

  it('ne lance jamais window.confirm', async () => {
    const confirme = vi.spyOn(window, 'confirm')
    await ouvrir()
    expect(confirme).not.toHaveBeenCalled()
  })
})

describe('8. le composeur', () => {
  it('laisse le bouton fermé quand la santé manque', async () => {
    faux.fonction.reponses.push({ data: null, error: { message: 'Fonction absente' } })
    await ouvrir()
    expect(bouton('Tester / envoyer').disabled).toBe(true)
    expect(hote.textContent).toContain('ne répond pas comme prévu')
  })

  it('exige l’aperçu puis le mot ENVOYER', async () => {
    await ouvrir()
    await cliquer(bouton('Tester / envoyer'))
    expect(hote.querySelector('.ms-fenetre[data-taille="large"]')).not.toBeNull()
    const envoyer = bouton('Envoyer réellement')
    expect(envoyer.disabled).toBe(true)

    await cliquer(bouton('Voir les destinataires'))
    expect(hote.querySelector('.ms-puces').textContent).toContain('butacode08@gmail.com')
    expect(bouton('Envoyer réellement').disabled).toBe(false)

    await cliquer(bouton('Envoyer réellement'))
    const confirmation = hote.querySelector('.ms-confirmation-envoi')
    expect(confirmation.textContent).toContain('1 destinataire(s) réels')
    const confirmer = [...confirmation.querySelectorAll('button')].find((item) => item.textContent.includes('Confirmer l’envoi'))
    expect(confirmer.disabled).toBe(true)
    await ecrire(confirmation.querySelector('input'), 'ENVOYER')
    expect([...hote.querySelectorAll('.ms-confirmation-envoi button')]
      .find((item) => item.textContent.includes('Confirmer l’envoi')).disabled).toBe(false)
  })

  it('envoie pour de vrai et dit ce que le fournisseur a accepté', async () => {
    faux.fonction.reponses.push({ data: { version: 'email-monitor-v1', configuration: {
      sender_configured: true, provider_configured: true, origin_allowed: true, trigger_secret_configured: true,
    } }, error: null })
    await ouvrir()
    await cliquer(bouton('Tester / envoyer'))
    await cliquer(bouton('Voir les destinataires'))
    await cliquer(bouton('Envoyer réellement'))
    await ecrire(hote.querySelector('.ms-confirmation-envoi input'), 'ENVOYER')
    await cliquer([...hote.querySelectorAll('.ms-confirmation-envoi button')]
      .find((item) => item.textContent.includes('Confirmer l’envoi')))

    const envoi = faux.fonction.appels.find((appel) => appel.options.body && !appel.options.body.preview_only && !appel.options.body.retry_of)
    expect(envoi.options.body.sujet).toBe('Test d’envoi En-Check')
    expect(envoi.options.body.destinataires).toEqual(['butacode08@gmail.com'])
    expect(hote.textContent).toContain('Brevo a accepté l’envoi à 1 destinataire(s)')
    expect(hote.querySelector('.ms-fenetre')).toBeNull()
  })

  it('dit l’échec d’un envoi, sans fermer le brouillon', async () => {
    await ouvrir()
    await cliquer(bouton('Tester / envoyer'))
    await cliquer(bouton('Voir les destinataires'))
    await cliquer(bouton('Envoyer réellement'))
    await ecrire(hote.querySelector('.ms-confirmation-envoi input'), 'ENVOYER')
    faux.fonction.reponses.push({ data: null, error: { message: '401 non autorisé' } })
    await cliquer([...hote.querySelectorAll('.ms-confirmation-envoi button')]
      .find((item) => item.textContent.includes('Confirmer l’envoi')))
    expect(hote.textContent).toContain('401 non autorisé')
    expect(hote.querySelector('.ms-fenetre')).not.toBeNull()
  })

  it('bloque l’envoi quand la fonction n’est pas prête', async () => {
    faux.fonction.reponses.push({ data: null, error: { message: 'method_not_allowed' } })
    await ouvrir()
    expect(hote.textContent).toContain('ne répond pas au contrôle de santé')
    expect(hote.textContent).toContain('Déploie la fonction')
  })

  it('ajoute et retire des lignes de message', async () => {
    await ouvrir()
    await cliquer(bouton('Tester / envoyer'))
    expect(hote.querySelectorAll('.ms-ligne')).toHaveLength(1)
    await cliquer(bouton('Ajouter une ligne'))
    expect(hote.querySelectorAll('.ms-ligne')).toHaveLength(2)
    await cliquer(hote.querySelector('.ms-ligne-retirer'))
    expect(hote.querySelectorAll('.ms-ligne')).toHaveLength(1)
  })

  it('ferme la fenêtre sans envoyer', async () => {
    await ouvrir()
    await cliquer(bouton('Tester / envoyer'))
    await cliquer(hote.querySelector('.ms-fenetre-fermer'))
    expect(hote.querySelector('.ms-fenetre')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════
// 9. LE DESSIN
// ═══════════════════════════════════════════════════════════

describe('9. la toile, à la lecture', () => {
  it('n’écrit pas de style en ligne ni de toast', () => {
    expect(COMPOSANT).not.toContain('style={{')
    expect(COMPOSANT).not.toContain('toast')
    expect(COMPOSANT).not.toContain('window.confirm')
    expect(COMPOSANT).not.toContain('alert(')
    expect(COMPOSANT).not.toContain('<style')
  })

  it('n’a aucun emoji', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
    expect(COMPOSANT).not.toMatch(emoji)
    expect(CSS).not.toMatch(emoji)
    expect(COMPOSANT).not.toMatch(/[✓↩×•]/u)
  })

  it('ne change au survol ni le fond, ni la couleur, ni l’opacité', () => {
    const blocs = [...CSS.matchAll(/:hover[^{]*\{([^}]*)\}/g)].map((m) => m[1])
    expect(blocs.length).toBeGreaterThan(0)
    blocs.forEach((bloc) => {
      expect(bloc).not.toMatch(/(^|[\s;])color\s*:/)
      expect(bloc).not.toMatch(/(^|[\s;])background(-color)?\s*:/)
      expect(bloc).not.toMatch(/(^|[\s;])opacity\s*:/)
    })
  })

  it('dessine ses contrôles et reste lisible sur un téléphone', () => {
    expect(CSS).toContain('.ms-registre')
    expect(CSS).toContain('.ms-sante-criteres')
    expect(CSS).toContain('.ms-courriel[data-ton')
    expect(CSS).toContain('.ms-fenetre[data-taille=\'large\']')
    expect(CSS).toContain('@media (max-width: 720px)')
    expect(CSS).toContain('@media (max-width: 980px)')
    expect(CSS).toContain('prefers-reduced-motion')
  })

  it('reprend la fenêtre partagée au lieu d’en dessiner une autre', () => {
    expect(COMPOSANT).toContain("from './FenetreModale'")
    expect(COMPOSANT).toContain('<FenetreModale')
    expect(COMPOSANT).not.toContain('aria-modal="true"')
    const partage = lire('src/components/FenetreModale.jsx')
    expect(partage).toContain('aria-modal="true"')
    expect(partage).toContain('Escape')
  })
})
