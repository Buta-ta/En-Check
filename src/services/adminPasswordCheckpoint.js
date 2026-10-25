import { supabase } from '../lib/supabase'
export async function adminPasswordChangeRequired() {
  const { data, error } = await supabase.rpc('encheck_account_password_status')
  // Compatibility only while the additive migration is not deployed. Once
  // installed, authorization/network failures must not grant access.
  if (error?.code === 'PGRST202') return false
  if (error || typeof data !== 'boolean')
    throw new Error('Vérification du mot de passe temporaire indisponible.')
  return data === true
}
