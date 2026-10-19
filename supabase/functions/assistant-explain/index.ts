import { createClient } from 'npm:@supabase/supabase-js@2.87.3'
import { createHandler } from './core.js'
const client = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
  auth: { persistSession: false, autoRefreshToken: false },
})
Deno.serve(createHandler({
  enabled: Deno.env.get('AI_ASSISTANT_ENABLED') === 'true',
  apiKey: Deno.env.get('GEMINI_API_KEY') || '',
  allowedOrigins: (Deno.env.get('AI_TEST_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean),
  authorize: async token => {
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return null
    const { data: admin, error: adminError } = await client.from('admins').select('id,is_active')
      .eq('user_id', data.user.id).eq('is_active', true).maybeSingle()
    return !adminError && admin?.is_active === true ? data.user.id : null
  },
  reserve: async user => {
    const { data, error } = await client.rpc('encheck_ai_explanation_reserve', { p_user: user })
    if (error) throw Error('quota_unavailable')
    return data === true
  },
}))
