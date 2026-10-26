import { createClient } from 'npm:@supabase/supabase-js@2.87.3'
import { normalizeJpeg } from './codec.ts'
import { createPhotoHandler } from './handler.js'
const url = Deno.env.get('SUPABASE_URL')!
const caller = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
const server = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
Deno.serve(createPhotoHandler({caller,server,url,normalizeJpeg}))
