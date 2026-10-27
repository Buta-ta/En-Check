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

Quatre signes, réutilisés partout :

1. **le fil** — une ligne tendue, semée de perles, qui sépare deux blocs
   (`.zl-fil`). Il ne décore pas : il marque une rupture de lecture ;
2. **la perle de chiffre** — un verre clair avec une initiale, posé devant
   un nombre et son libellé (`.zl-perle-rond`). Quatre par vue, pas plus :
   ce sont les seuls chiffres à retenir d'un coup d'œil ;
3. **la pastille** — un point de couleur, jamais seul : toujours collé au
   nom de l'équipe ou de la catégorie qu'il désigne (`.zl-pastille`) ;
4. **la jauge de cinq perles** — la santé d'une équipe se lit en perles
   pleines, pas en pourcentage nu (`.zl-sante`).

Le tableau des tâches est un **métier à perles** : quatre colonnes, une
carte par tâche, un liseré de couleur à gauche qui donne la priorité. On
fait glisser une carte d'une colonne à l'autre pour changer son état.

### Palette

Tout passe par des variables, donc le basculement clair / sombre de la
page fonctionne sans code en plus.

| Rôle | Clair | Sombre |
| --- | --- | --- |
| fond de page | `--pt-canvas` | `--pt-canvas` |
| surface | `--pt-surface` | `--pt-surface` |
| encre | `--pt-ink` | `--pt-ink` |
| texte de bouton sur cuivre | `#FFFFFF` | `#241A12` |
| cuivre d'action | `#A45C24` | `#D58D4B` |
| cuivre plein (bouton) | `#823F14` | `#C57C3C` |
| bleu-vert | `#1F6B60` | `#6FBFAE` |
| sauge | `#55662F` | `#A8BE7E` |
| corail | `#A8452F` | `#E8917C` |
| perles (verre) | crème `#EFE1C3`, cuivre `#C08A4D`, bleu-vert `#4F9389`, sauge `#8BA268`, corail `#D08B74` | mêmes rôles, teintes plus claires |

### Contrastes calculés

| Texte → fond | Ratio | Verdict |
| --- | --- | --- |
| encre `#231911` sur surface blanche | 17,2:1 | ok |
| blanc sur cuivre plein `#823F14` | 7,9:1 | ok |
| encre sombre `#F7EFE4` sur surface sombre `#201A15` | 15,1:1 | ok |
| encre `#241A12` sur cuivre sombre plein `#C57C3C` | 5,1:1 | ok |
| initiales `#241A12` sur perle bleu-vert `#4F9389` | 4,8:1 | ok |
| initiales `#241A12` sur perle corail `#D08B74` | 6,2:1 | ok |
| cuivre clair `#A45C24` sur creux `#F4EDE2` | 4,4:1 | **interdit** → on emploie `#823F14` (6,8:1) |

### Survol

Un survol change **le trait** et **l'ombre**, rien d'autre :

- jamais de `background` ni de `background-color` sur un élément qui porte
  du texte ;
- jamais de `color` (le libellé reste lisible) ;
- jamais d'`opacity` sur un champ ou un bouton.

Le test lit chaque règle `:hover` de la feuille et refuse ces trois
propriétés.

## Les vues

### Équipes

- en-tête : nombre d'équipes, de membres, de chefs désignés ;
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
