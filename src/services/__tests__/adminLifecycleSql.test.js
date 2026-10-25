import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db
let cSession
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  C = '33333333-3333-4333-8333-333333333333',
  D = '44444444-4444-4444-8444-444444444444',
  E = '55555555-5555-4555-8555-555555555555'
const migration = (name) =>
  readFileSync(`supabase/migrations/${name}.sql`, 'utf8')
async function actor(id) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: id,
      session_id: id === C ? cSession || C : id,
      aal: 'aal1',
    }),
  ])
  await db.exec('set role authenticated')
}
async function invite(email = 'new@example.test') {
  await actor(A)
  return (
    await db.query(
      'select * from encheck_invitation_prepare($1,$2,$3,$4,null)',
      [email, 'First', 'Last', E],
    )
  ).rows[0]
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 grant usage on schema auth to authenticated;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table enterprises(id uuid primary key,name text);
 create table admins(id uuid primary key default gen_random_uuid(),user_id uuid unique,email text,first_name text,last_name text,photo_url text,role text,is_active boolean,enterprise_id uuid,password_hash text not null default '!test!',alertes_email boolean default true);
 create table admin_entreprises(admin_id uuid,enterprise_id uuid,is_active boolean default true,unique(admin_id,enterprise_id));
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),not_after timestamptz,user_agent text,ip inet);
 create table auth.mfa_factors(user_id uuid,status text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 insert into enterprises values('${E}','Test enterprise');
 insert into admins(id,user_id,role,is_active,email,enterprise_id) values('${A}','${A}','super_admin',true,'super@example.test','${E}'),('${B}','${B}','admin',true,'member@example.test','${E}'),('${C}','${C}','admin',true,'support@example.test','${E}');
 insert into auth.users select user_id,email,now() from admins;
 insert into auth.users values('${D}','new@example.test',now());
 insert into auth.sessions(id,user_id) select id,id from auth.users;
 insert into admin_entreprises values('${B}','${E}',true);`)
  await db.exec(migration('20261024000001_admin_account_workspace'))
  await db.exec(migration('20261025000001_admin_security_workspace'))
  await db.exec(migration('20261025000002_admin_invitations_audit'))
  await db.exec(migration('20261025000003_admin_lifecycle'))
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('installs idempotently; clients cannot finalize delivery or write workflow tables', async () => {
  await db.exec(migration('20261025000002_admin_invitations_audit'))
  await db.exec(migration('20261025000003_admin_lifecycle'))
  expect(
    (
      await db.query(
        "select has_function_privilege('authenticated','encheck_invitation_delivery(uuid,uuid,boolean)','execute') as allowed",
      )
    ).rows[0].allowed,
  ).toBe(false)
  await actor(B)
  await expect(
    db.query('insert into admin_account_archives(admin_id) values($1)', [B]),
  ).rejects.toThrow('permission denied')
  await expect(
    db.query('select * from encheck_invitation_prepare($1,$2,$3,$4,null)', [
      'bad@example.test',
      'First',
      'Last',
      E,
    ]),
  ).rejects.toThrow()
})
it('binds acceptance to verified email and identity; rejects expiry and replay', async () => {
  const item = await invite()
  await db.exec('reset role')
  await db.query('select encheck_invitation_delivery($1,$2,true)', [item.id, D])
  await actor(C)
  await expect(db.query('select encheck_invitation_accept()')).rejects.toThrow()
  await db.exec('reset role')
  await db.query(
    "update admin_invitations set expires_at=now()-interval '1 second' where id=$1",
    [item.id],
  )
  await actor(D)
  await expect(db.query('select encheck_invitation_accept()')).rejects.toThrow()
  await db.exec('reset role')
  await db.query(
    "update admin_invitations set expires_at=now()+interval '1 day' where id=$1",
    [item.id],
  )
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [
    D,
  ])
  await actor(D)
  await expect(db.query('select encheck_invitation_accept()')).rejects.toThrow()
  await db.exec('reset role')
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [
    D,
  ])
  await actor(D)
  const id = (await db.query('select encheck_invitation_accept() as id'))
    .rows[0].id
  await expect(db.query('select encheck_invitation_accept()')).rejects.toThrow()
  await db.exec('reset role')
  expect(
    (await db.query('select role,is_active from admins where id=$1', [id]))
      .rows[0],
  ).toEqual({ role: 'admin', is_active: true })
  expect(
    (
      await db.query(
        'select enterprise_id from admin_entreprises where admin_id=$1',
        [id],
      )
    ).rows,
  ).toEqual([{ enterprise_id: E }])
})
it('cancellation wins against late delivery and renaming a pending invite is impossible', async () => {
  const item = await invite('cancel@example.test')
  await db.query('select encheck_invitation_cancel($1)', [item.id])
  await db.exec('reset role')
  await expect(
    db.query('select encheck_invitation_delivery($1,$2,true)', [item.id, D]),
  ).rejects.toThrow('État modifié')
})
it('denies self privilege changes and member administration', async () => {
  await actor(A)
  await expect(
    db.query('select encheck_account_access($1,$2,$3,$4)', [
      A,
      'admin',
      [E],
      'Test reason',
    ]),
  ).rejects.toThrow('propres privilèges')
  await actor(B)
  await expect(
    db.query('select encheck_account_access($1,$2,$3,$4)', [
      C,
      'super_admin',
      [],
      'Test reason',
    ]),
  ).rejects.toThrow()
  await actor(A)
  await db.query('select encheck_account_access($1,$2,$3,$4)', [
    C,
    'manager',
    [E],
    'Test reason',
  ])
})
it('grants only diagnostics, enforces expiry and revocation, and records consultation', async () => {
  await actor(C)
  await expect(
    db.query('select encheck_account_diagnostic($1)', [B]),
  ).rejects.toThrow('non autorisé')
  await actor(A)
  const id = (
    await db.query('select encheck_support_grant($1,$2,2,$3) as id', [
      B,
      C,
      'Support demandé',
    ])
  ).rows[0].id
  await actor(C)
  const result = (
    await db.query('select encheck_account_diagnostic($1) as d', [B])
  ).rows[0].d
  expect(result).toEqual({
    active: true,
    auth_linked: true,
    mfa_verified: false,
    archived: false,
    rest_guard_active: false,
  })
  await db.exec('reset role')
  await db.query(
    "update admin_support_delegations set expires_at=now()-interval '1 second' where id=$1",
    [id],
  )
  await actor(C)
  await expect(
    db.query('select encheck_account_diagnostic($1)', [B]),
  ).rejects.toThrow('non autorisé')
  await actor(A)
  await db.query('select encheck_support_grant($1,$2,2,$3)', [
    B,
    C,
    'Support demandé',
  ])
  await db.query('select encheck_support_revoke($1,$2)', [B, 'Support terminé'])
  await actor(C)
  await expect(
    db.query('select encheck_account_diagnostic($1)', [B]),
  ).rejects.toThrow('non autorisé')
})
it('archives atomically, transfers enterprise access, blocks legacy reactivation and restores inactive', async () => {
  await actor(A)
  await db.query('select encheck_account_archive($1,$2,$3)', [
    B,
    C,
    'Fin de mission',
  ])
  await db.exec('reset role')
  expect(
    (await db.query('select is_active from admins where id=$1', [B])).rows[0]
      .is_active,
  ).toBe(false)
  expect(
    (
      await db.query(
        'select is_active from admin_entreprises where admin_id=$1',
        [C],
      )
    ).rows[0].is_active,
  ).toBe(true)
  await expect(
    db.query('update admins set is_active=true where id=$1', [B]),
  ).rejects.toThrow('archivé')
  await actor(A)
  await db.query('select encheck_account_restore($1,$2)', [
    B,
    'Nouvelle mission',
  ])
  await db.exec('reset role')
  expect(
    (await db.query('select is_active from admins where id=$1', [B])).rows[0]
      .is_active,
  ).toBe(false)
  expect(
    (
      await db.query(
        "select count(*)::int as n from admin_account_events where target_id=$1 and action='account_archived'",
        [B],
      )
    ).rows[0].n,
  ).toBe(1)
})
it('syncs only verified Auth email and audits legacy changes without secrets', async () => {
  await db.exec('reset role')
  await db.query('update auth.users set email=$1 where id=$2', [
    'verified@example.test',
    C,
  ])
  await actor(C)
  expect(
    (await db.query('select encheck_account_sync_email() as email')).rows[0]
      .email,
  ).toBe('verified@example.test')
  await db.exec('reset role')
  await db.query('update admins set password_hash=$1 where id=$2', [
    'never-log-this',
    C,
  ])
  const events = (await db.query('select * from admin_account_events')).rows
  expect(events.some((e) => e.action === 'account_update')).toBe(true)
  expect(JSON.stringify(events)).not.toContain('never-log-this')
})

it('requires changing a temporary password at the server and retires legacy RPC access', async () => {
  await db.exec(
    "reset role;alter table auth.users add column encrypted_password text default 'test-original-hash';",
  )
  await db.exec(
    `create function public.encheck_admin_definir_mot_de_passe(p_admin_id uuid,p_mot_de_passe text) returns boolean language plpgsql security definer as $$begin update auth.users set encrypted_password='test-hash-'||p_mot_de_passe where id=(select user_id from public.admins where id=p_admin_id);return found;end$$;`,
  )
  await db.exec(migration('20261025000004_admin_temporary_password'))
  await db.exec(migration('20261025000004_admin_temporary_password'))
  await actor(A)
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      C,
      'Temporary-Test-123!',
      'Support demandé',
    ]),
  ).rejects.toThrow('contrôle REST/RPC')
  await db.exec("set pgrst.db_pre_request='public.encheck_admin_request_guard'")
  await db.query('select encheck_account_password($1,$2,$3)', [
    C,
    'Temporary-Test-123!',
    'Support demandé',
  ])
  await db.exec('reset role')
  cSession = '77777777-7777-4777-8777-777777777777'
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [
    cSession,
    C,
  ])
  await actor(C)
  expect(
    (await db.query('select encheck_account_password_status() as required'))
      .rows[0].required,
  ).toBe(true)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('obligatoire')
  await expect(
    db.query('select encheck_admin_definir_mot_de_passe($1,$2)', [
      C,
      'Bypass-Test-123!',
    ]),
  ).rejects.toThrow('permission denied')
  await db.exec("set request.path='/rpc/encheck_account_password_status'")
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).resolves.toBeTruthy()
  await db.exec("reset role;set request.path='';")
  await db.query('update auth.users set encrypted_password=$1 where id=$2', [
    'new-provider-salted-hash',
    C,
  ])
  await actor(C)
  expect(
    (await db.query('select encheck_account_password_status() as required'))
      .rows[0].required,
  ).toBe(false)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).resolves.toBeTruthy()
})

it('requires another superadmin at aal2 for MFA recovery and restricts finalization to the service', async () => {
  await db.exec('reset role')
  await db.exec(migration('20261025000005_admin_mfa_recovery'))
  await actor(A)
  await expect(
    db.query('select * from encheck_mfa_recovery_prepare($1,$2,$3)', [
      B,
      'member@example.test',
      'Identity checked',
    ]),
  ).rejects.toThrow('second facteur')
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: A, session_id: A, aal: 'aal2' }),
  ])
  await db.exec('set role authenticated')
  await expect(
    db.query('select * from encheck_mfa_recovery_prepare($1,$2,$3)', [
      A,
      'super@example.test',
      'Identity checked',
    ]),
  ).rejects.toThrow('autre superadministrateur')
  await expect(
    db.query('select * from encheck_mfa_recovery_prepare($1,$2,$3)', [
      B,
      'wrong@example.test',
      'Identity checked',
    ]),
  ).rejects.toThrow('invalide')
  const job = (
    await db.query('select * from encheck_mfa_recovery_prepare($1,$2,$3)', [
      B,
      'member@example.test',
      'Identity checked',
    ])
  ).rows[0]
  await expect(
    db.query('select encheck_mfa_recovery_finish($1,true)', [job.id]),
  ).rejects.toThrow('permission denied')
  await db.exec('reset role')
  await db.query('select encheck_mfa_recovery_finish($1,true)', [job.id])
  expect(
    (
      await db.query('select state from admin_mfa_recovery_jobs where id=$1', [
        job.id,
      ])
    ).rows[0].state,
  ).toBe('completed')
})
it('detects a new reported browser after baseline, scopes alerts and avoids duplicates', async () => {
  await db.exec('reset role')
  await db.exec(migration('20261025000006_admin_session_alerts'))
  await db.query(
    "update auth.sessions set user_agent='Browser One' where id=$1",
    [cSession],
  )
  await actor(C)
  await db.query('select encheck_account_session_seen()')
  expect(
    (await db.query('select * from encheck_account_session_alerts(null)')).rows,
  ).toHaveLength(0)
  const session = '66666666-6666-4666-8666-666666666666'
  await db.exec('reset role')
  await db.query(
    "insert into auth.sessions(id,user_id,user_agent) values($1,$2,'Browser Two')",
    [session, C],
  )
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: C, session_id: session, aal: 'aal1' }),
  ])
  await db.exec('set role authenticated')
  await db.query('select encheck_account_session_seen()')
  await db.query('select encheck_account_session_seen()')
  expect(
    (await db.query('select * from encheck_account_session_alerts(null)')).rows,
  ).toHaveLength(1)
  await actor(A)
  expect(
    (
      await db.query('select * from encheck_account_session_alerts($1)', [
        session,
      ])
    ).rows,
  ).toHaveLength(0)
  await actor(C)
  expect(
    (await db.query('select * from encheck_account_session_alerts(null)')).rows,
  ).toHaveLength(1)
  await db.query('select * from encheck_account_session_alerts($1)', [session])
  expect(
    (await db.query('select * from encheck_account_session_alerts(null)')).rows,
  ).toHaveLength(0)
  await db.exec('reset role')
  expect(
    (
      await db.query(
        "select count(*)::int n from admin_account_events where action='unfamiliar_browser'",
      )
    ).rows[0].n,
  ).toBe(1)
})
