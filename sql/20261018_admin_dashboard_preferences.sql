-- Migration optionnelle : sauvegarde multi-appareils de la personnalisation du Dashboard par compte admin
-- (Non exécutée automatiquement ; l'application reste 100 % fonctionnelle via localStorage si cette colonne n'est pas encore présente.)

ALTER TABLE public.admins
ADD COLUMN IF NOT EXISTS dashboard_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.admins.dashboard_preferences IS
  'Préférences de disposition du Dashboard En-Check par périmètre entreprise (widgets, en-tête, actions rapides).';
