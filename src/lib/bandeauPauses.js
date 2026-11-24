// ═══════════════════════════════════════════════════════════════════════════
// ☕ LOGIQUE DU BANDEAU DES PAUSES — sans dépendance à la base
//
// Séparé du composant exprès : la borne importe ce module, et les tests
// aussi. Ce fichier ne doit JAMAIS importer `../lib/supabase`, sinon les
// tests échouent dès que le `.env` manque — et un test qui exige une
// configuration pour tourner finit par être ignoré.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * « 1:51 » — heures:minutes, sans les secondes : on n'est pas à la seconde
 * près sur un bandeau de couloir.
 *
 * Renvoie `null` sur une date illisible, et jamais une durée négative : une
 * horloge de tablette décalée ne doit pas écrire « -3:12 » devant tout le
 * monde.
 */
export function dureeCourte (debutIso, maintenantMs = Date.now()) {
  const debut = new Date(debutIso).getTime()
  if (!Number.isFinite(debut)) return null
  const minutes = Math.max(0, Math.floor((maintenantMs - debut) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/**
 * Charge les pauses en cours. Ne lève JAMAIS.
 *
 * La borne sert à pointer : une erreur réseau, une fonction absente du
 * serveur (déploiement partiel) ou un changement de droits ne doit pas
 * empêcher un employé de badger. Toute erreur renvoie une liste vide, et
 * l'écran n'affiche simplement pas le bandeau.
 */
export async function chargerPausesBandeau (enterpriseId, client) {
  if (!enterpriseId) return []
  if (!client || typeof client.rpc !== 'function') return []
  try {
    const { data, error } = await client.rpc('encheck_pauses_bandeau', {
      p_enterprise: enterpriseId,
    })
    if (error) return []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
