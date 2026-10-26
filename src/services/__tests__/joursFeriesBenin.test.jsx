// ═══════════════════════════════════════════════════════════
// 🇧🇯 LE MODÈLE DE JOURS FÉRIÉS DU BÉNIN — ce que les tests défendent
//
// Une date fériée fausse fabrique une absence, un retard ou une
// heure supplémentaire qui n'existent pas. Le modèle n'a donc
// droit ni à l'approximation ni à la générosité :
//
//   · Pâques est calculé, pas tabulé — et il tombe juste ;
//   · la fête des religions traditionnelles est le DEUXIÈME
//     vendredi de janvier, avec sa veille ;
//   · le 26 octobre et le 30 novembre ne sont plus fériés
//     (abrogés) : le modèle ne doit pas les ressusciter ;
//   · Korité, Tabaski et Maouloud sont nommées, jamais datées ;
//   · charger deux fois le modèle ne crée pas de doublon ;
//   · l'écran ne crée que des fêtes du pays (sans entreprise).
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

import {
  paques,
  deuxiemeVendrediDeJanvier,
  MODELES_FERIES,
  modeleFeries,
  paysAvecModele,
  feriesDuModele,
  feriesAAjouter,
} from '../modelesFeries'
import { SUPPORTED_COUNTRIES } from '../holidayService'
import JoursFeries from '../../pages/JoursFeries'

const CSS = readFileSync('src/pages/JoursFeries.css', 'utf8')
const PAGE = readFileSync('src/pages/JoursFeries.jsx', 'utf8')

const leJour = (date) => date && date.toISOString().slice(0, 10)

// ── le service simulé : un registre pays vide au départ, un espion de création ──
const { creer, etat, avis } = vi.hoisted(() => ({
  creer: vi.fn(async () => ({ success: true })),
  etat: { globales: [], echecs: 0 },
  //  la page seule ne monte pas de <Toaster /> : on espionne les avis
  avis: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-hot-toast', () => ({ default: avis }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const requete = {
        select: () => requete,
        eq: () => requete,
        order: () => Promise.resolve({ data: [], error: null }),
      }
      return requete
    },
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

vi.mock('../holidayService', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: {
      getGlobalHolidays: async () => etat.globales,
      getEnterpriseOverrides: async () => [],
      createHoliday: creer,
    },
  }
})

//  l’écran travaille sur l’année courante : les attentes suivent l’horloge
const ANNEE = new Date().getFullYear()

describe('1. le Bénin existe là où l’écran le lit', () => {
  it('il est au catalogue des pays, avec son drapeau', () => {
    const benin = SUPPORTED_COUNTRIES.find(c => c.code === 'BJ')
    expect(benin).toBeTruthy()
    expect(benin.name).toBe('Bénin')
    expect(benin.flag).toBe('🇧🇯')
  })

  it('il a un modèle, et c’est le seul pour l’instant', () => {
    expect(paysAvecModele().map(m => m.code)).toContain('BJ')
    expect(modeleFeries('BJ')).toBe(MODELES_FERIES.BJ)
    //  la casse ne doit pas faire perdre le modèle
    expect(modeleFeries('bj')).toBe(MODELES_FERIES.BJ)
  })

  it('un pays sans modèle ne rend rien, sans casser', () => {
    expect(modeleFeries('FR')).toBeNull()
    expect(modeleFeries('')).toBeNull()
    expect(modeleFeries(undefined)).toBeNull()
    expect(feriesDuModele(null, 2026)).toEqual([])
  })

  it('le modèle cite sa source légale', () => {
    expect(MODELES_FERIES.BJ.source).toContain('90-019')
    expect(MODELES_FERIES.BJ.source).toContain('2024-32')
  })
})

describe('2. Pâques tombe juste', () => {
  //  les dates publiées, recoupées sur plusieurs sources
  const attendus = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2028: '2028-04-16',
    2030: '2030-04-21',
    2038: '2038-04-25', //  le dimanche le plus tardif possible
  }

  it('les années de référence donnent le dimanche de Pâques', () => {
    for (const [annee, attendu] of Object.entries(attendus)) {
      expect(leJour(paques(Number(annee))), annee).toBe(attendu)
    }
  })

  it('Pâques tombe toujours un dimanche, entre le 22 mars et le 25 avril', () => {
    for (let annee = 1990; annee <= 2060; annee += 1) {
      const jour = paques(annee)
      expect(jour.getUTCDay(), String(annee)).toBe(0)
      const mois = jour.getUTCMonth()
      const quantieme = jour.getUTCDate()
      expect(mois === 2 ? quantieme >= 22 : mois === 3, String(annee)).toBe(true)
      expect(mois === 3 ? quantieme <= 25 : mois === 2, String(annee)).toBe(true)
    }
  })

  it('aucune année ne peut sortir de sa propre année', () => {
    for (let annee = 2000; annee <= 2040; annee += 1) {
      expect(paques(annee).getUTCFullYear()).toBe(annee)
    }
  })
})

describe('3. la fête des religions traditionnelles', () => {
  it('c’est le deuxième vendredi de janvier, jamais le premier', () => {
    //  2026 : le 1er janvier est un jeudi, les vendredis sont les 2, 9, 16…
    expect(leJour(deuxiemeVendrediDeJanvier(2026))).toBe('2026-01-09')
    //  2025 : vendredis 3, 10, 17 → le deuxième est le 10
    expect(leJour(deuxiemeVendrediDeJanvier(2025))).toBe('2025-01-10')
    //  2027 : vendredis 1, 8, 15 → le deuxième est le 8
    expect(leJour(deuxiemeVendrediDeJanvier(2027))).toBe('2027-01-08')
  })

  it('c’est toujours un vendredi, toujours dans la première quinzaine', () => {
    for (let annee = 2000; annee <= 2060; annee += 1) {
      const date = deuxiemeVendrediDeJanvier(annee)
      expect(date.getUTCDay(), String(annee)).toBe(5)
      expect(date.getUTCDate(), String(annee)).toBeGreaterThanOrEqual(8)
      expect(date.getUTCDate(), String(annee)).toBeLessThanOrEqual(14)
    }
  })

  it('la veille est le jeudi qui précède', () => {
    const fetes = feriesDuModele(MODELES_FERIES.BJ, 2026)
    const veille = fetes.find(f => f.nom.startsWith('Veille de la fête des religions'))
    const fete = fetes.find(f => f.nom === 'Fête annuelle des religions traditionnelles')
    expect(veille.date).toBe('2026-01-08')
    expect(fete.date).toBe('2026-01-09')
    expect(new Date(`${veille.date}T12:00:00`).getDay()).toBe(4) //  jeudi
  })
})

describe('4. ce que le modèle date pour une année', () => {
  const fetes = feriesDuModele(MODELES_FERIES.BJ, 2026)

  it('onze fêtes datées : six fixes, deux règles, trois mobiles', () => {
    expect(fetes).toHaveLength(11)
    expect(fetes.filter(f => f.nature === 'fixe')).toHaveLength(6)
    expect(fetes.filter(f => f.nature === 'regle')).toHaveLength(2)
    expect(fetes.filter(f => f.nature === 'mobile')).toHaveLength(3)
  })

  it('la liste sort dans l’ordre du calendrier', () => {
    const dates = fetes.map(f => f.date)
    expect([...dates].sort()).toEqual(dates)
    expect(dates[0]).toBe('2026-01-01')
    expect(dates.at(-1)).toBe('2026-12-25')
  })

  it('les fêtes mobiles suivent Pâques de 2026', () => {
    //  Pâques le 5 avril 2026
    const parNom = Object.fromEntries(fetes.map(f => [f.nom, f.date]))
    expect(parNom['Lundi de Pâques']).toBe('2026-04-06')
    expect(parNom.Ascension).toBe('2026-05-14')
    expect(parNom['Lundi de Pentecôte']).toBe('2026-05-25')
  })

  it('les fêtes fixes portent leur date, et se répètent chaque année', () => {
    const parNom = Object.fromEntries(fetes.map(f => [f.nom, f]))
    expect(parNom['Fête du Nouvel An'].date).toBe('2026-01-01')
    expect(parNom['Fête du Travail'].date).toBe('2026-05-01')
    expect(parNom['Fête Nationale'].date).toBe('2026-08-01')
    expect(parNom.Assomption.date).toBe('2026-08-15')
    expect(parNom.Toussaint.date).toBe('2026-11-01')
    expect(parNom.Noël.date).toBe('2026-12-25')
    //  seules les fixes sont récurrentes : les autres se recalculent
    for (const fete of fetes) {
      expect(fete.recurrent, fete.nom).toBe(fete.nature === 'fixe')
    }
  })

  it('le 26 octobre et le 30 novembre ne sont pas fériés au Bénin', () => {
    //  abrogés par la loi 90-019 ; plusieurs sites les listent encore
    const dates = fetes.map(f => f.date)
    expect(dates).not.toContain('2026-10-26')
    expect(dates).not.toContain('2026-11-30')
    expect(fetes.some(f => /arm[eé]es/i.test(f.nom))).toBe(false)
    //  et pas de lendemain de Noël : le 26 décembre n'est pas férié
    expect(dates).not.toContain('2026-12-26')
    //  ni le dimanche de Pâques, seulement le lundi
    expect(dates).not.toContain('2026-04-05')
  })

  it('une autre année décale les mobiles et les règles, pas les fixes', () => {
    const an2027 = feriesDuModele(MODELES_FERIES.BJ, 2027)
    const parNom = Object.fromEntries(an2027.map(f => [f.nom, f.date]))
    expect(parNom['Lundi de Pâques']).toBe('2027-03-29')
    expect(parNom.Ascension).toBe('2027-05-06')
    expect(parNom['Lundi de Pentecôte']).toBe('2027-05-17')
    expect(parNom['Fête du Nouvel An']).toBe('2027-01-01')
    expect(parNom['Fête Nationale']).toBe('2027-08-01')
  })
})

describe('5. les fêtes lunaires sont nommées, jamais datées', () => {
  it('Korité, Tabaski et Maouloud ne sortent pas de la liste datée', () => {
    const fetes = feriesDuModele(MODELES_FERIES.BJ, 2026)
    const noms = fetes.map(f => f.nom)
    for (const lunaire of ['Korité', 'Tabaski', 'Maouloud']) {
      expect(noms).not.toContain(lunaire)
    }
  })

  it('elles restent visibles comme « non calculables », avec leur note', () => {
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [])
    expect(plan.nonCalculables.map(f => f.nom)).toEqual(['Korité', 'Tabaski', 'Maouloud'])
    for (const f of plan.nonCalculables) {
      expect(f.note.length).toBeGreaterThan(3)
      //  aucune date ne doit fuir ici
      expect(f.date).toBeUndefined()
    }
  })

  it('le modèle ne promet jamais de date lunaire, quelle que soit l’année', () => {
    for (let annee = 2024; annee <= 2030; annee += 1) {
      const noms = feriesDuModele(MODELES_FERIES.BJ, annee).map(f => f.nom)
      expect(noms.some(n => /korit|tabaski|maouloud/i.test(n)), String(annee)).toBe(false)
    }
  })
})

describe('6. on ne redouble jamais une fête déjà là', () => {
  it('sur un registre vide, tout est à créer', () => {
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [])
    expect(plan.aCreer).toHaveLength(11)
    expect(plan.dejaPresents).toHaveLength(0)
    expect(plan.annee).toBe(2026)
  })

  it('une récurrente au bon jour et au bon mois est reconnue', () => {
    //  Noël est enregistré « 2024-12-25 », récurrent : elle vaut pour 2026
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [
      { id: 'x', name: 'Noël', date: '2024-12-25', is_recurring: true },
    ])
    expect(plan.aCreer.map(f => f.nom)).not.toContain('Noël')
    expect(plan.dejaPresents.map(f => f.nom)).toContain('Noël')
    expect(plan.aCreer).toHaveLength(10)
  })

  it('une récurrente au mauvais jour ne couvre pas la fête', () => {
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [
      { id: 'x', name: 'Fête Nationale', date: '1960-08-02', is_recurring: true },
    ])
    expect(plan.aCreer.map(f => f.nom)).toContain('Fête Nationale')
  })

  it('une fête datée pile au jour la couvre, même non récurrente', () => {
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [
      { id: 'x', name: 'Ascension', date: '2026-05-14', is_recurring: false },
    ])
    expect(plan.aCreer.map(f => f.nom)).not.toContain('Ascension')
    expect(plan.dejaPresents.map(f => f.nom)).toContain('Ascension')
  })

  it('une fête calculée d’une autre année ne compte pas', () => {
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [
      { id: 'x', name: 'Lundi de Pâques', date: '2025-04-21', is_recurring: false },
    ])
    expect(plan.aCreer.map(f => f.nom)).toContain('Lundi de Pâques')
  })

  it('chargé deux fois, le modèle ne propose plus rien la seconde fois', () => {
    const premier = feriesAAjouter(MODELES_FERIES.BJ, 2026, [])
    //  on rejoue ce que l’écran vient d’écrire en base
    const ecrites = premier.aCreer.map((f, i) => ({
      id: `n${i}`, name: f.nom, date: f.date, is_recurring: f.recurrent,
    }))
    const second = feriesAAjouter(MODELES_FERIES.BJ, 2026, ecrites)
    expect(second.aCreer).toHaveLength(0)
    expect(second.dejaPresents).toHaveLength(11)
  })

  it('un registre incomplet ne propose que le manque', () => {
    const plan = feriesAAjouter(MODELES_FERIES.BJ, 2026, [
      { id: 'a', name: 'Fête du Travail', date: '2020-05-01', is_recurring: true },
      { id: 'b', name: 'Toussaint', date: '2020-11-01', is_recurring: true },
    ])
    expect(plan.aCreer).toHaveLength(9)
    expect(plan.dejaPresents.map(f => f.nom).sort()).toEqual(['Fête du Travail', 'Toussaint'])
  })
})

describe('7. l’écran charge le modèle pour le pays, pas pour une entreprise', () => {
  let hote
  let racine

  const monter = async () => {
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)

    await act(async () => {
      racine.render(<MemoryRouter><JoursFeries /></MemoryRouter>)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    //  super administrateur, sans entreprise choisie : c’est lui qui publie
    //  les fêtes du pays
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.globales = []
    etat.echecs = 0
    creer.mockReset()
    creer.mockImplementation(async () => ({ success: true }))
    avis.success.mockClear()
    avis.error.mockClear()
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  const clic = async (element) => {
    await act(async () => {
      element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
  }

  const pastilleBenin = () => [...hote.querySelectorAll('.jf-pays-puce')]
    .find(b => b.textContent.includes('Bénin'))

  const ouvrirApercu = async () => {
    await clic(pastilleBenin())
    const bouton = [...hote.querySelectorAll('.jf-bouton')]
      .find(b => b.textContent.includes('Charger le modèle Bénin'))
    expect(bouton, 'le bouton du modèle doit être là').toBeTruthy()
    await clic(bouton)
    return hote.querySelector('.jf-modale')
  }

  const boutonCreer = () => [...hote.querySelectorAll('.jf-modale .jf-bouton')]
    .find(b => /Créer \d+/.test(b.textContent))

  it('le Bénin est proposé même sans aucune fête publiée', async () => {
    await monter()
    const pastille = pastilleBenin()
    expect(pastille).toBeTruthy()
    expect(pastille.querySelector('.jf-pays-drapeau')).not.toBeNull()
    //  et il annonce qu’un modèle attend
    expect(pastille.textContent).toContain('modèle prêt')
  })

  it('le modèle ne se charge pas tout seul : il faut le demander', async () => {
    await monter()
    expect(creer).not.toHaveBeenCalled()
    expect(hote.querySelector('.jf-modele-liste')).toBeNull()
    //  sur le pays, le registre vide invite explicitement à charger le modèle
    await clic(pastilleBenin())
    expect(hote.textContent).toContain('Le Bénin n’a encore aucune fête publiée')
    expect(hote.textContent).toContain('Le modèle Bénin connaît déjà les fêtes légales de l’année.')
  })

  it('choisir le Bénin ouvre l’aperçu, avec ce qui est daté et ce qui ne l’est pas', async () => {
    await monter()
    const modale = await ouvrirApercu()

    expect(modale).not.toBeNull()
    expect(modale.getAttribute('aria-modal')).toBe('true')
    expect(modale.textContent).toContain('11 fêtes à créer')
    expect(modale.textContent).toContain('90-019')

    //  les fêtes datées sont lisibles, en français
    expect(modale.textContent).toContain(`jeudi 1 janvier ${ANNEE}`)
    expect(modale.textContent).toContain('Fête du Nouvel An')
    expect(modale.textContent).toContain('Fête annuelle des religions traditionnelles')

    //  les lunaires sont annoncées comme non datées
    expect(modale.textContent).toContain('Ce que le modèle ne date pas')
    for (const nom of ['Korité', 'Tabaski', 'Maouloud']) {
      expect(modale.textContent).toContain(nom)
    }
    expect(modale.textContent).not.toMatch(/Korité[^K]{0,40}2026/)
  })

  it('rien n’est écrit avant la confirmation', async () => {
    await monter()
    await ouvrirApercu()
    expect(creer).not.toHaveBeenCalled()
    //  on peut refermer sans rien créer
    await clic(hote.querySelector('.jf-modale .jf-icone-bouton'))
    expect(creer).not.toHaveBeenCalled()
    expect(hote.querySelector('.jf-modale')).toBeNull()
  })

  it('confirmer crée les onze fêtes du pays, sans entreprise rattachée', async () => {
    await monter()
    await ouvrirApercu()

    const confirmer = boutonCreer()
    expect(confirmer).toBeTruthy()
    expect(confirmer.disabled).toBe(false)

    await clic(confirmer)

    expect(creer).toHaveBeenCalledTimes(11)

    //  le premier argument est l’entreprise : null = fête du pays
    for (const appel of creer.mock.calls) {
      expect(appel[0]).toBeNull()
      expect(appel[1].country_code).toBe('BJ')
      expect(appel[1].is_worked).toBe(false)
    }

    //  les dates créées sont exactement celles du modèle
    const dates = creer.mock.calls.map(a => a[1].date).sort()
    const attendues = feriesDuModele(MODELES_FERIES.BJ, ANNEE).map(f => f.date)
    expect(dates).toEqual(attendues)

    //  seules les fixes sont récurrentes
    const recurrentes = creer.mock.calls
      .filter(a => a[1].is_recurring)
      .map(a => a[1].date.slice(5))
    expect(recurrentes.sort()).toEqual([
      '01-01', '05-01', '08-01', '08-15', '11-01', '12-25',
    ])

    //  l’aperçu se referme et le succès se dit
    expect(hote.querySelector('.jf-modale')).toBeNull()
    expect(avis.success).toHaveBeenCalledWith('11 fêtes du Bénin ajoutées')
  })

  it('les fêtes déjà publiées ne sont ni proposées ni recréées', async () => {
    //  Noël est déjà là, récurrent : il vaut pour l’année en cours
    etat.globales = [
      { id: 'g1', name: 'Noël', date: '2024-12-25', is_recurring: true, country_code: 'BJ', is_worked: false, overtime_rate: 100 },
    ]
    await monter()

    const modale = await ouvrirApercu()
    expect(modale.textContent).toContain('10 fêtes à créer')
    expect(modale.textContent).toContain('1 fête déjà présente')

    await clic(boutonCreer())
    expect(creer).toHaveBeenCalledTimes(10)
    const noms = creer.mock.calls.map(a => a[1].name)
    expect(noms).not.toContain('Noël')
  })

  it('quand tout est déjà là, l’aperçu le dit et n’écrit rien', async () => {
    etat.globales = feriesDuModele(MODELES_FERIES.BJ, ANNEE).map((f, i) => ({
      id: `g${i}`,
      name: f.nom,
      date: f.date,
      is_recurring: f.recurrent,
      country_code: 'BJ',
      is_worked: false,
      overtime_rate: 100,
    }))
    await monter()

    const modale = await ouvrirApercu()
    expect(modale.textContent).toContain(`Tout est déjà là pour ${ANNEE}`)
    expect(boutonCreer().disabled).toBe(true)

    await clic(boutonCreer())
    expect(creer).not.toHaveBeenCalled()
  })

  it('un échec d’écriture n’arrête pas les autres et se dit', async () => {
    let appels = 0
    creer.mockImplementation(async () => {
      appels += 1
      return appels === 1 ? { success: false, error: 'réseau' } : { success: true }
    })

    await monter()
    await ouvrirApercu()
    await clic(boutonCreer())

    //  les onze sont tentées, la première échoue seulement
    expect(creer).toHaveBeenCalledTimes(11)
    expect(avis.error).toHaveBeenCalledWith('1 fête n’a pas pu être créée')
    //  les dix autres sont bien annoncées comme créées
    expect(avis.success).toHaveBeenCalledWith('10 fêtes du Bénin ajoutées')
    //  et l’aperçu se referme plutôt que de bloquer sur l’erreur
    expect(hote.querySelector('.jf-modale')).toBeNull()
  })

  it('la création passe bien par la fête du pays, jamais par une entreprise', () => {
    //  createHoliday(enterpriseId, …) : le premier argument doit rester null
    expect(PAGE).toContain('HolidayService.createHoliday(null, {')
    expect(PAGE).not.toContain('HolidayService.createHoliday(selectedEntId')
  })
})

describe('8. le nouveau bloc reste lisible et dans le motif', () => {
  const luminance = (hex) => {
    const [r, g, b] = hex.replace('#', '').match(/[0-9a-f]{2}/gi)
      .map(h => parseInt(h, 16) / 255)
      .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }
  const jeton = (selecteur, nom) => {
    const debut = CSS.indexOf(selecteur)
    expect(debut).toBeGreaterThan(-1)
    const bloc = CSS.slice(debut, CSS.indexOf('}', debut))
    const m = bloc.match(new RegExp(`--jf-${nom}: (#[a-fA-F0-9]{6});`))
    expect(m, nom).not.toBeNull()
    return m[1]
  }

  it('le texte du modèle tient 4,5:1 sur ses deux fonds, dans les deux thèmes', () => {
    for (const selecteur of ['.jf-page {', '.jf-page.jf-clair {']) {
      const douce = jeton(selecteur, 'craie-douce')
      for (const fond of ['creux', 'panneau', 'panneau-2']) {
        expect(contraste(douce, jeton(selecteur, fond)), `${selecteur} ${fond}`)
          .toBeGreaterThanOrEqual(4.5)
      }
      //  le badge « modèle prêt » est en 9 px : la terre claire, pas la terre
      expect(contraste(jeton(selecteur, 'terre-clair'), jeton(selecteur, 'panneau')))
        .toBeGreaterThanOrEqual(4.5)
    }
  })

  it('le bloc du modèle est dessiné dans le textile, pas en carte générique', () => {
    for (const classe of [
      '.jf-modele-liste', '.jf-modele-item', '.jf-modele-date',
      '.jf-modele-nom', '.jf-modele-nature', '.jf-modele-inconnues',
      '.jf-pays-modele',
    ]) {
      expect(CSS, classe).toContain(classe)
    }
    //  le fil de trame à gauche de chaque fête
    expect(CSS).toContain('.jf-modele-item::before')
    expect(CSS).toContain('background: var(--jf-terre);')
    //  et il ne réintroduit pas le violet de l’ancienne page
    expect(CSS).not.toMatch(/#8b5cf6/i)
  })

  it('le bloc du modèle sait se replier sur téléphone', () => {
    expect(CSS).toMatch(/@media \(max-width: 720px\) \{[^}]*\.jf-modele-item/s)
  })
})
