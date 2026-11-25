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
//   · la vue Équipes est en cartes à bordure colorée, comme dans
//     la maquette : quatre chiffres, un rail, un pied replié ;
//   · aucun jargon d'atelier dans les textes lus ;
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
import { readFileSync, existsSync } from 'node:fs'

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
const REFONTE_CSS = readFileSync('src/pages/EmployesRefonte.css', 'utf8')
const EQT_CSS = readFileSync('src/pages/EquipesTaches.css', 'utf8')

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
  // la fiche de tâche : lue par le parent, écrite par le parent
  getTaskById: async (id) => {
    appels.push({ type: 'getTaskById', id })
    if (etat.erreurFiche) return { data: null, error: etat.erreurFiche }
    return { data: etat.fiche ? { ...etat.fiche, id } : null }
  },
  validateTask: async (id, _adminId, commentaire) => { appels.push({ type: 'validateTask', id, commentaire }); return { error: null } },
  rejectTask: async (id, _adminId, motif) => { appels.push({ type: 'rejectTask', id, motif }); return { error: null } },
  reassignRejectedTask: async (id, _adminId, payload) => { appels.push({ type: 'reassignRejectedTask', id, payload }); return { error: null } },
  addTaskComment: async (id, _auteurId, _auteurType, texte) => { appels.push({ type: 'addTaskComment', id, texte }); return { error: null } },
  formatDuration: (secondes) => (secondes ? `${Math.round(secondes / 60)} min` : '—'),
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
    erreurEquipes: null, erreurTaches: null, fiche: null, erreurFiche: null,
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
  it('ne porte plus l’onglet « Annuaire » : la liste est la page', () => {
    expect(EMPLOYES).not.toMatch(/libelle:\s*['"]Annuaire['"]/)
    // ⚠️ les vues ont déménagé : la page passe maintenant ses vues à la
    // sidebar unique, qui pose elle-même les libellés d'accessibilité.
    expect(EMPLOYES).toContain("label: 'Équipes'")
    expect(EMPLOYES).toContain("label: 'Tâches'")
  })

  it('ne montre pas une porte qui ne mène nulle part quand l’option est éteinte', () => {
    expect(EMPLOYES).toContain("const vueAutorisee = moduleTaches || admin?.role === 'super_admin'")
    // les vues ne sont passées à la sidebar que si l'option est allumée
    expect(EMPLOYES).toMatch(/vues=\{vueAutorisee \? \[/)
  })

  it('rabat sur la liste quand on re-clique l’onglet actif, et reste sur la liste avec une adresse inconnue', () => {
    expect(EMPLOYES).toContain('setSearchParams(cle === vueActive ? {} : { vue: cle }')
    expect(EMPLOYES).toMatch(/vueActive === null && \(/)
  })

  it('ne porte plus la bande de raccourcis de pages : la sidebar est la navigation', () => {
    expect(EMPLOYES).not.toContain('RaccourcisPages')
    expect(EMPLOYES).not.toContain('empv2-raccourcis')
  })
})

// ═══════════════════════════════════════════════════════════
// ② bis La vue Annuaire — la page elle-même, refonte bento// ② bis La vue Annuaire — même registre que les deux autres
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
    onOuvrirPage: vi.fn(),
    onBadge: vi.fn(),
    onHoraires: vi.fn(),
    onPartagerHoraires: vi.fn(),
    onPointages: vi.fn(),
    onMotDePasse: vi.fn(),
    onBasulerPortail: vi.fn(),
    onSupprimer: vi.fn(),
  }
  await rendre(
    <EntreeEmploye
      employee={personne()}
      liveStatus={{ state: 'en_poste', entryHHMM: '08:12' }}
      contractLabel="CDI"
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
  it('suit la maquette choisie : rien de plus entre la semaine et les cartes', () => {
    // les deux blocs qui n'existent pas dans la maquette v5 ont quitté la vue
    expect(EMPLOYES).not.toContain('Fiches à compléter')
    expect(EMPLOYES).not.toContain('Contrats par type')
    expect(EMPLOYES).not.toContain('empv3-deux')

    // et la peau qu'il a validée : titre qui prend la page, cadre 2 px, ombre dure
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    const peau = CSS_EMP.slice(CSS_EMP.indexOf('LA PEAU DE LA MAQUETTE v5'))
    expect(peau).toContain('clamp(34px, 3.4vw, 50px)')
    expect(peau).toContain('box-shadow: var(--charte-ombre-dure)')
    expect(peau).toContain('.empv3-fiche-avatar')

    // la masse salariale se lit sur toutes les entreprises chargées, pas une seule
    expect(EMPLOYES).toContain("entreprisesDesEmployes")
    expect(EMPLOYES).toContain(".in('enterprise_id', entreprisesDesEmployes)")
  })

  it('pose une carte par personne, avec ses contacts et son état', () => {
    // plus de tableau : une galerie de cartes
    expect(EMPLOYES).toContain('<CarteEmploye')
    expect(EMPLOYES).not.toContain('ch-tableau-filets')
    expect(EMPLOYES).toContain('empv3-fiches')

    // ce que la carte porte
    const CARTE = readFileSync('src/components/equipes/CarteEmploye.jsx', 'utf8')
    expect(CARTE).toContain('empv3-d-nom')
    expect(CARTE).toContain('empv3-d-poste')
    // le contrat est une pastille pleine, plus un mot posé sous le nom
    expect(CARTE).toContain('empv3-d-chip--contrat')
    expect(CARTE).toContain('contrat à compléter')
    // le numéro WhatsApp et l'email, chacun avec son icône
    expect(CARTE).toContain('MessageCircle')
    expect(CARTE).toContain('employee.phone')
    expect(CARTE).toContain('Mail')
    expect(CARTE).toContain('employee.email')
    // et quand il n'y a ni l'un ni l'autre, le mot le dit
    expect(CARTE).toContain('Aucun contact renseigné')
    // l'état du jour reste une pilule, avec son mot
    expect(CARTE).toContain('ch-badge-pilule')
    expect(CARTE).toContain('En poste')

    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.empv3-fiches \{[\s\S]{0,120}grid-template-columns: repeat\(3/)
    expect(CSS_EMP).toContain('.empv3-fiche-pastille--en_poste')
  })

  it('pose les trois cartes de la composition validée, et n’invente pas de présence', async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })

    const cartes = [...hote.querySelectorAll('.empv3-cartes .empv3-carte')]
    expect(cartes).toHaveLength(4)
    expect(cartes.map((c) => c.querySelector('.empv3-carte-titre').textContent)).toEqual(
      ['Effectif total', 'Présents', 'Accès au portail', 'Retards'],
    )

    // rien à compter : un tiret, pas un zéro inventé pour la présence
    expect(cartes[1].querySelector('.empv3-kpi-chiffre').textContent).toBe('—')
    expect(cartes[3].querySelector('.empv3-kpi-chiffre').textContent).toBe('—')
    // et pas d'écart sans mesure
    expect(cartes[1].querySelector('.empv3-ecart')).toBeNull()
  })

  it('pose le planning de la semaine et les annonces, avec de vrais états', async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })

    const planning = hote.querySelector('.empv3-grille-planning')
    expect(planning).not.toBeNull()

    // sept jours, nommés en français
    const jours = [...planning.querySelectorAll('.empv3-jour')]
    expect(jours).toHaveLength(7)
    expect(jours.map((j) => j.textContent.replace(/\d+/g, '').trim())).toEqual(
      ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
    )

    // aucune personne : donc aucune ligne, et aucun état inventé
    // (les échantillons de la légende ne comptent pas : ils vivent hors des pistes)
    const pistes = planning.querySelector('.empv3-pistes')
    expect(pistes.querySelectorAll('.empv3-piste:not(.empv3-piste--regle)')).toHaveLength(0)
    expect(pistes.querySelectorAll('.empv3-case')).toHaveLength(0)

    // et à droite, la masse salariale : sans profils de paie, le mot le dit
    const masse = planning.querySelectorAll('.empv3-carte')[1]
    expect(masse.querySelector('.empv3-carte-titre').textContent).toBe('Masse salariale')
    expect(masse.querySelectorAll('.empv3-annonce')).toHaveLength(0)
    expect(masse.textContent).toMatch(/n’ont pas pu être lues|Aucune rémunération renseignée/)

    // les barres : la case est là, la barre aussi — et le calcul est testé à part
    expect(EMPLOYES).toContain("from '../utils/barresSemaine'")
    expect(EMPLOYES).toContain('empv3-barre')
    expect(EMPLOYES).toContain('gridColumn:')

    // et aucun mot anglais ne s'est glissé dans les deux blocs
    expect(planning.textContent).not.toMatch(/Meeting|Schedule|Events|Today|Present/)
  })

  it('met le rôle sous le nom, et montre le média quand il existe', () => {
    // le rôle sous le nom, jamais un poste inventé
    expect(EMPLOYES).toContain('empv3-semaine-poste')
    expect(EMPLOYES).toContain('poste non renseigné')

    // plus d'annonces d'accueil sur cette page : la masse salariale les remplace
    expect(EMPLOYES).not.toContain('empv3-annonce')
    expect(EMPLOYES).not.toContain('encheck_annonce_accueil_lister')
    expect(EMPLOYES).toContain('Masse salariale')
    expect(EMPLOYES).toContain("from('employee_payroll_profiles')")
  })

  it('explique l’annuaire vide et propose la première fiche', async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })
    expect(hote.querySelector('.empv2-vide')).not.toBeNull()
    expect(hote.textContent).toContain('Aucun employé pour l’instant')
    expect(boutonAvec('Nouvel employé')).toBeTruthy()
  })

  it('filtre l’état de la journée d’abord, et sait tout montrer', async () => {
    await rendre(
      <ThemeProvider>
        <Employes />
      </ThemeProvider>,
    )
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })

    // les filtres vivent dans la barre d'outils de « Tous les employés »
    const enPoste = [...hote.querySelectorAll('.empv2-filtre')].find((f) => f.textContent === 'En poste')
    await act(async () => enPoste.click())
    expect(enPoste.getAttribute('aria-pressed')).toBe('true')

    const toutMontrer = [...hote.querySelectorAll('.empv2-filtre')].find((f) => f.textContent === 'Tout montrer')
    expect(toutMontrer).toBeTruthy()
    await act(async () => toutMontrer.click())
    expect(hote.querySelector('.empv2-filtre[aria-pressed="true"]').textContent).toContain('Tous')
  })

  it('la carte porte la photo ou les initiales, le nom en serif, le matricule et le contrat', async () => {
    await rendreEntree()
    const carte = hote.querySelector('.empv2-entree')
    expect(carte).not.toBeNull()
    expect(carte.querySelector('.empv2-entree-initiales').textContent).toBe('AD')
    expect(carte.querySelector('.empv2-entree-nom').textContent).toBe('Awa Dossou')
    expect(carte.querySelector('.empv2-entree-sous').textContent).toContain('EMP-001')
    expect(carte.querySelector('.empv2-entree-sous').textContent).toContain('CDI')
    expect(carte.querySelector('.empv2-entree-poste').textContent).toBe('Technicienne de ligne · Maintenance')
  })

  it('signale l’état du jour sur la photo, avec l’heure donnée par la pointeuse', async () => {
    await rendreEntree()
    const badge = hote.querySelector('.empv2-entree-badge')
    expect(badge.classList.contains('empv2-entree-badge--en_poste')).toBe(true)
    expect(badge.textContent).toContain('En poste')
    expect(badge.textContent).toContain('08:12')
    expect(hote.querySelector('.empv2-entree').getAttribute('data-presence')).toBe('en_poste')
  })

  it('n’invente pas un état quand le pointage est absent', async () => {
    await relancer(<EntreeEmploye employee={personne()} onOuvrirPage={vi.fn()} />)
    const badge = hote.querySelector('.empv2-entree-badge')
    expect(badge.textContent).toContain('Non pointé')
    expect(hote.querySelector('.empv2-entree').getAttribute('data-presence')).toBe('non_pointe')
  })

  it('écrit le retard du jour en minutes, tant que la personne n’a pas pointé', async () => {
    await relancer(
      <EntreeEmploye employee={personne()} liveStatus={{ state: 'non_pointe', retardMinutes: 12 }} onOuvrirPage={vi.fn()} />,
    )
    const badge = hote.querySelector('.empv2-entree-badge')
    expect(badge.textContent).toContain('Retard · 12 min')
    expect(hote.querySelector('.empv2-entree').getAttribute('data-presence')).toBe('retard')
  })

  it('écrit « Absent » quand l’absence du jour est déclarée', async () => {
    await relancer(
      <EntreeEmploye employee={personne()} liveStatus={{ state: 'en_conge' }} onOuvrirPage={vi.fn()} />,
    )
    const badge = hote.querySelector('.empv2-entree-badge')
    expect(badge.textContent).toContain('Absent')
    expect(hote.querySelector('.empv2-entree').getAttribute('data-presence')).toBe('absent')
  })

  it('montre le numéro pour la joindre, ou un mot clair sinon', async () => {
    await rendreEntree({ employee: personne({ phone: '+229 97 00 00 00' }) })
    expect(hote.querySelector('.empv2-entree-contact').textContent).toContain('+229 97 00 00 00')

    await relancer(<EntreeEmploye employee={personne()} onOuvrirPage={vi.fn()} />)
    expect(hote.querySelector('.empv2-entree-contact').textContent).toContain('Sans numéro')
  })

  it('pose le statut du portail en un mot', async () => {
    const etat = () => hote.querySelector('.empv2-entree-portail')

    await rendreEntree()
    expect(etat().getAttribute('data-etat')).toBe('ouvert')
    expect(etat().textContent).toContain('Portail')

    await relancer(<EntreeEmploye employee={personne()} portalEnabled={false} aCompte onOuvrirPage={vi.fn()} />)
    expect(etat().getAttribute('data-etat')).toBe('ferme')
    expect(etat().textContent).toContain('Portail fermé')

    await relancer(<EntreeEmploye employee={personne()} aCompte={false} onOuvrirPage={vi.fn()} />)
    expect(etat().getAttribute('data-etat')).toBe('aucun')
    expect(etat().textContent).toContain('Sans compte')
  })

  it('signale un portail à migrer sans attendre qu’on ouvre le menu', async () => {
    await rendreEntree({ ancienSysteme: true, portalEnabled: false })
    const compte = hote.querySelector('.empv2-entree-portail')
    expect(compte.getAttribute('data-etat')).toBe('migrer')
    expect(compte.textContent).toContain('À migrer')
  })

  it('ouvre la fiche d’un clic sur le nom, et aussi sur Fiche', async () => {
    const actions = await rendreEntree()
    await act(async () => hote.querySelector('.empv2-entree-nom button').click())
    expect(actions.onOuvrirPage).toHaveBeenCalledWith(expect.objectContaining({ id: 'emp-1' }))

    await act(async () => boutonAvec('Fiche').click())
    expect(actions.onOuvrirPage).toHaveBeenCalledTimes(2)
  })

  it('garde les autres gestes dans un menu, pas sur la carte', async () => {
    const actions = await rendreEntree()
    const menuBouton = hote.querySelector('.empv2-entree-plus')
    expect(menuBouton.getAttribute('aria-expanded')).toBe('false')
    await act(async () => menuBouton.click())
    expect(menuBouton.getAttribute('aria-expanded')).toBe('true')
    const menu = hote.querySelector('.empv2-menu')
    expect(menu.textContent).toContain('Badge QR')
    expect(menu.textContent).toContain('Horaires')
    expect(menu.textContent).toContain('Envoyer les horaires')
    expect(menu.textContent).toContain('Voir les pointages')
    expect(menu.textContent).toContain('Mot de passe')
    expect(menu.textContent).toContain('Fermer le portail')
    expect(menu.textContent).toContain('Supprimer la fiche')

    await act(async () => [...menu.querySelectorAll('button')].find((b) => b.textContent.includes('Horaires')).click())
    expect(actions.onHoraires).toHaveBeenCalledTimes(1)
    expect(hote.querySelector('.empv2-menu')).toBeNull()
  })

  it('pose le menu sur un papier opaque, au-dessus de la carte suivante', async () => {
    await rendreEntree()
    const carte = hote.querySelector('.empv2-entree')
    const menuBouton = hote.querySelector('.empv2-entree-plus')
    expect(carte.getAttribute('data-menu')).toBeNull()
    await act(async () => menuBouton.click())
    // la carte ouverte monte : sans cela, le texte du dessous se peint dessus
    expect(carte.getAttribute('data-menu')).toBe('ouvert')

    const menu = REFONTE_CSS.match(/\.empv2-menu \{([^}]*)\}/)[1]
    expect(menu).toMatch(/background: var\(--charte-surface\)/)
    expect(menu).toMatch(/z-index:\s*\d+/)
  })

  it('referme le menu d’un clic ailleurs ou d’un Échap', async () => {
    await rendreEntree()
    const menuBouton = hote.querySelector('.empv2-entree-plus')
    await act(async () => menuBouton.click())
    expect(hote.querySelector('.empv2-menu')).not.toBeNull()

    await act(async () => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(hote.querySelector('.empv2-menu')).toBeNull()

    await act(async () => menuBouton.click())
    expect(hote.querySelector('.empv2-menu')).not.toBeNull()
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(hote.querySelector('.empv2-menu')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// ③ La vue Équipes// ③ La vue Équipes
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
  it('pose quatre chiffres, comptés sur les équipes chargées', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', member_count: 1, leader_employee_id: null, leader: null, health: { health_score: 40, status: 'warning' } }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const kpis = [...hote.querySelectorAll('.eqv2-kpis .empv2-kpi')]
    expect(kpis).toHaveLength(4)
    expect(kpis.map((k) => k.querySelector('strong').textContent)).toEqual(['2', '3', '1', '0'])
    expect(kpis.map((k) => k.querySelector('.empv2-kpi-libelle').textContent)).toEqual(['Équipes', 'Membres', 'Sans chef', 'À rattacher'])
  })

  it('empile cinq avatars, le chef couronné, et compte le reste', async () => {
    const membres = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i + 1}`,
      employee: { id: i === 0 ? 'emp-1' : `emp-x${i}`, first_name: 'Membre', last_name: `Huit${i}` },
    }))
    etat.equipes = [equipe({ members: membres, member_count: 8 })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const pile = [...hote.querySelectorAll('.eqv2-avatars .eqv2-avatar')]
    expect(pile).toHaveLength(5) // cinq affichés, le reste est compté
    expect(pile[0].getAttribute('data-chef')).toBe('oui')
    expect(hote.querySelector('.eqv2-couronne')).not.toBeNull()
    expect(hote.querySelector('.eqv2-avatars-note').textContent).toBe('+3')
  })

  it('liste les personnes sans équipe dans le rail, chacune avec son bouton', async () => {
    etat.predictions = true
    etat.orphelins = [{ id: 'emp-9', first_name: 'Rita', last_name: 'Kponou', position: 'Cuisinière' }]
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const lignes = [...hote.querySelectorAll('.eqv2-rattacher-ligne')]
    expect(lignes).toHaveLength(1)
    expect(lignes[0].querySelector('strong').textContent).toBe('Rita Kponou')
    expect(lignes[0].textContent).toContain('Cuisinière')

    await act(async () => hote.querySelector('.eqv2-btn-mini').click())
    const menu = hote.querySelector('.eqv2-menu-rattacher')
    expect(menu).not.toBeNull()
    expect(menu.textContent).toContain('Maintenance')
    expect(menu.querySelector('.eqv2-menu-pastille')).not.toBeNull()

    etat.orphelins = []
    await relancer(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.textContent).toContain('Tout le monde est rattaché à une équipe.')
  })

  it('lit la santé de chaque équipe en pastille tonnée', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', health: { health_score: 40, status: 'warning' } }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.eqv2-sante-badge--solide').textContent).toBe('Solide')
    expect(hote.querySelector('.eqv2-sante-badge--a-surveiller').textContent).toBe('À surveiller')
  })

  it('ne mesure pas une santé qu’on n’a pas mesurée', async () => {
    etat.equipes = [equipe({ health: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.eqv2-sante-badge--inconnue').textContent).toBe('Non suivie')
  })

  it('pose chaque équipe en carte à trait coloré, sa note, son pied compté', async () => {
    etat.equipes = [equipe(), equipe({ id: 'eq-2', name: 'Expédition' })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const cartes = [...hote.querySelectorAll('.eqv2-carte')]
    expect(cartes).toHaveLength(2)
    // la vue s'ouvre triée par nom
    expect(cartes.map((c) => c.querySelector('.eqv2-carte-nom').textContent)).toEqual(['Expédition', 'Maintenance'])
    const maintenance = cartes.find((c) => c.textContent.includes('Maintenance'))
    // la couleur de l'équipe couronne la carte, mais elle n'est plus peinte
    // en ligne : elle ENTRE dans la carte par une variable de peau,
    // `--eqv-teinte`, posée sur l'article. C'est `EquipesVue.css` qui en fait
    // le lavis du papier, le trait de feutre de 6 px et sa saignée — une
    // attribution `style` battrait n'importe quel sélecteur de feuille, donc
    // la donnée se transmet, la peinture s'écrit dans la charte.
    expect(maintenance.getAttribute('style')).toContain('--eqv-teinte')
    expect(maintenance.getAttribute('style')).toMatch(/2F7F73|rgb\(47, 127, 115\)/i)
    const trait = maintenance.querySelector('.eqv2-carte-trait')
    expect(trait).not.toBeNull()
    expect(trait.hasAttribute('style')).toBe(false)
    expect(maintenance.querySelector('.eqv2-carte-note').textContent).toContain('Ligne de production')
    expect(maintenance.querySelector('.eqv2-carte-pied').textContent).toContain('2 membres')
  })

  it('nomme le chef dans le pied de la carte', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.eqv2-carte-pied').textContent).toContain('chef : Awa Dossou')
    expect(hote.querySelector('.eqv2-avatar[data-chef="oui"]')).not.toBeNull()
  })

  it('compte zéro et dit « sans chef » quand l’équipe est vide', async () => {
    etat.equipes = [equipe({ members: [], member_count: 0, leader: null, leader_employee_id: null })]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    const pied = hote.querySelector('.eqv2-carte-pied')
    expect(pied.textContent).toContain('0 membre')
    expect(pied.querySelector('.eqv2-carte-sanschef').textContent).toBe('sans chef')
    expect(hote.querySelector('.eqv2-avatar')).toBeNull()
  })

  it('explique l’absence d’équipes et propose la première', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.eqv2-vide').textContent).toContain('Aucune équipe pour l’instant')
    expect(boutonAvec('Nouvelle équipe')).toBeTruthy()
  })

  it('le bouton « Nouvelle équipe » de la page ouvre la fenêtre de création', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} signalCreation={1} />)
    expect(hote.textContent).toContain('Nom *')
  })

  it('filtre, cherche et trie sans quitter la vue', async () => {
    etat.equipes = [
      equipe(),
      equipe({ id: 'eq-2', name: 'Expédition', member_count: 1, leader_employee_id: null, leader: null }),
    ]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const filtre = [...hote.querySelectorAll('.eqv2-filtre')].find((f) => f.textContent === 'Sans chef')
    await act(async () => filtre.click())
    expect([...hote.querySelectorAll('.eqv2-carte')]).toHaveLength(1)
    expect(hote.querySelector('.eqv2-carte-nom').textContent).toBe('Expédition')

    // le tri par effectif remet l'équipe la plus grande en premier
    await act(async () => [...hote.querySelectorAll('.eqv2-filtre')].find((f) => f.textContent === 'Toutes').click())
    const tri = hote.querySelector('.eqv2-tri')
    const triSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    await act(async () => {
      triSetter.call(tri, 'members_desc')
      tri.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(hote.querySelector('.eqv2-carte-nom').textContent).toBe('Maintenance')

    // la recherche retrouve par nom
    const champ = hote.querySelector('.eqv2-recherche input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(champ, 'maint')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect([...hote.querySelectorAll('.eqv2-carte')]).toHaveLength(1)
    expect(hote.querySelector('.eqv2-carte-nom').textContent).toBe('Maintenance')
  })

  it('range les décisions dans un pied dépliable, pas dans une bannière qui hurle', async () => {
    etat.predictions = true
    etat.alertes = [{ id: 'a1', severity: 'critical', team_name: 'Maintenance', message: 'Aucun pointage depuis 3 jours' }]
    etat.orphelins = [{ id: 'emp-9', first_name: 'Rita', last_name: 'Kponou' }]
    etat.sante = { global: { avg_health_score: 62 }, parEquipe: [] }
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)

    const pied = hote.querySelector('.empv2-pied')
    expect(pied.textContent).toContain('À décider')
    expect(pied.textContent).toContain('2 points à arbitrer')
    // replié : le détail n'est pas déversé sur la page
    expect(pied.textContent).not.toContain('Aucun pointage depuis 3 jours')

    await act(async () => boutonAvec('Ouvrir le registre').click())
    expect(pied.textContent).toContain('Aucun pointage depuis 3 jours')

    const ongletOrphelins = [...pied.querySelectorAll('.empv2-pied-onglets button')].find((b) => b.textContent.includes('Sans équipe'))
    await act(async () => ongletOrphelins.click())
    expect(pied.textContent).toContain('Rita Kponou')
  })

  it('dit que les analyses manquent au lieu de faire semblant quand Prédictions est éteint', async () => {
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.empv2-pied').textContent).toContain('Les analyses d’équipe ne sont pas activées')
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
  it('pose quatre chiffres, comptés sur les tâches chargées', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const kpis = [...hote.querySelectorAll('.tqv2-kpis .empv2-kpi')]
    expect(kpis).toHaveLength(4)
    expect(kpis.map((k) => k.querySelector('strong').textContent)).toEqual(['2', '0', '0', '1'])
    expect(kpis.map((k) => k.querySelector('.empv2-kpi-libelle').textContent)).toEqual(['Tâches', 'En cours', 'En retard', 'Terminées'])
  })

  it('range les tâches dans quatre colonnes nommées, chacune tonnée', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const colonnes = [...hote.querySelectorAll('.tqv2-colonne')]
    expect(colonnes.map((c) => c.getAttribute('data-colonne'))).toEqual(['a-faire', 'en-cours', 'terminees', 'validees'])
    expect(colonnes.map((c) => c.querySelector('.tqv2-colonne-titre').textContent)).toEqual(['À faire', 'En cours', 'Terminées', 'Validées'])
    expect(colonnes.map((c) => c.querySelector('.tqv2-colonne-compte').textContent)).toEqual(['1', '0', '0', '1'])
    // la colonne vide dit qu'elle l'est
    expect(colonnes[1].querySelector('.tqv2-colonne-vide').textContent).toContain('Rien ici')
  })

  it('pose chaque tâche en carte, priorité en pastille tonnée', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const fiche = hote.querySelector('.tqv2-fiche')
    expect(fiche).not.toBeNull()
    expect(fiche.getAttribute('data-priorite')).toBe('high')
    expect(fiche.querySelector('.tqv2-fiche-titre').textContent).toBe('Vérifier les extincteurs')
    expect(fiche.querySelector('.tqv2-priorite--haute').textContent).toBe('Haute')
    expect(fiche.querySelector('.tqv2-personne').textContent).toContain('Awa Dossou')
    expect(fiche.querySelector('.tqv2-avatar')).not.toBeNull()
  })

  it('écrit l’échéance en date courte et chiffre le retard en jours', async () => {
    etat.taches = [
      tache({ due_at: new Date(Date.now() + 6 * 86400000).toISOString() }),
      tache({ id: 't-2', title: 'Relancer le fournisseur', due_at: new Date(Date.now() - 4 * 86400000).toISOString() }),
    ]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const dates = [...hote.querySelectorAll('.tqv2-fiche-date')]
    expect(dates).toHaveLength(2)
    // le retard est chiffré en jours, et non masqué
    const retard = dates.find((d) => d.querySelector('.tqv2-retard'))
    expect(retard).not.toBeNull()
    expect(retard.textContent).toMatch(/retard de \d+ j/)
    // l'autre échéance porte sa date courte, sans retard. `\p{L}` et non `\w` :
    // `\w` est ASCII, donc la date échouait chaque fois que le mois abrégé porte un
    // accent — « 01 déc. », « 02 févr. ». Un test qui meurt deux mois par an n'est
    // pas une preuve : c'est une fausse alerte programmée deux mois par an.
    expect(dates.find((d) => !d.querySelector('.tqv2-retard')).textContent).toMatch(/\d{2} \p{L}{3}/u)
    // plus de collier : le texte suffit
    expect(hote.querySelector('[data-testid="collier-echeance"]')).toBeNull()
  })

  it('déplace une tâche d’une colonne à l’autre en changeant son statut', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const colonneValidees = [...hote.querySelectorAll('.tqv2-colonne')].find((c) => c.textContent.includes('Validées'))
    const evenement = new Event('drop', { bubbles: true })
    Object.defineProperty(evenement, 'dataTransfer', { value: { getData: () => 't-1' } })
    await act(async () => colonneValidees.dispatchEvent(evenement))
    expect(appels).toContainEqual({ type: 'updateTask', id: 't-1', champs: { status: 'validated' } })
  })

  it('sélectionne puis vide une sélection sans toucher aux tâches', async () => {
    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const caseTache = hote.querySelector('.tqv2-fiche .tqv2-case')
    await act(async () => caseTache.click())
    expect(hote.textContent).toContain('1 tâche sélectionnée')
    // la carte sélectionnée est cerclée d'or
    expect(hote.querySelector('.tqv2-fiche[data-selection="oui"]')).not.toBeNull()
    await act(async () => boutonAvec('Vider la sélection').click())
    expect(hote.textContent).not.toContain('tâche sélectionnée')
    expect(appels.filter((a) => a.type === 'updateTask')).toHaveLength(0)
  })

  it('le bouton « Nouvelle tâche » de la page ouvre la fenêtre de création', async () => {
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} signalCreation={1} />)
    expect(hote.textContent).toContain('Titre *')
  })

  it('affiche les catégories en pastilles avec leur effectif, et permet de filtrer', async () => {
    etat.categories = [{ id: 'c-1', name: 'Sécurité', color: '#B4553F' }]
    etat.taches = [tache(), tache({ id: 't-2', title: 'Autre' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const puce = [...hote.querySelectorAll('.tqv2-categorie')].find((b) => b.textContent.includes('Sécurité'))
    expect(puce, 'catégorie').not.toBeNull()
    expect(puce.textContent).toContain('2')
    await act(async () => puce.click())
    expect(hote.querySelectorAll('.tqv2-fiche')).toHaveLength(2)
    expect(hote.querySelector('.tqv2-categorie[aria-pressed="true"]')).not.toBeNull()
  })

  it('explique l’absence de tâches et propose la première', async () => {
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.tqv2-vide').textContent).toContain('Aucune tâche pour l’instant')
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
  it('pose chaque vue sur la même trame : chiffres, outils, contenu', async () => {
    etat.equipes = [equipe()]
    await rendre(<EquipesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.eqv2-kpis')).not.toBeNull()
    expect(hote.querySelector('.eqv2-outils')).not.toBeNull()
    expect(hote.querySelector('.eqv2-grille')).not.toBeNull()
    expect(hote.querySelector('.rg-folio')).toBeNull()

    etat.taches = [tache()]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    expect(hote.querySelector('.tqv2-kpis')).not.toBeNull()
    expect(hote.querySelector('.tqv2-outils')).not.toBeNull()
    expect(hote.querySelector('.tqv2-colonnes')).not.toBeNull()
    expect(hote.querySelector('.rg-colophon')).toBeNull()
  })

  it('pose chaque fiche en carte, comme la maquette, et cerne la sélection d’or', () => {
    const regle = (selecteur) => {
      const trouve = new RegExp(`${selecteur.replace('.', '\\.')} \\{[^}]*\\}`).exec(EQT_CSS)
      expect(trouve, selecteur).not.toBeNull()
      return trouve[0]
    }
    const carteEquipe = regle('.eqv2-carte')
    expect(carteEquipe).toContain('border-radius: 16px')
    expect(carteEquipe).toContain('background:')

    const carteTache = regle('.tqv2-fiche')
    expect(carteTache).toContain('border-radius: 14px')
    expect(carteTache).toContain('background: var(--rg-paper)')

    // la sélection : une bordure or, pas un fond qui change
    const selection = /\.tqv2-fiche\[data-selection='oui'\] \{[^}]*\}/.exec(EQT_CSS)
    expect(selection, 'sélection dorée').not.toBeNull()
    expect(selection[0]).toContain('--empv2-or')
  })


  it('tonne les quatre colonnes du tableau, du teal au blanc', () => {
    // quatre tons, un par colonne, chacun porteur de son compte
    for (const ton of ['teal', 'or', 'vert', 'blanc']) {
      expect(EQT_CSS).toContain(`.tqv2-colonne[data-ton='${ton}'] .tqv2-colonne-compte`)
    }
    // la colonne survolée pendant le glissement se cerne d'or
    expect(EQT_CSS).toMatch(/\.tqv2-colonne\[data-survol='oui'\] \{[^}]*--empv2-or/)
  })


  it('écrit l’échéance en date courte et chiffre le retard, sans dessin', async () => {
    etat.taches = [
      tache({ id: 't-1', due_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString() }),
      tache({ id: 't-2', title: 'Relancer le fournisseur', due_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() }),
    ]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)

    const dates = [...hote.querySelectorAll('.tqv2-fiche-date')]
    expect(dates).toHaveLength(2)
    // la date courte porte jour et mois
    expect(dates[0].textContent).toMatch(/\d{2} \p{L}{3}/u) // même piège d'accent, voir plus haut
    // le retard garde la phrase qui le chiffre : le texte ne se cache pas
    expect(hote.textContent).toMatch(/retard de \d+ j/)
    // plus de collier de perles
    expect(hote.querySelector('[data-testid="collier-echeance"]')).toBeNull()
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

  it('la carte est le modèle D : panneau bogolan latéral, photo posée dessus', () => {
    const CARTE = readFileSync('src/components/equipes/CarteEmploye.jsx', 'utf8')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')

    // le tissu est la VRAIE image, tournée à la verticale, et il existe
    expect(CSS_EMP).toMatch(/\.empv3-d-tissu \{[\s\S]{0,260}bogolan-vertical\.webp/)
    expect(() => readFileSync('public/images/bogolan-vertical.webp')).not.toThrow()

    // la structure : une colonne de tissu, un corps de papier
    expect(CARTE).toContain('empv3-d-panneau')
    expect(CARTE).toContain('empv3-d-tissu')
    expect(CARTE).toContain('empv3-d-corps')
    // la photo vit DANS le panneau, pas dans le corps
    const panneau = CARTE.slice(CARTE.indexOf('empv3-d-panneau'), CARTE.indexOf('empv3-d-corps'))
    expect(panneau).toContain('empv3-d-avatar')
    // le corps porte nom, état, pastilles, contacts
    for (const morceau of ['empv3-d-nom', 'empv3-d-poste', 'empv3-d-etat', 'empv3-d-chips', 'empv3-d-contacts']) {
      expect(CARTE).toContain(morceau)
    }
    // la grille : 78 px de tissu puis le papier
    expect(CSS_EMP).toMatch(/\.empv3-d \{[\s\S]{0,120}grid-template-columns: 78px minmax\(0, 1fr\)/)
    // le tissu ne se répète QUE verticalement : il ne s'étire pas en travers
    expect(CSS_EMP).toMatch(/\.empv3-d-tissu \{[\s\S]{0,300}repeat-y/)
  })

  it('la photo ne recouvre rien, le menu sort de la carte, les contacts sont des boutons', () => {
    const CARTE = readFileSync('src/components/equipes/CarteEmploye.jsx', 'utf8')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')

    // 1 · la photo flotte à droite et ne mange plus le texte
    expect(CSS_EMP).toMatch(/\.empv3-d-avatar \{[\s\S]{0,220}position: absolute/)
    expect(CSS_EMP).toMatch(/\.empv3-d-tete \{ padding-right: 66px; \}/)
    // et elle montre le visage, pas le buste
    expect(CSS_EMP).toMatch(/\.empv3-d-avatar img \{[\s\S]{0,200}object-position: center 22%/)

    // 2 · le menu sort de la carte : position fixe calculée, plus d'absolute rogné
    expect(CARTE).toContain('empv2-menu--flottant')
    expect(CARTE).toContain('empv2-menu--flottant')
    expect(CARTE).toContain('getBoundingClientRect')
    expect(CSS_EMP).toMatch(/\.empv3-fiche\.empv3-pro \{ overflow: visible; \}/)

    // 3 · les contacts sont des boutons d'action, avec leurs icônes
    expect(CARTE).toContain('empv3-d-action--appel')
    expect(CARTE).toContain('href={`tel:')
    expect(CARTE).toContain('https://wa.me/')
    expect(CARTE).toContain('<Phone size={13}')
    expect(CSS_EMP).toMatch(/\.empv3-d-action--appel \{[\s\S]{0,120}background: var\(--charte-succes\)/)
  })

  it('le menu s’ouvre à côté du bouton, et les mails passent par Gmail ou Outlook', () => {
    const CARTE = readFileSync('src/components/equipes/CarteEmploye.jsx', 'utf8')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')

    // 1 · le menu : plus d'absolute rogné, un calcul ancré sur le bouton
    expect(CSS_EMP).toMatch(/\.empv2-menu\.empv2-menu--flottant \{[\s\S]{0,200}position: fixed/)
    // les valeurs héritées qui l'envoyaient en haut à droite sont neutralisées
    expect(CSS_EMP).toMatch(/\.empv2-menu\.empv2-menu--flottant \{[\s\S]{0,260}right: auto/)
    expect(CARTE).toContain('getBoundingClientRect')
    // il se recalcule au défilement et au redimensionnement
    expect(CARTE).toContain("window.addEventListener('scroll', recalculer, true)")

    // 2 · les mails : Gmail et Outlook, pas un mailto muet
    expect(CARTE).toContain('mail.google.com/mail/?view=cm')
    expect(CARTE).toContain('outlook.live.com/mail/0/deeplink/compose')
    expect(CARTE).toContain('lienGmail(courriel)')
    expect(CARTE).toContain('lienOutlook(courriel)')
    expect(CARTE).toContain('estAdresseInterne')
  })

  it('la pancarte est un carré sur une tige, avec le vrai logo et le slogan', () => {
    const PANCARTE = readFileSync('src/components/parcours/PancarteEnseigne.jsx', 'utf8')

    // un carré sur une tige : panneau + poteau, pas une bannière
    expect(PANCARTE).toContain('pancarte-panneau')
    expect(PANCARTE).toContain('pancarte-poteau')
    expect(PANCARTE).toContain('pancarte-terre')
    // le vrai logo : le pied, dessiné à l'identique
    expect(PANCARTE).toContain('pancarte-logo')
    expect(PANCARTE).toMatch(/M 30\.5 44\.5 C 27 51\.5/)
    // le slogan et la marque
    expect(PANCARTE).toContain('EN-CHECK')
    expect(PANCARTE).toContain('On gère !')
    // le fil de cuivre et les clous, comme la maquette V2
    expect(PANCARTE).toContain('pancarte-fil')
    expect(PANCARTE).toContain('pancarte-clou')

    // elle est posée AU MILIEU de l'en-tête, et au pied de page
    expect(EMPLOYES).toContain('empv3-entete-pancarte')
    expect(EMPLOYES).toMatch(/<header className="empv3-entete">[\s\S]{0,400}empv3-entete-pancarte/)
    expect(EMPLOYES).toMatch(/empv3-pancarte[\s\S]{0,120}PancarteEnseigne/)
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.empv3-entete-pancarte \{[\s\S]{0,200}left: 50%/)
    // et elle repasse dans le flux quand la place manque
    // ⚠️ la règle qui l'a COUPÉE : .empv3-entete porte overflow: hidden.
    // Elle ne doit plus y être — le rognage du motif est fait bandeau par bandeau.
    // la DERNIÈRE règle .empv3-entete est celle qui s'applique (la première
    // est un ancien bloc, resté dans le fichier)
    const SANS_COMMENTAIRES = CSS_EMP.replace(/\/\*[\s\S]*?\*\//g, '')
    const entete = SANS_COMMENTAIRES.slice(
      SANS_COMMENTAIRES.lastIndexOf('.empv3-entete {', SANS_COMMENTAIRES.indexOf('.empv3-entete-bandeau')),
      SANS_COMMENTAIRES.indexOf('.empv3-entete-bandeau'),
    )
    expect(entete).not.toContain('overflow: hidden')
    expect(CSS_EMP).toMatch(/\.empv3-entete-bandeau,\s*\.empv3-entete-bandeau--bas \{\s*overflow: hidden/)
  })

  it('le chemin de traces serpente derrière, et la borne se pose dessus', () => {
    const CHEMIN = readFileSync('src/components/parcours/CheminEmpreintes.jsx', 'utf8')
    const BORNE = readFileSync('src/components/parcours/BornePointage.jsx', 'utf8')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')

    // des traces de pied HUMAIN : une plante, un talon, CINQ orteils
    expect(CHEMIN).toContain('ORTEILS')
    expect(CHEMIN).toContain('TracePied')
    const cinqOrteils = CHEMIN.match(/\{ cx: [\d.-]+, cy: [\d.-]+, rx: [\d.]+, ry: [\d.]+ \}/g)
    expect(cinqOrteils).toHaveLength(5)
    // et il les a voulus plus GROS : l'échelle de la trace est montée
    // leur taille se compense à la hauteur du parcours, pour rester constante
    expect(CHEMIN).toContain('compensation')
    // le chemin descend de la pancarte et va jusqu'au pied de page
    expect(CHEMIN).toContain("document.querySelector('.empv3-parcours')")
    expect(EMPLOYES).toContain('empv3-parcours')
    // il est en tour de sinus complet : sinon il saute d'une tuile à l'autre
    // quatre tours complets sur la hauteur : le tracé se raccorde toujours
    expect(CHEMIN).toContain('Math.PI * 4')
    // et le motif se répète sans étirement : c'est ce qui garde les traces minuscules
    expect(CHEMIN).toContain('TracePied')
    // aucune rotation décalée : `rotate` tourne autour de 0,0 après un translate.
    // On teste le CODE, pas les commentaires qui racontent le bug.
    const CODE = CHEMIN.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(CODE).not.toMatch(/<use[^>]*x="/)
    expect(CODE).toContain('TracePied')
    // et surtout PAS de preserveAspectRatio="none" sur la page entière :
    // c'est ce qui transformait les traces en taches géantes
    // il se déforme avec la page POUR aller jusqu'au bout, mais chaque pied
    // est compensé pour garder sa taille
    expect(CHEMIN).toContain('preserveAspectRatio="none"')
    expect(CHEMIN).toContain('scale(1 ${compensation})')
    // une bande de 132 px collée à chaque bord, jamais étirée
    expect(CSS_EMP).toMatch(/\.empv3-chemin \{[\s\S]{0,200}width: 132px/)
    // il part du milieu, là où est plantée la pancarte
    expect(CSS_EMP).toMatch(/\.empv3-chemin \{[\s\S]{0,200}left: calc\(50% - 66px\)/)
    // il ne prend aucun clic
    expect(CHEMIN).toContain('aria-hidden')

    // la borne : écran, empreinte, mât, socle
    expect(BORNE).toContain('borne ')
    expect(BORNE).toContain('Borne de pointage')
    expect(BORNE).toContain('borne-empreinte')

    expect(EMPLOYES).toContain('empv3-chemin')
    expect(EMPLOYES).toContain('CheminEmpreintes')
    expect(EMPLOYES).toContain('empv3-borne')
    // ⚠️ le grid « 1fr auto 1fr » de la dernière fois élargissait un VIDE
    // et tronquait la recherche (sa capture du 23/11) : on ne le veut plus.
    expect(readFileSync('src/pages/EmployesV3.css', 'utf8')).not.toContain('grid-template-columns: 1fr auto 1fr')
    // la mesure de hauteur suit la page : sinon le chemin s'arrête avant la
    // seconde pancarte (sa capture du 22/11)
    expect(CHEMIN).toContain('new ResizeObserver(mesurer)')
    expect(CHEMIN).toContain("typeof ResizeObserver !== 'undefined'")
    expect(EMPLOYES).toContain('BornePointage')

    expect(CSS_EMP).toMatch(/\.empv3-chemin \{[\s\S]{0,220}pointer-events: none/)
    expect(CSS_EMP).toMatch(/\.empv3-chemin \{[\s\S]{0,260}z-index: 0/)
    expect(CSS_EMP).toMatch(/\.empv2-annuaire \{ position: relative; z-index: 1; \}/)
  })

  it('la borne affiche « Et maintenant… » avec une vraie empreinte, le cahier « Avant… »', () => {
    const BORNE = readFileSync('src/components/parcours/BornePointage.jsx', 'utf8')
    const EMPREINTE = readFileSync('src/components/parcours/EmpreinteDigitale.jsx', 'utf8')
    const PANCARTE = readFileSync('src/components/parcours/PancarteEnseigne.jsx', 'utf8')

    // l'écran de la borne, en deux lignes insécables
    expect(BORNE).toContain('borne-ecran')
    expect(BORNE).toContain('<span>Et</span>')
    expect(BORNE).toContain('<span>maintenant…</span>')

    // ⚠️ l'empreinte est une IMAGE RÉELLE : mes dessins d'arcs étaient ratés
    expect(EMPREINTE).toContain('/images/empreinte-digitale.webp')
    expect(EMPREINTE).toContain('<img')
    // et le fichier existe vraiment
    expect(existsSync('public/images/empreinte-digitale.webp')).toBe(true)

    // la forme colonne : un fût, un écran carré, un pied plus large
    expect(BORNE).toContain('borne-fut')
    expect(BORNE).toContain('borne-pied')

    // la pancarte du haut : un cahier avec une coche et le mot « Avant… »
    expect(PANCARTE).toContain('CahierDePointage')
    expect(PANCARTE).toContain('Avant…')
    expect(EMPLOYES).toMatch(/PancarteEnseigne taille=\{104\} motif="cahier"/)

    // une seule pancarte de pied : elle avait été DUPLIQUÉE (sa capture du 23/11)
    const pieds = EMPLOYES.match(/PancarteEnseigne taille=\{96\}/g) || []
    expect(pieds).toHaveLength(1)

    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.borne-ecran-mot span \{ white-space: nowrap; \}/)
    // la recherche ne s'étire plus en hauteur (la grosse bulle du 23/11)
    expect(CSS_EMP).toMatch(/\.empv3-liste-tete \.empv3-recherche \{[\s\S]{0,320}min-height: 42px/)
    // ⚠️ la vraie cause du vide : une base flexible de 300 px qui s'étire.
    const CSS_NU = CSS_EMP.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(CSS_NU).not.toMatch(/\.empv3-recherche \{[\s\S]{0,200}flex: 1 1 300px/)
  })

  it('la borne est DANS la ligne de liste, et pas à côté', () => {
    // ⚠️ elle avait été insérée après le </div> : elle devenait une sœur de
    // la ligne, d'où trois blocs empilés et un grand vide (capture du 23/11).
    const ouv = EMPLOYES.indexOf('<div className="empv3-liste-tete">')
    const borne = EMPLOYES.indexOf('empv3-borne--entete')
    const rech = EMPLOYES.indexOf('<label className="empv3-recherche">', ouv)
    const ferm = EMPLOYES.indexOf('</div>', EMPLOYES.indexOf('</label>', rech))
    expect(ouv).toBeGreaterThan(-1)
    expect(borne).toBeGreaterThan(ouv)
    expect(borne).toBeLessThan(rech)
    expect(rech).toBeLessThan(ferm)
  })

  it('les pancartes, la borne et les herbes réagissent à l’approche du curseur', () => {
    const HOOK = readFileSync('src/hooks/useProximite.js', 'utf8')
    const PANCARTE = readFileSync('src/components/parcours/PancarteEnseigne.jsx', 'utf8')
    const BORNE = readFileSync('src/components/parcours/BornePointage.jsx', 'utf8')
    const HERBES = readFileSync('src/components/parcours/DecorationChemin.jsx', 'utf8')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')

    // une zone élargie, pas un simple :hover
    expect(HOOK).toContain('const ZONE = 56')
    expect(HOOK).toContain('getBoundingClientRect')
    // l'écouteur de mouvement n'existe QUE pendant le survol
    expect(HOOK).toContain("window.addEventListener('pointermove', bouger")
    expect(HOOK).toContain("window.removeEventListener('pointermove', bouger)")
    // et le respect du réglage système, sans quoi rien ne se branche
    expect(HOOK).toContain('prefers-reduced-motion: reduce')

    // les trois pièces portent la classe d'état
    expect(PANCARTE).toContain('est-proche')
    expect(PANCARTE).toContain('useProximite')
    expect(BORNE).toContain('est-proche')
    expect(HERBES).toContain('est-proche')

    // les mouvements : soulèvement, fil, écran vert, empreinte balayée, herbe penchée
    expect(CSS_EMP).toMatch(/\.pancarte\.est-proche \{[\s\S]{0,200}translateY\(-4px\)/)
    expect(CSS_EMP).toContain('@keyframes fil-vibre')
    expect(CSS_EMP).toMatch(/\.borne\.est-proche \.borne-ecran \{[\s\S]{0,160}background: #3F6B4C/)
    expect(CSS_EMP).toContain('@keyframes empreinte-balaie')
    expect(CSS_EMP).toMatch(/\.empv3-herbe\.est-proche \{[\s\S]{0,160}rotate\(9deg\)/)
    // et le silence quand le système le demande
    expect(CSS_EMP).toMatch(/prefers-reduced-motion: reduce[\s\S]{0,400}animation: none !important/)
  })

  it('la barre de liste tient sur une rangée : filtres et légende dedans', () => {
    // sa demande du 23/11 au soir : « C EST CE QUI FAIT QUE JE DOIS SCROLLER
    // AU MOINS 3 FOIS. EN TOUT OPTIMISE DE L ESPACE »
    const ouv = EMPLOYES.indexOf('<div className="empv3-liste-tete">')
    const filtres = EMPLOYES.indexOf('empv2-filtres--ligne')
    const rech = EMPLOYES.indexOf('<label className="empv3-recherche">', ouv)
    const ferm = EMPLOYES.indexOf('</div>', EMPLOYES.indexOf('</label>', rech))
    // les filtres sont DANS la ligne, avant la recherche
    expect(filtres).toBeGreaterThan(ouv)
    expect(filtres).toBeLessThan(rech)
    expect(rech).toBeLessThan(ferm)

    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    // en grand écran, les cartes passent à quatre par rangée : deux fois moins haut
    expect(CSS_EMP).toMatch(/min-width: 1280px[\s\S]{0,160}grid-template-columns: repeat\(4/)
    // et les contacts d'une carte sont plus compacts
    expect(CSS_EMP).toMatch(/\.empv3-d-action \{ height: 28px/)
  })

  it('le chemin a bien une arrivée : la seconde pancarte est DANS le parcours', () => {
    // ⚠️ deux tours de suite, la pancarte de pied avait quitté le parcours :
    // le chemin descendait donc vers rien (sa capture du 23/11).
    const i = EMPLOYES.indexOf('<div className="empv3-parcours">')
    expect(i).toBeGreaterThan(-1)
    const parcours = EMPLOYES.slice(i, EMPLOYES.indexOf('</main>', i))
    expect(parcours).toContain('empv3-pancarte')
    expect(parcours).toContain('size={96}' === 'size={96}' ? 'PancarteEnseigne taille={96}' : '')
    // et le chemin touche le bas de ce parcours
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.chemin-empreintes \{[\s\S]{0,200}position: absolute/)
  })

  it('le menu ⋮ ne suit plus la carte : sa transformation est neutralisée', () => {
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    // la vraie cause : transform sur la carte = nouveau repère du fixed
    expect(CSS_EMP).toMatch(/\.empv3-fiche\.empv3-pro:has\(\.empv2-menu--flottant\)[\s\S]{0,160}transform: none/)
    expect(CSS_EMP).toMatch(/\.empv2-menu\.empv2-menu--flottant \{ transform: none; \}/)
  })

  it('la recherche est large, explicite et effaçable', () => {
    expect(EMPLOYES).toContain('empv3-recherche')
    expect(EMPLOYES).toContain('empv3-recherche-effacer')
    expect(EMPLOYES).toContain('Nom, matricule, poste, service, CNPS')
    // le compte est dit à côté du titre, pas caché
    expect(EMPLOYES).toContain('empv3-bloc-compte')
    expect(EMPLOYES).toContain('} sur {employes.length}')
  })

  it('un retard se dit en heures et minutes, jamais en minutes seules', () => {
    expect(EMPLOYES).toContain('function dureeEnHeuresEtMinutes')
    // 523 min ne doit plus jamais s'écrire tel quel
    expect(EMPLOYES).toContain('dureeEnHeuresEtMinutes(retard.retardMinutes)')
    expect(EMPLOYES).not.toContain('Retard de ${retard.retardMinutes} min')
    // la légende montre une durée lisible, pas « +12 »
    expect(EMPLOYES).toContain('+42 min')
  })

  it('la case en retard est rouge pleine, sans rayure, et la tâche reste sous la masse', () => {
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    const bloc = CSS_EMP.slice(CSS_EMP.indexOf('LE RETARD DEVIENT ROUGE'))
    const retard = bloc.slice(bloc.indexOf('.empv3-case--retard'), bloc.indexOf('.empv3-case-plus'))
    expect(retard).toContain('background: var(--charte-erreur)')
    expect(retard).not.toContain('repeating-linear-gradient')
    expect(retard).not.toContain('linear-gradient')
    // les deux cartes de droite sont dans une colonne, dans l'ordre
    expect(EMPLOYES).toContain('empv3-colonne-droite')
    const masse = EMPLOYES.indexOf('empv3-colonne-droite')
    const taches = EMPLOYES.indexOf('empv3-carte--taches')
    expect(masse).toBeGreaterThan(-1)
    expect(taches).toBeGreaterThan(masse)
    expect(CSS_EMP).toMatch(/\.empv3-colonne-droite \{[\s\S]{0,120}flex-direction: column/)
  })

  it('les jours sont calculés en heure de l’entreprise, jamais en UTC', () => {
    // le bug du 19/11 : un pointage du 19 à 00 h 30 locale tombait sur le 18
    expect(EMPLOYES).toContain('const iso = jourLocal(jour)')
    expect(EMPLOYES).toContain('obtenirDateDuJour()')
    expect(EMPLOYES).toContain('const cle = jourLocal(jour)')
    expect(EMPLOYES).toContain('jourLocal(dimanche)')
    // plus aucune date de la semaine tirée de toISOString
    const semaine = EMPLOYES.slice(EMPLOYES.indexOf('const semaineAffichee'), EMPLOYES.indexOf('const semaineAffichee') + 900)
    expect(semaine).not.toContain('toISOString')
    // un jour passé sans pointage est nommé, pas laissé vide
    expect(EMPLOYES).toContain("'Non pointé'")
  })

  it('les états du planning s’expliquent au survol, en bulle lisible', () => {
    expect(EMPLOYES).toContain('data-infobulle=')
    // plus de `title` du navigateur sur les cases : il arrive trop tard et coupe
    const caseBloc = EMPLOYES.slice(EMPLOYES.indexOf('empv3-case empv3-case--${jour.etat}'), EMPLOYES.indexOf('empv3-case empv3-case--${jour.etat}') + 200)
    expect(caseBloc).not.toContain('title=')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toContain('[data-infobulle]::after')
    expect(CSS_EMP).toMatch(/content: attr\(data-infobulle\)/)
  })

  it('la carte des tâches par équipe vit sous la masse salariale, avec les photos', () => {
    expect(EMPLOYES).toContain('empv3-carte--taches')
    expect(EMPLOYES).toContain('Tâches par équipe')
    expect(EMPLOYES).toContain('getTasks(entrepriseDesVues')
    expect(EMPLOYES).toContain('getTeams(entrepriseDesVues, { includeMembers: true })')
    // les visages des membres, en pile, avec le surplus compté
    expect(EMPLOYES).toContain('empv3-avatar--pile')
    expect(EMPLOYES).toContain('empv3-equipe-avatars')
    expect(EMPLOYES).toMatch(/membre\.photo_url/)
    // une tâche finie = terminée ou validée, rien d'autre
    expect(EMPLOYES).toContain('new Set([TASK_STATUS.COMPLETED, TASK_STATUS.VALIDATED])')
  })

  it('la légende montre les vraies cases, pas des points de 7 px', () => {
    // l'échantillon réutilise la classe de la grille : même forme, même motif
    expect(EMPLOYES).toContain('empv3-legende-item')
    expect(EMPLOYES).toContain('empv3-legende-intro')
    expect(EMPLOYES).toMatch(/empv3-legende-item[\s\S]{0,120}empv3-case empv3-case--pointe/)
    expect(EMPLOYES).toMatch(/empv3-legende-item[\s\S]{0,120}empv3-case empv3-case--conge/)
    // les cinq états sont nommés en clair
    for (const mot of ['Pointé', 'Retard', 'Absence', 'À venir', 'Rien pointé']) {
      expect(EMPLOYES).toContain(mot)
    }
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.empv3-legende-item \.empv3-case \{[\s\S]{0,160}width: 26px/)
  })

  it('la ligne d’en-tête du planning ne porte plus de case fantôme', () => {
    const regle = EMPLOYES.slice(
      EMPLOYES.indexOf('empv3-piste empv3-piste--regle'),
      EMPLOYES.indexOf('empv3-piste empv3-piste--regle') + 260,
    )
    expect(regle).not.toContain('empv3-piste-identite')
  })

  it('la masse salariale dit son effectif et sa part, et ne prend plus la hauteur du planning', () => {
    expect(EMPLOYES).toContain('empv3-rang-detail')
    expect(EMPLOYES).toContain('pers. ·')
    expect(EMPLOYES).toContain('personnes: compter.get(service) || 0')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.empv3-grille-planning \{ align-items: start; \}/)
  })

  it('le planning suit le modèle B : une piste par personne, photo et état écrit', () => {
    expect(EMPLOYES).toContain('empv3-piste-identite')
    expect(EMPLOYES).toContain('empv3-avatar--piste')
    // la photo est affichée quand elle existe, les initiales sinon
    expect(EMPLOYES).toMatch(/employee\.photo_url\s*\n?\s*\?\s*<img/)
    // chaque état a un mot : la couleur ne parle jamais seule
    expect(EMPLOYES).toContain('empv3-etat--')
    expect(EMPLOYES).toContain("'En poste'")
    expect(EMPLOYES).toContain("etat: 'retard'")
    expect(EMPLOYES).toContain("etat: jour.futur ? 'avenir' : 'rien'")
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toContain('.empv3-legende-pastille--retard')
    expect(CSS_EMP).toMatch(/\.empv3-piste \{[\s\S]{0,140}grid-template-columns: 216px repeat\(7/)
  })

  it('les quatre cartes de chiffres agissent au clic', () => {
    // plus une seule carte inerte : chacune filtre la liste et y amène l'écran
    const cartes = EMPLOYES.split('empv3-kpi--agissante').length - 1
    expect(cartes).toBe(4) // une par carte de chiffres
    expect(EMPLOYES).toContain("filtrerParLaCarte('live_en_poste')")
    expect(EMPLOYES).toContain('montrerLesSansCompte')
    expect(EMPLOYES).toContain('montrerLesRetards')
    expect(EMPLOYES).toContain('scrollIntoView({ behavior: \'smooth\'')
    // chaque carte annonce ce qu'elle fait
    expect(EMPLOYES).toContain('empv3-kpi-action')
  })

  it('les chiffres portent leur source : étincelle des présences, écart en pastille', () => {
    // l'étincelle ne se dessine que sur une série réelle, jamais sur une invention
    const ETINCELLE = readFileSync('src/components/equipes/Etincelle.jsx', 'utf8')
    expect(ETINCELLE).toContain('if (serie.length < 2) return null')
    expect(EMPLOYES).toContain('<Etincelle valeurs={seriePresents} />')
    // les quatorze jours sont lus pour de vrai, zéros compris
    expect(EMPLOYES).toContain('for (let i = 13; i >= 0; i -= 1)')
    // le chiffre et son écart vivent sur la même ligne
    expect(EMPLOYES).toContain('empv3-kpi-ligne')
    expect(EMPLOYES).toContain('empv3-ecart empv3-ecart--')
  })

  it('la masse salariale se lit en barres couchées, montant écrit au bout', () => {
    expect(EMPLOYES).toContain('empv3-rang-ligne')
    expect(EMPLOYES).toContain('empv3-rang-montant')
    // plus de barres verticales sans graduation : elles cachaient le montant
    expect(EMPLOYES).not.toContain('empv3-histogramme')
    expect(EMPLOYES).not.toContain('empv3-colonne-barre')
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    expect(CSS_EMP).toMatch(/\.empv3-rang-ligne \{[\s\S]{0,120}grid-template-columns/)
  })

  it('le planning se pilote : la semaine précédente s’ouvre, le futur se refuse', () => {
    expect(EMPLOYES).toContain('aria-label="La semaine précédente"')
    expect(EMPLOYES).toContain('aria-label="La semaine suivante"')
    expect(EMPLOYES).toContain('setDecalageSemaine((n) => Math.min(0, n + 1))')
    expect(EMPLOYES).toContain('Semaine du ')
    // la lecture suit le décalage, sinon on afficherait deux semaines à la fois
    expect(EMPLOYES).toContain('decalageSemaine * 7')
    expect(EMPLOYES).toMatch(/\}, \[employes, decalageSemaine\]\)/)
  })

  it('entoure l’en-tête du bandeau bogolan, et n’y met aucun sélecteur d’entreprise', () => {
    // le sélecteur est parti : il vit dans la coque de l'application
    expect(EMPLOYES).not.toContain('<EnterpriseSwitcher')
    expect(EMPLOYES).not.toContain('empv3-entete-entreprise')

    // le bandeau du dashboard, en haut et en bas du bloc
    expect(EMPLOYES).toContain('empv3-entete-bandeau')

    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    const bandeau = CSS_EMP.slice(CSS_EMP.indexOf('LE BANDEAU BOGOLAN DE L'))
    expect(bandeau).toContain("/images/paie-bogolan-haut.webp")
    expect(bandeau).toContain("/images/paie-bogolan-bas.webp")
  })

  it('tient sur tous les écrans : le rail devient une barre basse sous 820 px', () => {
    const CSS_EMP = readFileSync('src/pages/EmployesV3.css', 'utf8')
    const ecrans = CSS_EMP.slice(CSS_EMP.indexOf('LA PAGE SUR TOUS LES ÉCRANS'))
    // quatre paliers, du plus large au plus étroit
    for (const largeur of ['1024px', '820px', '760px', '520px']) {
      expect(ecrans).toContain(`max-width: ${largeur}`)
    }
    // ⚠️ le rail n'est plus dessiné ici : il vit dans SidebarUnique.css.
    // Ce qui reste vrai, c'est que la page tient sur petits écrans.
    const petit = ecrans.slice(ecrans.indexOf('max-width: 820px'))
    expect(petit.length).toBeGreaterThan(100)
    // et la grille de la semaine défile au lieu de s'écraser
    expect(ecrans).toMatch(/\.empv3-semaine \{ overflow-x: auto/)
  })

  it('ouvre la liste sous un en-tête en bloc, sans barre d’onglets', async () => {
    await monterPage()
    // plus d'onglets dans la page : la navigation vit dans le rail
    expect(hote.querySelectorAll('.empv2-onglet')).toHaveLength(0)
    expect(hote.querySelector('.empv2-tetes')).toBeNull()
    expect(hote.querySelector('.nav3-pastille')).toBeNull()

    // l'en-tête est un bloc : étiquette, titre qui occupe la place, compte, actions
    const entete = hote.querySelector('.empv3-entete')
    expect(entete, 'l’en-tête en bloc').not.toBeNull()
    expect(entete.querySelector('.empv3-entete-eyebrow').textContent).toContain('Équipe')
    const titre = entete.querySelector('h1.empv3-entete-titre')
    expect(titre.textContent).toContain('Employés')
    expect(titre.querySelector('.empv3-entete-compte').textContent).toContain('0 employé')
    expect(entete.querySelector('.empv3-entete-actions')).not.toBeNull()

    expect(hote.querySelector('.empv2-annuaire')).not.toBeNull()
    expect(hote.querySelector('.empv2-vide')).not.toBeNull()
  })

  it('passe aux équipes et aux tâches depuis le rail, et re-cliquer rabat sur la liste', async () => {
    await monterPage()
    const vue = (nom) => hote.querySelector(`.sb-rail-sous[aria-label="Vue ${nom}"]`)

    await act(async () => vue('Équipes').click())
    expect(vue('Équipes').getAttribute('aria-current')).toBe('page')
    expect(hote.textContent).toContain('Nouvelle équipe')
    expect(hote.querySelector('.empv2-annuaire')).toBeNull()

    // le 22/11 a étendu aux Équipes ce que le 21/11 posait aux Tâches : pas
    // d'en-tête de page sur un onglet qui a sa propre tête cerclée
    expect(hote.querySelector('.empv3-entete')).toBeNull()
    expect(hote.querySelector('.empv3-entete-pancarte')).toBeNull()
    const teteEquipes = hote.querySelector('.eqv2-tete')
    expect(teteEquipes.querySelector('h1.eqv2-titre').textContent).toBe('Équipes')
    // les quatre chiffres vivent DANS la tête, cerclés avec le titre
    expect(teteEquipes.querySelector('.eqv2-kpis')).not.toBeNull()
    // et l'action de création est descendue dans la barre d'outils de l'onglet,
    // puisque celle de l'en-tête ne se monte plus ici
    expect(hote.querySelector('.eqv2-actions .empv2-nouvel').textContent).toContain('Nouvelle équipe')

    // re-cliquer la vue active rabat sur la liste
    await act(async () => hote.querySelector('.sb-rail-sous[aria-current="page"]').click())
    expect(hote.querySelectorAll('.sb-rail-sous[aria-current="page"]')).toHaveLength(0)
    expect(hote.querySelector('.empv2-annuaire')).not.toBeNull()
    // l'en-tête de page est revenu avec la liste : il n'a pas bougé d'un octet
    expect(hote.querySelector('.empv3-entete')).not.toBeNull()

    await act(async () => vue('Tâches').click())
    expect(vue('Tâches').getAttribute('aria-current')).toBe('page')
    expect(hote.textContent).toContain('Nouvelle tâche')

    // depuis le 21/11 : sur l'onglet Tâches, l'en-tête de page ne se monte PAS.
    // Un seul en-tête cerclé par écran — c'est la tête de l'onglet qui occupe le
    // haut de la page, et le bouton « Nouvelle tâche » du bandeau doublait déjà
    // celui de la barre d'outils.
    expect(hote.querySelector('.empv3-entete')).toBeNull()
    expect(hote.querySelector('.empv3-entete-pancarte')).toBeNull()
    // la tête de l'onglet porte le titre, au premier niveau : le h1 partait avec
    // l'en-tête d'annuaire, l'écran ne doit pas rester sans titre
    const tete = hote.querySelector('.tqv2-tete')
    expect(tete.querySelector('h1.tqv2-titre').textContent).toBe('Tâches')
    // les quatre chiffres vivent dans cette tête, pas sous elle
    expect(tete.querySelector('.tqv2-kpis')).not.toBeNull()
  })

  it('pose les onglets en pastilles, sans titre ni trait de points', () => {
    expect(EMPLOYES).not.toContain('emp-onglets-fil')
    expect(EMPLOYES).not.toContain('emp-onglets-titre')
    expect(EMPLOYES).not.toContain('Sommaire')
    // l'onglet actif porte le contour 2 px espresso (D-016), pas un fond or
    expect(REFONTE_CSS).toMatch(/\.empv2-onglet\[aria-current='page'\] \{[^}]*border: var\(--charte-trait\) solid var\(--charte-encre\)/)
  })

  it('affiche la coque : le rail des rubriques et les pastilles des pages', async () => {
    // la sidebar détecte la page active via l'adresse : on la monte
    // sur /employes, comme dans l'application (le helper monte sur /)
    await act(async () => racine.unmount())
    hote.remove()
    hote = document.createElement('div')
    document.body.append(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine.render(
        <MemoryRouter initialEntries={['/employes']}>
          <ThemeProvider>
            <Employes />
          </ThemeProvider>
        </MemoryRouter>,
      )
    })
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve() })
    // la coque : LA SIDEBAR UNIQUE (son choix du 24/11), pas un rail maison
    const rail = hote.querySelector('.sb-rail')
    expect(rail, 'le rail de la sidebar unique').not.toBeNull()
    // ⚠️ le haut du rail porte SOIT la bande d'entreprise (nom à la verticale,
    // sa maquette du 24/11), SOIT le logo quand aucune entreprise n'est chargée.
    const marque = rail.querySelector('.sb-rail-logo') || rail.querySelector('.se-bande')
    expect(marque, 'une marque en haut du rail').not.toBeNull()
    const rubriques = [...rail.querySelectorAll('.sb-rail-item')].map((b) => b.getAttribute('aria-label'))
    expect(rubriques).toContain('Équipe')
    expect(rubriques).toContain('Temps de travail')
    expect(rail.querySelector('.sb-rail-item.is-actif').getAttribute('aria-label')).toBe('Équipe')
    // et l'ancien rail écrit en dur a bien disparu
    expect(hote.querySelector('.nav3-rail')).toBeNull()

    // la barre de raccourcis et ses pastilles ont quitté la page
    expect(hote.querySelector('.nav3-haut')).toBeNull()
    expect(hote.querySelectorAll('.nav3-pastille')).toHaveLength(0)

    // les deux vues de la page vivent dans le rail, sous un filet
    const vues = [...rail.querySelectorAll('.sb-rail-sous')].map((b) => b.getAttribute('aria-label'))
    expect(vues).toEqual(['Vue Équipes', 'Vue Tâches'])
  })

  it('pose le bouton clair / sombre dans le rail, et une seule fois', async () => {
    await monterPage()
    const rail = hote.querySelector('.sb-rail')
    const themes = [...rail.querySelectorAll('button[aria-pressed]')]
    expect(themes).toHaveLength(1)
    const theme = themes[0]
    expect(theme.getAttribute('aria-label')).toMatch(/mode (clair|sombre)/)
    const avant = theme.getAttribute('aria-label')
    await act(async () => theme.click())
    expect(theme.getAttribute('aria-label')).not.toBe(avant)
    // et plus aucun second bouton de thème dans la page
    expect(hote.querySelector('button.empv2-theme')).toBeNull()
    expect([...hote.querySelectorAll('button')].filter((b) => /^(Clair|Sombre)$/.test(b.textContent.trim()))).toHaveLength(0)
  })

  it('porte l’action de la vue affichée — l’en-tête pour l’annuaire, la barre d’outils pour les deux onglets', async () => {
    await monterPage()
    expect(boutonAvec('Nouvel employé')).toBeTruthy()

    await act(async () => hote.querySelector('.sb-rail-sous[aria-label="Vue Équipes"]').click())
    expect(boutonAvec('Nouvelle équipe')).toBeTruthy()
    expect(boutonAvec('Nouvel employé')).toBeFalsy()

    await act(async () => hote.querySelector('.sb-rail-sous[aria-label="Vue Tâches"]').click())
    expect(boutonAvec('Nouvelle tâche')).toBeTruthy()
  })

  it('sépare les chiffres par un filet, pas par un point de texte', () => {
    expect(CSS).toMatch(/\.rg-chiffre \+ \.rg-chiffre \{[^}]*border-left/)
    expect(CSS).toMatch(/\.rg-chiffre-valeur \{[^}]*font-family: Georgia/)
    expect(CSS).toMatch(/\.rg-chiffre-valeur \{[^}]*tabular-nums/)
  })

  it('chiffre chaque vue par des nombres comptés, jamais par une phrase creuse', async () => {
    etat.taches = [tache(), tache({ id: 't-2', title: 'Clôturer le mois', status: 'validated' })]
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    const kpis = [...hote.querySelectorAll('.tqv2-kpis .empv2-kpi')]
    expect(kpis).toHaveLength(4)
    for (const kpi of kpis) {
      // un chiffre qui est un chiffre, une étiquette qui est une étiquette
      expect(kpi.querySelector('strong').textContent).toMatch(/^\d+$/)
      expect(kpi.querySelector('.empv2-kpi-libelle').textContent.trim()).not.toBe('')
    }
  })

  it('ne met aucune bande de raccourcis sur la page, ni en haut ni en bas', async () => {
    await monterPage()
    expect(hote.querySelector('[data-testid="raccourcis-pages"]')).toBeNull()
    expect(hote.querySelector('.empv2-raccourcis')).toBeNull()
  })

  it('n’a plus de cartes de chiffres ni de portraits à la place du registre', () => {
    expect(EMPLOYES).not.toContain('employes-portrait-grid')
    expect(EMPLOYES).not.toContain('EmployesPortraitCard')
    expect(EMPLOYES).not.toContain('EmployesExecutiveKpis')
    expect(EMPLOYES).not.toContain('EmployesAnalyticsCharts')
    expect(EMPLOYES).not.toContain('EmployesExecutiveKpis')
    expect(EMPLOYES).not.toContain('employes-framed-card')
  })

  it('la sidebar précède le contenu, et les rubriques restent celles de l’application', () => {
    const sidebar = EMPLOYES.indexOf('<SidebarUnique')
    const contenu = EMPLOYES.indexOf('<main className="empv2-main"')
    expect(sidebar).toBeGreaterThan(0)
    expect(contenu).toBeGreaterThan(sidebar)
    // les mêmes rubriques que le tableau de bord — dans la fabrique partagée
    // depuis le 08/11 : la fiche employé monte le même rail, les deux pages
    // lisent LA même liste, le contrat se vérifie donc à sa source unique.
    const rubriques = readFileSync('src/components/coque/sectionsNavAdmin.js', 'utf8')
    expect(rubriques).toContain("label: 'Accueil'")
    expect(rubriques).toContain("label: 'Temps de travail'")
    expect(rubriques).toContain("label: 'En-Check interne'")
    // et la fiche employé reprend exactement la même coque
    const FICHE = readFileSync('src/pages/Employee360.jsx', 'utf8')
    expect(FICHE).toContain('<SidebarUnique')
    expect(FICHE).toContain('<main className=\"empv2-main\"')
  })
})

describe('la feuille de style de la page Employés est saine', () => {
  it('ses accolades s’équilibrent (un « } » orphelin a cassé le build une fois)', () => {
    const css = readFileSync('src/pages/EmployesV3.css', 'utf8')
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '')
    const ouvrantes = (sansCommentaires.match(/{/g) || []).length
    const fermantes = (sansCommentaires.match(/}/g) || []).length
    expect(fermantes).toBe(ouvrantes)
  })
})

// ═══════════════════════════════════════════════════════════
// ④ bis La fiche de tâche — la page de détail, devenue fenêtre
// ═══════════════════════════════════════════════════════════

const ficheComplete = (surcharge = {}) => ({
  ...tache(),
  description: 'Sortir les bacs, puis rincer le chariot',
  seen_at: '2026-04-15T14:19:00.000Z',
  started_at: '2026-04-15T14:25:00.000Z',
  completed_at: null,
  actual_duration_seconds: 1500,
  expected_duration_minutes: 48,
  performance_score: 92,
  requires_proof: true,
  requires_comment: false,
  allow_image: true,
  allow_document: false,
  allow_camera_photo: true,
  created_by_admin: { first_name: 'Buta', last_name: 'code' },
  assigned_employee: { first_name: 'Hippo', last_name: 'Biyokila', position: 'Agent' },
  comments: [
    { id: 'c-1', author_type: 'admin', comment: 'Merci de finir avant 17 h.', created_at: '2026-04-15T15:00:00.000Z' },
    { id: 'c-2', author_type: 'employee', comment: 'Chariot cassé, réparé.', created_at: '2026-04-15T16:00:00.000Z' },
  ],
  attachments: [
    { id: 'a-1', file_name: 'photo-bac.jpg', file_type: 'camera_photo', file_url: 'https://exemple.tld/1', uploaded_at: '2026-04-15T16:05:00.000Z' },
  ],
  activity_logs: [
    { id: 'l-1', action: 'tâche démarrée', actor_type: 'employee', created_at: '2026-04-15T14:25:00.000Z' },
  ],
  ...surcharge,
})

// remplir une saisie pilotée par React, comme le reste du dépôt
const ecrire = (el, valeur) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valeur)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const ouvrirFicheDepuisLaCarte = async (surcharge = {}, gens = []) => {
  etat.taches = [tache()]
  etat.fiche = ficheComplete(surcharge)
  await rendre(<TachesVue enterpriseId="ent-1" employes={gens} />)
  await act(async () => hote.querySelector('.tqv2-fiche-titre').click())
  return hote.querySelector('.tam-feuille--lecture')
}

describe('la fiche de tâche, posée sur le tableau', () => {
  it('cliquer la carte ouvre une FENÊTRE et ne quitte plus le tableau', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    expect(feuille).not.toBeNull()
    expect(feuille.getAttribute('role')).toBe('dialog')
    expect(feuille.getAttribute('aria-label')).toContain('Vérifier les extincteurs')
    // le tableau est toujours dessous : quatre colonnes vivantes
    expect(hote.querySelectorAll('.tqv2-colonne')).toHaveLength(4)
    // et c'est bien le parent qui est allé chercher la fiche complète
    expect(appels.filter((a) => a.type === 'getTaskById')).toEqual([{ type: 'getTaskById', id: 't-1' }])
  })

  it('écrit le statut, la priorité, le type et la catégorie en mots soulignés', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    const marques = [...feuille.querySelectorAll('.tam-marque')].map((m) => m.textContent)
    expect(marques).toEqual(['Assignée', 'Haute', 'Individuelle', 'Sécurité'])
    const rangee = feuille.querySelector('.tam-marques')
    // le ton porte un MOT à côté : la couleur seule ne dirait rien (C7)
    expect(rangee.getAttribute('data-ton')).toBe('neutre')
    expect(rangee.getAttribute('data-priorite')).toBe('high')
    expect(feuille.querySelector('.tam-marque--categorie')).not.toBeNull()
  })

  it('pose les huit mesures de la page, et dit le vide par un tiret', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte({ completed_at: null })

    const mesures = [...feuille.querySelectorAll('.tam-mesure')]
    expect(mesures).toHaveLength(8)
    const libelles = mesures.map((m) => m.querySelector('.tam-mesure-cle').textContent.trim())
    expect(libelles).toEqual([
      'Échéance', 'Durée prévue', 'Durée réelle', 'Performance',
      'Vue le', 'Démarrée le', 'Terminée le', 'Créée le',
    ])
    expect(mesures[1].querySelector('.tam-mesure-valeur').textContent).toBe('48 min')
    expect(mesures[2].querySelector('.tam-mesure-valeur').textContent).toBe('25 min')
    expect(mesures[3].querySelector('.tam-mesure-valeur').textContent).toBe('92%')
    // ce qui manque s'écrit, il n'est pas tu par une pastille vide
    const absente = mesures[6].querySelector('.tam-mesure-valeur')
    expect(absente.textContent).toBe('—')
    expect(absente.getAttribute('class')).toContain('tam-mesure-valeur--absente')
  })

  it('montre pièces jointes, exigences lues et les deux groupes de commentaires', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    expect(feuille.querySelector('.tam-piece-nom').textContent).toBe('photo-bac.jpg')
    expect(feuille.querySelector('.tam-piece-note').textContent).toContain('Photo caméra')
    // le geste est écrit, pas seulement dessiné
    expect(feuille.querySelector('.tam-piece-ouvrir').textContent).toBe('Ouvrir')
    const exigences = [...feuille.querySelectorAll('.tam-stat')].map((x) => x.textContent)
    expect(exigences).toHaveLength(5)
    expect(exigences[0]).toContain('Preuve requise')
    expect(exigences[0]).toContain('oui')
    expect(exigences[3]).toContain('non')
    const notes = [...feuille.querySelectorAll('.tam-note')]
    expect(notes).toHaveLength(2)
    expect(notes[0].getAttribute('data-auteur')).toBe('admin')
    expect(notes[1].querySelector('.tam-note-auteur').textContent).toBe('Employé')
    expect(notes[1].querySelector('.tam-note-texte').textContent).toContain('Chariot cassé')
  })

  it(' replie l’historique sur son titre et le déplie à la demande', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    const bouton = feuille.querySelector('.tam-repli')
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    expect(feuille.querySelector('.tam-journal')).toBeNull()
    await act(async () => bouton.click())
    expect(feuille.querySelector('.tam-repli').getAttribute('aria-expanded')).toBe('true')
    expect(feuille.querySelector('.tam-journal-action').textContent).toBe('tâche démarrée')
    expect(feuille.querySelector('.tam-journal-note').textContent).toContain('l’employé')
  })

  it('une tâche terminée offre Valider, et la seule action pleine de l’écran', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte({ status: 'completed' })
    const pied = feuille.querySelector('.tam-pied')
    expect([...pied.querySelectorAll('.tam-btn')].map((b) => b.textContent.trim())).toEqual(['Modifier', 'Rejeter', 'Valider'])
    expect(pied.querySelectorAll('.tam-btn--pleine')).toHaveLength(1)
    expect(pied.querySelector('.tam-btn--pleine').textContent).toContain('Valider')

    await act(async () => boutonAvec('Valider').click())
    expect(appels.some((a) => a.type === 'validateTask' && a.id === 't-1')).toBe(true)
    // après le geste, la liste ET la fiche repartent se recaler sur la base
    expect(appels.filter((a) => a.type === 'getTaskById').length).toBe(2)
  })

  it('une tâche sans action en attente met MODIFIER en action pleine', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    const pleine = feuille.querySelector('.tam-pied .tam-btn--pleine')
    expect(pleine.textContent).toContain('Modifier')
    expect(feuille.querySelector('.tam-btn--danger')).toBeNull()
  })

  it('le rejet demande un motif, écrit dans le service, et ne part pas vide', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte({ status: 'completed' })
    await act(async () => [...feuille.querySelectorAll('.tam-btn')].find((b) => b.textContent.includes('Rejeter')).click())
    const fenetre = hote.querySelector('[aria-label="Rejeter la tâche"]')
    expect(fenetre).not.toBeNull()
    const soumettre = [...fenetre.querySelectorAll('.tam-btn')].find((b) => b.textContent.includes('Rejeter'))
    // aucun appel tant que le motif manque : le bouton est tenu désactivé
    expect(soumettre.disabled).toBe(true)
    expect(appels.some((a) => a.type === 'rejectTask')).toBe(false)

    ecrire(fenetre.querySelector('textarea'), 'Preuve illisible')
    await act(async () => {
      fenetre.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(appels.some((a) => a.type === 'rejectTask' && a.motif === 'Preuve illisible')).toBe(true)
    // la fille fermée, la mère reste ouverte sous les yeux
    expect(hote.querySelector('[aria-label="Rejeter la tâche"]')).toBeNull()
    expect(hote.querySelector('.tam-feuille--lecture')).not.toBeNull()
  })

  it('réassigner une tâche rejetée envoie l’employé, l’échéance et le mot', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte(
      { status: 'rejected', rejection_reason: 'Bac manquant' },
      [{ id: 'emp-1', first_name: 'Awa', last_name: 'Dossou' }],
    )
    // la fiche porte le motif du rejet, en toutes lettres (à côté du banner
    // d'échéance, qui est l'autre charge de l'écran)
    const charges = [...feuille.querySelectorAll('.tam-charge-ligne')].map((c) => c.textContent)
    expect(charges.find((c) => c.includes('Bac manquant'))).toBeDefined()
    await act(async () => [...feuille.querySelectorAll('.tam-btn')].find((b) => b.textContent.includes('Réassigner')).click())
    const fenetre = hote.querySelector('[aria-label="Réassigner la tâche"]')
    expect(fenetre).not.toBeNull()
    const selecteur = fenetre.querySelector('select')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selecteur, 'emp-1')
    selecteur.dispatchEvent(new Event('change', { bubbles: true }))
    ecrire(fenetre.querySelector('input[type="datetime-local"]'), '2026-04-20T09:00')
    await act(async () => {
      fenetre.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    const appel = appels.find((a) => a.type === 'reassignRejectedTask')
    expect(appel.payload.new_employee_id).toBe('emp-1')
    expect(appel.payload.new_due_at).toBe('2026-04-20T09:00')
  })

  it('écrit un commentaire admin depuis la fiche, sans la refermer', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    const zone = feuille.querySelector('#tam-fiche-commentaire')
    ecrire(zone, 'Reprendre lundi')
    await act(async () => boutonAvec('Envoyer').click())
    expect(appels.some((a) => a.type === 'addTaskComment' && a.texte === 'Reprendre lundi')).toBe(true)
    expect(hote.querySelector('.tam-feuille--lecture')).not.toBeNull()
  })

  it('Échap la referme, et rend l’adresse au tableau', async () => {
    const feuille = await ouvrirFicheDepuisLaCarte()
    expect(feuille).not.toBeNull()
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(hote.querySelector('.tam-feuille--lecture')).toBeNull()
  })

  it('une arrivée par le lien « ?tache=<id> » ouvre la fiche sans clic', async () => {
    etat.taches = [tache()]
    etat.fiche = ficheComplete()
    await act(async () => racine.render(
      <MemoryRouter initialEntries={['/employes?vue=taches&tache=t-1']}>
        <TachesVue enterpriseId="ent-1" employes={[]} />
      </MemoryRouter>,
    ))
    expect(hote.querySelector('.tam-feuille--lecture')).not.toBeNull()
    expect(appels.some((a) => a.type === 'getTaskById' && a.id === 't-1')).toBe(true)
  })

  it('ne montre pas une fenêtre sur une tâche introuvable', async () => {
    etat.taches = [tache()]
    etat.erreurFiche = new Error('panne')
    await rendre(<TachesVue enterpriseId="ent-1" employes={[]} />)
    await act(async () => hote.querySelector('.tqv2-fiche-titre').click())
    expect(hote.querySelector('.tam-feuille--lecture')).toBeNull()
  })

  it('fermer la fiche n’ouvre plus JAMAIS une page : la page est morte', () => {
    expect(existsSync('src/pages/TaskDetail.jsx')).toBe(false)
    expect(APP).not.toMatch(/import\s+TaskDetail\s+from/)
    expect(APP).not.toContain('<TaskDetail')
    // l'adresse, elle, reste vivante et porte l'identifiant jusqu'à l'onglet
    expect(APP).toMatch(/path=["']\/taches\/:taskId["']/)
    expect(APP).toMatch(/new URLSearchParams\(\{ vue: 'taches', tache: taskId/)
    // plus aucune carte, ni aucun résultat de recherche, ne navigue vers /taches/<id>
    const TACHES_VUE = readFileSync('src/components/taches/TachesVue.jsx', 'utf8')
    expect(TACHES_VUE).not.toMatch(/navigate\(`\/taches\//)
    const ASSISTANT = readFileSync('src/components/AssistantDock.jsx', 'utf8')
    expect(ASSISTANT).toContain('/employes?vue=taches&tache=')
    const SPOTLIGHT = readFileSync('src/components/SpotlightSearchModal.jsx', 'utf8')
    expect(SPOTLIGHT).toContain('/employes?vue=taches&tache=')
  })

  it('la fenêtre ne parle à aucun service : les gestes remontent au parent', () => {
    const MODALES = readFileSync('src/components/taches/TachesModales.jsx', 'utf8')
    const tete = MODALES.slice(0, MODALES.indexOf('export function FicheTacheModal'))
    expect(tete.match(/import\s*\{[\s\S]*?\}\s*from '\.\.\/\.\.\/services\/taskService'/)[0])
      .not.toMatch(/getTaskById|validateTask\(|rejectTask|addTaskComment/)
    expect(MODALES).not.toMatch(/await\s+(validateTask|rejectTask|reassignRejectedTask|addTaskComment)\(/)
  })

  it('habille la fiche dans la feuille, pas dans le JS, et sans couleur en dur', () => {
    const FEUILLE = readFileSync('src/components/taches/TachesModales.css', 'utf8')
    const depart = FEUILLE.indexOf('.tam-feuille--lecture')
    const fiche = FEUILLE.slice(depart, FEUILLE.indexOf('}', depart))
    // la teinte est une donnée : elle entre en variable, la feuille en fait un trait
    expect(fiche).toMatch(/--tam-teinte: var\(--charte-bordure\)/)
    // le raccourci `background:` effacerait la bande de colle : interdit ici
    expect(fiche).not.toMatch(/^\s*background:\s/gm)
    // aucun #hexadécimal, même en commentaire (C1)
    expect(FEUILLE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    // aucun mot posé sur une teinte : les marques sont d'encre ou de doux
    expect(FEUILLE).toMatch(/\.tam-marque \{[^}]*color: var\(--charte-douce\)/s)
    // et le feutre sous le mot est une ombre à zéro de flou (C9)
    expect(FEUILLE).toMatch(/box-shadow: inset 0 -2px 0 0 /)
    // aucune valeur de police écrite en dur : la fiche ne connaît que les jetons
    expect(FEUILLE).not.toMatch(/font-size: [0-9]/)
  })
})
