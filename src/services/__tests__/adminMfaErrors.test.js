import { it, expect } from 'vitest'
import { adminMfaErrorMessage } from '../adminMfaErrors'
it('does not infer an incorrect code from HTTP 422 alone', () => {
  const message = adminMfaErrorMessage({
    status: 422,
    message: 'private details',
  })
  expect(message).toContain('ne précise pas la cause')
  expect(message).not.toContain('Code non accepté')
  expect(message).not.toContain('private details')
})
it('explains allowlisted diagnostics without displaying raw messages', () => {
  for (const code of [
    'mfa_verification_failed',
    'mfa_challenge_expired',
    'mfa_ip_address_mismatch',
    'mfa_factor_not_found',
    'over_request_rate_limit',
  ]) {
    const message = adminMfaErrorMessage({ code, message: 'secret payload' })
    expect(message).toContain(code)
    expect(message).not.toContain('secret payload')
  }
})
it('keeps unknown codes, HTML, and provider payloads private', () => {
  for (const error of [
    undefined,
    null,
    { code: '<secret>', message: 'private' },
    { code: '__proto__' },
    new Error('private'),
  ]) {
    expect(adminMfaErrorMessage(error)).toContain('Opération non confirmée')
    expect(adminMfaErrorMessage(error)).not.toContain('<secret>')
  }
})
