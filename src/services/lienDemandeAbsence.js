// ═══════════════════════════════════════════════════════════
// 🔗 DEMANDE DE CONGÉ ↔ ABSENCE DU PLANNING
//
// Approuver une demande crée une absence. Les deux vies sont
// liées : supprimer la demande doit retirer le congé du planning,
// sinon l'employé reste « en congé » alors que la demande n'existe
// plus. Et supprimer l'absence à la main ne doit pas effacer une
// absence sans rapport.
//
// Le lien est d'abord explicite (colonne `leave_request_id`), avec
// un repli sur les dates pour les demandes approuvées avant sa mise
// en place.
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'

/** Une absence créée par la validation d'une demande porte cette trace */
const TRACE_DEMANDE = '[Demande employé]'
const TRACE_EMPLOYE = '[Approuvé via espace employé]'

/**
 * Les absences créées par une demande donnée.
 * TOUJOURS un tableau : jamais maybeSingle, sinon deux absences qui se
 * chevauchent faisaient échouer la lecture et le congé survivait.
 */
export async function absencesDeLaDemande(request) {
  if (!request?.id) return []

  // 1) le lien direct : fiable, même si les dates ont été modifiées ensuite
  const { data: liees, error: erreurLien } = await supabase
    .from('absences')
    .select('id, document_url, notes')
    .eq('leave_request_id', request.id)

  if (!erreurLien && liees && liees.length > 0) return liees

  // 2) pas de lien (ancienne demande) : on retrouve par employé + dates,
  //    en ne retenant que les absences portant la trace d'une demande
  if (!request.employee_id || request.status !== 'approuve') return []

  const { data: parDates } = await supabase
    .from('absences')
    .select('id, document_url, notes')
    .eq('employee_id', request.employee_id)
    .eq('start_date', request.start_date)
    .eq('end_date', request.end_date)

  const toutes = parDates || []
  const tracees = toutes.filter((a) =>
    (a.notes || '').includes(TRACE_DEMANDE) || (a.notes || '').includes(TRACE_EMPLOYE))

  // si aucune n'est tracée (absence saisie à la main aux mêmes dates),
  // on ne supprime rien plutôt que d'effacer le travail de quelqu'un
  return tracees.length > 0 ? tracees : []
}

/**
 * Supprime une demande ET les absences qu'elle avait créées.
 * Renvoie le nombre d'absences retirées (le planning suit aussitôt).
 */
export async function supprimerDemandeEtSesAbsences(request, { supprimerFichier } = {}) {
  const liees = await absencesDeLaDemande(request)

  for (const absence of liees) {
    if (absence.document_url && supprimerFichier) {
      await supprimerFichier(absence.document_url)
    }
    const { error } = await supabase.from('absences').delete().eq('id', absence.id)
    if (error) throw error
  }

  if (request.document_url && supprimerFichier) {
    await supprimerFichier(request.document_url)
  }

  const { error } = await supabase.from('leave_requests').delete().eq('id', request.id)
  if (error) throw error

  return liees.length
}
