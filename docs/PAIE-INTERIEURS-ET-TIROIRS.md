# Paie — intérieurs pédagogiques et tiroirs

Date : 23 octobre 2026
Branche : arena/77f93c11-en-check

## Demande et périmètre livré

- Corriger le contraste des titres des deux signataires et du cachet en thème clair, sans modifier le papier blanc et l’encre des signatures.
- Remplacer le long guide fiscal par trois cartes : cotisations, barème, règles. Exemples repliables et parcours simplifié brut → net.
- Résumer le pays, le libellé et la devise dans une carte ouvrant leur tiroir. Les gestionnaires existants de suggestion, réinitialisation et enregistrement sont conservés. Fermer le tiroir conserve les choix en cours dans la page, mais ne les enregistre pas.
- Représenter les tranches par des lignes ouvrables au clavier ; suppression séparée. Une borne supérieure égale à zéro n’est plus confondue avec une borne sans limite.
- Présenter les règles en français : abattement, méthode, seuil, charges nommées et règles complémentaires repliables. Ouvrir une carte donne accès au formulaire existant.
- Convertir les formulaires de cotisations, tranches et règles, les confirmations fiscales, ainsi que les cinq formulaires de primes/retenues/prêts en tiroirs avec aide et exemple quand applicable.
- Ajouter des introductions et exemples aux intérieurs Paramètres, Profils, Primes & retenues, Import et Fiches calculées ; harmoniser les cartes et champs. Les formulaires inline de profils et paramètres restent inline. La préparation, déjà refaite et validée dans la passe précédente, est conservée.
- Conserver les bandeaux bogolan, les médaillons, la police et les graphiques issus des données.

## Accessibilité et responsive

Le tiroir utilise un portail, un dialogue nommé, un fond inerte, le verrouillage du scroll, une boucle de focus, Échap et le retour du focus au déclencheur. Pendant une sauvegarde, le fieldset est désactivé et la fermeture par fond/Échap est bloquée. Les champs passent en une colonne sur petit écran et le tiroir occupe la largeur disponible. Un seul défilement principal remplace les anciennes hauteurs de modales imbriquées.

Les signataires utilisent des couleurs thématiques. La grille des réglages accepte les écrans plus étroits que 280 px de largeur utile.

## Vérifications exécutées

- Vitest : **617 tests, 60 fichiers, tous réussis**. Variables Supabase factices pour les imports de services, sans identifiants de production.
- Huit nouveaux tests : portail/fond inerte/scroll/focus restauré, état occupé, boucle clavier, payload de tranche, actions distinctes/borne zéro, libellés français, règles/confirmation, exemples des cinq intérieurs.
- ESLint gate : **0 erreur**, un warning préexistant dans EnterpriseSelectorModal.jsx.
- Build Vite/PWA : **réussi** ; avertissement de taille des bundles toujours présent.
- `git diff --check` : réussi.
- Chromium/Playwright, harnais de vrais composants avec données illustratives : **320, 390, 768 et 1440 px**, clair et sombre. Pas de débordement horizontal de la page ni des neuf tiroirs ; ouvertures/fermetures Échap vérifiées ; **zéro pageerror**. Captures mobile et desktop réalisées, capture claire mobile inspectée.
- Le harnais vérifie les nouveaux composants, pas l’intégralité des parcours métier authentifiés. Le tiroir pays intégré n’a pas fait l’objet d’un scénario navigateur de sauvegarde. Pas de test d’envoi de bulletin, d’import réel, d’upload de signature ni de sauvegarde fiscale sur la production.

## Données et dépendances

Aucun SQL exécuté, aucune écriture Supabase de production, aucune modification des formules fiscales, des taux ou des montants enregistrés. Les callbacks et payloads existants sont conservés.

Installation locale : substitution temporaire de xlsx pour contourner le CDN inaccessible ; package.json et package-lock.json restaurés à l’identique. Aucun changement de dépendance livré. Le navigateur et les captures de test restent hors des sources livrées.
