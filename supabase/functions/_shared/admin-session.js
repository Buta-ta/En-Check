// Dependency injection keeps the guard testable without Deno or a service key.
// This MUST use the caller JWT: a service-role RPC has no caller session to check.
export async function adminSessionAllowed(
  createClient,
  url,
  anonKey,
  authorization,
) {
  if (!url || !anonKey || typeof authorization !== 'string') return false
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  try {
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await caller.rpc('encheck_account_security_status')
    // The SQL function checks active identity, Auth session, MFA, revocation
    // and mandatory password rotation. Missing migration is a denial, not fallback.
    return (
      !error && data !== null && typeof data?.rest_guard_active === 'boolean'
    )
  } catch {
    return false
  }
}
