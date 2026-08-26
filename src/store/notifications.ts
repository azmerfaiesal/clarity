import type { Habit, Task } from '../types'
import { isCompletedOn, isScheduled } from '../utils/habitUtils'
import { todayStr } from '../utils/dateUtils'

/**
 * Browser notifications for task and habit reminders.
 *
 * The honest limitation, stated here because it shapes everything below: a page
 * can only raise a notification while it is running. Clarity has no push server
 * to send from, so reminders fire when Clarity is open — a foreground tab, a
 * background tab, or the installed app — and not when it has been closed
 * entirely. Anything stronger needs a push subscription and a server.
 *
 * What *is* handled here is delivery, which used to be the thing that failed
 * silently. `new Notification(...)` is the desktop-only path: Android Chrome
 * throws `Illegal constructor` from it, and an iOS home-screen app does not
 * define the constructor at all. Both require the service worker's
 * `showNotification()` instead, so that is tried first and the constructor is
 * only the fallback. The old code caught the throw and returned, which is why a
 * phone showed nothing and said nothing about why.
 *
 * Firing is deduplicated through localStorage so a reload does not re-announce
 * something already shown, and so a habit nags once a day rather than every
 * time the checker runs.
 */

const FIRED_KEY = 'clarity.notified.v1'
/** Anything older than this is dropped from the dedupe log. */
const KEEP_DAYS = 3
/** PNG rather than the SVG favicon: several platforms will not render SVG here. */
const ICON = './icon-192.png'

export type PermissionState =
  | 'unsupported'
  /** iOS: the API only exists once the app is on the Home Screen. */
  | 'needs-install'
  | 'default'
  | 'granted'
  | 'denied'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; the touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** True in an installed home-screen app / standalone PWA window. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const legacy = (navigator as { standalone?: boolean }).standalone
  return window.matchMedia?.('(display-mode: standalone)').matches === true || legacy === true
}

export function permissionState(): PermissionState {
  if (typeof Notification === 'undefined') {
    // Safari on iOS hides the whole API until the app is installed, so "this
    // browser does not support notifications" was both wrong and a dead end.
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  return Notification.permission as PermissionState
}

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return permissionState()
  try {
    // Safari's `requestPermission` is the old callback form: it returns
    // undefined and hands the answer to a callback. Awaiting it there yields
    // undefined, which used to leave the panel showing "Enable notifications"
    // even after the user had allowed them. Support both shapes, then read
    // `Notification.permission` back as the authority either way.
    const result = await new Promise<string | undefined>((resolve) => {
      const returned = Notification.requestPermission(resolve)
      if (returned && typeof returned.then === 'function') void returned.then(resolve)
    })
    const state = (result ?? Notification.permission) as PermissionState
    return state === 'granted' || state === 'denied' ? state : permissionState()
  } catch {
    return permissionState()
  }
}

// ---- service worker ----

/**
 * Register the worker that actually shows the notifications. Called once at
 * start-up; failure is not fatal, it only means the desktop-constructor path is
 * all that is left.
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    // Resolved against the document so the same build works from the repo root
    // in dev and from /clarity/ on Pages.
    await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, {
      scope: './',
    })
  } catch {
    /* no worker — `show` falls back to the page-level constructor */
  }
}

/** The active registration, or null. Never hangs waiting for one that is absent. */
async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (!existing) return null
    if (existing.active) return existing
    // Registered but still installing: `ready` resolves when one takes over.
    await navigator.serviceWorker.ready
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

/** Show one notification. Returns whether it actually reached the screen. */
async function show(title: string, body: string, tag: string): Promise<boolean> {
  const options: NotificationOptions = { body, tag, icon: ICON, badge: ICON }

  const registration = await activeRegistration()
  if (registration) {
    try {
      await registration.showNotification(title, options)
      return true
    } catch {
      /* fall through to the constructor */
    }
  }

  try {
    // Desktop browsers, and the only path when no worker is registered.
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}

// ---- dedupe ----

function readFired(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeFired(map: Record<string, string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map))
  } catch {
    /* storage full or unavailable — worst case a reminder repeats */
  }
}

/** Drop dedupe entries old enough that they can never match again. */
function prune(map: Record<string, string>): Record<string, string> {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(map)) if (v >= cutoff) out[k] = v
  return out
}

/**
 * Announce once. The dedupe entry is only written when the notification was
 * really shown — recording a failed attempt would swallow the reminder for
 * good, which is precisely what the old synchronous version did on a phone.
 */
async function fire(key: string, title: string, body: string, tag: string): Promise<void> {
  const fired = readFired()
  if (fired[key]) return
  if (!(await show(title, body, tag))) return
  // Re-read: the await above leaves room for another entry to have landed.
  const latest = readFired()
  latest[key] = todayStr()
  writeFired(prune(latest))
}

/** 'HH:MM' for right now, local. */
function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Showing is async now, so overlapping ticks must not both pass the dedupe. */
let sweeping = false

/**
 * One sweep. Called on a timer; safe to call as often as you like because
 * everything it might announce is deduplicated by key.
 */
export function checkReminders(tasks: Task[], habits: Habit[]): void {
  void sweep(tasks, habits)
}

async function sweep(tasks: Task[], habits: Habit[]): Promise<void> {
  if (permissionState() !== 'granted') return
  if (sweeping) return
  sweeping = true
  try {
    const today = todayStr()
    const now = Date.now()

    for (const t of tasks) {
      if (!t.reminder || t.completed || t.deletedAt) continue
      const due = new Date(t.reminder).getTime()
      if (Number.isNaN(due) || due > now) continue
      // Only announce a reminder that came due recently; an old one that was
      // never seen because the app was closed should not ambush on next open.
      if (now - due > 6 * 3_600_000) continue
      await fire(`task:${t.id}:${t.reminder}`, 'Reminder', t.title, `task-${t.id}`)
    }

    const hhmm = nowHHMM()
    for (const h of habits) {
      if (!h.reminderTime || h.archivedAt) continue
      if (!isScheduled(h, today) || isCompletedOn(h, today)) continue
      // Fire from the minute it is due until the end of the day, once.
      if (hhmm < h.reminderTime) continue
      await fire(`habit:${h.id}:${today}`, h.name, 'Still open for today.', `habit-${h.id}`)
    }
  } finally {
    sweeping = false
  }
}
