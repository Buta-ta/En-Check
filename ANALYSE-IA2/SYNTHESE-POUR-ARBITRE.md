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

Un tour dans l'éditeur SQL Supabase avec `ANALYSE-IA2/exporter-fonctions-prod-only.sql` :
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

* Migration jouée **deux fois** sur Postgres 16 local + **26 contrôles** de fumée
  → tout est `ok`, zéro échec : `ANALYSE-IA2/test-execution-migration.sql` (+ le squelette
  pour rejouer chez soi).
* L'exécution a sorti **4 bugs réels** qu'aucune relecture ni aucun parseur n'avaient vus
  (colonne mal aliasée dans la cascade, `round(double precision, integer)` dans les
  statistiques du mode ombre, cast `text[]`→`integer[]` sur `work_days`, idempotence des
  rebonds qui re-journalisait chaque nuit). Les 4 corrections sont dans le fichier du dépôt.
* App : **50/50** tests vitest, dont 28 nouveaux cas sur la doctrine.

## Dette assumée et signalée

`src/pages/Rapports.jsx` contient une copie conforme de
`PayrollService.calculateWorkedMinutesByDay`. Le filtre de doctrine est appliqué **aux deux**
(sinon le rapport et le bulletin racontent deux histoires différentes), mais le doublon n'est
pas supprimé ici : un nettoyage de 600 lignes ne doit pas voyager avec un correctif de paie.
À faire dans une PR dédiée, qui remplacera la copie par l'appel du service.
