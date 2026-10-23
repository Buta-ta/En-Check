import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const sql = readFileSync(new URL('../../../supabase/outils-sql/20261023_securiser_ecritures_fiscales.sql', import.meta.url), 'utf8')
let db
const id = '00000000-0000-0000-0000-000000000001'
const contribution = [{ contribution_code: 'NEW', contribution_name: 'New', contribution_type: 'social', paid_by: 'both', rate_employee: 5 }]
const bracket = [{ bracket_name: 'Normal', min_amount: 0, tax_rate: 10, bracket_order: 1 }]
const call = (brackets = bracket) => db.query('select paie_remplacer_configuration($1,$2,$3,$4,$5,$6,$7)', [id, JSON.stringify(contribution), JSON.stringify(brackets), '{}', 'COG', 'XAF', 'Congo'])
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE TABLE enterprises(id uuid primary key, country_code text, currency text, fiscal_country_label text);
    CREATE TABLE payroll_settings(id uuid primary key default gen_random_uuid(), enterprise_id uuid unique, custom_tax_rules jsonb, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE enterprise_payroll_contributions(id uuid primary key default gen_random_uuid(), enterprise_id uuid, contribution_type text, contribution_code text, contribution_name text, paid_by text, calculation_method text, rate_employee numeric, rate_employer numeric, fixed_amount numeric, calculation_base text, min_base numeric, max_base numeric, is_mandatory boolean, is_active boolean, display_order integer, notes text);
    CREATE TABLE enterprise_tax_brackets(id uuid primary key default gen_random_uuid(), enterprise_id uuid, bracket_name text CHECK(bracket_name <> 'FAIL'), min_amount numeric, max_amount numeric, tax_rate numeric, fixed_deduction numeric, tax_type text, bracket_order integer, is_active boolean);
    CREATE FUNCTION admin_has_access_to_enterprise(uuid) RETURNS boolean LANGUAGE sql AS 'select coalesce(current_setting(''audit.allowed'', true), ''yes'') <> ''no''';
    INSERT INTO enterprises VALUES ('${id}','OLD','OLD','Old');
    INSERT INTO enterprise_payroll_contributions(enterprise_id,contribution_code) VALUES('${id}','OLD');
  `)
  await db.exec(sql)
}, 30000)
afterAll(async () => { await db?.close() })
it('installation idempotente sur le schéma de test', async () => { await db.exec(sql) })
it('une erreur après insertion des cotisations restaure strictement les anciennes lignes', async () => {
  const before = (await db.query('select * from enterprise_payroll_contributions')).rows
  await expect(call([{ ...bracket[0], bracket_name: 'FAIL' }])).rejects.toThrow()
  expect((await db.query('select * from enterprise_payroll_contributions')).rows).toEqual(before)
  expect((await db.query('select currency from enterprises')).rows[0].currency).toBe('OLD')
  expect((await db.query('select * from payroll_settings')).rows).toEqual([])
})
it('un remplacement réussi porte sur toutes les tables', async () => {
  await call()
  expect((await db.query('select contribution_code from enterprise_payroll_contributions')).rows).toEqual([{ contribution_code: 'NEW' }])
  expect((await db.query('select currency from enterprises')).rows[0].currency).toBe('XAF')
  expect((await db.query('select custom_tax_rules from payroll_settings')).rows[0].custom_tax_rules).toEqual({})
})
it('un second éditeur ne peut pas écraser un snapshot périmé', async () => {
  await db.query('select paie_enregistrer_regles($1,$2,$3)', [id, '{"a":1}', '{}'])
  await expect(db.query('select paie_enregistrer_regles($1,$2,$3)', [id, '{"b":2}', '{}'])).rejects.toThrow('Conflit')
  expect((await db.query('select custom_tax_rules from payroll_settings')).rows[0].custom_tax_rules).toEqual({ a: 1 })
})
it('un appel sans accès administratif ne modifie rien', async () => {
  await db.exec("SET audit.allowed = 'no'")
  await expect(call()).rejects.toThrow('Accès administratif refusé')
  await db.exec("SET audit.allowed = 'yes'")
  expect((await db.query('select custom_tax_rules from payroll_settings')).rows[0].custom_tax_rules).toEqual({ a: 1 })
})
