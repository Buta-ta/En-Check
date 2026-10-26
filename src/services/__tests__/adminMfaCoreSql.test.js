import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db
const U = '11111111-1111-4111-8111-111111111111',
  S = '22222222-2222-4222-8222-222222222222'
const sql = readFileSync(
  'supabase/migrations/20261026000018_admin_mfa_core.sql',
  'utf8',
)
async function claims(value, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(value),
  ])
  await db.exec(`set role ${role}`)
}
const jwt = { sub: U, session_id: S, aal: 'aal1' }
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;create schema auth;
 grant usage on schema auth to anon,authenticated,service_role;
 create function auth.jwt() returns jsonb language sql as $$select current_setting('request.jwt.claims')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table auth.users(id uuid);insert into auth.users values('${U}');
 create table admins(user_id uuid,is_active boolean);
 create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);
 create table auth.mfa_factors(user_id uuid,status text);
 insert into admins values('${U}',true);insert into auth.sessions values('${S}','${U}',null);`)
  await db.exec(sql)
  await db.exec(sql)
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('allows bootstrap without a verified factor; readiness is false before hook activation', async () => {
  await claims(jwt)
  expect(
    (await db.query('select encheck_account_security_status() s')).rows[0].s,
  ).toEqual({ rest_guard_active: false })
  await db.exec("set pgrst.db_pre_request='public.encheck_admin_request_guard'")
  expect(
    (await db.query('select encheck_account_security_status() s')).rows[0].s
      .rest_guard_active,
  ).toBe(true)
})
it('blocks AAL1 once a factor is verified, permits AAL2', async () => {
  await db.exec(
    `reset role;insert into auth.mfa_factors values('${U}','verified')`,
  )
  await claims(jwt)
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('second facteur')
  await claims({ ...jwt, aal: 'aal2' })
  await db.query('select encheck_admin_request_guard()')
})
it('denies expired/missing/revoked sessions and ambiguous or disabled identities', async () => {
  await claims({ ...jwt, aal: 'aal2', session_id: U })
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow()
  for (const mutation of [
    "update auth.sessions set not_after=now()-interval '1 second'",
    'update admins set is_active=false',
    `insert into admins values('${U}',true)`,
    `insert into admin_session_revocations values('${S}','${U}','${U}','fixture',now())`,
  ]) {
    await db.exec('reset role;begin')
    await db.exec(mutation)
    await claims({ ...jwt, aal: 'aal2' })
    await expect(
      db.query('select encheck_admin_request_guard()'),
    ).rejects.toThrow()
    await db.exec('rollback')
  }
})
it('leaves anonymous Pointage, employee Auth and service-role channels alone; hides security status', async () => {
  for (const [c, r] of [
    [{}, 'anon'],
    [{ sub: S, session_id: U, aal: 'aal1' }, 'authenticated'],
    [{ role: 'service_role' }, 'service_role'],
  ]) {
    await claims(c, r)
    await db.query('select encheck_admin_request_guard()')
    await expect(
      db.query('select encheck_account_security_status()'),
    ).rejects.toThrow()
  }
})
it('keeps revocation records private and never overwrites a newer guard on replay', async () => {
  await claims({ ...jwt, aal: 'aal2' })
  await expect(
    db.query('select * from admin_session_revocations'),
  ).rejects.toThrow('permission denied')
  await db.exec(
    `reset role;create or replace function encheck_admin_request_guard() returns void language plpgsql as $$begin raise exception 'newer guard';end$$;`,
  )
  await db.exec(sql)
  await claims({ ...jwt, aal: 'aal2' })
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('newer guard')
})

it('activation refuses an existing hook and missing Auth links, then records only the intended hook', async () => {
  const activate = readFileSync(
    'supabase/outils-sql/20261025_activer_garde_sessions_admin.sql',
    'utf8',
  )
  await db.exec(
    "reset role;alter role authenticator set pgrst.db_pre_request='other.guard'",
  )
  await expect(db.exec(activate)).rejects.toThrow('hook existe déjà')
  await db.exec('rollback')
  await db.exec(
    'alter role authenticator reset pgrst.db_pre_request;delete from auth.users',
  )
  await expect(db.exec(activate)).rejects.toThrow('Auth actif introuvable')
  await db.exec('rollback')
  await db.exec(`insert into auth.users values('${U}')`)
  await db.exec(activate)
  await db.exec(activate)
  expect(
    (
      await db.query(
        "select unnest(setconfig) setting from pg_db_role_setting where setrole=(select oid from pg_roles where rolname='authenticator')",
      )
    ).rows,
  ).toEqual([
    { setting: 'pgrst.db_pre_request=public.encheck_admin_request_guard' },
  ])
})
