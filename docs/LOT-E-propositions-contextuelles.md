# Contrat LOT E — propositions contextuelles (équipe application de pointage)

Cette fiche décrit le contrat livré dans En-Check admin, pas une modification de l'application de pointage. L'utilisateur transmet la fiche à l'autre équipe.

## Lecture admin

`encheck_proposer_pointage(p_source uuid) → jsonb`

- Entrée réelle identifiée par son UUID ; administrateur autorisé dans son entreprise.
- `eligible: true` + `source_id` + `proposed_out` : proposition collective contrôlée, affichable mais NON payée.
- `eligible: false` : ne pas fabriquer `entrée + 8 h`. Afficher `reason`.
- `depart_probable` : badge de départ possible, entrée inconnue. Ne pas fabriquer une journée payée ni changer le type des badges.
- `planning`, `history_count`, `history_out`, `evidence` et `history_evidence` expliquent les contrôles disponibles.
- Une estimation déjà consignée, même rejetée, interdit une nouvelle proposition pour cette source.

La cohorte est nécessaire. Planning et historique jouent ici le rôle de contrôles de contradiction ; cette version ne produit pas une entrée présumée ni une estimation autonome à partir du seul historique. Absence de planning ou historique insuffisant n'est pas présentée comme une confirmation.

Périmètre : même entreprise, zones de pointage `geofence_id` identiques lorsqu'elles sont renseignées ; champs de site/équipe des employés et appartenances `team_members` datées lorsqu'ils existent. Un témoin incompatible bloque le groupe entier, sans sélectionner artificiellement les seuls témoins favorables. Les métadonnées de site des employés ne sont pas historisées par ce lot : ne pas prétendre reconstruire les mutations passées. Des champs absents ne permettent pas de prouver une équipe commune.

## Décision admin

`encheck_proposition_decider(p_source, p_decision, p_attendue, p_ajustement_minutes=0, p_motif=null)`

- `p_decision` : `valider` ou `rejeter`.
- `p_attendue` : instant ISO exact de la proposition affichée, pas l'heure arrondie à la minute.
- Ajustement : décalage entier en minutes. Motif obligatoire si le décalage n'est pas nul. Le serveur contrôle la durée minimale, le plafond et l'absence de futur.
- Relecture complète côté serveur. Si les indices changent, si un vrai badge arrive, ou si une estimation a été consignée entre-temps : `ok:false`, recharger avant une nouvelle décision.
- Écriture d'une sortie `method='auto_close'`, `is_auto_closed=true` avec source et preuves. Valider renseigne `estimation_validee_le` ; rejeter renseigne `estimation_remplacee_le` et `sortie_presumee_rejetee`.
- Journal et ligne d'estimation écrits dans la même transaction. Aucun badge réel supprimé ou réécrit.
- Verrou d'écriture bref sur `attendances` pendant la relecture/insertion, attente maximale 5 secondes. En cas de contention, afficher l'erreur et proposer de réessayer, jamais annoncer une réussite sans `ok:true`.
- RPCs non accordées à `anon`. Ne pas les appeler depuis un terminal public anonyme. Ne pas étendre leurs privilèges pour contourner le contrôle admin.

## Livraison et déploiement

Exécuter manuellement `20261017000008_propositions_contextuelles.sql` après 000007, puis déployer le frontend admin. Aucun SQL de test ne doit être exécuté en production.

Le raccordement automatique est limité à la page Pointages de l'admin et aux estimations virtuelles. Les décisions déjà consignées sont conservées. Le cron historique et les autres consommateurs ne sont pas remplacés par ce lot : leur adoption de ce contrat est un chantier distinct, à coordonner sans réintroduire les estimations dans la paie avant validation.

## Vérifications attendues

1. Sara : groupe concordant, sans contradiction → 15:32 environ au lieu du forfait ; temps réel inchangé, temps présumé séparé.
2. Planning à 17:00 contre cohorte à 15:32 → conflit, pas de nouvelle sortie forfaitaire.
3. Reine : 20:03:00 / 20:03:08 proches des départs → entrée inconnue, aucune durée payée ajoutée.
4. Écarter puis recharger → pas de recréation de l'estimation.
5. Valider puis ouvrir Modifier → marque de sortie présumée validée conservée.
6. Une sortie réelle ou un traitement concurrent rend l'ancienne proposition non validable.
7. Nuit : conserver les dates et instants complets, jamais comparer seulement HH:MM.
