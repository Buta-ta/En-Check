import TaxationService from './taxationService'
import { supabase } from '../lib/supabase'

export class PayrollDeliveryBlocked extends Error {
  constructor(message) { super(message); this.name = 'PayrollDeliveryBlocked' }
}

// Only this refusal can be acknowledged; structural checks and RLS cannot.
export class PayrollTaxReviewRequired extends PayrollDeliveryBlocked {
  constructor(message) { super(message); this.name = 'PayrollTaxReviewRequired' }
}

/** verifierAvantRemise succeeds with void, and rejects by throwing — never a result object.
 * Preflight the ENTIRE batch before the single atomic database statement. */
export async function publishPayrollBatch(rows, buildPayload, { automatic = false, taxOverride = null, isCurrent = () => true } = {}) {
  if (!rows.length) throw new PayrollDeliveryBlocked('Aucune fiche calculée à envoyer.')
  const identities = new Set()
  const payloads = rows.map(row => {
    if (!row?.employee?.id) throw new PayrollDeliveryBlocked('Une fiche ne possède pas de salarié identifié. Recalculez les bulletins.')
    const taxUnverified = !!(row.impot_a_verifier || row.taxation?.impot_a_verifier)
    try {
      TaxationService.verifierAvantRemise({ ...row, impot_a_verifier: row.impot_a_verifier || row.taxation?.impot_a_verifier })
    } catch (error) {
      if (!taxUnverified) throw error
      if (automatic || taxOverride?.acknowledged !== true || typeof taxOverride?.confirmedBy !== 'string' || !taxOverride.confirmedBy.trim()) throw new PayrollTaxReviewRequired('Les règles d’impôt de ce pays sont encore à vérifier. Faites contrôler le barème et les règles dans Fiscalité à partir d’un bulletin de référence, puis recalculez les fiches. Aucun envoi de ce lot n’a été effectué.')
    }
    if (automatic) {
      const field = { monthly: 'base_salary', hourly: 'hourly_rate', daily: 'daily_rate' }[row.profile?.salary_type]
      if (!field || !Number.isFinite(Number(row.profile[field])) || !(Number(row.profile[field]) > 0)) throw new PayrollDeliveryBlocked('Envoi automatique bloqué : au moins un salarié n’a pas de base salariale valide. Complétez les profils, puis recalculez. Aucun envoi de ce lot n’a été effectué.')
    }
    if ([row.grossSalary, row.netSalary].some(value => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)))) {
      throw new PayrollDeliveryBlocked('Une fiche contient un brut ou un net inconnu. Vérifiez le calcul avant envoi.')
    }
    const payload = buildPayload(row)
    if (!payload.currency || !payload.enterprise_id || !payload.period_start || !payload.period_end || payload.period_start > payload.period_end) {
      throw new PayrollDeliveryBlocked('Pays, devise ou période manquants : vérifiez les paramètres de l’entreprise puis recalculez.')
    }
    if ((row.periodStart && row.periodStart !== payload.period_start) || (row.periodEnd && row.periodEnd !== payload.period_end)) {
      throw new PayrollDeliveryBlocked('La période du bulletin ne correspond plus à la période sélectionnée. Recalculez avant envoi.')
    }
    const key = `${payload.enterprise_id}:${payload.employee_id}:${payload.period_start}:${payload.period_end}`
    if (identities.has(key)) throw new PayrollDeliveryBlocked('Le lot contient deux fiches pour le même salarié et la même période. Recalculez avant envoi.')
    identities.add(key)
    if (taxUnverified) payload.details = { ...payload.details, impot_a_verifier: true, tax_delivery_override: {
      acknowledged: true, confirmed_by: taxOverride.confirmedBy, confirmed_at: new Date().toISOString(),
      warning: 'Envoi exceptionnel malgré des règles fiscales non vérifiées. Cette confirmation ne valide pas le calcul fiscal.',
    } }
    return payload
  })
  if (!isCurrent()) throw new PayrollDeliveryBlocked('Le contexte de calcul a changé. Recalculez avant envoi.')
  // A single upsert: no subset is sent if the statement is rejected by validation/RLS.
  const { error } = await supabase.from('employee_payslips').upsert(payloads, {
    onConflict: 'enterprise_id,employee_id,period_start,period_end',
  })
  if (error) throw error
  return payloads.map(payload => payload.employee_id)
}
