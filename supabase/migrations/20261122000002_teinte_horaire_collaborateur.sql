-- ═══════════════════════════════════════════════════════════════════════════════
-- TEINTE DE L'HORAIRE D'UN COLLABORATEUR — la couleur choisie dans la fenêtre
-- devient une donnée de l'entreprise, pas le secret d'un navigateur
--
--  Le 22/11/2026, le fondateur a redemandé trois fois la même chose : « tu n'as
--  pas coloré les cases selon la couleur que j'ai choisi ». Les deux premières
--  fois, la faute était dans la peinture (voyage de la valeur, puis cascade CSS).
--  La troisième investigation a montré un troisième manque, en amont de tout :
--  la teinte d'un horaire entier n'était ÉCRITE NULLE PART. `handleSave-
--  EmployeeSchedule` upsertait `employee_schedules` avec horaires, pause, jours,
--  `is_active` — et la couleur restait dans `localStorage`, sous la clé
--  `encheck_planning_day_overrides_v1`. Un changement de poste, un autre
--  navigateur, un nettoyage de cache, et la semaine entière redevient grise.
--  Une préférence de navigateur ne peut pas être la mémoire d'une entreprise.
--
--  Cette migration ajoute donc l'endroit où la valeur doit vivre. Elle ne
--  décide rien d'autre : ni quelle teinte par défaut, ni qui a le droit de
--  peindre — la palette reste celle de l'application (`ENCHECK_COLOR_PALETTE`,
--  huit teintes feutres, aucune valeur par défaut recopiée dans le code).
--
--  Une colonne NULLABLE, rien de plus. Aucune ligne existante n'est touchée,
--  aucun planning n'est repeint d'office : un collaborateur sans teinte
--  enregistrée garde l'aspect que la grille lui donne aujourd'hui. La
--  contrainte de format n'est pas un ornement — elle empêche une valeur
--  mal formée (`rgb(...)`, un nom de couleur, une chaîne vide venue d'un
--  input effacé) d'entrer dans une propriété CSS en ligne, où elle serait
--  invalide et la case reviendrait grise sans que rien ne le dise.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.employee_schedules
  ADD COLUMN IF NOT EXISTS custom_color text;

COMMENT ON COLUMN public.employee_schedules.custom_color IS
  'Teinte choisie pour l''horaire du collaborateur dans la fenêtre « Ajuster le planning du collaborateur ». Hexadécimal #rrggbb. NULL = aucune teinte enregistrée, la grille garde le papier neutre.';

-- Le format, et rien que le format. NULL est autorisé : c'est l'état de tout
-- ce qui a été enregistré avant cette migration.
ALTER TABLE public.employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_custom_color_chk;
ALTER TABLE public.employee_schedules ADD CONSTRAINT employee_schedules_custom_color_chk
  CHECK (custom_color IS NULL OR custom_color ~ '^#[0-9A-Fa-f]{6}$');
