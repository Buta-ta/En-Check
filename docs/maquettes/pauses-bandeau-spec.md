# Bandeau Pauses — spec mesurée sur la maquette B

Source : `image-23.png`, 1420 × 306 px. Toutes les valeurs ci-dessous sont
**relevées au pixel** sur cette image (détection des contours sombres,
composantes connexes, échantillonnage des teintes), puis ramenées au ratio.
Un rendu à 1420 px de large doit donc être à l'échelle 1:1.

La maquette est un bandeau illustré, pas une barre d'outils. C'est le point
que le premier rendu avait manqué : les pièces y sont deux fois plus grandes.

## Palette

| rôle | hex | usage |
|---|---|---|
| papier | `#F4EBDA` | fond du bandeau |
| encre | `#2A1809` | tous les traits, les titres |
| terre | `#B86734` | pilule active, bouton d'ajout |
| carte | `#FFFCF1` | carte du profil, pilule entreprise |
| indigo | `#232B42` | disque de l'avatar |

## Géométrie (px, base 1420)

| pièce | x | y | largeur | hauteur | note |
|---|---|---|---|---|---|
| cercle retour | 35 | 117 | 68 | 69 | centre vertical y=152 |
| sceau du pied | 121 | 57 | 191 | 191 | double trait, pied illustré |
| « PAUSES » | 338 | 87 | ~310 | ~100 | capitale ~100 px, très gras |
| sticker « EN-CHECK » | ~620 | 115 | ~125 | ~65 | incliné, mord le S |
| devise | 410 | 240 | ~290 | 13 | micro-caps, très espacée |
| étiquette date | 717 | 51 | 304 | 98 | œillet + double ficelle |
| flèches ‹ › | 989 | 69 | 86 | 43 | deux cercles séparés, à droite |
| pilule « SEMAINE » | ~860 | ~120 | ~150 | ~50 | pleine terre, texte crème |
| pilule entreprise | 749 | 214 | 325 | 56 | chevron › à droite |
| cercle « CSV » | 1089 | 209 | 65 | 65 | cercle, pas une pilule |
| bouton ajout | 1093 | 119 | 299 | 79 | pilule terre, double ombre |
| avatar | 1184 | 29 | 67 | 67 | anneau indigo, AU-DESSUS |
| carte profil | ~1245 | ~30 | ~155 | ~45 | deux lignes, papier carte |

## Ce qui n'est pas dans la maquette (décisions à porter)

- **trois modes** : la maquette n'en montre qu'un (« SEMAINE »). Décision du
  25/11 : on garde CETTE pilule, et un clic ouvre Jour / Semaine / Mois.
- **« Aujourd'hui »** n'existe pas sur la maquette : il entre dans ce menu.
- **survol, focus, thème sombre, mobile** : non dessinés. Déclinés depuis la
  charte, sans toucher à la géométrie du clair.

---

## 2ᵉ passe — la taille à l'écran (26/11, après retour utilisateur)

Le dessin était juste, mais **trop gros** sur un écran de 1420 px. Il fallait
le réduire sans le redessiner : la composition est une géométrie absolue
mesurée, la déformer pièce par pièce aurait défait tout le travail de la
première passe.

### La planche

Le bandeau est enveloppé dans `.pauses-v2-planche`, qui porte **un seul
facteur d'échelle** :

```css
.pauses-v2-planche {
  --pv-echelle: 1;
  width: 1420px; height: 306px;
  transform: scale(var(--pv-echelle));
  transform-origin: top left;
  margin-bottom: calc(16px - 306px * (1 - var(--pv-echelle)));
  margin-right:  calc(-1420px * (1 - var(--pv-echelle)));
}
```

`transform` ne change pas la boîte : la planche occupe toujours 1420 px dans
le flux. Les deux marges négatives récupèrent la place, sinon le contenu
suivant flotterait 100 à 300 px trop bas. **C'est le piège de cette
approche** — sans elles, tout le reste de la page est décalé.

### Les paliers

| largeur d'écran | échelle | hauteur rendue |
|---|---|---|
| ≥ 1420 px | 1 | 306 |
| 1300 – 1419 | 0,90 | 275 |
| 1150 – 1299 | 0,82 | 251 |
| 1030 – 1149 | 0,72 | 220 |
| < 1030 | composition abandonnée → empilement | auto |

Sous 1030 px, le dessin réduit donnerait des capitales de 9 px : on quitte
la composition absolue pour un flux empilé. C'est un **compromis assumé** —
la fidélité au dessin n'a de sens que si on peut le lire.

### Deux pièges rencontrés

1. **Un `<svg>` ne peut pas servir de planche.** Il découpe toujours son
   contenu à son ratio : en `foreignObject`, les pièces en position absolue
   sortaient du cadre (hauteur mesurée : 10 px), et `display: contents`
   sur le SVG ne rend pas les enfants au flux. Approche abandonnée.
2. **L'ordre des media queries compte.** Les règles de la composition
   (absolues, largeurs en dur) et celles du mobile ont la même spécificité :
   placé au milieu du fichier, le bloc mobile perdait l'arbitrage et le
   bandeau restait en absolu sur téléphone (planche de 16 px, débordement).
   **Le bloc mobile vit donc en fin de fichier.**

### Réglage

Pour réduire le bandeau d'un cran sur tous les écrans, baisser les trois
paliers de 0,10 dans les media queries `1419`, `1300`, `1150`.
