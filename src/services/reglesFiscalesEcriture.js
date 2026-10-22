// ═══════════════════════════════════════════════════════════
// 🗄️ LA SEULE ÉCRITURE DE `payroll_settings.custom_tax_rules`
//
// Cette colonne était écrite par trois endroits différents :
//
//   ① la page « Règles fiscales », qui la réécrit en entier ;
//   ② `TaxationService.initializeEnterpriseFromCountry`, quand on
//      charge la configuration d'un pays ;
//   ③ `PayrollService.saveSettings`, qui la recopiait depuis un état
//      lu parfois plusieurs secondes plus tôt.
//
// Trois rédacteurs sur une colonne en tout-ou-rien, c'est une perte
// de données qui attend son tour : le dernier à enregistrer écrase
// les règles chargées par l'autre onglet.
//
// Pourquoi un fichier séparé : `payrollService` importe déjà
// `taxationService` (il a besoin du calcul des cotisations). Si
// `taxationService` importait `payrollService` en retour, la boucle
// ferait charger l'un avant que l'autre existe, et l'ordre
// d'import changerait le comportement au démarrage. Ce module ne
// dépend que de `db` : les deux peuvent l'importer sans se voir.
//
// ⚠️ Ce fichier n'écrit QUE cette colonne. Pas `currency`, pas les
//    signatures, pas les congés. C'était la cause du bug : un
//    rédacteur qui écrit quinze colonnes qu'il n'a pas lues.
// ═══════════════════════════════════════════════════════════

import { db } from '../lib/db'

/**
 * Écrit les règles de calcul d'une entreprise, et rien d'autre.
 *
 * @param {string} enterpriseId
 * @param {object} rules  — l'objet complet (`calculation_rules`), pas un delta
 * @returns {Promise<boolean>} `true` si la base a accepté
 */
export async function ecrireReglesFiscales(enterpriseId, rules) {
  if (!enterpriseId) return false

  const payload = {
    custom_tax_rules: rules || {},
    updated_at: new Date().toISOString(),
  }

  // La fiche existe déjà ? On la met à jour. Sinon on la crée.
  // `maybeSingle` plutôt que `single` : l'absence de fiche n'est pas
  // une erreur, c'est le cas normal d'une entreprise jamais réglée.
  const { data: existante } = await db()
    .from('payroll_settings')
    .select('id')
    .eq('enterprise_id', enterpriseId)
    .maybeSingle()

  if (existante) {
    const { error } = await db()
      .from('payroll_settings')
      .update(payload)
      .eq('enterprise_id', enterpriseId)
    if (error) throw error
    return true
  }

  const { error } = await db()
    .from('payroll_settings')
    .insert({
      enterprise_id: enterpriseId,
      ...payload,
      created_at: new Date().toISOString(),
    })
  if (error) throw error
  return true
}

export default { ecrireReglesFiscales }
