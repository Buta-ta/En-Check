# Assistant — premier lot de réponses RH quotidiennes

## Périmètre choisi par l'utilisateur
Réponses RH quotidiennes, avant dialogue génératif libre et anticipation des risques. Interface basse, motifs et redesign existants conservés. Lecture seule : aucune validation, correction, suppression ou écriture RH. Aucun appel Gemma/Gemini ni transmission de données RH à un fournisseur.

## Demandes prises en charge
- « Combien de pointages aujourd'hui » / « Pointages hier » : total exact des lignes accessibles pour la période, 20 lignes affichées maximum. Pas un effectif présent, pas une durée payée. Dates calendaires locales, pas reconstitution du jour travaillé des nuits.
- « Qui est en retard cette semaine » : même RPC `encheck_retards_plage`, même présentation `construireRetards` et filtre de jours fériés non travaillés que l'écran Retards. Pas de recalcul JS de planning. Lecture plafonnée à 501 lignes du moteur, 500 analysées, 20 retards affichés ; si 501 atteintes, échantillon explicitement signalé. Toute limite plus basse imposée par le serveur limite aussi les données consultées : aucun total RH exhaustif garanti pour ce mode.
- « Sorties présumées à confirmer hier » : lignes out / is_auto_closed=true sans estimation_validee_le ni estimation_remplacee_le. **Uniquement les estimations persistées** : les propositions virtuelles de Pointages sont explicitement exclues. Zéro ne signifie jamais « tout est confirmé ».

Sans période : question de clarification + choix aujourd'hui, hier, cette semaine. Cette semaine = lundi → aujourd'hui, pas jours futurs. Date explicite AAAA-MM-JJ non future acceptée. Réponse « hier » ou « et hier » possible si une intention RH est en mémoire pour la même entreprise. Mémoire effacée à la fermeture, navigation et lecture d'un badge ; aucune persistance de conversation.

Un nom, une période ou un filtre non pris en charge dans une question RH provoque une clarification : pas de suppression silencieuse de ce critère. Les recherches non RH continuent par le moteur Spotlight existant.

## Autorisation et sources
Session vérifiée par `auth.getUser`, puis contrôle serveur `encheck_est_admin_de(p_enterprise)` avant lecture. Pas de service_role, pas de nouveau droit. Fuseau et nom d'entreprise lus sur `enterprises` côté serveur. Fuseau absent/invalide : refus de calcul plutôt que supposition. Requêtes toujours limitées à l'entreprise choisie, avec session utilisateur/RLS existants. La fonction retards possède aussi sa propre vérification serveur. Le nouvel affichage rejette des lignes retards d'une autre entreprise.

Sources, entreprise, dates et fuseau sont affichés avec l'heure de demande de lecture. Les boutons ouvrent les pages métier, **sans prétendre appliquer leurs filtres** (mention visible). Les erreurs ne deviennent pas des résultats zéro, et aucune erreur brute n'est affichée.

Les RPC et colonnes viennent des migrations déjà existantes (000001, 000003 et suivantes). Aucune nouvelle migration ou fonction Edge. Si ces sources ne sont pas installées/accessibles sur le projet, le panneau refuse la réponse et propose la page métier : vérifier le déploiement réel avant usage.

## Fériés stricts
Option additive `strict` dans HolidayService : le nouvel assistant évite le cache et propage les erreurs, contrairement au mode historique qui conserve son comportement. Correction du parcours des années pour inclure janvier dans une semaine décembre/janvier. Tests dédiés ; aucun nouveau calcul de retard.

## Vérifications locales
230 tests Vitest / 27 fichiers ; 22 tests Node IA ; lint gate 0 erreur et 1 avertissement préexistant ; build Vite/PWA réussi (avertissement taille bundle). Tests unitaires simulés pour auth/refus, entreprise, dates/fuseau, clarification, erreurs, périmètre des estimations, retards, troncature, fériés stricts et changement d'année. Pas d'essai authentifié réel dans Supabase, pas de test visuel navigateur.

Installation locale : xlsx npm 0.18.5 utilisé temporairement car archive CDN inaccessible ; package.json et lock restaurés, aucune dépendance modifiée dans le lot.

## Après mise en ligne
Ouvrir l'assistant avec une entreprise choisie. Envoyer une question sans période, choisir un exemple puis l'envoyer. Comparer les réponses à la page métier sur les mêmes dates et le même périmètre. En particulier ne pas comparer les estimations persistées seules à un écran qui ajoute des propositions virtuelles. Ne pas interpréter les comptages de lignes comme des heures ou un effectif.
