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
 * Les jours d'un mois, du 1er au dernier.
 * weekday suit la convention française : 1 = lundi … 7 = dimanche.
 */
export function joursDuMois(annee, mois) {
  const total = dernierJourDuMois(annee, mois)
  const jours = []
  for (let d = 1; d <= total; d += 1) {
    const date = new Date(annee, mois, d)
    const jsDay = date.getDay() // 0 = dimanche
    jours.push({
      jour: d,
      iso: isoLocal(date),
      date,
      weekday: jsDay === 0 ? 7 : jsDay,
      weekend: jsDay === 0 || jsDay === 6,
    })
  }
  return jours
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
 * Empile les segments qui se chevauchent sur plusieurs rangées,
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
