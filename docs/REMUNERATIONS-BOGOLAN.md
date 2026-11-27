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
