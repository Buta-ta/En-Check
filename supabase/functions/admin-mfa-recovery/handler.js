const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function readBody(request) {
  const reader = request.body?.getReader()
  if (!reader) throw Error()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4096) {
        await reader.cancel()
        throw Error()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}
export function createRecoveryHandler({ origin, makeCaller, server }) {
  return async (request) => {
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers':
            'authorization,apikey,content-type,x-client-info',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          Vary: 'Origin',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      })
    if (
      !origin.startsWith('https://') ||
      request.headers.get('origin') !== origin
    )
      return reply(403, { error: 'Origine non autorisée.' })
    if (request.method === 'OPTIONS') return reply(200, {})
    if (request.method !== 'POST')
      return reply(405, { error: 'Méthode non autorisée.' })
    const authorization = request.headers.get('authorization') || ''
    if (!authorization.startsWith('Bearer '))
      return reply(401, { error: 'Connexion requise.' })
    let input
    try {
      input = await readBody(request)
    } catch {
      return reply(400, { error: 'Requête invalide.' })
    }
    if (
      !input ||
      !uuid.test(input.target_id || '') ||
      typeof input.confirm_email !== 'string' ||
      input.confirm_email.length > 320 ||
      typeof input.reason !== 'string' ||
      input.reason.trim().length < 5 ||
      input.reason.length > 500
    )
      return reply(400, { error: 'Paramètres invalides.' })
    try {
      const caller = makeCaller(authorization)
      const user = await caller.auth.getUser()
      if (user.error || !user.data?.user)
        return reply(401, { error: 'Connexion requise.' })
      const prepared = await caller.rpc('encheck_mfa_recovery_prepare_v2', {
        p_target_id: input.target_id,
        p_confirm_email: input.confirm_email,
        p_reason: input.reason,
      })
      if (prepared.error || !uuid.test(prepared.data?.id || ''))
        return reply(403, {
          error:
            'Récupération refusée. Vérifiez MFA, identité, activation et état précédent.',
        })
      const jobId = prepared.data.id
      const claimed = await server.rpc('encheck_mfa_recovery_claim_v2', {
        p_job_id: jobId,
      })
      if (claimed.error || !uuid.test(claimed.data?.user_id || ''))
        return reply(503, {
          error:
            'Intervention non démarrée. Consultez son état avant toute relance.',
        })
      const userId = claimed.data.user_id
      let success = false
      try {
        const result = await server.auth.admin.mfa.listFactors({ userId })
        if (result.error || !Array.isArray(result.data?.factors)) throw Error()
        for (const factor of result.data.factors) {
          const deleted = await server.auth.admin.mfa.deleteFactor({
            userId,
            id: factor.id,
          })
          if (deleted.error) throw Error()
        }
        success = true
      } catch {
        /* Never log provider responses, JWTs, factor IDs or secrets. */
      }
      const recorded = await server.rpc('encheck_mfa_recovery_finish_v2', {
        p_job_id: jobId,
        p_success: success,
      })
      if (recorded.error || !success || recorded.data?.completed !== true)
        return reply(503, {
          error:
            'Récupération non confirmée ou partielle. Consultez son état ; aucune relance automatique.',
        })
      return reply(200, { completed: true })
    } catch {
      return reply(503, {
        error:
          'Récupération non confirmée. Consultez son état avant de recommencer.',
      })
    }
  }
}
