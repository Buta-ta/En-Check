import { it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

it('preserves lookup bodies and trusted nesting while enforcing caller RLS', async () => {
  const db = new PGlite()
  const a = '11111111-1111-4111-8111-111111111111'
  const b = '22222222-2222-4222-8222-222222222222'
  try {
    // Synthetic business bodies isolate privilege mechanics, not ADMS logic.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table employees(id uuid,enterprise_id uuid,first_name text);
      insert into employees values('${a}','${a}','Allowed'),('${b}','${b}','Other');
      alter table employees enable row level security;
      create policy employee_scope on employees to authenticated using(enterprise_id=nullif(current_setting('test.enterprise',true),'')::uuid);
      grant select on employees to authenticated,service_role;
      create view employees_public with(security_invoker=true) as select * from employees;
      grant select on employees_public to authenticated,service_role;
      create function encheck_employe_par_id(p_employee_id uuid) returns jsonb language sql security definer as $$select to_jsonb(e) from employees_public e where e.id=p_employee_id$$;
      create function get_employees_by_enterprise(p_enterprise_id uuid) returns setof employees language sql security definer as $$select * from employees_public where enterprise_id=p_enterprise_id$$;
      create function encheck_adms_carte_pins(p_enterprise_id uuid) returns jsonb language sql security definer as $$select coalesce(jsonb_agg(id),'[]') from employees where enterprise_id=p_enterprise_id$$;
      create function trusted_ingest_fixture(p_enterprise_id uuid) returns jsonb language sql security definer as $$select encheck_adms_carte_pins(p_enterprise_id)$$;
      revoke all on function trusted_ingest_fixture(uuid) from public;
      grant execute on function trusted_ingest_fixture(uuid) to service_role;
    `)
    const bodies = async () =>
      (
        await db.query(
          "select proname,prosrc from pg_proc where proname in ('encheck_employe_par_id','get_employees_by_enterprise','encheck_adms_carte_pins') order by proname",
        )
      ).rows
    const before = await bodies()
    const migration = readFileSync(
      'supabase/migrations/20261025000014_employee_lookup_invoker.sql',
      'utf8',
    )
    await db.exec(migration)
    await db.exec(migration)
    expect(await bodies()).toEqual(before)
    await db.exec('set role anon')
    for (const name of [
      'encheck_employe_par_id',
      'get_employees_by_enterprise',
      'encheck_adms_carte_pins',
    ]) {
      await expect(db.query(`select * from ${name}($1)`, [a])).rejects.toThrow(
        'permission denied',
      )
    }
    await db.exec(
      `reset role;set role authenticated;set test.enterprise='${a}';`,
    )
    expect(
      (await db.query('select encheck_employe_par_id($1) data', [a])).rows[0]
        .data.first_name,
    ).toBe('Allowed')
    expect(
      (await db.query('select encheck_employe_par_id($1) data', [b])).rows[0]
        .data,
    ).toBeNull()
    expect(
      (await db.query('select * from get_employees_by_enterprise($1)', [b]))
        .rows,
    ).toEqual([])
    expect(
      (await db.query('select encheck_adms_carte_pins($1) data', [b])).rows[0]
        .data,
    ).toEqual([])
    await expect(
      db.query('select trusted_ingest_fixture($1)', [b]),
    ).rejects.toThrow('permission denied')
    await db.exec('reset role;set role service_role')
    expect(
      (await db.query('select trusted_ingest_fixture($1) data', [b])).rows[0]
        .data,
    ).toEqual([b])
    expect(
      (await db.query('select encheck_employe_par_id($1) data', [b])).rows[0]
        .data.first_name,
    ).toBe('Other')
  } finally {
    await db.close()
  }
}, 30000)
