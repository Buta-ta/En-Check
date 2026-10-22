// ═══════════════════════════════════════════════════════════
// 📐 CALENDRIER MENSUEL DES ABSENCES — CALCULS PURS
//
// Aucune dépendance à React ni à Supabase : tout est testable
// unitairement. Le composant ne fait que dessiner ce qui sort d'ici.
// ═══════════════════════════════════════════════════════════

export const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const pad = (n) => String(n).padStart(2, '0')

/** '2025-04-14' → { y: 2025, m: 3, d: 14 } (m est 0-based, comme Date) */
export function parseIso(iso) {
  if (typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) }
}

/** Date → 'YYYY-MM-DD' en heure LOCALE (pas d'UTC, sinon décalage d'un jour) */
export function isoLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Comparaison de deux { y, m, d } : -1, 0 ou 1 */
function comparer(a, b) {
  const na = a.y * 10000 + (a.m + 1) * 100 + a.d
  const nb = b.y * 10000 + (b.m + 1) * 100 + b.d
  return na < nb ? -1 : na > nb ? 1 : 0
}

export function dernierJourDuMois(annee, mois) {
  return new Date(annee, mois + 1, 0).getDate()
}

/**
 * Un jour décrit pour l'affichage.
 * weekday suit la convention française : 1 = lundi … 7 = dimanche.
 */
function decrireJour(annee, mois, jour) {
  const date = new Date(annee, mois, jour)
  const jsDay = date.getDay() // 0 = dimanche
  return {
    jour,
    iso: isoLocal(date),
    date,
    weekday: jsDay === 0 ? 7 : jsDay,
    weekend: jsDay === 0 || jsDay === 6,
  }
}

/**
 * Les jours d'un mois, du 1er au dernier.
 */
export function joursDuMois(annee, mois) {
  const total = dernierJourDuMois(annee, mois)
  return Array.from({ length: total }, (_, i) => decrireJour(annee, mois, i + 1))
}

// ═══════════════════════════════════════════════════════════
// 🗓️ MODES JOUR · SEMAINE
// ═══════════════════════════════════════════════════════════

/** '2026-10-21' avancé de n jours (n peut être négatif) → '2026-10-28' */
export function ajouterJours(iso, n) {
  const p = parseIso(iso)
  if (!p) return null
  return isoLocal(new Date(p.y, p.m, p.d + n))
}

/** Lundi de la semaine contenant `iso` (ISO-8601 : la semaine commence un lundi) */
export function debutDeSemaine(iso) {
  const p = parseIso(iso)
  if (!p) return null
  const jsDay = new Date(p.y, p.m, p.d).getDay() // 0 = dimanche
  const decalage = jsDay === 0 ? -6 : 1 - jsDay
  return isoLocal(new Date(p.y, p.m, p.d + decalage))
}

/** Les 7 jours (lundi → dimanche) de la semaine contenant `iso` */
export function joursDeLaSemaine(iso) {
  const lundi = debutDeSemaine(iso)
  const p = parseIso(lundi)
  if (!p) return []
  return Array.from({ length: 7 }, (_, i) => decrireJour(p.y, p.m, p.d + i))
}

/** Un seul jour : le mode « jour » du calendrier */
export function jourUnique(iso) {
  const p = parseIso(iso)
  if (!p) return []
  return [decrireJour(p.y, p.m, p.d)]
}

/** Période affichée selon le mode : 'mois' | 'semaine' | 'jour' */
export function joursDeLaPeriode(mode, { annee, mois, jourIso }) {
  if (mode === 'semaine') return joursDeLaSemaine(jourIso)
  if (mode === 'jour') return jourUnique(jourIso)
  return joursDuMois(annee, mois)
}

/**
 * De combien de mois faut-il déplacer le calendrier pour atteindre `isoCible`
 * depuis le mois affiché ? Sert à « aller à une date » : le calendrier ne sait
 * avancer que par crans de mois, on traduit donc la date choisie en écart.
 */
export function ecartEnMois(annee, mois, isoCible) {
  const cible = parseIso(isoCible)
  if (!cible) return 0
  return (cible.y - annee) * 12 + (cible.m - mois)
}

/** La même date, une autre année (le 29 février retombe au 1er mars si besoin) */
export function memeJourAutreAnnee(iso, deltaAnnees) {
  const p = parseIso(iso)
  if (!p) return null
  const d = new Date(p.y + deltaAnnees, p.m, p.d)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Déplace la période d'un cran : ±1 mois, ±1 semaine ou ±1 jour */
export function deplacerPeriode(mode, { annee, mois, jourIso }, delta) {
  if (mode === 'jour') return { annee, mois, jourIso: ajouterJours(jourIso, delta) }
  if (mode === 'semaine') return { annee, mois, jourIso: ajouterJours(jourIso, 7 * delta) }
  const date = new Date(annee, mois + delta, 1)
  return { annee: date.getFullYear(), mois: date.getMonth(), jourIso }
}

/** '2026-10-21T00:00:00Z' → '2026-10-21' (les dates Supabase sont horodatées) */
export function jourIso(valeur) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(valeur || ''))
  return m ? m[1] : null
}

export function nomMois(annee, mois) {
  return `${MOIS_FR[mois] || ''} ${annee}`.trim()
}

/** '2025-04-14' → '14/04/2025' (sans passer par l'UTC) */
export function formaterDateCourt(iso) {
  const p = parseIso(iso)
  if (!p) return '—'
  return `${pad(p.d)}/${pad(p.m + 1)}/${p.y}`
}

/** '2025-04-14T10:32:00Z' → '14/04/2025 à 10:32' */
export function formaterHorodatage(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Un jour est ouvré s'il n'est ni samedi, ni dimanche, ni férié. */
export function estJourOuvre(iso, feriers = new Set()) {
  const p = parseIso(iso)
  if (!p) return false
  const jsDay = new Date(p.y, p.m, p.d).getDay()
  if (jsDay === 0 || jsDay === 6) return false
  return !feriers.has(iso)
}

/**
 * Nombre de jours comptés entre deux dates (bornes incluses).
 * • countHolidaysAsLeave = true  → tous les jours calendaires
 * • sinon                        → jours ouvrés (hors week-ends et fériés)
 * Renvoie 0 si la période est invalide ou inversée.
 */
export function compterJoursOuvres(startIso, endIso, feriers = new Set(), countHolidaysAsLeave = false) {
  const debut = parseIso(startIso)
  const fin = parseIso(endIso)
  if (!debut || !fin || comparer(debut, fin) > 0) return 0

  let total = 0
  let curseur = new Date(debut.y, debut.m, debut.d)
  const limite = new Date(fin.y, fin.m, fin.d)
  const garde = 4000 // ~10 ans : garde-fou anti-boucle infinie

  for (let i = 0; i < garde; i += 1) {
    const iso = isoLocal(curseur)
    if (countHolidaysAsLeave || estJourOuvre(iso, feriers)) total += 1
    if (isoLocal(curseur) === isoLocal(limite)) break
    curseur = new Date(curseur.getFullYear(), curseur.getMonth(), curseur.getDate() + 1)
  }
  return total
}

/**
 * Position d'une absence à l'intérieur d'un mois donné.
 * Renvoie null si l'absence ne croise pas ce mois.
 * Les drapeaux coupeeAvant / coupeeApres permettent d'afficher une
 * flèche : la barre continue sur le mois précédent ou suivant.
 */
export function segmentDuMois(startIso, endIso, annee, mois) {
  const debut = parseIso(startIso)
  const fin = parseIso(endIso)
  if (!debut || !fin) return null

  const premier = { y: annee, m: mois, d: 1 }
  const dernier = { y: annee, m: mois, d: dernierJourDuMois(annee, mois) }

  if (comparer(fin, premier) < 0) return null
  if (comparer(debut, dernier) > 0) return null

  const coupeeAvant = comparer(debut, premier) < 0
  const coupeeApres = comparer(fin, dernier) > 0

  return {
    debut: coupeeAvant ? 1 : debut.d,
    fin: coupeeApres ? dernier.d : fin.d,
    coupeeAvant,
    coupeeApres,
  }
}

/**
 * Position d'une absence à l'intérieur d'une LISTE DE JOURS quelconque
 * (un mois, une semaine, un seul jour). Mode mois, semaine et jour
 * partagent donc exactement le même calcul.
 *
 * Renvoie null si l'absence ne croise pas la période.
 * `debut` et `fin` sont des INDEX 0-based dans la liste.
 */
export function segmentSurJours(startIso, endIso, jours = []) {
  if (!jours.length) return null
  const debut = jourIso(startIso)
  const fin = jourIso(endIso)
  if (!debut || !fin || debut > fin) return null

  const premier = jours[0].iso
  const dernier = jours[jours.length - 1].iso
  if (fin < premier || debut > dernier) return null

  const coupeeAvant = debut < premier
  const coupeeApres = fin > dernier

  const iDebut = coupeeAvant ? 0 : Math.max(0, jours.findIndex((j) => j.iso >= debut))
  let iFin = jours.length - 1
  if (!coupeeApres) {
    for (let i = jours.length - 1; i >= 0; i -= 1) {
      if (jours[i].iso <= fin) { iFin = i; break }
    }
  }
  if (iFin < iDebut) return null

  return { debut: iDebut, fin: iFin, coupeeAvant, coupeeApres }
}

/** Empile les segments qui se chevauchent sur plusieurs rangées,
 * pour qu'aucune barre n'en recouvre une autre.
 * Chaque segment reçoit `rangee` (0-based) et `rangeesTotal`.
 */
export function empilerSegments(segments = []) {
  const tries = [...segments].sort((a, b) => a.debut - b.debut || a.fin - b.fin)
  const finParRangee = []

  const empiles = tries.map((seg) => {
    let rangee = finParRangee.findIndex((fin) => fin < seg.debut)
    if (rangee === -1) {
      rangee = finParRangee.length
      finParRangee.push(seg.fin)
    } else {
      finParRangee[rangee] = seg.fin
    }
    return { ...seg, rangee }
  })

  const rangeesTotal = finParRangee.length
  return empiles.map((seg) => ({ ...seg, rangeesTotal }))
}

// ═══════════════════════════════════════════════════════════
// 🏷️ LIBELLÉS DES PÉRIODES
// ═══════════════════════════════════════════════════════════

export const JOURS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** '2026-10-21' → 'mercredi 21 octobre 2026' */
export function nomJourLong(iso) {
  const p = parseIso(iso)
  if (!p) return '—'
  const jour = JOURS_LONG[new Date(p.y, p.m, p.d).getDay() === 0 ? 6 : new Date(p.y, p.m, p.d).getDay() - 1]
  return `${jour} ${p.d} ${MOIS_COURT[p.m]} ${p.y}`
}

/** '2026-10-21' → 'mer. 21' */
export function nomJourCourt(iso) {
  const p = parseIso(iso)
  if (!p) return '—'
  const jour = JOURS_LONG[new Date(p.y, p.m, p.d).getDay() === 0 ? 6 : new Date(p.y, p.m, p.d).getDay() - 1]
  return `${jour.slice(0, 3).toLowerCase()}. ${p.d}`
}

/** Titre de la période affichée selon le mode */
export function titrePeriode(mode, jours, { annee, mois }) {
  if (mode === 'mois') return nomMois(annee, mois)
  if (!jours.length) return '—'
  if (mode === 'jour') return nomJourLong(jours[0].iso)
  if (mode === 'semaine') {
    const p1 = parseIso(jours[0].iso)
    const p2 = parseIso(jours[jours.length - 1].iso)
    if (!p1 || !p2) return '—'
    const memeMois = p1.m === p2.m && p1.y === p2.y
    const debut = `${p1.d}${memeMois ? '' : ` ${MOIS_COURT[p1.m]}`}`
    const fin = `${p2.d} ${MOIS_COURT[p2.m]} ${p2.y}`
    return `Semaine du ${debut} au ${fin}`
  }
  return nomMois(annee, mois)
}
