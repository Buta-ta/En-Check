# Réglages de temps de travail — entreprise, employé, contrats futurs

> **Statut : rien n'est résolu ici.** Les orientations de la section 2 sont *validées en
> principe* par le fondateur ; aucune n'est réalisée. Ce document sert de liste de travaux
> et d'ordre d'exécution. Une ligne ne passe à « fait » qu'après correction livrée **et**
> validation du fondateur.
>
> **Révision vérifiée :** `origin/main` = `ab88b33` (« Les demandes de changement de planning
> se traitent comme une file », #311). Entre la base de cette branche (`41288af`) et `ab88b33`,
> **aucun** des fichiers de calcul et de réglages n'a changé (`hoursCalculator.js`,
> `featureService.js`, `seuilsPointage.js`, `plafondHebdomadaire.js`, `reposQuotidien.js`,
> `ConfigurationPointeuse.jsx`, `Entreprises.jsx`, `HeuresSupplementaires.jsx`, migrations) :
> les références de ligne ci-dessous sont donc valables sur `main` aujourd'hui.
> La révision `5a84e77` citée par le rapport n'existe pas dans ce clone ; le contrôle a été
> refait sur `ab88b33`, ce qui aboutit à la même conclusion pour les fichiers concernés.
>
> PR #308 (F4 + F5 + primitive C1) est **toujours ouverte**, non fusionnée.

---

## 1. Vérification des constats du rapport

| # | Constat du rapport | Verdict | Preuve dans le code |
|---|---|---|---|
| 1 | Le contrôle hebdomadaire raisonne en semaines lundi→dimanche, pas en fenêtres glissantes de 7 jours | **Confirmé** | `src/services/plafondHebdomadaire.js` — `semainesDeLaPeriode` / `lundiDe` (l. 48-88) |
| 2 | Il réutilise les seuils d'heures supplémentaires quand le module est actif ; ce ne sont pas des plafonds vérifiés | **Confirmé** | `hoursCalculator.js` l. 389-391 : `hasOvertimeFeature && overtimeSettings ? …weekly_threshold : null` |
| 3 | 40 h / 48 h servent de repli quand les réglages sont absents **ou illisibles** | **Confirmé** | `featureService.js` l. 378-386 (défauts) + `getOvertimeSettings` : `catch` → défauts |
| 4 | Une sauvegarde peut enregistrer ces replis sans choix visible | **Confirmé** | `featureService.js` l. 430-431 (`|| 40`, `|| 48`) ; formulaire `HeuresSupplementaires.jsx` sans ces deux champs |
| 5 | Les valeurs sont présentées comme venant de « l'entreprise » | **Confirmé** | `plafondHebdomadaire.js` l. 198 `source: 'entreprise'` ; message l. 215 : « seuil hebdomadaire d'entreprise (48 h) » |
| 6 | Le repos entre deux journées a une valeur absente et aucun champ de configuration normal | **Confirmé dans le code** — non infirmable en production (aucune donnée réelle consultée, et il ne faut pas l'affirmer) | `seuilsPointage.js` l. 57 (`reposQuotidienHeures: null`) ; `encheck_seuil_ecrire` refuse toute clé hors pauses (`20261105000001_…sql` l. 73) ; aucune occurrence dans `src/pages` ni `src/components` |
| 7 | Semaine fictive 29/12/2025 → 04/01/2026 : 30 h comptées en décembre, 20 h en janvier | **Confirmé, chiffres exacts** (30 h / 20 h, 0 dépassement des deux côtés) | `hoursCalculator.js` l. 675 ; mesuré sur données fictives (§1.2) |
| 8 | La semaine était « indiquée complète » malgré la troncature | **Non reproduit** (les deux côtés rendent `complete: false`) — mais le drapeau n'est **lu par aucun écran** : voir §1.1 | `plafondHebdomadaire.js` l. 180 : `complete: joursDansLaPeriode === 7` |
| 9 | La fiche employé a déjà « Poste & Contrat » | **Confirmé** | `FicheEmployeModal.jsx` l. 563 |
| 10 | Rémunérations → Contrats porte des heures prévues par mois, sans piloter les alertes | **Confirmé** | `Remunerations.jsx` l. 83 (`contract_hours_per_month`) ; aucune lecture dans `hoursCalculator.js` |

### 1.1 Le point 8 : le rapport se trompe sur la cause, pas sur le danger

Mesure faite sur `ab88b33` : pour la semaine 29/12 → 04/01 calculée côté décembre,
`joursDansLaPeriode` vaut **3** (29, 30, 31) et non 7, donc `complete` vaut **`false`** —
idem côté janvier (`4` jours, `false`). L'observation « semaine annoncée complète » ne se
reproduit donc pas ici ; elle venait probablement de la copie isolée utilisée pour l'essai,
où les bornes de période avaient été adaptées.

**Le défaut est néanmoins réel, et il est double :**

1. le drapeau `complete` est **mort** — produit en un seul endroit (l. 180), lu nulle part
   (`grep` sur `src/pages`, `src/components`, `hoursCalculator.js`) : l'écran affiche donc
   « 30 h » sans jamais dire que la semaine est tronquée, alors même que l'information
   exacte (`false`) était disponible ;
2. même lu, il mesurerait la **fenêtre demandée**, pas la **donnée disponible** : une semaine
   entière dans la fenêtre mais calculée sur trois jours de pointages serait dite complète.
   Un jour de repos (0 h connue) et un jour non calculé (0 h par absence de données) ne sont
   pas distinguables aujourd'hui — et cette confusion, elle, produirait un faux positif.

À corriger en même temps que le point 7, avec une notion explicite
`donnees_completes` dérivée des jours réellement calculés, et un écran qui l'affiche.

### 1.2 Reproduction sur données fictives (moteur réel, aucun accès aux données client)

Mesuré sur ce même arbre, fonctions pures exportées (`agregerParSemaine` +
`evaluerSeuilsHebdo`), fichier de test temporaire supprimé après exécution. Semaine
29/12/2025 → 04/01/2026, cinq journées fictives de 10 h (3 en décembre, 2 en janvier),
seuil fictif 48 h :

| Fenêtre demandée | Heures vues | Jours dans la fenêtre | `complete` | Dépassement |
|---|---|---|---|---|
| décembre (`01/12` → `31/12`) | **30 h** | 3 | `false` | **0** |
| janvier (`01/01` → `31/01`) | **20 h** | 4 | `false` | **0** |
| semaine entière (`29/12` → `04/01`) | **50 h** | 7 | `true` | **1 — 2 h** |

Le même travail produit donc trois lectures différentes selon la borne qu'on demande, et
**seule la troisième dit la vérité**. Les totaux mensuels et annuels ne sont pas faux ;
seules les fenêtres qui débordent l'année civile (D1, D2) sont amputées.

Reproduction complémentaire, sur le repos cette fois : sortie 31/12 à 23 h 10, reprise
01/01 à 05 h 40, minimum fictif 11 h ⇒ le 01/01 est vu avec `debut`/`fin` à `null`,
écarts `[]`, **0 violation** ; avec les horodatages réels sur la même fonction : **6 h 30**
de repos, **4 h 30** manquantes, **1 violation**.

### 1.3 Un constat que le rapport n'a pas vu

L'alerte hebdomadaire **disparaît** si le module « heures supplémentaires » est désactivé
(`hoursCalculator.js` l. 389-391). Un seuil d'alerte n'est pas une règle de paie : couper la
paie ne doit pas couper le contrôle. C'est exactement ce que le §3 du rapport interdit de
présumer (« ne pas présumer qu'un seuil d'alerte doit être conditionné au module de paie »).
Cette ligne de code est de mon fait (lot D1) : elle est à défaire.

---

## 2. Orientations validées, reformulées en exigences

| Id | Exigence validée | Statut |
|---|---|---|
| **V-A1** | Les règles générales de temps de travail se règlent **par entreprise**, séparément : seuil d'alerte hebdomadaire, minimum de repos, second niveau hebdomadaire si conservé | à faire |
| **V-A2** | Un administrateur modifie les règles des entreprises **auxquelles il a accès**, et d'aucune autre — contrôle **côté serveur**, pas seulement à l'écran | à faire |
| **V-A3** | L'écran Entreprises actuel renvoie les non-super-administrateurs au tableau de bord : prévoir un accès **limité à l'entreprise concernée** sans ouvrir le registre complet | à faire |
| **V-B1** | Sur la fiche employé : suivre la règle de l'entreprise **ou** une valeur personnelle, **clé par clé** (un repos personnel peut coexister avec le seuil hebdomadaire d'entreprise) | à faire |
| **V-B2** | Retour à la règle de l'entreprise possible à tout moment, sans perte d'historique | à faire |
| **V-B3** | Chaque écran dit **d'où vient la valeur** : entreprise, réglage personnel, repli identifié, origine incertaine. Aucune valeur applicable ⇒ « contrôle indisponible », jamais une conformité déduite | à faire |
| **V-C1** | Le Planning peut montrer des alertes sur les horaires **prévus**, avec lien vers le réglage ou la fiche ; pas de copie contradictoire de la même règle entre écrans | à faire |
| **V-C2** | Alertes de planning prévu et contrôles sur heures **pointées** restent deux choses distinctes | à faire |
| **V-C3** | Les réglages de pause restent dans Configuration pointeuse → Temps de travail ; **aucun** champ d'administration sur la borne employé | inchangé (rien à faire) |
| **V-D1** | Préparer le lien avec les contrats sans double saisie ni présupposé qu'un module contrats complet existe | à concevoir |
| **V-D2** | Heures prévues au contrat ≠ seuil d'alerte ≠ règles de paie ≠ obligations légales : quatre notions distinctes, jamais fusionnées | à faire |
| **V-D3** | Un réglage individuel d'alerte ne doit pas servir à contourner un droit applicable | à faire |
| **V-D4** | Aucune valeur présentée comme légale sans source vérifiée pour le pays et le contexte (D5) | bloqué (D5) |
| **V-D5** | Date d'effet, auteur, ancienne et nouvelle valeur conservés ; traitement de l'historique et des corrections décidé explicitement, sans réécrire le passé en silence | à faire |

---

## 3. Modèle de données proposé (compatible contrats futurs)

### 3.1 Pourquoi une table neuve, et pas une colonne `employee_id`

`encheck_reglages_pointage` n'existe pas dans les migrations (table de production) ; son
index unique partiel porte sur `(enterprise_id, cle) WHERE enterprise_id IS NOT NULL`, et
`encheck_seuil_ecrire` s'appuie dessus. Ajouter `employee_id` y produirait deux pièges :
un `NULL` dans un index unique PostgreSQL n'est pas dédupliqué (doublons de la règle
d'entreprise), et la signature `encheck_seuil_ecrire(…)` est déjà consommée par l'écran des
pauses — dont le déplacement n'est pas décidé (V-C3).

### 3.2 Table versionnée `encheck_regles_temps_travail`

Une ligne = une valeur applicable à partir d'une date, pour une portée donnée.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | clé |
| `cle` | text | `repos_minimum_heures`, `alerte_hebdo_heures`, `alerte_hebdo_niveau2_heures`, `declenchement_paie_hebdo_heures`, `plafond_legal_heures` |
| `entreprise_id` | uuid not null | portée minimale |
| `employe_id` | uuid null | `NULL` = règle d'entreprise ; non nul = surcharge personnelle |
| `contrat_id` | uuid null | **emplacement réservé** : plus tard, la règle pourra être portée par un contrat, sans refonte |
| `valeur` | numeric null | `NULL` explicite = « non configuré », distinct de « absent » |
| `date_effet` | date not null | à partir de quand |
| `maj_le`, `maj_par` | timestamptz / uuid | traçabilité |
| `remplace_id` | uuid null | chaînage des versions (historique append-only) |

Index partiels : `(entreprise_id, cle, date_effet) WHERE employe_id IS NULL`,
`(employe_id, cle, date_effet) WHERE employe_id IS NOT NULL`.
RLS : lecture selon l'accès à l'entreprise ; écriture seulement par RPC.

### 3.3 Résolution

`encheck_regle_resolue(p_entreprise, p_employe, p_cle, p_date)` retourne
`{ valeur, origine, date_effet, maj_par }` avec
`origine ∈ 'employe' | 'contrat' | 'entreprise' | 'defaut_produit' | 'historique_incertain' | 'aucune'`.

Chaque clé se résout **séparément** : c'est la condition de V-B1, et c'est aussi ce qui
empêche de recréer un « bloc de réglages » indivisible.

Précédence proposée : **employé > contrat > entreprise > défaut produit**. Elle doit être
tranchée par le fondateur avant G3 (voir §5), parce qu'un contrat peut être signé après coup.

`historique_incertain` est indispensable : les valeurs 40/48 déjà écrites en base par
`saveOvertimeSettings` ne permettent pas de savoir si l'entreprise les a choisies. On ne
reconstitue pas une intention — on l'étiquette.

### 3.4 Écriture

Nouvelle RPC `encheck_regle_ecrire(...)` — **ne pas** modifier `encheck_seuil_ecrire` :
- contrôle admin via `admin_has_access_to_enterprise` (déjà en base, `20261025000009` l. 32)
  et `encheck_est_admin_de` ;
- l'employé visé doit appartenir à l'entreprise visée ;
- bornes contrôlées **avant** écriture, dans la RPC, pas seulement dans le formulaire ;
- refus explicite (`Réglage inconnu`, `Hors périmètre`, `Valeur hors bornes`), avec un motif
  affichable — jamais un échec silencieux.

---

## 4. Ordre de réalisation

| Ordre | Lot | Contenu | E | É | Dépend de | Pourquoi ici |
|---|---|---|---|---|---|---|
| 1 | **G1** | Fenêtres hebdo et repos calculées sur une plage élargie, depuis les pointages bruts ; `donnees_completes` remplace le drapeau mort | S | — | — | Un réglage éditable sur un calcul faux à cheval sur deux années, c'est un bouton qui ment deux fois |
| 2 | **G2** | Provenance minimale (`entreprise` / `defaut_produit` / `historique_incertain`) + libellé honnête | S | S | — | Supprime le mensonge actuel (« seuil d'entreprise ») pour tous, tout de suite, sans toucher au calcul |
| 3 | **G3** | Table versionnée + `encheck_regle_resolue` + `encheck_regle_ecrire` + journal (auteur, date d'effet, avant/après) | M | — | G2 (origines) | Le journal **avant** l'éditeur : des seuils modifiables sans trace sont un bouton pour réécrire janvier depuis novembre (règle C5-mince de l'audit) |
| 4 | **G6** | Découpler l'alerte du module de paie (défaire `hoursCalculator.js` l. 389) et séparer les trois clés : déclenchement de paie / seuil d'alerte / plafond légal (`a_sourcer`) | S | S | G3 | Donner un bouton « repos personnel » alors que l'alerte s'éteint avec la paie serait livrer un réglage inopérant |
| 5 | **G4** | Écran Entreprises : règles de temps de travail par entreprise + accès restreint des admins (V-A2, V-A3) | M | **M** | G3, G6 | Un écran « S » n'est pas une tâche « S » (audit §7.2) |
| 6 | **G5** | Fiche employé : suivre l'entreprise ou valeur personnelle, clé par clé, retour à la règle générale | M | **M** | G3, G6 | Après G4, sinon l'héritage n'a pas de parent à hériter |
| 7 | **G7** | Affichage de la provenance et de « contrôle indisponible » dans les écrans d'alerte (V-B3, V-C2) | S | S | G2, G6 | Rendre visible ce que G3-G6 savent, sans ajouter de règle |
| 8 | **G8** | Contrats : date d'effet, emplacement `contrat_id`, historique, distinction des quatre notions (V-D1, V-D2, V-D5) | M | S | G3, décision §5 | Conception maintenant, code quand le module contrats se précise |
| 9 | **G9** | Snapshots de calcul : ne pas activer avant G1 et avant décision sur l'historique | — | — | G1 | Figer un calcul faux au 31/12 est exactement ce que le rapport interdit |

**G1 et G2 sont indépendants** et peuvent être menés en parallèle, une PR chacun. Le reste est
séquentiel : G3 avant toute interface, G4 avant G5.

**Rien de tout cela ne remplace R3** (« écran des seuils », audit §7) : G4/G5 n'en est que la
part « temps de travail », entreprise + employé. R3 reste bloqué par C5-mince et D3.

---

## 5. Ce qui doit être tranché avant G3

1. **Précédence contrat vs employé.** Un contrat signé plus tard doit-il écraser une valeur
   personnelle saisie avant ? Sans réponse, la colonne `contrat_id` restera vide et le sera
   pour toujours.
2. **Second niveau hebdomadaire** : conservé (48 h) ou supprimé ? Aujourd'hui il produit un
   message, pas une décision de paie.
3. **Le défaut produit 40 h doit-il encore alimenter l'alerte ?** Deux options honnêtes :
   (a) il alimente l'alerte, étiqueté « valeur par défaut du produit (40 h), à confirmer » ;
   (b) il n'alimente plus rien et l'alerte est « indisponible » jusqu'à configuration.
   L'option (b) est la plus stricte (V-B3), l'option (a) évite de rendre l'écran muet chez
   tous les clients existants. **Recommandation : (a) pendant la transition, (b) à terme.**
4. **Rétroactivité.** Une valeur prenant effet au 1er du mois corrige-t-elle les semaines
   déjà calculées ? Par défaut : non — le passé reste calculé avec la valeur en vigueur à
   sa date, et une correction est une action explicite, tracée.
5. **Accès admin à l'entreprise (V-A3)** : onglet dédié dans une fiche entreprise accessible,
   ou route `/entreprises/:id` avec garde. À maquetter avant G4.

---

## 6. Tests à écrire, lot par lot

**G1 — fenêtre à cheval sur deux années**
- semaine 29/12/2025 → 04/01/2026, 5 × 10 h (3 jours en décembre, 2 en janvier) : la semaine
  doit être vue **une fois**, à 50 h, avec un dépassement de 2 h au seuil de 48 h ;
- côté décembre **et** côté janvier, le même total doit apparaître (pas 30 h / 20 h) ;
- repos : sortie 31/12 23 h 10, reprise 01/01 05 h 40, minimum fictif 11 h ⇒ 6 h 30 mesurées,
  manque 4 h 30, 1 écart — aujourd'hui : `debut`/`fin` null, 0 écart ;
- cas symétrique (fenêtre de janvier amputée du 29-31/12) ;
- fuseau : le calcul reste en UTC, la bascule de grille ne déplace pas la journée ;
- données incomplètes : `donnees_completes = false` affiché, **aucun** « 0 dépassement »
  silencieux ;
- **non-régression paie** : totaux du mois et de l'année **identiques** avant/après (G1 ne
  change que les fenêtres, jamais la paie).

**G2 — provenance et libellé**
- base sans ligne `overtime_settings` ⇒ origine `defaut_produit`, message sans le mot
  « entreprise » ;
- erreur de lecture ⇒ même étiquette, jamais « entreprise » ;
- ligne existante ⇒ `entreprise` ;
- une valeur historique 40/48 non saisissable ⇒ `historique_incertain` ;
- aucun test ne doit contenir le mot « légal ».

**G3 — résolution et écriture**
- surcharge personnelle sur **une** clé : les autres clés restent celles de l'entreprise ;
- retour à la règle générale : la ligne personnelle est archivée, pas supprimée ;
- aucune valeur nulle part ⇒ `origine = 'aucune'`, contrôle indisponible ;
- `date_effet` : la valeur d'hier s'applique au 15/01, la nouvelle au 01/02 ;
- droits : admin de A refusé sur B (test au niveau RPC, pas seulement à l'écran) ;
- employé d'une autre entreprise refusé ;
- valeur hors bornes refusée **par la RPC** ;
- journal : auteur, ancienne valeur, nouvelle valeur, date, sur chaque écriture.

**G4 / G5 — écrans** (patron `configurationPointeuse.test.jsx`)
- l'écran dit l'origine de chaque valeur ;
- « suit l'entreprise » par défaut, surcharge explicite, retour possible ;
- contrôle indisponible affiché quand la valeur manque — jamais une coche verte ;
- admin non super-admin : accès à son entreprise seulement, aucune autre visible ;
- thème clair et sombre, 320 / 390 / 768 / 1440 px.

**G6 — découplage et séparation**
- module heures supplémentaires **désactivé** ⇒ l'alerte hebdomadaire existe toujours ;
- modifier le seuil d'alerte ne change **aucun** montant de paie ;
- modifier le déclenchement de paie ne change **aucune** alerte ;
- `plafond_legal_heures` sans source ⇒ jamais évalué, jamais « conforme ».

**G7 — messages**
- origine incertaine : formulation explicite, pas d'invention ;
- planning prévu vs heures pointées : deux libellés distincts, deux sources distinctes.

**G8 — contrats**
- `contract_hours_per_month` ne déclenche aucune alerte (verrou anti-régression) ;
- une règle portée par un contrat respecte `date_effet` ;
- une modification rétroactive ne change pas un résultat passé sans action explicite tracée.

---

## 7. Contradictions et points de vigilance avec les travaux en cours

1. **PR #308 (F4, F5, C1)** est ouverte. **C1 (écriture de snapshots) ne doit pas être
   activée avant G1**, ni avant la décision du §5.4 : elle figerait un calcul faux au 31/12,
   exactement ce que le rapport interdit. F4 (bornes) et F5 (recherche) sont sans conflit.
2. **#311 (file de demandes de planning)**, fusionnée : elle manipule du planning *prévu*.
   Elle ne doit pas servir de source à un contrôle de conformité (V-C2).
3. **D2 (repos quotidien) est fusionné mais inopérant** : `repos_quotidien_heures` n'a ni UI
   ni chemin d'écriture. Il ne doit pas être présenté comme actif tant que G3/G4 ne sont pas
   livrés — et G1 reste nécessaire pour qu'il soit juste au passage d'année.
4. **D1 (plafond hebdomadaire) est fusionné et branché** sur un calcul amputé aux bornes
   d'année, avec une alerte conditionnée au module de paie (l. 389). Deux défauts, tous deux
   listés ici (G1, G6).
5. **C5-mince (journal des décisions)** n'est pas encore fait. G3 en tient lieu **pour les
   règles de temps de travail uniquement** ; le journal général reste à faire.
6. Le rapport demande de ne pas figer de résultats erronés : `snapshotCalcul.js` (PR #308)
   est une primitive neutre, mais son **activation** est un choix, pas une évidence.

---

## 8. Ce qui reste ouvert

- Aucune valeur « légale » : les 14 pays sont `a_sourcer` (D5). `plafond_legal_heures`
  restera vide tant que la source n'est pas vérifiée.
- Le mode d'accès exact des admins à leur entreprise (V-A3) n'est pas conçu.
- La précédence contrat / employé n'est pas tranchée.
- Le sort de l'historique 40/48 déjà en base n'est pas décidé (on sait seulement qu'il faut
  l'étiqueter, pas le réécrire).
- Les repères concurrentiels du rapport ne sont pas des prescriptions : aucun compte
  concurrent n'a été testé.
