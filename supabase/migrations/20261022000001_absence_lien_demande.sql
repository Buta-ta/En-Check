-- ═══════════════════════════════════════════════════════════
-- 🔗 DEMANDE APPROUVÉE ↔ ABSENCE CRÉÉE
--
-- Approuver une demande de congé crée une ligne dans `absences`.
-- Sans lien explicite, supprimer la demande laissait le congé
-- vivre sa vie dans le planning. On garde donc la référence :
-- supprimer la demande supprime SES absences, et rien d'autre.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS leave_request_id uuid
  REFERENCES public.leave_requests (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS absences_leave_request_id_idx
  ON public.absences (leave_request_id);
