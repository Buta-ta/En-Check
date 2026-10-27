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
//   · le motif perles zoulou est un vocabulaire visuel, pas un
//     jargon : aucun mot d'atelier dans les textes lus ;
//   · un survol change le trait, jamais le fond derrière un
//     texte, la couleur d'un texte ni l'opacité d'un champ ;
//   · déplacer une carte sur le tableau change vraiment le
//     statut de la tâche, et pas seulement son apparence.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync, existsSync } from 'node:fs'

import { ThemeProvider } from '../../contexts/ThemeContext'
import Employes from '../../pages/Employes'
import EquipesVue from '../../components/equipes/EquipesVue'
import TachesVue from '../../components/taches/TachesVue'

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
  getStatusLabel: (s) => ({ assigned: 'Assignée', seen: 'Vue', in_progress: 'En cours', paused: 'En pause', completed: 'Terminée', validated: 'Validée' }[s] || s),
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

// ═══════════════════════════════════════════════════════════
// ① Le menu et les adresses
// ═══════════════════════════════════════════════════════════

describe('le menu et les adresses', () => {
  it('ne propose plus Équipes ni Tâches comme entrées séparées', () => {
    expect(MENU).not.toContain("path: '/equipes'")
    expect(MENU).not.toContain("path: '/taches'")
    // l'entrée « Équipe » de la section Aujourd'hui ouvre toujours l'annuaire
    expect(MENU).toContain("label: 'Équipe', icon: Users, path: '/employes'")
  })

  it('range la commande rapide sur la vue Équipes, dans la même page', () => {
    expect(MENU).toContain("path: '/employes?vue=equipes'")
    expect(MENU).toContain('Gérer les équipes et les tâches')
  })

  it('garde les anciennes adresses vivantes en les renvoyant vers la bonne vue', () => {
    expect(APP).toContain('path="/equipes" element={<Navigate to="/employes?vue=equipes" replace />}')
    expect(APP).toContain('path="/taches" element={<Navigate to="/employes?vue=taches" replace />}')
    expect(APP).not.toContain("pages/Teams")
    expect(APP).not.toContain("pages/Tasks")
  })

  it('n’a plus deux pages à maintenir', () => {
    expect(existsSync('src/pages/Teams.jsx')).toBe(false)
    expect(existsSync('src/pages/Tasks.jsx')).toBe(false)
  })

  it('ne verrouille plus une adresse qui n’existe plus', () => {
    expect(VERROU).not.toContain("'/equipes'")
    expect(VERROU).not.toContain("'/taches'")
    // l'option elle-même garde son nom, pour la fiche entreprise
    expect(VERROU).toContain("module_taches: 'Équipes et tâches'")
  })
})

// ═══════════════════════════════════════════════════════════
// ② Les onglets de la page Employés
// ═══════════════════════════════════════════════════════════

describe('les onglets de la page Employés', () => {
  it('porte les trois vues et l’adresse qui va avec', () => {
    expect(EMPLOYES).toContain("libelle: 'Annuaire'")
    expect(EMPLOYES).toContain("libelle: 'Équipes'")
    expect(EMPLOYES).toContain("libelle: 'Tâches'")
    expect(EMPLOYES).toContain("setSearchParams(cle === 'annuaire' ? {} : { vue: cle }, { replace: true })")
    expect(EMPLOYES).toContain('<EquipesVue enterpriseId={entrepriseDesVues} employes={employes} />')
    expect(EMPLOYES).toContain('<TachesVue enterpriseId={entrepriseDesVues} employes={employes} />')
  })

  it('ne montre pas une porte qui ne mène nulle part quand l’option est éteinte', () => {
    expect(EMPLOYES).toContain("const vueAutorisee = moduleTaches || admin?.role === 'super_admin'")
    expect(EMPLOYES).toContain("? [\n                  { cle: 'equipes'")
  })

  it('garde l’annuaire comme vue d’entrée, même avec une adresse inconnue', () => {
    expect(EMPLOYES).toContain("vueDemandee === 'equipes' || vueDemandee === 'taches'")
    expect(EMPLOYES).toContain("    : 'annuaire'")
  })

  it('embarque les raccourcis de pages de la coque refondue', () => {
    expect(EMPLOYES).toContain("<RaccourcisPages compact excludePaths={['/employes']} />")
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
  it('compte les équipes, les membres et les chefs dans la même phrase', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', member_count: 1, leader_employee_id: null, leader: null, health: { health_score: 40, status: 'warning' } }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('2 équipes · 3 membres · 1 chef d’équipe désigné')
  })

  it('lit la santé en perles, pas en pourcentage nu', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const jauge = hote.querySelector('.zl-sante')
    expect(jauge, 'jauge de santé').not.toBeNull()
    expect(jauge.querySelectorAll('.zl-sante-perle.is-pleine')).toHaveLength(4)
    expect(jauge.textContent).toContain('80%')
  })

  it('nomme les personnes au lieu de les réduire à un identifiant', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Maintenance')
    expect(hote.textContent).toContain('Chef : Awa Dossou')
    expect(hote.querySelector('.zl-perle-avatar.is-chef')).not.toBeNull()
  })

  it('n’invente pas de membres quand l’équipe est vide', async () => {
    etat.equipes = [equipe({ members: [], member_count: 0, leader: null, leader_employee_id: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Aucun membre pour l’instant')
    expect(hote.querySelector('.zl-perle-avatar')).toBeNull()
  })

  it('explique l’absence d’équipes et propose la première', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Aucune équipe pour l’instant')
    const boutons = [...hote.querySelectorAll('button')].map((b) => b.textContent)
    expect(boutons.filter((t) => t.includes('Nouvelle équipe')).length).toBeGreaterThanOrEqual(2)
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

  it('ouvre la fenêtre de création depuis l’en-tête', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[{ id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' }]} />)
    const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent.includes('Nouvelle équipe'))
    await act(async () => bouton.click())
    expect(hote.textContent).toContain('Nom *')
  })

  it('range les décisions dans un collier dépliable, pas dans une bannière qui hurle', async () => {
    etat.predictions = true
    etat.alertes = [{ id: 'a1', severity: 'critical', team_name: 'Maintenance', message: 'Aucun pointage depuis 3 jours' }]
    etat.orphelins = [{ id: 'emp-9', first_name: 'Rita', last_name: 'Kponou', suggested_teams: [{ id: 'eq-1', name: 'Maintenance', color: '#2F7F73' }] }]
    etat.sante = { global: { avg_health_score: 62, healthy_teams: 1, warning_teams: 1, critical_teams: 0 }, parEquipe: [] }
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    expect(hote.textContent).toContain('À décider')
    expect(hote.textContent).toContain('Aucun pointage depuis 3 jours')

    const ongletOrphelins = [...hote.querySelectorAll('.zl-collier-onglet')].find((b) => b.textContent.includes('Sans équipe'))
    await act(async () => ongletOrphelins.click())
    expect(hote.textContent).toContain('Rita Kponou')
    expect(hote.textContent).toContain('Maintenance')
  })

  it('dit que les analyses manquent au lieu de faire semblant quand Prédictions est éteint', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('quand')
    expect(hote.textContent).toContain('l’option Prédictions est allumée')
    expect(hote.textContent).not.toContain('Santé moyenne')
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
  due_at: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  assigned_employee: { id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' },
  category: { id: 'c-1', name: 'Sécurité', color: '#B4553F' },
  ...surcharge,
})

describe('la vue Tâches', () => {
  it('range les tâches dans quatre colonnes nommées', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const colonnes = [...hote.querySelectorAll('.zl-colonne-titre')].map((c) => c.textContent.trim())
    expect(colonnes).toEqual(['À faire', 'En cours', 'Terminées', 'Validées'])
    expect(hote.textContent).toContain('2 tâches · 0 en cours')
  })

  it('écrit la priorité et l’échéance en français, en clair', async () => {
    etat.taches = [tache({ due_at: new Date(Date.now() - 3 * 86400000).toISOString() })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const etiquettes = [...hote.querySelectorAll('.zl-carte-tache .zl-etiquette')].map((e) => e.textContent.trim())
    expect(etiquettes).toContain('Haute')
    expect(hote.textContent).toMatch(/En retard de \d+j/)
    expect(hote.textContent).toContain('Sécurité')
  })

  it('déplace une tâche d’une colonne à l’autre en changeant son statut', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const colonneValidees = [...hote.querySelectorAll('.zl-colonne')].find((c) => c.textContent.includes('Validées'))
    const evenement = new Event('drop', { bubbles: true })
    Object.defineProperty(evenement, 'dataTransfer', { value: { getData: () => 't-1' } })
    await act(async () => colonneValidees.dispatchEvent(evenement))
    expect(appels).toContainEqual({ type: 'updateTask', id: 't-1', champs: { status: 'validated' } })
  })

  it('sélectionne puis vide une sélection sans toucher aux tâches', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const caseTache = hote.querySelector('.zl-carte-tache .zl-case')
    await act(async () => caseTache.click())
    expect(hote.textContent).toContain('1 tâche sélectionnée')
    const vider = [...hote.querySelectorAll('button')].find((b) => b.textContent.includes('Vider la sélection'))
    await act(async () => vider.click())
    expect(hote.textContent).not.toContain('tâche sélectionnée')
    expect(appels.filter((a) => a.type === 'updateTask')).toHaveLength(0)
  })

  it('bascule en liste et relit l’état de chaque tâche', async () => {
    etat.taches = [tache({ status: 'in_progress' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const boutonListe = [...hote.querySelectorAll('.zl-bascule button')].find((b) => b.textContent.includes('Liste'))
    await act(async () => boutonListe.click())
    expect(hote.querySelector('.zl-tache-ligne')).not.toBeNull()
    expect(hote.textContent).toContain('En cours · Sécurité')
  })

  it('affiche les catégories avec leur effectif et permet de filtrer', async () => {
    etat.categories = [{ id: 'c-1', name: 'Sécurité', color: '#B4553F' }]
    etat.taches = [tache(), tache({ id: 't-2', title: 'Autre' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const puce = [...hote.querySelectorAll('.zl-categories .zl-puce')].find((b) => b.textContent.includes('Sécurité'))
    expect(puce, 'puce catégorie').not.toBeNull()
    expect(puce.textContent).toContain('2')
    await act(async () => puce.click())
    expect(hote.textContent).toContain('2 tâches affichées')
  })

  it('explique l’absence de tâches et propose la première', async () => {
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Aucune tâche pour l’instant')
    expect([...hote.querySelectorAll('button')].some((b) => b.textContent.includes('Nouvelle tâche'))).toBe(true)
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

describe('le ton et le dessin', () => {
  it('ouvre chaque vue sur une scène en drap, avec sa frise et son titre', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const scene = hote.querySelector('.zl-scene')
    expect(scene, 'scène Équipes').not.toBeNull()
    expect(scene.querySelector('[data-testid="frise-perles"]')).not.toBeNull()
    expect(scene.querySelector('.zl-scene-titre').textContent).toBe('Équipes.')
    expect(scene.querySelector('.zl-scene-titre').tagName).toBe('H2')
    // la frise est un dessin, pas une photographie ni une police d'icônes
    expect(scene.querySelector('img')).toBeNull()
    expect(scene.querySelector('[data-testid="frise-perles"]').getAttribute('aria-hidden')).toBe('true')

    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const sceneTaches = hote.querySelector('.zl-scene')
    expect(sceneTaches).not.toBeNull()
    expect(sceneTaches.querySelector('[data-testid="frise-perles"]').getAttribute('data-motif')).toBe('zigzag')
    expect(sceneTaches.querySelector('.zl-scene-titre').textContent).toBe('Tâches.')
  })

  it('donne à chaque chiffre son anneau de perles, rempli d’une proportion réelle', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', member_count: 1, leader_employee_id: null, leader: null }),
      equipe({ id: 'eq-3', name: 'Qualité', member_count: 0, members: [], leader_employee_id: null, leader: null }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const medaillons = [...hote.querySelectorAll('.zl-medaillon')]
    expect(medaillons).toHaveLength(4)
    for (const m of medaillons) {
      const anneau = m.querySelector('[data-testid="anneau-perles"]')
      expect(anneau, m.textContent).not.toBeNull()
      expect(Number(anneau.dataset.parts)).toBe(26)
      const remplis = Number(anneau.dataset.remplis)
      expect(remplis).toBeGreaterThanOrEqual(0)
      expect(remplis).toBeLessThanOrEqual(26)
    }
    // « Chefs d’équipe » : une équipe sur trois → 9 perles pleines
    const chefs = medaillons.find((m) => m.textContent.includes('Chefs d’équipe'))
    expect(Number(chefs.querySelector('[data-testid="anneau-perles"]').dataset.remplis)).toBe(9)
  })

  it('ne mesure pas une santé qu’on n’a pas mesurée', async () => {
    etat.equipes = [equipe({ health: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const jauge = hote.querySelector('.zl-sante')
    expect(jauge.textContent).toContain('Non suivie')
    expect(jauge.querySelectorAll('.zl-sante-perle.is-pleine')).toHaveLength(0)
    expect(jauge.getAttribute('data-etat')).toBe('inconnu')
  })

  it('pose les chiffres sur le drap, pas sur des cartes blanches', async () => {
    // le défaut reproché au premier jet : quatre panneaux blancs sous la scène
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const scene = hote.querySelector('.zl-scene')
    expect(scene.querySelector('.zl-medaillons'), 'médaillons dans la scène').not.toBeNull()
    expect(hote.querySelectorAll('.zl-scene > .zl-medaillons')).toHaveLength(1)

    expect(CSS).toMatch(/\.zl-medaillon \{[^}]*background: transparent/)
    expect(CSS).toMatch(/\.zl-scene \{[^}]*#241a12/)
    expect(CSS).toMatch(/\.zl-scene-titre \{[^}]*Georgia/)
  })

  it('garde le texte de la scène lisible sur le drap, quelle que soit la page', () => {
    const lire = (nom) => {
      const trouve = new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)
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
    expect(contraste(lire('--zl-scene-encre'), lire('--zl-scene-fond'))).toBeGreaterThan(7)
    expect(contraste(lire('--zl-scene-douce'), lire('--zl-scene-fond'))).toBeGreaterThan(4.5)
    expect(contraste(lire('--zl-scene-cuivre'), lire('--zl-scene-fond'))).toBeGreaterThan(4.5)
  })

  it('dessine l’échéance en perles, une perle par jour qui reste', async () => {
    etat.taches = [
      tache({ id: 't-1', due_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString() }),
      tache({ id: 't-2', title: 'Relancer le fournisseur', due_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() }),
    ]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const colliers = [...hote.querySelectorAll('[data-testid="collier-echeance"]')]
    expect(colliers).toHaveLength(2)
    // le tableau est trié par échéance : la plus urgente d'abord
    const avenir = colliers.find((c) => c.getAttribute('data-etat') === 'a-venir')
    const retard = colliers.find((c) => c.getAttribute('data-etat') === 'retard')
    expect(avenir.getAttribute('data-etat')).toBe('a-venir')
    expect(avenir.getAttribute('data-jours')).toBe('6')
    expect(avenir.querySelectorAll('circle').length).toBeGreaterThanOrEqual(6)
    expect(retard.getAttribute('data-etat')).toBe('retard')
    expect(retard.getAttribute('data-jours')).toBe('-4')
    // le retard garde le texte qui chiffre le retard : le dessin ne remplace pas la phrase
    expect(hote.textContent).toMatch(/En retard de \d+j/)
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
      expect(texte).not.toMatch(/pagne|teint|bande|atelier|métier à perles|collier/i)
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
    expect(CSS).toContain('.emp-onglet {')
    expect(CSS).toMatch(/\.emp-onglet \{[^}]*min-height: 44px/)
    expect(CSS).toMatch(/\.zl-bouton \{[^}]*min-height: 40px/)
  })

  it('donne un texte lisible sur les fonds de la page, dans les deux thèmes', () => {
    const lire = (nom) => {
      const trouve = new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)
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
    // thème clair : encre sur surface, et texte de bouton sur cuivre plein
    expect(contraste('#231911', '#ffffff')).toBeGreaterThan(4.5)
    expect(contraste(lire('--zl-sur-cuivre'), lire('--zl-cuivre-fort'))).toBeGreaterThan(4.5)
    // thème sombre : les mêmes deux couples
    const sombre = CSS.slice(CSS.indexOf("[data-theme='dark']"))
    const lireSombre = (nom) => {
      const trouve = new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(sombre)
      expect(trouve, nom).not.toBeNull()
      return trouve[1]
    }
    expect(contraste('#f7efe4', '#201a15')).toBeGreaterThan(4.5)
    expect(contraste(lireSombre('--zl-sur-cuivre'), lireSombre('--zl-cuivre-fort'))).toBeGreaterThan(4.5)

    // les initiales dans les perles : encre sombre sur verre clair, dans les deux thèmes
    const verres = ['--zl-perle-creme', '--zl-perle-cuivre', '--zl-perle-teal', '--zl-perle-sauge', '--zl-perle-corail']
    for (const verre of verres) {
      expect(contraste('#241a12', lire(verre)), verre).toBeGreaterThan(4.5)
      expect(contraste('#241a12', lireSombre(verre)), verre).toBeGreaterThan(4.5)
    }
    // les initiales posées dans une perle-avatar gardent l'encre sombre
    expect(CSS).toMatch(/\.zl-perle-avatar \{[^}]*color: #241a12/)

    // et le texte des médaillons reste lisible sur la surface de la carte
    const surSurface = (nom, fond) => {
      const trouve = new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)
      expect(trouve, nom).not.toBeNull()
      return trouve[1]
    }
    expect(contraste(surSurface('--zl-douce', ''), '#f4ede2')).toBeGreaterThan(4.5)
    expect(contraste(surSurface('--zl-faible', ''), '#f4ede2')).toBeGreaterThan(4.5)
    const douceSombre = /--zl-douce:\s*(#[0-9a-fA-F]{6})/.exec(CSS.slice(CSS.indexOf("[data-theme='dark']")))
    expect(douceSombre).not.toBeNull()
    expect(contraste(douceSombre[1], '#2a221c')).toBeGreaterThan(4.5)
  })

  it('dessine les perles sans image et sans dépendre d’un dégradé de texte', () => {
    expect(CSS).toContain('border-radius: 50%')
    expect(CSS).toContain('radial-gradient(circle at 34% 30%')
    expect(CSS).not.toMatch(/-webkit-background-clip:\s*text/)
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
    // laisser les lectures de l'annuaire se terminer
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
    expect(hote.textContent).toContain('Annuaire des Employés')
  })

  it('passe aux équipes et aux tâches sans quitter la page', async () => {
    await monterPage()
    const ongletEquipes = [...hote.querySelectorAll('.emp-onglet')].find((o) => o.textContent.includes('Équipes'))
    await act(async () => ongletEquipes.click())
    expect(hote.querySelector('.emp-onglet[aria-current="page"]').textContent.trim()).toBe('Équipes')
    expect(hote.textContent).toContain('Nouvelle équipe')
    expect(hote.textContent).not.toContain('Annuaire des Employés')

    const ongletTaches = [...hote.querySelectorAll('.emp-onglet')].find((o) => o.textContent.includes('Tâches'))
    await act(async () => ongletTaches.click())
    expect(hote.querySelector('.emp-onglet[aria-current="page"]').textContent.trim()).toBe('Tâches')
    expect(hote.textContent).toContain('Nouvelle tâche')
  })

  it('garde les raccourcis de pages sous les trois vues', async () => {
    await monterPage()
    const raccourcis = hote.querySelector('[data-testid="raccourcis-pages"]')
    expect(raccourcis).not.toBeNull()
    expect(raccourcis.querySelector('a[href="/pointages"]')).not.toBeNull()
    // on est déjà sur Employés : le raccourci ne renvoie pas vers soi-même
    expect(raccourcis.querySelector('a[href="/employes"]')).toBeNull()
  })
})
