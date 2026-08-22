// Supabase client for Clarity.
//
// Configuration (all optional — sensible defaults are provided so the app still
// builds and runs):
//   1. Vite env vars  ->  import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
//   2. Fallback       ->  the same project the Daily Dashboard uses, so the Clarity
//                         iframe embedded there can share the user's session.

const FALLBACK_URL = 'https://pakfyyvdfwxglcjkatqz.supabase.co'
const FALLBACK_ANON = 'sb_publishable_sC0C_y4pbJOUEANyk7o8Tg_u5PZpzVs'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
