# Absences · la section du haut — le transat

**Le fond de l'affaire :** deux montants, une suspente, un nombre suspendu dedans.

Fiche de pose de la figure retenue par le fondateur, maquette `maquettes/absences-haut-E-cremaillere.png` (27/11/2026). Les chiffres viennent des données réelles de la base de démonstration ; les cotes, de la maquette.

## Ce qui a été refusé avant d'être compris

Trois versions de ce haut de page sont tombées, et les trois pour la même raison — **une bande de tissu autour de la feuille** :

1. une **frise SVG bogolan** ;
2. un **cadre** complet (`docs/ABSENCES-SECTION-BOGOLAN.md`) ;
3. une **lisière** en bord bas avec six rabats (`docs/ABSENCES-EN-TETE-LISIERE.md`).

Sur les trois, la réponse a été la même. Relues ensemble, elles ne disent pas « le motif est laid » mais : **un habillage n'est pas une structure**. Une reprise de section qui n'ajoute qu'un ornement ne reprend rien — la feuille est toujours faite d'une ligne d'icôtes, de trois onglets et de quatre compteurs, alignée à la règle sur les treize autres écrans du répertoire. À la troisième fois, le mal était assez clair pour être nommé : **rien, dans cette page, ne parlait des vacances.**

## La figure

Un transat posé entre deux montants. On y regarde moins le tissu que **ce qui est pendu dedans**.

Deux choses, dont une seule était dans la maquette :

* **La suspente est une crémaillère** : dix-sept carreaux de 8 px, huit de descente, huit de remontée, le dernier portant le nombre. C'est la seule forme d'affaissement que la charte autorise — C8 interdit le rayon, D-016 borne les valeurs d'espacement, **une courbe se refuse ici**.
* **Le nombre suspendu est une tuile active** : il se clique et descend vers la tuile `Congés restants (moyenne)` des compteurs. Une tuile **posée sous la corde serait par terre** et ne suspendrait plus rien, c'est elle qui remonte à mi-hauteur de l'affaissement.

**Le solde se calcule une fois.** Sur la maquette, le `30` apparaissait deux fois — dans la suspente et dans la tuile de compteur, et ce n'était pas une coquille du dessinateur. Deux affichages d'un même chiffre se tolèrent, deux calculs non : la formule a donc quitté `AbsencesKpiCards` pour `src/services/congesRestants.js`, où le composant et la page puisent la même moyenne. Un décalage de quelques dixièmes entre le chiffre du transat et celui du compteur aurait fait du transat une promesse fausse — un bandeau qui ment est pire qu'un bandeau laid.

## Retraits

| ce qui part | pourquoi | ce qui reste |
|---|---|---|
| le rail de raccourcis (six icônes) | « désormais dans chaque nouvelle page enlève les raccourcis » | le composant, sur les treize autres écrans |
| le bouton clair/sombre | « enlève le bouton clair/sombre » | le thème, lu dans `localStorage['encheck.theme']` |
| le bandeau bogolan de l'en-tête | « un bandeau motif bogolan servira autrement » | le tissu, dans les deux tiroirs ; l'identité de la page |
| la prop `comptes` du rail | inventée pour le rabat d'Absences, plus aucun poseur | les compteurs, dans les bulles elles-mêmes |

Le rail **ne revient pas** sur les onglets de section : le transat n'a plus de support à porter.

## Ce que la maquette montrait de faux, et qui n'a pas été recopié

* **`1 ABSENT AUJOURD'HUI`** : la base ne contient qu'une absence, du 28 au 30 novembre ; le jour de la maquette, personne n'est absent. Les compteurs affichent donc 0.
* **`KPODION A. · 12 J`**, un salarié sans demande : supprimé (figure B).
* **`3 J POSÉS`** : un compteur de plus pour dire le solde, et qui se contredit avec la tuile (30 − 27 = 3).

Le contre-argument à la figure retenue est **dans le contrat** : le transat seul est une image, pas une information.

## Les chiffres

| mesure | base `8dfd9ba` | après |
|---|---|---|
| `vitest run` | 194 fichiers · **2708 tests ✓** | 194 fichiers · **2707 tests ✓** (le contrat de la lisière est mort avec elle) |
| `vite build` | ✓ | ✓ 2849 modules |
| `npm run charte` · couleurs en dur | 4548 · 185 fichiers | **4548 · 185** |
| `npm run charte` · ombres floues | 131 | **131** |
| `npm run charte` · rayons hors liste | 359 · 18 valeurs | **359 · 18** |
| `eslint src` | 242 erreurs · 64 avertissements | **242 · 64** |

**Le linge sale lavé au passage** : `RaccourcisPages` recevait un test de classe exacte `header.className === 'abs-topbar'`, et la page passait `abs-topbar abs-topbar-nav` — à l'écran, ces six liens étaient peints **sans rail**. Un composant qui ne reçoit jamais la classe qu'il teste est un mensonge sur le composant ; c'est le rail qui est parti, pas le test qui a été assoupli.

## Ce que la maquette disait, mais n'a pas été fait

* **Le retour à droite : « LUN. 30 NOV. » est devenu « RETOUR LUN. 30 NOV. ».** La maquette montrait `1` sous la légende `RETOUR LUN. 30 NOV.` — si « 1 » était le nombre de retours, le texte est faux ; si c'était un compteur d'absents, la tuile en affiche déjà un. Un mot court ne se devine pas, il se nomme.
* **La suspente a été centrée**, alors que la maquette la montre à gauche, avec le nom de l'écran sous les carreaux. Le nom est déjà dans la feuille de titre.
* **Le fond reste peint en CSS**, répété à la largeur de la feuille et coupé en bas par une lisière dure — la crémaillère est faite de dix-sept éléments posés par le composant, comme les trous d'œillets de la lisière précédente, et pour la même raison.
Au contraire, trois choses vues **sur la maquette** et corrigées dans le code : la corde y déborde de son cadre à gauche, le `30` s'y répète deux fois, et le creux n'y est pas centré sous le nombre.

## Trois défauts trouvés en relisant le code, pas à l'œil

Une géométrie non rendue se relit comme une preuve : ces trois-là étaient écrits dans la feuille, ils n'attendaient que la soustraction.

* **La corde débordait de la carte.** `width: 100%` **plus** `margin: 0 18% 0 12%` sur un enfant de `flex-direction: column` ne rétrécit pas la corde de 30 % : ça la décale de 3 % et la laisse pleine largeur. Le poteau de gauche se peignait hors du conteneur. Corrigé par `align-self: stretch` sans largeur.
* **Deux centrages qui ne se connaissaient pas.** La corde était à 47 % de la feuille (12 % à gauche, 18 % à droite), la tuile à 50 % (`align-items: center`) : le nombre pendait de trois pour cent à droite du creux. Les montants sont désormais à **15 % des deux côtés**, et la tuile se centre en `margin-inline: auto` sur la corde elle-même. Un axe partagé, pas deux axes qui se ressemblent.
* **Le `-46 px` n'était pas justifié, seulement écrit.** La règle de la feuille disait « le fond est à 72 px, la corde en fait 118 » sans que rien ne le vérifie ; le composant exportait `FONDS = 64`, qui est le **haut** du dernier carreau, pas son bas. La soustraction est maintenant dans le contrat : `margin-top === (FONDS + PAS_PX) - min-height`, soit 72 − 118. Si un jour la marche change de taille, le chiffre suit — et si le `min-height` de la corde bouge sans celui des montants, le test tombe.
* **Il manquait les deux coupures d'écran.** Rien n'était prévu à 980 px : la note de retour, en absolu à `right: 5 %`, se couchait sur la tuile de 216 px qui commente le même chiffre ; et à 650 px la tuile gardait son `min-width` et sortait de la feuille. Les deux existent maintenant, et le contrat les cherche par regex dans la feuille, pas dans une copie du commentaire.

**Le hors-sujet assumé :** aucune donnée de trésorerie n'a été touchée, et les six figures maquette ont été dessinées, pas encore toutes comprises. Le bogolan « servira autrement » reste **non spécifié** ; il n'est plus en page que dans les deux tiroirs.

## Ce qui reste à faire

0. **Relire le transat sur un vrai navigateur** : ici, pas de rendu — la géométrie est prouvée par l'arithmétique de la feuille et par `renderToStaticMarkup`, pas par un coup d'œil. Les `15 %` de montant, à 1440 px comme à 700 px, restent une déduction.
1. **Refaire la ligne d'icôtes** — deux boutons sur trois portent `⋯` et ouvrent le même menu de recherche : un bouton qui ne dit pas ce qu'il fait.
2. **Refaire les quatre tuiles de compteurs** avec des libellés entiers (`TODAY` → `AUJOURD'HUI`), sans troncature.
3. Décider enfin **ce que devient le bogolan**.
