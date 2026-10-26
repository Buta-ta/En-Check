# Jours fériés — le calendrier tissé (Lesotho)

26 octobre 2026 — refonte de `/jours-feries`.

## La décision

Après la planche des bandeaux culturels (l'existant et trois propositions —
Toghu, cauris, Faso Dan Fani), le motif retenu est **le textile du Lesotho**,
déjà porté par `/pauses`. Une identité peut couvrir plusieurs pages : c'est
déjà le cas d'Abomey (Admins, Mon compte) et du Bogolan (Paie, Fiches de paie,
Configuration fiscale).

## Ce que dit le motif

La couverture de laine : un champ de crème, deux lisières indigo tissées en
chevrons, un liseré de terre cuite, et des losanges brodés sur le champ.
Palette relevée sur `public/images/pauses-lesotho.webp` :

| Rôle | Valeur |
| --- | --- |
| Champ, panneaux | `#efe7d7`, `#f8efe0` |
| Lisière indigo | `#06182a` → `#152a3f` |
| Terre cuite | `#a45a44`, `#b4622a`, `#8b3e1d` |
| Gris-bleu tissé | `#3f5970` |

La page distingue les deux registres par la teinte du losange : **indigo pour
les fêtes du pays**, **terre cuite pour celles de l'entreprise**. Un losange
creux est une fête désactivée pour l'entreprise en cours.

## La page

- **L'année en lisière** — les douze mois, et sur chacun la position exacte des
  fêtes. Les récurrentes sont ramenées à l'année affichée ; une fête datée
  d'une autre année n'y figure pas. La prochaine fête est cerclée, et si elle
  tombe après l'année affichée, la phrase le dit sous le titre.
- **Quatre mesures** — fêtes du pays, fêtes de l'entreprise, désactivées,
  prochain jour férié (en jours).
- **Deux registres** — « Fêtes du pays » et « Fêtes de l'entreprise », avec
  leurs onglets, leurs comptes, et un filtre par pays en pastilles.
- **Ce qu'un jour férié change** — explication repliée par défaut : férié non
  travaillé, férié travaillé, désactivation.
- **Saisie** — les cases à cocher sont remplacées par deux options dessinées
  (`aria-pressed`) et un taux de majoration en pastilles.
- **Chargement** — un métier à tisser vectoriel : la navette passe, la trame
  monte, les losanges apparaissent. Aucune photographie, et un état fixe en
  `prefers-reduced-motion`.

## Ce qui ne change pas

- Les mêmes services (`HolidayService.getGlobalHolidays`, `getEnterpriseOverrides`,
  `toggleGlobalHoliday`, `createHoliday`, `updateHoliday`, `deleteHoliday`) et
  les mêmes tables (`public_holidays`, overrides par entreprise).
- La règle métier : **désactiver n'est pas supprimer**. Une entreprise coupe une
  fête du pays pour elle seule ; seule la suppression retire la ligne.
- Les droits : le registre du pays n'est modifiable que par le super
  administrateur ; le registre de l'entreprise s'édite par l'admin de
  l'entreprise.
- Aucune migration, aucun changement de calcul, aucune écriture de données
  pendant la refonte.

## La distinction avec Pauses

Les deux pages partagent le bandeau, pas la direction artistique. Pauses est un
espresso chaud, or et cuivre, avec des dégradés. Jours fériés est le côté
**indigo** de la couverture : champ crème, traits pâles, géométrie brodée.

## Vérifications

- **28 tests** (`src/services/__tests__/joursFeriesLesotho.test.jsx`) : route et
  bandeau, lisière de l'année (récurrence, hors-année, désactivation), chargement
  dessiné, absence de l'ancien décor violet, contrôles dessinés, raccourcis,
  explication repliée, contraste des trois niveaux de texte en clair et sombre,
  et **montage réel de la page** (coque, registres, bascule d'un interrupteur).
- Suite complète : **120 fichiers / 1 186 tests**.
- `eslint --config eslint.gate.config.js src` : 0 erreur (1 avertissement
  préexistant). `vite build` : OK.

## Écart repéré, laissé ouvert

Le catalogue `SUPPORTED_COUNTRIES` ne contient pas le **Bénin** (`BJ`) : la page
affiche donc proprement le code pays, sans inventer de drapeau, mais le
formulaire de création ne propose pas encore le Bénin. À trancher séparément —
ce n'est pas un défaut de cette refonte.
