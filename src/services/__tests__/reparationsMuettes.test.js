// src/services/__tests__/reparationsMuettes.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 🔇→🔔 LES RÉPARATIONS MUETTES (constat B de l'audit)
//
// CE QUE FAISAIT LE MOTEUR
//   · une session de 20 h était ramenée à 16 h — sans un mot ;
//   · une deuxième entrée dans la même garde était avalée ;
//   · une sortie sans entrée disparaissait du total.
//
// POURQUOI C'EST GRAVE
//   Ces décisions sont *défendables* (on ne paie pas 20 h sur un oubli de
//   dépointage). Ce qui est indéfendable, c'est de les prendre en silence :
//   c'est exactement ce qu'un inspecteur du travail attaque en premier, et
//   l'employé, lui, ne peut rien contester.
//
// CE QUI CHANGE
//   Chaque réparation laisse une ligne dans `anomalies` : type, heures
//   écartées, message. Le montant est identique — la trace, non.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { __internal } from '../hoursCalculator'

const { buildDaySummariesStrict, generateAlerts } = __internal

const SEUILS = {
  appariementHeures: 16,
  seuilRebondSecondes: 60,
  plafondInventionHeures: 12,
}

const DEFAUTS = {
  enterpriseCfg: { id: 'ent-1', currency: 'XAF', timezone: 'Africa/Porto-Novo' },
  yearStartDate: '2026-01-01',
  yearEndDate: '2026-12-31',
  seuils: SEUILS,
}

const badge = (type, iso) => ({ id: `${type}-${iso}`, check_type: type, check_time: iso })

const resumer = (attendances) => buildDaySummariesStrict({ attendances, ...DEFAUTS })

describe('Les réparations laissent une trace', () => {
  it('une session de 20 h n’est pas payée 20 h — et le dit désormais', () => {
    const jours = resumer([
      badge('in', '2026-03-03T07:00:00'),
      badge('out', '2026-03-04T03:00:00'), // 20 h plus tard
    ])

    const jour = jours['2026-03-03']

    //  Ce n'est pas le plafond de 16 h qui s'applique ici : la sortie est
    //  jugée trop lointaine pour être une vraie sortie, la session est donc
    //  clôturée virtuellement (à confirmer par un humain).
    expect(jour.hasAutoCloseVirtual).toBe(true)
    expect(jour.totalSeconds).toBeLessThan(20 * 3600)
    //  4 heures au moins ne sont pas payées : c'est défendable, à condition
    //  de pouvoir le montrer.
    expect(20 * 3600 - jour.totalSeconds).toBeGreaterThanOrEqual(4 * 3600)

    const anomalie = jour.anomalies.find(a => a.type === 'sortie_trop_lointaine')
    expect(anomalie).toBeTruthy()
    expect(anomalie.heures_ecart).toBe(20)
    expect(anomalie.message).toContain('virtuellement')
  })

  it('une deuxième entrée dans la même garde est signalée, pas seulement ignorée', () => {
    const jours = resumer([
      badge('in', '2026-03-03T08:00:00'),
      badge('in', '2026-03-03T09:00:00'), // retour de pause oublié ? doublon ?
      badge('out', '2026-03-03T17:00:00'),
    ])

    const anomalies = jours['2026-03-03'].anomalies
    expect(anomalies.map(a => a.type)).toContain('entree_ignoree')
    //  Le total reste 9 h (de la première entrée à la sortie) : on ne paie
    //  pas l'heure « avalée » en double.
    expect(jours['2026-03-03'].totalSeconds).toBe(9 * 3600)
  })

  it('une sortie sans entrée ne disparaît plus sans laisser de trace', () => {
    const jours = resumer([
      badge('out', '2026-03-05T17:00:00'),
      badge('in', '2026-03-06T08:00:00'),
      badge('out', '2026-03-06T16:00:00'),
    ])

    expect(jours['2026-03-05'].anomalies[0].type).toBe('sortie_orpheline')
    expect(jours['2026-03-06'].totalSeconds).toBe(8 * 3600)
  })

  it('un double scan rapproché est nommé (rebond), au lieu d’être une simple ligne `continue`', () => {
    const jours = resumer([
      badge('in', '2026-03-09T08:00:00'),
      badge('out', '2026-03-09T08:00:30'), // 30 s : double scan
      badge('out', '2026-03-09T16:00:00'),
    ])

    const anomalies = jours['2026-03-09'].anomalies.map(a => a.type)
    expect(anomalies).toContain('rebond_ignore')
    //  Le vrai pointage de sortie est bien pris en compte.
    expect(jours['2026-03-09'].totalSeconds).toBe(8 * 3600)
  })

  it('une sortie 22 h après l’entrée est traitée comme un oubli, et dit pourquoi', () => {
    const jours = resumer([
      badge('in', '2026-03-10T06:00:00'),
      badge('out', '2026-03-11T04:00:00'),
    ])

    const types = jours['2026-03-10'].anomalies.map(a => a.type)
    expect(types).toContain('sortie_trop_lointaine')
  })

  it('un virage normal ne produit AUCUNE anomalie (pas de faux positif)', () => {
    const jours = resumer([
      badge('in', '2026-03-12T08:00:00'),
      badge('out', '2026-03-12T12:00:00'),
      badge('in', '2026-03-12T13:00:00'),
      badge('out', '2026-03-12T17:00:00'),
    ])

    expect(jours['2026-03-12'].anomalies).toEqual([])
    expect(jours['2026-03-12'].totalSeconds).toBe(8 * 3600)
  })

  it('une journée sans pointage n’a pas d’anomalie non plus', () => {
    const jours = resumer([])
    expect(Object.keys(jours)).toHaveLength(0)
  })
})

describe('L’alerte de paie reprend les réparations', () => {
  it('compte les pointages réparés, et détaille les sessions plafonnées', () => {
    const alerts = generateAlerts({
      today: {},
      month: {
        rate: null,
        anomalies: [
          { date: '2026-03-03', type: 'session_plafonnee' },
          { date: '2026-03-05', type: 'sortie_orpheline' },
        ],
      },
      year: null,
      hasPlan: true,
      seuils: SEUILS,
    })

    const message = alerts.map(a => a.message).join(' | ')
    expect(message).toContain('2 pointage(s) réparé(s)')
    expect(message).toContain('avant paie')
  })

  it('aucune alerte quand rien n’a été réparé', () => {
    const alerts = generateAlerts({
      today: {},
      month: { rate: null, anomalies: [] },
      year: null,
      hasPlan: true,
      seuils: SEUILS,
    })

    expect(alerts.map(a => a.message).join(' | ')).not.toContain('réparé')
  })
})
