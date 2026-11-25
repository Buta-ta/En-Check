// src/services/__tests__/reglesAlerteSemaineSql.test.js
// ═══════════════════════════════════════════════════════════════════════════
//  RÉSOLUTION PAR SEMAINE — CONTRE LA VRAIE RPC, DANS UN VRAI POSTGRES
//
//  Les tests de `solidificationParcoursComplet` utilisent un faux Supabase :
//  ils prouvent que le MOTEUR demande la bonne date, PAS que Postgres répond
//  correctement. Ce fichier ferme cette porte.
//
//  Ici, `calculateEmployeeHours` tourne de bout en bout, et ses appels RPC
//  partent réellement vers PGlite, sur les MIGRATIONS DU DÉPÔT :
//      · priorité d'une règle personnelle VERROUILLÉE ;
//      · repli sur la règle d'entreprise ;
//      · activation versionnée (« jamais décidée » ≠ « désactivée ») ;
//      · dates d'effet, dont le report au lundi suivant.
//
//  Seules les tables métier (employés, pointages, plannings) sont simulées :
//  ce sont des données, pas la logique testée.
//
//  ⚠️ Valeurs FICTIVES (38 h, 42 h, 45 h, 48 h). Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATIONS = [
  'supabase/migrations/20261123000002_encheck_regles_temps_travail.sql',
  'supabase/migrations/20261123000003_regles_retour_et_impact.sql',
  'supabase/migrations/20261124000001_informations_regle.sql',
  'supabase/migrations/20261124000002_activation_alerte_versionnee.sql',
]

const ENT = '11111111-1111-4111-8111-111111111111'
const ADMINS = { normal: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
const EMP = {
  awa: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',   // règle personnelle verrouillée
  sans: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',  // aucune règle personnelle
}

// ── Données métier simulées (le reste est réel) ────────────────────────────
const TABLES = {
  employees: [], enterprises: [], attendances: [], absences: [],
  employee_schedules: [], work_schedules: [], holidays: [],
  encheck_reglages_pointage: [], encheck_regles_temps_travail: [],
  overtime_settings: [], encheck_alertes_hebdo_activation: [],
  employee_payroll_profiles: [],
}

/**
 * Filtres réellement appliqués.
 *
 * ⚠️ Un faux client qui IGNORE `.eq()` rend toutes les lignes. Deux employés
 * en base, et le moteur lit toujours le premier : un test qui prétend vérifier
 * « l'employé sans règle personnelle » ne vérifiait alors que le premier
 * employé de la table. C'est exactement ce qui s'est produit ici, et c'est
 * pourquoi ce faux applique les filtres au lieu de les avaler.
 */
function appliquerFiltres(lignes, filtres) {
  return lignes.filter((ligne) => filtres.every((f) => {
    const valeur = ligne?.[f.colonne]
    if (f.type === 'eq') return String(valeur) === String(f.valeur)
    if (f.type === 'in') return (f.valeur || []).some((v) => String(v) === String(valeur))
    if (f.type === 'is') return f.valeur === null ? valeur === null || valeur === undefined : valeur === f.valeur
    if (f.type === 'gte') return valeur !== null && valeur !== undefined && String(valeur) >= String(f.valeur)
    if (f.type === 'lte') return valeur !== null && valeur !== undefined && String(valeur) <= String(f.valeur)
    return true
  }))
}

function chaine(table) {
  const filtres = []
  const reponse = (unique) => {
    const lignes = appliquerFiltres(TABLES[table] ?? [], filtres)
    return Promise.resolve({
      data: unique ? (lignes[0] ?? null) : lignes,
      count: lignes.length,
      error: null,
    })
  }
  const o = {
    select: () => o, order: () => o, limit: () => o, not: () => o,
    range: () => o, contains: () => o,
    eq: (c, v) => { filtres.push({ type: 'eq', colonne: c, valeur: v }); return o },
    in: (c, v) => { filtres.push({ type: 'in', colonne: c, valeur: v }); return o },
    is: (c, v) => { filtres.push({ type: 'is', colonne: c, valeur: v }); return o },
    gte: (c, v) => { filtres.push({ type: 'gte', colonne: c, valeur: v }); return o },
    lte: (c, v) => { filtres.push({ type: 'lte', colonne: c, valeur: v }); return o },
    ilike: () => o, or: () => o, neq: () => o,
    maybeSingle: () => reponse(true),
    single: () => reponse(true),
    then: (ok, ko) => reponse(false).then(ok, ko),
  }
  return o
}

// ── Router : les RPC partent vers PGlite, les tables vers le faux ──────────
let pg = null

async function rpcReel(nom, params) {
  //  PGlite rend une `date` en objet Date : on la ramène en texte, comme
  //  le ferait PostgREST.
  const noms = Object.keys(params || {})
  const placeholders = noms.map((_, i) => `$${i + 1}`).join(', ')
  const valeurs = noms.map((n) => params[n])
  const { rows } = await pg.query(
    `select * from public.${nom}(${placeholders})`,
    valeurs,
  )
  return { data: rows.map(normaliserDates), error: null }
}

function normaliserDates(ligne) {
  const out = {}
  for (const [k, v] of Object.entries(ligne)) {
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v
  }
  return out
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t) => chaine(t), rpc: (n, p) => rpcReel(n, p) },
}))

//  `reglesTempsTravail` passe par `db()`, pas par `supabase` : on route aussi.
vi.mock('../../lib/db', () => ({
  db: () => ({ from: (t) => chaine(t), rpc: (n, p) => rpcReel(n, p) }),
}))

const { calculateEmployeeHours } = await import('../hoursCalculator')

const grille = (id, debut, fin) => ({
  id, enterprise_id: ENT, name: id, start_time: debut, end_time: fin,
  work_days: [1, 2, 3, 4, 5], is_active: true, is_default: true,
  valide_du: '2026-01-01', valide_au: null, created_at: '2026-01-01',
})

const badgeages = (employe, jours, mois = '10') => jours.flatMap((j) => [
  { id: `in-${employe.slice(0, 4)}-${j}`, employee_id: employe, check_time: `2026-${mois}-${j}T05:00:00.000Z`, check_type: 'in', is_auto_closed: false, method: 'badge' },
  { id: `out-${employe.slice(0, 4)}-${j}`, employee_id: employe, check_time: `2026-${mois}-${j}T13:00:00.000Z`, check_type: 'out', is_auto_closed: false, method: 'badge' },
])

/** Écriture directe d'une version : le propriétaire de la base, pas un client. */
async function semerRegle({ cle, valeur, date, employe = null, verrouille = false }) {
  await pg.exec('reset role')
  await pg.query(
    `insert into public.encheck_regles_temps_travail
       (cle, entreprise_id, employe_id, valeur, date_effet, verrouille, maj_le)
     values ($1,$2,$3,$4,$5,$6, now())`,
    [cle, ENT, employe, valeur, date, verrouille],
  )
}

function preparerEmploye(id, prenom) {
  return {
    id, enterprise_id: ENT, first_name: prenom, last_name: 'Test',
    matricule: `T-${prenom}`, email: null, phone: null, is_active: true,
  }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.admins (id uuid primary key, role text not null);
    create table public.admin_entreprises (admin_id uuid, enterprise_id uuid, is_active boolean default true);
    create table public.employees (id uuid primary key, enterprise_id uuid not null);

    create or replace function public.current_admin_id() returns uuid
      language sql stable as $$ select nullif(current_setting('app.admin_id', true), '')::uuid $$;

    create or replace function public.encheck_est_super_admin() returns boolean
      language sql stable as $$
        select exists(select 1 from public.admins a
                      where a.id = public.current_admin_id() and a.role = 'super_admin') $$;

    create or replace function public.admin_has_access_to_enterprise(target uuid)
      returns boolean language sql stable as $$
        select exists(
          select 1 from public.admins a
          where a.id = public.current_admin_id()
            and (a.role = 'super_admin'
                 or exists (select 1 from public.admin_entreprises ae
                            where ae.admin_id = a.id and ae.enterprise_id = target
                              and ae.is_active is true))) $$;

    insert into public.admins (id, role) values ('${ADMINS.normal}', 'admin');
    insert into public.admin_entreprises (admin_id, enterprise_id) values ('${ADMINS.normal}', '${ENT}');
    insert into public.employees (id, enterprise_id) values ('${EMP.awa}', '${ENT}'), ('${EMP.sans}', '${ENT}');
  `)
  for (const f of MIGRATIONS) await pg.exec(readFileSync(f, 'utf8'))
}, 120000)

afterAll(async () => {
  await pg?.close()
})

beforeEach(async () => {
  await pg.exec('reset role')
  await pg.exec('delete from public.encheck_informations_regle')
  await pg.exec('delete from public.encheck_regles_temps_travail')
  await pg.query("select set_config('app.admin_id', $1, false)", [ADMINS.normal])

  TABLES.employees = [preparerEmploye(EMP.awa, 'Awa'), preparerEmploye(EMP.sans, 'Sans')]
  TABLES.enterprises = [{ id: ENT, timezone: 'Africa/Porto-Novo', currency: 'XAF', auto_close_enabled: false }]
  TABLES.work_schedules = [grille('G', '08:00', '16:00')]
  TABLES.attendances = []
  TABLES.absences = []
  TABLES.employee_schedules = []
  TABLES.holidays = []
  TABLES.encheck_reglages_pointage = []
  TABLES.encheck_regles_temps_travail = []
  TABLES.overtime_settings = []
  TABLES.encheck_alertes_hebdo_activation = []
  TABLES.employee_payroll_profiles = []
})

const semaineDu = (res, lundi) =>
  (res.thisMonth.plafond_hebdo.semaines || []).find((s) => s.debut === lundi)

describe('Résolution par semaine — vraie RPC dans Postgres', () => {
  it('1. une règle personnelle VERROUILLÉE prime, et seul l’employé concerné la reçoit', async () => {
    TABLES.attendances = badgeages(EMP.awa, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-01-01' })
    //  38 h personnelles VERROUILLÉES, plus anciennes que l'acte d'entreprise.
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-06-01', employe: EMP.awa, verrouille: true })

    const res = await calculateEmployeeHours(EMP.awa, ENT, new Date('2026-10-24T18:00:00Z'))
    const semaine = semaineDu(res, '2026-10-19')

    expect(semaine.seuil_applique).toBe(38)
    expect(semaine.seuil_source).toBe('employe')
    //  40 h travaillées pour un seuil personnel de 38 h.
    expect(semaine.depasse).toBe(true)
    expect(semaine.depassement_heures).toBe(2)
  })

  it('2. un employé sans règle personnelle replie sur la règle d’entreprise', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 38, date: '2026-06-01', employe: EMP.awa, verrouille: true })

    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2026-10-24T18:00:00Z'))
    const semaine = semaineDu(res, '2026-10-19')

    expect(semaine.seuil_applique).toBe(45)
    expect(semaine.seuil_source).toBe('entreprise')
    expect(semaine.depasse).toBe(false)
  })

  it('3. une règle du mercredi ne s’applique qu’au lundi suivant (vraies dates d’effet)', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-01-01' })
    //  Prise d'effet le MERCREDI 21/10.
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-10-21' })

    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')

    //  Postgres, interrogé au 19/10, ne voit pas encore la version du 21.
    expect(semaine19.seuil_applique).toBe(40)
    expect(semaine19.lundi_regle).toBe('2026-10-19')
  })

  it('4. le lundi suivant lit la version du mercredi précédent', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 45, date: '2026-10-21' })

    //  Référence au 30/10 : la fenêtre contient les semaines du 19 et du 26.
    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2026-10-30T18:00:00Z'))

    const semaine26 = semaineDu(res, '2026-10-26')
    expect(semaine26).toBeTruthy()
    expect(semaine26.seuil_applique).toBe(45)
  })

  it('5. une activation décidée le jeudi ne s’applique pas à la semaine en cours', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    //  `valeur` est `numeric` : l'activation s'y écrit 0, jamais `false`.
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 0, date: '2026-01-01' })
    //  Activation décidée le JEUDI 22/10.
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-10-22' })

    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')

    //  Au lundi 19, l'activation en vigueur est encore `false` : pas de seuil.
    expect(semaine19.seuil_applique).toBe(null)
  })

  it('6. aucune activation décidée : « jamais décidée » n’allume aucune alerte', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    //  Aucune ligne d'activation : la RPC rend 'jamais_decidee'.

    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')

    expect(semaine19.seuil_applique).toBe(null)
    expect(semaine19.regle_resolue).toBe(true)
  })

  it('7. le second seuil suit ses propres dates d’effet', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['19', '20', '21', '22', '23'])
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_niveau2_heures', valeur: 48, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_niveau2_heures', valeur: 44, date: '2026-10-22' })

    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2026-10-24T18:00:00Z'))
    const semaine19 = semaineDu(res, '2026-10-19')

    //  Le second niveau du 22/10 n'existe pas encore au lundi 19.
    expect(semaine19.seuil_majeur_applique).toBe(48)
  })

  it('8. une semaine à cheval sur l’année garde la règle de son lundi de décembre', async () => {
    TABLES.attendances = badgeages(EMP.sans, ['28', '29', '30', '31'], '12')
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 40, date: '2026-01-01' })
    await semerRegle({ cle: 'alerte_hebdo_activee', valeur: 1, date: '2026-01-01' })
    //  Nouveau seuil au 1ᵉʳ JANVIER, en pleine semaine.
    await semerRegle({ cle: 'alerte_hebdo_heures', valeur: 45, date: '2027-01-01' })

    const res = await calculateEmployeeHours(EMP.sans, ENT, new Date('2027-01-02T12:00:00Z'))
    const semaine28 = (res.thisMonth.plafond_hebdo.semaines || []).find((s) => s.debut === '2026-12-28')

    if (semaine28) {
      expect(semaine28.seuil_applique).toBe(40)
      expect(semaine28.lundi_regle).toBe('2026-12-28')
    }
  })
})
