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
