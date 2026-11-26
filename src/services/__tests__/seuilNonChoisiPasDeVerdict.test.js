// src/services/__tests__/seuilNonChoisiPasDeVerdict.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  UN SEUIL PROPOSÉ N'EST PAS UN SEUIL APPLIQUÉ.
//
//  `getOvertimeSettingsAvecOrigine` fusionne TOUJOURS les défauts du produit :
//  sans aucune ligne enregistrée, `weekly_threshold` vaut 48. Cette valeur
//  pré-remplit un formulaire — elle ne compare jamais des heures.
//
//  Défaut mesuré (round 19), avant correction :
//
//    | aucun seuil, activation jamais décidée | dispo=true | seuil=null | dep=0 |
//    | aucun seuil, activation « activée »    | dispo=true | seuil=48   | dep=1 |
//
//  La seconde ligne est le mensonge : personne n'avait choisi 48, et pourtant
//  la semaine recevait un dépassement. 50 h sans seuil configuré doivent dire
//  « contrôle indisponible », jamais « dépassement de 2 h ».
//
//  Ce fichier fige le comportement attendu, et vérifie que le calcul reste
//  INTACT quand un seuil explicite est réellement résolu et actif.
//
//  ⚠️ Valeurs FICTIVES (40 h, 45 h). Aucune n'est une règle légale, et aucun
//  montant de paie n'est affirmé ici : on ne regarde que l'ALERTE.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'

const TABLES = {
  employees: [], enterprises: [], attendances: [], absences: [],
  employee_schedules: [], work_schedules: [], holidays: [],
  encheck_reglages_pointage: [], encheck_regles_temps_travail: [],
  overtime_settings: [], encheck_alertes_hebdo_activation: [],
  employee_payroll_profiles: [],
}

//  Ce que la table VERSIONNÉE répond, par clé. Une LISTE de versions datées :
//  un faux qui rendrait la même valeur à toutes les dates ne saurait pas dire
//  « la règle n'existait pas encore » — c'est pourtant le cas décisif ici.
const REGLES = { seuil: [], niveau2: [] }
//  Ce que la RPC d'activation répond. `null` = aucune ligne (jamais décidée).
const ACTIVATION = { active: null }

const plusRecent = (liste, date) => (liste || [])
  .filter((v) => v.date_effet <= date)
  .sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0] ?? null

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

function rpc(nom, params) {
  const date = params?.p_date || '2026-10-24'
  if (nom === 'encheck_regle_resolue') {
    //  ⚠️ Les clés sont servies SÉPARÉMENT : un faux qui rend la même valeur
    //  aux deux clés ferait passer un `niveau2` absent pour un second niveau
    //  configuré.
    const cle = params?.p_cle === 'alerte_hebdo_niveau2_heures' ? 'niveau2' : 'seuil'
    const v = plusRecent(REGLES[cle], date)
    return Promise.resolve({
      data: [v
        ? {
            valeur: v.valeur,
            origine: 'entreprise',
            date_effet: v.date_effet,
            maj_par: null, maj_le: null, verrouille: false, regle_id: null,
          }
        : { valeur: null, origine: 'aucune', date_effet: null }],
      error: null,
    })
  }
  if (nom === 'encheck_activation_alerte') {
    if (ACTIVATION.active === null) return Promise.resolve({ data: [], error: null })
    //  ⚠️ `etat` doit être COHÉRENT avec `active` : `normaliserActivation`
    //  ramène « jamais décidée » sur un état qu'il ne sait pas nommer, ce qui
    //  éteindrait l'alerte et rendrait le test vert pour la mauvaise raison.
    return Promise.resolve({
      data: [{
        active: ACTIVATION.active,
        etat: ACTIVATION.active ? 'activee' : 'desactivee',
        depuis: ACTIVATION.depuis ?? '2026-01-01',
      }],
      error: null,
    })
  }
  return Promise.resolve({ data: [], error: null })
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t) => chaine(t), rpc: (n, p) => rpc(n, p) },
}))

const { calculateEmployeeHours } = await import('../hoursCalculator')

//  5 jours × 10 h = 50 h dans la semaine du 19 au 23 octobre 2026.
//  La semaine lundi→dimanche qui les contient commence le lundi 19/10.
const SEMAINE_50H = ['19', '20', '21', '22', '23'].flatMap((j) => [
  { id: `in-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T07:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
  { id: `out-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T17:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
])

function preparer({ ligneOvertime = null } = {}) {
  TABLES.employees = [{ id: 'e1', enterprise_id: 'ent', first_name: 'Awa', last_name: 'Test' }]
  TABLES.enterprises = [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF' }]
  TABLES.attendances = SEMAINE_50H
  TABLES.absences = []
  TABLES.employee_schedules = []
  TABLES.holidays = []
  TABLES.work_schedules = [{
    id: 'S', enterprise_id: 'ent', name: 'Standard',
    start_time: '08:00', end_time: '16:00', work_days: [1, 2, 3, 4, 5],
    is_active: true, is_default: true, valide_du: '2026-01-01', valide_au: null,
    created_at: '2026-01-01', bascule: 0,
  }]
  TABLES.encheck_reglages_pointage = []
  TABLES.encheck_regles_temps_travail = []
  //  La LIGNE de réglage telle qu'elle existe en base — ou son absence.
  TABLES.overtime_settings = ligneOvertime ? [ligneOvertime] : []
  TABLES.encheck_alertes_hebdo_activation = []
  TABLES.employee_payroll_profiles = [{ employee_id: 'e1', hourly_rate: 1000 }]
}

const plafond = async () => {
  const r = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-27T12:00:00Z'))
  return r.thisMonth.plafond_hebdo
}

beforeEach(() => {
  preparer()
  REGLES.seuil = []
  REGLES.niveau2 = []
  ACTIVATION.active = null
})

describe('Aucun seuil choisi — le contrôle est indisponible, pas « tout va bien »', () => {
  it('50 h sans aucun seuil enregistré et sans décision d’activation : aucun dépassement', async () => {
    const p = await plafond()

    //  Le contrôle n'a pas eu lieu : c'est un fait à dire, pas un silence.
    expect(p.disponible).toBe(false)
    expect(p.seuil).toBe(null)
    //  Les 50 h sont bien mesurées — on ne les cache pas.
    expect(p.max?.heures).toBe(50)
    //  …mais elles ne sont comparées à RIEN.
    expect(p.nb_depassees).toBe(0)
    //  Le 48 reste une simple suggestion de formulaire.
    expect(p.seuil_propose).toBe(48)
  })

  it('50 h sans seuil mais avec alerte « activée » : 48 ne devient pas un seuil', async () => {
    ACTIVATION.active = true
    const p = await plafond()

    expect(p.disponible).toBe(false)
    expect(p.seuil).toBe(null)
    expect(p.nb_depassees).toBe(0)
    //  La suggestion ne doit JAMAIS servir à comparer, même case cochée.
    expect(p.seuil_propose).toBe(48)
    expect(p.max?.heures).toBe(50)
  })

  it('une ligne en base valant 48 (valeur d’un défaut connu) n’est pas un seuil confirmé', async () => {
    preparer({ ligneOvertime: { enterprise_id: 'ent', weekly_threshold: 48, alerte_hebdo_activee: true } })
    ACTIVATION.active = true
    const p = await plafond()

    //  `qualifierOrigineSeuilHebdo` classe 48 ET 40 comme défauts connus :
    //  la valeur peut avoir été écrite sans qu'un humain l'ait choisie.
    expect(p.disponible).toBe(false)
    expect(p.seuil).toBe(null)
    expect(p.nb_depassees).toBe(0)
  })

  it('chaque semaine non évaluée porte son motif, aucune n’est « conforme » par défaut', async () => {
    const p = await plafond()

    expect(p.disponible).toBe(false)
    expect(p.motif).toBeTruthy()
    //  Les semaines du mois sont énumérées, et aucune n'a de verdict.
    expect(p.seuils_par_semaine.length).toBeGreaterThan(0)
    for (const s of p.seuils_par_semaine) {
      expect(s.seuil).toBe(null)
      expect(s.resolu).toBe(false)
    }
  })
})

describe('Semaine mixte — un dépassement vérifié ne se cache pas derrière une semaine non évaluée', () => {
  //  La semaine du 12 est antérieure à la règle (seuil créé au 19/10) : elle
  //  n'est pas évaluable. Celle du 19 l'est, et dépasse. Il faut voir les DEUX.
  const semainesAvant = ['12', '13', '14', '15', '16'].flatMap((j) => [
    { id: `in-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T07:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
    { id: `out-${j}`, employee_id: 'e1', check_time: `2026-10-${j}T17:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
  ])

  it('la semaine sans règle reste sans verdict, celle du 19 porte le sien', async () => {
    preparer()
    TABLES.attendances = [...SEMAINE_50H, ...semainesAvant]
    REGLES.seuil = [{ valeur: 40, date_effet: '2026-10-19' }]
    ACTIVATION.active = true

    const p = await plafond()
    const parDebut = Object.fromEntries(p.semaines.map((s) => [s.debut, s]))

    //  Semaine du 12 : antérieure à la règle, donc non évaluable.
    expect(parDebut['2026-10-12'].heures).toBe(50)
    expect(parDebut['2026-10-12'].regle_resolue).toBe(false)
    expect(parDebut['2026-10-12'].seuil_applique).toBe(null)
    expect(parDebut['2026-10-12'].depasse).toBe(false)
    expect(parDebut['2026-10-12'].motif).toBeTruthy()

    //  Semaine du 19 : évaluée, et son dépassement est PRONONCÉ.
    expect(parDebut['2026-10-19'].regle_resolue).toBe(true)
    expect(parDebut['2026-10-19'].seuil_applique).toBe(40)
    expect(parDebut['2026-10-19'].depasse).toBe(true)

    //  L'indisponibilité globale ne doit pas effacer le dépassement vérifié.
    expect(p.disponible).toBe(false)
    expect(p.nb_depassees).toBe(1)
  })
})

describe('Un seuil explicite et actif — le calcul reste intact', () => {
  it('seuil 40 résolu en table + activation : 50 h dépassent, et 40 est le seuil', async () => {
    REGLES.seuil = [{ valeur: 40, date_effet: '2026-01-01' }]
    ACTIVATION.active = true
    const p = await plafond()

    expect(p.disponible).toBe(true)
    expect(p.seuil).toBe(40)
    expect(p.nb_depassees).toBe(1)
    expect(p.max?.heures).toBe(50)
    //  Le seuil appliqué est celui qui a été choisi, pas la suggestion 48.
    expect(p.seuil_propose).toBe(40)
  })

  it('même seuil 40 mais alerte désactivée : seuil lu, aucun verdict', async () => {
    REGLES.seuil = [{ valeur: 40, date_effet: '2026-01-01' }]
    ACTIVATION.active = false
    const p = await plafond()

    //  Le seuil existe et est résolu ; c'est la comparaison qui n'a pas lieu.
    expect(p.disponible).toBe(true)
    expect(p.seuil).toBe(null)
    expect(p.nb_depassees).toBe(0)
  })

  it('un seuil de 45 laisse 50 h dépasser — le seuil appliqué est bien celui de la table', async () => {
    REGLES.seuil = [{ valeur: 45, date_effet: '2026-01-01' }]
    ACTIVATION.active = true
    const p = await plafond()

    expect(p.seuil).toBe(45)
    expect(p.nb_depassees).toBe(1)
  })

  it('un seuil de 52 ne produit aucun dépassement sur 50 h', async () => {
    REGLES.seuil = [{ valeur: 52, date_effet: '2026-01-01' }]
    ACTIVATION.active = true
    const p = await plafond()

    expect(p.disponible).toBe(true)
    expect(p.seuil).toBe(52)
    expect(p.nb_depassees).toBe(0)
  })
})
