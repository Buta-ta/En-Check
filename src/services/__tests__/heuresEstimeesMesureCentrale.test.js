// src/services/__tests__/heuresEstimeesMesureCentrale.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  LA MESURE DES HEURES ESTIMÉES — trois formes, un seul chiffre
//
//  Une sortie estimée arrive au moteur sous DEUX formes :
//    · `__virtual`    — fabriquée en mémoire, jamais écrite en base ;
//    · persistée      — ligne `is_auto_closed` avec ou sans validation.
//
//  Avant ce correctif, seule la première était mesurée. Une auto-clôture
//  persistée NON VALIDÉE était valorisée sans que rien ne le signale : la
//  carte affichait « Total brut » et la même durée qu'une journée réellement
//  badgée.
//
//  ⚠️ CE QUI EST PROTÉGÉ ICI — le correctif ne fait que MESURER. Les mêmes
//  assertions vérifient, pour chacun des trois cas, que `normal_seconds` et
//  `valorization.total_gross` ne bougent pas et que le filtrage de paie
//  continue d'écarter ce qu'il écartait.
//
//  ⚠️ Valeurs FICTIVES (1 000 XAF/h, plafond 12 h). Aucune n'est une règle
//     légale ni un montant réel.
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

function rpc(nom) {
  if (nom === 'encheck_regle_resolue') {
    return Promise.resolve({ data: [{ valeur: 40, origine: 'entreprise', date_effet: '2026-01-01' }], error: null })
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
const { filtrerPointagesPayables } = await import('../seuilsPointage')

const ENTREE = {
  id: 'in-1', employee_id: 'e1', check_time: '2026-10-24T12:00:00.000Z',
  check_type: 'in', is_auto_closed: false, method: 'badge',
}

const SORTIE_ESTIMEE = {
  id: 'out-1', employee_id: 'e1', check_time: '2026-10-24T20:00:00.000Z',
  check_type: 'out', is_auto_closed: true, method: 'auto_close',
}

/** Charge un état de base puis calcule le mois d'octobre 2026. */
async function calculer({ attendances }) {
  TABLES.employees = [{ id: 'e1', enterprise_id: 'ent', first_name: 'Awa', last_name: 'Test' }]
  TABLES.enterprises = [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }]
  TABLES.attendances = attendances
  TABLES.work_schedules = [{
    id: 'S', enterprise_id: 'ent', name: 'Standard', start_time: '08:00', end_time: '16:00',
    work_days: [1, 2, 3, 4, 5], is_active: true, is_default: true,
    valide_du: '2026-01-01', valide_au: null, created_at: '2026-01-01',
  }]
  TABLES.employee_payroll_profiles = [{ employee_id: 'e1', hourly_rate: 1000 }]
  return calculateEmployeeHours('e1', 'ent', new Date('2026-10-25T12:00:00Z'))
}

beforeEach(() => {
  for (const cle of Object.keys(TABLES)) TABLES[cle] = []
})

describe('mesure centrale des heures estimées', () => {
  //  ── 1) Sortie VIRTUELLE : entrée seule, le moteur présume la sortie ──────
  it('sortie virtuelle : mesurée, et l’alerte le dit', async () => {
    const res = await calculer({ attendances: [ENTREE] })
    const m = res.thisMonth

    expect(m.presumed_seconds).toBeGreaterThan(0)
    //  La mesure est bien une part de la durée, jamais un ajout en plus.
    expect(m.presumed_seconds).toBeLessThanOrEqual(m.normal_seconds)
    expect(res.alerts.some((a) => /sortie présumée/.test(a.message || ''))).toBe(true)
  })

  //  ── 2) Auto-clôture PERSISTÉE NON VALIDÉE : le cas qui échappait ────────
  it('auto-clôture persistée non validée : désormais mesurée', async () => {
    const res = await calculer({
      attendances: [ENTREE, { ...SORTIE_ESTIMEE, estimation_validee_le: null }],
    })
    const m = res.thisMonth

    //  8 h valorisées viennent d'une ligne que personne n'a validée.
    expect(m.presumed_seconds).toBe(8 * 3600)
    expect(res.alerts.some((a) => /sortie présumée/.test(a.message || ''))).toBe(true)

    //  ⚠️ Le montant, lui, ne bouge pas : on mesure, on ne réécrit pas.
    expect(m.normal_seconds).toBe(8 * 3600)
    expect(res.valorization.total_gross).toBe(8000)
  })

  //  ── 3) Auto-clôture VALIDÉE : un fait établi, donc plus une estimation ──
  it('auto-clôture validée : plus comptée comme estimation', async () => {
    const res = await calculer({
      attendances: [ENTREE, { ...SORTIE_ESTIMEE, estimation_validee_le: '2026-10-25T09:00:00.000Z' }],
    })
    const m = res.thisMonth

    expect(m.presumed_seconds).toBe(0)
    expect(res.alerts.some((a) => /sortie présumée/.test(a.message || ''))).toBe(false)

    //  Et la durée reste payée : valider ne retire rien.
    expect(m.normal_seconds).toBe(8 * 3600)
    expect(res.valorization.total_gross).toBe(8000)
  })

  //  ── 4) La mesure ne change pas le montant payé ───────────────────────────
  //  Une précision qui évite une comparaison fausse : dans le cas VIRTUEL, la
  //  sortie est CALCULÉE par le moteur (heure de fin de journée, plafonnée).
  //  Sa durée n'est donc pas comparable à une sortie persistée posée à 20:00.
  //  Ce qui se compare, c'est la même sortie persistée avant/après validation.
  it('même sortie persistée : valider ne change pas le montant, seulement la mesure', async () => {
    const nonValidee = await calculer({
      attendances: [ENTREE, { ...SORTIE_ESTIMEE, estimation_validee_le: null }],
    })
    const validee = await calculer({
      attendances: [ENTREE, { ...SORTIE_ESTIMEE, estimation_validee_le: '2026-10-25T09:00:00.000Z' }],
    })

    //  Le montant et la durée sont IDENTIQUES ; seule la part déclarée change.
    expect(nonValidee.valorization.total_gross).toBe(validee.valorization.total_gross)
    expect(nonValidee.thisMonth.normal_seconds).toBe(validee.thisMonth.normal_seconds)
    expect(nonValidee.thisMonth.presumed_seconds).not.toBe(validee.thisMonth.presumed_seconds)
  })

  it('cas virtuel : la durée présumée EST la durée valorisée', async () => {
    const res = await calculer({ attendances: [ENTREE] })
    const m = res.thisMonth

    //  Entrée seule : rien n'est badgé en sortie, donc tout est présumé.
    expect(m.presumed_seconds).toBe(m.normal_seconds)
    //  Et le montant reste celui des heures normales × taux (1 000 XAF/h).
    expect(res.valorization.total_gross).toBe(Math.round((m.normal_seconds / 3600) * 1000))
  })

  //  ── 5) Le filtrage de paie est inchangé ──────────────────────────────────
  it('filtrage de paie : la ligne non validée reste écartée, la validée reste retenue', async () => {
    const nonValidee = { ...SORTIE_ESTIMEE, estimation_validee_le: null }
    const validee = { ...SORTIE_ESTIMEE, estimation_validee_le: '2026-10-25T09:00:00.000Z' }

    //  Après la borne de non-rétroactivité : jamais payée sans validation.
    expect(filtrerPointagesPayables([ENTREE, nonValidee]).map((a) => a.id)).toEqual(['in-1'])
    //  Validée par un humain : elle compte.
    expect(filtrerPointagesPayables([ENTREE, validee]).map((a) => a.id)).toEqual(['in-1', 'out-1'])
    //  Une ligne sans date reste stricte : l'inconnu n'est pas « avant la borne ».
    const sansDate = { ...nonValidee, check_time: null }
    expect(filtrerPointagesPayables([sansDate])).toEqual([])
  })
})
