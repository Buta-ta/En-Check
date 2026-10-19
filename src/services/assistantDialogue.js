import { conversationalRequest } from './assistantConversation'
import { normalizeDialogue, splitDialoguePeriod } from './assistantIntent'
import { parseRhQuestion, RH_QUESTIONS } from './assistantRh'

const clarification = (text, choices) => ({ title: 'Précisons ensemble', text, choices })
const advice = {
  title: 'Quelques pistes pour réduire les retards',
  text: 'Commencez par vérifier les horaires et les pointages, puis échangez avec les personnes concernées pour comprendre les difficultés. Clarifiez les horaires attendus et les moyens de prévenir en cas de retard. Suivez ensuite l’évolution sur une période comparable.',
  source: 'Conseils généraux — référence locale, sans analyse individuelle',
  warning: 'Aucune cause n’est déduite de vos données. Un retard ne justifie pas automatiquement une sanction ou une retenue sur salaire.',
  choices: ["Qui est en retard aujourd'hui", 'Comment sont calculés les retards ?'],
}

export function resolveDialogue(value, previous = null) {
  const courtesy = conversationalRequest(value)
  if (courtesy.answer) return { ...courtesy, state: previous }
  const query = courtesy.query
  const text = normalizeDialogue(query)
  const { text: subject, period } = splitDialoguePeriod(query)
  const state = previous || {}
  if (/^(?:annule|annuler|oublie|on change de sujet)$/.test(text)) return {
    answer: clarification('D’accord. De quoi souhaitez-vous parler maintenant ?', Object.values(RH_QUESTIONS)), state: null,
  }
  if (/^(?:ca ne va pas(?: aujourd'hui)?|aide[- ]moi|j'ai besoin d'aide|que dois-je verifier|quelles anomalies dois-je verifier(?: aujourd'hui)?)$/.test(text)) return {
    answer: clarification('Souhaitez-vous vérifier les retards, les pointages ou les sorties présumées ? Je ne lance pas d’analyse globale sans préciser le sujet.', Object.values(RH_QUESTIONS)), state: null,
  }
  if (/^(?:encore des retards|il y a encore des retards|on a encore des retards)$/.test(subject) || /^(?:encore des retards|il y a encore des retards|on a encore des retards) ce matin$/.test(text)) {
    const morning = text.endsWith('ce matin')
    return { answer: clarification(`Voulez-vous consulter les retards${morning ? ' de la journée entière (le filtre « matin » n’est pas disponible)' : ''} ou chercher des pistes pour les réduire ?`, ['Regarde déjà', 'Comment réduire les retards ?']),
      state: { intent: 'retards', period: morning ? "aujourd'hui" : period, pending: 'retards' } }
  }
  if (/^(?:comment (?:reduire|limiter|eviter) les retards|que faire pour (?:reduire|limiter|eviter) les retards)$/.test(text) ||
      (state.intent === 'retards' && /^(?:comment les reduire|et comment les reduire|des conseils|conseille[- ]moi)$/.test(text))) {
    return { answer: advice, state: { ...state, intent: 'retards', pending: null } }
  }
  if (/^(?:regarde(?: deja)?|vas-y|oui|montre[- ]moi|consulte|affiche)$/.test(text)) {
    if (state.intent && RH_QUESTIONS[state.intent]) return { query: `${RH_QUESTIONS[state.intent]} ${state.period || ''}`.trim(), state: { ...state, pending: null } }
    return { answer: clarification('Que souhaitez-vous consulter ?', Object.values(RH_QUESTIONS)), state: null }
  }
  // Réponses conversationnelles sur les autres modules d'En-Check (pauses, plannings, employés, absences, paie)
  if (/\b(?:pause|pauses)\b/.test(text)) {
    return {
      answer: {
        text: "Dans En-Check, les pauses pointées (planifiées ou hors planning) ainsi que le chronomètre en direct des pauses en cours sont visibles sur le Dashboard, sur la page Pointages et dans l’espace Pauses.",
        path: '/pauses',
        choices: ["Combien de pointages aujourd'hui", "Qui est en retard aujourd'hui", 'Sorties présumées à confirmer'],
      },
      state: previous,
    }
  }
  if (/\b(?:planning|plannings|horaire|horaires)\b/.test(text) && !/retard|pointage|sortie/.test(text)) {
    return {
      answer: {
        text: "Vous pouvez configurer les grilles d’horaires de l’entreprise, attribuer un planning personnalisé à un collaborateur ou traiter les demandes de modification depuis la page Planning.",
        path: '/planning',
        choices: ["Qui est en retard aujourd'hui", 'Comment sont calculés les retards ?'],
      },
      state: previous,
    }
  }
  if (/\b(?:absence|absences|conge|conges)\b/.test(text) && !/pointage|retard/.test(text)) {
    return {
      answer: {
        text: "La gestion des congés, arrêts maladie et absences déclarées se fait depuis la page Absences. Lorsqu’un pointage a lieu pendant une absence déclarée, En-Check signale automatiquement un conflit à vérifier.",
        path: '/absences',
        choices: ["Combien de pointages aujourd'hui", 'Sorties présumées à confirmer'],
      },
      state: previous,
    }
  }
  const parsed = parseRhQuestion(query, state)
  if (parsed && !parsed.unsupported) return { query: `${RH_QUESTIONS[parsed.intent]} ${parsed.period || ''}`.trim(), greeting: courtesy.greeting,
    state: { intent: parsed.intent, period: parsed.period, pending: null } }
  if ((!subject || subject === 'et') && period) return {
    answer: clarification('Pour cette période, souhaitez-vous consulter les retards, les pointages ou les sorties présumées ?',
      Object.values(RH_QUESTIONS).map(question => `${question} ${period}`)), state: null,
  }
  if (/^(?:comment|comment ca|et comment|et pourquoi|pourquoi|explique|et ensuite|et eux|et pour eux)$/.test(text)) return {
    answer: clarification('Je ne veux pas supposer une cause ou un groupe de personnes. Pouvez-vous préciser ce que vous souhaitez comprendre ?', state.intent === 'retards' ? ['Comment sont calculés les retards ?', 'Comment réduire les retards ?'] : Object.values(RH_QUESTIONS)), state: previous,
  }
  return { query, greeting: courtesy.greeting, state: null }
}

export const SESSION_TTL = 15 * 60 * 1000
export function dialogueScope(admin) {
  return JSON.stringify([admin?.id || admin?.user_id || null, admin?.selectedEnterprise?.id || admin?.enterprise_id || null])
}
export function currentDialogue(session, scope, now = Date.now()) {
  return session?.scope === scope && now - session.at < SESSION_TTL && now >= session.at ? session.state : null
}
