# En-Check — Le kit d'interface

## D-011 : six composants, et rien d'autre

**Version 1.2 — 18 novembre 2026**
Volume 2, chapitre 2. Planches **`22-kit.png`** (structure), **`23-quatre-peaux.png`** (quatre directions), **`24-brut-adouci.png`** (la peau retenue, trois formes par objet).

> **⚠ Ce qui a changé depuis la v1.0.** La peau est choisie : **D — brut adouci** (D-016). Les valeurs de forme de la v1.0 (bordure 1 px, rayon 8, pas d'ombre) sont **remplacées** par celles de la section « La peau retenue ». Les valeurs de **structure** — six objets, états, contrastes, emplois — restent vraies.

---

## À quoi sert ce document

Une décision qui n'a pas d'objet n'est pas applicable. Jusqu'ici, D-013 dit « une action principale par écran » et « une échelle d'espace » — mais un développeur, ou une IA, doit encore **inventer** le bouton. C'est là que les 53 tailles de texte sont apparues.

Le kit supprime l'invention. Six objets, montrés dans tous leurs états, avec leurs mesures et leurs contrastes. **Ce qui n'est pas dans cette planche n'existe pas dans l'interface.** Un septième objet doit passer par une décision, pas par un fichier CSS.

---

## La peau retenue : D — brut adouci (D-016)

Choisie le 18 novembre 2026 : « j'adore, présenté comme ça ».

| Paramètre | Valeur | Effet |
|---|---|---|
| Contour | **2 px `#2A1708`** sur tout objet actif | l'objet affirme son bord, plus de flou |
| Ombre | **dure, décalée de 3 px, sans flou** | l'objet se décolle du sable comme une carte posée |
| Rayons | **6** (bouton, champ, carte) · **8** (message, tuile) · **11** (badge) | des angles francs, jamais cliniques |
| Texte des boutons | **capitales, 700 / 9,5 px, espacées de 1,3** | l'action se lit comme une étiquette, pas une phrase |
| Remplissage | terracotta `#A26537`, ou espresso `#2A1708` pour l'engagement | deux densités, pas plus |

**Contrastes vérifiés :** blanc cassé sur terracotta **4,64** · sable sur espresso **11,37** · blanc cassé sur vert `#3F6B4C` **6,04** · espresso sur surface2 **12,71**.

**Ce que la peau interdit :** les ombres floues (elles ramollissent tout, y compris ce qui doit alerter), les rayons supérieurs à 12, les gris de service en texte (3,53 — sous le seuil).

---

## Les fondations, d'abord

| Ce dont on dispose | Valeur | État |
|---|---|---|
| Espacement | **4 · 8 · 12 · 16 · 24 · 32 · 48** | D-013 |
| Texte | **20 / 700** (titre) · **14 / 400** (corps) · **11 / 400** (légende) | D-013 |
| Rayons | **6** (champ) · **8** (bouton, carte, message) · **12** (tuile bento) · **999** (badge) | D-011 |
| Couleurs | palette B, `#A26537` remplit, `#7E4A26` écrit | D-001 |
| Police | IBM Plex Sans, chiffres tabulaires | D-006 |
| Mouvement | 200 ms, `ease-out`, jamais au chargement | D-013 |

---

## 01 — Bouton

**Sept états.** C'est beaucoup pour un bouton, et c'est le minimum : c'est l'objet qu'on clique le plus souvent, donc celui qui casse le plus vite.

| État | Fond | Texte | Contraste |
|---|---|---|---|
| 1 · repos | `#A26537` | `#FFFDF7` | **4,64** |
| 2 · survol | `#8C5A2A` | `#FFFDF7` | **5,72** |
| 3 · actif | `#7E4A26` | `#FFFDF7` | **7,13** |
| 4 · désactivé | `#EADCC7` | `#6B4A32` | **5,87** |
| 5 · secondaire | transparent, bordure `#A26537` | `#7E4A26` | 6,64 |
| 6 · danger | `#9B2C2C` | `#FFFDF7` | **7,40** |
| 7 · lien | aucun cadre | `#7E4A26` | 6,64 |

Mesures : hauteur **36**, rayon **8**, texte **600 / 12 px**, écart intérieur **16**, focus **2 px `#A26537` décalé de 2 px**.

**Trois règles :**

1. **Une seule variante pleine par écran.** Deux boutons `#A26537` côte à côte = aucune action principale. C'est exactement ce qui se passe aujourd'hui sur la paie.
2. **Le rouge est réservé à l'irréversible** — et seulement après confirmation. « Annuler » en rouge, c'est du bruit ; « Supprimer définitivement » en rouge, c'est de l'information.
3. **Le désactivé n'est jamais une opacité réduite.** Un texte à 40 % d'opacité tombe sous 3:1 : illisible, et pourtant on demande parfois de le lire pour comprendre pourquoi c'est bloqué.

---

## 02 — Champ de formulaire

Hauteur **40**, rayon **6**, bordure **1 px `#D8C6AC`**, texte **12 px**, étiquette **11 px `#6B4A32`** au-dessus, aide **10 px** en dessous.

| État | Signe distinctif |
|---|---|
| repos | bordure 1 px |
| focus | bordure **2 px** — visible même sans couleur, donc au soleil et sur un écran de chantier |
| erreur | bordure 2 px `#9B2C2C` **+ un mot** sous le champ : « Doit être supérieur à 0 » |
| désactivé | fond `#F3E9DA`, texte `#6B4A32` — lisible, mais qui ne ressemble pas à un champ actif |

**Règle :** l'erreur ne se signale jamais par la couleur seule. Un daltonien doit pouvoir corriger sa saisie.

---

## 03 — Badge de statut

Hauteur **20**, rayon **999**, texte **600 / 10 px**, pastille **6 px**. Quatre statuts :

| Statut | Couleur | Contraste |
|---|---|---|
| Présent / Validée | `#3F6B4C` | **5,62** |
| Retard / En attente | `#8A5A14` | **5,41** |
| Absent / À justifier | `#9B2C2C` | **6,89** |
| Neutre | `#6B4A32` | **5,87** |

**Le mot est la donnée, la couleur n'est que le rappel.** Un badge s'élargit avec son texte, il n'est jamais tronqué ni abrégé : « En attente de validation » tient, sinon la colonne est trop étroite.

Interdit : une pastille verte sans texte, une ligne de tableau colorée pour dire « en retard ».

---

## 04 — Message d'alerte

Fond teinté, **barre de 3 px** à gauche, texte **12 px**, rayon **8**.

| Type | Exemple | Couleur de barre |
|---|---|---|
| succès | « La paie de novembre est validée. 38 bulletins sont prêts. » | `#3F6B4C` |
| alerte | « 2 justificatifs manquent pour Boubacar. Il reste 3 jours. » | `#8A5A14` |
| erreur | « Impossible de valider : un montant est négatif (ligne 12). » | `#9B2C2C` |

**Règle :** le message dit **quoi faire** et **où**, jamais seulement que ça ne va pas. « Une erreur est survenue » est interdit : ça ne se répare pas.

Jamais plus de deux messages à l'écran en même temps.

---

## 05 — Carte et tuile bento (D-014)

Deux objets, deux usages, et la différence se voit au premier regard :

| | Carte | Tuile |
|---|---|---|
| Rayon | **8** | **12** |
| Écart intérieur | **16** | **24** |
| Contenu | un document, une fiche, un texte | **un chiffre et un libellé** |
| Où | partout | accueil et tableaux de bord, **6 maximum** |

Une tuile qui contient une phrase n'est plus une tuile : c'est une carte mal réglée.

---

## 06 — Tableau

En-tête **10 px / 600** en capitales `#6B4A32`, ligne de **34 px**, filet **1 px `#EADCC7`**.

- **Chiffres alignés à droite**, en chiffres de largeur fixe (D-006) : la colonne se lit sans effort.
- **Une seule action par ligne** — un lien, pas quatre boutons.
- **Pas de zébrures.** Sur fond sable, les zébrures font plus de bruit que de repère ; le filet suffit.
- Jamais de rouge dans une cellule pour dire « en retard » : un badge, avec son mot.

---

## Ce que la page de paie a appris (planche 25)

Une fois la peau appliquée à une vraie page, un défaut de raisonnement apparaît — autant l'écrire ici que le laisser se découvrir en production.

**D-013 dit « l'action principale atteinte sans défilement ».** Vrai jusqu'à 24 lignes. À 40 employés, le tableau fait 1 360 px, soit 1,7 écran : la règle ne tient plus. La réponse n'est pas de rogner les marges, c'est de **paginer à 25 lignes**. Les garde-fous de D-013 valent pour un écran, pas pour une liste infinie.

**Conséquence pour le tableau :** la forme « Grille » (D-017) reste juste en paie, mais elle porte désormais une barre de pagination — 25 par page, tri visible, compteur « 40 employés ». Un tableau de paie sans pagination n'est pas un tableau, c'est un défilement.

**Ce qui a été vérifié sur la page, forme par forme :** bouton pleine (valider), bouton contour (télécharger, paginer), champ souligné (rechercher), message fiche (l'alerte datée), tableau grille, tuile chiffre, tuile + repère, tampon (payé, figé), pilule (en cours, mouvant) — **9 des 18 formes**, aucune inventée.

---

## Ce que le kit remplace

| Avant (relevé du 18 nov. 2026) | Après (cible mesurable) |
|---|---|
| 53 tailles de texte | **3** |
| 41 marges intérieures | **7** |
| 27 rayons | **4** |
| 49 fichiers CSS autonomes | **6 composants** réutilisés |

La cible est vérifiable par la même commande que celle de la planche 21. Tant qu'elle ne renvoie pas ces chiffres, le kit n'est pas appliqué.

---

## Comment on l'applique, sans tout casser

1. **Le kit s'écrit une fois** — six composants, dans un seul fichier de styles, avec les couleurs en variables.
2. **Une page à la fois.** On commence par la paie : c'est l'écran qui coûte le plus cher quand il est illisible.
3. **Aucune page ne mélange deux versions.** Une page migrée l'est entièrement, sinon on ne sait plus quel bouton est le bon.
4. **On remesure après chaque page** et on note le chiffre. C'est la seule preuve acceptable.

---

### Journal

| Date | Événement |
|---|---|
| 18 novembre 2026 | Planche 22 : les six composants, sept états de bouton, contrastes mesurés. |
| 18 novembre 2026 | D-011 rédigée en **proposée**. En attente de décision. |
| 18 novembre 2026 | Verdict du fondateur : « trop classique et simple ». Planche 23 : quatre peaux. |
| 18 novembre 2026 | **D-016 validée** — peau D, brut adouci. Planche 24 : trois formes par objet. |
| 18 novembre 2026 | **D-017 entérinée** — les dix-huit formes deviennent opposables (5 contrôles CI ajoutés). |

---

## Annexe — les dix-huit formes (D-017, proposée)

| Objet | Forme 1 | Forme 2 | Forme 3 |
|---|---|---|---|
| Bouton | Pleine — action principale | Contour — action secondaire | Inverse — ce qui engage |
| Champ | Cadre — formulaire | Souligné — saisie en ligne | Étiquette fixe — grille de réglages |
| Badge | Pilule — statut courant | Tampon — statut figé | Onglet — statut provisoire |
| Message | Carte — erreur bloquante | Bandeau — succès fugace | Fiche — alerte datée |
| Tableau | Grille — contrôle et paie | Filets — listes longues | Tampon — suivi de statuts |
| Tuile | Chiffre — accueil | Chiffre + repère — période, unité | Bandeau — tuile de section |

**La règle :** chaque forme a un emploi, et un seul. Un badge « tampon » pour un statut qui peut encore changer est une faute, pas un choix.

> **D-017 est entérinée** — 18 novembre 2026 : « garde ces 3 formes. Je les valides et il faut absolument entériner ça ». Les dix-huit formes sont **opposables** : aucun composant nouveau ne s'ajoute sans une décision numérotée. Voir `DECISIONS-ENTERINEES.md`.
