# Paie — envoi automatique au calcul et traitement des refus fiscaux

> Évolution ultérieure : un envoi manuel exceptionnel après confirmation est désormais possible. Voir [Envoi exceptionnel et aides pliables](PAIE-ENVOI-EXCEPTIONNEL-ET-AIDES-PLIABLES.md). Le présent rapport décrit la livraison initiale.

23 octobre 2026 — branche `arena/08e2f879-en-check`

## Demande
Ajouter un interrupteur permettant à l’employeur d’envoyer automatiquement à tous les salariés concernés leurs fiches après calcul. Corriger les exceptions non interceptées à l’envoi individuel et groupé.

## Cause du bug
`TaxationService.verifierAvantRemise` renvoie `undefined` en cas de succès et lève une erreur quand `impot_a_verifier` est actif. L’écran attendait à tort un objet `{ remissable, motif }` et appelait le contrôle hors du `try/catch`. Le refus produisait donc une exception non interceptée ; même le succès pouvait échouer lors de la lecture de `.remissable`.

Le contrat du vérificateur et son garde fiscal sont conservés. Seul son commentaire obsolète est corrigé. Le nouveau service de remise intercepte le refus en erreur métier lisible ; la page traite toutes les erreurs d’envoi.

## Fonctionnement livré
- Interrupteur « Envoyer automatiquement après le calcul », visible en Préparation et Fiches calculées, désactivé par défaut.
- Activation limitée à la session, à l’entreprise et à la période courantes. Réinitialisation à chaque changement d’entreprise/période ou rechargement. Pas de préférence globale persistante ni de tâche planifiée en arrière-plan.
- En mode actif, les boutons deviennent « Calculer et envoyer ». Les explications indiquent que le calcul déclenchera la publication, et qu’un nouveau calcul peut mettre à jour les fiches déjà envoyées.
- En mode inactif, calcul seul ; les actions d’envoi manuel restent disponibles.
- Publication = fiche visible dans l’espace salarié ; aucun transfert bancaire/Mobile Money.

## Contrôles et écritures
- Envoi individuel, groupé et automatique empruntent le même service.
- Tous les bulletins du lot sont contrôlés **avant** la moindre écriture : contrôle fiscal, salarié identifié, brut/net connus, devise/contexte présents, période cohérente et absence de doublons.
- L’automatisme exige aussi une base salariale valide pour chaque profil : « Générer quand même » ne permet pas d’envoyer automatiquement des profils incomplets.
- Un seul upsert groupé remplace la boucle d’envois partiels. La clé de conflit reste entreprise + salarié + début/fin de période. Un refus fiscal d’un bulletin empêche l’écriture du lot entier.
- Un renvoi explicite ou automatique remet les marqueurs de retrait à false/null pour que les fiches renvoyées soient visibles.
- Deux verrous synchrones empêchent les doubles clics concurrents de calcul/envoi ; le formulaire est désactivé pendant calcul/remise. Vérification du numéro de génération avant l’envoi automatique ; les résultats périmés ne sont pas publiés.
- L’envoi automatique reçoit les réglages persistés utilisés par le calcul et le résultat du chargement des cumuls, plutôt qu’une fermeture React datant d’avant leur chargement. Le snapshot inclut aussi les paramètres d’heures supplémentaires utilisés.
- Statut envoyé ajouté à l’interface après réponse positive de l’upsert uniquement. Erreur réseau/RLS : « Envoi non confirmé », avec invitation à vérifier l’historique avant reprise, car une perte de réponse réseau ne prouve pas l’absence d’écriture serveur.
- Audit de la publication conservé/étendu au lot et à son mode automatique ; son erreur éventuelle ne transforme pas un envoi réussi en faux échec.

## Blocage fiscal restant
Le bug JavaScript est corrigé, **pas la validation fiscale d’un pays**. Les indicateurs `impot_a_verifier` / `taux_a_verifier` et les taux/barèmes n’ont pas été modifiés. Une configuration encore à vérifier doit être contrôlée contre une référence fiable puis validée, et les fiches recalculées. L’interrupteur d’envoi n’est pas un mécanisme de certification ou de contournement fiscal.

## Vérifications
- 648 tests Vitest / 63 fichiers réussis, dont 11 nouveaux tests de remise et d’interface.
- Cas couverts : contrat réel void/throw, refus individuel, blocage intégral du lot, flag imbriqué, envoi groupé unique, devise absente, montant inconnu, doublons, profil invalide, lot vide, contexte périmé, erreurs/reprise, état accessible du switch et câblage des snapshots/verrous.
- ESLint gate : zéro erreur, un warning préexistant EnterpriseSelectorModal.
- Build Vite/PWA réussi ; avertissement de taille des bundles préexistant.
- Chromium avec vraie page FichesPaie, services de calcul et réponses Supabase simulés : calcul sans envoi par défaut ; refus fiscal individuel/groupé/automatique sans écriture ; deux fiches envoyées en une requête lorsque les données de test sont vérifiées ; snapshot enregistré XOF correct ; mode désactivé sans envoi ; envoi individuel accepté ; erreur RLS simulée affichée avec interface déverrouillée ; activation remise à zéro au changement de période ; double clic immédiat sur calcul = un seul lot envoyé. Zéro pageerror.
- Responsive : 320, 390, 768, 1440 px en clair et sombre, sans débordement global. Capture sombre inspectée.

## Limites
Aucune publication réelle, aucun SQL ni changement de production exécuté pour ces tests. La simulation navigateur ne valide pas les droits RLS d’une session de production ni la justesse fiscale des pays. Garder la page ouverte pendant calcul/envoi ; aucun traitement de fond garanti après fermeture du navigateur.

Dépendances inchangées : xlsx temporairement substitué pour l’installation locale puis manifests restaurés. Harnais navigateur et captures hors Git.
