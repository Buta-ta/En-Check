import { normalizeDialogue, splitDialoguePeriod } from './assistantIntent'
import { parseRhQuestion } from './assistantRh'
import { explanationTopic } from './assistantExplanation'
import { conversationalRequest } from './assistantConversation'
import { detectNaturalCompanyIntent } from './assistantNaturalRh'
import { hasObviousPrivateData } from '../../supabase/functions/assistant-chat/contract.js'

const META_ASSISTANT_RE =
  /^(?:(?:bonjour|bonsoir|salut|coucou|dis[- ]moi|stp|svp|alors|mais|et)\s+)*(?:que peux[- ]tu faire|qu'est[- ]ce que tu peux faire|qu est ce que tu peux faire|tu peux faire quoi|tu fais quoi|que fais[- ]tu|que sais[- ]tu faire|qu'est[- ]ce que tu sais faire|qui es[- ]tu|tu es qui|presente[- ]toi|a quoi tu sers|a quoi sers[- ]tu|comment tu fonctionnes|comment tu marches|comment t'utiliser|comment peux[- ]tu m'aider|peux[- ]tu m'aider|tu peux m'aider|que proposes[- ]tu|quelles sont tes fonctionnalites|que peut[- ]on te demander|tu es un assistant|es[- ]tu un assistant|tu es une ia|es[- ]tu une ia|c'est une ia|tu es une intelligence artificielle|tu es un robot|es[- ]tu un robot|tu es un chat|c'est un vrai chat|quel modele (?:es[- ]tu|utilises[- ]tu)|tu fonctionnes avec (?:une ia|gemini|gemma)|tu es intelligent|tu me comprends|est[- ]ce que tu me comprends|tu parles francais|on peut discuter|peut[- ]on discuter|tu reponds|reponds[- ]moi)(?:\s+(?:pour moi|dans en[- ]check|ici|aujourd'hui|stp|svp))*$/

// Conservative routing, NOT anonymisation. Unknown names/identifiers stay local.
// External processing also requires the session activation notice.
export function usesGeneralConversation(query, history = []) {
  const text = normalizeDialogue(query)
  if (!text || explanationTopic(query) || parseRhQuestion(query) || detectNaturalCompanyIntent(query)) return false
  if (META_ASSISTANT_RE.test(text)) return false
  if (hasObviousPrivateData([{ text: query }])) return false
  if (/\b(salarie|employe|salaire|paie|maladie|medical|sante|matricule|dossier|confidentiel|secret|badge|pointage|depointe|depointage|retard|contrat|licenciement|pause|planning|conge|absence)\w*\b/.test(text)) return false
  if (/\b(mon|ma|mes|notre|nos)\b/.test(text)) return false
  const { text: withoutPeriod, period } = splitDialoguePeriod(query)
  if ((!withoutPeriod || withoutPeriod === 'et') && period) return false
  if (/^(bonjour|bonsoir|salut|coucou|merci|merci beaucoup|comment|comment ca|pourquoi|et ensuite|continue|developpe|un exemple|plus simplement|explique autrement)$/.test(text)) return true
  if (conversationalRequest(query).answer) return false
  if (/^(comment |pourquoi |qu'est-ce que |qu'est ce que |que |quel |quelle |quels |quelles |peux[- ]tu |pouvez[- ]vous |est[- ]ce que |explique[- ]moi |peux[- ]tu expliquer |donne[- ]moi |propose|redige|ecris|resume|conseille)/.test(text)) return true
  if (Array.isArray(history) && history.length > 0 && /^(et |mais |alors |donc |oui |non |d'accord |peut[- ]on |faut[- ]il )/.test(text)) return true
  return false
}
