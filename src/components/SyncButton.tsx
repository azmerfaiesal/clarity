import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  getSyncState,
  requestSync,
  subscribeSyncState,
  type SyncState,
} from '../lib/supabase'

function relativeTime(ts: string | null): string {
  if (!ts) return 'never'
  const then = new Date(ts).getTime()
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function SyncButton({ userId }: { userId: string }) {
  const [state, setState] = useState<SyncState | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    getSyncState(userId).then((s) => alive && setState(s))
    const unsub = subscribeSyncState(userId, (s) => alive && setState(s))
    // Refresh the relative label periodically
    timer.current = window.setInterval(() => {
      getSyncState(userId).then((s) => alive && setState(s))
    }, 30000)
    return () => {
      alive = false
      unsub()
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [userId])

  const onSync = useCallback(async () => {
    setBusy(true)
    try {
      await requestSync(userId)
      setState((s) => ({ ...(s as SyncState), pending: true, pending_at: new Date().toISOString() }))
    } finally {
      // The Mac agent usually completes within ~1-2 sync cycles (30s).
      setTimeout(() => setBusy(false), 1200)
    }
  }, [userId])

  const pending = state?.pending
  const label = pending
    ? 'Sync pending…'
    : `Last synced ${relativeTime(state?.last_synced_at ?? null)}`

  return (
    <div className="border-t border-neutral-200/70 p-2.5 dark:border-neutral-800">
      <button
        type="button"
        onClick={onSync}
        disabled={busy}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-200/60 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy || pending ? 'animate-spin' : ''}`} />
        <span>Sync with Apple Reminders</span>
      </button>
      <div className="px-2.5 pt-1 text-[10px] text-neutral-400">
        {label}
      </div>
    </div>
  )
}
