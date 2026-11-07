// ═══════════════════════════════════════════════════════════
// 🧭 CE QUI SE LIT DANS LES TRACES — sans base, sans dessin
//
// Trois sources alimentent la page Analytics du site : le journal
// des connexions (`connection_logs`), la carte (les mêmes traces,
// mais géolocalisées) et les visites de la page d'accueil
// (`landing_page_visits`).
//
// Ce fichier ne va pas chercher les données : il les met en mots
// et en nombres. Il est pur — on peut le relire et le tester sans
// monter une page ni toucher au réseau.
// ═══════════════════════════════════════════════════════════

export const APPAREILS = [
  { cle: 'desktop', libelle: 'Bureau' },
  { cle: 'mobile', libelle: 'Mobile' },
  { cle: 'tablet', libelle: 'Tablette' },
]

export const SECTIONS_SITE = {
  hero: 'Accueil',
  features: 'Fonctionnalités',
  demo: 'Démonstration',
  how: 'Comment ça marche',
  pricing: 'Tarifs',
  contact: 'Contact',
}

export function libelleAppareil(type) {
  return APPAREILS.find((a) => a.cle === type)?.libelle || 'Inconnu'
}

export function libelleSection(cle) {
  return SECTIONS_SITE[cle] || cle || 'Section inconnue'
}

// ── le nom d'une personne, tel qu'il doit s'écrire ────────
export function nomUtilisateur(trace) {
  if (!trace) return 'Inconnu'
  const personne = trace.user_type === 'admin' ? trace.admins : trace.employees
  const complet = `${personne?.first_name || ''} ${personne?.last_name || ''}`.trim()
  if (complet) return complet
  return trace.user_type === 'admin' ? 'Administrateur' : 'Employé'
}

export function qualiteUtilisateur(trace) {
  return trace?.user_type === 'admin' ? 'administrateur' : 'employé'
}

export function identiteUtilisateur(trace) {
  if (!trace) return ''
  return trace.user_type === 'admin'
    ? (trace.admins?.email || '')
    : (trace.employees?.matricule || trace.employees?.email || '')
}

export function entrepriseDe(trace) {
  return trace?.enterprises?.name || ''
}

// ── l'état et le taux ─────────────────────────────────────
export function estReussie(trace) {
  return trace?.success !== false
}

export function tauxReussite(traces = []) {
  if (traces.length === 0) return 0
  const reussies = traces.filter(estReussie).length
  return Math.round((reussies / traces.length) * 100)
}

export function partPourcent(valeur, total) {
  if (!total || total <= 0) return 0
  return Math.round((valeur / total) * 100)
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

export function dateJour(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── « il y a 4 min », lu sans dépendre de l'horloge du serveur ──
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
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── une durée en secondes, lisible ────────────────────────
export function dureeLisible(secondes) {
  const valeur = Math.max(Math.round(Number(secondes) || 0), 0)
  if (valeur < 60) return `${valeur} s`
  const minutes = Math.floor(valeur / 60)
  const reste = valeur % 60
  if (minutes < 60) return `${minutes} min ${String(reste).padStart(2, '0')}`
  const heures = Math.floor(minutes / 60)
  return `${heures} h ${String(minutes % 60).padStart(2, '0')}`
}

// ── les visites rangées par jour, sans trou ni doublon ────
export function visitesParJour(visites = [], jours = 14, maintenant = new Date()) {
  const compte = {}
  visites.forEach((visite) => {
    if (!visite?.created_at) return
    const jour = String(visite.created_at).slice(0, 10)
    compte[jour] = (compte[jour] || 0) + 1
  })

  const serie = []
  for (let decalage = jours - 1; decalage >= 0; decalage -= 1) {
    const date = new Date(maintenant)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - decalage)
    const cle = date.toISOString().slice(0, 10)
    serie.push({ jour: cle, libelle: dateJour(date), nombre: compte[cle] || 0 })
  }
  return serie
}

export function maximumDe(serie = []) {
  return serie.reduce((plus, item) => Math.max(plus, item.nombre || 0), 0)
}

// ── les lieux, regroupés au millième de degré ─────────────
export function resumeDesLieux(connexions = []) {
  const lieux = {}
  connexions.forEach((connexion) => {
    if (connexion?.latitude == null || connexion?.longitude == null) return
    const cle = `${Number(connexion.latitude).toFixed(3)}_${Number(connexion.longitude).toFixed(3)}`
    lieux[cle] = (lieux[cle] || 0) + 1
  })
  const valeurs = Object.values(lieux)
  return {
    lieuxDistincts: valeurs.length,
    lieuxSuperposes: valeurs.filter((nombre) => nombre > 1).length,
    empilementMax: valeurs.reduce((plus, nombre) => Math.max(plus, nombre), 0),
  }
}

export function centreDe(connexions = []) {
  const valables = connexions.filter((c) => c?.latitude != null && c?.longitude != null)
  if (valables.length === 0) return null
  const latitude = valables.reduce((somme, c) => somme + Number(c.latitude), 0) / valables.length
  const longitude = valables.reduce((somme, c) => somme + Number(c.longitude), 0) / valables.length
  return [latitude, longitude]
}

// ── ce que la purge emporte, dit avant de le faire ────────
export function tracesASupprimer(traces = [], jours = 30, maintenant = new Date()) {
  if (!jours) return traces.length
  const limite = new Date(maintenant)
  limite.setDate(limite.getDate() - jours)
  return traces.filter((trace) => {
    if (!trace?.connected_at) return false
    const date = new Date(trace.connected_at)
    return !isNaN(date.getTime()) && date < limite
  }).length
}

// ── le CSV du journal, tel qu'il était exporté ────────────
export const ENTETES_CSV = [
  'Quand', 'Type', 'Nom', 'Courriel ou matricule', 'Entreprise',
  'Adresse IP', 'Ville', 'Pays', 'Appareil', 'État', 'Motif du refus',
]

export function lignesCSV(traces = []) {
  return traces.map((trace) => [
    dateHeure(trace.connected_at),
    trace.user_type === 'admin' ? 'Administrateur' : 'Employé',
    nomUtilisateur(trace),
    identiteUtilisateur(trace) || '—',
    entrepriseDe(trace) || '—',
    trace.ip_address || '—',
    trace.city || '—',
    trace.country || '—',
    libelleAppareil(trace.device_type),
    estReussie(trace) ? 'Réussie' : 'Refusée',
    trace.failure_reason || '',
  ])
}

export function construireCSV(traces = []) {
  const lignes = [ENTETES_CSV, ...lignesCSV(traces)]
  return lignes
    .map((ligne) => ligne.map((cellule) => `"${String(cellule).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

// ── les traces qui ne correspondent pas à un compte connu ──
export function tracesOrphelines(traces = []) {
  return traces.filter((trace) => !trace.admin_id && !trace.employee_id).length
}

// ── les motifs de refus, du plus fréquent au plus rare ────
export function motifsDeRefus(traces = []) {
  const compte = {}
  traces.forEach((trace) => {
    if (estReussie(trace)) return
    const motif = (trace.failure_reason || '').trim() || 'Motif non renseigné'
    compte[motif] = (compte[motif] || 0) + 1
  })
  return Object.entries(compte)
    .map(([motif, nombre]) => ({ motif, nombre }))
    .sort((a, b) => b.nombre - a.nombre)
}
