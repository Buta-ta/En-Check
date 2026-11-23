# Teinte refusée en base : le HTTP 400 muet de la fenêtre de case

Constat du 23/11/2026, et correctif côté écriture. Le présent fichier est une
**fiche de diagnostic** : ce que le fondateur a vu, ce qui a été vérifié sur la
base réelle, ce qui a été changé, et ce qui reste à charge du poste.

## Ce qui a été signalé

> j'essaie de modifier la couleur d'un modèle appliqué à une case mais j'ai eu
> erreur : `Failed to load resource: the server responded with a status of 400 ()`

Deux lignes identiques dans la console, sur l'URL de l'API, avec
`on_conflict=employee_id` — donc sur `employee_schedules`, la table de la ligne
d'horaire d'un collaborateur.

La page, à ce moment-là, répondait `toast.error("Erreur sauvegarde")`. Le code
de l'erreur, lui, partait dans un `console.error` que personne n'ouvre pour un
message de couleur. **C'est ce silence qui est le défaut**, plus que le refus :
la base, elle, avait le droit de refuser une valeur.

## Ce qui a été vérifié, sur le projet réel, en lecture seule

Aucune écriture pendant le diagnostic ; la seule sonde qui touchait la table a
été exécutée dans une transaction volontairement annulée (`raise exception` en
dernière ligne), elle n'a donc rien laissé.

| Constat | Résultat |
| --- | --- |
| colonnes `custom_color` (texte) et `custom_day_colors` (jsonb) | **présentes** sur `employee_schedules` |
| règles de format `employee_schedules_custom_color_chk`, `..._custom_day_colors_chk` | **posées**, telles qu'écrites dans les migrations du 22/11 |
| `UNIQUE (employee_id)` | **présente** — l'`upsert` de la page est donc légitime, la piste « pas de clé de fusion » (PGRST204) est fermée |
| valeurs déjà stockées hors format | **aucune** (0 teinte de ligne et 0 teinte de case hors `#rrggbb`, 0 carte qui ne soit pas un objet, sur 16 lignes) |
| droits | **aucun rôle personnalisé créé** sur ce projet (`admin_permission_roles` = 0) : les politiques `encheck_custom_*` renvoient vrai. Les deux politiques qui comptent vraiment, `encheck_mfa_obligation` et `encheck_admin_session_restrictive`, filtrent aussi la LECTURE — or l'écran lit les horaires : elles laissent passer cette session, et le 400 n'est pas un droit |
| dernière écriture | Hippo BIYOKILA (ENN-0002) : `custom_color = #7C3AED`, `custom_day_colors = {"2026-11-23": #10B981}`, `updated_at` du 23/11 — **une écriture de teinte est bien passée** |

Deux choses en découlent, et elles orientent le correctif :

1. **le chemin d'écriture est structurellement bon** — colonnes, contraintes,
   clé de fusion, droits. Un 400 persistant ne peut venir que d'une **valeur**.
2. **le 400 est arrivé au moins une fois et pas tout le temps** — il dépend
   donc de ce que la fenêtre tenait dans ses champs au moment d'enregistrer,
   pas de la table.

Ce que la fenêtre « Ajuster le planning » peut tenir sans le contrôler, et qui
partait tel quel :

* `employeeScheduleForm.custom_color` n'est pas seulement la pastille cliquée :
  il est **replié** au-dessus du brouillon local de ce navigateur
  (`encheck_planning_day_overrides_v1`), écrit par les versions d'avant le
  22/11. Une valeur de brouillon peut être un `rgba(…)` de lavage, un nom, un
  raccourci à trois chiffres — pas un `#rrggbb`, et le CHECK le dit en 400.
* les quatre heures étaient concaténées à `":00"` **sans contrôle** : un champ
  vidé à la main envoyait littéralement `":00"`, que la colonne `time` rejette
  en 22007 — donc en 400.
* la carte des teintes par jour était étendue à l'aveugle. Si `custom_day_colors`
  n'est pas un objet (valeur posée à la main dans l'éditeur SQL), `{..."abc"}`
  fabrique des clés `"0"`, `"1"`, `"2"` — et c'est encore le CHECK qui parle.

Une divergence annexe, relevée au passage : `supabase_migrations.schema_migrations`
s'arrête à `20261111231821 dashboard_synthese_bornes_definer`, alors que les
colonnes des migrations du 22/11 existent. Elles ont donc été appliquées **à la
main dans l'éditeur**, sans entrer dans l'historique. Ce n'est pas la cause du
400 (les deux migrations sont `ADD COLUMN IF NOT EXISTS`, donc un `db push` ne
casse rien), mais c'est un écart entre le dépôt et le projet, à combler un jour
ou à assumer explicitement.

## Ce qui a été changé

`src/services/ecritureHorairesEmploye.js` (nouveau, fonctions pures, testables
sans navigateur) :

* `normaliserTeinte` — accepte `#rrggbb`, étend `#rgb`, **signale** une teinte à
  huit chiffres (transparence) et la reprend pleine ; toute autre valeur est
  refusée et retombe sur la première teinte de la palette, **en le disant**. Un
  refus sec aurait été pire : le fondateur ne pourrait plus réparer son propre
  brouillon depuis cette fenêtre.
* `normaliserHeure` — remet `HH:MM` en `HH:MM:00`, borne à une journée réelle,
  se replie sur l'heure attendue si la valeur est lisible mais fausse. Une heure
  **obligatoire laissée vide** est le seul cas bloquant : il n'y a rien à
  inventer, et le message nomme le champ (« Fin de journée est vide… »).
* `carteDeTeintes` — ne fusionne que ce qui est un objet, et **relit chaque teinte
  de chaque jour** : une entrée mal formée est retirée de la carte au lieu d'être
  rapportée. C'est le deuxième volet du signalement du 23/11 — une teinte saisie à
  la main un jour *précédent* condamnait l'enregistrement du jour qu'on peignait,
  sans que le 400 nomme jamais le vrai fautif. La case retrouve alors son état
  d'avant tout choix, et une notification le dit (`1 couleur saisie à la main sur un
  autre jour a été retirée`) : retirer n'est pas anodin, donc ce n'est jamais silencieux.
* Le dépôt d'un modèle (`persistEmployeeShiftToSupabase`) passe ses quatre heures par
  le même contrôle que l'éditeur, via `heureDeposee` — un modèle plus vieux que la
  contrainte ne doit pas faire échouer la case qui l'accueille.
* `causeRejetBase` — liste blanche de codes (`23514`, `22007`, `22P02`, `23502`,
  `42703`, `23503`, `23505`, `42501`, `PGRST400/204/202/116`), contraintes de
  format nommées, colonne absente traduite **en fichier de migration à
  appliquer**. Rien du message brut du fournisseur n'est recopié à l'écran :
  même règle que `adminMfaErrors` pour l'authentification, pour la même raison.

Câblage dans `src/pages/Planning.jsx` :

* la fenêtre de la case (et de la ligne) passe par ces quatre fonctions avant
  `upsert` ;
* son `catch` affiche `causeRejetBase(error)` à la place de « Erreur sauvegarde » ;
* `persistEmployeeShiftToSupabase`, le dépôt d'un modèle, **n'avale plus son
  erreur** : la brique reste posée à l'écran (c'est le geste du fondateur), mais
  le message dit maintenant qu'elle n'est pas en base, et pourquoi. Cet
  `console.warn` silencieux est la raison pour laquelle un enregistrement raté
  a pu passer inaperçu ;
* idem pour le retrait d'une teinte de case et pour l'approbation d'une demande,
  qui écrivent dans la même table.

Un trou reconnu le soir même, dans la foulée du premier déploiement : la page
`handleRetirerTeinteDeLaCase` étendait encore `custom_day_colors` à l'aveugle. Le
message de refus, lui, était bien branché — mais le bouton qui **efface** une
couleur renvoyait la carte telle quelle en base, et se trouvait donc refusé par
le CHECK à cause d'une teinte illisible dormant sur un autre jour. Un retrait
bloqué par une faute que le retrait ne touche pas, c'est exactement la panne
signalée, version inverse. Il passe désormais par `carteDeTeintes`, et la teinte
de la ligne qu'il remet dans le formulaire est relue par `normaliserTeinte`.

Contrats : `ecritureHorairesEmploye.test.js` (21 tests de format et de traduction),
contrat 40 de `cablagePlanningEnCheck.test.js` (la page doit passer par le
service, plus de concaténation d'heure brute, plus d'extension à l'aveugle, plus
de toast muet). Les contrats 6bis et 6quater ont suivi l'écriture — même
garantie, plus la garde sur la carte des jours.

## Ce qui reste à charge du poste

La cause exacte de **ce** 400-là n'a pas été observée : l'objet d'erreur est
resté dans la console du navigateur du fondateur, et le seul témoin transmis
était le statut. Deux chemins pour le fermer :

1. rejouer le geste, et recopier l'objet en face du message (il porte `code`,
   `details`, `hint`) — depuis ce chantier, la phrase à l'écran cite le même
   code, ce qui suffit souvent ;
2. ou coller `supabase/outils-sql/20261123_diagnostic_teinte_horaire_refusee.sql`
   dans Supabase → SQL Editor → Run : six constats numérotés, lecture seule,
   qui départagent format / colonne absente / clé de fusion / droit, et disent
   si un `updated_at` récent contredit l'échec (auquel cas le 400 vient d'une
   autre écriture de la page).

Non vérifié, comme toujours dans ce dépôt : **le rendu dans un navigateur**. Le
contrôle de format et les messages sont éprouvés par les tests ; ce qu'ils
deviennent à l'écran (placement du toast, libellé du champ cité) ne se juge
qu'à l'œil.

Deux choses à ne pas imputer à ce correctif, si vous lancez la suite complète :
**sept fichiers de test** (`centreActionNotifications`, `feriesMajoration`,
`motifsAbsencePersonnalises`, `motifsParEntreprise`, `payrollSettingsEcrivainUnique`,
`reparationsMuettes`, `sortieManquante`) échouent **à la collecte** parce qu'ils
importent `src/lib/supabase.js`, qui exige un `.env` renseigné — c'est vrai avant
comme après. Le service ajouté ici est délibérément **pur, zéro import** : ses tests
tournent aussi hors connexion. Trois erreurs `eslint` sont également antérieures
(`eCorbeille` non utilisé dans `Planning.jsx`, deux échappements superflus dans le
test de câblage) ; aucune n'est introduite ici.

## Connu, laissé ouvert à dessein

* `handleRetirerTeinteDeLaCase` écrit avec
  `update(...).eq("employee_id", …)` : si le collaborateur n'a **aucune** ligne
  dans `employee_schedules`, la requête ne rapporte aucune ligne, ne dit rien,
  et le retrait reste visible jusqu'au rechargement. Ce n'est pas le 400 signalé
  (une écriture qui ne correspond à rien n'est pas un refus), et le corriger
  veut dire décider si « retirer » doit créer une ligne à `NULL`. À trancher.
* Les trois sites `upsert(..., { onConflict: "employee_id" })` supposent « une
  ligne par collaborateur », alors que la table porte `valide_du` / `valide_au`,
  c'est-à-dire un historique. La contrainte unique est là et l'`upsert`
  fonctionne — vérifiée : `employee_schedules_employee_id_key`, sur `employee_id`
  **seul**, `custom_color` et `custom_day_colors` en colonnes ordinaires nulles ;
  mais le modèle de données dit autre chose que la contrainte.
* Les heures de `work_schedules` (l'enregistrement du modèle lui-même) gardent leur
  `+ ":00"` d'origine, sans `normaliserHeure` : la colonne est en `time`, un
  `HH:MM:00` construit à la main est déjà conforme, et le signalement ne parle pas
  de ce chemin. Je n'ai pas élargi la surface modifiée pour y mettre une garde dont
  personne n'a besoin aujourd'hui.
