# En-Check — règles pour les agents de développement

Ce dépôt est le produit **En-Check** (gestion du temps et de la paie). Son interface suit une charte arrêtée, décision par décision, par le fondateur. **Tu ne l'améliores pas : tu l'appliques.**

## Avant d'écrire une ligne

1. Ouvre ta **fiche de page** : `identite/pages/<page>.md` (modèle : `identite/fiche-page-TEMPLATE.md`). Si elle n'existe pas, arrête-toi et demande-la.
2. Lis `identite/CHARTE.md` — le rapport de référence — et les **planches** qu'elle t'indique (images PNG dans `identite/`). Une image vaut mieux que dix paragraphes.
3. Lis `identite/PROTOCOLE-IMPLEMENTATION.md` — le cycle en six temps, la notation, les trois portes.

## Les cinq règles non négociables

1. **Aucune couleur écrite à la main.** Uniquement les jetons de `src/styles/tokens.css`. Un `#hex` dans un composant est un refus de fusion.
2. **Aucun composant hors des dix-huit formes** (planche 24 / `CHARTE.md` §5). Pas de variante « juste pour cette page ».
3. **Aucun statut exprimé par la couleur seule.** Le mot (« en retard », « validée ») est obligatoire.
4. **Un seul bouton de poids maximal par écran.** Le rouge est réservé à ce qui détruit.
5. **Ne pas toucher à une décision entérinée.** `identite/DECISIONS-ENTERINEES.md` fait foi ; une décision ne se réinterprète pas dans un fichier CSS.

## Avant de proposer une fusion

```bash
npm run charte -- --strict     # doit sortir sans échec
```

Puis joins **deux captures** (clair et sombre, 1440 px) et remplis la section « Résultat » de ta fiche. Sans capture, la page n'est pas relue.

## Si la charte t'empêche de faire quelque chose

Tu **t'arrêtes sur ce point**, tu continues le reste, et tu écris une ligne dans `identite/DEROGATIONS.md` (page, contrôle, raison, proposition). Le fondateur répond par une décision numérotée. Tu ne contournes jamais en silence : pas de valeur « en attendant », pas de `// TODO charte`.

## Où sont les choses

| Chemin | Contenu |
|---|---|
| `identite/CHARTE.md` | la charte complète, opposable |
| `identite/DECISIONS-ENTERINEES.md` | le registre D-001 → D-020, avec les phrases du fondateur |
| `identite/PROTOCOLE-IMPLEMENTATION.md` | le mécanisme d'évaluation et de contrôle |
| `identite/fiche-page-TEMPLATE.md` | le contrat de page |
| `identite/conformite.md` | où en est chaque page |
| `scripts/charte-check.mjs` | le vérificateur (12 contrôles) |
| `src/styles/tokens.css` | la seule source de couleurs, d'espace et de rayons |
