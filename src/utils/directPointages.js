// ═══════════════════════════════════════════════════════════
// 📡 PETITES RÈGLES DU DIRECT DES POINTAGES
//
// Ce fichier ne contient que des fonctions SANS effet : elles
// décident quoi faire, le hook `useDirectPointages` le fait.
// Les isoler ici permet de les tester sans navigateur.
// ═══════════════════════════════════════════════════════════

/** Les tables dont un changement doit faire bouger l'écran Pointages. */
export const TABLES_SUIVIES = ['attendances', 'encheck_pauses']

/**
 * Combien de temps attendre avant de retenter, selon combien de fois
 * on a déjà échoué. On ne martèle pas : 2 s, 5 s, 15 s, puis 30 s.
 * On ne renonce jamais — un écran de pointage reste ouvert des heures.
 */
export const DELAIS_RECONNEXION = [2000, 5000, 15000, 30000]

export function delaiReconnexion(tentative) {
  const i = Math.max(0, Math.min(tentative, DELAIS_RECONNEXION.length - 1))
  return DELAIS_RECONNEXION[i]
}

/**
 * L'état d'UN abonnement Supabase, traduit en quelque chose qu'on
 * peut montrer à un manager.
 *
 * `SUBSCRIBED` est le seul état qui garantit que les événements
 * arrivent. Tout le reste — y compris `CHANNEL_ERROR`, qui est le
 * refus silencieux d'une table non publiée — veut dire « pas de
 * direct ».
 */
export function etatAbonnement(statut) {
  if (statut === 'SUBSCRIBED') return 'direct'
  if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT' || statut === 'CLOSED') return 'fige'
  return 'connexion'
}

/**
 * L'état de l'écran = le PIRE de ses abonnements.
 *
 * C'est volontaire : afficher « direct » alors qu'une des deux
 * tables est muette, c'est exactement le mensonge qui a coûté
 * plusieurs jours de doute.
 */
export function agregerEtat(etats) {
  const liste = Object.values(etats || {})
  if (liste.length === 0) return 'inactif'
  if (liste.some((e) => e === 'fige')) return 'fige'
  if (liste.some((e) => e === 'connexion')) return 'connexion'
  return 'direct'
}

/** Ce qui s'affiche à côté du titre, et ce que dit l'infobulle. */
export function presenterEtat(etat) {
  switch (etat) {
    case 'direct':
      return {
        libelle: 'Direct',
        ton: 'vert',
        aide: 'Les pointages arrivent dès qu’ils sont enregistrés.',
      }
    case 'connexion':
      return {
        libelle: 'Connexion…',
        ton: 'ambre',
        aide: 'L’écoute en direct est en cours de connexion.',
      }
    case 'fige':
      return {
        libelle: 'Figé',
        ton: 'rouge',
        aide:
          'L’écoute en direct est coupée : l’écran ne se met plus à jour tout seul. ' +
          'Il se rafraîchit quand même toutes les 30 secondes, et à chaque retour sur cet onglet.',
      }
    default:
      return { libelle: 'Inactif', ton: 'gris', aide: 'L’écoute en direct est désactivée.' }
  }
}

/**
 * Le filet de sécurité interroge la base régulièrement. On ne le
 * fait JAMAIS sur un onglet caché : le navigateur économise déjà
 * son énergie, et un écran qu'on ne regarde pas n'a pas besoin
 * d'être à jour.
 */
export function doitSonder(visibilite) {
  return visibilite === 'visible'
}

/** Toutes les 30 s. Assez pour ne jamais rater une heure de pointage. */
export const PERIODE_SONDAGE_MS = 30000

/**
 * Deux empreintes identiques = rien n'a bougé, inutile de recharger
 * tout l'écran. On compare les derniers horodatages connus.
 */
export function aChange(avant, apres) {
  if (!avant || !apres) return true
  return avant.attendances !== apres.attendances || avant.pauses !== apres.pauses
}
