// ═══════════════════════════════════════════════════════════
// LES ÉQUIPES FORMÉES DANS EMPLOYÉS → ÉQUIPES, SÉLECTIONNABLES DANS LE PLANNING
//
//   ① le planning lit les vraies équipes (tables teams / team_members) ;
//   ② l'équipe formée passe devant l'affectation locale et le département ;
//   ③ le filtre « Afficher » propose un groupe « Équipes formées » ;
//   ④ une équipe formée ne se renomme ni ne se supprime depuis le planning —
//     elle s'ouvre dans la page Équipes ;
//   ⑤ les équipes formées vides restent visibles, en tête de liste.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  SANS_EQUIPE,
  equipeParEmploye,
  equipesDuPlanning,
  estEquipeFormee,
  nomDeGroupe,
  nomEquipeDe,
} from '../../lib/planningEquipes'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const planning = lire('src/pages/Planning.jsx')
const planningCss = lire('src/pages/PlanningAfroTech.css')
const service = lire('src/services/teamService.js')

// ───────────────────────────────────────────────────────────
// 1. La lecture des équipes formées
// ───────────────────────────────────────────────────────────

const equipesBrutes = [
  {
    id: 't1',
    name: 'PHARMACIE',
    color: '#4F9389',
    members: [{ employee_id: 'e2' }, { employee_id: 'e3' }],
  },
  {
    id: 't2',
    name: 'INFORMATIQUE CHOQUE',
    color: null,
    members: [{ employee: { id: 'e1' } }],
  },
  { id: 't3', name: '  ', members: [] },
]

describe('le planning comprend les équipes de la page Équipes', () => {
  it('garde les noms, les couleurs et les membres', () => {
    const equipes = equipesDuPlanning(equipesBrutes)
    expect(equipes.map((e) => e.nom)).toEqual(['PHARMACIE', 'INFORMATIQUE CHOQUE'])
    expect(equipes[0].couleur).toBe('#4F9389')
    expect(equipes[0].membres).toEqual(['e2', 'e3'])
    expect(equipes[1].membres).toEqual(['e1'])
  })

  it('accepte les deux écritures (name/nom, members/membres)', () => {
    const equipes = equipesDuPlanning([
      { id: 'a', nom: 'RECETTE', couleur: '#E0C9A0', membres: ['e9'] },
    ])
    expect(equipes[0]).toEqual({
      id: 'a',
      nom: 'RECETTE',
      couleur: '#E0C9A0',
      membres: ['e9'],
    })
  })

  it('ignore une équipe sans nom et ne plante sur rien', () => {
    expect(equipesDuPlanning([{ id: 'x', name: '' }])).toEqual([])
    expect(equipesDuPlanning(null)).toEqual([])
    expect(equipesDuPlanning(undefined)).toEqual([])
    expect(equipesDuPlanning([{}])).toEqual([])
  })

  it('ne compte jamais deux fois la même personne', () => {
    const table = equipeParEmploye([
      { id: 't1', name: 'VENTE', members: [{ employee_id: 'e7' }] },
      { id: 't2', name: 'RECETTE', members: [{ employee_id: 'e7' }] },
    ])
    expect(table.get('e7')).toBe('VENTE')
    expect(table.size).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────
// 2. À quelle équipe appartient une personne
// ───────────────────────────────────────────────────────────

describe('l’équipe formée passe devant', () => {
  const table = equipeParEmploye([
    { id: 't1', name: 'PHARMACIE', members: [{ employee_id: 'e1' }] },
  ])

  it('l’équipe formée gagne sur le département', () => {
    const employe = { id: 'e1', department: 'VENTE' }
    expect(nomEquipeDe(employe, { equipeParEmploye: table })).toBe('PHARMACIE')
  })

  it('l’équipe formée gagne sur l’affectation locale du planning', () => {
    const employe = { id: 'e1', department: 'VENTE' }
    const nom = nomEquipeDe(employe, {
      equipeParEmploye: table,
      affectations: { e1: 'RECETTE' },
    })
    expect(nom).toBe('PHARMACIE')
  })

  it('sans équipe formée, l’affectation locale prend le relais', () => {
    const employe = { id: 'e2', department: 'vente' }
    expect(
      nomEquipeDe(employe, { equipeParEmploye: table, affectations: { e2: 'RECETTE' } })
    ).toBe('RECETTE')
  })

  it('sans rien, le département, en capitales', () => {
    expect(nomEquipeDe({ id: 'e3', department: ' vente ' }, { equipeParEmploye: table })).toBe(
      'VENTE'
    )
  })

  it('sans département ni équipe, null puis « SANS ÉQUIPE »', () => {
    expect(nomEquipeDe({ id: 'e4' }, { equipeParEmploye: table })).toBeNull()
    expect(nomDeGroupe({ id: 'e4' }, { equipeParEmploye: table })).toBe(SANS_EQUIPE)
  })

  it('une table absente ne fait pas planter la lecture', () => {
    expect(nomEquipeDe({ id: 'e5', department: 'RECETTE' })).toBe('RECETTE')
    expect(nomEquipeDe(null)).toBeNull()
  })
})

describe('reconnaître une équipe formée', () => {
  it('ignore la casse et les espaces', () => {
    const equipes = [{ id: 't1', name: 'Pharmacie' }]
    expect(estEquipeFormee('PHARMACIE', equipes)).toBe(true)
    expect(estEquipeFormee(' pharmacie ', equipes)).toBe(true)
    expect(estEquipeFormee('Vente', equipes)).toBe(false)
    expect(estEquipeFormee('', equipes)).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────
// 3. Le câblage dans la page Planning
// ───────────────────────────────────────────────────────────

describe('le planning lit les vraies équipes', () => {
  it('importe la lecture et le module d’équipes', () => {
    expect(planning).toContain('import { getTeamsPourPlanning } from "../services/teamService"')
    expect(planning).toContain(
      'import { equipeParEmploye, estEquipeFormee, nomEquipeDe, SANS_EQUIPE } from "../lib/planningEquipes"'
    )
  })

  it('charge les équipes au même moment que les employés', () => {
    expect(planning).toContain('const { data: equipesData } = await getTeamsPourPlanning(idsEquipes)')
    expect(planning).toContain('setEquipesFormees(equipesData || [])')
  })

  it('ne relit pas les équipes à chaque changement de semaine', () => {
    expect(planning).toContain('if (cleEquipes !== equipesCleRef.current)')
    expect(planning).toContain('equipesCleRef.current = cleEquipes')
  })

  it('le nom d’équipe effectif passe par nomEquipeDe', () => {
    expect(planning).toContain('const equipesParEmploye = useMemo(() => equipeParEmploye(equipesFormees)')
    expect(planning).toContain('nomEquipeDe(emp, { equipeParEmploye: equipesParEmploye, affectations: teamAssignments })')
  })
})

describe('le filtre « Afficher » montre les équipes formées', () => {
  it('un groupe dédié, au-dessus des départements', () => {
    expect(planning).toContain('Équipes formées · page Équipes')
    expect(planning).toContain('Départements et équipes du planning')
    expect(planning).toContain('.filter((g) => g.estFormee)')
    expect(planning).toContain('.filter((g) => !g.estFormee)')
  })

  it('les équipes formées vides restent visibles', () => {
    expect(planning).toContain('equipesFormees.forEach((equipe) => poser(equipe?.name))')
    expect(planning).toContain('const cle = nom.toUpperCase()')
  })

  it('une seule barre par équipe, quelle que soit la casse', () => {
    // Le groupe « Pharmacie » et un département « PHARMACIE » ne doivent
    // pas faire deux en-têtes.
    expect(planning).toContain('if (!groupesMap.has(cle)) groupesMap.set(cle, { title: nom, employees: [] })')
  })
})

describe('choisir une équipe formée filtre vraiment ses membres', () => {
  it('la comparaison ignore la casse du nom', () => {
    // Le groupe porte le nom de l'équipe (« Pharmacie ») et un département
    // s'écrit en capitales : sans cette comparaison, des personnes
    // manqueraient au filtre alors qu'elles sont comptées dans la barre.
    expect(planning).toContain('String(focusFilter.value || "").toUpperCase()')
  })

  it('le périmètre se recalcule quand les équipes arrivent', () => {
    expect(planning).toContain(
      '[visibleEmployees, focusFilter, teamAssignments, equipesParEmploye]'
    )
  })
})

describe('une équipe formée ne se gère pas depuis le planning', () => {
  it('elle porte sa marque', () => {
    expect(planning).toContain('className="sk-group-badge"')
    expect(planning).toContain('Équipe formée')
    expect(planningCss).toContain('.sk-group-badge')
  })

  it('elle renvoie vers la page Équipes au lieu de se supprimer', () => {
    expect(planning).toContain('{group.estFormee ? (')
    expect(planning).toContain('Voir dans Équipes')
    expect(planning).toContain('navigate("/employes?vue=equipes")')
  })

  it('le modal d’équipe locale propose la page officielle', () => {
    expect(planning).toContain('Page Équipes')
    expect(planning).toContain('les équipes officielles se créent dans')
  })
})

// ───────────────────────────────────────────────────────────
// 4. La lecture en base
// ───────────────────────────────────────────────────────────

describe('getTeamsPourPlanning lit les équipes de plusieurs entreprises', () => {
  it('une requête pour les équipes, une pour les membres', () => {
    expect(service).toContain('export async function getTeamsPourPlanning(enterpriseIds = [])')
    expect(service).toContain(".from('teams')")
    expect(service).toContain(".from('team_members')")
    expect(service).toContain(".in('enterprise_id', ids)")
    expect(service).toContain(".in('team_id', teams.map((team) => team.id))")
  })

  it('ne retient que les équipes vivantes et les membres présents', () => {
    expect(service).toContain(".eq('is_active', true)")
    expect(service).toContain(".is('deleted_at', null)")
    expect(service).toContain(".is('removed_at', null)")
  })

  it('rend la même forme que getTeams (members[].employee.id)', () => {
    expect(service).toContain('members: membresParEquipe[team.id] || []')
    expect(service).toContain('employee: { id: membre.employee_id }')
  })

  it('sans entreprise, ne lance aucune requête', () => {
    expect(service).toContain('if (ids.length === 0) return { data: [], error: null }')
  })

  it('une table de membres en panne ne casse pas le planning', () => {
    expect(service).toContain('return { data: teams.map((team) => ({ ...team, members: [] })), error: null }')
  })
})
