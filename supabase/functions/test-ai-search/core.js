// Runtime-independent core: no employee data, client prompt, or provider tool.
export const MODELS = Object.freeze(['gemma-4-31b-it', 'gemini-3.5-flash-lite'])
export const PROMPT = `Tu testes la compréhension d'une recherche fictive. Tu n'as accès à aucune base.
Demande : « Affiche les sorties présumées à confirmer cette semaine. »
Ne produis ni SQL ni résultats, n'appelle aucun outil.
Réponds uniquement par cet objet JSON, sans autre texte :
{"intent":"rechercher_pointages","filters":{"sortie":"presumee","decision":"en_attente","periode":"semaine_courante"}}`

function validInterpretation(text) {
  try {
    const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
    const f = value?.filters
    return value?.intent === 'rechercher_pointages' &&
      Object.keys(value).sort().join(',') === 'filters,intent' &&
      f?.sortie === 'presumee' && f?.decision === 'en_attente' && f?.periode === 'semaine_courante' &&
      Object.keys(f).sort().join(',') === 'decision,periode,sortie'
  } catch { return false }
}

export async function testModel(model, apiKey, fetchImpl = fetch, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0 } }),
    })
    if (!response.ok) {
      // Never expose provider errors, URLs, credentials, or headers to the caller.
      await response.body?.cancel()
      return { model, connected: false, code: response.status === 429 ? 'quota_provider'
        : response.status === 401 || response.status === 403 ? 'provider_access_denied'
        : response.status === 404 ? 'model_unavailable' : 'provider_error', status: response.status }
    }
    const data = await response.json()
    const candidate = data?.candidates?.[0]
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
    const text = parts.filter(p => p.thought !== true && typeof p.text === 'string').map(p => p.text).join('')
    const valid = candidate?.finishReason === 'STOP' && validInterpretation(text)
    const usage = data?.usageMetadata || {}
    const count = n => Number.isSafeInteger(n) && n >= 0 ? n : null
    return { model, connected: true, interpretation_valid: valid,
      code: valid ? 'ok' : 'unexpected_output',
      // This normalized fixed result is not evidence of real employee records.
      interpretation: valid ? { intent: 'rechercher_pointages', filters: {
        sortie: 'presumee', decision: 'en_attente', periode: 'semaine_courante',
      } } : null,
      usage: { input_tokens: count(usage.promptTokenCount), output_tokens: count(usage.candidatesTokenCount),
        total_tokens: count(usage.totalTokenCount) } }
  } catch {
    return { model, connected: false, code: controller.signal.aborted ? 'provider_timeout' : 'provider_unreachable' }
  } finally { clearTimeout(timer) }
}

/**
 * @param {{enabled: boolean, apiKey: string, allowedOrigins?: string[],
 * authorize: (authorization: string) => Promise<boolean>,
 * reserve: () => Promise<{allowed: boolean, remaining?: number}>, fetchImpl?: typeof fetch}} options
 */
export function createHandler({ enabled, apiKey, allowedOrigins = [], authorize, reserve, fetchImpl = fetch }) {
  return async req => {
    const origin = req.headers.get('origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' }
    if (origin && allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    }
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers })
    if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: 'origin_denied' })
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return reply(405, { error: 'post_required' })
    if (!enabled) return reply(503, { error: 'test_disabled' })
    const auth = req.headers.get('authorization')
    if (!/^Bearer\s+\S+$/i.test(auth || '')) return reply(401, { error: 'authentication_required' })
    let permitted
    try { permitted = await authorize(auth) } catch { return reply(503, { error: 'authorization_unavailable' }) }
    if (!permitted) return reply(403, { error: 'active_superadmin_required' })
    if (!apiKey) return reply(503, { error: 'provider_not_configured' })
    // Only the exact synthetic test is supported. No prompt/model from client.
    try {
      const reader = req.body?.getReader()
      let bytes = 0
      const chunks = []
      if (reader) {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.length
          if (bytes > 128) { await reader.cancel(); return reply(413, { error: 'body_too_large' }) }
          chunks.push(value)
        }
      }
      const buffer = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
      const body = JSON.parse(new TextDecoder().decode(buffer))
      if (!body || Object.keys(body).length !== 1 || body.action !== 'test') return reply(400, { error: 'fixed_test_only' })
    } catch { return reply(400, { error: 'invalid_json' }) }
    let allowance
    try { allowance = await reserve() } catch { return reply(503, { error: 'quota_unavailable' }) }
    if (allowance?.allowed !== true) return reply(429, { error: 'daily_test_limit', limit: 3 })
    // Fixed two calls, no automatic retries or fallback loops.
    const results = await Promise.all(MODELS.map(model => testModel(model, apiKey, fetchImpl)))
    return reply(200, { synthetic_test: true, ok: results.every(r => r.code === 'ok'), results,
      runs_remaining: allowance.remaining })
  }
}
