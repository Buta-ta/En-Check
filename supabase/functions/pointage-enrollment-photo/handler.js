const MAX_IMAGE = 2 * 1024 * 1024
const MAX_BODY = 3 * 1024 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cors = {
  'Access-Control-Allow-Origin': '*', // Bearer in JSON, no cookies/credentials.
  'Access-Control-Allow-Headers':
    'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}
async function readLimited(request) {
  const reader = request.body?.getReader()
  if (!reader) throw Error('body')
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY) {
        await reader.cancel()
        throw Error('size')
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
export function ownPhotoPath(reference, url, employee, enterprise) {
  try {
    const parsed = new URL(reference)
    if (parsed.origin !== new URL(url).origin) return null
    const match =
      /^\/storage\/v1\/object\/(?:public|authenticated)\/face-enrollments\/(.+)$/.exec(
        parsed.pathname,
      )
    if (!match) return null
    const path = decodeURIComponent(match[1])
    if (!path.startsWith(`${enterprise}/${employee}_`)) return null
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}_[a-zA-Z0-9-]+\.jpg$/.test(path))
      return null
    return path
  } catch {
    return null
  }
}
export function createPhotoHandler({ caller, server, url, normalizeJpeg }) {
  return async function handle(request) {
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: cors })
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST')
      return reply(405, { ok: false, raison: 'methode_invalide' })
    let input
    try {
      input = await readLimited(request)
    } catch {
      return reply(400, { ok: false, raison: 'requete_invalide' })
    }
    if (
      !input ||
      !['upload', 'read'].includes(input.action) ||
      typeof input.p_jeton !== 'string' ||
      !input.p_jeton ||
      input.p_jeton.length > 1024
    )
      return reply(400, { ok: false, raison: 'requete_invalide' })
    try {
      if (input.action === 'read' && !uuid.test(input.enrollment_id || ''))
        return reply(400, { ok: false, raison: 'requete_invalide' })
      let bytes
      if (input.action === 'upload') {
        if (
          typeof input.jpeg_base64 !== 'string' ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(input.jpeg_base64)
        )
          return reply(400, { ok: false, raison: 'image_invalide' })
        try {
          bytes = Uint8Array.from(atob(input.jpeg_base64), (c) =>
            c.charCodeAt(0),
          )
        } catch {
          return reply(400, { ok: false, raison: 'image_invalide' })
        }
        if (
          bytes.length > MAX_IMAGE ||
          bytes.length < 3 ||
          bytes[0] !== 255 ||
          bytes[1] !== 216 ||
          bytes[2] !== 255
        )
          return reply(400, { ok: false, raison: 'image_invalide' })
      }
      const { data: scope, error } = await caller.rpc(
        input.action === 'upload'
          ? 'encheck_photo_upload_reserver'
          : 'encheck_employe_profil',
        { p_jeton: input.p_jeton },
      )
      if (error)
        return reply(503, { ok: false, raison: 'service_indisponible' })
      if (scope?.ok !== true)
        return reply(scope?.raison === 'quota_photo' ? 429 : 403, {
          ok: false,
          raison: scope?.raison || 'acces_refuse',
        })
      const emp =
        input.action === 'upload' ? scope.employee_id : scope.employee?.id
      const ent =
        input.action === 'upload'
          ? scope.enterprise_id
          : scope.employee?.enterprise_id
      if (!uuid.test(emp || '') || !uuid.test(ent || ''))
        return reply(503, { ok: false, raison: 'service_indisponible' })
      // Never upload/sign when the operator accidentally made the bucket public.
      const bucket = await server.storage.getBucket('face-enrollments')
      if (bucket.error || bucket.data?.public !== false)
        return reply(503, { ok: false, raison: 'stockage_non_prive' })
      if (input.action === 'upload') {
        const reference = `${url}/storage/v1/object/authenticated/face-enrollments/${scope.path}`
        if (ownPhotoPath(reference, url, emp, ent) !== scope.path)
          return reply(503, { ok: false, raison: 'service_indisponible' })
        try {
          bytes = normalizeJpeg(bytes)
        } catch {
          return reply(400, { ok: false, raison: 'image_invalide' })
        }
        if (!bytes?.length || bytes.length > MAX_IMAGE)
          return reply(400, { ok: false, raison: 'image_invalide' })
        const result = await server.storage
          .from('face-enrollments')
          .upload(scope.path, bytes, {
            contentType: 'image/jpeg',
            upsert: false,
          })
        if (result.error)
          return reply(503, { ok: false, raison: 'envoi_non_confirme' })
        // Store the reference, never a signed URL. It is not a public download.
        return reply(200, {
          ok: true,
          photo_reference: reference,
          photo_path: scope.path,
        })
      }
      const record = await server
        .from('face_enrollments')
        .select('enrollment_photo_url')
        .eq('id', input.enrollment_id)
        .eq('employee_id', emp)
        .eq('enterprise_id', ent)
        .maybeSingle()
      if (record.error)
        return reply(503, { ok: false, raison: 'service_indisponible' })
      const path = ownPhotoPath(
        record.data?.enrollment_photo_url,
        url,
        emp,
        ent,
      )
      if (!path) return reply(403, { ok: false, raison: 'acces_refuse' })
      const signed = await server.storage
        .from('face-enrollments')
        .createSignedUrl(path, 300)
      if (signed.error || !signed.data?.signedUrl)
        return reply(503, { ok: false, raison: 'lecture_indisponible' })
      return reply(200, {
        ok: true,
        url: signed.data.signedUrl,
        expire_dans: 300,
      })
    } catch {
      return reply(503, { ok: false, raison: 'service_indisponible' })
    }
  }
}
