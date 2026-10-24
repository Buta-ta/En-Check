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
