# Les registres de craie, sur le pagne — la page Rapports au bogolan (29 novembre 2026)

La demande, telle quelle :

> Maintenant passons à la page "Rapports". Cette page on va la garder telle
> quelle mais on va seulement appliquer le style brut adouci, double feutre.
> Enlever les raccourcis, le bouton sombre/clair. Retravaille un peu les formes
> de certains blocs. Remplace le bandeau motif actuel par le bandeau bogolan, en
> suite entoure le bloc en haut par ce bogolan exactement comme dans la page
> Rémunération.

C'est la sixième fois que cette phrase est prononcée (Heures supplémentaires
26/12, Absences, Retards, Réglages, Rémunérations 8/11, Paie), et le verrou est
toujours le même mot : **garder telle quelle**. Aucun bloc déplacé, aucun
libellé réécrit, aucune requête ni calcul de rapport touché, les trois exports
intacts. Ce qui a bougé est de l'encre et de la géométrie — plus deux
suppressions demandées nommément, un tissu changé, et une enveloppe copiée.

La mesure d'entrée, avant d'écrire la première ligne : `Rapports.css` comptait
**39 couleurs en dur et 24 `rgba()`** — la page s'était construit une charte
parallèle, une « nuit indigo » de 11 jetons, et sa classe de jour `.rp-clair`
avec 27 hex de plus. C'est exactement le tord que le chapitre 23 de
`REMUNERATIONS-BOGOLAN.md` a coûté à la page d'à côté : une peau de page ne
peut pas battre la racine.

## Ce qui est enlevé, et où c'était écrit

| objet | avant | après |
| --- | --- | --- |
| rangée de raccourcis « Aller à » (`RaccourcisPages compact`) | 13 règles dans la feuille (puce 5 px / 11 px, barre cerclée de 1, `::-webkit-scrollbar: none`), 3 lignes de JSX, un import | **supprimée** — le composant n'est plus importé, ses 13 règles ne dorment pas dans la feuille |
| bascule sombre / clair de l'en-tête | `<button role="switch" aria-checked={darkMode}>` + `Sun`/`Moon`, et par terre la CLASSE `rp-clair` avec sa palette de rechange | **supprimés**. La page ne lit plus `useTheme()` du tout : elle hérite du thème posé à la racine par `ThemeProvider` |
| la « bordure de craie » | `<div className="rp-bordure">` — 9 px de pointillés de `repeating-linear-gradient`, `opacity: .75` | **supprimée**, remplacée par l'enveloppe d'étoffe (plus bas) |
| l'estompage à l'`opacity` | `opacity: .45` (rubrique éteinte), `.55` (bouton qui travaille), `.6` (rafraîchir), `.75` (bordure), `.85` (glyphes) | **zéro occurrence** : un état éteint se PEINT (`--charte-btn-desactive`, lavis de `surface2`), il ne s'efface pas |
| les coutures pointillées | 8 `dashed` (seuil, exports, aperçu, notes, marge, pied) | **zéro** : règles pleines de 3 px. Le pointillé est une couture manquée, pas un style |

Ce que la page **ne perd pas** : le thème. `encheck.theme` dans `localStorage`
et `documentElement.dataset.theme` vivent dans le contexte, intouchés — un
utilisateur réglé sur la nuit la retrouve ici comme ailleurs. Elle perd son
**second** thème, celui qu'elle s'inventait. Rapports est la seule page de ce
lot à ne pas vivre dans `CoqueAdmin`, donc elle n'a pas de rail auquel prêter
l'interrupteur : c'est un écart assumé, écrit ici pour qu'on ne le prenne pas
pour un oubli.

## Le bandeau : une seule carte, deux bandeaux, aucun raboutage

`PageCulturalBand` lit `culturalMotif.js` — une ligne, une page. Le nsibidi est
devenu bogolan **dans la carte**, pas par une règle locale :

```js
if (page === 'rapports') return 'bogolan'
```

Donc le bandeau du haut ET celui du pied changent de tissu en même temps, sans
qu'aucune classe nouvelle soit écrite (`paie-bogolan-haut.webp` en haut,
`paie-bogolan-bas.webp` en bas, hauteurs 76 / 32 px : celles de toutes les
pages). Trois conséquences, toutes tenues par la loi :

- **les quatre règles `.ec-cultural-…[data-cultural-motif='nsibidi']` sont
  mortes** et ont été retirées de `PageCulturalBand.css`, avec leur raison
  écrite à la place. Plus aucune route ne renvoie « nsibidi » : garder un CSS
  que personne ne lit est une dette, pas une assurance.
- **la bande n'est plus un `<svg>`** : le bogolan est une image tissée posée en
  fond, comme pour la Paie. La loi de `pageCulturalBand.test.jsx` a été
  réécrite pour juger l'invariant réel — *un seul rendu du motif, soit un
  dessin de la maison, soit une image, jamais les deux* — au lieu de verrouiller
  « la frise SVG est là ».
- **le nsibidi reste la signature du document** : `NsibidiBlasonSvg` en tête de
  page, `dessinerBlason` en tête du PDF (quatre signes autour d'un sceau,
  tracés à la main dans jsPDF). Une bande et une marque ne sont pas le même
  objet. Le dessin de la frise de neuf tuiles reste exporté et mesuré — un
  dessinateur ne se désarme pas d'un coup de pinceau sur une page.

Cinq suites avaient une assertion sur le motif de `/rapports` : elles ont
rougi, puis été **réécrites à l'endroit** (deux dans
`pageCulturalBand.test.jsx`, le solde dans le fichier de loi de la page).

## L'enveloppe : la copie exacte du cartouche de Rémunérations

« entoure le bloc en haut par ce bogolan **exactement comme** dans la page
Rémunération » — l'adverbe a été pris au mot, et il est devenu une loi lisible
sur **deux feuilles** :

| pièce | Rémunérations | Rapports |
| --- | --- | --- |
| épaisseur du tissu | `--rw-tissu: var(--charte-espace-5)` (24) | `--rp-tissu: var(--charte-espace-5)` (24) |
| bande tour | `.rw-entete::before`, 4 couches, `repeat-x ×2 / repeat-y ×2`, coins `--charte-tissu` | `.rp-entete::before`, mêmes mots |
| plaque | `.rw-entete::after`, `inset: var(--rw-tissu)`, rayon carte, aucun bord | idem, `--rp-tissu` |
| contenu | `.rw-entete-corps`, `padding: espace-4 espace-5` | `.rp-entete-corps`, même cote |
| collage | `position: sticky; top: 0; z-index: 20; isolation: isolate` | idem |
| ombre | `var(--charte-ombre-dure)` sur le tour, nulle part ailleurs | idem |

La loi ne compare pas des valeurs recopiées dans le test : elle relit la règle
`.rw-entete::before` dans `Remunerations.css` et exige d'y trouver les mêmes
morceaux (`repeat-x, repeat-x, repeat-y, repeat-y`,
`left top, left bottom, left top, right top`, `box-shadow:
var(--charte-ombre-dure)`…). Si l'une des deux feuilles bouge seule, la loi
rouge — c'est le seul moyen de tenir un « exactement comme » entre deux pages.

Le **contenant** est la partie la moins visible et la plus solide de la passe :
les trois enfants de l'en-tête (retour, blason, titre) vivaient en fils
directs, avec une `gap` de 14 px. La plaque est maintenant reculée par une
seule cote et son contenu respire par une seule règle — sinon la marge
intérieure serait commandée quatre fois, et le tissu mangé d'un côté. La loi
compte : **un seul** `rp-entete-corps` dans la page, et `.rp-entete` ne se
redéclare pas au point d'arrêt 650 (aucun seuil mobile sur l'épaisseur — la
feuille de Rémunérations n'en a aucun non plus : un tour de tissu qui
s'amincit d'un côté seulement se défait aux quatre coins).

## Les formes retravaillées

1. **Le cartouche, l'aperçu et la marge deviennent des tuiles** : rayon 12,
   contour d'encre de 2, règle pleine de 3 en haut, ombre dure de 3. Elles
   étaient des panneaux d'indigo cerclés d'un filet de craie à 1 px posé sur un
   fond nuit — le cerclage ne se voyait pas.
2. **Le glyphe du composeur devient un tampon** (34 px, rayon badge 11, un seul
   cerclage). Avant : un carré cerclé de 1, et `border-radius: 1px` partout
   dans la feuille — soit le cerclage du focus *et* celui du conteneur, deux
   anneaux l'un dans l'autre.
3. **Les faits du seuil sont des tampons**, plus des étiquettes pointillées.
4. **Le blason se pose tel quel** : pas d'anneau autour d'un sceau dans un bloc
   déjà cerclé d'étoffe.
5. **Le bouton d'export hérite du kit** : 36 px de haut, capitales au jeton
   micro, rayon champ, contour de 2, `translate(1px, 1px)` à l'actif, et un
   état désactivé **peint** (`--charte-btn-desactive`) au lieu d'un
   `opacity: .55`. Les deux « plein / contour » restent distincts : un seul
   bouton plein par écran.
6. **La grille de mesures perd son quadrillage de 1 px** : chaque mesure est une
   case cerclée de 2, sur le lavis de la page.
7. **L'état vide de l'aperçu est cerclé comme son état plein**, même boîte, même
   trait — la page ne saute plus quand les données arrivent.

## Ce que la passe a failli écrire, et qui est devenu une loi

- **un chevron qui ne peut pas lire un jeton.** La flèche des `<select>` était
  une data-URI ivoire, retournée par deux règles `.rp-clair …`. `currentColor`
  est illégal dans une URL, et une data-URI encodée ne lit aucun jeton CSS.
  Premier jet : `mask-image` — **faute**, un masque sur un `<select>` découpe
  TOUT l'élément, son texte et sa surface cliquable avec. Rejeté. La flèche
  reste une image, sa couleur est encodée (`%23…`, donc C1 ne la compte pas),
  et une **seule** règle la retourne à la racine (`[data-theme='dark']
  .rp-page`) : ce n'est pas une peau, c'est un actif non héritable. La loi
  compte ce retournement : **exactement un**, et il ne peut toucher qu'une
  image.
- **la double respiration.** Les blocs d'une colonne qui respire déjà par son
  `gap` n'ajoutent pas de `margin-top` : le premier jet en posait trois (sujet,
  sceaux, exports) et les rangées se décalait de 16 px chacune. La loi de
  cohérence est restée dans la feuille — pas de `margin-top` sur ces trois-là.
- **une loi qui lirait le texte brut.** Toutes les lois de ce lot sont écrites
  sur du texte **dégommé** (`nu`) : la page comme la feuille nomment ce
  qu'elles interdisent — « ET SURTOUT PAS `loading` », « la rangée Aller à est
  tombée ». Une assertion `not.toMatch(/darkMode/)` lue sur le brut rougissait
  sur le commentaire qui explique pourquoi `darkMode` est parti. Leçon du
  chapitre 23, appliquée ici avant qu'elle ne coûte.
- **un crible écrit en forme unique.** La loi d'estompage était
  `not.toMatch(/^\s*opacity:/m)` ; le coup de crible `*, .x { opacity: .4 }`
  (déclaration compacte, derrière un `;`) est passé au travers. La loi est
  devenue un balayage **déclaration par déclaration**. Un crible qui ne regarde
  qu'une forme d'écriture ne crie que sur cette forme-là.
- **une règle déplacée par la loi d'un autre.** `rapportsDureePaie` lit
  `@media (max-width: 720px) {` suivi *immédiatement* de `.rp-sujet-corps`. Le
  commentaire qui explique cette place, écrit DANS le bloc, rompait la lecture.
  Le commentaire vit maintenant au-dessus du bloc, et le dit.

## Mesures

| | avant | après |
| --- | --- | --- |
| lignes de la feuille | 1435 | 1448 |
| règles | 190 | **173** |
| couleurs en dur | 39 hex + 24 `rgba()` + 27 hex de `.rp-clair` | **0** (hors encodage d'une image) |
| tailles d'écriture | 13 valeurs (8,5 · 9 · 9,5 · 10 · 10,5 · 11 · 11,5 · 12 · 13 · 13,5 · 16 · 17 + un `clamp(20, 2.4vw, 27)`) | **4** : titre 20 · corps 14 · micro 11 · et le 16 px d'iOS |
| rayons | `1px` et `50%` | les jetons 6 · 8 · 11 · 12 + `--rp-rond: 50%` (C10 ne lit que des px : le rond passe par un jeton nommé) |
| bordures de 1 px | 41 | **0** — 22 traits de 2 (`--rp-trait`) et 11 règles de 3 (`--rp-regle`) |
| ombres | 6 (dont une à flou 38 px) | 5, toutes `var(--charte-ombre-dure)`, flou zéro |
| `opacity` / pointillés | 6 / 8 | **0 / 0** |
| JSX | 3168 lignes | 3166 |
| jugements de la page (`it`) | 23 dans un seul fichier | **40** : 22 (la peau, fichier neuf) + 18 (la signature, rescapées) |

`npx vitest run src/services/__tests__/rapports` : **108/108** sur 5 fichiers
(67 + 18 + 18 + 5 — soit +13 sur la veille). Suite complète : **3095/3095** sur
**217** fichiers (le +19 = 22 lois nouvelles − 5 fondues dans la signature).
`npm run build` : ✓ 18,62 s. `npx eslint --config eslint.gate.config.js src` :
0 erreur, 6 avertissements, ceux de la base — et la liste des fautes
`no-unused-vars` de `Rapports.jsx` est **identique** à celle du `HEAD` (7
erreurs préexistantes, dont `dessinerBlason` importé pour n'être utilisé que
dans le PDF : rien d'ajouté, rien caché sous un `eslint-disable`).
`npm run charte` : rapport identique au caractère près sur deux exécutions ;
C1 descend de **4368 à 4324** valeurs en dur (−44) et `Rapports.css` sort du
palmarès ; 318 → 318 règles, 307 rayons, verdict NON CONFORME à la baseline.

**Crible à mutations : 17 coups écrits, 17 tués**, les fichiers rendus à
l'identique après chaque coup — tour de tissu retiré, cote de tissu chiffrée,
enveloppe bordée d'encre, contenant de la plaque retiré puis doublé, rangée de
raccourcis revenue, bascule de thème revenue, classe de peau revenue, hex
revenu, trait de 1 px resurgi, pointillé resurgi, `opacity` resurgi, carte des
motifs retournée, bande redessinée au pied, écriture hors échelle, rayon 1 px au sceau
de coche, anneau posé autour du blason. Deux cas n'ont pas rougi **au premier
jet** (`opacity` compact, `height` du pied) : la loi a été réécrite, pas le
coup — et ils sont rouges au second.

## Non fait

- **Aucun regard sur écran**, comme toujours ici (`jsdom` ne peint pas). Trois
  choses ne se vérifient que sur la page : l'assemblage des quatre côtés
  d'étoffe aux coins de la plaque (le joint des deux fichiers, par construction
  invisible au test) ; le rendu du `<select>` dont la flèche est encodée, en
  clair et en sombre ; et la valeur exacte du contraste des deux teintes de
  DATA fabriquées par mélange (`--rp-onyx`, `--rp-nacre`) sur le fond de carte.
- **Le pli n'est pas mesuré, seulement calculé** : le bandeau (76) + l'enveloppe
  (24 + 38 + 24) + la marge (16) placent le seuil à ~178 px, contre ~127 avant —
  la page **commence plus bas** de 51 px, parce que l'enveloppe est une
  demande du fondateur et non un surplus. Si le pli doit être regagné, c'est la
  bande de 76 px qu'il faudra discuter, pas le tissu.
- La page n'a toujours pas de rail : son interrupteur de thème n'a pas été
  remplacé, il a été retiré. Si Rapports rejoint un jour `CoqueAdmin`, le
  bouton reviendra par la barre latérale, comme sur les cinq autres écrans.
- La modale d'export, la liste des rubriques et l'aperçu gardent leurs
  libellés et leur ordre d'avant : « garder telle quelle » n'a pas été
  négocié.
