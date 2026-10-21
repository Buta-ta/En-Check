-- ═══════════════════════════════════════════════════════════════════════════
-- 20261021000004 — MOTIFS D'ABSENCE PERSONNALISABLES
-- ═══════════════════════════════════════════════════════════════════════════
--  Demande : « créer les motifs, supprimer ou modifier les motifs qui
--  existent déjà, personnaliser les couleurs, les émojis etc ».
--
--  Doctrine En-Check : un motif n'est JAMAIS effacé physiquement. Il est
--  ARCHIVÉ (archive_le) et RESTAURABLE depuis la corbeille, comme les pauses.
--  Une absence qui référence un motif archivé continue de s'afficher avec
--  ses couleurs d'origine : rien ne disparaît de l'écran d'un utilisateur.
--
--  Portée :
--    · enterprise_id NULL → motif GLOBAL (les 7 motifs d'origine, is_system)
--    · enterprise_id XX   → motif propre à une entreprise
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.absence_motifs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id  uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,
  code           text        NOT NULL,
  label          text        NOT NULL,
  emoji          text        NOT NULL DEFAULT '📋',
  color          text        NOT NULL DEFAULT '#9CA3AF',
  bg             text,
  ordre          integer     NOT NULL DEFAULT 0,
  is_system      boolean     NOT NULL DEFAULT false,
  archive_le     timestamptz,
  cree_le        timestamptz NOT NULL DEFAULT now(),
  maj_le         timestamptz NOT NULL DEFAULT now(),
  cree_par       uuid
);

COMMENT ON TABLE public.absence_motifs IS
  'Motifs d''absence personnalisables. enterprise_id NULL = motif global ; is_system = true = motif d''origine non supprimable.';

CREATE INDEX IF NOT EXISTS absence_motifs_entreprise_idx
  ON public.absence_motifs (enterprise_id);

CREATE INDEX IF NOT EXISTS absence_motifs_archive_idx
  ON public.absence_motifs (archive_le) WHERE archive_le IS NOT NULL;

-- Unicité du code par portée, hors archives
CREATE UNIQUE INDEX IF NOT EXISTS absence_motifs_code_global_uniq
  ON public.absence_motifs (code) WHERE enterprise_id IS NULL AND archive_le IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS absence_motifs_code_entreprise_uniq
  ON public.absence_motifs (enterprise_id, code) WHERE enterprise_id IS NOT NULL AND archive_le IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SÉCURITÉ : mêmes règles que la table `absences`
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.absence_motifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absence_motifs_admins_full_access" ON public.absence_motifs;
CREATE POLICY "absence_motifs_admins_full_access" ON public.absence_motifs
  FOR ALL
  USING (admin_has_access_to_enterprise(enterprise_id))
  WITH CHECK (admin_has_access_to_enterprise(enterprise_id));

DROP POLICY IF EXISTS "absence_motifs_lecture_globale" ON public.absence_motifs;
CREATE POLICY "absence_motifs_lecture_globale" ON public.absence_motifs
  FOR SELECT USING (enterprise_id IS NULL AND archive_le IS NULL);

DROP POLICY IF EXISTS "absence_motifs_lecture_employes" ON public.absence_motifs;
CREATE POLICY "absence_motifs_lecture_employes" ON public.absence_motifs
  FOR SELECT USING (
    archive_le IS NULL
    AND enterprise_id = (SELECT enterprise_id FROM get_current_employee())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- LES 7 MOTIFS D'ORIGINE — reprise à l'identique des couleurs actuelles
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.absence_motifs (enterprise_id, code, label, emoji, color, bg, ordre, is_system)
SELECT NULL, v.code, v.label, v.emoji, v.color, v.bg, v.ordre, true
FROM (VALUES
  ('conge',      'Congé payé',          '🌴', '#10B981', 'rgba(16,185,129,0.15)',   1),
  ('maladie',    'Maladie',             '🏥', '#F59E0B', 'rgba(245,158,11,0.15)',   2),
  ('maternite',  'Maternité/Paternité', '👶', '#8B5CF6', 'rgba(139,92,246,0.15)',   3),
  ('injustifie', 'Absence injustifiée', '⚠️', '#EF4444', 'rgba(239,68,68,0.15)',    4),
  ('formation',  'Formation',           '📚', '#3B82F6', 'rgba(59,130,246,0.15)',   5),
  ('deces',      'Décès/Deuil',         '🕊️', '#6B7280', 'rgba(107,114,128,0.15)',  6),
  ('autre',      'Autre',               '📋', '#9CA3AF', 'rgba(156,163,175,0.15)',  7)
) AS v(code, label, emoji, color, bg, ordre)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- GARDE-FOU : combien d'absences utilisent ce motif ?
-- L'archivage reste possible, mais l'interface prévient avant.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encheck_absence_motifs_usages(p_code text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int
    FROM public.absences a
   WHERE a.reason = p_code
     AND admin_has_access_to_enterprise(a.enterprise_id)
$$;
