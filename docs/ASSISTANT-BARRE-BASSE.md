# Assistant En-Check — barre basse (lot interface)

## Périmètre
Validation de la maquette de barre basse à motifs africains. Le redesign de l'IA dev 3 est conservé : aucun changement des couleurs, widgets, cartes, menus ou mises en page métier. Seul l'ancien bouton flottant Spotlight est retiré du tableau de bord. La nouvelle barre est montée après la protection `AdminRoute` sur les routes administratives ; pas sur les écrans publics ou employés. `/search` reste disponible pour les fonctions détaillées et est désormais sous cette même protection.

## Livré
- Barre basse ivoire/brun/vert, frise géométrique CSS (aucune image distante).
- Panneau vers le haut via dialogue HTML natif ; fermeture, Échap, Ctrl/Cmd+K, retour du focus, zone de résultats défilante.
- Raccourcis vers pointages, planning et recherche détaillée. Ces raccourcis ouvrent les pages, sans appliquer de filtre implicite ni prétendre détecter une alerte.
- Recherche via le moteur Spotlight existant, sur soumission explicite uniquement ; aucun appel au chargement ou à chaque caractère.
- Contexte entreprise relu à l'ouverture. Aucune recherche sans entreprise. Les droits réels restent ceux de Supabase/RLS existants ; la barre n'introduit aucun nouveau droit ni contournement.
- Réponses de recherches périmées ignorées après modification de saisie, fermeture ou navigation. Aucun historique de conversation ou recherche ajouté au stockage navigateur.
- Surface sombre contenue pour les cartes Spotlight existantes ; styles du composant préfixés `ec-assistant-`.
- Espace réservé en bas, marges de zone sûre, barre remontée au-dessus de la zone de navigation mobile ; pas d'affichage à l'impression.

## Limites explicites
Ce lot n'est PAS l'assistant génératif métier complet. Il n'appelle ni Gemini, ni Gemma, ni la fonction de test IA. Aucun texte utilisateur/RH n'est transmis à un fournisseur externe. Le panneau annonce clairement la recherche guidée et le fait que conversation IA et anticipation ne sont pas encore connectées. Les règles/calculs et limites du moteur Spotlight restent inchangés ; cette livraison ne constitue pas leur nouvel audit.

À réaliser séparément : orchestration des modèles, garanties de traitement des données, véritable dialogue, signaux de risque, autorisations serveur des nouveaux outils et confirmations d'action. Aucune facturation activée.

## Vérifications
- `npm test` : 208 tests / 24 fichiers.
- `node --test tests/edge/*.mjs` : 22 tests.
- Lint gate : 0 erreur, 1 avertissement préexistant.
- Build Vite/PWA réussi (avertissement taille bundle).
- Trois interactions supplémentaires vérifiées localement sous JSDOM avec services simulés : ouverture/raccourci/fermeture/focus, absence d'entreprise sans appel, recherche exacte en un appel. Dialogue natif simulé : ne remplace pas les tests navigateur de focus et de clavier mobile.
- Pas d'essai navigateur authentifié ou de capture réelle desktop/mobile. À vérifier sur déploiement : superposition aux actions fixes de chaque page et clavier iOS/Android.
- Pour l'installation locale seulement, xlsx npm 0.18.5 a remplacé temporairement l'archive CDN inaccessible ; manifestes et lockfile restaurés, aucune modification des dépendances livrée.

Aucun SQL, secret ou redéploiement de fonction Edge nécessaire pour cette interface.
