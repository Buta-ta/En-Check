import { it, expect, vi, beforeEach } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))
import { mfaObligationStatus } from '../adminMfaObligation'
beforeEach(() => vi.resetAllMocks())
it('allows a not-yet-installed migration only for the explicit missing RPC code', async () => {
  rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
  expect(await mfaObligationStatus()).toEqual({
    required: false,
    satisfied: true,
  })
})
it('fails closed on network/permission errors and malformed payloads', async () => {
  for (const result of [
    { error: { code: '42501' } },
    { error: { code: '503' } },
    { data: {} },
    { data: { required: true } },
  ]) {
    rpc.mockResolvedValue(result)
    await expect(mfaObligationStatus()).rejects.toThrow('indisponible')
  }
})
it('preserves a pending requirement', async () => {
  rpc.mockResolvedValue({ data: { required: true, satisfied: false } })
  expect(await mfaObligationStatus()).toEqual({
    required: true,
    satisfied: false,
  })
})
