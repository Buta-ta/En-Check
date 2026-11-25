# Absences · la poutre — sept compteurs pendus au bord du bas de la chemise

**Le fond de l'affaire :** une planche, et une planche s'accroche. Pas une carte de plus — et pas non plus une planche posée *sous* quelque chose, à cent soixante pixels du bloc qu'elle est censée tenir.

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

Six pancartes de bois dans une rangée de six cases, chacune pendue à un rail par deux cordes et deux anneaux ; au-dessus de la rangée, deux longues cordes qui remontent de son rail jusqu'au bas de la feuille de titre (70 px de vide traversés, pas un de perdu). Le corps d'une pancarte est soit un `div` (le chiffre renseigne), soit un `button` (le chiffre mène au bon filtre) — le survol répond en `--charte-surface2`, jamais en ambre, jamais en `!important`. La couture oblique des conflits (`repeating-linear-gradient(135deg, …)`) et les deux jauges restent ; `VOIR` redevient un rabat posé **sur** la planche, en `pointer-events: none`, pour que le clic reste sur toute la planche.

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

* **Ses deux longues cordes montaient jusqu'au bandeau de titre, en traversant le transat.** Au premier tour, non fait — et pour une raison vraie : la hauteur du bloc du transat n'est lisible nulle part en CSS (la tuile se remonte elle-même de 46 px, sa hauteur vient d'un corps de 32 px), et le `--abs-transat: 164px` que la maquette chiffrait était faux. **Fait au second tour**, sur la reprise du 1/12 (« tu as laissé bcp d'espace vide entre le bloc d'en haut et l'étagère. Moi ce que je voulais est de relier l'étagère au bloc d'en haut, de les accrocher là ») : la corde n'a plus à connaître le transat, elle franchit la bande morte. Voir `Le raccord au bloc du haut` ci-dessous.
* **`0,4 %`** était un chiffre de mon prompt d'image, jamais lu en base. La planche garde le calcul réel (`jours décomptés / jours ouvrés de l'effectif`).
* **Ses planches débordaient des poteaux** : largeurs dessinées à une échelle qui n'est pas celle de la page — `<main>` plafonne à `maxWidth: 1200`, pas 1560. Un verrou dit le fait : *ce qui est durcit est la borne, pas l'illusion*.
* **Ses visages étaient dessinés deux par planche**, six au total. Ici : les absents du jour seulement, quatre au plus, plus le `+N` — et la rangée n'est pas rendue à zéro absent, pour qu'aucun trou ne bâille dans le bois.
* **`VOIR`** apparaissait deux fois dans l'image, comme une planche de plus. Ici le rabat se pose **sur** la planche qui mène quelque part — donc une fois par planche actionnable, zéro quand il n'y a rien à traiter : un libellé d'action muet est une promesse vide.

## La pose du 2/12 — R1 · la poutre (`maquettes/absences-raccord-R1-poutre.png`)

**Ce que la reprise du 1/12 avait laissé voir.** Le fondateur : « il me semble que tu ne m'as pas compris car je ne vois aucun changement ». Il avait raison, et sa capture le prouvait à l'échelle 1× : la bande entre le bord du bas de la chemise et le haut des planches mesurait **253 px**, alors que la corde en franchissait 70. Les 183 px restants, c'était **le bloc du transat lui-même**, assis entre les deux : ma corde partait de son bord à lui, pas de la chemise. Rien n'était donc relié à rien.

**Ce que R1 change, en trois nombres.**

1. **le transat descend dans la rangée.** Son nombre (`30`, `soldeMoyen`) et son unique autre information (le jour du prochain retour) deviennent la **septième planche** : `abs-kpi-solde`, avec sa note `retour lun. 30 nov.` en capitales micro. Le composant `AbsencesHamac` reste vivant et testé — il n'est juste plus monté par la page. Le calcul ne bouge pas d'un octet : la page calcule (`transat`), le compteur affiche.
2. **plus de bande à franchir, donc plus de corde longue.** La rangée remonte de exactement ce que `<main>` la séparait : `margin: calc(-1 * var(--abs-corde)) auto`, avec `--abs-corde: 20px` **relu** comme le `padding: 20` de `S.main`. Le `padding-top` de la rangée tombe à 0 — la place de la corde est rendue **planche par planche** (`margin-top: var(--abs-corde)` sur `.abs-planche`), ce qui est la seule écriture qui survive au repli en 4 / 3 / 2 / 1 colonnes.
3. **l'anneau mord le trait de la chemise.** Il est posé `top: calc(-1 * (var(--abs-corde) + var(--abs-tringle)))` au-dessus du haut de la corde, c'est-à-dire à la hauteur exacte du bord du bas de la feuille de titre. La traverse du haut passe de 4 à **10 px** (un cran de l'échelle) parce que R1 dessine une barre pleine, pas un filet. Retirer l'un des deux nombres sans l'autre, c'est redescendre la rangée sous le nez du fondateur.

Le retrait horizontal devient un jeton unique, `--abs-retrait: 40px`, relu comme `16` (`.abs-chemise`) + `24` (`.abs-chemise-feuille`) : la rangée pend à l'aplomb des **coins du contenu** de la chemise, et non de ses bords — comme sur le dessin.

Ce que le verrou de somme est devenu : il ne vérifie plus `26 + 20 + 24 = 70` (la respiration du transat n'existe plus dans la page), il vérifie **`main.padding == etagere.--abs-corde`** et **l'absence de `<AbsencesHamac`** dans la page. Un test qui ne vérifie que l'arithmétique laisse repasser le bloc par la fenêtre.

## Le corollaire du 3/12 — l'anneau se pose au HAUT de la corde, pas à son décalage

Le fondateur, sur la capture de la pose R1 : « c'est bien mais je constate que les trous (ronds) sont mal placés ». Mesure sur son image (2674×520, échelle 1,885 px = 1 px CSS) : les quatorze anneaux tombaient entre 12 et 32 px **au-dessus** du trait du bas de la chemise — dans le titre, pas sur la ligne. Horizontal, en revanche, c'était juste : les centres des anneaux et des cordes concordent au pixel près (écart de 1 à 3 px sur 2674).

La faute tenait en un mot : **empilement**. La corde est montée de `corde + traverse` au-dessus du bois, et j'ai posé l'anneau à `-(corde + traverse)` **relatif à la corde** — donc deux fois le saut, 20 px de trop. Rien ne casse : les ronds flottent, la corde reste muette, tous les compteurs sont verts. Un dessin faux n'est pas une exception.

La géométrie d'aplomb, quatre nombres et une soustraction :

| segment | valeur | lu où |
|---|---|---|
| le vide sous la chemise, annulé par le `margin` | 20 px | `--abs-espace`, relu contre `S.main.padding` |
| la corde, du trait de la chemise à la traverse | 30 px | `--abs-corde` |
| la traverse peinte sur le bois | 10 px | `--abs-tringle` |
| la descente de l'anneau, pour qu'il **touche** la ligne au lieu de la traverser | 8 px | `--abs-anneau`, le seul réglage d'œil de la rangée |

Donc `top: calc(var(--abs-tringle) - var(--abs-anneau))` sur l'anneau — un cran **descendu depuis le haut de la corde**, jamais le décalage de la corde. De 40 px au-dessus du bois (son haut, le haut de la corde) à 20 px (son borderet, le trait de la chemise). Le verrou ne compare pas des chaînes : il relit les quatre jetons et l'épaisseur peinte (8 + 2 × 2), et vérifie `corde + traverse − cran − épaisseur == main.padding` — si quelqu'un graisse la corde sans reprendre l'anneau, la soustraction tombe et dit quoi retoucher.

## Le fil du 8/12 — les demandes pendent (`maquettes/absences-calendrier-D-fil.png`)

Le fondateur a d'abord demandé autre chose : « est-ce que le système absences ne devrait pas vivre dans le planning ? ». Réponse non, avec deux réserves qui ont été tenues : **un seul calcul des durées** et **le geste là où est le regard**. La page reste, parce que `module_conges` se verrouille à sa porte (`VerrouOptions.jsx`), que la validation d'une demande n'est pas du cadrage, et que le Planning n'a pas à porter un dossier. Ce qui a bougé, c'est l'onglet.

La panne que la figure règle : en mode Semaine, le calendrier des absences **répétait la grille du Planning** — mêmes sept colonnes de jours, mêmes lignes d'employés. Deux pages répondant à « qui est là ? », et le Planning y répond mieux parce qu'il a les horaires à côté. Le dossier, lui, doit répondre à « qui manque, depuis quand, et ça dure combien de jours ? ».

Ce que le dessin promet, et ce qui est écrit en dur :

| ce que le linge dit | où le nombre vit | qui le relit |
|---|---|---|
| la **longueur** de la fiche = la période | `LE_FIL.base + (jours − 1) × LE_FIL.jour`, plafonné à `LE_FIL.plafond` | `largeurFiche`, et la feuille borne `width:min(var(--abs-fiche-largeur), 100%)` |
| le **trait** sous la fiche = les jours ouvrés de la période | `compterJoursOuvres`, une fois pour la période (personne retirée), une fois pour les ouvrés | le verrou 7, sur des dates — jamais sur un pourcentage recopié |
| le **nombre écrit** = ce que la demande décompte | le champ `days_count` de la ligne, sinon le compte que la règle `count_holidays_as_leave` désigne | `mesuresFiche` en est l'unique porte d'entrée |
| la **corde** = le temps, de gauche à droite | `--abs-fil-corde: 4px`, posée en `border-top` du **rang** | le verrou 5 refuse un `border-top` sur le conteneur des fils |
| l'**anneau** mord la corde | `--abs-fil-saut: 24px`, `--abs-fil-anneau: 10px`, centré par `(corde + anneau) / 2` | le verrou 3, en arithmétique, comme sur la poutre |

**Trois lois de la poutre ont été reprises telles quelles**, parce qu'elles avaient déjà coûté :

1. **La corde appartient au rang, pas au bloc.** C'est `partagerEnRangs` qui remplit le trait, donc à 1 560, 680 et 390 px chaque rang qui tombe à l'écran reçoit son fil et ses anneaux — aucune media ne repositionne une fiche. Le repli est un calcul, pas un correctif (verrou 25).
2. **Un anneau qui partage la valeur de la corde ne retient rien.** Le `::after` se centre sur le trait, il ne s'y pose pas. La panne du 3/12 (l'anneau empilait le saut de la corde par-dessus le titre) est interdite par un verrou qui lit les quatre jetons et calcule la morsure.
3. **Le linge se plie, il ne crève pas le mur.** Un congé de trois semaines mesure 420 px calculés ; à 390 px, `min(…, 100%)` le ramène à la largeur du fil. Sans cette borne, `flex: 0 0 auto` + une largeur en dur fait déborder le trait tendu — le nombre est faux à l'écran, pas seulement moche.

**Le geste, et pourquoi il ne déplace rien.** Cliquer une fiche la **détache** : elle laisse son `abs-fiche-crochet` à sa place et de sa largeur — le rang ne se referme pas, la place vide dit où la reprendre — et elle se pose sous les fils en `DemandeCongeCard`, avec ses boutons. Le composant n'écrit aucune ligne en base : il appelle `openReviewModal` et `handleViewRequestDocument`, qui existaient. Les trois outils du bout du fil (✓ ✕ 📎) ne vident pas la pile d'un coup : ils prennent **la plus ancienne, une à la fois**, parce qu'un refus se motive et qu'approuver neuf congés sans les lire est un autre logiciel.

**Ce qui reste, et pourquoi.** Les quatre puces de statut filtrent, les deux fils trient — ce n'est pas la même question. L'alerte « N demandes en attente » du haut reste aussi : elle dit une chose que le fil dit déjà, mais par une phrase, pas par un nombre, et elle n'a pas à être démolie pour que le fil existe. Le solde est cloué à droite (il descend sous les fils à 900 px) et lit `joursPrisParEmploye` + `annual_leave_cap` — les nombres de la poutre, pas un calcul de plus.

### Le fil se tend aussi quand il n'y a rien

Première mise en ligne, le fondateur n'a rien vu : son entreprise n'avait aucune demande dans la période, et l'onglet rendait alors le vieux panneau pointillé « Aucune demande » à la place du dessin. Le rail de gauche affichait bien zéro — mais le demandeur, son indicateur, les compteurs du mois et les jours fériés avaient disparu avec la figure. Une figure qu'on ne voit que quand elle est pleine est un rangement du bureau qui change selon la chance, et le jour de la première demande, le dossier se remet à ressembler à autre chose.

Depuis, l'onglet `demandes` est **le fil, vide comme plein** : plus de branche conditionnelle dans `Absences.jsx`, l'état vide est une règle du composant (`.abs-fil-vide`) qui garde le trait tendu au-dessus des mots — c'est la corde qu'on regarde, pas l'inventaire. Les deux phrases viennent de la maison. Le transat, la suspension et l'établi restent à leur place. Verrou `absencesFil.test.jsx` #28 : le panneau ne peut pas renaître.

## La tringle du 9/12 — le bandeau du calendrier (`maquettes/absences-outils-1-rideau.png`)

Le fondateur a envoyé la capture du bandeau (la période, les trois modes, « Tous les motifs », « Masquer les employés sans absence », « Déclarer une absence », puis les sept pastilles de motif) et a demandé deux figures. Il a retenu la tringle, avec « je le veux exactement comme dans la maquette ».

Ce que la mesure reprochait au bandeau, et qui n'est pas une question de goût :

- trois lignes de commandes, environ cent cinquante pixels, avant la première information de la page ;
- le motif se commandait deux fois avec deux logiques — les pastilles **masquent**, le menu « Motif » du panneau de filtres **isole** ;
- « Déclarer une absence » avait trois portes (la chemise du haut, le bouton rouille de ce bandeau, chaque ligne du dock de gauche) ;
- « Tous les motifs » était un bouton qui, le plus souvent, ne servait à rien.

La figure : **une tringle de 10 px**, pleine de bout en bout, et tout pend dessus. La période est une planche de bois à deux anneaux, ses deux flèches sont clouées de part et d'autre ; le registre des trois modes tient sur un anneau ; « Aujourd'hui » et l'interrupteur sont des **billets suspendus plus bas sur leur ficelle** ; et chaque motif est une **pince qui serre le bois**, avec son étiquette en dessous, lue à la verticale, et le nombre de cas de la période au pied de l'étiquette. Un motif éteint n'a pas droit à une couleur de plus : la pince reste sur le bois, l'étiquette a glissé de deux degrés, elle est vidée et barrée d'un trait droit.

Les nombres, déclarés une fois sur `.abs-tringle` et relus par `absencesCalendrierTringle.test.jsx` (19 verrous, jamais contre leur propre valeur) : `bois 10`, `anneau 8`, `saut 20`, `écart 12`, `débord 6`, `ficelle 26`, `pince 46 × 132`. Le bois se peint **par tronçon sur chaque pièce** — `.abs-tringle-bois` et `.abs-pince:before` au même `top: var(--abs-tringle-anneau)` et au même débord de la moitié de l'écart — donc les tronçons se soudent en un trait continu, et un rang qui se replie à 390 px tend son propre trait. C'est la menuiserie de l'étagère, reprise pour la même raison, et une media ne repositionne jamais une pince.

Trois lois qu'on ne pouvait pas casser en route :

1. **le nombre d'une étiquette vient de la période, pas de la maquette** — il se calcule avec `segmentSurJours` sur les mêmes `jours` et le même périmètre d'employés que les lignes de la grille, et il **ne suit pas le masque** : une pince ôtée doit dire ce qu'on rate, sinon « éteint » vaut « zéro » et plus personne ne rallume en confiance ;
2. **le titre de la période reste la phrase du service** (`titrePeriode`) : la maquette écrivait « LUN 23 → DIM 29 » avec une flèche, une flèche de plus n'est pas une donnée — les capitales et la chasse sont du CSS ;
3. **rien n'est supprimé du bandeau, tout est suspendu** : le « Réallumer N motifs » n'existe que quand N est positif, parce qu'un bouton qui ne sert à rien ne s'accroche nulle part.

Ce qui reste ouvert, et n'a pas été tranché ici : les trois portes « Déclarer ». Le fondateur n'a pas répondu sur ce point, donc le dock de gauche et la chemise du haut gardent les leurs ; seul le bouton de la tringle est nouveau-nommé (`abs-cal-declarer`). Si un avis vient, la porte à retirer est celle du bandeau, pas celle de la chemise.

## Le raccord au bloc du haut (reprise du 1/12, morte le 2/12 — consignée pour ce qu'elle a appris)

Le vide que le fondateur montrait du doigt ne venait pas d'une corde trop courte : il venait de **deux conteneurs**. Le transat est un enfant de `.abs-page`, l'étagère un enfant de `<main>`. La bande morte entre les deux valait 26 px (la respiration du bas du transat) + 20 px (le remplissage du haut de `main`) + 24 px (la chute sous le rail) = **70 px de rien**.

Raccorder sans toucher au transat (validé tel quel le 24/11) ni à `main` (il tient toute la page) :

```css
.abs-etagere {
  --abs-corde: 70px;                                          /* la bande à franchir */
  margin: calc(var(--abs-chute) - var(--abs-corde)) auto 0;   /* −46 px : la boîte monte */
  padding: var(--abs-corde) var(--charte-espace-5) var(--charte-espace-5); /* +70 : le bois redescend */
}
.abs-etagere-suspentes { position: absolute; top: 0; left: 24px; right: 24px; height: var(--abs-corde); }
```

Trois choses y tiennent, et chacune a son verrou :

1. **le bois ne bouge pas d'un pixel** — la boîte remonte de `corde − chute`, le remplissage haut rend `corde` : le rail reste exactement où il était, c'est la corde qui s'allonge. Écrit autrement, « raccorder » aurait voulu dire descendre six planches et la table entière de 46 px ;
2. **70 n'est pas un chiffre qu'on oublie** — `absencesEtagere.test.jsx` relit les 26 px dans `.abs-hamac`, les 20 px dans `S.main` de la page, les 24 px du jeton de chute, et refuse dès que la somme ne fait plus 70. Si quelqu'un respire l'un des trois sans lire la consigne, la corde démarre quatre pixels trop haut : un dessin de travers, pas une casse ;
3. **l'aplomb corde ↔ rail est le même jeton** (`--charte-espace-5` des deux côtés) — et la coupe de 680 px qui passait le retrait de l'étagère à 16 px est morte : elle laissait les longues cordes à 24 px, donc 8 px à côté des bouts du rail.

À 650 px, la tuile du transat passe à `width: 100%` (c'est SA coupe) : elle occupe toute la largeur, et une corde qui traverse la bande marcherait dessus. La longue corde se retire donc à cet écran — `--abs-corde` tombe à la chute seule, le bois ne saute pas, le rail reste pendu à ses deux cordes courtes par planche. La figure survit, seule la traversée s'arrête.

Et la preuve que le build ne défait pas le geste : `calc(var(--abs-chute) - var(--abs-corde))` sort de `vite build` **intact**, dans un `.abs-etagere{margin:calc(...) auto 0}` — ni plié en `-46px` à la va-vite, ni réduit à `0`. La minification n'a touché que les espaces autour des deux-points. C'est ce qu'on lit dans `dist/assets/index-*.css`, ligne 0, à l'œil nu.

## Où c'est posé

**Le corollaire de l'anneau (3/12)** : #350, fusionné dans `main` en `1fc8b0d` — quatre jetons et une soustraction, aucun fichier de plus touché que la feuille, la fiche et deux tests.

**R1 · la poutre (2/12)** : #348, fusionné dans `main` en `e2ef3b5`, CI `success`, Vercel `dpl_2no1J1N9fxVugyK8dGaioqh2GrCa` · READY · PROMOTED sur l'alias `main`. Le pli avec la session voisine (#347, écran de chargement des annonces) n'a rencontré aucun des six fichiers touchés.


_Pose précédente, périmée ci-dessus mais consignée :_ #345, fusionné dans `main` en `5c44263` le 1/12. CI `success`, Vercel `dpl_4vGyTGD3n4n72MAnpNwAZE5SFBPa` · READY · PROMOTED sur l'alias `main`. Le seul chevauchement avec la session voisine (#344) était la retouche de regex sur la date courte des échéances — deux mains, même geste : **la version de main a été gardée, la mienne retirée** avant la fusion. Ce qui reste de ce côté, c'est l'étagère.

## Deux accidents de chemin, écrits pour ne pas être refaits

1. **Un jeton inventé ne lève pas d'erreur, il tombe en zéro.** La maquette employait `--abs-espace-1…6`, qu'elle s'était déclarés à elle-même. Recopiés tels quels dans `AbsencesAfroTech.css`, ces cinq noms n'y sont définis nulle part : `gap` et `margin` retombent à 0, l'étagère se soude sans un air, et rien dans la console ne le dit. Un test lit maintenant chaque `var(--)` de la plage et le confronte aux déclarations réelles (`tokens.css` + la feuille). C'est le seul genre de verrou qui attrape ce genre de faute sans navigateur.
2. **La descente de la peinture dans la feuille inverse un risque.** Les verrous 13-18 de `absencesKpiCards.test.jsx` lisaient des bouts de chaîne dans le markup en ligne (`font-size:20px`, `clip-path:…`, `repeat(4, …)`) : le markup ne les contient plus, ils lisent la feuille. Et la feuille, elle, est désormais **comptée** par `npm run charte` — c'est ce qu'on voulait, à condition de vérifier que les compteurs n'ont pas bougé.

## Gelés, et vérifiés comme tels

* **La chemise** (bloc titre + sous-titre + onglets soudés) n'a rien gagné, ni perdu : sa `padding: 16px 24px 0` est maintenant **lue par un test** comme la source du retrait de la rangée (16 + 24 = 40). C'est le premier verrou de cette fiche qui touche la chemise — il ne la modifie pas, il la relit.
* **Le transat** ne borde plus la page (2/12, R1) : la feuille ne porte plus **aucune** de ses règles — vérifié CSS **commentaires retirés**, parce que la prose qui explique son départ contient son nom. Le composant, lui, reste monté dans son propre test.
* **La chemise ne porte aucune attache** : pas d'œillet, pas de crochet, pas de seconde tringle. L'accroche est peinte par la planche qui pend, jamais percée dans la feuille de titre — un verrou interdit tout sélecteur `.abs-chemise` écrit **après** le marqueur de la poutre.
* **Les nombres de la soudure** (`margin-bottom: calc(-1 * var(--charte-trait))`, `z-index: 1`, 36 px, la pâte commune) — repris à l'identique dans `absencesSectionHaut.test.jsx`.

## Égout d'à côté, cueilli en passant

1. Deux blocs `@media (max-width: 980px)` pour le transat, le second écrit `@media(max-width:980px)` sans espaces — invisible aux greffes comme aux recherches. Unifiés le 1/12 ; devenus sans objet le 2/12, le bloc entier étant sorti de la feuille.
2. **Le `.env` local n'est pas dans le dépôt, et son absence n'est pas une régression.** Quinze fichiers de test s'arrêtent à la collect sur « ❌ Variables Supabase manquantes dans .env » (`src/lib/supabase.js:40`) quand le fichier n'est pas là : `Test Files 15 failed | 181 passed`, `Tests 2560 passed` — **zéro assertion en échec**. Le signe à chercher avant d'accuser un changement : des fichiers qui tombent sans aucun `×`. Un `cp .env.example .env` et la suite est verte.

## Les chiffres

| mesure | base `8ca43df` | P1 + raccord (1/12) | **R1 · la poutre (2/12)** |
|---|---|---|---|
| `npx vitest run` | 195 fichiers · 2728 ✓ | 196 · **2749 ✓** | 196 · **2749 ✓** (aucun verrou retiré, 6 réécrits pour le nouveau contrat) |
| `npx vite build` | ✓ | ✓ 18,8 s | ✓ 20,1 s |
| la corde, dans la feuille minifiée servie | — | 5 mentions, `--abs-corde: 70px` | `--abs-corde: 20px`, `margin:calc(-1 * var(--abs-corde)) auto`, plus **aucune** règle `abs-etagere-suspentes`, plus **aucune** règle `.abs-hamac` |
| lignes de la feuille de style | — | 1 172 | **993** (le corollaire du 3/12 ajoute 19 lignes de calcul et de prose, rien de plus) (−198 : 161 lignes pour le bloc du transat, 37 pour la corde longue, le reste en prose reprise) |
| `npm run charte` · couleurs en dur | 4548 · 185 fichiers | **4548 · 185** |
| `npm run charte` · ombres floues | 131 | **131** |
| `npm run charte` · rayons hors liste | 359 · 18 valeurs | **359 · 18** |
| `npm run charte` · mesures (tailles · marges · rayons distincts) | 65 · 44 · 27 | **65 · 44 · 27** |
| `npx eslint` sur les trois fichiers touchés | — | **silence** |

### Les chiffres du fil (8/12)

| mesure | base R1 (2/12) | **le fil (8/12)** |
|---|---|---|
| `npx vitest run` | 196 fichiers · 2 749 ✓ | 197 · **2 777 ✓** (28 verrous ajoutés dans `absencesFil.test.jsx`, aucun retiré, aucun réécrit ailleurs) |
| `npx vite build` | ✓ 20,1 s | ✓ 23,3 s |
| lignes de la feuille de style | 993 | **1 552** (+559 : la section `🧺 LE FIL`, moitié règles moitié prose — les cinq jetons, les six états du bois, la borne du repli) |
| la corde, dans la feuille minifiée servie | `--abs-corde: 20px` sur la poutre | `--abs-fil-corde: 4px` en `border-top` du rang, `top:calc(-1 * var(--abs-fil-saut) - (var(--abs-fil-corde) + var(--abs-fil-anneau)) / 2)` à l'anneau — **non plié**, la feuille est servie telle qu'écrite |
| `npm run charte` | 4 548 · 131 · 359 · mesures 65/44/27 | **identique, ligne à ligne** — zéro hex, zéro flou, zéro rayon et zéro mesure de plus dans la maison |
| `npx eslint` | silence | silence sur les quatre fichiers touchés (trois erreurs de `Absences.jsx` restent hors de ces lignes : 42, 474, 1 360) |

**Ce que le fil ne prouve pas ici, à regarder en premier sur la preview.** Pas de navigateur dans l'atelier. Trois choses : si le **crochet vide** (la place de la fiche en main, pointillée, avec son anneau au fil) se lit comme « en main » ou comme un trou dans le dessin ; si les **fiches de 216 px** sont trop étroites pour un nom complet à deux Prénoms longs (elles sont bornées par `min-width: 0` et `overflow-wrap: anywhere`, donc elles se cassent — mais le goût est à dire) ; et si le **raté de la maquette** — la maquette écrivait « NOV. 2026 » et « APPROUVÉES CE MOIS », alors que l'onglet ne connaît pas de saison : le fil affiche « À valider · N » et « Répondues · N », et le mois n'a pas été inventé pour faire joli. Un chiffre faux vaut mieux qu'une étiquette fausse.

## Ce qu'on ne peut pas prouver ici, après R1

* **si l'anneau tombe exactement SUR le trait du bas de la chemise.** Le test vérifie que la corde vaut le `padding` de `main` et que l'anneau est posé à `-(corde + traverse)` ; il ne peut pas voir l'arrondi du navigateur, ni le `box-shadow` de la chemise (2 px en bas, à flou zéro) qui peut manger un trait. **C'est LE point à regarder en premier**, large et étroit.
* **si la note de retour a le droit de vivre sur le bois** (elle est passée d'un bloc à une planche) — et si le `30` de la septième planche ne demande pas un corps plus gros que les autres, comme sur le dessin. Ces deux goûts sont retournables en une ligne chacun.
* **la maquette R1 dessinait des hauteurs inégales** — la planche du solde un peu plus haute que les six autres, et un bandeau noir continu de bout en bout. Le premier est une fantaisie du dessin (rendue par une rangée à colonnes égales, qui est exactement ce qui tient au repli multi-rangs), le second est obtenu par sept traverses collées sans écart, ce qui donne le même trait continu mais qui **suit** les rangs quand ils se replient. Deux renoncements écrits ici pour qu'ils soient assumés, pas découverts dans six mois.

## Ce qu'on ne peut pas prouver ici (la liste du 1/12, inchangée sur le fond)

Pas de navigateur dans l'atelier : les rapports, les coupures, l'aplomb du raccord et l'absence de jeton fantôme sont tenus par les 21 verrous de `src/services/__tests__/absencesEtagere.test.jsx`, **le tracé à l'œil reste à faire sur la preview** — six largeurs, de 1560 à 360 px. Ce qu'on y regarde en premier : la corde qui tombe pile sur le bas de la feuille de titre (c'est le seul endroit du raccord qu'un test ne peut pas voir — il vérifie la somme, pas l'arrondi du navigateur), la continuité du rail d'une planche à l'autre, l'anneau posé SUR le rail, et le `+N` des visages qui ne doit pas chevaucher le chiffre quand une planche prend deux lignes de libellé.

## Et après

1. Si la rangée doit se **coller** sous la chemise au lieu de pendre à 20 px de corde, le crochet se retourne en un seul nombre : `--abs-corde: 0px`. C'est aussi le crochet qui sert si l'anneau du 2/12 mord trop sur le trait de la feuille de titre — une valeur, deux réglages, aucun sélecteur de plus.
2. Le solde porte aujourd'hui `retour lun. 30 nov.` en note de bas de planche. Si le fondateur veut le voir ailleurs que sous un chiffre, c'est une `abs-planche-note` à déménager — pas un bloc à faire revenir.
2. Le même tri pour les trois autres écrans qui portent encore un `<style>` embarqué : la charte ne les voit toujours pas.
