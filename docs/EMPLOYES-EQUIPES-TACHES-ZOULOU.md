# Employés · Équipes · Tâches — une seule page, motif perles zoulou

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
- la commande rapide du tableau de bord s'appelle désormais « Gérer les
  équipes et les tâches » et pointe sur `/employes?vue=equipes` ;
- `VerrouOptions` ne surveille plus `/equipes` ni `/taches` : ces adresses
  n'existent plus. L'option reste verrouillable par son nom, et les deux
  vues ne s'affichent que si `module_taches` est allumé (super
  administrateur excepté). Sinon l'onglet n'est pas proposé — on ne montre
  pas une porte qui ne mène nulle part — et l'adresse directe affiche une
  phrase qui dit quoi demander et à qui.

## Direction artistique : les perles zoulou

Référence visuelle : `docs/design/zoulou-perles-bande-planche.jpg` (bande
perlée, fond espresso, losanges crème / cuivre / bleu-vert / sauge et un
accent corail). Le dessin existant du motif zoulou de l'annuaire
(`public/images/employes-zoulou.webp`, `PageCulturalBand`) ne change pas :
les deux nouvelles vues en reprennent le vocabulaire, sans le répéter tel
quel.

**Tout est dessiné en SVG**, dans `src/components/zoulou/PerlesZoulouSvg.jsx` :
aucune image, aucune police d'icônes, aucun dégradé posé en `background`
d'une photo. Six signes, chacun avec un sens :

| Signe | Composant | Ce qu'il dit |
| --- | --- | --- |
| la **frise** | `FrisePerlesSvg` | la couture perlée qui coiffe la vue : une trame tissée très pâle, une couture en dents et un rang de grosses perles qui ondule. Chevrons pour les Équipes, zigzag pour les Tâches |
| l'**anneau** | `AnneauPerlesSvg` | une proportion en perles pleines sur un cercle fermé — jamais un camembert, jamais une barre |
| le **losange** | `LosangePerlesSvg` | quatre perles et un cœur : la puce qui marque un repère |
| la **rosace** | `RosacePerlesSvg` | deux anneaux de perles : le filigrane d'une carte, l'état vide |
| le **collier** | `CollierEcheanceSvg` | une perle par jour qui reste avant l'échéance ; en retard, le collier est corail et la dernière perle se cerne |

### La scène

Chaque vue s'ouvre sur **une scène en drap espresso** (`.zl-scene`) : la
frise en haut, puis un titre en serif, une ligne de chiffres et les
actions. Les **modules de chiffres ne flottent pas sur la page** : ils
sont posés sur le drap, dans le prolongement de la frise, séparés du titre
par un filet clair. C'est le contraste entre le drap sombre et la page
ivoire qui donne son relief à l'écran — et c'est le même drap dans les
deux thèmes, comme la bande de référence.

Trois règles d'écriture, tirées de la première revue :

- **rien d'ornemental qui ne dise rien** : la barre de vues ne se termine
  plus par une file de petits points sans fonction. C'est un sommaire —
  un mot, trois entrées, un filet, et un trait de cuivre sous la vue
  ouverte. Une seule marque par entrée : l'icône, pas une perle en plus ;
- **les chiffres se lisent** : dans la scène, le nombre s'écrit en serif,
  le mot en petit, et une perle sépare deux groupes — plus de chapelet de
  points de ponctuation (`·`). Chaque module du bandeau donne une part
  (« 100 % du total »), et un tiret quand il n'y a rien à compter ;
- **les actions sont hiérarchisées** : les utilitaires (rafraîchir,
  raccourcis) restent petits, à gauche d'un filet ; les deux actions qui
  créent quelque chose sont à droite, dont une seule pleine.

| Rôle de la scène | Couleur | Contraste sur `#241A12` |
| --- | --- | --- |
| drap | `#241A12` (dégradé `#2C1F15` → `#1A120C`) | — |
| encre | `#F7ECDB` | 14,6:1 |
| texte secondaire | `#CFB697` | 8,8:1 |
| cuivre (eyebrow, libellés) | `#E2A566` | 8,0:1 |
| alerte | `#F0A68C` | 8,6:1 |
| réussite | `#A8D3B0` | 10,2:1 |

Le texte du bouton principal se pose sur le cuivre clair du drap :
`#2A1A0E` sur `#D58D4B` = 6,2:1.

### La santé, les proportions

- la **santé d'une équipe** se lit en cinq perles (une par tranche de
  20 points) et en clair : sans mesure, elle affiche « Non suivie » et
  aucune perle n'est remplie — on ne fait pas semblant de mesurer ;
- les **anneaux** du bandeau et des cartes sont remplis par une part
  réelle (équipes avec des membres, part de l'effectif en équipe, équipes
  dirigées, personnes à rattacher), jamais par un remplissage décoratif ;
- l'**échéance d'une tâche** est dessinée en collier ; le texte reste là
  pour le chiffre exact.

### Palette

Tout passe par des variables `--zl-*`, écrites en dur (elles ne dépendent
plus des `--pt-*` du shell, pour que les contrastes soient calculables par
le test), avec deux jeux complets : clair sous `.emp-vues`, sombre sous
`[data-theme='dark'] .emp-vues`.

| Rôle | Clair | Sombre |
| --- | --- | --- |
| fond de page | `#FAF6F0` | `#15110E` |
| surface (papier ivoire) | `#FFFDF8` | `#201A15` |
| creux | `#F4EDE2` | `#2A221C` |
| encre | `#231911` | `#F7EFE4` |
| texte doux | `#4E3D2E` | `#DFD0BE` |
| texte faible | `#74604C` | `#A6937E` |
| cuivre d'action | `#A45C24` | `#D58D4B` |
| cuivre plein | `#823F14` | `#C57C3C` |
| bleu-vert | `#1F6B60` | `#6FBFAE` |
| sauge | `#55662F` | `#A8BE7E` |
| corail | `#A8452F` | `#E8917C` |
| perles (verre) | crème `#EFE1C3`, cuivre `#C08A4D`, bleu-vert `#4F9389`, sauge `#8BA268`, corail `#D08B74` | `#F0E2C6`, `#D69A5C`, `#71B9AD`, `#A5BB7D`, `#D67C62` |

### Contrastes calculés

| Texte → fond | Ratio | Verdict |
| --- | --- | --- |
| encre `#231911` sur surface `#FFFDF8` | 17,0:1 | ok |
| doux `#4E3D2E` sur creux `#F4EDE2` | 8,9:1 | ok |
| faible `#74604C` sur creux `#F4EDE2` | 5,1:1 | ok |
| doux `#DFD0BE` sur creux sombre `#2A221C` | 10,3:1 | ok |
| faible `#A6937E` sur creux sombre `#2A221C` | 5,3:1 | ok |
| encre de scène `#F7ECDB` sur drap `#241A12` | 14,6:1 | ok |
| cuivre clair `#A45C24` sur creux `#F4EDE2` | 4,4:1 | **interdit** → on emploie `#823F14` (6,8:1) |

Le test lit les valeurs dans la feuille et recalcule ces ratios : il
échoue si une teinte de scène passe sous 4,5:1.

### Survol

Un survol change **le trait** et **l'ombre**, rien d'autre :

- jamais de `background` ni de `background-color` sur un élément qui porte
  du texte ;
- jamais de `color` (le libellé reste lisible) ;
- jamais d'`opacity` sur un champ ou un bouton.

Le test lit chaque règle `:hover` de la feuille et refuse ces trois
propriétés.

### Le mouvement

Les cartes, colonnes, modules et le registre **se posent** une fois
(`@keyframes zl-perle-pose`, 0,42 s, décalage de 40 ms par carte) ; tout
est coupé sous `prefers-reduced-motion: reduce`.

## Les vues

### Équipes

- en-tête (la scène) : frise perlée, titre serif, ligne de chiffres,
  puis quatre modules à anneau — équipes, membres, chefs d'équipe,
  personnes sans équipe — séparés par un trait ;
- collier « À décider » : alertes, personnes sans équipe, regroupements
  possibles, besoins d'effectif, dépliables onglet par onglet. Sans
  l'option Prédictions, le collier dit simplement que ces analyses sont
  éteintes ;
- cartes ou liste (deux présentations, une seule lecture) : pastille de
  couleur, jauge de santé, fil d'avatars avec le chef marqué, effectif,
  chef nommé, actions *Membres / Modifier* et menu *Chef / Supprimer* ;
- recherche, filtres (avec chef, sans chef, vides, à surveiller) et tri.

Le tableau à colonnes de l'ancienne page a été retiré : il doublait la
liste sans rien dire de plus.

### Tâches

- quatre perles de chiffres : à faire, en cours, en retard, terminées ;
- bloc « À surveiller » dépliable quand les prédictions sont allumées ;
- catégories : une puce par catégorie avec son effectif, plus l'édition ;
- deux présentations : **Tableau** (glisser-déposer entre colonnes) et
  **Liste** (une ligne par tâche, pour balayer) ;
- sélection multiple et suppression groupée, avec confirmation ;
- les tâches refusées ou annulées ne figurent pas au tableau : une phrase
  le dit et renvoie à la liste, plutôt que de les faire disparaître en
  silence.

## Le ton

On reste un service professionnel. Aucun mot d'atelier ne doit apparaître
dans un texte lu : ni « pagne », ni « bande », ni « teinture », ni
« atelier », ni « métier à perles », ni « collier ». Les noms de classes
CSS peuvent porter le motif ; **les phrases, non**. Le vocabulaire est
celui de la gestion : équipe, chef d'équipe, effectif, échéance, priorité,
catégorie, valider.

Les messages disent ce qui se passe et ce qu'on peut faire :

- « Aucune équipe pour l'instant » + le bouton pour créer la première ;
- « Aucune tâche ne correspond » + le conseil d'élargir la recherche ;
- « Option Équipes non activée » + qui peut l'allumer ;
- « Le calcul… » n'existe plus ici, mais la règle reste : on nomme le
  manque, on ne masque pas.

## Tests

`src/services/__tests__/employesEquipesTaches.test.jsx` — 36 tests.

Ce qu'ils défendent :

1. **menu et adresses** : plus d'entrée `/equipes` ni `/taches`, les deux
   adresses renvoient vers la bonne vue, les deux anciens fichiers de page
   n'existent plus, `VerrouOptions` ne surveille plus une adresse morte ;
2. **onglets** : trois vues, annuaire par défaut, l'adresse porte la vue
   (`?vue=`), les raccourcis de pages restent dans la coque ;
3. **vue Équipes** : phrase de comptage, jauge de perles, chef nommé,
   équipe vide qui ne montre pas d'avatars fantômes, état vide, option
   éteinte expliquée, ouverture de la fenêtre de création, collier
   d'alertes, absence de prédictions dite en clair ;
4. **vue Tâches** : quatre colonnes nommées, priorité et échéance en
   français, glisser-déposer qui appelle vraiment `updateTask`, sélection
   et vidage, bascule en liste, catégories filtrantes, états vides ;
5. **ton et dessin** : aucun mot d'atelier dans les textes rendus, règles
   `:hover` sans fond / couleur / opacité, cibles de doigt (44 px pour les
   onglets, 40 px pour les boutons), contrastes calculés dans les deux
   thèmes, perles dessinées en CSS (pas d'image, pas de dégradé de texte) ;
6. **page entière** : les trois onglets s'affichent, on passe d'une vue à
   l'autre sans quitter la page, les raccourcis ne renvoient pas vers la
   page courante.

Chaque test neuf a été vérifié par mutation : rétablir l'ancien
comportement doit le faire échouer (route, entrée de menu, phrase de
comptage, jauge, cible du glisser, libellé de priorité, adresse des
onglets, `background` ajouté au survol, contraste sombre, mot d'atelier,
visibilité des onglets, changement de vue).

## Limites connues

- l'ancienne page Équipes proposait un tableau à colonnes (déplacer un
  membre d'une équipe à l'autre). Il a été retiré ; le déplacement se fait
  par la fenêtre « Membres » (retirer puis ajouter) ;
- les vues chargent leurs données à l'ouverture, indépendamment de
  l'annuaire : le premier affichage d'une vue coûte une lecture ;
- `getTeams` reste la seule source des équipes ; aucune table n'a changé,
  aucune migration n'est nécessaire pour cette refonte.
