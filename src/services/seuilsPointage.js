// src/services/seuilsPointage.js
// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ SEUILS DE POINTAGE — SOURCE UNIQUE (arbitrage n°1, décision §4.4)
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE FICHIER EXISTE
//   Avant l'arbitrage, chaque moteur avait SON chiffre dans SON code :
//     · 12 h  → la pointeuse (`encheck_type_suggere`, dépôt pointage) déclarait
//               la « sortie oubliée » ;
//     · 14 h  → le SQL de clôture (`encheck_cloturer_sorties_oubliees`) décidait
//               de l'oubli ET plafonnait la durée inventée ;
//     · 16 h  → le JS (`hoursCalculator.js`) appariait entrée↔sortie ;
//     · 60 s  → l'anti-rebond, implémenté deux fois (JS et SQL).
//   Trois moteurs, quatre seuils : la même journée pouvait produire trois durées
//   différentes selon l'écran regardé, et une sortie réelle arrivée en retard
//   pouvait être écrasée par une estimation fabriquée la veille.
//
//   Ici : une seule liste, lue en base (`encheck_reglages_pointage`) avec ces
//   constantes pour repli hors-ligne. Deux concepts qui étaient confondus sont
//   désormais séparés et nommés :
//     · `oubliSortieHeures`   = à partir de quand une session est un OUBLI ;
//     · `plafondInventionHeures` = au-delà de quand on s'ARRÊTE d'estimer ;
//     · `appariementHeures`   = tolérance pour relier une entrée à sa sortie
//                              (une garde de 13 h reste une garde : ce n'est pas
//                              un seuil d'oubli, et il ne faut surtout pas le
//                              confondre avec les deux autres).
//
// RÈGLE DE CONDUITE POUR LES DEUX IA
//   Aucun seuil de pointage ne doit être réécrit en dur dans un composant, une
//   page ou une fonction SQL : `encheck_seuil()` côté base, `chargerSeuilsPointage()`
//   côté app. Les valeurs par défaut ci-dessous sont le CONTRATOIR, pas un réglage.

/** Valeurs de repli — identiques aux valeurs semées dans `encheck_reglages_pointage`. */
export const SEUILS_PAR_DEFAUT = {
  oubliSortieHeures: 12,
  plafondInventionHeures: 12,
  dureeMinimaleSessionMinutes: 30,
  margeApresSortieEstimeeMinutes: 30,
  appariementHeures: 16,
  //  Règle « garde de nuit » (arbitrage n°2, cas Hippo 15→16/10) : une sortie
  //  réelle pointée avant 06:00 le lendemain appartient à la garde ouverte la
  //  veille, même au-delà de la tolérance d'appariement, dans la limite de ce
  //  plafond. Deux VRAIS badges ne doivent pas se perdre parce qu'un chef est
  //  resté 16 h 19 au bureau. Le plafond empêche de coller deux journées
  //  différentes (au-delà de 22 h, ce n'est plus une garde, c'est un oubli).
  gardeMaxHeures: 22,
  seuilRebondSecondes: 60,
  clusterFenetreMinutes: 90,
  clusterFenetreJours: 28,
  clusterNbMin: 5,
  clusterIqrMaxMinutes: 45,
  nudgeApresMinutes: 20,
  delaiContestationHeures: 48,
  modeEstimation: 'ombre',
}

/** Correspondance nom JS ↔ clé SQL (`encheck_reglages_pointage.cle`). */
const CLES = {
  oubliSortieHeures: 'oubli_sortie_heures',
  plafondInventionHeures: 'plafond_invention_heures',
  dureeMinimaleSessionMinutes: 'duree_minimale_session_minutes',
  margeApresSortieEstimeeMinutes: 'marge_apres_sortie_estimee_minutes',
  appariementHeures: 'appariement_heures',
  gardeMaxHeures: 'garde_max_heures',
  seuilRebondSecondes: 'seuil_rebond_secondes',
  clusterFenetreMinutes: 'cluster_fenetre_minutes',
  clusterFenetreJours: 'cluster_fenetre_jours',
  clusterNbMin: 'cluster_nb_min',
  clusterIqrMaxMinutes: 'cluster_iqr_max_minutes',
  nudgeApresMinutes: 'nudge_apres_minutes',
  delaiContestationHeures: 'delai_contestation_heures',
  modeEstimation: 'mode_estimation',
}

// Cache par entreprise : une page de pointages lit ses seuils une fois, pas 40 fois.
const _cache = new Map()

function _versNombre(valeur, defaut) {
  const n = Number(valeur)
  return Number.isFinite(n) ? n : defaut
}

/**
 * Charge les seuils d'une entreprise. Ne JAMAIS rejeter : si la table ou la
 * colonne n'existe pas encore (base pas encore migrée), on retombe sur les
 * constantes contractuelles — l'app continue d'afficher les mêmes chiffres que
 * la base, ce qui est exactement le but de ce fichier.
 */
export async function chargerSeuilsPointage(enterpriseId, { force = false } = {}) {
  const cle = enterpriseId || '__global__'
  if (!force && _cache.has(cle)) return _cache.get(cle)

  const seuils = { ...SEUILS_PAR_DEFAUT }
  try {
    // Import différé pour ne pas créer de dépendance circulaire avec lib/supabase.
    const { supabase } = await import('../lib/supabase')
    const query = supabase
      .from('encheck_reglages_pointage')
      .select('cle,valeur,enterprise_id')
    // NULL se sélectionne avec IS NULL, jamais dans une liste d'UUID.
    const { data, error } = await (enterpriseId
      ? query.or(`enterprise_id.eq.${enterpriseId},enterprise_id.is.null`)
      : query.is('enterprise_id', null))
    if (error) throw error
    seuils.chargement = 'base'

    const parCle = {}
    for (const r of data || []) {
      if (r.enterprise_id) parCle[r.cle] = r.valeur   // l'entreprise écrase le global
      else if (parCle[r.cle] === undefined) parCle[r.cle] = r.valeur
    }

    for (const [nom, cleSql] of Object.entries(CLES)) {
      if (parCle[cleSql] === undefined) continue
      if (nom === 'modeEstimation') {
        const brut = typeof parCle[cleSql] === 'string' ? parCle[cleSql] : parCle[cleSql]?.valeur
        const txt = String(brut ?? '').replace(/"/g, '').trim().toLowerCase()
        if (['ombre', 'actif', 'desactive'].includes(txt)) seuils[nom] = txt
        continue
      }
      const brut = parCle[cleSql]
      const num = typeof brut === 'number' ? brut : Number(brut)
      if (Number.isFinite(num)) seuils[nom] = num
    }
  } catch {
    // Dégradation explicite, et pas de cache d'échec : le prochain chargement réessaie.
    seuils.chargement = 'secours'
  }

  //  Réparation des réglages incohérents — un `0` ou un texte dans la base ne
  //  doit JAMAIS devenir une règle d'affaires (déjà vu : un plafond à 0 efface
  //  toutes les estimations d'une entreprise d'un seul edit de réglage). Une
  //  valeur invalide retombe sur le CONTRÂT, elle n'est pas arrondie à 1.
  const _positif = (v, defaut) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : defaut
  }
  seuils.oubliSortieHeures = _positif(seuils.oubliSortieHeures, SEUILS_PAR_DEFAUT.oubliSortieHeures)
  seuils.plafondInventionHeures = _positif(seuils.plafondInventionHeures, SEUILS_PAR_DEFAUT.plafondInventionHeures)
  //  L'appariement doit rester AU MOINS aussi large que le seuil d'oubli : si la
  //  tolérance de rapprochement est plus courte que ce qu'on appelle « oubli »,
  //  une garde normale est coupée en deux journées et le total devient faux.
  seuils.appariementHeures = Math.max(
    seuils.oubliSortieHeures,
    _positif(seuils.appariementHeures, SEUILS_PAR_DEFAUT.appariementHeures),
  )
  //  La garde de nuit couvre AU MINUS la tolérance d'appariement : un plafond
  //  plus petit que la fenêtre normale n'aurait aucun sens (règle R2 de
  //  l'arbitrage n°2 — sortie avant 06:00, plafond garde_max_heures).
  seuils.gardeMaxHeures = Math.max(
    seuils.appariementHeures,
    _positif(seuils.gardeMaxHeures, SEUILS_PAR_DEFAUT.gardeMaxHeures),
  )

  if (seuils.chargement === 'base') _cache.set(cle, seuils)
  return seuils
}

/** Purge le cache (après modification des réglages côté entreprise). */
export function invaliderCacheSeuils(enterpriseId) {
  if (enterpriseId) _cache.delete(enterpriseId)
  else _cache.clear()
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTIMATIONS — doctrine « on invente, on marque, on n'encaisse pas » (§4.1)
// ═══════════════════════════════════════════════════════════════════════════
//  Une sortie estimée n'est PAS un badge. Elle est :
//    · marquée (`is_auto_closed`, `anomalie='sortie_presumee'`, méthode forcée
//      `auto_close`) — donc jamais confondue avec une lecture QR ou un PIN ;
//    · exclue de la paie et des notifications sortantes TANT QU'AUCUN HUMAIN NE
//      L'A VALIDÉE (`estimation_validee_le`) ;
//    · conservée, jamais supprimée, même当 une donnée réelle arrive après
//      (`estimation_remplacee_le`) — c'est ce qui permet de MESURER l'erreur.
//  ⚠️ Ces trois filtres sont lus dans TOUTES les vues qui touchent l'argent :
//     `payrollService.js`, `Rapports.jsx`, `Remunerations` (vue coût), `HeuresSupplementaires`.
//     Un nouvel écran qui additionne des minutes doit appeler
//     `filtrerPointagesPayables()` — sinon il remet une heure inventée dans la paie.

/** Vrai si la ligne est une sortie estimée et pas (encore) validée par un humain.
 *  ATTENTION — cette fonction veut dire « NON PAYABLE », pas « à statuer ».
 *  Une estimation REMPLACÉE (estimation_remplacee_le rempli) reste « non
 *  payable » : c'est ce qui protège la paie. Pour l'affichage des boutons
 *  Valider/Écarter, utiliser `estEstimationAStatuer` — sinon les boutons ne
 *  disparaissent jamais après un clic (bug du 16/10, cas Mercia). */
export function estEstimationNonValidee(att) {
  if (!att) return false
  if (att.is_auto_closed !== true && att.is_auto_closed !== 'true') return false
  if (att.estimation_remplacee_le) return true   // périmée : jamais payable
  return !att.estimation_validee_le
}

/** Vrai si l'estimation attend ENCORE une décision humaine (boutons Valider/Écarter). */
export function estEstimationAStatuer(att) {
  if (!att) return false
  if (att.is_auto_closed !== true && att.is_auto_closed !== 'true') return false
  return !att.estimation_validee_le && !att.estimation_remplacee_le
}

/** Vrai si l'estimation a été ÉCARTÉE par un admin (rejetée — jamais payée). */
export function estEstimationEcartee(att) {
  return !!att && att.anomalie === 'sortie_presumee_rejetee'
}

/**
 * Vrai si la ligne n'est plus un badge exploitable : estimation écartée par un
 * admin, ou estimation remplacée par un vrai pointage. Ces lignes restent en
 * base pour l'audit et la mesure d'erreur, mais ne doivent JAMAIS être
 * appariées, ni comptées dans une durée, ni ré-estimées (cas Mercia 16/10 :
 * l'écran comptait encore 4h16m sur une estimation que l'admin venait
 * d'écarter).
 */
export function estLigneHorsCalcul(att) {
  return !!att && (estEstimationEcartee(att) || att.anomalie === 'sortie_presumee_remplacee'
    || (!!att.estimation_remplacee_le && !!att.estimation_source_id))
}

/** Vrai si la ligne est une estimation remplacée par un vrai pointage. */
export function estEstimationRemplacee(att) {
  return !!att && !!att.estimation_remplacee_le
}

/**
 * UNE JOURNÉE EST-ELLE UN « OUBLI DE BADGE » ? — le prédicat unique du
 * compteur « Oublis badge » (Pointages) et de la colonne CSV « Oubli Badge ».
 *
 * Un oubli, c'est une session qui n'a TOUJOURS PAS de sortie réelle :
 *   · dernier geste = une arrivée, sans rien après elle ; ou
 *   · la session n'est fermée que par une ESTIMATION —
 *       - encore à statuer (⏳) : l'oubli est réel, maquillé par une supposition ;
 *       - ÉCARTÉE (🚫) : l'admin vient de dire « cette heure est fausse » — la
 *         sortie réelle manque donc PLUS que jamais. Le compteur doit le
 *         RECOMPTER immédiatement (cas MADEDE 16/10 : après « Écarter », le
 *         badge « Oublis » retombait à 0 alors que la journée restait ouverte).
 *
 * Ce qui FERME une journée (ce n'est donc plus un oubli) :
 *   · un vrai badge de sortie ;
 *   · une estimation VALIDÉE (l'humain a tranché l'heure : elle fait foi) ;
 *   · une estimation REMPLACÉE par un vrai badge (la vérité terrain est arrivée).
 *
 * Le seuil de 8 h est mesuré sur la SESSION (l'arrivée), jamais sur
 * l'estimation : une journée commencée il y a 9 h sans sortie réelle est un
 * oubli, même si la supposition du moteur n'a que 30 minutes.
 */
export function estJourneeOubliBadge(attendances, maintenantMs = Date.now(), seuilMs = 8 * 3600 * 1000) {
  const gestes = (attendances || [])
    .map((a) => ({
      t: new Date(a.check_time).getTime(),
      type: String(a.check_type || '').toLowerCase(),
      row: a,
    }))
    .filter((g) => Number.isFinite(g.t))
    .sort((a, b) => a.t - b.t)

  //  Dernière session = dernière arrivée. Pas d'arrivée ce jour-là (fin de
  //  garde de nuit rattachée à la veille, journée de congé…) : pas d'oubli.
  const inDernier = [...gestes].reverse().find((g) => g.type === 'in')
  if (!inDernier) return false

  //  Session encore en cours ou trop récente : ce n'est pas (encore) un oubli.
  if (maintenantMs - inDernier.t <= seuilMs) return false

  //  Une vérité (vrai badge) ou une décision (validée / remplacée) ferme la
  //  session. À STATUER ou ÉCARTÉE = la sortie réelle manque toujours.
  const fermee = gestes.some((g) => {
    if (g.type !== 'out' || g.t <= inDernier.t) return false
    const row = g.row
    const auto = row.is_auto_closed === true || row.is_auto_closed === 'true'
    if (!auto) return true
    if (estEstimationEcartee(row)) return false
    if (row.estimation_validee_le) return true
    if (row.estimation_remplacee_le) return true
    return false
  })
  return !fermee
}

// ───────────────────────────────────────────────────────────────────────────
//  CONSIGNÉE ou INVENTÉE — la distinction qui a coûté un 400 le 16/10 à 08:54.
// ───────────────────────────────────────────────────────────────────────────
//  Un bandeau « Valider / Écarter » présuppose qu'il existe UNE LIGNE à statuer.
//  Or le moteur d'affichage invente des sorties qu'il ne stocke nulle part :
//  `hoursCalculator.js` fabrique trois objets `{ id: 'virtual-out-<uuid>',
//  __virtual: true }` (l.511, l.636, l.1639). Envoyer cet identifiant à
//  `encheck_estimation_statuer(p_ids uuid[], …)`, c'est demander à Postgres de
//  caster `'virtual-out-e24bb1d9-…'` en `uuid` :
//    22P02  invalid input syntax for type uuid: "virtual-out-e24bb1d9-…"
//  Le 404 de 08:36 (mauvais NOM de paramètre) et ce 400 de 08:54 (mauvais
//  TYPE de valeur) sont deux visages de la même absence de contrat : le JS
//  envoie ce qu'il a sous la main, la base attend une clé primaire.
//  On ne répare PAS en fabriquant un faux uuid — on arrête de proposer une
//  décision sur du vent. `encheck_cloturer_pivotable` est REVOQUÉE pour
//  `authenticated` (migration l.1866/1880) : le navigateur ne peut pas
//  consigner lui-même, c'est le cron 30 3 * * * qui écrit, puis l'humain statue.
const UUID_DE_BASE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Vrai si `valeur` a la forme d'une clé primaire `attendances.id`. */
export function estIdentifiantDeBase(valeur) {
  return typeof valeur === 'string' && UUID_DE_BASE.test(valeur)
}

/**
 * Vrai si cette sortie estimée est une ligne RÉELLEMENT EN BASE, donc statuable.
 * Faux pour une sortie inventée à la lecture (`__virtual`) et faux pour tout
 * identifiant qui n'est pas un uuid — la seconde vérification sert de garde-fou si un
 * objet est fabriqué plus tard sans la marque `__virtual`.
 */
export function estLigneConsigneeEnBase(att) {
  if (!att) return false
  if (att.__virtual === true) return false
  return estIdentifiantDeBase(att.id)
}

/** Vrai si le pointage a été neutralisé comme double lecture QR (rebond). */
export function estRebondNeutralise(att) {
  return !!att && att.anomalie === 'rebond_qr'
}

/**
 * Les pointages qui peuvent entrer dans un calcul de paie : tout ce qui a été
 * réellement badgé, plus les estimations VALIDÉES par un humain. Les rebonds
 * neutralisés en sortent (avant, ils étaient soit supprimés en base, soit ignorés
 * par un `continue` enfoui dans une boucle de 400 lignes).
 *
 * B1 (arbitrage n°2, décision argent) — ZÉRO RÉTROACTIVITÉ : le cadre
 * « estimation non validée = non payée » ne s'applique qu'aux pointages du
 * 16/10/2026 (mise en service) et après. Les sorties automatiques ANTÉRIEURES
 * restent comptées comme avant : un bulletin déjà édité ne doit pas fondre.
 */
export const BORNE_APPLICATION_ESTIMATION = '2026-10-16'

export function filtrerPointagesPayables(attendances) {
  return (attendances || []).filter((a) => {
    if (estRebondNeutralise(a)) return false
    if (estEstimationNonValidee(a)) {
      //  B1 — NON-RÉTROACTIVITÉ : avant la mise en service du cadre
      //  (16/10/2026 EXCLUS), comportement historique, ces heures ont été
      //  payées de bonne foi : comptées. Une ligne SANS date n'est pas
      //  « avant la borne » : inconnue = stricte (jamais payée).
      return Boolean(a.check_time) && String(a.check_time) < BORNE_APPLICATION_ESTIMATION
    }
    return true
  })
}

/**
 * La confiance d'une estimation se lit-elle en pourcentage ? Non, en l'état : la
 * colonne `attendances.estimation_confiance` est déclarée `text` par la migration
 * (l.65) et le SQL y écrit un MOT — `COALESCE(v_det->>'confiance','faible')`
 * (l.1006). L'écran faisait `Math.round(valeur * 100) + '%'`, ce qui rend
 * « confiance NaN% » dès qu'une ligne estimée existe vraiment en base. Ce
 * convertisseur accepte les deux formes sans en inventer une troisième : nombre
 * 0…1 → pourcentage, nombre 1…100 → pourcentage déjà échelonné, sinon le mot.
 */
export function formatConfianceEstimation(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null
  //  Un nombre qui n'en est pas un (NaN, Infinity) ne doit JAMAIS trouver le
  //  chemin de l'écran : « confiance NaN% » était déjà le bug d'origine.
  if (typeof valeur === 'number' && !Number.isFinite(valeur)) return null
  const n = Number(valeur)
  if (Number.isFinite(n)) {
    if (n >= 0 && n <= 1) return `${Math.round(n * 100)} %`
    if (n > 1 && n <= 100) return `${Math.round(n)} %`
  }
  return String(valeur)
}

/** Étiquette lisible d'une ligne estimée (réutilisée par toutes les vues).
 *  Arbitrage n°3 — les deux sorties d'une estimation ne se ressemblent pas :
 *  « ÉCARTÉE » (l'admin a jugé l'heure fausse) ≠ « REMPLACÉE » (un vrai badge
 *  est arrivé). Les deux remplissent `estimation_remplacee_le` mais le champ
 *  `anomalie` les distingue : c'est lui qu'il faut lire. */
export function etiquetteEstimation(att) {
  if (!att) return ''
  if (estEstimationEcartee(att)) return 'écartée par l\'admin — non payée'
  if (att.estimation_remplacee_le) return 'remplacée par un pointage réel'
  if (att.estimation_validee_le) return 'présumée, validée'
  if (att.is_auto_closed) return '⏳ présumée — non payée'
  return ''
}

// ═══════════════════════════════════════════════════════════════════════════
// FENÊTRE CIRCULAIRE — le piège n°3 de l'analyse (minuit et BETWEEN)
// ═══════════════════════════════════════════════════════════════════════════
//  `where heure_entree between '21:30' and '01:30'` ne renvoie AUCUNE ligne :
//  bornes inversées. Tout worker de nuit disparaissait donc silencieusement du
//  cluster d'apprentissage. Le calcul se fait sur les minutes du jour, modulo
//  1440, en distance la plus courte des deux sens.

export function minutesDuJour(valeur) {
  if (valeur === null || valeur === undefined) return null
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null
  if (valeur instanceof Date) return valeur.getHours() * 60 + valeur.getMinutes()
  const m = String(valeur).match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Distance la plus courte entre deux heures du jour, en minutes (0…720). */
export function distanceCirculaireMinutes(a, b) {
  const ma = typeof a === 'number' ? a : minutesDuJour(a)
  const mb = typeof b === 'number' ? b : minutesDuJour(b)
  if (ma === null || mb === null) return null
  const d = Math.abs((((ma % 1440) + 1440) % 1440) - (((mb % 1440) + 1440) % 1440))
  return Math.min(d, 1440 - d)
}

/** Vrai si `a` et `b` tombent dans le même créneau d'±`demiFenetre` minutes. */
export function dansLaFenetre(a, b, demiFenetreMinutes = SEUILS_PAR_DEFAUT.clusterFenetreMinutes) {
  const d = distanceCirculaireMinutes(a, b)
  return d !== null && d <= demiFenetreMinutes
}

/**
 * Contrôle de cohérence d'une cible d'estimation (miroir JS des garde-fous SQL).
 * Retourne `{ ok:false, motif }` au lieu de laisser passer une absurdité :
 * la version d'origine plafonnait à 14 h et acceptait n'importe quoi en dessous.
 */
export function validerCibleEstimation(entreeMs, cibleMs, seuils = SEUILS_PAR_DEFAUT, nowMs = Date.now()) {
  const entree = typeof entreeMs === 'number' ? entreeMs : new Date(entreeMs).getTime()
  const cible = typeof cibleMs === 'number' ? cibleMs : new Date(cibleMs).getTime()
  if (!Number.isFinite(entree) || !Number.isFinite(cible)) return { ok: false, motif: 'date_invalide' }
  if (cible <= entree) return { ok: false, motif: 'cible_avant_entree' }

  const minutes = (cible - entree) / 60000
  if (minutes < seuils.dureeMinimaleSessionMinutes) return { ok: false, motif: 'session_trop_courte' }
  if (minutes > seuils.plafondInventionHeures * 60) {
    return {
      ok: true,
      plafonnee: true,
      cible: entree + seuils.plafondInventionHeures * 3600000,
      minutes: seuils.plafondInventionHeures * 60,
    }
  }
  if (cible > nowMs) return { ok: false, motif: 'cible_dans_le_futur' }
  return { ok: true, cible, minutes }
}

export default {
  SEUILS_PAR_DEFAUT,
  chargerSeuilsPointage,
  invaliderCacheSeuils,
  estEstimationNonValidee,
  estEstimationAStatuer,
  estEstimationEcartee,
  estLigneHorsCalcul,
  estEstimationRemplacee,
  estIdentifiantDeBase,
  estLigneConsigneeEnBase,
  estRebondNeutralise,
  filtrerPointagesPayables,
  etiquetteEstimation,
  formatConfianceEstimation,
  minutesDuJour,
  distanceCirculaireMinutes,
  dansLaFenetre,
  validerCibleEstimation,
}
