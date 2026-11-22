# Spécification — Majoration des jours fériés, multi-pays

**Objet :** définir comment chaque entreprise applique **ses propres** règles de majoration
de jour férié — et comment En-Check applique un **plancher légal par pays** sans jamais
inventer une règle.

**Statut :** proposition, à arbitrer. Aucune ligne de code. Ce document remplace la
correction minimale « brancher le jour férié » (constat **A1** de
`docs/AUDIT-ALGORITHMES-ET-ANTICIPATION.md`) par un lot plus large, dont elle devient
la première livraison.

**Périmètre :** jours fériés **travaillés**, sur les 14 pays déclarés dans
`src/services/holidayService.js` (FR, BE, CH, BJ, SN, CI, CM, MA, TN, DZ, MG, ML, BF, NE)
plus « Autre / Custom ».

---

## 0. Le problème, en une phrase

> Le produit **affiche** déjà un taux de majoration de férié, **l'enregistre** par
> entreprise, et **ne l'applique pas**. Il calcule donc un jour férié travaillé comme un
> mardi ordinaire.

Et, en le corrigeant, on découvre une deuxième question, plus profonde : **quel taux
appliquer quand l'entreprise n'a rien dit ?** La réponse ne peut pas être un chiffre
codé en dur — elle dépend du pays, et En-Check couvre 14 pays.

---

## 1. Ce qui existe déjà (vérifié dans le code)

| Brique | État | Où |
| --- | --- | --- |
| Écran « Taux jours fériés (%) », par entreprise | **Existe et fonctionne** | `src/pages/HeuresSupplementaires.jsx` |
| Stockage du taux | **Existe** — table `overtime_settings` | `featureService.js` |
| Affichage du taux sur la fiche de paie (« Férié : +150 % ») | **Existe** | `src/pages/FichesPaie.jsx` |
| Taux propre à **un** férié | **Existe** (`overtime_rate`, `is_worked`) | `holidayService.js` |
| Exception d'entreprise sur un férié global | **Existe** (`custom_overtime_rate`, `custom_is_worked`) | `holidayService.js` |
| Application dans le calcul | **NON** — le paramètre `holiday` n'est jamais transmis | `hoursCalculator.js` |
| Plancher légal par pays | **N'existe pas** | — |
| Repos compensateur | **N'existe pas** | — |
| Date d'effet des règles | **N'existe pas** | — |
| Historique / preuve de la règle appliquée | **N'existe pas** | — |

**Conclusion :** le modèle de données couvre déjà les trois quarts du besoin. Ce qui
manque est **le fil** (l'application), **le plancher** (le pays), **le repos**
(l'alternative à l'argent) et **le temps** (les dates).

---

## 2. Six principes non négociables

| # | Principe | Pourquoi |
| --- | --- | --- |
| P1 | **Aucun pays par défaut.** Si le pays de l'entreprise est inconnu, le calcul **s'arrête** avec un message clair. | C'est déjà la doctrine de `taxationService` : *« appliquer un barème camerounais à une entreprise sénégalaise produisait une paie fausse et silencieuse »*. Le même raisonnement vaut pour les fériés |
| P2 | **La loi est un plancher, pas un défaut.** L'entreprise peut faire mieux, jamais moins. | Sans ça, le produit laisse un client s'auto-dénoncer en cas de contrôle — et c'est En-Check qui aura fourni le formulaire |
| P3 | **Toute règle est datée.** « +150 % à partir du 1ᵉʳ novembre » — pas « +150 % ». | Sinon changer la règle réécrit janvier (constat **C1**) |
| P4 | **Le repos compensateur est une compensation de plein droit**, pas une exception à coder plus tard. | Beaucoup d'employeurs ne paient pas la prime : ils donnent un jour |
| P5 | **Une règle sans source n'est pas une règle.** Chaque plancher porte sa source et sa date de vérification. | La valeur juridique relève de **D5**. Un chiffre inventé est pire qu'un chiffre absent |
| P6 | **« 0 parce que la loi ne l'exige pas » ≠ « 0 parce qu'on ne sait pas ».** | Les deux doivent être distinguables à l'écran, dans le calcul et dans la preuve |

---

## 3. Le modèle : quatre niveaux, du plus général au plus précis

```
N0  PAYS            plancher légal (sourcé, daté)          ← jamais contournable
N1  ENTREPRISE      politique (taux, forme, plafond)        ← datée
N2  FÉRIÉ           exception sur un jour précis            ← datée
N3  SALARIÉ         dérogation contractuelle (option)       ← datée
```

**Règle de résolution :** le niveau le plus précis gagne, **mais jamais en dessous du
plancher pays**. Et si le plancher pays est inconnu : **refus**, pas de repli.

> **Exemple de résolution.** 1ᵉʳ août, Awa, entreprise au Bénin.
> ```
> N0  Bénin            plancher = +100 %      (source : à sourcer, D5)
> N1  Entreprise       politique = +150 %     (à partir du 01/01/2026)
> N2  Férié 01/08      aucune exception
> N3  Salarié          contrat = « selon accord d'entreprise »
> → RETENU : +150 %, niveau N1, motif « politique de l'entreprise »
> ```
> La résolution doit **toujours** pouvoir s'écrire comme ça. Une règle qu'on ne peut pas
> expliquer en quatre lignes n'est pas applicable.

---

## 4. Les six questions d'une règle

| # | Question | Réponses possibles | État actuel |
| --- | --- | --- | --- |
| Q1 | **Quel taux ?** | 0 à n % (0 = pas de majoration) | ✅ champ existant |
| Q2 | **Sous quelle forme ?** | `prime` · `repos` · `prime ou repos (au choix)` · `prime + repos partiel` | ❌ |
| Q3 | **À partir de quand ?** | une date d'effet, avec historique | ❌ |
| Q4 | **Pour qui ?** | tous · une catégorie (cadres, gardiens…) · un site | ❌ |
| Q5 | **Plafonné à combien ?** | n heures majorables (ex. 8 h), le reste en heures sup ordinaires | ❌ |
| Q6 | **Ce jour est-il férié pour nous ?** | chômé · travaillé chez nous · non férié | ✅ (exception par entreprise) |

---

## 5. Multi-pays : ce qu'on peut écrire, et ce qu'on n'écrit pas

### 5.1 Le catalogue réel du produit

| Pays | Devise | Complexité infranationale | Ce que la spec exige |
| --- | --- | --- | --- |
| Bénin (BJ) | XOF | faible | plancher national |
| Sénégal (SN) | XOF | faible | plancher national |
| Côte d'Ivoire (CI) | XOF | faible | plancher national |
| Mali (ML) | XOF | faible | plancher national |
| Burkina Faso (BF) | XOF | faible | plancher national |
| Niger (NE) | XOF | faible | plancher national |
| Cameroun (CM) | XAF | faible | plancher national |
| Madagascar (MG) | MGA | faible | plancher national |
| Maroc (MA) | MAD | faible | plancher national |
| Tunisie (TN) | TND | faible | plancher national |
| Algérie (DZ) | DZD | faible | plancher national |
| France (FR) | EUR | **élevée** : conventions collectives par branche | plancher **par jour** (certains jours obligatoires, d'autres non) ; le silence est autorisé mais doit être **affiché** comme tel (P6) |
| Belgique (BE) | EUR | **élevée** : commissions paritaires | plancher national (souvent en **repos**, pas en prime) + politique entreprise |
| Suisse (CH) | CHF | **très élevée** : **cantons** | plancher **par canton** — zone obligatoire |
| Autre / Custom | — | inconnue | **refus explicite** tant que le pays n'est pas qualifié |

### 5.2 Ce que ce document ne fait pas

**Il ne remplit aucun taux légal.** Ce serait une faute : les valeurs dépendent d'un droit
positif que ce dépôt ne contient pas, et qu'aucun développeur ne doit reconstituer de
mémoire.

Ce que la spec fixe, c'est le **mécanisme** :

- une table de planchers **sourcée**, datée, versionnée en migration (pas en production
  seule) ;
- une colonne `source` obligatoire (texte + référence + date de vérification) ;
- une colonne `statut` : `verifie` · `a_sourcer` · `aucune_obligation_legale` ;
- **`a_sourcer` bloque le calcul** : mieux vaut refuser une paie que produire un chiffre
  juridiquement faux.

### 5.3 Le cas suisse, qui décide de l'architecture

Un plancher « Suisse » n'a pas de sens : les jours fériés et leur traitement varient
d'un canton à l'autre. Le modèle doit donc accepter une **zone** facultative dans la clé :
`(pays, zone)`. Et pour la Suisse, la zone devient **obligatoire** — sans canton, refus.

C'est le seul pays du catalogue qui impose cette complexité. Le modèle doit la porter dès
le départ, sinon on la rajoutera de travers.

### 5.4 Un piège vérifié : deux systèmes de codes pays dans le même produit

| Endroit | Format | Exemple |
| --- | --- | --- |
| `holidayService.js` (14 pays) | **ISO 2** | `BJ`, `FR`, `CH` |
| `currencyService.js` (`COUNTRY_CURRENCY`) | **ISO 3** | `BEN`, `FRA`, `CHE` |

`CurrencyService.suggestForCountry()` cherche la clé ISO 3 dans un dictionnaire indexé en
ISO 3 — et `holidayService` raisonne en ISO 2. **Une clé de plancher construite sur le
mauvais code ne trouve rien, et ne le dit pas.**

**Prérequis P0, avant toute écriture :** une **seule** fonction de normalisation du code
pays, utilisée partout, avec un test qui prouve que les 14 pays produisent la même clé
dans les deux représentations. Sans ça, un plancher sénégalais pourrait ne jamais
s'appliquer sans qu'aucune erreur ne remonte.

---

## 6. Le repos compensateur

### 6.1 Pourquoi c'est central

Dans les métiers qui travaillent les fériés — hôtellerie, santé, sécurité, commerce —
**le repos est souvent la compensation réelle**, pas la prime. Aujourd'hui le modèle ne
connaît que l'argent : une salariée qui devrait obtenir un jour de récupération n'obtient
**ni la prime, ni le jour**.

### 6.2 Ce qu'il faut modéliser

| Élément | Question | Proposition |
| --- | --- | --- |
| Acquisition | Combien de jours pour un férié travaillé ? | 1 jour par férié travaillé (paramétrable : 0,5 · 1 · 2) |
| Seuil | À partir de combien d'heures le jour est-il acquis ? | au prorata des heures travaillées, plafonné (Q5) |
| Unité | Jour ou heures ? | **heures de récupération** — cohérent avec les congés, et ça gère les demi-journées |
| Consommation | Comment le salarié l'utilise-t-il ? | comme un congé, via le solde existant (`leaveBalanceService`) |
| Expiration | Le solde se périme-t-il ? | paramétrable (n mois), avec alerte avant expiration |
| Preuve | Où le voit-on ? | ligne dédiée sur le bulletin : « repos compensateur acquis — 1 férié (01/08) » |

### 6.3 La règle qui protège

> **Jamais deux fois la même compensation.** Si la forme retenue est `repos`, la prime
> n'est pas versée. Si la forme est `prime`, aucun jour n'est acquis. Si la forme est
> `au choix`, **une** option s'applique et elle est **tracée**.

C'est le test T6 (§9) : c'est le genre d'erreur qui coûte deux fois.

---

## 7. Le simulateur

### 7.1 Ce qu'il affiche

Avant d'enregistrer une règle, l'écran montre l'effet sur un mois réel déjà calculé :

```
Nouvelle règle : +150 % au lieu de +100 %, à partir du 01/11/2026

Octobre 2026 · 3 fériés travaillés · 14 salariés concernés
  Coût actuel   : 336 000 FCFA
  Coût simulé   : 504 000 FCFA
  Surcoût       : 168 000 FCFA  (+50 %)
  Salariés dont le net change : 14
  Salariés dont le net ne change pas : 10
```

### 7.2 Trois règles de conduite

1. **Le simulateur n'écrit rien.** Aucune écriture en base, vérifiable — c'est un calcul
   à blanc. Un simulateur qui laisse une trace dans les données est un piège.
2. **Il porte sur une période déjà calculée**, pas sur une projection. On simule le passé
   récent, pas un futur inventé.
3. **Il nomme les personnes concernées**, pas seulement les montants. Un dirigeant doit
   pouvoir vérifier une ligne avant d'appliquer.

### 7.3 Pourquoi il règle le problème des dates

Le simulateur montre l'écart **avant** et **après**, sur une période **bornée**. Il rend
donc visible, en une phrase, ce que P3 exige : *le passé ne change pas, l'avenir change à
partir d'une date.*

---

## 8. La preuve : ce que le bulletin doit écrire

Un montant sans justification n'est pas une preuve. Chaque ligne de majoration de férié
doit pouvoir s'expliquer en une phrase, sur le bulletin **et** dans le dossier du 10 :

> **01/08/2026 — férié travaillé — 8 h 00**
> Majoration : +150 % → 8 h × 1 500 × 2,5 = **30 000 FCFA**
> Règle : politique entreprise (N1), en vigueur depuis le 01/01/2026
> Plancher pays : +100 % (N0) — respecté
> Source du plancher : *[référence légale]*, vérifiée le *[date]*
> Forme : prime versée · aucun repos compensateur acquis

Trois choses que cette écriture rend impossibles :

- payer sans savoir **d'où vient** le taux ;
- découvrir après coup qu'on était **sous** le plancher ;
- se tromper entre **prime** et **repos**.

---

## 9. Les cas de test

Écrits en français, avec le montant attendu. Ils constituent le contrat de ce lot : si un
seul échoue, le lot n'est pas livré.

### 9.1 Taux et plancher

| # | Situation | Attendu |
| --- | --- | --- |
| **T1** | Bénin. 8 h un férié travaillé. Entreprise : +100 %. 1 500 XOF/h | **24 000 XOF** |
| **T2** | Même cas, entreprise : +150 % | **30 000 XOF** |
| **T3** | Même cas, entreprise : **+0 %** alors que le plancher pays est +100 % | **REFUS** explicite à l'enregistrement, motif « sous le plancher légal » |
| **T4** | France, 15 août travaillé, aucune règle d'entreprise | **0 majoration**, affiché explicitement « aucune obligation légale pour ce jour — vérifiez votre convention collective ». **Ce n'est pas un refus** : le zéro est **connu et sourcé** (P6) |
| **T4-bis** | France, **1ᵉʳ mai** travaillé, aucune règle d'entreprise. 15 €/h | **240,00 EUR** : ici le plancher national **n'est pas nul**, il s'applique à la place du silence (P2) |
| **T5** | France, 15 août, entreprise : +100 %. 15 €/h | **240,00 EUR** (2 décimales) |
| **T6** | Suisse, férié travaillé, **canton non renseigné** | **REFUS** : zone obligatoire |
| **T7** | Suisse, canton de Vaud, plancher canton +100 %, entreprise +120 %. 30 CHF/h | **528,00 CHF** |
| **T8** | Cameroun, 8 h un férié travaillé, +100 %. 2 000 XAF/h | **32 000 XAF** |

### 9.2 Date d'effet

| # | Situation | Attendu |
| --- | --- | --- |
| **T9** | Règle +100 % jusqu'au 31/10, +150 % à partir du 01/11. Un férié le **15/10** | Reste à **+100 %**, même après le changement |
| **T10** | Même entreprise, un férié le **15/11** | **+150 %** |
| **T11** | Recalcul après changement de règle | Le total d'octobre est **identique** au total d'octobre d'avant (P3) |

### 9.3 Forme de la compensation

| # | Situation | Attendu |
| --- | --- | --- |
| **T12** | Forme `repos`, férié travaillé 8 h | **0 prime** + **1 jour (ou 8 h) de récupération** acquis |
| **T13** | Forme `prime`, même cas | Prime versée, **aucun repos** acquis |
| **T14** | Forme `au choix`, aucune option enregistrée | **REFUS** : une option doit être choisie et tracée |
| **T15** | Forme `repos`, le salarié ne consomme jamais son solde | Alerte avant expiration, **jamais de disparition silencieuse** |

### 9.4 Plafond

| # | Situation | Attendu |
| --- | --- | --- |
| **T16** | Férié, 10 h travaillées, plafond **8 h majorées** | 8 h à +100 % **+** 2 h traitées en heures sup ordinaires (et non 10 h à +100 %) |
| **T17** | Férié, 10 h, **aucun plafond** | 10 h à +100 % |

### 9.5 Cas tordus (ceux qui cassent en production)

| # | Situation | Attendu |
| --- | --- | --- |
| **T18** | Férié tombant un **samedi** (jour non travaillé) et **travaillé** | Traité comme **férié**, pas comme un samedi ordinaire (aujourd'hui : +25 %) |
| **T19** | Férié déclaré « **travaillé chez nous** » (`custom_is_worked`) | Pas de majoration **férié** ; les heures sup ordinaires s'appliquent |
| **T20** | Pays de l'entreprise **inconnu** | **REFUS** du calcul, message actionnable — jamais de repli silencieux (P1) |
| **T21** | Deux règles d'entreprise **qui se chevauchent** sur la même date | **REFUS** : ambiguïté, pas « la dernière gagne » |
| **T22** | Devise **XOF** | Montants **sans décimale** |
| **T23** | Devise **EUR** ou **CHF** (2 décimales) · **TND** (**3** décimales) | Les décimales suivent la devise, jamais un `2` codé en dur |

### 9.6 Non-régression de l'audit

| # | Situation | Attendu |
| --- | --- | --- |
| **T24** | **Aucune** configuration d'entreprise, pays connu | Le **plancher pays** s'applique — et **jamais** « heures normales sans majoration » (c'est exactement le bug A1) |
| **T25** | Le total mensuel d'un salarié sans férié travaillé | **Inchangé**, au centime près, avant et après ce lot |

---

## 10. Critères d'acceptation

Le lot est livré quand :

1. **Aucun** calcul de férié ne se fait sans une résolution tracée (pays → entreprise →
   férié → salarié), lisible en une phrase.
2. **Aucun** repli silencieux : pays absent, règle absente, règle sous le plancher, zone
   manquante → refus explicite, jamais un chiffre par défaut.
3. Modifier une règle **ne change aucun** total de paie antérieur (T11).
4. Le **repos compensateur** est acquis, visible, consommable et traçable — et jamais
   cumulé avec la prime (T12, T13).
5. Le **simulateur** n'écrit rien (vérifiable : aucune écriture en base pendant une
   simulation).
6. Chaque ligne de majoration du bulletin porte **sa règle, son niveau et sa source**
   (§8).
7. Les **26 cas de test** passent, sur les 5 devises concernées (XOF, XAF, EUR, CHF, TND) et au
   moins 4 pays.
8. La **normalisation du code pays** est unique et testée sur les 14 pays (§5.4).

---

## 11. Découpage en trois livraisons

Le lot complet est trop gros pour être livré d'un coup. Trois incréments, chacun
utilisable seul.

### L1 — Le fil (corrige A1, sans interface)

- Transmettre le jour férié au calcul d'heures sup.
- Appliquer le **plancher pays** quand l'entreprise n'a rien dit.
- Refuser si le pays est inconnu ou le plancher `a_sourcer`.
- **Tests :** T1, T18, T20, T24, T25.

*Effet : le bug A1 disparaît, et le produit cesse de payer un férié comme un mardi.*

### L2 — La règle (l'interface et les dates)

- Taux d'entreprise **daté**, exceptions par férié, plafond, périmètre.
- Refus sous le plancher (T3), refus d'ambiguïté (T21), refus France sans politique (T4).
- **Tests :** T2, T3, T4, T4-bis, T5, T6, T7, T8, T9, T10, T11, T16, T17, T19, T21, T22, T23.

*Effet : chaque entreprise applique réellement ses règles, et le passé ne bouge plus.*

### L3 — Le repos et la preuve

- Repos compensateur complet (acquisition, solde, consommation, expiration).
- Simulateur **avant** enregistrement.
- Ligne de preuve sur le bulletin et dans le dossier du 10.
- **Tests :** T12, T13, T14, T15.

*Effet : le produit couvre le cas le plus fréquent des métiers qui travaillent les fériés.*

---

## 12. Dépendances et risques

| Dépendance | Nature | Conséquence si absente |
| --- | --- | --- |
| **D5** (valeur probante / source légale) | **Bloquante pour les valeurs** | On peut livrer L1 avec un plancher `a_sourcer` qui **refuse** de calculer — jamais avec un chiffre inventé |
| **A1** | **Amont** | L1 *est* A1. On ne fait pas deux chantiers |
| **C1** (photographie datée) | **Amont pour L2** | Sans dates d'effet, L2 réécrit le passé |
| **C5** (journal de preuve) | **Compagnon** | Un changement de règle doit laisser une trace qui ne s'efface pas |
| **P0** (normalisation du code pays) | **Bloquante** | Un plancher keyé sur le mauvais code ne s'applique jamais, en silence |

### Les trois risques à surveiller

| Risque | Parade |
| --- | --- |
| On remplit les planchers « de mémoire » | `statut = a_sourcer` **bloque** le calcul. Un refus est un aveu honnête ; un chiffre faux est un préjudice |
| Le taux par entreprise devient un outil de contournement | Plancher pays non modifiable, refus explicite en dessous (T3) |
| Le repos compensateur double la prime | Une seule forme à la fois, tracée (T12, T13, T14) |

---

## 13. Ce que ce lot ne fait **pas**

- Il ne fixe **aucune valeur légale** : il fixe le mécanisme qui les reçoit.
- Il ne gère pas les **conventions collectives** de branche (France, Belgique) : le champ
  « politique d'entreprise » les accueille, mais le produit n'arbitre pas leur hiérarchie.
  C'est un sujet à part, et un vrai.
- Il ne traite pas les **fériés chômés** (jour non travaillé) : c'est le calcul de
  l'attendu, déjà couvert.
- Il ne modifie **aucune** règle d'heures supplémentaires ordinaire : T25 le vérifie.
- Il n'ajoute **aucune** écriture en base pendant une simulation.

---

## 14. En une phrase

> Chaque entreprise doit pouvoir dire **sa** règle de férié — mais aucune ne doit pouvoir
> descendre sous le plancher de **son** pays, ni faire changer le passé ; et quand le
> produit ne sait pas, il doit **le dire**, pas deviner.
