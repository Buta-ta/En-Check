# En-Check — Dérogations à la charte

Une dérogation n'est pas une préférence : c'est un écart **déclaré, daté, motivé**,
qui restreint l'application de la charte à un écran précis. Elle est numérotée
**DÉR-01, DÉR-02…**, tracée ici, et redevable : à la première rétro de l'écran
concerné, l'écart disparaît.

> **Correction du 18/11 (règle proposée, en attente ta phrase).** Les quatre
> dérogations avaient pris des numéros `D-022` à `D-025`, comme des décisions.
> C'est une faute de tenue : le prochain vrai choix serait devenu « D-026 » alors
> qu'il n'y a eu que 21 décisions, et une dérogation se serait glissée dans la
> série opposable. Un numéro `D-0xx` est réservé à ce que **tu** décides ; une
> dérogation est un constat daté, pas une décision.

Règles :
1. Une dérogation ne porte jamais sur une décision entérinée — elle porte sur un
   écran qui n'est pas encore à la charte (l'état du dépôt, pas la règle).
2. Une dérogation ne se renouvelle pas : date de fin = la rétro de l'écran.
3. Un code en dérogation porte un commentaire `// DÉR DÉR-0x : <objet> — lever à <date/événement>`.

## Dérogations actives

| N° | Ancien n° | Écran | Écart vs charte | Raison | Depuis | Lever à |
|---|---|---|---|---|---|---|---|
| DÉR-01 | D-022 | `src/pages/Dashboard.jsx` (accueil) | Peau « éditoriale chaude » (canvas `#F5F2EB`, accent `#BF713B`, Inter) non conforme palette B / peau D ; dashboard non redeviné | D-019 + D-021 : le dashboard vient après Employés ; D-018 : la barre est déjà conforme | 18/11/2026 | Rétro du dashboard |
| DÉR-02 | D-023 | `Employee360.jsx` (modale fiche employée) | Bento kente « #228 » (or/terre), modale hors D-020 | D-019 : les modales sont redevinées en dernier ; la fiche employée est un écran livré le 17/11 | 18/11/2026 | Rétro des modales |
| DÉR-03 | D-024 | Motifs SVG/WebP culturels (bandes, bandeaux) | Couleurs hors palette B | D-007 : les pièces culturelles sont inchangées ; les motifs ne sont pas des surfaces de contenu | 18/11/2026 | Jamais tant que D-007 tient |
| DÉR-04 | D-025 | Anciennes pages non redevinées (Absences, Planning, Paie, Pointages, …) | Peaux pré-charthe (or/terre/crème) | D-019 : une page = une branche ; le dépôt ne passe pas conforme page par page | 18/11/2026 | Rétro page par page |

## Dérogations levées

| N° | Ancien n° | Écran | Levée le | Remarques |
|---|---|---|---|---|
| — | — | — | — | — |

## Format d'une entrée

```
| DÉR-0x | (ancien D-0xx) | route + fichier | l'écart, en une phrase, avec les valeurs | pourquoi, en une phrase | dd/mm/yyyy | l'événement qui la lève |
```
