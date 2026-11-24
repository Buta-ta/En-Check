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
export function agregerParSemaine({ secondesParJour, debut, fin, aujourdHui = null, jourEnCours = null }) {
  const lire = (cle) => {
    if (!secondesParJour) return 0
    if (secondesParJour instanceof Map) return Number(secondesParJour.get(cle)) || 0
    return Number(secondesParJour[cle]) || 0
  }

  //  ⚠️ Une semaine peut être COMPLÈTE au sens de la fenêtre (7 jours) et
  //  pourtant n'avoir AUCUN jour passé : au 24/10, la semaine du 26/10 au
  //  01/11 est entièrement à venir. Comptée comme « 7 jours couverts », elle
  //  rendait « 0 h, niveau aucun » — un constat de conformité sur une semaine
  //  qui n'a pas encore eu lieu. On distingue donc deux choses :
  //    · `joursDansLaPeriode` : ce que la FENÊTRE couvre (inchangé) ;
  //    · `joursEchues`        : ce qui a réellement pu être vécu.
  //
  //  ⚠️ ET LE DERNIER JOUR N'EST PAS ÉCHU TANT QU'IL N'EST PAS FINI.
  //  Compter `cle <= aujourdHui` faisait d'un dimanche à 10 h du matin une
  //  semaine « terminée, 7 jours sur 7, aucun dépassement » — alors qu'il
  //  restait quatorze heures à travailler. `jourEnCours`, quand il est fourni,
  //  est la journée de travail qui n'est pas encore close : elle ne compte pas
  //  parmi les jours échus, même si sa date est atteinte.
  const reference = aujourdHui || null
  const enCours = jourEnCours || null
  return semainesDeLaPeriode(debut, fin).map(({ debut: d, fin: f }) => {
    let secondes = 0
    let joursTravailles = 0
    let joursDansLaPeriode = 0
    let joursEchues = 0
    const curseur = depuisCle(d)
    for (let i = 0; i < 7; i += 1) {
      const cle = cleJour(curseur)
      if (cle >= debut && cle <= fin) {
        joursDansLaPeriode += 1
        const atteinte = reference === null || cle <= reference
        //  La journée en cours existe, mais elle n'est pas finie.
        if (atteinte && cle !== enCours) joursEchues += 1
        const s = lire(cle)
        secondes += s
        if (s > 0) joursTravailles += 1
      }
      curseur.setDate(curseur.getDate() + 1)
    }
    return { debut: d, fin: f, secondes, joursTravailles, joursDansLaPeriode, joursEchues }
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
export function evaluerSeuilsHebdo({
  semaines = [],
  seuil = null,
  seuilMajeur = null,
  //  ⚠️ D'où vient le seuil ? Par défaut « inconnue », jamais « entreprise » :
  //  une affirmation par défaut est exactement ce qui produisait le mensonge de
  //  libellé (P5). L'appelant doit dire ce qu'il sait.
  source = 'inconnue',
} = {}) {
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

  //  ⚠️ QUI DÉCLENCHE L'ALERTE ? Le seuil CHOISI par l'entreprise, pas le
  //  barème haut. Avant, `depasse` se mesurait au maximum des deux : avec un
  //  seuil d'alerte à 40 h et un second niveau à 48 h, une semaine de 45 h ne
  //  déclenchait RIEN, et une semaine de 50 h affichait « seuil de 40 h » avec
  //  « dépassement de 2 h » — un message qui contredisait son propre chiffre.
  //  Le second niveau ne déclenche pas : il QUALIFIE (passage en majoration
  //  haute). `sM` reste le repli quand aucun seuil n'a été choisi.
  const declencheur = s !== null ? s : sM
  const evaluees = semaines.map((sem) => {
    const heures = arrondiHeures(sem.secondes)
    const depasse = declencheur !== null && heures > declencheur
    //  « normal » = seuil de déclenchement ATTEINT (40 h pile compte), même
    //  sans dépassement du plafond haut. « aucun » = sous le seuil.
    const niveau = (sM !== null && heures >= sM) ? 'majeur' : (heures >= (s ?? 0) ? 'normal' : 'aucun')
    //  ⚠️ Une semaine lue sur 3 jours n'est PAS une semaine sous le seuil.
    //  C'était le dernier mensonge de ce module : `joursDansLaPeriode` était
    //  calculé puis jamais lu, donc une fenêtre amputée rendait
    //  « niveau: aucun, 0 dépassement » — un constat de conformité tiré d'une
    //  lecture partielle. On ne le supprime pas : on le NOMME.
    //  Une semaine dont AUCUN jour n'est encore arrivé n'est pas « sans
    //  dépassement » : elle n'a simplement pas eu lieu. `joursEchues` vaut
    //  `null` quand aucune référence n'a été fournie (fenêtre historique,
    //  où tous les jours sont réputés échus).
    const echues = sem.joursEchues === undefined || sem.joursEchues === null
      ? null
      : Number(sem.joursEchues)
    const aVenir = echues === 0
    const partielle = aVenir || (echues === null
      ? Number(sem.joursDansLaPeriode) < 7
      : echues < 7)
    return {
      ...sem,
      heures,
      depasse,
      //  Le dépassement se lit sur le seuil qui a déclenché : le chiffre
      //  affiché et le seuil nommé parlent enfin du même barème.
      depassement_heures: depasse ? Math.round((heures - declencheur) * 100) / 100 : 0,
      //  Et ce qui relève du second niveau est dit séparément, jamais fondu
      //  dans le premier chiffre. `null` = aucun second niveau configuré.
      depassement_niveau_haut_heures:
        sM !== null && heures > sM ? Math.round((heures - sM) * 100) / 100 : 0,
      //  Un dépassement constaté sur une semaine partielle reste un
      //  dépassement (il est prouvé) ; c'est l'ABSENCE de dépassement qui ne
      //  prouve rien tant que la semaine n'est pas couverte en entier.
      niveau: partielle && !depasse ? 'non_evalue' : niveau,
      partielle,
      a_venir: aVenir,
      //  Ce que `joursDansLaPeriode` ne disait pas tout seul : la semaine est
      //  incomplète, donc « aucun dépassement » ne s'y prononce pas.
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
    //  Traçabilité : la source est celle que l'appelant a constatée, pas une
    //  supposition. Aucune de ces valeurs n'est une règle légale.
    source,
    semaines: evaluees,
    nb_depassees: depassees.length,
    max: max ? { debut: max.debut, fin: max.fin, heures: max.heures } : null,
  }
}

function arrondiHeures(secondes) {
  return Math.round((Number(secondes) || 0) / 3600 * 100) / 100
}

/** Message d'alerte — jamais le mot « légal ». */
/** Comment nommer le seuil sans mentir sur son origine. */
export function libelleOrigineSeuil(source) {
  switch (source) {
    case 'entreprise':
      return 'seuil hebdomadaire d’entreprise'
    case 'defaut_produit':
      return 'valeur par défaut du produit, à confirmer'
    case 'historique_incertain':
      return 'seuil enregistré, origine à confirmer'
    case 'employe':
      return 'seuil personnel de l’employé'
    case 'contrat':
      return 'seuil prévu au contrat'
    default:
      return 'seuil hebdomadaire'
  }
}

export function messageDepassement(evaluation) {
  if (!evaluation?.disponible || !evaluation.nb_depassees) return null
  //  ⚠️ Le seuil NOMMÉ est celui qui a déclenché l'alerte. Il annonçait « 48 h »
  //  alors que le déclencheur était à 40 h : le lecteur voyait un seuil qu'il
  //  n'avait pas choisi. Le second niveau, lui, se dit à part et seulement
  //  s'il a été franchi.
  const seuil = evaluation.seuil ?? evaluation.seuil_majeur
  const max = evaluation.max?.heures ?? 0
  const semaines = evaluation.nb_depassees === 1 ? '1 semaine' : `${evaluation.nb_depassees} semaines`
  const niveauHaut = (evaluation.semaines || []).some(
    (sem) => sem && Number(sem.depassement_niveau_haut_heures) > 0,
  )
  const second = niveauHaut && evaluation.seuil_majeur !== null && evaluation.seuil_majeur !== undefined
    ? `, dont ${evaluation.seuil_majeur} h dépassées au second niveau`
    : ''
  return `${semaines} au-delà du ${libelleOrigineSeuil(evaluation.source)} (${seuil} h)${second} — maximum ${max} h`
}

export default {
  lundiDe,
  dimancheDe,
  semainesDeLaPeriode,
  agregerParSemaine,
  evaluerSeuilsHebdo,
  libelleOrigineSeuil,
  messageDepassement,
}
