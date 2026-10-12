-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ MIGRATION 20261012000001 — SOCLE MOTEUR RADAR & ORDONNANCEUR (v1.1)
-- Chantiers : VD-06 (pg_cron) · VD-12 (Schéma versionné) · VD-20 (Tables Radar)
--             · VD-21 (Ordonnanceur & 1er détecteur absence_non_declaree)
-- Correctifs Revue CEO : B2 (cron.schedule) · B3 (Fuseau entreprise)
--                        · B4 (Politiques RLS) · B5 (search_path & REVOKE PUBLIC)
-- Auteur    : Gardien des fondations (Direction technique En-Check)
-- Date      : 12 octobre 2026
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extension pg_cron (VD-06) ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 2. Table centrale des signaux d'anticipation (VD-20) ──────────────────
CREATE TABLE IF NOT EXISTS public.radar_signals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id      uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  signal_code        text NOT NULL,          -- ex. 'absence_non_declaree'
  family             text NOT NULL CHECK (family IN ('presence', 'charge', 'rh', 'cout')),
  horizon            text NOT NULL CHECK (horizon IN ('now', 'soon', 'month')),
  severity           text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),

  target_type        text,                   -- 'employee' | 'team' | 'site' | 'device' | 'enterprise'
  target_id          uuid,

  title              text NOT NULL,          -- court, lisible sur mobile 360 px
  detail             text,                   -- une phrase d'explication
  recommended_action jsonb NOT NULL,         -- { label, kind, payload } — obligatoire (règle 5.2 n°8)

  detected_at        timestamptz NOT NULL DEFAULT now(),
  valid_until        timestamptz NOT NULL,   -- expiration automatique obligatoire
  status             text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  resolved_at        timestamptz,
  resolved_by        uuid,

  -- Boucle d'apprentissage (VD-34)
  feedback           text CHECK (feedback IS NULL OR feedback IN ('useful', 'noise')),
  feedback_at        timestamptz,

  -- Dédoublonnage déterministe : une seule occurrence ouverte par cible et par code
  dedupe_key         text NOT NULL,

  data               jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Index partiel anti-doublon sur les signaux ouverts
CREATE UNIQUE INDEX IF NOT EXISTS radar_signals_open_dedupe
  ON public.radar_signals (enterprise_id, signal_code, dedupe_key)
  WHERE status = 'open';

-- Index de lecture rapide pour le flux /radar
CREATE INDEX IF NOT EXISTS radar_signals_feed
  ON public.radar_signals (enterprise_id, status, horizon, severity, detected_at DESC);

-- ── 3. Seuils configurables par entreprise (VD-20) ────────────────────────
CREATE TABLE IF NOT EXISTS public.radar_signal_config (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id     uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  signal_code       text NOT NULL,
  enabled           boolean NOT NULL DEFAULT true,
  severity_override text CHECK (severity_override IS NULL OR severity_override IN ('critical', 'warning', 'info')),
  threshold         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Architecture « canal zéro-franc » (Décision D6 v2.1 : push + telegram + email d'abord)
  channels          jsonb NOT NULL DEFAULT '["push", "telegram", "email"]'::jsonb,
  quiet_hours       jsonb NOT NULL DEFAULT '{"from": "20:00", "to": "07:00"}'::jsonb,
  UNIQUE (enterprise_id, signal_code)
);

-- ── 4. Préférences de notification par utilisateur (VD-20) ────────────────
CREATE TABLE IF NOT EXISTS public.radar_user_preferences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type      text NOT NULL CHECK (user_type IN ('admin', 'employee')),
  user_id        uuid NOT NULL,
  -- Inclut 'telegram' conformément à l'arbitrage D6 v2.1 (« canal zéro-franc »)
  channel        text NOT NULL CHECK (channel IN ('push', 'telegram', 'email', 'whatsapp', 'sms')),
  destination    text NOT NULL,
  min_severity   text NOT NULL DEFAULT 'warning' CHECK (min_severity IN ('critical', 'warning', 'info')),
  horizons       jsonb NOT NULL DEFAULT '["now", "soon", "month"]'::jsonb,
  digest_hour    smallint NOT NULL DEFAULT 18 CHECK (digest_hour BETWEEN 0 AND 23),
  enabled        boolean NOT NULL DEFAULT true
);

-- ── 5. Sécurité RLS & Politiques d'accès (Correctif B4 Revue CEO) ─────────
-- POURQUOI : Activer RLS sans CREATE POLICY bloque toute lecture depuis
-- l'interface Web/Mobile. Ces politiques autorisent uniquement les admins
-- authentifiés rattachés à l'entreprise (ou super_admin) à lire et traiter
-- les signaux de leur entreprise.
ALTER TABLE public.radar_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_signal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_user_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.radar_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_signal_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_user_preferences TO authenticated;

DROP POLICY IF EXISTS radar_signals_admin_select ON public.radar_signals;
CREATE POLICY radar_signals_admin_select
  ON public.radar_signals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (
           a.role = 'super_admin'
           OR a.enterprise_id = radar_signals.enterprise_id
           OR EXISTS (
             SELECT 1
               FROM public.admin_entreprises ae
              WHERE ae.admin_id = a.id
                AND ae.enterprise_id = radar_signals.enterprise_id
                AND ae.is_active = true
           )
         )
    )
  );

DROP POLICY IF EXISTS radar_signals_admin_update ON public.radar_signals;
CREATE POLICY radar_signals_admin_update
  ON public.radar_signals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (
           a.role = 'super_admin'
           OR a.enterprise_id = radar_signals.enterprise_id
           OR EXISTS (
             SELECT 1
               FROM public.admin_entreprises ae
              WHERE ae.admin_id = a.id
                AND ae.enterprise_id = radar_signals.enterprise_id
                AND ae.is_active = true
           )
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (
           a.role = 'super_admin'
           OR a.enterprise_id = radar_signals.enterprise_id
           OR EXISTS (
             SELECT 1
               FROM public.admin_entreprises ae
              WHERE ae.admin_id = a.id
                AND ae.enterprise_id = radar_signals.enterprise_id
                AND ae.is_active = true
           )
         )
    )
  );

DROP POLICY IF EXISTS radar_signal_config_admin_all ON public.radar_signal_config;
CREATE POLICY radar_signal_config_admin_all
  ON public.radar_signal_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (
           a.role = 'super_admin'
           OR a.enterprise_id = radar_signal_config.enterprise_id
           OR EXISTS (
             SELECT 1
               FROM public.admin_entreprises ae
              WHERE ae.admin_id = a.id
                AND ae.enterprise_id = radar_signal_config.enterprise_id
                AND ae.is_active = true
           )
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (
           a.role = 'super_admin'
           OR a.enterprise_id = radar_signal_config.enterprise_id
           OR EXISTS (
             SELECT 1
               FROM public.admin_entreprises ae
              WHERE ae.admin_id = a.id
                AND ae.enterprise_id = radar_signal_config.enterprise_id
                AND ae.is_active = true
           )
         )
    )
  );

DROP POLICY IF EXISTS radar_user_preferences_owner_all ON public.radar_user_preferences;
CREATE POLICY radar_user_preferences_owner_all
  ON public.radar_user_preferences
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (a.role = 'super_admin' OR a.id = radar_user_preferences.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.admins a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
         AND a.is_active = true
         AND (a.role = 'super_admin' OR a.id = radar_user_preferences.user_id)
    )
  );

-- ── 6. Expiration automatique des signaux périmés (Correctif B5) ──────────
CREATE OR REPLACE FUNCTION public.radar_expire_stale_signals(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.radar_signals
     SET status = 'resolved',
         resolved_at = p_now
   WHERE status = 'open'
     AND valid_until <= p_now;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 7. 1er Détecteur : absence_non_declaree (VD-21 + Correctifs B3 & B5) ──
-- POURQUOI (Correctif B3 Revue CEO) :
--   Le jour ne doit JAMAIS être découpé en UTC (`p_now AT TIME ZONE 'UTC'`),
--   mais dans le fuseau officiel de l'entreprise (`enterprises.timezone`,
--   ex. 'Africa/Porto-Novo' UTC+1).
--   Exemple : un gardien qui prend son poste à 00h30 à Cotonou le 12/10
--   pointe à 23h30 UTC le 11/10. Avec `AT TIME ZONE v_tz`, `v_today` vaut
--   bien `2026-10-12` et la fenêtre de pointage du jour couvre
--   `[2026-10-11 23:00:00Z, 2026-10-12 23:00:00Z)`.
CREATE OR REPLACE FUNCTION public.radar_detect_absence_non_declaree(
  p_enterprise uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS SETOF public.radar_signals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled       boolean := true;
  v_tz            text := 'UTC';
  v_today         date;
  v_day_start_utc timestamptz;
  v_day_end_utc   timestamptz;
BEGIN
  -- 1. Récupérer le fuseau horaire de l'entreprise (repli 'UTC' si non renseigné)
  SELECT COALESCE(NULLIF(btrim(e.timezone), ''), 'UTC')
    INTO v_tz
    FROM public.enterprises e
   WHERE e.id = p_enterprise;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Calculer la date locale de l'entreprise et ses bornes exactes en UTC
  v_today         := (p_now AT TIME ZONE v_tz)::date;
  v_day_start_utc := (v_today::timestamp AT TIME ZONE v_tz);
  v_day_end_utc   := ((v_today + 1)::timestamp AT TIME ZONE v_tz);

  -- 3. Vérifier si le signal est activé pour cette entreprise
  SELECT c.enabled INTO v_enabled
    FROM public.radar_signal_config c
   WHERE c.enterprise_id = p_enterprise
     AND c.signal_code = 'absence_non_declaree';

  IF v_enabled IS FALSE THEN
    RETURN;
  END IF;

  -- 4. Détecter les employés actifs sans pointage dans la journée locale ni absence déclarée
  RETURN QUERY
  INSERT INTO public.radar_signals (
    enterprise_id,
    signal_code,
    family,
    horizon,
    severity,
    target_type,
    target_id,
    title,
    detail,
    recommended_action,
    detected_at,
    valid_until,
    dedupe_key,
    data
  )
  SELECT
    p_enterprise,
    'absence_non_declaree',
    'presence',
    'now',
    'critical',
    'employee',
    e.id,
    format('Absence non déclarée : %s %s', e.first_name, e.last_name),
    format('Aucun pointage enregistré ce jour (%s, fuseau %s) et aucun congé/absence validé.', to_char(v_today, 'DD/MM/YYYY'), v_tz),
    jsonb_build_object(
      'label', 'Contacter ou déclarer l’absence',
      'kind', 'navigate',
      'payload', jsonb_build_object('route', '/absences', 'employee_id', e.id)
    ),
    p_now,
    v_day_end_utc,
    format('absence_non_declaree:%s:%s', e.id, to_char(v_today, 'YYYY-MM-DD')),
    jsonb_build_object(
      'employee_id', e.id,
      'matricule', e.matricule,
      'date', to_char(v_today, 'YYYY-MM-DD'),
      'timezone', v_tz
    )
  FROM public.employees e
  WHERE e.enterprise_id = p_enterprise
    AND e.is_active = true
    AND NOT EXISTS (
      SELECT 1
        FROM public.attendances a
       WHERE a.employee_id = e.id
         AND a.check_time >= v_day_start_utc
         AND a.check_time < v_day_end_utc
    )
    AND NOT EXISTS (
      SELECT 1
        FROM public.absences ab
       WHERE ab.employee_id = e.id
         AND ab.start_date <= v_today
         AND ab.end_date >= v_today
    )
  ON CONFLICT (enterprise_id, signal_code, dedupe_key) WHERE status = 'open'
  DO NOTHING
  RETURNING *;
END;
$$;

-- ── 8. Ordonnanceur global radar_run_all() (VD-21 + Correctif B5) ─────────
CREATE OR REPLACE FUNCTION public.radar_run_all(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ent record;
  v_total integer := 0;
  v_created integer := 0;
BEGIN
  PERFORM public.radar_expire_stale_signals(p_now);

  FOR v_ent IN
    SELECT id FROM public.enterprises WHERE is_active = true
  LOOP
    SELECT count(*) INTO v_created
      FROM public.radar_detect_absence_non_declaree(v_ent.id, p_now);
    v_total := v_total + COALESCE(v_created, 0);
  END LOOP;

  RETURN v_total;
END;
$$;

-- ── 9. Verrouillage des privilèges d'exécution (Correctif B5 Revue CEO) ───
-- POURQUOI : Empêcher qu'un visiteur anonyme (`anon`) ou un utilisateur
-- connecté ne puisse déclencher les fonctions `SECURITY DEFINER` via l'API
-- REST publique de Supabase. Seuls `postgres` (pg_cron) et `service_role`
-- peuvent exécuter le moteur Radar.
REVOKE ALL ON FUNCTION public.radar_expire_stale_signals(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.radar_detect_absence_non_declaree(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.radar_run_all(timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.radar_expire_stale_signals(timestamptz) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.radar_detect_absence_non_declaree(uuid, timestamptz) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.radar_run_all(timestamptz) TO postgres, service_role;

-- ── 10. Planification pg_cron toutes les 5 minutes (Correctif B2 Revue CEO) ─
-- POURQUOI : Sans `cron.schedule(...)`, le moteur Radar resterait passif.
-- Ce bloc idempotent remplace toute planification précédente de `radar-run-all`
-- et lance `public.radar_run_all()` toutes les 5 minutes côté serveur.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar-run-all') THEN
      PERFORM cron.unschedule('radar-run-all');
    END IF;
    PERFORM cron.schedule(
      'radar-run-all',
      '*/5 * * * *',
      $cron$SELECT public.radar_run_all()$cron$
    );
  END IF;
END;
$$;
