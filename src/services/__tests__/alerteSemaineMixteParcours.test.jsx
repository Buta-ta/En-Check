// src/services/__tests__/alerteSemaineMixteParcours.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  DE BOUT EN BOUT : une semaine vérifiée en dépassement, une autre sans règle
//
//  Les autres tests de la carte partent d'un objet fabriqué. Celui-ci part du
//  VRAI `calculateEmployeeHours`, avec une panne de règle simulée sur une
//  seule semaine, pour vérifier que le moteur et l'écran disent la même chose.
//
//  ⚠️ Valeurs FICTIVES (40 h, 44 h, 45 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AlerteHebdoCard from '../../components/AlerteHebdoCard'

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

/** Semaine du 19/10 : la RPC de règle échoue. Les autres répondent. */
const ETAT = { panneSemaineDu: null }

function rpc(nom, params) {
  const date = params?.p_date || null
  if (nom === 'encheck_regle_resolue') {
    if (ETAT.panneSemaineDu && date && date >= ETAT.panneSemaineDu) {
      return Promise.resolve({ data: null, error: { message: 'panne', code: '08006' } })
    }
    return Promise.resolve({
      data: [{ valeur: 40, origine: 'entreprise', date_effet: '2026-01-01' }],
      error: null,
    })
  }
  if (nom === 'encheck_activation_alerte') {
    return Promise.resolve({ data: [{ active: true, etat: 'activee', depuis: '2026-01-01' }], error: null })
  }
  return Promise.resolve({ data: [], error: null })
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t) => chaine(t), rpc: (n, p) => rpc(n, p) },
}))
vi.mock('../../lib/db', () => ({
  db: () => ({ from: (t) => chaine(t), rpc: (n, p) => rpc(n, p) }),
}))

const { calculateEmployeeHours } = await import('../hoursCalculator')

const jour = (j, hDebut, hFin) => ([
  { id: `in-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T${hDebut}:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
  { id: `out-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T${hFin}:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
])

beforeEach(() => {
  ETAT.panneSemaineDu = '2026-10-19'
  TABLES.employees = [{ id: 'e1', enterprise_id: 'ent', first_name: 'Awa', last_name: 'Test' }]
  TABLES.enterprises = [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }]
  TABLES.work_schedules = [{
    id: 'S', enterprise_id: 'ent', name: 'Standard',
    start_time: '08:00', end_time: '16:00', work_days: [1, 2, 3, 4, 5, 6],
    is_active: true, is_default: true, valide_du: '2026-01-01', valide_au: null,
    created_at: '2026-01-01', bascule: 240,
  }]
  //  Semaine du 12/10 : 5 × 8 h + 4 h le samedi = 44 h (seuil 40 → +4 h).
  //  Semaine du 19/10 : 5 × 9 h = 45 h, mais la règle y est introuvable.
  TABLES.attendances = [
    ...['12', '13', '14', '15', '16'].flatMap((j) => jour(j, '05:00', '13:00')),
    ...jour('17', '05:00', '09:00'),
    ...['19', '20', '21', '22', '23'].flatMap((j) => jour(j, '04:00', '13:00')),
  ]
  TABLES.absences = []
  TABLES.employee_schedules = []
  TABLES.holidays = []
  TABLES.encheck_reglages_pointage = []
  TABLES.encheck_regles_temps_travail = []
  TABLES.overtime_settings = []
  TABLES.encheck_alertes_hebdo_activation = []
  TABLES.employee_payroll_profiles = []
})

const rendu = (plafond) =>
  renderToStaticMarkup(<AlerteHebdoCard plafond={plafond} />).replace(/<[^>]+>/g, ' ')

describe('Parcours complet : une semaine vérifiée, une semaine sans règle', () => {
  it('le moteur distingue les deux semaines', async () => {
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))
    const plafond = res.thisMonth.plafond_hebdo

    const s12 = (plafond.semaines || []).find((s) => s.debut === '2026-10-12')
    const s19 = (plafond.semaines || []).find((s) => s.debut === '2026-10-19')

    expect(s12.heures).toBe(44)
    expect(s12.seuil_applique).toBe(40)
    expect(s12.depasse).toBe(true)
    expect(s12.regle_resolue).toBe(true)

    expect(s19.regle_resolue).toBe(false)
    expect(s19.seuil_applique).toBeNull()
    expect(s19.depasse).toBe(false)

    //  Le drapeau global est faux — c'est précisément ce qui masquait l'alerte.
    expect(plafond.disponible).toBe(false)
  })

  it('l’écran affiche le dépassement de la semaine vérifiée', async () => {
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))
    const html = rendu(res.thisMonth.plafond_hebdo)

    expect(html).toContain('44 h pour un seuil de 40 h — dépassement de 4 h')
  })

  it('l’écran signale séparément la semaine sans verdict, sans la chiffrer', async () => {
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))
    const html = rendu(res.thisMonth.plafond_hebdo)

    expect(html).toContain('aucun verdict n’est prononcé')
    //  Une seule ligne de dépassement : celle de la semaine vérifiée.
    expect(html.match(/dépassement de/g)).toHaveLength(1)
  })
})
