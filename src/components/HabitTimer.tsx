import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Habit } from '../types'
import { clearTimer, elapsed, formatClock, loadTimer, saveTimer, type Timer } from '../store/timers'

/**
 * Time a session rather than estimating it afterwards.
 *
 * Offered only for habits measured in minutes, and only on today: timing is a
 * thing you do now, and a stopwatch against last Tuesday would be a lie. The
 * clock reads hours and minutes, with seconds trailing so it is visibly
 * running rather than apparently stuck for the first sixty of them.
 *
 * Stopping banks the whole session to the day in one go, rounded to the
 * nearest minute — a habit's history is kept in minutes, and half of one is
 * not a distinction anybody is keeping.
 */
export function HabitTimer({
  habit,
  date,
  onLog,
}: {
  habit: Habit
  date: string
  /** Add minutes to the day. */
  onLog: (minutes: number) => void
}) {
  const [timer, setTimer] = useState<Timer | null>(() => {
    const saved = loadTimer(habit.id)
    // A timer left running on a different day belongs to that day, not this.
    return saved && saved.date === date ? saved : null
  })
  const [, tick] = useState(0)

  const running = timer?.startedAt != null

  // Redraw once a second while running; the number itself comes from the
  // stamps, so a missed tick costs nothing.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const put = useCallback(
    (next: Timer | null) => {
      setTimer(next)
      if (next) saveTimer(habit.id, next)
      else clearTimer(habit.id)
    },
    [habit.id],
  )

  const seconds = timer ? elapsed(timer) : 0

  const start = () => put({ date, banked: timer?.banked ?? 0, startedAt: new Date().toISOString() })

  const pause = () => {
    if (!timer) return
    put({ ...timer, banked: elapsed(timer), startedAt: null })
  }

  const stop = () => {
    if (!timer) return
    const minutes = Math.round(elapsed(timer) / 60)
    if (minutes > 0) onLog(minutes)
    put(null)
  }

  const reset = () => put(null)

  return (
    <div className="mt-2 border-t border-line pt-2">
      <span className="label mb-1.5 block">Timer</span>
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-lg tabular-nums"
          style={{ color: running ? habit.color : undefined }}
          aria-live="off"
        >
          {formatClock(seconds)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={running ? pause : start}
            aria-label={running ? 'Pause timer' : 'Start timer'}
            title={running ? 'Pause' : 'Start'}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={seconds === 0}
            aria-label="Reset timer"
            title="Reset — discards this session"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line text-faint transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={stop}
        disabled={seconds < 30}
        title={seconds < 30 ? 'Nothing to log yet' : undefined}
        className="mt-2 w-full cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-all hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40"
      >
        Stop and log {seconds >= 30 ? `${Math.round(seconds / 60)}m` : ''}
      </button>
    </div>
  )
}
