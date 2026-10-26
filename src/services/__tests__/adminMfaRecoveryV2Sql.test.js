import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest'
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

const C = '33333333-3333-4333-8333-333333333333'
beforeAll(async () => {
  await db.exec(`alter table admins add email text;alter table auth.users add email text;
 update admins set email='fixture@example.test';update auth.users set email='fixture@example.test';
 insert into auth.mfa_factors values('${A}','verified'),('${B}','verified');`)
  const recovery = readFileSync(
    'supabase/migrations/20261026000020_admin_mfa_recovery_v2.sql',
    'utf8',
  )
  await db.exec(recovery)
  await db.exec(recovery)
})
beforeEach(async () => {
  await db.exec('reset role;begin')
})
afterEach(async () => {
  await db.exec('rollback')
})
async function enable() {
  await db.exec('reset role;update admin_mfa_policy_config set enabled=true')
  await actor(A, 'aal2')
}
async function prepare() {
  return (
    await db.query('select encheck_mfa_recovery_prepare_v2($1,$2,$3) j', [
      B,
      'fixture@example.test',
      'Identity checked by callback',
    ])
  ).rows[0].j.id
}
async function service() {
  await db.exec('reset role;set role service_role')
}
it('requires activation, AAL2, distinct account and matching identity', async () => {
  await actor(A, 'aal2')
  await expect(prepare()).rejects.toThrow('Activation')
})
it('refuses self-recovery', async () => {
  await enable()
  await expect(
    db.query('select encheck_mfa_recovery_prepare_v2($1,$2,$3)', [
      A,
      'fixture@example.test',
      'Identity verified',
    ]),
  ).rejects.toThrow('Autre superadmin')
})
it('refuses a wrong email', async () => {
  await enable()
  await expect(
    db.query('select encheck_mfa_recovery_prepare_v2($1,$2,$3)', [
      B,
      'other@example.test',
      'Identity verified',
    ]),
  ).rejects.toThrow('Identité')
})
it('requires AAL2', async () => {
  await enable()
  await actor(A)
  await expect(prepare()).rejects.toThrow()
})
it('persists obligation and revocations before deletion and blocks duplicate preparation', async () => {
  await enable()
  await prepare()
  await db.exec('reset role')
  expect(
    (
      await db.query(
        'select count(*)::int n from admin_mfa_requirements where admin_id=$1',
        [B],
      )
    ).rows[0].n,
  ).toBe(1)
  expect(
    (
      await db.query(
        'select count(*)::int n from admin_session_revocations where user_id=$1',
        [B],
      )
    ).rows[0].n,
  ).toBe(1)
  await actor(B, 'aal2')
  expect((await db.query('select * from storage.objects')).rows).toEqual([])
  await actor(A, 'aal2')
  await expect(prepare()).rejects.toThrow('en cours')
})
it('claim is server-only and single-use; a residual factor prevents success', async () => {
  await enable()
  const id = await prepare()
  await service()
  expect(
    (await db.query('select encheck_mfa_recovery_claim_v2($1) j', [id])).rows[0]
      .j.user_id,
  ).toBe(B)
  expect(
    (await db.query('select encheck_mfa_recovery_finish_v2($1,true) j', [id]))
      .rows[0].j.completed,
  ).toBe(false)
  expect(
    (await db.query('select encheck_mfa_recovery_finish_v2($1,true) j', [id]))
      .rows[0].j.completed,
  ).toBe(false)
  await expect(
    db.query('select encheck_mfa_recovery_claim_v2($1)', [id]),
  ).rejects.toThrow('non réutilisable')
})
it('client cannot claim a recovery', async () => {
  await enable()
  const id = await prepare()
  await expect(
    db.query('select encheck_mfa_recovery_claim_v2($1)', [id]),
  ).rejects.toThrow('permission denied')
})
it('successful removal never clears obligation and needs a new session plus factor', async () => {
  await enable()
  const id = await prepare()
  await service()
  await db.query('select encheck_mfa_recovery_claim_v2($1)', [id])
  await db.exec(
    `reset role;delete from auth.mfa_factors where user_id='${B}';insert into auth.sessions values('${C}','${B}',null)`,
  )
  await service()
  expect(
    (await db.query('select encheck_mfa_recovery_finish_v2($1,true) j', [id]))
      .rows[0].j.completed,
  ).toBe(true)
  await db.exec('reset role')
  expect(
    (
      await db.query(
        'select count(*)::int n from admin_session_revocations where user_id=$1',
        [B],
      )
    ).rows[0].n,
  ).toBe(2)
  await db.exec(
    `delete from auth.sessions where id='${C}';insert into auth.sessions values('44444444-4444-4444-8444-444444444444','${B}',null)`,
  )
  await actor(B, 'aal1', '/rpc/encheck_mfa_obligation_statut')
  await db.exec(
    `reset role;set request.jwt.claims='{"sub":"${B}","session_id":"44444444-4444-4444-8444-444444444444","aal":"aal1"}';set role authenticated`,
  )
  expect(
    (await db.query('select encheck_mfa_obligation_statut() s')).rows[0].s,
  ).toEqual({ required: true, satisfied: false, rest_guard_active: true })
  await db.exec(
    `reset role;insert into auth.mfa_factors values('${B}','verified');set request.jwt.claims='{"sub":"${B}","session_id":"44444444-4444-4444-8444-444444444444","aal":"aal2"}';set role authenticated`,
  )
  expect(
    (await db.query('select encheck_mfa_obligation_statut() s')).rows[0].s
      .satisfied,
  ).toBe(true)
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
  await actor(B, 'aal2')
  expect((await db.query('select * from storage.objects')).rows).toEqual([])
})

it('does not claim an expired request', async () => {
  await enable()
  const id = await prepare()
  await db.exec(
    "reset role;update admin_mfa_recoveries_v2 set created_at=now()-interval '3 minutes'",
  )
  await service()
  await expect(
    db.query('select encheck_mfa_recovery_claim_v2($1)', [id]),
  ).rejects.toThrow('expirée')
})
it('migration refuses unfinished historical jobs', async () => {
  await db.exec(
    "create table admin_mfa_recovery_jobs(state text);insert into admin_mfa_recovery_jobs values('requested')",
  )
  await expect(
    db.exec(
      readFileSync(
        'supabase/migrations/20261026000020_admin_mfa_recovery_v2.sql',
        'utf8',
      ),
    ),
  ).rejects.toThrow('historiques')
})
it('closes the legacy preparation RPC instead of leaving an obligation bypass', async () => {
  await db.exec(
    'create function encheck_mfa_recovery_prepare(uuid,text,text) returns void language sql as $$select$$;grant execute on function encheck_mfa_recovery_prepare(uuid,text,text) to authenticated',
  )
  // Strip transaction delimiters to keep this replay inside the isolated test transaction.
  const migration = readFileSync(
    'supabase/migrations/20261026000020_admin_mfa_recovery_v2.sql',
    'utf8',
  )
    .replace(/^BEGIN;$/m, '')
    .replace(/^COMMIT;$/m, '')
  await db.exec(migration)
  expect(
    (
      await db.query(
        "select has_function_privilege('authenticated','encheck_mfa_recovery_prepare(uuid,text,text)','execute') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false)
})

it('refuses provider execution when the initiating session was revoked after preparation',async()=>{
 await enable();const id=await prepare()
 await db.exec(`reset role;insert into admin_session_revocations(session_id,user_id,actor_id,reason) values('${A}','${A}','${A}','Session revoked')`)
 await service();await expect(db.query('select encheck_mfa_recovery_claim_v2($1)',[id])).rejects.toThrow('Intervenant indisponible')
})
