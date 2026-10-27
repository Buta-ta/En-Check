// ═══════════════════════════════════════════════════════════
// 🪡 ÉQUIPES ET TÂCHES REJOIGNENT L'ANNUAIRE
//
// Trois écrans qui parlent des mêmes personnes ne doivent pas
// vivre dans trois pages. Ce que ces tests défendent :
//
//   · le menu ne propose plus /equipes ni /taches — une seule
//     entrée, « Équipe », ouvre l'annuaire, qui porte les trois
//     vues ; les anciennes adresses renvoient vers la bonne vue
//     au lieu de casser un lien déjà envoyé ;
//   · les vues Équipes et Tâches se lisent dans la coque de
//     l'annuaire : même en-tête, même thème, mêmes raccourcis ;
//   · le registre perlé est un vocabulaire visuel, pas un jargon :
//     aucun mot d'atelier dans les textes lus ;
//   · aucune carte : ce qui sépare deux entrées, c'est un filet ;
//   · un survol change le trait, jamais le fond derrière un
//     texte, la couleur d'un texte ni l'opacité d'un champ ;
//   · déplacer une tâche d'une colonne à l'autre change vraiment
//     son statut, et pas seulement son apparence.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

import { ThemeProvider } from '../../contexts/ThemeContext'
import Employes from '../../pages/Employes'
import EquipesVue from '../../components/equipes/EquipesVue'
import TachesVue from '../../components/taches/TachesVue'
import EntreeEmploye from '../../components/equipes/EntreeEmploye'

const APP = readFileSync('src/App.jsx', 'utf8')
const MENU = readFileSync('src/components/DashboardExperience.jsx', 'utf8')
const VERROU = readFileSync('src/components/VerrouOptions.jsx', 'utf8')
const EMPLOYES = readFileSync('src/pages/Employes.jsx', 'utf8')
const CSS = readFileSync('src/components/zoulou/zoulou.css', 'utf8')

// ── la base simulée : la page Employés lit beaucoup, on répond vide ──
vi.mock('../../lib/supabase', () => {
  const chaine = () => {
    const requete = {
      select: () => requete, eq: () => requete, neq: () => requete, in: () => requete,
      is: () => requete, not: () => requete, or: () => requete, order: () => requete,
      limit: () => requete, range: () => requete, gte: () => requete, lte: () => requete,
      single: async () => ({
        data: {
          id: 'ent-1', name: 'Entreprise test',
          module_taches: true, module_planning: false, module_qr_scanner: false,
        },
        error: null,
      }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (suite) => Promise.resolve({ data: [], error: null }).then(suite),
    }
    return requete
  }
  return {
    supabase: {
      from: () => chaine(),
      rpc: async () => ({ data: null, error: null }),
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
      auth: { getSession: async () => ({ data: { session: null } }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    },
  }
})

// ── l'état simulé ──────────────────────────────────────────
const { etat, appels } = vi.hoisted(() => ({
  etat: {
    equipes: [],
    taches: [],
    categories: [],
    equipeAutorisee: true,
    tacheAutorisee: true,
    predictions: false,
    alertes: [],
    sante: null,
    orphelins: [],
    suggestions: [],
    besoins: [],
    erreurEquipes: null,
    erreurTaches: null,
  },
  appels: [],
}))

vi.mock('../../services/featureService', () => {
  const FEATURES = {
    GESTION_TACHES: 'gestion_taches',
    GESTION_EQUIPES: 'gestion_equipes',
    PREDICTIONS: 'predictions',
  }
  const hasFeature = async (_id, feature) => {
    if (feature === FEATURES.GESTION_EQUIPES) return etat.equipeAutorisee
    if (feature === FEATURES.GESTION_TACHES) return etat.tacheAutorisee
    if (feature === FEATURES.PREDICTIONS) return etat.predictions
    return false
  }
  return { FEATURES, default: { hasFeature }, hasFeature }
})

vi.mock('../../services/teamService', () => ({
  getTeams: async () => ({ data: etat.equipes, error: etat.erreurEquipes }),
  getTeamHealthMetrics: async () => ({ data: etat.sante?.parEquipe || [], global: etat.sante?.global || null }),
  getTeamAlerts: async () => ({ data: etat.alertes }),
  getOrphanEmployees: async () => ({ data: etat.orphelins }),
  detectPotentialTeams: async () => ({ data: etat.suggestions }),
  predictStaffingNeeds: async () => ({ data: etat.besoins }),
  getTeamHistory: async () => ({ data: [] }),
  getAvailableEmployeesForTeam: async () => ({ data: [] }),
  createTeam: async (donnees) => { appels.push({ type: 'createTeam', donnees }); return { data: { id: 'new' }, error: null } },
  updateTeam: async (id, champs) => { appels.push({ type: 'updateTeam', id, champs }); return { data: {}, error: null } },
  deleteTeam: async () => ({ success: true }),
  addTeamMembers: async (id, membres) => { appels.push({ type: 'addTeamMembers', id, membres }); return { error: null } },
  removeTeamMember: async () => ({ success: true }),
  getTeamUsageMetrics: async () => ({ data: [] }),
  logTeamAction: async () => ({}),
}))

vi.mock('../../services/taskService', () => ({
  getTasks: async () => ({ data: etat.taches, error: etat.erreurTaches }),
  getTaskCategories: async () => ({ data: etat.categories }),
  createTask: async () => ({ error: null }),
  updateTask: async (id, champs) => { appels.push({ type: 'updateTask', id, champs }); return { data: {}, error: null } },
  deleteTask: async () => ({ success: true }),
  createTaskCategory: async () => ({ error: null }),
  updateTaskCategory: async () => ({ error: null }),
  deleteTaskCategory: async () => ({ success: true }),
  getTaskAlerts: async () => ({ data: etat.alertes }),
  getStatusLabel: (s) => ({ assigned: 'Assignée', seen: 'Vue', in_progress: 'En cours', paused: 'En pause', completed: 'Terminée', validated: 'Validée', rejected: 'Refusée', cancelled: 'Annulée' }[s] || s),
  getPriorityLabel: (p) => ({ low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique' }[p] || p),
  getDeadlineStatus: (date) => {
    if (!date) return { overdue: false, text: 'Sans deadline', urgency: 'none' }
    const diff = new Date(date) - Date.now()
    if (diff < 0) return { overdue: true, text: `En retard de ${Math.abs(Math.floor(diff / 86400000))}j`, urgency: 'critical' }
    return { overdue: false, text: `${Math.floor(diff / 3600000)}h restantes`, urgency: 'high' }
  },
  TASK_PRIORITY: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' },
  TASK_TYPE: { INDIVIDUAL: 'individual', TEAM: 'team' },
  TASK_STATUS: { ASSIGNED: 'assigned', IN_PROGRESS: 'in_progress', COMPLETED: 'completed', VALIDATED: 'validated' },
  predictTaskDuration: async () => ({ data: null }),
  checkEmployeeWorkload: async () => ({ data: null }),
  suggestAssignees: async () => ({ data: [] }),
}))

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  localStorage.setItem('admin', JSON.stringify({ id: 'adm', role: 'admin', selectedEnterprise: { id: 'ent-1' } }))
  appels.length = 0
  Object.assign(etat, {
    equipes: [], taches: [], categories: [], equipeAutorisee: true, tacheAutorisee: true,
    predictions: false, alertes: [], sante: null, orphelins: [], suggestions: [], besoins: [],
    erreurEquipes: null, erreurTaches: null,
  })
  hote = document.createElement('div')
  document.body.append(hote)
  racine = createRoot(hote)
})

afterEach(async () => {
  await act(async () => racine.unmount())
  hote.remove()
  vi.restoreAllMocks()
})

const rendre = async (element) => { await act(async () => racine.render(<MemoryRouter>{element}</MemoryRouter>)) }
// un état de départ différent demande un vrai remontage : re-rendre la même
// vue garderait ses états internes et ne relancerait pas le chargement
const relancer = async (element) => {
  await act(async () => racine.unmount())
  hote.remove()
  hote = document.createElement('div')
  document.body.append(hote)
  racine = createRoot(hote)
  await rendre(element)
}
const boutonAvec = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes(texte))

// ═══════════════════════════════════════════════════════════
// ① Le menu et les adresses
// ═══════════════════════════════════════════════════════════

describe('le menu et les adresses', () => {
  it('ne propose plus Équipes ni Tâches comme entrées séparées', () => {
    expect(MENU).not.toMatch(/label:\s*['"]Équipes['"]/)
    expect(MENU).not.toMatch(/label:\s*['"]Tâches['"]/)
    expect(MENU).toContain("'/employes'")
  })

  it('range la commande rapide sur la vue Équipes, dans la même page', () => {
    expect(MENU).toContain('/employes?vue=equipes')
  })

  it('garde les anciennes adresses vivantes en les renvoyant vers la bonne vue', () => {
    expect(APP).toMatch(/path=["']\/equipes["'][^>]*element=\{<Navigate to=["']\/employes\?vue=equipes["']/)
    expect(APP).toMatch(/path=["']\/taches["'][^>]*element=\{<Navigate to=["']\/employes\?vue=taches["']/)
  })

  it('n’a plus deux pages à maintenir', () => {
    expect(APP).not.toMatch(/import\s+Equipes\s+from/)
    expect(APP).not.toMatch(/import\s+Taches\s+from/)
  })

  it('ne verrouille plus une adresse qui n’existe plus', () => {
    expect(VERROU).not.toContain("'/equipes'")
    expect(VERROU).not.toContain("'/taches'")
  })
})

// ═══════════════════════════════════════════════════════════
// ② Les onglets de la page Employés
// ═══════════════════════════════════════════════════════════

describe('les onglets de la page Employés', () => {
  it('porte les trois vues et l’adresse qui va avec', () => {
    expect(EMPLOYES).toContain('Annuaire')
    expect(EMPLOYES).toContain('Équipes')
    expect(EMPLOYES).toContain('Tâches')
    expect(EMPLOYES).toContain("setSearchParams(cle === 'annuaire' ? {} : { vue: cle }")
  })

  it('ne montre pas une porte qui ne mène nulle part quand l’option est éteinte', () => {
    expect(EMPLOYES).toContain('const vueAutorisee = moduleTaches')
    expect(EMPLOYES).toMatch(/vueAutorisee\s*\?/)
  })

  it('garde l’annuaire comme vue d’entrée, même avec une adresse inconnue', () => {
    expect(EMPLOYES).toMatch(/vueInitiale|vueParDefaut|'annuaire'/)
  })

  it('embarque les raccourcis de pages de la coque refondue', () => {
    expect(EMPLOYES).toContain("<RaccourcisPages compact excludePaths={['/employes']} />")
  })
})

// ═══════════════════════════════════════════════════════════
// ② bis La vue Annuaire — même registre que les deux autres
// ═══════════════════════════════════════════════════════════

const personne = (surcharge = {}) => ({
  id: 'emp-1',
  first_name: 'Awa',
  last_name: 'Dossou',
  matricule: 'EMP-001',
  contract_type: 'CDI',
  position: 'Technicienne de ligne',
  department: 'Maintenance',
  classification: 'employe',
  hire_date: '2021-03-01',
  machine_pin: '42',
  employee_portal_enabled: true,
  user_id: 'u-1',
  employee_schedules: [],
  enterprises: { module_planning: true },
  ...surcharge,
})

const rendreEntree = async (props = {}) => {
  const actions = {
    onOuvrirFiche: vi.fn(),
    onBadge: vi.fn(),
    onHoraires: vi.fn(),
    onPartagerHoraires: vi.fn(),
    onPointages: vi.fn(),
    onMotDePasse: vi.fn(),
    onBasculerPortail: vi.fn(),
    onSupprimer: vi.fn(),
  }
  await rendre(
    <EntreeEmploye
      employee={personne()}
      numero={1}
      liveStatus={{ state: 'en_poste', entryHHMM: '08:12' }}
      stats={{ totalSeconds: 3600, percentage: 80, label: '32 h sur 40 h' }}
      scheduleInfo="08:00 → 17:00"
      regimeLabel="Horaire d’entreprise"
      seniority="4 ans 6m"
      derniereConnexion="Connexion il y a 2 j"
      contractLabel="CDI"
      classificationLabel="Employé"
      portalEnabled
      planningEnabled
      aCompte
      ancienSysteme={false}
      {...actions}
      {...props}
    />,
  )
  return actions
}

describe('la vue Annuaire', () => {
  it('ouvre sur un feuillet, un titre serif et un colophon de quatre chiffres', async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })

    expect(hote.querySelector('.rg-folio').textContent).toContain('Registre du personnel')
    expect(hote.querySelector('.rg-eyebrow').textContent).toContain('Tout le personnel')
    expect(hote.querySelector('h2.rg-titre').textContent).toBe('Annuaire.')

    const chiffres = [...hote.querySelectorAll('.rg-chiffre')]
    expect(chiffres).toHaveLength(4)
    expect(chiffres.map((c) => c.querySelector('.rg-chiffre-libelle').textContent))
      .toEqual(['Employés', 'En poste', 'Portail', 'À migrer'])
    // rien à compter : un tiret, pas un zéro inventé pour la présence
    expect(chiffres[1].querySelector('.rg-chiffre-valeur').textContent).toBe('—')
    expect(chiffres[1].querySelector('.rg-chiffre-note').textContent).toBe('pointage non suivi')
  })

  it('explique l’annuaire vide et propose la première fiche', async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })
    expect(hote.textContent).toContain('Aucun employé pour l’instant')
    expect(hote.querySelector('[data-testid="rosace-perles"]')).not.toBeNull()
    expect(boutonAvec('Ajouter un employé')).toBeTruthy()
  })

  it('range une personne en entrée de registre numérotée', async () => {
    await rendreEntree()
    const entree = hote.querySelector('.rg-entree-annuaire')
    expect(entree).not.toBeNull()
    expect(entree.querySelector('.rg-entree-index').textContent).toBe('01')
    expect(entree.querySelector('.rg-entree-titre').textContent).toBe('Awa Dossou')
    expect(entree.querySelector('.rg-avatar-annuaire').textContent).toBe('AD')
    expect(entree.textContent).toContain('EMP-001')
    expect(entree.textContent).toContain('CDI')
    expect(entree.textContent).toContain('Technicienne de ligne')
    expect(entree.textContent).toContain('Maintenance')
  })

  it('lit la présence et les heures de la semaine, sans les inventer', async () => {
    await rendreEntree()
    const presence = hote.querySelector('.rg-presence')
    expect(presence.getAttribute('data-etat')).toBe('en_poste')
    expect(presence.textContent).toContain('En poste · 08:12')
    expect(hote.querySelector('.rg-annuaire-heures-texte').textContent).toBe('32 h sur 40 h')
    expect(hote.querySelector('.rg-jauge-remplie').getAttribute('style')).toContain('80%')

    await relancer(<EntreeEmploye employee={personne()} numero={2} />)
    expect(hote.querySelector('.rg-presence').textContent).toContain('Non pointé')
    expect(hote.querySelector('.rg-annuaire-heures')).toBeNull()
  })

  it('dit quand il n’y a pas de numéro de pointeuse, au lieu de laisser un blanc', async () => {
    await rendreEntree({ employee: personne({ machine_pin: '' }) })
    expect(hote.textContent).toContain('aucun numéro de pointage')
  })

  it('ouvre la fiche d’un clic sur le nom, le badge d’un clic sur Badge', async () => {
    const actions = await rendreEntree()
    await act(async () => hote.querySelector('.rg-entree-titre button').click())
    expect(actions.onOuvrirFiche).toHaveBeenCalledWith(expect.objectContaining({ id: 'emp-1' }))

    await act(async () => boutonAvec('Badge').click())
    expect(actions.onBadge).toHaveBeenCalledTimes(1)
  })

  it('garde les autres gestes dans un menu, pas sur la ligne', async () => {
    const actions = await rendreEntree()
    const menuBouton = hote.querySelector('.rg-entree-actions button[aria-expanded]')
    expect(menuBouton.getAttribute('aria-expanded')).toBe('false')
    await act(async () => menuBouton.click())
    expect(menuBouton.getAttribute('aria-expanded')).toBe('true')
    const menu = hote.querySelector('.rg-menu-annuaire')
    expect(menu.textContent).toContain('Horaires')
    expect(menu.textContent).toContain('Voir les pointages')
    expect(menu.textContent).toContain('Mot de passe')
    expect(menu.textContent).toContain('Supprimer la fiche')

    await act(async () => [...menu.querySelectorAll('button')].find((b) => b.textContent.includes('Horaires')).click())
    expect(actions.onHoraires).toHaveBeenCalledTimes(1)
    expect(hote.querySelector('.rg-menu-annuaire')).toBeNull()
  })

  it('signale un portail à migrer sans attendre qu’on ouvre le menu', async () => {
    await rendreEntree({ ancienSysteme: true, portalEnabled: false })
    const compte = hote.querySelector('.rg-annuaire-compte')
    expect(compte.getAttribute('data-etat')).toBe('migrer')
    expect(compte.textContent).toContain('portail à migrer')
  })
})

// ═══════════════════════════════════════════════════════════
// ③ La vue Équipes
// ═══════════════════════════════════════════════════════════

const equipe = (surcharge = {}) => ({
  id: 'eq-1',
  name: 'Maintenance',
  description: 'Ligne de production, poste du matin',
  color: '#2F7F73',
  leader_employee_id: 'emp-1',
  member_count: 2,
  members: [
    { id: 'm1', employee: { id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' } },
    { id: 'm2', employee: { id: 'emp-2', first_name: 'Kossi', last_name: 'Adjovi' } },
  ],
  leader: { id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' },
  health: { health_score: 80, status: 'healthy' },
  ...surcharge,
})

describe('la vue Équipes', () => {
  it('ouvre le registre sur un folio, un titre et un colophon de quatre chiffres', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', member_count: 1, leader_employee_id: null, leader: null, health: { health_score: 40, status: 'warning' } }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    expect(hote.querySelector('.rg-folio').textContent).toContain('En-Check')
    expect(hote.querySelector('.rg-eyebrow').textContent).toContain('Vue d’ensemble')
    expect(hote.querySelector('h2.rg-titre').textContent).toBe('Équipes.')

    const chiffres = [...hote.querySelectorAll('.rg-chiffre')]
    expect(chiffres).toHaveLength(4)
    expect(chiffres.map((c) => c.querySelector('.rg-chiffre-valeur').textContent)).toEqual(['2', '3', '1', '0'])
    expect(chiffres.map((c) => c.querySelector('.rg-chiffre-libelle').textContent)).toEqual(['Équipes', 'Membres', 'Chefs', 'Sans équipe'])
  })

  it('n’écrit que des parts réelles dans le colophon, ou un tiret', async () => {
    etat.equipes = [equipe()]
    await relancer(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const notes = [...hote.querySelectorAll('.rg-chiffre-note')].map((n) => n.textContent.trim())
    expect(notes[0]).toBe('100 % ont des membres')
    expect(notes[1]).toBe('100 % de l’effectif')
    expect(notes[2]).toBe('100 % des équipes')
    // personne hors équipe : la part n'a pas de sens → tiret
    expect(notes[3]).toBe('0 % de l’effectif')

    etat.equipes = []
    await relancer(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const vides = [...hote.querySelectorAll('.rg-chiffre-note')].map((n) => n.textContent.trim())
    expect(vides[1]).toBe('—')
    expect(vides[2]).toBe('—')
    expect(vides[3]).toBe('—')
  })

  it('enfile tout l’effectif sur un collier, la perle du chef cerclée', async () => {
    etat.equipes = [equipe(), equipe({ id: 'eq-2', name: 'Qualité', members: [], member_count: 0, leader: null, leader_employee_id: null, health: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const collier = hote.querySelector('.rg-collier')
    expect(collier, 'collier de l’entreprise').not.toBeNull()
    const groupes = [...collier.querySelectorAll('.rg-collier-groupe')]
    expect(groupes).toHaveLength(2)
    const perles = [...collier.querySelectorAll('.rg-perle')]
    expect(perles).toHaveLength(2)
    expect(perles.map((p) => p.textContent)).toEqual(['AD', 'KA'])
    expect(perles[0].getAttribute('data-chef')).toBe('oui')
    expect(perles[1].getAttribute('data-chef')).toBe('non')
    expect(groupes[1].textContent).toContain('aucun membre')
  })

  it('pose les personnes sans équipe en perles creuses, à part', async () => {
    etat.predictions = true
    etat.orphelins = [{ id: 'emp-9', first_name: 'Rita', last_name: 'Kponou' }]
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const creuses = [...hote.querySelectorAll('.rg-perle[data-creuse="oui"]')]
    expect(creuses).toHaveLength(1)
    expect(creuses[0].textContent).toBe('RK')
    expect(hote.querySelector('.rg-collier-groupe[data-orphelin="oui"]').textContent).toContain('à rattacher')
  })

  it('lit la santé en cinq perles, avec le chiffre juste à côté', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const jauge = hote.querySelector('.rg-sante')
    expect(jauge, 'jauge de santé').not.toBeNull()
    expect(jauge.querySelectorAll('.rg-sante-perle')).toHaveLength(5)
    expect(jauge.querySelectorAll('.rg-sante-perle.is-pleine')).toHaveLength(4)
    expect(jauge.textContent).toContain('80')
    expect(jauge.getAttribute('data-etat')).toBe('solide')
  })

  it('ne mesure pas une santé qu’on n’a pas mesurée', async () => {
    etat.equipes = [equipe({ health: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const jauge = hote.querySelector('.rg-sante')
    expect(jauge.textContent).toContain('Non suivie')
    expect(jauge.querySelectorAll('.rg-sante-perle.is-pleine')).toHaveLength(0)
    expect(jauge.getAttribute('data-etat')).toBe('inconnu')
  })

  it('écrit chaque équipe comme une entrée de registre, numérotée', async () => {
    etat.equipes = [equipe(), equipe({ id: 'eq-2', name: 'Expédition' })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const entrees = [...hote.querySelectorAll('.rg-registre .rg-entree')]
    expect(entrees).toHaveLength(2)
    expect(entrees.map((e) => e.querySelector('.rg-entree-index').textContent)).toEqual(['01', '02'])
    // le registre s'ouvre trié par nom
    expect(entrees.map((e) => e.querySelector('.rg-entree-titre').textContent)).toEqual(['Expédition', 'Maintenance'])
    const maintenance = entrees.find((e) => e.textContent.includes('Maintenance'))
    expect(maintenance.querySelector('.rg-entree-note').textContent).toContain('Ligne de production')
    // le filet de couleur de l'équipe est posé sous sa description
    const filet = maintenance.querySelector('.rg-entree-filet')
    expect(filet).not.toBeNull()
    expect(filet.getAttribute('style')).toContain('--rg-trait-equipe')
    expect(maintenance.querySelectorAll('.rg-membre')).toHaveLength(2)
  })

  it('nomme les personnes au lieu de les réduire à un identifiant', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Maintenance')
    expect(hote.textContent).toContain('chef : Awa Dossou')
    expect(hote.querySelector('.rg-membre[data-chef="oui"]')).not.toBeNull()
  })

  it('n’invente pas de membres quand l’équipe est vide', async () => {
    etat.equipes = [equipe({ members: [], member_count: 0, leader: null, leader_employee_id: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.rg-cellule-membres').textContent).toContain('aucun membre')
    expect(hote.querySelector('.rg-cellule-membres').textContent).toContain('sans chef')
    expect(hote.querySelector('.rg-cellule-membres').querySelector('.rg-membres-note[data-ton="alerte"]')).not.toBeNull()
    expect(hote.querySelector('.rg-membre')).toBeNull()
  })

  it('explique l’absence d’équipes et propose la première', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Aucune équipe pour l’instant')
    expect(boutonAvec('Nouvelle équipe')).toBeTruthy()
    expect(hote.querySelector('[data-testid="rosace-perles"]')).not.toBeNull()
  })

  it('dit clairement quand l’option est éteinte sur la fiche entreprise', async () => {
    etat.equipeAutorisee = false
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Option Équipes non activée')
    expect(hote.textContent).toContain('l’annuaire reste disponible')
  })

  it('demande l’entreprise quand aucune n’est sélectionnée', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 'adm', role: 'super_admin' }))
    await rendre(<EquipesVue enterpriseId={null} employes={[]} />)
    expect(hote.textContent).toContain('Sélectionnez une entreprise')
    expect(hote.textContent).not.toContain('non activée')
  })

  it('ouvre la fenêtre de création depuis la barre d’outils', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[{ id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' }]} />)
    await act(async () => boutonAvec('Nouvelle équipe').click())
    expect(hote.textContent).toContain('Nom *')
  })

  it('filtre, cherche et trie sans quitter le registre', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', member_count: 1, leader_employee_id: null, leader: null }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const filtre = [...hote.querySelectorAll('.rg-filtre')].find((f) => f.textContent === 'Sans chef')
    await act(async () => filtre.click())
    expect([...hote.querySelectorAll('.rg-entree')]).toHaveLength(1)
    expect(hote.querySelector('.rg-entree-titre').textContent).toBe('Expédition')

    await act(async () => [...hote.querySelectorAll('.rg-filtre')].find((f) => f.textContent === 'Toutes').click())
    const champ = hote.querySelector('.rg-recherche input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(champ, 'maint')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect([...hote.querySelectorAll('.rg-entree')]).toHaveLength(1)
    expect(hote.querySelector('.rg-entree-titre').textContent).toBe('Maintenance')
  })

  it('range les décisions dans un pied dépliable, pas dans une bannière qui hurle', async () => {
    etat.predictions = true
    etat.alertes = [{ id: 'a1', severity: 'critical', team_name: 'Maintenance', message: 'Aucun pointage depuis 3 jours' }]
    etat.orphelins = [{ id: 'emp-9', first_name: 'Rita', last_name: 'Kponou' }]
    etat.sante = { global: { avg_health_score: 62 }, parEquipe: [] }
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const pied = hote.querySelector('.rg-pied')
    expect(pied.textContent).toContain('À décider')
    expect(pied.textContent).toContain('2 points à arbitrer')
    // replié : le détail n'est pas déversé sur la page
    expect(pied.textContent).not.toContain('Aucun pointage depuis 3 jours')

    await act(async () => boutonAvec('Ouvrir le registre').click())
    expect(pied.textContent).toContain('Aucun pointage depuis 3 jours')

    const ongletOrphelins = [...pied.querySelectorAll('.rg-pied-onglets button')].find((b) => b.textContent.includes('Sans équipe'))
    await act(async () => ongletOrphelins.click())
    expect(pied.textContent).toContain('Rita Kponou')
  })

  it('dit que les analyses manquent au lieu de faire semblant quand Prédictions est éteint', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.rg-pied').textContent).toContain('Les analyses d’équipe ne sont pas activées')
    expect(hote.textContent).not.toContain('à arbitrer')
  })
})

// ═══════════════════════════════════════════════════════════
// ④ La vue Tâches
// ═══════════════════════════════════════════════════════════

const tache = (surcharge = {}) => ({
  id: 't-1',
  title: 'Vérifier les extincteurs',
  description: '',
  status: 'assigned',
  priority: 'high',
  category_id: 'c-1',
  task_type: 'individual',
  due_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  assigned_employee: { id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' },
  category: { id: 'c-1', name: 'Sécurité', color: '#B4553F' },
  ...surcharge,
})

describe('la vue Tâches', () => {
  it('ouvre le registre sur un titre et quatre chiffres', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    expect(hote.querySelector('h2.rg-titre').textContent).toBe('Tâches.')
    const valeurs = [...hote.querySelectorAll('.rg-chiffre-valeur')].map((v) => v.textContent)
    expect(valeurs).toEqual(['2', '0', '0', '1'])
    expect(hote.querySelectorAll('.rg-chiffre-note')[0].textContent).toBe('dont 1 jamais ouvertes')
  })

  it('range les tâches dans quatre colonnes de registre nommées', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const colonnes = [...hote.querySelectorAll('.rg-colonne')]
    expect(colonnes.map((c) => c.getAttribute('data-colonne'))).toEqual(['a-faire', 'en-cours', 'terminees', 'validees'])
    expect(colonnes.map((c) => c.querySelector('.rg-colonne-titre').textContent)).toEqual(['À faire', 'En cours', 'Terminées', 'Validées'])
    expect(colonnes.map((c) => c.querySelector('.rg-colonne-compte').textContent)).toEqual(['1', '0', '0', '1'])
    // les colonnes vides disent qu'elles le sont, et gardent une invitation
    expect(colonnes[1].textContent).toContain('Rien ici')
    expect(colonnes[1].querySelector('[data-testid="rosace-perles"]')).not.toBeNull()
    expect(colonnes[1].textContent).toContain('ajouter une tâche')
  })

  it('numérote chaque tâche et signe sa priorité d’une perle', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const fiche = hote.querySelector('.rg-fiche')
    expect(fiche).not.toBeNull()
    expect(fiche.getAttribute('data-priorite')).toBe('high')
    expect(fiche.querySelector('.rg-fiche-num').textContent).toBe('01')
    expect(fiche.querySelector('.rg-fiche-titre').textContent).toBe('Vérifier les extincteurs')
    expect(fiche.querySelector('.rg-fiche-perle')).not.toBeNull()
    expect(fiche.querySelector('.rg-personne').textContent).toContain('Awa Dossou')
  })

  it('écrit la priorité, la catégorie et l’échéance en français, en clair', async () => {
    etat.taches = [tache({ due_at: new Date(Date.now() - 3 * 86400000 - 3600000).toISOString() })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const meta = hote.querySelector('.rg-fiche-meta').textContent
    expect(meta).toContain('Haute')
    expect(meta).toContain('Sécurité')
    expect(meta).toMatch(/retard de \d+ j/)
  })

  it('déplace une tâche d’une colonne à l’autre en changeant son statut', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const colonneValidees = [...hote.querySelectorAll('.rg-colonne')].find((c) => c.textContent.includes('Validées'))
    const evenement = new Event('drop', { bubbles: true })
    Object.defineProperty(evenement, 'dataTransfer', { value: { getData: () => 't-1' } })
    await act(async () => colonneValidees.dispatchEvent(evenement))
    expect(appels).toContainEqual({ type: 'updateTask', id: 't-1', champs: { status: 'validated' } })
  })

  it('sélectionne puis vide une sélection sans toucher aux tâches', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const caseTache = hote.querySelector('.rg-fiche .rg-case')
    await act(async () => caseTache.click())
    expect(hote.textContent).toContain('1 tâche sélectionnée')
    await act(async () => boutonAvec('Vider la sélection').click())
    expect(hote.textContent).not.toContain('tâche sélectionnée')
    expect(appels.filter((a) => a.type === 'updateTask')).toHaveLength(0)
  })

  it('bascule en liste et relit l’état de chaque tâche', async () => {
    etat.taches = [tache({ status: 'in_progress' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    await act(async () => [...hote.querySelectorAll('.rg-filtres button')].find((b) => b.textContent.includes('Liste')).click())
    expect(hote.querySelector('.rg-ligne')).not.toBeNull()
    expect(hote.textContent).toContain('En cours · Sécurité')
  })

  it('affiche les catégories avec leur effectif et permet de filtrer', async () => {
    etat.categories = [{ id: 'c-1', name: 'Sécurité', color: '#B4553F' }]
    etat.taches = [tache(), tache({ id: 't-2', title: 'Autre' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const puce = [...hote.querySelectorAll('.rg-categories .rg-categorie')].find((b) => b.textContent.includes('Sécurité'))
    expect(puce, 'catégorie').not.toBeNull()
    expect(puce.textContent).toContain('2')
    await act(async () => puce.click())
    expect(hote.querySelectorAll('.rg-fiche')).toHaveLength(2)
    expect(hote.querySelector('.rg-categorie[aria-pressed="true"]')).not.toBeNull()
  })

  it('explique l’absence de tâches et propose la première', async () => {
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Aucune tâche pour l’instant')
    expect(boutonAvec('Nouvelle tâche')).toBeTruthy()
  })

  it('demande l’entreprise plutôt que d’annoncer une option éteinte', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 'adm', role: 'super_admin' }))
    await rendre(<TachesVue enterpriseId={null} employes={[]} />)
    expect(hote.textContent).toContain('Sélectionnez une entreprise')
    expect(hote.textContent).not.toContain('non activée')
  })

  it('dit que l’option est éteinte au lieu de laisser un écran vide', async () => {
    etat.tacheAutorisee = false
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Option Équipes et tâches non activée')
  })
})

// ═══════════════════════════════════════════════════════════
// ⑤ Le ton et le dessin
// ═══════════════════════════════════════════════════════════

const lireJeton = (nom, source = CSS) => {
  const trouve = new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(source)
  expect(trouve, nom).not.toBeNull()
  return trouve[1]
}
const luminance = (hex) => {
  const canaux = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lineaire = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lineaire[0] + 0.7152 * lineaire[1] + 0.0722 * lineaire[2]
}
const contraste = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

describe('le ton et le dessin', () => {
  it('ouvre chaque vue sur un feuillet, pas sur une carte', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.rg-folio')).not.toBeNull()
    expect(hote.querySelector('h2.rg-titre').tagName).toBe('H2')
    expect(hote.querySelector('.rg-titre span').textContent).toBe('.')
    // le titre est du texte, pas une image ni une icône
    expect(hote.querySelector('.rg-tete img')).toBeNull()
    expect(hote.querySelector('.rg-tete svg')).toBeNull()

    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('h2.rg-titre').textContent).toBe('Tâches.')
    expect(hote.querySelector('.rg-colophon')).not.toBeNull()
  })

  it('trace le registre au filet, sans carte blanche à coin arrondi', () => {
    // une entrée d'équipe et une entrée de tâche : un filet bas, pas une boîte
    const regle = (selecteur) => {
      const trouve = new RegExp(`${selecteur.replace('.', '\\.')} \\{[^}]*\\}`).exec(CSS)
      expect(trouve, selecteur).not.toBeNull()
      return trouve[0]
    }
    const entree = regle('.rg-entree')
    expect(entree).toContain('border-bottom')
    expect(entree).not.toContain('border-radius')
    expect(entree).not.toContain('background:')

    const fiche = regle('.rg-fiche')
    expect(fiche).toContain('border-bottom')
    expect(fiche).not.toContain('border-radius')
    expect(fiche).not.toContain('background:')
    expect(CSS).not.toMatch(/\.rg-fiche \{[^}]*box-shadow: 0 /)
  })

  it('perle la tranche des colonnes, du titre jusqu’au dernier filet', () => {
    expect(CSS).toMatch(/\.rg-colonne-corps::before \{[^}]*radial-gradient\(circle at/)
    expect(CSS).toMatch(/\.rg-colonne-corps::before \{[^}]*background-size: 8px 15px/)
    // la tranche suit la hauteur des entrées, elle ne tire pas un fil vide
    expect(CSS).toMatch(/\.rg-colonne-corps::before \{[^}]*bottom: 6px/)
    // la tranche du registre est perlée elle aussi
    expect(CSS).toMatch(/\.emp-vues::before \{[^}]*radial-gradient\(circle at/)
    // quatre tons, un par colonne
    for (const colonne of ['a-faire', 'en-cours', 'terminees', 'validees']) {
      expect(CSS).toContain(`.rg-colonne[data-colonne='${colonne}']`)
    }
  })

  it('dessine l’échéance en perles, une perle par jour qui reste', async () => {
    etat.taches = [
      tache({ id: 't-1', due_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString() }),
      tache({ id: 't-2', title: 'Relancer le fournisseur', due_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() }),
    ]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const colliers = [...hote.querySelectorAll('[data-testid="collier-echeance"]')]
    expect(colliers).toHaveLength(2)
    const avenir = colliers.find((c) => c.getAttribute('data-etat') === 'a-venir')
    const retard = colliers.find((c) => c.getAttribute('data-etat') === 'retard')
    expect(avenir.getAttribute('data-jours')).toBe('6')
    expect(avenir.querySelectorAll('circle').length).toBeGreaterThanOrEqual(6)
    expect(retard.getAttribute('data-jours')).toBe('-4')
    // le retard garde la phrase qui le chiffre : le dessin ne remplace pas le texte
    expect(hote.textContent).toMatch(/retard de \d+ j/)
    expect([...hote.querySelectorAll('[data-testid="collier-echeance"]')].every((c) => c.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('dit, au tableau, que des tâches refusées ne sont pas affichées', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Reprise à faire', status: 'rejected' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('1 tâche refusée ou annulée ne figure pas au tableau')
  })

  it('ne met aucun mot d’atelier dans les textes lus', async () => {
    etat.equipes = [equipe()]
    etat.taches = [tache({ status: 'in_progress' })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const texteEquipes = hote.textContent
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const texteTaches = hote.textContent
    for (const texte of [texteEquipes, texteTaches]) {
      expect(texte).not.toMatch(/pagne|teint|métier à perles|collier de perles|atelier/i)
    }
  })

  it('n’éclaircit ni ne colore un texte au survol', () => {
    const regles = CSS.match(/[^{}]*:hover[^{}]*\{[^}]*\}/g) || []
    expect(regles.length).toBeGreaterThan(5)
    for (const regle of regles) {
      const corps = regle.slice(regle.indexOf('{') + 1)
      expect(corps, regle).not.toMatch(/(^|;)\s*background(-color)?\s*:/)
      expect(corps, regle).not.toMatch(/(^|;)\s*opacity\s*:/)
      expect(corps.replace(/border-color\s*:/g, ''), regle).not.toMatch(/(^|;)\s*color\s*:/)
    }
  })

  it('garde des cibles de doigt assez grandes', () => {
    expect(CSS).toMatch(/\.emp-onglet \{[^}]*min-height: 44px/)
    expect(CSS).toMatch(/\.rg-primaire \{[^}]*min-height: 42px/)
    expect(CSS).toMatch(/\.rg-lien \{[^}]*min-height: 40px/)
  })

  it('donne un texte lisible sur le papier, dans les deux thèmes', () => {
    const papier = lireJeton('--rg-paper')
    expect(contraste(lireJeton('--rg-ink'), papier)).toBeGreaterThan(7)
    expect(contraste(lireJeton('--rg-soft'), papier)).toBeGreaterThan(4.5)
    expect(contraste(lireJeton('--rg-faint'), papier)).toBeGreaterThan(4.5)
    expect(contraste(lireJeton('--rg-copper'), papier)).toBeGreaterThan(4.5)
    // le bouton de cuivre porte du texte clair
    expect(contraste(lireJeton('--rg-sur-copper'), lireJeton('--rg-copper-fort'))).toBeGreaterThan(4.5)

    const sombre = CSS.slice(CSS.indexOf("[data-theme='dark']"))
    const nuit = lireJeton('--rg-paper', sombre)
    // dans le thème sombre, le papier reste décrit sous ses trois noms
    expect(nuit).toBeTruthy()
    const encreNuit = /--rg-ink:\s*(#[0-9a-fA-F]{6})/.exec(CSS.slice(CSS.indexOf("[data-theme='dark']"), CSS.indexOf("[data-theme='dark']") + 900))[1]
    expect(contraste(encreNuit, nuit)).toBeGreaterThan(7)
  })

  it('pose les initiales en encre sombre sur toutes les perles', () => {
    expect(CSS).toMatch(/\.rg-perle \{[^}]*color: #241a12/)
    for (const ton of ['creme', 'cuivre', 'teal', 'sauge', 'corail']) {
      expect(CSS).toContain(`--rg-perle-${ton}:`)
    }
    expect(CSS).not.toMatch(/-webkit-background-clip:\s*text/)
  })

  it('n’a plus de vocabulaire de l’ancienne scène', () => {
    for (const mort of ['.zl-scene', '.zl-medaillon', '.zl-bouton', '.zl-carte-tache', '.zl-frise', '.zl-collier-onglet', '.zl-sante-perle']) {
      expect(CSS, mort).not.toContain(mort)
    }
    for (const mort of ['zl-scene', 'zl-medaillon', 'zl-carte-tache', 'FrisePerlesSvg', 'AnneauPerlesSvg']) {
      expect(EMPLOYES, mort).not.toContain(mort)
    }
  })
})

// ═══════════════════════════════════════════════════════════
// ⑥ La page entière : trois vues dans une seule coque
// ═══════════════════════════════════════════════════════════

describe('la page Employés', () => {
  const monterPage = async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) {
      await act(async () => { await Promise.resolve() })
    }
  }

  it('ouvre l’annuaire et montre les trois vues dans la même barre', async () => {
    await monterPage()
    const onglets = [...hote.querySelectorAll('.emp-onglet')].map((o) => o.textContent.trim())
    expect(onglets).toEqual(['Annuaire', 'Équipes', 'Tâches'])
    const actif = hote.querySelector('.emp-onglet[aria-current="page"]')
    expect(actif.textContent.trim()).toBe('Annuaire')
    // l'annuaire s'ouvre sur le même feuillet que les deux autres vues
    expect(hote.querySelector('h2.rg-titre').textContent).toBe('Annuaire.')
    expect(hote.querySelector('.rg-folio').textContent).toContain('En-Check')
  })

  it('passe aux équipes et aux tâches sans quitter la page', async () => {
    await monterPage()
    await act(async () => [...hote.querySelectorAll('.emp-onglet')].find((o) => o.textContent.includes('Équipes')).click())
    expect(hote.querySelector('.emp-onglet[aria-current="page"]').textContent.trim()).toBe('Équipes')
    expect(hote.textContent).toContain('Nouvelle équipe')
    expect(hote.querySelector('.rg-annuaire')).toBeNull()

    await act(async () => [...hote.querySelectorAll('.emp-onglet')].find((o) => o.textContent.includes('Tâches')).click())
    expect(hote.querySelector('.emp-onglet[aria-current="page"]').textContent.trim()).toBe('Tâches')
    expect(hote.textContent).toContain('Nouvelle tâche')
  })

  it('n’accroche pas un trait de points après le dernier onglet', () => {
    expect(EMPLOYES).not.toContain('emp-onglets-fil')
    expect(CSS).not.toContain('.emp-onglets-fil')
    expect(EMPLOYES).toContain('<p className="emp-onglets-titre">Sommaire</p>')
    expect(CSS).toMatch(/\.emp-onglets \{[^}]*border-bottom: 1px solid var\(--pt-line\)/)
    expect(CSS).toMatch(/\.emp-onglet\[aria-current='page'\] \{[^}]*border-bottom-color/)
    expect(CSS).not.toContain('.emp-onglet::before')
  })

  it('ne met qu’une seule bande de raccourcis de pages sur la page', () => {
    const enTete = readFileSync('src/components/EmployesAfroTechSections.jsx', 'utf8')
    expect(enTete).not.toContain('pointages-quick-nav')
    expect(EMPLOYES).toContain("<RaccourcisPages compact excludePaths={['/employes']} />")
  })

  it('sépare les chiffres par un filet, pas par un point de texte', () => {
    expect(CSS).toMatch(/\.rg-chiffre \+ \.rg-chiffre \{[^}]*border-left/)
    expect(CSS).toMatch(/\.rg-chiffre-valeur \{[^}]*font-family: Georgia/)
    expect(CSS).toMatch(/\.rg-chiffre-valeur \{[^}]*tabular-nums/)
  })

  it('chiffre chaque vue par une part, jamais par une phrase creuse', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const notes = [...hote.querySelectorAll('.rg-chiffre-note')].map((n) => n.textContent.trim())
    expect(notes).toEqual(['dont 1 jamais ouvertes', '0 % du registre', '0 % du registre', '50 % du registre'])
  })

  it('garde les raccourcis de pages en haut à droite, jamais en bas', async () => {
    await monterPage()
    const raccourcis = hote.querySelector('[data-testid="raccourcis-pages"]')
    expect(raccourcis).not.toBeNull()
    expect(raccourcis.querySelector('a[href="/pointages"]')).not.toBeNull()
    expect(raccourcis.querySelector('a[href="/employes"]')).toBeNull()

    // ils vivent dans la barre du haut, avec les onglets
    const barre = hote.querySelector('.emp-barre')
    expect(barre).not.toBeNull()
    expect(barre.querySelector('[data-testid="raccourcis-pages"]')).not.toBeNull()
    expect(barre.querySelector('.emp-onglets')).not.toBeNull()

    // et avant le contenu de la vue, pas après
    const vue = hote.querySelector('.rg-annuaire')
    expect(vue).not.toBeNull()
    expect(barre.compareDocumentPosition(vue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // aucun second bandeau de raccourcis plus bas
    expect(hote.querySelectorAll('[data-testid="raccourcis-pages"]')).toHaveLength(1)
  })

  it('n’a plus de cartes de chiffres ni de portraits à la place du registre', () => {
    expect(EMPLOYES).not.toContain('employes-portrait-grid')
    expect(EMPLOYES).not.toContain('EmployesPortraitCard')
    expect(EMPLOYES).not.toContain('EmployesExecutiveKpis')
    expect(EMPLOYES).not.toContain('EmployesAnalyticsCharts')
    const sections = readFileSync('src/components/EmployesAfroTechSections.jsx', 'utf8')
    expect(sections).not.toContain('EmployesExecutiveKpis')
    expect(sections).not.toContain('employes-framed-card')
  })

  it('tient tous les raccourcis dans la barre haute, entre les onglets et le registre', () => {
    const barre = EMPLOYES.indexOf('<div className="emp-barre-raccourcis">')
    const registre = EMPLOYES.indexOf('<div className="emp-vues rg-annuaire">')
    expect(barre).toBeGreaterThan(0)
    expect(registre).toBeGreaterThan(barre)
    // plus aucun raccourci après les vues
    const apresVues = EMPLOYES.indexOf('<RaccourcisPages', registre)
    expect(apresVues).toBe(-1)
  })
})
