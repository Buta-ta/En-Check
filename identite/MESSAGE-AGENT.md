# Le message à envoyer à un agent, avant chaque page

> Copie ce bloc en tête de chaque nouvelle conversation avec un agent de dev.
> Il répond, en trois lignes, avant d'écrire quoi que ce soit. Si sa réponse ne
> ressemble pas à ça, tu t'arrêtes là.

---

```
Tu travailles sur UNE page : <nom de la page> (route <route>).

Avant de commencer, tu réponds en trois lignes, et rien d'autre :
  1. les fichiers exacts que tu vas modifier
  2. ceux que tu ne toucheras pas
  3. ce que tu livres à la fin (et comment tu le prouves)

Tu lis d'abord : AGENTS.md, identite/CHARTE.md, la fiche de la page
(identite/pages/<page>.md), et les planches docs/planches/ (26 pour la barre,
25 pour une page de travail, 27 pour une modale, 28 pour le mécanisme).

Règles :
- Aucun autre écran n'est modifié. Pas de « pendant que j'y suis ».
- Pas de fondations, pas de thème, pas de barre latérale, pas de renommage :
  ces pièces sont faites (D-018, D-005, PR #231).
- Aucune couleur écrite à la main, aucun composant hors des 18 formes.
- Tu ne renommes pas les décisions et tu n'en inventes pas : une décision
  vient du fondateur, avec sa phrase.
- À la fin : `npm run charte`, deux captures 1440 px (clair et sombre), la fiche
  remplie, et le score.

Si quelque chose t'empêche de faire exactement ça, tu t'arrêtes et tu me le dis
avant de coder. Tu ne choisis pas à ma place.
```

---

## Pourquoi ce texte

Un agent livré à lui-même fait trois choses, toujours les mêmes : il **élargit**
le périmètre, il **choisit** l'ordre, il **écrit ses propres règles** pour
justifier ce qu'il a fait. Ce bloc ne l'en empêche pas techniquement ; il rend
l'écart **visible en trois lignes**, avant le code.

**Ce que ça attrape, concrètement :** le 18/11, un agent a annoncé « je commence
par la page Employés » (D-021, ton exception), puis a livré les fondations —
couleurs, polices, thème, barre latérale — et zéro ligne de la page Employés.
Le travail était bon ; c'est l'annonce qui était fausse. Avec ce bloc, la ligne
1 aurait dit `src/styles/tokens.css` et non `src/pages/Employes.jsx`, et tu
l'aurais vu avant la fusion, pas après.

## Les trois phrases à ne pas accepter

| Ce qu'il dit | Ce que ça veut dire | Ta réponse |
|---|---|---|
| « J'ai aussi amélioré… » | il a élargi le périmètre | « hors périmètre : retire-le » |
| « J'ai commencé par les fondations » | il a choisi l'ordre | « la fiche dit quelle page ; le socle est déjà fait » |
| « J'ai consigné cette règle en D-0xx » | il a décidé à ta place | « une décision vient de moi, avec ma phrase » |
