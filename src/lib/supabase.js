// ═══════════════════════════════════════════════════════════
// 🔌 CONFIGURATION SUPABASE
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cxggndvhwdolbtyezjde.supabase.co'
const supabaseAnonKey = 'sb_publishable_QqawhPWeRKGvJOGXIopvJQ_gSkSCk0T'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)