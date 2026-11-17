// ═══════════════════════════════════════════════════════════
// FICHE EMPLOYÉ (360°) — la logique pure de /employes/:id
//
// Ce que ces tests défendent :
//  · aucune donnée inventée (ancienneté nulle ≠ « 0 mois ») ;
//  · « absent » seulement après la fin du poste (doctrine P0) ;
//  · jamais de pourcentage sur un échantillon trop mince ;
//  · le fil d'activité trie et regroupe sans rien ajouter.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  construireFilActivite,
  etatPresenceDuJour,
  joursPointesDuMois,
  joursPrevusDepuisPlans,
  libelleAnciennete,
  libelleJourRelatif,
  listeJoursInclusifs,
  pourcentageSiEchantillon,
  retardDuJour,
  grillePresenceMois,
} from '../../lib/employee360'

describe('listeJoursInclusifs — itération de dates locales', () => {
  it('couvre le mois, y compris le passage de mois et d’année', () => {
    const jours = listeJoursInclusifs('2026-01-29', '2026-02-02')
    expect(jours).toEqual(['2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })

  it('janvier→février 2028 (bissextile) et fin d’année', () => {
    expect(listeJoursInclusifs('2028-01-30', '2028-02-01')).toEqual(['2028-01-30', '2028-01-31', '2028-02-01'])
    expect(listeJoursInclusifs('2026-12-30', '2027-01-01')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('un seul jour et entrée vide', () => {
    expect(listeJoursInclusifs('2026-03-15', '2026-03-15')).toEqual(['2026-03-15'])
    expect(listeJoursInclusifs(null, '2026-03-15')).toEqual([])
  })
})

describe('libelleAnciennete — jamais un 0 inventé', () => {
  const ref = new Date('2026-10-15T12:00:00Z')

  it('sans hire_date : null (l’écran dira « non renseignée »)', () => {
    expect(libelleAnciennete(null, ref)).toBeNull()
    expect(libelleAnciennete(undefined, ref)).toBeNull()
  })

  it('moins d’un mois, un mois, plusieurs mois', () => {
    expect(libelleAnciennete('2026-10-02', ref)).toBe('Moins d’un mois')
    expect(libelleAnciennete('2026-09-15', ref)).toBe('1 mois')
    expect(libelleAnciennete('2026-06-15', ref)).toBe('4 mois')
  })

  it('années et restes', () => {
    expect(libelleAnciennete('2025-10-15', ref)).toBe('1 an')
    expect(libelleAnciennete('2024-07-01', ref)).toBe('2 ans et 3 mois')
    expect(libelleAnciennete('2024-10-16', ref)).toBe('1 an et 11 mois')
  })

  it('une embauche future n’est pas une ancienneté', () => {
    expect(libelleAnciennete('2027-01-01', ref)).toBeNull()
  })
})

describe('libelleJourRelatif — les mots du fil d’activité', () => {
  it('aujourd’hui / hier / date courte', () => {
    expect(libelleJourRelatif('2026-10-15', '2026-10-15')).toBe('Aujourd’hui')
    expect(libelleJourRelatif('2026-10-14', '2026-10-15')).toBe('Hier')
    // jeudi 12 novembre 2026
    expect(libelleJourRelatif('2026-11-12', '2026-11-15')).toBe('jeu. 12 nov.')
  })
})

describe('joursPointesDuMois — une entrée fait la journée', () => {
  it('ne compte que les jours avec une entrée, dédoublonnés', () => {
    const atts = [
      { check_time: '2026-10-10T07:05:00Z', check_type: 'in' },
      { check_time: '2026-10-10T16:55:00Z', check_type: 'out' },
      { check_time: '2026-10-11T07:10:00Z', check_type: 'in' },
      { check_time: '2026-10-12T17:00:00Z', check_type: 'out' }, // sortie sans entrée
      { check_time: '2026-09-30T07:00:00Z', check_type: 'in' }, // hors période
    ]
    // Fuseau d’Abidjan/Cotonou : UTC+1 — les heures de jour restent dans le jour.
    expect(joursPointesDuMois(atts, '2026-10-01', '2026-10-31', 'Africa/Porto-Novo')).toEqual(['2026-10-10', '2026-10-11'])
  })

  it('la date se juge dans le fuseau de l’entreprise', () => {
    // 2026-10-15T23:30Z = 00:30 le 16 à Porto-Novo (UTC+1) : c’est le 16 qui compte.
    const atts = [{ check_time: '2026-10-15T23:30:00Z', check_type: 'in' }]
    expect(joursPointesDuMois(atts, '2026-10-01', '2026-10-31', 'Africa/Porto-Novo')).toEqual(['2026-10-16'])
    // Idem en UTC : c’est le 15.
    expect(joursPointesDuMois(atts, '2026-10-01', '2026-10-31', 'UTC')).toEqual(['2026-10-15'])
  })
})

describe('joursPrevusDepuisPlans — l’avenir n’est pas dû', () => {
  const plans = { '2026-10-01': {}, '2026-10-02': {}, '2026-10-06': {}, '2026-10-07': {}, '2026-10-10': {}, '2026-10-20': {} }

  it('ne compte que les jours prévus entre le début et aujourd’hui', () => {
    expect(joursPrevusDepuisPlans(plans, '2026-10-01', '2026-10-31', '2026-10-08')).toBe(4)
  })

  it('un planning nul donne zéro, pas d’erreur', () => {
    expect(joursPrevusDepuisPlans(null, '2026-10-01', '2026-10-31', '2026-10-08')).toBe(0)
    expect(joursPrevusDepuisPlans({}, '2026-10-01', '2026-10-31', '2026-10-08')).toBe(0)
  })
})

describe('pourcentageSiEchantillon — pas de % sur du vent', () => {
  it('sous le seuil : null', () => {
    expect(pourcentageSiEchantillon(1, 2)).toBeNull()
    expect(pourcentageSiEchantillon(14, 14)).toBeNull()
    expect(pourcentageSiEchantillon(0, 0)).toBeNull()
  })

  it('au seuil et au-delà : un pourcentage borné', () => {
    expect(pourcentageSiEchantillon(15, 15)).toBe(100)
    expect(pourcentageSiEchantillon(11, 22)).toBe(50)
  })
})

describe('etatPresenceDuJour — les mots de la maison', () => {
  const entree = { check_time: '2026-10-15T07:12:00Z', check_type: 'in' }
  const sortie = { check_time: '2026-10-15T15:58:00Z', check_type: 'out' }

  it('en pause prime sur tout', () => {
    const etat = etatPresenceDuJour({ firstIn: entree, lastPunch: entree, activePause: { id: 'p1' } })
    expect(etat.state).toBe('en_pause')
    expect(etat.libelle).toBe('En pause')
  })

  it('en poste, puis pointage terminé', () => {
    expect(etatPresenceDuJour({ firstIn: entree, lastPunch: entree }).state).toBe('en_poste')
    expect(etatPresenceDuJour({ firstIn: entree, lastPunch: sortie }).state).toBe('termine')
  })

  it('congé, sans pointage', () => {
    const etat = etatPresenceDuJour({ absenceDuJour: { reason: 'Maternité' } })
    expect(etat.state).toBe('en_conge')
    expect(etat.libelle).toBe('En congé')
  })

  it('P0 : « pas encore pointé » tant que le poste court, « absent » après', () => {
    expect(etatPresenceDuJour({}).state).toBe('non_pointe')
    expect(etatPresenceDuJour({}).libelle).toBe('pas encore pointé')
    expect(etatPresenceDuJour({ finPosteDepassee: true }).state).toBe('absent')
    expect(etatPresenceDuJour({ finPosteDepassee: true }).libelle).toBe('absent')
  })
})

describe('retardDuJour — jugé à l’heure de l’entreprise', () => {
  const plan = { start_time: '08:00:00', end_time: '17:00:00' }

  it('dans la tolérance : pas de retard', () => {
    // 08:10 à Porto-Novo (UTC+1) vs 08:00 + 15 min → pas de retard.
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T07:10:00Z' }, planDuJour: plan, fuseau: 'Africa/Porto-Novo' })).toBeNull()
  })

  it('au-delà : le dépassement en minutes', () => {
    // 08:23 à Porto-Novo vs 08:00 → 23 min > 15 min.
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T07:23:00Z' }, planDuJour: plan, fuseau: 'Africa/Porto-Novo' })).toBe(23)
  })

  it('sans plan, service de nuit, ou pas d’entrée : null', () => {
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T07:23:00Z' }, planDuJour: null, fuseau: 'Africa/Porto-Novo' })).toBeNull()
    expect(retardDuJour({ firstIn: { check_time: '2026-10-15T22:30:00Z' }, planDuJour: { start_time: '22:00:00', end_time: '06:00:00' }, fuseau: 'Africa/Porto-Novo' })).toBeNull()
    expect(retardDuJour({ firstIn: null, planDuJour: plan, fuseau: 'Africa/Porto-Novo' })).toBeNull()
  })
})

describe('construireFilActivite — trié, groupé, sans invention', () => {
  const groupees = construireFilActivite({
    attendances: [
      { id: 'a1', check_time: '2026-10-15T07:12:00Z', check_type: 'in' },
      { id: 'a2', check_time: '2026-10-15T07:30:00Z', check_type: 'out' }, // sortie sans entrée, mais un événement
      { id: 'a3', check_time: '2026-10-14T07:05:00Z', check_type: 'in' },
    ],
    pauses: [
      { id: 'p1', debutISO: '2026-10-15T12:00:00Z', finISO: '2026-10-15T12:45:00Z' },
    ],
    absences: [
      { id: 'ab1', start_date: '2026-10-08', end_date: '2026-10-09', reason: 'Maladie' },
    ],
    dateDuJour: '2026-10-15',
    fuseau: 'Africa/Porto-Novo',
  })

  it('les jours descendent, les étiquettes sont honnêtes', () => {
    expect(groupees.map((g) => g.libelle)).toEqual(['Aujourd’hui', 'Hier', 'jeu. 8 oct.'])
  })

  it('l’ordre dans le jour : le plus récent d’abord', () => {
    expect(groupees[0].entrees.map((e) => e.type)).toEqual(['pause_fin', 'pause_debut', 'sortie', 'entree'])
  })

  it('l’absence porte sa période et un libellé avec motif', () => {
    const absence = groupees[2].entrees[0]
    expect(absence.type).toBe('absence')
    expect(absence.libelle).toBe('Congé (Maladie)')
    expect(absence.periode).toBe('jusqu’au 2026-10-09')
  })

  it('le plafond de 14 événements est respecté', () => {
    const atts = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      check_time: `2026-10-${11 + (i % 5)}T0${i % 10}:00:00Z`,
      check_type: 'in',
    }))
    const res = construireFilActivite({ attendances: atts, dateDuJour: '2026-10-15', fuseau: 'UTC' })
    const total = res.reduce((acc, g) => acc + g.entrees.length, 0)
    expect(total).toBe(14)
  })

  it('aucune donnée : aucun groupe, pas de jour inventé', () => {
    expect(construireFilActivite({ dateDuJour: '2026-10-15', fuseau: 'UTC' })).toEqual([])
  })
})

describe('grillePresenceMois — une case par jour, un état par case', () => {
  const plans = { '2026-10-05': {}, '2026-10-06': {}, '2026-10-12': {} }

  it('pointé / prévu / hors planning / à venir', () => {
    const { cases } = grillePresenceMois({
      dateDuJour: '2026-10-15',
      joursPointes: ['2026-10-05', '2026-10-07'],
      plansParJour: plans,
    })
    expect(cases).toHaveLength(31)
    expect(cases.find((c) => c.jour === '2026-10-05').etat).toBe('pointe')
    expect(cases.find((c) => c.jour === '2026-10-06').etat).toBe('prevu')
    expect(cases.find((c) => c.jour === '2026-10-07').etat).toBe('pointe')
    expect(cases.find((c) => c.jour === '2026-10-08').etat).toBe('non_prevu')
    expect(cases.find((c) => c.jour === '2026-10-16').etat).toBe('avenir')
  })

  it('mois court (février 2026) et date nulle', () => {
    expect(grillePresenceMois({ dateDuJour: '2026-02-28', joursPointes: [], plansParJour: {} }).cases).toHaveLength(28)
    expect(grillePresenceMois({ dateDuJour: null, joursPointes: [], plansParJour: {} }).cases).toEqual([])
  })
})
