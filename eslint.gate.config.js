/**
 * PORTE DE LINT — ce qui casse à l'exécution (2026-10-16)
 *
 * Le 16/10, après déploiement de la PR #6, la page Pointages partait en
 * « Uncaught ReferenceError: canEditPointages is not defined » : une carte enfant
 * lisait l'état d'un composant parent, et trois props jamais forwardées
 * (`statuerEstimation`, `estimationEnCours`) restaient des identifiants libres.
 * `npm test` ne rendait pas compte de la page, `vite build` ne voit pas un
 * identifiant libre (esbuild/rollup ne vérifient pas la portée), et la CI affichait
 * « Lint » dans le nom de son job sans exécuter le moindre step de lint — alors que
 * `npm run lint`, lui, voyait les cinq erreurs. Le détecteur existait : c'est son
 * exécution qui manquait.
 *
 * Cette porte n'est PAS `npm run lint` : le dépôt traîne environ 367 remarques
 * préexistantes (dont 126 variables jamais utilisées), et une porte rouge le premier
 * jour est une porte qu'on éteint. Elle ne garde que les règles décrivant un bug de
 * câblage ou de portée — celles qui, par construction, ne peuvent pas se plaindre
 * d'un code qui marche. Le style relève du lint ordinaire, à nettoyer à part, pas de
 * la porte de non-régression.
 *
 * Lancée par `.github/workflows/ci.yml` :
 *     npx eslint src --config eslint.gate.config.js
 */
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

const REGLES_QUI_CRASHENT = {
  // ── ce qui casse au runtime ─────────────────────────────────────────────
  'no-undef': 'error',                    // ← aurait pris les 5 identifiants libres du 16/10
  'react-hooks/rules-of-hooks': 'error',   // un useState dans une branche = état qui se décale

  // ── ce qui rend le code faux sans crier ─────────────────────────────────
  'no-const-assign': 'error',
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-obj-calls': 'error',
  'no-unreachable': 'error',
  'no-sparse-arrays': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-self-assign': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-cond-assign': 'error',
  // Pas de no-alert ici, contrairement à mon premier jet : il tombe sur 27 alert()
  // et confirm() DÉJÀ présents dans BadgeEmploye, Admins, Entreprises, Absences,
  // Tasks, Teams… C'est un choix d'interface, pas un plantage, et cette porte ne doit
  // contenir que des règles qui ne peuvent pas se plaindre d'un code qui marche.
  // À traiter comme du style, à part.
}

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: REGLES_QUI_CRASHENT,
  },
  // Dette préexistante, découverte au tout premier lancement de cette porte :
  // `src/services/pushNotificationService.js` déclare subscribe() DEUX FOIS — l.38
  // (avec try/catch et contrôle de permission) et l.101 (avec contrôle des clés) — la
  // seconde écrase silencieusement la première. Même famille de bug qu'un monkey-patch
  // SQL : une définition qui en remplace une autre sans que personne ne le voie.
  // Ce n'est pas le périmètre de cette PR et ce n'est pas à moi de choisir laquelle
  // garder, donc l'exception est nommée, datée, et signalée à l'arbitre dans le corps
  // de la PR. À LEVER dès que le doublon est supprimé (un seul bloc, aucune
  // dépendance à l'outillage : retirer ce bloc suffit).
  {
    files: ['src/services/pushNotificationService.js'],
    rules: { 'no-dupe-class-members': 'off' },
  },
]
