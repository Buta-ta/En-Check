// src/services/__tests__/informationConsultationSql.test.js
// ═══════════════════════════════════════════════════════════════════════════
// 👁️ « J'AI LU » — exécuté dans un vrai Postgres (PGlite)
//
// Ce que ce fichier prouve, et que la relecture ne montrerait pas :
//   1. l'employé ne lit QUE ce qui lui est adressé — il n'y a pas de paramètre
//      à falsifier, le destinataire vient de la session ;
//   2. marquer consultée une information d'un autre est REFUSÉ par la base ;
//   3. la date de première lecture ne se déplace pas au second appel ;
//   4. une information inconnue est refusée, pas ignorée en silence ;
//   5. un compte sans fiche employé n'obtient rien du tout.
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
  'supabase/migrations/20261124000002_activation_alerte_versionnee.sql',
  //  Le fichier testé.
  'supabase/migrations/20261124000003_information_consultation.sql',
]

const ENTS = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
}
const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EMPLOYES = {
  a1: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  a2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  b1: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
}
//  Un compte sans fiche employé : le cas « invité » qui ne doit rien voir.
const SANS_FICHE = '99999999-9999-4999-8999-999999999999'
const COMPTES = {
  a1: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
  a2: 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2',
  b1: 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
}

let db

async function endosser(adminId = ADMIN, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('app.admin_id', $1, false)", [adminId])
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
  if (role) await db.exec(`set role ${role}`)
}

/** On endosse un COMPTE EMPLOYÉ : c'est `auth.uid()` qui parle. */
async function connecter(compte, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('app.admin_id', '', false)")
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [compte])
  if (role) await db.exec(`set role ${role}`)
}

/** Écrit une information directement : ici, on simule le passé. */
async function semerInformation({ entreprise = ENTS.a, employe, cle = 'alerte_hebdo_heures', texte = 'Une phrase figée.' }) {
  await db.exec('reset role')
  const { rows } = await db.query(
    `insert into public.encheck_informations_regle
       (entreprise_id, employe_id, cle, evenement, contenu, valeur_avant, valeur_apres,
        valeur_entreprise, date_effet)
     values ($1,$2,$3,'valeur_personnelle_posee',$4,38,40,42,'2026-10-01')
     returning id`,
    [entreprise, employe, cle, texte],
  )
  return rows[0].id
}

async function lire() {
  const { rows } = await db.query('select * from public.encheck_informations_employe()')
  return rows
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
    insert into public.admin_entreprises (admin_id, enterprise_id) values
      ('${ADMIN}', '${ENTS.a}');

    insert into public.employees (id, enterprise_id, user_id) values
      ('${EMPLOYES.a1}', '${ENTS.a}', '${COMPTES.a1}'),
      ('${EMPLOYES.a2}', '${ENTS.a}', '${COMPTES.a2}'),
      ('${EMPLOYES.b1}', '${ENTS.b}', '${COMPTES.b1}');
  `)
  for (const fichier of MIGRATIONS) await db.exec(readFileSync(fichier, 'utf8'))
}, 60000)

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec('reset role')
  await db.exec('delete from public.encheck_informations_regle')
  await db.query("select set_config('app.admin_id', '', false)")
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
})

describe('La lecture ne montre que ce qui est adressé à la personne', () => {
  it('un employé voit son information, et pas celle de son collègue', async () => {
    await semerInformation({ employe: EMPLOYES.a1, texte: 'Pour A1.' })
    await semerInformation({ employe: EMPLOYES.a2, texte: 'Pour A2.' })

    await connecter(COMPTES.a1)
    const lignes = await lire()

    expect(lignes).toHaveLength(1)
    expect(lignes[0].contenu).toBe('Pour A1.')
  })

  it('une autre entreprise ne remonte jamais, même sans filtre demandé', async () => {
    await semerInformation({ entreprise: ENTS.b, employe: EMPLOYES.b1, texte: 'Pour B1.' })

    await connecter(COMPTES.a1)
    expect(await lire()).toHaveLength(0)
  })

  it('les non-consultées passent devant — on lit d’abord ce qu’on n’a pas lu', async () => {
    const ancienne = await semerInformation({ employe: EMPLOYES.a1, texte: 'Déjà lue.' })
    await db.exec('reset role')
    await db.query(
      'update public.encheck_informations_regle set consulte_le = now() where id = $1',
      [ancienne],
    )
    await semerInformation({ employe: EMPLOYES.a1, texte: 'À lire.' })

    await connecter(COMPTES.a1)
    const lignes = await lire()
    expect(lignes[0].contenu).toBe('À lire.')
    expect(lignes[1].contenu).toBe('Déjà lue.')
  })

  it('un compte sans fiche employé n’obtient rien : la base refuse de deviner', async () => {
    await semerInformation({ employe: EMPLOYES.a1 })
    await connecter(SANS_FICHE)
    await expect(lire()).rejects.toThrow(/aucune fiche employe/)
  })

  it('sans session du tout, même refus', async () => {
    await db.exec('reset role')
    await db.exec('set role authenticated')
    await expect(lire()).rejects.toThrow(/aucune fiche employe/)
  })
})

describe('Marquer consultée — une fois, et jamais à la place d’un autre', () => {
  it('le destinataire marque, et la date est rendue', async () => {
    const id = await semerInformation({ employe: EMPLOYES.a1 })

    await connecter(COMPTES.a1)
    const { rows } = await db.query(
      'select public.encheck_information_consultee($1) as d',
      [id],
    )
    expect(rows[0].d).toBeTruthy()

    const lignes = await lire()
    expect(lignes[0].consulte_le).toBeTruthy()
  })

  it('un collègue ne peut pas marquer à sa place — refus de la base, pas de l’écran', async () => {
    const id = await semerInformation({ employe: EMPLOYES.a1 })

    await connecter(COMPTES.a2)
    await expect(
      db.query('select public.encheck_information_consultee($1) as d', [id]),
    ).rejects.toThrow(/ne vous est pas adressee/)
  })

  it('la première date ne se déplace pas au second appel', async () => {
    const id = await semerInformation({ employe: EMPLOYES.a1 })

    await connecter(COMPTES.a1)
    const premier = await db.query('select public.encheck_information_consultee($1) as d', [id])
    const second = await db.query('select public.encheck_information_consultee($1) as d', [id])

    const d1 = new Date(premier.rows[0].d).getTime()
    const d2 = new Date(second.rows[0].d).getTime()
    expect(d2).toBe(d1)
  })

  it('une information inconnue est refusée, pas ignorée', async () => {
    await connecter(COMPTES.a1)
    await expect(
      db.query('select public.encheck_information_consultee($1) as d', [
        '00000000-0000-4000-8000-000000000000',
      ]),
    ).rejects.toThrow(/information inconnue/)
  })

  it('marquer ne change NI le texte NI la valeur émise : le passé reste figé', async () => {
    const id = await semerInformation({ employe: EMPLOYES.a1, texte: 'Phrase figée du 1ᵉʳ octobre.' })

    await connecter(COMPTES.a1)
    await db.query('select public.encheck_information_consultee($1) as d', [id])

    const lignes = await lire()
    expect(lignes[0].contenu).toBe('Phrase figée du 1ᵉʳ octobre.')
    expect(Number(lignes[0].valeur_apres)).toBe(40)
    expect(Number(lignes[0].valeur_entreprise)).toBe(42)
  })

  it('l’employé ne peut pas fabriquer une information (le privilège n’existe pas)', async () => {
    await connecter(COMPTES.a1)
    await expect(
      db.query(
        `insert into public.encheck_informations_regle
           (entreprise_id, employe_id, cle, evenement, contenu, date_effet)
         values ($1,$2,'alerte_hebdo_heures','valeur_personnelle_posee','faux', current_date)`,
        [ENTS.a, EMPLOYES.a1],
      ),
    ).rejects.toThrow()
  })

  it('l’administrateur, lui, n’a pas de session employé : il ne peut pas marquer', async () => {
    const id = await semerInformation({ employe: EMPLOYES.a1 })

    await endosser()
    await expect(
      db.query('select public.encheck_information_consultee($1) as d', [id]),
    ).rejects.toThrow(/aucune fiche employe/)
  })
})
