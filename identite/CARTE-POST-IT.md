# En-Check — La carte-post-it et la méthode de vérification

> **Miroir dépôt** du document Drive « En-Check — La carte-post-it et le contrôle du rendu (v1.0) », https://docs.google.com/document/d/1xY6fa3E1XXdBhHgz7AlTk7xncb8DF44unIizcM07MUU — les deux se mettent à jour ensemble, sinon c’est le Drive qui fait foi (règle du registre).

Entériné le 21 novembre 2026 par le fondateur, après la fiche employé : « c'est exactement ce que j'aime. Apprends à noter ça dans le dossier identité car c'est ce qu'on va appliquer ailleurs. »

Ce document amende le kit d'interface v1.3 sur deux points assumés (et pas subrepticement) : §05 — la carte passe de rayon 8 à la forme post-it décrite ci-dessous ; §Fondations « mouvement, jamais au chargement » — l'accrochage des cartes à l'ouverture est autorisé, aux conditions de la section Mouvement.

---

## La carte = post-it (forme, partout)

Coin rayons 0. Contour d'encre 2 px (var(--charte-encre)). Ombre dure décalée de 3 px, sans flou (var(--charte-ombre-dure)) ; au survol l'ombre passe à 5 px et la carte se soulève de 2 px — l'objet se décolle, il ne fond pas.

Bande de colle : 14 px en tête, À L'INTÉRIEUR de la carte (jamais en onglet débordant), posée en couche background-image sur la règle générique des cartes. Les cartes teintées déclarent background-color, jamais le raccourci background: — le raccourci efface la bande. C'est un piège mesuré, pas théorique.

Pli bas-droit : 14 px (--e360-pli, égal à la respiration interne), obtenu par DEUX pseudo-éléments peints, jamais par clip-path (il rognerait l'ombre) ni filter: drop-shadow (flou, interdit). La découpe est un TRIANGLE à la couleur du fond de page (--charte-sable) qui déborde hors du contour de `--charte-trait + 3px` pour rogner l'ombre avec le papier — sinon il reste un ergot d'encre de 3×3 sous le coin. Le rabat est le triangle miroir, dos de la feuille plus clair, trait de pliure 44→50 %.

Règle de sûreté : le pli ne doit JAMAIS rogner de contenu. Se vérifie en simulant la géométrie des couches (0 pixel de contenu touché), pas « ça a l'air bon ».

Écarts : ≥ 20 px entre cartes ; tête → cartes ≈ 16 px d'air réel (la marge est de 40 px, la bande de bogolan de la tête déborde de 24 — calculer l'air VISIBLE, pas la marge écrite).

---

## Couleur, typographie, motifs

Tout passe par les jetons --charte-* ; aucun hexadécimal brut nulle part, commentaires inclus (audit C1 du dépôt, valeur figée : 4 664). Pas de couleur neuve sans décision.

Vert WhatsApp et couleurs de marque : CONTENU dans le trait (bord d'encre 2 px, coins carrés), jamais en bloc flottant hors palette. L'or --e360-or n'est jamais une action principale (double refus enregistré).

Une seule famille : IBM Plex Sans. Pas d'italique, pas de serif, pas de manuscrite. Étiquettes 11 px / 700 / capitales ; chiffres en tabulaire (mono réservé aux nombres).

Bogolan : bandes et ornements seulement. Derrière du texte, uniquement voilé de papier (linear-gradient de color-mix surface 80→88 %) — la trame se devine, les mots restent nets. Jamais de rayures en fond de page.

---

## La photo

La photo d'un employé n'est JAMAIS retouchée : aucun filter, aucun SVG, aucun effet CSS sur photo_url. Elle se montre EN ENTIER : ratio naturel, pas de cover ni d'aspect-ratio forcé qui coupent le crâne. Repli sans photo = initiales dans le cadre. La photo garde le sien ; on ne dessine pas dessus, on l'accueille.

---

## Mouvement

Accrochage à l'ouverture : fondu + 8 px, ease-out 340 ms, décalé de 50 ms par rangée (les notes s'épinglent une à une). Survol : translateY(-2px) + ombre 5 px. KPI : compteur de 0 à la valeur, 750 ms, ease-out cubique ; aux rechargements il repart de la valeur précédente, jamais de zéro (la note ne tangue pas).

Sous prefers-reduced-motion : tout est éteint (animations et transitions), les KPI s'affichent directement à leur valeur — et l'environnement de test (jsdom) tombe dans ce chemin : les tests voient la valeur finale immédiatement.

Flou : zéro. Partout. (Audit C9, valeur figée : 131 ombres floues légitimes d'ailleurs, aucune de plus.)

---

## Layout et coque

La coque admin est UNIQUE : rail SidebarUnique (thème, sélecteur d'entreprise, déconnexion) dans pointages-afrotech-shell → empv2-layout → nav3-colonne → empv2-main. Les sections du rail viennent d'UNE fabrique (components/coque/sectionsNavAdmin.js) lue par toutes les pages — aucune liste dupliquée, nulle part.

Panneau du rail en OVERLAY (absolute, gauche = rail + 74 px, haut/bas collés au rail sticky) : le déplier ne pousse JAMAIS la page, ne crée JAMAIS de scroll horizontal. Attention relevée : ne pas mettre de `right` — la largeur est conduite par --registre-largeur (l'animation par paliers du registre), un `right` l'écrase.

La page juge sa mise en page sur SA largeur, pas sur la fenêtre : @container sur le conteneur de page (1 colonne < 700, 2 par défaut, 3 ≥ 1 021, 4 ≥ 1 160 px de conteneur). PIÈGE MORTEL MESURÉ : si le conteneur est un enfant de flex-column avec margin: 0 auto, l'align-stretch transversal est désactivé et container-type: inline-size réduit son fit-content à zéro — la page s'effondre en colonne de min-content. Correctif obligatoire avec la containment : width: 100% sur l'élément-conteneur.

Blocs de chiffres : repeat(auto-fit, minmax(122px, 1fr)) — deux notes côte à côte seulement si la colonne les accueille.

---

## Méthode de vérification (ce qui a été aimé — à appliquer à chaque page)

1. Le contrat, c'est le CSS CONSTRUIT : relire les règles dans le dist final, pas dans la source. (Piège connu : une règle source peut être écrasée plus loin dans le fichier.)
2. Audits du dépôt inébranlables sans décision explicite : C1 (hex bruts), C9 (flous), C10 (rayons hors liste — écrire border-radius: 0 SANS unité pour ne pas faire bouger C10).
3. Tests complets au vert ; distinguer le bruit d'environnement (suites « .env Supabase » du bac à sable) en le reproduisant sur HEAD propre avant d'accuser son changement.
4. La géométrie (découpes, plis, débordements d'ombre) se vérifie en simulant les couches pixel par pixel — une mesure vaut un avis.
5. Pas de maquette générée par IA pour imiter l'UI : maquetter EN CODE VRAI (page statique servant les tokens et les feuilles réelles, rendue par le serveur de dev). Une image « qui ressemble » n'engage rien ; le code, si.
6. Le layout, lui, n'a qu'un juge : le rendu réel. Demander la capture avec la largeur de fenêtre, corriger en chaîne complète (la faute de la fiche du 08/11 — effondrement par containment — était invisible aux étapes 1 à 5).
7. Pousser/fusionner uniquement sur feu vert explicite du fondateur. Exception : la production cassée par sa propre livraison se répare dans l'heure, PR immédiate + analyse de cause publiée sans fard avec le correctif.
8. Un composant partagé qui change d'usage s'EXTRAIT (fabrique, coque), ne se copie pas. Le test de contrat suit l'extraction et vérifie que chaque page reprend bien la coque.

---

## Valeurs de référence

--e360-pli : 14 px · débord de découpe : --charte-trait + 3 px · ombre 3 px (survol 5 px) · bande de colle 14 px · air tête→cartes ≈ 16 px visibles · KPI 750 ms · seuils conteneur 700 / 1 021 / 1 160 · stats min 122 px. Audits au 08/11/2026 : C1 4 664 · C9 131 · C10 362.

## État d’application

Le **mode mois du Planning** est passé par cette carte le 23/11/2026 : une seule grille de sept
colonnes égales (`repeat(7, minmax(0, 1fr))` + `min-width: 760px` dans le rail qui défile), un rang
par personne — nom lisible, heures en chiffres tabulaires, état écrit en mot sur un lavis de 18 % —,
la teinte du jour en bande de 6 px seulement quand le jour a un auteur unique, et une porte nommée
(« Ouvrir la journée ») plutôt qu'un double-clic à deviner. Ce que la carte exigeait et que le mois ne
faisait pas : que ce qui est annoncé et ce qui est peint sortent du même calcul.

Appliqué : **fiche employé** (cartes post-it, citation voilée, tête centrée, coque, responsive conteneur) — validé en production. Et depuis le 21/11/2026, **modale « fiche employé »** : `src/components/FicheEmployeModal.css`, portée `.fiche-v2--postit` — la feuille porte le double feutre, la bande de colle et le rabat ; le bandeau de motif du sommet et le filigrane sont tombés ; l’action principale est en espresso, plus en or. Le périmètre de la portée est strict : « Modifier le pointage », qui partage les classes `fiche-v2-*`, garde sa peau, intacte. A étendre, page par page avec validation du fondateur : annuaire, pointages, paie — mêmes règles, pas d'exception locale sans décision écrite dans ce dossier.
