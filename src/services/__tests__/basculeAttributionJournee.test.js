// src/services/__tests__/basculeAttributionJournee.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  BASCULE HORAIRE — À QUELLE JOURNÉE APPARTIENT UN POINTAGE D'APRÈS MINUIT
//
//  `hoursCalculator` calcule la bascule à deux endroits :
//
//    · L. 212  → `basculeMinutes: minutesDeBascule(plan.bascule)`
//                 alimente `buildDaySummariesStrict` (attribution des journées) ;
//    · L. 470  → `jourDeTravailEnCours(ref, Number(plan.bascule) || 0, …)`
//                 décide quelle journée est « en cours ».
//
//  ⚠️ CE QUE CE FICHIER ÉTABLIT — et qui corrige une crainte infondée :
//  `minutesDeBascule` ACCEPTE les nombres (`minutesDeBascule(240) === 240`).
//  La ligne 212 ne renvoie donc PAS 0 : elle est CORRECTE. Aucun changement
//  n'y est nécessaire, et aucune heure ni aucun montant n'est affecté par une
//  prétendue faute à cet endroit.
//
//  Ce qui est réel, en revanche : la bascule DÉCIDE de l'attribution. Un
//  pointage d'APRÈS MINUIT — 02:00 le lundi — appartient au DIMANCHE quand la
//  bascule est à 04:00, au LUNDI quand elle est à minuit. Les heures totales
//  restent identiques ; c'est leur JOUR et leur SEMAINE qui changent.
//
//  ⚠️ Un pointage de 22:00 la veille n'est jamais ambigu : il appartient à la
//  veille quelle que soit la bascule. C'est celui d'après minuit qui tranche.
//
//  ⚠️ Valeurs FICTIVES (1 000 / h, seuils 40/48). Aucun montant réel.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { minutesDeBascule } from '../../utils/timezoneUtils'

const TABLES = {
  employees: [], enterprises: [], attendances: [], absences: [],
  employee_schedules: [], work_schedules: [], holidays: [],
  encheck_reglages_pointage: [], encheck_regles_temps_travail: [],
  overtime_settings: [], encheck_alertes_hebdo_activation: [],
  employee_payroll_profiles: [],
}

function reponse(table, unique) {
  const l = TABLES[table] ?? []
  return Promise.resolve({ data: unique ? (l[0] ?? null) : l, count: l.length, error: null })
}

function chaine(table) {
  const o = {
    select: () => o, eq: () => o, in: () => o, ilike: () => o, or: () => o,
    gte: () => o, lte: () => o, order: () => o, limit: () => o, not: () => o,
    range: () => o, is: () => o, contains: () => o, neq: () => o,
    maybeSingle: () => reponse(table, true),
    single: () => reponse(table, true),
    then: (ok, ko) => reponse(table, false).then(ok, ko),
  }
  return o
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t) => chaine(t), rpc: () => Promise.resolve({ data: [], error: null }) },
}))

const { calculateEmployeeHours } = await import('../hoursCalculator')

function preparer(bascule) {
  TABLES.employees = [{ id: 'e1', enterprise_id: 'ent', first_name: 'A', last_name: 'K' }]
  TABLES.enterprises = [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }]
  TABLES.work_schedules = [{
    id: 'S', enterprise_id: 'ent', name: 'Standard',
    start_time: '08:00', end_time: '16:00', work_days: [1, 2, 3, 4, 5],
    is_active: true, is_default: true, valide_du: '2026-01-01', valide_au: null,
    created_at: '2026-01-01', bascule,
  }]
  //  ⚠️ Le pointage qui décide est celui d'APRÈS MINUIT : lundi 26/10 à
  //  02:00 locale (01:00Z). Une entrée à 22:00 la veille n'est jamais
  //  ambiguë — elle appartient au 25 quelle que soit la bascule.
  TABLES.attendances = [
    { id: 'a', employee_id: 'e1', check_time: '2026-10-26T01:00:00.000Z', check_type: 'in', is_auto_closed: false, method: 'badge' },
    { id: 'b', employee_id: 'e1', check_time: '2026-10-26T09:00:00.000Z', check_type: 'out', is_auto_closed: false, method: 'badge' },
  ]
  TABLES.absences = []
  TABLES.employee_schedules = []
  TABLES.holidays = []
  TABLES.encheck_reglages_pointage = []
  TABLES.encheck_regles_temps_travail = []
  TABLES.overtime_settings = []
  TABLES.encheck_alertes_hebdo_activation = []
  TABLES.employee_payroll_profiles = [{ employee_id: 'e1', hourly_rate: 1000 }]
}

beforeEach(() => preparer(240))

describe('minutesDeBascule — la ligne 212 est correcte', () => {
  it('accepte un NOMBRE de minutes : 240 reste 240', () => {
    //  C'est ce qui invalide la crainte « la ligne 212 rend 0 ».
    expect(minutesDeBascule(240)).toBe(240)
    expect(minutesDeBascule(0)).toBe(0)
  })

  it('accepte aussi la forme texte « 04:00 »', () => {
    expect(minutesDeBascule('04:00')).toBe(240)
  })

  it('borne les valeurs absurdes au lieu de les laisser passer', () => {
    expect(minutesDeBascule(null)).toBe(0)
    expect(minutesDeBascule(99999)).toBe(1439)
  })
})

describe('La bascule décide de la SEMAINE, pas du total', () => {
  it('bascule 04:00 : un pointage à 02:00 le lundi appartient au DIMANCHE 25', async () => {
    preparer(240)
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-28T12:00:00Z'))

    //  La semaine du 26/10 ne contient PAS la garde : elle est au dimanche 25.
    expect(res.thisWeek.period).toContain('26 oct.')
    expect(res.thisWeek.total).toBe('0h00')
  })

  it('bascule à minuit : la même garde appartient au LUNDI 26', async () => {
    preparer(0)
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-28T12:00:00Z'))

    expect(res.thisWeek.period).toContain('26 oct.')
    expect(res.thisWeek.total).toBe('8h00')
  })

  it('les heures totales du mois et la valorisation sont IDENTIQUES dans les deux cas', async () => {
    preparer(240)
    const avec = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-28T12:00:00Z'))

    preparer(0)
    const sans = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-28T12:00:00Z'))

    //  ⚠️ C'est le point à retenir pour la paie : à ce stade, la bascule
    //  déplace la garde d'une journée et d'une semaine, mais ne change NI le
    //  total du mois, NI le montant valorisé.
    expect(avec.thisMonth.total_worked).toBe(sans.thisMonth.total_worked)
    expect(avec.thisMonth.normal_seconds).toBe(sans.thisMonth.normal_seconds)
    expect(avec.valorization?.normal?.amount ?? null).toBe(sans.valorization?.normal?.amount ?? null)
  })
})
