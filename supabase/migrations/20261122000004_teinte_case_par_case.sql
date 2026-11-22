-- ═══════════════════════════════════════════════════════════════════════════════
-- TEINTE CASE PAR CASE — une couleur choisie sur un jour ne peint que ce jour
--
--  Le 22/11/2026, quatre heures après la correction précédente, le fondateur
--  revient avec une capture : deux cases de la même ligne, le même violet, et
--  cette phrase — « chaque case doit avoir sa propre couleur qu'on choisit, et
--  non appliquer la couleur choisie à toutes les cases sur la même ligne ».
--
--  Le reproche est exactement inverse du précédent, et les deux étaient justes.
--  Phase 19-20, il demandait que la teinte choisie DANS LA FENÊTRE DE LA LIGNE
--  habille enfin ses sept jours. Pour y arriver, le code a écrit cette teinte
--  sous une clé unique par collaborateur — et comme la même fenêtre sert AUSSI
--  quand on clique sur UNE case, un clic sur un mardi peignait lundi, mardi,
--  jeudi, vendredi. Une seule adresse pour deux portées : la seconde ne pouvait
--  que déborder sur la première.
--
--  Cette migration donne à la case son PROPRE endroit. Deux portées, deux
--  colonnes, et plus aucune des deux ne peut écrire dans l'autre :
--    · `custom_color`       — la teinte de l'horaire entier, choisie depuis la
--      ligne (déjà en place depuis 20261122000002) ;
--    · `custom_day_colors`  — la carte des teintes choisies jour par jour,
--      `{"2026-11-23": "#7C3AED"}`, où la clé est la date ISO de la case.
--
--  Une carte JSONB et non une ligne par jour : la grille du Planning lit la ligne
--  de l'employé EN UN SEUL aller (`select("*")`), et le nombre de jours colorés
--  par semaine et par collaborateur se compte en unités, pas en milliers. Une
--  table `employee_schedule_days` aurait été plus normalisée et beaucoup plus de
--  machinery pour sept carrés de couleur — ce n'est pas ce que l'écran demande.
--
--  Le format des valeurs est contrait, comme pour `custom_color` : une teinte
--  mal formée dans un `style` en ligne ne peint pas et ne dit rien, et c'est
--  précisément ce silence qui a fait durer ce dossier trois phases. Les clés,
--  elles, ne sont pas contraites — la page peut y loger aussi un repère de
--  semaine récurrente (`day-3`), et une date de congé posée en retard.
--
--  Rien n'est repeint d'office : la colonne est nullable, `NULL` voulant dire
--  « aucun jour n'a choisi », et donc « la ligne décide ».
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.employee_schedules
  ADD COLUMN IF NOT EXISTS custom_day_colors jsonb;

COMMENT ON COLUMN public.employee_schedules.custom_day_colors IS
  'Teintes choisies jour par jour dans le Planning, en carte date ISO vers hexadécimal #rrggbb. NULL ou carte vide = aucun jour n''a choisi, chaque case prend la teinte de l''horaire entier.';

-- Un objet, ou rien. Et s'il y a des valeurs, chacune est un hexa de six chiffres.
ALTER TABLE public.employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_custom_day_colors_chk;
ALTER TABLE public.employee_schedules ADD CONSTRAINT employee_schedules_custom_day_colors_chk
  CHECK (
    custom_day_colors IS NULL
    OR (
      jsonb_typeof(custom_day_colors) = 'object'
      AND NOT jsonb_path_exists(
        custom_day_colors,
        '$.* ? (! (@ like_regex "^#[0-9a-fA-F]{6}$"))'
      )
    )
  );
