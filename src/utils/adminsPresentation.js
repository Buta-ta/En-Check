// ═══════════════════════════════════════════════════════════
// 👤 COMPTES & ACCÈS — RÈGLES DE PRÉSENTATION
//
// Fonctions pures : elles décident COMMENT lire une donnée,
// jamais comment la chercher. Isolées ici pour être testables
// sans navigateur, et pour que la page reste un composant.
// ═══════════════════════════════════════════════════════════

export const ROLES = ['super_admin', 'admin', 'manager', 'viewer']

export function libelleRole(role) {
  return (
    {
      super_admin: 'Super Admin',
      admin: 'Admin',
      manager: 'Responsable',
      viewer: 'Lecture seule',
    }[role] ||
    role ||
    'Non renseigné'
  )
}

/** La famille de couleur d'un badge de rôle. */
export function tonRole(role) {
  return (
    {
      super_admin: 'or',
      admin: 'vert',
      manager: 'indigo',
      viewer: 'neutre',
    }[role] || 'neutre'
  )
}

/**
 * « Jamais », « Aujourd'hui », « Hier », « Il y a 3 j »…
 *
 * On compare des JOURS, pas des heures : à 9 h du matin, une
 * connexion d'hier 23 h ne doit pas s'afficher « aujourd'hui ».
 */
export function formaterDerniereConnexion(valeur, maintenant = new Date()) {
  if (!valeur) return 'Jamais'
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return 'Jamais'

  const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const jours = Math.round((debutJour(maintenant) - debutJour(date)) / 86400000)

  if (jours <= 0) return "Aujourd'hui"
  if (jours === 1) return 'Hier'
  if (jours < 7) return `Il y a ${jours} j`
  if (jours < 30) return `Il y a ${Math.floor(jours / 7)} sem.`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Une suite CUMULATIVE, pour la courbe des cartes.
 *
 * ⚠️ On ne dessine jamais une tendance inventée. La seule chose
 * que cette courbe affirme, c'est « il y avait N éléments à
 * cette date » — c'est vrai, et vérifiable dans les données.
 */
export function serieCumulative(elements = [], champ = 'created_at', limite = 24) {
  const dates = elements
    .map((e) => e?.[champ])
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)

  if (dates.length === 0) return [0, 0]
  if (dates.length === 1) return [0, 1]

  const pas = Math.max(1, Math.ceil(dates.length / limite))
  const serie = []
  for (let i = 0; i < dates.length; i += pas) serie.push(i + 1)
  if (serie[serie.length - 1] !== dates.length) serie.push(dates.length)
  return serie.length >= 2 ? serie : [0, dates.length]
}

/**
 * La couverture des entreprises, dans le temps : à chaque date où
 * une entreprise reçoit son PREMIER administrateur, la courbe
 * monte d'un cran. Réel, jamais simulé.
 */
export function serieCouverture(rows = []) {
  const premiers = new Map()
  rows.forEach((row) => {
    if (!row?.enterprise_id || row.role === 'super_admin') return
    const date = row.created_at ? new Date(row.created_at).getTime() : NaN
    if (Number.isNaN(date)) return
    const connu = premiers.get(row.enterprise_id)
    if (connu === undefined || date < connu) premiers.set(row.enterprise_id, date)
  })
  const dates = [...premiers.values()].sort((a, b) => a - b)
  if (dates.length === 0) return [0, 0]
  if (dates.length === 1) return [0, 1]
  const serie = []
  for (let i = 0; i < dates.length; i += 1) serie.push(i + 1)
  return serie
}

/** Combien d'entreprises distinctes ont au moins un administrateur. */
export function entreprisesCouvertes(rows = []) {
  const vues = new Set()
  rows.forEach((row) => {
    if (row?.enterprise_id && row.role !== 'super_admin') vues.add(row.enterprise_id)
  })
  return vues.size
}

/** Ce qu'un compte peut réellement faire : se connecter, ou pas. */
export function etatAcces(admin) {
  if (admin?.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    return 'verrouille'
  }
  if (!admin?.user_id) return 'non_lie'
  return 'lie'
}

export function libelleEtatAcces(etat) {
  return (
    {
      verrouille: 'Compte verrouillé',
      non_lie: 'Sans accès de connexion',
      lie: 'Accès actif',
    }[etat] || 'Accès inconnu'
  )
}

/**
 * Filtres de la page : texte, rôle et état, en plus du filtrage
 * par entreprise déjà fait par `filterAdminAccounts`.
 */
export function filtrerParRole(rows = [], role = 'tous') {
  if (!role || role === 'tous') return rows
  return rows.filter((row) => row?.role === role)
}
