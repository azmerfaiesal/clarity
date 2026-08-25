import { Archive, ArchiveRestore, Check, Flame, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Habit } from '../types'
import { addDays, formatDateTime, todayStr } from '../utils/dateUtils'
import { WEEKDAYS, habitStats, isCompletedOn, isScheduled, repetitionLabel, weekStart } from '../utils/habitUtils'
import { Dropdown, MenuDivider, MenuItem } from './Dropdown'

/**
 * One habit: its schedule, the streak it has built, and a single tap to log
 * today. Weekly and monthly habits also get their scheduled days laid out so a
 * missed one is visible rather than buried in a number.
 */
export function HabitCard({
  habit,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  justCompleted,
}: {
  habit: Habit
  onToggle: (date?: string) => void
  onEdit: () => void
  onDelete: () => void
  onArchive: (archived: boolean) => void
  /** Drives the brief highlight after a completion. */
  justCompleted: boolean
}) {
  const today = todayStr()
  const s = habitStats(habit, today)
  const archived = habit.archivedAt !== null
  const pct = s.progress.total > 0 ? Math.round((s.progress.done / s.progress.total) * 100) : 0
  const hitTarget = habit.targetStreak !== null && s.current >= habit.targetStreak

  // The scheduled days of the current week/month, so weekly and monthly habits
  // can be ticked for a day other than today.
  const cells: string[] = []
  if (habit.repetitionType !== 'daily') {
    if (habit.repetitionType === 'weekly') {
      const from = weekStart(today)
      for (let i = 0; i < 7; i++) {
        const d = addDays(from, i)
        if (isScheduled(habit, d)) cells.push(d)
      }
    } else {
      const d = new Date()
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const prefix = today.slice(0, 8)
      for (let i = 1; i <= days; i++) {
        const date = `${prefix}${String(i).padStart(2, '0')}`
        if (isScheduled(habit, date)) cells.push(date)
      }
    }
  }

  return (
    <article
      className={`anim-fade-slide-in rounded-lg border bg-raised transition-colors ${
        justCompleted ? 'border-success' : 'border-line'
      } ${archived ? 'opacity-60' : ''}`}
      style={justCompleted ? { boxShadow: `0 0 18px -6px ${habit.color}` } : undefined}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs"
          style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
          aria-hidden
        >
          {habit.icon || '•'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium text-ink">{habit.name}</h3>
          <p className="mt-0.5 truncate font-mono text-3xs text-faint">
            {repetitionLabel(habit)}
            {habit.targetStreak !== null && ` · Target ${habit.targetStreak}`}
            {archived && ' · Paused'}
          </p>
        </div>
        <Dropdown
          label="Habit actions"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={`More actions for ${habit.name}`}
              className="-mr-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => {
                  onEdit()
                  close()
                }}
              >
                Edit habit
              </MenuItem>
              <MenuItem
                icon={
                  archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />
                }
                onClick={() => {
                  onArchive(!archived)
                  close()
                }}
              >
                {archived ? 'Resume habit' : 'Pause habit'}
              </MenuItem>
              <MenuDivider />
              <MenuItem
                danger
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  onDelete()
                  close()
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>

      {habit.description && (
        <p className="mt-1.5 px-4 text-sm text-muted">{habit.description}</p>
      )}

      {/* Streaks */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4">
        <span className="inline-flex items-baseline gap-1.5">
          <span className="font-mono text-lg font-semibold tabular-nums text-ink">{s.current}</span>
          <span className="text-3xs text-faint">current</span>
          {s.current > 0 && (
            <Flame
              className="h-3.5 w-3.5 self-center"
              style={{ color: habit.color }}
              aria-hidden
            />
          )}
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span className="font-mono text-sm tabular-nums text-muted">{s.best}</span>
          <span className="text-3xs text-faint">best</span>
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span className="font-mono text-sm tabular-nums text-muted">
            {Math.round(s.rate * 100)}%
          </span>
          <span className="text-3xs text-faint">rate</span>
        </span>
        {hitTarget && (
          <span className="rounded border border-success/40 bg-success-soft px-1.5 py-0.5 font-mono text-3xs text-success">
            target reached
          </span>
        )}
      </div>

      <p className="mt-1.5 px-4 font-mono text-3xs text-faint">
        {habit.lastCompleted ? `Last done ${formatDateTime(habit.lastCompleted)}` : 'Not started yet'}
      </p>

      {/* Progress */}
      <div className="mt-3 px-4">
        <div className="mb-1 flex items-baseline justify-between font-mono text-3xs text-faint">
          <span>
            {s.progress.done}/{s.progress.total} {s.progress.label}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuenow={s.progress.done}
          aria-valuemin={0}
          aria-valuemax={s.progress.total}
          aria-label={`${s.progress.done} of ${s.progress.total} ${s.progress.label}`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: habit.color }}
          />
        </div>
      </div>

      {/* Per-day ticks for weekly/monthly */}
      {cells.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 px-4">
          {cells.map((date) => {
            const done = isCompletedOn(habit, date)
            const future = date > today
            const label =
              habit.repetitionType === 'weekly'
                ? WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]
                : String(Number(date.slice(8, 10)))
            return (
              <button
                key={date}
                type="button"
                disabled={future || archived}
                onClick={() => onToggle(date)}
                aria-pressed={done}
                aria-label={`${done ? 'Completed' : 'Not completed'} on ${date}`}
                title={date}
                className={`min-w-9 cursor-pointer rounded border px-1.5 py-1 font-mono text-3xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  done ? 'border-transparent text-accent-ink' : 'border-line text-muted hover:text-ink'
                }`}
                style={done ? { backgroundColor: habit.color } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Action */}
      <div className="mt-3.5 border-t border-line px-4 py-2.5">
        {archived ? (
          <button
            type="button"
            onClick={() => onArchive(false)}
            className="w-full cursor-pointer rounded-md border border-line py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Resume habit
          </button>
        ) : !s.dueToday ? (
          <p className="py-1 text-center font-mono text-3xs text-faint">Not scheduled today</p>
        ) : (
          <button
            type="button"
            onClick={() => onToggle()}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
              s.doneToday
                ? 'border border-line text-muted hover:bg-surface hover:text-ink'
                : 'text-accent-ink hover:opacity-90'
            }`}
            style={s.doneToday ? undefined : { backgroundColor: habit.color }}
          >
            {s.doneToday ? (
              <>
                <Check className="h-4 w-4" /> Done today · undo
              </>
            ) : (
              'Mark complete'
            )}
          </button>
        )}
      </div>
    </article>
  )
}
