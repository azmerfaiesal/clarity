import {
  Archive,
  ArchiveRestore,
  BookmarkPlus,
  Check,
  GripVertical,
  Minus,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { Habit } from '../types'
import { formatAmount, habitStats, repetitionLabel, totalAmount } from '../utils/habitUtils'
import { AmountSlider } from './AmountSlider'
import { HabitIcon } from './HabitIcon'
import { Dropdown, MenuDivider, MenuItem } from './Dropdown'
import { HabitHeatmap, HeatmapLegend } from './HabitHeatmap'

/**
 * One habit: a large check to log today on the left, the streak and lifetime
 * total on the right, and a year of history underneath.
 */
export function HabitCard({
  habit,
  onToggle,
  onAdjust,
  onEdit,
  onDelete,
  onArchive,
  justCompleted,
  onSetAmount,
  onSaveTemplate,
  dragHandleProps,
  dragging,
}: {
  habit: Habit
  onToggle: (date?: string) => void
  /** Add or remove one log, for habits that count. */
  onAdjust: (delta: number, date?: string) => void
  onEdit: () => void
  onDelete: () => void
  onArchive: (archived: boolean) => void
  justCompleted: boolean
  onSetAmount: (amount: number, date?: string) => void
  onSaveTemplate: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  dragging?: boolean
}) {
  const [sliderOpen, setSliderOpen] = useState(false)
  const holdTimer = useRef<number | null>(null)
  const heldRef = useRef(false)
  const s = habitStats(habit)
  const archived = habit.archivedAt !== null
  const canTick = s.dueToday && !archived
  const counted = habit.trackBy !== 'checkoff'
  const fromNotes = habit.source === 'notes'

  // Press and hold opens the slider; a short press just logs one.
  const startHold = () => {
    if (!canTick || !counted) return
    heldRef.current = false
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true
      setSliderOpen(true)
    }, 400)
  }
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  return (
    <article
      className={`anim-fade-slide-in rounded-xl border bg-raised px-4 py-4 transition-colors sm:px-5 ${
        justCompleted ? 'border-success' : 'border-line'
      } ${archived ? 'opacity-60' : ''}`}
      style={justCompleted ? { boxShadow: `0 0 22px -8px ${habit.color}` } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          {...dragHandleProps}
          aria-label={`Reorder ${habit.name}`}
          title="Drag to reorder"
          className={`mt-3 hidden shrink-0 cursor-grab touch-none rounded text-faint transition-colors hover:text-muted active:cursor-grabbing sm:block ${
            dragging ? 'text-accent' : ''
          }`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {/* Today's log. Counted and timed habits add one step per tap and open
            a slider on hold; checkoff habits simply toggle. */}
        <div className="relative mt-0.5 flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            disabled={!canTick || fromNotes}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onClick={() => {
              if (heldRef.current) {
                heldRef.current = false
                return
              }
              if (counted) onAdjust(habit.trackBy === 'duration' ? 5 : 1)
              else onToggle()
            }}
            aria-pressed={s.doneToday}
            aria-label={
              fromNotes
                ? `${habit.name} ticks itself when you write a note`
                : !canTick
                  ? `${habit.name} — not scheduled today`
                  : counted
                    ? `Log for ${habit.name} — ${formatAmount(habit, s.amountToday)} of ${formatAmount(habit, s.needPerDay)} today. Hold to set an exact amount.`
                    : s.doneToday
                      ? `Undo today's completion of ${habit.name}`
                      : `Mark ${habit.name} complete for today`
            }
            title={
              fromNotes
                ? 'Ticks itself when you write a note'
                : !canTick
                  ? 'Not scheduled today'
                  : counted
                    ? 'Tap to add · hold to set exactly'
                    : s.doneToday
                      ? 'Done today · undo'
                      : 'Mark complete'
            }
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              canTick && !fromNotes ? 'cursor-pointer' : ''
            } ${s.doneToday ? 'border-transparent' : 'border-line border-dashed hover:border-solid'}`}
            style={
              s.doneToday
                ? { backgroundColor: habit.color, color: 'var(--bg)' }
                : counted && s.amountToday > 0
                  ? {
                      // Partial days fill proportionally, so the button itself
                      // shows how far through the day you are.
                      backgroundColor: `${habit.color}${Math.round(
                        (s.amountToday / s.needPerDay) * 40 + 15,
                      )
                        .toString(16)
                        .padStart(2, '0')}`,
                      color: habit.color,
                    }
                  : { color: habit.color }
            }
          >
            {s.doneToday ? (
              <Check className="h-5 w-5" strokeWidth={3} />
            ) : counted ? (
              <span className="font-mono text-3xs font-semibold tabular-nums">
                {formatAmount(habit, s.amountToday)}
                <span className="opacity-60">/{formatAmount(habit, s.needPerDay)}</span>
              </span>
            ) : fromNotes ? (
              <PenLine className="h-5 w-5 opacity-50" />
            ) : habit.icon ? (
              <HabitIcon icon={habit.icon} className="h-5 w-5" />
            ) : (
              <Plus className="h-5 w-5 opacity-40" strokeWidth={2.5} />
            )}
          </button>
          {counted && s.amountToday > 0 && !archived && (
            <button
              type="button"
              onClick={() => onAdjust(habit.trackBy === 'duration' ? -5 : -1)}
              aria-label={`Remove one from ${habit.name}`}
              title="Remove one"
              className="cursor-pointer rounded p-0.5 text-faint transition-colors hover:text-danger"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
          {sliderOpen && (
            <AmountSlider
              habit={habit}
              initial={s.amountToday}
              onCommit={(v) => onSetAmount(v)}
              onClose={() => setSliderOpen(false)}
            />
          )}
        </div>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 truncate text-md font-semibold text-ink">
            {habit.icon && s.doneToday && (
              <span style={{ color: habit.color }}>
                <HabitIcon icon={habit.icon} className="h-4 w-4" />
              </span>
            )}
            <span className="truncate">{habit.name}</span>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            <span className="text-faint">{repetitionLabel(habit)}</span>
            {counted && (
              <span className="text-faint">
                {' · '}
                <span style={{ color: habit.color }}>
                  {habit.trackBy === 'duration'
                    ? formatAmount(habit, s.needPerDay)
                    : `×${s.needPerDay}`}
                </span>
              </span>
            )}
            {fromNotes && <span className="text-faint"> · Auto from Notes</span>}
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
            {s.unit === 'week' && <span className="text-3xs text-faint">wk</span>}
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
                <MenuItem
                  icon={<BookmarkPlus className="h-4 w-4" />}
                  onClick={() => {
                    onSaveTemplate()
                    close()
                  }}
                >
                  Save as template
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
          <HeatmapLegend habit={habit} />
        </div>
        <HabitHeatmap habit={habit} />
      </div>

      {/* Secondary stats */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-3 font-mono text-3xs text-faint">
        <span>
          <span className="text-muted">{s.best}</span> best streak
        </span>
        {counted && (
          <span>
            <span className="text-muted">{formatAmount(habit, totalAmount(habit))}</span>{' '}
            {habit.trackBy === 'duration' ? 'total' : 'logs'}
          </span>
        )}
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
