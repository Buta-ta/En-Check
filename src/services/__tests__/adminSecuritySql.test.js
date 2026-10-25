import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  C = '33333333-3333-4333-8333-333333333333'
const S = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  T = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  U = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
async function actor(id, session, aal = 'aal1') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, session_id: session, aal }),
  ])
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table admins(id uuid primary key,user_id uuid unique,role text,is_active boolean,alertes_email boolean default true);
 create table admin_account_events(actor_id uuid,target_id uuid,action text,reason text);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),not_after timestamptz,user_agent text,ip inet);
 create table auth.mfa_factors(user_id uuid,status text);
 insert into admins(id,user_id,role,is_active) values('${A}','${A}','super_admin',true),('${B}','${B}','admin',true),('${C}','${C}','admin',true);
 insert into auth.sessions(id,user_id,user_agent) values('${S}','${A}','Demo super'),('${T}','${B}','Demo member'),('${U}','${C}','Demo other');`)
  await db.exec(
    readFileSync(
      'supabase/migrations/20261025000001_admin_security_workspace.sql',
      'utf8',
    ),
  )
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('installs twice and blocks anonymous preferences and direct table writes', async () => {
  await db.exec(
    readFileSync(
      'supabase/migrations/20261025000001_admin_security_workspace.sql',
      'utf8',
    ),
  )
  expect(
    (
      await db.query(
        "select has_function_privilege('anon','encheck_account_preferences(jsonb)','execute') as allowed",
      )
    ).rows[0].allowed,
  ).toBe(false)
  await actor(B, T)
  await expect(
    db.query('select * from admin_account_preferences'),
  ).rejects.toThrow('permission denied')
})
it('saves only own bounded preferences and synchronizes existing email alert setting', async () => {
  await actor(B, T)
  const prefs = {
    phone: '+229 00000000',
    job_title: 'RH',
    home_path: '/planning',
    email_notifications: false,
  }
  expect(
    (
      await db.query('select encheck_account_preferences($1) as p', [
        JSON.stringify(prefs),
      ])
    ).rows[0].p,
  ).toEqual(prefs)
  await expect(
    db.query('select encheck_account_preferences($1)', [
      JSON.stringify({ ...prefs, role: 'super_admin' }),
    ]),
  ).rejects.toThrow('non autorisées')
  await expect(
    db.query('select encheck_account_preferences($1)', [
      JSON.stringify({ ...prefs, home_path: 'https://example.org' }),
    ]),
  ).rejects.toThrow('non autorisée')
  await db.exec('reset role')
  expect(
    (await db.query('select alertes_email from admins where id=$1', [B]))
      .rows[0].alertes_email,
  ).toBe(false)
  expect(
    (await db.query('select admin_id from admin_account_preferences')).rows,
  ).toEqual([{ admin_id: B }])
})
it('restricts sessions to the actor or an active superadmin without returning credentials', async () => {
  await actor(B, T)
  expect(
    (await db.query('select * from encheck_account_sessions(null)')).rows,
  ).toHaveLength(1)
  await expect(
    db.query('select * from encheck_account_sessions($1)', [C]),
  ).rejects.toThrow('Accès refusé')
  await actor(A, S)
  const row = (
    await db.query('select * from encheck_account_sessions($1)', [B])
  ).rows[0]
  expect(row.user_agent).toBe('Demo member')
  expect(row.is_current).toBe(false)
  expect(Object.keys(row)).not.toContain('access_token')
})
it('fails closed for inactive accounts, absent sessions and verified MFA without aal2', async () => {
  await db.exec(
    `reset role;insert into auth.mfa_factors values('${B}','verified')`,
  )
  await actor(B, T)
  await expect(
    db.query('select encheck_account_preferences(null)'),
  ).rejects.toThrow('Session administrateur')
  await actor(B, T, 'aal2')
  await expect(
    db.query('select encheck_account_preferences(null)'),
  ).resolves.toBeTruthy()
  await actor(B, S, 'aal2')
  await expect(
    db.query('select encheck_account_preferences(null)'),
  ).rejects.toThrow('Session administrateur')
  await db.exec(`reset role;update admins set is_active=false where id='${C}'`)
  await actor(C, U)
  await expect(
    db.query('select encheck_account_preferences(null)'),
  ).rejects.toThrow('Session administrateur')
  await db.exec(`reset role;update admins set is_active=true where id='${C}'`)
})
it('requires activated guard before revocation and then rejects subsequent REST-guarded access', async () => {
  await actor(A, S)
  await expect(
    db.query('select encheck_account_revoke_session($1,$2)', [
      T,
      'Lost device',
    ]),
  ).rejects.toThrow('doit être activé')
  await db.exec("set pgrst.db_pre_request='public.encheck_admin_request_guard'")
  await db.query('select encheck_account_revoke_session($1,$2)', [
    T,
    'Lost device',
  ])
  await db.query('select encheck_account_revoke_session($1,$2)', [
    T,
    'Lost device',
  ])
  await actor(B, T, 'aal2')
  await expect(
    db.query('select encheck_admin_request_guard()'),
  ).rejects.toThrow('Session administrateur')
  await db.exec('reset role')
  expect(
    (
      await db.query(
        "select * from admin_account_events where action='session_revoked'",
      )
    ).rows,
  ).toHaveLength(1)
})
