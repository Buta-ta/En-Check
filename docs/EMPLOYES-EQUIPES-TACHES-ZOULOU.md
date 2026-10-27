# Employés · Équipes · Tâches — une seule page, le registre perlé

## Ce qui change

Trois écrans parlaient des mêmes personnes : l'annuaire, la gestion des
équipes et la gestion des tâches. Ils vivent maintenant **dans une seule
coque**, la page Employés, avec trois vues :

| Vue | Adresse | Ce qu'on y fait |
| --- | --- | --- |
| Annuaire | `/employes` | fiche, contrat, horaires, accès portail, badge |
| Équipes | `/employes?vue=equipes` | composer les équipes, désigner un chef, lire la santé |
| Tâches | `/employes?vue=taches` | créer, assigner, suivre, valider, déplacer |

Conséquences volontaires :

- **le menu ne propose plus** « Équipes & tâches » ni « Équipes » comme
  entrées séparées. Il reste « Équipe » (section *Aujourd'hui*), qui ouvre
  l'annuaire — la page porte les trois vues ;
- `src/pages/Teams.jsx` et `src/pages/Tasks.jsx` **n'existent plus**. Les
  fenêtres de travail (créer une équipe, composer ses membres, créer une
  tâche, une catégorie) sont partagées dans
  `src/components/equipes/EquipesModales.jsx` et
  `src/components/taches/TachesModales.jsx` ;
- les anciennes adresses restent valables : `/equipes` et `/taches`
  renvoient vers la bonne vue (`Navigate … replace`). Un favori ou un lien
  envoyé hier ne casse pas ;
- la commande rapide du tableau de bord s'appelle « Gérer les équipes et
  les tâches » et pointe sur `/employes?vue=equipes` ;
- `VerrouOptions` ne surveille plus `/equipes` ni `/taches`. L'option
  reste verrouillable par son nom, et les deux vues ne s'affichent que si
  `module_taches` est allumé (super administrateur excepté). Sinon
  l'onglet n'est pas proposé — on ne montre pas une porte qui ne mène
  nulle part — et l'adresse directe affiche une phrase qui dit quoi
  demander et à qui.

## Direction artistique : le registre perlé

Les planches de référence sont dans le dépôt :

- `docs/design/refonte-equipes.png` (1440 × 1010) ;
- `docs/design/refonte-taches.png` (1440 × 780).

**L'idée tient en une phrase** : un registre de maison, tenu à la main,
dont la tranche est perlée. Ce n'est pas une planche de cartes et pas un
tableau de bord : une page de papier ivoire, des filets, du blanc, des
chiffres en serif et des perles là où il faut compter quelque chose.

Trois décisions, tenues sur les deux écrans :

1. **aucune carte.** Rien ne flotte dans une boîte blanche à coin arrondi
   et à ombre. Ce qui sépare deux entrées, c'est un filet horizontal ;
   ce qui sépare deux colonnes, c'est un filet vertical et une tranche
   perlée. Le fond de la page reste le papier.
2. **une seule barre d'outils, à la même place.** Folio, filet, eyebrow,
   titre serif avec son point de cuivre, colophon de quatre chiffres,
   filet plein ; puis la barre — recherche au trait, filtres à perle,
   sélecteur au trait, actions en mots soulignés, et **un seul** aplat de
   cuivre pour l'action qui crée.
3. **les perles ne décorent pas : elles comptent.** Une perle par personne
   sur le collier de l'entreprise, une perle par tranche de vingt points
   de santé, une perle par jour restant avant une échéance, une tranche
   perlée par colonne de tâches. Aucune perle sans nombre derrière.

### Le feuillet (les deux vues)

| Élément | Règle |
| --- | --- |
| folio | `En-Check · Gestion du personnel` à gauche, le nom du registre à droite, un filet dessous |
| eyebrow | un mot de cuivre en capitales espacées, précédé de trois points de perle |
| titre | serif (Georgia), très grand, chasse serrée, un point de cuivre en guise de point final |
| colophon | quatre chiffres séparés par un filet vertical : valeur serif, libellé en petites capitales, note chiffrée réelle (`100 % des équipes`, `dont 4 jamais ouvertes`, `—` quand il n'y a rien à compter) |
| barre d'outils | recherche soulignée d'un trait, filtres « perle creuse / perle pleine », sélecteurs sans cadre, actions en mots soulignés, un bouton de cuivre plein |
| pied | « À décider » : un pli qu'on ouvre, jamais une bannière qui hurle |

### Annuaire — ce que dessine la vue

L'annuaire est le troisième onglet du même registre ; il n'a plus ni
cartes de chiffres, ni courbes, ni portraits :

- **le même feuillet** que les deux autres vues : folio, eyebrow, titre
  serif `Annuaire.`, et un colophon de quatre chiffres réels — effectif,
  personnes en poste (ou `—` quand le pointage n'est pas suivi), accès
  portail ouverts, et personnes encore sur l'ancien portail (en corail) ;
- **une seule barre d'outils** : recherche au trait, compteur
  « n sur N affichés », `Rafraîchir` en mot souligné, et un seul aplat de
  cuivre, `Ajouter un employé` ;
- **les filtres en perles** : tout le monde, en poste, portail ouvert,
  à migrer, CDI, CDD, autres contrats, sans horaire, sans pointeuse.
  Chaque perle répond à une question qu'on se pose devant la liste ;
- **une entrée par personne**, numérotée : portrait en pastille (photo ou
  initiales), nom en serif, matricule et contrat en petites capitales,
  poste · département · classification · ancienneté, puis une ligne d'état
  — présence (perle de couleur et heure), régime horaire, accès portail,
  fiche de paie envoyée — et les heures de la semaine sur un filet qui se
  remplit ;
- **les actions en mots** : `Fiche`, `Badge`, puis un menu `⋯` pour les
  horaires, l'envoi des horaires, les pointages, le mot de passe, l'ouverture
  ou la fermeture du portail et la suppression ;
- l'ancien portail est signalé **sur la ligne**, pas seulement dans le menu
  (« portail à migrer »), et une note en haut de liste dit combien de
  personnes sont concernées.

Ce qui a été retiré, et pourquoi : les quatre cartes de chiffres à courbes,
la vitrine analytique et les portraits en grand format. Ils parlaient une
autre langue (cartes sombres, ombres, dégradés) que le registre, et
faisaient doublon avec le colophon. Aucune fonction ne disparaît pour
autant : chaque filtre des cartes se retrouve dans la rangée de perles.

### Les raccourcis de pages — en haut à droite

La bande de raccourcis (`RaccourcisPages`) ne vit plus au bas de la page :
elle est **dans la barre du haut, à droite des trois onglets**. Ce sont des
mots discrets, avec leur icône, un filet au survol et rien d'autre — la page
courante n'y figure pas puisqu'elle est exclue.

### Équipes — ce que dessine la vue

- **le collier de l'entreprise** : tout l'effectif en une parure. Un groupe
  par équipe, séparés par un filet vertical ; chaque personne est une perle
  portant ses initiales, le fil prend le ton de l'équipe, la perle du chef
  est cerclée de noir, et les personnes sans équipe sont des perles creuses
  posées sur un fil corail, à part, avec la mention « à rattacher » ;
- **le registre** : une entrée par équipe, numérotée (`01`, `02`…), avec le
  nom en serif, la description, un **filet de la couleur de l'équipe** sous
  la description, les membres en initiales (le chef cerclé), la santé en
  cinq perles et son pourcentage (`Non suivie` quand aucune mesure
  n'existe), puis trois actions en mots : `Membres`, `Modifier`, `⋯` ;
- le menu `⋯` ouvre `Modifier l'équipe`, `Changer de chef`, `Supprimer` ;
- recherche, filtres (toutes, avec chef, sans chef, vides, à surveiller) et
  tri par nom, effectif ou santé.

### Tâches — ce que dessine la vue

- **les catégories** : une perle à la couleur de la catégorie, son nom, son
  effectif, et « + Nouvelle catégorie » à droite du filet ;
- **quatre colonnes de registre** : *À faire*, *En cours*, *Terminées*,
  *Validées*. Chacune a sa **tranche perlée** à gauche, qui suit la hauteur
  réelle des entrées, un titre serif, son compte et une ligne de
  description ;
- **une entrée de tâche** n'est pas une carte : une perle de priorité, un
  numéro italique, le titre en serif, puis la priorité et la catégorie en
  petit, l'**échéance dessinée en collier** avec sa phrase (`6 j restants`,
  `retard de 3 j`), la personne en pastille et en nom, et deux actions en
  mots (`Modifier`, la corbeille) ;
- une colonne vide dit « Rien ici » et garde une **rosace creuse** ; chaque
  colonne se termine par « + ajouter une tâche » ;
- **la vue Liste** donne la même matière à plat : une ligne par tâche, avec
  son état, son équipe, sa catégorie, sa personne et son échéance ;
- sélection multiple (la case est une perle qu'on remplit) et suppression
  groupée avec confirmation ;
- les tâches refusées ou annulées ne figurent pas au tableau : une phrase
  le dit et renvoie à la liste.

### Les dessins

`src/components/zoulou/PerlesZoulouSvg.jsx` ne contient plus que ce qui
sert, et rien de plus :

| Dessin | Rôle |
| --- | --- |
| `CollierEcheanceSvg` | une perle par jour restant (onze au plus, puis trois points) ; corail et dernière perle cerclée en retard |
| `RosacePerlesSvg` | quatorze perles creuses en couronne : l'état vide, dessiné |

Tout est en SVG, sans image, sans police d'icônes, sans dégradé posé en
`background` d'une photo.

### Palette du registre

Tout passe par des variables `--rg-*` posées sur `.emp-vues`, avec deux
jeux complets : le papier sous `.emp-vues`, la nuit sous
`[data-theme='dark'] .emp-vues`. Les fenêtres de travail gardent leurs
variables `--zl-*`, **reliées à la palette du registre** pour ne pas jurer
avec lui.

| Rôle | Clair | Nuit |
| --- | --- | --- |
| papier | `#F5F0E6` | `#17110B` |
| encre | `#1C140D` | `#F4ECDF` |
| texte doux | `#42342A` | `#DCCDBA` |
| texte faible | `#6B5C44` | `#A6957C` |
| cuivre d'action | `#8F4D1D` | `#D99A58` |
| cuivre plein | `#74400F` | `#C8873F` |
| bleu-vert | `#2B6A5F` | `#74BCAE` |
| sauge | `#56652A` | `#ADC081` |
| corail | `#A2452E` | `#E8927C` |
| perles (verre) | crème `#E0C9A0`, cuivre `#B8823F`, bleu-vert `#4F9389`, sauge `#8BA268`, corail `#C8785C` | `#EFE0C2`, `#C99154`, `#6FB9AD`, `#A2BB7C`, `#D48163` |

### Contrastes calculés

| Texte → fond | Ratio | Verdict |
| --- | --- | --- |
| encre `#1C140D` sur papier `#F5F0E6` | 16,0:1 | ok |
| doux `#42342A` sur papier `#F5F0E6` | 10,5:1 | ok |
| faible `#6B5C44` sur papier `#F5F0E6` | 5,7:1 | ok |
| cuivre `#8F4D1D` sur papier `#F5F0E6` | 5,7:1 | ok |
| sur-cuivre `#FFFFFF` sur cuivre plein `#74400F` | 8,5:1 | ok |
| encre nuit `#F4ECDF` sur papier nuit `#17110B` | 16,0:1 | ok |
| initiales `#241A12` sur chaque perle | 5,8:1 à 13,1:1 | ok |

Le test lit les valeurs dans la feuille et recalcule ces ratios.

### Survol

Un survol change **le trait** et **l'ombre**, rien d'autre :

- jamais de `background` ni de `background-color` sur un élément qui porte
  du texte ;
- jamais de `color` (le libellé reste lisible) ;
- jamais d'`opacity` sur un champ ou un bouton.

Le test lit chaque règle `:hover` de la feuille et refuse ces trois
propriétés.

### Le mouvement

Les entrées, les tâches et les groupes du collier **se posent** une fois
(`@keyframes rg-pose`, 0,34 s), avec un décalage de 30 ms par entrée.
Tout est coupé sous `prefers-reduced-motion: reduce`.

## Le ton

On reste un service professionnel. Aucun mot d'atelier ne doit apparaître
dans un texte lu : ni « pagne », ni « bande », ni « teinture », ni
« atelier », ni « métier à perles ». Les noms de classes CSS peuvent
porter le motif ; **les phrases, non**. Le vocabulaire est celui de la
gestion : équipe, chef d'équipe, effectif, échéance, priorité, catégorie,
valider.

Les messages disent ce qui se passe et ce qu'on peut faire :

- « Aucune équipe pour l'instant » + le bouton pour créer la première ;
- « Aucune tâche ne correspond » + le conseil d'élargir la recherche ;
- « Option Équipes non activée » + qui peut l'allumer ;
- « Les analyses d'équipe ne sont pas activées » quand Prédictions est
  éteint — on nomme le manque, on ne masque pas.

## Tests

`src/services/__tests__/employesEquipesTaches.test.jsx` — 64 tests.

Ce qu'ils défendent :

1. **menu et adresses** : plus d'entrée `/equipes` ni `/taches`, les deux
   adresses renvoient vers la bonne vue, les deux anciens fichiers de page
   n'existent plus, `VerrouOptions` ne surveille plus une adresse morte ;
2. **onglets** : trois vues, annuaire par défaut, l'adresse porte la vue
   (`?vue=`), les raccourcis de pages restent dans la coque ;
3. **vue Annuaire** : même feuillet que les autres vues, colophon qui
   n'avance que du réel (`—` quand le pointage n'est pas suivi), entrée
   numérotée avec portrait en pastille, présence chiffrée, absence de
   numéro de pointeuse dite en clair, fiche et badge au clic, autres gestes
   rangés dans le menu, portail à migrer signalé sur la ligne, aucun
   ancien portrait ni carte de chiffres ;
4. **vue Équipes** : folio, titre, colophon de quatre chiffres, parts
   réelles ou tiret, collier avec perle du chef cerclée et perles creuses
   pour les personnes à rattacher, santé en cinq perles, entrées
   numérotées, équipe vide sans avatar fantôme, filtres et recherche,
   décisions repliées, absence de prédictions dite en clair ;
5. **vue Tâches** : titre et colophon, quatre colonnes nommées et leur
   compte, numéro et perle de priorité, priorité / catégorie / échéance en
   français, glisser-déposer qui appelle vraiment `updateTask`, sélection
   et vidage, bascule en liste, catégories filtrantes, états vides ;
6. **ton et dessin** : feuillet sans carte, entrées au filet, tranche
   perlée des colonnes, collier d'échéance, aucune tâche refusée cachée,
   aucun mot d'atelier, règles `:hover` sans fond / couleur / opacité,
   cibles de doigt (44 px pour les onglets, 42 px pour l'action
   principale, 40 px pour les liens), contrastes calculés dans les deux
   thèmes, initiales lisibles sur toutes les perles, absence de
   l'ancienne scène ;
7. **page entière** : les trois onglets s'affichent, on passe d'une vue à
   l'autre sans quitter la page, les chiffres sont séparés par un filet, et
   les raccourcis sont **dans la barre du haut** — un seul bandeau, avant le
   registre, jamais en bas.

Chaque test neuf a été vérifié par mutation : rétablir l'ancien
comportement doit le faire échouer.

## Limites connues

- les vues chargent leurs données à l'ouverture, indépendamment de
  l'annuaire : le premier affichage d'une vue coûte une lecture ;
- `getTeams` reste la seule source des équipes ; aucune table n'a changé,
  aucune migration n'est nécessaire pour cette refonte ;
- la tranche perlée suit la hauteur réelle des entrées : une colonne très
  courte montre une tranche courte — c'est voulu, pour ne pas tirer un fil
  vide sur toute la hauteur de la grille.
