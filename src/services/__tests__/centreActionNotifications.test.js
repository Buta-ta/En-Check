// ═══════════════════════════════════════════════════════════
// LE CENTRE D'ACTION — P1 : la cloche agrège, plafonne, et ne
// compte que le non-résolu.
//
// Ce que ces tests défendent :
//  — une ligne par niveau de gravité, jamais une ligne par alerte ;
//  — les alertes lues et les signaux d'assiduité sortent du groupe ;
//  — le libellé « noms… +k » reste lisible (2 noms max) ;
//  — la clé agrégée reste stable (tri des ids) pour l'état « lu ».
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { agregerAlertesParGravite, libelleNoms } from '../../hooks/useNotifications'

const alerte = (id, gravite, employe = '', quand = '2026-11-17T08:00:00Z') => ({
  id,
  gravite,
  employe,
  quand,
  lu: false,
})

describe('agregerAlertesParGravite — une ligne par niveau, pas par alerte', () => {
  it('regroupe dix alertes du même niveau en une ligne', () => {
    const alertes = Array.from({ length: 10 }, (_, i) => alerte(`a${i}`, 'attention'))
    const groupes = agregerAlertesParGravite(alertes)
    expect(groupes).toHaveLength(1)
    expect(groupes[0].gravite).toBe('attention')
    expect(groupes[0].count).toBe(10)
    expect(groupes[0].ids).toHaveLength(10)
  })

  it('sépare critique / attention / info dans l’ordre d’urgence', () => {
    const groupes = agregerAlertesParGravite([
      alerte('i1', 'info'),
      alerte('c1', 'critique'),
      alerte('a1', 'attention'),
      alerte('i2', 'info'),
      alerte('c2', 'critique'),
    ])
    expect(groupes.map((g) => g.gravite)).toEqual(['critique', 'attention', 'info'])
    expect(groupes[0].count).toBe(2)
    expect(groupes[1].count).toBe(1)
    expect(groupes[2].count).toBe(2)
  })

  it('exclut les alertes déjà lues (elles sont résolues)', () => {
    const groupes = agregerAlertesParGravite([
      alerte('lue', 'critique'),
      { ...alerte('fraiche', 'critique'), lu: true },
      { ...alerte('lue2', 'attention'), lu: true },
    ])
    expect(groupes).toHaveLength(1)
    expect(groupes[0].ids).toEqual(['lue'])
  })

  it('exclut les signaux d’assiduité (traités séparément, un par personne)', () => {
    const groupes = agregerAlertesParGravite([
      alerte('a1', 'attention'),
      { ...alerte('s1', 'attention'), type: 'assiduite_signal' },
    ])
    expect(groupes).toHaveLength(1)
    expect(groupes[0].ids).toEqual(['a1'])
  })

  it('liste les employés distincts (2 max au libellé) et la date la plus récente', () => {
    const groupes = agregerAlertesParGravite([
      { ...alerte('a1', 'attention', 'Koné'), quand: '2026-11-16T09:00:00Z' },
      { ...alerte('a2', 'attention', 'Fatou'), quand: '2026-11-17T08:30:00Z' },
      { ...alerte('a3', 'attention', 'Koné'), quand: '2026-11-17T08:10:00Z' },
      { ...alerte('a4', 'attention', 'Moussa'), quand: '2026-11-15T08:00:00Z' },
    ])
    expect(groupes[0].noms).toEqual(['Koné', 'Fatou', 'Moussa'])
    expect(groupes[0].quand).toBe('2026-11-17T08:30:00Z')
  })

  it('ne produit rien sur une liste vide ou invalide', () => {
    expect(agregerAlertesParGravite([])).toEqual([])
    expect(agregerAlertesParGravite(undefined)).toEqual([])
    expect(agregerAlertesParGravite([null, { gravite: 'info' }])).toEqual([])
  })
})

describe('libelleNoms — lisible, jamais une liste interminable', () => {
  it('affiche deux noms puis un compteur', () => {
    expect(libelleNoms(['Koné', 'Fatou', 'Moussa', 'Awa'])).toBe('Koné, Fatou … +2')
  })

  it('affiche tout quand on est sous le seuil', () => {
    expect(libelleNoms(['Koné', 'Fatou'])).toBe('Koné, Fatou')
    expect(libelleNoms(['Koné'])).toBe('Koné')
  })

  it('gère le vide et un seuil sur mesure', () => {
    expect(libelleNoms([])).toBe('')
    expect(libelleNoms(['a', 'b', 'c'], 1)).toBe('a … +2')
  })
})
