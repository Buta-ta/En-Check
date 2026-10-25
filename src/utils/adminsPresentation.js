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
/**
 * Les créations, mois par mois, sur les douze derniers mois.
 * Vraies données : aucune bosse n'est inventée.
 */
export function serieMensuelle(rows = [], filtre = () => true, periode = new Date()) {
  const series = Array.from({ length: 12 }, () => 0)
  const index = new Map()
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(periode.getFullYear(), periode.getMonth() - i, 1)
    index.set(`${d.getFullYear()}-${d.getMonth()}`, 11 - i)
  }
  ;(rows || []).filter(filtre).forEach((row) => {
    if (!row?.created_at) return
    const d = new Date(row.created_at)
    if (Number.isNaN(d.getTime())) return
    const creneau = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (creneau !== undefined) series[creneau] += 1
  })
  return series
}

/** Le cumul des mois : une courbe qui monte, jamais un pic isolé. */
export function cumuler(serie = []) {
  let total = 0
  return serie.map((valeur) => {
    total += valeur
    return total
  })
}

/** Identifiants attribués, sans confondre ce résumé avec une autorisation serveur. */
export function entreprisesDuCompte(row) {
  return [...new Set([
    row?.enterprise_id,
    ...(row?.admin_entreprises || []).filter(link => link.is_active).map(link => link.enterprise_id),
  ].filter(Boolean))]
}

/** Combien d'entreprises distinctes ont au moins un administrateur. */
export function entreprisesCouvertes(rows = []) {
  const vues = new Set()
  rows.forEach((row) => {
    if (row?.role !== 'super_admin') entreprisesDuCompte(row).forEach(id => vues.add(id))
  })
  return vues.size
}

/** Ce qu'un compte peut réellement faire : se connecter, ou pas. */
export function etatAcces(admin) {
  if (admin?.is_active === false) return 'inactif'
  if (admin?.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    return 'verrouille'
  }
  if (!admin?.user_id) return 'non_lie'
  return 'lie'
}

export function libelleEtatAcces(etat) {
  return (
    {
      inactif: 'Compte désactivé',
      verrouille: 'Compte verrouillé',
      non_lie: 'Sans accès de connexion',
      lie: 'Accès actif',
    }[etat] || 'Accès inconnu'
  )
}

/**
 * Un sur-titre de colonne ou de champ : « Administrateur » → « ADMINISTRATEUR ».
 * Les en-têtes de la maquette sont tous en capitales espacées.
 */
/**
 * Filtres de la page : texte, rôle et état, en plus du filtrage
 * par entreprise déjà fait par `filterAdminAccounts`.
 */
export function filtrerParRole(rows = [], role = 'tous') {
  if (!role || role === 'tous') return rows
  return rows.filter((row) => row?.role === role)
}
