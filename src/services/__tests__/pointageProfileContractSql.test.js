import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222'
const migration = readFileSync(
  'supabase/migrations/20261025000015_pointage_profile_catalog.sql',
  'utf8',
)
async function profile(token = 'valid') {
  return (await db.query('select encheck_employe_profil($1) data', [token]))
    .rows[0].data
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;
 create table enterprises(id uuid primary key,name text,logo_url text,matricule_prefix text,is_active boolean,email text);
 create table face_recognition_config(enterprise_id uuid unique,pointage_mode text,liveness_required boolean);
 create table employees(id uuid primary key,enterprise_id uuid,matricule text,first_name text,last_name text,photo_url text,is_active boolean,department text,position text,email text,pin_hash text,national_id_number text);
 create table employee_sessions(id uuid default gen_random_uuid(),employee_id uuid,enterprise_id uuid,device_id text,jeton_hash text unique,cree_le timestamptz default now(),vu_le timestamptz,expire_le timestamptz,revoque_le timestamptz);
 create table work_schedules(id uuid primary key,enterprise_id uuid,name text,start_time time,end_time time,work_days int[],has_break boolean,break_start time,break_end time,is_active boolean,private_note text);
 create table employee_schedules(id uuid default gen_random_uuid(),employee_id uuid,schedule_id uuid,use_custom_hours boolean,custom_start_time time,custom_end_time time,custom_has_break boolean,custom_break_start time,custom_break_end time,custom_work_days int[],is_active boolean,created_at timestamptz default now(),updated_at timestamptz);
 create function encheck_session_ouvrir(uuid,uuid,text) returns jsonb language sql security definer as $$select '{}'::jsonb$$;
 create function login_owner_fixture() returns jsonb language sql security definer as $$select encheck_session_ouvrir(null,null,null)$$;
 grant execute on function encheck_session_ouvrir(uuid,uuid,text) to anon,authenticated;
 insert into enterprises values('${A}','Maison fictive',null,'MF',true,'secret'),('${B}','Autre',null,'AU',true,'secret');
 insert into face_recognition_config values('${A}','face_required',true);
 insert into employees values('${A}','${A}','MF-001','Awa','Test',null,true,'Atelier','Responsable','secret','secret','secret'),('${B}','${B}','AU-002','Autre','Test',null,true,null,null,'secret','secret','secret');
 insert into work_schedules values('${A}','${A}','Journée','08:00','16:00',array[1,2,3,4,5],true,'12:00','13:00',true,'secret'),('${B}','${B}','Autre','09:00','17:00',array[1],false,null,null,true,'secret');
 insert into employee_schedules(employee_id,schedule_id,use_custom_hours,custom_start_time,custom_end_time,is_active) values('${A}','${A}',true,'09:00','17:30',true),('${A}','${B}',false,null,null,true);
 `)
  await db.exec(migration)
  await db.exec(
    "update pointage_profile_contract set trusted_since=now()-interval '1 day'",
  )
  await db.exec(
    `insert into employee_sessions(employee_id,enterprise_id,jeton_hash,expire_le) values('${A}','${A}',md5('valid'),now()+interval '30 days'),('${B}','${B}',md5('other'),now()+interval '30 days');`,
  )
}, 30000)
afterAll(async () => db.close())
beforeEach(async () => db.exec('begin'))
afterEach(async () => db.exec('rollback'))
it('is repeatable without moving the trust cutoff; keeps issuer owner-only', async () => {
  const cutoff = (
    await db.query('select trusted_since from pointage_profile_contract')
  ).rows
  await db.exec(migration)
  expect(
    (await db.query('select trusted_since from pointage_profile_contract'))
      .rows,
  ).toEqual(cutoff)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set local role ${role};savepoint access_test`)
    await expect(
      db.query('select encheck_session_ouvrir(null,null,null)'),
    ).rejects.toThrow('permission denied')
    await db.exec('rollback to access_test;reset role')
  }
  // Context inherited by an issuer call from a trusted login owner is preserved.
  await db.exec('set local role anon')
  expect(
    (await db.query('select login_owner_fixture() data')).rows[0].data,
  ).toEqual({})
})
it('returns only the active catalogue allowlist, preserving missing config as null', async () => {
  await db.exec('set local role anon')
  const result = (await db.query('select encheck_entreprises_publiques() data'))
    .rows[0].data
  expect(result.ok).toBe(true)
  expect(result.entreprises).toHaveLength(2)
  expect(Object.keys(result.entreprises[0]).sort()).toEqual(
    ['id', 'name', 'logo_url', 'matricule_prefix', 'pointage_mode'].sort(),
  )
  expect(result.entreprises.find((e) => e.id === A).pointage_mode).toBe(
    'face_required',
  )
  expect(result.entreprises.find((e) => e.id === B).pointage_mode).toBeNull()
  await db.exec(
    `reset role;update enterprises set is_active=false;set local role anon`,
  )
  expect(
    (await db.query('select encheck_entreprises_publiques() data')).rows[0]
      .data,
  ).toEqual({ ok: true, entreprises: [] })
})
it('returns the token holder only, with bounded expiry and no secret fields or cross-enterprise schedule', async () => {
  const before = (
    await db.query('select * from employee_sessions order by jeton_hash')
  ).rows
  await db.exec('set local role anon')
  const data = await profile()
  expect(data.ok).toBe(true)
  expect(data.employee.id).toBe(A)
  expect(Object.keys(data.employee).sort()).toEqual(
    [
      'id',
      'enterprise_id',
      'matricule',
      'first_name',
      'last_name',
      'photo_url',
      'is_active',
      'department',
      'position',
      'employee_schedules',
    ].sort(),
  )
  expect(data.employee.employee_schedules).toHaveLength(1)
  expect(data.employee.employee_schedules[0].work_schedule_id).toBe(A)
  expect(data.employee.employee_schedules[0].custom_start_time).toBe('09:00:00')
  expect(data.employee.employee_schedules[0].work_schedules.work_days).toEqual([
    1, 2, 3, 4, 5,
  ])
  expect(JSON.stringify(data)).not.toContain('secret')
  expect((await profile('other')).employee.id).toBe(B)
  expect(new Date(data.expire_le).getTime() - Date.now()).toBeLessThanOrEqual(
    12 * 3600000,
  )
  await db.exec('reset role')
  expect(
    (await db.query('select * from employee_sessions order by jeton_hash'))
      .rows,
  ).toEqual(before)
})
it('refuses absent, unknown, empty and oversized tokens explicitly', async () => {
  await db.exec('set local role anon')
  for (const token of [null, '', '   ', 'unknown', 'x'.repeat(1025)])
    expect(await profile(token)).toEqual({
      ok: false,
      raison: 'jeton_invalide',
    })
})
it('refuses revoked, expired, old-cutover and over-12h sessions', async () => {
  for (const [update, raison] of [
    ['revoque_le=now()', 'jeton_revoque'],
    ["revoque_le=null,expire_le=now()-interval '1 second'", 'jeton_expire'],
    [
      "expire_le=now()+interval '1 day',cree_le=now()-interval '13 hours'",
      'jeton_expire',
    ],
    ["cree_le=now()-interval '2 days'", 'reauthentification_requise'],
    ['cree_le=null', 'reauthentification_requise'],
  ]) {
    await db.exec(
      `reset role;update employee_sessions set ${update} where jeton_hash=md5('valid');set local role anon`,
    )
    expect(await profile()).toEqual({ ok: false, raison })
  }
})
it('refuses inactive employee/enterprise and mismatched binding; empty schedules are valid', async () => {
  await db.exec(
    `update employees set is_active=false where id='${A}';set local role anon`,
  )
  expect(await profile()).toEqual({ ok: false, raison: 'employe_inactif' })
  await db.exec(
    `reset role;update employees set is_active=true;update enterprises set is_active=false where id='${A}';set local role anon`,
  )
  expect(await profile()).toEqual({ ok: false, raison: 'entreprise_inactive' })
  await db.exec(
    `reset role;update enterprises set is_active=true;update employees set enterprise_id='${B}' where id='${A}';set local role anon`,
  )
  expect(await profile()).toEqual({ ok: false, raison: 'jeton_invalide' })
  await db.exec(
    `reset role;update employees set enterprise_id='${A}' where id='${A}';update work_schedules set is_active=false;set local role anon`,
  )
  expect((await profile()).employee.employee_schedules).toEqual([])
})
it('does not grant direct access to session storage or the private cutoff', async () => {
  await db.exec('set local role anon;savepoint access_test')
  await expect(db.query('select * from employee_sessions')).rejects.toThrow(
    'permission denied',
  )
  await db.exec('rollback to access_test')
  await expect(
    db.query('update pointage_profile_contract set trusted_since=now()'),
  ).rejects.toThrow('permission denied')
})
