import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { Habit } from '../types'
import { addDays, formatDateTime, todayStr } from '../utils/dateUtils'
import {
  amountOn,
  formatAmount,
  habitStats,
  isCompletedOn,
  isScheduled,
  repetitionLabel,
  weekStart,
} from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'
import { HabitIcon } from './HabitIcon'

/**
 * The habit's record at a glance: the numbers, the last fortnight day by day,
 * and where it stands against its target. Read-only on purpose — logging lives
 * on the card, so this can be opened and dismissed without consequence.
 */
export function HabitSummary({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const today = todayStr()
  const firstDay = useWeekStart()
  const s = habitStats(habit, today, firstDay)
  const counted = habit.trackBy !== 'checkoff'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const recent = useMemo(() => {
    const out: { date: string; amount: number; done: boolean; due: boolean }[] = []
    for (let i = 13; i >= 0; i--) {
      const date = addDays(today, -i)
      out.push({
        date,
        amount: amountOn(habit, date),
        done: isCompletedOn(habit, date),
        due: isScheduled(habit, date),
      })
    }
    return out
  }, [habit, today])

  const thisWeek = useMemo(() => {
    const from = weekStart(today, firstDay)
    return Array.from({ length: 7 }, (_, i) => addDays(from, i))
  }, [today, firstDay])

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${habit.name} summary`}
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-line bg-raised shadow-2xl shadow-black/20 sm:rounded-xl dark:shadow-black/70"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
          >
            <HabitIcon icon={habit.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-md font-semibold text-ink">{habit.name}</h2>
            <p className="mt-0.5 truncate font-mono text-3xs text-faint">
              {repetitionLabel(habit)}
              {counted &&
                ` · ${habit.trackBy === 'duration' ? formatAmount(habit, s.needPerDay) : `×${s.needPerDay}`} a day`}
              {habit.reminderTime && ` · reminds ${habit.reminderTime}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Headline numbers */}
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              [s.current + (s.unit === 'week' ? 'w' : ''), 'streak'],
              [s.best + (s.unit === 'week' ? 'w' : ''), 'best'],
              [String(s.total), 'days'],
              [`${Math.round(s.rate * 100)}%`, 'rate'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-md border border-line py-2.5">
                <dd className="font-mono text-md font-semibold tabular-nums text-ink">{value}</dd>
                <dt className="text-3xs text-faint">{label}</dt>
              </div>
            ))}
          </dl>

          {/* Target progress */}
          {habit.targetStreak !== null && (
            <div className="mt-4">
              <div className="mb-1 flex items-baseline justify-between font-mono text-3xs text-faint">
                <span>Target streak</span>
                <span className="tabular-nums">
                  {Math.min(s.current, habit.targetStreak)}/{habit.targetStreak}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, (s.current / habit.targetStreak) * 100)}%`,
                    backgroundColor: habit.color,
                  }}
                />
              </div>
            </div>
          )}

          {/* This week */}
          <div className="mt-5">
            <span className="label mb-2 block">This week</span>
            <div className="flex gap-1">
              {thisWeek.map((date) => {
                const due = isScheduled(habit, date)
                const done = isCompletedOn(habit, date)
                const future = date > today
                return (
                  <div key={date} className="flex-1 text-center">
                    <div
                      className={`mb-1 h-8 rounded ${
                        done ? '' : due && !future ? 'bg-line-strong/60' : 'bg-line/40'
                      }`}
                      style={done ? { backgroundColor: habit.color } : undefined}
                      title={`${date}${due ? '' : ' · not due'}`}
                    />
                    <span className="font-mono text-3xs text-faint">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${date}T00:00:00`).getDay()]}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 font-mono text-3xs text-faint">
              {s.progress.done}/{s.progress.total} {s.progress.label}
            </p>
          </div>

          {/* Recent record */}
          <div className="mt-5">
            <span className="label mb-2 block">Last 14 days</span>
            <ul className="space-y-0.5" role="list">
              {recent
                .slice()
                .reverse()
                .filter((d) => d.due || d.amount > 0)
                .map((d) => (
                  <li
                    key={d.date}
                    className="flex items-center gap-2 rounded px-1.5 py-1 font-mono text-3xs"
                  >
                    <span className="w-20 shrink-0 text-faint">{d.date.slice(5)}</span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        d.done ? '' : d.amount > 0 ? 'opacity-50' : 'bg-line-strong'
                      }`}
                      style={d.amount > 0 ? { backgroundColor: habit.color } : undefined}
                      aria-hidden
                    />
                    <span className={d.done ? 'text-ink' : 'text-muted'}>
                      {d.amount > 0
                        ? counted
                          ? `${formatAmount(habit, d.amount)}${d.done ? '' : ' (partial)'}`
                          : 'done'
                        : d.date === today
                          ? 'still open'
                          : 'missed'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <p className="mt-4 font-mono text-3xs text-faint">
            {habit.lastCompleted
              ? `Last logged ${formatDateTime(habit.lastCompleted)}`
              : 'Not started yet'}
            {' · started '}
            {habit.createdAt.slice(0, 10)}
          </p>
        </div>
      </div>
    </div>
  )
}
