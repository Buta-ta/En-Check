# Heures supplémentaires — correction de la charte En-Check

> ⚠️ Les « Corrections » de cette première page datent de l'alignement sur la
> palette de PaieAfroTech — Segoe UI conservée, ivoire `#FAF6F0`, titre de
> contenu à 27 px. Elles sont **remplacées** le 26/12/2026 par la loi des jetons
> : lire en bas de fichier « Peau du 26/12/2026 », qui reprend chaque valeur et
> dit laquelle est tombée. Les lignes anciennes restent pour la trace de ce qui
> a été décidé, pas pour la valeur en cours.

## Retour utilisateur
Titres trop imposants, charte insuffisamment cohérente avec Pointages et Paie & Fiscalité, bandeau supérieur trop haut et flou.

## Corrections
- Suppression des règles génériques `.ot-page h1/h2` : elles agrandissaient aussi le titre du composant partagé PageHeader. Styles désormais limités au titre de contenu et aux titres de panneaux.
- En-tête : 20 px desktop / 17 px mobile, graisse et espacement inspirés de Pointages. Titre de contenu : 27 px / 24 px, comme PaieWorkspace. Titres des panneaux : 16 px. Police Segoe UI conservée, corps de page 14 px.
- Fonds et textes alignés sur la palette de PaieAfroTech : ivoire #FAF6F0, blanc, encre #231911, texte secondaire #4E3D2E ; sombre #15110E / #1D1713 / #F5F2EB. Indigo et cuivre conservés comme accents du motif validé.
- En-tête commun correctement thémé sur cette page uniquement ; aucun changement du composant PageHeader partagé.
- Espacements principaux 22 px / 3,4 % desktop et 16 px mobile ; boutons plus compacts.
- Motif aso-oke redessiné en SVG original, sans bitmap intégré ni filtre floutant. Conserve l’inspiration indigo/cuivre/ivoire en bandes tissées, pas une reproduction pixel à pixel de la texture photographique initiale.
- Bandeau supérieur 40 px desktop / 32 px mobile au lieu de 76 / 60. Bas 24 / 20 px. Tailles spécifiques à aso-oke : autres pages inchangées. La barre intelligente emploie aussi le SVG via la carte centrale.

## Vérification
- 697 tests / 69 fichiers réussis, dont 3 nouveaux tests de non-régression de charte.
- Build Vite/PWA réussi ; avertissement existant sur la taille des bundles.
- Porte ESLint : zéro erreur, un warning préexistant EnterpriseSelectorModal.
- Chromium : vrais composants PageHeader, PageCulturalBand et OvertimeDashboard montés avec données synthétiques ; clair/sombre × 320, 390, 768 et 1440 px. Tailles calculées du header, du titre, des panneaux et du bandeau vérifiées ; SVG utilisé ; recherche fonctionnelle ; aucun débordement horizontal ni erreur JS/HTTP. Captures inspectées.
- Pas de session authentifiée de production ; aucune modification des calculs, requêtes, règles métier, permissions ou données. Aucun déploiement de production.

---

## Peau du 26/12/2026 — « brut adouci, double feutre », raccourcis et thème dehors

**La demande, telle quelle.** « Maintenant passons à la page "heures
supplémentaires". Cette page on va la garder cette telle quelle mais on va
seulement appliquer le style brut adouci, double feutre. Enlever les raccourcis,
le bouton sombre/clair. Retravaille un peu les formes de certains blocs. »

Le verrou de ce chapitre est donc dans « **garder telle quelle** » : aucun bloc
déplacé, aucun libellé réécrit, aucun `data-testid` touché, aucun ordre de
tableau, aucune requête, aucun calcul de majoration modifié. Ce qui a bougé est
de l'encre et de la géométrie — et deux suppressions demandées nommément.

### Ce qui est enlevé, et où c'était écrit

| objet | avant | après |
| --- | --- | --- |
| `OvertimeNavigation` (quatre raccourcis Pointages / Planning / Employés / Paie) | composant de 30 lignes monté sous le bandeau ; `16px` de `padding-top` + `min-height: 42px` par puce = **58 px** de hauteur, quatre `href` codés en dur dans le composant | **supprimé** — le composant n'existe plus, il ne dort pas dans un fichier |
| Bouton soleil/lune de la page | `<button onClick={toggleTheme}>` + `useTheme()` dans la page, aria-label « Passer en mode sombre/clair » | **supprimé**. Le MÉCANISME reste : `ThemeProvider` écrit toujours `encheck.theme` et `documentElement.dataset.theme` (aiguille dédiée dans `overtimeExperience.test.jsx`) ; seul le DEUXIÈME bouton de la page est parti |
| `.ot-dark` et son bloc d'hex par classe | 27 hex dans la feuille dont sept pour le seul thème sombre de la page | **zéro occurrence**. Le thème se pose à la racine (`[data-theme='dark']`, `tokens.css`) ; une classe par composant qui re-déclare sept hex ne PEUT pas battre la racine — deux thèmes l'un sur l'autre, c'est celui qui gagne par accident |
| Le skin en ligne | `const pageStyles` (14 clés) + **56** attributions `style={…}` dans le JSX, dont 5 hex, 9 `rgba(…)`, un `linear-gradient(135deg,#F97316,#EA580C)` et deux `borderRadius` | **zéro** `style={…}` et zéro hex dans la page (816 lignes au lieu de 1041). Ce n'est pas une coquetterie : `npm run charte` ne balaie QUE les fichiers `.css`, donc tout ce qui vivait en ligne était invisible au contrôle |

### La loi de la peau, mesurée sur la feuille

628 lignes avant, 1329 après — mais 190 blocs avant, 175 après, et **56
commentaires** : la prose est la raison des cotes, pas un habillage. Les
déclarations passent de 502 à 653, parce que le tiroir y a emménagé et parce
qu'une attribution en ligne ne se contrôle pas.

| valeur | avant | après |
| --- | --- | --- |
| couleurs en dur | 27 hex + 1 `rgba` | **0** hors de la couche d'alias — et la couche d'alias elle-même est à zéro : elle ne fait que dériver |
| police | `'Segoe UI', Tahoma, Geneva, Verdana` + `'SF Mono','Fira Code'` dans les champs | `var(--charte-police)` / `var(--charte-mono)`. Segoe UI n'est chargée par aucun `public/fonts/` : l'écrire, c'était promettre un rendu qu'aucun poste de l'équipe ne verrait |
| tailles d'écriture | **13** valeurs (10, 11, 12, 13, 14, 16, 17, 20, 22, 24, 25, 27, 30) | **4 jetons** : titre 20 · corps 14 · micro 11 · bouton 9,5 (C8) |
| graisses | 400 · **650** · 700 · **800** (+740/760 en ligne) | 400 · 600 · 700 — les trois seuls poids self-hostis |
| rayons | 3 · 6 · 7 · 8 · 9 · 10 · 12 · `50%` | `0` et les jetons champ 6 · carte 8 · badge 11 · tuile 12 · pilule 999. `50%` n'existe pas au contrôle C10 (il ne lit que des px) : l'avatar passe au JETON pilule, même rendu, loi visible |
| traits | **23** `border: 1px` | 24 contours de `var(--ot-trait)` = **2 px** d'encre, 12 règles pleines de `var(--ot-regle)` = **3 px**, 0 filet de 1 |
| ombres | `0 2px 5px #0002`, `0 2px 6px #00000004`, `backdrop-filter: blur(4px)` | 7 × `var(--charte-ombre-dure)` (`3px 3px 0 0`, flou zéro), voile `var(--charte-modale-voile)`, **0 flou** |
| dégradés | 3 (dont les deux plats des barres du graphe, qui peignaient la PARITÉ de la colonne en information) | 0. Une maison ne colore pas une alternance ; l'état d'une barre, c'est sa hauteur |
| teintes citées | argile + indigo + cuivre + ivoire + 7 hex de thème | encre, sable, surface, surface2, bordure, douce — et **une seule** teinte saturée, l'argile (`--charte-aplat` / `--charte-texte` / `--charte-btn-*`). L'indigo de la maison est réservé à la bande des Pauses |

Les cotes sont écrites **une** fois, dans la couche d'alias `.ot-page` :
`--ot-trait: var(--charte-trait)` · `--ot-regle: 3px` · `--ot-rayon-bloc:
var(--charte-rayon-tuile)` · `--ot-rayon-champ: var(--charte-rayon-champ)` ·
`--ot-rayon-tampon: var(--charte-rayon-badge)` · `--ot-case: 36px` ·
`--ot-glyphe: 42px` · `--ot-rond: 38px` · `--ot-hauteur-graphe: 205px`. La couche
d'alias est gardée volontairement : une soixantaine de sélecteurs la lisent déjà,
et surtout elle ne contient AUCUNE valeur de couleur — le test d'alignement la
contrôle séparément, une teinte qui y reviendrait rougit immédiatement.

### Les formes retravaillées (« retravaille un peu les formes de certains blocs »)

1. **Le glyphe du KPI devient un TAMPON** : 42 px, rayon badge 11, contour
   d'encre de 2, lavis `--charte-surface2` en second passage. Il était un rond de
   56 px cerclé d'un `inset` de 4 — deux cerclages sur le même objet, ce que la
   double feutre interdit.
2. **Les trois segments de vue** (jour / semaine / mois) partagent **un seul**
   cerclage ; le bouton tenu se remplit d'argile. Avant : trois boutons chacun
   cerclés de 1, posés dans une barre cerclée de 1.
3. **Les tuiles de mesure** (KPI, panneaux, tiroir) passent à `rayon-tuile` 12,
   cadre d'encre de 2 et ombre dure de 3. Elles étaient blanches cerclées de 1
   posées sur un fond ivoire : le cerclage ne se voyait pas.
4. **Le détail par employé perd sa garniture** : l'entête de liste est séparé du
   corps par une règle pleine de 3, plus par un cartouche niché dans un cartouche.
5. **L'étage du bas (jours)** devient un lavis fermé d'une règle de 3, les jours
   séparés par un filet de 2. Le `margin: 0 0 12px` par jour disparaît.
6. **L'avatar** prend le pilule 999 et l'encre de 2, **une seule teinte de fond**
   pour tous. Il changeait de fond selon la parité de la ligne — une
   information qui ne veut rien dire.
7. **Le tiroir** : règle de 3 à gauche, voile opaque de la maison au lieu du
   `blur(4px)`, un seul cerclage par section, champs au mono tabulaire (un seuil
   et un taux sont des NOMBRES), « Annuler » au CONTOUR du kit et « Sauvegarder »
   au PLEIN — le dégradé orange et son `#FFF` sont tombés.
8. **« Contrôle indisponible »** : sa bordure pointillée devient une règle pleine
   de 3. Le pointillé est une couture manquée, pas un style.
9. **Les boutons de la page héritent du kit** (C11/C12) : 36 px, capitales 700 à
   9,5 px espacées de 1,3, rayon champ 6, contour d'encre de 2, états
   `--charte-btn-*`, `translate(1px,1px)` à l'actif. Les 42 px à bordure de 1 et
   la `outline: 3px solid var(--ot-indigo)` du focus sont supprimés.

### Le pli, arithmétique des cotes déclarées (pas une mesure navigateur)

Aucun harnais de rendu dans ce dépôt : le calcul est fait sur les valeurs
déclarées, empilées au-dessus de la liste.

| | avant | après |
| --- | --- | --- |
| `.ot-main` padding-top | 22 | 24 |
| rangée de raccourcis | 58 | **0** |
| en-tête (titre + interligne + marge) | 60,4 (27 px / 1,2) | 48,0 (20 px / 1,2) |
| rangée de KPI (marge incluse) | 108 | 94 |
| rangée de panneaux (205 de graphe inclus) | 303 | 305 |
| **total au-dessus de la liste** | **551 px** | **471 px** |

**−80 px**, soit exactement une ligne d'employé de plus visible sans tourner la
molette (la ligne de résumé fait 38 + 2 × 16 ≈ 70). Le gain vient des raccourcis
(58) et du titre ramené de 27 à 20 (−12) ; le rythme a été raboté en même temps —
les `margin-bottom` de 20, off-scale, prennent le cran **16** (`espace-4`) et non
le 24, parce que l'intention du 26/12 est de faire gagner le pli : C8 prescrit une
gamme, pas un nombre. L'état vide du graphe prend `var(--ot-hauteur-graphe)` (il
faisait 190 contre 205 au graphe plein : la page sautait de 15 px à
l'arrivée des données).

### Ce que les tests verrouillent désormais

- `overtimeBrandAlignment.test.js` a été **réécrit, pas supprimé** (3 → 5 `it`).
  L'ancien verrouillait l'anti-charte : il exigeait les sept hex
  `#FAF6F0 #FFFFFF #231911 #4E3D2E #15110E #1D1713 #F5F2EB`, la chaîne
  `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` et les aiguilles
  `font-size: 27px / 24px / 17px / 16px`. Toute ligne honnête de ce chapitre le
  faisait donc rougir. Il verrouille maintenant la loi : zéro couleur en dur hors
  de la couche d'alias (qui doit rester blanche de teintes), quatre tailles,
  trois graisses, rayons démontés **coin par coin** (un `border-radius: 12px 4px`
  ne se refuse pas au peigne, il se refuse en lisant chaque valeur), zéro `1px`,
  zéro flou, zéro dégradé, Segoe UI absent. Le troisième `it` (bande `aso-oke`
  mince et vectorielle, 40/32 px, `viewBox="0 0 240 40"`, sans `<image>` ni
  `<filter>`) est conservé à l'octet près.
- Deux pièges relevés et écrits dans le test : une aiguille d'ABSENCE lue sur le
  texte CRU est réfutée par les commentaires qui citent ce qu'ils renvoient —
  elles passent donc par un retire-commentaires ; et le marcheur d'accolades qui
  délimite la couche d'alias ne dépend pas de l'ordre des lignes (un
  `indexOf('}', indexOf('--ot-glyphe'))` eût été une triche silencieuse dès
  qu'une cote s'ajoute en bas du bloc).
- `overtimeExperience.test.jsx` : le premier `it` vérifiait les quatre `href` et
  le clic sur le bouton de thème. Il est **remplacé** par deux aiguilles — la
  liste exacte des exports du module (`OvertimeCalculationGuide`,
  `OvertimeLoadingScreen`) plus l'absence de `<nav>`/`<Link>`, et la survie du
  thème GLOBAL (persistance `encheck.theme`, `dataset.theme`, aller-retour). Les
  deux `it` sur le guide, les deux `details` fermés et le `reduced-motion` sont
  inchangés — la feuille rend toujours ses deux blocs `@media
  (prefers-reduced-motion:reduce)` À L'OCTET PRÈS.
- `overtimePage.test.jsx` (9) et `overtimePresentation.test.jsx` (16) n'ont pas
  été touchés et passent : la chirurgie n'a changé ni le rendu ni les états.
- Le squelette HTML n'est pas le seul à être intact : la page pèse 816 lignes au
  lieu de 1041, dont **zéro** attribution `style={…}` (contre 56).
- **Contrôle par mutation** : réintroduire `#FAF6F0` dans la couche d'alias, un
  `border-radius: 7px` ou une ombre floue dans le corps, et remettre
  `className={…'ot-dark'…}` dans la page fait rougir trois des quatre aiguilles
  de loi ; tout retirer les remet au vert. Un test qui ne rougit sur commande ne
  verrouille rien.

### Portes, mesurées après coup

- `npx vitest run` complet : **200 fichiers / 2864 tests, tous verts**.
- Les quatre fichiers d'heures supplémentaires : **34 tests verts**.
- `npx eslint --config eslint.gate.config.js src` : **0 erreur**, 6 warnings
  préexistants (tous dans des fichiers non touchés).
- `npm run charte` : couleurs en dur **4471 → 4441** et **182 → 180 fichiers**
  — la feuille ET la page sortent de la liste des contrevenants (30 valeurs
  levées : 27 + 1 dans la feuille, 5 + 9 dans le JSX, moins ce qui a été remplacé
  ailleurs depuis la base). **Un détail du contrôle, trouvé en cours de route : il
  compte les octets des fichiers, pas leurs règles.** Citer une teinte morte en
  littéral dans un commentaire de la feuille faisait ROUGIR le compteur global
  (4454 → 4464 au milieu du chantier) : les valeurs renvoyées sont donc nommées
  en prose dans la feuille, et c'est ICI, dans ce markdown que le contrôle ne
  balaie pas, qu'elles sont écrites en toutes lettres.
  Census des déclarations : **2325 → 2290** tailles, **1698 → 1661**
  marges, **1199 → 1181** rayons (la page ne réinvente plus de cote, elle cite
  les jetons — le nombre de DÉCLARATIONS baisse, le nombre de VALEURS DISTINCTES
  aussi mais de un seulement : 43 marges → 42). Le compteur distinct ne bouge presque pas
  (64 tailles, 42 marges, 27 rayons) : les valeurs que la page écrivait en dur
  existent aussi dans 180 autres fichiers. Ce chapitre converge la page, pas le
  dépôt — le dépôt attend les autres.
- Verdict `npm run charte` reste NON CONFORME, comme avant l'intervention : il
  est global, et son C10 compte encore 323 rayons hors liste ailleurs.

### Ouvert, à ne pas vendre comme fait

- Aucun navigateur ici : les hauteurs ci-dessus sont l'arithmétique des cotes
  déclarées, pas des pixels mesurés sur une machine.
- Les libellés des états du tiroir, les `data-testid` et les valeurs par défaut
  (2 h de palier, 25 / 50 / 100 %, 48 h proposé) sont intacts — mais la page
  n'a plus aucun bouton de thème : un utilisateur en mode sombre qui voudrait
  revenir au clair doit passer par l'en-tête de l'administration.
- `HeuresSupplementaires.css` reste le seul endroit du dépôt où une page garde
  une couche d'alias `--ot-*` : tolérée parce qu'elle ne fait que dériver,
  contrôlée pour ça. Elle disparaîtra quand la page écrira les jetons
  directement, si un jour quelqu'un re-tape soixante sélecteurs.

---

## Boutons répondeurs et états vides — 27/11/2026

> **Note d'horodatage.** Le chapitre ci-dessus s'intitule « Peau du 26/12/2026 » ;
> son cachet git est `2026-11-27T10:56Z`. Le 26/12 est une erreur d'horloge
> recopiée dans les titres, pas un jour de travail distinct : les deux chapitres
> sont du même jour, le 27/11. Le libellé est gardé tel quel parce que la
> feuille et deux tests le citent — corriger l'étiquette aurait fait bouger du
> verrouillé pour une date.

**La demande, telle quelle.** « Stylise un peu plus ces textes, rajoute une UI :
“Aucun pointage clôturé sur cette période.” / “Aucune heure supplémentaire sur
cette période.” — les boutons “exporter cvs et Règles de calcul” ne sont pas
fonctionnels. » Capture à l'appui : les deux boutons en beige, sans cerclage.

### Le diagnostic, mesuré avant de toucher

Les deux boutons n'étaient pas cassés : ils étaient **muettement désactivés**.

| bouton | sa garde | ce que le clic faisait |
| --- | --- | --- |
| Exporter CSV | `disabled={loading \|\| !!error \|\| !rows.length}` | rien — la période du fondateur ne contenait **aucun pointage clôturé**, donc `!rows.length` était vrai |
| Règles de calcul | `disabled={enterpriseId === 'all' && isSuperAdmin}` | rien — « Toutes les entreprises » est un choix qui n'a pas de règles |

Et la capture portait la preuve : `#EADCC7` + `#6B4A32` + bordure transparente
sont exactement le couple `--charte-btn-desactive` / `--charte-btn-desactive-texte`
du kit (tokens.css) sur un `.ch-btn-contour`. Ce n'était pas un style raté,
c'était l'état désactivé — mais un état désactivé qui n'explique rien se vit
comme une panne. Le `title` n'aurait rien arrangé : personne ne survole un
bouton qu'on lui a dit d'utiliser.

### La loi neuve : un bouton de cet écran soit FAIT, soit DIT

- `disabled` ne garde qu'**une** justification — ce que l'utilisateur ne peut
  pas changer en cliquant : le chargement en cours et l'erreur réseau. Les deux
  restent désactivés, et c'est tout.
- Les deux refus deviennent un **avis** : `<p class="ot-avis" role="status">`,
  écrit avec les deux classes déjà employées par « Contrôle indisponible »
  (`.ot-controle-indisponible` + `.ot-controle-mot`) — un seul motif visuel pour
  « la page ne peut pas, et voici ce qu'elle attend ». Un test bloqueait une
  troisième manière de dire non.
- Le refus **déplace le focus** sur la commande qui débloque : le champ de
  période (`#ot-filtre-date`) pour l'export, le sélecteur d'entreprise
  (`#ot-filtre-entreprise`) pour les réglages. Les deux ids sont neufs, posés
  sur les deux champs qui existent déjà.
- L'avis **meurt avec la situation** (`useEffect` sur `enterpriseId`,
  `selectedDate`, `mode`) : pas de chronomètre, pas besoin d'un second clic pour
  s'en débarrasser.
- Il est posé **sous** les boutons, `flex-basis: 100%` : la rangée d'actions ne
  bouge pas latéralement, l'en-tête ne grandit que quand il y a quelque chose à
  dire.
- Le refus « Toutes les entreprises » ne vaut que **si le sélecteur existe**
  (`&& isSuperAdmin`) : un admin d'une seule entreprise n'a jamais « Toutes » à
  déselectionner — le refuser là l'aurait envoyé vers un champ que l'écran ne
  montre pas.

### Les deux vides, devenus des états

Chaque phrase reçoit trois lignes, et chacune est un fait que la page tenait déjà :

| | avant | après |
| --- | --- | --- |
| le mot | `<p class="ot-state">` (11 px centré dans une carte cerclée) ou un texte nu dans le trou du graphe | **titre** 14/700 — la phrase d'avant, mot pour mot — puis **cause**, puis **geste** |
| la cause | aucune | liste : `Du 2026-10-01 au 2026-10-31 · 31 journées examinées · seuls les couples entrée et sortie clôturés comptent.` graphe : `0s travaillées sur 31 journées examinées · aucune ne dépasse le seuil du planning.` recherche : `2 employés ont des heures sur la période · le filtre lit le nom et le matricule.` |
| le geste | aucun | « Période précédente » (liste, appel `shift(-1)`, la MÊME fonction que la flèche du filtre) ou « Effacer la recherche » (recherche, `setSearch('')`) |
| la forme | `.ot-state` = surface + cerclage de 2 + ombre dure + rayon de tuile, posé **dans** un panneau déjà cerclé | `.ot-vide` = lavis `--charte-surface2` + règle d'encre de 3 à gauche, **zéro** `box-shadow`, **zéro** `border-radius`, **zéro** cadre complet — une carte dans une carte, c'est ce que la reprise du 26/12 venait d'enlever du `.ot-list` |
| les nombres | — | `--charte-mono` tabulaire, comme le reste des comptes de la page |
| la place | trou du graphe : `min-height: var(--ot-hauteur-graphe)` était déjà là, donc **0 de changement**. Liste : la carte faisait ≈96 px (70 de contenu + 2×12 de respiration + 2 de cerclage) **plus 34 px de tête de table** = ≈130 px ; le bloc nouveau en fait ≈118 si la cause tient sur une ligne, ≈131 si elle en prend deux |

Le trou du graphe garde sa cote (`min-height: var(--ot-hauteur-graphe)`, écrite une
seule fois) : **un bloc ne grandit pas avec son texte**, et l'arrivée des données
ne fait pas sauter la page.

Sur la liste, il faut être honnête : le bloc **grandit**, il dit trois choses au
lieu d'une. Ce qui ne change pas, c'est le **défilement de la page** — la loi du
fondateur — et il est payé par deux retraits : les 34 px de tête de table, qui ne
sont plus rendus sans lignes, et le fait que rien n'est enveloppé dans une carte
de plus. Autrement dit : +44 px de sens, −34 px de chrome, aucun contenant
supplémentaire. Ces chiffres sont l'arithmétique des cotes déclarées, pas une
mesure — il n'y a pas de navigateur dans ce dépôt.

### Les boutons passent au kit, et une casse silencieuse avec

Le 26/12, la feuille n'avait pas pris les classes du kit : elle en avait
**recopié les cotes** dans `.ot-page button { … }` — même rendu, deux lois, et
la seconde devient fausse le jour où le kit bouge. Le markup portant enfin
`ch-btn-pleine` / `ch-btn-contour`, la copie est supprimée (la feuille perd son
bloc `:hover` / `:active` / `:disabled` de boutons). Trois conséquences, mesurées :

1. **Une pleine par écran** : la charte dit « la seule action principale ». Deux
   pleines côte à côte (Exporter + Règles) voulaient dire deux fois « clique-moi
   en premier ». Les deux passent au **contour** ; la pleine ne reste que sur ce
   qui écrit — « Sauvegarder » du tiroir — et sur l'écran d'erreur réseau, où
   « Réessayer » est l'unique geste.
2. **Le piège de cascade** que personne ne voyait : `.ot-page button, .ot-page
   input, .ot-page select { font: inherit }` posé sur la page **bat**
   `.ch-btn-pleine { font-size: 9,5px }`, parce qu'une classe + un type
   (0,1,1) est plus spécifique qu'une classe seule (0,1,0). Le `font: inherit`
   écrasait donc les capitales du kit — et `npm run charte` ne peut pas le voir,
   il lit des fichiers, pas le cascade. La règle n'atteint plus les boutons ; les
   trois segments de vue, qui ne sont PAS des boutons du kit (un sélecteur n'est
   pas une action), portent leur typographie eux-mêmes.
3. **La même casse pour les champs du tiroir** : `.ot-page input` (0,1,1) battait
   `.ot-champ-cadre` (0,1,0) et tuait son `font-family: var(--charte-mono)`. Les
   trois règles du champ sont écrites `.ot-page .ot-champ-cadre` (0,2,0) — c'est
   pour ça que la feuille préfixe ses champs, et ce n'est pas de la verbosité.

### Ce que les tests verrouillent

- `overtimeBoutonsRepondeurs.test.jsx` (7 `it`, fichier neuf) : le refus d'export **écrit
  son motif**, `onExport` n'est pas appelé, `document.activeElement` est le champ
  de période ; idem pour les règles et le sélecteur ; les deux gestes sont
  appelés dès que la condition est réunie ; l'avis disparaît au changement
  d'entreprise ; le bouton **reste** désactivé en chargement et en erreur ; les
  deux vides portent leur cause chiffrée (31 deux fois — le graphe et la liste
  examinent la MÊME période), leur rôle `status`, leur geste, et la tête de table
  ne se montre plus dans le vide ; « Période précédente » appelle `setDate` avec
  `2026-09-01` — le même `shift(-1)` que la flèche, pas un second calcul.
- `overtimeBrandAlignment.test.js` (6 `it`) vérifie la feuille : l'état vide ne
  porte ni ombre ni rayon ni cadre ; `min-height` du creux vient du jeton ; la
  feuille ne re-décrit plus `height/background/border/font-size/letter-spacing/
  text-transform` sur `.ot-page button` ; `font: inherit` ne touche plus les
  boutons ; les segments portent la taille du kit.
- **Le comptage remplace le seuil.** Premier essai : « au moins 6 ×
  `ch-btn-contour` » — et il est resté VERT quand un septième bouton quittait le
  kit. La loi est maintenant un écart exact : 12 `<button>` écrits dans la
  source, 11 habillés par le kit, la différence étant le sélecteur de vue (un
  seul `<button>` source, trois rendus). Muté, il répond : `expected 10 to be 11`.
- Table des mutations exercées (une aiguille qui ne rougit pas sur commande ne
  verrouille rien) : retirer l'avis → 3 `it` rouges ; couper `viser(...)` → 1
  chacun ; rendre le bouton muet à l'export → 1 ; renommer le geste → 2 ;
  remplacer la cote du trou par `190px` → 1 ; remettre `font: inherit` sur les
  boutons → 1 ; enlever la taille des segments → 1 ; faire réapparaître la tête
  de table dans le vide → 1 ; enlever une classe de kit → 1.

### Portes

- `npx vitest run src/services/__tests__/overtime*` : **5 fichiers / 42 tests
  verts**. Vitest complet : **201 fichiers / 2883 tests verts**.
- `npx eslint --config eslint.gate.config.js src` : **0 erreur**, les 6 warnings
  préexistants (fichiers non touchés).
- `npm run charte`, lu sur la feuille : **4** tailles déclarées (quatre jetons,
  comme avant ce chapitre), **0** couleur en dur hors couche d'alias, **0** rayon
  hors liste, **0** flou, **0** dégradé.
- Et le compteur du dépôt n'a PAS bougé d'une virgule entre la base et ce
  chapitre — mesuré en rejouant le contrôle après `git stash` : 67 tailles
  distinctes · 42 marges · 27 rayons · 4441 couleurs en dur dans 180 fichiers,
  avant comme après, y compris les DÉCLARATIONS (2305 / 1679 / 1181 des deux
  côtés) : la reprise déplace des règles à l'intérieur de la même feuille, elle
  n'y ajoute pas de valeurs. Les 67 tailles ne viennent pas d'ici :
  `src/pages/JoursFeries.css`, arrivé par #392, en porte à lui seul une douzaine
  en dur (10, 10,5, 11, 11,5, 12, 12,5, 13, 13,5, 14, 14,5, 15, 16 px).

### Le câble de l'export, vérifié ligne à ligne

`exportCSV` construit l'en-tête de douze colonnes, mappe `overtimeData`, forme un
`Blob`, le nomme `heures_sup_{première}_{dernière}.csv` et le télécharge — le
courant passait déjà, le bouton était seulement coupé en amont par son
`disabled`. Un seul défaut trouvé au passage, corrigé : l'ancre de téléchargement
était cliquée **sans être ajoutée au document**. Selon le navigateur, un clic sur
une ancre détachée peut être ignoré sans un mot — c'est-à-dire le symptôme exact
qui a été signalé. Elle est maintenant appendue, cliquée, retirée, et
`revokeObjectURL` garde son délai. Ce point n'est pas verrouillé par un test :
`URL.createObjectURL` n'existe pas en jsdom, et inventer une aiguille muette
aurait fait comptable d'une preuve inexistante.

### Ouvert

- Aucun navigateur dans ce dépôt : les hauteurs ci-dessus sont l'arithmétique
  des cotes déclarées. La largeur réelle de la cause (une ou deux lignes) dépend
  du nom des entreprises.
- L'avis est lu par un lecteur d'écran (`role="status"`) et posé sous les
  boutons ; il n'est pas annoncé à nouveau si l'utilisateur clique deux fois sur
  le même refus — c'est voulu (même cause, même texte, pas de bis).
- Un admin **non** rédacteur ne voit toujours pas le bouton « Règles de calcul »
  (permission, pas état) ; il lit le guide de calcul, qui reste à l'écran.
- Les autres pages de l'admin ont les mêmes boutons muets (le patron
  `disabled={... || !rows.length}` se retrouve ailleurs) : rien ici ne les a
  corrigées, et la loi « soit FAIT, soit DIT » ne vaut pour l'instant que sur
  celle-ci.
