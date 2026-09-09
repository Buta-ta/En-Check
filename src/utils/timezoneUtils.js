// ═══════════════════════════════════════════════════════════════════════════
// 🕐 UTILITAIRES DE FUSEAU HORAIRE — VERSION 2 (livraison 04)
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QUI A CHANGÉ ET POURQUOI
// ───────────────────────────
// AVANT : toutes les heures étaient formatées avec getUTCHours(). Autrement
// dit, une arrivée à 08:00 à Cotonou — enregistrée à 07:00 UTC — s'affichait
// « 07:00 », et surtout était COMPARÉE à 07:00 face à une heure d'arrivée
// configurée à « 08:00 ». Tous les retards étaient donc faux du décalage du
// pays.
//
// APRÈS : les fonctions s'appuient sur le FUSEAU DE L'ENTREPRISE
// (`enterprises.timezone`, ajouté en livraison 04). Les données stockées en
// base restent en UTC — on ne touche à rien côté base — et la conversion se
// fait à l'affichage et au calcul.
//
// ⚠️ COMPATIBILITÉ : tous les noms d'origine sont conservés, avec un
// paramètre `timezone` OPTIONNEL en plus. Les fichiers qui appellent
// `formaterHeureLocale(uneDate)` continuent de fonctionner — mais désormais
// à la bonne heure. Tu n'es pas obligé de les modifier tous.
//
// ⚠️ SI AUCUN FUSEAU N'EST CONFIGURÉ, on retombe sur UTC : c'est exactement
// le comportement d'avant cette livraison. Aucun risque de régression.

// ───────────────────────────────────────────────────────────────────────────
// 1. FUSEAU ACTIF
// ───────────────────────────────────────────────────────────────────────────

const FUSEAU_PAR_DEFAUT = 'UTC'

let _fuseauForce = null   // défini par setActiveTimezone()
// ⚠️ `undefined` et non `null` : localStorage.getItem() renvoie null quand il
// n'y a pas de session. Avec `null` comme valeur initiale, la comparaison ne
// déclenchait jamais la première lecture et la fonction renvoyait null.
let _cacheBrut = undefined   // dernière valeur brute lue dans localStorage
let _cacheFuseau = null      // fuseau qui correspond à _cacheBrut

/**
 * Vrai si le nom de fuseau est reconnu (ex: 'Africa/Porto-Novo', 'UTC').
 * Refuse tout ce qui n'est pas une chaîne plausible, pour ne jamais laisser
 * une valeur corrompue casser silencieusement l'affichage.
 */
export const isValidTimezone = (tz) => {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Fuseau horaire actif, dans cet ordre de priorité :
 *   1. un appel explicite à setActiveTimezone()
 *   2. `admin.selectedEnterprise.timezone`      (session administrateur)
 *   3. `admin.entreprises[0].timezone`          (repli : 1re entreprise)
 *   4. `employee.enterprise_timezone`           (session employé, si fournie)
 *   5. UTC                                       (comportement d'avant la 04)
 *
 * La lecture de localStorage est mémoïsée sur la chaîne brute : le coût est
 * nul tant que la session ne change pas, et la bascule d'entreprise est
 * prise en compte IMMÉDIATEMENT (le commutateur réécrit la clé `admin`).
 */
export const getActiveTimezone = () => {
  if (_fuseauForce) return _fuseauForce

  try {
    if (typeof localStorage === 'undefined') return FUSEAU_PAR_DEFAUT

    const brut = localStorage.getItem('admin')
    if (brut !== _cacheBrut) {
      _cacheBrut = brut
      let trouve = null
      try {
        const admin = JSON.parse(brut || '{}')
        trouve =
          admin?.selectedEnterprise?.timezone ||
          admin?.entreprises?.[0]?.timezone ||
          null
      } catch {
        trouve = null
      }

      if (!trouve) {
        try {
          const employe = JSON.parse(localStorage.getItem('employee') || '{}')
          trouve = employe?.enterprise_timezone || employe?.timezone || null
        } catch {
          trouve = null
        }
      }

      // Un fuseau enregistré côté navigateur prend le pas sur « UTC », mais
      // un fuseau invalide ne doit jamais casser l'affichage.
      _cacheFuseau = isValidTimezone(trouve) ? trouve : FUSEAU_PAR_DEFAUT
    }
    return _cacheFuseau || FUSEAU_PAR_DEFAUT
  } catch {
    return FUSEAU_PAR_DEFAUT
  }
}

/**
 * Force le fuseau pour toute l'application (à appeler quand on connaît
 * l'entreprise mais qu'elle n'est pas dans localStorage — par exemple dans
 * l'espace employé). Passer null rétablit la détection automatique.
 */
export const setActiveTimezone = (tz) => {
  _fuseauForce = isValidTimezone(tz) ? tz : null
  _cacheBrut = null     // on invalide le mémo pour repartir des données fraîches
}

/** Rétablit la détection automatique depuis la session. */
export const resetActiveTimezone = () => setActiveTimezone(null)

// ───────────────────────────────────────────────────────────────────────────
// 2. MOTEUR DE CONVERSION (jamais visible de l'extérieur)
// ───────────────────────────────────────────────────────────────────────────

const _cacheFormateurs = new Map()

const obtenirFormateur = (timeZone, options) => {
  const cle = `${timeZone}|${JSON.stringify(options)}`
  let formateur = _cacheFormateurs.get(cle)
  if (!formateur) {
    formateur = new Intl.DateTimeFormat('en-GB', { ...options, timeZone })
    _cacheFormateurs.set(cle, formateur)
  }
  return formateur
}

/**
 * Les composantes « heure locale » d'un instant UTC donné.
 * @returns {{annee:number, mois:number, jour:number, heures:number, minutes:number, secondes:number}}
 */
export const getPartsLocaux = (utcDateString, timezone) => {
  const vide = { annee: 1970, mois: 1, jour: 1, heures: 0, minutes: 0, secondes: 0, jourISO: '' }
  if (!utcDateString) return vide

  const date = utcDateString instanceof Date ? utcDateString : new Date(utcDateString)
  if (Number.isNaN(date.getTime())) return vide

  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()

  const parties = obtenirFormateur(tz, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const lire = (type) => {
    const trouve = parties.find((p) => p.type === type)
    return trouve ? Number(trouve.value) : 0
  }

  const resultat = {
    annee: lire('year'),
    mois: lire('month'),
    jour: lire('day'),
    heures: lire('hour'),
    minutes: lire('minute'),
    secondes: lire('second'),
  }

  return {
    ...resultat,
    jourISO: `${resultat.annee}-${String(resultat.mois).padStart(2, '0')}-${String(resultat.jour).padStart(2, '0')}`,
  }
}

/**
 * Décalage d'un fuseau par rapport à UTC, en millisecondes, À L'INSTANT DONNÉ.
 * C'est ce qui rend l'heure d'été française et le Ramadan marocain corrects.
 */
const decalageMs = (date, tz) => {
  const p = getPartsLocaux(date, tz)
  const telQuEnUTC = Date.UTC(p.annee, p.mois - 1, p.jour, p.heures, p.minutes, p.secondes)
  return telQuEnUTC - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * ⭐ FONCTION CLÉ : convertir une heure « murale » (celle qu'on lit sur une
 * horloge ou dans un formulaire) vers l'instant UTC réellement stocké en base.
 *
 * @param {string} jourISO  'AAAA-MM-JJ'
 * @param {number} heures 0-23
 * @param {number} minutes 0-59
 * @param {number} secondes 0-59
 * @param {string} [timezone] défaut : fuseau actif
 * @returns {string|null} chaîne ISO UTC (ex: '2026-09-20T07:00:00.000Z')
 *
 * ⚠️ HEURE INEXISTANTE : au passage à l'heure d'été (dernier dimanche de mars
 * en Europe, 2e dimanche de mars aux États-Unis), l'heure 02:00 n'existe pas
 * sur une horloge. Si on demande 02:30, on renvoie l'instant qui suit le saut,
 * donc 03:30 locales. Aucune donnée n'est perdue : la convention est la même
 * que celle des bibliothèques de référence. Ce cas ne concerne que les
 * entreprises européennes/américaines, deux nuits par an, à 3 h du matin.
 */
export const heureLocaleVersUTC = (jourISO, heures, minutes = 0, secondes = 0, timezone) => {
  if (!jourISO || typeof jourISO !== 'string') return null
  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()

  const [a, m, j] = jourISO.split('-').map(Number)
  if (!a || !m || !j) return null

  const telQuEnUTC = Date.UTC(a, m - 1, j, Number(heures) || 0, Number(minutes) || 0, Number(secondes) || 0)

  // Deux passes : la première estimation peut tomber du mauvais côté d'un
  // changement d'heure, la seconde corrige. C'est la méthode de référence
  // quand on n'utilise pas de bibliothèque.
  const candidat1 = telQuEnUTC - decalageMs(new Date(telQuEnUTC), tz)
  const candidat2 = telQuEnUTC - decalageMs(new Date(candidat1), tz)

  // Vérification : la seconde estimation redonne-t-elle bien l'heure demandée ?
  const correspond = (ms) => {
    const p = getPartsLocaux(new Date(ms), tz)
    return (
      p.annee === a && p.mois === m && p.jour === j &&
      p.heures === (Number(heures) || 0) &&
      p.minutes === (Number(minutes) || 0) &&
      p.secondes === (Number(secondes) || 0)
    )
  }

  // Cas normal : oui, on s'arrête là.
  if (correspond(candidat2)) return new Date(candidat2).toISOString()

  // Cas de l'heure INEXISTANTE (nuit du passage à l'heure d'été) : on choisit
  // toujours l'instant le PLUS TARDIF. Règle fixe, donc prévisible : on avance
  // d'une heure, on ne recule jamais. Sans cela, le même appel renvoyait
  // 03:00 pour Paris mais 01:00 pour Montréal — une heure de pointage qui
  // partait dans le mauvais sens selon le pays du client.
  return new Date(Math.max(candidat1, candidat2)).toISOString()
}

/**
 * L'inverse : un instant UTC → l'heure murale du fuseau.
 * @returns {{jourISO:string, heures:number, minutes:number, secondes:number, heuresTexte:string}}
 */
export const utcVersHeureLocale = (utcDateString, timezone) => {
  const p = getPartsLocaux(utcDateString, timezone)
  return {
    jourISO: p.jourISO,
    heures: p.heures,
    minutes: p.minutes,
    secondes: p.secondes,
    heuresTexte: `${String(p.heures).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}`,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 3. POUR LES CALCULS (retards, heures supplémentaires, rapports)
// ───────────────────────────────────────────────────────────────────────────
//
// ⭐ C'est ICI que se corrige le bug qui coûte de l'argent.
// Remplace, dans un calcul, `checkTime.getUTCHours()` par `getHeuresMinutesLocales()`
// et le retard redevient juste.

/** Heure locale (entreprise) d'un instant UTC. */
export const getHeuresMinutesLocales = (utcDateString, timezone) => {
  const p = getPartsLocaux(utcDateString, timezone)
  return { heures: p.heures, minutes: p.minutes, secondes: p.secondes, jourISO: p.jourISO }
}

/** Minutes écoulées depuis minuit, en heure locale de l'entreprise. */
export const minutesDepuisMinuit = (utcDateString, timezone) => {
  const p = getPartsLocaux(utcDateString, timezone)
  return p.heures * 60 + p.minutes
}

/** Jour calendaire (AAAA-MM-JJ) vécu par l'employé, et non celui d'UTC. */
export const jourLocal = (utcDateString, timezone) => getPartsLocaux(utcDateString, timezone).jourISO

// ───────────────────────────────────────────────────────────────────────────
// 3 bis. LA JOURNÉE DE TRAVAIL
// ───────────────────────────────────────────────────────────────────────────
//  Un service qui commence à 22:00 et finit à 06:00 appartient à la journée où
//  il a COMMENCÉ : sa deuxième moitié se déroule après minuit, mais elle compte
//  la veille. Chaque grille horaire peut donc déclarer une heure de bascule —
//  avant cette heure-là, on est encore la journée précédente. Sans déclaration,
//  la bascule est à minuit et le comportement ne change pas.

/** « 04:00 » ou 240 → 240 minutes ; rien de lisible → 0 (minuit). */
export const minutesDeBascule = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === '') return 0
  if (typeof valeur === 'number') {
    return Number.isFinite(valeur) ? Math.max(0, Math.min(1439, Math.round(valeur))) : 0
  }
  const m = String(valeur).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return 0
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return Number.isFinite(minutes) ? Math.max(0, Math.min(1439, minutes)) : 0
}

/**
 * Le nom de la journée de travail d'un pointage : on recule de la bascule, puis
 * on lit le jour local. Avec une bascule à minuit, c'est le jour local.
 */
export const jourDeTravail = (utcDateString, timezone, basculeMinutes = 0) => {
  const bascule = Number(basculeMinutes)
  if (!Number.isFinite(bascule) || bascule <= 0) return jourLocal(utcDateString, timezone)

  const date = utcDateString instanceof Date ? utcDateString : new Date(utcDateString)
  if (Number.isNaN(date.getTime())) return jourLocal(utcDateString, timezone)

  const decale = new Date(date.getTime() - Math.min(bascule, 1439) * 60000)
  return jourLocal(decale.toISOString(), timezone)
}

// ───────────────────────────────────────────────────────────────────────────
// 4. FORMATEURS D'AFFICHAGE (signatures d'origine conservées)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Formater une heure en HH:MM:SS, à l'heure de l'entreprise.
 */
export const formaterHeureLocale = (utcDateString, timezone) => {
  if (!utcDateString) return '--:--:--'
  const p = getPartsLocaux(utcDateString, timezone)
  if (!p.jourISO) return '--:--:--'   // date invalide ('' → getPartsLocaux renvoie jourISO vide)
  return `${String(p.heures).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}:${String(p.secondes).padStart(2, '0')}`
}

/**
 * Formater une heure en HH:MM, à l'heure de l'entreprise.
 */
export const formaterHeureLocaleShort = (utcDateString, timezone) => {
  if (!utcDateString) return '--:--'
  const p = getPartsLocaux(utcDateString, timezone)
  if (!p.jourISO) return '--:--'      // date invalide
  return `${String(p.heures).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}`
}

/**
 * Durée entre deux instants UTC, en minutes.
 * ⚠️ Volontairement indépendant du fuseau : une durée est une durée.
 */
export const calculerDureeMinutes = (startUTC, endUTC) => {
  if (!startUTC || !endUTC) return 0
  return Math.round((new Date(endUTC) - new Date(startUTC)) / (1000 * 60))
}

/** Durée entre deux instants UTC, en secondes. */
export const calculerDureeSecondes = (startUTC, endUTC) => {
  if (!startUTC || !endUTC) return 0
  return Math.round((new Date(endUTC) - new Date(startUTC)) / 1000)
}

/** Formater une durée « Xh YYmin ». */
export const formaterDuree = (minutes) => {
  if (!minutes || minutes <= 0) return '--'
  const heures = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (heures === 0) return `${mins}min`
  if (mins === 0) return `${heures}h`
  return `${heures}h${mins.toString().padStart(2, '0')}`
}

/** Formater une durée « Xh YYmin ZZsec ». */
export const formaterDureeComplete = (secondes) => {
  if (!secondes || secondes <= 0) return '0sec'
  const heures = Math.floor(secondes / 3600)
  const minutes = Math.floor((secondes % 3600) / 60)
  const secs = secondes % 60
  if (heures === 0 && minutes === 0) return `${secs}sec`
  if (heures === 0) return `${minutes}min ${secs}sec`
  if (minutes === 0 && secs === 0) return `${heures}h`
  if (secs === 0) return `${heures}h${minutes.toString().padStart(2, '0')}`
  return `${heures}h${minutes.toString().padStart(2, '0')}min ${secs}sec`
}

/** Date complète en français (« lundi 20 septembre 2026 »), heure de l'entreprise. */
export const formaterDateLocale = (utcDateString, timezone) => {
  if (!utcDateString) return ''
  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()
  return new Date(utcDateString).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
  })
}

/** Date et heure complètes avec secondes, heure de l'entreprise. */
export const formaterDateHeureLocale = (utcDateString, timezone) => {
  if (!utcDateString) return ''
  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()
  return new Date(utcDateString).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz,
  })
}

/**
 * Date du jour (AAAA-MM-JJ) — désormais le jour VÉCU PAR L'ENTREPRISE.
 * Utile : à 00:30 à Cotonou, il est encore 23:30 la veille en UTC. La liste
 * des pointages doit s'ouvrir sur le jour en cours de l'employé.
 */
export const obtenirDateDuJour = (timezone) => {
  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()
  return getPartsLocaux(new Date(), tz).jourISO
}

/** Date au format JJ/MM/AAAA, heure de l'entreprise. */
export const formaterDateCourte = (dateString, timezone) => {
  if (!dateString) return ''
  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz,
  })
}

// ───────────────────────────────────────────────────────────────────────────
// 5. AFFICHAGE DU FUSEAU LUI-MÊME
// ───────────────────────────────────────────────────────────────────────────
//
// ⚠️ L'ancien écran d'accueil annonçait « Fuseau: WAT (GMT+1) » alors qu'il
// affichait l'heure du NAVIGATEUR : un administrateur en France voyait
// l'heure de Paris avec l'étiquette de Cotonou. Ces fonctions donnent la
// vraie étiquette.

/** Décalage en texte, ex: '+01:00', '-04:00', '+05:30', à l'instant donné. */
export const timezoneOffsetLabel = (timezone, date = new Date()) => {
  if (!isValidTimezone(timezone)) return '—'
  const decalage = decalageMs(date, timezone)
  const signe = decalage < 0 ? '-' : '+'
  const totalMinutes = Math.round(Math.abs(decalage) / 60000)
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const m = String(totalMinutes % 60).padStart(2, '0')
  return `${signe}${h}:${m}`
}

/** Étiquette courte : « GMT+1 », « GMT-4 », « GMT+5:30 ». */
export const fuseauGMT = (timezone, date = new Date()) => {
  const label = timezoneOffsetLabel(timezone, date)
  if (label === '—') return '—'
  const signe = label[0]
  const [h, m] = label.slice(1).split(':')
  const heures = Number(h)
  return m === '00' ? `GMT${signe}${heures}` : `GMT${signe}${heures}:${m}`
}

/** Nom lisible du fuseau : « Porto-Novo », « New York ». */
export const nomCourtFuseau = (timezone) => {
  if (!isValidTimezone(timezone)) return 'UTC'
  return timezone.split('/').pop().replace(/_/g, ' ')
}

/** Étiquette complète : « Porto-Novo (GMT+1) ». */
export const libelleFuseau = (timezone, date = new Date()) => {
  const tz = isValidTimezone(timezone) ? timezone : getActiveTimezone()
  return `${nomCourtFuseau(tz)} (${fuseauGMT(tz, date)})`
}

// ───────────────────────────────────────────────────────────────────────────
// 6. COMPATIBILITÉ (anciennes fonctions conservées telles quelles)
// ───────────────────────────────────────────────────────────────────────────

/** Convertit « 2026-02-01T13:30 » (heure du navigateur) en ISO UTC. */
export const convertirLocaleVersUTC = (localDateTime) => {
  if (!localDateTime) return null
  return new Date(localDateTime).toISOString()
}

/** Convertit un ISO UTC en objet Date (le navigateur l'affichera chez lui). */
export const convertirUTCVersLocale = (utcString) => {
  if (!utcString) return null
  return new Date(utcString)
}

/** Vrai si « maintenant » est dans la plage donnée (comparaison d'instants). */
export const estDansPlageHoraire = (dateDebut, dateFin) => {
  const maintenant = Date.now()
  const debut = dateDebut ? new Date(dateDebut).getTime() : null
  const fin = dateFin ? new Date(dateFin).getTime() : null
  if (debut !== null && maintenant < debut) return false
  if (fin !== null && maintenant > fin) return false
  return true
}

export default {
  getActiveTimezone, setActiveTimezone, resetActiveTimezone, isValidTimezone,
  getPartsLocaux, heureLocaleVersUTC, utcVersHeureLocale,
  getHeuresMinutesLocales, minutesDepuisMinuit, jourLocal,
  formaterHeureLocale, formaterHeureLocaleShort,
  calculerDureeMinutes, calculerDureeSecondes, formaterDuree, formaterDureeComplete,
  formaterDateLocale, formaterDateHeureLocale, formaterDateCourte, obtenirDateDuJour,
  timezoneOffsetLabel, fuseauGMT, nomCourtFuseau, libelleFuseau,
  convertirLocaleVersUTC, convertirUTCVersLocale, estDansPlageHoraire,
}
