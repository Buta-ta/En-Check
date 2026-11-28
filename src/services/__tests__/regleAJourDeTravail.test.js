// src/services/__tests__/regleAJourDeTravail.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  RÈGLE A — LE SEUIL HEBDO COMPTE AU JOUR DE TRAVAIL DU SALARIÉ
//
//  Décision du fondateur : le seuil hebdomadaire suit le JOUR DE TRAVAIL
//  (attribution APRÈS application de la bascule), et non la date civile
//  dans le fuseau de l'entreprise.
//
//  Ce fichier FIGE le comportement retenu. Il ne corrige rien : il établit
//  ce que la règle A produit, chiffres en main, pour qu'une régression
//  future se voie.
//
//  ⚠️ CE QUE LA RÈGLE A N'EST PAS : une simple préférence d'affichage.
//  Elle décide QUELLE SEMAINE reçoit les heures d'un poste de nuit — donc
//  QUEL seuil s'applique, et SI une alerte tombe.
//
//  ⚠️ CONSÉQUENCE ASSUMÉE : deux salariés de la même entreprise, avec le
//  même pointage, peuvent obtenir des VERDICTS DIFFÉRENTS si leur
//  `custom_bascule` diffère. Ce n'est pas un défaut du moteur : c'est la
//  règle A. Le test 6 la fige explicitement.
//
//  ⚠️ Valeurs FICTIVES (1 000 / h, seuil 52 h). Aucun montant réel.
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

//  Faux RPC : un seuil d'entreprise à 52 h, provenance établie (donc un
//  seuil RÉELLEMENT CHOISI, pas un défaut produit).
function rpc(nom, params) {
  if (nom === 'encheck_regle_resolue') {
    const valeur = params?.p_cle === 'alerte_hebdo_heures' ? 52 : null
    return Promise.resolve({
      data: [{
        valeur, origine: 'entreprise', date_effet: '2026-01-01',
        maj_par: null, maj_le: null, verrouille: false, regle_id: null,
      }],
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

//  ─────────────────────────────────────────────────────────────────────────
//  LE JEU DE DONNÉES — l'histoire d'Awa
//
//  Du lundi 19 au vendredi 23 octobre : 08:00 → 18:00 locale, 9 h/jour
//  (une heure de pause incluse dans la grille 08:00–18:00), soit 45 h.
//  PLUS un service de nuit le LUNDI 26 de 03:00 à 07:00 locale : 4 h.
//
//  Porto-Novo = UTC+1, donc :
//    08:00 locale = 07:00Z   18:00 locale = 17:00Z
//    03:00 locale = 02:00Z   07:00 locale = 06:00Z
//  ─────────────────────────────────────────────────────────────────────────
const SEMAINE_NORMALE = ['19', '20', '21', '22', '23'].flatMap((j) => ([
  { id: `i${j}`, employee_id: 'e1', check_time: `2026-10-${j}T07:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
  { id: `o${j}`, employee_id: 'e1', check_time: `2026-10-${j}T17:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
]))

const NUIT_LUNDI_26 = [
  { id: 'i26', employee_id: 'e1', check_time: '2026-10-26T02:00:00.000Z', check_type: 'in', is_auto_closed: false, method: 'badge' },
  { id: 'o26', employee_id: 'e1', check_time: '2026-10-26T06:00:00.000Z', check_type: 'out', is_auto_closed: false, method: 'badge' },
]

/**
 * Prépare le plateau.
 * @param {number} bascule  bascule EFFECTIVE du salarié (0 ou 240)
 */
function preparer(bascule) {
  for (const k of Object.keys(TABLES)) delete TABLES[k]
  Object.assign(TABLES, {
    employees: [{ id: 'e1', enterprise_id: 'ent', first_name: 'Awa', last_name: 'K' }],
    enterprises: [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }],
    attendances: [...SEMAINE_NORMALE, ...NUIT_LUNDI_26],
    absences: [],
    holidays: [],
    //  ⚠️ `custom_bascule` n'est lue QUE si `use_custom_hours` est vrai ET
    //  que les champs `custom_*` sont fournis. Sans ces trois conditions,
    //  le test ne mesure RIEN (erreur commise dans un tour antérieur).
    employee_schedules: [{
      employee_id: 'e1',
      use_custom_hours: true,
      custom_start_time: '08:00',
      custom_end_time: '18:00',
      custom_work_days: [1, 2, 3, 4, 5],
      custom_bascule: bascule,
      valide_du: '2026-01-01',
      valide_au: null,
    }],
    work_schedules: [{
      id: 'S', enterprise_id: 'ent', name: 'Standard',
      start_time: '08:00', end_time: '18:00',
      work_days: [1, 2, 3, 4, 5],
      is_active: true, is_default: true, valide_du: '2026-01-01', valide_au: null,
      created_at: '2026-01-01', bascule: 0,
    }],
    encheck_reglages_pointage: [],
    encheck_regles_temps_travail: [],
    overtime_settings: [],
    encheck_alertes_hebdo_activation: [],
    employee_payroll_profiles: [{ employee_id: 'e1', hourly_rate: 1000 }],
  })
}

const INSTANT = new Date('2026-10-27T12:00:00Z')

/** La semaine dont le lundi est `lundi`, dans le plafond hebdo. */
function semaine(plafond, lundi) {
  return (plafond?.semaines ?? []).find((s) => s.debut === lundi) ?? null
}

beforeEach(() => preparer(240))

// ═══════════════════════════════════════════════════════════════════════════
//  1. L'ATTRIBUTION — la bascule décide du JOUR, pas du total
// ═══════════════════════════════════════════════════════════════════════════
describe('Règle A — le pointage de 03:00 le lundi 26 suit la bascule', () => {
  it('bascule 04:00 : il appartient au DIMANCHE 25, donc à la semaine du 19', async () => {
    preparer(240)
    const res = await calculateEmployeeHours('e1', 'ent', INSTANT)
    const plafond = res.thisMonth.plafond_hebdo

    //  50 h normales + 4 h de nuit = 54 h dans la semaine du 19.
    expect(semaine(plafond, '2026-10-19')?.heures).toBe(54)
    //  La semaine du 26 ne reçoit RIEN.
    expect(semaine(plafond, '2026-10-26')?.heures ?? 0).toBe(0)
  })

  it('bascule à minuit : il appartient au LUNDI 26, donc à la semaine du 26', async () => {
    preparer(0)
    const res = await calculateEmployeeHours('e1', 'ent', INSTANT)
    const plafond = res.thisMonth.plafond_hebdo

    expect(semaine(plafond, '2026-10-19')?.heures).toBe(50)
    expect(semaine(plafond, '2026-10-26')?.heures).toBe(4)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  2. LE VERDICT — la bascule change l'ALERTE, à total mensuel égal
// ═══════════════════════════════════════════════════════════════════════════
describe('Règle A — le verdict change alors que le mois est identique', () => {
  it('bascule 04:00 : 54 h pour un seuil de 52 h ⇒ DÉPASSEMENT de 2 h', async () => {
    preparer(240)
    const res = await calculateEmployeeHours('e1', 'ent', INSTANT)
    const s19 = semaine(res.thisMonth.plafond_hebdo, '2026-10-19')

    expect(s19.seuil_applique).toBe(52)
    expect(s19.depasse).toBe(true)
    expect(s19.depassement_heures).toBe(2)
  })

  it('bascule à minuit : 50 h pour un seuil de 52 h ⇒ AUCUN dépassement', async () => {
    preparer(0)
    const res = await calculateEmployeeHours('e1', 'ent', INSTANT)
    const s19 = semaine(res.thisMonth.plafond_hebdo, '2026-10-19')

    expect(s19.seuil_applique).toBe(52)
    expect(s19.depasse).toBe(false)
    expect(s19.depassement_heures).toBe(0)
  })

  it('le total DU MOIS est identique dans les deux cas — 54 h', async () => {
    preparer(240)
    const avec = await calculateEmployeeHours('e1', 'ent', INSTANT)
    preparer(0)
    const sans = await calculateEmployeeHours('e1', 'ent', INSTANT)

    //  ⚠️ C'est le point à retenir : le total ne dit RIEN de l'alerte.
    expect(avec.thisMonth.total_worked).toBe(sans.thisMonth.total_worked)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  3. LES BORNES — la période n'est JAMAIS déplacée
// ═══════════════════════════════════════════════════════════════════════════
describe('Règle A — les bornes de semaine ne bougent jamais', () => {
  it('les semaines vont toujours du lundi au dimanche, quelle que soit la bascule', async () => {
    for (const bascule of [0, 240]) {
      preparer(bascule)
      const res = await calculateEmployeeHours('e1', 'ent', INSTANT)
      const semaines = res.thisMonth.plafond_hebdo.semaines ?? []

      for (const s of semaines) {
        const lundi = new Date(`${s.debut}T12:00:00Z`)
        const dimanche = new Date(`${s.fin}T12:00:00Z`)
        expect(lundi.getUTCDay()).toBe(1)      // lundi
        expect(dimanche.getUTCDay()).toBe(0)   // dimanche
        //  Sept jours exactement.
        const ecart = (dimanche - lundi) / 86400000
        expect(ecart).toBe(6)
      }
    }
  })

  it('les bornes sont les MÊMES sous les deux bascules', async () => {
    preparer(240)
    const a = await calculateEmployeeHours('e1', 'ent', INSTANT)
    preparer(0)
    const b = await calculateEmployeeHours('e1', 'ent', INSTANT)

    const bornes = (r) => (r.thisMonth.plafond_hebdo.semaines ?? []).map((s) => `${s.debut}→${s.fin}`)
    expect(bornes(a)).toEqual(bornes(b))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  4. LA CONSÉQUENCE ASSUMÉE — deux salariés, deux verdicts
// ═══════════════════════════════════════════════════════════════════════════
describe('Règle A — conséquence assumée : deux salariés, deux verdicts', () => {
  it('même pointage à 03:00, bascules différentes ⇒ verdicts DIFFÉRENTS', async () => {
    //  Awa : bascule 04:00 ⇒ ses 4 h vont au dimanche 25 ⇒ 54 h ⇒ dépassement.
    preparer(240)
    const awa = await calculateEmployeeHours('e1', 'ent', INSTANT)
    const awa19 = semaine(awa.thisMonth.plafond_hebdo, '2026-10-19')

    //  Koffi : bascule minuit ⇒ ses 4 h restent au lundi 26 ⇒ 50 h ⇒ conforme.
    preparer(0)
    const koffi = await calculateEmployeeHours('e1', 'ent', INSTANT)
    const koffi19 = semaine(koffi.thisMonth.plafond_hebdo, '2026-10-19')

    //  Ce n'est PAS un défaut : c'est la règle A. Le test le FIGE.
    expect(awa19.heures).toBe(54)
    expect(koffi19.heures).toBe(50)
    expect(awa19.depasse).toBe(true)
    expect(koffi19.depasse).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  5. LE POSTE DE NUIT — une seule journée de travail
// ═══════════════════════════════════════════════════════════════════════════
describe('Règle A — un poste de nuit reste UNE journée de travail', () => {
  it('22:00 → 06:00 avec bascule 04:00 : tout appartient à la journée du départ', async () => {
    for (const k of Object.keys(TABLES)) delete TABLES[k]
    Object.assign(TABLES, {
      employees: [{ id: 'e1', enterprise_id: 'ent', first_name: 'N', last_name: 'U' }],
      enterprises: [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }],
      //  Nuit du lundi 19 au mardi 20, 22:00 → 06:00 locale (21:00Z → 05:00Z).
      attendances: [
        { id: 'n1', employee_id: 'e1', check_time: '2026-10-19T21:00:00.000Z', check_type: 'in', is_auto_closed: false, method: 'badge' },
        { id: 'n2', employee_id: 'e1', check_time: '2026-10-20T05:00:00.000Z', check_type: 'out', is_auto_closed: false, method: 'badge' },
      ],
      absences: [], holidays: [],
      employee_schedules: [{
        employee_id: 'e1', use_custom_hours: true,
        custom_start_time: '22:00', custom_end_time: '06:00',
        custom_work_days: [1, 2, 3, 4, 5],
        custom_bascule: 240, valide_du: '2026-01-01', valide_au: null,
      }],
      work_schedules: [{
        id: 'S', enterprise_id: 'ent', name: 'Nuit',
        start_time: '22:00', end_time: '06:00', work_days: [1, 2, 3, 4, 5],
        is_active: true, is_default: true, valide_du: '2026-01-01', valide_au: null,
        created_at: '2026-01-01', bascule: 240,
      }],
      encheck_reglages_pointage: [], encheck_regles_temps_travail: [],
      overtime_settings: [], encheck_alertes_hebdo_activation: [],
      employee_payroll_profiles: [{ employee_id: 'e1', hourly_rate: 1000 }],
    })

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-21T12:00:00Z'))
    //  Les 8 h de la nuit restent dans la semaine du 19, pas coupées en deux.
    expect(semaine(res.thisMonth.plafond_hebdo, '2026-10-19')?.heures).toBe(8)
  })
})
