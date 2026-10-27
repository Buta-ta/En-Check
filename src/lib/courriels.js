// ═══════════════════════════════════════════════════════════
// COURRIELS — ce que le fournisseur a accepté, ce qui a échoué
//
// La vue « Courriels » de Messages système lit trois choses : le
// journal `encheck_email_logs`, la santé de la fonction `send-email`
// et le brouillon d'un envoi de contrôle. Aucun de ces calculs n'a
// besoin de React : ils vivent ici, purs, et se testent seuls.
//
// Rien n'est inventé : un statut absent se déduit des compteurs, une
// date absente ne devient pas « aujourd'hui », et une tentative dont
// on ignore les destinataires ne prétend pas savoir où elle est partie.
// ═══════════════════════════════════════════════════════════

export const TAILLE_PAGE = 250
export const MOT_ENVOI = 'ENVOYER'
export const VERSION_FONCTION = 'email-monitor-v1'

export const STATUTS_COURRIEL = [
  { cle: 'accepted', libelle: 'Accepté par le fournisseur', court: 'Accepté', ton: 'vert' },
  { cle: 'failed', libelle: 'Échec fournisseur', court: 'Échec', ton: 'alerte' },
  { cle: 'partial', libelle: 'Partiel — à vérifier', court: 'Partiel', ton: 'attente' },
  { cle: 'not_sent', libelle: 'Non envoyé avant acceptation', court: 'Non envoyé', ton: 'lete' },
  { cle: 'blocked', libelle: 'Bloqué — limite de sécurité', court: 'Bloqué', ton: 'or' },
]

export const SOURCES_COURRIEL = [
  { cle: 'base', libelle: 'Automatique (base)', court: 'Automatique' },
  { cle: 'tableau_de_bord', libelle: 'Tableau de bord', court: 'Test / tableau de bord' },
  { cle: 'relance', libelle: 'Relance', court: 'Relance' },
]

export const GRAVITES_LIGNE = [
  { cle: 'info', libelle: 'Information' },
  { cle: 'attention', libelle: 'À vérifier' },
  { cle: 'critique', libelle: 'Critique' },
]

export const MODES_ENVOI = [
  { cle: 'self', libelle: 'Mon adresse' },
  { cle: 'admin', libelle: 'Un administrateur' },
  { cle: 'manual', libelle: 'Des adresses' },
  { cle: 'enterprise', libelle: 'Une entreprise' },
]

// ── lire une ligne du journal ──────────────────────────────
export function statutCourriel(log) {
  if (log?.statut && STATUTS_COURRIEL.some((item) => item.cle === log.statut)) return log.statut
  const envoyes = Number(log?.envoyes) || 0
  const echecs = Number(log?.echecs) || 0
  if (envoyes > 0 && echecs > 0) return 'partial'
  return envoyes > 0 ? 'accepted' : 'failed'
}

export function metaStatut(cle) {
  return STATUTS_COURRIEL.find((item) => item.cle === cle) || STATUTS_COURRIEL[1]
}

export function sourceDe(log) {
  const source = log?.source
  return SOURCES_COURRIEL.some((item) => item.cle === source) ? source : 'tableau_de_bord'
}

export function metaSource(cle) {
  return SOURCES_COURRIEL.find((item) => item.cle === cle) || SOURCES_COURRIEL[1]
}

export function adressesDe(log) {
  const depuisJson = Array.isArray(log?.destinataires_json) ? log.destinataires_json : []
  const depuisPayload = Array.isArray(log?.payload?.destinataires) ? log.payload.destinataires : []
  const brut = depuisJson.length ? depuisJson : depuisPayload
  const adresses = brut.length
    ? brut
    : String(log?.destinataires || '').split(/[,;\n]+/)
  return [...new Set(adresses.map((adresse) => String(adresse || '').trim().toLowerCase()).filter(Boolean))]
}

export function resultatsDe(log) {
  if (Array.isArray(log?.resultats_destinataires) && log.resultats_destinataires.length) {
    return log.resultats_destinataires
  }
  if (Array.isArray(log?.payload?.resultats_destinataires)) return log.payload.resultats_destinataires
  return []
}

export function lignesDe(log) {
  return Array.isArray(log?.payload?.lignes) ? log.payload.lignes : []
}

export function analyseDe(log) {
  return Array.isArray(log?.payload?.analyse_destinataires) ? log.payload.analyse_destinataires : []
}

// ── les dates, sans mentir sur le vide ─────────────────────
export function dateCourriel(valeur) {
  if (!valeur) return 'Date inconnue'
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return 'Date inconnue'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function jourCourriel(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA')
}

export function dureeCourriel(ms) {
  if (ms === null || ms === undefined || ms === '') return 'non mesurée'
  const valeur = Number(ms)
  if (!Number.isFinite(valeur) || valeur < 0) return 'non mesurée'
  if (valeur < 1000) return `${Math.round(valeur)} ms`
  return `${(valeur / 1000).toFixed(1).replace('.', ',')} s`
}

// ── les chiffres ───────────────────────────────────────────
export function compteCourriels(logs = [], maintenant = new Date()) {
  const compte = {
    total: logs.length,
    accepted: 0,
    failed: 0,
    partial: 0,
    notSent: 0,
    blocked: 0,
    today: 0,
  }
  const aujourdhui = maintenant.toLocaleDateString('en-CA')
  logs.forEach((log) => {
    const statut = statutCourriel(log)
    if (compte[statut] !== undefined) compte[statut] += 1
    if (jourCourriel(log?.cree_le) === aujourdhui) compte.today += 1
  })
  return compte
}

export function resumeCourriels(logs = [], maintenant = new Date()) {
  const compte = compteCourriels(logs, maintenant)
  return {
    tentatives: compte.total,
    acceptees: compte.accepted,
    echecs: compte.failed,
    partiels: compte.partial,
    aujourdhui: compte.today,
  }
}

// ── filtrer ce qui est chargé ─────────────────────────────
export function filtrerCourriels(logs = [], {
  statut = 'all', source = 'all', recherche = '', archives = false, nomsEntreprises = {},
} = {}) {
  const aiguille = String(recherche || '').trim().toLowerCase().normalize('NFC')
  return logs.filter((log) => {
    if (Boolean(log?.archived_at) !== Boolean(archives)) return false
    if (statut !== 'all' && statutCourriel(log) !== statut) return false
    if (source !== 'all' && sourceDe(log) !== source) return false
    if (!aiguille) return true
    return [
      log?.sujet,
      log?.destinataires,
      log?.erreur,
      nomsEntreprises?.[log?.enterprise_id],
      metaSource(sourceDe(log)).libelle,
    ].some((valeur) => String(valeur || '').toLowerCase().normalize('NFC').includes(aiguille))
  })
}

// ── ce qu'on peut refaire, et comment ─────────────────────
const entetesRelance = (log) => {
  const lignes = lignesDe(log)
  return lignes.length > 0
}

export function peutRelancer(log) {
  return statutCourriel(log) === 'failed'
    && (Number(log?.envoyes) || 0) === 0
    && entetesRelance(log)
    && adressesDe(log).length > 0
}

export function peutCorriger(log) {
  if (!entetesRelance(log)) return false
  const statut = statutCourriel(log)
  if (statut === 'failed' || statut === 'not_sent') {
    return adressesDe(log).length > 0 || Boolean(log?.enterprise_id || log?.payload?.enterprise_id)
  }
  if (statut === 'partial') {
    return resultatsDe(log).some((item) => ['failed', 'not_sent'].includes(item?.statut) && item?.email)
  }
  return false
}

export function adressesRelance(log) {
  const resultats = resultatsDe(log)
  if (statutCourriel(log) === 'partial' && resultats.length) {
    const restantes = resultats
      .filter((item) => ['failed', 'not_sent'].includes(item?.statut))
      .map((item) => item?.email)
      .filter(Boolean)
    if (restantes.length) return restantes
  }
  return adressesDe(log)
}

// ── la santé de la fonction e-mail ────────────────────────
export function santeCourriels(controle = {}) {
  const configuration = controle.configuration || null
  const verifiee = controle.etat === 'prete'
  const ancienne = controle.etat === 'ancienne'
  const injoignable = controle.etat === 'injoignable'
  const detail = controle.detail || ''

  const criteres = verifiee ? [
    { cle: 'expediteur', libelle: 'Expéditeur', ok: Boolean(configuration?.sender_configured) },
    { cle: 'fournisseur', libelle: 'Brevo / SMTP', ok: Boolean(configuration?.provider_configured) },
    { cle: 'origine', libelle: 'Origine du site', ok: configuration?.origin_allowed !== false },
    { cle: 'secret', libelle: 'Secret SQL', ok: Boolean(configuration?.trigger_secret_configured) },
  ].map((critere) => ({ ...critere, valeur: critere.ok ? 'configuré' : 'MANQUANT' })) : []

  const manquants = criteres.filter((critere) => !critere.ok).map((critere) => critere.libelle)
  const peutEnvoyer = verifiee && Boolean(configuration?.sender_configured)
    && Boolean(configuration?.provider_configured)
    && configuration?.origin_allowed !== false
  const envoisAuto = peutEnvoyer && Boolean(configuration?.trigger_secret_configured)

  let ton = 'attente'
  let verdict = controle.message || 'Vérification de la fonction e-mail…'
  if (verifiee) {
    ton = envoisAuto ? 'vert' : 'attente'
    verdict = envoisAuto ? 'Fonction e-mail connectée.' : 'Envois automatiques suspendus.'
    if (!peutEnvoyer) verdict = 'Envoi de contrôle impossible.'
  } else if (ancienne || injoignable) {
    ton = 'alerte'
  }

  return {
    ton,
    verdict,
    detail,
    criteres,
    manquants,
    peutEnvoyer,
    envoisAuto,
    verifiee,
  }
}

// ── le brouillon d'un envoi de contrôle ───────────────────
export function adressesValides(texte) {
  return [...new Set(
    String(texte || '')
      .split(/[\n,;]+/)
      .map((adresse) => adresse.trim().toLowerCase())
      .filter((adresse) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)),
  )]
}

export function ligneVide() {
  return { titre: '', detail: '', quand: '', gravite: 'info', type: 'essai', employe: '' }
}

export function brouillonVide({ adresse = '', origine = '' } = {}) {
  return {
    mode: 'self',
    entrepriseId: '',
    adminId: '',
    recipientsText: adresse,
    subject: 'Test d’envoi En-Check',
    link: origine ? `${origine}/pointages` : '',
    lines: [{
      ...ligneVide(),
      titre: 'Test d’envoi En-Check',
      detail: 'Vérification de la réception des alertes e-mail.',
      quand: new Date().toLocaleString('fr-FR'),
    }],
    retryOf: null,
  }
}

export function brouillonRelance(log, origine = '') {
  const payload = log?.payload || {}
  const adresses = adressesRelance(log)
  const lignes = lignesDe(log)
  if (!lignes.length || (!adresses.length && !(log?.enterprise_id || payload.enterprise_id))) return null
  return {
    mode: adresses.length ? 'manual' : 'enterprise',
    entrepriseId: log?.enterprise_id || payload.entreprise_id || '',
    adminId: '',
    recipientsText: adresses.join(', '),
    subject: payload.sujet || '',
    link: payload.lien || (origine ? `${origine}/pointages` : ''),
    lines: lignes.map((ligne) => ({
      titre: String(ligne?.titre || ''),
      detail: String(ligne?.detail || ''),
      quand: String(ligne?.quand || ''),
      gravite: GRAVITES_LIGNE.some((item) => item.cle === ligne?.gravite) ? ligne.gravite : 'info',
      type: String(ligne?.type || 'essai'),
      employe: String(ligne?.employe || ''),
    })),
    retryOf: log?.id || null,
  }
}

export function destinatairesBrouillon(brouillon = {}, { adresseCourante = '', admins = [] } = {}) {
  if (brouillon.retryOf) return adressesValides(brouillon.recipientsText)
  if (brouillon.mode === 'self') return adressesValides(adresseCourante)
  if (brouillon.mode === 'admin') {
    const choisi = admins.find((item) => item.id === brouillon.adminId)
    return adressesValides(choisi?.email || '')
  }
  if (brouillon.mode === 'enterprise') return []
  return adressesValides(brouillon.recipientsText)
}

export function resumeBrouillon(brouillon = {}, contexte = {}) {
  const destinataires = destinatairesBrouillon(brouillon, contexte)
  const lignes = (brouillon.lines || []).filter((ligne) => String(ligne?.titre || '').trim() || String(ligne?.detail || '').trim())
  return {
    mode: brouillon.retryOf ? 'relance' : brouillon.mode,
    destinataires,
    nombre: destinataires.length,
    entrepriseId: brouillon.entrepriseId || '',
    lignes: lignes.length,
    sujet: String(brouillon.subject || '').trim(),
    complet: lignes.length > 0 && (destinataires.length > 0 || (brouillon.mode === 'enterprise' && Boolean(brouillon.entrepriseId))),
  }
}

export function requeteCourriel(brouillon = {}, {
  previewOnly = false, adresseCourante = '', admins = [],
} = {}) {
  const corps = {
    sujet: String(brouillon.subject || '').trim(),
    lien: String(brouillon.link || '').trim(),
    lignes: (brouillon.lines || [])
      .filter((ligne) => String(ligne?.titre || '').trim() || String(ligne?.detail || '').trim())
      .map((ligne) => ({ ...ligne })),
  }

  if (brouillon.mode === 'enterprise' && !brouillon.retryOf) {
    corps.enterprise_id = brouillon.entrepriseId
  } else {
    corps.destinataires = destinatairesBrouillon(brouillon, { adresseCourante, admins })
    if (brouillon.entrepriseId) corps.enterprise_id = brouillon.entrepriseId
  }

  if (brouillon.retryOf) corps.retry_of = brouillon.retryOf
  if (previewOnly) corps.preview_only = true
  return corps
}

export function confirmationEnvoiValide(valeur) {
  return String(valeur || '').trim().toUpperCase() === MOT_ENVOI
}

// ── l'export du journal ────────────────────────────────────
export const ENTETES_CSV = [
  'Quand', 'Sujet', 'Statut', 'Source', 'Entreprise', 'Adresses', 'Acceptés', 'Échecs', 'Erreur',
]

export function lignesCSV(logs = [], nomsEntreprises = {}) {
  return logs.map((log) => [
    dateCourriel(log?.cree_le),
    log?.sujet || '',
    metaStatut(statutCourriel(log)).libelle,
    metaSource(sourceDe(log)).libelle,
    nomsEntreprises?.[log?.enterprise_id] || (log?.enterprise_id ? 'Entreprise' : 'Sans entreprise'),
    adressesDe(log).join(' '),
    Number(log?.envoyes) || 0,
    Number(log?.echecs) || 0,
    log?.erreur || '',
  ])
}

export function construireCSV(logs = [], nomsEntreprises = {}) {
  const echapper = (valeur) => `"${String(valeur ?? '').replace(/"/g, '""')}"`
  const lignes = [ENTETES_CSV.map(echapper).join(';')]
  lignesCSV(logs, nomsEntreprises).forEach((ligne) => lignes.push(ligne.map(echapper).join(';')))
  return lignes.join('\n')
}
