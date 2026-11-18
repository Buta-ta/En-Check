# En-Check — Dérogations à la charte

Une dérogation n'est pas une préférence : c'est un écart **déclaré, daté, motivé**,
qui restreint l'application de la charte à un écran précis. Toute dérogation est
numérotée (D-0xx continue le registre), tracée ici, et redevable : à la première
rétro-ingénierie de l'écran concerné, l'écart disparaît.

Règles :
1. Une dérogation ne porte jamais sur une décision entérinée — elle porte sur un
   écran qui n'est pas encore à la charte (l'état du dépôt, pas la règle).
2. Une dérogation ne se renouvelle pas : date de fin = la rétro de l'écran.
3. Un code en dérogation porte un commentaire `// DÉR D-0xx : <objet> — lever à <date/événement>`.

## Dérogations actives

| N° | Écran | Écart vs charte | Raison | Depuis | Lever à |
|---|---|---|---|---|---|
| D-022 | `src/pages/Dashboard.jsx` (accueil) | Peau « éditoriale chaude » (canvas `#F5F2EB`, accent `#BF713B`, Inter) non conforme palette B / peau D ; dashboard non redeviné | D-019 : le dashboard est la prochaine page redevinée (après Employés, D-021) ; D-018 : la barre est déjà conforme | 18/11/2026 | Rétro du dashboard |
| D-023 | `Employee360.jsx` (modale fiche employée) | Bento kente « #228 » (or/terre), modale hors D-020 | D-019 : les modales sont redevinées en dernier ; la fiche employée est un écran livré le 17/11 | 18/11/2026 | Rétro des modales |
| D-024 | Motifs SVG/WebP culturels (bandes, bandeaux) | Couleurs hors palette B | D-007 : les pièces culturelles sont inchangées ; les motifs ne sont pas des surfaces de contenu | 18/11/2026 | Jamais tant que D-007 tient |
| D-025 | Anciennes pages non redevinées (Absences, Planning, Paie, Pointages, …) | Peaux pré-charthe (or/terre/crème) | D-019 : une page = une branche ; le dépôt ne passe pas conforme page par page | 18/11/2026 | Rétro page par page |

## Dérogations levées

| N° | Écran | Levée le | Remarques |
|---|---|---|---|
| — | — | — | — |

## Format d'une entrée

```
| D-0xx | route + fichier | l'écart, en une phrase, avec les valeurs | pourquoi, en une phrase | dd/mm/yyyy | l'événement qui la lève |
```
