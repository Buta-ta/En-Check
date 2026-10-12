// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTS UNITAIRES — Socle SQL Radar & Correctifs Revue CEO (B2, B3, B4, B5)
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   Vérifie automatiquement les 4 exigences techniques de la Revue CEO sur le
//   socle Radar (`supabase/migrations/20261012000001_radar_foundation.sql`)
//   et la logique de découpage horaire par fuseau d'entreprise :
//     • B2 : Planification effective `cron.schedule('radar-run-all', '*/5 * * * *', ...)`
//     • B3 : Découpage de journée dans le fuseau de l'entreprise (`Africa/Porto-Novo`
//            UTC+1) et test du cas critique de 00h30 locale (= 23h30 UTC la veille)
//     • B4 : Politiques RLS (`CREATE POLICY`) présentes sur les 3 tables Radar
//     • B5 : `SET search_path = public, pg_temp` + `REVOKE ALL ... FROM PUBLIC, anon, authenticated`
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { jourLocal, minutesDepuisMinuit } from '../../utils/timezoneUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20261012000001_radar_foundation.sql'
)

describe('Socle Radar & Correctifs Revue CEO (B2, B3, B4, B5)', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')

  it('B2 — planifie effectivement radar_run_all() toutes les 5 minutes via cron.schedule', () => {
    expect(sql).toContain('cron.schedule(')
    expect(sql).toContain("'radar-run-all'")
    expect(sql).toContain("'*/5 * * * *'")
    expect(sql).toContain('SELECT public.radar_run_all()')
  })

  it('B3 — découpe la journée à 00h30 heure locale de Cotonou (23h30 UTC la veille) sur le bon jour', () => {
    // Exemple exact de la Revue CEO :
    // Un gardien prend son poste le 12 octobre 2026 à 00h30 à Cotonou (UTC+1).
    // L'instant UTC correspondant est le 11 octobre 2026 à 23h30 UTC.
    const instantMinuitTrenteCotonou = '2026-10-11T23:30:00.000Z'

    // En UTC pur, ce serait le 2026-10-11 (FAUX pour Cotonou).
    // Dans le fuseau de l'entreprise (Africa/Porto-Novo), c'est bien le 2026-10-12 à 00h30 (30 min depuis minuit).
    expect(jourLocal(instantMinuitTrenteCotonou, 'UTC')).toBe('2026-10-11')
    expect(jourLocal(instantMinuitTrenteCotonou, 'Africa/Porto-Novo')).toBe('2026-10-12')
    expect(minutesDepuisMinuit(instantMinuitTrenteCotonou, 'Africa/Porto-Novo')).toBe(30)

    // Vérifie que la migration SQL n'utilise plus `(p_now AT TIME ZONE 'UTC')::date`
    // mais bien le fuseau de l'entreprise `(p_now AT TIME ZONE v_tz)::date`
    expect(sql).not.toContain("(p_now AT TIME ZONE 'UTC')::date")
    expect(sql).toContain('(p_now AT TIME ZONE v_tz)::date')
    expect(sql).toContain('v_day_start_utc := (v_today::timestamp AT TIME ZONE v_tz)')
    expect(sql).toContain('v_day_end_utc   := ((v_today + 1)::timestamp AT TIME ZONE v_tz)')
  })

  it('B4 — définit des politiques RLS (CREATE POLICY) sur les 3 tables Radar', () => {
    expect(sql).toContain('CREATE POLICY radar_signals_admin_select')
    expect(sql).toContain('CREATE POLICY radar_signals_admin_update')
    expect(sql).toContain('CREATE POLICY radar_signal_config_admin_all')
    expect(sql).toContain('CREATE POLICY radar_user_preferences_owner_all')
  })

  it('B5 — verrouille search_path et interdit à un visiteur anonyme (PUBLIC / anon) d’appeler les fonctions privilégiées', () => {
    // 1. Toutes les fonctions SECURITY DEFINER doivent fixer leur search_path
    const securityDefinerCount = (sql.match(/^\s*SECURITY DEFINER\s*$/gm) || []).length
    const searchPathCount = (sql.match(/^\s*SET search_path = public, pg_temp\s*$/gm) || []).length
    expect(securityDefinerCount).toBe(3)
    expect(searchPathCount).toBe(3)

    // 2. Révocation explicite de PUBLIC, anon et authenticated sur les 3 fonctions
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.radar_expire_stale_signals(timestamptz) FROM PUBLIC, anon, authenticated;'
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.radar_detect_absence_non_declaree(uuid, timestamptz) FROM PUBLIC, anon, authenticated;'
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.radar_run_all(timestamptz) FROM PUBLIC, anon, authenticated;'
    )
  })
})
