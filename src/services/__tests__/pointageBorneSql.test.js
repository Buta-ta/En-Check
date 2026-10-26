import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const borneSql = readFileSync(
  'supabase/migrations/20261026000016_pointage_bornes_biometrics.sql',
  'utf8',
)
let db
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222'
const migration = readFileSync(
  'supabase/migrations/20261025000015_pointage_profile_catalog.sql',
  'utf8',
)
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

  await db.exec(`create schema auth;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 create table admins(id uuid,user_id uuid,role text,is_active boolean);
 create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);
 insert into admins values('${A}','${A}','super_admin',true);insert into auth.sessions values('${A}','${A}',null);
 create table face_enrollments(id uuid default gen_random_uuid(),employee_id uuid,enterprise_id uuid,status text,is_active boolean,face_embedding jsonb,enrollment_photo_url text,created_at timestamptz default now(),updated_at timestamptz);
 insert into employees(id,enterprise_id,matricule,first_name,last_name,is_active) values('33333333-3333-4333-8333-333333333333','${A}','PEER','Peer','Test',true);
 insert into face_enrollments(employee_id,enterprise_id,status,is_active,face_embedding,enrollment_photo_url) values
 ('${A}','${A}','approved',true,'[1,2]','private'),('${A}','${A}','pending',true,'[8,8]','private'),
 ('33333333-3333-4333-8333-333333333333','${A}','approved',true,'[3,4]','private'),
 ('${B}','${B}','approved',true,'[5,6]','private'),('${B}','${A}','approved',true,'[9,9]','private');`)
  await db.exec(borneSql)
  await db.exec(borneSql)
  await db.exec(
    readFileSync(
      'supabase/migrations/20261026000017_pointage_photo_tickets.sql',
      'utf8',
    ),
  )
}, 30000)
afterAll(async () => db.close())
beforeEach(async () => db.exec('begin'))
afterEach(async () => db.exec('rollback'))
async function admin(aal = 'aal2') {
  await db.exec('reset role')
  await db.query("select set_config('test.jwt',$1,true)", [
    JSON.stringify({ sub: A, session_id: A, aal }),
  ])
  await db.exec('set local role authenticated')
}
async function create() {
  await admin()
  return (
    await db.query(
      "select encheck_borne_creer('tablet', $1,now()+interval '7 days','Recette fictive') data",
      [A],
    )
  ).rows[0].data
}
async function auth(secret) {
  await db.exec('reset role;set local role anon')
  return (
    await db.query("select encheck_borne_authentifier('tablet',$1) data", [
      secret,
    ])
  ).rows[0].data
}
async function sync(token) {
  return (
    await db.query('select encheck_borne_personnel($1,null) data', [token])
  ).rows[0].data
}
async function faces(token, scope) {
  return (
    await db.query('select encheck_visage_lister_v2($1,$2) data', [
      token,
      scope,
    ])
  ).rows[0].data
}
it('requires an active unique superadmin with MFA and a live Auth session', async () => {
  for (const kind of ['aal1', 'inactive', 'ordinary', 'session']) {
    await db.exec('savepoint guard')
    await admin(kind === 'aal1' ? 'aal1' : 'aal2')
    await db.exec('reset role')
    if (kind === 'inactive') await db.exec('update admins set is_active=false')
    if (kind === 'ordinary') await db.exec("update admins set role='admin'")
    if (kind === 'session') await db.exec('delete from auth.sessions')
    await db.exec('set local role authenticated')
    await expect(db.query('select encheck_bornes_lister()')).rejects.toThrow()
    await db.exec('rollback to guard')
  }
})
it('creates secret once without persisting or listing plaintext credentials', async () => {
  const b = await create()
  expect(b.secret).toHaveLength(68)
  const list = (await db.query('select encheck_bornes_lister() data')).rows[0]
    .data
  expect(list.bornes[0].device_id).toBe('tablet')
  expect(JSON.stringify(list)).not.toContain(b.secret)
  await db.exec('reset role')
  const stored = (await db.query('select secret_hash from pointage_bornes'))
    .rows[0]
  expect(stored.secret_hash).toHaveLength(64)
  expect(stored.secret_hash).not.toBe(b.secret)
  expect(
    (await db.query('select action,motif from pointage_borne_events')).rows,
  ).toEqual([{ action: 'created', motif: 'Recette fictive' }])
})
it('separates individual and device tokens and refuses missing or invalid scope', async () => {
  const b = await create(),
    session = await auth(b.secret)
  expect(session.ok).toBe(true)
  expect(await sync('valid')).toEqual({ ok: false, raison: 'jeton_invalide' })
  expect((await faces('valid', 'borne')).ok).toBe(false)
  expect((await faces(session.jeton_borne, 'personne')).ok).toBe(false)
  expect(await faces('valid', 'all')).toEqual({
    ok: false,
    raison: 'portee_invalide',
  })
  expect((await auth('bad')).ok).toBe(false)
})
it('personal view never contains a colleague or a pending embedding', async () => {
  await db.exec('set local role anon')
  const r = await faces('valid', 'personne')
  expect(r.enrolements).toHaveLength(2)
  expect(r.enrolements.every((e) => e.employee_id === A)).toBe(true)
  expect(
    r.enrolements.find((e) => e.status === 'pending').face_embedding,
  ).toBeUndefined()
  expect(JSON.stringify(r)).not.toContain('private')
})
it('snapshots active scoped personnel and approved faces, with expiry and no silent delta', async () => {
  const b = await create(),
    s = await auth(b.secret),
    r = await sync(s.jeton_borne)
  expect(r.ok).toBe(true)
  expect(r.mode).toBe('snapshot_complet')
  expect(r.employes).toHaveLength(2)
  expect(r.embeddings).toHaveLength(2)
  expect(r.employes.every((e) => e.enterprise_id === A)).toBe(true)
  expect(
    r.embeddings.every((e) => e.enterprise_id === A && e.status === 'approved'),
  ).toBe(true)
  expect(JSON.stringify(r)).not.toContain('secret')
  expect(JSON.stringify(r)).not.toContain('private')
  expect(new Date(r.cache_expire_le).getTime()).toBeLessThanOrEqual(
    Date.now() + 24 * 3600000,
  )
  await db.exec(
    `reset role;update employees set is_active=false where id='${A}';set local role anon`,
  )
  expect((await sync(s.jeton_borne)).employes).toHaveLength(1)
  expect((await sync(s.jeton_borne)).embeddings).toHaveLength(1)
})
it('rotation invalidates the old secret and all old leases; revocation takes effect on the next read', async () => {
  const b = await create(),
    old = await auth(b.secret)
  await admin()
  const rotated = (
    await db.query(
      "select encheck_borne_secret_renouveler($1,'Rotation de recette') data",
      [b.borne_id],
    )
  ).rows[0].data
  expect((await auth(b.secret)).ok).toBe(false)
  expect((await sync(old.jeton_borne)).raison).toBe('appareil_revoque')
  const fresh = await auth(rotated.secret)
  expect(fresh.ok).toBe(true)
  await admin()
  await db.query("select encheck_borne_revoquer($1,'Fin de recette')", [
    b.borne_id,
  ])
  await db.exec('reset role;set local role anon')
  expect((await sync(fresh.jeton_borne)).raison).toBe('appareil_revoque')
  expect((await auth(rotated.secret)).raison).toBe('appareil_revoque')
})
it('expires leases and refuses disabled companies', async () => {
  const b = await create(),
    s = await auth(b.secret)
  await db.exec(
    "reset role;update pointage_borne_sessions set expire_le=now()-interval '1 second';set local role anon",
  )
  expect((await sync(s.jeton_borne)).raison).toBe('appareil_expire')
  await db.exec(
    `reset role;update enterprises set is_active=false where id='${A}';set local role anon`,
  )
  expect((await auth(b.secret)).raison).toBe('entreprise_inactive')
})
it('blocks direct private table and helper access', async () => {
  await db.exec('set local role anon')
  for (const query of [
    'select * from pointage_bornes',
    'select * from pointage_borne_sessions',
    'select encheck_borne_scope(null)',
    'select encheck_borne_employee_payload(null,null)',
    'select encheck_borne_admin_guard()',
  ]) {
    await db.exec('savepoint access_test')
    await expect(db.query(query)).rejects.toThrow('permission denied')
    await db.exec('rollback to access_test')
  }
})

it('reserves own photo paths and caps attempts without accepting arbitrary employee IDs', async () => {
  await db.exec('set local role anon')
  for (let i = 0; i < 10; i++) {
    const r = (
      await db.query("select encheck_photo_upload_reserver('valid') data")
    ).rows[0].data
    expect(r.ok).toBe(true)
    expect(r.path.startsWith(`${A}/${A}_`)).toBe(true)
  }
  expect(
    (await db.query("select encheck_photo_upload_reserver('valid') data"))
      .rows[0].data,
  ).toEqual({ ok: false, raison: 'quota_photo' })
  expect(
    (await db.query("select encheck_photo_upload_reserver('missing') data"))
      .rows[0].data.ok,
  ).toBe(false)
})
it('honors a deployed Admin guard refusal instead of falling back', async () => {
  await db.exec(
    "create function encheck_account_security_status() returns jsonb language sql as $$select jsonb_build_object('rest_guard_active',false)$$",
  )
  await admin()
  await expect(db.query('select encheck_bornes_lister()')).rejects.toThrow(
    'non actif',
  )
})
