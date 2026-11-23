// src/services/reposQuotidien.js
// ═══════════════════════════════════════════════════════════════════════════
// 🌙 REPOS ENTRE DEUX JOURNÉES — mesuré, pas supposé
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER
//   Le moteur ne connaît que des totaux : 62 h cette semaine, 8 h hier. Il ne
//   sait pas dire « cette personne a repris 6 h après avoir pointé sa sortie ».
//   Or c'est exactement ce qu'un contrôle regarde, et ce qu'un salarié subit.
//
// CE QUE CE MODULE NE FAIT PAS
//   Il ne fixe AUCUN minimum légal. Le minimum vient d'un réglage
//   d'entreprise (clé `repos_quotidien_heures`). Sans réglage, le module ne
//   conclut rien : `disponible: false`. Un « 0 violation » silencieux ferait
//   croire à une conformité qui n'a jamais été évaluée — même discipline que
//   pour les seuils hebdomadaires et les jours fériés.
//
// CE QU'IL MESURE
//   L'écart entre la FIN d'une journée travaillée et le DÉBUT de la suivante,
//   dans l'ordre chronologique des pointages. Un écart négatif (la personne a
//   pointé son entrée avant la sortie de la veille) n'est pas un « repos de
//   0 h » : c'est un chevauchement, et il est signalé comme tel.
// ═══════════════════════════════════════════════════════════════════════════

const HEURE_MS = 3600 * 1000

function horodatage(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

function arrondiHeures(ms) {
  return Math.round((ms / HEURE_MS) * 100) / 100
}

/**
 * Écarts de repos entre journées consécutives.
 *
 * @param {Array<{date: string, debut: string|null, fin: string|null}>} journees
 *        triées ou non : la fonction trie elle-même par début réel
 * @returns {Array<{de: string, vers: string, heures: number, chevauchement: boolean, debut: string, fin: string}>}
 */
export function ecartsDeRepos(journees = []) {
  const exploitables = (journees || [])
    .map(j => ({
      date: j.date,
      debut: horodatage(j.debut),
      fin: horodatage(j.fin),
      debutISO: j.debut,
      finISO: j.fin,
    }))
    //  Une journée sans entrée ou sans sortie ne permet pas de mesurer un repos.
    .filter(j => j.debut !== null && j.fin !== null)
    .sort((a, b) => a.debut - b.debut)

  const ecarts = []
  for (let i = 1; i < exploitables.length; i += 1) {
    const precedent = exploitables[i - 1]
    const courant = exploitables[i]
    const ms = courant.debut - precedent.fin
    ecarts.push({
      de: precedent.date,
      vers: courant.date,
      heures: arrondiHeures(Math.max(0, ms)),
      //  Un écart négatif n'est pas « zéro heure de repos », c'est un
      //  enchaînement : la sortie de la veille est après l'entrée du jour.
      chevauchement: ms < 0,
      debut: courant.debutISO,
      fin: precedent.finISO,
    })
  }
  return ecarts
}

/**
 * Évalue les écarts contre un minimum d'entreprise.
 *
 * @param {object} options
 * @param {Array} options.journees
 * @param {number|string|null} [options.minimumHeures]
 * @returns {{
 *   disponible: boolean, motif: string|null, minimum: number|null,
 *   source: string|null, ecarts: Array, violations: Array, nb_violations: number,
 *   pire: object|null
 * }}
 */
export function evaluerReposQuotidien({ journees = [], minimumHeures = null } = {}) {
  const minimum = normaliserMinimum(minimumHeures)
  const ecarts = ecartsDeRepos(journees)

  if (minimum === null) {
    return {
      disponible: false,
      motif: 'aucun minimum de repos configuré',
      minimum: null,
      source: null,
      ecarts: ecarts.map(e => ({ ...e, respecte: null, manque_heures: null })),
      violations: [],
      nb_violations: 0,
      pire: null,
    }
  }

  const evalues = ecarts.map((e) => {
    //  Un chevauchement viole le repos par construction (0 h mesurable).
    const respecte = !e.chevauchement && e.heures >= minimum
    return {
      ...e,
      respecte,
      manque_heures: respecte ? 0 : Math.round((minimum - e.heures) * 100) / 100,
    }
  })

  const violations = evalues.filter(e => !e.respecte)
  const pire = evalues.reduce((acc, e) => (!acc || e.heures < acc.heures ? e : acc), null)

  return {
    disponible: true,
    motif: null,
    minimum,
    //  Traçabilité : réglage d'entreprise, pas une norme légale invoquée ici.
    source: 'entreprise',
    ecarts: evalues,
    violations,
    nb_violations: violations.length,
    pire: pire ? { de: pire.de, vers: pire.vers, heures: pire.heures } : null,
  }
}

function normaliserMinimum(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const n = Number(valeur)
  //  Un minimum de 0 n'est pas un minimum : ce serait déclarer conforme
  //  n'importe quel enchaînement.
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Message d'alerte — jamais le mot « légal ». */
export function messageRepos(evaluation) {
  if (!evaluation?.disponible || !evaluation.nb_violations) return null
  const pire = evaluation.pire
  const nombre = evaluation.nb_violations === 1 ? '1 repos trop court' : `${evaluation.nb_violations} repos trop courts`
  const detail = pire && pire.heures > 0
    ? ` — minimum ${pire.heures} h entre le ${jourCourt(pire.de)} et le ${jourCourt(pire.vers)}`
    : ''
  const chevauche = evaluation.violations.some(v => v.chevauchement)
  const suffixe = chevauche ? ' (enchaînement de deux journées)' : ''
  return `${nombre} sur la période (seuil d’entreprise ${evaluation.minimum} h)${detail}${suffixe}`
}

function jourCourt(cle) {
  if (!cle) return '—'
  const [, m, j] = String(cle).split('-')
  return `${j}/${m}`
}

export default {
  ecartsDeRepos,
  evaluerReposQuotidien,
  messageRepos,
}
