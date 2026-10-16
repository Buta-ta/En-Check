// ═══════════════════════════════════════════════════════════════════════════
// SERVICE PAUSES — présentation pure des lignes de `encheck_pauses_lire`
// ═══════════════════════════════════════════════════════════════════════════
//  Doctrine (16/10/2026) : la pause RÉELLE gagne ; la PRÉSUMÉE (déduite du
//  créneau de la grille) est TOUJOURS marquée ; l'admin statue (Valider /
//  Écarter) ; on ne supprime jamais — la ligne reste pour l'audit.
//  Couche de présentation PURE : aucun calcul de grille ici (source unique =
//  SQL : encheck_pause_prevue / encheck_pauses_controler).
// ═══════════════════════════════════════════════════════════════════════════

export const STATUTS_BADGES = {
  reelle: { label: 'Pause réelle', color: '#10B981' },
  presumee: { label: 'Présumée', color: '#F59E0B' },
  validee: { label: 'Validée', color: '#3B82F6' },
  ecartee: { label: 'Écartée', color: '#9CA3AF' },
}

export const ANOMALIES_BADGES = {
  sans_reprise: { label: '🚫 Sans reprise', color: '#EF4444' },
  trop_longue: { label: '⚠️ Très longue', color: '#F97316' },
}

export const STATUTS_A_STATUER = ['reelle', 'presumee']

function hhmm (timestamptz) {
  if (!timestamptz) return '--:--'
  return String(timestamptz).slice(11, 16)
}

/**
 * Construit la liste affichable + les statistiques de la page Pauses.
 * @param {Array} lignesSql  lignes de `encheck_pauses_lire`
 * @returns {{ paies: Array, stats: Object }}
 */
export function construirePauses (lignesSql) {
  const paies = []
  let nbReelles = 0
  let nbPresumees = 0
  let nbValidees = 0
  let nbEcartees = 0
  let nbOuvertes = 0
  let nbAnomalies = 0
  let dureeTotale = 0

  for (const l of lignesSql || []) {
    const ouverte = !l.fin
    if (ouverte) nbOuvertes++
    if (l.anomalie) nbAnomalies++
    if (l.statut === 'reelle') nbReelles++
    else if (l.statut === 'presumee') nbPresumees++
    else if (l.statut === 'validee') nbValidees++
    else if (l.statut === 'ecartee') nbEcartees++
    if (l.statut !== 'ecartee' && !ouverte) dureeTotale += Number(l.duree_minutes) || 0

    paies.push({
      id: l.id,
      employe_id: l.employe_id,
      employe: `${l.prenom || ''} ${l.nom || ''}`.trim(),
      matricule: l.matricule,
      entreprise_nom: l.entreprise_nom,
      enterprise_id: l.enterprise_id,
      jour: l.jour,
      debutHHMM: hhmm(l.debut),
      finHHMM: ouverte ? null : hhmm(l.fin),
      dureeMinutes: Number(l.duree_minutes) || 0,
      statut: l.statut,
      source: l.source,
      motif: l.motif,
      anomalie: l.anomalie,
      ouverte,
      aStatuer: STATUTS_A_STATUER.includes(l.statut),
    })
  }

  paies.sort((a, b) => {
    if (a.jour !== b.jour) return b.jour.localeCompare(a.jour)
    return b.debutHHMM.localeCompare(a.debutHHMM)
  })

  return {
    paies,
    stats: {
      totalPauses: paies.length,
      nbReelles,
      nbPresumees,
      nbValidees,
      nbEcartees,
      nbOuvertes,
      nbAnomalies,
      dureeTotale,
    },
  }
}

/** Libellé/teinte du badge de statut (défaut : neutre). */
export function badgeStatut (statut) {
  return STATUTS_BADGES[statut] || { label: statut || '?', color: '#9CA3AF' }
}

/** Libellé/teinte du badge d'anomalie (null si aucune). */
export function badgeAnomalie (anomalie) {
  return anomalie ? (ANOMALIES_BADGES[anomalie] || { label: anomalie, color: '#EF4444' }) : null
}

/** Format « 1h57 » / « 45 min » pour une durée en minutes. */
export function formatDuree (minutes) {
  const m = Math.max(0, Number(minutes) || 0)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Export CSV (séparateur point-virgule, Excel FR). */
export function exportCsvPauses (paies) {
  const entetes = ['Jour', 'Employé', 'Matricule', 'Entreprise', 'Début', 'Fin',
    'Durée (min)', 'Statut', 'Anomalie', 'Motif']
  const lignes = (paies || []).map(p => [
    p.jour, p.employe, p.matricule, p.entreprise_nom, p.debutHHMM,
    p.finHHMM || '', p.dureeMinutes, badgeStatut(p.statut).label,
    (badgeAnomalie(p.anomalie) || {}).label || '', p.motif || '',
  ])
  return [entetes, ...lignes]
    .map(cols => cols.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}
