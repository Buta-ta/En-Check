# Planning — choisir une équipe formée dans Employés → Équipes

## La demande

> « je veux qu'on puisse sélectionner aussi les équipes déjà formées et créées
> dans la page équipes (employé) onglet équipes »

Le filtre **Afficher** du planning ne proposait que des départements
(`INFORMATIQUE CHOQUE`, `PHARMACIE`, `VENTE`…) et `SANS ÉQUIPE`. Les équipes
créées dans **Employés → Équipes** — tables `teams` et `team_members` — restaient
invisibles, alors que c'est là que l'organisation réelle se décide.

## Ce qui change

### 1. Le planning lit les vraies équipes

`getTeamsPourPlanning(enterpriseIds)` (nouveau, `src/services/teamService.js`)
lit en **deux requêtes** les équipes de toutes les entreprises affichées et
leurs membres actifs, et rend la même forme que `getTeams` :

```js
{ id, enterprise_id, name, color, leader, members: [{ employee: { id } }] }
```

Le planning ne relit ces équipes que lorsque le **périmètre d'entreprises**
change (`cleEquipes` comparée à `equipesCleRef`) : changer de semaine ne
relance pas la lecture.

### 2. Trois sources, un seul nom d'équipe

`src/lib/planningEquipes.js` décide à quelle équipe appartient une personne :

| Ordre | Source | Exemple |
| --- | --- | --- |
| 1 | **équipe formée** (page Équipes) | la personne est dans `team_members` |
| 2 | **affectation locale** du planning (« Gérer les équipes ») | mémorisée dans le navigateur |
| 3 | **département** de la fiche employé | `department = "PHARMACIE"` |

Sans aucune des trois : `SANS ÉQUIPE`. Une personne membre de deux équipes
n'est comptée qu'une fois (la première).

### 3. Deux groupes dans le filtre

```
Afficher  ▾
  Toute l'équipe (2)
  ── Équipes formées · page Équipes ──
     PHARMACIE (6)
     RECETTE (1)
  ── Départements et équipes du planning ──
     INFORMATIQUE CHOQUE (2)
     VENTE (1)
     SANS ÉQUIPE (3)
  ── Collaborateurs ──
```

Les équipes formées **vides** apparaissent aussi : une équipe créée mais pas
encore staffée doit se voir.

### 4. Une barre par identité, pas par nom

> **Corrigé au round 48.** La première version regroupait par **nom en
> majuscules** : l'équipe formée « Équipe de vente » et le département
> « VENTE » de la fiche employé se retrouvaient dans la même barre, et des
> non-membres (Boss buta, Koné KOMI) apparaissaient dans l'équipe.

Chaque barre porte désormais une **clé** qui dit d'où elle vient :

| Clé | Origine | Membres |
| --- | --- | --- |
| `equipe:<team.id>` | table `teams` / `team_members` | exactement les `team_members` actifs |
| `departement:<NOM>` | champ `department` de la fiche employé | les personnes de ce département, et elles seules |
| `locale:<NOM>` | équipe créée depuis le planning (`localStorage`) | affectations locales |
| `sans` | aucune des trois | « SANS ÉQUIPE » |

Deux barres peuvent donc porter le **même titre** sans fusionner : c'est
voulu, et c'est signalé dans la liste du filtre (`… · département`,
`… · équipe du planning`) ainsi que par une marque **en creux** sur la barre.
Le filtre « Afficher » retient la clé choisie, jamais le nom : sélectionner
l'équipe de vente affiche ses 3 membres, pas les 5 personnes du département.

### 5. Ce qui ne se fait pas depuis le planning

Une barre d'équipe formée porte la marque **Équipe formée** et un seul bouton,
**Voir dans Équipes** (`/employes?vue=equipes`) : on ne renomme pas et on ne
supprime pas l'organisation officielle depuis le planning. Les équipes locales,
elles, gardent **Gérer** et **Supprimer**.

Le modal « Gérer les équipes » du dock précise désormais qu'il s'agit d'une
**équipe locale du planning** et propose un bouton **Page Équipes**.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/planningEquipes.js` | lecture pure : normalisation, table employé → équipe, nom effectif |
| `src/services/teamService.js` | `getTeamsPourPlanning` (teams + team_members, toutes entreprises) |
| `src/pages/Planning.jsx` | chargement, groupement, deux `optgroup`, marque et actions |
| `src/pages/PlanningAfroTech.css` | `.sk-group-badge` |
| `src/services/__tests__/planningEquipesFormees.test.js` | 33 tests (module pur, défaut du round 48, câblage) |

## Vérifications

```
npx vitest run                                                 → 138 fichiers, 1835 tests ✓
npx vite build                                                 → ✓
npx eslint src --config eslint.gate.config.js                  → 0 erreur
npx eslint src/pages/Planning.jsx                              → erreurs identiques à l'existant
```
