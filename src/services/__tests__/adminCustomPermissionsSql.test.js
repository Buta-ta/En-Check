import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db, role
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  E = '33333333-3333-4333-8333-333333333333',
  F = '44444444-4444-4444-8444-444444444444',
  X = '55555555-5555-4555-8555-555555555555',
  Y = '66666666-6666-4666-8666-666666666666'
const migration = (n) => readFileSync(`supabase/migrations/${n}.sql`, 'utf8')
async function actor(uid, path = '/employees') {
  await db.exec('reset role')
  await db.query(
    "select set_config('request.jwt.claims',$1,false),set_config('request.path',$2,false)",
    [JSON.stringify({ sub: uid, session_id: uid, aal: 'aal2' }), path],
  )
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 grant usage on schema auth,storage to authenticated;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table auth.users(id uuid primary key,encrypted_password text);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),updated_at timestamptz,not_after timestamptz,user_agent text,ip inet);
 create table auth.mfa_factors(user_id uuid,status text);
 create table admins(id uuid primary key,user_id uuid,email text,role text,is_active boolean,enterprise_id uuid,alertes_email boolean default true);
 create table enterprises(id uuid primary key,name text);
 create table employees(id uuid primary key,user_id uuid,enterprise_id uuid,name text);
 create table attendances(id uuid primary key,enterprise_id uuid,employee_id uuid,notes text,modifie_par uuid);
 create table teams(id uuid primary key,enterprise_id uuid);
 create table tasks(id uuid primary key,enterprise_id uuid,assigned_employee_id uuid,team_id uuid,created_by_admin_id uuid,validated_by uuid,title text);
 create table admin_entreprises(admin_id uuid,enterprise_id uuid,is_active boolean);
 create table admin_account_events(id bigint generated always as identity,actor_id uuid,target_id uuid,action text,reason text default '',created_at timestamptz default now());
 create table prospects(id uuid,assigned_to uuid,status text);
 create table storage.objects(id uuid,name text,bucket_id text);
 create table business_secrets(id int,secret text);
 insert into business_secrets values(1,'must remain hidden');
 insert into admins(id,user_id,role,is_active) values('${A}','${A}','super_admin',true),('${B}','${B}','admin',true);
 insert into auth.users values('${A}','a'),('${B}','b');insert into auth.sessions(id,user_id) values('${A}','${A}'),('${B}','${B}');
 insert into enterprises values('${E}','Allowed'),('${F}','Other');
 insert into employees values('${X}',null,'${E}','Allowed employee'),('${Y}',null,'${F}','Other employee');
 insert into attendances values('${X}','${E}','${X}','Allowed',null),('${Y}','${F}','${Y}','Other',null);
 insert into tasks values('${X}','${E}','${X}',null,'${A}',null,'Historical task');
 insert into storage.objects values('${X}','private','private');
 alter table storage.objects enable row level security;
 grant select on storage.objects to authenticated;create policy original_storage on storage.objects for select to authenticated using(true);`)
  for (const n of [
    '20261025000001_admin_security_workspace',
    '20261025000003_admin_lifecycle',
    '20261025000004_admin_temporary_password',
    '20261025000007_admin_retirement',
  ])
    await db.exec(migration(n))
  await db.exec(
    `do $$ declare t record; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t.tablename);end loop;end $$;`,
  )
  await db.exec(migration('20261025000009_admin_identity_channels'))
  for (const t of [
    'admins',
    'enterprises',
    'employees',
    'attendances',
    'teams',
    'tasks',
    'business_secrets',
  ])
    await db.exec(
      `grant select,insert,update,delete on ${t} to authenticated;create policy legacy_access on ${t} for all to authenticated using(true) with check(true);`,
    )
  await db.exec("set pgrst.db_pre_request='public.encheck_admin_request_guard'")
  await db.exec(migration('20261025000010_admin_custom_permissions'))
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('installs twice, defaults to disabled and protects private permission storage', async () => {
  await db.exec(migration('20261025000010_admin_custom_permissions'))
  await actor(A)
  const list = (await db.query('select encheck_permission_roles_list() data'))
    .rows[0].data
  expect(list.enabled).toBe(false)
  expect(list.blockers).toEqual([])
  await actor(B)
  await expect(
    db.query('select * from admin_permission_bindings'),
  ).rejects.toThrow('permission denied')
  await expect(
    db.query('select encheck_permission_role_create($1,$2,$3)', [
      'Fake',
      '[]',
      'Test reason',
    ]),
  ).rejects.toThrow()
})
it('validates scopes and refuses assignment before explicit activation', async () => {
  await actor(A)
  await expect(
    db.query('select encheck_permission_role_create($1,$2,$3)', [
      'Invalid',
      JSON.stringify([{ enterprise_id: E, module: 'root', actions: ['read'] }]),
      'Test reason',
    ]),
  ).rejects.toThrow('Module')
  const grants = [
    { enterprise_id: E, module: 'employees', actions: ['read'] },
    {
      enterprise_id: E,
      module: 'attendance',
      actions: ['read', 'create', 'update'],
    },
    { enterprise_id: E, module: 'tasks', actions: ['read', 'update'] },
  ]
  role = (
    await db.query('select encheck_permission_role_create($1,$2,$3) id', [
      'RH limitée',
      JSON.stringify(grants),
      'Version test',
    ])
  ).rows[0].id
  await expect(
    db.query('select encheck_permission_role_assign($1,$2,$3)', [
      B,
      role,
      'Assignment test',
    ]),
  ).rejects.toThrow('Activation')
  await db.exec('reset role;update admin_permission_settings set enabled=true')
  await actor(A)
  await expect(
    db.query('select encheck_permission_role_assign($1,$2,$3)', [
      A,
      role,
      'Self privilege',
    ]),
  ).rejects.toThrow('Auto-attribution')
  await db.query('select encheck_permission_role_assign($1,$2,$3)', [
    B,
    role,
    'Assignment test',
  ])
})
it('enforces module/action/enterprise through RLS, even with legacy permissive policies', async () => {
  await actor(B)
  expect((await db.query('select name from employees')).rows).toEqual([
    { name: 'Allowed employee' },
  ])
  expect((await db.query('select id from admins')).rows).toEqual([{ id: B }])
  expect((await db.query('select * from business_secrets')).rows).toHaveLength(
    0,
  )
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
  expect(
    (await db.query("update employees set name='Forbidden' returning id")).rows,
  ).toHaveLength(0)
  await db.query("update attendances set notes='Changed' where id=$1", [X])
  expect(
    (
      await db.query('select notes,modifie_par from attendances where id=$1', [
        X,
      ])
    ).rows[0],
  ).toEqual({ notes: 'Changed', modifie_par: B })
  expect(
    (await db.query('delete from attendances returning id')).rows,
  ).toHaveLength(0)
  await expect(
    db.query('update attendances set enterprise_id=$1 where id=$2', [F, X]),
  ).rejects.toThrow('row-level security')
  await expect(
    db.query(
      'insert into attendances(id,enterprise_id,employee_id) values(gen_random_uuid(),$1,$2)',
      [E, Y],
    ),
  ).rejects.toThrow('row-level security')
})
it('does not allow author spoofing or privilege changes through direct writes', async () => {
  await actor(B)
  await expect(
    db.query('update tasks set created_by_admin_id=$1 where id=$2', [B, X]),
  ).rejects.toThrow('Auteur historique')
  await expect(
    db.query('update tasks set validated_by=$1 where id=$2', [A, X]),
  ).rejects.toThrow('Auteur de validation')
  expect(
    (
      await db.query(
        "update admins set role='super_admin' where id=$1 returning id",
        [B],
      )
    ).rows,
  ).toHaveLength(0)
  await actor(A)
  await expect(
    db.query("update admins set role='super_admin' where id=$1", [B]),
  ).rejects.toThrow('Retirez le rôle personnalisé')
})
it('denies unreviewed RPCs and flags legacy Edge as restricted', async () => {
  await actor(B, '/rpc/legacy_privileged_operation')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('RPC')
  await actor(B, '/rpc/encheck_account_security_status')
  expect(
    (await db.query('select encheck_account_security_status() data')).rows[0]
      .data.custom_role_restricted,
  ).toBe(true)
  await actor(B, '/rpc/encheck_my_permissions')
  expect(
    (await db.query('select encheck_my_permissions() data')).rows[0].data.name,
  ).toBe('RH limitée')
})
it('closes anonymous access to the employee view and enforces caller RLS', async () => {
  await db.exec(
    'reset role;create view employees_public as select * from employees;grant select on employees_public to anon,authenticated;set role anon;',
  )
  expect(
    (await db.query('select count(*)::int n from employees_public')).rows[0].n,
  ).toBe(2)
  await db.exec('reset role')
  await db.exec(migration('20261025000011_employees_public_invoker'))
  await db.exec(migration('20261025000011_employees_public_invoker'))
  await db.exec('set role anon')
  await expect(db.query('select * from employees_public')).rejects.toThrow(
    'permission denied',
  )
  await actor(B)
  expect((await db.query('select id from employees_public')).rows).toEqual([
    { id: X },
  ])
})
it('fails closed for ambiguous identities and an unreviewed anonymous definer', async () => {
  await db.exec('reset role')
  await db.query(
    "insert into admins(id,user_id,role,is_active) values($1,$2,'admin',false)",
    [F, B],
  )
  await actor(B)
  await expect(db.query('select * from employees')).rejects.toThrow('ambiguë')
  await db.exec('reset role')
  await db.query('delete from admins where id=$1', [F])
  await db.exec(
    'create function anonymous_unreviewed() returns int language sql security definer as $$select 1$$;',
  )
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('audit serveur')
  await db.exec(
    'reset role;revoke all on function anonymous_unreviewed() from public,anon;',
  )
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).resolves.toBeTruthy()
})
it('fails closed on schema drift, unsafe views, computed relationships and changed RPC bodies', async () => {
  await db.exec(
    'reset role;create view unsafe_view as select * from business_secrets;grant select(secret) on unsafe_view to authenticated;',
  )
  await actor(B, '/rpc/encheck_my_permissions')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('audit serveur')
  await db.exec(
    'reset role;revoke select(secret) on unsafe_view from authenticated;grant select(secret) on unsafe_view to anon;',
  )
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('audit serveur')
  await db.exec(
    'reset role;drop view unsafe_view;create function computed_secret(employees) returns text language sql security definer as $$select secret from business_secrets limit 1$$;',
  )
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('audit serveur')
  await db.exec(
    'reset role;drop function computed_secret(employees);create table unguarded_new_table(id int);alter table unguarded_new_table enable row level security;',
  )
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('audit serveur')
  await db.exec(
    "reset role;drop table unguarded_new_table;create or replace function encheck_my_permissions() returns jsonb language sql as $$select jsonb_build_object('unexpected',true)$$;",
  )
  await actor(B, '/rpc/encheck_my_permissions')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('RPC')
})
it('keeps restrictions when assignment is disabled; removal is explicit and audited', async () => {
  await db.exec('reset role;update admin_permission_settings set enabled=false')
  await actor(B)
  expect((await db.query('select name from employees')).rows).toHaveLength(1)
  await actor(A)
  await db.query('select encheck_permission_role_assign($1,null,$2)', [
    B,
    'Restore legacy rights explicitly',
  ])
  await actor(B)
  expect((await db.query('select name from employees')).rows).toHaveLength(2)
  await db.exec('reset role')
  expect(
    (
      await db.query(
        "select action from admin_account_events where action='permission_role_removed'",
      )
    ).rows,
  ).toHaveLength(1)
})
