// ═══════════════════════════════════════════════════════════
// MESSAGES SYSTÈME — ce que la page lit, sans dessin ni base
//
// Trois choses vivent sur cette page :
//   · les annonces (`messages_systeme`), affichées dans le bandeau
//     du tableau de bord pendant leur fenêtre de dates ;
//   · les notifications push (`push_logs`), envoyées aux téléphones ;
//   · les courriels (`encheck_email_logs`), surveillés par le
//     moniteur déjà en place.
//
// Ce fichier met ces trois sources en mots et en nombres. Il est
// pur : on peut le relire et le tester sans monter la page.
// ═══════════════════════════════════════════════════════════

export const MOT_CONFIRMATION = 'EFFACER'

export const TYPES_ANNONCE = [
  { cle: 'info', libelle: 'Information' },
  { cle: 'maintenance', libelle: 'Maintenance' },
  { cle: 'mise_a_jour', libelle: 'Mise à jour' },
]

export const PRIORITES = [
  { cle: 'basse', libelle: 'Basse' },
  { cle: 'normale', libelle: 'Normale' },
  { cle: 'haute', libelle: 'Haute' },
]

export const CIBLES = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'admins', libelle: 'Admins' },
  { cle: 'employes', libelle: 'Employés' },
]

export const GRAVITES = [
  { cle: 'info', libelle: 'Info' },
  { cle: 'warning', libelle: 'Alerte' },
  { cle: 'critical', libelle: 'Critique' },
]

export const CIBLES_ENVOI = [
  { cle: 'all', libelle: 'Tous (admins et employés)' },
  { cle: 'admins', libelle: 'Tous les admins' },
  { cle: 'employees', libelle: 'Tous les employés' },
  { cle: 'enterprise', libelle: 'Une entreprise' },
  { cle: 'admin', libelle: 'Un admin' },
  { cle: 'employee', libelle: 'Un employé' },
]

export const PERIODES = [
  { jours: 7, libelle: '7 jours' },
  { jours: 30, libelle: '30 jours' },
  { jours: 90, libelle: '90 jours' },
]

const nomDe = (liste, cle, defaut) => liste.find((item) => item.cle === cle)?.libelle || defaut

export function libelleType(type) {
  return nomDe(TYPES_ANNONCE, type, 'Information')
}

export function libellePriorite(priorite) {
  return nomDe(PRIORITES, priorite, 'Normale')
}

export function libelleCible(cible) {
  return nomDe(CIBLES, cible, 'Tous')
}

export function libelleGravite(gravite) {
  return nomDe(GRAVITES, gravite, 'Info')
}

export function libelleCibleEnvoi(cible, nombre = null) {
  const base = nomDe(CIBLES_ENVOI, cible, 'Tous')
  return nombre ? `${base} · ${nombre}` : base
}

// ── la fenêtre d'affichage d'une annonce ──────────────────
export function estDansFenetre(debut, fin, maintenant = new Date()) {
  const commencement = debut ? new Date(debut) : null
  const terme = fin ? new Date(fin) : null
  if (commencement && !isNaN(commencement.getTime()) && maintenant < commencement) return false
  if (terme && !isNaN(terme.getTime()) && maintenant > terme) return false
  return true
}

export function etatAnnonce(annonce, maintenant = new Date()) {
  if (!annonce) return 'inconnue'
  if (annonce.is_active === false) return 'coupee'
  const debut = annonce.date_debut ? new Date(annonce.date_debut) : null
  const fin = annonce.date_fin ? new Date(annonce.date_fin) : null
  if (debut && !isNaN(debut.getTime()) && maintenant < debut) return 'a_venir'
  if (fin && !isNaN(fin.getTime()) && maintenant > fin) return 'terminee'
  return 'active'
}

export const LIBELLE_ETAT = {
  active: 'À l’écran',
  a_venir: 'À venir',
  terminee: 'Terminée',
  coupee: 'Coupée',
  inconnue: 'Inconnue',
}

export function annonceActive(annonce, maintenant = new Date()) {
  return etatAnnonce(annonce, maintenant) === 'active'
}

export function compterAnnonces(annonces = [], maintenant = new Date()) {
  const compte = { total: annonces.length, actives: 0, aVenir: 0, terminees: 0, coupees: 0, hautes: 0 }
  annonces.forEach((annonce) => {
    const etat = etatAnnonce(annonce, maintenant)
    if (etat === 'active') compte.actives += 1
    if (etat === 'a_venir') compte.aVenir += 1
    if (etat === 'terminee') compte.terminees += 1
    if (etat === 'coupee') compte.coupees += 1
    if (annonce.priorite === 'haute') compte.hautes += 1
  })
  return compte
}

export function trierAnnonces(annonces = []) {
  const rang = { haute: 0, normale: 1, basse: 2 }
  return [...annonces].sort((a, b) => {
    const etat = { active: 0, a_venir: 1, terminee: 2, coupee: 3 }
    const difference = (etat[etatAnnonce(a)] ?? 4) - (etat[etatAnnonce(b)] ?? 4)
    if (difference !== 0) return difference
    const priorite = (rang[a.priorite] ?? 1) - (rang[b.priorite] ?? 1)
    if (priorite !== 0) return priorite
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })
}

// ── les dates, en français court ──────────────────────────
export function dateHeure(valeur) {
  if (!valeur) return '—'
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function dateCourte(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function tempsRelatif(valeur, maintenant = new Date()) {
  if (!valeur) return '—'
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return '—'
  const minutes = Math.floor((maintenant - date) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.floor(heures / 24)
  if (jours < 7) return `il y a ${jours} j`
  return dateCourte(date)
}

export function plageAnnonce(annonce) {
  const debut = annonce?.date_debut ? dateHeure(annonce.date_debut) : null
  const fin = annonce?.date_fin ? dateHeure(annonce.date_fin) : null
  if (!debut && !fin) return 'Sans limite de dates'
  if (debut && !fin) return `Depuis le ${debut}`
  if (!debut && fin) return `Jusqu’au ${fin}`
  return `${debut} → ${fin}`
}

// ── les envois push ───────────────────────────────────────
export function graviteDe(log) {
  const gravite = log?.payload?.severity
  return GRAVITES.some((item) => item.cle === gravite) ? gravite : 'info'
}

export function cibleDe(log) {
  const cible = log?.target_type
  return cible === 'all' ? 'broadcast' : (cible || 'broadcast')
}

export function libelleCibleLog(log) {
  const cible = cibleDe(log)
  if (cible === 'broadcast') return 'Diffusion générale'
  if (cible === 'admins') return 'Admins'
  if (cible === 'employees') return 'Employés'
  if (cible === 'enterprise') return 'Entreprise'
  return 'Destinataire individuel'
}

export function filtrerEnvois(logs = [], { gravite = 'all', cible = 'all' } = {}) {
  return logs.filter((log) => {
    if (gravite !== 'all' && graviteDe(log) !== gravite) return false
    if (cible !== 'all' && cibleDe(log) !== cible) return false
    return true
  })
}

export function resumeEnvois(logs = [], maintenant = new Date()) {
  const total = logs.length
  const envoyes = logs.reduce((somme, log) => somme + (Number(log.success_count) || 0), 0)
  const echecs = logs.reduce((somme, log) => somme + (Number(log.failed_count) || 0), 0)
  const aujourdhui = logs.filter((log) => {
    if (!log.created_at) return false
    const date = new Date(log.created_at)
    if (isNaN(date.getTime())) return false
    return date.toDateString() === maintenant.toDateString()
  }).length
  const taux = envoyes + echecs > 0 ? Math.round((envoyes / (envoyes + echecs)) * 100) : 0
  const parGravite = { info: 0, warning: 0, critical: 0 }
  logs.forEach((log) => { parGravite[graviteDe(log)] += 1 })
  return { total, envoyes, echecs, aujourdhui, taux, parGravite }
}

export function partPourcent(valeur, total) {
  if (!total || total <= 0) return 0
  return Math.round((valeur / total) * 100)
}

// ── le CSV de l'historique ────────────────────────────────
export const ENTETES_CSV = [
  'Quand', 'Titre', 'Message', 'Gravité', 'Destinataires', 'Envoyés', 'Échecs',
]

export function lignesCSV(logs = []) {
  return logs.map((log) => [
    dateHeure(log.created_at),
    log.title || '',
    log.body || '',
    libelleGravite(graviteDe(log)),
    libelleCibleLog(log),
    log.success_count ?? 0,
    log.failed_count ?? 0,
  ])
}

export function construireCSV(logs = []) {
  return [ENTETES_CSV, ...lignesCSV(logs)]
    .map((ligne) => ligne.map((cellule) => `"${String(cellule).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

// ── les courriels, lus comme le moniteur les lit ──────────
// ── la confirmation de suppression ────────────────────────
export function confirmationValide(valeur) {
  return String(valeur || '').trim().toUpperCase() === MOT_CONFIRMATION
}

// ── ce qu'un envoi va toucher, dit avant l'envoi ──────────
export function resumeDestinataires({ cible, entreprise, personnes = 0, admins = [], employes = [] }) {
  if (cible === 'all') return `${admins.length + employes.length} personnes (admins et employés)`
  if (cible === 'admins') return `${admins.length} administrateurs`
  if (cible === 'employees') return `${employes.length} employés`
  if (cible === 'enterprise') return entreprise ? `Les abonnés de ${entreprise}` : 'Choisissez une entreprise'
  if (cible === 'admin') return personnes === 1 ? 'Un administrateur choisi' : 'Choisissez un administrateur'
  if (cible === 'employee') return personnes === 1 ? 'Un employé choisi' : 'Choisissez un employé'
  return 'Destinataires à préciser'
}

export function nomPersonne(personne) {
  const complet = `${personne?.first_name || ''} ${personne?.last_name || ''}`.trim()
  return complet || personne?.email || 'Sans nom'
}
