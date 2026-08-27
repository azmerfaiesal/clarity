/**
 * A running timer for a duration habit.
 *
 * Kept outside React state and in localStorage because the thing being timed
 * outlives the popup it was started from: thirty minutes of reading means
 * closing the tab, or at least navigating away from the habit. The elapsed
 * figure is derived from wall-clock stamps rather than counted up by an
 * interval, so a suspended phone comes back with the right number instead of
 * however many ticks the browser felt like delivering.
 *
 * One timer per habit, since two sessions of the same habit at once is not a
 * thing anyone means to do.
 */

const KEY = 'clarity.timers.v1'

export interface Timer {
  /** The day the elapsed time will be logged against. */
  date: string
  /** Seconds banked from previous runs of this session. */
  banked: number
  /** ISO stamp of when the current run began, or null while paused. */
  startedAt: string | null
}

type Timers = Record<string, Timer>

function read(): Timers {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Timers) : {}
  } catch {
    return {}
  }
}

function write(map: Timers): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* storage unavailable — the timer simply will not survive a reload */
  }
}

export function loadTimer(habitId: string): Timer | null {
  return read()[habitId] ?? null
}

export function saveTimer(habitId: string, timer: Timer): void {
  const map = read()
  map[habitId] = timer
  write(map)
}

export function clearTimer(habitId: string): void {
  const map = read()
  delete map[habitId]
  write(map)
}

/** Seconds on the clock right now, running or paused. */
export function elapsed(timer: Timer, now: number = Date.now()): number {
  if (!timer.startedAt) return timer.banked
  const since = (now - new Date(timer.startedAt).getTime()) / 1000
  return timer.banked + Math.max(0, since)
}

/** `1:04:09`, or `4:09` under an hour. */
export function formatClock(seconds: number): string {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}
