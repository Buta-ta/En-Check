// src/services/snapshotCalcul.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧊 CALCUL FIGÉ — la mémoire du moteur (constat C1/C2)
// ═══════════════════════════════════════════════════════════════════════════
//
// LE PROBLÈME
//   `calculateEmployeeHours` recalcule tout à chaque affichage. Les heures du
//   mois dernier dépendent donc des badges, des seuils et des taux tels qu'ils
//   sont AUJOURD'HUI. Corriger un badge de mars change le bulletin de mars :
//   sans trace, sans comparaison, sans moyen de dire « ce chiffre a bougé ».
//
// CE QUE CE MODULE APPORTE
//   Deux empreintes, et une règle simple :
//     · `empreinte_entrees` : les pointages qui ont servi ;
//     · `empreinte_regles`  : les règles appliquées (seuils, taux, fériés).
//   Si l'une des deux change, le calcul figé est PÉRIMÉ — et on le DIT, au
//   lieu de le remplacer en silence.
//
// CE QUE CE MODULE NE FAIT PAS (encore)
//   Il ne fige rien automatiquement : `enregistrerSnapshot` est appelé
//   explicitement. Écrire en base à chaque lecture de tableau de bord serait
//   un choix d'architecture, pas un détail d'implémentation, et la décision
//   « quand fige-t-on ? » n'est pas tranchée. Le module fournit la primitive
//   et la preuve ; il ne prend pas la décision à la place du produit.
//
// ⚠️ Ce n'est PAS le dossier de preuve (C1 de l'audit) : celui-là dépend de
//    D5 (valeur probante) et reste à l'arrêt. Ici, on garantit seulement que
//   « le même calcul, rejoué, donne le même chiffre — ou dit qu'il ne peut
//   plus le garantir ».
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Empreinte stable et courte (djb2 + longueur).
 *
 * Pourquoi pas SHA-256 ? Il faudrait `crypto.subtle`, asynchrone, et
 * indisponible dans certains contextes de test. Ici on ne cherche pas la
 * résistance cryptographique, mais la DÉTECTION DE CHANGEMENT : deux entrées
 * différentes doivent donner deux empreintes différentes (le plus souvent
 * possible), et un simple « je compare la liste entière » ne tiendrait pas
 * dans une colonne indexable.
 */
export function empreinte(valeur) {
  const texte = typeof valeur === 'string' ? valeur : JSON.stringify(valeur ?? null)
  let hash = 5381
  for (let i = 0; i < texte.length; i += 1) {
    hash = ((hash << 5) + hash + texte.charCodeAt(i)) | 0
  }
  //  Le signe est retiré et la longueur ajoutée : deux textes de même hash
  //  modulo 2^32 mais de longueurs différentes restent distinguables.
  return `${(hash >>> 0).toString(36)}-${texte.length.toString(36)}`
}

/** Champ comparable d'un pointage, tolérant aux variantes de forme. */
function lignePointage(att) {
  return [
    att?.id ?? '',
    att?.check_type ?? '',
    att?.check_time ?? '',
    att?.is_auto_closed === true ? '1' : '0',
    att?.estimation_niveau ?? '',
    //  Une correction humaine doit changer l'empreinte : sinon corriger un
    //  badge ne « périmerait » pas le calcul qu'il invalide.
    att?.modifie_le ?? '',
    att?.corrige_par ?? '',
  ].join('|')
}

/**
 * Empreinte des pointages utilisés.
 * L'ORDRE NE COMPTE PAS : on trie avant de hacher. Deux lectures de la même
 * journée dans un ordre différent ne doivent pas périmer un calcul.
 */
export function empreinteEntrees(attendances = []) {
  const lignes = (attendances || [])
    .filter(Boolean)
    .map(lignePointage)
    .sort()
  return empreinte(lignes.join('\n'))
}

/**
 * Empreinte des règles appliquées.
 * On n'empreint QUE ce qui change un chiffre : seuils de pointage, réglages
 * d'heures supplémentaires, taux horaire, majorations fériés.
 */
export function empreinteRegles({ seuils = null, overtimeSettings = null, tauxHoraire = null, feries = null } = {}) {
  const normaliser = (obj) => {
    if (!obj || typeof obj !== 'object') return null
    const entrees = Object.keys(obj)
      .filter(cle => !['id', 'enterprise_id', 'created_at', 'updated_at', 'chargement'].includes(cle))
      .sort()
      .map(cle => [cle, obj[cle]])
    return entrees
  }

  return empreinte(JSON.stringify({
    seuils: normaliser(seuils),
    overtime: normaliser(overtimeSettings),
    taux_horaire: tauxHoraire === null || tauxHoraire === undefined ? null : Number(tauxHoraire),
    //  Taux de majoration réellement résolus pour chaque férié de la période.
    feries: (feries?.jours || []).map(j => [j.date, j.taux_percent, j.niveau]).sort(),
  }))
}

/**
 * Construit la photographie à enregistrer.
 *
 * @param {object} options
 * @param {object} options.calcul        résultat de `calculateEmployeeHours`
 * @param {Array}  options.attendances   pointages de la période
 * @param {object} options.regles        { seuils, overtimeSettings, tauxHoraire, feries }
 * @param {string} options.enterpriseId
 * @param {string} options.employeeId
 * @param {string} options.periodeDebut  YYYY-MM-DD
 * @param {string} options.periodeFin    YYYY-MM-DD
 */
export function construireSnapshot({
  calcul,
  attendances = [],
  regles = {},
  enterpriseId,
  employeeId,
  periodeDebut,
  periodeFin,
}) {
  const empreinteE = empreinteEntrees(attendances)
  const empreinteR = empreinteRegles(regles)

  return {
    enterprise_id: enterpriseId,
    employee_id: employeeId,
    periode_debut: periodeDebut,
    periode_fin: periodeFin,
    empreinte_entrees: empreinteE,
    empreinte_regles: empreinteR,
    total_brut: calcul?.valorization?.total_gross ?? null,
    devise: calcul?.valorization?.currency ?? null,
    payload: {
      //  On ne stocke PAS tout l'objet : les alertes sont recalculables,
      //  la valorisation ne l'est pas (elle dépend du taux horaire figé).
      mois: calcul?.thisMonth ?? null,
      valorization: calcul?.valorization ?? null,
      feries: calcul?.feries ?? null,
    },
  }
}

/**
 * Enregistre une photographie.
 *
 * Le client Supabase est INJECTÉ : le module reste testable, et l'appelant
 * décide du contexte (admin, RPC, tâche planifiée).
 *
 * @returns {Promise<{ok: boolean, deja_fige?: boolean, erreur?: string}>}
 */
export async function enregistrerSnapshot(client, snapshot) {
  if (!client?.from) return { ok: false, erreur: 'client indisponible' }
  if (!snapshot?.employee_id || !snapshot?.periode_debut) {
    return { ok: false, erreur: 'snapshot incomplet' }
  }

  const { error } = await client
    .from('encheck_calcul_snapshots')
    .insert(snapshot)

  if (!error) return { ok: true }

  //  Code 23505 = violation d'unicité : la même photo existe déjà. Ce n'est
  //  pas une panne, c'est une opération idempotente qui a déjà eu lieu.
  if (error.code === '23505') return { ok: true, deja_fige: true }

  return { ok: false, erreur: error.message || 'écriture impossible' }
}

/**
 * Le calcul figé est-il encore valable ?
 *
 * @returns {{ perime: boolean, raisons: string[] }}
 */
export function etatSnapshot({ snapshot, attendances = [], regles = {} } = {}) {
  if (!snapshot) return { perime: true, raisons: ['aucun calcul figé'] }

  const raisons = []
  if (empreinteEntrees(attendances) !== snapshot.empreinte_entrees) {
    raisons.push('pointages modifiés')
  }
  if (empreinteRegles(regles) !== snapshot.empreinte_regles) {
    raisons.push('règles modifiées')
  }
  return { perime: raisons.length > 0, raisons }
}

/**
 * Écarts lisibles entre deux photographies.
 * Sert à répondre à la seule question qui compte : « qu'est-ce qui a bougé ? »
 */
export function comparerSnapshots(avant, apres) {
  if (!avant || !apres) return { comparable: false, ecarts: [] }

  const montant = (s) => Number(s?.total_brut ?? 0)
  const ecarts = []

  const deltaBrut = montant(apres) - montant(avant)
  if (deltaBrut !== 0) {
    ecarts.push({ champ: 'total_brut', avant: montant(avant), apres: montant(apres), delta: deltaBrut })
  }
  if (avant.empreinte_entrees !== apres.empreinte_entrees) {
    ecarts.push({ champ: 'empreinte_entrees', avant: avant.empreinte_entrees, apres: apres.empreinte_entrees })
  }
  if (avant.empreinte_regles !== apres.empreinte_regles) {
    ecarts.push({ champ: 'empreinte_regles', avant: avant.empreinte_regles, apres: apres.empreinte_regles })
  }

  return { comparable: true, ecarts, identique: ecarts.length === 0 }
}

export default {
  empreinte,
  empreinteEntrees,
  empreinteRegles,
  construireSnapshot,
  enregistrerSnapshot,
  etatSnapshot,
  comparerSnapshots,
}
