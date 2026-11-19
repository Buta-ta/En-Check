# En-Check — Le goût des tendances

## Bento, Apple, Awwwards 3D : ce que j'en prends, ce que j'en laisse

**Version 1.1 — 18 novembre 2026**
Document de travail, volume 2, chapitre 1. Il accompagne la planche **20-tendances.png**.

---

## Pourquoi ce document existe

Tu as dit : « j'aime ces façons de construire le produit, le rendu visuel que ça donne ». C'est une bonne intuition, et elle n'est pas en contradiction avec l'identité qu'on vient de fixer.

Mais il faut être précis sur un point, sinon on se trompe de débat : **ces trois choses ne sont pas de la même nature.**

- **Bento** est une **grille** — une façon de poser des blocs sur un écran.
- **Apple** est une **discipline** — une façon de décider ce qu'on enlève.
- **Awwwards 3D** est un **spectacle** — une façon de produire une émotion, à l'entrée.

Une grille, une discipline et un spectacle peuvent cohabiter. Ils ne s'appliquent simplement pas au même endroit. C'est tout l'objet de ce document.

Rappel des trois couches, posées dans le volume 1 :

| Couche | Ce qu'elle contient | Durée de vie |
|---|---|---|
| 1 — Identité | palette, motifs, typographie, logotype | des années |
| 2 — Système d'interface | boutons, tableaux, formulaires, états vides, messages | 2 à 3 ans |
| 3 — Tendances | Bento, effets de verre, 3D | 2 à 5 ans, puis remplacées |

Les tendances vivent dans la couche 3. Elles ont le droit d'exister. Elles n'ont pas le droit de contaminer les deux premières.

---

## Le vocabulaire, une fois pour toutes

**Bento UI** — de l'anglais *bento box*, la boîte-repas japonaise à compartiments. Une page faite de blocs rectangulaires de tailles différentes, collés les uns aux autres, chacun contenant une seule information. Popularisé par Apple (iOS 14, les widgets), puis repris partout en 2023-2025.

**Apple design / HIG** — *Human Interface Guidelines* : le guide officiel d'Apple. Ce n'est pas un style graphique, c'est un ensemble de règles d'usage : beaucoup d'espace vide, une action principale par écran, une hiérarchie de texte très marquée, des animations courtes qui expliquent ce qui se passe.

**Awwwards** — site qui récompense les sites les plus spectaculaires du web. Par extension, « un site awwwards » désigne un site très travaillé visuellement, souvent avec de la 3D, du défilement animé et des transitions soignées.

**3D temps réel / WebGL** — afficher un objet en trois dimensions dans une page web, que l'on peut voir tourner. *WebGL* est la technologie du navigateur qui s'en charge. Coût : un fichier lourd à télécharger et un processeur graphique sollicité.

**Glassmorphism** — l'effet « verre dépoli » : un panneau semi-transparent, flou, posé sur un fond coloré. Très à la mode en 2021-2023. **Exclu chez nous** — voir plus bas.

**Micro-interaction** — une petite animation de 150 à 250 millisecondes qui confirme une action : un bouton qui s'enfonce, une ligne qui se coche, un message qui glisse. Ce n'est pas décoratif : ça rassure.

**Hiérarchie visuelle** — l'ordre dans lequel l'œil lit un écran. On la contrôle par trois leviers seulement : la taille, le contraste, l'espace autour.

**Espace blanc (whitespace)** — la surface laissée vide. Ce n'est pas de la place perdue : c'est ce qui permet à ce qui reste d'être vu.

---

# 1. Bento — la grille

## Ce que c'est

Sept blocs, six tailles différentes, aucun tableau. L'œil ne lit pas ligne par ligne : il balaie et classe. C'est l'écran de gauche de la planche 20.

## Ce que ça apporte réellement

- **La hiérarchie se fait toute seule.** Un grand bloc = important. Un petit bloc = secondaire. Aucun texte n'a besoin de dire « ceci est important ».
- **Ça donne une impression de maîtrise** — un poste de pilotage, pas une liste.
- **Ça tient sur un écran de téléphone** en empilant les blocs.

## Où ça casse

- **Au-delà de 7 blocs, ça devient un jeu de construction** : on ne sait plus par où commencer.
- **Ça ne remplace jamais un tableau.** Une liste de 42 pointages en blocs, c'est 42 blocs : illisible, et impossible à trier.
- **Ça consomme de la hauteur.** Sept blocs bento occupent ce que trois lignes de tableau occupent.

## La règle que je propose pour En-Check

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| Où | accueil et tableaux de bord **uniquement** | c'est là qu'on survole, pas là qu'on saisit |
| Nombre de tuiles | **6 maximum**, dont **une seule** grande | au-delà, le regard ne classe plus |
| Grille | 12 colonnes, gouttière 16 px | une grande tuile = 6 colonnes, une moyenne = 4, une petite = 3 |
| Rayon | 12 px | plus rond que les cartes de contenu (8), pour marquer « ceci est un bloc de synthèse » |
| Fond | `#FBF4E9` sur `#F3E9DA` | la nuance suffit, pas d'ombre lourde |
| Contenu d'une tuile | **un chiffre, un libellé, rien d'autre** | dès qu'on ajoute une phrase, ce n'est plus du bento |
| Interdit | dans un tableau, dans un formulaire, dans la paie | on y travaille ligne par ligne |

**La décision D-012 est déjà posée en ce sens.** Ce document la précise, il ne la change pas.

---

# 2. Apple — la discipline

## Ce que c'est

Ce n'est pas un look, c'est un **principes de soustraction**. L'écran du milieu de la planche 20 ne contient qu'un chiffre, une phrase, un bouton. Tout le reste a été enlevé.

## Les cinq gestes que je prends

1. **Une action principale par écran.** Sur la paie : « Valider ». Le reste est secondaire, visuellement plus discret. Aujourd'hui, l'écran de paie propose plusieurs actions de même poids — c'est le principal défaut de l'interface actuelle.
2. **Trois niveaux de texte, jamais plus.** Titre (20 px, 700), corps (14 px, 400), légende (11 px, 400, `#6B4A32`). Toute information doit rentrer dans l'un des trois.
3. **Un espace qui suit une échelle.** 4, 8, 12, 16, 24, 32, 48. Jamais 13, jamais 27. Aujourd'hui, le code utilise une quinzaine de valeurs différentes : c'est ce qui donne l'impression de « presque bien ».
4. **Le mouvement explique, il ne décore pas.** 200 ms, easing `ease-out`, et seulement pour : ouverture d'un panneau, confirmation d'un enregistrement, changement de thème. Pas d'animation au chargement des pages.
5. **Le bouton dit ce qu'il fait.** Déjà acquis (D-005 bis) : « Valider la paie », pas « OK ».

## Ce que je ne prends pas

- **La police SF Pro** : elle appartient à Apple, et D-006 a tranché pour IBM Plex.
- **Les ombres profondes et les coins très arrondis** (16 à 20 px) : ils adoucissent tout, y compris ce qui doit alerter. Nos rayons restent 6 (champs), 8 (cartes), 12 (tuiles bento).
- **Le flou de transparence** (le fameux « verre dépoli » d'iOS) : sur nos fonds sable, il fait baisser le contraste du texte sous 4,5:1 — donc il est **interdit** par le contrôle n° 2 du volume 1. Voir la note glassmorphism plus bas.

## Pourquoi c'est la partie la plus rentable des trois

Parce que son apport est **invisible**. Rien à télécharger, rien à admirer : seulement moins d'erreurs, plus vite. Dans un outil qu'une assistante RH ouvre huit heures par jour, c'est exactement ce qu'on veut.

---

# 3. Awwwards 3D — le spectacle

## Ce que c'est

Un objet en trois dimensions qui tourne, un halo, un fond sombre, une entrée en matière. C'est l'écran de droite de la planche 20. C'est beau, et c'est **cher**.

## Le coût, mesuré

| Ce que ça coûte | Ordre de grandeur | Conséquence |
|---|---|---|
| Poids de l'objet 3D | 800 Ko à 3 Mo | sur une connexion 3G béninoise (~500 kbit/s), 15 à 50 secondes |
| Batterie | le processeur graphique tourne en continu | un téléphone d'entrée de gamme chauffe |
| Accessibilité | un objet qui tourne ne se lit pas | contre-indiqué pour les personnes sensibles au mouvement |
| Vérifiabilité | aucune donnée | ce n'est pas un écran de travail |

## Où ça vit, et où ça ne vit pas

**Ça vit** sur **un seul écran** : celui qu'on montre à un prospect, ou la page d'accueil publique, ou le premier lancement de la borne de pointage. Là, l'objectif est de donner envie en trois secondes. La 3D y est légitime.

**Ça ne vit pas** dans l'administration, ni dans la paie, ni dans les tableaux. Personne n'a jamais clôturé une paie plus vite grâce à un halo.

## Les garde-fous, si un jour on le fait

1. **Un seul écran** dans tout le produit.
2. **Moins de 1,5 Mo** au total pour cet écran.
3. **Une image fixe de remplacement** affichée si le chargement dépasse 2 secondes, ou si l'appareil est ancien.
4. **Aucun mouvement automatique** : l'objet tourne seulement si on le touche.
5. **Rien d'essentiel dedans** : si la 3D ne charge pas, la page reste utilisable.

> **Note sur le glassmorphism.** Il est exclu pour une raison mesurable, pas par goût : un panneau semi-transparent sur notre fond sable fait tomber le contraste du texte autour de 3:1, sous le seuil de 4,5:1 fixé par le volume 1. Le supprimer est moins coûteux que de le rendre accessible.

---

# 4. Le test qui arbitre

> **Est-ce que ça aide quelqu'un de fatigué, à 18 h, à clôturer une paie sans se tromper ?**

Ce test donne le classement suivant, et il est sans appel :

| | Verdict | Pourquoi |
|---|---|---|
| **Apple** | gagne | apport invisible, coût nul, bénéfice quotidien |
| **Bento** | gagne, mais localisé | excellent sur l'accueil, nuisible ailleurs |
| **Awwwards 3D** | perd dans l'admin, gagne au-dehors | le but n'est pas le même : faire envie ≠ faire travailler |

## Les trois critères mesurables qui départagent

Pour que ce ne soit pas une opinion, voici ce qu'on peut **compter** sur n'importe quel écran :

1. **Nombre d'éléments qui réclament le regard.** Cible : 1 action principale + 3 secondaires maximum. Sur la planche : bento 7, Apple 4, 3D 1.
2. **Poids de l'écran.** Cible : moins de 300 Ko hors images. Une 3D seule dépasse ce budget.
3. **Temps d'accès à l'action principale.** Cible : moins de 2 secondes et zéro défilement, sur un écran de 1280 × 800.

Un écran qui respecte les trois peut porter n'importe quelle tendance. Un écran qui en rate un est refusé, quelle que soit sa beauté.

---

# 5. Trois propositions, qui attendent ta décision

| N° | Proposition | Ce que ça change concrètement | État |
|---|---|---|---|
| **D-013** | **Apple par défaut** | on installe l'échelle d'espace (4-48), les trois niveaux de texte, une action principale par écran, et les animations de 200 ms. S'applique à toute l'administration. | **validée** — 18 nov. 2026 |
| **D-014** | **Bento sur l'accueil** | l'accueil et les tableaux de bord adoptent la grille 12 colonnes, 6 tuiles maximum, rayon 12. Aucun tableau n'est touché. | **validée** — 18 nov. 2026 |
| **D-015** | **3D sur le site public** | un seul écran spectaculaire, hors administration, avec les cinq garde-fous ci-dessus. À faire plus tard, quand le produit est stable. | **validée** — 18 nov. 2026 |

Les trois ont été validées ensemble : « je valide ta proposition ». La planche `21-apple-defaut.png` donne la preuve chiffrée de ce que D-013 change dans le code.

---

# 6. Ce que ça change pour le kit (volume 2, D-011)

Le kit d'interface devra livrer six composants, et les tendances en modifient deux :

| Composant | Impact des tendances |
|---|---|
| Bouton | inchangé (quatre états déjà mesurés) |
| Champ de formulaire | inchangé |
| Badge de statut | inchangé |
| Message d'alerte | inchangé |
| **Carte** | deux variantes : `carte` (rayon 8, contenu) et `tuile` (rayon 12, synthèse bento) |
| **Tableau** | reçoit la règle « une seule action principale par ligne visible », issue d'Apple |

C'est tout. Les tendances, bien utilisées, coûtent deux variantes de composant — pas une refonte.

---

## En une phrase

**On prend d'Apple la discipline, de Bento la grille de l'accueil, d'Awwwards l'audace d'un seul écran public — et on refuse le verre dépoli, parce qu'il fait passer le texte sous 4,5:1.**

---

### Journal

| Date | Événement |
|---|---|
| 18 novembre 2026 | Planche 20 produite (trois traitements du même accueil, comparaison mesurée). |
| 18 novembre 2026 | D-013, D-014, D-015 rédigées en **proposée**. |
| 18 novembre 2026 | **D-013, D-014 et D-015 validées** — décision du fondateur. |
| 18 novembre 2026 | Planche 21 : relevé du dépôt avant application (53 tailles de texte, 41 marges, 27 rayons ; 88 % hors échelle). |

---

## Annexe — la preuve chiffrée de D-013

Relevé sur les **49 fichiers CSS** de `src/`, le 18 novembre 2026 :

| Mesure | Valeurs distinctes | Étendue | Déclarations |
|---|---|---|---|
| `font-size` | **53** | 6,5 px → 36 px | 1 795 |
| `padding` | **41** | 1 px → 84 px | 1 299 |
| `border-radius` | **27** | 1 px → 999 px | 1 039 |

**121 valeurs distinctes au total ; 106 sont hors de l'échelle 4 · 8 · 12 · 16 · 24 · 32 · 48, soit 88 %.**

C'est la définition mesurable de l'impression de « presque bien » : rien n'est faux, mais rien ne s'aligne. Après application de D-013, la même commande devra renvoyer **7 marges, 3 tailles de texte et 3 rayons**. Tant que ce n'est pas le cas, la décision n'est pas appliquée.

```bash
grep -rho "padding[^:]*: *[0-9.]*px" src/**/*.css | sed "s/.*: *//" | sort -u | wc -l
```
