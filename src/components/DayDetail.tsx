import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Habit } from '../types'
import { parseDate } from '../utils/dateUtils'
import { amountOn, formatAmount, isCompletedOn, isScheduled, runContaining } from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'
import { LogNotes } from './LogNotes'
import { HabitTimer } from './HabitTimer'

/**
 * One day's record, opened from a heatmap cell: what happened, where it sits in
 * its streak, and the notes describing that day's logs.
 *
 * Positioned by the caller against the cell that was clicked, and clamped so it
 * never leaves the viewport.
 */
export function DayDetail({
  habit,
  date,
  today,
  anchor,
  editable,
  onSetNotes,
  onLogMinutes,
  onClose,
}: {
  habit: Habit
  date: string
  today: string
  anchor: { x: number; y: number }
  /** Writing habits are derived from Notes, so their days are not annotatable. */
  editable: boolean
  onSetNotes: (notes: string[]) => void
  /** Add minutes to this day, from the timer. */
  onLogMinutes?: (minutes: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const amount = amountOn(habit, date)
  const done = isCompletedOn(habit, date)
  const due = isScheduled(habit, date)
  const firstDay = useWeekStart()
  const run = runContaining(habit, date, today, firstDay)
  const notes = habit.logNotes[date] ?? []
  const counted = habit.trackBy !== 'checkoff'
  // Timing only makes sense for minutes, and only for the day being lived.
  const canTime = habit.trackBy === 'duration' && date === today && editable && !!onLogMinutes

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    setPos({
      left: Math.min(Math.max(margin, anchor.x - r.width / 2), window.innerWidth - r.width - margin),
      // Prefer above the cell; drop below when there is no room.
      top: anchor.y - r.height - 10 < margin ? anchor.y + 18 : anchor.y - r.height - 10,
    })
  }, [anchor])

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const heading = parseDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${habit.name} on ${date}`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="anim-scale-in fixed z-50 w-60 rounded-xl border border-line bg-raised p-3 shadow-2xl shadow-black/30 dark:shadow-black/70"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{heading}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs">
            {done ? (
              <>
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: habit.color }} />
                <span style={{ color: habit.color }}>
                  Completed{counted && ` (${formatAmount(habit, amount)})`}
                </span>
              </>
            ) : amount > 0 ? (
              <span className="text-muted">
                {formatAmount(habit, amount)} of {formatAmount(habit, habit.dailyTarget ?? 1)} —
                partial
              </span>
            ) : date > today ? (
              <span className="text-faint">Still to come</span>
            ) : date < habit.createdAt.slice(0, 10) ? (
              <span className="text-faint">Before this habit existed</span>
            ) : !due ? (
              <span className="text-faint">Not scheduled</span>
            ) : date === today ? (
              <span className="text-faint">Still open</span>
            ) : (
              <span className="text-faint">Missed</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-0.5 -mr-1 shrink-0 cursor-pointer rounded p-1 text-faint transition-colors hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {run && (
        <p className="mt-2 border-t border-line pt-2 font-mono text-3xs text-faint">
          {run.length === 1
            ? 'A run of one.'
            : `Day ${run.index} of a ${run.length}${
                habit.repetitionType === 'timesPerWeek' ? '-week' : ''
              } run`}
          {run.length > 1 && (
            <span className="block">
              {run.from} → {run.to}
            </span>
          )}
        </p>
      )}

      {canTime && <HabitTimer habit={habit} date={date} onLog={onLogMinutes} />}

      {(notes.length > 0 || (editable && amount > 0)) && (
        <div className="mt-2 border-t border-line pt-2">
          <span className="label mb-1 block">Notes</span>
          <LogNotes notes={notes} onChange={onSetNotes} editable={editable} />
        </div>
      )}
    </div>
  )
}
