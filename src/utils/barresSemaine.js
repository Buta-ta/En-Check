// ═══════════════════════════════════════════════════════════
// 🧱 LES BARRES DE LA SEMAINE
//
// Une absence de trois jours ne doit pas se lire comme trois
// accidents séparés : c'est une seule barre qui traverse les
// cases. Ce fichier ne fait que le calcul — les jours arrivent
// déjà étiquetés par l'écran, il ne devine rien.
// ═══════════════════════════════════════════════════════════

/**
 * Regroupe les jours consécutifs qui portent la même absence.
 *
 * @param {{ etat: string, mot: string }[]} jours les sept jours de la semaine
 * @returns {{ debut: number, fin: number, mot: string }[]} les barres, une par
 *   série d'au moins deux jours. Un jour isolé n'est pas une barre : sa case suffit.
 */
export function grouperAbsences(jours) {
  const barres = []
  let debut = null

  const fermer = (fin) => {
    if (debut !== null && fin > debut) {
      barres.push({ debut, fin, mot: jours[debut].mot })
    }
    debut = null
  }

  jours.forEach((jour, index) => {
    if (jour.etat !== 'conge') {
      fermer(index - 1)
      return
    }
    if (debut === null) {
      debut = index
      return
    }
    if (jours[debut].mot !== jour.mot) {
      fermer(index - 1)
      debut = index
    }
  })
  fermer(jours.length - 1)

  return barres
}
