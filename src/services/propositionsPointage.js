import { supabase } from '../lib/supabase'

export function sourceProposition(p) {
  if (p.lastOut && !p.lastOut.__virtual) return null // jamais réécrire une décision en base
  if (p.estimationEcartee) return null
  if (p.lastOut?.id?.startsWith('virtual-out-')) return p.lastOut.id.slice('virtual-out-'.length)
  const closed = new Set((p.validPairs || []).map(pair => pair.in?.id))
  const open = (p.attendances || []).filter(a => a.check_type === 'in' && !closed.has(a.id))
    .sort((a, b) => new Date(b.check_time) - new Date(a.check_time))
  return open[0]?.id || p.firstIn?.id || null
}

// Modifie seulement le modèle de lecture. Le temps travaillé reste inchangé.
export function appliquerProposition(p, context) {
  const source = sourceProposition(p)
  if (!source) return p
  const pairs = p.validPairs || []
  const oldVirtual = pairs.find(pair => pair.out?.__virtual && pair.in?.id === source)
  const entry = oldVirtual?.in || p.attendances?.find(a => a.id === source) || p.firstIn
  if (!entry) return { ...p, contexteProposition: context }
  const oldSeconds = oldVirtual ? Math.max(0, (new Date(oldVirtual.out.check_time) - new Date(entry.check_time)) / 1000) : 0
  const base = { ...p, contexteProposition: context, sourceProposition: source,
    lastOut: null, validPairs: pairs.filter(pair => pair !== oldVirtual),
    totalSecondesPresumes: Math.max(0, (p.totalSecondesPresumes || 0) - oldSeconds) }
  if (context?.eligible !== true || context.source_id !== source) return base
  const seconds = (new Date(context.proposed_out) - new Date(entry.check_time)) / 1000
  if (!Number.isFinite(seconds) || seconds <= 0) return base
  const out = { id: `virtual-out-${source}`, employee_id: entry.employee_id, enterprise_id: entry.enterprise_id,
    check_type: 'out', check_time: context.proposed_out, is_auto_closed: true, __virtual: true,
    __contextuelle: true, estimation_source_id: source, estimation_niveau: 2,
    estimation_detail: context }
  return { ...base, lastOut: out, validPairs: [...base.validPairs, { in: entry, out }],
    totalSecondesPresumes: base.totalSecondesPresumes + seconds }
}

export async function enrichirPropositions(pointages) {
  const enriched = [...pointages]
  let cursor = 0
  // Quatre requêtes simultanées maximum, pas un appel par badge ni par collègue.
  await Promise.all(Array.from({ length: Math.min(4, pointages.length) }, async () => {
    while (cursor < pointages.length) {
      const index = cursor++
      const p = pointages[index]
      const source = sourceProposition(p)
      if (!source) continue
      let context
      try {
        const { data, error } = await supabase.rpc('encheck_proposer_pointage', { p_source: source })
        if (error) throw error
        if (!data || typeof data.kind !== 'string') throw new Error('Réponse invalide')
        context = data
      } catch {
        context = { kind: 'indisponible', eligible: false,
          reason: 'Analyse indisponible. Rechargez la journée ; vérifiez la migration 000008 si le problème persiste. Aucun forfait +8 h proposé en secours.' }
      }
      enriched[index] = appliquerProposition(p, context)
    }
  }))
  return enriched
}
