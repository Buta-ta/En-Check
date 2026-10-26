import { supabase } from '../lib/supabase'
export async function mfaObligationStatus() {
  const { data, error } = await supabase.rpc('encheck_mfa_obligation_statut')
  // Before rollout there can be no requirement issued through the new RPC.
  if (error?.code === 'PGRST202') return { required: false, satisfied: true }
  if (
    error ||
    typeof data?.required !== 'boolean' ||
    typeof data?.satisfied !== 'boolean'
  )
    throw Error('Vérification MFA indisponible.')
  return data
}
export async function redirectForMfaObligation() {
  const status = await mfaObligationStatus()
  if (status.required && !status.satisfied) {
    window.location.assign('/admin/mfa-obligatoire')
    return true
  }
  return false
}
