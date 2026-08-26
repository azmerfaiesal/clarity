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

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

function withKeepalive(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = init?.body
  const small = typeof body === 'string' && body.length < KEEPALIVE_MAX_BODY
  if (method !== 'GET' && method !== 'HEAD' && small) {
    return fetch(input, { ...init, keepalive: true })
  }
  return fetch(input, init)
}

/*
 * Two failures shaped the wrapper below, both found in the project's own edge
 * logs rather than guessed at:
 *
 *   PGRST303 ("JWT expired") — one 401 on a page load, when a device that has
 *   been asleep revalidates in the same instant its token is being refreshed
 *   and loses the race. The fix is simply to mint a token and ask again.
 *
 *   42501 ("insufficient privilege") — a burst of 39 writes rejected in one
 *   second. supabase-js falls back to sending the publishable key as the bearer
 *   when it cannot produce a session token, so those requests arrived
 *   *anonymous*: RLS refused every write, and the matching reads were worse
 *   still, coming back `200 []`. An empty snapshot is indistinguishable from a
 *   real one, and the store treats rows missing from a snapshot as deleted
 *   elsewhere — so an anonymous read could wipe the local cache. An
 *   unauthenticated request to a per-user table is never worth sending.
 */

const REST_PREFIX = '/rest/v1/'

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function isUserDataRequest(input: RequestInfo | URL): boolean {
  try {
    return new URL(requestUrl(input), SUPABASE_URL).pathname.startsWith(REST_PREFIX)
  } catch {
    return false
  }
}

/**
 * The bearer supabase-js chose for this request, or null when it fell back to
 * the publishable key — which is its way of saying "there is no session".
 */
function sessionBearer(init?: RequestInit): string | null {
  const auth = new Headers(init?.headers).get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  return token && token !== SUPABASE_ANON_KEY ? token : null
}

/** Set once the client below exists, so the fetch can reach back into it. */
let client: SupabaseClient | null = null

/** One refresh at a time, however many requests are waiting on it. */
let refreshing: Promise<string | null> | null = null

function refreshedToken(): Promise<string | null> {
  if (!client) return Promise.resolve(null)
  if (!refreshing) {
    refreshing = client.auth
      .refreshSession()
      .then(({ data }) => data.session?.access_token ?? null)
      .catch(() => null)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

export const resilientFetch: typeof fetch = async (input, init) => {
  if (!isUserDataRequest(input)) return withKeepalive(input, init)

  if (!sessionBearer(init)) {
    // Nothing signed in to speak for. Fail like a dropped connection so the
    // caller keeps its rows queued instead of recording a phantom success.
    throw new Error('Not signed in — the request was not sent.')
  }

  const response = await withKeepalive(input, init)
  if (response.status !== 401) return response

  // A rejected token is worth exactly one more try on a fresh one. `init` is
  // reused as-is apart from the header: supabase-js only ever sends string
  // bodies, so there is no consumed stream to worry about.
  const token = await refreshedToken()
  if (!token) return response

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return withKeepalive(input, { ...init, headers })
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: resilientFetch },
})

client = supabase
