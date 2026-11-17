# Examen du dashboard — UX, organisation et système

> **Audit, pas livraison.** Ce document ne modifie aucun écran. Il établit ce qui
> tient, ce qui ne tient pas, et dans quel ordre corriger pour viser un niveau
> « produit professionnel » — c'est-à-dire un produit qu'on peut mettre en face
> de Rippling, Gusto, Stripe ou Linear sans avoir honte.
>
> **Registre** : tout est « à faire ». Une capture n'est pas une réalisation, et
> une capture qui ne correspond à aucun code versionné n'est pas une preuve.

---

## 0. Périmètre, et une réserve de traçabilité

**Ce qui a été examiné** : six captures du dossier Drive « Examen du dashboard »,
datées du 17 novembre 2026 — vue du haut, vue du bas, barre latérale dépliée
(haut et bas), notifications ouvertes.

**Ce que je n'ai pas vu** : mobile, tablette, mode clair, état de chargement,
état d'erreur, état hors ligne, premier lancement, compte à zéro employé, rôle
autre que super-administrateur. Ces états comptent autant que la vue de
référence — j'y reviens au §6.

**La réserve, et elle est sérieuse.** Trois libellés visibles sur les captures
n'existent pas dans le code de ce dépôt :

| Libellé vu sur la capture | Présent dans `src/` ? |
| --- | --- |
| « INSIGHT DU JOUR » | **non** |
| « Santé RH » | **non** |
| « Présence par jour et heure » | **non** |

À l'inverse, « Taux de présence », « Entreprises actives » et « Accès rapide »
existent bien (`src/components/DashboardExperience.jsx`).

**Conclusion : les captures ne représentent pas l'état de `main`.** Les travaux
UX ont été faits ailleurs — autre branche, ou autre outil. Ce n'est pas un
détail : c'est exactement le défaut que le registre du dossier « IA ANALYSE »
interdit. **Tant que ces écrans ne sont pas dans une branche de ce dépôt, ils ne
peuvent être ni revus, ni testés, ni validés.** Première action, avant toute
correction : retrouver la branche et l'ouvrir en PR.

L'audit qui suit porte donc sur **ce que les captures montrent**, et sur ce que
le code de ce dépôt permet de vérifier du comportement.

---

## 1. Verdict

**Le dashboard est beau, cohérent, et il raconte la mauvaise histoire.**

Il est visuellement au-dessus de la moyenne du marché local : identité africaine
assumée, palette maîtrisée, densité correcte, sidebar repliable, centre de
notifications. Ce n'est pas le travail d'un débutant.

Mais il échoue à la seule question qu'un dirigeant lui pose le matin :

> **« Qu'est-ce qui va mal, et qu'est-ce que je dois faire maintenant ? »**

À la place, il répond **cinq fois la même chose** — « personne n'a pointé » —
sous cinq formes différentes, et il conclut à une catastrophe (-75 %) sur la foi
de huit pointages.

**Ce n'est pas un problème de goût. C'est un problème de vérité, d'organisation
et de système.** Et c'est corrigeable sans refaire la direction artistique, qui
est validée et qu'on ne touche pas.

---

## 2. Ce qui tient déjà — et qu'il ne faut pas casser

| Élément | Pourquoi c'est bon |
| --- | --- |
| **La bande culturelle** | Signée, immédiatement reconnaissable. Ne pas redessiner (règle du fondateur). |
| **La palette sombre** | Cohérente, contrastée sur les grands titres, chaude sans être criarde. |
| **La barre latérale repliable** | Bon réflexe : sur une borne ou un petit écran, l'espace est rare. |
| **Le sélecteur d'entreprise** | Un vrai besoin multi-sociétés, traité au bon endroit. |
| **Le centre de notifications** | Le bon objet, au bon endroit, avec des onglets par domaine. |
| **Le sélecteur 7 j / 30 j / 90 j** | Bonne intention : un dashboard doit avoir une fenêtre de temps. |
| **« Partager le rapport »** | Rare dans les produits de cette taille. À garder, à condition de montrer ce qu'on partage. |
| **Les états vides illustrés** | Il y a une intention (« Tout est calme pour le moment »). L'exécution est à revoir, pas l'idée. |

Un audit qui ne dit pas ce qui va bien n'aide personne à décider. Ce socle est
réel : la refonte doit **s'appuyer dessus**, pas repartir de zéro.

---

## 3. Famille A — La vérité de la donnée (le plus grave)

Un produit professionnel peut être lent, dense, moche. Il ne peut pas **affirmer
ce qu'il ne sait pas**. C'est le seul défaut qui coûte un client.

### A1. « Absent » est une conclusion, pas une donnée

**Constaté.** Le dashboard affiche « 0 retards · 6 absents » et un donut
« Absents 100 % » à 10 h 46 du matin, un jour où **personne n'a jamais pointé
dans l'entreprise**.

**Vérifié dans le code.** `src/components/DashboardExperience.jsx:361` définit
les absents comme « Membres sans pointage ni congé déclaré ».
`src/pages/Dashboard.jsx:402` applique exactement ce filtre, et
`Dashboard.jsx:519` calcule `totalEmployes - presentsToday - onLeave`.

Autrement dit : **« absent » signifie « n'a pas encore pointé »**. Un salarié qui
embauche à 14 h est « absent » à 8 h. Un salarié en pause est « absent ». Une
entreprise qui installe le produit est « 100 % absente » le premier matin.

**Pourquoi c'est disqualifiant.** Le produit vend la preuve. Ici, il produit une
accusation à partir d'une absence d'information. Devant un salarié, dans un
litige, ce chiffre ne tient pas une seconde.

**Ce qu'il faut.** Quatre états distincts, jamais confondus :

| État | Définition | Quand |
| --- | --- | --- |
| **Pas encore pointé** | Aucun geste, le poste n'a pas commencé ou est en cours | Tant que l'heure de fin de poste n'est pas dépassée |
| **En poste** | Entrée acquittée, pas de sortie | Maintenant |
| **En retard** | Entrée après l'heure prévue + tolérance | Après le seuil |
| **Absent non justifié** | Poste terminé, aucun geste, aucune absence déclarée | **Après** la fin du poste seulement |

Le mot « absent » ne doit **jamais** apparaître avant la fin du poste.

### A2. Le jour en cours est comparé à des jours complets

**Constaté.** Les trois cartes du haut affichent « -75 % » à 10 h 46. L'encart
d'insight l'explicite : « 2 pointages contre 8 la semaine précédente ».

**Le défaut.** « Aujourd'hui » à 10 h 46 est comparé à des journées entières. La
baisse est **mécanique**, pas réelle : elle disparaîtra à 18 h. Un dirigeant qui
ouvre le produit le matin voit une chute qui n'existe pas.

**Ce qu'il faut.** Soit on compare **à heure égale** (« à 10 h 46, 0 pointage
contre 3 en moyenne »), soit on exclut le jour en cours. Il n'y a pas de
troisième option honnête.

### A3. Des pourcentages sur des bases minuscules

**Constaté.** « -75 % » apparaît **trois fois** : sur « Présents aujourd'hui »,
sur « Pointages du jour », et dans l'insight du jour. La base est **8 → 2**.

**Le défaut.** Sur huit événements, une variation de 75 % n'a aucune
signification statistique. C'est du bruit présenté comme une tendance.

**Ce qu'il faut.** Une règle écrite, dans le produit : **en dessous de 30
événements dans la période, on affiche la valeur absolue, jamais le
pourcentage.** Et on ne montre pas deux fois le même indicateur.

### A4. Trois dénominateurs, aucun nommé

**Constaté.** Sur le même écran :

- « Présents aujourd'hui : 0 » — sur **6 employés**
- « Pointages du jour : 0 » — sur des **événements**, pas des personnes
- « Présence aujourd'hui : 6 total » — encore des employés
- « Entreprises actives : 0/8 ont pointé » — encore des employés
- « Assiduité : 17 » et « Régularité : 100 » — **sans unité, sans base**

**Le défaut.** Rien ne dit sur quoi porte chaque chiffre. « Assiduité 17 » : 17
personnes ? 17 % ? sur 17 quoi ? Et la barre de progression sous « 17 » est à
40 % : le nombre et la barre ne racontent pas la même chose.

**Ce qu'il faut.** Un **dictionnaire de données** unique (§7), et une règle
d'affichage : **tout chiffre porte son unité, sa base et sa période**, dans cet
ordre ou dans une infobulle.

### A5. Une division par zéro présentée comme un résultat

**Constaté.** « ENTREPRISE TEST ANNONCES — 0/0 ont pointé — 0 % ».

**Le défaut.** 0 sur 0 n'est pas 0 %. C'est **indéfini**. Afficher 0 % est faux.

**Ce qu'il faut.** « Aucun employé actif » à la place du pourcentage.

### A6. Un insight tiré de cinq points, et mal lu

**Constaté.** « Sur 7 jours, le flux est le plus dense le Jeu ; le week-end pèse
50 % du total des pointages. » La grille ne contient que **cinq cases allumées**,
dont quatre le samedi et le dimanche.

**Le défaut, en deux temps.** D'abord, une conclusion sur cinq points. Ensuite,
et c'est plus grave : **des pointages le week-end sont probablement une anomalie**
(oublis de sortie du vendredi, ou équipe de nuit mal configurée), pas un motif de
satisfaction. Le produit présente un défaut de données comme une bonne nouvelle.

**Ce qu'il faut.** Un insight doit toujours répondre à « est-ce normal ? ». S'il
n'y a pas de référence historique, **il ne doit pas y avoir d'insight** — seulement
un constat factuel.

### A7. « Santé RH » — un nom qui trompe

« Santé » évoque le médical, l'arrêt de travail, la médecine du travail. Ce que
la carte mesure est la **ponctualité et la fiabilité des pointages**. Renommer :
« Ponctualité », « Fiabilité des pointages », ou « Discipline horaire ».

### A8. Aucun état « pas encore de données »

**Constaté.** Un compte avec 6 salariés qui n'ont jamais pointé affiche un
dashboard complet : cinq zéros, deux -75 %, une jauge à 0 %, un donut à 100 %
d'absents.

**Le défaut.** Un produit neuf **ressemble à une catastrophe**. C'est le pire
moment possible : celui de la première démonstration commerciale et du premier
lundi du client.

**Ce qu'il faut.** Trois états distincts, jamais confondus :

- **Jamais de données** → un parcours de mise en route (ajouter un employé,
  enregistrer une borne, faire un premier pointage), pas des graphiques vides.
- **Données insuffisantes** → « Pas encore assez de recul pour comparer »,
  avec le nombre de jours restants avant une référence fiable.
- **Données partielles** → « Journée en cours », avec l'heure de référence.

---

## 4. Famille B — L'organisation de la page

### B1. Le même fait, cinq fois

**Constaté.** « Personne n'a pointé » est dit par : Présents (KPI), Pointages du
jour (KPI), Présence aujourd'hui (donut), Taux de présence (jauge), Entreprises
actives (liste à 0 %). Et l'insight du jour le redit.

**Le défaut.** Cinq graphiques pour un fait unique. Ce n'est pas de la richesse,
c'est du **remplissage**. Le regard n'a nulle part où se poser, et le dirigeant
ne peut pas hiérarchiser.

**Ce qu'il faut.** **Un fait = un emplacement.** La jauge et le donut disent la
même chose que le KPI : garder le KPI (le plus lisible), et réserver le donut à
une répartition qui apporte une information neuve (présents / en poste / en
pause / en retard / pas encore pointé).

### B2. Les actions sont en bas

**Constaté.** « Accès rapide » (Ajouter un employé, Consulter les pointages,
Ouvrir le planning, Créer un rapport) est **le dernier bloc de la page**, sous
les graphiques.

**Le défaut.** Un dashboard sert à **agir**, pas seulement à lire. Placer les
actions après trois écrans de lecture, c'est obliger à défiler pour travailler.

**Ce qu'il faut.** Les actions fréquentes en haut ou dans la zone d'attention —
et si elles restent en bas, qu'elles soient au moins **contextuelles** (« traiter
les 2 oublis de sortie » plutôt que « Consulter les pointages »).

### B3. « Accès rapide » duplique la navigation

**Constaté.** Les quatre actions existent déjà dans la barre latérale
(Employés, Pointages, Planning, Rapports).

**Le défaut.** C'est un doublon, explicitement interdit par les règles du
produit. Un raccourci n'a de valeur que s'il mène quelque part **d'inhabituel**
ou **de contextuel**.

**Ce qu'il faut.** Soit on supprime le bloc, soit on le remplace par des actions
qui n'existent pas dans le menu : « Clôturer le mois », « Produire l'annexe »,
« Partager le dossier de preuve ». Là, le raccourci a une raison d'être.

### B4. Deux champs de recherche concurrents

**Constaté.** « Filtrer la navigation » dans la barre latérale, et « Recherche
intelligente » en bas de l'écran.

**Le défaut.** Deux entrées pour la même intention. L'utilisateur ne sait pas
laquelle utiliser, et les deux font moins bien qu'une seule bien faite.

**Ce qu'il faut.** **Une seule palette de commandes**, au clavier (Ctrl+K),
capable de filtrer la navigation *et* de chercher un employé, un pointage, une
entreprise. Le champ « Filtrer la navigation » disparaît.

### B5. Le vide occupe les meilleures places

**Constaté.** « À vérifier » occupe environ 250 px de hauteur pour afficher un
encadré pointillé vide. « Activité récente » occupe environ 250 px de plus pour
un second encadré vide. Sur un jour sans données, **les deux plus grandes zones
de la page sont vides**.

**Le défaut.** L'espace le plus précieux du produit est consacré à dire qu'il
n'y a rien.

**Ce qu'il faut.** Un état vide tient en **une ligne** (« Rien à signaler
aujourd'hui ») et rend l'espace au reste. Une grande zone ne se justifie que
lorsqu'elle a du contenu — et la mise en page doit s'adapter, pas réserver.

### B6. Le hero photo mange le premier écran

**Constaté.** Le bloc « Bonjour, Buta » avec photo occupe environ 210 px de
hauteur, soit plus du quart du premier écran.

**Le défaut.** Sur un outil consulté tous les jours, une illustration fixe est
de la décoration coûteuse. Elle est utile une fois — à la première connexion.

**Ce qu'il faut.** Hero complet à la première visite, puis **version compacte**
(salutation + une phrase d'état + actions) les jours suivants. La photo peut
revenir dans les écrans de premier lancement.

### B7. « À vérifier » mélange trois objets

**Constaté.** Le texte de l'état vide annonce : « Aucun conflit, oubli de sortie
ou demande d'horaire en attente. »

**Le défaut.** Trois natures différentes — un conflit de pointage, un oubli de
sortie, une demande d'horaire — avec trois actions différentes, dans un même
compteur. Impossible de savoir quoi faire d'un « 3 à vérifier ».

**Ce qu'il faut.** Une ligne par objet, avec **l'action** associée et **le
destinataire** : « 2 oublis de sortie à valider », « 1 conflit de pointage à
arbitrer », « 1 demande d'horaire à répondre ».

### B8. Vingt-trois entrées de navigation à plat

**Constaté.** Sidebar dépliée : Accueil, Employés, Planning, Absences, Annonces
d'accueil, Pointages, Retards, Pauses, Jours fériés, Heures supplémentaires,
Rémunérations, Paie & fiscalité, Rapports, Prédictions, Configuration pointeuse,
Géopointage, Reconnaissance faciale, Entreprises, Administrateurs, Messages
système, Prospection, Analytics du site, Test IA (isolé), Personnalisation.

**Le défaut, en deux temps.**

1. **Des outils internes cohabitent avec le métier du client** : « Test IA
   (isolé) », « Analytics du site », « Prospection » ne concernent pas un
   directeur d'épicerie. Ils polluent la navigation et donnent une impression
   d'outil en chantier.
2. **Aucune hiérarchie de fréquence** : « Administrateurs » est au même niveau
   que « Pointages », alors que l'un se consulte tous les jours et l'autre deux
   fois par an.

**Ce qu'il faut.** Séparer deux mondes : **« Mon entreprise »** (le métier) et
**« Outils En-Check »** (interne, réservé aux super-administrateurs, masquable).
Et à l'intérieur du premier, une section **« Quotidien »** en tête.

### B9. La portée du sélecteur de période est ambiguë

**Constaté.** « Vue d'ensemble · 7 derniers jours » avec un sélecteur 7/30/90.
Mais les cartes du haut sont intitulées « PRÉSENTS **AUJOURD'HUI** ».

**Le défaut.** Le sélecteur contrôle-t-il « Présents aujourd'hui » ? Non — et
pourtant il est visuellement au-dessus. C'est un contresens de lecture garanti.

**Ce qu'il faut.** Soit le sélecteur est **local à la section des graphiques**,
soit chaque carte affiche sa propre période. Jamais un contrôle global qui ne
s'applique qu'à une partie de l'écran.

### B10. « Partager le rapport » sans aperçu

**Constaté.** Le bouton est présent, sans indication de ce qui sera partagé, ni
avec qui, ni sous quelle forme.

**Le défaut.** Dans un produit qui vend la preuve, un partage non spécifié est
une fuite potentielle — et un doute pour l'utilisateur.

**Ce qu'il faut.** Un aperçu avant envoi, le périmètre explicite, et un lien
**daté et révocable**. C'est exactement la mécanique prévue pour le mode
inspecteur de la feuille de route : autant la réutiliser.

---

## 5. Famille C — Le système

### C1. La recherche flottante recouvre le contenu

**Constaté.** Sur la capture du haut, le pilulier « Recherche intelligente »
chevauché le haut de l'encart d'insight. Sur les captures 4 et 5, il recouvre le
bloc « À vérifier ».

**Le défaut.** Une règle explicite du produit interdit qu'un élément recouvre le
contenu. Elle est enfreinte ici par l'élément le plus visible de la page.

**Ce qu'il faut.** Réserver une bande en bas (padding de la zone de contenu), ou
ancrer la recherche dans l'en-tête. **Jamais par-dessus une carte.**

### C2. La bande culturelle est dupliquée et tronquée

**Constaté.** La bande apparaît sous l'en-tête, puis **à nouveau en bas de page**,
et cette seconde occurrence est **tronquée en largeur** (environ 600 px centrés,
au lieu de la pleine largeur).

**Le défaut.** Doublon décoratif + défaut de rendu. Les deux sont contraires aux
règles posées (« pas de décor muet, pas de doublon »).

**Ce qu'il faut.** Une seule bande par page (celle du haut). Vérifier le rendu de
la bande basse ou la retirer.

### C3. La coulisse de la barre latérale reste visible

**Constaté.** En mode replié (captures 1 à 3), une bande d'environ 40 px subsiste
entre le rail d'icônes et le contenu, avec des **fragments de texte tronqués**
(lisibles : « e », « c », « a »…).

**Le défaut.** C'est un défaut de rendu, pas un choix. Il donne une impression de
page cassée sur **tous** les écrans, en permanence.

**Ce qu'il faut.** Masquer complètement le panneau replié (`overflow: hidden` +
largeur 0), ou animer proprement la transition.

### C4. Le panneau de notifications déborde

**Constaté.** L'onglet « Commercial » est **coupé** au bord droit. Le panneau
semble dépasser la fenêtre.

**Ce qu'il faut.** Contraindre le panneau à la fenêtre (`max-width: calc(100vw -
marge)`) et rendre les onglets défilables.

### C5. Cinquante notifications non groupées

**Constaté.** « 50 non lues », dont toutes celles visibles sont du même type :
« AUCUN pointage, jamais — il est dans l'effectif et sur aucun relevé ».

**Le défaut.** Le produit a **transformé un défaut de données en cinquante
notifications**. Un centre de notifications qui n'agrège pas devient du bruit, et
le bruit se désactive — après quoi plus aucune alerte ne passe, y compris les
graves.

**Ce qu'il faut.**

- **Agréger** : « 12 employés n'ont jamais pointé → voir ».
- **Classer par conséquence**, pas par date.
- **Un plafond** : au-delà de 5 éléments, un résumé.
- **Une action par notification**, pas seulement un lien.

### C6. Un défaut d'encodage dans les noms

**Constaté.** Les titres affichent un caractère de remplacement : « ya Ya � »,
« RECETTE A � », « Emma BAYLE � ».

**Le défaut.** Un caractère cassé dans un produit payant coûte plus cher en
crédibilité que dix fonctionnalités manquantes. À corriger immédiatement.

### C7. Des données de recette en production

**Constaté.** « ENTREPRISE TEST ANNONCES », « RECETTE A », « RECETTE B », et une
entrée de menu « **Test IA (isolé)** ».

**Le défaut.** Un client qui voit « RECETTE A » dans sa liste d'entreprises perd
confiance. Et « Test IA (isolé) » dans le menu principal n'est pas un oubli
d'affichage : c'est une page de développement exposée.

**Ce qu'il faut.** Supprimer les données de démonstration de l'environnement de
production, et **sortir les pages de test de la navigation** (feature flag ou
route protégée). C'est un préalable à toute démonstration commerciale.

### C8. Le texte descend à 10 px

**Vérifié.** `src/pages/Dashboard.css`, `.dashboard-legend-row { font-size: 10px }`
— légendes, axes et notes. L'échelle typographique du dashboard descend plus bas
encore sur les libellés secondaires.

**Le défaut.** Sous 12 px, la lisibilité chute nettement, en particulier sur un
écran de tablette ou en plein soleil. Le produit est utilisé sur le terrain, pas
dans un bureau tamisé.

**Ce qu'il faut.** Un plancher à **12 px** pour tout texte porteur d'information,
13-14 px pour les libellés de données, et une échelle fixe (12 / 13 / 14 / 16 /
20 / 28 / 40).

### C9. La chaleur du week-end est encodée par la couleur seule

**Constaté.** La grille « Présence par jour et heure » utilise cinq nuances
d'orange, avec une légende « moins → plus de pointages ».

**Le défaut.** L'information n'existe que par la couleur : inaccessible aux
personnes daltoniennes, et illisible en impression noir et blanc — ce qui compte
pour un produit qui produit des rapports.

**Ce qu'il faut.** Ajouter une second canal : intensité **et** taille, ou hachures,
ou une valeur au survol avec équivalent texte.

### C10. Aucune trace de l'état de la borne

**Constaté.** « BORNES ACTIVES 1 sur 1 autorisée » avec un bouton « MàJ ».

**Le défaut.** « Active » ne dit pas **quand** elle a parlé pour la dernière
fois. Or la règle centrale de l'anticipateur est : « borne hors ligne depuis 48 h
avec des pointages en attente ». Cette information n'est pas à l'écran.

**Ce qu'il faut.** « Dernière synchronisation il y a 2 min » ou « hors ligne
depuis 6 h · 12 pointages en attente ». C'est le seul indicateur de santé
technique qui compte pour un dirigeant.

### C11. Aucune hiérarchie par rôle

**Constaté.** La page est la même pour un super-administrateur, un administrateur
d'entreprise, un gérant et — demain — un cabinet comptable ou un inspecteur.

**Le défaut.** Un accueil unique pour tous les rôles est un accueil mal adapté à
chacun. La feuille de route prévoit trois publics ; le dashboard n'en connaît
qu'un.

**Ce qu'il faut.** Trois accueils distincts : **dirigeant** (situation + à
traiter), **cabinet** (dossiers et échéances), **inspecteur** (lecture seule d'un
périmètre daté). Ce n'est pas un raffinement : c'est la conséquence directe de la
stratégie.

---

## 6. Ce que les captures ne montrent pas — et qui compte autant

Un produit professionnel se juge sur ses états dégradés. Aucun n'est visible ici.
Chacun doit être conçu, et chacun doit être montré avant d'être codé :

| État | Question à laquelle il doit répondre |
| --- | --- |
| Premier lancement | Que dois-je faire maintenant ? |
| Aucun employé | Comment démarrer en 2 minutes ? |
| Journée en cours, avant l'heure | Est-ce normal que ce soit vide ? |
| Borne hors ligne | Est-ce grave ? Que faire ? |
| Erreur de chargement | Est-ce cassé, ou lent ? |
| Hors connexion | Ce que je vois est-il à jour ? |
| Rôle restreint | Qu'est-ce que je n'ai pas le droit de voir, et pourquoi ? |
| Mobile / tablette | Qu'est-ce qui disparaît, et est-ce acceptable ? |
| Mode clair | La hiérarchie tient-elle ? |
| Données très nombreuses (500 employés) | La page tient-elle encore ? |

**Le dernier point est le plus négligé** : tout ce qui est montré ici a été
conçu pour 6 salariés et 4 entreprises. Un client à 300 salariés et 12 sites
cassera l'écran — et c'est précisément le client qui paie le plus.

---

## 7. Le socle qui manque : un dictionnaire de données

Tant que les mots n'ont pas une définition unique, aucun écran ne peut être
juste. Voilà ce qu'il faut écrire, une fois, et faire respecter partout.

| Terme | Définition | Base | Seuil | Source |
| --- | --- | --- | --- | --- |
| **Jour ouvré** | Jour travaillé selon la grille horaire de l'entreprise | — | — | Grille horaire |
| **Poste** | Créneau prévu pour un salarié un jour donné | — | — | Planning |
| **Pointé** | Au moins un geste **acquitté par le serveur** | Salariés avec poste | — | Pointages (hors file locale) |
| **Pas encore pointé** | Aucun geste, fin de poste non atteinte | Salariés avec poste | — | — |
| **En retard** | Entrée après l'heure prévue + tolérance | Salariés avec poste | Tolérance paramétrée | Pointages |
| **Absent non justifié** | Aucun geste **après** la fin du poste, aucune absence déclarée | Salariés avec poste | Fin de poste | Pointages + absences |
| **Absence justifiée** | Congé, maladie, motif déclaré et validé | Salariés avec poste | — | Absences |
| **Oubli de sortie** | Entrée sans sortie sur un poste terminé | Postes | Fin de poste | Pointages |
| **Non acquitté** | Geste enregistré localement, sans réponse du serveur | Gestes | — | File locale |
| **Taux de présence** | Pointés ÷ salariés **avec poste ce jour-là** | Salariés avec poste | — | Pointages |

Trois règles d'affichage qui en découlent :

1. **Aucun chiffre sans unité.**
2. **Aucun pourcentage sous 30 événements** dans la période.
3. **Aucun « aujourd'hui » comparé à des journées complètes** : à heure égale,
   ou rien.

---

## 8. L'architecture cible : trois zones, pas quinze cartes

Le dashboard doit répondre à trois questions, dans cet ordre, et dans cet ordre
seulement.

### Zone 1 — « Où j'en suis » (3 secondes)

Une phrase, pas un graphique :

> *Il est 10 h 46. **4 personnes sur 6** sont en poste. Habituellement, à cette
> heure, vous êtes à 5. Aucune anomalie détectée.*

Trois chiffres maximum, chacun avec sa base et sa période. Rien d'autre. Le
dirigeant doit pouvoir fermer l'onglet après ces trois secondes — et c'est très
bien ainsi.

### Zone 2 — « Ce que je dois traiter » (30 secondes)

Cinq lignes maximum, triées par conséquence, chacune avec **une action** :

> ⚠ 2 oublis de sortie à valider → *traiter*
> ⚠ 1 pointage non acquitté depuis hier → *voir la file*
> ⚠ Borne « Entrée principale » hors ligne depuis 6 h → *diagnostiquer*

S'il n'y a rien : **une seule ligne**. Pas d'encadré vide de 250 px.

### Zone 3 — « Ce que je peux prouver » (3 minutes)

Les graphiques, l'activité récente, les entreprises, les exports. C'est la zone
de lecture, celle qu'on consulte quand on cherche quelque chose — pas celle
qu'on regarde en arrivant.

**Le déplacement est le cœur de la refonte** : aujourd'hui, la zone 3 occupe tout
l'écran et les zones 1 et 2 sont dispersées. Il faut inverser le poids.

---

## 9. Ce que font les géants, et qu'on peut copier sans copier leur produit

Cinq principes communs aux produits d'entreprise qui tiennent dans le temps.
Aucun n'est une fonctionnalité : ce sont des règles de conception.

1. **Un écran, une question.** Un accueil répond à une seule question et ne
   cherche pas à tout montrer. Le reste est à un clic.
2. **Aucune métrique de vanité.** Pas de graphique qui monte pour faire plaisir.
   Chaque chiffre a une comparaison, une période et une conséquence.
3. **L'état vide est une action**, jamais une illustration. Un écran vide dit quoi
   faire ensuite, en un seul geste.
4. **La densité est maîtrisée, pas subie.** Beaucoup d'information, mais une
   hiérarchie nette : trois tailles de texte, deux niveaux de gris, une couleur
   d'accent.
5. **Le rôle change l'accueil.** Un dirigeant, un gestionnaire et un auditeur ne
   voient pas la même première page — et personne ne voit ce dont il n'a pas
   besoin.

**Ce qu'on ne copie pas** : leur esthétique. L'identité africaine du produit est
un atout réel, et elle est validée. On copie la **discipline**, pas les pixels.

---

## 10. Plan de correction, en quatre vagues

Chaque vague est livrable séparément, avec un résultat visible.

### Vague 1 — La vérité (1 semaine)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 1.1 | Supprimer « absent » avant la fin du poste | À 10 h, un salarié du soir n'est jamais « absent » |
| 1.2 | Supprimer les pourcentages sous 30 événements | Aucune variation en % sur une base < 30 |
| 1.3 | Supprimer la comparaison jour partiel / jour complet | À heure égale, ou pas de comparaison |
| 1.4 | Traiter 0/0 | « Aucun employé actif », jamais « 0 % » |
| 1.5 | Trois états de données : jamais / insuffisant / partiel | Aucun graphique vide sans explication |

**Sans cette vague, les trois suivantes ne servent à rien : on embellirait un
mensonge.**

### Vague 2 — L'organisation (2 semaines)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 2.1 | Trois zones : situation / à traiter / preuves | La zone 1 tient dans les 200 premiers pixels |
| 2.2 | Un fait = un emplacement | Aucun fait répété dans deux cartes |
| 2.3 | Actions en zone 2, contextuelles | Aucun doublon avec la navigation |
| 2.4 | Une seule recherche | Un seul champ, Ctrl+K |
| 2.5 | États vides en une ligne | Aucun état vide > 120 px |
| 2.6 | Hero compact dès la 2ᵉ visite | 60 px au lieu de 210 |

### Vague 3 — Le système (2 semaines)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 3.1 | La recherche ne recouvre plus rien | Aucun chevauchement à 1280, 1440, 1920 px |
| 3.2 | Sidebar repliée sans coulisse | Aucun fragment de texte visible |
| 3.3 | Notifications agrégées, plafonnées | 50 items → 3 groupes |
| 3.4 | Encodage corrigé | Aucun caractère de remplacement dans l'interface |
| 3.5 | Données de recette retirées, « Test IA » hors navigation | Aucune entrée de test visible côté client |
| 3.6 | Typographie ≥ 12 px | Aucun texte informatif sous 12 px |
| 3.7 | Contraste ≥ 4,5:1 sur tous les textes | Mesuré, pas estimé |
| 3.8 | État de la borne avec dernière synchronisation | « hors ligne depuis X » visible |

### Vague 4 — Les rôles (2 semaines)

| # | Correction | Critère d'acceptation |
| --- | --- | --- |
| 4.1 | Accueil dirigeant (3 zones) | — |
| 4.2 | Accueil cabinet (dossiers + échéances) | Aligné sur la feuille de route, lot 2 |
| 4.3 | Accueil inspecteur (lecture seule, périmètre daté) | Aligné sur la feuille de route, lot 3 |
| 4.4 | Navigation séparée « Mon entreprise » / « Outils En-Check » | Un client ne voit aucun outil interne |

**Total indicatif : 5 à 7 semaines** pour un développeur, hors décisions en
attente. Ce n'est pas un engagement (§0).

---

## 11. Ce que je ne recommande pas

| Tentation | Pourquoi non |
| --- | --- |
| **Ajouter des graphiques** | Il y en a déjà trop pour l'information disponible. Le problème est le bruit, pas le manque. |
| **Étendre les widgets personnalisables** | Un catalogue existe déjà (`dashboard-widget-catalog-grid`). Personnaliser un socle faux produit des écrans faux, choisis par le client. |
| **Refaire le motif ou la palette** | Validés. On ne redessine pas un motif approuvé. |
| **Un « score global »** | Un chiffre unique et opaque ne se défend ni devant un salarié, ni devant un comptable. |
| **Une page d'accueil différente par personne, dès maintenant** | La vague 4, pas avant. D'abord la vérité, ensuite la personnalisation. |
| **Attendre la refonte complète pour corriger l'encodage et les données de recette** | Ce sont des corrections d'heures, à faire tout de suite, indépendamment du reste. |

---

## 12. Les cinq tests qui diront si c'est réussi

| # | Test | Échec si |
| --- | --- | --- |
| T1 | Montrer l'écran 3 secondes à 5 dirigeants, puis demander « que se passe-t-il ? » | Plus d'un se trompe → la zone 1 est ratée |
| T2 | Ouvrir le produit un lundi à 8 h, compte neuf | On voit un graphique vide → la vague 1 est ratée |
| T3 | Compter les occurrences du même fait sur l'écran | Plus d'une → la vague 2 est ratée |
| T4 | Mesurer tous les textes informatifs | Un seul sous 12 px → la vague 3 est ratée |
| T5 | Charger avec 300 salariés et 12 sites | La page ne tient pas → la conception est à revoir avant la vente |

---

## 13. Registre

| Chantier | État | Preuve | Confirmation |
| --- | --- | --- | --- |
| Traçabilité des captures (retrouver la branche) | à faire | — | — |
| Vague 1 — vérité de la donnée | à faire | — | — |
| Vague 2 — organisation | à faire | — | — |
| Vague 3 — système | à faire | — | — |
| Vague 4 — rôles | à faire | — | — |
| Dictionnaire de données | à faire | — | — |

**Aucune ligne ne passera à « résolu et validé » sans réalisation constatée et
confirmation explicite du fondateur.** Une capture d'écran, un écran beau ou un
avis favorable ne constituent pas une preuve de réalisation.

---

## 14. En une phrase

**Ce dashboard montre qu'on a construit un produit ; il ne montre pas encore
qu'on a compris un métier.** La bonne nouvelle : rien de ce qui manque ne
demande de redessiner l'identité. Tout tient dans l'ordre des informations et
dans la vérité des chiffres — et c'est précisément ce qui sépare un produit
soigné d'un produit qu'on peut mettre en face des géants.
