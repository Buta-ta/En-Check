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

### 3.5 Les règles personnelles, précisément

C'est la partie V-B, désormais arbitrée (verrou accepté le 24/10). Une valeur personnelle
n'est pas un « second réglage » : c'est une **décision nominative** qui entre dans la même
course que les autres, avec une exception explicite — le verrou.

#### a) Ce qu'un employé peut personnaliser — et ce qu'il ne peut pas

| Clé | Personnalisable | Bornes techniques | Raison |
|---|---|---|---|
| `repos_minimum_heures` | **oui** | > 0 et ≤ 24 | une valeur à 0 ne serait pas un réglage, ce serait la suppression du contrôle |
| `alerte_hebdo_heures` | **oui** | > 0 et ≤ 168 | |
| `alerte_hebdo_niveau2_heures` | **oui** | > `alerte_hebdo_heures`, ≤ 168 | un second niveau sous le premier n'a pas de sens |
| `declenchement_paie_hebdo_heures` | **non** | — | c'est une règle de **paie** : elle ne se personnalise pas par salarié (V-D2) |
| `plafond_legal_heures` | **non** | — | `a_sourcer` (D5) ; rien à personnaliser tant que la source n'existe pas |
| pauses, tolérances, arrondis, bascule | **non** | — | comportement de la borne, pas une règle individuelle (V-C3) |
| heures prévues au contrat | **non** | — | `contract_hours_per_month` : une autre notion, un autre écran |

Les bornes ci-dessus sont **techniques**. Aucune n'est un minimum ou un maximum « légal », et
aucun libellé d'écran ne doit le suggérer.

#### b) Les trois états d'une valeur personnelle

1. **`suit_entreprise`** — l'état par défaut, matérialisé par *l'absence* de ligne
   personnelle. Rien à créer, rien à nettoyer.
2. **`personnelle`** — une ligne avec sa `date_effet`. Elle participe à la course des actes :
   elle l'emporte sur toute valeur plus ancienne, et perd contre toute valeur plus récente
   (contrat ou entreprise comprise).
3. **`personnelle_verrouillee`** — même chose, plus une protection : **une règle
   d'entreprise postérieure ne la remplace pas**. Seul un super-administrateur lève le
   verrou, par un acte tracé (auteur, date, motif).

Le verrou se pose au niveau de l'entreprise (l'administrateur qui gère l'accord), et ne se
lève qu'au niveau supérieur. C'est volontairement asymétrique : celui qui accorde ne peut pas
reprendre seul.

#### c) Résolution, verrou compris

Pour une clé et une date de référence :

1. une valeur personnelle **verrouillée** et déjà en vigueur gagne, **quelle que soit** la
   date des règles d'entreprise ou de contrat ;
2. sinon, l'**acte le plus récent** gagne (§3.3) ; à égalité de date d'effet, la portée la
   plus étroite ;
3. sinon le `defaut_produit`, **et seulement s'il est autorisé** (§6.3) ;
4. sinon : `aucune` — et l'écran dit « contrôle indisponible ». Jamais une conformité.

#### d) Aperçu d'impact, avec le verrou

Avant toute écriture d'entreprise, l'écran compte et **nomme** :

- les employés dont la valeur personnelle sera **remplacée** (avec l'ancienne et la nouvelle) ;
- les employés **verrouillés, non concernés** — ils doivent apparaître, sinon l'administrateur
  croit avoir tout changé alors que trois accords tiennent.

Sans confirmation explicite, **aucune écriture**. Le refus se teste au niveau de l'écriture,
pas seulement de l'affichage.

#### e) Cycle de vie

| Acte | Effet |
|---|---|
| poser une valeur personnelle | nouvelle version, `date_effet`, `maj_par` |
| la modifier | nouvelle version ; l'ancienne reste dans l'historique |
| **revenir à la règle de l'entreprise** | la version est **archivée**, jamais supprimée : on doit pouvoir dire ce qui s'appliquait avant, et quand |
| verrouiller / déverrouiller | acte tracé, avec motif |
| fin de contrat, départ | l'historique reste ; aucune valeur n'est réécrite rétroactivement |
| contrat signé plus tard | acte explicite ⇒ entre dans la course ; ne remplace **pas** une valeur verrouillée |

#### f) Ce que voit l'employé, et ce qu'il ne peut pas faire

- sa fiche affiche la valeur applicable, **son origine**, sa date d'effet et, le cas échéant,
  « verrouillée le … par … » ;
- il ne modifie rien lui-même : aucun champ d'administration sur la borne employé (V-C3) ;
- s'il n'y a pas de valeur applicable, l'écran le dit — il n'affiche ni 0, ni « conforme ».

#### g) Le devoir d'informer — « toujours informer »

Une exception personnelle n'est acceptable que si elle est **visible par ceux qu'elle
concerne**. Ce n'est pas un bandeau : c'est un fait enregistré.

| Événement | Qui est informé | Ce qui est dit |
|---|---|---|
| une valeur personnelle est posée, modifiée ou verrouillée | l'employé concerné | la valeur, sa date d'effet, qui l'a décidée, et pourquoi elle diffère de la règle d'entreprise |
| une règle d'entreprise change **et** un employé verrouillé n'est pas concerné | l'employé (il conserve son réglage) **et** l'administrateur (liste) | « votre réglage personnel reste applicable » — l'administrateur ne doit pas croire avoir tout changé |
| une règle d'entreprise remplace une valeur personnelle (sans verrou) | l'employé concerné | l'ancienne valeur, la nouvelle, la date — **au moment** de l'application |
| une valeur personnelle est retirée (retour à la règle générale) | l'employé | la règle qui s'applique désormais |

Trois règles de mise en œuvre :

1. **un enregistrement, pas une notification volatile** : destinataire, date, contenu, et si le
   message a été consulté — on doit pouvoir prouver que l'information a été émise ;
2. **avant ou au moment, jamais après coup en silence** : un changement déjà appliqué et jamais
   signalé est exactement ce que le rapport interdit ;
3. **aucune information inventée** : si l'origine n'est pas connue (`historique_incertain`),
   le message le dit, il ne fabrique pas un auteur.

L'aperçu d'impact (§3.5.d) est l'autre moitié du dispositif : il informe **avant** d'écrire,
celui-ci informe **ceux qui subissent** l'écriture.

#### h) Interdits d'accès

- un administrateur ne lit ni n'écrit la valeur personnelle d'un employé d'une autre
  entreprise : refus **dans la RPC**, pas seulement dans l'écran ;
- l'employé visé doit appartenir à l'entreprise visée, contrôlé à l'écriture ;
- un contrat ne peut porter une règle que pour l'employé qu'il couvre.

### 3.6 Écriture

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
| 1 | **G1** ✅ *réalisé, en attente de validation* | Fenêtres hebdo et repos calculées sur une plage élargie ; la primitive refuse des bornes étroites ; drapeau mort supprimé | S | — | — | Un réglage éditable sur un calcul faux à cheval sur deux années, c'est un bouton qui ment deux fois |
| 2 | **G2** ✅ *réalisé, en attente de validation* | Provenance réelle (`entreprise` / `defaut_produit` / `historique_incertain` / `inconnue`), défaut à 48 h, écriture qui n'invente plus de seuil, libellé honnête | S | S | — | Supprime le mensonge actuel (« seuil d'entreprise ») pour tous, tout de suite, sans toucher au calcul |
| 3 | **G3** ✅ *2a (table + RPC + service) et 2b (branchement) faits* |
| 4 | **G6** ⏳ *découplage + seuil choisi + case d'alerte (données) faits ; case à l'écran et séparation des clés à suivre* | Découplage de l'alerte et du module de paie ✅ (`seuilsAlerteHebdo`) ; séparation des trois clés (déclenchement de paie / seuil d'alerte / plafond `a_sourcer`) → **G3** | S | S | G3 | Donner un bouton « repos personnel » alors que l'alerte s'éteint avec la paie serait livrer un réglage inopérant |
| 5 | **G4** | Page **« Mon entreprise »** : profil, identité, pays, règles de temps de travail ; accès de l'admin client ; « Entreprises » réservé au super-administrateur (V-A2, V-A3) | M | **M** | G3, G6 | Un écran « S » n'est pas une tâche « S » (audit §7.2) ; c'est la maison unique des règles d'entreprise (§4.2) |
| 6 | **G4b** | **Modèles 48 h / 50 h par pays** : table, pré-sélection à la création, confirmation explicite, `statut_source` | S | S | G4 | Les modèles sont un confort de saisie ; les brancher avant la page n'aurait aucun support |
| 7 | **G5** | Fiche employé : suivre l'entreprise ou valeur personnelle, clé par clé, retour à la règle générale, origine affichée | M | **M** | G3, G6, G4 | Après G4, sinon l'héritage n'a pas de parent à hériter |
| 8 | **G7** | Affichage de la provenance et de « contrôle indisponible » dans les écrans d'alerte et le Planning (V-B3, V-C2) | S | S | G2, G6 | Rendre visible ce que G3-G5 savent, sans ajouter de règle |
| 9 | **G8** | Contrats : date d'effet, emplacement `contrat_id`, historique, distinction des quatre notions (V-D1, V-D2, V-D5) | M | S | G3, §6.1 | Conception maintenant, code quand le module contrats se précise |
| 10 | **G9** | Snapshots de calcul : ne pas activer avant G1 et avant décision sur l'historique | — | — | G1 | Figer un calcul faux au 31/12 est exactement ce que le rapport interdit |

### 5.1 G1 — ce qui a été fait, et ce qui a changé en route

Réalisé le 24/10/2026, **non validé** : le statut reste « en attente ».

- `fenetreDeLecture({ debutAnnee, finAnnee, debutMois, finMois })` (nouvelle fonction
  exportée) rend la fenêtre de lecture : année civile ∪ semaine du 1ᵉʳ du mois ∪ semaine du
  dernier jour ∪ lendemain du dernier jour. Rien de plus.
- la lecture des pointages utilise cette fenêtre (elle était bornée à l'année civile) ;
- `buildDaySummariesStrict` **dérive lui-même** ses bornes des périodes : il n'accepte plus
  de bornes de l'extérieur, donc un appelant ne peut plus réintroduire des bornes trop
  étroites — c'était le vrai risque de régression ;
- le drapeau `complete` a été **supprimé**, pas renommé. Après élargissement, il vaudrait
  toujours `true` : un booléen toujours vrai ne mesure rien. `joursDansLaPeriode` reste, et
  c'est lui qui chiffre la couverture réelle de la fenêtre demandée.
- 7 tests de régression (`fenetreAnnee.test.js`) + 3 fichiers de tests existants adaptés au
  nouveau contrat.

**Ce que G1 ne fait pas** : il ne renomme rien à l'écran, ne modifie aucune alerte, ne touche
ni aux seuils ni à la paie. Les totaux mensuels et annuels sont inchangés par construction
(les boucles de totalisation gardent leurs propres listes de jours) et un test le vérifie.

**Vérification des gardes de nuit** (6 tests, `gardeNuitAttribution.test.js`) : une garde reste
attribuée à sa journée d'ouverture, n'est jamais dupliquée entre deux mois ni deux années, et
la semaine à cheval sur le 31/12 la compte désormais une fois au lieu de zéro. Le taux appliqué
est celui du jour d'ouverture — c'est une convention chiffrée au §8.7, pas un effet de G1.

### 5.2 G2 — ce qui a été fait (provenance et défaut à 48 h)

Réalisé le 24/10/2026, **non validé**.

- le défaut produit du seuil d'alerte passe de 40 h à **48 h**, et
  `weekly_threshold_major` vaut `null` par défaut : plus de second niveau fantôme ;
- `qualifierOrigineSeuilHebdo()` répond `entreprise` / `defaut_produit` /
  `historique_incertain` / `inconnue`. Une valeur égale à un défaut **connu** (48 h aujourd'hui,
  40 h avant) est classée `historique_incertain` : on ne reconstitue pas une intention ;
- un échec de lecture ne prétend rien (`inconnue`) ;
- `evaluerSeuilsHebdo` ne dit plus « entreprise » par défaut : la source vient de l'appelant,
  et le message parle de « valeur par défaut du produit, à confirmer » quand c'en est une ;
- `saveOvertimeSettings` n'écrit plus de seuil hebdomadaire que personne n'a saisi
  (`|| 40` / `|| 48` supprimés, corps extrait dans une fonction pure testable) ;
- 17 tests (`origineSeuilHebdo.test.js`), plus 2 assertions existantes mises à jour.

**Non fait** : aucun écran n'affiche encore ces libellés (c'est G7), et le placement de
l'alerte sous condition du module de paie reste à défaire (G6).

### 5.3 G6-mince — l'alerte survit à la paie

Réalisé le 24/10/2026, **non validé**.

**Le défaut** : `loadOvertimeContext` ne chargeait les réglages que si le module « heures
supplémentaires » était actif. L'alerte hebdomadaire lisant ces mêmes réglages, **couper la
paie éteignait le contrôle du temps de travail** — la direction croyait n'avoir désactivé
qu'un calcul de paie.

**La correction** : deux lectures distinctes, jamais fusionnées.

| Objet | Contenu | Conditionné au module ? |
|---|---|---|
| `overtimeSettings` | réglages de **paie** (taux, seuils journaliers, fériés) | **oui**, inchangé |
| `reglageHebdo` | seuils de l'**alerte** + origine | **non**, lu dans tous les cas |

`seuilsAlerteHebdo()` est une fonction pure : elle rend `{ seuil, seuilMajeur, source }` sans
jamais consulter le module, ce qui rend la règle vérifiable sans base.

**Le piège évité, et pourquoi la séparation n'est pas décorative** : `resoudreFerieDuJour`
détermine si l'entreprise a configuré une majoration de férié via `overtimeSettings.id`. Charger
les réglages « toujours » aurait fait passer une majoration de férié de **100 % à 150 %** pour
les entreprises dont le module est coupé — une hausse de paie silencieuse, provoquée par un
correctif d'affichage. C'est testé (`alerteHebdoSansPaie.test.js`, 10 tests), y compris la
démonstration 100 % / 150 %). Depuis la règle du seuil choisi, le fichier compte **14 tests**.

#### 5.3.1 « Pourquoi les alerter ? » — la règle du seuil choisi

Question du fondateur, et elle a tranché le comportement : **une entreprise qui n'a rien
configuré n'est pas alertée.**

Une alerte est une **affirmation** : « vous avez dépassé *votre* seuil ». Elle exige donc un
seuil **choisi et prouvé**. Le défaut produit de 48 h garde son rôle — **pré-remplir** l'écran
de réglages, donner un point de départ — mais il n'allume aucun avertissement. Opposer à une
entreprise une règle qu'elle n'a pas posée serait la même faute que d'inventer une valeur
« légale » (D5), sous un autre costume.

`seuilsAlerteHebdo()` rend désormais `{ seuil, seuilMajeur, source, actif, seuilPropose, motif }`
et la règle est simple :

| Situation (`provenance.origine`) | Seuil utilisé par l'alerte | Ce qui reste visible |
|---|---|---|
| `entreprise` (valeur ≠ défaut) | **la valeur** | seuil + origine |
| `defaut_produit` (aucune règle) | **aucun** | `seuilPropose` = 48 h, motif « non prouvé comme un choix » |
| `historique_incertain` (valeur = 48 ou 40) | **aucun** | `seuilPropose` = la valeur héritée |
| `inconnue` / lecture en échec | **aucun** | `source: 'inconnue'` |

Le second niveau (`weekly_threshold_major`) est neutralisé avec le premier : un niveau 2 ne
peut pas devenir un seuil quand le niveau 1 n'est pas prouvé.

##### Décision du 24/10/2026 : une case distincte, pas une déduction

**« Il faut une case distincte »** — validé par le fondateur. Le seuil et l'alerte sont deux
objets : un seuil peut pré-remplir un contrat, une simulation, un formulaire, sans que personne
n'ait demandé à être prévenu. L'alerte exige donc **deux conditions cumulatives** :

| Condition | Vérifiée par | Si absente |
|---|---|---|
| un seuil **valide** existe | `weekly_threshold` fini et > 0 | silence, motif « aucun seuil valide » |
| la case **« m'alerter au-delà de ce seuil »** est cochée | `settings.alerte_hebdo_activee === true` | silence, motif « alerte non activée » |

- **En base** : `overtime_settings.alerte_hebdo_activee boolean not null default false`
  (migration `20261123000001`, rejouable, testée dans PGlite). Défaut `false` : aucune
  entreprise n'est alertée par héritage, ni par le défaut 48 h, ni par l'ancien `|| 48`.
- **À l'écriture** : un booléen transmis est écrit tel quel (un `false` explicite est une
  décision) ; une case absente du formulaire **n'est pas écrite** — même règle que les seuils.
- **À la lecture** : une case absente n'est jamais un « oui ».

**La case est la preuve, et c'est elle qui remplace la barrière de provenance.** Un client qui
choisit délibérément 48 h — la valeur du défaut — était sinon condamné au silence, case cochée
comprise : l'alerte ne se serait jamais déclenchée. Or cocher est un acte humain, posé avec le
seuil affiché à côté ; la colonne naît à `false` et n'est écrite que par un formulaire. Cette
case lève donc exactement l'ambiguïté que `historique_incertain` décrivait (« impossible de
savoir si la valeur a été choisie ») : un humain l'a confirmée.

Conséquence assumée sur les libellés : quand l'alerte est active, `source` vaut **`entreprise`**
(le message au salarié dit « seuil d'entreprise », ce qui est vrai : l'entreprise l'a confirmé),
tandis que `origineEnregistree` conserve la provenance brute (`defaut_produit`,
`historique_incertain`…) pour l'audit.

**Livré dans ce lot (les deux ensemble, comme demandé)** :

| Élément | Où |
|---|---|
| champ « Seuil hebdomadaire (heures) » | `HeuresSupplementaires.jsx`, section « Alerte hebdomadaire » |
| case « M'alerter au-delà de ce seuil » | même section, décochée par défaut |
| garde de saisie | case cochée + seuil absent/invalide ⇒ sauvegarde refusée, aucun réglage inopérant écrit |
| carte d'alerte chiffrée | `AlerteHebdoCard.jsx`, affichée dans la fiche employé |

La carte ne s'affiche **que** si l'alerte est active et qu'une semaine dépasse le seuil : elle
donne les heures, le seuil, l'écart, et rappelle que ce n'est pas un plafond légal. Aucun
dépassement = aucun élément à l'écran — le silence n'est pas un oubli, c'est l'absence de
constat.

**⚠️ Constat de reproductibilité** : `overtime_settings` n'a **aucune migration de création**
dans ce dépôt — la table n'existe qu'en base. La migration ajoutée est donc écrite pour être
inoffensive si la table manque (et c'est testé). C'est un argument de plus pour G3, qui remplace
cette table par `encheck_regles_temps_travail`, historisée par construction.

**Ce que G3 devra encore faire** : horodater la confirmation (qui a coché, quand) et la rendre
historique. Aujourd'hui `alerte_hebdo_activee` dit *oui/non*, pas *depuis quand ni par qui* —
suffisant pour ne pas mentir, insuffisant pour le devoir d'informer (§3.5.g).

**Rectificatif d'annonce** : j'avais écrit que les entreprises sans module allaient « recevoir
des alertes ». C'est faux, et c'est vérifié : `calculateEmployeeHours` produit bien un tableau
`alerts`, mais **aucun écran ne le rend** (`Employee360.jsx` n'y fait aucune référence). Le
contrôle hebdomadaire est calculé puis **jeté**. G6 rend donc le calcul *juste et disponible* ;
l'affichage — et le choix de qui le voit, avec quel consentement — appartient aux lots G4/G5.

**Ce qui reste de G6** : la séparation des **trois clés** (déclenchement de paie / seuil
d'alerte / plafond `a_sourcer`) n'est pas faite — elle appartient à G3, qui crée la table où
ces clés vivront séparément. Aujourd'hui l'alerte lit encore `overtime_settings.weekly_threshold`,
et le plafond « légal » n'existe pas.

### 5.4 Plan d'exécution — ce que je code, dans quel ordre

#### Étape 0 — fermer #313 avant d'empiler (décision du fondateur)

#313 contient G1 (fenêtre) et G2 (origine + 48 h). Tant qu'elle n'est pas validée, tout ce qui
suit s'appuie sur un calcul non validé. **Aucun lot ci-dessous ne démarre sans cette
validation** — ou sans un « je continue quand même » explicite.

#### Lot 1 — G6-mince : l'alerte ne meurt plus avec la paie ✅ *réalisé* (S, 1 PR)

**Pourquoi d'abord** : c'est le dernier défaut de justesse qui ne dépend d'aucun modèle de
données. Deux lignes, un vrai bug : aujourd'hui, couper le module « heures supplémentaires »
éteint le contrôle hebdomadaire.

- `hoursCalculator.js` : `loadOvertimeContext` charge toujours les réglages et leur origine
  (aujourd'hui seulement si `hasOvertimeFeature`) ; le calcul de paie garde SA condition
  (`peutCalculer`), seule l'alerte s'affranchit du module ;
- tests : module coupé ⇒ l'alerte existe, avec l'origine `defaut_produit` ou
  `historique_incertain` ; module coupé ⇒ **aucun montant** d'heures supplémentaires calculé
  (verrou anti-régression de paie).
- ⚠️ Ce lot lit encore `overtime_settings`. **G3 le rebranchera** sur la nouvelle table : ce
  double passage est assumé, il achète un correctif immédiat pour deux lignes de code.

#### Lot 2 — G3 : la fondation, en deux PR (M puis S)

Le gros morceau. Coupé en deux pour rester relisible.

**PR 2a — la base et la résolution (sans interface, sans branchement)** ✅ *réalisé le 24/10/2026*
- migration `2026xxxx_encheck_regles_temps_travail.sql` : table versionnée (§3.2), index
  partiels, RLS (lecture selon l'accès, écriture par RPC seulement) ;
- `encheck_regle_resolue(entreprise, employe, cle, date)` : la course des actes (§3.3),
  verrou compris (§3.5.c) ;
- `encheck_regle_ecrire(...)` : contrôle `admin_has_access_to_entreprise`, appartenance de
  l'employé, bornes **dans la RPC**, écriture d'une nouvelle version + archive ;
- `encheck_regle_historique(entreprise, employe, cle)` : qui, quand, avant → après ;
- service `src/services/reglesTempsTravail.js` : `resoudre()`, `ecrire()`, `historique()`,
  sans UI ;
- tests : héritage par clé, retour à l'entreprise, verrou, date d'effet, refus inter-entreprises
  **au niveau RPC**, bornes.
- **Rien ne change à l'écran. Aucun calcul existant n'est modifié.** C'est un lot sûr.

##### 5.4.1 Ce que la PR 2a contient réellement

| Livré | Fichier | Vérifié par |
|---|---|---|
| table versionnée, index partiels, RLS (lecture par accès, écriture interdite) | `20261123000002_encheck_regles_temps_travail.sql` | PGlite : insertion et mise à jour directes refusées |
| `encheck_regle_resolue` : la course des actes + le verrou | idem | 6 tests de précédence, dont date d'effet future |
| `encheck_regle_ecrire` : accès, appartenance, bornes, verrou, chaînage | idem | 5 tests de bornes et de clés |
| `encheck_regle_historique` : qui, quand, avant → après | idem | versions conservées, `remplace_id` correct |
| service `reglesTempsTravail.js` : `resoudre` / `ecrire` / `historique` | `src/services/reglesTempsTravail.js` | 17 tests, base simulée |

**Deux points où j'ai dû préciser la spec pendant l'écriture** — à valider :

1. **Le verrou porte sur la valeur personnelle COURANTE, pas sur son passé.** Dans une table
   append-only, la ligne verrouillée ne disparaît jamais : si l'on testait « existe-t-il une
   ligne verrouillée ? », une levée de verrou serait impossible même pour un super-admin.
   La règle implémentée : la dernière version personnelle applicable décide ; si elle est
   verrouillée, elle gagne. Une nouvelle version non verrouillée lève donc le verrou de fait,
   et l'ancienne reste dans l'historique. Testé dans les deux sens.
2. **Poser un verrou est aussi réservé au super-administrateur**, pas seulement le lever : sinon
   un admin ordinaire pourrait se créer une valeur intouchable par ses pairs.

**Trois limites assumées pour l'instant** :
- `contrat_id` existe mais n'est jamais renseigné : la portée « contrat » est **réservée**, pas
  active. Aucun code ne la lit ;
- la RPC ne recalcule pas l'aperçu d'impact (protection (a) du §3.3) : il viendra avec l'écran,
  car il dépend du nombre d'employés concernés ;
- `employees` et `overtime_settings` n'ont toujours **aucune migration de création** dans le
  dépôt : la table de test les recrée à la main. C'est le risque de reproductibilité déjà
  signalé, que G3 ne corrige pas encore.

**PR 2b — le branchement (S)** ✅ *réalisé le 24/10/2026*
- `hoursCalculator.js` : le seuil d'alerte vient de `encheck_regle_resolue(...)` ; les réglages
  d'heures supplémentaires ne servent plus qu'à la paie ;
- bascule : tant qu'aucune règle n'est écrite, la valeur résolue retombe sur le comportement
  actuel (48 h, origine `defaut_produit`) — **aucune rupture de service** ;
- tests : avant/après migration, mêmes alertes pour une entreprise sans règle ; montants de
  paie strictement identiques.

##### 5.4.2 Ce que le branchement fait exactement

| Question | Réponse implémentée | Vérifié par |
|---|---|---|
| Qui fait autorité pour le seuil ? | la table versionnée **dès qu'elle porte une valeur** ; sinon le réglage d'entreprise, défaut 48 h compris | 6 tests de bascule |
| La paie lit-elle cette table ? | **non** — `overtimeSettings` inchangé, mêmes montants | test d'égalité des réglages de paie avec/sans règle |
| Si la migration n'est pas installée ? | `chargerReglesAlerte` attrape et rend `null` ; repli sur l'existant | 2 tests de panne |
| L'activation suit-elle la règle ? | **non** : la case reste la preuve. Une règle de 45 h sans case cochée n'alerte pas | 1 test dédié |
| Un employé peut-il avoir sa valeur ? | oui côté base, et `source` vaut alors `employe` ; la lecture par employé arrive avec G5 | 1 test de libellé |

**Ce que la table versionnée ne porte pas encore** : l'**activation** de l'alerte
(`alerte_hebdo_activee`) reste dans `overtime_settings`, donc hors historique. C'est la limite
la plus visible qui reste : on saura *quelle* valeur s'applique et *depuis quand*, mais pas
*qui* a coché la case ni *quand*. G5 (fiche employé) doit la versionner à son tour — c'est une
clé de plus, pas une refonte.

**Séparation des trois clés (reste de G6)** : le seuil d'alerte ne vient plus de la paie dès
qu'une règle existe ✅ ; le déclenchement de paie et le plafond `a_sourcer` restent où ils
sont, inchangés — le plafond n'existe toujours pas, et il n'est pas inventé.

#### Lot 3 — G4 : « Mon entreprise » (M + M) ✅ *écran livré le 24/10/2026*

Écran + accès + pays. Le premier lot visible par le client.
- entrée dans le groupe Réglages ; « Entreprises » réservé au super-admin ;
- identité (lecture), pays (acte daté et tracé, super-admin seul), règles de temps de travail ;
- **G4b dans la même PR ou juste après** : modèles 48 h / 50 h par pays, pré-sélection +
  confirmation, `statut_source` visible.
- tests : visibilité par rôle, refus d'une autre entreprise, confirmation du pays, modèle non
  appliqué sans confirmation, 4 largeurs + thèmes.

##### 5.4.3 Ce que l'écran « Mon entreprise » fait, et ce qu'il ne fait pas

| Section | Livré | Vérifié par |
|---|---|---|
| Identité | lecture seule (nom, code, pays, devise, fuseau) + renvoi vers « Entreprises » | test de page : l'entreprise non rattachée est refusée |
| Règles | valeur en vigueur, origine, date d'effet, édition en **deux temps** (saisir, puis confirmer en voyant l'ancienne valeur) | 5 tests de page + 11 de logique |
| Historique | 20 dernières versions, avec « remplace la précédente » | lecture de `encheck_regle_historique` |
| Modèle (G4b) | 48 h / 50 h proposés, `statut_source` visible, **aucune écriture avant confirmation** | test : ouvrir la confirmation n'écrit rien ; confirmer écrit 48 |
| Accès | un admin ne voit que son entreprise ; le super-admin choisit | `accesAutorise` + refus affiché |

**Trois écarts assumés, à valider** :

1. **Le pays est en lecture seule.** Le plan prévoyait un « acte daté et tracé » pour le pays.
   Écrire un pays sans historique serait une décision sans trace — exactement ce que G3
   corrige ailleurs. En attendant une table d'audit des entreprises, le pays se modifie dans
   « Entreprises » (super-admin), et l'écran le dit.
2. **Le rattachement pays → modèle est VIDE.** `MODELES_PAR_PAYS` est un objet vide : aucune
   source pays n'a été vérifiée (D5). Le mécanisme existe (pré-sélection par pays, un jour),
   mais aucun chiffre n'est rattaché à un pays aujourd'hui. Les 48/50 h sont des modèles du
   **produit**, confirmés par l'entreprise.
3. **« 4 largeurs + thèmes »** : les points de rupture sont écrits dans `MonEntreprise.css`
   (960 / 720 / 480 px) et la page n'utilise que les jetons `--charte-*`, donc suit le thème
   clair et sombre. Aucun test automatisé de rendu visuel ne le vérifie — la capture reste
   à faire.

**Refonte d'apparence du 24/11/2026** — « refais la page Mon entreprise car ça ne colle pas avec
l'identité En-Check ». Maquette retenue : `maquettes/choix-mon-entreprise.png` (option 2 sur 2).
La page cesse d'être une pile de cartes arrondies : c'est **une feuille**, bande de bogolan native
en tête, cadre d'encre de 2 px et son ombre dure à flou zéro, bandes de colle et rabat au coin,
titre à double soulignement de feutre, identité en cinq colonnes séparées par un filet, registre
des règles à cinq colonnes avec la valeur en gros chiffres tabulaires, **historique en colonne de
droite**, modèle proposé au tampon incliné en pointillé et pied « Dernière écriture ». Aucune
règle de calcul n'a bougé : c'est la même logique d'écriture, la même édition en deux temps, le
même aperçu d'impact. Ce qui reste à valider : les captures réelles aux quatre largeurs et en
thème sombre.

#### Lot 4 — G5 + G5-bis : la fiche employé et le devoir d'informer (M + M) ✅ *sauf G5-bis (versionner l'activation)*

##### 5.4.4 Ce qui est livré, et ce qui ne l'est pas encore

Deux manques sont comblés, et ils bloquaient tout le reste :

| Livré | Pourquoi c'était bloquant | Vérifié par |
|---|---|---|
| **Retour à la règle d'entreprise** (version personnelle `NULL` = abandon) | sans lui, le troisième état `suit_entreprise` n'avait aucune écriture possible : écrire `NULL` donnait « le plus récent gagne, valeur nulle », donc un employé sans règle, pas un employé revenu à la règle commune | 3 tests SQL, dont l'annulation des versions antérieures |
| **Aperçu d'impact** `encheck_regle_impact` | la protection (a) du §3.3 : « le plus récent gagne » remplace des valeurs personnelles en silence | 4 tests SQL + 3 de service |
| Impact affiché **avant** l'écriture, avec blocage si verrou | un refus doit se voir avant, pas après l'erreur | 1 test de page |
| `revenirEntreprise()` | l'acte doit être nommé dans le service, pas être un `null` anonyme | 1 test |

Détail de la règle d'abandon, parce qu'elle est contre-intuitive : l'abandon **annule toutes les
versions personnelles antérieures** de cet employé. Sans cela, l'ancienne valeur (plus récente
que la règle d'entreprise) resterait gagnante et le retour ne changerait rien — mesuré, puis
corrigé.

##### 5.4.5 La fiche employé et le devoir d'informer — livré

Maquette retenue par le fondateur : `maquettes/choix-g5-fiche-employe.png` (deux images
proposées, la première choisie). La peau suit la charte « brut adouci, double feutre » :
cadre d'encre de 2 px, ombre dure à flou zéro, lavis de feutre par état, aucune couleur
en dur, aucun flou, rayons dans la liste blanche.

**Repliée le 24/11/2026** : « ce bloc est trop imposant en haut de la fiche employé, il faut
utiliser des modales ». Maquette retenue : `maquettes/choix-g5-fiche-modale.png` (option 2 sur 2).
La fiche ne porte plus qu'une **bande de 52 px** — titre, compte (« 3 réglages · 1 personnel »),
un bouton contour « Voir les règles » — et le contenu décrit ci-dessous vit dans une **modale de
760 px** : `role="dialog"`, `aria-modal="true"`, Échap qui referme, focus porté sur le bouton de
fermeture, voile cliquable. Rien n'a été retiré, tout a été déplacé : c'est le même registre, au
même endroit pour qui lit.

| Livré | Où | Vérifié par |
|---|---|---|
| **Trois états, clé par clé** (`suit_entreprise` / `personnelle` / `personnelle_verrouillée`) avec la valeur, l'origine, la date d'effet et le verrou | `src/components/ReglesTempsTravail.jsx` + `src/lib/reglesPersonnelles.js` | 21 tests de logique + 17 de page |
| **Quatrième vérité affichée** : `aucune` → « non configuré » et « contrôle indisponible », jamais `0 h` | idem | test de page explicite |
| **Aperçu d'impact avant écriture**, une personne concernée, blocage si verrou non levé | `apercuReglagePersonnel` + panneau | 2 tests de page |
| **Retour à la règle de l'entreprise** en deux temps (confirmation, puis acte distinct de l'écriture ordinaire) | `revenirEntreprise()` | 2 tests de page |
| **Informations enregistrées** : destinataire, date, texte figé, « consultée / non consultée » | table `encheck_informations_regle` + `encheck_informations_regle()` | 9 tests SQL |
| **Émission garantie par la base** : impossible d'écrire un réglage personnel sans émettre l'information | `encheck_regle_ecrire` réécrite dans `20261124000001_informations_regle.sql` | 4 tests SQL |
| **Non-concernés informés** : une règle d'entreprise qui n'atteint pas un verrou écrit « votre réglage reste applicable » | idem | 1 test SQL |

Ce que les informations **ne sont pas** : une notification envoyée. On enregistre le fait
d'avoir émis l'information ; `consulte_le` reste nul tant que personne ne l'a marquée, et
aucun écran d'administration ne peut le faire à la place de l'employé.

**Ce qui reste, et n'est pas fait** :
- **versionner l'activation** de l'alerte (`alerte_hebdo_activee`) : toujours dans
  `overtime_settings`, donc hors historique — c'est G5-bis ;
- **marquer une information consultée** depuis l'espace employé : la colonne existe, l'écran
  employé n'est pas branché ;
- la **capture** de la fiche aux quatre largeurs (320 / 390 / 768 / 1440 px) et en thème
  sombre : la feuille ne pose que des jetons, mais le rendu reste à l'œil du fondateur.

#### Lot 5 — G7 : les libellés dans les écrans existants (S)

- le message d'alerte, la page Heures supplémentaires et le Planning affichent l'origine et
  « contrôle indisponible » ;
- aucun calcul nouveau, uniquement de la vérité visible.

#### Lot 6 — G8 / G9 : contrats et snapshots (décisions, peu de code)

- `contrat_id`, date d'effet, historique : le socle est déjà posé par G3 ;
- G9 : **ne rien activer** tant que G1 n'est pas en production et l'historique tranché.

#### Récapitulatif

| Ordre | Lot | Taille | Ce qui peut casser | Validation attendue |
|---|---|---|---|---|
| 0 | #313 (G1+G2) | — | rien (calcul inchangé, totaux identiques) | tu regardes, tu fusionnes |
| 1 | G6-mince | S | **aucune alerte nouvelle** : le seuil non choisi n'alerte pas (5.3.1) ; l'affichage n'existe pas encore | une capture : alerte visible module coupé, avec un seuil d'entreprise |
| 2a | G3 base | M | rien : pas encore branché | revue de la migration et des RPC |
| 2b | G3 branchement ✅ | S | rien pour un client sans règle (mêmes seuils, mêmes montants) | avant/après identiques — testé |
| 3 | G4 + G4b ✅ | M+M | l'accès des admins clients | parcours admin non super-admin |
| 4 | G5 + G5-bis ✅ *fiche, états, impact, informations* ; reste : versionner l'activation | M+M | la lisibilité de la fiche employé | parcours : poser, verrouiller, informer |
| 5 | G7 | S | des libellés | captures des 3 écrans |
| 6 | G8/G9 | — | la paie si on active trop tôt | décision écrite |

**G1 et G2 ont été livrés ensemble dans #313** (même branche, même PR : le second corrigeait le
libellé du premier). La suite est séquentielle.

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

### 6.3 Défaut produit — tranché : 48 h, et pas de second niveau supposé

**Révision du 24/10/2026** (elle remplace l'option « 40 h » retenue plus tôt le même jour) :
le seuil d'alerte hebdomadaire **par défaut du produit est 48 h**, et **aucun second niveau**
n'est supposé tant que l'entreprise n'en choisit pas un.

- l'alerte continue de fonctionner pendant la transition, **étiquetée** « valeur par défaut du
  produit, à confirmer » — jamais « seuil d'entreprise » ;
- dès que l'entreprise confirme un modèle ou saisit sa valeur, celle-ci prend l'origine
  `entreprise` et le repli disparaît de l'écran ;
- 48 h est un **défaut de produit**, pas une obligation : aucune source pays n'est vérifiée
  (D5), et aucun libellé ne doit le suggérer.

**Conséquence à connaître** : une semaine de 45 h ne déclenche plus d'alerte, alors qu'elle en
déclenchait une avec l'ancien défaut de 40 h. C'est l'effet voulu (« je veux les 48 h par
défaut »), mais il change ce que les clients voient — il doit être annoncé, pas découvert.

**Ce qui n'a pas changé** : aucun montant. Le seuil hebdomadaire n'entre dans aucun calcul de
paie (les heures supplémentaires se calculent au jour), il ne sert qu'à l'alerte. Vérifié :
`weekly_threshold` n'est lu que par le contrôle hebdomadaire.

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

**G2 — provenance et libellé** ✅ *écrits et verts*
- base sans ligne `overtime_settings` ⇒ origine `defaut_produit`, message sans le mot
  « entreprise » ;
- erreur de lecture ⇒ `inconnue`, jamais « entreprise » ;
- valeur 45 h ⇒ `entreprise` ; valeur 40 h ou 48 h ⇒ `historique_incertain` ;
- le défaut produit vaut 48 h et le second niveau est `null` ;
- l'écriture n'invente aucun seuil hebdomadaire (absent, vide, explicite, `null`) ;
- aucun libellé ne contient le mot « légal » (balayage des six origines).

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

**G5-bis — le devoir d'informer (§3.5.g)**
- poser, modifier ou verrouiller une valeur personnelle crée **un enregistrement** destiné à
  l'employé (destinataire, date, contenu), et non un simple message volatil ;
- une règle d'entreprise qui remplace une valeur personnelle génère l'information **au moment**
  de l'application, avec l'ancienne et la nouvelle valeur ;
- une règle d'entreprise qui **n'atteint pas** un employé verrouillé le dit : à l'employé
  (« votre réglage reste applicable ») et à l'administrateur (liste des non-concernés) ;
- un changement d'origine `historique_incertain` ne fabrique pas d'auteur : le message dit que
  l'origine est inconnue ;
- l'aperçu d'impact et l'information ne peuvent pas se contredire (même calcul, même date
  de référence).

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
7. **Garde de nuit : une convention, pas une erreur — mais un écart qui se chiffre.** Une garde
   appartient entièrement à la journée où elle a **commencé** (règle d'arbitrage n°2,
   `garde_max_heures` = 22 h). Conséquence mesurée sur données fictives, à 1 000 FCFA/h :
   une garde samedi 22 h → dimanche 6 h est payée **10 000 FCFA** (8 h au taux du samedi),
   alors que la même nuit découpée au calendrier vaut **14 500** (2 h samedi + 6 h dimanche) ;
   une garde dimanche 22 h → lundi 6 h est payée **16 000**, alors que la découpe vaut
   **10 000**. Soit **6 000 FCFA d'écart** pour une nuit identique, selon le jour d'ouverture.
   Ce n'est pas un défaut de G1 : la convention est antérieure et ses tests la verrouillent
   (`gardeNuitAttribution.test.js`). La changer **change la paie** — donc c'est une décision,
   pas une correction (voir §9). Effet secondaire de la même règle : six heures travaillées le
   lundi sont comptées dans la semaine du dimanche, ce qui peut décaler une alerte
   hebdomadaire d'une semaine.

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
- **Convention d'attribution des gardes de nuit** : conserver « la nuit appartient à son jour
  d'ouverture » (écart mesuré jusqu'à 6 000 FCFA par nuit, §8.7), ou découper au calendrier ?
  La seconde option change la paie et exige une décision explicite, une date d'effet et une
  reprise de l'historique — elle n'entre pas dans G1.
- Les repères concurrentiels du rapport ne sont pas des prescriptions : aucun compte
  concurrent n'a été testé.
