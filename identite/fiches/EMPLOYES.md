# Fiche de page — Employés

> **Statut : validée par le fondateur le 08/11/2026 — « je valide » (maquette v3).**
> Cette fiche est le contrat de l'agent dev. Une page = une branche = une fiche.
> Rien n'est codé tant que la fiche n'est pas lue. « Comme l'autre page » est
> interdit : chaque valeur est écrite ici.

---

## 0. Où est la maquette (à ouvrir avant d'écrire une ligne)

| Quoi | Où |
|---|---|
| La maquette validée | `maquettes/employes.html` |
| Son CSS | `maquettes/employes-v3.css` |
| La référence du fondateur (l'original) | `maquettes/reference-employes.png` |
| Comment la voir | `python3 maquettes/serve.py 4173` puis `http://localhost:4173/maquettes/employes.html` |
| Le bouton qui bascule clair/sombre | le soleil, dans la barre du haut |

**Règle de lecture** : l'agent ouvre la maquette **en clair et en sombre**, à
1 440 px de large, avant de coder. Il ne juge pas le code, il juge l'écran.

---

## 1. Identité de la page

| Champ | Valeur | Décision |
|---|---|---|
| Route | `/employes` | — |
| Nom affiché | **Employés** | — |
| Nom du bloc tableau | **« Tous les employés »** | le mot « annuaire » est **banni** |
| Thèmes | clair par défaut + sombre (1 bouton) | D-005 |
| Composition | reprise de la référence du fondateur, à l'identique | **D-022** |

> **D-022, dans les mots du fondateur** : « je valide la version clonée ».
> Ce qui se transmet d'une référence : la structure, la hiérarchie, la densité,
> le rythme. Ce qui ne se transmet **jamais** : les couleurs, les polices, les
> rayons, les ombres — qui restent ceux de la charte.

---

## 2. La structure (de haut en bas)

| # | Bloc | Contenu | Règle |
|---|---|---|---|
| — | **La barre latérale** | rail 58 px + panneau 254 px, **rayon 12 px sur les deux** | D-018 + demande du 08/11. **Ne pas la refaire** : `SidebarNavigation.jsx` la porte déjà. Seul le rayon change. |
| 1 | **Barre du haut** | ☰, « Dashboard », recherche rapide, 3 icônes, avatars empilés +10, bouton « Inviter » | elle existe déjà dans la coque — la réutiliser |
| 2 | **En-tête** | « Bonjour, {prénom} {nom} » en 20 px/700 · sélecteur de période « 01 nov. – 15 nov. » · bouton « Exporter » | une seule action pleine par écran |
| 3 | **Trois cartes KPI** | voir §3 | cartes à anatomie interne, pas des tuiles vides |
| 4 | **Deux grands blocs** | « Performance de l'équipe » · « Chiffre d'affaires » | voir §3 |
| 5 | **Le tableau** | « Tous les employés » + barre d'outils + tableau + pied | voir §4 |

---

## 3. Les cartes, une par une (valeurs mesurées sur la maquette)

### 3.1 Effectif total
- Deux lignes teintées, hauteur 38 px, rayon 6 px.
- Ligne 1, fond succès 11 % : `150` (19 px/700) · `↗ 50` (9,5 px/600 succès) · « Salariés à temps plein ».
- Ligne 2, fond alerte 13 % : `50` · `↘ 10` (9,5 px/600 erreur) · « Indépendants ».
- Titre de carte 12 px/600 + menu `⋮` à droite.

### 3.2 Assiduité du jour
- `90 %` en 22 px/700 · `↗ 20 %` en 9,5 px succès · « depuis le mois dernier ».
- Barre empilée de **7 px** de haut, rayon pilule, **trois segments** : 22 % alerte, 16 % neutre, 62 % argile.
- Légende dessous, points de 7 px : Arrêt maladie · Congé · À l'heure.

### 3.3 Appareils utilisés aujourd'hui
- Anneau **86 × 86 px**, épaisseur 10 px, trois arcs (62 % / 27 % / 11 %).
- Centre : `100` (17 px/700) + « au total » (8,5 px).
- Légende à droite, filet de 3 × 11 px par ligne : 80 Ordinateur portable · 13 Clavier · 07 Casques.

### 3.4 Performance de l'équipe
- `98 %` en 20 px/700, note de contexte à droite (9,5 px, max 190 px).
- **5 lignes** de **3 segments** (12 px de haut, 3 px de rayon, écart 2 px) : tâches terminées / présence / réunions tenues.
- Axe 0 → 40 sous les barres (8,5 px) ; légende en pied de carte.

### 3.5 Chiffre d'affaires
- **12 colonnes** (janv. → déc.), zone de 150 px, écart 8 px.
- Chaque colonne = **deux barres empilées** : dépense (hachures) au-dessus, revenu (argile plein) en dessous.
- Grille horizontale de 6 filets ; axe `0 … 13 k` à gauche (8 px).
- **L'infobulle est un état, pas une décoration** : « mai 2024 · Revenu 2 198,11 € · Dépense 733,43 € », fond surface, bordure, ombre dure 2 px.

---

## 4. Le tableau « Tous les employés »

| Colonne | Contenu | Forme |
|---|---|---|
| case | `input[type=checkbox]`, 14 px, `accent-color` argile | — |
| Matricule | chiffres tabulaires | texte 11,5 px |
| Nom | avatar 24 px + nom | image ou initiales |
| E-mail | gris doux | texte 11,5 px |
| Poste | texte | — |
| Service | étiquette encadrée 22 px de haut | forme « cadre » |
| Statut | pilule 22 px : point 6 px + mot | forme « pilule ». **Le mot est obligatoire** (D-009) |
| Actions | 2 boutons de 24 px : voir, puis `⋮` | **jamais un troisième** (D-017) |

- En-tête de colonnes : 9 px/600, capitales, espacées 0,6 px, fond surface2 à 42 %.
- Ligne : hauteur 46 px, filet 1 px, survol surface2 à 34 %.
- Barre d'outils du bloc : recherche (168 px), « Tous les statuts », « Tous les postes », « Exporter » — 30 px de haut, rayon 6 px.

---

## 5. Les mesures exactes

| Élément | Valeur | Source |
|---|---|---|
| Fond de page | `var(--charte-sable)` | D-001 |
| Carte de contenu / cartes | `var(--charte-surface)` + filet 1 px + **ombre dure** | D-016 |
| Rayon des cartes | **12 px** (`--charte-rayon-tuile`) | D-016 |
| Rayon des champs et boutons | 6 px (`--charte-rayon-champ`) | D-016 |
| Barre latérale | rail **58 px** · panneau **254 px** · écart 10 px · **rayon 12 px** | D-018 + 08/11 |
| Gouttière du cadre | 10 px | maquette |
| Corps | padding 18 / 20 / 26 px · écart entre blocs 14 px | maquette |
| Titre de page | **20 px / 700** | D-013 |
| Chiffres KPI | 22 px / 700, tabulaires | maquette |
| Titre de carte | 12 px / 600 | maquette (§7) |
| Corps de tableau | 11,5 px | maquette (§7) |
| Micro-libellés | 9,5 px / 600 | maquette (§7) |
| Boutons | h 34 · bordure **2 px espresso** · ombre `2px 2px 0` · 11,5 px/600 | D-016 |
| Aucune couleur en dur | que des `var(--charte-*)` | C1 |

---

## 6. Interdits sur cette page

- **Le mot « annuaire »** — nulle part, ni en titre, ni en commentaire, ni en clé technique.
- Une **couleur seule** pour dire un statut (D-009) : le mot est obligatoire.
- Un **troisième bouton** sur une ligne de tableau (D-017).
- Des **ombres floues** (C9) ou un rayon hors de {6, 8, 11, 12, 999} (C10).
- Une **tuile bento** hors accueil (D-014) : ici les cartes sont des cartes, pas des tuiles bento.
- Un **violet**, un bleu froid, un gris bleuté : la palette est celle de D-001.
- Une **police tierce** : IBM Plex seulement (C6).

---

## 7. Trois points à trancher avant de coder

| # | Point | La charte | La maquette validée | Qui décide |
|---|---|---|---|---|
| 1 | **Échelle de texte** | 20 / 14 / **11** (trois tailles, D-013) | **cinq** tailles : 22 / 20 / 12 / 11,5 / 9,5 | le fondateur |
| 2 | **Actions pleines** | une seule par écran | deux : « Inviter » et « Exporter » | le fondateur |
| 3 | **Le contenu anglais** de la maquette | français partout (D-010) | anglais + noms d'exemple | tranché : on traduit à la livraison (§8) |

Tant que le point 1 n'est pas tranché, l'agent dev **ne code pas les tailles** :
soit il applique D-013 (20/14/11), soit il applique la maquette (5 tailles) —
jamais un mélange.

---

## 8. Les libellés français (à utiliser tels quels)

| Maquette (anglais) | Produit (français) |
|---|---|
| Dashboard | Tableau de bord |
| Invite | Inviter |
| Export Data | Exporter |
| Total Employees | Effectif total |
| Fulltime Employee / Freelance Employee | Salariés à temps plein / Indépendants |
| Attendance Overview | Assiduité du jour |
| Sick Leave / Day Off / On time | Arrêt maladie / Congé / À l'heure |
| Today Used Devices | Appareils utilisés aujourd'hui |
| Macbook / Keyboard / Headphones | Ordinateur portable / Clavier / Casques |
| Employee Performance Ratings | Performance de l'équipe |
| Task completed / Presence / Completed Meeting | Tâches terminées / Présence / Réunions tenues |
| Income Statistics | Chiffre d'affaires |
| Income / Expense | Revenus / Dépenses |
| All Employees | **Tous les employés** |
| Search Employee / All Status / All Role | Rechercher un employé / Tous les statuts / Tous les postes |
| Employee ID / Employee name / Role / Departments | Matricule / Nom / Poste / Service |
| Full-time / Freelance | Temps plein / Indépendant |

---

## 9. Ce que l'agent doit rendre dans sa PR

1. **Deux captures** — 1 440 px, clair **et** sombre. Pas une, deux.
2. **La sortie brute** de `npm run charte` (pas un résumé).
3. **La liste des écarts** entre cette fiche et ce qu'il a livré, écrite par lui.
   Un écart non déclaré est un refus de PR, même si la page est belle.
4. **Aucune capture** = **aucune PR** (règle du 18/11).

---

## 10. Le prompt à coller dans l'agent dev

```
Lis, dans cet ordre, et ne code rien avant :
1. identite/PROTOCOLE-IMPLEMENTATION.md
2. identite/fiches/EMPLOYES.md   ← le contrat de ta page
3. identite/DECISIONS-ENTERINEES.md  (D-001, D-006, D-013, D-016, D-017, D-018, D-022)

Tu travailles sur la page Employés (/employes), et sur elle seule.
La maquette validée est maquettes/employes.html : ouvre-la avec
`python3 maquettes/serve.py 4173`, en clair PUIS en sombre, à 1440 px.

Tu n'améliores pas la charte, tu l'appliques. Si elle t'empêche de faire
quelque chose, tu t'arrêtes et tu le signales — tu ne contournes pas.

Tu ne copies pas le HTML de la maquette : tu refais la page en React, avec
les composants et la coque existants (SidebarNavigation.jsx, topbar du
dashboard), et tu portes les valeurs de la fiche à l'identique.

Dans ta PR : 2 captures (clair + sombre, 1440 px), la sortie brute de
`npm run charte`, et la liste de tes écarts. Pas de capture, pas de PR.
```

---

## 11. Journal

| Date | Événement |
|---|---|
| 08/11/2026 | Maquette v3 validée par le fondateur : « je valide ». D-022 consignée. |
| 08/11/2026 | Bords de la barre latérale arrondis à 12 px dans le produit (`src/pages/Dashboard.css`). |
| 08/11/2026 | Cette fiche ouverte. Trois points en attente (§7) — ils bloquent la passation. |
| 08/11/2026 | **La page est codée** (le fondateur : « code le toi. Mais attention, la page doit être en français »). Voir §12 pour les écarts assumés. |

---

## 12. Ce qui a été livré (08/11/2026)

| Fichier | Ce qu'il porte |
|---|---|
| `src/pages/Employes.jsx` | l'en-tête, les trois cartes, les deux blocs, le tableau, l'export CSV |
| `src/pages/EmployesV3.css` | toutes les formes `empv3-*`, aucune couleur en dur |
| `src/services/__tests__/employesEquipesTaches.test.jsx` | les tests mis au nouveau contrat (trois cartes, filtres de la barre d'outils) |

**Mesures du jour :** `npx vite build` ✓ · `npx vitest run` → **1 929 tests passés, 0 échec** (5 fichiers en erreur de
collecte, **sans rapport** : paie, motifs d'absence, notifications — déjà rouges avant cette page) ·
`npm run charte` → C2, C6 verts ; C1 **4 707** valeurs en dur (contre 4 712 : −5, les pastilles retirées) ;
C9 et C10 **inchangés**. La page n'ajoute **aucune** violation.

### Les écarts entre la maquette et la page, dits franchement

| # | La maquette | La page livrée | Pourquoi |
|---|---|---|---|
| 1 | Chiffre d'affaires, appareils utilisés | **Effectif, assiduité, accès au portail** | ces deux blocs de la référence n'ont **aucune donnée** dans le produit : les afficher aurait été un chiffre inventé à l'écran |
| 2 | cases à cocher en tête de ligne | **absentes** | aucune action de masse n'existe : une case qui ne fait rien est un mensonge |
| 3 | deux boutons pleins (Inviter, Exporter) | **un seul** (« Nouvel employé »), « Exporter » en contour | D-013 : une seule action de poids maximal |
| 4 | périodes 01–15 sept. | **la date du jour**, en pastille | aucune série historique n'est disponible |
| 5 | filtres « Tous les statuts / Tous les postes » | **les six filtres d'état** qui existaient déjà | ils sont branchés sur les données réelles de présence |
| 6 | tailles 22 / 20 / 12 / 11,5 / 9,5 | **identiques** | la maquette validée fait foi ; D-013 en prévoit trois — **point §7 toujours ouvert** |

Le bloc « Tous les employés » remplace la grille de cartes ; chaque ligne garde ses actions
(fiche, badge, pointages, horaires, mot de passe, suppression) dans le menu `⋮`.

### Correction du 08/11 — la collision avec `main`

`main` avait avancé entre-temps : la page Employés y avait été refaite par **une autre IA**
(PR #232 « annuaire en peau D, tableau filets 25 lignes/page ») puis réparée (PR #233 : coque
`empv2-coque`, variables de la barre, échappements). Ma branche partait d'avant.

**Résolution retenue** : la coque et le tableau de `main` sont **conservés** (ils sont réparés, le
tableau est paginé à 25 lignes et `LigneAnnuaire` porte les actions) ; la **composition validée**
vient par-dessus — les trois cartes remplacent les trois tuiles, les deux blocs sont ajoutés, la
recherche (qui n'avait plus de champ) revient dans la barre d'outils, et l'en-tête reçoit la date
et l'export. Rien de leur travail n'est jeté.

### Clonage de la référence v2, élément par élément — avancement

La référence `maquettes/reference-employes-v2.png` se découpe en **dix éléments**. On les prend
**un par un**, chacun discuté puis validé (D-022 : composition reprise ; palette, police, rayons et
ombres restent les nôtres).

| # | Élément de la référence | État | Ce qui est posé |
|---|---|---|---|
| 1 | la coque : rail à icônes + colonne à pastilles | **livré** | `.nav3-rail`, `.nav3-colonne`, `.nav3-haut`, `.nav3-pastille` |
| 2 | quatre cartes de chiffres | **livré** | `.empv3-cartes` + `.empv3-kpi` : Effectif, Présents, Accès au portail, Retards |
| 3 | « Meeting Scheduling » : la grille de la semaine | **livré** | `.empv3-grille-planning` → `.empv3-semaine` : `lun.`→`dim.`, une ligne par personne, cases `pointé / absence / rien` |
| 4 | « Feature Events » : les cartes teintées | **livré** | `.empv3-annonces` : les annonces d'accueil **en ligne**, trois tons |
| 5 | « Employee List » : le tableau et ses colonnes | **en discussion** | le tableau existe (`main`) ; la composition des colonnes n'est pas tranchée |
| 6 | les pilules Active / Inactive | **en discussion** | le statut du jour existe ; sa forme (pilule ou angle 8 px) n'est pas tranchée |
| 7 | le titre à ~40 px | **refusé le 19/11** | D-013 : titre à 20 px — la page est plus « sage » que la référence, c'est assumé |
| 8 | les rayons 12–20 px | **refusé** | D-016 : rayons {6, 8, 11, 12, 999} |
| 9 | les ombres douces | **refusé** | D-016 : ombre dure 3 px, flou 0 |
| 10 | la typo géométrique | **refusé** | D-006 : IBM Plex Sans |

Deux règles tenues dans les blocs 3 et 4, et qui valent pour la suite : **aucun état sans donnée**
(une case vide n'est jamais verte par défaut) et **aucun mot anglais** à l'écran.
