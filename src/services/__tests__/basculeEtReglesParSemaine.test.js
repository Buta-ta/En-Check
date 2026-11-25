// src/services/__tests__/basculeEtReglesParSemaine.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  LA BASCULE DÉPLACE UNE HEURE SUP D'UNE SEMAINE À L'AUTRE — ET CELA CHANGE
//  LE SEUIL APPLIQUÉ, DONC L'ALERTE.
//
//  Le total du mois est identique dans les deux cas : ce n'est PAS une raison
//  de conclure que rien ne change. Une heure sup à 44 h dans une semaine à
//  seuil 40 h ne dit pas la même chose qu'à 4 h dans une semaine à seuil 45 h.
//  Ce fichier mesure exactement cela, en combinant les deux mécanismes :
//
//      · la BASCULE décide à quelle journée appartient un pointage d'après
//        minuit (04:00 ⇒ 02:00 le lundi reste au dimanche) ;
//      · les RÈGLES PAR SEMAINE décident quel seuil s'applique à cette
//        semaine, via le lundi qui l'ouvre.
//
//  ⚠️ Valeurs FICTIVES (seuils 40 h et 45 h). Aucune n'est une règle légale.
//  Aucun montant de paie n'est affirmé ici : on ne regarde que l'ALERTE.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

/**
 * Règles versionnées, résolues PAR DATE.
 *
 * ⚠️ Un faux qui rendrait la même valeur pour toutes les clés ferait passer
 * un `niveau2` absent pour un second niveau configuré. Les clés sont donc
 * servies séparément — c'est la fidélité du faux qui fait la valeur du test.
 */
const REGLES = { seuil: [], niveau2: [], activation: [] }

function resoudre(cle, date) {
  const versions = REGLES[cle] || []
  const applicables = versions.filter((v) => v.date_effet <= date)
  if (applicables.length === 0) return { valeur: null, origine: 'aucune', date_effet: null }
  return applicables.sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0]
}

function rpc(nom, params) {
  const date = params?.p_date || '2026-10-24'
  if (nom === 'encheck_regle_resolue') {
    const cle = params.p_cle === 'alerte_hebdo_niveau2_heures' ? 'niveau2' : 'seuil'
    return Promise.resolve({ data: [resoudre(cle, date)], error: null })
  }
  if (nom === 'encheck_activation_alerte') {
    const v = REGLES.activation.filter((a) => a.date_effet <= date)
      .sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0]
    return Promise.resolve({
      data: v ? [{ active: v.valeur === 1, etat: v.valeur === 1 ? 'activee' : 'desactivee', depuis: v.date_effet }] : [],
      error: null,
    })
  }
  return Promise.resolve({ data: [], error: null })
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t) => chaine(t), rpc: (n, p) => rpc(n, p) },
}))

const { calculateEmployeeHours } = await import('../hoursCalculator')

const jour = (j, hDebut, hFin) => ([
  { id: `in-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T${hDebut}:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
  { id: `out-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T${hFin}:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
])

function preparer({ bascule }) {
  TABLES.employees = [{ id: 'e1', enterprise_id: 'ent', first_name: 'Awa', last_name: 'Test' }]
  TABLES.enterprises = [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }]
  TABLES.work_schedules = [{
    id: 'S', enterprise_id: 'ent', name: 'Standard',
    start_time: '08:00', end_time: '16:00', work_days: [1, 2, 3, 4, 5],
    is_active: true, is_default: true, valide_du: '2026-01-01', valide_au: null,
    created_at: '2026-01-01', bascule,
  }]
  TABLES.attendances = [
    //  Semaine du 19/10 : 5 jours × 8 h = 40 h (05:00→13:00 UTC = 06:00→14:00 locale).
    ...['19', '20', '21', '22', '23'].flatMap((j) => jour(j, '05:00', '13:00')),
    //  Puis un pointage du LUNDI 26 à 02:00 locale (01:00Z) jusqu'à 06:00
    //  locale (05:00Z) : 4 h qui, avec une bascule à 04:00, restent au dimanche.
    ...jour('26', '01:00', '05:00'),
  ]
  TABLES.absences = []
  TABLES.employee_schedules = []
  TABLES.holidays = []
  TABLES.encheck_reglages_pointage = []
  TABLES.encheck_regles_temps_travail = []
  TABLES.overtime_settings = []
  TABLES.encheck_alertes_hebdo_activation = []
  TABLES.employee_payroll_profiles = []
}

beforeEach(() => {
  preparer({ bascule: 240 })
  REGLES.seuil = []
  REGLES.niveau2 = []
  REGLES.activation = []
})

const semainesAvecHeures = (plafond) =>
  (plafond.semaines || []).filter((s) => s.heures > 0)

describe('Bascule 04:00 — un pointage du lundi à 02:00 reste au dimanche', () => {
  it('les 4 h rejoignent la semaine du 19/10, qui atteint 44 h', async () => {
    preparer({ bascule: 240 })
    REGLES.seuil = [{ valeur: 40, date_effet: '2026-01-01' }]
    REGLES.activation = [{ valeur: 1, date_effet: '2026-01-01' }]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))
    const semaines = semainesAvecHeures(res.thisMonth.plafond_hebdo)

    //  La semaine du 19 porte 44 h ; la semaine du 26 n'a rien.
    expect(semaines).toHaveLength(1)
    expect(semaines[0].debut).toBe('2026-10-19')
    expect(semaines[0].heures).toBe(44)
    expect(semaines[0].seuil_applique).toBe(40)
    expect(semaines[0].depasse).toBe(true)
    expect(semaines[0].depassement_heures).toBe(4)
  })

  it('avec un seuil porté à 45 h au lundi 19, le même total ne dépasse plus', async () => {
    preparer({ bascule: 240 })
    //  Le seuil de 45 h prend effet le LUNDI 19 : il régit la semaine entière.
    REGLES.seuil = [
      { valeur: 40, date_effet: '2026-01-01' },
      { valeur: 45, date_effet: '2026-10-19' },
    ]
    REGLES.activation = [{ valeur: 1, date_effet: '2026-01-01' }]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))
    const semaine = semainesAvecHeures(res.thisMonth.plafond_hebdo)[0]

    expect(semaine.debut).toBe('2026-10-19')
    expect(semaine.heures).toBe(44)
    //  44 h sous un seuil de 45 h : aucune alerte. Le total est pourtant le
    //  même que dans le test précédent — c'est le SEUIL qui a changé l'alerte.
    expect(semaine.seuil_applique).toBe(45)
    expect(semaine.depasse).toBe(false)
    expect(res.thisMonth.plafond_hebdo.nb_depassees).toBe(0)
  })
})

describe('Bascule à minuit — le même pointage appartient au lundi 26', () => {
  it('les 4 h forment une semaine du 26 distincte, sous un seuil à elle', async () => {
    preparer({ bascule: 0 })
    REGLES.seuil = [{ valeur: 40, date_effet: '2026-01-01' }]
    REGLES.activation = [{ valeur: 1, date_effet: '2026-01-01' }]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))
    const semaines = semainesAvecHeures(res.thisMonth.plafond_hebdo)

    //  Deux semaines : 40 h puis 4 h. Aucune ne dépasse 40 h.
    expect(semaines.map((s) => s.debut)).toEqual(['2026-10-19', '2026-10-26'])
    expect(semaines.map((s) => s.heures)).toEqual([40, 4])
    expect(semaines.every((s) => s.depasse === false)).toBe(true)
  })

  it('la semaine du 26 porte le seuil de son lundi, même abaissé à 3 h', async () => {
    preparer({ bascule: 0 })
    //  Seuil abaissé à 3 h seulement à partir du lundi 26 : la semaine du 19
    //  garde 40 h, celle du 26 est jugée à 3 h.
    REGLES.seuil = [
      { valeur: 40, date_effet: '2026-01-01' },
      { valeur: 3, date_effet: '2026-10-26' },
    ]
    REGLES.activation = [{ valeur: 1, date_effet: '2026-01-01' }]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))
    const semaines = semainesAvecHeures(res.thisMonth.plafond_hebdo)

    const s19 = semaines.find((s) => s.debut === '2026-10-19')
    const s26 = semaines.find((s) => s.debut === '2026-10-26')

    expect(s19.seuil_applique).toBe(40)
    expect(s19.depasse).toBe(false)
    expect(s26.seuil_applique).toBe(3)
    expect(s26.depasse).toBe(true)
    expect(s26.depassement_heures).toBe(1)
  })
})

describe('Le total du mois ne dit rien de l’alerte', () => {
  it('même total mensuel, alertes DIFFÉRENTES selon la bascule', async () => {
    REGLES.seuil = [
      { valeur: 40, date_effet: '2026-01-01' },
      { valeur: 45, date_effet: '2026-10-26' },
    ]
    REGLES.activation = [{ valeur: 1, date_effet: '2026-01-01' }]

    preparer({ bascule: 240 })
    const avec = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))

    preparer({ bascule: 0 })
    const sans = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))

    //  Le mois travaillé est identique : 44 h dans les deux cas.
    expect(avec.thisMonth.total_worked).toBe('44h00')
    expect(sans.thisMonth.total_worked).toBe('44h00')

    //  Mais l'ALERTE ne l'est pas.
    //  · bascule 04:00 → 44 h dans la semaine du 19, seuil 40 → DÉPASSEMENT.
    //  · bascule minuit → 4 h dans la semaine du 26, seuil 45 → AUCUN.
    expect(avec.thisMonth.plafond_hebdo.nb_depassees).toBe(1)
    expect(sans.thisMonth.plafond_hebdo.nb_depassees).toBe(0)
  })
})
