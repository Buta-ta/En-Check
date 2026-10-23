# Fiches calculées — envoi exceptionnel, toggle visible et aides pliables

23 octobre 2026 — branche `arena/04a01eaf-en-check`

## Demande et décision
À la demande de l’employeur, permettre de poursuivre un envoi malgré le seul avertissement « règles fiscales à vérifier », après un modal d’avertissement. Rendre le toggle actif lisible en clair/sombre et replier les explications.

Cette évolution remplace le refus fiscal sans exception de la PR106. Elle ne certifie pas les règles fiscales et ne modifie aucun taux, barème ou indicateur de vérification.

## Parcours
- Dans **Fiches calculées**, cliquer sur Envoyer (une fiche ou le lot). Si le contrôle fiscal refuse, le modal propose une confirmation exceptionnelle ; aucune écriture n’a encore eu lieu.
- Le modal présente le risque de montants incorrects, le nombre de fiches et la période. La liste des salariés et la portée de l’autorisation sont repliables.
- Le bouton de confirmation est désactivé tant que la case « Je comprends le risque et autorise exceptionnellement l’envoi de ce lot » n’est pas cochée.
- Annuler ou Échap ferme sans envoyer. Le focus initial est placé sur Annuler, le dialogue natif retient le focus, et le focus précédent est restauré à la fermeture.
- Un échec de l’envoi automatique conserve son blocage. Dans Fiches calculées, « Envoyer malgré l’avertissement… » ouvre le parcours manuel de confirmation. Aucune dérogation n’est transmise aux calculs/envois automatiques suivants.
- Changement d’onglet, de contexte de calcul, d’entreprise ou de période : confirmation abandonnée. Le numéro de génération est contrôlé avant l’écriture pour refuser une confirmation périmée.

## Garde-fous et traçabilité
- Erreur dédiée `PayrollTaxReviewRequired`, distincte des autres refus.
- Dérogation acceptée uniquement en manuel avec reconnaissance explicite et identifiant d’administrateur non vide.
- Montants, identité, devise, période, doublons et contexte restent contrôlés ; les droits RLS ne sont pas contournés. Prévalidation de tout le lot puis un seul upsert.
- Les indicateurs fiscaux de la configuration et des calculs restent inchangés. Pour chaque fiche fiscalement non vérifiée publiée exceptionnellement, les données JSON `details` conservent `impot_a_verifier: true` et `tax_delivery_override` avec identité de confirmation, horodatage et avertissement. Les snapshots existants sont conservés.
- Le journal d’envoi reçoit aussi `tax_override`. La trace principale est écrite avec la fiche elle-même, même si l’audit séparé échoue. Cette trace applicative n’est pas une signature inviolable ou une certification fiscale.
- Aucune autorisation globale/persistante. Un renvoi d’une fiche encore non vérifiée exige à nouveau confirmation.

## Lisibilité
- Toggle : piste dédiée, verte à l’état actif, curseur blanc, position différente OFF/ON et libellé explicite « Activé » / « Désactivé ». Le dessin ne dépend plus du fond générique des champs de formulaire.
- Contraste curseur blanc/piste active #166534 : environ 7,1:1. Anneau vert clair pour distinguer le contour en sombre, focus clavier visible.
- « En savoir plus » fermé par défaut contient les précisions sur session/période, recalcul et publication.
- L’avertissement fiscal garde un résumé visible, avec le détail repliable et le bouton d’action accessible.
- Le guide « Comprendre les fiches calculées et leur envoi » est également fermé par défaut. Les erreurs opérationnelles et le statut d’envoi restent visibles.

## Vérifications
- **656 tests / 63 fichiers réussis** : 8 nouveaux cas couvrent confirmation, absence de confirmation implicite, dérogation interdite en automatique, conservation des flags/snapshots, autres validations, RLS simulée, absence de mémorisation, aide fermée, dialogue et invalidation du contexte.
- Build Vite/PWA réussi. ESLint gate : zéro erreur, un warning préexistant dans EnterpriseSelectorModal. Diff sans erreur d’espacement.
- Chromium : composants réels, service réel et CSS globaux de la Paie, réponses Supabase simulées ; refus auto sans écriture ; ouverture manuelle ; confirmation désactivée sans reconnaissance ; Annuler via Échap sans écriture ; envoi de deux fiches en une requête avec trace ; auto toujours bloqué après cet envoi. Zéro pageerror.
- Clair et sombre, 320 / 390 / 768 / 1440 px : pas de débordement de page ni du modal, piste active/cursor contrôlés. Captures mobile inspectées. Le dialogue est centré et défilable sur petits écrans.

## Limites et absence d’effets de production
Aucune publication réelle, aucun SQL ni modification de données de production. Les essais navigateur portent sur un harnais des composants et du service, pas une session employeur authentifiée de bout en bout. Les dépendances du dépôt sont inchangées ; les outils, captures et harnais QA restent hors Git. Le contrôle d’accès repose sur les règles serveur existantes, sans nouvelle migration.
