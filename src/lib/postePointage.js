// ═══════════════════════════════════════════════════════════════════════════
// 🖥️ LE POSTE DE POINTAGE — les fonctions que deux écrans partagent
//
// La page « Configuration pointeuse » administre le poste : elle lit ce que
// cet appareil a retenu, l'installe, ou le détache. L'écran du poste, lui,
// s'ouvre en plein écran sur la tablette de l'entrée. Les deux doivent parler
// du MÊME appareil, avec la MÊME clé de mémoire et la MÊME installation.
//
// D'où ce fichier : une seule définition de la clé, de l'identifiant
// d'appareil, de l'appel réseau qui rattache une tablette à une entreprise, et
// des phrases qui traduisent les refus du serveur en français d'employé.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'

// La mémoire de cet appareil : c'est elle qui fait d'une tablette un poste.
export const CLE_POSTE = 'encheck_poste'

export const DELAI_ENTRE_POINTAGES = 60 // secondes : en deçà, on ne repointe pas
export const DUREE_CONFIRMATION = 4000 // millisecondes d'affichage de la confirmation
export const SEUIL_ECART_HORLOGE = 120 // secondes : au-delà, l'heure de la tablette est fausse

// ─── Ce que veulent dire les refus du serveur, en langue d'employé ──────────
export const MESSAGES = {
  identifiants_incorrects: "Ce badge n'est pas reconnu sur ce poste. Présentez-le à nouveau, ou saisissez votre numéro.",
  pin_requis: 'Ce badge demande un code personnel.',
  pin_non_configure: "Aucun code personnel n'est configuré pour ce badge. Voyez l'administration.",
  trop_de_tentatives: "Trop d'essais sur ce poste. Patientez une minute.",
  entreprise_manquante: "Ce poste n'est plus rattaché à une entreprise active. Voyez l'administration.",
  code_manquant: "Aucun numéro n'a été saisi.",
  jeton_invalide: 'La session de ce poste a expiré. Représentez le badge.',
  jeton_d_un_autre_appareil: 'Ce badge a été utilisé sur un autre appareil. Représentez-le ici.',
  jeton_requis: "Ce poste doit être réinstallé. Voyez l'administration.",
  employe_inconnu_ou_inactif: 'Cette fiche employé est inactive. Voyez l’administration.',
  entreprise_incoherente: 'Ce badge appartient à une autre entreprise.',
  device_id_manquant: "Ce poste n'a pas d'identifiant. Réinstallez-le.",
  check_type_manquant: "Le geste n'a pas été reconnu. Recommencez.",
}

export function messageDe(raison) {
  if (!raison) return "Le pointage n'a pas abouti. Recommencez."
  return MESSAGES[raison] || `Le pointage n'a pas abouti (${raison}). Recommencez.`
}

// ─── La mémoire de l'appareil ──────────────────────────────────────────────
export function lirePoste() {
  try {
    const brut = localStorage.getItem(CLE_POSTE)
    if (!brut) return null
    const lu = JSON.parse(brut)
    if (!lu || !lu.enterprise_id || !lu.device_id) return null
    return lu
  } catch {
    return null
  }
}

export function enregistrerPoste(config) {
  try {
    localStorage.setItem(CLE_POSTE, JSON.stringify(config))
  } catch {
    /* une tablette sans mémoire : le poste marchera jusqu'au rechargement */
  }
  return config
}

export function oublierPoste() {
  try {
    localStorage.removeItem(CLE_POSTE)
  } catch {
    /* rien à faire */
  }
}

//  Un identifiant propre à CETTE tablette : c'est lui qui lie la session de
//  chaque employé à ce poste, et pas à un autre appareil.
export function identifiantAppareil(enterpriseId) {
  const debut = String(enterpriseId || '').slice(0, 8)
  const hasard = Math.random().toString(36).slice(2, 10)
  return `poste-${debut}-${hasard}`
}

// ─── L'appel qui rattache l'appareil à une entreprise ──────────────────────
//  Renvoie `{ config }` en cas de succès, `{ erreur }` avec une phrase lisible
//  sinon. L'écran du poste et sa configuration affichent donc les mêmes mots.
export async function installerPoste(code) {
  const valeur = String(code || '').trim()
  if (!valeur) return { erreur: 'Saisissez le code de votre entreprise.' }

  try {
    const { data, error } = await supabase.rpc('encheck_entreprise_par_code', { p_code: valeur })
    if (error) throw error
    const ent = Array.isArray(data) ? data[0] : data
    const id = identifiantEntreprise(ent)
    if (!id) {
      return {
        erreur:
          "Ce code ne correspond à aucune entreprise active. Vérifiez-le auprès de votre administration.",
      }
    }

    const config = enregistrerPoste({
      enterprise_id: id,
      nom: nomEntreprise(ent),
      code: valeur,
      device_id: identifiantAppareil(id),
      installe_le: new Date().toISOString(),
    })
    return { config }
  } catch {
    return {
      erreur:
        "La connexion au serveur a échoué. Vérifiez qu'Internet fonctionne, puis réessayez.",
    }
  }
}

// ─── Le nom de l'employé, sans présumer du nom des colonnes ────────────────
export function nomEmploye(e) {
  if (!e) return 'Employé'
  const assemble = (a, b) => [a, b].filter(Boolean).join(' ').trim()
  return (
    (e.nom_complet || '').trim() ||
    (e.full_name || '').trim() ||
    (e.name || '').trim() ||
    assemble(e.prenom || e.first_name, e.nom || e.last_name) ||
    e.matricule ||
    'Employé'
  )
}

// ─── Le nom de l'entreprise, sans présumer du nom des colonnes ─────────────
export function nomEntreprise(e) {
  if (!e) return 'En-Check'
  return (e.nom || e.name || e.raison_sociale || e.libelle || 'Votre entreprise').trim()
}

export function identifiantEntreprise(e) {
  return e?.id || e?.enterprise_id || null
}

// ─── Le sens du geste : l'inverse du dernier pointage de la garde en cours ──
//     Un dernier geste Entrée vieux de plus de 14 heures (oubli de dépointage
//     de la veille) est ignoré : on repart proprement sur une Entrée.
export function sensSuivant(dernier, maintenant = Date.now()) {
  if (!dernier) return 'in'
  const ecartSecondes = ecartDepuis(dernier, maintenant)
  if (ecartSecondes !== null && ecartSecondes > 14 * 3600) return 'in'
  if (String(dernier.check_type || '').toLowerCase() === 'in') return 'out'
  return 'in'
}

//  Les secondes écoulées depuis le dernier geste, ou null si on ne sait pas.
export function ecartDepuis(dernier, maintenant) {
  if (!dernier) return null
  const quand = new Date(dernier.check_time || dernier.check_in)
  if (Number.isNaN(quand.getTime())) return null
  return (maintenant - quand.getTime()) / 1000
}

export function heureCourte(valeur) {
  const d = valeur instanceof Date ? valeur : new Date(valeur)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function dateLongue(d) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
