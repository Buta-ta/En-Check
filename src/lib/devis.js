// ═══════════════════════════════════════════════════════════
// 🧮 LE PRIX D'UN DEVIS — le barème et l'arithmétique
//
// Tout ce qui décide d'un montant vit ici, et rien d'autre : le
// barème (TARIFS), les niveaux (mini / moy / max), les engagements
// et leurs remises, le scoring commercial, la négociation ligne à
// ligne, la priorité « montant convenu > total de catégorie >
// lignes », et la répartition de l'investissement en échéances.
//
// Ce fichier est extrait tel quel de l'ancienne page Devis : les
// montants ne changent pas d'un franc. Il est pur — aucun accès au
// serveur, aucun état de composant — pour pouvoir être relu et
// testé sans monter une page.
// ═══════════════════════════════════════════════════════════

export const TARIFS = {
  logiciel: { mini: 12000, moy: 15000, max: 20000 },
  installation: { mini: 1000, moy: 2000, max: 5000 },
  formation_equipe: { mini: 200, moy: 500, max: 1000 },
  formation_admin: { mini: 1000, moy: 1500, max: 2000 },
  formation_option: { mini: 300, moy: 500, max: 1000 },
  pack_base: { mini: 1000, moy: 3000, max: 5000 },
  pointage_pin: { mini: 500, moy: 1000, max: 1500 },
  pointage_qr: { mini: 700, moy: 1500, max: 2000 },
  photo_pointage: { mini: 800, moy: 1500, max: 5000 },
  planning: { mini: 500, moy: 1000, max: 2000 },
  retards: { mini: 500, moy: 1000, max: 2000 },
  modifier_pointages: { mini: 100, moy: 500, max: 1000 },
  absences_conges: { mini: 1000, moy: 2000, max: 5000 },
  heures_supplementaires: { mini: 500, moy: 1000, max: 2000 },
  admin_supplementaire: { mini: 500, moy: 1000, max: 1500 },
  espace_employe: { mini: 500, moy: 1000, max: 2000 },
  geofencing: { mini: 1000, moy: 2000, max: 5000 },
  maps_temps_reel: { mini: 500, moy: 1000, max: 2000 },
  reconnaissance_faciale: { mini: 2000, moy: 5000, max: 10000 },
  // NOUVELLES OPTIONS
  fiches_paie: { mini: 50, moy: 200, max: 500 }, // Par employé/mois
  jours_feries: { mini: 0, moy: 0, max: 0 }, // GRATUIT
}

export const STATUTS_DEVIS = [
  { key: 'brouillon', label: 'Brouillon', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  { key: 'envoye', label: 'Envoyé', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { key: 'accepte', label: 'Accepté ✓', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  { key: 'refuse', label: 'Refusé', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
]

// ═══════════════════════════════════════════════════════════
// OPTIONS D'ENGAGEMENT
// ═══════════════════════════════════════════════════════════
export const ENGAGEMENTS = [
  { value: 'sans', label: '🔓 Sans engagement', desc: 'Résiliable à tout moment', mois: 1, color: '#10B981', remise: 0 },
  { value: '2mois', label: '📅 2 mois', desc: 'Engagement 2 mois', mois: 2, color: '#6366F1', remise: 0 },
  { value: '3mois', label: '📅 3 mois', desc: 'Engagement 3 mois', mois: 3, color: '#8B5CF6', remise: 5 },
  { value: '6mois', label: '📅 6 mois', desc: 'Engagement 6 mois', mois: 6, color: '#F59E0B', remise: 10 },
  { value: 'annuel', label: '📅 Annuel', desc: '12 mois minimum', mois: 12, color: '#EC4899', remise: 15 },
]

export const CRITERES_SCORING = [
  {
    key: 'secteur', label: 'Secteur d\'activité', icon: '🏢',
    options: [
      { value: 'mini', label: 'Informel / Association / ONG', desc: 'Budget limité' },
      { value: 'moy', label: 'Commerce / PME / Startup', desc: 'Budget correct' },
      { value: 'max', label: 'Banque / Télécom / Administration', desc: 'Budget confortable' },
    ]
  },
  {
    key: 'budget', label: 'Budget exprimé', icon: '💰',
    options: [
      { value: 'mini', label: 'Pas de budget / "On verra..."', desc: 'Difficile à évaluer' },
      { value: 'moy', label: 'Budget vague / "Raisonnable"', desc: 'Ouvert à la discussion' },
      { value: 'max', label: 'Budget défini / "On peut"', desc: 'Prêt à investir' },
    ]
  },
  {
    key: 'urgence', label: 'Urgence', icon: '⏱️',
    options: [
      { value: 'mini', label: 'Pas pressé', desc: 'Pas de deadline' },
      { value: 'moy', label: '"Dans 1-2 mois"', desc: 'Délai raisonnable' },
      { value: 'max', label: '"Dès que possible"', desc: 'Besoin immédiat' },
    ]
  },
  {
    key: 'attitude_prix', label: 'Attitude face au prix', icon: '🤝',
    options: [
      { value: 'mini', label: 'Négocie tout', desc: 'Attention aux marges' },
      { value: 'moy', label: 'Quelques questions', desc: 'Négociation normale' },
      { value: 'max', label: 'Peu sensible au prix', desc: 'Priorité qualité' },
    ]
  },
  {
    key: 'maturite_digitale', label: 'Maturité digitale', icon: '💻',
    options: [
      { value: 'mini', label: 'Peu numérique', desc: 'Formation importante' },
      { value: 'moy', label: 'Quelques outils', desc: 'Adoption normale' },
      { value: 'max', label: 'Très digitalisé', desc: 'Adoption facile' },
    ]
  },
  {
    key: 'relation', label: 'Relation commerciale', icon: '🌐',
    options: [
      { value: 'mini', label: 'Contact froid', desc: 'Confiance à construire' },
      { value: 'moy', label: 'Déjà en discussion', desc: 'Relation établie' },
      { value: 'max', label: 'Recommandé / Réseau', desc: 'Relation privilégiée' },
    ]
  },
]

// ═══════════════════════════════════════════════════════════
// SCÉNARIOS DE PROSPECTION TÉLÉPHONIQUE
// ═══════════════════════════════════════════════════════════

export const NEGO_LIGNE_INITIAL = {
  logiciel: { unitaire: '', total: '' },
  installation: { unitaire: '', total: '' },
  formation_equipe: { unitaire: '', total: '' },
  formation_admin: { unitaire: '', total: '' },
  formation_option: { unitaire: '', total: '' },
  pack_base: { unitaire: '', total: '' },
  pointage: { unitaire: '', total: '' },
  photo_pointage: { unitaire: '', total: '' },
  planning: { unitaire: '', total: '' },
  retards: { unitaire: '', total: '' },
  modifier_pointages: { unitaire: '', total: '' },
  absences_conges: { unitaire: '', total: '' },
  heures_supplementaires: { unitaire: '', total: '' },
  admin_supplementaire: { unitaire: '', total: '' },
  espace_employe: { unitaire: '', total: '' },
  geofencing: { unitaire: '', total: '' },
  maps_temps_reel: { unitaire: '', total: '' },
  reconnaissance_faciale: { unitaire: '', total: '' },
  fiches_paie: { unitaire: '', total: '' },
  jours_feries: { unitaire: '', total: '' },
}

export const TOTAL_CATEGORIE_INITIAL = { fixe: '', mensuel: '' }
export const MONTANT_CONVENU_INITIAL = { fixe: '', mensuel: '' }

export const CONFIG_INITIAL = {
  nb_sites: 1, nb_employes: 10, nb_machines: 2,
  nb_admins: 1, nb_admins_supp: 0, nb_employes_a_former: 10,
  type_pointage: 'pin',
  options: {
    photo_pointage: false, planning: false, retards: false,
    modifier_pointages: false, absences_conges: false,
    heures_supplementaires: false, espace_employe: false,
    geofencing: false, maps_temps_reel: false, reconnaissance_faciale: false,
    fiches_paie: false, jours_feries: true, // Jours fériés activé par défaut (gratuit)
  }
}

export const SCORING_INITIAL = {
  secteur: null, budget: null, urgence: null,
  attitude_prix: null, maturite_digitale: null, relation: null,
}


// ── les montants se lisent en français, sans décimale inutile ──
export function formatF(n) {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return Number(n).toLocaleString('fr-FR')
}

export function formatMontant(n) {
  return `${formatF(n)} F`
}

export const NIVEAUX = ['mini', 'moy', 'max']
export const NIVEAU_LABEL = { mini: 'MINI', moy: 'MOY', max: 'MAX' }

// ── les trois prix d'une ligne, avant toute négociation ──
export function prixAutoUnitaire(key, niveau = 'moy', typePointage = 'pin') {
  if (key === 'pointage') {
    return typePointage === 'pin'
      ? TARIFS.pointage_pin[niveau]
      : TARIFS.pointage_qr[niveau]
  }
  return TARIFS[key]?.[niveau] || 0
}

export function getTarifMinUnitaire(key, typePointage = 'pin') {
  if (key === 'pointage') {
    return typePointage === 'pin'
      ? TARIFS.pointage_pin.mini
      : TARIFS.pointage_qr.mini
  }
  return TARIFS[key]?.mini || 0
}

export function prixTotalEffectif(key, qte, niveau = 'moy', negoLigne = {}, typePointage = 'pin') {
  const nego = negoLigne[key] || { unitaire: '', total: '' }
  const negoTotal = parseFloat(nego.total)
  if (!isNaN(negoTotal) && negoTotal > 0) return negoTotal
  const negoUnitaire = parseFloat(nego.unitaire)
  if (!isNaN(negoUnitaire) && negoUnitaire > 0) return negoUnitaire * qte
  return prixAutoUnitaire(key, niveau, typePointage) * qte
}

export function prixUnitaireEffectif(key, qte, niveau = 'moy', negoLigne = {}, typePointage = 'pin') {
  const nego = negoLigne[key] || { unitaire: '', total: '' }
  const negoTotal = parseFloat(nego.total)
  if (!isNaN(negoTotal) && negoTotal > 0 && qte > 0) {
    return negoTotal / qte
  }
  const negoUnitaire = parseFloat(nego.unitaire)
  if (!isNaN(negoUnitaire) && negoUnitaire > 0) return negoUnitaire
  return prixAutoUnitaire(key, niveau, typePointage)
}

export function estLigneNegociee(key, negoLigne = {}) {
  const nego = negoLigne[key] || {}
  const u = parseFloat(nego.unitaire)
  const t = parseFloat(nego.total)
  return (!isNaN(u) && u > 0) || (!isNaN(t) && t > 0)
}

export function modeNegoLigne(key, negoLigne = {}) {
  const nego = negoLigne[key] || {}
  const t = parseFloat(nego.total)
  if (!isNaN(t) && t > 0) return 'total'
  const u = parseFloat(nego.unitaire)
  if (!isNaN(u) && u > 0) return 'unitaire'
  return 'auto'
}

// Les jours fériés sont offerts : aucun minimum à défendre.
export function estLigneSousMinimum(key, qte, negoLigne = {}, typePointage = 'pin') {
  return getAlerteMinDetail(key, qte, negoLigne, typePointage).sousMin
}

export function getAlerteMinDetail(key, qte, negoLigne = {}, typePointage = 'pin') {
  if (key === 'jours_feries') {
    return { sousMin: false, unitaireSousMin: false, totalSousMin: false, tarifMin: 0, totalMin: 0 }
  }

  const nego = negoLigne[key] || { unitaire: '', total: '' }
  const tarifMin = getTarifMinUnitaire(key, typePointage)
  const totalMin = tarifMin * qte

  const negoUnitaire = parseFloat(nego.unitaire)
  const negoTotal = parseFloat(nego.total)

  const unitaireSousMin = !isNaN(negoUnitaire) && negoUnitaire > 0 && negoUnitaire < tarifMin
  const totalSousMin = !isNaN(negoTotal) && negoTotal > 0 && qte > 0 && (negoTotal / qte) < tarifMin

  return {
    sousMin: unitaireSousMin || totalSousMin,
    unitaireSousMin,
    totalSousMin,
    tarifMin,
    totalMin,
    ecartUnitaire: unitaireSousMin ? Math.round(tarifMin - negoUnitaire) : 0,
    ecartTotal: totalSousMin ? Math.round(totalMin - negoTotal) : 0,
    unitaireImplicite: !isNaN(negoTotal) && negoTotal > 0 && qte > 0 ? Math.round(negoTotal / qte) : null,
  }
}

// ── le scoring commercial : une moyenne, pas une note inventée ──
export function calculerScore(scoringData = {}) {
  const values = { mini: 1, moy: 2, max: 3 }
  const criteres = Object.values(scoringData).filter((v) => v !== null && v !== undefined)
  if (criteres.length === 0) return null
  const moyenne = criteres.reduce((sum, v) => sum + (values[v] || 0), 0) / criteres.length
  if (moyenne <= 1.5) return 'mini'
  if (moyenne <= 2.5) return 'moy'
  return 'max'
}

export function getEngagementConfig(engValue) {
  return ENGAGEMENTS.find((e) => e.value === engValue) || ENGAGEMENTS[4]
}

// ── le nombre de mois facturés, mois offert compris ──
export function nombreDeMois(engagementKey = 'annuel', moisGratuit = false) {
  const config = getEngagementConfig(engagementKey)
  return moisGratuit ? Math.max(config.mois - 1, 1) : config.mois
}

// ── ce que l'on retrouve d'un devis enregistré ──
export function totauxDuDevis(devis) {
  const detail = devis?.detail_calcul || {}
  const totaux = detail.totaux || {}
  return {
    totalFixeNet: totaux.totalFixeNet ?? devis?.montant_fixe_net ?? 0,
    totalMensuelNet: totaux.totalMensuelNet ?? devis?.montant_mensuel_net ?? 0,
    totalAnnuelNet: totaux.totalAnnuelNet ?? devis?.montant_annuel_net ?? 0,
    nbMois: totaux.nbMois ?? nombreDeMois(devis?.engagement || 'annuel', devis?.mois_gratuit),
    paiementFois: totaux.paiementFois ?? devis?.paiement_fois ?? 1,
    engagement: totaux.engagement ?? devis?.engagement ?? 'annuel',
  }
}

export function echeanceFixe(totaux) {
  const nbFois = totaux?.paiementFois || 1
  const fixe = totaux?.totalFixeNet || 0
  return nbFois > 1 ? Math.ceil(fixe / nbFois) : fixe
}

const _estLigneNegociee = estLigneNegociee
const _modeNegoLigne = modeNegoLigne
const _estLigneSousMinimum = estLigneSousMinimum

export function calculerDevis(cfg = CONFIG_INITIAL, niveau = 'moy', negoLigne = {}) {
  const typePointage = cfg.type_pointage
  const opts = cfg.options
    const nbOpts = Object.values(opts).filter(Boolean).length

    const qtes = {
      logiciel: cfg.nb_sites,
      installation: cfg.nb_machines,
      formation_equipe: cfg.nb_employes_a_former,
      formation_admin: cfg.nb_admins,
      formation_option: nbOpts * cfg.nb_admins,
      pack_base: cfg.nb_sites,
      pointage: cfg.nb_employes,
      photo_pointage: cfg.nb_employes,
      planning: cfg.nb_sites,
      retards: cfg.nb_sites,
      modifier_pointages: cfg.nb_employes,
      absences_conges: cfg.nb_sites,
      heures_supplementaires: cfg.nb_sites,
      admin_supplementaire: cfg.nb_admins_supp,
      espace_employe: cfg.nb_employes,
      geofencing: cfg.nb_employes,
      maps_temps_reel: cfg.nb_employes,
      reconnaissance_faciale: cfg.nb_employes,
      fiches_paie: cfg.nb_employes,
      jours_feries: cfg.nb_sites, // Par site (gratuit)
    }

    const T = (key) => prixTotalEffectif(key, qtes[key], niveau, negoLigne, typePointage)
    const U = (key, qte) => prixUnitaireEffectif(key, qte, niveau, negoLigne, typePointage)
    const A = (key) => prixAutoUnitaire(key, niveau, typePointage)
    const estLigneNegociee = (key) => _estLigneNegociee(key, negoLigne)
    const modeNegoLigne = (key) => _modeNegoLigne(key, negoLigne)
    const estLigneSousMinimum = (key, qte) => _estLigneSousMinimum(key, qte, negoLigne, typePointage)

    const logiciel = T('logiciel')
    const installation = T('installation')
    const formEq = T('formation_equipe')
    const formAdmin = T('formation_admin')
    const formOpt = nbOpts > 0 ? T('formation_option') : 0
    const sousTotalFixe = logiciel + installation + formEq + formAdmin + formOpt

    const packBase = T('pack_base')
    const pointage = T('pointage')
    const photo = opts.photo_pointage ? T('photo_pointage') : 0
    const planning = opts.planning ? T('planning') : 0
    const retards = opts.retards ? T('retards') : 0
    const modifPt = opts.modifier_pointages ? T('modifier_pointages') : 0
    const absCong = opts.absences_conges ? T('absences_conges') : 0
    const heuresSup = opts.heures_supplementaires ? T('heures_supplementaires') : 0
    const adminSupp = cfg.nb_admins_supp > 0 ? T('admin_supplementaire') : 0
    const espaceEmp = opts.espace_employe ? T('espace_employe') : 0
    const geofenc = opts.geofencing ? T('geofencing') : 0
    const mapsRT = opts.maps_temps_reel ? T('maps_temps_reel') : 0
    const recoFace = opts.reconnaissance_faciale ? T('reconnaissance_faciale') : 0
    const fichePaie = opts.fiches_paie ? T('fiches_paie') : 0
    const joursFeries = opts.jours_feries ? 0 : 0 // Toujours gratuit

    const sousTotalMensuel = packBase + pointage + photo + planning + retards +
      modifPt + absCong + heuresSup + adminSupp + espaceEmp + geofenc + mapsRT + recoFace + fichePaie + joursFeries

    const makeLigne = (key, label, qte, total, autoUnitaire, isGratuit = false) => ({
      key,
      label,
      qte,
      autoUnitaire,
      autoTotal: autoUnitaire * qte,
      unitaire: U(key, qte),
      total,
      negocie: estLigneNegociee(key),
      modeNego: modeNegoLigne(key),
      negoUnitaire: parseFloat(negoLigne[key]?.unitaire) || null,
      negoTotal: parseFloat(negoLigne[key]?.total) || null,
      sousMinimum: estLigneSousMinimum(key, qte),
      isGratuit,
    })

    const lignesFixe = [
      makeLigne('logiciel', `Logiciel (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, logiciel, A('logiciel')),
      makeLigne('installation', `Installation (${cfg.nb_machines} machine${cfg.nb_machines > 1 ? 's' : ''})`, cfg.nb_machines, installation, A('installation')),
      makeLigne('formation_equipe', `Formation équipes (${cfg.nb_employes_a_former} pers.)`, cfg.nb_employes_a_former, formEq, A('formation_equipe')),
      makeLigne('formation_admin', `Formation admin (${cfg.nb_admins} admin)`, cfg.nb_admins, formAdmin, A('formation_admin')),
      ...(nbOpts > 0 ? [makeLigne('formation_option', `Formation options (${nbOpts} opt. × ${cfg.nb_admins} admin)`, nbOpts * cfg.nb_admins, formOpt, A('formation_option'))] : []),
    ].filter(l => l.total > 0)

    const lignesMensuel = [
      makeLigne('pack_base', `Pack de base (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, packBase, A('pack_base')),
      makeLigne('pointage', `Pointage ${cfg.type_pointage === 'pin' ? 'PIN' : 'QR Code'} (${cfg.nb_employes} emp)`, cfg.nb_employes, pointage, A('pointage')),
      ...(photo > 0 ? [makeLigne('photo_pointage', `Photo pointage (${cfg.nb_employes} emp)`, cfg.nb_employes, photo, A('photo_pointage'))] : []),
      ...(planning > 0 ? [makeLigne('planning', `Planning (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, planning, A('planning'))] : []),
      ...(retards > 0 ? [makeLigne('retards', `Retards (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, retards, A('retards'))] : []),
      ...(modifPt > 0 ? [makeLigne('modifier_pointages', `Modif. pointages (${cfg.nb_employes} emp)`, cfg.nb_employes, modifPt, A('modifier_pointages'))] : []),
      ...(absCong > 0 ? [makeLigne('absences_conges', `Absences & Congés (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, absCong, A('absences_conges'))] : []),
      ...(heuresSup > 0 ? [makeLigne('heures_supplementaires', `Heures supp. (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, heuresSup, A('heures_supplementaires'))] : []),
      ...(adminSupp > 0 ? [makeLigne('admin_supplementaire', `Admin supp. (${cfg.nb_admins_supp})`, cfg.nb_admins_supp, adminSupp, A('admin_supplementaire'))] : []),
      ...(espaceEmp > 0 ? [makeLigne('espace_employe', `Espace Employé (${cfg.nb_employes} emp)`, cfg.nb_employes, espaceEmp, A('espace_employe'))] : []),
      ...(geofenc > 0 ? [makeLigne('geofencing', `Geofencing (${cfg.nb_employes} emp)`, cfg.nb_employes, geofenc, A('geofencing'))] : []),
      ...(mapsRT > 0 ? [makeLigne('maps_temps_reel', `Maps temps réel (${cfg.nb_employes} emp)`, cfg.nb_employes, mapsRT, A('maps_temps_reel'))] : []),
      ...(recoFace > 0 ? [makeLigne('reconnaissance_faciale', `Reconnaissance faciale (${cfg.nb_employes} emp)`, cfg.nb_employes, recoFace, A('reconnaissance_faciale'))] : []),
      ...(fichePaie > 0 ? [makeLigne('fiches_paie', `💰 Fiches de paie (${cfg.nb_employes} emp)`, cfg.nb_employes, fichePaie, A('fiches_paie'))] : []),
      ...(opts.jours_feries ? [makeLigne('jours_feries', `🎌 Jours fériés (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, 0, 0, true)] : []),
    ].filter(l => l.total > 0 || l.isGratuit)

    return { lignesFixe, lignesMensuel, sousTotalFixe, sousTotalMensuel }
}

export function appliquerPriorites(calcul, {
  engagement = 'annuel',
  moisGratuit = false,
  remiseFixe = 0,
  remiseMensuel = 0,
  montantConvenu = MONTANT_CONVENU_INITIAL,
  totalCategorie = TOTAL_CATEGORIE_INITIAL,
  paiementFois = 1,
} = {}) {
  const engConfig = getEngagementConfig(engagement)
    const nbMoisBase = engConfig.mois
    const nbMois = moisGratuit ? Math.max(nbMoisBase - 1, 1) : nbMoisBase
    const remiseEngagement = engConfig.remise

    const convFixe = parseFloat(montantConvenu.fixe)
    const catFixe = parseFloat(totalCategorie.fixe)
    let totalFixeNet, modeFixe

    if (!isNaN(convFixe) && convFixe > 0) {
      totalFixeNet = convFixe
      modeFixe = 'convenu'
    } else if (!isNaN(catFixe) && catFixe > 0) {
      totalFixeNet = catFixe
      modeFixe = 'categorie'
    } else {
      totalFixeNet = Math.round(calcul.sousTotalFixe * (1 - remiseFixe / 100))
      modeFixe = 'lignes'
    }

    const convMensuel = parseFloat(montantConvenu.mensuel)
    const catMensuel = parseFloat(totalCategorie.mensuel)
    let totalMensuelNet, modeMensuel

    if (!isNaN(convMensuel) && convMensuel > 0) {
      totalMensuelNet = convMensuel
      modeMensuel = 'convenu'
    } else if (!isNaN(catMensuel) && catMensuel > 0) {
      totalMensuelNet = catMensuel
      modeMensuel = 'categorie'
    } else {
      // Appliquer remise mensuelle + remise engagement
      const remiseTotale = Math.min(remiseMensuel + remiseEngagement, 50) // Max 50%
      totalMensuelNet = Math.round(calcul.sousTotalMensuel * (1 - remiseTotale / 100))
      modeMensuel = 'lignes'
    }

    const totalAnnuelNet = totalFixeNet + (totalMensuelNet * nbMois)

    const echeanceFixe = paiementFois > 1 ? Math.ceil(totalFixeNet / paiementFois) : totalFixeNet

    return {
      totalFixeNet,
      totalMensuelNet,
      totalAnnuelNet,
      nbMois,
      modeFixe,
      modeMensuel,
      echeanceFixe,
      paiementFois,
      engagement,
      remiseEngagement,
      engagementLabel: engConfig.label
    }
  }



  // ═══════════════════════════════════════════════════════════
