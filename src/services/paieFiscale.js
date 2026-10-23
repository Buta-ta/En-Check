// ═══════════════════════════════════════════════════════════
// 🧭 OPÉRATIONS FISCALES ENTRE ENTREPRISES
//
// Deux besoins nés de la fusion des pages « Configuration
// fiscale » et « Fiches de paie » :
//
//   ① savoir, d'un coup d'œil, quelles entreprises sont
//      configurées et lesquelles ne le sont pas ;
//   ② recopier une configuration d'une entreprise à l'autre,
//      pour ne pas ressaisir six cotisations à la main.
//
// Ce module est à part pour une raison simple : il parle aux
// DEUX services (taxation pour les cotisations et les tranches,
// paie pour les règles). Les faire s'importer l'un l'autre
// referait un cycle, et un cycle entre deux services qui
// s'écrivent dans la même table est exactement ce qu'on vient
// de démonter.
// ═══════════════════════════════════════════════════════════

import { db } from '../lib/db'
import { remplacerConfigurationFiscale } from './fiscalTransactions'

/** Ce qu'une entreprise a déjà de configuré, en un seul appel */
export async function resumerConfiguration(enterpriseId) {
  const vide = { cotisations: 0, tranches: 0, regles: {}, devise: null, configuree: false }

  if (!enterpriseId) return vide

  try {
    const [cotisations, tranches, reglages, entreprise] = await Promise.all([
      db().from('enterprise_payroll_contributions')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .then((r) => r.data || []),
      db().from('enterprise_tax_brackets')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .eq('is_active', true)
        .then((r) => r.data || []),
      db().from('payroll_settings')
        .select('custom_tax_rules')
        .eq('enterprise_id', enterpriseId)
        .maybeSingle()
        .then((r) => r.data || null),
      db().from('enterprises')
        .select('currency, country_code')
        .eq('id', enterpriseId)
        .maybeSingle()
        .then((r) => r.data || null),
    ])

    return {
      cotisations: cotisations.length,
      tranches: tranches.length,
      regles: reglages?.custom_tax_rules || {},
      devise: entreprise?.currency || null,
      pays: entreprise?.country_code || null,
      configuree: cotisations.length > 0 || tranches.length > 0,
    }
  } catch (err) {
    console.error('Erreur résumé configuration:', err)
    return vide
  }
}

/** Les résumés de plusieurs entreprises, pour la vue d'ensemble */
export async function resumerConfigurations(enterpriseIds = []) {
  const ids = (enterpriseIds || []).filter(Boolean)
  const resultats = await Promise.all(ids.map(async (id) => ({ id, ...(await resumerConfiguration(id)) })))
  const parId = {}
  resultats.forEach((r) => {
    parId[r.id] = r
  })
  return parId
}

/**
 * Recopie la configuration fiscale d'une entreprise vers une autre.
 *
 * ⚠️ Destructif sur l'entreprise CIBLE : ses cotisations et ses
 * tranches sont remplacées. On garde donc la copie de côté et on
 * la remet si l'insertion échoue — une entreprise ne doit jamais
 * se retrouver vide à cause d'une demi-opération.
 */
export async function copierConfigurationFiscale(sourceId, cibleId) {
  if (!sourceId || !cibleId) {
    return { success: false, error: 'Entreprise source ou cible manquante' }
  }
  if (sourceId === cibleId) {
    return { success: false, error: 'L’entreprise source et la cible sont identiques' }
  }

  try {
    const [sourceCotisations, sourceTranches, sourceReglages, cibleCotisations, cibleTranches] =
      await Promise.all([
        db().from('enterprise_payroll_contributions').select('*').eq('enterprise_id', sourceId),
        db().from('enterprise_tax_brackets').select('*').eq('enterprise_id', sourceId),
        db().from('payroll_settings').select('custom_tax_rules').eq('enterprise_id', sourceId).maybeSingle(),
        db().from('enterprise_payroll_contributions').select('*').eq('enterprise_id', cibleId),
        db().from('enterprise_tax_brackets').select('*').eq('enterprise_id', cibleId),
      ])

    for (const result of [sourceCotisations, sourceTranches, sourceReglages, cibleCotisations, cibleTranches]) {
      if (result.error) throw result.error
    }
    const cotisations = sourceCotisations.data || []
    const tranches = sourceTranches.data || []

    if (cotisations.length === 0 && tranches.length === 0) {
      return { success: false, error: 'L’entreprise source n’a rien à copier' }
    }

    await remplacerConfigurationFiscale(cibleId, {
      contributions: cotisations, taxBrackets: tranches,
      rules: sourceReglages.data?.custom_tax_rules || {},
    })

    return {
      success: true,
      resume: {
        cotisations: cotisations.length,
        tranches: tranches.length,
        reglesCopiees: Boolean(sourceReglages.data?.custom_tax_rules),
      },
    }
  } catch (err) {
    console.error('Erreur copie configuration fiscale:', err)
    return { success: false, error: err.message || 'Copie impossible' }
  }
}
