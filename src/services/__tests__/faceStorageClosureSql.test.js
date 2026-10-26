import {it,expect} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
it('restricts old permissive policies without breaking authorized admin signing or other buckets',async()=>{
 const db=new PGlite(),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 grant usage on schema auth,storage to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',auth.uid())$$;
 create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);
 create table admins(id uuid,user_id uuid,role text,is_active boolean,enterprise_id uuid);
 create table admin_entreprises(admin_id uuid,enterprise_id uuid,is_active boolean);
 insert into admins values('${A}','${A}','admin',true,'${A}');insert into auth.sessions values('${A}','${A}',null);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
 create policy old_wide_policy on storage.objects for all to public using(true) with check(true);
 insert into storage.objects values('face-enrollments','${A}/own.jpg'),('face-enrollments','${B}/other.jpg'),('other-bucket','unchanged');`)
 const sql=readFileSync('supabase/outils-sql/20261026_fermer_acces_direct_photos_enrolement.sql','utf8')
 await db.exec(sql);await db.exec(sql)
 await db.exec('set role anon')
 expect((await db.query('select * from storage.objects')).rows).toEqual([{bucket_id:'other-bucket',name:'unchanged'}])
 await expect(db.query("insert into storage.objects values('face-enrollments','x')")).rejects.toThrow('row-level security')
 expect((await db.query("delete from storage.objects where bucket_id='face-enrollments' returning *")).rows).toEqual([])
 await db.exec(`reset role;set role authenticated;set test.uid='${A}'`)
 expect((await db.query("select name from storage.objects where bucket_id='face-enrollments'")).rows).toEqual([{name:`${A}/own.jpg`}])
 await db.exec('reset role;update admins set is_active=false;set role authenticated')
 expect((await db.query("select name from storage.objects where bucket_id='face-enrollments'")).rows).toEqual([])
 await db.exec('reset role;set role service_role')
 expect((await db.query('select * from storage.objects')).rows).toHaveLength(3)
 await db.exec("insert into storage.objects values('face-enrollments','server-upload')")
 } finally{await db.close()}
},30000)
