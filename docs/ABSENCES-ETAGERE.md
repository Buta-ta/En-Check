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

### La tringle, relue sur l'écran du fondateur (le soir même)

« C'est bien ce que tu as fait mais il y a des anomalies, analyse et tu verras. » Trois, mesurées sur sa capture, et chacune est une loi qu'on avait mal écrite :

1. **le trait coupé en tranches.** Le bois se peignait d'un `border` complet : à chaque jonction de deux tronçons, deux montants d'encre de 2 px se faisaient face, et la tringle ressemblait à une rangée de lattes posées bout à bout. Le bois n'a plus que **deux rives** (haut et bas), et le débord passe de 6 à **7 px** — la moitié de l'écart *plus un chevron*, pour que les tronçons se recouvrent d'un pixel au lieu de se toucher au millimètre d'antialiasing près.
2. **l'anneau noyé.** Un cercle de 12 px total sur un bandeau de 14 px total ne se voyait pas : il était *dedans*. L'anneau est maintenant **plus haut que le bois** (`anneau 14` pour `bois 10`) — la morsure doit déborder du trou qu'elle retient, sinon on ne voit que deux trous. Et l'air au-dessus du bois est devenu un nombre à part (`ciel 8`) : tant que le `top` du bois portait la valeur de l'anneau, agrandir l'anneau descendait le bois avec lui.
3. **les étiquettes coupées.** « Maternité/Paternité » s'écrivait « é/Paternit » : l'étiquette avait une hauteur de boîte, le libellé un `flex: 1 0 auto` et un `overflow: hidden` — rogné des deux bouts. Une figure qui tronque un mot de l'entreprise est une figure cassée, pas sage. Le libellé fait maintenant la hauteur ; `min-height: 132px` n'est plus qu'un plancher.

Quatrième correction, qui n'était pas dans l'image mais la causait : **la rangée se coupait n'importe où** (entre le registre des modes et les billets), ce qui dessinait deux tringles. Les sept pinces forment désormais un **groupe** qui prend la ligne (`flex: 1 1 auto`) et se replie sur son propre bois : les commandes gardent leurs anneaux en haut, les pinces trouvent leur trait en dessous. Et le billet « Masquer les employés sans absence » s'écrit « Masquer sans absence » — le nom complet reste dans l'`aria-label`.

### Le dock « Motifs à glisser-déposer » est démonté

Le fondateur a tranché : « enlève cette section modèle, les étiquettes sur étagères peuvent jouer aussi cette fonction ». `src/components/AbsencesDock.jsx` est supprimé (et avec lui ses sept règles CSS, son `box-shadow` flou — la feuille passe de 130 à 129 ombres floues — et sa colonne de 224 px qui mangeait la largeur de la tringle).

Le service a déménagé, il n'a pas été jeté avec le meuble :

- **une pince se glisse** sur la ligne d'un employé : `DATA_TRANSFER_MOTIF` + le repli `text/plain`, `effectAllowed = 'copy'`, et pendant le transport la mâchoire pivote de 8° et l'étiquette passe en pointillé ;
- **un clic sur une pince éteint le motif** — un seul métier par geste. La leçon de la case du Planning (qui ouvrait déjà une fenêtre avant qu'on veuille y poser un bouton) vaut dans les deux sens : on ne colle pas « déclarer » sur un objet qui sert déjà à « masquer » ;
- **au clavier et au doigt**, où le glisser n'existe pas, la porte est le formulaire : son sélecteur de motif est dans `AbsenceFormulaire.jsx`. Le dock avait un `div tabIndex={0}` entretenu à la main ; la pince est un `button`, focusable et actionnable par l'HTML ;
- **la phrase d'explication reste** : le « Comment déclarer une absence ? » du panneau devient `.abs-tringle-note`, une ligne en pied de tringle, fermée par un `details`.

Les verrous du dock (`charteAbsences.test.js` 5 et 6, `motifsAbsencePersonnalises.test.js` 10) ont suivi le geste sur `AbsencesCalendrier.jsx` — aucun n'a été supprimé. Le verrou nouveau qui les garde honnêtes : le fichier `AbsencesDock.jsx` ne doit plus exister, et `.abs-dock` ne doit plus se lire dans la feuille.

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

---

# La corde par employé (10/12) — le corps du calendrier quitte les cases

**Le fond de l'affaire :** onze mille pixels carrés de vide pour dire que ces gens-là sont là. Une case vide, un dimanche et un jour férié se ressemblent trait pour trait : la grille répondait à « qui est là ? » par l'**absence** de marque. Le fondateur a retenu la maquette `maquettes/absences-grille-1-corde.png` — « je choisis le 1, une corde par employé. je veux absolument avoir ce rendu » — et a posé la loi : **la tringle est le contrat**.

## Ce qui a été mesuré avant de dessiner

Sur sa capture, à la règle : une ligne de **78 px**, une colonne d'employé de **236 px**, une journée de **108 px**. À 1 440 px de large et en mode semaine, sept cases vides par salarié multipliées par quatorze salariés. La peinture ne pouvait pas s'en tirer par un trait plus fin : c'est la *cellule* qui était la faute, pas sa bordure.

| la grille écrivait | la corde tient |
|---|---|
| une `<div>` de fond par jour et par ligne, bordure droite sur la voisine | **un anneau par jour**, réparti en `flex: 1 1 0` sur les mêmes colonnes que l'entête — pas un `left` recalculé |
| `HAUTEUR_BARRE: 24` / `ESPACEMENT_BARRE: 30` en durs dans le JSX, la hauteur de ligne ajoutée à la main | les six nombres vivent dans la **feuille**, et `--abs-corde-hauteur` est le `calc()` des trois hauteurs qu'il contient |
| la planche posée dans la case, bordure de 2 px pour tout indice de statut | la planche **pend** sous le trait, retenue par une ficelle qui *entre* dans le trait |
| le solde en quatorze pilules identiques « 26 J » | une **longueur** (jauge) et le nombre à côté, une fois |
| `data-jour` recopié dans chaque cellule du corps | `data-jour` ne vit plus que dans l'entête : le jour se lit à l'anneau |

## Les sept nombres, et le rang qui les commande

```css
.abs-cal {
  --abs-corde-fil: 2px;          /* le trait tendu            */
  --abs-corde-fil-top: 10px;     /* sa place depuis le haut   */
  --abs-corde-anneau: 8px;       /* le creux du jour, cerclé de 2 */
  --abs-corde-descente: 8px;     /* la ficelle sous le trait  */
  --abs-corde-planche: 22px;     /* la hauteur d'une planche  */
  --abs-corde-empilement: 26px;  /* le cran entre deux planches qui se chevauchent */
  --abs-corde-noeud: 8px;        /* la perle de corail qui marque un conflit de pointage */
  --abs-corde-hauteur: calc(var(--abs-corde-fil-top) + var(--abs-corde-descente) + var(--abs-corde-planche) + var(--charte-espace-1));
}
```

**Un seul nombre d'empilement, lu deux fois** : le `top` de la planche (`fil-top + descente + --abs-corde-rang × empilement`) et le `min-height` de la ligne (`hauteur + (rangs − 1) × empilement`). Écrit deux fois, il se contredit à la première retouche — et la deuxième planche d'une même corde mange alors la ligne du voisin. C'est la leçon des anneaux de la poutre, reprise à l'envers : `--abs-corde-rangs` vient du JSX (`seg.rangeesTotal`), donc la ligne grandit **d'elle-même** quand deux absences se chevauchent.

L'anneau est **plus haut que le trait** qu'il cercline (8 px + 2 px de cercle pour un fil de 2) : un anneau à la hauteur du trait est invisible, on l'a déjà payé le 9/12. Le creux se centre sur la colonne par `left: 50%` + `translateX(-50%)` sur le pseudo-élément, jamais par un pourcentage recopié du nombre de jours — c'est ce qui fait que mode jour, semaine et mois partagent la même géométrie sans un seul `if`.

## Les états, tous en forme avant d'être en couleur

* **anneau creux** = jour travaillé · **pastille pleine** = chômé, et le chômé vient des *données* : `feriers.has(j.iso) || j.weekend`, le férié étant lu au jeu de l'**entreprise de la ligne** (`getHolidaySet(ligne.employe.enterprise_id)`), pas à une liste de la maison.
  Le week-end et le férié d'entreprise **partagent la pastille** — c'est le dessin choisi qui le dit, pas un oubli — mais chaque anneau porte sa raison en `title` (`dim. 25 oct. · chômé (week-end)` / `· chômé (férié de l’entreprise)`), parce qu'un même signe pour deux causes doit au moins savoir les nommer au survol.
* **la couleur dit le motif, le trait dit le statut** — la loi de `styleBarreAbsence` est recopiée telle quelle sur la planche : une demande en attente porte son contour pointillé *et* le mot « En attente », une refusée est barrée *et* dit « Refusé ». Une approuvée ne porte pas de mot : la plaine couleur le dit déjà.
* **le nœud corail sur la corde** quand la pointeuse conteste ce jour (`conflitParAbsence[a.id]?.status === 'pending'`) — la marque est sur le fil, à la crête de la ficelle, parce qu'un conflit est un accident de cordage, pas une étiquette.
* **la coupure** aux deux bouts quand l'absence déborde de la période, 📎 quand un justificatif pend à la fiche.

## Deux anomalies trouvées en relisant la feuille, pas à l'œil

En re-mesurant le CSS après coup, deux défauts qui ne se voient pas sur une capture bienveillante :

1. **la ficelle de la deuxième planche ne touchait pas la corde.** Sa longueur était écrite `descente + fil` — le `rang` n'y était pas. Une planche du deuxième rang pendait donc à 26 px du fil avec un moignon de 8 px. `top` et `height` portent maintenant le même terme, `var(--abs-corde-rang, 0) * var(--abs-corde-empilement)`, que le `top` de la planche : **une ficelle qui ne touche pas le fil ne retient rien**, exactement la leçon des anneaux de la poutre.
2. **le nœud de conflit flottait à côté du cordage.** Il était posé « à la crête de la ficelle » avec un `left` de `espace-3 − espace-2` (4 px) alors que la ficelle est à `espace-3` (12 px), et centré par `--charte-espace-2` au lieu de sa propre taille — soit trois pixels trop haut, et vingt-six trop bas dès le deuxième rang. Il a maintenant son **jeton** (`--abs-corde-noeud`), le même `left` que la ficelle, et le **même calcul de centrage que l'anneau** (`+ fil / 2 − (noeud + 2 × trait) / 2`, rang compris). Un verrou (6bis) lit les deux formules côte à côte : elles doivent se ressembler, sinon elles se décalent.

## Ce qui n'a PAS été recopié du dessin

La maquette mentait sur trois points, et le code ne l'a pas crue : les **prénoms** (Aïssatou, Paternité… — des taches), les soldes **« 26/30 » et « 30/30 » répétés** sur toutes les lignes (le nombre vient de `joursPrisParEmploye` et du plafond de l'entreprise, il est donc différent par ligne), et **une planche qui pendait sur la corde du voisin** (le dessin n'a pas de `rangee`, le segment en a une). La légende a gagné deux lignes — « un anneau = jour travaillé », « une pastille = chômé (week-end ou férié de l'entreprise) » — pour que la figure ne soit pas une devinette.

## Ce qui a été refusé en route

* **Le rail de cases en dernier recours.** On aurait pu garder les cellules et seulement retirer leurs bordures : la grille restait une grille, et l'anneau y aurait été un collage.
* **Un `left: ${(i / nbJours) * 100}%` par anneau.** Exactement le genre de nombre que le mode jour casse. `flex: 1 1 0` donne la même colonne que l'entête sans arithmétique.
* **Refaire la `soldeDe`.** Le solde change de *forme*, pas de source : même fonction, même `pris / plafond / restant`, la jauge n'est qu'un `--abs-corde-plein` posé en ligne.
* **Libérer la planche de son ellipsis.** Elle rogne le libellé du motif quand la journée est courte — c'est la SEULE coupe de la figure, elle est assumée (le mot entier vit dans le `title`, l'`aria-label` et le tiroir), et `.abs-corde-motif` le dit en commentaire. Faire tenir « Absence injustifiée » en entier demanderait soit deux lignes dans 22 px, soit des planches de 200 px : la pince de la tringle, elle, ne se rogne pas parce que c'est le seul endroit où le nom du motif vit.
* **La cellule collée au bas de la ligne** (`top: auto; bottom: 0`) pour la jauge : une règle de plus pour un résultat que l'`align-items: center` de la ligne donne déjà.
* **Toute media-query qui repositionnerait un anneau, une ficelle ou une planche.** La seule coupure de la corde (650 px) raccourcit le prénom et la jauge.

## Les chiffres du contrôle

| mesure | base `main` (9/12) | **la corde (10/12)** |
|---|---|---|
| `npx vitest run` | 198 fichiers · 2 809 ✓ | **199 · 2 829 ✓** (0 échec) — dont 18 verrous dans le nouveau `absencesCalendrierCorde.test.jsx` ; la famille « absences* » passe de 107 à 125 `it()` |
| serrures nées avec la corde | — | la tringle en a vu deux **bornées, pas relâchées** : elles lisaient la feuille *jusqu'à la fin du fichier* et se déclenchaient sur le rayon de la planche. `TRINGLE` s'arrête maintenant à `--abs-corde-fil`, avec un `throw` si la corde n'y est plus |
| `npm run charte` · couleurs en dur | 4 496 · 183 fichiers | **4 496 · identique** — zéro hex de plus ; trois `#2A1708` que j'avais écrits dans la légende sont repartis en `var(--charte-encre)` |
| `npm run charte` · ombres floues | 129 | **129** · `rayons` 337 · mesures **63 / 42 / 27** (aucune de plus : la corde n'emploie que `champ`, `carte`, `pilule`) |
| `npx vite build` + lecture du `dist` | ✓ | ✓ 19,2 s (vite + PWA, 22 entrées precachees) — dans la feuille minifiée servie, `--abs-corde-fil: 2px`, `flex:1 1 0`, `left:50%`, le `top:calc(… + fil / 2 − (noeud + 2 × trait) / 2)` de l'anneau, la `top`/`height` de la ficelle avec son terme de rang et le sélecteur `[data-anneau='chômé']` sont **intacts** |
| portes de la bande | 9 `data-testid`, 2 `aria-pressed`, 1 `role="switch"` | **les mêmes, un pour un** — `abs-cal-barre`, `abs-cal-declarer`, `abs-cal-modes`, `abs-cal-aujourdhui`, `abs-cal-titre`, `abs-cal-tous-motifs`, `abs-cal-feuille-jour`, `abs-cal-masquer-sans-absence`, `abs-cal-tringle` |
| dépôt d'une pince | `data-drop-lane` + `jourDepuisX(e.clientX, rect, nbJours)` | **inchangé** : la piste entière est la zone de dépôt, le jour visé reste celui sous le pointeur, `.abs-drop-cell` n'a pas déménagé de rubrique |
| `npx eslint` | silence | **silence** sur les trois fichiers touchés |

## Ce qu'on ne peut pas prouver ici

* **le rendu à l'œil, sur ses données à lui.** Pas de navigateur dans l'atelier : les 18 verrous tiennent la géométrie, pas le goût. Ce qu'on regarde en premier, en semaine et en mois : si l'anneau tombe **pile sur le fil** (le `calc()` de centrage est juste sur le papier, `box-sizing: border-box` et le `border` de 2 px ne se lisent qu'à l'écran) ; si une planche de 22 px suffit à porter emoji + libellé + « N j » + mot de statut sans que ça se tasse ; et si les deux colonnes collantes (nom à gauche, solde à droite) restent opaques au défilement horizontal — elles portent `background: theme.carte` pour ça, un `sticky` transparent fait voir la corde **à travers** le nom.
* **les trois largeurs de coupure** (1 560 / 900 / 360) : à 360 px, une journée vaut-elle encore assez pour un anneau ? La piste est en pourcentages (`flex: 1; min-width: 0`) et c'est le `minWidth` de la range — `LARGEUR_EMPLOYE + nbJours × largeurJour`, posé en ligne comme sur la grille d'avant — qui fait défiler. C'est voulu ; le goût est à dire.
* **le nœud de conflit** : la maquette en dessinait un par ligne, le code n'en pose un que si la pointeuse a dit `pending`. Sur un jeu de données silencieux, le nœud ne s'affiche pas — ce n'est pas un trou, c'est l'absence de conflit.

## Et après (la corde)

1. **Le mode jour est une corde d'un seul anneau.** Ça tient — un anneau, une planche pleine, le solde à droite — mais une figure à un point est pauvre. Si le fondateur le trouve maigre, la porte est un jeton de plus (les six jours voisins en filigrane), pas un composant de plus.
2. **`Masquer sans absence` et la corde se marchent un peu dessus** : le switch enlève la ligne entière, l'anneau creux la rendait déjà muette. Le jour où la liste des présents s'allonge, le switch devient un tri et l'anneau garde la parole.
3. Reste ouvert depuis la tringle : **la deuxième porte « Déclarer »** (bande vs bandeau du haut), **la décision B du Planning** (`planning-case-B2-*`), et la factorisation de `services/absences.js` avec le `motifDe()` de `Planning.jsx`.

# La copie à la cote (26/11) — « d'abord reproduire, ensuite adapter »

La consigne du fondateur tient en une phrase, et c'est un **ordre de passage**, pas une préférence :

> « quand je demande une maquette le but est de reproduire à l'identique la maquette et une fois fait, on essaiera de l'adapter parfaitement à l'identité En-Check mais d'abord il faut reproduire la maquette choisie à l'identique »

La version du 10/12 ne reproduisait pas la maquette : elle l'**interprétait**. Le reproche n'était pas une question de goût, il avait une taille — « ce n'est ni les mêmes couleurs, ni la même interface ». Ce tour-ci n'arbitre donc rien : il **mesure le dessin, et recopie**. L'adaptation à l'identité (loi des couleurs, densité de la maison, teintes) est une passe suivante, qu'il ouvrira.

## Les cotes, relevées sur l'image

`maquettes/absences-grille-1-corde.png` fait 1 422 × 800 — un **canevas 1×, pas une capture retina**. Son rendu à lui, lui, est à 2× : diviser l'un comme l'autre par deux était la première façon de se tromper (c'est ce que j'avais fait). Les cotes se recopient telles quelles.

| ce qu'on mesure | au dessin | jeton |
|---|---|---|
| le pas d'une ligne | 50 px (fils à y 180, 406, 456, 506, 558, 606, 656, 708, 756) | `--abs-corde-repos` |
| le trait tendu | 3 px (y 180-182), **continu** | `--abs-corde-fil` |
| le haut de carte sous le fil | 26 px (carte à y 206 pour un fil à 180) | `--abs-corde-descente` 21 + fil + fil-top |
| la carte | 46 px de corps, contour d'encre de ≈3, ombre **dure** en bas à droite | `--abs-corde-carte`, `--abs-corde-encre` |
| les attaches | **deux** cordons de ≈40 × 45, à 6 px des coins, qui **traversent** le fil | `--abs-corde-cordons`, `--abs-corde-coin` |
| le trou du jour | ≈9 px cerclé de 3, un par jour, pitch ≈125 (le pas de l'entête : ≈122) | `--abs-corde-anneau`, `--abs-corde-cercle` |
| la vignette de tête | 78 × 35, **teintée** (230, 218, 193), aucun trait d'encre sur son bord | `--abs-corde-figure-largeur/hauteur` |
| le solde | ornière de 104 × 18 (x 1226→1329), nombre jusqu'à x 1361 → **colonne de 136** | `LARGEUR_SOLDE`, `--abs-corde-jauge` |
| aujourd'hui | toute la **colonne** lavée (224, 200, 174) sur ≈1,5 jour + un trait de 2 px | `--abs-corde-lavage`, `--charte-trait` |

> ⚠️ Ce tableau est la mesure du 26/11. Cinq de ses lignes ont été **re-mesurées le
> 08/12** et corrigées : voir « Seconde copie à la cote », à la fin du document.
> Elles sont laissées telles quelles pour que l'erreur reste lisible.
| le fond | bandes alternées (243, 234, 218) ↔ (232, 219, 193), **aucune carte blanche** | `.abs-cal-scroll`, `--abs-corde-fond` |
| l'entête | « L 23 » sur une ligne, filet de 2 px dessous, **aucun séparateur vertical** | `.abs-cal-entete` |

Un chiffre relevé n'est pas un chiffre arrondi : la colonne du solde fait 136, pas 176 « pour que le mot tienne à l'aise » — et le jeton qui avait été posé à 176 dans la journée a été remisé à la mesure.

## La loi qui empêche la dérive : un seul modèle de largeur

La panne qu'il avait vue (« les trous sont mal placés, analyse et tu verras ») valait −8 px au lundi et **−97 px au dimanche**. Cause unique : le champ de l'entête omettait la colonne du solde, la piste la réservait — sept colonnes d'un côté, sept plus étroites de l'autre. Ce n'était pas lisible dans le code : les deux formules étaient justes prises séparément. Depuis :

* `.abs-cal-entete-jours` et `.abs-corde-piste` portent **le même** `flex: 1 1 0` ;
* les deux colonnes collantes lisent **les mêmes** jetons posés en ligne par le composant — `.abs-cal-entete-employes` / `.abs-corde-tete` sur `--abs-corde-employe`, `.abs-cal-entete-solde` / `.abs-corde-solde` sur `--abs-corde-solde` ;
* `minWidth` du champ porte les **trois** termes : `LARGEUR_EMPLOYE + nbJours × largeurJour + LARGEUR_SOLDE` ;
* verrou 17 : la comparaison des deux côtés est écrite, pas seulement la formule de l'un. « Lire les formules n'est pas vérifier » — c'est la leçon du 25/11, rendue exécutable.

## Ce que la copie a supprimé, et pourquoi

* **la carte blanche derrière le calendrier** (`theme.carte`, `theme.bordure`, `theme.grille` en styles en ligne dans le corps de corde) : le dessin n'a pas de fiche, il a un fond de sable et des bandes. `--abs-corde-fond` est posé sur la ligne, et les deux colonnes collantes le relisent — un fond propre à elles laisserait une bande claire traverser le défilement horizontal. Ces trois constantes restent en vie, pour la tringle seule.
* **les trois séparateurs verticaux de l'entête et son étiquette encadrée** : le dessin n'en a pas.
* **le cordon unique de 2 px** (`.abs-corde-attache`) : deux montants (`.abs-corde-cordons`) qui dépassent le fil d'un cordon. Une carte qui touche sans traverser est une étiquette posée, pas une carte accrochée.
* **le trait de jour à 45 % sur une case** : un lavage d'une colonne et demie, plein champ, borné à `max-width: 100%` pour que le mode jour n'ouvre pas d'ascenseur horizontal.
* **la jauge de 6 px cerclée** : une ornière de 74 × 14 en contour pointillé, remplie en plein de ce qui reste — avec le nombre à côté, parce qu'une jauge lue seule est un statut sans mot.
* **les bandes au `:nth-child`** : l'entête est le premier enfant du champ, un rang de décalage inversait tout. C'est `data-alterné` posé par le composant.
* **la montée écrite deux fois** : `--abs-corde-montée` vit sur la carte, cordons et nœud la relisent. Deux formules écrites côte à côte, et le deuxième rang flottait à vingt-six pixels du trait.

## Ce qui est délibérément resté du droit (et non du dessin)

Le dessin est une figure : ses prénoms, ses « 26/30 » répétés et son anneau par jour férié non justifié ne se recopient pas. Restent réels : les noms, les soldes, les motifs, les sept commandes de la tringle avec leurs portes (`data-testid`, `aria-pressed`, `role="switch"`), le dépôt d'une pince sur le jour sous le pointeur (`data-drop-lane`, `jourDepuisX`), le 📎, la coupure aux bords de période, le nœud de conflit — posé **sur le fil**, centré par le même calcul que l'anneau. Les deux seuls indices de statut admis par la charte sont restés : **pointillé** pour ce qui n'est pas acquis, **barré** pour un refus, et le mot écrit à côté ; la carte a perdu sa couleur de motif (le dessin est monochrome) et gagné le « Motif · N j » du dessin.

## Le thème sombre, piégé par un blanc

Première version de la copie : carte en `--charte-blanc`, texte en `--charte-encre`. Sous `[data-theme='dark']`, la maison inverse l'encre (elle devient claire) mais garde « blanc » crème — une encre claire sur crème, donc **illisible**. La carte est passée en `--charte-surface`, qui suit le thème dans les deux sens (crème sur sable le jour, écorce claire la nuit) ; le survol répond en `--charte-surface2`. Le verrou de rayon et la loi « pas de hex en dur » n'ont pas bougé d'un poil : `npm run charte` rend **exactement** les chiffres de la base (4 488 couleurs en dur · 126 ombres floues · 332 rayons · 63 / 42 / 27 mesures) — la copie n'a ajouté aucune entorse, elle en a retiré du côté du corps de grille.

## Les chiffres du contrôle (26/11)

| mesure | base `59a1045` | **la copie** |
|---|---|---|
| `npx vitest run` | 199 fichiers · 2 829 ✓ | **200 · 2 837 ✓** (0 échec), dont **22** verrous de corde (+4 : le modèle de largeur partagé, le champ nu, la vignette teintée, le lavage borné — et le verrou de hauteur est devenu un verrou de **cote relevée**) et 23 de tringle intacts |
| `npx vite build` | ✓ | ✓ (22 entrées precachees) |
| `npm run charte` | 4 488 · 126 · 332 · 63/42/27 | **les mêmes, un pour un** |
| `npx eslint` sur les trois fichiers touchés | silence | **silence** |
| portée du patch | — | `AbsencesCalendrier.jsx` (structure d'entête, champ, cordons, lavage, solde, `LARGEUR_SOLDE = 136`), `AbsencesAfroTech.css` (rubrique de corde réécrite en entier), `absencesCalendrierCorde.test.jsx` (verrous rebasés sur la cote du dessin) |

## Ce qui attend la passe « identité »

Rien de ce qui suit n'a été fait — c'est la porte qu'il ouvrira après avoir validé la copie :

1. **la loi des couleurs sur la carte** : `styleBarreAbsence` dit « la couleur dit le motif » ; la copie monochrome ne la montre pas. Deux options à trancher par lui : colorer le contour (le dessin garde sa géométrie) ou la pastille de gauche.
2. **l'échelle typographique** : le dessin écrit le chiffre du jour à 15 px et son titre à 20 ; la maison n'a que 20 / 14 / 11 / 9,5. La copie a pris 14 — le 15 est hors liste et ne se décrète pas ici.
3. **la densité** : 50 px par ligne, c'est la cote du dessin ; la grille d'avant en faisait 78 et la corde de la veille 44. Le choix d'identité est à poser une fois la copie actée.
4. **les teintes relevées** (crème 241/235/214, sables 243/234/218 et 232/219/193) sont exprimées en `--charte-*` existants, jamais en hex. Si la passe identité veut ses tons exacts, c'est une décision de palette, pas un `#…` de plus.

---

# Seconde copie à la cote (08/12) — « encore une fois, compare »

Il a redit la consigne en une image : poser le rendu à côté du dessin et **mesurer**,
encore. La passe du 26/11 avait corrigé quatre cotes ; elle en avait manqué cinq
autres, et surtout elle avait **recopié sa propre mesure de la veille** au lieu de
remonter à l'image. Le canevas non plus n'est plus le même — le dessin a été
réexporté en **1 376 × 768** (1 422 × 800 la dernière fois) : toute cote sortie de
mémoire est donc fausse par construction, y compris les miennes de la semaine
dernière.

Le tableau ci-dessus (celui du 26/11) garde ses chiffres **tels qu'ils ont été posés
ce jour-là** ; les cinq lignes qui suivent les remplacent. C'est écrit exprès : un
document qui réécrit son histoire ne permet plus de savoir quelle erreur a été faite.

| ce qui était posé | la mesure du 08/12 | ce que ça déplace |
|---|---|---|
| `--abs-corde-fil-top: 2px` — le fil collé au haut de la bande | le fil est à **y 196 dans une ligne qui commence à 175 : 21 px** | cote **1** de tout le reste : l'anneau, la carte, le nœud, la jauge se règlent sur lui. Posé à 2, l'anneau rasait la règle, la jauge flottait 18 px plus bas, et le trait du jour traversait l'anneau au lieu de passer entre deux |
| un anneau **au centre** du jour (`left: 50%`) | les six trous du dessin sont à **x 474, 596, 716, 832, 947, 1062 : les bornes des cellules**, alors que les étiquettes sont centrées (411, 534, 656, 773, 887, 1003, 1119) | un demi-jour d'écart, à peu près 56 px. L'anneau naît à `left: 0` et `translateX(-50%)` le partage entre deux journées — le trou est bien peint de la teinte de la bande, vérifié : à chaque anneau, l'encre du fil s'interrompt de x 470 à 479 |
| `--abs-corde-descente: 21px`, carte à 46 | le bord haut de carte est à **y 214 sous un fil à 198 → 14 px**, la carte fait **45** (214..258) | la carte pend de quatorze, et `--abs-corde-débord` se recalcule tout seul (21 + 3 + 14 + 46 − 50 = **34** : la
  carte déborde de trente-quatre pixels sa ligne de 50, exactement les 258 − 223,5
  du dessin) |
| cordons « ≈40 × 45 à 6 px des coins », carte posée **sur les cellules** | cordons **à x 536 et 776**, soit **12 px du bord** (la carte va de 524 à 790), épais de **3** ; et les cordons tombent aux **centres** des jours de rive, la carte débordant de **12 px d'aile** de chaque côté | la planche ne couvre plus les cellules : `left` et `right` se hangent aux centres (une largeur recopiée la faisait déborder d'un demi-jour des deux côtés), et une période coupée par la fenêtre reste collée au bord — les deux rives se lisent dans le même `style` |
| ornière pointillée de **104 × 18**, nombre en `--charte-texte` à 14 px | **barre pleine de 72 × 15** (x 1190..1261, y 190..204), cerclée d'**encre** de 2, fond de piste (209, 199, 187), remplissage (161, 93, 47) = `--charte-aplat`, nombre **à côté** (x 1270..1319, 15 px de haut d'encre) | la jauge n'est plus une ornière : c'est une barre, posée **sur le fil** — son `padding-top` se déduit du même `--abs-corde-fil-top`, pas d'un centrage dans la bande |
| lavage « ≈1,5 jour », né sous la règle, trait de 2 px | le lavage fait **une colonne** (x 595..715 pour 118) et **commence dans l'entête**, en rectangle arrondi du haut de y 120 à la règle (172) ; le trait du jour fait **3 px** (x 656..658) | `--abs-corde-lavage: 1`, `--abs-corde-entête: 76`, un `::before` sur la case du jour, et le trait du jour prend `--abs-corde-fil` comme graisse. L'opacité aussi est mesurée : le ton (237, 213, 193) sur la bande (243, 234, 216) = l'ambre à **0,14** |
| typo : entête en micro (11), prénom et carte en corps (14) | **tout le dessin est à ~20 px** : capitales de 16 px dans « L 23 », 17 dans « Congé · 3 j », 15 dans « 30/30 » | entête, prénom, carte et nombre du solde passent en `--charte-taille-titre`. Le point 2 de la liste « identité » du 26/11 est tranché par la mesure, pas par moi |

## Ce que la re-mesure n'a pas suivi, et pourquoi

* **le nom du jour** : je croyais le chiffre du dessin en mono. Il ne l'est pas — les
  capitales de « L 23 » et les chiffres de « 23 » ont la même plume. Le `--charte-mono`
  est sorti de l'entête et du nombre du solde ; il reste partout ailleurs.
* **les colonnes de service** : le dessin fait une colonne d'employés de 352 et un
  solde de 194 sur un canevas de 1 376. Les garder telles quelles sur un rendu de
  1 157 eût écrasé les jours (87 px par colonne au lieu de 112,5). La cote qui porte
  l'alignement — le **pas de jour** — est la bonne : 112,5 rendus pour 118 dessinés,
  soit 4,6 %. Les deux colonnes collantes gardent 236 et 136, et la règle « un seul
  modèle de largeur » les tient d'aplomb.
* **les disques pleins** : le dessin remplit l'anneau de certains jours (x 23, 27, 28,
  29 pleins ; 24, 25, 26 creux). Ce n'est pas un état de plus à inventer : la maison
  a déjà `data-anneau="chômé"` (week-end et férié d'entreprise), et c'est ce qui
  remplit. Le patron du dessin ne dit rien d'autre que cela, je ne lui en prête pas.

## Les chiffres du contrôle (08/12)

| mesure | base `34a5400` | **la seconde copie** |
|---|---|---|
| `npx vitest run` | 200 fichiers · 2 837 ✓ | **200 · 2 839 ✓** (0 échec) — corde **24** verrous (+2 : la jauge sur le fil, la cote qui ne se recopie pas d'une mémoire), tringle 23 intacts, et le verrou 18 des modes rebasé sur les deux rives |
| `npx vite build` | ✓ | ✓ (22 entrées precachees) |
| `npm run charte` | 4 488 · 126 · 332 · 63/42/27 | à vérifier ci-dessous, aucun hex ajouté |
| portée du patch | — | `AbsencesCalendrier.jsx` (les deux rives de la planche, la branche `nbJours === 1`), `AbsencesAfroTech.css` (rubrique de corde : six cotes, l'entête à 76, le lavage dans l'entête, la barre du solde, quatre tailles de lettre), `absencesCalendrierCorde.test.jsx`, `absencesCalendrierModes.test.jsx` |

---

# Le pli (10/12) — la corde est déposée

Le fondateur, après la seconde copie : « **tu ne réussis pas à exactement faire comme
la maquette. retravaille ça et utilise la 2e maquette comme modèle** ». Et sur la
structure, laissé plus tôt dans la même journée : « la tringle, les anneaux, la
corde, tout ça tu peux le remplacer si ça ne colle pas au dessin ».

C'est la phrase que je n'avais pas entendue. Depuis trois tours je **re-cotais la
corde** : le fil à 21, l'anneau à la borne de cellule, la descente de 14, les
cordons à douze du bord — des nombres exacts, relevés sur une image qui n'était plus
le modèle. `maquettes/absences-grille-1-corde.png` est la maquette 1. Le modèle est
`maquettes/absences-grille-2-pli.png`, 1 376 × 768, et il ne contient **ni corde, ni
anneau, ni carte suspendue**. La différence n'est pas un habillage : le second dessin
ne suspend rien du tout.

## Le plateau, et rien d'autre autour

Le canevas se lit d'abord par ses règles. Un plateau : montant gauche x 50-52,
montant droit x 1326-1329, règle haute y 199-202, règle basse y 680-683, toutes de
**trois**, posé sur le sable de la page — il n'y a plus de carte blanche derrière le
calendrier, et le sable des deux côtés du plateau est le même (243, 232, 212) :
**pas de zébrage d'alternance**. Dehors, à gauche, l'encre grise le sable de
L 233 à 168-180 sur huit pixels : c'est une **ombre dure**, `6px 6px 0 0`, jamais
floue (C9). Le dessin en repète un second décalage à x 1333-1337 et un trait isolé à
x 1341 — la plaque du montant droit, pas une règle de plus.

Le bas du plateau n'est pas une règle simple : **deux traits**, y 594-597 et
y 601-603, avec quatre pixels d'air entre les deux. C'est le **pli**. Sous lui, une
bande de 76 (604..680) : le registre.

| ce que le dessin mesure | la cote | ce que ça devient dans la feuille |
|---|---|---|
| pas de ligne : règles à y 200, 278, 355, 433, 511 | **78** | `--abs-pli-pas: 78px`, et le `min-height` de la ligne = pas + (rangs − 1) × empilement |
| colonne d'employé : x 53 → 305, **une seule coupure** du rang | **252** | `LARGEUR_EMPLOYE = 252`, relu par l'entête (`width: var(--abs-pli-employe)`) — le même jeton, deux usages |
| champ des jours x 305 → 1320, sept cellules | **145 par jour** | les étiquettes sont centrées DANS la cellule : le champ court sous la jauge, la jauge se pose à sa rive |
| traits de jour tous les 48,3 px | **le tiers de la cellule**, deux fois 22, teinte `--charte-bordure` | `--abs-pli-tiers: 3` en `background-size` : un fond, pas trente et un éléments |
| planche y 220..259, cerne 3, bouts ~8 | **40**, encre **3** | `--abs-pli-planche`, `--abs-pli-encre` |
| ligne 2 « Maladie · 1 j » : x 590..752 pour une cellule 595..740 | débords **17 gauche / 12 droite** | la planche se pose sur les **bords** des cellules, plus aux centres |
| rive gauche : encre x 321 @ y 220 → 302 @ y 240 → 318 @ y 258, fente claire x 320-322 sur y 234..244 | **pointe de ruban de 16** + caret ‹ crème | `--abs-pli-pointe: 16px`, un carré tourné en `::before` sous la planche (`z-index: -1`), le glyphe `‹` dedans ; aucune pointe si la journée est née avant la fenêtre |
| rive droite à 8 px de la fin du jour | **8** | `--abs-pli-rive: 8px`, même à la dernière cellule du champ |
| refusée : cerne **pointillé**, aucun brun (244, 233, 213 à x 764), « REFUSÉE » x 772..860, y 415..427 | capitale 13, **sous le trait, à sa droite** | `[data-trait='barré']` déremplit la planche et `.abs-pli-statut` écrit le mot hors du cerne |
| conflit de pointage : carré de corail x 586..597 pour une rive à 595 | **11-13 px centré sur la rive gauche** | `--abs-pli-noeud: 13px`, `left: calc(-1 * noeud/2 - encre/2)` |
| lavage du jour : x 591..734, y 150 (dans l'entête) → 594, (217,195,177) sur (243,232,212) | **UNE cellule**, ambre à **0,26**, et il ne descend pas dans le registre | `--abs-pli-lavage: 1`, `--abs-pli-opacité: 0.26`, `--abs-pli-ciel: 27` (76 − 49) |
| plomb d'encre x 655-658, à l'aplomb du centre du jour 662, toutes rangées, **sous les planches**, nulle part ailleurs | **3 px** | `--abs-pli-plomb: 3px`, même `left` que le lavage et que l'étiquette |
| hachures de week-end à la rive droite de l'entête, x 1133..1177 et 1270..1323 | **40 × 37**, pas de 7, traits de 3 à 45°, **mordant de 3 sur la règle** | `.abs-cal-jour[data-weekend]::after` en `repeating-linear-gradient`, `bottom: calc(-1 * var(--abs-pli-rule))` |
| jauge : pilule x 1179..1222, y 231..249, cerne 2, argile à gauche, nue à droite ; « + 26/30 » écrit **à côté**, x 1225..1299 | **43 × 19**, plaquette **147**, repli du nombre **27** | `--abs-pli-jauge`, `LARGEUR_SOLDE = 147`, `LARGEUR_SOLDE_REPLI = 27` — la plaquette est peinte à la rive du champ, ce n'est plus une colonne |
| registre : pastilles à x 74, 190, 306, 429, 557, 683, 811, 943, **coin replié 18 × 18** (x 126..144, y 649..667) | pas de 125, pastille de **51**, huit puces | `--abs-pli-carré: 51px`, `--abs-pli-coin: 18px`, `--abs-pli-écart: 74px` (125 − 51) |
| « 9 · rien à signaler » x 1121..1307, capitale 20 | le 9 est un **compteur**, pas le nombre de puces | `.abs-pli-compte` relit `sansObjet.length` : il ne se recopie pas du dessin |

Ce que le dessin ne dit pas, et que je n'ai donc pas inventé : les prénoms, les
soldes et les motifs réels (des taches), le remplissage des chômés dans les lignes
(les traits de crayon suffisent), et le ✏️ de la refusée. Le **nombre** de traits par
jour, lui, est pris au mot : trois, pas un.

## Un seul chiffre pour deux usages, encore

La dérive du 25/11 (−8 px au lundi, −97 px au dimanche) venait d'une cote écrite deux
fois. Le pli a les mêmes couples, et ils sont verrouillés dans
`absencesCalendrierPli.test.jsx` (verrous 10 et 12) :

* la **coupure** du rang : `--abs-pli-employe` pour l'entête ET pour la tête de ligne,
  plus aucun `calc` de rattrapage ;
* le **repère du jour** : le lavage, le plomb et l'étiquette de l'entête lisent le même
  `left` (le test vérifie que l'ensemble des `left` rendus a une seule valeur) ;
* la **hauteur de ligne** : `--abs-pli-empilement` sert à la montée de la planche et
  au `min-height` de la ligne — et le rang 0 ne se centre pas dans la ligne, c'est le
  **bloc** des rangs qui se centre (`--abs-pli-décalage`), sinon la seconde planche
  touchait la règle du dessous ;
* le **solde** : `LARGEUR_SOLDE` (147) est à la fois le plancher de défilement et la
  largeur de la plaquette.

Et le mot du statut reste un mot : `la carte reste crème cerclée d'encre`, seule la
**pointe** de ruban et le **lavage** apportent de la couleur, le trait dit le statut.
La feuille ne connaît d'ailleurs plus les noms de statut — elle lit `data-trait`
(`plein`, `pointillé`, `barré`), posé d'après `styleBarreAbsence` ; écrire
`en_attente` dans le CSS eût été redémarrer la loi à partir de sa liste de mots.

## Le pli se ferme, et ne dit pas plus qu'il ne fait

Les lignes sans absence se replient sous la double règle. Trois décisions, toutes
prises contre une facilité :

* le registre **n'est pas un bouton**. Le dessin ne lui prête aucun geste, et rien n'a
  de fiche à ouvrir quand la période est vide : c'est un `<span>` avec un `title`, et
  la feuille n'a ni `cursor` ni `:hover` dessus. Le verrou 16 vérifie le balisage.
* « Déplier tout » est une **case de l'entête de grille**, pas un billet pendu à la
  tringle : `masquerSansAbsence` sort du composant, le billet sort de la tringle, et
  le verrou 11 de la tringle vérifie l'absence de l'ancien `data-testid`.
* le pli **ne se ferme pas en mode jour**. Le second étage du dessin est une semaine ;
  la feuille du jour a déjà son « Présents (n) », et un registre en dessous répéterait
  la même liste sous une autre forme. La loi de l'étage — `lignes + sansObjet =
  toutesLesLignes` — est gardée par le verrou 17 (en mois : 3 lignes + 1 puce =
  4 employés) et par le verrou 19 (en jour : 4 lignes, aucune puce).

## Les chiffres du contrôle (10/12)

| mesure | la seconde copie | **le pli** |
|---|---|---|
| `npx vitest run` | 200 · 2 839 ✓ | **200 · 2 843 ✓** (0 échec) — pli **28** verrous, tringle 23 (dont le 11, qui vérifie maintenant l'ABSENCE du billet), modes 21, rendu 10 |
| `npm run charte` | à vérifier ci-dessous | **inchangé** : 4 488 couleurs en dur · 126 ombres floues · 332 rayons hors liste, et 64 tailles · 42 marges · 27 rayons (relus le 11/12 : le comptage sur `HEAD` donne **43** marges aujourd'hui — le 42 était une figure recopiée de mémoire, et c'est précisément le piège que la relance sur l'arbre de `HEAD` existe pour fermer) — vérifié en relançant le même comptage sur l'arbre de `HEAD` et sur celui d'aujourd'hui : **aucune valeur ajoutée** (le VERDICT reste NON CONFORME, il l'était avant) |
| fichier de la grille | `absencesCalendrierCorde.test.jsx`, 24 verrous | `absencesCalendrierPli.test.jsx`, 28 verrous — le fichier est **renommé**, pas doublé : la corde n'existe plus dans la feuille |
| bornage de la tringle | s'arrêtait à `--abs-corde-fil` | s'arrête à `--abs-pli-pas`, avec son `throw` ; les rails `--abs-corde: 30px` et leurs anneaux **restent**, ils ne sont pas de la grille |
| modes | verrou 18 sur `--abs-corde-aile` | verrou 18 sur `--abs-pli-pointe` / `--abs-pli-rive`, et la branche `nbJours === 1` (les deux rives à 2 px) |
| portée du patch | — | `AbsencesCalendrier.jsx` (largeurs 252/147/27, `déplierTout`, `toutesLesLignes`, planches aux bords, registre, légende), `AbsencesAfroTech.css` (la rubrique de corde remplie par la rubrique du pli), `absencesCalendrierPli.test.jsx`, `…Tringle`, `…Modes` |

## Trois cotes relevées après coup, sur mon propre rendu

La première passe du pli était cotée sur le fichier du dépôt. En rouvrant les deux
images côte à côte (le dessin et `image-116`, la copie que le fondateur a renvoyée),
trois choses sont tombées — et les trois se mesuraient dans la bande du haut, celle
que je ne regardais plus.

| ce que j'avais posé | la mesure | ce qui a bougé |
|---|---|---|
| la case « Déplier tout » à **20 × 20**, à seize du montant droit | **30 × 30**, cerclés de **3**, coins de 6, **vide de fond** (le centre lit (244, 234, 216), le sable) ; douze pixels jusqu'au mot, et le mot finit à **x 1323** pour un montant à 1326 | `--abs-pli-case: 30px`, `right: 0`, `gap: espace-3`, `background: transparent`. À seize du bord, la ligne de compte ne tombait plus d'aplomb avec le montant droit du plateau |
| l'entête de la colonne des prénoms écrit « EMPLOYÉ · 5 » | **rien** : x 53..305 sur y 165..192 ne contient pas un pixel d'encre. Le compte se lit **une** fois, dans la ligne du haut, centré sur le champ (x 447..930 pour un champ de 53..1320, centre 688 vs 686) | le caption et son icône sortent du composant, la `<div>` reste comme spacer de largeur. Un nombre écrit deux fois se contredit à la première retouche — c'est LA loi de l'étage, et je l'avais violée moi-même |
| la planche bornée par ses deux rives, avec une « aile » de seize pixels pour qu'une journée déborde | le dessin ne déborde pas pour faire joli : sa planche d'une journée fait **163 de corps** (x 590..752) parce que son étiquette fait 115 et réclame dix à gauche, seize à droite. Sa planche de trois jours, elle, **s'arrête** à x 735 pour une dernière cellule morte à 740 | `left` + `right` donnent le CADRE des jours ; `min-width: max-content` laisse le mot pousser la planche, et `max-width: calc(100% - var(--abs-pli-entree) - 2px)` la borne au mur. **`--abs-pli-aile` est supprimé** : c'était une déduction, pas une mesure — le jeton d'une largeur que je déduisais au lieu de la lire |

Et le mot du statut, dans tout ça : je l'écrivais **à droite du cerne**, hors de la
planche. Le dessin le pose **sous le trait, aligné à sa rive droite** — sa REFUSÉE
court de x 772 à x 860 pour une enveloppe finissant à x 879 (dix-neuf pixels de
retrait, soit `espace-4` + le cerne), son sommet à y 415 pour un trait bas à y 408.
Le mot est donc dans l'empreinte de la planche, en capitales micro (le dessin mesure
treize, la charte offre onze et quatorze — et quatorze avec leur interligne
franchissait la règle du bas). `data-rive`, l'attribut qui retournait le mot quand il
touchait le bord du champ, est mort avec la règle qui s'en servait : un attribut que
plus personne ne lit est une promesse de plus.

# Quatre manquements, réglés à la cote (11/12)

Le fondateur a renvoyé trois images — son rendu (`image-117`), le dessin (`image-118`)
et un crop de la tringle (`image-119`) — avec quatre mots : les feuilles pliées ne se
voient pas, on ne voit pas où s'arrête la planche « Formation · 1 j », le bouton
« Déplier tout » disparaît une fois déplié, et les fils de la tringle traversent les
boîtes. Les quatre se sont réglés en mesurant, pas en opinant.

| le manquement | la mesure | ce qui a bougé |
|---|---|---|
| **les feuilles pliées ne se voient pas** | derrière le plateau, deux arêtes parallèles courent à x 42..45 et x 34..37 pour un montant à 50..52 : **huit**, puis **seize** pixels de décalage, chacune descendue de huit plus la règle (11), venue courber au coin à y 209 et y 219 ; une arête rend la pareille à droite, x 1334..1337 de y 209 à 401 | deux pseudo-éléments du plateau, `inset: 0`, cerclés de la règle du cadre, remplis du sable de la page, **`z-index: -1`** : seul ce qui dépasse s'encre, et le cadre n'a rien à soustraire quand il défile. Le décalage est `--abs-pli-pli: 8px`, le souffle `--abs-pli-évasement: calc(2 * (8 + 3))` = 22, payé en `padding-left` et `padding-bottom` du champ — `overflow-x: auto` coupe, une feuille rognée ne se lit plus pliée |
| **on ne voit pas où s'arrête la planche d'une journée** | le jour du dessin mesure **145** (x 305 → 1320 pour sept cellules) ; la maison rendait 108, et sur l'écran du fondateur le champ étiré donnait **127**. Une planche « 📚 Formation · 1 j » demande 251 pixels : à 127 elle déborde de **98 % d'un jour**, à 145 de 40 %, au dessin 8 % (sa planche d'un jour fait 162 pour 145) | la cause n'était pas la planche, c'était **la plaquette du solde, à qui l'on réservait 147 pixels de colonne** depuis l'étagère. Le dessin ne réserve rien : sa plaquette est peinte PAR-DESSUS la dernière cellule. `LARGEUR_SOLDE` sort du composant, la largeur du champ se calcule **une** fois — `--abs-pli-champ: calc(nb-jours × jour)` — lu par l'entête ET par la piste, et le plateau prend `width: max-content` : il mesure ses jours, il ne mesure plus l'écran. Et l'entête écope de `padding: 0 var(--abs-pli-rule)` — il surplombe le cadre, il ne le borde pas : sans les trois pixels de règle à chaque bout, ses sept étiquettes se répartissaient 1 021 au lieu de 1 015, soit un jour de 145,86 et six pixels de dérive à la dernière cellule (la dérive du 25/11 sous une autre forme). Et la planche ne passe plus SOUS la plaquette, où sa rive se perdait dans le sable : `max-width: calc(100% - entree - solde - 2px)` |
| **« Déplier tout » s'effaçait après service** | rien à mesurer sur le dessin : la case est posée à x 1143..1173, qu'il y ait des lignes à replier ou non. Ce qui se mesure, c'est le geste : ouvrir restait possible, fermer non | la case est **toujours là** en semaine et au mois (le jour ne plie pas, sa feuille a déjà son étage « Présents ») et c'est son MOT qui bascule : « Déplier tout » / « Replier tout », la case cochée disant l'état. Elle s'éteint (`disabled`, encre à 0,4) quand il n'y a rien à ouvrir, au lieu de s'effacer. Le verrou 29 ne lit plus la feuille : il **clique** deux fois dans un `createRoot`, et vérifie que le registre disparaît puis revient |
| **les fils traversaient les boîtes** | la corde était tendue `top: … ; bottom: 0` de sa pièce — donc du bois jusqu'au PIED de la boîte, en coupant la plaque de la période, les deux clous et le registre des modes | `bottom: auto` et une hauteur qui se DÉDUIT : `descente − ciel − (bois − anneau) / 2` = **36 pixels** (42 de descente, sommet de corde à 6), soit exactement le `padding-top` que la pièce prend pour son bois. Le verrou 19 de la tringle relit les deux du même jeton, et la dérive est impossible à écrire |

## Trois cotes de la plaquette, reprises sur le dessin

La passe du 10/12 avait coté la jauge sur une boîte que le dessin ne trace pas. En
redécoupant la bande y 225..255, x 1100..1345 :

| ce que je portais | la mesure | le jeton |
|---|---|---|
| pilule **43 × 19**, à **27** du bord droit, dans une plaquette de **147** | pilule **50 × 18** à x 1178..1228 (cerclée de 2, argile jusqu'à x 1218 = 82 %) ; « + 26/30 » de x 1237 à x 1307 ; **aucun cadre** autour des deux — la seule encre verticale de la bande est le montant du plateau | `--abs-pli-jauge: 50px`, `--abs-pli-jauge-hauteur: 18px`, `--abs-pli-solde: 130px` (1178..1307), `--abs-pli-solde-repli: 13px` (1320 − 1307) |

C'est un retrait de nombre, pas un redressement de goût : compter 43 et 27, c'était
compter les bords d'une boîte inventée. La plaquette valait 147 en JavaScript et
130 en CSS — deux mesures d'un objet qui n'existe qu'une fois.

## Les chiffres du contrôle (11/12)

| mesure | valeur |
|---|---|
| `npx vitest run` | **200 fichiers · 2 846 tests ✓** (0 échec) — pli **30** verrous (28 et 29 sont neufs, et le 29 clique), tringle **24** (le 19 est neuf), modes 21, rendu 10 |
| verrous réécrits, pas relâchés | 3 (le souffle de l'éventail à la place du seul `padding-bottom`), 5 (la borne de planche rend sa plaquette), 12 (le champ s'écrit une fois, `LARGEUR_SOLDE` est mort), 14 et 22 (la jauge à 50 × 18, la plaquette à 130, le repli à 13), 15 (un `\|\| true` qui disait vrai quoi qu'il arrive est remplacé par l'ordre rendu du compte après les pastilles) |
| `npm run charte` | **inchangé** : 64 tailles · 43 marges · 27 rayons, recompté sur l'arbre de `HEAD` et sur celui d'aujourd'hui — aucune valeur brute ajoutée, tous les nombres du pli passent par les jetons (le VERDICT reste NON CONFORME, il l'était avant) |
| `npx eslint` sur les deux fichiers touchés | 0 |
| `npm run build` | ✓ (19,4 s) |

## Ce que le dessin ne dit pas, et que je laisse ouvert

* ~~**le mot long au bord droit.**~~ **RÉGLÉ le 12/12** — et contre ma préférence :
  j'avais écrit que la planche doit pousser au mot, le fondateur a écrit que la
  planche dit la période. C'est `left`/`right` seuls, `max-width: min(fit-content,
  …)`, et l'ellipsis sur le nom du motif ; la durée « · N j » et l'emoji restent.
* ~~**la plaquette sur le dernier jour.**~~ **RÉGLÉ le 12/12** — la plaquette n'a
  plus de fond : rien ne glisse plus sous un cache, parce qu'il n'y a plus de cache.

## Ce qui reste ouvert, à dire

* **la nuit.** Les règles du pli sont écrites sur les teintes du jour et ne portent
  aucun `@media` de thème : le passage en nuit (sable → `#1C1109`, encre → `#F3E9DA`)
  garde le cerclage, mais le **lavage** à 0,26 sur un fond sombre et l'ombre dure en
  `--charte-bordure` demandent un relevé — le dessin n'a qu'un thème, je ne
  l'invente pas.
* **l'échelle.** LEVÉE le 11/12 : le jour est à **145**, comme au dessin — voir
  « Quatre manquements » ci-dessous. Restent 36 en mois et 460 en jour, que le
  dessin ne dessine pas ; ils ne sont plus une proportion de la maison, ils sont
  un pas de défilement, et le jour du mois se lit toujours à la pointe près.
* **les trois largeurs de coupure** (1 560 / 900 / 360) : à 360 px, la media ne
  déplace rien, elle borne le prénom (110) et raccourcit la jauge de moitié. Le
  plateau défile. Tenir sept colonnes d'aplomb sans colonne de solde réelle — est-ce
  que ça se lit encore, ou faut-il passer le champ en `min-width: 0` sec ?

# Cinq manquements de la semaine du 12/12 — la pile, le mot, le pli, la barre, le mois

Quatre captures et cinq phrases. Rien ici n'est une opinion : chaque ligne qui suit a
été mesurée sur `maquettes/absences-grille-2-pli.png` (1376 × 768) ou sur le rendu
renvoyé (`image-120`, 2752 px de large, facteur 2,032 ; `image-122`, mode mois).

| le manquement | ce que la mesure a dit | ce qui a bougé |
|---|---|---|
| **« la flèche remplit deux jours alors que le congé n'est que 1 jour — elle déborde en fonction de la longueur du texte »** | la planche « Absence injustifiée · 1 j » faisait **251 px** pour une cellule de **145**, exactement à cause du `min-width: max-content` que j'avais posé la veille pour défendre le mot | le plancher est mort : `min-width: 0`, `max-width: min(fit-content, 100% − entrée − solde − 2px)`, et l'ellipsis **sur le nom du motif seul** (`.abs-pli-motif`) ; `.abs-pli-durée` et `.abs-pli-séparateur` se retiennent de se serrer, `title` / `aria-label` / tiroir gardent la phrase entière. Pas d'`overflow: hidden` sur la planche : sa pointe de ruban est un enfant posé à `left: -16px`, le cadre la mangerait (verrous 5 et 32) |
| **« les feuilles pliées, jusque-là tu n'as rien fait »** | elles étaient écrites ET géométriquement justes — arêtes à x 42..45 et x 34..37 pour un montant à 50..52, descentes de 11 et 22 — mais **peintes sous le fond de la page** | `isolation: isolate` sur `.abs-pli-plateau`. Un `z-index: -1` se peint dans le contexte d'empilement du plus proche ancêtre qui en crée un : ici la racine, donc derrière le sable de `.abs-cal`, donc invisible. Le plateau était `position: relative` sans `z-index` — il ne créait rien. C'est le verrou 30, et la leçon : une cote juste dans un empilement faux ne se voit pas |
| **« impossible de cliquer sur un employé plié, et le déplier ou le plier juste lui »** | le pli n'avait qu'un commutateur global, écrit dans `useState(déplierTout)`, et la pastille du registre était un `<span>` — « muette », comme je l'avais décidé le 10/12 | deux ensembles de **déviation** (`pliOuverts`, `pliFermés`) et un défaut par ligne : ouvert si la ligne a une planche. La pastille devient `<button aria-pressed>`, chaque ligne porte **sa pince** (`.abs-pli-plier`, rangée rive de la colonne d'identité, jamais sur la piste qui dépose), et la case d'entête **n'est plus un état** : son `checked` se relit des ensembles. Verrou 31 : un montage vivant, trois clics, ligne seule |
| **« rien ne se passe dans la grille quand on cherche un employé — il devrait trier, juste me montrer l'employé que je recherche »** | `searchQuery` filtrait `filteredAbsences` (la liste, les cartes) et n'était jamais passé au calendrier : la grille recevait `employes`, l'effectif entier | `employésDuChamp` à la page, **un seul prédicat** (prénom, nom, matricule), lu par la grille. Le pli suit tout seul : chercher « Boss » laisse une ligne et un registre de deux pastilles, et le compte du haut ne bouge pas — il dit la période, pas le filtre |
| **« beaucoup d'anomalie quand la grille passe en mode mois »** | à trente et une cellules de 36 : la plaquette du solde (130 px) mangeait trois jours et demi, la jauge de 50 débordait son nombre, le mot de 20 px coupait dans tous les traits, et le pli repliait onze adultes en pastilles pour une ligne vide | le mois **ne plie pas** (`pliActif = mode === 'semaine'`), la plaquette se relit à `--abs-pli-solde-mois: 0`, la pilule ne se rend même pas, l'étiquette de planche passe au corps de 11. Le nombre du solde reste — c'est une donnée, pas un ornement (verrou 17) |

Et la **barre d'outils** (« il faut retravailler cette section ») : elle était écrite
en `style` inline — coins de 12, fond blanc flottant, ambre en accent, 42 px de haut —
un morceau d'une autre page cousu au-dessus du plateau. Elle prend les classes
`abs-outils*` de la feuille : règle de trois en encre, `--charte-rayon-champ`, aucun
relief, boîtes-cadres (un champ s'entoure, il ne se soulève pas), modes d'affichage en
une seule tringle cloisonnée, actif rempli d'argile (blanc cassé dessus : 4,64:1). La
hauteur se relit sur `--abs-pli-case` (30), l'écart sur `espace-3` — pas de cote neuve :
le comptage de la charte est **inchangé**, 64 tailles · 43 marges · 27 rayons.

## Le solde, rempli de ce qui est pris

Relevé sur le même crop : la pilule du dessin (x 1178..1228) est remplie d'argile
jusqu'à **x 1218**, sous un nombre qui dit « 26/30 ». 40/50 = 80 % pour un solde de
26 sur 30 — donc le remplissage dit CE QUI EST PRIS (4), pas ce qui reste (26). Je
remplissais du restant : un solde épuisé se dessinait vierge. Deux corrections d'un
coup, l'intérieure (le pourcentage d'un absolu se mesure au Border-Box du conteneur
positionné, donc `calc((100% - 2 × trait) × plein / 100%)`) et le sens.

## Les chiffres du contrôle (12/12)

| mesure | valeur |
|---|---|
| `npx vitest run` | **200 fichiers · 2 849 tests ✓** (0 échec) — pli **33** verrous (30, 31, 32 sont neufs), tringle 24, modes 21, rendu 10, logique 98 |
| verrous réécrits, pas relâchés | 5 (le plancher du mot devient celui du jour), 14 (plaquette sans fond, jauge intérieure, 4/30 = 13 %), 16 (la pastille muette devient le contrôle), 17 (le mois ne plie pas, la partition se relit), 18 (la case n'est plus un `useState`) |
| `npm run charte` | **inchangé** : 64 · 43 · 27, recompté sur `git archive HEAD src` et sur l'arbre d'aujourd'hui — aucune valeur neuve |
| `npm run build` · `npx eslint` | ✓ (17,7 s) · 0 problème neuf sur les trois fichiers (trois erreurs de variables mortes préexistantes dans `Absences.jsx`, laissées telles quelles) |
