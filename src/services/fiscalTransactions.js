import { db } from '../lib/db'

export function fiscalError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') return new Error('Protection fiscale non installée en base. Faites valider et installer le SQL de sécurisation ; aucune modification n’a été effectuée.')
  if (error?.code === '40001') return new Error('Ces règles ont changé depuis leur ouverture. Rechargez la configuration avant de réessayer.')
  return new Error(error?.message || 'Opération fiscale refusée.')
}

// No client-side delete/insert fallback: a missing RPC must never empty a configuration.
export async function remplacerConfigurationFiscale(enterpriseId, { contributions, taxBrackets, rules, countryCode = null, currency = null, fiscalLabel = null }) {
  if (!enterpriseId) throw new Error('Entreprise obligatoire')
  const { data, error } = await db().rpc('paie_remplacer_configuration', {
    p_enterprise_id: enterpriseId, p_contributions: contributions,
    p_tranches: taxBrackets, p_rules: rules,
    p_country_code: countryCode, p_currency: currency, p_fiscal_label: fiscalLabel,
  })
  if (error) throw fiscalError(error)
  if (data !== true) throw new Error('Remplacement fiscal non confirmé.')
  return true
}
