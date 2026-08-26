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

/**
 * Writes go out with `keepalive`, so the browser finishes them even if the page
 * is put to sleep a moment later.
 *
 * This is not hypothetical: iOS Safari suspends a tab the instant you switch
 * apps, and an ordinary fetch dies with it. Create a habit, lock the phone, and
 * the row never reaches the server while the device happily shows it — which
 * is exactly how one device ends up with a habit the others have never heard
 * of. Reads are left alone; they can simply be asked again.
 *
 * `keepalive` caps the request body at 64KB, so anything larger falls back to a
 * normal fetch rather than failing outright.
 */
const KEEPALIVE_MAX_BODY = 60_000

export const resilientFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = init?.body
  const small = typeof body === 'string' && body.length < KEEPALIVE_MAX_BODY
  if (method !== 'GET' && method !== 'HEAD' && small) {
    return fetch(input, { ...init, keepalive: true })
  }
  return fetch(input, init)
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: resilientFetch },
})
