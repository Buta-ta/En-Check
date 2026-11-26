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
