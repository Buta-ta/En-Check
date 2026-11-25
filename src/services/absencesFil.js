// ═══════════════════════════════════════════════════════════
// 🧺 LE FIL — la géométrie des fiches pendues
//
// Les nombres du dessin vivent ICI, pas dans le composant : `AbsencesFil`
// rend, ce module calcule. La feuille de style, elle, pose les trois
// épaisseurs (corde, saut, anneau) et un test relit les deux côtés — la
// règle de la maison depuis la poutre (voir docs/ABSENCES-ETAGERE.md).
//
// Pourquoi la largeur se calcule en JavaScript et ne se déduit pas d'un
// `calc()` en CSS : il faut connaître la place que prend chaque fiche pour
// savoir lesquelles tiennent sur un même fil. Un trait tendu qui se replie
// tout seul ne peut pas rendre un anneau par rang — c'est le calcul qui
// fait les rangs, et la corde se pose sur chacun d'eux.
// ═══════════════════════════════════════════════════════════

export const LE_FIL = {
  base: 216,      // une fiche d'un seul jour : assez large pour un nom
  jour: 26,       // chaque jour de plus allonge le linge de là
  plafond: 420,   // trois semaines de congé ne doivent pas manger le mur
  ecart: 12,      // l'air entre deux fiches — un cran de l'échelle (D-013)
  retrait: 24,    // le bois du fil : la corde ne se claque pas contre le cadre
  cordeDefaut: 1180, // avant la première mesure (jsdom, impression, SSR)
}

/** La longueur du linge, en pixels, pour `nbJours` jours. */
export function largeurFiche(nbJours) {
  const n = Number.isFinite(Number(nbJours)) ? Math.max(1, Math.floor(Number(nbJours))) : 1
  const { base, jour, plafond } = LE_FIL
  return Math.min(plafond, base + (n - 1) * jour)
}

/**
 * Partager les fiches en rangs. La corde est un seul trait par rang — la même
 * loi que la poutre du haut de page : « le fil appartient à la fiche et non à
 * la rangée », donc un rang qui tombe à l'écran reçoit SON fil et SES
 * anneaux, sans qu'aucune media ait à repositionner quoi que ce soit.
 */
export function partagerEnRangs(fiches, largeurCorde = LE_FIL.cordeDefaut) {
  const utile = Math.max(240, largeurCorde - 2 * LE_FIL.retrait)
  const rangs = []
  let courant = []
  let occupe = 0
  for (const fiche of fiches) {
    const largeur = largeurFiche(fiche.jours)
    // une fiche seule dans son rang la garde seule, même si elle déborde :
    // `plafond` est un plafond de calcul, pas une promesse d'arithmétique
    if (courant.length && occupe + LE_FIL.ecart + largeur > utile) {
      rangs.push(courant)
      courant = []
      occupe = 0
    }
    courant.push(fiche)
    occupe += (occupe ? LE_FIL.ecart : 0) + largeur
  }
  if (courant.length) rangs.push(courant)
  return rangs
}

// « 25 → 29 nov. » — et si le congé change de mois, le mois se dit deux
// fois. Un display, pas un calcul : les dates viennent de la demande.
const jourDe = (iso) => Number(String(iso || '').slice(8, 10))

const moisDe = (iso) => {
  const m = Number(String(iso || '').slice(5, 7))
  if (!Number.isFinite(m) || m < 1 || m > 12) return ''
  return new Date(Date.UTC(2024, m - 1, 1))
    .toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

/** La période écrite sur la fiche, en français, sans année (le fil est un mois). */
export function periodeFiche(debut, fin) {
  const d = String(debut || '').slice(0, 10)
  const f = String(fin || '').slice(0, 10)
  if (!d || !f) return '—'
  if (d === f) return `${jourDe(d)} ${moisDe(d)}`
  return d.slice(0, 7) === f.slice(0, 7)
    ? `${jourDe(d)} → ${jourDe(f)} ${moisDe(f)}`
    : `${jourDe(d)} ${moisDe(d)} → ${jourDe(f)} ${moisDe(f)}`
}

/**
 * Les trois nombres d'une fiche, et où chacun se lit.
 *
 * • `span`    — la période, en jours calendaires : c'est la LONGUEUR DU LINGE.
 * • `ouvr`    — ce qui, de cette période, tombe un jour ouvré : c'est LE TRAIT.
 * • `comptes` — ce que la demande décompte du solde : c'est LE NOMBRE ÉCRIT.
 *
 * Les trois viennent du même service (`compterJoursOuvres`) et de rien d'autre :
 * `span` est le compte quand aucun férié ne compte comme chômage, `ouvr` le compte
 * ouvrable, et `comptes` suit la loi de la maison — le champ écrit sur la ligne
 * passe avant, sinon on reprend le compte que la règle de l'absence désigne.
 *
 * La règle des ABSENCES, elle, est déjà écrite dans `stats` de la page (la poutre
 * l'affiche sous verrou) : les deux objets n'ont pas les mêmes champs, et déplacer
 * un chiffre déjà affiché pour le rendre commun serait un deuxième calcul pendant
 * un temps, pas une unification.
 */
export function mesuresFiche(demande, { calendaires = 0, ouvres = 0 } = {}) {
  const span = Math.max(1, Math.floor(Number(calendaires)) || 1)
  const ouvr = Math.max(0, Math.min(Math.floor(Number(ouvres)) || 0, span))
  const declare = Number(demande?.days_count ?? demande?.working_days)
  const comptes = Number.isFinite(declare) && declare > 0
    ? Math.floor(declare)
    : (demande?.count_holidays_as_leave ? span : ouvr)
  return { span, ouvr, comptes: Math.max(1, comptes) }
}
