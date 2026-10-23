# Rapport IA DEV 3 — test d'accès au dépôt En-Check

**Date :** 23 octobre 2026
**Dépôt :** `Buta-ta/En-Check` (application web / PWA « En-Check Admin »)
**Branche :** `arena/54421529-en-check`
**Nature de la modification :** documentation uniquement — **aucune ligne de code applicatif touchée**.

---

## 1. Pourquoi ce fichier existe

Ce fichier est une **preuve de vie**, pas une fonctionnalité.

Objectif : vérifier, de bout en bout, que je peux :

1. lire le projet (code, tests, CI, documentation) ;
2. créer une modification sur ma propre branche ;
3. pousser cette branche sur GitHub ;
4. ouvrir une **pull request** que tu merges toi-même ;
5. déclencher ainsi le redéploiement automatique sur Vercel.

Autrement dit : le tuyau « IA → GitHub → PR → merge → Vercel » fonctionne.
Comme c'est un fichier `.md` (du texte), il ne peut rien casser : ni le build, ni les tests, ni l'application en production.

---

## 2. Ce que j'ai regardé dans le projet (pour situer mon périmètre)

| Élément | Contenu constaté |
|---|---|
| Stack | React 19 + Vite 7, PWA (`vite-plugin-pwa`), Supabase, React Router |
| Entrée | `index.html` → `src/main.jsx` → `src/App.jsx` |
| Dossiers principaux | `src/pages`, `src/components`, `src/services`, `src/utils`, `src/hooks`, `src/contexts` |
| Tests | `tests/` + `node --test tests/edge/*.mjs` |
| CI | `.github/workflows/ci.yml` — tests financiers, porte de lint (`eslint.gate.config.js`), build Vite |
| SQL | dossier `sql/` (migrations à exécuter à la main dans Supabase) + `supabase/` |
| Documentation | dossier `docs/` (assistants, pauses, pharmacie…) + `ANALYSE-IA2/` |

**Point important pour la suite :** je travaille sur **`Buta-ta/En-Check`** (le web / PWA).
Le dépôt **`Buta-ta/En-Check-App-Pointage`** (l'application de pointage, autre PWA) est un **autre projet** suivi par une autre IA : je n'y touche pas.

---

## 3. Où je dépose mes rapports (Google Drive)

Dossier partagé : **« Dev Encheck admin + pointage »**
→ sous-dossier qui m'est réservé : **`IA DEV 3`**
Lien : https://drive.google.com/drive/folders/1zdQrjNt2GdTefWIhxKX37x762oIbURC_

Organisation retenue :

```
Dev Encheck admin + pointage/
├── IA DEV 1/      (autre IA)
├── IA DEV 2/      (autre IA)
├── IA DEV 3/      ← mes rapports, mes scripts SQL, mes diagnostics
└── IA ARBITRE/    (décisions d'arbitrage)
```

Chaque rapport Drive portera la date dans son nom, par exemple :
`2026-10-23 — Rapport IA DEV 3 — Test d'accès (PR n° XX)`.

---

## 4. Règles que je m'engage à respecter

1. **Une PR = un sujet.** Petite, relisible, avec un titre en français qui dit ce qui change.
2. **Je ne merge jamais.** Je pousse la branche, j'ouvre la PR, je te donne le lien, **c'est toi qui merges**.
3. **Je ne touche pas à `main` en direct**, et je ne force-push jamais.
4. **SQL :** je ne peux pas exécuter de code dans ton projet Supabase. Je le dépose donc en fichier `.sql` dans `sql/` (ou dans mon dossier Drive), tu le copies-colles dans l'éditeur SQL de Supabase. Chaque script sera **idempotent** (`IF NOT EXISTS`, etc.) et commenté ligne par ligne, avec un `SELECT` de contrôle à la fin.
5. **Explications simples :** chaque compte rendu sera écrit pour un débutant, avec des exemples concrets (avant/après, « imagine que… ») — sans image.
6. **Pas de fichiers lourds** (builds, `node_modules`, exports) dans le dépôt.

---

## 5. Ce que cette PR contient exactement

- Ajout de ce seul fichier : `docs/RAPPORT-IA-DEV-3-ACCES.md`
- Zéro modification de `src/`, `tests/`, `supabase/`, `sql/`, `package.json` ou `vercel.json`.

Le merge de cette PR ne change donc **rien** pour l'application : le redéploiement Vercel se fera, mais l'utilisateur ne verra aucune différence à l'écran.

---

## 6. Prochaine étape proposée

En attente de ta demande de travail (fonctionnalité, correctif, ou analyse).
Dès que tu me donnes un sujet, je livre : **1 analyse courte → 1 PR → 1 rapport Drive**, dans cet ordre.
