# Jours fériés — le modèle du Bénin

26 octobre 2026 — un modèle de jours fériés pour le Bénin, utilisable depuis
`/jours-feries`.

## La demande

« Ajoute le Bénin dans les modèle jour férié ». Le Bénin existait déjà comme
devise (`BEN: 'XOF'` dans `currencyService.js`) mais **pas** comme pays du
catalogue de jours fériés, et aucun modèle de fêtes n'existait nulle part :
chaque pays devait être saisi à la main, fête par fête, année par année.

Le résultat n'est pas une ligne de plus dans une liste : c'est un **modèle**
qu'on charge en un geste, avec un aperçu de ce qu'il va écrire.

## La règle du métier

Une date fériée fausse ne reste pas une couleur sur un calendrier. Elle
fabrique une absence, un retard ou une heure supplémentaire qui n'existent
pas. Le modèle applique donc trois principes :

1. **Il calcule ce qui se calcule** — Pâques, et par conséquent le lundi de
   Pâques, l'Ascension et la Pentecôte ; le deuxième vendredi de janvier.
2. **Il ne devine jamais ce qui s'observe** — Korité, Tabaski et Maouloud
   sont annoncées après observation de la lune. Elles sont **nommées**, avec
   leur note, et **jamais datées** par nous.
3. **Il ne redouble rien** — une fête récurrente au même jour et au même mois
   cover la fête du modèle ; rien n'est recréé.

## La source

Loi **90-019 du 1er août 1990**, modifiée par la loi **2024-32** pour la fête
des religions traditionnelles. Croisée avec officeholidays.com,
timeanddate.com, eda.admin.ch, Wikipédia FR et la PR nager/Nager.Date #1175.

### Ce que le modèle date — onze fêtes

| Date | Fête | Nature |
| --- | --- | --- |
| 1er janvier | Fête du Nouvel An | fixe, récurrente |
| 2e vendredi de janvier | Fête annuelle des religions traditionnelles | règle |
| veille (jeudi) | Veille de la fête des religions traditionnelles | règle |
| lundi après Pâques | Lundi de Pâques | mobile |
| 1er mai | Fête du Travail | fixe, récurrente |
| +39 jours après Pâques | Ascension | mobile |
| +50 jours après Pâques | Lundi de Pentecôte | mobile |
| 1er août | Fête Nationale | fixe, récurrente |
| 15 août | Assomption | fixe, récurrente |
| 1er novembre | Toussaint | fixe, récurrente |
| 25 décembre | Noël | fixe, récurrente |

Seules les fêtes **fixes** sont enregistrées comme récurrentes : les autres
sont calculées pour l'année demandée, parce que leur date change.

### Ce que le modèle refuse de dater

| Fête | Note |
| --- | --- |
| Korité | Fin du Ramadan |
| Tabaski | Fête du sacrifice |
| Maouloud | Anniversaire du Prophète |

Elles apparaissent dans l'aperçu sous « Ce que le modèle ne date pas », avec
l'explication à saisir à la main quand la date tombe.

### Ce qui n'est pas férié — et ne doit pas revenir

Le **26 octobre** (Forces Armées) et le **30 novembre** (Journée Nationale)
ont été abrogés par la loi 90-019, mais restent listés par plusieurs sites.
Ils ne sont pas dans le modèle. Pas plus que le dimanche de Pâques (seul le
lundi est férié) ni le 26 décembre.

## Les dates de référence

| Année | Pâques | Lundi de Pâques | Ascension | Pentecôte | 2e vendredi de janvier |
| --- | --- | --- | --- | --- | --- |
| 2025 | 20 avril | 21 avril | 29 mai | 9 juin | vendredi 10 |
| 2026 | 5 avril | 6 avril | 14 mai | 25 mai | vendredi 9 |
| 2027 | 28 mars | 29 mars | 6 mai | 17 mai | vendredi 8 |
| 2028 | 16 avril | 17 avril | 25 mai | 5 juin | — |

La veille des religions traditionnelles est le jeudi qui précède : le
**8 janvier 2026**, le 9 janvier 2025, le 7 janvier 2027.

## L'écran

`/jours-feries` gagne trois choses, toutes réservées au super administrateur
(seul habilité à publier une fête du pays) :

- **la puce du pays** apparaît même sans aucune fête publiée, avec la mention
  « modèle prêt » — c'est justement là qu'on vient le charger ;
- **« Charger le modèle Bénin »** ouvre un aperçu : les onze fêtes datées à
  créer, celles déjà présentes, et les lunaires non calculables ;
- **rien n'est écrit avant la confirmation.** Le bouton annonce le nombre
  exact (« Créer 11 fêtes »).

L'écriture passe par `HolidayService.createHoliday(null, …)` : le premier
argument est l'entreprise, et `null` signifie **fête du pays**. C'est le
chemin déjà utilisé par le formulaire de la page ; le modèle ne l'invente pas.

Un échec d'écriture n'arrête pas les autres : chaque fête est tentée, puis le
bilan est annoncé (« 10 fêtes du Bénin ajoutées », « 1 fête n'a pas pu être
créée »).

## Le dessin

Le bloc du modèle reste dans le textile du Lesotho (round 18) : chaque fête est
une ligne de tissu, avec un **fil de trame en terre cuite** à gauche, et les
badges de nature (« chaque année » / « cette année »). La fête fixe a un badge
tissé plein, les autres restent au trait.

Deux corrections de contraste ont été nécessaires :

| Texte | Sur | Avant | Après |
| --- | --- | --- | --- |
| `--jf-craie-faible` | `--jf-creux` clair | 4,16:1 | `--jf-craie-douce` |
| `--jf-craie-faible` | `--jf-panneau-2` clair | 4,39:1 | `--jf-craie-douce` |
| `--jf-terre` (9 px) | panneau sombre | 3,57:1 | `--jf-terre-clair` (4,92:1) |

Sous 720 px, la ligne se replie en deux rangs : la date et le badge d'abord,
le nom en dessous.

## Les tests

`src/services/__tests__/joursFeriesBenin.test.jsx` — 38 tests :

- Pâques sur 1990–2060 (toujours un dimanche, entre le 22 mars et le 25 avril)
  et sur sept années de référence ;
- le deuxième vendredi de janvier sur 2000–2060 (toujours un vendredi, entre
  le 8 et le 14) ;
- les onze fêtes de 2026, triées, et le décalage correct en 2027 ;
- l'absence du 26 octobre, du 30 novembre et du dimanche de Pâques ;
- les lunaires nommées sans date, pour sept années ;
- le dédoublonnage : récurrente reconnue, mauvais jour non reconnu, date
  exacte reconnue, deuxième chargement vide ;
- l'écran : puce du pays alors que le registre est vide, aperçu, rien avant
  confirmation, onze créations avec `enterprise_id = null`, succès et échec
  partiels, dédoublonnage réel, cas « tout est déjà là » ;
- les contrastes du nouveau bloc, recalculés depuis le CSS, dans les deux
  thèmes.

Les tests ont été vérifiés par mutation : premier vendredi au lieu du
deuxième, dates calculées rendues récurrentes, 26 octobre ajouté, Korité
datée de force, fête rattachée à une entreprise, dédoublonnage retiré,
création interrompue au premier échec, pays non proposé à vide — chacune
fait tomber au moins un test.

## Ce qui reste ouvert

Le catalogue des pays (`SUPPORTED_COUNTRIES`) ne connaît toujours pas le
Lesotho, alors que la page en porte le motif. Le modèle du Bénin, lui, ne
nomme plus un pays que le catalogue ignore : `BJ` y est entré avec son
drapeau.
