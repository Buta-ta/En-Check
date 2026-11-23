// src/services/plafondHebdomadaire.js
// ═══════════════════════════════════════════════════════════════════════════
// 📅 FENÊTRE HEBDOMADAIRE — une primitive, pas un cumul
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER
//   `weekly_threshold` (40 h) et `weekly_threshold_major` (48 h) sont lus
//   depuis toujours par `featureService.getOvertimeSettings`… et utilisés
//   nulle part. Une semaine à 62 h s'affiche donc normalement, sans un mot.
//
//   Ce module apporte la primitive manquante : `somme_fenetre(employé, 7 j)`.
//
// CE QUE CE MODULE N'EST PAS — ET NE DOIT PAS DEVENIR
//   Le quota annuel « 964 h » n'est PAS une fenêtre. C'est un cumul ancré, avec
//   remise à zéro à l'anniversaire de l'ancre et proratisation. Réunir les deux
//   produirait un détecteur qui se trompe deux fois (docs/AUDIT-ALGORITHMES-ET-
//   ANTICIPATION.md §13.2). Ici : uniquement des fenêtres de 7 jours.
//
// QUELLE VALEUR DE SEUIL ?
//   Ce module ne contient AUCUN plafond légal. Les seuils viennent des réglages
//   de l'entreprise (heures supplémentaires hebdomadaires). Ils sont donc
//   étiquetés « paramètre d'entreprise » partout, jamais « plafond légal » :
//   une valeur légale demande une source (décision D5, non tranchée).
//
//   Sans seuil configuré, le module ne conclut RIEN. Un « 0 dépassement »
//   silencieux ferait croire à une conformité qui n'a jamais été évaluée.
// ═══════════════════════════════════════════════════════════════════════════

/** Clé locale YYYY-MM-DD (même convention que les journées du moteur). */
function cleJour(date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

/** Date locale depuis une clé YYYY-MM-DD. */
function depuisCle(cle) {
  const [a, m, j] = String(cle).split('-').map(Number)
  return new Date(a, (m || 1) - 1, j || 1)
}

/** Lundi de la semaine contenant `cle` (semaine lundi → dimanche). */
export function lundiDe(cle) {
  const d = depuisCle(cle)
  const jour = d.getDay() // 0 = dimanche
  const recul = jour === 0 ? 6 : jour - 1
  d.setDate(d.getDate() - recul)
  return cleJour(d)
}

/** Dimanche de la semaine contenant `cle`. */
export function dimancheDe(cle) {
  const d = depuisCle(lundiDe(cle))
  d.setDate(d.getDate() + 6)
  return cleJour(d)
}

/**
 * Les semaines (lundi → dimanche) qui touchent une période.
 * Une semaine à cheval sur deux mois reste UNE semaine : sinon un dépassement
 * de 50 h pourrait se cacher dans deux « semaines » de 25 h.
 *
 * @returns {Array<{debut: string, fin: string}>}
 */
export function semainesDeLaPeriode(debut, fin) {
  if (!debut || !fin) return []
  const semaines = []
  let curseur = lundiDe(debut)
  const borne = dimancheDe(fin)
  const garde = 400 // 400 semaines : au-delà, l'appelant s'est trompé d'année

  for (let i = 0; i < garde && curseur <= borne; i += 1) {
    const dimanche = dimancheDe(curseur)
    semaines.push({ debut: curseur, fin: dimanche })
    const suivant = depuisCle(dimanche)
    suivant.setDate(suivant.getDate() + 1)
    curseur = cleJour(suivant)
  }
  return semaines
}

/**
 * Somme des secondes par semaine.
 *
 * @param {object} options
 * @param {Object<string, number>|Map<string, number>} options.secondesParJour
 *        secondes travaillées, indexées par clé locale YYYY-MM-DD
 * @param {string} options.debut  premier jour de la période
 * @param {string} options.fin    dernier jour de la période
 * @returns {Array<{debut, fin, secondes, joursTravailles, joursDansLaPeriode}>}
 */
export function agregerParSemaine({ secondesParJour, debut, fin }) {
  const lire = (cle) => {
    if (!secondesParJour) return 0
    if (secondesParJour instanceof Map) return Number(secondesParJour.get(cle)) || 0
    return Number(secondesParJour[cle]) || 0
  }

  return semainesDeLaPeriode(debut, fin).map(({ debut: d, fin: f }) => {
    let secondes = 0
    let joursTravailles = 0
    let joursDansLaPeriode = 0
    const curseur = depuisCle(d)
    for (let i = 0; i < 7; i += 1) {
      const cle = cleJour(curseur)
      if (cle >= debut && cle <= fin) {
        joursDansLaPeriode += 1
        const s = lire(cle)
        secondes += s
        if (s > 0) joursTravailles += 1
      }
      curseur.setDate(curseur.getDate() + 1)
    }
    return { debut: d, fin: f, secondes, joursTravailles, joursDansLaPeriode }
  })
}

/** Un seuil d'heures exploitable, ou null. */
function seuilValide(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const n = Number(valeur)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Évalue chaque semaine contre les seuils hebdomadaires d'entreprise.
 *
 * @param {object} options
 * @param {Array} options.semaines        sortie de `agregerParSemaine`
 * @param {number} [options.seuil]        ex. 40 h (déclenchement des heures sup)
 * @param {number} [options.seuilMajeur]  ex. 48 h (passage en majoration haute)
 * @returns {{
 *   disponible: boolean,
 *   motif: string|null,
 *   seuil: number|null,
 *   seuil_majeur: number|null,
 *   source: string|null,
 *   semaines: Array, nb_depassees: number,
 *   max: object|null
 * }}
 */
export function evaluerSeuilsHebdo({ semaines = [], seuil = null, seuilMajeur = null } = {}) {
  const s = seuilValide(seuil)
  const sM = seuilValide(seuilMajeur)
  const bareme = sM !== null && s !== null ? Math.max(s, sM) : (sM ?? s)

  //  Aucun seuil : on ne fabrique ni conformité ni dépassement.
  if (bareme === null) {
    return {
      disponible: false,
      motif: 'aucun seuil hebdomadaire configuré',
      seuil: null,
      seuil_majeur: null,
      source: null,
      semaines: semaines.map(sem => ({
        ...sem,
        heures: arrondiHeures(sem.secondes),
        depasse: false,
        depassement_heures: 0,
        niveau: 'non_evalue',
      })),
      nb_depassees: 0,
      max: null,
    }
  }

  const evaluees = semaines.map((sem) => {
    const heures = arrondiHeures(sem.secondes)
    const depasse = heures > bareme
    //  « normal » = seuil de déclenchement ATTEINT (40 h pile compte), même
    //  sans dépassement du plafond haut. « aucun » = sous le seuil.
    const niveau = (sM !== null && heures >= sM) ? 'majeur' : (heures >= (s ?? 0) ? 'normal' : 'aucun')
    return {
      ...sem,
      heures,
      depasse,
      depassement_heures: depasse ? Math.round((heures - bareme) * 100) / 100 : 0,
      niveau,
      //  Une semaine incomplète (période qui commence un mercredi) ne peut pas
      //  être jugée sur son total : on le signale au lieu de la déclarer sage.
      complete: sem.joursDansLaPeriode === 7,
    }
  })

  const depassees = evaluees.filter(sem => sem.depasse)
  const max = evaluees.reduce(
    (acc, sem) => (!acc || sem.secondes > acc.secondes ? sem : acc),
    null,
  )

  return {
    disponible: true,
    motif: null,
    seuil: s,
    seuil_majeur: sM,
    //  Traçabilité : c'est un réglage d'entreprise, pas une règle légale.
    source: 'entreprise',
    semaines: evaluees,
    nb_depassees: depassees.length,
    max: max ? { debut: max.debut, fin: max.fin, heures: max.heures } : null,
  }
}

function arrondiHeures(secondes) {
  return Math.round((Number(secondes) || 0) / 3600 * 100) / 100
}

/** Message d'alerte — jamais le mot « légal ». */
export function messageDepassement(evaluation) {
  if (!evaluation?.disponible || !evaluation.nb_depassees) return null
  const seuil = evaluation.seuil_majeur ?? evaluation.seuil
  const max = evaluation.max?.heures ?? 0
  const semaines = evaluation.nb_depassees === 1 ? '1 semaine' : `${evaluation.nb_depassees} semaines`
  return `${semaines} au-delà du seuil hebdomadaire d’entreprise (${seuil} h) — maximum ${max} h`
}

export default {
  lundiDe,
  dimancheDe,
  semainesDeLaPeriode,
  agregerParSemaine,
  evaluerSeuilsHebdo,
  messageDepassement,
}
