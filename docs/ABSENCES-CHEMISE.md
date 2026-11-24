# Absences · la chemise — en-tête de la page

**Le fond de l'affaire :** un objet de moins, pas un style de plus.

Fiche de pose de la figure retenue par le fondateur, maquette `maquettes/absences-titre-C-chemise.png` (28/11/2026) : « je choisis le C. Je veux exactement ce même rendu. »

## Ce qui a été mesuré avant de dessiner

Le reproche était « tu ne proposes que des formes carrées ». La mesure a répondu autre chose : **la charte n'a jamais forcé le carré**. D-016 met `999px` dans sa liste de rayons — le cercle et la pilule sont réglés — et D-017 possède déjà cinq formes non carrées (pilule, tampon, onglet, rabat au coin, bande de colle) plus le trait de feutre et le filet. Ce qui est défendu, c'est la courbe libre, le dégradé et le flou. Le carré était ma monotonie, pas la règle.

Ce que la mesure a trouvé, en revanche, c'est un bandeau **hors registre** :

| la page écrivait | la maison tient |
|---|---|
| `border: 1px` ×9 · `border: 2px` ×1 | contour **2 px** d'encre sur tout objet actif (C11) |
| `.abs-btn { min-height: 40px; font-size: 12.5px }`, sans capitales | boutons **36 px, capitales 700 / 9,5 px**, espacées 1,3 (C12) |
| `border-radius: 50%` sous l'empreinte | rayons **{6, 8, 11, 12, 999}** (C10) — la liste ne connaît pas les pourcentages |
| `font-weight: 740`, `'760'` ×2, `800` ×5, `500` ×10 | `public/fonts/` ne charge que **400 / 600 / 700** |
| `<span>` pour le titre de la page | un `h1` |
| `onClick={() => navigate('/dashboard')}` sous une flèche « retour » | `cibleRetour()` — on repart **d'où l'on vient** (journal du 24/11) |

Et `npm run charte` ne voit rien de ces six lignes : il balaie les `.css` et les valeurs en `px`. Les 78 rayons et les 22 graisses écrits en `style={…}` dans la page lui sont invisibles — défaut connu depuis le 22/11 (« une attribution en ligne bat n'importe quel sélecteur de feuille »).

## La figure

Avant : une bande de titre, et **sous elle** une rangée de trois onglets dans son propre conteneur — deux bordures, deux fonds, deux rayons, deux respirations. Maintenant : **une chemise de dossier**. Les onglets sortent du bord haut de la feuille.

La soudure tient à quatre nombres, et à rien d'autre :

1. `margin-bottom: calc(-1 * var(--charte-trait))` — la rangée plonge dans la feuille de l'épaisseur du trait ;
2. `z-index: 1` sur la rangée, `0` sur la feuille — elle peint **par-dessus** le contour ;
3. `align-items: flex-end` et une hauteur unique de 36 px — les trois socles sont au même y ;
4. l'onglet ouvert : `border-bottom: 0` **et** `padding-bottom: var(--charte-trait)` (les 2 px qu'il ne borde plus, pour que les trois libellés tiennent la même ligne de base), avec `background: var(--charte-surface)`, le **même jeton** que la feuille.

C'est le quatrième qui fait la figure : l'onglet courant n'a pas de bordure basse parce que sa pâte est celle de la feuille — les deux contours se continuent, un seul objet. Les deux onglets fermés gardent leur bordure basse, qui tombe exactement sur le trait de la feuille : une ligne, pas deux.

Le kit fournit les deux commandes (`ch-btn-contour`, `ch-btn-pleine`) : la page ne s'est pas refaite de boutons à son compte, c'était le reproche. Ici et nulle part ailleurs, ils prennent la pilule, par une règle scopingée sous `.abs-chemise` — les `ch-btn-*` des autres écrans gardent leurs 6 px. Le repère de l'onglet courant est une barre d'encre sous le libellé, posée en `box-shadow` à flou zéro.

## Ce que la maquette dessinait, et qui n'a pas été recopié

* **Ses épaules d'onglet sont des courbes en S et son rayon fait ~24 px.** D-016/C10 : deux coins du haut à 6 px, bords droits.
* **Son troisième onglet dit « Congés ».** Le libellé réel est « Configuration congés » — un libellé entier ne se rogne pas pour tenir dans une image.
* **Son titre est en deux graisses** (« En-Check » plus lourd que le reste). Non recopié : ça exige de couper la chaîne en deux composants, et le titre était déjà une seule chaîne de 20 px à 700.
* **Ses onglets n'ont pas d'icônes.** Gardé sans icône, donc : le libellé nomme la section, l'icône la répétait. `CalendarOff`, `Inbox` et `CalendarDays` restent utilisés ailleurs dans la page.
* **La pilule des deux commandes** est la seule entorse assumée au gabarit du kit : elle est écrite, scopingée, et justifiée par le retour à 34 px qui emploie déjà `999px` pour un objet qui se clique. À effacer d'une ligne si vous la voulez rectangulaire.

## Retirés avec la bande

`.abs-topbar`, `.abs-topbar-inner`, `.abs-topbar-left/.right`, `.abs-back-btn`, `.abs-brand*`, `.abs-section-tabs .tab-btn`, l'objet de styles `TAB` (quatre réglages qui n'avaient plus de lecteur), l'`import EnCheckBrandMark` de la page (il vit dans la chemise), `ArrowLeft` et `Plus` de son import lucide, et `animation: 'pulse 2s ease infinite'` sur la pastille d'alerte — **la maison ne fait pas respirer ses chiffres**.

## Les chiffres

| mesure | base `f6af8f9` | après |
|---|---|---|
| `vitest run` | 194 fichiers · **2719 ✓** | 195 fichiers · **2728 ✓** (+9, aucun retiré) |
| `vite build` | ✓ | ✓ 18,8 s |
| `npm run charte` · couleurs en dur | 4548 · 185 fichiers | **4548 · 185** |
| `npm run charte` · ombres floues | 131 | **131** |
| `npm run charte` · rayons hors liste | 359 · 18 valeurs | **359 · 18** |
| `npm run charte` · mesures (tailles · marges · rayons distincts) | 65 · 44 · 27 | **65 · 44 · 27** |
| `eslint src` | 242 erreurs · 64 avertissements | **242 · 64** |

La nouvelle plage de la feuille (`from .abs-chemise { to .abs-raccourcis`) porte **0 hexadécimal, 0 `blur(`, 0 dégradé**, quatre rayons qui sont tous des jetons du kit, trois graisses parmi 400/600/700, et des espacements pris dans l'échelle de D-013. Le contrat `absencesChemise.test.jsx` le compte sur la plage, commentaires retirés — au premier essai il criait sur le mot `50%` écrit dans une phrase d'explication.

## Ce qui n'est pas fait

1. **Le reste de la page garde ses six entorses** : `.abs-btn` est toujours à 40 px / 12,5 px / rayon 11 dans les tiroirs et la barre d'outils, et les `500`/`800` inline vivent dans les autres sections. Une section à la fois — le contrat verrouille d'ailleurs explicitement que *rien* de tout ça n'a été touché par cette tranche (`laisse le kit et le reste de la page où ils sont`).
2. **`.abs-page .tab-btn[aria-pressed='true']` (ambre + `!important`) reste en place** : il habille encore les onglets de la modale fiche employé, montée dans la page. Le repeindre n'était pas demandé ; c'est la prochaine décision possible.
3. **La capture réelle** : aucun navigateur ici. La géométrie de la soudure est prouvée par les quatre nombres et par `renderToStaticMarkup`, pas par un coup d'œil — les 2 px de plongée à 1560 px comme à 380 px restent à voir.
4. Le bogolan « servira autrement » : toujours non spécifié.
