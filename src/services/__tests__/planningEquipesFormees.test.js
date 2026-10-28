// ═══════════════════════════════════════════════════════════
// LES ÉQUIPES FORMÉES DANS EMPLOYÉS → ÉQUIPES, SÉLECTIONNABLES DANS LE PLANNING
//
//   ① le planning lit les vraies équipes (tables teams / team_members) ;
//   ② l'équipe formée passe devant l'affectation locale et le département ;
//   ③ le filtre « Afficher » propose un groupe « Équipes formées » ;
//   ④ une équipe formée ne se renomme ni ne se supprime depuis le planning —
//     elle s'ouvre dans la page Équipes ;
//   ⑤ les équipes formées vides restent visibles, en tête de liste ;
//   ⑥ — round 48 — une équipe formée, c'est ses MEMBRES : un département
//     qui porte le même nom fait une barre à part et n'absorbe personne.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  SANS_EQUIPE,
  cleEquipeFormee,
  equipeFormeeDe,
  equipeParEmploye,
  equipesDuPlanning,
  estEquipeFormee,
  groupeDeLEmploye,
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
    // Une personne dans deux équipes : la première gagne, elle ne peut pas
    // apparaître dans deux barres à la fois.
    const table = equipeParEmploye([
      { id: 't1', name: 'VENTE', members: [{ employee_id: 'e7' }] },
      { id: 't2', name: 'RECETTE', members: [{ employee_id: 'e7' }] },
    ])
    expect(table.get('e7')).toMatchObject({ id: 't1', nom: 'VENTE' })
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
// 2 bis. « Équipe de vente » n'est pas « ÉQUIPE DE VENTE »
// ───────────────────────────────────────────────────────────

describe('le défaut du round 48 : des non-membres dans l’équipe formée', () => {
  // Relevé dans Employés → Équipes : 3 membres.
  const equipeVente = {
    id: 'team-vente',
    name: 'Équipe de vente',
    members: [{ employee_id: 'hippo' }, { employee_id: 'lulu' }, { employee_id: 'emma' }],
  };
  const table = equipeParEmploye([equipeVente]);
  // Relevé dans le planning : 4 personnes, avec deux intrus portés par le
  // département « VENTE » de leur fiche.
  const equipe = [
    { id: 'boss', first_name: 'Boss', last_name: 'buta', department: 'VENTE' },
    { id: 'emma', first_name: 'Emma', last_name: 'BAYLE', department: 'VENTE' },
    { id: 'hippo', first_name: 'Hippo', last_name: 'BIYOKILA', department: 'VENTE' },
    { id: 'kone', first_name: 'Koné', last_name: 'KOMI', department: 'VENTE' },
    { id: 'lulu', first_name: 'lulu', last_name: 'lula', department: null },
  ];

  const barreDe = (emp) => groupeDeLEmploye(emp, { equipeParEmploye: table });

  it('l’équipe formée ne contient que ses trois membres', () => {
    const membres = equipe.filter((emp) => barreDe(emp).cle === cleEquipeFormee(equipeVente));
    expect(membres.map((emp) => emp.id)).toEqual(['emma', 'hippo', 'lulu']);
  });

  it('Boss buta et Koné KOMI gardent une barre à part', () => {
    expect(barreDe(equipe[0])).toEqual({
      cle: 'departement:VENTE',
      titre: 'VENTE',
      type: 'departement',
    });
    expect(barreDe(equipe[3]).cle).toBe('departement:VENTE');
  });

  it('les quatre ne sont plus comptés dans la même barre', () => {
    const barres = new Map();
    equipe.forEach((emp) => {
      const cle = barreDe(emp).cle;
      barres.set(cle, (barres.get(cle) || 0) + 1);
    });
    expect(barres.get('equipe:team-vente')).toBe(3);
    expect(barres.get('departement:VENTE')).toBe(2);
  });

  it('un membre sans département ne tombe pas dans « sans équipe »', () => {
    expect(equipeFormeeDe(equipe[4], table).nom).toBe('Équipe de vente');
    expect(barreDe(equipe[4]).titre).toBe('Équipe de vente');
  });
})

// ───────────────────────────────────────────────────────────
// 3. Le câblage dans la page Planning
// ───────────────────────────────────────────────────────────

describe('le planning lit les vraies équipes', () => {
  it('importe la lecture et les repères de barre', () => {
    expect(planning).toContain('import { getTeamsPourPlanning } from "../services/teamService"')
    expect(planning).toContain('cleEquipeFormee,')
    expect(planning).toContain('groupeDeLEmploye,')
    expect(planning).toContain('SANS_EQUIPE,')
  })

  it('charge les équipes au même moment que les employés', () => {
    expect(planning).toContain('const { data: equipesData } = await getTeamsPourPlanning(idsEquipes)')
    expect(planning).toContain('setEquipesFormees(equipesData || [])')
  })

  it('ne relit pas les équipes à chaque changement de semaine', () => {
    expect(planning).toContain('if (cleEquipes !== equipesCleRef.current)')
    expect(planning).toContain('equipesCleRef.current = cleEquipes')
  })

  it('chaque personne est rangée par la clé de son équipe effective', () => {
    expect(planning).toContain('const equipesParEmploye = useMemo(() => equipeParEmploye(equipesFormees)')
    expect(planning).toContain('groupeDeLEmploye(emp, {')
    expect(planning).toContain('equipeParEmploye: equipesParEmploye,')
    expect(planning).toContain('affectations: teamAssignments,')
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
    expect(planning).toContain('cle: cleEquipeFormee(equipe),')
    expect(planning).toContain('const annoncees = equipesFormees.map((equipe) => ({')
  })

  it('une barre par clé : deux équipes ne fusionnent pas', () => {
    expect(planning).toContain('const rang = liste.findIndex((entree) => entree.key === groupe.cle)')
  })
})

describe('choisir une équipe formée filtre vraiment ses membres', () => {
  it('le filtre suit la barre choisie, pas son nom', () => {
    // Corrigé au round 48 : comparer les noms faisait entrer dans l'équipe
    // de vente les personnes d'un département homonyme.
    expect(planning).toContain('const membresDuGroupeFocalise = useMemo(() => {')
    expect(planning).toContain('return new Set((groupe?.employees || []).map((membre) => membre.id));')
    expect(planning).toContain('correspondAuFocus(emp, focusFilter, membresDuGroupeFocalise)')
    expect(planning).not.toContain('String(focusFilter.value || "").toUpperCase()')
  })

  it('l’option porte la clé de la barre, jamais son seul nom', () => {
    expect(planning).toContain('value={`team:${g.key}`}')
    expect(planning).toContain('const groupe = employeeGroups.find((g) => g.key === cle)')
    expect(planning).toContain('setFocusFilter({ type: "team", value: cle, label: groupe?.title || cle })')
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
