import { createClient } from 'npm:@supabase/supabase-js@2.87.3'
import { createRecoveryHandler } from './handler.js'
const url = Deno.env.get('SUPABASE_URL')!
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const server = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options)
Deno.serve(createRecoveryHandler({
  origin: Deno.env.get('ADMIN_APP_ORIGIN') || '', server,
  makeCaller: (authorization: string) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    ...options, global: { headers: { Authorization: authorization } },
  }),
}))
