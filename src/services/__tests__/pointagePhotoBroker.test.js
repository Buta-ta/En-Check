import { it, expect, vi } from 'vitest'
import {
  createPhotoHandler,
  ownPhotoPath,
} from '../../../supabase/functions/pointage-enrollment-photo/handler.js'
const A = '11111111-1111-4111-8111-111111111111',
  E = '22222222-2222-4222-8222-222222222222',
  url = 'https://example.supabase.co',
  path = `${E}/${A}_123.jpg`
function fixture() {
  const rpc = vi.fn(async () => ({
    data: {
      ok: true,
      path,
      employee_id: A,
      enterprise_id: E,
      employee: { id: A, enterprise_id: E },
    },
  }))
  const upload = vi.fn(async () => ({ data: { path } })),
    sign = vi.fn(async () => ({ data: { signedUrl: 'signed' } })),
    bucket = vi.fn(async () => ({ data: { public: false } }))
  const record = vi.fn(async () => ({
    data: {
      enrollment_photo_url: `${url}/storage/v1/object/authenticated/face-enrollments/${path}`,
    },
  }))
  const eq = vi.fn(() => q),
    q = { select: () => q, eq, maybeSingle: record }
  const server = {
    from: () => q,
    storage: {
      getBucket: bucket,
      from: () => ({ upload, createSignedUrl: sign }),
    },
  }
  const normalize = vi.fn((b) => b),
    handler = createPhotoHandler({
      caller: { rpc },
      server,
      url,
      normalizeJpeg: normalize,
    })
  const request = (data) =>
    handler(
      new Request('https://edge.example.test', {
        method: 'POST',
        body: JSON.stringify({ p_jeton: 'fixture', ...data }),
      }),
    )
  return { rpc, upload, sign, bucket, record, eq, normalize, request }
}
it('uploads only to a server-issued own path, as JPEG without overwrite', async () => {
  const f = fixture(),
    r = await f.request({ action: 'upload', jpeg_base64: '/9j/' })
  expect(r.status).toBe(200)
  expect((await r.json()).photo_reference).toContain('/authenticated/')
  expect(f.rpc).toHaveBeenCalledWith('encheck_photo_upload_reserver', {
    p_jeton: 'fixture',
  })
  expect(f.upload).toHaveBeenCalledWith(path, expect.any(Uint8Array), {
    contentType: 'image/jpeg',
    upsert: false,
  })
  expect(f.normalize).toHaveBeenCalledTimes(1)
})
it('checks enrollment ownership before signing and never accepts a path from the request', async () => {
  const f = fixture(),
    r = await f.request({
      action: 'read',
      enrollment_id: A,
      path: 'victim.jpg',
    })
  expect(r.status).toBe(200)
  expect(f.eq).toHaveBeenCalledWith('employee_id', A)
  expect(f.eq).toHaveBeenCalledWith('enterprise_id', E)
  expect(f.sign).toHaveBeenCalledWith(path, 300)
})
it('rejects cross-owner, cross-host and traversal photo references', () => {
  for (const ref of [
    `${url}/storage/v1/object/authenticated/face-enrollments/${E}/${E}_123.jpg`,
    `https://evil.test/storage/v1/object/public/face-enrollments/${path}`,
    `${url}/storage/v1/object/public/face-enrollments/${E}/${A}_%2f..%2f123.jpg`,
  ])
    expect(ownPhotoPath(ref, url, A, E)).toBeNull()
})
it('refuses expired tokens, quota excess, public buckets and forged record paths', async () => {
  const f = fixture()
  f.rpc.mockResolvedValueOnce({ data: { ok: false, raison: 'jeton_expire' } })
  expect((await f.request({ action: 'read', enrollment_id: A })).status).toBe(
    403,
  )
  f.rpc.mockResolvedValueOnce({ data: { ok: false, raison: 'quota_photo' } })
  expect(
    (await f.request({ action: 'upload', jpeg_base64: '/9j/' })).status,
  ).toBe(429)
  f.bucket.mockResolvedValueOnce({ data: { public: true } })
  expect(
    (await f.request({ action: 'upload', jpeg_base64: '/9j/' })).status,
  ).toBe(503)
  f.record.mockResolvedValueOnce({
    data: { enrollment_photo_url: 'https://evil.test/photo' },
  })
  expect((await f.request({ action: 'read', enrollment_id: A })).status).toBe(
    403,
  )
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.sign).not.toHaveBeenCalled()
})
it('rejects malformed and oversized inputs without leaking service errors', async () => {
  const f = fixture()
  expect(
    (await f.request({ action: 'upload', jpeg_base64: 'not-an-image' })).status,
  ).toBe(400)
  expect(
    (
      await f.request({
        action: 'upload',
        jpeg_base64: 'x'.repeat(3 * 1024 * 1024),
      })
    ).status,
  ).toBe(400)
  f.rpc.mockRejectedValueOnce(Error('secret internal detail'))
  const r = await f.request({ action: 'read', enrollment_id: A })
  expect(r.status).toBe(503)
  expect(await r.text()).not.toContain('secret')
})
