# Examen de la page Pointage — UX, organisation et système

> **Audit, pas livraison.** Aucun écran n'est modifié par ce document.
>
> **Commit lu : `237ef6e`** (« Merge pull request #222 »), 17 novembre 2026.
> Branche `arena/234c8657-en-check`, alignée sur `origin/main`.
>
> **Méthode.** Chaque constat porte soit un chemin de fichier et une ligne
> (vérifié dans le code), soit la mention « mesuré à l'écran » (constat tiré des
> captures, non reproductible depuis le code seul). La distinction est
> maintenue partout — c'est la leçon de l'audit précédent.
>
> **Registre.** Tout est « à faire ». Une capture n'est pas une réalisation.

---

## 0. Périmètre

**Ce qui a été examiné** : quatre captures du dossier Drive, datées du
17 novembre 2026, à 17 h 25 — la grille des cartes (deux vues), l'en-tête avec
le flux 24 h et la bande « Live Pulse », et le tiroir « Inspection du
pointage ».

**Fichiers vérifiés** : `src/pages/Pointages.jsx` (5 141 lignes),
`src/components/PointagesAfroTechSections.jsx` (1 696 lignes),
`src/components/PausesAfroTechSections.jsx`, `src/utils/timezoneUtils.js`.

**Ce que je n'ai pas vu** : mobile, tablette, mode clair, état de chargement,
état d'erreur, état hors ligne, rôle restreint, vue « Groupée », vue « Liste »,
export CSV, import de pointeuse, page au-delà de la première.

**Le contexte de la donnée, à garder en tête.** Les captures montrent 14
personnes appartenant à trois entreprises différentes (préfixes `ENN`, `PIC`,
`PHA`), dont deux entrées de recette. Deux personnes ont pointé. **Ce n'est pas
un jeu de données de démonstration propre : c'est un mélange de production et de
recette.** Plusieurs constats ci-dessous n'existent que parce que cette donnée
est sale — et c'est précisément ce qu'un client verra s'il ouvre la page
aujourd'hui.

---

## 1. Verdict

**C'est la page la plus riche du produit, et c'est aussi celle qui prend le plus
de risques.**

Elle a des qualités rares : elle distingue une pause **réelle** d'une pause
**présumée**, elle écrit « session non clôturée » au lieu de mentir, elle
propose la navigation au clavier sur le graphique, elle donne un niveau de
détail qui permet vraiment d'enquêter. Ce n'est pas une page décorative : c'est
un outil d'investigation.

Mais elle **affirme des choses qu'elle ne peut pas prouver**, et c'est le seul
défaut qu'un produit de preuve ne peut pas se permettre. Trois exemples, tous
vérifiés dans le code :

- elle affiche **« ✓ Dans le périmètre »** même quand aucune zone n'est connue ;
- elle affiche **« Précision : ±194 m »** à côté de **« Distance : 41 m »** sans
  signaler que l'un rend l'autre indécis ;
- elle affiche **« Durée : 0sec »** pour une session ouverte depuis quatre
  heures.

**Une page d'enquête qui se trompe sur ses propres mesures ne sert à rien devant
quelqu'un qui conteste.** Et c'est exactement dans cette situation qu'on
l'ouvre.

---

## 2. Ce qui tient — et qu'il ne faut pas casser

| Élément | Pourquoi c'est bon |
| --- | --- |
| **« Session non clôturée (sortie à vérifier) »** | Le produit reconnaît qu'il ne sait pas. C'est la bonne posture, et c'est rare. |
| **Pause réelle vs pause présumée** | La distinction existe, avec un libellé explicite « non présumée ». C'est le bon réflexe — l'exécution est à revoir (§A5). |
| **« En pause en direct : 42m 38s (depuis 16:42:58) »** | L'heure de début **et** la durée. Beaucoup de produits n'en donnent qu'une. |
| **Le graphique 24 h avec zones de nuit** | Le découpage nuit/jour est un vrai besoin métier, traité visuellement. |
| **Navigation au clavier ← → sur le graphique** | Accessibilité réelle, pas déclarative. |
| **Le tiroir d'inspection** | Le bon objet : on ne quitte pas la liste pour enquêter. |
| **La carte avec cercle de périmètre** | On voit la zone et le point. C'est la bonne représentation. |
| **Le sélecteur de date + « Auj. »** | Une page datée est une page vérifiable. |

Ce socle est réel. Il ne faut pas le refaire : il faut **l'exactitude**.

---

## 3. Famille A — La vérité de la preuve (le plus grave)

C'est ici que se joue la crédibilité du produit. Chaque point ci-dessous est
vérifié dans le code, avec la ligne.

### A1. « ✓ Dans le périmètre » s'affiche même quand le périmètre est inconnu

**Vérifié.** `PointagesAfroTechSections.jsx:1533` :

```jsx
{gps.isWithinZone === false ? '⚠️ Hors zone autorisée' : '✓ Dans le périmètre'}
```

La condition teste **seulement** le cas `false`. Si `isWithinZone` vaut `null`,
`undefined` ou `'inconnu'` — c'est-à-dire si l'application **n'a pas pu
déterminer** si le point est dans la zone — la page affiche une affirmation
positive.

**Pourquoi c'est grave.** Ce n'est pas une imprécision, c'est une **inversion de
charge de la preuve**. Le produit dit « dans le périmètre » alors qu'il ne sait
pas. Devant un salarié qui conteste un pointage, ou devant un client qui
conteste une prestation, cette phrase est un mensonge de l'interface.

**Ce qu'il faut.** Trois états, jamais deux :

| État | Affichage |
| --- | --- |
| `true` | « ✓ Dans le périmètre (zone *X*) » |
| `false` | « ⚠ Hors zone autorisée (zone *X*) » |
| inconnu | « Zone non vérifiable — aucune zone ne couvrait ce point » |

Et **jamais** d'affirmation positive par défaut.

### A2. Une précision de ±194 m rend une distance de 41 m indécidable

**Vérifié.** `PointagesAfroTechSections.jsx:1533-1536` affiche côte à côte :
la pastille de zone, `Distance : 41 m`, `Précision : ±194 m`.

**Le défaut, en une phrase : l'incertitude est cinq fois plus grande que la
grandeur mesurée.** Avec une précision de ±194 m, un point situé à 41 m de
l'entrée peut être à 235 m — donc hors zone — ou à 153 m du côté opposé. **La
conclusion « dans le périmètre » n'est pas soutenable.**

Et la page le fait sans le dire : les deux nombres sont sur la même ligne, dans
le même style, sans hiérarchie. Un utilisateur lit « dans le périmètre » et ne
regarde pas le second chiffre.

**Ce qu'il faut.**

1. **Une règle explicite** : si `précision > distance`, le verdict de zone est
  **indécis**, quel que soit `isWithinZone`.
2. **Un affichage qui hiérarchise** : « Point à 41 m du site — mesure imprécise
  (±194 m), la position ne permet pas de conclure ».
3. **La règle écrite dans le dictionnaire de données**, pas dans un composant.

C'est le point le plus important de ce document. Un produit qui vend la preuve
doit **refuser de conclure** quand sa mesure ne le permet pas.

### A3. « Durée : 0sec » pour une session ouverte depuis quatre heures

**Vérifié.** `PointagesAfroTechSections.jsx:1509` :

```jsx
: `Durée : ${formaterDureeComplete(pointage.totalSecondes || 0)}`
```

et `timezoneUtils.js:362` :

```js
export const formaterDureeComplete = (secondes) => {
  if (!secondes || secondes <= 0) return '0sec'
```

Une session ouverte sans durée calculée passe donc par `|| 0`, et `0` devient
la chaîne **`0sec`**.

**Ce que la capture montre** : Hippo a badgé à 13 h 26. À 17 h 25, le tiroir
affiche « Entrée badgée 13:26:24 » et « **Durée : 0sec** ».

**Le défaut.** Ce n'est pas « inconnu », ce n'est pas « en cours » : c'est un
**chiffre faux**, présenté comme une mesure. Un lecteur peut en conclure que le
salarié vient d'entrer, ou que le calcul est cassé.

**Ce qu'il faut.** Trois cas distincts :

- session fermée → `Durée : 4h12`
- session ouverte → `En cours depuis 3h58`
- durée non calculable → `Durée : non calculable (sortie manquante)`

**Jamais `0sec`.** Et la garde doit être dans le formateur, pas dans chaque
appelant — `formaterDureeComplete(0)` ne devrait pas exister comme cas normal.

### A4. La carte affiche « Durée : — » pendant que la session court

**Vérifié.** `PointagesAfroTechSections.jsx:1226` :

```jsx
{p.totalSecondes > 0 ? `Durée : ${formaterDureeComplete(p.totalSecondes)}` : 'Durée : —'}
```

**Le défaut.** Sur la carte, une session ouverte affiche un tiret. Sur le tiroir,
la même session affiche `0sec`. **Deux écrans, deux réponses différentes pour la
même donnée.** Et dans les deux cas, la seule information utile — « depuis
combien de temps » — est absente.

**Ce qu'il faut.** Une seule fonction de formatage de durée, partagée par la
carte et le tiroir, avec trois cas (§A3). Et un compteur qui s'incrémente pour
les sessions ouvertes, comme le fait déjà la pause.

### A5. « Pauses réellement effectuées (1) » — deux lignes affichées

**Vérifié.** `PointagesAfroTechSections.jsx:1580` :

```jsx
<strong>Pauses réellement effectuées ({realPauses.length})</strong>
```

puis, dans la **même section**, les pauses présumées sont rendues plus bas
(`:1611` et suivantes), avec un simple `marginTop: 8`, `borderStyle: 'dashed'`
et `opacity: 0.9`.

**Ce que la capture montre** : un titre qui annonce **1**, puis **deux** blocs —
« 16:42:58 → En cours · 43m 14s · Pause réelle pointée (non présumée) » et
« 12:00:00 → 13:00:00 · Pause présumée du planning — non pointée (hors
historique réel) · 1h00 ».

**Le défaut.** Le compteur et le contenu ne concordent pas. Un lecteur pressé
conclut que la personne a pris **deux** pauses, dont une d'une heure. Or elle en
a pris **une**, et l'autre est une **hypothèse du planning**.

**Pourquoi c'est grave ici plus qu'ailleurs.** Le produit passe sa vie à
distinguer le constaté du présumé. Il le fait dans le libellé, puis il **détruit
cette distinction par la mise en page**. C'est le pire des deux mondes : le mot
juste dans une structure qui le contredit.

**Ce qu'il faut.**

- **Deux sections titrées** : « Pauses réellement pointées (1) » et « Pauses
  présumées, non pointées (1) » — avec des compteurs séparés.
- **Hiérarchie visuelle** : la présomption est en retrait, plus petite, et
  jamais au même niveau de lecture que le fait.
- **Aucune présomption dans un total** : un total additionne du constaté, ou il
  s'appelle « estimé ».

### A6. Les barres « Canaux » mélangent des personnes et des événements

**Vérifié.** `PointagesAfroTechSections.jsx:676-716`.

```js
if (m.includes('qr')) qrCount += 1
else if (p.firstIn) pinCount += 1
if (p.hasPhoto) photoCount += 1
if (p.hasGPS) gpsCount += 1
if (p.hasFaceRecognition) faceCount += 1
```

et la base de calcul :

```js
const base = Math.max(1, Number(stats.presents) || pinCount + qrCount || 1)
```

Trois défauts, tous dans ces huit lignes :

1. **Les canaux ne sont pas exclusifs.** Une même personne incrémente `pinCount`
   **et** `gpsCount` **et** `photoCount`. Les barres se lisent comme une
   répartition (« 2 par PIN, 2 par GPS »), alors qu'il s'agit de la **même**
   personne comptée trois fois. Un utilisateur en déduit quatre pointages ; il y
   en a deux.
2. **Les pauses changent d'unité.** `pausesCount` compte des **événements**
   (`pausesCount += realPauses.length`), mais il est divisé par un nombre de
   **personnes**. Une personne qui prend trois pauses donne 150 %, ramené à
   100 %. Le pourcentage n'a aucun sens.
3. **La barre a un plancher de 5 %.** `Math.max(5, m.pct)` donne une barre
   visible à un canal qui vaut **zéro**. Sur la capture, « Scan QR Code 0 » et
   « Photo signée 0 » affichent malgré tout un trait. Une barre non nulle pour
   une valeur nulle est un graphique qui ment.

**Ce qu'il faut.** Choisir **une** unité et s'y tenir :

- soit « **part des pointages** utilisant ce canal » — avec la précision que les
  canaux se cumulent, et donc que la somme dépasse 100 % ;
- soit « **nombre de personnes** ayant utilisé ce canal », présenté en nombres
  absolus, sans barre ;
- et les pauses dans **une carte séparée**, en nombre d'événements et en minutes.

Jamais deux unités dans le même graphique.

### A7. « Présence 14 % » inclut des retards et une personne en pause

**Vérifié.** `PointagesAfroTechSections.jsx:719` :

```js
const presentShare = Math.round(((Number(stats.presents) || 0) / totalTeam) * 100)
```

**Le défaut, en deux temps.**

D'abord, le **chiffre**. `stats.presents` compte toute personne ayant badgé,
quelle que soit son heure d'arrivée. Sur la capture, les deux seules personnes
comptées sont précisément celles que la bande du dessus affiche comme
**« En retard / En pause »**. Autrement dit : **14 % de présence, avec zéro
personne à l'heure**. Le mot « présence » suggère une santé ; le chiffre mesure
seulement « a badgé au moins une fois ».

Ensuite, le **placement**. Ce donut est à l'intérieur d'une carte intitulée
**« Canaux, Géolocalisation, Reco Faciale & Pauses »** (vérifié, `:904`). Un
indicateur de présence dans une carte de canaux : ni l'un ni l'autre ne s'y
retrouve.

**Ce qu'il faut.** Renommer — « Ont pointé aujourd'hui : 2 / 14 » — et déplacer
le taux dans la zone de situation, où il sera comparé à heure égale. Le mot
« présence » doit être réservé à « présent et attendu à cette heure-là ».

### A8. Une entrée après la fin du poste est traitée comme un retard ordinaire

**Mesuré à l'écran.** Hector H, planning 08:00–17:00, badge à **17:11:35**. La
bande le classe « **En retard / En pause** », et sa carte affiche « Session non
clôturée » avec un prévu 08:00–17:00.

**Le défaut.** Une entrée **onze minutes après la fin** du poste n'est pas un
retard : c'est une situation qui n'a pas de sens et qui demande une décision
humaine. Le produit la range dans la même catégorie qu'un retard de cinq
minutes, avec la même couleur et le même mot.

**Pourquoi ça compte.** C'est peut-être une erreur de saisie, une intervention
de nuit, un changement de planning non enregistré, ou une fraude. Dans les
quatre cas, l'action n'est pas « constater un retard », c'est **« arbitrer »**.

**Ce qu'il faut.** Une catégorie distincte : « **Entrée hors créneau** », qui
n'alimente jamais un compteur de retard, et qui **demande une décision** —
accepter, rattacher à un autre créneau, refuser.

### A9. Une pause en direct n'a aucun seuil

**Vérifié.** Aucune occurrence d'un seuil ou d'une alerte de pause dans
`PointagesAfroTechSections.jsx` ni `Pointages.jsx` (recherche sur `dépasse`,
`seuil`, `pauseLongue`, `pause_trop` : zéro résultat).

**Mesuré à l'écran.** « En pause en direct : 42m 38s », puis « 43m 14s » quelques
secondes plus tard. Le compteur monte, sans limite affichée, sans comparaison au
créneau prévu.

**Le défaut.** Le produit sait qu'une pause est prévue de 12:00 à 13:00. Il
sait que la pause réelle a commencé à 16:42. Il **ne signale pas** que la pause
courante dépasse déjà quarante minutes. C'est pourtant l'information la plus
utile à 17 h 25.

**Ce qu'il faut.** Un seuil paramétré par entreprise, et trois états : normale,
longue, anormale. La couleur seule ne suffit pas (voir C4) : le libellé doit le
dire.

### A10. « Modifier le pointage » et « Partager » sans garde-fou visible

**Mesuré à l'écran** (pied du tiroir) : deux boutons, « Modifier le pointage » et
« Partager », au même niveau visuel que « Accéder à la fiche de l'employé ».

**Le défaut.** Ce sont les deux actions les plus dangereuses de la page.

- **Modifier un pointage**, dans un produit qui vend la preuve, doit exiger un
  motif, une autorisation et laisser une trace. Rien à l'écran ne le suggère.
- **Partager**, sans dire quoi, à qui, ni pour combien de temps. Même défaut que
  sur le dashboard, mais ici la pièce partagée contient **une photo et une
  position**.

**Ce qu'il faut.**

| Action | Exigence |
| --- | --- |
| Modifier | Permission dédiée, motif obligatoire, journal nominatif, mention « modifié » sur la carte ensuite |
| Partager | Aperçu avant envoi, périmètre explicite, lien daté et révocable, filigrane |

**Ne pas coder ces deux boutons avant d'avoir écrit ces règles.** Ils existent
déjà ; c'est leur cadre qui manque.

### A11. « Ouvrir dans Google Maps » envoie une position à un tiers

**Vérifié.** `PointagesAfroTechSections.jsx:1544-1553` : un lien
`https://www.google.com/maps?q={lat},{lng}`, en `target="_blank"`.

**Le défaut.** Un clic transmet les coordonnées d'un salarié à Google, depuis le
navigateur de l'employeur, sans avertissement. Ce n'est pas une fuite
technique — c'est un **transfert de données personnelles à un tiers**, déclenché
par un bouton qui ressemble à une commodité.

**Ce qu'il faut.** Soit une carte interne seule (elle existe déjà juste
au-dessus), soit un avertissement explicite. Et la question doit être tranchée
avec l'analyse APDP : un transfert vers un État tiers ne se règle pas par un
lien `target="_blank"`.

**Point de méthode** : je ne dis pas que ce lien est illégal. Je dis qu'il
**transfère des données**, et que ce n'est écrit nulle part dans le produit.

---

## 4. Famille B — L'organisation de la page

### B1. Douze cartes sur quatorze ne contiennent rien

**Mesuré à l'écran.** Sur 14 personnes, **12** affichent « Sans entrée » +
« Durée : — » + « Aucun pointage enregistré aujourd'hui » + un chip de planning.
Chacune occupe une carte de hauteur pleine.

**Le défaut.** Environ **85 % de la page** est consacrée à dire qu'il n'y a rien,
répété douze fois avec les mêmes trois lignes. Les deux personnes qui comptent
sont noyées au milieu.

**Ce qu'il faut.** Un regroupement par état, dans cet ordre :

1. **À arbitrer** (sessions ouvertes, entrées hors créneau, pauses anormales)
2. **Ont pointé**
3. **Pas encore pointé** — en une seule ligne agrégée, dépliable
4. **Absents justifiés** — agrégés

Une carte pleine se justifie pour quelqu'un qui a bougé aujourd'hui. Pour les
autres, une ligne suffit.

### B2. Deux vocabulaires pour le même état, sur le même écran

**Mesuré à l'écran + vérifié.** La carte dit « **Sans entrée** »
(`PointagesAfroTechSections.jsx:1197` et suivantes). La bande « Live Pulse »
dit « **Absent** » pour les mêmes personnes. Et le dashboard, lui, dit
maintenant « **pas encore pointé** » (`libelleSansPointage`, `etatPresence.js`).

**Trois mots pour un état, dans le même produit, le même jour.** Et l'un des
trois — « absent » — est celui que la règle de vérité interdit avant la fin du
poste.

**Ce qu'il faut.** **Une seule source de libellé** : `libelleSansPointage()` de
`src/lib/etatPresence.js`. La page Pointage doit l'importer, pas réinventer le
mot.

### B3. Le tri par défaut est alphabétique, et il n'y a pas de vue « exceptions »

**Vérifié.** `Pointages.jsx:702` : `const sortBy = searchParams.get('sort') || 'name_asc'`.
Les options existent et sont bonnes (`:2551-2561`) : Nom A→Z, Nom Z→A,
Arrivée ↑/↓, Durée ↑/↓, **Par statut**, H. Sup ↓.

**Le défaut.** Une page d'enquête s'ouvre par défaut sur « Nom A→Z ». Le
premier écran ne montre donc jamais ce qui demande une décision. Et parmi les
sept filtres, **aucun** ne dit « seulement les anomalies ».

**Ce qu'il faut.** Un tri par défaut **orienté conséquence**, et un filtre
« À arbitrer » qui soit le premier de la liste, pas le dernier.

### B4. Neuf contrôles dans une barre, deux rafraîchissements, aucun « réinitialiser »

**Mesuré à l'écran.** Entreprises · Statuts · Méthodes · Photos · GPS · Tri ·
CSV · Importer · Rafraîchir — puis, sous le titre de section, un **second** icône
de rafraîchissement.

**Le défaut.**

- **Deux boutons identiques** pour la même fonction, à vingt pixels d'écart.
- **Aucun indicateur de filtre actif** : rien ne dit si la vue est complète ou
  restreinte.
- **Aucun « tout effacer »** : revenir à la vue complète demande six gestes.
- **Aucun compteur** avant/après filtrage : « 14 » est affiché dans le titre,
  mais on ne sait pas s'il s'agit du total ou du résultat filtré.

**Ce qu'il faut.** Une barre unique, un seul rafraîchissement, un compteur
« 3 sur 14 », un bouton « tout effacer » visible dès qu'un filtre est actif.

### B5. Trois modes de vue dont un nom jargon et deux indistincts

**Vérifié.** `Pointages.jsx:2022` : le libellé « **Passeports** ».

**Le défaut.** « Passeports » ne décrit rien pour un utilisateur. Et les deux
autres — « Groupée » et « Liste » — ne se distinguent pas par leur nom : les
deux suggèrent un regroupement.

**Ce qu'il faut.** Des noms qui décrivent la **forme** : « Cartes », « Par
équipe », « Tableau ». Et le mode par défaut doit être celui qui sert le plus
souvent.

### B6. Le champ de date affiche un carré vide

**Mesuré à l'écran.** Entre « 17/11/2026 » et les flèches, un petit carré vide
apparaît — au même endroit sur trois captures.

**Le défaut.** C'est un contrôle natif non stylé (probablement un
`input[type=date]` sans indicateur). Il ressemble à un défaut de rendu, ce qui
suffit à faire douter de la fiabilité de la page entière.

**Ce qu'il faut.** Soit le styler, soit le retirer. Un contrôle invisible qui
ressemble à un bug est pire qu'une absence de contrôle.

### B7. « Importer » sur une page de preuve

**Vérifié.** `Pointages.jsx:2576-2580` : bouton « Importer un fichier de
pointeuse (clé USB) », qui ouvre `ImporterPointages` (`:2229`).

**Le défaut.** C'est une fonctionnalité légitime — beaucoup d'entreprises ont
une pointeuse physique. Mais elle est **au même niveau visuel** que « CSV », et
rien n'indique que les pointages importés sont **d'origine différente** d'un
pointage badgé.

**Ce qu'il faut.** Marquer à la source : un pointage importé doit porter une
mention visible et durable (« importé d'une pointeuse, non badgé »). C'est la
même règle que pour les pauses : **le constaté et le rapporté ne se mélangent
jamais silencieusement**.

### B8. Le planning est affiché deux fois par carte

**Mesuré à l'écran.** Le chip « Planning personnalisé (09:00 – 17:00) » en haut,
puis « Prévu 09:00–17:00 » en bas de la même carte.

**Le défaut.** La même information deux fois dans une carte qui contient déjà
peu de choses. C'est du remplissage, et cela dilue ce qui compte.

### B9. « GPS · 41m » — une unité qui ne dit pas ce qu'elle mesure

**Mesuré à l'écran + vérifié.** La carte affiche `GPS · 41m`
(`PointagesAfroTechSections.jsx:488` construit ce badge). Le tiroir, lui,
précise « Distance : 41 m ».

**Le défaut.** « GPS · 41m » se lit comme un temps ou une altitude. Seul le
tiroir dit qu'il s'agit d'une distance. Et **41 m est présenté sans sa
précision** — celle qui, justement, rend le chiffre inutilisable (voir A2).

**Ce qu'il faut.** `À 41 m du site ⚠ mesures imprécises` sur la carte, ou rien.
Un chiffre dont on ne peut pas tirer de conclusion ne doit pas être mis en avant.

### B10. Deux systèmes de nommage

**Mesuré à l'écran.** La bande montre « Sara », « Emma », « Boss », « ya » —
prénoms seuls. Les cartes montrent « Sara BALANDILA », « Emma BAYLE »,
« Boss buta » — nom complet.

**Le défaut.** Deux identités pour la même personne, à cinquante pixels
d'écart. Et des incohérences de casse (« Boss buta » à côté de « Koné KOMI »)
qui viennent de la donnée, pas de l'interface.

**Ce qu'il faut.** Une règle unique : **nom + initiale** partout, prénom seul
nulle part. Et un nettoyage de la casse à l'affichage, avec `nettoyerTexte` et
une normalisation `Prénom NOM`.

### B11. La page agrège trois entreprises sans le dire

**Mesuré à l'écran.** La bande titre « Équipe du jour (14) » et mélange des
personnes de `ENN`, `PIC` et `PHA`. Le filtre « Toutes les entreprises » est
actif.

**Le défaut.** Deux problèmes distincts :

1. **Le titre ment** : « Équipe du jour » suggère une équipe, alors qu'il
   s'agit de trois entreprises.
2. **Le défaut déjà signalé dans le rapport Pointage du 5 novembre revient
   ici** : mélanger des entreprises sur une même vue est exactement le mécanisme
   qui a produit la fuite de noms sur une borne réaffectée. Côté admin, c'est
   moins grave — mais le défaut de conception est le même.

**Ce qu'il faut.** Le titre doit dire le périmètre (« 14 personnes · 3
entreprises »). Et pour un administrateur non super-admin, la vue ne doit
**jamais** pouvoir dépasser son entreprise.

---

## 5. Famille C — Le système

### C1. La règle de vérité existe, la page ne l'utilise pas

**Vérifié.** `src/lib/etatPresence.js` existe sur `main` et exporte
`finPosteDepassee()` et `libelleSansPointage()`. Le dashboard l'importe.
**`Pointages.jsx` et `PointagesAfroTechSections.jsx` : zéro occurrence.**

**Le défaut.** C'est le point le plus structurant de ce document. Le produit a
écrit sa règle de vérité, l'a testée — et l'écran qui sert à **constater** les
présences ne l'applique pas. La page qui compte dit « Absent » quand le
dashboard dit « pas encore pointé ».

**Ce qu'il faut.** Importer le module, supprimer les libellés locaux, et ajouter
un test qui échoue si un mot interdit apparaît avant la fin du poste. C'est la
première PR à faire, et elle est petite.

### C2. Typographie : le texte informatif descend sous 10 px

**Mesuré à l'écran.** Les lignes « Durée : — Préveu… », les légendes du
graphique 24 h, les sous-titres de canaux et le badge « GPS · 41m » sont tous
dans la plage 9-11 px.

**Le défaut.** Le produit est utilisé sur tablette, en boutique, parfois en
plein jour. Sous 12 px, la lisibilité chute nettement — et ce sont précisément
les chiffres qui comptent (heures, durées, distances) qui sont écrits le plus
petit.

**Ce qu'il faut.** Un plancher de **12 px** pour tout texte informatif, et
**13-14 px** pour les valeurs. L'échelle du dashboard s'applique aussi ici.

### C3. Les statuts sont encodés par la couleur seule

**Mesuré à l'écran.** La bande « Live Pulse » code l'état par un anneau coloré
(vert, orange) avec une légende textuelle minuscule. Aucune différence de forme,
aucune icône, aucun libellé sur l'avatar.

**Le défaut.** Même défaut que la heatmap du dashboard : inaccessible aux
personnes daltoniennes, illisible en noir et blanc, et illisible en petit
format.

**Ce qu'il faut.** Un second canal : une pastille avec une **forme** différente,
ou une icône (✓ à l'heure, ⏱ en retard, ☕ en pause), ou le statut en toutes
lettres sous le nom. La couleur reste un renfort, jamais l'unique support.

### C4. Des données de recette dans la page de preuve

**Mesuré à l'écran.** « RECETTE » et « RECETTE A »/« RECETTE B » figurent parmi
les 14 personnes, à côté de vrais employés.

**Le défaut.** Dans la page qui sert à prouver qui était là, un nom de recette
est une pollution qui retire de la crédibilité à l'ensemble. C'est déjà signalé
dans l'audit du dashboard (C7) ; ici, l'effet est pire, parce que la page est
celle qu'on ouvre en cas de litige.

**Ce qu'il faut.** Retirer les données de recette de l'environnement de
production. C'est une correction d'heures, indépendante du reste.

### C5. Aucune trace de la dernière synchronisation de la borne

**Mesuré à l'écran.** Rien, sur la page Pointage, ne dit si les pointages
affichés proviennent d'une borne synchronisée ou d'une file locale.

**Le défaut.** C'est la question la plus importante de tout le système : **ce
que je vois est-il complet ?** Le rapport du 5 novembre a établi que des gestes
pouvaient disparaître de la file locale. Une page qui affiche « 14 personnes »
sans dire « données complètes / 12 gestes en attente » laisse l'utilisateur
croire à l'exhaustivité.

**Ce qu'il faut.** Un bandeau d'état de la donnée, en haut : « Données complètes
· dernière synchronisation il y a 2 min » ou « ⚠ 12 gestes non acquittés — la
vue peut être incomplète ». C'est la contrepartie visible des lots 0 et 1 de la
feuille de route.

### C6. La limite de 50 pointages — à vérifier

**Non vérifié.** Le registre du dossier « IA ANALYSE » mentionne une limite de
50 à contrôler sur l'historique. Je n'ai pas trouvé de plafond explicite dans
`Pointages.jsx`, mais les requêtes sont réparties et je ne les ai pas toutes
lues.

**À faire** : vérifier la pagination réelle de la vue, et l'afficher. Une page
qui tronque silencieusement à 50 est un défaut de preuve, pas un défaut
d'affichage.

---

## 6. Ce que les captures ne montrent pas — et qui compte autant

| État | Question à laquelle il doit répondre |
| --- | --- |
| 500 personnes, 12 sites | La page tient-elle ? La bande « Live Pulse » est-elle utilisable ? |
| Aucun pointage du tout | Que voit-on ? Un parcours, ou 14 cartes vides ? |
| Borne hors ligne | Est-ce signalé, et où ? |
| Erreur de chargement | La page dit-elle « je n'ai pas pu lire » ou affiche-t-elle 0 ? |
| Hors connexion | Ce que je vois est-il daté ? |
| Rôle restreint | Que voit un administrateur d'entreprise sur un pointage d'une autre ? |
| Vue « Groupée » / « Liste » | Sont-elles aussi soignées que « Passeports » ? |
| Export CSV | Exporte-t-il la vue filtrée, et mentionne-t-il la source et l'heure ? |
| Impression / PDF | Un pointage imprimé reste-t-il lisible et daté ? |

**Le cas « erreur de chargement » est le plus dangereux** : si l'échec de lecture
affiche `0`, la page produit un **faux constat d'absence** — exactement le défaut
A1 de l'audit dashboard, transposé à la page de preuve.

---

## 7. Le dictionnaire appliqué à cette page

Les mots de la page Pointage, avec une définition unique. À écrire une fois, à
faire respecter partout.

| Terme | Définition | Ne doit jamais dire |
| --- | --- | --- |
| **Badgé** | Geste enregistré **et acquitté par le serveur**, avec méthode et heure | — |
| **Importé** | Geste venu d'une pointeuse externe, non badgé dans En-Check | « badgé » |
| **Pas encore pointé** | Aucun geste, fin de poste non atteinte | « absent » |
| **Absent non justifié** | Aucun geste **après** la fin de poste, aucune absence déclarée | « pas encore pointé » |
| **Session ouverte** | Entrée acquittée sans sortie | « durée 0sec », « durée — » |
| **Entrée hors créneau** | Entrée postérieure à la fin du poste prévu | « retard » |
| **En retard** | Entrée après le début prévu, **avant** la fin du poste | « hors créneau » |
| **Pause réelle** | Pause pointée par le salarié | « présumée » |
| **Pause présumée** | Pause déduite du planning, non pointée | figurer dans un total de pauses réelles |
| **Dans le périmètre** | Point situé dans une zone connue, **avec une précision suffisante** | s'afficher si la zone est inconnue |
| **Distance** | Écart entre le point et le site, **toujours accompagné de sa précision** | s'afficher seul |

Et trois règles d'affichage qui en découlent :

1. **Aucune conclusion de zone si `précision > distance`.**
2. **Aucun `0` présenté comme une mesure** — `0sec`, `0 %` de 0/0, barre à 5 %
   pour une valeur nulle.
3. **Aucune présomption dans un total de constats.**

---

## 8. À quoi la page devrait ressembler

Pas une refonte : **un ordre**. Quatre bandes, chacune répondant à une question.

### Bande 1 — « La donnée est-elle complète ? » (une ligne)

> `Données complètes · dernière synchronisation il y a 2 min`
> ou `⚠ 12 gestes non acquittés — la vue peut être incomplète`

C'est la bande qui manque le plus. Sans elle, tout le reste est incertain.

### Bande 2 — « Qui demande une décision ? »

> ⚠ **Hector H** — entrée à 17:11 pour un poste 08:00–17:00 · *arbitrer*
> ⚠ **Hippo B.** — session ouverte depuis 3h58 · *clôturer*
> ⚠ **Hippo B.** — en pause depuis 43 min · *voir*

Cinq lignes maximum, avec l'action. S'il n'y a rien : **une** ligne.

### Bande 3 — « Qui est là ? »

La bande « Live Pulse », avec forme + libellé (pas seulement la couleur), et un
titre qui dit le périmètre : « 14 personnes · 3 entreprises ».

### Bande 4 — « Le détail, pour enquêter »

Le graphique 24 h, les canaux, les cartes, l'export. C'est là qu'on va quand on
cherche quelque chose — pas là qu'on arrive.

**Le déplacement essentiel** : aujourd'hui, la page est organisée pour
**l'inventaire** (montrer les 14). Elle doit être organisée pour la
**décision** (montrer les 3 qui demandent quelque chose).

---

## 9. Ce que font les bons produits d'enquête, et qu'on peut copier

1. **Ils séparent le fait de l'hypothèse, visuellement.** Une présomption n'a
   jamais la même graisse, la même taille ni la même place qu'un constat.
2. **Ils refusent de conclure.** « Inconnu » est un état de première classe, pas
   un cas dégénéré. Une mesure imprécise le dit.
3. **Ils nomment leurs unités.** Jamais « 41 » ou « 14 % » sans base.
4. **Ils montrent la fraîcheur de la donnée.** Un horodatage est toujours
   visible.
5. **Ils ne mettent pas les actions destructrices au même niveau que les
   autres.** Modifier, partager, supprimer sont isolés et demandent une
   confirmation motivée.

---

## 10. Plan de correction

### Vague 1 — La vérité (3 à 5 jours)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 1.1 | Zone inconnue → « non vérifiable » | Aucun « dans le périmètre » sans zone connue |
| 1.2 | `précision > distance` → verdict indécis | Test avec 41 m / ±194 m : pas de conclusion |
| 1.3 | Fin de `0sec` | Aucune session ouverte n'affiche une durée chiffrée |
| 1.4 | Durée unifiée carte + tiroir | Les deux écrans donnent la même réponse |
| 1.5 | Pauses : compteurs séparés, présomption subordonnée | Le titre annonce le nombre de lignes réellement affichées |
| 1.6 | Canaux : une seule unité, pas de barre à 0 | Somme cohérente, aucune barre pour zéro |
| 1.7 | « Présence » renommée et déplacée | Aucun taux de présence dans la carte des canaux |
| 1.8 | Brancher `etatPresence.js` | Un seul vocabulaire sur trente écrans |

### Vague 2 — L'organisation (1 semaine)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 2.1 | Quatre bandes | La bande 2 tient dans les 300 premiers pixels |
| 2.2 | Regrouper les sans-pointage | Aucune carte pleine pour « rien » |
| 2.3 | Tri par défaut orienté conséquence | Le premier écran montre ce qui demande une décision |
| 2.4 | Filtre « À arbitrer » en premier | Un clic suffit pour voir les anomalies |
| 2.5 | Un seul rafraîchissement, compteur « 3 sur 14 », « tout effacer » | Aucun doublon de contrôle |
| 2.6 | Renommer les modes de vue | Aucun jargon à l'écran |

### Vague 3 — Le système (1 semaine)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 3.1 | Bandeau de fraîcheur de la donnée | Toujours visible, avec heure |
| 3.2 | Typographie ≥ 12 px | Mesuré, pas estimé |
| 3.3 | Statut : forme + libellé, pas couleur seule | Lisible en noir et blanc |
| 3.4 | Données de recette retirées | Aucun « RECETTE » en production |
| 3.5 | Pointages importés marqués à la source | Mention durable sur la carte et dans l'export |
| 3.6 | Carte / date : contrôles stylés | Aucun contrôle ressemblant à un bug |
| 3.7 | Modifier / Partager encadrés | Motif + permission + journal |
| 3.8 | Vérifier la pagination | Aucune troncature silencieuse |

**Total indicatif : 3 à 4 semaines**, hors décisions juridiques (A11) et hors
lot 0 de la feuille de route (intégrité de la synchronisation, qui se traite
dans le dépôt Pointage).

---

## 11. Ce que je ne recommande pas

| Tentation | Pourquoi non |
| --- | --- |
| **Ajouter des graphiques** | La page en a déjà quatre. Le problème est l'exactitude, pas la quantité. |
| **Refondre la direction artistique** | Elle est cohérente et validée. On corrige les données et l'ordre. |
| **Ajouter un « score de ponctualité »** | Un chiffre unique et opaque ne se défend devant personne. |
| **Masquer les cas incertains** | C'est l'inverse : un produit de preuve doit montrer ses incertitudes. |
| **Attendre la refonte pour corriger A1–A3** | Ce sont trois corrections localisées. Elles coûtent deux jours et sauvent la crédibilité. |

---

## 12. Les six tests qui diront si c'est réussi

| # | Test | Échec si |
| --- | --- | --- |
| T1 | Point GPS sans zone connue | La page affiche « dans le périmètre » |
| T2 | Point à 41 m avec précision ±194 m | La page conclut quoi que ce soit sur la zone |
| T3 | Session ouverte depuis 4 h, carte **et** tiroir | Les deux écrans ne disent pas la même chose, ou affichent `0sec` |
| T4 | Une pause réelle + une pause présumée | Le titre annonce 1 et deux blocs apparaissent |
| T5 | Ouvrir la page à 8 h, compte neuf | Douze cartes vides au lieu d'un parcours |
| T6 | Ouvrir en noir et blanc | On ne distingue plus « à l'heure » de « en retard » |

---

## 13. Registre

| Chantier | État | Preuve | Confirmation |
| --- | --- | --- | --- |
| §0 — commit lu, périmètre | résolu | `237ef6e` | — |
| Vague 1 — vérité de la preuve | à faire | — | — |
| Vague 2 — organisation | à faire | — | — |
| Vague 3 — système | à faire | — | — |
| Dictionnaire de données Pointage | à faire | — | — |
| Vérification de la pagination (C6) | à faire | — | — |
| Avis juridique sur « Ouvrir dans Google Maps » (A11) | à faire | — | — |

**Aucune ligne ne passera à « résolu et validé » sans réalisation constatée et
confirmation explicite du fondateur.** Une capture, un correctif déployé ou un
avis favorable ne constituent pas une preuve de réalisation.

---

## 14. En une phrase

**Cette page sait enquêter, mais elle ne sait pas encore se taire quand elle
ignore.** Un produit de preuve n'est pas celui qui affirme le plus : c'est celui
qui refuse de conclure quand sa mesure ne le permet pas — et qui le dit.

---

## Annexe — ce qui est vérifié, ce qui est mesuré

| Constat | Nature | Où |
| --- | --- | --- |
| « Dans le périmètre » sans zone connue | **vérifié** | `PointagesAfroTechSections.jsx:1533` |
| Précision et distance affichées sans règle | **vérifié** | `:1533-1536` |
| `formaterDureeComplete(0)` → `'0sec'` | **vérifié** | `timezoneUtils.js:362`, `:1509` |
| « Durée : — » sur carte pour session ouverte | **vérifié** | `:1226` |
| Compteur de pauses vs blocs affichés | **vérifié** | `:1580`, `:1611+` |
| Canaux non exclusifs, unités mélangées, plancher 5 % | **vérifié** | `:676-716` |
| Donut « Présence » dans la carte des canaux | **vérifié** | `:904`, `:719` |
| Tri par défaut `name_asc` | **vérifié** | `Pointages.jsx:702` |
| « Passeports » | **vérifié** | `Pointages.jsx:2022` |
| Lien Google Maps avec coordonnées | **vérifié** | `:1544-1553` |
| `etatPresence.js` non importé par la page | **vérifié** | 0 occurrence |
| Aucun seuil d'alerte de pause | **vérifié** | 0 occurrence |
| 12 cartes vides sur 14 | **mesuré à l'écran** | captures 1 et 3 |
| -75 %, 14 %, 50 non lues | **mesuré à l'écran** | capture 2 |
| Texte sous 12 px | **mesuré à l'écran** | captures 1 à 3 |
| Données de recette visibles | **mesuré à l'écran** | captures 1, 2, 3 |
| Entrée à 17:11 pour un poste 08:00–17:00 | **mesuré à l'écran** | capture 4 |
| Champ de date en carré vide | **mesuré à l'écran** | captures 2 et 3 |
