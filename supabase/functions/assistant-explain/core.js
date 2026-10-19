import { TOPICS, isTopic } from './topics.js'
export const MODELS = Object.freeze(['gemini-3.5-flash-lite', 'gemma-4-31b-it'])
export const MODEL_TIMEOUT_MS = 30000
const fallback = topic => ({ kind: 'reference', topic, title: TOPICS[topic].title, text: TOPICS[topic].fallback })

export async function explain(topic, key, fetchImpl = fetch, timeout = MODEL_TIMEOUT_MS) {
  for (const model of MODELS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text:
          `Tu expliques une notion publique d'En-Check en français simple. Reformule uniquement les faits suivants. N'ajoute aucun fait, nom, chiffre, décision ou règle juridique. Pas de SQL, outil, URL ou action. Réponds par un objet JSON contenant seulement explanation, un paragraphe de moins de 1200 caractères. Faits : ${TOPICS[topic].facts}` }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 400 } }),
      })
      if (!r.ok) { await r.body?.cancel(); continue }
      const data = await r.json()
      const candidate = data?.candidates?.[0]
      const parts = candidate?.content?.parts
      if (candidate?.finishReason !== 'STOP' || !Array.isArray(parts) || parts.some(p => p.functionCall)) continue
      const raw = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('')
      const output = JSON.parse(raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, ''))
      if (Object.keys(output).join(',') !== 'explanation' || typeof output.explanation !== 'string') continue
      const text = output.explanation.trim()
      if (text.length < 40 || text.length > 1200 || /https?:|<[^>]+>/.test(text)) continue
      return { kind: 'generated', topic, title: TOPICS[topic].title, text }
    } catch { /* Redacted, bounded fallback: no logs, raw errors, retry loop or data. */ }
    finally { clearTimeout(timer) }
  }
  return fallback(topic)
}

/** @param {{enabled:boolean, apiKey:string, allowedOrigins?:string[], authorize:(token:string)=>Promise<string|null>, reserve:(user:string)=>Promise<boolean>, fetchImpl?:typeof fetch}} options */
export function createHandler({ enabled, apiKey, allowedOrigins = [], authorize, reserve, fetchImpl = fetch }) {
  return async req => {
    const origin = req.headers.get('origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(origin && allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) }
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers })
    if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: 'origin_denied' })
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return reply(405, { error: 'post_required' })
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
    if (!token) return reply(401, { error: 'authentication_required' })
    let user
    try { user = await authorize(token) } catch { return reply(503, { error: 'authorization_unavailable' }) }
    if (!user) return reply(403, { error: 'active_admin_required' })
    let topic
    try {
      const reader = req.body?.getReader()
      const chunks = []; let size = 0
      if (reader) while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 128) { await reader.cancel(); return reply(413, { error: 'body_too_large' }) }
        chunks.push(value)
      }
      const buffer = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
      const body = JSON.parse(new TextDecoder().decode(buffer))
      if (!body || Object.keys(body).join(',') !== 'topic' || !isTopic(body.topic)) throw Error('body')
      topic = body.topic
    } catch { return reply(400, { error: 'topic_only' }) }
    if (!enabled || !apiKey) return reply(200, fallback(topic))
    try { if (!await reserve(user)) return reply(200, fallback(topic)) }
    catch { return reply(200, fallback(topic)) }
    return reply(200, await explain(topic, apiKey, fetchImpl))
  }
}
