import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const sql = readFileSync(
  'supabase/migrations/20261024000001_admin_account_workspace.sql',
  'utf8',
)
let db
const superId = '11111111-1111-4111-8111-111111111111'
const memberId = '22222222-2222-4222-8222-222222222222'
const otherId = '33333333-3333-4333-8333-333333333333'
async function actor(id, role = 'authenticated') {
  await db.exec(
    `reset role; set request.jwt.claim.sub='${id}'; set role ${role}`,
  )
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated,anon;
 create table admins(id uuid primary key,user_id uuid unique,role text,is_active boolean,first_name text,last_name text,photo_url text);
 grant select on admins to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 insert into admins values('${superId}','${superId}','super_admin',true,'Super','Admin',null),('${memberId}','${memberId}','admin',true,'First','Member',null),('${otherId}','${otherId}','admin',true,'Other','Member',null);`)
  await db.exec(sql)
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('installs idempotently and does not allow anonymous execution', async () => {
  await db.exec(sql)
  expect(
    (
      await db.query(
        "select has_function_privilege('anon','encheck_account_profile(text,text,text)','execute') as allowed",
      )
    ).rows[0].allowed,
  ).toBe(false)
})
it('only edits the authenticated profile and records an event', async () => {
  await actor(memberId)
  await db.query('select encheck_account_profile($1,$2,$3)', [
    'New',
    'Name',
    null,
  ])
  expect(
    (
      await db.query('select first_name,role from admins where id=$1', [
        memberId,
      ])
    ).rows[0],
  ).toEqual({ first_name: 'New', role: 'admin' })
  expect(
    (await db.query('select action from admin_account_events')).rows,
  ).toEqual([{ action: 'profile_updated' }])
  await expect(
    db.query('select encheck_account_profile($1,$2,$3)', [
      'New',
      'Name',
      `https://example.org/storage/v1/object/public/admin-avatars/${otherId}/fake.png`,
    ]),
  ).rejects.toThrow('Photo non autorisée')
})
it('denies ordinary administrators state changes on another account', async () => {
  await actor(memberId)
  await expect(
    db.query('select encheck_account_status($1,false,$2)', [
      otherId,
      'Reason provided',
    ]),
  ).rejects.toThrow()
  expect(
    (await db.query('select is_active from admins where id=$1', [otherId]))
      .rows[0].is_active,
  ).toBe(true)
})
it('audits state changes, hides another user history and rejects an inactive actor', async () => {
  await actor(superId)
  await db.query('select encheck_account_status($1,false,$2)', [
    otherId,
    'Contract suspended',
  ])
  expect(
    (
      await db.query(
        'select action from admin_account_events where target_id=$1',
        [otherId],
      )
    ).rows[0].action,
  ).toBe('suspended')
  await actor(memberId)
  expect(
    (
      await db.query('select * from admin_account_events where target_id=$1', [
        otherId,
      ])
    ).rows,
  ).toEqual([])
  await actor(otherId)
  await expect(
    db.query("select encheck_account_profile('Try','Inactive',null)"),
  ).rejects.toThrow()
  await actor(superId)
  await db.query('select encheck_account_status($1,true,$2)', [
    otherId,
    'Contract restored',
  ])
})
it('blocks self deactivation and protects the last superadmin through direct legacy writes', async () => {
  await actor(superId)
  await expect(
    db.query('select encheck_account_status($1,false,$2)', [
      superId,
      'Own account change',
    ]),
  ).rejects.toThrow('propre compte')
  await db.exec('reset role')
  await expect(
    db.query('update admins set role=$1 where id=$2', ['admin', superId]),
  ).rejects.toThrow('dernier superadmin')
  await expect(
    db.query('delete from admins where id=$1', [superId]),
  ).rejects.toThrow('dernier superadmin')
})

it('installs the password wrapper without anonymous access', async () => {
  await db.exec('reset role')
  await db.exec(`create table password_service_calls(target uuid primary key, revisions int not null default 0);
 create function public.encheck_admin_definir_mot_de_passe(p_admin_id uuid,p_mot_de_passe text) returns void language plpgsql as $$
 begin
   if p_mot_de_passe='FailService-12345!' then raise exception 'Sensitive service detail: %',p_mot_de_passe; end if;
   insert into password_service_calls values(p_admin_id,1) on conflict(target) do update set revisions=password_service_calls.revisions+1;
 end $$;`)
  const migration = readFileSync(
    'supabase/migrations/20261024000002_admin_account_password.sql',
    'utf8',
  )
  await db.exec(migration)
  await db.exec(migration)
  expect(
    (
      await db.query(
        "select has_function_privilege('anon','encheck_account_password(uuid,text,text)','execute') as allowed",
      )
    ).rows[0].allowed,
  ).toBe(false)
})
it('denies ordinary users, self reset, missing target, weak or oversized passwords and secrets in the reason', async () => {
  await actor(memberId)
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      otherId,
      'Secure-Example-123!',
      'Support requested',
    ]),
  ).rejects.toThrow()
  await actor(superId)
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      superId,
      'Secure-Example-123!',
      'Support requested',
    ]),
  ).rejects.toThrow('Mon compte')
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      otherId,
      'short',
      'Support requested',
    ]),
  ).rejects.toThrow('12 à 72')
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      otherId,
      'é'.repeat(40),
      'Support requested',
    ]),
  ).rejects.toThrow('72 octets')
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      otherId,
      'Secure-Example-123!',
      'Here is Secure-Example-123!',
    ]),
  ).rejects.toThrow('motif')
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      '99999999-9999-4999-8999-999999999999',
      'Secure-Example-123!',
      'Support requested',
    ]),
  ).rejects.toThrow()
})
it('records the target and reason but never the supplied password in the new audit journal', async () => {
  await actor(superId)
  await db.query('select encheck_account_password($1,$2,$3)', [
    memberId,
    'Secure-Example-123!',
    'Support requested',
  ])
  const events = (
    await db.query(
      "select * from admin_account_events where action='password_changed'",
    )
  ).rows
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({
    actor_id: superId,
    target_id: memberId,
    reason: 'Support requested',
  })
  expect(JSON.stringify(events)).not.toContain('Secure-Example-123!')
})
it('rolls back the underlying change when audit insertion fails and hides legacy secret-bearing errors', async () => {
  await db.exec('reset role')
  const before = (await db.query('select * from password_service_calls')).rows
  await db.exec(
    "alter table admin_account_events add constraint test_audit_failure check(action<>'password_changed') not valid",
  )
  await actor(superId)
  await expect(
    db.query('select encheck_account_password($1,$2,$3)', [
      memberId,
      'Secure-Example-456!',
      'Support requested',
    ]),
  ).rejects.toThrow()
  await db.exec('reset role')
  expect((await db.query('select * from password_service_calls')).rows).toEqual(
    before,
  )
  await db.exec(
    'alter table admin_account_events drop constraint test_audit_failure',
  )
  await actor(superId)
  let message = ''
  try {
    await db.query('select encheck_account_password($1,$2,$3)', [
      memberId,
      'FailService-12345!',
      'Support requested',
    ])
  } catch (error) {
    message = error.message
  }
  expect(message).toContain('refusé')
  expect(message).not.toContain('FailService-12345!')
})
it('does not record success if a legacy service returns a failure or ambiguous result instead of throwing', async () => {
  await db.exec(
    'reset role; drop function public.encheck_admin_definir_mot_de_passe(uuid,text)',
  )
  const before = (
    await db.query('select * from password_service_calls order by target')
  ).rows
  for (const response of [
    'null',
    'false',
    '{"ok":false}',
    '{"message":"unknown"}',
    '{"ok":true,"success":false}',
    '{"success":true,"error":"failed"}',
  ]) {
    await db.exec(`create or replace function public.encheck_admin_definir_mot_de_passe(p_admin_id uuid,p_mot_de_passe text) returns jsonb language plpgsql as $$
   begin update password_service_calls set revisions=revisions+1 where target=p_admin_id;return '${response}'::jsonb;end $$;`)
    await actor(superId)
    await expect(
      db.query('select encheck_account_password($1,$2,$3)', [
        memberId,
        'Secure-Example-123!',
        'Support requested',
      ]),
    ).rejects.toThrow('refusé')
    await db.exec('reset role')
    expect(
      (await db.query('select * from password_service_calls order by target'))
        .rows,
    ).toEqual(before)
  }
})
