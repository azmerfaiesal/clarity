import { Archive, ArchiveRestore, Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Habit } from '../types'
import { habitStats, repetitionLabel } from '../utils/habitUtils'
import { Dropdown, MenuDivider, MenuItem } from './Dropdown'
import { HabitHeatmap, HeatmapLegend } from './HabitHeatmap'

/**
 * One habit: a large check to log today on the left, the streak and lifetime
 * total on the right, and a year of history underneath.
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
  justCompleted: boolean
}) {
  const s = habitStats(habit)
  const archived = habit.archivedAt !== null
  const canTick = s.dueToday && !archived

  return (
    <article
      className={`anim-fade-slide-in rounded-xl border bg-raised px-4 py-4 transition-colors sm:px-5 ${
        justCompleted ? 'border-success' : 'border-line'
      } ${archived ? 'opacity-60' : ''}`}
      style={justCompleted ? { boxShadow: `0 0 22px -8px ${habit.color}` } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Today's check */}
        <button
          type="button"
          disabled={!canTick}
          onClick={() => onToggle()}
          aria-pressed={s.doneToday}
          aria-label={
            !canTick
              ? `${habit.name} — not scheduled today`
              : s.doneToday
                ? `Undo today's completion of ${habit.name}`
                : `Mark ${habit.name} complete for today`
          }
          title={!canTick ? 'Not scheduled today' : s.doneToday ? 'Done today · undo' : 'Mark complete'}
          className={`mt-0.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            s.doneToday ? 'border-transparent' : 'border-line border-dashed hover:border-solid'
          }`}
          style={
            s.doneToday
              ? { backgroundColor: habit.color, color: 'var(--bg)' }
              : { color: habit.color }
          }
        >
          {s.doneToday ? (
            <Check className="h-5 w-5" strokeWidth={3} />
          ) : habit.icon ? (
            <span className="text-base">{habit.icon}</span>
          ) : (
            <Check className="h-5 w-5 opacity-40" strokeWidth={2.5} />
          )}
        </button>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-md font-semibold text-ink">
            {habit.icon && s.doneToday && <span className="mr-1.5">{habit.icon}</span>}
            {habit.name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            <span className="text-faint">{repetitionLabel(habit)}</span>
            {habit.description && <span className="text-faint"> · </span>}
            {habit.description}
            {archived && <span className="text-faint"> · Paused</span>}
          </p>
        </div>

        {/* Streak + total + menu */}
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: `${habit.color}1f` }}
            title={`Current streak${habit.targetStreak ? ` · target ${habit.targetStreak}` : ''}`}
          >
            <span aria-hidden>🔥</span>
            <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: habit.color }}>
              {s.current}
            </span>
          </span>
          <span className="hidden items-baseline gap-1 sm:inline-flex">
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">{s.total}</span>
            <span className="text-3xs text-faint">days</span>
          </span>
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
                    archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )
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
      </div>

      {/* A year of history */}
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-3xs text-faint">Last 365 days</span>
          <HeatmapLegend color={habit.color} />
        </div>
        <HabitHeatmap habit={habit} />
      </div>

      {/* Secondary stats */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-3 font-mono text-3xs text-faint">
        <span>
          <span className="text-muted">{s.best}</span> best streak
        </span>
        <span>
          <span className="text-muted">{Math.round(s.rate * 100)}%</span> completion
        </span>
        <span>
          <span className="text-muted">
            {s.progress.done}/{s.progress.total}
          </span>{' '}
          {s.progress.label}
        </span>
        {habit.targetStreak !== null && (
          <span className={s.current >= habit.targetStreak ? 'text-success' : ''}>
            <span className={s.current >= habit.targetStreak ? '' : 'text-muted'}>
              {Math.min(s.current, habit.targetStreak)}/{habit.targetStreak}
            </span>{' '}
            to target
          </span>
        )}
      </div>
    </article>
  )
}
