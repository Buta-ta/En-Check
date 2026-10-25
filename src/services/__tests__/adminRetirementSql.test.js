import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db
const id = (n) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const A = id(1),
  B = id(2),
  C = id(3),
  D = id(4),
  E = id(5),
  F = id(6)
const migration = (name) =>
  readFileSync(`supabase/migrations/${name}.sql`, 'utf8')
async function actor(uid, aal = 'aal2') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: uid, session_id: uid, aal }),
  ])
  await db.exec('set role authenticated')
}
async function request(target) {
  await actor(A)
  return (
    await db.query('select encheck_retirement_request($1,$2) id', [
      target,
      'Fin de collaboration vérifiée',
    ])
  ).rows[0].id
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 grant usage on schema auth to authenticated;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text);
 create table enterprises(id uuid primary key,name text);
 create table admins(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,email text,username text,first_name text,last_name text,photo_url text,role text,is_active boolean,enterprise_id uuid,password_hash text not null default '!test!',alertes_email boolean default true,dashboard_preferences jsonb default '{}',failed_attempts int default 0,locked_until timestamptz,last_failed_at timestamptz,last_login_at timestamptz);
 grant select,update,delete on admins to authenticated;
 create table admin_entreprises(admin_id uuid,enterprise_id uuid,is_active boolean default true,unique(admin_id,enterprise_id));
 create table employees(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null);
 create table prospects(id uuid primary key default gen_random_uuid(),assigned_to uuid references admins(id),created_by uuid,updated_by uuid,updated_at timestamptz,status text);
 create table tasks(id uuid primary key default gen_random_uuid(),created_by_admin_id uuid references admins(id) on delete restrict,validated_by uuid references admins(id));
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now(),updated_at timestamptz default now(),not_after timestamptz,user_agent text,ip inet);
 create table auth.mfa_factors(user_id uuid,status text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`)
  for (const uid of [A, B, C, D, E, F]) {
    await db.query('insert into auth.users values($1,$2,now(),$3)', [
      uid,
      `${uid}@example.test`,
      'salted-test-hash',
    ])
    await db.query(
      'insert into admins(id,user_id,email,username,first_name,last_name,role,is_active) values($1,$1,$2,$3,$4,$5,$6,$7)',
      [
        uid,
        `${uid}@example.test`,
        uid,
        'Private',
        'Person',
        [A, C].includes(uid) ? 'super_admin' : 'admin',
        [A, C, F].includes(uid),
      ],
    )
    await db.query('insert into auth.sessions(id,user_id) values($1,$1)', [uid])
  }
  for (const name of [
    '20261024000001_admin_account_workspace',
    '20261025000001_admin_security_workspace',
    '20261025000002_admin_invitations_audit',
    '20261025000003_admin_lifecycle',
    '20261025000004_admin_temporary_password',
    '20261025000005_admin_mfa_recovery',
    '20261025000006_admin_session_alerts',
    '20261025000007_admin_retirement',
  ])
    await db.exec(migration(name))
  await db.exec("set pgrst.db_pre_request='public.encheck_admin_request_guard'")
  for (const uid of [B, D, E])
    await db.query(
      "insert into admin_account_archives values($1,$2,null,'Archive test',now()-interval '8 days')",
      [uid, A],
    )
  await db.query('insert into employees(user_id) values($1)', [D])
  await db.query(
    'insert into tasks(created_by_admin_id,validated_by) values($1,$1)',
    [B],
  )
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('installs twice and hides the stored Auth identity from browser roles', async () => {
  await db.exec(migration('20261025000007_admin_retirement'))
  await actor(A)
  await expect(
    db.query('select auth_user_id from admin_retirement_requests'),
  ).rejects.toThrow('permission denied')
  await expect(
    db.query('select encheck_retirement_finish($1)', [B]),
  ).rejects.toThrow('permission denied')
  await actor(F)
  await expect(
    db.query('select encheck_retirement_request($1,$2)', [B, 'Test reason']),
  ).rejects.toThrow()
})
it('requires AAL2, forbids self retirement and requires seven archived days', async () => {
  await actor(A, 'aal1')
  await expect(
    db.query('select encheck_retirement_request($1,$2)', [B, 'Test reason']),
  ).rejects.toThrow('second facteur')
  await actor(A)
  await expect(
    db.query('select encheck_retirement_request($1,$2)', [A, 'Test reason']),
  ).rejects.toThrow('Auto-suppression')
  await expect(
    db.query('select encheck_retirement_request($1,$2)', [F, 'Test reason']),
  ).rejects.toThrow('sept jours')
  await db.exec('reset role')
  await db.query(
    'update admin_account_archives set created_at=now() where admin_id=$1',
    [E],
  )
  await actor(A)
  await expect(
    db.query('select encheck_retirement_request($1,$2)', [E, 'Test reason']),
  ).rejects.toThrow('sept jours')
  await db.exec('reset role')
  await db.query(
    "update admin_account_archives set created_at=now()-interval '8 days' where admin_id=$1",
    [E],
  )
})
it('transfers open prospects without rewriting closed assignments or task history', async () => {
  await db.exec('reset role')
  await db.query(
    "insert into prospects(assigned_to,created_by,status) values($1,$2,'en_negociation'),($1,$2,'signe'),($1,$2,'perdu')",
    [F, B],
  )
  await actor(A)
  expect(
    (await db.query('select encheck_account_responsibilities($1) value', [F]))
      .rows[0].value.open_prospects,
  ).toBe(1)
  await expect(
    db.query('select encheck_account_transfer_responsibilities($1,$2,$3)', [
      F,
      F,
      'Test reason',
    ]),
  ).rejects.toThrow('distinct')
  expect(
    (
      await db.query(
        'select encheck_account_transfer_responsibilities($1,$2,$3) n',
        [F, C, 'Reprise commerciale'],
      )
    ).rows[0].n,
  ).toBe(1)
  await db.exec('reset role')
  expect(
    (
      await db.query(
        "select assigned_to,created_by from prospects where status='en_negociation'",
      )
    ).rows[0],
  ).toEqual({ assigned_to: C, created_by: B })
  expect(
    (await db.query("select assigned_to from prospects where status='signe'"))
      .rows[0].assigned_to,
  ).toBe(F)
  expect(
    (await db.query('select created_by_admin_id from tasks')).rows[0]
      .created_by_admin_id,
  ).toBe(B)
})
it('cancels pending requests without altering the profile', async () => {
  const job = await request(E)
  await db.query('select encheck_retirement_cancel($1)', [job])
  await actor(C)
  await expect(
    db.query('select encheck_retirement_execute($1)', [job]),
  ).rejects.toThrow('non exécutable')
})
it('seals only with a second approver, preserves history, and blocks resurrection', async () => {
  const job = await request(B)
  await expect(
    db.query('select encheck_retirement_execute($1)', [job]),
  ).rejects.toThrow('autre superadministrateur')
  await actor(C)
  const result = (
    await db.query('select encheck_retirement_execute($1) job', [job])
  ).rows[0].job
  expect(result.state).toBe('auth_pending')
  expect(result.auth_user_id).toBe(B)
  await expect(
    db.query('update admins set is_active=true where id=$1', [B]),
  ).rejects.toThrow('définitivement')
  await expect(db.query('delete from admins where id=$1', [B])).rejects.toThrow(
    'définitivement',
  )
  await db.exec('reset role')
  const profile = (
    await db.query(
      'select first_name,user_id,is_active,email from admins where id=$1',
      [B],
    )
  ).rows[0]
  expect(profile).toEqual({
    first_name: 'Compte supprimé',
    user_id: null,
    is_active: false,
    email: `deleted-${B}@invalid.invalid`,
  })
  expect(
    (await db.query('select created_by_admin_id,validated_by from tasks'))
      .rows[0],
  ).toEqual({ created_by_admin_id: B, validated_by: B })
  await expect(
    db.query('select encheck_retirement_finish($1)', [job]),
  ).rejects.toThrow('Auth non confirmée')
  await db.query("insert into storage.objects values($1,$2,'admin-avatars')", [
    B,
    `${B}/test.png`,
  ])
  await db.query('delete from auth.users where id=$1', [B])
  await expect(
    db.query('select encheck_retirement_finish($1)', [job]),
  ).rejects.toThrow('photos non confirmé')
  await db.query('delete from storage.objects where id=$1', [B])
  await db.query('select encheck_retirement_finish($1)', [job])
  await db.query('select encheck_retirement_finish($1)', [job])
  expect(
    (
      await db.query(
        'select state,auth_user_id from admin_retirement_requests where id=$1',
        [job],
      )
    ).rows[0],
  ).toEqual({ state: 'completed', auth_user_id: null })
})
it('preserves employee Auth and blocks an accidental deletion through another API', async () => {
  const job = await request(D)
  await actor(C)
  expect(
    (await db.query('select encheck_retirement_execute($1) job', [job])).rows[0]
      .job.state,
  ).toBe('shared_identity_preserved')
  await db.exec('reset role')
  await expect(
    db.query('delete from auth.users where id=$1', [D]),
  ).rejects.toThrow('Identité partagée')
  await db.query('select encheck_retirement_finish($1)', [job])
  expect(
    (await db.query('select user_id from employees')).rows[0].user_id,
  ).toBe(D)
})
it('detects references added after sealing, rather than trusting an old preflight', async () => {
  const job = await request(E)
  await actor(C)
  await db.query('select encheck_retirement_execute($1)', [job])
  await db.exec(
    'reset role;create table other_identity_links(user_id uuid references auth.users(id) on delete cascade)',
  )
  await db.query('insert into other_identity_links values($1)', [E])
  await expect(
    db.query('delete from auth.users where id=$1', [E]),
  ).rejects.toThrow('encore référencée')
  expect(
    (await db.query('select user_id from other_identity_links')).rows[0]
      .user_id,
  ).toBe(E)
  await expect(
    db.query(
      "insert into prospects(assigned_to,status) values($1,'en_negociation')",
      [E],
    ),
  ).rejects.toThrow('compte actif')
})
it('rejects a stale approval if the Auth identity changed after the request', async () => {
  await db.exec('reset role')
  const target = id(9),
    oldAuth = id(8),
    newAuth = id(7)
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    oldAuth,
    'old@example.test',
    newAuth,
    'new@example.test',
  ])
  await db.query(
    "insert into admins(id,user_id,role,is_active) values($1,$2,'admin',false)",
    [target, oldAuth],
  )
  await db.query(
    "insert into admin_account_archives values($1,$2,null,'Archive test',now()-interval '8 days')",
    [target, A],
  )
  const job = await request(target)
  await db.exec('reset role')
  await db.query('delete from admin_account_archives where admin_id=$1', [
    target,
  ])
  await db.query('update admins set user_id=$1 where id=$2', [newAuth, target])
  await db.query(
    "insert into admin_account_archives values($1,$2,null,'Rearchive test',now()-interval '8 days')",
    [target, A],
  )
  await actor(C)
  await expect(
    db.query('select encheck_retirement_execute($1)', [job]),
  ).rejects.toThrow('Identité Auth modifiée')
  await db.exec('reset role')
  // These identities are no longer needed by this scenario.
  await db.query('delete from admin_account_archives where admin_id=$1', [
    target,
  ])
  await db.query('update admins set user_id=null where id=$1', [target])
  await db.query('delete from auth.users where id in ($1,$2)', [
    oldAuth,
    newAuth,
  ])
})
it('hardens identity resolution and denies revoked sessions through RLS independently of REST hook', async () => {
  await db.exec(`reset role;
 create table business_rows(id int);insert into business_rows values(1);
 grant select on business_rows to authenticated;
 alter table business_rows enable row level security;
 create policy original_read on business_rows for select to authenticated using(true);
 create schema realtime;grant usage on schema realtime,storage to authenticated;
 create table realtime.messages(id int);insert into realtime.messages values(1);alter table realtime.messages enable row level security;grant select on realtime.messages to authenticated;
 create policy original_realtime_read on realtime.messages for select to authenticated using(true);
 grant select on storage.objects to authenticated;
 create policy original_storage_read on storage.objects for select to authenticated using(true);
 insert into storage.objects(id,name,bucket_id) values(gen_random_uuid(),'private/sample','private');
 do $$ declare t record; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t.tablename);end loop;end $$;`)
  await db.exec(migration('20261025000009_admin_identity_channels'))
  await db.exec(migration('20261025000009_admin_identity_channels'))
  await actor(A)
  expect(
    (await db.query('select current_admin_id() id,is_super_admin() super'))
      .rows[0],
  ).toEqual({ id: A, super: true })
  expect((await db.query('select * from business_rows')).rows).toHaveLength(1)
  // Old signed JWT with a revoked session must stay blocked after user_id was cleared.
  await actor(B)
  expect((await db.query('select * from business_rows')).rows).toHaveLength(0)
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
  expect((await db.query('select * from realtime.messages')).rows).toHaveLength(
    0,
  )
  // A non-admin employee identity remains governed by its existing policies.
  const employee = id(7)
  await db.exec('reset role')
  await db.query('insert into auth.users(id,email) values($1,$2)', [
    employee,
    'employee@example.test',
  ])
  await actor(employee)
  expect((await db.query('select * from business_rows')).rows).toHaveLength(1)
  // A matching email is not an Auth identity binding and must not mutate a row.
  await db.exec('reset role')
  await db.query(
    "insert into admins(id,email,role,is_active) values($1,$2,'super_admin',true)",
    [id(8), 'employee@example.test'],
  )
  await actor(employee)
  expect(
    (
      await db.query(
        'select encheck_admin_courant() id,encheck_est_super_admin() super',
      )
    ).rows[0],
  ).toEqual({ id: null, super: false })
  await db.exec('reset role')
  expect(
    (await db.query('select user_id from admins where id=$1', [id(8)])).rows[0]
      .user_id,
  ).toBe(null)
})
it('privatizes the Auth creation primitive while preserving SECURITY DEFINER owner calls', async () => {
  await db.exec(
    `reset role;create function public.encheck_auth_creer_compte(text,text,text,text,text,uuid) returns uuid language sql as $$select $6$$;`,
  )
  await db.exec(
    migration('20261025000008_admin_auth_internal_creation_private'),
  )
  await db.exec(
    migration('20261025000008_admin_auth_internal_creation_private'),
  )
  expect(
    (
      await db.query(
        "select has_function_privilege('anon','encheck_auth_creer_compte(text,text,text,text,text,uuid)','execute') a,has_function_privilege('authenticated','encheck_auth_creer_compte(text,text,text,text,text,uuid)','execute') b",
      )
    ).rows[0],
  ).toEqual({ a: false, b: false })
  await expect(
    db.query('select encheck_auth_creer_compte(null,null,null,null,null,$1)', [
      A,
    ]),
  ).resolves.toBeTruthy()
})
