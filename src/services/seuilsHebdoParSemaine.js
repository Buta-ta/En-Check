// src/services/seuilsHebdoParSemaine.js
// ═══════════════════════════════════════════════════════════════════════════
//  SEUILS D'ALERTE HEBDO — RÉSOLUTION PAR SEMAINE
//
//  Décision du fondateur (option 3) : pour chaque semaine de travail du lundi
//  au dimanche, le moteur applique le seuil, le second seuil et l'activation
//  EN VIGUEUR LE LUNDI DE CETTE SEMAINE, dans le fuseau de l'entreprise.
//
//  Conséquences, voulues :
//    · une règle prenant effet un mercredi s'applique le lundi SUIVANT ; on ne
//      découpe jamais une semaine entre deux règles ;
//    · une semaine passée se relit avec la règle de SON lundi, jamais avec le
//      réglage d'aujourd'hui ;
//    · l'employé est transmis : une règle personnelle verrouillée garde sa
//      priorité sur celle de l'entreprise.
//
//  ⚠️ Ce module ne décide RIEN des valeurs : il choisit QUELLE version
//  s'applique. Aucun seuil enregistré, aucun montant, aucune règle de paie
//  n'est modifié ici.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lundi (AAAA-MM-JJ) de la semaine contenant `jour`, exprimé dans `fuseau`.
 *
 * Le jour est d'abord lu DANS LE FUSEAU DE L'ENTREPRISE : sans cela, un
 * pointage de dimanche 23:30 UTC basculerait sur lundi et la semaine serait
 * lue avec la règle d'une semaine qui n'a pas commencé.
 *
 * @param {string|Date} jour
 * @param {string|null} fuseau  ex. 'Africa/Porto-Novo'
 * @returns {string|null} 'AAAA-MM-JJ' ou null si `jour` est inexploitable
 */
export function lundiDeLaSemaine(jour, fuseau = null) {
  const cle = cleDansFuseau(jour, fuseau)
  if (!cle) return null
  const [a, m, j] = cle.split('-').map(Number)
  //  Date UTC : on ne veut aucune surprise de changement d'heure sur un calcul
  //  de calendrier. Les composantes sont déjà locales, on les traite comme
  //  des étiquettes.
  const d = new Date(Date.UTC(a, m - 1, j))
  const decalage = (d.getUTCDay() + 6) % 7   // lundi = 0 … dimanche = 6
  d.setUTCDate(d.getUTCDate() - decalage)
  return d.toISOString().slice(0, 10)
}

/**
 * La semaine suivante (lundi + 7 jours). Sert à borner les paliers.
 */
export function lundiSuivant(lundiISO) {
  if (!lundiISO) return null
  const [a, m, j] = lundiISO.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j))
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString().slice(0, 10)
}

/** Date lisible dans le fuseau de l'entreprise (AAAA-MM-JJ). */
function cleDansFuseau(jour, fuseau) {
  if (!jour) return null
  const date = jour instanceof Date ? jour : new Date(jour)
  if (Number.isNaN(date.getTime())) return null

  if (fuseau) {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: fuseau,
        year: 'numeric', month: '2-digit', day: '2-digit',
      })
      const p = fmt.formatToParts(date)
      const lire = (t) => p.find((x) => x.type === t)?.value
      const a = lire('year')
      const m = lire('month')
      const j = lire('day')
      if (a && m && j) return `${a}-${m}-${j}`
    } catch {
      //  Fuseau inconnu : on retombe sur UTC plutôt que d'inventer.
    }
  }
  return date.toISOString().slice(0, 10)
}

/**
 * Choisit le palier applicable à la semaine dont le lundi est `lundiISO`.
 *
 * `paliers` doit être trié de la date d'effet la PLUS RÉCENTE à la plus
 * ancienne (c'est l'ordre que rend la base). Le premier palier dont la date
 * d'effet est ≤ lundi est celui de la semaine.
 *
 * @param {Array} paliers
 * @param {string} lundiISO
 */
export function choisirPalier(paliers, lundiISO) {
  if (!Array.isArray(paliers) || paliers.length === 0) return null
  if (!lundiISO) return null
  for (const p of paliers) {
    if (p.depuis === null) return p            // repli : rien de plus précis
    if (String(p.depuis).slice(0, 10) <= lundiISO) return p
  }
  //  Toutes les versions sont POSTÉRIEURES au lundi : aucune ne s'applique
  //  encore. On ne prend pas « la plus ancienne » par commodité — ce serait
  //  appliquer une règle avant son entrée en vigueur.
  return null
}

/**
 * Construit la liste des paliers à partir des versions rendues par la base.
 *
 * @param {Array} versions  [{ cle, valeur, date_effet, origine }]
 * @param {object} repli    { seuil, seuilMajeur, active } — réglage d'entreprise
 * @param {string} cleSeuil
 * @param {string} cleNiveau2
 * @param {string} cleActivation
 * @returns {Array} paliers triés du plus récent au plus ancien
 */
export function construirePaliers({
  versions = [],
  repli = {},
  cleSeuil = 'alerte_hebdo_heures',
  cleNiveau2 = 'alerte_hebdo_niveau2_heures',
  cleActivation = 'alerte_hebdo_activee',
} = {}) {
  const parDate = new Map()

  const ajouter = (dateEffet, cle, version) => {
    const cleDate = dateEffet ? String(dateEffet).slice(0, 10) : null
    if (!parDate.has(cleDate)) {
      parDate.set(cleDate, { seuil: null, niveau2: null, activation: null })
    }
    parDate.get(cleDate)[cle] = version
  }

  for (const v of versions || []) {
    if (!v) continue
    if (v.cle === cleSeuil) ajouter(v.date_effet, 'seuil', v)
    else if (v.cle === cleNiveau2) ajouter(v.date_effet, 'niveau2', v)
    else if (v.cle === cleActivation) ajouter(v.date_effet, 'activation', v)
  }

  //  Aucune version : un seul palier de repli, la règle d'entreprise.
  if (parDate.size === 0) {
    return [{
      depuis: null,
      seuil: repli.seuil ?? null,
      seuilMajeur: repli.seuilMajeur ?? null,
      active: repli.active === true || repli.active === false ? repli.active : null,
      origineSeuil: 'entreprise',
      origineActivation: 'entreprise',
      sourceSeuil: 'reglage_entreprise',
    }]
  }

  //  Le palier de repli porte l'état d'AVANT la première version connue.
  const dates = [...parDate.keys()].filter((d) => d !== null).sort().reverse()
  const paliers = dates.map((d) => {
    const l = parDate.get(d)
    return {
      depuis: d,
      seuil: l.seuil?.valeur ?? null,
      seuilMajeur: l.niveau2?.valeur ?? null,
      active: l.activation?.valeur === null || l.activation?.valeur === undefined
        ? null
        : Number(l.activation.valeur) === 1,
      origineSeuil: l.seuil?.origine || null,
      origineActivation: l.activation?.origine || null,
      sourceSeuil: 'table_versionnee',
    }
  })

  //  ⚠️ Le palier de repli est TOUJOURS présent en dernier : avant la première
  //  version connue, la règle d'entreprise s'appliquait. L'omettre faisait
  //  qu'une semaine de mai, antérieure à une version d'octobre, ne recevait
  //  AUCUNE règle — donc aucun verdict, alors qu'une règle existait.
  if (!parDate.has(null)) {
    parDate.set(null, { seuil: null, niveau2: null, activation: null })
  }

  if (parDate.has(null)) {
    const l = parDate.get(null)
    paliers.push({
      depuis: null,
      //  Aucune version « sans date » : le repli est le réglage d'entreprise.
      seuil: l.seuil?.valeur ?? repli.seuil ?? null,
      seuilMajeur: l.niveau2?.valeur ?? repli.seuilMajeur ?? null,
      active: l.activation?.valeur === null || l.activation?.valeur === undefined
        ? null
        : Number(l.activation.valeur) === 1,
      origineSeuil: l.seuil?.origine || null,
      origineActivation: l.activation?.origine || null,
      sourceSeuil: 'table_versionnee',
    })
  }

  return paliers
}

/**
 * Répartit des semaines (sortie d'`agregerParSemaine`) en tranches homogènes :
 * toutes les semaines consécutives qui partagent le MÊME palier.
 *
 * `evaluerSeuilsHebdo` reçoit ensuite chaque tranche avec son propre seuil.
 * Une semaine n'est jamais coupée en deux : son lundi décide.
 *
 * @returns {Array} [{ palier, semaines }]
 */
export function regrouperParPalier(semaines, paliers) {
  const tranches = []
  for (const sem of semaines || []) {
    const lundi = lundiDeLaSemaine(sem.debut)
    const palier = choisirPalier(paliers, lundi)
    const derniere = tranches[tranches.length - 1]
    //  Même palier que la semaine précédente : on continue la tranche.
    if (derniere && memePalier(derniere.palier, palier)) {
      derniere.semaines.push(sem)
    } else {
      tranches.push({ palier, semaines: [sem] })
    }
  }
  return tranches
}

function memePalier(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return a.seuil === b.seuil
    && a.seuilMajeur === b.seuilMajeur
    && a.active === b.active
    && a.sourceSeuil === b.sourceSeuil
    && a.origineSeuil === b.origineSeuil
}

export default {
  lundiDeLaSemaine,
  lundiSuivant,
  choisirPalier,
  construirePaliers,
  regrouperParPalier,
}
