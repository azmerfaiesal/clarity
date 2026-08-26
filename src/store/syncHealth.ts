import { useSyncExternalStore } from 'react'

/**
 * Whether syncing is actually working, and what went wrong if it is not.
 *
 * Every write in this app used to end in a swallowed catch. That is fine for a
 * dropped connection — the row is cached and pushed again later — but it also
 * hid a write the server was refusing outright, which no amount of retrying
 * will ever fix. One such refusal went unnoticed for days: a device happily
 * showed a habit that the server had rejected every single time, and the app
 * reported that everything was syncing normally.
 *
 * So failures are recorded here and shown in Settings. The point is not to
 * alarm anyone — it is that "not syncing" should be something you can find out
 * rather than something you have to deduce.
 */

export interface SyncHealth {
  /** Null until something has been tried. */
  ok: boolean | null
  /** The server's own words, which is usually the useful part. */
  lastError: string | null
  lastErrorAt: string | null
  lastOkAt: string | null
}

let state: SyncHealth = { ok: null, lastError: null, lastErrorAt: null, lastOkAt: null }

const listeners = new Set<() => void>()

function set(next: SyncHealth) {
  state = next
  for (const fn of listeners) fn()
}

/** A read or write that reached the server and was accepted. */
export function reportSyncOk(): void {
  const now = new Date().toISOString()
  if (state.ok === true && state.lastOkAt) {
    // Still fine — no need to wake every subscriber on each successful write.
    state = { ...state, lastOkAt: now }
    return
  }
  set({ ok: true, lastError: null, lastErrorAt: null, lastOkAt: now })
}

/** A read or write the server refused, or that never arrived. */
export function reportSyncError(operation: string, error: unknown): void {
  const detail =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  set({
    ok: false,
    lastError: `${operation}: ${detail}`.slice(0, 300),
    lastErrorAt: new Date().toISOString(),
    lastOkAt: state.lastOkAt,
  })
}

/** Back to a clean slate, for a retry the user asked for. */
export function clearSyncError(): void {
  if (state.ok !== false) return
  set({ ...state, ok: null, lastError: null, lastErrorAt: null })
}

/** The current state, for tests and for anything outside React. */
export function syncHealth(): SyncHealth {
  return state
}

export function useSyncHealth(): SyncHealth {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
    () => state,
  )
}
