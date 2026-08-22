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

// ---- Apple Reminders <-> Clarity sync signalling ----
// The actual sync runs on the user's Mac (bridge/clarity_reminders_bridge.py, a
// launchd agent). The web app can't touch Reminders, so it raises a `pending`
// flag in `clarity_sync_state`; the Mac agent polls it and runs the sync.
// Last-write-wins conflict resolution happens in the bridge.

export interface SyncState {
  last_synced_at: string | null
  pending: boolean
  pending_at: string | null
}

export async function getSyncState(userId: string): Promise<SyncState | null> {
  const { data, error } = await supabase
    .from('clarity_sync_state')
    .select('last_synced_at, pending, pending_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  return data as SyncState | null
}

export async function requestSync(userId: string): Promise<void> {
  const { error } = await supabase
    .from('clarity_sync_state')
    .upsert(
      {
        user_id: userId,
        pending: true,
        pending_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

export function subscribeSyncState(
  userId: string,
  onChange: (s: SyncState | null) => void,
): () => void {
  const channel = supabase
    .channel(`sync-state-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'clarity_sync_state',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getSyncState(userId).then(onChange)
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
