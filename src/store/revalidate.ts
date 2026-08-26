/**
 * Re-reading the server at the moments realtime cannot cover.
 *
 * A Supabase channel only delivers what happens while its socket is up. The
 * socket goes down constantly on a phone — the tab is suspended the moment you
 * switch apps, and a laptop lid closing does the same — and when it comes back
 * the client resubscribes but the events missed in between are gone for good.
 * The device then shows whatever it last heard until something else changes,
 * which is exactly what "it did not sync" looks like from the outside.
 *
 * So every store also pulls a fresh snapshot when the page is looked at again,
 * when the network returns, and when a channel reports itself subscribed —
 * that last one covers reconnects without needing to detect them.
 */

/** Two triggers can land together (focus and visibilitychange); collapse them. */
const SETTLE_MS = 300

export function onRevalidate(run: () => void): () => void {
  let timer: number | undefined

  const fire = () => {
    if (document.visibilityState !== 'visible') return
    window.clearTimeout(timer)
    timer = window.setTimeout(run, SETTLE_MS)
  }

  document.addEventListener('visibilitychange', fire)
  window.addEventListener('online', fire)
  window.addEventListener('focus', fire)

  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', fire)
    window.removeEventListener('online', fire)
    window.removeEventListener('focus', fire)
  }
}
