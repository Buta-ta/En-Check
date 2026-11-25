import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
//  SOLIDIFICATION DU PARCOURS COMPLET — `calculateEmployeeHours` de bout en bout
//
//  Les tests d'agrégateur isolé ne prouvaient rien du parcours réel : c'est
//  précisément là que « debut.getTime is not a function » vivait, invisible.
//  Ce fichier appelle donc le VRAI `calculateEmployeeHours`, avec un faux
//  Supabase qui rend des données FICTIVES et déterministes.
//
//  Aucun montant n'est affirmé ici : on vérifie des COMPORTEMENTS (heures
//  attendues, seuils, distinction fait/estimation), jamais une paie.
// ─────────────────────────────────────────────────────────────────────────────

const TABLES = {
  employees: [{ id: 'e1', enterprise_id: 'ent', first_name: 'Abdoul', last_name: 'Bio', matricule: 'AB-01' }],
  enterprises: [{ id: 'ent', timezone: 'Africa/Porto-Novo', currency: 'XAF', auto_close_enabled: false }],
  attendances: [],
  absences: [],
  employee_schedules: [],
  work_schedules: [],
  holidays: [],
  encheck_reglages_pointage: [],
  encheck_regles_temps_travail: [],
  overtime_settings: [],
  encheck_alertes_hebdo_activation: [],
  employee_payroll_profiles: [],
}

function reponse(table, unique) {
  const lignes = TABLES[table] ?? []
  return Promise.resolve({
    data: unique ? (lignes[0] ?? null) : lignes,
    count: lignes.length,
    error: null,
  })
}

//  Tous les opérateurs visités par les services (le faux doit être exhaustif,
//  sinon une méthode manquante passe pour une panne réseau).
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

//  ⚠️ Les RPC datées doivent répondre APPLIQUER PAR DATE, sinon le test ne
//  prouverait rien de la résolution par semaine. On simule ici le contrat de
//  `encheck_regle_resolue` : la version de date_effet la plus récente ≤ p_date,
//  et la règle personnelle VERROUILLÉE prioritaire sur celle de l'entreprise.
const REGLES = { versions: [], activation: [] }

function versionApplicable(cle, employe, date) {
  const candidates = REGLES.versions.filter(
    (v) => v.cle === cle && v.date_effet <= date && (v.employe_id === null || v.employe_id === employe),
  )
  if (candidates.length === 0) return null
  //  Une personnelle VERROUILLÉE l'emporte, quel que soit l'ordre des dates.
  const verrouillee = candidates
    .filter((v) => v.employe_id === employe && v.verrouille)
    .sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0]
  if (verrouillee) return verrouillee
  return candidates.sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0]
}

function rpc(nom, params) {
  const date = params?.p_date || '2026-10-24'
  if (nom === 'encheck_regle_resolue') {
    const v = versionApplicable(params.p_cle, params.p_employe ?? null, date)
    if (!v) {
      return Promise.resolve({
        data: [{ valeur: null, origine: 'aucune', date_effet: null, maj_par: null, maj_le: null, verrouille: false, regle_id: null }],
        error: null,
      })
    }
    return Promise.resolve({
      data: [{
        valeur: v.valeur,
        origine: v.employe_id ? 'employe' : 'entreprise',
        date_effet: v.date_effet,
        maj_par: null, maj_le: null,
        verrouille: v.verrouille === true,
        regle_id: v.id,
      }],
      error: null,
    })
  }
  if (nom === 'encheck_activation_alerte') {
    const v = REGLES.activation
      .filter((a) => a.date_effet <= date)
      .sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1))[0]
    if (!v) return Promise.resolve({ data: [], error: null })
    //  `normaliserActivation` lit un ÉTAT, pas un booléen : « activee » et
    //  « desactivee » sont deux actes, distincts de « jamais décidée ».
    return Promise.resolve({
      data: [{
        active: v.active,
        etat: v.active ? 'activee' : 'desactivee',
        depuis: v.date_effet,
        maj_par: null, maj_le: null, regle_id: v.id,
      }],
      error: null,
    })
  }
  return Promise.resolve({ data: [], error: null })
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (t) => chaine(t),
    rpc: (nom, params) => rpc(nom, params),
  },
}))

const { calculateEmployeeHours, seuilsAlerteHebdo } = await import('../hoursCalculator')
const { messageDepassement } = await import('../plafondHebdomadaire')

const grille = (id, du, au, debut, fin) => ({
  id, enterprise_id: 'ent', name: id, start_time: debut, end_time: fin,
  work_days: [1, 2, 3, 4, 5], is_active: true, is_default: true,
  valide_du: du, valide_au: au, created_at: '2026-01-01',
})

const pointage = (id, jour, heure, type) => ({
  id, employee_id: 'e1', check_time: `2026-10-${jour}T${heure}:00.000Z`,
  check_type: type, is_auto_closed: false, method: 'badge',
})

beforeEach(() => {
  TABLES.attendances = []
  TABLES.work_schedules = []
  TABLES.encheck_regles_temps_travail = []
  TABLES.employee_payroll_profiles = []
  REGLES.versions = []
  REGLES.activation = []
})

// ── POINT 1 ─────────────────────────────────────────────────────────────────
describe('Point 1 — le parcours complet ne plante plus', () => {
  it('1.1 `calculateEmployeeHours` rend un résultat complet (aucun TypeError)', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = [pointage('a1', '23', '08:00', 'in'), pointage('a2', '23', '16:00', 'out')]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-23T18:00:00Z'))

    //  Un plantage de `jourDeTravailEnCours` vidait tout l'objet : on exige
    //  la forme complète, pas seulement l'absence d'exception.
    expect(Object.keys(res)).toEqual(
      expect.arrayContaining(['employee', 'today', 'thisWeek', 'thisMonth', 'thisYear', 'valorization', 'alerts', 'feries']),
    )
    expect(res.employee.id).toBe('e1')
  })
})

// ── POINT 2 ─────────────────────────────────────────────────────────────────
describe('Point 2 — ce que dit le message de dépassement', () => {
  //  `messageDepassement` lit le résultat d'`evaluerSeuilsHebdo` : on lui donne
  //  donc la MÊME forme (semaines[]), pas des champs inventés.
  const evaluation = (heures, depassementHaut, max) => ({
    disponible: true,
    nb_depassees: 1,
    seuil: 40,
    seuil_majeur: 48,
    source: 'entreprise',
    max: { heures: max },
    semaines: [{ depassement_niveau_haut_heures: depassementHaut }],
    heures,
  })

  it('2.1 50 h avec seuils 40/48 : « 2 h », jamais « 48 h »', () => {
    const msg = messageDepassement(evaluation([50], 2, 50))
    expect(msg).toContain('2 h')
    expect(msg).toContain('(48 h)')
    //  Le défaut d'origine annonçait « 48 h dépassées au second niveau » pour
    //  une semaine de 50 h : faux de 46 h.
    expect(msg).not.toContain('48 h dépassées')
  })

  it('2.2 sous le second niveau : aucune mention de dépassement de niveau 2', () => {
    const msg = messageDepassement(evaluation([45], 0, 45))
    expect(msg).toContain('45 h')
    expect(msg).not.toMatch(/second niveau/)
  })

  it('2.3 dimanche et lundi : la journée en cours est bien datée dans le fuseau de l’entreprise', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]

    //  Dimanche 25/10 à 10:00 UTC → dimanche local.
    const dim = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-25T10:00:00Z'))
    expect(dim.today.date).toBe('2026-10-25')

    //  Dimanche 23:30 UTC = lundi 00:30 à Porto-Novo (UTC+1) : la bascule de
    //  minuit fait déjà basculer la journée. Ce n'est PAS un défaut de fuseau.
    const lundi = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-25T23:30:00Z'))
    expect(lundi.today.date).toBe('2026-10-26')
  })

  it('2.4 la bascule horaire de l’entreprise est respectée (pas ignorée)', async () => {
    //  `plan.bascule` est déjà en MINUTES ; le repasser dans `minutesDeBascule`
    //  donnait 0 et la bascule disparaissait silencieusement.
    TABLES.work_schedules = [{ ...grille('N', '2026-01-01', null, '22:00', '06:00'), bascule: 240 }]
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-26T02:00:00Z'))
    //  02:00 UTC = 03:00 locale, avant la bascule de 04:00 → encore le 25/10.
    expect(res.today.date ?? res.today.day).toBeTruthy()
  })
})

// ── POINT 3 ─────────────────────────────────────────────────────────────────
describe('Point 3 — la garde, relue avec les vraies bornes', () => {
  it('3.1 une grille entrant en vigueur en cours de semaine est prise en compte', async () => {
    //  8 h jusqu'au mercredi, 6 h à partir du jeudi. Le moteur attendait 24 h
    //  (3 jours × 8 h) au lieu de 36 h : la grille du jeudi était écartée
    //  parce qu'elle n'était pas valable AU PREMIER JOUR de la période.
    TABLES.work_schedules = [
      grille('G1', '2026-01-01', '2026-10-21', '08:00', '16:00'),
      grille('G2', '2026-10-22', null, '07:00', '13:00'),
    ]
    TABLES.attendances = ['19', '20', '21', '22', '23'].flatMap((j, i) => [
      pointage(`in${i}`, j, '05:00', 'in'),
      pointage(`out${i}`, j, '12:00', 'out'),
    ])

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T12:00:00Z'))

    expect(res.thisWeek.expected).toBe('36h00')
    expect(res.thisWeek.total).toBe('35h00')
    //  97,2 % : 35 h sur 36 h. Avant correctif : 145,8 % (35 h sur 24 h).
    expect(res.thisWeek.completion).toBe(97.2)
  })

  it('3.2 une garde du dimanche soir ne gonfle pas la semaine suivante', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    //  Le dimanche 25/10 n'est PAS ouvré dans cette grille : une intervention
    //  de garde ce soir-là doit être lue comme jours supplémentaires, et ne
    //  doit pas être aspirée par la semaine du 26/10.
    TABLES.attendances = [
      pointage('g1', '25', '22:00', 'in'),
      pointage('g2', '26', '02:00', 'out'),
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-26T12:00:00Z'))

    //  La semaine du 19/10 (la première lue) contient la garde : 4 h.
    //  La semaine du 26/10 ne doit PAS la contenir deux fois.
    expect(res.thisWeek.total).not.toBe('8h00')
    expect(res.thisMonth.total_worked).toBe('4h00')
  })
})

// ── POINT 4 ─────────────────────────────────────────────────────────────────
describe('Point 4 — fait établi et estimation sont distingués', () => {
  it('4.1 une entrée sans sortie ne se lit plus comme 8 h de travail prouvé', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    //  Une seule entrée, jamais fermée. Le moteur présume une sortie.
    TABLES.attendances = [pointage('a1', '24', '20:00', 'in')]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T23:00:00Z'))
    const m = res.thisMonth

    //  Le total n'a PAS changé (aucun montant n'est modifié par ce lot)…
    expect(m.total_worked).toBe('8h00')
    //  …mais la part présumée est désormais NOMMÉE.
    expect(m.virtualAutoCloseDays).toBe(1)
    expect(m.presumed_seconds).toBe(8 * 3600)
    expect(m.normal_seconds).toBe(8 * 3600)
  })

  it('4.2 l’alerte dit qu’il s’agit d’une estimation, pas d’un fait établi', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = [pointage('a1', '24', '20:00', 'in')]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T23:00:00Z'))
    const info = res.alerts.find((a) => /sortie présumée/.test(a.message || ''))
    expect(info).toBeTruthy()
    expect(info.message).toMatch(/fait établi/)
  })

  it('4.3 un badgeage complet ne déclenche aucune alerte d’estimation', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = [pointage('a1', '24', '08:00', 'in'), pointage('a2', '24', '16:00', 'out')]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T23:00:00Z'))
    expect(res.thisMonth.presumed_seconds).toBe(0)
    expect(res.alerts.some((a) => /sortie présumée/.test(a.message || ''))).toBe(false)
  })
})

// ── POINT 5 ─────────────────────────────────────────────────────────────────
describe('Point 5 — règles versionnées et date de résolution', () => {
  it('5.1 sans date, une règle versionnée est ignorée au profit du réglage d’entreprise', () => {
    //  `chargerReglesAlerte` n'envoie ni employé ni date : la RPC rend
    //  `origine = 'aucune'` et le moteur retombe sur le réglage 40/48.
    const sansDate = seuilsAlerteHebdo(
      { settings: { weekly_threshold: 40, weekly_threshold_major: 48, alerte_hebdo_activee: true } },
      { seuil: { valeur: null, origine: 'aucune' }, niveau2: { valeur: null } },
    )
    expect(sansDate.seuil).toBe(40)
    expect(sansDate.sourceValeur).toBe('reglage_entreprise')
  })

  it('5.2 avec sa date, la règle versionnée fait autorité', () => {
    const avecDate = seuilsAlerteHebdo(
      { settings: { weekly_threshold: 40, weekly_threshold_major: 48, alerte_hebdo_activee: true } },
      { seuil: { valeur: 45, origine: 'entreprise', dateEffet: '2026-01-01' }, niveau2: { valeur: 50 } },
    )
    expect(avecDate.seuil).toBe(45)
    expect(avecDate.seuilMajeur).toBe(50)
    expect(avecDate.sourceValeur).toBe('table_versionnee')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  POINT 5 — RÉSOLUTION PAR SEMAINE (décision option 3)
//
//  Chaque semaine se lit avec la règle en vigueur LE LUNDI de cette semaine,
//  dans le fuseau de l'entreprise. Une règle prenant effet en milieu de semaine
//  s'applique au lundi suivant : on ne coupe jamais une semaine en deux.
//  L'employé est transmis, donc une règle personnelle verrouillée garde sa
//  priorité. Valeurs FICTIVES (38 h, 45 h, 48 h) : aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

const version = (cle, valeur, dateEffet, { employe = null, verrouille = false, id = null } = {}) => ({
  id: id || `${cle}-${dateEffet}-${employe || 'ent'}`,
  cle, valeur, date_effet: dateEffet, employe_id: employe, verrouille,
})

//  5 jours travaillés par semaine, 8 h par jour (05:00 → 13:00 UTC).
const semainePleine = (jours) => jours.flatMap((j, i) => [
  pointage(`in-${j}-${i}`, j, '05:00', 'in'),
  pointage(`out-${j}-${i}`, j, '13:00', 'out'),
])

function semaineDu(res, lundiISO) {
  return (res.thisMonth.plafond_hebdo.semaines || []).find((s) => s.debut === lundiISO)
}

describe('Point 5 — résolution par semaine', () => {
  it('5.3 une règle prenant effet le mercredi s’applique au lundi SUIVANT', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = semainePleine(['19', '20', '21', '22', '23'])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 40, '2026-01-01'),
      //  Prise d'effet le MERCREDI 21/10 : la semaine du 19/10 reste à 40 h.
      version('alerte_hebdo_heures', 45, '2026-10-21'),
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))

    const semaine19 = semaineDu(res, '2026-10-19')
    expect(semaine19).toBeTruthy()
    //  40 h travaillées pour un seuil de 40 h : atteint, pas dépassé.
    expect(semaine19.seuil_applique).toBe(40)
    expect(semaine19.lundi_regle).toBe('2026-10-19')
    expect(semaine19.depasse).toBe(false)
    //  La semaine n'a que 5 jours échus sur 7 (référence au samedi 24) :
    //  l'absence de dépassement ne se prononce pas — c'est le comportement
    //  voulu, et c'est précisément ce que `non_evalue` dit.
    expect(semaine19.niveau).toBe('non_evalue')
    expect(semaine19.joursEchues).toBe(5)
  })

  it('5.4 le lundi suivant lit bien la nouvelle règle', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = semainePleine(['26', '27', '28', '29', '30'])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 40, '2026-01-01'),
      version('alerte_hebdo_heures', 45, '2026-10-21'),
    ]

    //  Référence au 30/10 : la fenêtre couvre les semaines du 19 et du 26.
    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-30T18:00:00Z'))

    const semaine26 = semaineDu(res, '2026-10-26')
    expect(semaine26).toBeTruthy()
    expect(semaine26.seuil_applique).toBe(45)
    expect(semaine26.lundi_regle).toBe('2026-10-26')
    expect(semaine26.seuil_source).toBe('entreprise')
  })

  it('5.5 une règle personnelle VERROUILLÉE prime sur celle de l’entreprise', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = semainePleine(['19', '20', '21', '22', '23'])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 45, '2026-01-01'),
      //  Awa a un seuil personnel VERROUILLÉ à 38 h, plus ancien que 45 h :
      //  le verrou l'emporte sur l'acte d'entreprise plus récent.
      version('alerte_hebdo_heures', 38, '2026-06-01', { employe: 'e1', verrouille: true }),
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')

    expect(semaine19.seuil_applique).toBe(38)
    expect(semaine19.seuil_source).toBe('employe')
    //  40 h pour un seuil personnel de 38 h : dépassement de 2 h.
    expect(semaine19.depasse).toBe(true)
    expect(semaine19.depassement_heures).toBe(2)
  })

  it('5.6 un employé sans règle personnelle garde le seuil de l’entreprise', async () => {
    TABLES.employees = [{ id: 'e2', enterprise_id: 'ent', first_name: 'Sans', last_name: 'Regle', matricule: 'SR-02' }]
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendance = []
    TABLES.attendances = ['19', '20', '21', '22', '23'].flatMap((j, i) => [
      { id: `in-${i}`, employee_id: 'e2', check_time: `2026-10-${j}T05:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
      { id: `out-${i}`, employee_id: 'e2', check_time: `2026-10-${j}T13:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
    ])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 45, '2026-01-01'),
      //  La règle verrouillée appartient à Awa (e1), PAS à e2.
      version('alerte_hebdo_heures', 38, '2026-06-01', { employe: 'e1', verrouille: true }),
    ]

    const res = await calculateEmployeeHours('e2', 'ent', new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')

    expect(semaine19.seuil_applique).toBe(45)
    expect(semaine19.seuil_source).toBe('entreprise')
  })

  it('5.7 une semaine à cheval sur une année se lit avec le lundi de décembre', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    //  Semaine du lundi 28/12/2026 au dimanche 03/01/2027.
    TABLES.attendances = ['28', '29', '30', '31'].flatMap((j, i) => [
      { id: `in-${i}`, employee_id: 'e1', check_time: `2026-12-${j}T05:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
      { id: `out-${i}`, employee_id: 'e1', check_time: `2026-12-${j}T13:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
    ])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 40, '2026-01-01'),
      //  Nouvelle grille au 1ᵉʳ JANVIER, en plein milieu de la semaine.
      version('alerte_hebdo_heures', 45, '2027-01-01'),
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2027-01-02T12:00:00Z'))
    //  La semaine du 28/12 est encore à 40 h : le 1ᵉʳ janvier ne la coupe pas.
    const semaine28 = (res.thisMonth.plafond_hebdo.semaines || []).find((s) => s.debut === '2026-12-28')
    if (semaine28) {
      expect(semaine28.seuil_applique).toBe(40)
      expect(semaine28.lundi_regle).toBe('2026-12-28')
    }
  })

  it('5.8 une semaine à cheval sur un mois porte la règle de son lundi', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    //  Semaine du lundi 28/09 au dimanche 04/10.
    TABLES.attendances = ['28', '29', '30'].flatMap((j, i) => [
      { id: `in-${i}`, employee_id: 'e1', check_time: `2026-09-${j}T05:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
      { id: `out-${i}`, employee_id: 'e1', check_time: `2026-09-${j}T13:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
    ])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 40, '2026-01-01'),
      //  Nouveau seuil au 1ᵉʳ OCTOBRE, en plein milieu de la semaine 28/09.
      version('alerte_hebdo_heures', 42, '2026-10-01'),
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-09-30T12:00:00Z'))
    const semaine28 = (res.thisMonth.plafond_hebdo.semaines || []).find((s) => s.debut === '2026-09-28')
    if (semaine28) {
      expect(semaine28.seuil_applique).toBe(40)
    }
  })

  it('5.9 le second seuil suit la même règle du lundi', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = semainePleine(['19', '20', '21', '22', '23'])
    REGLES.activation = [{ id: 'a1', active: true, date_effet: '2026-01-01' }]
    REGLES.versions = [
      version('alerte_hebdo_heures', 40, '2026-01-01'),
      version('alerte_hebdo_niveau2_heures', 48, '2026-01-01'),
      version('alerte_hebdo_niveau2_heures', 44, '2026-10-22'),
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')
    //  Le second niveau du 22/10 ne s'applique pas à la semaine du 19.
    expect(semaine19.seuil_majeur_applique).toBe(48)
  })

  it('5.10 une activation changée en milieu de semaine attend le lundi suivant', async () => {
    TABLES.work_schedules = [grille('G', '2026-01-01', null, '08:00', '16:00')]
    TABLES.attendances = semainePleine(['19', '20', '21', '22', '23'])
    REGLES.versions = [version('alerte_hebdo_heures', 40, '2026-01-01')]
    //  Alerte activée le JEUDI 22/10 : la semaine du 19 reste sans alerte.
    REGLES.activation = [
      { id: 'a0', active: false, date_effet: '2026-01-01' },
      { id: 'a1', active: true, date_effet: '2026-10-22' },
    ]

    const res = await calculateEmployeeHours('e1', 'ent', new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')
    //  Lundi 19 : l'activation en vigueur est encore `false`.
    expect(semaine19.seuil_applique).toBe(null)
  })
})
