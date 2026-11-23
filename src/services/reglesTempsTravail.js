// src/services/reglesTempsTravail.js
// ═══════════════════════════════════════════════════════════════════════════
// ⏰ RÈGLES DE TEMPS DE TRAVAIL — la porte du client vers la table versionnée
//
// CE QUE CE SERVICE EST
//   Un traducteur mince au-dessus de trois RPC :
//     · `encheck_regle_resolue`   → quelle valeur s'applique, et d'où elle vient ;
//     · `encheck_regle_ecrire`    → une nouvelle version (jamais une réécriture) ;
//     · `encheck_regle_historique`→ qui a décidé, quand, et ce que ça a remplacé.
//
// CE QU'IL N'EST PAS — ET NE DOIT PAS DEVENIR
//   Il ne calcule AUCUNE règle. La résolution vit dans Postgres : c'est le seul
//   endroit où l'on ne peut pas la contourner depuis un navigateur. Ce fichier
//   formate, valide tôt (pour un message clair) et traduit les erreurs.
//
// ⚠️ Aucune de ces valeurs n'est une règle légale : ce sont des paramètres
//    d'entreprise ou des décisions nominatives (§6.3, D5).
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '../lib/db'

/** Les cinq clés connues. Trois seulement se personnalisent (§3.5.a). */
export const CLES = {
  REPOS_MINIMUM: 'repos_minimum_heures',
  ALERTE_HEBDO: 'alerte_hebdo_heures',
  ALERTE_HEBDO_NIVEAU2: 'alerte_hebdo_niveau2_heures',
  DECLENCHEMENT_PAIE_HEBDO: 'declenchement_paie_hebdo_heures',
  PLAFOND_LEGAL: 'plafond_legal_heures',
}

export const CLES_PERSONNALISABLES = [
  CLES.REPOS_MINIMUM,
  CLES.ALERTE_HEBDO,
  CLES.ALERTE_HEBDO_NIVEAU2,
]

/**
 * Bornes techniques, miroir de celles de la RPC.
 * Elles existent ici pour prévenir AVANT l'aller-retour, jamais pour remplacer
 * le contrôle serveur : un client peut mentir, Postgres non.
 */
export const BORNES = {
  [CLES.REPOS_MINIMUM]: { max: 24, unite: 'h', raison: 'au-delà de 24 h, ce n’est plus une journée' },
  [CLES.ALERTE_HEBDO]: { max: 168, unite: 'h', raison: 'une semaine compte 168 h' },
  [CLES.ALERTE_HEBDO_NIVEAU2]: { max: 168, unite: 'h', raison: 'une semaine compte 168 h' },
}

const ORIGINES = {
  employe: 'valeur personnelle de l’employé',
  contrat: 'valeur prévue au contrat',
  entreprise: 'règle de l’entreprise',
  aucune: 'aucune règle enregistrée',
}

/** Comment nommer l'origine sans jamais laisser croire à une obligation. */
export function libelleOrigine(origine) {
  return ORIGINES[origine] || 'origine non déterminée'
}

/**
 * Valide une valeur avant l'écriture. Pure : testable sans base.
 * @returns {{ok: boolean, message: string|null}}
 */
export function validerValeur(cle, valeur) {
  if (valeur === null) return { ok: true, message: null } //  « non configuré » explicite

  const nombre = Number(valeur)
  if (!Number.isFinite(nombre) || nombre <= 0) {
    return { ok: false, message: 'Une valeur nulle ou négative ne règle rien.' }
  }

  const borne = BORNES[cle]
  if (borne && nombre > borne.max) {
    return {
      ok: false,
      message: `${nombre} ${borne.unite} dépasse la borne technique de ${borne.max} ${borne.unite} : ${borne.raison}.`,
    }
  }

  return { ok: true, message: null }
}

/** Une ligne de `encheck_regle_resolue` → objet lisible. Pure. */
export function normaliserResolution(ligne) {
  if (!ligne) return { valeur: null, origine: 'aucune', dateEffet: null, majPar: null, majLe: null, verrouille: false, regleId: null }

  return {
    //  `numeric` arrive parfois en chaîne : on convertit, sans arrondir.
    valeur: ligne.valeur === null || ligne.valeur === undefined ? null : Number(ligne.valeur),
    origine: ligne.origine || 'aucune',
    libelle: libelleOrigine(ligne.origine),
    dateEffet: ligne.date_effet || null,
    majPar: ligne.maj_par || null,
    majLe: ligne.maj_le || null,
    verrouille: ligne.verrouille === true,
    regleId: ligne.regle_id || null,
  }
}

/** Les lignes de `encheck_regle_historique` → versions lisibles. Pure. */
export function normaliserHistorique(lignes = []) {
  return lignes.map((l) => ({
    id: l.id,
    cle: l.cle,
    employeId: l.employe_id || null,
    valeur: l.valeur === null || l.valeur === undefined ? null : Number(l.valeur),
    dateEffet: l.date_effet || null,
    verrouille: l.verrouille === true,
    majLe: l.maj_le || null,
    majPar: l.maj_par || null,
    remplaceId: l.remplace_id || null,
  }))
}

function traduireErreur(error) {
  const message = error?.message || ''
  if (/acces refuse/.test(message)) return new Error('Accès refusé à cette entreprise.')
  if (/hors de cette entreprise/.test(message)) return new Error('Cet employé n’appartient pas à cette entreprise.')
  if (/ne se personnalise pas/.test(message)) return new Error('Cette règle ne peut pas être personnalisée par employé.')
  if (/verrouillee/.test(message)) return new Error('Cette valeur personnelle est verrouillée : seul un super-administrateur peut la changer.')
  if (/super-administrateur/.test(message)) return new Error('Cette action est réservée à un super-administrateur.')
  if (/depasser le premier/.test(message)) return new Error('Le second niveau doit dépasser le premier seuil.')
  if (/24 h au plus|168 h au plus|invalide/.test(message)) return new Error(message)
  if (error?.code === 'PGRST202') {
    return new Error('Cette fonction n’est pas encore installée sur ce serveur.')
  }
  return new Error(message || 'La règle n’a pas pu être enregistrée.')
}

/**
 * Quelle valeur s'applique à cette date ? La décision est prise par Postgres.
 * @returns {Promise<ReturnType<typeof normaliserResolution>>}
 */
export async function resoudre({ entrepriseId, employeId = null, cle, date = null }) {
  const { data, error } = await db().rpc('encheck_regle_resolue', {
    p_entreprise: entrepriseId,
    p_employe: employeId,
    p_cle: cle,
    p_date: date,
  })
  if (error) throw traduireErreur(error)

  //  Les RPC `returns table` rendent un tableau : une ligne, ou aucune.
  const ligne = Array.isArray(data) ? data[0] : data
  return normaliserResolution(ligne)
}

/**
 * Écrit une NOUVELLE version. L'ancienne reste dans l'historique.
 * @returns {Promise<string>} identifiant de la version créée
 */
export async function ecrire({
  entrepriseId,
  employeId = null,
  cle,
  valeur,
  dateEffet = null,
  verrouille = false,
}) {
  const controle = validerValeur(cle, valeur)
  if (!controle.ok) throw new Error(controle.message)

  const { data, error } = await db().rpc('encheck_regle_ecrire', {
    p_entreprise: entrepriseId,
    p_employe: employeId,
    p_cle: cle,
    p_valeur: valeur,
    p_date_effet: dateEffet,
    p_verrouille: verrouille === true,
  })
  if (error) throw traduireErreur(error)
  return data
}

/** L'historique complet d'une entreprise, d'un employé, ou d'une clé. */
export async function historique({ entrepriseId, employeId = null, cle = null }) {
  const { data, error } = await db().rpc('encheck_regle_historique', {
    p_entreprise: entrepriseId,
    p_employe: employeId,
    p_cle: cle,
  })
  if (error) throw traduireErreur(error)
  return normaliserHistorique(Array.isArray(data) ? data : [])
}
