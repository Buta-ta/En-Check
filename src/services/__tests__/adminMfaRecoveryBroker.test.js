import { it, expect, vi } from 'vitest'
import { createRecoveryHandler } from '../../../supabase/functions/admin-mfa-recovery/handler.js'
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222'
function setup() {
  const caller = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: A } } }) },
    rpc: vi.fn().mockResolvedValue({ data: { id: A } }),
  }
  const mfa = {
    listFactors: vi
      .fn()
      .mockResolvedValue({
        data: { factors: [{ id: 'factor1' }, { id: 'factor2' }] },
      }),
    deleteFactor: vi.fn().mockResolvedValue({ error: null }),
  }
  const server = {
    auth: { admin: { mfa } },
    rpc: vi
      .fn()
      .mockImplementation(async (name) =>
        name.includes('claim')
          ? { data: { user_id: B } }
          : { data: { completed: true } },
      ),
  }
  const handle = createRecoveryHandler({
    origin: 'https://admin.example.test',
    makeCaller: () => caller,
    server,
  })
  const request = (
    body = {
      target_id: B,
      confirm_email: 'fixture@example.test',
      reason: 'Identity checked',
    },
    origin = 'https://admin.example.test',
  ) =>
    new Request('https://edge.example.test', {
      method: 'POST',
      headers: { origin, authorization: 'Bearer fixture' },
      body: JSON.stringify(body),
    })
  return { caller, mfa, server, handle, request }
}
it('checks the caller and prepares/claims before deleting only server-resolved factors', async () => {
  const s = setup()
  const r = await s.handle(s.request())
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ completed: true })
  expect(s.mfa.deleteFactor).toHaveBeenCalledTimes(2)
  expect(s.mfa.deleteFactor).toHaveBeenCalledWith({ userId: B, id: 'factor1' })
  expect(s.server.rpc).toHaveBeenLastCalledWith(
    'encheck_mfa_recovery_finish_v2',
    { p_job_id: A, p_success: true },
  )
  expect(s.caller.rpc.mock.invocationCallOrder[0]).toBeLessThan(
    s.mfa.deleteFactor.mock.invocationCallOrder[0],
  )
  expect(r.headers.get('cache-control')).toBe('no-store')
})
it('refuses origin, oversized body and malformed input without provider writes', async () => {
  const s = setup()
  expect(
    (await s.handle(s.request({}, 'https://evil.example.test'))).status,
  ).toBe(403)
  expect((await s.handle(s.request('x'.repeat(5000)))).status).toBe(400)
  expect((await s.handle(s.request({ target_id: B }))).status).toBe(400)
  expect(s.caller.rpc).not.toHaveBeenCalled()
  expect(s.mfa.deleteFactor).not.toHaveBeenCalled()
})
it('never touches Auth factors when authorization or claim is refused', async () => {
  const s = setup()
  s.caller.rpc.mockResolvedValueOnce({ error: { message: 'secret' } })
  expect((await s.handle(s.request())).status).toBe(403)
  s.server.rpc.mockResolvedValueOnce({ error: { message: 'claim refused' } })
  expect((await s.handle(s.request())).status).toBe(503)
  expect(s.mfa.deleteFactor).not.toHaveBeenCalled()
})
it('records partial provider failure without leaking provider errors or claiming success', async () => {
  const s = setup()
  s.mfa.deleteFactor
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: { message: 'private provider details' } })
  const r = await s.handle(s.request())
  expect(r.status).toBe(503)
  expect(await r.text()).not.toContain('private provider details')
  expect(s.server.rpc).toHaveBeenLastCalledWith(
    'encheck_mfa_recovery_finish_v2',
    { p_job_id: A, p_success: false },
  )
})
it('requires explicit database completion, not just the absence of an RPC error', async () => {
  for (const result of [
    { data: { completed: false } },
    { data: null },
    { error: { message: 'unavailable' } },
  ]) {
    const s = setup()
    s.server.rpc.mockImplementation(async (name) =>
      name.includes('claim') ? { data: { user_id: B } } : result,
    )
    expect((await s.handle(s.request())).status).toBe(503)
  }
})
