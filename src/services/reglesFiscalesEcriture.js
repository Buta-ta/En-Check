import { db } from '../lib/db'
import { fiscalError } from './fiscalTransactions'

/** Compare-and-set on the raw custom rules read when the editor was loaded.
 * undefined means no snapshot was read: refusing is safer than overwriting.
 * null is a valid snapshot (no custom rules yet).
 */
export async function ecrireReglesFiscales(enterpriseId, rules, expectedRules) {
  if (!enterpriseId) return false
  if (expectedRules === undefined) throw new Error('Rechargez les règles avant de les enregistrer.')
  const { data, error } = await db().rpc('paie_enregistrer_regles', {
    p_enterprise_id: enterpriseId, p_rules: rules || {}, p_expected_rules: expectedRules,
  })
  if (error) throw fiscalError(error)
  if (data !== true) throw new Error('Enregistrement fiscal non confirmé.')
  return true
}
export default { ecrireReglesFiscales }
