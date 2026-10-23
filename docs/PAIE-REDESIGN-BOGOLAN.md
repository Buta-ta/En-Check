# Paie & Fiscalité — maquette validée et sécurisation

23 octobre 2026. Travail sur `arena/afa764c5-en-check` à partir de main `a62c6ab` et du travail IA Dev 1 PR #98 (`8f9a241`). La branche de Dev 1 n'a pas été modifiée. Pas de fusion de PR, pas de déploiement de production, pas d'écriture Supabase.

## Interface livrée

- Les deux bandeaux sont extraits **de l'image choisie par l'utilisateur**, pas régénérés : source 1536×1024, crop haut `(0,115,1536,191)`, bas `(0,946,1536,978)`. Assets WebP locaux, sans service externe.
- Trois sections : Bulletins / Fiscalité / Paramètres ; sous-navigation de la seule section active.
- Entreprise toujours visible, pays/devise, thème, raccourcis, période et historique.
- Préparation : indicateurs issus des employés/profils de l'entreprise, tableau recherchable et filtrable, accès au profil sélectionné, panneau de contrôles et vraie commande de calcul.
- Graphiques dynamiques : état des profils, sommes brut/net des bulletins effectivement calculés ; aucun montant avant calcul. Dans Fiscalité, barème issu de la configuration chargée.
- Le tableau n'affiche pas de faux agrégat de variables. Les variables restent dans leurs écrans métier existants ; la colonne du profil précise les bases horaires/journalières.
- Les chiffres de la maquette ne sont pas embarqués dans l'application.

## Corrections de l'audit

1. Génération et historique accessibles en mode intégré ; le bouton appelle le moteur existant, pas seulement un changement d'onglet. Validation des dates de période.
2. Imports de pays, copie interentreprises et remise à zéro : appel serveur transactionnel unique ; aucun fallback delete/insert côté navigateur. Sans RPC installée, refus explicite et aucune suppression.
3. Changement d'entreprise : sous-arbre React identifié par l'entreprise, réinitialisation des éditeurs, confirmation avant abandon des saisies, sélection désactivée pendant sauvegarde/calcul/envoi/import. Les réponses d'un ancien éditeur ne peuvent pas réécrire l'état du nouveau.
4. Règles fiscales : snapshot brut lu à l'ouverture, comparaison atomique en base ; les conflits demandent un rechargement. La RPC n'écrit pas les signatures/congés/devise.
5. Suppression de l'état fiscal dupliqué dans la coque : les KPI et le graphique fiscal utilisent directement les tableaux du volet éditeur. Le contexte pays/devise est relu après sauvegarde.
6. Droits par module indépendants, paramètres réservés au module bulletins, contrôle recalculé pour chaque entreprise. Les flags doivent être explicitement actifs pour un administrateur non-super ; pas d'autorisation implicite sur erreur/valeur absente. La sécurité serveur demeure assurée par les RLS.
7. Taux présentés comme nominaux, hors plafonds/forfaits ; distinction entre prélèvements salariaux et charges patronales. Respect du champ paid_by pour la somme des taux.
8. Les deux éditeurs restent montés pendant la navigation entre sections : brouillons, période et calculs conservés. Confirmation pour les raccourcis de sortie et retour dashboard ; avertissement navigateur au rechargement. Ce n'est pas une sauvegarde persistante de brouillon et le bouton historique du navigateur/les navigations extérieures à cette page ne disposent pas d'un bloqueur SPA global.
9. Erreurs de chargement principales explicites avec Réessayer ; les erreurs fiscales ne deviennent plus un repli silencieux sur des règles partielles. Les erreurs de lecture des employés empêchent l'ouverture de l'éditeur.
10. Calculs périmés invalidés après changement de période/profil/paramètres/primes/retenues ; une réponse de calcul tardive n'est pas affichée sur une nouvelle période. Le moteur relit les paramètres enregistrés au calcul.

## SQL indispensable AVANT validation de production

Fichier : `supabase/outils-sql/20261023_securiser_ecritures_fiscales.sql`.

**Non exécuté en production.** À faire valider puis copier-coller dans le SQL Editor Supabase par l'utilisateur, avant de fusionner la livraison frontend pour utiliser les écritures fiscales.

- BEGIN/COMMIT, fonctions CREATE OR REPLACE, préflight tables/colonnes/helper et doublons payroll_settings.
- Fonctions SECURITY INVOKER, privilèges d'exécution limités à authenticated, contrôle explicite `admin_has_access_to_enterprise`, RLS inchangées.
- Verrou de ligne entreprise et verrou des règles ; un échec annule l'ensemble de l'import.
- Compare-and-set sur le JSON brut des règles, erreur 40001 pour conflit.
- Aucun barème existant ni bulletin modifié par l'installation.
- Aucun changement de facturation, secret, compte ou fonction Edge.

Lecture seule Supabase effectuée : types/colonnes de payroll_settings, enterprise_payroll_contributions et enterprise_tax_brackets vérifiés ; helper réel vérifié (auth.uid(), administrateur actif et affectation active, ou super-admin). Les politiques RLS complètes et le scénario utilisateur authentifié n'ont pas été testés en production. Le script refuse une installation incomplète plutôt que contourner les permissions.

## Validations

- 596 tests Vitest / 58 fichiers réussis, avec URL et clé factices de test.
- Parmi eux, 6 tests DOM jsdom (navigation, brouillons, changement d'entreprise, matrice modules, erreur, interactions et graphiques), 5 tests PostgreSQL embarqué PGlite (idempotence, rollback après panne, succès atomique, conflit et refus d'accès).
- Le test SQL utilise un schéma de test jetable ; il ne constitue pas une exécution sur la base réelle.
- 55 tests Edge réussis.
- Porte de lint : zéro erreur, un avertissement préexistant EnterpriseSelectorModal.
- Build Vite/PWA réussi, avertissement de taille de bundles existant.
- Les anciens tests qui imposaient les trois groupes empilés et le rollback navigateur ont été remplacés par des tests de la nouvelle interface et du contrat transactionnel. Les tests utilitaires de graphiques et de thème restent en place.
- jsdom 26 (compatible Node 20 de la CI) et PGlite sont des dépendances de développement uniquement. La dépendance xlsx d'origine est conservée ; installation locale via substitution temporaire 0.18.5 à cause du CDN inaccessible.

## Limites à ne pas confondre avec une validation de production

Pas de contrôle visuel automatisé dans Chromium ni de session métier authentifiée ; rendu mobile/clair/sombre à valider dans la Preview. Pas de certification juridique des barèmes, pas de refonte du moteur d'heures, pas de correction automatique des pointages. Les prêts, signatures, exports et envois existants sont conservés, pas tous retestés de bout en bout.

La centralisation et la RPC protègent les chemins modifiés ; d'anciens clients déjà ouverts ou d'autres outils ayant encore des droits d'écriture directe ne sont pas retirés par ce lot. La suppression/copie de lignes reste intentionnelle après confirmation ; le SQL garantit son atomicité, pas une historisation complète des anciennes versions fiscales.
