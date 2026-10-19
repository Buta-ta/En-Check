import { CLIENT_TIMEOUT_MS, MAX_MESSAGES, validMessages, hasObviousPrivateData } from '../../supabase/functions/assistant-chat/contract.js'
export const CHAT_ERRORS = {
  access: 'Votre session ou vos droits ne permettent pas cette discussion. Reconnectez-vous si nécessaire.',
  disabled: 'La discussion générale n’est pas encore activée. Les consultations En-Check restent disponibles.',
  quota: 'La limite de discussion du jour est atteinte. Les consultations En-Check restent disponibles.',
  privacy: 'Retirez les données personnelles, identifiants ou informations confidentielles avant de poursuivre.',
  request: 'Vérifiez la longueur et le contenu de votre message.',
  unavailable: 'Je ne peux pas répondre pour le moment. Vous pouvez réessayer plus tard ou consulter les données En-Check.',
}
export function publicMessages(history, text) {
  return [...history.slice(-(MAX_MESSAGES - 1)).map(m => ({ role: m.role, text: m.text })), { role: 'user', text }]
}
export async function answerPublicChat(messages, client, controller = new AbortController()) {
  if (!validMessages(messages)) return { error: 'request' }
  if (hasObviousPrivateData(messages)) return { error: 'privacy' }
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
  try {
    const { data, error } = await client.functions.invoke('assistant-chat', { body: { messages, publicOnly: true }, signal: controller.signal })
    if (error) {
      let body
      try { body = await error.context?.json() } catch { /* no raw errors */ }
      return { error: Object.hasOwn(CHAT_ERRORS, body?.error) ? body.error : 'unavailable' }
    }
    if (data?.kind !== 'generated' || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000 || /<[^>]+>/.test(data.text)) return { error: 'unavailable' }
    return { text: data.text }
  } catch { return { error: 'unavailable' } }
  finally { clearTimeout(timer) }
}
