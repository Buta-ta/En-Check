import { normalizeDialogue } from './assistantIntent'
import { parseRhQuestion } from './assistantRh'
import { explanationTopic } from './assistantExplanation'
import { hasObviousPrivateData } from '../../supabase/functions/assistant-chat/contract.js'

// Conservative routing, NOT anonymisation. Unknown names/identifiers stay local.
// External processing also requires the session activation notice.
export function usesGeneralConversation(query, history = []) {
  const text = normalizeDialogue(query)
  if (!text || explanationTopic(query) || parseRhQuestion(query)) return false
  if (hasObviousPrivateData([{ text: query }])) return false
  if (/\b(salarie|employe|salaire|paie|maladie|medical|sante|matricule|dossier|confidentiel|secret|badge|pointage|retard|contrat|licenciement)\w*\b/.test(text)) return false
  if (/\b(mon|ma|mes|notre|nos)\b/.test(text)) return false
  if (history.length && /^(comment|comment ca|pourquoi|et ensuite|continue|developpe|un exemple|plus simplement|explique autrement)$/.test(text)) return true
  return /^(comment |pourquoi |qu'est-ce que |qu'est ce que |explique[- ]moi |peux[- ]tu expliquer |quelle est |quelles sont |quels sont |donne[- ]moi (?:un exemple|des conseils))/.test(text)
}
