# Absences · l'étagère — les six compteurs, pendus sous le transat

**Le fond de l'affaire :** une planche, et une planche s'accroche. Pas une carte de plus.

Fiche de pose de la figure retenue par le fondateur, maquette `maquettes/absences-kpi-P1-etagere.png` (30/11/2026) : « je choisis le P1, l'étagère sous le transat [...] tu peux coder. Je veux le résultat comme dans la maquette choisie ». Une seule réserve l'accompagnait, et c'est elle qui a décidé de l'architecture : « faudrait juste penser à comment rendre ça responsive en tout écran ».

## Ce qui a été mesuré avant de dessiner

La bande de synthèse écrivait six lanières d'un même ruban, séparées par des filets (`border-left` sur la voisine de droite), deux lanières plus larges que les autres parce qu'elles portaient une poche de renvoi. Et tout son dessin vivait dans **un `<style>` embarqué dans le composant**, avec dix-sept `style={…}` en ligne.

Ce que la mesure a trouvé là-dessus :

| la page écrivait | la maison tient |
|---|---|
| `<style>…</style>` dans le JSX + 17 `style={…}` | `npm run charte` ne lit **que les `.css`** : cette peinture était hors compteur depuis le 22/11 |
| `grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 1.15fr) minmax(0, 1.35fr)` | six questions de même poids ; la poche ne vole pas la largeur de sa voisine |
| `text-overflow: ellipsis` sur le libellé | un libellé entier ne se rogne pas — il passe sur deux lignes |
| `borderRadius: '50%'` sous le visage | `border-radius: var(--charte-rayon-pilule)` : même disque, et le jeton est la loi (C10 ne connaît pas les pourcentages) |
| `fontWeight: 800` en ligne | `public/fonts/` ne charge que **400 / 600 / 700** |
| la hauteur de la corde recopiée en dur, la teinte de survol en `rgba()` | deux nombres en ligne seulement, et venus des données : la largeur d'une jauge, le diamètre d'un visage |

## La figure

Six pancartes de bois dans une rangée de six cases, chacune pendue à un rail par deux cordes et deux anneaux ; au-dessus de la rangée, un rang de deux longues cordes scellées à raz du bas du transat. Le corps d'une pancarte est soit un `div` (le chiffre renseigne), soit un `button` (le chiffre mène au bon filtre) — le survol répond en `--charte-surface2`, jamais en ambre, jamais en `!important`. La couture oblique des conflits (`repeating-linear-gradient(135deg, …)`) et les deux jauges restent ; `VOIR` redevient un rabat posé **sur** la planche, en `pointer-events: none`, pour que le clic reste sur toute la planche.

## Le geste qui rend l'affaire responsive

**Le rail est porté par la planche, pas par la rangée.** Une règle, un sélecteur :

```css
.abs-planche::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: var(--abs-tringle); }
.abs-etagere-planches { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--charte-espace-4) 0; }
```

Deux conséquences, et c'est tout le système :

1. **les colonnes n'ont aucun écart** (`gap: 16px 0`) → les six tronçons de rail se collent en un trait continu ; l'air entre les planches est porté par le retrait du bois de chacune (`margin: 0 var(--charte-espace-2)`), pas par la grille ;
2. **le rail descend avec la case** → quand une coupe passe de six à trois, puis deux, puis une planche par rang, chaque rang reçoit son propre rail et son propre étage de cordes. **Aucune media-query n'a donc à repositionner une tringle** : les trois coupures ne touchent qu'à `grid-template-columns`. Un verrou lit chaque bloc média et interdit `left:` / `right:` / `top:` / `bottom:` — c'est ce qui empêche quelqu'un de « corriger » le rail à la main sur une seule largeur.

Les coupures : **1180 → trois et trois · 680 → deux-deux-deux · 420 → une**. Jamais l'évaporation en une colonne avant 420 px : une figure qui se dissout en petit écran est un habillage, pas de la menuiserie. Et **aucune hauteur figée** — `min-height` sur le corps (88 px), parce qu'à 900 px un libellé tient sur quatre lignes et qu'une planche qui rognerait son mot est une planche muette.

## Ce que la maquette dessinait, et qui n'a pas été recopié

* **Ses deux longues cordes montaient jusqu'au bandeau de titre, en traversant le transat.** Non fait, et c'est la seule entorse assumée : la hauteur réelle de ce bloc n'est lisible nulle part en CSS — la tuile se remonte elle-même de 46 px (`margin: -46px auto 0`) et sa hauteur vient d'un corps de 32 px. La maquette portait un `--abs-transat: 164px` calculé depuis un `padding: 20px 0 26px` **lu à moitié** : le vrai bloc vaut 20 + 118 + 26 + la tuile. Plutôt que figer un nombre faux de dizaines de pixels, la chute est un jeton de l'échelle (`--charte-espace-5`). À reprendre avec une mesure runtime si le fondateur veut la corde jusqu'à la chemise.
* **`0,4 %`** était un chiffre de mon prompt d'image, jamais lu en base. La planche garde le calcul réel (`jours décomptés / jours ouvrés de l'effectif`).
* **Ses planches débordaient des poteaux** : largeurs dessinées à une échelle qui n'est pas celle de la page — `<main>` plafonne à `maxWidth: 1200`, pas 1560. Un verrou dit le fait : *ce qui est durcit est la borne, pas l'illusion*.
* **Ses visages étaient dessinés deux par planche**, six au total. Ici : les absents du jour seulement, quatre au plus, plus le `+N` — et la rangée n'est pas rendue à zéro absent, pour qu'aucun trou ne bâille dans le bois.
* **`VOIR`** apparaissait deux fois dans l'image, comme une planche de plus. Ici le rabat se pose **sur** la planche qui mène quelque part — donc une fois par planche actionnable, zéro quand il n'y a rien à traiter : un libellé d'action muet est une promesse vide.

## Deux accidents de chemin, écrits pour ne pas être refaits

1. **Un jeton inventé ne lève pas d'erreur, il tombe en zéro.** La maquette employait `--abs-espace-1…6`, qu'elle s'était déclarés à elle-même. Recopiés tels quels dans `AbsencesAfroTech.css`, ces cinq noms n'y sont définis nulle part : `gap` et `margin` retombent à 0, l'étagère se soude sans un air, et rien dans la console ne le dit. Un test lit maintenant chaque `var(--)` de la plage et le confronte aux déclarations réelles (`tokens.css` + la feuille). C'est le seul genre de verrou qui attrape ce genre de faute sans navigateur.
2. **La descente de la peinture dans la feuille inverse un risque.** Les verrous 13-18 de `absencesKpiCards.test.jsx` lisaient des bouts de chaîne dans le markup en ligne (`font-size:20px`, `clip-path:…`, `repeat(4, …)`) : le markup ne les contient plus, ils lisent la feuille. Et la feuille, elle, est désormais **comptée** par `npm run charte` — c'est ce qu'on voulait, à condition de vérifier que les compteurs n'ont pas bougé.

## Gelés, et vérifiés comme tels

* **La chemise** (bloc titre + sous-titre + onglets soudés) n'a rien gagné : ni œillet, ni crochet, ni seconde tringle, `clip-path` absent de sa plage. Un verrou interdit tout sélecteur `.abs-chemise` écrit **après** le marqueur de l'étagère — la bande s'accroche sous la feuille, elle ne la perce pas.
* **Le transat** se suspend où il est : aucune corde inventée par-derrière, et le composant de la bande ne prononce pas `abs-hamac`.
* **Les nombres de la soudure** (`margin-bottom: calc(-1 * var(--charte-trait))`, `z-index: 1`, 36 px, la pâte commune) — repris à l'identique dans `absencesSectionHaut.test.jsx`.

## Égout d'à côté, cueilli en passant

La feuille portait **deux blocs `@media (max-width: 980px)`** pour le transat, le second écrit `@media(max-width:980px)` sans espaces — donc invisible aux greffes comme aux recherches, et répétant les mêmes règles avec un `text-align: center` en plus. Les deux n'en font plus qu'un, avec le `text-align` repris là où il servait. Deux blocs au même point de rupture, c'est un qui gagne et un qui endort la lecture.

## Les chiffres

| mesure | base `8ca43df` | après |
|---|---|---|
| `npx vitest run` | 195 fichiers · **2728 ✓** | 196 fichiers · **2744 ✓** (+16, aucun retiré) |
| `npx vite build` | ✓ | ✓ 21,7 s |
| `npm run charte` · couleurs en dur | 4548 · 185 fichiers | **4548 · 185** |
| `npm run charte` · ombres floues | 131 | **131** |
| `npm run charte` · rayons hors liste | 359 · 18 valeurs | **359 · 18** |
| `npm run charte` · mesures (tailles · marges · rayons distincts) | 65 · 44 · 27 | **65 · 44 · 27** |
| `npx eslint` sur les trois fichiers touchés | — | **silence** |

## Ce qu'on ne peut pas prouver ici

Pas de navigateur dans l'atelier : les rapports, les coupures et l'absence de jeton fantôme sont tenus par les 16 verrous de `src/services/__tests__/absencesEtagere.test.jsx`, **le tracé à l'œil reste à faire sur la preview** — six largeurs, de 1560 à 360 px. Ce qu'on y regarde en premier : la continuité du rail d'une planche à l'autre (un décalage d'un pixel se voit), l'anneau posé sur le rail et non à côté, et le `+N` des visages qui ne doit pas chevaucher le chiffre quand une planche passe à deux lignes de libellé.

## Et après

1. La corde jusqu'à la chemise, avec une hauteur mesurée (`ResizeObserver`) au lieu d'un nombre recopié — à ne faire **que** si le fondateur la veut.
2. Le même tri pour les trois autres écrans qui portent encore un `<style>` embarqué : la charte ne les voit toujours pas.
