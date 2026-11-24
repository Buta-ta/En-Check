// src/services/mesInformations.js
// ═══════════════════════════════════════════════════════════════════════════
// 👁️ « CE QU'ON M'A DIT » — le devoir d'informer, vu depuis l'espace employé
//
// POURQUOI CE FICHIER EXISTE
//   La base émet une information chaque fois qu'un réglage personnel bouge
//   (§3.5.g) : posé, verrouillé, retiré — ou conservé malgré une règle
//   d'entreprise. Ces informations existaient, mais restaient invisibles : elles
//   n'étaient lisibles que par un administrateur, et `consulte_le` restait nul
//   pour toujours. Une information que la personne concernée ne peut pas lire —
//   ni marquer lue — n'est qu'une trace d'émission.
//
// CE QUE CE FICHIER NE FAIT PAS
//   · il ne fabrique aucun texte : la base envoie la phrase figée du jour J ;
//   · il n'invente aucune date : `consulteLe` vient de la base, et la première
//     lecture ne se déplace pas ;
//   · il ne devine pas le destinataire : les deux RPC le déduisent de la
//     session (`employees.user_id = auth.uid()`), pas d'un paramètre d'URL.
//
// ⚠️ `db()` choisit le client selon l'espace où l'on se trouve : appelées depuis
//    `/employee/*`, ces fonctions parlent avec la session employé. Appelées
//    depuis l'administration, elles échouent — c'est voulu, on ne lit pas à la
//    place de quelqu'un.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '../lib/db'

/**
 * Les erreurs de la base, en français — et seulement celles qu'on sait traduire.
 *
 * ⚠️ Pas de `traduireErreur` de `reglesTempsTravail` : ses phrases parlent de
 *    règles d'entreprise (« accès refusé à cette entreprise ») et seraient
 *    fausses ici. Un employé n'agit pas sur une entreprise, il lit ce qu'on lui
 *    a adressé.
 */
function traduireErreur(error) {
  const message = error?.message || ''
  if (/aucune fiche employe/.test(message)) {
    return new Error('Ce compte n’est rattaché à aucune fiche employé : demandez à votre administration.')
  }
  if (/ne vous est pas adressee/.test(message)) {
    return new Error('Cette information ne vous est pas adressée.')
  }
  if (/information inconnue/.test(message)) {
    return new Error('Cette information n’existe plus.')
  }
  if (error?.code === 'PGRST202') {
    return new Error('Cet espace n’est pas encore ouvert par votre administration.')
  }
  return new Error(message || 'Les informations n’ont pas pu être lues.')
}

/** Pourquoi une information a été émise — en français, jamais en code. */
export const EVENEMENTS_INFORMATION = {
  valeur_personnelle_posee: 'Votre réglage personnel a été enregistré',
  valeur_personnelle_verrouillee: 'Votre réglage personnel a été verrouillé',
  valeur_personnelle_retiree: 'Votre réglage personnel a été retiré',
  reglage_personnel_conserve: 'Votre réglage personnel reste applicable',
}

/**
 * Le libellé d'un événement. Inconnu ⇒ on ne prétend rien : on rend le code,
 * qui reste vrai, plutôt qu'une phrase inventée qui serait fausse.
 */
export function libelleEvenement(evenement) {
  return EVENEMENTS_INFORMATION[evenement] || evenement || 'Information'
}

/**
 * Une ligne de `encheck_informations_employe` → objet lisible. Pure : aucun
 * accès réseau, donc vérifiable sans base.
 */
export function normaliserMesInformations(lignes = []) {
  return (Array.isArray(lignes) ? lignes : []).map((l) => ({
    id: l.id,
    cle: l.cle,
    evenement: l.evenement,
    libelle: libelleEvenement(l.evenement),
    //  Le texte émis, tel quel. Il ne se recalcule pas : ce qui a été dit le
    //  jour J ne change pas parce qu'une règle a bougé depuis.
    contenu: l.contenu,
    valeurAvant: l.valeur_avant === null || l.valeur_avant === undefined ? null : Number(l.valeur_avant),
    valeurApres: l.valeur_apres === null || l.valeur_apres === undefined ? null : Number(l.valeur_apres),
    dateEffet: l.date_effet || null,
    emisLe: l.emis_le || null,
    consulteLe: l.consulte_le || null,
    //  Deux états, en mots — jamais la couleur seule.
    etat: l.consulte_le ? 'consultee' : 'a_consulter',
    etatLibelle: l.consulte_le ? 'Consultée' : 'À consulter',
  }))
}

/** Combien restent à lire. Sert la pastille de l'espace employé. */
export function compterAConsulter(informations = []) {
  return (Array.isArray(informations) ? informations : [])
    .filter((i) => i && !i.consulteLe).length
}

/** Ce qu'on a dit à l'employé connecté. Aucun identifiant n'est transmis. */
export async function mesInformations() {
  const { data, error } = await db().rpc('encheck_informations_employe')
  if (error) throw traduireErreur(error)
  return normaliserMesInformations(Array.isArray(data) ? data : [])
}

/**
 * « J'ai lu ». Rend la date de consultation telle que la base l'a posée —
 * donc la PREMIÈRE, même si l'écran appelle deux fois.
 */
export async function marquerConsultee(informationId) {
  if (!informationId) {
    throw new Error('Information manquante : rien à marquer.')
  }
  const { data, error } = await db().rpc('encheck_information_consultee', {
    p_information: informationId,
  })
  if (error) throw traduireErreur(error)
  return data || null
}
