import { TOPICS, isTopic } from '../../supabase/functions/assistant-explain/topics.js'
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/’/g, "'").replace(/[?!.]/g, '').trim().replace(/\s+/g, ' ')
const QUESTIONS = {
  'explique une sortie presumee': 'presumed_exit',
  "qu'est-ce qu'une sortie presumee": 'presumed_exit',
  'comment sont calcules les retards': 'lateness',
  'explique les retards': 'lateness',
  'que signifie le nombre de pointages': 'attendance_count',
  'explique le nombre de pointages': 'attendance_count',
}
export const EXPLANATION_QUESTIONS = [
  'Explique une sortie présumée', 'Comment sont calculés les retards ?', 'Que signifie le nombre de pointages ?',
]
export function explanationTopic(query) {
  const text = normalize(query)
  return Object.hasOwn(QUESTIONS, text) ? QUESTIONS[text] : null
}
export async function answerExplanation(query, client) {
  const topic = explanationTopic(query)
  if (!topic || !isTopic(topic)) return null
  const reference = TOPICS[topic]
  const base = { title: reference.title, text: reference.fallback, source: 'Référence En-Check — explication générale',
    notes: ['Aucun dossier RH consulté pour cette explication. Aucune action ni validation effectuée.'] }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18000)
  try {
    // Deliberately never send query, context, history, personal data or enterprise ID.
    const { data, error } = await client.functions.invoke('assistant-explain', {
      body: { topic }, signal: controller.signal,
    })
    if (error || data?.topic !== topic || data?.kind !== 'generated' || typeof data.text !== 'string' ||
      data.text.length < 40 || data.text.length > 1200 || /https?:|<[^>]+>/.test(data.text)) return base
    return { ...base, text: data.text, source: 'Reformulation IA de la documentation En-Check — à vérifier',
      notes: [...base.notes, `Référence métier : ${reference.fallback}`] }
  } catch { return base }
  finally { clearTimeout(timer) }
}
