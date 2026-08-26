import type { Habit, Task } from '../types'
import { isCompletedOn, isScheduled } from '../utils/habitUtils'
import { todayStr } from '../utils/dateUtils'

/**
 * Browser notifications for task and habit reminders.
 *
 * The honest limitation, stated here because it shapes everything below: a page
 * can only raise a notification while it is running. Clarity has no service
 * worker and no push server, so reminders fire when a Clarity tab is open —
 * foreground or background — and not when the browser is closed. Anything
 * stronger needs a push subscription and a server to send from.
 *
 * Firing is deduplicated through localStorage so a reload does not re-announce
 * something already shown, and so a habit nags once a day rather than every
 * time the checker runs.
 */

const FIRED_KEY = 'clarity.notified.v1'
/** Anything older than this is dropped from the dedupe log. */
const KEEP_DAYS = 3

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function permissionState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission as PermissionState
}

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
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

function fire(key: string, title: string, body: string, tag: string): void {
  const fired = readFired()
  if (fired[key]) return
  try {
    new Notification(title, { body, tag, icon: './favicon.svg' })
  } catch {
    return
  }
  fired[key] = todayStr()
  writeFired(prune(fired))
}

/** 'HH:MM' for right now, local. */
function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * One sweep. Called on a timer; safe to call as often as you like because
 * everything it might announce is deduplicated by key.
 */
export function checkReminders(tasks: Task[], habits: Habit[]): void {
  if (permissionState() !== 'granted') return
  const today = todayStr()
  const now = Date.now()

  for (const t of tasks) {
    if (!t.reminder || t.completed || t.deletedAt) continue
    const due = new Date(t.reminder).getTime()
    if (Number.isNaN(due) || due > now) continue
    // Only announce a reminder that came due recently; an old one that was
    // never seen because the app was closed should not ambush on next open.
    if (now - due > 6 * 3_600_000) continue
    fire(`task:${t.id}:${t.reminder}`, 'Reminder', t.title, `task-${t.id}`)
  }

  const hhmm = nowHHMM()
  for (const h of habits) {
    if (!h.reminderTime || h.archivedAt) continue
    if (!isScheduled(h, today) || isCompletedOn(h, today)) continue
    // Fire from the minute it is due until the end of the day, once.
    if (hhmm < h.reminderTime) continue
    fire(`habit:${h.id}:${today}`, h.name, 'Still open for today.', `habit-${h.id}`)
  }
}
