import { createClient } from 'npm:@supabase/supabase-js@2.87.3'
import { createHandler } from './core.js'

const url = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve(createHandler({
  enabled: Deno.env.get('AI_SMOKE_TEST_ENABLED') === 'true',
  apiKey: Deno.env.get('GEMINI_API_KEY') || '',
  allowedOrigins: (Deno.env.get('AI_TEST_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean),
  authorize: async (authorization: string) => {
    // Validate the actual session with Auth; never trust decoded JWT claims alone.
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return false
    // Authorization metadata only; no employees, salaries, schedules or attendance.
    const { data: admin, error: adminError } = await client.from('admins')
      .select('role,is_active').eq('user_id', data.user.id).maybeSingle()
    return !adminError && admin?.is_active === true && admin.role === 'super_admin'
  },
  reserve: async () => {
    const { data, error } = await client.rpc('encheck_ai_test_reserver')
    if (error) throw new Error('quota_unavailable')
    return data
  },
}))
