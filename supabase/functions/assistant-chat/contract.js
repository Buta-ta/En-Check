// Shared bounds, not a guarantee of anonymisation. Public discussion only.
export const MAX_MESSAGES = 7
export const MAX_TEXT = 2000
export const CLIENT_TIMEOUT_MS = 70000
export function validMessages(messages) {
  return Array.isArray(messages) && messages.length > 0 && messages.length <= MAX_MESSAGES && messages.length % 2 === 1 &&
    messages.every((m, i) => m && Object.keys(m).sort().join(',') === 'role,text' &&
      m.role === (i % 2 === 0 ? 'user' : 'assistant') && typeof m.text === 'string' &&
      m.text.trim().length > 0 && m.text.length <= MAX_TEXT)
}
// Obvious identifiers only: never describe this as a complete privacy filter.
export function hasObviousPrivateData(messages) {
  return messages.some(m => /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]?){8,}|\b(?:mot de passe|password|api[_ -]?key|numero de securite sociale)\b/i.test(m.text))
}
