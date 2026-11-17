# Dictionnaire de données du tableau de bord

> Référence unique des chiffres qu'affiche le dashboard En-Check.
> Chaque définition reprend **ce que le code calcule réellement**
> (état main après PR #219) — pas l'intention. Quand un
> libellé et une définition divergent, c'est la définition qui
> fait foi : le libellé est corrigé.
>
> Règles d'affichage transverses (valables pour toute carte) :
> - **jamais de chiffre sans unité ni base** (« 8 sur 12 », « 4/16 ») ;
> - **aucun pourcentage de tendance sous 30 événements** dans la
>   période : sous ce seuil, le % est du bruit, pas un signal ;
> - **un jour en cours ne se compare jamais** à des journées
>   complètes (pas de « vs semaine précédente » sur les KPI du jour) ;
> - **distinguer `0` / aucune donnée / erreur** : « — » pour un
>   calcul impossible, jamais « 0 % » sur une base vide ;
> - **périmètre et période nommés** sur chaque carte
>   (entreprise, « analyse 7 jours », base « sur N »).

## 1. Périmètre

| Notion | Définition |
|---|---|
| **Périmètre** | L'entreprise sélectionnée (`selectedEnterprise`). En super admin sans sélection : **toutes les entreprises** (consolidé). Le nom du périmètre est toujours affiché sous le titre de section et sur les cartes « du jour ». |
| **Effectif** | `employees` avec `is_active = true` du périmètre. C'est la base de tous les taux. Si l'effectif est 0, aucun taux n'est calculé (« Aucun employé actif », « — »). |
| **Jour** | La journée civile **à l'heure locale de l'entreprise** (fuseau `timezone` de l'entreprise, ex. `Africa/Porto-Novo`). |

## 2. Pointages (`attendances`)

| Notion | Définition |
|---|---|
| **Pointage** | Une ligne `attendances` du périmètre sur la période. `check_type` : `in` (entrée) / `out` (sortie). `pointages_day =` nombre de lignes `in` du jour. |
| **Présents aujourd'hui** | Nombre d'**employés distincts** ayant au moins une entrée aujourd'hui (un employé qui pointe deux fois compte une fois). |
| **En congé aujourd'hui** | Nombre de lignes `absences` du périmètre couvrant aujourd'hui (`congesToday`), quel que soit le motif. |
| **Pas encore pointé** | Employé actif sans pointage ni congé déclaré, **tant que la fin du poste n'est pas dépassée** (voir §4). Libellé d'attente : ce n'est pas une faute, c'est l'absence d'information. |
| **Absent** | Même définition, **après** la fin du poste dépassée. Le mot « absent » n'apparaît jamais avant : avant, c'est « pas encore pointé ». |
| **Taux de présence du jour** | `arrondi(présents / effectif × 100)`, en %. Jamais affiché si l'effectif est 0. C'est un taux **en cours**, jamais comparé à une période complète. |
| **Retard** | Entrée du jour strictement après `start_time + tolérance`, **à l'heure locale de l'entreprise**. `start_time` = planning personnalisé de l'employé (si `use_custom_hours`), sinon planning par défaut de l'entreprise ; tolérance = `late_tolerance_minutes` (15 min par défaut). Compté uniquement si le module « Retards » est actif pour l'entreprise. |
| **Sortie présumée (oubli de sortie)** | Entrée du jour avec `is_auto_closed = true` **et** `estimation_validee_le IS NULL` **et** `estimation_remplacee_le IS NULL`. Autrement dit : la sortie a été présumée par la borne, ni validée par un humain ni remplacée par une vraie sortie. Ces sorties **ne sont pas comptées dans la paie** tant qu'elles ne sont pas validées. |
| **Sortie manquante (alerte)** | Entrée du jour sans aucune sortie, seuil de configuration commun (pas une estimation) — `findMissingExitEntries`. |

## 3. Conflits (`attendance_conflicts`)

| Notion | Définition |
|---|---|
| **Conflit** | Un pointage effectué **pendant une absence déclarée**. `status = pending` = non résolu. Le conflit disparaît du compteur quand il est traité dans Pointages (le statut change) — pas quand la notification est lue. |

## 4. Fin du poste et auto-fermeture

| Notion | Définition |
|---|---|
| **`auto_close_time`** | Heure locale à laquelle la borne présume la sortie des employés restés sans badger. Valeurs en base : EN-NOUS `22:00`, Épicerie du Port `23:59`, Tech Senegal `23:59`, Pharmacie Blanche Gomes `23:59` (fermeture auto OFF pour certaines). Défaut code : `18:00`. |
| **Fin du poste dépassée ?** | `heure locale de l'entreprise (maintenant) ≥ auto_close_time`. C'est LE seuil qui transforme « pas encore pointé » en « absent ». |
| **Fermeture auto OFF** | Si l'entreprise a désactivé l'auto-fermeture, la borne ne présume aucune sortie : plus de « sorties présumées » pour elle. |

## 5. Tendances et périodes (vue kente)

| Notion | Définition |
|---|---|
| **Période** | 7 / 30 / 90 jours glissants, au choix (pilotes). Le libellé affiché est « analyse 7 jours » etc. |
| **Tendance (delta)** | Variation % vs la période précédente de même longueur — **affichée seulement si la période contient au moins 30 événements** (sinon badge « — »). |
| **Moyenne 7 j** | Moyenne des entrées par jour sur les 7 derniers jours (base du KPI « Pointages du jour »). |
| **Santé RH** | `assiduité` et `régularité` en %, calculés sur la **semaine glissante**. |
| **Heatmap** | Grille jour de semaine × 24 h (fuseau de l'entreprise), densité = nombre de pointages. Le survol donne le détail exact de la cellule. |

## 6. Notifications — le compteur « à traiter » (P1)

| Notion | Définition |
|---|---|
| **Actionnable (= compteur de la cloche)** | Un élément est compté tant qu'il est **non résolu en base** : conflit `pending`, sortie présumée non validée, demande de congé `en_attente`, demande de modification d'horaires `pending`, alerte de gravité `critique`/`attention` non lue. Le compter « lu » ne le retire pas du compteur — seulement la résolution le retire. |
| **Non actionnable** | Les retards du jour (fait accompli, information), les signaux commerciaux (prospects à relancer, devis sans réponse) : visibles et filtrables, hors compteur. |
| **Agrégation** | Les alertes sont regroupées **par niveau de gravité** (une ligne ×N), jamais une ligne par alerte. Les conflits sont regroupés en une ligne. La liste est plafonnée à 30 lignes + « +N autres dans la page liée ». |
| **Marquer lu (ligne agrégée)** | Marque lues **toutes** les alertes du groupe en base (`encheck_alertes_marquer`). |

## 7. Alertes serveur (`encheck_alertes_*`)

| Notion | Définition |
|---|---|
| **Balayage** | `encheck_alertes_scan` (≤ 1 fois / 5 min) détecte les anomalies à leur occurrence ; `encheck_alertes_lister` les relève (50 max) ; `encheck_alertes_marquer` marque lues. |
| **Gravité** | `critique` (pousse téléphone, pastille rouge), `attention` (pousse téléphone, pastille ambre), `info` (cloche uniquement). |
| **Signal d'assiduité** | `assiduite_signal` : 1 par semaine par personne, avec détail propre (non agrégé, max 5 affichés, modal de détail). |

## 8. Ce que le dashboard ne calcule PAS

- **Aucun score global opaque** (pas de « note de présence » agrégée).
- **Aucune comparaison de jours inachevés** (le −75 % mécanique est interdit).
- **Aucun % sur base < 30 événements** pour les tendances.
- **Aucun chiffre sans sa base** (« sur N » ou « toutes les entreprises »).

## 9. Glossaire des sources

| Table / RPC | Rôle |
|---|---|
| `employees` | Effectifs (`is_active`), prénoms/noms, entreprise. |
| `enterprises` | Fuseau `timezone`, `auto_close_time`, modules activés. |
| `attendances` | Pointages bruts + sorties présumées (`is_auto_closed`, `estimation_*`). |
| `absences` | Congés/maladies déclarés (`status : en_attente / …`). |
| `attendance_conflicts` | Conflits pointage/absence (`status = pending`). |
| `schedule_change_requests` | Demandes de modification d'horaires (`status = pending`). |
| `encheck_alertes_scan / _lister / _marquer` | Détection, relevé, marquage des anomalies. |
| `encheck_signaux_controler` | Balayage des signaux d'assiduité hebdomadaires. |

---
*À mettre à jour avec chaque changement de définition — un chiffre
dont la définition a bougé sans note est une dette de confiance.*
