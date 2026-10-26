// ═══════════════════════════════════════════════════════════
// ⏱️ LE RAPPORT COMPTE LE TEMPS EFFECTIF
//
// Ce que ces tests gardent :
//   ① une pause réellement effectuée se déduit ;
//   ② une pause présumée en attente se MARQUE, jamais ne s'encaisse ;
//   ③ une pause déjà matérialisée par un badge Sortie → Entrée n'est
//     pas déduite deux fois ;
//   ④ une pause écartée ne compte jamais ;
//   ⑤ le registre jour par jour donne présence, pauses et effectif,
//     zone comprise, sans jamais inventer de journée.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  cleJour,
  heuresMinutes,
  heureLocale,
  badgesParJour,
  pausesDeductiblesPourEmploye,
  construireJournees,
  resumerPresence,
} from '../../utils/rapportsPresence.js'

const EMP = 'emp-1'
const JOUR = '2026-10-16'

const badge = (heure, type, extra = {}) => ({
  employee_id: EMP,
  check_type: type,
  check_time: `${JOUR}T${heure}:00+01:00`,
  ...extra,
})

const pause = (debut, fin, statut, extra = {}) => ({
  id: `p-${debut}`,
  employe_id: EMP,
  jour: JOUR,
  debutISO: `${JOUR}T${debut}:00+01:00`,
  finISO: fin ? `${JOUR}T${fin}:00+01:00` : null,
  dureeMinutes: fin ? Number(fin.slice(0, 2)) * 60 + Number(fin.slice(3)) - (Number(debut.slice(0, 2)) * 60 + Number(debut.slice(3))) : 0,
  statut,
  source: statut === 'presumee' || statut === 'validee' ? 'presumee' : 'pointee',
  ouverte: !fin,
  ...extra,
})

// Journée de référence : 08:00 → 17:00, soit 9 h de présence brute.
const JOURNEE = [badge('08:00', 'in'), badge('17:00', 'out')]

describe('1. les clés et les durées', () => {
  it('lit le jour d’un badge sans le décaler de fuseau', () => {
    expect(cleJour(`${JOUR}T00:30:00+01:00`)).toBe(JOUR)
    expect(cleJour('2026-10-16 08:12:00+00')).toBe('2026-10-16')
    expect(cleJour(null)).toBeNull()
  })

  it('écrit les heures en h/min, jamais en décimales', () => {
    expect(heuresMinutes(0)).toBe('0h00')
    expect(heuresMinutes(75)).toBe('1h15')
    expect(heuresMinutes(540)).toBe('9h00')
    expect(heuresMinutes(-12)).toBe('0h00')
  })

  it('donne une heure locale lisible', () => {
    expect(heureLocale(`${JOUR}T08:05:00+01:00`)).toMatch(/^\d{2}:\d{2}$/)
    expect(heureLocale('pas une date')).toBeNull()
  })

  it('range les badges d’un seul employé, dans l’ordre', () => {
    const badges = badgesParJour(
      [
        badge('17:00', 'out'),
        { ...badge('08:00', 'in'), employee_id: 'autre' },
        badge('08:00', 'in'),
      ],
      EMP
    )
    expect(badges.size).toBe(1)
    expect(badges.get(JOUR).map(b => b.check_type)).toEqual(['in', 'out'])
  })
})

describe('2. les pauses déduites de la journée', () => {
  it('déduit une pause réellement pointée', () => {
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', '13:00', 'reelle')],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(60)
    expect(r.parJour[JOUR]).toBe(60)
    expect(r.nombre).toBe(1)
    expect(r.retenues).toHaveLength(1)
  })

  it('déduit une pause présumée VALIDÉE', () => {
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', '12:45', 'validee')],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(45)
  })

  it('marque une présomption en attente sans l’encaisser', () => {
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', '13:00', 'presumee')],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(0)
    expect(r.parJour[JOUR]).toBeUndefined()
    // … mais elle est comptée, pour que l'écran puisse le dire.
    expect(r.presumeesNombre).toBe(1)
    expect(r.presumeesMinutes).toBe(60)
  })

  it('ne déduit jamais une pause écartée', () => {
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', '13:00', 'ecartee')],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(0)
    expect(r.ecarteesNombre).toBe(1)
  })

  it('ne redéduit pas une pause déjà sortie des badges Sortie → Entrée', () => {
    const journeeAvecBadges = [
      badge('08:00', 'in'),
      badge('12:00', 'out'),
      badge('13:00', 'in'),
      badge('17:00', 'out'),
    ]
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', '13:00', 'reelle')],
      attendances: journeeAvecBadges,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(0)
    expect(r.retenues).toHaveLength(0)
  })

  it('ne déduit rien d’une pause encore ouverte', () => {
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', null, 'reelle')],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(0)
    expect(r.nombre).toBe(0)
  })

  it('additionne plusieurs journées', () => {
    const veille = {
      ...pause('10:00', '10:30', 'reelle'),
      id: 'p-veille',
      jour: '2026-10-15',
      debutISO: '2026-10-15T10:00:00+01:00',
      finISO: '2026-10-15T10:30:00+01:00',
    }
    const r = pausesDeductiblesPourEmploye({
      pauses: [pause('12:00', '13:00', 'reelle'), veille],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(90)
    expect(Object.keys(r.parJour).sort()).toEqual(['2026-10-15', JOUR])
  })

  it('ignore les pauses d’un autre employé', () => {
    const r = pausesDeductiblesPourEmploye({
      pauses: [{ ...pause('12:00', '13:00', 'reelle'), employe_id: 'autre' }],
      attendances: JOURNEE,
      employeeId: EMP,
    })
    expect(r.minutes).toBe(0)
  })
})

describe('3. le registre jour par jour', () => {
  const geofences = { 'zone-1': 'Siège — Kandi' }

  it('donne présence, pauses et temps effectif', () => {
    const [ligne] = construireJournees({
      attendances: JOURNEE,
      employeeId: EMP,
      minutesParJour: { [JOUR]: 540 },
      pausesParJour: { [JOUR]: 60 },
      geofencesById: geofences,
    })
    expect(ligne.jour).toBe(JOUR)
    expect(ligne.presenceMinutes).toBe(540)
    expect(ligne.pauseMinutes).toBe(60)
    expect(ligne.effectifMinutes).toBe(480)
    expect(ligne.entree).toMatch(/^\d{2}:\d{2}$/)
    expect(ligne.sortie).toMatch(/^\d{2}:\d{2}$/)
  })

  it('nomme la zone d’entrée, ou dit qu’il n’y en a pas', () => {
    const [avecZone] = construireJournees({
      attendances: [badge('08:00', 'in', { geofence_id: 'zone-1' }), badge('17:00', 'out')],
      employeeId: EMP,
      minutesParJour: { [JOUR]: 540 },
      geofencesById: geofences,
    })
    expect(avecZone.zone).toBe('Siège — Kandi')

    const [horsZone] = construireJournees({
      attendances: JOURNEE,
      employeeId: EMP,
      minutesParJour: { [JOUR]: 540 },
    })
    expect(horsZone.zone).toBe('Hors zone')

    const [zoneInconnue] = construireJournees({
      attendances: [badge('08:00', 'in', { geofence_id: 'disparue' })],
      employeeId: EMP,
    })
    expect(zoneInconnue.zone).toBe('Zone inconnue')
  })

  it('ne descend jamais sous zéro quand la pause dépasse la présence', () => {
    const [ligne] = construireJournees({
      attendances: JOURNEE,
      employeeId: EMP,
      minutesParJour: { [JOUR]: 30 },
      pausesParJour: { [JOUR]: 60 },
    })
    expect(ligne.effectifMinutes).toBe(0)
  })

  it('trie du plus récent au plus ancien et n’invente pas de journée', () => {
    const veille = {
      employee_id: EMP,
      check_type: 'in',
      check_time: '2026-10-15T08:00:00+01:00',
    }
    const lignes = construireJournees({
      attendances: [...JOURNEE, veille],
      employeeId: EMP,
      minutesParJour: { [JOUR]: 540, '2026-10-15': 480 },
    })
    expect(lignes.map(l => l.jour)).toEqual(['2026-10-16', '2026-10-15'])
  })

  it('rend une ligne pour une pause sans badge (pause seule)', () => {
    const lignes = construireJournees({
      attendances: [],
      employeeId: EMP,
      pausesParJour: { [JOUR]: 20 },
    })
    expect(lignes).toHaveLength(1)
    expect(lignes[0].presenceMinutes).toBe(0)
    expect(lignes[0].effectifMinutes).toBe(0)
  })
})

describe('4. le résumé de présence', () => {
  it('retire les pauses du brut et garde les présomptions à part', () => {
    const r = resumerPresence({
      presenceMinutes: 540,
      pauses: { minutes: 60, presumeesMinutes: 30, presumeesNombre: 1, nombre: 2, ecarteesNombre: 1 },
    })
    expect(r.presenceMinutes).toBe(540)
    expect(r.pauseMinutes).toBe(60)
    expect(r.effectifMinutes).toBe(480)
    expect(r.presumeesMinutes).toBe(30)
    expect(r.pausesNombre).toBe(2)
    expect(r.ecarteesNombre).toBe(1)
  })

  it('tient debout sans pause', () => {
    const r = resumerPresence({ presenceMinutes: 300 })
    expect(r.effectifMinutes).toBe(300)
    expect(r.pauseMinutes).toBe(0)
  })
})
