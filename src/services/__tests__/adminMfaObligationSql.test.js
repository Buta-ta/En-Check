import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222'
const sql = readFileSync(
  'supabase/migrations/20261026000019_admin_mfa_obligation.sql',
  'utf8',
)
async function actor(id, aal = 'aal1', path = '/rpc/encheck_mfa_exiger') {
  await db.exec('reset role')
  await db.query(
    "select set_config('request.jwt.claims',$1,false),set_config('request.path',$2,false)",
    [JSON.stringify({ sub: id, session_id: id, aal }), path],
  )
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 grant usage on schema auth,storage to authenticated;
 create function auth.jwt() returns jsonb language sql as $$select current_setting('request.jwt.claims')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table admins(id uuid primary key,user_id uuid,is_active boolean,role text);
 create table auth.users(id uuid);create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text);
 insert into admins values('${A}','${A}',true,'super_admin'),('${B}','${B}',true,'admin');
 insert into auth.users values('${A}'),('${B}');insert into auth.sessions values('${A}','${A}',null),('${B}','${B}',null);
 create table storage.objects(name text);alter table storage.objects enable row level security;
 create policy legacy on storage.objects for all to authenticated using(true) with check(true);grant all on storage.objects to authenticated;
 insert into storage.objects values('private-photo');set pgrst.db_pre_request='public.encheck_admin_request_guard';`)
  await db.exec(
    readFileSync(
      'supabase/migrations/20261026000018_admin_mfa_core.sql',
      'utf8',
    ),
  )
  await db.exec(sql)
  await db.exec(sql)
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('is disabled before coordinated activation and requires a superadmin AAL2', async () => {
  await actor(A, 'aal2')
  await expect(
    db.query('select encheck_mfa_exiger($1,$2)', [B, 'Security policy']),
  ).rejects.toThrow('activation')
  await db.exec('reset role;update admin_mfa_policy_config set enabled=true')
  await actor(A)
  await expect(
    db.query('select encheck_mfa_exiger($1,$2)', [B, 'Security policy']),
  ).rejects.toThrow('MFA requise')
  await actor(B, 'aal2')
  await expect(
    db.query('select encheck_mfa_exiger($1,$2)', [A, 'Security policy']),
  ).rejects.toThrow('Autre compte')
  await actor(A, 'aal2')
  await expect(
    db.query('select encheck_mfa_exiger($1,$2)', [A, 'Security policy']),
  ).rejects.toThrow('Autre compte')
})
it('records an idempotent requirement and denies business access even without factors', async () => {
  await actor(A, 'aal2')
  await db.query('select encheck_mfa_exiger($1,$2)', [B, 'Security policy'])
  await db.query('select encheck_mfa_exiger($1,$2)', [B, 'New reason'])
  await db.exec('reset role')
  expect(
    (await db.query('select count(*)::int n from admin_mfa_requirements'))
      .rows[0].n,
  ).toBe(1)
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('MFA_ENROLLMENT_REQUIRED')
  expect((await db.query('select * from storage.objects')).rows).toEqual([])
  await expect(
    db.query("insert into storage.objects values('forged')"),
  ).rejects.toThrow('row-level security')
  await expect(db.query('delete from admin_mfa_requirements')).rejects.toThrow(
    'permission denied',
  )
})
it('allows only own bootstrap status without MFA, not arbitrary profile access', async () => {
  await actor(B, 'aal1', '/rpc/encheck_mfa_obligation_statut')
  await db.query('select encheck_admin_request_guard()')
  expect(
    (await db.query('select encheck_mfa_obligation_statut() s')).rows[0].s,
  ).toEqual({ required: true, satisfied: false, rest_guard_active: true })
  await actor(B, 'aal1', '/rpc/encheck_account_security_status')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('MFA_ENROLLMENT_REQUIRED')
})
it('only superadmin AAL2 can inspect another account requirement', async () => {
  await actor(A, 'aal2')
  expect((await db.query('select encheck_mfa_exigence_lire($1) s', [B])).rows[0].s).toEqual({required:true,configured:false})
  await actor(A)
  await expect(db.query('select encheck_mfa_exigence_lire($1)', [B])).rejects.toThrow('Superadmin MFA')
})
it('requires both a verified factor and AAL2; removing the last factor keeps the obligation', async () => {
  await actor(B, 'aal2')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('MFA_ENROLLMENT_REQUIRED')
  await db.exec(
    `reset role;insert into auth.mfa_factors values('${B}','verified')`,
  )
  await actor(B)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('MFA_ENROLLMENT_REQUIRED')
  await actor(B, 'aal2')
  await db.query('select encheck_admin_request_guard()')
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
  await db.exec('reset role;delete from auth.mfa_factors')
  await actor(B, 'aal2')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('MFA_ENROLLMENT_REQUIRED')
})
it('never bootstraps a revoked session and leaves other valid admins unchanged', async () => {
  await db.exec(
    `reset role;insert into admin_session_revocations(session_id,user_id,actor_id,reason) values('${B}','${B}','${A}','Fixture')`,
  )
  await actor(B, 'aal1', '/rpc/encheck_mfa_obligation_statut')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('Session refusée')
  await actor(A)
  await db.query('select encheck_admin_request_guard()')
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
})
