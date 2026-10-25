# Administration — raccordements après le redesign Dev 1

## Base préservée

La branche a intégré `main` au commit `8191849` (PR 130–136), sans réécriture du redesign. Aucun changement de CSS, d’assets, de structure des panneaux, de sceaux, de chargement initial ou de navigation. Le cauris existant utilise simplement son rouge déjà prévu pour un compte désactivé, au lieu d’un signal vert trompeur.

## Corrections fonctionnelles

- Les changements de mot de passe et d’état utilisent un instantané de **la fiche ouverte**, jamais la sélection indépendante du panneau. La protection du propre compte s’applique aussi au gestionnaire d’événement, pas uniquement au bouton.
- L’historique individuel est chargé pour le compte et l’onglet de la fiche. Les anciennes réponses sont ignorées après navigation.
- Après relecture serveur, la fiche et la sélection sont actualisées ; une fiche dont le compte n’est plus dans le résultat est fermée. Après changement d’état, la fiche et le registre affichent le même état.
- Fermeture et changement d’onglet bloqués pendant les deux opérations sensibles du formulaire parent. Fermeture/navigation effacent les secrets saisis.
- Le chargeur initial est conservé ; il ne démonte plus une fiche pendant une actualisation après intervention.
- L’état d’accès distingue désactivation, verrouillage et absence de liaison Auth. Le champ `locked_until` est chargé.
- Registre : lecture des liens `admin_entreprises` actifs, prise en compte dans les noms d’entreprises, le filtre et la couverture. Relation FK confirmée par métadonnées en production. L’entreprise principale reste incluse conformément au modèle historique.

Ces résumés ne remplacent pas une autorisation serveur. Le registre reste limité aux 1 000 comptes les plus récents ; ses indicateurs portent sur les données chargées, pas une statistique exhaustive. Les courbes représentent les associations actuelles et leurs dates disponibles, pas une reconstitution historique des droits retirés.

## Corrections serveur réellement appliquées le 25 octobre 2026

### 012 — fonction interne d’identité Auth

`encheck_assurer_identite(uuid,text)` était SECURITY DEFINER, exécutable par anon/authenticated sans contrôle d’appelant, et pouvait insérer dans `auth.identities` avec une adresse fournie par l’appelant.

Retrait des droits PUBLIC/anon/authenticated. Post-contrôle : anon=false, authenticated=false, propriétaire=true. Le seul appelant SQL repéré, `create_employee_auth_user`, est SECURITY DEFINER sous le même propriétaire et conserve cet accès interne. Aucun appel client direct trouvé dans ce dépôt ; les consommateurs de l’application tierce restent à vérifier.

### 013 — compte rendu de connexion

`admin_login_result(uuid,boolean,text)` acceptait des déclarations anonymes de succès/échec pour un identifiant arbitraire. Cela permettait de falsifier la dernière connexion et les compteurs de verrouillage.

La fonction requiert maintenant une identité Auth, un succès, un compte actif appartenant à cette identité, et une date de connexion issue de `auth.users.last_sign_in_at`. Les dates ne sont plus inventées à partir de l’heure de l’appel. Droits vérifiés : anon=false, authenticated=true. Elle ne modifie aucun autre compte.

Le client cesse de déclarer anonymement des échecs. **Le compteur du navigateur n’est qu’une aide locale ; la limitation serveur relève de Supabase Auth.** Cette livraison ne prouve pas la configuration des limites Auth, n’ajoute pas un dispositif anti-abus global et ne remplace pas une collecte serveur fiable des échecs. L’ancienne version du client ignore l’erreur de l’appel de suivi anonyme et conserve son compteur local ; le succès connecté reste compatible avec la signature existante.

Les migrations n’ont exécuté aucune action sur un compte réel : seuls définitions et privilèges ont changé. Aucun mot de passe, aucune fiche ni aucune identité réelle n’a été consulté/modifié pour tester. API : `version:null` ; rapprocher l’historique avant un déploiement CLI. Les corrections antérieures 008 et 011 ne sont pas rejouées.

## Validation

- 909 tests / 96 fichiers réussis, dont scénarios panneau A / fiche B, absence de sélection, propre compte protégé, historique ciblé, état actualisé, fermeture en attente et secrets effacés.
- Tests SQL PGlite des migrations 012/013 : installation répétable, refus anonymes, refus d’un autre compte, refus d’un compte inactif, refus des déclarations d’échec client, date réellement issue d’Auth, autres comptes inchangés.
- Build Vite/PWA réussi ; lint gate sans erreur (avertissement préexistant EnterpriseSelectorModal).
- Tests DOM et SQL sur fixtures, pas une recette avec des comptes réels ni une nouvelle vérification visuelle au navigateur.

## Ce qui reste avant activation générale

L’inventaire des fonctions publiques SECURITY DEFINER exécutables par anon passe de **102 à 100**. Ce n’est ni un décompte de failles ni une certification des fonctions restantes. Revue ciblée supplémentaire : `encheck_admin_definir_mot_de_passe`, `get_current_admin`, `encheck_est_super_admin` et `encheck_admin_courant`. Les anciens mécanismes de repli par e-mail et la cohérence avec MFA/état du compte justifient de poursuivre la migration contrôlée des identités ; aucune approbation globale n’a été enregistrée.

Les migrations générales Admin 001–010, les Edge et l’attribution des rôles personnalisés ne sont pas activées par ce correctif. Restent : audit des autres fonctions et canaux privilégiés, recette Auth/MFA/SMTP/sessions avec comptes dédiés autorisés, compatibilité Pointage, puis activation graduelle. Voir aussi [les rôles personnalisés](ADMIN-ROLES-PERSONNALISES.md).
