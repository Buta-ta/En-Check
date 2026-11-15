// ═══════════════════════════════════════════════════════════
// 🟤 LE COÛT SALARIAL REJOINT LES RÉMUNÉRATIONS
//
// Deux écrans qui parlent de la même personne ne doivent pas
// vivre dans deux pages. Ce que ces tests défendent :
//
//   · la page « Coût salarial » n'existe plus — l'adresse
//     /cout-salarial ouvre la vue coût de /remunerations ;
//   · une seule coque, un seul jeu de repères : bascule, seuil,
//     raccourcis et action principale ne bougent pas d'une vue
//     à l'autre ;
//   · la vue coût se lit comme le reste de la page : une ligne
//     par salarié, jamais un tableau de treize colonnes ;
//   · le calcul reste celui des fonctions de la base, et l'écran
//     dit ce qui manque au lieu de faire semblant.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { existsSync, readFileSync } from 'node:fs'

import Remunerations from '../../pages/Remunerations'

const PAGE = readFileSync('src/pages/Remunerations.jsx', 'utf8')
const CSS = readFileSync('src/pages/Remunerations.css', 'utf8')
const APP = readFileSync('src/App.jsx', 'utf8')
const DASHBOARD = readFileSync('src/components/DashboardExperience.jsx', 'utf8')
const VERROU = readFileSync('src/components/VerrouOptions.jsx', 'utf8')

/** Le corps d'une règle CSS, à partir de son sélecteur exact (en début de ligne). */
const regle = (selecteur) => {
  const propre = selecteur.replace(/\s*\{$/, '')
  const motif = new RegExp(`(^|\\n)${propre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`)
  const trouve = motif.exec(CSS)
  expect(trouve, selecteur).not.toBeNull()
  const debut = trouve.index + trouve[1].length
  return CSS.slice(debut, CSS.indexOf('}', debut))
}

// ── les mois, calculés et non écrits ───────────────────────
//  Un test qui écrirait « septembre 2026 » en dur casserait au
//  changement de mois : on refait le même calcul que la page.
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const maintenant = new Date()
const MOIS_COURANT = cleMois(maintenant)
const MOIS_PRECEDENT = cleMois(new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1))
const libelle = (cle) => {
  const [a, m] = cle.split('-').map(Number)
  return `${MOIS_FR[m - 1]} ${a}`
}
const LIBELLE_PRECEDENT = libelle(MOIS_PRECEDENT)
const LIBELLE_COURANT = libelle(MOIS_COURANT)

// ── la base simulée ────────────────────────────────────────
const { etat, appels, toasts } = vi.hoisted(() => ({
  etat: {
    profils: [],
    lignes: [],
    budget: null,
    pointages: [],
    projection: null,
    cotisations: 0,
    erreurPeriode: null,
    erreurProjection: false,
    lent: false,
  },
  appels: { rpc: [], ecritures: [] },
  toasts: [],
}))

const SOCIETE = { id: 'ent1', name: 'Kandi SARL', code: 'KANDI', currency: 'XOF', country_code: 'BJ' }

const EMPLOYES = [
  { id: 'e1', first_name: 'Kossi', last_name: 'ALABI', matricule: 'E-001', position: 'Chauffeur', department: 'Logistique', contract_type: 'CDI' },
  { id: 'e2', first_name: 'Awa', last_name: 'DOSSOU', matricule: 'E-002', position: 'Couturière', department: 'Atelier', contract_type: 'CDI' },
]

const profilsDeBase = () => ([
  {
    employee_id: 'e1', salary_type: 'monthly', base_salary: 250000, hourly_rate: 0, daily_rate: 0,
    transport_allowance: 20000, housing_allowance: 0, fixed_bonus: 0,
    contract_hours_per_month: 173, contract_days_per_month: 26, overtime_eligible: true,
  },
  //  e2 n'a aucun profil : c'est elle qui rend le chiffre incomplet
])

const lignesDeBase = () => ([
  {
    employe_id: 'e1', nom: 'Kossi ALABI', matricule: 'E-001',
    heures: 173, heures_sup: 6, heures_nuit: 2,
    brut: 270000, charges: 48600, cout: 318600,
    cout_heure: 1841.62, cout_heure_prevu: 1820, ecart_pct: 1.2,
  },
  {
    employe_id: 'e2', nom: 'Awa DOSSOU', matricule: 'E-002',
    heures: 0, heures_sup: 0, heures_nuit: 0,
    brut: 0, charges: 12000, cout: 12000,
    cout_heure: 0, cout_heure_prevu: 0, ecart_pct: null,
  },
])

vi.mock('../../lib/supabase', () => {
  const requete = (table, colonnes = '') => {
    const reponse = () => {
      if (table === 'enterprises') {
        return colonnes.includes('currency')
          ? { data: SOCIETE, error: null }
          : { data: [SOCIETE], error: null }
      }
      if (table === 'employees') return { data: EMPLOYES, error: null }
      if (table === 'encheck_reglages_cout') return { data: etat.budget, error: null }
      if (table === 'enterprise_payroll_contributions') {
        return { data: null, error: null, count: etat.cotisations }
      }
      return { data: etat.profils, error: null }
    }

    const q = {
      select: (c = '') => requete(table, c),
      eq: () => q,
      gt: () => q,
      order: () => Promise.resolve(reponse()),
      maybeSingle: () => Promise.resolve(reponse()),
      then: (ok, ko) => Promise.resolve(reponse()).then(ok, ko),
      upsert: (charge) => {
        appels.ecritures.push(charge)
        return Promise.resolve({ error: null })
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }
    return q
  }

  const rpc = (nom, params) => {
    appels.rpc.push({ nom, params })
    if (nom === 'encheck_mois_pointes') {
      return Promise.resolve({ data: etat.pointages, error: null })
    }
    if (nom === 'encheck_cout_periode') {
      //  une base lente : la promesse ne se résout jamais, l'écran doit
      //  dire qu'il travaille
      if (etat.lent) return new Promise(() => {})
      return Promise.resolve(etat.erreurPeriode
        ? { data: null, error: etat.erreurPeriode }
        : { data: etat.lignes, error: null })
    }
    if (nom === 'encheck_cout_projeter') {
      return Promise.resolve(etat.erreurProjection
        ? { data: null, error: { code: '500', message: 'Internal server error' } }
        : { data: etat.projection, error: null })
    }
    if (nom === 'encheck_cout_controler') {
      return Promise.resolve({ data: 1, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }

  return { supabase: { from: (table) => requete(table), rpc } }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ darkMode: true, toggleTheme: vi.fn() }),
}))

vi.mock('react-hot-toast', () => {
  const toast = (message) => toasts.push(['info', message])
  toast.success = (message) => toasts.push(['success', message])
  toast.error = (message) => toasts.push(['error', message])
  return { default: toast }
})

// ── les outils de manipulation ─────────────────────────────
const ecrire = async (element, valeur) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(element, valeur)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

const clic = async (element) => {
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
}

const texte = (el) => (el?.textContent || '').replace(/\s+/g, ' ')

// ═══════════════════════════════════════════════════════════
// 1. LA FUSION EST RÉELLE
// ═══════════════════════════════════════════════════════════
describe('1. une seule page pour les deux lectures', () => {
  it('la page « Coût salarial » n’existe plus dans le dépôt', () => {
    expect(existsSync('src/pages/CoutSalarial.jsx')).toBe(false)
    expect(APP).not.toContain('CoutSalarial')
  })

  it('l’ancienne adresse ouvre la vue coût, elle ne casse pas', () => {
    expect(APP).toMatch(/path="\/cout-salarial"/)
    expect(APP).toContain('<Navigate to="/remunerations?vue=cout" replace />')
  })

  it('le calcul du coût a bien été emporté, pas laissé derrière', () => {
    for (const nom of [
      'encheck_cout_periode',
      'encheck_cout_projeter',
      'encheck_mois_pointes',
      'encheck_cout_controler',
    ]) {
      expect(PAGE, nom).toContain(`'${nom}'`)
    }
    expect(PAGE).toContain("from('encheck_reglages_cout')")
    //  et les paramètres restent ceux des fonctions de la base
    expect(PAGE).toMatch(/p_enterprise:\s*entId/)
    expect(PAGE).toMatch(/p_du:\s*p\.du/)
    expect(PAGE).toMatch(/p_au:\s*p\.au/)
  })

  it('le coût n’encombre plus le menu : il vit dans la page', () => {
    //  plus de ligne « Coût salarial » dans la navigation latérale
    expect(DASHBOARD).not.toMatch(/\{ label: 'Coût salarial'/)
    expect(DASHBOARD).not.toContain("path: '/cout-salarial'")
    //  la commande rapide, elle, reste : un client qui n'a que ce module
    //  doit pouvoir ouvrir la vue
    expect(DASHBOARD).toContain("label: 'Voir le coût salarial'")
    expect(DASHBOARD).toContain("path: '/remunerations?vue=cout', category: 'Paie'")
  })

  it('une des deux options suffit à ouvrir la page', () => {
    expect(VERROU).toContain("'/remunerations': ['module_remunerations', 'module_cout_salarial']")
    expect(VERROU).not.toContain("'/cout-salarial'")
  })

  it('la page garde ses deux bandeaux et ses repères', () => {
    expect(PAGE).toContain('<PageCulturalBand pathname="/remunerations" />')
    expect(PAGE).toContain('<PageCulturalBand pathname="/remunerations" placement="bottom" />')
    expect(PAGE).toContain('role="switch"')
    expect(PAGE).toContain('<RaccourcisPages compact excludePaths={[\'/remunerations\']} />')
  })
})

// ═══════════════════════════════════════════════════════════
// 2. LA VUE COÛT SE MONTE ET SE LIT
// ═══════════════════════════════════════════════════════════
describe('2. la vue coût', () => {
  let hote
  let racine

  const monter = async (adresse = '/remunerations?vue=cout') => {
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(
        <MemoryRouter initialEntries={[adresse]}><Remunerations /></MemoryRouter>
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.profils = profilsDeBase()
    etat.lignes = lignesDeBase()
    etat.pointages = [
      { mois: `${MOIS_PRECEDENT}-01`, nb_pointages: 12 },
      { mois: `${MOIS_COURANT}-01`, nb_pointages: 0 },
    ]
    etat.projection = { projete: 1450000 }
    etat.budget = { budget_mensuel: 1500000, seuil_alerte_pct: 90, alerte_actif: true }
    etat.cotisations = 3
    etat.erreurPeriode = null
    etat.erreurProjection = false
    etat.lent = false
    appels.rpc = []
    appels.ecritures = []
    toasts.length = 0
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  const bande = (nom) => [...hote.querySelectorAll('.rw-bande')]
    .find(b => texte(b).includes(nom))

  it('la même coque, et deux vues qui se répondent', async () => {
    await monter()

    expect(hote.querySelector('.rw-page')).not.toBeNull()
    expect(hote.querySelector('[data-cultural-motif="bogolan"]')).not.toBeNull()
    expect(hote.querySelector('h1').textContent).toContain('Rémunérations')

    const vues = [...hote.querySelectorAll('.rw-vue')]
    expect(vues).toHaveLength(2)
    expect(vues[0].getAttribute('aria-pressed')).toBe('false')
    expect(vues[1].getAttribute('aria-pressed')).toBe('true')
    //  les repères ne bougent pas d'une vue à l'autre
    expect(hote.querySelector('.rw-seuil')).not.toBeNull()
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).not.toBeNull()
    expect(hote.querySelector('.rw-bascule[role="switch"]')).not.toBeNull()
  })

  it('la période se règle en haut, et le mois suit les pointages', async () => {
    await monter()

    expect(hote.querySelector('.rw-periode')).not.toBeNull()
    const chips = [...hote.querySelectorAll('.rw-periode .rw-filtre')]
    expect(chips).toHaveLength(4)
    expect(chips.find(c => c.getAttribute('aria-pressed') === 'true').textContent).toContain('Ce mois-ci')

    //  le mois en cours n'a pas de pointage : l'écran se place sur le dernier
    //  mois réellement travaillé, et le dit
    expect(texte(hote.querySelector('.rw-mois-nom'))).toBe(LIBELLE_PRECEDENT)
    expect(texte(hote.querySelector('.rw-constat'))).toContain('Vous regardez')
    expect(texte(hote.querySelector('.rw-constat'))).toContain('12 pointages comptés')
  })

  it('les quatre mesures disent la masse, l’heure, le dépassement et la projection', async () => {
    await monter()

    const mesures = [...hote.querySelectorAll('.rw-mesure')]
    expect(mesures).toHaveLength(4)

    //  318 600 + 12 000 de coût, 48 600 + 12 000 de charges
    expect(texte(mesures[0])).toContain('330 600')
    expect(texte(mesures[0])).toContain('60 600')

    //  330 600 ÷ 173 h pointées = 1 910,98
    expect(texte(mesures[1])).toContain('1 910,98')
    expect(texte(mesures[1])).toContain('173 h')

    expect(texte(mesures[2])).toContain('6 h')
    expect(texte(mesures[2])).toContain('2 h')

    //  projection 1 450 000 pour un budget de 1 500 000 : 96,7 %
    expect(texte(mesures[3])).toContain('1 450 000')
    expect(texte(mesures[3])).toContain('1 500 000')
    expect(texte(mesures[3])).toContain('96,7 % du budget')
    expect(mesures[3].getAttribute('data-ton')).toBe('attente')
  })

  it('la masse se décompose en brut et en charges, sans le dire en jargon', async () => {
    await monter()

    const reperes = texte(hote.querySelector('.rw-reperes'))
    expect(reperes).toContain('profils de paie')
    expect(reperes).toContain('cotisations employeur')
    expect(reperes).toContain('270 000')
    expect(reperes).toContain('60 600')
  })

  it('une ligne par salarié, jamais un tableau', async () => {
    await monter()

    expect(hote.querySelector('table')).toBeNull()
    expect(hote.querySelector('thead')).toBeNull()
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(2)

    const kossi = bande('Kossi ALABI')
    expect(kossi.getAttribute('data-part')).toBe('4')
    //  la tranche de gauche donne son poids dans la masse, sans un mot
    expect(kossi.querySelector('.rw-poids')).not.toBeNull()

    const cellules = [...kossi.querySelectorAll('.rw-cellule')].map(c => texte(c))
    expect(cellules.some(c => c.includes('173 h'))).toBe(true)
    expect(cellules.some(c => c.includes('270 000'))).toBe(true)
    expect(cellules.some(c => c.includes('48 600'))).toBe(true)
    expect(cellules.some(c => c.includes('1 841,62'))).toBe(true)
    expect(cellules.some(c => c.includes('1 820'))).toBe(true)

    //  l'écart se lit en clair, du côté qui coûte
    expect(texte(kossi.querySelector('.rw-etat'))).toContain('1,2 % sur l’heure prévue')
    expect(kossi.querySelector('.rw-etat').getAttribute('data-ton')).toBe('alerte')
  })

  it('le mois affiché est cliquable : on saute au mois voulu', async () => {
    await monter()

    const bouton = hote.querySelector('.rw-mois-nom')
    expect(bouton.tagName).toBe('BUTTON')
    expect(bouton.getAttribute('aria-expanded')).toBe('false')

    await clic(bouton)
    expect(bouton.getAttribute('aria-expanded')).toBe('true')

    const options = [...hote.querySelectorAll('.rw-mois-option')]
    expect(options.length).toBeGreaterThanOrEqual(2)

    //  le mois pointé est proposé avec son compte, et il est celui qui est lu
    const pointe = options.find(o => texte(o).includes(LIBELLE_PRECEDENT))
    expect(texte(pointe)).toContain('12 pointages')
    expect(pointe.getAttribute('aria-selected')).toBe('true')

    //  le mois en cours est toujours proposé
    expect(options.some(o => texte(o).includes(LIBELLE_COURANT))).toBe(true)

    //  choisir referme la liste et change l'en-tête
    await clic(options.find(o => texte(o).includes(LIBELLE_COURANT)))
    expect(hote.querySelector('.rw-mois-liste')).toBeNull()
    expect(texte(hote.querySelector('.rw-mois-nom'))).toBe(LIBELLE_COURANT)
  })

  it('la liste des mois se ferme d’un clic à côté', async () => {
    await monter()

    await clic(hote.querySelector('.rw-mois-nom'))
    expect(hote.querySelector('.rw-mois-liste')).not.toBeNull()

    await clic(hote.querySelector('.rw-mois-voile'))
    expect(hote.querySelector('.rw-mois-liste')).toBeNull()
    //  et le mois n'a pas bougé
    expect(texte(hote.querySelector('.rw-mois-nom'))).toBe(LIBELLE_PRECEDENT)
  })

  it('pendant le calcul, l’écran dit qu’il travaille — sans zéros en attendant', async () => {
    etat.lent = true
    await monter()

    const attente = [...hote.querySelectorAll('.rw-constat')]
      .find(c => texte(c).includes('Calcul en cours'))
    expect(attente).toBeDefined()
    expect(attente.getAttribute('role')).toBe('status')

    //  aucune mesure vide, aucune ligne fantôme pendant le calcul
    expect(hote.querySelectorAll('.rw-mesure')).toHaveLength(0)
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(0)
  })

  it('la recherche de la vue coût suit le nom et le matricule', async () => {
    await monter()

    const champ = hote.querySelector('[aria-label="Chercher un salarié dans le coût"]')
    expect(champ).not.toBeNull()

    await ecrire(champ, 'awa')
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(1)
    expect(texte(hote.querySelector('.rw-bande'))).toContain('Awa DOSSOU')

    await ecrire(champ, 'E-001')
    expect(texte(hote.querySelector('.rw-bande'))).toContain('Kossi ALABI')

    await ecrire(champ, 'zzz')
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(0)
    expect(texte(hote)).toContain('Aucun salarié ne correspond')

    const revoir = [...hote.querySelectorAll('.rw-vide .rw-bouton')]
      .find(b => texte(b).includes('Tout revoir'))
    await clic(revoir)
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(2)
  })

  it('un salarié sans montant déclaré ne se déguise pas en coût complet', async () => {
    await monter()

    const awa = bande('Awa DOSSOU')
    expect(awa.getAttribute('data-declare')).toBe('non')
    expect(texte(awa)).toContain('rémunération non déclarée')
    expect(texte(awa.querySelector('.rw-etat'))).toContain('pas d’heures pointées')
  })

  it('le chiffre incomplet est annoncé, et le chemin pour le compléter est là', async () => {
    await monter()

    const constat = [...hote.querySelectorAll('.rw-constat')]
      .find(c => texte(c).includes('pas encore complet'))
    expect(constat).toBeDefined()
    expect(texte(constat)).toContain('1 salarié sur 2')
    expect(texte(constat)).toContain('aucun montant déclaré')

    const bouton = [...constat.querySelectorAll('.rw-bouton')]
      .find(b => texte(b).includes('Renseigner les rémunérations'))
    await clic(bouton)

    //  on est revenu sur la vue des contrats, sans rechargement de page
    expect(hote.querySelector('.rw-periode')).toBeNull()
    expect(hote.querySelector('[aria-label="Rythme de paie de Awa DOSSOU"]')).not.toBeNull()
    expect([...hote.querySelectorAll('.rw-vue')][0].getAttribute('aria-pressed')).toBe('true')
  })

  it('le budget se contrôle depuis la barre, à sa place habituelle', async () => {
    await monter()

    const barre = hote.querySelector('.rw-barre')
    expect(barre).not.toBeNull()
    expect(texte(barre)).toContain('96,7 % du budget')
    expect(texte(barre)).toContain('1 500 000')

    const bouton = [...barre.querySelectorAll('.rw-bouton')]
      .find(b => texte(b).includes('Contrôler le budget'))
    await clic(bouton)

    expect(appels.rpc.some(a => a.nom === 'encheck_cout_controler'
      && a.params.p_enterprise === 'ent1')).toBe(true)
    expect(toasts.some(([type]) => type === 'success')).toBe(true)
  })

  it('sans budget, la barre ne s’affiche pas et la mesure le dit', async () => {
    etat.budget = null
    await monter()

    expect(hote.querySelector('.rw-barre')).toBeNull()
    const mesures = [...hote.querySelectorAll('.rw-mesure')]
    expect(texte(mesures[3])).toContain('aucun budget déclaré')
  })

  it('un mois sans pointage le dit, au lieu de faire croire à une panne', async () => {
    etat.pointages = [{ mois: `${MOIS_COURANT}-01`, nb_pointages: 0 }]
    await monter()

    expect(texte(hote.querySelector('.rw-constat'))).toContain('Aucun pointage')
    expect(texte(hote.querySelector('.rw-constat'))).toContain('ce n’est pas une panne')
  })

  it('un calcul en panne le dit, sans vider la page ni répéter l’appel', async () => {
    etat.erreurPeriode = { code: '500', message: 'Internal server error' }
    await monter()

    const constat = [...hote.querySelectorAll('.rw-constat')]
      .find(c => texte(c).includes('n’a pas répondu'))
    expect(constat).toBeDefined()
    expect(texte(constat)).toContain('Vos rémunérations sont intactes')

    //  pas de mesures à zéro, pas de lignes fantômes
    expect(hote.querySelectorAll('.rw-mesure')).toHaveLength(0)
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(0)

    //  et un seul appel en panne : ni projection, ni repli du mois
    expect(appels.rpc.filter(a => a.nom === 'encheck_cout_periode')).toHaveLength(1)
    expect(appels.rpc.filter(a => a.nom === 'encheck_cout_projeter')).toHaveLength(0)
  })

  it('une fonction absente se dit autrement qu’une panne', async () => {
    etat.erreurPeriode = {
      code: 'PGRST202',
      message: 'Could not find the function public.encheck_cout_periode(p_au, p_du, p_enterprise)',
    }
    await monter()

    const constat = [...hote.querySelectorAll('.rw-constat')]
      .find(c => texte(c).includes('n’est pas installé'))
    expect(constat).toBeDefined()
    expect(texte(constat)).toContain('seule cette lecture manque')
  })

  it('« Réessayer » relance le calcul quand il revient', async () => {
    etat.erreurPeriode = { code: '500', message: 'Internal server error' }
    await monter()

    etat.erreurPeriode = null
    const bouton = [...hote.querySelectorAll('.rw-constat .rw-bouton')]
      .find(b => texte(b).includes('Réessayer'))
    await clic(bouton)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(hote.querySelectorAll('.rw-mesure')).toHaveLength(4)
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(2)
  })

  it('une projection en panne n’emporte pas les chiffres du mois', async () => {
    etat.erreurProjection = true
    await monter()

    const mesures = [...hote.querySelectorAll('.rw-mesure')]
    expect(mesures).toHaveLength(4)
    //  la projection retombe sur la masse comptée du mois
    expect(texte(mesures[3])).toContain('330 600')
    expect(hote.querySelectorAll('.rw-bande')).toHaveLength(2)
  })

  it('⌘S n’enregistre pas depuis une vue qui ne fait que lire', async () => {
    await monter()

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 's', ctrlKey: true, bubbles: true,
      }))
    })

    expect(appels.ecritures).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })

  it('les deux vues partagent le même basculement de thème', async () => {
    await monter()

    expect(hote.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    await clic([...hote.querySelectorAll('.rw-vue')][0])

    expect(hote.querySelector('[role="switch"]')).not.toBeNull()
    expect(hote.querySelector('.rw-periode')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// 3. LE TON ET LA LISIBILITÉ
// ═══════════════════════════════════════════════════════════
describe('3. le ton reste professionnel dans la vue coût', () => {
  const INTERDITS = [/pagne/i, /teint/i, /tiss/i, /\bboue\b/i, /couture/i]

  let hote
  let racine

  beforeEach(async () => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.setItem('admin', JSON.stringify({ role: 'super_admin' }))
    etat.profils = profilsDeBase()
    etat.lignes = lignesDeBase()
    etat.pointages = [
      { mois: `${MOIS_PRECEDENT}-01`, nb_pointages: 12 },
      { mois: `${MOIS_COURANT}-01`, nb_pointages: 0 },
    ]
    etat.projection = { projete: 1450000 }
    etat.budget = { budget_mensuel: 1500000, seuil_alerte_pct: 90, alerte_actif: true }
    etat.cotisations = 3
    etat.erreurPeriode = null
    etat.erreurProjection = false
    etat.lent = false

    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(
        <MemoryRouter initialEntries={['/remunerations?vue=cout']}><Remunerations /></MemoryRouter>
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
  })

  afterEach(async () => {
    if (racine) await act(async () => racine.unmount())
    hote?.remove()
    racine = null
    vi.useRealTimers()
  })

  it('aucune formule d’atelier dans ce que lit l’utilisateur', () => {
    const visible = texte(hote)
    expect(visible.length).toBeGreaterThan(400)
    for (const interdit of INTERDITS) {
      expect(visible, String(interdit)).not.toMatch(interdit)
    }
  })

  it('la page dit « ligne » et « salarié », pas « bande »', () => {
    expect(texte(hote)).not.toMatch(/\bbandes?\b/i)
    expect(CSS).toContain('.rw-bande')
  })

  it('le coût se dessine avec les couleurs de la page', () => {
    for (const selecteur of ['.rw-vues', '.rw-periode', '.rw-jauge', '.rw-grille-cout', '.rw-part-barre', '.rw-poids']) {
      expect(regle(selecteur), selecteur).toMatch(/var\(--rw-/)
    }
    for (const interdit of ['#4F46E5', '#6366F1', '#8B5CF6', '#F8FAFC', '#EEF2FF']) {
      expect(PAGE.toLowerCase(), interdit).not.toContain(interdit.toLowerCase())
      expect(CSS.toLowerCase(), interdit).not.toContain(interdit.toLowerCase())
    }
  })

  it('le poids d’une ligne se lit sans chiffre, et les deux vues se replient', () => {
    expect(regle(".rw-bande[data-part='4'] .rw-poids")).toContain('height: 100%')
    expect(regle('.rw-grille-cout')).toContain('repeat(7, minmax(0, 1fr))')
    //  les points de rupture existent pour la vue coût aussi
    const fin = CSS.slice(CSS.indexOf('@media (max-width: 760px)'))
    expect(fin).toContain('.rw-grille-cout')
    expect(CSS.slice(CSS.indexOf('@media (max-width: 520px)'))).toContain('.rw-grille-cout')
  })

  it('aucun texte n’est dimmé par une opacité dans la vue coût', () => {
    for (const selecteur of ['.rw-cellule', '.rw-total-bloc', '.rw-part-legende', '.rw-jauge-legende']) {
      expect(regle(selecteur), selecteur).not.toContain('opacity')
    }
  })
})
