# Synthèse pour l'arbitre — exécution de l'arbitrage n°1

Dépôt **En-Check** (admin), PR #5 : <https://github.com/Buta-ta/En-Check/pull/5>
Branche `arena/12c7494d-en-check` (premier commit livrable : `becaf9c`).
Livrable SQL copié dans ce dossier : `20261016000001_fondations_auto_close_structure.sql`.

## Ce que l'arbitrage demandait, et où ça atterrit

| Décision §4-§5 | Fait | Où le voir |
|---|---|---|
| `method='auto_close'` en dur, pas de GPS recopié | oui | `encheck_cloturer_pivotable`, `calculerMinutesJs` |
| N1 horaire personnel **explicite** | oui | niveau 1 de la cascade |
| N2 apprentissage comportemental (hook, corps vide, contrat §5 dans le SQL) | oui — **propriété IA DEV 1** | `encheck_estimer_sortie_comportementale` |
| N3 grille par défaut · N4 `auto_close_time` · N5 entrée+8 h | oui, avec plafond | idem |
| Plafond 12 h (au lieu de 14), jamais > 30 min après la médiane | oui | `plafond_invention_heures`, `plafond_apres_mediane_minutes` |
| « ⏳ présumée », exclue de la paie tant que non validée | oui | `filtrerPointagesPayables` + `payrollService` + `Rapports.jsx` |
| Réconciliation : vraie sortie ⇒ estimation **remplacée**, jamais supprimée | oui | trigger + `encheck_estimation_remplacer` |
| Nudge PUSH à +20 min | oui | `nudge_sortie_minutes` |
| 2 semaines en **mode ombre** | oui — **défaut à l'application** | `mode_estimation = '"ombre"'` |
| Cron 1×/jour pour J-1, moteur inatteignable depuis le navigateur | oui | 04:30 WAT ; `encheck_pipeline_cloture` n'a **aucune** GRANT navigateur, et `encheck_alertes_scan` (léger, celui que l'app appelait déjà) refuse un non-admin de l'entreprise — l'appel sans JWT du cron reste autorisé |
| Export des fonctions non versionnées + carte des fonctions | oui | `exporter-fonctions-prod-only.sql` ; `public.encheck_carte_fonctions` |
| Seuil unique et lisible | oui | `encheck_reglages_pointage`, `encheck_seuil()` |

Les cinq anomalies signalées en sortie de backtest sont traitées : grille fantôme
(sans `COALESCE(entreprise_id, 1)` : `trouvee=false` au lieu de deviner), `check_type`
en dur sur les lignes estimées, `grille_travail_id` qui ne prouvait rien, `12 h` vs `14 h`,
et l'absence de marqueur « inventé » → maintenant 5 colonnes traçables + le niveau d'origine.
`encheck_signaux_*` : aucune migration écrite sans diagnostic (aucun appelant de la vue n'a
été trouvé dans les dépôts) — à confirmer avec DEV 1.

## Les trois points qui attendent ta validation

1. **Grille explicitement liée à l'employé = Niveau 1** (avec l'horaire personnel) ; seule la
   grille **par défaut** descend en Niveau 3. Sinon le Niveau 2 ne s'exécuterait pour ainsi
   dire jamais, ce qui était le trou n°1 du diagnostic.
2. **Marqueur de journée non payée** = `is_auto_closed = true AND estimation_validee_le IS NULL`,
   et non un drapeau neuf (le mobile et les pages connaissent déjà ces colonnes). Affichage :
   `anomalie='sortie_presumee'`.
3. **Fonctions dangereuses rendues inoffensives, pas supprimées** (`encheck_nettoyer_rebonds_qr`
   marque au lieu de `DELETE` ; `encheck_assainir_alertes_horaires` idem ; purge d'alertes =
   entreprise obligatoire + snapshot avant suppression, plus jamais de match par nom de titre).

## Ce que je demande avant d'activer

Un tour dans l'éditeur SQL Supabase avec `supabase/outils-sql/exporter-fonctions-prod-only.sql` :
`encheck_punch`, `replace_attendance_day`, `encheck_alertes_controler_interne`,
`encheck_signaux_controler` n'existent **dans aucun dépôt**. Elles ne sont pas touchées par
cette migration, mais elles ne sont pas versionnées non plus — une prochaine migration
`CREATE OR REPLACE` les écraserait sans que personne puisse relire l'originale.

## Seuil d'activation proposé (entreprise par entreprise)

Après 2 semaines d'ombre, `SELECT * FROM public.encheck_clotures_statistiques(NULL, 45);`
→ passer en `'"actif"'` seulement si **couverture ≥ 60 %** ET **écart médian ≤ 15 min**
ET **≥ 80 % des écarts ≤ 30 min**. Tant que ce n'est pas vrai : `mode_estimation`
vaut `'"ombre"'`, donc **zéro heure inventée dans `attendances` et zéro euro concerné**.

## Comment vérifier par soi-même

* Migration jouée **deux fois** sur Postgres 16 local + **25 contrôles** de fumée
  → tout est `ok`, zéro échec : `supabase/outils-sql/test-execution-migration.sql` (+ le squelette
  pour rejouer chez soi).
* L'exécution a sorti **4 bugs réels** qu'aucune relecture ni aucun parseur n'avaient vus
  (colonne mal aliasée dans la cascade, `round(double precision, integer)` dans les
  statistiques du mode ombre, cast `text[]`→`integer[]` sur `work_days`, idempotence des
  rebonds qui re-journalisait chaque nuit). Les 4 corrections sont dans le fichier du dépôt.
* App : **67/67** tests vitest (7 fichiers), dont 28 cas sur la doctrine, 4 sur la chaîne de
  requête PostgREST et 17 sur le câblage des composants de pointage.

## Dette assumée et signalée

`src/pages/Rapports.jsx` contient une copie conforme de
`PayrollService.calculateWorkedMinutesByDay`. Le filtre de doctrine est appliqué **aux deux**
(sinon le rapport et le bulletin racontent deux histoires différentes), mais le doublon n'est
pas supprimé ici : un nettoyage de 600 lignes ne doit pas voyager avec un correctif de paie.
À faire dans une PR dédiée, qui remplacera la copie par l'appel du service.

---

## Soir du 16/10 — deux crashes de mise en service, et ce qu'ils nous apprennent

La migration est appliquée en production (vérifié par la carte des fonctions : 10 lignes,
dont les 4 nouvelles). Deux pannes ont suivi dans la foulée. Elles n'ont **rien** à voir avec
le SQL : aucune des deux ne se répare par un fichier à coller.

**1° `HTTP 400 / PGRST100`** — le `select()` de la page Pointages contenait un commentaire
`//` **à l'intérieur** d'une chaîne de requête PostgREST. En JS, un `//` dans une chaîne n'est
pas un commentaire : c'est du texte, envoyé tel quel. Corrigé dans la PR #6, plus un garde-fou
(`src/services/__tests__/chaineRequetePostgrest.test.js`) qui scanne tout `src/` à la recherche
de commentaires, parenthèses déséquilibrées et backticks orphelins dans une chaîne de requête.

**2° `ReferenceError: canEditPointages is not defined`** — page entièrement blanche. La carte
d'un pointage lisait l'état du composant parent et deux props que personne ne lui passait.
Cinq identifiants libres, un throw au rendu. La page ne plantait pas avant **parce qu'elle
ne s'affichait pas du tout** : le 400 faisait échouer le chargement avant la rendu — réparer
l'un a découvert l'autre.

Le détecteur existait : `npm run lint` (eslint 9, `no-undef: error`) voyait les cinq erreurs,
mais `.github/workflows/ci.yml` — dont le job s'appelait « Tests financiers, **Lint** &
Build » — n'exécutait aucun step de lint. Corrigé par `eslint.gate.config.js` : une porte
réduite aux règles qui décrivent un crash (`no-undef`, `react-hooks/rules-of-hooks`,
doublons de clés/membres, assignations illégales), parce que le dépôt traîne ~367 remarques
stylistiques et qu'une porte rouge le premier jour est une porte qu'on éteint. `vite build`
est passé au-dessus des deux bugs : Rollup ne vérifie pas la portée des identifiants.

Et comme eslint ne peut pas voir une prop oubliée par le parent (le nom reste défini ailleurs,
le composant rend avec `undefined`, les boutons disparaissent **en silence**), un second garde-fou
compare les signatures des composants aux props réellement écrites sur leurs sites d'appel :
`src/services/__tests__/cablagePointageCard.test.js` — vérifié rouge sur le code d'avant le
correctif (8 échecs qui nomment l'oubli), vert après.

## Trois points à arbitrer (je ne tranche pas)

1. **Historique `is_auto_closed`**. La migration ne remplit pas `estimation_validee_le` :
   toute sortie automatique antérieure au 16/10 est donc « présumée, non validée », et
   `filtrerPointagesPayables` l'exclut — des bulletins déjà édités peuvent **diminuer**.
   Deux issues, et elles s'écrivent toutes les deux dans des colonnes qui existent déjà :
   * **valider l'historique en masse** — `UPDATE attendances SET estimation_validee_le = now(),
     estimation_detail = estimation_detail || '{"validation":"massee-2026-10-16"}'::jsonb
     WHERE …` : on écrit une validation, on ne la simule pas, et l'index partiel de la
     migration (l.86) fait que ces lignes sortent du champ de scan. C'est le choix à retenir
     si des bulletins déjà payés ne doivent pas bouger et qu'on assume de tracer une
     validation « de régularisation » ;
   * **ou** borner le filtre de `filtrerPointagesPayables` à `check_time >= '2026-10-16'`
     côté app (aucun SQL) : on ne réécrit rien de payé, les anciennes sorties présumées
     restent comptées comme avant, au prix d'une règle datée à maintenir. Faisable sans
     toucher aux requêtes : `payrollService` sélectionne `*` sur `attendances` (l.760) et
     filtre déjà sur `check_time` (l.762), donc la date est dans les lignes.
     **Mon choix par défaut.**
   Mesurer d'abord :
   ```sql
   SELECT count(*) AS lignes, min(check_time)::date AS plus_ancienne, max(check_time)::date AS plus_recente
     FROM public.attendances WHERE is_auto_closed = true AND estimation_validee_le IS NULL;
   ```
2. **Le Niveau 2 ne tournera jamais en production** dans sa forme actuelle. La cascade
   s'arrête au premier étage qui répond, et les 14 salariés contrôlés ont tous une grille
   (12 liée, 2 personnalisées) : l'estimation par horaires ne sera jamais consultée. Le seuil
   d'activation « couverture ≥ 60 % » serait donc atteint **sans rien mesurer**.
   Option : double lecture en ombre, c'est-à-dire calculer le Niveau 2 même quand le
   Niveau 1 a répondu, et consigner le résultat **sans jamais toucher `attendances`**.
   Attention à un détail de structure qui rend l'option moins gratuite qu'elle n'en a l'air :
   `encheck_clotures_estimees` a une contrainte `UNIQUE (attendance_in_id)` — une seule ligne
   par pointage. On ne peut donc pas « ajouter » une ligne de comparaison ; il faut soit
   loger le second niveau dans le `detail` jsonb de la ligne existante (aucune migration),
   soit relâcher la contrainte (une migration de plus, et le `motif_rejet`/`applique=false`
   deviendraient ambiguïts). Je préfère la première, quitte à ce que la comparaison soit moins
   confortable à requêter. Coût dans les deux cas : un étage de calcul de plus par scan.
3. **`src/services/pushNotificationService.js` déclare `subscribe()` deux fois** (l.38 avec
   try/catch et contrôle de permission, l.101 avec contrôle des clés) : la seconde écrase la
   première, et personne ne l'avait vu. Même famille de bug qu'un monkey-patch SQL. Ce n'est
   pas le périmètre de la PR ; la porte de lint contient une exception nommée et datée pour ce
   seul fichier, à lever dès que le doublon est supprimé. Qui tranche : DEV 1 (push), ou moi
   sur ordre.

