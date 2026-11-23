# Clic dans le mois : le rideau de chargement, et ce qu'il cachait

Constat du 23/11/2026, et correctif en quatre temps. Cette fiche dit ce que le
fondateur a vu, ce qui a été **lu dans le dépôt** pour l'expliquer, ce qui a été
changé, et — important — ce qui ne l'est pas.

## Ce qui a été demandé

> quand je suis sur le mode vue « mois » et que je clique une case, ça doit
> recharger la page — pourquoi ça recharge pour un simple clic ? quelles autres
> actions rechargent la page ? pourquoi le clic n'ouvre-t-il pas simplement le
> modal ? et pourquoi un pointage collégé n'apparaît-il pas en temps réel dans le
> planning ?

Les quatre questions n'en font qu'une : **la page se démonte pour des gestes qui
ne demandent aucune donnée nouvelle**, et pendant qu'elle est démontée, elle ne
peut rien ouvrir ni rien recevoir.

## Ce qui a été vérifié dans le code (avant d'écrire quoi que ce soit)

| Fait lu | Où |
| --- | --- |
| le clic sur une case du mois posait le curseur : `setSelectedCalendarDay(cell)` + `setCalendarDate(...)` | `Planning.jsx`, `onClick` de la case (avant 5187) |
| un effet de reprise écoutait `calendarDate` et relançait `loadData` | effet refermé par `}, [selectedEntreprise, calendarDate])` (avant 882) |
| `loadData` demande **sept** ressources : `enterprises`, `work_schedules`, `employees`, `employee_schedules`, `schedule_change_requests`, `absences`, `attendances` | sept `.from(` dans `loadData` (665 → 872) ; la septième passe aujourd'hui par `chargerPointages` |
| la fenêtre demandée est le **mois entier** (union de la semaine et du mois) | bornes avant 698 dans la version d'alors, aujourd'hui `fenetreAffichee` (632) |
| `loadData` levait `loading`, et `loading` est un `return` anticipé : toute la page, modals compris, est remplacée par l'écran de chargement | garde `if (loading || !minLoadingDone) {` à `Planning.jsx:3350`, l'écran s'affiche à la ligne suivante |
| le plancher de l'écran de chargement, 4 500 ms, n'est armé qu'au montage | `useLoadingMinimum.js:18` |
| les briques du mois s'affichent depuis `moisParJour`, qui sait déjà nommer chaque rang (`emp`, `shift`, `minutes`, `teinte`, `etat`) | `Planning.jsx`, construction de `moisParJour` (avant 3384) |
| le planning ne s'abonnait à **rien** : le seul `setInterval` de la page fait avancer l'horloge | `Planning.jsx`, avant 2520 à l'époque |
| `useDirectPointages` existe, n'est branché que dans `Pointages.jsx:948`, et ne parle que de `attendances` + `encheck_pauses` | `src/utils/directPointages.js:10` |

Ce qui n'était **pas** vérifiable d'ici : le rendu. Aucun navigateur dans cet
environnement, donc « la case s'affiche bien ainsi » n'a pas été vu, seulement lu.

## Ce qui a été changé

**① Un clic ne déménage plus le curseur** (`Planning.jsx:5187`, `ouvrirLaCaseDuJour`
en 2940, fenêtre en 6615). Une case du mois n'est pas une case : c'est une
**journée**, avec un à N rangs. Devant un rang unique, le clic ouvre directement la
fenêtre de réglage de cette personne (`openCellEditorModal`) — ou le choisisseur de
modèles (`setCaseVide`) si la journée n'a aucun poste. Devant plusieurs rangs, le
clic ouvre « **Journée du 23 — qui, sur cette case ?** », deux listes : déjà placés,
aucun poste. Le clavier (Entrée, Espace) ouvre la même porte ; le **double-clic est
supprimé**, il faisait concurrence au simple et personne ne le voyait. La vue
journée reste accessible : le lien « Ouvrir la journée » dans la case au survol, et
le pied de la fenêtre du « qui ? ».

**② La reprise dépend de la période, plus du curseur** (`fenetreAffichee` 632,
effet 882). L'effet regarde une clé de bornes (`2026-11-01|2026-11-30`) : cliquer
le 24 alors que novembre est chargé ne relance **rien**, parce que rien n'a changé
de fenêtre. Passer à la semaine d'à côté change la clé et reprend, comme avant.
Et `loadData(adminData, { enFond })` (665) : le plein écran n'est plus que pour la
première feuille. Les cinq écritures de la page — enregistrer une case, créer,
modifier, supprimer un modèle, approuver, réintégrer — passent en second plan : la
grille reste en place, **le modal survit à son propre enregistrement**.

**③ Le planning en direct** (897, 910). Le crochet `useDirectPointages` est branché
avec `tables: ["attendances"]` (114) — une table, un canal ; `encheck_pauses` n'est
pas publié en temps réel et son canal faisait refuser le canal entier. Un message
du canal appelle `rafraichirPointages`, qui redemande **une** requête par la même
fonction que la grande reprise (`chargerPointages`, 652, colonnes en constante
`COLONNES_POINTAGES` 119 — une seule écriture de cette requête dans le fichier,
pour que le direct ne revienne jamais avec une colonne de moins). Le hook accepte
désormais la liste en paramètre, `TABLES_SUIVIES` par défaut : la page Pointages
n'a rien demandé et garde ses deux tables. Reprise d'office au retour sur l'onglet
et au retour du réseau — la cause n°1 des « il faut que je recharge ».

**④ Le bandeau dit la vérité** (2461, 3684-3691). Puisque la page ne se démonte
plus, rien ne se voit : le bandeau porte « reprise en cours » pendant la reprise,
et le libellé du canal (`direct` / `connexion…` / `figé`, par `presenterEtat`, le
même que la page Pointages). `aria-live="polite"`, `aria-busy`, et un trait qui
remue (`PlanningPostIt.css:459`) — le mouvement sur le conteneur, jamais sur le
texte.

## Contrats

`src/services/__tests__/cablagePlanningEnCheck.test.js` : contrat **41** (les
quatre points ci-dessus, vérifiés dans le source), compteur du contrat 30 porté de
4 à 5 styles en ligne (la brique du « qui ? » reporte `--brick-color`, une donnée
nommée, pas de la peinture), contrat 35 à 5 écritures de `setPlanningView(` (le
pied du choisisseur est un voyage, pas un second interrupteur). Le contrat 7 de `pointagesDirect.test.js` et le contrat
« timer dynamique des pauses réelles » de `cablagePauses.test.js`, qui écrivaient
`TABLES_SUIVIES.forEach(abonner)`, suivent le paramètre : ils verrouillent
maintenant `tables = TABLES_SUIVIES` **et** `tables.forEach(abonner)`, ce qui dit
la même chose qu'avant pour la page Pointages.

Suite complète : **2 141 passed** (2 140 avant, + le contrat 41), et les **7**
échecs de **collecte** préexistants, inchangés, qui ne viennent pas de ces
fichiers. Build ✓, `npm run charte` ✓ (aucun compteur aggravé ; les couleurs en
dur descendent de 4 551 à 4 550), eslint sur les trois fichiers touchés : 3
erreurs, toutes préexistantes (deux `set-state-in-effect` du hook déjà là sur
`HEAD`, une variable inutilisée dans un `catch`).

## Ce qui reste ouvert, à dessein

- **Le dépôt d'un modèle sur une case du mois n'est pas une écriture en base.**
  `handleDropOnCalendarDay` sans collaborateur en focus écrit uniquement dans
  `monthModels`, c'est-à-dire dans le `localStorage` du poste (clé
  `encheck_planning_month_models_v1`). Un modèle posé en vue mois est un
  **brouillon local** : il ne passe pas à un autre poste, et il disparaît avec le
  navigateur. Ce n'est pas le sujet des quatre étapes, mais ça explique qu'une
  case du mois mélange deux espèces de lignes, et ça se tranche : écrire en base,
  ou le dire en toutes lettres dans l'interface.
- **La reprise « en fond » n'est pas un cache** : les données affichées pendant la
  reprise sont celles d'avant, puis sont remplacées. C'est le contrat de la vue,
  pas une garantie d'instantanéité.
- **Rendu navigateur jamais vérifié d'ici**, pour les mêmes raisons que d'habitude.
- Le poste du fondateur consomme le **precache de la PWA** : après ce déploiement,
  fermer l'onglet et recharger (Ctrl+Maj+R), ou cliquer « Mettre à jour ».
