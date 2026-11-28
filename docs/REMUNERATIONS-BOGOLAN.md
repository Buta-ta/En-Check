# Rémunérations — le pagne de boue (bogolan)

27 octobre 2026 — refonte totale de `/remunerations`.

## La demande

« Refonte totale de la page rémunération, le motif culturel c'est le bogolan »,
puis : « il faut la bascule clair sombre comme celle de toutes les pages » et
« un placement spécifique de certains boutons pour créer une habitude chez le
client — surtout les boutons bascule et les raccourcis pages ».

## La décision

Le bogolan est déjà le motif de **Paie & fiscalité**, des **fiches de paie** et
de la **configuration fiscale**. Rémunérations est l'écran qui *nourrit* ces
trois-là : c'est la donnée, la fiche n'est que le rendu. Une même famille pour
la donnée et son document évite de faire croire à deux mondes — et le bogolan
est le motif le plus sobre des identités déjà prises (pas de zigzag, pas de
losanges brodés : des pans, des chevrons, des grilles de points).

## La matière, mesurée sur le fichier

Palette relevée pixel par pixel dans `public/images/paie-bogolan-haut.webp` :

| Rôle | Valeur |
| --- | --- |
| Boue | `#2A1509` |
| Fond de cuve | `#180C00` |
| Cuivre | `#A85424` |
| Cuivre clair | `#C4702F` |
| Craie | `#E4CC9C` |
| Craie claire | `#F0D8A8` |

Deux champs, comme sur Pauses et Jours fériés : **au jour**, le pagne de craie
(`--rw-nuit: #F4ECDD`) ; **de nuit**, la boue (`#1A1009`). Le cuivre porte les
accents, jamais l'encre.

## Les repères d'habitude

Le placement n'est pas propre à cette page : c'est le même sur toutes les pages
refondues. C'est cette constance qui crée le geste.

| Repère | Place | Forme |
| --- | --- | --- |
| Retour au tableau de bord | en-tête, à gauche | carré 38 px |
| Sélecteur d'entreprise | en-tête, à droite | champ à filet cuivre |
| **Bascule clair / sombre** | **en-tête, toujours en dernier** | **rond 38 px, `role="switch"`** |
| **Raccourcis vers les autres pages** | **dans le seuil, sous l'en-tête** | **barre de liens compacts** |
| **Action principale** | **barre collée en bas, au centre** | **pilule cuivre** |

Trois conséquences tenues par les tests :

1. la bascule est le dernier bouton de l'en-tête, et sa géométrie (38 × 38,
   `border-radius: 50%`) est identique à `.jf-bascule` sur Jours fériés ;
2. les raccourcis ne remontent jamais dans l'en-tête, et la page courante est
   exclue de sa propre liste (`excludePaths`) ;
3. la barre d'enregistrement n'existe **que** s'il y a quelque chose à écrire :
   une barre toujours présente serait un meuble de plus, pas un repère.

## Le ton

La page parle comme un outil de paie, pas comme un carnet de croquis. Les
formules d'atelier ont été retirées de tout ce que lit l'utilisateur :

| Avant | Après |
| --- | --- |
| « Le pagne de boue » (surtitre) | « Contrats et montants » |
| « On teint le pagne des rémunérations… » | « Chargement des rémunérations… » |
| « Une bande par salarié, teintée quand il ne manque plus rien » | « Une ligne par salarié, avec ce qui reste à renseigner » |
| « Les 14 bandes sont teintées » | « Les 14 salariés ont une rémunération complète » |
| « 2 bandes modifiées » | « 2 lignes modifiées » |
| « le pagne se tisse à partir de là » | « ils apparaîtront ici » |

Les accents culturels restent là où ils ne parlent pas à la place des données :
le bandeau, le médaillon, la tranche de complétude. Le vocabulaire de
l'interface, lui, est celui du métier — et il vouvoie.

## Le coût salarial rejoint la page

Deux écrans parlaient de la même personne. Les fusionner n'est pas les empiler :
c'est **deux vues d'une même page**, avec une seule coque.

| La vue | Ce qu'elle fait |
| --- | --- |
| **Contrats** | écrit la base, le rythme, les compléments, les heures prévues |
| **Coût salarial** | lit la masse, l'heure réelle, les heures au-delà du contrat, la projection |

Ce qui ne bouge pas d'une vue à l'autre : le bandeau bogolan, la bordure
cousue, le seuil (entreprise, devise, pays, effectif), les raccourcis, la
bascule clair/sombre — dernier bouton de l'en-tête — et la barre collée en bas.
**Une seule habitude pour deux lectures.**

La vue coût reprend les données des fonctions de la base
(`encheck_cout_periode`, `encheck_cout_projeter`, `encheck_mois_pointes`,
`encheck_cout_controler`) : aucun calcul n'est refait dans le navigateur. Trois
règles y ont été reprises telles quelles :

1. **l'écran se place sur le dernier mois réellement pointé** — un écran de coût
   qui affiche 0,00 h trois fois sur quatre passe pour une panne ; le bandeau
   dit pourquoi ce mois-là, et propose d'aller sur le dernier mois pointé ;
2. **la projection sépare le certain du variable** — la part contractuelle est
   sûre, les heures supplémentaires et de nuit dépendent des pointages ;
3. **ce qui manque est dit** — un salarié sans montant déclaré, une entreprise
   sans cotisation employeur : le chiffre est annoncé incomplet, avec le chemin
   pour le compléter (un bouton ramène à la vue contrats).

Et deux choses ont changé, dans l'esprit de la page :

- **le tableau de treize colonnes disparaît ici aussi** : une ligne par salarié,
  sept chiffres dans une grille de cases (heures, sup., nuit, brut, charges,
  heure réelle, heure prévue), l'écart en pastille, et la répartition
  brut / charges en barre ;
- **la tranche de gauche devient une jauge de poids** : la part de la personne
  dans la masse, par quart, sans un chiffre.

L'ancienne adresse `/cout-salarial` **redirige** vers
`/remunerations?vue=cout` : les favoris continuent de marcher. Le verrou de
module accepte l'une ou l'autre des deux options (`module_remunerations`,
`module_cout_salarial`) : une page, deux portes d'entrée.

Le **menu latéral** ne porte plus de ligne « Coût salarial » : la page des
rémunérations est la seule porte, sa barre d'onglets fait le reste. La
**commande rapide** du tableau de bord y mène encore, pour un client qui
n'aurait que ce module-là.

### Quand le calcul ne répond pas

L'ancienne page lançait trois appels en parallèle (`periode`, `projeter`, et un
second `periode` pour le repli du mois). Sur une base où la fonction échoue, le
navigateur affichait **trois erreurs 500 pour un seul écran**, et la page
affichait des zéros comme si l'entreprise n'avait personne.

Désormais la vue **sonde une seule fois** `encheck_cout_periode` :

- si elle répond, le reste s'enchaîne (projection, budget, cotisations, repli du
  mois) ;
- sinon, un **seul** constat le dit, et il distingue les deux cas : la fonction
  n'est pas installée sur cette base, ou elle a échoué. Aucune mesure à zéro,
  aucune ligne fantôme, et un bouton **Réessayer** pour relancer à la demande.

Une **projection** en panne ne prive pas de la masse du mois : le mois compté
fait foi, le reste s'affiche normalement.

### Le mois se choisit, et le calcul se voit

**Le mois affiché est un bouton.** Il ouvre la liste des mois réellement
pointés — avec leur nombre de pointages — plus le mois en cours. Un clic vaut
une dizaine de flèches quand on remonte six mois en arrière. La liste se ferme
au choix, au clic à côté ou sur `Échap`, et rend le focus au bouton.

**Le calcul se voit.** Pendant qu'il tourne — première ouverture comme
« Réessayer » après une panne — l'écran affiche « Calcul en cours… » et **ne
montre ni mesures à zéro ni lignes fantômes** : les chiffres n'apparaissent
qu'une fois calculés.

## Ce qui change dans la page

**Le tableau de treize colonnes disparaît.** C'était le vrai problème : treize
colonnes obligeaient à faire défiler horizontalement pour comparer deux
salariés, et les montants n'avaient pas d'unité. Chaque salarié devient une
**bande**, avec :

- un **médaillon** (losange, initiales) et l'identité ;
- deux sélecteurs : la nature du contrat et le rythme de paie ;
- trois groupes de cases : **la base du rythme** (mensuelle, horaire,
  journalière), **le temps prévu** (heures, jours), **les compléments**
  (transport, logement, prime) ;
- une **jauge de teinture** verticale : trois cases, une par chose attendue.

La case du rythme choisi est **teintée**, les deux autres s'effacent tout en
restant saisissables : on ne saisit pas « 250 » en croyant des heures. L'unité
(FCFA, XOF, h, j) reste visible dans la case.

**Le principe du modèle de données ne bouge pas** : mêmes colonnes de
`employee_payroll_profiles`, même `employees.contract_type`, même
`upsert(onConflict: 'employee_id')`, même silence tant qu'on n'enregistre pas.

## Trois ajouts qui font gagner du temps

**1. « Enregistrer (n) » compte de vrais écarts.** L'ancienne page salissait une
ligne dès la première frappe : revenir à la valeur d'origine laissait le
compteur à 1 et le bouton actif. La page garde maintenant une **référence** de
ce qui est en base et compare champ à champ. Taper puis revenir en arrière
laisse la page propre. C'est aussi ce qui rend la barre du bas fiable.

**2. « Reprendre pour… »** recopie la bande d'un salarié sur d'autres : rythme,
heures, jours, transport, logement, prime, heures supplémentaires. Les **trois
montants de base sont décochés par défaut** — un salaire ne se recopie pas par
accident ; on peut les cocher, mais il faut le vouloir. Rien n'est écrit en
base : les bandes sont remplies à l'écran, l'enregistrement reste une décision.

**3. ⌘S / Ctrl+S** enregistre tout ce qui est modifié, depuis n'importe où dans
la page.

Et, en pratique : recherche (nom, matricule, poste), filtres *Toutes /
À compléter / Prêtes*, et un constat en tête qui dit combien de bandes n'ont
pas de coût calculable, avec un bouton qui filtre directement dessus.

## Ce que le modèle exige, selon le rythme

| Rythme | Ce qu'il faut pour calculer |
| --- | --- |
| Mensuel | base mensuelle + heures du mois |
| Journalier | taux journalier + jours du mois |
| Horaire | taux horaire + heures du mois |

Plus, toujours, **la nature du contrat**. Le coût de l'heure se déduit :
`base ÷ heures`, `taux journalier × jours ÷ heures`, ou `taux horaire` tel quel.
Quand les heures manquent, aucun coût n'est inventé : la bande reste incomplète
et la page le dit.

## Le survol, corrigé

Le survol d'une ligne changeait son fond (`--rw-panneau-2`). Sous les cellules,
cela faisait disparaître le cadre des champs — et sous des libellés de 9 px, le
texte devenait difficile à lire, dans les deux thèmes.

Trois corrections :

1. **le survol ne peint plus aucun fond derrière un texte.** Il souligne la
   ligne, éclaire la tranche de gauche (qui ne porte aucun texte) et redessine
   le cadre des cases. La case du rythme choisi garde son trait de cuivre ;
2. **les cellules ne sont plus dimmées par une opacité.** `opacity: 0.72` sur
   les cases « hors calcul » faisait tomber le libellé à **2,8:1** en thème
   clair ; le trait pointillé dit maintenant « hors calcul » sans toucher au
   texte ;
3. **le champ se lit comme un champ** : fond `--rw-creux` (1,15:1 sur la ligne
   en sombre, 1,27:1 en clair), `color-scheme` posé par thème et
   `appearance: none` sur les champs, pour qu'aucun style natif ne repeigne
   par-dessus au survol.

La teinte de la case active est passée de 9 % à **6 %** de cuivre : à 9 %, le
libellé tombait à 4,45:1 sur le fond teinté, en clair.

## Les contrastes, calculés

| Texte | Sur | Pire mesure |
| --- | --- | --- |
| Encre `#231911` / `#F3E7CE` | les quatre fonds | 12,27:1 |
| Douce `#4E3D2E` / `#D6C1A0` | les quatre fonds | 7,50:1 |
| Faible `#6B5745` / `#A9967A` | les quatre fonds | 4,96:1 |
| Cuivre `#9C5321` / `#D4813C` | fond, panneau, panneau-2 | 4,51:1 |
| Badges d'état (ok, attente, alerte) | le creux | 4,67:1 |
| Encre, douce, faible | le fond des champs, et la case active | 4,61:1 |
| Texte du bouton | sur le cuivre | 5,27:1 / 6,24:1 |

Une correction a été nécessaire : `--rw-attente` valait `#8A5A00`, soit
**4,30:1** sur le creux où vivent les badges — il est passé à `#7E5200`
(4,93:1). Le texte des boutons ne prend jamais l'encre sur le cuivre
(3,01:1) : il prend `--rw-sur-cuivre`.

## Le dessin

Quatre signes, quatre rôles :

- **le losange** — le médaillon d'un salarié ;
- **la frise de chevrons** — un séparateur (les mesures) ;
- **la grille de points** — la complétude, un point par salarié ;
- **le pan décalé** — le bord d'une bande : une étape à finir, pas une erreur.

Le chargement est une scène dessinée, jamais une photo : la bande de craie est
tendue, la teinture de boue se pose pan par pan, le bâton la suit. En
`prefers-reduced-motion`, la teinture s'affiche finie et fixe.

## Repli

- **1180 px** : les repères passent sous les mesures, les trois groupes de cases
  s'empilent.
- **760 px** : le titre passe sous les boutons, la recherche prend la largeur,
  les filtres se partagent la ligne, les deux sélecteurs se partagent la bande.
- **520 px** : les mesures passent en une colonne, la barre d'enregistrement
  s'étire sur toute la largeur.

## Tests

`src/services/__tests__/remunerationsBogolan.test.jsx` — 40 tests :

- la route et le bandeau (`/remunerations` → bogolan, le vrai fichier, deux
  bandeaux posés par la page) ;
- le placement : retour en premier, bascule en dernier et 38 × 38 comme
  `.jf-bascule`, raccourcis dans le seuil et nulle part ailleurs, barre
  d'enregistrement fixe et conditionnelle ;
- la disparition du tableau, des cases à cocher et de l'ancien décor
  (`#4F46E5`, `#F8FAFC`, `#EEF2FF`, `#0F172A`, `#6366F1`, `#8B5CF6`) ;
- les quatre pièces SVG et la jauge de teinture (cases remplies, bornage) ;
- le chargement dessiné (aucune image, `prefers-reduced-motion`) ;
- le montage réel : quatre mesures, trois lignes, ce qui manque dit en clair,
  coût de l'heure déduit (1 445,09 et 1 734,10), filtres, recherche ;
- le diff : rien au chargement, taper puis revenir ne salit pas, comptage exact,
  enregistrement des seules lignes modifiées avec les bonnes valeurs, `Ctrl+S` ;
- « Reprendre pour… » : les trois montants décochés, application sans écriture,
  salaire non recopié par défaut ;
- les contrastes recalculés depuis le CSS.

Vérifiés par mutation : diff supprimé, montants de base recopiés par défaut,
coût de l'heure non divisé, bascule de thème retirée, barre toujours affichée,
survol qui repeint le fond, case redevenue transparente, opacité réintroduite,
formule d'atelier réintroduite, couleur de texte changée au survol — chacune
fait tomber au moins un test.

La fusion a son propre fichier —
`src/services/__tests__/remunerationsCout.test.jsx`, 31 tests :

- l'ancienne page n'existe plus, l'ancienne adresse redirige, le calcul est
  bien emporté (les quatre fonctions et le réglage de budget) ;
- le menu mène aux deux vues, et une seule des deux options de module suffit ;
- la vue coût se monte : deux vues, quatre mesures, quatre périodes, le mois
  choisi d'après les pointages ;
- une ligne par salarié, jamais un tableau : poids dans la tranche, sept
  cellules, écart du bon côté, rémunération non déclarée annoncée ;
- la recherche, à sa place habituelle dans la barre de titre ;
- le budget se contrôle depuis la barre ; sans budget, pas de barre, et ⌘S
  n'enregistre rien depuis une vue qui ne fait que lire ;
- les pannes : un calcul en échec le dit sans vider la page et **sans répéter
  l'appel**, une fonction absente se dit autrement, « Réessayer » relance, et
  une projection en panne laisse les chiffres du mois debout ;
- le mois cliquable : la liste s'ouvre, annonce les pointages de chaque mois,
  se ferme au choix comme au clic à côté ; pendant le calcul, l'écran le dit
  et n'affiche pas encore de chiffres ;
- le ton et la lisibilité : aucune formule d'atelier, aucun texte dimmé.

Deux sections défendent le ton et la lisibilité au survol :

- `9. le ton reste professionnel` — les mots « pagne », « teint », « tiss »,
  « boue », « couture » n'apparaissent dans **aucun texte rendu** (page montée,
  écran de chargement), et l'interface dit « ligne » et « salarié » ;
- `10. le survol ne dégrade jamais la lisibilité` — les règles `:hover`
  n'ont pas le droit de peindre un fond derrière un texte, aucun champ ne peut
  être dimmé par une opacité, la case doit rester un champ, et le contraste est
  recalculé sur le fond des champs comme sur la case active.

## Un rangement au passage

`culturalMotifForPath()` vivait dans `PageCulturalBand.jsx`, qui exportait donc
un composant *et* une fonction — ce que la règle du rechargement à chaud
interdit. La carte des motifs est passée dans
`src/components/culturalMotif.js` ; le bandeau l'importe, les sept tests qui la
lisaient aussi.

## Le brut adouci, encre sur bosse (8 novembre 2026)

La demande :

> Maintenant passons à la page « Rémunération ». Cette page on va la garder telle
> quelle mais on va seulement appliquer le style brut adouci, double feutre.
> Enlever les raccourcis, le bouton sombre/clair. Retravaille un peu les formes
> de certains blocs.

Le verrou est dans le premier mot : **garder telle quelle**. Aucun bloc n'a
changé de place, aucune étiquette n'a été réécrite, aucun `data-testid` n'a été
touché, l'ordre des lignes, les requêtes et le calcul du coût sont ceux d'hier.
Ce qui a bougé est de l'encre et de la géométrie, plus les deux suppressions
nommées.

### Ce qui est tombé

**Le bouton sombre/clair.** La page entretenait un second thème à côté du
global : une classe `.rw-clair` posée par l'écran, et onze règles qui
réécrivaient l'échelle pour lui répondre — cinq dans la page, six dans son
chargeur, trente-deux déclarations au total. C'est exactement ce que le verrou
`overtimeBrandAlignment` défend depuis le contrat de temps, et la formulation
de la loi n'est pas « la page ignore le thème » mais « la page n'en tient pas
un deuxième » : une classe locale, un `data-theme=` posé par l'écran, l'ancre
`encheck.theme`, les mots « Mode sombre/clair », un `<button
onClick={toggleTheme}` — interdits. Le thème se règle dans le rail, la page
obéit aux jetons, et `[data-theme='dark']` de `tokens.css` retourne l'échelle à
la racine. Le bouton carré de l'en-tête, lui, est resté : il porte le
rechargement et s'appelle maintenant `.rw-cadre` (il s'appelait `.rw-bascule`
parce qu'il portait aussi la bascule).

**Le bandeau de raccourcis.** `<RaccourcisPages>` vivait dans le seuil, sous
l'en-tête, et redisait la barre latérale. La bande, son import et ses dix
règles CSS sont supprimés ; le seuil a cessé de promettre des « accès rapides »
qu'il ne montre plus — son `aria-label` dit maintenant « Entreprise, devise,
période ».

Deux choses ont été **gardées** contre une lecture trop littérale de « enlever
les raccourcis » : le ⌘S / Ctrl+S de la barre d'assemblage et son badge
`.rw-touche`. Ce ne sont pas des raccourcis de navigation, c'est le moyen
d'écrire sans quitter la page ; le contrat de temps les épingle par un test,
et ils en ont un ici (`raccourci.current = vue === 'contrats' ? enregistrerTout : null`).

### La couche de jetons : des alias, plus de couleur

`Remunerations.css` ne contient plus une seule couleur écrite : 66 lignes de
littéraux (hex, `rgba`, un `radial-gradient`, un `backdrop-filter`) sont
devenues trente et un alias dans le bloc commun de la page — dix-huit de
couleur (`--rw-nuit`, `--rw-ocre`, `--rw-alerte`…), tous lus dans `--charte-*`
ou mélangés depuis lui, un de trait, douze mesures nommées (`--rw-cadre`,
`--rw-sceau`, `--rw-reserve`…) — plus les deux du motif, `--rw-bogolan-trait`
et `--rw-bogolan-plein` : trente-trois jetons, zéro littéral, et les seuls
chiffres qui restent disent tous ce qu'ils mesurent. La règle tenue : *un jeton
de page qui serait une couleur est la charte au second degré*. Les deux niveaux
de texte « pâle » sont des mélanges colorimétriques du jeton (`color-mix`),
jamais des `opacity` — un texte délayé laisse voir la ligne à travers lui.

Le cuivre a deux métiers que la page confondait sous un seul nom :

| métier | avant | après | pourquoi |
| --- | --- | --- | --- |
| **peint** — liseré, point de trame, pan teint, jauge | `#D4813C` | `var(--charte-aplat)` | une figure se juge à 3:1 |
| **écrit** — le sourcil, les libellés, les icônes | le même hex | `var(--charte-texte)` | l'argile de la charte ne vaut que 3,5:1 en texte ; « l'argile écrite » est le jeton du kit pour les mots |

Ce qui **porte du texte et se remplit** (la pastille de filtre active, la vue
active, la puce de la modale, la coche, le bouton cuivre d'une ligne, la piste
allumée) ne se remplit plus de pigment de motif mais de fond de pagne,
`--rw-boue`, avec `--charte-blanc` dessus : 14:1 dans les deux thèmes.

### Les contrastes, recalculés

L'ancien moteur de contraste du fichier lisait des hex dans `.rw-page` et
`.rw-page.rw-clair`. Il lisait donc la palette parallèle — et il avait raison
de la réclamer, puisque c'était la seule. Le test suit maintenant la chaîne
complète : `--rw-*` → `--charte-*` → le thème posé à la racine, en sRGB, comme
le navigateur. Trois niveaux de texte × quatre fonds × deux thèmes, l'accent
écrit, les trois états sur le creux et sur le lavis de la case active, le texte
d'un pan rempli : tout passe à 4,5:1 ou mieux.

Les mélanges ne sont pas des coups d'œil. Le plus pâle des trois niveaux était
à 3,1:1 sur le fond des cases ; il est maintenant `douce` à 94 % dans la
surface, qui vaut 4,75:1 au pire. Les états écrits sont resserrés vers l'encre
du thème (`succes` 90 %, `alerte` 88 %, `erreur` 78 %) : comme l'encre
s'inverse, le resserrage se retourne tout seul — plus foncé sur le sable, plus
clair sur la nuit. C'est le même calcul que celui du 26 novembre sur la
refonte, rejoué sur les jetons du kit au lieu de six hex soigneusement choisis.

### Les formes, retouchées une à une

| objet | avant | après |
| --- | --- | --- |
| tous les contours | `1px` de filet | `var(--charte-trait)` = 2 px d'encre |
| les liserés de gauche (seuil, période, constats) | 2 ou 3 px au choix | `--rw-filet` = 3 px, partout |
| les cinq ombres portées | `0 16px 34px`, `0 26px 60px`… | `var(--charte-ombre-dure)`, flou nul, sur les panneaux portés seulement |
| les rayons | 13 valeurs (1,5 · 3 · 4 · 5 · 7 · 9 · 10 · 14 · 50%…) | les cinq du kit (0 · 6 · 8 · 12 · 999) + le rond du bouton-poussoir |
| les tailles | 19 déclarations, 14 crans de 5 à 28 px | 4 (micro · corps · titre · bouton) |
| les pas | 44 `padding` distincts, 20 `gap` | 25 et 8, composés des sept pas de l'échelle (et des zéros) |
| la couture sous le bandeau | bande de 9 px, pointillé de 1 px, `opacity .75` | trois pixels de règle, un point de cuivre tous les huit |
| les pastilles de filtre et les deux vues | actives = anneau de cuivre de deux pixels autour d'un mot cuivre | actives = **remplies** (un pan de boue, texte blanc cassé) : phase 60, *soit FAIT soit DIT* |
| la case de montant | 7 px, `1px` + `border-bottom: 2px` | 6 px, 2 px d'encre et une **règle de trois** en pied |
| la case à cocher, le sceau, la piste | 16 px, 46 px, 34×18 | `--rw-coche` 18, `--rw-sceau` 42 (le médaillon remplit sa case), piste 38×20 avec une poignée de 12 |
| la modale | 680 px, rayon 14 | `var(--charte-modale-large)`, rayon d'une carte |
| le focus | `outline: none` × 3, halos `0 0 0 4px` | une seule règle pour toute la page : anneau d'encre de 2 px décollé de 2 |
| la barre d'assemblage, sur téléphone | pilule flottante à 12 px des bords | rayon d'une carte, d'un bord à l'autre |
| le bas de la coque | `104px` nu | `--rw-reserve`, nommé : c'est la hauteur de la barre collée |

Deux défauts de la feuille ont été rebouchés au passage, parce que «
retravailler les formes » n'interdit pas de cesser de se contredire :
`@keyframes rw-monter` était déclaré deux fois (la seconde dans le bloc
téléphone) et les deux `@media (max-width: 520px)` n'en font plus qu'un. Le
repli `prefers-reduced-motion` nommait treize objets, il en nomme vingt et un :
les huit passages qui bougeaient encore entre les mailles (la vue active, le
mois cliquable, les puces du champ, les items de la modale, le passe du
chargeur) sont coupés ; les cinq objets qui dessinent l'étaient déjà.

### Le chargeur et le motif, décolérés

`RemunerationsLoading` recevait `darkMode` en propriété et peignait son propre
`#150C06`, avec six règles `[data-theme='light']` pour le cas contraire. Il ne
reçoit plus rien du tout — le modèle est `OvertimeLoadingScreen` : un chargeur
n'a pas d'avis sur le thème. Sa scène (bande, pans, sillages, bâton, frise)
garde son dessin et prend ses couleurs par classes `rw-scene-*`.

`RemunerationsBogolan.jsx` portait les six hex de la maison dans un `const
BOGOLAN`, et c'est pour ça que les tests de contraste les réclamaient. Le motif
est resté intégralement — un motif validé ne se redessine pas — mais il est
**décoloré** : le composant ne nomme plus que des classes (`rw-bo-cadre`,
`rw-bo-losange`, `rw-bo-points`, `rw-bo-case`, `rw-bo-pan`) et une teinte
(`cuivre`, `craie`, `boue`) ; `Remunerations.css` décide du pigment. Le ton
« craie » ne se peint pas, il se grave : `--charte-blanc`, et une bande
complète cesse d'être une bande *sombre*.

### Une seule action pleine par écran

La barre d'assemblage et la barre du budget portent chacune `ch-btn-pleine` —
les deux vues ne s'affichent pas ensemble, donc un seul bouton plein par écran,
et les seize autres boutons de la page restent `.rw-bouton` (ils sont le
vocabulaire compact de la page, ils ont eu le trait et les rayons du kit, pas
ses capitales). Le bouton de confirmation de la modale « Reprendre » prend la
pleine, lui aussi : sous un voile, l'œil est dans le couloir.

### Les tests

Neuf assertions de `remunerationsBogolan.test.jsx` et quatre de
`remunerationsCout.test.jsx` **exigeaient** les objets supprimés — le verrou
du 26 décembre sur la bascule, le bandeau de raccourcis, la palette à six hex,
les `color-scheme` des deux thèmes. Elles ont été **inversées**, pas supprimées
ni adoucies : « la page a deux thèmes avec sa propre bascule » est devenu « la
page n'entretient pas un second thème à côté du global », « les raccourcis
vivent dans le seuil » est devenu « le bandeau de raccourcis est tombé : le rail
les dit déjà », et la boucle sur six hex est devenue douze jetons du kit qu'on
retraverse, plus l'interdiction d'un `--rw-*` qui serait une couleur. Les
sélecteurs `.rw-barre .rw-bouton` et `.rw-modale-pied .rw-bouton` ont suivi
l'action pleine.

Une onzième section, « le brut adouci : l'encre, la bosse et rien d'autre »,
verrouille la passe : aucun contour de un pixel, aucune ombre floue, les
ombres de la page sont le jeton ou rien, les rayons/tailles/pas viennent du
kit, deux `opacity` dans la feuille et une seule affaire (le pan qui n'est pas
encore teint et son repli), le motif a gardé son dessin et perdu sa palette, un
seul bouton plein par écran. Les douze mutations correspondantes ont été
jouées : **12 rougies, 0 silencieuses**. La dixième a demandé de borner
l'aiguille (`"rw-bo-points"` entre guillemets, et `.rw-bo-points {` en CSS) :
sans quoi `rw-bo-points-doux` satisfaisait la recherche et la mutation passait
inaperçue.

### Ce qui n'a pas été fait, et ce que le compteur a bougé

`JoursFeries.css` garde ses 65 couleurs en dur et `src/index.css` les siennes :
`npm run charte` reste NON CONFORME sur le dépôt, comme avant cette passe. Le
verdict n'a pas changé de camp, mais la page a cessé d'y peser — compté sur la
même commande, avant puis après :

| mesure de la charte | avant | après |
| --- | --- | --- |
| C1 couleurs en dur | 4390 dans 179 fichiers | 4368 dans 177 fichiers |
| C9 ombres floues | 124 | 119 |
| C10 rayons hors liste | 323 sur 18 valeurs | 307 sur 17 valeurs |

Et plus un seul des trois fichiers de la page n'apparaît dans le rapport.

## L'en-tête est une planche rognée (8 novembre 2026)

La demande, avec la maquette retenue
(`docs/maquettes/rw-entete-billet-forme-choix.png`) :

> Retravaille ce bloc pour que sa forme ressemble à un billet de banque, enlève
> le bandeau motif en haut, et entoure-le de ce bloc comme dans la page
> employés.

Puis, après une première proposition trop décorée :

> Je change d'idée, propose autre chose. Enlève les chiffres, les numéros de
> série. Moi je ne veux que la forme.

C'est ce second cadrage qui est tenu ici : **la forme seule**. Ni chiffre de
valeur, ni série, ni filigrane, ni guillochage — un billet ne se reconnaît pas
à ses ornements dans une interface, il se reconnaît à sa silhouette et à son
double cadre.

### Ce qui est tombé

`<PageCulturalBand pathname="/remunerations" />` du haut, et avec lui la
`couture` de pointillés (`.rw-bordure`, trois pixels de rouleau cuivre répétés
tous les huit). Le bandeau du bas reste : c'est lui qui ferme la page.
L'en-tête, lui, n'a plus son `border-bottom` de trois pixels — un bloc qui se
cadre tout seul n'a rien à souligner en dessous.

Deux lois **exigeaient** la pose du haut (`la page garde ses deux bandeaux`,
dans la vue coût, et `le bandeau est le vrai fichier bogolan`, dans la section
motif). Elles sont retournées, pas supprimées : la page ne doit plus contenir
la balise du haut, ni le mot `rw-bordure`, et la feuille ne doit plus contenir
la règle. Le fichier `PageCulturalBand.jsx` est intact, et les seize autres
pages qui le posent le posent toujours en haut : seule la pose de Rémunérations
change.

### La parenté avec les Employés

`.empv3-entete` est un **bloc posé** : contour de deux pixels d'encre, fond de
surface, ombre dure, marge autour — pas une barre pleine largeur. C'est ce
vocabulaire que la planche adopte, à une différence : le contour n'est pas un
`border`, et l'ombre n'est pas un `box-shadow`.

| objet | avant | après |
| --- | --- | --- |
| largeur | bord à bord, 24 px de padding | une planche dans la colonne de la coque (`--rw-colonne` = `--rw-largeur` moins deux gouttières), centrée |
| cadre | un filet du bas de 3 px | deux traits : 2 px d'encre au bord, un second filet à 10 px, sur les quatre côtés rognés |
| coins | carrés | coupés en biseau de 14 px (`--rw-coupe`), aux quatre angles |
| ombre | aucune | une chute de 3 px, franche, sans flou |
| angles | rien | quatre carrés de cuivre de 6 px, logés contre le filet intérieur |
| tiers droit | du vide avant le sélecteur | une souche : règle verticale de deux pixels, qui tombe sous 760 px |
| sélecteur d'entreprise | liseré cuivre sur le côté gauche | cuivre autour (`--rw-trait` sur les quatre bords) |

### Pourquoi trois calques et pas deux propriétés

Le rognage se fait en `clip-path`, seul moyen de couper l'onglet sans dessiner
un pseudo-triangle de couleur par coin. Or `clip-path` rogne **tout** ce que
porte l'élément : un `box-shadow` externe disparaît avec le reste, et un
`border` rectangle ne suit pas la coupe. D'où :

- les deux calques (`.rw-entete::after` = la planche, `::before` = la chute)
  portent **le même** `clip-path: var(--rw-billet)`, et sont décalés l'un de
  l'autre par un `translate(var(--rw-chute))` — l'ombre est une seconde
  silhouette, pas une projection ;
- le cadre se peint en trois `box-shadow` **internes**, déclarées du plus étroit
  au plus large, parce que la première de la liste est peinte par-dessus :
  encre de 0 à 2 px, dégagement de crème de 2 à 8, filet de 8 à 10 ;
- les quatre carrés sont quatre couches de `background-image` posées à
  `var(--rw-filetage)` des bords — `left 10px top 10px`, et les trois autres
  angles. Le jeton `--rw-coings` est un `linear-gradient(cuivre 0 0)` : deux
  arrêts à zéro, donc une couleur pleine. Un dégradé ne sert ici à rien, le
  tampon est un tampon ;
- `.rw-entete` porte `isolation: isolate` parce que les deux calques sont en
  `z-index` négatif : sans contexte d'empilement propre, ils glissaient sous le
  fond de la page et la planche s'effaçait derrière le lavis. C'est le
  troisième défaut que cette passe a eu à attraper — les deux autres étant
  l'ordre des ombres internes et la rognure de l'ombre externe.
- la chute est peinte en `var(--rw-boue)` (`--charte-tissu`), pas en encre :
  l'encre s'inverse avec le thème, et une ombre claire sur une planche sombre
  n'est plus une ombre. Le tissu, lui, ne s'inverse pas.

### Ce que la loi refuse, et par quoi elle l'a prouvé

La section 12 du test de motif tient six assertions : la planche ne peint rien
elle-même (aucun `background` sur le contenant) ; elle n'est pas collée au bord
(`width: var(--rw-colonne)`, et la colonne se déduit de la largeur + un pas
d'échelle, jamais d'un chiffre) ; les deux calques sont rognés du même
polygone ; le polygone a huit points et huit retraits de `var(--rw-coupe)`,
sans un `px` ; **aucun pseudo n'écrit** (`content:` non vide interdit) — c'est
la loi qui dit « je ne veux que la forme » en termes vérifiables ; le cartouche
est entouré et non barré ; la souche tombe sur petit écran.

Seize mutations jouées contre la feuille et le composant : **seize rougies,
aucune silencieuse**. Dont « le bandeau du haut revient », « la couture de
pointillés revient », « l'isolation saute », « un pseudo se met à écrire un
numéro », « les quatre coins redeviennent un dégradé », « l'ordre des trois
traits est inversé », « la planche quitte la colonne de la coque ».

### Compteurs

`npx vitest run src/services/__tests__/remunerations` : 82/82. Suite complète :
2692 tests passés, les 18 fichiers en échec sont ceux d'avant (variables
Supabase absentes de l'environnement, pas de régression). `npm run build`
passe. La feuille fait 2528 lignes, aucune au-delà de 100 caractères, parse
postcss OK (315 règles), zéro couleur écrite, zéro jeton orphelin.
`npm run charte` : 4368 couleurs en dur / 119 ombres floues / 307 rayons hors
liste — exactement les chiffres d'avant la passe. Le `clip-path` n'est compté
par aucune règle, la chute n'est pas une `box-shadow` floue, et le rayon du
cartouche reste celui de la carte.

### Ce qui n'a pas été fait

Les autres blocs de la page (le seuil, les mesures, le pagne, la barre
d'assemblage) gardent leur cadre : la demande portait sur le bloc du haut. La
couture de pointillés ne reparaît nulle part — elle n'existait que sous le
bandeau du haut, et le bandeau du bas se passe de doublure depuis toujours.

## Le tissu autour de la planche, et le rail (8 novembre 2026)

Deux retours d'un seul mouvement : « entoure ce bloc du bandeau tissu bogolan
comme dans la page employés », et « ramène la sidebar + son rail, avec les
images de profil des entreprises ». La planche n'est pas défaite — elle garde
ses huit coupes, ses trois traits, ses quatre ongles de cuivre et sa chute.
C'est une enveloppe qu'on ajoute autour, et une barre qu'on rend à la page.

### Le tissu : deux bandes, pas une

Le modèle est `.empv3-entete` de la page Employés : le conteneur passe à
`display: block; padding: 0`, le contenu descend dans un `.rw-entete-corps`
qui reprend son rythme (`gap` et `padding` aux jetons), et deux `<span>`
portent l'étoffe, un premier, un dernier. `Employee360.css` nommait bien une
bande, mais ne l'écrivait pas : dans `src/pages`, deux feuilles seulement
taillent le bandeau dans leur propre en-tête — `EmployesV3.css` et, depuis
aujourd'hui, `Remunerations.css`.

L'étoffe est le fichier de la maison, pas une copie : `paie-bogolan-haut.webp`
(1536 × 76) en haut, `paie-bogolan-bas.webp` (1536 × 32) en bas, les deux
mêmes images que lit `PageCulturalBand`. Deux jetons d'alias
(`--rw-tissu-haut`, `--rw-tissu-bas`) et deux `url()` dans la feuille — les
seuls. `background-repeat: repeat-x` et `background-size: auto
var(--rw-tissu)` : la bande fait 18 px de haut comme sur les Employés, et le
motif garde sa proportion, donc sa tuile fait 364 px de large (1536 × 18/76)
et se répète trois fois et un tiers sous les 1200 px que laisse la colonne
(1232 px à la largeur maximale, moins l'ongle de chaque côté). Il n'est jamais
étiré — la loi C4 de la charte.

### Pourquoi la bande descend dans le gousset

Recopiée telle quelle, la bande posée à `top: 0` peignait le trait d'encre du
cadre : le contour de la planche s'ouvrait en haut et en bas, exactement ce
que la charte défend (C11, contour 2 px sur tout objet). La bande est donc
descendue de l'épaisseur du filetage, `margin: var(--rw-filetage)
var(--rw-agrafe) 0` — 10 px, le calcul du cadre, pas un chiffre. Le trait
reste continu tout autour, et l'étoffe est prise DANS le cadre.

Ce dégagement fait aussi les agrafes : les quatre carrés de cuivre sont posés
à `var(--rw-filetage)` du bord et font `var(--rw-coing)`, soit de x = 10 à
x = 16. La bande, elle, commence à `--rw-agrafe` = `calc(filetage + coing)` =
16 px. Le tissu finit où l'ongle commence, à la hauteur de l'ongle. Un
`background-size: 100%` ou un `border-bottom: 1px` — la doublure du modèle
— n'aurait rien dit de tout ça, et la séparation de 1 px couleur encre qu'on
lit à `.empv3-entete-bandeau` n'a pas été reprise : ici le trait du cadre est
déjà continu, une seconde ligne l'aurait dédoublé.

Enfin, la cage ne rogne rien : pas d'`overflow: hidden` sur `.rw-entete`, la
leçon est écrite en toutes lettres à `.empv3-entete` et le verrouille ici. Le
rognage reste l'affaire du `clip-path` des deux calques. Sous 760 px, la bande
se maigrit avec le bloc (`--rw-tissu: var(--rw-filetage)`, 10 px) et le corps
du bloc passe au pas de 12.

### Le rail : la fabrique, pas une seconde barre

`CoqueAdmin` + `SidebarUnique` + `sectionsNavAdmin`, la triple ligne déjà
posée à `HeuresSupplementaires`, `Pauses`, `Absences` : huit fichiers de
`src/pages` rendent maintenant `<CoqueAdmin>`. La rubrique « Paie →
Rémunérations » de `sectionsNavAdmin.js` est gardée par `module_remunerations`,
donc le rail s'allume ici tout seul, sans qu'on ait eu à déclarer une vue.

Deux choix ne sont pas des détails :

- **les vues `contrats` / `coût` ne sont pas données au rail.** La page a son
  seuil avec ses deux boutons ; `vues` dans le rail serait un second
  interrupteur pour la même lampe, et l'un des deux mentirait. C'est la leçon
  écrite à `Planning.jsx`, et une loi le tient (`le rail ne reçoit pas vues`).
- **`surEntreprise` ne charge rien** : il pose `setSelectedEntId(id)`, et
  l'effet qui regarde `selectedEntId` recharge tout — le rail n'ouvre pas un
  second chemin d'écriture, sinon la réponse de l'entreprise quittée arrive en
  retard et écrit sur la nouvelle.

Les images de profil venaient de là. `SelecteurEntreprise` rend sa pastille
avec `PhotoSignee` (bucket `photos`, URL signée) à partir de
`entreprise.logo_url`, et retombe sur la lettre du nom quand la colonne est
absente. La requête de la page sélectionnait `id, name, code` : le rail
n'avait jamais rien à signer. C'est `id, name, code, logo_url` — le même
défaut que Retards et Annonces accueil avaient eu le 26/11, corrigé là-bas en
`.select('*')`, et corrigé ici par le mot manquant.

`useTheme()` est revenu dans la page, et ce n'est pas un retour en arrière :
le verrou du 26/12 tenait un SECOND thème entretenu par l'écran (classe
locale, `data-theme`, ancre `encheck.theme`, palette parallèle). Il n'y en a
toujours pas. Le hook est lu pour alimenter la commande du rail
(`darkMode`/`surTheme`), et `toggleTheme` n'apparaît que deux fois dans tout
le fichier : la déstructure, et la prop.

### Ce que la loi refuse, et par quoi elle l'a prouvé

Une section 13 de six cas, et cinq assertions de plus dans la section qui
monte la page (le rail est dans le DOM ; les deux bandes et le corps sont dans
la planche). Elle refuse : une seule bande au lieu de deux, un fichier
inventé, une étoffe étirée, une cage qui rogne, le rythme qui remonte sur la
cage, un `--rw-agrafe` écrit en chiffres, la bande qui remange le trait, les
bandes du haut et du bas portant le même tissage, le rail qui reçoit `vues`,
la requête sans `logo_url`, un `data-theme` ou un bouton de thème dans la
page.

Seize mutations jouées contre les deux fichiers : **seize rougies**. L'une
d'elles est restée verte au premier passage, et mérite sa place — effacer
`background-image: var(--rw-tissu-bas)` de la règle `--bas` laissait toutes
les lois vertes, la bande du bas répétant alors celle du haut. La loi des
deux étoffes a été écrite pour ça, dans la foulée.

### Compteurs

`npx vitest run src/services/__tests__/remunerations` : 88/88. Suite
complète, avec les variables Supabase posées : 202 fichiers, 2913 tests, tous
passés (les 18 fichiers non ramassés la fois dernière venaient de
l'environnement, pas du code : sans les variables Supabase, ils n'entrent pas
dans le compte). `npm run build` passe en 15,9 s. `npm run charte` : 119
ombres floues / 307 rayons sur 17 valeurs — au caractère près les chiffres
d'avant la passe, et le diff du rapport est vide ; le bandeau n'ajoute ni
couleur, ni flou, ni rayon. La feuille fait 2582 lignes, aucune au-delà de 100
caractères, 320 règles parsees par postcss, zéro couleur en dur, deux `url()`
seulement — les deux jetons d'étoffe —, zéro jeton `--rw-*` orphelin ou non
consommé.

### Ce qui n'a pas été fait

Un admin d'une seule entreprise ne verra pas de bandeau d'entreprises dans le
rail, mais la marque de la maison : `chargerEntreprises()` ne liste que pour
`super_admin`, et c'est le comportement de `Pauses` comme d'
`HeuresSupplementaires`, qui posent la même condition. L'uniformiser ici
voudrait dire ouvrir à ces pages le chargement d'une ligne d'entreprise — une
autre passe.

Et rien n'a été vu à l'œil : le sandbox n'a ni Chromium ni Playwright, la
géométrie de la bande est tenue par la loi, pas par une capture. La hauteur
cumulée du bloc (10 + 18 + 16 de rythme avant le contenu, autant en bas) est
calculée, pas mesurée sur écran.

## Le tissu fait le tour du bloc (8 novembre 2026)

« quand je disais entourer, je veux que ça ressemble à ça ». La maquette
corrige ma lecture de la passe dernière : entourer, ce n'est pas poser deux
bandes de 18 px sur les deux bords longs d'une planche. C'est **un cercle
d'étoffe à cru sur les quatre côtés**, et le champ de papier reculé dedans.
C'est exactement ce que fait déjà `.e360-tete` de la fiche salarié — la
maquette est ce traitement-là, pas le mien.

### Ce que la maquette dit, mesuré

Elle fait 2724 × 262 px, posée sur le fond de page `(249, 246, 240)` ; le bloc
la remplit tout entière, x = 0..2721, y = 0..261. Le premier pixel de papier
crème tombe à y = 54 en haut, et le dernier à y = 202 : le champ fait 149 px de
haut, 2611 de large (x = 53..2664). Les quatre retombées d'étoffe, mesurées
chacune sur leur bord :

| bord | tissu, en px de maquette | /2 |
|---|---|---|
| haut | 54 | 27 |
| bas | 59 | 29 |
| gauche | 53 | 26 |
| droite | 59 | 29 |

La maquette est rendue à un facteur qu'aucune de ses mesures ne fixe : lue à
1× la bande ferait 54 px de CSS, lue à 2× 27. Je n'ai pas pris ce chiffre-là,
j'ai pris **la cote de la maison pour ce traitement** : 24 px, qui est aussi
un pas d'échelle du kit (`--charte-espace-5`) et laisse au motif sa période de
485 px. Ce qui se vérifie, c'est le rapport : 54 pour 149 de champ chez elle,
soit 0,36 ; chez nous 24 de bande pour un champ haut du contenu plus deux fois
16 px de corps, soit ~0,30 — un cinquième d'écart, dans le sens où notre
titre est plus haut que le sien. Les coins, eux, sont nets : le bord du champ
avance de 6, 4, 3, 2, 1 px sur cinq lignes de 2 — un arc, pas une coupe ;
rayon ≈ 14 px de maquette, soit 7 à 8 px en CSS, le `--charte-rayon-carte`. Le
coin extérieur du bloc se cintre sur ~10 px de maquette, soit le
`--charte-rayon-champ`. Et il n'y a **ni biseau, ni carré de cuivre, ni trait
d'encre** sur le papier : la maquette ne montre pas ma planche meublée, elle
montre un rectangle de papier adouci dans une bande tissée.

### Le code : une bande, quatre couches

- `--rw-tissu: var(--charte-espace-5)` — la cote est un pas d'échelle de la
  maison, pas un chiffre de la page, et **c'est elle qui devient la marge
  intérieure du bloc** : `.rw-entete { padding: var(--rw-tissu) }`. La bande et
  la réserve sont la même mesure, donc elles ne peuvent plus diverger.
- `.rw-entete::before`, à `inset: 0` : quatre couches, une par bord — deux
  `repeat-x` calées sur la hauteur (`auto 24px`), deux `repeat-y` calées sur la
  largeur (`24px auto`), aux positions `left top, left bottom, left top,
  right top`. Les deux fichiers sont ceux de la maison :
  `paie-bogolan-haut.webp` à l'horizontale, `bogolan-vertical.webp` à la
  verticale.
- `background-color: var(--charte-tissu)` remplit les quatre coins, là où les
  deux fichiers se rejoignent : pas de trou, pas de couche de raboutage.
- `.rw-entete::after`, à `inset: var(--rw-tissu)` : le champ. `--rw-panneau`,
  rayon `carte`, aucune bordure, aucun `clip-path`, aucune ombre à lui.
- L'ombre dure du kit est sur le calque du tissu, et nulle part ailleurs : la
  plaque est reculée dans l'étoffe, son ombre y serait mangée.
- Les deux `<span className="rw-entete-bandeau">` sont sortis du JSX. Le DOM du
  bloc ne porte plus qu'un enfant, `.rw-entete-corps` — la loi le vérifie, le
  tissu n'est pas un objet.

Sont tombés avec la planche meublée : `--rw-coupe`, `--rw-billet`,
`--rw-coings`, `--rw-coing`, `--rw-filetage`, `--rw-chute`, `--rw-agrafe`,
`--rw-tissu-bas`. Zéro occurrence de chacun dans la feuille, vérifié au texte.

### Pourquoi pas `border-image`, ni l'astuce de la fiche

`border-image` découpe et **étire** les arêtes : le tissage perdrait son pas
en haut et en bas d'un bloc large, et C4 (« aucun motif étiré ») tombe. Le
quatre-couches ne connaît qu'`auto` sur un axe.

`.e360-tete` peint sa bande en `inset: -24px`, donc hors de son conteneur, et
son conteneur lui donne 28 px de respiration. Ici la gouttière de la coque vaut
`--charte-espace-5`, soit 24 px exactement : déborder de 24 plus les 3 de
l'ombre sortirait de l'écran dès que la page est à 100 %. La bande est donc
**dans** la colonne : le bloc garde `--rw-colonne` (1232 px au max de
`--rw-largeur: 1280px`), et c'est le papier qui rétrécit à 1184 px.

### L'échelle est uniforme, et c'est mesuré

Les deux fichiers font 1536 × 76 et 76 × 1536 (lus dans les en-têtes,
`identify`-confirmés) : ils sont la transposition l'un de l'autre. Ramenés à
24 px d'épaisseur, ils donnent **le même pas de 485 px** dans les deux sens
(1536 × 24 / 76). Sous la bande de 1232 px, le motif tombe 2,5 fois en
horizontale comme en verticale — c'est pour ça que les losanges se suivent
d'un bord à l'autre et que le coin ne se voit pas. Descendre à 18 px, comme la
page Employés, garder 24 : l'uniformité de l'échelle est la seule chose que C4
regarde, et le pas de 24 est celui du kit comme celui de la fiche.

### Ce que la loi refuse, et par quoi elle l'a prouvé

Section 12 réécrite, sept cas : le bloc est cerclé et non souligné (la cage ne
peint rien, ne rogne rien, `isolation` posée, le DOM sans span) ; quatre côtés
et pas deux (les quatre couches, deux par fichier, `inset: 0`) ; le motif est
celui de la maison à échelle uniforme (les deux fichiers cités aussi dans
`Employee360.css`, chaque couche bornée à `--rw-tissu` sur un axe, jamais de
`100%`) ; les quatre coins pleins et une seule ombre, à flou zéro ; la plaque
est du papier reculé, sans coupe ni clou ni trait, et les jetons de la planche
ont disparu (six aiguilles dans la loi, huit au texte) ; le cartouche reste
entouré et la souche tombe à 760 px ;
et **l'étoffe ne maigrit pas** sur petit écran — aucune règle du média-query ne
redescend `--rw-tissu`, c'est le rythme du papier qui se serre à `espace-3`.
Section 13 réduite au rail (trois cas). La liste des ombres de la section 11 a
perdu son unique exception : les trois traits internes du cadre billet
n'existant plus, elle n'admet plus que le jeton dur et les anneaux `inset`.

Dix-neuf mutations jouées, **dix-neuf rougies** : le tour qui redevient deux
bandes, les deux liserés peints du même côté, l'étoffe étirée pour remplir, la
cote écrite en chiffre, le tissu qui cesse d'être la marge intérieure, la
plaque qui n'est plus reculée, les coins qui se vident, l'ombre dure qui saute,
une seconde ombre avec du flou, la cage qui rogne, une bordure d'encre sur le
papier, la planche meublée qui revient, les calques qui se retournent, le
tissu qui maigrit à 760 px, un span de bandeau qui revient dans le DOM, et les
quatre verrous du rail. La première passe du harnais en comptait une de moins :
« l'ombre dure saute » n'avait pas d'effet (l'ancre ne tombait pas là où je
croyais) et restait verte pour la mauvaise raison — le harnais refuse
désormais toute mutation qui ne change rien au fichier.

### Compteurs

`npx vitest run src/services/__tests__/remunerations` : 88/88 (57 + 31). Suite
complète, variables Supabase posées : 202 fichiers, 2914 tests passés. Le
compte de la veille était 2913 sur 202 fichiers : les deux n'ont pas été pris
sur la même base (#405 est entré depuis, et il a ajouté `paieWorkspaceDom` et
`planningPayslips` en rebrassant d'autres fichiers de test) — je ne peux pas
attribuer le +1 à une pièce précise sans rejouer la suite sur l'autre base, et
je ne le fais pas. Ce qui tient des deux côtés : la page, 88 (57 + 31), et le
vert. `npm run build` : 18,9 s. `npm run eslint` sur `src` : 0 erreur, 6
avertissements, ceux de la base. `npm run charte` : 119 ombres floues / 307
rayons sur 17 valeurs, et le rapport avant/après est identique au caractère
près — le diff des deux sorties est vide. La feuille fait 2548 lignes (2582
avant), aucune au-delà de 100 caractères, 317 règles parsees par postcss (320
avant : les trois règles du bandeau sont tombées, les deux de base et celle du
seuil de 760 px), 8 `box-shadow` dont 0 avec un flou et 6 le jeton dur du kit,
2 `url()` seulement, zéro couleur en dur, zéro `rgba()`, zéro jeton `--rw-*`
orphelin ou non consommé.

### Ce qui n'a pas été fait

La silhouette rognée de la passe dernière n'est pas conservée : la maquette
montre un champ aux coins arrondis, mesuré ci-dessus, et je l'ai codée telle
quelle. Si les huit onglets de 14 px et les carrés de cuivre doivent revenir
**sous** l'étoffe, c'est un polygone et une loi, pas une reprise.

Toujours aucune vérification à l'œil — pas de Chromium ni de Playwright dans
le sandbox : la cote de 24 px, les rayons de 6 et 8, le pas de 485 px et les
2,5 motifs sous la colonne sont calculés depuis les fichiers et la maquette,
pas mesurés sur écran. Et l'admin non-`super_admin` voit encore la marque de la
maison dans le rail, pas un bandeau d'entreprises.

## Le bloc est collé en haut, le reste défile dessous (8 novembre 2026)

La maquette demandée, énoncée en une phrase : « je veux que tu maintiennes ce
bloc-là fixe et tout le reste va glisser dedans quand je scrolle — le même
comportement en desktop, mobile et tablette ». Le bloc, c'est la cage d'étoffe
de §précédent : flèche de retour, cartouche, « CONTRATS ET MONTANTS /
Rémunérations. », le sélecteur d'entreprise et le bouton de reprise. Le
« dedans » du langage courant est le « dessous » du navigateur : les cartes
passent sous le bloc, elles n'entrent pas dans sa boîte.

### Le mot, et pas les trois à côté

`position: sticky; top: 0` — un seul mot, aucun JS. Les quatre autres chemins,
et pourquoi aucun :

- `position: fixed` : il sortirait le bloc du flot, donc il faudrait lui
  rendre sa hauteur en `padding-top` sur la page, la remesurer au
  redimensionnement et au changement d'orientation, et le geste de retour du
  navigateur ne retrouverait plus sa position. La maison l'a déjà écrit noir
  sur blanc à `.pw-fixe` (PaieWorkspace.css, l. 413-421) ; je ne réécris pas
  l'argument, je le reprends.
- un habillage `<div class="rw-collant">` autour de l'en-tête : une boîte
  défilante de plus, et c'est exactement la famille de carcans qui tue
  `sticky` (voir la loi « aucun carcan » ci-dessous).
- `scroll-snap` : ça aimante le défilement à des arrêts, ça ne colle pas un
  bandeau.
- un `IntersectionObserver` qui pose une classe au passage : trois lignes de
  mesure qui se déracinent au redimensionnement, pour un résultat que le CSS
  donne déjà.

`top: 0`, et pas le `top: 8px` du `.paie-topbar` ni le `top: 10px` du rail :
tout centimètre laissé entre le bord de l'écran et le bloc est un couloir où
le contenu continue de courir. Posé à zéro, le haut du tissu fait le bord de
l'écran.

### La règle, telle qu'elle est écrite

```css
.rw-entete {
  position: sticky;
  top: 0;
  z-index: 20;
  isolation: isolate;
  display: block;
  width: var(--rw-colonne);
  margin: var(--charte-espace-5) auto var(--charte-espace-4);
  padding: var(--rw-tissu);
  background-color: var(--rw-nuit);
  border-radius: var(--rw-rayon-bloc);
}
```

`position: relative` est tombé, remplacé — la cage tenait ses deux pseudo-
enfants en absolu, `sticky` les tient de la même façon et fait le collage en
plus. Les cotes (24 px d'étoffe, 5/4 de marges, colonne à
`min(1280 - 48, 100% - 48)`) ne bougent pas d'un pixel, et aucune règle n'a
été ajoutée : 317 règles parsees par postcss, autant qu'avant la passe.

### Les étages, mesurés avant d'être écrits

Un bloc collé est un bloc qui passe devant. J'ai relevé l'échelle déjà en
place dans la feuille plutôt que d'inventer un chiffre :

| pièce | position | étage |
| --- | --- | --- |
| `.rw-mois-voile` (le voile du sélecteur de mois) | `fixed` | 25 |
| `.rw-mois-liste` (son registre) | `absolute` | 30 |
| `.rw-barre` (la barre d'assemblage du bas) | `fixed` | 40 |
| `.rw-voile` (la modale) | `fixed` | 80 |
| `.coque-admin > .sb` (le rail collé de la maison) | `sticky` | 74 |
| `.se-liste--flottante` (le registre d'entreprises du rail) | `fixed` | 78 |

`z-index: 20` met donc le bloc au-dessus de la page qui défile et sous les
quatre choses qui se posent par-dessus elle. Le rail gagne (74) — c'est le bon
sens : un bandeau de page ne doit pas passer devant la barre de commande ; de
toute façon ils ne se recouvrent pas, le rail est une colonne, le bloc est
centré dans la sienne. Le registre d'entreprises est porté hors du rail en
`fixed` à 78, il n'a rien à négocier avec nous.

`isolation: isolate` n'est pas un ornement : sans contexte d'empilement propre,
les deux pseudo-enfants en `z-index` négatif (le tissu à `-2`, la plaque à
`-1`) glisseraient sous le fond de la page. `sticky` en crée un aussi, mais
la raison doit rester lue et pas déduite.

### Le bloc doit peindre, et c'est un arbitrage

Un bloc collé est un cache. Le tissu pose ses quatre bandes mais ne remplit
rien : sans fond sous les coins, le contenu passe VU dans les encoches des
quatre arrondis — six pixels de mouvement dans un coin, ça se voit. La cage
reprend donc `background-color: var(--rw-nuit)` au même `--rw-rayon-bloc`
(6 px) que l'étoffe, un seul rayon pour les deux, sinon les encoches se
redécalent.

Ce fond est la seule couleur que la cage se donne, et le seul écart assumé de
la passe : en haut de page, le fond n'est pas plat mais lavé
(`linear-gradient(var(--rw-lavis), transparent 30vh)`, `--rw-lavis` = 10 % de
cuivre dans `--rw-nuit`). Le plat du bloc diffère donc de son environnement
tant que le lavis n'a pas défilé, et l'égale au-delà de 30 vh — là où le bloc
vit collé. Retirer le fond pour retrouver le lavis rendrait les encoches
transparentes : c'est le fond qui gagne, et l'écart est écrit dans le
commentaire de la règle.

### Les trois tailles, sans opt-out

C'est le point où la maison et la demande divergent. `.pw-fixe`, le bandeau
collant de l'espace paie, se décollait lui-même sous `@media` (l. 459 :
`position: static`) — sur téléphone le bandeau mangeait la moitié de l'écran.
Ici l'utilisateur a demandé **le même comportement** en desktop, tablette et
mobile, donc aucun palier ne décolle le bloc :

- `@media (max-width: 1180px)` et `(max-width: 520px)` ne touchent pas
  `.rw-entete` ;
- `@media (max-width: 760px)` ne lui retouche que sa `width`
  (`calc(100% - 2 × 12px)`, soit 12 px de gouttière contre 24 px pour la
  colonne) et ses deux marges — ni `position`, ni `top`, ni `z-index`, ni
  `overflow`. Le bloc garde donc 12 px de jeu de chaque côté : il est plus
  large que le contenu qu'il masque, sinon des cartes continueraient de
  courir à sa droite et à sa gauche ;
- le seul autre bloc qui nomme la cage est `@media (prefers-reduced-motion)`,
  et il ne touche que des durées d'animation.

Il n'y a rien à surveiller au redimensionnement, parce qu'il n'y a rien à
calculer : `sticky` vit dans le défilement de la page, la page garde sa
hauteur naturelle.

### Ce qui est puni, et ce qui ne l'est pas

§12 amendée : la cage, qui devait « ne rien peindre », se punit maintenant de
ne peindre QUE le fond du cache — `background-color: var(--rw-nuit)` exigé,
`background(?!-color)|linear-gradient` défendu, pour que le raccourci
`background:` ne passe plus sous la maille.

§14, six lois nouvelles : `sticky` à zéro sans `fixed` et sans `-webkit-` de
rattrapage ; le collage écrit dans la feuille et pas monté (aucune porteuse
ajoutée entre `className="rw-page">` et `<header className="rw-entete">`,
aucun `onScroll` / `addEventListener('scroll')` / `IntersectionObserver` /
`getBoundingClientRect` / `scrollTop` dans la page) ; le cache opaque au
jeton, son rayon lié à celui du bloc ; l'étage 20 sous les quatre superposées
de la page et sous le rail ; l'absence de carcan — `.rw-page/.rw-chargement`,
`.rw-coque`, `.rw-vide`, `.coque-admin`, `.coque-admin-page` vérifiés sans
`overflow`, `contain:`, `filter:`, `transform:`, `will-change` ni hauteur
bornée (le `min-height: 100vh` de la coque est un plancher, il ne coupe rien) ;
et les trois tailles, en balayant **tous** les blocs `@media` de la feuille
accolade par accolade pour vérifier qu'aucun ne redéclare `position`, `top`,
`z-index` ou `overflow` sur `.rw-entete*`.

Au crible à mutations, 17 cas écrits contre la passe, 17 tués, la feuille
rendue à l'identique après chaque coup : `sticky → relative`, `top: 0 → 8px`,
`fixed` à la place, étage effacé, étage à 90, `isolation` retirée, fond du
cache retiré, fond passé au raccourci en dégradé, rayon du cache décalé sur
celui du papier, `-webkit-sticky` de rattrapage ajouté, palier mobile qui
décolle le bloc, palier mobile qui met `.rw-page` en boîte, `.rw-coque` mise
en boîte, gouttière mobile rognée à `width: 100%`, marge haute effacée, et une
`<div className="rw-collant">` ajoutée autour de l'en-tête dans le JSX. Trois
ratés de mesure au passage, corrigés depuis : un `/position|top:/` qui
punissait `margin-top:` — `t` est bien une frontière de mot après l'espace
qui suit le tiret, il a fallu `(?<![-\w])top:` — ; un
`not.toMatch(/background/)` qui se mordait la queue sur le
`background-color` que la même loi exige ; et une ancre
`background-color: var(--rw-nuit)` qui se rencontrait deux fois dans la feuille
(la page et la cage), donc à écrire avec l'accolade fermante du bloc.

Ce qui n'est pas vérifié : rien à l'œil. Toujours pas de Chromium ni de
Playwright dans le sandbox, donc le collage est prouvé par la règle, par les
carcans absents et par les paliers balayés — pas par une capture. Un défilement
réel reste à faire sur poste, avec un mois ouvert pour l'étage et un pouce sur
téléphone pour la gouttière.

## L'image de profil de l'entreprise, aux deux icônes (28 novembre 2026)

La demande, reprise mot pour mot : « fais apparaître l'image profil de
l'entreprise partout où l'icône de l'entreprise apparaît dans cette page ».
Dans la page, l'icône de l'entreprise, c'est `Building2` — l'immeuble
générique de la librairie d'icônes. Il y en avait exactement deux, et ils sont
tombés tous les deux.

### Où ils étaient, ce qui les remplace

| endroit | avant | après |
| --- | --- | --- |
| le cartouche du haut, dans `.rw-entreprise`, à gauche du `select` | `<Building2 size={14}>` | `<PastilleEntreprise taille={20}>` (l. 1045) |
| la rangée « Entreprise » du seuil, avant le nom | `<Building2 size={12}>` | `<PastilleEntreprise taille={16}>` (l. 1107) |

Le rail de la maison, lui, portait déjà le logo : `SelecteurEntreprise` dessine
sa propre pastille (`se-rond se-rond--photo se-rond--logo`) et lit la même
colonne. La page n'avait donc rien à faire dans le rail — elle avait deux
endroits à elle.

Le composant pris est celui de la paie, `components/paie/PastilleEntreprise.jsx`
(75 lignes), importé comme à `FichesPaie` et à `PaieFiscalite` — pas une
réécriture locale. Il ne réinvente rien non plus : l'image passe par
`PhotoSignee`, le chargeur des avatars, donc la signature de l'adresse privée,
le cache d'une adresse par bucket+chemin, et le repli sur erreur sont les mêmes
qu'ailleurs. Deux raisons à le prendre lui plutôt que la pastille du rail : il
se dimensionne par prop (il fallait 20 et 16, pas un rond à la cote du rail),
et son repli se donne par `icone=` — la page garde ainsi SON immeuble quand le
logo manque, au lieu d'inventer une initiale qu'elle n'a jamais montrée.

### Les deux cotes, et pourquoi deux

Le cartouche du haut vit dans une ligne de `--charte-taille-corps` (14 px) à
côté d'un bouton cadre de 36 px (`--rw-cadre`) : 20 px de rond y tiennent le
rang sans manger le cartouche. La rangée du seuil est une ligne de 14 px serrée
à 4 px d'écart (`gap: var(--charte-espace-1)`) : 16 px, pas plus, sinon le rond
déborde l'interligne. C'est écrit à l'appel, dans la page, et aucune règle n'a
été ajoutée à la feuille pour ça : `Remunerations.css` n'est pas touché du tout
(2581 lignes, 317 règles, comme avant la passe), et une loi le punit — la
feuille de la page ne doit pas contenir `paie-pastille-entreprise` ni
`object-fit`, le rond est dessiné par le composant partagé ou il n'est pas.

### Le repli reste l'immeuble

`PastilleEntreprise` retombe sur l'initiale quand il n'y a pas de logo. Ici
`icone={<Building2 size={14|12} aria-hidden="true" />}` lui est passé, donc :
logo présent → image ; logo absent, ou image morte, ou bucket privé qui
refuse de signer → exactement ce que la page montrait hier. Un compte sans
logo d'entreprise ne voit aucune différence, et un logo cassé ne laisse jamais
un rond vide à côté d'un nom. C'est puni au DOM : sans `logo_url` dans la
fixture, la loi exige `svg` présent et `img` absent dans les deux pastilles.

### La colonne, lue deux fois — et c'est le fond du sujet

`logo_url` était déjà sélectionné par `chargerEntreprises` (la liste du rail,
corrigée le 26/11 pour cette raison précise). Mais cette liste est VIDÉE pour
un compte qui n'est pas `super_admin` : la page ne charge alors que sa propre
ligne d'entreprise, dans `chargerTout`. Ajouter la pastille sans ajouter la
colonne à cette requête-là faisait donc apparaître le logo de la rangée du
seuil… seulement pour les super-administrateurs (le cartouche du haut, lui,
est déjà gardé par `estSuperAdmin` et ne se pose pas pour les autres comptes).
La sélection est donc passée de

```js
.select('id, name, code, currency, country_code')
```

à

```js
.select('id, name, code, currency, country_code, logo_url')
```

et une loi compte les `select` qui portent la colonne : exactement deux, dans
l'ordre de la page — la liste du rail, puis l'entreprise ouverte.

### Une source, pas deux : `entrepriseSignee`

Deux objets savaient déjà le nom de l'entreprise : `societes` (la liste du
rail, à jour au clic) et `entreprise` (la ligne posée par `chargerTout`, en
retard d'une requête). Le logo étant dans les deux, les icônes lisent un objet
composé (l. 967) :

```js
const entrepriseSignee = {
  ...(entreprise?.id === selectedEntId ? entreprise : null),
  ...(entrepriseActive || null),
}
```

L'ordre n'est pas un goût : la liste du rail passe par-dessus parce qu'elle
suit le clic. Et le garde `entreprise?.id === selectedEntId` est la pièce
solide — sans lui, entre le clic sur une autre entreprise et la réponse de
`chargerTout`, `entreprise` contient encore l'entreprise qu'on vient de
quitter, et la page signerait l'ancien logo sur le nouveau nom. C'est la
panne du 26/11 (« la réponse en retard écrirait sur la nouvelle ») rejouée à
l'envers, sur une image au lieu d'un chiffre. Un compte non-`super_admin`,
lui, n'a qu'une entreprise et ne passe jamais par ce chemin.

Ce qui n'est PAS unifié : `nomEntreprise` (la ligne de texte) garde sa chaîne
de replis (`societes` → `admin.selectedEnterprise` → `entreprise` → « votre
entreprise »), parce qu'un compte non-`super_admin` n'a pas de `societes` et
que c'est `admin.selectedEnterprise` qui lui donne son nom avant la première
réponse. Le logo, lui, vient une requête plus tard que ce nom-là : pendant ce
temps, la pastille montre l'immeuble. Volontaire — une initiale ou un rond
qui apparaît à la deuxième requête est un clin d'œil, pas une panne.

### Ce qui est puni, et comment

Quatre lois de sourçage en §15 du fichier `remunerationsBogolan.test.jsx` :
deux pastilles et pas une troisième, chacune avec `entrepriseSignee`, avec son
`icone=` de repli, sans `alt` inventé (l'image est décorative, le nom est écrit
à côté) et à sa cote ; les deux `select` qui portent `logo_url` ; la
composition et son garde ; l'interdiction de se refaire un chargeur
(`createSignedUrl`, `adresseSignee`, `PhotoSignee`, et pas de
`function PastilleEntreprise` local).

Quatre lois de RENDU en §4 de `remunerationsCout.test.jsx`, jouées sur le DOM
monté en jsdom et non sur le texte de la source : deux
`.paie-pastille-entreprise` dans la page, une dans `.rw-entreprise`, une dans
`.rw-seuil-item`, aux tailles 20/16 ; le `src` des deux `<img>` égal à l'adresse
de la fixture, l'`alt` vide ; et, `logo_url` retiré, l'`svg` de repli présent
avec `img` absent. Le rendu est la loi qui compte ici : un composant importé
qui ne monte pas ne signe rien, et le texte de la source ne le dit pas.

Au crible à mutations, 12 cas écrits sur la page, 12 tués, fichier rendu à
l'identique après chaque coup : chaque pastille retirée séparément, les deux à
la même cote, la pastille branchée sur `entreprise` au lieu de
`entrepriseSignee`, le repli `icone=` supprimé (retour de l'initiale), la
colonne lâchée par l'une puis l'autre requête, le garde d'identifiant retiré,
la superposition retournée, un `alt` ajouté, un `adresseSignee` réimporté, une
troisième pastille glissée dans la rangée « Devise ». Cinq des douze — les deux
retraits de pastille, la cote unique, le repli devenu initiale, la troisième
pastille — sont tombés sur les lois de DOM, pas seulement sur le texte de la
source : c'est ce qu'on cherchait.

### Mesures

`npx vitest run src/services/__tests__/remunerations` : 102/102 (67 + 35),
soit 8 tests de plus que la veille (63 + 31). Suite complète : 3068/3068 sur
216 fichiers — la base au point de branche n'a pas été recomptée, le dépôt a
reçu trois autres PR depuis, je n'attribue donc que les 8 miens.
`npm run build` : 22,30 s, vert. `npx eslint --config eslint.gate.config.js
src` : 0 erreur, 6 avertissements, ceux de la base. `npm run charte` : rapport
identique au caractère près sur deux exécutions, verdict de la maison
(inchangé : aucune feuille de style touchée).

### Non fait

Toujours pas de Chromium dans le sandbox : le `src` de l'image est vérifié en
DOM, pas à l'œil — un vrai rendu d'un logo 1:1 dans un rond de 16 px sur le
fond `--rw-panneau`, personne ne l'a regardé. Un liseré autour du rond
(1 px de `--rw-ligne`) se discuterait pour les logos blancs qui se perdent
sur le panneau : il appartient au composant partagé, pas à la feuille de la
page, et je ne l'ai pas posé.

## Le visage du salarié se pose dans le sceau (28 novembre 2026)

La demande, au lendemain de la pastille d'entreprise : « fais apparaître
l'image profil des employés partout où l'icône profil apparait dans cette
page ».

### L'inventaire, d'abord

Dans cette page, l'icône de profil du salarié, c'est le **sceau** :
`BogolanMedaillonSvg` de 42 px et ses initiales posées dessus. Il y en a un
par ligne, une fois dans la vue Contrats, une fois dans la vue Coût — deux
sceaux, et rien d'autre. Trois choses ont été regardées et laissées :
l'`Users` de 12 px de la rangée « Salariés actifs » (il compte, il n'identifie
personne) ; les coches de la modale « Reprendre les valeurs » (une case à
cocher n'est pas une figure de personne) ; et le cartouche d'étoffe de
l'en-tête, qui est la marque de la page, pas une fiche de salarié.

### Le sceau n'est pas remplacé, il est occupé

Le visage se pose DANS l'œil du sceau, et les initiales restent dessous — pas
à côté, pas en concurrence : `PhotoSignee` ne montre l'image que lorsqu'elle
est réellement peinte, et rend le repli sur adresse absente, refusée ou image
morte. C'est la leçon du 26/11, écrite dans son en-tête, qui est rejouée ici
sur les salariés.

La cote est mesurée sur le dessin, pas choisie. Le sceau fait 42 px
(`--rw-sceau`) et le SVG est gravé dans un `viewBox` de 46 — échelle 0,913 :

| pièce du sceau | dans le `viewBox` | dans la boîte de 42 px |
| --- | --- | --- |
| cadre arrondi | `x 0,75`, `rx 9` | à ~0,7 px du bord |
| pointe du losange de réserve | 13,5 unités du centre | 12,3 px |
| centre des quatre points de la croix | 17,6 unités | 16,1 px (r 1,25 → 1,1 px) |

Le premier jet posait le visage à 4 px de retrait : 34 px de diamètre, rayon
17 px — soit plus que les 16,1 px des points de la croix. Le visage
bouchait tout l'intérieur du sceau, cadre à peine visible, et la ligne
ressemblait à une photo cerclée de cuivre. La cote retenue est donc
`calc(var(--rw-sceau) - 2 * var(--charte-espace-2))`, soit **26 px**, rayon
13 px : un anneau de 3,1 px où le cadre et les quatre points se lisent
toujours. La réserve losangée, elle, est recouverte — exactement comme les
initiales la recouvraient déjà, puisque le losange est à 12,3 px du centre et
les lettres posées `inset: 0`.

Ronde et pas losange : une photo tronquée en pointe ne se lit pas à cette
taille, et la figure de personne est ronde partout dans l'application (rail,
absences, heures supplémentaires, et la pastille d'entreprise posée la veille).
Elle ne peint rien non plus : ni fond, ni liseré, ni ombre — l'assiette, c'est
le tissu du sceau, avec ou sans visage.

Enfin, la photo est centrée par `inset: 0` + `margin: auto` avec une largeur
écrite, et non par les quatre bornes seules : sur un élément remplacé comme
`img`, `left` ET `right` posés avec `width: auto` ne l'étirent pas, la cote
intrinsèque gagne et la borne de droite est abandonnée. La même écriture tient
pour le `<span>` du repli, qui n'est pas un élément remplacé.

### D'où vient l'image, et comment elle rejoint la ligne de coût

`employees.photo_url`, sélectionnée par l'unique requête de salariés de la page
(`chargerTout`) — celle qui nourrit les DEUX vues. La vue Contrats lit la
photo sur la ligne du salarié (`url={e.photo_url}`) ; la vue Coût, elle, ne
reçoit de `encheck_cout_periode` qu'un nom, un matricule et un `employe_id` :
elle passe par une carte `photoParId`, indexée sur cette clé, bornée aux
salariés qui ont une photo (`filter(e => e.photo_url)`) et recalculée sur
`[employes]`. Un `get` qui manque rend `undefined`, et `PhotoSignee` rend le
repli — jamais un `<img>` sans `src`.

### La panne que la passe a faite, et qui est devenue une loi

Le mémo `photoParId` avait été posé près des deux sceaux qui le lisent — donc
SOUS la sortie conditionnelle sur l'écran de chargement. React compte ses
hooks par position : au second render il en trouvait un de plus que au premier,
« Rendered more hooks than during the previous render », et la page ne montait
plus — dix-huit tests du fichier de rendu rougeoyaient. Ce que je retiens :
**la grille de lint ne l'a pas dit.** `react-hooks/rules-of-hooks` est bien en
`error` dans `eslint.gate.config.js` (l. 30), et il est resté muet sur un hook
placé après un `return` conditionnel ; c'est le montage en jsdom qui a crié.
La règle est donc écrite en loi (§16) : le mémo vit avant la sortie, et AUCUN
hook n'apparaît entre la sortie et le `return` de la page — la loi compte le
corps de la page, pas seulement le cas de la passe.

### Ce que la passe d'hier défendait de trop

Deux lois écrites la veille punitaient des choses que la page doit faire
aujourd'hui, et elles ont été resserrées sur leur objet réel plutôt
que retirées :

- « la page ne se refait pas un chargeur d'image » interdisait le mot
  `PhotoSignee` dans la page. Ce qui était défendu, c'était de REFAIRE le
  chargeur (`createSignedUrl`, `adresseSignee(`) — pas de l'emprunter. La loi
  exige maintenant que la page L'IMPORTE, et qu'il n'y ait qu'un chemin
  d'image dans la page : le sceau du salarié et la pastille de l'entreprise
  passent par le même composant.
- « la feuille ne re-stylle pas le rond » défendait `object-fit` dans toute la
  feuille, alors que son objet était le rond de l'entreprise. Elle ne porte
  plus que sur `paie-pastille-entreprise` : le sceau, lui, est un objet de la
  page, donc sa géométrie se cadre dans sa feuille — et c'est puni en sens
  inverse (§16 exige la cote déduite, le rayon, `object-fit`, le
  `pointer-events: none`, et interdit fond, liseré, `overflow` et `clip-path`
  sur le sceau).

### Ce que la base réelle montre

Compté en lecture seule sur le projet (les chiffres bougent, ils datent du
28/11) : 16 salariés, 14 actifs, **2 photographiés**. Sur l'entreprise du
ruban, EN-NOUS : 6 actifs dont 2 avec photo — deux visages sur la page, quatre
sceaux qui gardent leurs initiales ; sur Pharmacie Blanche Gomes, 6 actifs et
aucune photo, la page est identique à la veille. Et les deux seules adresses
réelles sont les deux formes que le chargeur doit connaître : l'une est un
`data:image/svg+xml` (une fiche de recette), l'autre une adresse
`/storage/v1/object/public/photos/…` — `PhotoSignee` court-circuite l'une et
l'autre sans aller quémander une signature. Même mesure pour hier :
`enterprises.logo_url` est plein pour EN-NOUS et la Pharmacie, VIDE pour
l'Épicerie du Port — le repli sur l'immeuble n'est pas un ornement, il sert.

### Ce qui est puni

§16 (4 lois de source) : deux sceaux, deux visages, pas de troisième figure
(`alt=""`, `aria-hidden`, `decoding="async"`, repli explicite aux deux initiales
de la page, sceau jamais rogné ni mis en boîte ; la
colonne portée par la seule requête qui lit les salariés, et la jointure écrite
sur `l.employe_id` ; la cote de l'œil déduite du sceau, ronde, `object-fit`,
sans fond ; et l'ordre des hooks. La liste de props comptait ce jour-là un
`loading="lazy"` en plus, tenu pour un mérite : c'est de là qu'est venue la
panne du 29/11, chap. 23 — la même loi punit maintenant sa présence aux deux
sceaux, et l'écrit dans l'en-tête du chargeur.
§5 du fichier de rendu (3 lois sur le DOM
monté) : dans la vue Contrats, le visage de celui qui a une photo et les deux
lettres de celle qui n'en a pas — sans photo, **aucun** `<img>` et non un
`src` vide — ; dans la vue Coût, exactement un visage sur deux lignes, ce qui
prouve le rapprochement par l'identifiant du RPC ; un sceau par ligne, un
losange toujours dessiné dessous, une seule lecture de salariés dans la page.

Au crible à mutations, 18 cas écrits, **18 tués**, les deux fichiers rendus à
l'identique après chaque coup : visage retiré d'un sceau, `loading` sauté —
seul des dix-huit dont l'oracle pointait à l'envers, payé le lendemain, voir
chap. 23 —, `alt` écrit, repli disparu (les trois joués aux deux sceaux à la fois), colonne
lâchée, jointure sur `l.id`, carte prenant tous les salariés, carte figée à
`[]`, mémo descendu sous la sortie de chargement, chargeur réécrit à la main,
visage à 100 % du sceau, retrait ramené à 4 px, rayon carré, `object-fit` sauté,
centrage aux quatre bornes, fond posé sur le visage, `overflow: hidden` sur le
sceau, `pointer-events: auto`. Les huit cas écrits sur la
page font tous rougeoier une loi de DOM (§5), et pas seulement le texte de la
source ; les dix cas de la feuille tombent sur la loi de géométrie.

### Mesures

`npx vitest run src/services/__tests__/remunerations` : 109/109 (71 + 38),
soit +7 sur la veille (67 + 35) — 4 en §16, 3 en §5. Suite complète :
3076/3076 sur 216 fichiers (le compte global n'est pas attribuable à la seule
passe : la PR #417 est entrée sur `main` entre les deux mesures).
`npm run build` : 14,49 s. `npx eslint --config eslint.gate.config.js src` :
0 erreur, 6 avertissements, ceux de la base. `npm run charte` : rapport
identique au caractère près sur deux exécutions ; la feuille fait 2617 lignes
comptées par `grep -c ''` (2581 avant la passe, même instrument), **une règle
de plus, 318**, aucune ligne au-delà de 100
caractères, 8 `box-shadow` (inchangé), 2 `url()`, zéro `rgba()`, zéro couleur
en dur, 39 jetons `--rw-*` tous consommés — `--rw-rond` sert deux fois
désormais.

### Non fait

Aucun regard : `jsdom` ne peint pas. Le cadrage d'une photo de visage à 26 px
dans un rond, la ligne de 3 px où le sceau respire encore, et le rendu d'un
`data:image/svg+xml` de 295 caractères restent à vérifier sur écran. Et si la
page doit finir par montrer une figure aussi dans la modale « Reprendre les
valeurs », c'est un troisième sceau — donc une autre cote, une autre loi, pas
une reprise.

## La photo ne venait pas : le cache mange le lazy (29 novembre 2026)

Une capture, une phrase : une ligne du ruban avec son sceau portant **HB** à la
place du visage, et « On ne voit pas l'image de profil de chaque employé qui en
a ». Hippo BIYOKILA a bien une photo en base ; la veille, la page avait été
écrite pour l'afficher. Le code était bon, la base était bonne — et rien ne se
peignait.

### Ce que la base a dit, avant de toucher au code

Trois lectures en requêtes seules, dans l'ordre, pour savoir si c'était
l'adresse, le bucket ou la balise :

| ce qu'on craignait | la mesure | verdict |
| --- | --- | --- |
| la colonne n'est pas remontée jusqu'à la page | `photo_url` en bout de `.select(...)` (l. 351), carte `photoParId` l. 757, deux `url={…}` l. 1403 / 2036 | câblage intact |
| l'adresse est tronquée | `ENN-0002-1792617256342.png`, **99 caractères**, sous `…/storage/v1/object/public/photos/…` | adresse complète |
| le bucket `photos` est privé, l'URL publique fait 403 | `public = true`, et l'objet **est** dans le bucket (14 objets) | passe-part, signature inutile |

Restait la balise. Et c'est elle.

### Le mécanisme, en trois lignes

`PhotoSignee` n'affiche l'image que quand elle est **peinte** : tant que
`onLoad` n'a pas répondu, son image est tenue en `display: none` — c'est la
garantie du 26/11, « jamais de rond vide ». Une image marquée
`loading="lazy"` **dans un sous-arbre caché n'est jamais demandée**. Donc
`onLoad` ne vient pas, donc le cache ne se lève pas, donc la page conclut
« photo absente » et rend les initiales — pour toujours, sans une erreur
réseau, sans un 404, sans rien dans la console.

La page, hier, demandait le lazy **au bon endroit pour la mauvaise raison** : « une
ligne par salarié, parfois cent : le visuel ne se charge que quand la ligne
approche du bord de l'écran ». Sur une `<img>` ordinaire, c'est exactement ça.
Sur une `<img>` que le chargeur retire du rendu, reporter la demande ferme la
seule porte par laquelle la demande pouvait passer.

### Pourquoi personne ne l'avait vu

Trois hasards se sont ligués :

- **Le `data:` de la fiche de recette** (`RECETTE A`, un SVG de 295 caractères
  en dur dans la colonne) traverse le chargeur par la branche de court-circuit :
  il ne quémande aucune signature. On en a conclu trop vite que la page
  « affichait bien un visage sur la base de recette ». Cette croyance n'a pas
  été remesurée seule, et il faut l'écrire comme ce qu'elle est : la raison la
  plus plausible pour laquelle un attribut faux a survécu à une passe criblée.
- **`jsdom` ne peint pas.** Les deux montages réels vérifient `src`, `alt`, la
  présence de l'image et du losange — mais `onLoad` n'y sonne jamais, alors le
  `loading` ne changeait rien à l'affaire. La loi de rendu passait sur un DOM
  qui n'aurait pas pu montrer la panne.
- **La loi de source la récompensait.** Le §16 exigeait
  `expect(s).toContain('loading="lazy"')` : retirer l'attribut faisait rougir
  un test. Le crible à mutations avait même joué ce coup, « `loading` sauté »,
  et l'avait « tué » — c'est le seul des dix-huit dont l'oracle pointait à
  l'envers. Une loi d'homogénéité (« une image de liste se charge en lazy, comme
  ailleurs ») qui énonce l'inverse du vrai n'est pas une absence de test : c'est
  un test qui ment.

### La correction, et où elle devait être écrite

Retirer `loading` des deux sceaux, et de rien d'autre. La raison est écrite là
où elle sert, deux fois :

- **à l'appel**, dans le commentaire du sceau de la vue Contrats : *ET SURTOUT
  PAS `loading` ici, ni dans aucun `PhotoSignee`* — parce que c'est au moment
  de retoucher la page que l'attribut revient, par mimétisme avec les autres
  images du projet (`BulletinChamps`, `EmpreinteDigitale`,
  `EmployeeProfilePhoto` le portent tous, et eux n'ont pas de cache).
- **dans l'en-tête du chargeur**, en face du protocole : treize lignes qui
  disent à l'appelant ce que le cache interdit. Le texte du cache n'en comptait
  que trois, et `PhotoSignee.jsx` n'était lu par AUCUN test — le §16 est le
  premier à le relire. Les autres appels du projet, eux, n'avaient jamais
  demandé le lazy : c'est la page seule qui l'avait ajouté.
- `decoding="async"` reste : il reporte le **décodage** d'une image déjà
  téléchargée, pas la demande. La nuance est écrite dans les deux fichiers,
  sinon la prochaine passe « d'optimisation » remet le `loading` et enlève le
  `decoding`, les deux d'un geste, sous le même mot.

### Ce qui est puni maintenant

Loi de source (§16), aux **deux** sceaux : `not.toMatch(/\sloading=["{]/)` —
seule la balise est en cause. La loi est rejouée sur la page entière (aucun
attribut `loading` nulle part dans `Remunerations.jsx`) : un report de demande
ailleurs dans la page retomberait sur le même cache. Et un `toContain` sur la
page ne suffisait pas, **la loi est lue à deux fichiers** : elle relit la
source de `PhotoSignee.jsx` et exige que le cache y soit encore
`display: peinte ? undefined : 'none'`. Si quelqu'un remplace ce cache par un
`visibility: hidden` — ce qui rendrait le lazy de nouveau possible — la loi
tombe en même temps et dit pourquoi, au lieu de défendre une interdiction devenue
sans objet.

Loi de rendu (§5), sur l'image réellement montée : `getAttribute('loading')` est
`null` **et** `style.display` vaut `'none'`. La seconde assertion est la
signature du mécanisme : elle prouve que le composant monté est bien celui qui
cache, sinon la première ne veut plus rien dire.

Crible, deux coups rejoués sur l'arbre final : `loading="lazy"` remis aux deux
sceaux → **2 lois rouges**, une de source et une de rendu ; cache du chargeur
passé à `visibility` → **la loi de couple rouge**, avec son mode d'emploi. Les
deux fichiers rendus à l'identique après chaque coup.

### Une loi qui criait sur du vide, corrigée dans la foulée

Le premier jet de la loi page entière écrivait `/\bloading=/`. Il levait la
chaîne `loading="lazy"` du commentaire que je venais d'écrire pour interdire
l'attribut : la loi passait son temps à se plaindre de sa propre documentation,
et elle rougissait avant toute mutation. D'où l'espace exigé avant l'attribut.
La leçon dépasse ce fichier : **un crible sur du texte source qui ne distingue
pas le code du commentaire finit amendé pour se taire**, et une loi amendée
pour se taire ne prévient plus jamais — c'est exactement comment la première
loi du `loading` a survécu à une panne qu'elle récompensait.

### Mesures

`npx vitest run src/services/__tests__/remunerations` : **109/109** (71 + 38),
le même compte que la veille — la passe n'a ajouté **aucune** loi, elle en a
retourné une et en a couplé deux. Suite complète : **3076/3076** sur 216
fichiers (180,8 s). `npm run build` : ✓ 17,38 s. `npx eslint --config
eslint.gate.config.js src` : 0 erreur, 6 avertissements, ceux de la base.
`npm run charte` : rapport identique au caractère près sur deux exécutions
(NON CONFORME à la baseline, 318 règles, 307 rayons — comme la veille). Page :
2290 lignes (`grep -c ''`, 2270 avant, tout en commentaires) ;
`PhotoSignee.jsx` : 134 (120) ; feuille CSS : **2617, intouchée** — la panne
n'était pas dans la cote, et elle ne se réglait donc pas là.

### Non fait

Toujours aucun regard sur écran : `jsdom` ne peint pas, et cette fois c'est lui
qui avait masqué la panne. Reste à vérifier sur la page, à l'œil : que le
visage de BIYOKILA remplace bien les deux lettres dans un sceau de 42 px ; que
la croix du sceau se lit toujours autour (l'anneau de 3,1 px calculé au
chap. 22 n'a jamais été vu peint avec une photo dedans) ; et que les lignes sans
photo gardent leurs initiales. Deuxième laisse ouverte, écrite pour ne pas être
perdue : si le lazy redevient nécessaire ici (cent lignes, photos de 2 Mo), ce
n'est pas l'attribut qu'il faudra retirer mais le cache du chargeur qu'il
faudra repenser — `visibility`, ou une requête préalable ; la loi de couple est
là pour le rappeler. Enfin, `loading` n'est pas devenu interdit dans
l'application : il est interdit **sur une image que quelque chose cache jusqu'à
sa peinture**. Les trois autres porteurs du projet n'ont pas de cache et n'ont
rien à changer.
