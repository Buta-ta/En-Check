import { it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
it('only records Auth evidence for the authenticated active account, never anonymous declarations', async () => {
  const db = new PGlite(),
    a = '11111111-1111-4111-8111-111111111111',
    b = '22222222-2222-4222-8222-222222222222'
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid,last_sign_in_at timestamptz);
 create table admins(id uuid,user_id uuid,is_active boolean,failed_attempts int,locked_until timestamptz,last_login_at timestamptz);
 insert into auth.users values('${a}','2026-10-25T10:00:00Z');
 insert into admins values('${a}','${a}',true,3,now(),null),('${b}','${b}',true,2,now(),null);
 create function encheck_assurer_identite(uuid,text) returns boolean language sql security definer as $$select true$$;
 grant execute on function encheck_assurer_identite(uuid,text) to authenticated,anon;`)
    const identity = readFileSync(
        'supabase/migrations/20261025000012_admin_identity_helper_private.sql',
        'utf8',
      ),
      login = readFileSync(
        'supabase/migrations/20261025000013_admin_login_result_verified.sql',
        'utf8',
      )
    for (let i = 0; i < 2; i++) {
      await db.exec(identity)
      await db.exec(login)
    }
    await db.exec('set role anon')
    await expect(
      db.query('select encheck_assurer_identite($1,null)', [a]),
    ).rejects.toThrow('permission denied')
    await expect(
      db.query('select admin_login_result($1,true)', [a]),
    ).rejects.toThrow('permission denied')
    await db.exec(`reset role;set role authenticated;set test.uid='${a}';`)
    await expect(
      db.query('select encheck_assurer_identite($1,null)', [a]),
    ).rejects.toThrow('permission denied')
    await expect(
      db.query('select admin_login_result($1,true)', [b]),
    ).rejects.toThrow('non autorisé')
    await expect(
      db.query('select admin_login_result($1,false)', [a]),
    ).rejects.toThrow('vérifiée')
    await db.query('select admin_login_result($1,true)', [a])
    await db.exec('reset role')
    const rows = (
      await db.query(
        'select id,failed_attempts,last_login_at from admins order by id',
      )
    ).rows
    expect(rows[0].failed_attempts).toBe(0)
    expect(new Date(rows[0].last_login_at).toISOString()).toBe(
      '2026-10-25T10:00:00.000Z',
    )
    expect(rows[1].failed_attempts).toBe(2)
    expect(rows[1].last_login_at).toBeNull()
    await db.exec(
      `update admins set is_active=false where id='${a}';set role authenticated;`,
    )
    await expect(
      db.query('select admin_login_result($1,true)', [a]),
    ).rejects.toThrow('non autorisé')
  } finally {
    await db.close()
  }
}, 30000)
