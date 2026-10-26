// ═══════════════════════════════════════════════════════════
// 📅 LES MODÈLES DE JOURS FÉRIÉS, PAYS PAR PAYS
//
// Un modèle sert à ne pas retaper douze fêtes à la main quand on
// ouvre un pays. Il ne DEVINE rien — c'est la doctrine de la
// maison, et elle compte double ici : une date fériée fausse
// fabrique une absence, un retard ou une heure sup qui n'existent
// pas.
//
// Quatre natures, quatre traitements :
//
//   fixe     même jour, même mois, chaque année
//            → enregistré comme récurrent
//   regle    calculable par une règle de calendrier
//            (2e vendredi de janvier, et la veille)
//            → calculé pour l'année demandée
//   mobile   accroché à Pâques (lundi de Pâques, Ascension,
//            Pentecôte) → calculé par le comput ecclésiastique
//   lunaire  Korité, Tabaski, Maouloud : la date est annoncée
//            chaque année après observation de la lune
//            → JAMAIS calculé, seulement nommé pour mémoire
//
// Bénin : loi 90-019 du 1er août 1990, modifiée par la loi
// 2024-32 pour la fête des religions traditionnelles (deuxième
// vendredi de janvier, et le jeudi qui précède).
// ═══════════════════════════════════════════════════════════

const JOUR = 24 * 60 * 60 * 1000

/** Pâques, comput grégorien (Meeus / Jones / Butcher). */
export function paques(annee) {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(annee, mois - 1, jour))
}

/** Le deuxième vendredi de janvier — la fête des religions traditionnelles. */
export function deuxiemeVendrediDeJanvier(annee) {
  let vus = 0
  for (let jour = 1; jour <= 14; jour += 1) {
    const date = new Date(Date.UTC(annee, 0, jour))
    if (date.getUTCDay() === 5) {
      vus += 1
      if (vus === 2) return date
    }
  }
  return null
}

const iso = (date) => date.toISOString().slice(0, 10)
const decaler = (date, jours) => new Date(date.getTime() + jours * JOUR)

// ── LE CATALOGUE ───────────────────────────────────────────

export const MODELES_FERIES = {
  BJ: {
    code: 'BJ',
    nom: 'Bénin',
    source: 'Loi 90-019 du 1er août 1990, modifiée par la loi 2024-32',
    fixes: [
      { nom: 'Fête du Nouvel An', jourMois: '01-01' },
      { nom: 'Fête du Travail', jourMois: '05-01' },
      { nom: 'Fête Nationale', jourMois: '08-01' },
      { nom: 'Assomption', jourMois: '08-15' },
      { nom: 'Toussaint', jourMois: '11-01' },
      { nom: 'Noël', jourMois: '12-25' },
    ],
    regles: [
      {
        nom: 'Fête annuelle des religions traditionnelles',
        note: 'Deuxième vendredi de janvier',
        calculer: (annee) => deuxiemeVendrediDeJanvier(annee),
      },
      {
        nom: 'Veille de la fête des religions traditionnelles',
        note: 'Le jeudi qui précède',
        calculer: (annee) => {
          const vendredi = deuxiemeVendrediDeJanvier(annee)
          return vendredi ? decaler(vendredi, -1) : null
        },
      },
    ],
    mobiles: [
      { nom: 'Lundi de Pâques', decalage: 1 },
      { nom: 'Ascension', decalage: 39 },
      { nom: 'Lundi de Pentecôte', decalage: 50 },
    ],
    //  nommées pour mémoire, jamais datées par nous
    lunaires: [
      { nom: 'Korité', note: 'Fin du Ramadan' },
      { nom: 'Tabaski', note: 'Fête du sacrifice' },
      { nom: 'Maouloud', note: 'Anniversaire du Prophète' },
    ],
  },
}

/** Le modèle d'un pays, ou null s'il n'y en a pas. */
export function modeleFeries(code) {
  if (!code) return null
  return MODELES_FERIES[String(code).toUpperCase()] || null
}

/** Les pays qui ont un modèle — pour les proposer dans la page. */
export function paysAvecModele() {
  return Object.values(MODELES_FERIES)
}

/**
 * Les fêtes que le modèle sait dater pour une année donnée.
 *
 * @returns {Array<{ nom, date, recurrent, nature, note }>}
 */
export function feriesDuModele(modele, annee) {
  if (!modele) return []

  const fermes = modele.fixes.map(({ nom, jourMois }) => ({
    nom,
    date: `${annee}-${jourMois}`,
    recurrent: true,
    nature: 'fixe',
    note: `Chaque année le ${jourMois.slice(3)}/${jourMois.slice(0, 2)}`,
  }))

  const parRegle = modele.regles
    .map(({ nom, note, calculer }) => {
      const date = calculer(annee)
      return date ? { nom, date: iso(date), recurrent: false, nature: 'regle', note } : null
    })
    .filter(Boolean)

  const pasques = paques(annee)
  const mobiles = modele.mobiles.map(({ nom, decalage }) => ({
    nom,
    date: iso(decaler(pasques, decalage)),
    recurrent: false,
    nature: 'mobile',
    note: 'Date liée à Pâques',
  }))

  return [...fermes, ...parRegle, ...mobiles].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Ce qu'il reste à créer : on ne redouble jamais une fête déjà là.
 *
 * Une fête fixe est « déjà là » si une récurrente porte le même jour et
 * le même mois, ou si une fête tombe pile à cette date. Une fête calculée
 * n'est « déjà là » que si la date exacte existe.
 */
export function feriesAAjouter(modele, annee, existants = []) {
  const valides = (existants || []).filter(Boolean)

  const dejaDate = (date) => valides.some(h => String(h.date || '').slice(0, 10) === date)
  const dejaRecurrent = (jourMois) =>
    valides.some(h => h.is_recurring && String(h.date || '').slice(5, 10) === jourMois)

  const proposes = feriesDuModele(modele, annee)

  const aCreer = []
  const dejaPresents = []

  for (const ferie of proposes) {
    const present = ferie.recurrent
      ? dejaRecurrent(ferie.date.slice(5)) || dejaDate(ferie.date)
      : dejaDate(ferie.date)

    if (present) dejaPresents.push(ferie)
    else aCreer.push(ferie)
  }

  return {
    aCreer,
    dejaPresents,
    nonCalculables: modele?.lunaires || [],
    annee,
  }
}

export default MODELES_FERIES
