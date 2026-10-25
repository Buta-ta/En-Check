import { it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { adminSessionAllowed } from '../../../supabase/functions/_shared/admin-session.js'
it('checks the caller JWT through RPC, never service-role authorization', async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: { rest_guard_active: false }, error: null })
  const factory = vi.fn(() => ({ rpc }))
  expect(
    await adminSessionAllowed(
      factory,
      'https://example.supabase.co',
      'public-key',
      'Bearer signed-token',
    ),
  ).toBe(true)
  expect(factory).toHaveBeenCalledWith(
    'https://example.supabase.co',
    'public-key',
    expect.objectContaining({
      global: { headers: { Authorization: 'Bearer signed-token' } },
    }),
  )
  expect(rpc).toHaveBeenCalledWith('encheck_account_security_status')
})
it('denies missing migration, revocation, malformed responses and connection failure', async () => {
  for (const result of [
    { error: { code: 'PGRST202' } },
    { error: { code: '42501' } },
    { data: {} },
    { data: null },
  ]) {
    expect(
      await adminSessionAllowed(
        () => ({ rpc: async () => result }),
        'url',
        'anon',
        'token',
      ),
    ).toBe(false)
  }
  expect(
    await adminSessionAllowed(
      () => ({
        rpc: async () => {
          throw Error('network')
        },
      }),
      'url',
      'anon',
      'token',
    ),
  ).toBe(false)
  expect(await adminSessionAllowed(vi.fn(), 'url', 'anon', '')).toBe(false)
})
it('wires all five legacy JWT-driven Edge handlers to the session guard', () => {
  for (const name of [
    'assistant-chat',
    'assistant-explain',
    'test-ai-search',
    'send-email',
    'send-push',
  ]) {
    const code = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8')
    expect(code).toContain("from '../_shared/admin-session.js'")
    expect(code).toContain('if (!await adminSessionAllowed(')
  }
})

it('denies custom roles on the legacy privileged Edge paths', async () => {
  expect(
    await adminSessionAllowed(
      () => ({
        rpc: async () => ({
          data: { rest_guard_active: true, custom_role_restricted: true },
          error: null,
        }),
      }),
      'url',
      'anon',
      'token',
    ),
  ).toBe(false)
})
