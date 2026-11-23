# En-Check Admin — Inventaire des algorithmes et chantiers d'anticipation

**Objet :** dire ce qui existe déjà, ce qui tient, ce qui ment, ce qui manque — puis
proposer les systèmes à renforcer et à créer pour qu'En-Check *anticipe* au lieu de
constater.

**Date :** 24 octobre 2026 · **Branche examinée :** `arena/2db2e15e-en-check` (HEAD `6c8c3d6`, merge de la PR #283).

**Version 3** — deux revues par l'**IA Arbitre 1** (voir §12, « Ce qui a changé entre la
v1 et la v3 »). Les conclusions de fond sont inchangées ; le **prix**, l'**ordre**, deux
**qualifications de risque** et **une affirmation fausse de ma part** (la charte, §7.2)
le sont.

> **Règle que ce document s'impose à lui-même :** aucune affirmation — de présence *ou
> d'absence* — sans sa méthode de vérification. Une affirmation d'absence exige une
> recherche exhaustive, pas deux dossiers ouverts.

**Méthode :** lecture du dépôt, pas d'opinion. Chaque volume ci-dessous annonce **sa
commande de comptage**, parce qu'un chiffre sans méthode est une opinion déguisée.

| Élément | Volume constaté | Comment il est compté |
| --- | --- | --- |
| Migrations SQL | 46 | `ls supabase/migrations/*.sql` |
| Fonctions RPC `public.*` | **88 dans le dépôt** — et **au moins 93 en base** | `CREATE OR REPLACE FUNCTION public.*` distincts dans les migrations. Les fonctions « producteur » (voir C1) ne sont pas dans le dépôt : **le compte réel est inconnaissable depuis ici** |
| Services applicatifs | 50 | `ls src/services/*.js` |
| Composants | 122 | `ls src/components/*.jsx` |
| Pages | **42** | `find src/pages -name "*.jsx"` — **récursif** (`src/pages/employee/` compris). La v1 annonçait 35 avec un glob non récursif : erreur corrigée |
| Hooks | **18** | `ls src/hooks` (trois hooks sont en `.jsx`, invisibles dans un `ls *.js`) |
| Utilitaires | **17** | `ls src/utils` |
| Tests | 149 fichiers, ≈ 1 977 cas | `find src -name "*.test.*"` + comptage des `it(` / `test(` |

> **Leçon de la v1 :** le compte de 88 fonctions est en lui-même la démonstration du
> constat **C1** — le nombre exact de fonctions en production est *inconnaissable depuis
> le dépôt*. Un volume qui ne dit pas d'où il vient fabrique de la fausse autorité.

Ce document ne propose **aucun code**. Il propose un ordre de travail et des critères
pour juger si le travail est fait.

---

## 0. En une phrase

> En-Check **mesure** très bien, **décide** déjà avec prudence, **crie** encore au hasard,
> **anticipe** presque pas — et ne **prouve** pas encore.

Le problème n'est donc pas l'absence d'algorithmes. C'est que trois des cinq étages
sont soit orphelins (personne ne les lit), soit hors du dépôt (personne ne les relit).

---

## 1. La carte en cinq étages

Tout système qui veut « anticiper et régler des problèmes » a besoin de cinq étages.
Voici l'état réel d'En-Check sur chacun.

| Étage | La question à laquelle il répond | Ce qui existe | État |
| --- | --- | --- | --- |
| **1. Mesurer** | Que s'est-il passé, exactement ? | `hoursCalculator.js` (1 917 l.), `pausesService.js`, `retardsService.js`, `missingExits.js`, `rapportsPresence.js`, `timezoneUtils.js` (489 l.) | **Solide.** Un seul point faible : la mesure dépend d'un chemin d'écriture (`encheck_punch`) absent du dépôt. |
| **2. Décider** | Que faire quand la donnée manque ? | Cascade à 5 niveaux (`encheck_cloturer_pivotable`), analyse de cohorte (`encheck_analyser_pointage`), propositions contextuelles (`encheck_proposer_pointage`), mode ombre | **Bon, et remarquablement prudent.** Un étage est vide (niveau 2). |
| **3. Signaler** | Que faut-il regarder maintenant ? | `encheck_alertes_scan` (cron `*/10`), `encheck_pipeline_cloture` (cron 03:30), cloche in-app + Web Push | **Partiel et opaque.** Le générateur d'alertes réel n'est pas dans le dépôt. |
| **4. Anticiper** | Que va-t-il se passer, et que faire *avant* ? | Moteur Radar (3 tables, 1 détecteur, cron `*/5`), `predictionService.js` (5 familles) | **Orphelin.** Le Radar n'a aucune interface ; les prédictions parlent de tâches, pas de présence. |
| **5. Prouver** | Que puis-je montrer à un inspecteur, un associé, un cabinet ? | `attendance_history` en base, journal `encheck_pipeline_runs`, `encheck_carte_fonctions` | **Absent côté produit.** Aucun écran, aucun export, aucun dossier. |

**Lecture :** les étages 1 et 2 sont un vrai actif. Les étages 3 à 5 sont le chantier.
Et l'ordre naturel — mesurer, décider, signaler, anticiper, prouver — est aujourd'hui
inversé dans l'effort produit : on a construit l'anticipation (Radar) avant de brancher
le signalement (interface), et la preuve n'existe pas du tout.

---

## 2. Inventaire des algorithmes existants

### 2.1 Le socle temps — ce qu'En-Check sait compter

| Algorithme | Ce qu'il décide | Où | Solidité | Limite constatée |
| --- | --- | --- | --- | --- |
| Calcul des heures | Durée par jour / semaine / mois / année, sessions, heures sup, valorisation | `src/services/hoursCalculator.js` | **Élevée** — testé, gère l'auto-close virtuel et la nuit | Dépend d'un appariement entrée↔sortie ; si le badge manque, tout l'aval hérite du doute |
| Pauses | Pause réelle vs pause présumée, déductibilité | `src/services/pausesService.js` | **Élevée** — distinction explicite | Les pauses présumées doivent être visibles comme telles dans la paie ; à vérifier écran par écran |
| Retards | Qui est arrivé après l'heure, de combien | `src/services/retardsService.js` (93 l.) | **Correcte mais mince** | Le calcul s'appuie sur une source d'heure prévue qui peut venir de trois endroits (horaire personnel, grille, défaut) |
| Sorties manquantes | Quelles sessions sont ouvertes | `src/services/missingExits.js` | **Correcte** | Ne dit pas *quoi faire* — c'est le rôle de la cohorte |
| Seuils | **Toutes** les constantes de pointage | `src/services/seuilsPointage.js` ← `encheck_reglages_pointage` | **Très bonne décision d'architecture** | **Aucun écran ne permet de les lire ni de les modifier.** Voir §3, constat C4 |
| Fuseaux et bascule de journée | Quel « jour » appartient à quelle journée de travail | `src/utils/timezoneUtils.js` | **Élevée** — bascule à 00 h 30 pour Cotonou | Cas des sites multi-fuseaux non testé explicitement |
| Jours fériés | Jours ouvrés, décompte de congés | `src/services/holidayService.js` | **Élevée** — 14 pays + règles par entreprise, cache 5 min | Aucun contrôle de cohérence entre férié local et férié global écrasé |

**Le point à retenir :** la source unique des seuils est une des meilleures décisions
techniques du produit. Elle est aujourd'hui **invisible pour l'utilisateur**. Douze
constantes décident de la paie de chaque salarié, et le dirigeant ne peut en voir aucune.

Les seuils en vigueur (valeurs de repli, identiques aux valeurs semées) :

| Seuil | Valeur | Ce qu'il déclenche |
| --- | --- | --- |
| Oubli de sortie | 12 h | À partir de quand une session ouverte est un oubli |
| Plafond d'invention | 12 h | Au-delà, on arrête d'estimer |
| Appariement | 16 h | Tolérance pour relier une entrée à sa sortie (une garde de 13 h reste une garde) |
| Anti-rebond | 60 s | Deux badges trop proches = un doublon, pas une session |
| Durée minimale de session | 30 min | En dessous, ce n'est pas du travail |
| Garde de nuit | 22 h | Règle spécifique de session de nuit |
| Cohorte — fenêtre d'arrivée | 5 min | Quels collègues sont « arrivés en même temps » |
| Cohorte — dispersion des sorties | 2 min | Au-delà, les sorties divergent |
| Cohorte — proximité de départ | 90 s | Départ simultané = double badge suspect |
| Cohorte — collègues minimum | 2 | En dessous, on s'abstient |
| Contexte — écart toléré | 30 min | Écart accepté avec l'historique |
| Contexte — historique | 28 j / min 3 exemples / fenêtre 90 min | Profondeur d'apprentissage |

#### Ce que le moteur d'heures ne sait pas encore (relevé dans le code)

Le calcul courant est juste. Ce qui manque n'est pas de l'arithmétique, c'est de la
mémoire et de la conformité.

| Limite | Constat vérifié | Effet |
| --- | --- | --- |
| **Le passé se recalcule** | Toute l'année est recalculée à chaque appel, avec les seuils **du moment** | Changer un réglage en novembre **modifie les chiffres de janvier** — donc la paie déjà versée diverge de l'écran |
| **Heures sup journalières** | `weekly_threshold: 40` / `weekly_threshold_major: 48` / `calculation_mode` sont lus puis **jamais utilisés** (`featureService.js` l. 380–431) | 12 h lundi + 4 h mardi + 8 + 8 + 8 = 40 h → **4 h d'heures sup payées** que la semaine ne justifie pas |
| **Aucune conformité** | Ni repos quotidien, ni plafond hebdomadaire, ni amplitude, ni jours consécutifs | Une semaine à 62 h s'affiche normalement, sans un mot |
| **Aucun arrondi** | Calcul à la seconde, aucune règle configurable | 07:58 = 2 min de retard ; les entreprises corrigent à la main, et la preuve s'effondre |
| **Anomalies réparées en silence** | Session > 16 h ramenée à 16 h ; 2ᵉ entrée avalée ; sortie orpheline ignorée — sans `anomalie` | Réparation invisible = ce qu'un inspecteur attaque en premier |
| **Deux moteurs pour un jour** | Fiche 360° = `calculateEmployeeHours` (sans pauses) ; Pointages/Planning = `resoudrePointagesJournee` (pauses déduites) | 8 h de badges + 45 min de pause → **8 h 00** sur un écran, **7 h 15** sur l'autre, sans mention |
| **Bornes de période au fuseau du navigateur** | `toDateKeyLocal` / `getWeekPeriod` / `getMonthPeriod` utilisent la date locale du poste | Casse dès qu'un dossier est géré depuis un autre fuseau |
| **Demi-journées d'absence** | `buildAbsenceDaySet` raisonne en jours entiers | Une absence du vendredi après-midi pèse comme une journée entière |

Ces huit points ne relèvent pas du même lot : les trois premiers sont **architecturaux**
(mémoire, hebdomadaire, conformité), les cinq autres sont **bornés** et corrigeables
sans refonte.

### 2.2 La cascade d'estimation — ce qu'En-Check ose inventer

C'est la partie la plus mature du produit. Quand une session est ouverte au-delà du
seuil d'oubli, le système descend cinq étages et **s'arrête au premier qui répond** :

| Niveau | Source | Exemple | Trace |
| --- | --- | --- | --- |
| 1 | Horaire personnel explicite | Fatou a un horaire « lundi 08:00–17:00 » | `1-horaire-personnel` |
| 2 | Apprentissage comportemental | « Elle part d'habitude vers 17 h 05 » | **Vide — hook non implémenté, propriété IA DEV 1** |
| 3 | Grille par défaut de l'entreprise | Grille « 08:00–17:00 » | `3-grille-entreprise` |
| 4 | Heure d'auto-close de l'entreprise + grâce | « Fermer à 18:00 + 15 min » | `4-auto-close` |
| 5 | Repli | Entrée + 8 h, **plafonné** | `5-repli` |

Trois garde-fous vérifiés dans le code :

- **Jamais 23:59.** Le repli est « entrée + 8 h », pas « fin de journée ». Une invention
  qui ressemble à une vraie journée est plus dangereuse qu'une invention visible.
- **Plafond à 12 h.** Une cible au-delà est ramenée à 12 h, pas acceptée.
- **On n'invente pas dans le futur.** Une cible postérieure à maintenant est refusée.

Et la règle de conduite, tenue partout : **« On invente, on marque, on n'encaisse pas. »**
Une sortie estimée porte `method = 'auto_close'`, n'est pas payable, n'alimente pas les
notifications externes, jusqu'à validation humaine.

**Mode ombre.** Par défaut (`encheck_mode_estimation` → `'ombre'`), le moteur calcule
mais **n'écrit rien**. Il consigne ses mesures dans `encheck_clotures_statistiques`
(écart médian, pourcentage de propositions dans les 15 / 30 minutes). C'est le bon
comportement : on se donne le droit de se tromper sans conséquence, et on mesure.

### 2.3 La cohorte — ce qu'En-Check sait deviner avec des témoins

`encheck_analyser_pointage(entrée)` rend toujours un **verdict typé**, jamais un chiffre seul :

| Verdict | Signification | Ce que le système fait |
| --- | --- | --- |
| `depart_probable` | Sortie réelle peu après l'entrée **+ au moins 2 collègues partis à moins de 90 s** | Propose la sortie, avec la liste des témoins |
| `sortie_cohorte` | Collègues arrivés au même créneau, sorties concordantes (dispersion ≤ 2 min) | Propose la **médiane** des sorties |
| `divergence` | Les collègues ne concordent pas | **N'abstient.** Aucune proposition |
| `ambigu` | Deux badges rapprochés, sens indéterminable | Demande une confirmation humaine |
| `insuffisant` | Pas assez de collègues comparables | **S'abstient explicitement**, ne retombe pas sur 8 h |

`encheck_proposer_pointage` ajoute des filtres de **périmètre** : les témoins doivent
partager le même site (`geofence_id`) et un périmètre compatible. Sans ça, on comparerait
un magasin de Cotonou avec un entrepôt de Parakou. Et `encheck_proposition_decider`
enregistre la décision, sans jamais réécrire une estimation déjà consignée.

**C'est le bon design, et il est rare.** La plupart des logiciels de pointage choisissent
entre « inventer » et « laisser troué ». Ici, le système dit « je ne sais pas, et voici
pourquoi » — c'est exactement ce qu'un arbitre veut pouvoir défendre.

### 2.4 Les alertes — ce qu'En-Check crie

| Composant | Rôle | Fréquence |
| --- | --- | --- |
| `encheck_alertes_scan` | Seul point d'entrée appelable depuis le navigateur ; porte une garde admin | À chaque ouverture de la cloche + cron `*/10` |
| `encheck_generateur_alertes` | **Aiguillage** vers `encheck_alertes_controler_interne` ou `_v2` | — |
| `encheck_pipeline_cloture` | Verrou advisory, neutralisation des rebonds, clôtures pivotables, purge, génération | Cron 03:30 |
| `encheck_pipeline_runs` | Journal d'exécution du pipeline | — |
| `encheck_clotures_statistiques` | Mesures d'ombre (précision des estimations) | — |
| Table d'alertes | Résolue dynamiquement : `encheck_alertes` ou `alertes` | — |
| `useNotifications.js` | Agrège par gravité (critique / attention / info), pousse sur téléphone | À l'ouverture |

**Deux faits durs :**

1. La logique qui décide *quelles* alertes existent (retard ? absence ? sortie oubliée ?
   avec quels seuils ?) vit dans `encheck_alertes_controler_interne` — **fonction absente
   des 46 migrations**, déclarée dans `encheck_carte_fonctions` comme
   `proprietaire = 'producteur'`, `depot = 'AUCUN'`, `versionnee = false`.
2. Le nom de la table d'alertes est résolu à l'exécution : le modèle de données n'est
   pas unique. C'est un héritage, pas un choix.

**Conséquence pour un arbitre :** la partie du produit qui décide de ce que voit le
dirigeant chaque matin est la seule qu'on ne peut ni relire, ni tester, ni corriger
depuis le dépôt. C'est le premier point à traiter, avant tout ajout.

### 2.5 Radar — le seul moteur d'anticipation, et il est muet

Ce qui a été construit (migration `20261012000001`) :

| Brique | Contenu |
| --- | --- |
| `radar_signals` | Familles `presence` / `charge` / `rh` / `cout`, horizons `now` / `soon` / `month`, sévérité, cible, action recommandée, preuve (`data`), déduplication, expiration, **feedback `useful` / `noise`** |
| `radar_signal_config` | Seuils par entreprise, canaux `push` / `telegram` / `email` (et le schéma accepte `whatsapp` / `sms`) |
| `radar_user_preferences` | Préférences par utilisateur |
| `radar_run_all` | Cron toutes les 5 minutes, boucle sur les entreprises actives |
| Détecteurs | **Un seul** : `absence_non_declaree` |

Ce qui manque, vérifié :

- **Aucune interface.** `radar_signals` n'apparaît dans aucun fichier de `src/` hors test.
- **Aucun pont.** Aucune fonction ne relie `radar_signals` à `encheck_alertes`, et donc
  à la cloche. Un signal Radar ne devient jamais une notification.
- **Aucun retour.** Les colonnes `feedback` existent, aucun bouton n'écrit dedans.
  Le moteur ne peut donc pas apprendre ce qu'est du bruit.
- **Des canaux fantômes.** `telegram`, `whatsapp`, `sms` sont déclarés dans le schéma ;
  aucun expéditeur n'existe dans `supabase/functions/` (seuls `send-push` et `send-email`).
- **Un seul détecteur sur les neuf familles utiles** (voir §6, R2).

**Traduction :** le moteur d'anticipation est une bouteille à la mer. Il tourne toutes
les cinq minutes et personne ne lit jamais ce qu'il produit.

### 2.6 Prédiction — ce qu'En-Check annonce aujourd'hui

`predictionService.js` calcule cinq familles :

1. durée prévue vs réelle (tâches),
2. charge par salarié,
3. charge par équipe,
4. impact d'une absence sur la charge,
5. besoin d'effectif.

Avec trois sévérités (`info` / `warning` / `critical`) et un cache `task_predictions`
(valable 6 h) — table **non présente dans les migrations**, à vérifier avant d'en dépendre.

**Le décalage :** ces cinq familles parlent de **tâches**. Une entreprise qui n'utilise
que le pointage n'obtient rien. Or la question du dirigeant n'est pas « quelle tâche va
durer plus longtemps » mais « qui va me manquer vendredi », « vais-je exploser le plafond
d'heures cette semaine », « ce site est-il muet depuis trois jours ».

### 2.7 Le tableau de bord — de la description, pas encore de la prescription

`encheck_dashboard_synthese` (30 jours) renvoie : employés actifs, santé (assiduité,
régularité), bornes actives, série journalière, heatmap 7×24, tendance 7 j vs 7 j précédents.

L'interface (`DashboardKenteAnalytics.jsx`) en tire trois textes : un **insight du jour**,
une **note de prévision**, une **note de santé**. Règles déjà justes :

- sous 30 événements, **aucun pourcentage** n'est affiché (le bruit n'est pas une tendance) ;
- la note de santé a des seuils explicites (assiduité < 70 %, régularité < 55 %) ;
- un rapport texte partageable est généré.

Mais les textes restent **descriptifs** : « le pic d'arrivées se situe vers 8 h »,
« le week-end pèse 18 % du total ». Un dirigeant ne peut pas agir sur une description.
Il peut agir sur « trois salariés sans badge, une borne muette depuis 26 h, échéance dans
6 jours ».

### 2.8 Paie, fiscalité, assistant, sécurité

| Domaine | Ce qui existe | État |
| --- | --- | --- |
| Paie | `payrollService.js` (2 328 l.) : profils, indemnités, bonus, retenues, heures sup, bulletin PDF, audit | **Solide** |
| Fiscalité | `taxationService.js` (896 l.) : cotisations, barème progressif, parts fiscales, règles par pays | **Solide**, avertissements avant remise |
| Garde-fou paie | `payrollDelivery.js` : `PayrollDeliveryBlocked`, `PayrollTaxReviewRequired` | **Très bon** — le blocage est un type, pas un `if` |
| Devises | `currencyService.js` : devises, zones, pays | Correct |
| Assistant | `queryParser` + `spotlightService` (recherche et commandes), `assistantIntent`, `assistantNaturalRh` (3 intentions : pointages, retards, confirmations), `assistantExplanation` (explication sourcée, aucune donnée personnelle envoyée), `assistantChat` (public), quota `encheck_ai_test_quota` (3/jour en test) | **Bon cadrage** — l'assistant explique la règle, il ne décide pas |
| Sécurité | MFA `aal2` exigé pour l'administration des bornes, `pointage_bornes` (secret haché, expiration, révocation, journal d'événements), RLS, `encheck_carte_fonctions` | **Bon** |

À noter comme choix de conception à conserver : `assistantExplanation` ne transmet
**ni la question, ni le contexte, ni l'historique, ni l'identifiant d'entreprise**.
Seul un sujet fermé part au modèle. C'est ce qui permet de dire « l'IA n'a pas vu vos
données RH » — argument commercial autant que juridique.

---

## 3. Le diagnostic : cinq maillons, deux manquants

| Maillon | Question | État | Preuve |
| --- | --- | --- | --- |
| M1 | Mesure-t-on juste ? | Oui | 1 977 cas de test, un seuil unique, fuseaux gérés |
| M2 | Sait-on décider sans donnée ? | Oui, prudemment | Cascade 5 niveaux, abstentions typées, mode ombre |
| M3 | Ce qui est décidé remonte-t-il au dirigeant ? | **Partiellement** | Générateur d'alertes hors dépôt, table d'alertes polymorphe |
| M4 | Ce qui est anticipé remonte-t-il ? | **Non** | Radar sans interface, sans pont, sans feedback |
| M5 | Peut-on le prouver ? | **Non** | Aucun dossier exportable, aucun écran d'historique |

### Les six constats durs

**C1 — Le chemin d'écriture du pointage n'est pas dans le dépôt.**
`encheck_punch` et `replace_attendance_day` sont déclarées `versionnee = false`,
`proprietaire = 'producteur'`. C'est-à-dire : la seule porte par laquelle entrent les
données de présence n'est ni auditable, ni testable, ni corrigeable ici.
Conséquence directe : un écart entre ce que le dépôt promet et ce que la production
fait ne peut pas être détecté par un test.

**C2 — Le générateur d'alertes est un aiguillage vers du code invisible.**
`encheck_generateur_alertes` ne fait que chercher `encheck_alertes_controler_interne`
ou `_v2`. Ces deux fonctions ne sont dans aucune migration. La règle « qui alerte, sur
quel seuil, avec quel texte » est donc **inconnue du dépôt**.

**C3 — Le Radar est complet et inutilisé.**
Trois tables, un cron, des préférences, du feedback, des canaux — et zéro écran.
Le meilleur investissement d'anticipation du produit est invisible.

**C4 — Les seuils sont réglables en base et pas dans l'interface.**
Douze constantes décident de la paie. Aucun écran ne les affiche. Un dirigeant qui veut
dire « chez moi, on tolère 20 minutes de retard » ne peut pas le faire sans SQL.

**C5 — La prédiction parle de tâches, pas de présence.**
Cinq familles utiles pour une équipe projet, vides pour une entreprise de pointage.
Aucune règle de repos, de plafond, de série de jours, de site muet, de matériel.

**C6 — La preuve n'existe pas comme produit.**
`attendance_history` et `encheck_pipeline_runs` existent en base. Aucune page ne les
montre. Aucun export « dossier de présence » n'existe : `pdfExportService.js` ne produit
que les statistiques du site vitrine. Le 10 du mois, le dirigeant n'a rien à montrer.

---

## 4. Exemples illustrés

Fil rouge : **Kente Services**, Cotonou (fuseau `Africa/Porto-Novo`, bascule à 00 h 30),
24 salariés, seuils par défaut, mode ombre actif.

### S1 — La sortie oubliée du lundi (la cascade)

Lundi, Fatou badge à **08:02**. Elle ne badgera plus jamais.

| Heure | Ce qui se passe | Ce que le système dit |
| --- | --- | --- |
| 08:02 | Entrée enregistrée | Session ouverte |
| 20:02 | 12 h écoulées = seuil d'oubli | Session éligible à la clôture |
| 03:30 (mardi) | Pipeline | Niveau 1 : pas d'horaire personnel → descend |
| | | Niveau 2 : hook vide → descend **et consigne la raison** |
| | | Niveau 3 : grille entreprise `08:00–17:00` → cible **17:00** |
| | | Écrit `method = 'auto_close'`, **non payable**, « à valider » |

**La même journée dans trois entreprises différentes :**

| Situation | Cible calculée | Payable ? |
| --- | --- | --- |
| Grille entreprise 08:00–17:00 | 17:00 | Non, jusqu'à validation |
| Pas de grille du tout | 16:02 (entrée + 8 h) | Non |
| Grille « nuit 22:00–06:00 » mais entrée de jour | 17:00 (descente de niveau, pas de clôture à une heure déjà passée) | Non |

Ce que ça évite, concrètement : une entreprise sans grille aurait pu voir 23:59
(« fin de journée ») et payer 16 heures pour 8 heures travaillées. Le plafond à 12 h et
le repli à +8 h rendent l'erreur visible et bornée.

**Reste à faire :** le niveau 2. Aujourd'hui, Fatou est clôturée à l'heure de la grille.
Avec l'apprentissage, si elle part d'habitude à 17:05 et que ses 12 dernières sessions
concordent, la cible serait 17:05 — plus juste, sans jamais dépasser le plafond.

### S2 — Les deux badges de Reine (la cohorte)

Reine entre à **08:00**. À **17:00:12**, un badge « sortie » apparaît. Est-ce elle qui
part, ou a-t-elle badgé deux fois en entrant par erreur seize heures plus tôt ?

| Version | Témoins | Dispersion | Verdict | Proposition |
| --- | --- | --- | --- | --- |
| A | 3 collègues sortis à 17:00:05, 17:00:40, 17:01:10 | 65 s ≤ 120 s | `depart_probable` | Sortie réelle acceptée, 3 témoins joints |
| B | 2 collègues sortis à 17:00 et 19:30 | 9 000 s > 120 s | `divergence` | **Aucune proposition** |
| C | Sortie 56 s après l'entrée | — | `ambigu` (anti-rebond) | Confirmation humaine demandée |
| D | 1 seul collègue comparable | < 2 | `insuffisant` | **Aucune heure inventée** |

Le point important n'est pas le calcul, c'est l'**abstention**. Dans les cas B et D, le
système refuse de deviner. C'est ce qui rend les cas A crédibles : quand il propose, il a
des témoins, et il les montre.

### S3 — 08 h 05, le radar crie dans le vide

Quatre salariés n'ont pas badge et n'ont pas de congé posé.

| Heure | Événement | Visible par le dirigeant ? |
| --- | --- | --- |
| 08:05 | `radar_run_all` crée 4 signaux `absence_non_declaree`, sévérité `critical`, horizon `now`, valides jusqu'à minuit | **Non** |
| 08:06 | Il ouvre l'application | **Non** — aucune page ne lit `radar_signals` |
| 08:06 | La cloche interroge `encheck_alertes` | **Non** — aucun pont entre les deux tables |
| 08:30 | Un 5e salarié arrive en retard, sans badge matinal | Doublon évité, mais toujours invisible |
| 00:30 (mardi) | `radar_expire_stale_signals` nettoie | Le signal disparaît sans avoir servi |

Le détecteur fonctionne. La chaîne s'arrête à la table. Un système d'anticipation dont la
sortie n'atteint personne n'anticipe rien.

### S4 — L'alerte que personne ne peut expliquer

La cloche affiche « Retard : Jean, 42 min ». Un dirigeant demande pourquoi 42 et pas 45.

| Étape | Où c'est décidé | Peut-on le relire ? |
| --- | --- | --- |
| Heure prévue | `encheck_grille_au_jour` | **Oui**, versionné |
| Calcul du retard | `hoursCalculator` / `retardsService` | **Oui**, testé |
| Seuil de tolérance | `encheck_reglages_pointage` | **Oui**, mais aucun écran |
| **Création de l'alerte** | `encheck_alertes_controler_interne` | **Non — hors dépôt** |

On peut donc expliquer les trois premiers maillons et pas le quatrième. C'est
exactement la situation qu'un arbitre doit refuser : une alerte qu'on ne peut pas
justifier ne vaut pas mieux qu'une absence d'alerte.

### S5 — L'écran Prédictions d'une entreprise sans tâches

Kente Services n'utilise pas le module tâches. Elle ouvre « Prédictions ».

| Famille | Ce que ça donne | Pourquoi |
| --- | --- | --- |
| Durée prévue vs réelle | Vide | Pas de tâches |
| Charge par salarié | Vide | Pas de tâches |
| Charge par équipe | Vide | Pas de tâches |
| Impact d'une absence | Vide | Pas de tâches rattachées |
| Besoin d'effectif | Vide | Dépend des quatre autres |

L'écran existe, il est gated, il est testé — et il est vide pour le cas d'usage le plus
courant du produit. Ce n'est pas un bug : c'est un modèle de données qui ne correspond
pas au métier majoritaire.

### S6 — Le 10 à 09 h 00 (aujourd'hui)

| Ce qu'il faudrait | Ce qui existe |
| --- | --- |
| Un état « période close » | Aucun verrou de période, aucun statut de clôture mensuelle |
| La liste des heures estimées non validées, et leur montant | Existe en base (`method = 'auto_close'`), aucun écran de synthèse |
| Une annexe ITS / CNSS | Le calcul existe (`taxationService`), l'annexe n'existe pas |
| Un dossier de présence exportable et opposable | **Rien** |
| Une trace de qui a validé quoi | `attendance_history` et `encheck_pipeline_runs` en base, aucun écran |

La paie du 10 est donc **juste** (on ne paie pas l'invention) mais **incomplète**, et
personne ne sait de combien. C'est le pire des deux mondes : la prudence protège, mais
elle ne se voit pas.

---

## 5. Ce qu'il faut renforcer

Huit chantiers — R1 est scindé en deux, et C5-mince figure ici parce qu'il conditionne R3
(voir §12). Aucun ne demande de refonte. Les systèmes C1 à C4 sont chiffrés dans la
grille de priorisation (§7).

**Deux échelles d'effort, désormais, et une de risque — parce que les confondre a coûté
cher en v1 :**

- **E — effort logique** (SQL, services, règles) ;
- **É — coût écran/charte** (maquette, tokens, tailles, thème clair/sombre, tests de
  non-régression, captures aux quatre largeurs) ;
- **R — risque sémantique** : le chantier peut-il changer *ce qui est compté, payé ou
  prouvé* ?

| Chantier | E | É | R | Bloqué par |
| --- | --- | --- | --- | --- |
| R5 — rapatrier les fonctions producteur | M | — | **H** | Porte de vérification (voir R5) |
| R1-fin — Signaux, lecture seule | S | S | Faible | — |
| C5-mince — journal des décisions | M | M | Faible | — |
| R3 — écran des seuils | S | **M** | **H en sens** | **C5-mince + D3** |
| R1-complet — pont + feedback | M | S | Moyen | R1-fin |
| R2 — sept détecteurs | M | S | Moyen | **R1 + D4** |
| R4 — preuve jointe | M | S | Faible | — |
| R7 — insight prescriptif | S | S | Faible | — |
| R6 — niveau 2 | M | — | Moyen | Mesure en ombre |

**R1-fin — Une page « Signaux » en lecture seule (E : S · É : S · R : faible).**
Liste par famille et horizon, preuve dépliable, tri par sévérité, expiration affichée.
**Plus une chose non négociable : chaque ligne pointe vers l'enregistrement concerné**
(la fiche du salarié, la ligne de pointage, le site), pour qu'on puisse **agir** depuis
la liste. Sans ce lien, ce n'est pas un destinataire, c'est une destination — et la
règle « pas de détecteur avant son destinataire » ne serait pas respectée.

**R1-complet — Le pont et le feedback (E : M · É : S · R : moyen).**
Un signal `critical` de la famille `presence` devient une alerte in-app, une seule fois
par `dedupe_key` ; le bouton « c'est normal » écrit `feedback = 'noise'` et le moteur
cesse de le proposer. À livrer une à deux semaines après R1-fin, quand on saura quelles
lignes sont réellement ouvertes.

**R2 — Les sept détecteurs manquants (E : M · É : S · R : moyen).**
Chacun est une règle simple, sans apprentissage, et se branche sur le socle existant.
**Interdit de démarrer avant R1 et avant que D4 (budget d'attention) soit tranchée** :
un détecteur sans destinataire ni budget est de la dette.

| Règle | Exemple d'alerte | Source |
| --- | --- | --- |
| Repos | « Fatou a pointé 14 jours d'affilée » | `attendances` + fériés |
| Plafond (fenêtre) | « La semaine dépasse le plafond de 48 h » | `hoursCalculator` |
| Site muet | « Aucun pointage sur le site A depuis 3 jours » | `attendances` + `geofence` |
| Borne muette | « La borne de l'entrée est hors ligne depuis 26 h » | `pointage_bornes` |
| Salarié silencieux | « Plus de badge depuis 8 jours, sans absence » | `employees` + `attendances` |
| Double badge | « Deux salariés sur la même borne à 4 s » | cohorte (déjà écrite) |
| Échéance | « À J-3 du 10, le dossier n'est pas clos » | clôture de période |

> **Couture avec la feature 964 h (parkée).** Le détecteur « Plafond » est exactement
> l'endroit où le quota étudiant étranger se branchera — mais **ce ne sont pas les mêmes
> calculs**, et il faut le dire maintenant pour éviter un détecteur hybride qui fera mal
> les deux :
> - **48 h/semaine** = calcul **à fenêtre** (7 jours glissants, remis à zéro) ;
> - **964 h/an** = calcul **cumulatif** (année à année, dépend du statut du salarié).
>
> Deux primitives (fenêtre + cumul), **une seule** couche de notification. Voir §13.

**R3 — Rendre les seuils lisibles et modifiables (E : S · É : M · R : élevé en sens).**
Un écran « Réglages du pointage » : les douze seuils, leur valeur, leur effet expliqué
en une phrase, et un journal de modification.

**Correction de la v1.** J'avais écrit « risque quasi nul ». C'était faux : je parlais
du risque *de faire* (douze champs, un `UPDATE`), pas du risque *de changer le sens*.
« Tolérer 20 minutes de retard » déplace la frontière de ce qui compte comme retard,
donc ce qui est payé, donc ce qui est prouvé. Et surtout :

> **R3 sans journal est une machine à réécrire le passé.** Une fois les seuils
> éditables, changer une valeur en novembre modifie les chiffres de janvier — le même
> défaut que celui reproché au moteur d'heures. R3 est donc **couplé à C5 et à D3**,
> jamais livrable seul.

**R4 — Toute alerte porte sa preuve (E : M · É : S · R : faible).**
Le format existe déjà dans la cohorte (`evidence` : identifiants, dates, écart chiffré).
Le généraliser : aucune alerte sans « voici les 3 lignes qui la justifient ».
Une alerte invérifiable discrédite les suivantes.

**R5 — Rapatrier les cinq fonctions « producteur » (E : M · É : — · R : HAUT).**
`encheck_punch`, `replace_attendance_day`, `encheck_alertes_controler_interne`,
`encheck_alertes_lister`, `encheck_signaux_controler`. Sans elles, ni audit ni test ne
peuvent couvrir le chemin réel. **Mais attention : ce n'est pas un copier-coller.**

Le danger n'est pas seulement que la production ait dérivé. C'est qu'une migration qui
reproduit fidèlement un bug **devient le bug**, avec l'autorité du contrôle de version
par-dessus : après ça, personne n'ose y toucher — « c'est dans le dépôt, c'est donc
voulu ». Une **porte de vérification** en quatre temps est donc obligatoire :

1. **Exporter** le code réel de production (`supabase/outils-sql/exporter-fonctions-prod-only.sql`).
2. **Écrire des tests de caractérisation** : ce que la production *fait*, pas ce qu'on
   croit qu'elle fait.
3. **Rejouer en staging** la migration figée contre ces tests.
4. **Figer** — en documentant explicitement, pour chaque fonction, ce qui est *bug
   reproduit volontairement* et ce qui est *corrigé*.

**R6 — Livrer le niveau 2 de la cascade (E : M · É : — · R : moyen).**
Le hook est câblé, le contrat est clair, la place est réservée. Il suffit de remplir le
corps : médiane conditionnelle par salarié et par jour de semaine, dispersion (IQR)
comme garde-fou, minimum d'exemples, plafond. Et de le mesurer en mode ombre contre le
niveau 3 avant de l'activer.

**R7 — Passer l'insight du tableau de bord du descriptif au prescriptif (E : S · É : S · R : faible).**
Remplacer/compléter « le pic est à 8 h » par trois lignes actionnables :
« 3 salariés sans badge · 1 borne muette depuis 26 h · échéance paie dans 6 jours ».
Le calcul existe déjà ; c'est un choix de texte et de priorité.

---

## 6. Ce qu'il faut créer

Cinq systèmes. Ils ne s'ajoutent pas aux précédents, ils les rendent utilisables.

**C1 — Le dossier du 10 (clôture de période opposable).**
Un objet « période » (mois, entreprise) avec trois états : ouverte, en revue, close.
À la clôture : les estimations non validées sont listées avec leur montant, la somme
des heures payées vs pointées est figée, l'annexe ITS / CNSS est produite, un PDF
signé (empreinte) est généré, et toute modification ultérieure devient une correction
tracée — pas une réécriture.
*Exemple :* « Octobre 2026 — 24 salariés — 4 112 h pointées — 38 h estimées dont 22
validées, 16 refusées — 3 écarts > 2 h — dossier clos le 09/11 à 18:42 par A. Dossou,
empreinte `a41f…` ».

**C2 — Le mode cabinet.**
Un comptable gère 30 dossiers. Il lui faut un échéancier (qui est en retard, de combien),
un accès par mandat, une vue « anomalies à traiter » toutes entreprises, et une sortie
en lot. L'accès multi-entreprises existe déjà en base (`admin_entreprises`,
`admin_has_access_to_enterprise`) ; il manque l'expérience.

**C3 — Le mode inspecteur.**
Un accès en lecture, borné dans le temps, journalisé, à un périmètre de dates.
Pas un compte admin déguisé : un jeton, une durée, un journal de consultation.
C'est la contrepartie visible du dossier du 10 — sans lui, la preuve ne sert à rien.

**C4 — L'anticipateur niveau 1 (le moteur de règles).**
Un moteur unique qui consomme les détecteurs de R2 et produit des signaux au format
Radar. Deux règles de conduite, non négociables :

1. **Précision avant rappel** — mieux vaut rater dix anomalies qu'en signaler une fausse.
2. **Toute alerte montre sa preuve** — les lignes, les dates, l'écart chiffré.

Et **une valeur proposée, pas une décision prise** : *trois alertes par mois* comme
budget d'attention par défaut. La v1 la présentait comme un acquis ; en réalité c'est
**D4** qui la tranche, et c'est elle qui doit être décidée **avant** R2, pas après.
Tant que D4 n'est pas tranchée, le moteur tourne avec trois par mois, mais le chiffre
est marqué « provisoire » dans l'écran.

Avec un garde-fou supplémentaire déjà prévu par le schéma : le bouton « c'est normal »
qui apprend à ne plus signaler ce cas.

**C5 — Le journal de preuve, en deux temps (ne pas inverser).**
Un écran unique qui répond à « qui a changé quoi, quand, sur quelle base ».

- **C5-mince (à livrer avant R3)** : changements de seuils + décisions d'estimation.
  C'est le strict nécessaire pour que R3 ne soit pas une machine à réécrire le passé.
- **C5-étendu** : corrections de pointage (`attendance_history`), exécutions du pipeline
  (`encheck_pipeline_runs`), révocations de bornes (`pointage_borne_events`),
  consultations du mode inspecteur (C3).

Aujourd'hui ces traces existent séparément en base et aucune n'est visible. Découper
C5 est obligatoire : livré d'un bloc, il devient plus gros que R3 et bloque l'ordre
tout entier.

---

## 7. Priorisation

Le critère n'est pas « ce qui est le plus impressionnant », c'est « ce qui rend le reste
utilisable ».

| Ordre | Chantier | E | É | Risque | Pourquoi à cette place |
| --- | --- | --- | --- | --- | --- |
| 1 | **R5** — fonctions producteur, avec porte de vérification | M | — | **H** | Tant que le réel est invisible, tout le reste est une hypothèse |
| 2 | **R1-fin** — page Signaux, lecture seule **+ lien d'action** | S | S | Faible | Montre de la valeur tout de suite, et crée le destinataire que la règle exige |
| 3 | **C5-mince** — journal (seuils + décisions) | M | M | Faible | Doit précéder R3, sinon R3 réécrit le passé |
| 4 | **R3** — écran des seuils | S | M | **H en sens** | Couplé C5 + D3 ; puissant et dangereux |
| 5 | **R1-complet** — pont vers la cloche + feedback | M | S | Moyen | Une fois qu'on sait quelles lignes sont ouvertes |
| 6 | **R2** — les 7 détecteurs | M | S | Moyen | Alimente le Radar ; **après** l'interface, jamais avant |
| 7 | **R4** — preuve jointe à chaque alerte | M | S | Faible | Condition pour que R2 ne devienne pas du bruit |
| 8 | **R7** — insight prescriptif | S | S | Faible | Change la perception du produit à coût quasi nul |
| 9 | **C1** — dossier du 10 | L | L | Moyen | Le livrable que le dirigeant peut montrer — **bloqué par D5** |
| 10 | **C4** — anticipateur niveau 1 | L | M | Moyen | Consolide R1 + R2 en un moteur réglé — **bloqué par D4** |
| 11 | **C2 / C3** — cabinet, inspecteur | L | L | Moyen | Ouvre un marché ; dépend de C1 **et de D5** |
| 12 | **R6** — niveau 2 comportemental | M | — | Moyen | Améliore la justesse, pas l'usage ; mesurer avant d'activer |

**La règle d'ordre à ne pas casser :** ne jamais ajouter un détecteur avant que son
destinataire existe. Un moteur qui produit dix signaux que personne ne lit n'est pas
un progrès, c'est une dette.

### 7.1 Pourquoi l'ordre a changé par rapport à la v1

Deux déplacements, tous deux proposés par l'arbitre 1 et acceptés :

- **R1 est scindé.** La v1 livrait l'interface et le pont d'un bloc (M). Une liste en
  lecture seule est un **S** et montre la valeur immédiatement. Mais elle ne compte
  comme « destinataire » **que si chaque ligne mène à l'enregistrement** : une liste
  qu'on regarde sans pouvoir agir reste une dette, simplement visible.
- **C5 précède R3.** La v1 plaçait le journal après les seuils. C'était une erreur :
  des seuils éditables sans journal sont un bouton pour modifier janvier depuis
  novembre. **C5-mince d'abord, R3 ensuite.**

### 7.2 Le coût écran, la dimension qui manquait

La v1 chiffrait l'effort logique et oubliait **le coût de l'écran à la charte** — là où
le produit brûle historiquement son temps. Le dépôt le documente page par page. Exemple
mesuré, sur **une seule page** (`docs/HEURES-SUPPLEMENTAIRES-CORRECTION-CHARTE.md`) :

> 697 tests / 69 fichiers · Chromium aux largeurs **320, 390, 768 et 1440** · thème
> clair **et** sombre · 3 tests de non-régression de charte · un SVG redessiné · un
> bandeau ré-accordé de 76 à 40 px · zéro erreur ESLint.

Conclusion : **un écran « S » n'est pas une tâche « S »**. La colonne **É** est
désormais obligatoire dans toute estimation, et vaut au minimum **S** dès qu'il y a un
écran nouveau.

#### Correction v3 — j'avais tort, et l'erreur était grave

En v2, j'ai écrit que la charte (« palette B », « 12 contrôles », « seuil 85 ») et la
régression du 18/11 **n'existaient nulle part dans le dépôt**. C'est **faux**, et c'était
faux dans l'arbre que je lisais (`6c8c3d6`). Vérification faite :

| Ce que j'avais déclaré absent | Ce qui existe réellement |
| --- | --- |
| Le script de contrôle | **`scripts/charte-check.mjs`** (238 l., 20 décisions D-001 → D-020, modes `--json` / `--strict`, et quatre verdicts : PASS / FAIL / **MANUEL** / N/A) |
| Les règles | **`identite/`** : `CHARTE.md` (§8 « Les douze contrôles »), `CHARTE-KIT.md`, `CHARTE-VOLUME-1.md` (palette B, D-001), `DECISIONS-ENTERINEES.md`, `DEROGATIONS.md` |
| Le seuil de notation | **`identite/fiche-page-TEMPLATE.md`** : « Total __ / 100 — seuil **85** pour fusionner » ; `PROTOCOLE-IMPLEMENTATION.md` : « une ligne ne passe à *fait* que si le score est ≥ 85 **et** que les deux captures sont jointes » |
| La matrice d'avancement | **`identite/conformite.md`** : page par page, avec `✅ CONFORME / ⚠️ en dérogation / ⬜ non redevinée` |
| La régression du 18/11 | **`identite/fiche-page-employes.md` §10** (« Leçon de la régression du 18/11, fix en prod `aece9b0` ») + **`docs/regression-employes.png`** |
| Le CSS de charte | **`src/styles/charte.css`**, et des tests qui la citent (`charteAbsences.test.js`, `entetesEtTheme.test.jsx`) |

La leçon du script lui-même dit tout : *« Le script ne corrige rien. Il mesure. C'est la
seule chose qui distingue une charte d'une intention. »*

**Pourquoi je me suis trompé :** j'ai cherché trois chaînes dans `docs/` et `src/`, je
n'ai pas trouvé, et j'ai conclu « nulle part dans le dépôt ». Une **affirmation
d'absence** exige une recherche exhaustive ; j'ai fait une recherche partielle. C'est
exactement le péché que je reprochais aux volumes — un cran plus haut. Et j'avais même
listé `docs/regression-employes.png` plus tôt dans la session sans faire le lien.

#### La vraie question n'est donc pas « écrire la charte », mais « jusqu'où la porte ferme »

Le système existe ; ce qui manque est **la couverture et le cran de serrage**. Faits
vérifiés :

- `.github/workflows/ci.yml` lance bien le contrôle — mais en **`|| true`**, donc
  **non bloquant**, et c'est **volontaire**, documenté en commentaire : *« une porte
  rouge le premier jour resterait rouge pour toujours, alors on la monte page par page »*.
- `identite/conformite.md` montre l'état réel : 3 lignes conformes (fondations, barre,
  thème), **le reste en `⬜` ou `⚠️` (dérogations DÉR-01 à DÉR-04)**.
- La note ≥ 85 est **manuelle**, saisie dans une fiche par page — donc rien ne force à
  la remplir.

**Conséquence pour cette feuille de route, qui est le vrai enjeu :** si R1-fin, R3, C5,
C2 et C3 arrivent avec des écrans, ils ajoutent **cinq lignes `⬜`** à `conformite.md`
pendant que la porte reste ouverte. La dette grandit plus vite que la rampe.

**Recommandation corrigée (moins chère que « créer la charte ») :**

1. **Porter la porte en bloquant sur les pages neuves uniquement** — un `--strict`
   limité à une liste de fichiers (ou une référence « baseline » des écarts existants).
   On protège sans rougir le dépôt.
2. **Une fiche + deux captures (1440 px, clair et sombre) = condition de PR** pour tout
   écran nouveau, comme le prévoit déjà `fiche-page-TEMPLATE.md`.
3. **Compléter la correspondance D-0xx → contrôle** dans `charte-check.mjs`, pour
   distinguer d'un coup d'œil ce qui est automatisé, ce qui est `MANUEL`, et ce qui est
   en dérogation assumée.
4. Ne **pas** passer toute la charte en bloquant : la rampe page par page est le bon
   choix, et je n'ai aucune raison de le contester.

---

## 8. Ce qu'il ne faut pas faire

1. **Ne pas ajouter d'IA générative dans le chemin de décision de la paie.**
   L'assistant actuel est bien cadré : il explique une règle documentée, sans voir les
   données. Le garder là. Un modèle qui « décide » une heure payable est indéfendable
   devant un inspecteur.
2. **Ne pas créer une troisième table d'alertes.** Il y en a déjà deux résolues à
   l'exécution. Toute nouvelle table doit remplacer, pas s'ajouter.
3. **Ne pas dupliquer un seuil.** La source unique (`encheck_reglages_pointage`) est un
   acquis. Un chiffre en dur dans un composant le détruit.
4. **Ne pas rendre le Radar bavard pour le rendre visible.** Trois alertes par mois par
   défaut. La visibilité vient de la qualité, pas du volume.
5. **Ne pas facturer une heure estimée avant validation.** La doctrine actuelle
   (« on invente, on marque, on n'encaisse pas ») est ce qui rend le produit défendable.
   Le dossier du 10 doit la rendre *visible*, pas la contourner.
6. **Ne pas promettre le niveau 2 avant de l'avoir mesuré.** Le mode ombre existe
   précisément pour ça : publier les chiffres avant la fonctionnalité.
7. **Ne pas figer une dérive sans l'avoir rejouée.** Une migration qui reproduit
   fidèlement un bug devient le bug, avec l'autorité du dépôt par-dessus. Voir la porte
   de vérification de R5 (§5).
8. **Ne pas livrer R3 sans journal.** Des seuils éditables sans trace sont un bouton
   pour modifier le passé. C5-mince d'abord.
9. **Ne pas fusionner « plafond hebdomadaire » et « quota annuel ».** Une fenêtre
   glissante et un cumul sont deux calculs différents ; les réunir produira un détecteur
   qui se trompe deux fois (§5, R2).

---

## 9. Les décisions à trancher — et celles qui ne se tranchent pas en interne

Les trois premières sont des arbitrages produit. La cinquième n'en est pas un.

| # | Question | Nature | Pourquoi elle bloque |
| --- | --- | --- | --- |
| D1 | **Quel métier est prioritaire ?** Commerce multi-sites à Cotonou, PME tertiaire, cabinet comptable ? | Arbitrage produit | Le jeu de détecteurs et les seuils par défaut en dépendent entièrement |
| D2 | **Qui valide une estimation ?** Le dirigeant seul, ou un RH délégué par site ? | Arbitrage produit | Détermine le modèle de droits du dossier du 10 |
| D3 | **Seuils par défaut ou par entreprise dès le départ ?** | Arbitrage produit | Douze valeurs × 30 clients = un support ingérable si tout est réglable |
| D4 | **Quel budget d'attention ?** Trois alertes par mois, ou une par jour ouvrés ? | Arbitrage produit — **à trancher avant R2** | Fixe le seuil de déclenchement de tous les détecteurs |
| D5 | **Quelle valeur probante ?** Que doit contenir le dossier pour tenir devant un inspecteur du travail béninois, sur ITS et CNSS ? | **Dépendance externe bloquante** | Fixe le contenu de C1 et de C3 |

### D5 n'est pas une décision de réunion

La v1 la rangeait parmi les « décisions à trancher », comme si l'équipe pouvait voter.
C'est faux : **D5 n'a pas de décideur interne**. Elle demande une **source légale** —
un juriste, un inspecteur du travail, un cabinet comptable — et un livrable écrit
(note juridique sourcée, avec les articles).

Elle doit donc être pilotée comme une dépendance, pas comme un atelier :

| Élément | Ce qu'il faut |
| --- | --- |
| Porteur | Une personne nommée, pas « l'équipe » |
| Livrable | Une note juridique datée, sourcée, sur : contenu minimal d'un dossier de présence, durée de conservation, valeur d'une heure estimée validée, mentions ITS/CNSS |
| Échéance | Avant le démarrage de C1 |
| Conséquence | **C1, C2 et C3 ne démarrent pas** tant que D5 est ouverte — ils ne sont pas « des coquilles bien faites », ils sont à l'arrêt |

Tant que D1 est ouverte, C4 reste un moteur sans jeu de règles. Tant que D4 est ouverte,
R2 ne démarre pas.

---

## 10. Registre — ce que cet audit a vérifié, et où

| Constat | Fichier / ligne |
| --- | --- |
| 5 niveaux de cascade, niveau 2 vide | `supabase/migrations/20261016000001_fondations_auto_close_structure.sql` (l. 672–960) |
| `encheck_estimer_sortie_comportementale` déclarée « à livrer par l'IA DEV 1 » | même fichier, l. 1978 (`encheck_carte_fonctions`) |
| `encheck_punch`, `replace_attendance_day`, `encheck_alertes_controler_interne` non versionnées | même fichier, l. 1984–1986 |
| Générateur d'alertes = aiguillage vers du code absent | même fichier, l. 1556–1569 |
| Radar : 3 tables, 1 détecteur, cron `*/5`, feedback | `supabase/migrations/20261012000001_radar_foundation.sql` |
| Aucune UI Radar | `radar_signals` absent de `src/` hors `radarFoundation.test.js` |
| Canaux `telegram` / `whatsapp` / `sms` sans expéditeur | `radar_foundation.sql` l. 65–76 ; `supabase/functions/` ne contient que `send-push` et `send-email` |
| Cohortes et abstentions typées | `20261017000007_analyse_cohorte_ombre.sql`, `20261017000008_propositions_contextuelles.sql` |
| Seuils uniques, aucun écran | `src/services/seuilsPointage.js` ; `encheck_reglages_pointage` |
| Prédictions orientées tâches, cache hors migrations | `src/services/predictionService.js` l. 99–114, 646 |
| Dashboard descriptif | `src/components/DashboardKenteAnalytics.jsx` l. 142–218, 471 |
| Assistant sans données personnelles | `src/services/assistantExplanation.js` |
| Export PDF = analytics du site vitrine seulement | `src/services/pdfExportService.js` |
| Coût réel d'un écran à la charte | `docs/HEURES-SUPPLEMENTAIRES-CORRECTION-CHARTE.md` (697 tests, 4 largeurs, 3 tests de non-régression) |
| Charte : script de contrôle | `scripts/charte-check.mjs` (238 l., D-001 → D-020, `--strict`, verdicts PASS/FAIL/MANUEL/N/A) |
| Charte : règles et seuil | `identite/CHARTE.md` §8, `DECISIONS-ENTERINEES.md`, `CHARTE-KIT.md`, `CHARTE-VOLUME-1.md` ; seuil 85 dans `fiche-page-TEMPLATE.md` et `PROTOCOLE-IMPLEMENTATION.md` |
| Charte : porte CI **non bloquante** | `.github/workflows/ci.yml` l. 66-69 (`npm run charte:ci || true`), choix documenté en commentaire |
| Charte : avancement réel | `identite/conformite.md` (3 lignes ✅, le reste `⬜`/`⚠️` DÉR-01 à DÉR-04) |
| Régression du 18/11 : documentée | `identite/fiche-page-employes.md` §10 + `docs/regression-employes.png` |
| Volumes de la v1 sous-estimés | pages 42 (et non 35), hooks 18 (et non 16), utils 17 (et non 16) |
| Heures sup hebdomadaires configurées mais jamais calculées | `src/services/featureService.js` l. 380–431 (`weekly_threshold` lu, jamais utilisé) ; `hoursCalculator.js` ne branche pas sur `calculation_mode` |

---

## 11. En une phrase

En-Check a déjà le plus dur : un moteur qui sait **s'abstenir**, et une doctrine qui
**n'encaisse pas ce qu'elle invente**. Ce qui manque n'est pas de l'intelligence, c'est
de la **plomberie** : brancher le Radar, montrer les seuils, rapatrier le code réel,
joindre la preuve — puis seulement, construire le dossier du 10 et l'anticipateur.

---

## 12. Ce qui a changé entre la v1 et la v3

Deux revues par l'**IA Arbitre 1**. Dix corrections, dont cinq que j'aurais dû voir seul
et une que j'ai inventée (ligne 10).

| # | Point v1 | Correction v2 | Gravité |
| --- | --- | --- | --- |
| 1 | Volumes : 35 pages / 16 hooks / 16 utils | **42 / 18 / 17** + commande de comptage annoncée pour chaque chiffre | Mineure en soi, **majeure sur la crédibilité** |
| 2 | « 88 RPC » présenté comme un fait | **88 dans le dépôt, ≥ 93 en base** — et l'écart *prouve* C1 | Moyenne |
| 3 | R5 « exécuter l'export et figer » | **Porte de vérification en 4 temps** ; risque reclassé **M → H** | **Élevée** |
| 4 | R3 « risque quasi nul » | Risque **sémantique élevé** ; couplé **C5 + D3** ; « une machine à réécrire le passé » | **Élevée** |
| 5 | D5 = décision à trancher | **Dépendance externe bloquante** (juriste, note sourcée, porteur, échéance) ; C1/C2/C3 **à l'arrêt** | **Élevée** |
| 6 | Effort = une seule échelle (S/M/L) | **Deux échelles** : E (logique) + **É (écran/charte)**, plus une colonne **Risque** | Élevée |
| 7 | R1 livré d'un bloc | Scindé **R1-fin** (S) → **R1-complet** (M), et R1-fin exige un **lien d'action** par ligne | Moyenne |
| 8 | C5 livré d'un bloc | Scindé **C5-mince** (avant R3) → **C5-étendu** | Moyenne |
| 9 | « 3 alertes par mois » posé comme acquis de C4 | Requalifié en **valeur proposée**, arbitrée par **D4 avant R2** | Faible en fond, réelle en méthode |
| 10 | **« La charte n'existe nulle part dans le dépôt »** | **Faux.** `scripts/charte-check.mjs`, `identite/*` (CHARTE.md, DECISIONS-ENTERINEES, DEROGATIONS, conformite, fiche-page-TEMPLATE), `src/styles/charte.css`, 5 tests, et la régression du 18/11 documentée. Recommandation corrigée : **consolider et serrer la porte**, pas créer la charte | **La plus grave** — une affirmation d'absence non exhaustive |

### Deux points où je ne suis pas l'arbitre

- **« R1-fin crée le destinataire » — non.** Une liste en lecture seule crée une
  *destination*, pas un *destinataire*. Si aucune ligne ne mène à l'enregistrement, la
  règle « pas de détecteur avant son destinataire » est violée par le geste même qui
  prétend l'honorer. D'où la condition du lien d'action.
- **« La règle des 3 alertes vient de toi » — non.** Elle vient de la règle 4.3 de
  `docs/FEUILLE-DE-ROUTE-PREUVE-ET-ANTICIPATION.md`. Mais sa présentation comme un
  acquis était bien une faute de rédaction : corrigée.

### Ce que l'arbitre a apporté

- Le **coût écran/charte** comme goulot réel — et il avait raison, le dépôt le
  documente page par page (§7.2). La v1 l'ignorait complètement.
- Le **fait brut** que la charte existe, est outillée et testée — et que la porte CI
  est **non bloquante par choix**. Ce n'est pas un détail de forme : cela déplace la
  recommandation de « créer » vers « serrer ».
- Une **méthode** que je n'avais pas appliquée : ne pas confondre « je n'ai pas trouvé
  dans les deux dossiers que j'ai ouverts » avec « il n'y a rien dans le dépôt ».
  Une affirmation d'absence exige une recherche exhaustive — ou une réserve explicite.

### Le point où je maintiens une différence après sa correction

Il conclut : « le chantier correct n'est pas *écrire la charte* mais *consolider les
pièces existantes en une spec unique que le script impose en CI* ». D'accord sur le
diagnostic, **pas sur le geste final** : le dépôt n'a pas besoin d'une « spec unique »
supplémentaire — `identite/CHARTE.md` + `DECISIONS-ENTERINEES.md` (D-001 → D-020) jouent
déjà ce rôle. Ce qui manque est **l'indexation** (D-0xx → contrôle → automatisable ou
`MANUEL`) et **le cran** (`--strict` sur les pages neuves). Consolider, oui ; réécrire,
non — ce serait ajouter un sixième document à cinq qui se recoupent déjà.

---

## 13. Annexe — la couture avec le quota étudiant étranger (964 h)

Le rapport initial est scopé au cœur pointage/paie ; la feature « 964 h » est parkée.
Les deux chantiers se rejoindront au même endroit — le détecteur **Plafond** — mais il
faut éviter de les confondre.

### 13.1 Correction v3 — ma description du 964 h était fausse

La v2 écrivait « cumul année civile, ne repart jamais à zéro ». **C'est inexact** sur
les deux points, et l'erreur change l'implémentation :

| Point | Ce que j'avais écrit (v2) | Ce qui est réel (source : rapport 964 h de l'IA Arbitre 1) |
| --- | --- | --- |
| Ancre | 1ᵉʳ janvier (année civile) | **Date du titre de séjour** de la personne |
| Remise à zéro | Jamais | **1 fois par an**, à l'anniversaire de l'ancre |
| Calcul | Somme brute | **Proratisé** sur la période couverte |

> Le rapport 964 h n'est **pas sur ma branche** : je reprends la mécanique de la source
> de l'arbitre 1, sans pouvoir la vérifier ici. C'est une dépendance de fait, et c'est
> noté comme telle — pas comme un fait constaté dans le code.

### 13.2 Les trois primitives, pas deux

| | Plafond hebdomadaire (R2) | Quota 964 h |
| --- | --- | --- |
| Forme | **Fenêtre** glissante de 7 jours | **Cumul ancré** : `[ancre, ancre + 12 mois)` |
| Remise à zéro | À chaque fenêtre | **À chaque anniversaire de l'ancre** |
| Proratisation | Non | **Oui** — partiel si la période est incomplète |
| Dépend de | Grille, heures réelles | Statut du salarié **+ date d'ancre** (titre de séjour) |
| Primitive | `somme_fenetre(employé, 7 j)` | `cumul_ancre(employé, ancre, prorata)` |

**Deux conséquences concrètes, à ne pas découvrir en production :**

1. **Le statut et l'ancre sont des données du salarié**, pas des réglages d'entreprise.
   Il faut les stocker (statut, date de début du titre, date de fin) et les historiser :
   un renouvellement déplace l'ancre, donc **réinitialise le compteur** — et l'ancien
   compteur doit rester lisible pour la preuve.
2. **La proratisation demande une règle explicite** : au jour (964 × jours couverts ÷ 365)
   ou au mois (964 ÷ 12) ? Les deux donnent des résultats différents sur une période
   incomplète, et c'est exactement le genre d'écart qu'un contrôle administratif relève.
   **Cette règle relève de D5** (valeur probante / source légale), pas d'un choix de
   développeur.

**Règle d'architecture, inchangée et même renforcée :** deux calculs distincts,
**une seule** couche de notification. Fusionner les deux produirait un détecteur qui
traite un cumul ancré comme une fenêtre de sept jours — faux deux fois, et faux du côté
le plus coûteux (franchissement d'un seuil légal).
