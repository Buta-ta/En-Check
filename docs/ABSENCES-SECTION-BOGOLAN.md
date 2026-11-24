# Absences · la section du haut — contrat de lecture

**Branche :** `arena/241ee8d6-en-check`, base `main cf56084`.
**Périmètre :** la section du haut de la page Absences — bandeaux de motif, en-tête, onglets,
six indicateurs, barre d'outils, ligne de compte. Pas le tableau, pas le tiroir de déclaration,
pas le dock de litige.
**Maquette retenue :** `maquettes/absences-section-bogolan-cadre.png`.
**Consigne du fondateur :** « utilise le bogolan comme motif, remplace l'autre ».

---

## A. Le motif de la page : qui décide, et ce que « remplacer » touche

L'état des lieux, ligne par ligne.

| ce qui existe | où | ce que c'est |
|---|---|---|
| le motif de la page est **ndebele** | `src/components/culturalMotif.js:38` — `if (page === 'absences') return 'ndebele'` | la table de correspondance page → motif |
| la page pose **deux bandeaux**, pas un cadre | `src/pages/Absences.jsx:1766` (`<AbsencesCulturalBand/>`) et `:2515` (`position="bottom"`) | l'un au-dessus de l'en-tête, l'autre en pied de page |
| le composant ne **dessine rien** | `src/components/AbsencesCulturalBand.jsx:5` | une div `abs-ndebele-band abs-ndebele-{position}` `aria-hidden="true"` |
| l'image est peinte en CSS | `src/pages/AbsencesAfroTech.css:441` — `url('/images/absences-ndebele.webp')`, `background-size: auto 100%` ; `:442` bas 32 px, `:443` tiroir 46 px, `:444` bas de tiroir 24 px, `:465-467` palier 650 px | pleine largeur, jamais écrasée (règle du repo : on ne déforme pas la photo d'un artisan) |
| le **cadre** existe déjà | `src/components/PageCulturalBand.css:74-75` (`.ec-cultural-cadre`, épaisseur par `--ec-cadre-epaisseur`) et son emploi au planning : `src/pages/Planning.jsx:3548` `placement="cadre"` | la même toile qui tourne **autour** d'une section |
| le bogolan existe déjà en image | `src/components/PageCulturalBand.css:4-5` — `data-cultural-motif='bogolan'` → `/images/paie-bogolan-haut.webp`, bas → `paie-bogolan-bas.webp` | la paie l'emploie ; il n'y a **rien à créer** pour l'afficher |
| le bogolan existe aussi **dessiné** | `src/components/BogolanMudclothSvg.jsx` — `BogolanFriseSvg({ hauteur, couleur, fond })` (frise continue), `BogolanFiligraneSvg`, `BogolanPastilleSvg` | si l'on veut une frise peinte dont on tient la couleur |

**Ce que « remplacer » ne veut pas dire.** Le fichier `public/images/absences-ndebele.webp` ne
doit **pas** être supprimé : il est aussi le visuel du motif `ndebele` dans
`src/components/badge/motifs.js:40`, employé par les badges employés. On remplace **l'emploi**
du ndebele comme motif de la page Absences, pas l'artiste.

**Les verrous qui deviennent faux** — à réécrire dans le même mouvement, sinon la suite vire au
rouge et on aura gagné une dette de plus :

| fichier | ce qu'il verrouille |
|---|---|
| `src/services/__tests__/absencesThemeNdebele.test.jsx:8,16,17,33,34` | le nom du fichier lui-même, les deux `.abs-ndebele-*`, le `url('/images/absences-ndebele.webp')`, `background-size: auto 100%`, le nombre de bandeaux par tiroir |
| `src/services/__tests__/bandeauKenteAmbre.test.js:26-34` | « Absences utilise maintenant le bandeau ndebele validé en haut et en bas » + l'existence du webp |
| `src/services/__tests__/pageCulturalBand.test.jsx:11` | `culturalMotifForPath('/absences') === 'ndebele'` |
| `src/services/__tests__/assistantDockPresentation.test.jsx:65` | la paire `['/absences','ndebele']` |
| `src/services/__tests__/culturalLoadingScreens.test.jsx:28` | deux `data-cultural-motif="ndebele"` au chargement |
| `src/services/__tests__/badgeEmploye.test.jsx:183,197` | **lui, on n'y touche pas** : c'est le badge, pas la page |

---

## B. Les six indicateurs et leurs deux poches — ils sont déjà câblés

La maquette fait de deux des six compteurs des **poches cliquables**. Ces deux câbles existent,
il n'y a rien à inventer :

| poche de la maquette | câble déjà en place | où |
|---|---|---|
| « Conflits → voir » | `onVoirConflits={() => setFilterConflict('with_conflict')}` | `src/pages/Absences.jsx:1853` |
| « À traiter → filtrer » | `onVoirDemandes={() => setActiveTab('demandes')}` | juste en dessous, `:1854` |

Les six libellés, tels qu'écrits dans `src/components/AbsencesKpiCards.jsx` (383 lignes) :
`Absents aujourd'hui` (293) · `Absences ce mois-ci` (324) · `Taux d'absence du mois` (336) ·
`Congés restants (moyenne)` (349) · `Demandes en attente` (361) · `Conflits absence / pointage` (374).
Deux d'entre eux portent une jauge. Le composant reçoit déjà `conflitsEnAttente`,
`joursPrisParEmploye`, `plafondConges`, `onVoirConflits`, `onVoirDemandes` — la structure des
données survit au passage en lanières, **seule la présentation change**.

---

## C. Export et « + Déclarer » existent déjà deux fois

La maquette ne les garde qu'en tête. Ce n'est pas une suppression de fonction, c'est la fin d'un
doublon :

| où | quoi |
|---|---|
| `src/pages/Absences.jsx:1799` et la ligne suivante | `abs-btn` Export (`onClick={handleExportCSV}`) et `abs-btn abs-btn-primary` « + Déclarer » (`onClick={handleAdd}`), dans la ligne d'en-tête |
| `src/pages/Absences.jsx:1869-1896` | la barre d'outils : recherche, select entreprise, bouton filtres, les **trois** sélecteurs de vue (`planning` / `calendar` / `list` — « Planning · Mois · Liste » à l'écran), **un second Export** (`:1893`), un second bouton d'ajout |

Les quatre filtres (`filterStatus`, `filterTemporal`, `filterConflict`, `filterPeriod`) ne sont pas
dessinés dans la maquette : ils restent **sous le bouton « Filtres »**, dans le panneau qui les
reçoit déjà. La maquette est une **structure**, pas un inventaire de contrôles.

À signaler aussi, parce que la maquette le montre et que le code le garde : la **bannière de
conflit** `stats.conflitsPending > 0` (`src/pages/Absences.jsx:1857`) est une pleine bande ambre.
Elle ne passe pas dans le nouveau cadre sans y être réfléchie.

---

## D. La dette propre de cette section — la maquette la réduit, elle ne la supprime pas

| compteur | valeur | après la section reprise |
|---|---|---|
| styles en dur dans `src/pages/Absences.jsx` | **224** `style={{` et **143** occurrences de `rgba(`/`#rrggbb` | les 6 lignes de `TAB.badge` (`rgba(245,158,11,.2)`, `rgba(239,68,68,.15)`, `var(--abs-coral)`), le style de la ligne « N absence » (`color:'var(--abs-text-muted)'` — un nom de jeton qui n'existe pas dans les jetons d'absence) et les ~6 cartes peuvent passer sous les jetons de la charte ; c'est une **soustraction**, pas une promesse de zéro |
| `npm run charte` à la base | 4 550 / 131 / 362 | seul ce qui est touché bouge, et à la baisse |
| échecs de collecte à la base | 7 (`useLoadSupabaseClamp`, `planningLegendesMetier`, `planningSupabaseResilience`, `planningUtilisateursParSite`, `resilienceContrat`, `syncDepointageEnCheck`, `syncPaieEnCheck`) | inchangés, hors périmètre — contrat n° 35 |
| erreurs eslint à la base | 3 (`react/no-direct-mutation-state` : `AbsenceFormulaire.jsx:112,253`, `AbsenceTiroir.test.jsx:9`) | inchangées |

---

## E. Les jetons exacts à employer (aucune couleur inventée, même pour une maquette)

`src/styles/tokens.css` : `sable #F3E9DA` (fond) · `surface #FBF4E9` · `surface2 #EADCC7` ·
`bordure #D8C6AC` · `encre #2A1708` · `douce #6B4A32` (second niveau) · **`aplat #A26537` — la
seule action première de la page** · `tissu #3A2416` (fond du bogolan) · `texte #7E4A26` ·
`alerte #8A5A14` · `erreur / statut-absent #9B2C2C` · `succès / statut-present #3F6B4C` ·
`statut-cours = aplat` · `statut-neutre = douce`.
Polices : IBM Plex Sans (20 / 14 / 11,5 / 9,5 px) et IBM Plex Mono (14 / 12,5 / 11,5 / 9,5 px).
Espacements : 4 / 8 / 12 / 16 / 24 / 32 px.

**Ce que la maquette a peint et qui n'existe pas :** une brique `#B4532B` (chevron de la ligne
« congé payé ») — l'à-plat est `#A26537`, la brique est `#9B2C2C`. Elle reste dans le nuancier,
mais l'implémentation prendra l'un ou l'autre. Les deux chiffres de solde affichés (**20,5 J / 30 J**
et « 12,6 % ») viennent du code ; **les trois lignes d'absence de la maquette sont inventées** —
la capture réelle montre une seule absence, celle d'Hippolyte BIYOKILA, 28→30/11/2026, 3 jours.
Emma BAYLE et Marc ZOSSOU n'existent pas dans la base.

---

## F. Ce qui n'est pas dans la maquette, dit avant

1. **Le sélecteur « Planning »** de la barre d'outils : c'est une vue à part entière, absente de la
   capture autant que du dessin. Le rendre dans le cadre suppose de décider ce qu'il devient.
2. **La bascule de thème** (`abs-theme-btn`, `data-testid="abs-theme-toggle"`) et le **retour**
   (`abs-back-btn`) : vivants sur la ligne de tête, non dessinés.
3. **Les compteurs des onglets** sont figés en dur dans le style (`TAB.badge`) — la maquette ne
   montre un badge que sur le premier onglet.
4. Le **mode sombre** : `.abs-page` porte `color-scheme: dark`, les bandeaux ont un fond clair
   `#efe1c5` par-dessus — un cadre bogolan doit être dessiné pour les deux, comme le test
   `absencesThemeNdebele.test.jsx:40-44` le vérifie déjà (deux bandeaux par tiroir selon `darkMode`).
5. La maquette **ne change pas** les données du tableau des absences, du calendrier,
   du dock, ni de la configuration des congés (troisième onglet). Livraison faite :
   la reprise a touché la **présentation** de la ligne de la vue Liste (tuile de
   motif en tête, quatre pastilles d'état passées au jeton, rappels de conflit en
   color-mix) — pas une requête, pas un calcul, pas un bouton d'action de la ligne.

---

# G. Ce qui a été livré (24/11/2026, même branche)

Le fondateur a tranché : **les cinq tranches d'un coup**, le bogolan pris dans **les
webp déjà sur le disque** (pas de frise SVG pour le cadre), Export et « + Déclarer »
**en tête seulement**, et les verrous ndebele **réécrits avec un test qui protège
l'image**. Contrat de structure nouveau : `src/services/__tests__/absencesSectionBogolan.test.js`
(**8 contrats**, un par point de la maquette).

| # | ce qui a changé | où |
|---|---|---|
| 1 | `absences` → **bogolan** dans la table des motifs ; le ndebele n'est plus employé par la page, son CSS, ni son écran d'attente | `src/components/culturalMotif.js:38` |
| 1 bis | classes `abs-ndebele-*` → `abs-bogolan-*`, toile peinte avec `paie-bogolan-haut.webp` (1536×76) et `paie-bogolan-bas.webp` (1536×32), `background-size: auto 100%` gardé | `src/components/AbsencesCulturalBand.jsx:13`, `src/pages/AbsencesAfroTech.css` |
| 1 ter | le fichier `public/images/absences-ndebele.webp` **reste** : c'est le visuel du badge employé (`badge/motifs.js:40`) — verrou ajouté dans `bandeauKenteAmbre.test.js`, contrat 2 de `absencesSectionBogolan.test.js` | — |
| 2 | les deux bandeaux de la page sont remplacés par **le cadre** : `PageCulturalBand placement="cadre"` en fond muet, `.abs-section-papier` par-dessus, épaisseur unique `--abs-cadre: 26px` (14 px sous 650 px) | `src/pages/Absences.jsx` (ouverture/fermeture de `<main>`), `AbsencesAfroTech.css` |
| 2 bis | les trois onglets deviennent des **rabats cousus sur la lisière haute** : la rangée remonte de 18 px à cheval sur la toile, chaque rabat prend son fond opaque (`--abs-bg-panel`), la barre perd son propre carton | `.abs-onglets-rabats` |
| 3 | six **lanières** inégales (`repeat(4, minmax(0,1fr)) minmax(0,1.15fr) minmax(0,1.35fr)`) séparées d'un **filet** (`.abs-kpi + .abs-kpi { border-left }`), plus six cartes bordées ; libellé en capitales mono au-dessus du chiffre, `font-variant-numeric: tabular-nums` | `src/components/AbsencesKpiCards.jsx` |
| 3 bis | les deux lanières qui tirent finissent sur une **poche d'argile fléchée** (`Traiter`, `Arbitrer`), branchées sur les deux câbles qui existaient déjà ; la lanière des conflits porte une **couture en zigzag** quand un conflit court, et elle seule | `id.` + `onVoirConflits` / `onVoirDemandes` (page, ~1862-1863) |
| 4 | `Export` et `+ Déclarer` **retirés de la barre d'outils** — ils restent en tête, où ils étaient déjà ; les styles orphelins `S.exportBtn` / `S.addBtn` (dont un dégradé dur `#F59E0B→#D97706` et un `color:'#000'`) supprimés avec eux | `src/pages/Absences.jsx` |
| 4 bis | la barre d'outils s'ouvre sur une **couture pointillée** | `.abs-section-papier .toolbar-top` |
| 5 | l'alerte de conflit n'est plus un bandeau plein ambre : une **couture** (deux filets en tirets, fond à 7 % d'orange) ; son bouton reprend la classe `abs-btn` de la page ; les quatre pastilles d'état de la ligne et le rappel « Conflit traité » passent du `rgba()` en dur au **jeton mêlé au fond** | `.abs-couture-alerte`, `AbsenceCard` |
| 5 bis | chaque ligne de la vue Liste porte la **tuile de motif** (`BogolanPastilleSvg`, 22 px, `aria-hidden`) — muette, jamais un mot dessus | `src/pages/Absences.jsx` (tête de ligne), `.abs-tuile` |

## Les trois vérites a dire, dans le texte

1. **La barre d'outils n'est pas descendue dans la lisière basse.** Le dessin la
   montre en pied de cadre parce qu'il dessinait une section de trois lignes. Dans
   la page réelle, la section continue sous elle (filtres ouverts, trois vues,
   liste paginée) : une barre d'outils en pied de cadre tomberait hors de portée
   dès la deuxième ligne. Elle est restée en tête de feuille, sur une couture
   pointillée — c'est le seul point du dessin qui ne soit pas respecté à la lettre,
   et il est dit dans le commentaire de la page, pas enterré.
2. **Les libellés des compteurs ne sont pas ceux du dessin.** « Solde moyen »,
   « À traiter », « Conflits », « Taux d'absence » y étaient raccourcis et peints en
   micro-capitales quasi lisibles (défaut relevé sur l'image). Le code garde
   `Congés restants (moyenne)`, `Demandes en attente`, `Conflits absence / pointage`,
   `Taux d'absence du mois` — ils sont aussi ce que verrouillait la suite.
3. **Le mot des poches reste `Traiter` / `Arbitrer`**, pas `voir` / `filtrer` : ce
   sont les deux verbes du code, ils disent lequel des deux voyages se déclenche
   (changer d'onglet vs poser un filtre).

## Compteurs, après reprise

| mesure | base `cf56084` | après |
|---|---|---|
| `npm run charte` — couleurs en dur (C1) | 4 550 dans 185 fichiers | **4 538 dans 184 fichiers** |
| — ombres floues (C9) | 131 | 131 |
| — rayons hors liste (C10) | 366 | 366 |
| `rgba(` + hex dans `src/pages/Absences.jsx` | 143 | **130** |
| suite | 2 416 tests · 170 fichiers · vert | **2 427 tests · 171 fichiers · vert** |
| `vite build` | ✓ | ✓ |
| eslint sur les fichiers touchés | 6 problèmes (3 erreurs, 3 avertissements) | **6 problèmes, les mêmes** |

**Correction d'un chiffre qui circulait dans les fiches des phases précédentes** :
les « 7 échecs de collecte préexistants » ne sont pas des tests cassés. Relancée
avec un `.env` local (le fichier est ignoré par git et n'est donc jamais livré),
la suite de la base `cf56084` est **entièrement verte** : 170 fichiers, 2 416 tests.
Les 13 suites qui échouaient à la collecte le faisaient sur
`❌ Variables Supabase manquantes dans .env` (`src/lib/supabase.js:40`). Rien de ce
qu'elles testaient n'était en cause, et rien n'a été « laissé hors périmètre » sur
ce point.
