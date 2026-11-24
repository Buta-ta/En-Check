# Absences · l'en-tête et sa lisière — contrat de lecture

**Branche :** `arena/ac9d3889-en-check`, base `main 8483b19`.
**Maquette retenue :** `maquettes/absences-en-tete-lisiere.png` (option 1 du 26/11/2026).
**Périmètre :** UNIQUEMENT la section de la deuxième capture du fondateur — la ligne
d'en-tête (retour, marque patte, titre, sous-titre, lune, Export, + Déclarer) et le rail
de raccourcis qui la clôt. Rien en dessous.

## Pourquoi cette fiche existe

Verbatim du fondateur : « tu n'as fait qu'entourer l'ancienne page absence d'une bande
motif. je ne veux pas de ça. Retravaillons section par section. »

C'est exact, et le diff le prouve : #327 pose `<PageCulturalBand placement="cadre">` en
`position: absolute; inset: 0` **sur le `<main>` entier** (`src/pages/Absences.jsx:1831`
ouverture du cadre, `:1833` la feuille ; fermeture lignes 2534-2535). Le motif court donc le long de toute la
page — un liseré de 26 px autour de tout, y compris du tableau. Ce n'est pas une section
retravaillée, c'est un cadre peint autour de l'existant. À défaire.

---

## A. La section, telle qu'elle était écrite

*(lu sur `8483b19`, le commit de production d'avant cette tranche — les numéros de lignes sont ceux d'alors ; §E dit ce qui en a été défait)*

### la ligne du haut (`src/pages/Absences.jsx:1776-1813`)

| élément | classe | ce qu'il est vraiment aujourd'hui |
|---|---|---|
| contenant | `.abs-topbar` | **une carte flottante** : `position: sticky; top: 8px`, `margin: 8px 14px 0`, `border-radius: 18px`, fond `--abs-bg-elevated`, bordure 1 px, `box-shadow: var(--abs-shadow)`, **`backdrop-filter: blur(14px)`** (`src/pages/AbsencesAfroTech.css:98-109`) |
| rangée intérieure | `.abs-topbar-inner` | `max-width: 1560px`, flex `space-between`, `flex-wrap: wrap` (`:111-119`) |
| retour | `.abs-back-btn` | 36×36, `border-radius: 11px`, icône `ArrowLeft` ; au survol **il se déplace de 2 px** (`transform: translateX(-2px)`, `:143-148`) |
| marque | `.abs-brand-mark` | 42×42, `border-radius: 12px`, **dégradé** `linear-gradient(135deg, rgba(245,158,11,.16), rgba(16,185,129,.1))` + bordure `rgba(245,158,11,.28)` (`:223-233`) — trois `rgba()` en dur, dont un vert émeraude que la charte d'Absences ne connaît pas |
| titre | `.abs-brand-title` | **16 px**, `font-weight: 800` (`:241-246`) — la maquette le montre en capitales à ~20 px |
| sous-titre | `.abs-brand-sub` | 11 px, `--abs-text-faint` (`:248-252`) |
| lune / soleil | `.abs-btn.abs-theme-btn` | 38×38, **`border-radius: 50%`** (pastille ronde), `data-testid="abs-theme-toggle"` (`:321-328`) — la maquette le montre **carré** |
| Export | `.abs-btn` | contour 1 px, fond `--abs-bg-soft`, `min-height: 40px`, `border-radius: 11px`, icône + mot (`:298-315`) |
| + Déclarer | `.abs-btn.abs-btn-primary` | **dégradé** `linear-gradient(135deg, var(--abs-copper), #8C3418)`, texte `#FFF5E6`, `border: none` (`:330-335`) — la maquette le montre en **aplat unique**, pas en dégradé, et en `#A26537` (argile de la charte), pas en cuivre foncé |

### le rail de raccourcis (`src/pages/Absences.jsx:1815-1818`)

Une seule ligne de JSX : `<div className="abs-topbar-nav"><RaccourcisPages /></div>`.
`RaccourcisPages` (`src/components/RaccourcisPages.jsx`, 68 lignes) rend un `<nav
aria-label="Aller à une autre page">` de six `<Link>` — Pointages, Planning, Absences,
Fiches de paie, Employés, Rapports — chacun avec **une icône lucide de 13 px** et son
libellé ; la page courante porte `data-actif="oui"` **et `aria-current="page"`, et son
lien devient inerte** (`onClick` absent, mais le `Link` reste cliquable : `cursor:
default`, ligne 208 du CSS).

Le style vit dans la feuille d'Absences, **sans préfixe de page** :

```
.abs-raccourcis { display: inline-flex; padding: 4px; border: 1px solid var(--abs-border);
                  border-radius: 999px; background: var(--abs-bg-soft); }   → une pilule
.abs-raccourci  { padding: 5px 11px; border-radius: 999px; font-size: 11px;
                  font-weight: 740; color: var(--abs-text-soft); }           → des pilules
.abs-raccourci[data-actif='oui'] { color: #1C130C;
                  background: linear-gradient(135deg, #F0A86E, #D9884A); }  → dégradé cuivre
```
(`src/pages/AbsencesAfroTech.css:160-213`, actif en `:208-212`)

**Deux dettes que la maquette force à regarder :**
1. `.abs-raccourcis` et `.abs-raccourci` ne sont **pas scopées** à la page Absences : elles
   vivent dans une feuille chargée globalement. Les 16 autres pages qui emploient
   `RaccourcisPages` (Administrateurs, Analytics, Annonces, Configuration pointeuse,
   Entreprises, Géopointage, Jours fériés, Messages système, Mon compte admin, Paie,
   Prospection, Rapports, Reconnaissance faciale, Rémunérations, Employés, Pointages)
   s'en protègent en **re-scopeant avec leur préfixe** (`.aa-raccourcis .abs-raccourcis`,
   `.paie-page .abs-raccourcis`, `.emp-barre .abs-raccourcis`, `.jf-raccourcis …`). Toute règle nouvelle posée
   nue sur `.abs-raccourci` **fuiterait** sur ces pages. D'où : `.abs-topbar-nav` en
   préfixe (cette classe n'appartient qu'à Absences — vérifié : 1 occurrence en JSX,
   `src/pages/Absences.jsx:1816`, et 1 en CSS, `:150`).
2. `font-weight: 740` n'existe pas dans la fonte : IBM Plex Sans n'a que 400/500/600/700.
   Le navigateur arrondit à 700, mais le nombre est un mensonge dans le code.

### ce qui descend de #327 et gêne ici

- `.abs-onglets-rabats` (même fichier, `:464-465`) : les trois onglets de section sont remontés
  de 18 px **à cheval sur le bandeau** `#327` — bandeau qui part avec le cadre. Il faut
  rendre ces onglets à leur rangée, sinon ils flotteront dans le vide.
- La couture pointillée `.abs-section-papier .toolbar-top` (`:479`) est pendue à
  `.abs-section-papier` : disparu le papier, disparue la couture.
- `abs-couture-alerte` (`:483-484`) et la tuile `.abs-tuile` (`:474`) ne dépendent pas du
  cadre : eux survivent au démontage.

---

## B. Ce que la maquette retenue demande, point par point

1. **La ligne du haut n'est plus une carte.** Elle est posée à cru sur le sable de la page :
   pas de pilule, pas de rayon de 18 px, pas de flou, pas d'ombre. Le fond ivoire
   `#FBF4E9` qui apparaît dans l'image est une feuille **pleine largeur**, pas un carton
   flottant.
2. **Le titre est en capitales, à ~20 px**, en `IBM Plex Sans` 700, `#2A1708`. Le sous-titre
   reste en dessous, entier, jamais tronqué. La marque est une pastille **ronde** brun
   très foncé (`--charte-tissu #3A2416`) avec l'empreinte de patte en sable — plus de
   dégradé ambre/émeraude.
3. **La lisière de bogolan est le bord bas de la section** : une bande pleine largeur de
   ~34 px, motif peint (losanges, chevrons, pointillés), `#3A2416` sur ocre. Elle
   n'entoure rien. Elle **clôt**.
4. **Le rail de raccourcis devient six rabats pendus sous la lisière** : des papiers
   rectangulaires (angle haut-droit arrondi) agrafés sous le tissu, couture en pointillés
   visible le long des trois autres bords, léger ombré porté. Le rabat courant
   (`Absences`) est peint en argile `#A26537`, texte `#FFFDF7`. Les autres : papier sable
   clair, texte `#2A1708` — **jamais blanc pur**.
5. **À droite, trois commandes seulement**, sur la même ligne de base : lune **carrée**
   (contour simple), « Export » (contour simple, icône de téléchargement), « + Déclarer »
   (aplat argile `#A26537`, texte blanc cassé). Pas de deuxième Déclarer, pas de deuxième
   Export : c'est le point que la maquette du 24/11 avait déjà réglé et que le code tient
   depuis #327 (`onClick={handleExportCSV}` et `onClick={() => handleAdd()}` une seule fois
   chacun dans la page).
6. **Aucun chiffre en attente dans cette section, dans le dessin** (sauf le « 1 » du rabat
   actif — voir § C.2).

## C. Ce que le code contredit, ou ne permet pas

1. **Un rabat n'a pas de compteur.** `RaccourcisPages` ne reçoit **aucune prop de compte**
   (signature ligne 30 : `{ pages, compact, excludePaths }`). Le « 1 » peint sur le rabat
   `Absences` de la maquette vient du compteur d'absences, qui aujourd'hui vit sur les
   **onglets de section** (`{absences.length}`, `src/pages/Absences.jsx:1826`). Le poser sur
   le rabat = soit le dupliquer, soit le déplacer hors des onglets — décision à prendre, pas
   une ligne à écrire.
2. **Le composant est partagé par 15 écrans** — mesuré ce tour-ci : 15 fichiers montent
   `<RaccourcisPages>` (Absences et 14 autres), et 11 feuilles CSS touchent déjà
   `.abs-raccourci*` pour les habiller. Lui ajouter un compteur en dur le ferait pousser
   partout ou nulle part ; il a donc fallu une prop neuve et optionnelle
   (`comptes={{ '/absences': n }}`), câblée ici seulement — c'est ce que fait §E.5.
3. **Le motif de la page est déjà bogolan** depuis #327 (`src/components/culturalMotif.js:41`
   renvoie `'bogolan'` pour `absences`) : la lisière de la maquette n'invente rien, elle
   **déplace** l'usage du motif — de `placement="cadre"` vers une bande basse de section.
   L'image employée est `public/images/paie-bogolan-haut.webp` (1536×76). À 34 px de haut,
   `background-size: auto 100%` la réduit d'un facteur 2,2 : le motif reste lisible.
4. **Le `sticky` est un choix, pas un acquis** : `.abs-topbar` colle à 8 px du haut avec
   `z-index: 60`. La maquette ne dit rien du défilement. Si la lisière et les rabats
   restent collants, le haut de page est pris ; s'ils ne le sont plus, le rail disparaît au
   scroll.
5. **Les icônes dans les boutons contredisent D-014** (« aucun pictogramme dans les
   boutons ») : `ArrowLeft`, `Download`, `Plus`, les six pictos du rail. La maquette les
   montre **avec** leurs icônes. Je ne les retire pas sans qu'il le dise.

## D. Les défauts de l'image, à ne pas reproduire

- Les libellés des rabats sont bons, mais le « 1 » du rabat actif est un cercle blanc
  collé en bas à droite, à cheval sur la couture : à l'écran, à 11 px, il se lira comme une
  tache.
- Le rabat actif est peint **par-dessus** la lisière et masque le motif sur toute sa
  largeur : le tissu disparaît derrière lui. À l'implémentation, le rabat actif doit
  descendre plus bas (crête) et non effacer le motif.
- Le tissu de la maquette est peint en ocre/orange vif ; la charte du bogolan, elle, est
  `--charte-tissu #3A2416` en fond avec l'argile `#A26537` pour le motif. L'image est plus
  chaude que la page ne l'autorise.
- Les quatre rabats de droite sont alignés plus bas que les deux de gauche (le dessin a
  dérapé d'un demi-rabat) : à l'écran, une seule ligne de base, sinon ça se voit.

## E. Ce qui a été posé (tranche du 26/11), et où le code diffère du dessin

Le rendu de la section suit la maquette retenue, `maquettes/absences-en-tete-lisiere.png`,
option de gauche. Ce qui a été écrit, dans les trois seuls fichiers de la page :

| # | La maquette demande | Le code |
|---|---|---|
| 1 | plus de carte : une feuille posée | `.abs-topbar` : ni `position: sticky`, ni `z-index`, ni `backdrop-filter`, ni rayon (`border-radius: 0`), ni ombre (`box-shadow: none`), ni `margin: 8px 14px 0`. Fond `--abs-bg-elevated`, pleine largeur. La rangée intérieure garde son `max-width: 1560px` — sinon le titre est à 2 560 px du bouton. |
| 2 | titre en capitales à ~20 px | `.abs-brand-title` : 16 px → **20 px / 700**. Pas 800 : IBM Plex Sans s'arrête à 700, et un nombre que la police ne possède pas n'est pas une graisse, c'est une attente déçue. |
| 3 | la lisière **clôt**, elle n'entoure pas | `<AbsencesCulturalBand position="tete"/>`, frère de la feuille (plus son enfant), 34 px (`--abs-bogolan-tete`), `background-size: auto 100%` sur `public/images/paie-bogolan-haut.webp` (1536×76) : le tissu se réduit d'une hauteur, jamais d'une largeur. Le cadre à quatre côtés (`abs-section-cadre`, `abs-section-papier`, la remontée `calc(var(--abs-cadre) * -1 + 8px)`) est supprimé du JSX **et** de la feuille. |
| 4 | six rabats pendus sous le tissu | `.abs-topbar-nav` : grille `repeat(6, minmax(0, 1fr))`, rabat = papier `--abs-bg-elevated`, `border: 1px dashed`, bord haut ouvert (il est cousu là), `border-radius: 0 12px 12px 12px`, ombré porté `2px 2px 0` — pas de flou (C9). **Le papier glisse SOUS le bogolan** : la lisière porte `z-index: 1`, le rail `z-index: 0`, et `margin-top: -14px` enfonce les six rabats dans le bas du tissu sans l'effacer ; `padding-top: 20px` pour que le mot commence juste sous la toile, pas dedans. **Tout est préfixé `.abs-topbar-nav`** : `.abs-raccourci` est une classe globale que 14 autres pages re-scopent dans 10 feuilles CSS. |
| 5 | le compte est **sur** le rabat | `RaccourcisPages` reçoit une prop neuve `comptes={{ '/absences': absences.length }}` ; la pastille `.abs-topbar-nav .abs-raccourci-compte` vit en bas-droite du rabat. Et `{absences.length}` a **quitté** l'onglet « Absences » : le même chiffre ne se dit pas deux fois à l'écran. Les deux badges voisins restent, eux comptent d'autres choses. |
| 6 | lune carrée, Export contour, + Déclarer aplat | `.abs-theme-btn` : `border-radius: 50%` → `11px`. `.abs-btn-primary` : le dégradé cuivre → un aplat. Les pictogrammes du rail sont rendus muets sur cette page (`display: none`), parce que le dessin ne les montre pas ; ceux des trois boutons restent, la maquette les a dessinés. |
| 7 | petite largeur | 3 rabats par rang sous 980 px (le rail partagé pose `white-space: nowrap` : un libellé à l'étroit déborderait du papier), lisière à 26 px sous 650 px. |

**Cinq écarts, dits à voix haute — la maquette n'est pas un calque.**

1. **La pastille de la marque n'est pas inversée.** Le dessin pose un disque brun
   `#3A2416` avec une patte sable ; `EnCheckBrandMark` fait l'inverse (disque sable,
   patte brune) et c'est la même empreinte sur quinze écrans. Refaire une couleur de
   marque pour une seule page casserait plus que la reprise n'en répare. Ce qui a été
   défait, c'est le fond ambre/émeraude du contenant, qui peignait un second disque
   sous le premier : `.abs-brand-mark` est maintenant transparent, rond, et rogne
   l'empreinte sans la repeindre.
2. **L'argile n'est pas l'ocre de l'image.** `--abs-copper` seul, à plat sous un texte
   blanc cassé, fait 3,9:1 en clair — sous le seuil. Le remplissage des aplats est
   donc `--abs-argile: color-mix(in srgb, var(--abs-copper) 78%, var(--charte-tissu))` :
   ~5,1:1 dans les deux thèmes, et le brun du bogolan est le même que celui du tissu.
   Le motif sert d'encre, pas seulement de fond.
3. **Le « 1 » ne chevauche pas la couture** (défaut §D) : la pastille est à l'intérieur du rabat.
   Et le rabat du jour n'efface pas le tissu (§D encore) : il descend de 2 px de plus que ses
   voisines — une crête — et c'est la lisière qui passe PAR-DESSUS lui, pas l'inverse. Le motif
   reste entier sous les six papiers, qui sont pendus et non posés.
4. **Une seule ligne de base pour les six rabats** : le dessin avait décalé les quatre
   derniers d'un demi-rabat (§D).
5. **Teintes** : tout passe par les tokens de la page (`--abs-*`, `--charte-*`), aucune
   couleur d'image n'est recopiée en dur — la maquette est plus chaude que la charte,
   c'est §D encore.

**Une perte, à ne pas enterrer.** Les six lanières de compteurs avec leurs deux poches,
et les tuiles de motif en tête de ligne de la vue Liste, avaient été écrites dans un
tour suivant la PR #327, mais **jamais commitées**. Le bac à sable a été recyclé en
cours de tranche (`node_modules` et `.env` partis avec) et le bloc non commité a été
perdu avec. La production ne les a donc jamais montrées, et ce patch ne les réinvente
pas à la hâte : elles sont à redessiner avec la section des compteurs, qui est la
prochaine. Ce que « garder le reste » veut dire ici, et qui est gardé : Export et
+ Déclarer une seule fois en tête, la couture pointillée de la barre d'outils (qui
vivait sur `.abs-section-papier` — elle est réaccrochée à `.abs-page`, sinon elle
mourait avec le cadre sans qu'un seul test ne s'en plaigne), la tuile `abs-tuile` des
lignes, l'alerte en `.abs-couture-alerte`.

## F. Mesures, avant / après

| | base `8483b19` (#327, en production) | cette tranche |
|---|---|---|
| suite | 172 fichiers · 2441 tests verts | 172 fichiers · **2445** tests verts |
| `npm run charte` | 4 538 couleurs en dur / 184 fichiers · 131 ombres · 362 rayons hors liste | **4 536** / 184 · 131 · **361** |
| `npx eslint src` | 306 problèmes (242 erreurs, 64 avertissements) | 306 — identique, aucun nouveau |
| `npx vite build` | ok | ok, 23,1 s |
| `Absences.jsx`, teintes en dur | 27 | 27 (le cadre en supprimait déjà) |

Le contrat `absencesSectionBogolan.test.js` a été réécrit : ses onze tests verrouillent
désormais la lisière et les rabats, et non plus le cadre refusé. Trois verrous d'autrui
disaient le contraire de la maquette et ont été retournés **en gardant leur protection** :
`entetesEtTheme` n°9 (la carte collante reste exigée du Planning, la feuille posée est
exigée d'Absences), `bandeauKenteAmbre` n°2 (plus de `PageCulturalBand` sur la page, une
seule lisière, le webp ndebele du badge toujours présent sur le disque),
`absencesNavigation` n°3 (le rail rendu une seule fois, dans l'en-tête) — plus un septième
test qui prouve sur du HTML rendu, et non sur du texte source, que le compte est un seul,
sur le rabat du jour, et qu'il disparaît avec la prop.
