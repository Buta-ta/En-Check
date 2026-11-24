// src/services/__tests__/activationAlerteSql.test.js
// ═══════════════════════════════════════════════════════════════════════════
// ⏰ L'ACTIVATION VERSIONNÉE — exécutée dans un vrai Postgres (PGlite)
//
// Ce que ce fichier prouve, et que la relecture ne montrerait pas :
//   1. `0` est accepté pour l'activation (désactivée) et refusé partout ailleurs ;
//   2. l'activation ne se personnalise pas et ne se verrouille pas ;
//   3. une activation est une VERSION : la précédente reste dans l'historique ;
//   4. « jamais décidée » n'est pas « désactivée » (active = null, pas false) ;
//   5. écrire une activation n'émet AUCUNE information — rien de personnel n'a
//      bougé, dire l'inverse serait faux.
//
// ⚠️ Valeurs FICTIVES. Aucune n'est une règle légale.
// ═══════════════════════════════════════════════════════════════════════════

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATIONS = [
  'supabase/migrations/20261123000002_encheck_regles_temps_travail.sql',
  'supabase/migrations/20261123000003_regles_retour_et_impact.sql',
  'supabase/migrations/20261124000001_informations_regle.sql',
  //  ⚠️ APRÈS 0001 : c'est ce qui prouve que la réécriture de
  //  `encheck_regle_ecrire` est un sur-ensemble, et non une régression.
  'supabase/migrations/20261124000002_activation_alerte_versionnee.sql',
  'supabase/migrations/20261124000003_information_consultation.sql',
]

const ENT = '11111111-1111-4111-8111-111111111111'
const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EMPLOYE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

let db

async function endosser(adminId = ADMIN, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('app.admin_id', $1, false)", [adminId])
  if (role) await db.exec(`set role ${role}`)
}

/** PGlite rend une `date` en objet Date : on compare sur YYYY-MM-DD. */
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

async function ecrireActivation(valeur, { employe = null, verrouille = false, date = '2026-11-01' } = {}) {
  await endosser()
  const { rows } = await db.query(
    'select public.encheck_regle_ecrire($1,$2,$3,$4,$5,$6) as id',
    [ENT, employe, 'alerte_hebdo_activee', valeur, date, verrouille],
  )
  return rows[0].id
}

async function lireActivation(date = '2026-11-15') {
  await endosser()
  const { rows } = await db.query('select * from public.encheck_activation_alerte($1,$2)', [ENT, date])
  return rows[0]
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create schema auth;
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    grant usage on schema auth to anon, authenticated, service_role;

    create table public.admins (id uuid primary key, role text not null);
    create table public.admin_entreprises (
      admin_id uuid, enterprise_id uuid, is_active boolean default true
    );
    create table public.employees (
      id uuid primary key, enterprise_id uuid not null, user_id uuid
    );

    create or replace function public.current_admin_id() returns uuid
      language sql stable as $$
        select nullif(current_setting('app.admin_id', true), '')::uuid
      $$;

    create or replace function public.encheck_est_super_admin() returns boolean
      language sql stable as $$
        select exists(select 1 from public.admins a
                      where a.id = public.current_admin_id() and a.role = 'super_admin')
      $$;

    create or replace function public.admin_has_access_to_enterprise(target uuid)
      returns boolean language sql stable as $$
        select exists(
          select 1 from public.admins a
          where a.id = public.current_admin_id()
            and (a.role = 'super_admin'
                 or exists (select 1 from public.admin_entreprises ae
                            where ae.admin_id = a.id and ae.enterprise_id = target
                              and ae.is_active is true)))
      $$;

    insert into public.admins (id, role) values ('${ADMIN}', 'admin');
    insert into public.admin_entreprises (admin_id, enterprise_id)
      values ('${ADMIN}', '${ENT}');
    insert into public.employees (id, enterprise_id) values ('${EMPLOYE}', '${ENT}');
  `)
  for (const fichier of MIGRATIONS) await db.exec(readFileSync(fichier, 'utf8'))
}, 60000)

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec('reset role')
  await db.exec('delete from public.encheck_informations_regle')
  await db.exec('delete from public.encheck_regles_temps_travail')
})

describe('La contrainte accepte 0 pour l’activation, et seulement pour elle', () => {
  it('0 est une valeur légitime : « désactivée » est un acte, pas une absence', async () => {
    await expect(ecrireActivation(0)).resolves.toBeTruthy()
  })

  it('1 aussi', async () => {
    await expect(ecrireActivation(1)).resolves.toBeTruthy()
  })

  it('2 est refusé — une activation n’est pas un nombre d’heures', async () => {
    await expect(ecrireActivation(2)).rejects.toThrow(/vaut 0 ou 1/)
  })

  it('null est refusé : « aucune décision » n’est pas une valeur', async () => {
    await expect(ecrireActivation(null)).rejects.toThrow(/vaut 0 ou 1/)
  })

  it('0 reste refusé pour un seuil : le plancher général n’a pas bougé', async () => {
    await endosser()
    await expect(
      db.query('select public.encheck_regle_ecrire($1,$2,$3,$4,$5,$6)', [
        ENT, null, 'alerte_hebdo_heures', 0, '2026-11-01', false,
      ]),
    ).rejects.toThrow(/valeur nulle ou negative/)
  })
})

describe('Une activation ne se personnalise pas', () => {
  it('refusée pour un employé : une alerte est un contrôle d’entreprise', async () => {
    await expect(ecrireActivation(1, { employe: EMPLOYE })).rejects.toThrow(/ne se personnalise pas/)
  })

  it('refusée avec un verrou : le verrou ne s’applique qu’à une valeur personnelle', async () => {
    await expect(ecrireActivation(1, { verrouille: true })).rejects.toThrow(/verrou/)
  })
})

describe('Lire l’état d’activation', () => {
  it('sans aucune décision : active vaut null, jamais false', async () => {
    const a = await lireActivation()
    expect(a.etat).toBe('jamais_decidee')
    expect(a.active).toBeNull()
  })

  it('après une décision : l’état est nommé, avec sa date et son auteur', async () => {
    await ecrireActivation(1, { date: '2026-11-03' })
    const a = await lireActivation()
    expect(a.etat).toBe('activee')
    expect(a.active).toBe(true)
    expect(iso(a.depuis)).toBe('2026-11-03')
    expect(a.maj_par).toBe(ADMIN)
  })

  it('désactivée se lit « desactivee » — et non « jamais décidée »', async () => {
    await ecrireActivation(0, { date: '2026-11-03' })
    const a = await lireActivation()
    expect(a.etat).toBe('desactivee')
    expect(a.active).toBe(false)
  })

  it('la date d’effet est respectée : hier ne voit pas encore la décision de demain', async () => {
    await ecrireActivation(1, { date: '2026-12-01' })
    expect((await lireActivation('2026-11-30')).etat).toBe('jamais_decidee')
    expect((await lireActivation('2026-12-01')).etat).toBe('activee')
  })

  it('la dernière décision gagne, et la précédente reste dans l’historique', async () => {
    await ecrireActivation(1, { date: '2026-11-01' })
    await ecrireActivation(0, { date: '2026-11-10' })

    expect((await lireActivation('2026-11-05')).etat).toBe('activee')
    expect((await lireActivation('2026-11-15')).etat).toBe('desactivee')

    await db.exec('reset role')
    const { rows } = await db.query(
      `select count(*)::int as n from public.encheck_regles_temps_travail
       where entreprise_id = $1 and cle = 'alerte_hebdo_activee'`,
      [ENT],
    )
    expect(rows[0].n).toBe(2)
  })
})

describe('Le devoir d’informer n’est pas emporté par la réécriture', () => {
  it('écrire une activation n’émet AUCUNE information : rien de personnel n’a bougé', async () => {
    await ecrireActivation(1)
    await db.exec('reset role')
    const { rows } = await db.query('select count(*)::int as n from public.encheck_informations_regle')
    expect(rows[0].n).toBe(0)
  })

  it('une valeur personnelle, elle, émet toujours son information (non-régression)', async () => {
    await endosser()
    await db.query('select public.encheck_regle_ecrire($1,$2,$3,$4,$5,$6)', [
      ENT, EMPLOYE, 'alerte_hebdo_heures', 38, '2026-11-01', false,
    ])
    await db.exec('reset role')
    const { rows } = await db.query(
      'select evenement, contenu from public.encheck_informations_regle where employe_id = $1',
      [EMPLOYE],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].evenement).toBe('valeur_personnelle_posee')
    expect(rows[0].contenu).toMatch(/38/)
  })
})
