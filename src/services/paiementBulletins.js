// ═══════════════════════════════════════════════════════════
// 💳 PAYEMENT DES BULLETINS — le fait qu'on ne pouvait pas deviner
//
// Un bulletin REMIS (`status = 'sent'`) n'est pas un bulletin PAYÉ.
// Ce service tient la seconde moitié de la phrase : quand, par quel
// canal, et sous quelle référence l'argent est parti.
//
// ⚠️ La base peut ne pas encore connaître les colonnes de paiement
//    (migration 20261026000018). Toutes les lectures retombent alors
//    sur les colonnes historiques : l'écran continue de fonctionner,
//    il dit simplement qu'il ne sait pas encore.
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'

export const MOYENS_PAIEMENT = [
  { cle: 'especes', label: 'Espèces' },
  { cle: 'mobile_money', label: 'Mobile Money' },
  { cle: 'virement', label: 'Virement bancaire' },
  { cle: 'cheque', label: 'Chèque' },
  { cle: 'autre', label: 'Autre' },
]

export function libelleMoyen(cle) {
  return MOYENS_PAIEMENT.find((m) => m.cle === cle)?.label || (cle ? String(cle) : '—')
}

const COLONNES_HISTORIQUES =
  'id, employee_id, period_start, period_end, gross_salary, net_salary, sent_at, status, is_deleted'
const COLONNES_PAIEMENT = `${COLONNES_HISTORIQUES}, paid_at, payment_method, payment_reference, paid_by`

const sansSupprime = (q) => q.or('is_deleted.is.null,is_deleted.eq.false')

/**
 * Les bulletins qui touchent la période du rapport.
 * Renvoie `{ bulletins, paiementConnu }` — `paiementConnu` dit si la base
 * sait déjà marquer un paiement (migration appliquée) ou pas.
 */
export async function chargerBulletinsPeriode({
  enterpriseId = null,
  dateDebut = null,
  dateFin = null,
  employeeIds = null,
} = {}) {
  //  Surtout PAS `async` : on doit rendre le constructeur de requête
  //  lui-même pour pouvoir le trier, puis l'attendre.
  const interroger = (colonnes) => {
    let q = supabase.from('employee_payslips').select(colonnes)
    if (enterpriseId) q = q.eq('enterprise_id', enterpriseId)
    if (dateDebut) q = q.lte('period_start', dateFin || dateDebut)
    if (dateFin) q = q.gte('period_end', dateDebut || dateFin)
    if (Array.isArray(employeeIds) && employeeIds.length > 0) q = q.in('employee_id', employeeIds)
    q = sansSupprime(q)
    return q
  }

  try {
    const complet = await interroger(COLONNES_PAIEMENT).order('period_end', { ascending: false })
    if (!complet.error) return { bulletins: complet.data || [], paiementConnu: true }
    throw complet.error
  } catch {
    // La colonne n'existe pas encore : on relit sans elle, sans rien inventer.
    const historique = await interroger(COLONNES_HISTORIQUES).order('period_end', { ascending: false })
    return { bulletins: historique.data || [], paiementConnu: false }
  }
}

/**
 * Les trois colonnes de paiement d'un export : un objet prêt à étaler.
 * `paiement` vient de `chargerPaiementsPeriode`.
 */
export function etatPaiementExport(paiement) {
  return {
    'Payé le': paiement?.payeLe ? new Date(paiement.payeLe).toLocaleDateString('fr-FR') : 'Non',
    'Moyen de paiement': paiement?.moyen ? libelleMoyen(paiement.moyen) : '',
    'Référence': paiement?.reference || '',
  }
}

/**
 * Les marques de paiement d'une période, pour les écrans qui listent des
 * fiches : `{ paiements: Map, envoyees: Set, paiementConnu }`.
 */
export async function chargerPaiementsPeriode({ enterpriseId, dateDebut, dateFin }) {
  const { bulletins, paiementConnu } = await chargerBulletinsPeriode({
    enterpriseId,
    dateDebut,
    dateFin,
  })
  const paiements = new Map()
  const envoyees = new Set()
  for (const b of bulletins) {
    if (!b?.employee_id) continue
    envoyees.add(b.employee_id)
    if (!b.paid_at) continue
    paiements.set(b.employee_id, {
      payeLe: b.paid_at,
      moyen: b.payment_method || null,
      reference: b.payment_reference || null,
    })
  }
  return { paiements, envoyees, paiementConnu }
}

/** Marque une fiche comme payée. Renvoie `{ ok, message }`. */
export async function marquerPaye({
  enterpriseId,
  employeeId,
  periodStart,
  periodEnd,
  paidAt = new Date().toISOString(),
  methode = 'especes',
  reference = '',
  adminId = null,
} = {}) {
  if (!enterpriseId || !employeeId || !periodStart || !periodEnd) {
    return { ok: false, message: 'Bulletin incomplet : entreprise, salarié et période sont nécessaires.' }
  }
  if (!MOYENS_PAIEMENT.some((m) => m.cle === methode)) {
    return { ok: false, message: 'Choisissez un moyen de paiement.' }
  }

  const { error } = await supabase
    .from('employee_payslips')
    .update({
      paid_at: paidAt,
      paid_by: adminId,
      payment_method: methode,
      payment_reference: reference?.trim() || null,
    })
    .eq('enterprise_id', enterpriseId)
    .eq('employee_id', employeeId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)

  if (error) {
    const inconnu = error.code === '42703' || /column .* does not exist|paid_at/i.test(error.message || '')
    return {
      ok: false,
      message: inconnu
        ? 'Cette base ne sait pas encore marquer un paiement. Appliquez la migration 20261026000018, puis réessayez.'
        : 'Le paiement n’a pas pu être enregistré. Vérifiez la connexion et vos droits, puis réessayez.',
    }
  }
  return { ok: true, message: 'Paiement enregistré.' }
}

/** Retire la marque de paiement (erreur de saisie). L'historique reste. */
export async function retirerPaiement({
  enterpriseId,
  employeeId,
  periodStart,
  periodEnd,
} = {}) {
  const { error } = await supabase
    .from('employee_payslips')
    .update({ paid_at: null, paid_by: null, payment_method: null, payment_reference: null })
    .eq('enterprise_id', enterpriseId)
    .eq('employee_id', employeeId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)

  if (error) return { ok: false, message: 'Le retrait du paiement n’a pas abouti.' }
  return { ok: true, message: 'Paiement retiré.' }
}

/**
 * L'état de paie par employé, pour le rapport.
 * Fonction pure : une fiche payée gagne sur une fiche remise, et la
 * période la plus récente gagne sur les précédentes.
 */
export function resumerPaieParEmploye(bulletins = []) {
  const parEmploye = new Map()

  for (const b of bulletins || []) {
    if (!b || !b.employee_id || b.is_deleted === true) continue
    const precedent = parEmploye.get(b.employee_id)

    const rang = (x) => (x.paid_at ? 2 : x.sent_at ? 1 : 0)
    const plusRecent = (a, b2) => String(a?.period_end || '').localeCompare(String(b2?.period_end || ''))

    if (
      !precedent ||
      rang(b) > rang(precedent) ||
      (rang(b) === rang(precedent) && plusRecent(b, precedent) > 0)
    ) {
      parEmploye.set(b.employee_id, {
        statut: b.paid_at ? 'paye' : b.sent_at ? 'emis' : 'calcule',
        emisLe: b.sent_at || null,
        payeLe: b.paid_at || null,
        moyen: b.payment_method || null,
        reference: b.payment_reference || null,
        net: b.net_salary ?? null,
        brut: b.gross_salary ?? null,
        periodStart: b.period_start || null,
        periodEnd: b.period_end || null,
      })
    }
  }

  return parEmploye
}
