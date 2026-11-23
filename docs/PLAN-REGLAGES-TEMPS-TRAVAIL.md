# Réglages de temps de travail — entreprise, employé, contrats futurs

> **Statut : rien n'est résolu ici.** Les orientations de la section 2 sont *validées* par le
> fondateur, et les cinq décisions du 24/10/2026 sont **tranchées** (§6) ; aucune n'est
> **réalisée**. Ce document sert de liste de travaux et d'ordre d'exécution. Une ligne ne passe
> à « fait » qu'après correction livrée **et** validation du fondateur.
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
| **V-A3** | L'écran Entreprises actuel renvoie les non-super-administrateurs au tableau de bord : prévoir un accès **limité à l'entreprise concernée** sans ouvrir le registre complet — **tranché le 24/10 : page « Mon entreprise »** (§4, §6.5) | à faire |
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
| **V-D5** | Date d'effet, auteur, ancienne et nouvelle valeur conservés ; traitement de l'historique et des corrections décidé explicitement, sans réécrire le passé en silence | à faire (règle tranchée, §6.4) |

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

Précédence **arbitrée par le fondateur le 24/10/2026 : c'est l'acte explicite le plus récent
qui l'emporte, quelle que soit sa portée.** Une modification tardive d'un réglage d'entreprise
peut donc primer sur une valeur personnelle antérieure, et inversement. L'algorithme, pour une
clé et une date de référence :

1. retenir toutes les versions dont `date_effet <= date`, sur les trois portées
   (entreprise, contrat, employé) ;
2. gagner = la `date_effet` la plus grande ; à égalité, le `maj_le` le plus grand ; à égalité
   encore, la portée la plus étroite (`employé` > `contrat` > `entreprise`) ;
3. hors de ces cas, le `defaut_produit` — et seulement s'il est explicitement autorisé
   (décision §6.3) ;
4. toute valeur retenue expose `origine`, `date_effet`, `maj_par` : l'écran peut donc toujours
   dire *qui* a décidé, *quand*, et *ce que ça a écrasé*.

**Conséquence à assumer, et garde-fou associé.** Avec cette règle, un administrateur qui
modifie la règle d'entreprise **écrase silencieusement** les valeurs personnelles définies
avant. Deux protections, à valider :

- **(a) aperçu d'impact obligatoire** avant écriture : « ce changement concerne 12 employés,
  dont 3 ont une valeur personnelle plus ancienne qui sera remplacée » — nommés, avec la
  valeur perdue ;
- **(b) verrou facultatif** sur une valeur personnelle (`verrouille = true`) : une règle
  d'entreprise plus récente ne la remplace pas, seul un super-administrateur peut lever le
  verrou. Sans verrou, la règle (a) suffit à ne pas perdre l'information en silence.

Sans l'un des deux, la règle « le plus récent gagne » transforme chaque mise à jour du profil
entreprise en perte discrète d'arrangements individuels — c'est le seul risque réel de cette
orientation, et il est évitable à ce prix.

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

## 4. La page « Mon entreprise » (décision du 24/10/2026)

Le groupe **Réglages** existe déjà dans la barre (`sectionsNavAdmin.js` l. 88-94), avec
« Configuration pointeuse », « Géopointage » et « Reconnaissance faciale ». La demande du
fondateur est d'y ajouter **« Mon entreprise »** comme première page : profil, identité,
règles, et quelques repères selon le pays.

### 4.1 Ce que cette page règle, et pourquoi c'est la bonne base

1. **V-A3 trouve sa solution.** Aujourd'hui « Entreprises » est visible par tous
   (`sectionsNavAdmin.js` l. 103, `show: true`) puis renvoie les non-super-administrateurs au
   tableau de bord (`Entreprises.jsx` l. 204-212) : un faux accès, qui frustre et n'apprend
   rien. Avec « Mon entreprise », l'administrateur client a **sa** page, et « Entreprises »
   peut être réservé au super-administrateur (`show: admin?.role === 'super_admin'`). Cela
   règle l'accès **et** la première impression, sans inventer de route gardée.
2. **Un propriétaire unique par règle.** Le risque de cette page, c'est de devenir la
   quatrième maison d'une même règle. Le partage ci-dessous l'interdit.
3. **Le pays devient un champ de premier plan**, alors qu'il est aujourd'hui enterré dans le
   formulaire de création (`Entreprises.jsx`, `country_code`), avec un référentiel déjà en
   base (`countries_payroll_config`) et des jours fériés déjà multi-pays
   (`holidayService.js`).
4. **La fiche employé peut dire « hérite de Mon entreprise »** et pointer d'un clic vers la
   règle d'origine — c'est ce qui rend V-B3 tenable.

### 4.2 Une seule maison par règle

| Objet | Maison | Ne doit **pas** être ailleurs |
|---|---|---|
| Identité (nom, logo, adresses, identifiant légal, fuseau) | **Mon entreprise** | — |
| Pays | **Mon entreprise** | le formulaire de création hérite, il ne duplique pas |
| Repos minimum, alerte hebdo, second niveau | **Mon entreprise** | Configuration pointeuse, Heures supplémentaires, Planning |
| Pauses, tolérances, arrondis, comportement de la borne | Configuration pointeuse → Temps de travail | Mon entreprise (V-C3 : rien ne bouge ici pour l'instant) |
| Déclenchement de paie, taux de majoration | Heures supplémentaires | Mon entreprise |
| Jours fériés du pays | Page Jours fériés | Mon entreprise **pointe** vers la page, ne recopie pas la liste |
| Valeur personnelle d'un employé | Fiche Employé | Mon entreprise affiche seulement « N employés ont une valeur personnelle » |

C'est la traduction concrète des « quatre notions distinctes » du rapport (V-D2) : heures
prévues au contrat, seuil d'alerte, règles de paie, obligations légales ne partagent ni écran
ni clé.

### 4.3 Le pays est un acte structurant, pas un champ

Changer le pays change **les jours fériés**, **la configuration fiscale** et **les modèles
proposés**. La page doit donc :

- demander une confirmation qui **liste ce qui en dépend** (« 12 jours fériés, 1 barème
  fiscal, 3 modèles de temps de travail seront rechargés ») ;
- prendre effet **à une date**, et laisser une trace (auteur, ancienne valeur, nouvelle) ;
- prévenir si des employés ont un réglage personnel, et proposer l'aperçu d'impact (§3.3) ;
- être réservée au super-administrateur, ou à l'administrateur client avec une confirmation
  renforcée — **point à trancher**, une entreprise qui se trompe de pays fausse sa paie.

### 4.4 Les modèles (48 h, 50 h) et le pays

Un **modèle** est un jeu de valeurs nommé, pas un niveau empilé : il porte à la fois le seuil
haut hebdomadaire (48 h, 50 h…) et, s'il y a lieu, le repos minimum proposé. Table
`encheck_modeles_temps_travail` : `code`, `libelle`, `pays_cible` (nullable), `valeurs` (jsonb
clé → valeur), `statut_source`.

`statut_source` prend trois valeurs : `modele_produit` (défaut, assumé comme tel),
`a_sourcer` (le pays est connu, la valeur ne l'est pas), `source_verifiee` (D5 fait). Tant que
nous sommes en `modele_produit` ou `a_sourcer`, chaque carte porte la mention **« modèle
proposé, non vérifié pour votre pays — à confirmer »**, et le mot « légal » n'apparaît nulle
part.

À la création du profil, le modèle correspondant au pays est **pré-sélectionné, puis
confirmé par l'administrateur**. La valeur enregistrée naît `origine: entreprise` avec
`modele_utilise` conservé : c'est un **choix**, pas un repli. C'est ce qui satisfait P3 sans
rendre l'écran muet au premier jour.

### 4.5 Ce que la page n'est pas

- pas un tableau de conformité, pas de coche verte, pas de « conforme » ;
- pas un endroit où l'on déclare des obligations légales ;
- pas un second écran de paie : les taux et les déclenchements restent chez eux ;
- pas une page où l'on modifie les valeurs personnelles des employés : on les **voit**, on
  clique pour aller sur la fiche.

---

## 5. Ordre de réalisation

| Ordre | Lot | Contenu | E | É | Dépend de | Pourquoi ici |
|---|---|---|---|---|---|---|
| 1 | **G1** | Fenêtres hebdo et repos calculées sur une plage élargie, depuis les pointages bruts ; `donnees_completes` remplace le drapeau mort | S | — | — | Un réglage éditable sur un calcul faux à cheval sur deux années, c'est un bouton qui ment deux fois |
| 2 | **G2** | Provenance minimale (`entreprise` / `defaut_produit` / `historique_incertain`) + libellé honnête | S | S | — | Supprime le mensonge actuel (« seuil d'entreprise ») pour tous, tout de suite, sans toucher au calcul |
| 3 | **G3** | Table versionnée + `encheck_regle_resolue` + `encheck_regle_ecrire` + journal (auteur, date d'effet, avant/après) | M | — | G2 (origines) | Le journal **avant** l'éditeur : des seuils modifiables sans trace sont un bouton pour réécrire janvier depuis novembre (règle C5-mince de l'audit) |
| 4 | **G6** | Découpler l'alerte du module de paie (défaire `hoursCalculator.js` l. 389) et séparer les trois clés : déclenchement de paie / seuil d'alerte / plafond légal (`a_sourcer`) | S | S | G3 | Donner un bouton « repos personnel » alors que l'alerte s'éteint avec la paie serait livrer un réglage inopérant |
| 5 | **G4** | Page **« Mon entreprise »** : profil, identité, pays, règles de temps de travail ; accès de l'admin client ; « Entreprises » réservé au super-administrateur (V-A2, V-A3) | M | **M** | G3, G6 | Un écran « S » n'est pas une tâche « S » (audit §7.2) ; c'est la maison unique des règles d'entreprise (§4.2) |
| 6 | **G4b** | **Modèles 48 h / 50 h par pays** : table, pré-sélection à la création, confirmation explicite, `statut_source` | S | S | G4 | Les modèles sont un confort de saisie ; les brancher avant la page n'aurait aucun support |
| 7 | **G5** | Fiche employé : suivre l'entreprise ou valeur personnelle, clé par clé, retour à la règle générale, origine affichée | M | **M** | G3, G6, G4 | Après G4, sinon l'héritage n'a pas de parent à hériter |
| 8 | **G7** | Affichage de la provenance et de « contrôle indisponible » dans les écrans d'alerte et le Planning (V-B3, V-C2) | S | S | G2, G6 | Rendre visible ce que G3-G5 savent, sans ajouter de règle |
| 9 | **G8** | Contrats : date d'effet, emplacement `contrat_id`, historique, distinction des quatre notions (V-D1, V-D2, V-D5) | M | S | G3, §6.1 | Conception maintenant, code quand le module contrats se précise |
| 10 | **G9** | Snapshots de calcul : ne pas activer avant G1 et avant décision sur l'historique | — | — | G1 | Figer un calcul faux au 31/12 est exactement ce que le rapport interdit |

**G1 et G2 sont indépendants** et peuvent être menés en parallèle, une PR chacun. Le reste est
séquentiel : G3 avant toute interface, G4 avant G4b et G5.

**Rien de tout cela ne remplace R3** (« écran des seuils », audit §7) : G4/G5 n'en est que la
part « temps de travail », entreprise + employé. R3 reste bloqué par C5-mince et D3.

---

## 6. Décisions du 24/10/2026

Elles sont **tranchées** ; elles n'en sont pas moins **non réalisées**. Aucune ligne ci-dessous
ne vaut pour « fait ».

### 6.1 Précédence des réglages — tranchée : l'acte le plus récent gagne

Un contrat signé plus tard peut écraser une valeur personnelle antérieure ; une modification
tardive du paramètre employé peut tout autant primer sur la règle d'entreprise, et une
modification tardive de la règle d'entreprise peut primer sur une valeur personnelle plus
ancienne. **Aucune portée n'est prioritaire par nature : c'est la date de l'acte qui décide.**
L'algorithme complet est au §3.3, avec l'aperçu d'impact et le verrou facultatif qui évitent la
perte silencieuse d'arrangements individuels.

### 6.2 Second niveau hebdomadaire — tranché : conservé, sous forme de modèles

Pas un second seuil empilé : un **seuil haut** porté par un modèle nommé (48 h, 50 h…), choisi
selon le pays de l'entreprise et **confirmé explicitement** au moment du profil (§4.4). Les
modèles ne sont pas des obligations : tant que D5 n'est pas sourcé, leur statut reste
`modele_produit` ou `a_sourcer` et la mention « à confirmer » s'affiche.

### 6.3 Défaut produit 40 h — tranché : option (a)

Le défaut produit alimente encore l'alerte pendant la transition, **étiqueté** « valeur par
défaut du produit (40 h), à confirmer ». Dès que l'entreprise confirme un modèle ou saisit sa
valeur, celle-ci prend l'origine `entreprise` et le repli disparaît de l'écran. Passage à
l'option (b) — contrôle indisponible tant que rien n'est configuré — quand les entreprises
existantes auront un profil renseigné.

### 6.4 Rétroactivité — tranchée : le passé ne bouge pas

Une valeur prend effet à sa `date_effet`. Les semaines et les mois déjà calculés restent
calculés avec la valeur en vigueur à leur date. Corriger le passé est une **action explicite**
(geste dédié, motif, trace auteur / avant / après), jamais un effet de bord d'une saisie.

### 6.5 Accès de l'administrateur à son entreprise — tranché : la page « Mon entreprise »

Ni onglet dans une fiche entreprise, ni route `/entreprises/:id` : une page du groupe
**Réglages**, alimentée par `admin.enterprise_id` (présent dans l'objet admin, `Login.jsx`
l. 476-477) et par le sélecteur d'entreprise pour les super-administrateurs. « Entreprises »
passe en `show: admin?.role === 'super_admin'`, ce qui supprime la redirection actuelle
(`Entreprises.jsx` l. 204-212).

### 6.6 Ce qui reste à trancher

1. **Verrou facultatif** sur une valeur personnelle (§3.3, protection b) : oui ou non ?
   Recommandation : oui, réservé au super-administrateur pour le lever.
2. **Qui peut changer le pays** d'une entreprise : super-administrateur seul, ou admin client
   avec confirmation renforcée ? Recommandation : super-administrateur seul, parce que le pays
   change les jours fériés, le barème fiscal et les modèles.

## 7. Tests à écrire, lot par lot

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

**G3 — résolution, précédence et écriture**
- surcharge personnelle sur **une** clé : les autres clés restent celles de l'entreprise ;
- retour à la règle générale : la ligne personnelle est archivée, pas supprimée ;
- aucune valeur nulle part ⇒ `origine = 'aucune'`, contrôle indisponible ;
- `date_effet` : la valeur d'hier s'applique au 15/01, la nouvelle au 01/02 ;
- **précédence (décision §6.1)** : contrat signé après une valeur personnelle ⇒ le contrat
  gagne ; valeur personnelle modifiée après le contrat ⇒ elle reprend la main ; règle
  d'entreprise postérieure à une valeur personnelle ⇒ elle gagne ; dates d'effet identiques ⇒
  la portée la plus étroite gagne ;
- **aperçu d'impact** : une écriture d'entreprise qui écraserait 3 valeurs personnelles exige
  une confirmation qui **nomme** les 3 employés et la valeur perdue ; sans confirmation,
  aucune écriture (test sur le refus, pas seulement sur l'affichage) ;
- **verrou** (si retenu) : une valeur verrouillée n'est pas remplacée par une règle
  d'entreprise postérieure, seul un super-administrateur la déverrouille ;
- droits : admin de A refusé sur B (test au niveau RPC, pas seulement à l'écran) ;
- employé d'une autre entreprise refusé ;
- valeur hors bornes refusée **par la RPC** ;
- journal : auteur, ancienne valeur, nouvelle valeur, date, sur chaque écriture.

**G4 — page « Mon entreprise »** (patron `configurationPointeuse.test.jsx`)
- un administrateur client voit « Mon entreprise » et **ne voit plus** « Entreprises »
  (aujourd'hui : visible puis redirection — test de non-régression sur les deux) ;
- il ne voit aucune autre entreprise, et ne peut en écrire aucune (le test d'écriture passe par
  la RPC, pas par l'écran) ;
- l'identité et le pays s'affichent ; la modification du pays exige une confirmation qui
  **liste** jours fériés, barème fiscal et modèles rechargés, et laisse une trace ;
- aucune valeur « légale », aucun verdict de conformité sur la page ;
- la page renvoie vers Jours fériés et vers les fiches employés concernées, sans recopier
  ni la liste des fériés ni les valeurs personnelles ;
- thème clair et sombre, 320 / 390 / 768 et 1440 px.

**G4b — modèles 48 h / 50 h**
- le modèle proposé dépend du `country_code` de l'entreprise ;
- il est **pré-sélectionné mais non appliqué** : sans confirmation, aucune valeur n'est écrite ;
- après confirmation : `origine = 'entreprise'`, `modele_utilise` conservé, plus de mention
  « défaut produit » ;
- un modèle dont `statut_source` n'est pas `source_verifiee` affiche « à confirmer » ; le mot
  « légal » n'apparaît dans aucun libellé ;
- changer de pays ne change **pas** silencieusement une valeur déjà confirmée : le test doit
  vérifier qu'une confirmation est redemandée.

**G5 — fiche employé**
- « suit l'entreprise » par défaut, surcharge explicite clé par clé, retour possible ;
- l'écran dit l'origine de chaque valeur, et « hérite de Mon entreprise » pointe vers G4 ;
- contrôle indisponible affiché quand la valeur manque — jamais une coche verte ;
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

## 8. Contradictions et points de vigilance avec les travaux en cours

1. **PR #308 (F4, F5, C1)** est ouverte. **C1 (écriture de snapshots) ne doit pas être
   activée avant G1**, ni avant la décision du §6.4 : elle figerait un calcul faux au 31/12,
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

## 9. Ce qui reste ouvert

- Aucune valeur « légale » : les 14 pays sont `a_sourcer` (D5). `plafond_legal_heures`
  restera vide tant que la source n'est pas vérifiée ; les modèles 48 h / 50 h restent des
  valeurs d'entreprise **proposées**, jamais des obligations.
- **Deux points de la décision du 24/10 restent ouverts** (§6.6) : le verrou facultatif sur une
  valeur personnelle, et qui peut changer le pays d'une entreprise.
- Le contenu exact des modèles par pays (repos minimum, seuil haut) n'est pas arrêté : il
  dépend de la source D5, et d'ici là les cartes portent « à confirmer ».
- Le sort de l'historique 40/48 déjà en base n'est pas décidé (on sait seulement qu'il faut
  l'étiqueter, pas le réécrire).
- La migration des réglages de pause vers « Mon entreprise » n'est **pas** décidée : V-C3 dit
  qu'ils restent où ils sont, et rien ici ne les déplace.
- Les repères concurrentiels du rapport ne sont pas des prescriptions : aucun compte
  concurrent n'a été testé.
