// ═══════════════════════════════════════════════════════════════════════════
// SERVICE RETARDS — traduction des lignes de `encheck_retards_plage`
// ═══════════════════════════════════════════════════════════════════════════
//  Le calcul (grille en vigueur, dates d'effet, tolérance, option Planning)
//  appartient UNIQUEMENT au SQL : `encheck_retards_plage` →
//  `encheck_journee_recalculee` → `encheck_grille_au_jour`. Ce module est une
//  couche de présentation PURE : aucune requête, aucun calcul de grille.
//
//  Constat du 16/10/2026 : la page Retards lit `employee_schedules` sans
//  filtre is_active, sans dates d'effet, sans vérifier l'entreprise de la
//  grille liée — d'où des « Prévu 08:00 » fantômes chez des employés dont
//  l'entreprise n'a aucun planning (Pharmacie Blanche Gomes). Interdit de
//  jamais relire ces tables ici (verrou dans cablageRetards.test.js).
// ═══════════════════════════════════════════════════════════════════════════

// Source du résolveur SQL → libellé de badge de la page.
//  custom = horaire personnalisé · liee = planning associé · defaut = grille
//  par défaut de l'entreprise.
export const SOURCES_SQL_VERS_BADGE = {
  custom: 'personnalisé',
  liee: 'planning',
  defaut: 'entreprise',
}

// Motifs d'exclusion posés par `encheck_retards_plage` (lignes non jugées).
export const MOTIFS_SANS_PLANNING = ['sans_option_planning', 'sans_grille']

/**
 * Construit la liste des retards et les statistiques de la page.
 *
 * @param {Array} lignesSql  lignes de `encheck_retards_plage`
 * @param {Object} holidaysByEnterprise  { [enterpriseId]: Set<'YYYY-MM-DD'> }
 * @returns {{ retards: Array, stats: Object }}
 */
export function construireRetards (lignesSql, holidaysByEnterprise = {}) {
  const retards = []
  const employesPonctuels = new Set()
  const employesEnRetard = new Set()
  const employesSansPlanning = new Set()
  let totalMinutesRetard = 0

  for (const ligne of lignesSql || []) {
    // ── Jours fériés non travaillés : jamais de retard (filtre existant) ──
    const feries = holidaysByEnterprise[ligne.enterprise_id]
    if (feries && typeof feries.has === 'function' && feries.has(ligne.jour)) continue

    if (ligne.motif_exclusion) {
      if (MOTIFS_SANS_PLANNING.includes(ligne.motif_exclusion)) {
        employesSansPlanning.add(ligne.employe_id)
      }
      continue
    }

    if (ligne.est_retard) {
      totalMinutesRetard += Number(ligne.retard_minutes) || 0
      employesEnRetard.add(ligne.employe_id)
      retards.push({
        id: ligne.pointage_id,
        employee: {
          id: ligne.employe_id,
          first_name: ligne.prenom,
          last_name: ligne.nom,
          matricule: ligne.matricule,
          enterprises: { name: ligne.entreprise_nom },
        },
        date: ligne.jour,
        heureArrivee: ligne.heure_prevue,
        heurePointage: ligne.heure_arrivee,
        retardMinutes: Number(ligne.retard_minutes) || 0,
        tolerance: Number(ligne.tolerance_minutes ?? 15),
        sourceHoraire: SOURCES_SQL_VERS_BADGE[ligne.grille_source] || 'entreprise',
      })
    } else {
      employesPonctuels.add(ligne.employe_id)
    }
  }

  retards.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.retardMinutes - a.retardMinutes
  })

  return {
    retards,
    stats: {
      totalRetards: retards.length,
      totalMinutesRetard,
      employesPonctuels: employesPonctuels.size,
      employesEnRetard: employesEnRetard.size,
      employesSansPlanningIgnores: employesSansPlanning.size,
    },
  }
}
