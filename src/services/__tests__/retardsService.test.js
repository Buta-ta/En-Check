import { describe, it, expect } from 'vitest'
import { construireRetards, SOURCES_SQL_VERS_BADGE, MOTIFS_SANS_PLANNING } from '../retardsService'

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE RETARDS — présentation pure des lignes de `encheck_retards_plage`
// ═══════════════════════════════════════════════════════════════════════════
//  Constats du 16/10/2026 validés en production :
//   · Hippo BIYOKILA : l'alerte annonçait 08:00 / 177 min (grille par défaut)
//     alors que la page annonçait 09:00 / 1h57 (horaire perso). Le SQL est
//     l'arbitre ; la couche présentation ne recalcule JAMAIS une grille.
//   · Pharmacie Blanche Gomes (sans option Planning) : « Prévu 08:00 » fantôme
//     pour 3 employés. Le SQL les renvoie avec motif_exclusion ; ils ne
//     doivent jamais figurer dans la liste des retards.

const ligneHippo = {
  employe_id: 'emp-hippo',
  prenom: 'Hippo',
  nom: 'BIYOKILA',
  matricule: 'ENN-0002',
  enterprise_id: 'ent-ennous',
  entreprise_nom: 'EN-NOUS',
  jour: '2026-10-16',
  pointage_id: 'att-001',
  heure_arrivee: '10:57',
  heure_prevue: '09:00',
  tolerance_minutes: 15,
  retard_minutes: 117,
  est_retard: true,
  grille_nom: 'Horaire personnalisé',
  grille_source: 'custom',
  module_planning: true,
  motif_exclusion: null,
}

const lignePharmacien = {
  employe_id: 'emp-mokono',
  prenom: 'La vie',
  nom: 'MOKONO',
  matricule: 'PHA-0004',
  enterprise_id: 'ent-pharma',
  entreprise_nom: 'Pharmacie Blanche Gomes',
  jour: '2026-10-16',
  pointage_id: 'att-002',
  heure_arrivee: '12:30',
  heure_prevue: '08:00',
  tolerance_minutes: 15,
  retard_minutes: 270,
  est_retard: false,
  grille_nom: null,
  grille_source: 'aucune',
  module_planning: false,
  motif_exclusion: 'sans_option_planning',
}

describe('construireRetards', () => {
  it('1) cas Hippo : 117 min contre l\'horaire perso 09:00, badge « Horaire perso »', () => {
    const { retards, stats } = construireRetards([ligneHippo], {})

    expect(retards).toHaveLength(1)
    expect(retards[0]).toMatchObject({
      id: 'att-001',
      date: '2026-10-16',
      heureArrivee: '09:00',
      heurePointage: '10:57',
      retardMinutes: 117,
      tolerance: 15,
      sourceHoraire: 'personnalisé',
    })
    expect(retards[0].employee).toMatchObject({
      first_name: 'Hippo',
      last_name: 'BIYOKILA',
      matricule: 'ENN-0002',
      enterprises: { name: 'EN-NOUS' },
    })
    expect(stats).toEqual({
      totalRetards: 1,
      totalMinutesRetard: 117,
      employesPonctuels: 0,
      employesEnRetard: 1,
      employesSansPlanningIgnores: 0,
    })
  })

  it('2) cas pharmacie : une ligne exclue (sans option planning) n\'est JAMAIS un retard', () => {
    const { retards, stats } = construireRetards([lignePharmacien], {})

    expect(retards).toHaveLength(0)
    expect(stats.totalRetards).toBe(0)
    expect(stats.totalMinutesRetard).toBe(0)
    expect(stats.employesEnRetard).toBe(0)
    // L'employé est compté comme « non jugé faute de planning »
    expect(stats.employesSansPlanningIgnores).toBe(1)
    // Même si la ligne SQL portait un écart brut de 270 min
    expect(stats.totalMinutesRetard).not.toBe(270)
  })

  it('3) le motif « sans_grille » compte aussi comme non jugé', () => {
    const { retards, stats } = construireRetards(
      [{ ...lignePharmacien, motif_exclusion: 'sans_grille' }],
      {}
    )
    expect(retards).toHaveLength(0)
    expect(stats.employesSansPlanningIgnores).toBe(1)
  })

  it('4) jour non ouvré selon la grille : exclu, mais sans être « sans planning »', () => {
    const { retards, stats } = construireRetards(
      [{ ...lignePharmacien, motif_exclusion: 'jour_non_ouvre' }],
      {}
    )
    expect(retards).toHaveLength(0)
    expect(stats.employesSansPlanningIgnores).toBe(0)
  })

  it('5) jour férié non travaillé : la ligne disparaît totalement (liste et stats)', () => {
    const { retards, stats } = construireRetards(
      [ligneHippo],
      { 'ent-ennous': new Set(['2026-10-16']) }
    )
    expect(retards).toHaveLength(0)
    expect(stats.totalRetards).toBe(0)
    expect(stats.employesEnRetard).toBe(0)
    // Un retard annulé par un férié ne rend pas non plus l'employé « ponctuel »
    expect(stats.employesPonctuels).toBe(0)
    expect(stats.employesSansPlanningIgnores).toBe(0)
  })

  it('6) journée jugée non en retard → ponctuel', () => {
    const { retards, stats } = construireRetards(
      [{ ...ligneHippo, est_retard: false, retard_minutes: 5 }], {}
    )
    expect(retards).toHaveLength(0)
    expect(stats.employesPonctuels).toBe(1)
    expect(stats.employesEnRetard).toBe(0)
  })

  it('7) sources SQL → badges de la page (custom / liee / defaut)', () => {
    expect(SOURCES_SQL_VERS_BADGE.custom).toBe('personnalisé')
    expect(SOURCES_SQL_VERS_BADGE.liee).toBe('planning')
    expect(SOURCES_SQL_VERS_BADGE.defaut).toBe('entreprise')
    expect(MOTIFS_SANS_PLANNING).toEqual(['sans_option_planning', 'sans_grille'])

    const { retards } = construireRetards([
      { ...ligneHippo, grille_source: 'liee' },
      { ...ligneHippo, employe_id: 'emp-2', grille_source: 'defaut' },
    ], {})
    expect(retards.map(r => r.sourceHoraire).sort()).toEqual(['entreprise', 'planning'])
  })

  it('8) tri : date décroissant puis retard décroissant', () => {
    const { retards } = construireRetards([
      { ...ligneHippo, pointage_id: 'a', jour: '2026-10-15', retard_minutes: 200 },
      { ...ligneHippo, pointage_id: 'b', jour: '2026-10-16', retard_minutes: 50 },
      { ...ligneHippo, pointage_id: 'c', jour: '2026-10-16', retard_minutes: 117 },
    ], {})
    expect(retards.map(r => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('9) entrée vide ou absente → liste vide et compteurs à zéro', () => {
    expect(construireRetards([], {})).toEqual({
      retards: [],
      stats: {
        totalRetards: 0,
        totalMinutesRetard: 0,
        employesPonctuels: 0,
        employesEnRetard: 0,
        employesSansPlanningIgnores: 0,
      },
    })
    expect(construireRetards(undefined, {}).retards).toEqual([])
  })
})
