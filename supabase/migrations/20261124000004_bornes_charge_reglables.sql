-- 📊 LES BORNES DU TAUX DE CHARGE SORTENT DU CODE (constat F4)
--
-- LE DÉFAUT
--   `generateAlerts` comparait le taux de charge mensuel à deux littéraux :
--     110 % → « Surcharge détectée »
--      70 % → « Sous-utilisation »
--   Écrits au milieu de la fonction, ils ne se réglaient nulle part et ne se
--   voyaient nulle part. Une entreprise qui travaille structurellement à 115 %
--   recevait le même avertissement qu'une autre, sans pouvoir le changer.
--
-- CE QUE CE FICHIER FAIT
--   Il SÈME les deux valeurs que le code appliquait déjà. Semer ne change donc
--   aucun calcul en cours : une entreprise sans réglage propre reçoit
--   exactement les mêmes alertes qu'avant. Ce qui change, c'est qu'on peut
--   désormais les régler.
--
-- ⚠️ CE SONT DES BORNES DE LECTURE (affichage), PAS DE PAIE.
--   Aucun montant n'en dépend : elles décident seulement si un message
--   apparaît dans le bandeau d'alertes. Les confondre avec un seuil de
--   déclenchement d'heures supplémentaires serait une faute.
--
-- ⚠️ AUCUNE VALEUR N'EST PRÉSENTÉE COMME LÉGALE. 110 % et 70 % sont des choix
--   de lecture du produit, pas une norme.

INSERT INTO public.encheck_reglages_pointage (cle, valeur, commentaire) VALUES
  ('surcharge_pourcent', '110',
   'Taux de charge mensuel au-delà duquel le bandeau signale une surcharge (%). Bornes de LECTURE, pas de paie : aucun montant n''en dépend. Valeur que le code appliquait en dur avant F4 — semée ici pour être réglable.'),
  ('sous_utilisation_pourcent', '70',
   'Taux de charge mensuel en dessous duquel le bandeau signale une sous-utilisation (%). Bornes de LECTURE, pas de paie. Valeur que le code appliquait en dur avant F4 — semée ici pour être réglable.')
ON CONFLICT (cle) WHERE enterprise_id IS NULL DO NOTHING;

--  Un réglage propre à une entreprise n'est jamais écrasé : l'index unique
--  (enterprise_id, cle) l'interdit, et c'est voulu. `ON CONFLICT ... DO NOTHING`
--  ci-dessus ne concerne que le GLOBAL (enterprise_id IS NULL).
