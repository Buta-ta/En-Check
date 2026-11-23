// src/lib/reglesPersonnelles.js
// ═══════════════════════════════════════════════════════════════════════════
// 👤 LES RÉGLAGES D'UNE PERSONNE — trois états, et rien d'autre
//
// Ce que la fiche employé doit pouvoir dire, clé par clé (§3.5) :
//   · `suit_entreprise`         — la valeur vient de la règle commune ;
//   · `personnelle`             — une décision nominative s'applique ;
//   · `personnelle_verrouillee` — la même, mais seul un super-administrateur
//                                 peut la changer ;
//   · `aucune`                  — rien n'est enregistré. L'écran le DIT ; il
//                                 n'affiche ni 0, ni une coche verte.
//
// Ce fichier est PUR : aucun appel réseau, aucune lecture de la base. C'est ce
// qui permet de prouver les états sans monter un serveur.
//
// ⚠️ Aucune de ces valeurs n'est une règle légale (D5) : ce sont des paramètres
//    d'entreprise ou des décisions nominatives.
// ═══════════════════════════════════════════════════════════════════════════

import { jourCourt } from '../utils/jourCourt'

/**
 * Les trois clés personnalisables, dans l'ordre où la fiche les lit.
 * Les chaînes sont les mêmes que celles de `encheck_regle_ecrire` : c'est la
 * base qui les valide, ici on ne fait que les nommer.
 */
export const CLES_REGLAGES = [
  {
    cle: 'repos_minimum_heures',
    libelle: 'Repos entre deux journées',
    aide: 'Le temps minimum entre la fin d’une journée et le début de la suivante.',
  },
  {
    cle: 'alerte_hebdo_heures',
    libelle: 'Seuil d’alerte hebdomadaire',
    aide: 'Au-delà, l’entreprise est alertée. Ce n’est pas un plafond.',
  },
  {
    cle: 'alerte_hebdo_niveau2_heures',
    libelle: 'Second niveau d’alerte',
    aide: 'Un second repère, au-dessus du premier seuil.',
  },
]

export const ETATS = {
  suit_entreprise: 'Règle de l’entreprise',
  personnelle: 'Réglage personnel',
  personnelle_verrouillee: 'Réglage personnel · verrouillé',
  aucune: 'Aucune valeur',
}

/** L'état d'un réglage, déduit de la résolution rendue par le serveur. */
export function etatReglage(resolution) {
  if (!resolution) return 'aucune'
  if (resolution.verrouille === true) return 'personnelle_verrouillee'
  if (resolution.origine === 'employe') return 'personnelle'
  if (resolution.origine === 'entreprise' || resolution.origine === 'contrat') return 'suit_entreprise'
  return 'aucune'
}

export function libelleEtat(etat) {
  return ETATS[etat] || ETATS.aucune
}

/** Une valeur absente s'écrit « non configuré » — jamais « 0 h ». */
export function formaterValeurHeures(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return 'non configuré'
  const nombre = Number(valeur)
  if (!Number.isFinite(nombre)) return 'non configuré'
  return `${nombre} h`
}

/** « 2026-10-12 » → « 12 oct. 2026 ». Sans passer par Date : pas de glissement. */
export function dateEffetCourte(cle) {
  if (!cle) return null
  const annee = String(cle).slice(0, 4)
  return `${jourCourt(cle)} ${annee}`.trim()
}

/** L'état se lit-il comme une décision nominative ? (verrou compris) */
export function estPersonnelle(etat) {
  return etat === 'personnelle' || etat === 'personnelle_verrouillee'
}

/**
 * L'aperçu d'impact d'une écriture PERSONNELLE.
 *
 * Il n'y a qu'une personne concernée — c'est le sens même d'un réglage
 * nominatif. On ne réutilise donc pas `encheck_regle_impact` (qui parle de
 * l'entreprise entière) : on dit ce qui est vrai, et seulement cela.
 *
 * `ecritureBloquee` vient du VERROU, jamais d'une déduction sur le rôle : le
 * serveur refusera aussi, on ne fait qu'annoncer avant.
 */
export function apercuReglagePersonnel({ resolution, valeur, verrouille = false, superAdmin = false }) {
  const actuelle = resolution?.valeur ?? null
  const brute = valeur === '' || valeur === null || valeur === undefined ? null : Number(valeur)
  const nouvelle = Number.isFinite(brute) ? brute : null
  const verrouillee = resolution?.verrouille === true

  return {
    personnesConcernees: 1,
    valeurActuelle: actuelle,
    nouvelleValeur: nouvelle,
    change: actuelle !== nouvelle,
    verrouillee,
    ecritureBloquee: verrouillee && superAdmin !== true,
    verrouDemande: verrouille === true,
  }
}

/**
 * Ce que l'écran peut dire d'un retour à la règle de l'entreprise.
 * Le retour n'est un acte que s'il y a une décision personnelle à retirer.
 */
export function retourPossible(etat) {
  return estPersonnelle(etat)
}

/** Le texte de l'effet, en une phrase, sans jargon. */
export function phraseImpact(impact) {
  if (!impact) return ''
  const avant = formaterValeurHeures(impact.valeurActuelle)
  const apres = formaterValeurHeures(impact.nouvelleValeur)
  if (impact.change) return `Cette personne passerait de ${avant} à ${apres}.`
  return `La valeur resterait ${avant} : une nouvelle version serait enregistrée, sans changement de valeur.`
}
