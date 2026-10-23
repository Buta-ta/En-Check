# Paie — aides lisibles, profils, ajustements et masse salariale

23 octobre 2026 — branche `arena/a3f742bd-en-check`

## Changements

### Aides « ? »
Le composant partagé des aides fiscales n’est plus une infobulle au survol. Un vrai bouton ouvre une explication inline, sur fond opaque, avec exemple, `aria-expanded`, contrôle clavier et fermeture Échap. L’aide reste dans le flux : elle ne recouvre pas les champs et ne sort pas des cartes. Couleurs explicites clair/sombre. Les explications du quotient familial précisent les limites configurées plutôt que de promettre une baisse systématique d’impôt.

### Profils
Nouvelle composition à deux colonnes sur grand écran, empilée sur mobile ; modes mensuel/horaire/journalier sélectionnables avec état accessible ; boutons de copie/enregistrement, guide du profil, explications du paiement. Le type de contrat n’est plus assimilé à un mode de rémunération.

**Correction de libellé sans changement de formule :** `min_guaranteed_hours` représente des heures ; l’ancien champ affichait une devise. Le libellé devient « Minimum garanti (heures) », avec l’exemple heures × taux.

La liste, le compteur et le pourcentage des profils utilisent les salariés actifs chargés pour l’entreprise, plutôt que tous les profils y compris ceux d’anciens salariés. Un profil enregistré n’est pas présenté comme la garantie d’un bulletin validé.

### Primes et retenues
Deux panneaux distincts, explications en français simple et boutons harmonisés. Une prime imposable ne garantit pas une hausse identique du net. Les retenues invitent à éviter les doubles déductions. Les règles récurrentes restent gérées depuis les profils. Les totaux de variables convertissent explicitement les montants en nombres, pour éviter la concaténation des décimaux retournés sous forme de texte.

### Fiches calculées
Parcours « contrôler → télécharger → publier », distinction entre brut, net et coût employeur, mention explicite qu’envoyer une fiche ne transfère pas d’argent. Cartes harmonisées, net à verser identifié. Les totaux monétaires affichent un tiret avant tout calcul, et non un faux zéro.

### Graphiques
- Brut/net : somme des valeurs `grossSalary` et `netSalary` des bulletins calculés pour la période sélectionnée. Explication et exemple repliables. Longueur proportionnelle au montant, plus grande barre à 100 % : ce n’est pas un taux fiscal. Zéro bulletin avant calcul signifie résultat indisponible.
- Accueil Préparation : graphique de masse salariale sur six mois se terminant au mois de fin de période sélectionné. Données issues de `employee_payslips`, entreprise et devise explicitement filtrées, bulletins retirés exclus, pagination par 500. Aucune requête sans entreprise/devise.
- Vue brut ou brut + cotisations patronales enregistrées. Mois de rattachement = mois de début de période du bulletin, sans proratisation. Des périodes atypiques peuvent donc se regrouper dans un seul mois.
- Mois sans bulletin = inconnu, pas zéro. Erreur réseau ou montant incomplet = message d’erreur et reprise, pas de total inventé. Les réponses périmées sont ignorées et les requêtes abandonnées au démontage/changement de contexte.
- Les devises XOF/XAF ne sont jamais mélangées. Les anciens bulletins sans devise ne sont pas inclus.

## Vérifications

- 626 tests Vitest / 61 fichiers réussis (8 nouveaux tests : mois, agrégation, devise/retraits, données invalides, zéro réel, aides, pagination, erreur/reprise, prérequis répartis sur ces cas).
- ESLint gate : zéro erreur, un warning préexistant `EnterpriseSelectorModal.jsx`.
- Build Vite/PWA réussi ; avertissement de taille des bundles préexistant.
- Chromium/Playwright sur la vraie page FichesPaie avec services et données simulés : Préparation, Profils, Primes & retenues, Fiches vides, en clair/sombre à 320/390/768/1440 px. Aucun débordement horizontal ni pageerror.
- Fiches remplies après calcul simulé : testées aux quatre largeurs (sombre). Pas de publication réelle.
- Contraste des aides mesuré : 13,71:1 en clair et 14,28:1 en sombre. Capture profil mobile, accueil desktop et fiche remplie sombre mobile inspectées.
- Population de profils vérifiée avec un profil inactif en données de test : un seul profil actif sur un salarié affiché.

## Limites et sécurité

Pas de SQL ni d’écriture en production. Le graphique utilise le client administrateur existant et les permissions/RLS existantes ; aucun droit supplémentaire ajouté. Aucune formule fiscale modifiée. Les tests navigateur utilisent des réponses simulées, pas une session utilisateur réelle ; ils ne constituent pas une validation de l’historique de production.

Installation locale avec xlsx temporairement substitué à cause du CDN inaccessible ; manifests restaurés. Aucun changement de dépendance livré. Captures et navigateur hors Git.
