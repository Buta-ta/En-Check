# Chargement unifié de l’assistant

L’interface de dialogue porte uniquement le nom « Assistant En-Check ». Aucun
sélecteur ni nom de fournisseur n’est ajouté. Les obligations d’information sur
les prestataires dans les documents de confidentialité restent distinctes de
l’identité visuelle du dialogue.

Un indicateur animé et le texte « Je prépare votre réponse… » apparaissent sous
la demande pendant le traitement asynchrone existant : explication publique IA,
consultation RH et recherche En-Check. Le bouton d’envoi est désactivé pendant
l’attente. L’indicateur est retiré à la résolution, en cas d’erreur ou lors de
l’invalidation de la demande. Les réponses locales immédiates ne sont pas
ralenties artificiellement. Aucun nouveau branchement fournisseur dans ce lot.

Accessibilité : région status/polite/atomic, icône décorative, animation désactivée
si l’utilisateur préfère les mouvements réduits. Les erreurs restent affichées.
Design général et motifs africains inchangés.

Vérification : 265 tests Vitest / 30 fichiers réussis, lint ciblé sans erreur
(1 avertissement préexistant), compilation Vite/PWA et diff --check réussis.
Tests de rendu statique et d’intégration structurelle ; pas de vérification
visuelle dans un navigateur authentifié. Installation locale avec substitution
xlsx temporaire (CDN inaccessible) ; manifestes et lock restaurés, aucune
modification de dépendance livrée. Pas de SQL ni Edge à déployer.
